-- ============================================================
-- 변호사 좋아요 서버 저장 (LD-10, LD-Q3: 로그인 후 서버 저장)
-- 문제: 좋아요가 그 기기 localStorage에만 있었고, 쓰는 곳(localStorage)과 읽는 곳(secureGetItem)이 달라
--       내 관리방 '좋아요한 변호사에게 요청'이 늘 비어 있었다. 다른 기기에서도 안 보였다.
-- 바꾼 것:
--  * client_favorite_lawyers: 의뢰인 본인만 읽기·지우기, 넣기는 set_favorite_lawyer만 (공개 중인 변호사만, 50명까지)
--  * 변호사·사무소·관리자는 누가 좋아요를 눌렀는지 볼 수 없다 (정책 없음). 좋아요는 요청 한도와 무관한 바로가기
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_favorite_lawyers (
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id text NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_user_id, lawyer_id)
);

ALTER TABLE public.client_favorite_lawyers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_favorite_lawyers_own_select ON public.client_favorite_lawyers;
CREATE POLICY client_favorite_lawyers_own_select ON public.client_favorite_lawyers FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());
DROP POLICY IF EXISTS client_favorite_lawyers_own_delete ON public.client_favorite_lawyers;
CREATE POLICY client_favorite_lawyers_own_delete ON public.client_favorite_lawyers FOR DELETE TO authenticated
  USING (client_user_id = auth.uid());
REVOKE ALL ON public.client_favorite_lawyers FROM anon, authenticated;
GRANT SELECT, DELETE ON public.client_favorite_lawyers TO authenticated;

CREATE OR REPLACE FUNCTION public.set_favorite_lawyer(p_lawyer_id text, p_on boolean)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  l public.lawyers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  IF coalesce(p_on, false) THEN
    SELECT * INTO l FROM lawyers WHERE id = p_lawyer_id;
    IF l.id IS NULL OR NOT public.lawyer_is_public(l) THEN
      RAISE EXCEPTION 'lawyer not listed' USING ERRCODE = 'P0002';
    END IF;
    IF (SELECT count(*) FROM client_favorite_lawyers WHERE client_user_id = v_uid) >= 50
       AND NOT EXISTS (SELECT 1 FROM client_favorite_lawyers WHERE client_user_id = v_uid AND lawyer_id = p_lawyer_id) THEN
      RAISE EXCEPTION 'too many favorites' USING ERRCODE = '54000';
    END IF;
    INSERT INTO client_favorite_lawyers (client_user_id, lawyer_id) VALUES (v_uid, p_lawyer_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM client_favorite_lawyers WHERE client_user_id = v_uid AND lawyer_id = p_lawyer_id;
  END IF;
  RETURN ARRAY(SELECT lawyer_id FROM client_favorite_lawyers WHERE client_user_id = v_uid ORDER BY created_at);
END;
$$;
REVOKE ALL ON FUNCTION public.set_favorite_lawyer(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_favorite_lawyer(text, boolean) TO authenticated;
