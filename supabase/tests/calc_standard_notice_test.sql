-- 계산 기준표 변경 알림 시험 (LS-12, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e5', 'test_owner_e5@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e6', 'test_admin_e6@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e5', 'TEST_E5');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000e5', 'test-lawyer-e5', 'e5', true);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM create_case('test-lawyer-e5', '{"case_type":"rehab","source":"direct","display_name":"TEST_CALC"}');
  PERFORM set_office_court_override('test-lawyer-e5', '서울회생법원', '{"includeSpouseProperty":false}', 'TEST 근거');
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e6","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM admin_publish_calc_standard('{"yearlyPolicies":{},"courtConfigs":{}}', 'TEST 알림 게시');
END $$;
RESET ROLE;

DO $$ DECLARE n record; BEGIN
  SELECT * INTO n FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e5' AND kind = 'calc_standard_changed';
  IF n.id IS NULL THEN RAISE EXCEPTION 'FAIL office not notified'; END IF;
  IF n.body NOT LIKE '%진행 중 사건 1건%' OR n.body NOT LIKE '%법원 실무 칸 1곳%' OR n.link_type <> 'calc_standard' THEN RAISE EXCEPTION 'FAIL body %', n.body; END IF;
  IF EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e6' AND kind = 'calc_standard_changed') THEN RAISE EXCEPTION 'FAIL admin notified'; END IF;
  RAISE NOTICE 'PASS calc standard publish notifies offices with active cases';
END $$;
ROLLBACK;
