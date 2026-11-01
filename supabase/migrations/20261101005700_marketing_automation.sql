-- 마케팅 자동화 수준 (M-1, MK-Q1: 기본 L2·엄격)
-- platform_config 'marketing_automation':
--   level        : 'L1' 사람이 승인·게시 / 'L2'(기본) 아침 자동 생성분 중 고위험·수정 권고 표시가 없고 점수 기준 이상이면 자동 승인,
--                  승인된 캠페인의 표시 없는 API 채널은 황금 시간표에 맞춰 자동 게시
--   checkMode    : 'strict' 고위험 표현이 있으면 승인 불가 / 'advisory' 사유를 적으면 승인 가능(조치 기록)
--   minScore     : 자동 승인 최소 점수 (70~100, 기본 90)
--   autoChannels : 자동 게시할 API 채널 (threads·facebook 중, 서버에 키가 있는 것만 실제로 게시)
-- 자동 게시 시각: 황금 시간표(스레드 12:30, 페이스북 14:00 KST) 바로 뒤 pg_cron → pg_net → /api/generate-statement {mode:'mk-auto-publish'}
-- 쓰기는 admin_set_marketing_automation() 로만 (직접 쓰기 차단, 조치 기록). 긴급 정지 = L1로 바꾸기
-- 캠페인 승인 표시(approval_kind·approval_note·status·approved_*)는 서버만 바꾼다 (브라우저 직접 쓰기 차단)
-- ============================================================

ALTER TABLE public.marketing_daily_campaigns
  ADD COLUMN IF NOT EXISTS approval_kind text CHECK (approval_kind IS NULL OR approval_kind IN ('manual', 'auto', 'advisory')),
  ADD COLUMN IF NOT EXISTS approval_note text CHECK (approval_note IS NULL OR char_length(approval_note) <= 300);

COMMENT ON COLUMN public.marketing_daily_campaigns.approval_kind IS 'manual 사람 승인 / auto L2 자동 승인 / advisory 권고 모드 사유 승인(admin_actions 기록)';

CREATE OR REPLACE FUNCTION public.marketing_campaign_approval_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 서버(service_role)·관리 도구(postgres)는 통과. 브라우저 세션(authenticated)은 승인 관련 칸을 못 바꾼다
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ready' OR NEW.approval_kind IS NOT NULL OR NEW.approval_note IS NOT NULL
       OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'campaign approval is set by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.approval_kind IS DISTINCT FROM OLD.approval_kind
     OR NEW.approval_note IS DISTINCT FROM OLD.approval_note OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'campaign approval is set by the server' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS marketing_campaign_approval_guard ON public.marketing_daily_campaigns;
CREATE TRIGGER marketing_campaign_approval_guard BEFORE INSERT OR UPDATE ON public.marketing_daily_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.marketing_campaign_approval_guard();

CREATE OR REPLACE FUNCTION public.marketing_automation_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- 저장값이 없으면 MK-Q1 결정값(L2·엄격·90점·스레드·페이스북)
  SELECT jsonb_build_object(
    'level', coalesce(c.data ->> 'level', 'L2'),
    'checkMode', coalesce(c.data ->> 'checkMode', 'strict'),
    'minScore', coalesce((c.data ->> 'minScore')::int, 90),
    'autoChannels', coalesce(c.data -> 'autoChannels', '["threads","facebook"]'::jsonb),
    'updatedAt', c.data ->> 'updatedAt')
  FROM (SELECT (SELECT data FROM platform_config WHERE id = 'marketing_automation') AS data) c;
$$;
REVOKE ALL ON FUNCTION public.marketing_automation_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_automation_config() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_marketing_automation(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb;
  v_level text := coalesce(p ->> 'level', 'L1');
  v_mode text := coalesce(p ->> 'checkMode', 'strict');
  v_min int;
  v_channels jsonb;
  v_out jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF v_level NOT IN ('L1', 'L2') THEN RAISE EXCEPTION 'invalid automation level' USING ERRCODE = '22023'; END IF;
  IF v_mode NOT IN ('strict', 'advisory') THEN RAISE EXCEPTION 'invalid check mode' USING ERRCODE = '22023'; END IF;
  IF coalesce(p ->> 'minScore', '90') !~ '^[0-9]{2,3}$' THEN RAISE EXCEPTION 'min score must be 70 to 100' USING ERRCODE = '22023'; END IF;
  v_min := coalesce((p ->> 'minScore')::int, 90);
  IF v_min NOT BETWEEN 70 AND 100 THEN RAISE EXCEPTION 'min score must be 70 to 100' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(coalesce(p -> 'autoChannels', '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'autoChannels must be an array' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(jsonb_agg(c ORDER BY c), '[]'::jsonb) INTO v_channels
    FROM (SELECT DISTINCT c FROM jsonb_array_elements_text(coalesce(p -> 'autoChannels', '[]'::jsonb)) c WHERE c IN ('threads', 'facebook')) s;
  SELECT data INTO v_before FROM platform_config WHERE id = 'marketing_automation';
  v_out := jsonb_build_object('level', v_level, 'checkMode', v_mode, 'minScore', v_min, 'autoChannels', v_channels, 'updatedAt', now());
  INSERT INTO platform_config (id, data, updated_at) VALUES ('marketing_automation', v_out, now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
  PERFORM public.admin_record_action('platform.marketing_automation', 'platform_config', 'marketing_automation', v_before, v_out, NULL);
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_marketing_automation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_marketing_automation(jsonb) TO authenticated;

-- platform_config 직접 쓰기 차단 (기능 표시·금지어 사전과 같은 방식)
CREATE OR REPLACE FUNCTION public.platform_config_feature_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 함수(SECURITY DEFINER) 안에서는 current_user가 소유자라 통과, 브라우저 직접 쓰기는 authenticated라 막힌다
  IF NEW.id = 'feature_flags' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_platform_features' USING ERRCODE = '42501';
  END IF;
  IF NEW.id = 'compliance_terms' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_compliance_terms' USING ERRCODE = '42501';
  END IF;
  IF NEW.id = 'marketing_automation' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_marketing_automation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 자동 게시 호출: L2이고 오늘 승인된 캠페인이 있을 때만 서버를 부른다 (어느 채널을 올릴지는 서버가 시간표·키·검사로 정함)
CREATE OR REPLACE FUNCTION public.dispatch_marketing_auto_publish()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg jsonb := public.marketing_automation_config();
  v_token text;
  v_req bigint;
BEGIN
  IF v_cfg ->> 'level' <> 'L2' OR jsonb_array_length(coalesce(v_cfg -> 'autoChannels', '[]'::jsonb)) = 0 THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM marketing_daily_campaigns
                 WHERE campaign_date = public.seoul_today() AND status IN ('approved', 'published')) THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1;
  IF v_token IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := 'https://mykim.kr/api/generate-statement',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mykim-cron', v_token),
    body := '{"mode":"mk-auto-publish"}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_req;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_marketing_auto_publish() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_marketing_auto_publish', 'mykim_marketing_auto_publish_2');
  -- 12:35·14:05 KST = 03:35·05:05 UTC (황금 시간표 바로 뒤, 서버가 시각이 지난 채널만 게시)
  PERFORM cron.schedule('mykim_marketing_auto_publish', '35 3 * * *', 'SELECT public.dispatch_marketing_auto_publish()');
  PERFORM cron.schedule('mykim_marketing_auto_publish_2', '5 5 * * *', 'SELECT public.dispatch_marketing_auto_publish()');
END;
$$;
