-- ============================================================
-- 005: 내부 소통 시스템 (스레드 메시지, 업무 할당, 인앱 알림)
-- ============================================================

-- 1. 내부 메시지 (사건별 스레드)
CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('consult_request', 'case', 'copilot_review')),
  target_id TEXT NOT NULL,
  parent_id UUID REFERENCES internal_messages(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  visibility TEXT NOT NULL DEFAULT 'all_staff' CHECK (visibility IN ('all_staff', 'lawyers_only', 'designated')),
  designated_user_ids TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_tenant_target ON internal_messages(tenant_id, target_type, target_id);
CREATE INDEX idx_messages_parent ON internal_messages(parent_id);
CREATE INDEX idx_messages_mentions ON internal_messages USING GIN(mentions);

ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_tenant_isolation" ON internal_messages
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- 2. 업무 할당 티켓
CREATE TABLE IF NOT EXISTS task_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('consult_request', 'case', 'copilot_review')),
  target_id TEXT NOT NULL,
  assigner_id TEXT NOT NULL,
  assigner_name TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  assignee_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_tenant ON task_tickets(tenant_id);
CREATE INDEX idx_tickets_assignee ON task_tickets(tenant_id, assignee_id, status);
CREATE INDEX idx_tickets_target ON task_tickets(tenant_id, target_type, target_id);

ALTER TABLE task_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_tenant_isolation" ON task_tickets
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- 3. 인앱 알림
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  link_type TEXT NOT NULL,
  link_id TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON in_app_notifications(tenant_id, recipient_id, is_read);
CREATE INDEX idx_notifications_created ON in_app_notifications(created_at DESC);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_user_isolation" ON in_app_notifications
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND recipient_id = current_setting('app.user_id', true)
  );
