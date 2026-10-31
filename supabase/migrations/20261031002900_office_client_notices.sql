-- ============================================================
-- 사무소 → 의뢰인 앱 안 안내 (CM-3·X-13)
-- 문제: 변호사 화면 단계 버튼(서류 수령·부채증명 발급 시작·개시결정 안내·적립금 안내·집회 안내 등)이
--       addClientNotification으로 '변호사 브라우저'에 알림을 저장해, 의뢰인에게는 아무것도 가지 않았다.
-- 바꾼 것:
--  * office_notify_case_client(사무소, 사건 키, 종류, 제목, 내용): 그 사건을 고칠 권한(case.edit)이 있는 구성원만,
--    사건 키가 이 사무소 것일 때만, 의뢰인 계정이 연결된 사건에만 user_notifications로 보낸다
--  * 제목 2~120자·내용 300자, 주민등록번호 형식 거절, 같은 사건 1시간 20건까지
--  * 활동 기록(office_audit_logs)에 종류만 남긴다 (글 내용은 남기지 않음)
--  * 의뢰인 앱 안 알림만 (외부 발송은 알림톡·업무폰 경로)
-- ============================================================

CREATE OR REPLACE FUNCTION public.office_notify_case_client(
  p_office_id text, p_key text, p_kind text, p_title text, p_body text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
  v_key text := nullif(btrim(coalesce(p_key, '')), '');
  v_kind text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'office_notice');
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_uid uuid;
  v_recent integer;
BEGIN
  IF auth.uid() IS NULL OR v_member.id IS NULL OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_key IS NULL OR NOT public.comm_key_in_office(p_office_id, v_key) THEN
    RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.comm_can(p_office_id, 'case.edit', v_key, NULL, NULL) THEN
    RAISE EXCEPTION 'permission denied: case.edit' USING ERRCODE = '42501';
  END IF;
  IF v_kind NOT IN ('office_notice', 'office_status', 'office_document', 'office_fee', 'office_schedule') THEN
    RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) NOT BETWEEN 2 AND 120 OR char_length(coalesce(v_body, '')) > 300 THEN
    RAISE EXCEPTION 'invalid length' USING ERRCODE = '22023';
  END IF;
  IF (v_title || ' ' || coalesce(v_body, '')) ~ '[0-9]{6}[[:space:]]*-?[[:space:]]*[1-8][0-9]{6}' THEN
    RAISE EXCEPTION 'resident number not allowed' USING ERRCODE = '22023';
  END IF;

  v_uid := public.case_key_client_user(v_key);
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'no_client_account');
  END IF;

  SELECT count(*) INTO v_recent FROM user_notifications n
  WHERE n.recipient_user_id = v_uid AND n.link_id = v_key AND n.kind LIKE 'office\_%'
    AND n.created_at > now() - interval '1 hour';
  IF v_recent >= 20 THEN
    RAISE EXCEPTION 'too many notices' USING ERRCODE = '54000';
  END IF;

  PERFORM public.notify_user(v_uid, 'client', NULL, v_kind, v_title, v_body, 'mypage_case', v_key, NULL);
  PERFORM public.office_log(p_office_id, 'client_notice_sent', 'case', v_key, jsonb_build_object('kind', v_kind));
  RETURN jsonb_build_object('delivered', true);
END;
$$;
REVOKE ALL ON FUNCTION public.office_notify_case_client(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_notify_case_client(text, text, text, text, text) TO authenticated;
