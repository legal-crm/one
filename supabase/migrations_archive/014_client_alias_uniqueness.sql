-- ============================================================================
-- 014. 스텔스 가명 중복 방지
-- ----------------------------------------------------------------------------
-- 가명 조합 공간(약 32만)은 약 670명부터 중복 확률이 50%에 이르고, 앱은 가명으로
-- 본인 상담 요청을 매칭하는 로직이 있어 중복 시 타인 내역이 노출될 수 있다.
-- → 가명 소유 테이블(UNIQUE) + 선점 RPC로 서버에서 유일성을 보장한다.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS client_aliases (
  alias         TEXT PRIMARY KEY,
  auth_user_id  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 공백·대소문자 차이로 인한 사실상 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_aliases_normalized
  ON client_aliases (lower(regexp_replace(alias, '\s+', '', 'g')));

ALTER TABLE client_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_aliases_select_self" ON client_aliases;
CREATE POLICY "client_aliases_select_self" ON client_aliases
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());
-- 쓰기 정책 없음 → claim_client_alias RPC로만 변경

-- 가명 선점/변경: 성공 시 true, 이미 다른 사용자가 사용 중이면 false
CREATE OR REPLACE FUNCTION public.claim_client_alias(p_alias text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alias text := btrim(regexp_replace(coalesce(p_alias, ''), '\s+', ' ', 'g'));
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_alias) < 2 OR char_length(v_alias) > 20 THEN
    RAISE EXCEPTION 'alias length must be 2-20' USING ERRCODE = '22023';
  END IF;
  -- 실명 분리 규칙(clientName.split('_'))과 충돌하는 밑줄 금지
  IF position('_' IN v_alias) > 0 THEN
    RAISE EXCEPTION 'underscore is not allowed in alias' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_id INTO v_owner
  FROM client_aliases
  WHERE lower(regexp_replace(alias, '\s+', '', 'g')) = lower(regexp_replace(v_alias, '\s+', '', 'g'));

  IF FOUND THEN
    RETURN v_owner = v_uid;   -- 본인 가명이면 true, 타인 가명이면 false
  END IF;

  BEGIN
    INSERT INTO client_aliases (alias, auth_user_id) VALUES (v_alias, v_uid)
    ON CONFLICT (auth_user_id) DO UPDATE SET alias = EXCLUDED.alias, updated_at = NOW();
  EXCEPTION WHEN unique_violation THEN
    RETURN false;             -- 동시 선점 경쟁에서 패배
  END;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_alias(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_client_alias(text) TO authenticated;

COMMIT;
