-- ============================================================
-- MY-1 의뢰인 '내 사건' 화면용 사건 요약 (읽기 전용)
-- crm_clients는 사무소 전용(20261031000100)이라 의뢰인이 직접 읽을 수 없다.
-- 본인 상담 요청이면 진행 상태·서류 체크리스트·서류 요청·계약 금액만 골라 돌려준다.
-- 사무소 내부 메모(notes·activities·reviewerNote·checkedBy·requestedBy)는 내보내지 않는다.
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
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.consult_requests r WHERE r.id = p_request_id AND r.client_id = auth.uid()::text
  ) THEN
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
REVOKE ALL ON FUNCTION public.client_case_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_case_view(text) TO authenticated;
