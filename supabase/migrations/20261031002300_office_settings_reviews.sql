-- ============================================================
-- ST-2·ST-3·ST-5·ST-6·RB-6 사무소 설정 서버 저장·직인·발송 문구 규칙·제안서 검토 요청
-- 이전: 사무소 정보·도장·상담 스타일·제안서 컨펌 대기가 브라우저(localStorage)에만 있어
--       다른 기기·다른 직원에게 보이지 않았고, 컨펌 요청은 요청한 직원 브라우저에만 남았다.
-- ============================================================

-- 1) 사무소 설정 (구역별 한 행, 버전 확인) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.office_settings (
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('profile', 'seal', 'client_messaging', 'copy_rules', 'work_defaults', 'security')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, section)
);
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.office_settings TO authenticated;
GRANT ALL ON public.office_settings TO service_role;
DROP POLICY IF EXISTS office_settings_read ON public.office_settings;
-- 읽기 = 같은 사무소 구성원 (서식·알림 문구가 사무소 정보를 읽어야 하므로)
CREATE POLICY office_settings_read ON public.office_settings FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()) OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.set_office_settings(p_office_id text, p_section text, p_data jsonb, p_expected_version integer DEFAULT NULL)
RETURNS public.office_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v office_settings%ROWTYPE;
  v_keys text[];
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'office.settings.edit') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: office.settings.edit' USING ERRCODE = '42501';
  END IF;
  IF p_section NOT IN ('profile', 'seal', 'client_messaging', 'copy_rules', 'work_defaults', 'security') THEN
    RAISE EXCEPTION 'unknown settings section' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_data) <> 'object' OR length(p_data::text) > 20000 THEN RAISE EXCEPTION 'settings too large' USING ERRCODE = '22023'; END IF;
  IF p_data::text ~ '[0-9]{6}\s*-?\s*[1-4][0-9]{6}' THEN
    RAISE EXCEPTION 'resident registration numbers must not be stored' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM office_settings WHERE office_id = p_office_id AND section = p_section FOR UPDATE;
  IF v.office_id IS NULL THEN
    INSERT INTO office_settings (office_id, section, data, updated_by) VALUES (p_office_id, p_section, p_data, auth.uid()) RETURNING * INTO v;
  ELSE
    IF p_expected_version IS NOT NULL AND p_expected_version <> v.version THEN
      RAISE EXCEPTION 'version conflict' USING ERRCODE = '40001';
    END IF;
    SELECT coalesce(array_agg(k), '{}') INTO v_keys FROM (
      SELECT k FROM jsonb_object_keys(p_data) k WHERE (v.data -> k) IS DISTINCT FROM (p_data -> k)
      UNION SELECT k FROM jsonb_object_keys(v.data) k WHERE NOT p_data ? k) s;
    UPDATE office_settings SET data = p_data, version = version + 1, updated_by = auth.uid(), updated_at = now()
     WHERE office_id = p_office_id AND section = p_section RETURNING * INTO v;
  END IF;
  -- 변경 기록은 칸 이름만 (값은 남기지 않음)
  PERFORM public.office_log(p_office_id, 'settings.' || p_section, 'office_settings', p_section, jsonb_build_object('fields', to_jsonb(coalesce(v_keys, '{}'::text[]))));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_office_settings(text, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_settings(text, text, jsonb, integer) TO authenticated;

-- 2) 사람별 설정 (본인만) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('display', 'dashboard', 'notifications')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
DROP POLICY IF EXISTS user_preferences_own ON public.user_preferences;
CREATE POLICY user_preferences_own ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND length(data::text) <= 20000);

-- 3) 직인·도장·서명 (비공개 저장소 'office-assets', DB엔 경로만) ------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('office-assets', 'office-assets', false, 2097152, ARRAY['image/png', 'image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.office_seals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('office_seal', 'lawyer_seal', 'lawyer_signature')),
  owner_user_id uuid,              -- 개인 도장·서명의 주인 (사무소 직인은 NULL)
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 40),
  image_path text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_seals_office_idx ON public.office_seals (office_id, kind) WHERE active;
ALTER TABLE public.office_seals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_seals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.office_seals TO authenticated;
GRANT ALL ON public.office_seals TO service_role;
DROP POLICY IF EXISTS office_seals_read ON public.office_seals;
CREATE POLICY office_seals_read ON public.office_seals FOR SELECT TO authenticated
  USING (office_id = ANY (public.current_office_ids()));

DROP POLICY IF EXISTS office_assets_insert ON storage.objects;
CREATE POLICY office_assets_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'office-assets' AND (storage.foldername(name))[1] = ANY (public.current_office_ids()));
DROP POLICY IF EXISTS office_assets_read ON storage.objects;
CREATE POLICY office_assets_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'office-assets' AND (storage.foldername(name))[1] = ANY (public.current_office_ids()));

-- 사무소 직인 = office.settings.edit, 개인 도장·서명 = 본인 (예전 것은 내림)
CREATE OR REPLACE FUNCTION public.register_office_seal(p_office_id text, p_kind text, p_image_path text, p_label text DEFAULT '')
RETURNS public.office_seals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v office_seals%ROWTYPE;
  v_owner uuid;
BEGIN
  IF NOT (p_office_id = ANY (public.current_office_ids())) OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('office_seal', 'lawyer_seal', 'lawyer_signature') THEN RAISE EXCEPTION 'invalid seal kind' USING ERRCODE = '22023'; END IF;
  IF p_kind = 'office_seal' AND NOT public.has_office_permission(p_office_id, 'office.settings.edit') THEN
    RAISE EXCEPTION 'permission denied: office.settings.edit' USING ERRCODE = '42501';
  END IF;
  IF split_part(coalesce(p_image_path, ''), '/', 1) <> p_office_id
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'office-assets' AND o.name = p_image_path) THEN
    RAISE EXCEPTION 'image not uploaded' USING ERRCODE = '22023';
  END IF;
  v_owner := CASE WHEN p_kind = 'office_seal' THEN NULL ELSE auth.uid() END;
  UPDATE office_seals SET active = false WHERE office_id = p_office_id AND kind = p_kind AND owner_user_id IS NOT DISTINCT FROM v_owner AND active;
  INSERT INTO office_seals (office_id, kind, owner_user_id, label, image_path)
  VALUES (p_office_id, p_kind, v_owner, left(coalesce(p_label, ''), 40), p_image_path) RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'seal.register', 'office_seal', v.id::text, jsonb_build_object('kind', p_kind));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.register_office_seal(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_office_seal(text, text, text, text) TO authenticated;

-- 날인 기록 (어떤 문서에 누가) — 문서 이름·종류만, 내용 없음
CREATE OR REPLACE FUNCTION public.log_seal_usage(p_office_id text, p_seal_id uuid, p_document text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (p_office_id = ANY (public.current_office_ids())) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_seals s WHERE s.id = p_seal_id AND s.office_id = p_office_id) THEN RAISE EXCEPTION 'seal not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.office_log(p_office_id, 'seal.use', 'office_seal', p_seal_id::text, jsonb_build_object('document', left(coalesce(p_document, ''), 80)));
END;
$$;
REVOKE ALL ON FUNCTION public.log_seal_usage(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_seal_usage(text, uuid, text) TO authenticated;

-- 4) 발송 문구 규칙: '그대로 보내기' 기록 (ST-6) — 걸린 표현 종류와 화면만, 본문 없음
CREATE OR REPLACE FUNCTION public.log_copy_override(p_office_id text, p_channel text, p_terms text[], p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (p_office_id = ANY (public.current_office_ids())) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  PERFORM public.office_log(p_office_id, 'copy.override', 'client_message', left(coalesce(p_channel, ''), 30),
    jsonb_build_object('terms', to_jsonb(coalesce(p_terms[1:10], '{}'::text[])), 'reason', left(btrim(p_reason), 200)));
END;
$$;
REVOKE ALL ON FUNCTION public.log_copy_override(text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_copy_override(text, text, text[], text) TO authenticated;

-- 5) 제안서 검토 요청 (RB-6) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  consult_request_id text NOT NULL,
  client_alias text NOT NULL DEFAULT '' CHECK (char_length(client_alias) <= 40),
  proposal_data jsonb NOT NULL,
  memo text CHECK (memo IS NULL OR char_length(memo) <= 1000),
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  requested_by_name text NOT NULL DEFAULT '' CHECK (char_length(requested_by_name) <= 40),
  reviewer_lawyer_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_reviews_office_idx ON public.proposal_reviews (office_id, status, created_at DESC);
ALTER TABLE public.proposal_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.proposal_reviews TO authenticated;
GRANT ALL ON public.proposal_reviews TO service_role;
DROP POLICY IF EXISTS proposal_reviews_read ON public.proposal_reviews;
CREATE POLICY proposal_reviews_read ON public.proposal_reviews FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_office_permission(office_id, 'proposal.send'));

CREATE OR REPLACE FUNCTION public.request_proposal_review(p_office_id text, p_consult_request_id text, p jsonb)
RETURNS public.proposal_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v proposal_reviews%ROWTYPE;
  v_reviewer text := nullif(btrim(coalesce(p ->> 'reviewer_lawyer_id', '')), '');
  v_user uuid;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'proposal.draft') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: proposal.draft' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p -> 'proposal_data') <> 'object' OR length((p -> 'proposal_data')::text) > 100000 THEN
    RAISE EXCEPTION 'proposal data required' USING ERRCODE = '22023';
  END IF;
  SELECT m.user_id INTO v_user FROM office_members m
   WHERE m.office_id = p_office_id AND m.lawyer_id = v_reviewer AND m.status = 'active' AND m.role IN ('owner', 'lawyer');
  IF v_user IS NULL THEN RAISE EXCEPTION 'reviewer must be a lawyer of this office' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM proposal_reviews WHERE office_id = p_office_id AND consult_request_id = p_consult_request_id AND status = 'pending') THEN
    RAISE EXCEPTION 'review already pending' USING ERRCODE = '23505';
  END IF;
  INSERT INTO proposal_reviews (office_id, consult_request_id, client_alias, proposal_data, memo, requested_by_name, reviewer_lawyer_id)
  VALUES (p_office_id, p_consult_request_id, left(coalesce(p ->> 'client_alias', ''), 40), p -> 'proposal_data',
          nullif(left(btrim(coalesce(p ->> 'memo', '')), 1000), ''), left(coalesce(p ->> 'requested_by_name', ''), 40), v_reviewer)
  RETURNING * INTO v;
  PERFORM public.notify_user(v_user, 'office', p_office_id, 'proposal_review', '제안서 검토 요청이 왔어요',
    coalesce(nullif(v.requested_by_name, ''), '직원') || '님이 ' || coalesce(nullif(v.client_alias, ''), '의뢰인') || '님 제안서 검토를 요청했어요.',
    'proposal_review', v.id::text, 'proposal_review:' || v.id);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.request_proposal_review(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_proposal_review(text, text, jsonb) TO authenticated;

-- approved(발송은 화면이 제안서 저장을 끝낸 뒤 기록) / rejected(사유) / withdrawn(요청한 사람)
CREATE OR REPLACE FUNCTION public.decide_proposal_review(p_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS public.proposal_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v proposal_reviews%ROWTYPE;
BEGIN
  SELECT * INTO v FROM proposal_reviews WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'review already decided' USING ERRCODE = '22023'; END IF;
  IF p_decision = 'withdrawn' THEN
    IF v.requested_by <> auth.uid() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  ELSIF p_decision IN ('approved', 'rejected') THEN
    IF NOT public.has_office_permission(v.office_id, 'proposal.send') OR NOT public.is_account_active() THEN
      RAISE EXCEPTION 'permission denied: proposal.send' USING ERRCODE = '42501';
    END IF;
    IF p_decision = 'rejected' AND coalesce(btrim(p_note), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  ELSE
    RAISE EXCEPTION 'unknown decision' USING ERRCODE = '22023';
  END IF;
  UPDATE proposal_reviews SET status = p_decision, decision_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         decided_by = auth.uid(), decided_at = now()
   WHERE id = p_id RETURNING * INTO v;
  IF p_decision IN ('approved', 'rejected') THEN
    PERFORM public.notify_user(v.requested_by, 'office', v.office_id, 'proposal_review_' || p_decision,
      CASE WHEN p_decision = 'approved' THEN '제안서가 승인되어 발송됐어요' ELSE '제안서가 반려됐어요' END,
      coalesce(nullif(v.client_alias, ''), '의뢰인') || '님 제안서' || CASE WHEN p_decision = 'rejected' THEN ' · 사유: ' || left(btrim(p_note), 120) ELSE '' END,
      'consult_request', v.consult_request_id, NULL);
  END IF;
  PERFORM public.office_log(v.office_id, 'proposal_review.' || p_decision, 'proposal_review', v.id::text, jsonb_build_object('consult_request_id', v.consult_request_id));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_proposal_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_proposal_review(uuid, text, text) TO authenticated;
