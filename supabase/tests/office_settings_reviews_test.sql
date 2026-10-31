-- 사무소 설정·직인·발송 문구 기록·제안서 검토 요청 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a5', 'test_owner_m1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a6', 'test_consult_m2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a7', 'test_other_m3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-m1', 'TEST_M1'), ('test-lawyer-m3', 'TEST_M3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a5', 'test-lawyer-m1', 'm1', true),
  ('00000000-0000-4000-8000-0000000000a7', 'test-lawyer-m3', 'm3', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-m1', '00000000-0000-4000-8000-0000000000a6', 'TEST 상담', 'consultant', 'active');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('office-assets', 'test-lawyer-m1/seal.png', '00000000-0000-4000-8000-0000000000a5');

-- 대표: 설정 저장·버전 충돌·주민번호 거절·직인 등록
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s office_settings; seal office_seals; BEGIN
  s := set_office_settings('test-lawyer-m1', 'profile', '{"firmName":"TEST 법률사무소","phone":"02-000-0000"}');
  IF s.version <> 1 THEN RAISE EXCEPTION 'FAIL first save %', s; END IF;
  s := set_office_settings('test-lawyer-m1', 'profile', '{"firmName":"TEST 법률사무소","phone":"02-111-1111"}', 1);
  IF s.version <> 2 THEN RAISE EXCEPTION 'FAIL second save'; END IF;
  BEGIN
    PERFORM set_office_settings('test-lawyer-m1', 'profile', '{"firmName":"x"}', 1);
    RAISE EXCEPTION 'FAIL version conflict';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM set_office_settings('test-lawyer-m1', 'profile', '{"memo":"900101-1234567"}', 2);
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  seal := register_office_seal('test-lawyer-m1', 'office_seal', 'test-lawyer-m1/seal.png', 'TEST 직인');
  PERFORM log_seal_usage('test-lawyer-m1', seal.id, 'TEST 계약서');
  RAISE NOTICE 'PASS owner settings + seal';
END $$;
RESET ROLE;

-- 상담 직원: 설정 읽기만, 직인 등록 불가, 검토 요청 가능
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a6","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r proposal_reviews; BEGIN
  IF (SELECT data ->> 'phone' FROM office_settings WHERE office_id = 'test-lawyer-m1' AND section = 'profile') <> '02-111-1111' THEN RAISE EXCEPTION 'FAIL staff read'; END IF;
  BEGIN
    PERFORM set_office_settings('test-lawyer-m1', 'profile', '{"firmName":"x"}');
    RAISE EXCEPTION 'FAIL staff edit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM register_office_seal('test-lawyer-m1', 'office_seal', 'test-lawyer-m1/seal.png');
    RAISE EXCEPTION 'FAIL staff office seal';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM request_proposal_review('test-lawyer-m1', 'test-req-m', '{"proposal_data":{"a":1},"reviewer_lawyer_id":"test-lawyer-m3"}');
    RAISE EXCEPTION 'FAIL reviewer outside office';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := request_proposal_review('test-lawyer-m1', 'test-req-m', '{"proposal_data":{"monthly":300000},"reviewer_lawyer_id":"test-lawyer-m1","client_alias":"TEST가명","requested_by_name":"TEST 상담","memo":"확인 부탁"}');
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'FAIL request'; END IF;
  BEGIN
    PERFORM decide_proposal_review(r.id, 'approved');
    RAISE EXCEPTION 'FAIL staff approves';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS staff limits + review request';
END $$;
RESET ROLE;

-- 다른 사무소는 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM office_settings WHERE office_id = 'test-lawyer-m1') OR EXISTS (SELECT 1 FROM proposal_reviews WHERE office_id = 'test-lawyer-m1')
     OR EXISTS (SELECT 1 FROM office_seals WHERE office_id = 'test-lawyer-m1') THEN
    RAISE EXCEPTION 'FAIL other office reads';
  END IF;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

-- 대표: 알림 받고 반려(사유 필수) → 직원 알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r proposal_reviews; v_id uuid; BEGIN
  SELECT id INTO v_id FROM proposal_reviews WHERE office_id = 'test-lawyer-m1' AND status = 'pending';
  BEGIN
    PERFORM decide_proposal_review(v_id, 'rejected');
    RAISE EXCEPTION 'FAIL reject without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := decide_proposal_review(v_id, 'rejected', 'TEST 금액 다시 확인');
  IF r.status <> 'rejected' THEN RAISE EXCEPTION 'FAIL reject'; END IF;
  RAISE NOTICE 'PASS owner reject';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000a5' AND kind = 'proposal_review') THEN RAISE EXCEPTION 'FAIL reviewer notified'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000a6' AND kind = 'proposal_review_rejected') THEN RAISE EXCEPTION 'FAIL requester notified'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_audit_logs WHERE office_id = 'test-lawyer-m1' AND action = 'seal.use') THEN RAISE EXCEPTION 'FAIL seal usage log'; END IF;
  RAISE NOTICE 'PASS notifications + logs';
END $$;
ROLLBACK;
