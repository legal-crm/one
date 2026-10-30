-- S-1 crm_clients 사무소 RLS 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test_owner_h1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b8', 'test_owner_h2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b9', 'test_staff_h3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000ba', 'test_admin_h@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-h1', 'TEST_H1'), ('test-lawyer-h2', 'TEST_H2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000b7', 'test-lawyer-h1', 'h1', true),
  ('00000000-0000-4000-8000-0000000000b8', 'test-lawyer-h2', 'h2', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-h1', '00000000-0000-4000-8000-0000000000b9', 'TEST 실무', 'consultant', 'active');

-- 대표 h1: 사무소 자동 지정 저장·수정
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  INSERT INTO crm_clients (client_id, crm_status, notes, extension_data) VALUES ('test-req-h1', 'consulting', '[{"id":"n1"}]', '{"caseType":"개인회생"}');
  IF (SELECT office_id FROM crm_clients WHERE client_id = 'test-req-h1') <> 'test-lawyer-h1' THEN RAISE EXCEPTION 'FAIL office auto'; END IF;
  UPDATE crm_clients SET crm_status = 'contracted' WHERE client_id = 'test-req-h1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL owner update'; END IF;
  BEGIN
    UPDATE crm_clients SET office_id = 'test-lawyer-h2' WHERE client_id = 'test-req-h1';
    RAISE EXCEPTION 'FAIL office change allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS owner insert/update + office fixed';
END $$;
RESET ROLE;

-- 다른 사무소 h2: 0건, 쓰기 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM crm_clients) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  UPDATE crm_clients SET crm_status = 'x' WHERE client_id = 'test-req-h1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL cross office update'; END IF;
  BEGIN
    INSERT INTO crm_clients (client_id, office_id) VALUES ('test-req-x', 'test-lawyer-h1');
    RAISE EXCEPTION 'FAIL cross office insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 상담 직원(case.view 담당 범위): 담당 사건이 없으면 0건
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM crm_clients) <> 0 THEN RAISE EXCEPTION 'FAIL staff sees unassigned'; END IF;
  RAISE NOTICE 'PASS staff assigned scope';
END $$;
RESET ROLE;

-- 관리자: 사건 메모 열람 불가 (제로날리지)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000ba","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM crm_clients) <> 0 THEN RAISE EXCEPTION 'FAIL admin reads crm'; END IF;
  RAISE NOTICE 'PASS admin excluded';
END $$;
RESET ROLE;

-- 익명: 0건
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM crm_clients;
    RAISE EXCEPTION 'FAIL anon select allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS anon blocked';
END $$;
RESET ROLE;

ROLLBACK;
