-- ============================================================================
-- 020. 로펌 팀원·캘린더·내부 메신저 서버 권한 (PART 2-16)
-- ----------------------------------------------------------------------------
-- 점검 결과 (적용 전 상태)
--   * internal_messages / task_tickets / in_app_notifications:
--     006의 "authenticated_all_*" (USING true) 정책이 남아 있어 로그인한 누구나(의뢰인·다른 사무소 포함)
--     모든 메시지·업무·알림을 읽고 고치고 지울 수 있었다. 008은 internal_messages의 이 정책을 지우지 않았다.
--   * calendar_events: 앱이 visibility 컬럼을 쓰지 않아 기본값 'firm'이 남았고, RLS가 그 값을 보고
--     '나만 보기' 일정을 모두에게 허용했다. 사무소(tenant) 조건도 없었다.
--   * task_tickets: 앱이 쓰는 컬럼(subtasks, requires_approval 등)과 상태값(REVIEW_REQUESTED),
--     대상 유형(general, sales_lead)이 스키마에 없어 저장이 실패했다.
--   * staff_members: 저장소에 테이블·RLS 정의가 없다. 역할·상태를 클라이언트가 upsert로 정했다.
--   * 초대 수락: 토큰 소비 후 직원 기록(역할 포함)을 클라이언트가 만들었다.
--   * user_sessions(019): 대표가 직원 세션을 종료해도 RLS가 0행 갱신으로 막았다.
--
-- 사무소(tenant) 판정
--   tenant_id = 대표 변호사 lawyer_id 또는 lawyers.law_firm_id (앱: activeStaffMember.invitedBy || lawFirmId || lawyer.id)
--   * 대표: 승인된 변호사 본인 ID 또는 본인 law_firm_id
--   * 직원: staff_members.linked_user_id = 본인 lawyer_id AND status = 'active' 인 행의 invited_by
--
-- 선행: 005, 006, 008, 012(is_platform_admin, current_approved_lawyer_id), 018(current_lawyer_profile_id, invite RPC), 019
-- ⚠️ 운영 적용 전 스테이징에서 먼저 확인할 것. staff_members의 기존 정책은 모두 지우고 다시 만든다.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. staff_members 보강 (테이블은 이미 운영 DB에 있다고 가정 — 002가 컬럼을 추가함)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS supervising_lawyer_id TEXT;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS invited_by TEXT;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_staff_invited_by ON staff_members (invited_by);

-- 초대 링크로 들어온 기존 직원의 초대자 채우기
UPDATE staff_members s
   SET invited_by = it.created_by
  FROM invite_tokens it
 WHERE it.used_by = s.id AND s.invited_by IS NULL AND it.created_by IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 1. 사무소 판정 헬퍼
-- ─────────────────────────────────────────────────────────────
-- 내가 속한 사무소 ID 목록
CREATE OR REPLACE FUNCTION public.current_tenant_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT t) FILTER (WHERE t IS NOT NULL AND length(t) > 0), '{}')
  FROM (
    SELECT public.current_approved_lawyer_id() AS t
    UNION ALL
    SELECT nullif(l.law_firm_id, '') FROM lawyers l WHERE l.id = public.current_approved_lawyer_id()
    UNION ALL
    SELECT s.invited_by FROM staff_members s
     WHERE s.linked_user_id = public.current_lawyer_profile_id()
       AND s.status = 'active'
  ) x;
$$;

-- 앱에서 나를 가리키는 ID 목록 (변호사 ID + 직원 ID)
CREATE OR REPLACE FUNCTION public.current_actor_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT t) FILTER (WHERE t IS NOT NULL AND length(t) > 0), '{}')
  FROM (
    SELECT public.current_lawyer_profile_id() AS t
    UNION ALL
    SELECT s.id FROM staff_members s WHERE s.linked_user_id = public.current_lawyer_profile_id()
  ) x;
$$;

-- 해당 사무소에서의 내 역할 (없으면 NULL)
CREATE OR REPLACE FUNCTION public.tenant_role(p_tenant text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_tenant IS NULL THEN NULL
    WHEN p_tenant = public.current_approved_lawyer_id() THEN 'OWNER'
    WHEN EXISTS (SELECT 1 FROM lawyers l WHERE l.id = public.current_approved_lawyer_id() AND nullif(l.law_firm_id, '') = p_tenant) THEN 'OWNER'
    ELSE (
      SELECT s.role FROM staff_members s
       WHERE s.linked_user_id = public.current_lawyer_profile_id()
         AND s.invited_by = p_tenant AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT p_tenant IS NOT NULL AND p_tenant = ANY(public.current_tenant_ids()); $$;

REVOKE ALL ON FUNCTION public.current_tenant_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_actor_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_actor_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. staff_members RLS — 대표는 자기가 초대한 직원만, 직원은 자기 기록만 조회
-- ─────────────────────────────────────────────────────────────
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON staff_members', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "staff_select_owner_self_admin" ON staff_members
FOR SELECT TO authenticated
USING (
  invited_by = public.current_approved_lawyer_id()
  OR linked_user_id = public.current_lawyer_profile_id()
  OR public.is_platform_admin()
);

-- 대표가 직접 추가하는 경우만 (초대 수락은 accept_staff_invite RPC가 처리). OWNER 역할은 부여 불가.
CREATE POLICY "staff_insert_owner" ON staff_members
FOR INSERT TO authenticated
WITH CHECK (
  (invited_by = public.current_approved_lawyer_id() AND role <> 'OWNER')
  OR public.is_platform_admin()
);

-- 승인·정지·탈퇴·역할·권한 변경은 초대한 대표만. 직원 본인은 자기 기록을 바꿀 수 없다.
CREATE POLICY "staff_update_owner" ON staff_members
FOR UPDATE TO authenticated
USING (invited_by = public.current_approved_lawyer_id() OR public.is_platform_admin())
WITH CHECK ((invited_by = public.current_approved_lawyer_id() AND role <> 'OWNER') OR public.is_platform_admin());

CREATE POLICY "staff_delete_owner" ON staff_members
FOR DELETE TO authenticated
USING (invited_by = public.current_approved_lawyer_id() OR public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. 초대 수락 RPC — 토큰 검증·소비 + 승인 대기 직원 기록 생성을 한 번에
--    역할·초대자는 토큰 값으로 정해지며 클라이언트가 바꿀 수 없다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_staff_invite(
  p_token text, p_staff_id text, p_linked_user_id text,
  p_name text, p_email text, p_avatar text, p_provider text
)
RETURNS TABLE (role text, invited_by text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid();
  v_email text;
  v_me text := public.current_lawyer_profile_id();
  v_row invite_tokens%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_me IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_linked_user_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'linked user mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_staff_id IS NULL OR p_staff_id <> ('staff-' || v_me) THEN
    RAISE EXCEPTION 'invalid staff id' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_row FROM invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite token' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(v_row.is_used, false) THEN RAISE EXCEPTION 'invite token already used' USING ERRCODE = '42501'; END IF;
  IF v_row.expires_at < NOW() THEN RAISE EXCEPTION 'invite token expired' USING ERRCODE = '42501'; END IF;
  IF v_row.email IS NOT NULL AND length(trim(v_row.email)) > 0 AND lower(trim(v_row.email)) <> v_email THEN
    RAISE EXCEPTION 'invite token is restricted to another email' USING ERRCODE = '42501';
  END IF;
  IF v_row.role = 'OWNER' THEN RAISE EXCEPTION 'invalid invite role' USING ERRCODE = '42501'; END IF;
  IF v_row.created_by = v_me THEN RAISE EXCEPTION 'cannot accept own invite' USING ERRCODE = '42501'; END IF;

  UPDATE invite_tokens SET is_used = true, used_by = p_staff_id, used_at = NOW() WHERE id = v_row.id;

  -- 이미 기록이 있으면(재초대) 승인 대기로 되돌리고 새 역할·초대자로 갱신
  INSERT INTO staff_members (id, name, role, email, avatar, is_active, assigned_count, permissions, status,
                             invited_by, auth_email, auth_provider, supabase_user_id, linked_user_id, created_at, updated_at)
  VALUES (p_staff_id, left(coalesce(nullif(trim(p_name), ''), '직원'), 50), v_row.role, p_email, p_avatar, false, 0, '{}'::jsonb, 'pending',
          v_row.created_by, v_email, p_provider, v_uid, v_me, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
     SET role = EXCLUDED.role, status = 'pending', is_active = false, permissions = '{}'::jsonb,
         invited_by = EXCLUDED.invited_by, removed_at = NULL, removal_reason = NULL, updated_at = NOW();

  RETURN QUERY SELECT v_row.role, v_row.created_by;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_staff_invite(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text, text, text, text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. user_sessions — 대표가 자기 직원의 세션을 종료할 수 있게 (019 보완)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_sessions_owner_revoke_staff" ON user_sessions;
CREATE POLICY "user_sessions_owner_revoke_staff" ON user_sessions
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM staff_members s
   WHERE s.linked_user_id = user_sessions.user_id
     AND s.invited_by = public.current_approved_lawyer_id()
))
WITH CHECK (status IN ('revoked', 'expired'));

-- ─────────────────────────────────────────────────────────────
-- 5. task_tickets 스키마 보강 + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS case_stage TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS task_domain TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS lead_id TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS lead_phone TEXT;
ALTER TABLE task_tickets ADD COLUMN IF NOT EXISTS lead_debt NUMERIC;

ALTER TABLE task_tickets DROP CONSTRAINT IF EXISTS task_tickets_target_type_check;
ALTER TABLE task_tickets ADD CONSTRAINT task_tickets_target_type_check
  CHECK (target_type IN ('consult_request', 'case', 'copilot_review', 'general', 'sales_lead'));
ALTER TABLE task_tickets DROP CONSTRAINT IF EXISTS task_tickets_status_check;
ALTER TABLE task_tickets ADD CONSTRAINT task_tickets_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'REVIEW_REQUESTED', 'COMPLETED', 'CANCELLED'));

ALTER TABLE task_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_task_tickets" ON task_tickets;
DROP POLICY IF EXISTS "tickets_tenant_isolation" ON task_tickets;
DROP POLICY IF EXISTS "task_tickets_tenant_select" ON task_tickets;
DROP POLICY IF EXISTS "task_tickets_tenant_insert" ON task_tickets;
DROP POLICY IF EXISTS "task_tickets_tenant_update" ON task_tickets;
DROP POLICY IF EXISTS "task_tickets_tenant_delete" ON task_tickets;

CREATE POLICY "task_tickets_tenant_select" ON task_tickets
FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id) OR public.is_platform_admin());

CREATE POLICY "task_tickets_tenant_insert" ON task_tickets
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id) AND assigner_id = ANY(public.current_actor_ids()));

-- 상태 변경: 담당자·지시자·대표/변호사. 담당자 본인이 COMPLETED로 바꾸는 승인 우회는
-- 앱(checkTaskTransition)에서 막고, 서버에서는 아래 트리거가 막는다.
CREATE POLICY "task_tickets_tenant_update" ON task_tickets
FOR UPDATE TO authenticated
USING (
  public.is_tenant_member(tenant_id) AND (
    assignee_id = ANY(public.current_actor_ids())
    OR assigner_id = ANY(public.current_actor_ids())
    OR public.tenant_role(tenant_id) IN ('OWNER', 'LAWYER')
  )
)
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "task_tickets_tenant_delete" ON task_tickets
FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id) AND (assigner_id = ANY(public.current_actor_ids()) OR public.tenant_role(tenant_id) = 'OWNER'));

-- 검토 승인 우회 방지: 승인 필요 업무는 REVIEW_REQUESTED → COMPLETED만 허용, 담당자 본인 승인 금지
CREATE OR REPLACE FUNCTION public.task_tickets_guard_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin() THEN RETURN NEW; END IF;
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' AND coalesce(OLD.requires_approval, false) THEN
    IF OLD.status <> 'REVIEW_REQUESTED' THEN
      RAISE EXCEPTION 'approval required before completion' USING ERRCODE = '42501';
    END IF;
    IF OLD.assignee_id = ANY(public.current_actor_ids()) THEN
      RAISE EXCEPTION 'assignee cannot approve own task' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- 승인 필요 여부는 만든 뒤 담당자가 끌 수 없다
  IF coalesce(OLD.requires_approval, false) AND NOT coalesce(NEW.requires_approval, false)
     AND OLD.assignee_id = ANY(public.current_actor_ids()) THEN
    RAISE EXCEPTION 'assignee cannot remove approval requirement' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_tickets_guard_approval ON task_tickets;
CREATE TRIGGER trg_task_tickets_guard_approval
BEFORE UPDATE ON task_tickets
FOR EACH ROW EXECUTE FUNCTION public.task_tickets_guard_approval();

-- ─────────────────────────────────────────────────────────────
-- 6. calendar_events — 사무소 격리 + 공개 범위
-- ─────────────────────────────────────────────────────────────
-- 기존 행: data JSON의 공개 범위를 컬럼으로 옮김 (이전에는 컬럼이 항상 기본값 'firm')
UPDATE calendar_events
   SET visibility = data->>'visibility'
 WHERE data ? 'visibility' AND data->>'visibility' IN ('firm', 'lawyers', 'personal')
   AND visibility IS DISTINCT FROM data->>'visibility';
ALTER TABLE calendar_events ALTER COLUMN visibility SET DEFAULT 'personal';

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "allow_anon_all_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "anti_bola_select_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "anti_bola_modify_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "calendar_tenant_select" ON calendar_events;
DROP POLICY IF EXISTS "calendar_tenant_insert" ON calendar_events;
DROP POLICY IF EXISTS "calendar_tenant_update" ON calendar_events;
DROP POLICY IF EXISTS "calendar_tenant_delete" ON calendar_events;

CREATE POLICY "calendar_tenant_select" ON calendar_events
FOR SELECT TO authenticated
USING (
  public.is_platform_admin()
  OR (
    public.is_tenant_member(tenant_id) AND (
      assigned_staff_id = ANY(public.current_actor_ids())
      OR visibility = 'firm'
      OR (visibility = 'lawyers' AND public.tenant_role(tenant_id) IN ('OWNER', 'LAWYER'))
    )
  )
);

CREATE POLICY "calendar_tenant_insert" ON calendar_events
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id) AND assigned_staff_id = ANY(public.current_actor_ids()));

CREATE POLICY "calendar_tenant_update" ON calendar_events
FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id) AND (assigned_staff_id = ANY(public.current_actor_ids()) OR public.tenant_role(tenant_id) = 'OWNER'))
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "calendar_tenant_delete" ON calendar_events
FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id) AND (assigned_staff_id = ANY(public.current_actor_ids()) OR public.tenant_role(tenant_id) = 'OWNER'));

-- ─────────────────────────────────────────────────────────────
-- 7. internal_messages — 사무소 격리 + 변호사 전용/지정 공개
-- ─────────────────────────────────────────────────────────────
ALTER TABLE internal_messages DROP CONSTRAINT IF EXISTS internal_messages_target_type_check;
ALTER TABLE internal_messages ADD CONSTRAINT internal_messages_target_type_check
  CHECK (target_type IN ('consult_request', 'case', 'copilot_review', 'general', 'sales_lead'));

ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_internal_messages" ON internal_messages;
DROP POLICY IF EXISTS "messages_tenant_isolation" ON internal_messages;
DROP POLICY IF EXISTS "anti_bola_select_internal_messages" ON internal_messages;
DROP POLICY IF EXISTS "anti_bola_modify_internal_messages" ON internal_messages;
DROP POLICY IF EXISTS "messages_tenant_select" ON internal_messages;
DROP POLICY IF EXISTS "messages_tenant_insert" ON internal_messages;
DROP POLICY IF EXISTS "messages_tenant_update" ON internal_messages;
DROP POLICY IF EXISTS "messages_author_delete" ON internal_messages;

CREATE POLICY "messages_tenant_select" ON internal_messages
FOR SELECT TO authenticated
USING (
  public.is_platform_admin()
  OR (
    public.is_tenant_member(tenant_id) AND (
      author_id = ANY(public.current_actor_ids())
      OR visibility = 'all_staff'
      OR (visibility = 'lawyers_only' AND public.tenant_role(tenant_id) IN ('OWNER', 'LAWYER'))
      OR (visibility = 'designated' AND designated_user_ids && public.current_actor_ids())
    )
  )
);

CREATE POLICY "messages_tenant_insert" ON internal_messages
FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_member(tenant_id)
  AND author_id = ANY(public.current_actor_ids())
  AND (visibility <> 'lawyers_only' OR public.tenant_role(tenant_id) IN ('OWNER', 'LAWYER') OR parent_id IS NOT NULL)
);

-- 고정(is_pinned)·본문 수정: 같은 사무소에서 볼 수 있는 사람. 본문 수정은 앱에서 작성자로 제한.
CREATE POLICY "messages_tenant_update" ON internal_messages
FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "messages_author_delete" ON internal_messages
FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id) AND author_id = ANY(public.current_actor_ids()));

-- ─────────────────────────────────────────────────────────────
-- 8. in_app_notifications — 받는 사람만 조회·읽음 처리
-- ─────────────────────────────────────────────────────────────
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_in_app_notifications" ON in_app_notifications;
DROP POLICY IF EXISTS "notifications_user_isolation" ON in_app_notifications;
DROP POLICY IF EXISTS "notifications_recipient_select" ON in_app_notifications;
DROP POLICY IF EXISTS "notifications_tenant_insert" ON in_app_notifications;
DROP POLICY IF EXISTS "notifications_recipient_update" ON in_app_notifications;
DROP POLICY IF EXISTS "notifications_recipient_delete" ON in_app_notifications;

CREATE POLICY "notifications_recipient_select" ON in_app_notifications
FOR SELECT TO authenticated
USING (recipient_id = ANY(public.current_actor_ids()) OR public.is_platform_admin());

CREATE POLICY "notifications_tenant_insert" ON in_app_notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "notifications_recipient_update" ON in_app_notifications
FOR UPDATE TO authenticated
USING (recipient_id = ANY(public.current_actor_ids()))
WITH CHECK (recipient_id = ANY(public.current_actor_ids()));

CREATE POLICY "notifications_recipient_delete" ON in_app_notifications
FOR DELETE TO authenticated
USING (recipient_id = ANY(public.current_actor_ids()));

COMMIT;

-- ============================================================================
-- 적용 후 확인
--   * 대표 A가 만든 '나만 보기' 일정을 같은 사무소 직원 B가 조회 → 0행
--   * 다른 사무소 변호사 C가 A 사무소 tenant_id로 task_tickets/internal_messages 조회 → 0행
--   * 직원이 승인 필요 업무를 PENDING → COMPLETED로 update → 오류 'approval required before completion'
--   * 정지(status='suspended') 직원: current_tenant_ids()에 대표 tenant가 빠짐 → 사무소 데이터 조회 0행
-- 롤백: 새 정책·함수·트리거 DROP 후 006/008 정책 재생성 (보안상 권장하지 않음)
-- ============================================================================
