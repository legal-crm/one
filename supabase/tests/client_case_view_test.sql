-- MY-1 client_case_view 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test_owner_j1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d8', 'test_client_j2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d9', 'test_client_j3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-j1', 'TEST_J1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000d7', 'test-lawyer-j1', 'j1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-j', '00000000-0000-4000-8000-0000000000d8', 'TEST', 'counseling', 'test-lawyer-j1');
INSERT INTO crm_clients (client_id, office_id, crm_status, documents, notes, extension_data)
VALUES ('test-req-j', 'test-lawyer-j1', 'document',
  '[{"id":"doc-01","label":"주민등록등본","reviewStatus":"rejected","rejectionReason":"발급일 지남","reviewerNote":"내부 메모","checkedBy":"직원"}]',
  '[{"id":"n1","content":"내부 상담 메모"}]',
  '{"documentRequests":[{"id":"r1","documentLabel":"급여명세서","requestedBy":"직원A"}]}');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  v := client_case_view('test-req-j');
  IF v ->> 'crmStatus' <> 'document' THEN RAISE EXCEPTION 'FAIL status %', v; END IF;
  IF v -> 'documents' -> 0 ->> 'rejectionReason' <> '발급일 지남' THEN RAISE EXCEPTION 'FAIL documents %', v; END IF;
  IF (v -> 'documents' -> 0) ? 'reviewerNote' OR (v -> 'documents' -> 0) ? 'checkedBy' THEN RAISE EXCEPTION 'FAIL internal fields leaked'; END IF;
  IF (v -> 'documentRequests' -> 0) ? 'requestedBy' THEN RAISE EXCEPTION 'FAIL requester leaked'; END IF;
  IF v ? 'notes' THEN RAISE EXCEPTION 'FAIL notes leaked'; END IF;
  IF (SELECT count(*) FROM crm_clients) <> 0 THEN RAISE EXCEPTION 'FAIL client direct read'; END IF;
  RAISE NOTICE 'PASS client summary without internal fields';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF client_case_view('test-req-j') IS NOT NULL THEN RAISE EXCEPTION 'FAIL other client'; END IF;
  RAISE NOTICE 'PASS other client gets nothing';
END $$;
RESET ROLE;
ROLLBACK;
