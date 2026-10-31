-- 업무폰 기기·연락처·소통 기록·녹음·기기 명령 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_c1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'test_consult_c2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 'test_other_c3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-c1', 'TEST_C1'), ('test-lawyer-c3', 'TEST_C3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-c1', 'c1', true),
  ('00000000-0000-4000-8000-0000000000c3', 'test-lawyer-c3', 'c3', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-c1', '00000000-0000-4000-8000-0000000000c2', 'TEST 상담', 'consultant', 'active');
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- 1) 대표: 사건·연락처·연결 코드·직접 기록
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_case cases; k text; c jsonb; code jsonb; l client_comm_logs; BEGIN
  v_case := create_case('test-lawyer-c1', '{"case_type":"rehab","source":"direct","display_name":"TEST_COMM","phone":"010-1234-5678"}');
  k := 'case-' || v_case.id::text;
  INSERT INTO t_vars VALUES ('key', k), ('case', v_case.id::text);
  c := save_client_contact('test-lawyer-c1', jsonb_build_object('workspace_key', k, 'phone', '+82 10-1234-5678', 'relation', 'self'));
  IF c ->> 'phone' <> '01012345678' THEN RAISE EXCEPTION 'FAIL phone normalize %', c; END IF;
  INSERT INTO t_vars VALUES ('contact', c ->> 'id');
  BEGIN
    PERFORM save_client_contact('test-lawyer-c1', jsonb_build_object('workspace_key', 'case-00000000-0000-4000-8000-000000000999', 'phone', '01000000000'));
    RAISE EXCEPTION 'FAIL unknown key';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  code := create_device_pairing_code('test-lawyer-c1', 'TEST 대표폰');
  IF (code ->> 'pre_approved')::boolean IS NOT TRUE OR length(code ->> 'code') <> 8 THEN RAISE EXCEPTION 'FAIL pair code %', code; END IF;
  INSERT INTO t_vars VALUES ('code', code ->> 'code');
  l := record_manual_comm_log('test-lawyer-c1', jsonb_build_object('workspace_key', k, 'channel', 'kakao', 'body', 'TEST 서류 안내'));
  IF l.source <> 'kakao_manual' OR l.result <> 'sent' THEN RAISE EXCEPTION 'FAIL manual kakao log'; END IF;
  BEGIN
    PERFORM relink_comm_log(l.id, jsonb_build_object('workspace_key', k));
    RAISE EXCEPTION 'FAIL relink without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS owner contact + pair code + manual log';
END $$;
RESET ROLE;

-- 2) 기기(서비스): 연결·인증·기록 묶음·녹음 지문
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$ DECLARE r jsonb; d uuid; h text; rec jsonb; n int; BEGIN
  r := device_pair((SELECT v FROM t_vars WHERE k = 'code'), repeat('a', 64), '{"model":"TEST","app_version":"1.0.0"}');
  IF (r ->> 'ok')::boolean IS NOT TRUE OR r ->> 'status' <> 'active' THEN RAISE EXCEPTION 'FAIL pair %', r; END IF;
  d := (r ->> 'device_id')::uuid;
  INSERT INTO t_vars VALUES ('device', d::text);
  r := device_pair((SELECT v FROM t_vars WHERE k = 'code'), repeat('b', 64), '{}');
  IF (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL code reused'; END IF;
  r := device_auth(repeat('a', 64));
  IF (r ->> 'ok')::boolean IS NOT TRUE OR r ->> 'office_id' <> 'test-lawyer-c1' THEN RAISE EXCEPTION 'FAIL auth %', r; END IF;
  r := device_heartbeat(d, jsonb_build_object('device_time', now(), 'pending_uploads', 2));
  IF r -> 'hash' ->> 'salt' IS NULL THEN RAISE EXCEPTION 'FAIL heartbeat salt'; END IF;
  h := office_device_phone_hash('test-lawyer-c1', '010-1234-5678');
  r := device_contacts(d, NULL);
  IF NOT (r -> 'items') @> jsonb_build_array(jsonb_build_object('h', h)) THEN RAISE EXCEPTION 'FAIL contacts list'; END IF;
  r := device_ingest_logs(d, jsonb_build_array(
    jsonb_build_object('key', 'call-1', 'h', h, 'channel', 'call', 'direction', 'in', 'result', 'answered', 'duration_sec', 125, 'occurred_at', now() - interval '5 minutes'),
    jsonb_build_object('key', 'call-1', 'h', h, 'channel', 'call', 'direction', 'in', 'result', 'answered', 'duration_sec', 125, 'occurred_at', now() - interval '5 minutes'),
    jsonb_build_object('key', 'call-2', 'h', repeat('0', 64), 'channel', 'call', 'direction', 'out', 'occurred_at', now())));
  IF jsonb_array_length(r -> 'ignored') <> 1 THEN RAISE EXCEPTION 'FAIL unregistered ignored %', r; END IF;
  SELECT count(*) INTO n FROM client_comm_logs WHERE device_id = d;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL dedupe %', n; END IF;
  IF (SELECT workspace_key FROM client_comm_logs WHERE device_id = d) <> (SELECT v FROM t_vars WHERE k = 'key') THEN RAISE EXCEPTION 'FAIL linked'; END IF;
  r := device_lookup(d, h);
  IF (r ->> 'found')::boolean IS NOT TRUE OR r ->> 'label' IS NULL THEN RAISE EXCEPTION 'FAIL lookup %', r; END IF;
  rec := device_recording_init(d, jsonb_build_object('log_key', 'call-1', 'mime_type', 'audio/mp4', 'size_bytes', 1000, 'sha256', repeat('c', 64)));
  IF rec ->> 'path' NOT LIKE 'test-lawyer-c1/case-%.m4a' THEN RAISE EXCEPTION 'FAIL rec path %', rec; END IF;
  INSERT INTO t_vars VALUES ('rec', rec ->> 'id'), ('rec_path', rec ->> 'path');
  r := finish_call_recording((rec ->> 'id')::uuid, repeat('c', 64), 1000, NULL, d);
  IF r ->> 'status' <> 'verified' THEN RAISE EXCEPTION 'FAIL verify %', r; END IF;
  r := device_recording_init(d, jsonb_build_object('log_key', 'call-x', 'mime_type', 'audio/mp4', 'size_bytes', 1, 'sha256', repeat('c', 64)));
  IF (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL recording without log'; END IF;
  BEGIN
    UPDATE client_comm_logs SET body = 'x' WHERE device_id = d;
    RAISE EXCEPTION 'FAIL log changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM client_comm_logs WHERE device_id = d;
    RAISE EXCEPTION 'FAIL log deleted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS device pair + ingest + recording fingerprint';
END $$;

-- 3) 상담 직원(담당 아님): 기록·연락처 못 봄, 연결 코드는 승인 대기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE code jsonb; BEGIN
  IF EXISTS (SELECT 1 FROM client_comm_logs) OR EXISTS (SELECT 1 FROM client_contacts) THEN RAISE EXCEPTION 'FAIL unassigned staff reads'; END IF;
  BEGIN
    PERFORM save_client_contact('test-lawyer-c1', jsonb_build_object('workspace_key', (SELECT v FROM t_vars WHERE k = 'key'), 'phone', '01099998888'));
    RAISE EXCEPTION 'FAIL unassigned contact save';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  code := create_device_pairing_code('test-lawyer-c1', 'TEST 상담폰');
  IF (code ->> 'pre_approved')::boolean THEN RAISE EXCEPTION 'FAIL staff code pre-approved'; END IF;
  INSERT INTO t_vars VALUES ('code2', code ->> 'code');
  RAISE NOTICE 'PASS staff scope';
END $$;
RESET ROLE;
DO $$ DECLARE r jsonb; BEGIN
  r := device_pair((SELECT v FROM t_vars WHERE k = 'code2'), repeat('d', 64), '{}');
  IF r ->> 'status' <> 'pending' THEN RAISE EXCEPTION 'FAIL staff device pending %', r; END IF;
  INSERT INTO t_vars VALUES ('device2', r ->> 'device_id');
  BEGIN
    PERFORM device_ingest_logs((r ->> 'device_id')::uuid, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL pending device ingest';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS pending device blocked';
END $$;

-- 4) 다른 사무소: 아무것도 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM client_comm_logs) OR EXISTS (SELECT 1 FROM call_recordings) OR EXISTS (SELECT 1 FROM office_devices WHERE office_id = 'test-lawyer-c1') THEN
    RAISE EXCEPTION 'FAIL other office reads';
  END IF;
  BEGIN
    PERFORM log_evidence_access((SELECT v FROM t_vars WHERE k = 'rec')::uuid, 'play');
    RAISE EXCEPTION 'FAIL other office play';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

-- 5) 대표: 재생 전 열람 기록, 직원 기기 승인, 문자 명령(정책)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p text; cmd jsonb; BEGIN
  IF call_recording_play_allowed((SELECT v FROM t_vars WHERE k = 'rec_path')) THEN RAISE EXCEPTION 'FAIL play without access log'; END IF;
  p := log_evidence_access((SELECT v FROM t_vars WHERE k = 'rec')::uuid, 'play');
  IF NOT call_recording_play_allowed(p) THEN RAISE EXCEPTION 'FAIL play after access log'; END IF;
  IF (SELECT count(*) FROM office_devices WHERE office_id = 'test-lawyer-c1') <> 2 THEN RAISE EXCEPTION 'FAIL owner sees devices'; END IF;
  PERFORM approve_office_device((SELECT v FROM t_vars WHERE k = 'device2')::uuid);
  BEGIN
    PERFORM create_device_command((SELECT v FROM t_vars WHERE k = 'device')::uuid, 'sms', (SELECT v FROM t_vars WHERE k = 'contact')::uuid, 'TEST 문자');
    RAISE EXCEPTION 'FAIL sms allowed by default';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_office_comm_policy('test-lawyer-c1', '{"app_sms_allowed":true,"sms_quiet_start":0,"sms_quiet_end":0}');
  cmd := create_device_command((SELECT v FROM t_vars WHERE k = 'device')::uuid, 'sms', (SELECT v FROM t_vars WHERE k = 'contact')::uuid, 'TEST 문자');
  INSERT INTO t_vars VALUES ('cmd', cmd ->> 'id');
  BEGIN
    PERFORM create_device_command((SELECT v FROM t_vars WHERE k = 'device2')::uuid, 'dial', (SELECT v FROM t_vars WHERE k = 'contact')::uuid);
    RAISE EXCEPTION 'FAIL command to other person device';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS access log + approve + command';
END $$;
RESET ROLE;
DO $$ DECLARE r jsonb; d uuid := (SELECT v FROM t_vars WHERE k = 'device')::uuid; BEGIN
  r := device_pull_commands(d);
  IF jsonb_array_length(r -> 'items') <> 1 OR r -> 'items' -> 0 ->> 'phone' <> '01012345678' THEN RAISE EXCEPTION 'FAIL pull %', r; END IF;
  r := device_command_result(d, (SELECT v FROM t_vars WHERE k = 'cmd')::uuid, 'done', '{}');
  IF NOT EXISTS (SELECT 1 FROM client_comm_logs WHERE device_id = d AND channel = 'sms' AND direction = 'out' AND body = 'TEST 문자') THEN RAISE EXCEPTION 'FAIL sms logged'; END IF;
  r := device_register_request(d, '010-5555-0000', now(), NULL);
  IF (r ->> 'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL register request'; END IF;
  RAISE NOTICE 'PASS device command result + register request';
END $$;

-- 6) 등록 요청 → 리드 연결, 리드 이관 시 연결 따라감, 사건 파기 시 기록 삭제
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  INSERT INTO sales_leads (id, office_id, data) VALUES ('test-lead-c', 'test-lawyer-c1', '{"customerName":"TEST_LEAD","phone":"010-5555-0000","status":"in_progress"}');
  PERFORM resolve_device_register_request((SELECT id FROM device_register_requests WHERE office_id = 'test-lawyer-c1' AND status = 'open'),
    '{"action":"link","sales_lead_id":"test-lead-c"}');
  IF NOT EXISTS (SELECT 1 FROM client_contacts WHERE sales_lead_id = 'test-lead-c') THEN RAISE EXCEPTION 'FAIL register link'; END IF;
  r := convert_sales_lead_to_case('test-lead-c', '{}');
  IF NOT EXISTS (SELECT 1 FROM client_contacts WHERE workspace_key = r ->> 'workspace_key' AND phone = '01055550000') THEN RAISE EXCEPTION 'FAIL contact follows conversion'; END IF;
  RAISE NOTICE 'PASS register request + lead conversion';
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM purge_one_case((SELECT v FROM t_vars WHERE k = 'case')::uuid, 'trash_expired');
  IF EXISTS (SELECT 1 FROM client_comm_logs WHERE workspace_key = (SELECT v FROM t_vars WHERE k = 'key')) THEN RAISE EXCEPTION 'FAIL purge logs'; END IF;
  IF EXISTS (SELECT 1 FROM call_recordings WHERE id = (SELECT v FROM t_vars WHERE k = 'rec')::uuid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'FAIL purge recordings'; END IF;
  IF EXISTS (SELECT 1 FROM client_contacts WHERE workspace_key = (SELECT v FROM t_vars WHERE k = 'key')) THEN RAISE EXCEPTION 'FAIL purge contacts'; END IF;
  RAISE NOTICE 'PASS case purge';
END $$;
ROLLBACK;
