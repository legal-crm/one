import { describe, it, expect } from 'vitest';
import { calcSeedFromProfile, computePublicRange, emptyPublicCalcInput, publicShortPlan } from './publicCalculator';
import { runCaseReview, emptyReviewInput } from '../cases/caseReviewCalc';
import { computeQuickDisposable } from '../../components/lawyer/quickdock/quickCalc';

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

  it('변호사 퀵툴과 같은 생계비·가용소득 (추가 생계비 없는 경우)', () => {
    const i = { ...sample(), housing: 'free' as const, monthlyRent: 0, housingDeposit: 0, minorChildren: 0 };
    const { high } = computePublicRange(i);
    const quick = computeQuickDisposable({ householdSize: 3, monthlyIncome: 3_200_000, extraLivingCost: 0, region: 'SEOUL', year: 2026 });
    expect(high.recognizedLivingCost).toBe(quick.totalLivingExpense);
    expect(high.disposableIncome).toBe(quick.disposable);
  });

  it('회생법원 관할 + 단축 사유 사실 → 짧은 기간도 범위에 넣는다, 지방법원이면 3년으로 두고 확인 필요 안내', () => {
    const base = { ...sample(), monthlyIncome: 4_500_000, totalDebt: 150_000_000, shortFacts: { singleParent: true } };
    const atRehab = computePublicRange({ ...base, court: 'rehab_court' }).range;
    expect(atRehab.shortPlan.applied).toBe(true);
    expect(atRehab.monthsLow).toBeLessThan(36);
    expect(atRehab.monthsHigh).toBeGreaterThanOrEqual(36);
    const atDistrict = computePublicRange({ ...base, court: 'district' }).range;
    expect(atDistrict.shortPlan.applied).toBe(false);
    expect(atDistrict.shortPlan.needsCourtCheck).toBe(true);
    expect(atDistrict.monthsLow).toBeGreaterThanOrEqual(36);
    expect(atDistrict.factors.some(f => f.includes('확인해야 해서 3년'))).toBe(true);
  });

  it('출생연도로 만 65세 이상을 확인하고, 서울 취약채무자는 서울회생법원일 때만 본다', () => {
    const old = publicShortPlan({ ...sample(), birthYear: 1955, court: 'rehab_court' });
    expect(old.applied).toBe(true);
    expect(old.reasons).toContain('만 65세 이상');
    const vulnElsewhere = publicShortPlan({ ...sample(), birthYear: 1980, court: 'rehab_court', shortFacts: { vulnerableSeoul: true } });
    expect(vulnElsewhere.applied).toBe(false);
    const vulnSeoul = publicShortPlan({ ...sample(), birthYear: 1980, court: 'seoul_rehab', shortFacts: { vulnerableSeoul: true } });
    expect(vulnSeoul.applied).toBe(true);
  });

  it('근거 표시: 2027년은 고시 번호와 2026 의결 기준 안내', () => {
    const { range } = computePublicRange({ ...sample(), year: 2027 });
    expect(range.source.medianNotice).toContain('제2026-157호');
    expect(range.factors.some(f => f.includes('2026년 의결'))).toBe(true);
  });

  it('정리 자료(만 원) → 계산기 입력(원): 입력 항목만 옮긴다', () => {
    const seed = calcSeedFromProfile({
      income: 280, jobType: 'FREELANCER', debtTotal: 6000, priorityDebt: 300, dependents: 2, minorChildren: 1,
      maritalStatus: 'MARRIED', spouseIncome: 150, housingType: 'jeonse', rentalDeposit: 8000, assetsTotal: 500,
    }, '1990');
    expect(seed).toEqual({
      monthlyIncome: 2_800_000, incomeKind: 'freelance', totalDebt: 60_000_000, priorityDebt: 3_000_000,
      householdSize: 3, minorChildren: 1, spouseIncome: 'yes', housing: 'jeonse', monthlyRent: 0, housingDeposit: 80_000_000, birthYear: 1990,
    });
  });

  it('소득이 생계비 이하이면 변제금 없음으로 표시', () => {
    const { range } = computePublicRange({ ...sample(), monthlyIncome: 1_000_000 });
    // 엔진은 최저변제액을 맞추려 생계비 조정안을 낼 수 있지만, 화면은 '변제금이 계산되지 않음' 안내만 보여 준다
    expect(range.noDisposable).toBe(true);
  });
});
