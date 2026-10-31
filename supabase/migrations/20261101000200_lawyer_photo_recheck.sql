-- ════════════════════════════════════════════════════════════════════════════
-- LD-4 변호사 프로필 사진 저장소 (이전: base64 글자를 avatar·avatar_data 두 칸에 통째로 저장)
-- LD-5 승인 뒤 실명·사무소명·사진·등록번호를 바꾸면 통합어드민 '다시 확인 필요' (이전: 승인 뒤 무검토)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. 사진 저장소 (공개 읽기: 변호사 찾기에 보이는 사진) ───────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lawyer-photos', 'lawyer-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 내 변호사 계정 폴더에만 올리고 지운다 (가입 심사 중에도 사진을 올릴 수 있게 승인 여부는 보지 않는다)
CREATE OR REPLACE FUNCTION public.my_lawyer_account_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT la.lawyer_id FROM lawyer_accounts la
  WHERE la.auth_user_id = auth.uid() AND NOT public.account_is_office_staff(la.auth_user_id)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.my_lawyer_account_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_lawyer_account_id() TO authenticated;

DROP POLICY IF EXISTS lawyer_photos_insert ON storage.objects;
CREATE POLICY lawyer_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lawyer-photos' AND (storage.foldername(name))[1] = public.my_lawyer_account_id());
DROP POLICY IF EXISTS lawyer_photos_update ON storage.objects;
CREATE POLICY lawyer_photos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lawyer-photos' AND (storage.foldername(name))[1] = public.my_lawyer_account_id());
DROP POLICY IF EXISTS lawyer_photos_delete ON storage.objects;
CREATE POLICY lawyer_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lawyer-photos' AND (storage.foldername(name))[1] = public.my_lawyer_account_id());

-- 사진 칸에 base64를 다시 넣지 않는다 (사진은 저장소 주소만). 예전 값은 그대로 두되 새로 쓰면 막는다
CREATE OR REPLACE FUNCTION public.lawyers_photo_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.avatar, '') LIKE 'data:%' AND (TG_OP = 'INSERT' OR NEW.avatar IS DISTINCT FROM OLD.avatar) THEN
    RAISE EXCEPTION 'upload the photo to storage first' USING ERRCODE = '22023';
  END IF;
  -- 두 번째 사진 칸은 더 쓰지 않는다
  IF TG_OP = 'INSERT' OR NEW.avatar_data IS DISTINCT FROM OLD.avatar_data THEN
    IF coalesce(NEW.avatar_data, '') LIKE 'data:%' THEN NEW.avatar_data := ''; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lawyers_photo_guard ON public.lawyers;
CREATE TRIGGER lawyers_photo_guard BEFORE INSERT OR UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.lawyers_photo_guard();

-- ── 2. 승인 뒤 바뀐 공개 정보 → 다시 확인 ──────────────────────────────────
ALTER TABLE public.lawyer_review_state
  ADD COLUMN IF NOT EXISTS recheck_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recheck_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS recheck_at timestamptz;

ALTER TABLE public.lawyer_review_events DROP CONSTRAINT IF EXISTS lawyer_review_events_action_check;
ALTER TABLE public.lawyer_review_events ADD CONSTRAINT lawyer_review_events_action_check
  CHECK (action IN ('approve', 'request_info', 'reject', 'suspend', 'reinstate', 'verify_license', 'profile_changed', 'recheck_done'));

CREATE OR REPLACE FUNCTION public.trg_lawyer_profile_recheck()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fields text[] := ARRAY[]::text[];
BEGIN
  IF public.is_platform_admin() THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.lawyer_id = NEW.id AND la.approved) THEN RETURN NULL; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
  IF NEW.firm_name IS DISTINCT FROM OLD.firm_name THEN v_fields := array_append(v_fields, 'firm_name'); END IF;
  IF NEW.avatar IS DISTINCT FROM OLD.avatar AND coalesce(NEW.avatar, '') <> '' THEN v_fields := array_append(v_fields, 'photo'); END IF;
  IF (NEW.data ->> 'licenseNumber') IS DISTINCT FROM (OLD.data ->> 'licenseNumber') THEN v_fields := array_append(v_fields, 'license_number'); END IF;
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
DROP TRIGGER IF EXISTS trg_lawyer_profile_recheck ON public.lawyers;
CREATE TRIGGER trg_lawyer_profile_recheck AFTER UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.trg_lawyer_profile_recheck();

-- 관리자: 다시 확인 끝 (사유·메모 기록)
CREATE OR REPLACE FUNCTION public.admin_mark_lawyer_rechecked(p_lawyer_id text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  UPDATE lawyer_review_state SET recheck_needed = false, recheck_fields = ARRAY[]::text[], updated_at = now(), updated_by = auth.uid()
  WHERE lawyer_id = p_lawyer_id;
  INSERT INTO lawyer_review_events (lawyer_id, action, reason, actor_user_id)
  VALUES (p_lawyer_id, 'recheck_done', left(nullif(btrim(coalesce(p_note, '')), ''), 500), auth.uid());
  PERFORM public.admin_record_action('lawyer.recheck_done', 'lawyer', p_lawyer_id, NULL, NULL, left(coalesce(p_note, ''), 300));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_lawyer_rechecked(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_lawyer_rechecked(text, text) TO authenticated;

-- 심사 목록에 '다시 확인 필요' 칸 (다시 확인할 변호사를 맨 위로)
CREATE OR REPLACE FUNCTION public.admin_list_lawyer_applications(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'recheck_needed')::boolean DESC, (x ->> 'status') = 'approved', x ->> 'submitted_at')
    FROM (
      SELECT jsonb_build_object(
        'lawyer_id', la.lawyer_id,
        'auth_user_id', la.auth_user_id,
        'email', la.auth_email,
        'name', l.name,
        'firm_name', l.firm_name,
        'region', l.region,
        'avatar', l.avatar,
        'license_number', l.data ->> 'licenseNumber',
        'has_license_image', coalesce(pp.data ? 'licenseImageData', false),
        'business_number', pp.data ->> 'businessNumber',
        'approved', la.approved,
        'status', coalesce(rs.status, CASE WHEN la.approved THEN 'approved' ELSE 'pending' END),
        'reason', rs.reason,
        'license_checked_at', rs.license_checked_at,
        'license_check_note', rs.license_check_note,
        'recheck_needed', coalesce(rs.recheck_needed, false),
        'recheck_fields', to_jsonb(coalesce(rs.recheck_fields, ARRAY[]::text[])),
        'recheck_at', rs.recheck_at,
        'submitted_at', la.created_at,
        'approved_at', la.approved_at,
        'waiting_business_days', CASE WHEN la.approved THEN NULL ELSE public.business_days_between(la.created_at) END,
        'profile_missing', CASE WHEN l.id IS NULL THEN to_jsonb(ARRAY['profile']) ELSE to_jsonb(public.lawyer_profile_missing(l)) END,
        'listed', CASE WHEN l.id IS NULL THEN false ELSE public.lawyer_is_public(l) END,
        'account_active', public.is_account_active(la.auth_user_id)
      ) AS x
      FROM lawyer_accounts la
      LEFT JOIN lawyers l ON l.id = la.lawyer_id
      LEFT JOIN lawyer_private_profiles pp ON pp.lawyer_id = la.lawyer_id
      LEFT JOIN lawyer_review_state rs ON rs.lawyer_id = la.lawyer_id
      WHERE NOT public.account_is_office_staff(la.auth_user_id)
        AND NOT EXISTS (SELECT 1 FROM lawyer_profile_tombstones t WHERE t.lawyer_id = la.lawyer_id)
    ) s
    WHERE p_status IS NULL OR x ->> 'status' = p_status
       OR (p_status = 'recheck' AND (x ->> 'recheck_needed')::boolean)
  ), '[]'::jsonb);
END;
$$;
