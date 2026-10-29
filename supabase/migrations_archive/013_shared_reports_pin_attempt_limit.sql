-- ============================================================================
-- 013. 진단 보고서 보안 공유: 서버 보관 + PIN 시도 횟수 제한
-- ----------------------------------------------------------------------------
-- 기존 방식: 암호문 전체를 공유 링크에 담음 → 링크만 있으면 6자리 PIN(100만 조합)을
--           오프라인에서 무제한 대입해 해독 가능.
-- 변경 방식: 암호문은 서버에만 보관하고 링크에는 무작위 ID만 포함.
--           PIN 검증은 서버 RPC에서 수행하며, 5회 실패 시 해당 링크를 영구 잠금.
--           (본문은 여전히 브라우저에서 PIN 기반 AES-256-GCM으로 암·복호화)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS shared_reports (
  id               TEXT PRIMARY KEY,                    -- 128bit 무작위 ID (base64url)
  ciphertext       TEXT NOT NULL,                       -- 클라이언트 AES-256-GCM 암호문
  pin_hash         TEXT NOT NULL,                       -- bcrypt(PIN)
  created_by       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 5,
  locked_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  last_opened_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_reports_expires ON shared_reports (expires_at);

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
-- 정책 없음: 테이블 직접 접근 전면 차단, 아래 SECURITY DEFINER RPC로만 접근

-- 공유 링크 생성 (로그인 사용자만)
CREATE OR REPLACE FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer DEFAULT 168)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN must be 6 digits' USING ERRCODE = '22023';
  END IF;
  IF p_ciphertext IS NULL OR length(p_ciphertext) = 0 OR length(p_ciphertext) > 200000 THEN
    RAISE EXCEPTION 'invalid ciphertext' USING ERRCODE = '22023';
  END IF;

  -- 사용자당 24시간 내 생성 한도 (남용 방지)
  IF (SELECT count(*) FROM shared_reports WHERE created_by = auth.uid() AND created_at > NOW() - INTERVAL '24 hours') >= 20 THEN
    RAISE EXCEPTION 'too many share links today' USING ERRCODE = '54000';
  END IF;

  v_id := translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_');

  INSERT INTO shared_reports (id, ciphertext, pin_hash, created_by, expires_at)
  VALUES (
    v_id,
    p_ciphertext,
    crypt(p_pin, gen_salt('bf', 10)),
    auth.uid(),
    NOW() + make_interval(hours => LEAST(GREATEST(coalesce(p_ttl_hours, 168), 1), 720))
  );

  -- 만료 데이터 정리
  DELETE FROM shared_reports WHERE expires_at < NOW() - INTERVAL '1 day';

  RETURN v_id;
END;
$$;

-- 공유 링크 열기 (비로그인 수신자도 가능) — 실패 횟수는 예외 없이 커밋되도록 jsonb 반환
CREATE OR REPLACE FUNCTION public.open_shared_report(p_id text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row shared_reports%ROWTYPE;
  v_remaining integer;
BEGIN
  SELECT * INTO v_row FROM shared_reports WHERE id = p_id FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.locked_at IS NOT NULL OR v_row.failed_attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'remaining', 0);
  END IF;

  IF p_pin ~ '^[0-9]{6}$' AND crypt(p_pin, v_row.pin_hash) = v_row.pin_hash THEN
    UPDATE shared_reports SET failed_attempts = 0, last_opened_at = NOW() WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'ciphertext', v_row.ciphertext);
  END IF;

  v_remaining := v_row.max_attempts - (v_row.failed_attempts + 1);
  UPDATE shared_reports
     SET failed_attempts = failed_attempts + 1,
         locked_at = CASE WHEN v_remaining <= 0 THEN NOW() ELSE NULL END
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', false,
    'reason', CASE WHEN v_remaining <= 0 THEN 'locked' ELSE 'wrong_pin' END,
    'remaining', GREATEST(v_remaining, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_shared_report(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shared_report(text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.open_shared_report(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_shared_report(text, text) TO anon, authenticated;

COMMIT;
