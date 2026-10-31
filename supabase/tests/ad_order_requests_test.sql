-- AD-7·AD-8 신청 취소·연장·환불 요청 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_owner_e2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e9', 'test_admin_e@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e1', 'TEST_E1'), ('test-lawyer-e2', 'TEST_E2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-e1', 'e1', true),
  ('00000000-0000-4000-8000-0000000000e2', 'test-lawyer-e2', 'e2', true);
UPDATE ad_products SET max_slots = 5 WHERE id = 'ad-top-exposure';
UPDATE ad_promotions SET active = false WHERE id = 'open_launch';

-- e1: 입금 전 취소, 다시 신청
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  o := create_ad_order('test-lawyer-e1', 'ad-top-exposure', 1, seoul_today(), NULL, NULL);
  o := ad_cancel_my_order(o ->> 'id');
  IF o ->> 'status' <> 'cancelled' THEN RAISE EXCEPTION 'FAIL cancel %', o; END IF;
  BEGIN
    PERFORM ad_request_refund(o ->> 'id', 'TEST 사유');
    RAISE EXCEPTION 'FAIL refund on cancelled';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  o := create_ad_order('test-lawyer-e1', 'ad-top-exposure', 1, seoul_today(), NULL, NULL);
  PERFORM set_config('test.order_id', o ->> 'id', true);
  RAISE NOTICE 'PASS lawyer cancel before payment';
END $$;
RESET ROLE;

-- 관리자 입금 확인 → 노출 중
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  o := admin_confirm_ad_payment(current_setting('test.order_id'), NULL);
  IF o ->> 'status' <> 'active' THEN RAISE EXCEPTION 'FAIL confirm %', o; END IF;
END $$;
RESET ROLE;

-- e1: 일할 환불 계산·요청·중복 금지·연장
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE q jsonb; r jsonb; n jsonb; o ad_orders; v_days int; BEGIN
  SELECT * INTO o FROM ad_orders WHERE id = current_setting('test.order_id');
  v_days := o.ends_on - o.starts_on;
  q := ad_refund_quote(o.id);
  IF q ->> 'rule' <> 'prorated' OR (q ->> 'amount')::int <> floor(330000::numeric * (v_days - 1) / v_days)::int THEN RAISE EXCEPTION 'FAIL quote %', q; END IF;
  BEGIN
    PERFORM ad_request_refund(o.id, ' ');
    RAISE EXCEPTION 'FAIL empty reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := ad_request_refund(o.id, 'TEST 사무소 사정');
  IF (r ->> 'suggested_refund')::int <> (q ->> 'amount')::int THEN RAISE EXCEPTION 'FAIL suggested %', r; END IF;
  BEGIN
    PERFORM ad_request_refund(o.id, 'TEST 다시');
    RAISE EXCEPTION 'FAIL duplicate request';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  n := ad_renew_order(o.id, 1, NULL);
  IF n ->> 'status' <> 'pending' OR (n ->> 'starts_on')::date <> o.ends_on OR n ->> 'renewed_from' <> o.id THEN RAISE EXCEPTION 'FAIL renew %', n; END IF;
  BEGIN
    PERFORM ad_renew_order(o.id, 1, NULL);
    RAISE EXCEPTION 'FAIL double renew';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS prorated quote + refund request + renew';
END $$;
RESET ROLE;

-- e2: 다른 사무소 요청은 안 보이고 처리 못 함
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM ad_order_requests) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    PERFORM ad_request_refund(current_setting('test.order_id'), 'TEST 남의 주문');
    RAISE EXCEPTION 'FAIL other office refund';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM admin_resolve_ad_request((SELECT gen_random_uuid()), 'approve', NULL, NULL);
    RAISE EXCEPTION 'FAIL non-admin resolve';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office isolation';
END $$;
RESET ROLE;

-- 관리자: 오늘 할 일에 보임 → 승인하면 주문 취소 + 환불액
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; v_req uuid; v_s int; BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(admin_todo_items()) e WHERE e ->> 'key' = 'ad_refund_request') THEN RAISE EXCEPTION 'FAIL todo item'; END IF;
  SELECT id, suggested_refund INTO v_req, v_s FROM ad_order_requests WHERE order_id = current_setting('test.order_id') AND status = 'open';
  r := admin_resolve_ad_request(v_req, 'approve', NULL, NULL);
  IF r ->> 'status' <> 'approved' OR (r ->> 'refund_amount')::int <> v_s THEN RAISE EXCEPTION 'FAIL resolve %', r; END IF;
  IF (SELECT status FROM ad_orders WHERE id = current_setting('test.order_id')) <> 'cancelled'
     OR (SELECT refund_amount FROM ad_orders WHERE id = current_setting('test.order_id')) <> v_s THEN RAISE EXCEPTION 'FAIL order not refunded'; END IF;
  BEGIN
    PERFORM admin_resolve_ad_request(v_req, 'reject', NULL, 'x');
    RAISE EXCEPTION 'FAIL resolve twice';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS admin approve refund';
END $$;
RESET ROLE;

ROLLBACK;
