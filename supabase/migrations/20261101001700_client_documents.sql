-- 의뢰인 서류 작성기 바탕 (H-0 면책신청서, 고객 기획서 6-A)
--  * client-assets: 의뢰인이 만든 서명·도장 이미지 (비공개, 본인 폴더만)
--  * client_sign_assets: 서명·도장 목록 (본인만)
--  * client_doc_drafts: 작성 중 서류 초안 (본인만, 주민등록번호 형식이 들어 있으면 저장 거절 — L8)
--  * client_discharge_events: 마이김변 변호사 사건의 '변호사에게 접수 요청'·'직접 내려받음' 기록 + 사무소 알림
--    (이전: 의뢰인 화면이 crm_clients에 직접 쓰려 했지만 의뢰인에게는 쓰기 권한이 없어 요청이 전달되지 않았다)

-- 1. 서명·도장 저장소
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-assets', 'client-assets', false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS client_assets_own_read ON storage.objects;
CREATE POLICY client_assets_own_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS client_assets_own_insert ON storage.objects;
CREATE POLICY client_assets_own_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-assets' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_account_active());
DROP POLICY IF EXISTS client_assets_own_delete ON storage.objects;
CREATE POLICY client_assets_own_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.client_sign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('signature', 'seal')),
  source text NOT NULL CHECK (source IN ('pad', 'seal_maker', 'photo')),
  storage_path text NOT NULL CHECK (char_length(storage_path) BETWEEN 10 AND 300),
  label text CHECK (label IS NULL OR char_length(label) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (split_part(storage_path, '/', 1) = user_id::text)
);
CREATE INDEX IF NOT EXISTS client_sign_assets_user_idx ON public.client_sign_assets (user_id, created_at DESC);
ALTER TABLE public.client_sign_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_sign_assets_own ON public.client_sign_assets;
CREATE POLICY client_sign_assets_own ON public.client_sign_assets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_account_active());
REVOKE ALL ON public.client_sign_assets FROM anon;
GRANT SELECT, INSERT, DELETE ON public.client_sign_assets TO authenticated;

-- 한 사람 30개까지
CREATE OR REPLACE FUNCTION public.client_sign_assets_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.client_sign_assets WHERE user_id = NEW.user_id) >= 30 THEN
    RAISE EXCEPTION 'too many sign assets' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_sign_assets_limit ON public.client_sign_assets;
CREATE TRIGGER client_sign_assets_limit BEFORE INSERT ON public.client_sign_assets FOR EACH ROW EXECUTE FUNCTION public.client_sign_assets_limit();

-- 2. 작성 중 초안
CREATE TABLE IF NOT EXISTS public.client_doc_drafts (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_key text NOT NULL CHECK (doc_key ~ '^[a-z0-9_.:-]{3,80}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_key)
);
ALTER TABLE public.client_doc_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_doc_drafts_own ON public.client_doc_drafts;
CREATE POLICY client_doc_drafts_own ON public.client_doc_drafts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_account_active());
REVOKE ALL ON public.client_doc_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_doc_drafts TO authenticated;

CREATE OR REPLACE FUNCTION public.client_doc_drafts_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF octet_length(NEW.data::text) > 20000 THEN
    RAISE EXCEPTION 'draft too large' USING ERRCODE = 'check_violation';
  END IF;
  -- 주민등록번호는 저장하지 않는다 (L8)
  IF NEW.data::text ~ '\d{6}\s*-?\s*[1-8]\d{6}' THEN
    RAISE EXCEPTION 'resident number not allowed' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_doc_drafts_guard ON public.client_doc_drafts;
CREATE TRIGGER client_doc_drafts_guard BEFORE INSERT OR UPDATE ON public.client_doc_drafts FOR EACH ROW EXECUTE FUNCTION public.client_doc_drafts_guard();

-- 3. 면책신청 요청·직접 내려받음 기록
CREATE TABLE IF NOT EXISTS public.client_discharge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key text NOT NULL,
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('request', 'self_download')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_discharge_events_case_idx ON public.client_discharge_events (office_id, case_key, created_at DESC);
ALTER TABLE public.client_discharge_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_discharge_events_client ON public.client_discharge_events;
CREATE POLICY client_discharge_events_client ON public.client_discharge_events FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());
DROP POLICY IF EXISTS client_discharge_events_office ON public.client_discharge_events;
CREATE POLICY client_discharge_events_office ON public.client_discharge_events FOR SELECT TO authenticated
  USING (public.has_office_permission(office_id, 'case.view'));
REVOKE ALL ON public.client_discharge_events FROM anon;
GRANT SELECT ON public.client_discharge_events TO authenticated;

CREATE OR REPLACE FUNCTION public.client_discharge_event(p_case_key text, p_kind text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_case uuid;
  v_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'login required' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('request', 'self_download') THEN
    RAISE EXCEPTION 'invalid kind' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT public.client_owns_case_key(p_case_key) THEN
    RAISE EXCEPTION 'not your case' USING ERRCODE = '42501';
  END IF;
  v_office := public.client_request_office(p_case_key);
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'no office for case' USING ERRCODE = 'P0002';
  END IF;
  -- 같은 종류는 10분에 한 번만 기록·알림
  SELECT e.created_at INTO v_at FROM public.client_discharge_events e
  WHERE e.case_key = p_case_key AND e.client_user_id = auth.uid() AND e.kind = p_kind AND e.created_at > now() - interval '10 minutes'
  ORDER BY e.created_at DESC LIMIT 1;
  IF v_at IS NOT NULL THEN RETURN v_at; END IF;

  INSERT INTO public.client_discharge_events (case_key, office_id, client_user_id, kind)
  VALUES (p_case_key, v_office, auth.uid(), p_kind) RETURNING created_at INTO v_at;
  v_case := public.crm_client_case_id(v_office, p_case_key);
  PERFORM public.notify_office_members(
    v_office, 'case.view', v_case,
    CASE p_kind WHEN 'request' THEN 'discharge_request' ELSE 'discharge_self_download' END,
    CASE p_kind WHEN 'request' THEN '의뢰인이 면책신청 접수를 요청했어요' ELSE '의뢰인이 면책신청서를 직접 내려받았어요' END,
    CASE p_kind WHEN 'request' THEN '사건 6단계에서 면책신청서를 준비해 주세요.' ELSE '이중 접수가 되지 않게 의뢰인과 접수 방법을 확인해 주세요.' END,
    'case', p_case_key, 'discharge:' || p_case_key || ':' || p_kind
  );
  RETURN v_at;
END;
$$;
REVOKE ALL ON FUNCTION public.client_discharge_event(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_discharge_event(text, text) TO authenticated;
