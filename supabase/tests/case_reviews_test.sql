-- CV-1 사건 검토 기록 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test_owner_cr7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d8', 'test_owner_cr8@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cr7', 'TEST'), ('test-lawyer-cr8', 'TEST8');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test-lawyer-cr7', 'cr7', true),
  ('00000000-0000-4000-8000-0000000000d8', 'test-lawyer-cr8', 'cr8', true);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO case_reviews (office_id, case_key, input, result) VALUES ('test-lawyer-cr7', 'req-test-1', '{"income":3000000}', '{"monthly":500000}');
  BEGIN
    INSERT INTO case_reviews (office_id, case_key, input, result) VALUES ('test-lawyer-cr7', 'req-test-1', '{"memo":"900101-1234567"}', '{}');
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    UPDATE case_reviews SET note = 'x';
    IF FOUND THEN RAISE EXCEPTION 'FAIL update allowed'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM case_reviews) <> 1 THEN RAISE EXCEPTION 'FAIL own read'; END IF;
  RAISE NOTICE 'PASS owner write/read + rrn blocked + append only';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_reviews) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    INSERT INTO case_reviews (office_id, case_key, input, result) VALUES ('test-lawyer-cr7', 'x', '{}', '{}');
    RAISE EXCEPTION 'FAIL cross office write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office isolation';
END $$;
RESET ROLE;
ROLLBACK;
