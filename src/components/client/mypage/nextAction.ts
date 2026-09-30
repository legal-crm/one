import type { ConsultRoomStage } from '../consultFlow';
import type { Tone } from '../ui/feedback';

/* ─────────────────────────────────────────────
   마이페이지 '지금 할 일' — 사건 상태 하나로 맨 위 카드와 첫 탭을 정한다
   (내 관리방 = 대화·제안·계약 / 마이페이지 = 내 사건·회생동행·설정)
   ───────────────────────────────────────────── */

export type MyPageSubTab = 'diagnosis' | 'companion' | 'settings';

export interface NextActionInput {
  hasCheck: boolean;
  isContracted: boolean;
  /** 계약 전 상담 단계 (상담 요청이 없으면 null) */
  roomStage: ConsultRoomStage | null;
  proposalCount: number;
  /** 변호사가 요청했고 아직 내지 않은 서류 수 */
  openDocRequests: number;
  /** 반려되어 다시 내야 하는 서류 수 */
  rejectedDocs?: number;
  /** 다음에 낼 수임료 (없으면 null) */
  nextFee: { round: number; dueDate: string; overdue: boolean } | null;
  /** 오늘 (YYYY-MM-DD) — 테스트·표시 일관성을 위해 밖에서 넣는다 */
  today: string;
}

export type NextActionKind = 'check' | 'room' | 'tab';

export interface NextAction {
  title: string;
  description: string;
  tone: Tone;
  action?: { label: string; kind: NextActionKind; tab?: MyPageSubTab };
  /** 따로 고른 탭이 없을 때 처음 보여 줄 탭 */
  defaultTab: MyPageSubTab;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00`);
  const b = new Date(`${toYmd}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatMonthDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function getMyPageNextAction(input: NextActionInput): NextAction {
  const { hasCheck, isContracted, roomStage, proposalCount, openDocRequests, nextFee, today } = input;
  const rejectedDocs = input.rejectedDocs || 0;

  if (isContracted) {
    if (rejectedDocs > 0) {
      return {
        title: `다시 내야 하는 서류 ${rejectedDocs}건이 있어요`,
        description: '내 사건 탭에서 반려 사유를 확인하고 새로 올려 주세요.',
        tone: 'warning',
        action: { label: '반려 사유 보기', kind: 'tab', tab: 'diagnosis' },
        defaultTab: 'diagnosis',
      };
    }
    if (openDocRequests > 0) {
      return {
        title: `변호사가 요청한 서류 ${openDocRequests}건이 있어요`,
        description: '내 사건 탭의 요청 서류에서 파일을 올리면 담당 변호사 사무소가 확인합니다.',
        tone: 'warning',
        action: { label: '요청 서류 보기', kind: 'tab', tab: 'diagnosis' },
        defaultTab: 'diagnosis',
      };
    }
    if (nextFee) {
      const left = daysBetween(today, nextFee.dueDate);
      if (nextFee.overdue || left < 0) {
        return {
          title: `수임료 ${nextFee.round}회차 납부일이 지났어요`,
          description: '이미 냈다면 담당 사무소에 알려 주세요. 납부 일정은 내 사건 탭에서 볼 수 있어요.',
          tone: 'warning',
          action: { label: '납부 일정 보기', kind: 'tab', tab: 'diagnosis' },
          defaultTab: 'diagnosis',
        };
      }
      if (left <= 7) {
        return {
          title: `수임료 ${nextFee.round}회차 납부일은 ${formatMonthDay(nextFee.dueDate)}이에요`,
          description: left === 0 ? '오늘이 납부일입니다.' : `${left}일 남았어요. 납부 일정은 내 사건 탭에서 볼 수 있어요.`,
          tone: 'info',
          action: { label: '납부 일정 보기', kind: 'tab', tab: 'diagnosis' },
          defaultTab: 'diagnosis',
        };
      }
    }
    return {
      title: '사건 진행과 변제 일정은 회생동행에서 관리하세요',
      description: '법원 진행 단계, 월 변제금 납부 기록, 생활 위기 때 받을 수 있는 지원을 한곳에서 봅니다.',
      tone: 'success',
      action: { label: '회생동행 보기', kind: 'tab', tab: 'companion' },
      defaultTab: 'companion',
    };
  }

  if (!hasCheck) {
    return {
      title: '내 상황 체크부터 시작하세요',
      description: '약 3분, 이름·연락처 없이 채무·소득을 정리합니다. 결과로 변호사에게 상담을 요청할 수 있어요.',
      tone: 'brand',
      action: { label: '내 상황 체크하기', kind: 'check' },
      defaultTab: 'diagnosis',
    };
  }

  switch (roomStage) {
    case 'open_waiting':
    case 'waiting_reply':
      return {
        title: '변호사의 제안서를 기다리고 있어요',
        description: '변호사가 채무 현황을 검토한 뒤 제안서를 보내면 알림으로 알려 드려요.',
        tone: 'info',
        action: { label: '내 관리방 보기', kind: 'room' },
        defaultTab: 'diagnosis',
      };
    case 'review_proposals':
      return {
        title: `제안서 ${proposalCount}건이 도착했어요`,
        description: '내 관리방에서 조건을 비교하고 이야기를 나눠 볼 변호사의 상담을 시작하세요.',
        tone: 'info',
        action: { label: '제안서 비교하기', kind: 'room' },
        defaultTab: 'diagnosis',
      };
    case 'comparing':
    case 'counseling':
      return {
        title: '변호사와 상담하고 있어요',
        description: '대화와 수임 계약은 내 관리방에서 이어집니다.',
        tone: 'brand',
        action: { label: '상담방 열기', kind: 'room' },
        defaultTab: 'diagnosis',
      };
    default:
      return {
        title: '상담을 요청할 변호사를 골라 주세요',
        description: '체크 결과로 최대 3명에게 요청하고 제안서를 비교할 수 있어요.',
        tone: 'brand',
        action: { label: '내 관리방에서 변호사 고르기', kind: 'room' },
        defaultTab: 'diagnosis',
      };
  }
}
