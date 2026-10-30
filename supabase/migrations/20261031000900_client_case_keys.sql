-- ============================================================
-- 직접 등록·이관 사건('case-<사건 ID>' 키)도 의뢰인이 '내 사건'에서 보고 서류를 낼 수 있게
-- 지금까지 의뢰인 쪽 판정은 '내 상담 요청인가'만 봐서, 연결 링크로 계정을 이은 사건은 서류를 낼 곳이 없었다.
-- 바꾼 것:
--  * client_owns_case_key(key): 내 상담 요청이거나, 연결된 사건('case-…')이면 true
--  * client_request_office: 'case-…' 키면 그 사건의 사무소
--  * case_files·저장소 의뢰인 읽기 정책, client_case_view가 위 판정을 쓴다
--  * my_cases: 사건 작업 공간 키·상담 요청 여부를 함께 돌려준다 (반환 칸이 바뀌어 DROP 후 재생성)
-- ============================================================

CREATE OR REPLACE FUNCTION public.client_owns_case_key(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.consult_requests r WHERE r.id = p_key AND r.client_id = auth.uid()::text)
    OR (p_key ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.is_case_client(substr(p_key, 6)::uuid))
  );
$$;
REVOKE ALL ON FUNCTION public.client_owns_case_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_owns_case_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_request_office(p_request_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.consult_requests%ROWTYPE;
  v_lawyer text;
  v_office text;
BEGIN
  -- 연결된 사건 키: 그 사건의 사무소
  IF p_request_id ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF NOT public.is_case_client(substr(p_request_id, 6)::uuid) THEN
      RETURN NULL;
    END IF;
    SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = substr(p_request_id, 6)::uuid AND c.deleted_at IS NULL;
    RETURN v_office;
  END IF;
  SELECT * INTO v_req FROM public.consult_requests WHERE id = p_request_id AND client_id = auth.uid()::text;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_lawyer := coalesce(
    CASE WHEN jsonb_typeof(to_jsonb(v_req.accepted_lawyer_ids)) = 'array' THEN to_jsonb(v_req.accepted_lawyer_ids) ->> 0 END,
    v_req.selected_lawyer_id,
    CASE WHEN jsonb_typeof(to_jsonb(v_req.selected_lawyer_ids)) = 'array' THEN to_jsonb(v_req.selected_lawyer_ids) ->> 0 END
  );
  IF v_lawyer IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT m.office_id INTO v_office FROM public.office_members m
  WHERE m.lawyer_id = v_lawyer AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC LIMIT 1;
  RETURN v_office;
END;
$$;

DROP POLICY IF EXISTS case_files_client_select ON public.case_files;
CREATE POLICY case_files_client_select ON public.case_files FOR SELECT TO authenticated
  USING (upload_source = 'client' AND deleted_at IS NULL AND public.client_owns_case_key(client_key));

DROP POLICY IF EXISTS case_files_obj_client_read ON storage.objects;
CREATE POLICY case_files_obj_client_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[3] = 'client'
         AND public.client_owns_case_key((storage.foldername(name))[2])
         AND NOT public.case_file_is_trashed(name));

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
BEGIN
  IF NOT public.client_owns_case_key(p_request_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_row FROM public.crm_clients WHERE client_id = p_request_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_ext := coalesce(v_row.extension_data, '{}'::jsonb);
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
    ), '[]'::jsonb)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.my_cases();
CREATE FUNCTION public.my_cases() RETURNS TABLE(case_id uuid, office_name text, case_type text, stage text, client_stage_label text,
  group_no integer, court_name text, case_number text, filed_on date, commenced_on date, creditors_meeting_on date,
  confirmed_on date, discharge_decided_on date, closed_on date, close_reason text, updated_at timestamptz,
  workspace_key text, has_consult_request boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, o.name, c.case_type, c.stage, d.client_label, d.group_no, c.court_name, c.case_number, c.filed_on,
         c.commenced_on, c.creditors_meeting_on, c.confirmed_on, c.discharge_decided_on, c.closed_on, c.close_reason, c.updated_at,
         coalesce(c.consult_request_id, 'case-' || c.id::text), c.consult_request_id IS NOT NULL
  FROM cases c
  JOIN office_clients oc ON oc.id = c.office_client_id
  JOIN offices o ON o.id = c.office_id
  JOIN case_stage_definitions d ON d.case_type = c.case_type AND d.code = c.stage
  WHERE oc.client_user_id = auth.uid() AND c.deleted_at IS NULL AND c.is_test = false
  ORDER BY c.updated_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_cases() TO authenticated;
