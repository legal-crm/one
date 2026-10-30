-- ============================================================
-- SL-2 영업 DB 자동 접수 주소 (사무소 전용 접수 키)
--  * sales_lead_sources: 사무소별 접수 경로(광고 매체·랜딩 페이지·대행사). 키는 한 번만 보여 주고 SHA-256만 저장
--  * sales_intake_logs: 접수 기록 (성공·재문의·거절, 개인정보 없음)
--  * intake_sales_lead(): /api/leads 서버 함수(service role)만 호출. 키 확인 → 시간당 한도 → 같은 번호면 재문의로 기존 리드에 기록
-- 결정: SL-Q1 접수 주소 출시 전, SL-Q6 수신 거부 번호 보관은 SL 후속(sales_suppression)에서
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  key_hash text NOT NULL UNIQUE,
  key_hint text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  hourly_limit integer NOT NULL DEFAULT 200 CHECK (hourly_limit BETWEEN 1 AND 5000),
  received_count integer NOT NULL DEFAULT 0,
  last_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS sales_lead_sources_office_idx ON public.sales_lead_sources (office_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sales_intake_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id uuid REFERENCES public.sales_lead_sources(id) ON DELETE SET NULL,
  office_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('created', 'duplicate', 'rejected_key', 'rejected_limit', 'rejected_invalid')),
  lead_id text,
  note text
);
CREATE INDEX IF NOT EXISTS sales_intake_logs_source_idx ON public.sales_intake_logs (source_id, received_at DESC);

ALTER TABLE public.sales_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_intake_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_lead_sources_read ON public.sales_lead_sources;
CREATE POLICY sales_lead_sources_read ON public.sales_lead_sources FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'sales.manage'));
DROP POLICY IF EXISTS sales_intake_logs_read ON public.sales_intake_logs;
CREATE POLICY sales_intake_logs_read ON public.sales_intake_logs FOR SELECT TO authenticated
  USING (office_id IS NOT NULL AND public.has_office_permission(office_id, 'sales.manage'));
GRANT SELECT ON public.sales_lead_sources, public.sales_intake_logs TO authenticated;

-- 접수 키 만들기 (평문 키는 이 응답에서만 돌려준다)
CREATE OR REPLACE FUNCTION public.create_sales_lead_source(p_office_id text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text := 'mkl_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_id uuid;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'sales.manage') THEN
    RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'name required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (SELECT count(*) FROM public.sales_lead_sources WHERE office_id = p_office_id AND revoked_at IS NULL) >= 30 THEN
    RAISE EXCEPTION 'too many sources' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.sales_lead_sources (office_id, name, key_hash, key_hint)
  VALUES (p_office_id, left(btrim(p_name), 40), encode(extensions.digest(v_key, 'sha256'), 'hex'), right(v_key, 4))
  RETURNING id INTO v_id;
  PERFORM public.office_log(p_office_id, 'sales_source_create', 'sales_lead_source', v_id::text, jsonb_build_object('name', left(btrim(p_name), 40)));
  RETURN jsonb_build_object('id', v_id, 'key', v_key);
END;
$$;
REVOKE ALL ON FUNCTION public.create_sales_lead_source(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_lead_source(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_sales_lead_source(p_source_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.sales_lead_sources%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.sales_lead_sources WHERE id = p_source_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.has_office_permission(v.office_id, 'sales.manage') THEN
    RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.sales_lead_sources SET active = false, revoked_at = coalesce(revoked_at, now()) WHERE id = p_source_id;
  PERFORM public.office_log(v.office_id, 'sales_source_revoke', 'sales_lead_source', p_source_id::text, '{}'::jsonb);
  RETURN jsonb_build_object('id', p_source_id, 'revoked', true);
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_sales_lead_source(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_sales_lead_source(uuid) TO authenticated;

-- 접수 처리 (서버 함수 전용)
-- p_lead: {"customerName","phone","region","caseType","debtTotal","incomeNet","specialMemo","utm":{...}}
CREATE OR REPLACE FUNCTION public.intake_sales_lead(p_key text, p_lead jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_src public.sales_lead_sources%ROWTYPE;
  v_phone text := regexp_replace(coalesce(p_lead ->> 'phone', ''), '[^0-9]', '', 'g');
  v_name text := left(btrim(coalesce(p_lead ->> 'customerName', '')), 40);
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
  v_note := left(btrim(coalesce(p_lead ->> 'specialMemo', '')), 1000);

  SELECT * INTO v_existing FROM public.sales_leads
  WHERE office_id = v_src.office_id AND phone_hash = v_hash AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    -- 같은 번호 = 재문의: 새 리드를 만들지 않고 기존 리드에 기록, 종료된 리드면 '신규'로 되살림 (이관 완료는 그대로)
    v_data := v_existing.data
      || jsonb_build_object('reinquiryCount', coalesce((v_existing.data ->> 'reinquiryCount')::integer, 0) + 1, 'lastReinquiryAt', v_now)
      || jsonb_build_object('reinquiries', coalesce(v_existing.data -> 'reinquiries', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'source', v_src.name, 'memo', v_note)));
    IF v_existing.status IN ('rejected', 'ineligible', 'wrong_number') THEN
      v_data := v_data || jsonb_build_object('status', 'new');
    END IF;
    UPDATE public.sales_leads SET data = v_data WHERE id = v_existing.id;
    UPDATE public.sales_lead_sources SET received_count = received_count + 1, last_received_at = now() WHERE id = v_src.id;
    INSERT INTO public.sales_intake_logs (source_id, office_id, result, lead_id) VALUES (v_src.id, v_src.office_id, 'duplicate', v_existing.id);
    RETURN jsonb_build_object('ok', true, 'result', 'duplicate');
  END IF;

  v_id := 'lead-in-' || replace(gen_random_uuid()::text, '-', '');
  v_data := jsonb_build_object(
    'id', v_id,
    'customerName', v_name,
    'phone', CASE WHEN length(v_phone) = 11 THEN substr(v_phone, 1, 3) || '-' || substr(v_phone, 4, 4) || '-' || substr(v_phone, 8)
                  WHEN length(v_phone) = 10 THEN substr(v_phone, 1, 3) || '-' || substr(v_phone, 4, 3) || '-' || substr(v_phone, 7)
                  ELSE v_phone END,
    'status', 'new',
    'inboundPath', v_src.name,
    'batchName', '자동 접수 · ' || v_src.name,
    'region', left(btrim(coalesce(p_lead ->> 'region', '')), 40),
    'caseType', CASE WHEN p_lead ->> 'caseType' IN ('개인회생', '개인파산') THEN p_lead ->> 'caseType' ELSE '' END,
    'debtTotal', CASE WHEN (p_lead ->> 'debtTotal') ~ '^[0-9]{1,7}$' THEN (p_lead ->> 'debtTotal')::integer ELSE NULL END,
    'incomeNet', CASE WHEN (p_lead ->> 'incomeNet') ~ '^[0-9]{1,6}$' THEN (p_lead ->> 'incomeNet')::integer ELSE NULL END,
    'specialMemo', v_note,
    'utm', CASE WHEN jsonb_typeof(p_lead -> 'utm') = 'object' THEN p_lead -> 'utm' ELSE '{}'::jsonb END,
    'intakeSourceId', v_src.id,
    'callCount', 0,
    'callLogs', '[]'::jsonb,
    'reminders', '[]'::jsonb,
    'assets', '[]'::jsonb,
    'jobTypes', '[]'::jsonb,
    'createdAt', v_now,
    'updatedAt', v_now
  );
  INSERT INTO public.sales_leads (id, office_id, data) VALUES (v_id, v_src.office_id, v_data);
  UPDATE public.sales_lead_sources SET received_count = received_count + 1, last_received_at = now() WHERE id = v_src.id;
  INSERT INTO public.sales_intake_logs (source_id, office_id, result, lead_id) VALUES (v_src.id, v_src.office_id, 'created', v_id);
  RETURN jsonb_build_object('ok', true, 'result', 'created');
END;
$$;
REVOKE ALL ON FUNCTION public.intake_sales_lead(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_sales_lead(text, jsonb) TO service_role;

-- 접수 기록 90일 보관 (매일 03:20 KST)
CREATE OR REPLACE FUNCTION public.purge_sales_intake_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.sales_intake_logs WHERE received_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_sales_intake_logs() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_sales_intake_logs';
  PERFORM cron.schedule('mykim_purge_sales_intake_logs', '20 18 * * *', 'SELECT public.purge_sales_intake_logs()');
END $$;
