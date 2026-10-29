-- ============================================================
-- [Consultation] 상담 요청 및 메시지 테이블 마이그레이션
-- ============================================================

-- ============================================================
-- Step 1: 테이블 생성
-- ============================================================

-- 상담 요청 테이블
CREATE TABLE IF NOT EXISTS consult_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '익명 의뢰인',
  phone TEXT DEFAULT '',
  request_type TEXT NOT NULL DEFAULT 'open',
  max_participants INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'requested',
  selected_lawyer_id TEXT,
  selected_lawyer_ids JSONB DEFAULT '[]',
  proposals JSONB DEFAULT '[]',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  financial_profile JSONB NOT NULL DEFAULT '{}',
  phone_consultation_requested BOOLEAN DEFAULT false,
  safe_number TEXT,
  safe_number_assigned_at TIMESTAMPTZ,
  safe_number_expires_at TIMESTAMPTZ,
  entry_category JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 상담 메시지 테이블
CREATE TABLE IF NOT EXISTS consult_messages (
  id TEXT PRIMARY KEY,
  consult_request_id TEXT NOT NULL REFERENCES consult_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consult_requests_client ON consult_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_consult_requests_created ON consult_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consult_messages_request ON consult_messages(consult_request_id);
CREATE INDEX IF NOT EXISTS idx_consult_messages_created ON consult_messages(created_at DESC);

-- ============================================================
-- Step 2: RLS 활성화 및 정책 설정
-- ============================================================

ALTER TABLE consult_requests ENABLE ROW LEVEL SECURITY;

-- 누구나 조회/생성/수정 가능 (기존 패턴 유지)
DROP POLICY IF EXISTS "anon_insert_consult_request" ON consult_requests;
CREATE POLICY "anon_insert_consult_request"
  ON consult_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_consult_request" ON consult_requests;
CREATE POLICY "public_select_consult_request"
  ON consult_requests FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_update_consult_request" ON consult_requests;
CREATE POLICY "public_update_consult_request"
  ON consult_requests FOR UPDATE TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_delete_consult_request" ON consult_requests;
CREATE POLICY "public_delete_consult_request"
  ON consult_requests FOR DELETE TO anon, authenticated
  USING (true);


ALTER TABLE consult_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_consult_message" ON consult_messages;
CREATE POLICY "anon_insert_consult_message"
  ON consult_messages FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_consult_message" ON consult_messages;
CREATE POLICY "public_select_consult_message"
  ON consult_messages FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_update_consult_message" ON consult_messages;
CREATE POLICY "public_update_consult_message"
  ON consult_messages FOR UPDATE TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_delete_consult_message" ON consult_messages;
CREATE POLICY "public_delete_consult_message"
  ON consult_messages FOR DELETE TO anon, authenticated
  USING (true);
