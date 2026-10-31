import { describe, expect, it } from 'vitest';
import { d5103BaseLivingCost, d5103HouseholdSize } from './incomeExpenseService';
import { getLivingExpense } from '../repayment/repaymentConstants2026';

const member = (eligible: boolean, share?: 0.5) => ({
  id: Math.random().toString(36), relationship: '자녀', name: '', birthDate: '', cohabitationStatus: '동거' as const,
  cohabitationPeriod: '', isSupportedByDebtor: true, hasIncome: false, jobAndIncomeDetail: '', isEligibleDependent: eligible,
  ...(share ? { dependentShare: share } : {}),
});

describe('D5103 가구원 수·기준생계비 (B-6)', () => {
  it('공동부양 가족은 0.5인으로 센다', () => {
    expect(d5103HouseholdSize([member(true), member(true, 0.5), member(false)] as any)).toBe(1.5);
    expect(d5103HouseholdSize([member(true), member(true, 0.5), member(true, 0.5)] as any)).toBe(2);
  });
  it('최소 1인', () => {
    expect(d5103HouseholdSize([])).toBe(1);
  });
  it('적용 연도 표를 쓴다', () => {
    expect(d5103BaseLivingCost(2, 2027)).toBe(getLivingExpense(2, 2027));
    expect(d5103BaseLivingCost(1.5, 2026)).toBe(getLivingExpense(1.5, 2026));
    expect(d5103BaseLivingCost(1.5, 2026)).toBeGreaterThan(getLivingExpense(1, 2026));
  });
});
