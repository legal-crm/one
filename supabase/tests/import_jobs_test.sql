-- 옮겨오기 기록 시험 (NF-10, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000a7', 'test_owner_ij1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a8', 'test_owner_ij2@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ij1', 'TEST_IJ1'), ('test-lawyer-ij2', 'TEST_IJ2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000a7', 'test-lawyer-ij1', 'ij1', true),
  ('00000000-0000-4000-8000-0000000000a8', 'test-lawyer-ij2', 'ij2', true);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c cases; BEGIN
  c := create_case('test-lawyer-ij2', '{"case_type":"rehab","source":"direct","display_name":"TEST IJ2"}');
  PERFORM set_config('test.other_case', c.id::text, true);
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE c cases; j uuid;
BEGIN
  c := create_case('test-lawyer-ij1', '{"case_type":"rehab","source":"direct","display_name":"TEST IJ1"}');
  BEGIN
    INSERT INTO import_jobs (office_id, case_ids) VALUES ('test-lawyer-ij1', ARRAY[current_setting('test.other_case')::uuid]);
    RAISE EXCEPTION 'FAIL other office case';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  INSERT INTO import_jobs (office_id, file_name, row_count, created_count, case_ids, status)
  VALUES ('test-lawyer-ij1', 'a.xlsx', 1, 1, ARRAY[c.id], 'undone') RETURNING id INTO j;
  IF (SELECT status FROM import_jobs WHERE id = j) <> 'done' THEN RAISE EXCEPTION 'FAIL insert status forced'; END IF;
  UPDATE import_jobs SET status = 'undone', case_ids = '{}' WHERE id = j;
  IF (SELECT cardinality(case_ids) FROM import_jobs WHERE id = j) <> 1 THEN RAISE EXCEPTION 'FAIL case ids frozen'; END IF;
  UPDATE import_jobs SET status = 'done' WHERE id = j;
  IF (SELECT status FROM import_jobs WHERE id = j) <> 'undone' THEN RAISE EXCEPTION 'FAIL undo once'; END IF;
  RAISE NOTICE 'PASS import job guard';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM import_jobs WHERE office_id = 'test-lawyer-ij1') THEN RAISE EXCEPTION 'FAIL other office reads'; END IF;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;
ROLLBACK;
