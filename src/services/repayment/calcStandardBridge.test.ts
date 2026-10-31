import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../constants';
import { applyPublishedCalcStandard } from './calcStandardBridge';
import { getLivingExpense } from './repaymentConstants2026';
import { estimateRehabPlan } from './repaymentCalculationEngine';

/** LS-5: 관리자 게시 기준표가 계산 엔진에 실제로 들어가는지 */
describe('게시 기준표 → 계산 엔진 (LS-5)', () => {
  afterEach(() => applyPublishedCalcStandard(null, null));

  it('코드 기본값을 그대로 게시하면 결과가 같다', () => {
    const before = estimateRehabPlan({ year: 2026, householdSize: 3, region: 'SEOUL', monthlyIncome: 4_500_000, housingExpense: 800_000, children: 2, educationPerChild: 150_000, assets: [], generalDebt: 80_000_000 });
    applyPublishedCalcStandard(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), 1);
    const after = estimateRehabPlan({ year: 2026, householdSize: 3, region: 'SEOUL', monthlyIncome: 4_500_000, housingExpense: 800_000, children: 2, educationPerChild: 150_000, assets: [], generalDebt: 80_000_000 });
    expect(after.recognizedLivingCost).toBe(before.recognizedLivingCost);
    expect(after.plan.monthlyPayment).toBe(before.plan.monthlyPayment);
  });

  it('관리자가 고친 값이 계산에 들어간다', () => {
    const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    s.yearlyPolicies[2026].medianIncome.values[1] = 3_000_000;
    s.yearlyPolicies[2026].housingCostLimits.Seoul[1].additionalLimit = 100_000;
    applyPublishedCalcStandard(s, 7);
    expect(getLivingExpense(1, 2026)).toBe(1_800_000);
    const est = estimateRehabPlan({ year: 2026, householdSize: 1, region: 'SEOUL', monthlyIncome: 3_000_000, housingExpense: 800_000, assets: [], generalDebt: 50_000_000 });
    expect(est.living.additionalHousingDeduction).toBe(100_000);
  });

  it('미발표(0원) 해는 앞 해 의결을 이어 쓴다', () => {
    applyPublishedCalcStandard(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), 2);
    const est = estimateRehabPlan({ year: 2027, householdSize: 1, region: 'SEOUL', monthlyIncome: 3_000_000, housingExpense: 500_000, assets: [], generalDebt: 50_000_000 });
    expect(est.living.baseLivingExpense).toBe(1_641_625);
    expect(est.living.additionalHousingDeduction).toBe(500_000 - 273_861);
  });
});
