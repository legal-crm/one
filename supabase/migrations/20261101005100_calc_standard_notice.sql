-- ════════════════════════════════════════════════════════════════════════════
-- LS-12 계산 기준표 변경 알림: 통합어드민이 새 버전을 게시하면 진행 중 사건이 있는 사무소에 알린다
--  * 받는 사람: 사무소 case.view '전체' 범위 구성원 (담당 범위만 가진 사람은 사건 단위 알림이 아니라 빠짐)
--  * 글: 버전·진행 중 사건 수·사무소가 바꾼 법원 실무 칸 수만 (의뢰인 정보 없음)
--  * 알림이 실패해도 게시는 그대로 진행 (WARNING)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_calc_standard_published_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_overrides int;
BEGIN
  IF NEW.status <> 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN RETURN NULL; END IF;
  BEGIN
    FOR r IN
      SELECT c.office_id, count(*) AS active_cases
      FROM public.cases c JOIN public.offices o ON o.id = c.office_id AND o.status = 'active'
      WHERE c.stage <> 'closed' AND c.purged_at IS NULL
      GROUP BY c.office_id
    LOOP
      SELECT count(*) INTO v_overrides FROM public.office_court_overrides oc WHERE oc.office_id = r.office_id;
      PERFORM public.notify_office_members(
        r.office_id, 'case.view', NULL, 'calc_standard_changed',
        '계산 기준표가 v' || NEW.version || '로 바뀌었어요',
        '진행 중 사건 ' || r.active_cases || '건. 제안서·서식의 생계비·변제금은 새 기준으로 다시 확인해 주세요.'
          || CASE WHEN v_overrides > 0 THEN ' 우리 사무소가 바꾼 법원 실무 칸 ' || v_overrides || '곳은 그대로 써요.' ELSE '' END,
        'calc_standard', NEW.version::text, 'calc_std:' || NEW.version
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'calc standard notice failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_calc_standard_published_notice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_calc_standard_published_notice ON public.calc_standard_sets;
CREATE TRIGGER trg_calc_standard_published_notice AFTER INSERT OR UPDATE OF status ON public.calc_standard_sets
  FOR EACH ROW EXECUTE FUNCTION public.trg_calc_standard_published_notice();
