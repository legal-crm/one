-- 상담 절차 예시 30건 초안 시험 (D-2, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM success_reviews WHERE id LIKE 'example-case-%' AND status = 'draft' AND is_example) <> 30 THEN
    RAISE EXCEPTION 'FAIL draft examples %', (SELECT count(*) FROM success_reviews WHERE id LIKE 'example-case-%');
  END IF;
  RAISE NOTICE 'PASS 30 draft examples';
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM success_reviews WHERE id LIKE 'example-case-%') THEN RAISE EXCEPTION 'FAIL drafts visible to public'; END IF;
  RAISE NOTICE 'PASS drafts hidden from public';
END $$;
RESET ROLE;
ROLLBACK;
