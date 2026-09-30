/**
 * 상담 요청 상태(ConsultStatus) → 화면 라벨·단계 그룹
 *
 * 상담 채팅(메시지함·대화 헤더)에서 공통으로 쓴다.
 * 이전에는 화면마다 삼항 연산자로 따로 매핑해 commenced·repaying·discharged·closed가 모두 '상담중'으로 보였다.
 */
import type { ConsultStatus } from '../types';

export type ConsultStageGroup = 'intake' | 'comparing' | 'counseling' | 'retained' | 'discharged' | 'closed';

export interface ConsultStatusMeta {
  label: string;
  group: ConsultStageGroup;
}

export const CONSULT_STATUS_META: Record<ConsultStatus, ConsultStatusMeta> = {
  requested:  { label: '신규 요청', group: 'intake' },
  responding: { label: '제안 검토중', group: 'intake' },
  comparing:  { label: '비교 상담중', group: 'comparing' },
  counseling: { label: '상담 진행중', group: 'counseling' },
  contracted: { label: '수임 계약', group: 'retained' },
  document:   { label: '서류 준비', group: 'retained' },
  filed:      { label: '접수 완료', group: 'retained' },
  commenced:  { label: '개시 결정', group: 'retained' },
  repaying:   { label: '변제 중', group: 'retained' },
  discharged: { label: '면책 확정', group: 'discharged' },
  closed:     { label: '상담 종료', group: 'closed' },
  cancelled:  { label: '요청 취소', group: 'closed' },
};

/** 상태 칩의 단계색 점 (칩 자체는 흰 배경 + 회색 글자로 통일) */
export const CONSULT_STAGE_DOT_CLASS: Record<ConsultStageGroup, string> = {
  intake: 'bg-slate-400',
  comparing: 'bg-amber-500',
  counseling: 'bg-emerald-500',
  retained: 'bg-blue-500',
  discharged: 'bg-teal-600',
  closed: 'bg-slate-300',
};

const UNKNOWN_STATUS: ConsultStatusMeta = { label: '상담중', group: 'intake' };

export function getConsultStatusMeta(status: string | null | undefined): ConsultStatusMeta {
  if (!status) return UNKNOWN_STATUS;
  return CONSULT_STATUS_META[status as ConsultStatus] || UNKNOWN_STATUS;
}

/** 수임 계약 이후 단계(면책 포함)인지 */
export function isRetainedConsultStatus(status: string | null | undefined): boolean {
  const g = getConsultStatusMeta(status).group;
  return g === 'retained' || g === 'discharged';
}

/** 종료·취소된 상담인지 */
export function isClosedConsultStatus(status: string | null | undefined): boolean {
  return getConsultStatusMeta(status).group === 'closed';
}
