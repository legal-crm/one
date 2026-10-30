-- SL-1 영업 DB 서버 저장 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_f1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_staff_f2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_owner_f3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f1', 'TEST_F1'), ('test-lawyer-f3', 'TEST_F3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-f1', 'f1', true),
  ('00000000-0000-4000-8000-0000000000f3', 'test-lawyer-f3', 'f3', true);
-- 상담 직원(consultant): sales.view 기본 'assigned'
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-f1', '00000000-0000-4000-8000-0000000000f2', 'TEST 상담', 'consultant', 'active');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO sales_leads (id, office_id, data) VALUES
    ('test-lead-1', 'test-lawyer-f1', '{"customerName":"TEST1","phone":"010-1111-2222","status":"new"}'),
    ('test-lead-2', 'test-lawyer-f1', '{"customerName":"TEST2","phone":"010-3333-4444","status":"callback"}');
  UPDATE sales_leads SET assignee_user_id = '00000000-0000-4000-8000-0000000000f2' WHERE id = 'test-lead-2';
  IF (SELECT status FROM sales_leads WHERE id = 'test-lead-2') <> 'callback' THEN RAISE EXCEPTION 'FAIL status sync'; END IF;
  IF (SELECT count(*) FROM find_sales_leads_by_phone('test-lawyer-f1', '01011112222')) <> 1 THEN RAISE EXCEPTION 'FAIL phone lookup'; END IF;
  RAISE NOTICE 'PASS owner insert + status/phone sync';
END $$;
RESET ROLE;

-- 상담 직원: 내 담당만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM sales_leads) <> 1 THEN RAISE EXCEPTION 'FAIL staff sees % leads', (SELECT count(*) FROM sales_leads); END IF;
  UPDATE sales_leads SET data = data || '{"status":"in_progress"}' WHERE id = 'test-lead-2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL staff update own'; END IF;
  UPDATE sales_leads SET data = data || '{"status":"rejected"}' WHERE id = 'test-lead-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL staff updated other'; END IF;
  BEGIN
    UPDATE sales_leads SET deleted_at = now() WHERE id = 'test-lead-2';
    RAISE EXCEPTION 'FAIL staff trash';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS staff assigned scope + no trash';
END $$;
RESET ROLE;

-- 다른 사무소: 0건, 등록 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM sales_leads) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    INSERT INTO sales_leads (id, office_id, data) VALUES ('test-lead-x', 'test-lawyer-f1', '{}');
    RAISE EXCEPTION 'FAIL cross office insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 대표: 휴지통 이동 가능, 보관 기간 파기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE sales_leads SET deleted_at = now() - interval '31 days' WHERE id = 'test-lead-1';
RESET ROLE;
DO $$ BEGIN
  PERFORM purge_sales_leads();
  IF EXISTS (SELECT 1 FROM sales_leads WHERE id = 'test-lead-1') THEN RAISE EXCEPTION 'FAIL purge'; END IF;
  IF NOT EXISTS (SELECT 1 FROM sales_leads WHERE id = 'test-lead-2') THEN RAISE EXCEPTION 'FAIL purge too much'; END IF;
  RAISE NOTICE 'PASS trash + purge';
END $$;

ROLLBACK;
