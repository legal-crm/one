-- 알림톡·문자 하루 발송 한도 시험 (A-2, 시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE i integer; ok boolean;
BEGIN
  FOR i IN 1..3 LOOP
    ok := bump_message_counter('to:testlimit', 3);
    IF NOT ok THEN RAISE EXCEPTION 'FAIL under limit % rejected', i; END IF;
  END LOOP;
  ok := bump_message_counter('to:testlimit', 3);
  IF ok THEN RAISE EXCEPTION 'FAIL over limit accepted'; END IF;
  IF (SELECT count FROM message_send_counters WHERE bucket = 'to:testlimit') <> 3 THEN
    RAISE EXCEPTION 'FAIL count rolled back to limit';
  END IF;
  ok := bump_message_counter('to:otherbucket', 3);
  IF NOT ok THEN RAISE EXCEPTION 'FAIL buckets independent'; END IF;
  RAISE NOTICE 'PASS send counter limit';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM bump_message_counter('to:x', 5);
    RAISE EXCEPTION 'FAIL authenticated can call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM message_send_counters;
    RAISE EXCEPTION 'FAIL authenticated can read';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS send counter closed to users';
END $$;
RESET ROLE;
ROLLBACK;
