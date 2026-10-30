-- 의뢰인 서식 작성 요청 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_g1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_client_g2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_other_g3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-g1', 'TEST_G1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-g1', 'g1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-g', '00000000-0000-4000-8000-0000000000e2', 'TEST가명G', 'contracted', 'test-lawyer-g1');
INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source) VALUES
  ('test-file-g-sig', 'test-lawyer-g1', 'test-req-g', 'test-lawyer-g1/test-req-g/client/sig.png', 'sig.png', 'client'),
  ('test-file-g-office', 'test-lawyer-g1', 'test-req-g', 'test-lawyer-g1/test-req-g/office/x.pdf', 'x.pdf', 'office');

-- 사무소: 요청
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r client_form_requests; BEGIN
  BEGIN
    PERFORM request_client_form('test-lawyer-g1', 'test-req-g', '{"doc_code":"121020","title":"TEST","fields":[{"id":"Bad Id","label":"x"}]}');
    RAISE EXCEPTION 'FAIL bad field id accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := request_client_form('test-lawyer-g1', 'test-req-g',
    '{"doc_code":"121020","title":"TEST 사채진술서","needs_signature":true,"fields":[{"id":"lender","label":"빌려준 사람","required":true},{"id":"amount","label":"금액","type":"currency"}]}');
  IF r.status <> 'requested' OR jsonb_array_length(r.fields) <> 2 THEN RAISE EXCEPTION 'FAIL request %', r; END IF;
  BEGIN
    PERFORM request_client_form('test-lawyer-g1', 'test-req-g', '{"doc_code":"121020","title":"TEST 다시","fields":[{"id":"a","label":"a"}]}');
    RAISE EXCEPTION 'FAIL duplicate open request';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- 표 직접 접근 없음
  BEGIN
    PERFORM 1 FROM client_form_requests;
    RAISE EXCEPTION 'FAIL direct table read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office request + validation';
END $$;
RESET ROLE;

-- 다른 사람은 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; v_id uuid; BEGIN
  v := client_form_view('test-req-g');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL stranger sees forms %', v; END IF;
  RESET ROLE;
  SELECT id INTO v_id FROM client_form_requests WHERE case_key = 'test-req-g';
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM client_form_respond(v_id, 'save', '{"answers":{"lender":"x"}}');
    RAISE EXCEPTION 'FAIL stranger responds';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS stranger blocked';
END $$;
RESET ROLE;

-- 의뢰인: 임시 저장·주민번호 거절·필수·서명·보내기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; v_id uuid; res jsonb; BEGIN
  v := client_form_view('test-req-g');
  IF jsonb_array_length(v) <> 1 THEN RAISE EXCEPTION 'FAIL client view %', v; END IF;
  v_id := (v -> 0 ->> 'id')::uuid;
  res := client_form_respond(v_id, 'save', '{"answers":{"lender":"TEST 지인","unknown":"버림"}}');
  IF res ->> 'status' <> 'in_progress' THEN RAISE EXCEPTION 'FAIL save %', res; END IF;
  IF (client_form_view('test-req-g') -> 0 -> 'draft') ? 'unknown' THEN RAISE EXCEPTION 'FAIL unknown key kept'; END IF;
  BEGIN
    PERFORM client_form_respond(v_id, 'save', '{"answers":{"lender":"900101-1234567"}}');
    RAISE EXCEPTION 'FAIL rrn accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM client_form_respond(v_id, 'submit', '{"answers":{"amount":"100"},"signature_file_id":"test-file-g-sig"}');
    RAISE EXCEPTION 'FAIL required missing';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM client_form_respond(v_id, 'submit', '{"answers":{"lender":"TEST 지인"},"signature_file_id":"test-file-g-office"}');
    RAISE EXCEPTION 'FAIL office file used as signature';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  res := client_form_respond(v_id, 'submit', '{"answers":{"lender":"TEST 지인","amount":"3000000"},"signature_file_id":"test-file-g-sig"}');
  IF res ->> 'status' <> 'submitted' OR (res ->> 'version')::int <> 1 THEN RAISE EXCEPTION 'FAIL submit %', res; END IF;
  RAISE NOTICE 'PASS client save/submit';
END $$;
RESET ROLE;

-- 사무소: 보완 요청 → 의뢰인 알림 → 다시 보내기 → 확인, 제출본 고칠 수 없음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; v_id uuid; r client_form_requests; BEGIN
  v := office_client_forms('test-lawyer-g1', 'test-req-g');
  v_id := (v -> 0 ->> 'id')::uuid;
  IF v -> 0 -> 'submission' ->> 'version' <> '1' OR v -> 0 -> 'submission' -> 'answers' ->> 'amount' <> '3000000' THEN
    RAISE EXCEPTION 'FAIL office view %', v;
  END IF;
  BEGIN
    PERFORM review_client_form(v_id, 'needs_fix', NULL);
    RAISE EXCEPTION 'FAIL fix without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := review_client_form(v_id, 'needs_fix', 'TEST 금액을 다시 확인해 주세요');
  IF r.status <> 'needs_fix' THEN RAISE EXCEPTION 'FAIL needs_fix %', r; END IF;
  RAISE NOTICE 'PASS office needs_fix';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e2' AND kind = 'form_fix') THEN
    RAISE EXCEPTION 'FAIL client fix notification';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e1' AND kind = 'form_client_reply') THEN
    RAISE EXCEPTION 'FAIL office reply notification';
  END IF;
  BEGIN
    UPDATE client_form_submissions SET answers = '{}'::jsonb;
    RAISE EXCEPTION 'FAIL submission updated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS notifications + append-only';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_id uuid; res jsonb; BEGIN
  v_id := (client_form_view('test-req-g') -> 0 ->> 'id')::uuid;
  res := client_form_respond(v_id, 'submit', '{"answers":{"lender":"TEST 지인","amount":"2500000"},"signature_file_id":"test-file-g-sig"}');
  IF (res ->> 'version')::int <> 2 THEN RAISE EXCEPTION 'FAIL resubmit %', res; END IF;
  RAISE NOTICE 'PASS resubmit version 2';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_id uuid; r client_form_requests; BEGIN
  v_id := (office_client_forms('test-lawyer-g1', 'test-req-g') -> 0 ->> 'id')::uuid;
  r := review_client_form(v_id, 'accept');
  IF r.status <> 'accepted' THEN RAISE EXCEPTION 'FAIL accept'; END IF;
  RAISE NOTICE 'PASS accept';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_id uuid; BEGIN
  v_id := (client_form_view('test-req-g') -> 0 ->> 'id')::uuid;
  BEGIN
    PERFORM client_form_respond(v_id, 'save', '{"answers":{"lender":"x"}}');
    RAISE EXCEPTION 'FAIL edit after accept';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS locked after accept';
END $$;
RESET ROLE;
ROLLBACK;
