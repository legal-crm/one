-- 체크 초안 시험 (I-5, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000d8', 'test_client_d8@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d9', 'test_client_d9@example.test', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO client_check_drafts (user_id, data) VALUES ('00000000-0000-4000-8000-0000000000d8', '{"currentStep":"rent_cost"}');
  UPDATE client_check_drafts SET data = '{"currentStep":"deposit_amount"}' WHERE user_id = '00000000-0000-4000-8000-0000000000d8';
  BEGIN
    INSERT INTO client_check_drafts (user_id, data) VALUES ('00000000-0000-4000-8000-0000000000d9', '{"x":1}');
    RAISE EXCEPTION 'FAIL wrote other user draft';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE client_check_drafts SET data = '{"note":"900101-1234567"}' WHERE user_id = '00000000-0000-4000-8000-0000000000d8';
    RAISE EXCEPTION 'FAIL rrn stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RAISE NOTICE 'PASS own draft';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM client_check_drafts) THEN RAISE EXCEPTION 'FAIL sees other draft'; END IF;
  RAISE NOTICE 'PASS others cannot read';
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM client_check_drafts; RAISE EXCEPTION 'FAIL anon reads';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS anon blocked';
END $$;
RESET ROLE;
ROLLBACK;
