-- DP-0 사건 서류 파일 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c7', 'test_owner_i1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c8', 'test_owner_i2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c9', 'test_client_i3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000ca', 'test_client_i4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-i1', 'TEST_I1'), ('test-lawyer-i2', 'TEST_I2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c7', 'test-lawyer-i1', 'i1', true),
  ('00000000-0000-4000-8000-0000000000c8', 'test-lawyer-i2', 'i2', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-i', '00000000-0000-4000-8000-0000000000c9', 'TEST', 'counseling', 'test-lawyer-i1');

-- 의뢰인: 담당 사무소 client/ 폴더에만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF client_request_office('test-req-i') <> 'test-lawyer-i1' THEN RAISE EXCEPTION 'FAIL client office'; END IF;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-i1/test-req-i/client/f1.pdf');
  INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source)
  VALUES ('test-file-c1', 'test-lawyer-i1', 'test-req-i', 'test-lawyer-i1/test-req-i/client/f1.pdf', 'TEST.pdf', 'client');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-i2/test-req-i/client/f2.pdf');
    RAISE EXCEPTION 'FAIL client upload to other office';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-i1/test-req-i/office/f3.pdf');
    RAISE EXCEPTION 'FAIL client upload to office folder';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM case_files) <> 1 THEN RAISE EXCEPTION 'FAIL client read own'; END IF;
  RAISE NOTICE 'PASS client upload scope';
END $$;
RESET ROLE;

-- 다른 의뢰인: 못 봄·못 올림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000ca","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_files) <> 0 OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 0 THEN RAISE EXCEPTION 'FAIL other client read'; END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-i1/test-req-i/client/f4.pdf');
    RAISE EXCEPTION 'FAIL other client upload';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;

-- 담당 사무소 대표: 보기·올리기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_files) <> 1 THEN RAISE EXCEPTION 'FAIL office read'; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 1 THEN RAISE EXCEPTION 'FAIL office object read'; END IF;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-i1/test-req-i/office/f5.pdf');
  INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source)
  VALUES ('test-file-o1', 'test-lawyer-i1', 'test-req-i', 'test-lawyer-i1/test-req-i/office/f5.pdf', 'TEST2.pdf', 'office');
  UPDATE case_files SET review_status = 'approved' WHERE id = 'test-file-c1';
  BEGIN
    UPDATE case_files SET storage_path = 'x/y/office/z.pdf' WHERE id = 'test-file-c1';
    RAISE EXCEPTION 'FAIL path change';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office read/upload/review';
END $$;
RESET ROLE;

-- 다른 사무소: 0건
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_files) <> 0 OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

ROLLBACK;
