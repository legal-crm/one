-- R6 검토 반영 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM legal_documents WHERE reviewed_by = '소성록 변호사' AND reviewed_on = DATE '2026-11-01') < 1 THEN
    RAISE NOTICE 'SKIP no 2026-11-01 documents in this DB';
  END IF;
  IF (SELECT (data #>> '{features,calculatorVisible}')::boolean FROM platform_config WHERE id = 'feature_flags') IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL calculator not visible';
  END IF;
  IF (SELECT data #>> '{caseReviewBilling,mode}' FROM platform_config WHERE id = 'feature_flags') IS NULL THEN
    RAISE EXCEPTION 'FAIL billing mode lost';
  END IF;
  RAISE NOTICE 'PASS r6 review applied';
END $$;
ROLLBACK;
