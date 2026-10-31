-- 사무소 시작하기 점검표 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c7', 'test_owner_cc7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c8', 'test_other_cc8@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cc7', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c7', 'test-lawyer-cc7', 'cc7', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := office_setup_checklist('test-lawyer-cc7');
  IF jsonb_array_length(r) <> 7 THEN RAISE EXCEPTION 'FAIL items %', r; END IF;
  IF (SELECT bool_or((x ->> 'done')::boolean) FROM jsonb_array_elements(r) x WHERE x ->> 'key' IN ('deposit_account','seal')) THEN RAISE EXCEPTION 'FAIL done too early'; END IF;
  RAISE NOTICE 'PASS checklist lists 7 items for owner';
END $$;
RESET ROLE;
INSERT INTO fee_office_accounts (office_id, bank_name, account_number, account_holder) VALUES ('test-lawyer-cc7', '은행', '123-456-789', '예금주');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT (SELECT (x ->> 'done')::boolean FROM jsonb_array_elements(office_setup_checklist('test-lawyer-cc7')) x WHERE x ->> 'key' = 'deposit_account') THEN
    RAISE EXCEPTION 'FAIL deposit account done';
  END IF;
  RAISE NOTICE 'PASS server facts mark items done';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_setup_checklist('test-lawyer-cc7');
    RAISE EXCEPTION 'FAIL outsider read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS outsider blocked';
END $$;
RESET ROLE;
ROLLBACK;
