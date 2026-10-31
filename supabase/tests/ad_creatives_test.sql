-- 광고 소재·심사·노출 시작 조건·알림·노출 집계 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e5', 'test_owner_k1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e6', 'test_owner_k2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e9', 'test_admin_k@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-k1', 'TEST_K1'), ('test-lawyer-k2', 'TEST_K2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e5', 'test-lawyer-k1', 'k1', true),
  ('00000000-0000-4000-8000-0000000000e6', 'test-lawyer-k2', 'k2', true);
UPDATE ad_products SET max_slots = 50 WHERE id = 'ad-main-banner';
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('ad-media', 'test-lawyer-k1/c1/banner.webp', '00000000-0000-4000-8000-0000000000e5'),
  ('ad-media', 'test-lawyer-k1/c2/banner.webp', '00000000-0000-4000-8000-0000000000e5');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c ad_creatives; o jsonb; BEGIN
  BEGIN
    PERFORM submit_ad_creative('test-lawyer-k1', '{"lawyer_id":"test-lawyer-k1","kind":"banner","headline":"x","alt_text":"x","image_path":"other-office/x.webp"}');
    RAISE EXCEPTION 'FAIL other folder accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM submit_ad_creative('test-lawyer-k2', '{"lawyer_id":"test-lawyer-k2","kind":"banner","headline":"x","alt_text":"x","image_path":"test-lawyer-k2/x.webp"}');
    RAISE EXCEPTION 'FAIL other office submit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  c := submit_ad_creative('test-lawyer-k1', '{"lawyer_id":"test-lawyer-k1","kind":"banner","headline":"인가율 98% 최고 전담","alt_text":"TEST 배너","image_path":"test-lawyer-k1/c1/banner.webp"}');
  IF c.status <> 'pending' OR cardinality(c.warnings) < 3 THEN RAISE EXCEPTION 'FAIL submit/warnings %', c; END IF;
  o := create_ad_order('test-lawyer-k1', 'ad-main-banner', 1, seoul_today(), NULL, 'TEST입금');
  PERFORM set_ad_order_creative(o ->> 'id', c.id);
  RAISE NOTICE 'PASS submit + warnings + order creative';
END $$;
RESET ROLE;

-- 승인 전 소재 파일은 누구나 읽을 수 없다
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'ad-media') THEN RAISE EXCEPTION 'FAIL anon sees pending media'; END IF;
  RAISE NOTICE 'PASS pending media hidden';
END $$;
RESET ROLE;

-- 관리자 입금 확인: 소재 승인 전이라 '시작 예정'(paid)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; v_id text; c ad_creatives; BEGIN
  SELECT id INTO v_id FROM ad_orders WHERE lawyer_id = 'test-lawyer-k1' AND status = 'pending';
  o := admin_confirm_ad_payment(v_id);
  IF o ->> 'status' <> 'paid' THEN RAISE EXCEPTION 'FAIL main banner started without approved creative %', o ->> 'status'; END IF;
  BEGIN
    PERFORM admin_review_ad_creative((SELECT id FROM ad_creatives WHERE office_id = 'test-lawyer-k1' LIMIT 1), 'reject', NULL);
    RAISE EXCEPTION 'FAIL reject without reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  c := admin_review_ad_creative((SELECT id FROM ad_creatives WHERE office_id = 'test-lawyer-k1' LIMIT 1), 'approve');
  IF c.status <> 'approved' THEN RAISE EXCEPTION 'FAIL approve'; END IF;
  IF (SELECT status FROM ad_orders WHERE id = v_id) <> 'active' THEN RAISE EXCEPTION 'FAIL not started after approval'; END IF;
  RAISE NOTICE 'PASS start waits for approved creative';
END $$;
RESET ROLE;

-- 고객: 홈 슬라이드·승인 파일 읽기·노출 집계
SET LOCAL ROLE anon;
DO $$ DECLARE n int; v_order text; BEGIN
  SELECT order_id INTO v_order FROM public_home_ad_slides() WHERE lawyer_id = 'test-lawyer-k1';
  IF v_order IS NULL THEN RAISE EXCEPTION 'FAIL slide missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'ad-media' AND name = 'test-lawyer-k1/c1/banner.webp') THEN RAISE EXCEPTION 'FAIL approved media hidden'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'ad-media' AND name = 'test-lawyer-k1/c2/banner.webp') THEN RAISE EXCEPTION 'FAIL unrelated media visible'; END IF;
  n := record_ad_events(jsonb_build_array(jsonb_build_object('order_id', v_order, 'kind', 'impression'),
        jsonb_build_object('order_id', v_order, 'kind', 'profile_open'), jsonb_build_object('order_id', 'nope', 'kind', 'impression'),
        jsonb_build_object('order_id', v_order, 'kind', 'consult_request')));
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL events counted %', n; END IF;
  RAISE NOTICE 'PASS home slides + approved media + stats';
END $$;
RESET ROLE;

-- 사무소: 집계·알림, 고친 소재는 승인될 때까지 이전 소재로 노출
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s record; c ad_creatives; v_old uuid; BEGIN
  SELECT * INTO s FROM office_ad_stats('test-lawyer-k1') LIMIT 1;
  IF s.impressions <> 1 OR s.profile_opens <> 1 THEN RAISE EXCEPTION 'FAIL office stats %', s; END IF;
  SELECT id INTO v_old FROM ad_creatives WHERE office_id = 'test-lawyer-k1' AND status = 'approved';
  c := submit_ad_creative('test-lawyer-k1', jsonb_build_object('lawyer_id', 'test-lawyer-k1', 'kind', 'banner', 'headline', 'TEST 새 문구', 'alt_text', 'TEST', 'image_path', 'test-lawyer-k1/c2/banner.webp', 'replaces_id', v_old));
  IF (SELECT count(*) FROM public_home_ad_slides() WHERE lawyer_id = 'test-lawyer-k1') <> 1 THEN RAISE EXCEPTION 'FAIL slide lost during re-review'; END IF;
  RAISE NOTICE 'PASS stats + re-review keeps old creative';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e5' AND kind IN ('ad_order_paid', 'ad_order_active', 'ad_creative_review')) THEN
    RAISE EXCEPTION 'FAIL office ad notifications';
  END IF;
  RAISE NOTICE 'PASS ad notifications';
END $$;
ROLLBACK;
