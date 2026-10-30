-- 사무소 서류 기준 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test_owner_t1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'test_clerk_t2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b4', 'test_owner_t4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-t1', 'TEST_T1'), ('test-lawyer-t4', 'TEST_T4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test-lawyer-t1', 't1', true),
  ('00000000-0000-4000-8000-0000000000b4', 'test-lawyer-t4', 't4', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-t1', '00000000-0000-4000-8000-0000000000b2', 'TEST 사무', 'clerk', 'active');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO office_document_templates (office_id, items, issue_valid_months) VALUES ('test-lawyer-t1', '[{"id":"x","name":"TEST"}]', 1);
UPDATE office_document_templates SET issue_valid_months = 2 WHERE office_id = 'test-lawyer-t1';
DO $$ BEGIN
  IF (SELECT version FROM office_document_templates WHERE office_id = 'test-lawyer-t1') <> 2 THEN RAISE EXCEPTION 'FAIL version'; END IF;
  RAISE NOTICE 'PASS owner writes + version';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  IF NOT EXISTS (SELECT 1 FROM office_document_templates WHERE office_id = 'test-lawyer-t1') THEN RAISE EXCEPTION 'FAIL member read'; END IF;
  UPDATE office_document_templates SET issue_valid_months = 5 WHERE office_id = 'test-lawyer-t1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL clerk edits'; END IF;
  RAISE NOTICE 'PASS clerk read-only';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM office_document_templates) THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    INSERT INTO office_document_templates (office_id) VALUES ('test-lawyer-t1');
    RAISE EXCEPTION 'FAIL cross office insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;
ROLLBACK;
