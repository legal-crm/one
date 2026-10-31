-- AI 검색 인용 점검 (M-5, 04 기획서 6-4)
-- 목표 질문(최대 50개)을 관리하고, 주 1회 서버가 Gemini(구글 검색 근거 모드)로 물어 답변 출처에 mykim.kr이 있는지 기록한다.
-- 경로: pg_cron(월 06:00~08:50 KST, 10분마다) → dispatch_geo_citation_checks() → pg_net → /api/generate-statement {mode:'geo-cron'}
--        (호출 토큰 = vault 'mykim_cron_token', check_cron_token). 한 번에 5개씩, 6일 안에 점검한 질문은 건너뛴다.
-- 관리자만 읽고 쓴다. 기록은 서버(service role)만 넣는다. 네이버 AI 브리핑·Copilot은 공식 API가 없어 화면의 수동 점검 링크로.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.geo_target_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (char_length(btrim(question)) BETWEEN 5 AND 200),
  target_path text CHECK (target_path IS NULL OR (char_length(target_path) <= 200 AND target_path ~ '^/[^[:space:]]*$')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS geo_target_questions_question_uq ON public.geo_target_questions (lower(btrim(question)));

CREATE TABLE IF NOT EXISTS public.geo_citation_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.geo_target_questions(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  engine text NOT NULL DEFAULT 'gemini_search' CHECK (engine IN ('gemini_search')),
  model text CHECK (model IS NULL OR char_length(model) <= 60),
  ok boolean NOT NULL,
  cited boolean NOT NULL DEFAULT false,
  cited_rank integer CHECK (cited_rank IS NULL OR cited_rank BETWEEN 1 AND 50),
  source_count integer NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) <= 15),
  answer_excerpt text CHECK (answer_excerpt IS NULL OR char_length(answer_excerpt) <= 600),
  error text CHECK (error IS NULL OR char_length(error) <= 300),
  trigger_kind text NOT NULL DEFAULT 'cron' CHECK (trigger_kind IN ('cron', 'manual'))
);
CREATE INDEX IF NOT EXISTS geo_citation_checks_q_idx ON public.geo_citation_checks (question_id, checked_at DESC);

ALTER TABLE public.geo_target_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_citation_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_target_questions FROM anon, authenticated;
REVOKE ALL ON public.geo_citation_checks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_target_questions TO authenticated;
GRANT SELECT ON public.geo_citation_checks TO authenticated;

DROP POLICY IF EXISTS geo_questions_admin ON public.geo_target_questions;
CREATE POLICY geo_questions_admin ON public.geo_target_questions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS geo_checks_admin_read ON public.geo_citation_checks;
CREATE POLICY geo_checks_admin_read ON public.geo_citation_checks FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 질문 50개까지 (활성 기준), 고친 시각
CREATE OR REPLACE FUNCTION public.geo_target_questions_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.question := btrim(NEW.question);
  NEW.updated_at := now();
  IF NEW.active AND (TG_OP = 'INSERT' OR NOT OLD.active) AND
     (SELECT count(*) FROM geo_target_questions WHERE active AND id <> NEW.id) >= 50 THEN
    RAISE EXCEPTION 'at most 50 active questions' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS geo_target_questions_guard ON public.geo_target_questions;
CREATE TRIGGER geo_target_questions_guard BEFORE INSERT OR UPDATE ON public.geo_target_questions
  FOR EACH ROW EXECUTE FUNCTION public.geo_target_questions_guard();

-- 서버: 이번에 점검할 질문 (6일 안에 점검한 것 제외, 오래된 순, 최대 p_limit)
CREATE OR REPLACE FUNCTION public.geo_due_questions(p_limit integer DEFAULT 5, p_force_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, question text, target_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question, q.target_path
  FROM geo_target_questions q
  LEFT JOIN LATERAL (SELECT max(c.checked_at) AS last_at FROM geo_citation_checks c WHERE c.question_id = q.id) l ON true
  WHERE q.active AND (
    (p_force_id IS NOT NULL AND q.id = p_force_id)
    OR (p_force_id IS NULL AND (l.last_at IS NULL OR l.last_at < now() - interval '6 days')))
  ORDER BY l.last_at NULLS FIRST, q.sort_order, q.created_at
  LIMIT greatest(1, least(coalesce(p_limit, 5), 10));
$$;
REVOKE ALL ON FUNCTION public.geo_due_questions(integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_due_questions(integer, uuid) TO service_role;

-- 서버: 결과 한 건
CREATE OR REPLACE FUNCTION public.geo_record_check(p_question_id uuid, p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO geo_citation_checks (question_id, model, ok, cited, cited_rank, source_count, sources, answer_excerpt, error, trigger_kind)
  VALUES (p_question_id, left(p ->> 'model', 60), coalesce((p ->> 'ok')::boolean, false), coalesce((p ->> 'cited')::boolean, false),
          nullif((p ->> 'cited_rank')::int, 0), greatest(0, coalesce((p ->> 'source_count')::int, 0)),
          coalesce((SELECT jsonb_agg(e) FROM (SELECT e FROM jsonb_array_elements(coalesce(p -> 'sources', '[]'::jsonb)) e LIMIT 15) s), '[]'::jsonb),
          left(p ->> 'answer_excerpt', 600), left(p ->> 'error', 300),
          CASE WHEN p ->> 'trigger_kind' = 'manual' THEN 'manual' ELSE 'cron' END);
END;
$$;
REVOKE ALL ON FUNCTION public.geo_record_check(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_record_check(uuid, jsonb) TO service_role;

-- 관리자 화면: 질문별 최근 결과 + 최근 8주 인용률
CREATE OR REPLACE FUNCTION public.admin_geo_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'question', q.question, 'target_path', q.target_path, 'note', q.note, 'active', q.active, 'sort_order', q.sort_order,
        'last', (SELECT to_jsonb(c) - 'question_id' FROM geo_citation_checks c WHERE c.question_id = q.id ORDER BY c.checked_at DESC LIMIT 1),
        'cited_8w', (SELECT count(*) FILTER (WHERE c.cited) FROM geo_citation_checks c WHERE c.question_id = q.id AND c.ok AND c.checked_at > now() - interval '56 days'),
        'checked_8w', (SELECT count(*) FROM geo_citation_checks c WHERE c.question_id = q.id AND c.ok AND c.checked_at > now() - interval '56 days'))
        ORDER BY q.active DESC, q.sort_order, q.created_at)
      FROM geo_target_questions q), '[]'::jsonb),
    'weekly', coalesce((
      SELECT jsonb_agg(jsonb_build_object('week', w.week, 'checked', w.checked, 'cited', w.cited) ORDER BY w.week)
      FROM (SELECT to_char(date_trunc('week', c.checked_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS week,
                   count(*) AS checked, count(*) FILTER (WHERE c.cited) AS cited
            FROM geo_citation_checks c WHERE c.ok AND c.checked_at > now() - interval '56 days'
            GROUP BY 1) w), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_geo_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_geo_overview() TO authenticated;

-- 정기 호출: 점검할 질문이 있을 때만 서버를 부른다
CREATE OR REPLACE FUNCTION public.dispatch_geo_citation_checks()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token text;
  v_req bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.geo_due_questions(1, NULL)) THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1;
  IF v_token IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := 'https://mykim.kr/api/generate-statement',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mykim-cron', v_token),
    body := '{"mode":"geo-cron"}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_req;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_geo_citation_checks() FROM PUBLIC, anon, authenticated;

-- 1년 지난 기록 정리
CREATE OR REPLACE FUNCTION public.purge_geo_citation_checks()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM geo_citation_checks WHERE checked_at < now() - interval '1 year' RETURNING 1) SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.purge_geo_citation_checks() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_geo_citation_checks', 'mykim_purge_geo_citation_checks');
  -- 월요일 06:00~08:50 KST = 일요일 21:00~23:50 UTC, 10분마다 (한 번에 5개)
  PERFORM cron.schedule('mykim_geo_citation_checks', '*/10 21-23 * * 0', 'SELECT public.dispatch_geo_citation_checks()');
  -- 04:05 KST
  PERFORM cron.schedule('mykim_purge_geo_citation_checks', '5 19 * * *', 'SELECT public.purge_geo_citation_checks()');
END;
$$;

-- 지금 화면에 있던 질문 5개로 시작 (목표 페이지는 사이트 주소 기준 경로)
INSERT INTO public.geo_target_questions (question, target_path, note, sort_order) VALUES
  ('가족이나 회사 모르게 개인회생 할 수 있나요?', '/articles/secret-rehabilitation.html', '비공개 상담, 가명 상담, 송달 주소', 1),
  ('코인·주식 투자 손실 빚도 개인회생 되나요?', '/articles/crypto-stock-debt.html', '투자 손실 소명, 청산가치', 2),
  ('개인회생 변호사 비용과 분납은 어떻게 되나요?', '/guide/rehabilitation-cost.html', '수임료 구성, 분납, 변호사 직접 선택', 3),
  ('급여 압류 통지를 받았는데 멈출 수 있나요?', '/articles/wage-garnishment-defense.html', '중지명령, 금지명령, 압류 적립금', 4),
  ('개인회생 신청 자격 조건이 뭔가요?', '/guide/rehabilitation-eligibility.html', '소득 요건, 채무 한도, 청산가치', 5)
ON CONFLICT DO NOTHING;
