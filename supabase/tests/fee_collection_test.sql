-- FE 수임료 수납 서버화 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_owner_e2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_e3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e1', 'TEST_E1'), ('test-lawyer-e2', 'TEST_E2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-e1', 'e1', true),
  ('00000000-0000-4000-8000-0000000000e2', 'test-lawyer-e2', 'e2', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; r jsonb; s record; n int; BEGIN
  v_case := create_case('test-lawyer-e1', '{"case_type":"rehab","source":"direct","display_name":"TEST_수납"}');
  INSERT INTO t_vars VALUES ('case', v_case.id::text);

  BEGIN
    PERFORM set_fee_agreement(v_case.id, 1000000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":300000},{"label":"1회차","due_on":"2099-01-01","amount_won":600000}]');
    RAISE EXCEPTION 'FAIL total mismatch accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  r := set_fee_agreement(v_case.id, 1000000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":300000},{"label":"1회차","due_on":"2026-02-01","amount_won":350000},{"label":"2회차","due_on":"2099-01-01","amount_won":350000}]', 'contract', 'test-contract');
  IF (r ->> 'version')::int <> 1 THEN RAISE EXCEPTION 'FAIL agreement %', r; END IF;

  PERFORM record_fee_payment(v_case.id, seoul_today(), 400000, 'transfer', 'TEST', NULL);
  SELECT count(*) FILTER (WHERE status = 'paid'), count(*) FILTER (WHERE status = 'overdue') INTO n, n FROM fee_case_status(v_case.id);
  FOR s IN SELECT * FROM fee_case_status(v_case.id) LOOP
    IF s.seq = 1 AND s.status <> 'paid' THEN RAISE EXCEPTION 'FAIL seq1 %', s; END IF;
    IF s.seq = 2 AND (s.status <> 'overdue' OR s.allocated_won <> 100000) THEN RAISE EXCEPTION 'FAIL seq2 %', s; END IF;
    IF s.seq = 3 AND s.status <> 'scheduled' THEN RAISE EXCEPTION 'FAIL seq3 %', s; END IF;
  END LOOP;

  BEGIN
    UPDATE fee_payments SET amount_won = 1 WHERE case_id = v_case.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE EXCEPTION 'FAIL direct update'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM set_fee_agreement(v_case.id, 900000, '[{"label":"잔금","due_on":"2099-01-01","amount_won":900000}]');
    RAISE EXCEPTION 'FAIL change without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := set_fee_agreement(v_case.id, 900000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":300000},{"label":"잔금","due_on":"2099-01-01","amount_won":600000}]', 'manual', NULL, 'TEST 감액 합의');
  IF (r ->> 'version')::int <> 2 THEN RAISE EXCEPTION 'FAIL version 2'; END IF;
  IF (SELECT count(*) FROM fee_schedule_changes WHERE case_id = v_case.id) <> 1 THEN RAISE EXCEPTION 'FAIL change log'; END IF;
  IF (SELECT remaining_won FROM fee_office_overview('test-lawyer-e1') WHERE case_id = v_case.id) <> 500000 THEN RAISE EXCEPTION 'FAIL overview'; END IF;
  RAISE NOTICE 'PASS agreement·payment·allocation·versioning·append-only';
END $$;
RESET ROLE;

-- 다른 사무소: 읽기·기록 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); BEGIN
  IF (SELECT count(*) FROM fee_payments) <> 0 OR (SELECT count(*) FROM fee_installments) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    PERFORM record_fee_payment(v_case, seoul_today(), 1000, 'cash', NULL, NULL);
    RAISE EXCEPTION 'FAIL cross office write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM fee_case_status(v_case);
    RAISE EXCEPTION 'FAIL cross office status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 의뢰인 연결 (시험용 직접 연결)
UPDATE office_clients SET client_user_id = '00000000-0000-4000-8000-0000000000e3'
WHERE id = (SELECT office_client_id FROM cases WHERE id = (SELECT v::uuid FROM t_vars WHERE k = 'case'));

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); r jsonb; BEGIN
  IF (SELECT count(*) FROM fee_installments WHERE case_id = v_case) <> 2 THEN RAISE EXCEPTION 'FAIL client installments %', (SELECT count(*) FROM fee_installments WHERE case_id = v_case); END IF;
  IF (SELECT count(*) FROM fee_case_status(v_case)) <> 2 THEN RAISE EXCEPTION 'FAIL client status'; END IF;
  r := client_report_fee_payment(v_case, seoul_today(), 100000, 'TEST', '입금했어요');
  INSERT INTO t_vars VALUES ('report', r ->> 'report_id');
  BEGIN
    PERFORM record_fee_payment(v_case, seoul_today(), 1000, 'cash', NULL, NULL);
    RAISE EXCEPTION 'FAIL client record';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client read + report only';
END $$;
RESET ROLE;

-- 사무소가 의뢰인 알림을 확정
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid := (SELECT v::uuid FROM t_vars WHERE k = 'case'); v_rep uuid := (SELECT v::uuid FROM t_vars WHERE k = 'report'); v_pay uuid; BEGIN
  v_pay := (record_fee_payment(v_case, seoul_today(), 100000, 'transfer', 'TEST', NULL, v_rep) ->> 'payment_id')::uuid;
  IF (SELECT status FROM fee_client_reports WHERE id = v_rep) <> 'confirmed' THEN RAISE EXCEPTION 'FAIL report confirm'; END IF;
  PERFORM void_fee_payment(v_pay, 'TEST 중복 입력');
  IF (SELECT voided_at FROM fee_payments WHERE id = v_pay) IS NULL THEN RAISE EXCEPTION 'FAIL void'; END IF;
  BEGIN
    PERFORM void_fee_payment(v_pay, 'again');
    RAISE EXCEPTION 'FAIL double void';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS confirm client report + void';
END $$;
RESET ROLE;

ROLLBACK;
