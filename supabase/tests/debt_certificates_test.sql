-- 부채증명 장부 시험: 권한·가드·의뢰인 진행 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_d1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_client_d2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_owner_d3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-d1', 'TEST_D1'), ('test-lawyer-d3', 'TEST_D3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-d1', 'd1', true),
  ('00000000-0000-4000-8000-0000000000e3', 'test-lawyer-d3', 'd3', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-d', '00000000-0000-4000-8000-0000000000e2', 'TEST가명D', 'contracted', 'test-lawyer-d1');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v uuid; r debt_certificates; BEGIN
  INSERT INTO debt_certificates (office_id, case_key, seq, creditor_name, status, "values")
  VALUES ('test-lawyer-d1', 'test-req-d', 1, 'TEST은행', 'applied', '{"principal":1000}') RETURNING id INTO v;
  IF (SELECT status FROM debt_certificates WHERE id = v) <> 'received' THEN RAISE EXCEPTION 'FAIL insert cannot be verified'; END IF;
  BEGIN
    UPDATE debt_certificates SET status = 'verified' WHERE id = v;
    RAISE EXCEPTION 'FAIL verified without base date';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  UPDATE debt_certificates SET status = 'verified', "values" = '{"principal":1000,"baseDate":"2026-09-30"}' WHERE id = v RETURNING * INTO r;
  IF r.verified_by IS NULL OR r.version <> 2 THEN RAISE EXCEPTION 'FAIL verified stamp %', r; END IF;
  BEGIN
    UPDATE debt_certificates SET status = 'unavailable' WHERE id = v;
    RAISE EXCEPTION 'FAIL unavailable without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    DELETE FROM debt_certificates WHERE id = v;
    IF FOUND THEN RAISE EXCEPTION 'FAIL deleted verified row'; END IF;
  END;
  INSERT INTO debt_certificates (office_id, case_key, seq, creditor_name, status) VALUES ('test-lawyer-d1', 'test-req-d', 2, 'TEST카드', 'requested');
  INSERT INTO debt_agency_orders (office_id, case_key, agency_name, sent_on, certificate_ids, agency_fee) VALUES ('test-lawyer-d1', 'test-req-d', 'TEST대행', '2026-10-01', ARRAY[v], 15000);
  RAISE NOTICE 'PASS guard + agency order';
END $$;
RESET ROLE;

-- 다른 사무소: 못 보고 못 넣음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM debt_certificates) OR EXISTS (SELECT 1 FROM debt_agency_orders) THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    INSERT INTO debt_certificates (office_id, case_key, creditor_name) VALUES ('test-lawyer-d1', 'test-req-d', 'X');
    RAISE EXCEPTION 'FAIL cross office insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 의뢰인: 표 직접 못 보고, 진행만 (금액 기본 끔)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; BEGIN
  IF EXISTS (SELECT 1 FROM debt_certificates) THEN RAISE EXCEPTION 'FAIL client reads table'; END IF;
  p := client_debt_cert_progress('test-req-d');
  IF (p ->> 'total')::int <> 2 OR (p ->> 'received')::int <> 1 OR (p -> 'items' -> 0 ->> 'principal') IS NOT NULL THEN RAISE EXCEPTION 'FAIL client progress %', p; END IF;
  BEGIN
    PERFORM client_debt_cert_progress('other-case');
    RAISE EXCEPTION 'FAIL other case';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client progress only';
END $$;
RESET ROLE;
ROLLBACK;
