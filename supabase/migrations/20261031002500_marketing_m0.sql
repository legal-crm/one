-- ============================================================
-- M0 (마케팅·SEO 출시 전): 측정 기반·SEO 기록 서버 저장
--  * consult_requests.first_touch: 첫 유입 경로(UTM 출처·매체·캠페인·첫 방문 페이지 경로·참조 도메인·날짜)만. 개인정보 없음.
--    처음 저장된 값은 바뀌지 않는다(나중 방문이 덮어쓰지 않게)
--  * admin_channel_inflow(): 기간별 채널 상담 요청 수 (관리자 전용, 건수만)
--  * admin_seo_state: 검색 포털 등록 체크리스트·서치콘솔 속성 (이전: 관리자 브라우저)
--  * seo_indexnow_log: IndexNow 전송 기록 (수동·빌드 자동, 이전: 관리자 브라우저)
--  * SNS 운영 채널(sameAs)은 platform_config id 'social_channels' 행에 둔다(누구나 읽기, 관리자 쓰기 — 기존 정책)
-- ============================================================

ALTER TABLE public.consult_requests ADD COLUMN IF NOT EXISTS first_touch jsonb;
ALTER TABLE public.consult_requests DROP CONSTRAINT IF EXISTS consult_requests_first_touch_check;
ALTER TABLE public.consult_requests ADD CONSTRAINT consult_requests_first_touch_check
  CHECK (first_touch IS NULL OR (jsonb_typeof(first_touch) = 'object' AND length(first_touch::text) <= 800));

CREATE OR REPLACE FUNCTION public.consult_requests_first_touch_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v jsonb := '{}'::jsonb; k text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.first_touch IS NOT NULL THEN
    NEW.first_touch := OLD.first_touch;
    RETURN NEW;
  END IF;
  IF NEW.first_touch IS NULL THEN RETURN NEW; END IF;
  -- 허용한 칸만, 짧은 글자로 (전화번호·이메일 같은 값이 섞이지 않게 형식 제한)
  FOREACH k IN ARRAY ARRAY['source', 'medium', 'campaign', 'content', 'term', 'landing', 'referrer', 'first_at'] LOOP
    IF NEW.first_touch ? k AND jsonb_typeof(NEW.first_touch -> k) = 'string' THEN
      -- 첫 페이지는 경로만 (주소의 ?·# 뒤는 버림)
      v := v || jsonb_build_object(k, left(regexp_replace(
        CASE WHEN k = 'landing' THEN split_part(split_part(NEW.first_touch ->> k, '?', 1), '#', 1) ELSE NEW.first_touch ->> k END,
        '[^A-Za-z0-9가-힣._/:\- ]', '', 'g'), 80));
    END IF;
  END LOOP;
  NEW.first_touch := CASE WHEN v = '{}'::jsonb THEN NULL ELSE v END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS consult_requests_first_touch_guard ON public.consult_requests;
CREATE TRIGGER consult_requests_first_touch_guard BEFORE INSERT OR UPDATE OF first_touch ON public.consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.consult_requests_first_touch_guard();

-- 채널별 상담 요청 수 (관리자 전용) — 출처 없음은 '직접·알 수 없음'
CREATE OR REPLACE FUNCTION public.admin_channel_inflow(p_from date, p_to date)
RETURNS TABLE(source text, medium text, requests bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT coalesce(nullif(r.first_touch ->> 'source', ''),
                  CASE WHEN nullif(r.first_touch ->> 'referrer', '') IS NOT NULL THEN 'ref:' || (r.first_touch ->> 'referrer') ELSE '(직접·알 수 없음)' END) AS source,
         coalesce(nullif(r.first_touch ->> 'medium', ''), '') AS medium,
         count(*)::bigint
  FROM consult_requests r
  WHERE (r.created_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN p_from AND p_to
  GROUP BY 1, 2
  ORDER BY 3 DESC
  LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_channel_inflow(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_channel_inflow(date, date) TO authenticated;

-- 검색 포털 등록 체크리스트 등 관리자 SEO 설정 (관리자만)
CREATE TABLE IF NOT EXISTS public.admin_seo_state (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{1,40}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (length(data::text) <= 50000),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_seo_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_seo_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_seo_state TO authenticated;
GRANT ALL ON public.admin_seo_state TO service_role;
DROP POLICY IF EXISTS admin_seo_state_admin ON public.admin_seo_state;
CREATE POLICY admin_seo_state_admin ON public.admin_seo_state FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- IndexNow 전송 기록 (추가만)
CREATE TABLE IF NOT EXISTS public.seo_indexnow_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('manual', 'build')),
  urls text[] NOT NULL,
  ok boolean NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text CHECK (error IS NULL OR char_length(error) <= 300),
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_indexnow_log_created_idx ON public.seo_indexnow_log (created_at DESC);
ALTER TABLE public.seo_indexnow_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seo_indexnow_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seo_indexnow_log TO authenticated;
GRANT ALL ON public.seo_indexnow_log TO service_role;
DROP POLICY IF EXISTS seo_indexnow_log_admin_read ON public.seo_indexnow_log;
CREATE POLICY seo_indexnow_log_admin_read ON public.seo_indexnow_log FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 1년 지난 전송 기록 정리 (기존 정리 작업 시각과 겹치지 않게 03:45 KST)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_seo_indexnow_log';
  PERFORM cron.schedule('mykim_purge_seo_indexnow_log', '45 18 * * *', $c$DELETE FROM public.seo_indexnow_log WHERE created_at < now() - interval '1 year'$c$);
END;
$$;
