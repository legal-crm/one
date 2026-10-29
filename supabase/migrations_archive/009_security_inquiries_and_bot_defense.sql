-- ============================================================
-- 009_security_inquiries_and_bot_defense.sql
-- 1. client_inquiries (1:1 고객 문의) 익명 열람(SELECT) 전면 차단
-- 2. lawyer_inquiries (변호사 입점 문의) 권한 격리
-- ============================================================

-- 1. client_inquiries
ALTER TABLE client_inquiries ENABLE ROW LEVEL SECURITY;

-- 익명 누구나 다른 고객의 1:1 문의를 열람할 수 있던 구멍 제거
DROP POLICY IF EXISTS "allow_anon_all_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "anon_select_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "anon_insert_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "authenticated_all_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "anti_bola_select_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "anti_bola_insert_client_inquiries" ON client_inquiries;
DROP POLICY IF EXISTS "anti_bola_modify_client_inquiries" ON client_inquiries;

-- 익명 사용자: 문의 등록(INSERT)만 허용 (SELECT 불가)
CREATE POLICY "anti_bola_insert_client_inquiries" ON client_inquiries
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 조회(SELECT): 변호사, 직원, 관리자만 조회 가능 (익명 고객 덤프 차단)
CREATE POLICY "anti_bola_select_client_inquiries" ON client_inquiries
FOR SELECT TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'LAWYER', 'STAFF', 'OWNER')
  )
);

CREATE POLICY "anti_bola_modify_client_inquiries" ON client_inquiries
FOR ALL TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'OWNER')
  )
)
WITH CHECK (true);


-- 2. lawyer_inquiries
ALTER TABLE lawyer_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_all_lawyer_inquiries" ON lawyer_inquiries;
DROP POLICY IF EXISTS "anon_select_lawyer_inquiries" ON lawyer_inquiries;
DROP POLICY IF EXISTS "anon_insert_lawyer_inquiries" ON lawyer_inquiries;
DROP POLICY IF EXISTS "authenticated_all_lawyer_inquiries" ON lawyer_inquiries;
DROP POLICY IF EXISTS "anti_bola_select_lawyer_inquiries" ON lawyer_inquiries;
DROP POLICY IF EXISTS "anti_bola_insert_lawyer_inquiries" ON lawyer_inquiries;

-- 익명/신규 변호사: 입점 신청(INSERT)만 허용
CREATE POLICY "anti_bola_insert_lawyer_inquiries" ON lawyer_inquiries
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 조회: 최고 관리자만 조회 가능
CREATE POLICY "anti_bola_select_lawyer_inquiries" ON lawyer_inquiries
FOR SELECT TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (
    SELECT 1 FROM members m 
    WHERE m.id = auth.uid()::text AND m.role IN ('ADMIN', 'OWNER')
  )
);
