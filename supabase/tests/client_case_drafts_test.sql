-- 의뢰인 서류 초안 보내기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_cd1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_client_cd2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_cd3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cd1', 'TEST_CD1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-cd1', 'cd1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-cd', '00000000-0000-4000-8000-0000000000e2', 'TEST', 'counseling', 'test-lawyer-cd1');
INSERT INTO crm_clients (client_id, office_id, crm_status, notes, extension_data)
VALUES ('test-req-cd', 'test-lawyer-cd1', 'document', '[{"id":"n1","content":"내부 메모"}]', '{"keep":"yes"}');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  v := client_submit_case_draft('test-req-cd', 'income_expense', '{"d5103ClientStatus":"client_submitted","months":[1,2]}');
  IF v ->> 'field' <> 'incomeExpenseD5103' THEN RAISE EXCEPTION 'FAIL field %', v; END IF;
  PERFORM client_submit_case_draft('test-req-cd', 'life_change', '{"id":"a"}');
  PERFORM client_submit_case_draft('test-req-cd', 'life_change', '{"id":"b"}');
  BEGIN
    PERFORM client_submit_case_draft('test-req-cd', 'notes', '{"x":1}');
    RAISE EXCEPTION 'FAIL other field allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM client_submit_case_draft('test-req-cd', 'statement', '{"memo":"900101-1234567"}');
    RAISE EXCEPTION 'FAIL resident number allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS client draft kinds';
END $$;
RESET ROLE;
UPDATE crm_clients SET extension_data = extension_data || '{"courtStatement":{"status":"lawyer_reviewed"}}' WHERE client_id = 'test-req-cd';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM client_submit_case_draft('test-req-cd', 'statement', '{"status":"client_completed"}');
    RAISE EXCEPTION 'FAIL reviewed statement overwritten';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
  RAISE NOTICE 'PASS reviewed draft locked';
END $$;
RESET ROLE;
DO $$ DECLARE r crm_clients; BEGIN
  SELECT * INTO r FROM crm_clients WHERE client_id = 'test-req-cd';
  IF r.extension_data ->> 'keep' <> 'yes' THEN RAISE EXCEPTION 'FAIL other ext key lost'; END IF;
  IF r.extension_data -> 'incomeExpenseD5103' ->> 'd5103ClientStatus' <> 'client_submitted' THEN RAISE EXCEPTION 'FAIL draft not saved'; END IF;
  IF r.extension_data -> 'lifeCrisisReports' -> 0 ->> 'id' <> 'b' OR jsonb_array_length(r.extension_data -> 'lifeCrisisReports') <> 2 THEN RAISE EXCEPTION 'FAIL life list %', r.extension_data -> 'lifeCrisisReports'; END IF;
  IF r.notes -> 0 ->> 'content' <> '내부 메모' THEN RAISE EXCEPTION 'FAIL notes touched'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e1' AND kind = 'client_draft_submitted') THEN RAISE EXCEPTION 'FAIL office not notified'; END IF;
  RAISE NOTICE 'PASS saved only allowed field and notified';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM client_submit_case_draft('test-req-cd', 'property', '{"x":1}');
    RAISE EXCEPTION 'FAIL other client allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;
ROLLBACK;
