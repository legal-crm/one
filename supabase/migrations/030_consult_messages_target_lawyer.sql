-- ============================================================================
-- 030. consult_messages.target_lawyer_id — 메시지를 받을 변호사(대상) 저장
-- ----------------------------------------------------------------------------
-- 배경
--   앱은 비교 상담(의뢰인 1명 ↔ 변호사 최대 3명)에서 메시지마다 대상 변호사(targetLawyerId)를 정하지만,
--   서버 행에는 그 칸이 없어 다른 기기(변호사 화면)에는 대상 정보 없이 도착했다.
--   그래서 변호사 화면 필터(src/components/lawyer/chat/chatSelectors.ts)가 저장 문구로 받는 사람을 추정해야 했고,
--   문구가 바뀌면(예: 고객 페이지 개편 b7ed0c6) 다른 변호사 이름이 든 의뢰인 전용 안내가 보이는 문제가 생겼다.
--
-- 변경
--   A. target_lawyer_id 칸 추가 (없으면 null = 대상 정보 없음, 이전 메시지와 같음)
--      text로 둔다: 변호사 ID 외에 'client-only'(의뢰인 화면 전용 안내) 같은 특수값을 저장하기 때문
--      (변호사 ID·이메일과 특수값이 섞이므로 외래키도 걸지 않는다)
--   B. (consult_request_id, target_lawyer_id) 인덱스 — 상담방별·대상별 조회용
--   C. PostgREST 스키마 캐시 새로고침 — 적용 직후 앱 저장이 '칸 없음(PGRST204)'으로 실패하지 않게
--
-- 앱 동작 (src/services/consultService.ts · consultMessageSchema.ts)
--   - 적용 전: 저장이 칸 없음 오류(PGRST204·42703)를 받으면 그 칸 없이 한 번 다시 저장한다 (기존과 같게 동작)
--   - 적용 후: 대상 변호사를 함께 저장하고, 불러온 행에 이 칸이 있으면 변호사 화면이 대상 정보 없는
--     의뢰인 메시지를 비교 상담(대화 중 변호사 2명 이상) 중에 숨긴다 (의뢰인 화면 ChatView와 같은 규칙)
--   - 메시지는 수정하지 않는 데이터라 앱의 전체 저장은 ON CONFLICT DO NOTHING으로 보낸다
--     (대상 정보가 없는 기기의 전체 저장이 서버 값을 null로 덮지 않음, UPDATE 권한도 필요 없음)
--
-- 적용 전: consult_messages 백업 (예: 대시보드 Database → Backups, 또는
--          CREATE TABLE consult_messages_backup_030 AS TABLE consult_messages;)
-- 되돌리기: ALTER TABLE consult_messages DROP COLUMN IF EXISTS target_lawyer_id;
--           (인덱스는 칸과 함께 지워진다. 이후 NOTIFY pgrst, 'reload schema'; 실행)
--
-- 후속 검토 (이 파일에는 넣지 않음)
--   - 변호사 조회를 target_lawyer_id IS NULL OR target_lawyer_id = 본인(변호사 ID)인 행으로 제한하는 RLS.
--     지금은 012 strict_select_consult_messages(can_access_consult_request)만 적용되어, 같은 상담방의
--     다른 변호사 대상 메시지도 서버 응답에는 포함되고 화면 필터로만 가린다.
--     제한할 때는 'client-only' 행을 변호사에게서 빼고, 이메일로 지정된 변호사(selected_lawyer_ids에 이메일)를
--     어떻게 볼지 먼저 정해야 한다.
-- 선행: 003 (consult_messages), 012 (RLS)
-- ============================================================================
BEGIN;

ALTER TABLE consult_messages ADD COLUMN IF NOT EXISTS target_lawyer_id TEXT;

COMMENT ON COLUMN consult_messages.target_lawyer_id IS
  '메시지를 받을 변호사 ID (비교 상담). NULL = 대상 정보 없음(030 이전 메시지 포함), ''client-only'' = 의뢰인 화면 전용 안내';

CREATE INDEX IF NOT EXISTS idx_consult_messages_request_target
  ON consult_messages (consult_request_id, target_lawyer_id);

COMMIT;

-- PostgREST 스키마 캐시 새로고침 (새 칸을 바로 읽고 쓸 수 있게)
NOTIFY pgrst, 'reload schema';
