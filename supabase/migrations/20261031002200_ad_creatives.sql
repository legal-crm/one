-- ============================================================
-- AD-5·AD-8·AD-9·AD-10 광고 소재·심사·노출 연결·알림·노출 집계, CT-5 홈 슬라이드
-- 이전: 소재를 올릴 곳이 없었고(통합어드민 '프리미엄 광고'는 저장 안 되는 화면), 판 광고가 고객 홈에 나오지 않았으며,
--       노출 수를 셀 곳도 없었다.
-- 원칙: 승인된 소재만 공개(저장소 읽기 정책도 승인본만), 메인 배너는 승인 소재가 있어야 노출 시작,
--       노출 집계는 광고별 하루 숫자만(방문자 개인 정보·IP 저장 안 함), 상담 요청 수는 세지 않음(건당 과금 오해 방지).
-- ============================================================

-- 1) 소재 저장소 (비공개 버킷 + 승인본만 읽기) ------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-media', 'ad-media', false, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  lawyer_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('banner', 'card')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested', 'retired')),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 1 AND 40),
  subline text CHECK (subline IS NULL OR char_length(subline) <= 80),
  alt_text text NOT NULL CHECK (char_length(alt_text) BETWEEN 1 AND 120),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 3),
  image_path text NOT NULL,
  mobile_image_path text,
  warnings text[] NOT NULL DEFAULT '{}',
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  replaces_id uuid REFERENCES public.ad_creatives(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_creatives_office_idx ON public.ad_creatives (office_id, status);
CREATE INDEX IF NOT EXISTS ad_creatives_status_idx ON public.ad_creatives (status, created_at);

ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_creatives FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
DROP POLICY IF EXISTS ad_creatives_read ON public.ad_creatives;
CREATE POLICY ad_creatives_read ON public.ad_creatives FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.has_office_permission(office_id, 'ads.manage') OR public.has_office_permission(office_id, 'billing.view'));

-- 저장소 정책: 사무소(광고 구매 권한)만 자기 폴더에 올리기, 읽기는 사무소·관리자·승인본(누구나)
DROP POLICY IF EXISTS ad_media_office_insert ON storage.objects;
CREATE POLICY ad_media_office_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-media' AND public.has_office_permission((storage.foldername(name))[1], 'ads.manage'));
DROP POLICY IF EXISTS ad_media_office_read ON storage.objects;
CREATE POLICY ad_media_office_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-media' AND (public.is_platform_admin()
    OR public.has_office_permission((storage.foldername(name))[1], 'ads.manage')
    OR public.has_office_permission((storage.foldername(name))[1], 'billing.view')));

CREATE OR REPLACE FUNCTION public.ad_media_is_approved(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM ad_creatives c WHERE c.status = 'approved' AND p_name IN (c.image_path, c.mobile_image_path));
$$;
REVOKE ALL ON FUNCTION public.ad_media_is_approved(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ad_media_is_approved(text) TO anon, authenticated;
DROP POLICY IF EXISTS ad_media_public_read ON storage.objects;
CREATE POLICY ad_media_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ad-media' AND public.ad_media_is_approved(name));

-- 2) 주문 ↔ 소재 ------------------------------------------------------------------
ALTER TABLE public.ad_orders ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES public.ad_creatives(id) ON DELETE SET NULL;

-- 금지 표현 검사 (경고만, 막지 않음 — 관리자 심사로 넘긴다). 목록은 앱 copy 검사와 같은 뜻으로 유지
CREATE OR REPLACE FUNCTION public.ad_copy_warnings(p_text text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text[] := '{}';
  t text := coalesce(p_text, '');
BEGIN
  IF t ~ '(100|백)\s*%|보장|확실|무조건' THEN v := array_append(v, '결과를 보장하는 표현'); END IF;
  IF t ~ '성공률|인가율|면책률|승소율|[0-9]+\s*건\s*(수임|처리|해결)|누적' THEN v := array_append(v, '성공률·처리 건수 같은 실적 수치'); END IF;
  IF t ~ '최고|최초|1위|넘버원|No\.?\s*1|유일' THEN v := array_append(v, '최상급·비교 표현'); END IF;
  IF t ~ '전담|추천|배정|매칭' THEN v := array_append(v, '전담·추천·배정·매칭 표현'); END IF;
  IF t ~ '무료\s*상담|공짜' THEN v := array_append(v, '무료 상담 표현'); END IF;
  IF t ~ '탕감|감면율|변제율\s*[0-9]' THEN v := array_append(v, '탕감·감면율 표현'); END IF;
  RETURN v;
END;
$$;

-- 소재 등록 (새 소재 또는 승인된 소재 고치기 = 새 버전, 승인될 때까지 이전 소재로 노출)
CREATE OR REPLACE FUNCTION public.submit_ad_creative(p_office_id text, p jsonb)
RETURNS public.ad_creatives
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v ad_creatives%ROWTYPE;
  v_old ad_creatives%ROWTYPE;
  v_lawyer text := nullif(btrim(coalesce(p ->> 'lawyer_id', '')), '');
  v_img text := nullif(btrim(coalesce(p ->> 'image_path', '')), '');
  v_mimg text := nullif(btrim(coalesce(p ->> 'mobile_image_path', '')), '');
  v_tags text[];
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'ads.manage') OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = '42501';
  END IF;
  IF v_lawyer IS NULL OR NOT EXISTS (SELECT 1 FROM office_members m WHERE m.office_id = p_office_id AND m.lawyer_id = v_lawyer AND m.status = 'active') THEN
    RAISE EXCEPTION 'lawyer is not a member of this office' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p ->> 'kind', '') NOT IN ('banner', 'card') THEN RAISE EXCEPTION 'invalid creative kind' USING ERRCODE = '22023'; END IF;
  IF v_img IS NULL OR split_part(v_img, '/', 1) <> p_office_id OR (v_mimg IS NOT NULL AND split_part(v_mimg, '/', 1) <> p_office_id) THEN
    RAISE EXCEPTION 'image must be uploaded to this office folder' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'ad-media' AND o.name = v_img) THEN
    RAISE EXCEPTION 'image not uploaded' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(left(btrim(x), 12)) FILTER (WHERE btrim(x) <> ''), '{}') INTO v_tags
  FROM (SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(p -> 'tags') = 'array' THEN p -> 'tags' ELSE '[]'::jsonb END) x LIMIT 3) s;

  IF nullif(p ->> 'replaces_id', '') IS NOT NULL THEN
    SELECT * INTO v_old FROM ad_creatives WHERE id = (p ->> 'replaces_id')::uuid AND office_id = p_office_id;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'creative not found' USING ERRCODE = 'P0002'; END IF;
    -- 심사 중인 새 버전이 이미 있으면 그것을 대신한다
    UPDATE ad_creatives SET status = 'retired', updated_at = now() WHERE replaces_id = v_old.id AND status IN ('pending', 'changes_requested');
  END IF;

  INSERT INTO ad_creatives (office_id, lawyer_id, kind, headline, subline, alt_text, tags, image_path, mobile_image_path, warnings, replaces_id)
  VALUES (p_office_id, v_lawyer, p ->> 'kind', left(btrim(coalesce(p ->> 'headline', '')), 40),
          nullif(left(btrim(coalesce(p ->> 'subline', '')), 80), ''), left(btrim(coalesce(p ->> 'alt_text', '')), 120),
          v_tags, v_img, v_mimg,
          public.ad_copy_warnings(coalesce(p ->> 'headline', '') || ' ' || coalesce(p ->> 'subline', '') || ' ' || array_to_string(v_tags, ' ')),
          v_old.id)
  RETURNING * INTO v;
  PERFORM public.office_log(p_office_id, 'ad_creative_submit', 'ad_creative', v.id::text, jsonb_build_object('kind', v.kind, 'warnings', to_jsonb(v.warnings)));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_ad_creative(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_ad_creative(text, jsonb) TO authenticated;

-- 주문에 소재 연결 (메인 배너 = 배너 소재, 그 밖 = 카드 소재)
CREATE OR REPLACE FUNCTION public.set_ad_order_creative(p_order_id text, p_creative_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o ad_orders%ROWTYPE;
  c ad_creatives%ROWTYPE;
BEGIN
  SELECT * INTO o FROM ad_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR o.office_id IS NULL OR NOT public.has_office_permission(o.office_id, 'ads.manage') THEN
    RAISE EXCEPTION 'permission denied: ads.manage' USING ERRCODE = '42501';
  END IF;
  IF o.status NOT IN ('pending', 'paid', 'active') THEN RAISE EXCEPTION 'order already closed' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO c FROM ad_creatives WHERE id = p_creative_id;
  IF c.id IS NULL OR c.office_id <> o.office_id OR c.lawyer_id <> o.lawyer_id THEN
    RAISE EXCEPTION 'creative does not belong to this order' USING ERRCODE = '22023';
  END IF;
  IF c.status IN ('rejected', 'retired') THEN RAISE EXCEPTION 'creative not usable' USING ERRCODE = '22023'; END IF;
  IF (o.placement = 'main_banner') <> (c.kind = 'banner') THEN RAISE EXCEPTION 'creative kind does not match placement' USING ERRCODE = '22023'; END IF;
  UPDATE ad_orders SET creative_id = c.id, updated_at = now() WHERE id = p_order_id;
  RETURN (SELECT to_jsonb(x) FROM ad_orders x WHERE x.id = p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.set_ad_order_creative(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ad_order_creative(text, uuid) TO authenticated;

-- 이 주문이 노출을 시작할 수 있는지: 메인 배너는 승인된 배너 소재가 있어야 한다
CREATE OR REPLACE FUNCTION public.ad_order_ready(o public.ad_orders)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.placement IS DISTINCT FROM 'main_banner'
      OR EXISTS (SELECT 1 FROM ad_creatives c WHERE c.id = o.creative_id AND c.status = 'approved')
      OR EXISTS (SELECT 1 FROM ad_creatives c JOIN ad_creatives n ON n.replaces_id = c.id
                 WHERE n.id = o.creative_id AND c.status = 'approved');
$$;

-- 관리자 심사: approve / reject(사유) / changes(수정 요청, 사유)
CREATE OR REPLACE FUNCTION public.admin_review_ad_creative(p_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS public.ad_creatives
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c ad_creatives%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM ad_creatives WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'creative not found' USING ERRCODE = 'P0002'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'creative is not waiting for review' USING ERRCODE = '22023'; END IF;
  IF p_action NOT IN ('approve', 'reject', 'changes') THEN RAISE EXCEPTION 'unknown action' USING ERRCODE = '22023'; END IF;
  IF p_action IN ('reject', 'changes') AND coalesce(btrim(p_note), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;

  UPDATE ad_creatives SET
    status = CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'changes_requested' END,
    review_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_id RETURNING * INTO c;

  IF p_action = 'approve' AND c.replaces_id IS NOT NULL THEN
    -- 고친 소재가 승인되면 이전 소재를 내리고, 이전 소재를 쓰던 주문을 새 소재로 옮긴다
    UPDATE ad_orders SET creative_id = c.id, updated_at = now() WHERE creative_id = c.replaces_id AND status IN ('pending', 'paid', 'active');
    UPDATE ad_creatives SET status = 'retired', updated_at = now() WHERE id = c.replaces_id AND status = 'approved';
  END IF;

  PERFORM public.admin_record_action('ad_creative_' || p_action, 'ad_creative', c.id::text,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', c.status, 'office_id', c.office_id), p_note);
  PERFORM public.notify_office_members(c.office_id, 'ads.manage', NULL, 'ad_creative_review',
    CASE p_action WHEN 'approve' THEN '광고 소재가 승인됐어요' WHEN 'reject' THEN '광고 소재가 반려됐어요' ELSE '광고 소재 수정이 필요해요' END,
    c.headline || CASE WHEN p_action <> 'approve' THEN ': ' || left(btrim(p_note), 120) ELSE '' END,
    'ads', c.id::text, 'ad_creative:' || c.id);

  -- 승인으로 노출 준비가 된 주문은 바로 시작
  IF p_action = 'approve' THEN PERFORM public.run_ad_order_lifecycle(); END IF;
  RETURN c;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_ad_creative(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_ad_creative(uuid, text, text) TO authenticated;

-- 3) 생애 주기·입금 확인: 메인 배너는 승인 소재가 있어야 시작 (함수 몸통 교체, 이름·인자 그대로)
CREATE OR REPLACE FUNCTION public.run_ad_order_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.seoul_today();
  v_cancelled integer;
  v_started integer;
  v_expired integer;
  r record;
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.ad_orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = '입금 기한(3영업일) 지남', updated_at = now()
  WHERE status = 'pending' AND reserved_until IS NOT NULL AND reserved_until <= now();
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.ad_orders o SET status = 'active', activated_at = coalesce(activated_at, now()), updated_at = now()
  WHERE o.status = 'paid' AND o.starts_on IS NOT NULL AND o.starts_on <= v_today AND (o.ends_on IS NULL OR o.ends_on > v_today)
    AND public.ad_order_ready(o);
  GET DIAGNOSTICS v_started = ROW_COUNT;

  UPDATE public.ad_orders SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'paid') AND ends_on IS NOT NULL AND ends_on <= v_today;
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- 안내: 입금 기한 하루 전, 만료 7일·1일 전, 소재 없어 시작 못 한 메인 배너
  FOR r IN SELECT * FROM public.ad_orders WHERE office_id IS NOT NULL AND (
      (status = 'pending' AND (reserved_until AT TIME ZONE 'Asia/Seoul')::date = v_today + 1)
      OR (status = 'active' AND ends_on IN (v_today + 7, v_today + 1))
      OR (status = 'paid' AND starts_on <= v_today AND NOT public.ad_order_ready(ad_orders)))
  LOOP
    PERFORM public.notify_office_members(r.office_id, 'ads.manage', NULL,
      CASE WHEN r.status = 'pending' THEN 'ad_payment_due' WHEN r.status = 'active' THEN 'ad_expiring' ELSE 'ad_creative_needed' END,
      CASE WHEN r.status = 'pending' THEN '광고비 입금 기한이 내일이에요'
           WHEN r.status = 'active' THEN '광고 기간이 곧 끝나요'
           ELSE '광고 소재 승인이 필요해요' END,
      r.product_name || CASE WHEN r.status = 'pending' THEN ' · 입금액 ' || to_char(coalesce(r.total_amount, r.total_price), 'FM999,999,999') || '원'
                             WHEN r.status = 'active' THEN ' · ' || to_char(r.ends_on - 1, 'MM/DD') || '까지 노출. 연장은 광고·결제에서 신청해요.'
                             ELSE ' · 승인된 배너 소재가 있어야 노출이 시작돼요.' END,
      'ads', r.id, 'ad_notice:' || r.id || ':' || r.status || ':' || v_today);
  END LOOP;

  PERFORM public.sync_lawyer_ad_tiers();
  RETURN jsonb_build_object('cancelled', v_cancelled, 'started', v_started, 'expired', v_expired);
END;
$$;
REVOKE ALL ON FUNCTION public.run_ad_order_lifecycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_ad_order_lifecycle() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_confirm_ad_payment(p_order_id text, p_paid_on date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.ad_orders%ROWTYPE;
  v_today date := public.seoul_today();
  v_start date;
  v_end date;
  v_ready boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v FROM public.ad_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending orders can be confirmed' USING ERRCODE = 'check_violation';
  END IF;
  v_start := greatest(coalesce(v.starts_on, v_today), v_today);
  v_end := (v_start + make_interval(months => v.contract_months))::date;
  IF public.ad_slots_taken(v.product_id, v.region, v_start, v_end, v.id) >=
     (SELECT max_slots FROM public.ad_products WHERE id = v.product_id) THEN
    RAISE EXCEPTION 'no ad slots available' USING ERRCODE = 'check_violation';
  END IF;
  v_ready := public.ad_order_ready(v);
  UPDATE public.ad_orders SET
    status = CASE WHEN v_start <= v_today AND v_ready THEN 'active' ELSE 'paid' END,
    paid_at = coalesce(p_paid_on::timestamptz, now()),
    activated_at = CASE WHEN v_start <= v_today AND v_ready THEN now() ELSE NULL END,
    starts_on = v_start,
    ends_on = v_end,
    expires_at = (v_end::timestamp AT TIME ZONE 'Asia/Seoul'),
    reserved_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.sync_lawyer_ad_tiers();
  RETURN (SELECT to_jsonb(o) FROM public.ad_orders o WHERE o.id = p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_confirm_ad_payment(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_ad_payment(text, date) TO authenticated;

-- 4) 주문 상태 바뀔 때 사무소 알림 (AD-9) -------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_ad_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.office_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_office_members(NEW.office_id, 'ads.manage', NULL, 'ad_order_created', '광고를 신청했어요',
      NEW.product_name || ' · 입금액 ' || to_char(coalesce(NEW.total_amount, NEW.total_price), 'FM999,999,999') || '원 · 3영업일 안에 입금해 주세요.',
      'ads', NEW.id, 'ad_order:' || NEW.id || ':pending');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_office_members(NEW.office_id, 'ads.manage', NULL, 'ad_order_' || NEW.status,
      CASE NEW.status WHEN 'paid' THEN '광고비 입금이 확인됐어요' WHEN 'active' THEN '광고 노출이 시작됐어요'
                      WHEN 'expired' THEN '광고 기간이 끝났어요' WHEN 'cancelled' THEN '광고 주문이 취소됐어요' ELSE '광고 주문 상태가 바뀌었어요' END,
      NEW.product_name || CASE WHEN NEW.status = 'cancelled' AND NEW.cancel_reason IS NOT NULL THEN ' · ' || left(NEW.cancel_reason, 100)
                               WHEN NEW.status = 'paid' THEN ' · ' || to_char(NEW.starts_on, 'MM/DD') || '부터 노출 예정(메인 배너는 소재 승인 후)'
                               ELSE '' END,
      'ads', NEW.id, 'ad_order:' || NEW.id || ':' || NEW.status);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ad order notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_ad_order ON public.ad_orders;
CREATE TRIGGER trg_notify_ad_order AFTER INSERT OR UPDATE OF status ON public.ad_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_ad_order();

-- 5) 고객 홈 슬라이드용 광고 (승인 소재·광고책임 변호사·사무소명, 금액 없음) ------
CREATE OR REPLACE FUNCTION public.public_home_ad_slides()
RETURNS TABLE (order_id text, lawyer_id text, lawyer_name text, office_name text, headline text, subline text, alt_text text,
               image_path text, mobile_image_path text, tags text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.lawyer_id, coalesce(l.name, o.lawyer_name), ofc.name, c.headline, c.subline, c.alt_text, c.image_path, c.mobile_image_path, c.tags
  FROM public.ad_orders o
  JOIN public.ad_creatives c ON c.id = (
    CASE WHEN EXISTS (SELECT 1 FROM ad_creatives x WHERE x.id = o.creative_id AND x.status = 'approved') THEN o.creative_id
         ELSE (SELECT p.id FROM ad_creatives n JOIN ad_creatives p ON p.id = n.replaces_id WHERE n.id = o.creative_id AND p.status = 'approved') END)
  LEFT JOIN public.lawyers l ON l.id = o.lawyer_id
  LEFT JOIN public.offices ofc ON ofc.id = o.office_id
  WHERE o.status = 'active' AND o.placement = 'main_banner'
    AND o.starts_on <= public.seoul_today() AND o.ends_on > public.seoul_today();
$$;
GRANT EXECUTE ON FUNCTION public.public_home_ad_slides() TO anon, authenticated;

-- 6) 노출 집계 (AD-10): 광고별 하루 노출·프로필 열기 숫자만 -------------------------
CREATE TABLE IF NOT EXISTS public.ad_daily_stats (
  order_id text NOT NULL REFERENCES public.ad_orders(id) ON DELETE CASCADE,
  day date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  profile_opens integer NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, day)
);
ALTER TABLE public.ad_daily_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_daily_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ad_daily_stats TO service_role;

-- 화면이 한 번에 모아 보낸다 [{order_id, kind}] (최대 30개). 노출 중인 주문만 센다
CREATE OR REPLACE FUNCTION public.record_ad_events(p_events jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e jsonb;
  n integer := 0;
  v_day date := public.seoul_today();
BEGIN
  IF jsonb_typeof(p_events) <> 'array' THEN RETURN 0; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_events) LIMIT 30 LOOP
    IF coalesce(e ->> 'kind', '') NOT IN ('impression', 'profile_open') THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM ad_orders o WHERE o.id = e ->> 'order_id' AND o.status = 'active') THEN CONTINUE; END IF;
    INSERT INTO ad_daily_stats (order_id, day, impressions, profile_opens)
    VALUES (e ->> 'order_id', v_day, CASE WHEN e ->> 'kind' = 'impression' THEN 1 ELSE 0 END, CASE WHEN e ->> 'kind' = 'profile_open' THEN 1 ELSE 0 END)
    ON CONFLICT (order_id, day) DO UPDATE SET
      impressions = ad_daily_stats.impressions + EXCLUDED.impressions,
      profile_opens = ad_daily_stats.profile_opens + EXCLUDED.profile_opens;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ad_events(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ad_events(jsonb) TO anon, authenticated;

-- 사무소: 주문별 합계 (최근 90일)
CREATE OR REPLACE FUNCTION public.office_ad_stats(p_office_id text)
RETURNS TABLE (order_id text, impressions bigint, profile_opens bigint, last_day date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.order_id, sum(s.impressions), sum(s.profile_opens), max(s.day)
  FROM ad_daily_stats s JOIN ad_orders o ON o.id = s.order_id
  WHERE o.office_id = p_office_id AND s.day > public.seoul_today() - 90
    AND (public.has_office_permission(p_office_id, 'ads.manage') OR public.has_office_permission(p_office_id, 'billing.view') OR public.is_platform_admin())
  GROUP BY s.order_id;
$$;
REVOKE ALL ON FUNCTION public.office_ad_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_ad_stats(text) TO authenticated;

-- 관리자: 구좌 현황 (상품·지역별 노출 중·시작 예정·입금 대기)
CREATE OR REPLACE FUNCTION public.admin_ad_slot_board()
RETURNS TABLE (product_id text, product_name text, region text, max_slots integer, active integer, scheduled integer, pending integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.name, o.region, p.max_slots,
         count(*) FILTER (WHERE o.status = 'active')::integer,
         count(*) FILTER (WHERE o.status = 'paid')::integer,
         count(*) FILTER (WHERE o.status = 'pending' AND o.reserved_until > now())::integer
  FROM ad_products p LEFT JOIN ad_orders o ON o.product_id = p.id AND o.status IN ('active', 'paid', 'pending')
  GROUP BY p.id, p.name, o.region, p.max_slots, p.sort_order
  ORDER BY p.sort_order, o.region NULLS FIRST;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_ad_slot_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ad_slot_board() TO authenticated;
