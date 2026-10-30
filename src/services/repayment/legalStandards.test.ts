// 법정 기준값 정답 세트 (LS-11: 원 단위 차이도 실패)
// 근거: 27 기획서 10장 — 보건복지부고시 제2026-157호, 민사집행법 시행령(2026-02-01), 채무자회생법 시행령 제16조②
import { describe, expect, it } from 'vitest';
import {
  DEPOSIT_EXEMPTION_KRW, EXEMPT_INSURANCE_REFUND_LIMIT, WAGE_EXEMPTION_MIN_KRW, getLivingExpense,
  sixMonthLivingExemption, wageExemptAmount, MIN_LIVING_EXPENSE_60_2027,
} from './repaymentConstants2026';
import { computeAssetBreakdown } from './repaymentCalculationEngine';
import { calcCourtFees, DELIVERY_UNIT_FEE_KRW } from '../court/courtFees';
import { getPolicyForYear, getMedianIncome } from '../../rehab-chatbot-package/config/PolicyConfig';
import type { RepaymentAsset } from './repaymentTypes';

describe('기초생계비 (중위소득 60%, 원 단위 반올림)', () => {
  it('2025', () => {
    expect([1, 2, 3, 4, 5, 6].map(n => getLivingExpense(n, 2025))).toEqual([1435208, 2359595, 3015212, 3658664, 4264915, 4838883]);
  });
  it('2026', () => {
    expect([1, 2, 3, 4, 5, 6].map(n => getLivingExpense(n, 2026))).toEqual([1538543, 2519575, 3215422, 3896843, 4534031, 5133571]);
  });
  it('2027 (고시 제2026-157호, 7인 6,091,599)', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(n => getLivingExpense(n, 2027))).toEqual([1641625, 2688387, 3430855, 4157931, 4837811, 5477521, 6091599]);
    expect(MIN_LIVING_EXPENSE_60_2027[7]).toBe(6091599);
  });
  it('미발표 연도는 가장 가까운 확정 연도 값(추정 인상 없음)', () => {
    expect(getLivingExpense(1, 2028)).toBe(getLivingExpense(1, 2027));
  });
});

describe('기준 중위소득 (챗봇·제안서 정책 설정)', () => {
  it('2026 7인 = 6인 + 959,198', () => {
    expect(getMedianIncome(7, getPolicyForYear(2026))).toBe(9515150);
  });
  it('2027 실제 고시값', () => {
    const p = getPolicyForYear(2027);
    expect([1, 4, 7].map(n => getMedianIncome(n, p))).toEqual([2736042, 6929885, 10152665]);
  });
});

describe('압류금지 (민사집행법 시행령 2026-02-01)', () => {
  it('예금·급여 최저·보험 합산 각 250만 원', () => {
    expect(DEPOSIT_EXEMPTION_KRW).toBe(2_500_000);
    expect(WAGE_EXEMPTION_MIN_KRW).toBe(2_500_000);
    expect(EXEMPT_INSURANCE_REFUND_LIMIT).toBe(2_500_000);
  });
  it('급여 압류금지액', () => {
    expect(wageExemptAmount(2_000_000)).toBe(2_000_000);
    expect(wageExemptAmount(4_000_000)).toBe(2_500_000);
    expect(wageExemptAmount(5_400_000)).toBe(2_700_000);
    expect(wageExemptAmount(8_000_000)).toBe(3_500_000);
  });
  it('보험은 여러 건이어도 합계 1회만 공제', () => {
    const ins = (id: string, v: number): RepaymentAsset => ({ id, category: 'INSURANCE', marketValue: v, statutoryDeduction: 0, liquidationValue: 0 } as unknown as RepaymentAsset);
    const out = computeAssetBreakdown([ins('a', 2_000_000), ins('b', 2_000_000)]);
    expect(out.map(a => a.statutoryDeduction)).toEqual([2_000_000, 500_000]);
    expect(out.reduce((s, a) => s + a.liquidationValue, 0)).toBe(1_500_000);
  });
});

describe('파산 면제재산 6개월 생계비 = 4인 중위소득 × 40% × 6', () => {
  it('연도별', () => {
    expect(sixMonthLivingExemption(2026)).toBe(15_587_371);
    expect(sixMonthLivingExemption(2027)).toBe(16_631_724);
  });
});

describe('법원 비용', () => {
  it('송달료 1회 5,640원 (2026-07-01)', () => {
    expect(DELIVERY_UNIT_FEE_KRW).toBe(5640);
  });
  it('파산·면책 송달 회수 = (10 + 4n) + (10 + 3n)', () => {
    expect(calcCourtFees({ caseType: 'bankruptcy', creditorCount: 10 }).deliveryRounds).toBe(90);
  });
  it('회생 송달 회수 = 10 + 8n', () => {
    expect(calcCourtFees({ caseType: 'rehab', creditorCount: 10 }).deliveryRounds).toBe(90);
  });
});

import { checkShortPlanReason, shortPlanInputFromCondition, COURTS_WITH_SHORT_PLAN_RULE } from './rehabLegalCore';

describe('3년 미만 단축 사유 (실무준칙 제424호, LS-5a)', () => {
  it('6개 회생법원', () => {
    expect([...COURTS_WITH_SHORT_PLAN_RULE].sort()).toEqual(['광주회생법원', '대구회생법원', '대전회생법원', '부산회생법원', '서울회생법원', '수원회생법원'].sort());
  });
  it('사유 6가지', () => {
    const base = { courtHasRule: true };
    expect(checkShortPlanReason({ ...base, age: 66 }).eligible).toBe(true);
    expect(checkShortPlanReason({ ...base, age: 29 }).eligible).toBe(true);
    expect(checkShortPlanReason({ ...base, age: 40, minorChildren: 2 }).eligible).toBe(true);
    expect(checkShortPlanReason({ ...base, age: 40, minorChildren: 1 }).eligible).toBe(false);
    expect(checkShortPlanReason({ ...base, severeDisability: true }).eligible).toBe(true);
    expect(checkShortPlanReason({ ...base, singleParent: true }).eligible).toBe(true);
    expect(checkShortPlanReason({ ...base, rentFraud: true }).eligible).toBe(true);
  });
  it('기초생활수급자는 사유가 아님', () => {
    expect(checkShortPlanReason(shortPlanInputFromCondition('서울회생법원', 45, 'basic_recipient')).eligible).toBe(false);
  });
  it('지방법원은 확인 필요(자동 검토안 없음)', () => {
    expect(checkShortPlanReason(shortPlanInputFromCondition('인천지방법원', 25, null)).eligible).toBe(false);
  });
});
