-- ============================================================
-- CT-1 콘텐츠 서버 저장 (칼럼·Q&A·후기·배너·공지·변호사 문의·플랫폼 설정)
--  * 콘텐츠 표에 게시 상태·예시 표시·순서·버전·수정자 칸
--  * 공개 읽기는 '게시' 상태만, 관리자는 전부
--  * 변호사 공개 Q&A 답변은 서버 함수로만 (바로 게시 + 금지 표현이 걸리면 검토 대기, CT-Q2)
--  * 변호사 문의 등록 때 답변 칸을 채우지 못하게
--  * 상담 요청 쿨다운 확인 함수 (계정 기준, CT-Q5)
-- ============================================================

-- 1) 공개 콘텐츠 표 공통 칸 -------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['news_articles','client_qas','success_reviews','main_banners','notices'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT ''published'',
      ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_status_check');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (status IN (''draft'',''published'',''hidden''))', t, t || '_status_check');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()', t);
  END LOOP;
END $$;

ALTER TABLE public.lawyer_inquiries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.lawyer_inquiries ALTER COLUMN created_at SET DEFAULT now();

-- 수정 때 버전·시각·수정자 자동 기록
CREATE OR REPLACE FUNCTION public.cms_touch_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.data IS DISTINCT FROM OLD.data
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.is_example IS DISTINCT FROM OLD.is_example
       OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      NEW.version := OLD.version + 1;
    ELSE
      NEW.version := OLD.version;
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['news_articles','client_qas','success_reviews','main_banners','notices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.cms_touch_row()', t || '_touch', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lawyer_inquiries_touch ON public.lawyer_inquiries;
CREATE TRIGGER lawyer_inquiries_touch BEFORE UPDATE ON public.lawyer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.cms_touch_updated_at();

-- 2) 공개 읽기 = 게시 상태만 ------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['news_articles','client_qas','success_reviews','main_banners','notices'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (status = ''published'' OR public.is_platform_admin())', t || '_public_select', t);
  END LOOP;
END $$;

-- 3) 변호사 문의: 등록 때 답변 칸 금지 -------------------------------------
DROP POLICY IF EXISTS lawyer_inquiries_own_insert ON public.lawyer_inquiries;
CREATE POLICY lawyer_inquiries_own_insert ON public.lawyer_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (
      (data ->> 'lawyerId') = public.current_lawyer_profile_id()
      AND coalesce(data ->> 'replyContent', '') = ''
      AND coalesce(data ->> 'status', 'pending') = 'pending'
    )
  );

-- 4) 변호사 공개 Q&A 답변 ----------------------------------------------------
-- 금지 표현 목록은 src/services/proposalCompliance.ts DEFAULT_PROHIBITED_EXPRESSIONS + QNA_EXTRA 와 같게 유지
CREATE OR REPLACE FUNCTION public.qna_flagged_terms(p_text text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(term), ARRAY[]::text[])
  FROM unnest(ARRAY[
    '100% 보장','100% 비밀 보장','인가 보장','면책 보장','무조건','확실히','반드시 인가',
    '전격 면책','획기적','완벽히 방어',
    '전액 탕감','탕감 보장','최대 90%','성공률','승소율','전담 변호사','변호사 배정','매칭'
  ]) AS term
  WHERE position(replace(term, ' ', '') IN replace(coalesce(p_text, ''), ' ', '')) > 0;
$$;

CREATE OR REPLACE FUNCTION public.lawyer_answer_client_qa(p_qa_id text, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lawyer_id text := public.current_approved_lawyer_id();
  v_row public.client_qas%ROWTYPE;
  v_data jsonb;
  v_text text := btrim(coalesce(p_answer, ''));
  v_name text;
  v_avatar text;
  v_flags text[];
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_answer jsonb;
BEGIN
  IF v_lawyer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_lawyer', 'message', '승인된 변호사만 답변할 수 있습니다.');
  END IF;
  IF char_length(v_text) < 10 OR char_length(v_text) > 3000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_length', 'message', '답변은 10자 이상 3,000자 이하로 입력해 주세요.');
  END IF;

  SELECT * INTO v_row FROM public.client_qas WHERE id = p_qa_id AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', '게시 중인 질문을 찾지 못했습니다.');
  END IF;
  v_data := coalesce(v_row.data, '{}'::jsonb);

  IF (v_data ->> 'lawyerId') = v_lawyer_id
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(v_data -> 'additionalAnswers', '[]'::jsonb)) a WHERE a ->> 'lawyerId' = v_lawyer_id)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(v_data -> 'pendingAnswers', '[]'::jsonb)) a WHERE a ->> 'lawyerId' = v_lawyer_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_answered', 'message', '이미 답변한 질문입니다.');
  END IF;

  SELECT l.name, coalesce(nullif(l.avatar, ''), '') INTO v_name, v_avatar FROM public.lawyers l WHERE l.id = v_lawyer_id;
  v_flags := public.qna_flagged_terms(v_text);

  v_answer := jsonb_build_object(
    'lawyerId', v_lawyer_id,
    'lawyerName', coalesce(v_name, ''),
    'lawyerAvatar', coalesce(v_avatar, ''),
    'answer', v_text,
    'badge', '변호사 답변',
    'createdAt', v_now
  );

  IF array_length(v_flags, 1) IS NOT NULL THEN
    -- 걸린 답변은 검토 대기 (공개 화면에 나오지 않음)
    v_answer := v_answer || jsonb_build_object('flaggedTerms', to_jsonb(v_flags));
    v_data := jsonb_set(v_data, '{pendingAnswers}', coalesce(v_data -> 'pendingAnswers', '[]'::jsonb) || jsonb_build_array(v_answer));
  ELSIF coalesce(v_data ->> 'answer', '') = '' THEN
    v_data := v_data || jsonb_build_object(
      'answer', v_text,
      'lawyerId', v_lawyer_id,
      'lawyerName', coalesce(v_name, ''),
      'lawyerAvatar', coalesce(v_avatar, ''),
      'answeredAt', v_now,
      'badge', '변호사 답변',
      'status', 'answered'
    );
  ELSE
    v_data := jsonb_set(v_data, '{additionalAnswers}', coalesce(v_data -> 'additionalAnswers', '[]'::jsonb) || jsonb_build_array(v_answer));
    v_data := v_data || jsonb_build_object('status', 'answered');
  END IF;

  UPDATE public.client_qas SET data = v_data WHERE id = p_qa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'held', array_length(v_flags, 1) IS NOT NULL,
    'flaggedTerms', to_jsonb(v_flags),
    'data', v_data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lawyer_answer_client_qa(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_answer_client_qa(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.qna_flagged_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qna_flagged_terms(text) TO authenticated;

-- 5) 상담 요청 쿨다운 (계정 기준) --------------------------------------------
-- 마지막 새 상담 요청 뒤 남은 초. 0이면 바로 요청 가능. 쿨다운은 matching_config('main').data.hours (없으면 24)
CREATE OR REPLACE FUNCTION public.my_consult_cooldown_remaining()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_hours numeric;
  v_last timestamptz;
  v_raw jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;
  SELECT data INTO v_raw FROM public.matching_config WHERE id = 'main';
  v_hours := CASE
    WHEN v_raw IS NULL THEN 24
    WHEN jsonb_typeof(v_raw) = 'number' THEN (v_raw #>> '{}')::numeric
    WHEN jsonb_typeof(v_raw -> 'hours') = 'number' THEN (v_raw ->> 'hours')::numeric
    ELSE 24 END;
  IF v_hours IS NULL OR v_hours <= 0 THEN
    RETURN 0;
  END IF;
  SELECT max(created_at) INTO v_last
  FROM public.consult_requests
  WHERE client_id = v_uid AND created_by_lawyer_id IS NULL;
  IF v_last IS NULL THEN
    RETURN 0;
  END IF;
  RETURN greatest(0, ceil(extract(epoch FROM (v_last + make_interval(secs => (v_hours * 3600)::double precision)) - now()))::integer);
END;
$$;

REVOKE ALL ON FUNCTION public.my_consult_cooldown_remaining() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_consult_cooldown_remaining() TO authenticated;

-- 6) 쿨다운 값 범위 (0~168시간) ---------------------------------------------
ALTER TABLE public.matching_config DROP CONSTRAINT IF EXISTS matching_config_hours_check;
ALTER TABLE public.matching_config ADD CONSTRAINT matching_config_hours_check CHECK (
  id <> 'main'
  OR jsonb_typeof(data) <> 'object'
  OR data ->> 'hours' IS NULL
  OR ((data ->> 'hours') ~ '^[0-9]+(\.[0-9]+)?$' AND (data ->> 'hours')::numeric BETWEEN 0 AND 168)
);
