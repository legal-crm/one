-- 권한 정리 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated') AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL truncate/trigger/references grants remain %', n; END IF;
  -- 익명 쓰기 권한은 허용 정책이 있는 audit_logs INSERT만
  SELECT count(*) INTO n FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public' AND g.grantee = 'anon' AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
     AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = g.table_name
                       AND (p.cmd = g.privilege_type OR p.cmd = 'ALL') AND (p.roles @> ARRAY['anon']::name[] OR p.roles @> ARRAY['public']::name[]));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL anon write grants without policy %', n; END IF;
  IF has_function_privilege('anon', 'public.cleanup_expired_diagnosis()', 'EXECUTE') THEN RAISE EXCEPTION 'FAIL cleanup callable by anon'; END IF;
  IF has_column_privilege('anon', 'public.lawyer_profile_tombstones', 'deleted_by', 'SELECT') THEN RAISE EXCEPTION 'FAIL tombstone deleted_by readable'; END IF;
  IF NOT has_column_privilege('anon', 'public.lawyer_profile_tombstones', 'lawyer_id', 'SELECT') THEN RAISE EXCEPTION 'FAIL tombstone lawyer_id hidden'; END IF;
  -- 익명 감사 기록(허용 행동)은 그대로
  IF NOT has_table_privilege('anon', 'public.audit_logs', 'INSERT') THEN RAISE EXCEPTION 'FAIL anon audit insert removed'; END IF;
  -- 로그인 사용자의 정책 기반 쓰기는 그대로 (예: 콘텐츠 표 SELECT, 상담 메시지는 RLS가 판단)
  IF NOT has_table_privilege('authenticated', 'public.consult_messages', 'SELECT') THEN RAISE EXCEPTION 'FAIL authenticated select removed'; END IF;
  RAISE NOTICE 'PASS grant hardening';
END $$;
ROLLBACK;
