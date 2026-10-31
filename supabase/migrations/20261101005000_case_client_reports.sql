-- ════════════════════════════════════════════════════════════════════════════
-- NF-9 인가 뒤 변동 알리기: 의뢰인이 이사·이직·소득 변동·가족 변동·납부 어려움을 사무소에 알린다
--  * 의뢰인은 사실만 적는다. 변경 신청이 필요한지는 변호사가 판단한다 (판정 문구 없음)
--  * 쓰기는 서버 함수만: client_report_case_change(의뢰인) / office_handle_case_client_report(사무소 case.edit)
--  * 보기: 사무소 case.view, 의뢰인 본인. 관리자 정책 없음(제로날리지)
--  * 주민등록번호 형태는 거절, 같은 사건 처리 대기 5건까지
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('moved', 'job_change', 'income_change', 'family_change', 'payment_trouble', 'other')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  handled_by uuid,
  handled_at timestamptz,
  handle_note text CHECK (handle_note IS NULL OR char_length(handle_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_client_reports_office_idx ON public.case_client_reports (office_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS case_client_reports_case_idx ON public.case_client_reports (case_key, created_at DESC);

ALTER TABLE public.case_client_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_client_reports FROM PUBLIC, anon;
GRANT SELECT ON public.case_client_reports TO authenticated;
DROP POLICY IF EXISTS case_client_reports_office ON public.case_client_reports;
CREATE POLICY case_client_reports_office ON public.case_client_reports FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view'));
DROP POLICY IF EXISTS case_client_reports_client ON public.case_client_reports;
CREATE POLICY case_client_reports_client ON public.case_client_reports FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.case_client_report_label(p_kind text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind
    WHEN 'moved' THEN '이사' WHEN 'job_change' THEN '직장 변동' WHEN 'income_change' THEN '소득 변동'
    WHEN 'family_change' THEN '가족 변동' WHEN 'payment_trouble' THEN '변제금 납부 어려움' ELSE '그 밖의 변동' END;
$$;

-- 의뢰인: 변동 알리기
CREATE OR REPLACE FUNCTION public.client_report_case_change(p_case_key text, p_kind text, p_note text)
RETURNS public.case_client_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_case uuid;
  v_row public.case_client_reports;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'login required' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('moved', 'job_change', 'income_change', 'family_change', 'payment_trouble', 'other') THEN
    RAISE EXCEPTION 'invalid kind' USING ERRCODE = 'check_violation';
  END IF;
  IF p_kind = 'other' AND v_note IS NULL THEN
    RAISE EXCEPTION 'note required' USING ERRCODE = '22023';
  END IF;
  IF v_note ~ '[0-9]{6}\s*-?\s*[1-4][0-9]{6}' THEN
    RAISE EXCEPTION 'resident registration number not allowed' USING ERRCODE = '22023';
  END IF;
  IF NOT public.client_owns_case_key(p_case_key) THEN
    RAISE EXCEPTION 'not your case' USING ERRCODE = '42501';
  END IF;
  v_office := public.client_request_office(p_case_key);
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'no office for case' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM public.case_client_reports r
      WHERE r.case_key = p_case_key AND r.client_user_id = auth.uid() AND r.status = 'open') >= 5 THEN
    RAISE EXCEPTION 'too many open reports' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.case_client_reports (case_key, office_id, client_user_id, kind, note)
  VALUES (p_case_key, v_office, auth.uid(), p_kind, v_note) RETURNING * INTO v_row;

  v_case := public.crm_client_case_id(v_office, p_case_key);
  PERFORM public.notify_office_members(
    v_office, 'case.view', v_case, 'case_client_report',
    '의뢰인이 변동 사항을 알렸어요: ' || public.case_client_report_label(p_kind),
    '사건 화면 사건 기록에서 내용을 확인하고 처리해 주세요. 변경 신청이 필요한지는 변호사가 판단해요.',
    'case', p_case_key, 'case_report:' || p_case_key
  );
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.client_report_case_change(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_report_case_change(text, text, text) TO authenticated;

-- 사무소: 확인 처리 (case.edit) → 의뢰인에게 '확인했어요' 알림
CREATE OR REPLACE FUNCTION public.office_handle_case_client_report(p_id uuid, p_note text)
RETURNS public.case_client_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.case_client_reports;
BEGIN
  SELECT * INTO v_row FROM public.case_client_reports WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_row.office_id, 'case.edit') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_row.status = 'handled' THEN RAISE EXCEPTION 'request already handled' USING ERRCODE = '22023'; END IF;
  UPDATE public.case_client_reports
  SET status = 'handled', handled_by = auth.uid(), handled_at = now(), handle_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  WHERE id = p_id RETURNING * INTO v_row;
  PERFORM public.notify_user(
    v_row.client_user_id, 'client', v_row.office_id, 'case_report_handled',
    '사무소가 알려 주신 내용을 확인했어요',
    coalesce(v_row.handle_note, public.case_client_report_label(v_row.kind) || ' 알림을 확인했어요.'),
    'mypage_case', v_row.case_key, NULL
  );
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.office_handle_case_client_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_handle_case_client_report(uuid, text) TO authenticated;
