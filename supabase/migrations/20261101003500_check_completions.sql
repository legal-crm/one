-- ════════════════════════════════════════════════════════════════════════════
-- OP-4 '정리 완료' 서버 이벤트 ('진단' → '정리')
--  이전: 지표가 audit_logs 'diagnosis_submit' 을 셌는데 앱이 그 기록을 남기지 않아 늘 0, 남겼더라도 익명 INSERT 라 부풀릴 수 있었다
--  바꾼 것: record_check_completed(세션 표시) — 익명도 부를 수 있는 서버 함수, 같은 세션은 한 번만,
--           1분에 전체 120건이 넘으면 조용히 버림. 입력값·채무 정보는 받지 않는다 (세션 표시의 해시와 시각만)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.check_completions (
  session_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS check_completions_created_idx ON public.check_completions (created_at);
ALTER TABLE public.check_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.check_completions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_check_completed(p_session text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_session IS NULL OR p_session !~ '^[A-Za-z0-9_-]{16,80}$' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM check_completions WHERE created_at > now() - interval '1 minute') >= 120 THEN RETURN false; END IF;
  v_hash := encode(extensions.digest('check:' || p_session, 'sha256'), 'hex');
  INSERT INTO check_completions (session_hash) VALUES (v_hash) ON CONFLICT (session_hash) DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.record_check_completed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_check_completed(text) TO anon, authenticated;

-- 지표: 정리 완료 = check_completions
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.platform_metrics_core(timestamptz, timestamptz)'::regprocedure);
  d := replace(d,
    $x$(SELECT count(*) FROM audit_logs a WHERE a.action = 'diagnosis_submit' AND a.created_at >= p_from AND a.created_at < p_to)$x$,
    $x$(SELECT count(*) FROM check_completions c WHERE c.created_at >= p_from AND c.created_at < p_to)$x$);
  IF position('check_completions' in d) = 0 THEN RAISE EXCEPTION 'platform_metrics_core not patched'; END IF;
  EXECUTE d;
END $$;

-- 2년 지난 기록 정리 (집계는 platform_daily_metrics 스냅샷에 남는다)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_check_completions';
    PERFORM cron.schedule('mykim_purge_check_completions', '35 19 * * *',
      $c$DELETE FROM public.check_completions WHERE created_at < now() - interval '2 years'$c$);
  END IF;
END $$;
