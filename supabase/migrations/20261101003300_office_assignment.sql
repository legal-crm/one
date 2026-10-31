-- ════════════════════════════════════════════════════════════════════════════
-- RB-8 배정: 미배정 사건·리드 배정, 자동 배정 규칙, 업무량, 일괄 이관
--  * 규칙은 office_settings 구역 'assignment' (설정 바꾸기 = office.settings.edit, 기존 set_office_settings)
--      case_lawyer: none | owner | least_loaded   (담당 변호사가 비어 있는 새 사건)
--      case_staff:  none | least_loaded           (담당 직원이 비어 있는 새 사건)
--      lead:        none | least_loaded           (담당자가 비어 있는 새 리드, 기본 least_loaded = SL-Q3 '기본 순번')
--      lawyer_pool / staff_pool / lead_pool: 구성원 ID 목록 (비우면 조건에 맞는 활성 구성원 전부)
--    '업무량이 가장 적은 사람'(진행 중 사건·리드 수, 같으면 먼저 들어온 사람)에게 준다
--  * office_assignment_overview: 구성원별 업무량 + 미배정 사건·리드 (case.assign 또는 sales.manage)
--  * office_bulk_assign: 고른 사건·리드를 한 사람에게 (사건 = case.assign 전체 범위, 리드 = sales.manage)
--  * office_transfer_work: 한 사람의 진행 중 사건·리드·업무 조정을 다른 사람에게 (office.staff, 퇴사 아님)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.office_settings DROP CONSTRAINT IF EXISTS office_settings_section_check;
ALTER TABLE public.office_settings ADD CONSTRAINT office_settings_section_check
  CHECK (section IN ('profile', 'seal', 'client_messaging', 'copy_rules', 'work_defaults', 'security', 'assignment'));

-- 진행 중 업무량 (사건: 담당 변호사·직원 자리, 리드: 담당자)
CREATE OR REPLACE FUNCTION public.office_member_load(p_member office_members)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM cases c WHERE c.office_id = p_member.office_id AND c.deleted_at IS NULL AND c.purged_at IS NULL
            AND c.closed_on IS NULL AND c.stage <> 'closed' AND (c.lawyer_member_id = p_member.id OR c.staff_member_id = p_member.id))::int
       + (SELECT count(*) FROM sales_leads s WHERE s.office_id = p_member.office_id AND s.deleted_at IS NULL
            AND s.status NOT IN ('converted', 'closed') AND s.assignee_user_id = p_member.user_id)::int;
$$;
REVOKE ALL ON FUNCTION public.office_member_load(office_members) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.office_assignment_rules(p_office_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('case_lawyer', 'none', 'case_staff', 'none', 'lead', 'least_loaded')
         || coalesce((SELECT data FROM office_settings WHERE office_id = p_office_id AND section = 'assignment'), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.office_assignment_rules(text) FROM PUBLIC, anon, authenticated;

-- p_kind: 'lawyer' | 'staff' | 'lead'
CREATE OR REPLACE FUNCTION public.office_pick_assignee(p_office_id text, p_kind text)
RETURNS office_members LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb := public.office_assignment_rules(p_office_id);
  v_mode text := r ->> CASE p_kind WHEN 'lawyer' THEN 'case_lawyer' WHEN 'staff' THEN 'case_staff' ELSE 'lead' END;
  v_pool uuid[];
  m office_members;
BEGIN
  IF v_mode IS NULL OR v_mode = 'none' THEN RETURN NULL; END IF;
  IF p_kind = 'lawyer' AND v_mode = 'owner' THEN
    SELECT * INTO m FROM office_members WHERE office_id = p_office_id AND role = 'owner' AND status = 'active' LIMIT 1;
    RETURN m;
  END IF;
  IF v_mode <> 'least_loaded' THEN RETURN NULL; END IF;
  SELECT array_agg(x::uuid) INTO v_pool
    FROM jsonb_array_elements_text(coalesce(r -> (p_kind || '_pool'), '[]'::jsonb)) x
   WHERE x ~ '^[0-9a-f-]{36}$';
  SELECT om.* INTO m FROM office_members om
   WHERE om.office_id = p_office_id AND om.status = 'active'
     AND (v_pool IS NULL OR om.id = ANY (v_pool))
     AND CASE p_kind
           WHEN 'lawyer' THEN om.role IN ('owner', 'lawyer')
           WHEN 'staff' THEN om.role NOT IN ('owner', 'lawyer')
           ELSE om.user_id IS NOT NULL AND public.member_permission_scope(om, 'sales.view') <> 'none'
         END
   ORDER BY public.office_member_load(om), om.joined_at NULLS LAST, om.created_at
   LIMIT 1;
  RETURN m;
END;
$$;
REVOKE ALL ON FUNCTION public.office_pick_assignee(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_case_auto_assign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m office_members;
BEGIN
  IF NEW.lawyer_member_id IS NULL THEN
    m := public.office_pick_assignee(NEW.office_id, 'lawyer');
    IF m.id IS NOT NULL THEN NEW.lawyer_member_id := m.id; END IF;
  END IF;
  IF NEW.staff_member_id IS NULL THEN
    m := public.office_pick_assignee(NEW.office_id, 'staff');
    IF m.id IS NOT NULL THEN NEW.staff_member_id := m.id; END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'case auto assign skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_case_auto_assign ON public.cases;
CREATE TRIGGER trg_case_auto_assign BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_auto_assign();

CREATE OR REPLACE FUNCTION public.trg_sales_lead_auto_assign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m office_members;
BEGIN
  IF NEW.assignee_user_id IS NULL AND NEW.deleted_at IS NULL THEN
    m := public.office_pick_assignee(NEW.office_id, 'lead');
    IF m.user_id IS NOT NULL THEN NEW.assignee_user_id := m.user_id; END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lead auto assign skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sales_lead_auto_assign ON public.sales_leads;
CREATE TRIGGER trg_sales_lead_auto_assign BEFORE INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_lead_auto_assign();

-- ── 화면: 업무량 + 미배정 목록 ──
CREATE OR REPLACE FUNCTION public.office_assignment_overview(p_office_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cases boolean := public.office_permission_scope(p_office_id, 'case.assign') = 'all';
  v_leads boolean := public.office_permission_scope(p_office_id, 'sales.manage') = 'all';
BEGIN
  IF NOT (v_cases OR v_leads) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'can_cases', v_cases,
    'can_leads', v_leads,
    'rules', public.office_assignment_rules(p_office_id),
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', m.id, 'name', m.display_name, 'role', m.role,
        'cases_lawyer', (SELECT count(*) FROM cases c WHERE c.office_id = p_office_id AND c.lawyer_member_id = m.id
                           AND c.deleted_at IS NULL AND c.purged_at IS NULL AND c.closed_on IS NULL AND c.stage <> 'closed'),
        'cases_staff', (SELECT count(*) FROM cases c WHERE c.office_id = p_office_id AND c.staff_member_id = m.id
                          AND c.deleted_at IS NULL AND c.purged_at IS NULL AND c.closed_on IS NULL AND c.stage <> 'closed'),
        'leads_open', (SELECT count(*) FROM sales_leads s WHERE s.office_id = p_office_id AND s.assignee_user_id = m.user_id
                         AND s.deleted_at IS NULL AND s.status NOT IN ('converted', 'closed'))
      ) ORDER BY (m.role = 'owner') DESC, m.display_name)
      FROM office_members m WHERE m.office_id = p_office_id AND m.status = 'active'), '[]'::jsonb),
    'unassigned_cases', CASE WHEN v_cases THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'stage', c.stage, 'case_type', c.case_type,
               'stage_label', (SELECT d.office_label FROM case_stage_definitions d WHERE d.case_type = c.case_type AND d.code = c.stage),
               'created_at', c.created_at, 'missing', CASE WHEN c.lawyer_member_id IS NULL THEN 'lawyer' ELSE 'staff' END)
             ORDER BY c.created_at)
      FROM (SELECT * FROM cases c WHERE c.office_id = p_office_id AND c.deleted_at IS NULL AND c.purged_at IS NULL
              AND c.closed_on IS NULL AND c.stage <> 'closed' AND c.lawyer_member_id IS NULL
            ORDER BY c.created_at LIMIT 200) c), '[]'::jsonb) ELSE '[]'::jsonb END,
    'unassigned_leads', CASE WHEN v_leads THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', left(coalesce(s.data ->> 'name', ''), 40), 'status', s.status,
               'source', left(coalesce(s.data ->> 'source', ''), 40), 'created_at', s.created_at) ORDER BY s.created_at)
      FROM (SELECT * FROM sales_leads s WHERE s.office_id = p_office_id AND s.deleted_at IS NULL
              AND s.status NOT IN ('converted', 'closed') AND s.assignee_user_id IS NULL
            ORDER BY s.created_at LIMIT 200) s), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.office_assignment_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_assignment_overview(text) TO authenticated;

-- ── 일괄 배정 ── p_kind: 'case_lawyer' | 'case_staff' | 'lead'
CREATE OR REPLACE FUNCTION public.office_bulk_assign(p_office_id text, p_kind text, p_ids text[], p_member_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m office_members;
  n int := 0;
BEGIN
  IF p_kind NOT IN ('case_lawyer', 'case_staff', 'lead') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
  IF coalesce(cardinality(p_ids), 0) = 0 OR cardinality(p_ids) > 200 THEN RAISE EXCEPTION 'choose 1 to 200 items' USING ERRCODE = '22023'; END IF;
  IF p_kind LIKE 'case_%' AND public.office_permission_scope(p_office_id, 'case.assign') <> 'all' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'lead' AND public.office_permission_scope(p_office_id, 'sales.manage') <> 'all' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM office_members WHERE id = p_member_id AND office_id = p_office_id AND status = 'active';
  IF m.id IS NULL THEN RAISE EXCEPTION 'member not active in this office' USING ERRCODE = '22023'; END IF;
  IF p_kind = 'case_lawyer' AND m.role NOT IN ('owner', 'lawyer') THEN
    RAISE EXCEPTION 'lawyer must be an active lawyer of this office' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'case_lawyer' THEN
    UPDATE cases SET lawyer_member_id = m.id, version = version + 1, updated_at = now(), updated_by = auth.uid()
     WHERE office_id = p_office_id AND id::text = ANY (p_ids) AND deleted_at IS NULL AND purged_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF p_kind = 'case_staff' THEN
    UPDATE cases SET staff_member_id = m.id, version = version + 1, updated_at = now(), updated_by = auth.uid()
     WHERE office_id = p_office_id AND id::text = ANY (p_ids) AND deleted_at IS NULL AND purged_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    IF m.user_id IS NULL THEN RAISE EXCEPTION 'member has no login' USING ERRCODE = '22023'; END IF;
    UPDATE sales_leads SET assignee_user_id = m.user_id, updated_at = now(), updated_by = auth.uid()
     WHERE office_id = p_office_id AND id = ANY (p_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  PERFORM public.office_log(p_office_id, 'assignment.bulk', 'member', m.id::text, jsonb_build_object('kind', p_kind, 'count', n));
  IF n > 0 AND m.user_id IS NOT NULL AND m.user_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.notify_user(m.user_id, 'office', p_office_id, 'assignment', CASE WHEN p_kind = 'lead' THEN '리드를 맡게 됐어요' ELSE '사건을 맡게 됐어요' END,
      format('%s건을 배정받았어요.', n), CASE WHEN p_kind = 'lead' THEN 'sales_lead' ELSE 'case' END, NULL, NULL);
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.office_bulk_assign(text, text, text[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_bulk_assign(text, text, text[], uuid) TO authenticated;

-- ── 한 사람의 업무를 다른 사람에게 (휴가·업무 조정, 퇴사는 office_member_offboard) ──
CREATE OR REPLACE FUNCTION public.office_transfer_work(p_office_id text, p_from uuid, p_to uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f office_members;
  t office_members;
  v_cl int := 0; v_cs int := 0; v_leads int := 0; v_queue int := 0;
BEGIN
  IF public.office_permission_scope(p_office_id, 'office.staff') <> 'all' THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO f FROM office_members WHERE id = p_from AND office_id = p_office_id;
  SELECT * INTO t FROM office_members WHERE id = p_to AND office_id = p_office_id AND status = 'active';
  IF f.id IS NULL OR t.id IS NULL OR f.id = t.id THEN RAISE EXCEPTION 'choose two different members' USING ERRCODE = '22023'; END IF;

  -- 변호사 자리는 변호사에게만 (직원에게 넘기면 비워 두고 미배정 목록에 나온다)
  UPDATE cases SET lawyer_member_id = CASE WHEN t.role IN ('owner', 'lawyer') THEN t.id END, version = version + 1, updated_at = now(), updated_by = auth.uid()
   WHERE office_id = p_office_id AND lawyer_member_id = f.id AND deleted_at IS NULL AND purged_at IS NULL AND closed_on IS NULL AND stage <> 'closed';
  GET DIAGNOSTICS v_cl = ROW_COUNT;
  UPDATE cases SET staff_member_id = t.id, version = version + 1, updated_at = now(), updated_by = auth.uid()
   WHERE office_id = p_office_id AND staff_member_id = f.id AND deleted_at IS NULL AND purged_at IS NULL AND closed_on IS NULL AND stage <> 'closed';
  GET DIAGNOSTICS v_cs = ROW_COUNT;
  IF f.user_id IS NOT NULL AND t.user_id IS NOT NULL THEN
    UPDATE sales_leads SET assignee_user_id = t.user_id, updated_at = now(), updated_by = auth.uid()
     WHERE office_id = p_office_id AND assignee_user_id = f.user_id AND deleted_at IS NULL AND status NOT IN ('converted', 'closed');
    GET DIAGNOSTICS v_leads = ROW_COUNT;
  END IF;
  UPDATE work_queue_overrides SET assignee_member_id = t.id, updated_at = now()
   WHERE office_id = p_office_id AND assignee_member_id = f.id;
  GET DIAGNOSTICS v_queue = ROW_COUNT;

  PERFORM public.office_log(p_office_id, 'assignment.transfer', 'member', f.id::text,
    jsonb_build_object('to', t.id, 'cases_lawyer', v_cl, 'cases_staff', v_cs, 'leads', v_leads, 'queue', v_queue, 'reason', left(p_reason, 200)));
  IF t.user_id IS NOT NULL AND t.user_id IS DISTINCT FROM auth.uid() AND (v_cl + v_cs + v_leads) > 0 THEN
    PERFORM public.notify_user(t.user_id, 'office', p_office_id, 'assignment', '업무를 넘겨받았어요',
      format('사건 %s건 · 리드 %s건을 넘겨받았어요.', v_cl + v_cs, v_leads), 'case', NULL, NULL);
  END IF;
  RETURN jsonb_build_object('cases_lawyer', v_cl, 'cases_staff', v_cs, 'leads', v_leads, 'queue', v_queue);
END;
$$;
REVOKE ALL ON FUNCTION public.office_transfer_work(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_transfer_work(text, uuid, uuid, text) TO authenticated;

-- 리드 담당자는 sales.manage(전체)만 바꾼다. 화면이 옛 사본(빈 담당자)으로 저장해도 자동 배정이 풀리지 않게
-- 권한 없는 사용자의 담당자 변경은 조용히 이전 값을 유지한다 (서버 함수는 SECURITY DEFINER라 해당 없음)
CREATE OR REPLACE FUNCTION public.trg_sales_lead_assignee_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id AND current_user IN ('anon', 'authenticated')
     AND public.office_permission_scope(NEW.office_id, 'sales.manage') <> 'all' THEN
    NEW.assignee_user_id := OLD.assignee_user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sales_lead_assignee_guard ON public.sales_leads;
CREATE TRIGGER trg_sales_lead_assignee_guard BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_lead_assignee_guard();
