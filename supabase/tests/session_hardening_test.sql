-- 세션 기록 위조 방지·이상 징후 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_client_d1@example.test', 'authenticated', 'authenticated');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.10","cf-ipcountry":"US"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s user_sessions; BEGIN
  INSERT INTO user_sessions (id, user_id, user_name, user_role, device_type, os, browser, ip_address, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-0000000000d1', 'TEST', 'LAWYER', 'desktop', 'Windows', 'Chrome', '1.1.1.1', now() + interval '1 day');
  SELECT * INTO s FROM user_sessions WHERE id = '00000000-0000-4000-8000-00000000d001';
  IF s.user_role <> 'CLIENT' THEN RAISE EXCEPTION 'FAIL role forced %', s.user_role; END IF;
  IF NOT s.is_suspicious OR s.location <> 'US' THEN RAISE EXCEPTION 'FAIL overseas flag %', s; END IF;
  BEGIN
    UPDATE user_sessions SET user_role = 'ADMIN' WHERE id = s.id;
    RAISE EXCEPTION 'FAIL role changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE user_sessions SET is_suspicious = false WHERE id = s.id;
    RAISE EXCEPTION 'FAIL flag cleared';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE user_sessions SET last_active_at = now() + interval '1 day' WHERE id = s.id;
  IF (SELECT last_active_at FROM user_sessions WHERE id = s.id) > now() + interval '1 minute' THEN RAISE EXCEPTION 'FAIL future heartbeat'; END IF;
  UPDATE user_sessions SET status = 'revoked', revoked_by = 'admin', revoke_reason = 'TEST' WHERE id = s.id;
  IF (SELECT revoked_by FROM user_sessions WHERE id = s.id) <> 'user' THEN RAISE EXCEPTION 'FAIL revoked_by spoofed'; END IF;
  BEGIN
    UPDATE user_sessions SET status = 'active', revoked_at = NULL, revoked_by = NULL WHERE id = s.id;
    RAISE EXCEPTION 'FAIL revived';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS session guard + overseas flag';
END $$;
RESET ROLE;
ROLLBACK;
