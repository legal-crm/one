-- 통화 녹음 대화록 시험 (CL-8, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e7', 'test_owner_e7@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e8', 'test_clerk_e8@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e9', 'test_other_e9@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-e7', 'TEST');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES ('00000000-0000-4000-8000-0000000000e7', 'test-lawyer-e7', 'e7', true);
INSERT INTO office_members (id, office_id, user_id, role, display_name) VALUES
  ('00000000-0000-4000-8000-00000000e801', 'test-lawyer-e7', '00000000-0000-4000-8000-0000000000e8', 'clerk', 'C');
INSERT INTO call_recordings (id, office_id, workspace_key, storage_path, mime_type, size_bytes, uploaded_by, status)
VALUES ('00000000-0000-4000-8000-0000000e7a01', 'test-lawyer-e7', 'test-req-e7', 'test-lawyer-e7/rec/e7.m4a', 'audio/mp4', 1000,
        '00000000-0000-4000-8000-0000000000e7', 'verified');

DO $$ DECLARE r jsonb; BEGIN
  r := call_transcript_prepare('00000000-0000-4000-8000-0000000e7a01', '00000000-0000-4000-8000-0000000000e7');
  IF NOT (r ->> 'ok')::boolean OR (r ->> 'next_version')::int <> 1 THEN RAISE EXCEPTION 'FAIL owner prepare %', r; END IF;
  r := call_transcript_prepare('00000000-0000-4000-8000-0000000e7a01', '00000000-0000-4000-8000-0000000000e9');
  IF (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL outsider prepare'; END IF;
  r := call_transcript_prepare('00000000-0000-4000-8000-0000000e7a01', '00000000-0000-4000-8000-0000000000e8');
  IF (r ->> 'ok')::boolean THEN RAISE EXCEPTION 'FAIL clerk without case prepare %', r; END IF;
  INSERT INTO call_transcripts (recording_id, office_id, version, segments, summary)
  VALUES ('00000000-0000-4000-8000-0000000e7a01', 'test-lawyer-e7', 1, '[{"speaker":"직원","text":"안녕하세요"}]', '요약');
  RAISE NOTICE 'PASS prepare permissions';
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e7","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM call_transcripts) <> 1 THEN RAISE EXCEPTION 'FAIL owner cannot read'; END IF;
  BEGIN INSERT INTO call_transcripts (recording_id, office_id, version) VALUES ('00000000-0000-4000-8000-0000000e7a01', 'test-lawyer-e7', 2);
    RAISE EXCEPTION 'FAIL user inserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS owner reads, cannot write';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM call_transcripts) THEN RAISE EXCEPTION 'FAIL outsider reads'; END IF;
  RAISE NOTICE 'PASS outsider blocked';
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN UPDATE call_transcripts SET summary = 'x'; RAISE EXCEPTION 'FAIL updated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('mykim.comm_purge', 'on', true);
  UPDATE call_recordings SET deleted_at = now() WHERE id = '00000000-0000-4000-8000-0000000e7a01';
  IF EXISTS (SELECT 1 FROM call_transcripts) THEN RAISE EXCEPTION 'FAIL transcript kept after recording deleted'; END IF;
  RAISE NOTICE 'PASS append-only + dropped with recording';
END $$;
ROLLBACK;
