/**
 * 개인회생 법률 산식 단일 기준 (Single Source of Truth)
 * ------------------------------------------------------------------
 * 법원 제출용 정밀 엔진(repaymentCalculationEngine.ts)의 산식을 기준으로,
 * 고객 진단기(calculationService.ts)·인테이크/CRM 엔진(rehabEngine.ts)이
 * 모두 이 모듈의 함수만 사용하도록 통합한다.
 *
 *  1) 인정 생계비   : 2026 기준 중위소득 60% (법원 공시 원 단위 절사값)
 *  2) 라이프니츠    : 연 5%(월 5/12%) 복리 현가 계수, 36개월 = 33.3657
 *  3) 변제기간      : [24(특례)] → 36 → 60개월 순으로 청산가치·최저변제액·우선채권 요건 검증
 *  4) 청년·취약계층 : 관할 법원 허용 시 3년 미만 단축 사유
 *  5) 조세 우선변제 : 우선권 채권은 변제기간의 1/2 이내 완납 (2단계 변제)
 *  6) 최저변제액    : 채무 5천만 원 미만 5%, 이상 3% + 100만 원
 */

import { getLivingExpense, getLeibnizFactor, LEIBNIZ_MONTHLY_RATE } from './repaymentConstants2026';

export { getLeibnizFactor, LEIBNIZ_MONTHLY_RATE };

// ── 1. 인정 생계비 ────────────────────────────────────────────────
export function getRecognizedLivingCost2026(householdSize: number): number {
  return getLivingExpense(Math.max(1, householdSize), 2026);
}

/** 월 변제금의 현재가치 (원 미만 버림, 법원 엔진과 동일) */
export function presentValueOf(monthlyPayment: number, months: number): number {
  return Math.floor(Math.max(0, monthlyPayment) * getLeibnizFactor(months));
}

// ── 6. 최저변제액 ────────────────────────────────────────────────
export function getMinimumRepaymentThreshold(totalPrincipal: number): number {
  if (totalPrincipal <= 0) return 0;
  return totalPrincipal < 50_000_000
    ? Math.round(totalPrincipal * 0.05)
    : Math.round(totalPrincipal * 0.03) + 1_000_000;
}

// ── 4. 3년 미만 단축 사유 ──────────────────────────────────────────
// 근거: 6개 회생법원 실무준칙 제424호 '변제기간 3년 미만 사유' (27 기획서 10장, 10-29 원문 확인·사용자 확정)
// - 이전 '24개월 특례 3곳(서울·수원·부산)'·기초생활수급자 사유는 원문과 달라 폐기
// - 사유가 있어도 자동으로 24개월이 되지 않는다: '3년 미만 검토안'(24개월 계산)을 만들어 변호사가 판단
// - 지방법원(회생법원 아닌 관할)은 '확인 필요' → 자동 검토안 없음
export interface ShortPlanInput {
  courtHasRule: boolean;
  age?: number;
  severeDisability?: boolean;
  singleParent?: boolean;
  rentFraud?: boolean;
  /** 부양하는 미성년 자녀 수 (2명 이상이면 사유) */
  minorChildren?: number;
  /** 만 65세 이상 (age 로도 판정) */
  elderly?: boolean;
  /** 서울회생법원 2026-10-01 제7호 취약채무자 (변호사가 요건 확인 후 입력) */
  vulnerableDebtorSeoul?: boolean;
}

/** 제424호 사유 목록을 운영하는 6개 회생법원 */
export const COURTS_WITH_SHORT_PLAN_RULE = ['서울회생법원', '수원회생법원', '부산회생법원', '대전회생법원', '대구회생법원', '광주회생법원'] as const;

export function courtHasShortPlanRule(courtName?: string): boolean {
  return !!courtName && (COURTS_WITH_SHORT_PLAN_RULE as readonly string[]).includes(courtName);
}

/** 챗봇·인테이크의 specialCondition 값을 단축 사유 입력으로 변환 */
export function shortPlanInputFromCondition(
  courtName: string | undefined,
  age: number | undefined,
  condition?: string | null,
  minorChildren?: number,
): ShortPlanInput {
  return {
    courtHasRule: courtHasShortPlanRule(courtName),
    age,
    severeDisability: condition === 'severe_disability',
    singleParent: condition === 'single_parent',
    rentFraud: condition === 'rent_fraud',
    elderly: condition === 'elderly',
    minorChildren,
  };
}

export function checkShortPlanReason(input: ShortPlanInput): { eligible: boolean; reason: string } {
  if (!input.courtHasRule) return { eligible: false, reason: '관할 법원의 3년 미만 단축 사유는 확인이 필요함' };
  const reasons: string[] = [];
  const age = typeof input.age === 'number' && input.age > 0 ? input.age : undefined;
  if (input.elderly || (age !== undefined && age >= 65)) reasons.push('만 65세 이상');
  if (input.severeDisability) reasons.push('장애의 정도가 심한 장애인');
  if (age !== undefined && age < 30) reasons.push('만 30세 미만');
  if ((input.minorChildren || 0) >= 2) reasons.push('미성년 자녀 2명 이상 부양');
  if (input.singleParent) reasons.push('한부모 가족');
  if (input.rentFraud) reasons.push('전세사기 피해자');
  if (input.vulnerableDebtorSeoul) reasons.push('취약채무자(서울회생법원)');
  return reasons.length > 0
    ? { eligible: true, reason: reasons.join(', ') }
    : { eligible: false, reason: '3년 미만 단축 사유 없음' };
}

// ── 3·5. 기간별 요건 검증 ────────────────────────────────────────
export interface PlanCheckContext {
  liquidationValue: number;
  generalDebt: number;
  priorityDebt: number;
}

export interface PlanCheck {
  months: number;
  monthlyPayment: number;
  totalRepayment: number;
  leibnizFactor: number;
  presentValue: number;
  minimumRepayment: number;
  satisfiesLiquidation: boolean;
  satisfiesMinimum: boolean;
  prioritySettleMonths: number;
  satisfiesPriority: boolean;
}

export function evaluatePlanAt(months: number, monthlyPayment: number, ctx: PlanCheckContext): PlanCheck {
  const principal = Math.max(0, ctx.generalDebt) + Math.max(0, ctx.priorityDebt);
  const monthly = Math.max(0, Math.round(monthlyPayment));
  const totalRepayment = Math.min(principal, monthly * months);
  const presentValue = presentValueOf(monthly, months);
  const minimumRepayment = getMinimumRepaymentThreshold(principal);
  const prioritySettleMonths = ctx.priorityDebt > 0
    ? (monthly > 0 ? Math.ceil(ctx.priorityDebt / monthly) : Number.POSITIVE_INFINITY)
    : 0;
  return {
    months,
    monthlyPayment: monthly,
    totalRepayment,
    leibnizFactor: getLeibnizFactor(months),
    presentValue,
    minimumRepayment,
    satisfiesLiquidation: presentValue >= ctx.liquidationValue,
    satisfiesMinimum: monthly * months >= minimumRepayment || monthly * months >= principal,
    prioritySettleMonths,
    satisfiesPriority: ctx.priorityDebt <= 0 || prioritySettleMonths <= Math.floor(months / 2),
  };
}

// ── 통합 변제계획 판정 ──────────────────────────────────────────
export type CorePlanStatus =
  | 'SHORT_PLAN'          // 3년 미만 단축 사유
  | 'STANDARD'            // 36개월 표준
  | 'EXTENDED'            // 60개월 연장
  | 'FULL_PAYOFF'         // 가용소득으로 원금 조기 완제
  | 'LIVING_COST_CUT'     // 60개월로도 부족 → 생계비 감액 필요 (법원 엔진 Step C)
  | 'ASSET_DISPOSAL'      // 소득 전액으로도 부족 → 재산처분 병행(D5111)
  | 'LIQUIDATION_EXCEEDS' // 청산가치 ≥ 채무 → 개인회생 실익 없음
  | 'NO_DEBT';

export interface CorePlanInput {
  monthlyIncome: number;
  recognizedLivingCost: number;
  liquidationValue: number;
  generalDebt: number;      // 우선권 제외 일반 회생채권 원금
  priorityDebt?: number;    // 조세 등 우선권 채권
  allowShortPlan?: boolean;        // checkShortPlanReason 결과
}

export interface CorePlanResult extends PlanCheck {
  status: CorePlanStatus;
  disposableIncome: number;
  generalRepayment: number;
  priorityRepayment: number;
  livingCostCut: number;
  livingCostCutRate: number;
  warnings: string[];
  why: string;
}

export function determineRepaymentPlan(input: CorePlanInput): CorePlanResult {
  const priorityDebt = Math.max(0, input.priorityDebt || 0);
  const generalDebt = Math.max(0, input.generalDebt);
  const principal = generalDebt + priorityDebt;
  const disposable = Math.max(0, Math.round(input.monthlyIncome - input.recognizedLivingCost));
  const ctx: PlanCheckContext = { liquidationValue: Math.max(0, input.liquidationValue), generalDebt, priorityDebt };
  const warnings: string[] = [];

  const finish = (check: PlanCheck, status: CorePlanStatus, why: string, livingCostCut = 0): CorePlanResult => {
    const priorityRepayment = Math.min(priorityDebt, check.totalRepayment);
    return {
      ...check,
      status,
      disposableIncome: disposable,
      generalRepayment: Math.max(0, check.totalRepayment - priorityRepayment),
      priorityRepayment,
      livingCostCut,
      livingCostCutRate: input.recognizedLivingCost > 0 ? livingCostCut / input.recognizedLivingCost : 0,
      warnings,
      why,
    };
  };

  if (principal <= 0) {
    return finish(evaluatePlanAt(0, 0, ctx), 'NO_DEBT', '변제 대상 채무 없음');
  }
  if (ctx.liquidationValue >= principal) {
    warnings.push('청산가치가 총 채무 이상이어서 개인회생의 실익이 없습니다(청산가치 보장 원칙).');
    return finish(evaluatePlanAt(36, disposable, ctx), 'LIQUIDATION_EXCEEDS', '청산가치 ≥ 총 채무');
  }
  if (disposable <= 0) {
    warnings.push('월 소득이 인정 생계비 이하입니다. 개인파산 절차도 함께 검토가 필요합니다.');
  }

  // 1) 가용소득 그대로 [24] → 36 → 60 순차 검증 (법원 엔진 Step A·B)
  const candidates = input.allowShortPlan ? [24, 36, 60] : [36, 60];
  for (const m of candidates) {
    const check = evaluatePlanAt(m, disposable, ctx);
    if (disposable > 0 && check.satisfiesLiquidation && check.satisfiesMinimum && check.satisfiesPriority) {
      // 원금 조기 완제 가능 시 기간 단축
      if (disposable * m > principal) {
        const payoffMonths = Math.max(1, Math.ceil(principal / disposable));
        const payoff = evaluatePlanAt(payoffMonths, disposable, ctx);
        return finish({ ...payoff, totalRepayment: principal }, 'FULL_PAYOFF', `가용소득으로 ${payoffMonths}개월 내 원금 전액 변제 가능`);
      }
      const status: CorePlanStatus = m === 24 ? 'SHORT_PLAN' : m === 36 ? 'STANDARD' : 'EXTENDED';
      const why = m === 24
        ? '3년 미만 단축 사유 요건 충족 (청산가치·최저변제액 충족)'
        : m === 36
          ? '36개월 표준 변제 (청산가치·최저변제액·우선채권 요건 충족)'
          : '36개월로 요건 미충족 → 60개월 연장';
      return finish(check, status, why);
    }
  }

  // 2) 60개월로도 미달 → 필요 최소 월 변제금 산출 (법원 엔진 Step C)
  const m = 60;
  const requiredMonthly = Math.max(
    Math.ceil(ctx.liquidationValue / getLeibnizFactor(m)),
    Math.ceil(getMinimumRepaymentThreshold(principal) / m),
    priorityDebt > 0 ? Math.ceil(priorityDebt / Math.floor(m / 2)) : 0,
    1,
  );

  if (requiredMonthly <= input.monthlyIncome) {
    const cut = Math.max(0, requiredMonthly - disposable);
    warnings.push(`60개월 변제에도 요건을 충족하려면 생계비를 월 ${cut.toLocaleString()}원 줄여야 합니다. 법원이 인정하지 않을 수 있습니다.`);
    return finish(evaluatePlanAt(m, requiredMonthly, ctx), 'LIVING_COST_CUT', '60개월 연장 + 생계비 감액 필요', cut);
  }

  warnings.push('소득 전액을 변제에 투입해도 청산가치에 미달합니다. 재산 처분을 병행하는 변제계획(D5111) 검토가 필요합니다.');
  return finish(evaluatePlanAt(m, Math.round(input.monthlyIncome), ctx), 'ASSET_DISPOSAL', '소득 전액 투입 시에도 청산가치 미달', Math.max(0, input.monthlyIncome - disposable));
}
