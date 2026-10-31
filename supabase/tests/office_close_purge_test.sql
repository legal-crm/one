-- 사무소 탈퇴 → 30일 뒤 파기 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_oc@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'test_client_oc@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c0', 'test_admin_oc@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-oc', 'TEST_OC');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-oc', 'oc', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-oc', '00000000-0000-4000-8000-0000000000c2', 'TEST가명OC', 'contracted', 'test-lawyer-oc');

-- 대표: 사건 하나 + 사건 메모
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c cases; BEGIN
  IF NOT EXISTS (SELECT 1 FROM offices WHERE id = 'test-lawyer-oc') THEN RAISE EXCEPTION 'FAIL office not auto-created'; END IF;
  c := create_case('test-lawyer-oc', '{"case_type":"rehab","source":"consult_request","consult_request_id":"test-req-oc"}');
  INSERT INTO crm_clients (client_id, office_id, extension_data) VALUES ('test-req-oc', 'test-lawyer-oc', '{"memo":"x"}');
  RAISE NOTICE 'PASS setup';
END $$;
RESET ROLE;
INSERT INTO ad_orders (id, lawyer_id, office_id, product_id, status, monthly_price, total_price, contract_months)
SELECT 'test-ad-oc', 'test-lawyer-oc', 'test-lawyer-oc', id, 'active', 100000, 100000, 1 FROM ad_products LIMIT 1;

-- 관리자: 사유 없음 / 노출 중 광고 → 거절, 광고 정리 뒤 종료
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  BEGIN PERFORM admin_close_office('test-lawyer-oc', ''); RAISE EXCEPTION 'FAIL no reason accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM admin_close_office('test-lawyer-oc', '대표 탈퇴 요청'); RAISE EXCEPTION 'FAIL active ad accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RAISE NOTICE 'PASS close guards';
END $$;
RESET ROLE;
UPDATE ad_orders SET status = 'cancelled' WHERE id = 'test-ad-oc';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := admin_close_office('test-lawyer-oc', '대표 탈퇴 요청');
  IF NOT (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL close %', r; END IF;
  IF (SELECT count(*) FROM admin_closed_offices() WHERE office_id = 'test-lawyer-oc') <> 1 THEN RAISE EXCEPTION 'FAIL closed list'; END IF;
  RAISE NOTICE 'PASS close';
END $$;
RESET ROLE;

-- 종료된 사무소의 대표: 사건·사건 메모 안 보임, 변호사 찾기에서 빠짐
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cases WHERE office_id = 'test-lawyer-oc') THEN RAISE EXCEPTION 'FAIL closed office cases visible'; END IF;
  IF EXISTS (SELECT 1 FROM crm_clients WHERE office_id = 'test-lawyer-oc') THEN RAISE EXCEPTION 'FAIL closed office crm visible'; END IF;
  RAISE NOTICE 'PASS member blocked';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF lawyer_is_public((SELECT l FROM lawyers l WHERE id = 'test-lawyer-oc')) THEN RAISE EXCEPTION 'FAIL closed lawyer public'; END IF;
END $$;

-- 관리자 되돌리기 → 다시 종료
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM admin_reopen_office('test-lawyer-oc', '탈퇴 철회');
  IF (SELECT status FROM offices WHERE id = 'test-lawyer-oc') <> 'active' THEN RAISE EXCEPTION 'FAIL reopen'; END IF;
  PERFORM admin_close_office('test-lawyer-oc', '대표 탈퇴 요청');
  RAISE NOTICE 'PASS reopen';
END $$;
RESET ROLE;

-- 서버 작업: 30일 전엔 그대로, 지나면 1단계, 3일 뒤 2단계
DO $$ DECLARE r jsonb; BEGIN
  r := purge_closed_offices();
  IF (r ->> 'started')::int <> 0 THEN RAISE EXCEPTION 'FAIL purged too early %', r; END IF;
  UPDATE offices SET closed_at = now() - interval '31 days' WHERE id = 'test-lawyer-oc';
  r := purge_closed_offices();
  IF (r ->> 'started')::int <> 1 THEN RAISE EXCEPTION 'FAIL stage1 %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM cases WHERE office_id = 'test-lawyer-oc' AND purged_at IS NOT NULL) THEN RAISE EXCEPTION 'FAIL case not purged'; END IF;
  IF EXISTS (SELECT 1 FROM crm_clients WHERE office_id = 'test-lawyer-oc') THEN RAISE EXCEPTION 'FAIL crm left after stage1'; END IF;
  -- 1단계 뒤에는 되돌릴 수 없음
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
    PERFORM admin_reopen_office('test-lawyer-oc', '탈퇴 철회');
    RAISE EXCEPTION 'FAIL reopen after purge';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  UPDATE offices SET purge_started_at = now() - interval '4 days' WHERE id = 'test-lawyer-oc';
  r := purge_closed_offices();
  IF (r ->> 'deleted')::int <> 1 THEN RAISE EXCEPTION 'FAIL stage2 %', r; END IF;
  IF EXISTS (SELECT 1 FROM offices WHERE id = 'test-lawyer-oc') OR EXISTS (SELECT 1 FROM cases WHERE office_id = 'test-lawyer-oc')
     OR EXISTS (SELECT 1 FROM office_clients WHERE office_id = 'test-lawyer-oc') THEN RAISE EXCEPTION 'FAIL office data left'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ad_orders WHERE id = 'test-ad-oc') THEN RAISE EXCEPTION 'FAIL ad order deleted'; END IF;
  IF (SELECT count(*) FROM office_purge_log WHERE office_id = 'test-lawyer-oc') <> 2 THEN RAISE EXCEPTION 'FAIL purge log'; END IF;
  IF NOT EXISTS (SELECT 1 FROM consult_requests WHERE id = 'test-req-oc') THEN RAISE EXCEPTION 'FAIL client request deleted'; END IF;
  RAISE NOTICE 'PASS purge stages';
END $$;
ROLLBACK;
