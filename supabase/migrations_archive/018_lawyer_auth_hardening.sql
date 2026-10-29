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
