-- ST-13 사무소 데이터 내보내기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f7', 'test_owner_f7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f8', 'test_staff_f8@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f9', 'test_owner_f9@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f7', 'TEST'), ('test-lawyer-f9', 'TEST9');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f7', 'test-lawyer-f7', 'f7', true),
  ('00000000-0000-4000-8000-0000000000f9', 'test-lawyer-f9', 'f9', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000f801', 'test-lawyer-f7', '00000000-0000-4000-8000-0000000000f8', 'clerk', 'A');
INSERT INTO office_clients (id, office_id, display_name) VALUES ('00000000-0000-4000-8000-00000000f701', 'test-lawyer-f7', 'X');
INSERT INTO cases (office_id, office_client_id, case_type) VALUES ('test-lawyer-f7', '00000000-0000-4000-8000-00000000f701', 'rehab');
INSERT INTO sales_leads (id, office_id) VALUES ('test-lead-f7', 'test-lawyer-f7');
INSERT INTO office_clients (id, office_id, display_name) VALUES ('00000000-0000-4000-8000-00000000f901', 'test-lawyer-f9', 'Y');

-- 대표: 자기 사무소 데이터만, 소금값 없음, 기록 남음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := office_data_export('test-lawyer-f7', true);
  IF r ->> 'format' <> 'mykim-office-backup' THEN RAISE EXCEPTION 'FAIL format'; END IF;
  IF (r -> 'counts' ->> 'cases')::int <> 1 OR (r -> 'counts' ->> 'sales_leads')::int <> 1 OR (r -> 'counts' ->> 'office_clients')::int <> 1 THEN RAISE EXCEPTION 'FAIL counts %', r -> 'counts'; END IF;
  IF (r -> 'tables' -> 'offices' -> 0) ? 'hash_salt' OR (r -> 'tables' -> 'offices' -> 0) ? 'device_hash_salt' THEN RAISE EXCEPTION 'FAIL salt leaked'; END IF;
  IF (r -> 'tables') ? 'office_invites' OR (r -> 'tables') ? 'sales_lead_sources' OR (r -> 'tables') ? 'case_certificate_vaults' THEN RAISE EXCEPTION 'FAIL secret table'; END IF;
  RAISE NOTICE 'PASS owner export';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM office_audit_logs WHERE office_id = 'test-lawyer-f7' AND action = 'office.export') THEN RAISE EXCEPTION 'FAIL audit'; END IF;
  RAISE NOTICE 'PASS export logged';
END $$;

-- 직원·다른 사무소 대표는 못 받음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM office_data_export('test-lawyer-f7', true); RAISE EXCEPTION 'FAIL staff export';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM office_data_export('test-lawyer-f7', true); RAISE EXCEPTION 'FAIL other owner export';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS staff/other office blocked';
END $$;
RESET ROLE;
ROLLBACK;
