-- ============================================================
-- 017: 변호사·사무장 서류 공유 패키지 (진술서·수지표·재산 요약)
-- ------------------------------------------------------------
-- 기존: 공유 패키지를 보낸 사람 브라우저(localStorage)에만 저장 → 받은 변호사 휴대폰에서는 항상
--       "만료/잘못된 링크". 'lds_demo'로 시작하는 토큰은 누구에게나 가짜 의뢰인 서류를 보여줬다.
-- 변경: 서버 테이블에 보관, 받는 사람은 링크 + 수신 휴대폰 번호가 일치할 때만 열람 (5회 오입력 시 잠금, 7일 만료).
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS doc_share_packages (
  token               TEXT PRIMARY KEY,                               -- 192bit 무작위 (base64url)
  owner_user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_phone_hash TEXT NOT NULL,                                 -- sha256(숫자만 남긴 수신 번호)
  recipient_phone_last4 TEXT,
  payload             JSONB NOT NULL,                                  -- 의뢰인이 선택한 서류 데이터
  expires_at          TIMESTAMPTZ NOT NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  viewed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE doc_share_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_share_insert_own ON doc_share_packages;
DROP POLICY IF EXISTS doc_share_select_own ON doc_share_packages;
DROP POLICY IF EXISTS doc_share_delete_own ON doc_share_packages;

-- 로그인한 의뢰인만 본인 소유로 생성, 유효기간 최대 8일
CREATE POLICY doc_share_insert_own ON doc_share_packages
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid() AND expires_at <= NOW() + INTERVAL '8 days');

-- 본인이 만든 공유만 조회·삭제 (받는 사람은 아래 RPC로만 열람)
CREATE POLICY doc_share_select_own ON doc_share_packages
FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY doc_share_delete_own ON doc_share_packages
FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

-- 받는 사람 열람: 토큰 + 수신 휴대폰 번호 대조 (서버에서 검증)
CREATE OR REPLACE FUNCTION open_doc_share(p_token TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row doc_share_packages%ROWTYPE;
  v_digits TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_row FROM doc_share_packages WHERE token = p_token;
  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.failed_attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF length(v_digits) < 10 OR encode(digest(v_digits, 'sha256'), 'hex') <> v_row.recipient_phone_hash THEN
    UPDATE doc_share_packages SET failed_attempts = failed_attempts + 1 WHERE token = p_token;
    RETURN jsonb_build_object('ok', false, 'reason', 'mismatch', 'remaining', GREATEST(0, 4 - v_row.failed_attempts));
  END IF;
  UPDATE doc_share_packages SET failed_attempts = 0, viewed_at = coalesce(viewed_at, NOW()) WHERE token = p_token;
  RETURN jsonb_build_object('ok', true, 'payload', v_row.payload, 'expiresAt', v_row.expires_at);
END;
$$;

REVOKE ALL ON FUNCTION open_doc_share(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_doc_share(TEXT, TEXT) TO anon, authenticated;

-- 링크 존재 여부만 확인 (수신 번호 끝 4자리 힌트 — 개인정보 노출 최소화)
CREATE OR REPLACE FUNCTION peek_doc_share(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN d.token IS NULL OR d.expires_at < NOW() THEN jsonb_build_object('ok', false)
    ELSE jsonb_build_object('ok', true, 'phoneLast4', d.recipient_phone_last4, 'locked', d.failed_attempts >= 5)
  END
  FROM (SELECT 1) x LEFT JOIN doc_share_packages d ON d.token = p_token;
$$;

REVOKE ALL ON FUNCTION peek_doc_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION peek_doc_share(TEXT) TO anon, authenticated;

COMMIT;
