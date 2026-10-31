-- ============================================================
-- CV-1 사건 검토 기록 (19 기획서) — 상담 요청·사건 1단계의 '사건 검토' 패널이 남기는 기록
--  * case_key = 상담 요청 ID 또는 'case-<uuid>' (crm_client_case_id 규칙과 같음)
--  * 기록은 추가만 (고치면 새 줄), 화면은 가장 최근 줄을 보여 준다
--  * 보기: 그 사건을 볼 수 있는 사무소 구성원(case.view 또는 consult.view), 쓰기: proposal.draft 또는 case.edit
--  * 관리자 제외 (사건 데이터, 011 원칙)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.case_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object' AND length(input::text) <= 20000),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object' AND length(result::text) <= 20000),
  standard_version integer,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_reviews_key_idx ON public.case_reviews (office_id, case_key, created_at DESC);
ALTER TABLE public.case_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.case_reviews TO authenticated;

DROP POLICY IF EXISTS case_reviews_read ON public.case_reviews;
CREATE POLICY case_reviews_read ON public.case_reviews FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view') OR public.has_office_permission(office_id, 'consult.view'));
DROP POLICY IF EXISTS case_reviews_insert ON public.case_reviews;
CREATE POLICY case_reviews_insert ON public.case_reviews FOR INSERT TO authenticated
  WITH CHECK ((public.has_office_permission(office_id, 'proposal.draft') OR public.has_office_permission(office_id, 'case.edit'))
              AND public.is_account_active());

CREATE OR REPLACE FUNCTION public.case_reviews_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 주민등록번호 형식은 받지 않는다
  IF (NEW.input::text || coalesce(NEW.note, '')) ~ '\d{6}\s*-\s*[1-4]\d{6}' THEN
    RAISE EXCEPTION 'resident registration numbers are not stored' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS case_reviews_guard ON public.case_reviews;
CREATE TRIGGER case_reviews_guard BEFORE INSERT ON public.case_reviews FOR EACH ROW EXECUTE FUNCTION public.case_reviews_guard();
