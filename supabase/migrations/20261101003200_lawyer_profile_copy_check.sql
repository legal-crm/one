-- ════════════════════════════════════════════════════════════════════════════
-- LD-4 변호사 프로필 소개 문구 금지 표현 → 통합어드민 '다시 확인 필요' (경고 + 관리자 검토 목록, 막지 않음)
--  * 승인된 변호사가 소개(bio)·한줄 소개(data.catchphrase)·상세 분야(data.specialties)를 바꾸고
--    그 글에 공개 Q&A와 같은 금지 표현(qna_flagged_terms)이 있으면 recheck_fields 에 'copy_terms' 를 더한다
--  * 승인 전 프로필은 가입 심사에서 함께 본다 (이 트리거는 승인 뒤 변경만)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_lawyer_profile_recheck()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fields text[] := ARRAY[]::text[];
  v_copy text;
BEGIN
  IF public.is_platform_admin() THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = NEW.id AND la.approved) THEN RETURN NULL; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
  IF NEW.firm_name IS DISTINCT FROM OLD.firm_name THEN v_fields := array_append(v_fields, 'firm_name'); END IF;
  IF NEW.avatar IS DISTINCT FROM OLD.avatar AND coalesce(NEW.avatar, '') <> '' THEN v_fields := array_append(v_fields, 'photo'); END IF;
  IF (NEW.data ->> 'licenseNumber') IS DISTINCT FROM (OLD.data ->> 'licenseNumber') THEN v_fields := array_append(v_fields, 'license_number'); END IF;
  IF NEW.bio IS DISTINCT FROM OLD.bio
     OR (NEW.data ->> 'catchphrase') IS DISTINCT FROM (OLD.data ->> 'catchphrase')
     OR (NEW.specialties)::text IS DISTINCT FROM (OLD.specialties)::text THEN
    v_copy := concat_ws(' ', NEW.bio, NEW.data ->> 'catchphrase', NEW.specialties::text);
    IF cardinality(public.qna_flagged_terms(v_copy)) > 0 THEN v_fields := array_append(v_fields, 'copy_terms'); END IF;
  END IF;
  IF cardinality(v_fields) = 0 THEN RETURN NULL; END IF;
  INSERT INTO lawyer_review_state (lawyer_id, status, recheck_needed, recheck_fields, recheck_at, updated_at)
  VALUES (NEW.id, 'approved', true, v_fields, now(), now())
  ON CONFLICT (lawyer_id) DO UPDATE SET
    recheck_needed = true,
    recheck_fields = (SELECT array_agg(DISTINCT f) FROM unnest(lawyer_review_state.recheck_fields || v_fields) f),
    recheck_at = now(), updated_at = now();
  INSERT INTO lawyer_review_events (lawyer_id, action, reason, actor_user_id)
  VALUES (NEW.id, 'profile_changed', array_to_string(v_fields, ','), auth.uid());
  RETURN NULL;
END;
$$;
