-- 일정 알림 실제 발송 (T-3·HM): 일정에 고른 알림(시작 시·10분·30분·1시간·하루 전)을 만든 사람에게 보낸다.
-- 경로: pg_cron 5분 → calendar_dispatch_reminders() → notify_user() → user_notifications(종 알림)
--       → 기존 트리거가 사람별 설정에 따라 이메일 대기열(notification_deliveries)에 넣는다.
-- 알림 글에는 일정 제목·의뢰인 이름을 넣지 않는다 (종류와 시각만). 제목은 로그인 후 일정 화면에서 본다.

-- 1. 만든 사람(로그인 계정)을 서버가 기록한다 (브라우저가 보낸 createdBy는 변호사·직원 ID라 계정과 다를 수 있음)
CREATE OR REPLACE FUNCTION public.calendar_events_stamp_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.data := coalesce(NEW.data, '{}'::jsonb) || jsonb_build_object('ownerUserId', auth.uid()::text);
    ELSE
      NEW.data := coalesce(NEW.data, '{}'::jsonb) - 'ownerUserId';
    END IF;
  ELSE
    -- 고쳐도 만든 사람은 그대로
    NEW.data := coalesce(NEW.data, '{}'::jsonb) - 'ownerUserId'
      || CASE WHEN OLD.data ? 'ownerUserId' THEN jsonb_build_object('ownerUserId', OLD.data->>'ownerUserId') ELSE '{}'::jsonb END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS calendar_events_stamp_owner ON public.calendar_events;
CREATE TRIGGER calendar_events_stamp_owner BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_stamp_owner();

-- 2. 반복 일정이 그 날짜에 있는지
CREATE OR REPLACE FUNCTION public.calendar_occurs_on(p_base date, p_rec text, p_day date)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_base IS NULL OR p_day IS NULL OR p_day < p_base THEN false
    WHEN coalesce(p_rec, 'none') = 'none' THEN p_day = p_base
    WHEN p_rec = 'daily' THEN true
    WHEN p_rec = 'weekly' THEN (p_day - p_base) % 7 = 0
    WHEN p_rec = 'biweekly' THEN (p_day - p_base) % 14 = 0
    WHEN p_rec = 'monthly' THEN
      extract(day FROM p_day) = extract(day FROM p_base)
      -- 없는 날짜(31일 등)는 그 달 말일 (화면 expandEventOccurrences와 같은 규칙)
      OR (extract(day FROM p_base) > extract(day FROM (date_trunc('month', p_day) + interval '1 month - 1 day'))
          AND p_day = (date_trunc('month', p_day) + interval '1 month - 1 day')::date)
    ELSE false
  END;
$$;

-- 3. 보낸 기록 (같은 일정·같은 회차는 한 번만)
CREATE TABLE IF NOT EXISTS public.calendar_reminder_log (
  event_id text NOT NULL,
  occurrence date NOT NULL,
  recipient_user_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, occurrence)
);
ALTER TABLE public.calendar_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_reminder_log FROM anon, authenticated;

-- 4. 보내기 (pg_cron 5분마다). p_now는 시험용.
CREATE OR REPLACE FUNCTION public.calendar_dispatch_reminders(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (p_now AT TIME ZONE 'Asia/Seoul')::date;
  r record;
  v_count integer := 0;
  v_recipient uuid;
  v_office text;
  v_label text;
BEGIN
  FOR r IN
    WITH ev AS (
      SELECT e.id, e.tenant_id, e.date, e."time", e.data,
             coalesce(e.data->>'reminder', 'none') AS reminder,
             coalesce(e.data->>'recurrence', 'none') AS recurrence
      FROM public.calendar_events e
      WHERE coalesce(e.data->>'reminder', 'none') IN ('at_time', '10min', '30min', '1hour', '1day')
        AND e.date ~ '^\d{4}-\d{2}-\d{2}$'
    ), cand AS (
      SELECT ev.*, d::date AS occ
      FROM ev, generate_series(v_today, v_today + 1, interval '1 day') AS d
      WHERE public.calendar_occurs_on(ev.date::date, ev.recurrence, d::date)
    ), timed AS (
      SELECT cand.*,
        ((cand.occ::text || ' ' || CASE WHEN cand."time" ~ '^\d{1,2}:\d{2}' THEN substr(cand."time", 1, 5) ELSE '09:00' END)::timestamp
          AT TIME ZONE 'Asia/Seoul')
        - CASE cand.reminder WHEN '10min' THEN interval '10 minutes' WHEN '30min' THEN interval '30 minutes'
            WHEN '1hour' THEN interval '1 hour' WHEN '1day' THEN interval '1 day' ELSE interval '0' END AS fire_at
      FROM cand
    )
    SELECT * FROM timed
    WHERE fire_at <= p_now AND fire_at > p_now - interval '15 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.calendar_reminder_log l WHERE l.event_id = timed.id AND l.occurrence = timed.occ)
    LIMIT 500
  LOOP
    v_recipient := NULL;
    IF coalesce(r.data->>'ownerUserId', '') ~ '^[0-9a-f-]{36}$' THEN
      v_recipient := (r.data->>'ownerUserId')::uuid;
    ELSE
      -- 옛 일정: 만든 사람 ID(변호사·직원 ID)로 사무소 구성원을 찾는다
      SELECT m.user_id INTO v_recipient FROM public.office_members m
      WHERE m.status = 'active' AND (m.lawyer_id = r.data->>'createdBy' OR m.user_id::text = r.data->>'createdBy')
      ORDER BY (m.office_id = r.tenant_id) DESC LIMIT 1;
    END IF;
    -- 정지·탈퇴한 구성원에게는 보내지 않는다
    IF v_recipient IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.office_members m WHERE m.user_id = v_recipient AND m.office_id = r.tenant_id AND m.status <> 'active'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.office_members m WHERE m.user_id = v_recipient AND m.office_id = r.tenant_id AND m.status = 'active'
    ) THEN
      v_recipient := NULL;
    END IF;

    INSERT INTO public.calendar_reminder_log (event_id, occurrence, recipient_user_id) VALUES (r.id, r.occ, v_recipient)
    ON CONFLICT DO NOTHING;
    IF v_recipient IS NULL THEN CONTINUE; END IF;

    SELECT o.id INTO v_office FROM public.offices o WHERE o.id = r.tenant_id;
    v_label := CASE r.reminder WHEN 'at_time' THEN '지금 시작하는' WHEN '10min' THEN '10분 뒤' WHEN '30min' THEN '30분 뒤'
                 WHEN '1hour' THEN '1시간 뒤' ELSE '내일' END;
    PERFORM public.notify_user(
      v_recipient, 'office', v_office, 'calendar_reminder',
      v_label || ' 일정이 있어요',
      to_char(r.occ, 'FMMM"월 "FMDD"일"') || CASE WHEN r."time" ~ '^\d{1,2}:\d{2}' THEN ' ' || substr(r."time", 1, 5) ELSE '' END
        || ' · 일정 화면에서 내용을 확인하세요.',
      'schedule', r.id, 'cal:' || r.id || ':' || r.occ::text
    );
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.calendar_reminder_log WHERE sent_at < p_now - interval '60 days';
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_dispatch_reminders(timestamptz) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mykim_calendar_reminders') THEN
    PERFORM cron.unschedule('mykim_calendar_reminders');
  END IF;
  PERFORM cron.schedule('mykim_calendar_reminders', '*/5 * * * *', 'SELECT public.calendar_dispatch_reminders()');
END $$;
