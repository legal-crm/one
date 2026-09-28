// ============================================================
// 6단계 파이프라인 게이트 (단일 산식)
// 이전: 잠금은 스텝바 클릭에만 적용되고, 각 Stage의 '다음 단계로' 버튼은 조건 없이 이동해
//       개시결정 전에도 Stage 6(사후관리)로 넘어갈 수 있었다.
// ============================================================
import type { ConsultRequest, CrmClientExtension } from '../../../types';

export type PipelineStageNo = 1 | 2 | 3 | 4 | 5 | 6;

const CONTRACTED_STATUSES = ['contracted', 'document', 'documents_pending', 'filed', 'commenced', 'repaying', 'discharged'];
const FILED_STATUSES = ['filed', 'commenced', 'repaying', 'discharged'];
const COMMENCED_STATUSES = ['commenced', 'repaying', 'discharged'];

export interface PipelineGateState {
  isContracted: boolean;
  hasProposalSent: boolean;
  isContactShared: boolean;
  isConsultCompleted: boolean;
  isContractCompleted: boolean;
  isDocCompleted: boolean;
  isFilingCompleted: boolean;
  isCommenced: boolean;
  isDischarged: boolean;
  locked: Record<PipelineStageNo, boolean>;
}

export function computePipelineGates(clientRequest: ConsultRequest, crmExt?: CrmClientExtension): PipelineGateState {
  const status = crmExt?.crmStatus || (clientRequest as any)?.status || '';
  const isContracted = CONTRACTED_STATUSES.includes(status);
  const hasProposalSent = Boolean(
    (clientRequest as any)?.hasProposalSent || (crmExt as any)?.hasProposalSent || (clientRequest.proposals || []).length > 0
  );
  // 연락처 공개는 의뢰인의 명시적 공개(상담 요청)만 인정
  // (이전: 전화번호에 '*'가 없으면 공개된 것으로 간주 → 변호사가 직접 등록한 번호로 게이트 통과)
  const isContactShared = Boolean(
    isContracted ||
    (clientRequest as any)?.isContactShared ||
    (crmExt as any)?.isContactShared ||
    clientRequest.phoneConsultationRequested ||
    clientRequest.contactDisclosureStatus === 'contact_shared' ||
    (crmExt as any)?.isExternalClient // 직접 수임(외부 유입) 고객은 제안서 단계 없음
  );
  const isConsultCompleted = (!!status && status !== 'requested') || isContracted;
  const isContractCompleted = isContracted;
  const isDocCompleted = isContractCompleted && (crmExt?.uploadedFiles?.length || 0) >= 3;
  const isFilingCompleted = FILED_STATUSES.includes(status);
  const isCommenced = COMMENCED_STATUSES.includes(status);
  const isDischarged = status === 'discharged';

  return {
    isContracted, hasProposalSent, isContactShared, isConsultCompleted, isContractCompleted,
    isDocCompleted, isFilingCompleted, isCommenced, isDischarged,
    locked: {
      1: false,
      2: !isContracted && (!(hasProposalSent || (crmExt as any)?.isExternalClient) || !isContactShared),
      3: !isContractCompleted,
      4: !isContractCompleted,
      5: !isFilingCompleted && !crmExt?.courtCase?.caseNumber,
      6: !isCommenced,
    },
  };
}

/** 잠금 사유 안내 문구 */
export function pipelineLockReason(target: PipelineStageNo, g: PipelineGateState): string {
  if (target === 2) {
    return !g.hasProposalSent
      ? '[Stage 01 맞춤 제안서 발송]이 필요합니다.\n의뢰인에게 제안서를 먼저 발송하고, 의뢰인이 확인(상담 요청)해야 다음 단계로 이동할 수 있습니다.'
      : '의뢰인이 제안서를 확인하고 상담 요청(연락처 공개)을 해야 다음 단계로 이동할 수 있습니다.';
  }
  if (target === 3 || target === 4) {
    return '[Stage 02 계약·착수]에서 수임계약 체결이 완료되어야 진행할 수 있습니다.';
  }
  if (target === 5) {
    return '[Stage 04]에서 법원 접수를 완료 처리하거나 사건번호를 등록해야 법원 대응·보정 단계로 진행할 수 있습니다.';
  }
  if (target === 6) {
    return '법원의 개시결정이 등록되어야(사건 상태: 개시결정) 사후관리·면책 단계로 진행할 수 있습니다.';
  }
  return '선행 절차가 아직 완료되지 않았습니다.';
}

/** crmStatus → 표시할 파이프라인 단계 */
export function stageForStatus(status?: string): PipelineStageNo {
  switch (status) {
    case 'consulting':
    case 'contracted':
      return 2;
    case 'document':
    case 'documents_pending':
      return 3;
    case 'filed':
      return 4;
    case 'commenced':
      return 5;
    case 'repaying':
    case 'discharged':
      return 6;
    default:
      return 1;
  }
}
