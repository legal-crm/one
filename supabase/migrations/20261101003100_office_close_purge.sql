-- ============================================================================
-- 사무소 탈퇴(이용계약 종료) → 30일 뒤 사무소 데이터 파기 (변호사회원 이용약관 제10조 제3항 7호, 제16조)
--  * admin_close_office: 대표의 탈퇴 요청(개인정보 요청·문의)을 관리자가 처리. 사무소 'closed' → 구성원 접근 즉시 막힘
--    (current_office_member 가 status='active' 사무소만 본다), 업무폰 해지, 로그인 세션 종료
--  * 30일 안에는 admin_reopen_office 로 되돌릴 수 있다 (탈퇴 철회)
--  * purge_closed_offices (pg_cron 매일 04:20 KST)
--    1단계(종료 30일 뒤): 사건마다 purge_one_case, 남은 사건 파일·통화 녹음 휴지통 → 기존 파일 파기 작업이 저장소에서 지움,
--                         사무소 폴더의 직인·광고 소재·카톡 백업 파일은 저장소 API로 삭제 요청
--    2단계(1단계 3일 뒤, 사건 파일이 모두 지워진 뒤): crm_clients·사무소 행 삭제(연결된 표 63개는 ON DELETE CASCADE)
--  * office_purge_log: 사무소 ID·종료일·파기일·지운 건수만 (개인정보 없음)
--  * 회사가 법령상 보관하는 광고 주문·세금계산서 발행 기록(ad_orders·ad_order_requests)은 사무소 FK가 없어 남는다
--    (광고 소재는 지워지고 주문의 creative_id 는 NULL 이 된다)
--  * 노출 중이거나 시작 예정인 광고가 있으면 종료하지 않는다 → 관리자가 먼저 취소·환불 처리. 입금 대기 주문은 자동 취소
--  * 종료된 사무소의 대표 변호사 프로필은 변호사 찾기에서 바로 빠진다 (lawyer_is_public)
--  * 실행 시각: pg_cron '20 19 * * *' (UTC) = 매일 04:20 KST
-- ============================================================================

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS close_reason text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS purge_started_at timestamptz;

ALTER TABLE public.case_purge_log DROP CONSTRAINT IF EXISTS case_purge_log_reason_check;
ALTER TABLE public.case_purge_log ADD CONSTRAINT case_purge_log_reason_check CHECK (reason IN ('retention_expired', 'trash_expired', 'office_closed'));

CREATE TABLE IF NOT EXISTS public.office_purge_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  office_id text NOT NULL,
  closed_at timestamptz,
  stage text NOT NULL CHECK (stage IN ('started', 'deleted')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_purge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_purge_log_admin ON public.office_purge_log;
CREATE POLICY office_purge_log_admin ON public.office_purge_log FOR SELECT TO authenticated USING (public.is_platform_admin());
REVOKE ALL ON public.office_purge_log FROM anon, authenticated;
GRANT SELECT ON public.office_purge_log TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_close_office(p_office_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o offices%ROWTYPE;
  m record;
  n int := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM offices WHERE id = p_office_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'office not found' USING ERRCODE = 'P0002'; END IF;
  IF o.status = 'closed' THEN RETURN jsonb_build_object('ok', true, 'already', true, 'purge_on', (o.closed_at + interval '30 days')::date); END IF;
  SELECT count(*) INTO n FROM ad_orders WHERE office_id = p_office_id AND status IN ('paid', 'active');
  IF n > 0 THEN RAISE EXCEPTION 'active ads: %', n USING ERRCODE = '22023', HINT = '노출 중·시작 예정 광고를 먼저 취소·환불하세요'; END IF;
  FOR m IN SELECT id FROM ad_orders WHERE office_id = p_office_id AND status = 'pending' LOOP
    PERFORM public.admin_cancel_ad_order(m.id, '사무소 탈퇴', 0);
  END LOOP;
  n := 0;
  UPDATE offices SET status = 'closed', closed_at = now(), close_reason = left(p_reason, 300), updated_at = now() WHERE id = p_office_id;
  UPDATE office_devices SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = '사무소 탈퇴'
    WHERE office_id = p_office_id AND status <> 'revoked';
  FOR m IN SELECT DISTINCT user_id FROM office_members WHERE office_id = p_office_id AND user_id IS NOT NULL LOOP
    PERFORM public.revoke_user_sessions_internal(m.user_id, '사무소 탈퇴');
    n := n + 1;
  END LOOP;
  PERFORM public.admin_record_action('office.close', 'office', p_office_id,
    jsonb_build_object('status', o.status), jsonb_build_object('status', 'closed'), p_reason);
  RETURN jsonb_build_object('ok', true, 'members', n, 'purge_on', (now() + interval '30 days')::date);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_close_office(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_office(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reopen_office(p_office_id text, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o offices%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM offices WHERE id = p_office_id FOR UPDATE;
  IF o.id IS NULL OR o.status <> 'closed' THEN RAISE EXCEPTION 'office not closed' USING ERRCODE = '22023'; END IF;
  IF o.purge_started_at IS NOT NULL THEN RAISE EXCEPTION 'purge already started' USING ERRCODE = '22023'; END IF;
  UPDATE offices SET status = 'active', closed_at = NULL, close_reason = NULL, updated_at = now() WHERE id = p_office_id;
  PERFORM public.admin_record_action('office.reopen', 'office', p_office_id,
    jsonb_build_object('status', 'closed'), jsonb_build_object('status', 'active'), p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reopen_office(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reopen_office(text, text) TO authenticated;

-- 관리자 화면: 종료된 사무소와 파기 예정일
CREATE OR REPLACE FUNCTION public.admin_closed_offices()
RETURNS TABLE (office_id text, office_name text, closed_at timestamptz, close_reason text, purge_on date, purge_started boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.name, o.closed_at, o.close_reason, (o.closed_at + interval '30 days')::date, o.purge_started_at IS NOT NULL
  FROM offices o WHERE o.status = 'closed' AND public.is_platform_admin()
  ORDER BY o.closed_at;
$$;
REVOKE ALL ON FUNCTION public.admin_closed_offices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_closed_offices() TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_closed_offices()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o record;
  c record;
  obj record;
  v_key text;
  v_url text;
  n_cases int; n_files int; n_recs int; n_objs int; n_crm int; n_contracts int;
  started int := 0; deleted int := 0;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'mykim_supabase_url' LIMIT 1;

  -- 1단계: 종료 30일 지난 사무소
  FOR o IN SELECT * FROM offices WHERE status = 'closed' AND closed_at < now() - interval '30 days' AND purge_started_at IS NULL LOOP
    n_cases := 0; n_files := 0; n_recs := 0; n_objs := 0;
    FOR c IN SELECT id FROM cases WHERE office_id = o.id AND purged_at IS NULL LOOP
      PERFORM public.purge_one_case(c.id, 'office_closed');
      n_cases := n_cases + 1;
    END LOOP;
    -- 사건에 묶이지 않은 파일도 휴지통으로 (31일 전으로 적어 다음 파일 파기 작업이 바로 지운다)
    UPDATE case_files SET deleted_at = now() - interval '31 days', delete_reason = '사무소 탈퇴로 파기'
      WHERE office_id = o.id AND deleted_at IS NULL;
    GET DIAGNOSTICS n_files = ROW_COUNT;
    PERFORM set_config('mykim.comm_purge', 'on', true);
    UPDATE call_recordings SET deleted_at = coalesce(deleted_at, now()) WHERE office_id = o.id AND deleted_at IS NULL;
    GET DIAGNOSTICS n_recs = ROW_COUNT;
    -- 사무소 폴더의 직인·광고 소재·카톡 백업 원본: 저장소 API로 삭제 요청 (지울 파일이 있는데 비밀값이 없으면 다음 날 다시)
    IF (v_key IS NOT NULL AND v_url IS NOT NULL)
       OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id IN ('office-assets', 'ad-media', 'comm-exports') AND name LIKE o.id || '/%') THEN
      FOR obj IN SELECT bucket_id, name FROM storage.objects
                 WHERE bucket_id IN ('office-assets', 'ad-media', 'comm-exports') AND name LIKE o.id || '/%' LOOP
        PERFORM net.http_delete(
          url := rtrim(v_url, '/') || '/storage/v1/object/' || obj.bucket_id || '/' || obj.name,
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key),
          timeout_milliseconds := 20000);
        n_objs := n_objs + 1;
      END LOOP;
      UPDATE offices SET purge_started_at = now() WHERE id = o.id;
      INSERT INTO office_purge_log (office_id, closed_at, stage, counts)
        VALUES (o.id, o.closed_at, 'started', jsonb_build_object('cases', n_cases, 'files', n_files, 'recordings', n_recs, 'storage_objects', n_objs));
      started := started + 1;
    END IF;
  END LOOP;

  -- 2단계: 1단계 3일 뒤, 사건 파일이 저장소에서 모두 지워졌으면 사무소 행 삭제
  FOR o IN SELECT * FROM offices WHERE status = 'closed' AND purge_started_at < now() - interval '3 days' LOOP
    IF EXISTS (SELECT 1 FROM case_files WHERE office_id = o.id AND purged_at IS NULL)
       OR EXISTS (SELECT 1 FROM call_recordings WHERE office_id = o.id AND purged_at IS NULL) THEN
      CONTINUE;
    END IF;
    -- 사무소가 맺은 수임 계약 (사건에 묶인 것 + 대표 변호사 이름으로 사건 없이 남은 것)
    DELETE FROM electronic_contracts
     WHERE case_id IN (SELECT id FROM cases WHERE office_id = o.id)
        OR (case_id IS NULL AND assigned_lawyer_id = o.id);
    GET DIAGNOSTICS n_contracts = ROW_COUNT;
    PERFORM set_config('mykim.comm_purge', 'on', true);
    DELETE FROM crm_clients WHERE office_id = o.id;
    GET DIAGNOSTICS n_crm = ROW_COUNT;
    -- 사무소 FK 없이 tenant_id 로만 묶인 옛 표
    DELETE FROM alimtok_logs WHERE tenant_id = o.id;
    DELETE FROM calendar_events WHERE tenant_id = o.id;
    DELETE FROM task_tickets WHERE tenant_id = o.id;
    DELETE FROM internal_messages WHERE tenant_id = o.id;
    DELETE FROM in_app_notifications WHERE tenant_id = o.id;
    DELETE FROM fee_notification_settings WHERE tenant_id = o.id;
    -- 사건을 먼저 지운다 (cases → office_clients 가 RESTRICT 라 사무소 행 연쇄 삭제 순서에 맡기지 않음)
    DELETE FROM cases WHERE office_id = o.id;
    GET DIAGNOSTICS n_cases = ROW_COUNT;
    DELETE FROM offices WHERE id = o.id;
    INSERT INTO office_purge_log (office_id, closed_at, stage, counts)
      VALUES (o.id, o.closed_at, 'deleted', jsonb_build_object('crm_clients', n_crm, 'contracts', n_contracts, 'cases', n_cases));
    deleted := deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('started', started, 'deleted', deleted);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_closed_offices() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_closed_offices';
    PERFORM cron.schedule('mykim_purge_closed_offices', '20 19 * * *', $c$SELECT public.purge_closed_offices()$c$);
  END IF;
END $$;

-- 종료된 사무소의 대표 변호사(사무소 ID = 대표 변호사 ID)는 변호사 찾기에 나오지 않는다
CREATE OR REPLACE FUNCTION public.lawyer_is_public(l lawyers)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id IS NOT NULL
     AND EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = l.id AND la.approved = true)
     AND NOT EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = l.id)
     AND NOT EXISTS (SELECT 1 FROM offices o WHERE o.id = l.id AND o.status = 'closed')
     AND cardinality(public.lawyer_profile_missing(l)) = 0;
$$;
