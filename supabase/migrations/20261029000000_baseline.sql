-- ============================================================================
-- 기준(baseline) 마이그레이션 — 운영 DB public 스키마 그대로 (2026-10-29)
-- ----------------------------------------------------------------------------
-- 만든 방법: pg_dump 17.11 --schema-only --schema=public (권한 포함), 운영 Postgres 17.6
-- 포함: 테이블 47 · 뷰 1 · 함수 50 · RLS 정책 117 · 트리거 14 · GRANT/REVOKE · 기본 권한
-- 반영된 옛 파일: 001~003, 005, 007~009, 011~029, 031 (supabase/migrations_archive/)
-- 반영 안 된 옛 파일: 004(copilot), 010(smtp), 030(target_lawyer_id), 20260916(LeadMaster)
--   → 030은 바로 다음 마이그레이션으로 따로 적용, 나머지는 쓰지 않음
-- 덤프에서 뺀 것: \restrict 줄, CREATE SCHEMA public(이미 있음),
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin(postgres 계정으로 실행 불가)
-- 운영 DB에는 이 파일을 실행하지 않고 '적용됨'으로만 표시한다 (migration repair).
-- 새 프로젝트(시험 DB)에는 이 파일부터 차례로 실행한다.
-- 데이터는 들어 있지 않다. 시험용 가짜 데이터는 supabase/seed.sql.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- 새 Supabase 프로젝트는 public에 새로 만든 테이블·함수·시퀀스에 anon·authenticated·service_role
-- 권한을 자동으로 준다(기본 권한). 덤프의 GRANT/REVOKE는 PostgreSQL 기본값 기준이라, 그대로 두면
-- 운영에서 회수한 권한(예: 관리자 함수의 anon 실행)이 시험 DB에 생긴다.
-- 그래서 객체를 만드는 동안만 기본 권한을 끄고, 파일 끝의 ALTER DEFAULT PRIVILEGES가 다시 켠다.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: accept_staff_invite(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_staff_invite(p_token text, p_staff_id text, p_linked_user_id text, p_name text, p_email text, p_avatar text, p_provider text) RETURNS TABLE(role text, invited_by text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid();
  v_email text;
  v_me text := public.current_lawyer_profile_id();
  v_row invite_tokens%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_me IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_linked_user_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'linked user mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_staff_id IS NULL OR p_staff_id <> ('staff-' || v_me) THEN
    RAISE EXCEPTION 'invalid staff id' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_row FROM invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite token' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(v_row.is_used, false) THEN RAISE EXCEPTION 'invite token already used' USING ERRCODE = '42501'; END IF;
  IF v_row.expires_at < NOW() THEN RAISE EXCEPTION 'invite token expired' USING ERRCODE = '42501'; END IF;
  IF v_row.email IS NOT NULL AND length(trim(v_row.email)) > 0 AND lower(trim(v_row.email)) <> v_email THEN
    RAISE EXCEPTION 'invite token is restricted to another email' USING ERRCODE = '42501';
  END IF;
  IF v_row.role = 'OWNER' THEN RAISE EXCEPTION 'invalid invite role' USING ERRCODE = '42501'; END IF;
  IF v_row.created_by = v_me THEN RAISE EXCEPTION 'cannot accept own invite' USING ERRCODE = '42501'; END IF;

  UPDATE invite_tokens SET is_used = true, used_by = p_staff_id, used_at = NOW() WHERE id = v_row.id;

  -- 이미 기록이 있으면(재초대) 승인 대기로 되돌리고 새 역할·초대자로 갱신
  INSERT INTO staff_members (id, name, role, email, avatar, is_active, assigned_count, permissions, status,
                             invited_by, auth_email, auth_provider, supabase_user_id, linked_user_id, created_at, updated_at)
  VALUES (p_staff_id, left(coalesce(nullif(trim(p_name), ''), '직원'), 50), v_row.role, p_email, p_avatar, false, 0, '{}'::jsonb, 'pending',
          v_row.created_by, v_email, p_provider, v_uid, v_me, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
     SET role = EXCLUDED.role, status = 'pending', is_active = false, permissions = '{}'::jsonb,
         invited_by = EXCLUDED.invited_by, removed_at = NULL, removal_reason = NULL, updated_at = NOW();

  RETURN QUERY SELECT v_row.role, v_row.created_by;
END;
$$;


--
-- Name: ad_orders_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ad_orders_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.paid_at IS DISTINCT FROM OLD.paid_at) THEN
    INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, detail, auth_uid, auth_email, ip_address)
    VALUES (
      coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'system'),
      CASE WHEN public.is_platform_admin() THEN 'admin' ELSE 'system' END,
      'ad_order_status', 'ad_order', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'paid_at', NEW.paid_at, 'total_price', NEW.total_price),
      auth.uid(), auth.jwt() ->> 'email', public.request_client_ip()
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: admin_audit(text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, detail, auth_uid, auth_email, ip_address)
  VALUES (
    coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'admin'),
    'admin',
    left(p_action, 64),
    left(p_target_type, 64),
    left(p_target_id, 200),
    coalesce(p_detail, '{}'::jsonb),
    auth.uid(),
    auth.jwt() ->> 'email',
    public.request_client_ip()
  );
$$;


--
-- Name: admin_delete_lawyer_profile(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_lawyer_profile(p_lawyer_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_lawyer_id), '') = '' THEN
    RAISE EXCEPTION 'lawyer_id required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = p_lawyer_id) THEN
    RAISE EXCEPTION 'profile is linked to a login account' USING ERRCODE = '42501';
  END IF;

  INSERT INTO lawyer_profile_tombstones (lawyer_id, deleted_by)
  VALUES (p_lawyer_id, auth.uid())
  ON CONFLICT (lawyer_id) DO UPDATE SET deleted_at = NOW(), deleted_by = EXCLUDED.deleted_by;

  DELETE FROM lawyer_private_profiles WHERE lawyer_id = p_lawyer_id;
  DELETE FROM lawyers WHERE id = p_lawyer_id;
  RETURN true;
END;
$$;


--
-- Name: admin_link_lawyer_account(text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_lawyer_id), '') = '' THEN
    RAISE EXCEPTION 'lawyer_id required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no auth user with that email (user must sign in once first)' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM lawyer_accounts WHERE lawyer_id = p_lawyer_id AND auth_user_id <> v_uid) THEN
    RAISE EXCEPTION 'lawyer_id already linked to another auth user' USING ERRCODE = '23505';
  END IF;

  INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved, approved_at, approved_by)
  VALUES (v_uid, p_lawyer_id, lower(trim(p_email)), p_approved,
          CASE WHEN p_approved THEN NOW() END, CASE WHEN p_approved THEN auth.uid() END)
  ON CONFLICT (auth_user_id) DO UPDATE
     SET lawyer_id   = EXCLUDED.lawyer_id,
         auth_email  = EXCLUDED.auth_email,
         approved    = EXCLUDED.approved,
         approved_at = EXCLUDED.approved_at,
         approved_by = EXCLUDED.approved_by;
  RETURN true;
END;
$$;


--
-- Name: admin_reopen_stale_consult(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reopen_stale_consult(p_id text, p_reason text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row consult_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM consult_requests WHERE id::text = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.admin_hidden THEN
    RAISE EXCEPTION 'hidden request' USING ERRCODE = '22023';
  END IF;
  IF v_row.status NOT IN ('requested', 'responding') THEN
    RAISE EXCEPTION 'only unanswered requests can be reopened' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(coalesce(v_row.proposals, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'request already has proposals' USING ERRCODE = '22023';
  END IF;

  UPDATE consult_requests
     SET request_type = 'open', status = 'requested', updated_at = now()
   WHERE id::text = p_id;

  PERFORM public.admin_audit('admin_consult_reopen', 'consult_request', p_id,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 300),
                       'prev_request_type', v_row.request_type,
                       'prev_status', v_row.status,
                       'selected_lawyer_ids', v_row.selected_lawyer_ids));
  RETURN 'requested';
END;
$$;


--
-- Name: admin_revoke_auth_sessions(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_revoke_auth_sessions(p_user_id text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uids uuid[];
  v_count integer := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN 0;
  END IF;

  SELECT array_agg(DISTINCT uid) INTO v_uids FROM (
    SELECT la.auth_user_id AS uid FROM public.lawyer_accounts la WHERE la.lawyer_id = p_user_id
    UNION
    SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(p_user_id)
    UNION
    SELECT u.id FROM auth.users u WHERE u.id::text = p_user_id
  ) s WHERE uid IS NOT NULL;

  IF v_uids IS NULL THEN
    RETURN 0;
  END IF;
  IF auth.uid() = ANY (v_uids) THEN
    RAISE EXCEPTION 'cannot revoke own sessions here' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = ANY (v_uids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.user_sessions
     SET status = 'revoked', revoked_at = now(), revoked_by = 'admin',
         revoke_reason = coalesce(revoke_reason, '관리자 로그인 토큰 폐기')
   WHERE user_id = p_user_id AND status = 'active';

  RETURN v_count;
END;
$$;


--
-- Name: admin_set_consult_hidden(text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_hidden THEN
    UPDATE consult_requests
       SET admin_prev_status = CASE WHEN admin_hidden THEN admin_prev_status ELSE status END,
           admin_hidden = true,
           admin_hidden_reason = left(coalesce(p_reason, ''), 300),
           admin_hidden_at = now(),
           status = 'closed',
           updated_at = now()
     WHERE id::text = p_id
     RETURNING status INTO v_status;
  ELSE
    UPDATE consult_requests
       SET status = CASE WHEN admin_hidden THEN coalesce(admin_prev_status, status) ELSE status END,
           admin_hidden = false,
           admin_prev_status = NULL,
           admin_hidden_reason = NULL,
           admin_hidden_at = NULL,
           updated_at = now()
     WHERE id::text = p_id
     RETURNING status INTO v_status;
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.admin_audit(
    CASE WHEN p_hidden THEN 'admin_consult_hide' ELSE 'admin_consult_unhide' END,
    'consult_request', p_id,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 300), 'status', v_status)
  );
  RETURN v_status;
END;
$$;


--
-- Name: admin_set_consult_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_consult_status(p_id text, p_status text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_prev text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('requested', 'responding', 'comparing', 'counseling', 'closed', 'cancelled',
                      'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_prev FROM consult_requests WHERE id::text = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE consult_requests SET status = p_status, updated_at = now() WHERE id::text = p_id;
  PERFORM public.admin_audit('admin_consult_status', 'consult_request', p_id,
    jsonb_build_object('from', v_prev, 'to', p_status));
  RETURN p_status;
END;
$$;


--
-- Name: admin_set_lawyer_approval(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  UPDATE lawyer_accounts
     SET approved = p_approved,
         approved_at = CASE WHEN p_approved THEN NOW() ELSE NULL END,
         approved_by = CASE WHEN p_approved THEN auth.uid() ELSE NULL END
   WHERE lawyer_id = p_lawyer_id;
  RETURN FOUND;
END;
$$;


--
-- Name: audit_logs_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_logs_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501';
END;
$$;


--
-- Name: audit_logs_normalize(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_logs_normalize() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 서비스 롤·DB 내부 함수(예: 001 auto_cleanup)는 그대로 둔다
  IF current_user NOT IN ('anon', 'authenticated') THEN
    NEW.created_at := coalesce(NEW.created_at, now());
    RETURN NEW;
  END IF;

  NEW.created_at := now();
  NEW.auth_uid := auth.uid();
  NEW.auth_email := left(auth.jwt() ->> 'email', 254);
  NEW.ip_address := public.request_client_ip();
  NEW.claimed_actor_role := left(NEW.actor_role, 32);

  IF public.is_platform_admin() THEN
    NEW.actor_role := CASE WHEN NEW.actor_role = 'system' THEN 'admin' ELSE coalesce(NEW.actor_role, 'admin') END;
  ELSIF auth.uid() IS NULL THEN
    NEW.actor_role := 'anonymous';
  ELSIF NEW.actor_role IN ('admin', 'system') THEN
    NEW.actor_role := 'unverified';
  END IF;

  NEW.actor_id := left(coalesce(nullif(NEW.actor_id, ''), 'unknown'), 200);
  NEW.action := left(NEW.action, 64);
  NEW.target_type := left(NEW.target_type, 64);
  NEW.target_id := left(NEW.target_id, 200);
  NEW.user_agent := left(NEW.user_agent, 400);
  IF NEW.detail IS NOT NULL AND octet_length(NEW.detail::text) > 4000 THEN
    NEW.detail := jsonb_build_object('truncated', true, 'original_bytes', octet_length(NEW.detail::text));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: block_tombstoned_lawyer_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_tombstoned_lawyer_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.lawyer_write_is_system() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: block_tombstoned_private_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_tombstoned_private_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.lawyer_write_is_system() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = NEW.lawyer_id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: can_access_consult_request(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_consult_request(p_request_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM consult_requests cr
    WHERE cr.id = p_request_id
      AND (
           cr.client_id = auth.uid()::text
        OR (
             public.current_approved_lawyer_id() IS NOT NULL AND (
                  cr.selected_lawyer_id = public.current_approved_lawyer_id()
               OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? public.current_approved_lawyer_id()
               OR cr.created_by_lawyer_id = public.current_approved_lawyer_id()
             )
           )
      )
  );
$$;


--
-- Name: claim_client_alias(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_client_alias(p_alias text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alias text := btrim(regexp_replace(coalesce(p_alias, ''), '\s+', ' ', 'g'));
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_alias) < 2 OR char_length(v_alias) > 20 THEN
    RAISE EXCEPTION 'alias length must be 2-20' USING ERRCODE = '22023';
  END IF;
  -- 실명 분리 규칙(clientName.split('_'))과 충돌하는 밑줄 금지
  IF position('_' IN v_alias) > 0 THEN
    RAISE EXCEPTION 'underscore is not allowed in alias' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_id INTO v_owner
  FROM client_aliases
  WHERE lower(regexp_replace(alias, '\s+', '', 'g')) = lower(regexp_replace(v_alias, '\s+', '', 'g'));

  IF FOUND THEN
    RETURN v_owner = v_uid;   -- 본인 가명이면 true, 타인 가명이면 false
  END IF;

  BEGIN
    INSERT INTO client_aliases (alias, auth_user_id) VALUES (v_alias, v_uid)
    ON CONFLICT (auth_user_id) DO UPDATE SET alias = EXCLUDED.alias, updated_at = NOW();
  EXCEPTION WHEN unique_violation THEN
    RETURN false;             -- 동시 선점 경쟁에서 패배
  END;
  RETURN true;
END;
$$;


--
-- Name: claim_lawyer_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_lawyer_account() RETURNS TABLE(lawyer_id text, approved boolean, auth_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = v_uid) THEN
    INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
    VALUES (v_uid, 'lawyer-' || v_uid::text, lower((SELECT u.email FROM auth.users u WHERE u.id = v_uid)), false);
  END IF;

  RETURN QUERY
    SELECT la.lawyer_id, la.approved, la.auth_email
    FROM lawyer_accounts la
    WHERE la.auth_user_id = v_uid;
END;
$$;


--
-- Name: cleanup_expired_diagnosis(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_diagnosis() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM diagnosis_results
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  INSERT INTO audit_logs (actor_id, actor_role, action, target_type, detail)
  VALUES (
    'system', 'system', 'auto_cleanup', 'diagnosis',
    jsonb_build_object('deleted_count', deleted_count, 'cleanup_at', NOW())
  );
  
  RETURN deleted_count;
END;
$$;


--
-- Name: consult_requests_protect_admin_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consult_requests_protect_admin_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hidden := false;
    NEW.admin_hidden_reason := NULL;
    NEW.admin_hidden_at := NULL;
    NEW.admin_prev_status := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hidden := OLD.admin_hidden;
  NEW.admin_hidden_reason := OLD.admin_hidden_reason;
  NEW.admin_hidden_at := OLD.admin_hidden_at;
  NEW.admin_prev_status := OLD.admin_prev_status;
  -- 숨김 처리된 요청은 의뢰인이 상태를 되돌려 다시 노출시킬 수 없음
  IF OLD.admin_hidden THEN
    NEW.status := OLD.status;
    NEW.request_type := OLD.request_type;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: consume_invite_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_invite_token(p_token text, p_staff_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email text;
  v_row invite_tokens%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_row FROM invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite token' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(v_row.is_used, false) THEN
    RAISE EXCEPTION 'invite token already used' USING ERRCODE = '42501';
  END IF;
  IF v_row.expires_at < NOW() THEN
    RAISE EXCEPTION 'invite token expired' USING ERRCODE = '42501';
  END IF;
  IF v_row.email IS NOT NULL AND length(trim(v_row.email)) > 0 AND lower(trim(v_row.email)) <> v_email THEN
    RAISE EXCEPTION 'invite token is restricted to another email' USING ERRCODE = '42501';
  END IF;

  UPDATE invite_tokens
     SET is_used = true, used_by = coalesce(nullif(p_staff_id, ''), v_uid::text), used_at = NOW()
   WHERE id = v_row.id;
  RETURN v_row.role;
END;
$$;


--
-- Name: create_shared_report(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer DEFAULT 168) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
DECLARE
  v_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN must be 6 digits' USING ERRCODE = '22023';
  END IF;
  IF p_ciphertext IS NULL OR length(p_ciphertext) = 0 OR length(p_ciphertext) > 200000 THEN
    RAISE EXCEPTION 'invalid ciphertext' USING ERRCODE = '22023';
  END IF;

  -- 사용자당 24시간 내 생성 한도 (남용 방지)
  IF (SELECT count(*) FROM shared_reports WHERE created_by = auth.uid() AND created_at > NOW() - INTERVAL '24 hours') >= 20 THEN
    RAISE EXCEPTION 'too many share links today' USING ERRCODE = '54000';
  END IF;

  v_id := translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_');

  INSERT INTO shared_reports (id, ciphertext, pin_hash, created_by, expires_at)
  VALUES (
    v_id,
    p_ciphertext,
    crypt(p_pin, gen_salt('bf', 10)),
    auth.uid(),
    NOW() + make_interval(hours => LEAST(GREATEST(coalesce(p_ttl_hours, 168), 1), 720))
  );

  -- 만료 데이터 정리
  DELETE FROM shared_reports WHERE expires_at < NOW() - INTERVAL '1 day';

  RETURN v_id;
END;
$_$;


--
-- Name: current_actor_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_actor_ids() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(array_agg(DISTINCT t) FILTER (WHERE t IS NOT NULL AND length(t) > 0), '{}')
  FROM (
    SELECT public.current_lawyer_profile_id() AS t
    UNION ALL
    SELECT s.id FROM staff_members s WHERE s.linked_user_id = public.current_lawyer_profile_id()
  ) x;
$$;


--
-- Name: current_approved_lawyer_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_approved_lawyer_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT la.lawyer_id
  FROM lawyer_accounts la
  WHERE la.auth_user_id = auth.uid() AND la.approved = true
  LIMIT 1;
$$;


--
-- Name: current_lawyer_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_lawyer_profile_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT la.lawyer_id FROM lawyer_accounts la WHERE la.auth_user_id = auth.uid() LIMIT 1;
$$;


--
-- Name: current_tenant_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_ids() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(array_agg(DISTINCT t) FILTER (WHERE t IS NOT NULL AND length(t) > 0), '{}')
  FROM (
    SELECT public.current_approved_lawyer_id() AS t
    UNION ALL
    SELECT nullif(l.law_firm_id, '') FROM lawyers l WHERE l.id = public.current_approved_lawyer_id()
    UNION ALL
    SELECT s.invited_by FROM staff_members s
     WHERE s.linked_user_id = public.current_lawyer_profile_id()
       AND s.status = 'active'
  ) x;
$$;


--
-- Name: get_admin_contract_anchors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_contract_anchors() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ec.id,
        'client_id', ec.client_id,
        'client_name', ec.client_name,
        'lawyer_name', ec.lawyer_name,
        'law_firm_name', ec.law_firm_name,
        'assigned_lawyer_id', ec.assigned_lawyer_id,
        'status', ec.status,
        'contract_date', ec.contract_date,
        'is_business', ec.is_business,
        'document_hashes', ec.document_hashes,
        'blockchain_anchor', ec.blockchain_anchor,
        'created_at', ec.created_at,
        'updated_at', ec.updated_at
      ) ORDER BY ec.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM electronic_contracts ec;

  RETURN v_result;
END;
$$;


--
-- Name: get_contract_by_remote_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contract_by_remote_token(p_contract_id text, p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_contract JSONB;
BEGIN
  IF p_contract_id IS NULL OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(ec.*) INTO v_contract
  FROM electronic_contracts ec
  WHERE ec.id = p_contract_id
    AND ec.remote_sign_token = p_token;

  RETURN v_contract;
END;
$$;


--
-- Name: guard_consult_request_privileged_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_consult_request_privileged_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.proposals := '[]'::jsonb;
    NEW.accepted_lawyer_ids := '[]'::jsonb;
    NEW.created_by_lawyer_id := NULL;
  ELSE
    NEW.proposals := OLD.proposals;
    NEW.accepted_lawyer_ids := OLD.accepted_lawyer_ids;
    NEW.created_by_lawyer_id := OLD.created_by_lawyer_id;
    NEW.client_id := OLD.client_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_lawyer_admin_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_lawyer_admin_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: guard_lawyer_private_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_lawyer_private_profile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: is_firm_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_firm_user() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT public.is_platform_admin()
      OR public.current_approved_lawyer_id() IS NOT NULL
      OR cardinality(public.current_tenant_ids()) > 0;
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;


--
-- Name: is_session_owner(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_session_owner(p_user_id text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT p_user_id IS NOT NULL AND (
       p_user_id = public.current_lawyer_profile_id()
    OR lower(p_user_id) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR p_user_id = auth.uid()::text
  );
$$;


--
-- Name: is_tenant_member(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_member(p_tenant text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ SELECT p_tenant IS NOT NULL AND p_tenant = ANY(public.current_tenant_ids()); $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: consult_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consult_requests (
    id text NOT NULL,
    client_id text NOT NULL,
    client_name text DEFAULT '익명 의뢰인'::text NOT NULL,
    phone text DEFAULT ''::text,
    request_type text DEFAULT 'open'::text NOT NULL,
    max_participants integer DEFAULT 3,
    status text DEFAULT 'requested'::text NOT NULL,
    selected_lawyer_id text,
    selected_lawyer_ids jsonb DEFAULT '[]'::jsonb,
    proposals jsonb DEFAULT '[]'::jsonb,
    title text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    financial_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    phone_consultation_requested boolean DEFAULT false,
    safe_number text,
    safe_number_assigned_at timestamp with time zone,
    safe_number_expires_at timestamp with time zone,
    entry_category jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    accepted_lawyer_ids jsonb DEFAULT '[]'::jsonb,
    rejection_notified boolean DEFAULT false,
    created_by_lawyer_id text,
    admin_hidden boolean DEFAULT false NOT NULL,
    admin_hidden_reason text,
    admin_hidden_at timestamp with time zone,
    admin_prev_status text
);


--
-- Name: lawyer_can_see_contact(public.consult_requests, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_lawyer_id IS NOT NULL AND (
       cr.created_by_lawyer_id = p_lawyer_id
    OR EXISTS (
         SELECT 1 FROM electronic_contracts ec
         WHERE ec.assigned_lawyer_id = p_lawyer_id
           AND ec.status IN ('signed', 'completed')
           AND (ec.client_id = cr.id OR ec.client_id = cr.client_id)
       )
  );
$$;


--
-- Name: lawyer_can_view_request(public.consult_requests, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT p_lawyer_id IS NOT NULL AND (
       (cr.status = 'requested' AND cr.request_type = 'open')
    OR cr.selected_lawyer_id = p_lawyer_id
    OR coalesce(cr.accepted_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR coalesce(cr.selected_lawyer_ids, '[]'::jsonb) ? p_lawyer_id
    OR cr.created_by_lawyer_id = p_lawyer_id
  );
$$;


--
-- Name: lawyer_create_consult_request(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lawyer_create_consult_request(p_row jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lid text := public.current_approved_lawyer_id();
  v_id  text := p_row ->> 'id';
BEGIN
  IF v_lid IS NULL THEN
    RAISE EXCEPTION 'approved lawyer account required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_id, '') = '' THEN
    RAISE EXCEPTION 'id required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM consult_requests WHERE id = v_id) THEN
    RAISE EXCEPTION 'request id already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO consult_requests (
    id, client_id, client_name, phone, request_type, max_participants, status,
    selected_lawyer_id, selected_lawyer_ids, accepted_lawyer_ids, proposals,
    title, content, financial_profile, entry_category, created_by_lawyer_id, created_at, updated_at
  ) VALUES (
    v_id,
    coalesce(nullif(p_row ->> 'client_id', ''), v_id),
    coalesce(nullif(p_row ->> 'client_name', ''), '의뢰인'),
    coalesce(p_row ->> 'phone', ''),
    'direct',
    1,
    coalesce(nullif(p_row ->> 'status', ''), 'counseling'),
    v_lid,
    jsonb_build_array(v_lid),
    jsonb_build_array(v_lid),
    '[]'::jsonb,
    coalesce(p_row ->> 'title', ''),
    coalesce(p_row ->> 'content', ''),
    coalesce(p_row -> 'financial_profile', '{}'::jsonb),
    p_row -> 'entry_category',
    v_lid,
    coalesce((p_row ->> 'created_at')::timestamptz, NOW()),
    NOW()
  );
END;
$$;


--
-- Name: lawyer_patch_consult_request(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lid  text := public.current_approved_lawyer_id();
  v_row  consult_requests%ROWTYPE;
  v_prop jsonb;
  v_status text;
BEGIN
  IF v_lid IS NULL THEN
    RAISE EXCEPTION 'approved lawyer account required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM consult_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consult request not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.lawyer_can_view_request(v_row, v_lid) THEN
    RAISE EXCEPTION 'not allowed for this request' USING ERRCODE = '42501';
  END IF;

  -- 제안서 (본인 작성분만 추가/교체)
  IF p_patch ? 'proposal' THEN
    v_prop := p_patch -> 'proposal';
    IF jsonb_typeof(v_prop) <> 'object' OR (v_prop ->> 'lawyerId') IS DISTINCT FROM v_lid OR coalesce(v_prop ->> 'id', '') = '' THEN
      RAISE EXCEPTION 'proposal must belong to the calling lawyer' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_row.proposals, '[]'::jsonb)) e
      WHERE e ->> 'id' = v_prop ->> 'id' AND (e ->> 'lawyerId') IS DISTINCT FROM v_lid
    ) THEN
      RAISE EXCEPTION 'proposal id collision' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET proposals = coalesce((
             SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(proposals, '[]'::jsonb)) e
             WHERE e ->> 'id' IS DISTINCT FROM v_prop ->> 'id'
           ), '[]'::jsonb) || jsonb_build_array(v_prop)
     WHERE id = p_id;
  END IF;

  IF coalesce((p_patch ->> 'accept_self')::boolean, false) THEN
    UPDATE consult_requests
       SET accepted_lawyer_ids = CASE
             WHEN coalesce(accepted_lawyer_ids, '[]'::jsonb) ? v_lid THEN accepted_lawyer_ids
             ELSE coalesce(accepted_lawyer_ids, '[]'::jsonb) || to_jsonb(v_lid)
           END
     WHERE id = p_id;
  END IF;

  IF coalesce((p_patch ->> 'select_self')::boolean, false) THEN
    IF v_row.selected_lawyer_id IS NOT NULL AND v_row.selected_lawyer_id <> v_lid THEN
      RAISE EXCEPTION 'request already assigned to another lawyer' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests SET selected_lawyer_id = v_lid WHERE id = p_id;
  END IF;

  IF p_patch ? 'status' THEN
    v_status := p_patch ->> 'status';
    IF v_status NOT IN ('responding', 'counseling', 'comparing', 'contracted', 'document') THEN
      RAISE EXCEPTION 'status not allowed: %', v_status USING ERRCODE = '22023';
    END IF;
    UPDATE consult_requests SET status = v_status WHERE id = p_id;
  END IF;

  IF (p_patch ? 'client_name' OR p_patch ? 'phone') THEN
    IF NOT public.lawyer_can_see_contact(v_row, v_lid) THEN
      RAISE EXCEPTION 'contact fields are editable only after contract' USING ERRCODE = '42501';
    END IF;
    UPDATE consult_requests
       SET client_name = coalesce(p_patch ->> 'client_name', client_name),
           phone       = coalesce(p_patch ->> 'phone', phone)
     WHERE id = p_id;
  END IF;

  UPDATE consult_requests SET updated_at = NOW() WHERE id = p_id;
END;
$$;


--
-- Name: lawyer_write_is_system(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lawyer_write_is_system() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR current_user NOT IN ('authenticated', 'anon');
$$;


--
-- Name: open_doc_share(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_doc_share(p_token text, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_row doc_share_packages%ROWTYPE;
  v_digits TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_row FROM doc_share_packages WHERE token = p_token;
  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.failed_attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF length(v_digits) < 10 OR encode(digest(v_digits, 'sha256'), 'hex') <> v_row.recipient_phone_hash THEN
    UPDATE doc_share_packages SET failed_attempts = failed_attempts + 1 WHERE token = p_token;
    RETURN jsonb_build_object('ok', false, 'reason', 'mismatch', 'remaining', GREATEST(0, 4 - v_row.failed_attempts));
  END IF;
  UPDATE doc_share_packages SET failed_attempts = 0, viewed_at = coalesce(viewed_at, NOW()) WHERE token = p_token;
  RETURN jsonb_build_object('ok', true, 'payload', v_row.payload, 'expiresAt', v_row.expires_at);
END;
$$;


--
-- Name: open_shared_report(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_shared_report(p_id text, p_pin text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
DECLARE
  v_row shared_reports%ROWTYPE;
  v_remaining integer;
BEGIN
  SELECT * INTO v_row FROM shared_reports WHERE id = p_id FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.locked_at IS NOT NULL OR v_row.failed_attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'remaining', 0);
  END IF;

  IF p_pin ~ '^[0-9]{6}$' AND crypt(p_pin, v_row.pin_hash) = v_row.pin_hash THEN
    UPDATE shared_reports SET failed_attempts = 0, last_opened_at = NOW() WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'ciphertext', v_row.ciphertext);
  END IF;

  v_remaining := v_row.max_attempts - (v_row.failed_attempts + 1);
  UPDATE shared_reports
     SET failed_attempts = failed_attempts + 1,
         locked_at = CASE WHEN v_remaining <= 0 THEN NOW() ELSE NULL END
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', false,
    'reason', CASE WHEN v_remaining <= 0 THEN 'locked' ELSE 'wrong_pin' END,
    'remaining', GREATEST(v_remaining, 0)
  );
END;
$_$;


--
-- Name: peek_doc_share(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peek_doc_share(p_token text) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN d.token IS NULL OR d.expires_at < NOW() THEN jsonb_build_object('ok', false)
    ELSE jsonb_build_object('ok', true, 'phoneLast4', d.recipient_phone_last4, 'locked', d.failed_attempts >= 5)
  END
  FROM (SELECT 1) x LEFT JOIN doc_share_packages d ON d.token = p_token;
$$;


--
-- Name: peek_invite_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peek_invite_token(p_token text) RETURNS TABLE(role text, expires_at timestamp with time zone, is_used boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT it.role, it.expires_at, coalesce(it.is_used, false)
  FROM invite_tokens it
  WHERE it.token = p_token AND length(coalesce(p_token, '')) >= 20
  LIMIT 1;
$$;


--
-- Name: register_lawyer_account(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_lawyer_account(p_lawyer_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing lawyer_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM lawyer_accounts WHERE auth_user_id = v_uid;
  IF FOUND THEN
    IF v_existing.lawyer_id <> p_lawyer_id THEN
      RAISE EXCEPTION 'this account is already linked to another lawyer profile' USING ERRCODE = '42501';
    END IF;
    RETURN v_existing.approved;
  END IF;

  IF p_lawyer_id IS DISTINCT FROM ('lawyer-' || v_uid::text) THEN
    RAISE EXCEPTION 'existing lawyer profiles can only be linked by an administrator' USING ERRCODE = '42501';
  END IF;

  INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved)
  VALUES (v_uid, p_lawyer_id, lower((SELECT email FROM auth.users WHERE id = v_uid)), false);
  RETURN false;
END;
$$;


--
-- Name: request_client_ip(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_client_ip() RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  h json;
  v text;
BEGIN
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN RETURN NULL; END IF;
  v := coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(h ->> 'x-real-ip', '')
  );
  RETURN left(v, 64);
END;
$$;


--
-- Name: strip_lawyer_secrets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.strip_lawyer_secrets() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    NEW.data := NEW.data - ARRAY['password', 'email', 'licenseImageData', 'businessNumber', 'ntsStatus', 'sealInfo', 'aiCaseAnalysisNote'];
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_lawyer_profile_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_lawyer_profile_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: task_tickets_guard_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_tickets_guard_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.is_platform_admin() THEN RETURN NEW; END IF;
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' AND coalesce(OLD.requires_approval, false) THEN
    IF OLD.status <> 'REVIEW_REQUESTED' THEN
      RAISE EXCEPTION 'approval required before completion' USING ERRCODE = '42501';
    END IF;
    IF OLD.assignee_id = ANY(public.current_actor_ids()) THEN
      RAISE EXCEPTION 'assignee cannot approve own task' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- 승인 필요 여부는 만든 뒤 담당자가 끌 수 없다
  IF coalesce(OLD.requires_approval, false) AND NOT coalesce(NEW.requires_approval, false)
     AND OLD.assignee_id = ANY(public.current_actor_ids()) THEN
    RAISE EXCEPTION 'assignee cannot remove approval requirement' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tenant_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tenant_role(p_tenant text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN p_tenant IS NULL THEN NULL
    WHEN p_tenant = public.current_approved_lawyer_id() THEN 'OWNER'
    WHEN EXISTS (SELECT 1 FROM lawyers l WHERE l.id = public.current_approved_lawyer_id() AND nullif(l.law_firm_id, '') = p_tenant) THEN 'OWNER'
    ELSE (
      SELECT s.role FROM staff_members s
       WHERE s.linked_user_id = public.current_lawyer_profile_id()
         AND s.invited_by = p_tenant AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1
    )
  END;
$$;


--
-- Name: user_sessions_server_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_sessions_server_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ip text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_role = 'ADMIN' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'ADMIN session requires platform admin' USING ERRCODE = '42501';
  END IF;
  v_ip := public.request_client_ip();
  IF v_ip IS NOT NULL THEN
    NEW.ip_address := v_ip;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    member_id text DEFAULT ''::text,
    member_name text DEFAULT ''::text,
    role text DEFAULT ''::text,
    action text DEFAULT ''::text NOT NULL,
    details text DEFAULT ''::text,
    ip text DEFAULT ''::text,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: ad_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_orders (
    id text NOT NULL,
    lawyer_id text NOT NULL,
    lawyer_name text,
    product_id text,
    product_name text,
    contract_months integer DEFAULT 1 NOT NULL,
    monthly_price integer DEFAULT 0 NOT NULL,
    total_price integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    activated_at timestamp with time zone,
    expires_at timestamp with time zone,
    depositor_name text,
    region text,
    tax_invoice jsonb,
    modified_tax_invoice jsonb,
    buyer_corp_num text,
    buyer_corp_name text,
    buyer_ceo_name text,
    buyer_email text,
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_orders_contract_months_check CHECK (((contract_months >= 1) AND (contract_months <= 36))),
    CONSTRAINT ad_orders_monthly_price_check CHECK ((monthly_price >= 0)),
    CONSTRAINT ad_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'active'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT ad_orders_total_price_check CHECK ((total_price >= 0))
);


--
-- Name: alimtok_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alimtok_logs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text DEFAULT 'default'::text,
    client_id text DEFAULT ''::text NOT NULL,
    client_name text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    milestone text DEFAULT ''::text,
    status text DEFAULT 'sent'::text,
    error_message text DEFAULT ''::text,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_id text NOT NULL,
    actor_role text DEFAULT 'anonymous'::text NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    detail jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_uid uuid,
    auth_email text,
    claimed_actor_role text
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id text NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    date text NOT NULL,
    "time" text DEFAULT ''::text,
    category text DEFAULT 'general'::text,
    client_id text,
    client_name text DEFAULT ''::text,
    court_name text DEFAULT ''::text,
    case_number text DEFAULT ''::text,
    memo text DEFAULT ''::text,
    assigned_staff_id text,
    created_at timestamp with time zone DEFAULT now(),
    data jsonb DEFAULT '{}'::jsonb,
    visibility text DEFAULT 'personal'::text
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id text NOT NULL,
    client_id text DEFAULT 'client-temp'::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text,
    status text DEFAULT 'document'::text,
    assigned_lawyer_id text,
    assigned_lawyer_name text DEFAULT ''::text,
    debt_total numeric DEFAULT 0,
    income numeric DEFAULT 0,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_aliases (
    alias text NOT NULL,
    auth_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_inquiries (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_memos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_memos (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_qas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_qas (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: consult_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consult_messages (
    id text NOT NULL,
    consult_request_id text NOT NULL,
    sender_type text NOT NULL,
    sender_id text NOT NULL,
    sender_name text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consult_requests_for_lawyers; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.consult_requests_for_lawyers WITH (security_barrier='true') AS
 SELECT cr.id,
    cr.client_id,
        CASE
            WHEN public.lawyer_can_see_contact(cr.*, me.lid) THEN cr.client_name
            WHEN (POSITION(('_'::text) IN (cr.client_name)) > 0) THEN split_part(cr.client_name, '_'::text, 2)
            ELSE cr.client_name
        END AS client_name,
        CASE
            WHEN public.lawyer_can_see_contact(cr.*, me.lid) THEN cr.phone
            WHEN (COALESCE(cr.phone, ''::text) = ''::text) THEN ''::text
            ELSE '010-****-****'::text
        END AS phone,
    public.lawyer_can_see_contact(cr.*, me.lid) AS contact_visible,
    cr.request_type,
    cr.max_participants,
    cr.status,
    cr.selected_lawyer_id,
    cr.selected_lawyer_ids,
    cr.accepted_lawyer_ids,
    cr.rejection_notified,
    cr.proposals,
    cr.title,
    cr.content,
    cr.financial_profile,
    cr.phone_consultation_requested,
    cr.safe_number,
    cr.safe_number_assigned_at,
    cr.safe_number_expires_at,
    cr.entry_category,
    cr.created_by_lawyer_id,
    cr.created_at,
    cr.updated_at
   FROM (public.consult_requests cr
     CROSS JOIN LATERAL ( SELECT public.current_approved_lawyer_id() AS lid) me)
  WHERE (public.lawyer_can_view_request(cr.*, me.lid) AND (NOT cr.admin_hidden));


--
-- Name: copilot_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_cases (
    id text NOT NULL,
    tenant_id text DEFAULT 'default'::text,
    request_id text DEFAULT ''::text,
    client_name text DEFAULT ''::text,
    status text DEFAULT 'pending'::text,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: copilot_rulesets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_rulesets (
    id text NOT NULL,
    tenant_id text DEFAULT 'default'::text,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text,
    rules jsonb DEFAULT '[]'::jsonb,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_clients (
    client_id text NOT NULL,
    crm_status text DEFAULT 'requested'::text,
    assignee_id text,
    assigned_lawyer_id text,
    assigned_consultant_id text,
    assigned_staff_id text,
    documents jsonb DEFAULT '[]'::jsonb,
    notes jsonb DEFAULT '[]'::jsonb,
    activities jsonb DEFAULT '[]'::jsonb,
    contract_date text,
    contract_amount numeric DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT now(),
    intake_channel text DEFAULT 'mykim'::text,
    intake_channel_detail text,
    is_external_client boolean DEFAULT false,
    total_fee numeric DEFAULT 0,
    total_paid numeric DEFAULT 0,
    fee_schedule jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    extension_data jsonb
);


--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_roles (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text DEFAULT 'default'::text,
    role_name text DEFAULT ''::text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: diagnosis_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosis_config (
    id bigint NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now(),
    version integer NOT NULL
);


--
-- Name: diagnosis_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnosis_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnosis_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnosis_config_id_seq OWNED BY public.diagnosis_config.id;


--
-- Name: diagnosis_config_version_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnosis_config_version_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnosis_config_version_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnosis_config_version_seq OWNED BY public.diagnosis_config.version;


--
-- Name: diagnosis_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosis_results (
    id bigint NOT NULL,
    session_id text NOT NULL,
    q1_status text,
    q2_debt_scale text,
    q3_income text,
    q4_urgent_need text,
    q5_goal text,
    primary_strategy text,
    secondary_strategy text,
    urgency_level text,
    estimated_debt_total numeric,
    estimated_savings_amount numeric,
    estimated_savings_rate numeric,
    estimated_monthly_payment numeric,
    rehab_engine_used boolean DEFAULT false,
    full_result jsonb DEFAULT '{}'::jsonb,
    converted_to_detailed boolean DEFAULT false,
    converted_to_lawyer boolean DEFAULT false,
    converted_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '90 days'::interval),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: diagnosis_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnosis_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnosis_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnosis_results_id_seq OWNED BY public.diagnosis_results.id;


--
-- Name: diagnosis_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosis_stats (
    id bigint NOT NULL,
    day date NOT NULL,
    total_count integer DEFAULT 0,
    strategy_breakdown jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: diagnosis_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnosis_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnosis_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnosis_stats_id_seq OWNED BY public.diagnosis_stats.id;


--
-- Name: doc_share_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_share_packages (
    token text NOT NULL,
    owner_user_id uuid DEFAULT auth.uid() NOT NULL,
    recipient_phone_hash text NOT NULL,
    recipient_phone_last4 text,
    payload jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: electronic_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.electronic_contracts (
    id text NOT NULL,
    client_id text DEFAULT 'client-temp'::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    client_phone text DEFAULT ''::text,
    client_address text DEFAULT ''::text,
    lawyer_name text DEFAULT ''::text,
    law_firm_name text DEFAULT ''::text,
    assigned_lawyer_id text,
    total_fee numeric DEFAULT 0,
    court_costs numeric DEFAULT 0,
    fee_schedule jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text,
    contract_date text,
    documents jsonb DEFAULT '[]'::jsonb,
    audit_trail jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    remote_sign_token text,
    blockchain_anchor jsonb,
    document_hashes jsonb,
    timestamp_token jsonb,
    identity_verification jsonb,
    intent_verification jsonb,
    is_business boolean DEFAULT false,
    business_info jsonb,
    authority_status text DEFAULT 'UNVERIFIED'::text,
    client_ref_id text,
    real_name_conversion_pending boolean,
    consult_request_id text,
    source_proposal_id text,
    law_firm_phone text
);


--
-- Name: fee_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_notification_settings (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: in_app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.in_app_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    recipient_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    sender_id text,
    sender_name text,
    link_type text NOT NULL,
    link_id text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: internal_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    parent_id uuid,
    author_id text NOT NULL,
    author_name text NOT NULL,
    author_role text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    visibility text DEFAULT 'all_staff'::text NOT NULL,
    designated_user_ids text[] DEFAULT '{}'::text[],
    mentions text[] DEFAULT '{}'::text[],
    is_pinned boolean DEFAULT false,
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT internal_messages_target_type_check CHECK ((target_type = ANY (ARRAY['consult_request'::text, 'case'::text, 'copilot_review'::text, 'general'::text, 'sales_lead'::text]))),
    CONSTRAINT internal_messages_visibility_check CHECK ((visibility = ANY (ARRAY['all_staff'::text, 'lawyers_only'::text, 'designated'::text])))
);


--
-- Name: invite_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_tokens (
    id bigint NOT NULL,
    token text NOT NULL,
    role text DEFAULT 'CONSULTANT'::text NOT NULL,
    email text,
    expires_at timestamp with time zone NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_by text,
    used_at timestamp with time zone,
    is_used boolean DEFAULT false
);


--
-- Name: invite_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invite_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invite_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invite_tokens_id_seq OWNED BY public.invite_tokens.id;


--
-- Name: lawyer_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyer_accounts (
    auth_user_id uuid NOT NULL,
    lawyer_id text NOT NULL,
    auth_email text,
    approved boolean DEFAULT false NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lawyer_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyer_inquiries (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lawyer_private_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyer_private_profiles (
    lawyer_id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid()
);


--
-- Name: lawyer_profile_tombstones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyer_profile_tombstones (
    lawyer_id text NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid
);


--
-- Name: lawyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyers (
    id text NOT NULL,
    law_firm_id text DEFAULT ''::text,
    team_id text DEFAULT ''::text,
    name text DEFAULT ''::text NOT NULL,
    firm_name text DEFAULT ''::text,
    role text DEFAULT 'lawyer'::text,
    fields jsonb DEFAULT '[]'::jsonb,
    region text DEFAULT ''::text,
    avatar text DEFAULT ''::text,
    avatar_data text DEFAULT ''::text,
    bio text DEFAULT ''::text,
    career text DEFAULT ''::text,
    education text DEFAULT ''::text,
    specialties jsonb DEFAULT '[]'::jsonb,
    success_rate numeric DEFAULT 0,
    total_cases integer DEFAULT 0,
    matched_count integer DEFAULT 0,
    avg_repayment_rate numeric DEFAULT 0,
    court_jurisdiction text DEFAULT ''::text,
    ad_tier text DEFAULT 'free'::text,
    ai_case_analysis_enabled boolean DEFAULT false,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: main_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.main_banners (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: marketing_channel_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_channel_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    channel character varying(30) NOT NULL,
    post_type character varying(30) NOT NULL,
    payload jsonb NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    published_at timestamp with time zone,
    publish_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    external_post_id text,
    external_post_url text,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_channel_posts_channel_check CHECK (((channel)::text = ANY ((ARRAY['blog'::character varying, 'shorts'::character varying, 'tiktok'::character varying, 'cardnews'::character varying, 'threads'::character varying, 'facebook'::character varying])::text[]))),
    CONSTRAINT marketing_channel_posts_publish_status_check CHECK (((publish_status)::text = ANY ((ARRAY['pending'::character varying, 'published'::character varying, 'published_manual'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: marketing_daily_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_daily_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_date date NOT NULL,
    day_theme_code character varying(50) NOT NULL,
    news_title text,
    news jsonb DEFAULT '{}'::jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    step1_news_fact text,
    step2_debtor_dilemma text,
    step3_mykim_bridge text,
    channels jsonb DEFAULT '{}'::jsonb NOT NULL,
    compliance jsonb DEFAULT '{}'::jsonb NOT NULL,
    compliance_score integer DEFAULT 0 NOT NULL,
    models jsonb DEFAULT '{}'::jsonb NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(30) DEFAULT 'ready'::character varying NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_daily_campaigns_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'cron'::character varying])::text[]))),
    CONSTRAINT marketing_daily_campaigns_status_check CHECK (((status)::text = ANY ((ARRAY['ready'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying])::text[])))
);


--
-- Name: matching_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matching_config (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id text NOT NULL,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    alias text DEFAULT ''::text,
    role text DEFAULT 'CLIENT'::text,
    login_channel text DEFAULT 'email'::text,
    status text DEFAULT 'active'::text,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: news_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_articles (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_channel_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_channel_settings (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: platform_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_config (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: popup_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.popup_config (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: rehab_policy_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rehab_policy_settings (
    id text DEFAULT 'main'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: shared_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_reports (
    id text NOT NULL,
    ciphertext text NOT NULL,
    pin_hash text NOT NULL,
    created_by uuid,
    failed_attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    locked_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    last_opened_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_activities (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text DEFAULT 'default'::text,
    staff_id text DEFAULT ''::text NOT NULL,
    staff_name text DEFAULT ''::text,
    action text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_members (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'STAFF'::text NOT NULL,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    avatar text DEFAULT ''::text,
    is_active boolean DEFAULT true,
    assigned_count integer DEFAULT 0,
    permissions jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    supervising_lawyer_id text,
    invited_by text,
    approved_at timestamp with time zone,
    removed_at timestamp with time zone,
    removal_reason text,
    last_active_at timestamp with time zone,
    auth_email text,
    auth_provider text DEFAULT 'email'::text,
    supabase_user_id uuid,
    linked_user_id text,
    invite_token text,
    password_last_changed timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: success_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.success_reviews (
    id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    assigner_id text NOT NULL,
    assigner_name text NOT NULL,
    assignee_id text NOT NULL,
    assignee_name text NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    due_date date,
    completed_at timestamp with time zone,
    completion_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subtasks jsonb DEFAULT '[]'::jsonb,
    requires_approval boolean DEFAULT false,
    review_note text,
    approval_note text,
    template_id text,
    case_stage text,
    task_domain text,
    lead_id text,
    lead_phone text,
    lead_debt numeric,
    CONSTRAINT task_tickets_priority_check CHECK ((priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text]))),
    CONSTRAINT task_tickets_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'REVIEW_REQUESTED'::text, 'COMPLETED'::text, 'CANCELLED'::text]))),
    CONSTRAINT task_tickets_target_type_check CHECK ((target_type = ANY (ARRAY['consult_request'::text, 'case'::text, 'copilot_review'::text, 'general'::text, 'sales_lead'::text])))
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    user_name text NOT NULL,
    user_email text,
    user_role text NOT NULL,
    firm_name text,
    device_type text NOT NULL,
    os text NOT NULL,
    browser text NOT NULL,
    user_agent text,
    ip_address text NOT NULL,
    location text,
    status text DEFAULT 'active'::text NOT NULL,
    is_suspicious boolean DEFAULT false,
    suspicious_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by text,
    revoke_reason text,
    CONSTRAINT user_sessions_device_type_check CHECK ((device_type = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text, 'unknown'::text]))),
    CONSTRAINT user_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text]))),
    CONSTRAINT user_sessions_user_role_check CHECK ((user_role = ANY (ARRAY['ADMIN'::text, 'LAWYER'::text, 'STAFF'::text, 'CLIENT'::text])))
);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: diagnosis_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_config ALTER COLUMN id SET DEFAULT nextval('public.diagnosis_config_id_seq'::regclass);


--
-- Name: diagnosis_config version; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_config ALTER COLUMN version SET DEFAULT nextval('public.diagnosis_config_version_seq'::regclass);


--
-- Name: diagnosis_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_results ALTER COLUMN id SET DEFAULT nextval('public.diagnosis_results_id_seq'::regclass);


--
-- Name: diagnosis_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_stats ALTER COLUMN id SET DEFAULT nextval('public.diagnosis_stats_id_seq'::regclass);


--
-- Name: invite_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_tokens_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ad_orders ad_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_orders
    ADD CONSTRAINT ad_orders_pkey PRIMARY KEY (id);


--
-- Name: alimtok_logs alimtok_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alimtok_logs
    ADD CONSTRAINT alimtok_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: client_aliases client_aliases_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_aliases
    ADD CONSTRAINT client_aliases_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: client_aliases client_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_aliases
    ADD CONSTRAINT client_aliases_pkey PRIMARY KEY (alias);


--
-- Name: client_inquiries client_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_inquiries
    ADD CONSTRAINT client_inquiries_pkey PRIMARY KEY (id);


--
-- Name: client_memos client_memos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_memos
    ADD CONSTRAINT client_memos_pkey PRIMARY KEY (id);


--
-- Name: client_qas client_qas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_qas
    ADD CONSTRAINT client_qas_pkey PRIMARY KEY (id);


--
-- Name: consult_messages consult_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consult_messages
    ADD CONSTRAINT consult_messages_pkey PRIMARY KEY (id);


--
-- Name: consult_requests consult_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consult_requests
    ADD CONSTRAINT consult_requests_pkey PRIMARY KEY (id);


--
-- Name: copilot_cases copilot_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_cases
    ADD CONSTRAINT copilot_cases_pkey PRIMARY KEY (id);


--
-- Name: copilot_rulesets copilot_rulesets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_rulesets
    ADD CONSTRAINT copilot_rulesets_pkey PRIMARY KEY (id);


--
-- Name: crm_clients crm_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_clients
    ADD CONSTRAINT crm_clients_pkey PRIMARY KEY (client_id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);


--
-- Name: diagnosis_config diagnosis_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_config
    ADD CONSTRAINT diagnosis_config_pkey PRIMARY KEY (id);


--
-- Name: diagnosis_results diagnosis_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_results
    ADD CONSTRAINT diagnosis_results_pkey PRIMARY KEY (id);


--
-- Name: diagnosis_stats diagnosis_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_stats
    ADD CONSTRAINT diagnosis_stats_pkey PRIMARY KEY (id);


--
-- Name: doc_share_packages doc_share_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_share_packages
    ADD CONSTRAINT doc_share_packages_pkey PRIMARY KEY (token);


--
-- Name: electronic_contracts electronic_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_contracts
    ADD CONSTRAINT electronic_contracts_pkey PRIMARY KEY (id);


--
-- Name: fee_notification_settings fee_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_notification_settings
    ADD CONSTRAINT fee_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: in_app_notifications in_app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT in_app_notifications_pkey PRIMARY KEY (id);


--
-- Name: internal_messages internal_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_messages
    ADD CONSTRAINT internal_messages_pkey PRIMARY KEY (id);


--
-- Name: invite_tokens invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);


--
-- Name: invite_tokens invite_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);


--
-- Name: lawyer_accounts lawyer_accounts_lawyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_accounts
    ADD CONSTRAINT lawyer_accounts_lawyer_id_key UNIQUE (lawyer_id);


--
-- Name: lawyer_accounts lawyer_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_accounts
    ADD CONSTRAINT lawyer_accounts_pkey PRIMARY KEY (auth_user_id);


--
-- Name: lawyer_inquiries lawyer_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_inquiries
    ADD CONSTRAINT lawyer_inquiries_pkey PRIMARY KEY (id);


--
-- Name: lawyer_private_profiles lawyer_private_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_private_profiles
    ADD CONSTRAINT lawyer_private_profiles_pkey PRIMARY KEY (lawyer_id);


--
-- Name: lawyer_profile_tombstones lawyer_profile_tombstones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_profile_tombstones
    ADD CONSTRAINT lawyer_profile_tombstones_pkey PRIMARY KEY (lawyer_id);


--
-- Name: lawyers lawyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT lawyers_pkey PRIMARY KEY (id);


--
-- Name: main_banners main_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.main_banners
    ADD CONSTRAINT main_banners_pkey PRIMARY KEY (id);


--
-- Name: marketing_channel_posts marketing_channel_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_channel_posts
    ADD CONSTRAINT marketing_channel_posts_pkey PRIMARY KEY (id);


--
-- Name: marketing_daily_campaigns marketing_daily_campaigns_campaign_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_daily_campaigns
    ADD CONSTRAINT marketing_daily_campaigns_campaign_date_key UNIQUE (campaign_date);


--
-- Name: marketing_daily_campaigns marketing_daily_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_daily_campaigns
    ADD CONSTRAINT marketing_daily_campaigns_pkey PRIMARY KEY (id);


--
-- Name: matching_config matching_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_config
    ADD CONSTRAINT matching_config_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: notification_channel_settings notification_channel_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_channel_settings
    ADD CONSTRAINT notification_channel_settings_pkey PRIMARY KEY (id);


--
-- Name: platform_config platform_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_config
    ADD CONSTRAINT platform_config_pkey PRIMARY KEY (id);


--
-- Name: popup_config popup_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.popup_config
    ADD CONSTRAINT popup_config_pkey PRIMARY KEY (id);


--
-- Name: rehab_policy_settings rehab_policy_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_policy_settings
    ADD CONSTRAINT rehab_policy_settings_pkey PRIMARY KEY (id);


--
-- Name: shared_reports shared_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_reports
    ADD CONSTRAINT shared_reports_pkey PRIMARY KEY (id);


--
-- Name: staff_activities staff_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_activities
    ADD CONSTRAINT staff_activities_pkey PRIMARY KEY (id);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: success_reviews success_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.success_reviews
    ADD CONSTRAINT success_reviews_pkey PRIMARY KEY (id);


--
-- Name: task_tickets task_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tickets
    ADD CONSTRAINT task_tickets_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: idx_ad_orders_lawyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_orders_lawyer ON public.ad_orders USING btree (lawyer_id, requested_at DESC);


--
-- Name: idx_ad_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_orders_status ON public.ad_orders USING btree (status, requested_at DESC);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_auth_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_auth_uid ON public.audit_logs USING btree (auth_uid, created_at DESC);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_target ON public.audit_logs USING btree (target_type, target_id, created_at DESC);


--
-- Name: idx_consult_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_messages_created ON public.consult_messages USING btree (created_at DESC);


--
-- Name: idx_consult_messages_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_messages_request ON public.consult_messages USING btree (consult_request_id);


--
-- Name: idx_consult_requests_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_requests_client ON public.consult_requests USING btree (client_id);


--
-- Name: idx_consult_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_requests_created ON public.consult_requests USING btree (created_at DESC);


--
-- Name: idx_contracts_consult_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_consult_request ON public.electronic_contracts USING btree (consult_request_id) WHERE (consult_request_id IS NOT NULL);


--
-- Name: idx_diagnosis_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diagnosis_session ON public.diagnosis_results USING btree (session_id, created_at DESC);


--
-- Name: idx_invite_tokens_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_tokens_created ON public.invite_tokens USING btree (created_by, created_at DESC);


--
-- Name: idx_invite_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_tokens_token ON public.invite_tokens USING btree (token);


--
-- Name: idx_messages_mentions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_mentions ON public.internal_messages USING gin (mentions);


--
-- Name: idx_messages_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_parent ON public.internal_messages USING btree (parent_id);


--
-- Name: idx_messages_tenant_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_tenant_target ON public.internal_messages USING btree (tenant_id, target_type, target_id);


--
-- Name: idx_mk_campaigns_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mk_campaigns_date ON public.marketing_daily_campaigns USING btree (campaign_date DESC);


--
-- Name: idx_mk_posts_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mk_posts_campaign ON public.marketing_channel_posts USING btree (campaign_id);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.in_app_notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.in_app_notifications USING btree (tenant_id, recipient_id, is_read);


--
-- Name: idx_shared_reports_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_reports_expires ON public.shared_reports USING btree (expires_at);


--
-- Name: idx_staff_auth_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_auth_email ON public.staff_members USING btree (auth_email);


--
-- Name: idx_staff_invited_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_invited_by ON public.staff_members USING btree (invited_by);


--
-- Name: idx_staff_linked_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_linked_user ON public.staff_members USING btree (linked_user_id);


--
-- Name: idx_staff_supabase_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_supabase_uid ON public.staff_members USING btree (supabase_user_id);


--
-- Name: idx_tickets_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assignee ON public.task_tickets USING btree (tenant_id, assignee_id, status);


--
-- Name: idx_tickets_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_target ON public.task_tickets USING btree (tenant_id, target_type, target_id);


--
-- Name: idx_tickets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_tenant ON public.task_tickets USING btree (tenant_id);


--
-- Name: idx_user_sessions_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_ip ON public.user_sessions USING btree (ip_address);


--
-- Name: idx_user_sessions_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_last_active ON public.user_sessions USING btree (last_active_at DESC);


--
-- Name: idx_user_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_status ON public.user_sessions USING btree (status);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: uq_client_aliases_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_client_aliases_normalized ON public.client_aliases USING btree (lower(regexp_replace(alias, '\s+'::text, ''::text, 'g'::text)));


--
-- Name: uq_contract_open_per_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_contract_open_per_proposal ON public.electronic_contracts USING btree (source_proposal_id) WHERE ((source_proposal_id IS NOT NULL) AND (status = ANY (ARRAY['drafting'::text, 'pending_sign'::text, 'client_review'::text])));


--
-- Name: lawyers trg_a_block_tombstoned_lawyer_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_a_block_tombstoned_lawyer_insert BEFORE INSERT ON public.lawyers FOR EACH ROW EXECUTE FUNCTION public.block_tombstoned_lawyer_insert();


--
-- Name: lawyer_private_profiles trg_a_block_tombstoned_private_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_a_block_tombstoned_private_insert BEFORE INSERT ON public.lawyer_private_profiles FOR EACH ROW EXECUTE FUNCTION public.block_tombstoned_private_insert();


--
-- Name: ad_orders trg_ad_orders_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ad_orders_audit BEFORE UPDATE ON public.ad_orders FOR EACH ROW EXECUTE FUNCTION public.ad_orders_audit();


--
-- Name: audit_logs trg_audit_logs_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION public.audit_logs_immutable();


--
-- Name: audit_logs trg_audit_logs_no_update_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_logs_no_update_delete BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();


--
-- Name: audit_logs trg_audit_logs_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_logs_normalize BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_normalize();


--
-- Name: consult_requests trg_consult_requests_protect_admin_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consult_requests_protect_admin_fields BEFORE INSERT OR UPDATE ON public.consult_requests FOR EACH ROW EXECUTE FUNCTION public.consult_requests_protect_admin_fields();


--
-- Name: consult_requests trg_guard_consult_request_privileged; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_consult_request_privileged BEFORE INSERT OR UPDATE ON public.consult_requests FOR EACH ROW EXECUTE FUNCTION public.guard_consult_request_privileged_columns();


--
-- Name: lawyers trg_guard_lawyer_admin_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_lawyer_admin_fields BEFORE INSERT OR UPDATE ON public.lawyers FOR EACH ROW EXECUTE FUNCTION public.guard_lawyer_admin_fields();


--
-- Name: lawyer_private_profiles trg_guard_lawyer_private_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_lawyer_private_profile BEFORE INSERT OR UPDATE ON public.lawyer_private_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_lawyer_private_profile();


--
-- Name: lawyers trg_strip_lawyer_secrets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_strip_lawyer_secrets BEFORE INSERT OR UPDATE ON public.lawyers FOR EACH ROW EXECUTE FUNCTION public.strip_lawyer_secrets();


--
-- Name: lawyer_accounts trg_sync_lawyer_profile_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_lawyer_profile_approval AFTER INSERT OR UPDATE OF approved, lawyer_id ON public.lawyer_accounts FOR EACH ROW EXECUTE FUNCTION public.sync_lawyer_profile_approval();


--
-- Name: task_tickets trg_task_tickets_guard_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_tickets_guard_approval BEFORE UPDATE ON public.task_tickets FOR EACH ROW EXECUTE FUNCTION public.task_tickets_guard_approval();


--
-- Name: user_sessions trg_user_sessions_server_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_sessions_server_fields BEFORE INSERT ON public.user_sessions FOR EACH ROW EXECUTE FUNCTION public.user_sessions_server_fields();


--
-- Name: client_aliases client_aliases_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_aliases
    ADD CONSTRAINT client_aliases_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: consult_messages consult_messages_consult_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consult_messages
    ADD CONSTRAINT consult_messages_consult_request_id_fkey FOREIGN KEY (consult_request_id) REFERENCES public.consult_requests(id) ON DELETE CASCADE;


--
-- Name: doc_share_packages doc_share_packages_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_share_packages
    ADD CONSTRAINT doc_share_packages_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: internal_messages internal_messages_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_messages
    ADD CONSTRAINT internal_messages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.internal_messages(id) ON DELETE CASCADE;


--
-- Name: lawyer_accounts lawyer_accounts_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyer_accounts
    ADD CONSTRAINT lawyer_accounts_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: marketing_channel_posts marketing_channel_posts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_channel_posts
    ADD CONSTRAINT marketing_channel_posts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_daily_campaigns(id) ON DELETE CASCADE;


--
-- Name: shared_reports shared_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_reports
    ADD CONSTRAINT shared_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs activity_logs_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_admin_select ON public.activity_logs FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ad_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_orders ad_orders_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ad_orders_delete_admin ON public.ad_orders FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: ad_orders ad_orders_insert_own_pending; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ad_orders_insert_own_pending ON public.ad_orders FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() OR ((lawyer_id = public.current_lawyer_profile_id()) AND (status = 'pending'::text) AND (paid_at IS NULL) AND (activated_at IS NULL) AND (expires_at IS NULL) AND (tax_invoice IS NULL) AND (modified_tax_invoice IS NULL))));


--
-- Name: ad_orders ad_orders_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ad_orders_select_own_or_admin ON public.ad_orders FOR SELECT TO authenticated USING (((lawyer_id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: ad_orders ad_orders_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ad_orders_update_admin ON public.ad_orders FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: client_memos admin_all_client_memos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_client_memos ON public.client_memos TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: copilot_cases admin_all_copilot_cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_copilot_cases ON public.copilot_cases TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: copilot_rulesets admin_all_copilot_rulesets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_copilot_rulesets ON public.copilot_rulesets TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: custom_roles admin_all_custom_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_custom_roles ON public.custom_roles TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: fee_notification_settings admin_all_fee_notification_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_fee_notification_settings ON public.fee_notification_settings TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: notification_channel_settings admin_all_notification_channel_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_notification_channel_settings ON public.notification_channel_settings TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: alimtok_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alimtok_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: consult_messages allow_all_consult_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_consult_messages ON public.consult_messages USING (true) WITH CHECK (true);


--
-- Name: consult_requests allow_all_consult_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_consult_requests ON public.consult_requests USING (true) WITH CHECK (true);


--
-- Name: alimtok_logs allow_anon_all_alimtok_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_anon_all_alimtok_logs ON public.alimtok_logs TO anon USING (true) WITH CHECK (true);


--
-- Name: cases allow_anon_all_cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_anon_all_cases ON public.cases TO anon USING (true) WITH CHECK (true);


--
-- Name: electronic_contracts allow_anon_all_electronic_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_anon_all_electronic_contracts ON public.electronic_contracts TO anon USING (true) WITH CHECK (true);


--
-- Name: lawyers allow_anon_all_lawyers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_anon_all_lawyers ON public.lawyers TO anon USING (true) WITH CHECK (true);


--
-- Name: staff_activities allow_anon_all_staff_activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_anon_all_staff_activities ON public.staff_activities TO anon USING (true) WITH CHECK (true);


--
-- Name: consult_messages anon_insert_consult_message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert_consult_message ON public.consult_messages FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: consult_requests anon_insert_consult_request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert_consult_request ON public.consult_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: diagnosis_results anon_insert_diagnosis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert_diagnosis ON public.diagnosis_results FOR INSERT TO anon WITH CHECK (true);


--
-- Name: diagnosis_results anon_select_own_diagnosis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_own_diagnosis ON public.diagnosis_results FOR SELECT TO anon USING (false);


--
-- Name: diagnosis_results anon_update_own_diagnosis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update_own_diagnosis ON public.diagnosis_results FOR UPDATE TO anon USING (false);


--
-- Name: electronic_contracts anti_bola_delete_electronic_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_delete_electronic_contracts ON public.electronic_contracts FOR DELETE TO authenticated USING (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = (auth.uid())::text) AND (m.role = ANY (ARRAY['ADMIN'::text, 'OWNER'::text])))))));


--
-- Name: electronic_contracts anti_bola_insert_electronic_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_insert_electronic_contracts ON public.electronic_contracts FOR INSERT TO authenticated WITH CHECK ((((auth.uid())::text = client_id) OR (client_id = 'client-temp'::text) OR (assigned_lawyer_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = (auth.uid())::text) AND (m.role = ANY (ARRAY['LAWYER'::text, 'OWNER'::text])))))));


--
-- Name: cases anti_bola_modify_cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_modify_cases ON public.cases TO authenticated USING ((assigned_lawyer_id = (auth.uid())::text)) WITH CHECK ((assigned_lawyer_id = (auth.uid())::text));


--
-- Name: crm_clients anti_bola_modify_crm_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_modify_crm_clients ON public.crm_clients TO authenticated USING ((((auth.uid())::text = client_id) OR ((auth.uid())::text = assignee_id) OR ((auth.uid())::text = assigned_lawyer_id) OR ((auth.uid())::text = assigned_consultant_id) OR ((auth.uid())::text = assigned_staff_id))) WITH CHECK ((((auth.uid())::text = client_id) OR ((auth.uid())::text = assignee_id) OR ((auth.uid())::text = assigned_lawyer_id) OR ((auth.uid())::text = assigned_consultant_id) OR ((auth.uid())::text = assigned_staff_id)));


--
-- Name: alimtok_logs anti_bola_select_alimtok_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_select_alimtok_logs ON public.alimtok_logs FOR SELECT TO authenticated USING (((client_id = (auth.uid())::text) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = (auth.uid())::text) AND (m.role = ANY (ARRAY['LAWYER'::text, 'ADMIN'::text, 'STAFF'::text])))))));


--
-- Name: cases anti_bola_select_cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_select_cases ON public.cases FOR SELECT TO authenticated USING (((assigned_lawyer_id = (auth.uid())::text) OR (client_id = (auth.uid())::text)));


--
-- Name: crm_clients anti_bola_select_crm_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_select_crm_clients ON public.crm_clients FOR SELECT TO authenticated USING ((((auth.uid())::text = client_id) OR ((auth.uid())::text = assignee_id) OR ((auth.uid())::text = assigned_lawyer_id) OR ((auth.uid())::text = assigned_consultant_id) OR ((auth.uid())::text = assigned_staff_id)));


--
-- Name: electronic_contracts anti_bola_select_electronic_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_select_electronic_contracts ON public.electronic_contracts FOR SELECT TO authenticated USING ((((auth.uid())::text = client_id) OR (assigned_lawyer_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = (auth.uid())::text) AND (m.role = ANY (ARRAY['LAWYER'::text, 'OWNER'::text])) AND (m.id = electronic_contracts.assigned_lawyer_id))))));


--
-- Name: electronic_contracts anti_bola_update_electronic_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anti_bola_update_electronic_contracts ON public.electronic_contracts FOR UPDATE TO authenticated USING ((((auth.uid())::text = client_id) OR (assigned_lawyer_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = (auth.uid())::text) AND (m.role = ANY (ARRAY['LAWYER'::text, 'OWNER'::text])) AND (m.id = electronic_contracts.assigned_lawyer_id)))))) WITH CHECK (true);


--
-- Name: audit_logs anyone_insert_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_insert_audit ON public.audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_admin_select ON public.audit_logs FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: diagnosis_results authenticated_select_diagnosis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_diagnosis ON public.diagnosis_results FOR SELECT TO authenticated USING (true);


--
-- Name: diagnosis_results authenticated_update_diagnosis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_diagnosis ON public.diagnosis_results FOR UPDATE TO authenticated USING (true);


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events calendar_tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_tenant_delete ON public.calendar_events FOR DELETE TO authenticated USING ((public.is_tenant_member(tenant_id) AND ((assigned_staff_id = ANY (public.current_actor_ids())) OR (public.tenant_role(tenant_id) = 'OWNER'::text))));


--
-- Name: calendar_events calendar_tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_tenant_insert ON public.calendar_events FOR INSERT TO authenticated WITH CHECK ((public.is_tenant_member(tenant_id) AND (assigned_staff_id = ANY (public.current_actor_ids()))));


--
-- Name: calendar_events calendar_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_tenant_select ON public.calendar_events FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (public.is_tenant_member(tenant_id) AND ((assigned_staff_id = ANY (public.current_actor_ids())) OR (visibility = 'firm'::text) OR ((visibility = 'lawyers'::text) AND (public.tenant_role(tenant_id) = ANY (ARRAY['OWNER'::text, 'LAWYER'::text])))))));


--
-- Name: calendar_events calendar_tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_tenant_update ON public.calendar_events FOR UPDATE TO authenticated USING ((public.is_tenant_member(tenant_id) AND ((assigned_staff_id = ANY (public.current_actor_ids())) OR (public.tenant_role(tenant_id) = 'OWNER'::text)))) WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: client_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: client_aliases client_aliases_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_aliases_select_self ON public.client_aliases FOR SELECT TO authenticated USING ((auth_user_id = auth.uid()));


--
-- Name: client_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: client_inquiries client_inquiries_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_inquiries_admin_select ON public.client_inquiries FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: client_memos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_memos ENABLE ROW LEVEL SECURITY;

--
-- Name: client_qas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_qas ENABLE ROW LEVEL SECURITY;

--
-- Name: client_qas client_qas_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_qas_admin_write ON public.client_qas TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: client_qas client_qas_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_qas_public_select ON public.client_qas FOR SELECT TO authenticated, anon USING (true);


--
-- Name: consult_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consult_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: consult_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consult_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_rulesets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_rulesets ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosis_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosis_config ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosis_config diagnosis_config_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY diagnosis_config_admin_write ON public.diagnosis_config TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: diagnosis_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosis_results ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosis_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosis_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: doc_share_packages doc_share_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_share_delete_own ON public.doc_share_packages FOR DELETE TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: doc_share_packages doc_share_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_share_insert_own ON public.doc_share_packages FOR INSERT TO authenticated WITH CHECK (((owner_user_id = auth.uid()) AND (expires_at <= (now() + '8 days'::interval))));


--
-- Name: doc_share_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doc_share_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: doc_share_packages doc_share_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_share_select_own ON public.doc_share_packages FOR SELECT TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: electronic_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.electronic_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: in_app_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_tokens invite_tokens_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_tokens_owner_or_admin ON public.invite_tokens TO authenticated USING (((created_by = public.current_approved_lawyer_id()) OR public.is_platform_admin())) WITH CHECK (((created_by = public.current_approved_lawyer_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lawyer_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: lawyer_accounts lawyer_accounts_select_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_accounts_select_self_or_admin ON public.lawyer_accounts FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) OR public.is_platform_admin()));


--
-- Name: lawyer_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lawyer_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: lawyer_inquiries lawyer_inquiries_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_inquiries_admin_write ON public.lawyer_inquiries FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: lawyer_inquiries lawyer_inquiries_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_inquiries_own_insert ON public.lawyer_inquiries FOR INSERT TO authenticated WITH CHECK ((((data ->> 'lawyerId'::text) = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_inquiries lawyer_inquiries_own_or_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_inquiries_own_or_admin_select ON public.lawyer_inquiries FOR SELECT TO authenticated USING ((((data ->> 'lawyerId'::text) = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_private_profiles lawyer_private_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_private_delete_admin ON public.lawyer_private_profiles FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: lawyer_private_profiles lawyer_private_insert_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_private_insert_self_or_admin ON public.lawyer_private_profiles FOR INSERT TO authenticated WITH CHECK (((lawyer_id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_private_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lawyer_private_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: lawyer_private_profiles lawyer_private_select_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_private_select_self_or_admin ON public.lawyer_private_profiles FOR SELECT TO authenticated USING (((lawyer_id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_private_profiles lawyer_private_update_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_private_update_self_or_admin ON public.lawyer_private_profiles FOR UPDATE TO authenticated USING (((lawyer_id = public.current_lawyer_profile_id()) OR public.is_platform_admin())) WITH CHECK (((lawyer_id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyer_profile_tombstones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lawyer_profile_tombstones ENABLE ROW LEVEL SECURITY;

--
-- Name: lawyer_profile_tombstones lawyer_tombstones_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_tombstones_delete_admin ON public.lawyer_profile_tombstones FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: lawyer_profile_tombstones lawyer_tombstones_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyer_tombstones_select_all ON public.lawyer_profile_tombstones FOR SELECT TO authenticated, anon USING (true);


--
-- Name: lawyers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;

--
-- Name: lawyers lawyers_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyers_delete_admin ON public.lawyers FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: lawyers lawyers_insert_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyers_insert_self_or_admin ON public.lawyers FOR INSERT TO authenticated WITH CHECK (((id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: lawyers lawyers_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyers_select_authenticated ON public.lawyers FOR SELECT TO authenticated USING (true);


--
-- Name: lawyers lawyers_update_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lawyers_update_self_or_admin ON public.lawyers FOR UPDATE TO authenticated USING (((id = public.current_lawyer_profile_id()) OR public.is_platform_admin())) WITH CHECK (((id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: main_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.main_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: main_banners main_banners_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY main_banners_admin_write ON public.main_banners TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: main_banners main_banners_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY main_banners_public_select ON public.main_banners FOR SELECT TO authenticated, anon USING (true);


--
-- Name: marketing_channel_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_channel_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_channel_posts marketing_channel_posts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_channel_posts_admin_all ON public.marketing_channel_posts TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: marketing_daily_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_daily_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_daily_campaigns marketing_daily_campaigns_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_daily_campaigns_admin_all ON public.marketing_daily_campaigns TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: matching_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matching_config ENABLE ROW LEVEL SECURITY;

--
-- Name: matching_config matching_config_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_config_admin_write ON public.matching_config TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: matching_config matching_config_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_config_public_select ON public.matching_config FOR SELECT TO authenticated, anon USING (true);


--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: members members_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_admin_all ON public.members TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: members members_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_self_select ON public.members FOR SELECT TO authenticated USING ((id = (auth.uid())::text));


--
-- Name: internal_messages messages_author_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_author_delete ON public.internal_messages FOR DELETE TO authenticated USING ((public.is_tenant_member(tenant_id) AND (author_id = ANY (public.current_actor_ids()))));


--
-- Name: internal_messages messages_tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_tenant_insert ON public.internal_messages FOR INSERT TO authenticated WITH CHECK ((public.is_tenant_member(tenant_id) AND (author_id = ANY (public.current_actor_ids())) AND ((visibility <> 'lawyers_only'::text) OR (public.tenant_role(tenant_id) = ANY (ARRAY['OWNER'::text, 'LAWYER'::text])) OR (parent_id IS NOT NULL))));


--
-- Name: internal_messages messages_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_tenant_select ON public.internal_messages FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (public.is_tenant_member(tenant_id) AND ((author_id = ANY (public.current_actor_ids())) OR (visibility = 'all_staff'::text) OR ((visibility = 'lawyers_only'::text) AND (public.tenant_role(tenant_id) = ANY (ARRAY['OWNER'::text, 'LAWYER'::text]))) OR ((visibility = 'designated'::text) AND (designated_user_ids && public.current_actor_ids()))))));


--
-- Name: internal_messages messages_tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_tenant_update ON public.internal_messages FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: news_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: news_articles news_articles_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_articles_admin_write ON public.news_articles TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: news_articles news_articles_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_articles_public_select ON public.news_articles FOR SELECT TO authenticated, anon USING (true);


--
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

--
-- Name: notices notices_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notices_admin_write ON public.notices TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: notices notices_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notices_public_select ON public.notices FOR SELECT TO authenticated, anon USING (true);


--
-- Name: notification_channel_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_channel_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: in_app_notifications notifications_recipient_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_recipient_delete ON public.in_app_notifications FOR DELETE TO authenticated USING ((recipient_id = ANY (public.current_actor_ids())));


--
-- Name: in_app_notifications notifications_recipient_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_recipient_select ON public.in_app_notifications FOR SELECT TO authenticated USING (((recipient_id = ANY (public.current_actor_ids())) OR public.is_platform_admin()));


--
-- Name: in_app_notifications notifications_recipient_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_recipient_update ON public.in_app_notifications FOR UPDATE TO authenticated USING ((recipient_id = ANY (public.current_actor_ids()))) WITH CHECK ((recipient_id = ANY (public.current_actor_ids())));


--
-- Name: in_app_notifications notifications_tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_tenant_insert ON public.in_app_notifications FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: platform_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_config platform_config_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_config_admin_write ON public.platform_config TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: platform_config platform_config_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_config_public_select ON public.platform_config FOR SELECT TO authenticated, anon USING (true);


--
-- Name: popup_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.popup_config ENABLE ROW LEVEL SECURITY;

--
-- Name: popup_config popup_config_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY popup_config_admin_write ON public.popup_config TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: popup_config popup_config_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY popup_config_public_select ON public.popup_config FOR SELECT TO authenticated, anon USING (true);


--
-- Name: consult_messages public_delete_consult_message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_delete_consult_message ON public.consult_messages FOR DELETE TO authenticated, anon USING (true);


--
-- Name: consult_requests public_delete_consult_request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_delete_consult_request ON public.consult_requests FOR DELETE TO authenticated, anon USING (true);


--
-- Name: diagnosis_config public_read_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_config ON public.diagnosis_config FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: diagnosis_stats public_read_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_stats ON public.diagnosis_stats FOR SELECT TO authenticated, anon USING (true);


--
-- Name: consult_messages public_select_consult_message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_select_consult_message ON public.consult_messages FOR SELECT TO authenticated, anon USING (true);


--
-- Name: consult_requests public_select_consult_request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_select_consult_request ON public.consult_requests FOR SELECT TO authenticated, anon USING (true);


--
-- Name: consult_messages public_update_consult_message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_update_consult_message ON public.consult_messages FOR UPDATE TO authenticated, anon USING (true);


--
-- Name: consult_requests public_update_consult_request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_update_consult_request ON public.consult_requests FOR UPDATE TO authenticated, anon USING (true);


--
-- Name: rehab_policy_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rehab_policy_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: rehab_policy_settings rehab_policy_settings_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rehab_policy_settings_admin_write ON public.rehab_policy_settings TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: rehab_policy_settings rehab_policy_settings_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rehab_policy_settings_public_select ON public.rehab_policy_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: shared_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members staff_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_delete_owner ON public.staff_members FOR DELETE TO authenticated USING (((invited_by = public.current_approved_lawyer_id()) OR public.is_platform_admin()));


--
-- Name: staff_members staff_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_insert_owner ON public.staff_members FOR INSERT TO authenticated WITH CHECK ((((invited_by = public.current_approved_lawyer_id()) AND (role <> 'OWNER'::text)) OR public.is_platform_admin()));


--
-- Name: staff_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members staff_select_owner_self_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_select_owner_self_admin ON public.staff_members FOR SELECT TO authenticated USING (((invited_by = public.current_approved_lawyer_id()) OR (linked_user_id = public.current_lawyer_profile_id()) OR public.is_platform_admin()));


--
-- Name: staff_members staff_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_update_owner ON public.staff_members FOR UPDATE TO authenticated USING (((invited_by = public.current_approved_lawyer_id()) OR public.is_platform_admin())) WITH CHECK ((((invited_by = public.current_approved_lawyer_id()) AND (role <> 'OWNER'::text)) OR public.is_platform_admin()));


--
-- Name: consult_requests strict_delete_consult_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_delete_consult_requests ON public.consult_requests FOR DELETE TO authenticated USING ((((auth.uid())::text = client_id) OR public.is_platform_admin()));


--
-- Name: consult_messages strict_insert_consult_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_insert_consult_messages ON public.consult_messages FOR INSERT TO authenticated WITH CHECK (public.can_access_consult_request(consult_request_id));


--
-- Name: consult_requests strict_insert_consult_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_insert_consult_requests ON public.consult_requests FOR INSERT TO authenticated WITH CHECK ((((auth.uid())::text = client_id) OR public.is_platform_admin()));


--
-- Name: consult_messages strict_select_consult_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_select_consult_messages ON public.consult_messages FOR SELECT TO authenticated USING (public.can_access_consult_request(consult_request_id));


--
-- Name: consult_requests strict_select_consult_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_select_consult_requests ON public.consult_requests FOR SELECT TO authenticated USING ((((auth.uid())::text = client_id) OR public.is_platform_admin()));


--
-- Name: consult_requests strict_update_consult_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strict_update_consult_requests ON public.consult_requests FOR UPDATE TO authenticated USING ((((auth.uid())::text = client_id) OR public.is_platform_admin())) WITH CHECK ((((auth.uid())::text = client_id) OR public.is_platform_admin()));


--
-- Name: success_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.success_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: success_reviews success_reviews_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY success_reviews_admin_write ON public.success_reviews TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: success_reviews success_reviews_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY success_reviews_public_select ON public.success_reviews FOR SELECT TO authenticated, anon USING (true);


--
-- Name: task_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: task_tickets task_tickets_tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_tickets_tenant_delete ON public.task_tickets FOR DELETE TO authenticated USING ((public.is_tenant_member(tenant_id) AND ((assigner_id = ANY (public.current_actor_ids())) OR (public.tenant_role(tenant_id) = 'OWNER'::text))));


--
-- Name: task_tickets task_tickets_tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_tickets_tenant_insert ON public.task_tickets FOR INSERT TO authenticated WITH CHECK ((public.is_tenant_member(tenant_id) AND (assigner_id = ANY (public.current_actor_ids()))));


--
-- Name: task_tickets task_tickets_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_tickets_tenant_select ON public.task_tickets FOR SELECT TO authenticated USING ((public.is_tenant_member(tenant_id) OR public.is_platform_admin()));


--
-- Name: task_tickets task_tickets_tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_tickets_tenant_update ON public.task_tickets FOR UPDATE TO authenticated USING ((public.is_tenant_member(tenant_id) AND ((assignee_id = ANY (public.current_actor_ids())) OR (assigner_id = ANY (public.current_actor_ids())) OR (public.tenant_role(tenant_id) = ANY (ARRAY['OWNER'::text, 'LAWYER'::text]))))) WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions user_sessions_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_owner_insert ON public.user_sessions FOR INSERT TO authenticated WITH CHECK ((public.is_session_owner(user_id) OR public.is_platform_admin()));


--
-- Name: user_sessions user_sessions_owner_revoke_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_owner_revoke_staff ON public.user_sessions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.staff_members s
  WHERE ((s.linked_user_id = user_sessions.user_id) AND (s.invited_by = public.current_approved_lawyer_id()))))) WITH CHECK ((status = ANY (ARRAY['revoked'::text, 'expired'::text])));


--
-- Name: user_sessions user_sessions_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_owner_select ON public.user_sessions FOR SELECT TO authenticated USING ((public.is_session_owner(user_id) OR public.is_platform_admin()));


--
-- Name: user_sessions user_sessions_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_owner_update ON public.user_sessions FOR UPDATE TO authenticated USING ((public.is_session_owner(user_id) OR public.is_platform_admin())) WITH CHECK ((public.is_session_owner(user_id) OR public.is_platform_admin()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_staff_invite(p_token text, p_staff_id text, p_linked_user_id text, p_name text, p_email text, p_avatar text, p_provider text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_staff_invite(p_token text, p_staff_id text, p_linked_user_id text, p_name text, p_email text, p_avatar text, p_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_staff_invite(p_token text, p_staff_id text, p_linked_user_id text, p_name text, p_email text, p_avatar text, p_provider text) TO authenticated;
GRANT ALL ON FUNCTION public.accept_staff_invite(p_token text, p_staff_id text, p_linked_user_id text, p_name text, p_email text, p_avatar text, p_provider text) TO service_role;


--
-- Name: FUNCTION ad_orders_audit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ad_orders_audit() TO anon;
GRANT ALL ON FUNCTION public.ad_orders_audit() TO authenticated;
GRANT ALL ON FUNCTION public.ad_orders_audit() TO service_role;


--
-- Name: FUNCTION admin_audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb) TO service_role;


--
-- Name: FUNCTION admin_delete_lawyer_profile(p_lawyer_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_delete_lawyer_profile(p_lawyer_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_lawyer_profile(p_lawyer_id text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_lawyer_profile(p_lawyer_id text) TO service_role;


--
-- Name: FUNCTION admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_link_lawyer_account(p_email text, p_lawyer_id text, p_approved boolean) TO service_role;


--
-- Name: FUNCTION admin_reopen_stale_consult(p_id text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_reopen_stale_consult(p_id text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_reopen_stale_consult(p_id text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_reopen_stale_consult(p_id text, p_reason text) TO service_role;


--
-- Name: FUNCTION admin_revoke_auth_sessions(p_user_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_revoke_auth_sessions(p_user_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_revoke_auth_sessions(p_user_id text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_revoke_auth_sessions(p_user_id text) TO service_role;


--
-- Name: FUNCTION admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_consult_hidden(p_id text, p_hidden boolean, p_reason text) TO service_role;


--
-- Name: FUNCTION admin_set_consult_status(p_id text, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_consult_status(p_id text, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_consult_status(p_id text, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_consult_status(p_id text, p_status text) TO service_role;


--
-- Name: FUNCTION admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_lawyer_approval(p_lawyer_id text, p_approved boolean) TO service_role;


--
-- Name: FUNCTION audit_logs_immutable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.audit_logs_immutable() TO anon;
GRANT ALL ON FUNCTION public.audit_logs_immutable() TO authenticated;
GRANT ALL ON FUNCTION public.audit_logs_immutable() TO service_role;


--
-- Name: FUNCTION audit_logs_normalize(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.audit_logs_normalize() TO anon;
GRANT ALL ON FUNCTION public.audit_logs_normalize() TO authenticated;
GRANT ALL ON FUNCTION public.audit_logs_normalize() TO service_role;


--
-- Name: FUNCTION block_tombstoned_lawyer_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.block_tombstoned_lawyer_insert() TO anon;
GRANT ALL ON FUNCTION public.block_tombstoned_lawyer_insert() TO authenticated;
GRANT ALL ON FUNCTION public.block_tombstoned_lawyer_insert() TO service_role;


--
-- Name: FUNCTION block_tombstoned_private_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.block_tombstoned_private_insert() TO anon;
GRANT ALL ON FUNCTION public.block_tombstoned_private_insert() TO authenticated;
GRANT ALL ON FUNCTION public.block_tombstoned_private_insert() TO service_role;


--
-- Name: FUNCTION can_access_consult_request(p_request_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_access_consult_request(p_request_id text) TO anon;
GRANT ALL ON FUNCTION public.can_access_consult_request(p_request_id text) TO authenticated;
GRANT ALL ON FUNCTION public.can_access_consult_request(p_request_id text) TO service_role;


--
-- Name: FUNCTION claim_client_alias(p_alias text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_client_alias(p_alias text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_client_alias(p_alias text) TO authenticated;
GRANT ALL ON FUNCTION public.claim_client_alias(p_alias text) TO service_role;


--
-- Name: FUNCTION claim_lawyer_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_lawyer_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_lawyer_account() TO authenticated;
GRANT ALL ON FUNCTION public.claim_lawyer_account() TO service_role;


--
-- Name: FUNCTION cleanup_expired_diagnosis(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_diagnosis() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_diagnosis() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_diagnosis() TO service_role;


--
-- Name: FUNCTION consult_requests_protect_admin_fields(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.consult_requests_protect_admin_fields() TO anon;
GRANT ALL ON FUNCTION public.consult_requests_protect_admin_fields() TO authenticated;
GRANT ALL ON FUNCTION public.consult_requests_protect_admin_fields() TO service_role;


--
-- Name: FUNCTION consume_invite_token(p_token text, p_staff_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_invite_token(p_token text, p_staff_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_invite_token(p_token text, p_staff_id text) TO authenticated;
GRANT ALL ON FUNCTION public.consume_invite_token(p_token text, p_staff_id text) TO service_role;


--
-- Name: FUNCTION create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer) TO authenticated;
GRANT ALL ON FUNCTION public.create_shared_report(p_ciphertext text, p_pin text, p_ttl_hours integer) TO service_role;


--
-- Name: FUNCTION current_actor_ids(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_actor_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_actor_ids() TO authenticated;
GRANT ALL ON FUNCTION public.current_actor_ids() TO service_role;


--
-- Name: FUNCTION current_approved_lawyer_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_approved_lawyer_id() TO anon;
GRANT ALL ON FUNCTION public.current_approved_lawyer_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_approved_lawyer_id() TO service_role;


--
-- Name: FUNCTION current_lawyer_profile_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_lawyer_profile_id() TO anon;
GRANT ALL ON FUNCTION public.current_lawyer_profile_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_lawyer_profile_id() TO service_role;


--
-- Name: FUNCTION current_tenant_ids(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_tenant_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_tenant_ids() TO authenticated;
GRANT ALL ON FUNCTION public.current_tenant_ids() TO service_role;


--
-- Name: FUNCTION get_admin_contract_anchors(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_contract_anchors() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_contract_anchors() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_contract_anchors() TO service_role;


--
-- Name: FUNCTION get_contract_by_remote_token(p_contract_id text, p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_contract_by_remote_token(p_contract_id text, p_token text) TO anon;
GRANT ALL ON FUNCTION public.get_contract_by_remote_token(p_contract_id text, p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_contract_by_remote_token(p_contract_id text, p_token text) TO service_role;


--
-- Name: FUNCTION guard_consult_request_privileged_columns(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_consult_request_privileged_columns() TO anon;
GRANT ALL ON FUNCTION public.guard_consult_request_privileged_columns() TO authenticated;
GRANT ALL ON FUNCTION public.guard_consult_request_privileged_columns() TO service_role;


--
-- Name: FUNCTION guard_lawyer_admin_fields(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_lawyer_admin_fields() TO anon;
GRANT ALL ON FUNCTION public.guard_lawyer_admin_fields() TO authenticated;
GRANT ALL ON FUNCTION public.guard_lawyer_admin_fields() TO service_role;


--
-- Name: FUNCTION guard_lawyer_private_profile(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_lawyer_private_profile() TO anon;
GRANT ALL ON FUNCTION public.guard_lawyer_private_profile() TO authenticated;
GRANT ALL ON FUNCTION public.guard_lawyer_private_profile() TO service_role;


--
-- Name: FUNCTION is_firm_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_firm_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_firm_user() TO authenticated;
GRANT ALL ON FUNCTION public.is_firm_user() TO service_role;


--
-- Name: FUNCTION is_platform_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_platform_admin() TO anon;
GRANT ALL ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin() TO service_role;


--
-- Name: FUNCTION is_session_owner(p_user_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_session_owner(p_user_id text) TO anon;
GRANT ALL ON FUNCTION public.is_session_owner(p_user_id text) TO authenticated;
GRANT ALL ON FUNCTION public.is_session_owner(p_user_id text) TO service_role;


--
-- Name: FUNCTION is_tenant_member(p_tenant text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant text) TO anon;
GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant text) TO authenticated;
GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant text) TO service_role;


--
-- Name: TABLE consult_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consult_requests TO anon;
GRANT ALL ON TABLE public.consult_requests TO authenticated;
GRANT ALL ON TABLE public.consult_requests TO service_role;


--
-- Name: FUNCTION lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text) TO anon;
GRANT ALL ON FUNCTION public.lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text) TO authenticated;
GRANT ALL ON FUNCTION public.lawyer_can_see_contact(cr public.consult_requests, p_lawyer_id text) TO service_role;


--
-- Name: FUNCTION lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) TO anon;
GRANT ALL ON FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) TO authenticated;
GRANT ALL ON FUNCTION public.lawyer_can_view_request(cr public.consult_requests, p_lawyer_id text) TO service_role;


--
-- Name: FUNCTION lawyer_create_consult_request(p_row jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lawyer_create_consult_request(p_row jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lawyer_create_consult_request(p_row jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.lawyer_create_consult_request(p_row jsonb) TO service_role;


--
-- Name: FUNCTION lawyer_patch_consult_request(p_id text, p_patch jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.lawyer_patch_consult_request(p_id text, p_patch jsonb) TO service_role;


--
-- Name: FUNCTION lawyer_write_is_system(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lawyer_write_is_system() TO anon;
GRANT ALL ON FUNCTION public.lawyer_write_is_system() TO authenticated;
GRANT ALL ON FUNCTION public.lawyer_write_is_system() TO service_role;


--
-- Name: FUNCTION open_doc_share(p_token text, p_phone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_doc_share(p_token text, p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_doc_share(p_token text, p_phone text) TO anon;
GRANT ALL ON FUNCTION public.open_doc_share(p_token text, p_phone text) TO authenticated;
GRANT ALL ON FUNCTION public.open_doc_share(p_token text, p_phone text) TO service_role;


--
-- Name: FUNCTION open_shared_report(p_id text, p_pin text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_shared_report(p_id text, p_pin text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_shared_report(p_id text, p_pin text) TO anon;
GRANT ALL ON FUNCTION public.open_shared_report(p_id text, p_pin text) TO authenticated;
GRANT ALL ON FUNCTION public.open_shared_report(p_id text, p_pin text) TO service_role;


--
-- Name: FUNCTION peek_doc_share(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.peek_doc_share(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.peek_doc_share(p_token text) TO anon;
GRANT ALL ON FUNCTION public.peek_doc_share(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.peek_doc_share(p_token text) TO service_role;


--
-- Name: FUNCTION peek_invite_token(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.peek_invite_token(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.peek_invite_token(p_token text) TO anon;
GRANT ALL ON FUNCTION public.peek_invite_token(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.peek_invite_token(p_token text) TO service_role;


--
-- Name: FUNCTION register_lawyer_account(p_lawyer_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_lawyer_account(p_lawyer_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_lawyer_account(p_lawyer_id text) TO authenticated;
GRANT ALL ON FUNCTION public.register_lawyer_account(p_lawyer_id text) TO service_role;


--
-- Name: FUNCTION request_client_ip(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.request_client_ip() TO anon;
GRANT ALL ON FUNCTION public.request_client_ip() TO authenticated;
GRANT ALL ON FUNCTION public.request_client_ip() TO service_role;


--
-- Name: FUNCTION strip_lawyer_secrets(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.strip_lawyer_secrets() TO anon;
GRANT ALL ON FUNCTION public.strip_lawyer_secrets() TO authenticated;
GRANT ALL ON FUNCTION public.strip_lawyer_secrets() TO service_role;


--
-- Name: FUNCTION sync_lawyer_profile_approval(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_lawyer_profile_approval() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_lawyer_profile_approval() TO service_role;


--
-- Name: FUNCTION task_tickets_guard_approval(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.task_tickets_guard_approval() TO anon;
GRANT ALL ON FUNCTION public.task_tickets_guard_approval() TO authenticated;
GRANT ALL ON FUNCTION public.task_tickets_guard_approval() TO service_role;


--
-- Name: FUNCTION tenant_role(p_tenant text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tenant_role(p_tenant text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tenant_role(p_tenant text) TO authenticated;
GRANT ALL ON FUNCTION public.tenant_role(p_tenant text) TO service_role;


--
-- Name: FUNCTION user_sessions_server_fields(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_sessions_server_fields() TO anon;
GRANT ALL ON FUNCTION public.user_sessions_server_fields() TO authenticated;
GRANT ALL ON FUNCTION public.user_sessions_server_fields() TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE ad_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ad_orders TO anon;
GRANT ALL ON TABLE public.ad_orders TO authenticated;
GRANT ALL ON TABLE public.ad_orders TO service_role;


--
-- Name: TABLE alimtok_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alimtok_logs TO anon;
GRANT ALL ON TABLE public.alimtok_logs TO authenticated;
GRANT ALL ON TABLE public.alimtok_logs TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO service_role;


--
-- Name: TABLE calendar_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calendar_events TO anon;
GRANT ALL ON TABLE public.calendar_events TO authenticated;
GRANT ALL ON TABLE public.calendar_events TO service_role;


--
-- Name: TABLE cases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cases TO anon;
GRANT ALL ON TABLE public.cases TO authenticated;
GRANT ALL ON TABLE public.cases TO service_role;


--
-- Name: TABLE client_aliases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_aliases TO anon;
GRANT ALL ON TABLE public.client_aliases TO authenticated;
GRANT ALL ON TABLE public.client_aliases TO service_role;


--
-- Name: TABLE client_inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_inquiries TO anon;
GRANT ALL ON TABLE public.client_inquiries TO authenticated;
GRANT ALL ON TABLE public.client_inquiries TO service_role;


--
-- Name: TABLE client_memos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_memos TO anon;
GRANT ALL ON TABLE public.client_memos TO authenticated;
GRANT ALL ON TABLE public.client_memos TO service_role;


--
-- Name: TABLE client_qas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_qas TO anon;
GRANT ALL ON TABLE public.client_qas TO authenticated;
GRANT ALL ON TABLE public.client_qas TO service_role;


--
-- Name: TABLE consult_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consult_messages TO anon;
GRANT ALL ON TABLE public.consult_messages TO authenticated;
GRANT ALL ON TABLE public.consult_messages TO service_role;


--
-- Name: TABLE consult_requests_for_lawyers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consult_requests_for_lawyers TO authenticated;
GRANT ALL ON TABLE public.consult_requests_for_lawyers TO service_role;


--
-- Name: TABLE copilot_cases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.copilot_cases TO anon;
GRANT ALL ON TABLE public.copilot_cases TO authenticated;
GRANT ALL ON TABLE public.copilot_cases TO service_role;


--
-- Name: TABLE copilot_rulesets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.copilot_rulesets TO anon;
GRANT ALL ON TABLE public.copilot_rulesets TO authenticated;
GRANT ALL ON TABLE public.copilot_rulesets TO service_role;


--
-- Name: TABLE crm_clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_clients TO anon;
GRANT ALL ON TABLE public.crm_clients TO authenticated;
GRANT ALL ON TABLE public.crm_clients TO service_role;


--
-- Name: TABLE custom_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_roles TO anon;
GRANT ALL ON TABLE public.custom_roles TO authenticated;
GRANT ALL ON TABLE public.custom_roles TO service_role;


--
-- Name: TABLE diagnosis_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.diagnosis_config TO anon;
GRANT ALL ON TABLE public.diagnosis_config TO authenticated;
GRANT ALL ON TABLE public.diagnosis_config TO service_role;


--
-- Name: SEQUENCE diagnosis_config_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.diagnosis_config_id_seq TO anon;
GRANT ALL ON SEQUENCE public.diagnosis_config_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.diagnosis_config_id_seq TO service_role;


--
-- Name: SEQUENCE diagnosis_config_version_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.diagnosis_config_version_seq TO anon;
GRANT ALL ON SEQUENCE public.diagnosis_config_version_seq TO authenticated;
GRANT ALL ON SEQUENCE public.diagnosis_config_version_seq TO service_role;


--
-- Name: TABLE diagnosis_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.diagnosis_results TO anon;
GRANT ALL ON TABLE public.diagnosis_results TO authenticated;
GRANT ALL ON TABLE public.diagnosis_results TO service_role;


--
-- Name: SEQUENCE diagnosis_results_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.diagnosis_results_id_seq TO anon;
GRANT ALL ON SEQUENCE public.diagnosis_results_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.diagnosis_results_id_seq TO service_role;


--
-- Name: TABLE diagnosis_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.diagnosis_stats TO anon;
GRANT ALL ON TABLE public.diagnosis_stats TO authenticated;
GRANT ALL ON TABLE public.diagnosis_stats TO service_role;


--
-- Name: SEQUENCE diagnosis_stats_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.diagnosis_stats_id_seq TO anon;
GRANT ALL ON SEQUENCE public.diagnosis_stats_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.diagnosis_stats_id_seq TO service_role;


--
-- Name: TABLE doc_share_packages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.doc_share_packages TO anon;
GRANT ALL ON TABLE public.doc_share_packages TO authenticated;
GRANT ALL ON TABLE public.doc_share_packages TO service_role;


--
-- Name: TABLE electronic_contracts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.electronic_contracts TO anon;
GRANT ALL ON TABLE public.electronic_contracts TO authenticated;
GRANT ALL ON TABLE public.electronic_contracts TO service_role;


--
-- Name: TABLE fee_notification_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fee_notification_settings TO anon;
GRANT ALL ON TABLE public.fee_notification_settings TO authenticated;
GRANT ALL ON TABLE public.fee_notification_settings TO service_role;


--
-- Name: TABLE in_app_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.in_app_notifications TO anon;
GRANT ALL ON TABLE public.in_app_notifications TO authenticated;
GRANT ALL ON TABLE public.in_app_notifications TO service_role;


--
-- Name: TABLE internal_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.internal_messages TO anon;
GRANT ALL ON TABLE public.internal_messages TO authenticated;
GRANT ALL ON TABLE public.internal_messages TO service_role;


--
-- Name: TABLE invite_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invite_tokens TO anon;
GRANT ALL ON TABLE public.invite_tokens TO authenticated;
GRANT ALL ON TABLE public.invite_tokens TO service_role;


--
-- Name: SEQUENCE invite_tokens_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.invite_tokens_id_seq TO anon;
GRANT ALL ON SEQUENCE public.invite_tokens_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.invite_tokens_id_seq TO service_role;


--
-- Name: TABLE lawyer_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lawyer_accounts TO anon;
GRANT ALL ON TABLE public.lawyer_accounts TO authenticated;
GRANT ALL ON TABLE public.lawyer_accounts TO service_role;


--
-- Name: TABLE lawyer_inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lawyer_inquiries TO anon;
GRANT ALL ON TABLE public.lawyer_inquiries TO authenticated;
GRANT ALL ON TABLE public.lawyer_inquiries TO service_role;


--
-- Name: TABLE lawyer_private_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lawyer_private_profiles TO authenticated;
GRANT ALL ON TABLE public.lawyer_private_profiles TO service_role;


--
-- Name: TABLE lawyer_profile_tombstones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lawyer_profile_tombstones TO service_role;
GRANT SELECT ON TABLE public.lawyer_profile_tombstones TO anon;
GRANT SELECT,DELETE ON TABLE public.lawyer_profile_tombstones TO authenticated;


--
-- Name: TABLE lawyers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lawyers TO anon;
GRANT ALL ON TABLE public.lawyers TO authenticated;
GRANT ALL ON TABLE public.lawyers TO service_role;


--
-- Name: TABLE main_banners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.main_banners TO anon;
GRANT ALL ON TABLE public.main_banners TO authenticated;
GRANT ALL ON TABLE public.main_banners TO service_role;


--
-- Name: TABLE marketing_channel_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.marketing_channel_posts TO authenticated;
GRANT ALL ON TABLE public.marketing_channel_posts TO service_role;


--
-- Name: TABLE marketing_daily_campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.marketing_daily_campaigns TO authenticated;
GRANT ALL ON TABLE public.marketing_daily_campaigns TO service_role;


--
-- Name: TABLE matching_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matching_config TO anon;
GRANT ALL ON TABLE public.matching_config TO authenticated;
GRANT ALL ON TABLE public.matching_config TO service_role;


--
-- Name: TABLE members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.members TO anon;
GRANT ALL ON TABLE public.members TO authenticated;
GRANT ALL ON TABLE public.members TO service_role;


--
-- Name: TABLE news_articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.news_articles TO anon;
GRANT ALL ON TABLE public.news_articles TO authenticated;
GRANT ALL ON TABLE public.news_articles TO service_role;


--
-- Name: TABLE notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notices TO anon;
GRANT ALL ON TABLE public.notices TO authenticated;
GRANT ALL ON TABLE public.notices TO service_role;


--
-- Name: TABLE notification_channel_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_channel_settings TO anon;
GRANT ALL ON TABLE public.notification_channel_settings TO authenticated;
GRANT ALL ON TABLE public.notification_channel_settings TO service_role;


--
-- Name: TABLE platform_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_config TO anon;
GRANT ALL ON TABLE public.platform_config TO authenticated;
GRANT ALL ON TABLE public.platform_config TO service_role;


--
-- Name: TABLE popup_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.popup_config TO anon;
GRANT ALL ON TABLE public.popup_config TO authenticated;
GRANT ALL ON TABLE public.popup_config TO service_role;


--
-- Name: TABLE rehab_policy_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rehab_policy_settings TO anon;
GRANT ALL ON TABLE public.rehab_policy_settings TO authenticated;
GRANT ALL ON TABLE public.rehab_policy_settings TO service_role;


--
-- Name: TABLE shared_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shared_reports TO anon;
GRANT ALL ON TABLE public.shared_reports TO authenticated;
GRANT ALL ON TABLE public.shared_reports TO service_role;


--
-- Name: TABLE staff_activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_activities TO anon;
GRANT ALL ON TABLE public.staff_activities TO authenticated;
GRANT ALL ON TABLE public.staff_activities TO service_role;


--
-- Name: TABLE staff_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_members TO anon;
GRANT ALL ON TABLE public.staff_members TO authenticated;
GRANT ALL ON TABLE public.staff_members TO service_role;


--
-- Name: TABLE success_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.success_reviews TO anon;
GRANT ALL ON TABLE public.success_reviews TO authenticated;
GRANT ALL ON TABLE public.success_reviews TO service_role;


--
-- Name: TABLE task_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_tickets TO anon;
GRANT ALL ON TABLE public.task_tickets TO authenticated;
GRANT ALL ON TABLE public.task_tickets TO service_role;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_sessions TO anon;
GRANT ALL ON TABLE public.user_sessions TO authenticated;
GRANT ALL ON TABLE public.user_sessions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

-- 덤프 머리의 세션 설정(search_path 비우기 등)이 다음 마이그레이션에 남지 않게 되돌린다.
RESET ALL;
