-- ============================================================
-- 회생톡 진단(Diagnosis) 결과 저장 테이블
-- Supabase Migration SQL
-- ============================================================

-- 1. 진단 결과 테이블
CREATE TABLE IF NOT EXISTS diagnosis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 익명 세션 식별 (로그인 불필요)
  session_id TEXT NOT NULL,
  
  -- 5문항 응답
  q1_status TEXT NOT NULL,        -- 현재 채무 상태
  q2_debt_scale TEXT NOT NULL,    -- 총 채무 규모
  q3_income TEXT NOT NULL,        -- 소득 여부
  q4_urgent_need TEXT NOT NULL,   -- 가장 급한 문제
  q5_goal TEXT NOT NULL,          -- 원하는 방향
  
  -- 진단 결과
  primary_strategy TEXT NOT NULL,          -- REHABILITATION | BANKRUPTCY | NEGOTIATION | FRESH_START | WAIT_AND_SEE
  secondary_strategy TEXT,
  urgency_level TEXT NOT NULL,             -- immediate | soon | can_wait
  
  -- 금액 정보 (만원 단위)
  estimated_debt_total NUMERIC NOT NULL,
  estimated_savings_amount NUMERIC NOT NULL,
  estimated_savings_rate NUMERIC NOT NULL,  -- 0~1
  estimated_monthly_payment NUMERIC NOT NULL,
  
  -- rehabEngine 사용 여부
  rehab_engine_used BOOLEAN DEFAULT true,
  
  -- 전체 결과 JSON (상세 데이터 백업)
  full_result JSONB,
  
  -- 전환 추적
  converted_to_detailed BOOLEAN DEFAULT false,  -- 정밀 분석으로 전환했는지
  converted_to_lawyer BOOLEAN DEFAULT false,    -- 변호사 매칭으로 전환했는지
  converted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_session ON diagnosis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_created ON diagnosis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_strategy ON diagnosis_results(primary_strategy);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_converted ON diagnosis_results(converted_to_detailed, converted_to_lawyer);

-- 2. 진단 문항 설정 테이블 (관리자 편집용)
CREATE TABLE IF NOT EXISTS diagnosis_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- 기본 설정 삽입 (기본 질문은 코드에서 관리, DB에는 커스텀만 저장)
-- INSERT는 앱 초기화 시 코드에서 처리

-- 3. RLS (Row Level Security) 정책
-- 진단 결과: 누구나 INSERT 가능 (익명), SELECT는 관리자만
ALTER TABLE diagnosis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert diagnosis results" ON diagnosis_results
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Only authenticated can read diagnosis results" ON diagnosis_results
  FOR SELECT TO authenticated
  USING (true);

-- 진단 설정: 누구나 읽기 가능, 수정은 인증된 사용자만
ALTER TABLE diagnosis_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read diagnosis config" ON diagnosis_config
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated can manage diagnosis config" ON diagnosis_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. 통계 뷰 (관리자 대시보드용)
CREATE OR REPLACE VIEW diagnosis_stats AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS total_diagnoses,
  COUNT(*) FILTER (WHERE converted_to_detailed) AS converted_detailed,
  COUNT(*) FILTER (WHERE converted_to_lawyer) AS converted_lawyer,
  ROUND(
    COUNT(*) FILTER (WHERE converted_to_detailed OR converted_to_lawyer)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS conversion_rate_pct,
  -- 전략별 분포
  COUNT(*) FILTER (WHERE primary_strategy = 'REHABILITATION') AS strategy_rehab,
  COUNT(*) FILTER (WHERE primary_strategy = 'BANKRUPTCY') AS strategy_bankruptcy,
  COUNT(*) FILTER (WHERE primary_strategy = 'NEGOTIATION') AS strategy_negotiation,
  COUNT(*) FILTER (WHERE primary_strategy = 'FRESH_START') AS strategy_fresh_start,
  COUNT(*) FILTER (WHERE primary_strategy = 'WAIT_AND_SEE') AS strategy_wait,
  -- 긴급도 분포
  COUNT(*) FILTER (WHERE urgency_level = 'immediate') AS urgency_immediate,
  COUNT(*) FILTER (WHERE urgency_level = 'soon') AS urgency_soon,
  COUNT(*) FILTER (WHERE urgency_level = 'can_wait') AS urgency_can_wait,
  -- 평균 금액
  ROUND(AVG(estimated_debt_total)) AS avg_debt_total,
  ROUND(AVG(estimated_savings_rate) * 100, 1) AS avg_savings_rate_pct
FROM diagnosis_results
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
