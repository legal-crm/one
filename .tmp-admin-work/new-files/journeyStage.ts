// ============================================================
// 리걸플로형 13단계(thirteenStage) ↔ CRM 진행 상태(crmStatus) 매핑 (단일 산식)
// 이전: 매핑 표가 CrmTab 13단계 스테퍼 안에만 있어, 스테퍼가 아닌 곳(상태 드롭다운·칸반·일괄 변경 등)에서
//       crmStatus만 바꾸면 thirteenStage는 예전 값으로 남았다 → 의뢰인 마이페이지가 두 값을 함께 보여 주며 단계가 어긋남
// ============================================================
import type { CrmStatus } from '../../../types';
import { LEGALFLOW_REHAB_STAGES, LEGALFLOW_BANKRUPTCY_STAGES } from '../../../types';

/** 13단계 → crmStatus (스테퍼에서 단계를 고를 때 함께 저장할 상태) */
const STAGE_TO_CRM_STATUS: Record<string, CrmStatus> = {
  consult_waiting: 'requested',
  consult_completed: 'consulting',
  contract_done: 'contracted',
  doc_prep: 'document',
  petition_drafting: 'document',
  petition_submitted: 'filed',
  prohibition_order: 'filed',
  correction_period: 'filed',
  commencement: 'commenced',
  creditor_meeting: 'commenced',
  confirmation: 'repaying',
  dismissed_revoked: 'cancelled',
  completed: 'discharged',
  // 파산 단계
  bankruptcy_declared: 'commenced',
  hearing_date: 'commenced',
  asset_liquidation: 'repaying',
  bankruptcy_closed: 'cancelled',
  discharge_granted: 'discharged',
  discharge_denied: 'cancelled',
};

/**
 * crmStatus → 기본 13단계 (thirteenStage가 비었을 때 표시, 상태만 바뀔 때 동기화 기준)
 * 파산 'repaying' 기본값은 asset_liquidation(→ repaying)으로 둔다.
 * (이전: hearing_date였는데 hearing_date는 다시 commenced로 매핑되어, 기본 단계와 상태가 서로 어긋남)
 */
export function defaultThirteenStageFor(status: CrmStatus | string | undefined, isBankruptcy: boolean): string {
  switch (status) {
    case 'requested': return 'consult_waiting';
    case 'consulting': return 'consult_completed';
    case 'contracted': return 'contract_done';
    case 'document': return 'doc_prep';
    case 'filed': return 'petition_submitted';
    case 'commenced': return isBankruptcy ? 'bankruptcy_declared' : 'commencement';
    case 'repaying': return isBankruptcy ? 'asset_liquidation' : 'confirmation';
    case 'discharged': return 'completed';
    case 'cancelled': return isBankruptcy ? 'bankruptcy_closed' : 'dismissed_revoked';
    default: return 'consult_waiting';
  }
}

/** 13단계 → crmStatus (알 수 없는 단계면 undefined) */
export function crmStatusForThirteenStage(stageId: string | undefined): CrmStatus | undefined {
  return stageId ? STAGE_TO_CRM_STATUS[stageId] : undefined;
}

/**
 * 저장된 13단계가 crmStatus와 맞는지
 * - 비어 있으면 화면이 상태 기준 기본 단계를 쓰므로 어긋나지 않은 것으로 본다
 * - 알 수 없는 단계 id는 의뢰인 화면에 안내가 나오지 않으므로 어긋난 것으로 본다
 */
export function isThirteenStageConsistent(stageId: string | undefined, status: CrmStatus | string | undefined): boolean {
  if (!stageId) return true;
  return crmStatusForThirteenStage(stageId) === status;
}

/** 법원 접수 이후 단계인지 (회생·파산 단계표의 isCourtStage 기준) */
function isCourtStage(stageId: string): boolean {
  const cfg = LEGALFLOW_REHAB_STAGES.find(s => s.id === stageId) || LEGALFLOW_BANKRUPTCY_STAGES.find(s => s.id === stageId);
  return !!cfg?.isCourtStage;
}

/**
 * crmStatus만 바뀔 때 함께 저장할 13단계
 * - 비어 있거나 새 상태와 맞으면 그대로 둔다
 * - 맞지 않으면 새 상태의 기본 단계로 바꾼다
 * - 단, 'cancelled'(의뢰인 취소·이탈)인데 법원 접수 전 단계였다면 비운다(undefined).
 *   기본 단계 '기각 및 폐지'를 쓰면 의뢰인 화면에 '법원이 기각·폐지했다'는 사실과 다른 안내가 나가기 때문
 */
export function thirteenStageAfterStatusChange(
  currentStage: string | undefined,
  newStatus: CrmStatus,
  isBankruptcy: boolean,
): string | undefined {
  if (isThirteenStageConsistent(currentStage, newStatus)) return currentStage;
  if (newStatus === 'cancelled' && currentStage && !isCourtStage(currentStage)) return undefined;
  return defaultThirteenStageFor(newStatus, isBankruptcy);
}
