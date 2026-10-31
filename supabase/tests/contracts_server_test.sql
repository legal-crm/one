-- 전자계약 서버 저장·의뢰인 조회·계약 → 수임료 약정 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test_owner_cb1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'test_client_cb3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b4', 'test_client_cb4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cb1', 'TEST_CB1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test-lawyer-cb1', 'cb1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id, proposals)
VALUES ('test-req-cb', '00000000-0000-4000-8000-0000000000b3', 'TEST가명', 'requested', 'test-lawyer-cb1',
        '[{"id":"p1","lawyerId":"test-lawyer-cb1","lawyerName":"TEST변호사","firmName":"TEST사무소","fee":300}]'::jsonb);

-- 의뢰인: 제안서로 계약 시작 (금액·변호사는 서버가 채움, 서명 칸은 비움), 다시 부르면 같은 계약
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; r2 jsonb; BEGIN
  r := client_create_contract_from_proposal('test-req-cb', 'p1', 'electronic',
    '[{"id":"d1","type":"main_contract","title":"t","content":"c","included":true,"clientSignature":"data:x"}]'::jsonb,
    'TEST가명', NULL, 'start');
  IF (r ->> 'total_fee')::numeric <> 300 OR r ->> 'assigned_lawyer_id' <> 'test-lawyer-cb1' OR r ->> 'status' <> 'pending_sign' THEN
    RAISE EXCEPTION 'FAIL contract fields %', r;
  END IF;
  IF (r -> 'documents' -> 0) ? 'clientSignature' THEN RAISE EXCEPTION 'FAIL signature kept'; END IF;
  r2 := client_create_contract_from_proposal('test-req-cb', 'p1', 'electronic', '[{"id":"d1","content":"c"}]'::jsonb, 'x', NULL, 'again');
  IF r2 ->> 'id' <> r ->> 'id' THEN RAISE EXCEPTION 'FAIL not reused'; END IF;
  BEGIN
    PERFORM client_create_contract_from_proposal('test-req-cb', 'nope', 'electronic', '[{"id":"d1"}]'::jsonb, 'x', NULL, 'x');
    RAISE EXCEPTION 'FAIL unknown proposal';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  RAISE NOTICE 'PASS client starts contract from proposal';
END $$;
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM electronic_contracts) <> 1 THEN RAISE EXCEPTION 'FAIL client read'; END IF;
  UPDATE electronic_contracts SET status = 'completed', total_fee = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL client can update contract'; END IF;
  BEGIN
    INSERT INTO electronic_contracts (id, client_id, client_name, lawyer_name, law_firm_name, assigned_lawyer_id, status)
    VALUES ('EC-TEST-X', '00000000-0000-4000-8000-0000000000b3', 'x', 'x', 'x', 'test-lawyer-cb1', 'completed');
    RAISE EXCEPTION 'FAIL client direct insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client reads own contract, cannot write';
END $$;
RESET ROLE;

-- 다른 의뢰인: 못 읽음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM electronic_contracts) <> 0 THEN RAISE EXCEPTION 'FAIL other client reads'; END IF;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;

-- 변호사: 앱 저장 칸(법원 비용 객체·부가세·계좌 등)으로 계약 저장, 의뢰인은 상담 요청 ID 계약도 읽음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO electronic_contracts (id, client_id, client_ref_id, client_name, client_phone, lawyer_name, law_firm_name, assigned_lawyer_id,
  total_fee, court_costs, fee_schedule, status, contract_date, documents, audit_trail, vat_included, fee_account, same_as_fee_account,
  success_fee, case_category, extra)
VALUES ('EC-TEST-L1', 'test-req-cb', '00000000-0000-4000-8000-0000000000b3', 'TEST', '', 'TEST변호사', 'TEST사무소', 'test-lawyer-cb1',
  300, '{"creditorCount":3,"stampFee":30000}'::jsonb,
  '[{"id":"i0","round":0,"amount":100,"dueDate":"2026-12-01","status":"pending","memo":"착수금"},{"id":"i1","round":1,"amount":2000000,"amountUnit":"won","dueDate":"2027-01-10","status":"pending"},{"id":"s","round":2,"amount":50,"itemType":"success_fee","dueDate":"2027-06-01","status":"pending"}]'::jsonb,
  'pending_sign', '2026-10-31', '[]'::jsonb, '[]'::jsonb, false, '{"bankName":"x"}'::jsonb, true, NULL, 'individual_rehab',
  '{"contractMethod":"electronic","clientResidentNumber":"900101-1234567"}'::jsonb);
DO $$ BEGIN
  IF (SELECT extra ? 'clientResidentNumber' FROM electronic_contracts WHERE id = 'EC-TEST-L1') THEN RAISE EXCEPTION 'FAIL rrn stored'; END IF;
  IF (SELECT count(*) FROM electronic_contracts) <> 2 THEN RAISE EXCEPTION 'FAIL office read'; END IF;
  RAISE NOTICE 'PASS lawyer saves app columns, rrn dropped';
END $$;
RESET ROLE;

-- 의뢰인 계약 체결(일정 없음) → 사건 없음, 사건 생성 → 일정 없음 알림
UPDATE electronic_contracts SET status = 'completed' WHERE consult_request_id = 'test-req-cb';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT (create_case('test-lawyer-cb1', '{"source":"consult_request","consult_request_id":"test-req-cb","case_type":"rehab"}'::jsonb)).id IS NOT NULL AS case_created;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM fee_agreements fa JOIN cases c ON c.id = fa.case_id WHERE c.consult_request_id = 'test-req-cb') THEN
    RAISE EXCEPTION 'FAIL agreement from empty schedule';
  END IF;
  RAISE NOTICE 'PASS empty schedule makes no agreement';
END $$;

-- 변호사 계약 체결 → 약정 자동 (착수금 100만 + 200만 = 300만, 성공보수 제외)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
UPDATE electronic_contracts SET status = 'completed' WHERE id = 'EC-TEST-L1';
DO $$ DECLARE a fee_agreements; BEGIN
  SELECT fa.* INTO a FROM fee_agreements fa JOIN cases c ON c.id = fa.case_id WHERE c.consult_request_id = 'test-req-cb' AND fa.is_current;
  IF a.id IS NULL OR a.total_fee_won <> 3000000 OR a.source <> 'contract' OR a.contract_id <> 'EC-TEST-L1' THEN RAISE EXCEPTION 'FAIL agreement %', a; END IF;
  IF (SELECT count(*) FROM fee_installments WHERE agreement_id = a.id) <> 2 THEN RAISE EXCEPTION 'FAIL installments'; END IF;
  IF (SELECT label FROM fee_installments WHERE agreement_id = a.id AND seq = 1) <> '착수금' THEN RAISE EXCEPTION 'FAIL label'; END IF;
  IF (SELECT case_id FROM electronic_contracts WHERE id = 'EC-TEST-L1') IS DISTINCT FROM a.case_id THEN RAISE EXCEPTION 'FAIL case link'; END IF;
  RAISE NOTICE 'PASS completed contract creates fee agreement';
END $$;

-- 사무소 수동 다시 옮기기: 이미 있으면 exists
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; v uuid; BEGIN
  SELECT id INTO v FROM cases WHERE consult_request_id = 'test-req-cb';
  r := create_fee_agreement_from_contract(v);
  IF r ->> 'result' <> 'exists' THEN RAISE EXCEPTION 'FAIL manual %', r; END IF;
  RAISE NOTICE 'PASS manual re-apply keeps agreement';
END $$;
RESET ROLE;
ROLLBACK;
