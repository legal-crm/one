-- ============================================================
-- CT-7 공개 사이트 이미지 저장소 (팝업·배너·칼럼 대표 이미지)
--  * 공개 버킷 site-media: 누구나 읽기, 올리기·지우기는 플랫폼 관리자(2단계 인증)만
--  * 팝업 설정에 base64 이미지를 새로 넣지 못하게 (방문자마다 큰 설정을 내려받아 트래픽이 늘던 문제)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.is_platform_admin()
    AND (storage.foldername(name))[1] IN ('popup', 'banner', 'news', 'notice'));
DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;
CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_platform_admin());
DROP POLICY IF EXISTS site_media_admin_delete ON storage.objects;
CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.popup_config_no_inline_images()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.data IS DISTINCT FROM OLD.data)
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.data -> 'items') = 'array' THEN NEW.data -> 'items' ELSE '[]'::jsonb END) it
       WHERE coalesce(it ->> 'imageUrl', '') LIKE 'data:%'
     ) THEN
    RAISE EXCEPTION 'inline images not allowed: upload the image instead' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS popup_config_no_inline_images ON public.popup_config;
CREATE TRIGGER popup_config_no_inline_images BEFORE INSERT OR UPDATE ON public.popup_config
  FOR EACH ROW EXECUTE FUNCTION public.popup_config_no_inline_images();
