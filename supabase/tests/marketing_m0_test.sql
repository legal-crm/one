-- M0 마케팅 측정·SEO 기록 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_client_e1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e9', 'test_admin_e9@example.test', 'authenticated', 'authenticated');

-- 의뢰인: 첫 유입 경로 저장, 허용 칸만·형식 제한, 두 번째 값은 덮어쓰지 않음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE ft jsonb; BEGIN
  INSERT INTO consult_requests (id, client_id, client_name, status, first_touch)
  VALUES ('test-req-e1', '00000000-0000-4000-8000-0000000000e1', 'TEST', 'requested',
          '{"source":"threads","medium":"social","campaign":"2026-11-02_weekly","landing":"/guide/x.html?utm_source=threads#a","phone":"010-1234-5678","email":"a@b.c"}');
  SELECT first_touch INTO ft FROM consult_requests WHERE id = 'test-req-e1';
  IF ft ? 'phone' OR ft ? 'email' THEN RAISE EXCEPTION 'FAIL extra keys kept %', ft; END IF;
  IF ft ->> 'landing' <> '/guide/x.html' THEN RAISE EXCEPTION 'FAIL landing query kept %', ft; END IF;
  UPDATE consult_requests SET first_touch = '{"source":"naver"}' WHERE id = 'test-req-e1';
  IF (SELECT first_touch ->> 'source' FROM consult_requests WHERE id = 'test-req-e1') <> 'threads' THEN RAISE EXCEPTION 'FAIL first touch overwritten'; END IF;
  BEGIN
    PERFORM admin_channel_inflow(current_date - 7, current_date);
    RAISE EXCEPTION 'FAIL client reads inflow';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM seo_indexnow_log) OR EXISTS (SELECT 1 FROM admin_seo_state) THEN RAISE EXCEPTION 'FAIL client reads seo'; END IF;
  BEGIN
    INSERT INTO admin_seo_state (key, data) VALUES ('portals', '{}');
    RAISE EXCEPTION 'FAIL client writes seo state';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS first touch + client blocked';
END $$;
RESET ROLE;

-- 관리자: 채널 집계·SEO 상태 저장
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n bigint; BEGIN
  SELECT requests INTO n FROM admin_channel_inflow(current_date - 1, current_date + 1) WHERE source = 'threads';
  IF coalesce(n, 0) < 1 THEN RAISE EXCEPTION 'FAIL inflow count'; END IF;
  INSERT INTO admin_seo_state (key, data) VALUES ('portals', '{"google":{"done":{"g1":true}}}')
  ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
  IF NOT EXISTS (SELECT 1 FROM admin_seo_state WHERE key = 'portals') THEN RAISE EXCEPTION 'FAIL admin seo state'; END IF;
  RAISE NOTICE 'PASS admin inflow + seo state';
END $$;
RESET ROLE;
ROLLBACK;
