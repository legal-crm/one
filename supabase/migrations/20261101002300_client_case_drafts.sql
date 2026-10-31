-- ============================================================
-- 의뢰인이 직접 쓴 서류 초안을 사무소 사건 기록으로 보내기 (X·S 연동)
-- 문제: 진술서·재산목록(D5102)·수입지출(D5103)·통장 소명표·생활 변화 알림을 의뢰인 화면이
--       crm_clients에 직접 썼는데, crm_clients는 사무소 권한(case.edit)만 쓸 수 있어 늘 실패했다.
--       (화면은 "이 기기에 저장됐지만 서버 전송 실패"를 띄웠고 사무소에는 아무것도 가지 않았다)
-- 바꾼 것:
--  * client_submit_case_draft(key, kind, payload): 내 사건(상담 요청 또는 연결된 사건)일 때만,
--    정해진 칸 5개 중 하나만 extension_data에 넣는다. 다른 칸(메모·상태·수납 등)은 건드릴 수 없다
--  * 주민번호 형식 거절, 400KB 한도, 정지 계정 거절
--  * 사무소 서류 담당(documents.manage)에게 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.client_submit_case_draft(p_key text, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field text;
  v_label text;
  v_office text;
  v_text text;
  v_case uuid;
  v_value jsonb;
  v_prev jsonb;
  v_row public.crm_clients;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'login required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account suspended' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF coalesce(p_key, '') = '' OR NOT public.client_owns_case_key(p_key) THEN
    RAISE EXCEPTION 'not your case' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_field := CASE p_kind
    WHEN 'statement' THEN 'courtStatement'
    WHEN 'property' THEN 'propertyListD5102'
    WHEN 'income_expense' THEN 'incomeExpenseD5103'
    WHEN 'bank_audit' THEN 'bankStatementAudit'
    WHEN 'life_change' THEN 'lifeCrisisReports'
  END;
  v_label := CASE p_kind
    WHEN 'statement' THEN '진술서'
    WHEN 'property' THEN '재산목록 기초자료'
    WHEN 'income_expense' THEN '수입·지출 내역'
    WHEN 'bank_audit' THEN '금융거래 사용처 소명표'
    WHEN 'life_change' THEN '생활 변화 알림'
  END;
  IF v_field IS NULL THEN
    RAISE EXCEPTION 'unknown kind' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be object' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_text := p_payload::text;
  IF length(v_text) > 400000 THEN
    RAISE EXCEPTION 'payload too large' USING ERRCODE = 'program_limit_exceeded';
  END IF;
  IF v_text ~ '[0-9]{6}-?[1-4][0-9]{6}' THEN
    RAISE EXCEPTION 'resident number not allowed' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_office := public.client_request_office(p_key);
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'no office for this case' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_row FROM public.crm_clients WHERE client_id = p_key FOR UPDATE;
  IF v_row.client_id IS NOT NULL AND v_row.office_id IS DISTINCT FROM v_office THEN
    RAISE EXCEPTION 'case belongs to another office' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- 변호사가 이미 확인한 서류는 의뢰인이 덮어쓰지 못한다 (고칠 일이 있으면 사무소에 요청)
  IF (v_field = 'courtStatement' AND v_row.extension_data -> v_field ->> 'status' = 'lawyer_reviewed')
     OR (v_field = 'propertyListD5102' AND v_row.extension_data -> v_field ->> 'clientIntakeStatus' = 'reviewed_by_lawyer')
     OR (v_field = 'incomeExpenseD5103' AND v_row.extension_data -> v_field ->> 'd5103ClientStatus' = 'lawyer_reviewed') THEN
    RAISE EXCEPTION 'already reviewed by office' USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  IF v_field = 'lifeCrisisReports' THEN
    v_prev := coalesce(v_row.extension_data -> v_field, '[]'::jsonb);
    IF jsonb_typeof(v_prev) <> 'array' THEN v_prev := '[]'::jsonb; END IF;
    SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_value
    FROM (SELECT e FROM jsonb_array_elements(jsonb_build_array(p_payload) || v_prev) WITH ORDINALITY AS t(e, n) ORDER BY n LIMIT 20) s;
  ELSE
    v_value := p_payload;
  END IF;

  IF v_row.client_id IS NULL THEN
    INSERT INTO public.crm_clients (client_id, office_id, crm_status, extension_data, documents, notes, activities, fee_schedule, last_activity_at, updated_at)
    VALUES (p_key, v_office, 'requested', jsonb_build_object(v_field, v_value), '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now(), now());
  ELSE
    UPDATE public.crm_clients
       SET extension_data = coalesce(extension_data, '{}'::jsonb) || jsonb_build_object(v_field, v_value),
           last_activity_at = now(),
           version = version + 1,
           updated_at = now()
     WHERE client_id = p_key;
  END IF;

  v_case := CASE WHEN p_key ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN substr(p_key, 6)::uuid
                 ELSE public.crm_client_case_id(v_office, p_key) END;
  BEGIN
    PERFORM public.notify_office_members(v_office, 'documents.manage', v_case, 'client_draft_submitted',
      '의뢰인이 ' || v_label || '을(를) 보냈어요', '사건 화면에서 확인해 주세요.',
      'case_documents', p_key, 'client_draft:' || p_key || ':' || p_kind);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'client draft notify failed: %', SQLERRM;
  END;
  RETURN jsonb_build_object('ok', true, 'field', v_field);
END;
$$;
REVOKE ALL ON FUNCTION public.client_submit_case_draft(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_submit_case_draft(text, text, jsonb) TO authenticated;
