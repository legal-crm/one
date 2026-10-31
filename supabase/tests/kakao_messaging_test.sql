-- KT-2·KT-4·KT-8 카카오톡 안내 할 일·알림톡 대체·대화 내보내기·PC 묶음 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000ab01', 'test_owner_ab01@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000ab02', 'test_staff_ab02@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000ab03', 'test_other_ab03@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ab01', 'TEST_AB01'), ('test-lawyer-ab03', 'TEST_AB03');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-00000000ab01', 'test-lawyer-ab01', 'ab01', true),
  ('00000000-0000-4000-8000-00000000ab03', 'test-lawyer-ab03', 'ab03', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-ab01', '00000000-0000-4000-8000-00000000ab02', 'TEST staff', 'clerk', 'active');
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated, service_role;

-- 0) 근무 시간 더하기: 금 17:00 + 3시간 → 다음 영업일 11:00 (9~18시)
DO $$ DECLARE v timestamptz; BEGIN
  -- 2026-11-06(금) 17:00 KST
  v := add_business_hours('2026-11-06 17:00:00+09'::timestamptz, 3, 9, 18);
  IF v <> '2026-11-09 11:00:00+09'::timestamptz THEN RAISE EXCEPTION 'FAIL business hours %', v; END IF;
  v := add_business_hours('2026-11-09 07:30:00+09'::timestamptz, 3, 9, 18);
  IF v <> '2026-11-09 12:00:00+09'::timestamptz THEN RAISE EXCEPTION 'FAIL before open %', v; END IF;
  RAISE NOTICE 'PASS add_business_hours';
END $$;

-- 1) 대표: 사건·안내 할 일·카톡 이름·복사해서 보냄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab01","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c1 cases; c2 cases; k1 text; k2 text; r jsonb; r2 jsonb; n int; BEGIN
  c1 := create_case('test-lawyer-ab01', '{"case_type":"rehab","source":"direct","display_name":"TEST_KT1","phone":"010-2222-3333"}');
  c2 := create_case('test-lawyer-ab01', '{"case_type":"rehab","source":"direct","display_name":"TEST_KT2","phone":"010-2222-4444"}');
  k1 := 'case-' || c1.id::text; k2 := 'case-' || c2.id::text;
  INSERT INTO t_vars VALUES ('k1', k1), ('k2', k2);
  r := create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', k1, 'milestone', 'document_request', 'title', 'TEST 서류 요청',
        'body', 'TEST 서류를 보내 주세요', 'phone', '010-2222-3333', 'alimtok_text', 'TEST 알림톡 문구', 'receiver_name', 'TEST'));
  IF (r ->> 'fallback')::boolean IS NOT TRUE OR (r ->> 'due_at')::timestamptz <= now() THEN RAISE EXCEPTION 'FAIL create task %', r; END IF;
  INSERT INTO t_vars VALUES ('t1', r ->> 'id');
  r2 := create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', k1, 'milestone', 'document_request', 'title', 'TEST 다시',
        'body', 'TEST 다시', 'phone', '01022223333', 'alimtok_text', 'x'));
  IF (r2 ->> 'existing')::boolean IS NOT TRUE OR r2 ->> 'id' <> r ->> 'id' THEN RAISE EXCEPTION 'FAIL dedupe within 1 hour %', r2; END IF;
  BEGIN
    PERFORM create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', k2, 'milestone', 'contract_signed', 'title', 'x', 'body', '주민번호 900101-1234567'));
    RAISE EXCEPTION 'FAIL rrn accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- 번호가 없으면 자동 대체 없음
  r := create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', k2, 'milestone', 'contract_signed', 'title', 'TEST 계약', 'body', 'TEST 계약 안내'));
  IF (r ->> 'fallback')::boolean THEN RAISE EXCEPTION 'FAIL fallback without phone'; END IF;
  INSERT INTO t_vars VALUES ('t2', r ->> 'id');
  -- 화면에서 번호는 읽을 수 없다 (칸 권한)
  BEGIN
    PERFORM phone FROM client_notice_tasks LIMIT 1;
    RAISE EXCEPTION 'FAIL phone readable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  r := set_case_kakao_name('test-lawyer-ab01', k1, 'TEST김카톡');
  r := set_case_kakao_name('test-lawyer-ab01', k2, 'TEST김카톡');
  IF (r ->> 'same_name_cases')::int <> 1 THEN RAISE EXCEPTION 'FAIL same name warning %', r; END IF;
  -- 복사해서 보냄 → 소통 기록
  r := complete_client_notice_task((SELECT v FROM t_vars WHERE k = 't2')::uuid, NULL);
  SELECT count(*) INTO n FROM client_comm_logs WHERE id = (r ->> 'comm_log_id')::uuid AND source = 'kakao_manual' AND channel = 'kakao';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL complete log'; END IF;
  BEGIN
    PERFORM complete_client_notice_task((SELECT v FROM t_vars WHERE k = 't2')::uuid, NULL);
    RAISE EXCEPTION 'FAIL complete twice';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS notice task create + dedupe + kakao name + complete';
END $$;
RESET ROLE;

-- 2) 다른 사무소는 할 일을 못 본다
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab03","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM client_notice_tasks;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL other office sees tasks %', n; END IF;
  BEGIN
    PERFORM complete_client_notice_task((SELECT v FROM t_vars WHERE k = 't1')::uuid, NULL);
    RAISE EXCEPTION 'FAIL other office completes';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  RAISE NOTICE 'PASS other office isolation';
END $$;
RESET ROLE;

-- 3) 알림톡 자동 대체: 기한 지남 → 꺼내기(근무 시간만) → 성공 기록
DO $$ DECLARE n int; t client_notice_tasks; BEGIN
  UPDATE client_notice_tasks SET due_at = now() - interval '1 minute' WHERE id = (SELECT v FROM t_vars WHERE k = 't1')::uuid;
  SELECT count(*) INTO n FROM claim_client_notice_fallbacks(20, '2026-11-09 23:00:00+09'::timestamptz);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL claimed at night'; END IF;
  SELECT count(*) INTO n FROM claim_client_notice_fallbacks(20, '2026-11-09 10:00:00+09'::timestamptz);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL claim %', n; END IF;
  PERFORM finish_client_notice_fallback((SELECT v FROM t_vars WHERE k = 't1')::uuid, true, 'alimtalk', 'R1', NULL);
  SELECT * INTO t FROM client_notice_tasks WHERE id = (SELECT v FROM t_vars WHERE k = 't1')::uuid;
  IF t.status <> 'fallback_sent' OR t.phone IS NOT NULL THEN RAISE EXCEPTION 'FAIL fallback finish %', t.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_comm_logs WHERE id = t.comm_log_id AND source = 'alimtok' AND channel = 'alimtok') THEN RAISE EXCEPTION 'FAIL alimtok log'; END IF;
  RAISE NOTICE 'PASS fallback claim + finish';
END $$;

-- 4) 대화 내보내기: 지문 확인 전 거절 → 확인 → 줄 넣기 → 다시 올리면 새 줄만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab01","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; lines jsonb; BEGIN
  r := create_kakao_export_upload('test-lawyer-ab01', jsonb_build_object('workspace_key', (SELECT v FROM t_vars WHERE k = 'k1'),
        'original_name', 'KakaoTalk.txt', 'size_bytes', 100, 'sha256', repeat('d', 64)));
  INSERT INTO t_vars VALUES ('x1', r ->> 'id');
  lines := jsonb_build_array(
    jsonb_build_object('at', '2026-10-01T01:00:00Z', 'sender', 'TEST의뢰인', 'body', 'TEST 안녕하세요', 'n', 1),
    jsonb_build_object('at', '2026-10-01T01:00:00Z', 'sender', 'TEST의뢰인', 'body', '네', 'n', 1),
    jsonb_build_object('at', '2026-10-01T01:00:00Z', 'sender', 'TEST의뢰인', 'body', '네', 'n', 2),
    jsonb_build_object('at', '2026-10-01T01:01:00Z', 'sender', 'TEST사무장', 'body', 'TEST 서류 부탁드려요', 'n', 1),
    jsonb_build_object('at', '2026-10-01T01:02:00Z', 'sender', 'TEST친구', 'body', 'TEST 다른 사람', 'n', 1));
  INSERT INTO t_vars VALUES ('lines', lines::text);
  BEGIN
    PERFORM import_kakao_export_lines((r ->> 'id')::uuid, jsonb_build_object('client_names', jsonb_build_array('TEST의뢰인'), 'lines', lines), true);
    RAISE EXCEPTION 'FAIL import before fingerprint';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS export slot + import blocked before verify';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$ DECLARE r jsonb; BEGIN
  r := finish_kakao_export_upload((SELECT v FROM t_vars WHERE k = 'x1')::uuid, repeat('d', 64), 100, '00000000-0000-4000-8000-00000000ab01');
  IF r ->> 'status' <> 'stored' THEN RAISE EXCEPTION 'FAIL export verify %', r; END IF;
  RAISE NOTICE 'PASS export fingerprint stored';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab01","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; r2 jsonb; n int; BEGIN
  r := import_kakao_export_lines((SELECT v FROM t_vars WHERE k = 'x1')::uuid,
        jsonb_build_object('format', 'pc', 'client_names', jsonb_build_array('TEST의뢰인'), 'office_names', jsonb_build_array('TEST사무장'),
                           'lines', (SELECT v FROM t_vars WHERE k = 'lines')::jsonb), true);
  IF (r ->> 'inserted')::int <> 4 OR (r ->> 'skipped')::int <> 1 THEN RAISE EXCEPTION 'FAIL import counts %', r; END IF;
  SELECT count(*) INTO n FROM client_comm_logs WHERE source = 'kakao_export' AND direction = 'in' AND workspace_key = (SELECT v FROM t_vars WHERE k = 'k1');
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL client lines %', n; END IF;
  -- 같은 대화에 새 줄 하나 더해 다시 올림
  r2 := create_kakao_export_upload('test-lawyer-ab01', jsonb_build_object('workspace_key', (SELECT v FROM t_vars WHERE k = 'k1'),
        'original_name', 'KakaoTalk2.txt', 'size_bytes', 120, 'sha256', repeat('e', 64)));
  INSERT INTO t_vars VALUES ('x2', r2 ->> 'id');
  RAISE NOTICE 'PASS import lines + sender mapping';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT finish_kakao_export_upload((SELECT v FROM t_vars WHERE k = 'x2')::uuid, repeat('e', 64), 120, '00000000-0000-4000-8000-00000000ab01');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab01","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := import_kakao_export_lines((SELECT v FROM t_vars WHERE k = 'x2')::uuid,
        jsonb_build_object('client_names', jsonb_build_array('TEST의뢰인'), 'office_names', jsonb_build_array('TEST사무장'),
                           'lines', (SELECT v FROM t_vars WHERE k = 'lines')::jsonb ||
                                    jsonb_build_array(jsonb_build_object('at', '2026-10-02T01:00:00Z', 'sender', 'TEST의뢰인', 'body', 'TEST 보냈어요', 'n', 1))), true);
  IF (r ->> 'inserted')::int <> 1 OR (r ->> 'duplicates')::int <> 4 THEN RAISE EXCEPTION 'FAIL re-upload only new %', r; END IF;
  RAISE NOTICE 'PASS re-upload adds only new lines';
END $$;
RESET ROLE;

-- 5) PC 묶음: 꺼져 있으면 거절 → 안내 확인 없이 켜기 거절 → 켜기 → 이름 겹치는 사건은 목록에서 빠짐 → 결과 기록
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab01","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; n int; v_pol office_comm_policies; k2 text := (SELECT v FROM t_vars WHERE k = 'k2'); BEGIN
  BEGIN
    PERFORM * FROM kakao_pc_batch_list('test-lawyer-ab01', 30);
    RAISE EXCEPTION 'FAIL list while off';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM set_office_comm_policy('test-lawyer-ab01', '{"kakao_pc_batch_enabled":true}'::jsonb, NULL);
    RAISE EXCEPTION 'FAIL enable without ack';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  v_pol := set_office_comm_policy('test-lawyer-ab01', '{"kakao_pc_batch_enabled":true,"kakao_pc_batch_ack":true}'::jsonb, NULL);
  IF NOT v_pol.kakao_pc_batch_enabled OR v_pol.kakao_pc_batch_ack_at IS NULL THEN RAISE EXCEPTION 'FAIL enable'; END IF;
  r := create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', k2, 'milestone', 'court_filed', 'title', 'TEST 접수', 'body', 'TEST 접수 안내'));
  INSERT INTO t_vars VALUES ('t3', r ->> 'id');
  -- k1·k2 이름이 같아서 빠짐
  SELECT count(*) INTO n FROM kakao_pc_batch_list('test-lawyer-ab01', 30);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL duplicate kakao name listed %', n; END IF;
  PERFORM set_case_kakao_name('test-lawyer-ab01', (SELECT v FROM t_vars WHERE k = 'k1'), '');
  SELECT count(*) INTO n FROM kakao_pc_batch_list('test-lawyer-ab01', 30);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL batch list %', n; END IF;
  r := record_kakao_pc_batch_results('test-lawyer-ab01', ARRAY[(SELECT v FROM t_vars WHERE k = 't3')::uuid]);
  IF (r ->> 'sent')::int <> 1 THEN RAISE EXCEPTION 'FAIL batch result %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_comm_logs WHERE source = 'kakao_pc_batch' AND workspace_key = k2) THEN RAISE EXCEPTION 'FAIL batch log'; END IF;
  RAISE NOTICE 'PASS PC batch ack + list + results';
END $$;

-- 6) 오늘의 업무에 안내 할 일 표시
DO $$ DECLARE q jsonb; BEGIN
  PERFORM create_client_notice_task('test-lawyer-ab01', jsonb_build_object('workspace_key', (SELECT v FROM t_vars WHERE k = 'k1'),
    'milestone', 'commenced', 'title', 'TEST 개시', 'body', 'TEST 개시 안내'));
  q := office_work_queue('test-lawyer-ab01');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q) x WHERE x ->> 'kind' = 'client_notice' AND x ->> 'link_type' = 'case_comm') THEN
    RAISE EXCEPTION 'FAIL work queue item';
  END IF;
  RAISE NOTICE 'PASS work queue client_notice';
END $$;
RESET ROLE;
ROLLBACK;
