-- 알림톡 발송 결과 소통 기록 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000ab11', 'test_owner_ab11@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000ab13', 'test_other_ab13@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ab11', 'TEST_AB11'), ('test-lawyer-ab13', 'TEST_AB13');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-00000000ab11', 'test-lawyer-ab11', 'ab11', true),
  ('00000000-0000-4000-8000-00000000ab13', 'test-lawyer-ab13', 'ab13', true);
CREATE TEMP TABLE t_vars (k text PRIMARY KEY, v text);
GRANT ALL ON t_vars TO authenticated, service_role;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ab11","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c cases; BEGIN
  c := create_case('test-lawyer-ab11', '{"case_type":"rehab","source":"direct","display_name":"TEST_ALIM","phone":"010-3333-4444"}');
  INSERT INTO t_vars VALUES ('k', 'case-' || c.id::text);
  -- 로그인 사용자는 직접 부를 수 없다
  BEGIN
    PERFORM record_alimtok_comm_log('test-lawyer-ab11', 'case-' || c.id::text, '00000000-0000-4000-8000-00000000ab11', 'x', NULL);
    RAISE EXCEPTION 'FAIL authenticated can call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS not callable by users';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
DO $$ DECLARE id1 uuid; id2 uuid; k text := (SELECT v FROM t_vars WHERE k = 'k'); BEGIN
  id1 := record_alimtok_comm_log('test-lawyer-ab11', k, '00000000-0000-4000-8000-00000000ab11', 'TEST 알림톡 본문', '계약 안내');
  IF id1 IS NULL OR NOT EXISTS (SELECT 1 FROM client_comm_logs WHERE id = id1 AND source = 'alimtok' AND channel = 'alimtok' AND workspace_key = k) THEN
    RAISE EXCEPTION 'FAIL record';
  END IF;
  -- 다른 사무소 사람이 보낸 것으로는 남지 않는다
  id2 := record_alimtok_comm_log('test-lawyer-ab11', k, '00000000-0000-4000-8000-00000000ab13', 'TEST 다른 사무소', NULL);
  IF id2 IS NOT NULL THEN RAISE EXCEPTION 'FAIL other office member recorded'; END IF;
  -- 다른 사무소 사건 키로는 남지 않는다
  id2 := record_alimtok_comm_log('test-lawyer-ab13', k, '00000000-0000-4000-8000-00000000ab13', 'TEST 남의 사건', NULL);
  IF id2 IS NOT NULL THEN RAISE EXCEPTION 'FAIL foreign case recorded'; END IF;
  RAISE NOTICE 'PASS server records only own office case';
END $$;
RESET ROLE;
ROLLBACK;
