-- 사무소 상담 가능 시간표 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000f6b0', 'test_client_hb0@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000f6b1', 'test_owner_hb1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000f6b2', 'test_owner_hb2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
SELECT 'test-lawyer-hb' || n, 'TEST_HB' || n, 'TEST 사무소 HB' || n, '서울', 'https://example.test/hb.webp', '["개인회생"]'::jsonb,
       repeat('개인회생과 파산 상담을 합니다. ', 4)
FROM generate_series(1, 2) n;
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
SELECT ('00000000-0000-4000-8000-00000000f6b' || n)::uuid, 'test-lawyer-hb' || n, 'hb' || n, true FROM generate_series(1, 2) n;
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile, selected_lawyer_ids)
VALUES ('test-req-hb1', '00000000-0000-4000-8000-00000000f6b0', 'TEST가명_hb', 'responding', '{"debtTotal":5000}', '["test-lawyer-hb1"]');
INSERT INTO consult_request_lawyers (request_id, lawyer_id, client_id, status, respond_by, consent_version)
VALUES ('test-req-hb1', 'test-lawyer-hb1', '00000000-0000-4000-8000-00000000f6b0', 'reviewing', now() + interval '2 days', 'v1');

-- 다른 사무소 대표는 못 바꿈, 잘못된 시간표는 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f6b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_office text; BEGIN
  SELECT office_id INTO v_office FROM office_members WHERE lawyer_id = 'test-lawyer-hb1' LIMIT 1;
  BEGIN
    PERFORM set_office_consult_hours(v_office, '{"weekly":{"1":[["10:00","12:00"]]}}'::jsonb);
    RAISE EXCEPTION 'FAIL other office set hours';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f6b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_office text; h office_consult_hours; BEGIN
  SELECT office_id INTO v_office FROM office_members WHERE lawyer_id = 'test-lawyer-hb1' LIMIT 1;
  BEGIN
    PERFORM set_office_consult_hours(v_office, '{"weekly":{"1":[["12:00","10:00"]]}}'::jsonb);
    RAISE EXCEPTION 'FAIL reversed window';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM set_office_consult_hours(v_office, '{"weekly":{"7":[["10:00","12:00"]]}}'::jsonb);
    RAISE EXCEPTION 'FAIL bad weekday';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- 평일 10~12시, 한 칸 60분, 1시간 뒤부터, 14일, 화상 제외
  h := set_office_consult_hours(v_office, jsonb_build_object(
    'weekly', '{"1":[["10:00","12:00"]],"2":[["10:00","12:00"]],"3":[["10:00","12:00"]],"4":[["10:00","12:00"]],"5":[["10:00","12:00"]]}'::jsonb,
    'slot_minutes', 60, 'lead_hours', 1, 'horizon_days', 14, 'methods', '["phone","visit"]'::jsonb,
    'closed_dates', jsonb_build_array(to_char((now() AT TIME ZONE 'Asia/Seoul')::date + 3, 'YYYY-MM-DD'), '2020-01-01')));
  IF h.slot_minutes <> 60 OR h.methods <> ARRAY['phone', 'visit'] OR cardinality(h.closed_dates) <> 1 THEN RAISE EXCEPTION 'FAIL saved %', row_to_json(h); END IF;
  RAISE NOTICE 'PASS owner saves hours (past closed dates dropped)';
END $$;
RESET ROLE;

-- 의뢰인: 열어 둔 시간 = 평일 10:00·11:00 시작, 공휴일·쉬는 날 없음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f6b0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; s timestamptz; v_closed date := (now() AT TIME ZONE 'Asia/Seoul')::date + 3; BEGIN
  o := consult_open_slots('test-req-hb1', 'test-lawyer-hb1');
  IF (o ->> 'enabled')::boolean IS NOT TRUE OR jsonb_array_length(o -> 'slots') < 4 THEN RAISE EXCEPTION 'FAIL slots %', o; END IF;
  IF o -> 'methods' <> '["phone","visit"]'::jsonb THEN RAISE EXCEPTION 'FAIL methods %', o -> 'methods'; END IF;
  FOR s IN SELECT (e #>> '{}')::timestamptz FROM jsonb_array_elements(o -> 'slots') e LOOP
    IF extract(dow FROM s AT TIME ZONE 'Asia/Seoul') NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'FAIL weekend slot %', s; END IF;
    IF to_char(s AT TIME ZONE 'Asia/Seoul', 'HH24:MI') NOT IN ('10:00', '11:00') THEN RAISE EXCEPTION 'FAIL slot time %', s; END IF;
    IF (s AT TIME ZONE 'Asia/Seoul')::date = v_closed THEN RAISE EXCEPTION 'FAIL closed date slot'; END IF;
    IF EXISTS (SELECT 1 FROM business_holidays b WHERE b.day = (s AT TIME ZONE 'Asia/Seoul')::date) THEN RAISE EXCEPTION 'FAIL holiday slot'; END IF;
    IF s < now() + interval '1 hour' THEN RAISE EXCEPTION 'FAIL lead time'; END IF;
  END LOOP;
  BEGIN
    PERFORM consult_open_slots('test-req-hb1', 'test-lawyer-hb2');
    RAISE EXCEPTION 'FAIL slots for lawyer without seat';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS client sees weekday slots without holidays, closed dates, lead time';
END $$;
RESET ROLE;

-- 확정된 예약 시간은 빠진다
DO $$ DECLARE v_office text; first_slot timestamptz; BEGIN
  SELECT office_id INTO v_office FROM office_members WHERE lawyer_id = 'test-lawyer-hb1' LIMIT 1;
  first_slot := (public.consult_hours_slots(v_office))[1];
  INSERT INTO consult_bookings (request_id, lawyer_id, office_id, client_id, proposed_by, method, slots, duration_min, status, chosen_at, confirmed_at)
  VALUES ('test-req-hb1', 'test-lawyer-hb1', v_office, '00000000-0000-4000-8000-00000000f6b0', 'office', 'phone', ARRAY[first_slot], 30, 'confirmed', first_slot, now());
  IF first_slot = ANY (public.consult_hours_slots(v_office)) THEN RAISE EXCEPTION 'FAIL booked slot still open'; END IF;
  RAISE NOTICE 'PASS confirmed booking removes the slot';
END $$;

-- 사무소 쪽도 같은 함수로 본다 (상담 채팅 권한)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f6b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (consult_open_slots('test-req-hb1') ->> 'enabled')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL office view'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_consult_hours) THEN RAISE EXCEPTION 'FAIL office reads own hours'; END IF;
  RAISE NOTICE 'PASS office view';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f6b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM office_consult_hours) THEN RAISE EXCEPTION 'FAIL other office reads hours'; END IF;
  BEGIN
    PERFORM consult_open_slots('test-req-hb1');
    RAISE EXCEPTION 'FAIL other office slots';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office cannot read';
END $$;
RESET ROLE;
ROLLBACK;
