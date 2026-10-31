import { describe, expect, it } from 'vitest';
import { apportionCeilByWeights, buildRepaymentPlan } from './repaymentCalculationEngine';

/** C-1 결정 (11-01): 채권자별 월 변제예정액은 원 미만 올림 — 실제 접수본·법원 전산 양식과 같은 방식 */
describe('채권자별 원 미만 올림 (C-1)', () => {
  it('몫마다 올림하고, 합계는 가용소득보다 (채권자 수 − 1)원 이하로만 크다', () => {
    const total = 314_792;
    const weights = [1_963_770, 2_999_886, 932_000, 20_999_999, 1_000_000, 1_000_000, 5_070_242, 4_725_970];
    const shares = apportionCeilByWeights(total, weights);
    const sumW = weights.reduce((s, w) => s + w, 0);
    shares.forEach((v, i) => expect(v).toBe(Math.ceil((total * weights[i]) / sumW)));
    const sum = shares.reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThanOrEqual(total);
    expect(sum - total).toBeLessThanOrEqual(weights.length - 1);
  });

  it('나누어떨어지면 올림해도 그대로, 가중치 0은 0원', () => {
    expect(apportionCeilByWeights(300_000, [1, 1, 1])).toEqual([100_000, 100_000, 100_000]);
    expect(apportionCeilByWeights(100_000, [5, 0, 5])).toEqual([50_000, 0, 50_000]);
    expect(apportionCeilByWeights(0, [1, 2])).toEqual([0, 0]);
  });

  it('큰 금액(원금 수십억)에서도 정수로 정확히 계산한다', () => {
    const shares = apportionCeilByWeights(9_876_543, [3_000_000_000, 7_000_000_001]);
    expect(shares[0]).toBe(2_962_963);
    expect(shares[1]).toBe(6_913_581);
  });

  it('변제계획 합계 = 채권자별 올림의 합, 총 변제예정액 = 합계 × 회차', () => {
    const base = { interest: 0, isSecured: false, isPriority: false, monthlyRepayment: 0, totalRepayment: 0, allocationRatio: 0, repaymentRate: 0 } as any;
    const plan = buildRepaymentPlan({
      clientId: 't', clientName: 't', submissionDate: '2025-11-12', startYearMonth: '2026-02',
      incomeExpense: {
        incomeType: 'salary', monthlyNetIncome: 1_750_000, householdSize: 1, region: 'OTHERS',
        actualHousingExpense: 0, actualMedicalExpense: 0, numberOfChildren: 0, educationExpensePerChild: 0,
        otherApprovedExpense: 0, trusteeType: 'INTERNAL', medianIncomeYear: 2025,
      } as any,
      assets: [],
      creditors: [
        { ...base, id: 'a', name: 'A', principal: 1_963_770 },
        { ...base, id: 'b', name: 'B', principal: 2_999_886 },
        { ...base, id: 'c', name: 'C', principal: 20_999_999 },
        { ...base, id: 'd', name: 'D', principal: 5_070_242 },
      ],
    });
    const disposable = 1_750_000 - 1_435_208;
    const sum = plan.creditors.reduce((s, c) => s + c.monthlyRepayment, 0);
    expect(plan.monthlyRepaymentTotal).toBe(sum);
    expect(sum).toBeGreaterThanOrEqual(disposable);
    expect(sum - disposable).toBeLessThanOrEqual(3);
    expect(plan.totalRepaymentAmount).toBe(sum * plan.months);
  });
});
