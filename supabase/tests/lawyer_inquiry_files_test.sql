-- 변호사 문의 첨부 비공개 저장소 시험 (CT-8, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000c4', 'test_lawyer_cc4@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c5', 'test_lawyer_cc5@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-cc4', 'TEST_CC4'), ('test-lawyer-cc5', 'TEST_CC5');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000c4', 'test-lawyer-cc4', 'cc4', true),
  ('00000000-0000-4000-8000-0000000000c5', 'test-lawyer-cc5', 'cc5', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('inquiry-files', 'lawyer/test-lawyer-cc4/q1/1.png', '00000000-0000-4000-8000-0000000000c4');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('inquiry-files', 'lawyer/test-lawyer-cc5/q1/1.png', '00000000-0000-4000-8000-0000000000c4');
    RAISE EXCEPTION 'FAIL other lawyer folder';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO lawyer_inquiries (id, data) VALUES ('test-linq-inline', '{"lawyerId":"test-lawyer-cc4","title":"t","content":"c","attachments":[{"fileName":"a.png","dataUrl":"data:image/png;base64,AAA"}]}');
    RAISE EXCEPTION 'FAIL inline accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS lawyer inquiry files';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c5","role":"authenticated"}', true);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'inquiry-files' AND name = 'lawyer/test-lawyer-cc4/q1/1.png';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL other lawyer can read'; END IF;
  RAISE NOTICE 'PASS other lawyer cannot read';
END $$;
RESET ROLE;
ROLLBACK;
