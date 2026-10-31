-- 퇴사 처리 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test_owner_cb7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b8', 'test_staff_cb8@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b9', 'test_staff_cb9@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cb7', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test-lawyer-cb7', 'cb7', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000b801', 'test-lawyer-cb7', '00000000-0000-4000-8000-0000000000b8', 'clerk', 'A'),
  ('00000000-0000-4000-8000-00000000b901', 'test-lawyer-cb7', '00000000-0000-4000-8000-0000000000b9', 'clerk', 'B');
INSERT INTO office_clients (id, office_id, display_name) VALUES ('00000000-0000-4000-8000-00000000c701', 'test-lawyer-cb7', 'X');
INSERT INTO cases (office_id, office_client_id, case_type, staff_member_id) VALUES
  ('test-lawyer-cb7', '00000000-0000-4000-8000-00000000c701', 'rehab', '00000000-0000-4000-8000-00000000b801');
INSERT INTO sales_leads (id, office_id, assignee_user_id) VALUES ('test-lead-cb7', 'test-lawyer-cb7', '00000000-0000-4000-8000-0000000000b8');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := office_member_offboard('00000000-0000-4000-8000-00000000b801', '00000000-0000-4000-8000-00000000b901', '퇴사');
  IF (r ->> 'cases')::int <> 1 OR (r ->> 'leads')::int <> 1 THEN RAISE EXCEPTION 'FAIL counts %', r; END IF;
  RAISE NOTICE 'PASS offboard moves work';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM office_members WHERE id = '00000000-0000-4000-8000-00000000b801') <> 'left' THEN RAISE EXCEPTION 'FAIL status'; END IF;
  IF (SELECT staff_member_id FROM cases WHERE office_id = 'test-lawyer-cb7') <> '00000000-0000-4000-8000-00000000b901' THEN RAISE EXCEPTION 'FAIL case handover'; END IF;
  IF (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-cb7') <> '00000000-0000-4000-8000-0000000000b9' THEN RAISE EXCEPTION 'FAIL lead handover'; END IF;
  RAISE NOTICE 'PASS handover recorded';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_member_offboard('00000000-0000-4000-8000-00000000b901', '00000000-0000-4000-8000-00000000b901', 'x');
    RAISE EXCEPTION 'FAIL staff offboarded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS staff cannot offboard';
END $$;
RESET ROLE;
ROLLBACK;
