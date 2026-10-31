-- 의뢰인 정리 자료 v2 (I-4·I-5): 답한 그대로(원 단위, 계산값 없음, 버전 번호)를 consult_requests.intake에 둔다
--  * 쓰기: 의뢰인 본인 행만(기존 RLS), 계약 전까지. 주민등록번호 형식은 거절, 40KB 한도
--  * 변호사는 consult_requests_for_lawyers 뷰로 본다 (기존 동의·자리 규칙 그대로). 관리자는 행을 직접 못 읽음(OP-5)
--  * 의뢰인이 정리 자료를 고치면 이미 요청받은 변호사 사무소에 '정리 자료가 바뀌었어요' 알림

ALTER TABLE public.consult_requests ADD COLUMN IF NOT EXISTS intake jsonb;
ALTER TABLE public.consult_requests ADD COLUMN IF NOT EXISTS intake_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.consult_intake_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.intake IS NOT DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.intake ELSE NULL END) THEN
    RETURN NEW;
  END IF;
  IF NEW.intake IS NOT NULL THEN
    IF jsonb_typeof(NEW.intake) <> 'object' OR coalesce((NEW.intake ->> 'version')::int, 0) <> 2 THEN
      RAISE EXCEPTION 'intake must be version 2 object' USING ERRCODE = 'check_violation';
    END IF;
    IF octet_length(NEW.intake::text) > 40000 THEN
      RAISE EXCEPTION 'intake too large' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.intake::text ~ '\d{6}\s*-?\s*[1-8]\d{6}' THEN
      RAISE EXCEPTION 'resident number not allowed' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- 계약 뒤에는 의뢰인이 정리 자료를 바꾸지 않는다 (사무소 자료가 기준)
  IF TG_OP = 'UPDATE' AND current_user IN ('anon', 'authenticated') AND OLD.status IN ('contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged') THEN
    RAISE EXCEPTION 'intake is locked after contract' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.intake IS NOT NULL THEN
    NEW.intake_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS consult_intake_guard ON public.consult_requests;
CREATE TRIGGER consult_intake_guard BEFORE INSERT OR UPDATE OF intake ON public.consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.consult_intake_guard();

-- 고친 뒤 알림: 진행 중 자리(요청·검토·제안·선택)의 변호사 사무소에
CREATE OR REPLACE FUNCTION public.consult_intake_changed_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  IF OLD.intake IS NULL OR NEW.intake IS NOT DISTINCT FROM OLD.intake THEN RETURN NEW; END IF;
  BEGIN
    FOR r IN
      SELECT DISTINCT m.office_id
      FROM public.consult_request_lawyers s
      JOIN public.office_members m ON m.lawyer_id = s.lawyer_id AND m.status = 'active'
      WHERE s.request_id = NEW.id AND s.status IN ('requested', 'reviewing', 'proposed', 'chosen')
    LOOP
      PERFORM public.notify_office_members(r.office_id, 'consult.view', NULL, 'client_intake_changed',
        '의뢰인이 정리 자료를 고쳤어요', '상담 요청의 의뢰인 정리 자료에서 바뀐 곳을 확인해 주세요.',
        'consult_request', NEW.id, 'intake:' || NEW.id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'consult_intake_changed_notify: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS consult_intake_changed_notify ON public.consult_requests;
CREATE TRIGGER consult_intake_changed_notify AFTER UPDATE OF intake ON public.consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.consult_intake_changed_notify();

-- 변호사 화면 뷰: 끝에 칸 두 개 추가 (앞 칸은 20261031001300과 같음)
CREATE OR REPLACE VIEW public.consult_requests_for_lawyers WITH (security_barrier='true') AS
 SELECT cr.id,
    cr.client_id,
        CASE
            WHEN lawyer_can_see_contact(cr.*, me.lid) THEN cr.client_name
            WHEN POSITION(('_'::text) IN (cr.client_name)) > 0 THEN split_part(cr.client_name, '_'::text, 2)
            ELSE cr.client_name
        END AS client_name,
        CASE
            WHEN lawyer_can_see_contact(cr.*, me.lid) THEN cr.phone
            WHEN COALESCE(cr.phone, ''::text) = ''::text THEN ''::text
            ELSE '010-****-****'::text
        END AS phone,
    lawyer_can_see_contact(cr.*, me.lid) AS contact_visible,
    cr.request_type,
    cr.max_participants,
    cr.status,
    cr.selected_lawyer_id,
    cr.selected_lawyer_ids,
    cr.accepted_lawyer_ids,
    cr.rejection_notified,
    cr.proposals,
    cr.title,
    cr.content,
    cr.financial_profile,
    cr.phone_consultation_requested,
    cr.safe_number,
    cr.safe_number_assigned_at,
    cr.safe_number_expires_at,
    cr.entry_category,
    cr.created_by_lawyer_id,
    cr.created_at,
    cr.updated_at,
    seat.status AS my_seat_status,
    seat.respond_by AS my_respond_by,
    cr.intake,
    cr.intake_updated_at
   FROM consult_requests cr
     CROSS JOIN LATERAL ( SELECT request_viewer_lawyer_id(cr.*, 'consult.view'::text) AS lid) me
     LEFT JOIN consult_request_lawyers seat ON seat.request_id = cr.id AND seat.lawyer_id = me.lid
  WHERE me.lid IS NOT NULL AND NOT cr.admin_hidden;
