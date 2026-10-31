-- ════════════════════════════════════════════════════════════════════════════
-- M-3 칼럼 자동 발행: 칼럼을 게시·수정·내리면 10분 안에 사이트를 다시 빌드해 정적 페이지·사이트맵·RSS·llms.txt·IndexNow에 반영
-- - 다시 빌드는 Vercel Deploy Hook(주소는 vault 비밀값 'mykim_deploy_hook_url')으로. 비밀값이 없으면 대기열만 쌓고 보내지 않는다
-- - 같은 10분 안의 여러 변경은 한 번만 빌드
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.site_rebuild_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reason text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  request_id bigint
);
ALTER TABLE public.site_rebuild_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_rebuild_requests_admin_read ON public.site_rebuild_requests;
CREATE POLICY site_rebuild_requests_admin_read ON public.site_rebuild_requests FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.trg_column_rebuild()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.status = 'published')
     OR (TG_OP <> 'DELETE' AND (NEW.status = 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published'))) THEN
    IF NOT EXISTS (SELECT 1 FROM site_rebuild_requests WHERE sent_at IS NULL) THEN
      INSERT INTO site_rebuild_requests (reason) VALUES ('news_articles ' || lower(TG_OP));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_column_rebuild ON public.news_articles;
CREATE TRIGGER trg_column_rebuild AFTER INSERT OR UPDATE OR DELETE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_column_rebuild();

CREATE OR REPLACE FUNCTION public.dispatch_site_rebuild()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url text;
  v_req bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM site_rebuild_requests WHERE sent_at IS NULL) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'mykim_deploy_hook_url' LIMIT 1;
  IF v_url IS NULL OR v_url !~ '^https://api\.vercel\.com/' THEN RETURN; END IF;
  SELECT net.http_post(url := v_url, body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb) INTO v_req;
  UPDATE site_rebuild_requests SET sent_at = now(), request_id = v_req WHERE sent_at IS NULL;
  DELETE FROM site_rebuild_requests WHERE sent_at < now() - interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_site_rebuild() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_dispatch_site_rebuild';
    PERFORM cron.schedule('mykim_dispatch_site_rebuild', '*/10 * * * *', 'SELECT public.dispatch_site_rebuild()');
  END IF;
END $$;
