-- ============================================================
-- CT-8 문의함 통합 (CT-Q4)
--  * 상태 4개: 접수(pending)·확인 중(in_progress)·답변 완료(replied)·종결(closed), 담당자, 처리 기한(접수 + 2영업일)
--    — 의뢰인 문의는 /api/inquiry(서비스 키)가 칸을 관리, 변호사 문의는 관리자가 표에 직접 씀
--  * 의뢰인 문의 첨부 → 비공개 저장소 inquiry-files (서버만 올리고, 관리자에게 5분 주소)
--  * 답변 문구함 admin_reply_templates (관리자만)
--  * 변호사 문의에 답변이 달리면 그 변호사에게 알림
--  * '오늘 처리할 일'의 미답변 = 접수·확인 중 (종결 제외)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inquiry-files', 'inquiry-files', false, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
-- 정책 없음: 서비스 키(서버 함수)만 읽고 쓴다

CREATE TABLE IF NOT EXISTS public.admin_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'client', 'lawyer')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
ALTER TABLE public.admin_reply_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_reply_templates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_reply_templates TO authenticated;
DROP POLICY IF EXISTS admin_reply_templates_admin ON public.admin_reply_templates;
CREATE POLICY admin_reply_templates_admin ON public.admin_reply_templates FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.admin_reply_templates_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_reply_templates_touch ON public.admin_reply_templates;
CREATE TRIGGER admin_reply_templates_touch BEFORE INSERT OR UPDATE ON public.admin_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.admin_reply_templates_touch();

-- 변호사 문의 답변 알림 (답변이 처음 달리거나 바뀔 때, 같은 문의는 안 읽은 알림 하나로)
CREATE OR REPLACE FUNCTION public.lawyer_inquiry_reply_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reply text := nullif(btrim(coalesce(NEW.data ->> 'replyContent', '')), '');
  v_lawyer text := NEW.data ->> 'lawyerId';
  r record;
BEGIN
  IF v_reply IS NULL OR v_lawyer IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND v_reply IS NOT DISTINCT FROM nullif(btrim(coalesce(OLD.data ->> 'replyContent', '')), '') THEN RETURN NULL; END IF;
  BEGIN
    FOR r IN SELECT la.auth_user_id FROM public.lawyer_accounts la WHERE la.lawyer_id = v_lawyer AND la.auth_user_id IS NOT NULL LOOP
      PERFORM public.notify_user(r.auth_user_id, 'office', (SELECT o.id FROM public.offices o WHERE o.id = v_lawyer), 'inquiry_reply', '마이김변 문의에 답변이 왔어요',
        left(coalesce(NEW.data ->> 'title', '문의'), 120), 'lawyer_inquiry', NEW.id, 'lawyer_inquiry:' || NEW.id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'lawyer inquiry notify failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.lawyer_inquiry_reply_notify() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lawyer_inquiry_reply_notify ON public.lawyer_inquiries;
CREATE TRIGGER lawyer_inquiry_reply_notify AFTER INSERT OR UPDATE ON public.lawyer_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.lawyer_inquiry_reply_notify();

-- '오늘 처리할 일': 종결도 미답변에서 뺀다
DO $$
DECLARE
  d text := pg_get_functiondef('public.admin_todo_items()'::regprocedure);
  old_cond text := $c$coalesce(i.data ->> 'status', 'pending') <> 'replied'$c$;
  new_cond text := $c$coalesce(i.data ->> 'status', 'pending') NOT IN ('replied', 'closed')$c$;
BEGIN
  IF position(new_cond IN d) > 0 THEN RETURN; END IF;
  IF position(old_cond IN d) = 0 THEN RAISE EXCEPTION 'admin_todo_items: inquiry condition not found'; END IF;
  EXECUTE replace(d, old_cond, new_cond);
END;
$$;

-- 운영 지표의 '미답변 문의'도 같은 기준
DO $$
DECLARE
  d text := pg_get_functiondef('public.platform_metrics_core(timestamptz, timestamptz)'::regprocedure);
  old_cond text := $c$coalesce(i.data ->> 'status', 'pending') <> 'replied'$c$;
  new_cond text := $c$coalesce(i.data ->> 'status', 'pending') NOT IN ('replied', 'closed')$c$;
BEGIN
  IF position(new_cond IN d) > 0 THEN RETURN; END IF;
  IF position(old_cond IN d) = 0 THEN RAISE EXCEPTION 'platform_metrics_core: inquiry condition not found'; END IF;
  EXECUTE replace(d, old_cond, new_cond);
END;
$$;
