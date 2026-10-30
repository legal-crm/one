-- OP-1 감사 기록·진단 결과 쓰기 제한 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_user_c1@example.test', 'authenticated', 'authenticated');

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  INSERT INTO audit_logs (actor_id, actor_role, action) VALUES ('x', 'anonymous', 'honeypot_attempt');
  BEGIN
    INSERT INTO audit_logs (actor_id, actor_role, action) VALUES ('x', 'anonymous', 'login');
    RAISE EXCEPTION 'FAIL anon login action';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO diagnosis_results (session_id) VALUES ('test');
    RAISE EXCEPTION 'FAIL anon diagnosis insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS anon audit allowlist + diagnosis closed';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE i int; BEGIN
  BEGIN
    INSERT INTO audit_logs (actor_id, actor_role, action) VALUES ('x', 'client', 'revoke_auth_sessions');
    RAISE EXCEPTION 'FAIL user admin-only action';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  FOR i IN 1..35 LOOP
    INSERT INTO audit_logs (actor_id, actor_role, action) VALUES ('x', 'client', 'chat_room_open');
  END LOOP;
  RAISE NOTICE 'PASS user allowlist';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM audit_logs WHERE auth_uid = '00000000-0000-4000-8000-0000000000c1') <> 30 THEN
    RAISE EXCEPTION 'FAIL rate limit: %', (SELECT count(*) FROM audit_logs WHERE auth_uid = '00000000-0000-4000-8000-0000000000c1');
  END IF;
  RAISE NOTICE 'PASS rate limit 30/min';
END $$;

ROLLBACK;
