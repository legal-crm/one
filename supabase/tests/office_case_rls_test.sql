-- 묶음 1·2 권한·RLS 시험 (시험 DB 전용, 끝에 ROLLBACK — 남는 데이터 없음)
-- 실행: psql <시험 DB URL> -v ON_ERROR_STOP=1 -f supabase/tests/office_case_rls_test.sql
-- 결과: 'PASS …' 줄만 나오면 통과. 실패하면 'FAIL …' 예외로 멈춤.
\set ON_ERROR_STOP on
BEGIN;

-- 시험 계정 (auth.users)
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'test_owner_a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test_owner_b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'test_client_c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000d', 'test_staff_s@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000e', 'test_admin_x@example.test', 'authenticated', 'authenticated');

INSERT INTO lawyers (id, name, firm_name) VALUES ('test-lawyer-a', 'TEST_변호사A', 'TEST_사무소A'), ('test-lawyer-b', 'TEST_변호사B', 'TEST_사무소B');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'test-lawyer-a', 'test_owner_a@example.test', true),
  ('00000000-0000-4000-8000-00000000000b', 'test-lawyer-b', 'test_owner_b@example.test', true);

DO $$ BEGIN
  IF (SELECT count(*) FROM offices WHERE id IN ('test-lawyer-a', 'test-lawyer-b')) <> 2 THEN RAISE EXCEPTION 'FAIL offices not created by trigger'; END IF;
  IF (SELECT name FROM offices WHERE id = 'test-lawyer-a') <> 'TEST_사무소A' THEN RAISE EXCEPTION 'FAIL office name'; END IF;
  RAISE NOTICE 'PASS 승인된 변호사 → 사무소·대표 자동 생성';
END $$;

-- 상담 요청 (의뢰인 C → 변호사 A)
INSERT INTO consult_requests (id, client_id, client_name, phone, request_type, status, selected_lawyer_id, selected_lawyer_ids)
VALUES ('test-req-1', '00000000-0000-4000-8000-00000000000c', 'TEST_가명', '01012345678', 'direct', 'requested', 'test-lawyer-a', '["test-lawyer-a"]');

CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated;

-- ── 대표 A ───────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE r record; v_case cases; v_tok text;
BEGIN
  SELECT * INTO r FROM my_office_context();
  IF r.office_id <> 'test-lawyer-a' OR r.role <> 'owner' OR NOT r.is_verified_lawyer THEN RAISE EXCEPTION 'FAIL owner context %', r; END IF;
  IF r.permissions->>'proposal.send' <> 'all' THEN RAISE EXCEPTION 'FAIL owner proposal.send'; END IF;
  RAISE NOTICE 'PASS 대표 권한표';

  SELECT token INTO v_tok FROM create_office_invite('test-lawyer-a', 'consultant', 'test_staff_s@example.test', 48);
  INSERT INTO t_vars VALUES ('invite', v_tok);

  -- 다른 사무소 초대 생성 불가
  BEGIN
    PERFORM create_office_invite('test-lawyer-b', 'consultant', NULL, 48);
    RAISE EXCEPTION 'FAIL invite to other office allowed';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 다른 사무소 초대 거절';
  END;

  -- 직접 등록 사건
  v_case := create_case('test-lawyer-a', '{"case_type":"rehab","source":"direct","display_name":"TEST_직접","phone":"010-2222-3333"}');
  INSERT INTO t_vars VALUES ('case_direct', v_case.id::text);
  IF v_case.stage <> 'consult' OR v_case.lawyer_member_id IS NULL THEN RAISE EXCEPTION 'FAIL direct case %', v_case; END IF;

  -- 같은 번호 확인
  IF (SELECT count(*) FROM find_office_clients_by_phone('test-lawyer-a', '01022223333')) <> 1 THEN RAISE EXCEPTION 'FAIL phone hash lookup'; END IF;
  RAISE NOTICE 'PASS 직접 등록·같은 번호 확인';

  -- 상담 요청 → 사건 (계약 전이라 연락처 복사 안 됨)
  v_case := create_case('test-lawyer-a', '{"case_type":"rehab","source":"consult_request","consult_request_id":"test-req-1"}');
  INSERT INTO t_vars VALUES ('case_consult', v_case.id::text);
  IF (SELECT phone FROM office_clients WHERE id = v_case.office_client_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL phone copied before consent'; END IF;
  IF (SELECT client_user_id FROM office_clients WHERE id = v_case.office_client_id) <> '00000000-0000-4000-8000-00000000000c' THEN RAISE EXCEPTION 'FAIL client link'; END IF;
  BEGIN
    PERFORM create_case('test-lawyer-a', '{"source":"consult_request","consult_request_id":"test-req-1"}');
    RAISE EXCEPTION 'FAIL duplicate consult case';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 상담 요청 → 사건(연락처 미복사·중복 방지)';
  END;

  -- 기록 → 단계
  v_case := record_case_milestone(v_case.id, 'proposal_sent');
  v_case := record_case_milestone(v_case.id, 'contract_signed');
  IF v_case.stage <> 'documents' THEN RAISE EXCEPTION 'FAIL contract_signed stage %', v_case.stage; END IF;
  v_case := record_case_milestone(v_case.id, 'proposal_sent');
  IF v_case.stage <> 'documents' THEN RAISE EXCEPTION 'FAIL backward move by milestone'; END IF;
  BEGIN
    PERFORM record_case_milestone(v_case.id, 'case_number_registered', '{"case_number":"2026개회1"}');
    RAISE EXCEPTION 'FAIL case number without court';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  v_case := record_case_milestone(v_case.id, 'case_number_registered', '{"case_number":"TEST-2026개회1","court_name":"TEST법원","date":"2026-11-02"}');
  IF v_case.stage <> 'filed' OR v_case.filed_on <> '2026-11-02' THEN RAISE EXCEPTION 'FAIL filed'; END IF;
  BEGIN
    PERFORM record_case_milestone(v_case.id, 'bankruptcy_declared', '{"date":"2026-12-01"}');
    RAISE EXCEPTION 'FAIL bankruptcy milestone on rehab';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM record_case_milestone(v_case.id, 'manual_stage', '{"stage":"drafting"}');
    RAISE EXCEPTION 'FAIL manual stage without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM record_case_milestone(v_case.id, 'proposal_sent', jsonb_build_object('expected_version', v_case.version - 1));
    RAISE EXCEPTION 'FAIL version check';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  RAISE NOTICE 'PASS 기록 → 단계(뒤로 안 감·필수값·유형 확인·버전 충돌)';

  -- 서식 초안: 부분 저장, 주민번호 거절
  PERFORM save_case_form_draft(v_case.id, 'statement', '{"a":1,"b":2}');
  PERFORM save_case_form_draft(v_case.id, 'statement', '{"b":3}', 1);
  IF (SELECT data FROM case_form_drafts WHERE case_id = v_case.id AND form_key = 'statement') <> '{"a":1,"b":3}'::jsonb THEN RAISE EXCEPTION 'FAIL partial save'; END IF;
  BEGIN
    PERFORM save_case_form_draft(v_case.id, 'statement', '{"rrn":"900101-1234567"}');
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS 서식 초안 부분 저장·주민번호 거절';

  -- 변제 회차
  PERFORM set_case_plan_payments(v_case.id, '[{"round_no":1,"due_on":"2027-01-25","amount":450000},{"round_no":2,"due_on":"2027-02-25","amount":450000}]');
  INSERT INTO t_vars VALUES ('payment1', (SELECT id::text FROM case_plan_payments WHERE case_id = v_case.id AND round_no = 1));
END $$;
RESET ROLE;

-- ── 직원 S: 초대 수락 ─────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM accept_office_invite((SELECT v FROM t_vars WHERE k = 'invite'), 'TEST_직원');
  IF r.role <> 'consultant' THEN RAISE EXCEPTION 'FAIL staff role'; END IF;
  IF EXISTS (SELECT 1 FROM lawyer_accounts WHERE auth_user_id = auth.uid()) THEN RAISE EXCEPTION 'FAIL staff became lawyer applicant'; END IF;
  IF (SELECT count(*) FROM cases) <> 0 THEN RAISE EXCEPTION 'FAIL staff sees unassigned cases'; END IF;
  IF office_permission_scope('test-lawyer-a', 'proposal.send') <> 'none' THEN RAISE EXCEPTION 'FAIL staff proposal.send'; END IF;
  BEGIN
    PERFORM accept_office_invite((SELECT v FROM t_vars WHERE k = 'invite'));
    RAISE EXCEPTION 'FAIL invite reused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 직원 초대 수락(변호사 가입 안 만듦·미배정 사건 안 보임·🔒 권한 없음·재사용 거절)';
END $$;
RESET ROLE;

-- ── 대표 A: 직원 배정 ─────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_staff uuid; v_lawyer uuid;
BEGIN
  SELECT id INTO v_staff FROM office_members WHERE office_id = 'test-lawyer-a' AND role = 'consultant';
  SELECT id INTO v_lawyer FROM office_members WHERE office_id = 'test-lawyer-a' AND role = 'owner';
  PERFORM set_case_assignment((SELECT v FROM t_vars WHERE k = 'case_consult')::uuid, v_lawyer, v_staff);
  BEGIN
    PERFORM update_office_member(v_staff, NULL, NULL, '{"proposal.send":"all"}');
    RAISE EXCEPTION 'FAIL lawyer-only override allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM update_office_member(v_staff, 'lawyer');
    RAISE EXCEPTION 'FAIL non-lawyer given lawyer role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM office_audit_logs WHERE office_id = 'test-lawyer-a') < 3 THEN RAISE EXCEPTION 'FAIL audit logs'; END IF;
  RAISE NOTICE 'PASS 배정·🔒 조정 거절·활동 기록';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM cases) <> 1 THEN RAISE EXCEPTION 'FAIL staff should see 1 assigned case'; END IF;
  IF (SELECT count(*) FROM office_audit_logs) <> 0 THEN RAISE EXCEPTION 'FAIL staff reads audit logs'; END IF;
  RAISE NOTICE 'PASS 직원은 배정 사건만·활동 기록 못 봄';
END $$;
RESET ROLE;

-- ── 다른 사무소 대표 B ────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM cases) + (SELECT count(*) FROM office_clients) + (SELECT count(*) FROM case_events) <> 0 THEN
    RAISE EXCEPTION 'FAIL other office sees data';
  END IF;
  BEGIN
    PERFORM record_case_milestone((SELECT v FROM t_vars WHERE k = 'case_consult')::uuid, 'drafting_started');
    RAISE EXCEPTION 'FAIL other office writes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM create_case('test-lawyer-b', '{"source":"consult_request","consult_request_id":"test-req-1"}');
    RAISE EXCEPTION 'FAIL other office takes consult request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 다른 사무소 읽기·쓰기·상담 요청 가로채기 거절';
END $$;
RESET ROLE;

-- ── 의뢰인 C ─────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM my_cases()) <> 1 THEN RAISE EXCEPTION 'FAIL client my_cases'; END IF;
  IF (SELECT client_stage_label FROM my_cases()) <> '법원에 접수했어요' THEN RAISE EXCEPTION 'FAIL client label'; END IF;
  IF (SELECT count(*) FROM cases) + (SELECT count(*) FROM office_clients) <> 0 THEN RAISE EXCEPTION 'FAIL client reads office tables'; END IF;
  IF EXISTS (SELECT 1 FROM case_events WHERE NOT client_visible) THEN RAISE EXCEPTION 'FAIL client sees private events'; END IF;
  IF (SELECT count(*) FROM case_events) = 0 THEN RAISE EXCEPTION 'FAIL client sees no public events'; END IF;
  PERFORM mark_case_plan_payment((SELECT v FROM t_vars WHERE k = 'payment1')::uuid, 'client_report', '2027-01-24');
  BEGIN
    PERFORM mark_case_plan_payment((SELECT v FROM t_vars WHERE k = 'payment1')::uuid, 'confirm');
    RAISE EXCEPTION 'FAIL client confirms payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 의뢰인: 내 사건·공개 기록만·납부했어요';
END $$;
RESET ROLE;

-- ── 통합관리자 (aal2 + admin) ─────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM cases) + (SELECT count(*) FROM office_clients) + (SELECT count(*) FROM case_events)
     + (SELECT count(*) FROM office_audit_logs) + (SELECT count(*) FROM case_form_drafts) <> 0 THEN
    RAISE EXCEPTION 'FAIL admin reads office data';
  END IF;
  RAISE NOTICE 'PASS 통합관리자 제로날리지';
END $$;
RESET ROLE;

-- ── 익명 ─────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM cases;
    RAISE EXCEPTION 'FAIL anon reads cases';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM create_case('test-lawyer-a', '{}');
    RAISE EXCEPTION 'FAIL anon executes create_case';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 익명 접근 차단';
END $$;
RESET ROLE;

-- ── 상담 요청 보안 (20261030000200) ────────────────────────
INSERT INTO consult_requests (id, client_id, client_name, phone, request_type, status)
VALUES ('test-req-open', 'client-temp', 'TEST_공개', '01099998888', 'open', 'requested');

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM consult_requests) + (SELECT count(*) FROM consult_messages) + (SELECT count(*) FROM electronic_contracts) <> 0 THEN
    RAISE EXCEPTION 'FAIL anon reads consult/contract data';
  END IF;
  BEGIN
    INSERT INTO consult_requests (id, client_id) VALUES ('test-anon-insert', 'client-temp');
    RAISE EXCEPTION 'FAIL anon inserts consult request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM lawyers) = 0 THEN RAISE EXCEPTION 'FAIL anon cannot read public lawyer profiles'; END IF;
  RAISE NOTICE 'PASS 익명: 상담·메시지·계약 읽기/쓰기 차단, 변호사 공개 프로필만 읽기';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM consult_requests_for_lawyers WHERE id = 'test-req-open') <> 0 THEN RAISE EXCEPTION 'FAIL open request visible to lawyers'; END IF;
  IF (SELECT count(*) FROM consult_requests_for_lawyers WHERE id = 'test-req-1') <> 1 THEN RAISE EXCEPTION 'FAIL lawyer A cannot see own request'; END IF;
  IF (SELECT phone FROM consult_requests_for_lawyers WHERE id = 'test-req-1') <> '010-****-****' THEN RAISE EXCEPTION 'FAIL phone not masked before contract'; END IF;
  RAISE NOTICE 'PASS 변호사: 공개 요청 안 보임·받은 요청은 가린 연락처로';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM consult_requests_for_lawyers WHERE id = 'test-req-1') <> 1 THEN RAISE EXCEPTION 'FAIL office staff cannot see office request'; END IF;
  IF NOT can_access_consult_request('test-req-1') THEN RAISE EXCEPTION 'FAIL assigned staff cannot chat'; END IF;
  RAISE NOTICE 'PASS 사무소 직원: 사무소에 온 상담 요청 보기·배정 사건 채팅';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM consult_requests_for_lawyers) <> 0 OR can_access_consult_request('test-req-1') THEN
    RAISE EXCEPTION 'FAIL other office sees request';
  END IF;
  RAISE NOTICE 'PASS 다른 사무소: 상담 요청·메시지 접근 없음';
END $$;
RESET ROLE;

-- ── 직원의 상담 요청 처리 (20261030000300) ─────────────────
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM lawyer_patch_consult_request('test-req-1', '{"status":"counseling"}');
  IF lawyer_can_view_request((SELECT cr FROM consult_requests cr WHERE id = 'test-req-1'), 'nobody') IS NULL THEN
    RAISE EXCEPTION 'FAIL lawyer_can_view_request returns NULL';
  END IF;
  BEGIN
    PERFORM lawyer_patch_consult_request('test-req-1', '{"proposal":{"id":"p1","lawyerId":"test-lawyer-a"}}');
    RAISE EXCEPTION 'FAIL staff sends proposal';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 직원: 상담 상태만 바꿈·제안서 발송 거절';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM lawyer_patch_consult_request('test-req-1', '{"status":"counseling"}');
    RAISE EXCEPTION 'FAIL other office patches request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM lawyer_patch_consult_request('test-req-1', '{"phone":"01000000000"}');
    RAISE EXCEPTION 'FAIL other office edits contact';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS 다른 사무소 상담 요청 수정·연락처 변경 거절';
END $$;
RESET ROLE;

-- ── 승인 해제 = 사무소 정지 ───────────────────────────────
UPDATE lawyer_accounts SET approved = false WHERE lawyer_id = 'test-lawyer-a';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM cases) <> 0 OR cardinality(current_office_ids()) <> 0 THEN RAISE EXCEPTION 'FAIL suspended office still visible'; END IF;
  RAISE NOTICE 'PASS 승인 해제 → 사무소 정지·직원 접근 차단';
END $$;
RESET ROLE;

ROLLBACK;
