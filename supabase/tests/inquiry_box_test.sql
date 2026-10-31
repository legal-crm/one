-- 문의함 통합 시험 (CT-8, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c3', 'test_lawyer_cc3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cc3', 'TEST_CC3');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000c3', 'test-lawyer-cc3', 'cc3', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'inquiry-files' AND public) THEN RAISE EXCEPTION 'FAIL bucket public'; END IF;
  INSERT INTO lawyer_inquiries (id, data) VALUES ('test-linq-1', '{"lawyerId":"test-lawyer-cc3","title":"T","content":"C","status":"pending"}');
  UPDATE lawyer_inquiries SET data = data || '{"replyContent":"답변입니다","status":"replied"}' WHERE id = 'test-linq-1';
  UPDATE lawyer_inquiries SET data = data || '{"status":"closed"}' WHERE id = 'test-linq-1'; -- 같은 답변이면 알림 안 늘어남
  IF coalesce((SELECT count FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000c3' AND dedupe_key = 'lawyer_inquiry:test-linq-1'), 0) <> 1 THEN
    RAISE EXCEPTION 'FAIL lawyer notified once';
  END IF;
  RAISE NOTICE 'PASS lawyer inquiry reply notify';
END $$;
ROLLBACK;

-- 일반 로그인 사용자는 문구함을 못 봄
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM admin_reply_templates;
  BEGIN
    INSERT INTO admin_reply_templates (title, body) VALUES ('t', 'b');
    RAISE EXCEPTION 'FAIL non-admin insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS templates admin only';
END $$;
RESET ROLE;
ROLLBACK;
