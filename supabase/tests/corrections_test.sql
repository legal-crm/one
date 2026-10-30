-- 보정 대응 시험: 기한 계산·권한·의뢰인 답·검토·제출 잠금 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_r1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'test_clerk_r2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 'test_client_r3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c4', 'test_owner_r4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-r1', 'TEST_R1'), ('test-lawyer-r4', 'TEST_R4');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-r1', 'r1', true),
  ('00000000-0000-4000-8000-0000000000c4', 'test-lawyer-r4', 'r4', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-r1', '00000000-0000-4000-8000-0000000000c2', 'TEST 사무', 'clerk', 'active');
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-r', '00000000-0000-4000-8000-0000000000c3', 'TEST가명R', 'contracted', 'test-lawyer-r1');
INSERT INTO case_files (id, office_id, client_key, storage_path, name, upload_source)
VALUES ('test-file-r1', 'test-lawyer-r1', 'test-req-r', 'test-lawyer-r1/test-req-r/client/r1.pdf', 'TEST 보험.pdf', 'client'),
       ('test-file-src', 'test-lawyer-r1', 'test-req-r', 'test-lawyer-r1/test-req-r/office/src.pdf', 'TEST 원문.pdf', 'office');

DO $$ BEGIN
  -- 2026-10-02(금) 송달 + 14일 = 10-16(금) / 2026-09-25(금) + 7일 = 10-02(금)
  IF correction_court_due('2026-10-02', 'days', 14, NULL) <> '2026-10-16' THEN RAISE EXCEPTION 'FAIL due 14'; END IF;
  -- 2026-09-26(토) + 7일 = 10-03(토, 개천절) → 10-05 대체공휴일 → 10-06(화)
  IF correction_court_due('2026-09-26', 'days', 7, NULL) <> '2026-10-06' THEN RAISE EXCEPTION 'FAIL due holiday %', correction_court_due('2026-09-26', 'days', 7, NULL); END IF;
  -- 30일 기한 → 5영업일 전, 7일 기한 → 2영업일 전
  IF correction_office_due('2026-11-02', '2026-12-02') <> '2026-11-25' THEN RAISE EXCEPTION 'FAIL office due 5 %', correction_office_due('2026-11-02', '2026-12-02'); END IF;
  IF correction_office_due('2026-11-02', '2026-11-09') <> '2026-11-05' THEN RAISE EXCEPTION 'FAIL office due 2'; END IF;
  RAISE NOTICE 'PASS deadline math';
END $$;

-- 대표: 회차 등록·항목·요청
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o correction_orders; v_item uuid; n int; BEGIN
  BEGIN
    PERFORM create_correction_order('test-lawyer-r1', 'test-req-r', '{"period_kind":"days","period_days":14}');
    RAISE EXCEPTION 'FAIL served_on optional';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := create_correction_order('test-lawyer-r1', 'test-req-r', '{"served_on":"2026-10-02","period_kind":"days","period_days":14,"source_file_id":"test-file-src"}');
  -- 송달~기한 14일 → 5영업일 전, 10-09(한글날) 건너뜀 → 10-08
  IF o.round <> 1 OR o.court_due <> '2026-10-16' OR o.office_due <> '2026-10-08' THEN RAISE EXCEPTION 'FAIL order %', o; END IF;
  INSERT INTO correction_items (order_id, office_id, case_key, seq, label, original_text, category, owner, client_title, table_type, status)
  VALUES (o.id, 'x', 'x', 1, '1', '보험 가입 내역', '보험', 'client', '가입한 보험의 해약환급금 자료', 'T3', 'confirmed') RETURNING id INTO v_item;
  IF (SELECT status FROM correction_items WHERE id = v_item) <> 'draft' OR (SELECT office_id FROM correction_items WHERE id = v_item) <> 'test-lawyer-r1' THEN
    RAISE EXCEPTION 'FAIL item guard';
  END IF;
  INSERT INTO correction_items (order_id, office_id, case_key, seq, label, category, owner, client_title, answer_text)
  VALUES (o.id, 'x', 'x', 2, '2', '변제계획안 수정', 'office', '변제계획안 수정', 'TEST 사무소 문안');
  BEGIN
    UPDATE correction_items SET status = 'confirmed' WHERE id = v_item;
    RAISE EXCEPTION 'FAIL direct status change';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  n := request_correction_items(o.id);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL request count %', n; END IF;
  RAISE NOTICE 'PASS order + items + request';
END $$;
RESET ROLE;

-- 다른 사무소: 못 봄 / 사무 직원(correction.manage 없음): 등록 못 함
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM correction_orders) OR EXISTS (SELECT 1 FROM correction_items) THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  RAISE NOTICE 'PASS cross office hidden';
END $$;
RESET ROLE;

-- 의뢰인: 요청된 내 몫만, 사무소 문안 안 보임, 답·파일 연결·보내기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; v_item uuid; r jsonb; BEGIN
  IF EXISTS (SELECT 1 FROM correction_items) THEN RAISE EXCEPTION 'FAIL client reads items table'; END IF;
  v := client_correction_view('test-req-r');
  IF jsonb_array_length(v) <> 1 OR jsonb_array_length(v -> 0 -> 'items') <> 1 OR (v::text LIKE '%TEST 사무소 문안%') THEN RAISE EXCEPTION 'FAIL client view %', v; END IF;
  IF v -> 0 ->> 'source_file_id' <> 'test-file-src' THEN RAISE EXCEPTION 'FAIL source visible'; END IF;
  v_item := (v -> 0 -> 'items' -> 0 ->> 'id')::uuid;
  r := client_correction_respond(v_item, 'save', '{"table_rows":[{"회사":"TEST생명"}],"file_ids":["test-file-r1","test-file-src"]}');
  IF r ->> 'status' <> 'in_progress' OR r -> 'file_ids' <> '["test-file-r1"]'::jsonb THEN RAISE EXCEPTION 'FAIL save %', r; END IF;
  r := client_correction_respond(v_item, 'submit', '{}');
  IF r ->> 'status' <> 'submitted' THEN RAISE EXCEPTION 'FAIL submit'; END IF;
  RAISE NOTICE 'PASS client sees own items, links own files only, submits';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000c3' AND kind = 'correction_request')
     OR NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000c1' AND kind = 'correction_client_reply') THEN
    RAISE EXCEPTION 'FAIL notifications';
  END IF;
  RAISE NOTICE 'PASS notifications both ways';
END $$;

-- 대표: 보완 요청 → 의뢰인 다시 보냄 → 확인(소명자료 번호) → 사무 직원은 제출 못 함 → 대표 제출 → 잠금
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_item uuid; it correction_items; BEGIN
  SELECT id INTO v_item FROM correction_items WHERE label = '1';
  BEGIN
    PERFORM review_correction_item(v_item, 'needs_fix', '');
    RAISE EXCEPTION 'FAIL fix without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM review_correction_item(v_item, 'needs_fix', 'TEST 해약환급금 증명서가 빠졌어요');
  RAISE NOTICE 'PASS needs_fix';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v jsonb; BEGIN
  v := client_correction_view('test-req-r');
  IF v -> 0 -> 'items' -> 0 ->> 'fix_reason' NOT LIKE '%빠졌어요%' THEN RAISE EXCEPTION 'FAIL fix reason shown'; END IF;
  PERFORM client_correction_respond((v -> 0 -> 'items' -> 0 ->> 'id')::uuid, 'submit', '{}');
  RAISE NOTICE 'PASS client sees fix reason and resubmits';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_item uuid; it correction_items; o uuid; BEGIN
  SELECT id, order_id INTO v_item, o FROM correction_items WHERE label = '1';
  it := review_correction_item(v_item, 'confirm', NULL, 'TEST 보험 해약환급금');
  IF it.exhibit_numbers <> ARRAY[1] OR NOT EXISTS (SELECT 1 FROM case_exhibits WHERE number = 1 AND file_id = 'test-file-r1') THEN RAISE EXCEPTION 'FAIL exhibit'; END IF;
  IF (SELECT items_open FROM office_correction_overview('test-lawyer-r1') LIMIT 1) <> 1 THEN RAISE EXCEPTION 'FAIL overview'; END IF;
  RAISE NOTICE 'PASS confirm numbers exhibit + overview';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o uuid; BEGIN
  SELECT id INTO o FROM correction_orders LIMIT 1;
  BEGIN
    PERFORM submit_correction_order(o, '2026-10-10');
    RAISE EXCEPTION 'FAIL clerk submits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS clerk cannot finalize';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o uuid; BEGIN
  SELECT id INTO o FROM correction_orders LIMIT 1;
  PERFORM submit_correction_order(o, '2026-10-10');
  BEGIN
    UPDATE correction_orders SET court_name = 'X' WHERE id = o;
    RAISE EXCEPTION 'FAIL edit after submit';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE correction_orders SET client_can_view_brief = false WHERE id = o;
  BEGIN
    UPDATE correction_items SET answer_text = 'x' WHERE order_id = o;
    RAISE EXCEPTION 'FAIL item edit after submit';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS submit locks order + items, visibility toggle allowed';
END $$;
RESET ROLE;

ROLLBACK;
