-- 개인정보 요청·미연결 상담 요청 자동 파기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test_client_b1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b9', 'test_admin_b9@example.test', 'authenticated', 'authenticated');
-- 오래된 미연결 요청 1건(파기 대상), 최근 요청 1건(남김)
INSERT INTO consult_requests (id, client_id, client_name, status, created_at, updated_at) VALUES
  ('test-req-b-old', '00000000-0000-4000-8000-0000000000b1', 'TEST', 'closed', now() - interval '400 days', now() - interval '400 days'),
  ('test-req-b-new', '00000000-0000-4000-8000-0000000000b1', 'TEST', 'requested', now(), now());
INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, created_at)
VALUES ('test-msg-b-old', 'test-req-b-old', 'client', 'x', 'TEST', 'TEST', now() - interval '400 days');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v privacy_requests; BEGIN
  v := submit_privacy_request('deletion', 'TEST 내 상담 기록 삭제');
  IF v.due_on <> (now() AT TIME ZONE 'Asia/Seoul')::date + 10 THEN RAISE EXCEPTION 'FAIL due date'; END IF;
  IF (SELECT count(*) FROM privacy_requests) <> 1 THEN RAISE EXCEPTION 'FAIL own read'; END IF;
  RAISE NOTICE 'PASS client request';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v uuid; BEGIN
  SELECT id INTO v FROM privacy_requests LIMIT 1;
  BEGIN
    PERFORM admin_handle_privacy_request(v, 'done', '');
    RAISE EXCEPTION 'FAIL done without response';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF NOT admin_todo_items()::text LIKE '%privacy_request%' THEN RAISE EXCEPTION 'FAIL todo item'; END IF;
  PERFORM admin_handle_privacy_request(v, 'done', 'TEST 삭제 완료');
  RAISE NOTICE 'PASS admin handle';
END $$;
RESET ROLE;

DO $$ DECLARE n int; BEGIN
  n := purge_stale_consult_requests(100);
  IF EXISTS (SELECT 1 FROM consult_requests WHERE id = 'test-req-b-old') THEN RAISE EXCEPTION 'FAIL old not purged'; END IF;
  IF NOT EXISTS (SELECT 1 FROM consult_requests WHERE id = 'test-req-b-new') THEN RAISE EXCEPTION 'FAIL new purged'; END IF;
  IF NOT EXISTS (SELECT 1 FROM privacy_purge_log WHERE kind = 'stale_consult_request') THEN RAISE EXCEPTION 'FAIL purge log'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000b1' AND kind = 'privacy_request_done') THEN RAISE EXCEPTION 'FAIL notified'; END IF;
  RAISE NOTICE 'PASS purge + notify';
END $$;
ROLLBACK;
