-- ============================================================
-- OP-11 개인정보 요청(열람·정정·삭제·처리 정지)·자동 파기 기록
--  * privacy_requests: 이용자가 요청 → 관리자 처리(법정 기한 10일, due_on). 내용은 요청 종류·짧은 설명만
--  * privacy_purge_log: 자동 파기 기록(건수만, 개인정보 없음)
--  * purge_stale_consult_requests(): 사건으로 이어지지 않은 상담 요청은 마지막 활동 1년 뒤 파기 (L-보유기간 결정: 미연결 1년)
--    사건·사건 관리 데이터·서류가 있는 요청은 사건 보관 규칙(종결 5년)을 따르므로 건드리지 않는다
-- ============================================================

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('access', 'correction', 'deletion', 'suspension', 'withdrawal_consent')),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 1000),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'done', 'rejected')),
  due_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date + 10),
  response text CHECK (response IS NULL OR char_length(response) <= 1000),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS privacy_requests_status_idx ON public.privacy_requests (status, due_on);
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
DROP POLICY IF EXISTS privacy_requests_read ON public.privacy_requests;
CREATE POLICY privacy_requests_read ON public.privacy_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.submit_privacy_request(p_kind text, p_detail text DEFAULT NULL)
RETURNS public.privacy_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v privacy_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('access', 'correction', 'deletion', 'suspension', 'withdrawal_consent') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM privacy_requests WHERE user_id = auth.uid() AND status IN ('received', 'in_progress')) >= 5 THEN
    RAISE EXCEPTION 'too many open privacy requests' USING ERRCODE = '22023';
  END IF;
  INSERT INTO privacy_requests (user_id, kind, detail) VALUES (auth.uid(), p_kind, nullif(left(btrim(coalesce(p_detail, '')), 1000), ''))
  RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_privacy_request(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_privacy_request(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_handle_privacy_request(p_id uuid, p_status text, p_response text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v privacy_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('in_progress', 'done', 'rejected') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023'; END IF;
  IF p_status IN ('done', 'rejected') AND coalesce(btrim(p_response), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM privacy_requests WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE privacy_requests SET status = p_status, response = nullif(left(btrim(coalesce(p_response, '')), 1000), ''),
         handled_by = auth.uid(), handled_at = now()
   WHERE id = p_id;
  PERFORM public.admin_record_action('privacy_request.' || p_status, 'privacy_request', p_id::text,
    jsonb_build_object('status', v.status, 'kind', v.kind), jsonb_build_object('status', p_status), p_response);
  IF p_status IN ('done', 'rejected') THEN
    PERFORM public.notify_user(v.user_id, 'client', NULL, 'privacy_request_' || p_status,
      CASE WHEN p_status = 'done' THEN '개인정보 요청을 처리했어요' ELSE '개인정보 요청 처리 결과가 있어요' END,
      left(btrim(p_response), 200), 'privacy_request', p_id::text, NULL);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_handle_privacy_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_handle_privacy_request(uuid, text, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.privacy_purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  target_count integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.privacy_purge_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_purge_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.privacy_purge_log TO authenticated;
GRANT ALL ON public.privacy_purge_log TO service_role;
DROP POLICY IF EXISTS privacy_purge_log_admin ON public.privacy_purge_log;
CREATE POLICY privacy_purge_log_admin ON public.privacy_purge_log FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 사건으로 이어지지 않은 상담 요청: 마지막 활동(요청 갱신·마지막 메시지) 1년 뒤 파기
CREATE OR REPLACE FUNCTION public.purge_stale_consult_requests(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids text[]; v_n integer;
BEGIN
  SELECT coalesce(array_agg(r.id), '{}') INTO v_ids FROM (
    SELECT r.id FROM consult_requests r
    WHERE greatest(coalesce(r.updated_at, r.created_at), coalesce((SELECT max(m.created_at) FROM consult_messages m WHERE m.consult_request_id = r.id), r.created_at))
          < now() - interval '1 year'
      AND r.status NOT IN ('contracted')
      AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.consult_request_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM crm_clients cc WHERE cc.client_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM case_files f WHERE f.client_key = r.id)
      AND NOT EXISTS (SELECT 1 FROM electronic_contracts e WHERE e.consult_request_id = r.id)
    ORDER BY r.created_at LIMIT greatest(1, least(p_limit, 2000))) r;
  IF cardinality(v_ids) = 0 THEN RETURN 0; END IF;
  DELETE FROM consult_messages WHERE consult_request_id = ANY (v_ids);
  DELETE FROM consult_requests WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO privacy_purge_log (kind, target_count, detail) VALUES ('stale_consult_request', v_n, jsonb_build_object('rule', '사건 미연결 상담 요청 마지막 활동 1년'));
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_stale_consult_requests(integer) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_stale_consult_requests';
  PERFORM cron.schedule('mykim_purge_stale_consult_requests', '35 18 * * *', 'SELECT public.purge_stale_consult_requests(500)');
END;
$$;

-- 관리자 '오늘 처리할 일'에 열린 신고·개인정보 요청 추가 (본문 끝 RETURN 앞에 끼워 넣는다)
DO $$
DECLARE
  d text := pg_get_functiondef('public.admin_todo_items()'::regprocedure);
  add text := $add$
  SELECT count(*), min(c.created_at) INTO n, t FROM consult_reports c WHERE c.status = 'open';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'consult_report', 'label', '상담 신고 처리 대기', 'count', n, 'oldest_at', t,
    'overdue', public.business_days_between(t) > 2, 'tab', 'clients'); END IF;

  SELECT count(*), min(p.created_at) INTO n, t FROM privacy_requests p WHERE p.status IN ('received', 'in_progress');
  IF n > 0 THEN v := v || jsonb_build_object('key', 'privacy_request', 'label', '개인정보 요청 (10일 안 처리)', 'count', n, 'oldest_at', t,
    'overdue', EXISTS (SELECT 1 FROM privacy_requests p2 WHERE p2.status IN ('received', 'in_progress') AND p2.due_on < (now() AT TIME ZONE 'Asia/Seoul')::date), 'tab', 'members'); END IF;

  RETURN v;$add$;
  i integer;
BEGIN
  IF position('consult_report' IN d) > 0 THEN RETURN; END IF;
  i := length(d) - position(reverse('RETURN v;') IN reverse(d)) - length('RETURN v;') + 2;
  IF i <= 0 THEN RAISE EXCEPTION 'admin_todo_items: RETURN not found'; END IF;
  EXECUTE substr(d, 1, i - 1) || add || substr(d, i + length('RETURN v;'));
END;
$$;
