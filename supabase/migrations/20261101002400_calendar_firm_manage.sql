-- ============================================================
-- RB-4 일정 권한을 화면과 서버에서 같게
-- 문제: 화면은 '전체 공유 일정 관리'(사무소 사건 보기 범위 = 전체)가 있으면 사무소 공용 일정을 고치고 지울 수 있다고
--       보여 주는데, 서버 정책은 담당자·대표만 허용해 고치기·지우기가 실패했다.
-- 바꾼 것: 공용(visibility 'firm') 일정은 사건 보기 범위가 '전체'인 구성원도 고치고 지울 수 있다.
--          개인·변호사 공유 일정 규칙은 그대로 (담당자 또는 대표).
-- ============================================================
DROP POLICY IF EXISTS calendar_tenant_update ON public.calendar_events;
CREATE POLICY calendar_tenant_update ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id) AND (
    assigned_staff_id = ANY (public.current_actor_ids())
    OR public.tenant_role(tenant_id) = 'OWNER'
    OR (visibility = 'firm' AND public.office_permission_scope(tenant_id, 'case.view') = 'all')))
  WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS calendar_tenant_delete ON public.calendar_events;
CREATE POLICY calendar_tenant_delete ON public.calendar_events FOR DELETE TO authenticated
  USING (public.is_tenant_member(tenant_id) AND (
    assigned_staff_id = ANY (public.current_actor_ids())
    OR public.tenant_role(tenant_id) = 'OWNER'
    OR (visibility = 'firm' AND public.office_permission_scope(tenant_id, 'case.view') = 'all')));
