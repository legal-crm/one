-- ============================================================
-- AD-1~AD-5 광고 주문 서버화
--  * ad_products(정수 원·VAT 별도)·ad_promotions(오픈 할인) — 가격 원본은 서버
--  * office_billing_profiles — 세금계산서용 사업자 정보 (사무소 단위, 브라우저 저장 대체)
--  * create_ad_order — 서버가 공급가·VAT·합계·구좌 예약(3영업일)·사업자 정보 사본을 정함, 직접 INSERT 차단
--  * 관리자: 입금 확인(시작일 기준 노출 기간)·취소(사유·환불액 기록)
--  * run_ad_order_lifecycle — 입금 기한 지난 예약 취소·시작·만료, lawyers.ad_tier 자동 맞춤 (매일 pg_cron)
--  * public_active_ad_placements — 고객 사이트가 읽는 노출 목록 (금액 없음)
-- 결정: AD-Q1 가격 VAT 별도·입금액 VAT 포함 / AD-Q2 오픈 할인과 장기 할인 중 큰 것 하나, 오픈 할인은 오픈 기간 안 노출 달만
--       AD-Q3 3영업일 구좌 예약 후 자동 취소 / AD-Q4 환불 시작 전 전액·시작 후 일할(금액은 관리자 입력) / AD-Q6 2지역 할인 없음
-- ============================================================

-- 1) 상품·할인 ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('main_banner', 'top_exposure', 'regional')),
  monthly_price_won integer NOT NULL CHECK (monthly_price_won > 0),
  max_slots integer NOT NULL CHECK (max_slots > 0),
  per_region boolean NOT NULL DEFAULT false,
  -- 계약 개월 → 할인율(%) 정수. 예: {"3":10,"6":20,"12":25}
  term_discounts jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ad_products (id, name, placement, monthly_price_won, max_slots, per_region, term_discounts, sort_order) VALUES
  ('ad-main-banner', '메인 배너 광고', 'main_banner', 500000, 5, false, '{"3":10,"6":20,"12":25}', 1),
  ('ad-top-exposure', '상단 노출 광고', 'top_exposure', 300000, 6, false, '{"3":10,"6":15,"12":20}', 2),
  ('ad-regional-top', '지역 광고', 'regional', 200000, 4, true, '{"3":10,"6":15,"12":20}', 3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ad_promotions (
  id text PRIMARY KEY,
  name text NOT NULL,
  rate integer NOT NULL CHECK (rate BETWEEN 1 AND 90),
  starts_on date,
  ends_on date,
  active boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on)
);

-- 오픈 할인 50% (첫 2개월). 오픈일이 정해지면 관리자가 기간을 넣고 켠다
INSERT INTO public.ad_promotions (id, name, rate, active, note) VALUES
  ('open_launch', '오픈 할인', 50, false, '오픈 후 2개월 안에 노출되는 달만 적용. 장기 할인과 중복 없이 큰 것 하나')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_products_public_select ON public.ad_products;
CREATE POLICY ad_products_public_select ON public.ad_products FOR SELECT TO anon, authenticated
  USING (active OR public.is_platform_admin());
DROP POLICY IF EXISTS ad_products_admin_write ON public.ad_products;
CREATE POLICY ad_products_admin_write ON public.ad_products FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS ad_promotions_public_select ON public.ad_promotions;
CREATE POLICY ad_promotions_public_select ON public.ad_promotions FOR SELECT TO anon, authenticated
  USING (active OR public.is_platform_admin());
DROP POLICY IF EXISTS ad_promotions_admin_write ON public.ad_promotions;
CREATE POLICY ad_promotions_admin_write ON public.ad_promotions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

GRANT SELECT ON public.ad_products, public.ad_promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_products, public.ad_promotions TO authenticated;

-- 2) 사무소 사업자 정보 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_billing_profiles (
  office_id text PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  corp_num text CHECK (corp_num IS NULL OR corp_num ~ '^[0-9]{10}$'),
  corp_name text CHECK (corp_name IS NULL OR char_length(corp_name) <= 100),
  ceo_name text CHECK (ceo_name IS NULL OR char_length(ceo_name) <= 50),
  address text CHECK (address IS NULL OR char_length(address) <= 200),
  biz_type text CHECK (biz_type IS NULL OR char_length(biz_type) <= 50),
  biz_class text CHECK (biz_class IS NULL OR char_length(biz_class) <= 50),
  email text CHECK (email IS NULL OR (char_length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  email2 text CHECK (email2 IS NULL OR (char_length(email2) <= 120 AND email2 ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 50),
  contact_phone text CHECK (contact_phone IS NULL OR contact_phone ~ '^[0-9-]{8,15}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.office_billing_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_billing_select ON public.office_billing_profiles;
CREATE POLICY office_billing_select ON public.office_billing_profiles FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'billing.view') OR public.has_office_permission(office_id, 'ads.manage') OR public.is_platform_admin());
DROP POLICY IF EXISTS office_billing_insert ON public.office_billing_profiles;
CREATE POLICY office_billing_insert ON public.office_billing_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_office_permission(office_id, 'ads.manage'));
DROP POLICY IF EXISTS office_billing_update ON public.office_billing_profiles;
CREATE POLICY office_billing_update ON public.office_billing_profiles FOR UPDATE TO authenticated
  USING (public.has_office_permission(office_id, 'ads.manage'))
  WITH CHECK (public.has_office_permission(office_id, 'ads.manage'));
GRANT SELECT, INSERT, UPDATE ON public.office_billing_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.office_billing_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  NEW.corp_num := nullif(regexp_replace(coalesce(NEW.corp_num, ''), '[^0-9]', '', 'g'), '');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS office_billing_touch ON public.office_billing_profiles;
CREATE TRIGGER office_billing_touch BEFORE INSERT OR UPDATE ON public.office_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.office_billing_touch();

-- 3) 주문 표 칸 추가 ---------------------------------------------------------------
ALTER TABLE public.ad_orders
  ADD COLUMN IF NOT EXISTS office_id text,
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS supply_amount integer,
  ADD COLUMN IF NOT EXISTS vat_amount integer,
  ADD COLUMN IF NOT EXISTS total_amount integer,
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS refund_amount integer,
  ADD COLUMN IF NOT EXISTS price_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS buyer_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_ad_orders_product_period ON public.ad_orders (product_id, region, starts_on, ends_on) WHERE status IN ('pending', 'paid', 'active');
CREATE INDEX IF NOT EXISTS idx_ad_orders_office ON public.ad_orders (office_id, requested_at DESC);

-- 직접 INSERT 차단 (주문은 create_ad_order로만)
DROP POLICY IF EXISTS ad_orders_insert_own_pending ON public.ad_orders;
DROP POLICY IF EXISTS ad_orders_select_own_or_admin ON public.ad_orders;
CREATE POLICY ad_orders_select_own_or_admin ON public.ad_orders FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR lawyer_id = public.current_lawyer_profile_id()
    OR (office_id IS NOT NULL AND (public.has_office_permission(office_id, 'billing.view') OR public.has_office_permission(office_id, 'ads.manage')))
  );

-- 4) 계산 도우미 -----------------------------------------------------------------
-- 서울 기준 오늘
CREATE OR REPLACE FUNCTION public.seoul_today()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Seoul')::date $$;

-- n영업일 뒤 (토·일 제외, 공휴일은 반영 안 함)
CREATE OR REPLACE FUNCTION public.add_business_days(p_from timestamptz, p_days integer)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v timestamptz := p_from;
  n integer := 0;
BEGIN
  WHILE n < p_days LOOP
    v := v + interval '1 day';
    IF extract(isodow FROM (v AT TIME ZONE 'Asia/Seoul')) < 6 THEN
      n := n + 1;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

-- 가격 계산 (원 단위 정수). 달마다 장기 할인과 오픈 할인 중 큰 것 하나
CREATE OR REPLACE FUNCTION public.ad_price_quote(p_product_id text, p_months integer, p_starts_on date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.ad_products%ROWTYPE;
  v_term integer;
  v_open public.ad_promotions%ROWTYPE;
  v_month_start date;
  v_rate integer;
  v_price integer;
  v_supply integer := 0;
  v_rows jsonb := '[]'::jsonb;
  i integer;
BEGIN
  SELECT * INTO v_p FROM public.ad_products WHERE id = p_product_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad product not found' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_months NOT IN (1, 3, 6, 12) THEN
    RAISE EXCEPTION 'invalid contract months' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_term := coalesce((v_p.term_discounts ->> p_months::text)::integer, 0);
  SELECT * INTO v_open FROM public.ad_promotions WHERE id = 'open_launch' AND active AND starts_on IS NOT NULL AND ends_on IS NOT NULL;
  FOR i IN 0 .. p_months - 1 LOOP
    v_month_start := (p_starts_on + make_interval(months => i))::date;
    v_rate := v_term;
    IF v_open.id IS NOT NULL AND v_month_start BETWEEN v_open.starts_on AND v_open.ends_on THEN
      v_rate := greatest(v_rate, v_open.rate);
    END IF;
    v_price := round(v_p.monthly_price_won * (100 - v_rate) / 100.0)::integer;
    v_supply := v_supply + v_price;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('month', i + 1, 'starts_on', v_month_start, 'rate', v_rate, 'supply', v_price));
  END LOOP;
  RETURN jsonb_build_object(
    'product_id', v_p.id,
    'product_name', v_p.name,
    'placement', v_p.placement,
    'months', p_months,
    'list_monthly', v_p.monthly_price_won,
    'supply', v_supply,
    'vat', round(v_supply * 0.1)::integer,
    'total', v_supply + round(v_supply * 0.1)::integer,
    'months_detail', v_rows
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.ad_price_quote(text, integer, date) TO anon, authenticated;

-- 구좌 사용 수 (입금 대기 중 예약 유효분 + 입금 완료 + 노출 중, 기간 겹침)
CREATE OR REPLACE FUNCTION public.ad_slots_taken(p_product_id text, p_region text, p_starts_on date, p_ends_on date, p_exclude_order text DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.ad_orders o
  JOIN public.ad_products p ON p.id = o.product_id
  WHERE o.product_id = p_product_id
    AND (NOT p.per_region OR o.region = p_region)
    AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
    AND o.starts_on IS NOT NULL AND o.ends_on IS NOT NULL
    AND o.starts_on < p_ends_on AND p_starts_on < o.ends_on
    AND (
      o.status IN ('paid', 'active')
      OR (o.status = 'pending' AND o.reserved_until > now())
    );
$$;
REVOKE ALL ON FUNCTION public.ad_slots_taken(text, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_slots_taken(text, text, date, date, text) TO authenticated;

-- 5) 주문 만들기 -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ad_order(
  p_lawyer_id text,
  p_product_id text,
  p_months integer,
  p_starts_on date,
  p_region text DEFAULT NULL,
  p_depositor_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office text;
  v_lawyer_name text;
  v_product public.ad_products%ROWTYPE;
  v_region text := nullif(btrim(coalesce(p_region, '')), '');
  v_ends date;
  v_quote jsonb;
  v_billing public.office_billing_profiles%ROWTYPE;
  v_id text := 'ado-' || replace(gen_random_uuid()::text, '-', '');
  v_supply integer;
  v_vat integer;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.office_id INTO v_office
  FROM public.office_members m
  WHERE m.lawyer_id = p_lawyer_id AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC
  LIMIT 1;
  IF v_office IS NULL OR NOT public.has_office_permission(v_office, 'ads.manage') THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lawyer_accounts la WHERE la.lawyer_id = p_lawyer_id AND la.approved) THEN
    RAISE EXCEPTION 'lawyer is not approved' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_product FROM public.ad_products WHERE id = p_product_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad product not found' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_starts_on IS NULL OR p_starts_on < public.seoul_today() OR p_starts_on > public.seoul_today() + 90 THEN
    RAISE EXCEPTION 'invalid start date' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_product.per_region AND (v_region IS NULL OR char_length(v_region) > 30) THEN
    RAISE EXCEPTION 'region required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT v_product.per_region THEN
    v_region := NULL;
  END IF;

  v_ends := (p_starts_on + make_interval(months => p_months))::date;

  -- 같은 상품·지역 동시 신청 경합 방지
  PERFORM pg_advisory_xact_lock(hashtext('ad:' || p_product_id || ':' || coalesce(v_region, '')));

  IF EXISTS (
    SELECT 1 FROM public.ad_orders o
    WHERE o.lawyer_id = p_lawyer_id AND o.product_id = p_product_id
      AND o.region IS NOT DISTINCT FROM v_region
      AND o.starts_on < v_ends AND p_starts_on < o.ends_on
      AND (o.status IN ('paid', 'active') OR (o.status = 'pending' AND o.reserved_until > now()))
  ) THEN
    RAISE EXCEPTION 'duplicate ad order for the period' USING ERRCODE = 'unique_violation';
  END IF;

  IF public.ad_slots_taken(p_product_id, v_region, p_starts_on, v_ends) >= v_product.max_slots THEN
    RAISE EXCEPTION 'no ad slots available' USING ERRCODE = 'check_violation';
  END IF;

  v_quote := public.ad_price_quote(p_product_id, p_months, p_starts_on);
  v_supply := (v_quote ->> 'supply')::integer;
  v_vat := (v_quote ->> 'vat')::integer;
  v_total := (v_quote ->> 'total')::integer;

  SELECT * INTO v_billing FROM public.office_billing_profiles WHERE office_id = v_office;
  SELECT l.name INTO v_lawyer_name FROM public.lawyers l WHERE l.id = p_lawyer_id;

  INSERT INTO public.ad_orders (
    id, lawyer_id, lawyer_name, office_id, product_id, product_name, placement,
    contract_months, monthly_price, total_price, supply_amount, vat_amount, total_amount,
    status, requested_at, starts_on, ends_on, reserved_until, depositor_name, region,
    price_breakdown, buyer_snapshot,
    buyer_corp_num, buyer_corp_name, buyer_ceo_name, buyer_email, created_by
  ) VALUES (
    v_id, p_lawyer_id, coalesce(v_lawyer_name, ''), v_office, v_product.id, v_product.name, v_product.placement,
    p_months, round(v_supply::numeric / p_months)::integer, v_total, v_supply, v_vat, v_total,
    'pending', now(), p_starts_on, v_ends, public.add_business_days(now(), 3),
    left(nullif(btrim(coalesce(p_depositor_name, '')), ''), 40), v_region,
    v_quote,
    CASE WHEN v_billing.office_id IS NULL THEN NULL ELSE to_jsonb(v_billing) - 'updated_by' END,
    v_billing.corp_num, v_billing.corp_name, v_billing.ceo_name, v_billing.email, auth.uid()
  );

  PERFORM public.office_log(v_office, 'ad_order_create', 'ad_order', v_id,
    jsonb_build_object('product', v_product.id, 'months', p_months, 'total', v_total, 'starts_on', p_starts_on));

  RETURN (SELECT to_jsonb(o) FROM public.ad_orders o WHERE o.id = v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_ad_order(text, text, integer, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ad_order(text, text, integer, date, text, text) TO authenticated;

-- 6) 변호사 tier 자동 맞춤 + 생애 주기 ------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lawyer_ad_tiers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH cur AS (
    SELECT o.lawyer_id,
      CASE
        WHEN bool_or(o.placement = 'top_exposure') THEN 'top'
        WHEN bool_or(o.placement = 'regional') THEN 'regional'
        WHEN bool_or(o.placement = 'main_banner') THEN 'banner'
      END AS tier
    FROM public.ad_orders o
    WHERE o.status = 'active'
    GROUP BY o.lawyer_id
  )
  UPDATE public.lawyers l
  SET ad_tier = t.tier
  FROM (SELECT l2.id, c.tier FROM public.lawyers l2 LEFT JOIN cur c ON c.lawyer_id = l2.id) t
  WHERE l.id = t.id AND l.ad_tier IS DISTINCT FROM t.tier;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_lawyer_ad_tiers() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_ad_order_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.seoul_today();
  v_cancelled integer;
  v_started integer;
  v_expired integer;
BEGIN
  -- 수동 호출은 관리자만 (pg_cron은 소유자 권한으로 실행)
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.ad_orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = '입금 기한(3영업일) 지남', updated_at = now()
  WHERE status = 'pending' AND reserved_until IS NOT NULL AND reserved_until <= now();
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.ad_orders SET status = 'active', activated_at = coalesce(activated_at, now()), updated_at = now()
  WHERE status = 'paid' AND starts_on IS NOT NULL AND starts_on <= v_today AND (ends_on IS NULL OR ends_on > v_today);
  GET DIAGNOSTICS v_started = ROW_COUNT;

  UPDATE public.ad_orders SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'paid') AND ends_on IS NOT NULL AND ends_on <= v_today;
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  PERFORM public.sync_lawyer_ad_tiers();
  RETURN jsonb_build_object('cancelled', v_cancelled, 'started', v_started, 'expired', v_expired);
END;
$$;
REVOKE ALL ON FUNCTION public.run_ad_order_lifecycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_ad_order_lifecycle() TO authenticated;

-- 7) 관리자: 입금 확인·취소 -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_confirm_ad_payment(p_order_id text, p_paid_on date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.ad_orders%ROWTYPE;
  v_today date := public.seoul_today();
  v_start date;
  v_end date;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v FROM public.ad_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending orders can be confirmed' USING ERRCODE = 'check_violation';
  END IF;

  -- 시작일이 이미 지났으면 오늘부터 같은 기간 (예약 기간 안 입금이면 원래 시작일)
  v_start := greatest(coalesce(v.starts_on, v_today), v_today);
  v_end := (v_start + make_interval(months => v.contract_months))::date;
  IF public.ad_slots_taken(v.product_id, v.region, v_start, v_end, v.id) >=
     (SELECT max_slots FROM public.ad_products WHERE id = v.product_id) THEN
    RAISE EXCEPTION 'no ad slots available' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.ad_orders SET
    status = CASE WHEN v_start <= v_today THEN 'active' ELSE 'paid' END,
    paid_at = coalesce(p_paid_on::timestamptz, now()),
    activated_at = CASE WHEN v_start <= v_today THEN now() ELSE NULL END,
    starts_on = v_start,
    ends_on = v_end,
    expires_at = (v_end::timestamp AT TIME ZONE 'Asia/Seoul'),
    reserved_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.sync_lawyer_ad_tiers();
  RETURN (SELECT to_jsonb(o) FROM public.ad_orders o WHERE o.id = p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_confirm_ad_payment(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_ad_payment(text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_ad_order(p_order_id text, p_reason text, p_refund_amount integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.ad_orders%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO v FROM public.ad_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v.status NOT IN ('pending', 'paid', 'active') THEN
    RAISE EXCEPTION 'order already closed' USING ERRCODE = 'check_violation';
  END IF;
  IF p_refund_amount IS NOT NULL AND (p_refund_amount < 0 OR p_refund_amount > coalesce(v.total_amount, v.total_price, 0)) THEN
    RAISE EXCEPTION 'invalid refund amount' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.ad_orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = left(btrim(p_reason), 300),
    refund_amount = CASE WHEN v.status = 'pending' THEN NULL ELSE p_refund_amount END,
    reserved_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.sync_lawyer_ad_tiers();
  RETURN (SELECT to_jsonb(o) FROM public.ad_orders o WHERE o.id = p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_cancel_ad_order(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_ad_order(text, text, integer) TO authenticated;

-- 8) 고객 사이트용 노출 목록 (금액·사업자 정보 없음) -----------------------------
CREATE OR REPLACE FUNCTION public.public_active_ad_placements()
RETURNS TABLE (lawyer_id text, placement text, region text, ends_on date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.lawyer_id, o.placement, o.region, o.ends_on
  FROM public.ad_orders o
  WHERE o.status = 'active'
    AND o.starts_on <= public.seoul_today()
    AND o.ends_on > public.seoul_today();
$$;
GRANT EXECUTE ON FUNCTION public.public_active_ad_placements() TO anon, authenticated;

-- 9) 매일 생애 주기 실행 (00:05 KST = 15:05 UTC) ----------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_ad_order_lifecycle';
  PERFORM cron.schedule('mykim_ad_order_lifecycle', '5 15 * * *', 'SELECT public.run_ad_order_lifecycle()');
END $$;
