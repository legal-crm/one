-- ============================================================
-- Phase 1: Critical 비즈니스 데이터 Supabase 테이블 생성
-- Supabase Dashboard → SQL Editor 에서 실행
-- ============================================================

-- 1. 전자 계약서
CREATE TABLE IF NOT EXISTS electronic_contracts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT 'client-temp',
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT DEFAULT '',
  client_address TEXT DEFAULT '',
  lawyer_name TEXT DEFAULT '',
  law_firm_name TEXT DEFAULT '',
  assigned_lawyer_id TEXT,
  total_fee NUMERIC DEFAULT 0,
  court_costs NUMERIC DEFAULT 0,
  fee_schedule JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  contract_date TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 캘린더 일정
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  client_id TEXT,
  client_name TEXT DEFAULT '',
  court_name TEXT DEFAULT '',
  case_number TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  assigned_staff_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 사건 관리
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT 'client-temp',
  client_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT DEFAULT 'document',
  assigned_lawyer_id TEXT,
  assigned_lawyer_name TEXT DEFAULT '',
  debt_total NUMERIC DEFAULT 0,
  income NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 변호사 프로필
CREATE TABLE IF NOT EXISTS lawyers (
  id TEXT PRIMARY KEY,
  law_firm_id TEXT DEFAULT '',
  team_id TEXT DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  firm_name TEXT DEFAULT '',
  role TEXT DEFAULT 'lawyer',
  fields JSONB DEFAULT '[]'::jsonb,
  region TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  avatar_data TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  career TEXT DEFAULT '',
  education TEXT DEFAULT '',
  specialties JSONB DEFAULT '[]'::jsonb,
  success_rate NUMERIC DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  avg_repayment_rate NUMERIC DEFAULT 0,
  court_jurisdiction TEXT DEFAULT '',
  ad_tier TEXT DEFAULT 'free',
  ai_case_analysis_enabled BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 회원 계정
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  alias TEXT DEFAULT '',
  role TEXT DEFAULT 'CLIENT',
  login_channel TEXT DEFAULT 'email',
  status TEXT DEFAULT 'active',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 활동 로그
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT DEFAULT '',
  member_name TEXT DEFAULT '',
  role TEXT DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  details TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 직원 활동 이력
CREATE TABLE IF NOT EXISTS staff_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT DEFAULT 'default',
  staff_id TEXT NOT NULL DEFAULT '',
  staff_name TEXT DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 커스텀 직원 역할
CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT DEFAULT 'default',
  role_name TEXT NOT NULL DEFAULT '',
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AI 코파일럿 사건 검토
CREATE TABLE IF NOT EXISTS copilot_cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  request_id TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AI 코파일럿 룰셋
CREATE TABLE IF NOT EXISTS copilot_rulesets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  rules JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 알림톡 발송 이력
CREATE TABLE IF NOT EXISTS alimtok_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT DEFAULT 'default',
  client_id TEXT NOT NULL DEFAULT '',
  client_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  milestone TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  error_message TEXT DEFAULT '',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 수임료 알림 설정
CREATE TABLE IF NOT EXISTS fee_notification_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 정책 — 인증된 사용자만 접근
-- ============================================================
ALTER TABLE electronic_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alimtok_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_notification_settings ENABLE ROW LEVEL SECURITY;

-- anon 키로 접근 허용 (개발 단계 — 프로덕션에서는 auth.uid() 기반으로 교체 권장)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'electronic_contracts','calendar_events','cases','lawyers','members',
    'activity_logs','staff_activities','custom_roles','copilot_cases',
    'copilot_rulesets','alimtok_logs','fee_notification_settings'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_all_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
