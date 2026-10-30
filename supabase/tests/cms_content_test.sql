-- CT-1 콘텐츠 서버 저장 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'test_lawyer_b1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'test_admin_b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'test_client_b@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-b1', 'TEST_B1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000b1', 'test-lawyer-b1', 'b1', true);

-- 관리자: 게시·초안 등록
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO client_qas (id, data) VALUES ('test-qa-1', '{"id":"test-qa-1","question":"TEST 질문","answer":""}');
  INSERT INTO notices (id, data, status) VALUES ('test-notice-draft', '{"id":"test-notice-draft","title":"TEST"}', 'draft');
  UPDATE client_qas SET data = data || '{"category":"TEST"}' WHERE id = 'test-qa-1';
  IF (SELECT version FROM client_qas WHERE id = 'test-qa-1') <> 2 THEN RAISE EXCEPTION 'FAIL version bump'; END IF;
  RAISE NOTICE 'PASS admin write + version';
END $$;
RESET ROLE;

-- 익명: 게시본만 읽기, 쓰기 불가
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM notices WHERE id = 'test-notice-draft') <> 0 THEN RAISE EXCEPTION 'FAIL anon sees draft'; END IF;
  IF (SELECT count(*) FROM client_qas WHERE id = 'test-qa-1') <> 1 THEN RAISE EXCEPTION 'FAIL anon read published'; END IF;
  BEGIN
    INSERT INTO notices (id, data) VALUES ('test-anon', '{}');
    RAISE EXCEPTION 'FAIL anon insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE client_qas SET data = '{}' WHERE id = 'test-qa-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL anon update'; END IF;
  RAISE NOTICE 'PASS anon published-only read, no write';
END $$;
RESET ROLE;

-- 변호사: 직접 수정 불가, 답변 함수로만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; n int; BEGIN
  UPDATE client_qas SET data = '{}' WHERE id = 'test-qa-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL lawyer direct update'; END IF;

  r := lawyer_answer_client_qa('test-qa-1', '짧음');
  IF (r ->> 'code') <> 'invalid_length' THEN RAISE EXCEPTION 'FAIL length check %', r; END IF;

  r := lawyer_answer_client_qa('test-qa-1', '무조건 면책됩니다. 걱정하지 마시고 상담 받으세요.');
  IF (r ->> 'ok')::boolean IS NOT TRUE OR (r ->> 'held')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL flagged hold %', r; END IF;
  IF (SELECT coalesce(data ->> 'answer', '') FROM client_qas WHERE id = 'test-qa-1') <> '' THEN RAISE EXCEPTION 'FAIL flagged published'; END IF;

  r := lawyer_answer_client_qa('test-qa-1', '소득과 재산 자료를 함께 보고 판단해야 합니다. 상담 때 자료를 준비해 주세요.');
  IF (r ->> 'code') <> 'already_answered' THEN RAISE EXCEPTION 'FAIL duplicate answer %', r; END IF;

  BEGIN
    INSERT INTO lawyer_inquiries (id, data) VALUES ('test-linq-bad', '{"lawyerId":"test-lawyer-b1","replyContent":"x","status":"replied"}');
    RAISE EXCEPTION 'FAIL inquiry with reply';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO lawyer_inquiries (id, data) VALUES ('test-linq-ok', '{"lawyerId":"test-lawyer-b1","title":"TEST","status":"pending"}');
  RAISE NOTICE 'PASS lawyer answer RPC (length, hold, duplicate) + inquiry insert';
END $$;
RESET ROLE;

-- 깨끗한 답변은 바로 게시 (다른 변호사 대신 같은 변호사 새 질문)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
INSERT INTO client_qas (id, data) VALUES ('test-qa-2', '{"id":"test-qa-2","question":"TEST 질문 2","answer":""}');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := lawyer_answer_client_qa('test-qa-2', '소득과 재산 자료를 함께 보고 판단해야 합니다. 상담 때 자료를 준비해 주세요.');
  IF (r ->> 'held')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FAIL clean answer held %', r; END IF;
  IF (SELECT data ->> 'lawyerId' FROM client_qas WHERE id = 'test-qa-2') <> 'test-lawyer-b1' THEN RAISE EXCEPTION 'FAIL clean answer not published'; END IF;
  RAISE NOTICE 'PASS clean answer published';
END $$;
RESET ROLE;

-- 의뢰인: 쿨다운
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF my_consult_cooldown_remaining() <> 0 THEN RAISE EXCEPTION 'FAIL cooldown without requests'; END IF;
  INSERT INTO consult_requests (id, client_id, client_name, status) VALUES ('test-req-cool', '00000000-0000-4000-8000-0000000000b3', 'TEST', 'requested');
  IF my_consult_cooldown_remaining() < 23 * 3600 THEN RAISE EXCEPTION 'FAIL cooldown after request'; END IF;
  RAISE NOTICE 'PASS client cooldown';
END $$;
RESET ROLE;

ROLLBACK;
