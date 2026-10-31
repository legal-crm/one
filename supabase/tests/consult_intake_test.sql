-- 의뢰인 정리 자료 v2 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a0', 'test_client_i0@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_i1@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
VALUES ('test-lawyer-i1', 'TEST_I1', 'TEST OFFICE I1', '서울', 'https://example.test/i.webp', '["개인회생"]'::jsonb, repeat('개인회생과 파산 상담을 합니다. ', 4));
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-i1', 'i1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile, intake)
VALUES ('test-req-i1', '00000000-0000-4000-8000-0000000000a0', 'TEST_ALIAS_I', 'requested', '{"debtTotal":5000}', '{"version":2,"answers":{"monthlyIncome":3000000}}');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE consult_requests SET intake = '{"version":1}' WHERE id = 'test-req-i1';
    RAISE EXCEPTION 'FAIL version check';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE consult_requests SET intake = '{"version":2,"note":"900101-1234567"}' WHERE id = 'test-req-i1';
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM client_request_lawyers('test-req-i1', ARRAY['test-lawyer-i1'], 'v1');
  UPDATE consult_requests SET intake = '{"version":2,"answers":{"monthlyIncome":2800000},"changedKeys":["monthlyIncome"]}' WHERE id = 'test-req-i1';
  IF (SELECT intake_updated_at FROM consult_requests WHERE id = 'test-req-i1') IS NULL THEN RAISE EXCEPTION 'FAIL updated_at'; END IF;
  RAISE NOTICE 'PASS client intake guard + update';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT (intake -> 'answers' ->> 'monthlyIncome')::int FROM consult_requests_for_lawyers WHERE id = 'test-req-i1') <> 2800000 THEN RAISE EXCEPTION 'FAIL lawyer view intake'; END IF;
  IF (SELECT count(*) FROM user_notifications WHERE kind = 'client_intake_changed') <> 1 THEN RAISE EXCEPTION 'FAIL lawyer notified'; END IF;
  RAISE NOTICE 'PASS lawyer sees intake + notified';
END $$;
RESET ROLE;
ROLLBACK;
