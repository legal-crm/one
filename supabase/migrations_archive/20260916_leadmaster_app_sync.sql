-- =============================================================================
-- LeadMaster App (Android) & Legal CRM 동기화 테이블 및 실시간 복제 스키마
-- 대상: communication_logs, pending_sms, pending_calls, sms_templates
-- =============================================================================

-- 1. communication_logs (안드로이드 앱 및 CRM 통화/문자 타임라인 기록)
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CALL_IN', 'CALL_OUT', 'CALL_MISSED', 'SMS_IN', 'SMS_OUT'
    duration INTEGER DEFAULT 0, -- 통화 시간 (초)
    content TEXT, -- 문자 메시지 본문 또는 통화 메모
    line_info TEXT DEFAULT '기본', -- '기본' | '투넘버'
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 안드로이드 배치 동기화 시 중복 방지 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS unique_comm_log_idx 
ON public.communication_logs (phone_number, timestamp, type);

CREATE INDEX IF NOT EXISTS idx_comm_logs_phone ON public.communication_logs (phone_number);
CREATE INDEX IF NOT EXISTS idx_comm_logs_timestamp ON public.communication_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_comm_logs_type ON public.communication_logs (type);

-- 2. pending_sms (CRM 웹 -> 안드로이드 스마트폰 원격 문자 발송 요청 대기열)
CREATE TABLE IF NOT EXISTS public.pending_sms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_sms_status ON public.pending_sms (status);
CREATE INDEX IF NOT EXISTS idx_pending_sms_created_at ON public.pending_sms (created_at ASC);

-- 3. pending_calls (CRM 웹 -> 안드로이드 스마트폰 Click-to-Call 전화 걸기 대기열)
CREATE TABLE IF NOT EXISTS public.pending_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    customer_name TEXT,
    case_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'dialed', 'ended', 'failed'
    auto_dial_item_id TEXT,
    dialed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_calls_status ON public.pending_calls (status);
CREATE INDEX IF NOT EXISTS idx_pending_calls_phone ON public.pending_calls (phone_number);

-- 4. sms_templates (CRM 및 모바일 공용 문자 발송 템플릿 관리 - 최대 5개)
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 기본 템플릿 시드 데이터 (최초 1회)
INSERT INTO public.sms_templates (title, content)
VALUES 
  ('서류 안내', '[법률사무소] 개인회생 1차 필수 서류 안내입니다.\n1. 주민등록등본·초본(전체 주소)\n2. 가족관계증명서(상세)\n3. 최근 1년 급여명세서 및 통장내역\n4. 부채증명서\n서류 준비 후 사진 찍어 회신 부탁드립니다.'),
  ('부재중 연락 요청', '[법률사무소] 고객님, 신청하신 채무조정 무료 상담 관련하여 전화드렸으나 연결되지 않아 문자 남깁니다. 통화 가능하신 편한 시간을 알려주시면 맞춰서 연락드리겠습니다.'),
  ('명함 및 인사', '[법률사무소] 안녕하세요. 회생파산 전담센터 담당자입니다. 채무 독촉이나 급여 압류 등 긴급한 상담이 필요하시면 언제든 본 번호로 회신 또는 전화 주시기 바랍니다.'),
  ('기본', '[법률사무소] 고객님의 개인회생/파산 자격 검토 결과를 안내해 드립니다. 세부 서류 안내 및 금지명령 신청 절차를 위해 유선 상담 부탁드립니다.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- RLS (Row Level Security) 설정 및 권한 부여
-- =============================================================================

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- 익명(anon) 및 인증 사용자(authenticated) 전체 CRUD 허용 (단일 로펌 전용 CRM 및 안드로이드 서비스 계정 통신)
DROP POLICY IF EXISTS "Allow anon and auth read/write communication_logs" ON public.communication_logs;
CREATE POLICY "Allow anon and auth read/write communication_logs" 
ON public.communication_logs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth read/write pending_sms" ON public.pending_sms;
CREATE POLICY "Allow anon and auth read/write pending_sms" 
ON public.pending_sms FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth read/write pending_calls" ON public.pending_calls;
CREATE POLICY "Allow anon and auth read/write pending_calls" 
ON public.pending_calls FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth read/write sms_templates" ON public.sms_templates;
CREATE POLICY "Allow anon and auth read/write sms_templates" 
ON public.sms_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- =============================================================================
-- Supabase Realtime 복제 활성화 (웹 브라우저에서 통화/문자 변경 실시간 수신)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'communication_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pending_sms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_sms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pending_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_calls;
  END IF;
END $$;
