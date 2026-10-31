import { describe, expect, it } from 'vitest';
import { courtStatsFor } from './correctionPrepStats';

const stats = {
  byCourt: [
    { court: '수원회생법원', orders: 3, submitted: 3, avgDays: 10, extensions: 1 },
    { court: '광주지방법원', orders: 1, submitted: 1, avgDays: 20, extensions: 0 },
  ],
  byCategory: [
    { court: '수원회생법원', category: '소득', items: 4, cannot: 1, needsFix: 0 },
    { court: '수원회생법원', category: '재산', items: 6, cannot: 0, needsFix: 1 },
    { court: '광주지방법원', category: '보험', items: 2, cannot: 0, needsFix: 0 },
  ],
};

describe('사건 법원 보정 기록 요약 (DP-6)', () => {
  it('같은 법원만, 많이 나온 분류부터', () => {
    const r = courtStatsFor(stats, '수원 회생법원');
    expect(r?.orders).toBe(3);
    expect(r?.avgDays).toBe(10);
    expect(r?.extensions).toBe(1);
    expect(r?.topCategories.map(c => c.category)).toEqual(['재산', '소득']);
  });
  it('표기 차이(지방법원/지법)를 맞춘다', () => {
    expect(courtStatsFor(stats, '광주지법')?.orders).toBe(1);
  });
  it('법원이 없거나 기록이 없으면', () => {
    expect(courtStatsFor(stats, '')).toBeNull();
    expect(courtStatsFor(stats, '대구회생법원')?.orders).toBe(0);
  });
});
