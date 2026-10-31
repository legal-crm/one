-- ============================================================
-- OP-8 변호사 등록증: base64 글자 → 비공개 저장소, 등록번호 확인 30일 뒤 자동 삭제 (OP-Q4)
-- 문제: 등록증 사진을 base64 글자로 lawyer_private_profiles.data.licenseImageData 에 통째로 두었다.
--       확인이 끝나도 지우지 않았다.
-- 바꾼 것:
--  * 비공개 버킷 'lawyer-licenses'(5MB, JPG·PNG·WEBP·PDF) — 본인 변호사 계정 폴더에만 올리고, 본인·관리자만 읽기
--  * data.licenseImagePath 에 경로만 저장. 새 base64는 넣을 수 없게 지운다(예전 값은 화면 호환용으로 남김)
--  * 등록번호 확인(license_checked_at) 30일 뒤 매일 03:15 KST 저장소 파일 삭제 요청 + 경로·예전 base64 지움
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lawyer-licenses', 'lawyer-licenses', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS lawyer_licenses_insert ON storage.objects;
CREATE POLICY lawyer_licenses_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lawyer-licenses' AND (storage.foldername(name))[1] = public.my_lawyer_account_id());
DROP POLICY IF EXISTS lawyer_licenses_select ON storage.objects;
CREATE POLICY lawyer_licenses_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lawyer-licenses' AND ((storage.foldername(name))[1] = public.my_lawyer_account_id() OR public.is_platform_admin()));
DROP POLICY IF EXISTS lawyer_licenses_delete ON storage.objects;
CREATE POLICY lawyer_licenses_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lawyer-licenses' AND (storage.foldername(name))[1] = public.my_lawyer_account_id());

-- 새 base64 등록증은 받지 않는다. 경로는 내 폴더 것만
CREATE OR REPLACE FUNCTION public.lawyer_private_license_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  IF (NEW.data ->> 'licenseImageData') IS NOT NULL
     AND (TG_OP = 'INSERT' OR (NEW.data -> 'licenseImageData') IS DISTINCT FROM (OLD.data -> 'licenseImageData')) THEN
    NEW.data := NEW.data - 'licenseImageData';
  END IF;
  IF (NEW.data ->> 'licenseImagePath') IS NOT NULL
     AND (TG_OP = 'INSERT' OR (NEW.data -> 'licenseImagePath') IS DISTINCT FROM (OLD.data -> 'licenseImagePath'))
     AND split_part(NEW.data ->> 'licenseImagePath', '/', 1) IS DISTINCT FROM NEW.lawyer_id THEN
    RAISE EXCEPTION 'license path must be in own folder' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lawyer_private_license_guard ON public.lawyer_private_profiles;
CREATE TRIGGER lawyer_private_license_guard BEFORE INSERT OR UPDATE ON public.lawyer_private_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lawyer_private_license_guard();

-- 심사 목록 '등록증 있음'은 경로도 본다
DO $$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.admin_list_lawyer_applications(text)'::regprocedure);
  IF position($q$coalesce(pp.data ? 'licenseImageData', false)$q$ IN v) > 0 THEN
    EXECUTE replace(v, $q$coalesce(pp.data ? 'licenseImageData', false)$q$, $q$coalesce(pp.data ?| ARRAY['licenseImageData', 'licenseImagePath'], false)$q$);
  END IF;
END $$;

-- 확인 30일 뒤 삭제
CREATE OR REPLACE FUNCTION public.purge_lawyer_licenses(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_url text;
  r record;
  v_n integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'mykim_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'mykim_supabase_url' LIMIT 1;
  FOR r IN
    SELECT pp.lawyer_id, pp.data ->> 'licenseImagePath' AS path
    FROM public.lawyer_private_profiles pp
    JOIN public.lawyer_review_state rs ON rs.lawyer_id = pp.lawyer_id
    WHERE rs.license_checked_at IS NOT NULL AND rs.license_checked_at < now() - interval '30 days'
      AND pp.data ?| ARRAY['licenseImagePath', 'licenseImageData']
    LIMIT greatest(1, least(p_limit, 500))
  LOOP
    IF r.path IS NOT NULL THEN
      IF v_key IS NULL OR v_url IS NULL THEN
        RAISE NOTICE 'purge_lawyer_licenses: vault secrets missing, file kept';
        CONTINUE;
      END IF;
      PERFORM net.http_delete(
        url := rtrim(v_url, '/') || '/storage/v1/object/lawyer-licenses/' || r.path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key),
        timeout_milliseconds := 20000
      );
    END IF;
    UPDATE public.lawyer_private_profiles
       SET data = (data - 'licenseImagePath' - 'licenseImageData') || jsonb_build_object('licenseImagePurgedAt', now()),
           updated_at = now()
     WHERE lawyer_id = r.lawyer_id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_lawyer_licenses(integer) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('mykim_purge_lawyer_licenses');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('mykim_purge_lawyer_licenses', '15 18 * * *', $$SELECT public.purge_lawyer_licenses()$$);
