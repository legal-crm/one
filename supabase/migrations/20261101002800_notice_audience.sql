-- ============================================================
-- CT-6 공지 대상(모두/의뢰인/변호사): 의뢰인용 공지는 사무소 종 알림을 보내지 않는다
-- 화면: 의뢰인 사이트는 'lawyer' 공지를 숨기고, 홈에 중요 공지 한 줄. 변호사 화면은 'client' 공지를 숨김
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notice_office_bell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  IF NEW.status = 'published' AND coalesce((NEW.data ->> 'isImportant')::boolean, false)
     AND coalesce(NEW.data ->> 'audience', 'all') <> 'client'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published'
          OR coalesce((OLD.data ->> 'isImportant')::boolean, false) = false) THEN
    FOR m IN SELECT DISTINCT om.user_id, om.office_id FROM office_members om
              JOIN offices o ON o.id = om.office_id AND o.status = 'active'
             WHERE om.status = 'active' AND om.user_id IS NOT NULL LOOP
      BEGIN
        PERFORM public.notify_user(m.user_id, 'office', m.office_id, 'platform_notice',
          left('마이김변 공지: ' || coalesce(NEW.data ->> 'title', ''), 120), '중요 공지가 올라왔어요. 오늘의 업무에서 확인해 주세요.',
          'notice', NEW.id, 'notice:' || NEW.id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notice bell failed: %', SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
