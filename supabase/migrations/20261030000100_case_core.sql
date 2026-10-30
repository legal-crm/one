-- ============================================================================
-- 묶음 2. 사람·사건 뼈대 (CM-1·CM-2·CM-3·CM-8·CM-9·CM-10, 31 기획서 4장)
-- ----------------------------------------------------------------------------
-- office_clients(사람) → cases(사건) → case_events(타임라인, 추가만)
-- 세부 단계표 case_stage_definitions 하나가 화면 묶음·의뢰인 문구를 정함
-- 쓰기는 함수만: create_case / record_case_milestone / update_case_basic /
--   set_case_assignment / trash·restore / save_case_form_draft / 의뢰인 연결 초대
-- 의뢰인은 office_clients.client_user_id = auth.uid() 인 사건의 공개 항목만
-- 통합관리자 정책 없음(제로날리지)
-- ============================================================================

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS hash_salt text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- ── 1. 세부 단계표 ──────────────────────────────────────────────────────────
CREATE TABLE public.case_stage_definitions (
  case_type text NOT NULL CHECK (case_type IN ('rehab', 'bankruptcy')),
  code text NOT NULL,
  sort_order integer NOT NULL,
  group_no integer NOT NULL CHECK (group_no BETWEEN 1 AND 6),
  office_label text NOT NULL,
  client_label text NOT NULL,
  PRIMARY KEY (case_type, code)
);

INSERT INTO public.case_stage_definitions (case_type, code, sort_order, group_no, office_label, client_label) VALUES
  ('rehab', 'consult', 10, 1, '상담', '상담 중'),
  ('rehab', 'proposal_sent', 20, 1, '제안서 발송', '제안서를 받았어요'),
  ('rehab', 'contracting', 30, 2, '계약 진행', '계약서 서명 대기'),
  ('rehab', 'documents', 40, 3, '서류 준비', '서류를 모으고 있어요'),
  ('rehab', 'drafting', 50, 4, '신청서 작성', '신청서를 쓰고 있어요'),
  ('rehab', 'filed', 60, 5, '접수', '법원에 접수했어요'),
  ('rehab', 'correction', 70, 5, '보정', '법원 보완 요청 대응 중'),
  ('rehab', 'commenced', 80, 6, '개시결정', '개시결정이 났어요'),
  ('rehab', 'creditors_meeting', 90, 6, '채권자집회·이의기간', '채권자집회를 앞두고 있어요'),
  ('rehab', 'repaying', 100, 6, '인가·변제', '변제를 하고 있어요'),
  ('rehab', 'discharge', 110, 6, '면책', '면책 절차를 진행하고 있어요'),
  ('rehab', 'closed', 120, 6, '종결', '사건이 끝났어요'),
  ('bankruptcy', 'consult', 10, 1, '상담', '상담 중'),
  ('bankruptcy', 'proposal_sent', 20, 1, '제안서 발송', '제안서를 받았어요'),
  ('bankruptcy', 'contracting', 30, 2, '계약 진행', '계약서 서명 대기'),
  ('bankruptcy', 'documents', 40, 3, '서류 준비', '서류를 모으고 있어요'),
  ('bankruptcy', 'drafting', 50, 4, '신청서 작성', '신청서를 쓰고 있어요'),
  ('bankruptcy', 'filed', 60, 5, '접수', '법원에 접수했어요'),
  ('bankruptcy', 'correction', 70, 5, '보정·예납', '법원 보완 요청 대응 중'),
  ('bankruptcy', 'declared', 80, 5, '파산선고', '파산선고가 났어요'),
  ('bankruptcy', 'trustee', 90, 6, '관재인 면담·자료 제출', '관재인 절차를 진행하고 있어요'),
  ('bankruptcy', 'creditors_meeting', 100, 6, '채권자집회·의견청취', '채권자집회를 앞두고 있어요'),
  ('bankruptcy', 'discharge_hearing', 110, 6, '면책 이의기간·면책심문', '면책 절차를 진행하고 있어요'),
  ('bankruptcy', 'discharge', 120, 6, '면책 결정·확정', '면책 결정 절차를 진행하고 있어요'),
  ('bankruptcy', 'closed', 130, 6, '종결', '사건이 끝났어요');

-- ── 2. 의뢰인(사람) ─────────────────────────────────────────────────────────
CREATE TABLE public.office_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  real_name text,
  phone text,
  email text,
  phone_hash text,
  client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'direct' CHECK (source IN ('consult_request', 'sales_lead', 'direct', 'import')),
  memo text NOT NULL DEFAULT '',
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz
);
CREATE INDEX idx_office_clients_office ON public.office_clients (office_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_office_clients_phone_hash ON public.office_clients (office_id, phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX idx_office_clients_user ON public.office_clients (client_user_id) WHERE client_user_id IS NOT NULL;

-- ── 3. 사건 ─────────────────────────────────────────────────────────────────
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  office_client_id uuid NOT NULL REFERENCES public.office_clients(id) ON DELETE RESTRICT,
  case_type text NOT NULL CHECK (case_type IN ('rehab', 'bankruptcy')),
  stage text NOT NULL DEFAULT 'consult',
  previous_stage text,
  lawyer_member_id uuid REFERENCES public.office_members(id) ON DELETE SET NULL,
  staff_member_id uuid REFERENCES public.office_members(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'direct' CHECK (source IN ('consult_request', 'sales_lead', 'direct', 'import', 'conversion')),
  consult_request_id text REFERENCES public.consult_requests(id) ON DELETE SET NULL,
  sales_lead_id uuid,
  converted_from_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  court_name text,
  case_number text,
  planned_filing_on date,
  filed_on date,
  commenced_on date,
  creditors_meeting_on date,
  confirmed_on date,
  discharge_decided_on date,
  close_reason text CHECK (close_reason IN ('consult_ended', 'contract_terminated', 'withdrawn', 'dismissed_or_abolished', 'discharged', 'converted_to_bankruptcy')),
  closed_on date,
  purge_after date,
  is_test boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  FOREIGN KEY (case_type, stage) REFERENCES public.case_stage_definitions(case_type, code)
);
CREATE INDEX idx_cases_office_stage ON public.cases (office_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_client ON public.cases (office_client_id);
CREATE UNIQUE INDEX uq_cases_consult_request_office ON public.cases (office_id, consult_request_id) WHERE consult_request_id IS NOT NULL AND deleted_at IS NULL;

-- 타임라인 (추가만)
CREATE TABLE public.case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ref_type text,
  ref_id text,
  client_visible boolean NOT NULL DEFAULT false,
  actor_user_id uuid,
  actor_member_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_events_case ON public.case_events (case_id, created_at DESC);

-- 서식 작성 초안 (부분 저장 + 버전 확인)
CREATE TABLE public.case_form_drafts (
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  form_key text NOT NULL CHECK (form_key ~ '^[a-z0-9_.-]{1,60}$'),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (case_id, form_key)
);

-- 법원 변제금 회차 장부 (CM-8)
CREATE TABLE public.case_plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  round_no integer NOT NULL CHECK (round_no >= 0),
  kind text NOT NULL DEFAULT 'plan' CHECK (kind IN ('pre_confirmation', 'plan')),
  due_on date NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'client_reported', 'confirmed', 'waived')),
  client_reported_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid,
  paid_on date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, kind, round_no)
);

-- 의뢰인 계정 연결 초대 (상담 요청이 없는 사건)
CREATE TABLE public.client_link_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  office_client_id uuid NOT NULL REFERENCES public.office_clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  used_at timestamptz,
  revoked_at timestamptz
);

-- ── 4. 도우미 ───────────────────────────────────────────────────────────────
CREATE FUNCTION public.normalize_phone(p_phone text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$ SELECT nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''); $$;

CREATE FUNCTION public.office_phone_hash(p_office_id text, p_phone text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT CASE WHEN public.normalize_phone(p_phone) IS NULL THEN NULL
    ELSE encode(hmac(public.normalize_phone(p_phone), o.hash_salt, 'sha256'), 'hex') END
  FROM offices o WHERE o.id = p_office_id;
$$;

CREATE FUNCTION public.case_stage_order(p_case_type text, p_stage text) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ SELECT sort_order FROM case_stage_definitions WHERE case_type = p_case_type AND code = p_stage; $$;

-- 배정 판정 (묶음 1의 임시 함수 교체)
CREATE OR REPLACE FUNCTION public.is_case_assignee(p_case_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases c
    JOIN office_members m ON m.id IN (c.lawyer_member_id, c.staff_member_id)
    WHERE c.id = p_case_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.office_id = c.office_id);
$$;

-- 의뢰인 본인 사건인지
CREATE FUNCTION public.is_case_client(p_case_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM cases c JOIN office_clients oc ON oc.id = c.office_client_id
    WHERE c.id = p_case_id AND oc.client_user_id = auth.uid() AND c.deleted_at IS NULL AND c.is_test = false);
$$;

CREATE FUNCTION public.case_add_event(p_case cases, p_kind text, p_summary text, p_detail jsonb, p_client_visible boolean,
                                      p_ref_type text DEFAULT NULL, p_ref_id text DEFAULT NULL) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member office_members := public.current_office_member(p_case.office_id);
  v_id uuid;
BEGIN
  INSERT INTO case_events (office_id, case_id, kind, summary, detail, ref_type, ref_id, client_visible, actor_user_id, actor_member_id)
  VALUES (p_case.office_id, p_case.id, p_kind, left(coalesce(p_summary, ''), 300), coalesce(p_detail, '{}'::jsonb),
          p_ref_type, p_ref_id, coalesce(p_client_visible, false), auth.uid(), v_member.id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 5. 사건 만들기 (모든 경로가 이 함수 하나) ───────────────────────────────
-- p jsonb: case_type, source, consult_request_id, sales_lead_id, display_name, real_name, phone, email,
--          planned_filing_on, title, office_client_id(같은 사람으로 묶을 때), is_test
CREATE FUNCTION public.create_case(p_office_id text, p jsonb) RETURNS public.cases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_case_type text := coalesce(nullif(p->>'case_type', ''), 'rehab');
  v_source text := coalesce(nullif(p->>'source', ''), 'direct');
  v_cr consult_requests;
  v_client_id uuid := nullif(p->>'office_client_id', '')::uuid;
  v_client_user uuid;
  v_display text := left(btrim(coalesce(p->>'display_name', '')), 50);
  v_real text := nullif(left(btrim(coalesce(p->>'real_name', '')), 50), '');
  v_phone text := public.normalize_phone(p->>'phone');
  v_contact_ok boolean := true;
  v_case cases;
  v_lawyer_member uuid;
BEGIN
  -- 배정 범위 직원도 만든 사건은 자기에게 배정되므로 범위가 none 만 아니면 허용
  IF v_member.id IS NULL
     OR (public.office_permission_scope(p_office_id, 'case.edit') = 'none'
         AND NOT (v_source = 'sales_lead' AND public.office_permission_scope(p_office_id, 'sales.convert') <> 'none')) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_case_type NOT IN ('rehab', 'bankruptcy') THEN RAISE EXCEPTION 'invalid case type' USING ERRCODE = '22023'; END IF;
  IF v_source NOT IN ('consult_request', 'sales_lead', 'direct', 'import', 'conversion') THEN RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023'; END IF;

  -- 마이김변 상담 요청: 이 사무소 변호사가 선택받은 요청만, 연락처는 공개 동의된 경우만 복사
  IF v_source = 'consult_request' THEN
    SELECT * INTO v_cr FROM consult_requests WHERE id = p->>'consult_request_id';
    IF v_cr.id IS NULL THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
    SELECT m.id INTO v_lawyer_member FROM office_members m
     WHERE m.office_id = p_office_id AND m.status = 'active' AND m.lawyer_id IS NOT NULL
       AND (v_cr.selected_lawyer_id = m.lawyer_id
            OR coalesce(v_cr.selected_lawyer_ids, '[]'::jsonb) ? m.lawyer_id
            OR coalesce(v_cr.accepted_lawyer_ids, '[]'::jsonb) ? m.lawyer_id
            OR v_cr.created_by_lawyer_id = m.lawyer_id)
     ORDER BY (m.user_id = auth.uid()) DESC, (m.role = 'owner') DESC LIMIT 1;
    IF v_lawyer_member IS NULL THEN RAISE EXCEPTION 'consult request is not addressed to this office' USING ERRCODE = '42501'; END IF;
    SELECT EXISTS (SELECT 1 FROM office_members m WHERE m.id = v_lawyer_member AND public.lawyer_can_see_contact(v_cr, m.lawyer_id))
      INTO v_contact_ok;
    IF v_cr.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_client_user := v_cr.client_id::uuid;
    END IF;
    IF v_display = '' THEN v_display := left(coalesce(v_cr.client_name, ''), 50); END IF;
    IF v_contact_ok THEN
      v_phone := coalesce(v_phone, public.normalize_phone(v_cr.phone));
    ELSE
      v_phone := NULL; v_real := NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM cases c WHERE c.office_id = p_office_id AND c.consult_request_id = v_cr.id AND c.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'case already exists for this consult request' USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_display = '' THEN v_display := coalesce(v_real, '의뢰인'); END IF;

  IF v_client_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM office_clients oc WHERE oc.id = v_client_id AND oc.office_id = p_office_id AND oc.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_client_user IS NOT NULL THEN
      UPDATE office_clients SET client_user_id = coalesce(client_user_id, v_client_user), updated_at = now() WHERE id = v_client_id;
    END IF;
  ELSE
    INSERT INTO office_clients (office_id, display_name, real_name, phone, email, phone_hash, client_user_id, source, is_test, created_by, updated_by)
    VALUES (p_office_id, v_display, v_real, v_phone, nullif(lower(btrim(coalesce(p->>'email', ''))), ''),
            public.office_phone_hash(p_office_id, v_phone), v_client_user,
            CASE WHEN v_source = 'conversion' THEN 'direct' ELSE v_source END,
            coalesce((p->>'is_test')::boolean, false), auth.uid(), auth.uid())
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO cases (office_id, office_client_id, case_type, stage, source, consult_request_id, sales_lead_id,
                     converted_from_case_id, title, planned_filing_on, lawyer_member_id, staff_member_id, is_test, created_by, updated_by)
  VALUES (p_office_id, v_client_id, v_case_type, 'consult', v_source,
          CASE WHEN v_source = 'consult_request' THEN v_cr.id END,
          nullif(p->>'sales_lead_id', '')::uuid,
          nullif(p->>'converted_from_case_id', '')::uuid,
          left(coalesce(p->>'title', ''), 100),
          nullif(p->>'planned_filing_on', '')::date,
          coalesce(v_lawyer_member, CASE WHEN v_member.role IN ('owner', 'lawyer') THEN v_member.id END),
          CASE WHEN v_member.role NOT IN ('owner', 'lawyer') THEN v_member.id END,
          coalesce((p->>'is_test')::boolean, false), auth.uid(), auth.uid())
  RETURNING * INTO v_case;

  PERFORM public.case_add_event(v_case, 'case.created', '사건을 만들었어요',
    jsonb_build_object('source', v_source, 'case_type', v_case_type), false);
  PERFORM public.office_log(p_office_id, 'case.create', 'case', v_case.id::text, jsonb_build_object('source', v_source));
  RETURN v_case;
END;
$$;

-- 같은 사람 확인 (전화번호 지문, 자동 합치기 없음)
CREATE FUNCTION public.find_office_clients_by_phone(p_office_id text, p_phone text)
  RETURNS TABLE(office_client_id uuid, display_name text, case_count bigint, last_case_at timestamptz)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  IF public.office_permission_scope(p_office_id, 'case.view') = 'none' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT oc.id, oc.display_name, count(c.id), max(c.created_at)
  FROM office_clients oc LEFT JOIN cases c ON c.office_client_id = oc.id AND c.deleted_at IS NULL
  WHERE oc.office_id = p_office_id AND oc.deleted_at IS NULL
    AND oc.phone_hash = public.office_phone_hash(p_office_id, p_phone)
  GROUP BY oc.id, oc.display_name;
END;
$$;

-- ── 6. 기록 → 단계 (CM-3) ──────────────────────────────────────────────────
-- 앞으로 가는 단계 변경은 기록으로만. 되돌리기·건너뛰기는 manual_stage(대표·담당 변호사 + 사유)
CREATE FUNCTION public.record_case_milestone(p_case_id uuid, p_kind text, p jsonb DEFAULT '{}'::jsonb) RETURNS public.cases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
  v_member office_members;
  v_target text;
  v_summary text;
  v_visible boolean := true;
  v_reason text := nullif(btrim(coalesce(p->>'reason', '')), '');
  v_date date := nullif(p->>'date', '')::date;
  v_is_lawyer boolean;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_case.office_id, 'case.edit', v_case.id) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF (p ? 'expected_version') AND (p->>'expected_version')::int <> v_case.version THEN
    RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001';
  END IF;
  v_member := public.current_office_member(v_case.office_id);
  v_is_lawyer := v_member.role = 'owner' OR (v_member.role = 'lawyer' AND v_case.lawyer_member_id = v_member.id);

  IF v_case.stage = 'closed' AND p_kind NOT IN ('reopened') THEN
    RAISE EXCEPTION 'case is closed' USING ERRCODE = '42501';
  END IF;

  CASE p_kind
    WHEN 'proposal_sent' THEN v_target := 'proposal_sent'; v_summary := '제안서를 보냈어요';
    WHEN 'contract_sent' THEN v_target := 'contracting'; v_summary := '계약서를 보냈어요';
    WHEN 'contract_signed' THEN v_target := 'documents'; v_summary := '계약을 맺었어요';
    WHEN 'drafting_started' THEN v_target := 'drafting'; v_summary := '신청서 작성을 시작했어요';
    WHEN 'case_number_registered' THEN
      IF nullif(btrim(coalesce(p->>'case_number', '')), '') IS NULL OR nullif(btrim(coalesce(p->>'court_name', '')), '') IS NULL THEN
        RAISE EXCEPTION 'case_number and court_name required' USING ERRCODE = '22023';
      END IF;
      v_target := 'filed'; v_summary := '법원에 접수했어요';
      v_case.case_number := left(btrim(p->>'case_number'), 40);
      v_case.court_name := left(btrim(p->>'court_name'), 40);
      v_case.filed_on := coalesce(v_date, (now() AT TIME ZONE 'Asia/Seoul')::date);
    WHEN 'correction_registered' THEN v_target := 'correction'; v_summary := '법원 보정 요청을 등록했어요';
    WHEN 'commencement_decided' THEN
      IF v_case.case_type <> 'rehab' OR v_date IS NULL THEN RAISE EXCEPTION 'rehab case and date required' USING ERRCODE = '22023'; END IF;
      v_target := 'commenced'; v_summary := '개시결정을 기록했어요'; v_case.commenced_on := v_date;
    WHEN 'bankruptcy_declared' THEN
      IF v_case.case_type <> 'bankruptcy' OR v_date IS NULL THEN RAISE EXCEPTION 'bankruptcy case and date required' USING ERRCODE = '22023'; END IF;
      v_target := 'declared'; v_summary := '파산선고를 기록했어요'; v_case.commenced_on := v_date;
    WHEN 'trustee_assigned' THEN
      IF v_case.case_type <> 'bankruptcy' THEN RAISE EXCEPTION 'bankruptcy case required' USING ERRCODE = '22023'; END IF;
      v_target := 'trustee'; v_summary := '관재인 절차를 기록했어요';
    WHEN 'creditors_meeting_set' THEN
      IF v_date IS NULL THEN RAISE EXCEPTION 'date required' USING ERRCODE = '22023'; END IF;
      v_target := 'creditors_meeting'; v_summary := '채권자집회 기일을 등록했어요'; v_case.creditors_meeting_on := v_date;
    WHEN 'plan_confirmed' THEN
      IF v_case.case_type <> 'rehab' OR v_date IS NULL THEN RAISE EXCEPTION 'rehab case and date required' USING ERRCODE = '22023'; END IF;
      v_target := 'repaying'; v_summary := '인가결정을 기록했어요'; v_case.confirmed_on := v_date;
    WHEN 'discharge_hearing_set' THEN
      IF v_case.case_type <> 'bankruptcy' THEN RAISE EXCEPTION 'bankruptcy case required' USING ERRCODE = '22023'; END IF;
      v_target := 'discharge_hearing'; v_summary := '면책 심문 일정을 기록했어요';
    WHEN 'discharge_filed' THEN v_target := 'discharge'; v_summary := '면책 절차를 기록했어요';
    WHEN 'discharge_decided' THEN
      IF v_date IS NULL THEN RAISE EXCEPTION 'date required' USING ERRCODE = '22023'; END IF;
      v_target := 'discharge'; v_summary := '면책 결정을 기록했어요'; v_case.discharge_decided_on := v_date;
    WHEN 'closed' THEN
      IF NOT v_is_lawyer THEN RAISE EXCEPTION 'only owner or assigned lawyer can close' USING ERRCODE = '42501'; END IF;
      IF coalesce(p->>'close_reason', '') NOT IN ('consult_ended', 'contract_terminated', 'withdrawn', 'dismissed_or_abolished', 'discharged', 'converted_to_bankruptcy') THEN
        RAISE EXCEPTION 'invalid close reason' USING ERRCODE = '22023';
      END IF;
      IF p->>'close_reason' IN ('dismissed_or_abolished', 'discharged') AND v_date IS NULL THEN
        RAISE EXCEPTION 'decision date required' USING ERRCODE = '22023';
      END IF;
      v_target := 'closed'; v_summary := '사건을 종결했어요';
      v_case.close_reason := p->>'close_reason';
      v_case.closed_on := coalesce(v_date, (now() AT TIME ZONE 'Asia/Seoul')::date);
      v_case.purge_after := (v_case.closed_on + interval '5 years')::date;
    WHEN 'reopened' THEN
      IF NOT v_is_lawyer THEN RAISE EXCEPTION 'only owner or assigned lawyer can reopen' USING ERRCODE = '42501'; END IF;
      IF v_case.stage <> 'closed' THEN RAISE EXCEPTION 'case is not closed' USING ERRCODE = '22023'; END IF;
      IF v_reason IS NULL THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
      v_target := coalesce(v_case.previous_stage, 'consult'); v_summary := '사건을 다시 열었어요';
      v_case.close_reason := NULL; v_case.closed_on := NULL; v_case.purge_after := NULL;
    WHEN 'manual_stage' THEN
      IF NOT v_is_lawyer THEN RAISE EXCEPTION 'only owner or assigned lawyer can change stage manually' USING ERRCODE = '42501'; END IF;
      IF v_reason IS NULL THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
      v_target := p->>'stage';
      IF v_target = 'closed' THEN RAISE EXCEPTION 'use closed milestone' USING ERRCODE = '22023'; END IF;
      v_summary := '단계를 직접 바꿨어요'; v_visible := false;
    ELSE
      RAISE EXCEPTION 'unknown milestone %', p_kind USING ERRCODE = '22023';
  END CASE;

  IF public.case_stage_order(v_case.case_type, v_target) IS NULL THEN
    RAISE EXCEPTION 'invalid stage for case type' USING ERRCODE = '22023';
  END IF;
  -- 기록으로는 뒤로 가지 않음(같은 단계 반복 기록은 허용: 보정 2차 등). 되돌리기는 manual_stage·reopened 만
  IF p_kind NOT IN ('manual_stage', 'reopened')
     AND public.case_stage_order(v_case.case_type, v_target) < public.case_stage_order(v_case.case_type, v_case.stage) THEN
    v_target := v_case.stage;
  END IF;

  UPDATE cases SET
    previous_stage = CASE WHEN v_target = 'closed' THEN v_case.stage ELSE previous_stage END,
    stage = v_target,
    case_number = v_case.case_number, court_name = v_case.court_name, filed_on = v_case.filed_on,
    commenced_on = v_case.commenced_on, creditors_meeting_on = v_case.creditors_meeting_on,
    confirmed_on = v_case.confirmed_on, discharge_decided_on = v_case.discharge_decided_on,
    close_reason = v_case.close_reason, closed_on = v_case.closed_on, purge_after = v_case.purge_after,
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  PERFORM public.case_add_event(v_case, 'milestone.' || p_kind, v_summary,
    (p - 'expected_version') || jsonb_build_object('stage', v_target), v_visible);
  RETURN v_case;
END;
$$;

-- ── 7. 기본 정보·배정·휴지통 ───────────────────────────────────────────────
CREATE FUNCTION public.update_case_basic(p_case_id uuid, p jsonb) RETURNS public.cases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_case.office_id, 'case.edit', v_case.id) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF (p ? 'expected_version') AND (p->>'expected_version')::int <> v_case.version THEN
    RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001';
  END IF;
  UPDATE cases SET
    title = CASE WHEN p ? 'title' THEN left(coalesce(p->>'title', ''), 100) ELSE title END,
    planned_filing_on = CASE WHEN p ? 'planned_filing_on' THEN nullif(p->>'planned_filing_on', '')::date ELSE planned_filing_on END,
    court_name = CASE WHEN p ? 'court_name' THEN nullif(left(btrim(coalesce(p->>'court_name', '')), 40), '') ELSE court_name END,
    case_number = CASE WHEN p ? 'case_number' THEN nullif(left(btrim(coalesce(p->>'case_number', '')), 40), '') ELSE case_number END,
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_case_id RETURNING * INTO v_case;
  PERFORM public.case_add_event(v_case, 'case.updated', '사건 정보를 고쳤어요', p - 'expected_version', false);
  RETURN v_case;
END;
$$;

CREATE FUNCTION public.update_office_client(p_client_id uuid, p jsonb) RETURNS public.office_clients
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_c office_clients;
  v_ok boolean;
BEGIN
  SELECT * INTO v_c FROM office_clients WHERE id = p_client_id AND deleted_at IS NULL FOR UPDATE;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002'; END IF;
  SELECT public.office_permission_scope(v_c.office_id, 'case.edit') = 'all'
      OR EXISTS (SELECT 1 FROM cases c WHERE c.office_client_id = v_c.id AND public.has_office_permission(v_c.office_id, 'case.edit', c.id))
    INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  UPDATE office_clients SET
    display_name = CASE WHEN p ? 'display_name' THEN left(btrim(coalesce(p->>'display_name', '')), 50) ELSE display_name END,
    real_name = CASE WHEN p ? 'real_name' THEN nullif(left(btrim(coalesce(p->>'real_name', '')), 50), '') ELSE real_name END,
    phone = CASE WHEN p ? 'phone' THEN public.normalize_phone(p->>'phone') ELSE phone END,
    phone_hash = CASE WHEN p ? 'phone' THEN public.office_phone_hash(office_id, p->>'phone') ELSE phone_hash END,
    email = CASE WHEN p ? 'email' THEN nullif(lower(btrim(coalesce(p->>'email', ''))), '') ELSE email END,
    memo = CASE WHEN p ? 'memo' THEN left(coalesce(p->>'memo', ''), 2000) ELSE memo END,
    updated_at = now(), updated_by = auth.uid()
  WHERE id = p_client_id RETURNING * INTO v_c;
  RETURN v_c;
END;
$$;

CREATE FUNCTION public.set_case_assignment(p_case_id uuid, p_lawyer_member_id uuid, p_staff_member_id uuid) RETURNS public.cases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_case.office_id, 'case.assign', v_case.id) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_lawyer_member_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM office_members m WHERE m.id = p_lawyer_member_id AND m.office_id = v_case.office_id
         AND m.status = 'active' AND m.role IN ('owner', 'lawyer')) THEN
    RAISE EXCEPTION 'lawyer must be an active lawyer of this office' USING ERRCODE = '22023';
  END IF;
  IF p_staff_member_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM office_members m WHERE m.id = p_staff_member_id AND m.office_id = v_case.office_id AND m.status = 'active') THEN
    RAISE EXCEPTION 'staff must be an active member of this office' USING ERRCODE = '22023';
  END IF;
  UPDATE cases SET lawyer_member_id = p_lawyer_member_id, staff_member_id = p_staff_member_id,
         version = version + 1, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_case_id RETURNING * INTO v_case;
  PERFORM public.case_add_event(v_case, 'case.assigned', '담당을 바꿨어요',
    jsonb_build_object('lawyer_member_id', p_lawyer_member_id, 'staff_member_id', p_staff_member_id), false);
  PERFORM public.office_log(v_case.office_id, 'case.assign', 'case', v_case.id::text,
    jsonb_build_object('lawyer_member_id', p_lawyer_member_id, 'staff_member_id', p_staff_member_id));
  RETURN v_case;
END;
$$;

CREATE FUNCTION public.trash_case(p_case_id uuid, p_restore boolean DEFAULT false) RETURNS public.cases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_case.office_id, 'case.delete') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_restore AND v_case.deleted_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'restore window passed' USING ERRCODE = '42501';
  END IF;
  UPDATE cases SET deleted_at = CASE WHEN p_restore THEN NULL ELSE now() END,
         version = version + 1, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_case_id RETURNING * INTO v_case;
  PERFORM public.office_log(v_case.office_id, CASE WHEN p_restore THEN 'case.restore' ELSE 'case.trash' END, 'case', v_case.id::text);
  RETURN v_case;
END;
$$;

-- 서식 초안 부분 저장 (바뀐 칸만, 버전 확인)
CREATE FUNCTION public.save_case_form_draft(p_case_id uuid, p_form_key text, p_patch jsonb, p_expected_version integer DEFAULT NULL)
  RETURNS public.case_form_drafts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
  v_row case_form_drafts;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.has_office_permission(v_case.office_id, 'court_forms.manage', v_case.id)
          OR public.has_office_permission(v_case.office_id, 'case.edit', v_case.id)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  -- 주민등록번호 형태 값 저장 금지 (L8)
  IF coalesce(p_patch::text, '') ~ '[0-9]{6}-?[1-4][0-9]{6}' THEN
    RAISE EXCEPTION 'resident registration numbers must not be stored' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM case_form_drafts WHERE case_id = p_case_id AND form_key = p_form_key FOR UPDATE;
  IF v_row.case_id IS NULL THEN
    INSERT INTO case_form_drafts (case_id, form_key, office_id, data, version, updated_by)
    VALUES (p_case_id, p_form_key, v_case.office_id, jsonb_strip_nulls(coalesce(p_patch, '{}'::jsonb)), 1, auth.uid())
    RETURNING * INTO v_row;
  ELSE
    IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN
      RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001';
    END IF;
    UPDATE case_form_drafts SET data = jsonb_strip_nulls(data || coalesce(p_patch, '{}'::jsonb)),
           version = version + 1, updated_at = now(), updated_by = auth.uid()
    WHERE case_id = p_case_id AND form_key = p_form_key RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- ── 8. 변제 회차 장부 (CM-8) ───────────────────────────────────────────────
CREATE FUNCTION public.set_case_plan_payments(p_case_id uuid, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case cases;
  v_n integer := 0;
  r jsonb;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_office_permission(v_case.office_id, 'case.edit', v_case.id) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  -- 아직 확인되지 않은 회차만 다시 만듦 (확인·보고된 회차는 보존)
  DELETE FROM case_plan_payments WHERE case_id = p_case_id AND status = 'unpaid';
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) LOOP
    INSERT INTO case_plan_payments (office_id, case_id, round_no, kind, due_on, amount)
    VALUES (v_case.office_id, p_case_id, (r->>'round_no')::int, coalesce(r->>'kind', 'plan'), (r->>'due_on')::date, (r->>'amount')::bigint)
    ON CONFLICT (case_id, kind, round_no) DO NOTHING;
    v_n := v_n + 1;
  END LOOP;
  PERFORM public.case_add_event(v_case, 'plan_payments.set', '변제 회차표를 만들었어요', jsonb_build_object('rounds', v_n), true);
  RETURN v_n;
END;
$$;

CREATE FUNCTION public.mark_case_plan_payment(p_payment_id uuid, p_action text, p_paid_on date DEFAULT NULL, p_note text DEFAULT NULL)
  RETURNS public.case_plan_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_p case_plan_payments;
  v_case cases;
BEGIN
  SELECT * INTO v_p FROM case_plan_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_case FROM cases WHERE id = v_p.case_id;
  IF p_action = 'client_report' THEN
    IF NOT public.is_case_client(v_p.case_id) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
    IF v_p.status <> 'unpaid' THEN RAISE EXCEPTION 'already reported' USING ERRCODE = '22023'; END IF;
    UPDATE case_plan_payments SET status = 'client_reported', client_reported_at = now(), paid_on = coalesce(p_paid_on, paid_on), updated_at = now()
    WHERE id = p_payment_id RETURNING * INTO v_p;
    INSERT INTO case_events (office_id, case_id, kind, summary, detail, client_visible, actor_user_id)
    VALUES (v_p.office_id, v_p.case_id, 'plan_payment.client_reported', '의뢰인이 납부했다고 알렸어요',
            jsonb_build_object('round_no', v_p.round_no, 'paid_on', p_paid_on), true, auth.uid());
  ELSIF p_action IN ('confirm', 'unpaid', 'waive') THEN
    IF NOT public.has_office_permission(v_p.office_id, 'case.edit', v_p.case_id) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
    UPDATE case_plan_payments SET
      status = CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'waive' THEN 'waived' ELSE 'unpaid' END,
      confirmed_at = CASE WHEN p_action = 'confirm' THEN now() END,
      confirmed_by = CASE WHEN p_action = 'confirm' THEN auth.uid() END,
      paid_on = CASE WHEN p_action = 'confirm' THEN coalesce(p_paid_on, paid_on, (now() AT TIME ZONE 'Asia/Seoul')::date) WHEN p_action = 'unpaid' THEN NULL ELSE paid_on END,
      note = coalesce(left(p_note, 300), note), updated_at = now()
    WHERE id = p_payment_id RETURNING * INTO v_p;
    PERFORM public.case_add_event(v_case, 'plan_payment.' || p_action, '변제 회차 납부 상태를 바꿨어요',
      jsonb_build_object('round_no', v_p.round_no, 'status', v_p.status), true);
  ELSE
    RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023';
  END IF;
  RETURN v_p;
END;
$$;

-- ── 9. 의뢰인 계정 연결 ────────────────────────────────────────────────────
CREATE FUNCTION public.create_client_link_invite(p_office_client_id uuid, p_ttl_hours integer DEFAULT 168)
  RETURNS TABLE(invite_id uuid, token text, expires_at timestamptz)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  v_c office_clients;
  v_token text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  SELECT * INTO v_c FROM office_clients WHERE id = p_office_client_id AND deleted_at IS NULL;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.office_permission_scope(v_c.office_id, 'case.edit') = 'all'
          OR EXISTS (SELECT 1 FROM cases c WHERE c.office_client_id = v_c.id AND public.has_office_permission(v_c.office_id, 'case.edit', c.id))) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_c.client_user_id IS NOT NULL THEN RAISE EXCEPTION 'already linked' USING ERRCODE = '22023'; END IF;
  IF p_ttl_hours NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'invalid ttl' USING ERRCODE = '22023'; END IF;
  UPDATE client_link_invites SET revoked_at = now() WHERE office_client_id = v_c.id AND used_at IS NULL AND revoked_at IS NULL;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_exp := now() + make_interval(hours => p_ttl_hours);
  INSERT INTO client_link_invites (office_id, office_client_id, token_hash, expires_at, created_by)
  VALUES (v_c.office_id, v_c.id, encode(digest(v_token, 'sha256'), 'hex'), v_exp, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.office_log(v_c.office_id, 'client_link.create', 'office_client', v_c.id::text);
  RETURN QUERY SELECT v_id, v_token, v_exp;
END;
$$;

CREATE FUNCTION public.accept_client_link_invite(p_token text) RETURNS TABLE(office_name text, case_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  v_inv client_link_invites;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  -- 변호사·직원 계정으로는 의뢰인 연결 불가
  IF EXISTS (SELECT 1 FROM office_members m WHERE m.user_id = v_uid AND m.status = 'active') THEN
    RAISE EXCEPTION 'office accounts cannot be linked as clients' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_inv FROM client_link_invites WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite' USING ERRCODE = 'P0002'; END IF;
  IF v_inv.used_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invite no longer valid' USING ERRCODE = '42501';
  END IF;
  UPDATE office_clients SET client_user_id = v_uid, updated_at = now() WHERE id = v_inv.office_client_id AND client_user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'already linked' USING ERRCODE = '22023'; END IF;
  UPDATE client_link_invites SET used_by = v_uid, used_at = now() WHERE id = v_inv.id;
  INSERT INTO office_audit_logs (office_id, actor_user_id, action, target_type, target_id, ip_address)
  VALUES (v_inv.office_id, v_uid, 'client_link.accept', 'office_client', v_inv.office_client_id::text, public.request_client_ip());
  RETURN QUERY
  SELECT o.name, (SELECT count(*) FROM cases c WHERE c.office_client_id = v_inv.office_client_id AND c.deleted_at IS NULL)
  FROM offices o WHERE o.id = v_inv.office_id;
END;
$$;

-- ── 10. 의뢰인 화면용 읽기 (공개 항목만, 실명·담당 직원·메모 없음) ─────────
CREATE FUNCTION public.my_cases() RETURNS TABLE(case_id uuid, office_name text, case_type text, stage text, client_stage_label text,
  group_no integer, court_name text, case_number text, filed_on date, commenced_on date, creditors_meeting_on date,
  confirmed_on date, discharge_decided_on date, closed_on date, close_reason text, updated_at timestamptz)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, o.name, c.case_type, c.stage, d.client_label, d.group_no, c.court_name, c.case_number, c.filed_on,
         c.commenced_on, c.creditors_meeting_on, c.confirmed_on, c.discharge_decided_on, c.closed_on, c.close_reason, c.updated_at
  FROM cases c
  JOIN office_clients oc ON oc.id = c.office_client_id
  JOIN offices o ON o.id = c.office_id
  JOIN case_stage_definitions d ON d.case_type = c.case_type AND d.code = c.stage
  WHERE oc.client_user_id = auth.uid() AND c.deleted_at IS NULL AND c.is_test = false
  ORDER BY c.updated_at DESC;
$$;

-- ── 11. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.case_stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_plan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_link_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_stage_definitions_read ON public.case_stage_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY office_clients_office_read ON public.office_clients FOR SELECT TO authenticated
  USING (public.office_permission_scope(office_id, 'case.view') = 'all'
         OR EXISTS (SELECT 1 FROM public.cases c WHERE c.office_client_id = office_clients.id AND public.is_case_assignee(c.id)));

CREATE POLICY cases_office_read ON public.cases FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view', id));

CREATE POLICY case_events_office_read ON public.case_events FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view', case_id));
CREATE POLICY case_events_client_read ON public.case_events FOR SELECT TO authenticated
  USING (client_visible AND public.is_case_client(case_id));

CREATE POLICY case_form_drafts_office_read ON public.case_form_drafts FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view', case_id));

CREATE POLICY case_plan_payments_office_read ON public.case_plan_payments FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view', case_id));
CREATE POLICY case_plan_payments_client_read ON public.case_plan_payments FOR SELECT TO authenticated
  USING (public.is_case_client(case_id));

CREATE POLICY client_link_invites_office_read ON public.client_link_invites FOR SELECT TO authenticated
  USING (public.office_permission_scope(office_id, 'case.edit') <> 'none');

-- ── 12. 권한 ────────────────────────────────────────────────────────────────
REVOKE ALL ON public.case_stage_definitions, public.office_clients, public.cases, public.case_events,
              public.case_form_drafts, public.case_plan_payments, public.client_link_invites FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.case_stage_definitions, public.office_clients, public.cases, public.case_events,
              public.case_form_drafts, public.case_plan_payments, public.client_link_invites FROM authenticated;
GRANT SELECT ON public.case_stage_definitions, public.office_clients, public.cases, public.case_events,
              public.case_form_drafts, public.case_plan_payments, public.client_link_invites TO authenticated;
GRANT ALL ON public.case_stage_definitions, public.office_clients, public.cases, public.case_events,
              public.case_form_drafts, public.case_plan_payments, public.client_link_invites TO service_role;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.normalize_phone(text)', 'public.office_phone_hash(text, text)', 'public.case_stage_order(text, text)',
    'public.is_case_assignee(uuid)', 'public.is_case_client(uuid)',
    'public.case_add_event(public.cases, text, text, jsonb, boolean, text, text)',
    'public.create_case(text, jsonb)', 'public.find_office_clients_by_phone(text, text)',
    'public.record_case_milestone(uuid, text, jsonb)', 'public.update_case_basic(uuid, jsonb)',
    'public.update_office_client(uuid, jsonb)', 'public.set_case_assignment(uuid, uuid, uuid)',
    'public.trash_case(uuid, boolean)', 'public.save_case_form_draft(uuid, text, jsonb, integer)',
    'public.set_case_plan_payments(uuid, jsonb)', 'public.mark_case_plan_payment(uuid, text, date, text)',
    'public.create_client_link_invite(uuid, integer)', 'public.accept_client_link_invite(text)', 'public.my_cases()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
-- 내부 전용(화면에서 부르지 않음)
REVOKE EXECUTE ON FUNCTION public.case_add_event(public.cases, text, text, jsonb, boolean, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.office_phone_hash(text, text) FROM authenticated;

NOTIFY pgrst, 'reload schema';
