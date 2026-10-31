-- SL-3·SL-12·SL-15~17 영업 DB 상태·수신 거부·거래처 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_s1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'test_owner_s2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-s1', 'TEST_S1'), ('test-lawyer-s2', 'TEST_S2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-s1', 's1', true),
  ('00000000-0000-4000-8000-0000000000c2', 'test-lawyer-s2', 's2', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated, service_role;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; v_vendor uuid; BEGIN
  -- 옛 상태는 새 상태로
  INSERT INTO sales_leads (id, office_id, data) VALUES
    ('test-l1', 'test-lawyer-s1', '{"customerName":"A","phone":"010-1111-2222","status":"no_answer_2"}'),
    ('test-l2', 'test-lawyer-s1', '{"customerName":"B","phone":"010-3333-4444","status":"ineligible"}'),
    ('test-l3', 'test-lawyer-s1', '{"customerName":"C","phone":"010-5555-6666","status":"closed"}');
  IF (SELECT status FROM sales_leads WHERE id = 'test-l1') <> 'no_answer' OR (SELECT (data ->> 'noAnswerCount')::int FROM sales_leads WHERE id = 'test-l1') <> 2 THEN RAISE EXCEPTION 'FAIL legacy no_answer'; END IF;
  IF (SELECT status FROM sales_leads WHERE id = 'test-l2') <> 'closed' OR (SELECT data ->> 'closeReason' FROM sales_leads WHERE id = 'test-l2') <> 'not_eligible' THEN RAISE EXCEPTION 'FAIL legacy ineligible'; END IF;
  IF (SELECT data ->> 'closeReason' FROM sales_leads WHERE id = 'test-l3') <> 'other' OR (SELECT closed_at FROM sales_leads WHERE id = 'test-l3') IS NULL THEN RAISE EXCEPTION 'FAIL closed needs reason'; END IF;
  -- 되살리면 종료 사유가 지워짐
  UPDATE sales_leads SET data = data || '{"status":"counseling"}' WHERE id = 'test-l3';
  IF (SELECT data ? 'closeReason' FROM sales_leads WHERE id = 'test-l3') OR (SELECT closed_at FROM sales_leads WHERE id = 'test-l3') IS NOT NULL THEN RAISE EXCEPTION 'FAIL reopen'; END IF;
  RAISE NOTICE 'PASS six states + legacy mapping';

  -- 수신 거부: 종료 사유 opt_out → 지문 보관, 같은 번호 새 리드는 종료로 들어옴
  UPDATE sales_leads SET data = data || '{"status":"closed","closeReason":"opt_out"}' WHERE id = 'test-l1';
  IF NOT check_sales_phone_suppressed('test-lawyer-s1', '01011112222') THEN RAISE EXCEPTION 'FAIL suppression saved'; END IF;
  INSERT INTO sales_leads (id, office_id, data) VALUES ('test-l4', 'test-lawyer-s1', '{"customerName":"A2","phone":"01011112222","status":"new"}');
  IF (SELECT status FROM sales_leads WHERE id = 'test-l4') <> 'closed' OR (SELECT data ->> 'closeReason' FROM sales_leads WHERE id = 'test-l4') <> 'opt_out' THEN RAISE EXCEPTION 'FAIL suppressed entry'; END IF;
  RAISE NOTICE 'PASS suppression';

  -- 거래처 + 접수 키 연결
  INSERT INTO sales_vendors (office_id, name, contract_type, replacement_days) VALUES ('test-lawyer-s1', 'TEST 대행사', 'monthly_fixed', 7) RETURNING id INTO v_vendor;
  BEGIN
    INSERT INTO sales_vendors (office_id, name, contract_type, per_lead_price) VALUES ('test-lawyer-s1', 'TEST 단가', 'per_lead', 30000);
    RAISE EXCEPTION 'FAIL per-lead without notice ack';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  r := create_sales_lead_source('test-lawyer-s1', 'TEST 대행 랜딩');
  PERFORM set_sales_source_vendor((r ->> 'id')::uuid, v_vendor);
  INSERT INTO t_vars VALUES ('key', r ->> 'key'), ('vendor', v_vendor::text);
  RAISE NOTICE 'PASS vendor + source link';
END $$;
RESET ROLE;

-- 다른 사무소는 거래처·설정 못 봄·못 씀
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM sales_vendors) <> 0 OR (SELECT count(*) FROM sales_suppression) <> 0 THEN RAISE EXCEPTION 'FAIL cross office read'; END IF;
  BEGIN
    INSERT INTO sales_vendors (office_id, name) VALUES ('test-lawyer-s1', 'x');
    RAISE EXCEPTION 'FAIL cross office write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM sales_funnel_stats('test-lawyer-s1', seoul_today() - 30, seoul_today());
    RAISE EXCEPTION 'FAIL cross office stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office isolation';
END $$;
RESET ROLE;

-- 접수: 거래처 표시·수신 거부 거절
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; v_key text := (SELECT v FROM t_vars WHERE k = 'key'); BEGIN
  r := intake_sales_lead(v_key, '{"customerName":"TEST대행","phone":"010-7777-8888","vendorLeadRef":"AG-1"}');
  IF r ->> 'result' <> 'created' THEN RAISE EXCEPTION 'FAIL intake %', r; END IF;
  r := intake_sales_lead(v_key, '{"customerName":"A","phone":"010-1111-2222"}');
  IF r ->> 'code' <> 'opted_out' THEN RAISE EXCEPTION 'FAIL suppressed intake %', r; END IF;
  RAISE NOTICE 'PASS intake vendor tag + opt-out rejected';
END $$;
RESET ROLE;

-- 교체 후보 → 요청 (이름·번호 없음) → 통계
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_vendor uuid := (SELECT v::uuid FROM t_vars WHERE k = 'vendor'); v_lead text; rq sales_vendor_replacements; s jsonb; BEGIN
  SELECT id INTO v_lead FROM sales_leads WHERE data ->> 'vendorLeadRef' = 'AG-1';
  IF (SELECT data ->> 'vendorId' FROM sales_leads WHERE id = v_lead) <> v_vendor::text THEN RAISE EXCEPTION 'FAIL vendor tag'; END IF;
  UPDATE sales_leads SET data = data || '{"status":"closed","closeReason":"wrong_number"}' WHERE id = v_lead;
  IF (SELECT count(*) FROM sales_vendor_replacement_candidates(v_vendor)) <> 1 THEN RAISE EXCEPTION 'FAIL candidates'; END IF;
  SELECT * INTO rq FROM request_sales_vendor_replacements(v_vendor, ARRAY[v_lead]) LIMIT 1;
  IF rq.vendor_lead_ref <> 'AG-1' OR rq.phone_last4 IS NOT NULL OR rq.reason <> 'wrong_number' THEN RAISE EXCEPTION 'FAIL request row %', to_jsonb(rq); END IF;
  IF (SELECT count(*) FROM sales_vendor_replacement_candidates(v_vendor)) <> 0 THEN RAISE EXCEPTION 'FAIL candidate after request'; END IF;
  PERFORM set_sales_vendor_replacement_result(rq.id, 'replaced', NULL);
  INSERT INTO sales_vendor_billings (office_id, vendor_id, month, media_cost, fee_amount) VALUES ('test-lawyer-s1', v_vendor, date_trunc('month', seoul_today())::date, 500000, 100000);
  s := sales_funnel_stats('test-lawyer-s1', seoul_today() - 30, seoul_today());
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'rows') e WHERE e ->> 'kind' = 'vendor' AND e ->> 'key' = v_vendor::text
                   AND (e ->> 'leads')::int = 1 AND (e ->> 'valid')::int = 0 AND (e ->> 'cost')::int = 600000) THEN RAISE EXCEPTION 'FAIL stats %', s; END IF;
  INSERT INTO sales_settings (office_id, data) VALUES ('test-lawyer-s1', '{"retry":{"maxAttempts":5}}');
  IF (SELECT version FROM sales_settings WHERE office_id = 'test-lawyer-s1') <> 1 THEN RAISE EXCEPTION 'FAIL settings'; END IF;
  RAISE NOTICE 'PASS replacements + billing + stats + settings';
END $$;
RESET ROLE;

ROLLBACK;
