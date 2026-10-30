-- 계산 기준표 서버화 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'test_admin@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-c', 'TEST_C');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-c', 'a', true);

-- 관리자 게시
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v calc_standard_sets; BEGIN
  v := admin_publish_calc_standard('{"yearlyPolicies":{},"courtConfigs":{}}', 'TEST 게시');
  IF v.version < 1 OR v.status <> 'published' THEN RAISE EXCEPTION 'FAIL publish'; END IF;
  BEGIN
    UPDATE calc_standard_sets SET settings = '{}' WHERE id = v.id;
    RAISE EXCEPTION 'FAIL published edited';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 관리자 게시·게시본 수정 불가';
END $$;
RESET ROLE;

-- 익명 읽기
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT note FROM current_calc_standard()) <> 'TEST 게시' THEN RAISE EXCEPTION 'FAIL anon read'; END IF;
  BEGIN
    PERFORM admin_publish_calc_standard('{"yearlyPolicies":{},"courtConfigs":{}}', 'x');
    RAISE EXCEPTION 'FAIL anon publish';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 익명: 게시본 읽기만';
END $$;
RESET ROLE;

-- 사무소 대표: 법원 성격만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM admin_publish_calc_standard('{"yearlyPolicies":{},"courtConfigs":{}}', 'x');
    RAISE EXCEPTION 'FAIL lawyer publish';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_office_court_override('test-lawyer-c', '서울회생법원', '{"includeSpouseProperty":false}', 'TEST 재판부 안내');
  IF (SELECT count(*) FROM office_court_overrides) <> 1 THEN RAISE EXCEPTION 'FAIL override read'; END IF;
  BEGIN
    PERFORM set_office_court_override('test-lawyer-c', '서울회생법원', '{"medianIncome":1}', 'TEST');
    RAISE EXCEPTION 'FAIL disallowed field';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM set_office_court_override('test-lawyer-c', '서울회생법원', '{"includeSpouseProperty":true}', '');
    RAISE EXCEPTION 'FAIL no reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM set_office_court_override('test-lawyer-c', '서울회생법원', '{}', 'TEST 되돌림');
  IF (SELECT count(*) FROM office_court_overrides) <> 0 THEN RAISE EXCEPTION 'FAIL reset'; END IF;
  RAISE NOTICE 'PASS 사무소: 법원 성격 칸만·근거 필수·되돌리기, 기준표 게시 불가';
END $$;
RESET ROLE;
ROLLBACK;
