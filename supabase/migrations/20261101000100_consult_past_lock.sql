-- ════════════════════════════════════════════════════════════════════════════
-- '지난 상담'은 읽기만 (MY-Q4)
-- 의뢰인이 상담 변호사를 정했거나 계약한 뒤에는 다른 변호사에게 새 메시지를 보낼 수 없고,
-- 종료된 상담 요청에는 의뢰인이 메시지를 보낼 수 없다. (이전: 화면만 막혀 있었다)
-- 서버 작업(서비스 키)과 변호사·시스템 메시지는 그대로.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.consult_messages_past_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cr consult_requests;
BEGIN
  IF NEW.sender_type <> 'client' OR auth.uid() IS NULL OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO cr FROM consult_requests WHERE id = NEW.consult_request_id;
  IF cr.id IS NULL THEN RETURN NEW; END IF;
  IF cr.status = 'closed' THEN
    RAISE EXCEPTION 'consult is closed' USING ERRCODE = '42501';
  END IF;
  IF cr.selected_lawyer_id IS NOT NULL
     AND cr.status IN ('counseling', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged')
     AND NEW.target_lawyer_id IS NOT NULL AND NEW.target_lawyer_id <> 'client-only'
     AND NEW.target_lawyer_id <> cr.selected_lawyer_id THEN
    RAISE EXCEPTION 'past consult is read only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS consult_messages_past_lock ON public.consult_messages;
CREATE TRIGGER consult_messages_past_lock BEFORE INSERT ON public.consult_messages
  FOR EACH ROW EXECUTE FUNCTION public.consult_messages_past_lock();
