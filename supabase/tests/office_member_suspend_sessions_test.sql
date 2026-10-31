-- RB-7 직원 정지 → 로그인 세션 삭제 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f5', 'test_owner_ss@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f6', 'test_staff_ss@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ss', 'TEST_SS');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000f5', 'test-lawyer-ss', 'ss', true);
INSERT INTO office_members (office_id, user_id, display_name, role) VALUES ('test-lawyer-ss', '00000000-0000-4000-8000-0000000000f6', 'TEST 직원', 'clerk');
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000f6', now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000f5', now(), now());
UPDATE office_members SET status = 'suspended' WHERE office_id = 'test-lawyer-ss' AND user_id = '00000000-0000-4000-8000-0000000000f6';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = '00000000-0000-4000-8000-0000000000f6') THEN RAISE EXCEPTION 'FAIL staff session kept'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = '00000000-0000-4000-8000-0000000000f5') THEN RAISE EXCEPTION 'FAIL owner session removed'; END IF;
  RAISE NOTICE 'PASS suspended staff sessions removed';
END $$;
ROLLBACK;
