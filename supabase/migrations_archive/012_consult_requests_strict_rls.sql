-- ============================================================================
-- 012. consult_requests 엄격 RLS + 변호사 마스킹 뷰 + 변호사 전용 RPC
-- ----------------------------------------------------------------------------
-- 목표
--   1) 일반 사용자(의뢰인)는 본인 요청(auth.uid() = client_id)만 조회·수정·삭제
--   2) 변호사는 "관리자 승인된 계정"만, 전자계약 체결 전에는 연락처·실명이 마스킹된 뷰로만 조회
--   3) 변호사 쓰기는 SECURITY DEFINER RPC의 화이트리스트 필드로만 허용
--   4) 관리자 판정은 JWT app_metadata.role = 'admin'만 신뢰
--      (members 테이블은 006에서 authenticated 전체 쓰기가 허용되어 있어 role 위조 가능)
--
-- 007_anti_bola_hardening.sql의 consult_requests 정책과 011의 consult_messages 정책을 대체합니다.
-- 적용 전 반드시 스테이징에서 검증하세요. (롤백: 012_rollback 섹션 참고)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. 누락 컬럼 보정
-- ─────────────────────────────────────────────────────────────
-- requestToRow가 쓰지만 어떤 마이그레이션에도 없던 컬럼
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS rejection_notified BOOLEAN DEFAULT false;
-- 변호사가 직접 등록한 외부 의뢰인 요청 (본인이 입력한 연락처는 마스킹하지 않음)
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS created_by_lawyer_id TEXT;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS selected_lawyer_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS accepted_lawyer_ids JSONB DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 1. 공통 헬퍼
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- 변호사 계정 ↔ Supabase Auth 사용자 매핑 (승인 여부는 관리자만 변경)
CREATE TABLE IF NOT EXISTS lawyer_accounts (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id    TEXT NOT NULL UNIQUE,
  auth_email   TEXT,
  approved     BOOLEAN NOT NULL DEFAULT false,
  approved_at  TIMESTAMPTZ,
  approved_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lawyer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyer_accounts_select_self_or_admin" ON lawyer_accounts;
CREATE POLICY "lawyer_accounts_select_self_or_admin" ON lawyer_accounts
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR public.is_platform_admin());
-- INSERT/UPDATE/DELETE 정책 없음 → RPC(SECURITY DEFINER)로만 변경 가능

-- 현재 로그인 사용자가 "승인된 변호사"이면 lawyer_id 반환, 아니면 NULL
CREATE OR REPLACE FUNCTION public.current_approved_lawyer_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT la.lawyer_id
  FROM lawyer_accounts la
  WHERE la.auth_user_id = auth.uid() AND la.approved = true
  LIMIT 1;
$$;

-- 변호사 본인이 OAuth 로그인 직후 매핑 등록 (항상 미승인 상태로 생성)
CREATE OR REPLACE FUNCTION public.register_lawyer_account(p_lawyer_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing lawyer_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_lawyer_id IS NULL OR length(trim(p_lawyer_id)) = 0 THEN
    RAISE EXCEPTION 'lawyer_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM lawyer_accounts WHERE auth_user_id = v_uid;
  IF FOUND THEN
    IF v_existing.lawyer_id <> p_lawyer_id THEN
      RAISE EXCEPTION 'this account is already linked to another lawyer profile' USING ERRCODE = '42501';
    END IF;
    RETURN v_existing.approved;
  END IF;

  -- 다른 인증 계정이 이미 점유한 lawyer_id는 재사용 불가 (UNIQUE 위반 → 예외)
  INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
  VALUES (v_uid, p_lawyer_id, (SELECT email FROM auth.users WHERE id = v_uid), false);
  RETURN false;
END;
$$;

-- 관리자 승인/정지
CREATE OR REPLACE FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  UPDATE lawyer_accounts
     SET approved = p_approved,
         approved_at = CASE WHEN p_approved THEN NOW() ELSE NULL END,
         approved_by = CASE WHEN p_approved THEN auth.uid() ELSE NULL END
   WHERE lawyer_id = p_lawyer_id;
  RETURN FOUND;
END;
$$;

-- 변호사가 해당 요청에 접근 가능한지 (오픈 매칭 대기 포함)
CREATE OR REPLACE FUNCTION public.lawyer_can_view_request(cr consult_requests, p_lawyer_id text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT p_lawyer_id IS NOT NULL AND (
       (cr.status = 'requested' AND cr.request_type = 'open')
    OR cr.selected_lawyer_id = p_lawyer_id
    OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR coalesce(cr.selected_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR cr.created_by_lawyer_id = p_lawyer_id
  );
$$;

-- 연락처·실명 공개 조건: 본인이 등록한 외부 의뢰인이거나, 해당 변호사와 전자계약 서명 완료
CREATE OR REPLACE FUNCTION public.lawyer_can_see_contact(cr consult_requests, p_lawyer_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_lawyer_id IS NOT NULL AND (
       cr.created_by_lawyer_id = p_lawyer_id
    OR EXISTS (
         SELECT 1 FROM electronic_contracts ec
         WHERE ec.assigned_lawyer_id = p_lawyer_id
           AND ec.status IN ('signed', 'completed')
           AND (ec.client_id = cr.id OR ec.client_id = cr.client_id)
       )
  );
$$;

-- 메시지 테이블 등에서 사용하는 요청 접근 판정 (참여 당사자만, 오픈 대기는 제외)
CREATE OR REPLACE FUNCTION public.can_access_consult_request(p_request_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM consult_requests cr
    WHERE cr.id = p_request_id
      AND (
           cr.client_id = auth.uid()::text
        OR (
             public.current_approved_lawyer_id() IS NOT NULL AND (
                  cr.selected_lawyer_id = public.current_approved_lawyer_id()
               OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? public.current_approved_lawyer_id()
               OR cr.created_by_lawyer_id = public.current_approved_lawyer_id()
             )
           )
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. consult_requests 기본 테이블 RLS (본인 + 관리자만)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE consult_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anti_bola_select_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_insert_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_update_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_delete_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "strict_select_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "strict_insert_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "strict_update_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "strict_delete_consult_requests" ON consult_requests;

CREATE POLICY "strict_select_consult_requests" ON consult_requests
FOR SELECT TO authenticated
USING (auth.uid()::text = client_id OR public.is_platform_admin());

CREATE POLICY "strict_insert_consult_requests" ON consult_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = client_id OR public.is_platform_admin());

CREATE POLICY "strict_update_consult_requests" ON consult_requests
FOR UPDATE TO authenticated
USING (auth.uid()::text = client_id OR public.is_platform_admin())
WITH CHECK (auth.uid()::text = client_id OR public.is_platform_admin());

-- 의뢰인 "상담 기록 파기" 기능이 동작하도록 본인 삭제 허용 (006 이후 DELETE 정책 부재)
CREATE POLICY "strict_delete_consult_requests" ON consult_requests
FOR DELETE TO authenticated
USING (auth.uid()::text = client_id OR public.is_platform_admin());

-- 의뢰인이 변호사 제안서를 위조하거나, 오래된 로컬 사본으로 덮어쓰지 못하도록 보호
-- (SECURITY DEFINER RPC 내부·service_role·관리자는 current_user가 authenticated/anon이 아니거나 admin)
CREATE OR REPLACE FUNCTION public.guard_consult_request_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.proposals := '[]'::jsonb;
    NEW.accepted_lawyer_ids := '[]'::jsonb;
    NEW.created_by_lawyer_id := NULL;
  ELSE
    NEW.proposals := OLD.proposals;
    NEW.accepted_lawyer_ids := OLD.accepted_lawyer_ids;
    NEW.created_by_lawyer_id := OLD.created_by_lawyer_id;
    NEW.client_id := OLD.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_consult_request_privileged ON consult_requests;
CREATE TRIGGER trg_guard_consult_request_privileged
BEFORE INSERT OR UPDATE ON consult_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_consult_request_privileged_columns();

-- ─────────────────────────────────────────────────────────────
-- 3. 변호사 전용 마스킹 뷰
-- ─────────────────────────────────────────────────────────────
-- 뷰 소유자(postgres) 권한으로 실행되어 기본 테이블 RLS를 우회하므로,
-- 행 범위와 컬럼 마스킹을 뷰 정의 자체에서 강제한다.
DROP VIEW IF EXISTS consult_requests_for_lawyers;
CREATE VIEW consult_requests_for_lawyers
WITH (security_barrier = true)
AS
SELECT
  cr.id,
  cr.client_id,
  CASE
    WHEN public.lawyer_can_see_contact(cr, me.lid) THEN cr.client_name
    WHEN position('_' IN cr.client_name) > 0 THEN split_part(cr.client_name, '_', 2)  -- "실명_가명" → 가명만
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
WHERE public.lawyer_can_view_request(cr, me.lid);

REVOKE ALL ON consult_requests_for_lawyers FROM PUBLIC, anon;
GRANT SELECT ON consult_requests_for_lawyers TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. 변호사 쓰기 RPC (화이트리스트)
-- ─────────────────────────────────────────────────────────────
-- p_patch 허용 키:
--   proposal (object, lawyerId = 본인)   : 본인 제안서 추가/갱신
--   accept_self (bool)                   : 참여 변호사 목록에 본인 추가
--   select_self (bool)                   : 담당 변호사로 본인 지정 (미지정이거나 본인일 때만)
--   status (text)                        : responding|counseling|comparing|contracted|document
--   client_name / phone (text)           : 본인 등록 외부 의뢰인 또는 계약 완료 건만
CREATE OR REPLACE FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lid  text := public.current_approved_lawyer_id();
  v_row  consult_requests%ROWTYPE;
  v_prop jsonb;
  v_status text;
BEGIN
  IF v_lid IS NULL THEN
    RAISE EXCEPTION 'approved lawyer account required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM consult_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.lawyer_can_view_request(v_row, v_lid) THEN
    RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
  END IF;

  -- 제안서 (본인 작성분만 추가/교체)
  IF p_patch ? 'proposal' THEN
    v_prop := p_patch -> 'proposal';
    IF jsonb_typeof(v_prop) <> 'object' OR (v_prop ->> 'lawyerId') IS DISTINCT FROM v_lid OR coalesce(v_prop ->> 'id', '') = '' THEN
      RAISE EXCEPTION 'proposal must belong to the calling lawyer' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_row.proposals, '[]'::jsonb)) e
      WHERE e ->> 'id' = v_prop ->> 'id' AND (e ->> 'lawyerId') IS DISTINCT FROM v_lid
    ) THEN
      RAISE EXCEPTION 'proposal id collision' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET proposals = coalesce((
             SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(proposals, '[]'::jsonb)) e
             WHERE e ->> 'id' IS DISTINCT FROM v_prop ->> 'id'
           ), '[]'::jsonb) || jsonb_build_array(v_prop)
     WHERE id = p_id;
  END IF;

  IF coalesce((p_patch ->> 'accept_self')::boolean, false) THEN
    UPDATE consult_requests
       SET accepted_lawyer_ids = CASE
             WHEN coalesce(accepted_lawyer_ids, '[]'::jsonb) ? v_lid THEN accepted_lawyer_ids
             ELSE coalesce(accepted_lawyer_ids, '[]'::jsonb) || to_jsonb(v_lid)
           END
     WHERE id = p_id;
  END IF;

  IF coalesce((p_patch ->> 'select_self')::boolean, false) THEN
    IF v_row.selected_lawyer_id IS NOT NULL AND v_row.selected_lawyer_id <> v_lid THEN
      RAISE EXCEPTION 'request already assigned to another lawyer' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests SET selected_lawyer_id = v_lid WHERE id = p_id;
  END IF;

  IF p_patch ? 'status' THEN
    v_status := p_patch ->> 'status';
    IF v_status NOT IN ('responding', 'counseling', 'comparing', 'contracted', 'document') THEN
      RAISE EXCEPTION 'status not allowed: %', v_status USING ERRCODE = '22023';
    END IF;
    UPDATE consult_requests SET status = v_status WHERE id = p_id;
  END IF;

  IF (p_patch ? 'client_name' OR p_patch ? 'phone') THEN
    IF NOT public.lawyer_can_see_contact(v_row, v_lid) THEN
      RAISE EXCEPTION 'contact fields are editable only after contract' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET client_name = coalesce(p_patch ->> 'client_name', client_name),
           phone       = coalesce(p_patch ->> 'phone', phone)
     WHERE id = p_id;
  END IF;

  UPDATE consult_requests SET updated_at = NOW() WHERE id = p_id;
END;
$$;

-- 변호사가 직접 등록하는 외부 의뢰인(전화·방문 상담, 영업 리드 전환 등)
CREATE OR REPLACE FUNCTION public.lawyer_create_consult_request(p_row jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lid text := public.current_approved_lawyer_id();
  v_id  text := p_row ->> 'id';
BEGIN
  IF v_lid IS NULL THEN
    RAISE EXCEPTION 'approved lawyer account required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_id, '') = '' THEN
    RAISE EXCEPTION 'id required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM consult_requests WHERE id = v_id) THEN
    RAISE EXCEPTION 'request id already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO consult_requests (
    id, client_id, client_name, phone, request_type, max_participants, status,
    selected_lawyer_id, selected_lawyer_ids, accepted_lawyer_ids, proposals,
    title, content, financial_profile, entry_category, created_by_lawyer_id, created_at, updated_at
  ) VALUES (
    v_id,
    coalesce(nullif(p_row ->> 'client_id', ''), v_id),
    coalesce(nullif(p_row ->> 'client_name', ''), '의뢰인'),
    coalesce(p_row ->> 'phone', ''),
    'direct',
    1,
    coalesce(nullif(p_row ->> 'status', ''), 'counseling'),
    v_lid,
    jsonb_build_array(v_lid),
    jsonb_build_array(v_lid),
    '[]'::jsonb,
    coalesce(p_row ->> 'title', ''),
    coalesce(p_row ->> 'content', ''),
    coalesce(p_row -> 'financial_profile', '{}'::jsonb),
    p_row -> 'entry_category',
    v_lid,
    coalesce((p_row ->> 'created_at')::timestamptz, NOW()),
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lawyer_patch_consult_request(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lawyer_create_consult_request(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_lawyer_account(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_lawyer_approval(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lawyer_patch_consult_request(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lawyer_create_consult_request(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_lawyer_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_lawyer_approval(text, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. consult_messages: 요청 당사자만 (변호사는 승인 계정 매핑으로 판정)
-- ─────────────────────────────────────────────────────────────
-- 기존 INSERT 정책은 sender_id = auth.uid()만 맞추면 어떤 상담방에도 메시지를 넣을 수 있었음
DROP POLICY IF EXISTS "anti_bola_select_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "anti_bola_insert_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "strict_select_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "strict_insert_consult_messages" ON consult_messages;

CREATE POLICY "strict_select_consult_messages" ON consult_messages
FOR SELECT TO authenticated
USING (public.can_access_consult_request(consult_request_id));

CREATE POLICY "strict_insert_consult_messages" ON consult_messages
FOR INSERT TO authenticated
WITH CHECK (public.can_access_consult_request(consult_request_id));

COMMIT;

-- ============================================================================
-- 012_rollback (필요 시 수동 실행): 007/011 정책으로 되돌리기
-- ----------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_guard_consult_request_privileged ON consult_requests;
-- DROP VIEW IF EXISTS consult_requests_for_lawyers;
-- DROP POLICY IF EXISTS "strict_select_consult_requests" ON consult_requests;
-- DROP POLICY IF EXISTS "strict_insert_consult_requests" ON consult_requests;
-- DROP POLICY IF EXISTS "strict_update_consult_requests" ON consult_requests;
-- DROP POLICY IF EXISTS "strict_delete_consult_requests" ON consult_requests;
-- DROP POLICY IF EXISTS "strict_select_consult_messages" ON consult_messages;
-- DROP POLICY IF EXISTS "strict_insert_consult_messages" ON consult_messages;
-- 이후 007_anti_bola_hardening.sql 1장, 011 2장을 재실행
-- ============================================================================
