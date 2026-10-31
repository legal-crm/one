-- ============================================================
-- KT-2 · KT-4 · KT-8 카카오톡 소통 (docs/launch_plan/12_kakao_messaging_plan.md)
--  KT-2 의뢰인 안내 발송 방법: 알림톡 / 담당자 카톡 / 둘 다 / 안 보냄 (사무소 설정 office_settings.client_messaging)
--       담당자 카톡 = 할 일(client_notice_tasks) + 근무 시간 기준 기한, 기한이 지나면 알림톡 자동 대체(선택)
--  KT-4 카카오톡 '대화 내보내기' 파일 백업: 원본(비공개 저장소) + 서버 지문 + 줄 단위 소통 기록, 다시 올리면 새 줄만
--  KT-8 PC 카카오톡 묶음 발송(사무소 선택, [운영자 판단] 확인): 보낼 목록 → 사용자 엑셀 양식 → 결과 1인 줄만 '보냄' 기록
--  공통: 의뢰인 카톡 이름(사건마다, 묶음 발송 대상·오발송 방지)
-- 개인정보: 할 일의 전화번호는 알림톡 대체 발송에만 쓰고 화면 읽기 권한을 주지 않는다. 사무소 단위 RLS, 관리자 제외.
-- ============================================================

-- ── 1. 소통 기록: 출처 2개 추가, 보낸 사람 이름·내보내기 파일 연결 ─────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con
           WHERE con.conrelid = 'public.client_comm_logs'::regclass AND con.contype = 'c'
             AND pg_get_constraintdef(con.oid) LIKE '%kakao_manual%' LOOP
    EXECUTE format('ALTER TABLE public.client_comm_logs DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.client_comm_logs ADD CONSTRAINT client_comm_logs_source_check
  CHECK (source IN ('app', 'manual', 'kakao_manual', 'alimtok', 'popbill', 'kakao_export', 'kakao_pc_batch'));
ALTER TABLE public.client_comm_logs ADD COLUMN IF NOT EXISTS sender_name text CHECK (sender_name IS NULL OR char_length(sender_name) <= 60);
ALTER TABLE public.client_comm_logs ADD COLUMN IF NOT EXISTS export_id uuid;
-- 같은 대화를 다시 올려도 같은 줄은 한 번만 (줄 지문 = 시각·보낸 사람·내용·같은 줄 순번)
CREATE UNIQUE INDEX IF NOT EXISTS client_comm_logs_export_line_uq
  ON public.client_comm_logs (office_id, (coalesce(workspace_key, 'lead:' || sales_lead_id)), content_hash) WHERE source = 'kakao_export';

-- 내용 보호에 새 칸도 넣는다
CREATE OR REPLACE FUNCTION public.client_comm_logs_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.id = OLD.office_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('mykim.comm_purge', true), '') <> 'on' THEN
      RAISE EXCEPTION 'communication logs cannot be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.office_id IS DISTINCT FROM OLD.office_id OR NEW.device_id IS DISTINCT FROM OLD.device_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.source IS DISTINCT FROM OLD.source OR NEW.channel IS DISTINCT FROM OLD.channel OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.result IS DISTINCT FROM OLD.result OR NEW.duration_sec IS DISTINCT FROM OLD.duration_sec OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.device_record_key IS DISTINCT FROM OLD.device_record_key OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.line_label IS DISTINCT FROM OLD.line_label OR NEW.sender_name IS DISTINCT FROM OLD.sender_name
     OR NEW.export_id IS DISTINCT FROM OLD.export_id THEN
    RAISE EXCEPTION 'communication log content cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. 근무 시간 기준 시각 더하기 (평일·공휴일 제외, KST) ─────────────────────────
CREATE OR REPLACE FUNCTION public.add_business_hours(p_from timestamptz, p_hours numeric, p_start integer DEFAULT 9, p_end integer DEFAULT 18)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_t timestamp := p_from AT TIME ZONE 'Asia/Seoul';
  v_left interval := make_interval(mins => greatest(1, round(coalesce(p_hours, 3) * 60)::int));
  v_day date;
  v_open timestamp;
  v_close timestamp;
  i integer;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start < 0 OR p_end > 24 OR p_start >= p_end THEN
    p_start := 9; p_end := 18;
  END IF;
  FOR i IN 1..90 LOOP
    v_day := v_t::date;
    v_open := v_day + make_interval(hours => p_start);
    v_close := v_day + make_interval(hours => p_end);
    IF NOT public.is_business_day(v_day) OR v_t >= v_close THEN
      v_t := (v_day + 1) + make_interval(hours => p_start);
      CONTINUE;
    END IF;
    IF v_t < v_open THEN v_t := v_open; END IF;
    IF v_t + v_left <= v_close THEN
      RETURN (v_t + v_left) AT TIME ZONE 'Asia/Seoul';
    END IF;
    v_left := v_left - (v_close - v_t);
    v_t := (v_day + 1) + make_interval(hours => p_start);
  END LOOP;
  RETURN (v_t) AT TIME ZONE 'Asia/Seoul';
END;
$$;
REVOKE ALL ON FUNCTION public.add_business_hours(timestamptz, numeric, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_business_hours(timestamptz, numeric, integer, integer) TO authenticated;

-- 사무소 안내 설정 (office_settings.client_messaging) + 기본값
CREATE OR REPLACE FUNCTION public.client_messaging_settings(p_office_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('fallbackEnabled', true, 'fallbackHours', 3, 'workStart', 9, 'workEnd', 18, 'methods', '{}'::jsonb)
         || coalesce((SELECT s.data FROM office_settings s WHERE s.office_id = p_office_id AND s.section = 'client_messaging'), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.client_messaging_settings(text) FROM PUBLIC, anon, authenticated;

-- ── 3. 의뢰인 카톡 이름 (사건마다) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_kakao_names (
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  workspace_key text NOT NULL CHECK (char_length(workspace_key) BETWEEN 1 AND 80),
  kakao_name text NOT NULL CHECK (char_length(btrim(kakao_name)) BETWEEN 1 AND 40),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, workspace_key)
);
CREATE INDEX IF NOT EXISTS case_kakao_names_name_idx ON public.case_kakao_names (office_id, lower(btrim(kakao_name)));
ALTER TABLE public.case_kakao_names ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_kakao_names FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.case_kakao_names TO authenticated;
GRANT ALL ON public.case_kakao_names TO service_role;
DROP POLICY IF EXISTS case_kakao_names_read ON public.case_kakao_names;
CREATE POLICY case_kakao_names_read ON public.case_kakao_names FOR SELECT TO authenticated
  USING (public.comm_can(office_id, 'comm.view', workspace_key, NULL, NULL));

CREATE OR REPLACE FUNCTION public.set_case_kakao_name(p_office_id text, p_key text, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := left(btrim(coalesce(p_name, '')), 40);
  v_same integer;
BEGIN
  IF NOT public.comm_key_in_office(p_office_id, p_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.comm_can(p_office_id, 'comm.view', p_key, NULL, NULL) THEN RAISE EXCEPTION 'permission denied: comm.view' USING ERRCODE = '42501'; END IF;
  IF v_name = '' THEN
    DELETE FROM case_kakao_names WHERE office_id = p_office_id AND workspace_key = p_key;
    RETURN jsonb_build_object('kakao_name', NULL, 'same_name_cases', 0);
  END IF;
  INSERT INTO case_kakao_names (office_id, workspace_key, kakao_name, updated_by, updated_at)
  VALUES (p_office_id, p_key, v_name, auth.uid(), now())
  ON CONFLICT (office_id, workspace_key) DO UPDATE SET kakao_name = EXCLUDED.kakao_name, updated_by = auth.uid(), updated_at = now();
  SELECT count(*) INTO v_same FROM case_kakao_names n
   WHERE n.office_id = p_office_id AND n.workspace_key <> p_key AND lower(btrim(n.kakao_name)) = lower(v_name);
  PERFORM public.office_log(p_office_id, 'comm.kakao_name', 'case', p_key, '{}'::jsonb);
  RETURN jsonb_build_object('kakao_name', v_name, 'same_name_cases', v_same);
END;
$$;
REVOKE ALL ON FUNCTION public.set_case_kakao_name(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_case_kakao_name(text, text, text) TO authenticated;

-- ── 4. 담당자 카톡으로 보낼 안내 (KT-2) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_notice_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  workspace_key text NOT NULL CHECK (char_length(workspace_key) BETWEEN 1 AND 80),
  milestone text NOT NULL CHECK (milestone ~ '^[a-z0-9_]{2,40}$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  -- 알림톡 자동 대체용 (화면에는 내주지 않는다)
  phone text CHECK (phone IS NULL OR phone ~ '^[0-9]{9,12}$'),
  receiver_name text NOT NULL DEFAULT '' CHECK (char_length(receiver_name) <= 40),
  alimtok_text text CHECK (alimtok_text IS NULL OR char_length(alimtok_text) <= 1000),
  fallback boolean NOT NULL DEFAULT true,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'fallback_sending', 'fallback_sent', 'fallback_failed', 'cancelled')),
  sent_via text CHECK (sent_via IS NULL OR sent_via IN ('kakao_copy', 'kakao_pc_batch')),
  sent_by uuid,
  sent_at timestamptz,
  comm_log_id uuid REFERENCES public.client_comm_logs(id) ON DELETE SET NULL,
  fallback_attempts integer NOT NULL DEFAULT 0,
  fallback_claimed_at timestamptz,
  fallback_channel text,
  fallback_receipt text,
  fallback_error text CHECK (fallback_error IS NULL OR char_length(fallback_error) <= 300),
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 200),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_notice_tasks_office_idx ON public.client_notice_tasks (office_id, status, due_at);
CREATE INDEX IF NOT EXISTS client_notice_tasks_key_idx ON public.client_notice_tasks (office_id, workspace_key, created_at DESC);
CREATE INDEX IF NOT EXISTS client_notice_tasks_due_idx ON public.client_notice_tasks (due_at) WHERE status = 'pending' AND fallback;
ALTER TABLE public.client_notice_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_notice_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, workspace_key, milestone, title, body, fallback, due_at, status, sent_via, sent_by, sent_at, comm_log_id,
              fallback_attempts, fallback_channel, fallback_error, cancel_reason, created_by, created_at, updated_at)
  ON public.client_notice_tasks TO authenticated;
GRANT ALL ON public.client_notice_tasks TO service_role;
DROP POLICY IF EXISTS client_notice_tasks_read ON public.client_notice_tasks;
CREATE POLICY client_notice_tasks_read ON public.client_notice_tasks FOR SELECT TO authenticated
  USING (public.comm_can(office_id, 'comm.view', workspace_key, NULL, created_by));
DROP POLICY IF EXISTS client_notice_tasks_active_only ON public.client_notice_tasks;
CREATE POLICY client_notice_tasks_active_only ON public.client_notice_tasks AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_account_active()) WITH CHECK (public.is_account_active());

-- 주민등록번호 형식은 받지 않는다
CREATE OR REPLACE FUNCTION public.notice_text_has_rrn(p text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p, '') ~ '[0-9]{6}[- ]?[1-4][0-9]{6}';
$$;

CREATE OR REPLACE FUNCTION public.create_client_notice_task(p_office_id text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_ms text := lower(coalesce(p ->> 'milestone', ''));
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 80);
  v_body text := left(btrim(coalesce(p ->> 'body', '')), 1000);
  v_alim text := nullif(left(btrim(coalesce(p ->> 'alimtok_text', '')), 1000), '');
  v_phone text := public.comm_normalize_phone(p ->> 'phone');
  v_cfg jsonb := public.client_messaging_settings(p_office_id);
  v_fallback boolean;
  v_due timestamptz;
  v client_notice_tasks%ROWTYPE;
BEGIN
  IF v_member.id IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF v_key IS NULL OR NOT public.comm_key_in_office(p_office_id, v_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.comm_can(p_office_id, 'comm.view', v_key, NULL, NULL) THEN RAISE EXCEPTION 'permission denied: comm.view' USING ERRCODE = '42501'; END IF;
  IF v_ms !~ '^[a-z0-9_]{2,40}$' THEN RAISE EXCEPTION 'invalid milestone' USING ERRCODE = '22023'; END IF;
  IF v_title = '' OR v_body = '' THEN RAISE EXCEPTION 'title and body required' USING ERRCODE = '22023'; END IF;
  IF public.notice_text_has_rrn(v_body) OR public.notice_text_has_rrn(v_alim) THEN
    RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9]{9,12}$' THEN v_phone := NULL; END IF;
  -- 같은 안내가 1시간 안에 이미 대기 중이면 새로 만들지 않는다
  SELECT * INTO v FROM client_notice_tasks
   WHERE office_id = p_office_id AND workspace_key = v_key AND milestone = v_ms AND status = 'pending' AND created_at > now() - interval '1 hour'
   ORDER BY created_at DESC LIMIT 1;
  IF v.id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v.id, 'due_at', v.due_at, 'fallback', v.fallback, 'existing', true);
  END IF;
  IF (SELECT count(*) FROM client_notice_tasks WHERE office_id = p_office_id AND created_at > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'too many notices today' USING ERRCODE = '22023';
  END IF;
  -- 대체 발송: 요청이 끄면 끔, 사무소 설정이 끄면 끔, 알림톡 문구·번호가 없으면 끔
  v_fallback := coalesce((p ->> 'fallback')::boolean, true) AND coalesce((v_cfg ->> 'fallbackEnabled')::boolean, true)
                AND v_phone IS NOT NULL AND v_alim IS NOT NULL;
  v_due := public.add_business_hours(now(), coalesce((v_cfg ->> 'fallbackHours')::numeric, 3),
                                     coalesce((v_cfg ->> 'workStart')::int, 9), coalesce((v_cfg ->> 'workEnd')::int, 18));
  INSERT INTO client_notice_tasks (office_id, workspace_key, milestone, title, body, phone, receiver_name, alimtok_text, fallback, due_at, created_by)
  VALUES (p_office_id, v_key, v_ms, v_title, v_body, CASE WHEN v_fallback THEN v_phone END,
          left(btrim(coalesce(p ->> 'receiver_name', '')), 40), CASE WHEN v_fallback THEN v_alim END, v_fallback, v_due, auth.uid())
  RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'notice.create', 'client_notice_task', v.id::text, jsonb_build_object('milestone', v_ms, 'fallback', v_fallback));
  RETURN jsonb_build_object('id', v.id, 'due_at', v.due_at, 'fallback', v.fallback, 'existing', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_client_notice_task(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_notice_task(text, jsonb) TO authenticated;

-- 담당자가 보냈어요 (복사해서 보냄 / PC 묶음) → 소통 기록 + 할 일 끝
CREATE OR REPLACE FUNCTION public.complete_notice_task_core(p_id uuid, p_via text, p_body text, p_user uuid, p_member uuid) RETURNS client_comm_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t client_notice_tasks%ROWTYPE;
  v_body text;
  v_at timestamptz := now();
  v_src text := CASE WHEN p_via = 'kakao_pc_batch' THEN 'kakao_pc_batch' ELSE 'kakao_manual' END;
  l client_comm_logs%ROWTYPE;
BEGIN
  SELECT * INTO t FROM client_notice_tasks WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'notice not found' USING ERRCODE = 'P0002'; END IF;
  IF t.status = 'fallback_sending' THEN RAISE EXCEPTION 'fallback alimtalk is being sent' USING ERRCODE = '22023'; END IF;
  IF t.status NOT IN ('pending', 'fallback_failed') THEN RAISE EXCEPTION 'notice already handled' USING ERRCODE = '22023'; END IF;
  v_body := coalesce(nullif(left(btrim(coalesce(p_body, '')), 2000), ''), t.body);
  IF public.notice_text_has_rrn(v_body) THEN RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023'; END IF;
  INSERT INTO client_comm_logs (office_id, user_id, member_id, workspace_key, source, channel, direction, result, line_label, body, occurred_at, content_hash, note)
  VALUES (t.office_id, p_user, p_member, t.workspace_key, v_src, 'kakao', 'out', 'sent', '', v_body, v_at,
          public.comm_content_hash('kakao', 'out', 'sent', v_at, NULL, v_body, ''), '안내: ' || t.title)
  RETURNING * INTO l;
  UPDATE client_notice_tasks SET status = 'sent', sent_via = p_via, sent_by = p_user, sent_at = v_at, comm_log_id = l.id, updated_at = now()
   WHERE id = p_id;
  RETURN l;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_notice_task_core(uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_client_notice_task(p_id uuid, p_body text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t client_notice_tasks%ROWTYPE;
  v_member office_members;
  l client_comm_logs%ROWTYPE;
BEGIN
  SELECT * INTO t FROM client_notice_tasks WHERE id = p_id;
  IF t.id IS NULL OR NOT public.comm_can(t.office_id, 'comm.view', t.workspace_key, NULL, t.created_by) THEN
    RAISE EXCEPTION 'notice not found' USING ERRCODE = 'P0002';
  END IF;
  v_member := public.current_office_member(t.office_id);
  l := public.complete_notice_task_core(p_id, 'kakao_copy', p_body, auth.uid(), v_member.id);
  PERFORM public.office_log(t.office_id, 'notice.sent', 'client_notice_task', p_id::text, jsonb_build_object('via', 'kakao_copy'));
  RETURN jsonb_build_object('id', p_id, 'comm_log_id', l.id);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_client_notice_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_client_notice_task(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_client_notice_task(p_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t client_notice_tasks%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
BEGIN
  SELECT * INTO t FROM client_notice_tasks WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL OR NOT public.comm_can(t.office_id, 'comm.view', t.workspace_key, NULL, t.created_by) THEN
    RAISE EXCEPTION 'notice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  IF t.status NOT IN ('pending', 'fallback_failed') THEN RAISE EXCEPTION 'notice already handled' USING ERRCODE = '22023'; END IF;
  UPDATE client_notice_tasks SET status = 'cancelled', cancel_reason = v_reason, phone = NULL, alimtok_text = NULL, updated_at = now() WHERE id = p_id;
  PERFORM public.office_log(t.office_id, 'notice.cancel', 'client_notice_task', p_id::text, jsonb_build_object('reason', v_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_client_notice_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_notice_task(uuid, text) TO authenticated;

-- ── 5. 알림톡 자동 대체 (pg_cron → pg_net → /api/popbill?service=notice-fallback) ─────────
-- 09~20시(KST)에만 꺼낸다. 30분 넘게 '보내는 중'이면 다시 꺼낸다(최대 3번)
CREATE OR REPLACE FUNCTION public.claim_client_notice_fallbacks(p_limit integer DEFAULT 20, p_now timestamptz DEFAULT now())
RETURNS TABLE (id uuid, office_id text, workspace_key text, milestone text, phone text, receiver_name text, alimtok_text text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_hour integer := extract(hour FROM p_now AT TIME ZONE 'Asia/Seoul')::int;
BEGIN
  IF v_hour < 9 OR v_hour >= 20 THEN RETURN; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT t.id FROM client_notice_tasks t
     WHERE t.fallback AND t.phone IS NOT NULL AND t.alimtok_text IS NOT NULL AND t.fallback_attempts < 3
       AND ((t.status = 'pending' AND t.due_at <= p_now)
            OR (t.status = 'fallback_sending' AND t.fallback_claimed_at < p_now - interval '30 minutes'))
     ORDER BY t.due_at
     LIMIT greatest(1, least(coalesce(p_limit, 20), 50))
     FOR UPDATE SKIP LOCKED
  )
  UPDATE client_notice_tasks t SET status = 'fallback_sending', fallback_attempts = t.fallback_attempts + 1,
         fallback_claimed_at = p_now, updated_at = now()
    FROM picked WHERE t.id = picked.id
  RETURNING t.id, t.office_id, t.workspace_key, t.milestone, t.phone, t.receiver_name, t.alimtok_text, t.fallback_attempts;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_client_notice_fallbacks(integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_notice_fallbacks(integer, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_client_notice_fallback(p_id uuid, p_ok boolean, p_channel text, p_receipt text, p_error text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t client_notice_tasks%ROWTYPE;
  v_at timestamptz := now();
  l client_comm_logs%ROWTYPE;
BEGIN
  SELECT * INTO t FROM client_notice_tasks WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL OR t.status <> 'fallback_sending' THEN RETURN; END IF;
  IF p_ok THEN
    INSERT INTO client_comm_logs (office_id, workspace_key, source, channel, direction, result, line_label, body, occurred_at, content_hash, note)
    VALUES (t.office_id, t.workspace_key, 'alimtok', 'alimtok', 'out', 'sent', '', t.alimtok_text, v_at,
            public.comm_content_hash('alimtok', 'out', 'sent', v_at, NULL, t.alimtok_text, ''), '담당자 카톡 기한이 지나 알림톡으로 자동 대체: ' || t.title)
    RETURNING * INTO l;
    UPDATE client_notice_tasks SET status = 'fallback_sent', fallback_channel = left(coalesce(p_channel, 'alimtalk'), 30),
           fallback_receipt = left(coalesce(p_receipt, ''), 60), fallback_error = NULL, comm_log_id = l.id, sent_at = v_at,
           phone = NULL, updated_at = now()
     WHERE id = p_id;
  ELSE
    UPDATE client_notice_tasks SET status = 'fallback_failed', fallback_error = left(coalesce(p_error, '알림톡을 보내지 못했어요'), 300), updated_at = now()
     WHERE id = p_id;
    PERFORM public.notify_office_members(t.office_id, 'comm.view', public.crm_client_case_id(t.office_id, t.workspace_key),
      'notice_fallback_failed', '알림톡 자동 대체를 하지 못했어요', '담당자 카톡으로 보낼 안내가 남아 있어요. 오늘의 업무에서 확인해 주세요.',
      'case_comm', t.workspace_key, 'notice_fallback:' || t.id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_client_notice_fallback(uuid, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_client_notice_fallback(uuid, boolean, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_client_notice_fallbacks() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM client_notice_tasks WHERE status = 'pending' AND fallback AND due_at <= now()) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1;
  IF v_token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://mykim.kr/api/popbill?service=notice-fallback',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mykim-cron', v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_client_notice_fallbacks() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_dispatch_notice_fallbacks';
    -- 10분마다, UTC 0~10시 = KST 9~19시
    PERFORM cron.schedule('mykim_dispatch_notice_fallbacks', '*/10 0-10 * * *', 'SELECT public.dispatch_client_notice_fallbacks()');
  END IF;
END $$;

-- ── 6. 카카오톡 대화 내보내기 백업 (KT-4) ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comm-exports', 'comm-exports', false, 10485760, ARRAY['text/plain', 'text/csv'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.kakao_chat_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  workspace_key text,
  sales_lead_id text,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL DEFAULT '' CHECK (char_length(original_name) <= 200),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  client_sha256 text NOT NULL CHECK (client_sha256 ~ '^[0-9a-f]{64}$'),
  server_sha256 text,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'stored', 'mismatch', 'imported', 'failed')),
  format text CHECK (format IS NULL OR char_length(format) <= 30),
  client_names text[] NOT NULL DEFAULT '{}',
  office_names text[] NOT NULL DEFAULT '{}',
  line_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  unparsed_count integer NOT NULL DEFAULT 0,
  first_at timestamptz,
  last_at timestamptz,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  imported_at timestamptz,
  deleted_at timestamptz,
  CHECK ((workspace_key IS NOT NULL) <> (sales_lead_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS kakao_chat_exports_key_idx ON public.kakao_chat_exports (office_id, workspace_key, created_at DESC);
ALTER TABLE public.kakao_chat_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kakao_chat_exports FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, workspace_key, sales_lead_id, original_name, size_bytes, client_sha256, server_sha256, status, format,
              client_names, office_names, line_count, inserted_count, duplicate_count, skipped_count, unparsed_count, first_at, last_at,
              uploaded_by, created_at, verified_at, imported_at)
  ON public.kakao_chat_exports TO authenticated;
GRANT ALL ON public.kakao_chat_exports TO service_role;
DROP POLICY IF EXISTS kakao_chat_exports_read ON public.kakao_chat_exports;
CREATE POLICY kakao_chat_exports_read ON public.kakao_chat_exports FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.comm_can(office_id, 'comm.view', workspace_key, sales_lead_id, uploaded_by));

CREATE OR REPLACE FUNCTION public.kakao_export_upload_allowed(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM kakao_chat_exports e WHERE e.storage_path = p_name AND e.status = 'uploading'
                   AND e.uploaded_by = auth.uid() AND e.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.kakao_export_upload_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kakao_export_upload_allowed(text) TO authenticated;

-- 원본 내려받기 = 5분 안에 열람 기록을 남긴 사람만
CREATE OR REPLACE FUNCTION public.kakao_export_read_allowed(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM kakao_chat_exports e
    WHERE e.storage_path = p_name AND e.deleted_at IS NULL
      AND public.comm_can(e.office_id, 'comm.view', e.workspace_key, e.sales_lead_id, e.uploaded_by)
      AND EXISTS (SELECT 1 FROM evidence_access_logs a WHERE a.target_id = e.id::text AND a.user_id = auth.uid()
                    AND a.target_type = 'export' AND a.created_at > now() - interval '5 minutes'));
$$;
REVOKE ALL ON FUNCTION public.kakao_export_read_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kakao_export_read_allowed(text) TO authenticated;

DROP POLICY IF EXISTS comm_exports_obj_insert ON storage.objects;
CREATE POLICY comm_exports_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comm-exports' AND public.kakao_export_upload_allowed(name));
DROP POLICY IF EXISTS comm_exports_obj_read ON storage.objects;
CREATE POLICY comm_exports_obj_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comm-exports' AND public.kakao_export_read_allowed(name));

CREATE OR REPLACE FUNCTION public.create_kakao_export_upload(p_office_id text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v_sha text := lower(coalesce(p ->> 'sha256', ''));
  v_size bigint := nullif(p ->> 'size_bytes', '')::bigint;
  v_id uuid := gen_random_uuid();
  v_path text;
BEGIN
  IF public.current_office_member(p_office_id) IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF (v_key IS NULL) = (v_lead IS NULL) THEN RAISE EXCEPTION 'workspace_key or sales_lead_id required' USING ERRCODE = '22023'; END IF;
  IF (v_key IS NOT NULL AND (v_key !~ '^[A-Za-z0-9_-]{1,80}$' OR NOT public.comm_key_in_office(p_office_id, v_key)))
     OR (v_lead IS NOT NULL AND (v_lead !~ '^[A-Za-z0-9_-]{1,80}$' OR NOT public.comm_lead_in_office(p_office_id, v_lead))) THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.comm_can(p_office_id, 'comm.view', v_key, v_lead, NULL) THEN RAISE EXCEPTION 'permission denied: comm.view' USING ERRCODE = '42501'; END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'sha256 required' USING ERRCODE = '22023'; END IF;
  IF v_size IS NULL OR v_size < 1 OR v_size > 10485760 THEN RAISE EXCEPTION 'file too large (10MB)' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM kakao_chat_exports WHERE uploaded_by = auth.uid() AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'too many uploads today' USING ERRCODE = '22023';
  END IF;
  v_path := p_office_id || '/' || coalesce(v_key, 'lead-' || v_lead) || '/' || v_id || '.txt';
  INSERT INTO kakao_chat_exports (id, office_id, workspace_key, sales_lead_id, storage_path, original_name, size_bytes, client_sha256, uploaded_by)
  VALUES (v_id, p_office_id, v_key, v_lead, v_path, left(coalesce(p ->> 'original_name', ''), 200), v_size, v_sha, auth.uid());
  RETURN jsonb_build_object('id', v_id, 'path', v_path);
END;
$$;
REVOKE ALL ON FUNCTION public.create_kakao_export_upload(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_kakao_export_upload(text, jsonb) TO authenticated;

-- 서버가 저장소 파일을 내려받아 계산한 지문 기록 (api/device.js verify-kakao-export, service_role)
CREATE OR REPLACE FUNCTION public.finish_kakao_export_upload(p_id uuid, p_server_sha text, p_size bigint, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e kakao_chat_exports%ROWTYPE;
BEGIN
  SELECT * INTO e FROM kakao_chat_exports WHERE id = p_id FOR UPDATE;
  IF e.id IS NULL OR e.uploaded_by IS DISTINCT FROM p_actor OR e.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF e.status <> 'uploading' THEN RETURN jsonb_build_object('ok', true, 'status', e.status); END IF;
  IF p_server_sha IS NULL THEN
    UPDATE kakao_chat_exports SET status = 'failed' WHERE id = p_id;
    RETURN jsonb_build_object('ok', false, 'error', 'file_missing');
  END IF;
  UPDATE kakao_chat_exports SET server_sha256 = lower(p_server_sha), verified_at = now(),
         status = CASE WHEN lower(p_server_sha) = e.client_sha256 AND p_size = e.size_bytes THEN 'stored' ELSE 'mismatch' END
   WHERE id = p_id RETURNING * INTO e;
  RETURN jsonb_build_object('ok', true, 'status', e.status);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_kakao_export_upload(uuid, text, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_kakao_export_upload(uuid, text, bigint, uuid) TO service_role;

-- 줄 넣기 (브라우저가 원본 파일을 해석해 보냄. 원본·지문은 위에서 확인됨). 여러 번 나눠 보낼 수 있고 마지막에 p_final
-- p = { format, client_names[], office_names[], unparsed, lines: [{at, sender, body, n}] }
--  n = 같은 시각·같은 사람·같은 내용이 파일 안에서 몇 번째인지 (같은 대화를 다시 올려도 같은 줄은 같은 지문)
CREATE OR REPLACE FUNCTION public.import_kakao_export_lines(p_export_id uuid, p jsonb, p_final boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e kakao_chat_exports%ROWTYPE;
  v_member office_members;
  v_clients text[];
  v_office text[];
  v_lines jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  v_total integer;
  v_valid integer := 0;
  v_ins integer := 0;
BEGIN
  SELECT * INTO e FROM kakao_chat_exports WHERE id = p_export_id FOR UPDATE;
  IF e.id IS NULL OR e.uploaded_by <> auth.uid() OR e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'export not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.comm_can(e.office_id, 'comm.view', e.workspace_key, e.sales_lead_id, NULL) THEN RAISE EXCEPTION 'permission denied: comm.view' USING ERRCODE = '42501'; END IF;
  IF e.status = 'mismatch' THEN RAISE EXCEPTION 'file fingerprint mismatch' USING ERRCODE = '22023'; END IF;
  IF e.status <> 'stored' THEN RAISE EXCEPTION 'file not stored yet' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(v_lines) <> 'array' THEN RAISE EXCEPTION 'lines must be an array' USING ERRCODE = '22023'; END IF;
  v_total := jsonb_array_length(v_lines);
  IF v_total > 3000 THEN RAISE EXCEPTION 'too many lines in one call (3000)' USING ERRCODE = '22023'; END IF;
  v_member := public.current_office_member(e.office_id);
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 60)), '{}') INTO v_clients FROM jsonb_array_elements_text(coalesce(p -> 'client_names', '[]'::jsonb)) x WHERE btrim(x) <> '';
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 60)), '{}') INTO v_office FROM jsonb_array_elements_text(coalesce(p -> 'office_names', '[]'::jsonb)) x WHERE btrim(x) <> '';
  IF cardinality(v_clients) = 0 THEN RAISE EXCEPTION 'choose the client name' USING ERRCODE = '22023'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _kx (at timestamptz, sender text, body text, n integer, dir text) ON COMMIT DROP;
  TRUNCATE _kx;
  -- 넣을 줄: 고른 사람(의뢰인·사무소)·시각 범위 안·빈 줄 아님·주민번호 형식 없음
  INSERT INTO _kx
  SELECT s.at, s.sender, s.body, s.n, CASE WHEN s.sender = ANY (v_clients) THEN 'in' ELSE 'out' END
  FROM (
    SELECT (l ->> 'at')::timestamptz AS at, left(btrim(coalesce(l ->> 'sender', '')), 60) AS sender,
           left(coalesce(l ->> 'body', ''), 2000) AS body, greatest(1, coalesce((l ->> 'n')::int, 1)) AS n
    FROM jsonb_array_elements(v_lines) l
  ) s
  WHERE s.at IS NOT NULL AND s.at >= '2010-01-01'::timestamptz AND s.at <= now() + interval '1 day'
    AND btrim(s.body) <> '' AND (s.sender = ANY (v_clients) OR s.sender = ANY (v_office))
    AND NOT public.notice_text_has_rrn(s.body);
  GET DIAGNOSTICS v_valid = ROW_COUNT;

  WITH ok AS (SELECT * FROM _kx), ins AS (
    INSERT INTO client_comm_logs (office_id, user_id, member_id, workspace_key, sales_lead_id, source, channel, direction, result,
                                  line_label, body, occurred_at, content_hash, sender_name, export_id)
    SELECT e.office_id, auth.uid(), v_member.id, e.workspace_key, e.sales_lead_id, 'kakao_export', 'kakao', ok.dir,
           CASE WHEN ok.dir = 'in' THEN 'received' ELSE 'sent' END, '', ok.body, ok.at,
           public.comm_content_hash('kakao', ok.dir, CASE WHEN ok.dir = 'in' THEN 'received' ELSE 'sent' END, ok.at, NULL, ok.body,
                                    ok.sender || '#' || ok.n),
           ok.sender, e.id
    FROM ok
    ON CONFLICT (office_id, (coalesce(workspace_key, 'lead:' || sales_lead_id)), content_hash) WHERE source = 'kakao_export' DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_ins FROM ins;

  UPDATE kakao_chat_exports SET
    format = coalesce(left(nullif(p ->> 'format', ''), 30), format),
    client_names = v_clients, office_names = v_office,
    line_count = line_count + v_total,
    inserted_count = inserted_count + v_ins,
    skipped_count = skipped_count + (v_total - v_valid),
    duplicate_count = duplicate_count + (v_valid - v_ins),
    unparsed_count = CASE WHEN p_final THEN coalesce((p ->> 'unparsed')::int, unparsed_count) ELSE unparsed_count END,
    first_at = least(first_at, (SELECT min(k.at) FROM _kx k)),
    last_at = greatest(last_at, (SELECT max(k.at) FROM _kx k)),
    status = CASE WHEN p_final THEN 'imported' ELSE status END,
    imported_at = CASE WHEN p_final THEN now() ELSE imported_at END
  WHERE id = e.id RETURNING * INTO e;
  IF p_final THEN
    PERFORM public.office_log(e.office_id, 'comm.kakao_export', 'kakao_chat_export', e.id::text,
      jsonb_build_object('lines', e.line_count, 'inserted', e.inserted_count, 'duplicates', e.duplicate_count));
  END IF;
  RETURN jsonb_build_object('id', e.id, 'status', e.status, 'inserted', v_ins, 'skipped', v_total - v_valid,
                            'duplicates', v_valid - v_ins,
                            'total_inserted', e.inserted_count, 'total_duplicates', e.duplicate_count);
END;
$$;
REVOKE ALL ON FUNCTION public.import_kakao_export_lines(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_kakao_export_lines(uuid, jsonb, boolean) TO authenticated;

-- 원본 파일 열람 기록 → 저장소 경로 (5분 동안 내려받기 가능)
CREATE OR REPLACE FUNCTION public.log_kakao_export_access(p_export_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e kakao_chat_exports%ROWTYPE;
BEGIN
  SELECT * INTO e FROM kakao_chat_exports WHERE id = p_export_id;
  IF e.id IS NULL OR e.deleted_at IS NOT NULL OR NOT public.comm_can(e.office_id, 'comm.view', e.workspace_key, e.sales_lead_id, e.uploaded_by) THEN
    RAISE EXCEPTION 'export not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO evidence_access_logs (office_id, user_id, member_id, target_type, target_id, action)
  VALUES (e.office_id, auth.uid(), (public.current_office_member(e.office_id)).id, 'export', e.id::text, 'download');
  RETURN e.storage_path;
END;
$$;
REVOKE ALL ON FUNCTION public.log_kakao_export_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_kakao_export_access(uuid) TO authenticated;

-- ── 7. PC 카카오톡 묶음 발송 (KT-8, 사무소 선택) ─────────────────────────────────
ALTER TABLE public.office_comm_policies ADD COLUMN IF NOT EXISTS kakao_pc_batch_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.office_comm_policies ADD COLUMN IF NOT EXISTS kakao_pc_batch_ack_at timestamptz;
ALTER TABLE public.office_comm_policies ADD COLUMN IF NOT EXISTS kakao_pc_batch_ack_by uuid;
ALTER TABLE public.office_comm_policies ADD COLUMN IF NOT EXISTS kakao_pc_batch_daily_limit integer NOT NULL DEFAULT 100
  CHECK (kakao_pc_batch_daily_limit BETWEEN 1 AND 1000);

CREATE OR REPLACE FUNCTION public.set_office_comm_policy(p_office_id text, p jsonb, p_expected_version integer DEFAULT NULL)
RETURNS public.office_comm_policies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v office_comm_policies%ROWTYPE;
  v_batch boolean;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: office.settings.edit' USING ERRCODE = '42501';
  END IF;
  v := public.comm_policy_row(p_office_id);
  IF p_expected_version IS NOT NULL AND p_expected_version <> v.version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001'; END IF;
  v_batch := coalesce((p ->> 'kakao_pc_batch_enabled')::boolean, v.kakao_pc_batch_enabled);
  -- 처음 켤 때는 [운영자 판단] 안내 확인이 있어야 한다 (계정 제한·오발송 위험)
  IF v_batch AND NOT v.kakao_pc_batch_enabled AND v.kakao_pc_batch_ack_at IS NULL AND coalesce((p ->> 'kakao_pc_batch_ack')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'acknowledgement required to enable PC KakaoTalk batch' USING ERRCODE = '22023';
  END IF;
  UPDATE office_comm_policies SET
    require_approval = coalesce((p ->> 'require_approval')::boolean, require_approval),
    upload_network = coalesce(p ->> 'upload_network', upload_network),
    upload_recordings = coalesce((p ->> 'upload_recordings')::boolean, upload_recordings),
    auto_transcribe = coalesce((p ->> 'auto_transcribe')::boolean, auto_transcribe),
    app_sms_allowed = coalesce((p ->> 'app_sms_allowed')::boolean, app_sms_allowed),
    sms_daily_limit = coalesce((p ->> 'sms_daily_limit')::integer, sms_daily_limit),
    sms_quiet_start = coalesce((p ->> 'sms_quiet_start')::integer, sms_quiet_start),
    sms_quiet_end = coalesce((p ->> 'sms_quiet_end')::integer, sms_quiet_end),
    staff_notice = coalesce(nullif(btrim(p ->> 'staff_notice'), ''), staff_notice),
    kakao_pc_batch_enabled = v_batch,
    kakao_pc_batch_daily_limit = coalesce((p ->> 'kakao_pc_batch_daily_limit')::integer, kakao_pc_batch_daily_limit),
    kakao_pc_batch_ack_at = CASE WHEN v_batch AND kakao_pc_batch_ack_at IS NULL THEN now() ELSE kakao_pc_batch_ack_at END,
    kakao_pc_batch_ack_by = CASE WHEN v_batch AND kakao_pc_batch_ack_at IS NULL THEN auth.uid() ELSE kakao_pc_batch_ack_by END,
    version = version + 1, updated_by = auth.uid(), updated_at = now()
  WHERE office_id = p_office_id RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'settings.comm_policy', 'office_comm_policy', p_office_id,
    jsonb_build_object('fields', (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(p) k)));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_comm_policy(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_comm_policy(text, jsonb, integer) TO authenticated;

-- 묶음 발송 목록: 담당자 카톡 대기 안내 중 '의뢰인 카톡 이름'이 있고 그 이름이 사무소 안에서 한 사건뿐인 것만
CREATE OR REPLACE FUNCTION public.kakao_pc_batch_list(p_office_id text, p_limit integer DEFAULT 30)
RETURNS TABLE (task_id uuid, workspace_key text, kakao_name text, title text, body text, due_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_pol office_comm_policies%ROWTYPE;
BEGIN
  IF public.current_office_member(p_office_id) IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  v_pol := public.comm_policy_row(p_office_id);
  IF NOT v_pol.kakao_pc_batch_enabled THEN RAISE EXCEPTION 'PC KakaoTalk batch is off' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  SELECT t.id, t.workspace_key, n.kakao_name, t.title, t.body, t.due_at
  FROM client_notice_tasks t
  JOIN case_kakao_names n ON n.office_id = t.office_id AND n.workspace_key = t.workspace_key
  WHERE t.office_id = p_office_id AND t.status IN ('pending', 'fallback_failed')
    AND public.comm_can(p_office_id, 'comm.view', t.workspace_key, NULL, t.created_by)
    AND NOT EXISTS (SELECT 1 FROM case_kakao_names o WHERE o.office_id = n.office_id AND o.workspace_key <> n.workspace_key
                      AND lower(btrim(o.kakao_name)) = lower(btrim(n.kakao_name)))
  ORDER BY t.due_at
  LIMIT greatest(1, least(coalesce(p_limit, 30), 30));
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_pc_batch_list(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kakao_pc_batch_list(text, integer) TO authenticated;

-- 결과 올리기: 발송결과 1인 줄만 '보냄'(PC 묶음)으로, 0인 줄은 할 일 유지. 하루 한도 안에서만
CREATE OR REPLACE FUNCTION public.record_kakao_pc_batch_results(p_office_id text, p_task_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_pol office_comm_policies%ROWTYPE;
  v_today integer;
  v_done integer := 0;
  v_skipped integer := 0;
  v_id uuid;
  t client_notice_tasks%ROWTYPE;
BEGIN
  IF v_member.id IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  v_pol := public.comm_policy_row(p_office_id);
  IF NOT v_pol.kakao_pc_batch_enabled THEN RAISE EXCEPTION 'PC KakaoTalk batch is off' USING ERRCODE = '22023'; END IF;
  IF coalesce(cardinality(p_task_ids), 0) > 30 THEN RAISE EXCEPTION 'at most 30 rows at once' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO v_today FROM client_notice_tasks
   WHERE office_id = p_office_id AND sent_via = 'kakao_pc_batch' AND sent_at >= (public.seoul_today()::timestamp AT TIME ZONE 'Asia/Seoul');
  FOREACH v_id IN ARRAY coalesce(p_task_ids, '{}') LOOP
    SELECT * INTO t FROM client_notice_tasks WHERE id = v_id;
    IF t.id IS NULL OR t.office_id <> p_office_id OR t.status NOT IN ('pending', 'fallback_failed')
       OR NOT public.comm_can(p_office_id, 'comm.view', t.workspace_key, NULL, t.created_by)
       OR v_today + v_done >= v_pol.kakao_pc_batch_daily_limit THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    PERFORM public.complete_notice_task_core(v_id, 'kakao_pc_batch', NULL, auth.uid(), v_member.id);
    v_done := v_done + 1;
  END LOOP;
  PERFORM public.office_log(p_office_id, 'notice.pc_batch', 'client_notice_task', NULL, jsonb_build_object('sent', v_done, 'skipped', v_skipped));
  RETURN jsonb_build_object('sent', v_done, 'skipped', v_skipped);
END;
$$;
REVOKE ALL ON FUNCTION public.record_kakao_pc_batch_results(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_kakao_pc_batch_results(text, uuid[]) TO authenticated;

-- ── 8. 오늘의 업무에 '카톡으로 안내 보내기' (담당 직원 기본) ─────────────────────────
DO $mig$
DECLARE
  v_def text := pg_get_functiondef('public.office_work_queue(text)'::regprocedure);
  v_anchor text := '  -- 묶음·권한·사람이 누른 설정 반영';
  v_kinds_old text := 'CASE WHEN r.kind IN (''client_documents'', ''form_review''';
  v_kinds_new text := 'CASE WHEN r.kind IN (''client_documents'', ''client_notice'', ''form_review''';
  v_block text := $blk$  -- 12. 담당자 카톡으로 보낼 안내 (KT-2): 기한이 지나면 알림톡으로 자동 대체
  INSERT INTO _wq
  SELECT 'notice:' || t.id, 'client_notice',
         CASE WHEN t.status = 'fallback_failed' THEN '알림톡 대체 실패 · 카톡으로 안내 보내기 · ' ELSE '카톡으로 안내 보내기 · ' END || t.title,
         t.workspace_key, NULL, CASE WHEN t.status = 'fallback_failed' THEN t.created_at ELSE t.due_at END,
         CASE WHEN t.fallback AND t.status = 'pending' THEN '지나면 알림톡으로 대체' ELSE '근무 시간 기준' END,
         NULL, false, false, 'comm.view', 'case_comm', t.workspace_key, 1, 1
  FROM client_notice_tasks t WHERE t.office_id = p_office_id AND t.status IN ('pending', 'fallback_failed');

$blk$;
BEGIN
  IF position('''client_notice''' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def) = 0 THEN RAISE EXCEPTION 'office_work_queue anchor not found'; END IF;
  IF position(v_kinds_old IN v_def) = 0 THEN RAISE EXCEPTION 'office_work_queue staff kinds not found'; END IF;
  v_def := replace(v_def, v_anchor, v_block || v_anchor);
  v_def := replace(v_def, v_kinds_old, v_kinds_new);
  EXECUTE v_def;
END $mig$;

-- ── 9. 정리: 끝난 할 일의 번호·문구는 90일 뒤 지움 (기록은 소통 기록에 남음) ──────────────
CREATE OR REPLACE FUNCTION public.purge_client_notice_tasks() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM client_notice_tasks WHERE status IN ('sent', 'fallback_sent', 'cancelled') AND updated_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.purge_client_notice_tasks() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_client_notice_tasks';
    PERFORM cron.schedule('mykim_purge_client_notice_tasks', '15 18 * * *', 'SELECT public.purge_client_notice_tasks()');
  END IF;
END $$;
