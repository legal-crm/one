-- ============================================================
-- 권한 정리 (11-01 운영 점검에서 발견, 4단계 QA)
-- RLS가 API 접근을 막고 있지만, 표 권한 자체가 넓게 남아 있었다(Supabase 기본 권한).
--  1) TRUNCATE는 RLS를 따르지 않는다 → 로그인·익명 역할에서 모든 public 표의 TRUNCATE·TRIGGER·REFERENCES를 거둔다
--  2) 익명(anon)에게 허용 정책이 없는 쓰기(INSERT/UPDATE/DELETE)는 표 권한도 거둔다 (정책이 있는 쓰기만 남김)
--  3) cleanup_expired_diagnosis()는 익명·로그인 사용자가 부를 수 없게 (정리 작업 전용)
--  4) lawyer_profile_tombstones는 지운 사람(deleted_by)을 공개하지 않는다
-- 앱·서버는 TRUNCATE를 쓰지 않고, 익명 쓰기는 audit_logs 허용 행동만 있다(정책 유지).
-- ============================================================
DO $$
DECLARE
  r record;
  c text;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm') LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', r.relname);
    FOREACH c IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = r.relname
          AND (p.cmd = c OR p.cmd = 'ALL')
          AND (p.roles @> ARRAY['anon']::name[] OR p.roles @> ARRAY['public']::name[])
          AND p.permissive = 'PERMISSIVE'
      ) THEN
        EXECUTE format('REVOKE %s ON public.%I FROM anon', c, r.relname);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 앞으로 새로 만드는 표도 같은 기준 (postgres가 만드는 표)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.cleanup_expired_diagnosis() FROM PUBLIC, anon, authenticated;

REVOKE SELECT ON public.lawyer_profile_tombstones FROM anon, authenticated;
GRANT SELECT (lawyer_id, deleted_at) ON public.lawyer_profile_tombstones TO anon, authenticated;
