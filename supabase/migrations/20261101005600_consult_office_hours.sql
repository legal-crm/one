-- 사무소 상담 가능 시간표 (NF-3 나머지)
-- 사무소가 요일별 상담 가능 시간·한 칸 길이·최소 여유(몇 시간 뒤부터)·보여 줄 기간·쉬는 날·받는 방식을 정해 두면,
-- 상담 예약을 보낼 때 의뢰인·사무소 모두 '열어 둔 시간'에서 바로 고를 수 있다 (공휴일·이미 확정된 예약 시간은 뺌).
-- 시간표는 고르기 편하게 하는 것일 뿐, 확정은 지금처럼 상대가 고르는 방식(consult_bookings) 그대로.
-- 읽기: 같은 사무소 구성원(표) / 예약 상대 의뢰인(consult_open_slots 함수, 시간만) · 쓰기: office.settings.edit
-- ============================================================

CREATE TABLE IF NOT EXISTS public.office_consult_hours (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  weekly jsonb NOT NULL DEFAULT '{}'::jsonb,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes IN (20, 30, 40, 60)),
  lead_hours integer NOT NULL DEFAULT 24 CHECK (lead_hours BETWEEN 1 AND 168),
  horizon_days integer NOT NULL DEFAULT 14 CHECK (horizon_days BETWEEN 3 AND 60),
  closed_dates date[] NOT NULL DEFAULT '{}' CHECK (cardinality(closed_dates) <= 100),
  methods text[] NOT NULL DEFAULT ARRAY['phone', 'video', 'visit']
    CHECK (cardinality(methods) >= 1 AND methods <@ ARRAY['phone', 'video', 'visit']),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_consult_hours ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_consult_hours FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.office_consult_hours TO authenticated;
DROP POLICY IF EXISTS office_consult_hours_read ON public.office_consult_hours;
CREATE POLICY office_consult_hours_read ON public.office_consult_hours FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));

-- 요일별 시간 검사: {"1":[["10:00","12:00"],["14:00","18:00"]], …} 0=일~6=토, 하루 3구간, 06:00~23:00, 시작 < 끝
CREATE OR REPLACE FUNCTION public.consult_hours_weekly_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  k text;
  w jsonb;
  s text;
  e text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  FOR k IN SELECT jsonb_object_keys(p) LOOP
    IF k !~ '^[0-6]$' OR jsonb_typeof(p -> k) <> 'array' OR jsonb_array_length(p -> k) > 3 THEN RETURN false; END IF;
    FOR w IN SELECT * FROM jsonb_array_elements(p -> k) LOOP
      IF jsonb_typeof(w) <> 'array' OR jsonb_array_length(w) <> 2 THEN RETURN false; END IF;
      s := w ->> 0; e := w ->> 1;
      IF s !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR e !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN false; END IF;
      IF s < '06:00' OR e > '23:00' OR s >= e THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_office_consult_hours(p_office_id text, p jsonb)
RETURNS public.office_consult_hours
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.office_consult_hours;
  v_weekly jsonb := coalesce(p -> 'weekly', '{}'::jsonb);
  v_closed date[];
  v_methods text[];
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: office.settings.edit' USING ERRCODE = '42501';
  END IF;
  IF NOT public.consult_hours_weekly_valid(v_weekly) THEN
    RAISE EXCEPTION 'invalid weekly hours' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(DISTINCT d::date ORDER BY d::date), '{}') INTO v_closed
    FROM jsonb_array_elements_text(coalesce(p -> 'closed_dates', '[]'::jsonb)) d
   WHERE d ~ '^\d{4}-\d{2}-\d{2}$' AND d::date >= public.seoul_today();
  SELECT coalesce(array_agg(DISTINCT m), '{}') INTO v_methods
    FROM jsonb_array_elements_text(coalesce(p -> 'methods', '["phone","video","visit"]'::jsonb)) m;
  IF cardinality(v_methods) = 0 THEN RAISE EXCEPTION 'choose at least one consult method' USING ERRCODE = '22023'; END IF;

  INSERT INTO office_consult_hours (office_id, enabled, weekly, slot_minutes, lead_hours, horizon_days, closed_dates, methods, updated_by, updated_at)
  VALUES (p_office_id, coalesce((p ->> 'enabled')::boolean, true), v_weekly,
          coalesce((p ->> 'slot_minutes')::int, 30), coalesce((p ->> 'lead_hours')::int, 24), coalesce((p ->> 'horizon_days')::int, 14),
          v_closed[1:100], v_methods, auth.uid(), now())
  ON CONFLICT (office_id) DO UPDATE SET
    enabled = EXCLUDED.enabled, weekly = EXCLUDED.weekly, slot_minutes = EXCLUDED.slot_minutes, lead_hours = EXCLUDED.lead_hours,
    horizon_days = EXCLUDED.horizon_days, closed_dates = EXCLUDED.closed_dates, methods = EXCLUDED.methods,
    updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'settings.consult_hours', 'office_consult_hours', p_office_id, jsonb_build_object('enabled', v.enabled));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_consult_hours(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_consult_hours(text, jsonb) TO authenticated;

-- 열어 둔 시간 (시간표 → 공휴일·쉬는 날·여유 시간·이미 확정된 예약을 뺀 칸, 최대 80개)
CREATE OR REPLACE FUNCTION public.consult_hours_slots(p_office_id text, p_now timestamptz DEFAULT now())
RETURNS timestamptz[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.office_consult_hours;
  v_out timestamptz[] := '{}';
  v_day date;
  v_today date := (p_now AT TIME ZONE 'Asia/Seoul')::date;
  w jsonb;
  t timestamptz;
  v_step interval;
BEGIN
  SELECT * INTO h FROM office_consult_hours WHERE office_id = p_office_id;
  IF h.office_id IS NULL OR NOT h.enabled THEN RETURN v_out; END IF;
  v_step := make_interval(mins => h.slot_minutes);
  FOR i IN 0 .. h.horizon_days - 1 LOOP
    v_day := v_today + i;
    CONTINUE WHEN v_day = ANY (h.closed_dates) OR EXISTS (SELECT 1 FROM business_holidays b WHERE b.day = v_day);
    FOR w IN SELECT * FROM jsonb_array_elements(coalesce(h.weekly -> extract(dow FROM v_day)::int::text, '[]'::jsonb)) LOOP
      FOR t IN
        SELECT g FROM generate_series(
          (v_day + (w ->> 0)::time) AT TIME ZONE 'Asia/Seoul',
          (v_day + (w ->> 1)::time) AT TIME ZONE 'Asia/Seoul' - v_step,
          v_step) g
      LOOP
        CONTINUE WHEN t < p_now + make_interval(hours => h.lead_hours);
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM consult_bookings b
          WHERE b.office_id = p_office_id AND b.status = 'confirmed'
            AND tstzrange(b.chosen_at, b.chosen_at + make_interval(mins => b.duration_min)) && tstzrange(t, t + v_step));
        v_out := v_out || t;
        IF cardinality(v_out) >= 80 THEN RETURN v_out; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_hours_slots(text, timestamptz) FROM PUBLIC, anon, authenticated;

-- 화면: 이 상담에서 고를 수 있는 시간 (의뢰인 = 요청 주인 + 열린 자리의 변호사 / 사무소 = 상담 채팅 권한)
CREATE OR REPLACE FUNCTION public.consult_open_slots(p_request_id text, p_lawyer_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req consult_requests%ROWTYPE;
  v_lid text;
  v_office text;
  h public.office_consult_hours;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_req.client_id = auth.uid()::text THEN
    v_lid := p_lawyer_id;
    IF NOT public.consult_booking_seat_open(v_req, v_lid) THEN
      RAISE EXCEPTION 'consultation is closed for this lawyer' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_lid := public.request_viewer_lawyer_id(v_req, 'consult.chat');
    IF v_lid IS NULL THEN RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501'; END IF;
  END IF;
  v_office := public.consult_booking_lawyer_office(v_lid);
  SELECT * INTO h FROM office_consult_hours WHERE office_id = v_office;
  IF h.office_id IS NULL OR NOT h.enabled THEN
    RETURN jsonb_build_object('enabled', false, 'slots', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'enabled', true, 'slot_minutes', h.slot_minutes, 'methods', to_jsonb(h.methods),
    'slots', to_jsonb(public.consult_hours_slots(v_office)));
END;
$$;
REVOKE ALL ON FUNCTION public.consult_open_slots(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consult_open_slots(text, text) TO authenticated;
