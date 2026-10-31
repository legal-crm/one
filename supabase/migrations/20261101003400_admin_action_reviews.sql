-- ════════════════════════════════════════════════════════════════════════════
-- OP-15 관리자 조치 기록: 월 1회 점검 표시 + 2년 보관 뒤 정리
--  * admin_audit_reviews: 달마다 '점검 끝' 기록 (점검한 관리자·메모)
--  * admin_actions 는 추가만 (수정·삭제 트리거 차단) — 보관 기간 정리 작업만 예외 (mykim.admin_actions_purge)
--  * purge_admin_actions: 2년 지난 기록 삭제 (pg_cron 04:30 KST), 지운 건수는 admin_audit_reviews 와 별도로 남기지 않음
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_audit_reviews (
  month date PRIMARY KEY CHECK (extract(day FROM month) = 1),
  reviewed_by uuid,
  reviewed_email text,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  action_count integer NOT NULL DEFAULT 0,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_reviews FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_reviews TO authenticated;
DROP POLICY IF EXISTS admin_audit_reviews_read ON public.admin_audit_reviews;
CREATE POLICY admin_audit_reviews_read ON public.admin_audit_reviews FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.admin_mark_audit_reviewed(p_month date, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_count int;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF v_month > date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul'))::date THEN RAISE EXCEPTION 'future month' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO v_count FROM admin_actions
   WHERE created_at >= (v_month::timestamp AT TIME ZONE 'Asia/Seoul')
     AND created_at < ((v_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Seoul');
  INSERT INTO admin_audit_reviews (month, reviewed_by, reviewed_email, note, action_count, reviewed_at)
  VALUES (v_month, auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), nullif(btrim(coalesce(p_note, '')), ''), v_count, now())
  ON CONFLICT (month) DO UPDATE SET reviewed_by = EXCLUDED.reviewed_by, reviewed_email = EXCLUDED.reviewed_email,
    note = EXCLUDED.note, action_count = EXCLUDED.action_count, reviewed_at = now();
  PERFORM public.admin_record_action('audit.reviewed', 'admin_actions', to_char(v_month, 'YYYY-MM'), NULL,
    jsonb_build_object('actions', v_count), p_note);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_audit_reviewed(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_audit_reviewed(date, text) TO authenticated;

-- 추가만 — 보관 기간 정리만 예외
CREATE OR REPLACE FUNCTION public.admin_actions_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('mykim.admin_actions_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'admin_actions is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_admin_actions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('mykim.admin_actions_purge', 'on', true);
  DELETE FROM admin_actions WHERE created_at < now() - interval '2 years';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('mykim.admin_actions_purge', 'off', true);
  DELETE FROM admin_audit_reviews WHERE month < (now() - interval '2 years')::date;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_admin_actions() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_admin_actions';
    PERFORM cron.schedule('mykim_purge_admin_actions', '30 19 * * *', $c$SELECT public.purge_admin_actions()$c$);
  END IF;
END $$;
