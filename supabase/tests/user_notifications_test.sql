-- 알림 서버화 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_owner_n1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'test_clerk_n2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d3', 'test_client_n3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d4', 'test_owner_n4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-n1', 'TEST_N1'), ('test-lawyer-n4', 'TEST_N4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test-lawyer-n1', 'n1', true),
  ('00000000-0000-4000-8000-0000000000d4', 'test-lawyer-n4', 'n4', true);
-- 사무 직원(clerk): consult.view 없음
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-n1', '00000000-0000-4000-8000-0000000000d2', 'TEST 사무', 'clerk', 'active');

-- 의뢰인: 상담 요청 → 대표에게만 알림 (사무 직원·다른 사무소 없음)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d3","role":"authenticated"}', true);
-- 변호사 지정은 서버 함수(client_request_lawyers)만 할 수 있어 시험 행은 서버 권한으로 넣는다 (20261031001300)
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-n', '00000000-0000-4000-8000-0000000000d3', 'TEST가명', 'requested', 'test-lawyer-n1');
SET LOCAL ROLE authenticated;
INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message)
VALUES ('test-msg-n1', 'test-req-n', 'client', '00000000-0000-4000-8000-0000000000d3', 'TEST가명', 'hello'),
       ('test-msg-n2', 'test-req-n', 'client', '00000000-0000-4000-8000-0000000000d3', 'TEST가명', 'hello again');
DO $$ BEGIN
  IF (SELECT count(*) FROM user_notifications) <> 0 THEN RAISE EXCEPTION 'FAIL client sees office notifications'; END IF;
  RAISE NOTICE 'PASS client cannot read others';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000d1' AND kind = 'consult_request_new') <> 1 THEN RAISE EXCEPTION 'FAIL owner new request'; END IF;
  IF (SELECT count FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000d1' AND kind = 'client_message') <> 2 THEN RAISE EXCEPTION 'FAIL chat dedupe count'; END IF;
  IF EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id IN ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d4')) THEN RAISE EXCEPTION 'FAIL scope leak'; END IF;
  IF EXISTS (SELECT 1 FROM user_notifications WHERE body ~ 'hello') THEN RAISE EXCEPTION 'FAIL message content in notification'; END IF;
  RAISE NOTICE 'PASS office notifications scoped + dedupe + no content';
END $$;

-- 대표: 읽음 처리만 가능, 답장 → 의뢰인 알림, 제안서 → 의뢰인 알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  UPDATE user_notifications SET read_at = now() WHERE kind = 'client_message';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL mark read'; END IF;
  BEGIN
    UPDATE user_notifications SET title = 'x' WHERE kind = 'consult_request_new';
    RAISE EXCEPTION 'FAIL title change';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO user_notifications (recipient_user_id, audience, kind, title) VALUES ('00000000-0000-4000-8000-0000000000d3', 'client', 'x', 'spam');
    RAISE EXCEPTION 'FAIL direct insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS owner read-only + no direct insert';
END $$;
INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message)
VALUES ('test-msg-n3', 'test-req-n', 'lawyer', 'test-lawyer-n1', 'TEST변호사', 'reply');
RESET ROLE;
-- 변호사 제안서는 앱에서 lawyer_patch(SECURITY DEFINER)로 저장된다 → 같은 방식으로 서버 권한으로 갱신 (로그인 정보는 대표 그대로)
UPDATE consult_requests SET proposals = '[{"id":"p1"}]'::jsonb WHERE id = 'test-req-n';

DO $$ BEGIN
  IF (SELECT count(*) FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000d3' AND kind IN ('lawyer_message', 'proposal_new')) <> 2 THEN RAISE EXCEPTION 'FAIL client notifications'; END IF;
  IF EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000d1' AND kind = 'lawyer_message') THEN RAISE EXCEPTION 'FAIL self notify'; END IF;
  RAISE NOTICE 'PASS client notified (message + proposal), no self notify';
END $$;

ROLLBACK;
