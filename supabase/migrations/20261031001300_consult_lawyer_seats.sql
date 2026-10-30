-- ============================================================
-- 변호사 찾기 서버 규칙 (LD-1·LD-2·LD-3·LD-9·OP-6)
-- 문제:
--  * '최대 3명'은 화면 숫자뿐이었다. 의뢰인이 상담 요청 행의 selected_lawyer_ids·status·request_type을
--    직접 바꿀 수 있어 요청을 새로 만들면 몇 명이든 보낼 수 있었고, 무응답·거절 자리도 돌아오지 않았다.
--  * 의뢰인의 '비교 상담 시작'·'이 변호사와 이어가기'는 서버 가드가 accepted_lawyer_ids를 되돌려 저장되지 않았다.
--  * lawyers 표는 누구나(익명 포함) 전부 읽을 수 있어 심사 대기 변호사의 이름·등록번호까지 공개됐다.
-- 바꾼 것:
--  * consult_request_lawyers: 요청 × 변호사 한 줄 (요청함·검토 중·제안함·확정·거절·기한 지남·취소·종료)
--    의뢰인 1명이 동시에 진행 중인 변호사 = 최대 3명 (요청 건수와 무관), 서버가 잠금을 걸고 센다
--  * 요청 추가·취소·비교/확정은 의뢰인 서버 함수로만. 의뢰인은 요청 행의 변호사·상태 칸을 직접 못 바꾼다
--  * 응답 기한 = 요청 다음 날부터 2영업일째 끝(한국 시간). 지나면 '기한 지남' → 자리 반환 + 의뢰인·사무소 알림,
--    기한 하루 전 사무소에 한 번 상기 (15분마다 서버 작업)
--  * 변호사 거절: 사유(분야 아님·업무 과다·기타)는 사무소 기록에만, 의뢰인에게는 '이번엔 어렵다'만
--  * 거절·기한 지남·취소된 변호사는 그 요청을 더 볼 수 없다 (제공 동의 범위가 끝남). 같은 변호사에게 같은 요청은 다시 못 보낸다
--  * lawyers 읽기: 누구나 = 승인 + 공개 최소 조건(실명·사무소명·사무소 시·도·사진·분야 1개+·소개 50자+)을 채운 행,
--    로그인 사용자는 그 밖에 본인·같은 사무소·내가 상담을 요청한 변호사·관리자
--  * 실적 수치(인가 성공률·누적 수임·평균 변제율) 칸 비움, 이후 저장도 막음 (LD-Q7)
--  * '오픈 매칭 재공개'(admin_reopen_stale_consult) 삭제 (OP-Q2), 요청 형태 기본값 'open' → 'direct_multi'
-- ============================================================

-- ── 1. 영업일 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_holidays (
  day date PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  note text CHECK (note IS NULL OR char_length(note) <= 200)
);
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_holidays_read ON public.business_holidays;
CREATE POLICY business_holidays_read ON public.business_holidays FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS business_holidays_admin_write ON public.business_holidays;
CREATE POLICY business_holidays_admin_write ON public.business_holidays FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.business_holidays FROM anon, authenticated;
GRANT SELECT ON public.business_holidays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_holidays TO authenticated;

-- 관공서의 공휴일에 관한 규정 기준 (대체공휴일 포함). 새 해·임시공휴일은 관리자가 더한다.
INSERT INTO public.business_holidays (day, name) VALUES
  ('2026-01-01', '1월 1일'), ('2026-02-16', '설날 연휴'), ('2026-02-17', '설날'), ('2026-02-18', '설날 연휴'),
  ('2026-03-02', '삼일절 대체공휴일'), ('2026-05-05', '어린이날'), ('2026-05-25', '부처님오신날 대체공휴일'),
  ('2026-06-03', '전국동시지방선거'), ('2026-08-17', '광복절 대체공휴일'),
  ('2026-09-24', '추석 연휴'), ('2026-09-25', '추석'), ('2026-10-05', '개천절 대체공휴일'),
  ('2026-10-09', '한글날'), ('2026-12-25', '성탄절'),
  ('2027-01-01', '1월 1일'), ('2027-02-08', '설날 연휴'), ('2027-02-09', '설날 대체공휴일'),
  ('2027-03-01', '삼일절'), ('2027-05-05', '어린이날'), ('2027-05-13', '부처님오신날'),
  ('2027-08-16', '광복절 대체공휴일'), ('2027-09-14', '추석 연휴'), ('2027-09-15', '추석'), ('2027-09-16', '추석 연휴'),
  ('2027-10-04', '개천절 대체공휴일'), ('2027-10-11', '한글날 대체공휴일'), ('2027-12-27', '성탄절 대체공휴일')
ON CONFLICT (day) DO NOTHING;

-- p_from(한국 시간 날짜) 다음 날부터 영업일 p_days개째 날이 끝나는 시각
CREATE OR REPLACE FUNCTION public.add_business_days(p_from timestamptz, p_days integer)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  d date := (p_from AT TIME ZONE 'Asia/Seoul')::date;
  n integer := 0;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 60 THEN
    RAISE EXCEPTION 'p_days out of range' USING ERRCODE = '22023';
  END IF;
  WHILE n < p_days LOOP
    d := d + 1;
    IF extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM public.business_holidays h WHERE h.day = d) THEN
      n := n + 1;
    END IF;
  END LOOP;
  RETURN ((d + 1)::timestamp AT TIME ZONE 'Asia/Seoul');
END;
$$;
REVOKE ALL ON FUNCTION public.add_business_days(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_business_days(timestamptz, integer) TO authenticated, service_role;

-- ── 2. 변호사 공개 조건 ─────────────────────────────────────
-- 목록에 보이려면 채워야 하는 항목 (빈 배열이면 충족)
CREATE OR REPLACE FUNCTION public.lawyer_profile_missing(l public.lawyers)
RETURNS text[]
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN coalesce(btrim(l.name), '') = '' THEN 'name' END,
    CASE WHEN coalesce(btrim(l.firm_name), '') = '' THEN 'firm_name' END,
    CASE WHEN coalesce(btrim(l.region), '') IN ('', '전국') THEN 'region' END,
    CASE WHEN coalesce(l.avatar, '') = '' AND coalesce(l.avatar_data, '') = '' THEN 'photo' END,
    CASE WHEN (CASE WHEN jsonb_typeof(l.fields) = 'array' THEN jsonb_array_length(l.fields) ELSE 0 END) = 0 THEN 'fields' END,
    CASE WHEN char_length(btrim(coalesce(l.bio, ''))) < 50 OR coalesce(l.bio, '') LIKE '%계정으로 가입 신청된 변호사입니다%' THEN 'bio' END
  ], NULL);
$$;
REVOKE ALL ON FUNCTION public.lawyer_profile_missing(public.lawyers) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_profile_missing(public.lawyers) TO authenticated, service_role;

-- 승인 + 공개 최소 조건 + 삭제 안 됨
CREATE OR REPLACE FUNCTION public.lawyer_is_public(l public.lawyers)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id IS NOT NULL
     AND EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = l.id AND la.approved = true)
     AND NOT EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = l.id)
     AND cardinality(public.lawyer_profile_missing(l)) = 0;
$$;
REVOKE ALL ON FUNCTION public.lawyer_is_public(public.lawyers) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lawyer_is_public(public.lawyers) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lawyer_is_public_id(p_lawyer_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT public.lawyer_is_public(l) FROM lawyers l WHERE l.id = p_lawyer_id), false);
$$;
REVOKE ALL ON FUNCTION public.lawyer_is_public_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_is_public_id(text) TO authenticated, service_role;

-- 내 화면에 필요한 변호사 행 (본인·같은 사무소·내가 상담을 요청한 변호사)
CREATE OR REPLACE FUNCTION public.lawyer_is_related_to_me(p_lawyer_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
       EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = auth.uid() AND la.lawyer_id = p_lawyer_id)
    OR EXISTS (SELECT 1 FROM office_members m WHERE m.lawyer_id = p_lawyer_id AND m.office_id = ANY (public.current_office_ids()))
    OR EXISTS (SELECT 1 FROM consult_requests r WHERE r.client_id = auth.uid()::text AND (
         r.selected_lawyer_id = p_lawyer_id
         OR (jsonb_typeof(r.selected_lawyer_ids) = 'array' AND r.selected_lawyer_ids ? p_lawyer_id)
         OR (jsonb_typeof(r.accepted_lawyer_ids) = 'array' AND r.accepted_lawyer_ids ? p_lawyer_id)))
  );
$$;
REVOKE ALL ON FUNCTION public.lawyer_is_related_to_me(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_is_related_to_me(text) TO authenticated, service_role;

DROP POLICY IF EXISTS lawyers_public_select ON public.lawyers;
DROP POLICY IF EXISTS lawyers_select_authenticated ON public.lawyers;
CREATE POLICY lawyers_public_select ON public.lawyers FOR SELECT TO anon, authenticated
  USING (public.lawyer_is_public(lawyers.*));
CREATE POLICY lawyers_select_related ON public.lawyers FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.lawyer_is_related_to_me(id));

-- 실적 수치: 입력·저장하지 않는다 (LD-Q7)
CREATE OR REPLACE FUNCTION public.strip_lawyer_performance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.success_rate := NULL;
  NEW.total_cases := NULL;
  NEW.avg_repayment_rate := NULL;
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    NEW.data := NEW.data - ARRAY['successRate', 'totalCases', 'avgRepaymentRate', 'success_rate', 'total_cases', 'avg_repayment_rate'];
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_strip_lawyer_performance ON public.lawyers;
CREATE TRIGGER trg_strip_lawyer_performance BEFORE INSERT OR UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.strip_lawyer_performance();
UPDATE public.lawyers SET updated_at = updated_at
 WHERE success_rate IS NOT NULL OR total_cases IS NOT NULL OR avg_repayment_rate IS NOT NULL
    OR (jsonb_typeof(data) = 'object' AND data ?| ARRAY['successRate', 'totalCases', 'avgRepaymentRate']);

-- ── 3. 요청 × 변호사 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consult_request_lawyers (
  request_id text NOT NULL REFERENCES public.consult_requests(id) ON DELETE CASCADE,
  lawyer_id text NOT NULL CHECK (char_length(lawyer_id) BETWEEN 1 AND 120),
  client_id text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'reviewing', 'proposed', 'chosen', 'declined', 'expired', 'withdrawn', 'released')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  respond_by timestamptz NOT NULL,
  responded_at timestamptz,
  reminded_at timestamptz,
  closed_at timestamptz,
  close_reason text CHECK (close_reason IS NULL OR close_reason IN ('declined', 'expired', 'client_withdrew', 'client_chose_other', 'contracted_other')),
  released_from text CHECK (released_from IS NULL OR released_from IN ('requested', 'reviewing', 'proposed', 'chosen')),
  decline_reason text CHECK (decline_reason IS NULL OR decline_reason IN ('not_my_field', 'too_busy', 'other')),
  decline_note text CHECK (decline_note IS NULL OR char_length(decline_note) <= 300),
  consent_version text NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 40),
  consented_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, lawyer_id)
);
CREATE INDEX IF NOT EXISTS consult_request_lawyers_client_idx ON public.consult_request_lawyers (client_id, status);
CREATE INDEX IF NOT EXISTS consult_request_lawyers_due_idx ON public.consult_request_lawyers (respond_by) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS consult_request_lawyers_lawyer_idx ON public.consult_request_lawyers (lawyer_id, status);
ALTER TABLE public.consult_request_lawyers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consult_request_lawyers FROM anon, authenticated;
-- 직접 읽기·쓰기 없음: 의뢰인 my_consult_seats(), 변호사 consult_requests_for_lawyers 뷰, 쓰기는 아래 함수만

-- 진행 중 자리 수 (계약 전 상담 단계의 요청만 센다)
CREATE OR REPLACE FUNCTION public.client_active_seat_count(p_client_id text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer
  FROM consult_request_lawyers l JOIN consult_requests r ON r.id = l.request_id
  WHERE l.client_id = p_client_id
    AND l.status IN ('requested', 'reviewing', 'proposed', 'chosen')
    AND r.status IN ('requested', 'responding', 'comparing', 'counseling');
$$;
REVOKE ALL ON FUNCTION public.client_active_seat_count(text) FROM PUBLIC, anon, authenticated;

-- 의뢰인 상담방에만 보이는 안내 한 줄
CREATE OR REPLACE FUNCTION public.consult_client_notice(p_request_id text, p_text text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO consult_messages (id, consult_request_id, sender_type, sender_id, sender_name, message, target_lawyer_id, created_at)
  VALUES ('srv-' || gen_random_uuid()::text, p_request_id, 'system', 'system', '시스템 안내', left(p_text, 500), 'client-only', now());
$$;
REVOKE ALL ON FUNCTION public.consult_client_notice(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lawyer_short_name(p_lawyer_id text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(regexp_replace(btrim(coalesce((SELECT l.name FROM lawyers l WHERE l.id = p_lawyer_id), '')), '\s*변호사$', ''), ''), '선택한');
$$;
REVOKE ALL ON FUNCTION public.lawyer_short_name(text) FROM PUBLIC, anon, authenticated;

-- 요청 행에서 변호사 한 명을 뺀다 (요청 대상·비교 상담·확정·그 변호사 제안서)
CREATE OR REPLACE FUNCTION public.consult_request_remove_lawyer(p_request_id text, p_lawyer_id text, p_drop_proposals boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE consult_requests r
     SET selected_lawyer_ids = coalesce(CASE WHEN jsonb_typeof(r.selected_lawyer_ids) = 'array' THEN r.selected_lawyer_ids - p_lawyer_id END, '[]'::jsonb),
         accepted_lawyer_ids = coalesce(CASE WHEN jsonb_typeof(r.accepted_lawyer_ids) = 'array' THEN r.accepted_lawyer_ids - p_lawyer_id END, '[]'::jsonb),
         selected_lawyer_id = CASE WHEN r.selected_lawyer_id = p_lawyer_id THEN NULL ELSE r.selected_lawyer_id END,
         proposals = CASE WHEN p_drop_proposals THEN coalesce((
             SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(r.proposals, '[]'::jsonb)) e
             WHERE (e ->> 'lawyerId') IS DISTINCT FROM p_lawyer_id), '[]'::jsonb)
           ELSE r.proposals END,
         status = CASE WHEN r.selected_lawyer_id = p_lawyer_id AND r.status = 'counseling' THEN 'responding' ELSE r.status END,
         updated_at = now()
   WHERE r.id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_request_remove_lawyer(text, text, boolean) FROM PUBLIC, anon, authenticated;

-- 변호사의 사무소 (알림용)
CREATE OR REPLACE FUNCTION public.lawyer_office_id(p_lawyer_id text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.office_id FROM office_members m
  WHERE m.lawyer_id = p_lawyer_id AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC, m.created_at LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lawyer_office_id(text) FROM PUBLIC, anon, authenticated;

-- ── 4. 의뢰인 함수 ─────────────────────────────────────────
-- 고른 변호사에게 상담 요청 (동의 창에서 '동의하고 보내기'를 누른 뒤에만 부른다)
CREATE OR REPLACE FUNCTION public.client_request_lawyers(p_request_id text, p_lawyer_ids text[], p_consent_version text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_req consult_requests%ROWTYPE;
  v_active integer;
  v_due timestamptz;
  v_sel jsonb;
  v_id text;
  v_added text[] := '{}';
  v_over text[] := '{}';
  v_already text[] := '{}';
  v_unavail text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_consent_version), '') = '' THEN RAISE EXCEPTION 'consent required' USING ERRCODE = '22023'; END IF;
  IF p_lawyer_ids IS NULL OR cardinality(p_lawyer_ids) = 0 OR cardinality(p_lawyer_ids) > 10 THEN
    RAISE EXCEPTION 'choose 1 to 10 lawyers' USING ERRCODE = '22023';
  END IF;
  -- 같은 의뢰인의 여러 탭·기기가 동시에 보내도 3명을 넘지 않게
  PERFORM pg_advisory_xact_lock(hashtext('consult_seats:' || v_uid));
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id AND client_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_req.created_by_lawyer_id IS NOT NULL OR v_req.admin_hidden THEN
    RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
  END IF;
  IF v_req.status NOT IN ('requested', 'responding', 'comparing', 'counseling', 'cancelled', 'closed') THEN
    RAISE EXCEPTION 'request already contracted' USING ERRCODE = '22023';
  END IF;
  IF v_req.financial_profile IS NULL OR v_req.financial_profile = '{}'::jsonb THEN
    RAISE EXCEPTION 'situation check required' USING ERRCODE = '22023';
  END IF;

  v_active := public.client_active_seat_count(v_uid);
  v_due := public.add_business_days(now(), 2);
  FOREACH v_id IN ARRAY p_lawyer_ids LOOP
    v_id := btrim(coalesce(v_id, ''));
    IF v_id = '' OR v_id = ANY (v_added) OR v_id = ANY (v_already) OR v_id = ANY (v_unavail) OR v_id = ANY (v_over) THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM consult_request_lawyers WHERE request_id = p_request_id AND lawyer_id = v_id) THEN
      v_already := v_already || v_id; CONTINUE;
    END IF;
    IF NOT public.lawyer_is_public_id(v_id) THEN
      v_unavail := v_unavail || v_id; CONTINUE;
    END IF;
    IF v_active >= 3 THEN
      v_over := v_over || v_id; CONTINUE;
    END IF;
    INSERT INTO consult_request_lawyers (request_id, lawyer_id, client_id, respond_by, consent_version)
    VALUES (p_request_id, v_id, v_uid, v_due, left(btrim(p_consent_version), 40));
    v_active := v_active + 1;
    v_added := v_added || v_id;
  END LOOP;

  v_sel := CASE WHEN jsonb_typeof(v_req.selected_lawyer_ids) = 'array' THEN v_req.selected_lawyer_ids ELSE '[]'::jsonb END;
  IF cardinality(v_added) > 0 THEN
    FOREACH v_id IN ARRAY v_added LOOP
      IF NOT v_sel ? v_id THEN v_sel := v_sel || to_jsonb(v_id); END IF;
    END LOOP;
    UPDATE consult_requests
       SET selected_lawyer_ids = v_sel,
           request_type = 'direct_multi',
           max_participants = 3,
           status = CASE WHEN status IN ('cancelled', 'closed') THEN 'requested' ELSE status END,
           updated_at = now()
     WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'added', to_jsonb(v_added), 'overflow', to_jsonb(v_over), 'already', to_jsonb(v_already), 'unavailable', to_jsonb(v_unavail),
    'active', v_active, 'limit', 3, 'respond_by', CASE WHEN cardinality(v_added) > 0 THEN v_due END,
    'selected_lawyer_ids', v_sel);
END;
$$;
REVOKE ALL ON FUNCTION public.client_request_lawyers(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_request_lawyers(text, text[], text) TO authenticated;

-- 내 자리 현황 (사유는 보여 주지 않는다)
CREATE OR REPLACE FUNCTION public.my_consult_seats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'limit', 3,
    'active', public.client_active_seat_count(auth.uid()::text),
    'lawyers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'request_id', l.request_id, 'lawyer_id', l.lawyer_id, 'status', l.status,
               'requested_at', l.requested_at, 'respond_by', l.respond_by, 'closed_at', l.closed_at)
             ORDER BY l.requested_at DESC)
      FROM consult_request_lawyers l
      WHERE l.client_id = auth.uid()::text AND l.requested_at > now() - interval '180 days'), '[]'::jsonb)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.my_consult_seats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_consult_seats() TO authenticated;

-- 보낸 요청 취소 (p_lawyer_id 가 비면 이 상담의 진행 중 변호사 전부)
CREATE OR REPLACE FUNCTION public.client_withdraw_consult_lawyer(p_request_id text, p_lawyer_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_req consult_requests%ROWTYPE;
  v_ids text[];
  v_id text;
  v_left integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('consult_seats:' || v_uid));
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id AND client_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_req.status NOT IN ('requested', 'responding', 'comparing', 'counseling') THEN
    RAISE EXCEPTION 'request is not in consultation' USING ERRCODE = '22023';
  END IF;

  WITH upd AS (
    UPDATE consult_request_lawyers
       SET status = 'withdrawn', closed_at = now(), close_reason = 'client_withdrew'
     WHERE request_id = p_request_id AND (p_lawyer_id IS NULL OR lawyer_id = p_lawyer_id)
       AND status IN ('requested', 'reviewing', 'proposed', 'chosen', 'released')
    RETURNING lawyer_id)
  SELECT coalesce(array_agg(lawyer_id), '{}') INTO v_ids FROM upd;
  -- 옛 요청(자리 기록 전)에 남은 변호사도 같이 뺀다
  IF p_lawyer_id IS NOT NULL AND NOT (p_lawyer_id = ANY (v_ids)) THEN v_ids := v_ids || p_lawyer_id; END IF;
  IF p_lawyer_id IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_ids FROM (
      SELECT unnest(v_ids) x
      UNION SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_req.selected_lawyer_ids) = 'array' THEN v_req.selected_lawyer_ids ELSE '[]'::jsonb END)
    ) s;
  END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    PERFORM public.consult_request_remove_lawyer(p_request_id, v_id, false);
  END LOOP;

  SELECT CASE WHEN jsonb_typeof(selected_lawyer_ids) = 'array' THEN jsonb_array_length(selected_lawyer_ids) ELSE 0 END
    INTO v_left FROM consult_requests WHERE id = p_request_id;
  IF v_left = 0 THEN
    UPDATE consult_requests SET status = 'cancelled', selected_lawyer_id = NULL, updated_at = now() WHERE id = p_request_id;
  END IF;
  RETURN jsonb_build_object('withdrawn', to_jsonb(v_ids), 'remaining', v_left,
    'active', public.client_active_seat_count(v_uid), 'limit', 3);
END;
$$;
REVOKE ALL ON FUNCTION public.client_withdraw_consult_lawyer(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_withdraw_consult_lawyer(text, text) TO authenticated;

-- 비교 상담 시작(compare) / 이 변호사와 이어가기(confirm) / 확정 취소(unconfirm)
CREATE OR REPLACE FUNCTION public.client_set_consult_choice(p_request_id text, p_action text, p_lawyer_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_req consult_requests%ROWTYPE;
  v_row consult_request_lawyers%ROWTYPE;
  v_has_row boolean;
  v_acc jsonb;
  v_active integer;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login required' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('compare', 'confirm', 'unconfirm') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('consult_seats:' || v_uid));
  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id AND client_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_req.status NOT IN ('requested', 'responding', 'comparing', 'counseling') THEN
    RAISE EXCEPTION 'request is not in consultation' USING ERRCODE = '22023';
  END IF;

  IF p_action IN ('compare', 'confirm') THEN
    IF coalesce(p_lawyer_id, '') = '' THEN RAISE EXCEPTION 'lawyer required' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_row FROM consult_request_lawyers WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id FOR UPDATE;
    v_has_row := FOUND;
    IF v_has_row AND v_row.status NOT IN ('reviewing', 'proposed', 'chosen') THEN
      RAISE EXCEPTION 'this lawyer is not in this consultation' USING ERRCODE = '22023';
    END IF;
    IF NOT v_has_row AND NOT (
         v_req.selected_lawyer_id = p_lawyer_id
      OR (jsonb_typeof(v_req.selected_lawyer_ids) = 'array' AND v_req.selected_lawyer_ids ? p_lawyer_id)) THEN
      RAISE EXCEPTION 'this lawyer is not in this consultation' USING ERRCODE = '22023';
    END IF;
    v_acc := CASE WHEN jsonb_typeof(v_req.accepted_lawyer_ids) = 'array' THEN v_req.accepted_lawyer_ids ELSE '[]'::jsonb END;
    IF NOT v_acc ? p_lawyer_id THEN v_acc := v_acc || to_jsonb(p_lawyer_id); END IF;

    IF p_action = 'compare' AND v_req.request_type IS DISTINCT FROM 'direct' THEN
      UPDATE consult_requests SET accepted_lawyer_ids = v_acc, status = 'comparing', updated_at = now() WHERE id = p_request_id;
    ELSE
      UPDATE consult_requests
         SET accepted_lawyer_ids = v_acc, selected_lawyer_id = p_lawyer_id, status = 'counseling', rejection_notified = true, updated_at = now()
       WHERE id = p_request_id;
      IF v_has_row AND v_row.status <> 'chosen' THEN
        UPDATE consult_request_lawyers SET status = 'chosen', released_from = v_row.status WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id;
      END IF;
      UPDATE consult_request_lawyers
         SET released_from = status, status = 'released', closed_at = now(), close_reason = 'client_chose_other'
       WHERE request_id = p_request_id AND lawyer_id <> p_lawyer_id AND status IN ('requested', 'reviewing', 'proposed', 'chosen');
    END IF;
  ELSE
    -- 확정 취소: 다시 비교할 수 있게 (자리가 남는 만큼만 되돌림)
    UPDATE consult_requests SET selected_lawyer_id = NULL, status = 'responding', updated_at = now() WHERE id = p_request_id;
    UPDATE consult_request_lawyers SET status = coalesce(nullif(released_from, 'chosen'), 'proposed'), released_from = NULL
     WHERE request_id = p_request_id AND status = 'chosen';
    v_active := public.client_active_seat_count(v_uid);
    FOR r IN SELECT * FROM consult_request_lawyers
              WHERE request_id = p_request_id AND status = 'released' AND close_reason = 'client_chose_other'
              ORDER BY requested_at
    LOOP
      EXIT WHEN v_active >= 3;
      UPDATE consult_request_lawyers
         SET status = coalesce(r.released_from, 'proposed'), released_from = NULL, closed_at = NULL, close_reason = NULL
       WHERE request_id = r.request_id AND lawyer_id = r.lawyer_id;
      v_active := v_active + 1;
    END LOOP;
  END IF;

  SELECT * INTO v_req FROM consult_requests WHERE id = p_request_id;
  RETURN jsonb_build_object('status', v_req.status, 'selected_lawyer_id', v_req.selected_lawyer_id,
    'accepted_lawyer_ids', v_req.accepted_lawyer_ids, 'active', public.client_active_seat_count(v_uid), 'limit', 3);
END;
$$;
REVOKE ALL ON FUNCTION public.client_set_consult_choice(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_set_consult_choice(text, text, text) TO authenticated;

-- ── 5. 의뢰인 직접 쓰기 가드 ────────────────────────────────
-- 의뢰인이 바꿀 수 있는 칸: 제목·본문·정리 자료·연락처·상담 분류·전화 상담 희망. 변호사·상태 칸은 위 함수로만
CREATE OR REPLACE FUNCTION public.guard_consult_request_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.proposals := '[]'::jsonb;
    NEW.accepted_lawyer_ids := '[]'::jsonb;
    NEW.created_by_lawyer_id := NULL;
    NEW.selected_lawyer_ids := '[]'::jsonb;
    NEW.selected_lawyer_id := NULL;
    NEW.request_type := 'direct_multi';
    NEW.max_participants := 3;
    NEW.status := 'requested';
    NEW.rejection_notified := false;
  ELSE
    NEW.proposals := OLD.proposals;
    NEW.accepted_lawyer_ids := OLD.accepted_lawyer_ids;
    NEW.created_by_lawyer_id := OLD.created_by_lawyer_id;
    NEW.client_id := OLD.client_id;
    NEW.selected_lawyer_ids := OLD.selected_lawyer_ids;
    NEW.selected_lawyer_id := OLD.selected_lawyer_id;
    NEW.request_type := OLD.request_type;
    NEW.max_participants := OLD.max_participants;
    NEW.status := OLD.status;
    NEW.rejection_notified := OLD.rejection_notified;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.consult_requests ALTER COLUMN request_type SET DEFAULT 'direct_multi';
UPDATE public.consult_requests SET request_type = 'direct_multi' WHERE request_type = 'open' AND created_by_lawyer_id IS NULL;

-- ── 6. 변호사 쪽 ───────────────────────────────────────────
-- 변호사 응답 기록 (검토 시작·채팅·제안서). 계약 단계로 넘어가면 다른 변호사 자리를 닫는다
CREATE OR REPLACE FUNCTION public.consult_seat_mark_response(p_request_id text, p_lawyer_id text, p_kind text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_lawyer_id IS NULL THEN RETURN; END IF;
  IF p_kind = 'proposal' THEN
    UPDATE consult_request_lawyers SET status = 'proposed', responded_at = coalesce(responded_at, now())
     WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id AND status IN ('requested', 'reviewing');
  ELSIF p_kind = 'contract' THEN
    UPDATE consult_request_lawyers SET status = 'chosen', responded_at = coalesce(responded_at, now()), released_from = NULL
     WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id AND status IN ('requested', 'reviewing', 'proposed', 'chosen', 'released');
    UPDATE consult_request_lawyers SET released_from = status, status = 'released', closed_at = now(), close_reason = 'contracted_other'
     WHERE request_id = p_request_id AND lawyer_id <> p_lawyer_id AND status IN ('requested', 'reviewing', 'proposed', 'chosen');
  ELSE
    UPDATE consult_request_lawyers SET status = 'reviewing', responded_at = now()
     WHERE request_id = p_request_id AND lawyer_id = p_lawyer_id AND status = 'requested';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.consult_seat_mark_response(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lid  text := public.current_approved_lawyer_id();
  v_row  consult_requests%ROWTYPE;
  v_prop jsonb;
  v_status text;
  v_is_lawyer boolean;
  v_seat_lawyer text;
  v_seat text;
BEGIN
  SELECT * INTO v_row FROM consult_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  v_is_lawyer := coalesce(v_lid IS NOT NULL AND public.lawyer_can_view_request(v_row, v_lid), false);

  IF NOT v_is_lawyer THEN
    -- 사무소 직원: 상담 채팅 권한이 있는 구성원은 상태만
    IF public.request_viewer_lawyer_id(v_row, 'consult.chat') IS NULL THEN
      RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
    END IF;
    IF p_patch ?| ARRAY['proposal', 'accept_self', 'select_self', 'client_name', 'phone'] THEN
      RAISE EXCEPTION 'only the requested lawyer can send proposals or edit contact fields' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 이 요청에서의 내 자리 (거절·기한 지남·취소·다른 변호사 확정 뒤에는 응답할 수 없다)
  v_seat_lawyer := CASE WHEN v_is_lawyer THEN v_lid ELSE public.request_viewer_lawyer_id(v_row, 'consult.chat') END;
  SELECT status INTO v_seat FROM consult_request_lawyers WHERE request_id = p_id AND lawyer_id = v_seat_lawyer;
  IF v_seat IN ('declined', 'expired', 'withdrawn') THEN
    RAISE EXCEPTION 'this consult request is closed for you' USING ERRCODE = '42501';
  END IF;
  IF v_seat = 'released' AND p_patch ?| ARRAY['proposal', 'accept_self', 'select_self', 'status'] THEN
    RAISE EXCEPTION 'the client continued with another lawyer' USING ERRCODE = '42501';
  END IF;

  IF p_patch ? 'proposal' THEN
    v_prop := p_patch -> 'proposal';
    IF jsonb_typeof(v_prop) <> 'object' OR (v_prop ->> 'lawyerId') IS DISTINCT FROM v_lid OR coalesce(v_prop ->> 'id', '') = '' THEN
      RAISE EXCEPTION 'proposal must belong to the calling lawyer' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_row.proposals, '[]'::jsonb)) e
      WHERE e ->> 'id' = v_prop ->> 'id' AND (e ->> 'lawyerId') IS DISTINCT FROM v_lid
    ) THEN
      RAISE EXCEPTION 'proposal id collision' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET proposals = coalesce((
             SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(proposals, '[]'::jsonb)) e
             WHERE e ->> 'id' IS DISTINCT FROM v_prop ->> 'id'
           ), '[]'::jsonb) || jsonb_build_array(v_prop)
     WHERE id = p_id;
    PERFORM public.consult_seat_mark_response(p_id, v_lid, 'proposal');
  END IF;
  IF coalesce((p_patch ->> 'accept_self')::boolean, false) THEN
    UPDATE consult_requests
       SET accepted_lawyer_ids = CASE
             WHEN coalesce(accepted_lawyer_ids, '[]'::jsonb) ? v_lid THEN accepted_lawyer_ids
             ELSE coalesce(accepted_lawyer_ids, '[]'::jsonb) || to_jsonb(v_lid)
           END
     WHERE id = p_id;
    PERFORM public.consult_seat_mark_response(p_id, v_lid, 'review');
  END IF;
  IF coalesce((p_patch ->> 'select_self')::boolean, false) THEN
    IF v_row.selected_lawyer_id IS NOT NULL AND v_row.selected_lawyer_id <> v_lid THEN
      RAISE EXCEPTION 'request already assigned to another lawyer' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests SET selected_lawyer_id = v_lid WHERE id = p_id;
  END IF;
  IF p_patch ? 'status' THEN
    v_status := p_patch ->> 'status';
    IF v_status NOT IN ('responding', 'counseling', 'comparing', 'contracted', 'document') THEN
      RAISE EXCEPTION 'status not allowed: %', v_status USING ERRCODE = '22023';
    END IF;
    UPDATE consult_requests SET status = v_status WHERE id = p_id;
    PERFORM public.consult_seat_mark_response(p_id, v_seat_lawyer,
      CASE WHEN v_status IN ('contracted', 'document') THEN 'contract' ELSE 'review' END);
  END IF;
  IF (p_patch ? 'client_name' OR p_patch ? 'phone') THEN
    IF NOT public.lawyer_can_see_contact(v_row, v_lid) THEN
      RAISE EXCEPTION 'contact fields are editable only after contract' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET client_name = coalesce(p_patch ->> 'client_name', client_name),
           phone       = coalesce(p_patch ->> 'phone', phone)
     WHERE id = p_id;
  END IF;
  UPDATE consult_requests SET updated_at = NOW() WHERE id = p_id;
END;
$$;

-- 변호사 거절 (사유는 사무소 기록에만)
CREATE OR REPLACE FUNCTION public.lawyer_decline_consult_request(p_id text, p_reason text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row consult_requests%ROWTYPE;
  v_lid text;
  v_name text;
BEGIN
  IF p_reason NOT IN ('not_my_field', 'too_busy', 'other') THEN
    RAISE EXCEPTION 'reason must be not_my_field, too_busy or other' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 300 THEN
    RAISE EXCEPTION 'note too long' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM consult_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  v_lid := public.request_viewer_lawyer_id(v_row, 'consult.chat');
  IF v_lid IS NULL THEN RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501'; END IF;

  UPDATE consult_request_lawyers
     SET status = 'declined', decline_reason = p_reason, decline_note = nullif(btrim(coalesce(p_note, '')), ''),
         closed_at = now(), close_reason = 'declined', responded_at = coalesce(responded_at, now())
   WHERE request_id = p_id AND lawyer_id = v_lid AND status IN ('requested', 'reviewing', 'proposed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nothing to decline (already closed or contracted)' USING ERRCODE = '22023';
  END IF;
  PERFORM public.consult_request_remove_lawyer(p_id, v_lid, true);

  v_name := public.lawyer_short_name(v_lid);
  PERFORM public.consult_client_notice(p_id, v_name || ' 변호사님이 이번 상담은 맡기 어렵다고 답했어요. 자리가 하나 돌아왔으니 다른 변호사를 골라 요청할 수 있어요.');
  IF v_row.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public.notify_user(v_row.client_id::uuid, 'client', NULL, 'consult_lawyer_declined', '변호사 답변이 왔어요',
      v_name || ' 변호사님이 이번 상담은 어렵다고 답했어요. 다른 변호사를 고를 수 있어요.', 'chat', p_id, 'declined:' || p_id || ':' || v_lid);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.lawyer_decline_consult_request(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_decline_consult_request(text, text, text) TO authenticated;

-- 변호사·직원이 채팅을 보내면 '검토 중'으로 본다
CREATE OR REPLACE FUNCTION public.trg_consult_message_marks_response()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req consult_requests%ROWTYPE;
BEGIN
  IF NEW.sender_type NOT IN ('lawyer', 'staff') THEN RETURN NEW; END IF;
  SELECT * INTO v_req FROM consult_requests WHERE id = NEW.consult_request_id;
  IF v_req.id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.consult_seat_mark_response(v_req.id, public.request_viewer_lawyer_id(v_req, 'consult.chat'), 'review');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'seat response mark failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_consult_message_marks_response ON public.consult_messages;
CREATE TRIGGER trg_consult_message_marks_response AFTER INSERT ON public.consult_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_consult_message_marks_response();

-- 변호사 화면용: 이 요청에서 내 자리 상태·응답 기한 (뒤에 칸 두 개 추가)
CREATE OR REPLACE VIEW public.consult_requests_for_lawyers WITH (security_barrier='true') AS
 SELECT cr.id,
    cr.client_id,
        CASE
            WHEN lawyer_can_see_contact(cr.*, me.lid) THEN cr.client_name
            WHEN POSITION(('_'::text) IN (cr.client_name)) > 0 THEN split_part(cr.client_name, '_'::text, 2)
            ELSE cr.client_name
        END AS client_name,
        CASE
            WHEN lawyer_can_see_contact(cr.*, me.lid) THEN cr.phone
            WHEN COALESCE(cr.phone, ''::text) = ''::text THEN ''::text
            ELSE '010-****-****'::text
        END AS phone,
    lawyer_can_see_contact(cr.*, me.lid) AS contact_visible,
    cr.request_type,
    cr.max_participants,
    cr.status,
    cr.selected_lawyer_id,
    cr.selected_lawyer_ids,
    cr.accepted_lawyer_ids,
    cr.rejection_notified,
    cr.proposals,
    cr.title,
    cr.content,
    cr.financial_profile,
    cr.phone_consultation_requested,
    cr.safe_number,
    cr.safe_number_assigned_at,
    cr.safe_number_expires_at,
    cr.entry_category,
    cr.created_by_lawyer_id,
    cr.created_at,
    cr.updated_at,
    seat.status AS my_seat_status,
    seat.respond_by AS my_respond_by
   FROM consult_requests cr
     CROSS JOIN LATERAL ( SELECT request_viewer_lawyer_id(cr.*, 'consult.view'::text) AS lid) me
     LEFT JOIN consult_request_lawyers seat ON seat.request_id = cr.id AND seat.lawyer_id = me.lid
  WHERE me.lid IS NOT NULL AND NOT cr.admin_hidden;

-- ── 7. 응답 기한 (15분마다) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_consult_lawyer_requests()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_name text;
  v_alias text;
  v_expired integer := 0;
  v_reminded integer := 0;
BEGIN
  FOR r IN
    SELECT l.request_id, l.lawyer_id, q.client_id
    FROM consult_request_lawyers l JOIN consult_requests q ON q.id = l.request_id
    WHERE l.status = 'requested' AND l.respond_by <= now()
    ORDER BY l.respond_by
    LIMIT 500
    FOR UPDATE OF l SKIP LOCKED
  LOOP
    UPDATE consult_request_lawyers SET status = 'expired', closed_at = now(), close_reason = 'expired'
     WHERE request_id = r.request_id AND lawyer_id = r.lawyer_id;
    PERFORM public.consult_request_remove_lawyer(r.request_id, r.lawyer_id, false);
    v_name := public.lawyer_short_name(r.lawyer_id);
    PERFORM public.consult_client_notice(r.request_id, v_name || ' 변호사님이 응답 기한(2영업일) 안에 답하지 않아 요청이 닫혔어요. 자리가 하나 돌아왔으니 다른 변호사를 골라 요청할 수 있어요.');
    IF r.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM public.notify_user(r.client_id::uuid, 'client', NULL, 'consult_lawyer_expired', '다른 변호사를 고를 수 있어요',
        v_name || ' 변호사님이 기한 안에 답하지 않아 자리가 돌아왔어요.', 'chat', r.request_id, 'expired:' || r.request_id || ':' || r.lawyer_id);
    END IF;
    SELECT public.consult_request_alias(q) INTO v_alias FROM consult_requests q WHERE q.id = r.request_id;
    PERFORM public.notify_office_members(public.lawyer_office_id(r.lawyer_id), 'consult.view', NULL, 'consult_request_expired',
      '응답 기한이 지났어요', coalesce(v_alias, '의뢰인') || '님 상담 요청의 응답 기한(2영업일)이 지나 요청이 닫혔어요.',
      'consult_request', r.request_id, 'consult_expired:' || r.request_id);
    v_expired := v_expired + 1;
  END LOOP;

  -- 기한 하루 전 한 번 상기
  FOR r IN
    SELECT l.request_id, l.lawyer_id, l.respond_by
    FROM consult_request_lawyers l
    WHERE l.status = 'requested' AND l.reminded_at IS NULL AND l.respond_by - now() <= interval '1 day' AND l.respond_by > now()
    LIMIT 500
    FOR UPDATE OF l SKIP LOCKED
  LOOP
    UPDATE consult_request_lawyers SET reminded_at = now() WHERE request_id = r.request_id AND lawyer_id = r.lawyer_id;
    SELECT public.consult_request_alias(q) INTO v_alias FROM consult_requests q WHERE q.id = r.request_id;
    PERFORM public.notify_office_members(public.lawyer_office_id(r.lawyer_id), 'consult.view', NULL, 'consult_request_due_soon',
      '상담 요청 응답 기한이 다가와요',
      coalesce(v_alias, '의뢰인') || '님 요청: ' || to_char(r.respond_by AT TIME ZONE 'Asia/Seoul' - interval '1 minute', 'MM/DD HH24:MI') || '까지 검토 시작·제안서·거절 중 하나로 답해 주세요.',
      'consult_request', r.request_id, 'consult_due:' || r.request_id);
    v_reminded := v_reminded + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'reminded', v_reminded);
END;
$$;
REVOKE ALL ON FUNCTION public.expire_consult_lawyer_requests() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('mykim_expire_consult_lawyer_requests')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mykim_expire_consult_lawyer_requests');
  PERFORM cron.schedule('mykim_expire_consult_lawyer_requests', '*/15 * * * *', 'SELECT public.expire_consult_lawyer_requests();');
END $$;

-- ── 8. 지금 있는 요청 옮기기 (기한은 지금부터 2영업일) ─────────
INSERT INTO public.consult_request_lawyers (request_id, lawyer_id, client_id, status, requested_at, respond_by, responded_at, consent_version, consented_at)
SELECT cr.id, x.lid, cr.client_id,
       CASE
         WHEN cr.selected_lawyer_id = x.lid AND cr.status <> 'requested' THEN 'chosen'
         WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(cr.proposals, '[]'::jsonb)) e WHERE e ->> 'lawyerId' = x.lid) THEN 'proposed'
         WHEN jsonb_typeof(cr.accepted_lawyer_ids) = 'array' AND cr.accepted_lawyer_ids ? x.lid THEN 'reviewing'
         ELSE 'requested'
       END,
       cr.created_at, public.add_business_days(now(), 2),
       CASE WHEN jsonb_typeof(cr.accepted_lawyer_ids) = 'array' AND cr.accepted_lawyer_ids ? x.lid THEN cr.updated_at END,
       'legacy', cr.created_at
FROM public.consult_requests cr
CROSS JOIN LATERAL (
  SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(cr.selected_lawyer_ids) = 'array' THEN cr.selected_lawyer_ids ELSE '[]'::jsonb END) AS lid
  UNION SELECT cr.selected_lawyer_id WHERE cr.selected_lawyer_id IS NOT NULL
) x
WHERE cr.created_by_lawyer_id IS NULL
  AND cr.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND cr.status IN ('requested', 'responding', 'comparing', 'counseling')
ON CONFLICT DO NOTHING;

-- ── 9. 오픈 매칭 재공개 삭제 (OP-Q2) ────────────────────────
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'admin_reopen_stale_consult'
  LOOP
    EXECUTE 'DROP FUNCTION ' || f::text;
  END LOOP;
END $$;
