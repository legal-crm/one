-- ============================================================
-- FE-7 수임료 납부 안내 알림톡 예약 발송 (FE-Q4: D-3·당일·다음 날·7일 뒤, 회차당 연체 안내 최대 2번, 09~20시, '독촉' 표현 없음)
--  * fee_reminder_settings: 사무소별 켜기(기본 꺼짐)·종류·보낼 시각
--  * fee_reminders: 회차·종류마다 한 줄 (같은 안내 두 번 없음), 결과(보냄·실패·건너뜀) 기록
--  * plan_fee_reminders(): 매일 00:20 KST — 오늘 보낼 안내를 만든다 (완납 회차 제외)
--  * claim_fee_reminders()/finish_fee_reminder(): 서버 함수(api/popbill?service=reminders)만 — 보내기 직전에 남은 금액을 다시 계산
--  * 매시 05분(09~20시 KST) pg_net으로 서버 함수를 부른다. 호출 토큰은 vault 'mykim_cron_token' (저장소·문서에 값 없음)
--  * fee_case_status 계산 본문은 fee_installment_status_core로 옮기고 권한 확인만 남긴다 (정기 작업이 같은 계산을 쓰도록)
-- ============================================================

-- 1) 회차 상태 계산 (권한 확인 없음 — 다른 함수 안에서만 쓴다)
CREATE OR REPLACE FUNCTION public.fee_installment_status_core(p_case_id uuid)
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
  v_pool bigint;
  v_today date := public.seoul_today();
  r record;
  v_alloc integer;
BEGIN
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
REVOKE ALL ON FUNCTION public.fee_installment_status_core(uuid) FROM PUBLIC, anon, authenticated;

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
BEGIN
  SELECT c.office_id INTO v_office FROM public.cases c WHERE c.id = p_case_id;
  IF v_office IS NULL THEN
    RETURN;
  END IF;
  IF NOT (public.has_office_permission(v_office, 'fee.view', p_case_id) OR public.is_case_client(p_case_id)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT * FROM public.fee_installment_status_core(p_case_id);
END;
$$;

-- 2) 설정·기록 표
CREATE TABLE IF NOT EXISTS public.fee_reminder_settings (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  send_d_minus_3 boolean NOT NULL DEFAULT true,
  send_due boolean NOT NULL DEFAULT true,
  send_d_plus_1 boolean NOT NULL DEFAULT true,
  send_d_plus_7 boolean NOT NULL DEFAULT true,
  send_hour integer NOT NULL DEFAULT 10 CHECK (send_hour BETWEEN 9 AND 19),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.fee_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL REFERENCES public.fee_installments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('d_minus_3', 'due', 'd_plus_1', 'd_plus_7')),
  due_on date NOT NULL,
  send_on date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  channel text,
  receipt_num text,
  error text CHECK (error IS NULL OR char_length(error) <= 300),
  amount_won integer,
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (installment_id, kind)
);
CREATE INDEX IF NOT EXISTS fee_reminders_office_idx ON public.fee_reminders (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fee_reminders_pending_idx ON public.fee_reminders (send_on) WHERE status IN ('pending', 'sending');

ALTER TABLE public.fee_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_reminder_settings_read ON public.fee_reminder_settings;
CREATE POLICY fee_reminder_settings_read ON public.fee_reminder_settings FOR SELECT TO authenticated
  USING (public.office_permission_scope(office_id, 'fee.view') <> 'none');
DROP POLICY IF EXISTS fee_reminders_read ON public.fee_reminders;
CREATE POLICY fee_reminders_read ON public.fee_reminders FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'fee.view', case_id));
GRANT SELECT ON public.fee_reminder_settings, public.fee_reminders TO authenticated;
REVOKE ALL ON public.fee_reminder_settings, public.fee_reminders FROM anon;

-- 3) 설정 저장 (fee.record 전체 범위)
CREATE OR REPLACE FUNCTION public.set_fee_reminder_settings(p_office_id text, p jsonb)
RETURNS public.fee_reminder_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.fee_reminder_settings;
  v_hour integer := coalesce((p->>'send_hour')::integer, 10);
BEGIN
  IF public.office_permission_scope(p_office_id, 'fee.record') <> 'all' THEN
    RAISE EXCEPTION 'permission denied: fee.record' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_hour NOT BETWEEN 9 AND 19 THEN
    RAISE EXCEPTION 'send hour must be 9-19' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.fee_reminder_settings AS s (office_id, enabled, send_d_minus_3, send_due, send_d_plus_1, send_d_plus_7, send_hour, updated_at, updated_by)
  VALUES (p_office_id, coalesce((p->>'enabled')::boolean, false), coalesce((p->>'send_d_minus_3')::boolean, true),
          coalesce((p->>'send_due')::boolean, true), coalesce((p->>'send_d_plus_1')::boolean, true),
          coalesce((p->>'send_d_plus_7')::boolean, true), v_hour, now(), auth.uid())
  ON CONFLICT (office_id) DO UPDATE SET enabled = EXCLUDED.enabled, send_d_minus_3 = EXCLUDED.send_d_minus_3, send_due = EXCLUDED.send_due,
    send_d_plus_1 = EXCLUDED.send_d_plus_1, send_d_plus_7 = EXCLUDED.send_d_plus_7, send_hour = EXCLUDED.send_hour,
    updated_at = now(), updated_by = auth.uid()
  RETURNING * INTO v;
  -- 끄면 오늘 아직 안 보낸 안내는 취소
  IF NOT v.enabled THEN
    UPDATE public.fee_reminders SET status = 'cancelled', error = '사무소가 자동 안내를 껐습니다'
    WHERE office_id = p_office_id AND status = 'pending';
  END IF;
  PERFORM public.office_log(p_office_id, 'fee.reminder_settings', 'office', p_office_id,
    jsonb_build_object('enabled', v.enabled, 'send_hour', v.send_hour));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_fee_reminder_settings(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fee_reminder_settings(text, jsonb) TO authenticated;

-- 4) 오늘 보낼 안내 만들기 (정기 작업)
CREATE OR REPLACE FUNCTION public.plan_fee_reminders(p_today date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(p_today, public.seoul_today());
  s record;
  c record;
  i record;
  k record;
  v_n integer := 0;
  v_rows integer;
BEGIN
  FOR s IN SELECT * FROM public.fee_reminder_settings WHERE enabled LOOP
    FOR c IN
      SELECT cs.id FROM public.cases cs
      JOIN public.fee_agreements a ON a.case_id = cs.id AND a.is_current
      WHERE cs.office_id = s.office_id AND cs.deleted_at IS NULL AND cs.stage <> 'closed' AND cs.is_test = false
    LOOP
      FOR i IN SELECT * FROM public.fee_installment_status_core(c.id) WHERE status <> 'paid' LOOP
        FOR k IN
          SELECT * FROM (VALUES ('d_minus_3', -3, s.send_d_minus_3), ('due', 0, s.send_due),
                                ('d_plus_1', 1, s.send_d_plus_1), ('d_plus_7', 7, s.send_d_plus_7)) AS t(kind, off, on_)
          WHERE on_ AND i.due_on + off = v_today
        LOOP
          INSERT INTO public.fee_reminders (office_id, case_id, installment_id, kind, due_on, send_on, amount_won)
          VALUES (s.office_id, c.id, i.installment_id, k.kind, i.due_on, v_today, i.remaining_won)
          ON CONFLICT (installment_id, kind) DO NOTHING;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_n := v_n + v_rows;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  -- 어제까지 못 보낸 안내는 늦게 보내지 않는다 (날짜가 지난 안내는 의미가 달라짐)
  UPDATE public.fee_reminders SET status = 'skipped', error = '보낼 날짜가 지났습니다'
  WHERE status IN ('pending', 'sending') AND send_on < v_today;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.plan_fee_reminders(date) FROM PUBLIC, anon, authenticated;

-- 5) 서버 함수가 보낼 안내를 가져간다 (보내기 직전 남은 금액·연락처 다시 확인)
CREATE OR REPLACE FUNCTION public.claim_fee_reminders(p_limit integer DEFAULT 50, p_now timestamptz DEFAULT now())
RETURNS TABLE (
  reminder_id uuid, kind text, phone text, client_name text, office_name text, item_label text,
  remaining_won integer, due_on date, account_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_today date := (p_now AT TIME ZONE 'Asia/Seoul')::date;
  v_hour integer := extract(hour FROM (p_now AT TIME ZONE 'Asia/Seoul'))::integer;
  r record;
  st record;
BEGIN
  IF v_hour < 9 OR v_hour >= 20 THEN
    RETURN; -- 밤·이른 아침에는 보내지 않는다
  END IF;
  FOR r IN
    SELECT f.*, s.send_hour, oc.phone AS client_phone, oc.display_name, o.name AS office_display
    FROM public.fee_reminders f
    JOIN public.fee_reminder_settings s ON s.office_id = f.office_id AND s.enabled
    JOIN public.cases cs ON cs.id = f.case_id AND cs.deleted_at IS NULL AND cs.stage <> 'closed'
    JOIN public.office_clients oc ON oc.id = cs.office_client_id
    JOIN public.offices o ON o.id = f.office_id
    WHERE f.send_on = v_today AND s.send_hour <= v_hour
      AND (f.status = 'pending' OR (f.status = 'sending' AND f.claimed_at < now() - interval '30 minutes' AND f.attempts < 3))
    ORDER BY f.created_at
    LIMIT greatest(1, least(p_limit, 200))
    FOR UPDATE OF f SKIP LOCKED
  LOOP
    SELECT * INTO st FROM public.fee_installment_status_core(r.case_id) x WHERE x.installment_id = r.installment_id;
    IF NOT FOUND OR st.status = 'paid' OR st.remaining_won <= 0 THEN
      UPDATE public.fee_reminders SET status = 'skipped', error = '이미 납부된 회차입니다' WHERE id = r.id;
      CONTINUE;
    END IF;
    IF r.client_phone IS NULL OR r.client_phone !~ '^01[016789][0-9]{7,8}$' THEN
      UPDATE public.fee_reminders SET status = 'skipped', error = '의뢰인 휴대폰 번호가 없습니다' WHERE id = r.id;
      CONTINUE;
    END IF;
    UPDATE public.fee_reminders SET status = 'sending', attempts = attempts + 1, claimed_at = now(), amount_won = st.remaining_won WHERE id = r.id;
    account_text := NULL;
    SELECT a.bank_name || ' ' || a.account_number || ' (' || a.account_holder || ')' INTO account_text
    FROM public.fee_case_accounts a WHERE a.case_id = r.case_id;
    IF account_text IS NULL THEN
      SELECT a.bank_name || ' ' || a.account_number || ' (' || a.account_holder || ')' INTO account_text
      FROM public.fee_office_accounts a WHERE a.office_id = r.office_id;
    END IF;
    account_text := coalesce(account_text, '사무소에서 안내한 계좌');
    reminder_id := r.id; kind := r.kind; phone := r.client_phone; client_name := coalesce(nullif(r.display_name, ''), '의뢰인');
    office_name := r.office_display; item_label := st.label; remaining_won := st.remaining_won; due_on := r.due_on;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_fee_reminders(integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_fee_reminders(integer, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_fee_reminder(p_id uuid, p_status text, p_channel text, p_receipt text, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.fee_reminders
  SET status = p_status, channel = left(p_channel, 30), receipt_num = left(p_receipt, 40), error = left(p_error, 300),
      sent_at = CASE WHEN p_status = 'sent' THEN now() END
  WHERE id = p_id AND status = 'sending';
END;
$$;
REVOKE ALL ON FUNCTION public.finish_fee_reminder(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_fee_reminder(uuid, text, text, text, text) TO service_role;

-- 6) 서버 함수 호출 토큰 (vault). 서버 함수는 service role로 이 함수를 불러 확인한다
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'mykim_cron_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mykim_cron_token', 'pg_cron → Vercel scheduled routes');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_cron_token(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(length(p_token) >= 32 AND p_token = (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION public.check_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cron_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_fee_reminders()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_req bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fee_reminders WHERE status = 'pending' AND send_on = public.seoul_today()) THEN
    RETURN NULL; -- 보낼 것이 없으면 서버 함수를 부르지 않는다
  END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token' LIMIT 1;
  SELECT net.http_post(
    url := 'https://mykim.kr/api/popbill?service=reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mykim-cron', v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_req;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_fee_reminders() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_plan_fee_reminders', 'mykim_dispatch_fee_reminders');
  -- 00:20 KST = 15:20 UTC 전날
  PERFORM cron.schedule('mykim_plan_fee_reminders', '20 15 * * *', 'SELECT public.plan_fee_reminders()');
  -- 09:05~19:05 KST = 00:05~10:05 UTC
  PERFORM cron.schedule('mykim_dispatch_fee_reminders', '5 0-10 * * *', 'SELECT public.dispatch_fee_reminders()');
END;
$$;
