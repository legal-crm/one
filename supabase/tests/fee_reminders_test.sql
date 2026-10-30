-- FE-7 수임료 납부 안내 예약 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_owner_r1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'test_owner_r2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-r1', 'TEST_R1'), ('test-lawyer-r2', 'TEST_R2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test-lawyer-r1', 'r1', true),
  ('00000000-0000-4000-8000-0000000000c2', 'test-lawyer-r2', 'r2', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated, service_role;

-- 대표: 사건 2개 (A: 3일 뒤 납부 300,000원 / B: 어제 기한 + 연락처 없음), 자동 안내 켜기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE a cases; b cases; BEGIN
  a := create_case('test-lawyer-r1', '{"case_type":"rehab","source":"direct","display_name":"TEST_A","phone":"010-1234-5678"}');
  b := create_case('test-lawyer-r1', '{"case_type":"rehab","source":"direct","display_name":"TEST_B"}');
  INSERT INTO t_vars VALUES ('a', a.id::text), ('b', b.id::text);
  PERFORM set_fee_agreement(a.id, 500000, jsonb_build_array(
    jsonb_build_object('label', '1회차', 'due_on', (seoul_today() + 3)::text, 'amount_won', 300000),
    jsonb_build_object('label', '2회차', 'due_on', (seoul_today() + 33)::text, 'amount_won', 200000)));
  PERFORM set_fee_agreement(b.id, 100000, jsonb_build_array(
    jsonb_build_object('label', '1회차', 'due_on', (seoul_today() - 1)::text, 'amount_won', 100000)));
  PERFORM set_fee_deposit_account('test-lawyer-r1', NULL, 'TESTBANK', '110-123-456789', 'TEST OFFICE');
  BEGIN
    PERFORM set_fee_reminder_settings('test-lawyer-r1', '{"enabled":true,"send_hour":21}');
    RAISE EXCEPTION 'FAIL bad hour';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM set_fee_reminder_settings('test-lawyer-r1', '{"enabled":true,"send_hour":10}');
  RAISE NOTICE 'PASS owner setup + settings';
END $$;
RESET ROLE;

-- 다른 사무소: 설정 못 바꾸고 기록 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM set_fee_reminder_settings('test-lawyer-r1', '{"enabled":false}');
    RAISE EXCEPTION 'FAIL cross office settings';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM plan_fee_reminders();
    RAISE EXCEPTION 'FAIL user can plan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS cross office blocked';
END $$;
RESET ROLE;

-- 정기 작업: 오늘 보낼 것 = A 1회차 D-3, B 1회차 다음 날 (2건), 다시 돌려도 늘지 않음
DO $$ BEGIN
  IF plan_fee_reminders() <> 2 THEN RAISE EXCEPTION 'FAIL plan count'; END IF;
  IF plan_fee_reminders() <> 0 THEN RAISE EXCEPTION 'FAIL plan duplicate'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fee_reminders WHERE case_id = (SELECT v::uuid FROM t_vars WHERE k = 'a') AND kind = 'd_minus_3') THEN RAISE EXCEPTION 'FAIL d-3 row'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fee_reminders WHERE case_id = (SELECT v::uuid FROM t_vars WHERE k = 'b') AND kind = 'd_plus_1') THEN RAISE EXCEPTION 'FAIL d+1 row'; END IF;
  RAISE NOTICE 'PASS plan';
END $$;

-- 서버 함수(service_role): 밤에는 0건, 오후 2시에는 A만 (B는 연락처 없음 → 건너뜀)
SET LOCAL ROLE service_role;
DO $$ DECLARE n int; r record; v_day timestamptz := (seoul_today()::text || ' 14:00:00+09')::timestamptz; BEGIN
  IF (SELECT count(*) FROM claim_fee_reminders(50, (seoul_today()::text || ' 22:00:00+09')::timestamptz)) <> 0 THEN RAISE EXCEPTION 'FAIL night send'; END IF;
  SELECT count(*) INTO n FROM claim_fee_reminders(50, v_day);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL claim count %', n; END IF;
  SELECT * INTO r FROM fee_reminders WHERE status = 'sending';
  IF r.amount_won <> 300000 THEN RAISE EXCEPTION 'FAIL amount'; END IF;
  PERFORM finish_fee_reminder(r.id, 'sent', 'alimtalk', 'TEST-1', NULL);
  IF (SELECT status FROM fee_reminders WHERE id = r.id) <> 'sent' THEN RAISE EXCEPTION 'FAIL finish'; END IF;
  IF (SELECT error FROM fee_reminders WHERE case_id = (SELECT v::uuid FROM t_vars WHERE k = 'b')) <> '의뢰인 휴대폰 번호가 없습니다' THEN RAISE EXCEPTION 'FAIL skip no phone'; END IF;
  IF (SELECT count(*) FROM claim_fee_reminders(50, v_day)) <> 0 THEN RAISE EXCEPTION 'FAIL resend'; END IF;
  IF NOT check_cron_token((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mykim_cron_token')) OR check_cron_token('x') THEN RAISE EXCEPTION 'FAIL token'; END IF;
  RAISE NOTICE 'PASS claim + finish + skip + token';
END $$;
RESET ROLE;

-- 대표: 기록 보기, 끄면 남은 안내 취소
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM fee_reminders) <> 2 THEN RAISE EXCEPTION 'FAIL office read'; END IF;
  BEGIN
    PERFORM claim_fee_reminders(1);
    RAISE EXCEPTION 'FAIL user claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS office read + claim blocked';
END $$;
RESET ROLE;

ROLLBACK;
