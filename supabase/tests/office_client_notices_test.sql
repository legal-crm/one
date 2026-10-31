-- 사무소 → 의뢰인 앱 안 안내 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_e3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e4', 'test_owner_e4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e1', 'TEST_E1'), ('test-lawyer-e4', 'TEST_E4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-e1', 'e1', true),
  ('00000000-0000-4000-8000-0000000000e4', 'test-lawyer-e4', 'e4', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-e', '00000000-0000-4000-8000-0000000000e3', 'TEST가명', 'requested', 'test-lawyer-e1');

-- 대표: 자기 사무소 사건 의뢰인에게 안내
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := office_notify_case_client('test-lawyer-e1', 'test-req-e', 'office_document', '서류를 받았어요', '보내 주신 서류를 확인하고 있어요.');
  IF NOT (r ->> 'delivered')::boolean THEN RAISE EXCEPTION 'FAIL not delivered'; END IF;
  BEGIN
    PERFORM office_notify_case_client('test-lawyer-e1', 'test-req-e', 'office_notice', '번호 900101-1234567', NULL);
    RAISE EXCEPTION 'FAIL rrn accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM office_notify_case_client('test-lawyer-e1', 'test-req-e', 'spam', '안내', NULL);
    RAISE EXCEPTION 'FAIL bad kind accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS office notice delivered + rrn/kind rejected';
END $$;
RESET ROLE;

-- 다른 사무소: 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_notify_case_client('test-lawyer-e4', 'test-req-e', 'office_notice', '안내', NULL);
    RAISE EXCEPTION 'FAIL other office allowed';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM office_notify_case_client('test-lawyer-e1', 'test-req-e', 'office_notice', '안내', NULL);
    RAISE EXCEPTION 'FAIL foreign office id allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office rejected';
END $$;
RESET ROLE;

-- 의뢰인: 알림 1건, 종류·링크
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM user_notifications WHERE kind = 'office_document' AND link_type = 'mypage_case' AND link_id = 'test-req-e') <> 1 THEN
    RAISE EXCEPTION 'FAIL client notification';
  END IF;
  BEGIN
    PERFORM office_notify_case_client('test-lawyer-e1', 'test-req-e', 'office_notice', '안내', NULL);
    RAISE EXCEPTION 'FAIL client can send';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client received, cannot send';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM office_audit_logs WHERE office_id = 'test-lawyer-e1' AND action = 'client_notice_sent' AND detail ->> 'kind' = 'office_document') THEN
    RAISE EXCEPTION 'FAIL audit log';
  END IF;
  RAISE NOTICE 'PASS audit log';
END $$;

ROLLBACK;
