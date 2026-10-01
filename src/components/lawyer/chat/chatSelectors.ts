/**
 * 상담 채팅 데이터 가공 (화면과 분리한 순수 함수)
 *
 * `filterAndSanitizeMessagesForLawyer`는 LawyerRole.tsx 채팅 탭에 있던 함수를 옮긴 것이다.
 * 다른 변호사의 메시지·이름을 가리는 로직이므로 수정할 때는 비교 상담 데이터로 전후 결과를 확인한다.
 * (문구 규칙 확인 스크립트: .tmp-admin-work/verify-chat-filter.ts)
 */
import type { ConsultMessage, ConsultRequest, User } from '../../../types';
import { isClosedConsultStatus } from '../../../constants/consultStatus';
// consultFlow는 type-only import만 있어 변호사 화면 번들에 의뢰인 화면 코드가 딸려 오지 않는다
import { LAWYER_REQUEST_RECEIVED_NOTICE, OPEN_REQUEST_CLIENT_NOTICE } from '../../client/consultFlow';
import { getTargetLawyerColumnState } from '../../../services/consultMessageSchema';
import { hasProposalFrom, isChatOpenWithLawyer } from '../requestScope';
import { localDayKey } from './chatFormat';

// ── 대상 정보(targetLawyerId) 없이 온 시스템 안내의 문구 판정 ──
// 서버 consult_messages에 대상 변호사 칸이 없던 동안 저장된 메시지는 다른 기기에 대상 정보 없이 온다.
// 그때는 저장 문구로 받는 사람을 추정하므로, 의뢰인 화면(consultFlow·ChatView)의 저장 문구를 바꾸면 여기도 확인한다.

/**
 * buildClientRequestNotice(consultFlow) 문장 꼬리 — 요청한 변호사 이름·인원과 관계없이 이 부분은 같다.
 * (예: 'A, B 변호사님에게 상담 요청을 보냈습니다. 변호사가 채무 현황을 검토한 뒤 …')
 */
export const CLIENT_REQUEST_NOTICE_TAIL = '에게 상담 요청을 보냈습니다. 변호사가 채무 현황을 검토한 뒤';

/** 문장의 첫 문장 ('. ' 앞까지). 뒤 문장이 나중에 바뀌어도 과거 저장분을 같은 안내로 알아보기 위해 쓴다 */
function leadingSentence(text: string): string {
  const end = text.indexOf('. ');
  return end > 0 ? text.slice(0, end + 1) : text;
}

const OPEN_REQUEST_NOTICE_HEAD = leadingSentence(OPEN_REQUEST_CLIENT_NOTICE);
const LAWYER_REQUEST_NOTICE_HEAD = leadingSentence(LAWYER_REQUEST_RECEIVED_NOTICE);

/** 앞머리 '[System]' 표시를 뗀 본문 */
function stripSystemPrefix(text: string): string {
  return text.replace(/^\[System\]\s*/i, '').trim();
}

/** 의뢰인 화면 전용 안내인지 (변호사 화면에는 대상 정보가 없어도 보이지 않아야 한다) */
export function isClientOnlyNoticeText(raw: string | undefined): boolean {
  const text = stripSystemPrefix(String(raw || ''));
  if (!text) return false;
  if (OPEN_REQUEST_NOTICE_HEAD && text.startsWith(OPEN_REQUEST_NOTICE_HEAD)) return true;
  if (text.includes(CLIENT_REQUEST_NOTICE_TAIL)) return true;
  // 개편(b7ed0c6) 전 의뢰인 안내 문구
  return text.includes('상담 요청이 선택하신') || text.includes('변호사가 고객님의 채무 현황을 검토한 뒤');
}

/** 변호사에게 온 '상담 요청 접수' 안내인지 (LAWYER_REQUEST_RECEIVED_NOTICE로 시작) */
export function isLawyerRequestReceivedText(raw: string | undefined): boolean {
  const text = stripSystemPrefix(String(raw || ''));
  return Boolean(LAWYER_REQUEST_NOTICE_HEAD) && text.startsWith(LAWYER_REQUEST_NOTICE_HEAD);
}

/**
 * 대상 정보 없는 전화상담 요청을 받을 변호사: 상담 변호사(selectedLawyerId),
 * 없으면 대화 중인 변호사(acceptedLawyerIds)가 정확히 한 명일 때 그 변호사. 판단할 수 없으면 undefined
 */
function soleCounselingLawyerId(request?: ConsultRequest | null): string | undefined {
  if (!request) return undefined;
  if (request.selectedLawyerId) return request.selectedLawyerId;
  const accepted = Array.from(new Set((request.acceptedLawyerIds || []).filter(Boolean)));
  return accepted.length === 1 ? accepted[0] : undefined;
}

export interface LawyerMessageFilterOptions {
  /**
   * 대상 정보(targetLawyerId) 없는 의뢰인 대화 메시지를, 이 요청의 acceptedLawyerIds가 2명 이상이면 숨긴다
   * (누구에게 한 말인지 알 수 없어서 — 의뢰인 화면 ChatView와 같은 규칙).
   * 기본값: 서버에 target_lawyer_id 칸이 있다고 확인됐을 때만(consultMessageSchema 'present') 켠다.
   * 칸이 없으면 모든 메시지가 대상 없이 오므로, 켜면 비교 상담 대화가 통째로 사라진다.
   */
  hideUntargetedClientMessagesWhenMultiple?: boolean;
}

/** 시스템(플랫폼) 메시지 판정 — 기존 채팅 탭과 같은 기준 */
export function isSystemChatMessage(m: ConsultMessage): boolean {
  return (
    m.senderType === 'system' ||
    m.senderId === 'system' ||
    m.senderName === '시스템 안내' ||
    m.senderName === 'System' ||
    (m as any).senderType === 'admin' ||
    Boolean(m.message?.startsWith('[System]'))
  );
}

// 변호사 어드민 화면에서 본인에게 유효한 메시지만 필터링 및 타 변호사 노출 문구 정제
export const filterAndSanitizeMessagesForLawyer = (
  rawMessages: ConsultMessage[],
  lawyer: User,
  request?: ConsultRequest | null,
  options?: LawyerMessageFilterOptions
): ConsultMessage[] => {
  if (!rawMessages || rawMessages.length === 0) return [];

  const result: ConsultMessage[] = [];
  const seenSystemTexts = new Set<string>();
  const hideUntargetedClient = options?.hideUntargetedClientMessagesWhenMultiple ?? (getTargetLawyerColumnState() === 'present');
  const acceptedCount = new Set((request?.acceptedLawyerIds || []).filter(Boolean)).size;
  /** 대상 정보 없는 안내를 문장 기준으로 한 번만 보인다 (요청받은 변호사 수만큼 같은 안내가 복사돼 저장된다) */
  const pushOnce = (m: ConsultMessage, key: string) => {
    if (seenSystemTexts.has(key)) return;
    seenSystemTexts.add(key);
    result.push(m);
  };

  for (const m of rawMessages) {
    const isSystem = 
      m.senderType === 'system' || 
      m.senderId === 'system' || 
      m.senderName === '시스템 안내' || 
      m.senderName === 'System' || 
      (m as any).senderType === 'admin' || 
      m.message?.startsWith('[System]');

    // 1. 타 변호사의 일반/제안 메시지 차단
    if (m.senderType === 'lawyer' && !isSystem) {
      if (m.senderId !== lawyer.id) {
        continue; // 타 변호사 메시지/제안서 숨김
      }
      result.push(m);
      continue;
    }

    // 2. 의뢰인 메시지
    if (m.senderType === 'client' && !isSystem) {
      // 타 변호사 지정(targetLawyerId)된 의뢰인 메시지는 차단
      if (m.targetLawyerId && m.targetLawyerId !== lawyer.id) {
        continue;
      }
      // 대상 정보 없는 의뢰인 메시지: 대화 중인 변호사가 2명 이상이면 누구에게 한 말인지 알 수 없어 숨긴다
      // (의뢰인 화면 ChatView와 같은 규칙). 서버에 대상 칸이 있다고 확인된 경우에만 켠다(옵션 설명 참고).
      if (!m.targetLawyerId && hideUntargetedClient && acceptedCount >= 2) {
        continue;
      }
      result.push(m);
      continue;
    }

    // 3. 시스템 메시지
    if (isSystem) {
      // 3-1. targetLawyerId가 지정된 경우
      if (m.targetLawyerId) {
        if (m.targetLawyerId === 'client-only') {
          continue; // 의뢰인 전용 안내문 숨김
        }
        if (m.targetLawyerId !== lawyer.id) {
          continue; // 타 변호사 대상 시스템 알림 숨김
        }
        result.push(m);
        continue;
      }

      // 3-2. targetLawyerId가 없는 레거시/공통 브로드캐스트 시스템 메시지
      // 서버에 대상 칸이 없던 동안 저장된 안내는 다른 기기(변호사)에 대상 정보 없이 온다 → 문구와 요청 정보로 받는 사람을 추정
      const text = m.message || (m as any).content || '';
      const plain = stripSystemPrefix(text);

      // (1) 의뢰인 화면 전용 안내 차단 — 맨 앞에서 거른다.
      //     이전: 고객 페이지 개편(b7ed0c6)으로 문구가 바뀌어 기존 규칙에 걸리지 않았고, 이름형 문장
      //     ('A, B 변호사님에게 상담 요청을 보냈습니다…')은 아래 '변호사님' 규칙에서 이름이 든 변호사에게
      //     함께 요청받은 다른 변호사 이름까지 원문 그대로 보였다.
      if (isClientOnlyNoticeText(plain)) {
        continue;
      }

      // (2) 전화상담 요청 — '상담을 요청했습니다' 규칙보다 먼저 본다.
      //     이전: 그 규칙이 일반 '상담 요청 접수' 안내로 바꿔 '답변 필요'가 켜지지 않았고, 대화 중인 모든 변호사에게 보였다.
      //     상담 변호사(selectedLawyerId)에게만, 없으면 대화 중인 변호사가 나 한 명일 때만 원문 그대로 보인다
      //     (원문을 유지해야 classifySystemText가 attention → needsReply로 분류한다).
      if (plain.includes('의뢰인이 전화상담을 요청')) {
        if (!lawyer.id || soleCounselingLawyerId(request) !== lawyer.id) continue;
        // 연달아 저장된 같은 요청(여러 번 누름)은 하나로 줄인다. 답변 뒤 다시 요청하면 새 요청으로 보여 '답변 필요'가 다시 켜진다.
        const prev = result[result.length - 1];
        if (prev && isSystemChatMessage(prev) && stripSystemPrefix(prev.message || '') === plain) continue;
        result.push(m);
        continue;
      }

      // (3) 전담 선임 안내 — 선임된 변호사에게만 (이전: '변호사님' 규칙에 걸리지 않아 대화 중인 모든 변호사에게 보였다)
      if (plain.includes('의뢰인이 귀하를 전담 변호사로 선임')) {
        if (!lawyer.id || request?.selectedLawyerId !== lawyer.id) continue;
        pushOnce(m, plain);
        continue;
      }

      // (4) 타 변호사 전담 선임 알림 — 선임되지 않은 변호사에게 한 번만 (나머지 변호사 수만큼 복사돼 저장된다)
      if (plain.includes('다른 변호사를 전담으로 선임하였습니다')) {
        if (request?.selectedLawyerId === lawyer.id) continue;
        pushOnce(m, plain);
        continue;
      }

      // (5) 상담 요청 접수 안내(LAWYER_REQUEST_RECEIVED_NOTICE) — 의뢰인이 나를 골라 요청한 경우에만 한 번
      //     (이전: 공개 요청에 제안한 변호사 등 요청받지 않은 변호사에게도 보였다)
      if (isLawyerRequestReceivedText(plain)) {
        const requestedMe = Boolean(lawyer.id) && (
          request?.selectedLawyerId === lawyer.id ||
          (request?.selectedLawyerIds || []).includes(lawyer.id)
        );
        if (!requestedMe) continue;
        pushOnce(m, LAWYER_REQUEST_NOTICE_HEAD);
        continue;
      }

      // 다중/추가 상담 요청 안내문 (예: "김우진 변호사, 테스트 1변호사... 추가 상담 요청이 전달되었습니다.")
      const isConsultRequestNotice = 
        text.includes('상담 요청이 전달되었습니다') || 
        text.includes('상담을 요청했습니다') ||
        text.includes('무료 상담을 요청했습니다');

      if (isConsultRequestNotice) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        const isDirectlySelected = Boolean(
          request?.selectedLawyerId === lawyer.id || 
          (request?.selectedLawyerIds || []).includes(lawyer.id)
        );

        if (!mentionsMe && !isDirectlySelected) {
          continue; // 본인과 무관한 타 변호사 요청문 차단
        }

        // 본인에게 노출하되, 타 변호사 이름은 절대 노출하지 않고 단일 정제 메시지로 치환
        const sanitizedText = '의뢰인으로부터 상담 요청이 접수되었습니다. 사전 진단 리포트를 검토하고 상담을 진행해 주세요.';
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: 'system',
          senderName: '시스템 안내',
          message: sanitizedText,
        });
        continue;
      }

      // 비교 상담 시작 안내문 (예: "테스트 5변호사 변호사님과 비교 상담을 시작합니다.")
      if (text.includes('비교 상담을 시작합니다')) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue; // 타 변호사 비교 상담 시작문 차단
        }
        const sanitizedText = '의뢰인과의 1:1 비교 상담을 시작합니다.';
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: 'system',
          senderName: '시스템 안내',
          message: sanitizedText,
        });
        continue;
      }

      // 제안서 수락 안내문
      if (text.includes('제안서를 수락하셨습니다')) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = '의뢰인이 변호사님의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 진행하실 수 있습니다.';
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: 'system',
          senderName: '시스템 안내',
          message: sanitizedText,
        });
        continue;
      }

      // 상담 요청 취소 안내문
      if (text.includes('상담 요청을 취소하였습니다')) {
        if (text.includes('모든 변호사')) {
          result.push(m);
          continue;
        }
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue; // 타 변호사 취소문 차단
        }
        const sanitizedText = '의뢰인이 상담 요청을 취소하였습니다.';
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: 'system',
          senderName: '시스템 안내',
          message: sanitizedText,
        });
        continue;
      }

      // 기타 시스템 메시지 중 타 변호사 이름이 포함된 경우 차단
      if (text.includes('변호사님') || text.includes('변호사가')) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
      }

      if (seenSystemTexts.has(text)) continue;
      seenSystemTexts.add(text);
      result.push(m);
    }
  }

  return result;
};

// ── 스레드 목록 ──

/** 메시지함 노출 대상 상태 (기존 채팅 탭과 같은 기준) */
const ACTIVE_THREAD_STATUSES = ['comparing', 'counseling', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];

export interface LawyerChatThread {
  id: string;
  request: ConsultRequest;
  /** 이 변호사에게 보이는 메시지 (시간순) */
  messages: ConsultMessage[];
  /** 시스템 포함 마지막 메시지 — 정렬 기준 (기존과 동일) */
  lastMessage?: ConsultMessage;
  /** 시스템 제외 마지막 대화 메시지 — 미리보기 */
  lastConversationMessage?: ConsultMessage;
  lastActivityAt: number;
  /** 의뢰인이 마지막으로 말했거나 전화상담을 요청해 답변이 필요한지 */
  needsReply: boolean;
  /** 답변 대기 시작 시각 (내 마지막 답변 이후 첫 의뢰인 메시지) */
  waitingSince?: string;
  /**
   * 이 변호사와 의뢰인의 대화가 열렸는지 (requestScope.isChatOpenWithLawyer).
   * 제안서만 보냈고 의뢰인이 아직 '상담 시작'을 누르지 않았으면 false — 작성창을 잠근다.
   */
  chatOpen: boolean;
  /** 이 변호사가 제안서를 보냈는지 (대화가 잠겼을 때 안내 문구를 고르는 데 쓴다) */
  hasMyProposal: boolean;
}

function groupMessagesByRequest(messages: ConsultMessage[]): Map<string, ConsultMessage[]> {
  const map = new Map<string, ConsultMessage[]>();
  for (const m of messages) {
    const list = map.get(m.consultRequestId);
    if (list) list.push(m);
    else map.set(m.consultRequestId, [m]);
  }
  return map;
}

function toTime(value: string | undefined): number {
  return value ? new Date(value).getTime() : NaN;
}

/** 스레드 요약 정보 계산 */
export function summarizeThread(request: ConsultRequest, visible: ConsultMessage[], lawyerId: string): LawyerChatThread {
  const lastMessage = visible[visible.length - 1];
  let lastConversationMessage: ConsultMessage | undefined;
  for (let i = visible.length - 1; i >= 0; i--) {
    if (!isSystemChatMessage(visible[i])) { lastConversationMessage = visible[i]; break; }
  }

  let needsReply = false;
  let waitingSince: string | undefined;
  if (!isClosedConsultStatus(request.status)) {
    // 마지막 메시지가 전화상담 요청 안내면 답변 필요로 본다
    if (lastMessage && isSystemChatMessage(lastMessage) && classifySystemText(lastMessage.message) === 'attention') {
      needsReply = true;
      waitingSince = lastMessage.createdAt;
    } else if (lastConversationMessage && lastConversationMessage.senderType === 'client') {
      needsReply = true;
      // 내 마지막 답변 이후 첫 의뢰인 메시지부터 대기 시간을 센다
      for (let i = visible.length - 1; i >= 0; i--) {
        const m = visible[i];
        if (isSystemChatMessage(m)) continue;
        if (m.senderType === 'client') waitingSince = m.createdAt;
        else if (m.senderId === lawyerId || m.senderType === 'lawyer') break;
      }
    }
  }

  const lastTime = lastMessage ? toTime(lastMessage.createdAt) : toTime(request.createdAt);
  return {
    id: request.id,
    request,
    messages: visible,
    lastMessage,
    lastConversationMessage,
    lastActivityAt: lastTime,
    needsReply,
    waitingSince,
    chatOpen: isChatOpenWithLawyer(request, lawyerId),
    hasMyProposal: hasProposalFrom(request, lawyerId),
  };
}

/** 한 요청의 스레드 (메시지함 목록에 없는 요청을 직접 열 때) */
export function buildLawyerChatThread(request: ConsultRequest, messages: ConsultMessage[], lawyer: User): LawyerChatThread {
  const own = messages.filter(m => m.consultRequestId === request.id);
  return summarizeThread(request, filterAndSanitizeMessagesForLawyer(own, lawyer, request), lawyer.id);
}

/**
 * 메시지함 스레드 목록 — 포함 조건·정렬은 기존 채팅 탭과 같다.
 * 요청별 메시지 필터를 한 번만 계산한다 (이전: filter·sort·렌더에서 반복 계산).
 */
export function buildLawyerChatThreads(requests: ConsultRequest[], messages: ConsultMessage[], lawyer: User): LawyerChatThread[] {
  const byRequest = groupMessagesByRequest(messages);
  const threads: LawyerChatThread[] = [];

  for (const r of requests) {
    if ((r as any).isSoftDeleted) continue;
    const visible = filterAndSanitizeMessagesForLawyer(byRequest.get(r.id) || [], lawyer, r);
    const hasMyProposal = (r.proposals || []).some((p: any) => p.lawyerId === lawyer.id);
    const isAccepted = (r.acceptedLawyerIds || []).includes(lawyer.id);
    const isSelected = r.selectedLawyerId === lawyer.id || (r.selectedLawyerIds || []).includes(lawyer.id);
    const hasMyMessages = visible.some(m => m.senderId === lawyer.id || m.targetLawyerId === lawyer.id || m.senderType === 'client');
    const isCounselingOrActive = ACTIVE_THREAD_STATUSES.includes(r.status);
    if (!(hasMyProposal || isAccepted || isSelected || (hasMyMessages && isCounselingOrActive))) continue;
    threads.push(summarizeThread(r, visible, lawyer.id));
  }

  // 최근 메시지 순 (메시지가 없으면 요청 생성 시각)
  return threads.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

// ── 시스템 메시지 표시 ──

export type SystemTone = 'success' | 'attention' | 'neutral';

/** 시스템 메시지 성격: 수락·선임·계약 = success, 전화상담 요청 = attention, 그 외 = neutral */
export function classifySystemText(text: string | undefined): SystemTone {
  const t = String(text || '');
  if (t.includes('다른 변호사를 전담으로 선임')) return 'neutral';
  if (t.includes('취소')) return 'neutral';
  if (t.includes('전화상담을 요청')) return 'attention';
  if (/수락|전담 변호사로 선임|서명.{0,6}완료|계약.{0,6}(체결|완료)/.test(t)) return 'success';
  return 'neutral';
}

/** "[System]" 접두어와 앞머리 이모지 제거 */
export function cleanSystemText(text: string | undefined): string {
  return String(text || '')
    .replace(/^\[System\]\s*/i, '')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '')
    .trim();
}

// ── 타임라인 ──

export type ChatTimelineItem =
  | { kind: 'day'; key: string; at: string }
  | { kind: 'system'; key: string; message: ConsultMessage; tone: SystemTone; text: string }
  | { kind: 'group'; key: string; mine: boolean; messages: ConsultMessage[] };

/** 같은 발신자의 연속 메시지를 묶는 최대 간격 */
const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * 날짜 구분선·시스템 이벤트·말풍선 묶음으로 변환
 * @param initialDayKey 타임라인 앞(신청서 카드)의 날짜 — 같은 날이면 첫 구분선을 생략
 */
export function buildChatTimeline(messages: ConsultMessage[], lawyerId: string, initialDayKey: string): ChatTimelineItem[] {
  const items: ChatTimelineItem[] = [];
  let currentDay = initialDayKey;
  let group: Extract<ChatTimelineItem, { kind: 'group' }> | null = null;

  for (const m of messages) {
    const day = localDayKey(m.createdAt);
    if (day && day !== currentDay) {
      items.push({ kind: 'day', key: `day-${day}-${m.id}`, at: m.createdAt });
      currentDay = day;
      group = null;
    }

    if (isSystemChatMessage(m)) {
      items.push({ kind: 'system', key: m.id, message: m, tone: classifySystemText(m.message), text: cleanSystemText(m.message) });
      group = null;
      continue;
    }

    const mine = m.senderId === lawyerId;
    const prev = group ? group.messages[group.messages.length - 1] : null;
    const sameSender = Boolean(prev && prev.senderId === m.senderId && prev.senderType === m.senderType);
    const closeInTime = Boolean(prev && Math.abs(toTime(m.createdAt) - toTime(prev.createdAt)) <= GROUP_GAP_MS);

    if (group && sameSender && closeInTime) {
      group.messages.push(m);
    } else {
      group = { kind: 'group', key: `group-${m.id}`, mine, messages: [m] };
      items.push(group);
    }
  }

  return items;
}
