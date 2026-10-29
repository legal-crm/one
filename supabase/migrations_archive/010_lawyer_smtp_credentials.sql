-- 010_lawyer_smtp_credentials.sql
-- 로펌/변호사 자체 Gmail SMTP 발송 계정 및 인증 정보의 안전한 DB 격리
-- 일반 사용자(anon) 접근 원천 차단 및 소유 변호사/관리자 전용 RLS 적용

CREATE TABLE IF NOT EXISTS lawyer_smtp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id TEXT NOT NULL UNIQUE,
  sender_gmail TEXT NOT NULL,
  encrypted_app_password TEXT NOT NULL,
  recipient_emails JSONB DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE lawyer_smtp_credentials ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "lawyer_smtp_select_policy" ON lawyer_smtp_credentials;
DROP POLICY IF EXISTS "lawyer_smtp_insert_policy" ON lawyer_smtp_credentials;
DROP POLICY IF EXISTS "lawyer_smtp_update_policy" ON lawyer_smtp_credentials;
DROP POLICY IF EXISTS "lawyer_smtp_delete_policy" ON lawyer_smtp_credentials;

-- SELECT: 본인 변호사이거나 최고 관리자만 조회 가능 (익명 anon 전면 차단)
CREATE POLICY "lawyer_smtp_select_policy" ON lawyer_smtp_credentials
FOR SELECT TO authenticated
USING (
  lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR EXISTS (SELECT 1 FROM members WHERE members.id = auth.uid()::text AND members.role = 'ADMIN')
);

-- INSERT / UPDATE: 본인 변호사 또는 최고 관리자만 등록/수정 가능
CREATE POLICY "lawyer_smtp_insert_policy" ON lawyer_smtp_credentials
FOR INSERT TO authenticated
WITH CHECK (
  lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

CREATE POLICY "lawyer_smtp_update_policy" ON lawyer_smtp_credentials
FOR UPDATE TO authenticated
USING (
  lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
)
WITH CHECK (true);

-- DELETE: 본인 변호사 또는 최고 관리자만 삭제 가능
CREATE POLICY "lawyer_smtp_delete_policy" ON lawyer_smtp_credentials
FOR DELETE TO authenticated
USING (
  lawyer_id = auth.uid()::text
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);
