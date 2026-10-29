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
