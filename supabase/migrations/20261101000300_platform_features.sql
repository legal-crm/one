-- ════════════════════════════════════════════════════════════════════════════
-- CT-15 기능 표시 · 부가 기능 과금 모드 (LA-Q1: 사건 검토 무료 개방, 나중에 '광고 혜택' 또는 '정액 유료'로 바꿀 수 있게)
-- - 설정은 platform_config 'feature_flags' 한 줄 (누구나 읽기, 쓰기는 이 함수로만)
-- - 무료가 아닌 방식으로 바꾸려면 시작일이 오늘부터 30일 뒤 이후여야 하고, 바꾸면 사무소 공지가 자동으로 올라간다
-- - 건수 연동 과금은 두지 않는다 (상담 건당 과금 금지, 제34조)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_set_platform_features(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb;
  v_mode text := coalesce(p #>> '{caseReviewBilling,mode}', 'free');
  v_from date := nullif(p #>> '{caseReviewBilling,effectiveFrom}', '')::date;
  v_old_mode text;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_out jsonb;
  v_notice text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF v_mode NOT IN ('free', 'ad_benefit', 'flat_paid') THEN RAISE EXCEPTION 'invalid billing mode' USING ERRCODE = '22023'; END IF;
  SELECT data INTO v_before FROM platform_config WHERE id = 'feature_flags';
  v_old_mode := coalesce(v_before #>> '{caseReviewBilling,mode}', 'free');
  IF v_mode <> 'free' AND v_mode IS DISTINCT FROM v_old_mode THEN
    IF v_from IS NULL OR v_from < v_today + 30 THEN
      RAISE EXCEPTION 'paid mode needs 30 days notice' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_mode = 'free' THEN v_from := NULL; END IF;
  v_out := jsonb_build_object(
    'caseReviewBilling', jsonb_build_object('mode', v_mode, 'effectiveFrom', v_from,
       'noticeId', CASE WHEN v_mode = v_old_mode THEN v_before #>> '{caseReviewBilling,noticeId}' END),
    'features', jsonb_build_object(
       'calculatorVisible', coalesce((p #>> '{features,calculatorVisible}')::boolean, false),
       'companionVisible', coalesce((p #>> '{features,companionVisible}')::boolean, true)
    )
  );
  IF v_mode <> v_old_mode AND v_mode <> 'free' THEN
    v_notice := 'notice-addon-' || to_char(now(), 'YYYYMMDDHH24MISS');
    INSERT INTO notices (id, data, status) VALUES (v_notice, jsonb_build_object(
      'id', v_notice,
      'title', '사건 검토 기능 이용 조건 변경 안내',
      'content', '사건 검토(상세 분석 제안서 포함) 기능의 이용 조건이 ' || to_char(v_from, 'YYYY-MM-DD') || '부터 '
        || CASE v_mode WHEN 'ad_benefit' THEN '광고 상품을 이용 중인 사무소에 제공하는 방식' ELSE '정액 이용 신청 방식' END
        || '으로 바뀝니다. 그 전까지는 지금처럼 무료로 쓸 수 있습니다. 상담 건수에 따라 요금을 매기지 않습니다.',
      'date', to_char(v_today, 'YYYY-MM-DD'), 'isImportant', true, 'views', 0), 'published');
    v_out := jsonb_set(v_out, '{caseReviewBilling,noticeId}', to_jsonb(v_notice));
  END IF;
  INSERT INTO platform_config (id, data, updated_at) VALUES ('feature_flags', v_out, now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
  PERFORM public.admin_record_action('platform.features', 'platform_config', 'feature_flags', v_before, v_out, NULL);
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_platform_features(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_features(jsonb) TO authenticated;

-- 직접 쓰기로 30일 공지 규칙을 건너뛰지 못하게 (관리자 화면도 이 함수로만)
CREATE OR REPLACE FUNCTION public.platform_config_feature_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 함수(SECURITY DEFINER) 안에서는 current_user가 소유자라 통과, 브라우저 직접 쓰기는 authenticated라 막힌다
  IF NEW.id = 'feature_flags' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_platform_features' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS platform_config_feature_guard ON public.platform_config;
CREATE TRIGGER platform_config_feature_guard BEFORE INSERT OR UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_feature_guard();

-- 변호사가 자기 프로필을 저장하면서 '사건 검토 예외'·광고 등급을 스스로 바꾸지 못하게 (조용히 원래 값 유지)
-- 광고 등급은 서버 작업(sync_lawyer_ad_tiers)만, 예외는 관리자만 바꾼다
CREATE OR REPLACE FUNCTION public.lawyers_paid_fields_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.ai_case_analysis_enabled := false;
      NEW.ad_tier := 'free';
    ELSE
      NEW.ai_case_analysis_enabled := OLD.ai_case_analysis_enabled;
      NEW.ad_tier := OLD.ad_tier;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lawyers_paid_fields_guard ON public.lawyers;
CREATE TRIGGER lawyers_paid_fields_guard BEFORE INSERT OR UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.lawyers_paid_fields_guard();
