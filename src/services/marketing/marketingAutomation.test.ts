import { describe, expect, it } from 'vitest';
// @ts-ignore — 서버·브라우저 공용 순수 JS 모듈
import { autoApprovalDecision, autoHoldMessage, dueAutoChannels, kstClock, manualApprovalCheck, nextAutoRun, normalizeAutomationConfig, AUTOMATION_DEFAULTS } from '../../../api/_lib/marketing-automation.js';

type Sev = 'high' | 'medium' | 'low';
const issue = (severity: Sev) => ({ ruleId: 't', severity, label: '시험', match: 'x', hint: '' });
const comp = (byChannel: Record<string, Sev[]>, score?: number) => {
  const b: Record<string, { issues: ReturnType<typeof issue>[]; score: number; hasDisclaimer: boolean }> = {};
  let min = 100;
  let high = 0;
  for (const [ch, sevs] of Object.entries(byChannel)) {
    const s = Math.max(0, 100 - sevs.reduce((n, v) => n + ({ high: 20, medium: 8, low: 3 }[v]), 0));
    b[ch] = { issues: sevs.map(issue), score: s, hasDisclaimer: true };
    min = Math.min(min, s);
    high += sevs.filter(v => v === 'high').length;
  }
  return { byChannel: b, score: score ?? min, highCount: high, publishable: high === 0 };
};
const SCHEDULE = [
  { channel: 'blog', time: '10:00' }, { channel: 'threads', time: '12:30' }, { channel: 'facebook', time: '14:00' },
];
const L2 = { ...AUTOMATION_DEFAULTS };

describe('마케팅 자동화 수준 (M-1)', () => {
  it('설정 정리: 모르는 값은 안전한 쪽(L1·엄격), 점수는 70~100, 채널은 API 채널만', () => {
    expect(normalizeAutomationConfig(null)).toMatchObject({ level: 'L1', checkMode: 'strict', minScore: 90, autoChannels: [] });
    expect(normalizeAutomationConfig({ level: 'L3', checkMode: 'loose', minScore: 40, autoChannels: ['instagram', 'facebook', 'threads'] }))
      .toMatchObject({ level: 'L1', checkMode: 'strict', minScore: 70, autoChannels: ['threads', 'facebook'] });
    expect(normalizeAutomationConfig({ level: 'L2', minScore: '95' }).minScore).toBe(95);
  });

  it('L2 자동 승인: 고위험·수정 권고 0건이고 점수가 기준 이상일 때만', () => {
    expect(autoApprovalDecision(comp({ blog: ['low'], threads: [] }), L2)).toMatchObject({ approve: true });
    expect(autoApprovalDecision(comp({ blog: ['high'] }), L2)).toMatchObject({ approve: false, reason: 'high' });
    // 수정 권고 1건은 점수가 92점이어도 자동 승인하지 않는다 (기획서: 표시가 없는 캠페인만)
    expect(autoApprovalDecision(comp({ blog: ['medium'] }), L2)).toMatchObject({ approve: false, reason: 'medium', score: 92 });
    expect(autoApprovalDecision(comp({ blog: ['low', 'low', 'low', 'low'] }), L2)).toMatchObject({ approve: false, reason: 'score', score: 88 });
    expect(autoApprovalDecision(comp({}), L2)).toMatchObject({ approve: false, reason: 'empty' });
    expect(autoApprovalDecision(comp({ blog: [] }), { ...L2, level: 'L1' })).toMatchObject({ approve: false, reason: 'level' });
    const held = autoApprovalDecision(comp({ blog: ['low', 'low', 'low', 'low'] }), L2);
    expect(autoHoldMessage(held, L2)).toContain('88점');
  });

  it('사람 승인: 엄격 모드는 고위험이 남으면 막고, 권고 모드는 사유 5자 이상이면 허용', () => {
    const risky = comp({ threads: ['high'] });
    expect(manualApprovalCheck(comp({ blog: ['medium'] }), L2, '')).toMatchObject({ ok: true, kind: 'manual', note: null });
    expect(manualApprovalCheck(risky, L2, '사유를 충분히 적음')).toMatchObject({ ok: false, status: 409 });
    const advisory = { ...L2, checkMode: 'advisory' };
    expect(manualApprovalCheck(risky, advisory, '짧음')).toMatchObject({ ok: false, status: 400 });
    const ok = manualApprovalCheck(risky, advisory, '뉴스 원문 수치라 그대로 둠') as { ok: boolean; note: string };
    expect(ok).toMatchObject({ ok: true, kind: 'advisory', high: 1 });
    expect(ok.note).toContain('권고 모드 승인');
    expect(ok.note.length).toBeLessThanOrEqual(300);
  });

  it('낮 자동 게시: 시각이 지난 켠 채널 중 키·콘텐츠가 있고 아직 안 올렸고 표시가 없는 것만', () => {
    const channels = { threads: { posts: ['a'] }, facebook: { body: 'b' }, blog: { title: 't' } };
    const connected = { threads: true, facebook: true };
    const clean = comp({ threads: [], facebook: [] });
    const base = { config: L2, schedule: SCHEDULE, connected, channels, compliance: clean, posts: [] };
    expect(dueAutoChannels({ ...base, clock: '12:35' })).toEqual(['threads']);
    expect(dueAutoChannels({ ...base, clock: '14:05' })).toEqual(['threads', 'facebook']);
    expect(dueAutoChannels({ ...base, clock: '14:05', posts: [{ channel: 'threads', publish_status: 'published' }] })).toEqual(['facebook']);
    // 실패 기록은 다시 시도한다
    expect(dueAutoChannels({ ...base, clock: '14:05', posts: [{ channel: 'threads', publish_status: 'failed' }] })).toEqual(['threads', 'facebook']);
    expect(dueAutoChannels({ ...base, clock: '14:05', connected: { threads: true } })).toEqual(['threads']);
    expect(dueAutoChannels({ ...base, clock: '14:05', compliance: comp({ threads: ['medium'], facebook: [] }) })).toEqual(['facebook']);
    expect(dueAutoChannels({ ...base, clock: '14:05', config: { ...L2, autoChannels: ['facebook'] } })).toEqual(['facebook']);
    expect(dueAutoChannels({ ...base, clock: '14:05', config: { ...L2, level: 'L1' } })).toEqual([]);
  });

  it('한국 시간 시계·다음 자동 게시 시각', () => {
    expect(kstClock(Date.UTC(2026, 10, 1, 3, 35))).toBe('12:35');
    expect(kstClock(Date.UTC(2026, 10, 1, 15, 5))).toBe('00:05');
    expect(nextAutoRun('12:30', '09:00')).toBe('12:35');
    expect(nextAutoRun('12:30', '13:00')).toBe('14:05');
    expect(nextAutoRun('14:00', '09:00')).toBe('14:05');
    expect(nextAutoRun('14:00', '15:00')).toBeNull();
  });
});
