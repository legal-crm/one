-- ════════════════════════════════════════════════════════════════════════════
-- HM-7 처음 쓰는 사무소 '시작하기' 점검표 (서버 사실로 판정, 사람이 체크하지 않는다)
-- 대표 변호사 공개 프로필 · 사무소 정보 · 수임료 입금 계좌 · 직인 · 직원 초대 · 알림 받을 곳 · 업무폰
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.office_setup_checklist(p_office_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o offices;
  l lawyers;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF public.current_office_member(p_office_id) IS NULL OR (public.current_office_member(p_office_id)).id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM offices WHERE id = p_office_id;
  SELECT * INTO l FROM lawyers WHERE id = o.owner_lawyer_id;
  IF l.id IS NOT NULL THEN v_missing := public.lawyer_profile_missing(l); END IF;
  RETURN jsonb_build_array(
    jsonb_build_object('key', 'profile', 'label', '대표 변호사 공개 프로필 (변호사 찾기에 보이려면 필요)',
      'done', l.id IS NOT NULL AND public.lawyer_is_public(l), 'detail', to_jsonb(v_missing), 'link', 'profile'),
    jsonb_build_object('key', 'office_info', 'label', '사무소 정보 (서식·계약서·안내문에 들어가요)',
      'done', EXISTS (SELECT 1 FROM office_settings s WHERE s.office_id = p_office_id AND s.section = 'profile' AND s.data <> '{}'::jsonb)
           OR EXISTS (SELECT 1 FROM office_billing_profiles b WHERE b.office_id = p_office_id), 'link', 'office_settings'),
    jsonb_build_object('key', 'deposit_account', 'label', '수임료 입금 계좌',
      'done', EXISTS (SELECT 1 FROM fee_office_accounts a WHERE a.office_id = p_office_id), 'link', 'fees'),
    jsonb_build_object('key', 'seal', 'label', '사무소 직인 (계약서·서식 날인)',
      'done', EXISTS (SELECT 1 FROM office_seals s WHERE s.office_id = p_office_id AND s.kind = 'office_seal' AND s.active), 'link', 'office_settings'),
    jsonb_build_object('key', 'staff', 'label', '함께 일할 직원 초대 (혼자 쓰면 건너뛰어도 돼요)', 'optional', true,
      'done', (SELECT count(*) FROM office_members m WHERE m.office_id = p_office_id AND m.status = 'active') > 1
           OR EXISTS (SELECT 1 FROM office_invites i WHERE i.office_id = p_office_id), 'link', 'staff'),
    jsonb_build_object('key', 'notifications', 'label', '알림 받을 곳 (이메일·사무소 텔레그램 방)', 'optional', true,
      'done', EXISTS (SELECT 1 FROM office_team_channels c WHERE c.office_id = p_office_id)
           OR EXISTS (SELECT 1 FROM user_notification_prefs p JOIN office_members m ON m.user_id = p.user_id
                      WHERE m.office_id = p_office_id AND coalesce(p.email_enabled, false)), 'link', 'notifications'),
    jsonb_build_object('key', 'office_phone', 'label', '업무폰 연결 (통화·문자 기록)', 'optional', true,
      'done', EXISTS (SELECT 1 FROM office_devices d WHERE d.office_id = p_office_id AND d.status = 'active'), 'link', 'office_phone')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.office_setup_checklist(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_setup_checklist(text) TO authenticated;
