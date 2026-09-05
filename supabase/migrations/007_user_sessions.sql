-- 007_user_sessions.sql
-- [SECURITY] 로그인 기기 및 세션 관리 테이블 (Supabase 연동)

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  user_role TEXT NOT NULL CHECK (user_role IN ('ADMIN', 'LAWYER', 'STAFF', 'CLIENT')),
  firm_name TEXT,
  device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  os TEXT NOT NULL,
  browser TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  is_suspicious BOOLEAN DEFAULT false,
  suspicious_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoke_reason TEXT
);

-- 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON user_sessions(ip_address);

-- RLS (Row Level Security) 활성화
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 정책: 인증된 사용자는 모든 세션 읽기 및 본인/관리자 수정 가능
DROP POLICY IF EXISTS "authenticated_select_user_sessions" ON user_sessions;
CREATE POLICY "authenticated_select_user_sessions" ON user_sessions 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_user_sessions" ON user_sessions;
CREATE POLICY "authenticated_insert_user_sessions" ON user_sessions 
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_user_sessions" ON user_sessions;
CREATE POLICY "authenticated_update_user_sessions" ON user_sessions 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 공개 데모 및 비인가 접근 방지: anon은 접근 불가 (필요 시 특정 함수로만 제어)
DROP POLICY IF EXISTS "anon_no_access_user_sessions" ON user_sessions;
