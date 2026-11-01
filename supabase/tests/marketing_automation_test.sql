-- 마케팅 자동화 수준 시험 (M-1, 시험 DB 전용, ROLLBACK)
-- dispatch_marketing_auto_publish()는 실제 외부 호출(pg_net)을 하므로 부르지 않는다
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM platform_config WHERE id = 'marketing_automation';
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000d1a9', 'test_admin_d1a9@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d1a1', 'test_user_d1a1@example.test', 'authenticated', 'authenticated', '{}'::jsonb);

-- 1) 저장값이 없으면 결정값(L2·엄격·90점·스레드·페이스북)
DO $$ DECLARE c jsonb := public.marketing_automation_config(); BEGIN
  IF c ->> 'level' <> 'L2' OR c ->> 'checkMode' <> 'strict' OR (c ->> 'minScore')::int <> 90
     OR c -> 'autoChannels' <> '["threads","facebook"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL defaults %', c;
  END IF;
  RAISE NOTICE 'PASS defaults L2 strict 90 threads+facebook';
END $$;

-- 2) 일반 사용자: 저장 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d1a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM admin_set_marketing_automation('{"level":"L2"}'::jsonb);
    RAISE EXCEPTION 'FAIL non-admin saved';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;

-- 3) 관리자: 값 검사·채널 거르기·조치 기록·직접 쓰기 차단
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d1a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  BEGIN
    PERFORM admin_set_marketing_automation('{"level":"L3"}'::jsonb);
    RAISE EXCEPTION 'FAIL L3 accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM admin_set_marketing_automation('{"level":"L2","minScore":60}'::jsonb);
    RAISE EXCEPTION 'FAIL min score 60 accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM admin_set_marketing_automation('{"level":"L2","minScore":"9x"}'::jsonb);
    RAISE EXCEPTION 'FAIL text min score accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := admin_set_marketing_automation('{"level":"L2","checkMode":"advisory","minScore":85,"autoChannels":["threads","instagram","threads"]}'::jsonb);
  IF r -> 'autoChannels' <> '["threads"]'::jsonb OR r ->> 'checkMode' <> 'advisory' OR (r ->> 'minScore')::int <> 85 THEN RAISE EXCEPTION 'FAIL saved %', r; END IF;
  r := public.marketing_automation_config();
  IF r -> 'autoChannels' <> '["threads"]'::jsonb OR r ->> 'updatedAt' IS NULL THEN RAISE EXCEPTION 'FAIL read back %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE action = 'platform.marketing_automation') THEN RAISE EXCEPTION 'FAIL admin action log'; END IF;
  BEGIN
    UPDATE platform_config SET data = '{"level":"L2","checkMode":"advisory"}'::jsonb WHERE id = 'marketing_automation';
    RAISE EXCEPTION 'FAIL direct write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 긴급 정지 = L1
  r := admin_set_marketing_automation('{"level":"L1","checkMode":"strict","minScore":90,"autoChannels":[]}'::jsonb);
  IF r ->> 'level' <> 'L1' OR jsonb_array_length(r -> 'autoChannels') <> 0 THEN RAISE EXCEPTION 'FAIL stop %', r; END IF;
  RAISE NOTICE 'PASS admin saves (validated, channels filtered, logged); direct write blocked; stop = L1';
END $$;
RESET ROLE;

-- 4) 캠페인 승인 표시는 서버만: 브라우저 세션(관리자 포함)은 승인 칸을 못 바꾼다
SELECT set_config('request.jwt.claims', '', true);
INSERT INTO marketing_daily_campaigns (id, campaign_date, day_theme_code, status)
VALUES ('00000000-0000-4000-8000-00000000d1c1', '2099-01-01', 'weekly_diagnosis', 'ready');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d1a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  BEGIN
    UPDATE marketing_daily_campaigns SET status = 'approved', approval_kind = 'advisory' WHERE id = '00000000-0000-4000-8000-00000000d1c1';
    RAISE EXCEPTION 'FAIL direct approval';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO marketing_daily_campaigns (campaign_date, day_theme_code, status, approval_kind)
    VALUES ('2099-01-02', 'weekly_diagnosis', 'approved', 'auto');
    RAISE EXCEPTION 'FAIL direct approved insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 승인과 무관한 칸은 그대로 고칠 수 있다
  UPDATE marketing_daily_campaigns SET news_title = 'TEST 제목' WHERE id = '00000000-0000-4000-8000-00000000d1c1';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL plain update'; END IF;
  RAISE NOTICE 'PASS approval fields blocked for browser sessions, other fields editable';
END $$;
RESET ROLE;
-- 서버(service_role)는 승인 표시를 남길 수 있다
SET LOCAL ROLE service_role;
DO $$ BEGIN
  UPDATE marketing_daily_campaigns SET status = 'approved', approval_kind = 'auto', approval_note = 'TEST 자동 승인', approved_at = now()
  WHERE id = '00000000-0000-4000-8000-00000000d1c1';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL server approval'; END IF;
  BEGIN
    UPDATE marketing_daily_campaigns SET approval_kind = 'robot' WHERE id = '00000000-0000-4000-8000-00000000d1c1';
    RAISE EXCEPTION 'FAIL bad kind accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS server sets approval kind; invalid kind rejected';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname IN ('mykim_marketing_auto_publish', 'mykim_marketing_auto_publish_2')) <> 2 THEN
    RAISE EXCEPTION 'FAIL cron jobs';
  END IF;
  RAISE NOTICE 'PASS auto publish cron jobs scheduled';
END $$;
ROLLBACK;
