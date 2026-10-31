-- AD-7 연장 구좌 우선 유지 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test_owner_h1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'test_owner_h2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-h1', 'TEST_H1'), ('test-lawyer-h2', 'TEST_H2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-lawyer-h1', 'h1', true),
  ('00000000-0000-4000-8000-0000000000f2', 'test-lawyer-h2', 'h2', true);
UPDATE ad_products SET max_slots = 1 WHERE id = 'ad-top-exposure';
UPDATE ad_promotions SET active = false WHERE id = 'open_launch';
-- h1: 5일 뒤 끝나는 노출 중 광고
INSERT INTO ad_orders (id, lawyer_id, office_id, product_id, placement, contract_months, monthly_price, total_price, total_amount, status, starts_on, ends_on)
VALUES ('test-hold-1', 'test-lawyer-h1', 'test-lawyer-h1', 'ad-top-exposure', 'top_exposure', 1, 1, 1, 1, 'active', seoul_today() - 25, seoul_today() + 5);

-- h2: 끝나는 날부터 신청 → 연장 대기 구좌라 막힘
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM create_ad_order('test-lawyer-h2', 'ad-top-exposure', 1, seoul_today() + 5, NULL, NULL);
    RAISE EXCEPTION 'FAIL hold ignored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- 잡아 두는 14일이 지난 뒤 시작이면 가능
  PERFORM create_ad_order('test-lawyer-h2', 'ad-top-exposure', 1, seoul_today() + 20, NULL, NULL);
  RAISE NOTICE 'PASS hold blocks others only during hold window';
END $$;
RESET ROLE;

-- h1: 연장은 들어감 (h2 예약은 20일 뒤 시작이라 h1 연장 1개월과 겹침 → 구좌 1개라 막혀야 정상)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM ad_renew_order('test-hold-1', 1, NULL);
    RAISE EXCEPTION 'FAIL overlap with existing reservation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS renewal still respects real reservations';
END $$;
RESET ROLE;
-- h2 예약을 지우면 h1 연장 가능
DELETE FROM ad_orders WHERE lawyer_id = 'test-lawyer-h2';
SET LOCAL ROLE authenticated;
DO $$ DECLARE n jsonb; BEGIN
  n := ad_renew_order('test-hold-1', 1, NULL);
  IF n ->> 'status' <> 'pending' THEN RAISE EXCEPTION 'FAIL renew %', n; END IF;
  RAISE NOTICE 'PASS holder renews into held slot';
END $$;
RESET ROLE;
ROLLBACK;
