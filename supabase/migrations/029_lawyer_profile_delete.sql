-- ============================================================================
-- 029. 변호사 프로필 삭제 (관리자) + 삭제 기록(tombstone)
-- ----------------------------------------------------------------------------
-- 배경
--   028 이후 프로필은 기기 간 동기화되며, DB에 없는 로컬 프로필은 권한 있는 기기가 다시 올린다.
--   그래서 DB에서만 지우면 관리자·변호사 브라우저에 남은 사본이 다음 동기화 때 되살아난다.
--
-- 변경
--   A. lawyer_profile_tombstones: 삭제된 프로필 ID 기록 (공개 조회 — 각 기기가 로컬 사본 제거)
--   B. 삭제 기록이 있는 ID는 앱에서 다시 INSERT되지 않음 (서비스 롤·SQL 편집기는 예외)
--   C. admin_delete_lawyer_profile(): 로그인 계정이 연결되지 않은 프로필만 삭제
--      (연결된 프로필을 지우면 실제 변호사 계정이 빈 프로필로 떨어지므로 거부)
--
-- 되살리기: DELETE FROM lawyer_profile_tombstones WHERE lawyer_id = '...';
-- 선행: 012 (is_platform_admin, lawyer_accounts), 028 (lawyer_private_profiles, lawyer_write_is_system)
-- ============================================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- A. 삭제 기록
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_profile_tombstones (
  lawyer_id  TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID
);

ALTER TABLE public.lawyer_profile_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lawyer_profile_tombstones FROM anon, authenticated;
GRANT SELECT ON public.lawyer_profile_tombstones TO anon, authenticated;
GRANT DELETE ON public.lawyer_profile_tombstones TO authenticated;

DROP POLICY IF EXISTS "lawyer_tombstones_select_all" ON public.lawyer_profile_tombstones;
DROP POLICY IF EXISTS "lawyer_tombstones_delete_admin" ON public.lawyer_profile_tombstones;

-- 프로필 ID는 이미 공개(lawyers)이므로 ID·삭제 시각만 공개 조회 허용
CREATE POLICY "lawyer_tombstones_select_all" ON public.lawyer_profile_tombstones
FOR SELECT TO anon, authenticated USING (true);

-- 되살리기(기록 삭제)는 관리자만. 기록 추가는 admin_delete_lawyer_profile()로만.
CREATE POLICY "lawyer_tombstones_delete_admin" ON public.lawyer_profile_tombstones
FOR DELETE TO authenticated USING (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────
-- B. 삭제된 ID 재생성 차단 (조용히 건너뜀 → 앱은 0행 반환을 보고 다시 불러와 로컬 사본 제거)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_tombstoned_lawyer_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.lawyer_write_is_system() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 이름을 'trg_a...'로 두어 028 트리거들보다 먼저 실행
DROP TRIGGER IF EXISTS trg_a_block_tombstoned_lawyer_insert ON public.lawyers;
CREATE TRIGGER trg_a_block_tombstoned_lawyer_insert
BEFORE INSERT ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.block_tombstoned_lawyer_insert();

DROP TRIGGER IF EXISTS trg_a_block_tombstoned_private_insert ON public.lawyer_private_profiles;
CREATE OR REPLACE FUNCTION public.block_tombstoned_private_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.lawyer_write_is_system() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = NEW.lawyer_id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_a_block_tombstoned_private_insert
BEFORE INSERT ON public.lawyer_private_profiles
FOR EACH ROW EXECUTE FUNCTION public.block_tombstoned_private_insert();

-- ─────────────────────────────────────────────────────────────
-- C. 관리자 삭제 RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_lawyer_profile(p_lawyer_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_lawyer_id), '') = '' THEN
    RAISE EXCEPTION 'lawyer_id required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = p_lawyer_id) THEN
    RAISE EXCEPTION 'profile is linked to a login account' USING ERRCODE = '42501';
  END IF;

  INSERT INTO lawyer_profile_tombstones (lawyer_id, deleted_by)
  VALUES (p_lawyer_id, auth.uid())
  ON CONFLICT (lawyer_id) DO UPDATE SET deleted_at = NOW(), deleted_by = EXCLUDED.deleted_by;

  DELETE FROM lawyer_private_profiles WHERE lawyer_id = p_lawyer_id;
  DELETE FROM lawyers WHERE id = p_lawyer_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_lawyer_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_lawyer_profile(text) TO authenticated;

COMMIT;

-- ============================================================================
-- 롤백
--   DROP TRIGGER trg_a_block_tombstoned_lawyer_insert ON lawyers;
--   DROP TRIGGER trg_a_block_tombstoned_private_insert ON lawyer_private_profiles;
--   DROP FUNCTION admin_delete_lawyer_profile(text), block_tombstoned_lawyer_insert(), block_tombstoned_private_insert();
--   DROP TABLE lawyer_profile_tombstones;
-- ============================================================================
