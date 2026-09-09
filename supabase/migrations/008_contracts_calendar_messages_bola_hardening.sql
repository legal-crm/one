-- ============================================================
-- 008_contracts_calendar_messages_bola_hardening.sql
-- "모두의 창업" 개인정보 유출 사고(Over-fetching 및 소유권 검증 누락) 대응
-- 1. electronic_contracts: 전체 덤프 방어, 소유자/변호사 격리 RLS, 원격 서명 보안 RPC
-- 2. calendar_events: 개인 비공개 일정(personal) DB 레벨 격리
-- 3. internal_messages: 변호사 전용/지정 비밀 메시지 인가 검증
-- 4. crm_clients: CRM 재정/상담 확장 데이터 RLS 격리
-- ============================================================

-- ============================================================
-- 1. electronic_contracts (전자계약서 - 실명, 주소, 수임료, 서명)
-- ============================================================
ALTER TABLE electronic_contracts ENABLE ROW LEVEL SECURITY;

-- 기존의 느슨했던 정책 제거
DROP POLICY IF EXISTS "allow_anon_all_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "authenticated_all_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_select_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_insert_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_update_electronic_contracts" ON electronic_contracts;
DROP POLICY IF EXISTS "anti_bola_delete_electronic_contracts" ON electronic_contracts;

-- SELECT: 의뢰인 본인, 배정 변호사, 또는 로펌 관계자(변호사/직원/관리자)만 조회 가능
-- 일반 회원이 타인의 계약서를 덤프(SELECT *)하는 행위 원천 차단
CREATE POLICY "anti_bola_select_electronic_contracts" ON electronic_contracts
FOR SELECT TO authenticated
USING (
  -- 1) 의뢰인 본인 (auth.uid 일치)
  auth.uid()::text = client_id
  -- 2) 배정된 변호사
  OR assigned_lawyer_id = auth.uid()::text
  -- 3) 최고 관리자 권한 (app_metadata 또는 members 테이블 확인)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'LAWYER', 'STAFF', 'OWNER')
  )
);

-- INSERT: 인가된 로펌 관계자 또는 본인 서명 생성
CREATE POLICY "anti_bola_insert_electronic_contracts" ON electronic_contracts
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid()::text = client_id
  OR client_id = 'client-temp'
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'LAWYER', 'STAFF', 'OWNER')
  )
);

-- UPDATE: 의뢰인 본인(서명 완료), 배정 변호사, 관리자만 수정 가능
CREATE POLICY "anti_bola_update_electronic_contracts" ON electronic_contracts
FOR UPDATE TO authenticated
USING (
  auth.uid()::text = client_id
  OR assigned_lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'LAWYER', 'STAFF', 'OWNER')
  )
)
WITH CHECK (true);

-- DELETE: 관리자 또는 로펌 오너만 삭제 가능
CREATE POLICY "anti_bola_delete_electronic_contracts" ON electronic_contracts
FOR DELETE TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'OWNER')
  )
);


-- ── 비로그인 외부 고객을 위한 원격 서명 보안 RPC ──
-- 외부 고객은 카카오톡 알림톡/문자 링크(cid + token)로 접근하므로,
-- DB 전체 조회 권한을 열지 않고 정확한 (id + remote_sign_token) 쌍이 일치할 때만
-- 단 1건의 계약서만 반환하는 SECURITY DEFINER 함수를 사용합니다.
CREATE OR REPLACE FUNCTION get_contract_by_remote_token(p_contract_id TEXT, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract JSONB;
BEGIN
  IF p_contract_id IS NULL OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(ec.*) INTO v_contract
  FROM electronic_contracts ec
  WHERE ec.id = p_contract_id
    AND ec.remote_sign_token = p_token;

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION get_contract_by_remote_token(TEXT, TEXT) TO anon, authenticated;


-- ============================================================
-- 2. calendar_events (일정 및 기일 - 비공개 메모 및 의뢰인 정보)
-- ============================================================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_all_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "authenticated_all_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "anti_bola_select_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "anti_bola_modify_calendar_events" ON calendar_events;

-- SELECT: 비공개 개인 일정(personal)은 등록자 본인과 관리자만 열람
-- 전체 공유(firm)는 로펌 직원 모두, 변호사 전용(lawyers)은 변호사/오너만 조회
CREATE POLICY "anti_bola_select_calendar_events" ON calendar_events
FOR SELECT TO authenticated
USING (
  -- 1) 일정 등록자/담당자 본인
  assigned_staff_id = auth.uid()::text
  -- 2) 관리자
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  -- 3) 전체 공유 일정 (JSON data->>'visibility'가 'firm'이거나 미지정)
  OR (COALESCE(data->>'visibility', 'firm') = 'firm')
  -- 4) 변호사 전용 일정인 경우 변호사/오너만 허용
  OR (
    (data->>'visibility' = 'lawyers')
    AND EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'OWNER')
    )
  )
);

-- INSERT/UPDATE/DELETE: 로펌 관계자만 가능
CREATE POLICY "anti_bola_modify_calendar_events" ON calendar_events
FOR ALL TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'STAFF', 'OWNER')
  )
)
WITH CHECK (true);


-- ============================================================
-- 3. internal_messages (사건별 내부 비밀 스레드)
-- ============================================================
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_tenant_isolation" ON internal_messages;
DROP POLICY IF EXISTS "anti_bola_select_internal_messages" ON internal_messages;
DROP POLICY IF EXISTS "anti_bola_modify_internal_messages" ON internal_messages;

-- SELECT: 메시지 열람 권한 검증을 DB 엔진에서 직접 강제
CREATE POLICY "anti_bola_select_internal_messages" ON internal_messages
FOR SELECT TO authenticated
USING (
  -- 1) 작성자 본인
  author_id = auth.uid()::text
  -- 2) 최고 관리자
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  -- 3) 전체 직원 공개 메시지
  OR (visibility = 'all_staff')
  -- 4) 변호사 전용 메시지
  OR (
    visibility = 'lawyers_only'
    AND EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'OWNER')
    )
  )
  -- 5) 특정인 지정 메시지
  OR (
    visibility = 'designated'
    AND auth.uid()::text = ANY(designated_user_ids)
  )
);

CREATE POLICY "anti_bola_modify_internal_messages" ON internal_messages
FOR ALL TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'STAFF', 'OWNER')
  )
)
WITH CHECK (true);


-- ============================================================
-- 4. crm_clients (CRM 고객 확장 데이터 - 수임료, 문서, 내부 메모)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_clients (
  client_id TEXT PRIMARY KEY,
  crm_status TEXT DEFAULT 'requested',
  assignee_id TEXT,
  assigned_lawyer_id TEXT,
  assigned_consultant_id TEXT,
  assigned_staff_id TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  activities JSONB DEFAULT '[]'::jsonb,
  contract_date TEXT,
  contract_amount NUMERIC DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  intake_channel TEXT DEFAULT 'mykim',
  intake_channel_detail TEXT,
  is_external_client BOOLEAN DEFAULT false,
  total_fee NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  fee_schedule JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anti_bola_all_crm_clients" ON crm_clients;

-- CRM 데이터는 일반 고객은 절대 접근 불가! 오직 로펌 관계자(변호사/직원/관리자)만 허용
CREATE POLICY "anti_bola_all_crm_clients" ON crm_clients
FOR ALL TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'STAFF', 'OWNER')
  )
)
WITH CHECK (true);
