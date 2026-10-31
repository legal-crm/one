-- ════════════════════════════════════════════════════════════════════════════
-- A-2·RB-7 사무소 로그인 정책 (고정 IP가 없어 IP 허용 목록 대신)
--  * office_settings 구역 'security': { block_overseas: bool, new_device_alert: bool }  (설정 = office.settings.edit, 기본 둘 다 끔)
--  * 해외 로그인 차단: 사무소 구성원의 로그인 세션이 KR이 아닌 국가에서 만들어지면 바로 종료 상태로 기록 → 앱 세션 확인이 로그아웃
--    (관리자 계정 해외 차단은 기존 session_hardening). 국가는 요청 헤더 기준, 모르면 막지 않는다
--  * 새 기기 알림: 지난 90일 안에 같은 기기 종류·운영체제·브라우저로 로그인한 적이 없으면 사무소 대표(office.staff)에게 알림
--  * 대표 알림은 이름 없이 '구성원'·국가·기기 요약만
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_user_sessions_office_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  v_block boolean;
  v_alert boolean;
  v_seen boolean;
  v_dev text;
BEGIN
  IF NEW.status <> 'active' OR NEW.user_role NOT IN ('LAWYER', 'STAFF') OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  FOR m IN
    SELECT om.office_id, om.id AS member_id, om.role, coalesce(s.data, '{}'::jsonb) AS sec
      FROM office_members om
      JOIN offices o ON o.id = om.office_id AND o.status = 'active'
      LEFT JOIN office_settings s ON s.office_id = om.office_id AND s.section = 'security'
     WHERE om.user_id::text = NEW.user_id AND om.status = 'active'
  LOOP
    v_block := coalesce((m.sec ->> 'block_overseas')::boolean, false);
    v_alert := coalesce((m.sec ->> 'new_device_alert')::boolean, false);
    IF v_block AND NEW.location IS NOT NULL AND NEW.location <> 'KR' THEN
      NEW.status := 'revoked';
      NEW.revoked_at := now();
      NEW.revoked_by := 'system';
      NEW.revoke_reason := '사무소 정책: 해외 로그인 차단 (' || NEW.location || ')';
      NEW.is_suspicious := true;
      PERFORM public.notify_office_members(m.office_id, 'office.staff', NULL, 'login_blocked_overseas',
        '해외 로그인을 막았어요', '사무소 구성원 계정의 해외(' || NEW.location || ') 로그인을 사무소 정책으로 막았어요.',
        'setup', 'staff', 'login_blocked:' || NEW.user_id || ':' || to_char(now(), 'YYYYMMDDHH24'));
      RETURN NEW;
    END IF;
    IF v_alert THEN
      SELECT EXISTS (
        SELECT 1 FROM user_sessions us
         WHERE us.user_id = NEW.user_id AND us.created_at > now() - interval '90 days'
           AND coalesce(us.device_type, '') = coalesce(NEW.device_type, '') AND coalesce(us.os, '') = coalesce(NEW.os, '')
           AND coalesce(us.browser, '') = coalesce(NEW.browser, '')) INTO v_seen;
      IF NOT v_seen THEN
        v_dev := concat_ws(' · ', nullif(NEW.device_type, ''), nullif(NEW.os, ''), nullif(NEW.browser, ''));
        PERFORM public.notify_office_members(m.office_id, 'office.staff', NULL, 'new_device_login',
          '새 기기에서 로그인했어요', '사무소 구성원이 처음 쓰는 기기(' || coalesce(nullif(v_dev, ''), '알 수 없음') || coalesce(', ' || NEW.location, '') || ')로 로그인했어요. 본인이 아니면 직원·권한에서 세션을 끊어 주세요.',
          'setup', 'staff', 'new_device:' || NEW.user_id || ':' || md5(coalesce(v_dev, '')));
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'office login policy skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;
-- 이름 순서상 trg_user_sessions_server_fields(국가·역할 채움) 뒤에 실행된다
DROP TRIGGER IF EXISTS trg_user_sessions_zz_office_policy ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_zz_office_policy BEFORE INSERT ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_user_sessions_office_policy();
