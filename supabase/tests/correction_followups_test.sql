-- 보정 후속 시험: 연장 신청·결정, 통계, 선례 가림, 내 보정 정리 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_owner_f1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'test_clerk_f2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d3', 'test_client_f3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d4', 'test_self_f4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-f1', 'TEST_F1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test-lawyer-f1', 'f1', true);
INSERT INTO office_members (office_id, user_id, display_name, role, status)
VALUES ('test-lawyer-f1', '00000000-0000-4000-8000-0000000000d2', 'TEST 사무', 'clerk', 'active');
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-f', '00000000-0000-4000-8000-0000000000d3', 'TEST가명F', 'contracted', 'test-lawyer-f1');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o correction_orders; v_item uuid; p correction_precedents; s jsonb; BEGIN
  o := create_correction_order('test-lawyer-f1', 'test-req-f', '{"served_on":"2026-10-02","period_kind":"days","period_days":14,"court_name":"TEST회생법원"}');
  INSERT INTO correction_items (order_id, office_id, case_key, seq, label, category, owner, client_title)
  VALUES (o.id, 'x', 'x', 1, '1', '보험', 'client', 'TEST 보험 자료') RETURNING id INTO v_item;
  PERFORM request_correction_items(o.id);

  BEGIN
    PERFORM record_correction_extension(o.id, 'request', '{"days":20}');
    RAISE EXCEPTION 'FAIL extension without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := record_correction_extension(o.id, 'request', '{"days":20,"note":"TEST 발급 지연","requested_on":"2026-10-10"}');
  IF o.status <> 'extension' OR o.extension_days <> 20 THEN RAISE EXCEPTION 'FAIL request %', o; END IF;
  BEGIN
    PERFORM record_correction_extension(o.id, 'granted', '{"new_due":"2026-10-10"}');
    RAISE EXCEPTION 'FAIL grant earlier due';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := record_correction_extension(o.id, 'granted', '{"new_due":"2026-11-06","decided_on":"2026-10-14"}');
  IF o.status <> 'drafting' OR o.court_due <> '2026-11-06' OR o.original_court_due <> '2026-10-16' OR o.extension_decision <> 'granted' THEN
    RAISE EXCEPTION 'FAIL grant %', o;
  END IF;
  -- 새 기한 기준 사무소 마감도 다시 계산 (5영업일 전)
  IF o.office_due <> '2026-10-30' THEN RAISE EXCEPTION 'FAIL office due after grant %', o.office_due; END IF;
  RAISE NOTICE 'PASS extension request + grant';

  UPDATE correction_items SET answer_text = 'TEST가명F 신청인(2026개회12345)은 010-1234-5678로 연락 가능하며 보험을 제출합니다.' WHERE id = v_item;
  p := save_correction_precedent(v_item, '보험 답변', ARRAY['TEST가명F']);
  IF p.answer_text LIKE '%TEST가명F%' OR p.answer_text LIKE '%12345%' OR p.answer_text LIKE '%5678%' OR p.court_name <> 'TEST회생법원' THEN
    RAISE EXCEPTION 'FAIL precedent mask %', p.answer_text;
  END IF;
  RAISE NOTICE 'PASS precedent masked';

  s := office_correction_stats('test-lawyer-f1');
  IF (s -> 'by_court' -> 0 ->> 'orders')::int <> 1 OR (s -> 'by_court' -> 0 ->> 'extensions')::int <> 1 OR (s -> 'by_category' -> 0 ->> 'category') <> '보험' THEN
    RAISE EXCEPTION 'FAIL stats %', s;
  END IF;
  IF s::text LIKE '%TEST가명F%' OR s::text LIKE '%test-req-f%' THEN RAISE EXCEPTION 'FAIL stats leak'; END IF;
  RAISE NOTICE 'PASS stats';
END $$;
RESET ROLE;

-- 사무 직원(clerk): 선례 저장 불가(변호사 전용)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_item uuid; BEGIN
  SELECT id INTO v_item FROM correction_items LIMIT 1;
  BEGIN
    PERFORM save_correction_precedent(v_item, 'x', '{}');
    RAISE EXCEPTION 'FAIL clerk saved precedent';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS clerk cannot save precedent';
END $$;
RESET ROLE;

-- 나홀로 이용자: 내 보정 정리는 본인만
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v uuid; BEGIN
  INSERT INTO client_self_corrections (user_id, title, items) VALUES ('00000000-0000-4000-8000-0000000000d1', 'TEST 1차 보정', '[{"title":"보험"}]') RETURNING id INTO v;
  IF (SELECT user_id FROM client_self_corrections WHERE id = v) <> '00000000-0000-4000-8000-0000000000d4' THEN RAISE EXCEPTION 'FAIL self owner'; END IF;
  RAISE NOTICE 'PASS self correction own';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM client_self_corrections) THEN RAISE EXCEPTION 'FAIL office reads self correction'; END IF;
  RAISE NOTICE 'PASS self correction hidden from office';
END $$;
RESET ROLE;
ROLLBACK;
