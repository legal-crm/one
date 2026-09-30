// ============================================================
// 퀵독 계산 (순수 함수)
// - 법원 제출용 엔진(repaymentCalculationEngine)·산식 단일 기준(rehabLegalCore)을 그대로 호출해
//   퀵독 계산값이 변제계획안 화면과 달라지지 않게 한다.
// - 이전 퀵독은 청산가치를 '월 변제금 × 기간'(명목 합계)과 비교했지만,
//   플랫폼 표준은 라이프니츠 현재가치와 비교한다 (rehabLegalCore.evaluatePlanAt).
// ============================================================

import {
  calculateLivingExpenseAndDisposableIncome,
  computeAssetBreakdown,
} from '../../../services/repayment/repaymentCalculationEngine';
import type { AssetCategory, RepaymentAsset } from '../../../services/repayment/repaymentTypes';
import { evaluatePlanAt, getLeibnizFactor } from '../../../services/repayment/rehabLegalCore';
import {
  BASE_EDUCATION_EXPENSE_DEDUCTION,
  BASE_HOUSING_INCLUDED_2026,
  BASE_MEDICAL_EXPENSE_2026,
  EXEMPT_DEPOSIT_LIMIT,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  MAX_ADDITIONAL_REGULAR_EDUCATION,
  MAX_ADDITIONAL_SPECIAL_EDUCATION,
  REGION_CONFIG_2026,
  RegionType,
} from '../../../services/repayment/repaymentConstants2026';
import { localYmd } from '../../../utils/localDate';
import type { DockSharedState, LiquidationInputs } from './dockShared';
import { formatWonKorean, won } from './ui/money';

const nonNeg = (v: number) => Math.max(0, Math.round(Number(v) || 0));

/** 가구원 수 선택지: 1인 ~ 8인, 0.5인 단위 (맞벌이 공동부양 등) */
export const HOUSEHOLD_OPTIONS: number[] = Array.from({ length: 15 }, (_, i) => 1 + i * 0.5);

/** 가구원 수 표시 (0.5 단위는 공동부양 포함) */
export function formatHousehold(size: number): string {
  return Number.isInteger(size) ? `${size}인` : `${size}인(공동부양 포함)`;
}

// ── 1. 생계비·가용소득 ──────────────────────────────────────────
export interface QuickDisposableResult {
  baseLivingExpense: number;
  totalLivingExpense: number;
  disposable: number;
}

export function computeQuickDisposable(p: {
  householdSize: number;
  monthlyIncome: number;
  extraLivingCost: number;
  region: RegionType;
}): QuickDisposableResult {
  const r = calculateLivingExpenseAndDisposableIncome({
    incomeType: 'salary',
    monthlyNetIncome: nonNeg(p.monthlyIncome),
    householdSize: Math.max(1, Number(p.householdSize) || 1),
    region: p.region,
    actualHousingExpense: 0,
    actualMedicalExpense: 0,
    numberOfChildren: 0,
    educationExpensePerChild: 0,
    otherApprovedExpense: nonNeg(p.extraLivingCost),
    trusteeType: 'INTERNAL',
    medianIncomeYear: 2026,
  });
  return {
    baseLivingExpense: r.baseLivingExpense,
    totalLivingExpense: r.finalTotalLivingExpense,
    disposable: r.actualDisposableIncome,
  };
}

// ── 2. 추가생계비 추정 ──────────────────────────────────────────
export interface QuickExtraExpenseResult {
  housing: number;
  medical: number;
  education: number;
  total: number;
  /** 참고 기준값 (엔진과 같은 상수) */
  housingLimit: number;
  housingIncluded: number;
  medicalBase: number;
  educationIncluded: number;
  educationCap: number;
}

export function computeQuickExtraExpense(p: {
  householdSize: number;
  region: RegionType;
  housing: number;
  medical: number;
  children: number;
  educationPerChild: number;
  special: boolean;
}): QuickExtraExpenseResult {
  const householdSize = Math.max(1, Number(p.householdSize) || 1);
  const r = calculateLivingExpenseAndDisposableIncome({
    incomeType: 'salary',
    monthlyNetIncome: 0,
    householdSize,
    region: p.region,
    actualHousingExpense: nonNeg(p.housing),
    actualMedicalExpense: nonNeg(p.medical),
    numberOfChildren: Math.max(0, Math.floor(Number(p.children) || 0)),
    educationExpensePerChild: nonNeg(p.educationPerChild),
    isSpecialEducation: p.special,
    otherApprovedExpense: 0,
    trusteeType: 'INTERNAL',
    medianIncomeYear: 2026,
  });
  const intSize = Math.floor(householdSize);
  return {
    housing: r.additionalHousingDeduction,
    medical: r.additionalMedicalDeduction,
    education: r.additionalEducationDeduction,
    total: r.totalAdditionalExpense,
    housingLimit: REGION_CONFIG_2026[p.region].housingLimit,
    housingIncluded: BASE_HOUSING_INCLUDED_2026[intSize] ?? Math.round(r.baseLivingExpense * 0.178),
    medicalBase: BASE_MEDICAL_EXPENSE_2026[Math.min(4, Math.max(1, intSize))],
    educationIncluded: BASE_EDUCATION_EXPENSE_DEDUCTION,
    educationCap: p.special ? MAX_ADDITIONAL_SPECIAL_EDUCATION : MAX_ADDITIONAL_REGULAR_EDUCATION,
  };
}

// ── 3. 청산가치 (법정 공제 반영) ─────────────────────────────────
export interface LiquidationRow {
  key: string;
  label: string;
  note: string;
  input: number;
  /** 입력액 − 반영액 (공제·담보·반영비율로 줄어든 금액) */
  reduction: number;
  value: number;
}

export interface QuickLiquidationResult {
  rows: LiquidationRow[];
  total: number;
}

export function computeQuickLiquidation(inp: LiquidationInputs, region: RegionType): QuickLiquidationResult {
  const drafts: { key: string; label: string; note: string; asset: RepaymentAsset }[] = [];
  const add = (
    key: string,
    label: string,
    note: string,
    category: AssetCategory,
    marketValue: number,
    extra: Partial<RepaymentAsset> = {},
  ) => {
    const mv = nonNeg(marketValue);
    if (mv <= 0) return;
    drafts.push({
      key,
      label,
      note,
      asset: { id: key, name: label, category, marketValue: mv, encumbrance: 0, statutoryDeduction: 0, liquidationValue: 0, ...extra },
    });
  };

  const lease = HOUSING_EXEMPT_DEPOSIT_LIMITS[region];
  const leaseLoan = nonNeg(inp.leaseLoan);
  const leaseNote = inp.leaseDeposit <= lease.maxDeposit
    ? `소액임차 ${formatWonKorean(lease.exemptAmount)} 공제`
    : '소액임차 기준 초과 · 공제 없음';

  add('housing', '주택·아파트', '순가액', 'REAL_ESTATE', inp.housing);
  add('land', '토지·임야', '순가액', 'REAL_ESTATE', inp.land);
  add('vehicle', '차량', '순가액', 'CAR', inp.vehicle);
  add('leaseDeposit', '임차보증금', leaseLoan > 0 ? `${leaseNote} · 대출 차감` : leaseNote, 'HOUSING_DEPOSIT', inp.leaseDeposit, { encumbrance: leaseLoan });
  add('deposits', '예금·적금', `${formatWonKorean(EXEMPT_DEPOSIT_LIMIT)} 공제`, 'DEPOSIT', inp.deposits);
  add('insurance', '보장성보험 해약환급금', `${formatWonKorean(EXEMPT_INSURANCE_REFUND_LIMIT)} 공제`, 'INSURANCE', inp.insurance);
  add('severance', '퇴직금', inp.isPension ? '퇴직연금 · 0원' : '1/2 공제', 'RETIREMENT', inp.severance, { isRetirementPension: inp.isPension });
  if (inp.spouseRatio > 0) {
    add('spouse', '배우자 명의 재산', `${Math.round(inp.spouseRatio * 100)}% 반영`, 'OTHER', inp.spouseNet, {
      ownerType: 'SPOUSE',
      spouseContributionRatio: inp.spouseRatio,
    });
  }
  add('other', '기타 재산', '공제 없음', 'OTHER', inp.other);
  add('additional', '청산가치 가산액', '공제 없음', 'ADDITIONAL_INCLUSION', inp.additional);

  const breakdown = computeAssetBreakdown(drafts.map(d => d.asset), region);
  const rows: LiquidationRow[] = breakdown.map((a, i) => ({
    key: drafts[i].key,
    label: drafts[i].label,
    note: drafts[i].note,
    input: a.marketValue,
    reduction: Math.max(0, a.marketValue - a.liquidationValue),
    value: a.liquidationValue,
  }));
  return { rows, total: rows.reduce((sum, r) => sum + r.value, 0) };
}

// ── 4. 변제계획 점검 (현재가치·최저변제액) ───────────────────────
export interface QuickPlanResult {
  principal: number;
  monthly: number;
  months: number;
  /** 월 변제금 × 기간 */
  nominalTotal: number;
  /** 원금을 넘지 않는 총변제액 */
  totalRepayment: number;
  repaymentRate: number;
  forgiven: number;
  /** 기간 안에 원금을 모두 갚는지 (조기 완제) */
  fullPayoff: boolean;
  payoffMonths: number | null;
  leibnizFactor: number;
  presentValue: number;
  minimumRepayment: number;
  satisfiesMinimum: boolean;
  liquidationValue: number;
  satisfiesLiquidation: boolean;
  requiredMonthlyForLiquidation: number;
  requiredMonthlyForMinimum: number;
}

export function evaluateQuickPlan(p: {
  totalDebt: number;
  monthlyPay: number;
  months: number;
  liquidationValue: number;
}): QuickPlanResult {
  const principal = nonNeg(p.totalDebt);
  const monthly = nonNeg(p.monthlyPay);
  const months = Math.min(60, Math.max(1, Math.round(Number(p.months) || 36)));
  const liquidationValue = nonNeg(p.liquidationValue);
  const ctx = { liquidationValue, generalDebt: principal, priorityDebt: 0 };

  const nominalTotal = monthly * months;
  const fullPayoff = principal > 0 && monthly > 0 && nominalTotal >= principal;
  const payoffMonths = fullPayoff ? Math.max(1, Math.ceil(principal / monthly)) : null;
  const check = evaluatePlanAt(payoffMonths ?? months, monthly, ctx);
  const totalRepayment = principal > 0 ? Math.min(principal, nominalTotal) : nominalTotal;
  const factor = getLeibnizFactor(months);

  return {
    principal,
    monthly,
    months,
    nominalTotal,
    totalRepayment,
    repaymentRate: principal > 0 ? (totalRepayment / principal) * 100 : 0,
    forgiven: Math.max(0, principal - totalRepayment),
    fullPayoff,
    payoffMonths,
    leibnizFactor: check.leibnizFactor,
    presentValue: check.presentValue,
    minimumRepayment: check.minimumRepayment,
    satisfiesMinimum: principal > 0 && (nominalTotal >= check.minimumRepayment || nominalTotal >= principal),
    liquidationValue,
    satisfiesLiquidation: check.satisfiesLiquidation,
    requiredMonthlyForLiquidation: liquidationValue > 0 && factor > 0 ? Math.ceil(liquidationValue / factor) : 0,
    requiredMonthlyForMinimum: check.minimumRepayment > 0 ? Math.ceil(check.minimumRepayment / months) : 0,
  };
}

// ── 5. 상담 메모용 요약 ──────────────────────────────────────────
/** 공유값으로 만든 계산 요약 (입력된 항목만). 입력값이 없으면 null */
export function buildDockSummary(s: DockSharedState, now: Date = new Date()): string | null {
  const lines: string[] = [];
  const liquidation = computeQuickLiquidation(s.liquidation, s.region).total;

  if (s.monthlyIncome > 0) {
    const d = computeQuickDisposable(s);
    lines.push(
      `• 가구원 ${formatHousehold(s.householdSize)} · 월 소득 ${won(s.monthlyIncome)} · 인정 생계비 ${won(d.baseLivingExpense)}` +
        `${s.extraLivingCost > 0 ? ` + 추가생계비 ${won(s.extraLivingCost)}` : ''} → 가용소득 ${won(d.disposable)}`,
    );
  }

  if (s.totalDebt > 0 || s.monthlyPay > 0) {
    const plan = evaluateQuickPlan({
      totalDebt: s.totalDebt,
      monthlyPay: s.monthlyPay,
      months: s.periodMonths,
      liquidationValue: liquidation,
    });
    lines.push(
      `• 총 채무 ${formatWonKorean(s.totalDebt)} · 월 변제금 ${won(s.monthlyPay)} × ${plan.months}개월 = ${formatWonKorean(plan.totalRepayment)}` +
        `${s.totalDebt > 0 ? ` (변제율 ${plan.repaymentRate.toFixed(1)}%)` : ''}`,
    );
    if (s.monthlyPay > 0) {
      lines.push(
        `• 현재가치 ${won(plan.presentValue)} (라이프니츠 ${plan.leibnizFactor})` +
          `${s.totalDebt > 0 ? ` · 최저변제액 ${won(plan.minimumRepayment)} ${plan.satisfiesMinimum ? '충족' : '미달'}` : ''}`,
      );
    }
    if (liquidation > 0) {
      lines.push(
        `• 청산가치 ${formatWonKorean(liquidation)} → ` +
          (s.monthlyPay > 0
            ? plan.satisfiesLiquidation
              ? '현재가치 기준 충족'
              : `현재가치 기준 미달 (${plan.months}개월이면 월 ${won(plan.requiredMonthlyForLiquidation)} 이상)`
            : '월 변제금 미입력'),
      );
    }
  } else if (liquidation > 0) {
    lines.push(`• 청산가치 ${formatWonKorean(liquidation)}`);
  }

  if (s.creditorCount > 0) lines.push(`• 채권자 ${s.creditorCount}곳`);

  if (lines.length === 0) return null;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return [`[퀵툴 계산 요약 · ${localYmd(now)} ${hh}:${mm} · 참고용]`, ...lines].join('\n');
}
