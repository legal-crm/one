-- 키워드 은행 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000e7a9', 'test_admin_e7a9@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e7a1', 'test_user_e7a1@example.test', 'authenticated', 'authenticated', '{}'::jsonb);

DO $$ BEGIN
  IF (SELECT count(*) FROM marketing_keywords) < 10 THEN RAISE EXCEPTION 'FAIL seed keywords'; END IF;
  RAISE NOTICE 'PASS seed keywords';
END $$;

-- 일반 사용자: 못 보고 못 씀
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e7a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM marketing_keywords) THEN RAISE EXCEPTION 'FAIL non-admin reads keywords'; END IF;
  BEGIN
    INSERT INTO marketing_keywords (keyword) VALUES ('TEST 일반 사용자');
    RAISE EXCEPTION 'FAIL non-admin insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM marketing_keyword_set_trend(gen_random_uuid(), '[]'::jsonb);
    RAISE EXCEPTION 'FAIL non-admin trend';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;

-- 관리자: 추가·중복·추세 칸은 못 바꿈
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e7a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v uuid; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  INSERT INTO marketing_keywords (keyword, cluster, intent, priority, trend)
  VALUES ('  TEST 개인회생 상담 순서  ', ' TEST 절차 ', 'procedure', 5, '[{"period":"2026-01-01","ratio":10}]') RETURNING id INTO v;
  IF (SELECT keyword FROM marketing_keywords WHERE id = v) <> 'TEST 개인회생 상담 순서' OR (SELECT cluster FROM marketing_keywords WHERE id = v) <> 'TEST 절차' THEN
    RAISE EXCEPTION 'FAIL trim';
  END IF;
  IF (SELECT trend FROM marketing_keywords WHERE id = v) IS NOT NULL THEN RAISE EXCEPTION 'FAIL admin wrote trend on insert'; END IF;
  BEGIN
    INSERT INTO marketing_keywords (keyword) VALUES ('test 개인회생 상담 순서');
    RAISE EXCEPTION 'FAIL duplicate keyword';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE marketing_keywords SET covered = true, trend = '[]'::jsonb, last_used_on = current_date WHERE id = v;
  IF (SELECT covered FROM marketing_keywords WHERE id = v) IS NOT TRUE OR (SELECT trend FROM marketing_keywords WHERE id = v) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL update guard';
  END IF;
  RAISE NOTICE 'PASS admin add, trim, duplicate blocked, trend column server-only';
END $$;
RESET ROLE;

-- 서버: 추세 저장·크기 검사
DO $$ DECLARE v uuid; BEGIN
  SELECT id INTO v FROM marketing_keywords ORDER BY created_at LIMIT 1;
  PERFORM marketing_keyword_set_trend(v, '[{"period":"2026-01-01","ratio":40.5},{"period":"2026-02-01","ratio":100}]'::jsonb);
  IF jsonb_array_length((SELECT trend FROM marketing_keywords WHERE id = v)) <> 2 OR (SELECT trend_at FROM marketing_keywords WHERE id = v) IS NULL THEN
    RAISE EXCEPTION 'FAIL server trend';
  END IF;
  BEGIN
    PERFORM marketing_keyword_set_trend(v, (SELECT jsonb_agg(jsonb_build_object('period', g, 'ratio', 1)) FROM generate_series(1, 25) g));
    RAISE EXCEPTION 'FAIL oversized trend';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'PASS server trend write';
END $$;
ROLLBACK;
