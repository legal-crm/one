-- ============================================================
-- [SECURITY Phase 2] Supabase 보안 마이그레이션 스크립트
-- Supabase SQL Editor에서 이 스크립트를 실행하세요.
-- ============================================================

-- ============================================================
-- 2-1. Row Level Security (RLS) 활성화
-- ============================================================

-- diagnosis_results 테이블 RLS 활성화
ALTER TABLE IF EXISTS diagnosis_results ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성
DROP POLICY IF EXISTS "anon_insert_diagnosis" ON diagnosis_results;
CREATE POLICY "anon_insert_diagnosis"
  ON diagnosis_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_diagnosis" ON diagnosis_results;
CREATE POLICY "authenticated_select_diagnosis"
  ON diagnosis_results
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_select_own_diagnosis" ON diagnosis_results;
CREATE POLICY "anon_select_own_diagnosis"
  ON diagnosis_results
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

DROP POLICY IF EXISTS "authenticated_update_diagnosis" ON diagnosis_results;
CREATE POLICY "authenticated_update_diagnosis"
  ON diagnosis_results
  FOR UPDATE
  TO authenticated
  USING (true);

-- diagnosis_config 테이블 RLS 활성화
ALTER TABLE IF EXISTS diagnosis_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_config" ON diagnosis_config;
CREATE POLICY "public_read_config"
  ON diagnosis_config
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "authenticated_modify_config" ON diagnosis_config;
CREATE POLICY "authenticated_modify_config"
  ON diagnosis_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2-3. 진단 데이터 보관기간 설정
-- ============================================================

ALTER TABLE IF EXISTS diagnosis_results
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE diagnosis_results
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

ALTER TABLE IF EXISTS diagnosis_results
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '90 days');

-- ============================================================
-- 2-4. 감사 로그 (Audit Logs) 테이블 신설
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      TEXT NOT NULL,
  actor_role    TEXT NOT NULL DEFAULT 'anonymous',
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  detail        JSONB DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_audit" ON audit_logs;
CREATE POLICY "anyone_insert_audit"
  ON audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_logs;
CREATE POLICY "authenticated_read_audit"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 만료 데이터 자동 삭제 함수
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_diagnosis()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM diagnosis_results
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  INSERT INTO audit_logs (actor_id, actor_role, action, target_type, detail)
  VALUES (
    'system',
    'system',
    'auto_cleanup',
    'diagnosis',
    jsonb_build_object('deleted_count', deleted_count, 'cleanup_at', NOW())
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
