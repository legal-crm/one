-- 의뢰인 서류 작성기 바탕 시험: 서명·도장 저장소, 초안(주민번호 거절), 면책신청 요청 알림 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_client_e2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_e3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e1', 'TEST_E1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-e1', 'e1', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 대표: 직접 등록 사건 + 연결 링크
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; tok text; BEGIN
  v_case := create_case('test-lawyer-e1', '{"case_type":"rehab","source":"direct","display_name":"TEST_DIS"}');
  INSERT INTO t_vars VALUES ('key', 'case-' || v_case.id::text);
  SELECT token INTO tok FROM create_client_link_invite(v_case.office_client_id, 24);
  INSERT INTO t_vars VALUES ('token', tok);
END $$;
RESET ROLE;

-- 의뢰인: 서명 올리기·초안 저장·주민번호 거절·면책신청 요청
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ck text := (SELECT v FROM t_vars WHERE k = 'key'); t1 timestamptz; t2 timestamptz; BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('client-assets', '00000000-0000-4000-8000-0000000000e2/signature/s1.png');
  INSERT INTO client_sign_assets (kind, source, storage_path) VALUES ('signature', 'pad', '00000000-0000-4000-8000-0000000000e2/signature/s1.png');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('client-assets', '00000000-0000-4000-8000-0000000000e3/signature/x.png');
    RAISE EXCEPTION 'FAIL upload to other folder';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO client_doc_drafts (doc_key, data) VALUES ('discharge:own', '{"name":"TEST","caseNumber":"2023개회12345"}');
  BEGIN
    UPDATE client_doc_drafts SET data = '{"rrn":"900101-1234567"}' WHERE doc_key = 'discharge:own';
    RAISE EXCEPTION 'FAIL rrn saved';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- 연결 전에는 요청 불가
  BEGIN
    PERFORM client_discharge_event(ck, 'request');
    RAISE EXCEPTION 'FAIL request before link';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM accept_client_link_invite((SELECT v FROM t_vars WHERE k = 'token'));
  t1 := client_discharge_event(ck, 'request');
  t2 := client_discharge_event(ck, 'request');
  IF t1 IS DISTINCT FROM t2 THEN RAISE EXCEPTION 'FAIL dedupe'; END IF;
  PERFORM client_discharge_event(ck, 'self_download');
  IF (SELECT count(*) FROM client_discharge_events) <> 2 THEN RAISE EXCEPTION 'FAIL own events'; END IF;
  RAISE NOTICE 'PASS client assets + drafts + discharge events';
END $$;
RESET ROLE;

-- 다른 의뢰인: 남의 서명·초안·기록 안 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM client_sign_assets) + (SELECT count(*) FROM client_doc_drafts) + (SELECT count(*) FROM client_discharge_events) <> 0
     OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'client-assets') <> 0 THEN
    RAISE EXCEPTION 'FAIL other client sees';
  END IF;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;

-- 대표: 기록과 알림이 보임 (서명·초안은 안 보임)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM client_discharge_events) <> 2 THEN RAISE EXCEPTION 'FAIL office events'; END IF;
  IF (SELECT count(*) FROM user_notifications WHERE kind IN ('discharge_request', 'discharge_self_download')) <> 2 THEN RAISE EXCEPTION 'FAIL office notified'; END IF;
  IF (SELECT count(*) FROM client_sign_assets) + (SELECT count(*) FROM client_doc_drafts) <> 0 THEN RAISE EXCEPTION 'FAIL office sees client assets'; END IF;
  RAISE NOTICE 'PASS office events + notifications';
END $$;
RESET ROLE;

ROLLBACK;
