const fs = require('fs');
const path = require('path');

let master = '-- ====================================================================\n';
master += '-- MYKIMLAW (마이김변) COMPLETE MASTER MIGRATION BUNDLE\n';
master += '-- Prepares all foundational tables and applies migrations\n';
master += '-- Generated: ' + new Date().toISOString() + '\n';
master += '-- ====================================================================\n\n';

master += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
master += 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n';

// 1. Foundational Base Tables: staff_members & invite_tokens
master += '-- ====================================================================\n';
master += '-- FOUNDATIONAL BASE TABLES (Prerequisites)\n';
master += '-- ====================================================================\n\n';

master += `
-- 1. invite_tokens 테이블 생성
CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'CONSULTANT',
  email       TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by     TEXT,
  used_at     TIMESTAMPTZ,
  is_used     BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON public.invite_tokens (token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_created ON public.invite_tokens (created_by, created_at DESC);
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- 2. staff_members 테이블 생성
CREATE TABLE IF NOT EXISTS public.staff_members (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                  TEXT NOT NULL DEFAULT '',
  role                  TEXT NOT NULL DEFAULT 'STAFF',
  email                 TEXT DEFAULT '',
  phone                 TEXT DEFAULT '',
  avatar                TEXT DEFAULT '',
  is_active             BOOLEAN DEFAULT true,
  assigned_count        INTEGER DEFAULT 0,
  permissions           JSONB DEFAULT '{}'::jsonb,
  status                TEXT DEFAULT 'pending',
  supervising_lawyer_id TEXT,
  invited_by            TEXT,
  approved_at           TIMESTAMPTZ,
  removed_at            TIMESTAMPTZ,
  removal_reason        TEXT,
  last_active_at        TIMESTAMPTZ,
  auth_email            TEXT,
  auth_provider         TEXT DEFAULT 'email',
  supabase_user_id      UUID,
  linked_user_id        TEXT,
  invite_token          TEXT,
  password_last_changed TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_invited_by ON public.staff_members (invited_by);
CREATE INDEX IF NOT EXISTS idx_staff_linked_user ON public.staff_members (linked_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_email ON public.staff_members (auth_email);
CREATE INDEX IF NOT EXISTS idx_staff_supabase_uid ON public.staff_members (supabase_user_id);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
`;

const files = [
  'phase1_critical_tables.sql',
  'phase2_cms_tables.sql',
  '001_security_phase2.sql',
  '003_consult_requests.sql',
  '007_user_sessions.sql',
  '012_consult_requests_strict_rls.sql',
  '013_shared_reports_pin_attempt_limit.sql',
  '014_client_alias_uniqueness.sql',
  '015_contract_proposal_linkage.sql',
  '016_crm_clients_extension_data.sql',
  '017_doc_share_packages.sql',
  '018_lawyer_auth_hardening.sql',
  '019_user_sessions_owner_rls.sql',
  '020_team_calendar_messenger_rls.sql',
  '021_platform_admin_zero_trust.sql',
  '022_activity_logs_lockdown.sql',
  '023_admin_consult_controls_members_rls.sql',
  '024_ad_orders.sql',
  '025_cms_config_admin_write_rls.sql',
  '026_infra_rls_cleanup.sql'
];

for (const file of files) {
  const filePath = path.join('supabase', 'migrations', file);
  if (fs.existsSync(filePath)) {
    master += '\n\n-- ====================================================================\n';
    master += '-- FILE: ' + file + '\n';
    master += '-- ====================================================================\n\n';
    master += fs.readFileSync(filePath, 'utf8');
  } else {
    console.error('Missing: ' + file);
  }
}

fs.writeFileSync(path.join('supabase', 'migrations', 'DEPLOY_012_TO_026_MASTER.sql'), master, 'utf8');
console.log('Successfully regenerated DEPLOY_012_TO_026_MASTER.sql, size: ' + master.length);
