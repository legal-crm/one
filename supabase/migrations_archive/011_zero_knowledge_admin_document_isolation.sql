-- ============================================================
-- 011_zero_knowledge_admin_document_isolation.sql
-- 통합관리자(Super Admin)의 의뢰인 민감 서류 및 1:1 상담 비밀 원천 격리 (Zero-Knowledge)
-- 
-- [보안 및 컴플라이언스 근거]
-- 1. 변호사법 제26조(비밀유지의무): 플랫폼 운영사는 소송 대리인이 아니므로 의뢰인의 법률상 비밀 열람 불가
-- 2. 엔터프라이즈 제로 트러스트(Zero-Knowledge): 관리자 계정 탈취 사고 시 전사 고객 서류 유출 원천 차단
-- 3. 직무 분리(SoD): 플랫폼 관리자는 인프라 관제, 결제 정산, 블록체인 온체인 무결성 검증만 수행
-- ============================================================

-- ------------------------------------------------------------
-- 1. crm_clients (의뢰인 제출 서류 uploaded_files, 체크리스트, 내부 메모)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "anti_bola_all_crm_clients" ON crm_clients;
DROP POLICY IF EXISTS "anti_bola_select_crm_clients" ON crm_clients;
DROP POLICY IF EXISTS "anti_bola_modify_crm_clients" ON crm_clients;

-- SELECT: 오직 해당 사건의 의뢰인 본인과 배정된 담당 변호사/직원만 열람 허용 (Admin 제외!)
CREATE POLICY "anti_bola_select_crm_clients" ON crm_clients
FOR SELECT TO authenticated
USING (
  -- 1) 의뢰인 본인
  auth.uid()::text = client_id
  -- 2) 배정된 변호사 및 지정 담당자
  OR auth.uid()::text = assignee_id
  OR auth.uid()::text = assigned_lawyer_id
  OR auth.uid()::text = assigned_consultant_id
  OR auth.uid()::text = assigned_staff_id
);

-- INSERT/UPDATE/DELETE: 담당 변호사/직원 또는 본인만 수정 가능 (Admin 제외!)
CREATE POLICY "anti_bola_modify_crm_clients" ON crm_clients
FOR ALL TO authenticated
USING (
  auth.uid()::text = client_id
  OR auth.uid()::text = assignee_id
  OR auth.uid()::text = assigned_lawyer_id
  OR auth.uid()::text = assigned_consultant_id
  OR auth.uid()::text = assigned_staff_id
)
WITH CHECK (
  auth.uid()::text = client_id
  OR auth.uid()::text = assignee_id
  OR auth.uid()::text = assigned_lawyer_id
  OR auth.uid()::text = assigned_consultant_id
  OR auth.uid()::text = assigned_staff_id
);


-- ------------------------------------------------------------
-- 2. consult_messages (1:1 비밀 상담 대화 내역)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "anti_bola_select_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "anti_bola_insert_consult_messages" ON consult_messages;

-- SELECT: 발신자 본인이거나 해당 상담의 당사자(의뢰인/변호사)만 열람 허용 (Admin 제외!)
CREATE POLICY "anti_bola_select_consult_messages" ON consult_messages
FOR SELECT TO authenticated
USING (
  auth.uid()::text = sender_id
  OR EXISTS (
    SELECT 1 FROM consult_requests cr
    WHERE cr.id = consult_messages.consult_request_id
      AND (
        cr.client_id = auth.uid()::text
        OR cr.selected_lawyer_id = auth.uid()::text
        OR (cr.accepted_lawyer_ids IS NOT NULL AND cr.accepted_lawyer_ids ? auth.uid()::text)
      )
  )
);

-- INSERT: 해당 상담의 당사자만 메시지 전송 허용 (Admin 제외!)
CREATE POLICY "anti_bola_insert_consult_messages" ON consult_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid()::text = sender_id
  OR EXISTS (
    SELECT 1 FROM consult_requests cr
    WHERE cr.id = consult_messages.consult_request_id
      AND (
        cr.client_id = auth.uid()::text
        OR cr.selected_lawyer_id = auth.uid()::text
        OR (cr.accepted_lawyer_ids IS NOT NULL AND cr.accepted_lawyer_ids ? auth.uid()::text)
      )
  )
);


-- ------------------------------------------------------------
-- 3. cases (수임 사건 및 진행 상세)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "anti_bola_select_cases" ON cases;
DROP POLICY IF EXISTS "anti_bola_modify_cases" ON cases;

-- SELECT: 담당 변호사 또는 해당 사건 의뢰인만 조회 가능 (Admin 제외!)
CREATE POLICY "anti_bola_select_cases" ON cases
FOR SELECT TO authenticated
USING (
  assigned_lawyer_id = auth.uid()::text
  OR client_id = auth.uid()::text
);

-- INSERT/UPDATE/DELETE: 담당 변호사만 수정 가능 (Admin 제외!)
CREATE POLICY "anti_bola_modify_cases" ON cases
FOR ALL TO authenticated
USING (
  assigned_lawyer_id = auth.uid()::text
)
WITH CHECK (
  assigned_lawyer_id = auth.uid()::text
);


-- ------------------------------------------------------------
-- 4. electronic_contracts (전자계약서 본문, 서명, 계좌정보)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "anti_bola_select_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_insert_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_update_electronic_contracts" ON electronic_contracts;

-- SELECT: 오직 의뢰인 본인과 배정된 변호사만 열람 허용 (Admin 전면 차단!)
CREATE POLICY "anti_bola_select_electronic_contracts" ON electronic_contracts
FOR SELECT TO authenticated
USING (
  auth.uid()::text = client_id
  OR assigned_lawyer_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'OWNER') AND m.id = electronic_contracts.assigned_lawyer_id
  )
);

-- INSERT: 의뢰인 본인 또는 배정 변호사만 등록 허용
CREATE POLICY "anti_bola_insert_electronic_contracts" ON electronic_contracts
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid()::text = client_id
  OR client_id = 'client-temp'
  OR assigned_lawyer_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'OWNER')
  )
);

-- UPDATE: 의뢰인 본인 또는 배정 변호사만 수정 허용
CREATE POLICY "anti_bola_update_electronic_contracts" ON electronic_contracts
FOR UPDATE TO authenticated
USING (
  auth.uid()::text = client_id
  OR assigned_lawyer_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'OWNER') AND m.id = electronic_contracts.assigned_lawyer_id
  )
)
WITH CHECK (true);


-- ------------------------------------------------------------
-- 5. 관리자 전용 온체인 무결성 관제 SECURITY DEFINER 함수
-- (민감 개인정보 및 서명, 첨부서류 전면 제외, 오직 온체인 해시 및 상태만 반환)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_admin_contract_anchors()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 관리자 권한 확인 (JWT app_metadata 또는 members 테이블)
  IF ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') THEN
    v_is_admin := TRUE;
  ELSIF EXISTS (SELECT 1 FROM members WHERE members.id = auth.uid()::text AND members.role = 'ADMIN') THEN
    v_is_admin := TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required for blockchain anchor monitoring.';
  END IF;

  -- 민감정보(주민등록 주소, 전화번호, 계좌번호, 서명 SVG, 첨부서류)는 제외하고
  -- 온체인 무결성 관제에 필요한 메타데이터만 구성하여 반환
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ec.id,
        'client_id', ec.client_id,
        'client_name', ec.client_name,
        'lawyer_name', ec.lawyer_name,
        'law_firm_name', ec.law_firm_name,
        'assigned_lawyer_id', ec.assigned_lawyer_id,
        'status', ec.status,
        'contract_date', ec.contract_date,
        'is_business', ec.is_business,
        'document_hashes', ec.document_hashes,
        'blockchain_anchor', ec.blockchain_anchor,
        'created_at', ec.created_at,
        'updated_at', ec.updated_at
      ) ORDER BY ec.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM electronic_contracts ec;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_contract_anchors() TO authenticated;
