-- ============================================================
-- 통합어드민 운영 서버화 (OP-2·OP-3·OP-8·OP-9·OP-10)
-- 문제:
--  * 대시보드 숫자는 관리자 브라우저의 상담 요청 사본·members(브라우저)로 셌고, '처리할 일' 목록이 없었다.
--  * 변호사 심사는 승인/해제뿐이라 보완 요청·반려·정지 사유를 남길 수 없고 변호사에게 전달되지 않았다.
--    정지해도 로그인 세션·진행 중 상담 요청이 그대로였다.
--  * 회원 목록은 관리자 브라우저 사본이라 실제 가입자와 달랐고, '정지'는 화면 표시뿐이었다.
-- 바꾼 것:
--  * admin_actions: 관리자 조치 기록 (조치·대상·이전/이후 값·사유, 추가만)
--  * account_status + is_account_active(): 정지 계정은 핵심 표(상담·메시지·사건·서류·영업 DB·계약)를 못 읽고 못 쓴다.
--    의뢰인 상담 요청 함수도 정지 계정을 막는다. 정지하면 로그인 세션을 지운다.
--  * 변호사 심사: lawyer_review_state·lawyer_review_events, admin_review_lawyer(승인·보완 요청·반려·정지·복구·등록번호 대조),
--    변호사 본인은 my_lawyer_review_state()로 사유를 본다. 정지하면 세션 폐기 + 진행 중 상담 요청을 닫고 의뢰인에게 안내
--  * admin_list_lawyer_applications / admin_list_accounts (서버 기준, 직원 계정 제외·이메일 가림)
--  * admin_platform_metrics(기간) / admin_todo_items() / platform_daily_metrics(매일 00:40 스냅샷)
-- 의뢰인 상담 원문·서류는 여기서 읽지 않는다 (건수만, 011 원칙)
-- ============================================================

-- ── 1. 관리자 조치 기록 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 60),
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 40),
  target_id text,
  before_value jsonb,
  after_value jsonb,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON public.admin_actions (target_type, target_id, created_at DESC);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_actions FROM anon, authenticated;
GRANT SELECT ON public.admin_actions TO authenticated;
DROP POLICY IF EXISTS admin_actions_admin_read ON public.admin_actions;
CREATE POLICY admin_actions_admin_read ON public.admin_actions FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.admin_actions_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_actions is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS admin_actions_append_only ON public.admin_actions;
CREATE TRIGGER admin_actions_append_only BEFORE UPDATE OR DELETE ON public.admin_actions
  FOR EACH ROW EXECUTE FUNCTION public.admin_actions_append_only();

CREATE OR REPLACE FUNCTION public.admin_record_action(p_action text, p_target_type text, p_target_id text, p_before jsonb, p_after jsonb, p_reason text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO admin_actions (actor_user_id, actor_email, action, target_type, target_id, before_value, after_value, reason)
  VALUES (auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), p_action, p_target_type, p_target_id, p_before, p_after, nullif(btrim(coalesce(p_reason, '')), ''));
$$;
REVOKE ALL ON FUNCTION public.admin_record_action(text, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;

-- 이메일 가림: ab***@domain
CREATE OR REPLACE FUNCTION public.mask_email(p_email text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_email IS NULL OR position('@' IN p_email) = 0 THEN NULL
              ELSE left(split_part(p_email, '@', 1), 2) || '***@' || split_part(p_email, '@', 2) END;
$$;

-- ── 2. 계정 상태 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_status FROM anon, authenticated;
-- 직접 접근 없음: my_account_status() / admin_set_account_status()

CREATE OR REPLACE FUNCTION public.is_account_active(p_user uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM account_status s
    WHERE s.user_id = coalesce(p_user, auth.uid()) AND s.status = 'suspended' AND (s.until IS NULL OR s.until > now()));
$$;
REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_account_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE coalesce((
    SELECT jsonb_build_object('status', s.status, 'reason', s.reason, 'until', s.until)
    FROM account_status s
    WHERE s.user_id = auth.uid() AND s.status = 'suspended' AND (s.until IS NULL OR s.until > now())),
    jsonb_build_object('status', 'active')) END;
$$;
REVOKE ALL ON FUNCTION public.my_account_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_status() TO authenticated;

-- 세션 폐기 (계정 단위)
CREATE OR REPLACE FUNCTION public.revoke_user_sessions_internal(p_user uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_count integer := 0;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.user_sessions
     SET status = 'revoked', revoked_at = now(), revoked_by = 'admin', revoke_reason = left(coalesce(p_reason, '관리자 조치'), 200)
   WHERE status = 'active' AND (user_id = p_user::text
      OR user_id IN (SELECT la.lawyer_id FROM public.lawyer_accounts la WHERE la.auth_user_id = p_user));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions_internal(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(p_user uuid, p_status text, p_reason text DEFAULT NULL, p_until timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb;
  v_sessions integer := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'status must be active or suspended' USING ERRCODE = '22023'; END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user) THEN RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot change own account' USING ERRCODE = '22023'; END IF;
  IF p_status = 'suspended' AND coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  IF p_until IS NOT NULL AND p_until <= now() THEN RAISE EXCEPTION 'until must be in the future' USING ERRCODE = '22023'; END IF;

  SELECT to_jsonb(s) - 'updated_by' INTO v_before FROM account_status s WHERE s.user_id = p_user;
  INSERT INTO account_status AS s (user_id, status, reason, until, updated_at, updated_by)
  VALUES (p_user, p_status, CASE WHEN p_status = 'suspended' THEN left(btrim(p_reason), 500) END, CASE WHEN p_status = 'suspended' THEN p_until END, now(), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, until = EXCLUDED.until, updated_at = now(), updated_by = auth.uid();
  IF p_status = 'suspended' THEN
    v_sessions := public.revoke_user_sessions_internal(p_user, '계정 정지');
  END IF;
  PERFORM public.admin_record_action(CASE WHEN p_status = 'suspended' THEN 'account_suspend' ELSE 'account_reinstate' END,
    'account', p_user::text, v_before, jsonb_build_object('status', p_status, 'until', p_until), p_reason);
  RETURN jsonb_build_object('status', p_status, 'until', p_until, 'revoked_sessions', v_sessions);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text, timestamptz) TO authenticated;

-- 정지 계정: 핵심 표를 읽지도 쓰지도 못한다 (기존 정책과 AND 로 묶이는 제한 정책)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['consult_requests', 'consult_messages', 'crm_clients', 'case_files', 'cases', 'office_clients',
                           'sales_leads', 'electronic_contracts', 'fee_client_reports', 'case_form_drafts']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS account_active_only ON public.%I', t);
      EXECUTE format('CREATE POLICY account_active_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_account_active()) OR (SELECT public.is_platform_admin()))', t);
    END IF;
  END LOOP;
END $$;

-- 승인 변호사 판정·의뢰인 상담 요청 함수도 정지 계정을 막는다 (서버 함수는 표 정책을 거치지 않으므로)
CREATE OR REPLACE FUNCTION public.current_approved_lawyer_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT la.lawyer_id
  FROM lawyer_accounts la
  WHERE la.auth_user_id = auth.uid() AND la.approved = true AND public.is_account_active(auth.uid())
  LIMIT 1;
$$;

DO $$
DECLARE
  f text;
  v_def text;
  v_new text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.client_request_lawyers(text,text[],text)', 'public.client_withdraw_consult_lawyer(text,text)', 'public.client_set_consult_choice(text,text,text)']
  LOOP
    v_def := pg_get_functiondef(f::regprocedure);
    v_new := replace(v_def, 'IF v_uid IS NULL THEN RAISE EXCEPTION ''login required''',
                            'IF v_uid IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION ''login required''');
    IF v_new = v_def THEN RAISE EXCEPTION 'account check not inserted into %', f; END IF;
    EXECUTE v_new;
  END LOOP;
END $$;

-- ── 3. 변호사 심사 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_review_state (
  lawyer_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'info_requested', 'approved', 'rejected', 'suspended')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  license_checked_at timestamptz,
  license_checked_by uuid,
  license_check_note text CHECK (license_check_note IS NULL OR char_length(license_check_note) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE TABLE IF NOT EXISTS public.lawyer_review_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lawyer_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('approve', 'request_info', 'reject', 'suspend', 'reinstate', 'verify_license')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lawyer_review_events_lawyer_idx ON public.lawyer_review_events (lawyer_id, created_at DESC);
ALTER TABLE public.lawyer_review_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lawyer_review_state, public.lawyer_review_events FROM anon, authenticated;
GRANT SELECT ON public.lawyer_review_state, public.lawyer_review_events TO authenticated;
DROP POLICY IF EXISTS lawyer_review_state_admin_read ON public.lawyer_review_state;
CREATE POLICY lawyer_review_state_admin_read ON public.lawyer_review_state FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS lawyer_review_events_admin_read ON public.lawyer_review_events;
CREATE POLICY lawyer_review_events_admin_read ON public.lawyer_review_events FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 지금 상태를 옮겨 둔다
INSERT INTO public.lawyer_review_state (lawyer_id, status, updated_at)
SELECT la.lawyer_id, CASE WHEN la.approved THEN 'approved' ELSE 'pending' END, coalesce(la.approved_at, la.created_at, now())
FROM public.lawyer_accounts la
ON CONFLICT (lawyer_id) DO NOTHING;

-- 사무소 직원으로 들어온 계정 (변호사 심사 대상 아님)
CREATE OR REPLACE FUNCTION public.account_is_office_staff(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM office_members m WHERE m.user_id = p_user AND m.role NOT IN ('owner', 'lawyer') AND m.status <> 'removed');
$$;
REVOKE ALL ON FUNCTION public.account_is_office_staff(uuid) FROM PUBLIC, anon, authenticated;

-- 영업일 경과 (요청일 다음 날부터 오늘까지)
CREATE OR REPLACE FUNCTION public.business_days_between(p_from timestamptz, p_to timestamptz DEFAULT now())
RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM generate_series(((p_from AT TIME ZONE 'Asia/Seoul')::date + 1), (p_to AT TIME ZONE 'Asia/Seoul')::date, interval '1 day') d
  WHERE extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM business_holidays h WHERE h.day = d::date);
$$;
GRANT EXECUTE ON FUNCTION public.business_days_between(timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_lawyer_applications(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'status') = 'approved', x ->> 'submitted_at')
    FROM (
      SELECT jsonb_build_object(
        'lawyer_id', la.lawyer_id,
        'auth_user_id', la.auth_user_id,
        'email', la.auth_email,
        'name', l.name,
        'firm_name', l.firm_name,
        'region', l.region,
        'license_number', l.data ->> 'licenseNumber',
        'has_license_image', coalesce(pp.data ? 'licenseImageData', false),
        'business_number', pp.data ->> 'businessNumber',
        'approved', la.approved,
        'status', coalesce(rs.status, CASE WHEN la.approved THEN 'approved' ELSE 'pending' END),
        'reason', rs.reason,
        'license_checked_at', rs.license_checked_at,
        'license_check_note', rs.license_check_note,
        'submitted_at', la.created_at,
        'approved_at', la.approved_at,
        'waiting_business_days', CASE WHEN la.approved THEN NULL ELSE public.business_days_between(la.created_at) END,
        'profile_missing', CASE WHEN l.id IS NULL THEN to_jsonb(ARRAY['profile']) ELSE to_jsonb(public.lawyer_profile_missing(l)) END,
        'listed', CASE WHEN l.id IS NULL THEN false ELSE public.lawyer_is_public(l) END,
        'account_active', public.is_account_active(la.auth_user_id)
      ) AS x
      FROM lawyer_accounts la
      LEFT JOIN lawyers l ON l.id = la.lawyer_id
      LEFT JOIN lawyer_private_profiles pp ON pp.lawyer_id = la.lawyer_id
      LEFT JOIN lawyer_review_state rs ON rs.lawyer_id = la.lawyer_id
      WHERE NOT public.account_is_office_staff(la.auth_user_id)
        AND NOT EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = la.lawyer_id)
    ) s
    WHERE p_status IS NULL OR x ->> 'status' = p_status
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_lawyer_applications(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_lawyer_applications(text) TO authenticated;

-- 정지된 변호사의 진행 중 상담 요청을 닫는다 (의뢰인에게 자리 반환 안내)
ALTER TABLE public.consult_request_lawyers DROP CONSTRAINT IF EXISTS consult_request_lawyers_close_reason_check;
ALTER TABLE public.consult_request_lawyers ADD CONSTRAINT consult_request_lawyers_close_reason_check
  CHECK (close_reason IS NULL OR close_reason IN ('declined', 'expired', 'client_withdrew', 'client_chose_other', 'contracted_other', 'lawyer_unavailable'));

CREATE OR REPLACE FUNCTION public.close_seats_for_unavailable_lawyer(p_lawyer_id text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN SELECT l.request_id, q.client_id FROM consult_request_lawyers l JOIN consult_requests q ON q.id = l.request_id
           WHERE l.lawyer_id = p_lawyer_id AND l.status IN ('requested', 'reviewing', 'proposed')
             AND q.status IN ('requested', 'responding', 'comparing', 'counseling')
  LOOP
    UPDATE consult_request_lawyers SET status = 'expired', closed_at = now(), close_reason = 'lawyer_unavailable'
     WHERE request_id = r.request_id AND lawyer_id = p_lawyer_id;
    PERFORM public.consult_request_remove_lawyer(r.request_id, p_lawyer_id, true);
    PERFORM public.consult_client_notice(r.request_id, '요청한 변호사 한 분이 지금 상담을 받을 수 없게 되어 요청이 닫혔어요. 자리가 하나 돌아왔으니 다른 변호사를 골라 요청할 수 있어요.');
    IF r.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM public.notify_user(r.client_id::uuid, 'client', NULL, 'consult_lawyer_unavailable', '다른 변호사를 고를 수 있어요',
        '요청한 변호사 한 분이 지금 상담을 받을 수 없어 자리가 돌아왔어요.', 'chat', r.request_id, 'unavailable:' || r.request_id || ':' || p_lawyer_id);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.close_seats_for_unavailable_lawyer(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_lawyer(p_lawyer_id text, p_action text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acc lawyer_accounts%ROWTYPE;
  v_before jsonb;
  v_status text;
  v_approve boolean;
  v_closed integer := 0;
  v_sessions integer := 0;
  v_title text;
  v_body text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('approve', 'request_info', 'reject', 'suspend', 'reinstate', 'verify_license') THEN
    RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('request_info', 'reject', 'suspend') AND coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_acc FROM lawyer_accounts WHERE lawyer_id = p_lawyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lawyer account not found' USING ERRCODE = 'P0002'; END IF;
  SELECT to_jsonb(s) - 'updated_by' - 'license_checked_by' INTO v_before FROM lawyer_review_state s WHERE s.lawyer_id = p_lawyer_id;
  v_before := coalesce(v_before, '{}'::jsonb) || jsonb_build_object('approved', v_acc.approved);

  IF p_action = 'verify_license' THEN
    INSERT INTO lawyer_review_state AS s (lawyer_id, status, license_checked_at, license_checked_by, license_check_note, updated_at, updated_by)
    VALUES (p_lawyer_id, CASE WHEN v_acc.approved THEN 'approved' ELSE 'pending' END, now(), auth.uid(), left(nullif(btrim(coalesce(p_reason, '')), ''), 300), now(), auth.uid())
    ON CONFLICT (lawyer_id) DO UPDATE SET license_checked_at = now(), license_checked_by = auth.uid(),
      license_check_note = EXCLUDED.license_check_note, updated_at = now(), updated_by = auth.uid();
    v_status := coalesce((SELECT status FROM lawyer_review_state WHERE lawyer_id = p_lawyer_id), 'pending');
  ELSE
    v_status := CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reinstate' THEN 'approved'
                              WHEN 'request_info' THEN 'info_requested' WHEN 'reject' THEN 'rejected' ELSE 'suspended' END;
    v_approve := v_status = 'approved';
    IF p_action = 'reinstate' AND coalesce((SELECT status FROM lawyer_review_state WHERE lawyer_id = p_lawyer_id), '') <> 'suspended' THEN
      RAISE EXCEPTION 'only suspended lawyers can be reinstated' USING ERRCODE = '22023';
    END IF;
    IF p_action = 'suspend' AND NOT v_acc.approved THEN
      RAISE EXCEPTION 'only approved lawyers can be suspended' USING ERRCODE = '22023';
    END IF;
    UPDATE lawyer_accounts
       SET approved = v_approve,
           approved_at = CASE WHEN v_approve THEN coalesce(approved_at, now()) ELSE NULL END,
           approved_by = CASE WHEN v_approve THEN auth.uid() ELSE NULL END
     WHERE lawyer_id = p_lawyer_id;
    INSERT INTO lawyer_review_state AS s (lawyer_id, status, reason, updated_at, updated_by)
    VALUES (p_lawyer_id, v_status, CASE WHEN v_approve THEN NULL ELSE left(btrim(p_reason), 500) END, now(), auth.uid())
    ON CONFLICT (lawyer_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, updated_at = now(), updated_by = auth.uid();
    IF p_action = 'suspend' THEN
      v_sessions := public.revoke_user_sessions_internal(v_acc.auth_user_id, '변호사 이용 정지');
      v_closed := public.close_seats_for_unavailable_lawyer(p_lawyer_id);
    END IF;
  END IF;

  INSERT INTO lawyer_review_events (lawyer_id, action, reason, actor_user_id)
  VALUES (p_lawyer_id, p_action, nullif(left(btrim(coalesce(p_reason, '')), 500), ''), auth.uid());
  PERFORM public.admin_record_action('lawyer_' || p_action, 'lawyer', p_lawyer_id, v_before,
    jsonb_build_object('status', v_status, 'closed_requests', v_closed), p_reason);

  v_title := CASE p_action
    WHEN 'approve' THEN '변호사 심사가 승인됐어요'
    WHEN 'reinstate' THEN '이용 정지가 풀렸어요'
    WHEN 'request_info' THEN '심사에 보완이 필요해요'
    WHEN 'reject' THEN '변호사 심사 결과를 확인해 주세요'
    WHEN 'suspend' THEN '마이김변 이용이 정지됐어요'
    ELSE NULL END;
  v_body := CASE p_action
    WHEN 'approve' THEN '프로필을 채우면 변호사 찾기 목록에 보이고 상담 요청을 받을 수 있어요.'
    WHEN 'reinstate' THEN '다시 상담 요청을 받을 수 있어요.'
    ELSE '사유: ' || left(btrim(coalesce(p_reason, '')), 200) END;
  IF v_title IS NOT NULL AND v_acc.auth_user_id IS NOT NULL THEN
    PERFORM public.notify_user(v_acc.auth_user_id, 'office', NULL, 'lawyer_review', v_title, v_body, 'settings', 'profile', NULL);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'closed_requests', v_closed, 'revoked_sessions', v_sessions);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_lawyer(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_lawyer(text, text, text) TO authenticated;

-- 옛 승인 함수도 같은 기록·처리를 거치게 한다 (화면 일부가 아직 부름)
CREATE OR REPLACE FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lawyer_accounts WHERE lawyer_id = p_lawyer_id) THEN RETURN false; END IF;
  v_status := coalesce((SELECT status FROM lawyer_review_state WHERE lawyer_id = p_lawyer_id), 'pending');
  IF p_approved THEN
    PERFORM public.admin_review_lawyer(p_lawyer_id, CASE WHEN v_status = 'suspended' THEN 'reinstate' ELSE 'approve' END, NULL);
  ELSIF v_status = 'approved' THEN
    PERFORM public.admin_review_lawyer(p_lawyer_id, 'suspend', '관리자가 승인을 해제함');
  END IF;
  RETURN true;
END;
$$;

-- 변호사 본인: 심사 상태·사유
CREATE OR REPLACE FUNCTION public.my_lawyer_review_state()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'lawyer_id', la.lawyer_id,
    'approved', la.approved,
    'status', coalesce(rs.status, CASE WHEN la.approved THEN 'approved' ELSE 'pending' END),
    'reason', CASE WHEN coalesce(rs.status, '') IN ('info_requested', 'rejected', 'suspended') THEN rs.reason END,
    'updated_at', rs.updated_at,
    'submitted_at', la.created_at)
  FROM lawyer_accounts la LEFT JOIN lawyer_review_state rs ON rs.lawyer_id = la.lawyer_id
  WHERE la.auth_user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_lawyer_review_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_lawyer_review_state() TO authenticated;

-- 새 가입 신청은 '심사 대기'로
CREATE OR REPLACE FUNCTION public.trg_lawyer_account_review_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO lawyer_review_state (lawyer_id, status) VALUES (NEW.lawyer_id, CASE WHEN NEW.approved THEN 'approved' ELSE 'pending' END)
  ON CONFLICT (lawyer_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lawyer_account_review_state ON public.lawyer_accounts;
CREATE TRIGGER trg_lawyer_account_review_state AFTER INSERT ON public.lawyer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_lawyer_account_review_state();

-- ── 4. 계정 목록 (서버 기준) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_accounts(p_search text DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('client', 'lawyer', 'staff', 'admin') THEN RAISE EXCEPTION 'unknown kind' USING ERRCODE = '22023'; END IF;
  WITH base AS (
    SELECT u.id, u.email, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'provider', '') AS provider,
           a.alias, la.lawyer_id, la.approved,
           (SELECT m.office_id FROM office_members m WHERE m.user_id = u.id AND m.status <> 'removed' ORDER BY m.created_at LIMIT 1) AS office_id,
           s.status AS acct_status, s.reason AS acct_reason, s.until AS acct_until,
           CASE WHEN u.raw_app_meta_data ->> 'role' = 'admin' THEN 'admin'
                WHEN public.account_is_office_staff(u.id) THEN 'staff'
                WHEN la.lawyer_id IS NOT NULL THEN 'lawyer'
                ELSE 'client' END AS kind
    FROM auth.users u
    LEFT JOIN client_aliases a ON a.auth_user_id = u.id
    LEFT JOIN lawyer_accounts la ON la.auth_user_id = u.id
    LEFT JOIN account_status s ON s.user_id = u.id AND s.status = 'suspended' AND (s.until IS NULL OR s.until > now())
  ), filtered AS (
    SELECT * FROM base
    WHERE (p_kind IS NULL OR kind = p_kind)
      AND (v_q IS NULL OR alias ILIKE '%' || v_q || '%' OR email ILIKE v_q || '%' OR id::text = v_q OR lawyer_id = v_q)
  )
  SELECT (SELECT count(*) FROM filtered),
         coalesce((SELECT jsonb_agg(jsonb_build_object(
            'user_id', f.id, 'kind', f.kind, 'alias', f.alias, 'email', public.mask_email(f.email), 'provider', f.provider,
            'created_at', f.created_at, 'last_sign_in_at', f.last_sign_in_at, 'lawyer_id', f.lawyer_id, 'lawyer_approved', f.approved,
            'office_id', f.office_id, 'status', coalesce(f.acct_status, 'active'), 'status_reason', f.acct_reason, 'status_until', f.acct_until)
            ORDER BY f.created_at DESC)
          FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT v_limit OFFSET v_offset) f), '[]'::jsonb)
    INTO v_total, v_rows;
  RETURN jsonb_build_object('total', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_accounts(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts(text, text, integer, integer) TO authenticated;

-- ── 5. 지표·처리할 일 ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_metrics_core(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT jsonb_build_object(
    'from', p_from, 'to', p_to,
    'consult', jsonb_build_object(
      'created', (SELECT count(*) FROM consult_requests r WHERE r.created_by_lawyer_id IS NULL AND NOT r.admin_hidden AND r.created_at >= p_from AND r.created_at < p_to),
      'hidden', (SELECT count(*) FROM consult_requests r WHERE r.admin_hidden AND r.created_at >= p_from AND r.created_at < p_to),
      'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (
          SELECT r.status, count(*) n FROM consult_requests r
          WHERE r.created_by_lawyer_id IS NULL AND NOT r.admin_hidden AND r.created_at >= p_from AND r.created_at < p_to GROUP BY r.status) s), '{}'::jsonb)),
    'seats', jsonb_build_object(
      'requested', (SELECT count(*) FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to),
      'responded', (SELECT count(*) FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to AND l.responded_at IS NOT NULL),
      'responded_in_time', (SELECT count(*) FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to AND l.responded_at IS NOT NULL AND l.responded_at <= l.respond_by),
      'expired', (SELECT count(*) FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to AND l.close_reason = 'expired'),
      'declined', (SELECT count(*) FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to AND l.close_reason = 'declined'),
      'avg_first_response_hours', (SELECT round((avg(extract(epoch FROM (l.responded_at - l.requested_at))) / 3600)::numeric, 1)
                                   FROM consult_request_lawyers l WHERE l.requested_at >= p_from AND l.requested_at < p_to AND l.responded_at IS NOT NULL)),
    'lawyers', jsonb_build_object(
      'approved', (SELECT count(*) FROM lawyer_accounts la WHERE la.approved AND NOT public.account_is_office_staff(la.auth_user_id)),
      'pending', (SELECT count(*) FROM lawyer_accounts la LEFT JOIN lawyer_review_state rs ON rs.lawyer_id = la.lawyer_id
                  WHERE NOT la.approved AND coalesce(rs.status, 'pending') IN ('pending', 'info_requested') AND NOT public.account_is_office_staff(la.auth_user_id)),
      'listed', (SELECT count(*) FROM lawyers l WHERE public.lawyer_is_public(l)),
      'suspended', (SELECT count(*) FROM lawyer_review_state rs WHERE rs.status = 'suspended')),
    'accounts', jsonb_build_object(
      'clients', (SELECT count(*) FROM client_aliases),
      'new_clients', (SELECT count(*) FROM client_aliases a WHERE a.created_at >= p_from AND a.created_at < p_to),
      'suspended', (SELECT count(*) FROM account_status s WHERE s.status = 'suspended' AND (s.until IS NULL OR s.until > now()))),
    'ads', jsonb_build_object(
      'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (SELECT o.status, count(*) n FROM ad_orders o GROUP BY o.status) s), '{}'::jsonb),
      'paid_amount', coalesce((SELECT sum(coalesce(o.total_amount, o.total_price, 0)) FROM ad_orders o WHERE o.paid_at >= p_from AND o.paid_at < p_to), 0)),
    'inquiries', jsonb_build_object(
      'client_pending', (SELECT count(*) FROM client_inquiries i WHERE coalesce(i.data ->> 'status', 'pending') <> 'replied'),
      'lawyer_pending', (SELECT count(*) FROM lawyer_inquiries i WHERE coalesce(i.data ->> 'status', 'pending') <> 'replied')),
    'checks_completed', (SELECT count(*) FROM audit_logs a WHERE a.action = 'diagnosis_submit' AND a.created_at >= p_from AND a.created_at < p_to)
  );
$$;
REVOKE ALL ON FUNCTION public.platform_metrics_core(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_metrics(p_from timestamptz, p_to timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to OR p_to - p_from > interval '400 days' THEN
    RAISE EXCEPTION 'period must be 1 to 400 days' USING ERRCODE = '22023';
  END IF;
  RETURN public.platform_metrics_core(p_from, p_to);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_todo_items()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb := '[]'::jsonb;
  n integer; t timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;

  SELECT count(*), min(la.created_at) INTO n, t FROM lawyer_accounts la LEFT JOIN lawyer_review_state rs ON rs.lawyer_id = la.lawyer_id
   WHERE NOT la.approved AND coalesce(rs.status, 'pending') = 'pending' AND NOT public.account_is_office_staff(la.auth_user_id);
  IF n > 0 THEN v := v || jsonb_build_object('key', 'lawyer_review', 'label', '변호사 심사 대기', 'count', n, 'oldest_at', t,
    'overdue', public.business_days_between(t) > 2, 'tab', 'lawyers'); END IF;

  SELECT count(*), min(rs.updated_at) INTO n, t FROM lawyer_review_state rs JOIN lawyer_accounts la ON la.lawyer_id = rs.lawyer_id
   WHERE rs.status = 'info_requested' AND NOT la.approved;
  IF n > 0 THEN v := v || jsonb_build_object('key', 'lawyer_info', 'label', '보완 요청한 변호사 (회신 확인)', 'count', n, 'oldest_at', t, 'overdue', false, 'tab', 'lawyers'); END IF;

  SELECT count(*), min(o.requested_at) INTO n, t FROM ad_orders o WHERE o.status = 'pending';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'ad_payment', 'label', '광고 입금 확인 대기', 'count', n, 'oldest_at', t, 'overdue', false, 'tab', 'billing'); END IF;

  SELECT count(*), min(o.ends_on)::timestamptz INTO n, t FROM ad_orders o WHERE o.status = 'active' AND o.ends_on <= (now() AT TIME ZONE 'Asia/Seoul')::date + 7;
  IF n > 0 THEN v := v || jsonb_build_object('key', 'ad_expiring', 'label', '7일 안에 끝나는 광고', 'count', n, 'oldest_at', t, 'overdue', false, 'tab', 'billing'); END IF;

  SELECT count(*), min(i.created_at) INTO n, t FROM client_inquiries i WHERE coalesce(i.data ->> 'status', 'pending') <> 'replied';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'client_inquiry', 'label', '의뢰인 1:1 문의 미답변', 'count', n, 'oldest_at', t,
    'overdue', public.business_days_between(t) > 2, 'tab', 'contents'); END IF;

  SELECT count(*), min(i.created_at) INTO n, t FROM lawyer_inquiries i WHERE coalesce(i.data ->> 'status', 'pending') <> 'replied';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'lawyer_inquiry', 'label', '변호사 문의 미답변', 'count', n, 'oldest_at', t,
    'overdue', public.business_days_between(t) > 2, 'tab', 'contents'); END IF;

  SELECT count(*), min(q.created_at) INTO n, t FROM client_qas q
   WHERE jsonb_typeof(q.data -> 'pendingAnswers') = 'array' AND jsonb_array_length(q.data -> 'pendingAnswers') > 0;
  IF n > 0 THEN v := v || jsonb_build_object('key', 'qna_review', 'label', '검토 대기 변호사 Q&A 답변', 'count', n, 'oldest_at', t, 'overdue', false, 'tab', 'contents'); END IF;

  SELECT count(*), min(l.closed_at) INTO n, t FROM consult_request_lawyers l WHERE l.close_reason = 'expired' AND l.closed_at > now() - interval '7 days';
  IF n > 0 THEN v := v || jsonb_build_object('key', 'seat_expired', 'label', '최근 7일 응답 기한이 지난 요청 (확인용)', 'count', n, 'oldest_at', t, 'overdue', false, 'tab', 'clients'); END IF;

  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_todo_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_todo_items() TO authenticated;

CREATE TABLE IF NOT EXISTS public.platform_daily_metrics (
  day date PRIMARY KEY,
  metrics jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_daily_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_daily_metrics FROM anon, authenticated;
GRANT SELECT ON public.platform_daily_metrics TO authenticated;
DROP POLICY IF EXISTS platform_daily_metrics_admin_read ON public.platform_daily_metrics;
CREATE POLICY platform_daily_metrics_admin_read ON public.platform_daily_metrics FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 어제(한국 날짜) 하루 지표를 남긴다
CREATE OR REPLACE FUNCTION public.snapshot_platform_daily_metrics()
RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Asia/Seoul')::date - 1;
  f timestamptz := (d::timestamp AT TIME ZONE 'Asia/Seoul');
BEGIN
  INSERT INTO platform_daily_metrics (day, metrics) VALUES (d, public.platform_metrics_core(f, f + interval '1 day'))
  ON CONFLICT (day) DO UPDATE SET metrics = EXCLUDED.metrics, created_at = now();
  DELETE FROM platform_daily_metrics WHERE day < d - 800;
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_platform_daily_metrics() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('mykim_platform_daily_metrics') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mykim_platform_daily_metrics');
  PERFORM cron.schedule('mykim_platform_daily_metrics', '40 15 * * *', 'SELECT public.snapshot_platform_daily_metrics();');
END $$;
