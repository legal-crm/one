-- 상담 예약 시험 (NF-3, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000b5b0', 'test_client_bk0@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b5b1', 'test_owner_bk1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b5b2', 'test_owner_bk2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
SELECT 'test-lawyer-bk' || n, 'TEST_BK' || n, 'TEST 사무소 BK' || n, '서울', 'https://example.test/bk.webp', '["개인회생"]'::jsonb,
       repeat('개인회생과 파산 상담을 합니다. ', 4)
FROM generate_series(1, 2) n;
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
SELECT ('00000000-0000-4000-8000-00000000b5b' || n)::uuid, 'test-lawyer-bk' || n, 'bk' || n, true FROM generate_series(1, 2) n;
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile, selected_lawyer_ids)
VALUES ('test-req-bk1', '00000000-0000-4000-8000-00000000b5b0', 'TEST가명_bk', 'responding', '{"debtTotal":5000}', '["test-lawyer-bk1"]');
INSERT INTO consult_request_lawyers (request_id, lawyer_id, client_id, status, respond_by, consent_version)
VALUES ('test-req-bk1', 'test-lawyer-bk1', '00000000-0000-4000-8000-00000000b5b0', 'reviewing', now() + interval '2 days', 'v1');

-- 사무소 bk1: 시간 제안
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  BEGIN
    PERFORM office_propose_consult_booking('test-req-bk1', 'phone', ARRAY[now() - interval '1 hour']);
    RAISE EXCEPTION 'FAIL past slot accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM office_propose_consult_booking('test-req-bk1', 'phone',
      ARRAY[now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days']);
    RAISE EXCEPTION 'FAIL four slots accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM office_propose_consult_booking('test-req-bk1', 'video', ARRAY[now() + interval '1 day'], 30, 'http://meet.example.test/x');
    RAISE EXCEPTION 'FAIL http link accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := office_propose_consult_booking('test-req-bk1', 'phone',
         ARRAY[date_trunc('minute', now() + interval '2 days'), date_trunc('minute', now() + interval '1 day')], 30, NULL, NULL, 'TEST 메모');
  IF o ->> 'status' <> 'proposed' OR jsonb_array_length(o -> 'slots') <> 2 OR o ->> 'proposed_by' <> 'office' THEN RAISE EXCEPTION 'FAIL propose %', o; END IF;
  IF (o -> 'slots' ->> 0)::timestamptz > (o -> 'slots' ->> 1)::timestamptz THEN RAISE EXCEPTION 'FAIL slots not sorted'; END IF;
  BEGIN
    PERFORM 1 FROM consult_bookings;
    RAISE EXCEPTION 'FAIL direct table read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office proposes (slot rules, https link, sorted, no direct table access)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-00000000b5b0' AND kind = 'consult_booking_proposed') THEN
    RAISE EXCEPTION 'FAIL client not notified';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM consult_messages WHERE consult_request_id = 'test-req-bk1' AND sender_type = 'system'
                   AND target_lawyer_id = 'test-lawyer-bk1' AND message LIKE '%상담 시간을 제안했어요%') THEN
    RAISE EXCEPTION 'FAIL chat notice';
  END IF;
  RAISE NOTICE 'PASS client notified + chat notice';
END $$;

-- 다른 사무소 bk2: 못 보고 못 제안
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM office_propose_consult_booking('test-req-bk1', 'phone', ARRAY[now() + interval '1 day']);
    RAISE EXCEPTION 'FAIL other office proposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM consult_bookings_for_request('test-req-bk1');
    RAISE EXCEPTION 'FAIL other office read bookings';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

-- 의뢰인: 고르기 → 확정 → 사무소 일정·알림
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; b jsonb; BEGIN
  o := consult_bookings_for_request('test-req-bk1');
  IF jsonb_array_length(o) <> 1 THEN RAISE EXCEPTION 'FAIL client list %', o; END IF;
  b := o -> 0;
  BEGIN
    PERFORM respond_consult_booking((b ->> 'id')::uuid, 'confirm', now() + interval '5 days');
    RAISE EXCEPTION 'FAIL confirm with other time';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM respond_consult_booking((b ->> 'id')::uuid, 'confirm', (b -> 'slots' ->> 0)::timestamptz, NULL, '123');
    RAISE EXCEPTION 'FAIL bad phone';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := respond_consult_booking((b ->> 'id')::uuid, 'confirm', (b -> 'slots' ->> 0)::timestamptz, NULL, '010-1234-5678');
  IF o ->> 'status' <> 'confirmed' OR (o ->> 'in_calendar')::boolean IS NOT TRUE OR o ->> 'client_phone' <> '010-1234-5678' THEN
    RAISE EXCEPTION 'FAIL confirm %', o;
  END IF;
  RAISE NOTICE 'PASS client confirms one of the proposed times';
END $$;
RESET ROLE;
DO $$ DECLARE v_office text; BEGIN
  SELECT office_id INTO v_office FROM office_members WHERE lawyer_id = 'test-lawyer-bk1' AND status = 'active' LIMIT 1;
  IF (SELECT count(*) FROM calendar_events WHERE tenant_id = v_office AND category = 'consult' AND id LIKE 'booking-%' AND visibility = 'firm') <> 1 THEN
    RAISE EXCEPTION 'FAIL calendar event';
  END IF;
  IF EXISTS (SELECT 1 FROM calendar_events WHERE tenant_id = v_office AND (title LIKE '%010%' OR memo LIKE '%010%')) THEN
    RAISE EXCEPTION 'FAIL phone leaked into calendar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-00000000b5b1' AND kind = 'consult_booking_confirmed') THEN
    RAISE EXCEPTION 'FAIL office not notified of confirm';
  END IF;
  RAISE NOTICE 'PASS calendar (firm, no phone) + office notified';
END $$;

-- 사무소: 다시 제안 → 의뢰인 확정 → 이전 확정은 '시간 바꿈'으로 닫히고 일정도 바뀜
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT office_propose_consult_booking('test-req-bk1', 'video', ARRAY[date_trunc('minute', now() + interval '3 days')], 40, 'https://meet.example.test/abc');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; b jsonb; BEGIN
  SELECT e INTO b FROM jsonb_array_elements(consult_bookings_for_request('test-req-bk1')) e WHERE e ->> 'status' = 'proposed';
  o := respond_consult_booking((b ->> 'id')::uuid, 'confirm', (b -> 'slots' ->> 0)::timestamptz);
  IF o ->> 'status' <> 'confirmed' OR o ->> 'meeting_link' <> 'https://meet.example.test/abc' THEN RAISE EXCEPTION 'FAIL reschedule confirm %', o; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(consult_bookings_for_request('test-req-bk1')) e
      WHERE e ->> 'status' = 'cancelled' AND e ->> 'close_reason' = 'rescheduled') <> 1 THEN
    RAISE EXCEPTION 'FAIL old booking not rescheduled';
  END IF;
  BEGIN
    PERFORM respond_consult_booking((b ->> 'id')::uuid, 'confirm', (b -> 'slots' ->> 0)::timestamptz);
    RAISE EXCEPTION 'FAIL double confirm';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS reschedule replaces the earlier confirmed booking';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM calendar_events WHERE id LIKE 'booking-%' AND client_name = 'TEST가명_bk') <> 1 THEN
    RAISE EXCEPTION 'FAIL calendar after reschedule %', (SELECT count(*) FROM calendar_events WHERE id LIKE 'booking-%' AND client_name = 'TEST가명_bk');
  END IF;
  RAISE NOTICE 'PASS one calendar event after reschedule';
END $$;

-- 알림: 전날 → 1시간 전, 한 번씩만 (정기 작업처럼 로그인 정보 없이)
SELECT set_config('request.jwt.claims', '', true);
DO $$ DECLARE n integer; BEGIN
  UPDATE consult_bookings SET chosen_at = now() + interval '12 hours' WHERE request_id = 'test-req-bk1' AND status = 'confirmed';
  n := consult_booking_reminders();
  IF n < 1 THEN RAISE EXCEPTION 'FAIL day reminder %', n; END IF;
  IF consult_booking_reminders() <> 0 THEN RAISE EXCEPTION 'FAIL day reminder repeated'; END IF;
  UPDATE consult_bookings SET chosen_at = now() + interval '30 minutes' WHERE request_id = 'test-req-bk1' AND status = 'confirmed';
  IF consult_booking_reminders() < 1 THEN RAISE EXCEPTION 'FAIL hour reminder'; END IF;
  IF consult_booking_reminders() <> 0 THEN RAISE EXCEPTION 'FAIL hour reminder repeated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-00000000b5b0' AND kind = 'consult_booking_reminder') THEN
    RAISE EXCEPTION 'FAIL client reminder';
  END IF;
  RAISE NOTICE 'PASS reminders once each';
END $$;

-- 자리가 닫히면 예약도 닫히고 일정에서 빠진다 → 그 뒤 의뢰인 제안은 거절
DO $$ BEGIN
  UPDATE consult_request_lawyers SET status = 'declined', closed_at = now(), close_reason = 'declined'
   WHERE request_id = 'test-req-bk1' AND lawyer_id = 'test-lawyer-bk1';
  UPDATE consult_requests SET selected_lawyer_ids = '[]' WHERE id = 'test-req-bk1';
  IF EXISTS (SELECT 1 FROM consult_bookings WHERE request_id = 'test-req-bk1' AND status IN ('proposed', 'confirmed')) THEN
    RAISE EXCEPTION 'FAIL open booking after seat closed';
  END IF;
  IF EXISTS (SELECT 1 FROM calendar_events WHERE id LIKE 'booking-%' AND client_name = 'TEST가명_bk') THEN
    RAISE EXCEPTION 'FAIL calendar kept after seat closed';
  END IF;
  RAISE NOTICE 'PASS seat close cancels bookings';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM client_propose_consult_booking('test-req-bk1', 'test-lawyer-bk1', 'phone', ARRAY[now() + interval '1 day']);
    RAISE EXCEPTION 'FAIL client proposed to closed seat';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM client_propose_consult_booking('test-req-bk1', 'test-lawyer-bk2', 'phone', ARRAY[now() + interval '1 day']);
    RAISE EXCEPTION 'FAIL client proposed to unrelated lawyer';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS client cannot book closed or unrelated lawyers';
END $$;
RESET ROLE;

-- 의뢰인이 먼저 보내기 → 사무소 확정 (새 자리)
INSERT INTO consult_request_lawyers (request_id, lawyer_id, client_id, status, respond_by, consent_version)
VALUES ('test-req-bk1', 'test-lawyer-bk2', '00000000-0000-4000-8000-00000000b5b0', 'reviewing', now() + interval '2 days', 'v1');
UPDATE consult_requests SET selected_lawyer_ids = '["test-lawyer-bk2"]' WHERE id = 'test-req-bk1';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT client_propose_consult_booking('test-req-bk1', 'test-lawyer-bk2', 'visit', ARRAY[date_trunc('minute', now() + interval '2 days')], 'TEST 오후가 좋아요');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b5b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; b jsonb; BEGIN
  o := consult_bookings_for_request('test-req-bk1');
  IF jsonb_array_length(o) <> 1 THEN RAISE EXCEPTION 'FAIL office sees only own office bookings %', jsonb_array_length(o); END IF;
  b := o -> 0;
  BEGIN
    PERFORM respond_consult_booking((b ->> 'id')::uuid, 'withdraw');
    RAISE EXCEPTION 'FAIL office withdrew client proposal';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  o := respond_consult_booking((b ->> 'id')::uuid, 'confirm', (b -> 'slots' ->> 0)::timestamptz);
  IF o ->> 'status' <> 'confirmed' OR o ->> 'confirmed_by' <> 'office' THEN RAISE EXCEPTION 'FAIL office confirm %', o; END IF;
  o := update_consult_booking_details((b ->> 'id')::uuid, NULL, 'TEST 3층 상담실');
  IF o ->> 'place_note' <> 'TEST 3층 상담실' THEN RAISE EXCEPTION 'FAIL place note %', o; END IF;
  o := respond_consult_booking((b ->> 'id')::uuid, 'cancel', NULL, 'TEST 일정 겹침');
  IF o ->> 'status' <> 'cancelled' OR o ->> 'close_reason' <> 'cancelled_by_office' THEN RAISE EXCEPTION 'FAIL office cancel %', o; END IF;
  RAISE NOTICE 'PASS client-first proposal, office confirm, details, cancel';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-00000000b5b2' AND kind = 'consult_booking_requested') THEN
    RAISE EXCEPTION 'FAIL office not notified of client request';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-00000000b5b0' AND kind = 'consult_booking_cancelled') THEN
    RAISE EXCEPTION 'FAIL client not notified of cancel';
  END IF;
  IF EXISTS (SELECT 1 FROM calendar_events WHERE id LIKE 'booking-%' AND client_name = 'TEST가명_bk') THEN
    RAISE EXCEPTION 'FAIL calendar kept after cancel';
  END IF;
  RAISE NOTICE 'PASS notices + calendar removed after cancel';
END $$;
ROLLBACK;
