-- ============================================================
-- S-1 사건 관리 데이터(crm_clients) 서버 저장 복구
-- 문제: RLS가 auth.uid()를 변호사 ID('lawyer-…')·의뢰인 키('req-…')와 비교해 변호사·직원은 읽기·쓰기 0건,
--       앱은 없는 칸(uploaded_files 등)까지 보내 저장이 늘 실패 → 사건 메모·서류·상태가 탭(sessionStorage)에만 남았다.
-- 바꾼 것:
--  * office_id 칸 + 사무소 권한 기준 RLS (보기 case.view, 쓰기 case.edit, 삭제 case.delete; '담당' 범위는 서버 사건 담당자)
--  * office_id가 비면 내 사무소로 채우고, 한 번 정한 사무소는 바꿀 수 없음
--  * 관리자는 제외 (제로날리지, 026 원칙)
-- 운영 crm_clients는 0행이라 옮길 데이터 없음
-- ============================================================

ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS office_id text REFERENCES public.offices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS crm_clients_office_idx ON public.crm_clients (office_id, updated_at DESC);

-- 상담 요청 ID → 우리 사무소 서버 사건 ID ('담당' 범위 판정용)
CREATE OR REPLACE FUNCTION public.crm_client_case_id(p_office_id text, p_client_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.cases c
  WHERE c.office_id = p_office_id AND c.consult_request_id = p_client_id AND c.deleted_at IS NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.crm_client_case_id(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_client_case_id(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_clients_office_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.office_id IS NOT NULL AND NEW.office_id IS DISTINCT FROM OLD.office_id THEN
      RAISE EXCEPTION 'office_id cannot change' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.office_id := coalesce(NEW.office_id, OLD.office_id);
  END IF;
  IF NEW.office_id IS NULL THEN
    NEW.office_id := (public.current_office_ids())[1];
  END IF;
  IF NEW.office_id IS NULL THEN
    RAISE EXCEPTION 'office required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_clients_office_guard ON public.crm_clients;
CREATE TRIGGER crm_clients_office_guard BEFORE INSERT OR UPDATE ON public.crm_clients
  FOR EACH ROW EXECUTE FUNCTION public.crm_clients_office_guard();

DROP POLICY IF EXISTS anti_bola_modify_crm_clients ON public.crm_clients;
DROP POLICY IF EXISTS anti_bola_select_crm_clients ON public.crm_clients;
DROP POLICY IF EXISTS crm_clients_office_select ON public.crm_clients;
DROP POLICY IF EXISTS crm_clients_office_insert ON public.crm_clients;
DROP POLICY IF EXISTS crm_clients_office_update ON public.crm_clients;
DROP POLICY IF EXISTS crm_clients_office_delete ON public.crm_clients;

CREATE POLICY crm_clients_office_select ON public.crm_clients FOR SELECT TO authenticated
  USING (office_id IS NOT NULL AND public.has_office_permission(office_id, 'case.view', public.crm_client_case_id(office_id, client_id)));
CREATE POLICY crm_clients_office_insert ON public.crm_clients FOR INSERT TO authenticated
  WITH CHECK (office_id IS NOT NULL AND public.has_office_permission(office_id, 'case.edit', public.crm_client_case_id(office_id, client_id)));
CREATE POLICY crm_clients_office_update ON public.crm_clients FOR UPDATE TO authenticated
  USING (office_id IS NOT NULL AND public.has_office_permission(office_id, 'case.edit', public.crm_client_case_id(office_id, client_id)))
  WITH CHECK (office_id IS NOT NULL AND public.has_office_permission(office_id, 'case.edit', public.crm_client_case_id(office_id, client_id)));
CREATE POLICY crm_clients_office_delete ON public.crm_clients FOR DELETE TO authenticated
  USING (office_id IS NOT NULL AND public.has_office_permission(office_id, 'case.delete'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_clients TO authenticated;
REVOKE ALL ON public.crm_clients FROM anon;
