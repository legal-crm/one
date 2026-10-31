-- ============================================================
-- 오늘의 업무함 서버 함수 (HM-2·HM-3·HM-4)
-- 이전: 대시보드가 탭 세션 사본(loadCrmExtMap)만 읽어 새 탭·다른 기기에서 0건, 카드마다 정의가 달랐다.
-- 바꾼 것:
--  * office_work_queue(사무소): 원래 데이터(상담 자리·제안서 검토·계약·수납·서류·작성 요청·보정·일정·할 일·업무폰·광고)에서
--    할 일을 계산해 돌려준다(따로 저장하지 않음). 권한 범위 안의 것만(comm_can: 전체/배정/내 리드)
--  * 묶음: overdue(기한 지남)·today·tomorrow·week(이번 주 일요일까지)·later·waiting(공이 의뢰인에게)·review(검토 요청)
--  * work_queue_overrides: 사람이 누른 '미루기'·'넘기기'·'메모'만 저장 (원래 일이 끝나면 항목은 자연히 사라진다)
--  * office_work_counts: 카드·사이드바 배지가 같은 정의를 쓰도록 묶음·종류별 건수
-- 의뢰인 실명은 넣지 않는다(가명·사건 제목만)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.work_queue_overrides (
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 200),
  snooze_until timestamptz,
  snooze_reason text CHECK (snooze_reason IS NULL OR char_length(snooze_reason) <= 100),
  assignee_member_id uuid REFERENCES public.office_members(id) ON DELETE SET NULL,
  memo text CHECK (memo IS NULL OR char_length(memo) <= 300),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, item_key)
);
ALTER TABLE public.work_queue_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_queue_overrides FROM anon, authenticated;

-- 사건 키 → 가명(또는 사건 제목)·단계·담당 구성원
CREATE OR REPLACE FUNCTION public.work_case_info(p_office_id text, p_key text)
RETURNS TABLE (alias text, stage text, lawyer_member uuid, staff_member uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case uuid := public.crm_client_case_id(p_office_id, p_key);
  c cases;
BEGIN
  IF v_case IS NOT NULL THEN
    SELECT * INTO c FROM cases WHERE id = v_case;
    alias := coalesce((SELECT nullif(oc.display_name, '') FROM office_clients oc WHERE oc.id = c.office_client_id), nullif(c.title, ''));
    stage := c.stage; lawyer_member := c.lawyer_member_id; staff_member := c.staff_member_id;
  END IF;
  IF alias IS NULL AND p_key IS NOT NULL THEN
    alias := (SELECT r.client_name FROM consult_requests r WHERE r.id = p_key);
  END IF;
  alias := coalesce(alias, '의뢰인');
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.work_case_info(text, text) FROM PUBLIC, anon, authenticated;

-- (임시 표를 쓰므로 VOLATILE. 읽기만 한다)
CREATE OR REPLACE FUNCTION public.office_work_queue(p_office_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_now timestamptz := now();
  v_today date := public.seoul_today();
  v_week_end date;
  v_items jsonb := '[]'::jsonb;
  r record;
  ci record;
  s record;
  v_due timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_member.id IS NULL OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_week_end := v_today + (7 - extract(isodow FROM v_today)::int);

  CREATE TEMP TABLE IF NOT EXISTS _wq (
    item_key text, kind text, title text, case_key text, lead_id text, due_at timestamptz, due_basis text,
    owner_member uuid, waiting boolean, review boolean, perm text, link_type text, link_id text, priority int, count int
  ) ON COMMIT DROP;
  TRUNCATE _wq;

  -- 1. 새 상담 요청 응답 (응답 기한 2영업일)
  INSERT INTO _wq
  SELECT 'seat:' || l.request_id || ':' || l.lawyer_id, 'consult_response', '새 상담 요청에 답하기', l.request_id, NULL, l.respond_by, '응답 기한(2영업일)',
         m.id, false, false, 'consult.view', 'consult_request', l.request_id, 1, 1
  FROM consult_request_lawyers l JOIN office_members m ON m.lawyer_id = l.lawyer_id AND m.office_id = p_office_id AND m.status = 'active'
  WHERE l.status = 'requested';

  -- 2. 제안서 검토 요청 (변호사 전용)
  INSERT INTO _wq
  SELECT 'proposal_review:' || pr.id, 'proposal_review', '직원이 쓴 제안서 검토', pr.consult_request_id, NULL, public.add_business_days(pr.created_at, 1), '요청 후 1영업일',
         (SELECT m.id FROM office_members m WHERE m.office_id = p_office_id AND m.lawyer_id = pr.reviewer_lawyer_id AND m.status = 'active' LIMIT 1),
         false, true, 'proposal.send', 'proposal_review', pr.id::text, 1, 1
  FROM proposal_reviews pr WHERE pr.office_id = p_office_id AND pr.status = 'pending';

  -- 3. 계약 서명 대기 (공이 의뢰인에게)
  INSERT INTO _wq
  SELECT 'contract_sign:' || ec.id, 'contract_waiting', '의뢰인 계약 서명 대기', coalesce(ec.consult_request_id, ec.client_id), NULL, ec.updated_at + interval '3 days', '보낸 뒤 3일',
         NULL, true, false, 'contract.draft', 'case_contract', coalesce(ec.consult_request_id, ec.client_id), 3, 1
  FROM electronic_contracts ec
  WHERE ec.status IN ('pending_sign', 'client_review') AND public.contract_office_id(ec.assigned_lawyer_id) = p_office_id;

  -- 4. 수납: 기한 지남·3일 안 납부, 입금 알림 확인
  FOR r IN SELECT a.case_id, c.consult_request_id FROM fee_agreements a JOIN cases c ON c.id = a.case_id AND c.deleted_at IS NULL
           WHERE a.office_id = p_office_id AND a.is_current LOOP
    FOR s IN SELECT * FROM public.fee_installment_status_core(r.case_id) WHERE status <> 'paid' AND due_on <= v_today + 3 ORDER BY due_on LIMIT 1 LOOP
      INSERT INTO _wq VALUES ('fee:' || s.installment_id, CASE WHEN s.status = 'overdue' THEN 'fee_overdue' ELSE 'fee_due' END,
        CASE WHEN s.status = 'overdue' THEN '수임료 기한 지남 · ' ELSE '수임료 납부일 · ' END || s.label || ' ' || to_char(s.remaining_won, 'FM999,999,999') || '원',
        coalesce(r.consult_request_id, 'case-' || r.case_id::text), NULL, (s.due_on + 1)::timestamp AT TIME ZONE 'Asia/Seoul', '약정 납부일',
        NULL, false, false, 'fee.view', 'case_fees', coalesce(r.consult_request_id, 'case-' || r.case_id::text), 2, 1);
    END LOOP;
  END LOOP;
  INSERT INTO _wq
  SELECT 'fee_report:' || fr.case_id, 'fee_report', '의뢰인 입금 알림 확인', coalesce(c.consult_request_id, 'case-' || c.id::text), NULL,
         public.add_business_days(min(fr.created_at), 1), '알림 후 1영업일', NULL, false, false, 'fee.record', 'case_fees',
         coalesce(c.consult_request_id, 'case-' || c.id::text), 2, count(*)::int
  FROM fee_client_reports fr JOIN cases c ON c.id = fr.case_id
  WHERE fr.office_id = p_office_id AND fr.status = 'pending'
  GROUP BY fr.case_id, c.consult_request_id, c.id;

  -- 5. 의뢰인 제출 서류 확인
  INSERT INTO _wq
  SELECT 'docs:' || f.client_key, 'client_documents', '의뢰인 제출 서류 확인', f.client_key, NULL, public.add_business_days(min(f.created_at), 1), '제출 후 1영업일',
         NULL, false, false, 'documents.manage', 'case_documents', f.client_key, 2, count(*)::int
  FROM case_files f
  WHERE f.office_id = p_office_id AND f.upload_source = 'client' AND f.review_status = 'submitted' AND f.deleted_at IS NULL
  GROUP BY f.client_key;

  -- 6. 작성 요청: 답 확인 / 의뢰인 작성 대기
  INSERT INTO _wq
  SELECT 'form:' || fr.id, CASE WHEN fr.status = 'submitted' THEN 'form_review' ELSE 'form_waiting' END,
         CASE WHEN fr.status = 'submitted' THEN '의뢰인이 쓴 서식 확인 · ' ELSE '의뢰인 서식 작성 대기 · ' END || fr.title,
         fr.case_key, NULL,
         CASE WHEN fr.status = 'submitted' THEN public.add_business_days(fr.updated_at, 1)
              ELSE coalesce((fr.due_on + 1)::timestamp AT TIME ZONE 'Asia/Seoul', fr.requested_at + interval '7 days') END,
         CASE WHEN fr.status = 'submitted' THEN '제출 후 1영업일' ELSE '요청 마감일' END,
         NULL, fr.status <> 'submitted', false, 'documents.manage', 'case_forms', fr.case_key, 3, 1
  FROM client_form_requests fr
  WHERE fr.office_id = p_office_id AND fr.status IN ('requested', 'in_progress', 'needs_fix', 'submitted');

  -- 7. 보정: 회차 마감, 의뢰인 답 확인, 의뢰인 회신 대기, 연장 결정 확인
  INSERT INTO _wq
  SELECT 'correction:' || o.id, CASE WHEN o.status = 'extension' THEN 'correction_extension' ELSE 'correction_due' END,
         CASE WHEN o.status = 'extension' THEN '보정기간 연장 결정 확인 · ' || o.round || '차' ELSE '보정 마감 · ' || o.round || '차' END,
         o.case_key, NULL,
         CASE WHEN o.status = 'extension' THEN ((coalesce(o.extension_requested_on, v_today) + 7) + 1)::timestamp AT TIME ZONE 'Asia/Seoul'
              ELSE (coalesce(o.office_due, o.court_due, o.fixed_due) + 1)::timestamp AT TIME ZONE 'Asia/Seoul' END,
         CASE WHEN o.status = 'extension' THEN '연장 신청 후 7일'
              ELSE '사무소 마감' || CASE WHEN o.court_due IS NOT NULL THEN ' (법원 기한 ' || to_char(o.court_due, 'MM.DD') || ')' ELSE '' END END,
         NULL, false, false, 'correction.manage', 'case_correction', o.case_key, 1, 1
  FROM correction_orders o
  WHERE o.office_id = p_office_id AND o.status <> 'submitted' AND coalesce(o.office_due, o.court_due, o.fixed_due) IS NOT NULL;

  INSERT INTO _wq
  SELECT 'correction_reply:' || i.order_id, 'correction_reply', '보정 항목 의뢰인 답 확인', i.case_key, NULL,
         public.add_business_days(min(i.client_submitted_at), 2), '답 받은 뒤 2영업일',
         NULL, false, false, 'correction.manage', 'case_correction', i.case_key, 2, count(*)::int
  FROM correction_items i
  WHERE i.office_id = p_office_id AND i.status IN ('submitted', 'cannot_submit') AND i.client_submitted_at IS NOT NULL
  GROUP BY i.order_id, i.case_key;

  INSERT INTO _wq
  SELECT 'correction_waiting:' || i.order_id, 'correction_waiting', '보정 항목 의뢰인 회신 대기', i.case_key, NULL,
         (coalesce(min(o.office_due), v_today + 7) + 1)::timestamp AT TIME ZONE 'Asia/Seoul', '사무소 마감',
         NULL, true, false, 'correction.manage', 'case_correction', i.case_key, 3, count(*)::int
  FROM correction_items i JOIN correction_orders o ON o.id = i.order_id AND o.status <> 'submitted'
  WHERE i.office_id = p_office_id AND i.status IN ('requested', 'in_progress', 'needs_fix') AND i.owner IN ('client', 'both')
  GROUP BY i.order_id, i.case_key;

  -- 8. 이번 주 일정 (서버 일정표, 7일 안)
  INSERT INTO _wq
  SELECT 'event:' || e.id, 'schedule', coalesce(nullif(e.title, ''), '일정'), nullif(e.client_id, ''), NULL,
         CASE WHEN e.time ~ '^\d{1,2}:\d{2}' THEN (e.date || ' ' || e.time)::timestamp AT TIME ZONE 'Asia/Seoul'
              ELSE (e.date::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul' END,
         CASE WHEN e.time ~ '^\d{1,2}:\d{2}' THEN '일정 시각' ELSE '종일 일정' END,
         (SELECT m.id FROM office_members m WHERE m.office_id = p_office_id AND (m.id::text = e.assigned_staff_id OR m.user_id::text = e.assigned_staff_id) LIMIT 1),
         false, false, CASE WHEN nullif(e.client_id, '') IS NULL THEN NULL ELSE 'case.view' END, 'schedule', e.id, 2, 1
  FROM calendar_events e
  WHERE e.tenant_id = p_office_id AND e.date ~ '^\d{4}-\d{2}-\d{2}$' AND e.date::date BETWEEN v_today AND v_today + 7;

  -- 9. 할 일 (나에게 온 것·내가 맡긴 것)
  INSERT INTO _wq
  SELECT 'task:' || t.id, 'task', t.title, CASE WHEN t.target_type IN ('case', 'client') THEN t.target_id END, t.lead_id,
         CASE WHEN t.due_date IS NULL THEN NULL ELSE (t.due_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul' END, '할 일 마감',
         (SELECT m.id FROM office_members m WHERE m.office_id = p_office_id AND (m.id::text = t.assignee_id OR m.user_id::text = t.assignee_id OR m.lawyer_id = t.assignee_id) LIMIT 1),
         false, coalesce(t.requires_approval, false) AND t.status = 'review', NULL, 'tasks', t.id::text,
         CASE WHEN t.priority IN ('high', 'urgent') THEN 1 ELSE 3 END, 1
  FROM task_tickets t
  WHERE t.tenant_id = p_office_id AND coalesce(t.status, '') NOT IN ('done', 'completed', 'cancelled', 'approved', 'rejected')
    AND (t.assignee_id IN (auth.uid()::text, v_member.id::text, coalesce(v_member.lawyer_id, '-'))
         OR t.assigner_id IN (auth.uid()::text, v_member.id::text, coalesce(v_member.lawyer_id, '-'))
         OR public.office_permission_scope(p_office_id, 'case.view') = 'all');

  -- 10. 업무폰: 기기 승인 대기·번호 등록 요청·올리지 못한 녹음
  INSERT INTO _wq
  SELECT 'device:' || d.id, 'device_pending', '업무폰 기기 승인 대기 · ' || coalesce(nullif(d.label, ''), d.model, '휴대폰'), NULL, NULL, d.paired_at, '연결 요청',
         NULL, false, true, 'office.staff', 'office_phone', d.id::text, 2, 1
  FROM office_devices d WHERE d.office_id = p_office_id AND d.status = 'pending';
  INSERT INTO _wq
  SELECT 'device_register', 'device_register', '업무폰 번호 등록 요청 확인', NULL, NULL, public.add_business_days(min(q.created_at), 1), '다음 근무일',
         NULL, false, false, 'comm.view', 'office_phone', NULL, 3, count(*)::int
  FROM device_register_requests q WHERE q.office_id = p_office_id AND q.status = 'open'
  HAVING count(*) > 0;
  INSERT INTO _wq
  SELECT 'recording_failed', 'recording_failed', '올리지 못한 통화 녹음 확인', NULL, NULL, min(c.created_at) + interval '1 day', '1일',
         NULL, false, false, 'comm.recording', 'office_phone', NULL, 3, count(*)::int
  FROM call_recordings c WHERE c.office_id = p_office_id AND c.status IN ('failed', 'mismatch') AND c.deleted_at IS NULL
  HAVING count(*) > 0;

  -- 11. 광고 만료 임박 (7일)
  INSERT INTO _wq
  SELECT 'ad_expiring:' || a.id, 'ad_expiring', '광고 노출 끝남 임박 · ' || coalesce(a.product_name, '광고'), NULL, NULL,
         (a.ends_on + 1)::timestamp AT TIME ZONE 'Asia/Seoul', '노출 마지막 날', NULL, false, false, 'ads.manage', 'ads', a.id, 4, 1
  FROM ad_orders a WHERE a.office_id = p_office_id AND a.status = 'active' AND a.ends_on BETWEEN v_today AND v_today + 7;

  -- 묶음·권한·사람이 누른 설정 반영
  FOR r IN
    SELECT q.*, o.snooze_until, o.assignee_member_id AS over_member, o.memo
    FROM _wq q LEFT JOIN work_queue_overrides o ON o.office_id = p_office_id AND o.item_key = q.item_key
    WHERE (o.snooze_until IS NULL OR o.snooze_until <= v_now)
      AND (q.perm IS NULL OR public.comm_can(p_office_id, q.perm, q.case_key, q.lead_id, NULL))
    ORDER BY q.due_at NULLS LAST, q.priority
    LIMIT 300
  LOOP
    SELECT * INTO ci FROM public.work_case_info(p_office_id, r.case_key);
    v_due := r.due_at;
    v_items := v_items || jsonb_build_object(
      'key', r.item_key, 'kind', r.kind, 'title', r.title, 'count', r.count,
      'case_key', r.case_key, 'lead_id', r.lead_id,
      'alias', CASE WHEN r.case_key IS NULL THEN NULL ELSE ci.alias END,
      'stage', CASE WHEN r.case_key IS NULL THEN NULL ELSE ci.stage END,
      'due_at', v_due, 'due_basis', r.due_basis,
      'assignee_member_id', coalesce(r.over_member, r.owner_member,
        CASE WHEN r.kind IN ('client_documents', 'form_review', 'form_waiting', 'correction_reply', 'correction_waiting') THEN coalesce(ci.staff_member, ci.lawyer_member) ELSE ci.lawyer_member END),
      'memo', r.memo,
      'group', CASE
        WHEN r.review THEN 'review'
        WHEN r.waiting THEN 'waiting'
        WHEN v_due IS NULL THEN 'later'
        WHEN v_due < v_now THEN 'overdue'
        WHEN (v_due - interval '1 second') AT TIME ZONE 'Asia/Seoul' < (v_today + 1)::timestamp THEN 'today'
        WHEN (v_due - interval '1 second') AT TIME ZONE 'Asia/Seoul' < (v_today + 2)::timestamp THEN 'tomorrow'
        WHEN (v_due - interval '1 second') AT TIME ZONE 'Asia/Seoul' < (v_week_end + 1)::timestamp THEN 'week'
        ELSE 'later' END,
      'link_type', r.link_type, 'link_id', r.link_id, 'priority', r.priority);
  END LOOP;
  RETURN v_items;
END;
$$;
REVOKE ALL ON FUNCTION public.office_work_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_work_queue(text) TO authenticated;

-- 미루기·넘기기·메모 (빈 값이면 그 설정을 지움)
CREATE OR REPLACE FUNCTION public.set_work_queue_override(
  p_office_id text, p_item_key text, p_snooze_until timestamptz, p_snooze_reason text, p_assignee_member_id uuid, p_memo text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member office_members := public.current_office_member(p_office_id);
BEGIN
  IF v_member.id IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_item_key), '') = '' THEN RAISE EXCEPTION 'item key required' USING ERRCODE = '22023'; END IF;
  IF p_snooze_until IS NOT NULL AND (p_snooze_until < now() OR p_snooze_until > now() + interval '60 days') THEN
    RAISE EXCEPTION 'invalid snooze time' USING ERRCODE = '22023';
  END IF;
  IF p_assignee_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM office_members m WHERE m.id = p_assignee_member_id AND m.office_id = p_office_id AND m.status = 'active') THEN
    RAISE EXCEPTION 'member not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_snooze_until IS NULL AND p_assignee_member_id IS NULL AND nullif(btrim(coalesce(p_memo, '')), '') IS NULL THEN
    DELETE FROM work_queue_overrides WHERE office_id = p_office_id AND item_key = p_item_key;
    RETURN;
  END IF;
  INSERT INTO work_queue_overrides (office_id, item_key, snooze_until, snooze_reason, assignee_member_id, memo, updated_by, updated_at)
  VALUES (p_office_id, left(p_item_key, 200), p_snooze_until, nullif(left(btrim(coalesce(p_snooze_reason, '')), 100), ''), p_assignee_member_id,
          nullif(left(btrim(coalesce(p_memo, '')), 300), ''), auth.uid(), now())
  ON CONFLICT (office_id, item_key) DO UPDATE SET snooze_until = EXCLUDED.snooze_until, snooze_reason = EXCLUDED.snooze_reason,
    assignee_member_id = EXCLUDED.assignee_member_id, memo = EXCLUDED.memo, updated_by = auth.uid(), updated_at = now();
  IF p_assignee_member_id IS NOT NULL THEN
    PERFORM public.notify_user((SELECT user_id FROM office_members WHERE id = p_assignee_member_id), 'office', p_office_id, 'work_handover',
      '업무를 넘겨받았어요', '오늘의 업무함에서 확인해 주세요.', 'work_queue', p_item_key, 'handover:' || p_item_key);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_work_queue_override(text, text, timestamptz, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_work_queue_override(text, text, timestamptz, text, uuid, text) TO authenticated;

-- 오래된 설정 정리 (항목이 사라진 지 오래된 미루기·넘기기)
CREATE OR REPLACE FUNCTION public.purge_work_queue_overrides()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM work_queue_overrides WHERE updated_at < now() - interval '90 days' RETURNING 1) SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.purge_work_queue_overrides() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_work_queue_overrides';
    PERFORM cron.schedule('mykim_purge_work_queue_overrides', '50 18 * * *', 'SELECT public.purge_work_queue_overrides()');
  END IF;
END $$;
