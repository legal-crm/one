import type { ConsultRequest, ConsultStatus } from '../../types';
import { LAWYER_REQUEST_LIMIT } from '../client/consultFlow';

/* ─────────────────────────────────────────────
   변호사 화면의 상담 요청 판정 (대시보드·사이드바 배지·신규 알림·고객관리 신규 리드·제안서 발송 공용)
   - 의뢰인 화면(client/consultFlow.ts)의 단계 규칙과 같은 기준을 쓴다:
     제안서 발송만으로는 상담이 열리지 않고, 의뢰인이 제안서의 '상담 시작'을 눌러야 대화가 열린다.
   - 이전: '신규' 판정이 status === 'requested'에 묶여 있어, 비교 상담(최대 3명) 중 첫 제안 이후
     나머지 변호사에게 요청이 사라지고, 비교 상담 중 추가로 요청받은 변호사는 알림을 받지 못했다.
   ───────────────────────────────────────────── */

/** 요청 단계가 끝난 상태 (신규 요청·제안서 발송 대상이 아님) */
const CLOSED_OR_RETAINED: ReadonlyArray<ConsultStatus> = [
  'closed', 'cancelled', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged',
];

/** 수임 계약 이후 상태 */
const RETAINED: ReadonlyArray<ConsultStatus> = ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];

export interface LawyerIdentity {
  id: string;
  email?: string;
  lawFirmId?: string;
}

interface LawyerDirectoryEntry {
  id: string;
  lawFirmId?: string;
}

export function isClosedOrRetained(status: ConsultStatus | undefined): boolean {
  return !!status && CLOSED_OR_RETAINED.includes(status);
}

/** 이 변호사가 보낸 제안서가 있는지 */
export function hasProposalFrom(r: ConsultRequest, lawyerId: string): boolean {
  return !!lawyerId && (r.proposals || []).some(p => p?.lawyerId === lawyerId);
}

/** 제안서를 보낸 서로 다른 변호사 수 */
export function proposalLawyerCount(r: ConsultRequest): number {
  return new Set((r.proposals || []).map(p => p?.lawyerId).filter(Boolean)).size;
}

/** 의뢰인이 이 변호사를 직접 골라 요청했거나(지정·단독 지명), 이 변호사가 담당·등록한 요청인지 */
export function isPersonallyRequested(r: ConsultRequest, lawyer: LawyerIdentity): boolean {
  if (!lawyer.id) return false;
  return Boolean(
    r.selectedLawyerIds?.includes(lawyer.id) ||
    r.selectedLawyerId === lawyer.id ||
    r.assignedLawyerId === lawyer.id ||
    r.createdByLawyerId === lawyer.id ||
    (lawyer.email && (
      r.assignedLawyerEmail === lawyer.email ||
      r.selectedLawyerEmails?.includes(lawyer.email) ||
      r.selectedLawyerIds?.includes(lawyer.email)
    ))
  );
}

/** 같은 사무소 변호사가 요청받았는지 (목록 노출용 — 제안서는 요청받은 변호사 본인만 보낼 수 있다) */
export function isRequestedToSameFirm(r: ConsultRequest, lawyer: LawyerIdentity, lawyers: ReadonlyArray<LawyerDirectoryEntry>): boolean {
  if (!lawyer.lawFirmId) return false;
  return (r.selectedLawyerIds || []).some(id => lawyers.find(l => l.id === id)?.lawFirmId === lawyer.lawFirmId);
}

/** 공개 요청이 아직 제안서를 받을 수 있는지 (제안한 변호사 수 < 최대 인원) */
export function isOpenForProposals(r: ConsultRequest): boolean {
  if (r.requestType !== 'open') return false;
  if (isClosedOrRetained(r.status)) return false;
  if (r.status === 'counseling' && r.selectedLawyerId) return false;
  const max = Math.max(1, Number(r.maxParticipants) || LAWYER_REQUEST_LIMIT);
  return proposalLawyerCount(r) < max;
}

/**
 * '신규 상담' — 이 변호사가 아직 제안서를 보내지 않았고, 보낼 수 있는 요청
 * (의뢰인이 이 변호사를 골라 요청했거나, 같은 사무소 변호사가 요청받았거나, 제안 자리가 남은 공개 요청)
 * 상태(requested/responding/comparing)와 무관하게 판단한다.
 */
export function isNewRequestForLawyer(
  r: ConsultRequest,
  lawyer: LawyerIdentity,
  lawyers: ReadonlyArray<LawyerDirectoryEntry> = [],
): boolean {
  if (!lawyer.id || (r as { isSoftDeleted?: boolean }).isSoftDeleted) return false;
  if (isClosedOrRetained(r.status)) return false;
  if (hasProposalFrom(r, lawyer.id)) return false;
  // 이미 이 변호사와 대화 중이거나(수락됨), 다른 변호사와 상담을 이어가기로 한 요청은 신규가 아니다
  if ((r.acceptedLawyerIds || []).includes(lawyer.id)) return false;
  if (r.status === 'counseling' && r.selectedLawyerId) return false;
  if (isPersonallyRequested(r, lawyer) || isRequestedToSameFirm(r, lawyer, lawyers)) return true;
  return isOpenForProposals(r);
}

/**
 * 제안서를 보낼 수 없는 이유 (보낼 수 있으면 null) — 발송 버튼·발송 핸들러 공용
 * 의뢰인 화면은 의뢰인이 요청한 변호사의 제안서만 보여 주므로(ChatView), 요청받지 않은 변호사의 제안서는 막는다.
 */
export function getProposalBlockReason(
  r: ConsultRequest,
  lawyer: LawyerIdentity,
  opts: { approved?: boolean } = {},
): string | null {
  if (opts.approved === false) {
    return '자격 심사 대기(체험 모드) 중에는 의뢰인에게 제안서를 보낼 수 없습니다. 관리자 승인 후 이용해 주세요.';
  }
  if (isClosedOrRetained(r.status)) {
    return '종료되었거나 수임 계약 이후 단계인 상담이라 제안서를 보낼 수 없습니다.';
  }
  if (r.status === 'counseling' && r.selectedLawyerId && r.selectedLawyerId !== lawyer.id) {
    return '의뢰인이 다른 변호사와 상담을 이어가기로 한 요청입니다.';
  }
  if (hasProposalFrom(r, lawyer.id)) {
    return '이 요청에는 이미 제안서를 보냈습니다. 내용을 바꾸려면 상담 채팅으로 안내해 주세요.';
  }
  if (isPersonallyRequested(r, lawyer)) return null;
  if (r.requestType === 'open') {
    return isOpenForProposals(r) ? null : '공개 요청의 제안서 자리가 모두 찼습니다.';
  }
  return '의뢰인이 요청한 변호사만 제안서를 보낼 수 있습니다. (요청이 취소되었거나 같은 사무소의 다른 변호사에게 온 요청일 수 있습니다)';
}

/**
 * 이 변호사와 의뢰인의 1:1 대화가 열렸는지
 * - 의뢰인이 제안서의 '상담 시작'을 눌러 수락했거나(acceptedLawyerIds), 상담 변호사로 정했거나(selectedLawyerId),
 *   수임 계약 이후이거나, 변호사가 직접 등록한 의뢰인이면 열린 것으로 본다.
 */
export function isChatOpenWithLawyer(r: ConsultRequest, lawyerId: string): boolean {
  if (!lawyerId) return false;
  if ((r.acceptedLawyerIds || []).includes(lawyerId)) return true;
  if (r.selectedLawyerId === lawyerId) return true;
  if (r.createdByLawyerId === lawyerId) return true;
  if (RETAINED.includes(r.status) && (r.assignedLawyerId === lawyerId || !r.assignedLawyerId)) return true;
  return false;
}

/** 요청 유형 표시 (고객 화면이 만드는 'direct_multi' 포함) */
export function requestTypeLabel(type: ConsultRequest['requestType'] | undefined): string {
  switch (type) {
    case 'direct': return '단독 지명';
    case 'direct_multi': return '의뢰인 지정';
    case 'open': return '공개 요청';
    default: return '상담 요청';
  }
}
