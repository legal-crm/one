import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { buildInstallments } from './feeService';

describe('buildInstallments', () => {
  it('착수금 + 균등 분할, 끝전은 마지막 회차, 합계 일치', () => {
    const rows = buildInstallments({ totalFeeWon: 1_000_000, downPaymentWon: 300_000, downPaymentOn: '2026-11-01', count: 3, firstDueOn: '2026-12-10' });
    expect(rows.map(r => r.amountWon)).toEqual([300_000, 233_333, 233_333, 233_334]);
    expect(rows.reduce((s, r) => s + r.amountWon, 0)).toBe(1_000_000);
    expect(rows.map(r => r.dueOn)).toEqual(['2026-11-01', '2026-12-10', '2027-01-10', '2027-02-10']);
  });
  it('31일 기준은 짧은 달 말일로 보정', () => {
    const rows = buildInstallments({ totalFeeWon: 300_000, downPaymentWon: 0, downPaymentOn: '2027-01-01', count: 3, firstDueOn: '2027-01-31' });
    expect(rows.map(r => r.dueOn)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
  it('착수금이 총액이면 회차 없음', () => {
    const rows = buildInstallments({ totalFeeWon: 500_000, downPaymentWon: 500_000, downPaymentOn: '2026-11-01', count: 5, firstDueOn: '2026-12-01' });
    expect(rows).toHaveLength(1);
  });
});
