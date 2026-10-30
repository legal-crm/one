-- 직접 등록 사건의 의뢰인 연결·서류 제출 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test_owner_b1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'test_client_b2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'test_client_b3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-b1', 'TEST_B1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test-lawyer-b1', 'b1', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 대표: 직접 등록 사건 + 사건 관리 데이터 + 연결 링크
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; ck text; tok text; BEGIN
  v_case := create_case('test-lawyer-b1', '{"case_type":"rehab","source":"direct","display_name":"TEST_LINK"}');
  ck := 'case-' || v_case.id::text;
  INSERT INTO t_vars VALUES ('key', ck), ('client', v_case.office_client_id::text);
  INSERT INTO crm_clients (client_id, office_id, crm_status, documents, extension_data)
  VALUES (ck, 'test-lawyer-b1', 'document', '[{"id":"d1","name":"TEST","reviewerNote":"secret"}]', '{"documentRequests":[{"id":"q1","title":"TEST","requestedBy":"staff"}]}');
  SELECT token INTO tok FROM create_client_link_invite(v_case.office_client_id, 24);
  INSERT INTO t_vars VALUES ('token', tok);
  RAISE NOTICE 'PASS owner direct case + invite';
END $$;
RESET ROLE;

-- 의뢰인: 연결 전에는 아무것도 못 함 → 연결 → 사건 보기·서류 제출·요약
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ck text := (SELECT v FROM t_vars WHERE k = 'key'); o text; j jsonb; m record; BEGIN
  IF client_request_office(ck) IS NOT NULL OR client_case_view(ck) IS NOT NULL THEN RAISE EXCEPTION 'FAIL before link'; END IF;
  PERFORM accept_client_link_invite((SELECT v FROM t_vars WHERE k = 'token'));
  o := client_request_office(ck);
  IF o IS DISTINCT FROM 'test-lawyer-b1' THEN RAISE EXCEPTION 'FAIL office %', o; END IF;
  SELECT * INTO m FROM my_cases() LIMIT 1;
  IF m.workspace_key <> ck OR m.has_consult_request THEN RAISE EXCEPTION 'FAIL my_cases %', m; END IF;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', o || '/' || ck || '/client/c1.pdf');
  INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source)
  VALUES ('test-file-b1', o, ck, o || '/' || ck || '/client/c1.pdf', 'TEST.pdf', 'client');
  IF (SELECT count(*) FROM case_files) <> 1 OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 1 THEN RAISE EXCEPTION 'FAIL client read own'; END IF;
  j := client_case_view(ck);
  IF j IS NULL OR j ->> 'crmStatus' <> 'document' THEN RAISE EXCEPTION 'FAIL view %', j; END IF;
  IF (j -> 'documents' -> 0) ? 'reviewerNote' OR (j -> 'documentRequests' -> 0) ? 'requestedBy' THEN RAISE EXCEPTION 'FAIL view leaks'; END IF;
  RAISE NOTICE 'PASS client link + submit + view';
END $$;
RESET ROLE;

-- 다른 의뢰인: 키를 알아도 못 봄·못 냄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ck text := (SELECT v FROM t_vars WHERE k = 'key'); BEGIN
  IF client_request_office(ck) IS NOT NULL OR client_case_view(ck) IS NOT NULL OR client_owns_case_key(ck) THEN RAISE EXCEPTION 'FAIL other client'; END IF;
  IF (SELECT count(*) FROM case_files) <> 0 OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'case-files') <> 0 THEN RAISE EXCEPTION 'FAIL other client read'; END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('case-files', 'test-lawyer-b1/' || ck || '/client/x.pdf');
    RAISE EXCEPTION 'FAIL other client upload';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;

-- 대표: 의뢰인이 낸 파일이 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM case_files WHERE upload_source = 'client') <> 1 THEN RAISE EXCEPTION 'FAIL office sees client file'; END IF;
  RAISE NOTICE 'PASS office sees client file';
END $$;
RESET ROLE;

ROLLBACK;
