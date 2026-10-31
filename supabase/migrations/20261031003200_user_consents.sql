-- ============================================================
-- 동의 기록·철회·약관 버전 (CT-13·MY-9)
-- 이전: 로그인 동의(이용약관·개인정보)와 변호사 정보 제공 동의를 계정 user_metadata에 저장 — 본인이 언제든
--       고칠 수 있어 기록 근거가 약했고, 철회 방법이 없었다. 약관 버전은 코드 상수뿐이었다.
-- 바꾼 것:
--  * legal_documents: 약관·처리방침·정보 제공 동의 문서의 버전 (게시본은 누구나 읽기, 게시는 관리자 함수만)
--  * user_consents: 동의할 때마다 한 줄(추가만), 철회는 withdrawn_at 한 번만 기록. 본인만 읽음
--  * 변호사에게 상담 요청을 보낼 때(consult_request_lawyers) 정보 제공 동의 줄이 자동으로 생긴다
--  * withdraw_my_consent: 정보 제공 동의 철회 = 계약 전이면 그 변호사 요청 취소(자리 반환, 그 변호사 열람 중단).
--    계약 뒤에는 위임 계약에 따른 처리라 철회로 막지 않고 기록만 남기고 안내한다
--  * 이용약관·개인정보 동의 철회는 탈퇴로 처리 (개인정보 요청 '동의 철회'로 접수)
--  * my_pending_reconsent: 다시 동의가 필요한 새 약관 버전 (게시할 때 '다시 동의 받기'를 켠 경우)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('terms', 'privacy', 'third_party', 'lawyer_terms')),
  version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 200),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 1000),
  effective_on date NOT NULL,
  requires_reconsent boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  UNIQUE (kind, version)
);
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_documents_public_read ON public.legal_documents;
CREATE POLICY legal_documents_public_read ON public.legal_documents FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.legal_documents FROM anon, authenticated;
GRANT SELECT ON public.legal_documents TO anon, authenticated;

-- 지금 쓰는 버전 (clientConsentService.CONSENT_VERSIONS와 같음)
INSERT INTO public.legal_documents (kind, version, title, url, effective_on, summary) VALUES
  ('terms', 'tos-2026-09-30', '서비스 이용약관', '/tos.html', '2026-09-30', NULL),
  ('privacy', 'privacy-2026-09-30', '개인정보 처리방침', '/privacy.html', '2026-09-30', NULL),
  ('third_party', 'third-party-2026-09-30', '변호사에게 상담 정보 제공 동의', '/privacy.html', '2026-09-30',
   '상담을 요청한 변호사에게 정리한 채무·소득 정보와 상담 내용을 제공합니다. 연락처는 내가 공개를 허락한 경우에만 갑니다.')
ON CONFLICT (kind, version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('terms', 'privacy', 'third_party', 'lawyer_terms')),
  version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 40),
  source text NOT NULL DEFAULT 'login' CHECK (source IN ('login', 'consult_request', 'reconsent', 'migrated')),
  request_id text,
  lawyer_id text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdraw_reason text CHECK (withdraw_reason IS NULL OR char_length(withdraw_reason) <= 300),
  withdraw_effect text CHECK (withdraw_effect IS NULL OR withdraw_effect IN ('seat_withdrawn', 'contracted_kept', 'already_closed', 'account_request'))
);
CREATE INDEX IF NOT EXISTS user_consents_user_idx ON public.user_consents (user_id, kind, granted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS user_consents_third_party_uq ON public.user_consents (user_id, request_id, lawyer_id, version)
  WHERE kind = 'third_party' AND withdrawn_at IS NULL;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_consents_own_read ON public.user_consents;
CREATE POLICY user_consents_own_read ON public.user_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT ON public.user_consents TO authenticated;

-- 동의 줄은 지우거나 고칠 수 없다 (철회 칸만, 한 번)
CREATE OR REPLACE FUNCTION public.user_consents_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- 계정 삭제(auth.users 연쇄 삭제)·파기 작업은 허용
    IF current_setting('mykim.consent_purge', true) = 'on' OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'consents cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF OLD.withdrawn_at IS NOT NULL OR (to_jsonb(NEW) - 'withdrawn_at' - 'withdraw_reason' - 'withdraw_effect') IS DISTINCT FROM (to_jsonb(OLD) - 'withdrawn_at' - 'withdraw_reason' - 'withdraw_effect') THEN
    RAISE EXCEPTION 'consent record is fixed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_consents_guard ON public.user_consents;
CREATE TRIGGER user_consents_guard BEFORE UPDATE OR DELETE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.user_consents_guard();

-- 변호사 요청 → 정보 제공 동의 줄
CREATE OR REPLACE FUNCTION public.trg_seat_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    INSERT INTO user_consents (user_id, kind, version, source, request_id, lawyer_id, granted_at)
    VALUES (NEW.client_id::uuid, 'third_party', NEW.consent_version, 'consult_request', NEW.request_id, NEW.lawyer_id, NEW.consented_at)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'seat consent record failed: %', SQLERRM;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_seat_consent ON public.consult_request_lawyers;
CREATE TRIGGER trg_seat_consent AFTER INSERT ON public.consult_request_lawyers
  FOR EACH ROW EXECUTE FUNCTION public.trg_seat_consent();

-- 지금 있는 요청 옮기기
INSERT INTO public.user_consents (user_id, kind, version, source, request_id, lawyer_id, granted_at)
SELECT l.client_id::uuid, 'third_party', l.consent_version, 'migrated', l.request_id, l.lawyer_id, l.consented_at
FROM public.consult_request_lawyers l
WHERE l.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.client_id::uuid)
ON CONFLICT DO NOTHING;

-- 로그인 때 이용약관·개인정보 동의 (게시된 버전만, 같은 버전이 이미 있으면 그대로)
CREATE OR REPLACE FUNCTION public.record_my_consents(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e jsonb;
  v_kind text;
  v_version text;
  v_source text;
  n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 4 THEN RAISE EXCEPTION 'invalid items' USING ERRCODE = '22023'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_kind := e ->> 'kind';
    v_version := e ->> 'version';
    v_source := CASE WHEN e ->> 'source' = 'reconsent' THEN 'reconsent' ELSE 'login' END;
    IF v_kind NOT IN ('terms', 'privacy', 'lawyer_terms') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM legal_documents d WHERE d.kind = v_kind AND d.version = v_version) THEN
      RAISE EXCEPTION 'unknown document version' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM user_consents c WHERE c.user_id = auth.uid() AND c.kind = v_kind AND c.version = v_version AND c.withdrawn_at IS NULL) THEN
      INSERT INTO user_consents (user_id, kind, version, source) VALUES (auth.uid(), v_kind, v_version, v_source);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.record_my_consents(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_consents(jsonb) TO authenticated;

-- 내 동의 목록 (변호사 이름·요청 상태 포함)
CREATE OR REPLACE FUNCTION public.my_consents()
RETURNS TABLE (id uuid, kind text, version text, title text, url text, source text, request_id text, lawyer_id text,
               lawyer_name text, seat_status text, granted_at timestamptz, withdrawn_at timestamptz, withdraw_effect text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.kind, c.version, d.title, d.url, c.source, c.request_id, c.lawyer_id,
         CASE WHEN c.lawyer_id IS NULL THEN NULL ELSE (SELECT l.name FROM lawyers l WHERE l.id = c.lawyer_id) END,
         (SELECT s.status FROM consult_request_lawyers s WHERE s.request_id = c.request_id AND s.lawyer_id = c.lawyer_id),
         c.granted_at, c.withdrawn_at, c.withdraw_effect
  FROM user_consents c LEFT JOIN legal_documents d ON d.kind = c.kind AND d.version = c.version
  WHERE c.user_id = auth.uid()
  ORDER BY c.granted_at DESC
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.my_consents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_consents() TO authenticated;

-- 철회
CREATE OR REPLACE FUNCTION public.withdraw_my_consent(p_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c user_consents;
  v_seat text;
  v_req consult_requests;
  v_effect text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM user_consents WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'consent not found' USING ERRCODE = 'P0002'; END IF;
  IF c.withdrawn_at IS NOT NULL THEN RETURN jsonb_build_object('effect', c.withdraw_effect, 'already', true); END IF;

  IF c.kind = 'third_party' THEN
    SELECT status INTO v_seat FROM consult_request_lawyers WHERE request_id = c.request_id AND lawyer_id = c.lawyer_id;
    SELECT * INTO v_req FROM consult_requests WHERE id = c.request_id;
    IF v_req.id IS NOT NULL AND v_req.status IN ('requested', 'responding', 'comparing', 'counseling')
       AND v_seat IN ('requested', 'reviewing', 'proposed', 'chosen', 'released') THEN
      PERFORM public.client_withdraw_consult_lawyer(c.request_id, c.lawyer_id);
      v_effect := 'seat_withdrawn';
    ELSIF v_req.id IS NOT NULL AND v_req.status NOT IN ('requested', 'responding', 'comparing', 'counseling', 'cancelled')
          AND v_seat = 'chosen' THEN
      v_effect := 'contracted_kept';
    ELSE
      v_effect := 'already_closed';
    END IF;
  ELSE
    -- 이용약관·개인정보 동의 철회 = 탈퇴 요청
    INSERT INTO privacy_requests (user_id, kind, detail)
    VALUES (auth.uid(), 'withdrawal_consent', left(coalesce(nullif(btrim(p_reason), ''), '동의 철회(탈퇴) 요청'), 1000));
    v_effect := 'account_request';
  END IF;

  UPDATE user_consents SET withdrawn_at = now(), withdraw_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''), withdraw_effect = v_effect
  WHERE id = c.id;
  RETURN jsonb_build_object('effect', v_effect);
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_my_consent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_my_consent(uuid, text) TO authenticated;

-- 다시 동의가 필요한 문서 (가장 최근 게시본이 '다시 동의 받기'이고 그 버전에 동의한 적이 없음)
CREATE OR REPLACE FUNCTION public.my_pending_reconsent()
RETURNS TABLE (kind text, version text, title text, url text, summary text, effective_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.kind, d.version, d.title, d.url, d.summary, d.effective_on
  FROM legal_documents d
  WHERE auth.uid() IS NOT NULL AND d.kind IN ('terms', 'privacy') AND d.requires_reconsent
    AND d.published_at = (SELECT max(d2.published_at) FROM legal_documents d2 WHERE d2.kind = d.kind)
    AND NOT EXISTS (SELECT 1 FROM user_consents c WHERE c.user_id = auth.uid() AND c.kind = d.kind AND c.version = d.version AND c.withdrawn_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM lawyer_accounts la WHERE la.auth_user_id = auth.uid())
    AND NOT public.is_platform_admin();
$$;
REVOKE ALL ON FUNCTION public.my_pending_reconsent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_reconsent() TO authenticated;

-- 관리자: 새 버전 게시 (게시본은 고칠 수 없음, 시행일 7일 전(불리한 변경 30일 전) 공지는 운영 규칙)
CREATE OR REPLACE FUNCTION public.admin_publish_legal_document(
  p_kind text, p_version text, p_title text, p_url text, p_summary text, p_effective_on date, p_requires_reconsent boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('terms', 'privacy', 'third_party', 'lawyer_terms') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
  IF coalesce(btrim(p_version), '') = '' OR coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_url), '') = '' OR p_effective_on IS NULL THEN
    RAISE EXCEPTION 'version, title, url, effective date required' USING ERRCODE = '22023';
  END IF;
  IF p_url !~ '^(/|https://)' THEN RAISE EXCEPTION 'invalid url' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM legal_documents WHERE kind = p_kind AND version = btrim(p_version)) THEN
    RAISE EXCEPTION 'version already published' USING ERRCODE = '23505';
  END IF;
  INSERT INTO legal_documents (kind, version, title, url, summary, effective_on, requires_reconsent, published_by)
  VALUES (p_kind, btrim(p_version), btrim(p_title), btrim(p_url), nullif(btrim(coalesce(p_summary, '')), ''), p_effective_on,
          coalesce(p_requires_reconsent, false), auth.uid())
  RETURNING id INTO v;
  PERFORM public.admin_record_action('legal_document_publish', 'legal_document', v::text, NULL,
    jsonb_build_object('kind', p_kind, 'version', btrim(p_version), 'reconsent', coalesce(p_requires_reconsent, false)), NULL);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_publish_legal_document(text, text, text, text, text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_legal_document(text, text, text, text, text, date, boolean) TO authenticated;

-- 관리자: 버전별 동의 수 (개인 정보 없음)
CREATE OR REPLACE FUNCTION public.admin_consent_stats()
RETURNS TABLE (kind text, version text, granted bigint, withdrawn bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT c.kind, c.version, count(*), count(*) FILTER (WHERE c.withdrawn_at IS NOT NULL)
  FROM user_consents c GROUP BY c.kind, c.version ORDER BY c.kind, c.version;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_consent_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_consent_stats() TO authenticated;
