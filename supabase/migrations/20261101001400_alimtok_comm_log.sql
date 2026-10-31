-- ============================================================
-- 알림톡 발송 결과를 사건 소통 기록에 남긴다 (KT-2 기록 항목, 12 기획서 2-2 '알림톡(발송 결과)')
-- 브라우저가 아니라 발송한 서버(/api/alimtok, service role)가 팝빌 접수 성공 뒤에만 부른다 → 기록을 꾸며 낼 수 없다.
-- 보낸 사람이 그 사무소의 활성 구성원이고 사건이 그 사무소 것일 때만 남긴다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_alimtok_comm_log(p_office_id text, p_key text, p_user uuid, p_body text, p_note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member uuid;
  v_at timestamptz := now();
  v_body text := nullif(left(btrim(coalesce(p_body, '')), 2000), '');
  v_id uuid;
BEGIN
  IF p_office_id IS NULL OR p_key IS NULL OR p_user IS NULL OR v_body IS NULL THEN RETURN NULL; END IF;
  SELECT m.id INTO v_member FROM office_members m WHERE m.office_id = p_office_id AND m.user_id = p_user AND m.status = 'active' LIMIT 1;
  IF v_member IS NULL OR NOT public.comm_key_in_office(p_office_id, p_key) THEN RETURN NULL; END IF;
  INSERT INTO client_comm_logs (office_id, user_id, member_id, workspace_key, source, channel, direction, result, line_label, body, occurred_at, content_hash, note)
  VALUES (p_office_id, p_user, v_member, p_key, 'alimtok', 'alimtok', 'out', 'sent', '', v_body, v_at,
          public.comm_content_hash('alimtok', 'out', 'sent', v_at, NULL, v_body, ''), nullif(left(btrim(coalesce(p_note, '')), 200), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_alimtok_comm_log(text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_alimtok_comm_log(text, text, uuid, text, text) TO service_role;
