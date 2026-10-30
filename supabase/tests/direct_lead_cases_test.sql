-- 직접 등록·영업 리드 이관 사건 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test_owner_a1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'test_clerk_a2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'test_owner_a3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'test_consult_a4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-a1', 'TEST_A1'), ('test-lawyer-a3', 'TEST_A3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-a1', 'a1', true),
  ('00000000-0000-4000-8000-0000000000a3', 'test-lawyer-a3', 'a3', true);
-- 사무 직원(clerk): sales.convert 기본 none / 상담 직원(consultant): sales.convert all, case.edit assigned
INSERT INTO office_members (office_id, user_id, display_name, role, status) VALUES
  ('test-lawyer-a1', '00000000-0000-4000-8000-0000000000a2', 'TEST 사무', 'clerk', 'active'),
  ('test-lawyer-a1', '00000000-0000-4000-8000-0000000000a4', 'TEST 상담', 'consultant', 'active');
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 대표: 직접 등록 사건 → 'case-<id>' 키로 사건 관리 데이터 저장
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; k text; BEGIN
  v_case := create_case('test-lawyer-a1', '{"case_type":"rehab","source":"direct","display_name":"TEST_DIRECT","phone":"010-5555-6666"}');
  k := 'case-' || v_case.id::text;
  INSERT INTO t_vars VALUES ('direct_key', k);
  IF crm_client_case_id('test-lawyer-a1', k) IS DISTINCT FROM v_case.id THEN RAISE EXCEPTION 'FAIL key resolve'; END IF;
  INSERT INTO crm_clients (client_id, office_id, crm_status, extension_data) VALUES (k, 'test-lawyer-a1', 'consulting', '{"externalProfile":{"income":1}}');
  IF (SELECT count(*) FROM crm_clients WHERE client_id = k) <> 1 THEN RAISE EXCEPTION 'FAIL crm save'; END IF;
  INSERT INTO sales_leads (id, office_id, data) VALUES ('test-lead-a', 'test-lawyer-a1', '{"customerName":"TEST_LEAD","phone":"010-7777-8888","status":"in_progress"}');
  RAISE NOTICE 'PASS direct case key + crm save';
END $$;
RESET ROLE;

-- 사무 직원: 이관 권한 없음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM convert_sales_lead_to_case('test-lead-a', '{}');
    RAISE EXCEPTION 'FAIL clerk converted';
  EXCEPTION WHEN insufficient_privilege OR no_data_found THEN NULL;
  END;
  RAISE NOTICE 'PASS clerk blocked';
END $$;
RESET ROLE;

-- 대표: 리드 배정 → 상담 직원이 이관, 리드는 '이관 완료', 두 번째 이관은 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE sales_leads SET assignee_user_id = '00000000-0000-4000-8000-0000000000a4' WHERE id = 'test-lead-a';
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; c cases; BEGIN
  r := convert_sales_lead_to_case('test-lead-a', '{"case_type":"bankruptcy"}');
  SELECT * INTO c FROM cases WHERE id = (r ->> 'case_id')::uuid;
  IF c.source <> 'sales_lead' OR c.sales_lead_id <> 'test-lead-a' OR c.case_type <> 'bankruptcy' THEN RAISE EXCEPTION 'FAIL case %', c; END IF;
  IF (SELECT status FROM sales_leads WHERE id = 'test-lead-a') <> 'converted' THEN RAISE EXCEPTION 'FAIL lead status'; END IF;
  IF (SELECT data ->> 'convertedClientId' FROM sales_leads WHERE id = 'test-lead-a') <> r ->> 'workspace_key' THEN RAISE EXCEPTION 'FAIL lead key'; END IF;
  -- 이관한 상담 직원이 사건 담당 → 사건 관리 데이터 저장 가능
  INSERT INTO crm_clients (client_id, office_id, crm_status) VALUES (r ->> 'workspace_key', 'test-lawyer-a1', 'consulting');
  BEGIN
    PERFORM convert_sales_lead_to_case('test-lead-a', '{}');
    RAISE EXCEPTION 'FAIL double convert';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- 다른 사건(직접 등록, 담당 아님) 데이터는 못 봄
  IF (SELECT count(*) FROM crm_clients WHERE client_id = (SELECT v FROM t_vars WHERE k = 'direct_key')) <> 0 THEN RAISE EXCEPTION 'FAIL assigned scope'; END IF;
  RAISE NOTICE 'PASS consultant convert + assigned scope + no double';
END $$;
RESET ROLE;

-- 다른 사무소: 키를 알아도 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM crm_clients) <> 0 THEN RAISE EXCEPTION 'FAIL cross office crm'; END IF;
  IF crm_client_case_id('test-lawyer-a3', (SELECT v FROM t_vars WHERE k = 'direct_key')) IS NOT NULL THEN RAISE EXCEPTION 'FAIL cross office key'; END IF;
  BEGIN
    PERFORM convert_sales_lead_to_case('test-lead-a', '{}');
    RAISE EXCEPTION 'FAIL cross office convert';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

ROLLBACK;
