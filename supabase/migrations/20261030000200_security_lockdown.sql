-- ============================================================================
-- 묶음 2-보안. 열려 있던 '누구나 전체 권한' 정책 삭제 + 상담 요청·메시지·계약을 사무소 기준으로
-- ----------------------------------------------------------------------------
-- 2026-10-30 운영 DB 점검에서 발견: 아래 정책이 남아 있어 익명 키만으로 모든 상담 요청(이름·전화·재무 정보)·
-- 메시지·전자계약(주소·서명)·변호사 행을 읽고 바꾸고 지울 수 있었음. 허용 정책은 OR로 합쳐지므로
-- 012·008의 엄격한 정책이 사실상 무력화돼 있었음.
--   consult_requests : allow_all_consult_requests, anon_insert_consult_request, public_select/update/delete_consult_request
--   consult_messages : allow_all_consult_messages, anon_insert_consult_message, public_select/update/delete_consult_message
--   electronic_contracts : allow_anon_all_electronic_contracts
--   alimtok_logs : allow_anon_all_alimtok_logs
--   lawyers : allow_anon_all_lawyers (읽기는 공개 프로필용으로 따로 남김)
-- 앱 경로 확인: 의뢰인 = 로그인 후 본인 행(012), 변호사 = consult_requests_for_lawyers 뷰 + lawyer_* RPC,
-- 원격 서명 = /api/contract(서버 키) + get_contract_by_remote_token RPC. 익명 직접 쓰기 경로 없음.
-- 같이 바꿈:
--   - 공개 요청 폐지(10-24 결정): lawyer_can_view_request 의 'open' 조건 삭제
--   - 사무소 직원도 상담 요청·메시지를 권한만큼(RB-1): request_viewer_lawyer_id
--   - 전자계약을 사무소 기준으로 읽고 쓰기 (지금 정책은 members 테이블(0건)·auth.uid()=변호사ID 비교라 서버 저장이 안 됐음)
--   - diagnosis_results 로그인 사용자 전체 읽기 → 관리자만
-- ============================================================================

DROP POLICY IF EXISTS allow_all_consult_requests ON public.consult_requests;
DROP POLICY IF EXISTS anon_insert_consult_request ON public.consult_requests;
DROP POLICY IF EXISTS public_select_consult_request ON public.consult_requests;
DROP POLICY IF EXISTS public_update_consult_request ON public.consult_requests;
DROP POLICY IF EXISTS public_delete_consult_request ON public.consult_requests;

DROP POLICY IF EXISTS allow_all_consult_messages ON public.consult_messages;
DROP POLICY IF EXISTS anon_insert_consult_message ON public.consult_messages;
DROP POLICY IF EXISTS public_select_consult_message ON public.consult_messages;
DROP POLICY IF EXISTS public_update_consult_message ON public.consult_messages;
DROP POLICY IF EXISTS public_delete_consult_message ON public.consult_messages;

DROP POLICY IF EXISTS allow_anon_all_electronic_contracts ON public.electronic_contracts;
DROP POLICY IF EXISTS allow_anon_all_alimtok_logs ON public.alimtok_logs;
DROP POLICY IF EXISTS allow_anon_all_lawyers ON public.lawyers;
CREATE POLICY lawyers_public_select ON public.lawyers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_select_diagnosis ON public.diagnosis_results;
CREATE POLICY diagnosis_results_admin_select ON public.diagnosis_results FOR SELECT TO authenticated USING (public.is_platform_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.consult_requests, public.consult_messages, public.electronic_contracts,
                public.alimtok_logs, public.lawyers FROM anon;

-- ── 공개 요청 폐지 ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT p_lawyer_id IS NOT NULL AND (
       cr.selected_lawyer_id = p_lawyer_id
    OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR coalesce(cr.selected_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR cr.created_by_lawyer_id = p_lawyer_id
  );
$$;

-- ── 이 요청을 '어느 변호사 자격으로' 보는지 (본인 → 내 사무소 변호사 순) ──────
CREATE FUNCTION public.request_viewer_lawyer_id(cr public.consult_requests, p_permission text DEFAULT 'consult.view') RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me text := public.current_approved_lawyer_id();
  v_lid text;
  v_office text;
  v_scope text;
BEGIN
  IF v_me IS NOT NULL AND public.lawyer_can_view_request(cr, v_me) THEN RETURN v_me; END IF;
  FOR v_office, v_lid IN
    SELECT m.office_id, m.lawyer_id FROM office_members m
    WHERE m.office_id = ANY (public.current_office_ids()) AND m.status = 'active' AND m.lawyer_id IS NOT NULL
      AND public.lawyer_can_view_request(cr, m.lawyer_id)
  LOOP
    v_scope := public.office_permission_scope(v_office, p_permission);
    IF v_scope = 'all' THEN RETURN v_lid; END IF;
    IF v_scope = 'assigned' AND EXISTS (
         SELECT 1 FROM cases c WHERE c.office_id = v_office AND c.consult_request_id = cr.id AND c.deleted_at IS NULL
           AND public.is_case_assignee(c.id)) THEN
      RETURN v_lid;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.request_viewer_lawyer_id(public.consult_requests, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_viewer_lawyer_id(public.consult_requests, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.consult_requests_for_lawyers WITH (security_barrier='true') AS
 SELECT cr.id,
    cr.client_id,
        CASE
            WHEN public.lawyer_can_see_contact(cr.*, me.lid) THEN cr.client_name
            WHEN (POSITION(('_'::text) IN (cr.client_name)) > 0) THEN split_part(cr.client_name, '_'::text, 2)
            ELSE cr.client_name
        END AS client_name,
        CASE
            WHEN public.lawyer_can_see_contact(cr.*, me.lid) THEN cr.phone
            WHEN (COALESCE(cr.phone, ''::text) = ''::text) THEN ''::text
            ELSE '010-****-****'::text
        END AS phone,
    public.lawyer_can_see_contact(cr.*, me.lid) AS contact_visible,
    cr.request_type,
    cr.max_participants,
    cr.status,
    cr.selected_lawyer_id,
    cr.selected_lawyer_ids,
    cr.accepted_lawyer_ids,
    cr.rejection_notified,
    cr.proposals,
    cr.title,
    cr.content,
    cr.financial_profile,
    cr.phone_consultation_requested,
    cr.safe_number,
    cr.safe_number_assigned_at,
    cr.safe_number_expires_at,
    cr.entry_category,
    cr.created_by_lawyer_id,
    cr.created_at,
    cr.updated_at
   FROM (public.consult_requests cr
     CROSS JOIN LATERAL ( SELECT public.request_viewer_lawyer_id(cr.*, 'consult.view') AS lid) me)
  WHERE (me.lid IS NOT NULL AND (NOT cr.admin_hidden));

-- 메시지: 의뢰인 본인 / 요청받은 변호사 본인 / 그 변호사 사무소에서 상담 채팅 권한이 있는 구성원
CREATE OR REPLACE FUNCTION public.can_access_consult_request(p_request_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM consult_requests cr
    WHERE cr.id = p_request_id
      AND (
           cr.client_id = auth.uid()::text
        OR public.request_viewer_lawyer_id(cr, 'consult.chat') IS NOT NULL
      )
  );
$$;

-- ── 전자계약: 담당 변호사의 사무소 구성원(계약 권한) + 의뢰인 본인 ──────────────
CREATE FUNCTION public.can_manage_lawyer_contract(p_assigned_lawyer_id text, p_need_all boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_assigned_lawyer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM office_members m
    WHERE m.lawyer_id = p_assigned_lawyer_id AND m.status = 'active'
      AND m.office_id = ANY (public.current_office_ids())
      AND (CASE WHEN p_need_all THEN public.office_permission_scope(m.office_id, 'contract.draft') = 'all'
                ELSE public.office_permission_scope(m.office_id, 'contract.draft') <> 'none' END));
$$;
REVOKE ALL ON FUNCTION public.can_manage_lawyer_contract(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_lawyer_contract(text, boolean) TO authenticated, service_role;

CREATE POLICY contracts_office_select ON public.electronic_contracts FOR SELECT TO authenticated
  USING (public.can_manage_lawyer_contract(assigned_lawyer_id));
CREATE POLICY contracts_office_insert ON public.electronic_contracts FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_lawyer_contract(assigned_lawyer_id));
CREATE POLICY contracts_office_update ON public.electronic_contracts FOR UPDATE TO authenticated
  USING (public.can_manage_lawyer_contract(assigned_lawyer_id))
  WITH CHECK (public.can_manage_lawyer_contract(assigned_lawyer_id));
CREATE POLICY contracts_office_delete ON public.electronic_contracts FOR DELETE TO authenticated
  USING (public.can_manage_lawyer_contract(assigned_lawyer_id, true));

-- 기존 anti_bola 계약 UPDATE 정책의 WITH CHECK(true) 정리: 의뢰인 본인 행만 그대로 유지
DROP POLICY IF EXISTS anti_bola_update_electronic_contracts ON public.electronic_contracts;
CREATE POLICY contracts_client_update ON public.electronic_contracts FOR UPDATE TO authenticated
  USING ((auth.uid())::text = client_id) WITH CHECK ((auth.uid())::text = client_id);

NOTIFY pgrst, 'reload schema';
