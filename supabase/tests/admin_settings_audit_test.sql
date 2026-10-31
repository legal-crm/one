-- 설정·콘텐츠 변경 기록 시험 (CT-16, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role, raw_app_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'test_admin_cc1@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'::jsonb);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  IF NOT public.is_platform_admin() THEN RAISE NOTICE 'SKIP admin claims not recognised in this DB'; RETURN; END IF;
  INSERT INTO popup_config (id, data) VALUES ('test_audit', '{"title":"A"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
  UPDATE popup_config SET data = '{"title":"B"}' WHERE id = 'test_audit';
  UPDATE popup_config SET data = '{"title":"B"}' WHERE id = 'test_audit'; -- 같은 값은 기록 안 함
  SELECT count(*) INTO n FROM admin_actions WHERE target_type = 'popup_config' AND target_id = 'test_audit';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL config audit rows %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE target_id = 'test_audit' AND action = 'settings.update'
                 AND before_value ->> 'title' = 'A' AND after_value ->> 'title' = 'B') THEN RAISE EXCEPTION 'FAIL before/after'; END IF;

  INSERT INTO news_articles (id, data, status) VALUES ('test-audit-news', '{"title":"T1","content":"x"}', 'draft');
  UPDATE news_articles SET status = 'published' WHERE id = 'test-audit-news';
  UPDATE news_articles SET data = '{"title":"T2","content":"x"}' WHERE id = 'test-audit-news';
  DELETE FROM news_articles WHERE id = 'test-audit-news';
  IF (SELECT string_agg(action, ',' ORDER BY id) FROM admin_actions WHERE target_type = 'news_articles' AND target_id = 'test-audit-news')
     <> 'content.create,content.status,content.update,content.delete' THEN RAISE EXCEPTION 'FAIL content actions'; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE target_id = 'test-audit-news' AND action = 'content.update' AND after_value -> 'changed_keys' = '["title"]'::jsonb) THEN
    RAISE EXCEPTION 'FAIL changed keys';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_actions WHERE target_id = 'test-audit-news' AND action = 'content.delete' AND before_value #>> '{data,title}' = 'T2') THEN
    RAISE EXCEPTION 'FAIL deleted copy';
  END IF;
  RAISE NOTICE 'PASS settings and content audit';
END $$;
RESET ROLE;
ROLLBACK;
