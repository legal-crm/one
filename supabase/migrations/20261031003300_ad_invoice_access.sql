-- ============================================================
-- 광고 세금계산서: 사무소 열람·서버 기록 (AD-6)
-- 이전: 사무소 '계산서 보기'가 관리자 전용 API(/api/invoice/pdf)를 불러 늘 403.
--       발행 기록은 관리자 브라우저가 주문에 따로 저장해, 그 저장이 실패하면 발행 사실이 사라졌다.
-- 바꾼 것:
--  * ad_invoice_view_key(주문, 사용자, 종류): 서버(service_role)만. 그 주문 사무소의 billing.view 권한이 있는
--    구성원이면 팝빌 문서번호를 돌려준다 → /api/invoice/office-pdf가 팝빌 보기 주소를 만든다
--  * ad_order_invoice_target(주문): 서버만. 발행할 금액·사업자 정보를 주문에서 읽는다(화면이 보낸 금액을 믿지 않음)
--  * record_ad_order_invoice(주문, 종류, 내용): 서버만. 발행 성공 직후 주문에 기록(이미 있으면 덮어쓰지 않음)
-- ============================================================

CREATE OR REPLACE FUNCTION public.ad_invoice_view_key(p_order_id text, p_user_id uuid, p_kind text DEFAULT 'issue')
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o ad_orders;
  m office_members;
  v_ok boolean := false;
BEGIN
  SELECT * INTO o FROM ad_orders WHERE id = p_order_id;
  IF o.id IS NULL OR p_user_id IS NULL THEN RETURN NULL; END IF;
  IF o.office_id IS NOT NULL THEN
    FOR m IN SELECT * FROM office_members WHERE office_id = o.office_id AND user_id = p_user_id AND status = 'active' LOOP
      IF public.member_permission_scope(m, 'billing.view') <> 'none' THEN v_ok := true; END IF;
    END LOOP;
  ELSE
    v_ok := EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = p_user_id AND la.lawyer_id = o.lawyer_id AND la.approved);
  END IF;
  IF NOT v_ok THEN RETURN NULL; END IF;
  RETURN CASE WHEN p_kind = 'modify' THEN o.modified_tax_invoice ->> 'itemKey' ELSE o.tax_invoice ->> 'itemKey' END;
END;
$$;
REVOKE ALL ON FUNCTION public.ad_invoice_view_key(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_invoice_view_key(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ad_order_invoice_target(p_order_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'status', o.status, 'supply', o.supply_amount, 'vat', o.vat_amount, 'total', o.total_amount,
    'has_invoice', o.tax_invoice IS NOT NULL, 'has_modified', o.modified_tax_invoice IS NOT NULL,
    'nts_confirm_num', o.tax_invoice ->> 'ntsConfirmNum', 'invoice_supply', (o.tax_invoice ->> 'supplyCost')::numeric,
    'buyer', coalesce(o.buyer_snapshot, '{}'::jsonb))
  FROM ad_orders o WHERE o.id = p_order_id;
$$;
REVOKE ALL ON FUNCTION public.ad_order_invoice_target(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_order_invoice_target(text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_ad_order_invoice(p_order_id text, p_kind text, p_invoice jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_kind = 'modify' THEN
    UPDATE ad_orders SET modified_tax_invoice = p_invoice WHERE id = p_order_id AND modified_tax_invoice IS NULL;
  ELSE
    UPDATE ad_orders SET tax_invoice = p_invoice WHERE id = p_order_id AND tax_invoice IS NULL;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ad_order_invoice(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_order_invoice(text, text, jsonb) TO service_role;
