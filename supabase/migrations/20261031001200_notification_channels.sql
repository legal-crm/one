-- ============================================================
-- 알림 서버화 2단계 (ST-7 내 알림 받기 · ST-8 팀 알림 채널)
-- 문제: 텔레그램·이메일 알림은 변호사 탭이 열려 있을 때 브라우저가 보냈고(토큰·Gmail 비밀번호도 브라우저),
--       내용에 가명·채무액 등이 들어갔으며 '연결됨'은 기본값이었다.
-- 바꾼 것:
--  * user_notification_prefs: 사람별 이메일 받기(사무소 구성원 기본 켬)·끌 알림 종류·조용한 시간(기본 21~8시)
--  * office_team_channels: 사무소 텔레그램 방(기본 끔). 봇 토큰은 vault에만, 화면에는 끝 4자리.
--    '연결됨'은 서버가 실제로 보낸 테스트가 성공했을 때만(last_ok_at)
--  * notification_deliveries: 바깥 채널 발송 대기열 겸 기록 (사람·채널·종류·성공/실패, 내용 없음)
--  * 바깥 채널 글은 '새 상담 요청 1건 · 확인하기 링크'처럼 종류·건수·링크만 (가명·채무·소득·사건번호 없음)
--  * user_notifications가 생기면(트리거) 이메일 대기열에, 사무소 일은 팀 방 대기열에 (같은 일은 30분에 한 번)
--  * 5분마다 대기열이 있으면 pg_net → /api/notify?channel=outbox (vault 토큰), 서버가 보내고 결과를 남긴다
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  kinds_off text[] NOT NULL DEFAULT '{}',
  quiet_start smallint NOT NULL DEFAULT 21 CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end smallint NOT NULL DEFAULT 8 CHECK (quiet_end BETWEEN 0 AND 23),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_notification_prefs_own ON public.user_notification_prefs;
CREATE POLICY user_notification_prefs_own ON public.user_notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.user_notification_prefs TO authenticated;
REVOKE ALL ON public.user_notification_prefs FROM anon;

CREATE TABLE IF NOT EXISTS public.office_team_channels (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?[0-9]{3,20}$'),
  telegram_secret_id uuid,
  token_last4 text,
  kinds text[] NOT NULL DEFAULT ARRAY['consult_request_new', 'client_message', 'client_document', 'fee_client_report'],
  last_ok_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.office_team_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_team_channels FROM anon, authenticated; -- 읽기는 office_team_channel_status()로만 (secret id 숨김)

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'telegram')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  notification_id uuid,
  kind text NOT NULL,
  dedupe_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  not_before timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  error text CHECK (error IS NULL OR char_length(error) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_deliveries_due_idx ON public.notification_deliveries (not_before) WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx ON public.notification_deliveries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_deliveries_office_idx ON public.notification_deliveries (office_id, created_at DESC);
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_deliveries_own ON public.notification_deliveries;
CREATE POLICY notification_deliveries_own ON public.notification_deliveries FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notification_deliveries_office ON public.notification_deliveries;
CREATE POLICY notification_deliveries_office ON public.notification_deliveries FOR SELECT TO authenticated
  USING (channel = 'telegram' AND public.has_office_permission(office_id, 'office.settings.view'));
GRANT SELECT ON public.notification_deliveries TO authenticated;
REVOKE ALL ON public.notification_deliveries FROM anon;

-- 조용한 시간이면 끝나는 시각으로 미룬다 (서울 시각 기준)
CREATE OR REPLACE FUNCTION public.next_allowed_send_at(p_start smallint, p_end smallint, p_now timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local timestamp := p_now AT TIME ZONE 'Asia/Seoul';
  v_hour integer := extract(hour FROM v_local)::integer;
  v_quiet boolean;
  v_target timestamp;
BEGIN
  IF p_start = p_end THEN RETURN p_now; END IF;
  v_quiet := CASE WHEN p_start < p_end THEN v_hour >= p_start AND v_hour < p_end ELSE v_hour >= p_start OR v_hour < p_end END;
  IF NOT v_quiet THEN RETURN p_now; END IF;
  v_target := date_trunc('day', v_local) + make_interval(hours => p_end);
  IF v_target <= v_local THEN v_target := v_target + interval '1 day'; END IF;
  RETURN v_target AT TIME ZONE 'Asia/Seoul';
END;
$$;

-- 새 알림 → 바깥 채널 대기열
CREATE OR REPLACE FUNCTION public.trg_queue_notification_deliveries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.user_notification_prefs;
  t public.office_team_channels;
BEGIN
  IF NEW.audience <> 'office' THEN RETURN NEW; END IF; -- 의뢰인 바깥 채널은 아직 없음 (앱 안 알림만)
  SELECT * INTO p FROM public.user_notification_prefs WHERE user_id = NEW.recipient_user_id;
  IF coalesce(p.email_enabled, true) AND NOT (NEW.kind = ANY (coalesce(p.kinds_off, '{}'))) THEN
    INSERT INTO public.notification_deliveries (channel, user_id, office_id, notification_id, kind, dedupe_key, not_before)
    VALUES ('email', NEW.recipient_user_id, NEW.office_id, NEW.id, NEW.kind, NEW.dedupe_key,
            public.next_allowed_send_at(coalesce(p.quiet_start, 21::smallint), coalesce(p.quiet_end, 8::smallint)));
  END IF;
  -- 팀 방: 사무소 일 하나에 한 번 (구성원마다 알림이 생겨도), 같은 일은 30분에 한 번
  SELECT * INTO t FROM public.office_team_channels WHERE office_id = NEW.office_id;
  IF t.telegram_enabled AND t.telegram_secret_id IS NOT NULL AND NEW.kind = ANY (t.kinds)
     AND NOT EXISTS (SELECT 1 FROM public.notification_deliveries d
                     WHERE d.channel = 'telegram' AND d.office_id = NEW.office_id AND d.dedupe_key IS NOT DISTINCT FROM NEW.dedupe_key
                       AND d.created_at > now() - interval '30 minutes') THEN
    INSERT INTO public.notification_deliveries (channel, office_id, notification_id, kind, dedupe_key)
    VALUES ('telegram', NEW.office_id, NEW.id, NEW.kind, NEW.dedupe_key);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'delivery queue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_queue_notification_deliveries ON public.user_notifications;
CREATE TRIGGER trg_queue_notification_deliveries AFTER INSERT ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_queue_notification_deliveries();

-- 내 설정 저장
CREATE OR REPLACE FUNCTION public.set_my_notification_prefs(p jsonb)
RETURNS public.user_notification_prefs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.user_notification_prefs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.user_notification_prefs AS x (user_id, email_enabled, kinds_off, quiet_start, quiet_end, updated_at)
  VALUES (auth.uid(), coalesce((p->>'email_enabled')::boolean, true),
          coalesce(ARRAY(SELECT jsonb_array_elements_text(p->'kinds_off')), '{}'),
          coalesce((p->>'quiet_start')::smallint, 21), coalesce((p->>'quiet_end')::smallint, 8), now())
  ON CONFLICT (user_id) DO UPDATE SET email_enabled = EXCLUDED.email_enabled, kinds_off = EXCLUDED.kinds_off,
    quiet_start = EXCLUDED.quiet_start, quiet_end = EXCLUDED.quiet_end, updated_at = now()
  RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_notification_prefs(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_notification_prefs(jsonb) TO authenticated;

-- 팀 방 상태 (토큰 없이)
CREATE OR REPLACE FUNCTION public.office_team_channel_status(p_office_id text)
RETURNS TABLE (telegram_enabled boolean, telegram_chat_id text, token_last4 text, has_token boolean, kinds text[], last_ok_at timestamptz, last_error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.view') THEN RETURN; END IF;
  RETURN QUERY SELECT t.telegram_enabled, t.telegram_chat_id, t.token_last4, t.telegram_secret_id IS NOT NULL, t.kinds, t.last_ok_at, t.last_error
  FROM public.office_team_channels t WHERE t.office_id = p_office_id;
END;
$$;
REVOKE ALL ON FUNCTION public.office_team_channel_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_team_channel_status(text) TO authenticated;

-- 팀 방 저장 (토큰은 비우면 기존 그대로, 채팅방이나 토큰이 바뀌면 '연결됨' 초기화)
CREATE OR REPLACE FUNCTION public.set_office_team_channel(p_office_id text, p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  t public.office_team_channels;
  v_token text := nullif(btrim(coalesce(p->>'telegram_token', '')), '');
  v_chat text := nullif(btrim(coalesce(p->>'telegram_chat_id', '')), '');
  v_secret uuid;
  v_kinds text[] := CASE WHEN p ? 'kinds' THEN ARRAY(SELECT jsonb_array_elements_text(p->'kinds')) END;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_token IS NOT NULL AND v_token !~ '^[0-9]{5,15}:[A-Za-z0-9_-]{30,60}$' THEN
    RAISE EXCEPTION 'invalid telegram token' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO t FROM public.office_team_channels WHERE office_id = p_office_id FOR UPDATE;
  v_secret := t.telegram_secret_id;
  IF v_token IS NOT NULL THEN
    IF v_secret IS NULL THEN
      v_secret := vault.create_secret(v_token, 'tg_office_' || p_office_id || '_' || substr(md5(random()::text), 1, 6), 'office telegram bot token');
    ELSE
      PERFORM vault.update_secret(v_secret, v_token);
    END IF;
  END IF;
  INSERT INTO public.office_team_channels AS x (office_id, telegram_enabled, telegram_chat_id, telegram_secret_id, token_last4, kinds, last_ok_at, last_error, updated_at, updated_by)
  VALUES (p_office_id, coalesce((p->>'telegram_enabled')::boolean, false), v_chat, v_secret,
          CASE WHEN v_token IS NOT NULL THEN right(v_token, 4) ELSE t.token_last4 END,
          coalesce(v_kinds, t.kinds, ARRAY['consult_request_new', 'client_message', 'client_document', 'fee_client_report']),
          NULL, NULL, now(), auth.uid())
  ON CONFLICT (office_id) DO UPDATE SET
    telegram_enabled = EXCLUDED.telegram_enabled, telegram_chat_id = EXCLUDED.telegram_chat_id,
    telegram_secret_id = EXCLUDED.telegram_secret_id, token_last4 = EXCLUDED.token_last4, kinds = EXCLUDED.kinds,
    last_ok_at = CASE WHEN v_token IS NOT NULL OR x.telegram_chat_id IS DISTINCT FROM EXCLUDED.telegram_chat_id THEN NULL ELSE x.last_ok_at END,
    last_error = CASE WHEN v_token IS NOT NULL OR x.telegram_chat_id IS DISTINCT FROM EXCLUDED.telegram_chat_id THEN NULL ELSE x.last_error END,
    updated_at = now(), updated_by = auth.uid();
  PERFORM public.office_log(p_office_id, 'team_channel.set', 'office', p_office_id,
    jsonb_build_object('telegram_enabled', coalesce((p->>'telegram_enabled')::boolean, false), 'token_changed', v_token IS NOT NULL));
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_team_channel(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_team_channel(text, jsonb) TO authenticated;

-- 대기열 → 서버 함수 호출 (있을 때만)
CREATE OR REPLACE FUNCTION public.dispatch_notification_deliveries()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text; v_req bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries
                 WHERE (status = 'pending' AND not_before <= now())
                    OR (status = 'sending' AND claimed_at < now() - interval '15 minutes' AND attempts < 3)) THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1;
  IF v_token IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := 'https://mykim.kr/api/notify?channel=outbox',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mykim-cron', v_token),
    body := '{}'::jsonb, timeout_milliseconds := 60000) INTO v_req;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_notification_deliveries() FROM PUBLIC, anon, authenticated;

-- 팀 방 테스트: 대기열에 넣고 바로 서버 함수를 부른다 (결과는 last_ok_at / last_error)
CREATE OR REPLACE FUNCTION public.request_team_channel_test(p_office_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.office_team_channels WHERE office_id = p_office_id AND telegram_secret_id IS NOT NULL AND telegram_chat_id IS NOT NULL) THEN
    RAISE EXCEPTION 'telegram not configured' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_deliveries WHERE office_id = p_office_id AND kind = 'test' AND created_at > now() - interval '1 minute') THEN
    RAISE EXCEPTION 'test too often' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.notification_deliveries (channel, office_id, kind) VALUES ('telegram', p_office_id, 'test');
  PERFORM public.dispatch_notification_deliveries();
END;
$$;
REVOKE ALL ON FUNCTION public.request_team_channel_test(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_team_channel_test(text) TO authenticated;

-- 서버 함수 전용: 보낼 것 가져가기 (이메일 주소·텔레그램 토큰은 여기서만 나간다)
CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(p_limit integer DEFAULT 30)
RETURNS TABLE (delivery_id uuid, channel text, kind text, email text, telegram_chat_id text, telegram_token text, open_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT d.* FROM public.notification_deliveries d
    WHERE (d.status = 'pending' AND d.not_before <= now())
       OR (d.status = 'sending' AND d.claimed_at < now() - interval '15 minutes' AND d.attempts < 3)
    ORDER BY d.created_at LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE OF d SKIP LOCKED
  LOOP
    UPDATE public.notification_deliveries SET status = 'sending', attempts = attempts + 1, claimed_at = now() WHERE id = r.id;
    delivery_id := r.id; channel := r.channel; kind := r.kind; email := NULL; telegram_chat_id := NULL; telegram_token := NULL;
    open_count := 1;
    IF r.notification_id IS NOT NULL THEN
      SELECT n.count INTO open_count FROM public.user_notifications n WHERE n.id = r.notification_id;
      open_count := coalesce(open_count, 1);
    END IF;
    IF r.channel = 'email' THEN
      SELECT u.email INTO email FROM auth.users u WHERE u.id = r.user_id;
      IF email IS NULL THEN
        UPDATE public.notification_deliveries SET status = 'skipped', error = '이메일 주소가 없습니다' WHERE id = r.id;
        CONTINUE;
      END IF;
    ELSE
      SELECT t.telegram_chat_id, s.decrypted_secret INTO telegram_chat_id, telegram_token
      FROM public.office_team_channels t LEFT JOIN vault.decrypted_secrets s ON s.id = t.telegram_secret_id
      WHERE t.office_id = r.office_id AND (t.telegram_enabled OR r.kind = 'test');
      IF telegram_token IS NULL OR telegram_chat_id IS NULL THEN
        UPDATE public.notification_deliveries SET status = 'skipped', error = '텔레그램 방이 꺼져 있거나 설정되지 않았습니다' WHERE id = r.id;
        CONTINUE;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_notification_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_notification_delivery(p_id uuid, p_status text, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.notification_deliveries;
BEGIN
  IF p_status NOT IN ('sent', 'failed') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.notification_deliveries SET status = p_status, error = left(p_error, 300), sent_at = CASE WHEN p_status = 'sent' THEN now() END
  WHERE id = p_id AND status = 'sending' RETURNING * INTO d;
  IF d.channel = 'telegram' THEN
    UPDATE public.office_team_channels
    SET last_ok_at = CASE WHEN p_status = 'sent' THEN now() ELSE last_ok_at END,
        last_error = CASE WHEN p_status = 'sent' THEN NULL ELSE left(p_error, 300) END
    WHERE office_id = d.office_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_notification_delivery(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_notification_delivery(uuid, text, text) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_dispatch_notification_deliveries', 'mykim_purge_notification_deliveries');
  PERFORM cron.schedule('mykim_dispatch_notification_deliveries', '*/5 * * * *', 'SELECT public.dispatch_notification_deliveries()');
  PERFORM cron.schedule('mykim_purge_notification_deliveries', '45 18 * * *',
    $q$DELETE FROM public.notification_deliveries WHERE created_at < now() - interval '90 days'$q$);
END;
$$;
