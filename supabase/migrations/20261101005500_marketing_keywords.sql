-- 키워드 은행 (M-7, 04 기획서 8장)
-- 상시 주제를 고르는 근거: 키워드·묶음(클러스터)·검색 의도·목표 페이지·다룬 여부·우선순위·월 검색량(검색광고 도구에서 옮겨 적기)
-- 추세는 네이버 데이터랩 검색어 트렌드(최근 12개월, 키워드마다 따로 → 모양만 비교)로 관리자가 새로고침한다.
-- 관리자만 읽고 쓴다. 500개까지. 개인정보 없음.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL CHECK (char_length(btrim(keyword)) BETWEEN 2 AND 40),
  cluster text CHECK (cluster IS NULL OR char_length(cluster) <= 40),
  intent text NOT NULL DEFAULT 'info' CHECK (intent IN ('info', 'procedure', 'cost', 'compare', 'urgent', 'other')),
  target_path text CHECK (target_path IS NULL OR (char_length(target_path) <= 200 AND target_path ~ '^/[^[:space:]]*$')),
  covered boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  monthly_volume integer CHECK (monthly_volume IS NULL OR monthly_volume BETWEEN 0 AND 100000000),
  season_note text CHECK (season_note IS NULL OR char_length(season_note) <= 100),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  trend jsonb CHECK (trend IS NULL OR jsonb_typeof(trend) = 'array'),
  trend_at timestamptz,
  last_used_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_keywords_kw_uq ON public.marketing_keywords (lower(btrim(keyword)));

ALTER TABLE public.marketing_keywords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_keywords FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_keywords TO authenticated;
DROP POLICY IF EXISTS marketing_keywords_admin ON public.marketing_keywords;
CREATE POLICY marketing_keywords_admin ON public.marketing_keywords FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.marketing_keywords_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.keyword := btrim(NEW.keyword);
  NEW.cluster := nullif(btrim(coalesce(NEW.cluster, '')), '');
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM marketing_keywords) >= 500 THEN
    RAISE EXCEPTION 'at most 500 keywords' USING ERRCODE = '22023';
  END IF;
  -- 추세 칸은 서버(데이터랩 새로고침)만 바꾼다
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trend := NULL; NEW.trend_at := NULL;
    ELSE
      NEW.trend := OLD.trend; NEW.trend_at := OLD.trend_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS marketing_keywords_guard ON public.marketing_keywords;
CREATE TRIGGER marketing_keywords_guard BEFORE INSERT OR UPDATE ON public.marketing_keywords
  FOR EACH ROW EXECUTE FUNCTION public.marketing_keywords_guard();

-- 서버(데이터랩): 추세 저장. 최대 24개 점(월), 비율 0~100
CREATE OR REPLACE FUNCTION public.marketing_keyword_set_trend(p_id uuid, p_trend jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(coalesce(p_trend, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_trend, '[]'::jsonb)) > 24 THEN
    RAISE EXCEPTION 'invalid trend' USING ERRCODE = '22023';
  END IF;
  UPDATE marketing_keywords SET trend = coalesce(p_trend, '[]'::jsonb), trend_at = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.marketing_keyword_set_trend(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_keyword_set_trend(uuid, jsonb) TO service_role;

-- 처음 묶음 (04 기획서 8장 예시 주제, 다룬 여부·목표 페이지는 관리자가 확인)
INSERT INTO public.marketing_keywords (keyword, cluster, intent, priority, season_note) VALUES
  ('개인회생 자격', '자격·조건', 'info', 4, NULL),
  ('개인회생 기간', '절차', 'procedure', 4, NULL),
  ('개인회생 변제금 계산', '변제금', 'cost', 5, '7월 기준 중위소득 발표 뒤 수요 증가'),
  ('개인회생 비용', '비용', 'cost', 4, NULL),
  ('개인파산 조건', '파산', 'info', 3, NULL),
  ('급여 압류 해제', '압류·추심', 'urgent', 4, NULL),
  ('불법추심 신고', '압류·추심', 'urgent', 3, NULL),
  ('신용회복 채무조정', '다른 제도', 'compare', 3, NULL),
  ('새출발기금', '다른 제도', 'compare', 3, '공고 시기에 수요 증가'),
  ('개인회생 생계비', '변제금', 'info', 3, '연초 기준 바뀜')
ON CONFLICT DO NOTHING;
