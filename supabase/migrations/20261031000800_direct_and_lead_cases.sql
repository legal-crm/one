-- ============================================================
-- CM·SL: 상담 요청 없는 사건(직접 등록·영업 리드 이관)을 서버 사건으로
-- 문제: 외부 의뢰인 등록·영업 리드 이관이 화면 메모리에만 가짜 상담 요청을 만들어, 새로고침·다른 기기에서 사건이 사라졌다.
-- 바꾼 것:
--  * 사건 작업 공간 키: 상담 요청 사건 = 상담 요청 ID, 그 밖의 사건 = 'case-' || 사건 ID
--    crm_client_case_id가 두 키를 모두 사건으로 풀어 crm_clients·case_files 권한('담당' 범위)이 그대로 맞는다
--  * cases.sales_lead_id: uuid → text (sales_leads.id가 text)
--  * create_case: sales_lead_id를 글자 그대로 저장
--  * convert_sales_lead_to_case: 리드 확인(권한·중복 이관) → create_case → 리드 '이관 완료' 표시를 한 번에
-- ============================================================

ALTER TABLE public.cases ALTER COLUMN sales_lead_id TYPE text USING sales_lead_id::text;
CREATE UNIQUE INDEX IF NOT EXISTS cases_office_sales_lead_uq ON public.cases (office_id, sales_lead_id)
  WHERE sales_lead_id IS NOT NULL AND deleted_at IS NULL;

-- create_case 본문에서 ::uuid 변환 한 곳만 바꾼다 (나머지 본문은 그대로)
DO $$
DECLARE
  d text := pg_get_functiondef('public.create_case(text, jsonb)'::regprocedure);
  n text;
BEGIN
  n := replace(d, 'nullif(p->>''sales_lead_id'', '''')::uuid', 'left(nullif(p->>''sales_lead_id'', ''''), 80)');
  IF n = d THEN
    RAISE EXCEPTION 'create_case: sales_lead_id cast not found';
  END IF;
  EXECUTE n;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_client_case_id(p_office_id text, p_client_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.cases c
  WHERE c.office_id = p_office_id AND c.deleted_at IS NULL
    AND (c.consult_request_id = p_client_id
         OR (p_client_id ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             AND c.id = substr(p_client_id, 6)::uuid))
  LIMIT 1;
$$;

-- 영업 리드 → 사건 이관
-- p: case_type, title, office_client_id(같은 번호 의뢰인과 묶을 때), display_name(비우면 리드 이름)
CREATE OR REPLACE FUNCTION public.convert_sales_lead_to_case(p_lead_id text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.sales_leads%ROWTYPE;
  v_case public.cases;
  v_name text;
BEGIN
  SELECT * INTO v_lead FROM public.sales_leads WHERE id = p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.can_see_sales_lead(v_lead.office_id, v_lead.assignee_user_id, v_lead.created_by) THEN
    RAISE EXCEPTION 'lead not found' USING ERRCODE = 'P0002';
  END IF;
  IF public.office_permission_scope(v_lead.office_id, 'sales.convert') = 'none' THEN
    RAISE EXCEPTION 'permission denied: sales.convert' USING ERRCODE = '42501';
  END IF;
  IF v_lead.status = 'converted'
     OR EXISTS (SELECT 1 FROM public.cases c WHERE c.office_id = v_lead.office_id AND c.sales_lead_id = v_lead.id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'lead already converted' USING ERRCODE = '23505';
  END IF;

  v_name := left(btrim(coalesce(nullif(p->>'display_name', ''), v_lead.data->>'customerName', '')), 50);
  v_case := public.create_case(v_lead.office_id, jsonb_strip_nulls(jsonb_build_object(
    'case_type', coalesce(nullif(p->>'case_type', ''), 'rehab'),
    'source', 'sales_lead',
    'sales_lead_id', v_lead.id,
    'display_name', v_name,
    'real_name', nullif(v_name, ''),
    'phone', v_lead.data->>'phone',
    'title', left(coalesce(p->>'title', ''), 100),
    'office_client_id', nullif(p->>'office_client_id', '')
  )));

  UPDATE public.sales_leads
  SET data = data || jsonb_build_object(
        'status', 'converted',
        'convertedClientId', 'case-' || v_case.id::text,
        'convertedCaseId', v_case.id::text,
        'convertedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  WHERE id = v_lead.id;

  RETURN jsonb_build_object('case_id', v_case.id, 'workspace_key', 'case-' || v_case.id::text, 'office_client_id', v_case.office_client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.convert_sales_lead_to_case(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_sales_lead_to_case(text, jsonb) TO authenticated;
