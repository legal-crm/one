-- 광고 세금계산서 사무소 열람·서버 기록 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_ti1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_owner_ti2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ti1', 'TEST_TI1'), ('test-lawyer-ti2', 'TEST_TI2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-ti1', 'ti1', true),
  ('00000000-0000-4000-8000-0000000000e2', 'test-lawyer-ti2', 'ti2', true);
UPDATE ad_products SET max_slots = 50 WHERE id = 'ad-top-exposure';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO office_billing_profiles (office_id, corp_num, corp_name, ceo_name, email)
VALUES ('test-lawyer-ti1', '123-45-67890', 'TEST 법률사무소', 'TEST', 'tax@example.test');
CREATE TEMP TABLE t_order ON COMMIT DROP AS SELECT (create_ad_order('test-lawyer-ti1', 'ad-top-exposure', 1, seoul_today() + 3, NULL, 'TEST')) ->> 'id' AS id;
RESET ROLE;

DO $$ DECLARE t jsonb; v_id text; BEGIN
  SELECT id INTO v_id FROM t_order;
  t := ad_order_invoice_target(v_id);
  IF (t ->> 'supply')::int <> 300000 OR (t ->> 'vat')::int <> 30000 OR (t ->> 'has_invoice')::boolean THEN RAISE EXCEPTION 'FAIL target %', t; END IF;
  IF NOT record_ad_order_invoice(v_id, 'issue', '{"itemKey":"AD-TEST1","supplyCost":300000}'::jsonb) THEN RAISE EXCEPTION 'FAIL record'; END IF;
  IF record_ad_order_invoice(v_id, 'issue', '{"itemKey":"AD-OTHER"}'::jsonb) THEN RAISE EXCEPTION 'FAIL overwrite'; END IF;
  IF ad_invoice_view_key(v_id, '00000000-0000-4000-8000-0000000000e1', 'issue') <> 'AD-TEST1' THEN RAISE EXCEPTION 'FAIL owner key'; END IF;
  IF ad_invoice_view_key(v_id, '00000000-0000-4000-8000-0000000000e2', 'issue') IS NOT NULL THEN RAISE EXCEPTION 'FAIL other office key'; END IF;
  RAISE NOTICE 'PASS invoice target, record once, office-only view key';
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM ad_invoice_view_key('x', '00000000-0000-4000-8000-0000000000e1', 'issue');
    RAISE EXCEPTION 'FAIL authenticated can call view key';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS server-only functions';
END $$;
RESET ROLE;
ROLLBACK;
