-- 변호사 찾기 서버 규칙 시험: 3명 자리·거절·기한 지남·공개 조건 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f0', 'test_client_s0@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_s1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_owner_s2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_owner_s3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f4', 'test_owner_s4@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f5', 'test_owner_s5@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f6', 'test_owner_s6@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio, success_rate, total_cases)
SELECT 'test-lawyer-s' || n, 'TEST_S' || n, 'TEST 사무소 ' || n, '서울', 'https://example.test/s.webp', '["개인회생"]'::jsonb,
       repeat('개인회생과 파산 상담을 합니다. ', 4), 99, 500
FROM generate_series(1, 6) n;
UPDATE lawyers SET bio = '짧은 소개' WHERE id = 'test-lawyer-s5';   -- 공개 조건 미충족
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
SELECT ('00000000-0000-4000-8000-0000000000f' || n)::uuid, 'test-lawyer-s' || n, 's' || n, n <> 6   -- s6 은 심사 대기
FROM generate_series(1, 6) n;
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile)
VALUES ('test-req-s1', '00000000-0000-4000-8000-0000000000f0', 'TEST가명_s', 'requested', '{"debtTotal":5000}'),
       ('test-req-s2', '00000000-0000-4000-8000-0000000000f0', 'TEST가명_s', 'requested', '{"debtTotal":5000}'),
       ('test-req-s3', '00000000-0000-4000-8000-0000000000f0', 'TEST가명_s', 'requested', '{}');

DO $$ BEGIN
  IF (SELECT count(*) FROM lawyers WHERE id LIKE 'test-lawyer-s%' AND (success_rate IS NOT NULL OR total_cases IS NOT NULL)) > 0 THEN
    RAISE EXCEPTION 'FAIL performance numbers stored';
  END IF;
  IF add_business_days('2026-10-30 15:00+09', 2) <> '2026-11-04 00:00+09' THEN RAISE EXCEPTION 'FAIL business days weekend %', add_business_days('2026-10-30 15:00+09', 2); END IF;
  IF add_business_days('2026-10-02 10:00+09', 2) <> '2026-10-08 00:00+09' THEN RAISE EXCEPTION 'FAIL business days holiday'; END IF;
  RAISE NOTICE 'PASS performance stripped + business days';
END $$;

-- 익명: 승인 + 공개 조건 충족만
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM lawyers WHERE id LIKE 'test-lawyer-s%') <> 4 THEN RAISE EXCEPTION 'FAIL anon directory %', (SELECT array_agg(id) FROM lawyers WHERE id LIKE 'test-lawyer-s%'); END IF;
  RAISE NOTICE 'PASS anon sees only listed lawyers';
END $$;
RESET ROLE;

-- 의뢰인
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  -- 직접 고치기는 무시된다
  UPDATE consult_requests SET selected_lawyer_ids = '["test-lawyer-s1","test-lawyer-s2","test-lawyer-s3","test-lawyer-s4"]', status = 'contracted', request_type = 'open'
   WHERE id = 'test-req-s1';
  IF (SELECT selected_lawyer_ids FROM consult_requests WHERE id = 'test-req-s1') <> '[]'::jsonb
     OR (SELECT status FROM consult_requests WHERE id = 'test-req-s1') <> 'requested' THEN
    RAISE EXCEPTION 'FAIL client wrote privileged columns';
  END IF;
  BEGIN
    PERFORM client_request_lawyers('test-req-s3', ARRAY['test-lawyer-s1'], 'v1');
    RAISE EXCEPTION 'FAIL request without situation check';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := client_request_lawyers('test-req-s1', ARRAY['test-lawyer-s1', 'test-lawyer-s2', 'test-lawyer-s5', 'test-lawyer-s6'], 'v1');
  IF o -> 'added' <> '["test-lawyer-s1","test-lawyer-s2"]'::jsonb OR o -> 'unavailable' <> '["test-lawyer-s5","test-lawyer-s6"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL first request %', o;
  END IF;
  o := client_request_lawyers('test-req-s2', ARRAY['test-lawyer-s3', 'test-lawyer-s4'], 'v1');
  IF o -> 'added' <> '["test-lawyer-s3"]'::jsonb OR o -> 'overflow' <> '["test-lawyer-s4"]'::jsonb OR (o ->> 'active')::int <> 3 THEN
    RAISE EXCEPTION 'FAIL seat limit across requests %', o;
  END IF;
  IF (my_consult_seats() ->> 'active')::int <> 3 THEN RAISE EXCEPTION 'FAIL my seats'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lawyers WHERE id = 'test-lawyer-s1') THEN RAISE EXCEPTION 'FAIL client cannot read requested lawyer'; END IF;
  RAISE NOTICE 'PASS client: guarded columns, 3 seats across requests, unlisted lawyers refused';
END $$;
RESET ROLE;

-- 변호사 s1: 거절 → 자리 반환, 더 못 봄, 의뢰인 안내(사유 없음)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT my_seat_status FROM consult_requests_for_lawyers WHERE id = 'test-req-s1') <> 'requested'
     OR (SELECT my_respond_by FROM consult_requests_for_lawyers WHERE id = 'test-req-s1') IS NULL THEN
    RAISE EXCEPTION 'FAIL lawyer view seat columns';
  END IF;
  BEGIN
    PERFORM lawyer_decline_consult_request('test-req-s1', 'busy');
    RAISE EXCEPTION 'FAIL bad reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM lawyer_decline_consult_request('test-req-s1', 'too_busy', 'TEST 메모');
  IF EXISTS (SELECT 1 FROM consult_requests_for_lawyers WHERE id = 'test-req-s1') THEN RAISE EXCEPTION 'FAIL declined lawyer still sees request'; END IF;
  BEGIN
    PERFORM lawyer_patch_consult_request('test-req-s1', '{"accept_self":true}');
    RAISE EXCEPTION 'FAIL declined lawyer patches';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS decline closes access';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM consult_messages WHERE consult_request_id = 'test-req-s1' AND target_lawyer_id = 'client-only' AND message LIKE '%맡기 어렵다%')
     OR EXISTS (SELECT 1 FROM consult_messages WHERE consult_request_id = 'test-req-s1' AND message LIKE '%업무%') THEN
    RAISE EXCEPTION 'FAIL client notice (or reason leaked)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f0' AND kind = 'consult_lawyer_declined') THEN
    RAISE EXCEPTION 'FAIL client declined notification';
  END IF;
  RAISE NOTICE 'PASS client told without reason';
END $$;

-- 기한 지남: s2 기한을 지난 것으로 → 서버 작업
UPDATE consult_request_lawyers SET respond_by = now() - interval '1 minute' WHERE request_id = 'test-req-s1' AND lawyer_id = 'test-lawyer-s2';
UPDATE consult_request_lawyers SET respond_by = now() + interval '3 hours' WHERE request_id = 'test-req-s2' AND lawyer_id = 'test-lawyer-s3';
DO $$ DECLARE o jsonb; BEGIN
  o := expire_consult_lawyer_requests();
  IF (o ->> 'expired')::int < 1 OR (o ->> 'reminded')::int < 1 THEN RAISE EXCEPTION 'FAIL expire job %', o; END IF;
  IF (SELECT status FROM consult_request_lawyers WHERE request_id = 'test-req-s1' AND lawyer_id = 'test-lawyer-s2') <> 'expired' THEN RAISE EXCEPTION 'FAIL expired status'; END IF;
  IF (SELECT selected_lawyer_ids FROM consult_requests WHERE id = 'test-req-s1') ? 'test-lawyer-s2' THEN RAISE EXCEPTION 'FAIL expired lawyer kept access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f2' AND kind = 'consult_request_expired') THEN RAISE EXCEPTION 'FAIL office expired notice'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f3' AND kind = 'consult_request_due_soon') THEN RAISE EXCEPTION 'FAIL due soon reminder'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f0' AND kind = 'consult_lawyer_expired') THEN RAISE EXCEPTION 'FAIL client expired notice'; END IF;
  RAISE NOTICE 'PASS expiry returns seat + notices';
END $$;

-- 변호사 s3: 제안서 → 의뢰인 비교·확정, 자리 1 → s1 다시 요청은 안 됨, s4 는 됨
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lawyer_patch_consult_request('test-req-s2', '{"proposal":{"id":"p-s3","lawyerId":"test-lawyer-s3"}}');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  IF (SELECT l ->> 'status' FROM jsonb_array_elements(my_consult_seats() -> 'lawyers') l WHERE l ->> 'lawyer_id' = 'test-lawyer-s3') <> 'proposed' THEN
    RAISE EXCEPTION 'FAIL proposed seat';
  END IF;
  o := client_set_consult_choice('test-req-s2', 'compare', 'test-lawyer-s3');
  IF o ->> 'status' <> 'comparing' OR NOT (o -> 'accepted_lawyer_ids') ? 'test-lawyer-s3' THEN RAISE EXCEPTION 'FAIL compare %', o; END IF;
  o := client_set_consult_choice('test-req-s2', 'confirm', 'test-lawyer-s3');
  IF o ->> 'status' <> 'counseling' OR o ->> 'selected_lawyer_id' <> 'test-lawyer-s3' THEN RAISE EXCEPTION 'FAIL confirm %', o; END IF;
  o := client_request_lawyers('test-req-s1', ARRAY['test-lawyer-s1', 'test-lawyer-s4'], 'v1');
  IF o -> 'already' <> '["test-lawyer-s1"]'::jsonb OR o -> 'added' <> '["test-lawyer-s4"]'::jsonb OR (o ->> 'active')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL re-request %', o;
  END IF;
  o := client_withdraw_consult_lawyer('test-req-s1', 'test-lawyer-s4');
  IF (o ->> 'active')::int <> 1 OR (SELECT status FROM consult_requests WHERE id = 'test-req-s1') <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL withdraw %', o;
  END IF;
  RAISE NOTICE 'PASS proposal → compare → confirm, no re-request, withdraw returns seat';
END $$;
RESET ROLE;

-- s4: 취소된 요청에는 응답 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM consult_requests_for_lawyers WHERE id = 'test-req-s1') THEN RAISE EXCEPTION 'FAIL withdrawn lawyer sees request'; END IF;
  IF EXISTS (SELECT 1 FROM consult_request_lawyers) THEN RAISE EXCEPTION 'FAIL seat table readable'; END IF;
  RAISE NOTICE 'PASS withdrawn lawyer closed + seat table hidden';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS withdrawn lawyer closed + seat table hidden';
END $$;
RESET ROLE;

ROLLBACK;
