-- 알림 2단계(바깥 채널) 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_o1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_o3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e4', 'test_owner_o4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-o1', 'TEST_O1'), ('test-lawyer-o4', 'TEST_O4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-o1', 'o1', true),
  ('00000000-0000-4000-8000-0000000000e4', 'test-lawyer-o4', 'o4', true);

-- 대표: 조용한 시간 끄기(0~0), 팀 방 설정 (토큰 형식 확인)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s record; BEGIN
  PERFORM set_my_notification_prefs('{"email_enabled":true,"quiet_start":0,"quiet_end":0}');
  BEGIN
    PERFORM set_office_team_channel('test-lawyer-o1', '{"telegram_enabled":true,"telegram_chat_id":"-100123456","telegram_token":"bad"}');
    RAISE EXCEPTION 'FAIL bad token';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM set_office_team_channel('test-lawyer-o1', '{"telegram_enabled":true,"telegram_chat_id":"-100123456","telegram_token":"123456789:AAEhBOweik6ad9r_QXMENQjcrGbqCr4K-ra"}');
  SELECT * INTO s FROM office_team_channel_status('test-lawyer-o1');
  IF NOT s.has_token OR s.token_last4 <> 'K-ra' OR s.last_ok_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL status %', s; END IF;
  BEGIN
    PERFORM 1 FROM office_team_channels;
    RAISE EXCEPTION 'FAIL direct read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS prefs + team channel (token hidden)';
END $$;
RESET ROLE;

-- 다른 사무소: 상태 0건, 저장 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM office_team_channel_status('test-lawyer-o1')) <> 0 THEN RAISE EXCEPTION 'FAIL cross read'; END IF;
  BEGIN
    PERFORM set_office_team_channel('test-lawyer-o1', '{"telegram_enabled":false}');
    RAISE EXCEPTION 'FAIL cross write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 의뢰인 상담 요청 2번(같은 일) → 대표 이메일 1건·팀 방 1건만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-o', '00000000-0000-4000-8000-0000000000e3', 'TEST', 'requested', 'test-lawyer-o1');
INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message)
VALUES ('test-msg-o1', 'test-req-o', 'client', 'x', 'TEST', 'a'), ('test-msg-o2', 'test-req-o', 'client', 'x', 'TEST', 'b');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM notification_deliveries WHERE channel = 'email' AND user_id = '00000000-0000-4000-8000-0000000000e1') <> 2 THEN
    RAISE EXCEPTION 'FAIL email queue % (want 2: request + chat bundle)', (SELECT count(*) FROM notification_deliveries WHERE channel = 'email');
  END IF;
  IF (SELECT count(*) FROM notification_deliveries WHERE channel = 'telegram' AND office_id = 'test-lawyer-o1') <> 2 THEN RAISE EXCEPTION 'FAIL telegram queue'; END IF;
  RAISE NOTICE 'PASS queue (one per open notification)';
END $$;

-- 서버 함수: 가져가기 → 이메일 주소·토큰은 여기서만, 끝내기 → 팀 방 연결 확인
SET LOCAL ROLE service_role;
DO $$ DECLARE r record; n int := 0; BEGIN
  FOR r IN SELECT * FROM claim_notification_deliveries(10) LOOP
    n := n + 1;
    IF r.channel = 'email' AND r.email <> 'test_owner_o1@example.test' THEN RAISE EXCEPTION 'FAIL email'; END IF;
    IF r.channel = 'telegram' AND r.telegram_token IS NULL THEN RAISE EXCEPTION 'FAIL token'; END IF;
    PERFORM finish_notification_delivery(r.delivery_id, 'sent', NULL);
  END LOOP;
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL claim count %', n; END IF;
  IF (SELECT last_ok_at FROM office_team_channels WHERE office_id = 'test-lawyer-o1') IS NULL THEN RAISE EXCEPTION 'FAIL last_ok'; END IF;
  RAISE NOTICE 'PASS claim + finish';
END $$;
RESET ROLE;

-- 조용한 시간: 21~8시면 다음 8시로 미룸
DO $$ BEGIN
  IF next_allowed_send_at(21::smallint, 8::smallint, '2026-11-02 23:00:00+09') <> '2026-11-03 08:00:00+09' THEN RAISE EXCEPTION 'FAIL quiet late'; END IF;
  IF next_allowed_send_at(21::smallint, 8::smallint, '2026-11-02 03:00:00+09') <> '2026-11-02 08:00:00+09' THEN RAISE EXCEPTION 'FAIL quiet early'; END IF;
  IF next_allowed_send_at(21::smallint, 8::smallint, '2026-11-02 14:00:00+09') <> '2026-11-02 14:00:00+09' THEN RAISE EXCEPTION 'FAIL daytime'; END IF;
  RAISE NOTICE 'PASS quiet hours';
END $$;

-- 사용자는 대기열·서버 함수를 못 씀
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM claim_notification_deliveries(1);
    RAISE EXCEPTION 'FAIL user claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM notification_deliveries WHERE user_id = auth.uid()) <> 2 THEN RAISE EXCEPTION 'FAIL own delivery read'; END IF;
  RAISE NOTICE 'PASS user limits';
END $$;
RESET ROLE;

ROLLBACK;
