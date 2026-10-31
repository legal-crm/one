-- ============================================================
-- 채권자 일괄 발송 기록 (NF-4, 25 기획서 4장)
-- 대리인 선임 통지서·부채증명서 발급 요청서를 채권자마다 만들고, 보낸 날·방법·접수 번호·결과·회신을 남긴다.
-- 문서는 사건 서류함(case_files)에 글자 PDF로 저장한다. 부채증명 장부 줄과 연결하면
--   보냄 → 장부 '요청함'(요청일), 회신 → 장부 '받음'(수령일)으로 바뀐다.
-- 팝빌 팩스 자동 발송은 발신번호 등록 방식이 정해진 뒤 켠다 (지금은 사무소가 보낸 결과를 기록).
-- 권한: 보기 case.view, 쓰기 documents.manage (사건 범위, correction_can), 관리자 제외.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creditor_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  creditor_key text NOT NULL CHECK (char_length(creditor_key) BETWEEN 1 AND 120),
  creditor_name text NOT NULL CHECK (char_length(creditor_name) BETWEEN 1 AND 120),
  registry_id text REFERENCES public.creditor_registry(id) ON DELETE SET NULL,
  doc_kinds text[] NOT NULL CHECK (cardinality(doc_kinds) BETWEEN 1 AND 2 AND doc_kinds <@ ARRAY['appointment_notice', 'debt_cert_request']::text[]),
  method text NOT NULL DEFAULT 'mail' CHECK (method IN ('fax', 'mail', 'email', 'visit', 'other')),
  recipient text NOT NULL DEFAULT '' CHECK (char_length(recipient) <= 200),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'sent', 'failed', 'replied')),
  sent_on date,
  receipt_no text CHECK (receipt_no IS NULL OR char_length(receipt_no) <= 60),
  result_note text CHECK (result_note IS NULL OR char_length(result_note) <= 500),
  replied_on date,
  file_id text CHECK (file_id IS NULL OR char_length(file_id) <= 80),
  file_path text CHECK (file_path IS NULL OR char_length(file_path) <= 300),
  debt_certificate_id uuid REFERENCES public.debt_certificates(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creditor_dispatches_case_idx ON public.creditor_dispatches (office_id, case_key, created_at DESC);

ALTER TABLE public.creditor_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creditor_dispatches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creditor_dispatches TO authenticated;
DROP POLICY IF EXISTS creditor_dispatches_read ON public.creditor_dispatches;
CREATE POLICY creditor_dispatches_read ON public.creditor_dispatches FOR SELECT TO authenticated
  USING (public.correction_can(office_id, case_key, 'case.view'));
DROP POLICY IF EXISTS creditor_dispatches_insert ON public.creditor_dispatches;
CREATE POLICY creditor_dispatches_insert ON public.creditor_dispatches FOR INSERT TO authenticated
  WITH CHECK (public.correction_can(office_id, case_key, 'documents.manage'));
DROP POLICY IF EXISTS creditor_dispatches_update ON public.creditor_dispatches;
CREATE POLICY creditor_dispatches_update ON public.creditor_dispatches FOR UPDATE TO authenticated
  USING (public.correction_can(office_id, case_key, 'documents.manage'))
  WITH CHECK (public.correction_can(office_id, case_key, 'documents.manage'));
-- 보낸 기록은 지우지 않는다 (준비만 한 줄만 삭제)
DROP POLICY IF EXISTS creditor_dispatches_delete ON public.creditor_dispatches;
CREATE POLICY creditor_dispatches_delete ON public.creditor_dispatches FOR DELETE TO authenticated
  USING (public.correction_can(office_id, case_key, 'documents.manage') AND status = 'prepared');
DROP POLICY IF EXISTS account_active_only ON public.creditor_dispatches;
CREATE POLICY account_active_only ON public.creditor_dispatches AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()));

-- 가드: 소속·작성 칸 고정, 상태별 필수 칸, 보낸 뒤 문서 종류·채권자 고정
CREATE OR REPLACE FUNCTION public.creditor_dispatches_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id; NEW.office_id := OLD.office_id; NEW.case_key := OLD.case_key;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    IF OLD.status <> 'prepared' THEN
      NEW.creditor_key := OLD.creditor_key; NEW.creditor_name := OLD.creditor_name; NEW.doc_kinds := OLD.doc_kinds;
      NEW.sent_on := COALESCE(NEW.sent_on, OLD.sent_on);
      IF NEW.status = 'prepared' THEN
        RAISE EXCEPTION 'cannot reopen sent dispatch' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSE
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.status IN ('sent', 'replied', 'failed') AND NEW.sent_on IS NULL THEN
    RAISE EXCEPTION 'sent date required' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'replied' AND NEW.replied_on IS NULL THEN
    RAISE EXCEPTION 'reply date required' USING ERRCODE = '22023';
  END IF;
  IF NEW.replied_on IS NOT NULL AND NEW.sent_on IS NOT NULL AND NEW.replied_on < NEW.sent_on THEN
    RAISE EXCEPTION 'reply before sent' USING ERRCODE = '22023';
  END IF;
  IF NEW.debt_certificate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.debt_certificates d WHERE d.id = NEW.debt_certificate_id AND d.office_id = NEW.office_id AND d.case_key = NEW.case_key
  ) THEN
    RAISE EXCEPTION 'debt certificate of another case' USING ERRCODE = '22023';
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS creditor_dispatches_guard ON public.creditor_dispatches;
CREATE TRIGGER creditor_dispatches_guard BEFORE INSERT OR UPDATE ON public.creditor_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.creditor_dispatches_guard();

-- 부채증명 장부 줄 갱신: 발급 요청서를 보냄 → '요청함', 회신 → '받음' (이미 더 나아간 줄은 그대로)
CREATE OR REPLACE FUNCTION public.creditor_dispatches_ledger_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.debt_certificate_id IS NULL OR NOT ('debt_cert_request' = ANY (NEW.doc_kinds)) THEN RETURN NEW; END IF;
  IF NEW.status IN ('sent', 'replied') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.debt_certificate_id IS DISTINCT FROM NEW.debt_certificate_id) THEN
    UPDATE public.debt_certificates SET status = 'requested', requested_on = COALESCE(requested_on, NEW.sent_on)
     WHERE id = NEW.debt_certificate_id AND status = 'pending';
  END IF;
  IF NEW.status = 'replied' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'replied' OR OLD.debt_certificate_id IS DISTINCT FROM NEW.debt_certificate_id) THEN
    UPDATE public.debt_certificates SET status = 'received', received_on = COALESCE(received_on, NEW.replied_on)
     WHERE id = NEW.debt_certificate_id AND status IN ('pending', 'requested');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS creditor_dispatches_ledger_sync ON public.creditor_dispatches;
CREATE TRIGGER creditor_dispatches_ledger_sync AFTER INSERT OR UPDATE ON public.creditor_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.creditor_dispatches_ledger_sync();

-- 사건 파기 때 함께 지운다 (purge_one_case가 지우는 다른 사건 표와 같게)
CREATE OR REPLACE FUNCTION public.creditor_dispatches_purge_with_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.purged_at IS NOT NULL AND OLD.purged_at IS NULL THEN
    DELETE FROM public.creditor_dispatches d
     WHERE d.office_id = NEW.office_id
       AND (d.case_key = 'case-' || NEW.id::text OR (NEW.consult_request_id IS NOT NULL AND d.case_key = NEW.consult_request_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS creditor_dispatches_purge_with_case ON public.cases;
CREATE TRIGGER creditor_dispatches_purge_with_case AFTER UPDATE OF purged_at ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.creditor_dispatches_purge_with_case();
