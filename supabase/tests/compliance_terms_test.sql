-- 금지어 사전 관리자 편집 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000c7a9', 'test_admin_c7a9@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c7a1', 'test_user_c7a1@example.test', 'authenticated', 'authenticated', '{}'::jsonb);

-- 일반 사용자: 저장 불가, 직접 쓰기 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c7a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM admin_set_compliance_terms(ARRAY['TEST금지어'], '[]'::jsonb);
    RAISE EXCEPTION 'FAIL non-admin saved';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c7a9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  BEGIN
    PERFORM admin_set_compliance_terms(ARRAY['가'], '[]'::jsonb);
    RAISE EXCEPTION 'FAIL one-char term';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  r := admin_set_compliance_terms(ARRAY['TEST특급해결', ' TEST특급해결 ', 'TEST기적상담'], '[{"term":"TEST전국구","reason":"TEST 근거 없는 범위"}]'::jsonb);
  IF jsonb_array_length(r -> 'clientTerms') <> 2 OR jsonb_array_length(r -> 'marketingTerms') <> 1 THEN RAISE EXCEPTION 'FAIL saved %', r; END IF;
  BEGIN
    UPDATE platform_config SET data = '{"clientTerms":[]}'::jsonb WHERE id = 'compliance_terms';
    RAISE EXCEPTION 'FAIL direct write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF NOT ('TEST특급해결' = ANY (qna_flagged_terms('이 사건은 TEST특급 해결로 처리'))) THEN RAISE EXCEPTION 'FAIL qna extra term'; END IF;
  IF NOT ('100% 보장' = ANY (qna_flagged_terms('100% 보장해요'))) THEN RAISE EXCEPTION 'FAIL base term kept'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(ad_copy_warnings('TEST기적상담 지금 신청')) w WHERE w LIKE '관리자가 더한 표현%') THEN RAISE EXCEPTION 'FAIL ad extra term'; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE action = 'platform.compliance_terms') THEN RAISE EXCEPTION 'FAIL admin action log'; END IF;
  RAISE NOTICE 'PASS admin adds terms; Q&A·ad checks use them; base terms stay; direct write blocked';
END $$;
RESET ROLE;
ROLLBACK;
