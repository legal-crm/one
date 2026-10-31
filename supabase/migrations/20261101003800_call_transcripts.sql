-- ════════════════════════════════════════════════════════════════════════════
-- CL-7·CL-8 통화 녹음 대화록·요약 (서버가 비공개 저장소에서 녹음을 읽어 Gemini로 받아 적기)
--  * call_transcripts: 녹음마다 버전으로 추가만 (고칠 수 없음 — 다시 만들면 새 버전). 원본 녹음이 기준, 대화록은 참고용
--  * 읽기 = 그 녹음을 들을 수 있는 사람 (comm_can 'comm.recording'), 쓰기 = 서버(service_role)만
--  * call_transcript_prepare(녹음, 요청한 사람): 서버 함수가 부른다. 권한·상태·크기·하루 한도 확인 + 열람 기록
--  * 녹음이 지워지면(파기) 대화록도 함께 지워진다 (ON DELETE CASCADE, 녹음 파기 작업이 행을 지울 때)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.call_recordings(id) ON DELETE CASCADE,
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  model text CHECK (model IS NULL OR char_length(model) <= 60),
  segments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(segments) = 'array'),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 4000),
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recording_id, version)
);
CREATE INDEX IF NOT EXISTS call_transcripts_office_idx ON public.call_transcripts (office_id, created_at DESC);
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_transcripts FROM anon, authenticated;
GRANT SELECT ON public.call_transcripts TO authenticated;
DROP POLICY IF EXISTS call_transcripts_read ON public.call_transcripts;
-- 녹음 표는 칸 단위 권한이라(deleted_at 비공개) 판단은 SECURITY DEFINER 함수로
CREATE OR REPLACE FUNCTION public.call_transcript_visible(p_recording uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM call_recordings r WHERE r.id = p_recording AND r.deleted_at IS NULL
                   AND public.comm_can(r.office_id, 'comm.recording', r.workspace_key, r.sales_lead_id, r.uploaded_by));
$$;
REVOKE ALL ON FUNCTION public.call_transcript_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_transcript_visible(uuid) TO authenticated;
CREATE POLICY call_transcripts_read ON public.call_transcripts FOR SELECT TO authenticated
  USING (public.call_transcript_visible(recording_id));

CREATE OR REPLACE FUNCTION public.call_transcripts_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'call_transcripts is append-only' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN OLD; -- 삭제는 녹음 연쇄 삭제·사무소 파기에서만 일어난다 (직접 DELETE 권한 없음)
END;
$$;
DROP TRIGGER IF EXISTS call_transcripts_append_only ON public.call_transcripts;
CREATE TRIGGER call_transcripts_append_only BEFORE UPDATE ON public.call_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.call_transcripts_append_only();

-- 서버 함수 전용: 요청한 사람이 이 녹음을 들을 수 있는지 (auth.uid 없이 사람 기준으로 판단)
CREATE OR REPLACE FUNCTION public.call_transcript_prepare(p_recording uuid, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r call_recordings%ROWTYPE;
  m office_members%ROWTYPE;
  v_scope text;
  v_case uuid;
  v_ok boolean := false;
  v_next int;
BEGIN
  SELECT * INTO r FROM call_recordings WHERE id = p_recording;
  IF r.id IS NULL OR r.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status NOT IN ('verified', 'mismatch') THEN RETURN jsonb_build_object('ok', false, 'error', 'not_verified'); END IF;
  IF NOT EXISTS (SELECT 1 FROM account_status a WHERE a.user_id = p_actor AND a.status = 'suspended' AND (a.until IS NULL OR a.until > now())) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  SELECT om.* INTO m FROM office_members om JOIN offices o ON o.id = om.office_id AND o.status = 'active'
   WHERE om.office_id = r.office_id AND om.user_id = p_actor AND om.status = 'active' LIMIT 1;
  IF m.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  v_scope := public.member_permission_scope(m, 'comm.recording');
  IF v_scope = 'all' OR r.uploaded_by = p_actor THEN
    v_ok := true;
  ELSIF v_scope = 'assigned' THEN
    IF r.workspace_key IS NOT NULL THEN
      v_case := public.crm_client_case_id(r.office_id, r.workspace_key);
      IF v_case IS NOT NULL AND EXISTS (SELECT 1 FROM cases c WHERE c.id = v_case AND (c.lawyer_member_id = m.id OR c.staff_member_id = m.id)) THEN v_ok := true; END IF;
    END IF;
    IF NOT v_ok AND r.sales_lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM sales_leads l WHERE l.id = r.sales_lead_id AND l.office_id = r.office_id AND (l.assignee_user_id = p_actor OR l.created_by = p_actor)) THEN
      v_ok := true;
    END IF;
  END IF;
  IF NOT v_ok THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF coalesce(r.size_bytes, 0) > 18 * 1024 * 1024 THEN RETURN jsonb_build_object('ok', false, 'error', 'too_large'); END IF;
  IF (SELECT count(*) FROM call_transcripts t WHERE t.office_id = r.office_id AND t.created_at > now() - interval '1 day') >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_limit');
  END IF;
  INSERT INTO evidence_access_logs (office_id, user_id, member_id, target_type, target_id, action, ip_address)
  VALUES (r.office_id, p_actor, m.id, 'recording', r.id::text, 'view_transcript', NULL);
  SELECT coalesce(max(version), 0) + 1 INTO v_next FROM call_transcripts WHERE recording_id = r.id;
  RETURN jsonb_build_object('ok', true, 'storage_path', r.storage_path, 'mime_type', r.mime_type, 'office_id', r.office_id,
    'next_version', v_next, 'duration_sec', r.duration_sec);
END;
$$;
REVOKE ALL ON FUNCTION public.call_transcript_prepare(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_transcript_prepare(uuid, uuid) TO service_role;

-- 녹음을 휴지통으로 보내거나 파기하면 대화록도 지운다 (원본보다 오래 남지 않게)
CREATE OR REPLACE FUNCTION public.trg_call_recording_drop_transcripts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM call_transcripts WHERE recording_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_call_recording_drop_transcripts ON public.call_recordings;
CREATE TRIGGER trg_call_recording_drop_transcripts AFTER UPDATE OF deleted_at ON public.call_recordings
  FOR EACH ROW EXECUTE FUNCTION public.trg_call_recording_drop_transcripts();
