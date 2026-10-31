-- CM-11 의뢰인 다음 일정 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e7', 'test_owner_sc@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e8', 'test_client_sc@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-sc', 'TEST_SC');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000e7', 'test-lawyer-sc', 'sc', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-sc', '00000000-0000-4000-8000-0000000000e8', 'TEST', 'counseling', 'test-lawyer-sc');
INSERT INTO crm_clients (client_id, office_id, crm_status, extension_data)
VALUES ('test-req-sc', 'test-lawyer-sc', 'commenced', jsonb_build_object(
  'courtCase', jsonb_build_object('courtName', '수원회생법원', 'caseNumber', '2026개회1', 'events', jsonb_build_array(
    jsonb_build_object('date', '2000-01-01', 'type', 'hearing', 'title', 'old', 'detail', 'x'),
    jsonb_build_object('date', '2099-01-02', 'type', 'hearing', 'title', 'future hearing', 'detail', 'internal'))),
  'postCommencementPlan', jsonb_build_object('meetingPlan', jsonb_build_object('meetingDate', '2099-01-02 14:00', 'meetingPlace', 'room 3'))));
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  v := client_case_view('test-req-sc') -> 'schedule';
  IF v ->> 'meetingDate' <> '2099-01-02 14:00' OR v ->> 'meetingPlace' <> 'room 3' THEN RAISE EXCEPTION 'FAIL meeting %', v; END IF;
  IF v ->> 'courtName' <> '수원회생법원' THEN RAISE EXCEPTION 'FAIL court %', v; END IF;
  IF jsonb_array_length(v -> 'upcoming') <> 1 OR (v -> 'upcoming' -> 0) ? 'detail' THEN RAISE EXCEPTION 'FAIL upcoming %', v; END IF;
  RAISE NOTICE 'PASS client schedule';
END $$;
RESET ROLE;
ROLLBACK;
