-- 상담 예약 (NF-3, 출시 직후)
-- 무엇: 상담 요청을 받은 사무소가 "이 시간 어때요?"(최대 3개)를 보내거나, 의뢰인이 편한 시간(최대 3개)을 골라 보낸다.
--       상대가 하나를 고르면 확정 → 사무소 일정(calendar_events, '상담 일정')에 들어가고 양쪽에 알림,
--       전날·1시간 전 알림. 영상 상담은 사무소가 쓰는 외부 회의 링크를 붙인다(자체 영상 기능 없음).
-- 규칙:
--  * 상담료 결제는 플랫폼에서 받지 않는다. 예약 수·불참을 변호사 노출 순서나 광고에 쓰지 않는다(집계 함수 없음)
--  * 자리(consult_request_lawyers)가 열려 있는 변호사만 예약할 수 있다. 거절·기한 지남·다른 변호사 확정이면 열린 예약도 닫힌다
--  * 전화번호는 의뢰인이 그 예약에 직접 적은 경우에만 그 사무소에 보인다(계약 전 연락처 공개 규칙과 같음)
--  * 표 직접 접근 없음. 읽기·쓰기는 아래 함수만
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consult_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL REFERENCES public.consult_requests(id) ON DELETE CASCADE,
  lawyer_id text NOT NULL CHECK (char_length(lawyer_id) BETWEEN 1 AND 120),
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  proposed_by text NOT NULL CHECK (proposed_by IN ('office', 'client')),
  proposed_by_user uuid,
  method text NOT NULL CHECK (method IN ('phone', 'video', 'visit')),
  slots timestamptz[] NOT NULL CHECK (cardinality(slots) BETWEEN 1 AND 3),
  duration_min integer NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 10 AND 180),
  meeting_link text CHECK (meeting_link IS NULL OR (char_length(meeting_link) <= 300 AND meeting_link ~ '^https://[^[:space:]]{4,}$')),
  place_note text CHECK (place_note IS NULL OR char_length(place_note) <= 200),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  client_phone text CHECK (client_phone IS NULL OR client_phone ~ '^0[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$'),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'declined', 'cancelled')),
  chosen_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text CHECK (confirmed_by IS NULL OR confirmed_by IN ('office', 'client')),
  closed_at timestamptz,
  close_reason text CHECK (close_reason IS NULL OR close_reason IN
    ('replaced', 'rescheduled', 'declined', 'withdrawn', 'cancelled_by_office', 'cancelled_by_client', 'consult_closed')),
  cancel_note text CHECK (cancel_note IS NULL OR char_length(cancel_note) <= 200),
  calendar_event_id text,
  reminded_day_at timestamptz,
  reminded_hour_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consult_bookings_confirmed_has_time CHECK (status <> 'confirmed' OR chosen_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS consult_bookings_request_idx ON public.consult_bookings (request_id, lawyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consult_bookings_upcoming_idx ON public.consult_bookings (chosen_at) WHERE status = 'confirmed';
ALTER TABLE public.consult_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consult_bookings FROM anon, authenticated;

-- ── 도움 함수 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consult_booking_time_label(p_ts timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(p_ts AT TIME ZONE 'Asia/Seoul', 'FMMM"월 "FMDD"일"')
      || '(' || (ARRAY['일', '월', '화', '수', '목', '금', '토'])[extract(dow FROM p_ts AT TIME ZONE 'Asia/Seoul')::int + 1] || ') '
      || to_char(p_ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI');
$$;

CREATE OR REPLACE FUNCTION public.consult_booking_method_label(p_method text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_method WHEN 'phone' THEN '전화' WHEN 'video' THEN '화상' WHEN 'visit' THEN '사무소 방문' ELSE '상담' END;
$$;

-- 1~3개, 겹치지 않게, 30분 뒤 ~ 60일 안, 시간순
CREATE OR REPLACE FUNCTION public.consult_booking_clean_slots(p_slots timestamptz[])
RETURNS timestamptz[] LANGUAGE plpgsql STABLE AS $$
DECLARE v timestamptz[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT date_trunc('minute', s) ORDER BY date_trunc('minute', s)), '{}')
    INTO v FROM unnest(coalesce(p_slots, '{}')) s WHERE s IS NOT NULL;
  IF cardinality(v) < 1 OR cardinality(v) > 3 THEN
    RAISE EXCEPTION 'choose 1 to 3 times' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v) s WHERE s < now() + interval '30 minutes' OR s > now() + interval '60 days') THEN
    RAISE EXCEPTION 'times must be between 30 minutes and 60 days from now' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

-- 이 변호사가 이 요청에서 아직 상담할 수 있는지 (자리 열림 또는 확정된 상담 변호사)
CREATE OR REPLACE FUNCTION public.consult_booking_seat_open(p_req public.consult_requests, p_lawyer_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- (NULL 이 나오면 IF NOT … 검사를 건너뛰므로 늘 true/false 로)
  SELECT coalesce(p_lawyer_id IS NOT NULL AND coalesce(p_req.status, '') NOT IN ('cancelled', 'closed') AND (
       EXISTS (SELECT 1 FROM consult_request_lawyers l
               WHERE l.request_id = p_req.id AND l.lawyer_id = p_lawyer_id AND l.status IN ('requested', 'reviewing', 'proposed', 'chosen'))
    OR p_req.selected_lawyer_id IS NOT DISTINCT FROM p_lawyer_id), false);
$$;
REVOKE ALL ON FUNCTION public.consult_booking_seat_open(public.consult_requests, text) FROM PUBLIC, anon, authenticated;

-- 변호사가 속한 사무소 (로그인한 사람의 사무소를 먼저)
CREATE OR REPLACE FUNCTION public.consult_booking_lawyer_office(p_lawyer_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.office_id FROM office_members m JOIN offices o ON o.id = m.office_id AND o.status = 'active'
  WHERE m.lawyer_id = p_lawyer_id AND m.status = 'active'
  ORDER BY (m.office_id = ANY (public.current_office_ids())) DESC, (m.role = 'owner') DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_lawyer_office(text) FROM PUBLIC, anon, authenticated;

-- 그 변호사와의 대화에 보이는 안내 한 줄 (의뢰인·사무소 모두 봄)
CREATE OR REPLACE FUNCTION public.consult_booking_message(p_request_id text, p_lawyer_id text, p_text text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, target_lawyer_id, created_at)
  VALUES ('srv-' || gen_random_uuid()::text, p_request_id, 'system', 'system', '시스템 안내', left(p_text, 500), p_lawyer_id, now());
$$;
REVOKE ALL ON FUNCTION public.consult_booking_message(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consult_booking_notify_client(p_b public.consult_bookings, p_kind text, p_title text, p_body text, p_dedupe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_b.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public.notify_user(p_b.client_id::uuid, 'client', NULL, p_kind, p_title, p_body, 'chat', p_b.request_id, p_dedupe);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_notify_client(public.consult_bookings, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consult_booking_notify_office(p_b public.consult_bookings, p_kind text, p_title text, p_body text, p_dedupe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_b.office_id IS NOT NULL THEN
    PERFORM public.notify_office_members(p_b.office_id, 'consult.chat', NULL, p_kind, p_title, p_body, 'consult_request', p_b.request_id, p_dedupe);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_notify_office(public.consult_bookings, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- 확정된 예약 → 사무소 일정 (전체 공유 '상담 일정'). 이름은 가명만, 연락처·채무 정보 없음
CREATE OR REPLACE FUNCTION public.consult_booking_calendar_put(p_b public.consult_bookings)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id text := 'booking-' || p_b.id::text;
  v_local timestamp := p_b.chosen_at AT TIME ZONE 'Asia/Seoul';
  v_alias text;
  v_title text;
  v_memo text;
BEGIN
  IF p_b.office_id IS NULL OR p_b.chosen_at IS NULL THEN RETURN NULL; END IF;
  SELECT public.consult_request_alias(r) INTO v_alias FROM consult_requests r WHERE r.id = p_b.request_id;
  v_title := '상담 예약 · ' || coalesce(v_alias, '의뢰인') || ' (' || public.consult_booking_method_label(p_b.method) || ')';
  v_memo := public.consult_booking_lawyer_name(p_b.lawyer_id) || ' 변호사 · ' || p_b.duration_min || '분'
    || CASE WHEN p_b.method = 'video' AND p_b.meeting_link IS NOT NULL THEN ' · 회의 링크는 상담 채팅의 예약 안내에 있어요' ELSE '' END
    || CASE WHEN p_b.method = 'visit' AND p_b.place_note IS NOT NULL THEN ' · ' || p_b.place_note ELSE '' END;
  INSERT INTO calendar_events (id, tenant_id, title, date, "time", category, client_id, client_name, memo, assigned_staff_id, visibility, data, created_at)
  VALUES (v_id, p_b.office_id, v_title, to_char(v_local, 'YYYY-MM-DD'), to_char(v_local, 'HH24:MI'), 'consult', NULL,
          coalesce(v_alias, ''), v_memo, '', 'firm',
          jsonb_build_object(
            'id', v_id, 'tenantId', p_b.office_id, 'title', v_title, 'date', to_char(v_local, 'YYYY-MM-DD'),
            'startTime', to_char(v_local, 'HH24:MI'), 'endTime', to_char(v_local + make_interval(mins => p_b.duration_min), 'HH24:MI'),
            'type', 'consult', 'visibility', 'firm', 'recurrence', 'none', 'reminder', 'none',
            'description', v_memo, 'clientName', coalesce(v_alias, ''), 'createdBy', '', 'createdByName', '상담 예약',
            'createdByRole', 'SYSTEM', 'createdAt', now(), 'consultBookingId', p_b.id::text, 'consultRequestId', p_b.request_id),
          now())
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, date = EXCLUDED.date, "time" = EXCLUDED."time",
    memo = EXCLUDED.memo, client_name = EXCLUDED.client_name, data = EXCLUDED.data;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consult_booking_lawyer_name(p_lawyer_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.lawyer_short_name(p_lawyer_id);
$$;
REVOKE ALL ON FUNCTION public.consult_booking_lawyer_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consult_booking_calendar_put(public.consult_bookings) FROM PUBLIC, anon, authenticated;

-- 예약 한 건을 닫는다 (일정도 지움)
CREATE OR REPLACE FUNCTION public.consult_booking_close(p_id uuid, p_status text, p_reason text, p_note text)
RETURNS public.consult_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.consult_bookings;
BEGIN
  UPDATE consult_bookings
     SET status = p_status, close_reason = p_reason, cancel_note = nullif(left(btrim(coalesce(p_note, '')), 200), ''),
         closed_at = now(), updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v;
  IF v.calendar_event_id IS NOT NULL THEN
    DELETE FROM calendar_events WHERE id = v.calendar_event_id;
    UPDATE consult_bookings SET calendar_event_id = NULL WHERE id = p_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_close(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- 화면용 한 건 (전화번호는 의뢰인 본인 또는 그 예약의 사무소에만)
CREATE OR REPLACE FUNCTION public.consult_booking_json(p_b public.consult_bookings)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p_b.id, 'request_id', p_b.request_id, 'lawyer_id', p_b.lawyer_id,
    'lawyer_name', public.lawyer_short_name(p_b.lawyer_id),
    'proposed_by', p_b.proposed_by, 'method', p_b.method,
    'slots', to_jsonb(p_b.slots), 'duration_min', p_b.duration_min,
    'meeting_link', p_b.meeting_link, 'place_note', p_b.place_note, 'note', p_b.note,
    'client_phone', p_b.client_phone,
    'status', p_b.status, 'chosen_at', p_b.chosen_at, 'confirmed_at', p_b.confirmed_at, 'confirmed_by', p_b.confirmed_by,
    'close_reason', p_b.close_reason, 'cancel_note', p_b.cancel_note,
    'in_calendar', p_b.calendar_event_id IS NOT NULL,
    'created_at', p_b.created_at, 'updated_at', p_b.updated_at);
$$;
REVOKE ALL ON FUNCTION public.consult_booking_json(public.consult_bookings) FROM PUBLIC, anon, authenticated;

-- 하루에 같은 요청·변호사로 새 제안 10번까지 (실수·장난 방지)
CREATE OR REPLACE FUNCTION public.consult_booking_rate_check(p_request_id text, p_lawyer_id text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM consult_bookings
      WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'too many booking proposals today' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_rate_check(text, text) FROM PUBLIC, anon, authenticated;

-- ── 1. 사무소: "이 시간 어때요?" ───────────────────────────────
CREATE OR REPLACE FUNCTION public.office_propose_consult_booking(
  p_request_id text, p_method text, p_slots timestamptz[], p_duration integer DEFAULT 30,
  p_meeting_link text DEFAULT NULL, p_place_note text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req consult_requests%ROWTYPE;
  v_lid text;
  v_office text;
  v_slots timestamptz[];
  v_b public.consult_bookings;
  v_labels text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'account suspended' USING ERRCODE = '42501'; END IF;
  IF p_method NOT IN ('phone', 'video', 'visit') THEN RAISE EXCEPTION 'unknown consult method' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  v_lid := public.request_viewer_lawyer_id(v_req, 'consult.chat');
  IF v_lid IS NULL THEN RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501'; END IF;
  IF NOT public.consult_booking_seat_open(v_req, v_lid) THEN
    RAISE EXCEPTION 'consultation is closed for this lawyer' USING ERRCODE = '22023';
  END IF;
  v_slots := public.consult_booking_clean_slots(p_slots);
  IF p_meeting_link IS NOT NULL AND btrim(p_meeting_link) <> '' AND (char_length(btrim(p_meeting_link)) > 300 OR btrim(p_meeting_link) !~ '^https://[^[:space:]]{4,}$') THEN
    RAISE EXCEPTION 'meeting link must start with https://' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_note, '') ~ '\d{6}-?[1-4]\d{6}' OR coalesce(p_place_note, '') ~ '\d{6}-?[1-4]\d{6}' THEN
    RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
  END IF;
  PERFORM public.consult_booking_rate_check(p_request_id, v_lid);
  v_office := public.consult_booking_lawyer_office(v_lid);

  -- 답을 기다리던 이전 제안(양쪽)은 새 제안으로 바뀐다
  UPDATE consult_bookings SET status = 'cancelled', close_reason = 'replaced', closed_at = now(), updated_at = now()
   WHERE request_id = p_request_id AND lawyer_id = v_lid AND status = 'proposed';

  INSERT INTO consult_bookings (request_id, lawyer_id, office_id, client_id, proposed_by, proposed_by_user, method, slots,
                                duration_min, meeting_link, place_note, note)
  VALUES (p_request_id, v_lid, v_office, v_req.client_id, 'office', auth.uid(), p_method, v_slots,
          greatest(10, least(180, coalesce(p_duration, 30))),
          nullif(btrim(coalesce(p_meeting_link, '')), ''), nullif(left(btrim(coalesce(p_place_note, '')), 200), ''),
          nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  RETURNING * INTO v_b;

  SELECT string_agg(public.consult_booking_time_label(s), ', ' ORDER BY s) INTO v_labels FROM unnest(v_slots) s;
  PERFORM public.consult_booking_message(p_request_id, v_lid,
    public.lawyer_short_name(v_lid) || ' 변호사님이 ' || public.consult_booking_method_label(p_method) || ' 상담 시간을 제안했어요: '
    || v_labels || '. 위쪽 상담 예약 안내에서 편한 시간을 골라 주세요.');
  PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_proposed', '상담 시간 제안이 왔어요',
    public.lawyer_short_name(v_lid) || ' 변호사님이 상담 시간을 제안했어요. 편한 시간을 골라 주세요.', 'booking:' || v_b.id);
  RETURN public.consult_booking_json(v_b);
END;
$$;
REVOKE ALL ON FUNCTION public.office_propose_consult_booking(text, text, timestamptz[], integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_propose_consult_booking(text, text, timestamptz[], integer, text, text, text) TO authenticated;

-- ── 2. 의뢰인: 편한 시간 보내기 ───────────────────────────────
CREATE OR REPLACE FUNCTION public.client_propose_consult_booking(
  p_request_id text, p_lawyer_id text, p_method text, p_slots timestamptz[],
  p_note text DEFAULT NULL, p_client_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_req consult_requests%ROWTYPE;
  v_slots timestamptz[];
  v_b public.consult_bookings;
  v_labels text;
  v_phone text := nullif(btrim(coalesce(p_client_phone, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'account suspended' USING ERRCODE = '42501'; END IF;
  IF p_method NOT IN ('phone', 'video', 'visit') THEN RAISE EXCEPTION 'unknown consult method' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id AND client_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(p_lawyer_id, '') = '' OR NOT public.consult_booking_seat_open(v_req, p_lawyer_id) THEN
    RAISE EXCEPTION 'consultation is closed for this lawyer' USING ERRCODE = '22023';
  END IF;
  v_slots := public.consult_booking_clean_slots(p_slots);
  IF v_phone IS NOT NULL AND v_phone !~ '^0[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$' THEN
    RAISE EXCEPTION 'invalid client phone' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_note, '') ~ '\d{6}-?[1-4]\d{6}' THEN
    RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
  END IF;
  PERFORM public.consult_booking_rate_check(p_request_id, p_lawyer_id);

  UPDATE consult_bookings SET status = 'cancelled', close_reason = 'replaced', closed_at = now(), updated_at = now()
   WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id AND status = 'proposed';

  INSERT INTO consult_bookings (request_id, lawyer_id, office_id, client_id, proposed_by, proposed_by_user, method, slots, note, client_phone)
  VALUES (p_request_id, p_lawyer_id, public.consult_booking_lawyer_office(p_lawyer_id), v_uid, 'client', auth.uid(), p_method, v_slots,
          nullif(left(btrim(coalesce(p_note, '')), 300), ''), v_phone)
  RETURNING * INTO v_b;

  SELECT string_agg(public.consult_booking_time_label(s), ', ' ORDER BY s) INTO v_labels FROM unnest(v_slots) s;
  PERFORM public.consult_booking_message(p_request_id, p_lawyer_id,
    '의뢰인이 ' || public.consult_booking_method_label(p_method) || ' 상담을 원하는 시간을 보냈어요: ' || v_labels
    || '. 가능한 시간을 골라 확정하거나 다른 시간을 제안해 주세요.');
  PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_requested', '상담 예약 요청이 왔어요',
    public.consult_request_alias(v_req) || '님이 ' || public.consult_booking_method_label(p_method) || ' 상담 시간을 골라 보냈어요.',
    'booking_req:' || v_b.id);
  RETURN public.consult_booking_json(v_b);
END;
$$;
REVOKE ALL ON FUNCTION public.client_propose_consult_booking(text, text, text, timestamptz[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_propose_consult_booking(text, text, text, timestamptz[], text, text) TO authenticated;

-- ── 3. 답하기: 확정(confirm) / 다른 시간 원함(decline) / 내 제안 거두기(withdraw) / 확정 취소(cancel) ──
CREATE OR REPLACE FUNCTION public.respond_consult_booking(
  p_booking_id uuid, p_action text, p_slot timestamptz DEFAULT NULL, p_note text DEFAULT NULL, p_client_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_b public.consult_bookings;
  v_req consult_requests%ROWTYPE;
  v_side text;
  v_slot timestamptz;
  v_old record;
  v_phone text := nullif(btrim(coalesce(p_client_phone, '')), '');
  v_text text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'account suspended' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('confirm', 'decline', 'withdraw', 'cancel') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_b FROM consult_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = v_b.request_id FOR UPDATE;
  IF v_req.client_id = auth.uid()::text THEN
    v_side := 'client';
  ELSIF public.request_viewer_lawyer_id(v_req, 'consult.chat') = v_b.lawyer_id THEN
    v_side := 'office';
  ELSE
    RAISE EXCEPTION 'not allowed for this booking' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_note, '') ~ '\d{6}-?[1-4]\d{6}' THEN
    RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'confirm' THEN
    IF v_b.status <> 'proposed' THEN RAISE EXCEPTION 'booking is not waiting for an answer' USING ERRCODE = '22023'; END IF;
    IF v_side = v_b.proposed_by THEN RAISE EXCEPTION 'the other side must pick a time' USING ERRCODE = '22023'; END IF;
    IF NOT public.consult_booking_seat_open(v_req, v_b.lawyer_id) THEN
      RAISE EXCEPTION 'consultation is closed for this lawyer' USING ERRCODE = '22023';
    END IF;
    v_slot := date_trunc('minute', p_slot);
    IF v_slot IS NULL OR NOT (v_slot = ANY (v_b.slots)) THEN RAISE EXCEPTION 'pick one of the proposed times' USING ERRCODE = '22023'; END IF;
    IF v_slot < now() + interval '10 minutes' THEN RAISE EXCEPTION 'this time has already passed' USING ERRCODE = '22023'; END IF;
    IF v_side = 'client' AND v_phone IS NOT NULL AND v_phone !~ '^0[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$' THEN
      RAISE EXCEPTION 'invalid client phone' USING ERRCODE = '22023';
    END IF;
    -- 같은 변호사와 이미 확정된 앞으로의 예약은 새 시간으로 바뀐다
    FOR v_old IN SELECT id FROM consult_bookings
                 WHERE request_id = v_b.request_id AND lawyer_id = v_b.lawyer_id AND status = 'confirmed' AND id <> v_b.id
    LOOP
      PERFORM public.consult_booking_close(v_old.id, 'cancelled', 'rescheduled', NULL);
    END LOOP;
    UPDATE consult_bookings
       SET status = 'confirmed', chosen_at = v_slot, confirmed_at = now(), confirmed_by = v_side, updated_at = now(),
           client_phone = CASE WHEN v_side = 'client' AND v_phone IS NOT NULL THEN v_phone ELSE client_phone END
     WHERE id = v_b.id RETURNING * INTO v_b;
    UPDATE consult_bookings SET calendar_event_id = public.consult_booking_calendar_put(v_b) WHERE id = v_b.id RETURNING * INTO v_b;
    v_text := public.consult_booking_time_label(v_slot) || ' ' || public.consult_booking_method_label(v_b.method) || ' 상담';
    PERFORM public.consult_booking_message(v_b.request_id, v_b.lawyer_id, '상담 예약이 확정됐어요: ' || v_text || '. 전날과 1시간 전에 알려 드려요.');
    IF v_side = 'client' THEN
      PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_confirmed', '상담 예약이 확정됐어요',
        public.consult_request_alias(v_req) || '님이 ' || v_text || '을 골랐어요. 사무소 일정에 넣었어요.', 'booking_ok:' || v_b.id);
    ELSE
      PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_confirmed', '상담 예약이 확정됐어요',
        public.lawyer_short_name(v_b.lawyer_id) || ' 변호사님과 ' || v_text || '이 확정됐어요.', 'booking_ok:' || v_b.id);
    END IF;

  ELSIF p_action = 'decline' THEN
    IF v_b.status <> 'proposed' THEN RAISE EXCEPTION 'booking is not waiting for an answer' USING ERRCODE = '22023'; END IF;
    IF v_side = v_b.proposed_by THEN RAISE EXCEPTION 'use withdraw for your own proposal' USING ERRCODE = '22023'; END IF;
    v_b := public.consult_booking_close(v_b.id, 'declined', 'declined', p_note);
    PERFORM public.consult_booking_message(v_b.request_id, v_b.lawyer_id,
      CASE WHEN v_side = 'client' THEN '의뢰인이 제안받은 시간이 맞지 않는다고 답했어요.' ELSE '사무소가 보내 주신 시간이 맞지 않는다고 답했어요.' END
      || CASE WHEN v_b.cancel_note IS NOT NULL THEN ' (' || v_b.cancel_note || ')' ELSE '' END
      || ' 다른 시간을 다시 맞춰 주세요.');
    IF v_side = 'client' THEN
      PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_declined', '제안한 상담 시간이 맞지 않대요',
        public.consult_request_alias(v_req) || '님이 다른 시간을 원해요. 다시 제안해 주세요.', 'booking_no:' || v_b.id);
    ELSE
      PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_declined', '보내신 상담 시간이 맞지 않대요',
        public.lawyer_short_name(v_b.lawyer_id) || ' 변호사님 사무소가 다른 시간을 원해요. 채팅을 확인해 주세요.', 'booking_no:' || v_b.id);
    END IF;

  ELSIF p_action = 'withdraw' THEN
    IF v_b.status <> 'proposed' OR v_side <> v_b.proposed_by THEN
      RAISE EXCEPTION 'only your own waiting proposal can be withdrawn' USING ERRCODE = '22023';
    END IF;
    v_b := public.consult_booking_close(v_b.id, 'cancelled', 'withdrawn', p_note);

  ELSE -- cancel
    IF v_b.status <> 'confirmed' THEN RAISE EXCEPTION 'booking is not confirmed' USING ERRCODE = '22023'; END IF;
    IF v_b.chosen_at < now() THEN RAISE EXCEPTION 'this time has already passed' USING ERRCODE = '22023'; END IF;
    v_text := public.consult_booking_time_label(v_b.chosen_at) || ' ' || public.consult_booking_method_label(v_b.method) || ' 상담';
    v_b := public.consult_booking_close(v_b.id, 'cancelled', CASE WHEN v_side = 'client' THEN 'cancelled_by_client' ELSE 'cancelled_by_office' END, p_note);
    PERFORM public.consult_booking_message(v_b.request_id, v_b.lawyer_id,
      CASE WHEN v_side = 'client' THEN '의뢰인이 ' ELSE '사무소가 ' END || v_text || ' 예약을 취소했어요.'
      || CASE WHEN v_b.cancel_note IS NOT NULL THEN ' (' || v_b.cancel_note || ')' ELSE '' END);
    IF v_side = 'client' THEN
      PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_cancelled', '상담 예약이 취소됐어요',
        public.consult_request_alias(v_req) || '님이 ' || v_text || ' 예약을 취소했어요. 일정에서도 뺐어요.', 'booking_cx:' || v_b.id);
    ELSE
      PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_cancelled', '상담 예약이 취소됐어요',
        public.lawyer_short_name(v_b.lawyer_id) || ' 변호사님 사무소가 ' || v_text || ' 예약을 취소했어요. 채팅을 확인해 주세요.', 'booking_cx:' || v_b.id);
    END IF;
  END IF;
  RETURN public.consult_booking_json(v_b);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_consult_booking(uuid, text, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_consult_booking(uuid, text, timestamptz, text, text) TO authenticated;

-- ── 4. 확정 뒤 안내 고치기: 사무소 = 회의 링크·장소 / 의뢰인 = 받을 전화번호 ──
CREATE OR REPLACE FUNCTION public.update_consult_booking_details(
  p_booking_id uuid, p_meeting_link text DEFAULT NULL, p_place_note text DEFAULT NULL, p_client_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_b public.consult_bookings;
  v_req consult_requests%ROWTYPE;
  v_link text := nullif(btrim(coalesce(p_meeting_link, '')), '');
  v_phone text := nullif(btrim(coalesce(p_client_phone, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_b FROM consult_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
  IF v_b.status NOT IN ('proposed', 'confirmed') THEN RAISE EXCEPTION 'booking is closed' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = v_b.request_id;
  IF v_req.client_id = auth.uid()::text THEN
    IF v_phone IS NOT NULL AND v_phone !~ '^0[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$' THEN
      RAISE EXCEPTION 'invalid client phone' USING ERRCODE = '22023';
    END IF;
    UPDATE consult_bookings SET client_phone = v_phone, updated_at = now() WHERE id = v_b.id RETURNING * INTO v_b;
  ELSIF public.request_viewer_lawyer_id(v_req, 'consult.chat') = v_b.lawyer_id THEN
    IF v_link IS NOT NULL AND (char_length(v_link) > 300 OR v_link !~ '^https://[^[:space:]]{4,}$') THEN
      RAISE EXCEPTION 'meeting link must start with https://' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_place_note, '') ~ '\d{6}-?[1-4]\d{6}' THEN
      RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
    END IF;
    UPDATE consult_bookings
       SET meeting_link = v_link, place_note = nullif(left(btrim(coalesce(p_place_note, '')), 200), ''), updated_at = now()
     WHERE id = v_b.id RETURNING * INTO v_b;
    IF v_b.status = 'confirmed' THEN
      PERFORM public.consult_booking_calendar_put(v_b);
      PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_updated', '상담 예약 안내가 바뀌었어요',
        public.lawyer_short_name(v_b.lawyer_id) || ' 변호사님 사무소가 '
        || CASE WHEN v_b.method = 'video' THEN '회의 링크를' ELSE '장소 안내를' END || ' 고쳤어요.', 'booking_upd:' || v_b.id);
    END IF;
  ELSE
    RAISE EXCEPTION 'not allowed for this booking' USING ERRCODE = '42501';
  END IF;
  RETURN public.consult_booking_json(v_b);
END;
$$;
REVOKE ALL ON FUNCTION public.update_consult_booking_details(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_consult_booking_details(uuid, text, text, text) TO authenticated;

-- ── 5. 읽기: 의뢰인은 내 요청 전체 / 사무소는 우리 사무소 예약만 ──
CREATE OR REPLACE FUNCTION public.consult_bookings_for_request(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req consult_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_req.client_id = auth.uid()::text THEN
    RETURN coalesce((SELECT jsonb_agg(public.consult_booking_json(b) ORDER BY b.created_at DESC)
                     FROM (SELECT * FROM consult_bookings WHERE request_id = p_request_id ORDER BY created_at DESC LIMIT 30) b), '[]'::jsonb);
  END IF;
  IF public.request_viewer_lawyer_id(v_req, 'consult.view') IS NULL THEN
    RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(public.consult_booking_json(b) ORDER BY b.created_at DESC)
                   FROM (SELECT * FROM consult_bookings
                         WHERE request_id = p_request_id AND office_id = ANY (public.current_office_ids())
                         ORDER BY created_at DESC LIMIT 30) b), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.consult_bookings_for_request(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consult_bookings_for_request(text) TO authenticated;

-- ── 6. 자리가 닫히면 그 변호사의 열린 예약도 닫는다 ─────────────────
CREATE OR REPLACE FUNCTION public.trg_consult_bookings_follow_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_b public.consult_bookings;
BEGIN
  FOR r IN
    SELECT b.id, b.status, b.chosen_at FROM consult_bookings b
    WHERE b.request_id = NEW.request_id AND b.lawyer_id = NEW.lawyer_id AND b.status IN ('proposed', 'confirmed')
  LOOP
    v_b := public.consult_booking_close(r.id, 'cancelled', 'consult_closed', NULL);
    IF r.status = 'confirmed' AND r.chosen_at > now() THEN
      PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_cancelled', '상담 예약이 취소됐어요',
        '상담 요청이 끝나 확정된 예약을 취소하고 일정에서 뺐어요.', 'booking_cx:' || v_b.id);
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'booking close on seat change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_consult_bookings_follow_seat ON public.consult_request_lawyers;
CREATE TRIGGER trg_consult_bookings_follow_seat AFTER UPDATE OF status ON public.consult_request_lawyers
  FOR EACH ROW WHEN (NEW.status IN ('declined', 'expired', 'withdrawn', 'released') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_consult_bookings_follow_seat();

CREATE OR REPLACE FUNCTION public.trg_consult_bookings_follow_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT b.id FROM consult_bookings b WHERE b.request_id = NEW.id AND b.status IN ('proposed', 'confirmed') LOOP
    PERFORM public.consult_booking_close(r.id, 'cancelled', 'consult_closed', NULL);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'booking close on request close failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_consult_bookings_follow_request ON public.consult_requests;
CREATE TRIGGER trg_consult_bookings_follow_request AFTER UPDATE OF status ON public.consult_requests
  FOR EACH ROW WHEN (NEW.status IN ('cancelled', 'closed') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_consult_bookings_follow_request();

-- 상담 요청이 지워지면 일정에 남은 예약도 지운다 (예약 줄은 FK로 함께 지워짐)
CREATE OR REPLACE FUNCTION public.trg_consult_bookings_drop_calendar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.calendar_event_id IS NOT NULL THEN
    DELETE FROM calendar_events WHERE id = OLD.calendar_event_id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_consult_bookings_drop_calendar ON public.consult_bookings;
CREATE TRIGGER trg_consult_bookings_drop_calendar AFTER DELETE ON public.consult_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_consult_bookings_drop_calendar();

-- ── 7. 전날·1시간 전 알림 (pg_cron 10분) ─────────────────────────
-- 알림 글: 날짜·시각·방식만 (의뢰인 이름·채무 정보 없음)
CREATE OR REPLACE FUNCTION public.consult_booking_reminders(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_b public.consult_bookings;
  v_count integer := 0;
  v_text text;
BEGIN
  -- 전날 (24시간 안, 2시간보다 더 남은 예약)
  FOR v_b IN
    SELECT * FROM consult_bookings
    WHERE status = 'confirmed' AND reminded_day_at IS NULL
      AND chosen_at > p_now + interval '2 hours' AND chosen_at <= p_now + interval '24 hours'
    LIMIT 500
  LOOP
    v_text := public.consult_booking_time_label(v_b.chosen_at) || ' ' || public.consult_booking_method_label(v_b.method) || ' 상담';
    UPDATE consult_bookings SET reminded_day_at = p_now WHERE id = v_b.id;
    PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_reminder', '상담 예약이 다가와요',
      public.lawyer_short_name(v_b.lawyer_id) || ' 변호사님과 ' || v_text || '이 있어요.', 'booking_day:' || v_b.id);
    PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_reminder', '상담 예약이 다가와요',
      v_text || '이 있어요. 상담 채팅에서 예약 안내를 확인하세요.', 'booking_day:' || v_b.id);
    v_count := v_count + 1;
  END LOOP;
  -- 1시간 전 (70분 안)
  FOR v_b IN
    SELECT * FROM consult_bookings
    WHERE status = 'confirmed' AND reminded_hour_at IS NULL
      AND chosen_at > p_now AND chosen_at <= p_now + interval '70 minutes'
    LIMIT 500
  LOOP
    v_text := to_char(v_b.chosen_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') || ' ' || public.consult_booking_method_label(v_b.method) || ' 상담';
    UPDATE consult_bookings SET reminded_hour_at = p_now, reminded_day_at = coalesce(reminded_day_at, p_now) WHERE id = v_b.id;
    PERFORM public.consult_booking_notify_client(v_b, 'consult_booking_reminder', '곧 상담이 시작돼요',
      '오늘 ' || v_text || '이 곧 시작돼요.'
      || CASE WHEN v_b.method = 'video' THEN ' 회의 링크는 상담 채팅에 있어요.' ELSE '' END, 'booking_hour:' || v_b.id);
    PERFORM public.consult_booking_notify_office(v_b, 'consult_booking_reminder', '곧 상담이 시작돼요',
      '오늘 ' || v_text || '이 곧 시작돼요.', 'booking_hour:' || v_b.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_booking_reminders(timestamptz) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mykim_consult_booking_reminders') THEN
    PERFORM cron.unschedule('mykim_consult_booking_reminders');
  END IF;
  PERFORM cron.schedule('mykim_consult_booking_reminders', '*/10 * * * *', 'SELECT public.consult_booking_reminders()');
END $$;
