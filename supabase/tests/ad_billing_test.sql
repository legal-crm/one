-- AD 광고 주문 서버화 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_owner_d1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'test_owner_d2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d9', 'test_admin_d@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-d1', 'TEST_D1'), ('test-lawyer-d2', 'TEST_D2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test-lawyer-d1', 'd1', true),
  ('00000000-0000-4000-8000-0000000000d2', 'test-lawyer-d2', 'd2', true);
-- 다른 시험 주문이 구좌를 차지하지 않게 상품 구좌를 넉넉히
UPDATE ad_products SET max_slots = 1 WHERE id = 'ad-top-exposure';

-- 가격: 12개월 장기 할인 20% (오픈 할인 꺼짐)
DO $$ DECLARE q jsonb; BEGIN
  q := ad_price_quote('ad-top-exposure', 12, seoul_today() + 1);
  IF (q ->> 'supply')::int <> 240000 * 12 THEN RAISE EXCEPTION 'FAIL supply %', q; END IF;
  IF (q ->> 'vat')::int <> 288000 THEN RAISE EXCEPTION 'FAIL vat %', q; END IF;
  RAISE NOTICE 'PASS price quote (VAT 별도, 장기 할인)';
END $$;

-- 오픈 할인 켬: 첫 2개월만 50%, 나머지는 장기 할인
UPDATE ad_promotions SET active = true, starts_on = seoul_today(), ends_on = seoul_today() + 59 WHERE id = 'open_launch';
DO $$ DECLARE q jsonb; BEGIN
  q := ad_price_quote('ad-top-exposure', 3, seoul_today());
  -- 1·2개월 150,000 + 3개월 270,000(10%)
  IF (q ->> 'supply')::int <> 150000 + 150000 + 270000 THEN RAISE EXCEPTION 'FAIL open promo %', q; END IF;
  RAISE NOTICE 'PASS open promo larger-of rule';
END $$;
UPDATE ad_promotions SET active = false WHERE id = 'open_launch';

-- 사무소 대표 d1: 주문 생성, 직접 INSERT 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  BEGIN
    INSERT INTO ad_orders (id, lawyer_id, product_id, contract_months, monthly_price, total_price, status)
    VALUES ('test-direct', 'test-lawyer-d1', 'ad-top-exposure', 1, 1, 1, 'pending');
    RAISE EXCEPTION 'FAIL direct insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO office_billing_profiles (office_id, corp_num, corp_name, ceo_name, email)
  VALUES ('test-lawyer-d1', '123-45-67890', 'TEST 법률사무소', 'TEST', 'tax@example.test');
  o := create_ad_order('test-lawyer-d1', 'ad-top-exposure', 1, seoul_today(), NULL, 'TEST입금');
  IF (o ->> 'total_amount')::int <> 330000 OR o ->> 'status' <> 'pending' THEN RAISE EXCEPTION 'FAIL create %', o; END IF;
  IF o ->> 'buyer_corp_num' <> '1234567890' THEN RAISE EXCEPTION 'FAIL billing snapshot %', o; END IF;
  IF (o ->> 'reserved_until')::timestamptz <= now() + interval '2 days' THEN RAISE EXCEPTION 'FAIL reservation'; END IF;
  BEGIN
    PERFORM create_ad_order('test-lawyer-d1', 'ad-top-exposure', 1, seoul_today(), NULL, NULL);
    RAISE EXCEPTION 'FAIL duplicate allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM create_ad_order('test-lawyer-d2', 'ad-top-exposure', 1, seoul_today(), NULL, NULL);
    RAISE EXCEPTION 'FAIL other office order';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS create_ad_order (server price, snapshot, reservation, duplicate, office check)';
END $$;
RESET ROLE;

-- 다른 사무소 d2: 구좌 1개가 예약돼 있어 실패, d1 주문은 안 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM ad_orders WHERE lawyer_id = 'test-lawyer-d1') <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    PERFORM create_ad_order('test-lawyer-d2', 'ad-top-exposure', 1, seoul_today(), NULL, NULL);
    RAISE EXCEPTION 'FAIL slot limit';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM admin_confirm_ad_payment((SELECT 'x'), NULL);
    RAISE EXCEPTION 'FAIL non-admin confirm';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS slot limit + RLS + admin only';
END $$;
RESET ROLE;

-- 관리자: 입금 확인 → 노출 중 + ad_tier, 노출 목록에 나타남
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; v_id text; BEGIN
  SELECT id INTO v_id FROM ad_orders WHERE lawyer_id = 'test-lawyer-d1';
  o := admin_confirm_ad_payment(v_id, NULL);
  IF o ->> 'status' <> 'active' THEN RAISE EXCEPTION 'FAIL confirm %', o; END IF;
  IF (SELECT ad_tier FROM lawyers WHERE id = 'test-lawyer-d1') <> 'top' THEN RAISE EXCEPTION 'FAIL ad_tier'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public_active_ad_placements() WHERE lawyer_id = 'test-lawyer-d1') THEN RAISE EXCEPTION 'FAIL placements'; END IF;
  o := admin_cancel_ad_order(v_id, 'TEST 환불', 100000);
  IF o ->> 'status' <> 'cancelled' OR (o ->> 'refund_amount')::int <> 100000 THEN RAISE EXCEPTION 'FAIL cancel %', o; END IF;
  IF (SELECT ad_tier FROM lawyers WHERE id = 'test-lawyer-d1') IS NOT NULL THEN RAISE EXCEPTION 'FAIL tier cleared'; END IF;
  RAISE NOTICE 'PASS admin confirm/cancel + ad_tier sync + placements';
END $$;
RESET ROLE;

-- 생애 주기: 입금 기한 지난 예약 자동 취소
DO $$ DECLARE r jsonb; BEGIN
  INSERT INTO ad_orders (id, lawyer_id, product_id, contract_months, monthly_price, total_price, status, starts_on, ends_on, reserved_until, placement)
  VALUES ('test-expired-res', 'test-lawyer-d2', 'ad-regional-top', 1, 1, 1, 'pending', seoul_today(), seoul_today() + 30, now() - interval '1 minute', 'regional');
  r := run_ad_order_lifecycle();
  IF (SELECT status FROM ad_orders WHERE id = 'test-expired-res') <> 'cancelled' THEN RAISE EXCEPTION 'FAIL lifecycle %', r; END IF;
  RAISE NOTICE 'PASS lifecycle auto-cancel';
END $$;

ROLLBACK;
