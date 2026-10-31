-- 인가 뒤 변동 알리기 시험 (NF-9, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_f1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_client_f2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_client_f3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f1', 'TEST_F1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-f1', 'f1', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 대표: 직접 등록 사건 + 연결 링크
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; tok text; BEGIN
  v_case := create_case('test-lawyer-f1', '{"case_type":"rehab","source":"direct","display_name":"TEST_REPORT"}');
  INSERT INTO t_vars VALUES ('key', 'case-' || v_case.id::text);
  SELECT token INTO tok FROM create_client_link_invite(v_case.office_client_id, 24);
  INSERT INTO t_vars VALUES ('token', tok);
END $$;
RESET ROLE;

-- 의뢰인: 연결 후 변동 알리기, 주민번호·빈 기타는 거절, 처리 대기 5건 한도
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ck text := (SELECT v FROM t_vars WHERE k = 'key'); r case_client_reports; BEGIN
  PERFORM accept_client_link_invite((SELECT v FROM t_vars WHERE k = 'token'));
  r := client_report_case_change(ck, 'moved', 'TEST 새 주소로 이사');
  IF r.office_id <> 'test-lawyer-f1' OR r.status <> 'open' THEN RAISE EXCEPTION 'FAIL report %', r; END IF;
  INSERT INTO t_vars VALUES ('report', r.id::text);
  BEGIN PERFORM client_report_case_change(ck, 'other', ''); RAISE EXCEPTION 'FAIL empty other'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM client_report_case_change(ck, 'income_change', '900101-1234567'); RAISE EXCEPTION 'FAIL rrn'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM client_report_case_change(ck, 'income_change', NULL);
  PERFORM client_report_case_change(ck, 'job_change', NULL);
  PERFORM client_report_case_change(ck, 'family_change', NULL);
  PERFORM client_report_case_change(ck, 'payment_trouble', NULL);
  BEGIN PERFORM client_report_case_change(ck, 'moved', NULL); RAISE EXCEPTION 'FAIL limit'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT count(*) FROM case_client_reports) <> 5 THEN RAISE EXCEPTION 'FAIL client sees own'; END IF;
  BEGIN UPDATE case_client_reports SET status = 'handled'; IF FOUND THEN RAISE EXCEPTION 'FAIL direct update'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS client report rules';
END $$;
RESET ROLE;

-- 다른 의뢰인: 못 보고 못 알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ck text := (SELECT v FROM t_vars WHERE k = 'key'); BEGIN
  IF (SELECT count(*) FROM case_client_reports) <> 0 THEN RAISE EXCEPTION 'FAIL other sees'; END IF;
  BEGIN PERFORM client_report_case_change(ck, 'moved', NULL); RAISE EXCEPTION 'FAIL other report'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS other client blocked';
END $$;
RESET ROLE;

-- 대표: 보이고, 처리하면 의뢰인 알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r case_client_reports; BEGIN
  IF (SELECT count(*) FROM case_client_reports) <> 5 THEN RAISE EXCEPTION 'FAIL office sees'; END IF;
  r := office_handle_case_client_report((SELECT v FROM t_vars WHERE k = 'report')::uuid, 'TEST 주소 변경 신고서를 준비할게요');
  IF r.status <> 'handled' OR r.handled_at IS NULL THEN RAISE EXCEPTION 'FAIL handle'; END IF;
  BEGIN PERFORM office_handle_case_client_report(r.id, NULL); RAISE EXCEPTION 'FAIL handle twice'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RAISE NOTICE 'PASS office handles report';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f2' AND kind = 'case_report_handled') THEN RAISE EXCEPTION 'FAIL client notified'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000f1' AND kind = 'case_client_report') THEN RAISE EXCEPTION 'FAIL office notified'; END IF;
  RAISE NOTICE 'PASS notifications';
END $$;
ROLLBACK;
