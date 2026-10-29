-- =============================================================================
-- 026. PART 4 공통 인프라 RLS 정리
--   006·20260916 등에 남아 있던 "USING (true)" 전체 허용 정책을 정리한다.
--   ⚠️ 실행 전 확인: 20260916 LeadMaster 안드로이드 앱이 anon 키로 접속 중이면 이 마이그레이션 이후
--      앱은 동기화가 막힌다. 앱을 사무소 계정(승인된 변호사/직원)으로 로그인하도록 바꾼 뒤 실행할 것.
--   멱등(재실행 가능)하게 작성. 012(is_platform_admin, current_approved_lawyer_id)·020(current_tenant_ids)·021 이후 실행.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 앱에서 쓰지 않는 단일행 설정 테이블 → 관리자(2단계 인증) 전용
--    - notification_channel_settings: 006 이후 로그인한 누구나(의뢰인 포함) 읽기·덮어쓰기 가능했다
--    - client_memos: 007에서 모든 사무소의 변호사·직원이 한 행을 공유·덮어쓰기 (사무소 간 분리 없음)
--    - fee_notification_settings, custom_roles, copilot_cases, copilot_rulesets: 006 authenticated ALL
--    src는 이 테이블들을 쓰지 않는다(브라우저 저장소 사용). phase1/phase2의 anon 전체 허용도 함께 제거.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'notification_channel_settings', 'client_memos', 'fee_notification_settings',
    'custom_roles', 'copilot_cases', 'copilot_rulesets'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'allow_anon_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anti_bola_all_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
      'admin_all_' || t, t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. LeadMaster 통화·문자 동기화 테이블 (20260916)
--    이전: FOR ALL TO public USING (true) → 공개 anon 키만 있으면 누구나
--      · 전 사무소 의뢰인 전화번호·문자 본문·통화 기록 조회/삭제
--      · pending_sms에 행을 넣어 사무소 휴대폰으로 임의 문자 발송
--    현재: 승인된 변호사 또는 활성 직원(사무소 소속) + 관리자만.
--    ⚠️ 이 테이블에는 사무소 구분 컬럼이 없어 사무소 간 분리는 아직 안 된다(아래 TODO).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_firm_user()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
      OR public.current_approved_lawyer_id() IS NOT NULL
      OR cardinality(public.current_tenant_ids()) > 0;
$$;
REVOKE ALL ON FUNCTION public.is_firm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_firm_user() TO authenticated;

DO $$
DECLARE
  t text;
  lm_tables text[] := ARRAY['communication_logs', 'pending_sms', 'pending_calls', 'sms_templates'];
BEGIN
  FOREACH t IN ARRAY lm_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow anon and auth read/write ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'firm_users_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_firm_user()) WITH CHECK (public.is_firm_user())',
      'firm_users_all_' || t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- TODO(출시 전): communication_logs 등에 tenant_id 컬럼을 추가하고 is_tenant_member(tenant_id)로 사무소별 분리.

-- ─────────────────────────────────────────────────────────────
-- 3. diagnosis_config: 001의 authenticated_modify_config(로그인한 누구나 진단 문항 수정)가 남아 있었다.
--    025는 다른 이름의 정책만 지웠다. 관리자 쓰기 정책은 025에 있으므로 여기서는 제거만 한다.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.diagnosis_config') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_modify_config" ON public.diagnosis_config';
  END IF;
END $$;
