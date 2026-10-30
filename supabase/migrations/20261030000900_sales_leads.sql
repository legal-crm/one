-- ============================================================
-- SL-1 영업 DB 서버 저장 (사무소 단위)
--  * sales_leads: 리드 1건 = 1행. 상세 칸은 data(jsonb), 검색·권한용 칸(status·phone_hash·담당자)은 서버가 data에서 맞춘다
--  * 권한: sales.view 범위 'all' = 사무소 전체, 'assigned' = 내가 담당이거나 내가 등록한 리드 (SL-Q3)
--  * 삭제는 휴지통(deleted_at, sales.manage만), 30일 뒤 완전 삭제. 종료 리드는 1년 뒤 파기 (SL-Q6)
--  * 같은 사무소 같은 번호 = 재문의 판정용 phone_hash (사무소 salt + 숫자만)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 80),
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new',
  phone_hash text,
  assignee_user_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) < 300000),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  closed_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS sales_leads_office_updated_idx ON public.sales_leads (office_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_leads_office_phone_idx ON public.sales_leads (office_id, phone_hash) WHERE deleted_at IS NULL;

-- 사무소 범위 판정
CREATE OR REPLACE FUNCTION public.can_see_sales_lead(p_office_id text, p_assignee uuid, p_created_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.office_permission_scope(p_office_id, 'sales.view')
    WHEN 'all' THEN true
    WHEN 'assigned' THEN auth.uid() IS NOT NULL AND (p_assignee = auth.uid() OR p_created_by = auth.uid())
    ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.can_see_sales_lead(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_sales_lead(text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sales_lead_phone_hash(p_office_id text, p_phone text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE WHEN length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 THEN NULL
    ELSE encode(extensions.digest(coalesce((SELECT o.hash_salt FROM public.offices o WHERE o.id = p_office_id), '') || regexp_replace(p_phone, '[^0-9]', '', 'g'), 'sha256'), 'hex') END;
$$;
REVOKE ALL ON FUNCTION public.sales_lead_phone_hash(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_lead_phone_hash(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sales_leads_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text := coalesce(nullif(NEW.data ->> 'status', ''), 'new');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.office_id IS DISTINCT FROM OLD.office_id OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'office_id and id cannot change' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- 휴지통 이동·복구는 sales.manage만
    IF (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND current_user IN ('anon', 'authenticated')
       AND NOT public.has_office_permission(NEW.office_id, 'sales.manage') THEN
      RAISE EXCEPTION 'permission denied: sales.manage' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  ELSE
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.created_by := auth.uid();
      NEW.deleted_at := NULL;
    END IF;
    NEW.version := 1;
  END IF;
  NEW.status := left(v_status, 30);
  NEW.data := jsonb_set(NEW.data, '{id}', to_jsonb(NEW.id));
  NEW.phone_hash := public.sales_lead_phone_hash(NEW.office_id, NEW.data ->> 'phone');
  NEW.closed_at := CASE WHEN NEW.status IN ('converted', 'rejected', 'ineligible', 'wrong_number')
    THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.closed_at END, now()) ELSE NULL END;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sales_leads_touch ON public.sales_leads;
CREATE TRIGGER sales_leads_touch BEFORE INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_leads_touch();

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_leads_select ON public.sales_leads;
CREATE POLICY sales_leads_select ON public.sales_leads FOR SELECT TO authenticated
  USING (public.can_see_sales_lead(office_id, assignee_user_id, created_by)
         AND (deleted_at IS NULL OR public.has_office_permission(office_id, 'sales.manage')));
DROP POLICY IF EXISTS sales_leads_insert ON public.sales_leads;
CREATE POLICY sales_leads_insert ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (public.office_permission_scope(office_id, 'sales.view') IN ('all', 'assigned'));
DROP POLICY IF EXISTS sales_leads_update ON public.sales_leads;
CREATE POLICY sales_leads_update ON public.sales_leads FOR UPDATE TO authenticated
  USING (public.can_see_sales_lead(office_id, assignee_user_id, created_by))
  WITH CHECK (public.can_see_sales_lead(office_id, assignee_user_id, created_by)
              OR public.office_permission_scope(office_id, 'sales.manage') = 'all');
GRANT SELECT, INSERT, UPDATE ON public.sales_leads TO authenticated;

-- 같은 번호 재문의 확인 (번호 자체는 돌려주지 않음)
CREATE OR REPLACE FUNCTION public.find_sales_leads_by_phone(p_office_id text, p_phone text)
RETURNS TABLE (lead_id text, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.status, l.created_at FROM public.sales_leads l
  WHERE public.office_permission_scope(p_office_id, 'sales.view') IN ('all', 'assigned')
    AND l.office_id = p_office_id AND l.deleted_at IS NULL
    AND l.phone_hash = public.sales_lead_phone_hash(p_office_id, p_phone)
  ORDER BY l.created_at DESC LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.find_sales_leads_by_phone(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_sales_leads_by_phone(text, text) TO authenticated;

-- 보관 기간: 휴지통 30일, 종료 리드 1년 (매일 03:10 KST = 18:10 UTC)
CREATE OR REPLACE FUNCTION public.purge_sales_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.sales_leads
  WHERE (deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days')
     OR (closed_at IS NOT NULL AND status <> 'converted' AND closed_at < now() - interval '1 year');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_sales_leads() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mykim_purge_sales_leads';
  PERFORM cron.schedule('mykim_purge_sales_leads', '10 18 * * *', 'SELECT public.purge_sales_leads()');
END $$;
