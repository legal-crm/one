-- ============================================================
-- 알림톡·문자 발송 한도 (A-2) — 서버 인스턴스마다 따로 세던 메모리 한도 대신 DB 공유 한도
--  * 받는 번호(지문)별 하루 20건, 보내는 계정별 하루 500건
--  * 번호는 서버가 만든 지문만 저장 (원래 번호 없음), 7일 뒤 정리
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_send_counters (
  bucket text NOT NULL CHECK (char_length(bucket) BETWEEN 3 AND 100),
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, day)
);
ALTER TABLE public.message_send_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_send_counters FROM anon, authenticated;

-- 한도 안이면 1 올리고 true, 넘으면 false (서비스 롤 전용)
CREATE OR REPLACE FUNCTION public.bump_message_counter(p_bucket text, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_count integer;
BEGIN
  INSERT INTO public.message_send_counters (bucket, day, count) VALUES (p_bucket, v_day, 1)
  ON CONFLICT (bucket, day) DO UPDATE SET count = public.message_send_counters.count + 1
  RETURNING count INTO v_count;
  IF v_count > p_limit THEN
    UPDATE public.message_send_counters SET count = count - 1 WHERE bucket = p_bucket AND day = v_day;
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_message_counter(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_message_counter(text, integer) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('mykim_purge_message_send_counters');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('mykim_purge_message_send_counters', '50 18 * * *',
  $$DELETE FROM public.message_send_counters WHERE day < (now() AT TIME ZONE 'Asia/Seoul')::date - 7$$);
