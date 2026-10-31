-- ════════════════════════════════════════════════════════════════════════════
-- LD-4·LD-5 변호사 자격 연도·변협 등록 전문분야 → 승인 뒤 바뀌면 '다시 확인 필요'
--  * data.admittedYear(자격 취득 연도, 'N년차' 근거)·data.kbaSpecialty(대한변협 등록 전문분야, '전문' 표시 근거)는
--    의뢰인 화면의 확인 배지·표시로 이어지는 주장이라 실명·사무소명·사진·등록번호처럼 관리자가 다시 본다
--  * 나머지는 20261101003200 과 같다 (막지 않음, 경고 + 관리자 검토 목록)
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
  IF (NEW.data ->> 'admittedYear') IS DISTINCT FROM (OLD.data ->> 'admittedYear') AND coalesce(NEW.data ->> 'admittedYear', '') <> '' THEN
    v_fields := array_append(v_fields, 'admitted_year');
  END IF;
  IF (NEW.data ->> 'kbaSpecialty') IS DISTINCT FROM (OLD.data ->> 'kbaSpecialty') AND btrim(coalesce(NEW.data ->> 'kbaSpecialty', '')) <> '' THEN
    v_fields := array_append(v_fields, 'kba_specialty');
  END IF;
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
