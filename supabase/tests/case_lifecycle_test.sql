-- 사건 보관·파기·변제 장부 요약 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_l1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_client_l2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-l1', 'TEST_L1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-l1', 'l1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-l', '00000000-0000-4000-8000-0000000000f2', 'TEST가명L', 'contracted', 'test-lawyer-l1');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c cases; v jsonb; BEGIN
  c := create_case('test-lawyer-l1', '{"case_type":"rehab","source":"consult_request","consult_request_id":"test-req-l"}');
  PERFORM set_case_plan_payments(c.id, '[{"round_no":1,"due_on":"2026-07-25","amount":300000},{"round_no":2,"due_on":"2026-08-25","amount":300000},{"round_no":3,"due_on":"2026-09-25","amount":300000},{"round_no":4,"due_on":"2099-01-25","amount":300000}]');
  PERFORM mark_case_plan_payment((SELECT id FROM case_plan_payments WHERE case_id = c.id AND round_no = 1), 'confirm', '2026-07-24');
  v := case_plan_payment_overview(c.id);
  IF (v ->> 'rounds')::int <> 4 OR (v ->> 'confirmed')::int <> 1 OR (v ->> 'streak')::int <> 2 OR (v ->> 'overdue')::int <> 2 OR (v ->> 'paid_won')::int <> 300000 THEN
    RAISE EXCEPTION 'FAIL overview %', v;
  END IF;
  INSERT INTO debt_certificates (office_id, case_key, creditor_name) VALUES ('test-lawyer-l1', 'test-req-l', 'TEST은행');
  PERFORM record_case_milestone(c.id, 'closed', '{"close_reason":"withdrawn","date":"2020-01-01"}');
  RAISE NOTICE 'PASS plan overview + close';
END $$;
RESET ROLE;

-- 서버 작업: 5년 지난 종결 사건 파기
DO $$ DECLARE c cases; n int; BEGIN
  SELECT * INTO c FROM cases WHERE consult_request_id = 'test-req-l';
  IF c.purge_after <> '2025-01-01' THEN RAISE EXCEPTION 'FAIL purge_after %', c.purge_after; END IF;
  n := purge_expired_cases();
  IF n < 1 THEN RAISE EXCEPTION 'FAIL nothing purged'; END IF;
  SELECT * INTO c FROM cases WHERE id = c.id;
  IF c.purged_at IS NULL OR EXISTS (SELECT 1 FROM debt_certificates WHERE case_key = 'test-req-l') OR EXISTS (SELECT 1 FROM case_events WHERE case_id = c.id) THEN
    RAISE EXCEPTION 'FAIL purge data';
  END IF;
  IF (SELECT display_name FROM office_clients WHERE id = c.office_client_id) <> '파기됨' THEN RAISE EXCEPTION 'FAIL client anonymize'; END IF;
  IF NOT EXISTS (SELECT 1 FROM case_purge_log WHERE case_id = c.id AND reason = 'retention_expired') THEN RAISE EXCEPTION 'FAIL purge log'; END IF;
  BEGIN
    UPDATE cases SET title = 'x' WHERE id = c.id;
    RAISE EXCEPTION 'FAIL purged case updated';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS retention purge';
END $$;
ROLLBACK;
