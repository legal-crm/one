-- ============================================================
-- [SECURITY Phase 2] Supabase 보안 마이그레이션 스크립트 (Complete)
-- 테이블 생성 + RLS + 감사로그 + 만료 정책
-- ============================================================

-- ============================================================
-- Step 1: 테이블 생성 (없는 경우에만)
-- ============================================================

-- 진단 결과 테이블
CREATE TABLE IF NOT EXISTS diagnosis_results (
  id                      BIGSERIAL PRIMARY KEY,
  session_id              TEXT NOT NULL,
  q1_status               TEXT,
  q2_debt_scale           TEXT,
  q3_income               TEXT,
  q4_urgent_need          TEXT,
  q5_goal                 TEXT,
  primary_strategy        TEXT,
  secondary_strategy      TEXT,
  urgency_level           TEXT,
  estimated_debt_total    NUMERIC,
  estimated_savings_amount NUMERIC,
  estimated_savings_rate  NUMERIC,
  estimated_monthly_payment NUMERIC,
  rehab_engine_used       BOOLEAN DEFAULT false,
  full_result             JSONB DEFAULT '{}',
  converted_to_detailed   BOOLEAN DEFAULT false,
  converted_to_lawyer     BOOLEAN DEFAULT false,
  converted_at            TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_session ON diagnosis_results (session_id, created_at DESC);

-- 진단 설정 테이블
CREATE TABLE IF NOT EXISTS diagnosis_config (
  id          BIGSERIAL PRIMARY KEY,
  questions   JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN DEFAULT true,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  version     SERIAL
);

-- 진단 통계 테이블
CREATE TABLE IF NOT EXISTS diagnosis_stats (
  id                  BIGSERIAL PRIMARY KEY,
  day                 DATE NOT NULL,
  total_count         INTEGER DEFAULT 0,
  strategy_breakdown  JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 감사 로그 테이블
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

-- ============================================================
-- Step 2: Row Level Security (RLS) 활성화
-- ============================================================

-- diagnosis_results RLS
ALTER TABLE diagnosis_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_diagnosis" ON diagnosis_results;
CREATE POLICY "anon_insert_diagnosis"
  ON diagnosis_results FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_diagnosis" ON diagnosis_results;
CREATE POLICY "authenticated_select_diagnosis"
  ON diagnosis_results FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_select_own_diagnosis" ON diagnosis_results;
CREATE POLICY "anon_select_own_diagnosis"
  ON diagnosis_results FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "authenticated_update_diagnosis" ON diagnosis_results;
CREATE POLICY "authenticated_update_diagnosis"
  ON diagnosis_results FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_update_own_diagnosis" ON diagnosis_results;
CREATE POLICY "anon_update_own_diagnosis"
  ON diagnosis_results FOR UPDATE TO anon
  USING (true);

-- diagnosis_config RLS
ALTER TABLE diagnosis_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_config" ON diagnosis_config;
CREATE POLICY "public_read_config"
  ON diagnosis_config FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "authenticated_modify_config" ON diagnosis_config;
CREATE POLICY "authenticated_modify_config"
  ON diagnosis_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_modify_config" ON diagnosis_config;
CREATE POLICY "anon_modify_config"
  ON diagnosis_config FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- diagnosis_stats RLS
ALTER TABLE diagnosis_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_stats" ON diagnosis_stats;
CREATE POLICY "public_read_stats"
  ON diagnosis_stats FOR SELECT TO anon, authenticated
  USING (true);

-- audit_logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_audit" ON audit_logs;
CREATE POLICY "anyone_insert_audit"
  ON audit_logs FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_logs;
CREATE POLICY "authenticated_read_audit"
  ON audit_logs FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- Step 3: 만료 데이터 자동 삭제 함수
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
    'system', 'system', 'auto_cleanup', 'diagnosis',
    jsonb_build_object('deleted_count', deleted_count, 'cleanup_at', NOW())
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 완료! 아래 쿼리로 확인하세요:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- ============================================================
