-- ════════════════════════════════════════════════════════════════════════════
-- FE-9 거래내역 파일 대조 (출시 전 방식, 비용 없음)
--  * 사무소가 인터넷뱅킹에서 내려받은 입금 내역을 브라우저가 읽고(원본은 서버에 올리지 않음),
--    사람이 회차 후보를 확인한 줄만 납부 기록으로 넣는다 (source 'bank_import')
--  * 같은 거래를 두 번 넣지 않게 거래 지문(날짜·금액·입금자·같은 줄 순번의 SHA-256, 브라우저 계산)을 남긴다
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS bank_tx_hash text
  CHECK (bank_tx_hash IS NULL OR bank_tx_hash ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_bank_tx_uniq ON public.fee_payments (office_id, bank_tx_hash)
  WHERE bank_tx_hash IS NOT NULL AND voided_at IS NULL;

CREATE OR REPLACE FUNCTION public.fee_bank_tx_seen(p_office_id text, p_hashes text[])
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.office_permission_scope(p_office_id, 'fee.record') <> 'all' THEN RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT array_agg(DISTINCT p.bank_tx_hash) FROM fee_payments p
                    WHERE p.office_id = p_office_id AND p.voided_at IS NULL AND p.bank_tx_hash = ANY (coalesce(p_hashes, '{}'))), '{}');
END;
$$;
REVOKE ALL ON FUNCTION public.fee_bank_tx_seen(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fee_bank_tx_seen(text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_fee_bank_import(p_case_id uuid, p_paid_on date, p_amount_won integer, p_payer_name text, p_tx_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_id uuid;
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  IF v_office IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'no_data_found'; END IF;
  -- 파일 대조는 사무소 전체 수납을 보는 사람만 (다른 사건 입금을 섞지 않게)
  IF public.office_permission_scope(v_office, 'fee.record') <> 'all' THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_tx_hash IS NULL OR p_tx_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid report' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_amount_won IS NULL OR p_amount_won <= 0 THEN RAISE EXCEPTION 'invalid amount' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_paid_on IS NULL OR p_paid_on > public.seoul_today() + 1 OR p_paid_on < public.seoul_today() - 3650 THEN
    RAISE EXCEPTION 'invalid paid date' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fee_agreements a WHERE a.case_id = p_case_id AND a.is_current) THEN
    RAISE EXCEPTION 'fee agreement required' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_payments p WHERE p.office_id = v_office AND p.bank_tx_hash = p_tx_hash AND p.voided_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', true);
  END IF;
  INSERT INTO public.fee_payments (office_id, case_id, paid_on, amount_won, method, payer_name, memo, source, bank_tx_hash)
  VALUES (v_office, p_case_id, p_paid_on, p_amount_won, 'transfer', left(nullif(btrim(coalesce(p_payer_name, '')), ''), 40),
          '거래내역 파일 대조', 'bank_import', p_tx_hash)
  RETURNING id INTO v_id;
  PERFORM public.office_log(v_office, 'fee_payment_bank_import', 'case', p_case_id::text,
    jsonb_build_object('payment_id', v_id, 'amount', p_amount_won, 'paid_on', p_paid_on));
  RETURN jsonb_build_object('ok', true, 'payment_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_fee_bank_import(uuid, date, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fee_bank_import(uuid, date, integer, text, text) TO authenticated;
