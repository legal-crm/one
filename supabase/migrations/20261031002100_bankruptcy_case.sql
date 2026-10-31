-- ============================================================
-- BK-4·BK-5 파산 사건 진행 기록 (case_bankruptcy_details)
-- 파산은 '파산선고 → 관재인 → 채권자집회 → 면책 이의기간·심문 → 면책 결정·확정'으로 흐름이 회생과 다르다.
-- 이전: 선고일 외에 관재인·예납금·이의기간·면책심문·면책 확정을 기록할 곳이 없었다(화면 문구만 회생 기준).
-- 의뢰인에게는 진행 날짜만 보이고(관재인 연락처·예납 메모·판단 메모는 안 보임), 동시폐지·면책 가능성 판단은 보여 주지 않는다(제109조).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.case_bankruptcy_details (
  case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  insolvent_on date,                              -- 지급불능 시점 (처분재산·차용·편파변제 질문 기간 기준)
  bankruptcy_case_number text CHECK (bankruptcy_case_number IS NULL OR char_length(bankruptcy_case_number) <= 40), -- 하단
  discharge_case_number text CHECK (discharge_case_number IS NULL OR char_length(discharge_case_number) <= 40),    -- 하면
  deposit_ordered_won bigint CHECK (deposit_ordered_won IS NULL OR deposit_ordered_won BETWEEN 0 AND 100000000),   -- 예납명령 금액
  deposit_due_on date,
  deposit_paid_on date,
  dismissal_type text CHECK (dismissal_type IS NULL OR dismissal_type IN ('trustee', 'simultaneous')), -- 관재 / 동시폐지 (법원 결정 기록)
  trustee_name text CHECK (trustee_name IS NULL OR char_length(trustee_name) <= 60),
  trustee_phone text CHECK (trustee_phone IS NULL OR char_length(trustee_phone) <= 30),
  trustee_office text CHECK (trustee_office IS NULL OR char_length(trustee_office) <= 200),
  trustee_interview_on date,
  trustee_docs_requested text CHECK (trustee_docs_requested IS NULL OR char_length(trustee_docs_requested) <= 2000),
  trustee_docs_submitted_on date,
  objection_deadline_on date,                     -- 면책 이의신청기간 만료일
  discharge_hearing_on date,                      -- 면책심문기일
  discharge_result text CHECK (discharge_result IS NULL OR discharge_result IN ('granted', 'denied', 'partial')),
  discharge_confirmed_on date,                    -- 면책 확정일
  estate_closed_on date,                          -- 파산종결·폐지일
  memo text CHECK (memo IS NULL OR char_length(memo) <= 4000),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.case_bankruptcy_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_bankruptcy_details FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.case_bankruptcy_details TO service_role;

-- 사무소 읽기
CREATE OR REPLACE FUNCTION public.case_bankruptcy_details_get(p_case_id uuid)
RETURNS public.case_bankruptcy_details
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case cases%ROWTYPE;
  v_row case_bankruptcy_details%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF v_case.id IS NULL OR NOT public.has_office_permission(v_case.office_id, 'case.view', v_case.id) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM case_bankruptcy_details WHERE case_id = p_case_id;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.case_bankruptcy_details_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_bankruptcy_details_get(uuid) TO authenticated;

-- 사무소 저장 (부분 저장 + 버전 확인). 날짜 순서가 맞지 않으면 거절
CREATE OR REPLACE FUNCTION public.set_case_bankruptcy_details(p_case_id uuid, p jsonb, p_expected_version integer DEFAULT NULL)
RETURNS public.case_bankruptcy_details
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case cases%ROWTYPE;
  v_row case_bankruptcy_details%ROWTYPE;
  k text;
  v_allowed text[] := ARRAY['insolvent_on', 'bankruptcy_case_number', 'discharge_case_number', 'deposit_ordered_won', 'deposit_due_on',
    'deposit_paid_on', 'dismissal_type', 'trustee_name', 'trustee_phone', 'trustee_office', 'trustee_interview_on', 'trustee_docs_requested',
    'trustee_docs_submitted_on', 'objection_deadline_on', 'discharge_hearing_on', 'discharge_result', 'discharge_confirmed_on',
    'estate_closed_on', 'memo'];
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL FOR UPDATE;
  IF v_case.id IS NULL OR NOT public.has_office_permission(v_case.office_id, 'case.edit', v_case.id) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_case.case_type <> 'bankruptcy' THEN RAISE EXCEPTION 'bankruptcy case required' USING ERRCODE = '22023'; END IF;
  IF v_case.purged_at IS NOT NULL THEN RAISE EXCEPTION 'case is purged' USING ERRCODE = '42501'; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p, '{}'::jsonb)) LOOP
    IF NOT k = ANY (v_allowed) THEN RAISE EXCEPTION 'unknown field %', k USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF coalesce(p::text, '') ~ '[0-9]{6}\s*-?\s*[1-4][0-9]{6}' THEN
    RAISE EXCEPTION 'resident registration numbers must not be stored' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM case_bankruptcy_details WHERE case_id = p_case_id FOR UPDATE;
  IF v_row.case_id IS NULL THEN
    INSERT INTO case_bankruptcy_details (case_id, office_id) VALUES (p_case_id, v_case.office_id) RETURNING * INTO v_row;
  ELSIF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN
    RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE case_bankruptcy_details SET
    insolvent_on = CASE WHEN p ? 'insolvent_on' THEN nullif(p ->> 'insolvent_on', '')::date ELSE insolvent_on END,
    bankruptcy_case_number = CASE WHEN p ? 'bankruptcy_case_number' THEN nullif(btrim(p ->> 'bankruptcy_case_number'), '') ELSE bankruptcy_case_number END,
    discharge_case_number = CASE WHEN p ? 'discharge_case_number' THEN nullif(btrim(p ->> 'discharge_case_number'), '') ELSE discharge_case_number END,
    deposit_ordered_won = CASE WHEN p ? 'deposit_ordered_won' THEN nullif(p ->> 'deposit_ordered_won', '')::bigint ELSE deposit_ordered_won END,
    deposit_due_on = CASE WHEN p ? 'deposit_due_on' THEN nullif(p ->> 'deposit_due_on', '')::date ELSE deposit_due_on END,
    deposit_paid_on = CASE WHEN p ? 'deposit_paid_on' THEN nullif(p ->> 'deposit_paid_on', '')::date ELSE deposit_paid_on END,
    dismissal_type = CASE WHEN p ? 'dismissal_type' THEN nullif(p ->> 'dismissal_type', '') ELSE dismissal_type END,
    trustee_name = CASE WHEN p ? 'trustee_name' THEN nullif(btrim(p ->> 'trustee_name'), '') ELSE trustee_name END,
    trustee_phone = CASE WHEN p ? 'trustee_phone' THEN nullif(btrim(p ->> 'trustee_phone'), '') ELSE trustee_phone END,
    trustee_office = CASE WHEN p ? 'trustee_office' THEN nullif(btrim(p ->> 'trustee_office'), '') ELSE trustee_office END,
    trustee_interview_on = CASE WHEN p ? 'trustee_interview_on' THEN nullif(p ->> 'trustee_interview_on', '')::date ELSE trustee_interview_on END,
    trustee_docs_requested = CASE WHEN p ? 'trustee_docs_requested' THEN nullif(btrim(p ->> 'trustee_docs_requested'), '') ELSE trustee_docs_requested END,
    trustee_docs_submitted_on = CASE WHEN p ? 'trustee_docs_submitted_on' THEN nullif(p ->> 'trustee_docs_submitted_on', '')::date ELSE trustee_docs_submitted_on END,
    objection_deadline_on = CASE WHEN p ? 'objection_deadline_on' THEN nullif(p ->> 'objection_deadline_on', '')::date ELSE objection_deadline_on END,
    discharge_hearing_on = CASE WHEN p ? 'discharge_hearing_on' THEN nullif(p ->> 'discharge_hearing_on', '')::date ELSE discharge_hearing_on END,
    discharge_result = CASE WHEN p ? 'discharge_result' THEN nullif(p ->> 'discharge_result', '') ELSE discharge_result END,
    discharge_confirmed_on = CASE WHEN p ? 'discharge_confirmed_on' THEN nullif(p ->> 'discharge_confirmed_on', '')::date ELSE discharge_confirmed_on END,
    estate_closed_on = CASE WHEN p ? 'estate_closed_on' THEN nullif(p ->> 'estate_closed_on', '')::date ELSE estate_closed_on END,
    memo = CASE WHEN p ? 'memo' THEN nullif(btrim(p ->> 'memo'), '') ELSE memo END,
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  WHERE case_id = p_case_id RETURNING * INTO v_row;

  IF v_row.insolvent_on IS NOT NULL AND v_case.filed_on IS NOT NULL AND v_row.insolvent_on > v_case.filed_on THEN
    RAISE EXCEPTION 'insolvency date after filing date' USING ERRCODE = '22023';
  END IF;
  IF v_row.deposit_paid_on IS NOT NULL AND v_case.filed_on IS NOT NULL AND v_row.deposit_paid_on < v_case.filed_on THEN
    RAISE EXCEPTION 'deposit paid before filing' USING ERRCODE = '22023';
  END IF;
  IF v_row.discharge_confirmed_on IS NOT NULL AND v_case.discharge_decided_on IS NOT NULL AND v_row.discharge_confirmed_on < v_case.discharge_decided_on THEN
    RAISE EXCEPTION 'confirmation before decision' USING ERRCODE = '22023';
  END IF;

  PERFORM public.case_add_event(v_case, 'bankruptcy.updated', '파산 진행 기록을 고쳤어요', (SELECT jsonb_object_agg(x, true) FROM jsonb_object_keys(coalesce(p, '{}'::jsonb)) x), false);
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.set_case_bankruptcy_details(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_case_bankruptcy_details(uuid, jsonb, integer) TO authenticated;

-- 의뢰인: 진행 날짜만 (관재인 연락처·예납 금액·메모 제외)
CREATE OR REPLACE FUNCTION public.client_bankruptcy_schedule(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case cases%ROWTYPE;
  d case_bankruptcy_details%ROWTYPE;
BEGIN
  IF NOT public.is_case_client(p_case_id) OR NOT public.is_account_active() THEN RETURN NULL; END IF;
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  IF v_case.case_type <> 'bankruptcy' THEN RETURN NULL; END IF;
  SELECT * INTO d FROM case_bankruptcy_details WHERE case_id = p_case_id;
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'filed_on', v_case.filed_on,
    'declared_on', v_case.commenced_on,
    'deposit_due_on', CASE WHEN d.deposit_paid_on IS NULL THEN d.deposit_due_on END,
    'deposit_paid', d.deposit_paid_on IS NOT NULL,
    'trustee_interview_on', d.trustee_interview_on,
    'creditors_meeting_on', v_case.creditors_meeting_on,
    'discharge_hearing_on', d.discharge_hearing_on,
    'discharge_decided_on', v_case.discharge_decided_on,
    'discharge_confirmed_on', d.discharge_confirmed_on));
END;
$$;
REVOKE ALL ON FUNCTION public.client_bankruptcy_schedule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_bankruptcy_schedule(uuid) TO authenticated;

-- 사건 유형 바꾸기 (BK-1): 회생·파산 공통 단계(상담~신청서 작성)에서만. 접수 뒤에는 종결(파산 전환) 후 새 사건으로
CREATE OR REPLACE FUNCTION public.set_case_type(p_case_id uuid, p_case_type text, p_reason text DEFAULT NULL)
RETURNS public.cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL FOR UPDATE;
  IF v_case.id IS NULL OR NOT public.has_office_permission(v_case.office_id, 'case.edit', v_case.id) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_case_type NOT IN ('rehab', 'bankruptcy') THEN RAISE EXCEPTION 'invalid case type' USING ERRCODE = '22023'; END IF;
  IF v_case.case_type = p_case_type THEN RETURN v_case; END IF;
  IF v_case.stage NOT IN ('consult', 'proposal_sent', 'contracting', 'documents', 'drafting') THEN
    RAISE EXCEPTION 'case already filed: close as converted and open a new case' USING ERRCODE = '22023';
  END IF;
  -- 공통 단계 코드는 두 유형에 다 있어 외래키가 그대로 맞는다
  UPDATE cases SET case_type = p_case_type, version = version + 1, updated_at = now(), updated_by = auth.uid()
   WHERE id = p_case_id RETURNING * INTO v_case;
  PERFORM public.case_add_event(v_case, 'case.type_changed',
    CASE WHEN p_case_type = 'bankruptcy' THEN '사건 유형을 개인파산·면책으로 바꿨어요' ELSE '사건 유형을 개인회생으로 바꿨어요' END,
    jsonb_strip_nulls(jsonb_build_object('case_type', p_case_type, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))), false);
  RETURN v_case;
END;
$$;
REVOKE ALL ON FUNCTION public.set_case_type(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_case_type(uuid, text, text) TO authenticated;

-- 사건 파기(CM-9) 때 함께 지운다
CREATE OR REPLACE FUNCTION public.bankruptcy_details_purge_with_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM case_bankruptcy_details WHERE case_id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cases_purge_bankruptcy_details ON public.cases;
CREATE TRIGGER cases_purge_bankruptcy_details AFTER UPDATE OF purged_at ON public.cases
  FOR EACH ROW WHEN (OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL)
  EXECUTE FUNCTION public.bankruptcy_details_purge_with_case();
