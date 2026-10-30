-- ============================================================
-- 사건 보관·파기 (CM-9) · 변제 장부 보강 (CM-8)
-- 문제: 종결 사건에 파기 예정일(5년)만 적히고 실제 파기·30일 전 안내·파기 기록이 없었다. 휴지통 30일이 지나도 그대로 남았다.
-- 바꾼 것:
--   cases.purged_at              파기한 사건 표시 (줄은 남기고 개인정보·업무 자료는 지운다 — 수납 기록은 세무 보관을 위해 금액만 남는다)
--   case_purge_log               파기 기록 (사건 ID·사무소·사유·지운 건수, 개인정보 없음)
--   purge_expired_cases()        매일: 종결 5년 지난 사건·휴지통 30일 지난 사건 → 자료 지우기 + 기록
--   notify_case_purge_soon()     매일: 파기 30일 전 사무소(case.delete 권한)에 알림
--   case_plan_payment_overview() 사건 변제 장부 요약(연속 미납 수 포함)
-- ============================================================

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS purged_at timestamptz;

CREATE TABLE IF NOT EXISTS public.case_purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  case_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('retention_expired', 'trash_expired')),
  closed_on date,
  purge_after date,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  purged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_purge_log_office_idx ON public.case_purge_log (office_id, purged_at DESC);
ALTER TABLE public.case_purge_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_purge_log FROM anon, authenticated;
GRANT SELECT ON public.case_purge_log TO authenticated;
DROP POLICY IF EXISTS case_purge_log_read ON public.case_purge_log;
CREATE POLICY case_purge_log_read ON public.case_purge_log FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.delete'));

-- 사건 작업 공간 키 (상담 요청 사건 = 상담 요청 ID, 그 밖 = 'case-' + uuid)
CREATE OR REPLACE FUNCTION public.case_workspace_key(c public.cases)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(c.consult_request_id, 'case-' || c.id::text); $$;

-- 한 사건 파기 (서버 작업 전용)
CREATE OR REPLACE FUNCTION public.purge_one_case(p_case_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c cases%ROWTYPE;
  v_key text;
  n_files int := 0; n_crm int := 0; n_debt int := 0; n_corr int := 0; n_events int := 0; n_drafts int := 0;
BEGIN
  SELECT * INTO c FROM cases WHERE id = p_case_id FOR UPDATE;
  IF c.id IS NULL OR c.purged_at IS NOT NULL THEN RETURN; END IF;
  v_key := public.case_workspace_key(c);

  -- 파일은 휴지통으로 보내 기존 파기 작업(purge_case_files)이 저장소에서 지우게 한다
  UPDATE case_files SET deleted_at = now() - interval '31 days', delete_reason = '보관 기간 만료로 파기'
   WHERE office_id = c.office_id AND client_key = v_key AND purged_at IS NULL;
  GET DIAGNOSTICS n_files = ROW_COUNT;
  DELETE FROM crm_clients WHERE office_id = c.office_id AND client_id = v_key;
  GET DIAGNOSTICS n_crm = ROW_COUNT;
  DELETE FROM debt_agency_orders WHERE office_id = c.office_id AND case_key = v_key;
  DELETE FROM debt_certificates WHERE office_id = c.office_id AND case_key = v_key;
  GET DIAGNOSTICS n_debt = ROW_COUNT;
  DELETE FROM case_exhibits WHERE office_id = c.office_id AND case_key = v_key;
  DELETE FROM correction_orders WHERE office_id = c.office_id AND case_key = v_key;
  GET DIAGNOSTICS n_corr = ROW_COUNT;
  DELETE FROM case_form_drafts WHERE case_id = c.id;
  GET DIAGNOSTICS n_drafts = ROW_COUNT;
  DELETE FROM case_events WHERE case_id = c.id;
  GET DIAGNOSTICS n_events = ROW_COUNT;
  DELETE FROM case_plan_payments WHERE case_id = c.id;
  DELETE FROM fee_client_reports WHERE case_id = c.id;
  DELETE FROM fee_case_accounts WHERE case_id = c.id;

  UPDATE cases SET title = '', court_name = NULL, case_number = NULL, purged_at = now(), updated_at = now()
   WHERE id = c.id;
  -- 이 사람의 다른 사건이 남아 있지 않으면 사람 정보도 지운다
  IF NOT EXISTS (SELECT 1 FROM cases o WHERE o.office_client_id = c.office_client_id AND o.id <> c.id AND o.purged_at IS NULL) THEN
    UPDATE office_clients SET display_name = '파기됨', real_name = NULL, phone = NULL, email = NULL, phone_hash = NULL,
           client_user_id = NULL, updated_at = now()
     WHERE id = c.office_client_id;
  END IF;

  INSERT INTO case_purge_log (office_id, case_id, reason, closed_on, purge_after, counts)
  VALUES (c.office_id, c.id, p_reason, c.closed_on, c.purge_after,
          jsonb_build_object('files', n_files, 'crm', n_crm, 'debt', n_debt, 'corrections', n_corr, 'events', n_events, 'drafts', n_drafts));
END;
$$;
REVOKE ALL ON FUNCTION public.purge_one_case(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_cases()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n int := 0;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  FOR r IN
    SELECT id, 'retention_expired' AS reason FROM cases
     WHERE purged_at IS NULL AND stage = 'closed' AND purge_after IS NOT NULL AND purge_after <= v_today
    UNION ALL
    SELECT id, 'trash_expired' FROM cases
     WHERE purged_at IS NULL AND deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.purge_one_case(r.id, r.reason);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'purge case % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_case_purge_soon()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n int := 0;
  v_day date := (now() AT TIME ZONE 'Asia/Seoul')::date + 30;
BEGIN
  FOR r IN SELECT id, office_id, purge_after FROM cases
            WHERE purged_at IS NULL AND deleted_at IS NULL AND stage = 'closed' AND purge_after = v_day LOOP
    PERFORM public.notify_office_members(r.office_id, 'case.delete', r.id, 'case_purge_soon',
      '종결 사건 자료가 30일 뒤 파기돼요',
      to_char(r.purge_after, 'YYYY-MM-DD') || '에 보관 기간(종결 후 5년)이 끝나 사건 자료를 지워요. 따로 보관해야 하는 자료가 있으면 미리 내려받아 주세요.',
      'case', 'case-' || r.id::text, 'purge_soon:' || r.id::text);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_case_purge_soon() FROM PUBLIC, anon, authenticated;

-- 파기된 사건은 다시 열거나 휴지통에서 되돌릴 수 없다
CREATE OR REPLACE FUNCTION public.cases_purged_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 서버 함수(SECURITY DEFINER)로 바꾸는 경우도 막는다 — 파기 뒤에는 어떤 경로로도 고치지 않는다
  IF OLD.purged_at IS NOT NULL THEN
    RAISE EXCEPTION 'case purged' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cases_purged_guard ON public.cases;
CREATE TRIGGER cases_purged_guard BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.cases_purged_guard();

-- ── CM-8 변제 장부 요약 (사무소·의뢰인 공통, 권한은 표 RLS와 같게) ──
CREATE OR REPLACE FUNCTION public.case_plan_payment_overview(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c cases%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_streak int := 0;
  r record;
BEGIN
  SELECT * INTO c FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF c.id IS NULL OR NOT (public.has_office_permission(c.office_id, 'case.view', c.id) OR public.is_case_client(c.id)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  -- 기한 지난 회차를 최근 것부터 세어 연속 미납 수
  FOR r IN SELECT status FROM case_plan_payments WHERE case_id = p_case_id AND due_on < v_today ORDER BY due_on DESC LOOP
    EXIT WHEN r.status IN ('confirmed', 'waived', 'client_reported');
    v_streak := v_streak + 1;
  END LOOP;
  RETURN (
    SELECT jsonb_build_object(
      'rounds', count(*),
      'confirmed', count(*) FILTER (WHERE status = 'confirmed'),
      'reported', count(*) FILTER (WHERE status = 'client_reported'),
      'overdue', count(*) FILTER (WHERE status = 'unpaid' AND due_on < v_today),
      'streak', v_streak,
      'paid_won', coalesce(sum(amount) FILTER (WHERE status = 'confirmed'), 0),
      'total_won', coalesce(sum(amount) FILTER (WHERE status <> 'waived'), 0),
      'next_due', min(due_on) FILTER (WHERE status = 'unpaid' AND due_on >= v_today)
    ) FROM case_plan_payments WHERE case_id = p_case_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.case_plan_payment_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_plan_payment_overview(uuid) TO authenticated;

-- 매일 03:30 KST (= 18:30 UTC): 파기 30일 전 알림 → 파기
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_case_retention';
  PERFORM cron.schedule('mykim_case_retention', '30 18 * * *', $job$SELECT public.notify_case_purge_soon(); SELECT public.purge_expired_cases();$job$);
END $$;
