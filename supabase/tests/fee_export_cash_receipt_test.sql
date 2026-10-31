-- 수납 내보내기·현금영수증 기록 시험 (FE-11·FE-Q6, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test_owner_b7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b8', 'test_other_b8@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-b7', 'TEST_B7'), ('test-lawyer-b8', 'TEST_B8');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test-lawyer-b7', 'b7', true),
  ('00000000-0000-4000-8000-0000000000b8', 'test-lawyer-b8', 'b8', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; v_pay uuid; v_void uuid; r jsonb; n int; BEGIN
  v_case := create_case('test-lawyer-b7', '{"case_type":"rehab","source":"direct","display_name":"TEST_내보내기"}');
  PERFORM set_fee_agreement(v_case.id, 1000000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":1000000}]');
  v_pay := (record_fee_payment(v_case.id, seoul_today(), 300000, 'transfer', 'TEST', NULL) ->> 'payment_id')::uuid;
  v_void := (record_fee_payment(v_case.id, seoul_today(), 100000, 'cash', 'TEST', NULL) ->> 'payment_id')::uuid;
  PERFORM void_fee_payment(v_void, 'TEST 잘못 입력');

  -- 현금영수증: 발급은 승인번호 필수
  BEGIN PERFORM set_fee_payment_cash_receipt(v_pay, 'issued', NULL); RAISE EXCEPTION 'FAIL number required';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  r := set_fee_payment_cash_receipt(v_pay, 'issued', '1234-5678');
  IF (SELECT cash_receipt_no FROM fee_payments WHERE id = v_pay) <> '1234-5678' THEN RAISE EXCEPTION 'FAIL receipt saved'; END IF;
  -- '해당 없음'은 번호를 지움
  PERFORM set_fee_payment_cash_receipt(v_pay, 'not_applicable', '9999');
  IF (SELECT cash_receipt_no FROM fee_payments WHERE id = v_pay) IS NOT NULL THEN RAISE EXCEPTION 'FAIL number cleared'; END IF;
  -- 취소된 기록은 못 고침
  BEGIN PERFORM set_fee_payment_cash_receipt(v_void, 'issued', '12345'); RAISE EXCEPTION 'FAIL voided';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 입금 기록 내보내기: 취소 포함 2줄 + 활동 기록
  SELECT count(*) INTO n FROM fee_office_payments_export('test-lawyer-b7', seoul_today() - 30, seoul_today(), true);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL export rows %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_audit_logs WHERE office_id = 'test-lawyer-b7' AND action = 'fee_export' AND detail ->> 'kind' = 'payments' AND (detail ->> 'count')::int = 2) THEN
    RAISE EXCEPTION 'FAIL export log';
  END IF;
  BEGIN PERFORM * FROM fee_office_payments_export('test-lawyer-b7', seoul_today() - 500, seoul_today()); RAISE EXCEPTION 'FAIL period';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM log_fee_export('test-lawyer-b7', 'summary', 5, false);
  RAISE NOTICE 'PASS cash receipt + payments export';
END $$;

-- 다른 사무소는 내보내기·영수증 기록 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
DO $$ DECLARE v_pay uuid; BEGIN
  BEGIN PERFORM * FROM fee_office_payments_export('test-lawyer-b7', seoul_today() - 30, seoul_today()); RAISE EXCEPTION 'FAIL other office export';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM log_fee_export('test-lawyer-b7', 'summary', 1, false); RAISE EXCEPTION 'FAIL other office log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;
ROLLBACK;
