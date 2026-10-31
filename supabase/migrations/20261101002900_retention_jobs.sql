-- ============================================================================
-- 보유 기간 자동 파기 보강 (개인정보 처리방침 2026-11-01 개정과 맞춤)
--  * 로그·관리 기록은 추가만 되는 표라 평소에는 지울 수 없다 → 이 작업 안에서만 기간 지난 줄을 지운다
--  * 서비스 이용 기록(audit_logs)·사무소 활동 기록 2년, 관리자 조치 기록 3년
--  * 끝난 로그인 세션 1년, 1:1 문의·변호사 문의·개인정보 요청 처리 기록 3년(소비자 불만·분쟁 처리 기록)
--  * pg_cron mykim_retention_records 매일 04:10 KST
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_logs_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('mykim.retention_purge', true), '') = 'on'
     AND OLD.created_at < now() - interval '2 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_actions_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('mykim.retention_purge', true), '') = 'on'
     AND OLD.created_at < now() - interval '3 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'admin_actions is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_retention_records()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_audit int := 0; n_office int := 0; n_admin int := 0; n_sess int := 0;
  n_inq int := 0; n_linq int := 0; n_priv int := 0;
BEGIN
  PERFORM set_config('mykim.retention_purge', 'on', true);

  WITH d AS (DELETE FROM audit_logs WHERE created_at < now() - interval '2 years' RETURNING 1) SELECT count(*) INTO n_audit FROM d;
  WITH d AS (DELETE FROM office_audit_logs
             WHERE coalesce(purge_after, (created_at + interval '2 years')::date) < current_date RETURNING 1) SELECT count(*) INTO n_office FROM d;
  WITH d AS (DELETE FROM admin_actions WHERE created_at < now() - interval '3 years' RETURNING 1) SELECT count(*) INTO n_admin FROM d;
  WITH d AS (DELETE FROM user_sessions
             WHERE status <> 'active' AND greatest(last_active_at, coalesce(revoked_at, last_active_at)) < now() - interval '1 year' RETURNING 1)
    SELECT count(*) INTO n_sess FROM d;
  WITH d AS (DELETE FROM client_inquiries WHERE created_at < now() - interval '3 years' RETURNING 1) SELECT count(*) INTO n_inq FROM d;
  WITH d AS (DELETE FROM lawyer_inquiries WHERE created_at < now() - interval '3 years' RETURNING 1) SELECT count(*) INTO n_linq FROM d;
  WITH d AS (DELETE FROM privacy_requests
             WHERE status IN ('done', 'rejected') AND coalesce(handled_at, created_at) < now() - interval '3 years' RETURNING 1)
    SELECT count(*) INTO n_priv FROM d;

  PERFORM set_config('mykim.retention_purge', '', true);
  RETURN jsonb_build_object('audit_logs', n_audit, 'office_audit_logs', n_office, 'admin_actions', n_admin,
    'user_sessions', n_sess, 'client_inquiries', n_inq, 'lawyer_inquiries', n_linq, 'privacy_requests', n_priv);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_retention_records() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_retention_records';
    PERFORM cron.schedule('mykim_retention_records', '10 19 * * *', $c$SELECT public.purge_retention_records()$c$);
  END IF;
END $$;
