-- 관리자 상담 관제(운영 정보만)·신고함 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_client_f1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f9', 'test_admin_f9@example.test', 'authenticated', 'authenticated');
INSERT INTO consult_requests (id, client_id, client_name, phone, status, title, content, financial_profile)
VALUES ('test-req-f1', '00000000-0000-4000-8000-0000000000f1', 'TEST가명', '010-9999-0000', 'requested', 'TEST 제목', 'TEST 본문 원문', '{"debtTotal":5000}');
INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message)
VALUES ('test-msg-f1', 'test-req-f1', 'client', '00000000-0000-4000-8000-0000000000f1', 'TEST가명', 'TEST 메시지 원문');

-- 관리자: 직접 읽기 0건, 관제는 운영 정보만, 신고 없으면 원문 열람 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  IF EXISTS (SELECT 1 FROM consult_requests WHERE id = 'test-req-f1') THEN RAISE EXCEPTION 'FAIL admin direct read'; END IF;
  o := admin_consult_overview(NULL, 'test-req-f1');
  IF (o ->> 'total')::int <> 1 THEN RAISE EXCEPTION 'FAIL overview total %', o; END IF;
  IF o::text LIKE '%010-9999%' OR o::text LIKE '%TEST 본문%' OR o::text LIKE '%5000%' THEN RAISE EXCEPTION 'FAIL overview leaks %', o; END IF;
  IF (o -> 'rows' -> 0 ->> 'message_count')::int <> 1 THEN RAISE EXCEPTION 'FAIL message count'; END IF;
  BEGIN
    PERFORM admin_open_consult_detail('test-req-f1', 'TEST 확인');
    RAISE EXCEPTION 'FAIL detail without report';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS admin overview only';
END $$;
RESET ROLE;

-- 의뢰인: 신고
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM report_consult_request('test-req-f1', 'spam', 'TEST 이상한 연락');
  IF NOT EXISTS (SELECT 1 FROM consult_reports WHERE consult_request_id = 'test-req-f1') THEN RAISE EXCEPTION 'FAIL report visible to reporter'; END IF;
  BEGIN
    PERFORM admin_consult_overview();
    RAISE EXCEPTION 'FAIL client overview';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client report';
END $$;
RESET ROLE;

-- 관리자: 신고가 있으면 사유를 남기고 본문 열람(연락처·재무 없음), 처리 기록
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE d jsonb; v uuid; BEGIN
  BEGIN
    PERFORM admin_open_consult_detail('test-req-f1', '');
    RAISE EXCEPTION 'FAIL detail without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  d := admin_open_consult_detail('test-req-f1', 'TEST 스팸 신고 검토');
  IF d ->> 'content' <> 'TEST 본문 원문' OR d::text LIKE '%010-9999%' OR d::text LIKE '%5000%' THEN RAISE EXCEPTION 'FAIL detail %', d; END IF;
  SELECT (x ->> 'id')::uuid INTO v FROM jsonb_array_elements(admin_list_consult_reports('open')) x LIMIT 1;
  PERFORM admin_resolve_consult_report(v, 'resolved', 'TEST 숨김 처리');
  RAISE NOTICE 'PASS admin detail with report + resolve';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM admin_actions WHERE target_id = 'test-req-f1') < 2 THEN RAISE EXCEPTION 'FAIL admin actions logged'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f1' AND kind = 'consult_report_done') THEN RAISE EXCEPTION 'FAIL reporter notified'; END IF;
  RAISE NOTICE 'PASS logs + notification';
END $$;
ROLLBACK;
