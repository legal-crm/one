-- ============================================================
-- ST-11·RB-7 사무소 2단계 인증 (16 기획서 RB-Q: 대표 필수 · 직원 기본 필수, 사무소가 직원 필수를 끌 수 있음)
--  * 실제 로그인 토큰에는 늘 aal 칸이 있다. aal1(2단계 전)이면 사무소 권한 범위를 'none'으로 → 사무소 데이터가 안 보인다
--  * 서버 작업(service role·pg_cron)은 로그인 사용자가 없어 막지 않는다
--  * 화면은 my_mfa_requirement()로 먼저 등록·확인 화면을 띄운다
-- ============================================================
CREATE OR REPLACE FUNCTION public.office_mfa_needed(p_office_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM office_members m JOIN offices o ON o.id = m.office_id
     WHERE m.office_id = p_office_id AND m.user_id = auth.uid() AND m.status = 'active'
       AND (m.role = 'owner' OR o.staff_mfa_required))
$$;
REVOKE ALL ON FUNCTION public.office_mfa_needed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_mfa_needed(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_mfa_blocked(p_office_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND coalesce(auth.jwt() ->> 'aal', '') = 'aal1'
     AND public.office_mfa_needed(p_office_id)
$$;
REVOKE ALL ON FUNCTION public.office_mfa_blocked(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_mfa_blocked(text) TO authenticated;

-- 권한 범위 맨 앞에서 확인 (본문 나머지는 그대로)
DO $$
DECLARE
  d text := pg_get_functiondef('public.office_permission_scope(text, text)'::regprocedure);
  guard text := E'BEGIN\n  IF public.office_mfa_blocked(p_office_id) THEN RETURN ''none''; END IF;';
BEGIN
  IF position('office_mfa_blocked' IN d) > 0 THEN RETURN; END IF;
  d := regexp_replace(d, '\mBEGIN\M', guard);
  EXECUTE d;
END;
$$;

-- 화면용: 내가 2단계 인증을 해야 하는지
CREATE OR REPLACE FUNCTION public.my_mfa_requirement()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'required', EXISTS (
      SELECT 1 FROM office_members m JOIN offices o ON o.id = m.office_id
       WHERE m.user_id = auth.uid() AND m.status = 'active' AND (m.role = 'owner' OR o.staff_mfa_required)),
    'is_owner', EXISTS (SELECT 1 FROM office_members m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'owner'))
$$;
REVOKE ALL ON FUNCTION public.my_mfa_requirement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mfa_requirement() TO authenticated;

-- 대표: 직원 2단계 인증 필수 켜기/끄기 (대표는 늘 필수)
CREATE OR REPLACE FUNCTION public.set_office_mfa_policy(p_office_id text, p_staff_required boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM office_members m WHERE m.office_id = p_office_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'owner') THEN
    RAISE EXCEPTION 'permission denied: owner only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE offices SET staff_mfa_required = coalesce(p_staff_required, true) WHERE id = p_office_id;
  PERFORM public.office_log(p_office_id, 'security.mfa_policy', 'office', p_office_id, jsonb_build_object('staff_required', coalesce(p_staff_required, true)));
  RETURN coalesce(p_staff_required, true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_mfa_policy(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_mfa_policy(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_mfa_policy(p_office_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.staff_mfa_required FROM offices o
   WHERE o.id = p_office_id AND EXISTS (SELECT 1 FROM office_members m WHERE m.office_id = o.id AND m.user_id = auth.uid() AND m.status = 'active')
$$;
REVOKE ALL ON FUNCTION public.office_mfa_policy(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_mfa_policy(text) TO authenticated;
