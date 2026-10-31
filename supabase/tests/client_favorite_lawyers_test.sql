-- 변호사 좋아요 서버 저장 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test_lawyer_fa1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'test_client_fa3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'test_client_fa4@example.test', 'authenticated', 'authenticated');
-- 공개 조건을 채운 승인 변호사(fa1), 승인 안 된 변호사(fa2)
INSERT INTO lawyers (id, name, firm_name, region, avatar, fields, bio)
SELECT 'test-lawyer-fa' || n, 'TEST_FA' || n, 'TEST 사무소 ' || n, '서울', 'https://example.test/a.webp', '["개인회생"]'::jsonb,
       repeat('개인회생과 파산 상담을 합니다. ', 4)
FROM generate_series(1, 2) n;
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'test-lawyer-fa1', 'fa1', true);

-- 의뢰인 fa3: 공개 변호사만 좋아요, 직접 넣기 불가, 끄기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r text[]; BEGIN
  r := set_favorite_lawyer('test-lawyer-fa1', true);
  IF r <> ARRAY['test-lawyer-fa1'] THEN RAISE EXCEPTION 'FAIL favorite on: %', r; END IF;
  r := set_favorite_lawyer('test-lawyer-fa1', true);
  IF cardinality(r) <> 1 THEN RAISE EXCEPTION 'FAIL duplicate'; END IF;
  BEGIN
    PERFORM set_favorite_lawyer('test-lawyer-fa2', true);
    RAISE EXCEPTION 'FAIL unlisted lawyer accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    INSERT INTO client_favorite_lawyers (client_user_id, lawyer_id) VALUES ('00000000-0000-4000-8000-0000000000a3', 'test-lawyer-fa2');
    RAISE EXCEPTION 'FAIL direct insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS favorite on + unlisted rejected + no direct insert';
END $$;
RESET ROLE;

-- 다른 의뢰인 fa4·변호사 fa1: fa3의 좋아요를 못 봄
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM client_favorite_lawyers) <> 0 THEN RAISE EXCEPTION 'FAIL other client sees favorites'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM client_favorite_lawyers) <> 0 THEN RAISE EXCEPTION 'FAIL lawyer sees who favorited'; END IF;
  RAISE NOTICE 'PASS favorites private to the client';
END $$;
RESET ROLE;

-- 끄기
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r text[]; BEGIN
  r := set_favorite_lawyer('test-lawyer-fa1', false);
  IF cardinality(r) <> 0 THEN RAISE EXCEPTION 'FAIL favorite off'; END IF;
  RAISE NOTICE 'PASS favorite off';
END $$;
RESET ROLE;

-- 익명: 함수 실행 불가
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM set_favorite_lawyer('test-lawyer-fa1', true);
    RAISE EXCEPTION 'FAIL anon allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS anon blocked';
END $$;
RESET ROLE;
ROLLBACK;
