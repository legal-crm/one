// ============================================================
// 영업 리드 규칙 (SL-3·SL-4, 15 기획서 3-1·3-2·5-3) — 화면·업무폰이 같은 규칙을 쓰도록 순수 함수로 둔다
//  * 상태 6개: 신규·부재·재통화 약속·상담 중·이관 완료·종료(사유 필수)
//  * 부재 재시도: 1차 +3시간 → 2차 다음 날 반대 시간대 → 3차 +2일 → 4차 +4일 → 5차면 '연락 불가' 자동 종료
//  * 통화 가능 시간(기본 09~20시, 한국 시간) 밖이면 다음 가능 시각으로 미룬다
// ============================================================
import type { LeadCloseReason, LeadStatus, SalesLead } from '../../types/leadTypes';

export interface RetryStep { kind: 'hours' | 'days' | 'next_day_opposite'; value?: number }
export interface SalesRules {
  callStartHour: number;
  callEndHour: number;
  retrySteps: RetryStep[];
  /** 이 횟수째 부재면 자동 종료 */
  maxNoAnswer: number;
  /** 몇 번째 부재 뒤에 부재 문자를 제안할지 (0 = 안 함) */
  suggestSmsAfter: number;
}

export const DEFAULT_SALES_RULES: SalesRules = {
  callStartHour: 9,
  callEndHour: 20,
  retrySteps: [{ kind: 'hours', value: 3 }, { kind: 'next_day_opposite' }, { kind: 'days', value: 2 }, { kind: 'days', value: 4 }],
  maxNoAnswer: 5,
  suggestSmsAfter: 2,
};

const KST = 9 * 3600 * 1000;
const HOUR = 3600 * 1000;
/** 한국 시간 벽시계 (UTC 메서드로 읽는다) */
const toKst = (d: Date) => new Date(d.getTime() + KST);
const fromKst = (k: Date) => new Date(k.getTime() - KST);

/** 통화 가능 시간 안으로 맞춘다 (밖이면 다음 시작 시각) */
export function clampToCallHours(at: Date, rules: SalesRules = DEFAULT_SALES_RULES): Date {
  const k = toKst(at);
  const h = k.getUTCHours() + k.getUTCMinutes() / 60;
  if (h < rules.callStartHour) {
    k.setUTCHours(rules.callStartHour, 0, 0, 0);
  } else if (h >= rules.callEndHour) {
    k.setUTCDate(k.getUTCDate() + 1);
    k.setUTCHours(rules.callStartHour, 0, 0, 0);
  }
  return fromKst(k);
}

/** n번째 부재(1부터) 뒤 다음 시도 시각. null = 자동 종료 */
export function nextAttemptAfterNoAnswer(count: number, now: Date, rules: SalesRules = DEFAULT_SALES_RULES): Date | null {
  if (count >= rules.maxNoAnswer) return null;
  const step = rules.retrySteps[Math.min(count, rules.retrySteps.length) - 1] || rules.retrySteps[rules.retrySteps.length - 1];
  if (!step) return clampToCallHours(new Date(now.getTime() + 24 * HOUR), rules);
  if (step.kind === 'hours') return clampToCallHours(new Date(now.getTime() + (step.value || 3) * HOUR), rules);
  const k = toKst(now);
  if (step.kind === 'next_day_opposite') {
    const morning = k.getUTCHours() < 13;
    k.setUTCDate(k.getUTCDate() + 1);
    k.setUTCHours(morning ? 14 : Math.max(rules.callStartHour + 1, 10), 0, 0, 0);
    return clampToCallHours(fromKst(k), rules);
  }
  k.setUTCDate(k.getUTCDate() + (step.value || 1));
  return clampToCallHours(fromKst(k), rules);
}

export type CallOutcome =
  | { kind: 'no_answer' }
  | { kind: 'callback'; at: string }
  | { kind: 'counseling'; nextAt?: string }
  | { kind: 'closed'; reason: LeadCloseReason; detail?: string; recontactOn?: string };

export interface OutcomeResult {
  lead: SalesLead;
  /** 자동 종료됐는지 (5차 부재) */
  autoClosed: boolean;
  /** 부재 문자 제안 */
  suggestSms: boolean;
}

/** 결과 적기 → 새 리드 (원본은 바꾸지 않음) */
export function applyCallOutcome(lead: SalesLead, outcome: CallOutcome, now: Date = new Date(), rules: SalesRules = DEFAULT_SALES_RULES): OutcomeResult {
  const nowIso = now.toISOString();
  const next: SalesLead = { ...lead, updatedAt: nowIso, lastCallAt: nowIso, callCount: (lead.callCount || 0) + 1 };
  let autoClosed = false;
  let suggestSms = false;
  delete next.closeReason; delete next.closeDetail; delete next.recontactOn;

  if (outcome.kind === 'no_answer') {
    const count = (lead.noAnswerCount || 0) + 1;
    next.noAnswerCount = count;
    const at = nextAttemptAfterNoAnswer(count, now, rules);
    if (at) {
      next.status = 'no_answer';
      next.nextAttemptAt = at.toISOString();
      suggestSms = rules.suggestSmsAfter > 0 && count === rules.suggestSmsAfter;
    } else {
      next.status = 'closed';
      next.closeReason = 'unreachable';
      next.closeDetail = `부재 ${count}회`;
      delete next.nextAttemptAt;
      autoClosed = true;
    }
    return { lead: next, autoClosed, suggestSms };
  }

  // 연결됨 (또는 결번 등 종료)
  if (!next.firstContactAt && !(outcome.kind === 'closed' && (outcome.reason === 'wrong_number' || outcome.reason === 'unreachable'))) {
    next.firstContactAt = nowIso;
  }
  if (outcome.kind === 'callback') {
    next.status = 'callback';
    next.nextAttemptAt = new Date(outcome.at).toISOString();
  } else if (outcome.kind === 'counseling') {
    next.status = 'counseling';
    next.reachedCounseling = true;
    if (outcome.nextAt) next.nextAttemptAt = new Date(outcome.nextAt).toISOString(); else delete next.nextAttemptAt;
  } else {
    next.status = 'closed';
    next.closeReason = outcome.reason;
    if (outcome.detail?.trim()) next.closeDetail = outcome.detail.trim().slice(0, 200);
    if (outcome.reason === 'later' && outcome.recontactOn) next.recontactOn = outcome.recontactOn;
    delete next.nextAttemptAt;
  }
  return { lead: next, autoClosed, suggestSms };
}

/** 직접 상태 바꾸기 (종료는 사유 필수 — 화면에서 받는다) */
export function setLeadStatus(lead: SalesLead, status: LeadStatus, close?: { reason: LeadCloseReason; detail?: string }, now: Date = new Date()): SalesLead {
  const next: SalesLead = { ...lead, status, updatedAt: now.toISOString() };
  if (status === 'closed') {
    next.closeReason = close?.reason || 'other';
    if (close?.detail) next.closeDetail = close.detail.slice(0, 200);
    delete next.nextAttemptAt;
  } else {
    delete next.closeReason; delete next.closeDetail; delete next.recontactOn;
    if (status === 'new') { next.noAnswerCount = 0; delete next.nextAttemptAt; }
    if (status === 'counseling') next.reachedCounseling = true;
  }
  return next;
}

/** 서버·예전 데이터 상태를 새 상태로 (서버 트리거와 같은 규칙) */
export function normalizeLead(raw: SalesLead): SalesLead {
  const s = String((raw as any).status || 'new');
  const l: SalesLead = { ...raw };
  if (/^no_answer_[123]$/.test(s)) { l.status = 'no_answer'; l.noAnswerCount = Math.max(l.noAnswerCount || 0, Number(s.slice(-1))); }
  else if (s === 'in_progress') l.status = 'counseling';
  else if (s === 'rejected' || s === 'ineligible' || s === 'wrong_number') {
    l.status = 'closed';
    l.closeReason = l.closeReason || (s === 'rejected' ? 'declined' : s === 'ineligible' ? 'not_eligible' : 'wrong_number');
  } else if (!['new', 'no_answer', 'callback', 'counseling', 'converted', 'closed'].includes(s)) l.status = 'new';
  if (l.status === 'closed' && !l.closeReason) l.closeReason = 'other';
  return l;
}

export type QueueBucket = 'overdue' | 'due' | 'later' | 'none';

/** 오늘 할 일 대기열 판정 (SL-4) */
export function queueBucket(lead: SalesLead, now: Date = new Date()): QueueBucket {
  if (lead.status === 'converted') return 'none';
  if (lead.status === 'closed') {
    if (lead.closeReason === 'later' && lead.recontactOn) {
      const today = toKst(now).toISOString().slice(0, 10);
      return lead.recontactOn <= today ? 'due' : 'later';
    }
    return 'none';
  }
  if (lead.status === 'new') return 'due';
  if (!lead.nextAttemptAt) return lead.status === 'counseling' ? 'later' : 'due';
  const at = new Date(lead.nextAttemptAt).getTime();
  // 재통화 약속은 10분 전부터
  const lead10 = lead.status === 'callback' ? 10 * 60 * 1000 : 0;
  if (at - lead10 <= now.getTime()) return at < now.getTime() - HOUR ? 'overdue' : 'due';
  const endOfToday = toKst(now); endOfToday.setUTCHours(23, 59, 59, 999);
  return at <= fromKst(endOfToday).getTime() ? 'later' : 'none';
}

/** 오늘 할 일 순서: 기한 지남 → 지금 → 약속 시각 순, 신규는 들어온 순 */
export function sortQueue(leads: SalesLead[], now: Date = new Date()): SalesLead[] {
  const rank = (l: SalesLead) => ({ overdue: 0, due: 1, later: 2, none: 3 }[queueBucket(l, now)]);
  const t = (l: SalesLead) => (l.nextAttemptAt ? new Date(l.nextAttemptAt).getTime() : new Date(l.createdAt || 0).getTime());
  return [...leads].sort((a, b) => rank(a) - rank(b) || t(a) - t(b));
}

export function isTodayQueue(lead: SalesLead, now: Date = new Date()): boolean {
  const b = queueBucket(lead, now);
  return b === 'overdue' || b === 'due' || b === 'later';
}
