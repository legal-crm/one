-- 회생동행·인증서 금고 서버 저장 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_cv1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_client_cv3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f4', 'test_owner_cv4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cv1', 'TEST_CV1'), ('test-lawyer-cv4', 'TEST_CV4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-cv1', 'cv1', true),
  ('00000000-0000-4000-8000-0000000000f4', 'test-lawyer-cv4', 'cv4', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-cv', '00000000-0000-4000-8000-0000000000f3', 'TEST가명', 'requested', 'test-lawyer-cv1');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  -- 회생동행: 본인만, 주민번호 거절
  INSERT INTO client_companion_records (user_id, kind, scope_key, data) VALUES ('00000000-0000-4000-8000-0000000000f3', 'rehab', 'test-req-cv', '{"id":"c1"}');
  UPDATE client_companion_records SET data = '{"id":"c1","n":2}' WHERE kind = 'rehab';
  IF (SELECT version FROM client_companion_records WHERE kind = 'rehab') <> 2 THEN RAISE EXCEPTION 'FAIL version'; END IF;
  BEGIN
    INSERT INTO client_companion_records (user_id, kind, scope_key, data) VALUES ('00000000-0000-4000-8000-0000000000f3', 'bankruptcy', '', '{"rrn":"900101-1234567"}');
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    INSERT INTO client_companion_records (user_id, kind, scope_key, data) VALUES ('00000000-0000-4000-8000-0000000000f1', 'rehab', '', '{}');
    RAISE EXCEPTION 'FAIL write for other user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 금고: 평문 개인키·PIN 없는 금고 거절, 암호문은 받음
  BEGIN
    PERFORM client_save_certificate_vault('test-req-cv', '{"npki":{"keyBase64":"PLAIN"}}');
    RAISE EXCEPTION 'FAIL plaintext key accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM client_save_certificate_vault('test-req-cv', '{"npki":{"encryptedPassword":"x"}}');
    RAISE EXCEPTION 'FAIL unsealed accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  v := client_save_certificate_vault('test-req-cv', '{"id":"vault_1","npki":{"encVersion":"pin-v1","pinSalt":"s","encryptedKey":"k","encryptedPassword":"p","iv":"i","keyIv":"j","issuer":"TEST"},"accessLogs":[{"id":"fake"}]}');
  IF jsonb_array_length(v -> 'accessLogs') <> 1 OR v -> 'accessLogs' -> 0 ->> 'id' = 'fake' THEN RAISE EXCEPTION 'FAIL client logs not server-made %', v; END IF;
  IF client_certificate_vault('test-req-cv') -> 'npki' ->> 'issuer' <> 'TEST' THEN RAISE EXCEPTION 'FAIL client read'; END IF;
  RAISE NOTICE 'PASS companion own-only + vault sealed only';
END $$;
RESET ROLE;

-- 사무소: 보기(기록), 다른 사무소 거절. 금고 열람(vault.view)은 배정된 사건만 → 사건을 먼저 만든다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT (create_case('test-lawyer-cv1', '{"source":"consult_request","consult_request_id":"test-req-cv","case_type":"rehab"}'::jsonb)).id IS NOT NULL AS case_created;
DO $$ DECLARE v jsonb; BEGIN
  IF (SELECT count(*) FROM client_companion_records) <> 0 THEN RAISE EXCEPTION 'FAIL office reads companion'; END IF;
  v := office_certificate_vault('test-lawyer-cv1', 'test-req-cv');
  IF v -> 'npki' ->> 'encryptedKey' <> 'k' THEN RAISE EXCEPTION 'FAIL office read'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_audit_logs WHERE office_id = 'test-lawyer-cv1' AND action = 'cert_vault_view') THEN RAISE EXCEPTION 'FAIL view log'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE kind = 'cert_vault_submitted') THEN RAISE EXCEPTION 'FAIL office notified'; END IF;
  RAISE NOTICE 'PASS office reads with log + notified';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_certificate_vault('test-lawyer-cv4', 'test-req-cv');
    RAISE EXCEPTION 'FAIL other office read';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM shred_certificate_vault('test-req-cv', 'test-lawyer-cv4', NULL);
    RAISE EXCEPTION 'FAIL other office shred';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM case_certificate_vaults;
    RAISE EXCEPTION 'FAIL direct table read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

-- 의뢰인 파기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  v := shred_certificate_vault('test-req-cv', NULL, 'TEST');
  IF v ? 'npki' OR v ->> 'status' <> 'shredded' THEN RAISE EXCEPTION 'FAIL shred %', v; END IF;
  RAISE NOTICE 'PASS client shred';
END $$;
RESET ROLE;
ROLLBACK;
