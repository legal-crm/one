-- ════════════════════════════════════════════════════════════════════════════
-- RB-9 퇴사 처리 (한 번에): 맡던 사건·영업 리드·업무함 일을 넘겨받을 사람에게 옮기고, 접속·업무폰을 끊고, 기록을 남긴다
-- (이전: 상태만 '탈퇴'로 바꿔 사건 담당자·리드 담당자가 퇴사자로 남았고 업무폰은 계속 연결돼 있었다)
-- 대표만 (office.staff), 대표 자신은 퇴사 처리 불가
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.office_member_offboard(p_member_id uuid, p_handover_member_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m office_members;
  h office_members;
  v_cases_lawyer int := 0;
  v_cases_staff int := 0;
  v_leads int := 0;
  v_queue int := 0;
  v_devices int := 0;
BEGIN
  SELECT * INTO m FROM office_members WHERE id = p_member_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'member not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(m.office_id, 'office.staff') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF m.role = 'owner' THEN RAISE EXCEPTION 'cannot offboard owner' USING ERRCODE = '42501'; END IF;
  IF m.status = 'left' THEN RAISE EXCEPTION 'already left' USING ERRCODE = '22023'; END IF;
  SELECT * INTO h FROM office_members WHERE id = p_handover_member_id AND office_id = m.office_id AND status = 'active';
  IF h.id IS NULL OR h.id = m.id THEN RAISE EXCEPTION 'handover member must be an active member' USING ERRCODE = '22023'; END IF;

  -- 사건 담당: 변호사 자리는 변호사에게만 (직원에게 넘기면 담당 변호사는 비움 → 대표가 다시 정함)
  UPDATE cases SET lawyer_member_id = CASE WHEN h.role IN ('owner', 'lawyer') THEN h.id END, version = version + 1, updated_at = now()
   WHERE office_id = m.office_id AND lawyer_member_id = m.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_cases_lawyer = ROW_COUNT;
  UPDATE cases SET staff_member_id = CASE WHEN h.role NOT IN ('owner', 'lawyer') THEN h.id ELSE staff_member_id END,
         version = version + 1, updated_at = now()
   WHERE office_id = m.office_id AND staff_member_id = m.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_cases_staff = ROW_COUNT;
  UPDATE cases SET staff_member_id = NULL WHERE office_id = m.office_id AND staff_member_id = m.id;

  UPDATE sales_leads SET assignee_user_id = h.user_id, updated_at = now()
   WHERE office_id = m.office_id AND assignee_user_id = m.user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  UPDATE work_queue_overrides SET assignee_member_id = h.id, updated_at = now()
   WHERE office_id = m.office_id AND assignee_member_id = m.id;
  GET DIAGNOSTICS v_queue = ROW_COUNT;

  UPDATE office_devices SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left('퇴사 처리', 200)
   WHERE office_id = m.office_id AND user_id = m.user_id AND status <> 'revoked';
  GET DIAGNOSTICS v_devices = ROW_COUNT;

  UPDATE office_members SET status = 'left', left_at = now() WHERE id = m.id;
  PERFORM public.revoke_user_sessions_internal(m.user_id, '퇴사 처리');

  PERFORM public.office_log(m.office_id, 'member.offboard', 'office_member', m.id::text, jsonb_build_object(
    'handover_member_id', h.id, 'cases_lawyer', v_cases_lawyer, 'cases_staff', v_cases_staff,
    'leads', v_leads, 'queue', v_queue, 'devices', v_devices, 'reason', left(coalesce(p_reason, ''), 200)));
  PERFORM public.notify_user(h.user_id, 'office', m.office_id, 'member_handover',
    '맡을 일이 넘어왔어요', '퇴사한 구성원이 맡던 사건·리드·업무가 넘어왔어요. 오늘의 업무에서 확인해 주세요.',
    'work_queue', NULL, 'handover:' || m.id);
  RETURN jsonb_build_object('cases', v_cases_lawyer + v_cases_staff, 'leads', v_leads, 'queue', v_queue, 'devices', v_devices);
END;
$$;
REVOKE ALL ON FUNCTION public.office_member_offboard(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_member_offboard(uuid, uuid, text) TO authenticated;
