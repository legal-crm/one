-- '정리 완료' 서버 이벤트 시험 (OP-4, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT record_check_completed('sess_abcdefghijklmnop') THEN RAISE EXCEPTION 'FAIL first'; END IF;
  IF record_check_completed('sess_abcdefghijklmnop') THEN RAISE EXCEPTION 'FAIL duplicate counted'; END IF;
  IF record_check_completed('bad id!') THEN RAISE EXCEPTION 'FAIL invalid accepted'; END IF;
  BEGIN PERFORM 1 FROM check_completions; RAISE EXCEPTION 'FAIL anon reads table';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS anon record once';
END $$;
RESET ROLE;
DO $$ DECLARE m jsonb; BEGIN
  m := platform_metrics_core(now() - interval '1 day', now() + interval '1 minute');
  IF (m ->> 'checks_completed')::int < 1 THEN RAISE EXCEPTION 'FAIL metrics %', m ->> 'checks_completed'; END IF;
  RAISE NOTICE 'PASS metrics count';
END $$;
ROLLBACK;
