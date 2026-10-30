-- 사건 서류 휴지통·되돌리기·파기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test_owner_t1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d9', 'test_client_t3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-t1', 'TEST_T1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test-lawyer-t1', 't1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-t', '00000000-0000-4000-8000-0000000000d9', 'TEST', 'counseling', 'test-lawyer-t1');
INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-t1/test-req-t/client/t1.pdf');
INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source)
VALUES ('test-file-t1', 'test-lawyer-t1', 'test-req-t', 'test-lawyer-t1/test-req-t/client/t1.pdf', 'TEST.pdf', 'client');

-- 사무소: 휴지통으로 → 서버가 시각·지운 사람 기록, 파기 칸은 못 바꿈
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE case_files SET deleted_at = '2000-01-01', delete_reason = 'wrong file' WHERE id = 'test-file-t1';
  IF (SELECT deleted_at < now() - interval '1 minute' OR deleted_by IS DISTINCT FROM auth.uid() FROM case_files WHERE id = 'test-file-t1') THEN
    RAISE EXCEPTION 'FAIL trash stamp';
  END IF;
  BEGIN
    UPDATE case_files SET purged_at = now() WHERE id = 'test-file-t1';
    RAISE EXCEPTION 'FAIL purge by client';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office trash';
END $$;
RESET ROLE;

-- 의뢰인: 휴지통 파일은 표·저장소 모두 안 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_files) <> 0 OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 0 THEN
    RAISE EXCEPTION 'FAIL client sees trashed file';
  END IF;
  RAISE NOTICE 'PASS client hidden';
END $$;
RESET ROLE;

-- 사무소: 되돌리기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE case_files SET deleted_at = NULL WHERE id = 'test-file-t1';
  IF (SELECT deleted_at IS NOT NULL OR deleted_by IS NOT NULL OR delete_reason IS NOT NULL FROM case_files WHERE id = 'test-file-t1') THEN
    RAISE EXCEPTION 'FAIL restore';
  END IF;
  UPDATE case_files SET deleted_at = now() WHERE id = 'test-file-t1';
  RAISE NOTICE 'PASS restore';
END $$;
RESET ROLE;

-- 파기: 30일 지난 것만 대상, 파기된 파일은 되돌릴 수 없음
DO $$ BEGIN
  UPDATE case_files SET deleted_at = now() - interval '31 days' WHERE id = 'test-file-t1';
  -- vault 비밀값이 없는 시험 DB에서는 0건 (건너뜀)
  IF public.purge_case_files(10) <> 0 AND NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key') THEN
    RAISE EXCEPTION 'FAIL purge without secret';
  END IF;
  UPDATE case_files SET purged_at = now() WHERE id = 'test-file-t1';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE case_files SET deleted_at = NULL WHERE id = 'test-file-t1';
    RAISE EXCEPTION 'FAIL restore purged';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.purge_case_files(1);
    RAISE EXCEPTION 'FAIL purge callable by user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS purge guard';
END $$;
RESET ROLE;

ROLLBACK;
