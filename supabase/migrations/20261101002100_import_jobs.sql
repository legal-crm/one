-- ============================================================
-- 옮겨오기 기록 (NF-10)
-- 엑셀로 의뢰인·사건을 한꺼번에 가져온 기록. 같은 파일을 두 번 가져오면 알려 주고(파일 지문),
-- '되돌리기'는 그때 만든 사건을 휴지통으로 보낸다(30일 안에 복구 가능).
-- 이전: 일괄 등록이 화면 메모리 사건('ext-')만 만들어 새로 고치면 사라지고 서버 저장도 실패했다.
-- 권한: case.edit 가진 사무소 구성원. 내용(이름·번호)은 저장하지 않는다.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'cases' CHECK (kind IN ('cases')),
  file_name text NOT NULL DEFAULT '' CHECK (char_length(file_name) <= 200),
  file_hash text CHECK (file_hash IS NULL OR file_hash ~ '^[0-9a-f]{64}$'),
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  created_count integer NOT NULL DEFAULT 0 CHECK (created_count >= 0),
  case_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(case_ids) <= 2000),
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'undone')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS import_jobs_office_idx ON public.import_jobs (office_id, created_at DESC);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.import_jobs TO authenticated;
DROP POLICY IF EXISTS import_jobs_read ON public.import_jobs;
CREATE POLICY import_jobs_read ON public.import_jobs FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.edit'));
DROP POLICY IF EXISTS import_jobs_insert ON public.import_jobs;
CREATE POLICY import_jobs_insert ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (public.has_office_permission(office_id, 'case.edit'));
DROP POLICY IF EXISTS import_jobs_update ON public.import_jobs;
CREATE POLICY import_jobs_update ON public.import_jobs FOR UPDATE TO authenticated
  USING (public.has_office_permission(office_id, 'case.edit'))
  WITH CHECK (public.has_office_permission(office_id, 'case.edit'));
DROP POLICY IF EXISTS account_active_only ON public.import_jobs;
CREATE POLICY account_active_only ON public.import_jobs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()));

-- 가드: 사건 목록·지문은 처음 값 그대로, 상태는 done → undone 한 번만
CREATE OR REPLACE FUNCTION public.import_jobs_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.status := 'done'; NEW.undone_at := NULL;
    -- 넣는 사건은 이 사무소 사건이어야 한다
    IF EXISTS (SELECT 1 FROM unnest(NEW.case_ids) AS x(id) WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id = x.id AND c.office_id = NEW.office_id)) THEN
      RAISE EXCEPTION 'case of another office' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  NEW.id := OLD.id; NEW.office_id := OLD.office_id; NEW.kind := OLD.kind; NEW.file_name := OLD.file_name; NEW.file_hash := OLD.file_hash;
  NEW.row_count := OLD.row_count; NEW.created_count := OLD.created_count; NEW.case_ids := OLD.case_ids;
  NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  IF OLD.status = 'undone' THEN NEW.status := 'undone'; NEW.undone_at := OLD.undone_at;
  ELSIF NEW.status = 'undone' THEN NEW.undone_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS import_jobs_guard ON public.import_jobs;
CREATE TRIGGER import_jobs_guard BEFORE INSERT OR UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.import_jobs_guard();
