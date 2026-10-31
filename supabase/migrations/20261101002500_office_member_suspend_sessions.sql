-- ============================================================
-- RB-7 직원 이용 정지 → 로그인 세션도 바로 끊기
-- 문제: 사무소에서 직원을 '정지'하면 화면 기록(user_sessions)만 'revoked'로 바뀌고 Supabase 로그인 세션은 남아,
--       새로 고칠 때까지(접속 토큰 만료 전) 열린 화면을 계속 쓸 수 있었다. (퇴사 처리·관리자 정지는 이미 끊음)
-- 바꾼 것: 구성원 상태가 active → suspended/left 로 바뀌면 그 계정의 로그인 세션을 지운다 (대표 제외).
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_office_member_status_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status IN ('suspended', 'left') AND NEW.role <> 'owner' AND NEW.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.revoke_user_sessions_internal(NEW.user_id, CASE WHEN NEW.status = 'left' THEN '사무소 퇴사' ELSE '사무소 이용 정지' END);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'office member session revoke failed: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_office_member_status_sessions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS office_member_status_sessions ON public.office_members;
CREATE TRIGGER office_member_status_sessions AFTER UPDATE OF status ON public.office_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_office_member_status_sessions();
