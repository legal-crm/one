-- 통합어드민 운영 서버화 시험: 심사·정지·계정 목록·지표 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000000a0', 'test_admin_a0@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'),
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_a1@example.test', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-4000-8000-0000000000a2', 'test_apply_a2@example.test', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-4000-8000-0000000000a3', 'test_client_a3@example.test', 'authenticated', 'authenticated', '{}');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
VALUES ('test-lawyer-a1', 'TEST_A1', 'TEST 사무소', '서울', 'https://example.test/a.webp', '["개인회생"]'::jsonb, repeat('개인회생과 파산 상담을 합니다. ', 4)),
       ('test-lawyer-a2', 'TEST_A2', NULL, '', '', '[]'::jsonb, '');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-a1', 'test_owner_a1@example.test', true),
  ('00000000-0000-4000-8000-0000000000a2', 'test-lawyer-a2', 'test_apply_a2@example.test', false);
INSERT INTO client_aliases (alias, auth_user_id) VALUES ('TEST가명A3', '00000000-0000-4000-8000-0000000000a3');
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile)
VALUES ('test-req-a', '00000000-0000-4000-8000-0000000000a3', 'TEST가명A3', 'requested', '{"debtTotal":1}');

-- 의뢰인이 a1 에게 요청
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT client_request_lawyers('test-req-a', ARRAY['test-lawyer-a1'], 'v1');
DO $$ BEGIN
  BEGIN
    PERFORM admin_list_accounts();
    RAISE EXCEPTION 'FAIL non-admin lists accounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (my_account_status() ->> 'status') <> 'active' THEN RAISE EXCEPTION 'FAIL my status'; END IF;
  RAISE NOTICE 'PASS non-admin blocked, status active';
END $$;
RESET ROLE;

-- 관리자 (2단계 인증)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a0","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; r jsonb; BEGIN
  o := admin_list_lawyer_applications();
  SELECT e INTO r FROM jsonb_array_elements(o) e WHERE e ->> 'lawyer_id' = 'test-lawyer-a2';
  IF r ->> 'status' <> 'pending' OR NOT (r -> 'profile_missing') ? 'bio' THEN RAISE EXCEPTION 'FAIL application row %', r; END IF;
  BEGIN
    PERFORM admin_review_lawyer('test-lawyer-a2', 'reject', '');
    RAISE EXCEPTION 'FAIL reject without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM admin_review_lawyer('test-lawyer-a2', 'request_info', 'TEST 등록증 사본이 흐려요');
  PERFORM admin_review_lawyer('test-lawyer-a1', 'verify_license', 'TEST 대조');
  o := admin_review_lawyer('test-lawyer-a1', 'suspend', 'TEST 정지 사유');
  IF (o ->> 'closed_requests')::int <> 1 THEN RAISE EXCEPTION 'FAIL suspend closes requests %', o; END IF;
  IF EXISTS (SELECT 1 FROM lawyers WHERE id = 'test-lawyer-a1' AND (data ->> 'approved')::boolean) THEN RAISE EXCEPTION 'FAIL profile still approved'; END IF;
  o := admin_list_accounts('TEST가명A3');
  IF (o ->> 'total')::int <> 1 OR (o -> 'rows' -> 0 ->> 'email') NOT LIKE 'te***@%' OR (o -> 'rows' -> 0 ->> 'kind') <> 'client' THEN RAISE EXCEPTION 'FAIL accounts %', o; END IF;
  PERFORM admin_set_account_status('00000000-0000-4000-8000-0000000000a3', 'suspended', 'TEST 스팸');
  o := admin_platform_metrics(now() - interval '1 day', now() + interval '1 minute');
  IF (o -> 'lawyers' ->> 'suspended')::int < 1 OR (o -> 'accounts' ->> 'suspended')::int < 1 OR (o -> 'seats' ->> 'requested')::int < 1 THEN RAISE EXCEPTION 'FAIL metrics %', o; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(admin_todo_items()) e WHERE e ->> 'key' = 'lawyer_info') THEN RAISE EXCEPTION 'FAIL todo'; END IF;
  IF (SELECT count(*) FROM admin_actions WHERE target_id IN ('test-lawyer-a1', 'test-lawyer-a2', '00000000-0000-4000-8000-0000000000a3')) < 4 THEN RAISE EXCEPTION 'FAIL admin actions'; END IF;
  BEGIN
    UPDATE admin_actions SET reason = 'x';
    RAISE EXCEPTION 'FAIL admin_actions editable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS review, suspend closes seats, accounts masked, metrics, todo, append-only log';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT status FROM consult_request_lawyers WHERE request_id = 'test-req-a' AND lawyer_id = 'test-lawyer-a1') <> 'expired'
     OR NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000a2' AND kind = 'lawyer_review') THEN
    RAISE EXCEPTION 'FAIL suspend side effects';
  END IF;
  RAISE NOTICE 'PASS seat closed + applicant notified';
END $$;

-- 보완 요청 받은 신청자: 사유를 본다 / 정지된 변호사: 승인 변호사로 인정되지 않는다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (my_lawyer_review_state() ->> 'status') <> 'info_requested' OR (my_lawyer_review_state() ->> 'reason') NOT LIKE '%흐려요%' THEN
    RAISE EXCEPTION 'FAIL applicant sees reason';
  END IF;
  RAISE NOTICE 'PASS applicant sees review reason';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF current_approved_lawyer_id() IS NOT NULL THEN RAISE EXCEPTION 'FAIL suspended lawyer still approved'; END IF;
  IF (my_lawyer_review_state() ->> 'status') <> 'suspended' THEN RAISE EXCEPTION 'FAIL suspended state'; END IF;
  RAISE NOTICE 'PASS suspended lawyer loses access';
END $$;
RESET ROLE;

-- 정지된 의뢰인: 자기 상담 요청도 못 보고 요청 함수도 막힌다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM consult_requests WHERE id = 'test-req-a') THEN RAISE EXCEPTION 'FAIL suspended client reads requests'; END IF;
  IF (my_account_status() ->> 'status') <> 'suspended' THEN RAISE EXCEPTION 'FAIL my suspended status'; END IF;
  BEGIN
    PERFORM client_request_lawyers('test-req-a', ARRAY['test-lawyer-a1'], 'v1');
    RAISE EXCEPTION 'FAIL suspended client requests';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS suspended client blocked';
END $$;
RESET ROLE;

DO $$ DECLARE d date; BEGIN
  d := public.snapshot_platform_daily_metrics();
  IF d IS NULL OR NOT EXISTS (SELECT 1 FROM platform_daily_metrics WHERE day = d) THEN RAISE EXCEPTION 'FAIL snapshot'; END IF;
  RAISE NOTICE 'PASS daily snapshot';
END $$;

ROLLBACK;
