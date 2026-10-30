-- ============================================================
-- DP-0 이어서: 사건 서류 휴지통·되돌리기·30일 뒤 파기
-- 문제: 잘못 올린 서류를 지울 방법이 없었다. 보유 기간이 지난 파일 본문을 지우는 작업도 없었다.
-- 바꾼 것:
--  * case_files.deleted_by·delete_reason·purged_at·purge_request_id 칸
--  * 휴지통으로 옮길 때 지운 사람을 서버가 기록, 파기된 파일은 되돌릴 수 없음, purged_at은 서버 작업만 바꿈
--  * 의뢰인은 휴지통 파일을 볼 수 없음 (표·저장소 모두)
--  * purge_case_files(): 휴지통 30일 지난 파일 본문을 Storage API로 삭제 요청 (SQL로는 저장소 객체를 못 지움)
--    service role 키는 vault 비밀값 'mykim_service_role_key', 주소는 'mykim_supabase_url'. 없으면 아무것도 안 함
--  * verify_case_file_purge(): 삭제 요청 응답이 실패면 다시 시도하도록 되돌림 (pg_net 응답은 6시간만 남음 → 같은 날 확인)
--  * pg_cron 03:20 / 03:50 KST
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.case_files
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text CHECK (delete_reason IS NULL OR char_length(delete_reason) <= 200),
  ADD COLUMN IF NOT EXISTS purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_request_id bigint;

CREATE INDEX IF NOT EXISTS case_files_trash_idx ON public.case_files (deleted_at) WHERE deleted_at IS NOT NULL AND purged_at IS NULL;

CREATE OR REPLACE FUNCTION public.case_files_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_server boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.office_id IS DISTINCT FROM OLD.office_id
     OR NEW.client_key IS DISTINCT FROM OLD.client_key OR NEW.upload_source IS DISTINCT FROM OLD.upload_source THEN
    RAISE EXCEPTION 'case file location cannot change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_server AND (NEW.purged_at IS DISTINCT FROM OLD.purged_at OR NEW.purge_request_id IS DISTINCT FROM OLD.purge_request_id) THEN
    RAISE EXCEPTION 'purge fields are server only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.purged_at IS NOT NULL AND NOT v_server THEN
    RAISE EXCEPTION 'purged case file cannot change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.deleted_at := now();          -- 휴지통 시각은 서버 시각 (30일 계산 기준)
    NEW.deleted_by := auth.uid();
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    NEW.deleted_by := NULL;           -- 되돌리기
    NEW.delete_reason := NULL;
  ELSIF NOT v_server THEN
    NEW.deleted_at := OLD.deleted_at; -- 휴지통 시각·지운 사람은 바꿀 수 없음
    NEW.deleted_by := OLD.deleted_by;
  END IF;
  RETURN NEW;
END;
$$;

-- 의뢰인: 휴지통 파일은 저장소에서도 못 읽게 (의뢰인 RLS로는 휴지통 행이 안 보이므로 판정 함수는 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.case_file_is_trashed(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.case_files WHERE storage_path = p_path AND deleted_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.case_file_is_trashed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_file_is_trashed(text) TO authenticated;

DROP POLICY IF EXISTS case_files_obj_client_read ON storage.objects;
CREATE POLICY case_files_obj_client_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[3] = 'client'
         AND EXISTS (SELECT 1 FROM public.consult_requests r WHERE r.id = (storage.foldername(name))[2] AND r.client_id = auth.uid()::text)
         AND NOT public.case_file_is_trashed(name));

-- 파기 요청 (휴지통 30일 지난 파일)
CREATE OR REPLACE FUNCTION public.purge_case_files(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_url text;
  v_row record;
  v_req bigint;
  v_n integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'mykim_supabase_url' LIMIT 1;
  IF v_key IS NULL OR v_url IS NULL THEN
    RAISE NOTICE 'purge_case_files: vault secrets missing, skipped';
    RETURN 0;
  END IF;
  FOR v_row IN
    SELECT id, storage_path FROM public.case_files
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days' AND purged_at IS NULL
    ORDER BY deleted_at LIMIT greatest(1, least(p_limit, 1000))
  LOOP
    SELECT net.http_delete(
      url := rtrim(v_url, '/') || '/storage/v1/object/case-files/' || v_row.storage_path,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key),
      timeout_milliseconds := 20000
    ) INTO v_req;
    UPDATE public.case_files SET purged_at = now(), purge_request_id = v_req WHERE id = v_row.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_case_files(integer) FROM PUBLIC, anon, authenticated;

-- 실패한 삭제 요청은 다음 날 다시 (200·404 = 지워짐/이미 없음)
CREATE OR REPLACE FUNCTION public.verify_case_file_purge()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.case_files f SET purged_at = NULL, purge_request_id = NULL
  FROM net._http_response r
  WHERE r.id = f.purge_request_id AND f.purged_at > now() - interval '1 day'
    AND (r.status_code IS NULL OR r.status_code NOT IN (200, 204, 404));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_case_file_purge() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('mykim_purge_case_files', 'mykim_verify_case_file_purge');
  PERFORM cron.schedule('mykim_purge_case_files', '20 18 * * *', 'SELECT public.purge_case_files(200)');
  PERFORM cron.schedule('mykim_verify_case_file_purge', '50 18 * * *', 'SELECT public.verify_case_file_purge()');
END;
$$;
