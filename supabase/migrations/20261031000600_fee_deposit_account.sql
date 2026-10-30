-- ============================================================
-- FE: 수임료 입금 계좌 서버 저장 (사무소 기본 계좌 + 사건별 계좌)
-- 문제: 입금 계좌가 사무소 브라우저(localStorage 'fee_notification_settings')에만 있어 의뢰인 화면에는 늘 비어 있었다.
-- 바꾼 것:
--  * fee_office_accounts: 사무소 기본 입금 계좌 (바꾸기 office.settings.edit)
--  * fee_case_accounts: 사건별 입금 계좌 (바꾸기 fee.record, 담당 범위 포함). 비우면 사무소 기본 계좌를 씀
--  * fee_deposit_account(case): 사건 계좌 → 사무소 기본 계좌 순서로 하나 돌려줌. 사무소(fee.view)·그 사건 의뢰인만
--  * 바꿀 때마다 사무소 활동 기록 (계좌번호는 끝 4자리만 기록)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fee_office_accounts (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  bank_name text NOT NULL CHECK (char_length(bank_name) BETWEEN 1 AND 30),
  account_number text NOT NULL CHECK (account_number ~ '^[0-9][0-9-]{4,28}[0-9]$'),
  account_holder text NOT NULL CHECK (char_length(account_holder) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.fee_case_accounts (
  case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  bank_name text NOT NULL CHECK (char_length(bank_name) BETWEEN 1 AND 30),
  account_number text NOT NULL CHECK (account_number ~ '^[0-9][0-9-]{4,28}[0-9]$'),
  account_holder text NOT NULL CHECK (char_length(account_holder) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.fee_office_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_case_accounts ENABLE ROW LEVEL SECURITY;
-- 직접 읽기·쓰기 없음: 읽기는 fee_deposit_account, 쓰기는 set_fee_deposit_account
REVOKE ALL ON public.fee_office_accounts FROM anon, authenticated;
REVOKE ALL ON public.fee_case_accounts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fee_deposit_account(p_case_id uuid)
RETURNS TABLE (bank_name text, account_number text, account_holder text, scope text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  IF v_office IS NULL THEN
    RETURN;
  END IF;
  IF NOT (public.has_office_permission(v_office, 'fee.view', p_case_id) OR public.is_case_client(p_case_id)) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT a.bank_name, a.account_number, a.account_holder, 'case'::text FROM public.fee_case_accounts a WHERE a.case_id = p_case_id
    UNION ALL
    SELECT o.bank_name, o.account_number, o.account_holder, 'office'::text FROM public.fee_office_accounts o
      WHERE o.office_id = v_office AND NOT EXISTS (SELECT 1 FROM public.fee_case_accounts a WHERE a.case_id = p_case_id)
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.fee_deposit_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fee_deposit_account(uuid) TO authenticated;

-- 사무소 기본 계좌 보기 (설정 화면)
CREATE OR REPLACE FUNCTION public.fee_office_account(p_office_id text)
RETURNS TABLE (bank_name text, account_number text, account_holder text, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_office_permission(p_office_id, 'office.settings.view') OR public.has_office_permission(p_office_id, 'fee.record')) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT o.bank_name, o.account_number, o.account_holder, o.updated_at FROM public.fee_office_accounts o WHERE o.office_id = p_office_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fee_office_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fee_office_account(text) TO authenticated;

-- 계좌 저장. p_case_id가 비어 있으면 사무소 기본 계좌. 은행·번호·예금주를 모두 비우면 삭제
CREATE OR REPLACE FUNCTION public.set_fee_deposit_account(
  p_office_id text, p_case_id uuid, p_bank_name text, p_account_number text, p_account_holder text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank text := nullif(btrim(coalesce(p_bank_name, '')), '');
  v_no text := nullif(regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g'), '');
  v_holder text := nullif(btrim(coalesce(p_account_holder, '')), '');
  v_case_office text;
  v_clear boolean;
BEGIN
  v_clear := v_bank IS NULL AND v_no IS NULL AND v_holder IS NULL;
  IF NOT v_clear AND (v_bank IS NULL OR v_no IS NULL OR v_holder IS NULL) THEN
    RAISE EXCEPTION 'bank, account number and holder are all required' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_clear AND v_no !~ '^[0-9][0-9-]{4,28}[0-9]$' THEN
    RAISE EXCEPTION 'invalid account number' USING ERRCODE = 'check_violation';
  END IF;

  IF p_case_id IS NULL THEN
    IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') THEN
      RAISE EXCEPTION 'no permission' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_clear THEN
      DELETE FROM public.fee_office_accounts WHERE office_id = p_office_id;
    ELSE
      INSERT INTO public.fee_office_accounts (office_id, bank_name, account_number, account_holder, updated_at, updated_by)
      VALUES (p_office_id, v_bank, v_no, v_holder, now(), auth.uid())
      ON CONFLICT (office_id) DO UPDATE SET bank_name = EXCLUDED.bank_name, account_number = EXCLUDED.account_number,
        account_holder = EXCLUDED.account_holder, updated_at = now(), updated_by = auth.uid();
    END IF;
  ELSE
    SELECT c.office_id INTO v_case_office FROM public.cases c WHERE c.id = p_case_id AND c.deleted_at IS NULL;
    IF v_case_office IS NULL OR v_case_office <> p_office_id OR NOT public.has_office_permission(p_office_id, 'fee.record', p_case_id) THEN
      RAISE EXCEPTION 'no permission' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_clear THEN
      DELETE FROM public.fee_case_accounts WHERE case_id = p_case_id;
    ELSE
      INSERT INTO public.fee_case_accounts (case_id, office_id, bank_name, account_number, account_holder, updated_at, updated_by)
      VALUES (p_case_id, p_office_id, v_bank, v_no, v_holder, now(), auth.uid())
      ON CONFLICT (case_id) DO UPDATE SET bank_name = EXCLUDED.bank_name, account_number = EXCLUDED.account_number,
        account_holder = EXCLUDED.account_holder, updated_at = now(), updated_by = auth.uid();
    END IF;
  END IF;

  PERFORM public.office_log(p_office_id, CASE WHEN v_clear THEN 'fee.account_cleared' ELSE 'fee.account_set' END,
    CASE WHEN p_case_id IS NULL THEN 'office' ELSE 'case' END, coalesce(p_case_id::text, p_office_id),
    jsonb_build_object('bank', v_bank, 'last4', CASE WHEN v_no IS NULL THEN NULL ELSE right(regexp_replace(v_no, '-', '', 'g'), 4) END));
  RETURN jsonb_build_object('ok', true, 'cleared', v_clear);
END;
$$;
REVOKE ALL ON FUNCTION public.set_fee_deposit_account(text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fee_deposit_account(text, uuid, text, text, text) TO authenticated;
