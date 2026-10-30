-- ============================================================================
-- 묶음 1. 사무소·권한 바탕 (RB-1·RB-2·RB-4·RB-5·RB-10, 31 기획서 3장)
-- ----------------------------------------------------------------------------
-- - 사무소 = offices (id = 대표 변호사 ID, 기존 tenant_id 값과 같음)
-- - 구성원 = office_members (직원 계정은 변호사 가입(lawyer_accounts)과 분리)
-- - 권한 = office_role_permissions(역할 기본값) + 커스텀 역할 + 사람별 조정, 범위 none/assigned/all
-- - 🔒 변호사 전용 권한은 승인된 변호사 계정 구성원만 (변호사법 제109조 취지, RB-Q4)
-- - 판정 함수: office_role / office_permission_scope / has_office_permission
-- - 활동 기록 office_audit_logs (추가만, 2년 보관)
-- - 기존 current_tenant_ids / tenant_role 을 office_members 기준으로 교체 (020 정책 그대로 동작)
-- - 쓰지 않는 테이블 8개 삭제 (31 기획서 8장, 코드 참조 0 확인 2026-10-30)
-- ============================================================================

-- ── 0. 쓰지 않는 테이블 삭제 ────────────────────────────────────────────────
DROP TABLE IF EXISTS public.cases;
DROP TABLE IF EXISTS public.copilot_cases;
DROP TABLE IF EXISTS public.copilot_rulesets;
DROP TABLE IF EXISTS public.client_memos;
DROP TABLE IF EXISTS public.notification_channel_settings;
DROP TABLE IF EXISTS public.staff_activities;
DROP TABLE IF EXISTS public.activity_logs;
DROP TABLE IF EXISTS public.custom_roles;

-- ── 1. 테이블 ───────────────────────────────────────────────────────────────
CREATE TABLE public.offices (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  owner_lawyer_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  staff_mfa_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.offices IS '사무소. id는 대표 변호사 ID(기존 tenant_id 값과 같음)';

CREATE TABLE public.office_role_permissions (
  role text NOT NULL CHECK (role IN ('owner', 'lawyer', 'consultant', 'clerk', 'accounting')),
  permission text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('none', 'assigned', 'all')),
  lawyer_only boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, permission)
);
COMMENT ON TABLE public.office_role_permissions IS '역할별 기본 권한. src/services/office/officePermissions.ts 와 같은 목록';

CREATE TABLE public.office_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 30),
  base_role text NOT NULL CHECK (base_role IN ('lawyer', 'consultant', 'clerk', 'accounting')),
  scopes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (office_id, name)
);

CREATE TABLE public.office_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id text,
  display_name text NOT NULL DEFAULT '',
  email text,
  role text NOT NULL CHECK (role IN ('owner', 'lawyer', 'consultant', 'clerk', 'accounting', 'custom')),
  custom_role_id uuid REFERENCES public.office_custom_roles(id) ON DELETE SET NULL,
  scope_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  supervising_member_id uuid REFERENCES public.office_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'left')),
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  left_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, user_id),
  CHECK (role <> 'custom' OR custom_role_id IS NOT NULL)
);
CREATE INDEX idx_office_members_user ON public.office_members (user_id) WHERE status = 'active';

CREATE TABLE public.office_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('lawyer', 'consultant', 'clerk', 'accounting', 'custom')),
  custom_role_id uuid REFERENCES public.office_custom_roles(id) ON DELETE SET NULL,
  email text,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX idx_office_invites_office ON public.office_invites (office_id, created_at DESC);

CREATE TABLE public.office_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_member_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  purge_after date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date + 730)
);
CREATE INDEX idx_office_audit_logs_office ON public.office_audit_logs (office_id, created_at DESC);
COMMENT ON TABLE public.office_audit_logs IS '사무소 활동 기록(추가만, 2년 보관, 통합관리자는 내용 열람 안 함)';

-- ── 2. 역할 기본 권한 (16 기획서 4-3 표) ────────────────────────────────────
INSERT INTO public.office_role_permissions (role, permission, scope, lawyer_only) VALUES
  -- 상담
  ('owner','consult.view','all',false), ('lawyer','consult.view','all',false), ('consultant','consult.view','all',false), ('clerk','consult.view','none',false), ('accounting','consult.view','none',false),
  ('owner','consult.chat','all',false), ('lawyer','consult.chat','assigned',false), ('consultant','consult.chat','assigned',false), ('clerk','consult.chat','none',false), ('accounting','consult.chat','none',false),
  ('owner','proposal.draft','all',false), ('lawyer','proposal.draft','all',false), ('consultant','proposal.draft','all',false), ('clerk','proposal.draft','none',false), ('accounting','proposal.draft','none',false),
  ('owner','proposal.send','all',true), ('lawyer','proposal.send','all',true), ('consultant','proposal.send','none',true), ('clerk','proposal.send','none',true), ('accounting','proposal.send','none',true),
  -- 사건
  ('owner','case.view','all',false), ('lawyer','case.view','assigned',false), ('consultant','case.view','assigned',false), ('clerk','case.view','assigned',false), ('accounting','case.view','all',false),
  ('owner','case.edit','all',false), ('lawyer','case.edit','assigned',false), ('consultant','case.edit','assigned',false), ('clerk','case.edit','assigned',false), ('accounting','case.edit','none',false),
  ('owner','case.assign','all',false), ('lawyer','case.assign','assigned',false), ('consultant','case.assign','none',false), ('clerk','case.assign','none',false), ('accounting','case.assign','none',false),
  ('owner','case.delete','all',false), ('lawyer','case.delete','none',false), ('consultant','case.delete','none',false), ('clerk','case.delete','none',false), ('accounting','case.delete','none',false),
  ('owner','client.contact','all',false), ('lawyer','client.contact','assigned',false), ('consultant','client.contact','assigned',false), ('clerk','client.contact','assigned',false), ('accounting','client.contact','assigned',false),
  -- 계약
  ('owner','contract.draft','all',false), ('lawyer','contract.draft','assigned',false), ('consultant','contract.draft','assigned',false), ('clerk','contract.draft','assigned',false), ('accounting','contract.draft','none',false),
  ('owner','contract.send','all',true), ('lawyer','contract.send','assigned',true), ('consultant','contract.send','none',true), ('clerk','contract.send','none',true), ('accounting','contract.send','none',true),
  -- 서류·보정·서식
  ('owner','documents.manage','all',false), ('lawyer','documents.manage','assigned',false), ('consultant','documents.manage','none',false), ('clerk','documents.manage','assigned',false), ('accounting','documents.manage','none',false),
  ('owner','correction.manage','all',false), ('lawyer','correction.manage','assigned',false), ('consultant','correction.manage','none',false), ('clerk','correction.manage','assigned',false), ('accounting','correction.manage','none',false),
  ('owner','correction.finalize','all',true), ('lawyer','correction.finalize','assigned',true), ('consultant','correction.finalize','none',true), ('clerk','correction.finalize','none',true), ('accounting','correction.finalize','none',true),
  ('owner','court_forms.manage','all',false), ('lawyer','court_forms.manage','assigned',false), ('consultant','court_forms.manage','none',false), ('clerk','court_forms.manage','assigned',false), ('accounting','court_forms.manage','none',false),
  -- 수납
  ('owner','fee.view','all',false), ('lawyer','fee.view','assigned',false), ('consultant','fee.view','none',false), ('clerk','fee.view','none',false), ('accounting','fee.view','all',false),
  ('owner','fee.record','all',false), ('lawyer','fee.record','none',false), ('consultant','fee.record','none',false), ('clerk','fee.record','none',false), ('accounting','fee.record','all',false),
  -- 영업 DB (상담·사무 직원은 내 리드 = assigned)
  ('owner','sales.view','all',false), ('lawyer','sales.view','all',false), ('consultant','sales.view','assigned',false), ('clerk','sales.view','assigned',false), ('accounting','sales.view','none',false),
  ('owner','sales.manage','all',false), ('lawyer','sales.manage','none',false), ('consultant','sales.manage','none',false), ('clerk','sales.manage','none',false), ('accounting','sales.manage','none',false),
  ('owner','sales.convert','all',false), ('lawyer','sales.convert','all',false), ('consultant','sales.convert','all',false), ('clerk','sales.convert','none',false), ('accounting','sales.convert','none',false),
  -- 소통·증빙
  ('owner','comm.view','all',false), ('lawyer','comm.view','assigned',false), ('consultant','comm.view','assigned',false), ('clerk','comm.view','assigned',false), ('accounting','comm.view','none',false),
  ('owner','comm.recording','all',false), ('lawyer','comm.recording','assigned',false), ('consultant','comm.recording','assigned',false), ('clerk','comm.recording','none',false), ('accounting','comm.recording','none',false),
  ('owner','comm.export','all',false), ('lawyer','comm.export','none',false), ('consultant','comm.export','none',false), ('clerk','comm.export','none',false), ('accounting','comm.export','none',false),
  -- 공개 Q&A
  ('owner','qna.answer','all',true), ('lawyer','qna.answer','all',true), ('consultant','qna.answer','none',true), ('clerk','qna.answer','none',true), ('accounting','qna.answer','none',true),
  -- 광고·결제
  ('owner','ads.manage','all',false), ('lawyer','ads.manage','none',false), ('consultant','ads.manage','none',false), ('clerk','ads.manage','none',false), ('accounting','ads.manage','none',false),
  ('owner','billing.view','all',false), ('lawyer','billing.view','none',false), ('consultant','billing.view','none',false), ('clerk','billing.view','none',false), ('accounting','billing.view','all',false),
  -- 사무소
  ('owner','office.staff','all',false), ('lawyer','office.staff','none',false), ('consultant','office.staff','none',false), ('clerk','office.staff','none',false), ('accounting','office.staff','none',false),
  ('owner','office.settings.view','all',false), ('lawyer','office.settings.view','all',false), ('consultant','office.settings.view','none',false), ('clerk','office.settings.view','none',false), ('accounting','office.settings.view','none',false),
  ('owner','office.settings.edit','all',false), ('lawyer','office.settings.edit','none',false), ('consultant','office.settings.edit','none',false), ('clerk','office.settings.edit','none',false), ('accounting','office.settings.edit','none',false),
  ('owner','office.audit','all',false), ('lawyer','office.audit','none',false), ('consultant','office.audit','none',false), ('clerk','office.audit','none',false), ('accounting','office.audit','none',false),
  ('owner','data.export','all',false), ('lawyer','data.export','none',false), ('consultant','data.export','none',false), ('clerk','data.export','none',false), ('accounting','data.export','none',false),
  ('owner','fee.export','all',false), ('lawyer','fee.export','none',false), ('consultant','fee.export','none',false), ('clerk','fee.export','none',false), ('accounting','fee.export','all',false),
  ('owner','vault.view','assigned',false), ('lawyer','vault.view','assigned',false), ('consultant','vault.view','none',false), ('clerk','vault.view','assigned',false), ('accounting','vault.view','none',false);

-- ── 3. 판정 함수 ────────────────────────────────────────────────────────────
-- 사건 배정 확인: 묶음 2(cases)에서 실제 판정으로 교체. 그 전까지는 '배정' 범위로는 아무 사건도 열리지 않음.
CREATE FUNCTION public.is_case_assignee(p_case_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT false; $$;

-- 내 활성 구성원 기록 (정지·탈퇴·사무소 정지면 없음)
CREATE FUNCTION public.current_office_member(p_office_id text) RETURNS public.office_members
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT m.*
  FROM office_members m
  JOIN offices o ON o.id = m.office_id AND o.status = 'active'
  WHERE m.office_id = p_office_id AND m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1;
$$;

CREATE FUNCTION public.current_office_ids() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(array_agg(m.office_id ORDER BY m.joined_at), '{}')
  FROM office_members m
  JOIN offices o ON o.id = m.office_id AND o.status = 'active'
  WHERE m.user_id = auth.uid() AND m.status = 'active';
$$;

CREATE FUNCTION public.office_role(p_office_id text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT (public.current_office_member(p_office_id)).role; $$;

-- 구성원이 승인된 변호사 계정인지 (🔒 권한·담당 변호사 역할 조건)
CREATE FUNCTION public.member_is_verified_lawyer(p_member public.office_members) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_member.lawyer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM lawyer_accounts la
    WHERE la.auth_user_id = p_member.user_id AND la.lawyer_id = p_member.lawyer_id AND la.approved = true);
$$;

-- 권한 범위: none / assigned / all
CREATE FUNCTION public.office_permission_scope(p_office_id text, p_permission text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member office_members;
  v_base text;
  v_scope text;
  v_lawyer_only boolean;
  v_custom jsonb;
  v_override text;
BEGIN
  IF auth.uid() IS NULL OR p_office_id IS NULL THEN RETURN 'none'; END IF;
  v_member := public.current_office_member(p_office_id);
  IF v_member.id IS NULL THEN RETURN 'none'; END IF;

  IF v_member.role = 'custom' THEN
    SELECT r.base_role, r.scopes INTO v_base, v_custom FROM office_custom_roles r WHERE r.id = v_member.custom_role_id;
    IF v_base IS NULL THEN RETURN 'none'; END IF;
  ELSE
    v_base := v_member.role;
  END IF;

  SELECT p.scope, p.lawyer_only INTO v_scope, v_lawyer_only
  FROM office_role_permissions p WHERE p.role = v_base AND p.permission = p_permission;
  IF v_scope IS NULL THEN RETURN 'none'; END IF;

  -- 🔒 변호사 전용: 바꿀 수 없음. 승인된 변호사 계정의 대표·담당 변호사만 기본 범위 그대로
  IF v_lawyer_only THEN
    IF v_base IN ('owner', 'lawyer') AND public.member_is_verified_lawyer(v_member) THEN
      RETURN v_scope;
    END IF;
    RETURN 'none';
  END IF;

  IF v_custom IS NOT NULL AND v_custom ? p_permission THEN
    v_scope := v_custom ->> p_permission;
  END IF;
  v_override := v_member.scope_overrides ->> p_permission;
  IF v_override IS NOT NULL THEN v_scope := v_override; END IF;

  IF v_scope NOT IN ('none', 'assigned', 'all') THEN RETURN 'none'; END IF;
  RETURN v_scope;
END;
$$;

CREATE FUNCTION public.has_office_permission(p_office_id text, p_permission text, p_case_id uuid DEFAULT NULL) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_scope text := public.office_permission_scope(p_office_id, p_permission);
BEGIN
  IF v_scope = 'all' THEN RETURN true; END IF;
  IF v_scope = 'assigned' AND p_case_id IS NOT NULL THEN
    RETURN public.is_case_assignee(p_case_id);
  END IF;
  RETURN false;
END;
$$;

-- 화면용: 내 사무소 목록과 권한표 한 번에
CREATE FUNCTION public.my_office_context() RETURNS TABLE(
  office_id text, office_name text, office_status text, member_id uuid, role text, custom_role_id uuid,
  is_verified_lawyer boolean, lawyer_id text, permissions jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.status, m.id, m.role, m.custom_role_id,
         public.member_is_verified_lawyer(m), m.lawyer_id,
         (SELECT coalesce(jsonb_object_agg(p.permission, public.office_permission_scope(o.id, p.permission)), '{}'::jsonb)
            FROM (SELECT DISTINCT permission FROM office_role_permissions) p)
  FROM office_members m
  JOIN offices o ON o.id = m.office_id AND o.status = 'active'
  WHERE m.user_id = auth.uid() AND m.status = 'active'
  ORDER BY (m.role = 'owner') DESC, m.joined_at;
END;
$$;

-- ── 4. 활동 기록 ────────────────────────────────────────────────────────────
CREATE FUNCTION public.office_log(p_office_id text, p_action text, p_target_type text, p_target_id text, p_detail jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member office_members := public.current_office_member(p_office_id);
BEGIN
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'not an office member' USING ERRCODE = '42501';
  END IF;
  INSERT INTO office_audit_logs (office_id, actor_user_id, actor_member_id, action, target_type, target_id, detail, ip_address)
  VALUES (p_office_id, auth.uid(), v_member.id, left(p_action, 80), left(p_target_type, 40), left(p_target_id, 120),
          coalesce(p_detail, '{}'::jsonb), public.request_client_ip());
END;
$$;

-- ── 5. 사무소 생성: 승인된 변호사 계정 = 사무소 대표 ─────────────────────────
CREATE FUNCTION public.ensure_owner_office(p_lawyer_id text, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF p_lawyer_id IS NULL OR p_user_id IS NULL THEN RETURN; END IF;
  -- 다른 사무소의 활성 직원이면 따로 사무소를 만들지 않음 (16 기획서 4-2)
  IF EXISTS (SELECT 1 FROM office_members m WHERE m.user_id = p_user_id AND m.status = 'active' AND m.office_id <> p_lawyer_id) THEN
    RETURN;
  END IF;
  SELECT coalesce(nullif(btrim(l.firm_name), ''), nullif(btrim(l.name), ''), '')
    INTO v_name FROM lawyers l WHERE l.id = p_lawyer_id;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  INSERT INTO offices (id, name, owner_lawyer_id) VALUES (p_lawyer_id, coalesce(v_name, ''), p_lawyer_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO office_members (office_id, user_id, lawyer_id, display_name, email, role, status)
  VALUES (p_lawyer_id, p_user_id, p_lawyer_id, '', v_email, 'owner', 'active')
  ON CONFLICT (office_id, user_id) DO UPDATE SET status = 'active', role = 'owner', lawyer_id = EXCLUDED.lawyer_id,
    suspended_at = NULL, left_at = NULL, updated_at = now();
END;
$$;

CREATE FUNCTION public.lawyer_accounts_office_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.approved AND (TG_OP = 'INSERT' OR OLD.approved IS DISTINCT FROM NEW.approved) THEN
    PERFORM public.ensure_owner_office(NEW.lawyer_id, NEW.auth_user_id);
  ELSIF NOT NEW.approved AND TG_OP = 'UPDATE' AND OLD.approved THEN
    -- 승인 해제(정지) = 그 사무소 전체 정지. 구성원 기록은 남겨 다시 승인하면 복구
    UPDATE offices SET status = 'suspended', updated_at = now() WHERE id = NEW.lawyer_id;
  END IF;
  IF NEW.approved AND TG_OP = 'UPDATE' AND NOT OLD.approved THEN
    UPDATE offices SET status = 'active', updated_at = now() WHERE id = NEW.lawyer_id AND status = 'suspended';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lawyer_accounts_office_sync
  AFTER INSERT OR UPDATE OF approved ON public.lawyer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.lawyer_accounts_office_sync();

-- 이미 승인된 변호사 계정 → 사무소·대표 구성원
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT lawyer_id, auth_user_id FROM lawyer_accounts WHERE approved LOOP
    PERFORM public.ensure_owner_office(r.lawyer_id, r.auth_user_id);
  END LOOP;
END $$;

-- ── 6. 초대·구성원 관리 (RB-2: 직원 계정은 변호사 가입과 분리) ────────────────
CREATE FUNCTION public.create_office_invite(p_office_id text, p_role text, p_email text DEFAULT NULL, p_ttl_hours integer DEFAULT 48, p_custom_role_id uuid DEFAULT NULL)
  RETURNS TABLE(invite_id uuid, token text, expires_at timestamptz)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  v_token text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.staff') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('lawyer', 'consultant', 'clerk', 'accounting', 'custom') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'custom' AND NOT EXISTS (SELECT 1 FROM office_custom_roles r WHERE r.id = p_custom_role_id AND r.office_id = p_office_id) THEN
    RAISE EXCEPTION 'invalid custom role' USING ERRCODE = '22023';
  END IF;
  IF p_ttl_hours NOT IN (24, 48, 168) THEN
    RAISE EXCEPTION 'invalid ttl' USING ERRCODE = '22023';
  END IF;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_exp := now() + make_interval(hours => p_ttl_hours);
  INSERT INTO office_invites (office_id, token_hash, role, custom_role_id, email, expires_at, created_by)
  VALUES (p_office_id, encode(digest(v_token, 'sha256'), 'hex'), p_role,
          CASE WHEN p_role = 'custom' THEN p_custom_role_id END,
          nullif(lower(btrim(coalesce(p_email, ''))), ''), v_exp, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.office_log(p_office_id, 'invite.create', 'office_invite', v_id::text,
    jsonb_build_object('role', p_role, 'email_restricted', p_email IS NOT NULL AND btrim(p_email) <> '', 'ttl_hours', p_ttl_hours));
  RETURN QUERY SELECT v_id, v_token, v_exp;
END;
$$;

CREATE FUNCTION public.peek_office_invite(p_token text) RETURNS TABLE(office_name text, role text, expires_at timestamptz, email_restricted boolean, valid boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT o.name, i.role, i.expires_at, i.email IS NOT NULL,
         (i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() AND o.status = 'active')
  FROM office_invites i JOIN offices o ON o.id = i.office_id
  WHERE i.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
END;
$$;

CREATE FUNCTION public.accept_office_invite(p_token text, p_display_name text DEFAULT '') RETURNS TABLE(office_id text, role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv office_invites;
  v_lawyer_id text;
  v_role text;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_inv FROM office_invites i
   WHERE i.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite' USING ERRCODE = 'P0002'; END IF;
  IF v_inv.used_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite already used' USING ERRCODE = '42501'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invite expired' USING ERRCODE = '42501'; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_inv.email IS NOT NULL AND v_inv.email <> v_email THEN
    RAISE EXCEPTION 'invite is restricted to another email' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM offices o WHERE o.id = v_inv.office_id AND o.owner_lawyer_id IN
             (SELECT la.lawyer_id FROM lawyer_accounts la WHERE la.auth_user_id = v_uid)) THEN
    RAISE EXCEPTION 'cannot accept own office invite' USING ERRCODE = '42501';
  END IF;

  -- 담당 변호사 역할은 승인된 변호사 계정만. 아니면 승인 전까지 상담 직원 권한 (16 기획서 4-2)
  SELECT la.lawyer_id INTO v_lawyer_id FROM lawyer_accounts la WHERE la.auth_user_id = v_uid AND la.approved LIMIT 1;
  v_role := v_inv.role;
  IF v_role = 'lawyer' AND v_lawyer_id IS NULL THEN v_role := 'consultant'; END IF;

  INSERT INTO office_members (office_id, user_id, lawyer_id, display_name, email, role, custom_role_id, status, invited_by)
  VALUES (v_inv.office_id, v_uid, v_lawyer_id, left(btrim(coalesce(p_display_name, '')), 50), v_email, v_role,
          v_inv.custom_role_id, 'active', v_inv.created_by)
  ON CONFLICT (office_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, custom_role_id = EXCLUDED.custom_role_id, status = 'active', lawyer_id = EXCLUDED.lawyer_id,
        suspended_at = NULL, left_at = NULL, scope_overrides = '{}'::jsonb, updated_at = now()
  RETURNING id INTO v_member_id;

  UPDATE office_invites SET used_by = v_uid, used_at = now() WHERE id = v_inv.id;
  INSERT INTO office_audit_logs (office_id, actor_user_id, actor_member_id, action, target_type, target_id, detail, ip_address)
  VALUES (v_inv.office_id, v_uid, v_member_id, 'invite.accept', 'office_member', v_member_id::text,
          jsonb_build_object('role', v_role, 'invited_role', v_inv.role), public.request_client_ip());
  RETURN QUERY SELECT v_inv.office_id, v_role;
END;
$$;

CREATE FUNCTION public.revoke_office_invite(p_invite_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_office text;
BEGIN
  SELECT office_id INTO v_office FROM office_invites WHERE id = p_invite_id;
  IF v_office IS NULL OR NOT public.has_office_permission(v_office, 'office.staff') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  UPDATE office_invites SET revoked_at = now() WHERE id = p_invite_id AND used_at IS NULL AND revoked_at IS NULL;
  PERFORM public.office_log(v_office, 'invite.revoke', 'office_invite', p_invite_id::text);
END;
$$;

-- 역할·상태·범위 조정 (대표만, 대표 자신·🔒 권한은 바꿀 수 없음)
CREATE FUNCTION public.update_office_member(p_member_id uuid, p_role text DEFAULT NULL, p_status text DEFAULT NULL,
                                            p_scope_overrides jsonb DEFAULT NULL, p_custom_role_id uuid DEFAULT NULL,
                                            p_supervising_member_id uuid DEFAULT NULL)
  RETURNS public.office_members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_m office_members;
  v_key text;
  v_val text;
  v_new office_members;
BEGIN
  SELECT * INTO v_m FROM office_members WHERE id = p_member_id FOR UPDATE;
  IF v_m.id IS NULL OR NOT public.has_office_permission(v_m.office_id, 'office.staff') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_m.role = 'owner' THEN RAISE EXCEPTION 'owner cannot be changed' USING ERRCODE = '42501'; END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('lawyer', 'consultant', 'clerk', 'accounting', 'custom') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'lawyer' AND NOT public.member_is_verified_lawyer(v_m) THEN
    RAISE EXCEPTION 'lawyer role requires a verified lawyer account' USING ERRCODE = '42501';
  END IF;
  IF p_role = 'custom' AND NOT EXISTS (SELECT 1 FROM office_custom_roles r WHERE r.id = p_custom_role_id AND r.office_id = v_m.office_id) THEN
    RAISE EXCEPTION 'invalid custom role' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'suspended', 'left') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_scope_overrides IS NOT NULL THEN
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(p_scope_overrides) LOOP
      IF v_val NOT IN ('none', 'assigned', 'all') THEN RAISE EXCEPTION 'invalid scope' USING ERRCODE = '22023'; END IF;
      IF EXISTS (SELECT 1 FROM office_role_permissions p WHERE p.permission = v_key AND p.lawyer_only) THEN
        RAISE EXCEPTION 'lawyer-only permission cannot be overridden' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM office_role_permissions p WHERE p.permission = v_key) THEN
        RAISE EXCEPTION 'unknown permission %', v_key USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF p_supervising_member_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM office_members s WHERE s.id = p_supervising_member_id AND s.office_id = v_m.office_id
         AND s.status = 'active' AND s.role IN ('owner', 'lawyer')) THEN
    RAISE EXCEPTION 'supervisor must be a lawyer of this office' USING ERRCODE = '22023';
  END IF;

  UPDATE office_members SET
    role = coalesce(p_role, role),
    custom_role_id = CASE WHEN coalesce(p_role, role) = 'custom' THEN coalesce(p_custom_role_id, custom_role_id) ELSE NULL END,
    status = coalesce(p_status, status),
    suspended_at = CASE WHEN p_status = 'suspended' THEN now() WHEN p_status = 'active' THEN NULL ELSE suspended_at END,
    left_at = CASE WHEN p_status = 'left' THEN now() WHEN p_status = 'active' THEN NULL ELSE left_at END,
    scope_overrides = coalesce(p_scope_overrides, scope_overrides),
    supervising_member_id = coalesce(p_supervising_member_id, supervising_member_id),
    updated_at = now()
  WHERE id = p_member_id
  RETURNING * INTO v_new;

  PERFORM public.office_log(v_m.office_id, 'member.update', 'office_member', p_member_id::text, jsonb_build_object(
    'before', jsonb_build_object('role', v_m.role, 'status', v_m.status, 'scope_overrides', v_m.scope_overrides),
    'after', jsonb_build_object('role', v_new.role, 'status', v_new.status, 'scope_overrides', v_new.scope_overrides)));

  -- 정지·탈퇴: 그 사람의 세션 기록을 즉시 끊음 (서버 세션 폐기는 사무소 대표 함수로 분리, 21 결정)
  IF p_status IN ('suspended', 'left') THEN
    UPDATE user_sessions SET status = 'revoked' WHERE user_id = v_m.user_id::text AND status = 'active';
  END IF;
  RETURN v_new;
END;
$$;

CREATE FUNCTION public.save_office_custom_role(p_office_id text, p_id uuid, p_name text, p_base_role text, p_scopes jsonb)
  RETURNS public.office_custom_roles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_key text;
  v_val text;
  v_row office_custom_roles;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.staff') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(coalesce(p_scopes, '{}'::jsonb)) LOOP
    IF v_val NOT IN ('none', 'assigned', 'all') THEN RAISE EXCEPTION 'invalid scope' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM office_role_permissions p WHERE p.permission = v_key AND p.lawyer_only) THEN
      RAISE EXCEPTION 'lawyer-only permission cannot be customized' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM office_role_permissions p WHERE p.permission = v_key) THEN
      RAISE EXCEPTION 'unknown permission %', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_id IS NULL THEN
    INSERT INTO office_custom_roles (office_id, name, base_role, scopes, created_by, updated_by)
    VALUES (p_office_id, btrim(p_name), p_base_role, coalesce(p_scopes, '{}'::jsonb), auth.uid(), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE office_custom_roles SET name = btrim(p_name), base_role = p_base_role, scopes = coalesce(p_scopes, '{}'::jsonb),
           updated_at = now(), updated_by = auth.uid()
    WHERE id = p_id AND office_id = p_office_id
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'custom role not found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  PERFORM public.office_log(p_office_id, 'custom_role.save', 'office_custom_role', v_row.id::text,
    jsonb_build_object('name', v_row.name, 'base_role', v_row.base_role, 'scopes', v_row.scopes));
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.touch_office_member() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE office_members SET last_active_at = now()
  WHERE user_id = auth.uid() AND status = 'active' AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes');
$$;

-- ── 7. 기존 tenant 함수 교체 (020 정책들이 그대로 사무소 기준으로 동작) ──────
CREATE OR REPLACE FUNCTION public.current_tenant_ids() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.current_office_ids(); $$;

CREATE OR REPLACE FUNCTION public.tenant_role(p_tenant text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE public.office_role(p_tenant)
    WHEN 'owner' THEN 'OWNER'
    WHEN 'lawyer' THEN 'LAWYER'
    WHEN 'consultant' THEN 'CONSULTANT'
    WHEN 'clerk' THEN 'STAFF'
    WHEN 'accounting' THEN 'ACCOUNTING'
    WHEN 'custom' THEN 'STAFF'
    ELSE NULL END;
$$;

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY offices_member_read ON public.offices FOR SELECT TO authenticated
  USING (id = ANY (public.current_office_ids()));
CREATE POLICY office_members_member_read ON public.office_members FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()) OR user_id = auth.uid());
CREATE POLICY office_role_permissions_read ON public.office_role_permissions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY office_custom_roles_member_read ON public.office_custom_roles FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));
CREATE POLICY office_invites_staff_read ON public.office_invites FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'office.staff'));
CREATE POLICY office_audit_logs_owner_read ON public.office_audit_logs FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'office.audit'));
-- 쓰기 정책 없음: 모든 쓰기는 위 함수로만 (31 기획서 5장)

-- ── 9. 권한 ─────────────────────────────────────────────────────────────────
REVOKE ALL ON public.offices, public.office_members, public.office_role_permissions, public.office_custom_roles,
              public.office_invites, public.office_audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.offices, public.office_members, public.office_role_permissions,
              public.office_custom_roles, public.office_invites, public.office_audit_logs FROM authenticated;
GRANT SELECT ON public.offices, public.office_members, public.office_role_permissions, public.office_custom_roles,
              public.office_invites, public.office_audit_logs TO authenticated;
GRANT ALL ON public.offices, public.office_members, public.office_role_permissions, public.office_custom_roles,
              public.office_invites, public.office_audit_logs TO service_role;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.is_case_assignee(uuid)', 'public.current_office_member(text)', 'public.current_office_ids()',
    'public.office_role(text)', 'public.member_is_verified_lawyer(public.office_members)',
    'public.office_permission_scope(text, text)', 'public.has_office_permission(text, text, uuid)',
    'public.my_office_context()', 'public.office_log(text, text, text, text, jsonb)',
    'public.ensure_owner_office(text, uuid)', 'public.lawyer_accounts_office_sync()',
    'public.create_office_invite(text, text, text, integer, uuid)', 'public.peek_office_invite(text)',
    'public.accept_office_invite(text, text)', 'public.revoke_office_invite(uuid)',
    'public.update_office_member(uuid, text, text, jsonb, uuid, uuid)',
    'public.save_office_custom_role(text, uuid, text, text, jsonb)', 'public.touch_office_member()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- 로그인한 사용자가 직접 부르는 함수만 authenticated 에게
GRANT EXECUTE ON FUNCTION public.my_office_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_office_permission(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.office_permission_scope(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_office_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.office_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_assignee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_office_invite(text, text, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_office_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_office_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_office_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_office_member(uuid, text, text, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_office_custom_role(text, uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.office_log(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_office_member() TO authenticated;
-- RLS 정책 안에서 쓰이는 내부 함수(SECURITY DEFINER)는 authenticated 실행 권한이 있어야 정책 평가가 됨
GRANT EXECUTE ON FUNCTION public.current_office_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_is_verified_lawyer(public.office_members) TO authenticated;

NOTIFY pgrst, 'reload schema';
