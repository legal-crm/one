import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { DEFAULT_CONSULT_HOURS, groupSlotsByDay, validateWeekly } from './consultHoursService';

describe('상담 가능 시간표', () => {
  it('validates weekly windows like the server', () => {
    expect(validateWeekly(DEFAULT_CONSULT_HOURS.weekly)).toBeNull();
    expect(validateWeekly({ '1': [['12:00', '10:00']] })).toMatch(/끝나는 시간/);
    expect(validateWeekly({ '1': [['05:00', '10:00']] })).toMatch(/06:00~23:00/);
    expect(validateWeekly({ '1': [['10:00', '11:00'], ['11:00', '12:00'], ['13:00', '14:00'], ['15:00', '16:00']] })).toMatch(/3구간/);
    expect(validateWeekly({ '1': [['9:00', '10:00']] })).toMatch(/10:00처럼/);
  });

  it('groups open slots by Korean date', () => {
    const g = groupSlotsByDay(['2026-11-03T01:00:00Z', '2026-11-03T02:00:00Z', '2026-11-02T05:30:00Z', 'bad']);
    expect(g.map(d => d.key)).toEqual(['2026-11-02', '2026-11-03']);
    expect(g[1].day).toBe('11월 3일(화)');
    expect(g[1].slots.map(s => s.time)).toEqual(['10:00', '11:00']);
    expect(g[0].slots[0].time).toBe('14:30');
  });
});
