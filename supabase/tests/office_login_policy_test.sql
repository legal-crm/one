-- 사무소 로그인 정책 시험 (A-2, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f7', 'test_owner_f7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f8', 'test_clerk_f8@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f7', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000f7', 'test-lawyer-f7', 'f7', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000f801', 'test-lawyer-f7', '00000000-0000-4000-8000-0000000000f8', 'clerk', 'C');
INSERT INTO office_settings (office_id, section, data) VALUES ('test-lawyer-f7', 'security', '{"block_overseas":true,"new_device_alert":true}')
ON CONFLICT (office_id, section) DO UPDATE SET data = EXCLUDED.data;

-- 해외(US) 요청 헤더로 직원이 로그인 → 종료 상태, 대표 알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f8","role":"authenticated"}', true);
SELECT set_config('request.headers', '{"x-vercel-ip-country":"US"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO user_sessions (user_id, user_name, user_role, device_type, os, browser, ip_address, expires_at) VALUES ('00000000-0000-4000-8000-0000000000f8', 'C', 'STAFF', 'desktop', 'Windows', 'Chrome', '203.0.113.7', now() + interval '1 day');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM user_sessions WHERE user_id = '00000000-0000-4000-8000-0000000000f8' ORDER BY created_at DESC LIMIT 1) <> 'revoked' THEN
    RAISE EXCEPTION 'FAIL overseas not blocked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f7' AND kind = 'login_blocked_overseas') THEN
    RAISE EXCEPTION 'FAIL owner not notified';
  END IF;
  RAISE NOTICE 'PASS overseas blocked';
END $$;

-- 국내(KR) 새 기기 → 세션 유지 + 새 기기 알림
SELECT set_config('request.headers', '{"x-vercel-ip-country":"KR"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO user_sessions (user_id, user_name, user_role, device_type, os, browser, ip_address, expires_at) VALUES ('00000000-0000-4000-8000-0000000000f8', 'C', 'STAFF', 'mobile', 'Android', 'Chrome', '203.0.113.8', now() + interval '1 day');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM user_sessions WHERE user_id = '00000000-0000-4000-8000-0000000000f8' AND os = 'Android') <> 'active' THEN RAISE EXCEPTION 'FAIL KR blocked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f7' AND kind = 'new_device_login') THEN
    RAISE EXCEPTION 'FAIL new device alert';
  END IF;
  RAISE NOTICE 'PASS new device alert';
END $$;
ROLLBACK;
