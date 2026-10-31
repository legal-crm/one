-- 승인 변호사 소개 문구 금지 표현 → 다시 확인 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test_owner_cd7@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name) VALUES ('test-lawyer-cd7', 'TEST_CD7', 'TEST사무소');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000d7', 'test-lawyer-cd7', 'cd7', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d7","role":"authenticated"}', true);
DO $$ BEGIN
  UPDATE lawyers SET bio = '회생 절차를 처음부터 차근차근 안내합니다.' WHERE id = 'test-lawyer-cd7';
  IF EXISTS (SELECT 1 FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-cd7' AND recheck_needed) THEN RAISE EXCEPTION 'FAIL plain bio flagged'; END IF;
  UPDATE lawyers SET bio = '인가 보장, 무조건 해결해 드립니다.' WHERE id = 'test-lawyer-cd7';
  IF NOT ('copy_terms' = ANY (SELECT unnest(recheck_fields) FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-cd7')) THEN RAISE EXCEPTION 'FAIL copy terms not flagged'; END IF;
  UPDATE lawyers SET data = coalesce(data, '{}'::jsonb) || '{"catchphrase":"100% 보장"}' WHERE id = 'test-lawyer-cd7';
  RAISE NOTICE 'PASS profile copy terms need recheck';
END $$;
ROLLBACK;
