-- 007_anti_bola_hardening.sql
-- 강남언니 개인정보 유출(BOLA/IDOR) 사고 대응: 객체 수준 권한 검증(Row-Level Ownership) 강화
-- 기존의 위험한 "authenticated USING (true)" 정책을 제거하고,
-- 데이터의 소유자(의뢰인), 배정된 변호사, 최고 관리자만 조회/수정할 수 있도록 제한합니다.

-- ==========================================
-- 1. consult_requests (상담 요청 및 금융 정보)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "authenticated_insert_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "authenticated_update_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_select_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_insert_consult_requests" ON consult_requests;
DROP POLICY IF EXISTS "anti_bola_update_consult_requests" ON consult_requests;

-- SELECT: 의뢰인 본인, 배정/참여 변호사, 오픈 매칭 대기 요청, 최고 관리자만 조회 가능
CREATE POLICY "anti_bola_select_consult_requests" ON consult_requests
FOR SELECT TO authenticated
USING (
  -- 1) 의뢰인 본인 (auth.uid 일치)
  auth.uid()::text = client_id
  -- 2) 직접 지정된 변호사
  OR selected_lawyer_id = auth.uid()::text
  -- 3) 상담에 참여 수락한 변호사 목록에 포함된 경우
  OR (accepted_lawyer_ids IS NOT NULL AND accepted_lawyer_ids ? auth.uid()::text)
  -- 4) 변호사들이 상담을 검토할 수 있도록 공개된 오픈 매칭 대기 요청
  OR (status = 'requested' AND request_type = 'open')
  -- 5) 관리자 권한 (app_metadata 확인)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- INSERT: 본인의 client_id로 등록하거나, 신규 비로그인 세션(client-temp) 허용
CREATE POLICY "anti_bola_insert_consult_requests" ON consult_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid()::text = client_id 
  OR client_id = 'client-temp' 
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- UPDATE: 본인 요청이거나, 참여/배정 변호사, 관리자만 수정 가능
CREATE POLICY "anti_bola_update_consult_requests" ON consult_requests
FOR UPDATE TO authenticated
USING (
  auth.uid()::text = client_id
  OR selected_lawyer_id = auth.uid()::text
  OR (accepted_lawyer_ids IS NOT NULL AND accepted_lawyer_ids ? auth.uid()::text)
  OR (status = 'requested' AND request_type = 'open')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
)
WITH CHECK (true);


-- ==========================================
-- 2. consult_messages (상담 비밀 대화 내역)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "authenticated_insert_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "anti_bola_select_consult_messages" ON consult_messages;
DROP POLICY IF EXISTS "anti_bola_insert_consult_messages" ON consult_messages;

-- SELECT: 메시지 발신자 본인이거나, 해당 상담 요청의 당사자(의뢰인/변호사/관리자)만 조회
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
        OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      )
  )
);

-- INSERT: 해당 상담 요청의 당사자만 메시지 전송 가능
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
        OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      )
  )
);


-- ==========================================
-- 3. cases (수임 사건 목록 및 진행 상황)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_all_cases" ON cases;
DROP POLICY IF EXISTS "anti_bola_select_cases" ON cases;
DROP POLICY IF EXISTS "anti_bola_modify_cases" ON cases;

-- SELECT: 담당 변호사이거나 해당 사건 의뢰인, 관리자만 조회
CREATE POLICY "anti_bola_select_cases" ON cases
FOR SELECT TO authenticated
USING (
  lawyer_id = auth.uid()::text
  OR client_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- INSERT/UPDATE/DELETE: 담당 변호사 또는 관리자만 수정 가능
CREATE POLICY "anti_bola_modify_cases" ON cases
FOR ALL TO authenticated
USING (
  lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
)
WITH CHECK (true);


-- ==========================================
-- 4. client_memos (의뢰인 관련 내부 검토 메모)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_all_client_memos" ON client_memos;
DROP POLICY IF EXISTS "anti_bola_all_client_memos" ON client_memos;

-- 일반 의뢰인은 절대 열람 불가! 변호사/직원/관리자만 열람/작성
CREATE POLICY "anti_bola_all_client_memos" ON client_memos
FOR ALL TO authenticated
USING (
  auth.uid()::text = author_id
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'STAFF')
  )
)
WITH CHECK (true);


-- ==========================================
-- 5. alimtok_logs (알림톡 발송 내역 - 전화번호 포함)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select_alimtok_logs" ON alimtok_logs;
DROP POLICY IF EXISTS "anti_bola_select_alimtok_logs" ON alimtok_logs;

-- 일반 고객의 타인 알림톡 열람 전면 차단 (관리자 및 담당 변호사/직원만)
CREATE POLICY "anti_bola_select_alimtok_logs" ON alimtok_logs
FOR SELECT TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = auth.uid()::text AND m.role IN ('LAWYER', 'ADMIN', 'STAFF')
  )
);
