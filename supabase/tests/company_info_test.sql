-- 회사 정보 한 곳 시험 (CT-12, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE good jsonb := '{"legalName":"몬스터랩","businessType":"개인사업자","ceo":"진성호","businessNumber":"521-39-01355","mailOrderNumber":"제2026-진접오남-0565호","address":"경기도 남양주시","phone":"070-4187-2882","email":"support@mykim.kr","privacyOfficer":"진성호(대표)","hosting":"Vercel Inc."}';
BEGIN
  DELETE FROM site_rebuild_requests WHERE sent_at IS NULL;
  BEGIN
    INSERT INTO platform_config (id, data) VALUES ('company_info', good || '{"legalName":"주식회사 몬스터랩"}');
    RAISE EXCEPTION 'FAIL banned wording';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO platform_config (id, data) VALUES ('company_info', good || '{"businessNumber":"5213901355"}');
    RAISE EXCEPTION 'FAIL number format';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO platform_config (id, data) VALUES ('company_info', good) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
  IF NOT EXISTS (SELECT 1 FROM site_rebuild_requests WHERE sent_at IS NULL) THEN RAISE EXCEPTION 'FAIL rebuild queued'; END IF;
  -- 다른 설정 행은 검사하지 않음
  INSERT INTO platform_config (id, data) VALUES ('test_other_cfg', '{"x":1}');
  RAISE NOTICE 'PASS company info guard + rebuild';
END $$;
ROLLBACK;
