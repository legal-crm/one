-- ════════════════════════════════════════════════════════════════════════════
-- I-5 '내 상황 체크하기' 작성 중 초안: 로그인한 의뢰인은 계정에 (다른 기기에서 이어 하기)
--  * 로그인 전에는 지금처럼 이 창(sessionStorage)에만 — 창을 닫으면 지워진다
--  * 본인만 읽고 쓰기 (관리자·사무소 정책 없음), 300KB 한도, 30일 지나면 지운다
--  * 정리를 마치거나 '처음부터'를 고르면 지운다 (앱)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.client_check_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 300000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_check_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_check_drafts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_check_drafts TO authenticated;
DROP POLICY IF EXISTS client_check_drafts_own ON public.client_check_drafts;
CREATE POLICY client_check_drafts_own ON public.client_check_drafts FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_account_active())
  WITH CHECK (user_id = auth.uid() AND public.is_account_active());

CREATE OR REPLACE FUNCTION public.client_check_drafts_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- 주민등록번호 형식은 저장하지 않는다
  IF NEW.data::text ~ '\d{6}-?[1-4]\d{6}' THEN
    RAISE EXCEPTION 'resident registration numbers are not stored' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_check_drafts_touch ON public.client_check_drafts;
CREATE TRIGGER client_check_drafts_touch BEFORE INSERT OR UPDATE ON public.client_check_drafts
  FOR EACH ROW EXECUTE FUNCTION public.client_check_drafts_touch();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_client_check_drafts';
    PERFORM cron.schedule('mykim_purge_client_check_drafts', '40 19 * * *',
      $c$DELETE FROM public.client_check_drafts WHERE updated_at < now() - interval '30 days'$c$);
  END IF;
END $$;
