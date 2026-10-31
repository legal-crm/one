import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { annexRows, uniqueCreditorCount } from './creditorAnnex';
import type { RepaymentCreditor } from '../repayment/repaymentTypes';

const base = (o: Partial<RepaymentCreditor>): RepaymentCreditor => ({ id: o.id || 'x', creditorNumber: 1, name: '가은행', principal: 10_000_000, interest: 0, ...o } as RepaymentCreditor);

describe('부속서류 1~4 (DC-14)', () => {
  it('해당 채권만 해당 부속서류에, 빈 값은 빈칸', () => {
    const rows = annexRows([
      base({ id: 'a', creditorNumber: 1, isSecured: true, securedRightType: 'mortgage_max', securedRank: '1순위', securedCollateralType: 'REAL_ESTATE', collateralDescription: '○○동 1번지', unsecuredExpectedShortage: 4_000_000 }),
      base({ id: 'b', creditorNumber: 2, isDisputed: true, disputeLawsuits: [{ instance: '1', court: '서울중앙지법', caseNumber: '2025가단1', status: '진행 중' }] }),
      base({ id: 'c', creditorNumber: 3, isGarnished: true, garnishmentCourtCase: '수원지법 2025타채1', garnishmentServedOn: '2025-03-02' }),
      base({ id: 'd', creditorNumber: 4, isGuaranteedDebt: true, principalDebtorName: '김주채', guaranteeAmount: 5_000_000 }),
      base({ id: 'e', creditorNumber: 5 }),
    ]);
    expect(rows.secured).toHaveLength(1);
    expect(rows.secured[0]).toMatchObject({ right: '근저당권', rank: '1순위', collateral: '부동산 · ○○동 1번지', shortage: 4_000_000, expectedRecovery: 6_000_000 });
    expect(rows.disputed[0].lawsuits).toBe('1심 서울중앙지법 2025가단1 진행 중');
    expect(rows.assignment[0]).toMatchObject({ courtCase: '수원지법 2025타채1', servedOn: '2025-03-02', decidedOn: '' });
    expect(rows.other[0]).toMatchObject({ principalDebtor: '김주채', amount: 5_000_000 });
  });
  it('같은 채권자는 한 번만 센다', () => {
    expect(uniqueCreditorCount([
      base({ id: '1', name: '(주)가은행', address: '서울 중구 1' }),
      base({ id: '2', name: '주식회사 가은행', address: '서울 중구  1' }),
      base({ id: '3', name: '나카드', address: '서울 중구 2' }),
    ])).toBe(2);
  });
});
