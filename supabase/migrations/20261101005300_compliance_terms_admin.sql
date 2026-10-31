-- 금지어 사전 관리자 편집 (M-9 후속, 출시 직후)
-- 공통 사전(api/_lib/compliance-terms.js · 아래 SQL 기본 목록)은 코드에 고정 — 관리자가 뺄 수 없다.
-- 통합어드민은 표현을 '더하기'만 한다: platform_config 'compliance_terms'
--   clientTerms     : 의뢰인에게 보내는 글(채팅·제안서·Q&A·프로필·광고 소재) 검사에 더할 표현
--   marketingTerms  : 마케팅 글 검사에 더할 표현 [{term, reason}]
-- 쓰기는 admin_set_compliance_terms() 로만 (직접 쓰기 차단, 조치 기록 admin_actions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_extra_client_terms()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT array_agg(t) FROM (
      SELECT DISTINCT btrim(x) AS t
      FROM platform_config c, jsonb_array_elements_text(coalesce(c.data -> 'clientTerms', '[]'::jsonb)) x
      WHERE c.id = 'compliance_terms' AND btrim(x) <> ''
      LIMIT 100) s), ARRAY[]::text[]);
$$;
REVOKE ALL ON FUNCTION public.platform_extra_client_terms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_extra_client_terms() TO authenticated;

-- Q&A·프로필 검사: 기본 목록 + 관리자가 더한 표현 (기본 목록은 src/services/proposalCompliance.ts QNA_BASE_TERMS 와 같게)
CREATE OR REPLACE FUNCTION public.qna_flagged_terms(p_text text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT term), ARRAY[]::text[])
  FROM unnest(ARRAY[
    '100% 보장','100% 비밀 보장','인가 보장','면책 보장','무조건','확실히','반드시 인가',
    '전격 면책','획기적','완벽히 방어',
    '전액 탕감','탕감 보장','최대 90%','성공률','승소율','전담 변호사','변호사 배정','매칭'
  ] || public.platform_extra_client_terms()) AS term
  WHERE term <> '' AND position(replace(term, ' ', '') IN replace(coalesce(p_text, ''), ' ', '')) > 0;
$$;
REVOKE ALL ON FUNCTION public.qna_flagged_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qna_flagged_terms(text) TO authenticated;

-- 광고 소재 경고: 기본 규칙 + 관리자가 더한 표현 (경고만, 막지 않음)
CREATE OR REPLACE FUNCTION public.ad_copy_warnings(p_text text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v text[] := '{}';
  t text := coalesce(p_text, '');
  x text;
BEGIN
  IF t ~ '(100|백)\s*%|보장|확실|무조건' THEN v := array_append(v, '결과를 보장하는 표현'); END IF;
  IF t ~ '성공률|인가율|면책률|승소율|[0-9]+\s*건\s*(수임|처리|해결)|누적' THEN v := array_append(v, '성공률·처리 건수 같은 실적 수치'); END IF;
  IF t ~ '최고|최초|1위|넘버원|No\.?\s*1|유일' THEN v := array_append(v, '최상급·비교 표현'); END IF;
  IF t ~ '전담|추천|배정|매칭' THEN v := array_append(v, '전담·추천·배정·매칭 표현'); END IF;
  IF t ~ '무료\s*상담|공짜' THEN v := array_append(v, '무료 상담 표현'); END IF;
  IF t ~ '탕감|감면율|변제율\s*[0-9]' THEN v := array_append(v, '탕감·감면율 표현'); END IF;
  FOREACH x IN ARRAY public.platform_extra_client_terms() LOOP
    IF position(replace(x, ' ', '') IN replace(t, ' ', '')) > 0 THEN
      v := array_append(v, '관리자가 더한 표현: ' || x);
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

-- 관리자 저장 (더하기만, 2~40자, 각 100개까지)
CREATE OR REPLACE FUNCTION public.admin_set_compliance_terms(p_client_terms text[], p_marketing_terms jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb;
  v_client jsonb;
  v_marketing jsonb;
  v_out jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF cardinality(coalesce(p_client_terms, '{}')) > 100 THEN RAISE EXCEPTION 'at most 100 terms each' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(coalesce(p_marketing_terms, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_marketing_terms, '[]'::jsonb)) > 100 THEN
    RAISE EXCEPTION 'at most 100 terms each' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_client_terms, '{}')) x WHERE char_length(btrim(x)) NOT BETWEEN 2 AND 40) THEN
    RAISE EXCEPTION 'each term must be 2 to 40 characters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_marketing_terms, '[]'::jsonb)) e
             WHERE jsonb_typeof(e) <> 'object' OR char_length(btrim(coalesce(e ->> 'term', ''))) NOT BETWEEN 2 AND 40
                OR char_length(coalesce(e ->> 'reason', '')) > 100) THEN
    RAISE EXCEPTION 'each term must be 2 to 40 characters' USING ERRCODE = '22023';
  END IF;

  SELECT data INTO v_before FROM platform_config WHERE id = 'compliance_terms';
  SELECT coalesce(jsonb_agg(t ORDER BY t), '[]'::jsonb) INTO v_client
    FROM (SELECT DISTINCT btrim(x) AS t FROM unnest(coalesce(p_client_terms, '{}')) x) s;
  SELECT coalesce(jsonb_agg(jsonb_build_object('term', term, 'reason', reason) ORDER BY term), '[]'::jsonb) INTO v_marketing
    FROM (SELECT DISTINCT ON (btrim(e ->> 'term')) btrim(e ->> 'term') AS term, nullif(btrim(coalesce(e ->> 'reason', '')), '') AS reason
          FROM jsonb_array_elements(coalesce(p_marketing_terms, '[]'::jsonb)) e
          ORDER BY btrim(e ->> 'term')) s;
  v_out := jsonb_build_object('clientTerms', v_client, 'marketingTerms', v_marketing, 'updatedAt', now());

  INSERT INTO platform_config (id, data, updated_at) VALUES ('compliance_terms', v_out, now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
  PERFORM public.admin_record_action('platform.compliance_terms', 'platform_config', 'compliance_terms', v_before, v_out, NULL);
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_compliance_terms(text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_compliance_terms(text[], jsonb) TO authenticated;

-- 직접 쓰기 차단: 기능 표시와 같은 방식
CREATE OR REPLACE FUNCTION public.platform_config_feature_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 함수(SECURITY DEFINER) 안에서는 current_user가 소유자라 통과, 브라우저 직접 쓰기는 authenticated라 막힌다
  IF NEW.id = 'feature_flags' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_platform_features' USING ERRCODE = '42501';
  END IF;
  IF NEW.id = 'compliance_terms' AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'use admin_set_compliance_terms' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
