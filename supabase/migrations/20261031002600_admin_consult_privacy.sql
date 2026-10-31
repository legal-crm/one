-- ============================================================
-- OP-5·OP-7 관리자 상담 관제 = 운영 정보만, 신고함 (변호사법 제26조·011 제로날리지 원칙)
-- 문제: strict_* 정책이 관리자에게 consult_requests 전체(실명·전화·재무·본문)를 열어 두었고,
--       관리자 화면이 그 원문을 받아 브라우저에 저장했다.
-- 바꾼 것:
--  * consult_requests 직접 읽기·쓰기에서 관리자를 뺀다 (의뢰인 본인만, 사무소는 기존 뷰·함수)
--  * admin_consult_overview(): 가명·상태·요청한 변호사 수·자리 상태·제안서/메시지 건수·마지막 활동·신고 수·유입 출처만
--  * consult_reports: 의뢰인·사무소가 스팸·부적절 신고, 관리자 처리(사유)
--  * admin_open_consult_detail(): 열린 신고가 있는 요청만, 사유를 남기고 본문·최근 메시지 30개 열람 (admin_actions 기록)
-- 숨김·상태 변경은 기존 서버 함수(admin_set_consult_hidden·admin_set_consult_status)를 그대로 쓴다.
-- ============================================================

DROP POLICY IF EXISTS strict_select_consult_requests ON public.consult_requests;
CREATE POLICY strict_select_consult_requests ON public.consult_requests FOR SELECT TO authenticated
  USING ((auth.uid())::text = client_id);
DROP POLICY IF EXISTS strict_insert_consult_requests ON public.consult_requests;
CREATE POLICY strict_insert_consult_requests ON public.consult_requests FOR INSERT TO authenticated
  WITH CHECK ((auth.uid())::text = client_id);
DROP POLICY IF EXISTS strict_update_consult_requests ON public.consult_requests;
CREATE POLICY strict_update_consult_requests ON public.consult_requests FOR UPDATE TO authenticated
  USING ((auth.uid())::text = client_id) WITH CHECK ((auth.uid())::text = client_id);
DROP POLICY IF EXISTS strict_delete_consult_requests ON public.consult_requests;
CREATE POLICY strict_delete_consult_requests ON public.consult_requests FOR DELETE TO authenticated
  USING ((auth.uid())::text = client_id);

-- ── 신고함 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consult_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consult_request_id text NOT NULL REFERENCES public.consult_requests(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL DEFAULT auth.uid(),
  reporter_role text NOT NULL CHECK (reporter_role IN ('client', 'office')),
  reporter_office_id text,
  category text NOT NULL CHECK (category IN ('spam', 'abuse', 'fraud', 'privacy', 'other')),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution text CHECK (resolution IS NULL OR char_length(resolution) <= 500),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consult_reports_status_idx ON public.consult_reports (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS consult_reports_open_uq ON public.consult_reports (consult_request_id, reporter_user_id) WHERE status = 'open';
ALTER TABLE public.consult_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consult_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.consult_reports TO authenticated;
GRANT ALL ON public.consult_reports TO service_role;
DROP POLICY IF EXISTS consult_reports_read ON public.consult_reports;
CREATE POLICY consult_reports_read ON public.consult_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.report_consult_request(p_request_id text, p_category text, p_detail text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r consult_requests%ROWTYPE;
  v_role text;
  v_office text;
  v_lid text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM consult_requests WHERE id = p_request_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF r.client_id = auth.uid()::text THEN
    v_role := 'client';
  ELSE
    v_lid := public.request_viewer_lawyer_id(r, 'consult.view');
    IF v_lid IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
    v_role := 'office';
    v_office := public.lawyer_office_id(v_lid);
  END IF;
  IF p_category NOT IN ('spam', 'abuse', 'fraud', 'privacy', 'other') THEN RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM consult_reports WHERE reporter_user_id = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'too many reports' USING ERRCODE = '22023';
  END IF;
  INSERT INTO consult_reports (consult_request_id, reporter_role, reporter_office_id, category, detail)
  VALUES (p_request_id, v_role, v_office, p_category, nullif(left(btrim(coalesce(p_detail, '')), 1000), ''))
  ON CONFLICT (consult_request_id, reporter_user_id) WHERE status = 'open'
  DO UPDATE SET category = EXCLUDED.category, detail = coalesce(EXCLUDED.detail, consult_reports.detail)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.report_consult_request(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_consult_request(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_consult_report(p_id uuid, p_decision text, p_resolution text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v consult_reports%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('resolved', 'dismissed') THEN RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023'; END IF;
  IF coalesce(btrim(p_resolution), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM consult_reports WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'report not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE consult_reports SET status = p_decision, resolution = left(btrim(p_resolution), 500), resolved_by = auth.uid(), resolved_at = now() WHERE id = p_id;
  PERFORM public.admin_record_action('consult_report.' || p_decision, 'consult_request', v.consult_request_id,
    jsonb_build_object('status', v.status, 'category', v.category), jsonb_build_object('status', p_decision), p_resolution);
  PERFORM public.notify_user(v.reporter_user_id, CASE WHEN v.reporter_role = 'client' THEN 'client' ELSE 'office' END, v.reporter_office_id,
    'consult_report_done', '신고를 처리했어요', CASE WHEN p_decision = 'resolved' THEN '신고 내용을 확인해 조치했어요.' ELSE '확인했지만 조치할 내용이 없었어요.' END,
    'consult_request', v.consult_request_id, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_consult_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_consult_report(uuid, text, text) TO authenticated;

-- ── 관리자 상담 관제 (운영 정보만) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_consult_overview(p_status text DEFAULT NULL, p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rows jsonb;
  v_total bigint;
  v_counts jsonb;
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  WITH base AS (
    SELECT r.* FROM consult_requests r
    WHERE (p_status IS NULL OR p_status = '' OR (p_status = 'hidden' AND r.admin_hidden) OR (p_status <> 'hidden' AND r.status = p_status AND NOT r.admin_hidden))
      AND (v_q IS NULL OR r.id ILIKE '%' || v_q || '%' OR r.client_name ILIKE '%' || v_q || '%')
  )
  SELECT (SELECT count(*) FROM base),
         coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
           SELECT jsonb_build_object(
             'id', b.id,
             'alias', public.consult_request_alias(b),
             'status', b.status,
             'admin_hidden', b.admin_hidden,
             'admin_hidden_reason', b.admin_hidden_reason,
             'created_at', b.created_at,
             'updated_at', b.updated_at,
             'lawyer_count', CASE WHEN jsonb_typeof(b.selected_lawyer_ids) = 'array' THEN jsonb_array_length(b.selected_lawyer_ids) ELSE 0 END,
             'proposal_count', CASE WHEN jsonb_typeof(b.proposals) = 'array' THEN jsonb_array_length(b.proposals) ELSE 0 END,
             'message_count', (SELECT count(*) FROM consult_messages m WHERE m.consult_request_id = b.id),
             'last_message_at', (SELECT max(m.created_at) FROM consult_messages m WHERE m.consult_request_id = b.id),
             'seats', (SELECT coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) FROM (
                         SELECT l.status, count(*) n FROM consult_request_lawyers l WHERE l.request_id = b.id GROUP BY l.status) s),
             'overdue_seats', (SELECT count(*) FROM consult_request_lawyers l WHERE l.request_id = b.id AND l.status = 'requested' AND l.respond_by < now()),
             'open_reports', (SELECT count(*) FROM consult_reports c WHERE c.consult_request_id = b.id AND c.status = 'open'),
             'source', coalesce(b.first_touch ->> 'source', CASE WHEN b.first_touch ? 'referrer' THEN 'ref:' || (b.first_touch ->> 'referrer') END),
             'has_summary', b.financial_profile IS NOT NULL AND b.financial_profile <> '{}'::jsonb
           ) AS x
           FROM base b ORDER BY b.created_at DESC
           LIMIT greatest(1, least(coalesce(p_limit, 50), 200)) OFFSET greatest(0, coalesce(p_offset, 0))
         ) t), '[]'::jsonb)
    INTO v_total, v_rows;
  SELECT jsonb_build_object(
    'all', count(*),
    'requested', count(*) FILTER (WHERE status = 'requested' AND NOT admin_hidden),
    'responding', count(*) FILTER (WHERE status = 'responding' AND NOT admin_hidden),
    'comparing', count(*) FILTER (WHERE status = 'comparing' AND NOT admin_hidden),
    'counseling', count(*) FILTER (WHERE status = 'counseling' AND NOT admin_hidden),
    'contracted', count(*) FILTER (WHERE status = 'contracted' AND NOT admin_hidden),
    'closed', count(*) FILTER (WHERE status IN ('closed', 'cancelled') AND NOT admin_hidden),
    'hidden', count(*) FILTER (WHERE admin_hidden),
    'open_reports', (SELECT count(*) FROM consult_reports WHERE status = 'open'))
    INTO v_counts FROM consult_requests;
  RETURN jsonb_build_object('total', v_total, 'rows', v_rows, 'counts', v_counts);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_consult_overview(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_consult_overview(text, text, integer, integer) TO authenticated;

-- 열린 신고 목록 (가명·분류·신고자 구분만)
CREATE OR REPLACE FUNCTION public.admin_list_consult_reports(p_status text DEFAULT 'open')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'consult_request_id', c.consult_request_id, 'alias', public.consult_request_alias(r),
      'reporter_role', c.reporter_role, 'category', c.category, 'detail', c.detail, 'status', c.status,
      'resolution', c.resolution, 'created_at', c.created_at, 'resolved_at', c.resolved_at) ORDER BY c.created_at DESC)
    FROM consult_reports c JOIN consult_requests r ON r.id = c.consult_request_id
    WHERE p_status IS NULL OR c.status = p_status), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_consult_reports(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_consult_reports(text) TO authenticated;

-- 신고 검토용 원문 열람 (열린 신고가 있을 때만, 사유 필수, 기록). 연락처·재무 정보는 주지 않는다.
CREATE OR REPLACE FUNCTION public.admin_open_consult_detail(p_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r consult_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM consult_requests WHERE id = p_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM consult_reports c WHERE c.consult_request_id = p_id AND c.status = 'open') THEN
    RAISE EXCEPTION 'original text is available only for open reports' USING ERRCODE = '42501';
  END IF;
  PERFORM public.admin_record_action('consult.open_detail', 'consult_request', p_id, NULL, NULL, p_reason);
  RETURN jsonb_build_object(
    'alias', public.consult_request_alias(r),
    'title', r.title,
    'content', left(r.content, 4000),
    'messages', coalesce((SELECT jsonb_agg(jsonb_build_object('sender_type', m.sender_type, 'message', left(m.message, 1000), 'created_at', m.created_at) ORDER BY m.created_at)
                          FROM (SELECT * FROM consult_messages WHERE consult_request_id = p_id ORDER BY created_at DESC LIMIT 30) m), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_open_consult_detail(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_consult_detail(text, text) TO authenticated;
