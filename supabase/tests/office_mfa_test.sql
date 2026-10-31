-- ST-11 사무소 2단계 인증 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_m1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'test_staff_m2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-m1', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-m1', 'm1', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000a201', 'test-lawyer-m1', '00000000-0000-4000-8000-0000000000a2', 'clerk', 'A');

-- 대표: aal1 이면 막힘, aal2 면 됨, aal 칸이 없는 시험 토큰은 막지 않음
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
DO $$ BEGIN
  IF has_office_permission('test-lawyer-m1', 'case.view') THEN RAISE EXCEPTION 'FAIL aal1 owner allowed'; END IF;
  IF NOT (my_mfa_requirement() ->> 'required')::boolean THEN RAISE EXCEPTION 'FAIL requirement'; END IF;
  RAISE NOTICE 'PASS aal1 owner blocked';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
DO $$ BEGIN
  IF NOT has_office_permission('test-lawyer-m1', 'case.view') THEN RAISE EXCEPTION 'FAIL aal2 owner blocked'; END IF;
  PERFORM set_office_mfa_policy('test-lawyer-m1', false);
  RAISE NOTICE 'PASS aal2 owner allowed + policy set';
END $$;
-- 직원: 사무소가 직원 필수를 끄면 aal1 이어도 됨
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
DO $$ BEGIN
  IF office_permission_scope('test-lawyer-m1', 'case.view') = 'none' THEN RAISE EXCEPTION 'FAIL staff blocked when not required'; END IF;
  BEGIN PERFORM set_office_mfa_policy('test-lawyer-m1', true); RAISE EXCEPTION 'FAIL staff changed policy';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS staff policy';
END $$;
RESET ROLE;
UPDATE offices SET staff_mfa_required = true WHERE id = 'test-lawyer-m1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
DO $$ BEGIN
  IF office_permission_scope('test-lawyer-m1', 'case.view') <> 'none' THEN RAISE EXCEPTION 'FAIL staff allowed when required'; END IF;
  RAISE NOTICE 'PASS staff blocked when required';
END $$;
RESET ROLE;
ROLLBACK;
