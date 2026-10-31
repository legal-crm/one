-- AI 검색 인용 점검 시험 (시험 DB 전용, ROLLBACK) — 정기 호출(pg_net)은 부르지 않는다
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000d5a9', 'test_admin_d5a9@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d5a1', 'test_user_d5a1@example.test', 'authenticated', 'authenticated', '{}'::jsonb);

-- 처음 질문 5개가 들어 있다
DO $$ BEGIN
  IF (SELECT count(*) FROM geo_target_questions WHERE active) < 5 THEN RAISE EXCEPTION 'FAIL seed questions'; END IF;
  RAISE NOTICE 'PASS seed questions';
END $$;

-- 일반 사용자: 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d5a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM geo_target_questions) THEN RAISE EXCEPTION 'FAIL non-admin reads questions'; END IF;
  BEGIN
    PERFORM admin_geo_overview();
    RAISE EXCEPTION 'FAIL non-admin overview';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM geo_due_questions(5, NULL);
    RAISE EXCEPTION 'FAIL non-admin due list';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;

-- 관리자: 질문 추가, 50개 한도
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d5a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  INSERT INTO geo_target_questions (question, target_path) VALUES ('  TEST 개인회생 기간은 얼마나 걸리나요?  ', '/guide/test.html');
  IF NOT EXISTS (SELECT 1 FROM geo_target_questions WHERE question = 'TEST 개인회생 기간은 얼마나 걸리나요?') THEN RAISE EXCEPTION 'FAIL trim'; END IF;
  SELECT count(*) INTO n FROM geo_target_questions WHERE active;
  INSERT INTO geo_target_questions (question) SELECT 'TEST 질문 ' || g || ' 입니다' FROM generate_series(1, 50 - n) g;
  BEGIN
    INSERT INTO geo_target_questions (question) VALUES ('TEST 한도 넘는 질문입니다');
    RAISE EXCEPTION 'FAIL 51st active question';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  INSERT INTO geo_target_questions (question, active) VALUES ('TEST 꺼 둔 질문입니다', false);
  BEGIN
    INSERT INTO geo_citation_checks (question_id, ok) SELECT id, true FROM geo_target_questions LIMIT 1;
    RAISE EXCEPTION 'FAIL admin wrote check directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS admin manages questions, 50 active limit, checks are server-only';
END $$;
RESET ROLE;

-- 서버: 점검 대상 → 기록 → 6일 안에는 다시 안 나옴 → 화면 요약
DO $$ DECLARE q uuid; o jsonb; BEGIN
  SELECT id INTO q FROM geo_due_questions(5, NULL) LIMIT 1;
  IF q IS NULL THEN RAISE EXCEPTION 'FAIL no due question'; END IF;
  PERFORM geo_record_check(q, '{"model":"test-model","ok":true,"cited":true,"cited_rank":2,"source_count":3,"sources":[{"domain":"a.test"},{"domain":"mykim.kr"}],"answer_excerpt":"TEST 답변"}'::jsonb);
  IF EXISTS (SELECT 1 FROM geo_due_questions(50, NULL) d WHERE d.id = q) THEN RAISE EXCEPTION 'FAIL checked question still due'; END IF;
  IF NOT EXISTS (SELECT 1 FROM geo_due_questions(1, q)) THEN RAISE EXCEPTION 'FAIL forced recheck'; END IF;
  IF (SELECT count(*) FROM geo_due_questions(50, NULL)) > 10 THEN RAISE EXCEPTION 'FAIL limit cap'; END IF;
  RAISE NOTICE 'PASS due list, record, 6-day skip, forced recheck';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d5a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE o jsonb; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  o := admin_geo_overview();
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o -> 'questions') e WHERE (e ->> 'cited_8w')::int = 1 AND e -> 'last' ->> 'cited_rank' = '2') THEN
    RAISE EXCEPTION 'FAIL overview %', left(o::text, 300);
  END IF;
  IF jsonb_array_length(o -> 'weekly') < 1 THEN RAISE EXCEPTION 'FAIL weekly'; END IF;
  RAISE NOTICE 'PASS admin overview (last result, 8-week rate, weekly)';
END $$;
RESET ROLE;
ROLLBACK;
