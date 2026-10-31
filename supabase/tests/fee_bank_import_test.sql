-- 거래내역 파일 대조 시험 (FE-9, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b4', 'test_owner_b4@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b5', 'test_owner_b5@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-b4', 'TEST_B4'), ('test-lawyer-b5', 'TEST_B5');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b4', 'test-lawyer-b4', 'b4', true),
  ('00000000-0000-4000-8000-0000000000b5', 'test-lawyer-b5', 'b5', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; r jsonb; h text := repeat('a', 64); BEGIN
  v_case := create_case('test-lawyer-b4', '{"case_type":"rehab","source":"direct","display_name":"TEST_대조"}');
  INSERT INTO t_vars VALUES ('case', v_case.id::text);
  PERFORM set_fee_agreement(v_case.id, 600000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":300000},{"label":"1회차","due_on":"2099-01-01","amount_won":300000}]');
  r := record_fee_bank_import(v_case.id, seoul_today(), 300000, 'TEST입금자', h);
  IF NOT (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL import %', r; END IF;
  r := record_fee_bank_import(v_case.id, seoul_today(), 300000, 'TEST입금자', h);
  IF NOT (r ->> 'duplicate')::boolean THEN RAISE EXCEPTION 'FAIL duplicate accepted %', r; END IF;
  IF NOT (h = ANY (fee_bank_tx_seen('test-lawyer-b4', ARRAY[h, repeat('b', 64)]))) THEN RAISE EXCEPTION 'FAIL seen'; END IF;
  IF (SELECT source FROM fee_payments WHERE case_id = v_case.id) <> 'bank_import' THEN RAISE EXCEPTION 'FAIL source'; END IF;
  RAISE NOTICE 'PASS import once + seen';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); BEGIN
  BEGIN PERFORM record_fee_bank_import(v_case, seoul_today(), 1000, 'X', repeat('c', 64)); RAISE EXCEPTION 'FAIL cross office import';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM fee_bank_tx_seen('test-lawyer-b4', ARRAY[repeat('a', 64)]); RAISE EXCEPTION 'FAIL cross office seen';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;
ROLLBACK;
