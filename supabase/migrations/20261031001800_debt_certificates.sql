-- ============================================================
-- 부채증명 장부 (DC-2·DC-9·DC-10)
-- 문제: 부채증명서 진행·값이 브라우저(debt_cert_order_*)에만 있었고, 채권자별 기준일·이자 구성·발급 불가 사유를 담을 곳이 없었다.
--       증명서 값이 채권자목록·계산으로 가는 길도 없었다.
-- 바꾼 것:
--   debt_certificates     사건 × 채권자 줄. 상태·발급 방법·요청/예정/수령일·발급 불가 사유·대체 소명·증명서 값(values)·분류·속성·파일
--   debt_agency_orders    대행사 의뢰 기록(보낸 날·포함 줄·실제 비용·회신일). 대행사 계정·로그인은 만들지 않는다
--   office_debt_agencies  사무소 거래 대행사(이름·연락처·건당 대행비·발급비·평균 소요일)
--   client_debt_cert_progress  의뢰인은 진행(○곳 중 ○곳 받음)만, 금액은 사무소가 켜야(기본 끔, DC-Q9)
-- 권한: 보기 case.view, 쓰기 documents.manage(사건 범위), 관리자 제외. 사건 키는 crm_clients와 같음(상담 요청 ID 또는 'case-'+uuid)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.debt_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  seq integer NOT NULL DEFAULT 0,
  creditor_name text NOT NULL CHECK (char_length(creditor_name) BETWEEN 1 AND 120),
  branch text CHECK (branch IS NULL OR char_length(branch) <= 80),
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('client', 'credit_report', 'agency', 'bank', 'office')),
  method text NOT NULL DEFAULT 'agency' CHECK (method IN ('agency', 'office', 'client', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'received', 'verified', 'applied', 'unavailable')),
  requested_on date,
  expected_on date,
  received_on date,
  unavailable_reason text CHECK (unavailable_reason IS NULL OR unavailable_reason IN ('closed', 'unknown_address', 'individual', 'refused', 'assigned_pending', 'other')),
  alt_proof text CHECK (alt_proof IS NULL OR alt_proof IN ('loan_note', 'judgment', 'payment_order', 'bank_history', 'message', 'client_statement', 'other')),
  doc_type text NOT NULL DEFAULT '부채증명서' CHECK (char_length(doc_type) BETWEEN 1 AND 30),
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("values") = 'object' AND pg_column_size("values") <= 20000),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'tax_priority', 'secured', 'guarantee', 'future_indemnity', 'undetermined')),
  attrs jsonb NOT NULL DEFAULT '{"guarantee":"unknown","futureIndemnity":"unknown","secured":"unknown"}'::jsonb CHECK (jsonb_typeof(attrs) = 'object'),
  claimed_principal bigint CHECK (claimed_principal IS NULL OR claimed_principal >= 0),
  file_ids text[] NOT NULL DEFAULT '{}' CHECK (cardinality(file_ids) <= 20),
  applied_creditor_id text,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  verified_by uuid,
  verified_at timestamptz,
  applied_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS debt_certificates_case_idx ON public.debt_certificates (office_id, case_key, seq);

CREATE TABLE IF NOT EXISTS public.debt_agency_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  agency_name text NOT NULL CHECK (char_length(agency_name) BETWEEN 1 AND 80),
  sent_on date NOT NULL,
  method text NOT NULL DEFAULT 'download' CHECK (method IN ('download', 'email', 'fax', 'post', 'other')),
  certificate_ids uuid[] NOT NULL DEFAULT '{}',
  agency_fee bigint CHECK (agency_fee IS NULL OR agency_fee >= 0),
  issue_fee bigint CHECK (issue_fee IS NULL OR issue_fee >= 0),
  replied_on date,
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS debt_agency_orders_case_idx ON public.debt_agency_orders (office_id, case_key, sent_on DESC);

CREATE TABLE IF NOT EXISTS public.office_debt_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 120),
  fee_per bigint CHECK (fee_per IS NULL OR fee_per >= 0),
  issue_fee_per bigint CHECK (issue_fee_per IS NULL OR issue_fee_per >= 0),
  avg_business_days integer NOT NULL DEFAULT 7 CHECK (avg_business_days BETWEEN 1 AND 60),
  show_amounts_to_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, name)
);

ALTER TABLE public.debt_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_agency_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_debt_agencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.debt_certificates, public.debt_agency_orders, public.office_debt_agencies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_certificates, public.debt_agency_orders, public.office_debt_agencies TO authenticated;

DROP POLICY IF EXISTS debt_certificates_read ON public.debt_certificates;
CREATE POLICY debt_certificates_read ON public.debt_certificates FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS debt_certificates_insert ON public.debt_certificates;
CREATE POLICY debt_certificates_insert ON public.debt_certificates FOR INSERT TO authenticated
  WITH CHECK (public.correction_can(office_id, case_key, 'documents.manage'));
DROP POLICY IF EXISTS debt_certificates_update ON public.debt_certificates;
CREATE POLICY debt_certificates_update ON public.debt_certificates FOR UPDATE TO authenticated
  USING (public.correction_can(office_id, case_key, 'documents.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'documents.manage'));
DROP POLICY IF EXISTS debt_certificates_delete ON public.debt_certificates;
CREATE POLICY debt_certificates_delete ON public.debt_certificates FOR DELETE TO authenticated
  USING (public.correction_can(office_id, case_key, 'documents.manage') AND status IN ('pending', 'requested'));

DROP POLICY IF EXISTS debt_agency_orders_read ON public.debt_agency_orders;
CREATE POLICY debt_agency_orders_read ON public.debt_agency_orders FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS debt_agency_orders_write ON public.debt_agency_orders;
CREATE POLICY debt_agency_orders_write ON public.debt_agency_orders FOR ALL TO authenticated
  USING (public.correction_can(office_id, case_key, 'documents.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'documents.manage'));

DROP POLICY IF EXISTS office_debt_agencies_read ON public.office_debt_agencies;
CREATE POLICY office_debt_agencies_read ON public.office_debt_agencies FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));
DROP POLICY IF EXISTS office_debt_agencies_write ON public.office_debt_agencies;
CREATE POLICY office_debt_agencies_write ON public.office_debt_agencies FOR ALL TO authenticated
  USING (public.has_office_permission(office_id, 'office.settings.edit'))
  WITH CHECK (public.has_office_permission(office_id, 'office.settings.edit'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['debt_certificates', 'debt_agency_orders', 'office_debt_agencies'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS account_active_only ON public.%I', t);
    EXECUTE format('CREATE POLICY account_active_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))', t);
  END LOOP;
END $$;

-- 가드: 소속·작성 칸 고정, 버전 올림, 확인·반영 시각은 서버가
CREATE OR REPLACE FUNCTION public.debt_certificates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id; NEW.office_id := OLD.office_id; NEW.case_key := OLD.case_key;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.version := OLD.version + 1;
    IF NEW.status IN ('verified', 'applied') AND OLD.status NOT IN ('verified', 'applied') THEN
      NEW.verified_by := auth.uid(); NEW.verified_at := now();
    ELSIF NEW.status NOT IN ('verified', 'applied') THEN
      NEW.verified_by := NULL; NEW.verified_at := NULL;
    ELSE
      NEW.verified_by := OLD.verified_by; NEW.verified_at := OLD.verified_at;
    END IF;
    IF NEW.status = 'applied' AND OLD.status <> 'applied' THEN NEW.applied_at := now();
    ELSIF NEW.status <> 'applied' THEN NEW.applied_at := NULL;
    ELSE NEW.applied_at := OLD.applied_at; END IF;
  ELSE
    NEW.version := 1; NEW.verified_by := NULL; NEW.verified_at := NULL; NEW.applied_at := NULL;
    IF NEW.status IN ('verified', 'applied') THEN NEW.status := 'received'; END IF;
  END IF;
  IF NEW.status = 'unavailable' AND NEW.unavailable_reason IS NULL THEN
    RAISE EXCEPTION 'unavailable reason required' USING ERRCODE = '22023';
  END IF;
  IF NEW.status IN ('verified', 'applied') AND coalesce(NEW."values" ->> 'baseDate', '') = '' THEN
    RAISE EXCEPTION 'base date required' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS debt_certificates_guard ON public.debt_certificates;
CREATE TRIGGER debt_certificates_guard BEFORE INSERT OR UPDATE ON public.debt_certificates
  FOR EACH ROW EXECUTE FUNCTION public.debt_certificates_guard();

CREATE OR REPLACE FUNCTION public.debt_agency_orders_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id; NEW.office_id := OLD.office_id; NEW.case_key := OLD.case_key; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  END IF;
  IF cardinality(NEW.certificate_ids) > 0 AND EXISTS (
    SELECT 1 FROM unnest(NEW.certificate_ids) x WHERE NOT EXISTS (
      SELECT 1 FROM public.debt_certificates d WHERE d.id = x AND d.office_id = NEW.office_id AND d.case_key = NEW.case_key)
  ) THEN
    RAISE EXCEPTION 'certificate not in this case' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS debt_agency_orders_guard ON public.debt_agency_orders;
CREATE TRIGGER debt_agency_orders_guard BEFORE INSERT OR UPDATE ON public.debt_agency_orders
  FOR EACH ROW EXECUTE FUNCTION public.debt_agency_orders_guard();

-- 의뢰인: 진행 현황만 (금액은 사무소가 켠 경우에만), 관리자·다른 사람 불가
CREATE OR REPLACE FUNCTION public.client_debt_cert_progress(p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_show boolean;
BEGIN
  IF NOT public.client_owns_case_key(p_case_key) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT d.office_id INTO v_office FROM debt_certificates d WHERE d.case_key = p_case_key LIMIT 1;
  IF v_office IS NULL THEN RETURN jsonb_build_object('total', 0, 'received', 0, 'unavailable', 0, 'items', '[]'::jsonb); END IF;
  SELECT coalesce(bool_or(a.show_amounts_to_client), false) INTO v_show FROM office_debt_agencies a WHERE a.office_id = v_office;
  RETURN (
    SELECT jsonb_build_object(
      'total', count(*),
      'received', count(*) FILTER (WHERE d.status IN ('received', 'verified', 'applied')),
      'unavailable', count(*) FILTER (WHERE d.status = 'unavailable'),
      'items', coalesce(jsonb_agg(jsonb_build_object(
          'name', d.creditor_name,
          'received', d.status IN ('received', 'verified', 'applied'),
          'unavailable', d.status = 'unavailable',
          'principal', CASE WHEN v_show AND d.status IN ('verified', 'applied') THEN (d."values" ->> 'principal')::bigint END
        ) ORDER BY d.seq), '[]'::jsonb)
    ) FROM debt_certificates d WHERE d.case_key = p_case_key AND d.office_id = v_office
  );
END;
$$;
REVOKE ALL ON FUNCTION public.client_debt_cert_progress(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_debt_cert_progress(text) TO authenticated;
