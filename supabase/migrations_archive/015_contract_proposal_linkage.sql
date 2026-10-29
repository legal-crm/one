-- ============================================================
-- 015: 제안서 → 전자계약 연동 컬럼
-- ------------------------------------------------------------
-- 의뢰인이 제안서에서 직접 시작한 계약(스텔스 가명 상태)을
-- 원격 서명 화면에서 본인인증 실명으로 전환하기 위한 플래그와
-- 근거 상담요청/제안서 ID를 서버에 보존한다.
-- (앱은 컬럼이 없을 때 확장 컬럼을 제외하고 재시도하므로 적용 순서에 제약 없음)
-- ============================================================

ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS client_ref_id TEXT;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS real_name_conversion_pending BOOLEAN;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS consult_request_id TEXT;
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS source_proposal_id TEXT;

-- 같은 제안서로 서명 대기 계약이 중복 생성되는 것을 방지 (서명 대기/작성 중 상태만)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_open_per_proposal
  ON electronic_contracts (source_proposal_id)
  WHERE source_proposal_id IS NOT NULL
    AND status IN ('drafting', 'pending_sign', 'client_review');

CREATE INDEX IF NOT EXISTS idx_contracts_consult_request
  ON electronic_contracts (consult_request_id)
  WHERE consult_request_id IS NOT NULL;
