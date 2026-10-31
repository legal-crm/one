-- ============================================================
-- CT-16 설정·콘텐츠 변경 기록 (admin_actions, 이전/이후 값)
--  * 플랫폼 설정·팝업·상담 요청 정책 표: 바뀐 행의 이전·이후 data 전체
--  * 공개 콘텐츠 표(칼럼·Q&A·후기·배너·공지): 등록·수정·상태 변경은 제목·상태·버전,
--    삭제는 지운 글 전체(되살릴 수 있게, 200KB 넘으면 요약만)
--  * 로그인한 사람이 바꾼 경우만 (마이그레이션·서버 정기 작업 제외)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_config_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.data IS NOT DISTINCT FROM OLD.data THEN
    RETURN NULL;
  END IF;
  v_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.data END;
  v_after := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.data END;
  INSERT INTO public.admin_actions (actor_user_id, actor_email, action, target_type, target_id, before_value, after_value)
  VALUES (auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
    'settings.' || lower(TG_OP), TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_before, v_after);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_config_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['platform_config', 'popup_config', 'matching_config'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_admin_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.admin_config_audit()', t || '_admin_audit', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_content_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_action := 'content.create';
    v_title := coalesce(NEW.data ->> 'title', NEW.data ->> 'question');
    v_after := jsonb_build_object('title', left(v_title, 200), 'status', NEW.status, 'is_example', NEW.is_example, 'version', NEW.version);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.data IS NOT DISTINCT FROM OLD.data AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.is_example IS NOT DISTINCT FROM OLD.is_example AND NEW.sort_order IS NOT DISTINCT FROM OLD.sort_order THEN
      RETURN NULL;
    END IF;
    v_action := CASE WHEN NEW.data IS NOT DISTINCT FROM OLD.data AND NEW.status IS DISTINCT FROM OLD.status THEN 'content.status' ELSE 'content.update' END;
    v_title := coalesce(NEW.data ->> 'title', NEW.data ->> 'question');
    v_before := jsonb_build_object('title', left(coalesce(OLD.data ->> 'title', OLD.data ->> 'question'), 200), 'status', OLD.status, 'is_example', OLD.is_example, 'version', OLD.version);
    v_after := jsonb_build_object('title', left(v_title, 200), 'status', NEW.status, 'is_example', NEW.is_example, 'version', NEW.version,
      'changed_keys', (SELECT coalesce(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM (
        SELECT k FROM jsonb_object_keys(coalesce(NEW.data, '{}'::jsonb) || coalesce(OLD.data, '{}'::jsonb)) AS k
        WHERE (NEW.data -> k) IS DISTINCT FROM (OLD.data -> k)) x));
  ELSE
    v_action := 'content.delete';
    v_before := CASE WHEN pg_column_size(OLD.data) <= 200000
      THEN jsonb_build_object('data', OLD.data, 'status', OLD.status, 'is_example', OLD.is_example, 'version', OLD.version)
      ELSE jsonb_build_object('title', left(coalesce(OLD.data ->> 'title', OLD.data ->> 'question'), 200), 'status', OLD.status, 'too_large', true) END;
  END IF;
  INSERT INTO public.admin_actions (actor_user_id, actor_email, action, target_type, target_id, before_value, after_value)
  VALUES (auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
    v_action, TG_TABLE_NAME, CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, v_before, v_after);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_content_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['news_articles', 'client_qas', 'success_reviews', 'main_banners', 'notices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_admin_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.admin_content_audit()', t || '_admin_audit', t);
  END LOOP;
END $$;
