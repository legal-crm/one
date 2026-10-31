-- 자격 연도·변협 등록 전문분야 변경 → 다시 확인 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_ce1@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, firm_name) VALUES ('test-lawyer-ce1', 'TEST_CE1', 'TEST office');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-ce1', 'ce1', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);

DO $$ BEGIN
  UPDATE lawyers SET data = coalesce(data, '{}'::jsonb) || '{"admittedYear": 2019}'::jsonb WHERE id = 'test-lawyer-ce1';
  IF NOT ('admitted_year' = ANY (SELECT unnest(recheck_fields) FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-ce1')) THEN RAISE EXCEPTION 'FAIL admitted_year'; END IF;
  UPDATE lawyers SET data = data || '{"kbaSpecialty": "TEST"}'::jsonb WHERE id = 'test-lawyer-ce1';
  IF NOT ('kba_specialty' = ANY (SELECT unnest(recheck_fields) FROM lawyer_review_state WHERE lawyer_id = 'test-lawyer-ce1')) THEN RAISE EXCEPTION 'FAIL kba_specialty'; END IF;
  RAISE NOTICE 'PASS admitted year and KBA specialty need recheck';
END $$;

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM lawyer_review_events WHERE lawyer_id = 'test-lawyer-ce1' AND action = 'profile_changed';
  -- 비우는 변경은 다시 확인하지 않음
  UPDATE lawyers SET data = data - 'kbaSpecialty' WHERE id = 'test-lawyer-ce1';
  IF (SELECT count(*) FROM lawyer_review_events WHERE lawyer_id = 'test-lawyer-ce1' AND action = 'profile_changed') <> n THEN RAISE EXCEPTION 'FAIL clearing flagged'; END IF;
  RAISE NOTICE 'PASS clearing a claim does not need recheck';
END $$;
ROLLBACK;
