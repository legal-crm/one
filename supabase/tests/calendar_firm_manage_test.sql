-- RB-4 공용 일정 고치기·지우기 권한 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_cal@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_acct_cal@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_clerk_cal@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cal', 'TEST_CAL');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-cal', 'cal', true);
INSERT INTO office_members (office_id, user_id, display_name, role) VALUES
  ('test-lawyer-cal', '00000000-0000-4000-8000-0000000000f2', 'TEST 회계', 'accounting'),
  ('test-lawyer-cal', '00000000-0000-4000-8000-0000000000f3', 'TEST 사무원', 'clerk');
INSERT INTO calendar_events (id, tenant_id, title, date, assigned_staff_id, visibility) VALUES
  ('test-cal-firm1', 'test-lawyer-cal', 'TEST 공용1', '2026-12-01', 'test-lawyer-cal', 'firm'),
  ('test-cal-firm2', 'test-lawyer-cal', 'TEST 공용2', '2026-12-02', 'test-lawyer-cal', 'firm'),
  ('test-cal-law', 'test-lawyer-cal', 'TEST 변호사', '2026-12-03', 'test-lawyer-cal', 'lawyers');
-- 사건 보기 범위 '전체'(회계 기본값) → 공용 일정 고치기·지우기 가능, 변호사 공유 일정은 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
  UPDATE calendar_events SET title = 'TEST 바꿈' WHERE id = 'test-cal-firm1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL firm update by all-scope member'; END IF;
  DELETE FROM calendar_events WHERE id = 'test-cal-firm2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL firm delete by all-scope member'; END IF;
  DELETE FROM calendar_events WHERE id = 'test-cal-law';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL lawyers event deleted'; END IF;
  RAISE NOTICE 'PASS all-scope member manages firm events';
END $$;
RESET ROLE;
-- 담당 범위 사무원 → 공용 일정 지우기 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
  DELETE FROM calendar_events WHERE id = 'test-cal-firm1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL assigned-scope clerk deleted firm event'; END IF;
  RAISE NOTICE 'PASS assigned-scope clerk cannot delete firm events';
END $$;
RESET ROLE;
ROLLBACK;
