-- ============================================================
-- AD-7 연장 구좌 우선 유지 (17 기획서 4-3 '구좌 우선 유지')
--  * 노출 중(또는 시작 예정)인 광고가 끝나기 14일 전부터, 끝난 뒤 14일 동안의 구좌 1개를 그 변호사 연장용으로 잡아 둔다
--  * 다른 변호사의 새 신청은 이 '연장 대기 구좌'도 찬 것으로 센다. 원래 광고주가 연장하면 그대로 들어간다
--  * 이미 연장 신청(renewed_from)이 있으면 잡아 두지 않는다 (연장 주문이 구좌를 직접 차지)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ad_slots_taken_for(p_product_id text, p_region text, p_starts_on date, p_ends_on date, p_lawyer_id text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ad_slots_taken(p_product_id, p_region, p_starts_on, p_ends_on)
       + (SELECT count(*)::integer
            FROM public.ad_orders o
            JOIN public.ad_products p ON p.id = o.product_id
           WHERE o.product_id = p_product_id
             AND (NOT p.per_region OR o.region = p_region)
             AND o.status IN ('paid', 'active')
             AND o.ends_on IS NOT NULL
             AND o.lawyer_id IS DISTINCT FROM p_lawyer_id
             AND o.ends_on <= public.seoul_today() + 14
             AND o.ends_on > public.seoul_today() - 1
             -- 잡아 두는 기간 [ends_on, ends_on + 14) 과 신청 기간이 겹칠 때만
             AND o.ends_on < p_ends_on AND p_starts_on < o.ends_on + 14
             AND NOT EXISTS (SELECT 1 FROM public.ad_orders r WHERE r.renewed_from = o.id AND r.status IN ('pending', 'paid', 'active')))
$$;
REVOKE ALL ON FUNCTION public.ad_slots_taken_for(text, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_slots_taken_for(text, text, date, date, text) TO authenticated;

-- create_ad_order 의 구좌 확인을 연장 대기 구좌까지 세도록 바꾼다 (본문 나머지는 그대로)
DO $$
DECLARE
  d text := pg_get_functiondef('public.create_ad_order(text, text, integer, date, text, text)'::regprocedure);
  old_call text := 'public.ad_slots_taken(p_product_id, v_region, p_starts_on, v_ends)';
  new_call text := 'public.ad_slots_taken_for(p_product_id, v_region, p_starts_on, v_ends, p_lawyer_id)';
BEGIN
  IF position(new_call IN d) > 0 THEN RETURN; END IF;
  IF position(old_call IN d) = 0 THEN RAISE EXCEPTION 'create_ad_order: slot check not found'; END IF;
  EXECUTE replace(d, old_call, new_call);
END;
$$;
