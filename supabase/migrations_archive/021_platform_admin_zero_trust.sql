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
