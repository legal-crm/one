-- ============================================================================
-- 024. 광고 주문(ad_orders) 테이블 + RLS (PART 3-4)
-- ----------------------------------------------------------------------------
-- 앱(adOrderService)은 ad_orders에 insert/update를 시도했지만 어떤 마이그레이션에도 테이블이 없었다.
-- 그래서 오류(42P01)를 삼키고 각 브라우저 localStorage에만 저장했고,
-- 관리자는 다른 기기에서 신청된 광고를 볼 수 없었다.
--   * 변호사: 본인(lawyer_accounts.lawyer_id) 주문만 조회, 'pending' 상태로만 신청 가능
--   * 상태 변경(입금 확인·활성화·취소)과 세금계산서 정보: 관리자(aal2)만
-- 선행: 012(lawyer_accounts), 018(current_lawyer_profile_id), 021(is_platform_admin, request_client_ip)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ad_orders (
  id                   TEXT PRIMARY KEY,
  lawyer_id            TEXT NOT NULL,
  lawyer_name          TEXT,
  product_id           TEXT,
  product_name         TEXT,
  contract_months      INTEGER NOT NULL DEFAULT 1 CHECK (contract_months BETWEEN 1 AND 36),
  monthly_price        INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  total_price          INTEGER NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'active', 'expired', 'cancelled')),
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ,
  activated_at         TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  depositor_name       TEXT,
  region               TEXT,
  tax_invoice          JSONB,
  modified_tax_invoice JSONB,
  buyer_corp_num       TEXT,
  buyer_corp_name      TEXT,
  buyer_ceo_name       TEXT,
  buyer_email          TEXT,
  created_by           UUID DEFAULT auth.uid(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_orders_lawyer ON ad_orders (lawyer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_orders_status ON ad_orders (status, requested_at DESC);

ALTER TABLE ad_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_orders_select_own_or_admin" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_insert_own_pending" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_update_admin" ON ad_orders;
DROP POLICY IF EXISTS "ad_orders_delete_admin" ON ad_orders;

CREATE POLICY "ad_orders_select_own_or_admin" ON ad_orders
  FOR SELECT TO authenticated
  USING (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin());

-- 변호사는 본인 이름으로 '입금 대기' 주문만 만들 수 있음 (결제·활성 상태로 직접 생성 불가)
CREATE POLICY "ad_orders_insert_own_pending" ON ad_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (
      lawyer_id = public.current_lawyer_profile_id()
      AND status = 'pending'
      AND paid_at IS NULL AND activated_at IS NULL AND expires_at IS NULL
      AND tax_invoice IS NULL AND modified_tax_invoice IS NULL
    )
  );

CREATE POLICY "ad_orders_update_admin" ON ad_orders
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "ad_orders_delete_admin" ON ad_orders
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- 상태 변경 서버 감사 기록
CREATE OR REPLACE FUNCTION public.ad_orders_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.paid_at IS DISTINCT FROM OLD.paid_at) THEN
    INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, detail, auth_uid, auth_email, ip_address)
    VALUES (
      coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'system'),
      CASE WHEN public.is_platform_admin() THEN 'admin' ELSE 'system' END,
      'ad_order_status', 'ad_order', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'paid_at', NEW.paid_at, 'total_price', NEW.total_price),
      auth.uid(), auth.jwt() ->> 'email', public.request_client_ip()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_orders_audit ON ad_orders;
CREATE TRIGGER trg_ad_orders_audit
  BEFORE UPDATE ON ad_orders
  FOR EACH ROW EXECUTE FUNCTION public.ad_orders_audit();

COMMIT;

-- 확인
--   변호사 세션: INSERT (status='active') → RLS 오류, INSERT (status='pending', 본인 lawyer_id) → 성공
--   변호사 세션: UPDATE ad_orders SET status='active' → 0행
--   관리자(aal2): SELECT * FROM ad_orders → 전체
