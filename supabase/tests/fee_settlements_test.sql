-- 해지·환불 정산 시험 (FE-10, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b6', 'test_owner_b6@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-b6', 'TEST_B6');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000b6', 'test-lawyer-b6', 'b6', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b6","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; r jsonb; BEGIN
  v_case := create_case('test-lawyer-b6', '{"case_type":"rehab","source":"direct","display_name":"TEST_정산"}');
  PERFORM set_fee_agreement(v_case.id, 1500000, '[{"label":"착수금","due_on":"2026-01-01","amount_won":500000},{"label":"1회차","due_on":"2099-01-01","amount_won":1000000}]');
  PERFORM record_fee_payment(v_case.id, seoul_today(), 500000, 'transfer', 'TEST', NULL);
  BEGIN PERFORM settle_fee_case(v_case.id, '{"reason":"client_withdrew","refund_won":600000,"refund_on":"2026-11-01"}'); RAISE EXCEPTION 'FAIL refund > received';
  EXCEPTION WHEN check_violation THEN NULL; END;
  r := settle_fee_case(v_case.id, '{"reason":"client_withdrew","refund_won":400000,"refund_on":"2026-11-01","expenses":[{"label":"인지대","amount_won":30000},{"label":"송달료","amount_won":70000}],"note":"접수 전 철회"}');
  IF (r ->> 'expense_won')::int <> 100000 OR (r ->> 'received_won')::int <> 500000 THEN RAISE EXCEPTION 'FAIL settle %', r; END IF;
  IF (SELECT count(*) FROM fee_case_status(v_case.id) WHERE status <> 'paid') <> 0 THEN RAISE EXCEPTION 'FAIL remaining installments left'; END IF;
  IF (SELECT count(*) FROM fee_settlements WHERE case_id = v_case.id) <> 1 THEN RAISE EXCEPTION 'FAIL settlement row'; END IF;
  BEGIN INSERT INTO fee_settlements (office_id, case_id, reason, received_won) VALUES ('test-lawyer-b6', v_case.id, 'other', 0); RAISE EXCEPTION 'FAIL direct insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS settle + remaining removed';
END $$;
RESET ROLE;
ROLLBACK;
