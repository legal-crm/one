-- 채권자 일괄 발송 기록 시험 (NF-4, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_dp1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_owner_dp2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-dp1', 'TEST_DP1'), ('test-lawyer-dp2', 'TEST_DP2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-dp1', 'dp1', true),
  ('00000000-0000-4000-8000-0000000000f2', 'test-lawyer-dp2', 'dp2', true);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_case text; v_dc uuid; v_d uuid; c cases;
BEGIN
  c := create_case('test-lawyer-dp1', '{"case_type":"rehab","source":"direct","display_name":"TEST DP"}');
  v_case := 'case-' || c.id::text;
  INSERT INTO debt_certificates (office_id, case_key, creditor_name) VALUES ('test-lawyer-dp1', v_case, 'TEST 은행') RETURNING id INTO v_dc;
  INSERT INTO creditor_dispatches (office_id, case_key, creditor_key, creditor_name, registry_id, doc_kinds, method, recipient, debt_certificate_id)
  VALUES ('test-lawyer-dp1', v_case, 'cr-1', 'TEST 은행', 'kb_bank', ARRAY['appointment_notice', 'debt_cert_request'], 'mail', '서울 테스트 주소', v_dc)
  RETURNING id INTO v_d;
  -- 보낸 날 없이 '보냄' 불가
  BEGIN
    UPDATE creditor_dispatches SET status = 'sent' WHERE id = v_d;
    RAISE EXCEPTION 'FAIL sent without date';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  UPDATE creditor_dispatches SET status = 'sent', sent_on = '2026-11-01', receipt_no = 'R-1' WHERE id = v_d;
  IF (SELECT status FROM debt_certificates WHERE id = v_dc) <> 'requested' THEN RAISE EXCEPTION 'FAIL ledger requested'; END IF;
  -- 보낸 뒤 채권자·문서 종류 고정, 다시 '준비'로 못 돌림
  UPDATE creditor_dispatches SET creditor_name = 'X' WHERE id = v_d;
  IF (SELECT creditor_name FROM creditor_dispatches WHERE id = v_d) <> 'TEST 은행' THEN RAISE EXCEPTION 'FAIL frozen'; END IF;
  BEGIN
    UPDATE creditor_dispatches SET status = 'prepared' WHERE id = v_d;
    RAISE EXCEPTION 'FAIL reopen';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  UPDATE creditor_dispatches SET status = 'replied', replied_on = '2026-11-05' WHERE id = v_d;
  IF (SELECT status FROM debt_certificates WHERE id = v_dc) <> 'received' THEN RAISE EXCEPTION 'FAIL ledger received'; END IF;
  IF (SELECT received_on FROM debt_certificates WHERE id = v_dc) <> '2026-11-05' THEN RAISE EXCEPTION 'FAIL received_on'; END IF;
  -- 보낸 기록은 지울 수 없다
  DELETE FROM creditor_dispatches WHERE id = v_d;
  IF NOT EXISTS (SELECT 1 FROM creditor_dispatches WHERE id = v_d) THEN RAISE EXCEPTION 'FAIL deleted sent'; END IF;
  PERFORM set_config('test.case_key', v_case, true);
  RAISE NOTICE 'PASS dispatch flow + ledger sync';
END $$;
RESET ROLE;

-- 다른 사무소는 읽지도 쓰지도 못한다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM creditor_dispatches) THEN RAISE EXCEPTION 'FAIL other office reads'; END IF;
  BEGIN
    INSERT INTO creditor_dispatches (office_id, case_key, creditor_key, creditor_name, doc_kinds)
    VALUES ('test-lawyer-dp1', current_setting('test.case_key'), 'x', 'x', ARRAY['appointment_notice']);
    RAISE EXCEPTION 'FAIL other office insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;
ROLLBACK;
