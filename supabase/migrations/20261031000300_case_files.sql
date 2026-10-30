-- ============================================================
-- DP-0 사건 서류 파일 저장 (비공개 저장소)
-- 문제: 업로드한 서류 파일(본문 base64)은 서버에 전혀 저장되지 않았다(탭 사본에만). 의뢰인 제출 서류도 사무소에 닿지 않았다.
-- 바꾼 것:
--  * 비공개 버킷 case-files (20MB, PDF·이미지만). 경로 = {사무소 ID}/{상담 요청 ID}/{office|client}/{파일 ID}.{확장자}
--  * case_files 표: 파일 정보(이름·종류·크기·출처·연결 체크리스트·검토 상태). 파일 본문은 저장소에만
--  * 사무소: 보기 case.view, 올리기·지우기 documents.manage ('담당' 범위는 서버 사건 담당자)
--  * 의뢰인: 본인 상담 요청의 담당 사무소 폴더 client/ 아래에만 올리기, 본인이 올린 파일만 보기
--  * 관리자 제외 (제로날리지)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-files', 'case-files', false, 20971520,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 의뢰인 상담 요청의 담당 사무소 (계약·수락한 변호사 우선, 없으면 처음 선택한 변호사)
CREATE OR REPLACE FUNCTION public.client_request_office(p_request_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.consult_requests%ROWTYPE;
  v_lawyer text;
  v_office text;
BEGIN
  SELECT * INTO v_req FROM public.consult_requests WHERE id = p_request_id AND client_id = auth.uid()::text;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_lawyer := coalesce(
    CASE WHEN jsonb_typeof(to_jsonb(v_req.accepted_lawyer_ids)) = 'array' THEN to_jsonb(v_req.accepted_lawyer_ids) ->> 0 END,
    v_req.selected_lawyer_id,
    CASE WHEN jsonb_typeof(to_jsonb(v_req.selected_lawyer_ids)) = 'array' THEN to_jsonb(v_req.selected_lawyer_ids) ->> 0 END
  );
  IF v_lawyer IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT m.office_id INTO v_office FROM public.office_members m
  WHERE m.lawyer_id = v_lawyer AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC LIMIT 1;
  RETURN v_office;
END;
$$;
REVOKE ALL ON FUNCTION public.client_request_office(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_request_office(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.case_files (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 80),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  client_key text NOT NULL CHECK (char_length(client_key) BETWEEN 1 AND 80),
  storage_path text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'other',
  mime_type text,
  size_bytes integer CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 20971520),
  upload_source text NOT NULL CHECK (upload_source IN ('office', 'client')),
  linked_doc_id text,
  review_status text NOT NULL DEFAULT 'submitted',
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS case_files_office_client_idx ON public.case_files (office_id, client_key, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_files_office_select ON public.case_files;
CREATE POLICY case_files_office_select ON public.case_files FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view', public.crm_client_case_id(office_id, client_key)));
DROP POLICY IF EXISTS case_files_client_select ON public.case_files;
CREATE POLICY case_files_client_select ON public.case_files FOR SELECT TO authenticated
  USING (upload_source = 'client' AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.consult_requests r WHERE r.id = client_key AND r.client_id = auth.uid()::text));
DROP POLICY IF EXISTS case_files_office_insert ON public.case_files;
CREATE POLICY case_files_office_insert ON public.case_files FOR INSERT TO authenticated
  WITH CHECK (upload_source = 'office'
              AND public.has_office_permission(office_id, 'documents.manage', public.crm_client_case_id(office_id, client_key))
              AND split_part(storage_path, '/', 1) = office_id AND split_part(storage_path, '/', 2) = client_key
              AND split_part(storage_path, '/', 3) = 'office');
DROP POLICY IF EXISTS case_files_client_insert ON public.case_files;
CREATE POLICY case_files_client_insert ON public.case_files FOR INSERT TO authenticated
  WITH CHECK (upload_source = 'client' AND review_status = 'submitted'
              AND public.client_request_office(client_key) = office_id
              AND split_part(storage_path, '/', 1) = office_id AND split_part(storage_path, '/', 2) = client_key
              AND split_part(storage_path, '/', 3) = 'client');
DROP POLICY IF EXISTS case_files_office_update ON public.case_files;
CREATE POLICY case_files_office_update ON public.case_files FOR UPDATE TO authenticated
  USING (public.has_office_permission(office_id, 'documents.manage', public.crm_client_case_id(office_id, client_key)))
  WITH CHECK (public.has_office_permission(office_id, 'documents.manage', public.crm_client_case_id(office_id, client_key)));
GRANT SELECT, INSERT, UPDATE ON public.case_files TO authenticated;
REVOKE ALL ON public.case_files FROM anon;

-- 파일 정보 중 경로·사무소·출처는 바꿀 수 없음
CREATE OR REPLACE FUNCTION public.case_files_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.office_id IS DISTINCT FROM OLD.office_id
     OR NEW.client_key IS DISTINCT FROM OLD.client_key OR NEW.upload_source IS DISTINCT FROM OLD.upload_source THEN
    RAISE EXCEPTION 'case file location cannot change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS case_files_guard ON public.case_files;
CREATE TRIGGER case_files_guard BEFORE UPDATE ON public.case_files FOR EACH ROW EXECUTE FUNCTION public.case_files_guard();

-- ── 저장소 객체 권한 (bucket case-files) ─────────────────────────────────────
DROP POLICY IF EXISTS case_files_obj_office_read ON storage.objects;
CREATE POLICY case_files_obj_office_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files'
         AND public.has_office_permission((storage.foldername(name))[1], 'case.view',
               public.crm_client_case_id((storage.foldername(name))[1], (storage.foldername(name))[2])));
DROP POLICY IF EXISTS case_files_obj_client_read ON storage.objects;
CREATE POLICY case_files_obj_client_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[3] = 'client'
         AND EXISTS (SELECT 1 FROM public.consult_requests r WHERE r.id = (storage.foldername(name))[2] AND r.client_id = auth.uid()::text));
DROP POLICY IF EXISTS case_files_obj_office_write ON storage.objects;
CREATE POLICY case_files_obj_office_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND (storage.foldername(name))[3] = 'office'
              AND public.has_office_permission((storage.foldername(name))[1], 'documents.manage',
                    public.crm_client_case_id((storage.foldername(name))[1], (storage.foldername(name))[2])));
DROP POLICY IF EXISTS case_files_obj_client_write ON storage.objects;
CREATE POLICY case_files_obj_client_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND (storage.foldername(name))[3] = 'client'
              AND public.client_request_office((storage.foldername(name))[2]) = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS case_files_obj_office_delete ON storage.objects;
CREATE POLICY case_files_obj_office_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-files'
         AND public.has_office_permission((storage.foldername(name))[1], 'documents.manage',
               public.crm_client_case_id((storage.foldername(name))[1], (storage.foldername(name))[2])));
