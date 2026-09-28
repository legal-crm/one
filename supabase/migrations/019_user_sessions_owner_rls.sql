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
