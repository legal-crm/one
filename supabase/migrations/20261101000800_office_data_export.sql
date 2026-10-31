-- ============================================================
-- ST-13 사무소 데이터 내보내기 (대표만)
--  * office_data_export(office, encrypted): 사무소 업무 표를 jsonb로 돌려준다. 파일 본문은 넣지 않고 정보만.
--    비밀값(기기 토큰 해시·접수 키 해시·팀 채널·초대 토큰·소금값)과 의뢰인 인증서 금고는 넣지 않는다.
--  * 브라우저가 암호(AES-GCM)를 걸어 내려받는다. 암호 없이 받으면 encrypted=false로 기록된다.
--  * 한 표 최대 20,000줄, 넘으면 truncated 표시
-- ============================================================
CREATE OR REPLACE FUNCTION public.office_data_export(p_office_id text, p_encrypted boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tables text[] := ARRAY[
    'office_members', 'office_custom_roles', 'office_settings', 'office_document_templates', 'office_court_overrides',
    'office_debt_agencies', 'office_billing_profiles', 'comm_templates',
    'office_clients', 'cases', 'case_events', 'case_bankruptcy_details', 'case_exhibits', 'case_files', 'case_form_drafts',
    'case_plan_payments', 'crm_clients', 'client_contacts', 'client_comm_logs', 'call_recordings', 'client_form_requests',
    'correction_orders', 'correction_items', 'correction_item_library', 'correction_precedents',
    'debt_certificates', 'debt_agency_orders',
    'fee_agreements', 'fee_installments', 'fee_payments', 'fee_client_reports', 'fee_schedule_changes',
    'fee_case_accounts', 'fee_office_accounts', 'fee_reminder_settings',
    'sales_leads', 'ad_orders', 'ad_order_requests', 'office_audit_logs'
  ];
  t text;
  v_out jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_truncated text[] := '{}';
  n integer;
  v_limit integer := 20000;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_members m WHERE m.office_id = p_office_id AND m.user_id = auth.uid() AND m.role = 'owner' AND m.status = 'active') THEN
    RAISE EXCEPTION 'permission denied: owner only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege'; END IF;

  FOREACH t IN ARRAY v_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = 'office_id') THEN CONTINUE; END IF;
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) FROM (SELECT * FROM public.%I WHERE office_id = $1 LIMIT %s) x', t, v_limit + 1)
      INTO v_rows, n USING p_office_id;
    IF n > v_limit THEN
      v_rows := (SELECT jsonb_agg(e) FROM (SELECT e FROM jsonb_array_elements(v_rows) WITH ORDINALITY a(e, i) WHERE i <= v_limit) s);
      v_truncated := array_append(v_truncated, t);
      n := v_limit;
    END IF;
    v_out := v_out || jsonb_build_object(t, v_rows);
    v_counts := v_counts || jsonb_build_object(t, n);
  END LOOP;

  -- 사무소 기본 정보 (소금값 제외)
  v_out := v_out || jsonb_build_object('offices', (SELECT coalesce(jsonb_agg(to_jsonb(o) - 'device_hash_salt' - 'hash_salt'), '[]'::jsonb) FROM offices o WHERE o.id = p_office_id));
  -- 기기는 이름·상태만
  v_out := v_out || jsonb_build_object('office_devices', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', j ->> 'id', 'label', j ->> 'label', 'status', j ->> 'status', 'created_at', j ->> 'created_at')), '[]'::jsonb)
    FROM (SELECT to_jsonb(d) AS j FROM office_devices d WHERE d.office_id = p_office_id) s));

  PERFORM public.office_log(p_office_id, 'office.export', 'office', p_office_id,
    jsonb_build_object('encrypted', coalesce(p_encrypted, false), 'counts', v_counts, 'truncated', to_jsonb(v_truncated)));

  RETURN jsonb_build_object(
    'format', 'mykim-office-backup', 'version', 1, 'office_id', p_office_id, 'exported_at', now(),
    'counts', v_counts, 'truncated', to_jsonb(v_truncated),
    'note', '파일 본문(서류·녹음·도장 이미지)은 들어 있지 않아요. 파일 정보만 있어요.',
    'tables', v_out);
END;
$$;
REVOKE ALL ON FUNCTION public.office_data_export(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_data_export(text, boolean) TO authenticated;
