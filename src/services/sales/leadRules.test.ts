import { describe, expect, it } from 'vitest';
import { applyCallOutcome, clampToCallHours, nextAttemptAfterNoAnswer, normalizeLead, queueBucket } from './leadRules';
import type { SalesLead } from '../../types/leadTypes';

// 2026-11-02(월) 10:00 KST = 01:00Z
const at = (iso: string) => new Date(iso);
const kstHour = (d: Date) => new Date(d.getTime() + 9 * 3600e3).getUTCHours();
const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const base = { id: 'l', customerName: 'A', phone: '010', status: 'new', createdAt: '2026-11-02T00:00:00Z', updatedAt: '' } as unknown as SalesLead;

describe('부재 재시도 규칙', () => {
  it('1차는 3시간 뒤, 통화 시간 밖이면 다음 날 9시', () => {
    expect(kstHour(nextAttemptAfterNoAnswer(1, at('2026-11-02T01:00:00Z'))!)).toBe(13);
    const late = nextAttemptAfterNoAnswer(1, at('2026-11-02T09:30:00Z'))!; // 18:30 KST → 21:30 → 다음 날 9시
    expect(kstDay(late)).toBe('2026-11-03');
    expect(kstHour(late)).toBe(9);
  });
  it('2차는 다음 날 반대 시간대, 3차 +2일, 4차 +4일, 5차는 자동 종료', () => {
    const second = nextAttemptAfterNoAnswer(2, at('2026-11-02T01:00:00Z'))!; // 오전 → 다음 날 오후
    expect(kstDay(second)).toBe('2026-11-03');
    expect(kstHour(second)).toBe(14);
    expect(kstDay(nextAttemptAfterNoAnswer(3, at('2026-11-02T01:00:00Z'))!)).toBe('2026-11-04');
    expect(kstDay(nextAttemptAfterNoAnswer(4, at('2026-11-02T01:00:00Z'))!)).toBe('2026-11-06');
    expect(nextAttemptAfterNoAnswer(5, at('2026-11-02T01:00:00Z'))).toBeNull();
  });
  it('5번째 부재는 연락 불가로 종료, 2번째에 부재 문자 제안', () => {
    let l = base;
    const now = at('2026-11-02T01:00:00Z');
    const r2 = applyCallOutcome(applyCallOutcome(l, { kind: 'no_answer' }, now).lead, { kind: 'no_answer' }, now);
    expect(r2.suggestSms).toBe(true);
    l = r2.lead;
    for (let i = 0; i < 3; i++) l = applyCallOutcome(l, { kind: 'no_answer' }, now).lead;
    expect(l.status).toBe('closed');
    expect(l.closeReason).toBe('unreachable');
    expect(l.noAnswerCount).toBe(5);
  });
  it('통화 시간 맞추기', () => {
    expect(kstHour(clampToCallHours(at('2026-11-01T22:00:00Z')))).toBe(9); // 07시 KST → 9시
  });
});

describe('상태·대기열', () => {
  it('옛 상태를 새 상태로', () => {
    expect(normalizeLead({ ...base, status: 'no_answer_2' as any }).noAnswerCount).toBe(2);
    expect(normalizeLead({ ...base, status: 'ineligible' as any }).closeReason).toBe('not_eligible');
    expect(normalizeLead({ ...base, status: 'in_progress' as any }).status).toBe('counseling');
  });
  it('연결되면 첫 연락 시각, 재통화 약속은 10분 전부터 대기열', () => {
    const now = at('2026-11-02T01:00:00Z');
    const r = applyCallOutcome(base, { kind: 'callback', at: '2026-11-02T01:05:00Z' }, now);
    expect(r.lead.firstContactAt).toBe(now.toISOString());
    expect(queueBucket(r.lead, now)).toBe('due');
    expect(queueBucket({ ...r.lead, nextAttemptAt: '2026-11-02T03:00:00Z' }, now)).toBe('later');
    expect(queueBucket({ ...base, status: 'closed', closeReason: 'later', recontactOn: '2026-11-02' }, now)).toBe('due');
  });
});
