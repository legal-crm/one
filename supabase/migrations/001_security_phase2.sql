-- ============================================================
-- [SECURITY Phase 2] Supabase 보안 마이그레이션 스크립트
-- Supabase SQL Editor에서 이 스크립트를 실행하세요.
-- ============================================================

-- ============================================================
-- 2-1. Row Level Security (RLS) 활성화
-- ============================================================

-- diagnosis_results 테이블 RLS 활성화
ALTER TABLE IF EXISTS diagnosis_results ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 진단 결과를 삽입할 수 있음 (익명 진단)
CREATE POLICY IF NOT EXISTS "anon_insert_diagnosis"
  ON diagnosis_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 정책: 인증된 사용자(관리자)만 조회 가능
CREATE POLICY IF NOT EXISTS "authenticated_select_diagnosis"
  ON diagnosis_results
  FOR SELECT
  TO authenticated
  USING (true);

-- 정책: anon은 자신의 세션 데이터만 조회 가능
CREATE POLICY IF NOT EXISTS "anon_select_own_diagnosis"
  ON diagnosis_results
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers')::json->>'x-session-id');

-- 정책: 인증된 사용자만 업데이트 가능
CREATE POLICY IF NOT EXISTS "authenticated_update_diagnosis"
  ON diagnosis_results
  FOR UPDATE
  TO authenticated
  USING (true);

-- diagnosis_config 테이블 RLS 활성화
ALTER TABLE IF EXISTS diagnosis_config ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 활성 설정을 읽을 수 있음
CREATE POLICY IF NOT EXISTS "public_read_config"
  ON diagnosis_config
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 정책: 인증된 사용자만 설정 수정 가능
CREATE POLICY IF NOT EXISTS "authenticated_modify_config"
  ON diagnosis_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2-3. 진단 데이터 보관기간 설정
-- ============================================================

-- diagnosis_results에 만료 컬럼 추가
ALTER TABLE IF EXISTS diagnosis_results
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 기본값: 생성 후 90일 후 만료
-- 기존 데이터에도 적용
UPDATE diagnosis_results
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

-- 향후 삽입 시 자동으로 90일 만료 설정
ALTER TABLE IF EXISTS diagnosis_results
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '90 days');

-- ============================================================
-- 2-4. 감사 로그 (Audit Logs) 테이블 신설
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  -- 행위자 정보
  actor_id      TEXT NOT NULL,              -- 사용자/관리자/시스템 ID
  actor_role    TEXT NOT NULL DEFAULT 'anonymous',  -- 'admin', 'lawyer', 'client', 'system', 'anonymous'
  -- 행위 정보
  action        TEXT NOT NULL,              -- 'login', 'view_client', 'decrypt_phone', 'download', 'update', 'delete' 등
  target_type   TEXT,                       -- 'diagnosis', 'consult_request', 'case', 'chat_message', 'config' 등
  target_id     TEXT,                       -- 대상 레코드 ID
  -- 컨텍스트
  detail        JSONB DEFAULT '{}',         -- 추가 상세 정보 (변경 전/후 값 등)
  ip_address    TEXT,                       -- 접속 IP
  user_agent    TEXT,                       -- 브라우저/디바이스 정보
  -- 시간
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 감사 로그 인덱스 (빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- 감사 로그 RLS: 관리자만 조회 가능, 삽입은 누구나 가능
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "anyone_insert_audit"
  ON audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "authenticated_read_audit"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- 감사 로그는 삭제/수정 금지 (조작 방지)
-- anon과 authenticated 모두 UPDATE/DELETE 불가

-- ============================================================
-- 2-3 추가: 만료 데이터 자동 삭제 함수
-- Supabase pg_cron 또는 Edge Function에서 호출
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_diagnosis()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM diagnosis_results
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 삭제 작업을 감사 로그에 기록
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

-- pg_cron이 활성화되어 있다면 매일 새벽 3시에 자동 정리
-- SELECT cron.schedule('cleanup-expired-diagnosis', '0 3 * * *', 'SELECT cleanup_expired_diagnosis()');

-- ============================================================
-- 완료 확인
-- ============================================================
-- 아래 쿼리로 RLS 상태를 확인하세요:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
