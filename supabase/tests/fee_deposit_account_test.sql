-- 수임료 입금 계좌 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_f1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_owner_f2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_client_f3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f1', 'TEST_F1'), ('test-lawyer-f2', 'TEST_F2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-f1', 'f1', true),
  ('00000000-0000-4000-8000-0000000000f2', 'test-lawyer-f2', 'f2', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 대표: 사무소 기본 계좌 → 사건이 기본 계좌를 씀 → 사건 계좌가 우선 → 비우면 다시 기본
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; s record; BEGIN
  v_case := create_case('test-lawyer-f1', '{"case_type":"rehab","source":"direct","display_name":"TEST_ACCT"}');
  INSERT INTO t_vars VALUES ('case', v_case.id::text);
  BEGIN
    PERFORM set_fee_deposit_account('test-lawyer-f1', NULL, 'TESTBANK', 'abc', 'TEST');
    RAISE EXCEPTION 'FAIL bad number accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM set_fee_deposit_account('test-lawyer-f1', NULL, 'TESTBANK', '110-123-456789', NULL);
    RAISE EXCEPTION 'FAIL missing holder accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM set_fee_deposit_account('test-lawyer-f1', NULL, 'TESTBANK', '110-123-456789', 'TEST OFFICE');
  SELECT * INTO s FROM fee_deposit_account(v_case.id);
  IF s.scope <> 'office' OR s.account_number <> '110-123-456789' THEN RAISE EXCEPTION 'FAIL office default %', s; END IF;
  PERFORM set_fee_deposit_account('test-lawyer-f1', v_case.id, 'CASEBANK', '220-000-111', 'TEST CASE');
  SELECT * INTO s FROM fee_deposit_account(v_case.id);
  IF s.scope <> 'case' OR s.bank_name <> 'CASEBANK' THEN RAISE EXCEPTION 'FAIL case override %', s; END IF;
  IF (SELECT count(*) FROM office_audit_logs WHERE action = 'fee.account_set' AND detail ->> 'last4' = '0111') <> 1 THEN RAISE EXCEPTION 'FAIL audit last4'; END IF;
  PERFORM set_fee_deposit_account('test-lawyer-f1', v_case.id, '', '', '');
  SELECT * INTO s FROM fee_deposit_account(v_case.id);
  IF s.scope <> 'office' THEN RAISE EXCEPTION 'FAIL clear case override'; END IF;
  PERFORM set_fee_deposit_account('test-lawyer-f1', v_case.id, 'CASEBANK', '220-000-111', 'TEST CASE');
  RAISE NOTICE 'PASS office default + case override';
END $$;
RESET ROLE;

-- 다른 사무소: 못 읽고 못 바꿈, 표 직접 읽기 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); BEGIN
  IF (SELECT count(*) FROM fee_deposit_account(v_case)) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  IF (SELECT count(*) FROM fee_office_account('test-lawyer-f1')) <> 0 THEN RAISE EXCEPTION 'FAIL cross office default read'; END IF;
  BEGIN
    PERFORM set_fee_deposit_account('test-lawyer-f1', v_case, 'X', '110-1111-2222', 'X');
    RAISE EXCEPTION 'FAIL cross office write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM fee_case_accounts;
    RAISE EXCEPTION 'FAIL direct table read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 의뢰인: 자기 사건 계좌만 읽기, 바꾸기 불가
UPDATE office_clients SET client_user_id = '00000000-0000-4000-8000-0000000000f3'
WHERE id = (SELECT office_client_id FROM cases WHERE id = (SELECT v::uuid FROM t_vars WHERE k = 'case'));
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); s record; BEGIN
  SELECT * INTO s FROM fee_deposit_account(v_case);
  IF s.bank_name IS DISTINCT FROM 'CASEBANK' THEN RAISE EXCEPTION 'FAIL client read %', s; END IF;
  BEGIN
    PERFORM set_fee_deposit_account('test-lawyer-f1', v_case, 'X', '110-1111-2222', 'X');
    RAISE EXCEPTION 'FAIL client write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client read only';
END $$;
RESET ROLE;

ROLLBACK;
