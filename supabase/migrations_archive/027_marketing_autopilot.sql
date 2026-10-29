-- ============================================================================
-- 027. 마케팅 데일리 오토파일럿 (캠페인·채널 게시 기록)
-- ----------------------------------------------------------------------------
-- 서버(/api/generate-statement mode=mk-*, 서비스 롤)가 읽고 쓴다.
-- 브라우저 직접 접근은 플랫폼 관리자(is_platform_admin: role=admin AND aal2)만 허용.
-- API 키는 DB에 저장하지 않는다 (서버 환경변수 GEMINI_API_KEY[_역할]).
-- 선행: 012 (is_platform_admin)
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_daily_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_date DATE NOT NULL UNIQUE,
  day_theme_code VARCHAR(50) NOT NULL,
  news_title TEXT,
  news JSONB NOT NULL DEFAULT '{}'::jsonb,          -- 선정 기사 {title, source, url, description, publishedAt}
  context JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {facts[], bridge, angle, reason, candidates[]}
  step1_news_fact TEXT,
  step2_debtor_dilemma TEXT,
  step3_mykim_bridge TEXT,
  channels JSONB NOT NULL DEFAULT '{}'::jsonb,      -- {blog, shorts, tiktok, cardnews, threads, facebook}
  compliance JSONB NOT NULL DEFAULT '{}'::jsonb,    -- 규칙 기반 검사 결과
  compliance_score INT NOT NULL DEFAULT 0,
  models JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cron')),
  status VARCHAR(30) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'approved', 'rejected', 'published')),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_daily_campaigns(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('blog', 'shorts', 'tiktok', 'cardnews', 'threads', 'facebook')),
  post_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  publish_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (publish_status IN ('pending', 'published', 'published_manual', 'failed')),
  external_post_id TEXT,
  external_post_url TEXT,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mk_campaigns_date ON public.marketing_daily_campaigns (campaign_date DESC);
CREATE INDEX IF NOT EXISTS idx_mk_posts_campaign ON public.marketing_channel_posts (campaign_id);

ALTER TABLE public.marketing_daily_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_channel_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_daily_campaigns_admin_all ON public.marketing_daily_campaigns;
CREATE POLICY marketing_daily_campaigns_admin_all ON public.marketing_daily_campaigns
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS marketing_channel_posts_admin_all ON public.marketing_channel_posts;
CREATE POLICY marketing_channel_posts_admin_all ON public.marketing_channel_posts
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

REVOKE ALL ON public.marketing_daily_campaigns FROM anon;
REVOKE ALL ON public.marketing_channel_posts FROM anon;

COMMIT;
