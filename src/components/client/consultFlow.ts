import type { ConsultStatus } from '../../types';
import type { Tone } from './ui/feedback';

/* ─────────────────────────────────────────────
   의뢰인 상담 흐름 공용 규칙
   - 변호사 상담 요청 병합 (변호사 찾기 선택 모드 · 내 관리방 좋아요 목록 공용)
   - 상담 상태 표시 문구
   ───────────────────────────────────────────── */

/** 의뢰인이 한 상담에서 요청할 수 있는 변호사 수 */
export const LAWYER_REQUEST_LIMIT = 3;

/** 요청을 받은 변호사 화면에만 보이는 안내문 (변호사 화면 필터가 targetLawyerId로 구분한다) */
export const LAWYER_REQUEST_RECEIVED_NOTICE =
  '의뢰인으로부터 1:1 상담 요청이 접수되었습니다. 사전 진단 리포트를 검토하고 상담을 진행해 주세요.';

export interface LawyerRequestMerge {
  /** 병합 후 요청 대상 변호사 (기존 순서 유지, 최대 한도까지) */
  selectedLawyerIds: string[];
  /** 이번에 새로 요청 대상이 된 변호사 */
  addedLawyerIds: string[];
  /** 한도를 넘어 요청하지 못한 변호사 */
  overflowLawyerIds: string[];
}

/**
 * 기존 요청 대상에 새로 고른 변호사를 더한다.
 * 기존 요청은 지우지 않고, 한도를 넘는 변호사는 overflow로 돌려준다.
 */
export function mergeLawyerRequest(
  existingIds: readonly string[] | undefined,
  requestedIds: readonly string[],
  limit: number = LAWYER_REQUEST_LIMIT,
): LawyerRequestMerge {
  const selected = Array.from(new Set(existingIds || []));
  const added: string[] = [];
  const overflow: string[] = [];
  for (const id of requestedIds) {
    if (!id || selected.includes(id)) continue;
    if (selected.length >= limit) {
      overflow.push(id);
      continue;
    }
    selected.push(id);
    added.push(id);
  }
  return { selectedLawyerIds: selected, addedLawyerIds: added, overflowLawyerIds: overflow };
}

// ── 로그인 전에 고른 변호사: 로그인(소셜 로그인 이동 포함)을 마치면 받는 변호사 확인(동의) 창을 이어서 연다 ──
const PENDING_LAWYER_REQUEST_KEY = 'legal_crm_pending_lawyer_request';
/** 이보다 오래된 보류 요청은 버린다 (다른 날 로그인했을 때 갑자기 동의 창이 뜨지 않도록) */
const PENDING_LAWYER_REQUEST_TTL_MS = 30 * 60 * 1000;

export interface PendingLawyerRequest {
  requestId: string;
  lawyerIds: string[];
  at: number;
}

export function stashPendingLawyerRequest(requestId: string, lawyerIds: readonly string[]): void {
  try {
    const value: PendingLawyerRequest = { requestId, lawyerIds: [...lawyerIds], at: Date.now() };
    sessionStorage.setItem(PENDING_LAWYER_REQUEST_KEY, JSON.stringify(value));
  } catch { /* 저장 불가 환경이면 로그인 후 다시 고르면 된다 */ }
}

export function readPendingLawyerRequest(): PendingLawyerRequest | null {
  try {
    const raw = sessionStorage.getItem(PENDING_LAWYER_REQUEST_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingLawyerRequest;
    if (!value?.requestId || !Array.isArray(value.lawyerIds) || Date.now() - (value.at || 0) > PENDING_LAWYER_REQUEST_TTL_MS) {
      sessionStorage.removeItem(PENDING_LAWYER_REQUEST_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearPendingLawyerRequest(): void {
  try { sessionStorage.removeItem(PENDING_LAWYER_REQUEST_KEY); } catch { /* ignore */ }
}

/** 공개 요청을 올렸을 때 의뢰인 화면 전용 안내문 */
export const OPEN_REQUEST_CLIENT_NOTICE =
  '공개 요청을 올렸습니다. 등록·승인된 변호사가 요청을 확인하고 제안서를 보내면 이곳에서 비교할 수 있습니다.';

/** 의뢰인 화면 전용 안내문: 누구에게 요청했는지와 다음에 일어날 일 */
export function buildClientRequestNotice(lawyerNames: readonly string[], count: number): string {
  const who = lawyerNames.length === count && count > 0
    ? `${lawyerNames.join(', ')} 변호사님`
    : `선택하신 변호사 ${count}명`;
  return `${who}에게 상담 요청을 보냈습니다. 변호사가 채무 현황을 검토한 뒤 제안서를 보내 드리며, 제안서를 확인한 뒤 1:1 상담을 시작할 수 있습니다.`;
}

/**
 * 변호사에게 보낸 시스템 안내를 의뢰인 화면에서 어떻게 읽을지 정한다.
 * 변호사 화면 필터(lawyer/chat/chatSelectors)가 원문 문장으로 구분하므로 저장 문구는 바꾸지 않고
 * 의뢰인 화면에서만 바꿔 보여 준다.
 * @returns 표시할 문장. 의뢰인에게 보일 필요가 없는 안내면 null
 */
export function clientSystemMessageText(raw: string | undefined): string | null {
  const text = String(raw || '').replace(/^\[System\]\s*/, '').trim();
  if (!text) return null;
  if (text.startsWith(LAWYER_REQUEST_RECEIVED_NOTICE.slice(0, 20))) return null;
  if (text.includes('의뢰인이 귀하를 전담 변호사로 선임하였습니다')) {
    return '이 변호사와 상담을 이어가기로 했습니다. 수임 계약은 제안서의 전자계약에서 진행합니다.';
  }
  if (text.includes('의뢰인이 다른 변호사를 전담으로 선임하였습니다')) {
    return '다른 변호사와 상담을 이어가기로 해 이 대화는 종료되었습니다.';
  }
  if (text.includes('제안서를 수락하셨습니다')) {
    return '제안서를 받아들여 이 변호사와 1:1 상담을 시작했습니다. 수임 계약은 제안서 조건으로 따로 진행합니다.';
  }
  if (text.includes('의뢰인이 전화상담을 요청했습니다')) {
    return '전화상담을 요청했습니다. 변호사가 이 대화방에서 통화 가능한 시간을 여쭤볼 예정입니다.';
  }
  return text;
}

/* ── 내 관리방 단계 (상태 표시·주 버튼·기본 탭을 이 한 곳에서 정한다) ── */

export type ConsultRoomStage =
  | 'no_check'          // 내 상황 체크 결과 없음
  | 'choose_lawyers'    // 체크 완료, 아직 아무에게도 요청하지 않음(요청을 모두 취소한 경우 포함)
  | 'open_waiting'      // 공개 요청을 올리고 제안서를 기다림
  | 'waiting_reply'     // 고른 변호사에게 요청, 제안서 없음
  | 'review_proposals'  // 제안서 도착, 상담 시작 전
  | 'comparing'         // 한 명 이상과 대화 중, 상담 변호사 확정 전
  | 'counseling'        // 상담 변호사 확정, 수임 계약 전
  | 'contracted'        // 수임 계약 이후(서류 준비·접수·변제 등)
  | 'closed';           // 상담 종료

const AFTER_CONTRACT: ReadonlyArray<ConsultStatus> = ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];

export interface ConsultRoomInput {
  hasCheck: boolean;
  status?: ConsultStatus;
  requestType?: 'direct' | 'open' | 'direct_multi';
  requestedLawyerIds: readonly string[];
  acceptedLawyerIds: readonly string[];
  selectedLawyerId?: string;
  proposalCount: number;
}

export function getConsultRoomStage(input: ConsultRoomInput): ConsultRoomStage {
  const { hasCheck, status, requestType, requestedLawyerIds, acceptedLawyerIds, selectedLawyerId, proposalCount } = input;
  if (status && AFTER_CONTRACT.includes(status)) return 'contracted';
  if (status === 'closed') return 'closed';
  if (!hasCheck) return 'no_check';
  if (status === 'counseling' && selectedLawyerId) return 'counseling';
  if (status === 'comparing' || acceptedLawyerIds.length > 0) return 'comparing';
  if (proposalCount > 0) return 'review_proposals';
  if (requestedLawyerIds.length > 0) return 'waiting_reply';
  if (requestType === 'open' && status === 'requested') return 'open_waiting';
  return 'choose_lawyers';
}

/** 1:1 대화를 쓸 수 있는 단계 (그 전에는 상담방이 잠겨 있다) */
export function isChatStage(stage: ConsultRoomStage): boolean {
  return stage === 'comparing' || stage === 'counseling' || stage === 'contracted';
}

/**
 * 내 관리방 상태 배지. 요청 단계는 저장된 status(requested 등)가 아니라 실제 진행으로 판단한다
 * (예: 아직 아무에게도 요청하지 않았는데 '변호사 확인 대기'로 보이지 않게)
 */
export function getConsultRoomBadge(stage: ConsultRoomStage, status?: ConsultStatus): ClientConsultStatus | null {
  switch (stage) {
    case 'no_check': return null;
    case 'choose_lawyers': return { label: '요청 전', tone: 'neutral' };
    case 'open_waiting': return { label: '공개 요청 중', tone: 'info' };
    case 'waiting_reply': return { label: '변호사 확인 대기', tone: 'warning' };
    case 'review_proposals': return { label: '제안서 도착', tone: 'info' };
    case 'comparing': return { label: '비교 상담 중', tone: 'brand' };
    case 'counseling': return { label: '상담 진행 중', tone: 'brand' };
    case 'contracted': return getClientConsultStatus(status) || { label: '수임 계약 완료', tone: 'success' };
    case 'closed':
    default: return { label: '상담 종료', tone: 'neutral' };
  }
}

/** 상담 요청 하나의 단계 (내 관리방 상담 선택 칸 등 목록용) */
export function getRequestRoomStage(r: {
  status?: ConsultStatus; requestType?: 'direct' | 'open' | 'direct_multi'; selectedLawyerIds?: string[];
  acceptedLawyerIds?: string[]; selectedLawyerId?: string; proposals?: unknown[]; financialProfile?: unknown;
}): ConsultRoomStage {
  return getConsultRoomStage({
    hasCheck: !!r.financialProfile,
    status: r.status,
    requestType: r.requestType,
    requestedLawyerIds: r.selectedLawyerIds || [],
    acceptedLawyerIds: r.acceptedLawyerIds || [],
    selectedLawyerId: r.selectedLawyerId,
    proposalCount: (r.proposals || []).length,
  });
}

export interface ClientConsultStatus {
  label: string;
  tone: Tone;
}

/** 상담 상태를 의뢰인이 이해하는 말로 바꾼다 (도착한 제안서가 있으면 우선 알려 준다) */
export function getClientConsultStatus(status: ConsultStatus | undefined, proposalCount = 0): ClientConsultStatus | null {
  switch (status) {
    case 'requested':
      return proposalCount > 0 ? { label: '제안서 도착', tone: 'info' } : { label: '변호사 확인 대기', tone: 'warning' };
    case 'responding':
      return proposalCount > 0 ? { label: '제안서 도착', tone: 'info' } : { label: '변호사 검토 중', tone: 'warning' };
    case 'comparing':
      return { label: '비교 상담 중', tone: 'brand' };
    case 'counseling':
      return { label: '상담 진행 중', tone: 'brand' };
    case 'contracted':
      return { label: '수임 계약 완료', tone: 'success' };
    case 'document':
      return { label: '신청 서류 준비 중', tone: 'success' };
    case 'filed':
      return { label: '법원 접수', tone: 'success' };
    case 'commenced':
      return { label: '개시 결정', tone: 'success' };
    case 'repaying':
      return { label: '변제 진행 중', tone: 'success' };
    case 'discharged':
      return { label: '면책 결정', tone: 'success' };
    case 'closed':
      return { label: '상담 종료', tone: 'neutral' };
    case 'cancelled':
      return { label: '요청 취소됨', tone: 'neutral' };
    default:
      return null;
  }
}
