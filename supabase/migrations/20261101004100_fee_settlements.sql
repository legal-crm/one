-- ════════════════════════════════════════════════════════════════════════════
-- FE-10 해지·환불 정산 — 사건이 끝날 때(계약 해지·사임·의뢰인 철회) 수임료를 정리한다
--  * fee_settlements: 받은 합계(그때 값), 쓴 실비 항목, 환불액(변호사가 입력 — 자동 계산 안 함), 환불일, 사유·메모. 추가만
--  * 정산하면 남은 회차는 없앤다: 받은 돈이 있으면 '정산 전 받은 금액' 한 회차로 새 약정 버전(완납), 없으면 약정을 끝냄
--    → 남은 회차 안내(알림톡)는 나가지 않는다 (보낼 예정인 안내는 취소)
--  * 읽기 = 그 사건 수납을 볼 수 있는 사람(fee.view), 쓰기 = 서버 함수만(fee.record)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fee_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('contract_terminated', 'resigned', 'client_withdrew', 'other')),
  received_won integer NOT NULL CHECK (received_won >= 0),
  expenses jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(expenses) = 'array'),
  expense_won integer NOT NULL DEFAULT 0 CHECK (expense_won >= 0),
  refund_won integer NOT NULL DEFAULT 0 CHECK (refund_won >= 0),
  refund_on date,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_settlements_case_idx ON public.fee_settlements (case_id, created_at DESC);
ALTER TABLE public.fee_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fee_settlements FROM anon, authenticated;
GRANT SELECT ON public.fee_settlements TO authenticated;
DROP POLICY IF EXISTS fee_settlements_read ON public.fee_settlements;
CREATE POLICY fee_settlements_read ON public.fee_settlements FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'fee.view', case_id));

CREATE OR REPLACE FUNCTION public.fee_settlements_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fee_settlements is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS fee_settlements_append_only ON public.fee_settlements;
CREATE TRIGGER fee_settlements_append_only BEFORE UPDATE ON public.fee_settlements
  FOR EACH ROW EXECUTE FUNCTION public.fee_settlements_append_only();

CREATE OR REPLACE FUNCTION public.settle_fee_case(p_case_id uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_paid bigint;
  v_reason text := p ->> 'reason';
  v_refund integer := coalesce((p ->> 'refund_won')::integer, 0);
  v_refund_on date := nullif(p ->> 'refund_on', '')::date;
  v_items jsonb := '[]'::jsonb;
  v_exp bigint := 0;
  e jsonb;
  v_id uuid;
  v_label text;
BEGIN
  SELECT c.office_id INTO v_office FROM cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  IF v_office IS NULL THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.has_office_permission(v_office, 'fee.record', p_case_id) THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason NOT IN ('contract_terminated', 'resigned', 'client_withdrew', 'other') THEN
    RAISE EXCEPTION 'invalid close reason' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_typeof(coalesce(p -> 'expenses', '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p -> 'expenses', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'invalid installment' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) LOOP
    IF coalesce((e ->> 'amount_won')::integer, -1) < 0 THEN RAISE EXCEPTION 'invalid amount' USING ERRCODE = 'invalid_parameter_value'; END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object('label', left(coalesce(nullif(btrim(e ->> 'label'), ''), '실비'), 40), 'amount_won', (e ->> 'amount_won')::integer));
    v_exp := v_exp + (e ->> 'amount_won')::integer;
  END LOOP;
  SELECT coalesce(sum(amount_won), 0) INTO v_paid FROM fee_payments WHERE case_id = p_case_id AND voided_at IS NULL;
  IF v_refund < 0 OR v_refund > v_paid THEN RAISE EXCEPTION 'refund exceeds received' USING ERRCODE = 'check_violation'; END IF;
  IF v_refund > 0 AND v_refund_on IS NULL THEN RAISE EXCEPTION 'refund date required' USING ERRCODE = 'invalid_parameter_value'; END IF;

  INSERT INTO fee_settlements (office_id, case_id, reason, received_won, expenses, expense_won, refund_won, refund_on, note)
  VALUES (v_office, p_case_id, v_reason, v_paid, v_items, v_exp, v_refund, v_refund_on, left(nullif(btrim(coalesce(p ->> 'note', '')), ''), 500))
  RETURNING id INTO v_id;

  v_label := CASE v_reason WHEN 'contract_terminated' THEN '계약 해지' WHEN 'resigned' THEN '사임' WHEN 'client_withdrew' THEN '의뢰인 철회' ELSE '기타' END;
  IF v_paid > 0 THEN
    PERFORM public.set_fee_agreement(p_case_id, v_paid::integer,
      jsonb_build_array(jsonb_build_object('label', '정산 전 받은 금액', 'due_on', public.seoul_today(), 'amount_won', v_paid)),
      'manual', NULL, '수임료 정산: ' || v_label, '정산으로 남은 회차 없앰');
  ELSE
    UPDATE fee_agreements SET is_current = false WHERE case_id = p_case_id AND is_current;
  END IF;
  UPDATE fee_reminders SET status = 'cancelled' WHERE case_id = p_case_id AND status = 'pending';
  PERFORM public.office_log(v_office, 'fee_settlement', 'case', p_case_id::text,
    jsonb_build_object('settlement_id', v_id, 'reason', v_reason, 'received', v_paid, 'expense', v_exp, 'refund', v_refund));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'received_won', v_paid, 'expense_won', v_exp, 'refund_won', v_refund);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_fee_case(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_fee_case(uuid, jsonb) TO authenticated;
