-- ====================================================================
-- MYKIMLAW (마이김변) MASTER MIGRATION BUNDLE: 012 TO 026
-- Generated: 2026-09-29T04:03:59.741Z
-- Execute this in Supabase Dashboard -> SQL Editor -> New Query
-- ====================================================================



-- ====================================================================
-- START OF MIGRATION: 012_consult_requests_strict_rls.sql
-- ====================================================================

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


-- END OF MIGRATION: 012_consult_requests_strict_rls.sql


-- ====================================================================
-- START OF MIGRATION: 013_shared_reports_pin_attempt_limit.sql
-- ====================================================================

-- ============================================================================
-- 013. 진단 보고서 보안 공유: 서버 보관 + PIN 시도 횟수 제한
-- ----------------------------------------------------------------------------
-- 기존 방식: 암호문 전체를 공유 링크에 담음 → 링크만 있으면 6자리 PIN(100만 조합)을
--           오프라인에서 무제한 대입해 해독 가능.
-- 변경 방식: 암호문은 서버에만 보관하고 링크에는 무작위 ID만 포함.
--           PIN 검증은 서버 RPC에서 수행하며, 5회 실패 시 해당 링크를 영구 잠금.
--           (본문은 여전히 브라우저에서 PIN 기반 AES-256-GCM으로 암·복호화)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS shared_reports (
  id               TEXT PRIMARY KEY,                    -- 128bit 무작위 ID (base64url)
  ciphertext       TEXT NOT NULL,                       -- 클라이언트 AES-256-GCM 암호문
  pin_hash         TEXT NOT NULL,                       -- bcrypt(PIN)
  created_by       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 5,
  locked_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  last_opened_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_reports_expires ON shared_reports (expires_at);

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
-- 정책 없음: 테이블 직접 접근 전면 차단, 아래 SECURITY DEFINER RPC로만 접근

-- 공유 링크 생성 (로그인 사용자만)
CREATE OR REPLACE FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer DEFAULT 168)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN must be 6 digits' USING ERRCODE = '22023';
  END IF;
  IF p_ciphertext IS NULL OR length(p_ciphertext) = 0 OR length(p_ciphertext) > 200000 THEN
    RAISE EXCEPTION 'invalid ciphertext' USING ERRCODE = '22023';
  END IF;

  -- 사용자당 24시간 내 생성 한도 (남용 방지)
  IF (SELECT count(*) FROM shared_reports WHERE created_by = auth.uid() AND created_at > NOW() - INTERVAL '24 hours') >= 20 THEN
    RAISE EXCEPTION 'too many share links today' USING ERRCODE = '54000';
  END IF;

  v_id := translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_');

  INSERT INTO shared_reports (id, ciphertext, pin_hash, created_by, expires_at)
  VALUES (
    v_id,
    p_ciphertext,
    crypt(p_pin, gen_salt('bf', 10)),
    auth.uid(),
    NOW() + make_interval(hours => LEAST(GREATEST(coalesce(p_ttl_hours, 168), 1), 720))
  );

  -- 만료 데이터 정리
  DELETE FROM shared_reports WHERE expires_at < NOW() - INTERVAL '1 day';

  RETURN v_id;
END;
$$;

-- 공유 링크 열기 (비로그인 수신자도 가능) — 실패 횟수는 예외 없이 커밋되도록 jsonb 반환
CREATE OR REPLACE FUNCTION public.open_shared_report(p_id text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row shared_reports%ROWTYPE;
  v_remaining integer;
BEGIN
  SELECT * INTO v_row FROM shared_reports WHERE id = p_id FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.locked_at IS NOT NULL OR v_row.failed_attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'remaining', 0);
  END IF;

  IF p_pin ~ '^[0-9]{6}$' AND crypt(p_pin, v_row.pin_hash) = v_row.pin_hash THEN
    UPDATE shared_reports SET failed_attempts = 0, last_opened_at = NOW() WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'ciphertext', v_row.ciphertext);
  END IF;

  v_remaining := v_row.max_attempts - (v_row.failed_attempts + 1);
  UPDATE shared_reports
     SET failed_attempts = failed_attempts + 1,
         locked_at = CASE WHEN v_remaining <= 0 THEN NOW() ELSE NULL END
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', false,
    'reason', CASE WHEN v_remaining <= 0 THEN 'locked' ELSE 'wrong_pin' END,
    'remaining', GREATEST(v_remaining, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_shared_report(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shared_report(text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.open_shared_report(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_shared_report(text, text) TO anon, authenticated;

COMMIT;


-- END OF MIGRATION: 013_shared_reports_pin_attempt_limit.sql


-- ====================================================================
-- START OF MIGRATION: 014_client_alias_uniqueness.sql
-- ====================================================================

-- ============================================================================
-- 014. 스텔스 가명 중복 방지
-- ----------------------------------------------------------------------------
-- 가명 조합 공간(약 32만)은 약 670명부터 중복 확률이 50%에 이르고, 앱은 가명으로
-- 본인 상담 요청을 매칭하는 로직이 있어 중복 시 타인 내역이 노출될 수 있다.
-- → 가명 소유 테이블(UNIQUE) + 선점 RPC로 서버에서 유일성을 보장한다.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS client_aliases (
  alias         TEXT PRIMARY KEY,
  auth_user_id  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 공백·대소문자 차이로 인한 사실상 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_aliases_normalized
  ON client_aliases (lower(regexp_replace(alias, '\s+', '', 'g')));

ALTER TABLE client_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_aliases_select_self" ON client_aliases;
CREATE POLICY "client_aliases_select_self" ON client_aliases
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());
-- 쓰기 정책 없음 → claim_client_alias RPC로만 변경

-- 가명 선점/변경: 성공 시 true, 이미 다른 사용자가 사용 중이면 false
CREATE OR REPLACE FUNCTION public.claim_client_alias(p_alias text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alias text := btrim(regexp_replace(coalesce(p_alias, ''), '\s+', ' ', 'g'));
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_alias) < 2 OR char_length(v_alias) > 20 THEN
    RAISE EXCEPTION 'alias length must be 2-20' USING ERRCODE = '22023';
  END IF;
  -- 실명 분리 규칙(clientName.split('_'))과 충돌하는 밑줄 금지
  IF position('_' IN v_alias) > 0 THEN
    RAISE EXCEPTION 'underscore is not allowed in alias' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_id INTO v_owner
  FROM client_aliases
  WHERE lower(regexp_replace(alias, '\s+', '', 'g')) = lower(regexp_replace(v_alias, '\s+', '', 'g'));

  IF FOUND THEN
    RETURN v_owner = v_uid;   -- 본인 가명이면 true, 타인 가명이면 false
  END IF;

  BEGIN
    INSERT INTO client_aliases (alias, auth_user_id) VALUES (v_alias, v_uid)
    ON CONFLICT (auth_user_id) DO UPDATE SET alias = EXCLUDED.alias, updated_at = NOW();
  EXCEPTION WHEN unique_violation THEN
    RETURN false;             -- 동시 선점 경쟁에서 패배
  END;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_alias(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_client_alias(text) TO authenticated;

COMMIT;


-- END OF MIGRATION: 014_client_alias_uniqueness.sql


-- ====================================================================
-- START OF MIGRATION: 015_contract_proposal_linkage.sql
-- ====================================================================

-- ============================================================
-- 015: 제안서 → 전자계약 연동 컬럼
-- ------------------------------------------------------------
-- 의뢰인이 제안서에서 직접 시작한 계약(스텔스 가명 상태)을
-- 원격 서명 화면에서 본인인증 실명으로 전환하기 위한 플래그와
-- 근거 상담요청/제안서 ID를 서버에 보존한다.
-- (앱은 컬럼이 없을 때 확장 컬럼을 제외하고 재시도하므로 적용 순서에 제약 없음)
-- ============================================================

ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS client_ref_id TEXT;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS real_name_conversion_pending BOOLEAN;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS consult_request_id TEXT;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS source_proposal_id TEXT;

-- 같은 제안서로 서명 대기 계약이 중복 생성되는 것을 방지 (서명 대기/작성 중 상태만)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_open_per_proposal
  ON electronic_contracts (source_proposal_id)
  WHERE source_proposal_id IS NOT NULL
    AND status IN ('drafting', 'pending_sign', 'client_review');

CREATE INDEX IF NOT EXISTS idx_contracts_consult_request
  ON electronic_contracts (consult_request_id)
  WHERE consult_request_id IS NOT NULL;


-- END OF MIGRATION: 015_contract_proposal_linkage.sql


-- ====================================================================
-- START OF MIGRATION: 016_crm_clients_extension_data.sql
-- ====================================================================

-- ============================================================
-- 016: crm_clients 확장 데이터(jsonb) 컬럼
-- ------------------------------------------------------------
-- 의뢰인이 마이페이지에서 작성한 진술서(D5104)·재산목록(D5102)·수입지출(D5103)·
-- 통장 소명표·부채증명 발급 정보·13단계 진행상태 등은 기존 고정 컬럼에 없어
-- 서버에 저장되지 않았다(의뢰인 브라우저에만 존재 → 변호사 CRM에서 조회 불가).
-- 이 컬럼에 CrmClientExtension 전체(파일 본문 제외)를 보관한다.
-- 앱은 컬럼이 없으면 기존 컬럼만으로 재시도하므로 적용 순서 제약 없음.
-- 기존 crm_clients RLS 정책이 그대로 적용된다.
-- ============================================================

ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS extension_data JSONB;


-- END OF MIGRATION: 016_crm_clients_extension_data.sql


-- ====================================================================
-- START OF MIGRATION: 017_doc_share_packages.sql
-- ====================================================================

-- ============================================================
-- 017: 변호사·사무장 서류 공유 패키지 (진술서·수지표·재산 요약)
-- ------------------------------------------------------------
-- 기존: 공유 패키지를 보낸 사람 브라우저(localStorage)에만 저장 → 받은 변호사 휴대폰에서는 항상
--       "만료/잘못된 링크". 'lds_demo'로 시작하는 토큰은 누구에게나 가짜 의뢰인 서류를 보여줬다.
-- 변경: 서버 테이블에 보관, 받는 사람은 링크 + 수신 휴대폰 번호가 일치할 때만 열람 (5회 오입력 시 잠금, 7일 만료).
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS doc_share_packages (
  token               TEXT PRIMARY KEY,                               -- 192bit 무작위 (base64url)
  owner_user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_phone_hash TEXT NOT NULL,                                 -- sha256(숫자만 남긴 수신 번호)
  recipient_phone_last4 TEXT,
  payload             JSONB NOT NULL,                                  -- 의뢰인이 선택한 서류 데이터
  expires_at          TIMESTAMPTZ NOT NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  viewed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE doc_share_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_share_insert_own ON doc_share_packages;
DROP POLICY IF EXISTS doc_share_select_own ON doc_share_packages;
DROP POLICY IF EXISTS doc_share_delete_own ON doc_share_packages;

-- 로그인한 의뢰인만 본인 소유로 생성, 유효기간 최대 8일
CREATE POLICY doc_share_insert_own ON doc_share_packages
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid() AND expires_at <= NOW() + INTERVAL '8 days');

-- 본인이 만든 공유만 조회·삭제 (받는 사람은 아래 RPC로만 열람)
CREATE POLICY doc_share_select_own ON doc_share_packages
FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY doc_share_delete_own ON doc_share_packages
FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

-- 받는 사람 열람: 토큰 + 수신 휴대폰 번호 대조 (서버에서 검증)
CREATE OR REPLACE FUNCTION open_doc_share(p_token TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row doc_share_packages%ROWTYPE;
  v_digits TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_row FROM doc_share_packages WHERE token = p_token;
  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.failed_attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF length(v_digits) < 10 OR encode(digest(v_digits, 'sha256'), 'hex') <> v_row.recipient_phone_hash THEN
    UPDATE doc_share_packages SET failed_attempts = failed_attempts + 1 WHERE token = p_token;
    RETURN jsonb_build_object('ok', false, 'reason', 'mismatch', 'remaining', GREATEST(0, 4 - v_row.failed_attempts));
  END IF;
  UPDATE doc_share_packages SET failed_attempts = 0, viewed_at = coalesce(viewed_at, NOW()) WHERE token = p_token;
  RETURN jsonb_build_object('ok', true, 'payload', v_row.payload, 'expiresAt', v_row.expires_at);
END;
$$;

REVOKE ALL ON FUNCTION open_doc_share(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_doc_share(TEXT, TEXT) TO anon, authenticated;

-- 링크 존재 여부만 확인 (수신 번호 끝 4자리 힌트 — 개인정보 노출 최소화)
CREATE OR REPLACE FUNCTION peek_doc_share(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN d.token IS NULL OR d.expires_at < NOW() THEN jsonb_build_object('ok', false)
    ELSE jsonb_build_object('ok', true, 'phoneLast4', d.recipient_phone_last4, 'locked', d.failed_attempts >= 5)
  END
  FROM (SELECT 1) x LEFT JOIN doc_share_packages d ON d.token = p_token;
$$;

REVOKE ALL ON FUNCTION peek_doc_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION peek_doc_share(TEXT) TO anon, authenticated;

COMMIT;


-- END OF MIGRATION: 017_doc_share_packages.sql


-- ====================================================================
-- START OF MIGRATION: 018_lawyer_auth_hardening.sql
-- ====================================================================

-- ============================================================================
-- 018. 변호사 인증 하드닝
-- ----------------------------------------------------------------------------
-- 배경 (PART 2 점검)
--   1) register_lawyer_account(p_lawyer_id)는 "먼저 등록한 사람이 임자" 구조라,
--      임의의 Supabase 계정이 기존 변호사 프로필 ID(lawyer-1 등)를 선점할 수 있었다.
--   2) lawyers 테이블은 006에서 authenticated 전체 쓰기(USING true)가 허용되어
--      로그인한 누구나 다른 변호사 행(승인 상태·프로필)을 덮어쓸 수 있었다.
--      과거 클라이언트가 평문 password를 data JSONB에 저장한 흔적도 남아 있을 수 있다.
--   3) invite_tokens는 authenticated 전체 관리(USING true)라 누구나 초대 토큰을
--      조회·발급·소비할 수 있었고, 초대받은 사람(비로그인)은 검증 자체가 불가능했다.
--
-- 변경
--   A. 변호사 계정 매핑: 신규 계정은 서버가 lawyer_id를 'lawyer-<auth uid>'로 부여
--      (claim_lawyer_account). 기존 프로필 ID 연결은 관리자 전용(admin_link_lawyer_account).
--   B. lawyers: 본인 매핑 행 또는 관리자만 INSERT/UPDATE, DELETE는 관리자만.
--      data JSONB의 password 키는 저장 시점에 항상 제거.
--   C. invite_tokens: 발급자(승인 변호사)·관리자만 직접 접근.
--      검증은 peek_invite_token(anon 허용, 최소 정보), 소비는 consume_invite_token.
--
-- 선행: 012_consult_requests_strict_rls.sql (lawyer_accounts, is_platform_admin 등)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- A. 변호사 계정 매핑
-- ─────────────────────────────────────────────────────────────

-- 로그인 사용자의 매핑을 반환하고, 없으면 'lawyer-<uid>'로 미승인 매핑을 생성한다.
CREATE OR REPLACE FUNCTION public.claim_lawyer_account()
RETURNS TABLE (lawyer_id text, approved boolean, auth_email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = v_uid) THEN
    INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
    VALUES (v_uid, 'lawyer-' || v_uid::text, lower((SELECT u.email FROM auth.users u WHERE u.id = v_uid)), false);
  END IF;

  RETURN QUERY
    SELECT la.lawyer_id, la.approved, la.auth_email
    FROM lawyer_accounts la
    WHERE la.auth_user_id = v_uid;
END;
$$;

-- 하위 호환: 본인 uid 기반 ID 또는 이미 연결된 ID만 허용 (타인 프로필 선점 차단)
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

  SELECT * INTO v_existing FROM lawyer_accounts WHERE auth_user_id = v_uid;
  IF FOUND THEN
    IF v_existing.lawyer_id <> p_lawyer_id THEN
      RAISE EXCEPTION 'this account is already linked to another lawyer profile' USING ERRCODE = '42501';
    END IF;
    RETURN v_existing.approved;
  END IF;

  IF p_lawyer_id IS DISTINCT FROM ('lawyer-' || v_uid::text) THEN
    RAISE EXCEPTION 'existing lawyer profiles can only be linked by an administrator' USING ERRCODE = '42501';
  END IF;

  INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
  VALUES (v_uid, p_lawyer_id, lower((SELECT email FROM auth.users WHERE id = v_uid)), false);
  RETURN false;
END;
$$;

-- 관리자: 이미 한 번 로그인한 인증 계정(이메일)을 기존 변호사 프로필 ID에 연결
--   예) SELECT public.admin_link_lawyer_account('lawyer@example.com', 'lawyer-1', true);
CREATE OR REPLACE FUNCTION public.admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_lawyer_id), '') = '' THEN
    RAISE EXCEPTION 'lawyer_id required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no auth user with that email (user must sign in once first)' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM lawyer_accounts WHERE lawyer_id = p_lawyer_id AND auth_user_id <> v_uid) THEN
    RAISE EXCEPTION 'lawyer_id already linked to another auth user' USING ERRCODE = '23505';
  END IF;

  INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved, approved_at, approved_by)
  VALUES (v_uid, p_lawyer_id, lower(trim(p_email)), p_approved,
          CASE WHEN p_approved THEN NOW() END, CASE WHEN p_approved THEN auth.uid() END)
  ON CONFLICT (auth_user_id) DO UPDATE
     SET lawyer_id   = EXCLUDED.lawyer_id,
         auth_email  = EXCLUDED.auth_email,
         approved    = EXCLUDED.approved,
         approved_at = EXCLUDED.approved_at,
         approved_by = EXCLUDED.approved_by;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lawyer_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_lawyer_account(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_link_lawyer_account(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lawyer_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_lawyer_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_lawyer_account(text, text, boolean) TO authenticated;

-- 본인 매핑 lawyer_id (승인 여부 무관) — lawyers 행 소유 판정용
CREATE OR REPLACE FUNCTION public.current_lawyer_profile_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT la.lawyer_id FROM lawyer_accounts la WHERE la.auth_user_id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- B. lawyers 테이블
-- ─────────────────────────────────────────────────────────────
UPDATE lawyers SET data = data - 'password' WHERE data ? 'password';

CREATE OR REPLACE FUNCTION public.strip_lawyer_secrets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    NEW.data := NEW.data - 'password';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_strip_lawyer_secrets ON lawyers;
CREATE TRIGGER trg_strip_lawyer_secrets
BEFORE INSERT OR UPDATE ON lawyers
FOR EACH ROW EXECUTE FUNCTION public.strip_lawyer_secrets();

DROP POLICY IF EXISTS "authenticated_all_lawyers" ON lawyers;
DROP POLICY IF EXISTS "lawyers_select_authenticated" ON lawyers;
DROP POLICY IF EXISTS "lawyers_insert_self_or_admin" ON lawyers;
DROP POLICY IF EXISTS "lawyers_update_self_or_admin" ON lawyers;
DROP POLICY IF EXISTS "lawyers_delete_admin" ON lawyers;

-- 공개 프로필 조회는 유지 (anon_select_lawyers는 006 정책 그대로)
CREATE POLICY "lawyers_select_authenticated" ON lawyers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "lawyers_insert_self_or_admin" ON lawyers
FOR INSERT TO authenticated
WITH CHECK (id = public.current_lawyer_profile_id() OR public.is_platform_admin());

CREATE POLICY "lawyers_update_self_or_admin" ON lawyers
FOR UPDATE TO authenticated
USING (id = public.current_lawyer_profile_id() OR public.is_platform_admin())
WITH CHECK (id = public.current_lawyer_profile_id() OR public.is_platform_admin());

CREATE POLICY "lawyers_delete_admin" ON lawyers
FOR DELETE TO authenticated
USING (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────
-- C. invite_tokens
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_manage_invite_tokens" ON invite_tokens;
DROP POLICY IF EXISTS "anon_read_invite_tokens" ON invite_tokens;
DROP POLICY IF EXISTS "invite_tokens_owner_or_admin" ON invite_tokens;

CREATE POLICY "invite_tokens_owner_or_admin" ON invite_tokens
FOR ALL TO authenticated
USING (created_by = public.current_approved_lawyer_id() OR public.is_platform_admin())
WITH CHECK (created_by = public.current_approved_lawyer_id() OR public.is_platform_admin());

-- 초대받은 사람(로그인 전)이 링크 유효성만 확인 — 토큰 원문을 알아야 하며 역할/만료만 노출
CREATE OR REPLACE FUNCTION public.peek_invite_token(p_token text)
RETURNS TABLE (role text, expires_at timestamptz, is_used boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT it.role, it.expires_at, coalesce(it.is_used, false)
  FROM invite_tokens it
  WHERE it.token = p_token AND length(coalesce(p_token, '')) >= 20
  LIMIT 1;
$$;

-- 로그인한 초대 대상자가 토큰을 1회 소비 (지정 이메일이 있으면 일치해야 함)
CREATE OR REPLACE FUNCTION public.consume_invite_token(p_token text, p_staff_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email text;
  v_row invite_tokens%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_row FROM invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite token' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(v_row.is_used, false) THEN
    RAISE EXCEPTION 'invite token already used' USING ERRCODE = '42501';
  END IF;
  IF v_row.expires_at < NOW() THEN
    RAISE EXCEPTION 'invite token expired' USING ERRCODE = '42501';
  END IF;
  IF v_row.email IS NOT NULL AND length(trim(v_row.email)) > 0 AND lower(trim(v_row.email)) <> v_email THEN
    RAISE EXCEPTION 'invite token is restricted to another email' USING ERRCODE = '42501';
  END IF;

  UPDATE invite_tokens
     SET is_used = true, used_by = coalesce(nullif(p_staff_id, ''), v_uid::text), used_at = NOW()
   WHERE id = v_row.id;
  RETURN v_row.role;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_invite_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_invite_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peek_invite_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_token(text, text) TO authenticated;

COMMIT;

-- ============================================================================
-- 적용 후 운영 절차
--   * 기존 시드 프로필(lawyer-1 등)을 실제 변호사 계정에 연결하려면 해당 변호사가
--     소셜 로그인을 1회 완료한 뒤 관리자 JWT로 admin_link_lawyer_account 실행.
--   * 롤백: 012의 register_lawyer_account 정의 재실행, 006 lawyers 정책 재생성,
--     002 invite_tokens 정책 재생성, DROP FUNCTION claim_lawyer_account / peek / consume.
-- ============================================================================


-- END OF MIGRATION: 018_lawyer_auth_hardening.sql


-- ====================================================================
-- START OF MIGRATION: 019_user_sessions_owner_rls.sql
-- ====================================================================

-- ============================================================================
-- 019. user_sessions 본인·관리자 전용 RLS
-- ----------------------------------------------------------------------------
-- 007은 authenticated 전체에 SELECT/INSERT/UPDATE(USING true)를 허용해,
-- 로그인한 누구나 다른 사용자의 기기·IP 목록을 보고 세션을 강제 종료할 수 있었다.
-- PART 2-1부터 세션 가드가 서버의 revoked 상태를 읽어 다른 기기 로그아웃을 반영하므로
-- 행 소유자를 다음 중 하나로 제한한다.
--   * 변호사/직원: user_id = lawyer_accounts.lawyer_id (018 current_lawyer_profile_id)
--   * 관리자 포털: user_id = 로그인 이메일, 또는 JWT app_metadata.role = 'admin'
-- 선행: 012, 018
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "authenticated_select_user_sessions" ON user_sessions;
DROP POLICY IF EXISTS "authenticated_insert_user_sessions" ON user_sessions;
DROP POLICY IF EXISTS "authenticated_update_user_sessions" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_owner_select" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_owner_insert" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_owner_update" ON user_sessions;

CREATE OR REPLACE FUNCTION public.is_session_owner(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND (
       p_user_id = public.current_lawyer_profile_id()
    OR lower(p_user_id) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR p_user_id = auth.uid()::text
  );
$$;

CREATE POLICY "user_sessions_owner_select" ON user_sessions
FOR SELECT TO authenticated
USING (public.is_session_owner(user_id) OR public.is_platform_admin());

CREATE POLICY "user_sessions_owner_insert" ON user_sessions
FOR INSERT TO authenticated
WITH CHECK (public.is_session_owner(user_id) OR public.is_platform_admin());

CREATE POLICY "user_sessions_owner_update" ON user_sessions
FOR UPDATE TO authenticated
USING (public.is_session_owner(user_id) OR public.is_platform_admin())
WITH CHECK (public.is_session_owner(user_id) OR public.is_platform_admin());

COMMIT;

-- 롤백: 위 정책 3개 DROP 후 007의 authenticated_* 정책 재생성


-- END OF MIGRATION: 019_user_sessions_owner_rls.sql


-- ====================================================================
-- START OF MIGRATION: 020_team_calendar_messenger_rls.sql
-- ====================================================================

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


-- END OF MIGRATION: 020_team_calendar_messenger_rls.sql


-- ====================================================================
-- START OF MIGRATION: 021_platform_admin_zero_trust.sql
-- ====================================================================

-- ============================================================================
-- 021. 통합 어드민 제로트러스트 (PART 3-1)
-- ----------------------------------------------------------------------------
-- 1) is_platform_admin(): app_metadata.role = 'admin' 에 더해 MFA(aal2) 세션만 인정
--    - 관리자 포털은 인증 앱(TOTP) 2단계 인증을 거친 뒤에만 aal2가 된다.
--    - 이전: 비밀번호/구글 로그인(aal1)만으로 관리자 권한. 클라이언트 OTP는 우회 가능했음.
-- 2) members.role='ADMIN' 기반 관리자 판정 제거 (006에서 authenticated가 members를 쓸 수 있어 위조 가능)
--    - lawyer_smtp_credentials(010) 정책, get_admin_contract_anchors(011)
-- 3) audit_logs 불변·위조 방지
--    - 조회: 관리자만 (이전: 로그인한 누구나 전체 감사 로그 조회)
--    - 기록: 서버가 created_at·ip_address·auth_uid·auth_email을 채움.
--      관리자가 아닌 요청의 actor_role 'admin'/'system' 주장은 강등
--    - UPDATE/DELETE/TRUNCATE: 트리거로 차단 (서비스 롤 포함)
-- 4) user_sessions: ip_address를 서버 요청 헤더로 기록, ADMIN 세션은 관리자만 등록
-- 5) admin_revoke_auth_sessions(): 관리자가 특정 사용자의 Supabase 로그인 세션(refresh token) 폐기
--
-- 선행: 001, 006, 010, 011, 012, 018, 019
-- 적용 전: 관리자 계정이 인증 앱을 등록할 수 있도록 Supabase Auth의 MFA(TOTP)가 켜져 있는지 확인.
--          적용 직후에는 관리자도 2단계 인증을 마쳐야 DB 관리자 권한이 생긴다.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. 관리자 판정: role=admin AND aal2
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- ─────────────────────────────────────────────────────────────
-- 2-a. lawyer_smtp_credentials: members 기반 관리자 판정 제거, UPDATE 소유자 변경 차단
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.lawyer_smtp_credentials') IS NOT NULL THEN
    DROP POLICY IF EXISTS "lawyer_smtp_select_policy" ON lawyer_smtp_credentials;
    DROP POLICY IF EXISTS "lawyer_smtp_insert_policy" ON lawyer_smtp_credentials;
    DROP POLICY IF EXISTS "lawyer_smtp_update_policy" ON lawyer_smtp_credentials;
    DROP POLICY IF EXISTS "lawyer_smtp_delete_policy" ON lawyer_smtp_credentials;

    CREATE POLICY "lawyer_smtp_select_policy" ON lawyer_smtp_credentials
      FOR SELECT TO authenticated
      USING (lawyer_id = auth.uid()::text OR public.is_platform_admin());
    CREATE POLICY "lawyer_smtp_insert_policy" ON lawyer_smtp_credentials
      FOR INSERT TO authenticated
      WITH CHECK (lawyer_id = auth.uid()::text OR public.is_platform_admin());
    -- 이전 WITH CHECK (true): 본인 행의 lawyer_id를 다른 값으로 바꿀 수 있었음
    CREATE POLICY "lawyer_smtp_update_policy" ON lawyer_smtp_credentials
      FOR UPDATE TO authenticated
      USING (lawyer_id = auth.uid()::text OR public.is_platform_admin())
      WITH CHECK (lawyer_id = auth.uid()::text OR public.is_platform_admin());
    CREATE POLICY "lawyer_smtp_delete_policy" ON lawyer_smtp_credentials
      FOR DELETE TO authenticated
      USING (lawyer_id = auth.uid()::text OR public.is_platform_admin());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2-b. get_admin_contract_anchors: is_platform_admin()만 신뢰
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_contract_anchors()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ec.id,
        'client_id', ec.client_id,
        'client_name', ec.client_name,
        'lawyer_name', ec.lawyer_name,
        'law_firm_name', ec.law_firm_name,
        'assigned_lawyer_id', ec.assigned_lawyer_id,
        'status', ec.status,
        'contract_date', ec.contract_date,
        'is_business', ec.is_business,
        'document_hashes', ec.document_hashes,
        'blockchain_anchor', ec.blockchain_anchor,
        'created_at', ec.created_at,
        'updated_at', ec.updated_at
      ) ORDER BY ec.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM electronic_contracts ec;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION get_admin_contract_anchors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_contract_anchors() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. 요청 IP (PostgREST request.headers) — 없으면 NULL
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  h json;
  v text;
BEGIN
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN RETURN NULL; END IF;
  v := coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(h ->> 'x-real-ip', '')
  );
  RETURN left(v, 64);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. audit_logs 불변·위조 방지
-- ─────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS auth_email TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS claimed_actor_role TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_auth_uid ON audit_logs (auth_uid, created_at DESC);

DROP POLICY IF EXISTS "authenticated_select_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit_logs;
CREATE POLICY "audit_logs_admin_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());
-- INSERT는 006의 all_insert_audit_logs(public, WITH CHECK true) 유지 — 허니팟(비로그인)·의뢰인 기록용.
-- 내용은 아래 트리거가 정규화한다.

-- SECURITY INVOKER여야 current_user로 호출 역할(anon/authenticated/service_role)을 구분할 수 있다
CREATE OR REPLACE FUNCTION public.audit_logs_normalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 서비스 롤·DB 내부 함수(예: 001 auto_cleanup)는 그대로 둔다
  IF current_user NOT IN ('anon', 'authenticated') THEN
    NEW.created_at := coalesce(NEW.created_at, now());
    RETURN NEW;
  END IF;

  NEW.created_at := now();
  NEW.auth_uid := auth.uid();
  NEW.auth_email := left(auth.jwt() ->> 'email', 254);
  NEW.ip_address := public.request_client_ip();
  NEW.claimed_actor_role := left(NEW.actor_role, 32);

  IF public.is_platform_admin() THEN
    NEW.actor_role := CASE WHEN NEW.actor_role = 'system' THEN 'admin' ELSE coalesce(NEW.actor_role, 'admin') END;
  ELSIF auth.uid() IS NULL THEN
    NEW.actor_role := 'anonymous';
  ELSIF NEW.actor_role IN ('admin', 'system') THEN
    NEW.actor_role := 'unverified';
  END IF;

  NEW.actor_id := left(coalesce(nullif(NEW.actor_id, ''), 'unknown'), 200);
  NEW.action := left(NEW.action, 64);
  NEW.target_type := left(NEW.target_type, 64);
  NEW.target_id := left(NEW.target_id, 200);
  NEW.user_agent := left(NEW.user_agent, 400);
  IF NEW.detail IS NOT NULL AND octet_length(NEW.detail::text) > 4000 THEN
    NEW.detail := jsonb_build_object('truncated', true, 'original_bytes', octet_length(NEW.detail::text));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_normalize ON audit_logs;
CREATE TRIGGER trg_audit_logs_normalize
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_normalize();

CREATE OR REPLACE FUNCTION public.audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_logs_immutable();

-- ─────────────────────────────────────────────────────────────
-- 5. user_sessions: 서버 기준 IP, ADMIN 세션 위조 방지
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_sessions_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ip text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_role = 'ADMIN' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'ADMIN session requires platform admin' USING ERRCODE = '42501';
  END IF;
  v_ip := public.request_client_ip();
  IF v_ip IS NOT NULL THEN
    NEW.ip_address := v_ip;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_sessions_server_fields ON user_sessions;
CREATE TRIGGER trg_user_sessions_server_fields
  BEFORE INSERT ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.user_sessions_server_fields();

-- ─────────────────────────────────────────────────────────────
-- 6. 관리자: 특정 사용자의 Supabase 로그인 세션 폐기
--    p_user_id: user_sessions.user_id 값 (변호사 프로필 ID, 이메일, 또는 auth uid)
--    auth.sessions 삭제 시 연결된 refresh token도 함께 삭제된다(FK CASCADE).
--    이미 발급된 access token(JWT)은 만료 시각까지 유효하다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_revoke_auth_sessions(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uids uuid[];
  v_count integer := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN 0;
  END IF;

  SELECT array_agg(DISTINCT uid) INTO v_uids FROM (
    SELECT la.auth_user_id AS uid FROM public.lawyer_accounts la WHERE la.lawyer_id = p_user_id
    UNION
    SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(p_user_id)
    UNION
    SELECT u.id FROM auth.users u WHERE u.id::text = p_user_id
  ) s WHERE uid IS NOT NULL;

  IF v_uids IS NULL THEN
    RETURN 0;
  END IF;
  IF auth.uid() = ANY (v_uids) THEN
    RAISE EXCEPTION 'cannot revoke own sessions here' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = ANY (v_uids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.user_sessions
     SET status = 'revoked', revoked_at = now(), revoked_by = 'admin',
         revoke_reason = coalesce(revoke_reason, '관리자 로그인 토큰 폐기')
   WHERE user_id = p_user_id AND status = 'active';

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_auth_sessions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_auth_sessions(text) TO authenticated;

COMMIT;

-- ============================================================================
-- 적용 후 확인 (SQL 편집기)
--   1) 관리자 지정: 서비스 롤로만 가능
--      UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--       WHERE email = '<관리자 이메일>';
--   2) 관리자 포털 로그인 → 인증 앱 등록 → 코드 입력 후 SELECT count(*) FROM audit_logs; 가 되는지
--   3) 일반 로그인 사용자로 SELECT * FROM audit_logs; → 0행
--   4) UPDATE audit_logs SET action='x' WHERE id=1; → 'audit_logs is append-only' 오류
-- 롤백: is_platform_admin()을 012 정의로, audit_logs 트리거 3개·정책 DROP 후 006 SELECT 정책 재생성
-- 보존 기간 정리가 필요하면 trg_audit_logs_no_update_delete를 잠시 비활성화하는 별도 절차로 진행
-- ============================================================================


-- END OF MIGRATION: 021_platform_admin_zero_trust.sql


-- ====================================================================
-- START OF MIGRATION: 022_activity_logs_lockdown.sql
-- ====================================================================

-- ============================================================================
-- 022. activity_logs 잠금 (PART 3-2)
-- ----------------------------------------------------------------------------
-- 006은 authenticated 전체에 activity_logs SELECT/INSERT(USING/WITH CHECK true)를 허용해
-- 로그인한 누구나(의뢰인 포함) 전체 활동 로그를 조회하고 위조 기록을 넣을 수 있었다.
-- 앱은 이 테이블을 더 이상 쓰지 않는다(사용되지 않던 activityLogService.ts 삭제).
-- 플랫폼 활동 로그는 audit_logs(action='member_activity', 021 불변·서버 IP·관리자 전용 조회)로 일원화.
-- 기존 데이터는 보존하고 관리자(aal2)만 조회할 수 있게 한다.
-- 선행: 021 (is_platform_admin: role=admin AND aal2)
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "authenticated_select_activity_logs" ON activity_logs;
    DROP POLICY IF EXISTS "authenticated_insert_activity_logs" ON activity_logs;
    DROP POLICY IF EXISTS "allow_anon_all_activity_logs" ON activity_logs;
    DROP POLICY IF EXISTS "activity_logs_admin_select" ON activity_logs;
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "activity_logs_admin_select" ON activity_logs
      FOR SELECT TO authenticated
      USING (public.is_platform_admin());
    -- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 쓰기 불가 (서비스 롤만)
  END IF;
END $$;

COMMIT;

-- 확인: 일반 로그인 사용자로 SELECT count(*) FROM activity_logs; → 0, INSERT → RLS 오류
-- 롤백: 006의 authenticated_select/insert_activity_logs 정책 재생성


-- END OF MIGRATION: 022_activity_logs_lockdown.sql


-- ====================================================================
-- START OF MIGRATION: 023_admin_consult_controls_members_rls.sql
-- ====================================================================

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


-- END OF MIGRATION: 023_admin_consult_controls_members_rls.sql


-- ====================================================================
-- START OF MIGRATION: 024_ad_orders.sql
-- ====================================================================

-- ============================================================================
-- 024. 광고 주문(ad_orders) 테이블 + RLS (PART 3-4)
-- ----------------------------------------------------------------------------
-- 앱(adOrderService)은 ad_orders에 insert/update를 시도했지만 어떤 마이그레이션에도 테이블이 없었다.
-- 그래서 오류(42P01)를 삼키고 각 브라우저 localStorage에만 저장했고,
-- 관리자는 다른 기기에서 신청된 광고를 볼 수 없었다.
--   * 변호사: 본인(lawyer_accounts.lawyer_id) 주문만 조회, 'pending' 상태로만 신청 가능
--   * 상태 변경(입금 확인·활성화·취소)과 세금계산서 정보: 관리자(aal2)만
-- 선행: 012(lawyer_accounts), 018(current_lawyer_profile_id), 021(is_platform_admin, request_client_ip)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ad_orders (
  id                   TEXT PRIMARY KEY,
  lawyer_id            TEXT NOT NULL,
  lawyer_name          TEXT,
  product_id           TEXT,
  product_name         TEXT,
  contract_months      INTEGER NOT NULL DEFAULT 1 CHECK (contract_months BETWEEN 1 AND 36),
  monthly_price        INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  total_price          INTEGER NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'active', 'expired', 'cancelled')),
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ,
  activated_at         TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  depositor_name       TEXT,
  region               TEXT,
  tax_invoice          JSONB,
  modified_tax_invoice JSONB,
  buyer_corp_num       TEXT,
  buyer_corp_name      TEXT,
  buyer_ceo_name       TEXT,
  buyer_email          TEXT,
  created_by           UUID DEFAULT auth.uid(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_orders_lawyer ON ad_orders (lawyer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_orders_status ON ad_orders (status, requested_at DESC);

ALTER TABLE ad_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_orders_select_own_or_admin" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_insert_own_pending" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_update_admin" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_delete_admin" ON ad_orders;

CREATE POLICY "ad_orders_select_own_or_admin" ON ad_orders
  FOR SELECT TO authenticated
  USING (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin());

-- 변호사는 본인 이름으로 '입금 대기' 주문만 만들 수 있음 (결제·활성 상태로 직접 생성 불가)
CREATE POLICY "ad_orders_insert_own_pending" ON ad_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (
      lawyer_id = public.current_lawyer_profile_id()
      AND status = 'pending'
      AND paid_at IS NULL AND activated_at IS NULL AND expires_at IS NULL
      AND tax_invoice IS NULL AND modified_tax_invoice IS NULL
    )
  );

CREATE POLICY "ad_orders_update_admin" ON ad_orders
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "ad_orders_delete_admin" ON ad_orders
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- 상태 변경 서버 감사 기록
CREATE OR REPLACE FUNCTION public.ad_orders_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.paid_at IS DISTINCT FROM OLD.paid_at) THEN
    INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, detail, auth_uid, auth_email, ip_address)
    VALUES (
      coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'system'),
      CASE WHEN public.is_platform_admin() THEN 'admin' ELSE 'system' END,
      'ad_order_status', 'ad_order', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'paid_at', NEW.paid_at, 'total_price', NEW.total_price),
      auth.uid(), auth.jwt() ->> 'email', public.request_client_ip()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_orders_audit ON ad_orders;
CREATE TRIGGER trg_ad_orders_audit
  BEFORE UPDATE ON ad_orders
  FOR EACH ROW EXECUTE FUNCTION public.ad_orders_audit();

COMMIT;

-- 확인
--   변호사 세션: INSERT (status='active') → RLS 오류, INSERT (status='pending', 본인 lawyer_id) → 성공
--   변호사 세션: UPDATE ad_orders SET status='active' → 0행
--   관리자(aal2): SELECT * FROM ad_orders → 전체


-- END OF MIGRATION: 024_ad_orders.sql


-- ====================================================================
-- START OF MIGRATION: 025_cms_config_admin_write_rls.sql
-- ====================================================================

-- ============================================================================
-- 025. CMS·플랫폼 설정·문의 테이블 쓰기 권한을 관리자로 제한 (PART 3-6)
-- ----------------------------------------------------------------------------
-- 006은 아래 테이블에 authenticated 전체 ALL(USING/WITH CHECK true)을 허용했다.
-- 그래서 로그인한 누구나(카카오·구글 가입 의뢰인 포함) 공개 콘텐츠·팝업·매칭 쿨다운·
-- 회생 정책 기준표·진단 문항을 추가·수정·삭제할 수 있었다.
-- 또 006의 anon_select_client_inquiries(USING true)가 남아 있으면, 누구나 전 의뢰인의
-- 1:1 문의(연락처·첨부 포함)를 조회할 수 있다.
-- 009는 '변호사·직원'도 전체 문의를 조회할 수 있게 했고, members 기반 판정은 위조가 가능했다.
--
-- 변경
--   * 공개 콘텐츠·설정: 조회는 누구나, 쓰기는 관리자(is_platform_admin: role=admin AND aal2)만
--   * client_inquiries: 브라우저 직접 접근 차단 — /api/inquiry(서비스 롤, Turnstile·길이 검증)만 사용.
--     관리자 조회만 RLS로 허용
--   * lawyer_inquiries: 본인 lawyer_id 등록·조회, 관리자 전체
--   * diagnosis_config: 조회는 활성 설정만 누구나, 쓰기는 관리자만
-- 선행: 021
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  pub_tables text[] := ARRAY[
    'news_articles', 'client_qas', 'success_reviews', 'main_banners', 'notices',
    'platform_config', 'popup_config', 'matching_config', 'rehab_policy_settings'
  ];
BEGIN
  FOREACH t IN ARRAY pub_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_anon_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_select_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'authenticated_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_public_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_write', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)', t || '_public_select', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())', t || '_admin_write', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- client_inquiries
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.client_inquiries') IS NOT NULL THEN
    ALTER TABLE client_inquiries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_anon_all_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anon_select_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anon_insert_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "authenticated_all_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_select_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_insert_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_modify_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "client_inquiries_admin_select" ON client_inquiries;
    CREATE POLICY "client_inquiries_admin_select" ON client_inquiries
      FOR SELECT TO authenticated
      USING (public.is_platform_admin());
    -- INSERT/UPDATE/DELETE 정책 없음 → /api/inquiry(서비스 롤)만 기록
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- lawyer_inquiries (id, data jsonb — data->>'lawyerId')
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.lawyer_inquiries') IS NOT NULL THEN
    ALTER TABLE lawyer_inquiries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_anon_all_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anon_select_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anon_insert_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "authenticated_all_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anti_bola_select_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anti_bola_insert_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_own_insert" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_own_or_admin_select" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_admin_write" ON lawyer_inquiries;
    CREATE POLICY "lawyer_inquiries_own_insert" ON lawyer_inquiries
      FOR INSERT TO authenticated
      WITH CHECK ((data ->> 'lawyerId') = public.current_lawyer_profile_id() OR public.is_platform_admin());
    CREATE POLICY "lawyer_inquiries_own_or_admin_select" ON lawyer_inquiries
      FOR SELECT TO authenticated
      USING ((data ->> 'lawyerId') = public.current_lawyer_profile_id() OR public.is_platform_admin());
    CREATE POLICY "lawyer_inquiries_admin_write" ON lawyer_inquiries
      FOR UPDATE TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- diagnosis_config
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.diagnosis_config') IS NOT NULL THEN
    ALTER TABLE diagnosis_config ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated can manage diagnosis config" ON diagnosis_config;
    DROP POLICY IF EXISTS "anon_modify_config" ON diagnosis_config;
    DROP POLICY IF EXISTS "diagnosis_config_admin_write" ON diagnosis_config;
    CREATE POLICY "diagnosis_config_admin_write" ON diagnosis_config
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
    -- 조회 정책(활성 설정 공개)은 001의 기존 정책 유지
  END IF;
END $$;

COMMIT;

-- 확인
--   일반 로그인 사용자: INSERT INTO notices ... → RLS 오류, SELECT * FROM client_inquiries → 0행
--   관리자(aal2): 공지·배너·설정 쓰기 가능
-- 주의: lawyer_inquiries.data 구조(lawyerId 키)는 저장소 기준 추정 — 적용 전 실제 컬럼 확인


-- END OF MIGRATION: 025_cms_config_admin_write_rls.sql


-- ====================================================================
-- START OF MIGRATION: 026_infra_rls_cleanup.sql
-- ====================================================================

-- =============================================================================
-- 026. PART 4 공통 인프라 RLS 정리
--   006·20260916 등에 남아 있던 "USING (true)" 전체 허용 정책을 정리한다.
--   ⚠️ 실행 전 확인: 20260916 LeadMaster 안드로이드 앱이 anon 키로 접속 중이면 이 마이그레이션 이후
--      앱은 동기화가 막힌다. 앱을 사무소 계정(승인된 변호사/직원)으로 로그인하도록 바꾼 뒤 실행할 것.
--   멱등(재실행 가능)하게 작성. 012(is_platform_admin, current_approved_lawyer_id)·020(current_tenant_ids)·021 이후 실행.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 앱에서 쓰지 않는 단일행 설정 테이블 → 관리자(2단계 인증) 전용
--    - notification_channel_settings: 006 이후 로그인한 누구나(의뢰인 포함) 읽기·덮어쓰기 가능했다
--    - client_memos: 007에서 모든 사무소의 변호사·직원이 한 행을 공유·덮어쓰기 (사무소 간 분리 없음)
--    - fee_notification_settings, custom_roles, copilot_cases, copilot_rulesets: 006 authenticated ALL
--    src는 이 테이블들을 쓰지 않는다(브라우저 저장소 사용). phase1/phase2의 anon 전체 허용도 함께 제거.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'notification_channel_settings', 'client_memos', 'fee_notification_settings',
    'custom_roles', 'copilot_cases', 'copilot_rulesets'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'allow_anon_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anti_bola_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
      'admin_all_' || t, t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. LeadMaster 통화·문자 동기화 테이블 (20260916)
--    이전: FOR ALL TO public USING (true) → 공개 anon 키만 있으면 누구나
--      · 전 사무소 의뢰인 전화번호·문자 본문·통화 기록 조회/삭제
--      · pending_sms에 행을 넣어 사무소 휴대폰으로 임의 문자 발송
--    현재: 승인된 변호사 또는 활성 직원(사무소 소속) + 관리자만.
--    ⚠️ 이 테이블에는 사무소 구분 컬럼이 없어 사무소 간 분리는 아직 안 된다(아래 TODO).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_firm_user()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
      OR public.current_approved_lawyer_id() IS NOT NULL
      OR cardinality(public.current_tenant_ids()) > 0;
$$;
REVOKE ALL ON FUNCTION public.is_firm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_firm_user() TO authenticated;

DO $$
DECLARE
  t text;
  lm_tables text[] := ARRAY['communication_logs', 'pending_sms', 'pending_calls', 'sms_templates'];
BEGIN
  FOREACH t IN ARRAY lm_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow anon and auth read/write ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'firm_users_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_firm_user()) WITH CHECK (public.is_firm_user())',
      'firm_users_all_' || t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- TODO(출시 전): communication_logs 등에 tenant_id 컬럼을 추가하고 is_tenant_member(tenant_id)로 사무소별 분리.

-- ─────────────────────────────────────────────────────────────
-- 3. diagnosis_config: 001의 authenticated_modify_config(로그인한 누구나 진단 문항 수정)가 남아 있었다.
--    025는 다른 이름의 정책만 지웠다. 관리자 쓰기 정책은 025에 있으므로 여기서는 제거만 한다.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.diagnosis_config') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_modify_config" ON public.diagnosis_config';
  END IF;
END $$;


-- END OF MIGRATION: 026_infra_rls_cleanup.sql
