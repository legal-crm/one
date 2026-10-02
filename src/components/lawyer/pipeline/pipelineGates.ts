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

export interface JourneyStageDetail {
  stageNo: PipelineStageNo;
  title: string;
  status: 'completed' | 'in_progress' | 'blocked' | 'upcoming';
  progressPercent: number;
  progressText: string;
  badgeCls: string;
  nextAction: string;
  blockReason?: string;
}

export interface JourneyState {
  currentStage: PipelineStageNo;
  currentStageDetail: JourneyStageDetail;
  stages: Record<PipelineStageNo, JourneyStageDetail>;
  gates: PipelineGateState;
  isBankruptcy: boolean;
}

/**
 * 6단계 수임 여정 상태 및 단계별 진행률 단일 판정 함수 (v2.0)
 * - 고정값(소명서 6/7종·85% 등)을 완전 제거하고 실제 데이터 기반으로 계산
 * - 스텝바, 툴바, 고객관리 목록, 칸반에서 모두 동일한 단계와 진행률을 참조
 */
export function getJourneyState(
  clientRequest: ConsultRequest,
  crmExt?: CrmClientExtension,
  activeLawyerId?: string
): JourneyState {
  const gates = computePipelineGates(clientRequest, crmExt);
  const status = crmExt?.crmStatus || (clientRequest as any)?.status || 'requested';
  const isBk = crmExt?.caseType === 'bankruptcy' || crmExt?.caseType === 'individual_bankruptcy' || clientRequest?.caseType === 'bankruptcy';
  const currentStage = stageForStatus(status);

  // 1단계: 상담·제안
  const s1Status = gates.isContractCompleted ? 'completed' : 'in_progress';
  const s1Progress = gates.isContractCompleted ? 100 : gates.isContactShared ? 75 : gates.hasProposalSent ? 50 : 25;
  const s1Text = gates.isContractCompleted
    ? '4/4 (수임계약 체결 완료)'
    : gates.isContactShared
      ? '3/4 (상담 진행 / 계약 대기)'
      : gates.hasProposalSent
        ? '2/4 (제안서 발송 완료 / 의뢰인 확인 대기)'
        : '1/4 (맞춤 제안서 작성 필요)';
  const s1Next = gates.isContractCompleted
    ? '전자계약 확인 및 착수'
    : gates.isContactShared
      ? '상담 진행 및 수임 계약서 발송'
      : gates.hasProposalSent
        ? '의뢰인 제안서 확인 대기'
        : '맞춤 제안서 작성 및 발송';

  // 2단계: 수임 계약
  const s2Status = gates.isContractCompleted
    ? 'completed'
    : gates.locked[2]
      ? 'blocked'
      : 'in_progress';
  const s2Progress = gates.isContractCompleted ? 100 : gates.locked[2] ? 0 : 40;
  const s2Text = gates.isContractCompleted
    ? '수임계약 체결 완료'
    : gates.locked[2]
      ? '선행 상담 미완료'
      : '전자서명 체결 대기 중';
  const s2Next = gates.isContractCompleted ? '3단계 서류 준비 착수' : '전자계약서 작성 및 서명 요청';

  // 3단계: 서류 준비
  const docs = crmExt?.documents || [];
  const approvedDocs = docs.filter(d => d.reviewStatus === 'approved').length;
  const totalDocs = docs.length;
  const uploadedFilesCount = (crmExt?.uploadedFiles || []).length;
  const s3Completed = gates.isFilingCompleted || (totalDocs > 0 ? (approvedDocs / totalDocs) >= 0.8 && approvedDocs >= 3 : uploadedFilesCount >= 5);
  const s3Progress = gates.isFilingCompleted
    ? 100
    : totalDocs > 0
      ? Math.round((approvedDocs / totalDocs) * 100)
      : Math.min(95, uploadedFilesCount * 15);
  const s3Text = gates.isFilingCompleted
    ? '서류 검토 및 준비 완료'
    : totalDocs > 0
      ? `서류 ${approvedDocs}/${totalDocs}건 승인 (${s3Progress}%)`
      : `${uploadedFilesCount}건 서류 수합 중`;
  const s3Status = s3Completed
    ? 'completed'
    : gates.locked[3]
      ? 'blocked'
      : 'in_progress';
  const s3Next = s3Completed ? '4단계 신청서 작성 및 접수' : '미비 서류 검토 및 의뢰인 요청';

  // 4단계: 신청·접수
  const hasCaseNo = Boolean(crmExt?.courtCase?.caseNumber);
  const s4Completed = gates.isFilingCompleted || hasCaseNo;
  const s4Progress = s4Completed ? 100 : gates.locked[4] ? 0 : 60;
  const s4Text = s4Completed
    ? (hasCaseNo ? `전자소송 접수 완료 (${crmExt?.courtCase?.caseNumber})` : '전자소송 접수 완료')
    : '8대 법원 서식 검토 중';
  const s4Status = s4Completed
    ? 'completed'
    : gates.locked[4]
      ? 'blocked'
      : 'in_progress';
  const s4Next = s4Completed ? '5단계 법원 심리 및 보정 대응' : '신청 서식 최종 검토 및 전자소송 접수';

  // 5단계: 보정·개시 (고정값 6/7종·85% 완전 제거)
  const isProhibitionGranted = crmExt?.courtCase?.prohibitionStatus === 'granted';
  const s5Completed = gates.isCommenced;
  const s5Progress = s5Completed ? 100 : gates.locked[5] ? 0 : isProhibitionGranted ? 60 : 35;
  const s5Text = s5Completed
    ? '법원 개시결정 완료'
    : gates.locked[5]
      ? '법원 접수 대기'
      : isProhibitionGranted
        ? '금지명령 인가 · 개시결정 대기'
        : (isBk ? '파산관재인 심리 대기' : '법원 심리 및 개시결정 대기');
  const s5Status = s5Completed
    ? 'completed'
    : gates.locked[5]
      ? 'blocked'
      : 'in_progress';
  const s5Next = s5Completed ? '6단계 변제 및 면책 관리' : '보정명령 확인 및 소명서 대응';

  // 6단계: 변제·면책
  const s6Completed = gates.isDischarged;
  const isRepaying = status === 'repaying';
  const s6Progress = s6Completed ? 100 : isRepaying ? 70 : gates.isCommenced ? 40 : 0;
  const s6Text = s6Completed
    ? (isBk ? '파산 면책 확정' : '회생 면책 결정 확정')
    : isRepaying
      ? '변제 적립금 성실 납입 관리'
      : gates.isCommenced
        ? '인가결정 및 가상계좌 관리'
        : '개시결정 대기';
  const s6Status = s6Completed
    ? 'completed'
    : gates.locked[6]
      ? 'blocked'
      : 'in_progress';
  const s6Next = s6Completed ? '사건 종결' : '변제 현황 점검 및 면책 신청 준비';

  const stages: Record<PipelineStageNo, JourneyStageDetail> = {
    1: {
      stageNo: 1,
      title: isBk ? '파산 상담 및 맞춤 제안' : '맞춤 제안서 발송 및 의뢰인 상담',
      status: s1Status,
      progressPercent: s1Progress,
      progressText: s1Text,
      badgeCls: s1Status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      nextAction: s1Next,
      blockReason: gates.locked[1] ? pipelineLockReason(1, gates) : undefined,
    },
    2: {
      stageNo: 2,
      title: '법원 실비·수임료 산출 및 모바일 전자계약 체결',
      status: s2Status,
      progressPercent: s2Progress,
      progressText: s2Text,
      badgeCls: s2Status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      nextAction: s2Next,
      blockReason: gates.locked[2] ? pipelineLockReason(2, gates) : undefined,
    },
    3: {
      stageNo: 3,
      title: '4대 발급처 서류 일괄 수합 및 진술서 동기화',
      status: s3Status,
      progressPercent: s3Progress,
      progressText: s3Text,
      badgeCls: s3Status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      nextAction: s3Next,
      blockReason: gates.locked[3] ? pipelineLockReason(3, gates) : undefined,
    },
    4: {
      stageNo: 4,
      title: isBk ? '파산 7대 서식 검증 및 대법원 전자소송 접수' : '8대 법원 서식 검증 및 대법원 전자소송 정식 접수',
      status: s4Status,
      progressPercent: s4Progress,
      progressText: s4Text,
      badgeCls: s4Status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      nextAction: s4Next,
      blockReason: gates.locked[4] ? pipelineLockReason(4, gates) : undefined,
    },
    5: {
      stageNo: 5,
      title: isBk ? '파산관재인 소명서 작성 및 전자소송 제출' : '회생위원 보정권고 소명서 작성 및 전자소송 제출',
      status: s5Status,
      progressPercent: s5Progress,
      progressText: s5Text,
      badgeCls: s5Status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      nextAction: s5Next,
      blockReason: gates.locked[5] ? pipelineLockReason(5, gates) : undefined,
    },
    6: {
      stageNo: 6,
      title: isBk ? '파산관재인 배당 및 면책 불허가 사유 심리 관리' : '법원 가상계좌 적립금 납부 지도 및 채권자집회·면책 관리',
      status: s6Status,
      progressPercent: s6Progress,
      progressText: s6Text,
      badgeCls: s6Status === 'completed' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      nextAction: s6Next,
      blockReason: gates.locked[6] ? pipelineLockReason(6, gates) : undefined,
    },
  };

  return {
    currentStage,
    currentStageDetail: stages[currentStage] || stages[1],
    stages,
    gates,
    isBankruptcy: isBk,
  };
}
