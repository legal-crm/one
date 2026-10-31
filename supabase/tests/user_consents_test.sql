-- 동의 기록·철회·약관 버전 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c0', 'test_admin_uc0@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_uc1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 'test_client_uc3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c4', 'test_client_uc4@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
VALUES ('test-lawyer-uc1', 'TEST_UC1', 'TEST 사무소', '서울', 'https://example.test/a.webp', '["개인회생"]'::jsonb, repeat('개인회생과 파산 상담을 합니다. ', 4));
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-uc1', 'uc1', true);
INSERT INTO consult_requests (id, client_id, client_name, status, financial_profile)
VALUES ('test-req-uc', '00000000-0000-4000-8000-0000000000c3', 'TEST가명', 'requested', '{"debtTotal":5000}');

-- 의뢰인: 로그인 동의 기록, 변호사 요청 → 정보 제공 동의 줄, 철회 → 요청 취소
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; r jsonb; v uuid; BEGIN
  n := record_my_consents('[{"kind":"terms","version":"tos-2026-09-30"},{"kind":"privacy","version":"privacy-2026-09-30"}]'::jsonb);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL login consents %', n; END IF;
  n := record_my_consents('[{"kind":"terms","version":"tos-2026-09-30"}]'::jsonb);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL duplicate login consent'; END IF;
  BEGIN
    PERFORM record_my_consents('[{"kind":"terms","version":"made-up"}]'::jsonb);
    RAISE EXCEPTION 'FAIL unknown version';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM client_request_lawyers('test-req-uc', ARRAY['test-lawyer-uc1'], 'third-party-2026-09-30');
  SELECT id INTO v FROM my_consents() WHERE kind = 'third_party' AND lawyer_id = 'test-lawyer-uc1';
  IF v IS NULL THEN RAISE EXCEPTION 'FAIL third party consent row'; END IF;
  BEGIN
    UPDATE user_consents SET version = 'x' WHERE id = v;
    RAISE EXCEPTION 'FAIL consent editable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  r := withdraw_my_consent(v, 'test');
  IF r ->> 'effect' <> 'seat_withdrawn' THEN RAISE EXCEPTION 'FAIL withdraw effect %', r; END IF;
  IF (SELECT seat_status FROM my_consents() WHERE id = v) <> 'withdrawn' THEN RAISE EXCEPTION 'FAIL seat not withdrawn'; END IF;
  r := withdraw_my_consent(v, 'again');
  IF NOT coalesce((r ->> 'already')::boolean, false) THEN RAISE EXCEPTION 'FAIL second withdraw'; END IF;
  RAISE NOTICE 'PASS consents recorded, fixed, third-party withdrawal releases seat';
END $$;
RESET ROLE;

-- 다른 의뢰인: 남의 동의 못 봄·못 철회
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v uuid; BEGIN
  IF (SELECT count(*) FROM user_consents) <> 0 THEN RAISE EXCEPTION 'FAIL other client reads consents'; END IF;
  SELECT id INTO v FROM user_consents LIMIT 1;
  RAISE NOTICE 'PASS consents private';
END $$;
RESET ROLE;
DO $$ DECLARE v uuid; BEGIN
  SELECT id INTO v FROM user_consents WHERE user_id = '00000000-0000-4000-8000-0000000000c3' AND kind = 'terms';
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c4","role":"authenticated"}', true);
  BEGIN
    PERFORM withdraw_my_consent(v, NULL);
    RAISE EXCEPTION 'FAIL withdraw other user consent';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  RAISE NOTICE 'PASS cannot withdraw others';
END $$;

-- 관리자: 새 약관 게시(다시 동의) → 의뢰인에게 다시 동의 필요, 변호사·관리자는 대상 아님
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
SELECT admin_publish_legal_document('terms', 'tos-test-2099', 'TEST 이용약관', '/tos.html', '시험', '2099-01-01', true) IS NOT NULL AS published;
DO $$ BEGIN
  BEGIN
    PERFORM admin_publish_legal_document('terms', 'tos-test-2099', 'x', '/tos.html', NULL, '2099-01-01', false);
    RAISE EXCEPTION 'FAIL duplicate version';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM admin_consent_stats() WHERE kind = 'terms') THEN RAISE EXCEPTION 'FAIL stats'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM my_pending_reconsent() WHERE version = 'tos-test-2099') THEN RAISE EXCEPTION 'FAIL reconsent pending'; END IF;
  PERFORM record_my_consents('[{"kind":"terms","version":"tos-test-2099","source":"reconsent"}]'::jsonb);
  IF EXISTS (SELECT 1 FROM my_pending_reconsent()) THEN RAISE EXCEPTION 'FAIL reconsent cleared'; END IF;
  BEGIN
    PERFORM admin_publish_legal_document('terms', 'x', 'x', '/tos.html', NULL, '2099-01-01', false);
    RAISE EXCEPTION 'FAIL client publishes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS publish + reconsent flow';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM my_pending_reconsent()) THEN RAISE EXCEPTION 'FAIL lawyer asked to reconsent'; END IF;
  RAISE NOTICE 'PASS lawyer excluded from client reconsent';
END $$;
RESET ROLE;

-- 계정 삭제 연쇄는 막히지 않는다
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000c3';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM user_consents WHERE user_id = '00000000-0000-4000-8000-0000000000c3') THEN RAISE EXCEPTION 'FAIL cascade'; END IF;
  RAISE NOTICE 'PASS account delete cascade';
END $$;
ROLLBACK;
