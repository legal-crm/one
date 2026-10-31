-- 공용 채권자 정보 시험 (NF-5, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_cr1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_other_cr2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e9', 'test_admin_cr9@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cr1', 'TEST_CR1');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-cr1', 'cr1', true);

-- 익명도 활성 항목을 읽는다, 초기 47곳은 확인일 없음
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM creditor_registry) < 40 THEN RAISE EXCEPTION 'FAIL anon read'; END IF;
  IF EXISTS (SELECT 1 FROM creditor_registry WHERE verified_on IS NOT NULL) THEN RAISE EXCEPTION 'FAIL seed verified'; END IF;
  RAISE NOTICE 'PASS anon read';
END $$;
RESET ROLE;

-- 사무소 구성원: 직접 쓰기 막힘, 제안은 됨, 같은 항목 대기 중 두 번째 제안 막힘, 주민번호 형식 거절
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_id uuid;
BEGIN
  BEGIN
    UPDATE creditor_registry SET representative = 'X' WHERE id = 'kb_bank';
    IF FOUND THEN RAISE EXCEPTION 'FAIL direct update'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_id := suggest_creditor_registry_change('test-lawyer-cr1', 'kb_bank', '{"representative":"은행장 테스트","fax":"02-000-0000","bogus":"x"}', '홈페이지 확인');
  IF (SELECT changes ? 'bogus' FROM creditor_registry_suggestions WHERE id = v_id) THEN RAISE EXCEPTION 'FAIL unclean changes'; END IF;
  BEGIN
    PERFORM suggest_creditor_registry_change('test-lawyer-cr1', 'kb_bank', '{"phone":"1"}', '');
    RAISE EXCEPTION 'FAIL duplicate pending';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM suggest_creditor_registry_change('test-lawyer-cr1', NULL, '{"official_name":"홍길동","address":"900101-1234567"}', '');
    RAISE EXCEPTION 'FAIL rrn';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM admin_upsert_creditor_registry('kb_bank', '{"representative":"X"}');
    RAISE EXCEPTION 'FAIL non-admin upsert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS member suggest';
END $$;
RESET ROLE;

-- 사무소 구성원이 아니면 제안 못 함
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM suggest_creditor_registry_change('test-lawyer-cr1', 'kb_bank', '{"phone":"1"}', '');
    RAISE EXCEPTION 'FAIL non-member';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM creditor_registry_suggestions) THEN RAISE EXCEPTION 'FAIL other sees suggestions'; END IF;
  RAISE NOTICE 'PASS non-member blocked';
END $$;
RESET ROLE;

-- 관리자: 제안 반영 → 값·버전·확인일, 반려는 사유 필수, 비활성 항목은 일반 사용자에게 안 보임
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_s uuid; v_ver int;
BEGIN
  SELECT id INTO v_s FROM creditor_registry_suggestions WHERE registry_id = 'kb_bank' AND status = 'pending';
  SELECT version INTO v_ver FROM creditor_registry WHERE id = 'kb_bank';
  PERFORM admin_review_creditor_suggestion(v_s, true, '확인');
  IF (SELECT representative FROM creditor_registry WHERE id = 'kb_bank') <> '은행장 테스트' THEN RAISE EXCEPTION 'FAIL apply'; END IF;
  IF (SELECT version FROM creditor_registry WHERE id = 'kb_bank') <> v_ver + 1 THEN RAISE EXCEPTION 'FAIL version'; END IF;
  IF (SELECT verified_on FROM creditor_registry WHERE id = 'kb_bank') IS NULL THEN RAISE EXCEPTION 'FAIL verified_on'; END IF;
  IF jsonb_array_length(admin_list_creditor_suggestions('all')) < 1 THEN RAISE EXCEPTION 'FAIL list'; END IF;
  PERFORM admin_upsert_creditor_registry('test_new_creditor', '{"official_name":"주식회사 시험저축은행","category":"SAVINGS_BANK","aliases":["시험"]}');
  PERFORM admin_set_creditor_active('test_new_creditor', false);
  RAISE NOTICE 'PASS admin review';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM creditor_registry WHERE id = 'test_new_creditor') THEN RAISE EXCEPTION 'FAIL inactive visible'; END IF;
  RAISE NOTICE 'PASS inactive hidden';
END $$;
RESET ROLE;
ROLLBACK;
