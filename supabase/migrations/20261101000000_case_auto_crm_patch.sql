-- ════════════════════════════════════════════════════════════════════════════
-- 1) CM-1 계약 체결 → 사건 자동 생성 (이전: 사무소가 사건 화면을 열 때만 만들어졌다)
-- 2) CM-10 사건 관리 데이터 부분 저장 (이전: crm_clients 행 전체 upsert → 두 사람이 고치면 한쪽 변경이 사라짐)
--    + 실시간 반영 (Realtime 발행에 crm_clients 추가, RLS 그대로)
-- 3) HM-6 중요 공지 → 사무소 구성원 종 알림
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. 계약 → 사건 ─────────────────────────────────────────────────────────
-- 계약을 맡은 변호사의 사무소에 그 상담 요청의 사건이 없으면 만들고, 있으면 '계약을 맺었어요' 단계로 올린다.
-- 호출하는 사람의 권한과 무관한 서버 작업이라(원격 서명은 서비스 키로 체결) 내부 함수로만 둔다.
CREATE OR REPLACE FUNCTION public.ensure_case_for_contract(p_contract_id text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c electronic_contracts;
  v_case_id uuid;
  v_case cases;
  v_office text;
  v_member uuid;
  v_cr consult_requests;
  v_client uuid;
  v_client_user uuid;
  v_contact_ok boolean;
  v_phone text;
  v_type text;
  v_req text;
BEGIN
  SELECT * INTO c FROM electronic_contracts WHERE id = p_contract_id;
  IF c.id IS NULL OR c.status <> 'completed' THEN RETURN NULL; END IF;
  v_case_id := public.contract_case_id(c);
  IF v_case_id IS NULL THEN
    v_office := public.contract_office_id(c.assigned_lawyer_id);
    IF v_office IS NULL THEN RETURN NULL; END IF;
    -- 마이김변 상담 요청으로 맺은 계약만 자동 생성 ('case-…' 키 계약은 이미 사건이 있다)
    v_req := coalesce(c.consult_request_id, CASE WHEN c.client_id NOT LIKE 'case-%' THEN c.client_id END);
    SELECT * INTO v_cr FROM consult_requests WHERE id = v_req;
    IF v_cr.id IS NULL THEN RETURN NULL; END IF;
    SELECT m.id INTO v_member FROM office_members m
     WHERE m.office_id = v_office AND m.status = 'active' AND m.lawyer_id = c.assigned_lawyer_id
     ORDER BY (m.role = 'owner') DESC LIMIT 1;
    v_contact_ok := coalesce(public.lawyer_can_see_contact(v_cr, c.assigned_lawyer_id), false);
    v_phone := CASE WHEN v_contact_ok THEN public.normalize_phone(v_cr.phone) END;
    IF v_cr.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_client_user := v_cr.client_id::uuid;
    END IF;
    v_type := CASE WHEN coalesce(c.case_category, '') ~* '(파산|bankrupt)' THEN 'bankruptcy' ELSE 'rehab' END;
    INSERT INTO office_clients (office_id, display_name, real_name, phone, phone_hash, client_user_id, source, is_test)
    VALUES (v_office, left(coalesce(nullif(btrim(v_cr.client_name), ''), '의뢰인'), 50), NULL, v_phone,
            public.office_phone_hash(v_office, v_phone), v_client_user, 'consult_request', false)
    RETURNING id INTO v_client;
    INSERT INTO cases (office_id, office_client_id, case_type, stage, source, consult_request_id, lawyer_member_id, title)
    VALUES (v_office, v_client, v_type, 'consult', 'consult_request', v_cr.id, v_member, '')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_case_id;
    IF v_case_id IS NULL THEN
      -- 동시에 다른 경로가 먼저 만들었다
      DELETE FROM office_clients WHERE id = v_client AND NOT EXISTS (SELECT 1 FROM cases WHERE office_client_id = v_client);
      SELECT id INTO v_case_id FROM cases WHERE office_id = v_office AND consult_request_id = v_cr.id AND deleted_at IS NULL;
      IF v_case_id IS NULL THEN RETURN NULL; END IF;
    ELSE
      SELECT * INTO v_case FROM cases WHERE id = v_case_id;
      PERFORM public.case_add_event(v_case, 'case.created', '계약 체결로 사건을 만들었어요',
        jsonb_build_object('source', 'contract', 'contract_id', c.id), false);
    END IF;
  END IF;
  UPDATE electronic_contracts SET case_id = v_case_id WHERE id = c.id AND case_id IS DISTINCT FROM v_case_id;
  -- 계약 이전 단계면 '계약을 맺었어요'(서류 준비)로 올린다. 이미 뒤 단계면 그대로
  SELECT * INTO v_case FROM cases WHERE id = v_case_id FOR UPDATE;
  IF v_case.id IS NOT NULL AND v_case.stage <> 'closed'
     AND public.case_stage_order(v_case.case_type, v_case.stage) < public.case_stage_order(v_case.case_type, 'documents') THEN
    UPDATE cases SET stage = 'documents', version = version + 1, updated_at = now() WHERE id = v_case_id
    RETURNING * INTO v_case;
    PERFORM public.case_add_event(v_case, 'milestone.contract_signed', '계약을 맺었어요',
      jsonb_build_object('stage', 'documents', 'contract_id', c.id, 'auto', true), true);
  END IF;
  RETURN v_case_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_case_for_contract(text) FROM PUBLIC, anon, authenticated;

-- 체결 트리거: 사건 → 약정 순서 (실패해도 계약 저장은 진행)
CREATE OR REPLACE FUNCTION public.trg_contract_completed_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      PERFORM public.ensure_case_for_contract(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ensure_case_for_contract failed for %: %', NEW.id, SQLERRM;
    END;
    BEGIN
      PERFORM public.apply_contract_fee_agreement(NEW.id, true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'apply_contract_fee_agreement failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

-- ── 2. 사건 관리 데이터 부분 저장 ──────────────────────────────────────────
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- id가 있는 객체 배열에 바뀐 항목만 반영: 지울 id 빼기 → 같은 id 바꾸기 → 새 항목 뒤에 붙이기
CREATE OR REPLACE FUNCTION public.jsonb_list_apply(p_current jsonb, p_upserts jsonb, p_removes jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cur jsonb := CASE WHEN jsonb_typeof(p_current) = 'array' THEN p_current ELSE '[]'::jsonb END;
  ups jsonb := CASE WHEN jsonb_typeof(p_upserts) = 'array' THEN p_upserts ELSE '[]'::jsonb END;
  rem jsonb := CASE WHEN jsonb_typeof(p_removes) = 'array' THEN p_removes ELSE '[]'::jsonb END;
  out jsonb := '[]'::jsonb;
  e jsonb;
  u jsonb;
  seen text[] := ARRAY[]::text[];
BEGIN
  FOR e IN SELECT value FROM jsonb_array_elements(cur) LOOP
    IF (e ? 'id') AND rem ? (e ->> 'id') THEN CONTINUE; END IF;
    u := NULL;
    IF e ? 'id' THEN
      SELECT value INTO u FROM jsonb_array_elements(ups) WHERE value ->> 'id' = e ->> 'id' LIMIT 1;
    END IF;
    IF u IS NOT NULL THEN
      out := out || jsonb_build_array(u);
      seen := seen || (e ->> 'id');
    ELSE
      out := out || jsonb_build_array(e);
    END IF;
  END LOOP;
  FOR u IN SELECT value FROM jsonb_array_elements(ups) LOOP
    IF (u ->> 'id') IS NULL OR NOT ((u ->> 'id') = ANY (seen)) THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(out) x WHERE x.value ->> 'id' = u ->> 'id') THEN
        out := out || jsonb_build_array(u);
      END IF;
    END IF;
  END LOOP;
  RETURN out;
END;
$$;

-- 앱 키(camelCase) → 칸. 표에 없는 키는 extension_data에 둔다
CREATE OR REPLACE FUNCTION public.crm_column_of(p_key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_key
    WHEN 'crmStatus' THEN 'crm_status' WHEN 'assigneeId' THEN 'assignee_id'
    WHEN 'assignedLawyerId' THEN 'assigned_lawyer_id' WHEN 'assignedConsultantId' THEN 'assigned_consultant_id'
    WHEN 'assignedStaffId' THEN 'assigned_staff_id' WHEN 'documents' THEN 'documents'
    WHEN 'notes' THEN 'notes' WHEN 'activities' THEN 'activities'
    WHEN 'contractDate' THEN 'contract_date' WHEN 'contractAmount' THEN 'contract_amount'
    WHEN 'lastActivityAt' THEN 'last_activity_at' WHEN 'intakeChannel' THEN 'intake_channel'
    WHEN 'intakeChannelDetail' THEN 'intake_channel_detail' WHEN 'isExternalClient' THEN 'is_external_client'
    WHEN 'totalFee' THEN 'total_fee' WHEN 'totalPaid' THEN 'total_paid'
    WHEN 'feeSchedule' THEN 'fee_schedule' WHEN 'deletedAt' THEN 'deleted_at'
    ELSE NULL END
$$;

-- p_set: 통째로 바꿀 키 {key: value} / p_lists: 배열 키 {key: {upsert: [...], remove: [id...]}} / p_unset: 지울 키
-- 권한은 crm_clients RLS 그대로 (SECURITY INVOKER) — 사무소 case.edit
CREATE OR REPLACE FUNCTION public.crm_client_patch(
  p_client_id text, p_office_id text, p_set jsonb DEFAULT '{}'::jsonb,
  p_lists jsonb DEFAULT '{}'::jsonb, p_unset text[] DEFAULT ARRAY[]::text[]
) RETURNS public.crm_clients
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r crm_clients;
  j jsonb;
  ext jsonb;
  k text;
  v jsonb;
  col text;
  lst jsonb;
BEGIN
  IF coalesce(btrim(p_client_id), '') = '' THEN RAISE EXCEPTION 'client id required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM crm_clients WHERE client_id = p_client_id FOR UPDATE;
  IF r.client_id IS NULL THEN
    INSERT INTO crm_clients (client_id, office_id, crm_status, extension_data, documents, notes, activities, fee_schedule, updated_at)
    VALUES (p_client_id, nullif(p_office_id, ''), coalesce(p_set ->> 'crmStatus', 'requested'), '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now())
    RETURNING * INTO r;
  END IF;
  j := to_jsonb(r);
  ext := coalesce(r.extension_data, '{}'::jsonb);
  FOR k, v IN SELECT key, value FROM jsonb_each(coalesce(p_set, '{}'::jsonb)) LOOP
    col := public.crm_column_of(k);
    IF col IS NULL THEN ext := ext || jsonb_build_object(k, v);
    ELSE j := j || jsonb_build_object(col, v);
    END IF;
  END LOOP;
  FOR k, lst IN SELECT key, value FROM jsonb_each(coalesce(p_lists, '{}'::jsonb)) LOOP
    col := public.crm_column_of(k);
    IF col IS NULL THEN
      ext := ext || jsonb_build_object(k, public.jsonb_list_apply(ext -> k, lst -> 'upsert', lst -> 'remove'));
    ELSE
      j := j || jsonb_build_object(col, public.jsonb_list_apply(j -> col, lst -> 'upsert', lst -> 'remove'));
    END IF;
  END LOOP;
  FOREACH k IN ARRAY coalesce(p_unset, ARRAY[]::text[]) LOOP
    col := public.crm_column_of(k);
    IF col IS NULL THEN ext := ext - k; ELSE j := j || jsonb_build_object(col, NULL); END IF;
  END LOOP;
  UPDATE crm_clients SET
    crm_status = coalesce(j ->> 'crm_status', crm_status),
    assignee_id = j ->> 'assignee_id',
    assigned_lawyer_id = j ->> 'assigned_lawyer_id',
    assigned_consultant_id = j ->> 'assigned_consultant_id',
    assigned_staff_id = j ->> 'assigned_staff_id',
    documents = coalesce(j -> 'documents', '[]'::jsonb),
    notes = coalesce(j -> 'notes', '[]'::jsonb),
    activities = coalesce(j -> 'activities', '[]'::jsonb),
    contract_date = (j ->> 'contract_date'),
    contract_amount = (j ->> 'contract_amount')::numeric,
    last_activity_at = coalesce((j ->> 'last_activity_at')::timestamptz, now()),
    intake_channel = coalesce(j ->> 'intake_channel', 'mykim'),
    intake_channel_detail = j ->> 'intake_channel_detail',
    is_external_client = coalesce((j ->> 'is_external_client')::boolean, false),
    total_fee = (j ->> 'total_fee')::numeric,
    total_paid = (j ->> 'total_paid')::numeric,
    fee_schedule = coalesce(j -> 'fee_schedule', '[]'::jsonb),
    deleted_at = (j ->> 'deleted_at')::timestamptz,
    extension_data = ext,
    version = version + 1,
    updated_at = now()
  WHERE client_id = p_client_id
  RETURNING * INTO r;
  IF r.client_id IS NULL THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_client_patch(text, text, jsonb, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_client_patch(text, text, jsonb, jsonb, text[]) TO authenticated;

-- 실시간 반영 (RLS가 적용되므로 같은 사무소의 볼 수 있는 사람만 받는다)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_clients') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_clients';
  END IF;
END $$;

-- ── 3. 중요 공지 → 사무소 구성원 종 알림 ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notice_office_bell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  IF NEW.status = 'published' AND coalesce((NEW.data ->> 'isImportant')::boolean, false)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published'
          OR coalesce((OLD.data ->> 'isImportant')::boolean, false) = false) THEN
    FOR m IN SELECT DISTINCT om.user_id, om.office_id FROM office_members om
              JOIN offices o ON o.id = om.office_id AND o.status = 'active'
             WHERE om.status = 'active' AND om.user_id IS NOT NULL LOOP
      BEGIN
        PERFORM public.notify_user(m.user_id, 'office', m.office_id, 'platform_notice',
          left('마이김변 공지: ' || coalesce(NEW.data ->> 'title', ''), 120), '중요 공지가 올라왔어요. 오늘의 업무에서 확인해 주세요.',
          'notice', NEW.id, 'notice:' || NEW.id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notice bell failed: %', SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notice_office_bell ON public.notices;
CREATE TRIGGER trg_notice_office_bell AFTER INSERT OR UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.trg_notice_office_bell();
