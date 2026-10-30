-- ============================================================
-- H-14 의뢰인 서식 작성 요청 (client_form_requests / client_form_submissions)
-- 이전: 요청이 변호사 브라우저(localStorage)에만 저장되고 /mobile-doc?token= 링크로 개인정보를 받으려 했으나
--       라우트가 없어 의뢰인은 열 수 없었다. 토큰 링크는 폐기하고(FH-Q2), 로그인한 의뢰인의 '내 사건'에서 작성한다.
-- 원칙: 질문 칸은 요청할 때 사본으로 저장(나중에 서식 정의가 바뀌어도 요청 당시 질문 그대로),
--       제출본은 추가만(버전), 주민등록번호 형태 값 거절(L8), 제3자 서명은 출력·자필·사진 업로드(FH-Q3).
-- 쓰기는 모두 서버 함수로만. 표 직접 접근 없음.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_form_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (char_length(case_key) BETWEEN 1 AND 120),
  doc_code text NOT NULL CHECK (char_length(doc_code) BETWEEN 1 AND 30),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  needs_signature boolean NOT NULL DEFAULT false,
  third_party_signer text CHECK (third_party_signer IS NULL OR char_length(third_party_signer) <= 60),
  due_on date,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_progress', 'submitted', 'needs_fix', 'accepted', 'cancelled')),
  draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  fix_reason text CHECK (fix_reason IS NULL OR char_length(fix_reason) <= 1000),
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  requested_by uuid DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_form_requests_case_idx ON public.client_form_requests (office_id, case_key, status);
-- 같은 사건·같은 서식은 진행 중인 요청 하나만
CREATE UNIQUE INDEX IF NOT EXISTS client_form_requests_open_uniq ON public.client_form_requests (office_id, case_key, doc_code)
  WHERE status IN ('requested', 'in_progress', 'submitted', 'needs_fix');

CREATE TABLE IF NOT EXISTS public.client_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.client_form_requests(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version BETWEEN 1 AND 50),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_file_id text,
  file_ids text[] NOT NULL DEFAULT '{}',
  submitted_by uuid DEFAULT auth.uid(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, version)
);

ALTER TABLE public.client_form_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_form_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_form_requests, public.client_form_submissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.client_form_requests, public.client_form_submissions TO service_role;

-- 제출본은 고칠 수 없다 (추가만)
CREATE OR REPLACE FUNCTION public.client_form_submissions_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'form submissions are append-only' USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS client_form_submissions_no_update ON public.client_form_submissions;
CREATE TRIGGER client_form_submissions_no_update BEFORE UPDATE ON public.client_form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.client_form_submissions_immutable();

-- ── 도우미 ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.client_form_has_rrn(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p::text, '') ~ '[0-9]{6}\s*-?\s*[1-4][0-9]{6}';
$$;

-- 질문 칸 검사: id·label·type·required·options·help (40칸까지)
CREATE OR REPLACE FUNCTION public.client_form_clean_fields(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  f jsonb;
  v_out jsonb := '[]'::jsonb;
  v_ids text[] := '{}';
  v_id text;
  v_type text;
BEGIN
  IF jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) = 0 OR jsonb_array_length(p) > 40 THEN
    RAISE EXCEPTION 'fields must be 1-40 items' USING ERRCODE = '22023';
  END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(p) LOOP
    v_id := f ->> 'id';
    v_type := coalesce(f ->> 'type', 'text');
    IF v_id IS NULL OR v_id !~ '^[a-z0-9_]{1,40}$' OR v_id = ANY (v_ids) THEN
      RAISE EXCEPTION 'bad field id' USING ERRCODE = '22023';
    END IF;
    IF v_type NOT IN ('text', 'number', 'date', 'select', 'textarea', 'radio', 'currency') THEN
      RAISE EXCEPTION 'bad field type' USING ERRCODE = '22023';
    END IF;
    IF coalesce(btrim(f ->> 'label'), '') = '' OR char_length(f ->> 'label') > 100 THEN
      RAISE EXCEPTION 'bad field label' USING ERRCODE = '22023';
    END IF;
    v_ids := v_ids || v_id;
    v_out := v_out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', v_id, 'type', v_type, 'label', left(btrim(f ->> 'label'), 100),
      'required', coalesce((f ->> 'required')::boolean, false),
      'placeholder', nullif(left(coalesce(f ->> 'placeholder', ''), 100), ''),
      'helpText', nullif(left(coalesce(f ->> 'helpText', ''), 300), ''),
      'options', CASE WHEN jsonb_typeof(f -> 'options') = 'array' AND jsonb_array_length(f -> 'options') <= 20
                      THEN (SELECT jsonb_agg(left(o, 60)) FROM jsonb_array_elements_text(f -> 'options') o) END)));
  END LOOP;
  RETURN v_out;
END;
$$;

-- ── 사무소 함수 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_client_form(p_office_id text, p_case_key text, p jsonb)
RETURNS public.client_form_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row client_form_requests%ROWTYPE;
  v_client uuid;
BEGIN
  IF NOT public.correction_can(p_office_id, p_case_key, 'documents.manage') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p ->> 'doc_code'), '') = '' OR coalesce(btrim(p ->> 'title'), '') = '' THEN
    RAISE EXCEPTION 'doc_code and title required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM client_form_requests WHERE office_id = p_office_id AND case_key = p_case_key
             AND doc_code = p ->> 'doc_code' AND status IN ('requested', 'in_progress', 'submitted', 'needs_fix')) THEN
    RAISE EXCEPTION 'already requested' USING ERRCODE = '23505';
  END IF;
  INSERT INTO client_form_requests (office_id, case_key, doc_code, title, fields, note, needs_signature, third_party_signer, due_on)
  VALUES (p_office_id, p_case_key, left(btrim(p ->> 'doc_code'), 30), left(btrim(p ->> 'title'), 120),
          public.client_form_clean_fields(p -> 'fields'),
          nullif(left(btrim(coalesce(p ->> 'note', '')), 1000), ''),
          coalesce((p ->> 'needs_signature')::boolean, false),
          nullif(left(btrim(coalesce(p ->> 'third_party_signer', '')), 60), ''),
          nullif(p ->> 'due_on', '')::date)
  RETURNING * INTO v_row;
  v_client := public.case_key_client_user(p_case_key);
  IF v_client IS NOT NULL THEN
    PERFORM public.notify_user(v_client, 'client', NULL, 'form_request', '사무소가 서류 작성을 요청했어요',
      v_row.title || CASE WHEN v_row.due_on IS NOT NULL THEN ' · ' || to_char(v_row.due_on, 'MM/DD') || '까지' ELSE '' END
        || '. 내 사건에서 작성해 주세요.',
      'case_forms', p_case_key, 'form:' || v_row.id);
  END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.request_client_form(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_client_form(text, text, jsonb) TO authenticated;

-- 검토: accept(확인) / needs_fix(보완 요청, 사유 필수) / cancel(요청 취소, 사유 필수)
CREATE OR REPLACE FUNCTION public.review_client_form(p_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS public.client_form_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r client_form_requests%ROWTYPE;
  v_client uuid;
BEGIN
  SELECT * INTO r FROM client_form_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.correction_can(r.office_id, r.case_key, 'documents.manage') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('accept', 'needs_fix', 'cancel') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;
  IF r.status IN ('accepted', 'cancelled') THEN RAISE EXCEPTION 'request closed' USING ERRCODE = '22023'; END IF;
  IF p_action IN ('needs_fix', 'cancel') AND coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('accept', 'needs_fix') AND r.status <> 'submitted' THEN
    RAISE EXCEPTION 'nothing submitted yet' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE client_form_requests SET status = 'accepted', fix_reason = NULL, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
     WHERE id = p_id RETURNING * INTO r;
  ELSIF p_action = 'needs_fix' THEN
    UPDATE client_form_requests SET status = 'needs_fix', fix_reason = left(btrim(p_reason), 1000), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
     WHERE id = p_id RETURNING * INTO r;
    v_client := public.case_key_client_user(r.case_key);
    IF v_client IS NOT NULL THEN
      PERFORM public.notify_user(v_client, 'client', NULL, 'form_fix', '작성한 서류에 보완이 필요해요',
        r.title || ': ' || left(btrim(p_reason), 120), 'case_forms', r.case_key, 'form_fix:' || r.id);
    END IF;
  ELSE
    UPDATE client_form_requests SET status = 'cancelled', cancel_reason = left(btrim(p_reason), 500), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
     WHERE id = p_id RETURNING * INTO r;
  END IF;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.review_client_form(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_client_form(uuid, text, text) TO authenticated;

-- 사건의 작성 요청 + 최신 제출본 (사무소)
CREATE OR REPLACE FUNCTION public.office_client_forms(p_office_id text, p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.correction_can(p_office_id, p_case_key, 'case.view') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'doc_code', r.doc_code, 'title', r.title, 'fields', r.fields, 'note', r.note,
      'needs_signature', r.needs_signature, 'third_party_signer', r.third_party_signer, 'due_on', r.due_on,
      'status', r.status, 'fix_reason', r.fix_reason, 'cancel_reason', r.cancel_reason,
      'requested_at', r.requested_at, 'reviewed_at', r.reviewed_at,
      'submission', (SELECT jsonb_build_object('version', s.version, 'answers', s.answers, 'signature_file_id', s.signature_file_id,
                                               'file_ids', to_jsonb(s.file_ids), 'submitted_at', s.submitted_at)
                     FROM client_form_submissions s WHERE s.request_id = r.id ORDER BY s.version DESC LIMIT 1))
      ORDER BY (r.status IN ('accepted', 'cancelled')), r.requested_at DESC)
    FROM client_form_requests r
    WHERE r.office_id = p_office_id AND r.case_key = p_case_key
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.office_client_forms(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_client_forms(text, text) TO authenticated;

-- ── 의뢰인 함수 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.client_form_view(p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.client_owns_case_key(p_case_key) OR NOT public.is_account_active() THEN RETURN NULL; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'doc_code', r.doc_code, 'title', r.title, 'fields', r.fields, 'note', r.note,
      'needs_signature', r.needs_signature, 'third_party_signer', r.third_party_signer, 'due_on', r.due_on,
      'status', r.status, 'fix_reason', r.fix_reason, 'draft', r.draft_answers, 'requested_at', r.requested_at,
      'submitted_version', (SELECT max(s.version) FROM client_form_submissions s WHERE s.request_id = r.id))
      ORDER BY (r.status = 'accepted'), r.requested_at DESC)
    FROM client_form_requests r
    WHERE r.case_key = p_case_key AND r.status <> 'cancelled'
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.client_form_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_form_view(text) TO authenticated;

-- save(임시 저장) / submit(보내기 → 새 제출본)
CREATE OR REPLACE FUNCTION public.client_form_respond(p_id uuid, p_action text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r client_form_requests%ROWTYPE;
  v_answers jsonb;
  v_sig text;
  v_files text[];
  v_ver integer;
  f jsonb;
BEGIN
  SELECT * INTO r FROM client_form_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.client_owns_case_key(r.case_key) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF r.status IN ('accepted', 'cancelled') THEN RAISE EXCEPTION 'request closed' USING ERRCODE = '22023'; END IF;
  IF p_action NOT IN ('save', 'submit') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;

  -- 질문에 있는 칸만 받는다
  SELECT coalesce(jsonb_object_agg(k, left(v, 2000)), '{}'::jsonb) INTO v_answers
  FROM jsonb_each_text(CASE WHEN jsonb_typeof(p -> 'answers') = 'object' THEN p -> 'answers' ELSE '{}'::jsonb END) AS a(k, v)
  WHERE k IN (SELECT x ->> 'id' FROM jsonb_array_elements(r.fields) x);
  IF public.client_form_has_rrn(v_answers) THEN
    RAISE EXCEPTION 'resident registration numbers must not be entered' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'save' THEN
    UPDATE client_form_requests SET draft_answers = v_answers,
           status = CASE WHEN status IN ('requested', 'needs_fix') THEN 'in_progress' ELSE status END, updated_at = now()
     WHERE id = p_id RETURNING * INTO r;
    RETURN jsonb_build_object('status', r.status);
  END IF;

  -- 보내기: 필수 칸·서명 확인
  FOR f IN SELECT * FROM jsonb_array_elements(r.fields) LOOP
    IF coalesce((f ->> 'required')::boolean, false) AND coalesce(btrim(v_answers ->> (f ->> 'id')), '') = '' THEN
      RAISE EXCEPTION 'required field missing: %', f ->> 'id' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  -- 서명·첨부는 이 사건 서류함에 의뢰인이 올린 파일만
  SELECT cf.id INTO v_sig FROM case_files cf
   WHERE cf.id = nullif(p ->> 'signature_file_id', '') AND cf.client_key = r.case_key AND cf.upload_source = 'client' AND cf.deleted_at IS NULL;
  IF r.needs_signature AND v_sig IS NULL THEN RAISE EXCEPTION 'signature required' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(array_agg(cf.id), '{}') INTO v_files FROM case_files cf
   WHERE cf.id IN (SELECT jsonb_array_elements_text(coalesce(p -> 'file_ids', '[]'::jsonb)))
     AND cf.client_key = r.case_key AND cf.upload_source = 'client' AND cf.deleted_at IS NULL;
  IF r.third_party_signer IS NOT NULL AND cardinality(v_files) = 0 THEN
    RAISE EXCEPTION 'signed copy photo required' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM client_form_submissions WHERE request_id = p_id;
  INSERT INTO client_form_submissions (request_id, version, answers, signature_file_id, file_ids)
  VALUES (p_id, v_ver, v_answers, v_sig, v_files);
  UPDATE client_form_requests SET status = 'submitted', draft_answers = v_answers, fix_reason = NULL, updated_at = now()
   WHERE id = p_id RETURNING * INTO r;
  PERFORM public.notify_office_members(r.office_id, 'documents.manage', public.crm_client_case_id(r.office_id, r.case_key),
    'form_client_reply', '의뢰인이 서류를 작성해 보냈어요', r.title, 'case_forms', r.case_key, 'form_reply:' || r.id);
  RETURN jsonb_build_object('status', r.status, 'version', v_ver);
END;
$$;
REVOKE ALL ON FUNCTION public.client_form_respond(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_form_respond(uuid, text, jsonb) TO authenticated;

-- 사건 파기(CM-9) 때 함께 지운다
CREATE OR REPLACE FUNCTION public.client_forms_purge_with_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM client_form_requests WHERE office_id = NEW.office_id AND case_key = public.case_workspace_key(NEW);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cases_purge_client_forms ON public.cases;
CREATE TRIGGER cases_purge_client_forms AFTER UPDATE OF purged_at ON public.cases
  FOR EACH ROW WHEN (OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL)
  EXECUTE FUNCTION public.client_forms_purge_with_case();
