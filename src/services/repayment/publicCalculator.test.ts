import { describe, it, expect } from 'vitest';
import { computePublicRange, emptyPublicCalcInput } from './publicCalculator';
import { runCaseReview, emptyReviewInput } from '../cases/caseReviewCalc';

const sample = () => ({
  ...emptyPublicCalcInput(2026),
  monthlyIncome: 3_200_000, totalDebt: 80_000_000, householdSize: 3, minorChildren: 1,
  region: 'SEOUL' as const, housing: 'rent' as const, monthlyRent: 700_000, housingDeposit: 10_000_000,
});

describe('제도 이해용 계산기 (B-7)', () => {
  it('변호사 사건 검토(같은 엔진)의 결과가 범위 안에 든다', () => {
    const i = sample();
    const { range } = computePublicRange(i);
    const lawyer = runCaseReview({
      ...emptyReviewInput(2026), householdSize: 3, region: 'SEOUL', monthlyIncome: 3_200_000, housingExpense: 700_000,
      children: 1, generalDebt: 80_000_000, housingDeposit: 10_000_000,
    });
    expect(lawyer.monthlyPayment).toBeGreaterThanOrEqual(range.monthlyLow);
    expect(lawyer.monthlyPayment).toBeLessThanOrEqual(range.monthlyHigh);
  });

  it('빠른 모드 범위 안에 전체 모드 결과가 든다 (재산 없음)', () => {
    const i = sample();
    const quick = computePublicRange({ ...i, monthlyRent: 0, housingDeposit: 0 }, true).range;
    const full = computePublicRange(i).range;
    expect(full.monthlyLow).toBeGreaterThanOrEqual(quick.monthlyLow);
    expect(full.monthlyHigh).toBeLessThanOrEqual(quick.monthlyHigh);
  });

  it('감면율·감면액·가능성 표현을 만들지 않는다', () => {
    const { range } = computePublicRange(sample());
    const text = JSON.stringify(range);
    for (const w of ['감면율', '감면액', '탕감', '가능성', '가능합니다', '불가']) expect(text.includes(w)).toBe(false);
  });

  it('소득이 생계비 이하이면 변제금 없음으로 표시', () => {
    const { range } = computePublicRange({ ...sample(), monthlyIncome: 1_000_000 });
    // 엔진은 최저변제액을 맞추려 생계비 조정안을 낼 수 있지만, 화면은 '변제금이 계산되지 않음' 안내만 보여 준다
    expect(range.noDisposable).toBe(true);
  });
});
