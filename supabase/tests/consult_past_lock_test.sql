-- '지난 상담' 읽기만 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f3', 'test_client_cf3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cf1', 'TEST_CF1'), ('test-lawyer-cf2', 'TEST_CF2');
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id, selected_lawyer_ids, accepted_lawyer_ids)
VALUES ('test-req-cf', '00000000-0000-4000-8000-0000000000f3', 'TEST', 'contracted', 'test-lawyer-cf1',
        '["test-lawyer-cf1","test-lawyer-cf2"]'::jsonb, '["test-lawyer-cf1","test-lawyer-cf2"]'::jsonb);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, target_lawyer_id)
  VALUES ('test-msg-cf1', 'test-req-cf', 'client', '00000000-0000-4000-8000-0000000000f3', 'TEST', '담당 변호사에게', 'test-lawyer-cf1');
  BEGIN
    INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, target_lawyer_id)
    VALUES ('test-msg-cf2', 'test-req-cf', 'client', '00000000-0000-4000-8000-0000000000f3', 'TEST', '지난 변호사에게', 'test-lawyer-cf2');
    RAISE EXCEPTION 'FAIL past lawyer message allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS past consult is read only';
END $$;
RESET ROLE;
UPDATE consult_requests SET status = 'closed' WHERE id = 'test-req-cf';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, target_lawyer_id)
    VALUES ('test-msg-cf3', 'test-req-cf', 'client', '00000000-0000-4000-8000-0000000000f3', 'TEST', '종료 뒤', 'test-lawyer-cf1');
    RAISE EXCEPTION 'FAIL closed consult message allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS closed consult blocks client messages';
END $$;
RESET ROLE;
ROLLBACK;
