-- ============================================================
-- 서류 준비 체크리스트 기준을 사무소 단위 서버로 (DP-6·DP-3)
-- 문제: 3단계 서류 목록 기준(마스터)은 브라우저 저장소에만 있어 직원·기기마다 달랐다.
--       발급일 기준(접수 기준 1개월, 보정 첨부 2개월)도 정할 곳이 없었다.
-- 바꾼 것: office_document_templates — 사무소당 한 줄(항목 목록·발급일 기준), 구성원은 읽고 설정 권한자만 고친다.
--          행이 없으면 앱이 플랫폼 기본 목록을 쓴다. 사건별 서류 진행 상태는 crm_clients(사건 작업 공간)에 둔다.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.office_document_templates (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 300),
  issue_valid_months integer NOT NULL DEFAULT 1 CHECK (issue_valid_months BETWEEN 1 AND 12),
  correction_valid_months integer NOT NULL DEFAULT 2 CHECK (correction_valid_months BETWEEN 1 AND 12),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
ALTER TABLE public.office_document_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_document_templates FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.office_document_templates TO authenticated;

DROP POLICY IF EXISTS office_doc_templates_read ON public.office_document_templates;
CREATE POLICY office_doc_templates_read ON public.office_document_templates FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));
DROP POLICY IF EXISTS office_doc_templates_insert ON public.office_document_templates;
CREATE POLICY office_doc_templates_insert ON public.office_document_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_office_permission(office_id, 'office.settings.edit'));
DROP POLICY IF EXISTS office_doc_templates_update ON public.office_document_templates;
CREATE POLICY office_doc_templates_update ON public.office_document_templates FOR UPDATE TO authenticated
  USING (public.has_office_permission(office_id, 'office.settings.edit'))
  WITH CHECK (public.has_office_permission(office_id, 'office.settings.edit'));
DROP POLICY IF EXISTS account_active_only ON public.office_document_templates;
CREATE POLICY account_active_only ON public.office_document_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()));

CREATE OR REPLACE FUNCTION public.office_document_templates_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.office_id := OLD.office_id;
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS office_document_templates_touch ON public.office_document_templates;
CREATE TRIGGER office_document_templates_touch BEFORE INSERT OR UPDATE ON public.office_document_templates
  FOR EACH ROW EXECUTE FUNCTION public.office_document_templates_touch();
