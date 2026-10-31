-- ============================================================
-- CT-8 마무리: 변호사 '마이김변 문의' 첨부도 비공개 저장소(inquiry-files)로
--  * 경로 lawyer/{내 변호사 계정}/{문의 번호}/{파일}, 올리기·보기는 그 변호사, 보기는 관리자도
--  * 새 문의 행에는 base64 첨부를 넣지 못하게 (예전 행은 그대로 읽힘)
-- ============================================================

DROP POLICY IF EXISTS inquiry_files_lawyer_insert ON storage.objects;
CREATE POLICY inquiry_files_lawyer_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inquiry-files' AND (storage.foldername(name))[1] = 'lawyer'
    AND (storage.foldername(name))[2] = public.my_lawyer_account_id());
DROP POLICY IF EXISTS inquiry_files_lawyer_read ON storage.objects;
CREATE POLICY inquiry_files_lawyer_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inquiry-files' AND (storage.foldername(name))[1] = 'lawyer'
    AND ((storage.foldername(name))[2] = public.my_lawyer_account_id() OR public.is_platform_admin()));

CREATE OR REPLACE FUNCTION public.lawyer_inquiries_no_inline_files()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.data -> 'attachments') = 'array' THEN NEW.data -> 'attachments' ELSE '[]'::jsonb END) a
    WHERE coalesce(a ->> 'dataUrl', '') LIKE 'data:%'
  ) THEN
    RAISE EXCEPTION 'inline attachments not allowed: upload files first' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lawyer_inquiries_no_inline_files ON public.lawyer_inquiries;
CREATE TRIGGER lawyer_inquiries_no_inline_files BEFORE INSERT ON public.lawyer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.lawyer_inquiries_no_inline_files();
