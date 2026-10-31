-- 공개 이미지 저장소·팝업 인라인 이미지 차단 시험 (CT-7, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'site-media' AND public) THEN RAISE EXCEPTION 'FAIL bucket'; END IF;
  BEGIN
    INSERT INTO popup_config (id, data) VALUES ('test_inline', '{"items":[{"id":"a","imageUrl":"data:image/png;base64,AAAA"}]}');
    RAISE EXCEPTION 'FAIL inline accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO popup_config (id, data) VALUES ('test_inline', '{"items":[{"id":"a","imageUrl":"https://example.test/a.png"}]}');
  RAISE NOTICE 'PASS site media bucket + popup inline block';
END $$;
ROLLBACK;

-- 관리자가 아니면 올리기 불가
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES ('00000000-0000-4000-8000-0000000000c2', 'test_user_cc2@example.test', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('site-media', 'popup/x.png', '00000000-0000-4000-8000-0000000000c2');
    RAISE EXCEPTION 'FAIL non-admin upload';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS non-admin blocked';
END $$;
RESET ROLE;
ROLLBACK;
