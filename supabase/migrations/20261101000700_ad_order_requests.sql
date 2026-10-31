-- ============================================================
-- AD-7·AD-8 광고 주문: 신청 취소(입금 전)·연장 신청·환불 요청 + 관리자 환불 도우미
--  * ad_cancel_my_order: 입금 대기 주문만, 사무소 ads.manage
--  * ad_refund_quote: AD-Q4 규정 — 노출 시작 전(입금 완료)은 전액, 노출 중은 남은 날 일할(위약금 없음)
--  * ad_request_refund: 사유 필수, 주문당 처리 대기 1건 → 관리자 '오늘 처리할 일'
--  * ad_renew_order: 같은 상품·지역으로 끝나는 날 다음부터 새 주문 (create_ad_order 규칙 그대로)
--  * admin_resolve_ad_request: 승인 = admin_cancel_ad_order(환불액), 반려 = 사유 + 사무소 알림
-- ============================================================

ALTER TABLE public.ad_orders ADD COLUMN IF NOT EXISTS renewed_from text;

CREATE TABLE IF NOT EXISTS public.ad_order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.ad_orders(id) ON DELETE CASCADE,
  office_id text NOT NULL,
  kind text NOT NULL DEFAULT 'refund' CHECK (kind IN ('refund')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500),
  suggested_refund integer NOT NULL DEFAULT 0 CHECK (suggested_refund >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'withdrawn')),
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolve_note text,
  refund_amount integer CHECK (refund_amount IS NULL OR refund_amount >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ad_order_requests_open ON public.ad_order_requests (order_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_ad_order_requests_office ON public.ad_order_requests (office_id, requested_at DESC);

ALTER TABLE public.ad_order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_order_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ad_order_requests TO authenticated;
DROP POLICY IF EXISTS ad_order_requests_read ON public.ad_order_requests;
CREATE POLICY ad_order_requests_read ON public.ad_order_requests FOR SELECT TO authenticated
  USING (public.is_platform_admin()
    OR public.has_office_permission(office_id, 'ads.manage')
    OR public.has_office_permission(office_id, 'billing.view'));

-- 환불 계산 (원 단위 정수, 내림). 오늘은 노출한 날로 친다
CREATE OR REPLACE FUNCTION public.ad_refund_amount_core(o public.ad_orders)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_total integer := coalesce(o.total_amount, o.total_price, 0);
  v_today date := public.seoul_today();
  v_days integer;
  v_left integer;
BEGIN
  IF o.status = 'paid' OR (o.status = 'active' AND o.starts_on IS NOT NULL AND o.starts_on > v_today) THEN
    RETURN jsonb_build_object('rule', 'before_start', 'amount', v_total, 'total', v_total, 'days', NULL, 'days_left', NULL);
  END IF;
  IF o.status = 'active' AND o.starts_on IS NOT NULL AND o.ends_on IS NOT NULL AND o.ends_on > o.starts_on THEN
    v_days := o.ends_on - o.starts_on;
    v_left := greatest(o.ends_on - v_today - 1, 0);
    RETURN jsonb_build_object('rule', 'prorated', 'amount', floor(v_total::numeric * v_left / v_days)::integer,
      'total', v_total, 'days', v_days, 'days_left', v_left);
  END IF;
  RETURN jsonb_build_object('rule', 'none', 'amount', 0, 'total', v_total, 'days', NULL, 'days_left', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.ad_refund_amount_core(public.ad_orders) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ad_refund_quote(p_order_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ad_orders;
BEGIN
  SELECT * INTO o FROM public.ad_orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT (public.is_platform_admin() OR public.has_office_permission(o.office_id, 'ads.manage') OR public.has_office_permission(o.office_id, 'billing.view')) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.ad_refund_amount_core(o);
END;
$$;
REVOKE ALL ON FUNCTION public.ad_refund_quote(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_refund_quote(text) TO authenticated;

-- 변호사: 입금 전 신청 취소
CREATE OR REPLACE FUNCTION public.ad_cancel_my_order(p_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ad_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM public.ad_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.office_id IS NULL OR NOT public.has_office_permission(o.office_id, 'ads.manage') THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'cancel only before payment' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.ad_orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = '신청 취소 (입금 전)',
         reserved_until = NULL, updated_at = now()
   WHERE id = p_order_id;
  PERFORM public.office_log(o.office_id, 'ad_order_cancel', 'ad_order', o.id, jsonb_build_object('by', 'office'));
  RETURN (SELECT to_jsonb(x) FROM public.ad_orders x WHERE x.id = p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ad_cancel_my_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_cancel_my_order(text) TO authenticated;

-- 변호사: 환불 요청
CREATE OR REPLACE FUNCTION public.ad_request_refund(p_order_id text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.ad_orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_quote jsonb;
  r public.ad_order_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM public.ad_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.office_id IS NULL OR NOT public.has_office_permission(o.office_id, 'ads.manage') THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.status NOT IN ('paid', 'active') THEN RAISE EXCEPTION 'refund only for paid orders' USING ERRCODE = 'check_violation'; END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 2 THEN RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF EXISTS (SELECT 1 FROM public.ad_order_requests q WHERE q.order_id = o.id AND q.status = 'open') THEN
    RAISE EXCEPTION 'refund request already open' USING ERRCODE = 'unique_violation';
  END IF;
  v_quote := public.ad_refund_amount_core(o);
  INSERT INTO public.ad_order_requests (order_id, office_id, reason, suggested_refund, requested_by)
  VALUES (o.id, o.office_id, left(v_reason, 500), (v_quote ->> 'amount')::integer, auth.uid())
  RETURNING * INTO r;
  PERFORM public.office_log(o.office_id, 'ad_refund_request', 'ad_order', o.id, jsonb_build_object('suggested', r.suggested_refund));
  RETURN to_jsonb(r);
END;
$$;
REVOKE ALL ON FUNCTION public.ad_request_refund(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_request_refund(text, text) TO authenticated;

-- 변호사: 환불 요청 거두기
CREATE OR REPLACE FUNCTION public.ad_withdraw_refund_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ad_order_requests;
BEGIN
  SELECT * INTO r FROM public.ad_order_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.has_office_permission(r.office_id, 'ads.manage') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'request already closed' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.ad_order_requests SET status = 'withdrawn', resolved_at = now(), resolved_by = auth.uid() WHERE id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.ad_withdraw_refund_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_withdraw_refund_request(uuid) TO authenticated;

-- 변호사: 연장 신청 (끝나는 날부터 같은 상품·지역 새 주문)
CREATE OR REPLACE FUNCTION public.ad_renew_order(p_order_id text, p_months integer, p_depositor_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.ad_orders;
  v_new jsonb;
  v_start date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM public.ad_orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.office_id IS NULL OR NOT public.has_office_permission(o.office_id, 'ads.manage') THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.status NOT IN ('paid', 'active') OR o.ends_on IS NULL THEN RAISE EXCEPTION 'renew only paid orders' USING ERRCODE = 'check_violation'; END IF;
  IF EXISTS (SELECT 1 FROM public.ad_orders x WHERE x.renewed_from = o.id AND x.status IN ('pending', 'paid', 'active')) THEN
    RAISE EXCEPTION 'already renewed' USING ERRCODE = 'unique_violation';
  END IF;
  v_start := greatest(o.ends_on, public.seoul_today());
  v_new := public.create_ad_order(o.lawyer_id, o.product_id, p_months, v_start, o.region, p_depositor_name);
  UPDATE public.ad_orders SET renewed_from = o.id WHERE id = v_new ->> 'id';
  RETURN (SELECT to_jsonb(x) FROM public.ad_orders x WHERE x.id = v_new ->> 'id');
END;
$$;
REVOKE ALL ON FUNCTION public.ad_renew_order(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_renew_order(text, integer, text) TO authenticated;

-- 관리자: 환불 요청 처리
CREATE OR REPLACE FUNCTION public.admin_resolve_ad_request(p_request_id uuid, p_decision text, p_refund_amount integer DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.ad_order_requests;
  o public.ad_orders;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_amount integer;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'invalid decision' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO r FROM public.ad_order_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'request already closed' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO o FROM public.ad_orders WHERE id = r.order_id;

  IF p_decision = 'reject' THEN
    IF v_note IS NULL THEN RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value'; END IF;
    UPDATE public.ad_order_requests SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), resolve_note = left(v_note, 300) WHERE id = r.id;
    PERFORM public.admin_record_action('ad_refund_reject', 'ad_order', o.id, jsonb_build_object('status', 'open'), jsonb_build_object('status', 'rejected'), v_note);
    PERFORM public.notify_office_members(r.office_id, 'ads.manage', NULL, 'ad_refund_rejected', '광고 환불 요청이 반려됐어요',
      o.product_name || ': ' || left(v_note, 120), 'ads', o.id, 'ad_refund:' || r.id);
  ELSE
    v_amount := coalesce(p_refund_amount, r.suggested_refund);
    PERFORM public.admin_cancel_ad_order(o.id, '환불 요청 승인' || CASE WHEN v_note IS NULL THEN '' ELSE ': ' || v_note END, v_amount);
    UPDATE public.ad_order_requests SET status = 'approved', resolved_at = now(), resolved_by = auth.uid(),
           resolve_note = left(v_note, 300), refund_amount = v_amount WHERE id = r.id;
    PERFORM public.admin_record_action('ad_refund_approve', 'ad_order', o.id, jsonb_build_object('status', o.status),
      jsonb_build_object('status', 'cancelled', 'refund', v_amount, 'suggested', r.suggested_refund), v_note);
  END IF;
  RETURN (SELECT to_jsonb(q) FROM public.ad_order_requests q WHERE q.id = r.id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_ad_request(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_ad_request(uuid, text, integer, text) TO authenticated;

-- 관리자 '오늘 처리할 일'에 환불 요청
DO $$
DECLARE
  d text := pg_get_functiondef('public.admin_todo_items()'::regprocedure);
  add text := $add$
  SELECT count(*), min(q.requested_at) INTO n, t FROM ad_order_requests q WHERE q.status = 'open';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'ad_refund_request', 'label', '광고 환불 요청', 'count', n, 'oldest_at', t,
    'overdue', public.business_days_between(t) > 2, 'tab', 'billing'); END IF;

  RETURN v;$add$;
  i integer;
BEGIN
  IF position('ad_refund_request' IN d) > 0 THEN RETURN; END IF;
  i := length(d) - position(reverse('RETURN v;') IN reverse(d)) - length('RETURN v;') + 2;
  IF i <= 0 THEN RAISE EXCEPTION 'admin_todo_items: RETURN not found'; END IF;
  EXECUTE substr(d, 1, i - 1) || add || substr(d, i + length('RETURN v;'));
END;
$$;
