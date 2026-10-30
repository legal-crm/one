-- ============================================================================
-- 묶음 2-직원. 사무소 직원의 상담 요청 처리 (RB-1)
-- - 직원(승인된 변호사 계정이 아님)은 사무소에 온 상담 요청의 '상태'만 바꿀 수 있음 (상담 채팅 권한 범위)
-- - 제안서 추가·수락·선택·연락처 수정은 승인된 변호사 본인만 (🔒 proposal.send, 제109조 취지)
-- - 10-30 시험에서 발견: lawyer_can_view_request 가 created_by_lawyer_id 가 비어 있으면 false 대신 NULL을 돌려
--   기존 함수의 `IF NOT lawyer_can_view_request(...)` 검사를 건너뛰었음 → 승인된 변호사라면 누구나
--   다른 사무소 상담 요청의 상태를 바꿀 수 있었음. NULL 이 나오지 않게 고침.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT coalesce(p_lawyer_id IS NOT NULL AND (
       cr.selected_lawyer_id IS NOT DISTINCT FROM p_lawyer_id
    OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR coalesce(cr.selected_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR cr.created_by_lawyer_id IS NOT DISTINCT FROM p_lawyer_id
  ), false);
$$;

-- 같은 NULL 문제: 계약 전인데 created_by_lawyer_id 가 비어 있으면 NULL → 연락처 수정 검사를 건너뜀
CREATE OR REPLACE FUNCTION public.lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(p_lawyer_id IS NOT NULL AND (
       cr.created_by_lawyer_id IS NOT DISTINCT FROM p_lawyer_id
    OR EXISTS (
         SELECT 1 FROM electronic_contracts ec
         WHERE ec.assigned_lawyer_id = p_lawyer_id
           AND ec.status IN ('signed', 'completed')
           AND (ec.client_id = cr.id OR ec.client_id = cr.client_id)
       )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lid  text := public.current_approved_lawyer_id();
  v_row  consult_requests%ROWTYPE;
  v_prop jsonb;
  v_status text;
  v_is_lawyer boolean;
BEGIN
  SELECT * INTO v_row FROM consult_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  v_is_lawyer := coalesce(v_lid IS NOT NULL AND public.lawyer_can_view_request(v_row, v_lid), false);

  IF NOT v_is_lawyer THEN
    -- 사무소 직원: 상담 채팅 권한이 있는 구성원은 상태만
    IF public.request_viewer_lawyer_id(v_row, 'consult.chat') IS NULL THEN
      RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
    END IF;
    IF p_patch ?| ARRAY['proposal', 'accept_self', 'select_self', 'client_name', 'phone'] THEN
      RAISE EXCEPTION 'only the requested lawyer can send proposals or edit contact fields' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_patch ? 'proposal' THEN
    v_prop := p_patch -> 'proposal';
    IF jsonb_typeof(v_prop) <> 'object' OR (v_prop ->> 'lawyerId') IS DISTINCT FROM v_lid OR coalesce(v_prop ->> 'id', '') = '' THEN
      RAISE EXCEPTION 'proposal must belong to the calling lawyer' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_row.proposals, '[]'::jsonb)) e
      WHERE e ->> 'id' = v_prop ->> 'id' AND (e ->> 'lawyerId') IS DISTINCT FROM v_lid
    ) THEN
      RAISE EXCEPTION 'proposal id collision' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET proposals = coalesce((
             SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(proposals, '[]'::jsonb)) e
             WHERE e ->> 'id' IS DISTINCT FROM v_prop ->> 'id'
           ), '[]'::jsonb) || jsonb_build_array(v_prop)
     WHERE id = p_id;
  END IF;
  IF coalesce((p_patch ->> 'accept_self')::boolean, false) THEN
    UPDATE consult_requests
       SET accepted_lawyer_ids = CASE
             WHEN coalesce(accepted_lawyer_ids, '[]'::jsonb) ? v_lid THEN accepted_lawyer_ids
             ELSE coalesce(accepted_lawyer_ids, '[]'::jsonb) || to_jsonb(v_lid)
           END
     WHERE id = p_id;
  END IF;
  IF coalesce((p_patch ->> 'select_self')::boolean, false) THEN
    IF v_row.selected_lawyer_id IS NOT NULL AND v_row.selected_lawyer_id <> v_lid THEN
      RAISE EXCEPTION 'request already assigned to another lawyer' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests SET selected_lawyer_id = v_lid WHERE id = p_id;
  END IF;
  IF p_patch ? 'status' THEN
    v_status := p_patch ->> 'status';
    IF v_status NOT IN ('responding', 'counseling', 'comparing', 'contracted', 'document') THEN
      RAISE EXCEPTION 'status not allowed: %', v_status USING ERRCODE = '22023';
    END IF;
    UPDATE consult_requests SET status = v_status WHERE id = p_id;
  END IF;
  IF (p_patch ? 'client_name' OR p_patch ? 'phone') THEN
    IF NOT public.lawyer_can_see_contact(v_row, v_lid) THEN
      RAISE EXCEPTION 'contact fields are editable only after contract' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET client_name = coalesce(p_patch ->> 'client_name', client_name),
           phone       = coalesce(p_patch ->> 'phone', phone)
     WHERE id = p_id;
  END IF;
  UPDATE consult_requests SET updated_at = NOW() WHERE id = p_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
