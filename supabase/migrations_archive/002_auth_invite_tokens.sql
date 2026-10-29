-- ============================================================
-- [AUTH] 초대 토큰 및 직원 인증 마이그레이션
-- invite_tokens 테이블 생성 + staff_members 인증 필드 추가
-- ============================================================

-- ── 1. 초대 토큰 테이블 ──

CREATE TABLE IF NOT EXISTS invite_tokens (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'CONSULTANT',
  email       TEXT,                              -- 특정 이메일로 제한 (선택)
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  TEXT NOT NULL,                     -- 생성한 관리자 ID
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by     TEXT,                              -- 사용한 직원 ID
  used_at     TIMESTAMPTZ,
  is_used     BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens (token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_created ON invite_tokens (created_by, created_at DESC);

-- RLS 활성화
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_invite_tokens" ON invite_tokens;
CREATE POLICY "authenticated_manage_invite_tokens"
  ON invite_tokens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_invite_tokens" ON invite_tokens;
CREATE POLICY "anon_read_invite_tokens"
  ON invite_tokens FOR SELECT TO anon
  USING (true);

-- ── 2. staff_members 테이블 인증 필드 추가 ──

-- 인증 이메일 (로그인 ID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'auth_email'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN auth_email TEXT;
  END IF;
END $$;

-- 인증 방식 (email / google)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN auth_provider TEXT DEFAULT 'email';
  END IF;
END $$;

-- Supabase Auth user.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'supabase_user_id'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN supabase_user_id UUID;
  END IF;
END $$;

-- 기존 User 체계 연결 ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'linked_user_id'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN linked_user_id TEXT;
  END IF;
END $$;

-- 초대 시 사용된 토큰
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'invite_token'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN invite_token TEXT;
  END IF;
END $$;

-- 비밀번호 최종 변경 일시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'password_last_changed'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN password_last_changed TIMESTAMPTZ;
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_staff_auth_email ON staff_members (auth_email);
CREATE INDEX IF NOT EXISTS idx_staff_supabase_uid ON staff_members (supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_linked_user ON staff_members (linked_user_id);

-- ============================================================
-- 완료! 확인 쿼리:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'staff_members' ORDER BY ordinal_position;
-- ============================================================
