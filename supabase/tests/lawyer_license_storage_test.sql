-- OP-8 등록증 저장소 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e9', 'test_lic1@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-lic', 'TEST_LIC');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000e9', 'test-lawyer-lic', 'lic', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO lawyer_private_profiles (lawyer_id, data) VALUES ('test-lawyer-lic', '{"licenseImageData":"data:image/png;base64,AAAA","licenseImagePath":"test-lawyer-lic/a.png"}');
  IF (SELECT data ? 'licenseImageData' FROM lawyer_private_profiles WHERE lawyer_id = 'test-lawyer-lic') THEN RAISE EXCEPTION 'FAIL base64 kept'; END IF;
  BEGIN
    UPDATE lawyer_private_profiles SET data = data || '{"licenseImagePath":"other-lawyer/b.png"}' WHERE lawyer_id = 'test-lawyer-lic';
    RAISE EXCEPTION 'FAIL other folder path allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS license guard';
END $$;
RESET ROLE;
INSERT INTO lawyer_review_state (lawyer_id, status, license_checked_at) VALUES ('test-lawyer-lic', 'approved', now() - interval '31 days')
  ON CONFLICT (lawyer_id) DO UPDATE SET license_checked_at = now() - interval '31 days';
DO $$ DECLARE has_vault boolean; BEGIN
  has_vault := EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key');
  PERFORM purge_lawyer_licenses();
  IF has_vault THEN
    IF (SELECT data ? 'licenseImagePath' FROM lawyer_private_profiles WHERE lawyer_id = 'test-lawyer-lic') THEN RAISE EXCEPTION 'FAIL path not purged'; END IF;
  ELSE
    -- 저장소 삭제 요청을 못 보내면 경로를 지우지 않는다 (파일 고아 방지)
    IF NOT (SELECT data ? 'licenseImagePath' FROM lawyer_private_profiles WHERE lawyer_id = 'test-lawyer-lic') THEN RAISE EXCEPTION 'FAIL path dropped without delete request'; END IF;
    UPDATE lawyer_private_profiles SET data = (data - 'licenseImagePath') || '{"x":1}' WHERE lawyer_id = 'test-lawyer-lic';
    UPDATE lawyer_private_profiles SET data = data || jsonb_build_object('licenseImageData', 'data:old') WHERE lawyer_id = 'test-lawyer-lic';
  END IF;
  RAISE NOTICE 'PASS license purge respects vault (%)', has_vault;
END $$;
ROLLBACK;
