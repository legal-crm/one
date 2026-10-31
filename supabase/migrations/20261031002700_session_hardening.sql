-- ============================================================
-- OP-12·OP-13 세션 기록 위조 방지·이상 징후 표시
-- 문제: user_sessions UPDATE 정책이 칸을 제한하지 않아 본인이 끊긴 세션을 되살리거나 역할·IP를 바꿀 수 있었고,
--       직원도 'LAWYER'로 등록됐으며, is_suspicious를 채우는 곳이 없었다(관리자 화면은 '정상 운영' 고정).
-- 바꾼 것:
--  * 로그인 사용자의 UPDATE는 '종료(active → revoked/expired)'와 '마지막 활동 시각'만. 끊긴 세션은 되살릴 수 없음
--  * INSERT 때 역할은 서버가 정함 (승인 변호사 LAWYER / 사무소 구성원 STAFF / 그 밖 CLIENT, ADMIN은 관리자만)
--  * 이상 징후(경고 위주): 해외 접속(요청 헤더 국가가 KR이 아님), 1시간 안 서로 다른 IP 3개 이상
--  * 관리자 계정의 해외 접속은 세션을 바로 종료 상태로 기록 (OP-Q3: 자동 차단은 관리자 해외 접속만)
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_country() RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE h json; c text;
BEGIN
  BEGIN h := current_setting('request.headers', true)::json; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  IF h IS NULL THEN RETURN NULL; END IF;
  c := upper(coalesce(h ->> 'cf-ipcountry', h ->> 'x-vercel-ip-country', h ->> 'x-country-code', ''));
  RETURN CASE WHEN c ~ '^[A-Z]{2}$' AND c <> 'XX' THEN c ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_sessions_server_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_ip text;
  v_country text;
  v_ips integer;
  v_reasons text[] := '{}';
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_role = 'ADMIN' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'ADMIN session requires platform admin' USING ERRCODE = '42501';
  END IF;
  -- 역할은 서버가 정한다 (관리자는 화면 값 유지)
  IF NOT public.is_platform_admin() THEN
    NEW.user_role := CASE
      WHEN EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = auth.uid() AND la.approved) THEN 'LAWYER'
      WHEN EXISTS (SELECT 1 FROM office_members m WHERE m.user_id = auth.uid() AND m.status = 'active') THEN 'STAFF'
      ELSE 'CLIENT' END;
  END IF;
  v_ip := public.request_client_ip();
  IF v_ip IS NOT NULL THEN NEW.ip_address := v_ip; END IF;
  NEW.status := 'active';
  NEW.revoked_at := NULL; NEW.revoked_by := NULL; NEW.revoke_reason := NULL;
  NEW.created_at := now();
  NEW.last_active_at := now();

  v_country := public.request_country();
  IF v_country IS NOT NULL THEN NEW.location := v_country; END IF;
  IF v_country IS NOT NULL AND v_country <> 'KR' THEN
    v_reasons := array_append(v_reasons, '해외 접속(' || v_country || ')');
  END IF;
  SELECT count(DISTINCT s.ip_address) INTO v_ips FROM user_sessions s
   WHERE s.user_id = NEW.user_id AND s.created_at > now() - interval '1 hour' AND s.ip_address IS DISTINCT FROM NEW.ip_address;
  IF v_ips >= 2 THEN
    v_reasons := array_append(v_reasons, '1시간 안 서로 다른 IP ' || (v_ips + 1) || '곳');
  END IF;
  IF cardinality(v_reasons) > 0 THEN
    NEW.is_suspicious := true;
    NEW.suspicious_reason := left(array_to_string(v_reasons, ' · '), 200);
    IF NEW.user_role = 'ADMIN' AND v_country IS NOT NULL AND v_country <> 'KR' THEN
      NEW.status := 'revoked';
      NEW.revoked_at := now();
      NEW.revoked_by := 'system';
      NEW.revoke_reason := '관리자 해외 접속 자동 차단';
    END IF;
  ELSE
    NEW.is_suspicious := false;
    NEW.suspicious_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_sessions_update_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- 기록 칸은 바꿀 수 없음
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.user_name IS DISTINCT FROM OLD.user_name
     OR NEW.user_email IS DISTINCT FROM OLD.user_email OR NEW.user_role IS DISTINCT FROM OLD.user_role OR NEW.firm_name IS DISTINCT FROM OLD.firm_name
     OR NEW.device_type IS DISTINCT FROM OLD.device_type OR NEW.os IS DISTINCT FROM OLD.os OR NEW.browser IS DISTINCT FROM OLD.browser
     OR NEW.user_agent IS DISTINCT FROM OLD.user_agent OR NEW.ip_address IS DISTINCT FROM OLD.ip_address OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.is_suspicious IS DISTINCT FROM OLD.is_suspicious OR NEW.suspicious_reason IS DISTINCT FROM OLD.suspicious_reason THEN
    RAISE EXCEPTION 'session record fields cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'active' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.last_active_at IS DISTINCT FROM OLD.last_active_at
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by OR NEW.revoke_reason IS DISTINCT FROM OLD.revoke_reason THEN
      RAISE EXCEPTION 'ended sessions cannot be changed' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('active', 'revoked', 'expired') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023'; END IF;
  IF NEW.status <> 'active' THEN
    NEW.revoked_at := now();
    NEW.revoked_by := CASE WHEN public.is_platform_admin() THEN 'admin' WHEN NEW.revoked_by IN ('user', 'system') THEN NEW.revoked_by ELSE 'user' END;
    NEW.revoke_reason := left(coalesce(NEW.revoke_reason, ''), 200);
  ELSE
    IF NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL THEN RAISE EXCEPTION 'invalid revoke fields' USING ERRCODE = '22023'; END IF;
  END IF;
  -- 마지막 활동 시각은 앞으로만, 지금보다 미래로는 못 감
  IF NEW.last_active_at < OLD.last_active_at THEN NEW.last_active_at := OLD.last_active_at; END IF;
  IF NEW.last_active_at > now() + interval '1 minute' THEN NEW.last_active_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_sessions_update_guard ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_update_guard BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.user_sessions_update_guard();

-- 사람이 지우는 것도 막는다 (관리자 정리는 서버 작업으로)
DROP POLICY IF EXISTS user_sessions_owner_delete ON public.user_sessions;
REVOKE DELETE ON public.user_sessions FROM anon, authenticated;
