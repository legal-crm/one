-- ============================================================
-- 알림 서버화 1단계 (ST-7·MY·X-1 '변경 전달')
-- 문제: 변호사 알림은 보낸 사람 브라우저가 만들거나(옛 직원 ID 기준), 의뢰인 알림은 의뢰인 기기에만 있어서
--       새 상담 요청·채팅·서류 제출이 생겨도 받는 사람에게 알림이 가지 않았다. Realtime 발행에도 표가 없었다.
-- 바꾼 것:
--  * user_notifications: 받는 사람 = 로그인 계정(auth.uid). 쓰기는 DB 트리거·서버 함수만, 받는 사람은 읽음 표시만
--  * 같은 일이 쌓이면(예: 채팅 여러 개) 읽기 전까지 한 줄로 묶고 건수만 올린다 (dedupe_key)
--  * 사무소 알림은 권한 범위대로: 그 일을 볼 권한(전체/담당)이 있는 구성원에게만. 일을 한 본인은 제외
--  * 사건 안 정보(채무액·소득·실명)는 알림 글에 넣지 않는다 (가명·건수·링크만)
--  * 트리거: 새 상담 요청 / 의뢰인 채팅 / 의뢰인 서류 제출 / 의뢰인 입금 알림 → 사무소,
--            변호사 채팅 / 제안서 도착 / 서류 '다시 요청' → 의뢰인
--  * Realtime 발행에 user_notifications 추가 (구독자 RLS로 걸러짐)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('office', 'client')),
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text CHECK (body IS NULL OR char_length(body) <= 300),
  link_type text CHECK (link_type IS NULL OR char_length(link_type) <= 40),
  link_id text CHECK (link_id IS NULL OR char_length(link_id) <= 120),
  dedupe_key text CHECK (dedupe_key IS NULL OR char_length(dedupe_key) <= 200),
  count integer NOT NULL DEFAULT 1 CHECK (count >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_notifications_recipient_idx ON public.user_notifications (recipient_user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_open_dedupe_uq ON public.user_notifications (recipient_user_id, dedupe_key)
  WHERE read_at IS NULL AND dedupe_key IS NOT NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_notifications_own_select ON public.user_notifications;
CREATE POLICY user_notifications_own_select ON public.user_notifications FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS user_notifications_own_update ON public.user_notifications;
CREATE POLICY user_notifications_own_update ON public.user_notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS user_notifications_own_delete ON public.user_notifications;
CREATE POLICY user_notifications_own_delete ON public.user_notifications FOR DELETE TO authenticated USING (recipient_user_id = auth.uid());
GRANT SELECT, UPDATE, DELETE ON public.user_notifications TO authenticated;
REVOKE ALL ON public.user_notifications FROM anon;

-- 받는 사람은 읽음 표시만 바꿀 수 있다
CREATE OR REPLACE FUNCTION public.user_notifications_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF (to_jsonb(NEW) - 'read_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read_at') THEN
      RAISE EXCEPTION 'only read_at can change' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_notifications_guard ON public.user_notifications;
CREATE TRIGGER user_notifications_guard BEFORE UPDATE ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION public.user_notifications_guard();

-- 알림 한 건 (같은 dedupe_key의 안 읽은 알림이 있으면 건수만 올림)
CREATE OR REPLACE FUNCTION public.notify_user(
  p_recipient uuid, p_audience text, p_office_id text, p_kind text, p_title text, p_body text,
  p_link_type text, p_link_id text, p_dedupe_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_recipient IS NULL OR p_recipient = auth.uid() THEN
    RETURN; -- 본인이 한 일은 본인에게 알리지 않는다
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_recipient) THEN
    RETURN;
  END IF;
  IF p_dedupe_key IS NULL THEN
    INSERT INTO public.user_notifications (recipient_user_id, audience, office_id, kind, title, body, link_type, link_id)
    VALUES (p_recipient, p_audience, p_office_id, left(p_kind, 40), left(p_title, 120), left(p_body, 300), p_link_type, left(p_link_id, 120));
  ELSE
    INSERT INTO public.user_notifications (recipient_user_id, audience, office_id, kind, title, body, link_type, link_id, dedupe_key)
    VALUES (p_recipient, p_audience, p_office_id, left(p_kind, 40), left(p_title, 120), left(p_body, 300), p_link_type, left(p_link_id, 120), left(p_dedupe_key, 200))
    ON CONFLICT (recipient_user_id, dedupe_key) WHERE read_at IS NULL AND dedupe_key IS NOT NULL
    DO UPDATE SET count = public.user_notifications.count + 1, updated_at = now(), body = EXCLUDED.body;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- 구성원 한 명의 권한 범위 (로그인한 사람이 아니라 받는 사람 기준 — office_permission_scope와 같은 규칙)
CREATE OR REPLACE FUNCTION public.member_permission_scope(p_member public.office_members, p_permission text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text;
  v_scope text;
  v_lawyer_only boolean;
  v_custom jsonb;
  v_override text;
BEGIN
  IF p_member.id IS NULL OR p_member.status <> 'active' THEN RETURN 'none'; END IF;
  IF p_member.role = 'custom' THEN
    SELECT r.base_role, r.scopes INTO v_base, v_custom FROM office_custom_roles r WHERE r.id = p_member.custom_role_id;
    IF v_base IS NULL THEN RETURN 'none'; END IF;
  ELSE
    v_base := p_member.role;
  END IF;
  SELECT p.scope, p.lawyer_only INTO v_scope, v_lawyer_only FROM office_role_permissions p WHERE p.role = v_base AND p.permission = p_permission;
  IF v_scope IS NULL THEN RETURN 'none'; END IF;
  IF v_lawyer_only THEN
    IF v_base IN ('owner', 'lawyer') AND public.member_is_verified_lawyer(p_member) THEN RETURN v_scope; END IF;
    RETURN 'none';
  END IF;
  IF v_custom IS NOT NULL AND v_custom ? p_permission THEN v_scope := v_custom ->> p_permission; END IF;
  v_override := p_member.scope_overrides ->> p_permission;
  IF v_override IS NOT NULL THEN v_scope := v_override; END IF;
  IF v_scope NOT IN ('none', 'assigned', 'all') THEN RETURN 'none'; END IF;
  RETURN v_scope;
END;
$$;
REVOKE ALL ON FUNCTION public.member_permission_scope(public.office_members, text) FROM PUBLIC, anon, authenticated;

-- 사무소 구성원에게 (권한 범위대로, 담당 범위는 그 사건 담당자만)
CREATE OR REPLACE FUNCTION public.notify_office_members(
  p_office_id text, p_permission text, p_case_id uuid, p_kind text, p_title text, p_body text,
  p_link_type text, p_link_id text, p_dedupe_prefix text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.office_members;
  v_scope text;
  v_case public.cases;
BEGIN
  IF p_office_id IS NULL THEN RETURN; END IF;
  IF p_case_id IS NOT NULL THEN
    SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  END IF;
  FOR m IN
    SELECT om.* FROM public.office_members om JOIN public.offices o ON o.id = om.office_id AND o.status = 'active'
    WHERE om.office_id = p_office_id AND om.status = 'active' AND om.user_id IS NOT NULL
  LOOP
    v_scope := public.member_permission_scope(m, p_permission);
    IF v_scope = 'all' OR (v_scope = 'assigned' AND v_case.id IS NOT NULL AND m.id IN (v_case.lawyer_member_id, v_case.staff_member_id)) THEN
      PERFORM public.notify_user(m.user_id, 'office', p_office_id, p_kind, p_title, p_body, p_link_type, p_link_id,
        CASE WHEN p_dedupe_prefix IS NULL THEN NULL ELSE p_dedupe_prefix END);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_office_members(text, text, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- 상담 요청이 향한 사무소들 (선택·수락한 변호사의 사무소)
CREATE OR REPLACE FUNCTION public.consult_request_office_ids(p_req public.consult_requests)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT m.office_id), '{}')
  FROM public.office_members m
  WHERE m.status = 'active' AND m.lawyer_id IS NOT NULL AND (
    m.lawyer_id = p_req.selected_lawyer_id
    OR (jsonb_typeof(p_req.selected_lawyer_ids) = 'array' AND p_req.selected_lawyer_ids ? m.lawyer_id)
    OR (jsonb_typeof(p_req.accepted_lawyer_ids) = 'array' AND p_req.accepted_lawyer_ids ? m.lawyer_id)
    OR m.lawyer_id = p_req.created_by_lawyer_id);
$$;
REVOKE ALL ON FUNCTION public.consult_request_office_ids(public.consult_requests) FROM PUBLIC, anon, authenticated;

-- 이 요청의 화면용 이름 (가명). 실명·채무 정보는 쓰지 않는다
CREATE OR REPLACE FUNCTION public.consult_request_alias(p_req public.consult_requests)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(nullif(left(btrim(coalesce(p_req.client_name, '')), 20), ''), '의뢰인');
$$;

-- ── 트리거 1: 새 상담 요청 → 선택받은 변호사의 사무소 ──────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_consult_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new text[];
  v_old text[] := '{}';
  v_office text;
BEGIN
  -- (request_type 칸 기본값이 'open'이라 그것으로 거르지 않는다. 선택한 변호사가 없으면 알릴 사무소도 없다)
  IF NEW.admin_hidden IS TRUE THEN RETURN NEW; END IF;
  v_new := public.consult_request_office_ids(NEW);
  IF TG_OP = 'UPDATE' THEN v_old := public.consult_request_office_ids(OLD); END IF;
  FOREACH v_office IN ARRAY v_new LOOP
    IF NOT (v_office = ANY (v_old)) THEN
      PERFORM public.notify_office_members(v_office, 'consult.view', NULL, 'consult_request_new',
        '새 상담 요청이 도착했어요', public.consult_request_alias(NEW) || '님이 상담을 요청했어요.',
        'consult_request', NEW.id, 'consult_new:' || NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 원래 저장(상담 요청·채팅·서류)을 막지 않게
  RAISE WARNING 'notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_consult_request ON public.consult_requests;
CREATE TRIGGER trg_notify_consult_request AFTER INSERT OR UPDATE OF selected_lawyer_id, selected_lawyer_ids, accepted_lawyer_ids
  ON public.consult_requests FOR EACH ROW EXECUTE FUNCTION public.trg_notify_consult_request();

-- ── 트리거 2: 채팅 → 반대편 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_consult_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.consult_requests;
  v_office text;
  v_case uuid;
  v_target_office text;
BEGIN
  SELECT * INTO v_req FROM public.consult_requests WHERE id = NEW.consult_request_id;
  IF v_req.id IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_type = 'client' THEN
    -- 특정 변호사에게 보낸 메시지면 그 사무소만
    IF NEW.target_lawyer_id IS NOT NULL THEN
      SELECT m.office_id INTO v_target_office FROM public.office_members m WHERE m.lawyer_id = NEW.target_lawyer_id AND m.status = 'active' LIMIT 1;
    END IF;
    FOREACH v_office IN ARRAY public.consult_request_office_ids(v_req) LOOP
      IF v_target_office IS NULL OR v_target_office = v_office THEN
        SELECT c.id INTO v_case FROM public.cases c WHERE c.office_id = v_office AND c.consult_request_id = v_req.id AND c.deleted_at IS NULL LIMIT 1;
        -- 사건 기록 전에는 상담 요청을 볼 수 있는 사람에게, 사건이 있으면 채팅 권한(담당 범위) 기준
        PERFORM public.notify_office_members(v_office, CASE WHEN v_case IS NULL THEN 'consult.view' ELSE 'consult.chat' END, v_case,
          'client_message', '의뢰인 새 메시지', public.consult_request_alias(v_req) || '님이 메시지를 보냈어요.',
          'chat', v_req.id, 'chat:' || v_req.id);
      END IF;
    END LOOP;
  ELSIF NEW.sender_type IN ('lawyer', 'staff') THEN
    IF v_req.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM public.notify_user(v_req.client_id::uuid, 'client', NULL, 'lawyer_message',
        '변호사 새 메시지', coalesce(nullif(left(NEW.sender_name, 30), ''), '담당 변호사') || ' 메시지가 도착했어요.',
        'chat', v_req.id, 'chat:' || v_req.id);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 원래 저장(상담 요청·채팅·서류)을 막지 않게
  RAISE WARNING 'notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_consult_message ON public.consult_messages;
CREATE TRIGGER trg_notify_consult_message AFTER INSERT ON public.consult_messages FOR EACH ROW EXECUTE FUNCTION public.trg_notify_consult_message();

-- ── 트리거 3: 제안서 도착 → 의뢰인 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new integer := CASE WHEN jsonb_typeof(NEW.proposals) = 'array' THEN jsonb_array_length(NEW.proposals) ELSE 0 END;
  v_old integer := CASE WHEN jsonb_typeof(OLD.proposals) = 'array' THEN jsonb_array_length(OLD.proposals) ELSE 0 END;
BEGIN
  IF v_new > v_old AND NEW.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public.notify_user(NEW.client_id::uuid, 'client', NULL, 'proposal_new',
      '변호사 검토 제안서가 도착했어요', '내 관리방에서 제안서를 확인해 보세요.', 'proposal', NEW.id, 'proposal:' || NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 원래 저장(상담 요청·채팅·서류)을 막지 않게
  RAISE WARNING 'notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_proposal ON public.consult_requests;
CREATE TRIGGER trg_notify_proposal AFTER UPDATE OF proposals ON public.consult_requests FOR EACH ROW EXECUTE FUNCTION public.trg_notify_proposal();

-- 사건 키('상담 요청 ID' 또는 'case-…') → 의뢰인 계정
CREATE OR REPLACE FUNCTION public.case_key_client_user(p_key text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v text;
  v_uid uuid;
BEGIN
  IF p_key ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT oc.client_user_id INTO v_uid FROM public.cases c JOIN public.office_clients oc ON oc.id = c.office_client_id
    WHERE c.id = substr(p_key, 6)::uuid;
    RETURN v_uid;
  END IF;
  SELECT client_id INTO v FROM public.consult_requests WHERE id = p_key;
  IF v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN v::uuid; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.case_key_client_user(text) FROM PUBLIC, anon, authenticated;

-- ── 트리거 4: 서류 → (의뢰인 제출) 사무소 / (다시 요청) 의뢰인 ───────────────
CREATE OR REPLACE FUNCTION public.trg_notify_case_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.upload_source = 'client' THEN
    PERFORM public.notify_office_members(NEW.office_id, 'documents.manage', public.crm_client_case_id(NEW.office_id, NEW.client_key),
      'client_document', '의뢰인이 서류를 냈어요', '확인할 서류가 있어요.', 'case_documents', NEW.client_key, 'docs:' || NEW.client_key);
  ELSIF TG_OP = 'UPDATE' AND NEW.upload_source = 'client' AND NEW.review_status = 'rejected' AND OLD.review_status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.notify_user(public.case_key_client_user(NEW.client_key), 'client', NULL, 'document_rejected',
      '서류를 다시 내 주세요', '담당 사무소가 사유와 함께 다시 요청했어요.', 'mypage_documents', NEW.client_key, 'docs_rejected:' || NEW.client_key);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 원래 저장(상담 요청·채팅·서류)을 막지 않게
  RAISE WARNING 'notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_case_file ON public.case_files;
CREATE TRIGGER trg_notify_case_file AFTER INSERT OR UPDATE OF review_status ON public.case_files FOR EACH ROW EXECUTE FUNCTION public.trg_notify_case_file();

-- ── 트리거 5: 의뢰인 '입금했어요' → 수납 기록 권한자 ───────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_fee_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
BEGIN
  SELECT coalesce(c.consult_request_id, 'case-' || c.id::text) INTO v_key FROM public.cases c WHERE c.id = NEW.case_id;
  PERFORM public.notify_office_members(NEW.office_id, 'fee.record', NEW.case_id, 'fee_client_report',
    '의뢰인 입금 알림', '입금 확인이 필요한 알림이 있어요.', 'case_fees', v_key, 'fee_report:' || NEW.case_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 원래 저장(상담 요청·채팅·서류)을 막지 않게
  RAISE WARNING 'notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_fee_report ON public.fee_client_reports;
CREATE TRIGGER trg_notify_fee_report AFTER INSERT ON public.fee_client_reports FOR EACH ROW EXECUTE FUNCTION public.trg_notify_fee_report();

-- 오래된 읽은 알림 정리 (90일)
CREATE OR REPLACE FUNCTION public.purge_user_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.user_notifications WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_user_notifications() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_user_notifications';
  PERFORM cron.schedule('mykim_purge_user_notifications', '40 18 * * *', 'SELECT public.purge_user_notifications()');
END;
$$;

-- Realtime: 받는 사람 화면이 바로 갱신되도록 (RLS로 본인 것만 전달)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END;
$$;
