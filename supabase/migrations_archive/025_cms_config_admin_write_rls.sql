-- ============================================================================
-- 025. CMS·플랫폼 설정·문의 테이블 쓰기 권한을 관리자로 제한 (PART 3-6)
-- ----------------------------------------------------------------------------
-- 006은 아래 테이블에 authenticated 전체 ALL(USING/WITH CHECK true)을 허용했다.
-- 그래서 로그인한 누구나(카카오·구글 가입 의뢰인 포함) 공개 콘텐츠·팝업·매칭 쿨다운·
-- 회생 정책 기준표·진단 문항을 추가·수정·삭제할 수 있었다.
-- 또 006의 anon_select_client_inquiries(USING true)가 남아 있으면, 누구나 전 의뢰인의
-- 1:1 문의(연락처·첨부 포함)를 조회할 수 있다.
-- 009는 '변호사·직원'도 전체 문의를 조회할 수 있게 했고, members 기반 판정은 위조가 가능했다.
--
-- 변경
--   * 공개 콘텐츠·설정: 조회는 누구나, 쓰기는 관리자(is_platform_admin: role=admin AND aal2)만
--   * client_inquiries: 브라우저 직접 접근 차단 — /api/inquiry(서비스 롤, Turnstile·길이 검증)만 사용.
--     관리자 조회만 RLS로 허용
--   * lawyer_inquiries: 본인 lawyer_id 등록·조회, 관리자 전체
--   * diagnosis_config: 조회는 활성 설정만 누구나, 쓰기는 관리자만
-- 선행: 021
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  pub_tables text[] := ARRAY[
    'news_articles', 'client_qas', 'success_reviews', 'main_banners', 'notices',
    'platform_config', 'popup_config', 'matching_config', 'rehab_policy_settings'
  ];
BEGIN
  FOREACH t IN ARRAY pub_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_anon_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_select_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'authenticated_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_public_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_write', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)', t || '_public_select', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())', t || '_admin_write', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- client_inquiries
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.client_inquiries') IS NOT NULL THEN
    ALTER TABLE client_inquiries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_anon_all_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anon_select_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anon_insert_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "authenticated_all_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_select_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_insert_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "anti_bola_modify_client_inquiries" ON client_inquiries;
    DROP POLICY IF EXISTS "client_inquiries_admin_select" ON client_inquiries;
    CREATE POLICY "client_inquiries_admin_select" ON client_inquiries
      FOR SELECT TO authenticated
      USING (public.is_platform_admin());
    -- INSERT/UPDATE/DELETE 정책 없음 → /api/inquiry(서비스 롤)만 기록
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- lawyer_inquiries (id, data jsonb — data->>'lawyerId')
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.lawyer_inquiries') IS NOT NULL THEN
    ALTER TABLE lawyer_inquiries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_anon_all_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anon_select_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anon_insert_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "authenticated_all_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anti_bola_select_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "anti_bola_insert_lawyer_inquiries" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_own_insert" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_own_or_admin_select" ON lawyer_inquiries;
    DROP POLICY IF EXISTS "lawyer_inquiries_admin_write" ON lawyer_inquiries;
    CREATE POLICY "lawyer_inquiries_own_insert" ON lawyer_inquiries
      FOR INSERT TO authenticated
      WITH CHECK ((data ->> 'lawyerId') = public.current_lawyer_profile_id() OR public.is_platform_admin());
    CREATE POLICY "lawyer_inquiries_own_or_admin_select" ON lawyer_inquiries
      FOR SELECT TO authenticated
      USING ((data ->> 'lawyerId') = public.current_lawyer_profile_id() OR public.is_platform_admin());
    CREATE POLICY "lawyer_inquiries_admin_write" ON lawyer_inquiries
      FOR UPDATE TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- diagnosis_config
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.diagnosis_config') IS NOT NULL THEN
    ALTER TABLE diagnosis_config ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated can manage diagnosis config" ON diagnosis_config;
    DROP POLICY IF EXISTS "anon_modify_config" ON diagnosis_config;
    DROP POLICY IF EXISTS "diagnosis_config_admin_write" ON diagnosis_config;
    CREATE POLICY "diagnosis_config_admin_write" ON diagnosis_config
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
    -- 조회 정책(활성 설정 공개)은 001의 기존 정책 유지
  END IF;
END $$;

COMMIT;

-- 확인
--   일반 로그인 사용자: INSERT INTO notices ... → RLS 오류, SELECT * FROM client_inquiries → 0행
--   관리자(aal2): 공지·배너·설정 쓰기 가능
-- 주의: lawyer_inquiries.data 구조(lawyerId 키)는 저장소 기준 추정 — 적용 전 실제 컬럼 확인
