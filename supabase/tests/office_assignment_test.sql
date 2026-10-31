-- 배정 탭 시험 (RB-8, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_lawyer_e2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_clerk_e3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e1', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-e1', 'e1', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000e201', 'test-lawyer-e1', '00000000-0000-4000-8000-0000000000e2', 'lawyer', 'L'),
  ('00000000-0000-4000-8000-00000000e301', 'test-lawyer-e1', '00000000-0000-4000-8000-0000000000e3', 'clerk', 'C');
INSERT INTO office_clients (id, office_id, display_name) VALUES ('00000000-0000-4000-8000-00000000e101', 'test-lawyer-e1', 'X');

-- 1. 기본 규칙: 사건은 자동 배정 안 함, 리드는 업무량 적은 사람
DO $$ DECLARE v_case uuid; v_lead uuid; BEGIN
  INSERT INTO cases (office_id, office_client_id, case_type) VALUES ('test-lawyer-e1', '00000000-0000-4000-8000-00000000e101', 'rehab') RETURNING id INTO v_case;
  IF (SELECT lawyer_member_id FROM cases WHERE id = v_case) IS NOT NULL THEN RAISE EXCEPTION 'FAIL case assigned by default'; END IF;
  INSERT INTO sales_leads (id, office_id) VALUES ('test-lead-e1', 'test-lawyer-e1');
  IF (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-e1') IS NULL THEN RAISE EXCEPTION 'FAIL lead not auto assigned'; END IF;
  INSERT INTO sales_leads (id, office_id) VALUES ('test-lead-e2', 'test-lawyer-e1');
  IF (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-e2') = (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-e1') THEN
    RAISE EXCEPTION 'FAIL least loaded not used';
  END IF;
  RAISE NOTICE 'PASS default rules';
END $$;

-- 2. 규칙 바꾸기: 사건 담당 변호사 = 업무량 적은 변호사, 직원 = 업무량 적은 직원
INSERT INTO office_settings (office_id, section, data) VALUES ('test-lawyer-e1', 'assignment', '{"case_lawyer":"least_loaded","case_staff":"least_loaded","lead":"none"}')
ON CONFLICT (office_id, section) DO UPDATE SET data = EXCLUDED.data;
DO $$ DECLARE v_case uuid; BEGIN
  INSERT INTO cases (office_id, office_client_id, case_type) VALUES ('test-lawyer-e1', '00000000-0000-4000-8000-00000000e101', 'rehab') RETURNING id INTO v_case;
  IF (SELECT role FROM office_members WHERE id = (SELECT lawyer_member_id FROM cases WHERE id = v_case)) NOT IN ('owner', 'lawyer') THEN RAISE EXCEPTION 'FAIL lawyer rule'; END IF;
  IF (SELECT staff_member_id FROM cases WHERE id = v_case) <> '00000000-0000-4000-8000-00000000e301' THEN RAISE EXCEPTION 'FAIL staff rule'; END IF;
  INSERT INTO sales_leads (id, office_id) VALUES ('test-lead-e3', 'test-lawyer-e1');
  IF (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-e3') IS NOT NULL THEN RAISE EXCEPTION 'FAIL lead rule none'; END IF;
  RAISE NOTICE 'PASS custom rules';
END $$;

-- 3. 대표: 현황·일괄 배정·이관
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; n int; r jsonb; v_ids text[]; BEGIN
  o := office_assignment_overview('test-lawyer-e1');
  IF jsonb_array_length(o -> 'unassigned_cases') <> 1 OR jsonb_array_length(o -> 'unassigned_leads') <> 1 THEN RAISE EXCEPTION 'FAIL overview %', o; END IF;
  SELECT array_agg(x ->> 'id') INTO v_ids FROM jsonb_array_elements(o -> 'unassigned_cases') x;
  BEGIN
    PERFORM office_bulk_assign('test-lawyer-e1', 'case_lawyer', v_ids, '00000000-0000-4000-8000-00000000e301');
    RAISE EXCEPTION 'FAIL clerk as lawyer';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  n := office_bulk_assign('test-lawyer-e1', 'case_lawyer', v_ids, '00000000-0000-4000-8000-00000000e201');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL bulk cases %', n; END IF;
  n := office_bulk_assign('test-lawyer-e1', 'lead', ARRAY['test-lead-e3'], '00000000-0000-4000-8000-00000000e301');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL bulk lead %', n; END IF;
  r := office_transfer_work('test-lawyer-e1', '00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-00000000e301', '휴가');
  -- 변호사 자리는 직원에게 못 넘겨 비워지고, 리드는 넘어간다
  IF (r ->> 'cases_lawyer')::int < 1 THEN RAISE EXCEPTION 'FAIL transfer %', r; END IF;
  o := office_assignment_overview('test-lawyer-e1');
  IF jsonb_array_length(o -> 'unassigned_cases') < 1 THEN RAISE EXCEPTION 'FAIL lawyer seat should be empty again'; END IF;
  RAISE NOTICE 'PASS overview + bulk + transfer';
END $$;
RESET ROLE;

-- 4. 직원은 현황을 못 본다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM office_assignment_overview('test-lawyer-e1'); RAISE EXCEPTION 'FAIL clerk sees overview';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- 직원이 옛 사본으로 담당자를 비워 저장해도 담당자는 그대로
  UPDATE sales_leads SET assignee_user_id = NULL WHERE id = 'test-lead-e3';
  RAISE NOTICE 'PASS clerk blocked';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT assignee_user_id FROM sales_leads WHERE id = 'test-lead-e3') IS DISTINCT FROM '00000000-0000-4000-8000-0000000000e3' THEN
    RAISE EXCEPTION 'FAIL clerk unassigned lead';
  END IF;
  RAISE NOTICE 'PASS assignee guard';
END $$;
ROLLBACK;
