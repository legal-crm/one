-- ============================================================
-- CT-12 회사 정보 한 곳: platform_config id 'company_info'
--  * 누구나 읽기·관리자(2단계 인증)만 쓰기는 기존 platform_config 정책 그대로
--  * 저장 값 검사(필수 칸·사업자등록번호 형식·'주식회사'·'대표이사'·'my김변컴퍼니' 금지)
--  * 바뀌면 사이트 다시 빌드 요청(정적 페이지 푸터·회사 소개·JSON-LD·llms.txt) — 칼럼 자동 발행과 같은 대기열
--  * 변경 기록은 CT-16 트리거(admin_config_audit)가 남김
-- ============================================================

CREATE OR REPLACE FUNCTION public.company_info_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  k text;
  v text;
BEGIN
  IF NEW.id <> 'company_info' THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.data) <> 'object' THEN
    RAISE EXCEPTION 'company info must be an object' USING ERRCODE = 'check_violation';
  END IF;
  FOREACH k IN ARRAY ARRAY['legalName','businessType','ceo','businessNumber','mailOrderNumber','address','phone','email','privacyOfficer','hosting'] LOOP
    v := btrim(coalesce(NEW.data ->> k, ''));
    IF v = '' OR char_length(v) > 120 THEN
      RAISE EXCEPTION 'company info field invalid: %', k USING ERRCODE = 'check_violation';
    END IF;
    IF v ~ '(주식회사|\(주\)|대표이사|my김변컴퍼니)' THEN
      RAISE EXCEPTION 'company info banned wording: %', k USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  IF (NEW.data ->> 'businessNumber') !~ '^\d{3}-\d{2}-\d{5}$' THEN
    RAISE EXCEPTION 'company info business number format' USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.data ->> 'email') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'company info email format' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS company_info_guard ON public.platform_config;
CREATE TRIGGER company_info_guard BEFORE INSERT OR UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.company_info_guard();

CREATE OR REPLACE FUNCTION public.company_info_rebuild()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = 'company_info' AND (TG_OP = 'INSERT' OR NEW.data IS DISTINCT FROM OLD.data) THEN
    IF NOT EXISTS (SELECT 1 FROM public.site_rebuild_requests WHERE sent_at IS NULL) THEN
      INSERT INTO public.site_rebuild_requests (reason) VALUES ('company_info');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.company_info_rebuild() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS company_info_rebuild ON public.platform_config;
CREATE TRIGGER company_info_rebuild AFTER INSERT OR UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.company_info_rebuild();
