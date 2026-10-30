-- ============================================================
-- 보정 대응 후속 (CR-3·CR-8·CR-11·CR-12)
-- CR-3  원문 파일 읽기(OCR) 결과를 회차에 남긴다: 읽은 파일·시각·찾은 값(법원·사건번호·기한, 참고용 — 자동 반영 안 함).
--       같은 파일을 두 번 읽어 항목이 겹치는 것을 화면에서 막는다.
-- CR-8  수정본(변제계획안·채권자목록 등)을 회차에 연결하고, 회생위원 보수·양육비 조항 확인 기록을 남긴다 (revised_docs·checks).
-- CR-11 보정기간 연장 신청 → 결정(허가: 새 기한 / 불허) 기록. 원래 기한은 보관한다.
-- CR-12 사무소 보정 통계(개인정보 없음)·선례 문안 보관함(변호사가 확정한 문안만, 이름·사건번호 가림)
--       회생동행 '내 보정 정리'(나홀로·타 사무소 이용자 본인용 정리표, 보정서 자동 작성 없음)
-- ============================================================

ALTER TABLE public.correction_orders
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'none' CHECK (ocr_status IN ('none', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS ocr_at timestamptz,
  ADD COLUMN IF NOT EXISTS ocr_file_id text,
  ADD COLUMN IF NOT EXISTS ocr_found jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ocr_found) = 'object'),
  ADD COLUMN IF NOT EXISTS revised_docs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(revised_docs) = 'array' AND jsonb_array_length(revised_docs) <= 30),
  ADD COLUMN IF NOT EXISTS checks jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checks) = 'object'),
  ADD COLUMN IF NOT EXISTS extension_requested_on date,
  ADD COLUMN IF NOT EXISTS extension_days integer CHECK (extension_days IS NULL OR extension_days BETWEEN 1 AND 90),
  ADD COLUMN IF NOT EXISTS extension_decision text CHECK (extension_decision IS NULL OR extension_decision IN ('granted', 'denied')),
  ADD COLUMN IF NOT EXISTS extension_decided_on date,
  ADD COLUMN IF NOT EXISTS original_court_due date;

-- ── CR-11 연장 신청·결정 ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_correction_extension(p_order_id uuid, p_action text, p jsonb DEFAULT '{}'::jsonb)
RETURNS public.correction_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o correction_orders%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_days integer;
  v_note text;
  v_on date;
  v_due date;
  v_client uuid;
BEGIN
  SELECT * INTO o FROM correction_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR NOT public.correction_can(o.office_id, o.case_key, 'correction.manage') THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF o.status = 'submitted' THEN RAISE EXCEPTION 'submitted correction is locked' USING ERRCODE = 'check_violation'; END IF;

  IF p_action = 'request' THEN
    v_days := nullif(p ->> 'days', '')::integer;
    v_note := nullif(btrim(coalesce(p ->> 'note', '')), '');
    v_on := coalesce(nullif(p ->> 'requested_on', '')::date, v_today);
    IF v_days IS NULL OR v_days < 1 OR v_days > 90 THEN RAISE EXCEPTION 'extension days must be 1..90' USING ERRCODE = '22023'; END IF;
    IF v_note IS NULL THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
    IF v_on < o.served_on OR v_on > v_today THEN RAISE EXCEPTION 'request date must be between served date and today' USING ERRCODE = '22023'; END IF;
    UPDATE correction_orders SET status = 'extension', extension_requested_on = v_on, extension_days = v_days,
           extension_note = left(v_note, 1000), extension_decision = NULL, extension_decided_on = NULL
     WHERE id = o.id RETURNING * INTO o;
  ELSIF p_action = 'granted' THEN
    v_due := nullif(p ->> 'new_due', '')::date;
    v_on := coalesce(nullif(p ->> 'decided_on', '')::date, v_today);
    IF v_due IS NULL OR v_due <= coalesce(o.court_due, o.served_on) THEN RAISE EXCEPTION 'new due must be after current due' USING ERRCODE = '22023'; END IF;
    UPDATE correction_orders SET original_court_due = coalesce(original_court_due, court_due),
           period_kind = 'fixed', fixed_due = v_due, period_days = NULL, office_due_manual = false, office_due = NULL,
           status = 'drafting', extension_decision = 'granted', extension_decided_on = v_on
     WHERE id = o.id RETURNING * INTO o;
    v_client := public.case_key_client_user(o.case_key);
    IF v_client IS NOT NULL AND EXISTS (SELECT 1 FROM correction_items i WHERE i.order_id = o.id AND i.status <> 'draft' AND i.owner <> 'office') THEN
      PERFORM public.notify_user(v_client, 'client', NULL, 'correction_extended', '보정 자료를 낼 기간이 늘어났어요',
        '사무소가 안내하는 날짜까지 남은 자료를 보내 주세요.', 'case_correction', o.case_key, 'correction_ext:' || o.id);
    END IF;
  ELSIF p_action = 'denied' THEN
    v_on := coalesce(nullif(p ->> 'decided_on', '')::date, v_today);
    UPDATE correction_orders SET status = 'drafting', extension_decision = 'denied', extension_decided_on = v_on
     WHERE id = o.id RETURNING * INTO o;
  ELSE
    RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023';
  END IF;
  RETURN o;
END;
$$;
REVOKE ALL ON FUNCTION public.record_correction_extension(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_correction_extension(uuid, text, jsonb) TO authenticated;

-- ── CR-12 사무소 보정 통계 (사무소 안에서만, 개인정보·사건번호 없음, 변호사 간 비교 없음) ──
CREATE OR REPLACE FUNCTION public.office_correction_stats(p_office_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT coalesce(public.has_office_permission(p_office_id, 'correction.manage'), false) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'by_court', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'court') FROM (
        SELECT jsonb_build_object(
          'court', coalesce(nullif(o.court_name, ''), '법원 미입력'),
          'orders', count(*),
          'submitted', count(*) FILTER (WHERE o.status = 'submitted'),
          'avg_days', round(avg(o.submitted_on - o.served_on) FILTER (WHERE o.status = 'submitted'), 1),
          'extensions', count(*) FILTER (WHERE o.extension_requested_on IS NOT NULL)
        ) AS x
        FROM correction_orders o WHERE o.office_id = p_office_id
        GROUP BY coalesce(nullif(o.court_name, ''), '법원 미입력')
      ) s), '[]'::jsonb),
    'by_category', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'items')::int DESC) FROM (
        SELECT jsonb_build_object(
          'court', coalesce(nullif(o.court_name, ''), '법원 미입력'),
          'category', coalesce(nullif(i.category, ''), '분류 없음'),
          'items', count(*),
          'cannot', count(*) FILTER (WHERE i.status = 'cannot_submit'),
          'needs_fix', count(*) FILTER (WHERE i.fix_reason IS NOT NULL)
        ) AS x
        FROM correction_items i JOIN correction_orders o ON o.id = i.order_id
        WHERE i.office_id = p_office_id
        GROUP BY coalesce(nullif(o.court_name, ''), '법원 미입력'), coalesce(nullif(i.category, ''), '분류 없음')
      ) s), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.office_correction_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_correction_stats(text) TO authenticated;

-- ── CR-12 선례 문안 보관함 ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.correction_precedents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  category text CHECK (category IS NULL OR char_length(category) <= 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  answer_text text NOT NULL CHECK (char_length(answer_text) BETWEEN 1 AND 20000),
  court_name text CHECK (court_name IS NULL OR char_length(court_name) <= 60),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correction_precedents_office_idx ON public.correction_precedents (office_id, category);
ALTER TABLE public.correction_precedents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.correction_precedents FROM anon;
GRANT SELECT, DELETE ON public.correction_precedents TO authenticated;
DROP POLICY IF EXISTS correction_precedents_read ON public.correction_precedents;
CREATE POLICY correction_precedents_read ON public.correction_precedents FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'correction.manage'));
DROP POLICY IF EXISTS correction_precedents_delete ON public.correction_precedents;
CREATE POLICY correction_precedents_delete ON public.correction_precedents FOR DELETE TO authenticated
  USING (public.has_office_permission(office_id, 'correction.finalize'));
DROP POLICY IF EXISTS account_active_only ON public.correction_precedents;
CREATE POLICY account_active_only ON public.correction_precedents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()));

-- 이름·사건번호·주민번호·전화번호 가리기 (선례 저장 전)
CREATE OR REPLACE FUNCTION public.mask_precedent_text(p_text text, p_terms text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE t text := coalesce(p_text, ''); w text;
BEGIN
  IF p_terms IS NOT NULL THEN
    FOREACH w IN ARRAY p_terms LOOP
      IF char_length(btrim(coalesce(w, ''))) >= 2 THEN t := replace(t, btrim(w), '○○○'); END IF;
    END LOOP;
  END IF;
  t := regexp_replace(t, '(19|20)\d{2}\s*(개회|개하|개단|하단|하면|회단|회합)\s*\d+', '○○○○사건', 'g');
  t := regexp_replace(t, '\d{6}\s*-\s*[1-8]\d{6}', '○○○○○○-○○○○○○○', 'g');
  t := regexp_replace(t, '01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}', '010-○○○○-○○○○', 'g');
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_correction_precedent(p_item_id uuid, p_title text, p_mask_terms text[] DEFAULT '{}')
RETURNS public.correction_precedents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it correction_items%ROWTYPE;
  o correction_orders%ROWTYPE;
  r correction_precedents%ROWTYPE;
BEGIN
  SELECT * INTO it FROM correction_items WHERE id = p_item_id;
  IF it.id IS NULL OR NOT public.correction_can(it.office_id, it.case_key, 'correction.finalize') THEN
    RAISE EXCEPTION 'not allowed (lawyer only)' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(it.answer_text, '')), '') IS NULL THEN RAISE EXCEPTION 'answer text required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM correction_orders WHERE id = it.order_id;
  IF (SELECT count(*) FROM correction_precedents WHERE office_id = it.office_id) >= 500 THEN
    RAISE EXCEPTION 'precedent limit reached' USING ERRCODE = '22023';
  END IF;
  INSERT INTO correction_precedents (office_id, category, title, answer_text, court_name)
  VALUES (it.office_id, it.category,
          left(coalesce(nullif(btrim(p_title), ''), it.client_title, it.category, '보정 답변'), 120),
          left(public.mask_precedent_text(it.answer_text, p_mask_terms), 20000),
          left(o.court_name, 60))
  RETURNING * INTO r;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.save_correction_precedent(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_correction_precedent(uuid, text, text[]) TO authenticated;

-- ── CR-12 회생동행 '내 보정 정리' (본인만, 사무소·관리자 열람 없음) ──
CREATE TABLE IF NOT EXISTS public.client_self_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  court_name text CHECK (court_name IS NULL OR char_length(court_name) <= 60),
  served_on date,
  due_on date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pg_column_size(items) <= 300000)
);
CREATE INDEX IF NOT EXISTS client_self_corrections_user_idx ON public.client_self_corrections (user_id, updated_at DESC);
ALTER TABLE public.client_self_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_self_corrections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_self_corrections TO authenticated;
DROP POLICY IF EXISTS client_self_corrections_own ON public.client_self_corrections;
CREATE POLICY client_self_corrections_own ON public.client_self_corrections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS account_active_only ON public.client_self_corrections;
CREATE POLICY account_active_only ON public.client_self_corrections AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active())) WITH CHECK ((SELECT public.is_account_active()));

CREATE OR REPLACE FUNCTION public.client_self_corrections_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    IF (SELECT count(*) FROM public.client_self_corrections WHERE user_id = NEW.user_id) >= 20 THEN
      RAISE EXCEPTION 'self correction limit reached' USING ERRCODE = '22023';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_self_corrections_guard ON public.client_self_corrections;
CREATE TRIGGER client_self_corrections_guard BEFORE INSERT OR UPDATE ON public.client_self_corrections
  FOR EACH ROW EXECUTE FUNCTION public.client_self_corrections_guard();
