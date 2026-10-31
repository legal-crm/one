-- 관리자 조치 기록 점검·보관 시험 (OP-15, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a9', 'test_admin_a9@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000aa', 'test_user_aa@example.test', 'authenticated', 'authenticated');
SET LOCAL session_replication_role = replica; -- 시험용 옛 기록 넣기 (트리거 끔)
INSERT INTO admin_actions (actor_user_id, action, target_type, target_id, created_at) VALUES
  ('00000000-0000-4000-8000-0000000000a9', 'test.old', 'test', 'x', now() - interval '3 years');
SET LOCAL session_replication_role = origin;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM admin_mark_audit_reviewed((date_trunc('month', now()) - interval '1 month')::date, '이상 없음');
  IF NOT EXISTS (SELECT 1 FROM admin_audit_reviews WHERE month = (date_trunc('month', now()) - interval '1 month')::date) THEN RAISE EXCEPTION 'FAIL review row'; END IF;
  BEGIN PERFORM admin_mark_audit_reviewed((date_trunc('month', now()) + interval '2 month')::date, NULL); RAISE EXCEPTION 'FAIL future month';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RAISE NOTICE 'PASS monthly review';
END $$;
RESET ROLE;

-- 일반 사용자는 기록·점검표를 못 본다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM admin_audit_reviews) OR EXISTS (SELECT 1 FROM admin_actions) THEN RAISE EXCEPTION 'FAIL non-admin sees records'; END IF;
  BEGIN PERFORM admin_mark_audit_reviewed(date_trunc('month', now())::date, NULL); RAISE EXCEPTION 'FAIL non-admin review';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;

-- 추가만: 직접 삭제는 막히고, 보관 정리는 2년 지난 것만 지운다
DO $$ DECLARE n int; BEGIN
  BEGIN DELETE FROM admin_actions WHERE action = 'test.old'; RAISE EXCEPTION 'FAIL direct delete';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  n := purge_admin_actions();
  IF EXISTS (SELECT 1 FROM admin_actions WHERE action = 'test.old') THEN RAISE EXCEPTION 'FAIL old not purged'; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE action = 'audit.reviewed') THEN RAISE EXCEPTION 'FAIL recent purged'; END IF;
  RAISE NOTICE 'PASS retention purge';
END $$;
ROLLBACK;
