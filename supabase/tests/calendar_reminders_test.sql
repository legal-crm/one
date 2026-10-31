-- 일정 알림 발송 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_owner_cal1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'test_owner_cal2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cal1', 'TEST_CAL1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test-lawyer-cal1', 'cal1', true);

-- 대표가 일정 3개를 만든다: 내일 10:00 '하루 전', 오늘 10:30 '30분 전'(반복 매주, 기준일 1주 전), 알림 없음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  INSERT INTO calendar_events (id, tenant_id, title, date, "time", visibility, assigned_staff_id, data) VALUES
    ('test-cal-a', 'test-lawyer-cal1', 'TEST A', (v_today + 1)::text, '10:00', 'personal', 'test-lawyer-cal1',
      jsonb_build_object('reminder', '1day', 'recurrence', 'none', 'createdBy', 'test-lawyer-cal1', 'ownerUserId', '00000000-0000-4000-8000-0000000000d2')),
    ('test-cal-b', 'test-lawyer-cal1', 'TEST B', (v_today - 7)::text, '10:30', 'personal', 'test-lawyer-cal1',
      jsonb_build_object('reminder', '30min', 'recurrence', 'weekly', 'createdBy', 'test-lawyer-cal1')),
    ('test-cal-c', 'test-lawyer-cal1', 'TEST C', v_today::text, '10:00', 'personal', 'test-lawyer-cal1',
      jsonb_build_object('reminder', 'none', 'recurrence', 'none'));
  -- 브라우저가 보낸 ownerUserId는 서버가 로그인 계정으로 바꾼다
  IF (SELECT data->>'ownerUserId' FROM calendar_events WHERE id = 'test-cal-a') <> '00000000-0000-4000-8000-0000000000d1' THEN
    RAISE EXCEPTION 'FAIL owner stamp';
  END IF;
  UPDATE calendar_events SET data = data || '{"ownerUserId":"00000000-0000-4000-8000-0000000000d2"}' WHERE id = 'test-cal-b';
  IF (SELECT data->>'ownerUserId' FROM calendar_events WHERE id = 'test-cal-b') <> '00000000-0000-4000-8000-0000000000d1' THEN
    RAISE EXCEPTION 'FAIL owner kept on update';
  END IF;
  BEGIN
    PERFORM calendar_dispatch_reminders();
    RAISE EXCEPTION 'FAIL user can dispatch';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS owner stamp + dispatch blocked for users';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

-- 반복 판정
DO $$ BEGIN
  IF NOT calendar_occurs_on('2026-01-31', 'monthly', '2026-02-28') THEN RAISE EXCEPTION 'FAIL monthly clamp'; END IF;
  IF calendar_occurs_on('2026-01-31', 'monthly', '2026-02-27') THEN RAISE EXCEPTION 'FAIL monthly wrong day'; END IF;
  IF NOT calendar_occurs_on('2026-01-05', 'biweekly', '2026-01-19') THEN RAISE EXCEPTION 'FAIL biweekly'; END IF;
  IF calendar_occurs_on('2026-01-05', 'weekly', '2026-01-04') THEN RAISE EXCEPTION 'FAIL before base'; END IF;
  RAISE NOTICE 'PASS recurrence';
END $$;

-- 보내기: 오늘 10:00 KST(= A 하루 전, B 30분 전) 직후 → 2건, 다시 돌리면 0건
DO $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_at timestamptz := ((v_today::text || ' 10:02')::timestamp AT TIME ZONE 'Asia/Seoul');
  n integer;
BEGIN
  n := calendar_dispatch_reminders(v_at);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL dispatch count %', n; END IF;
  IF calendar_dispatch_reminders(v_at + interval '5 minutes') <> 0 THEN RAISE EXCEPTION 'FAIL duplicate'; END IF;
  IF (SELECT count(*) FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000d1' AND kind = 'calendar_reminder') <> 2 THEN
    RAISE EXCEPTION 'FAIL notifications';
  END IF;
  -- 알림 글에 일정 제목이 없다
  IF EXISTS (SELECT 1 FROM user_notifications WHERE kind = 'calendar_reminder' AND (title LIKE '%TEST%' OR body LIKE '%TEST%')) THEN
    RAISE EXCEPTION 'FAIL title leaked';
  END IF;
  -- 너무 늦으면(15분 넘게) 보내지 않는다
  DELETE FROM calendar_reminder_log;
  IF calendar_dispatch_reminders(v_at + interval '40 minutes') <> 0 THEN RAISE EXCEPTION 'FAIL late window'; END IF;
  RAISE NOTICE 'PASS dispatch';
END $$;

ROLLBACK;
