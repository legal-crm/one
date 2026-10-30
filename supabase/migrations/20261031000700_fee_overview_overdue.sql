-- ============================================================
-- FE: 수납 현황에 기한 지난 금액·상담 요청 ID 추가
-- 대시보드 '연체 수납' 금액, 사이드바 배지, 일괄 안내 대상이 사건 관리 사본(crm_clients.fee_schedule) 대신 서버 기록을 쓰게 한다
-- 반환 칸이 바뀌어 DROP 후 다시 만든다 (권한도 다시 지정)
-- ============================================================
DROP FUNCTION IF EXISTS public.fee_office_overview(text);

CREATE FUNCTION public.fee_office_overview(p_office_id text)
RETURNS TABLE (
  case_id uuid, case_title text, client_display_name text, total_fee_won integer, paid_won bigint,
  remaining_won bigint, overdue_count integer, next_due_on date, next_due_won integer, pending_reports integer,
  overdue_won bigint, consult_request_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  s record;
BEGIN
  IF NOT public.has_office_permission(p_office_id, 'fee.view') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOR c IN
    SELECT cs.id, cs.title, cs.consult_request_id AS req_id, oc.display_name, a.total_fee_won
    FROM public.fee_agreements a
    JOIN public.cases cs ON cs.id = a.case_id AND cs.deleted_at IS NULL
    LEFT JOIN public.office_clients oc ON oc.id = cs.office_client_id
    WHERE a.office_id = p_office_id AND a.is_current
      AND public.has_office_permission(p_office_id, 'fee.view', cs.id)
    ORDER BY cs.created_at DESC
  LOOP
    case_id := c.id; case_title := c.title; client_display_name := c.display_name; total_fee_won := c.total_fee_won;
    consult_request_id := c.req_id;
    SELECT coalesce(sum(p.amount_won), 0) INTO paid_won FROM public.fee_payments p WHERE p.case_id = c.id AND p.voided_at IS NULL;
    remaining_won := greatest(0, c.total_fee_won - paid_won);
    overdue_count := 0; overdue_won := 0; next_due_on := NULL; next_due_won := NULL;
    FOR s IN SELECT * FROM public.fee_case_status(c.id) LOOP
      IF s.status = 'overdue' THEN
        overdue_count := overdue_count + 1;
        overdue_won := overdue_won + s.remaining_won;
      END IF;
      IF next_due_on IS NULL AND s.status <> 'paid' THEN next_due_on := s.due_on; next_due_won := s.remaining_won; END IF;
    END LOOP;
    SELECT count(*)::integer INTO pending_reports FROM public.fee_client_reports r WHERE r.case_id = c.id AND r.status = 'pending';
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.fee_office_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fee_office_overview(text) TO authenticated;
