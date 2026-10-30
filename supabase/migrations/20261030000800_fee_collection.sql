-- ============================================================
-- FE-1~FE-6 수임료 수납 서버화 (사건 단위)
--  * fee_agreements(버전) · fee_installments(회차) · fee_payments(추가만, 취소는 사유 기록) · fee_schedule_changes
--  * 원본 약정 = 계약서 하나 (FE-Q1): 계약 금액으로 약정을 만들고, 일정 변경은 새 버전 + 변경 기록
--  * 금액은 원 단위 정수, 회차 상태(완납·일부·연체·예정)는 납부 배분으로 서버가 계산 (fee_installment_status)
--  * 의뢰인: 본인 사건의 회차·납부 내역 읽기 + '입금했어요' 알림(확정은 사무소, FE-Q2)
--  * 권한: 보기 fee.view(범위: 전체/담당), 기록 fee.record
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fee_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  total_fee_won integer NOT NULL CHECK (total_fee_won >= 0 AND total_fee_won <= 1000000000),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('contract', 'manual')),
  contract_id text,
  memo text CHECK (memo IS NULL OR char_length(memo) <= 500),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_agreements_current_uq ON public.fee_agreements (case_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS fee_agreements_office_idx ON public.fee_agreements (office_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fee_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.fee_agreements(id) ON DELETE CASCADE,
  office_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  seq integer NOT NULL CHECK (seq BETWEEN 1 AND 120),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  due_on date NOT NULL,
  amount_won integer NOT NULL CHECK (amount_won > 0 AND amount_won <= 1000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, seq)
);
CREATE INDEX IF NOT EXISTS fee_installments_case_idx ON public.fee_installments (case_id, due_on);
CREATE INDEX IF NOT EXISTS fee_installments_office_due_idx ON public.fee_installments (office_id, due_on);

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  paid_on date NOT NULL,
  amount_won integer NOT NULL CHECK (amount_won > 0 AND amount_won <= 1000000000),
  method text NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'cash', 'card', 'other')),
  payer_name text CHECK (payer_name IS NULL OR char_length(payer_name) <= 40),
  memo text CHECK (memo IS NULL OR char_length(memo) <= 300),
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'client_report_confirmed', 'bank_import')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid DEFAULT auth.uid(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text CHECK (void_reason IS NULL OR char_length(void_reason) <= 300)
);
CREATE INDEX IF NOT EXISTS fee_payments_case_idx ON public.fee_payments (case_id, paid_on);

-- 의뢰인 '입금했어요' 알림 (확정 전 기록)
CREATE TABLE IF NOT EXISTS public.fee_client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.fee_installments(id) ON DELETE SET NULL,
  reported_paid_on date NOT NULL,
  amount_won integer NOT NULL CHECK (amount_won > 0 AND amount_won <= 1000000000),
  payer_name text CHECK (payer_name IS NULL OR char_length(payer_name) <= 40),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  payment_id uuid REFERENCES public.fee_payments(id),
  handled_at timestamptz,
  handled_by uuid,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS fee_client_reports_case_idx ON public.fee_client_reports (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fee_schedule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  from_agreement_id uuid REFERENCES public.fee_agreements(id),
  to_agreement_id uuid REFERENCES public.fee_agreements(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid DEFAULT auth.uid()
);

-- 쓰기는 서버 함수로만
ALTER TABLE public.fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedule_changes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_agreements','fee_installments','fee_payments','fee_client_reports','fee_schedule_changes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_office_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_office_permission(office_id, ''fee.view'', case_id))', t || '_office_read', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS fee_installments_client_read ON public.fee_installments;
-- 의뢰인에게는 지금 약정의 회차만 (예전 버전 회차는 사무소 기록용)
CREATE POLICY fee_installments_client_read ON public.fee_installments FOR SELECT TO authenticated
  USING (public.is_case_client(case_id) AND EXISTS (SELECT 1 FROM public.fee_agreements a WHERE a.id = agreement_id AND a.is_current));
DROP POLICY IF EXISTS fee_payments_client_read ON public.fee_payments;
CREATE POLICY fee_payments_client_read ON public.fee_payments FOR SELECT TO authenticated USING (public.is_case_client(case_id) AND voided_at IS NULL);
DROP POLICY IF EXISTS fee_agreements_client_read ON public.fee_agreements;
CREATE POLICY fee_agreements_client_read ON public.fee_agreements FOR SELECT TO authenticated USING (public.is_case_client(case_id) AND is_current);
DROP POLICY IF EXISTS fee_client_reports_client_read ON public.fee_client_reports;
CREATE POLICY fee_client_reports_client_read ON public.fee_client_reports FOR SELECT TO authenticated USING (public.is_case_client(case_id));

-- ── 회차 상태 계산: 유효 납부액을 회차 순서대로 채운다 ───────────────────────
CREATE OR REPLACE FUNCTION public.fee_case_status(p_case_id uuid)
RETURNS TABLE (
  installment_id uuid, seq integer, label text, due_on date, amount_won integer,
  allocated_won integer, remaining_won integer, status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
  v_pool bigint;
  v_today date := public.seoul_today();
  r record;
  v_alloc integer;
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id;
  IF v_office IS NULL THEN
    RETURN;
  END IF;
  IF NOT (public.has_office_permission(v_office, 'fee.view', p_case_id) OR public.is_case_client(p_case_id)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT coalesce(sum(p.amount_won), 0) INTO v_pool FROM public.fee_payments p WHERE p.case_id = p_case_id AND p.voided_at IS NULL;
  FOR r IN
    SELECT i.* FROM public.fee_installments i
    JOIN public.fee_agreements a ON a.id = i.agreement_id AND a.is_current
    WHERE i.case_id = p_case_id
    ORDER BY i.due_on, i.seq
  LOOP
    v_alloc := least(r.amount_won::bigint, v_pool)::integer;
    v_pool := v_pool - v_alloc;
    installment_id := r.id; seq := r.seq; label := r.label; due_on := r.due_on; amount_won := r.amount_won;
    allocated_won := v_alloc;
    remaining_won := r.amount_won - v_alloc;
    status := CASE
      WHEN v_alloc >= r.amount_won THEN 'paid'
      WHEN r.due_on < v_today THEN 'overdue'
      WHEN v_alloc > 0 THEN 'partial'
      ELSE 'scheduled' END;
    RETURN NEXT;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fee_case_status(uuid) TO authenticated;

-- 사무소 수납 현황 (사건별 합계, 목록 화면용)
CREATE OR REPLACE FUNCTION public.fee_office_overview(p_office_id text)
RETURNS TABLE (
  case_id uuid, case_title text, client_display_name text, total_fee_won integer, paid_won bigint,
  remaining_won bigint, overdue_count integer, next_due_on date, next_due_won integer, pending_reports integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  s record;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'fee.view') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOR c IN
    SELECT cs.id, cs.title, oc.display_name, a.total_fee_won
    FROM public.fee_agreements a
    JOIN public.cases cs ON cs.id = a.case_id AND cs.deleted_at IS NULL
    LEFT JOIN public.office_clients oc ON oc.id = cs.office_client_id
    WHERE a.office_id = p_office_id AND a.is_current
      AND public.has_office_permission(p_office_id, 'fee.view', cs.id)
    ORDER BY cs.created_at DESC
  LOOP
    case_id := c.id; case_title := c.title; client_display_name := c.display_name; total_fee_won := c.total_fee_won;
    SELECT coalesce(sum(p.amount_won), 0) INTO paid_won FROM public.fee_payments p WHERE p.case_id = c.id AND p.voided_at IS NULL;
    remaining_won := greatest(0, c.total_fee_won - paid_won);
    overdue_count := 0; next_due_on := NULL; next_due_won := NULL;
    FOR s IN SELECT * FROM public.fee_case_status(c.id) LOOP
      IF s.status = 'overdue' THEN overdue_count := overdue_count + 1; END IF;
      IF next_due_on IS NULL AND s.status <> 'paid' THEN next_due_on := s.due_on; next_due_won := s.remaining_won; END IF;
    END LOOP;
    SELECT count(*)::integer INTO pending_reports FROM public.fee_client_reports r WHERE r.case_id = c.id AND r.status = 'pending';
    RETURN NEXT;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fee_office_overview(text) TO authenticated;

-- ── 약정 만들기·바꾸기 ─────────────────────────────────────────────────────────
-- p_installments: [{"label":"착수금","due_on":"2026-11-01","amount_won":300000}, ...] 합계 = 총 수임료
CREATE OR REPLACE FUNCTION public.set_fee_agreement(
  p_case_id uuid,
  p_total_fee_won integer,
  p_installments jsonb,
  p_source text DEFAULT 'manual',
  p_contract_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_memo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
  v_old public.fee_agreements%ROWTYPE;
  v_new_id uuid;
  v_sum bigint := 0;
  v_n integer := 0;
  e jsonb;
  v_amount integer;
  v_due date;
  v_label text;
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.has_office_permission(v_office, 'fee.record', p_case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_source NOT IN ('contract', 'manual') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_typeof(p_installments) <> 'array' OR jsonb_array_length(p_installments) = 0 OR jsonb_array_length(p_installments) > 120 THEN
    RAISE EXCEPTION 'installments required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
    v_amount := (e ->> 'amount_won')::integer;
    v_due := (e ->> 'due_on')::date;
    IF v_amount IS NULL OR v_amount <= 0 OR v_due IS NULL THEN
      RAISE EXCEPTION 'invalid installment' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_sum := v_sum + v_amount;
  END LOOP;
  IF v_sum <> p_total_fee_won THEN
    RAISE EXCEPTION 'installments total mismatch: % <> %', v_sum, p_total_fee_won USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_old FROM public.fee_agreements WHERE case_id = p_case_id AND is_current FOR UPDATE;
  IF v_old.id IS NOT NULL AND nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_old.id IS NOT NULL THEN
    UPDATE public.fee_agreements SET is_current = false WHERE id = v_old.id;
  END IF;

  INSERT INTO public.fee_agreements (office_id, case_id, version, total_fee_won, source, contract_id, memo)
  VALUES (v_office, p_case_id, coalesce(v_old.version, 0) + 1, p_total_fee_won, p_source, p_contract_id, left(p_memo, 500))
  RETURNING id INTO v_new_id;

  FOR e IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
    v_n := v_n + 1;
    v_label := left(coalesce(nullif(btrim(e ->> 'label'), ''), v_n || '회차'), 40);
    INSERT INTO public.fee_installments (agreement_id, office_id, case_id, seq, label, due_on, amount_won)
    VALUES (v_new_id, v_office, p_case_id, v_n, v_label, (e ->> 'due_on')::date, (e ->> 'amount_won')::integer);
  END LOOP;

  IF v_old.id IS NOT NULL THEN
    INSERT INTO public.fee_schedule_changes (office_id, case_id, from_agreement_id, to_agreement_id, reason)
    VALUES (v_office, p_case_id, v_old.id, v_new_id, left(btrim(p_reason), 300));
  END IF;

  PERFORM public.office_log(v_office, CASE WHEN v_old.id IS NULL THEN 'fee_agreement_create' ELSE 'fee_agreement_change' END,
    'case', p_case_id::text, jsonb_build_object('total', p_total_fee_won, 'installments', v_n, 'version', coalesce(v_old.version, 0) + 1));

  RETURN jsonb_build_object('agreement_id', v_new_id, 'version', coalesce(v_old.version, 0) + 1, 'installments', v_n);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_fee_agreement(uuid, integer, jsonb, text, text, text, text) TO authenticated;

-- ── 납부 기록·취소 ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_case_id uuid, p_paid_on date, p_amount_won integer,
  p_method text DEFAULT 'transfer', p_payer_name text DEFAULT NULL, p_memo text DEFAULT NULL,
  p_client_report_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
  v_id uuid;
  v_rep public.fee_client_reports%ROWTYPE;
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.has_office_permission(v_office, 'fee.record', p_case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_amount_won IS NULL OR p_amount_won <= 0 THEN
    RAISE EXCEPTION 'invalid amount' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_paid_on IS NULL OR p_paid_on > public.seoul_today() + 1 OR p_paid_on < public.seoul_today() - 3650 THEN
    RAISE EXCEPTION 'invalid paid date' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fee_agreements a WHERE a.case_id = p_case_id AND a.is_current) THEN
    RAISE EXCEPTION 'fee agreement required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_client_report_id IS NOT NULL THEN
    SELECT * INTO v_rep FROM public.fee_client_reports WHERE id = p_client_report_id AND case_id = p_case_id FOR UPDATE;
    IF NOT FOUND OR v_rep.status <> 'pending' THEN
      RAISE EXCEPTION 'client report not pending' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.fee_payments (office_id, case_id, paid_on, amount_won, method, payer_name, memo, source)
  VALUES (v_office, p_case_id, p_paid_on, p_amount_won,
    CASE WHEN p_method IN ('transfer', 'cash', 'card', 'other') THEN p_method ELSE 'other' END,
    left(nullif(btrim(coalesce(p_payer_name, '')), ''), 40), left(nullif(btrim(coalesce(p_memo, '')), ''), 300),
    CASE WHEN p_client_report_id IS NULL THEN 'office' ELSE 'client_report_confirmed' END)
  RETURNING id INTO v_id;

  IF p_client_report_id IS NOT NULL THEN
    UPDATE public.fee_client_reports SET status = 'confirmed', payment_id = v_id, handled_at = now(), handled_by = auth.uid()
    WHERE id = p_client_report_id;
  END IF;

  PERFORM public.office_log(v_office, 'fee_payment_record', 'case', p_case_id::text,
    jsonb_build_object('payment_id', v_id, 'amount', p_amount_won, 'paid_on', p_paid_on));
  RETURN jsonb_build_object('payment_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid, date, integer, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.void_fee_payment(p_payment_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.fee_payments%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.fee_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.has_office_permission(v.office_id, 'fee.record', v.case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'payment already voided' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.fee_payments SET voided_at = now(), voided_by = auth.uid(), void_reason = left(btrim(p_reason), 300) WHERE id = p_payment_id;
  PERFORM public.office_log(v.office_id, 'fee_payment_void', 'case', v.case_id::text,
    jsonb_build_object('payment_id', p_payment_id, 'amount', v.amount_won, 'reason', left(btrim(p_reason), 300)));
  RETURN jsonb_build_object('payment_id', p_payment_id, 'voided', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_fee_payment(uuid, text) TO authenticated;

-- 납부 기록은 수정·삭제 불가 (취소는 void_fee_payment)
CREATE OR REPLACE FUNCTION public.fee_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fee payments cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.amount_won IS DISTINCT FROM OLD.amount_won OR NEW.paid_on IS DISTINCT FROM OLD.paid_on
     OR NEW.case_id IS DISTINCT FROM OLD.case_id OR NEW.office_id IS DISTINCT FROM OLD.office_id
     OR (OLD.voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'fee payments are append-only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fee_payments_guard ON public.fee_payments;
CREATE TRIGGER fee_payments_guard BEFORE UPDATE OR DELETE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.fee_payments_guard();

-- ── 의뢰인 '입금했어요' ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.client_report_fee_payment(p_case_id uuid, p_paid_on date, p_amount_won integer, p_payer_name text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
  v_id uuid;
BEGIN
  IF NOT public.is_case_client(p_case_id) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_amount_won IS NULL OR p_amount_won <= 0 OR p_paid_on IS NULL OR p_paid_on > public.seoul_today() + 1 THEN
    RAISE EXCEPTION 'invalid report' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (SELECT count(*) FROM public.fee_client_reports WHERE case_id = p_case_id AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'too many pending reports' USING ERRCODE = 'check_violation';
  END IF;
  SELECT office_id INTO v_office FROM public.cases WHERE id = p_case_id;
  INSERT INTO public.fee_client_reports (office_id, case_id, reported_paid_on, amount_won, payer_name, note)
  VALUES (v_office, p_case_id, p_paid_on, p_amount_won, left(nullif(btrim(coalesce(p_payer_name, '')), ''), 40), left(nullif(btrim(coalesce(p_note, '')), ''), 300))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('report_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.client_report_fee_payment(uuid, date, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_fee_client_report(p_report_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.fee_client_reports%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.fee_client_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.has_office_permission(v.office_id, 'fee.record', v.case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.status <> 'pending' THEN
    RAISE EXCEPTION 'client report not pending' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.fee_client_reports SET status = 'rejected', handled_at = now(), handled_by = auth.uid(), reject_reason = left(btrim(p_reason), 300)
  WHERE id = p_report_id;
  RETURN jsonb_build_object('report_id', p_report_id, 'status', 'rejected');
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_fee_client_report(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.fee_case_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fee_office_overview(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_fee_agreement(uuid, integer, jsonb, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_fee_payment(uuid, date, integer, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_fee_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_report_fee_payment(uuid, date, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_fee_client_report(uuid, text) FROM PUBLIC, anon;
