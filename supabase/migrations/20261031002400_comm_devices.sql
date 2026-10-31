-- ============================================================
-- CL·KT·AP 서버 쪽: 업무폰 기기 연결·연락처·소통 기록·녹음·기기 명령 (11 기획서 4장, 24 기획서)
-- 문제: 통화·문자 기록은 LeadMaster 이식 코드가 없는 표(communication_logs·pending_sms·pending_calls)에
--       직접 쓰려다 늘 실패했고, 녹음은 구글 드라이브 공개 링크로 올리게 돼 있었다.
-- 바꾼 것:
--  * office_devices·device_pairing_codes: 웹에서 연결 코드(10분·1회용) → 앱이 코드로 연결, 기기 토큰은 해시만 저장.
--    대표·직원 관리 권한자가 만든 코드는 바로 사용, 그 밖은 대표 승인 뒤 사용(사무소 정책)
--  * client_contacts: 사건(작업 공간 키)·영업 리드에 등록한 번호만 기기가 안다(기기용 소금값 HMAC)
--  * client_comm_logs: 통화·문자·카톡(직접 보냄 기록)·방문 기록. 내용은 고칠 수 없고 연결(사건)만 사유와 함께 바꿈
--  * call_recordings + 비공개 저장소 'call-recordings': 기기 지문·서버 지문 비교, 재생 전 열람 기록 필수
--  * device_commands: 웹 → 내 업무폰 '전화 걸기'(다이얼러만)·'문자 보내기'(사무소 정책·발송 금지 시간·하루 한도)
--  * device_register_requests: 앱에서 '이 번호 등록' → 웹에서 사건·리드에 연결하거나 무시
--  * comm_templates: 문자·카톡 안내 문구함
--  * 기기 API(api/device.js)는 service_role로 device_* 함수만 부른다. 사무소 값은 토큰에서 정하고 앱 값을 믿지 않는다
--  * 통합관리자는 이 표·저장소를 볼 수 없다 (제로날리지)
--  * LeadMaster 이식 표 4개(운영에 없음)는 있으면 지운다
-- ============================================================

DROP TABLE IF EXISTS public.pending_sms;
DROP TABLE IF EXISTS public.pending_calls;
DROP TABLE IF EXISTS public.sms_templates;
DROP TABLE IF EXISTS public.communication_logs;

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS device_hash_salt text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- ── 1. 도우미 ───────────────────────────────────────────────────────────────
-- 번호 정규화: 숫자만, +82 → 0
CREATE OR REPLACE FUNCTION public.comm_normalize_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d IS NULL THEN NULL
              WHEN d ~ '^82[1-9]' AND length(d) >= 11 THEN '0' || substr(d, 3)
              ELSE d END
  FROM (SELECT nullif(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '') AS d) s;
$$;

-- 기기용 번호 해시 (사무소 기기 소금값). 앱도 같은 방식으로 계산한다
CREATE OR REPLACE FUNCTION public.office_device_phone_hash(p_office_id text, p_phone text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE WHEN public.comm_normalize_phone(p_phone) IS NULL THEN NULL
    ELSE encode(hmac(public.comm_normalize_phone(p_phone), o.device_hash_salt, 'sha256'), 'hex') END
  FROM offices o WHERE o.id = p_office_id;
$$;
REVOKE ALL ON FUNCTION public.office_device_phone_hash(text, text) FROM PUBLIC, anon, authenticated;

-- 작업 공간 키(상담 요청 ID 또는 'case-'+사건 ID)가 이 사무소 것인지
CREATE OR REPLACE FUNCTION public.comm_key_in_office(p_office_id text, p_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_key IS NOT NULL AND (
    public.crm_client_case_id(p_office_id, p_key) IS NOT NULL
    OR EXISTS (SELECT 1 FROM crm_clients c WHERE c.office_id = p_office_id AND c.client_id = p_key)
    OR EXISTS (SELECT 1 FROM consult_requests r WHERE r.id = p_key AND p_office_id = ANY (public.consult_request_office_ids(r))));
$$;
REVOKE ALL ON FUNCTION public.comm_key_in_office(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.comm_lead_in_office(p_office_id text, p_lead text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_lead IS NOT NULL AND EXISTS (SELECT 1 FROM sales_leads l WHERE l.id = p_lead AND l.office_id = p_office_id AND l.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.comm_lead_in_office(text, text) FROM PUBLIC, anon, authenticated;

-- 권한 판정: 전체 범위 / 내 기기·내가 한 일 / 담당 사건 / 내 리드
CREATE OR REPLACE FUNCTION public.comm_can(p_office_id text, p_perm text, p_key text, p_lead text, p_owner uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scope text;
  v_case uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() OR NOT (p_office_id = ANY (public.current_office_ids())) THEN RETURN false; END IF;
  v_scope := public.office_permission_scope(p_office_id, p_perm);
  IF v_scope = 'all' THEN RETURN true; END IF;
  IF p_owner IS NOT NULL AND p_owner = auth.uid() THEN RETURN true; END IF;
  IF v_scope <> 'assigned' THEN RETURN false; END IF;
  IF p_key IS NOT NULL THEN
    v_case := public.crm_client_case_id(p_office_id, p_key);
    IF v_case IS NOT NULL AND public.is_case_assignee(v_case) THEN RETURN true; END IF;
  END IF;
  IF p_lead IS NOT NULL AND EXISTS (SELECT 1 FROM sales_leads l WHERE l.id = p_lead AND l.office_id = p_office_id
                                     AND public.can_see_sales_lead(l.office_id, l.assignee_user_id, l.created_by)) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.comm_can(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comm_can(text, text, text, text, uuid) TO authenticated;

-- 기기(서비스) 쪽 활동 기록: office_log는 로그인 사용자 기준이라 따로 쓴다
CREATE OR REPLACE FUNCTION public.device_office_log(p_office_id text, p_user uuid, p_member uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO office_audit_logs (office_id, actor_user_id, actor_member_id, action, target_type, target_id, detail)
  VALUES (p_office_id, p_user, p_member, left(p_action, 80), left(p_target_type, 40), left(p_target_id, 120), coalesce(p_detail, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.device_office_log(text, uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 2. 표 ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.office_comm_policies (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  require_approval boolean NOT NULL DEFAULT true,
  upload_network text NOT NULL DEFAULT 'any' CHECK (upload_network IN ('any', 'wifi')),
  upload_recordings boolean NOT NULL DEFAULT true,
  auto_transcribe boolean NOT NULL DEFAULT true,
  app_sms_allowed boolean NOT NULL DEFAULT false,
  sms_daily_limit integer NOT NULL DEFAULT 50 CHECK (sms_daily_limit BETWEEN 0 AND 500),
  sms_quiet_start integer NOT NULL DEFAULT 21 CHECK (sms_quiet_start BETWEEN 0 AND 23),
  sms_quiet_end integer NOT NULL DEFAULT 8 CHECK (sms_quiet_end BETWEEN 0 AND 23),
  staff_notice text NOT NULL DEFAULT '이 휴대폰에서 사무소에 등록된 의뢰인 번호와 주고받은 통화·문자 기록과 통화 녹음이 사무소 업무 기록으로 저장됩니다. 등록되지 않은 번호의 기록은 올라가지 않습니다.'
    CHECK (char_length(staff_notice) <= 1000),
  version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_comm_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_comm_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.office_comm_policies TO authenticated;
GRANT ALL ON public.office_comm_policies TO service_role;
DROP POLICY IF EXISTS office_comm_policies_read ON public.office_comm_policies;
CREATE POLICY office_comm_policies_read ON public.office_comm_policies FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));

CREATE TABLE IF NOT EXISTS public.office_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.office_members(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 40),
  line_label text NOT NULL DEFAULT '' CHECK (char_length(line_label) <= 30),
  line_mode text NOT NULL DEFAULT 'personal' CHECK (line_mode IN ('personal', 'shared')),
  model text NOT NULL DEFAULT '' CHECK (char_length(model) <= 60),
  os_version text NOT NULL DEFAULT '' CHECK (char_length(os_version) <= 20),
  app_version text NOT NULL DEFAULT '' CHECK (char_length(app_version) <= 20),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  paired_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  revoke_reason text CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 200),
  last_seen_at timestamptz,
  clock_skew_sec integer,
  pending_uploads integer NOT NULL DEFAULT 0,
  failed_uploads integer NOT NULL DEFAULT 0,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_devices_office_idx ON public.office_devices (office_id, status);
CREATE INDEX IF NOT EXISTS office_devices_user_idx ON public.office_devices (user_id) WHERE status <> 'revoked';
ALTER TABLE public.office_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, user_id, member_id, label, line_label, line_mode, model, os_version, app_version, status, paired_at,
              approved_by, approved_at, revoked_by, revoked_at, revoke_reason, last_seen_at, clock_skew_sec, pending_uploads,
              failed_uploads, permissions, created_at) ON public.office_devices TO authenticated;
GRANT ALL ON public.office_devices TO service_role;
DROP POLICY IF EXISTS office_devices_read ON public.office_devices;
CREATE POLICY office_devices_read ON public.office_devices FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids())
         AND (user_id = auth.uid() OR public.has_office_permission(office_id, 'office.staff')));

CREATE TABLE IF NOT EXISTS public.device_pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid,
  code_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  pre_approved boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  device_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.device_pairing_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_pairing_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.device_pairing_codes TO service_role;

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  workspace_key text CHECK (workspace_key IS NULL OR char_length(workspace_key) <= 80),
  sales_lead_id text CHECK (sales_lead_id IS NULL OR char_length(sales_lead_id) <= 80),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{8,12}$'),
  device_hash text NOT NULL,
  relation text NOT NULL DEFAULT 'self' CHECK (relation IN ('self', 'spouse', 'family', 'work', 'other')),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 40),
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CHECK ((workspace_key IS NOT NULL) <> (sales_lead_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS client_contacts_key_phone_uq ON public.client_contacts (office_id, coalesce(workspace_key, 'lead:' || sales_lead_id), phone) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS client_contacts_hash_idx ON public.client_contacts (office_id, device_hash) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS client_contacts_updated_idx ON public.client_contacts (office_id, updated_at);
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, workspace_key, sales_lead_id, phone, relation, label, valid_until, created_by, created_at, updated_at, removed_at)
  ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
DROP POLICY IF EXISTS client_contacts_read ON public.client_contacts;
CREATE POLICY client_contacts_read ON public.client_contacts FOR SELECT TO authenticated
  USING (removed_at IS NULL AND public.comm_can(office_id, 'client.contact', workspace_key, sales_lead_id, created_by));

CREATE TABLE IF NOT EXISTS public.client_comm_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.office_devices(id) ON DELETE SET NULL,
  user_id uuid,
  member_id uuid,
  workspace_key text,
  sales_lead_id text,
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  link_status text NOT NULL DEFAULT 'linked' CHECK (link_status IN ('linked', 'needs_review')),
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL CHECK (source IN ('app', 'manual', 'kakao_manual', 'alimtok', 'popbill')),
  channel text NOT NULL CHECK (channel IN ('call', 'sms', 'mms', 'kakao', 'alimtok', 'visit', 'other')),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  result text NOT NULL DEFAULT 'unknown' CHECK (result IN ('answered', 'missed', 'rejected', 'sent', 'failed', 'received', 'unknown')),
  duration_sec integer CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 86400),
  line_label text NOT NULL DEFAULT '',
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  device_record_key text CHECK (device_record_key IS NULL OR char_length(device_record_key) <= 120),
  content_hash text NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  next_contact_at timestamptz,
  link_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_comm_logs_device_key_uq ON public.client_comm_logs (device_id, device_record_key) WHERE device_id IS NOT NULL AND device_record_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_comm_logs_key_idx ON public.client_comm_logs (office_id, workspace_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS client_comm_logs_lead_idx ON public.client_comm_logs (office_id, sales_lead_id, occurred_at DESC) WHERE sales_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_comm_logs_review_idx ON public.client_comm_logs (office_id, occurred_at DESC) WHERE link_status = 'needs_review';
ALTER TABLE public.client_comm_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_comm_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_comm_logs TO authenticated;
GRANT ALL ON public.client_comm_logs TO service_role;
DROP POLICY IF EXISTS client_comm_logs_read ON public.client_comm_logs;
CREATE POLICY client_comm_logs_read ON public.client_comm_logs FOR SELECT TO authenticated
  USING (public.comm_can(office_id, 'comm.view', workspace_key, sales_lead_id, user_id));

-- 내용은 고칠 수 없음: 연결·메모·다음 연락만 서버 함수로 바뀐다. 지우기는 파기 작업만
CREATE OR REPLACE FUNCTION public.client_comm_logs_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- 사무소 자체를 지우는 경우(연쇄 삭제)는 막지 않는다
  IF NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.id = OLD.office_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('mykim.comm_purge', true), '') <> 'on' THEN
      RAISE EXCEPTION 'communication logs cannot be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.office_id IS DISTINCT FROM OLD.office_id OR NEW.device_id IS DISTINCT FROM OLD.device_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.source IS DISTINCT FROM OLD.source OR NEW.channel IS DISTINCT FROM OLD.channel OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.result IS DISTINCT FROM OLD.result OR NEW.duration_sec IS DISTINCT FROM OLD.duration_sec OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.device_record_key IS DISTINCT FROM OLD.device_record_key OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.line_label IS DISTINCT FROM OLD.line_label THEN
    RAISE EXCEPTION 'communication log content cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_comm_logs_guard ON public.client_comm_logs;
CREATE TRIGGER client_comm_logs_guard BEFORE UPDATE OR DELETE ON public.client_comm_logs
  FOR EACH ROW EXECUTE FUNCTION public.client_comm_logs_guard();

CREATE OR REPLACE FUNCTION public.comm_content_hash(p_channel text, p_direction text, p_result text, p_occurred timestamptz, p_duration integer, p_body text, p_line text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(digest(concat_ws('|', p_channel, p_direction, p_result, to_char(p_occurred AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
                                   coalesce(p_duration::text, ''), coalesce(p_body, ''), coalesce(p_line, '')), 'sha256'), 'hex');
$$;

-- 녹음 (비공개 저장소)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('call-recordings', 'call-recordings', false, 52428800,
        ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/amr', 'audio/3gpp', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  comm_log_id uuid REFERENCES public.client_comm_logs(id) ON DELETE SET NULL,
  workspace_key text,
  sales_lead_id text,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL DEFAULT '' CHECK (char_length(original_name) <= 200),
  mime_type text NOT NULL,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes BETWEEN 1 AND 52428800),
  duration_sec integer CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 86400),
  recorded_at timestamptz,
  device_id uuid REFERENCES public.office_devices(id) ON DELETE SET NULL,
  uploaded_by uuid,
  device_sha256 text CHECK (device_sha256 IS NULL OR device_sha256 ~ '^[0-9a-f]{64}$'),
  server_sha256 text,
  verified_at timestamptz,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'verified', 'mismatch', 'failed')),
  legal_hold boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  purged_at timestamptz,
  purge_request_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (workspace_key IS NOT NULL OR sales_lead_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS call_recordings_key_idx ON public.call_recordings (office_id, workspace_key, created_at DESC);
CREATE INDEX IF NOT EXISTS call_recordings_log_idx ON public.call_recordings (comm_log_id);
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_recordings FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, comm_log_id, workspace_key, sales_lead_id, original_name, mime_type, size_bytes, duration_sec, recorded_at,
              device_id, uploaded_by, device_sha256, server_sha256, verified_at, status, legal_hold, created_at)
  ON public.call_recordings TO authenticated;
GRANT ALL ON public.call_recordings TO service_role;
DROP POLICY IF EXISTS call_recordings_read ON public.call_recordings;
CREATE POLICY call_recordings_read ON public.call_recordings FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.comm_can(office_id, 'comm.view', workspace_key, sales_lead_id, uploaded_by));

-- 열람 기록 (추가만)
CREATE TABLE IF NOT EXISTS public.evidence_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid,
  target_type text NOT NULL CHECK (target_type IN ('recording', 'comm_log', 'export')),
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('play', 'download', 'export', 'view_transcript')),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_access_logs_target_idx ON public.evidence_access_logs (target_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evidence_access_logs_office_idx ON public.evidence_access_logs (office_id, created_at DESC);
ALTER TABLE public.evidence_access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_access_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evidence_access_logs TO authenticated;
GRANT ALL ON public.evidence_access_logs TO service_role;
DROP POLICY IF EXISTS evidence_access_logs_read ON public.evidence_access_logs;
CREATE POLICY evidence_access_logs_read ON public.evidence_access_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_office_permission(office_id, 'office.audit') OR public.has_office_permission(office_id, 'comm.export'));

CREATE OR REPLACE FUNCTION public.evidence_access_logs_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('mykim.comm_purge', true), '') <> 'on' AND EXISTS (SELECT 1 FROM public.offices o WHERE o.id = OLD.office_id) THEN
    RAISE EXCEPTION 'access logs cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS evidence_access_logs_guard ON public.evidence_access_logs;
CREATE TRIGGER evidence_access_logs_guard BEFORE UPDATE OR DELETE ON public.evidence_access_logs
  FOR EACH ROW EXECUTE FUNCTION public.evidence_access_logs_guard();

-- 저장소 정책: 올리기 = 내가 만든 '올리는 중' 녹음 자리만, 재생 = 5분 안에 열람 기록을 남긴 사람만
CREATE OR REPLACE FUNCTION public.call_recording_upload_allowed(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM call_recordings r WHERE r.storage_path = p_name AND r.status = 'uploading'
                   AND r.uploaded_by = auth.uid() AND r.device_id IS NULL AND r.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.call_recording_upload_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_recording_upload_allowed(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.call_recording_play_allowed(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM call_recordings r
    WHERE r.storage_path = p_name AND r.deleted_at IS NULL AND r.status IN ('verified', 'mismatch')
      AND public.comm_can(r.office_id, 'comm.recording', r.workspace_key, r.sales_lead_id, r.uploaded_by)
      AND EXISTS (SELECT 1 FROM evidence_access_logs a WHERE a.target_id = r.id::text AND a.user_id = auth.uid()
                    AND a.target_type = 'recording' AND a.created_at > now() - interval '5 minutes'));
$$;
REVOKE ALL ON FUNCTION public.call_recording_play_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_recording_play_allowed(text) TO authenticated;

DROP POLICY IF EXISTS call_recordings_obj_insert ON storage.objects;
CREATE POLICY call_recordings_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND public.call_recording_upload_allowed(name));
DROP POLICY IF EXISTS call_recordings_obj_read ON storage.objects;
CREATE POLICY call_recordings_obj_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'call-recordings' AND public.call_recording_play_allowed(name));

-- 기기 명령 (웹 → 내 업무폰)
CREATE TABLE IF NOT EXISTS public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.office_devices(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('dial', 'sms')),
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  workspace_key text,
  sales_lead_id text,
  phone text NOT NULL,
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'done', 'failed', 'expired', 'cancelled')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS device_commands_device_idx ON public.device_commands (device_id, status, created_at);
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, office_id, device_id, kind, contact_id, workspace_key, sales_lead_id, status, result, requested_by, created_at, delivered_at, finished_at, expires_at)
  ON public.device_commands TO authenticated;
GRANT ALL ON public.device_commands TO service_role;
DROP POLICY IF EXISTS device_commands_read ON public.device_commands;
CREATE POLICY device_commands_read ON public.device_commands FOR SELECT TO authenticated
  USING (requested_by = auth.uid() AND office_id = ANY (public.current_office_ids()));

-- 등록 요청 (앱에서 '이 번호 등록')
CREATE TABLE IF NOT EXISTS public.device_register_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.office_devices(id) ON DELETE SET NULL,
  user_id uuid,
  phone text NOT NULL CHECK (phone ~ '^[0-9]{8,12}$'),
  occurred_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'linked', 'ignored')),
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_register_requests_open_uq ON public.device_register_requests (office_id, phone) WHERE status = 'open';
ALTER TABLE public.device_register_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_register_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.device_register_requests TO authenticated;
GRANT ALL ON public.device_register_requests TO service_role;
DROP POLICY IF EXISTS device_register_requests_read ON public.device_register_requests;
CREATE POLICY device_register_requests_read ON public.device_register_requests FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()) AND public.is_account_active()
         AND (user_id = auth.uid() OR public.office_permission_scope(office_id, 'client.contact') = 'all'));

-- 문구함 (문자·카톡 안내)
CREATE TABLE IF NOT EXISTS public.comm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 40),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  purpose text NOT NULL DEFAULT 'general' CHECK (purpose IN ('general', 'documents', 'schedule', 'payment', 'correction')),
  archived boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comm_templates_office_idx ON public.comm_templates (office_id) WHERE NOT archived;
ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comm_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comm_templates TO authenticated;
GRANT ALL ON public.comm_templates TO service_role;
DROP POLICY IF EXISTS comm_templates_read ON public.comm_templates;
CREATE POLICY comm_templates_read ON public.comm_templates FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));
DROP POLICY IF EXISTS comm_templates_insert ON public.comm_templates;
CREATE POLICY comm_templates_insert ON public.comm_templates FOR INSERT TO authenticated
  WITH CHECK (office_id = ANY (public.current_office_ids()) AND public.is_account_active() AND created_by = auth.uid()
              AND (SELECT count(*) FROM comm_templates t WHERE t.office_id = comm_templates.office_id AND NOT t.archived) < 200);
DROP POLICY IF EXISTS comm_templates_update ON public.comm_templates;
CREATE POLICY comm_templates_update ON public.comm_templates FOR UPDATE TO authenticated
  USING (office_id = ANY (public.current_office_ids()) AND (created_by = auth.uid() OR public.has_office_permission(office_id, 'office.settings.edit')))
  WITH CHECK (office_id = ANY (public.current_office_ids()));

CREATE OR REPLACE FUNCTION public.comm_templates_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.office_id := OLD.office_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := auth.uid(); NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comm_templates_touch ON public.comm_templates;
CREATE TRIGGER comm_templates_touch BEFORE INSERT OR UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION public.comm_templates_touch();

-- ── 3. 웹(로그인 사용자) 함수 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comm_policy_row(p_office_id text) RETURNS public.office_comm_policies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v office_comm_policies%ROWTYPE;
BEGIN
  INSERT INTO office_comm_policies (office_id) VALUES (p_office_id) ON CONFLICT (office_id) DO NOTHING;
  SELECT * INTO v FROM office_comm_policies WHERE office_id = p_office_id;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.comm_policy_row(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_office_comm_policy(p_office_id text) RETURNS public.office_comm_policies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (p_office_id = ANY (public.current_office_ids())) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN public.comm_policy_row(p_office_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_office_comm_policy(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_comm_policy(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_office_comm_policy(p_office_id text, p jsonb, p_expected_version integer DEFAULT NULL)
RETURNS public.office_comm_policies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v office_comm_policies%ROWTYPE;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: office.settings.edit' USING ERRCODE = '42501';
  END IF;
  v := public.comm_policy_row(p_office_id);
  IF p_expected_version IS NOT NULL AND p_expected_version <> v.version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001'; END IF;
  UPDATE office_comm_policies SET
    require_approval = coalesce((p ->> 'require_approval')::boolean, require_approval),
    upload_network = coalesce(p ->> 'upload_network', upload_network),
    upload_recordings = coalesce((p ->> 'upload_recordings')::boolean, upload_recordings),
    auto_transcribe = coalesce((p ->> 'auto_transcribe')::boolean, auto_transcribe),
    app_sms_allowed = coalesce((p ->> 'app_sms_allowed')::boolean, app_sms_allowed),
    sms_daily_limit = coalesce((p ->> 'sms_daily_limit')::integer, sms_daily_limit),
    sms_quiet_start = coalesce((p ->> 'sms_quiet_start')::integer, sms_quiet_start),
    sms_quiet_end = coalesce((p ->> 'sms_quiet_end')::integer, sms_quiet_end),
    staff_notice = coalesce(nullif(btrim(p ->> 'staff_notice'), ''), staff_notice),
    version = version + 1, updated_by = auth.uid(), updated_at = now()
  WHERE office_id = p_office_id RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'settings.comm_policy', 'office_comm_policy', p_office_id,
    jsonb_build_object('fields', (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(p) k)));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_comm_policy(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_comm_policy(text, jsonb, integer) TO authenticated;

-- 연결 코드 (10분·1회용, 평문은 이 응답에서만)
CREATE OR REPLACE FUNCTION public.create_device_pairing_code(p_office_id text, p_label text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_policy office_comm_policies%ROWTYPE;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
  v_exp timestamptz := now() + interval '10 minutes';
  v_pre boolean;
  i integer;
BEGIN
  IF v_member.id IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM device_pairing_codes WHERE user_id = auth.uid() AND used_at IS NULL AND expires_at > now()) >= 3 THEN
    RAISE EXCEPTION 'too many open pairing codes' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM office_devices WHERE office_id = p_office_id AND user_id = auth.uid() AND status <> 'revoked') >= 3 THEN
    RAISE EXCEPTION 'device limit reached' USING ERRCODE = '22023';
  END IF;
  FOR i IN 0..7 LOOP
    v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  v_policy := public.comm_policy_row(p_office_id);
  v_pre := NOT v_policy.require_approval OR public.has_office_permission(p_office_id, 'office.staff');
  INSERT INTO device_pairing_codes (office_id, user_id, member_id, code_hash, label, pre_approved, expires_at)
  VALUES (p_office_id, auth.uid(), v_member.id, encode(extensions.digest(v_code, 'sha256'), 'hex'), left(btrim(coalesce(p_label, '')), 40), v_pre, v_exp);
  PERFORM public.office_log(p_office_id, 'device.pair_code', 'office_device', NULL, jsonb_build_object('pre_approved', v_pre));
  RETURN jsonb_build_object('code', v_code, 'expires_at', v_exp, 'pre_approved', v_pre, 'qr', 'mykim-office://pair?code=' || v_code);
END;
$$;
REVOKE ALL ON FUNCTION public.create_device_pairing_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_device_pairing_code(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_office_device(p_device_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v office_devices%ROWTYPE;
BEGIN
  SELECT * INTO v FROM office_devices WHERE id = p_device_id FOR UPDATE;
  IF v.id IS NULL OR NOT public.has_office_permission(v.office_id, 'office.staff') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: office.staff' USING ERRCODE = '42501';
  END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'device is not waiting for approval' USING ERRCODE = '22023'; END IF;
  UPDATE office_devices SET status = 'active', approved_by = auth.uid(), approved_at = now() WHERE id = p_device_id;
  PERFORM public.office_log(v.office_id, 'device.approve', 'office_device', p_device_id::text, '{}'::jsonb);
  PERFORM public.notify_user(v.user_id, 'office', v.office_id, 'device_approved', '업무폰 연결이 승인됐어요',
    coalesce(nullif(v.label, ''), '업무폰') || ' 기기를 이제 쓸 수 있어요.', 'office_devices', p_device_id::text, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_office_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_office_device(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_office_device(p_device_id uuid, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v office_devices%ROWTYPE; v_own boolean;
BEGIN
  SELECT * INTO v FROM office_devices WHERE id = p_device_id FOR UPDATE;
  IF v.id IS NULL OR NOT (v.office_id = ANY (public.current_office_ids())) THEN RAISE EXCEPTION 'device not found' USING ERRCODE = 'P0002'; END IF;
  v_own := v.user_id = auth.uid();
  IF NOT v_own AND NOT public.has_office_permission(v.office_id, 'office.staff') THEN
    RAISE EXCEPTION 'permission denied: office.staff' USING ERRCODE = '42501';
  END IF;
  IF NOT v_own AND coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  IF v.status = 'revoked' THEN RETURN; END IF;
  UPDATE office_devices SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now(),
         revoke_reason = nullif(left(btrim(coalesce(p_reason, '')), 200), '')
   WHERE id = p_device_id;
  UPDATE device_commands SET status = 'cancelled', finished_at = now() WHERE device_id = p_device_id AND status IN ('pending', 'delivered');
  PERFORM public.office_log(v.office_id, 'device.revoke', 'office_device', p_device_id::text, jsonb_build_object('own', v_own));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_office_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_office_device(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_office_device(p_device_id uuid, p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v office_devices%ROWTYPE;
BEGIN
  SELECT * INTO v FROM office_devices WHERE id = p_device_id FOR UPDATE;
  IF v.id IS NULL OR NOT (v.office_id = ANY (public.current_office_ids()))
     OR NOT (v.user_id = auth.uid() OR public.has_office_permission(v.office_id, 'office.staff')) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  UPDATE office_devices SET
    label = coalesce(left(btrim(p ->> 'label'), 40), label),
    line_label = coalesce(left(btrim(p ->> 'line_label'), 30), line_label),
    line_mode = coalesce(p ->> 'line_mode', line_mode)
  WHERE id = p_device_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_office_device(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_office_device(uuid, jsonb) TO authenticated;

-- 연락처 저장 (사건 작업 공간 키 또는 영업 리드 하나)
CREATE OR REPLACE FUNCTION public.save_client_contact(p_office_id text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v_phone text := public.comm_normalize_phone(p ->> 'phone');
  v_rel text := coalesce(nullif(p ->> 'relation', ''), 'self');
  v client_contacts%ROWTYPE;
  v_shared integer;
BEGIN
  IF (v_key IS NULL) = (v_lead IS NULL) THEN RAISE EXCEPTION 'workspace_key or sales_lead_id required' USING ERRCODE = '22023'; END IF;
  IF (v_key IS NOT NULL AND NOT public.comm_key_in_office(p_office_id, v_key)) OR (v_lead IS NOT NULL AND NOT public.comm_lead_in_office(p_office_id, v_lead)) THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.comm_can(p_office_id, 'client.contact', v_key, v_lead, NULL) THEN RAISE EXCEPTION 'permission denied: client.contact' USING ERRCODE = '42501'; END IF;
  IF v_phone IS NULL OR v_phone !~ '^[0-9]{8,12}$' THEN RAISE EXCEPTION 'invalid phone' USING ERRCODE = '22023'; END IF;
  IF v_rel NOT IN ('self', 'spouse', 'family', 'work', 'other') THEN RAISE EXCEPTION 'invalid relation' USING ERRCODE = '22023'; END IF;

  IF p ? 'id' THEN
    UPDATE client_contacts SET phone = v_phone, device_hash = public.office_device_phone_hash(p_office_id, v_phone), relation = v_rel,
           label = left(btrim(coalesce(p ->> 'label', '')), 40), valid_until = nullif(p ->> 'valid_until', '')::date, updated_at = now()
     WHERE id = (p ->> 'id')::uuid AND office_id = p_office_id AND removed_at IS NULL
       AND workspace_key IS NOT DISTINCT FROM v_key AND sales_lead_id IS NOT DISTINCT FROM v_lead
     RETURNING * INTO v;
    IF v.id IS NULL THEN RAISE EXCEPTION 'contact not found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    IF (SELECT count(*) FROM client_contacts WHERE office_id = p_office_id AND removed_at IS NULL
          AND workspace_key IS NOT DISTINCT FROM v_key AND sales_lead_id IS NOT DISTINCT FROM v_lead) >= 10 THEN
      RAISE EXCEPTION 'too many contacts for this case' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v FROM client_contacts WHERE office_id = p_office_id AND removed_at IS NULL AND phone = v_phone
       AND workspace_key IS NOT DISTINCT FROM v_key AND sales_lead_id IS NOT DISTINCT FROM v_lead FOR UPDATE;
    IF v.id IS NOT NULL THEN
      UPDATE client_contacts SET relation = v_rel, label = left(btrim(coalesce(p ->> 'label', '')), 40),
             valid_until = nullif(p ->> 'valid_until', '')::date, updated_at = now()
       WHERE id = v.id RETURNING * INTO v;
    ELSE
      INSERT INTO client_contacts (office_id, workspace_key, sales_lead_id, phone, device_hash, relation, label, valid_until, created_by)
      VALUES (p_office_id, v_key, v_lead, v_phone, public.office_device_phone_hash(p_office_id, v_phone), v_rel,
              left(btrim(coalesce(p ->> 'label', '')), 40), nullif(p ->> 'valid_until', '')::date, auth.uid())
      RETURNING * INTO v;
    END IF;
  END IF;
  SELECT count(*) INTO v_shared FROM client_contacts c
   WHERE c.office_id = p_office_id AND c.removed_at IS NULL AND c.device_hash = v.device_hash AND c.id <> v.id;
  PERFORM public.office_log(p_office_id, 'contact.save', 'client_contact', v.id::text, jsonb_build_object('relation', v.relation));
  RETURN jsonb_build_object('id', v.id, 'phone', v.phone, 'relation', v.relation, 'label', v.label, 'valid_until', v.valid_until,
                            'workspace_key', v.workspace_key, 'sales_lead_id', v.sales_lead_id, 'shared_count', v_shared);
END;
$$;
REVOKE ALL ON FUNCTION public.save_client_contact(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_contact(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_client_contact(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v client_contacts%ROWTYPE;
BEGIN
  SELECT * INTO v FROM client_contacts WHERE id = p_id AND removed_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR NOT public.comm_can(v.office_id, 'client.contact', v.workspace_key, v.sales_lead_id, NULL) THEN
    RAISE EXCEPTION 'contact not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE client_contacts SET removed_at = now(), updated_at = now() WHERE id = p_id;
  PERFORM public.office_log(v.office_id, 'contact.remove', 'client_contact', p_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.remove_client_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_client_contact(uuid) TO authenticated;

-- 직접 남기는 기록 (사무실 전화·방문·카톡 직접 보냄 등). KT-1 '복사하고 기록'도 이 함수
CREATE OR REPLACE FUNCTION public.record_manual_comm_log(p_office_id text, p jsonb) RETURNS public.client_comm_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v_channel text := coalesce(nullif(p ->> 'channel', ''), 'call');
  v_dir text := coalesce(nullif(p ->> 'direction', ''), 'out');
  v_result text;
  v_at timestamptz := coalesce(nullif(p ->> 'occurred_at', '')::timestamptz, now());
  v_dur integer := nullif(p ->> 'duration_sec', '')::integer;
  v_body text := nullif(left(btrim(coalesce(p ->> 'body', '')), 2000), '');
  v_contact uuid := nullif(p ->> 'contact_id', '')::uuid;
  v client_comm_logs%ROWTYPE;
BEGIN
  IF v_member.id IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF (v_key IS NULL) = (v_lead IS NULL) THEN RAISE EXCEPTION 'workspace_key or sales_lead_id required' USING ERRCODE = '22023'; END IF;
  IF (v_key IS NOT NULL AND NOT public.comm_key_in_office(p_office_id, v_key)) OR (v_lead IS NOT NULL AND NOT public.comm_lead_in_office(p_office_id, v_lead)) THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.comm_can(p_office_id, 'comm.view', v_key, v_lead, NULL) THEN RAISE EXCEPTION 'permission denied: comm.view' USING ERRCODE = '42501'; END IF;
  IF v_channel NOT IN ('call', 'sms', 'kakao', 'visit', 'other') THEN RAISE EXCEPTION 'invalid channel' USING ERRCODE = '22023'; END IF;
  IF v_dir NOT IN ('in', 'out') THEN RAISE EXCEPTION 'invalid direction' USING ERRCODE = '22023'; END IF;
  v_result := coalesce(nullif(p ->> 'result', ''), CASE v_channel WHEN 'call' THEN 'answered' WHEN 'visit' THEN 'unknown'
                                                     ELSE CASE WHEN v_dir = 'out' THEN 'sent' ELSE 'received' END END);
  IF v_at > now() + interval '10 minutes' OR v_at < now() - interval '400 days' THEN RAISE EXCEPTION 'invalid time' USING ERRCODE = '22023'; END IF;
  IF v_contact IS NOT NULL AND NOT EXISTS (SELECT 1 FROM client_contacts c WHERE c.id = v_contact AND c.office_id = p_office_id
       AND c.workspace_key IS NOT DISTINCT FROM v_key AND c.sales_lead_id IS NOT DISTINCT FROM v_lead) THEN
    v_contact := NULL;
  END IF;
  INSERT INTO client_comm_logs (office_id, user_id, member_id, workspace_key, sales_lead_id, contact_id, source, channel, direction, result,
                                duration_sec, line_label, body, occurred_at, content_hash, note, next_contact_at)
  VALUES (p_office_id, auth.uid(), v_member.id, v_key, v_lead, v_contact, CASE WHEN v_channel = 'kakao' THEN 'kakao_manual' ELSE 'manual' END,
          v_channel, v_dir, v_result, v_dur, '', v_body, v_at,
          public.comm_content_hash(v_channel, v_dir, v_result, v_at, v_dur, v_body, ''),
          nullif(left(btrim(coalesce(p ->> 'note', '')), 2000), ''), nullif(p ->> 'next_contact_at', '')::timestamptz)
  RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.record_manual_comm_log(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_comm_log(text, jsonb) TO authenticated;

-- 연결 바꾸기 (내용은 그대로, 이력과 사유)
CREATE OR REPLACE FUNCTION public.relink_comm_log(p_id uuid, p jsonb) RETURNS public.client_comm_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v client_comm_logs%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v_reason text := left(btrim(coalesce(p ->> 'reason', '')), 200);
BEGIN
  SELECT * INTO v FROM client_comm_logs WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL OR NOT public.comm_can(v.office_id, 'comm.view', v.workspace_key, v.sales_lead_id, v.user_id) THEN
    RAISE EXCEPTION 'log not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  IF (v_key IS NULL) = (v_lead IS NULL) THEN RAISE EXCEPTION 'workspace_key or sales_lead_id required' USING ERRCODE = '22023'; END IF;
  IF (v_key IS NOT NULL AND NOT public.comm_key_in_office(v.office_id, v_key)) OR (v_lead IS NOT NULL AND NOT public.comm_lead_in_office(v.office_id, v_lead))
     OR NOT public.comm_can(v.office_id, 'comm.view', v_key, v_lead, NULL) THEN
    RAISE EXCEPTION 'target not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE client_comm_logs SET workspace_key = v_key, sales_lead_id = v_lead, contact_id = NULL, link_status = 'linked', candidates = '[]'::jsonb,
         link_history = link_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'from_key', v.workspace_key,
                          'from_lead', v.sales_lead_id, 'to_key', v_key, 'to_lead', v_lead, 'reason', v_reason))
   WHERE id = p_id RETURNING * INTO v;
  UPDATE call_recordings SET workspace_key = v_key, sales_lead_id = v_lead WHERE comm_log_id = p_id;
  PERFORM public.office_log(v.office_id, 'comm.relink', 'client_comm_log', p_id::text, jsonb_build_object('reason', v_reason));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.relink_comm_log(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relink_comm_log(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_comm_log_note(p_id uuid, p_note text, p_next_contact_at timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v client_comm_logs%ROWTYPE;
BEGIN
  SELECT * INTO v FROM client_comm_logs WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL OR NOT public.comm_can(v.office_id, 'comm.view', v.workspace_key, v.sales_lead_id, v.user_id) THEN
    RAISE EXCEPTION 'log not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE client_comm_logs SET note = nullif(left(btrim(coalesce(p_note, '')), 2000), ''), next_contact_at = p_next_contact_at WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_comm_log_note(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_comm_log_note(uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.recording_ext_for(p_mime text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_mime WHEN 'audio/mp4' THEN 'm4a' WHEN 'audio/m4a' THEN 'm4a' WHEN 'audio/x-m4a' THEN 'm4a' WHEN 'audio/aac' THEN 'aac'
    WHEN 'audio/mpeg' THEN 'mp3' WHEN 'audio/amr' THEN 'amr' WHEN 'audio/3gpp' THEN '3gp' WHEN 'audio/ogg' THEN 'ogg'
    WHEN 'audio/wav' THEN 'wav' WHEN 'audio/x-wav' THEN 'wav' WHEN 'audio/webm' THEN 'webm' ELSE NULL END;
$$;

-- 녹음 자리 만들기 (웹 올리기·기기 올리기 공통 본문)
CREATE OR REPLACE FUNCTION public.call_recording_slot(p_office_id text, p jsonb, p_user uuid, p_device uuid) RETURNS public.call_recordings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v_log uuid := nullif(p ->> 'comm_log_id', '')::uuid;
  v_mime text := lower(coalesce(p ->> 'mime_type', ''));
  v_ext text := public.recording_ext_for(lower(coalesce(p ->> 'mime_type', '')));
  v_sha text := lower(coalesce(p ->> 'sha256', ''));
  v_size bigint := nullif(p ->> 'size_bytes', '')::bigint;
  v_id uuid := gen_random_uuid();
  v call_recordings%ROWTYPE;
BEGIN
  IF v_ext IS NULL THEN RAISE EXCEPTION 'unsupported audio type' USING ERRCODE = '22023'; END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'sha256 required' USING ERRCODE = '22023'; END IF;
  IF v_size IS NULL OR v_size < 1 OR v_size > 52428800 THEN RAISE EXCEPTION 'file too large (50MB)' USING ERRCODE = '22023'; END IF;
  IF v_log IS NOT NULL THEN
    SELECT workspace_key, sales_lead_id INTO v_key, v_lead FROM client_comm_logs WHERE id = v_log AND office_id = p_office_id AND channel = 'call';
    IF NOT FOUND THEN RAISE EXCEPTION 'call log not found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF v_key IS NULL AND v_lead IS NULL THEN RAISE EXCEPTION 'workspace_key or sales_lead_id required' USING ERRCODE = '22023'; END IF;
  IF v_key IS NOT NULL AND v_key !~ '^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'invalid workspace key' USING ERRCODE = '22023'; END IF;
  IF v_lead IS NOT NULL AND v_lead !~ '^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'invalid lead id' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM call_recordings WHERE uploaded_by = p_user AND status = 'uploading' AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'too many uploads in progress' USING ERRCODE = '22023';
  END IF;
  INSERT INTO call_recordings (id, office_id, comm_log_id, workspace_key, sales_lead_id, storage_path, original_name, mime_type, size_bytes,
                               duration_sec, recorded_at, device_id, uploaded_by, device_sha256)
  VALUES (v_id, p_office_id, v_log, v_key, v_lead,
          p_office_id || '/' || coalesce(v_key, 'lead-' || v_lead) || '/' || v_id || '.' || v_ext,
          left(coalesce(p ->> 'original_name', ''), 200), v_mime, v_size, nullif(p ->> 'duration_sec', '')::integer,
          nullif(p ->> 'recorded_at', '')::timestamptz, p_device, p_user, v_sha)
  RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.call_recording_slot(text, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_call_recording_upload(p_office_id text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p ->> 'workspace_key', '')), '');
  v_lead text := nullif(btrim(coalesce(p ->> 'sales_lead_id', '')), '');
  v call_recordings%ROWTYPE;
BEGIN
  IF p ? 'comm_log_id' AND nullif(p ->> 'comm_log_id', '') IS NOT NULL THEN
    SELECT workspace_key, sales_lead_id INTO v_key, v_lead FROM client_comm_logs WHERE id = (p ->> 'comm_log_id')::uuid AND office_id = p_office_id;
  END IF;
  IF (v_key IS NOT NULL AND NOT public.comm_key_in_office(p_office_id, v_key)) OR (v_lead IS NOT NULL AND NOT public.comm_lead_in_office(p_office_id, v_lead)) THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.comm_can(p_office_id, 'comm.recording', v_key, v_lead, NULL) THEN RAISE EXCEPTION 'permission denied: comm.recording' USING ERRCODE = '42501'; END IF;
  v := public.call_recording_slot(p_office_id, p || jsonb_build_object('workspace_key', v_key, 'sales_lead_id', v_lead), auth.uid(), NULL);
  PERFORM public.office_log(p_office_id, 'recording.upload', 'call_recording', v.id::text, jsonb_build_object('size', v.size_bytes));
  RETURN jsonb_build_object('id', v.id, 'path', v.storage_path);
END;
$$;
REVOKE ALL ON FUNCTION public.create_call_recording_upload(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_call_recording_upload(text, jsonb) TO authenticated;

-- 재생·내려받기 전 열람 기록 (저장소 읽기 정책이 5분 안 기록을 요구)
CREATE OR REPLACE FUNCTION public.log_evidence_access(p_recording_id uuid, p_action text DEFAULT 'play') RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v call_recordings%ROWTYPE;
BEGIN
  IF p_action NOT IN ('play', 'download', 'view_transcript') THEN RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM call_recordings WHERE id = p_recording_id AND deleted_at IS NULL;
  IF v.id IS NULL OR v.status NOT IN ('verified', 'mismatch')
     OR NOT public.comm_can(v.office_id, 'comm.recording', v.workspace_key, v.sales_lead_id, v.uploaded_by) THEN
    RAISE EXCEPTION 'recording not available' USING ERRCODE = '42501';
  END IF;
  INSERT INTO evidence_access_logs (office_id, user_id, member_id, target_type, target_id, action, ip_address)
  VALUES (v.office_id, auth.uid(), (public.current_office_member(v.office_id)).id, 'recording', v.id::text, p_action, public.request_client_ip());
  RETURN v.storage_path;
END;
$$;
REVOKE ALL ON FUNCTION public.log_evidence_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_evidence_access(uuid, text) TO authenticated;

-- 웹 → 내 업무폰 명령
CREATE OR REPLACE FUNCTION public.create_device_command(p_device_id uuid, p_kind text, p_contact_id uuid, p_body text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  c client_contacts%ROWTYPE;
  v_policy office_comm_policies%ROWTYPE;
  v_hour integer := extract(hour FROM now() AT TIME ZONE 'Asia/Seoul')::integer;
  v_quiet boolean;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  SELECT * INTO d FROM office_devices WHERE id = p_device_id;
  IF d.id IS NULL OR d.user_id <> auth.uid() OR d.status <> 'active' OR NOT (d.office_id = ANY (public.current_office_ids())) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'device not available' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM client_contacts WHERE id = p_contact_id AND office_id = d.office_id AND removed_at IS NULL;
  IF c.id IS NULL OR NOT public.comm_can(d.office_id, 'client.contact', c.workspace_key, c.sales_lead_id, NULL) THEN
    RAISE EXCEPTION 'contact not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_kind NOT IN ('dial', 'sms') THEN RAISE EXCEPTION 'invalid command' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM device_commands WHERE device_id = p_device_id AND status IN ('pending', 'delivered') AND expires_at > now()) >= 5 THEN
    RAISE EXCEPTION 'too many waiting commands' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'sms' THEN
    v_policy := public.comm_policy_row(d.office_id);
    IF NOT v_policy.app_sms_allowed THEN RAISE EXCEPTION 'app sms disabled by office policy' USING ERRCODE = '42501'; END IF;
    IF coalesce(btrim(p_body), '') = '' OR char_length(p_body) > 2000 THEN RAISE EXCEPTION 'message required' USING ERRCODE = '22023'; END IF;
    v_quiet := CASE WHEN v_policy.sms_quiet_start = v_policy.sms_quiet_end THEN false
                    WHEN v_policy.sms_quiet_start > v_policy.sms_quiet_end THEN v_hour >= v_policy.sms_quiet_start OR v_hour < v_policy.sms_quiet_end
                    ELSE v_hour >= v_policy.sms_quiet_start AND v_hour < v_policy.sms_quiet_end END;
    IF v_quiet THEN RAISE EXCEPTION 'quiet hours' USING ERRCODE = '22023'; END IF;
    IF (SELECT count(*) FROM device_commands WHERE device_id = p_device_id AND kind = 'sms' AND status <> 'cancelled'
          AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date) >= v_policy.sms_daily_limit THEN
      RAISE EXCEPTION 'daily sms limit reached' USING ERRCODE = '22023';
    END IF;
    v_exp := now() + interval '30 minutes';
  ELSE
    v_exp := now() + interval '2 minutes';
  END IF;
  INSERT INTO device_commands (office_id, device_id, kind, contact_id, workspace_key, sales_lead_id, phone, body, requested_by, expires_at)
  VALUES (d.office_id, d.id, p_kind, c.id, c.workspace_key, c.sales_lead_id, c.phone,
          CASE WHEN p_kind = 'sms' THEN btrim(p_body) END, auth.uid(), v_exp)
  RETURNING id INTO v_id;
  PERFORM public.office_log(d.office_id, 'device.command', 'device_command', v_id::text, jsonb_build_object('kind', p_kind));
  RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp);
END;
$$;
REVOKE ALL ON FUNCTION public.create_device_command(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_device_command(uuid, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_device_command(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE device_commands SET status = 'cancelled', finished_at = now()
   WHERE id = p_id AND requested_by = auth.uid() AND status IN ('pending', 'delivered');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_device_command(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_device_command(uuid) TO authenticated;

-- 등록 요청 처리: 사건·리드에 연결(연락처 저장) 또는 무시
CREATE OR REPLACE FUNCTION public.resolve_device_register_request(p_id uuid, p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r device_register_requests%ROWTYPE;
  v_saved jsonb;
BEGIN
  SELECT * INTO r FROM device_register_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR NOT (r.office_id = ANY (public.current_office_ids()))
     OR NOT (r.user_id = auth.uid() OR public.office_permission_scope(r.office_id, 'client.contact') = 'all') THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'request already handled' USING ERRCODE = '22023'; END IF;
  IF coalesce(p ->> 'action', '') = 'ignore' THEN
    UPDATE device_register_requests SET status = 'ignored', resolved_by = auth.uid(), resolved_at = now() WHERE id = p_id;
  ELSIF coalesce(p ->> 'action', '') = 'link' THEN
    v_saved := public.save_client_contact(r.office_id, jsonb_build_object('workspace_key', p ->> 'workspace_key', 'sales_lead_id', p ->> 'sales_lead_id',
                 'phone', r.phone, 'relation', coalesce(p ->> 'relation', 'self'), 'label', coalesce(p ->> 'label', '')));
    UPDATE device_register_requests SET status = 'linked', contact_id = (v_saved ->> 'id')::uuid, resolved_by = auth.uid(), resolved_at = now() WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_device_register_request(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_device_register_request(uuid, jsonb) TO authenticated;

-- ── 4. 기기 API 함수 (service_role 전용, api/device.js만 부름) ──────────────
CREATE OR REPLACE FUNCTION public.device_pair(p_code text, p_token_hash text, p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c device_pairing_codes%ROWTYPE;
  m office_members%ROWTYPE;
  v_id uuid;
  v_status text;
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  SELECT * INTO c FROM device_pairing_codes
   WHERE code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') FOR UPDATE;
  IF c.id IS NULL OR c.used_at IS NOT NULL OR c.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  SELECT mm.* INTO m FROM office_members mm JOIN offices o ON o.id = mm.office_id AND o.status = 'active'
   WHERE mm.id = c.member_id AND mm.status = 'active';
  IF m.id IS NULL OR NOT public.is_account_active(c.user_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'member_inactive'); END IF;
  v_status := CASE WHEN c.pre_approved THEN 'active' ELSE 'pending' END;
  INSERT INTO office_devices (office_id, user_id, member_id, label, line_label, line_mode, model, os_version, app_version, token_hash, status,
                              approved_at, approved_by, permissions)
  VALUES (c.office_id, c.user_id, c.member_id, left(coalesce(nullif(c.label, ''), p ->> 'label', ''), 40), left(coalesce(p ->> 'line_label', ''), 30),
          CASE WHEN p ->> 'line_mode' = 'shared' THEN 'shared' ELSE 'personal' END,
          left(coalesce(p ->> 'model', ''), 60), left(coalesce(p ->> 'os_version', ''), 20), left(coalesce(p ->> 'app_version', ''), 20),
          p_token_hash, v_status, CASE WHEN c.pre_approved THEN now() END, CASE WHEN c.pre_approved THEN c.user_id END,
          CASE WHEN jsonb_typeof(p -> 'permissions') = 'object' THEN p -> 'permissions' ELSE '{}'::jsonb END)
  RETURNING id INTO v_id;
  UPDATE device_pairing_codes SET used_at = now(), device_id = v_id WHERE id = c.id;
  PERFORM public.device_office_log(c.office_id, c.user_id, c.member_id, 'device.pair', 'office_device', v_id::text, jsonb_build_object('status', v_status));
  IF v_status = 'pending' THEN
    PERFORM public.notify_office_members(c.office_id, 'office.staff', NULL, 'device_pending', '업무폰 연결 승인 요청',
      coalesce(nullif(m.display_name, ''), '직원') || '님이 업무폰을 연결했어요. 승인해야 기록이 올라와요.', 'office_devices', v_id::text, 'device_pending:' || v_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'device_id', v_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_auth(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM office_devices WHERE token_hash = p_token_hash;
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unknown_device', 'wipe', true); END IF;
  IF d.status = 'revoked' THEN RETURN jsonb_build_object('ok', false, 'error', 'revoked', 'wipe', true); END IF;
  IF NOT EXISTS (SELECT 1 FROM office_members m JOIN offices o ON o.id = m.office_id AND o.status = 'active'
                  WHERE m.id = d.member_id AND m.user_id = d.user_id AND m.status = 'active')
     OR NOT public.is_account_active(d.user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_inactive', 'wipe', true);
  END IF;
  IF d.last_seen_at IS NULL OR d.last_seen_at < now() - interval '1 minute' THEN
    UPDATE office_devices SET last_seen_at = now() WHERE id = d.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'device_id', d.id, 'office_id', d.office_id, 'user_id', d.user_id, 'member_id', d.member_id, 'status', d.status);
END;
$$;

-- 활성 기기만 (승인 대기 기기는 연결 정보·정책만 받는다)
CREATE OR REPLACE FUNCTION public.device_require_active(p_device_id uuid) RETURNS public.office_devices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM office_devices WHERE id = p_device_id;
  IF d.id IS NULL OR d.status <> 'active' THEN RAISE EXCEPTION 'device not active' USING ERRCODE = '42501'; END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.device_heartbeat(p_device_id uuid, p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  pol office_comm_policies%ROWTYPE;
  v_skew integer;
  v_office offices%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO d FROM office_devices WHERE id = p_device_id AND status <> 'revoked';
  IF d.id IS NULL THEN RAISE EXCEPTION 'device not found' USING ERRCODE = 'P0002'; END IF;
  BEGIN
    v_skew := round(extract(epoch FROM ((p ->> 'device_time')::timestamptz - now())))::integer;
  EXCEPTION WHEN OTHERS THEN v_skew := NULL;
  END;
  UPDATE office_devices SET
    app_version = coalesce(left(p ->> 'app_version', 20), app_version),
    os_version = coalesce(left(p ->> 'os_version', 20), os_version),
    model = coalesce(left(p ->> 'model', 60), model),
    permissions = CASE WHEN jsonb_typeof(p -> 'permissions') = 'object' THEN p -> 'permissions' ELSE permissions END,
    pending_uploads = coalesce(greatest(0, least((p ->> 'pending_uploads')::integer, 100000)), pending_uploads),
    failed_uploads = coalesce(greatest(0, least((p ->> 'failed_uploads')::integer, 100000)), failed_uploads),
    clock_skew_sec = coalesce(v_skew, clock_skew_sec),
    last_seen_at = now()
  WHERE id = d.id;
  pol := public.comm_policy_row(d.office_id);
  SELECT * INTO v_office FROM offices WHERE id = d.office_id;
  SELECT display_name INTO v_name FROM office_members WHERE id = d.member_id;
  RETURN jsonb_build_object(
    'status', d.status,
    'server_time', now(),
    'clock_warning', v_skew IS NOT NULL AND abs(v_skew) > 120,
    'office_name', v_office.name,
    'member_name', coalesce(v_name, ''),
    'label', d.label,
    'line_label', d.line_label,
    'line_mode', d.line_mode,
    'hash', jsonb_build_object('alg', 'hmac-sha256', 'salt', v_office.device_hash_salt, 'normalize', 'digits only; leading 82 -> 0'),
    'policy', jsonb_build_object('upload_network', pol.upload_network, 'upload_recordings', pol.upload_recordings,
                                 'app_sms_allowed', pol.app_sms_allowed, 'sms_daily_limit', pol.sms_daily_limit,
                                 'sms_quiet_start', pol.sms_quiet_start, 'sms_quiet_end', pol.sms_quiet_end, 'version', pol.version),
    'staff_notice', pol.staff_notice);
END;
$$;

-- 연락처 해시 목록 (p_since 없으면 전체, 있으면 바뀐 것 + 지운 것)
CREATE OR REPLACE FUNCTION public.device_contacts(p_device_id uuid, p_since timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE; v_items jsonb;
BEGIN
  d := public.device_require_active(p_device_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('h', c.device_hash,
           'removed', c.removed_at IS NOT NULL OR (c.valid_until IS NOT NULL AND c.valid_until < (now() AT TIME ZONE 'Asia/Seoul')::date))), '[]'::jsonb)
    INTO v_items
  FROM (SELECT * FROM client_contacts c
        WHERE c.office_id = d.office_id
          AND (CASE WHEN p_since IS NULL THEN c.removed_at IS NULL ELSE c.updated_at > p_since OR c.valid_until = (now() AT TIME ZONE 'Asia/Seoul')::date - 1 END)
        ORDER BY c.updated_at LIMIT 5000) c;
  RETURN jsonb_build_object('items', v_items, 'full', p_since IS NULL, 'server_time', now());
END;
$$;

-- 걸려 온 번호 1건 → 화면용 정보 (가명·단계만, 실명·채무 없음)
CREATE OR REPLACE FUNCTION public.device_lookup(p_device_id uuid, p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  c client_contacts%ROWTYPE;
  v_targets integer;
  v_case uuid;
  v_label text;
  v_stage text;
  v_type text;
BEGIN
  d := public.device_require_active(p_device_id);
  SELECT count(DISTINCT coalesce(workspace_key, 'lead:' || sales_lead_id)) INTO v_targets FROM client_contacts
   WHERE office_id = d.office_id AND device_hash = lower(coalesce(p_hash, '')) AND removed_at IS NULL;
  IF v_targets = 0 THEN RETURN jsonb_build_object('found', false); END IF;
  IF v_targets > 1 THEN RETURN jsonb_build_object('found', true, 'multiple', true, 'count', v_targets); END IF;
  SELECT * INTO c FROM client_contacts WHERE office_id = d.office_id AND device_hash = lower(p_hash) AND removed_at IS NULL LIMIT 1;
  IF c.workspace_key IS NOT NULL THEN
    v_case := public.crm_client_case_id(d.office_id, c.workspace_key);
    IF v_case IS NOT NULL THEN
      SELECT coalesce(nullif(cs.title, ''), nullif(oc.display_name, ''), '의뢰인'), sd.office_label, cs.case_type
        INTO v_label, v_stage, v_type
      FROM cases cs JOIN office_clients oc ON oc.id = cs.office_client_id
      LEFT JOIN case_stage_definitions sd ON sd.case_type = cs.case_type AND sd.code = cs.stage
      WHERE cs.id = v_case;
    ELSE
      SELECT public.consult_request_alias(r) INTO v_label FROM consult_requests r WHERE r.id = c.workspace_key;
      v_stage := '상담';
    END IF;
  ELSE
    v_label := '영업 리드'; v_stage := '영업';
  END IF;
  RETURN jsonb_build_object('found', true, 'multiple', false, 'label', coalesce(v_label, '의뢰인'), 'stage', coalesce(v_stage, ''),
                            'case_type', v_type, 'relation', c.relation, 'contact_label', c.label);
END;
$$;

-- 통화·문자 기록 묶음 (최대 200건). 등록 번호와 맞는 것만 저장, 나머지는 버림
CREATE OR REPLACE FUNCTION public.device_ingest_logs(p_device_id uuid, p_logs jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  it jsonb;
  v_key text;
  v_h text;
  v_ch text;
  v_dir text;
  v_res text;
  v_at timestamptz;
  v_dur integer;
  v_body text;
  v_targets jsonb;
  v_n integer;
  v_contact client_contacts%ROWTYPE;
  v_accepted text[] := '{}';
  v_ignored text[] := '{}';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  d := public.device_require_active(p_device_id);
  IF jsonb_typeof(p_logs) <> 'array' THEN RAISE EXCEPTION 'logs must be an array' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(p_logs) > 200 THEN RAISE EXCEPTION 'too many logs (200)' USING ERRCODE = '22023'; END IF;
  FOR it IN SELECT value FROM jsonb_array_elements(p_logs) LOOP
    v_key := left(nullif(btrim(coalesce(it ->> 'key', '')), ''), 120);
    IF v_key IS NULL THEN CONTINUE; END IF;
    BEGIN
      v_h := lower(coalesce(it ->> 'h', ''));
      v_ch := coalesce(it ->> 'channel', '');
      v_dir := coalesce(it ->> 'direction', '');
      v_res := coalesce(nullif(it ->> 'result', ''), 'unknown');
      v_at := (it ->> 'occurred_at')::timestamptz;
      v_dur := nullif(it ->> 'duration_sec', '')::integer;
      v_body := CASE WHEN v_ch IN ('sms', 'mms') THEN nullif(left(coalesce(it ->> 'body', ''), 2000), '') END;
      IF v_ch NOT IN ('call', 'sms', 'mms') OR v_dir NOT IN ('in', 'out')
         OR v_res NOT IN ('answered', 'missed', 'rejected', 'sent', 'failed', 'received', 'unknown')
         OR v_at IS NULL OR v_at > now() + interval '1 day' OR v_at < now() - interval '400 days'
         OR (v_dur IS NOT NULL AND (v_dur < 0 OR v_dur > 86400)) THEN
        v_ignored := array_append(v_ignored, v_key); CONTINUE;
      END IF;
      SELECT count(DISTINCT coalesce(c.workspace_key, 'lead:' || c.sales_lead_id)),
             coalesce(jsonb_agg(DISTINCT jsonb_build_object('workspace_key', c.workspace_key, 'sales_lead_id', c.sales_lead_id)), '[]'::jsonb)
        INTO v_n, v_targets
      FROM client_contacts c
      WHERE c.office_id = d.office_id AND c.device_hash = v_h AND c.removed_at IS NULL
        AND (c.valid_until IS NULL OR c.valid_until >= v_today);
      IF v_n = 0 THEN v_ignored := array_append(v_ignored, v_key); CONTINUE; END IF;
      v_contact := NULL;
      IF v_n = 1 THEN
        SELECT * INTO v_contact FROM client_contacts c WHERE c.office_id = d.office_id AND c.device_hash = v_h AND c.removed_at IS NULL
           AND (c.valid_until IS NULL OR c.valid_until >= v_today) ORDER BY (c.relation = 'self') DESC, c.created_at LIMIT 1;
      END IF;
      INSERT INTO client_comm_logs (office_id, device_id, user_id, member_id, workspace_key, sales_lead_id, contact_id, link_status, candidates,
                                    source, channel, direction, result, duration_sec, line_label, body, occurred_at, device_record_key, content_hash)
      VALUES (d.office_id, d.id, d.user_id, d.member_id, v_contact.workspace_key, v_contact.sales_lead_id, v_contact.id,
              CASE WHEN v_n = 1 THEN 'linked' ELSE 'needs_review' END, CASE WHEN v_n = 1 THEN '[]'::jsonb ELSE v_targets END,
              'app', v_ch, v_dir, v_res, v_dur, d.line_label, v_body, v_at, v_key,
              public.comm_content_hash(v_ch, v_dir, v_res, v_at, v_dur, v_body, d.line_label))
      ON CONFLICT (device_id, device_record_key) WHERE device_id IS NOT NULL AND device_record_key IS NOT NULL DO NOTHING;
      v_accepted := array_append(v_accepted, v_key);
    EXCEPTION WHEN OTHERS THEN
      v_ignored := array_append(v_ignored, v_key);
    END;
  END LOOP;
  RETURN jsonb_build_object('accepted', to_jsonb(v_accepted), 'ignored', to_jsonb(v_ignored));
END;
$$;

-- 녹음 올리기 준비 (기기): 이미 받은 통화 기록에만
CREATE OR REPLACE FUNCTION public.device_recording_init(p_device_id uuid, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  v_log client_comm_logs%ROWTYPE;
  v_rec call_recordings%ROWTYPE;
  pol office_comm_policies%ROWTYPE;
BEGIN
  d := public.device_require_active(p_device_id);
  pol := public.comm_policy_row(d.office_id);
  IF NOT pol.upload_recordings THEN RETURN jsonb_build_object('ok', false, 'error', 'recordings_disabled'); END IF;
  SELECT * INTO v_log FROM client_comm_logs WHERE device_id = d.id AND device_record_key = left(p ->> 'log_key', 120) AND channel = 'call';
  IF v_log.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'call_log_not_found'); END IF;
  SELECT * INTO v_rec FROM call_recordings WHERE comm_log_id = v_log.id AND status = 'verified' AND deleted_at IS NULL LIMIT 1;
  IF v_rec.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'exists', true, 'id', v_rec.id); END IF;
  v_rec := public.call_recording_slot(d.office_id, p || jsonb_build_object('comm_log_id', v_log.id), d.user_id, d.id);
  RETURN jsonb_build_object('ok', true, 'exists', false, 'id', v_rec.id, 'path', v_rec.storage_path);
END;
$$;

-- 올린 뒤 서버 지문 기록 (기기·웹 공통, api가 파일을 내려받아 계산)
CREATE OR REPLACE FUNCTION public.finish_call_recording(p_id uuid, p_server_sha text, p_size bigint, p_actor uuid, p_device uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r call_recordings%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO r FROM call_recordings WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR r.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF (p_device IS NOT NULL AND r.device_id IS DISTINCT FROM p_device) OR (p_device IS NULL AND (r.device_id IS NOT NULL OR r.uploaded_by IS DISTINCT FROM p_actor)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;
  IF r.status <> 'uploading' THEN RETURN jsonb_build_object('ok', true, 'status', r.status); END IF;
  IF p_server_sha IS NULL THEN
    v_status := 'failed';
  ELSE
    v_status := CASE WHEN lower(p_server_sha) = r.device_sha256 THEN 'verified' ELSE 'mismatch' END;
  END IF;
  UPDATE call_recordings SET status = v_status, server_sha256 = lower(p_server_sha), size_bytes = coalesce(p_size, size_bytes),
         verified_at = CASE WHEN p_server_sha IS NOT NULL THEN now() END,
         deleted_at = CASE WHEN v_status = 'failed' THEN now() ELSE deleted_at END
   WHERE id = p_id;
  PERFORM public.device_office_log(r.office_id, r.uploaded_by, NULL, 'recording.' || v_status, 'call_recording', r.id::text, jsonb_build_object('size', p_size));
  IF v_status = 'mismatch' THEN
    PERFORM public.notify_office_members(r.office_id, 'comm.recording', public.crm_client_case_id(r.office_id, r.workspace_key), 'recording_mismatch',
      '녹음 파일 지문이 맞지 않아요', '올린 녹음 파일이 기기에서 계산한 지문과 달라요. 원본을 다시 올려 주세요.', 'case_comm', coalesce(r.workspace_key, ''), 'recording_mismatch:' || r.id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_add_note(p_device_id uuid, p_log_key text, p_note text, p_next_contact_at timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE; v_id uuid;
BEGIN
  d := public.device_require_active(p_device_id);
  UPDATE client_comm_logs SET note = nullif(left(btrim(coalesce(p_note, '')), 2000), ''), next_contact_at = p_next_contact_at
   WHERE device_id = d.id AND device_record_key = left(p_log_key, 120) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', v_id IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_register_request(p_device_id uuid, p_phone text, p_occurred_at timestamptz DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  v_phone text := public.comm_normalize_phone(p_phone);
  v_id uuid;
BEGIN
  d := public.device_require_active(p_device_id);
  IF v_phone IS NULL OR v_phone !~ '^[0-9]{8,12}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone'); END IF;
  IF EXISTS (SELECT 1 FROM client_contacts WHERE office_id = d.office_id AND phone = v_phone AND removed_at IS NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_registered', true);
  END IF;
  IF (SELECT count(*) FROM device_register_requests WHERE office_id = d.office_id AND status = 'open') >= 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_requests');
  END IF;
  INSERT INTO device_register_requests (office_id, device_id, user_id, phone, occurred_at, note)
  VALUES (d.office_id, d.id, d.user_id, v_phone, p_occurred_at, nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  ON CONFLICT (office_id, phone) WHERE status = 'open'
  DO UPDATE SET occurred_at = EXCLUDED.occurred_at, note = coalesce(EXCLUDED.note, device_register_requests.note)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_pull_commands(p_device_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE; v_items jsonb;
BEGIN
  d := public.device_require_active(p_device_id);
  UPDATE device_commands SET status = 'expired', finished_at = now()
   WHERE device_id = d.id AND status IN ('pending', 'delivered') AND expires_at <= now();
  WITH upd AS (
    UPDATE device_commands SET status = 'delivered', delivered_at = coalesce(delivered_at, now())
     WHERE device_id = d.id AND status IN ('pending', 'delivered') AND expires_at > now()
     RETURNING id, kind, phone, body, expires_at, created_at)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'phone', phone, 'body', body, 'expires_at', expires_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_items FROM upd;
  RETURN jsonb_build_object('items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_command_result(p_device_id uuid, p_id uuid, p_status text, p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d office_devices%ROWTYPE;
  c device_commands%ROWTYPE;
BEGIN
  d := public.device_require_active(p_device_id);
  IF p_status NOT IN ('done', 'failed') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_status'); END IF;
  SELECT * INTO c FROM device_commands WHERE id = p_id AND device_id = d.id FOR UPDATE;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF c.status NOT IN ('pending', 'delivered') THEN RETURN jsonb_build_object('ok', true, 'status', c.status); END IF;
  UPDATE device_commands SET status = p_status, finished_at = now(),
         result = jsonb_build_object('detail', left(coalesce(p ->> 'detail', ''), 200), 'parts', (p ->> 'parts'))
   WHERE id = c.id;
  IF c.kind = 'sms' AND p_status = 'done' THEN
    INSERT INTO client_comm_logs (office_id, device_id, user_id, member_id, workspace_key, sales_lead_id, contact_id, source, channel, direction,
                                  result, line_label, body, occurred_at, device_record_key, content_hash)
    VALUES (d.office_id, d.id, d.user_id, d.member_id, c.workspace_key, c.sales_lead_id, c.contact_id, 'app', 'sms', 'out', 'sent',
            d.line_label, c.body, now(), 'cmd-' || c.id, public.comm_content_hash('sms', 'out', 'sent', now(), NULL, c.body, d.line_label))
    ON CONFLICT (device_id, device_record_key) WHERE device_id IS NOT NULL AND device_record_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_unpair(p_device_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d office_devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM office_devices WHERE id = p_device_id FOR UPDATE;
  IF d.id IS NULL OR d.status = 'revoked' THEN RETURN jsonb_build_object('ok', true); END IF;
  UPDATE office_devices SET status = 'revoked', revoked_at = now(), revoked_by = d.user_id, revoke_reason = '앱에서 연결 해제' WHERE id = d.id;
  UPDATE device_commands SET status = 'cancelled', finished_at = now() WHERE device_id = d.id AND status IN ('pending', 'delivered');
  PERFORM public.device_office_log(d.office_id, d.user_id, d.member_id, 'device.unpair', 'office_device', d.id::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.device_pair(text, text, jsonb)', 'public.device_auth(text)', 'public.device_require_active(uuid)',
    'public.device_heartbeat(uuid, jsonb)', 'public.device_contacts(uuid, timestamptz)', 'public.device_lookup(uuid, text)',
    'public.device_ingest_logs(uuid, jsonb)', 'public.device_recording_init(uuid, jsonb)',
    'public.finish_call_recording(uuid, text, bigint, uuid, uuid)', 'public.device_add_note(uuid, text, text, timestamptz)',
    'public.device_register_request(uuid, text, timestamptz, text)', 'public.device_pull_commands(uuid)',
    'public.device_command_result(uuid, uuid, text, jsonb)', 'public.device_unpair(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;

-- ── 5. 사건 이관·파기와 함께 ─────────────────────────────────────────────────
-- 영업 리드 → 사건 이관: 기록은 복사하지 않고 연결만 옮긴다
CREATE OR REPLACE FUNCTION public.trg_comm_follow_lead_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text := 'case-' || NEW.id;
BEGIN
  IF NEW.sales_lead_id IS NULL THEN RETURN NEW; END IF;
  UPDATE client_contacts SET workspace_key = v_key, sales_lead_id = NULL, updated_at = now()
   WHERE office_id = NEW.office_id AND sales_lead_id = NEW.sales_lead_id AND removed_at IS NULL;
  UPDATE client_comm_logs SET workspace_key = v_key, sales_lead_id = NULL,
         link_history = link_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'from_lead', NEW.sales_lead_id,
                          'to_key', v_key, 'reason', '영업 리드를 사건으로 이관'))
   WHERE office_id = NEW.office_id AND sales_lead_id = NEW.sales_lead_id;
  UPDATE call_recordings SET workspace_key = v_key, sales_lead_id = NULL WHERE office_id = NEW.office_id AND sales_lead_id = NEW.sales_lead_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'comm lead conversion: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comm_follow_lead_conversion ON public.cases;
CREATE TRIGGER comm_follow_lead_conversion AFTER INSERT ON public.cases FOR EACH ROW EXECUTE FUNCTION public.trg_comm_follow_lead_conversion();

-- 사건 파기 → 그 사건 소통 기록 삭제, 녹음은 저장소 삭제 대기, 연락처 삭제
CREATE OR REPLACE FUNCTION public.comm_purge_target(p_office_id text, p_keys text[], p_lead text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('mykim.comm_purge', 'on', true);
  UPDATE call_recordings SET deleted_at = coalesce(deleted_at, now()), comm_log_id = NULL
   WHERE office_id = p_office_id AND (workspace_key = ANY (p_keys) OR (p_lead IS NOT NULL AND sales_lead_id = p_lead));
  DELETE FROM client_comm_logs WHERE office_id = p_office_id AND (workspace_key = ANY (p_keys) OR (p_lead IS NOT NULL AND sales_lead_id = p_lead));
  DELETE FROM device_commands WHERE office_id = p_office_id AND (workspace_key = ANY (p_keys) OR (p_lead IS NOT NULL AND sales_lead_id = p_lead));
  DELETE FROM client_contacts WHERE office_id = p_office_id AND (workspace_key = ANY (p_keys) OR (p_lead IS NOT NULL AND sales_lead_id = p_lead));
  PERFORM set_config('mykim.comm_purge', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.comm_purge_target(text, text[], text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_comm_case_purged() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.purged_at IS NOT NULL AND OLD.purged_at IS NULL THEN
    PERFORM public.comm_purge_target(NEW.office_id, array_remove(ARRAY['case-' || NEW.id, NEW.consult_request_id], NULL), NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comm_case_purged ON public.cases;
CREATE TRIGGER comm_case_purged AFTER UPDATE OF purged_at ON public.cases FOR EACH ROW EXECUTE FUNCTION public.trg_comm_case_purged();

CREATE OR REPLACE FUNCTION public.trg_comm_lead_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.comm_purge_target(OLD.office_id, '{}'::text[], OLD.id);
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS comm_lead_deleted ON public.sales_leads;
CREATE TRIGGER comm_lead_deleted AFTER DELETE ON public.sales_leads FOR EACH ROW EXECUTE FUNCTION public.trg_comm_lead_deleted();

-- ── 6. 정리 작업 (매일 03:25 KST, 확인 03:55) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.comm_housekeeping(p_limit integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_url text;
  v_row record;
  v_req bigint;
  v_purged integer := 0;
BEGIN
  DELETE FROM device_pairing_codes WHERE expires_at < now() - interval '1 day';
  UPDATE device_commands SET status = 'expired', finished_at = now() WHERE status IN ('pending', 'delivered') AND expires_at <= now();
  DELETE FROM device_commands WHERE finished_at < now() - interval '90 days';
  DELETE FROM device_register_requests WHERE status <> 'open' AND resolved_at < now() - interval '90 days';
  UPDATE call_recordings SET status = 'failed', deleted_at = now() WHERE status = 'uploading' AND created_at < now() - interval '1 day';
  PERFORM set_config('mykim.comm_purge', 'on', true);
  DELETE FROM client_comm_logs WHERE link_status = 'needs_review' AND occurred_at < now() - interval '1 year';
  PERFORM set_config('mykim.comm_purge', 'off', true);

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'mykim_supabase_url' LIMIT 1;
  IF v_key IS NOT NULL AND v_url IS NOT NULL THEN
    FOR v_row IN
      SELECT id, storage_path FROM call_recordings WHERE deleted_at IS NOT NULL AND purged_at IS NULL AND NOT legal_hold
      ORDER BY deleted_at LIMIT greatest(1, least(p_limit, 1000))
    LOOP
      SELECT net.http_delete(
        url := rtrim(v_url, '/') || '/storage/v1/object/call-recordings/' || v_row.storage_path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key),
        timeout_milliseconds := 20000) INTO v_req;
      UPDATE call_recordings SET purged_at = now(), purge_request_id = v_req WHERE id = v_row.id;
      v_purged := v_purged + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('purged_recordings', v_purged);
END;
$$;
REVOKE ALL ON FUNCTION public.comm_housekeeping(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_call_recording_purge() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  UPDATE call_recordings f SET purged_at = NULL, purge_request_id = NULL
  FROM net._http_response r
  WHERE r.id = f.purge_request_id AND f.purged_at > now() - interval '1 day'
    AND (r.status_code IS NULL OR r.status_code NOT IN (200, 204, 400, 404));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_call_recording_purge() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_comm_housekeeping', 'mykim_verify_call_recording_purge');
  PERFORM cron.schedule('mykim_comm_housekeeping', '25 18 * * *', 'SELECT public.comm_housekeeping(200)');
  PERFORM cron.schedule('mykim_verify_call_recording_purge', '55 18 * * *', 'SELECT public.verify_call_recording_purge()');
END;
$$;
