-- ============================================================
-- FE-11 수납 내보내기 (사건 요약·입금 기록 CSV, 내보낸 사람·시각·건수 기록)
-- FE-Q6 현금영수증: 발행 기능 없이 대상 안내 + 발급 여부·승인번호 기록만
--   (A-4: 수임료 영수증·현금영수증 발행은 사무소가 직접)
-- ============================================================

ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS cash_receipt_status text
    CHECK (cash_receipt_status IS NULL OR cash_receipt_status IN ('issued', 'self_issued', 'tax_invoice', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS cash_receipt_no text
    CHECK (cash_receipt_no IS NULL OR (char_length(cash_receipt_no) BETWEEN 4 AND 40 AND cash_receipt_no ~ '^[0-9A-Za-z-]+$')),
  ADD COLUMN IF NOT EXISTS cash_receipt_at timestamptz,
  ADD COLUMN IF NOT EXISTS cash_receipt_by uuid;

-- 현금영수증 발급 기록 (금액·날짜는 그대로, 취소된 기록은 못 고침 — fee_payments_guard)
CREATE OR REPLACE FUNCTION public.set_fee_payment_cash_receipt(p_payment_id uuid, p_status text, p_receipt_no text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.fee_payments%ROWTYPE;
  v_no text := nullif(btrim(coalesce(p_receipt_no, '')), '');
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
  IF p_status IS NOT NULL AND p_status NOT IN ('issued', 'self_issued', 'tax_invoice', 'not_applicable') THEN
    RAISE EXCEPTION 'invalid receipt status' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_status IN ('issued', 'self_issued') AND v_no IS NULL THEN
    RAISE EXCEPTION 'receipt number required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_status IS NULL OR p_status IN ('tax_invoice', 'not_applicable') THEN
    v_no := CASE WHEN p_status = 'tax_invoice' THEN v_no ELSE NULL END;
  END IF;
  IF v_no IS NOT NULL AND (char_length(v_no) NOT BETWEEN 4 AND 40 OR v_no !~ '^[0-9A-Za-z-]+$') THEN
    RAISE EXCEPTION 'invalid receipt number' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.fee_payments
  SET cash_receipt_status = p_status,
      cash_receipt_no = v_no,
      cash_receipt_at = CASE WHEN p_status IS NULL THEN NULL ELSE now() END,
      cash_receipt_by = CASE WHEN p_status IS NULL THEN NULL ELSE auth.uid() END
  WHERE id = p_payment_id;

  -- 승인번호는 활동 기록에 남기지 않음 (끝 4자리만)
  PERFORM public.office_log(v.office_id, 'fee_cash_receipt', 'case', v.case_id::text,
    jsonb_build_object('payment_id', p_payment_id, 'status', p_status, 'no_last4', right(v_no, 4)));
  RETURN jsonb_build_object('payment_id', p_payment_id, 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.set_fee_payment_cash_receipt(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fee_payment_cash_receipt(uuid, text, text) TO authenticated;

-- 사건 요약 CSV는 화면(fee_office_overview 결과)에서 만들고, 내려받기 전에 여기로 기록
CREATE OR REPLACE FUNCTION public.log_fee_export(p_office_id text, p_kind text, p_count integer, p_masked boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'fee.export') THEN
    RAISE EXCEPTION 'permission denied: fee.export' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_kind NOT IN ('summary') THEN
    RAISE EXCEPTION 'invalid export kind' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_count IS NULL OR p_count < 0 OR p_count > 100000 THEN
    RAISE EXCEPTION 'invalid count' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM public.office_log(p_office_id, 'fee_export', 'office', p_office_id,
    jsonb_build_object('kind', p_kind, 'count', p_count, 'masked', coalesce(p_masked, false)));
  RETURN jsonb_build_object('logged', true);
END;
$$;
REVOKE ALL ON FUNCTION public.log_fee_export(text, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_fee_export(text, text, integer, boolean) TO authenticated;

-- 입금 기록 CSV (세무 전달용): 기간 안 납부 기록, 내 수납 보기 범위 사건만, 최대 20,000줄, 내보낸 기록 남김
CREATE OR REPLACE FUNCTION public.fee_office_payments_export(p_office_id text, p_from date, p_to date, p_masked boolean DEFAULT false)
RETURNS TABLE (
  payment_id uuid, case_id uuid, client_display_name text, paid_on date, amount_won integer, method text,
  source text, payer_name text, voided boolean, cash_receipt_status text, cash_receipt_no text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'fee.export') THEN
    RAISE EXCEPTION 'permission denied: fee.export' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 400 THEN
    RAISE EXCEPTION 'invalid period' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT p.id, p.case_id, oc.display_name, p.paid_on, p.amount_won, p.method, p.source, p.payer_name,
         (p.voided_at IS NOT NULL), p.cash_receipt_status, p.cash_receipt_no
  FROM public.fee_payments p
  JOIN public.cases cs ON cs.id = p.case_id
  LEFT JOIN public.office_clients oc ON oc.id = cs.office_client_id
  WHERE p.office_id = p_office_id
    AND p.paid_on BETWEEN p_from AND p_to
    AND cs.purged_at IS NULL
    AND public.has_office_permission(p_office_id, 'fee.view', p.case_id)
  ORDER BY p.paid_on, p.recorded_at
  LIMIT 20000;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.office_log(p_office_id, 'fee_export', 'office', p_office_id,
    jsonb_build_object('kind', 'payments', 'count', v_n, 'from', p_from, 'to', p_to, 'masked', coalesce(p_masked, false)));
END;
$$;
REVOKE ALL ON FUNCTION public.fee_office_payments_export(text, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fee_office_payments_export(text, date, date, boolean) TO authenticated;
