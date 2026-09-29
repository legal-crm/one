-- ============================================================================
-- 028. 변호사 프로필 DB 동기화 (기기 간 공유)
-- ----------------------------------------------------------------------------
-- 배경
--   변호사 프로필이 브라우저 localStorage에만 저장되어 다른 기기·관리자 화면에서 보이지 않았다.
--   앱이 lawyers 테이블에 쓰기 시작하면서 아래 문제를 서버에서 막는다.
--     1) lawyers는 anon까지 전체 SELECT(006 anon_select_lawyers) → 등록증 이미지·이메일·
--        사업자번호·직인 이미지·관리자 메모가 data JSONB에 들어가면 공개 노출된다.
--     2) 변호사는 본인 행을 UPDATE할 수 있다(018) → 승인 상태, 유료 AI 기능, 광고 등급,
--        매칭 실적을 스스로 바꿀 수 있다.
--
-- 변경
--   A. lawyer_private_profiles: 비공개 필드 전용 테이블 (본인·관리자만 접근, anon 차단)
--   B. lawyers.data에서 비공개 키를 저장 시점에 항상 제거 (기존 값은 A로 이관)
--   C. 비관리자 쓰기 시 관리자 전용 필드 보존, 승인 상태는 lawyer_accounts.approved로 강제
--   D. lawyer_accounts 승인 변경 → lawyers.data.approved / licenseStatus 자동 반영
--
-- 선행: 012 (lawyer_accounts, is_platform_admin), 018 (current_lawyer_profile_id, strip_lawyer_secrets)
-- ============================================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- A. 비공개 프로필 테이블
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_private_profiles (
  lawyer_id  TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid()
);

ALTER TABLE public.lawyer_private_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lawyer_private_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_private_profiles TO authenticated;

DROP POLICY IF EXISTS "lawyer_private_select_self_or_admin" ON public.lawyer_private_profiles;
DROP POLICY IF EXISTS "lawyer_private_insert_self_or_admin" ON public.lawyer_private_profiles;
DROP POLICY IF EXISTS "lawyer_private_update_self_or_admin" ON public.lawyer_private_profiles;
DROP POLICY IF EXISTS "lawyer_private_delete_admin" ON public.lawyer_private_profiles;

CREATE POLICY "lawyer_private_select_self_or_admin" ON public.lawyer_private_profiles
FOR SELECT TO authenticated
USING (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin());

CREATE POLICY "lawyer_private_insert_self_or_admin" ON public.lawyer_private_profiles
FOR INSERT TO authenticated
WITH CHECK (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin());

CREATE POLICY "lawyer_private_update_self_or_admin" ON public.lawyer_private_profiles
FOR UPDATE TO authenticated
USING (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin())
WITH CHECK (lawyer_id = public.current_lawyer_profile_id() OR public.is_platform_admin());

CREATE POLICY "lawyer_private_delete_admin" ON public.lawyer_private_profiles
FOR DELETE TO authenticated
USING (public.is_platform_admin());

-- 서비스 롤·마이그레이션(postgres)·SECURITY DEFINER 함수 내부 쓰기 여부
-- (SECURITY INVOKER — 트리거 안에서 호출해야 실제 호출자 기준으로 판정됨)
CREATE OR REPLACE FUNCTION public.lawyer_write_is_system()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR current_user NOT IN ('authenticated', 'anon');
$$;

-- 변호사 본인은 관리자 메모(aiCaseAnalysisNote)를 바꿀 수 없음
CREATE OR REPLACE FUNCTION public.guard_lawyer_private_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.data := CASE WHEN jsonb_typeof(NEW.data) = 'object' THEN NEW.data ELSE '{}'::jsonb END;
  NEW.updated_at := NOW();
  IF public.lawyer_write_is_system() OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' AND coalesce(OLD.data, '{}'::jsonb) ? 'aiCaseAnalysisNote' THEN
    NEW.data := jsonb_set(NEW.data, '{aiCaseAnalysisNote}', OLD.data -> 'aiCaseAnalysisNote');
  ELSE
    NEW.data := NEW.data - 'aiCaseAnalysisNote';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lawyer_private_profile ON public.lawyer_private_profiles;
CREATE TRIGGER trg_guard_lawyer_private_profile
BEFORE INSERT OR UPDATE ON public.lawyer_private_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_lawyer_private_profile();

-- ─────────────────────────────────────────────────────────────
-- B. lawyers.data 비공개 키 이관 및 제거
--    앱 lawyerService.ts PRIVATE_LAWYER_KEYS와 동일하게 유지할 것
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.lawyer_private_profiles (lawyer_id, data)
SELECT l.id,
       jsonb_strip_nulls(jsonb_build_object(
         'email',              l.data -> 'email',
         'licenseImageData',   l.data -> 'licenseImageData',
         'businessNumber',     l.data -> 'businessNumber',
         'ntsStatus',          l.data -> 'ntsStatus',
         'sealInfo',           l.data -> 'sealInfo',
         'aiCaseAnalysisNote', l.data -> 'aiCaseAnalysisNote'
       ))
FROM public.lawyers l
WHERE jsonb_typeof(l.data) = 'object'
  AND l.data ?| ARRAY['email', 'licenseImageData', 'businessNumber', 'ntsStatus', 'sealInfo', 'aiCaseAnalysisNote']
ON CONFLICT (lawyer_id) DO UPDATE
  SET data = EXCLUDED.data || public.lawyer_private_profiles.data;

CREATE OR REPLACE FUNCTION public.strip_lawyer_secrets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    NEW.data := NEW.data - ARRAY['password', 'email', 'licenseImageData', 'businessNumber', 'ntsStatus', 'sealInfo', 'aiCaseAnalysisNote'];
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.lawyers
   SET data = data - ARRAY['password', 'email', 'licenseImageData', 'businessNumber', 'ntsStatus', 'sealInfo', 'aiCaseAnalysisNote']
 WHERE jsonb_typeof(data) = 'object'
   AND data ?| ARRAY['password', 'email', 'licenseImageData', 'businessNumber', 'ntsStatus', 'sealInfo', 'aiCaseAnalysisNote'];

-- ─────────────────────────────────────────────────────────────
-- C. 관리자 전용 필드 보호 + 승인 상태 서버 강제
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_lawyer_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin_keys text[] := ARRAY['approved', 'licenseStatus', 'aiCaseAnalysisActivatedAt', 'aiCaseAnalysisDeactivatedAt', 'adRegion'];
  v_approved boolean;
  v_status text;
  k text;
BEGIN
  IF public.lawyer_write_is_system() THEN
    RETURN NEW;
  END IF;

  NEW.data := CASE WHEN jsonb_typeof(NEW.data) = 'object' THEN NEW.data ELSE '{}'::jsonb END;

  -- 변호사 본인 쓰기: 관리자 전용 필드는 기존 값 유지(신규 행은 기본값)
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.role := OLD.role;
      NEW.ai_case_analysis_enabled := OLD.ai_case_analysis_enabled;
      NEW.ad_tier := OLD.ad_tier;
      NEW.matched_count := OLD.matched_count;
      NEW.created_at := OLD.created_at;
      FOREACH k IN ARRAY v_admin_keys LOOP
        IF coalesce(OLD.data, '{}'::jsonb) ? k THEN
          NEW.data := jsonb_set(NEW.data, ARRAY[k], OLD.data -> k);
        ELSE
          NEW.data := NEW.data - k;
        END IF;
      END LOOP;
    ELSE
      NEW.role := 'LAWYER';
      NEW.ai_case_analysis_enabled := false;
      NEW.ad_tier := NULL;
      NEW.matched_count := 0;
      NEW.data := NEW.data - v_admin_keys;
    END IF;
  END IF;

  -- 계정이 연결된 프로필은 승인 표시를 서버 권한과 일치시킨다 (관리자 쓰기 포함)
  SELECT la.approved INTO v_approved FROM lawyer_accounts la WHERE la.lawyer_id = NEW.id;
  IF FOUND THEN
    v_status := coalesce(nullif(NEW.data ->> 'licenseStatus', ''), 'pending');
    IF v_approved THEN
      v_status := 'verified';
    ELSIF v_status = 'verified' THEN
      v_status := 'pending';
    END IF;
    NEW.data := jsonb_set(jsonb_set(NEW.data, '{approved}', to_jsonb(v_approved)), '{licenseStatus}', to_jsonb(v_status));
  ELSIF NOT public.is_platform_admin() THEN
    NEW.data := jsonb_set(jsonb_set(NEW.data, '{approved}', 'false'::jsonb), '{licenseStatus}', to_jsonb(coalesce(nullif(NEW.data ->> 'licenseStatus', ''), 'pending')));
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lawyer_admin_fields ON public.lawyers;
CREATE TRIGGER trg_guard_lawyer_admin_fields
BEFORE INSERT OR UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.guard_lawyer_admin_fields();

-- ─────────────────────────────────────────────────────────────
-- D. 서버 승인 변경 → 공개 프로필 승인 표시 반영
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_lawyer_profile_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE lawyers l
     SET data = jsonb_set(
                  jsonb_set(CASE WHEN jsonb_typeof(l.data) = 'object' THEN l.data ELSE '{}'::jsonb END,
                            '{approved}', to_jsonb(NEW.approved)),
                  '{licenseStatus}',
                  to_jsonb(CASE
                    WHEN NEW.approved THEN 'verified'
                    WHEN l.data ->> 'licenseStatus' = 'verified' THEN 'suspended'
                    ELSE coalesce(nullif(l.data ->> 'licenseStatus', ''), 'pending')
                  END)),
         updated_at = NOW()
   WHERE l.id = NEW.lawyer_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_lawyer_profile_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_lawyer_profile_approval ON public.lawyer_accounts;
CREATE TRIGGER trg_sync_lawyer_profile_approval
AFTER INSERT OR UPDATE OF approved, lawyer_id ON public.lawyer_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_lawyer_profile_approval();

-- 기존 매핑 1회 반영
UPDATE public.lawyers l
   SET data = jsonb_set(
                jsonb_set(CASE WHEN jsonb_typeof(l.data) = 'object' THEN l.data ELSE '{}'::jsonb END,
                          '{approved}', to_jsonb(la.approved)),
                '{licenseStatus}',
                to_jsonb(CASE WHEN la.approved THEN 'verified'
                              ELSE coalesce(nullif(l.data ->> 'licenseStatus', ''), 'pending') END))
  FROM public.lawyer_accounts la
 WHERE la.lawyer_id = l.id;

COMMIT;

-- ============================================================================
-- 롤백
--   DROP TRIGGER trg_sync_lawyer_profile_approval ON lawyer_accounts;
--   DROP TRIGGER trg_guard_lawyer_admin_fields ON lawyers;
--   DROP FUNCTION sync_lawyer_profile_approval(), guard_lawyer_admin_fields(),
--                 guard_lawyer_private_profile(), lawyer_write_is_system();
--   018의 strip_lawyer_secrets 정의 재실행 (password만 제거)
--   비공개 필드를 lawyers.data로 되돌릴 필요가 있으면 lawyer_private_profiles에서 병합 후 DROP TABLE.
-- ============================================================================
