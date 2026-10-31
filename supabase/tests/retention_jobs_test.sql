-- 보유 기간 자동 파기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO audit_logs (actor_id, action, created_at) VALUES ('test-ret', 'test_old', now() - interval '3 years'), ('test-ret', 'test_new', now() - interval '1 day');
INSERT INTO admin_actions (action, target_type, created_at) VALUES ('test_old', 'test', now() - interval '4 years'), ('test_new', 'test', now() - interval '2 years');
INSERT INTO client_inquiries (id, data, created_at) VALUES ('test-ret-old', '{}', now() - interval '4 years'), ('test-ret-new', '{}', now() - interval '1 year');
DO $$ BEGIN
  BEGIN
    DELETE FROM audit_logs WHERE actor_id = 'test-ret' AND action = 'test_old';
    RAISE EXCEPTION 'FAIL direct delete allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS direct delete still blocked';
END $$;
DO $$ DECLARE r jsonb; BEGIN
  r := purge_retention_records();
  IF EXISTS (SELECT 1 FROM audit_logs WHERE actor_id = 'test-ret' AND action = 'test_old') THEN RAISE EXCEPTION 'FAIL old audit kept'; END IF;
  IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE actor_id = 'test-ret' AND action = 'test_new') THEN RAISE EXCEPTION 'FAIL new audit deleted'; END IF;
  IF EXISTS (SELECT 1 FROM admin_actions WHERE action = 'test_old') THEN RAISE EXCEPTION 'FAIL old admin action kept'; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE action = 'test_new') THEN RAISE EXCEPTION 'FAIL new admin action deleted'; END IF;
  IF EXISTS (SELECT 1 FROM client_inquiries WHERE id = 'test-ret-old') THEN RAISE EXCEPTION 'FAIL old inquiry kept'; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_inquiries WHERE id = 'test-ret-new') THEN RAISE EXCEPTION 'FAIL new inquiry deleted'; END IF;
  RAISE NOTICE 'PASS retention purge %', r;
END $$;
DO $$ BEGIN
  BEGIN
    DELETE FROM admin_actions WHERE action = 'test_new';
    RAISE EXCEPTION 'FAIL admin delete after purge allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS purge flag reset';
END $$;
ROLLBACK;
