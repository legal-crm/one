-- 파산 진행 기록·사건 유형 바꾸기·의뢰인 일정 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_h1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_client_h2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'test_other_h3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-h1', 'TEST_H1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-h1', 'h1', true);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c cases; d case_bankruptcy_details; BEGIN
  c := create_case('test-lawyer-h1', '{"case_type":"rehab","source":"direct","display_name":"TEST H"}');
  -- 공통 단계에서는 유형을 바꿀 수 있다
  c := set_case_type(c.id, 'bankruptcy', 'TEST 소득 부족');
  IF c.case_type <> 'bankruptcy' THEN RAISE EXCEPTION 'FAIL set type %', c.case_type; END IF;
  -- 파산 진행 기록
  BEGIN
    PERFORM set_case_bankruptcy_details(c.id, '{"unknown_field":"x"}');
    RAISE EXCEPTION 'FAIL unknown field';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM set_case_bankruptcy_details(c.id, '{"memo":"주민 900101-1234567"}');
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  d := set_case_bankruptcy_details(c.id, '{"insolvent_on":"2025-03-01","deposit_ordered_won":400000,"trustee_name":"TEST 관재인","trustee_phone":"02-000-0000"}');
  IF d.deposit_ordered_won <> 400000 OR d.version <> 2 THEN RAISE EXCEPTION 'FAIL save %', d; END IF;
  BEGIN
    PERFORM set_case_bankruptcy_details(c.id, '{"memo":"x"}', 1);
    RAISE EXCEPTION 'FAIL version conflict not raised';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  -- 접수 → 선고 → 집회
  c := record_case_milestone(c.id, 'case_number_registered', '{"case_number":"2026하단1","court_name":"TEST회생법원","date":"2026-04-01"}');
  BEGIN
    PERFORM set_case_bankruptcy_details(c.id, '{"insolvent_on":"2026-05-01"}');
    RAISE EXCEPTION 'FAIL insolvency after filing';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM set_case_type(c.id, 'rehab', 'TEST');
    RAISE EXCEPTION 'FAIL type change after filing';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  c := record_case_milestone(c.id, 'bankruptcy_declared', '{"date":"2026-06-01"}');
  c := record_case_milestone(c.id, 'creditors_meeting_set', '{"date":"2026-08-10"}');
  d := set_case_bankruptcy_details(c.id, '{"trustee_interview_on":"2026-06-20","discharge_hearing_on":"2026-09-01","deposit_due_on":"2026-05-10"}');
  RAISE NOTICE 'PASS office details + type change';
END $$;
RESET ROLE;

-- 의뢰인 연결 후 일정만 보임
DO $$ DECLARE v_case uuid; BEGIN
  SELECT id INTO v_case FROM cases WHERE office_id = 'test-lawyer-h1' LIMIT 1;
  UPDATE office_clients SET client_user_id = '00000000-0000-4000-8000-0000000000f2'
   WHERE id = (SELECT office_client_id FROM cases WHERE id = v_case);
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; v_case uuid; BEGIN
  SELECT case_id INTO v_case FROM my_cases() LIMIT 1;
  v := client_bankruptcy_schedule(v_case);
  IF v ->> 'declared_on' <> '2026-06-01' OR v ->> 'trustee_interview_on' <> '2026-06-20' OR v ->> 'discharge_hearing_on' <> '2026-09-01' THEN
    RAISE EXCEPTION 'FAIL client schedule %', v;
  END IF;
  IF v ? 'trustee_phone' OR v ? 'trustee_name' OR v ? 'memo' OR v::text LIKE '%400000%' THEN RAISE EXCEPTION 'FAIL private fields leaked %', v; END IF;
  BEGIN
    PERFORM case_bankruptcy_details_get(v_case);
    RAISE EXCEPTION 'FAIL client reads office details';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS client schedule only';
END $$;
RESET ROLE;

-- 다른 사람은 일정도 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case uuid; BEGIN
  RESET ROLE;
  SELECT id INTO v_case FROM cases WHERE office_id = 'test-lawyer-h1' LIMIT 1;
  SET LOCAL ROLE authenticated;
  IF client_bankruptcy_schedule(v_case) IS NOT NULL THEN RAISE EXCEPTION 'FAIL stranger schedule'; END IF;
  BEGIN
    PERFORM set_case_bankruptcy_details(v_case, '{"memo":"x"}');
    RAISE EXCEPTION 'FAIL stranger writes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS stranger blocked';
END $$;
RESET ROLE;
ROLLBACK;
