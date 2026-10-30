// 서버 사건 세부 단계(case_stage_definitions) ↔ 기존 화면 상태(CrmStatus) 대응
// 사건 화면이 서버 사건으로 완전히 옮겨 갈 때까지 두 값을 맞춰 두기 위한 다리 (CM-2)
import type { CrmStatus } from '../../types';
import type { CaseMilestone, CaseType } from './caseCoreService';

export function serverStageToCrmStatus(stage: string, closeReason?: string | null): CrmStatus {
  switch (stage) {
    case 'consult':
    case 'proposal_sent':
      return 'consulting';
    case 'contracting':
      return 'consulting';
    case 'documents':
    case 'drafting':
      return 'document';
    case 'filed':
    case 'correction':
      return 'filed';
    case 'commenced':
    case 'declared':
    case 'trustee':
    case 'creditors_meeting':
      return 'commenced';
    case 'repaying':
    case 'discharge_hearing':
      return 'repaying';
    case 'discharge':
      return 'discharged';
    case 'closed':
      return closeReason === 'discharged' ? 'discharged' : 'cancelled';
    default:
      return 'consulting';
  }
}

export interface MilestoneAction {
  kind: CaseMilestone;
  label: string;
  /** 입력 칸 */
  fields: Array<'date' | 'case_number' | 'court_name' | 'reason' | 'close_reason'>;
  /** 이 단계들에서만 보여 줌(없으면 항상) */
  fromStages?: string[];
  caseTypes?: CaseType[];
  /** 대표·담당 변호사만 */
  lawyerOnly?: boolean;
}

/** 단계마다 보여 줄 '기록' 버튼 (주 버튼 = 그 단계의 기록, CM-5) */
export const MILESTONE_ACTIONS: MilestoneAction[] = [
  { kind: 'proposal_sent', label: '제안서 발송 기록', fields: [], fromStages: ['consult'] },
  { kind: 'contract_sent', label: '계약서 발송 기록', fields: [], fromStages: ['consult', 'proposal_sent'] },
  { kind: 'contract_signed', label: '계약 체결 기록', fields: [], fromStages: ['consult', 'proposal_sent', 'contracting'] },
  { kind: 'drafting_started', label: '신청서 작성 시작', fields: [], fromStages: ['documents'] },
  { kind: 'case_number_registered', label: '사건번호 등록', fields: ['case_number', 'court_name', 'date'], fromStages: ['documents', 'drafting'] },
  { kind: 'correction_registered', label: '보정 등록', fields: [], fromStages: ['filed', 'correction'] },
  { kind: 'commencement_decided', label: '개시결정 입력', fields: ['date'], fromStages: ['filed', 'correction'], caseTypes: ['rehab'] },
  { kind: 'bankruptcy_declared', label: '파산선고 입력', fields: ['date'], fromStages: ['filed', 'correction'], caseTypes: ['bankruptcy'] },
  { kind: 'trustee_assigned', label: '관재 절차 기록', fields: [], fromStages: ['declared'], caseTypes: ['bankruptcy'] },
  { kind: 'creditors_meeting_set', label: '채권자집회 기일 입력', fields: ['date'], fromStages: ['commenced', 'declared', 'trustee'] },
  { kind: 'plan_confirmed', label: '인가결정 입력', fields: ['date'], fromStages: ['commenced', 'creditors_meeting'], caseTypes: ['rehab'] },
  { kind: 'discharge_hearing_set', label: '면책심문 기록', fields: [], fromStages: ['creditors_meeting'], caseTypes: ['bankruptcy'] },
  { kind: 'discharge_filed', label: '면책 절차 기록', fields: [], fromStages: ['repaying', 'discharge_hearing'] },
  { kind: 'discharge_decided', label: '면책 결정일 입력', fields: ['date'], fromStages: ['repaying', 'discharge', 'discharge_hearing'] },
  { kind: 'closed', label: '사건 종결', fields: ['close_reason', 'date'], lawyerOnly: true },
  { kind: 'reopened', label: '다시 열기', fields: ['reason'], fromStages: ['closed'], lawyerOnly: true },
];

export function availableMilestones(stage: string, caseType: CaseType): MilestoneAction[] {
  return MILESTONE_ACTIONS.filter(a => {
    if (a.caseTypes && !a.caseTypes.includes(caseType)) return false;
    if (stage === 'closed') return a.kind === 'reopened';
    if (a.kind === 'reopened') return false;
    return !a.fromStages || a.fromStages.includes(stage);
  });
}

export const CASE_EVENT_LABEL_FALLBACK = '기록';
