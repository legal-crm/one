-- ============================================================================
-- 023. 관리자 상담 관제 RPC + members RLS 잠금 (PART 3-3)
-- ----------------------------------------------------------------------------
-- 1) 관리자 스팸 숨김: 이전에는 의뢰인이 쓴 제목·본문을 "[노출 차단] …" 문구로 덮어써서
--    서버 원본이 사라졌다. 해제 기능도 없었다.
--    → admin_hidden 플래그 + 이전 상태 보존, 원문 유지, 해제 가능
-- 2) 관리자 상태 변경: 이전에는 관리자 화면이 바뀐 행 '전체'를 upsert했다.
--    그래서 관리자가 불러온 뒤 의뢰인·변호사가 바꾼 내용(제안서 등)을 덮어쓸 수 있었다.
--    → 상태 컬럼만 바꾸는 RPC (클라이언트의 관리자 전체 upsert는 제거)
-- 3) 장기 미응답 재공개: 지정 변호사가 응답하지 않은 요청을 오픈 매칭으로 전환
--    (특정 변호사에게 임의 배정하지 않음 — 의뢰인 자율 선택 원칙)
-- 4) 모든 관리자 조치는 audit_logs에 서버가 기록
-- 5) members: 006의 authenticated 전체 ALL(USING true)을 제거.
--    이전에는 로그인한 누구나 전 회원의 이메일·전화번호를 조회·수정·삭제할 수 있었다.
--    또 role='ADMIN' 행을 스스로 만들어, members를 참조하는 옛 정책의 관리자 판정을 통과할 수 있었다.
--
-- 선행: 012, 018, 021
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────────────────────────
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS admin_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS admin_hidden_reason TEXT;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS admin_hidden_at TIMESTAMPTZ;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS admin_prev_status TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. 관리자 전용 컬럼 보호 (의뢰인·변호사가 직접 바꾸지 못하게)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consult_requests_protect_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hidden := false;
    NEW.admin_hidden_reason := NULL;
    NEW.admin_hidden_at := NULL;
    NEW.admin_prev_status := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hidden := OLD.admin_hidden;
  NEW.admin_hidden_reason := OLD.admin_hidden_reason;
  NEW.admin_hidden_at := OLD.admin_hidden_at;
  NEW.admin_prev_status := OLD.admin_prev_status;
  -- 숨김 처리된 요청은 의뢰인이 상태를 되돌려 다시 노출시킬 수 없음
  IF OLD.admin_hidden THEN
    NEW.status := OLD.status;
    NEW.request_type := OLD.request_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consult_requests_protect_admin_fields ON consult_requests;
CREATE TRIGGER trg_consult_requests_protect_admin_fields
  BEFORE INSERT OR UPDATE ON consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.consult_requests_protect_admin_fields();

-- ─────────────────────────────────────────────────────────────
-- 3. 관리자 감사 기록 헬퍼
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, detail, auth_uid, auth_email, ip_address)
  VALUES (
    coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'admin'),
    'admin',
    left(p_action, 64),
    left(p_target_type, 64),
    left(p_target_id, 200),
    coalesce(p_detail, '{}'::jsonb),
    auth.uid(),
    auth.jwt() ->> 'email',
    public.request_client_ip()
  );
$$;
REVOKE ALL ON FUNCTION public.admin_audit(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. 관리자 RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_hidden THEN
    UPDATE consult_requests
       SET admin_prev_status = CASE WHEN admin_hidden THEN admin_prev_status ELSE status END,
           admin_hidden = true,
           admin_hidden_reason = left(coalesce(p_reason, ''), 300),
           admin_hidden_at = now(),
           status = 'closed',
           updated_at = now()
     WHERE id::text = p_id
     RETURNING status INTO v_status;
  ELSE
    UPDATE consult_requests
       SET status = CASE WHEN admin_hidden THEN coalesce(admin_prev_status, status) ELSE status END,
           admin_hidden = false,
           admin_prev_status = NULL,
           admin_hidden_reason = NULL,
           admin_hidden_at = NULL,
           updated_at = now()
     WHERE id::text = p_id
     RETURNING status INTO v_status;
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.admin_audit(
    CASE WHEN p_hidden THEN 'admin_consult_hide' ELSE 'admin_consult_unhide' END,
    'consult_request', p_id,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 300), 'status', v_status)
  );
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_consult_status(p_id text, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('requested', 'responding', 'comparing', 'counseling', 'closed', 'cancelled',
                      'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_prev FROM consult_requests WHERE id::text = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE consult_requests SET status = p_status, updated_at = now() WHERE id::text = p_id;
  PERFORM public.admin_audit('admin_consult_status', 'consult_request', p_id,
    jsonb_build_object('from', v_prev, 'to', p_status));
  RETURN p_status;
END;
$$;

-- 장기 미응답 요청을 오픈 매칭으로 재공개 (지정 변호사 목록은 이력으로 남김)
CREATE OR REPLACE FUNCTION public.admin_reopen_stale_consult(p_id text, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row consult_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM consult_requests WHERE id::text = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.admin_hidden THEN
    RAISE EXCEPTION 'hidden request' USING ERRCODE = '22023';
  END IF;
  IF v_row.status NOT IN ('requested', 'responding') THEN
    RAISE EXCEPTION 'only unanswered requests can be reopened' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(coalesce(v_row.proposals, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'request already has proposals' USING ERRCODE = '22023';
  END IF;

  UPDATE consult_requests
     SET request_type = 'open', status = 'requested', updated_at = now()
   WHERE id::text = p_id;

  PERFORM public.admin_audit('admin_consult_reopen', 'consult_request', p_id,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 300),
                       'prev_request_type', v_row.request_type,
                       'prev_status', v_row.status,
                       'selected_lawyer_ids', v_row.selected_lawyer_ids));
  RETURN 'requested';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_consult_hidden(text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_consult_status(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reopen_stale_consult(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_consult_hidden(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_consult_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_stale_consult(text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. 변호사 뷰: 관리자 숨김 요청 제외 (012 정의 + 조건 1개)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW consult_requests_for_lawyers
WITH (security_barrier = true)
AS
SELECT
  cr.id,
  cr.client_id,
  CASE
    WHEN public.lawyer_can_see_contact(cr, me.lid) THEN cr.client_name
    WHEN position('_' IN cr.client_name) > 0 THEN split_part(cr.client_name, '_', 2)
    ELSE cr.client_name
  END AS client_name,
  CASE
    WHEN public.lawyer_can_see_contact(cr, me.lid) THEN cr.phone
    WHEN coalesce(cr.phone, '') = '' THEN ''
    ELSE '010-****-****'
  END AS phone,
  public.lawyer_can_see_contact(cr, me.lid) AS contact_visible,
  cr.request_type,
  cr.max_participants,
  cr.status,
  cr.selected_lawyer_id,
  cr.selected_lawyer_ids,
  cr.accepted_lawyer_ids,
  cr.rejection_notified,
  cr.proposals,
  cr.title,
  cr.content,
  cr.financial_profile,
  cr.phone_consultation_requested,
  cr.safe_number,
  cr.safe_number_assigned_at,
  cr.safe_number_expires_at,
  cr.entry_category,
  cr.created_by_lawyer_id,
  cr.created_at,
  cr.updated_at
FROM consult_requests cr
CROSS JOIN LATERAL (SELECT public.current_approved_lawyer_id() AS lid) me
WHERE public.lawyer_can_view_request(cr, me.lid)
  AND NOT cr.admin_hidden;

REVOKE ALL ON consult_requests_for_lawyers FROM PUBLIC, anon;
GRANT SELECT ON consult_requests_for_lawyers TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. members RLS
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "authenticated_all_members" ON members;
    DROP POLICY IF EXISTS "allow_anon_all_members" ON members;
    DROP POLICY IF EXISTS "members_self_select" ON members;
    DROP POLICY IF EXISTS "members_admin_all" ON members;
    ALTER TABLE members ENABLE ROW LEVEL SECURITY;
    -- 본인 행 조회만 허용 (쓰기는 관리자만 — role 자기 지정 차단)
    CREATE POLICY "members_self_select" ON members
      FOR SELECT TO authenticated
      USING (id = auth.uid()::text);
    CREATE POLICY "members_admin_all" ON members
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

COMMIT;

-- 확인
--   일반 로그인 사용자: SELECT count(*) FROM members; → 본인 행만, INSERT → RLS 오류
--   관리자(aal2): SELECT public.admin_set_consult_hidden('<id>', true, '광고글'); → 'closed', 변호사 뷰에서 사라짐
--   의뢰인이 숨김 요청을 UPDATE status='requested' → 트리거가 'closed' 유지
-- 주의: members를 EXISTS로 참조하던 007~011의 옛 정책은 이제 관리자가 넣은 행만 통과한다.
--       (자기 자신을 ADMIN/LAWYER로 등록해 권한을 얻던 경로 차단)
-- 롤백: 트리거·RPC DROP, 012 뷰 재생성, 006 members 정책 재생성
