-- 오늘의 업무함 서버 함수 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_wq1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'test_clerk_wq2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'test_client_wq3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'test_owner_wq4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-wq1', 'TEST_WQ1'), ('test-lawyer-wq4', 'TEST_WQ4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-wq1', 'wq1', true),
  ('00000000-0000-4000-8000-0000000000a4', 'test-lawyer-wq4', 'wq4', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-wq1', '00000000-0000-4000-8000-0000000000a2', 'TEST 사무', 'clerk', 'active');
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-wq', '00000000-0000-4000-8000-0000000000a3', 'TEST가명', 'requested', 'test-lawyer-wq1');
INSERT INTO consult_request_lawyers (request_id, lawyer_id, client_id, respond_by, consent_version)
VALUES ('test-req-wq', 'test-lawyer-wq1', '00000000-0000-4000-8000-0000000000a3', now() - interval '1 hour', 'v1');
INSERT INTO electronic_contracts (id, client_id, client_name, lawyer_name, law_firm_name, assigned_lawyer_id, status, consult_request_id, updated_at)
VALUES ('EC-TEST-WQ', 'test-req-wq', 'TEST', 'TEST', 'TEST', 'test-lawyer-wq1', 'pending_sign', 'test-req-wq', now());

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT (create_case('test-lawyer-wq1', '{"source":"consult_request","consult_request_id":"test-req-wq","case_type":"rehab"}'::jsonb)).id IS NOT NULL AS case_created;
RESET ROLE;
INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source, review_status, created_at)
VALUES ('test-file-wq', 'test-lawyer-wq1', 'test-req-wq', 'test-lawyer-wq1/test-req-wq/client/x.pdf', 'x.pdf', 'client', 'submitted', now() - interval '3 days');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE q jsonb; k text; BEGIN
  q := office_work_queue('test-lawyer-wq1');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'kind' = 'consult_response' AND e ->> 'group' = 'overdue') THEN RAISE EXCEPTION 'FAIL seat overdue %', q; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'kind' = 'contract_waiting' AND e ->> 'group' = 'waiting') THEN RAISE EXCEPTION 'FAIL contract waiting'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'kind' = 'client_documents' AND e ->> 'alias' = 'TEST가명') THEN RAISE EXCEPTION 'FAIL docs'; END IF;
  -- 미루기 → 사라짐
  SELECT e ->> 'key' INTO k FROM jsonb_array_elements(q) e WHERE e ->> 'kind' = 'client_documents';
  PERFORM set_work_queue_override('test-lawyer-wq1', k, now() + interval '1 day', 'TEST', NULL, NULL);
  q := office_work_queue('test-lawyer-wq1');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'key' = k) THEN RAISE EXCEPTION 'FAIL snooze'; END IF;
  PERFORM set_work_queue_override('test-lawyer-wq1', k, NULL, NULL, NULL, NULL);
  q := office_work_queue('test-lawyer-wq1');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'key' = k) THEN RAISE EXCEPTION 'FAIL unsnooze'; END IF;
  RAISE NOTICE 'PASS owner queue groups + snooze';
END $$;
RESET ROLE;

-- 사무 직원: 상담 요청 권한 없음 → 상담 응답 항목 안 보임, 배정 안 된 사건 서류도 안 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE q jsonb; BEGIN
  q := office_work_queue('test-lawyer-wq1');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(q) e WHERE e ->> 'kind' IN ('consult_response', 'client_documents')) THEN RAISE EXCEPTION 'FAIL clerk scope %', q; END IF;
  RAISE NOTICE 'PASS clerk scope';
END $$;
RESET ROLE;

-- 다른 사무소: 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_work_queue('test-lawyer-wq1');
    RAISE EXCEPTION 'FAIL other office';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;
ROLLBACK;
