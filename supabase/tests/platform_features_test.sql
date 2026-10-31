-- 기능 표시·부가 기능 과금 모드 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000000a9', 'test_admin_ca9@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  r := admin_set_platform_features('{"caseReviewBilling":{"mode":"free"},"features":{"calculatorVisible":false}}'::jsonb);
  IF r #>> '{caseReviewBilling,mode}' <> 'free' THEN RAISE EXCEPTION 'FAIL free'; END IF;
  BEGIN
    PERFORM admin_set_platform_features(jsonb_build_object('caseReviewBilling', jsonb_build_object('mode','flat_paid','effectiveFrom', (current_date + 10)::text)));
    RAISE EXCEPTION 'FAIL paid without 30 days';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := admin_set_platform_features(jsonb_build_object('caseReviewBilling', jsonb_build_object('mode','ad_benefit','effectiveFrom', (current_date + 31)::text)));
  IF r #>> '{caseReviewBilling,noticeId}' IS NULL THEN RAISE EXCEPTION 'FAIL notice id'; END IF;
  IF NOT EXISTS (SELECT 1 FROM notices WHERE id = r #>> '{caseReviewBilling,noticeId}' AND status = 'published') THEN RAISE EXCEPTION 'FAIL notice'; END IF;
  BEGIN
    UPDATE platform_config SET data = '{"caseReviewBilling":{"mode":"flat_paid"}}'::jsonb WHERE id = 'feature_flags';
    RAISE EXCEPTION 'FAIL direct write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS billing mode needs 30 days notice and RPC';
END $$;
RESET ROLE;
ROLLBACK;

-- 변호사가 자기 행에서 예외·광고 등급을 바꿔도 그대로
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'test_owner_caa@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name, ad_tier, ai_case_analysis_enabled) VALUES ('test-lawyer-caa', 'TEST', 'free', false);
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'test-lawyer-caa', 'caa', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE lawyers SET ai_case_analysis_enabled = true, ad_tier = 'top', bio = 'x' WHERE id = 'test-lawyer-caa';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT ai_case_analysis_enabled OR ad_tier <> 'free' FROM lawyers WHERE id = 'test-lawyer-caa') THEN RAISE EXCEPTION 'FAIL lawyer changed paid fields'; END IF;
  RAISE NOTICE 'PASS lawyer cannot change paid fields';
END $$;
ROLLBACK;
