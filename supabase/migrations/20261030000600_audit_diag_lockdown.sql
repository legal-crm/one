-- ============================================================
-- OP-1 일부: 감사 기록 익명 쓰기 제한 · 진단 결과 열린 쓰기 닫기
--  * audit_logs: 익명은 정해진 행동(로그인 실패·허니팟·접근 거부·체크 완료)만,
--    로그인 사용자는 앱이 쓰는 행동 목록만 (관리자 전용 행동은 관리자만)
--  * 1분에 30건 넘는 기록(같은 계정, 또는 비로그인이면 같은 IP)은 조용히 버린다 (폭주 방지)
--  * diagnosis_results: 앱에서 쓰지 않는 익명 INSERT·로그인 UPDATE(USING true) 정책 삭제
-- ============================================================

DROP POLICY IF EXISTS anyone_insert_audit ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_anon_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_user_insert ON public.audit_logs;

CREATE POLICY audit_logs_anon_insert ON public.audit_logs
  FOR INSERT TO anon
  WITH CHECK (action IN ('login_failed', 'honeypot_attempt', 'access_denied', 'diagnosis_submit'));

CREATE POLICY audit_logs_user_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR action IN (
      'login', 'logout', 'login_failed', 'login_locked', 'view_client_detail', 'view_financial_profile',
      'decrypt_phone', 'download_report', 'download_pdf', 'export_excel', 'update_case', 'update_profile',
      'delete_data', 'send_notification', 'chat_room_open', 'diagnosis_submit', 'diagnosis_view',
      'access_denied', 'mfa_enrolled', 'honeypot_attempt', 'member_activity'
    )
  );

-- 최근 1분 기록 수: 호출한 사람 자신(로그인 계정, 비로그인은 요청 IP) 기준만 센다 (다른 사람 조회 불가)
CREATE OR REPLACE FUNCTION public.audit_recent_count_self()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ip text;
BEGIN
  IF v_uid IS NOT NULL THEN
    RETURN (SELECT count(*)::integer FROM public.audit_logs
            WHERE auth_uid = v_uid AND created_at > now() - interval '1 minute');
  END IF;
  v_ip := public.request_client_ip();
  IF v_ip IS NULL THEN
    RETURN 0;
  END IF;
  RETURN (SELECT count(*)::integer FROM public.audit_logs
          WHERE auth_uid IS NULL AND ip_address = v_ip AND created_at > now() - interval '1 minute');
END;
$$;
REVOKE ALL ON FUNCTION public.audit_recent_count_self() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_recent_count_self() TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_audit_logs_anon_ip
  ON public.audit_logs (ip_address, created_at DESC)
  WHERE auth_uid IS NULL;

-- normalize(이름순으로 먼저 실행) 뒤에 도는 폭주 방지
CREATE OR REPLACE FUNCTION public.audit_logs_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF public.audit_recent_count_self() >= 30 THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_rate_limit ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_rate_limit BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_rate_limit();

-- 진단 결과: 쓰는 곳 없음 → 열린 쓰기 정책 삭제 (관리자 조회만 남김)
DROP POLICY IF EXISTS anon_insert_diagnosis ON public.diagnosis_results;
DROP POLICY IF EXISTS anon_select_own_diagnosis ON public.diagnosis_results;
DROP POLICY IF EXISTS anon_update_own_diagnosis ON public.diagnosis_results;
DROP POLICY IF EXISTS authenticated_update_diagnosis ON public.diagnosis_results;
