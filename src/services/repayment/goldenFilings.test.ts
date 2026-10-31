import { describe, expect, it } from 'vitest';
import { estimateRehabPlan } from './repaymentCalculationEngine';
import { getLivingExpense } from './repaymentConstants2026';

/**
 * 정답 세트 (LS-10·C-1, 1차): 사용자 사무소 실제 접수본에서 숫자만 옮긴 것.
 * 이름·주소·사건번호·채권자는 넣지 않는다. 사건 표시는 G1~G3 (원본 순서와 무관).
 * 옮긴 값: 가구원수·적용 생계비 표 연도·월 평균 수입·신청서의 조정된 생계비·월 변제예정액 합계·회차·총 변제예정액.
 * OCR로 읽을 수 없었던 접수본(7건)은 C-1에서 원본을 보고 더한다.
 *
 * 확인된 차이 (원 단위): 접수본의 월 변제예정액 합계는 (수입 − 생계비)보다 5~9원 크다.
 * 전산 양식이 채권자별 월 변제액을 원 미만에서 올려 합계를 내기 때문이다(채권자 수만큼 최대 몇 원).
 * 우리 엔진은 채권자별 금액 합계 = 가용소득(최대잉여법)으로 맞춘다 → 법원 서식 출력 전에 이 차이를 C-1에서 사무소와 정한다.
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
      const diff = g.filedMonthly - est.plan.monthlyPayment;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(10);
      expect(g.filedMonthly * g.months).toBe(g.filedTotal);
    });
  }
});
