-- ============================================================
-- 회생동행·인증서 금고 서버 저장 (S 트랙)
-- 이전: 회생동행(나홀로·타 사무소 사건의 변제 회차·생계 밸런서·파산 일정)과 인증서 금고가 의뢰인 브라우저에만 있었다.
--       금고는 사무소로 전달된다고 안내했지만 crmService가 서버 저장에서 빼서 사무소에 닿지 않았다.
-- 바꾼 것:
--  1. client_companion_records: 의뢰인 본인만 읽고 쓰는 회생동행 기록 (종류 rehab/bankruptcy × 범위 키, 1MB 이하)
--  2. case_certificate_vaults: 사건 키별 인증서 금고. 직접 접근 없음, 함수만.
--     - 개인키·인증서 비밀번호는 의뢰인이 정한 보관 PIN으로 브라우저에서 암호화한 암호문만 받는다
--       (npki.encVersion = 'pin-v1', 평문 keyBase64 거절). 서버·관리자는 열 수 없다 (제로날리지)
--     - 의뢰인: 내 사건에 제출·보기·파기 / 사무소: 그 사건 documents.manage 권한자만 보기·대신 등록·파기, 열 때마다 활동 기록
--     - 관리자 정책 없음
-- ============================================================

-- ── 1. 회생동행 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_companion_records (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('rehab', 'bankruptcy')),
  scope_key text NOT NULL DEFAULT '' CHECK (char_length(scope_key) <= 120),
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, scope_key),
  CONSTRAINT client_companion_records_size CHECK (octet_length(data::text) <= 1048576)
);
ALTER TABLE public.client_companion_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_companion_records_own ON public.client_companion_records;
CREATE POLICY client_companion_records_own ON public.client_companion_records FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.client_companion_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_companion_records TO authenticated;

CREATE OR REPLACE FUNCTION public.client_companion_records_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  -- 주민등록번호 형식은 받지 않는다
  IF NEW.data::text ~ '[0-9]{6}-?[1-8][0-9]{6}' THEN
    RAISE EXCEPTION 'resident registration numbers are not stored' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS client_companion_records_touch ON public.client_companion_records;
CREATE TRIGGER client_companion_records_touch BEFORE INSERT OR UPDATE ON public.client_companion_records
  FOR EACH ROW EXECUTE FUNCTION public.client_companion_records_touch();

-- ── 2. 인증서 금고 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_certificate_vaults (
  case_key text PRIMARY KEY CHECK (char_length(case_key) BETWEEN 1 AND 120),
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'shredded')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT case_certificate_vaults_size CHECK (octet_length(data::text) <= 262144)
);
ALTER TABLE public.case_certificate_vaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_certificate_vaults FROM anon, authenticated;

-- 평문 비밀(개인키·비밀번호)이 없는지 확인하고, 접근 기록 칸은 서버가 붙인다
CREATE OR REPLACE FUNCTION public.vault_clean_data(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n jsonb := p_data -> 'npki';
BEGIN
  IF jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'invalid vault' USING ERRCODE = '22023'; END IF;
  IF n IS NOT NULL AND jsonb_typeof(n) = 'object' THEN
    IF coalesce(n ->> 'keyBase64', '') <> '' THEN
      RAISE EXCEPTION 'plaintext private key not allowed' USING ERRCODE = '22023';
    END IF;
    IF coalesce(n ->> 'encVersion', '') <> 'pin-v1' OR coalesce(n ->> 'encryptedKey', '') = '' OR coalesce(n ->> 'pinSalt', '') = '' THEN
      RAISE EXCEPTION 'vault must be sealed with a PIN' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN p_data - 'accessLogs';
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_append_log(p_data jsonb, p_actor text, p_role text, p_action text, p_purpose text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT p_data || jsonb_build_object('accessLogs',
    jsonb_build_array(jsonb_build_object('id', 'srv-' || md5(random()::text || clock_timestamp()::text), 'actorName', left(coalesce(p_actor, ''), 40),
      'actorRole', p_role, 'action', p_action, 'purpose', left(coalesce(p_purpose, ''), 200), 'timestamp', now()))
    || coalesce((SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_data -> 'accessLogs') = 'array' THEN p_data -> 'accessLogs' ELSE '[]'::jsonb END) x LIMIT 99) s), '[]'::jsonb));
$$;

-- 의뢰인: 내 사건에 금고 제출(새로 쓰기). 사무소 = 상담 요청을 맡은 사무소 또는 사건 사무소
CREATE OR REPLACE FUNCTION public.client_save_certificate_vault(p_case_key text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office text;
  v_old jsonb;
  v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT public.client_owns_case_key(p_case_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  v_office := public.client_request_office(p_case_key);
  SELECT data INTO v_old FROM case_certificate_vaults WHERE case_key = p_case_key;
  v := public.vault_clean_data(p_data) || jsonb_build_object('accessLogs', coalesce(v_old -> 'accessLogs', '[]'::jsonb));
  v := public.vault_append_log(v, '의뢰인', 'client', 'submit', '의뢰인이 인증서를 암호화해 제출');
  INSERT INTO case_certificate_vaults (case_key, office_id, client_user_id, data, status, updated_at, updated_by)
  VALUES (p_case_key, v_office, auth.uid(), v, 'active', now(), auth.uid())
  ON CONFLICT (case_key) DO UPDATE SET data = EXCLUDED.data, status = 'active', office_id = coalesce(EXCLUDED.office_id, case_certificate_vaults.office_id),
    client_user_id = EXCLUDED.client_user_id, updated_at = now(), updated_by = auth.uid();
  IF v_office IS NOT NULL THEN
    PERFORM public.notify_office_members(v_office, 'documents.manage', public.crm_client_case_id(v_office, p_case_key), 'cert_vault_submitted',
      '의뢰인이 인증서를 제출했어요', '부채증명서 발급에 쓸 인증서가 금고에 들어왔어요. 여는 데는 의뢰인의 보관 PIN이 필요해요.',
      'case_documents', p_case_key, 'vault:' || p_case_key);
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.client_save_certificate_vault(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_save_certificate_vault(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_certificate_vault(p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.client_owns_case_key(p_case_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  RETURN (SELECT data || jsonb_build_object('status', status) FROM case_certificate_vaults WHERE case_key = p_case_key);
END;
$$;
REVOKE ALL ON FUNCTION public.client_certificate_vault(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_certificate_vault(text) TO authenticated;

-- 사무소: 보기 (열 때마다 기록)
CREATE OR REPLACE FUNCTION public.office_certificate_vault(p_office_id text, p_case_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r case_certificate_vaults;
  v_name text;
BEGIN
  IF NOT public.comm_key_in_office(p_office_id, p_case_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.comm_can(p_office_id, 'documents.manage', p_case_key, NULL, NULL) THEN RAISE EXCEPTION 'permission denied: documents.manage' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM case_certificate_vaults WHERE case_key = p_case_key;
  IF r.case_key IS NULL THEN RETURN NULL; END IF;
  IF r.office_id IS NOT NULL AND r.office_id <> p_office_id THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.office_log(p_office_id, 'cert_vault_view', 'case', p_case_key, '{}'::jsonb);
  RETURN r.data || jsonb_build_object('status', r.status);
END;
$$;
REVOKE ALL ON FUNCTION public.office_certificate_vault(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_certificate_vault(text, text) TO authenticated;

-- 사무소: 의뢰인을 대신해 등록하거나(사무실에서 함께) 사용 기록을 남김
CREATE OR REPLACE FUNCTION public.office_save_certificate_vault(p_office_id text, p_case_key text, p_data jsonb, p_purpose text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old case_certificate_vaults;
  v jsonb;
  v_name text;
BEGIN
  IF NOT public.comm_key_in_office(p_office_id, p_case_key) THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.comm_can(p_office_id, 'documents.manage', p_case_key, NULL, NULL) THEN RAISE EXCEPTION 'permission denied: documents.manage' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_old FROM case_certificate_vaults WHERE case_key = p_case_key;
  IF v_old.case_key IS NOT NULL AND v_old.office_id IS NOT NULL AND v_old.office_id <> p_office_id THEN RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002'; END IF;
  SELECT display_name INTO v_name FROM office_members WHERE office_id = p_office_id AND user_id = auth.uid() AND status = 'active' LIMIT 1;
  v := public.vault_clean_data(p_data) || jsonb_build_object('accessLogs', coalesce(v_old.data -> 'accessLogs', '[]'::jsonb));
  v := public.vault_append_log(v, coalesce(v_name, '사무소'), 'office', 'update', coalesce(nullif(btrim(p_purpose), ''), '사무소가 금고 내용을 바꿈'));
  INSERT INTO case_certificate_vaults (case_key, office_id, client_user_id, data, status, updated_at, updated_by)
  VALUES (p_case_key, p_office_id, public.case_key_client_user(p_case_key), v, 'active', now(), auth.uid())
  ON CONFLICT (case_key) DO UPDATE SET data = EXCLUDED.data, status = 'active', office_id = p_office_id, updated_at = now(), updated_by = auth.uid();
  PERFORM public.office_log(p_office_id, 'cert_vault_update', 'case', p_case_key, jsonb_build_object('purpose', left(coalesce(p_purpose, ''), 100)));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.office_save_certificate_vault(text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_save_certificate_vault(text, text, jsonb, text) TO authenticated;

-- 파기 (의뢰인 또는 사무소). 암호문·인증서를 지우고 파기 기록만 남긴다
CREATE OR REPLACE FUNCTION public.shred_certificate_vault(p_case_key text, p_office_id text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r case_certificate_vaults;
  v jsonb;
  v_is_client boolean := public.client_owns_case_key(p_case_key);
BEGIN
  IF NOT v_is_client THEN
    IF p_office_id IS NULL OR NOT public.comm_key_in_office(p_office_id, p_case_key)
       OR NOT public.comm_can(p_office_id, 'documents.manage', p_case_key, NULL, NULL) THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
  END IF;
  SELECT * INTO r FROM case_certificate_vaults WHERE case_key = p_case_key FOR UPDATE;
  IF r.case_key IS NULL THEN RETURN NULL; END IF;
  IF NOT v_is_client AND r.office_id IS NOT NULL AND r.office_id <> p_office_id THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  v := jsonb_build_object('id', r.data -> 'id', 'clientId', r.data -> 'clientId', 'clientName', r.data -> 'clientName',
                          'accessLogs', coalesce(r.data -> 'accessLogs', '[]'::jsonb), 'shreddedAt', now());
  v := public.vault_append_log(v, CASE WHEN v_is_client THEN '의뢰인' ELSE '사무소' END, CASE WHEN v_is_client THEN 'client' ELSE 'office' END,
                               'revocation', coalesce(nullif(btrim(p_reason), ''), '인증서 파기'));
  UPDATE case_certificate_vaults SET data = v, status = 'shredded', updated_at = now(), updated_by = auth.uid() WHERE case_key = p_case_key;
  IF NOT v_is_client THEN PERFORM public.office_log(p_office_id, 'cert_vault_shred', 'case', p_case_key, '{}'::jsonb); END IF;
  RETURN v || jsonb_build_object('status', 'shredded');
END;
$$;
REVOKE ALL ON FUNCTION public.shred_certificate_vault(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shred_certificate_vault(text, text, text) TO authenticated;

-- 사건 파기 때 금고도 지운다 (purge_one_case 이후 키가 남지 않게)
CREATE OR REPLACE FUNCTION public.trg_case_purged_vault()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.purged_at IS NOT NULL AND OLD.purged_at IS NULL THEN
    DELETE FROM case_certificate_vaults WHERE case_key = 'case-' || NEW.id::text OR (NEW.consult_request_id IS NOT NULL AND case_key = NEW.consult_request_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_case_purged_vault ON public.cases;
CREATE TRIGGER trg_case_purged_vault AFTER UPDATE OF purged_at ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_purged_vault();
