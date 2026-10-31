-- ============================================================
-- 전자계약 서버 저장 복구 + 고객 계약 조회 + 계약 → 수임료 약정 자동 (MY-10·FE-3)
-- 발견(10-31): 앱이 보내는 칸 7개(vat_included·fee_account·court_cost_account·same_as_fee_account·success_fee·
--   case_category·linked_diagnosis_id)가 표에 없어, 계약서 저장(upsert)이 늘 실패했다(운영 계약 0건).
--   체결 방식(contract_method)·서면 계약 정보도 칸이 없어 저장되지 않았다.
-- 바꾼 것:
--  1. 빠진 칸 추가 + extra(jsonb: 체결 방식·서면 계약 정보 등, 주민번호는 받지 않음) + case_id
--  2. 의뢰인 읽기: 계약의 client_id / client_ref_id / consult_request_id 중 하나가 내 계정이거나 내 상담 요청·내 사건
--     (이전: client_id = auth.uid()만. 변호사가 만든 계약은 client_id가 상담 요청 ID라 의뢰인이 못 읽었다)
--  3. 의뢰인 쓰기 금지: 의뢰인 UPDATE·INSERT 정책 삭제. 서명·본인인증은 /api/contract(서명 토큰 확인),
--     제안서로 계약 시작은 client_create_contract_from_proposal(제안서 금액·변호사를 서버가 채움)
--  4. 계약 체결(completed) → 사건에 수임료 약정 자동 생성(계약 일정 합계 = 총 수임료일 때만, 이미 약정이 있으면 안 바꿈)
--     맞지 않으면 사무소에 '약정 확인' 알림. 사건이 나중에 생겨도 같은 규칙으로 만든다
-- ============================================================

-- ── 1. 칸 ───────────────────────────────────────────────────────────────────
ALTER TABLE public.electronic_contracts
  ADD COLUMN IF NOT EXISTS vat_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_account jsonb,
  ADD COLUMN IF NOT EXISTS court_cost_account jsonb,
  ADD COLUMN IF NOT EXISTS same_as_fee_account boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS success_fee jsonb,
  ADD COLUMN IF NOT EXISTS case_category text NOT NULL DEFAULT 'individual_rehab',
  ADD COLUMN IF NOT EXISTS linked_diagnosis_id text,
  ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;
-- 법원 비용은 앱이 객체(송달료·인지대·부채증명 대행비 …)로 보내는데 칸이 numeric이라 저장이 실패했다
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'electronic_contracts' AND column_name = 'court_costs') <> 'jsonb' THEN
    ALTER TABLE public.electronic_contracts ALTER COLUMN court_costs DROP DEFAULT;
    ALTER TABLE public.electronic_contracts ALTER COLUMN court_costs TYPE jsonb
      USING CASE WHEN court_costs IS NULL THEN NULL ELSE jsonb_build_object('total', court_costs) END;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS electronic_contracts_consult_request_idx ON public.electronic_contracts (consult_request_id);
CREATE INDEX IF NOT EXISTS electronic_contracts_client_idx ON public.electronic_contracts (client_id);
CREATE INDEX IF NOT EXISTS electronic_contracts_case_idx ON public.electronic_contracts (case_id);

-- 주민번호는 계약 표 어디에도 저장하지 않는다 (L8)
CREATE OR REPLACE FUNCTION public.electronic_contracts_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.extra ? 'clientResidentNumber' THEN
    NEW.extra := NEW.extra - 'clientResidentNumber';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS electronic_contracts_guard ON public.electronic_contracts;
CREATE TRIGGER electronic_contracts_guard BEFORE INSERT OR UPDATE ON public.electronic_contracts
  FOR EACH ROW EXECUTE FUNCTION public.electronic_contracts_guard();

-- ── 2. 의뢰인 읽기 ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.client_owns_contract(p_client_id text, p_client_ref_id text, p_consult_request_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_client_id = auth.uid()::text
    OR p_client_ref_id = auth.uid()::text
    OR (p_client_id IS NOT NULL AND public.client_owns_case_key(p_client_id))
    OR (p_client_ref_id IS NOT NULL AND public.client_owns_case_key(p_client_ref_id))
    OR (p_consult_request_id IS NOT NULL AND public.client_owns_case_key(p_consult_request_id))
  );
$$;
REVOKE ALL ON FUNCTION public.client_owns_contract(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_owns_contract(text, text, text) TO authenticated;

-- 예전 members 표 기준 정책(행 0건, 의미 없음)과 의뢰인 쓰기 정책 정리
DROP POLICY IF EXISTS anti_bola_select_electronic_contracts ON public.electronic_contracts;
DROP POLICY IF EXISTS anti_bola_insert_electronic_contracts ON public.electronic_contracts;
DROP POLICY IF EXISTS anti_bola_delete_electronic_contracts ON public.electronic_contracts;
DROP POLICY IF EXISTS contracts_client_update ON public.electronic_contracts;
DROP POLICY IF EXISTS contracts_client_select ON public.electronic_contracts;
CREATE POLICY contracts_client_select ON public.electronic_contracts FOR SELECT TO authenticated
  USING (public.client_owns_contract(client_id, client_ref_id, consult_request_id));

-- ── 3. 계약을 맡은 사무소 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_office_id(p_lawyer_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.office_id FROM office_members m JOIN offices o ON o.id = m.office_id AND o.status = 'active'
  WHERE m.lawyer_id = p_lawyer_id AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC, m.created_at LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.contract_office_id(text) FROM PUBLIC, anon, authenticated;

-- 계약 → 사건 (상담 요청 ID 또는 'case-…' 키, 같은 사무소)
CREATE OR REPLACE FUNCTION public.contract_case_id(c public.electronic_contracts)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text := public.contract_office_id(c.assigned_lawyer_id);
  k text;
  v uuid;
BEGIN
  IF c.case_id IS NOT NULL THEN RETURN c.case_id; END IF;
  IF v_office IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY[c.consult_request_id, c.client_id, c.client_ref_id] LOOP
    CONTINUE WHEN k IS NULL OR k = '';
    IF k ~ '^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v FROM cases WHERE id = substr(k, 6)::uuid AND office_id = v_office AND deleted_at IS NULL;
    ELSE
      SELECT id INTO v FROM cases WHERE consult_request_id = k AND office_id = v_office AND deleted_at IS NULL;
    END IF;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.contract_case_id(public.electronic_contracts) FROM PUBLIC, anon, authenticated;

-- ── 4. 계약 → 수임료 약정 ──────────────────────────────────────────────────────
-- 금액 단위: 계약 총액·회차는 만원 숫자(10,000 미만)와 원 숫자가 섞여 있다 (utils/feeUnits.ts와 같은 규칙)
CREATE OR REPLACE FUNCTION public.contract_fee_won(p_value numeric)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_value IS NULL OR p_value <= 0 THEN 0
              WHEN p_value < 10000 THEN round(p_value * 10000)::integer
              ELSE round(p_value)::integer END;
$$;

CREATE OR REPLACE FUNCTION public.contract_installment_won(e jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN nullif(e ->> 'amount', '') IS NULL THEN 0
    WHEN e ->> 'amountUnit' = 'won' THEN round((e ->> 'amount')::numeric)::integer
    WHEN e ->> 'amountUnit' = 'manwon' THEN round((e ->> 'amount')::numeric * 10000)::integer
    ELSE public.contract_fee_won((e ->> 'amount')::numeric) END;
$$;

-- 결과: created / exists / no_case / no_schedule / mismatch / bad_date / not_completed
CREATE OR REPLACE FUNCTION public.apply_contract_fee_agreement(p_contract_id text, p_notify boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.electronic_contracts;
  v_case uuid;
  v_office text;
  v_total integer;
  v_sum bigint := 0;
  v_items jsonb := '[]'::jsonb;
  e jsonb;
  v_amount integer;
  v_due date;
  v_label text;
  v_agreement uuid;
  v_n integer := 0;
  v_reason text;
  v_existing public.fee_agreements;
BEGIN
  SELECT * INTO c FROM electronic_contracts WHERE id = p_contract_id;
  IF c.id IS NULL OR c.status <> 'completed' THEN RETURN 'not_completed'; END IF;
  v_case := public.contract_case_id(c);
  IF v_case IS NULL THEN RETURN 'no_case'; END IF;
  SELECT office_id INTO v_office FROM cases WHERE id = v_case;
  IF c.case_id IS DISTINCT FROM v_case THEN
    UPDATE electronic_contracts SET case_id = v_case WHERE id = c.id;
  END IF;

  SELECT * INTO v_existing FROM fee_agreements WHERE case_id = v_case AND is_current;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.contract_id IS DISTINCT FROM c.id AND p_notify THEN
      PERFORM public.notify_office_members(v_office, 'fee.record', v_case, 'fee_contract_check',
        '계약과 수임료 약정을 맞춰 보세요', '체결된 계약이 있는데 이미 다른 수임료 약정이 있어요. 금액과 일정을 확인해 주세요.',
        'case_fees', coalesce(c.consult_request_id, c.client_id), 'fee_contract_check:' || v_case);
    END IF;
    RETURN 'exists';
  END IF;

  v_total := public.contract_fee_won(c.total_fee);
  FOR e IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.fee_schedule) = 'array' THEN c.fee_schedule ELSE '[]'::jsonb END) LOOP
    CONTINUE WHEN coalesce(e ->> 'itemType', '') = 'success_fee'; -- 성공보수는 조건부라 일정에 넣지 않는다
    v_amount := public.contract_installment_won(e);
    CONTINUE WHEN v_amount <= 0;
    BEGIN
      v_due := (e ->> 'dueDate')::date;
    EXCEPTION WHEN OTHERS THEN
      v_due := NULL;
    END;
    IF v_due IS NULL THEN v_reason := 'bad_date'; EXIT; END IF;
    v_label := left(coalesce(nullif(btrim(e ->> 'itemTitle'), ''), nullif(btrim(e ->> 'memo'), ''),
                             CASE WHEN (e ->> 'round') = '0' THEN '착수금' ELSE coalesce(e ->> 'round', '') || '회차' END), 40);
    v_items := v_items || jsonb_build_object('label', v_label, 'due_on', v_due, 'amount_won', v_amount);
    v_sum := v_sum + v_amount;
  END LOOP;

  IF v_reason IS NULL THEN
    IF jsonb_array_length(v_items) = 0 OR v_total <= 0 THEN v_reason := 'no_schedule';
    ELSIF v_sum <> v_total THEN v_reason := 'mismatch';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    IF p_notify THEN
      PERFORM public.notify_office_members(v_office, 'fee.record', v_case, 'fee_contract_check',
        '수임료 약정을 만들어 주세요',
        CASE v_reason WHEN 'mismatch' THEN '계약서 회차 합계가 총 수임료와 달라 자동으로 옮기지 못했어요.'
                      WHEN 'bad_date' THEN '계약서 회차에 날짜가 없는 줄이 있어 자동으로 옮기지 못했어요.'
                      ELSE '계약서에 회차 일정이 없어 자동으로 옮기지 못했어요.' END,
        'case_fees', coalesce(c.consult_request_id, c.client_id), 'fee_contract_check:' || v_case);
    END IF;
    RETURN v_reason;
  END IF;

  INSERT INTO fee_agreements (office_id, case_id, version, total_fee_won, source, contract_id, memo, created_by)
  VALUES (v_office, v_case, 1, v_total, 'contract', c.id, '계약서 ' || c.id || ' 체결로 자동 생성', NULL)
  RETURNING id INTO v_agreement;
  FOR e IN SELECT * FROM jsonb_array_elements(v_items) ORDER BY (value ->> 'due_on') LOOP
    v_n := v_n + 1;
    INSERT INTO fee_installments (agreement_id, office_id, case_id, seq, label, due_on, amount_won)
    VALUES (v_agreement, v_office, v_case, v_n, e ->> 'label', (e ->> 'due_on')::date, (e ->> 'amount_won')::integer);
  END LOOP;
  INSERT INTO office_audit_logs (office_id, actor_user_id, action, target_type, target_id, detail)
  VALUES (v_office, auth.uid(), 'fee_agreement_from_contract', 'case', v_case::text,
          jsonb_build_object('contract', c.id, 'total', v_total, 'installments', v_n));
  RETURN 'created';
END;
$$;
REVOKE ALL ON FUNCTION public.apply_contract_fee_agreement(text, boolean) FROM PUBLIC, anon, authenticated;

-- 체결되면 자동으로 (실패해도 계약 저장은 진행)
CREATE OR REPLACE FUNCTION public.trg_contract_completed_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.apply_contract_fee_agreement(NEW.id, true);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'contract fee agreement failed: %', SQLERRM;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_contract_completed_fee ON public.electronic_contracts;
CREATE TRIGGER trg_contract_completed_fee AFTER INSERT OR UPDATE OF status ON public.electronic_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_contract_completed_fee();

-- 사건이 계약보다 늦게 만들어진 경우
CREATE OR REPLACE FUNCTION public.trg_case_created_contract_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF NEW.consult_request_id IS NOT NULL THEN
    SELECT ec.id INTO v FROM electronic_contracts ec
    WHERE ec.status = 'completed' AND public.contract_office_id(ec.assigned_lawyer_id) = NEW.office_id
      AND (ec.consult_request_id = NEW.consult_request_id OR ec.client_id = NEW.consult_request_id OR ec.client_ref_id = NEW.consult_request_id)
    ORDER BY ec.updated_at DESC LIMIT 1;
    IF v IS NOT NULL THEN
      UPDATE electronic_contracts SET case_id = NEW.id WHERE id = v AND case_id IS NULL;
      PERFORM public.apply_contract_fee_agreement(v, true);
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'case contract fee failed: %', SQLERRM;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_case_created_contract_fee ON public.cases;
CREATE TRIGGER trg_case_created_contract_fee AFTER INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_created_contract_fee();

-- 사무소가 직접 다시 옮기기 (사건 화면 '계약서에서 가져오기')
CREATE OR REPLACE FUNCTION public.create_fee_agreement_from_contract(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v text;
  r text;
  cs public.cases;
BEGIN
  SELECT * INTO cs FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF cs.id IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  v_office := cs.office_id;
  IF NOT public.has_office_permission(v_office, 'fee.record', p_case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = '42501';
  END IF;
  SELECT ec.id INTO v FROM electronic_contracts ec
  WHERE ec.status = 'completed' AND public.contract_office_id(ec.assigned_lawyer_id) = v_office
    AND (ec.case_id = p_case_id
         OR (cs.consult_request_id IS NOT NULL AND (ec.consult_request_id = cs.consult_request_id OR ec.client_id = cs.consult_request_id OR ec.client_ref_id = cs.consult_request_id))
         OR ec.client_id = 'case-' || p_case_id::text)
  ORDER BY ec.updated_at DESC LIMIT 1;
  IF v IS NULL THEN RETURN jsonb_build_object('result', 'no_contract'); END IF;
  r := public.apply_contract_fee_agreement(v, false);
  RETURN jsonb_build_object('result', r, 'contract_id', v);
END;
$$;
REVOKE ALL ON FUNCTION public.create_fee_agreement_from_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_fee_agreement_from_contract(uuid) TO authenticated;

-- ── 5. 의뢰인이 제안서로 계약 시작 ─────────────────────────────────────────────
-- 금액·변호사·사무소 이름은 서버가 제안서에서 채운다. 문서 본문은 앱 양식(서명 칸은 비운 채로)
CREATE OR REPLACE FUNCTION public.client_create_contract_from_proposal(
  p_request_id text, p_proposal_id text, p_method text, p_documents jsonb,
  p_display_name text, p_paper_info jsonb, p_audit text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.consult_requests;
  v_prop jsonb;
  v_lawyer text;
  v_existing public.electronic_contracts;
  v_docs jsonb := '[]'::jsonb;
  d jsonb;
  v_id text;
  v_token text;
  v_now timestamptz := now();
  v_row public.electronic_contracts;
  v_office text;
  v_paper jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_method NOT IN ('electronic', 'in_person', 'postal') THEN RAISE EXCEPTION 'invalid method' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM consult_requests WHERE id = p_request_id AND client_id = v_uid::text;
  IF r.id IS NULL THEN RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002'; END IF;
  SELECT x INTO v_prop FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.proposals) = 'array' THEN r.proposals ELSE '[]'::jsonb END) x
  WHERE x ->> 'id' = p_proposal_id LIMIT 1;
  v_lawyer := v_prop ->> 'lawyerId';
  IF v_prop IS NULL OR v_lawyer IS NULL THEN RAISE EXCEPTION 'proposal not found' USING ERRCODE = 'P0002'; END IF;
  v_office := public.contract_office_id(v_lawyer);
  IF v_office IS NULL THEN RAISE EXCEPTION 'lawyer office not found' USING ERRCODE = 'P0002'; END IF;

  v_paper := CASE WHEN p_method = 'electronic' OR jsonb_typeof(p_paper_info) <> 'object' THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'method', p_method,
      'signedDate', '',
      'notes', left(coalesce(p_paper_info ->> 'notes', ''), 500),
      'postalInfo', CASE WHEN jsonb_typeof(p_paper_info -> 'postalInfo') = 'object' THEN jsonb_build_object(
        'recipientAddress', left(coalesce(p_paper_info -> 'postalInfo' ->> 'recipientAddress', ''), 200),
        'recipientDetailAddress', left(coalesce(p_paper_info -> 'postalInfo' ->> 'recipientDetailAddress', ''), 200),
        'postcode', left(coalesce(p_paper_info -> 'postalInfo' ->> 'postcode', ''), 10)) END)) END;

  -- 같은 제안서로 진행 중인 계약이 있으면 이어 쓴다
  SELECT * INTO v_existing FROM electronic_contracts
  WHERE consult_request_id = p_request_id AND source_proposal_id = p_proposal_id
    AND status IN ('drafting', 'pending_sign', 'client_review')
  ORDER BY created_at DESC LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF p_method <> 'electronic' THEN
      UPDATE electronic_contracts SET
        extra = coalesce(extra, '{}'::jsonb) || jsonb_build_object('contractMethod', p_method) || CASE WHEN v_paper IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('paperContractInfo', v_paper) END,
        audit_trail = coalesce(audit_trail, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('action', left(coalesce(p_audit, '의뢰인이 서면 계약을 요청함'), 500), 'timestamp', v_now, 'actor', 'client')),
        updated_at = v_now
      WHERE id = v_existing.id RETURNING * INTO v_existing;
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  IF (SELECT count(*) FROM electronic_contracts WHERE consult_request_id = p_request_id AND created_at > v_now - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'too many contracts' USING ERRCODE = '54000';
  END IF;
  IF jsonb_typeof(p_documents) <> 'array' OR jsonb_array_length(p_documents) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'documents required' USING ERRCODE = '22023';
  END IF;
  FOR d IN SELECT * FROM jsonb_array_elements(p_documents) LOOP
    IF jsonb_typeof(d) <> 'object' OR char_length(coalesce(d ->> 'content', '')) > 60000 THEN
      RAISE EXCEPTION 'invalid document' USING ERRCODE = '22023';
    END IF;
    -- 서명·확인 칸은 비운다 (서명은 /api/contract만)
    v_docs := v_docs || jsonb_build_array(d - 'clientSignature' - 'lawyerSignature' - 'clientSignedAt' - 'lawyerSignedAt'
                                            - 'confirmedAt' - 'clientConfirmationText');
  END LOOP;

  v_id := 'EC-' || extract(year FROM v_now)::int || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_token := 'sgn-' || substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 32);

  INSERT INTO electronic_contracts (id, client_id, client_ref_id, consult_request_id, source_proposal_id, client_name, client_phone,
    lawyer_name, law_firm_name, assigned_lawyer_id, total_fee, court_costs, fee_schedule, status, contract_date, documents,
    audit_trail, remote_sign_token, real_name_conversion_pending, authority_status, case_category, extra, created_at, updated_at)
  VALUES (v_id, v_uid::text, p_request_id, p_request_id, p_proposal_id,
    left(coalesce(nullif(btrim(p_display_name), ''), r.client_name, '의뢰인'), 40), '',
    left(coalesce(v_prop ->> 'lawyerName', ''), 40), left(coalesce(v_prop ->> 'firmName', ''), 80), v_lawyer,
    coalesce(nullif(v_prop ->> 'fee', '')::numeric, 0), '{}'::jsonb, '[]'::jsonb,
    CASE WHEN p_method = 'electronic' THEN 'pending_sign' ELSE 'drafting' END,
    to_char(v_now AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'), v_docs,
    jsonb_build_array(jsonb_build_object('action', left(coalesce(p_audit, '의뢰인이 제안서로 계약을 시작함'), 500), 'timestamp', v_now, 'actor', 'client')),
    v_token, p_method = 'electronic', 'REPRESENTATIVE_VERIFIED', 'individual_rehab',
    jsonb_strip_nulls(jsonb_build_object('contractMethod', p_method, 'paperContractInfo', v_paper)), v_now, v_now)
  RETURNING * INTO v_row;

  PERFORM public.notify_office_members(v_office, 'contract.draft', public.crm_client_case_id(v_office, p_request_id), 'contract_client_start',
    CASE WHEN p_method = 'electronic' THEN '의뢰인이 전자계약을 시작했어요' ELSE '의뢰인이 서면 계약을 요청했어요' END,
    '제안서 조건으로 계약서가 만들어졌어요. 내용을 확인해 주세요.', 'case_contract', p_request_id, 'contract_start:' || v_row.id);
  RETURN to_jsonb(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.client_create_contract_from_proposal(text, text, text, jsonb, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_create_contract_from_proposal(text, text, text, jsonb, text, jsonb, text) TO authenticated;
