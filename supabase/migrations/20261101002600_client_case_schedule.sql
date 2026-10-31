-- ============================================================
-- CM-11 의뢰인 '다음 일정': 채권자집회 날짜·장소와 다가오는 법원 일정을 의뢰인 화면에 준다
-- 문제: 의뢰인 '채권자집회 안내'는 법원 이름·사건번호만 받아 늘 '기일 지정 대기중'으로 보였다.
--       사무소가 적은 집회 일시·법정(postCommencementPlan.meetingPlan)과 사건 기록(cases.creditors_meeting_on)은
--       의뢰인이 읽을 길이 없었다(crm_clients는 사무소 전용).
-- 바꾼 것: client_case_view 반환에 'schedule'(법원·사건번호·집회 일시·장소·다가오는 법원 일정 5건) 추가.
--          일정은 날짜·종류·제목만(사무소 메모·상세 없음).
-- ============================================================
CREATE OR REPLACE FUNCTION public.client_case_view(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.crm_clients%ROWTYPE;
  v_ext jsonb;
  v_cc jsonb;
  v_mp jsonb;
  v_case public.cases%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF NOT public.client_owns_case_key(p_request_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_row FROM public.crm_clients WHERE client_id = p_request_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_ext := coalesce(v_row.extension_data, '{}'::jsonb);
  v_cc := CASE WHEN jsonb_typeof(v_ext -> 'courtCase') = 'object' THEN v_ext -> 'courtCase' ELSE '{}'::jsonb END;
  v_mp := CASE WHEN jsonb_typeof(v_ext #> '{postCommencementPlan,meetingPlan}') = 'object' THEN v_ext #> '{postCommencementPlan,meetingPlan}' ELSE '{}'::jsonb END;
  IF p_request_id ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_case FROM public.cases WHERE id = substr(p_request_id, 6)::uuid AND deleted_at IS NULL;
  ELSE
    SELECT * INTO v_case FROM public.cases WHERE consult_request_id = p_request_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'crmStatus', v_row.crm_status,
    'contractDate', v_row.contract_date,
    'totalFee', v_row.total_fee,
    'dischargeRequestedAt', v_ext -> 'dischargeRequestedAt',
    'documents', coalesce((
      SELECT jsonb_agg(d - 'reviewerNote' - 'checkedBy')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_row.documents) = 'array' THEN v_row.documents ELSE '[]'::jsonb END) d
    ), '[]'::jsonb),
    'documentRequests', coalesce((
      SELECT jsonb_agg(q - 'requestedBy')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_ext -> 'documentRequests') = 'array' THEN v_ext -> 'documentRequests' ELSE '[]'::jsonb END) q
    ), '[]'::jsonb),
    'schedule', jsonb_build_object(
      'courtName', coalesce(nullif(v_case.court_name, ''), nullif(v_cc ->> 'courtName', '')),
      'caseNumber', coalesce(nullif(v_case.case_number, ''), nullif(v_cc ->> 'caseNumber', '')),
      'meetingDate', coalesce(nullif(v_mp ->> 'meetingDate', ''), nullif(v_cc ->> 'creditorMeetingDate', ''), v_case.creditors_meeting_on::text),
      'meetingPlace', left(nullif(v_mp ->> 'meetingPlace', ''), 80),
      'upcoming', coalesce((
        SELECT jsonb_agg(jsonb_build_object('date', e ->> 'date', 'type', e ->> 'type', 'title', left(e ->> 'title', 60)) ORDER BY e ->> 'date')
        FROM (
          SELECT e FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_cc -> 'events') = 'array' THEN v_cc -> 'events' ELSE '[]'::jsonb END) e
          WHERE (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}' AND left(e ->> 'date', 10)::date >= v_today
          ORDER BY e ->> 'date' LIMIT 5
        ) s
      ), '[]'::jsonb)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.client_case_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_case_view(text) TO authenticated;
