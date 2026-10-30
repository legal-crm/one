-- ============================================================
-- 보정 대응 서버 모델 (CR-1·CR-2·CR-3·CR-4·CR-5·CR-6·CR-7 저장·CR-10)
-- 문제: 보정 등록·송달일·기간은 화면에서만 계산되고 저장되지 않았다. 법원 보정 목록(correctionOrders)을
--       채우는 곳이 없어 대시보드·단계 판정·의뢰인 카드가 늘 비었고, 의뢰인 올리기 1칸은 사무소가 읽지 않았다.
-- 바꾼 것:
--  * correction_orders(회차): 송달일 필수, 기간(n일/고정 날짜) → 법원 기한(초일 불산입·말일 휴일이면 다음 영업일),
--    사무소 마감(기한 5영업일 전, 송달~기한 10일 이하면 2영업일 전), 상태, 원문 파일, 제출일·접수증, 제출 뒤 잠금
--  * correction_items(항목): 원문 번호·글, 분류, 담당(의뢰인/사무소/함께), 의뢰인 안내, 필요 자료, 표 양식(T1~T11),
--    질문, 의뢰인 답·표·파일·'낼 수 없어요' 사유, 보완 요청 사유, 변호사 답변 문안, 소명자료 번호
--  * case_exhibits: 사건 전체 소명자료 번호(이어 매김)
--  * correction_item_library: 플랫폼 기본 13분류 + 사무소 사본
--  * 의뢰인은 서버 함수로만: 요청된 자기 몫 항목만 보고 답한다 (변호사 답변 문안·원문 숨김은 사무소 설정)
--  * 상태 변경은 서버 함수: 의뢰인에게 요청 / 검토(확인·보완) / 제출 기록(잠금) → 알림
-- 관리자는 보지 않는다 (011 원칙)
-- ============================================================

-- 2028 공휴일 (보정 기한 계산이 2028년까지 걸릴 수 있어서. 임시공휴일은 관리자가 더한다)
INSERT INTO public.business_holidays (day, name) VALUES
  ('2028-01-01', '1월 1일'), ('2028-01-25', '설날 연휴'), ('2028-01-26', '설날'), ('2028-01-27', '설날 연휴'),
  ('2028-03-01', '삼일절'), ('2028-04-12', '국회의원 선거'), ('2028-05-02', '부처님오신날'), ('2028-05-05', '어린이날'),
  ('2028-06-06', '현충일'), ('2028-08-15', '광복절'), ('2028-10-02', '추석 연휴'), ('2028-10-03', '추석·개천절'),
  ('2028-10-04', '추석 연휴'), ('2028-10-05', '추석 대체공휴일'), ('2028-10-09', '한글날'), ('2028-12-25', '성탄절')
ON CONFLICT (day) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_business_day(p_day date)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT extract(isodow FROM p_day) < 6 AND NOT EXISTS (SELECT 1 FROM business_holidays h WHERE h.day = p_day);
$$;
GRANT EXECUTE ON FUNCTION public.is_business_day(date) TO authenticated, service_role;

-- 법원 기한: n일형은 송달 다음 날부터 세고, 마지막 날이 토·일·공휴일이면 다음 영업일 (민법 제157조·제161조)
CREATE OR REPLACE FUNCTION public.correction_court_due(p_served date, p_kind text, p_days integer, p_fixed date)
RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE d date;
BEGIN
  IF p_kind = 'fixed' THEN RETURN p_fixed; END IF;
  IF p_served IS NULL OR p_days IS NULL OR p_days < 1 OR p_days > 180 THEN RETURN NULL; END IF;
  d := p_served + p_days;
  WHILE NOT public.is_business_day(d) LOOP d := d + 1; END LOOP;
  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.correction_court_due(date, text, integer, date) TO authenticated, service_role;

-- 사무소 마감: 법원 기한 5영업일 전 (송달~기한이 10일 이하면 2영업일 전). 송달일보다 앞이면 송달일
CREATE OR REPLACE FUNCTION public.correction_office_due(p_served date, p_court_due date)
RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  d date := p_court_due;
  n integer := 0;
  v_back integer;
BEGIN
  IF p_court_due IS NULL THEN RETURN NULL; END IF;
  v_back := CASE WHEN p_served IS NOT NULL AND p_court_due - p_served <= 10 THEN 2 ELSE 5 END;
  WHILE n < v_back LOOP
    d := d - 1;
    IF public.is_business_day(d) THEN n := n + 1; END IF;
  END LOOP;
  IF p_served IS NOT NULL AND d < p_served THEN d := p_served; END IF;
  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.correction_office_due(date, date) TO authenticated, service_role;

-- ── 표 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.correction_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  round integer NOT NULL CHECK (round BETWEEN 1 AND 50),
  kind text NOT NULL DEFAULT 'recommendation' CHECK (kind IN ('recommendation', 'order', 'objection_reply')),
  court_name text CHECK (court_name IS NULL OR char_length(court_name) <= 60),
  issuer text NOT NULL DEFAULT 'commissioner' CHECK (issuer IN ('court', 'commissioner')),
  served_on date NOT NULL,
  period_kind text NOT NULL CHECK (period_kind IN ('days', 'fixed')),
  period_days integer CHECK (period_days IS NULL OR period_days BETWEEN 1 AND 180),
  fixed_due date,
  court_due date,
  office_due date,
  office_due_manual boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'itemized', 'requested', 'drafting', 'review', 'submitted', 'extension')),
  source_file_id text,
  source_text text CHECK (source_text IS NULL OR char_length(source_text) <= 60000),
  client_can_view_source boolean NOT NULL DEFAULT true,
  client_can_view_brief boolean NOT NULL DEFAULT true,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_on date,
  receipt_file_id text,
  brief_file_id text,
  extension_note text CHECK (extension_note IS NULL OR char_length(extension_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, case_key, round),
  CHECK ((period_kind = 'days' AND period_days IS NOT NULL) OR (period_kind = 'fixed' AND fixed_due IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS correction_orders_office_idx ON public.correction_orders (office_id, status, office_due);
CREATE INDEX IF NOT EXISTS correction_orders_case_idx ON public.correction_orders (case_key);

CREATE TABLE IF NOT EXISTS public.correction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.correction_orders(id) ON DELETE CASCADE,
  office_id text NOT NULL,
  case_key text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  label text CHECK (label IS NULL OR char_length(label) <= 30),
  original_text text CHECK (original_text IS NULL OR char_length(original_text) <= 6000),
  category text CHECK (category IS NULL OR char_length(category) <= 40),
  library_id text,
  owner text NOT NULL DEFAULT 'client' CHECK (owner IN ('client', 'office', 'both')),
  client_title text CHECK (client_title IS NULL OR char_length(client_title) <= 120),
  client_guide text CHECK (client_guide IS NULL OR char_length(client_guide) <= 2000),
  needed_docs text[] NOT NULL DEFAULT '{}',
  table_type text CHECK (table_type IS NULL OR table_type ~ '^T([1-9]|1[01])$'),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_count integer CHECK (photo_count IS NULL OR photo_count BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'requested', 'in_progress', 'submitted', 'needs_fix', 'confirmed', 'cannot_submit', 'office_done')),
  client_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  table_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_ids text[] NOT NULL DEFAULT '{}',
  cannot_reason text CHECK (cannot_reason IS NULL OR cannot_reason IN ('none', 'delayed', 'refused', 'other')),
  cannot_note text CHECK (cannot_note IS NULL OR char_length(cannot_note) <= 1000),
  expected_on date,
  fix_reason text CHECK (fix_reason IS NULL OR char_length(fix_reason) <= 1000),
  answer_text text CHECK (answer_text IS NULL OR char_length(answer_text) <= 20000),
  exhibit_numbers integer[] NOT NULL DEFAULT '{}',
  client_submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correction_items_order_idx ON public.correction_items (order_id, seq);

CREATE TABLE IF NOT EXISTS public.case_exhibits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  number integer NOT NULL CHECK (number >= 1),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  item_id uuid REFERENCES public.correction_items(id) ON DELETE SET NULL,
  file_id text,
  first_document text CHECK (first_document IS NULL OR char_length(first_document) <= 120),
  pages text CHECK (pages IS NULL OR char_length(pages) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, case_key, number)
);

CREATE TABLE IF NOT EXISTS public.correction_item_library (
  id text PRIMARY KEY,
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  client_title text NOT NULL,
  client_guide text,
  needed_docs text[] NOT NULL DEFAULT '{}',
  table_type text CHECK (table_type IS NULL OR table_type ~ '^T([1-9]|1[01])$'),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner text NOT NULL DEFAULT 'client' CHECK (owner IN ('client', 'office', 'both')),
  answer_template text,
  keywords text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 권한 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.correction_can(p_office_id text, p_case_key text, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.has_office_permission(p_office_id, p_permission, public.crm_client_case_id(p_office_id, p_case_key)), false);
$$;
REVOKE ALL ON FUNCTION public.correction_can(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correction_can(text, text, text) TO authenticated;

ALTER TABLE public.correction_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_exhibits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_item_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.correction_orders, public.correction_items, public.case_exhibits, public.correction_item_library FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_orders, public.correction_items, public.case_exhibits, public.correction_item_library TO authenticated;

DROP POLICY IF EXISTS correction_orders_office_select ON public.correction_orders;
CREATE POLICY correction_orders_office_select ON public.correction_orders FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS correction_orders_office_write ON public.correction_orders;
CREATE POLICY correction_orders_office_write ON public.correction_orders FOR UPDATE TO authenticated
  USING (public.correction_can(office_id, case_key, 'correction.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'correction.manage'));
DROP POLICY IF EXISTS correction_orders_office_delete ON public.correction_orders;
CREATE POLICY correction_orders_office_delete ON public.correction_orders FOR DELETE TO authenticated
  USING (public.correction_can(office_id, case_key, 'correction.finalize') AND status <> 'submitted');
-- 새 회차는 create_correction_order() 로만 (회차 번호·기한 계산)

DROP POLICY IF EXISTS correction_items_office_select ON public.correction_items;
CREATE POLICY correction_items_office_select ON public.correction_items FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS correction_items_office_insert ON public.correction_items;
CREATE POLICY correction_items_office_insert ON public.correction_items FOR INSERT TO authenticated
  WITH CHECK (public.correction_can(office_id, case_key, 'correction.manage'));
DROP POLICY IF EXISTS correction_items_office_update ON public.correction_items;
CREATE POLICY correction_items_office_update ON public.correction_items FOR UPDATE TO authenticated
  USING (public.correction_can(office_id, case_key, 'correction.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'correction.manage'));
DROP POLICY IF EXISTS correction_items_office_delete ON public.correction_items;
CREATE POLICY correction_items_office_delete ON public.correction_items FOR DELETE TO authenticated
  USING (public.correction_can(office_id, case_key, 'correction.manage') AND status IN ('draft', 'office_done'));

DROP POLICY IF EXISTS case_exhibits_office_select ON public.case_exhibits;
CREATE POLICY case_exhibits_office_select ON public.case_exhibits FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS case_exhibits_office_write ON public.case_exhibits;
CREATE POLICY case_exhibits_office_write ON public.case_exhibits FOR ALL TO authenticated
  USING (public.correction_can(office_id, case_key, 'correction.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'correction.manage'));

DROP POLICY IF EXISTS correction_library_read ON public.correction_item_library;
CREATE POLICY correction_library_read ON public.correction_item_library FOR SELECT TO authenticated
  USING (office_id IS NULL OR office_id = ANY (public.current_office_ids()));
DROP POLICY IF EXISTS correction_library_office_write ON public.correction_item_library;
CREATE POLICY correction_library_office_write ON public.correction_item_library FOR ALL TO authenticated
  USING (office_id IS NOT NULL AND public.has_office_permission(office_id, 'correction.manage', NULL))
  WITH CHECK (office_id IS NOT NULL AND public.has_office_permission(office_id, 'correction.manage', NULL));

-- 정지 계정 제한 (20261031001400 과 같은 규칙)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['correction_orders', 'correction_items', 'case_exhibits'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS account_active_only ON public.%I', t);
    EXECUTE format('CREATE POLICY account_active_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))', t);
  END LOOP;
END $$;

-- ── 가드: 계산 칸·소속 칸은 서버가, 제출한 회차는 잠금 ───────────
CREATE OR REPLACE FUNCTION public.correction_orders_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id; NEW.office_id := OLD.office_id; NEW.case_key := OLD.case_key; NEW.round := OLD.round;
    NEW.created_at := OLD.created_at; NEW.created_by := OLD.created_by;
    IF current_user IN ('authenticated', 'anon') THEN
      IF OLD.status = 'submitted' THEN
        -- 제출 뒤에는 의뢰인 공개 설정·접수증·제출본 파일만 바꿀 수 있다
        IF (to_jsonb(NEW) - ARRAY['client_can_view_source', 'client_can_view_brief', 'receipt_file_id', 'brief_file_id', 'updated_at', 'court_due', 'office_due'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['client_can_view_source', 'client_can_view_brief', 'receipt_file_id', 'brief_file_id', 'updated_at', 'court_due', 'office_due']) THEN
          RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation';
        END IF;
        NEW.updated_at := now();
        RETURN NEW;
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('submitted', 'requested') THEN
        RAISE EXCEPTION 'use the server function for this status' USING ERRCODE = 'insufficient_privilege';
      END IF;
      NEW.submitted_on := OLD.submitted_on;
    END IF;
  END IF;
  NEW.court_due := public.correction_court_due(NEW.served_on, NEW.period_kind, NEW.period_days, NEW.fixed_due);
  IF NOT NEW.office_due_manual OR NEW.office_due IS NULL THEN
    NEW.office_due := public.correction_office_due(NEW.served_on, NEW.court_due);
    NEW.office_due_manual := false;
  ELSIF NEW.office_due > NEW.court_due THEN
    RAISE EXCEPTION 'office due must be on or before court due' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS correction_orders_guard ON public.correction_orders;
CREATE TRIGGER correction_orders_guard BEFORE INSERT OR UPDATE ON public.correction_orders
  FOR EACH ROW EXECUTE FUNCTION public.correction_orders_guard();

CREATE OR REPLACE FUNCTION public.correction_items_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o correction_orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM correction_orders WHERE id = NEW.order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'foreign_key_violation'; END IF;
  NEW.office_id := o.office_id;
  NEW.case_key := o.case_key;
  IF TG_OP = 'UPDATE' THEN NEW.id := OLD.id; NEW.order_id := OLD.order_id; END IF;
  IF current_user IN ('authenticated', 'anon') THEN
    IF o.status = 'submitted' THEN RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation'; END IF;
    -- 의뢰인 몫 상태·답은 서버 함수(요청·검토·의뢰인 답)로만
    IF TG_OP = 'INSERT' THEN
      NEW.status := CASE WHEN NEW.status = 'office_done' THEN 'office_done' ELSE 'draft' END;
      NEW.client_answers := '{}'::jsonb; NEW.client_submitted_at := NULL; NEW.reviewed_at := NULL; NEW.exhibit_numbers := '{}';
    ELSE
      IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
           (OLD.status IN ('draft', 'office_done') AND NEW.status IN ('draft', 'office_done'))) THEN
        RAISE EXCEPTION 'use the server function for this status' USING ERRCODE = 'insufficient_privilege';
      END IF;
      NEW.client_answers := OLD.client_answers; NEW.client_submitted_at := OLD.client_submitted_at;
      NEW.cannot_reason := OLD.cannot_reason; NEW.cannot_note := OLD.cannot_note; NEW.expected_on := OLD.expected_on;
      NEW.reviewed_at := OLD.reviewed_at; NEW.reviewed_by := OLD.reviewed_by; NEW.exhibit_numbers := OLD.exhibit_numbers;
      -- 의뢰인이 낸 파일·표는 사무소가 지우지 않는다 (더하기는 가능)
      IF NOT (NEW.file_ids @> OLD.file_ids) THEN NEW.file_ids := OLD.file_ids || NEW.file_ids; END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS correction_items_guard ON public.correction_items;
CREATE TRIGGER correction_items_guard BEFORE INSERT OR UPDATE ON public.correction_items
  FOR EACH ROW EXECUTE FUNCTION public.correction_items_guard();

-- ── 사무소 함수 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_correction_order(p_office_id text, p_case_key text, p jsonb)
RETURNS public.correction_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row correction_orders%ROWTYPE;
  v_round integer;
BEGIN
  IF NOT public.correction_can(p_office_id, p_case_key, 'correction.manage') THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF nullif(p ->> 'served_on', '') IS NULL THEN RAISE EXCEPTION 'served_on required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('correction_round:' || p_office_id || ':' || p_case_key));
  SELECT coalesce(max(round), 0) + 1 INTO v_round FROM correction_orders WHERE office_id = p_office_id AND case_key = p_case_key;
  INSERT INTO correction_orders (office_id, case_key, round, kind, court_name, issuer, served_on, period_kind, period_days, fixed_due,
                                 source_file_id, source_text, created_by)
  VALUES (p_office_id, p_case_key, v_round,
          coalesce(nullif(p ->> 'kind', ''), 'recommendation'),
          nullif(left(btrim(coalesce(p ->> 'court_name', '')), 60), ''),
          coalesce(nullif(p ->> 'issuer', ''), 'commissioner'),
          (p ->> 'served_on')::date,
          coalesce(nullif(p ->> 'period_kind', ''), 'days'),
          nullif(p ->> 'period_days', '')::integer,
          nullif(p ->> 'fixed_due', '')::date,
          nullif(p ->> 'source_file_id', ''),
          nullif(left(coalesce(p ->> 'source_text', ''), 60000), ''),
          auth.uid())
  RETURNING * INTO v_row;
  IF v_row.court_due IS NOT NULL AND v_row.court_due < v_row.served_on THEN
    RAISE EXCEPTION 'due date before served date' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_correction_order(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_correction_order(text, text, jsonb) TO authenticated;

-- 확인한 의뢰인 몫 항목을 한 번에 요청 → 의뢰인 알림
CREATE OR REPLACE FUNCTION public.request_correction_items(p_order_id uuid, p_item_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o correction_orders%ROWTYPE;
  n integer;
  v_client uuid;
BEGIN
  SELECT * INTO o FROM correction_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR NOT public.correction_can(o.office_id, o.case_key, 'correction.manage') THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF o.status = 'submitted' THEN RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation'; END IF;
  UPDATE correction_items SET status = 'requested', updated_at = now()
   WHERE order_id = p_order_id AND status = 'draft' AND owner IN ('client', 'both')
     AND (p_item_ids IS NULL OR id = ANY (p_item_ids))
     AND coalesce(btrim(client_title), '') <> '';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'no client items ready (owner client and title needed)' USING ERRCODE = '22023'; END IF;
  UPDATE correction_orders SET status = CASE WHEN status IN ('received', 'itemized') THEN 'requested' ELSE status END, updated_at = now()
   WHERE id = p_order_id;
  v_client := public.case_key_client_user(o.case_key);
  IF v_client IS NOT NULL THEN
    PERFORM public.notify_user(v_client, 'client', NULL, 'correction_request', '법원에서 보완 자료를 요청했어요',
      '준비할 항목 ' || n || '개 · 사무소 마감 ' || to_char(o.office_due, 'MM/DD') || '. 내 사건에서 확인해 주세요.',
      'case_correction', o.case_key, 'correction:' || o.id);
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.request_correction_items(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_correction_items(uuid, uuid[]) TO authenticated;

-- 검토: 확인(소명자료 번호 자동) / 보완 요청(사유 필수) / 사무소 처리 완료
CREATE OR REPLACE FUNCTION public.review_correction_item(p_item_id uuid, p_action text, p_reason text DEFAULT NULL, p_exhibit_title text DEFAULT NULL)
RETURNS public.correction_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it correction_items%ROWTYPE;
  o correction_orders%ROWTYPE;
  v_no integer;
  v_client uuid;
BEGIN
  SELECT * INTO it FROM correction_items WHERE id = p_item_id FOR UPDATE;
  IF it.id IS NULL THEN RAISE EXCEPTION 'item not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO o FROM correction_orders WHERE id = it.order_id;
  IF NOT public.correction_can(o.office_id, o.case_key, 'correction.manage') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF o.status = 'submitted' THEN RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation'; END IF;
  IF p_action NOT IN ('confirm', 'needs_fix', 'office_done', 'reopen') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;

  IF p_action = 'needs_fix' THEN
    IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
    IF it.status NOT IN ('submitted', 'cannot_submit', 'confirmed') THEN RAISE EXCEPTION 'nothing submitted yet' USING ERRCODE = '22023'; END IF;
    UPDATE correction_items SET status = 'needs_fix', fix_reason = left(btrim(p_reason), 1000), reviewed_at = now(), reviewed_by = auth.uid()
     WHERE id = p_item_id RETURNING * INTO it;
    v_client := public.case_key_client_user(o.case_key);
    IF v_client IS NOT NULL THEN
      PERFORM public.notify_user(v_client, 'client', NULL, 'correction_fix', '보정 자료에 보완이 필요해요',
        coalesce(it.client_title, '요청한 자료') || ': ' || left(btrim(p_reason), 120), 'case_correction', o.case_key, 'correction_fix:' || it.id);
    END IF;
  ELSIF p_action = 'confirm' THEN
    IF it.status NOT IN ('submitted', 'cannot_submit', 'needs_fix', 'in_progress', 'requested') THEN RAISE EXCEPTION 'nothing to confirm' USING ERRCODE = '22023'; END IF;
    IF cardinality(it.file_ids) > 0 AND cardinality(it.exhibit_numbers) = 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext('exhibit:' || o.office_id || ':' || o.case_key));
      SELECT coalesce(max(number), 0) + 1 INTO v_no FROM case_exhibits WHERE office_id = o.office_id AND case_key = o.case_key;
      INSERT INTO case_exhibits (office_id, case_key, number, title, item_id, file_id, first_document)
      VALUES (o.office_id, o.case_key, v_no, left(coalesce(nullif(btrim(p_exhibit_title), ''), it.client_title, it.category, '소명자료'), 200),
              it.id, it.file_ids[1], o.round || '차 보정서');
      UPDATE correction_items SET exhibit_numbers = ARRAY[v_no] WHERE id = p_item_id;
    END IF;
    UPDATE correction_items SET status = 'confirmed', fix_reason = NULL, reviewed_at = now(), reviewed_by = auth.uid()
     WHERE id = p_item_id RETURNING * INTO it;
  ELSIF p_action = 'office_done' THEN
    UPDATE correction_items SET status = 'office_done', reviewed_at = now(), reviewed_by = auth.uid() WHERE id = p_item_id RETURNING * INTO it;
  ELSE
    UPDATE correction_items SET status = CASE WHEN owner = 'office' THEN 'draft' ELSE 'requested' END, reviewed_at = NULL
     WHERE id = p_item_id RETURNING * INTO it;
  END IF;
  UPDATE correction_orders SET status = CASE WHEN status IN ('received', 'itemized', 'requested') THEN 'drafting' ELSE status END WHERE id = o.id;
  RETURN it;
END;
$$;
REVOKE ALL ON FUNCTION public.review_correction_item(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_correction_item(uuid, text, text, text) TO authenticated;

-- 제출 기록 → 잠금 + 의뢰인 안내 (보정서 확정은 변호사 전용 권한 correction.finalize)
CREATE OR REPLACE FUNCTION public.submit_correction_order(p_order_id uuid, p_submitted_on date, p_receipt_file_id text DEFAULT NULL, p_brief_file_id text DEFAULT NULL)
RETURNS public.correction_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o correction_orders%ROWTYPE;
  v_client uuid;
BEGIN
  SELECT * INTO o FROM correction_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR NOT public.correction_can(o.office_id, o.case_key, 'correction.finalize') THEN
    RAISE EXCEPTION 'not allowed (lawyer only)' USING ERRCODE = '42501';
  END IF;
  IF o.status = 'submitted' THEN RAISE EXCEPTION 'already submitted' USING ERRCODE = '22023'; END IF;
  IF p_submitted_on IS NULL OR p_submitted_on < o.served_on OR p_submitted_on > (now() AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION 'submitted date must be between served date and today' USING ERRCODE = '22023';
  END IF;
  UPDATE correction_orders SET status = 'submitted', submitted_on = p_submitted_on,
         receipt_file_id = coalesce(p_receipt_file_id, receipt_file_id), brief_file_id = coalesce(p_brief_file_id, brief_file_id), updated_at = now()
   WHERE id = p_order_id RETURNING * INTO o;
  v_client := public.case_key_client_user(o.case_key);
  IF v_client IS NOT NULL THEN
    PERFORM public.notify_user(v_client, 'client', NULL, 'correction_submitted', '사무소가 법원에 보정서를 냈어요',
      to_char(p_submitted_on, 'MM/DD') || ' 제출. 법원이 더 요청하면 다시 알려 드릴게요.', 'case_correction', o.case_key, 'correction_done:' || o.id);
  END IF;
  RETURN o;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_correction_order(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_correction_order(uuid, date, text, text) TO authenticated;

-- 사무소 진행 중 보정 요약 (대시보드·사건 목록·단계 판정)
CREATE OR REPLACE FUNCTION public.office_correction_overview(p_office_id text)
RETURNS TABLE (order_id uuid, case_key text, round integer, status text, served_on date, court_due date, office_due date,
               items_total integer, items_open integer, items_client_waiting integer, submitted_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.case_key, o.round, o.status, o.served_on, o.court_due, o.office_due,
         (SELECT count(*)::integer FROM correction_items i WHERE i.order_id = o.id),
         (SELECT count(*)::integer FROM correction_items i WHERE i.order_id = o.id AND i.status NOT IN ('confirmed', 'office_done')),
         (SELECT count(*)::integer FROM correction_items i WHERE i.order_id = o.id AND i.status IN ('requested', 'in_progress', 'needs_fix')),
         o.submitted_on
  FROM correction_orders o
  WHERE o.office_id = p_office_id AND public.correction_can(o.office_id, o.case_key, 'case.view')
  ORDER BY (o.status = 'submitted'), o.office_due NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.office_correction_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_correction_overview(text) TO authenticated;

-- ── 의뢰인 함수 ─────────────────────────────────────────────
-- 내 사건 보정: 요청된 내 몫 항목만 (변호사 답변 문안·사무소 몫·초안은 안 보임)
CREATE OR REPLACE FUNCTION public.client_correction_view(p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.client_owns_case_key(p_case_key) OR NOT public.is_account_active() THEN RETURN NULL; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'round', o.round, 'kind', o.kind, 'court_name', o.court_name, 'status', o.status,
      'office_due', o.office_due, 'court_due', o.court_due, 'submitted_on', o.submitted_on,
      'source_file_id', CASE WHEN o.client_can_view_source THEN o.source_file_id END,
      'brief_file_id', CASE WHEN o.client_can_view_brief AND o.status = 'submitted' THEN o.brief_file_id END,
      'items', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'label', i.label, 'title', i.client_title, 'guide', i.client_guide, 'needed_docs', to_jsonb(i.needed_docs),
          'table_type', i.table_type, 'questions', i.questions, 'photo_count', i.photo_count, 'status', i.status,
          'answers', i.client_answers, 'table_rows', i.table_rows, 'file_ids', to_jsonb(i.file_ids),
          'cannot_reason', i.cannot_reason, 'cannot_note', i.cannot_note, 'expected_on', i.expected_on, 'fix_reason', i.fix_reason)
          ORDER BY i.seq)
        FROM correction_items i
        WHERE i.order_id = o.id AND i.owner IN ('client', 'both') AND i.status NOT IN ('draft', 'office_done')), '[]'::jsonb))
      ORDER BY o.round DESC)
    FROM correction_orders o
    WHERE o.case_key = p_case_key
      AND (o.status = 'submitted' OR EXISTS (SELECT 1 FROM correction_items i WHERE i.order_id = o.id AND i.status NOT IN ('draft', 'office_done') AND i.owner IN ('client', 'both')))
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.client_correction_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_correction_view(text) TO authenticated;

-- 의뢰인 답: 임시 저장(save) / 보내기(submit) / 낼 수 없어요(cannot)
CREATE OR REPLACE FUNCTION public.client_correction_respond(p_item_id uuid, p_action text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it correction_items%ROWTYPE;
  o correction_orders%ROWTYPE;
  v_files text[];
  v_rows jsonb;
BEGIN
  SELECT * INTO it FROM correction_items WHERE id = p_item_id FOR UPDATE;
  IF it.id IS NULL OR NOT public.client_owns_case_key(it.case_key) OR NOT public.is_account_active()
     OR it.owner NOT IN ('client', 'both') OR it.status IN ('draft', 'office_done') THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM correction_orders WHERE id = it.order_id;
  IF o.status = 'submitted' THEN RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation'; END IF;
  IF it.status = 'confirmed' THEN RAISE EXCEPTION 'already confirmed by office' USING ERRCODE = '22023'; END IF;
  IF p_action NOT IN ('save', 'submit', 'cannot') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;

  -- 파일은 이 사건 서류함(case_files)에 의뢰인이 올린 것만 연결
  SELECT coalesce(array_agg(f.id), '{}') INTO v_files
  FROM case_files f
  WHERE f.id IN (SELECT jsonb_array_elements_text(coalesce(p -> 'file_ids', '[]'::jsonb)))
    AND f.client_key = it.case_key AND f.upload_source = 'client' AND f.deleted_at IS NULL;
  v_rows := CASE WHEN jsonb_typeof(p -> 'table_rows') = 'array' THEN p -> 'table_rows' ELSE it.table_rows END;
  IF jsonb_array_length(v_rows) > 300 OR length(v_rows::text) > 200000 THEN RAISE EXCEPTION 'table too large' USING ERRCODE = '22023'; END IF;

  IF p_action = 'cannot' THEN
    IF coalesce(p ->> 'cannot_reason', '') NOT IN ('none', 'delayed', 'refused', 'other') THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
    UPDATE correction_items SET status = 'cannot_submit', cannot_reason = p ->> 'cannot_reason',
           cannot_note = nullif(left(btrim(coalesce(p ->> 'cannot_note', '')), 1000), ''),
           expected_on = nullif(p ->> 'expected_on', '')::date, client_submitted_at = now(), updated_at = now()
     WHERE id = p_item_id RETURNING * INTO it;
  ELSE
    UPDATE correction_items
       SET client_answers = CASE WHEN jsonb_typeof(p -> 'answers') = 'object' THEN p -> 'answers' ELSE client_answers END,
           table_rows = v_rows,
           file_ids = (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(file_ids || v_files) x),
           status = CASE WHEN p_action = 'submit' THEN 'submitted' ELSE CASE WHEN status IN ('requested', 'needs_fix') THEN 'in_progress' ELSE status END END,
           cannot_reason = CASE WHEN p_action = 'submit' THEN NULL ELSE cannot_reason END,
           client_submitted_at = CASE WHEN p_action = 'submit' THEN now() ELSE client_submitted_at END,
           updated_at = now()
     WHERE id = p_item_id RETURNING * INTO it;
    IF length(it.client_answers::text) > 50000 THEN RAISE EXCEPTION 'answers too large' USING ERRCODE = '22023'; END IF;
  END IF;

  IF p_action IN ('submit', 'cannot') THEN
    PERFORM public.notify_office_members(o.office_id, 'correction.manage', public.crm_client_case_id(o.office_id, o.case_key),
      'correction_client_reply', '의뢰인이 보정 자료를 보냈어요',
      coalesce(it.client_title, '보정 항목') || CASE WHEN p_action = 'cannot' THEN ' · 낼 수 없음' ELSE '' END,
      'case_correction', o.case_key, 'correction_reply:' || o.id);
  END IF;
  RETURN jsonb_build_object('status', it.status, 'file_ids', to_jsonb(it.file_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.client_correction_respond(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_correction_respond(uuid, text, jsonb) TO authenticated;

-- 원문·제출본 파일은 의뢰인 '보기' 범위에 있을 때만 서명 주소를 받을 수 있게 (case_files 의뢰인 읽기 확장)
CREATE OR REPLACE FUNCTION public.client_can_view_correction_file(p_file_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM correction_orders o
    WHERE public.client_owns_case_key(o.case_key) AND (
      (o.client_can_view_source AND o.source_file_id = p_file_id AND EXISTS (
         SELECT 1 FROM correction_items i WHERE i.order_id = o.id AND i.status NOT IN ('draft', 'office_done') AND i.owner IN ('client', 'both')))
      OR (o.client_can_view_brief AND o.status = 'submitted' AND o.brief_file_id = p_file_id)));
$$;
REVOKE ALL ON FUNCTION public.client_can_view_correction_file(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_can_view_correction_file(text) TO authenticated;

DROP POLICY IF EXISTS case_files_client_correction_select ON public.case_files;
CREATE POLICY case_files_client_correction_select ON public.case_files FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.client_can_view_correction_file(id));
DROP POLICY IF EXISTS case_files_obj_client_correction_read ON storage.objects;
CREATE POLICY case_files_obj_client_correction_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND EXISTS (
    SELECT 1 FROM public.case_files f WHERE f.storage_path = storage.objects.name AND f.deleted_at IS NULL
      AND public.client_can_view_correction_file(f.id)));

-- ── 항목 라이브러리 기본값 (실제 보정 4건 + 실무 일반, 2-2장 13분류) ─────
INSERT INTO public.correction_item_library (id, category, title, client_title, client_guide, needed_docs, table_type, questions, owner, answer_template, keywords, sort_order) VALUES
('lib-fee', '비용', '회생위원 보수 예납', '회생위원 보수 예납', '법원이 정한 회생위원 보수를 예납해야 해요. 사무소가 금액과 입금 방법을 안내해 드려요.', '{}', NULL, '[]', 'office',
 '신청인은 회생위원 보수 금 ○○원을 예납하였습니다(예납 영수증 첨부).', ARRAY['보수', '예납'], 10),
('lib-plan', '변제계획안 수정', '변제계획안 수정', '변제계획안 수정', NULL, '{}', NULL, '[]', 'office',
 '보정권고에 따라 변제계획안을 수정하여 수정 변제계획안 및 변제예정액표를 제출합니다.', ARRAY['변제계획', '가용소득', '생계비', '변제예정액', '변제기간', '10항', '양육비 신고'], 20),
('lib-creditor', '채권자목록 정정', '채권자목록 정정', '사무소가 고친 채권자 내용 확인', '사무소가 고친 채권자 이름·금액이 맞는지 확인해 주세요. 다르면 "달라요"에 적어 주세요.', '{}', NULL,
 '["고친 채권자 내용이 맞나요? (맞아요/달라요, 다르면 무엇이 다른지)"]', 'both',
 '채권자목록을 정정하여 수정 채권자목록을 제출합니다.', ARRAY['채권자목록', '채권현재액', '우선채권', '장래구상권', '산정기준일', '대위변제', '양도'], 30),
('lib-insurance', '보험', '보험 가입 내역·해약환급금', '가입한 보험의 해약환급금 자료', '신용정보원에서 보험가입내역을 받고, 보험회사마다 해약환급금 증명서를 받아 주세요. 농협·수협·우체국·새마을금고·신협 공제도 확인이 필요해요.',
 ARRAY['보험가입내역조회(신용정보원)', '보험회사별 해약환급금 증명서', '공제 가입 확인서(해당 시)'], 'T3', '["최근 2년 안에 해약한 보험이 있으면 해약금을 어디에 썼나요?"]', 'client',
 '신청인의 보험 가입 내역과 해약환급금은 별지 ○ 기재와 같으며, 소명자료로 소갑 제○호증을 제출합니다.', ARRAY['보험', '해약환급금', '공제', '신용정보원'], 40),
('lib-housing', '주거', '5년 주거 이력', '최근 5년 동안 살았던 곳', '최근 5년 동안 살았던 곳을 순서대로 적어 주세요. 주소는 시·군·구까지만 적어도 돼요.',
 ARRAY['임대차계약서(임차인 경우)', '무상거주확인서(무상 거주 경우)'], 'T4', '["예전 보증금을 돌려받았다면 그 돈을 어디에 썼나요?"]', 'client',
 '신청인의 최근 5년간 주거 현황은 별지 ○ 기재와 같습니다.', ARRAY['주거', '무상거주', '임대차', '보증금', '거주'], 50),
('lib-property', '재산 취득·처분', '5년 재산 취득·처분', '최근 5년 동안 사고판 재산', '최근 5년 안에 사거나 판 부동산·자동차 등을 적어 주세요.', ARRAY['위택스 지방세 납부 내역', '자동차등록원부(해당 시)'], 'T5', '[]', 'client',
 '신청인의 최근 5년간 재산 취득·처분 내역은 별지 ○ 기재와 같습니다.', ARRAY['처분', '취득', '부동산', '자동차', '매매'], 60),
('lib-business', '영업', '영업 자료', '가게(사업장) 사진과 영업 자료', '사업장 안쪽 사진 4장, 바깥 사진 2장과 영업 비품 목록, 12개월 매출·경비 자료를 보내 주세요.',
 ARRAY['사업자등록 사실증명', '12개월 매출·경비 증빙', '사업장 사진(안 4장·밖 2장)'], 'T10', '[]', 'client',
 '신청인의 영업 현황과 비품 내역은 별지 ○ 기재와 같으며 사업장 사진을 소명자료로 제출합니다.', ARRAY['영업', '사업장', '비품', '매출', '수입상황표', '사진'], 70),
('lib-income', '소득 산정', '월 소득 산정 근거', '월 소득을 확인할 자료', '급여를 받는다면 최근 급여명세서·원천징수영수증을, 사업자라면 매출·경비 자료를 보내 주세요.',
 ARRAY['급여명세서(최근 6개월)', '근로소득 원천징수영수증', '소득금액증명'], 'T6', '[]', 'both',
 '신청인의 월 평균 소득 산정 근거는 별지 ○ 기재와 같습니다.', ARRAY['소득', '원천징수', '급여', '4대보험', '소득금액증명', '부가세'], 80),
('lib-bank', '금융거래', '큰 금액 입출금 사용처', '큰 금액이 들어오고 나간 이유', '통장에서 100만 원 이상 들어오거나 나간 거래마다 어디에 썼는지(또는 어디서 받았는지) 적어 주세요.',
 ARRAY['계좌정보통합조회', '거래내역(최근 1년)'], 'T2', '[]', 'client',
 '신청인 명의 계좌의 100만 원 이상 입출금 내역과 사용처는 별지 ○ 기재와 같습니다.', ARRAY['입출금', '거래내역', '계좌', '통장', '100만'], 90),
('lib-closed-account', '금융거래', '해지 계좌', '해지한 계좌', '해지한 계좌가 있으면 기관·계좌 끝 4자리·해지일·잔액을 적어 주세요.', ARRAY['해지 계좌 거래내역'], 'T8', '[]', 'client',
 '신청인의 해지 계좌 내역은 별지 ○ 기재와 같습니다.', ARRAY['해지 계좌', '해지계좌'], 95),
('lib-stock', '금융거래', '주식·가상자산', '주식·가상자산 자료', '증권·가상자산 계좌 잔고와 최근 1년 거래 내역을 보내 주세요.', ARRAY['예탁결제원 주식 보유 조회', '잔고 증명', '1년 거래 내역'], 'T9', '[]', 'client',
 '신청인의 주식·가상자산 보유 및 거래 내역은 별지 ○ 기재와 같습니다.', ARRAY['주식', '가상자산', '코인', '증권', '예탁'], 97),
('lib-debt-history', '채무 증대 경위', '연도별 채무 증대 경위', '빚이 늘어난 사정', '해마다 빚이 늘어난 사정과 빌린 돈을 어디에 썼는지 사실대로 적어 주세요. 사실과 다르면 법원 심사에 불리할 수 있어요.',
 ARRAY['요양급여 내역(5년, 해당 시)'], 'T7', '["가장 크게 빚이 늘어난 해와 그 이유는 무엇인가요?"]', 'client',
 '신청인의 연도별 채무 증대 경위는 별지 ○ 기재와 같습니다.', ARRAY['채무 증대', '증대 경위', '사용처', '진술서', '요양급여'], 100),
('lib-loan-use', '채무 증대 경위', '대출금 사용처', '대출받은 돈을 쓴 곳', '대출마다 받은 날·금액과 쓴 곳을 적어 주세요.', '{}', 'T1', '[]', 'client',
 '신청인의 대출금 사용처는 별지 ○ 기재와 같습니다.', ARRAY['대출금 사용처', '차용금', '사용내역'], 105),
('lib-family', '가족', '배우자·가족 자료', '배우자·가족 자료', '배우자 재산·소득 자료, 이혼했다면 재산분할 자료, 양육비를 주거나 받는다면 그 자료를 보내 주세요.',
 ARRAY['배우자 소득 자료', '배우자 재산 자료', '양육비 소명 자료(해당 시)'], NULL, '[]', 'client',
 '배우자 및 가족 관련 소명자료를 소갑 제○호증으로 제출합니다.', ARRAY['배우자', '이혼', '재산분할', '양육비', '가족'], 110),
('lib-immigration', '출입국', '출입국 사실증명', '출입국 사실증명', '정부24에서 "출입국에 관한 사실증명"을 발급받아 올려 주세요.', ARRAY['출입국에 관한 사실증명'], NULL, '[]', 'client',
 '출입국에 관한 사실증명을 소갑 제○호증으로 제출합니다.', ARRAY['출입국'], 120),
('lib-form', '형식', '목록 재제출·발급일', '최근 발급 서류 다시 받기', '법원이 2개월 안에 발급한 서류를 요구했어요. 사무소가 알려 드리는 서류를 다시 발급해 주세요.', '{}', NULL, '[]', 'office',
 '보정권고에 따라 각 목록을 정정하여 전부 다시 제출합니다.', ARRAY['재제출', '2개월', '요약보정서', '목록 차례'], 130),
('lib-prior-case', '종전 사건', '종전 사건 비교', '예전 회생·파산 사건', '예전에 회생·파산을 신청한 적이 있으면 사건 정보를 알려 주세요.', '{}', 'T11', '[]', 'office',
 '종전 사건과의 비교는 별지 ○ 기재와 같습니다.', ARRAY['종전 사건', '이전 사건', '면책', '폐지'], 140)
ON CONFLICT (id) DO NOTHING;
