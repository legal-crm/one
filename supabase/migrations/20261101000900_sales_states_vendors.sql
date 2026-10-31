-- ============================================================
-- SL-3·SL-12·SL-15~17 영업 DB 상태 6개 · 수신 거부 · 영업 설정 서버 · 거래처(광고대행사)
--  * 상태: new / no_answer / callback / counseling / converted / closed (+ data.closeReason 필수)
--    옛 상태(no_answer_1~3·in_progress·rejected·ineligible·wrong_number)는 트리거가 새 상태로 옮긴다
--  * 수신 거부: 종료 사유 'opt_out'이면 번호 지문만 sales_suppression에 남긴다(리드가 파기돼도 남음).
--    같은 번호가 다시 들어오면 접수 주소는 거절, 직접 등록은 '종료(수신 거부)'로 들어온다
--  * 거래처 = 리드를 보내 주는 광고대행사. 대행사 계정·열람 없음, 접수 키로 보내기만 (SL-Q9)
--    성과 연동 지급(수임·계약·입금 결과)은 계약 방식에 없음 (SL-Q8)
-- ============================================================

-- 1) 수신 거부 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_suppression (
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  reason text NOT NULL DEFAULT 'opt_out',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (office_id, phone_hash)
);
ALTER TABLE public.sales_suppression ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_suppression FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sales_suppression TO authenticated;
DROP POLICY IF EXISTS sales_suppression_read ON public.sales_suppression;
CREATE POLICY sales_suppression_read ON public.sales_suppression FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage'));

CREATE OR REPLACE FUNCTION public.sales_phone_suppressed(p_office_id text, p_phone_hash text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_phone_hash IS NOT NULL AND EXISTS (SELECT 1 FROM sales_suppression s WHERE s.office_id = p_office_id AND s.phone_hash = p_phone_hash)
$$;
REVOKE ALL ON FUNCTION public.sales_phone_suppressed(text, text) FROM PUBLIC, anon;
-- 리드 저장 트리거(호출자 권한)가 부르므로 로그인 사용자 실행 허용 (지문은 사무소 소금값이라 밖에서 만들 수 없음)
GRANT EXECUTE ON FUNCTION public.sales_phone_suppressed(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_sales_suppression(p_office_id text, p_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text := public.sales_lead_phone_hash(p_office_id, p_phone);
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'invalid phone' USING ERRCODE = 'invalid_parameter_value'; END IF;
  INSERT INTO sales_suppression (office_id, phone_hash, created_by) VALUES (p_office_id, v_hash, auth.uid()) ON CONFLICT DO NOTHING;
  PERFORM public.office_log(p_office_id, 'sales_suppression_add', 'sales_suppression', NULL, '{}'::jsonb);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.add_sales_suppression(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_sales_suppression(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_sales_suppression(p_office_id text, p_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text := public.sales_lead_phone_hash(p_office_id, p_phone); n int;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege'; END IF;
  DELETE FROM sales_suppression WHERE office_id = p_office_id AND phone_hash = v_hash;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM public.office_log(p_office_id, 'sales_suppression_remove', 'sales_suppression', NULL, '{}'::jsonb); END IF;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_sales_suppression(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_sales_suppression(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_sales_phone_suppressed(p_office_id text, p_phone text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'sales.view') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN public.sales_phone_suppressed(p_office_id, public.sales_lead_phone_hash(p_office_id, p_phone));
END;
$$;
REVOKE ALL ON FUNCTION public.check_sales_phone_suppressed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_sales_phone_suppressed(text, text) TO authenticated;

-- 2) 상태 6개 + 종료 사유 (트리거 다시 씀) -----------------------------------
CREATE OR REPLACE FUNCTION public.sales_leads_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status text := coalesce(nullif(NEW.data ->> 'status', ''), 'new');
  v_na int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.office_id IS DISTINCT FROM OLD.office_id OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'office_id and id cannot change' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND current_user IN ('anon', 'authenticated')
       AND NOT public.has_office_permission(NEW.office_id, 'sales.manage') THEN
      RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  ELSE
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.created_by := auth.uid();
      NEW.deleted_at := NULL;
    END IF;
    NEW.version := 1;
  END IF;

  -- 옛 상태 → 새 상태
  v_na := CASE WHEN (NEW.data ->> 'noAnswerCount') ~ '^[0-9]{1,3}$' THEN (NEW.data ->> 'noAnswerCount')::int ELSE 0 END;
  IF v_status IN ('no_answer_1', 'no_answer_2', 'no_answer_3') THEN
    NEW.data := NEW.data || jsonb_build_object('noAnswerCount', greatest(v_na, substr(v_status, 11)::int));
    v_status := 'no_answer';
  ELSIF v_status = 'in_progress' THEN
    v_status := 'counseling';
  ELSIF v_status IN ('rejected', 'ineligible', 'wrong_number') THEN
    NEW.data := NEW.data || jsonb_build_object('closeReason', coalesce(nullif(NEW.data ->> 'closeReason', ''),
      CASE v_status WHEN 'rejected' THEN 'declined' WHEN 'ineligible' THEN 'not_eligible' ELSE 'wrong_number' END));
    v_status := 'closed';
  END IF;
  IF v_status NOT IN ('new', 'no_answer', 'callback', 'counseling', 'converted', 'closed') THEN v_status := 'new'; END IF;
  IF v_status = 'closed' AND coalesce(NEW.data ->> 'closeReason', '') = '' THEN
    NEW.data := NEW.data || '{"closeReason":"other"}'::jsonb;
  END IF;
  IF v_status <> 'closed' AND NEW.data ? 'closeReason' THEN
    NEW.data := NEW.data - 'closeReason' - 'closeDetail';
  END IF;

  NEW.data := jsonb_set(NEW.data, '{id}', to_jsonb(NEW.id));
  NEW.phone_hash := public.sales_lead_phone_hash(NEW.office_id, NEW.data ->> 'phone');

  -- 수신 거부 번호를 새로 넣으면 '종료(수신 거부)'로
  IF TG_OP = 'INSERT' AND v_status NOT IN ('closed', 'converted') AND public.sales_phone_suppressed(NEW.office_id, NEW.phone_hash) THEN
    v_status := 'closed';
    NEW.data := NEW.data || '{"closeReason":"opt_out","suppressedOnEntry":true}'::jsonb;
  END IF;

  NEW.data := jsonb_set(NEW.data, '{status}', to_jsonb(v_status));
  NEW.status := v_status;
  NEW.closed_at := CASE WHEN v_status IN ('converted', 'closed')
    THEN coalesce(CASE WHEN TG_OP = 'UPDATE' AND OLD.status IN ('converted', 'closed', 'rejected', 'ineligible', 'wrong_number') THEN OLD.closed_at END, now()) ELSE NULL END;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sales_leads_suppress_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND NEW.data ->> 'closeReason' = 'opt_out' AND NEW.phone_hash IS NOT NULL THEN
    INSERT INTO sales_suppression (office_id, phone_hash, created_by) VALUES (NEW.office_id, NEW.phone_hash, auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.sales_leads_suppress_after() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sales_leads_suppress_after ON public.sales_leads;
CREATE TRIGGER sales_leads_suppress_after AFTER INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_leads_suppress_after();

-- 파기 기준도 새 상태로
CREATE OR REPLACE FUNCTION public.purge_sales_leads()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.sales_leads
  WHERE (deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days')
     OR (closed_at IS NOT NULL AND status NOT IN ('converted') AND closed_at < now() - interval '1 year');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 옛 상태 리드 옮기기
UPDATE public.sales_leads SET data = data
 WHERE status IN ('no_answer_1', 'no_answer_2', 'no_answer_3', 'in_progress', 'rejected', 'ineligible', 'wrong_number');

-- 3) 영업 설정 (유입 경로·부재 재시도·통화 가능 시간·부재 문자 등) -----------
CREATE TABLE IF NOT EXISTS public.sales_settings (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.sales_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sales_settings TO authenticated;
DROP POLICY IF EXISTS sales_settings_read ON public.sales_settings;
CREATE POLICY sales_settings_read ON public.sales_settings FOR SELECT TO authenticated USING (public.has_office_permission(office_id, 'sales.view'));
DROP POLICY IF EXISTS sales_settings_insert ON public.sales_settings;
CREATE POLICY sales_settings_insert ON public.sales_settings FOR INSERT TO authenticated WITH CHECK (public.has_office_permission(office_id, 'sales.manage'));
DROP POLICY IF EXISTS sales_settings_update ON public.sales_settings;
CREATE POLICY sales_settings_update ON public.sales_settings FOR UPDATE TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage')) WITH CHECK (public.has_office_permission(office_id, 'sales.manage'));

CREATE OR REPLACE FUNCTION public.sales_settings_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.data) <> 'object' OR length(NEW.data::text) > 50000 THEN RAISE EXCEPTION 'invalid settings' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; ELSE NEW.version := 1; END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sales_settings_touch ON public.sales_settings;
CREATE TRIGGER sales_settings_touch BEFORE INSERT OR UPDATE ON public.sales_settings FOR EACH ROW EXECUTE FUNCTION public.sales_settings_touch();

-- 4) 거래처(광고대행사) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  biz_no text CHECK (biz_no IS NULL OR biz_no ~ '^[0-9]{10}$'),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 40),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 20),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 120),
  contract_start date,
  contract_end date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  contract_type text NOT NULL DEFAULT 'monthly_fixed' CHECK (contract_type IN ('monthly_fixed', 'media_plus_fee', 'per_lead', 'mixed')),
  monthly_fee integer CHECK (monthly_fee IS NULL OR monthly_fee >= 0),
  fee_percent numeric(5,2) CHECK (fee_percent IS NULL OR fee_percent BETWEEN 0 AND 100),
  per_lead_price integer CHECK (per_lead_price IS NULL OR per_lead_price >= 0),
  per_lead_ack_at timestamptz,
  collection_mode text NOT NULL DEFAULT 'entrusted' CHECK (collection_mode IN ('entrusted', 'third_party')),
  consent_version text CHECK (consent_version IS NULL OR char_length(consent_version) <= 60),
  consent_text text CHECK (consent_text IS NULL OR char_length(consent_text) <= 5000),
  consent_names_office boolean NOT NULL DEFAULT false,
  privacy_policy_checked boolean NOT NULL DEFAULT false,
  replacement_days integer NOT NULL DEFAULT 7 CHECK (replacement_days BETWEEN 0 AND 90),
  replacement_reasons text[] NOT NULL DEFAULT ARRAY['wrong_number', 'duplicate', 'not_self', 'false_info', 'opt_out'],
  memo text CHECK (memo IS NULL OR char_length(memo) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contract_end IS NULL OR contract_start IS NULL OR contract_end >= contract_start),
  CHECK (contract_type NOT IN ('per_lead', 'mixed') OR per_lead_price IS NULL OR per_lead_ack_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sales_vendors_office_idx ON public.sales_vendors (office_id, name);
ALTER TABLE public.sales_vendors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_vendors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_vendors TO authenticated;
DROP POLICY IF EXISTS sales_vendors_read ON public.sales_vendors;
CREATE POLICY sales_vendors_read ON public.sales_vendors FOR SELECT TO authenticated USING (public.has_office_permission(office_id, 'sales.view'));
DROP POLICY IF EXISTS sales_vendors_write ON public.sales_vendors;
CREATE POLICY sales_vendors_write ON public.sales_vendors FOR ALL TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage')) WITH CHECK (public.has_office_permission(office_id, 'sales.manage'));

CREATE OR REPLACE FUNCTION public.sales_vendors_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.office_id IS DISTINCT FROM OLD.office_id THEN RAISE EXCEPTION 'office_id cannot change' USING ERRCODE = 'insufficient_privilege'; END IF;
    NEW.created_at := OLD.created_at; NEW.created_by := OLD.created_by;
  END IF;
  NEW.biz_no := nullif(regexp_replace(coalesce(NEW.biz_no, ''), '[^0-9]', '', 'g'), '');
  NEW.updated_at := now();
  PERFORM public.office_log(NEW.office_id, CASE WHEN TG_OP = 'INSERT' THEN 'sales_vendor_create' ELSE 'sales_vendor_update' END, 'sales_vendor', NEW.id::text,
    jsonb_build_object('contract_type', NEW.contract_type, 'status', NEW.status, 'per_lead_ack', NEW.per_lead_ack_at IS NOT NULL));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sales_vendors_touch ON public.sales_vendors;
CREATE TRIGGER sales_vendors_touch BEFORE INSERT OR UPDATE ON public.sales_vendors FOR EACH ROW EXECUTE FUNCTION public.sales_vendors_touch();

-- 접수 키 ↔ 거래처
ALTER TABLE public.sales_lead_sources ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.sales_vendors(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_sales_source_vendor(p_source_id uuid, p_vendor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sales_lead_sources;
BEGIN
  SELECT * INTO s FROM sales_lead_sources WHERE id = p_source_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'source not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.has_office_permission(s.office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sales_vendors v WHERE v.id = p_vendor_id AND v.office_id = s.office_id) THEN
    RAISE EXCEPTION 'vendor not found' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE sales_lead_sources SET vendor_id = p_vendor_id WHERE id = s.id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_sales_source_vendor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sales_source_vendor(uuid, uuid) TO authenticated;

-- 불량 리드 교체 요청
CREATE TABLE IF NOT EXISTS public.sales_vendor_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.sales_vendors(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  vendor_lead_ref text,
  phone_last4 text,
  reason text NOT NULL,
  lead_received_at timestamptz,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'replaced', 'refused', 'refunded')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid DEFAULT auth.uid(),
  resolved_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  UNIQUE (vendor_id, lead_id)
);
ALTER TABLE public.sales_vendor_replacements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_vendor_replacements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sales_vendor_replacements TO authenticated;
DROP POLICY IF EXISTS sales_vendor_replacements_read ON public.sales_vendor_replacements;
CREATE POLICY sales_vendor_replacements_read ON public.sales_vendor_replacements FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage'));

-- 교체 후보: 거래처 리드 중 접수 뒤 교체 기간 안에 교체 사유로 종료된 것 (아직 요청 안 한 것)
CREATE OR REPLACE FUNCTION public.sales_vendor_replacement_candidates(p_vendor_id uuid)
RETURNS TABLE (lead_id text, vendor_lead_ref text, phone_last4 text, reason text, received_at timestamptz, closed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v sales_vendors;
BEGIN
  SELECT * INTO v FROM sales_vendors WHERE id = p_vendor_id;
  IF v.id IS NULL OR NOT public.has_office_permission(v.office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN QUERY
  SELECT l.id, nullif(l.data ->> 'vendorLeadRef', ''), right(regexp_replace(coalesce(l.data ->> 'phone', ''), '[^0-9]', '', 'g'), 4),
         l.data ->> 'closeReason', l.created_at, l.closed_at
    FROM sales_leads l
   WHERE l.office_id = v.office_id AND l.deleted_at IS NULL AND l.status = 'closed'
     AND l.data ->> 'vendorId' = v.id::text
     AND (l.data ->> 'closeReason') = ANY (v.replacement_reasons)
     AND l.closed_at <= l.created_at + make_interval(days => v.replacement_days)
     AND NOT EXISTS (SELECT 1 FROM sales_vendor_replacements r WHERE r.vendor_id = v.id AND r.lead_id = l.id)
   ORDER BY l.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.sales_vendor_replacement_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_vendor_replacement_candidates(uuid) TO authenticated;

-- 요청 만들기 → 대행사에 보낼 줄(이름·번호 없음)
CREATE OR REPLACE FUNCTION public.request_sales_vendor_replacements(p_vendor_id uuid, p_lead_ids text[])
RETURNS SETOF public.sales_vendor_replacements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v sales_vendors;
BEGIN
  SELECT * INTO v FROM sales_vendors WHERE id = p_vendor_id;
  IF v.id IS NULL OR NOT public.has_office_permission(v.office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  INSERT INTO sales_vendor_replacements (office_id, vendor_id, lead_id, vendor_lead_ref, phone_last4, reason, lead_received_at)
  SELECT v.office_id, v.id, c.lead_id, c.vendor_lead_ref, CASE WHEN c.vendor_lead_ref IS NULL THEN c.phone_last4 END, c.reason, c.received_at
    FROM public.sales_vendor_replacement_candidates(p_vendor_id) c
   WHERE c.lead_id = ANY (p_lead_ids)
  ON CONFLICT (vendor_id, lead_id) DO NOTHING;
  PERFORM public.office_log(v.office_id, 'sales_vendor_replacement_request', 'sales_vendor', v.id::text, jsonb_build_object('count', cardinality(p_lead_ids)));
  RETURN QUERY SELECT * FROM sales_vendor_replacements r WHERE r.vendor_id = v.id AND r.lead_id = ANY (p_lead_ids) ORDER BY r.lead_received_at;
END;
$$;
REVOKE ALL ON FUNCTION public.request_sales_vendor_replacements(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_sales_vendor_replacements(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_sales_vendor_replacement_result(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r sales_vendor_replacements;
BEGIN
  SELECT * INTO r FROM sales_vendor_replacements WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.has_office_permission(r.office_id, 'sales.manage') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_status NOT IN ('requested', 'replaced', 'refused', 'refunded') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = 'invalid_parameter_value'; END IF;
  UPDATE sales_vendor_replacements SET status = p_status, note = left(nullif(btrim(coalesce(p_note, '')), ''), 500),
         resolved_at = CASE WHEN p_status = 'requested' THEN NULL ELSE now() END WHERE id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_sales_vendor_replacement_result(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sales_vendor_replacement_result(uuid, text, text) TO authenticated;

-- 월 청구·지급 기록
CREATE TABLE IF NOT EXISTS public.sales_vendor_billings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.sales_vendors(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  media_cost integer NOT NULL DEFAULT 0 CHECK (media_cost >= 0),
  fee_amount integer NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  other_amount integer NOT NULL DEFAULT 0 CHECK (other_amount >= 0),
  invoice_no text CHECK (invoice_no IS NULL OR char_length(invoice_no) <= 60),
  paid_on date,
  memo text CHECK (memo IS NULL OR char_length(memo) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (vendor_id, month)
);
ALTER TABLE public.sales_vendor_billings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_vendor_billings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_vendor_billings TO authenticated;
DROP POLICY IF EXISTS sales_vendor_billings_all ON public.sales_vendor_billings;
CREATE POLICY sales_vendor_billings_all ON public.sales_vendor_billings FOR ALL TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage')) WITH CHECK (
    public.has_office_permission(office_id, 'sales.manage')
    AND EXISTS (SELECT 1 FROM sales_vendors v WHERE v.id = vendor_id AND v.office_id = sales_vendor_billings.office_id));

-- 5) 통계 (개인정보 없음, 사무소 전체 범위만) --------------------------------
CREATE OR REPLACE FUNCTION public.sales_funnel_stats(p_office_id text, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from timestamptz := (p_from::timestamp AT TIME ZONE 'Asia/Seoul');
  v_to timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Seoul');
  v_invalid text[] := ARRAY['wrong_number', 'duplicate', 'not_self', 'false_info'];
  v_unreached text[] := ARRAY['unreachable', 'wrong_number'];
BEGIN
  IF coalesce(public.office_permission_scope(p_office_id, 'sales.view'), 'none') <> 'all' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 400 THEN RAISE EXCEPTION 'invalid range' USING ERRCODE = 'invalid_parameter_value'; END IF;
  RETURN (
    WITH l AS (
      SELECT x.status, x.data ->> 'closeReason' AS reason, coalesce(nullif(x.data ->> 'inboundPath', ''), '미지정') AS source,
             nullif(x.data ->> 'vendorId', '') AS vendor_id, x.created_at,
             CASE WHEN (x.data ->> 'firstContactAt') ~ '^\d{4}-' THEN (x.data ->> 'firstContactAt')::timestamptz END AS first_contact,
             (x.data ->> 'reachedCounseling') = 'true' OR x.status IN ('counseling', 'converted') AS counseled
        FROM sales_leads x
       WHERE x.office_id = p_office_id AND x.deleted_at IS NULL AND x.created_at >= v_from AND x.created_at < v_to
    ), g AS (
      SELECT k.kind, k.key,
             count(*) AS leads,
             count(*) FILTER (WHERE NOT (l.status = 'closed' AND l.reason = ANY (v_invalid))) AS valid,
             count(*) FILTER (WHERE l.status NOT IN ('new', 'no_answer') AND NOT (l.status = 'closed' AND l.reason = ANY (v_unreached))) AS connected,
             count(*) FILTER (WHERE l.counseled) AS counseled,
             count(*) FILTER (WHERE l.status = 'converted') AS converted,
             round(avg(extract(epoch FROM (l.first_contact - l.created_at)) / 60) FILTER (WHERE l.first_contact IS NOT NULL))::int AS first_contact_min
        FROM l
        CROSS JOIN LATERAL (VALUES ('source', l.source), ('vendor', coalesce(l.vendor_id, '-'))) k(kind, key)
       GROUP BY k.kind, k.key
    ), r AS (
      SELECT k.kind, k.key, jsonb_object_agg(l.reason, l.n) AS reasons
        FROM (SELECT source, coalesce(vendor_id, '-') AS vendor_id, coalesce(reason, 'other') AS reason, count(*) AS n FROM l WHERE l.status = 'closed' GROUP BY 1, 2, 3) l
        CROSS JOIN LATERAL (VALUES ('source', l.source), ('vendor', l.vendor_id)) k(kind, key)
       GROUP BY k.kind, k.key
    ), c AS (
      SELECT b.vendor_id::text AS key, sum(b.media_cost + b.fee_amount + b.other_amount)::bigint AS cost
        FROM sales_vendor_billings b
       WHERE b.office_id = p_office_id AND b.month >= date_trunc('month', p_from)::date AND b.month <= p_to
       GROUP BY b.vendor_id
    )
    SELECT jsonb_build_object(
      'from', p_from, 'to', p_to,
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'kind', g.kind, 'key', g.key, 'leads', g.leads, 'valid', g.valid, 'connected', g.connected, 'counseled', g.counseled,
        'converted', g.converted, 'first_contact_min', g.first_contact_min, 'reasons', coalesce(r.reasons, '{}'::jsonb),
        'cost', CASE WHEN g.kind = 'vendor' THEN c.cost END,
        'per_lead_price', CASE WHEN g.kind = 'vendor' THEN (SELECT v.per_lead_price FROM sales_vendors v WHERE v.id::text = g.key) END
      ) ORDER BY g.kind, g.leads DESC), '[]'::jsonb))
    FROM g LEFT JOIN r ON r.kind = g.kind AND r.key = g.key
           LEFT JOIN c ON g.kind = 'vendor' AND c.key = g.key
  );
END;
$$;
REVOKE ALL ON FUNCTION public.sales_funnel_stats(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_funnel_stats(text, date, date) TO authenticated;

-- 6) 접수 주소: 거래처·수신 거부·새 상태 반영 (다시 씀) -----------------------
ALTER TABLE public.sales_intake_logs DROP CONSTRAINT IF EXISTS sales_intake_logs_result_check;
ALTER TABLE public.sales_intake_logs ADD CONSTRAINT sales_intake_logs_result_check
  CHECK (result IN ('created', 'duplicate', 'rejected_key', 'rejected_limit', 'rejected_invalid', 'rejected_suppressed', 'rejected_contract'));

CREATE OR REPLACE FUNCTION public.intake_sales_lead(p_key text, p_lead jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_src public.sales_lead_sources%ROWTYPE;
  v_vendor public.sales_vendors%ROWTYPE;
  v_phone text := regexp_replace(coalesce(p_lead ->> 'phone', ''), '[^0-9]', '', 'g');
  v_name text := left(btrim(coalesce(p_lead ->> 'customerName', '')), 40);
  v_ref text := left(nullif(btrim(coalesce(p_lead ->> 'vendorLeadRef', '')), ''), 60);
  v_hash text;
  v_existing public.sales_leads%ROWTYPE;
  v_id text;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_note text;
  v_data jsonb;
BEGIN
  SELECT * INTO v_src FROM public.sales_lead_sources
  WHERE key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  IF NOT FOUND OR NOT v_src.active OR v_src.revoked_at IS NOT NULL THEN
    INSERT INTO public.sales_intake_logs (source_id, office_id, result) VALUES (v_src.id, v_src.office_id, 'rejected_key');
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_key');
  END IF;

  IF v_src.vendor_id IS NOT NULL THEN
    SELECT * INTO v_vendor FROM public.sales_vendors WHERE id = v_src.vendor_id;
    IF v_vendor.status = 'ended' OR (v_vendor.contract_end IS NOT NULL AND v_vendor.contract_end < public.seoul_today()) THEN
      INSERT INTO public.sales_intake_logs (source_id, office_id, result, note) VALUES (v_src.id, v_src.office_id, 'rejected_contract', 'contract ended');
      RETURN jsonb_build_object('ok', false, 'code', 'contract_ended');
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.sales_intake_logs
      WHERE source_id = v_src.id AND received_at > now() - interval '1 hour' AND result IN ('created', 'duplicate')) >= v_src.hourly_limit THEN
    INSERT INTO public.sales_intake_logs (source_id, office_id, result) VALUES (v_src.id, v_src.office_id, 'rejected_limit');
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited');
  END IF;

  IF length(v_phone) < 9 OR length(v_phone) > 12 OR v_name = '' THEN
    INSERT INTO public.sales_intake_logs (source_id, office_id, result, note) VALUES (v_src.id, v_src.office_id, 'rejected_invalid', 'name/phone');
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_lead');
  END IF;

  v_hash := public.sales_lead_phone_hash(v_src.office_id, v_phone);
  IF public.sales_phone_suppressed(v_src.office_id, v_hash) THEN
    INSERT INTO public.sales_intake_logs (source_id, office_id, result) VALUES (v_src.id, v_src.office_id, 'rejected_suppressed');
    RETURN jsonb_build_object('ok', false, 'code', 'opted_out');
  END IF;
  v_note := left(btrim(coalesce(p_lead ->> 'specialMemo', '')), 1000);

  SELECT * INTO v_existing FROM public.sales_leads
  WHERE office_id = v_src.office_id AND phone_hash = v_hash AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    v_data := v_existing.data
      || jsonb_build_object('reinquiryCount', coalesce((v_existing.data ->> 'reinquiryCount')::integer, 0) + 1, 'lastReinquiryAt', v_now)
      || jsonb_build_object('reinquiries', coalesce(v_existing.data -> 'reinquiries', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'source', v_src.name, 'memo', v_note)));
    -- 종료된 리드는 '신규'로 되살림 (이관 완료·수신 거부는 그대로)
    IF v_existing.status = 'closed' AND coalesce(v_existing.data ->> 'closeReason', '') <> 'opt_out' THEN
      v_data := (v_data || jsonb_build_object('status', 'new', 'noAnswerCount', 0)) - 'nextAttemptAt';
    END IF;
    UPDATE public.sales_leads SET data = v_data WHERE id = v_existing.id;
    UPDATE public.sales_lead_sources SET received_count = received_count + 1, last_received_at = now() WHERE id = v_src.id;
    INSERT INTO public.sales_intake_logs (source_id, office_id, result, lead_id) VALUES (v_src.id, v_src.office_id, 'duplicate', v_existing.id);
    RETURN jsonb_build_object('ok', true, 'result', 'duplicate', 'receipt', v_existing.id);
  END IF;

  v_id := 'lead-in-' || replace(gen_random_uuid()::text, '-', '');
  v_data := jsonb_build_object(
    'id', v_id,
    'customerName', v_name,
    'phone', CASE WHEN length(v_phone) = 11 THEN substr(v_phone, 1, 3) || '-' || substr(v_phone, 4, 4) || '-' || substr(v_phone, 8)
                  WHEN length(v_phone) = 10 THEN substr(v_phone, 1, 3) || '-' || substr(v_phone, 4, 3) || '-' || substr(v_phone, 7)
                  ELSE v_phone END,
    'status', 'new',
    'noAnswerCount', 0,
    'inboundPath', v_src.name,
    'batchName', '자동 접수 · ' || v_src.name,
    'region', left(btrim(coalesce(p_lead ->> 'region', '')), 40),
    'caseType', CASE WHEN p_lead ->> 'caseType' IN ('개인회생', '개인파산') THEN p_lead ->> 'caseType' ELSE '' END,
    'debtTotal', CASE WHEN (p_lead ->> 'debtTotal') ~ '^[0-9]{1,7}$' THEN (p_lead ->> 'debtTotal')::integer ELSE NULL END,
    'incomeNet', CASE WHEN (p_lead ->> 'incomeNet') ~ '^[0-9]{1,6}$' THEN (p_lead ->> 'incomeNet')::integer ELSE NULL END,
    'specialMemo', v_note,
    'utm', CASE WHEN jsonb_typeof(p_lead -> 'utm') = 'object' THEN p_lead -> 'utm' ELSE '{}'::jsonb END,
    'intakeSourceId', v_src.id,
    'callCount', 0, 'callLogs', '[]'::jsonb, 'reminders', '[]'::jsonb, 'assets', '[]'::jsonb, 'jobTypes', '[]'::jsonb,
    'createdAt', v_now, 'updatedAt', v_now
  );
  IF v_src.vendor_id IS NOT NULL THEN
    v_data := v_data || jsonb_build_object('vendorId', v_src.vendor_id, 'vendorLeadRef', v_ref,
      'consentVersion', v_vendor.consent_version);
  END IF;
  INSERT INTO public.sales_leads (id, office_id, data) VALUES (v_id, v_src.office_id, v_data);
  UPDATE public.sales_lead_sources SET received_count = received_count + 1, last_received_at = now() WHERE id = v_src.id;
  INSERT INTO public.sales_intake_logs (source_id, office_id, result, lead_id) VALUES (v_src.id, v_src.office_id, 'created', v_id);
  RETURN jsonb_build_object('ok', true, 'result', 'created', 'receipt', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.intake_sales_lead(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_sales_lead(text, jsonb) TO service_role;
