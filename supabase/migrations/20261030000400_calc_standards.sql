-- ============================================================================
-- 묶음 5. 계산 기준표 서버화 (LS-1·LS-2·LS-4, 27 기획서)
-- - calc_standard_sets: 통합어드민이 만든 기준표(AppSettings 전체) 버전. 게시본은 수정·삭제 불가.
--   누구나(익명 포함) 최신 게시본을 읽음(계산기·챗봇·제안서가 같은 기준 사용)
-- - office_court_overrides: 사무소가 '법원 성격' 실무 칸만 바꾼 값 (LS-Q4 사용자 결정), 근거 필수, 그 사무소 계산에만
-- - 이전: 기준표가 관리자 브라우저 localStorage 에만 있어 변호사·의뢰인 계산에 반영되지 않았음
-- ============================================================================

CREATE TABLE public.calc_standard_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  settings jsonb NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  published_at timestamptz,
  UNIQUE (version)
);
CREATE INDEX idx_calc_standard_sets_published ON public.calc_standard_sets (published_at DESC) WHERE status = 'published';

CREATE FUNCTION public.calc_standard_sets_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'published standards cannot be deleted' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  -- 게시본은 내용 수정 불가 (상태를 retired 로 바꾸는 것만 허용)
  IF OLD.status <> 'draft' AND (NEW.settings IS DISTINCT FROM OLD.settings OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'published standards are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_calc_standard_sets_guard BEFORE UPDATE OR DELETE ON public.calc_standard_sets
  FOR EACH ROW EXECUTE FUNCTION public.calc_standard_sets_guard();

CREATE TABLE public.office_court_overrides (
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  court_name text NOT NULL CHECK (length(btrim(court_name)) BETWEEN 1 AND 40),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 2 AND 500),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, court_name)
);

-- 최신 게시본 (없으면 null → 화면은 코드 기본값 사용)
CREATE FUNCTION public.current_calc_standard() RETURNS TABLE(id uuid, version integer, settings jsonb, published_at timestamptz, note text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT s.id, s.version, s.settings, s.published_at, s.note FROM calc_standard_sets s
  WHERE s.status = 'published' ORDER BY s.published_at DESC LIMIT 1;
$$;

-- 통합어드민: 새 버전 게시 (초안 저장 없이 바로 게시, 이전 게시본은 retired)
CREATE FUNCTION public.admin_publish_calc_standard(p_settings jsonb, p_note text) RETURNS public.calc_standard_sets
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row calc_standard_sets;
  v_next integer;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_settings) <> 'object' OR NOT (p_settings ? 'yearlyPolicies') OR NOT (p_settings ? 'courtConfigs') THEN
    RAISE EXCEPTION 'invalid settings' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_note, ''))) < 2 THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_next FROM calc_standard_sets;
  UPDATE calc_standard_sets SET status = 'retired' WHERE status = 'published';
  INSERT INTO calc_standard_sets (version, status, settings, note, created_by, published_by, published_at)
  VALUES (v_next, 'published', p_settings, left(btrim(p_note), 500), auth.uid(), auth.uid(), now())
  RETURNING * INTO v_row;
  PERFORM public.admin_audit('calc_standard.publish', 'calc_standard_set', v_row.id::text, jsonb_build_object('version', v_next, 'note', v_row.note));
  RETURN v_row;
END;
$$;

-- 사무소: 법원 성격 실무 칸만 (허용 칸 목록 밖은 거절)
CREATE FUNCTION public.set_office_court_override(p_office_id text, p_court_name text, p_fields jsonb, p_reason text) RETURNS public.office_court_overrides
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_key text;
  v_row office_court_overrides;
  v_allowed text[] := ARRAY['includeSpouseProperty', 'includeCryptoStock', 'shortPlanRule', 'allowAdditionalLivingCost', 'allowOtherLivingCost', 'memo'];
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_fields IS NULL OR p_fields = '{}'::jsonb THEN
    -- 빈 값 = 사무소 변경 되돌리기
    DELETE FROM office_court_overrides WHERE office_id = p_office_id AND court_name = p_court_name;
    PERFORM public.office_log(p_office_id, 'court_override.reset', 'court', p_court_name);
    RETURN NULL;
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_fields) LOOP
    IF NOT v_key = ANY (v_allowed) THEN RAISE EXCEPTION 'field not allowed: %', v_key USING ERRCODE = '22023'; END IF;
    IF v_key <> 'memo' AND jsonb_typeof(p_fields -> v_key) <> 'boolean' THEN RAISE EXCEPTION 'invalid value for %', v_key USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF length(btrim(coalesce(p_reason, ''))) < 2 THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  INSERT INTO office_court_overrides (office_id, court_name, fields, reason, updated_by, updated_at)
  VALUES (p_office_id, btrim(p_court_name), p_fields, left(btrim(p_reason), 500), auth.uid(), now())
  ON CONFLICT (office_id, court_name) DO UPDATE SET fields = EXCLUDED.fields, reason = EXCLUDED.reason, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING * INTO v_row;
  PERFORM public.office_log(p_office_id, 'court_override.set', 'court', p_court_name, jsonb_build_object('fields', p_fields, 'reason', v_row.reason));
  RETURN v_row;
END;
$$;

ALTER TABLE public.calc_standard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_court_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY calc_standard_sets_public_read ON public.calc_standard_sets FOR SELECT TO anon, authenticated USING (status <> 'draft');
CREATE POLICY calc_standard_sets_admin_read ON public.calc_standard_sets FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY office_court_overrides_member_read ON public.office_court_overrides FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));

REVOKE ALL ON public.calc_standard_sets, public.office_court_overrides FROM anon, authenticated;
GRANT SELECT ON public.calc_standard_sets TO anon, authenticated;
GRANT SELECT ON public.office_court_overrides TO authenticated;
GRANT ALL ON public.calc_standard_sets, public.office_court_overrides TO service_role;

REVOKE ALL ON FUNCTION public.current_calc_standard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_calc_standard() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_publish_calc_standard(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_calc_standard(jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_office_court_override(text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_court_override(text, text, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.calc_standard_sets_guard() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
