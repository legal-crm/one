-- SL-2 영업 DB 자동 접수 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a7', 'test_owner_g1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a8', 'test_owner_g2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-g1', 'TEST_G1'), ('test-lawyer-g2', 'TEST_G2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a7', 'test-lawyer-g1', 'g1', true),
  ('00000000-0000-4000-8000-0000000000a8', 'test-lawyer-g2', 'g2', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated, service_role;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := create_sales_lead_source('test-lawyer-g1', 'TEST 네이버 랜딩');
  INSERT INTO t_vars VALUES ('key', r ->> 'key'), ('src', r ->> 'id');
  IF (r ->> 'key') NOT LIKE 'mkl_%' THEN RAISE EXCEPTION 'FAIL key %', r; END IF;
  IF (SELECT count(*) FROM sales_lead_sources WHERE key_hash = (r ->> 'key')) <> 0 THEN RAISE EXCEPTION 'FAIL plaintext stored'; END IF;
  BEGIN
    PERFORM intake_sales_lead(r ->> 'key', '{"customerName":"x","phone":"01012345678"}');
    RAISE EXCEPTION 'FAIL authenticated can call intake';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS source create (hash only) + intake not callable by users';
END $$;
RESET ROLE;

-- 다른 사무소는 키 만들기·목록 보기 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM sales_lead_sources) <> 0 THEN RAISE EXCEPTION 'FAIL cross office source read'; END IF;
  BEGIN
    PERFORM create_sales_lead_source('test-lawyer-g1', 'x');
    RAISE EXCEPTION 'FAIL cross office create';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 서버 함수(service role)로 접수
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; v_key text := (SELECT v FROM t_vars WHERE k = 'key'); BEGIN
  r := intake_sales_lead('mkl_wrong', '{"customerName":"TEST","phone":"01012345678"}');
  IF (r ->> 'code') <> 'invalid_key' THEN RAISE EXCEPTION 'FAIL wrong key %', r; END IF;
  r := intake_sales_lead(v_key, '{"customerName":"","phone":"010"}');
  IF (r ->> 'code') <> 'invalid_lead' THEN RAISE EXCEPTION 'FAIL invalid lead %', r; END IF;
  r := intake_sales_lead(v_key, '{"customerName":"TEST접수","phone":"010-1234-5678","debtTotal":"5000","caseType":"개인회생","utm":{"source":"naver"}}');
  IF (r ->> 'result') <> 'created' THEN RAISE EXCEPTION 'FAIL create %', r; END IF;
  r := intake_sales_lead(v_key, '{"customerName":"TEST접수","phone":"01012345678","specialMemo":"다시 문의"}');
  IF (r ->> 'result') <> 'duplicate' THEN RAISE EXCEPTION 'FAIL duplicate %', r; END IF;
  RAISE NOTICE 'PASS intake key/validation/create/reinquiry';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM sales_leads WHERE office_id = 'test-lawyer-g1') <> 1 THEN RAISE EXCEPTION 'FAIL lead count'; END IF;
  IF (SELECT (data ->> 'reinquiryCount')::int FROM sales_leads WHERE office_id = 'test-lawyer-g1') <> 1 THEN RAISE EXCEPTION 'FAIL reinquiry count'; END IF;
  IF (SELECT data ->> 'phone' FROM sales_leads WHERE office_id = 'test-lawyer-g1') <> '010-1234-5678' THEN RAISE EXCEPTION 'FAIL phone format'; END IF;
  IF (SELECT received_count FROM sales_lead_sources WHERE id = (SELECT v::uuid FROM t_vars WHERE k = 'src')) <> 2 THEN RAISE EXCEPTION 'FAIL counter'; END IF;
  RAISE NOTICE 'PASS stored lead + counters';
END $$;

-- 키 폐기 후 접수 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT revoke_sales_lead_source((SELECT v::uuid FROM t_vars WHERE k = 'src'));
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF (intake_sales_lead((SELECT v FROM t_vars WHERE k = 'key'), '{"customerName":"TEST","phone":"01099998888"}') ->> 'code') <> 'invalid_key' THEN
    RAISE EXCEPTION 'FAIL revoked key accepted';
  END IF;
  RAISE NOTICE 'PASS revoked key rejected';
END $$;
RESET ROLE;

ROLLBACK;
