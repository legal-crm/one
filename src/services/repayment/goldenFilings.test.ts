import { describe, expect, it } from 'vitest';
import { estimateRehabPlan } from './repaymentCalculationEngine';
import { getLivingExpense } from './repaymentConstants2026';

/**
 * 정답 세트 (LS-10·C-1, 1차): 사용자 사무소 실제 접수본에서 숫자만 옮긴 것.
 * 이름·주소·사건번호·채권자는 넣지 않는다. 사건 표시는 G1~G3 (원본 순서와 무관).
 * 옮긴 값: 가구원수·적용 생계비 표 연도·월 평균 수입·신청서의 조정된 생계비·월 변제예정액 합계·회차·총 변제예정액.
 * OCR로 읽을 수 없었던 접수본(7건)은 C-1에서 원본을 보고 더한다.
 *
 * 접수본의 월 변제예정액 합계는 (수입 − 생계비)보다 5~9원 크다. 전산 양식이 채권자별 월 변제액을 원 미만에서
 * 올리기 때문이다. C-1 결정(11-01)으로 우리 엔진(buildRepaymentPlan)도 채권자별 올림을 쓴다 (apportionCeilByWeights).
 * 여기 정답 세트는 채권자 목록이 없어 계획 단위(가용소득)만 비교하고, 채권자별 올림은 repaymentRounding.test.ts에서 본다.
 * 접수본 G1의 (N) 총 실제 가용소득 = 가용소득 × 36 = 11,332,512원, (F) 총 변제예정액 = 11,332,836원 (= 314,801 × 36).
 */
const GOLDEN = [
  { id: 'G1', year: 2025, household: 1, income: 1_750_000, filedLiving: 1_435_208, filedMonthly: 314_801, months: 36, filedTotal: 11_332_836 },
  { id: 'G2', year: 2025, household: 1, income: 1_500_000, filedLiving: 1_435_208, filedMonthly: 64_797, months: 36, filedTotal: 2_332_692 },
  { id: 'G3', year: 2025, household: 1, income: 2_573_553, filedLiving: 1_435_208, filedMonthly: 1_138_352, months: 36, filedTotal: 40_980_672 },
];

describe('실제 접수본 정답 세트 (1차)', () => {
  for (const g of GOLDEN) {
    it(`${g.id}: 생계비는 원 단위로 같고, 월 변제금 차이는 채권자별 올림 몇 원뿐`, () => {
      expect(getLivingExpense(g.household, g.year)).toBe(g.filedLiving);
      const est = estimateRehabPlan({
        year: g.year, householdSize: g.household, region: 'OTHERS', monthlyIncome: g.income,
        assets: [], generalDebt: g.filedTotal * 3,
      });
      expect(est.recognizedLivingCost).toBe(g.filedLiving);
      expect(est.plan.months).toBe(g.months);
      expect(est.plan.monthlyPayment).toBe(g.income - g.filedLiving);
      const diff = g.filedMonthly - est.plan.monthlyPayment;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(10);
      expect(g.filedMonthly * g.months).toBe(g.filedTotal);
    });
  }
});
