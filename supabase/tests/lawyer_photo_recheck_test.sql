-- 변호사 사진 저장소 규칙·승인 뒤 다시 확인 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test_owner_cd1@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name) VALUES ('test-lawyer-cd1', 'TEST_CD1', 'TEST사무소');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'test-lawyer-cd1', 'cd1', true);

-- 1. base64 사진은 거절, 주소는 허용, 두 번째 칸 base64는 비움
DO $$ BEGIN
  BEGIN
    UPDATE lawyers SET avatar = 'data:image/png;base64,AAAA' WHERE id = 'test-lawyer-cd1';
    RAISE EXCEPTION 'FAIL base64 avatar allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  UPDATE lawyers SET avatar = 'https://example.test/lawyer-photos/test-lawyer-cd1/a.jpg', avatar_data = 'data:image/png;base64,AAAA' WHERE id = 'test-lawyer-cd1';
  IF (SELECT avatar_data FROM lawyers WHERE id = 'test-lawyer-cd1') <> '' THEN RAISE EXCEPTION 'FAIL avatar_data kept'; END IF;
  RAISE NOTICE 'PASS photo is a storage address only';
END $$;

-- 2. 승인 뒤 실명·사진을 바꾸면 다시 확인 필요 (변호사 본인 수정)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
DO $$ BEGIN
  UPDATE lawyers SET name = 'TEST_CD1_NEW' WHERE id = 'test-lawyer-cd1';
  IF NOT (SELECT recheck_needed FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-cd1') THEN RAISE EXCEPTION 'FAIL recheck flag'; END IF;
  IF NOT ('name' = ANY (SELECT unnest(recheck_fields) FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-cd1')) THEN RAISE EXCEPTION 'FAIL recheck field'; END IF;
  UPDATE lawyers SET bio = '소개만 바꿈' WHERE id = 'test-lawyer-cd1';
  IF (SELECT count(*) FROM lawyer_review_events WHERE lawyer_id = 'test-lawyer-cd1' AND action = 'profile_changed') <> 2 THEN
    -- 위 1단계 사진 변경 + 이름 변경 = 2건, 소개만 바꾼 건 기록하지 않음
    RAISE EXCEPTION 'FAIL events %', (SELECT count(*) FROM lawyer_review_events WHERE lawyer_id = 'test-lawyer-cd1');
  END IF;
  RAISE NOTICE 'PASS approved profile change needs recheck';
END $$;

-- 3. 저장소 폴더: 내 폴더만
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.my_lawyer_account_id() <> 'test-lawyer-cd1' THEN RAISE EXCEPTION 'FAIL my lawyer id'; END IF;
  RAISE NOTICE 'PASS photo folder is own lawyer id';
END $$;
RESET ROLE;
ROLLBACK;
