/**
 * 2026년 기준 개인회생 핵심 계산 엔진 (Calculation Engine)
 * - 가용소득 산정 (중위소득 60% + 추가주거/의료/교육비)
 * - 채권자 안분 배분: 원 단위 내림 후 잔여 원을 소수점 큰 순서로 1원씩 배정(최대잉여법)
 *   → 채권자별 월 변제액 합계 = 월 가용소득(정확히 일치). 법원별 단수 처리 실무가 다를 수 있으므로 제출 전 확인 필요
 * - 라이프니쯔 연 5% 복리할인 현가 검증 (36개월 33.3657 / 60개월 52.9907, rehabLegalCore 단일 표준)
 * - 전산양식 D5110 / D5111 자동 판정 및 상향 조정
 * - 실무자 수동 미세 조정(Fine-Tuning) 실시간 재계산 지원
 */

import {
  getLivingExpense,
  get2026LivingExpense,
  getLeibnizFactor,
  REGION_CONFIG_2026,
  BASE_HOUSING_INCLUDED_2026,
  BASE_MEDICAL_EXPENSE_2026,
  BASE_EDUCATION_EXPENSE_DEDUCTION,
  MAX_ADDITIONAL_REGULAR_EDUCATION,
  MAX_ADDITIONAL_SPECIAL_EDUCATION,
  EXEMPT_DEPOSIT_LIMIT,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  LEIBNIZ_FACTOR_36,
  LEIBNIZ_FACTOR_60,
  LEIBNIZ_FACTORS,
} from './repaymentConstants2026';
import { getMinimumRepaymentThreshold } from './rehabLegalCore';
import { localYmd } from '../../utils/localDate';

/**
 * 최대잉여법(largest remainder) 안분: 각 몫을 원 단위로 내림한 뒤
 * 남은 원을 소수점 이하가 큰 순서대로 1원씩 배정해 합계를 total과 정확히 맞춘다.
 */
export function apportionByWeights(total: number, weights: number[]): number[] {
  const t = Math.max(0, Math.floor(total));
  const sumW = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (t <= 0 || sumW <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (t * Math.max(0, w)) / sumW);
  const base = raw.map((r) => Math.floor(r));
  let remain = t - base.reduce((s, b) => s + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remain > 0 && k < order.length; k++, remain--) {
    base[order[k].i] += 1;
  }
  return base;
}

import type {
  IncomeAndExpenseInput,
  CalculatedLivingExpense,
  RepaymentAsset,
  RepaymentCreditor,
  RepaymentPlanData,
  RepaymentFormType,
  PriorityFeasibilityInfo,
  GarnishmentDepositInfo,
  PropertyDisposalInfo,
  InterestRepaymentMode,
  ChildSupportInfo,
  AdultChildTransitionInfo,
  ClientSubmissionConsent,
  PresentValueBreakdown,
} from './repaymentTypes';

// ══════════════════════════════════════════════════════════════════
// STEP 1. 생계비 및 가용소득 산정 엔진
// ══════════════════════════════════════════════════════════════════

export function calculateLivingExpenseAndDisposableIncome(
  input: IncomeAndExpenseInput
): CalculatedLivingExpense {
  const {
    monthlyNetIncome,
    householdSize,
    region,
    actualHousingExpense = 0,
    actualMedicalExpense = 0,
    numberOfChildren = 0,
    educationExpensePerChild = 0,
    isSpecialEducation = false,
    otherApprovedExpense = 0,
    trusteeType = 'INTERNAL',
    medianIncomeYear = 2026,
    isAdjustedLivingCost = false,
  } = input;

  // 1. 기준연도(2025 or 2026) 기초생계비 (중위소득 60%)
  const baseLivingExpense = getLivingExpense(householdSize, medianIncomeYear);

  // 2. 추가 주거비 계산 (공식: Min(실제주거비, 지역한도) - 기초포함분)
  const regionConfig = REGION_CONFIG_2026[region] || REGION_CONFIG_2026.SEOUL;
  const housingLimit = regionConfig.housingLimit;
  
  let baseHousingIncluded = 0;
  const intHousehold = Math.floor(householdSize);
  if (intHousehold in BASE_HOUSING_INCLUDED_2026) {
    baseHousingIncluded = BASE_HOUSING_INCLUDED_2026[intHousehold];
  } else {
    baseHousingIncluded = Math.round(baseLivingExpense * 0.178); // 5인 이상 17.8%
  }
  
  const eligibleHousing = Math.min(actualHousingExpense, housingLimit);
  const additionalHousingDeduction = Math.max(0, eligibleHousing - baseHousingIncluded);

  // 3. 추가 의료비 계산 (공식: Max(0, 월평균 의료비 - 가구별 기초의료비))
  const medicalHousehold = Math.min(4, Math.max(1, intHousehold));
  const baseMedicalThreshold = BASE_MEDICAL_EXPENSE_2026[medicalHousehold] || 64619;
  const additionalMedicalDeduction = Math.max(0, actualMedicalExpense - baseMedicalThreshold);

  // 4. 추가 교육비 계산 (자녀 1인당: Min(실제지출 - 기초교육포함분 89,627원, 한도) * 자녀수)
  let additionalEducationDeduction = 0;
  if (numberOfChildren > 0 && educationExpensePerChild > 0) {
    const maxEducationLimit = isSpecialEducation
      ? MAX_ADDITIONAL_SPECIAL_EDUCATION
      : MAX_ADDITIONAL_REGULAR_EDUCATION;
    const rawPerChild = educationExpensePerChild - BASE_EDUCATION_EXPENSE_DEDUCTION;
    const deductionPerChild = Math.max(0, Math.min(rawPerChild, maxEducationLimit));
    additionalEducationDeduction = deductionPerChild * numberOfChildren;
  }

  // 5. 총 추가생계비 및 최종 인정 생계비
  const totalAdditionalExpense =
    additionalHousingDeduction +
    additionalMedicalDeduction +
    additionalEducationDeduction +
    otherApprovedExpense;
  const finalTotalLivingExpense = baseLivingExpense + totalAdditionalExpense;

  // 6. 가용소득 및 회생위원 보수 계산
  const rawDisposableIncome = Math.max(0, monthlyNetIncome - finalTotalLivingExpense);
  const trusteeFee =
    trusteeType === 'EXTERNAL' ? Math.round(rawDisposableIncome * 0.01) : 0;
  const actualDisposableIncome = Math.max(0, rawDisposableIncome - trusteeFee);

  return {
    baseLivingExpense,
    additionalHousingDeduction,
    additionalMedicalDeduction,
    additionalEducationDeduction,
    otherApprovedExpense,
    totalAdditionalExpense,
    finalTotalLivingExpense,
    rawDisposableIncome,
    trusteeFee,
    actualDisposableIncome,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 2. 재산별 청산가치(J) 산정
// ══════════════════════════════════════════════════════════════════

type AssetRegion = 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS';

/**
 * 재산 종류별 기본 법정 공제액 (단일 출처: repaymentConstants2026)
 * - 예금 185만(민사집행법 시행령 제7조), 보장성보험 150만, 주거용 임차보증금은 지역별 소액보증금 요건 충족 시
 * - 퇴직금(연금 아님)은 1/2 공제
 */
export function getDefaultStatutoryDeduction(asset: Pick<RepaymentAsset, 'category' | 'marketValue'>, region: AssetRegion = 'SEOUL'): number {
  switch (asset.category) {
    case 'DEPOSIT':
      return EXEMPT_DEPOSIT_LIMIT;
    case 'INSURANCE':
      return EXEMPT_INSURANCE_REFUND_LIMIT;
    case 'HOUSING_DEPOSIT': {
      const limitInfo = HOUSING_EXEMPT_DEPOSIT_LIMITS[region] || HOUSING_EXEMPT_DEPOSIT_LIMITS.SEOUL;
      return asset.marketValue <= limitInfo.maxDeposit ? limitInfo.exemptAmount : 0;
    }
    case 'RETIREMENT':
      return Math.round(Math.max(0, asset.marketValue) * 0.5);
    default:
      return 0;
  }
}

/** 실제 적용되는 공제액: 실무자가 직접 입력(deductionOverridden)했으면 그 값, 아니면 기본값 */
export function getEffectiveStatutoryDeduction(asset: RepaymentAsset, region: AssetRegion = 'SEOUL'): number {
  if (asset.deductionOverridden && Number.isFinite(asset.statutoryDeduction)) {
    return Math.max(0, asset.statutoryDeduction);
  }
  return getDefaultStatutoryDeduction(asset, region);
}

export function calculateAssetLiquidationValue(
  asset: RepaymentAsset,
  region: AssetRegion = 'SEOUL'
): number {
  const { 
    category, 
    marketValue, 
    encumbrance = 0, 
    isRetirementPension,
    ownerType = 'DEBTOR',
    spouseContributionRatio = 0.5,
  } = asset;

  // 배우자 명의 재산: 압류금지 공제 없이 (시가 - 선순위담보) × 기여도(기본 50%, 소명에 따라 조정)
  if (ownerType === 'SPOUSE') {
    const netSpouseEquity = Math.max(0, marketValue - encumbrance);
    const ratio = Math.min(1.0, Math.max(0.05, spouseContributionRatio));
    return Math.round(netSpouseEquity * ratio);
  }

  // 퇴직연금(DB/DC/IRP)은 청산가치 0원
  if (category === 'RETIREMENT' && isRetirementPension) return 0;
  // 편파변제, 주식/코인 손실금, 도박 낭비액 등은 공제 없이 전액 합산
  if (category === 'ADDITIONAL_INCLUSION') return Math.max(0, marketValue);

  const statutoryDeduction = getEffectiveStatutoryDeduction(asset, region);
  const net = marketValue - encumbrance - statutoryDeduction;
  return Math.max(0, net);
}

/**
 * 재산 목록 전체의 공제액·청산가치를 행별로 산출.
 * 예금 압류금지 공제(185만)는 **채무자 1인의 예금 합계**에 1회만 적용되므로,
 * 공제액을 직접 입력하지 않은 본인 명의 예금 행들에 앞에서부터 잔여 한도를 나눠 적용한다.
 */
export function computeAssetBreakdown(
  assets: RepaymentAsset[],
  region: AssetRegion = 'SEOUL'
): RepaymentAsset[] {
  let depositPool = EXEMPT_DEPOSIT_LIMIT;
  return assets.map((a) => {
    const isAutoDeposit =
      a.category === 'DEPOSIT' && !a.deductionOverridden && (a.ownerType || 'DEBTOR') === 'DEBTOR';
    if (isAutoDeposit) {
      const net = Math.max(0, a.marketValue - (a.encumbrance || 0));
      const used = Math.min(depositPool, net);
      depositPool -= used;
      return { ...a, statutoryDeduction: used, liquidationValue: Math.max(0, net - used) };
    }
    return {
      ...a,
      statutoryDeduction: (a.ownerType === 'SPOUSE' || a.category === 'ADDITIONAL_INCLUSION') ? 0 : getEffectiveStatutoryDeduction(a, region),
      liquidationValue: calculateAssetLiquidationValue(a, region),
    };
  });
}

export function calculateTotalLiquidationValue(
  assets: RepaymentAsset[],
  region: AssetRegion = 'SEOUL'
): number {
  return computeAssetBreakdown(assets, region).reduce((sum, a) => sum + a.liquidationValue, 0);
}

// ══════════════════════════════════════════════════════════════════
// STEP 3. 채권자별 안분 배분 엔진 (원 단위 최대잉여법, 합계 = 월 가용소득)
// ══════════════════════════════════════════════════════════════════

export function allocateCreditorRepayments(
  monthlyDisposableIncome: number,
  creditors: RepaymentCreditor[],
  months: number = 36,
  interestRepaymentMode: InterestRepaymentMode = 'principal_only'
): {
  allocatedCreditors: RepaymentCreditor[];
  monthlyTotal: number;
  totalRepayment: number;
  roundingDifference: number;
} {
  const unsecuredCreditors = creditors.filter((c) => !c.isSecured);
  const isSimultaneous = interestRepaymentMode === 'simultaneous_all';
  const getClaimBasis = (c: RepaymentCreditor) => isSimultaneous ? (c.principal + (c.interest || 0)) : c.principal;
  const totalBase = unsecuredCreditors.reduce((sum, c) => sum + getClaimBasis(c), 0);

  if (totalBase <= 0 || monthlyDisposableIncome <= 0) {
    const zeroed = creditors.map((c) => ({
      ...c,
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
    }));
    return {
      allocatedCreditors: zeroed,
      monthlyTotal: 0,
      totalRepayment: 0,
      roundingDifference: 0,
    };
  }

  let calculatedMonthlyTotal = 0;
  const resultCreditors: RepaymentCreditor[] = [];
  // 합계가 월 가용소득과 정확히 일치하도록 최대잉여법으로 원 단위 안분
  const shares = apportionByWeights(
    monthlyDisposableIncome,
    creditors.map((c) => (c.isSecured ? 0 : getClaimBasis(c)))
  );

  for (let idx = 0; idx < creditors.length; idx++) {
    const creditor = creditors[idx];
    if (creditor.isSecured) {
      resultCreditors.push({
        ...creditor,
        allocationRatio: 0,
        monthlyRepayment: 0,
        totalRepayment: 0,
        repaymentRate: 0,
      });
      continue;
    }

    const claim = getClaimBasis(creditor);
    const ratio = claim / totalBase;
    const monthlyRepay = shares[idx];
    calculatedMonthlyTotal += monthlyRepay;

    const totalRepay = monthlyRepay * months;
    const repaymentRate =
      claim > 0
        ? Math.round((totalRepay / claim) * 1000) / 10
        : 0;

    resultCreditors.push({
      ...creditor,
      allocationRatio: Math.round(ratio * 10000) / 10000,
      monthlyRepayment: monthlyRepay,
      totalRepayment: totalRepay,
      repaymentRate,
    });
  }

  // 단수 처리 후 월 가용소득과의 차액 (최대잉여법이므로 원 단위 입력 시 0)
  const roundingDifference = calculatedMonthlyTotal - monthlyDisposableIncome;

  return {
    allocatedCreditors: resultCreditors,
    monthlyTotal: calculatedMonthlyTotal,
    totalRepayment: calculatedMonthlyTotal * months,
    roundingDifference,
  };
}

/**
 * 별제권(담보대출/차량할부) 행사 후 예정부족액 보조 계산 함수
 * - 담보평가액 = Max(0, 시가 * 경매예상낙찰률(기본 80%) - 선순위근저당 - 소액임차보증금)
 * - 별제권 행사 후 예정부족액 = Max(0, 총 채권최고액/채무액 - 담보평가액)
 */
export function calculateSecuredShortage(params: {
  marketValue: number;
  seniorEncumbrance: number;
  exemptDeposit: number;
  appraisalRate?: number;
  totalDebtClaim: number;
}): {
  assessedCollateralValue: number;
  calculatedShortage: number;
} {
  const rate = params.appraisalRate ?? 0.8;
  const discounted = Math.round(params.marketValue * rate);
  const assessedCollateralValue = Math.max(0, discounted - params.seniorEncumbrance - params.exemptDeposit);
  const calculatedShortage = Math.max(0, params.totalDebtClaim - assessedCollateralValue);
  return { assessedCollateralValue, calculatedShortage };
}

/**
 * 우선권 채권 1단계 변제 회차 산출 (Priority Claim Algorithm)
 * ※ 법정 요건은 "변제계획에서 우선권 있는 개인회생채권 전액 변제"(채무자회생법 제611조 제1항 제2호)이다.
 *   "변제기간 1/2 이내 완납"은 법조문·준칙상 요건이 아니라 이 시스템의 **내부 보수 기준(안전 목표)**이며,
 *   실제 허용 범위는 관할 법원·회생위원 실무에 따라 다르다.
 * 1. M_max = floor(totalMonths / 2)  (내부 보수 기준)
 * 2. K = ceil(T_priority / A)
 * 3. K <= M_max: 보수 기준 충족
 * 4. K > M_max: 보수 기준 초과 경고 (K <= totalMonths면 법정 요건 자체는 충족 가능)
 */
export function evaluatePriorityRepaymentFeasibility(
  totalMonths: number,
  totalPriorityDebt: number,
  monthlyDisposableIncome: number
): PriorityFeasibilityInfo {
  const maxStage1Months = Math.floor(totalMonths / 2);
  const minRequiredMonths = monthlyDisposableIncome > 0
    ? Math.ceil(totalPriorityDebt / monthlyDisposableIncome)
    : 999;
  const canSettleWithinHalfPeriod = minRequiredMonths <= maxStage1Months;
  const requiredDisposableForHalfPeriod = maxStage1Months > 0
    ? Math.ceil(totalPriorityDebt / maxStage1Months)
    : 0;

  let riskWarning: string | undefined;
  let recommendedMonths: number | undefined;

  if (totalPriorityDebt > 0 && !canSettleWithinHalfPeriod) {
    const withinPlan = minRequiredMonths <= totalMonths;
    if (!withinPlan) {
      // 법정 요건(제611조 제1항 제2호: 변제기간 내 전액 변제) 자체를 충족하지 못함
      riskWarning = `우선권 채권(조세 등)을 ${totalMonths}개월 변제기간 내에 전액 변제할 수 없습니다 (필요 회차 ${minRequiredMonths}회). 인가 요건(제611조 제1항 제2호) 미충족 — 월 변제금 상향 또는 기간 조정이 필요합니다.`;
      recommendedMonths = totalMonths < 60 ? 60 : undefined;
    } else {
      riskWarning = `우선권 채권 완납에 ${minRequiredMonths}회가 필요해 내부 보수 기준(변제기간 1/2 = ${maxStage1Months}회)을 넘습니다. 법정 요건(기간 내 전액 변제)은 충족 가능하나, 관할 법원·회생위원 실무를 확인하세요.`;
      recommendedMonths = totalMonths < 60 && minRequiredMonths <= 30 ? 60 : undefined;
    }
  }

  return {
    maxStage1Months,
    minRequiredMonths,
    canSettleWithinHalfPeriod,
    riskWarning,
    requiredDisposableForHalfPeriod,
    recommendedMonths,
  };
}

/**
 * 우선권 있는 채권(세금/건강보험 등) 2단계 순차 자동 분할 배분 엔진
 * - 1단계(1~stage1Months회): 우선권 채권 전액 우선 충당 + 잔여분 일반채권 안분
 * - 2단계(stage1Months+1~totalMonths회): 세금 완납(0원) 후 가용소득 전액을 일반채권자들에게 원금 비율대로 재배분
 */
export function allocateTwoStageRepayments(
  monthlyDisposableIncome: number,
  creditors: RepaymentCreditor[],
  totalMonths: number = 36,
  stage1Months: number = 18
): {
  allocatedCreditors: RepaymentCreditor[];
  stage1MonthlyTotal: number;
  stage2MonthlyTotal: number;
  totalRepayment: number;
  stage2Months: number;
  /** 1단계 동안 우선권 채권이 완납되지 못하는 금액 (0이면 완납) */
  priorityShortfall: number;
} {
  // 1단계 회차는 1 ~ totalMonths 범위로 제한 (초과 입력 시 가상의 추가 회차가 생기지 않도록)
  const s1 = Math.min(Math.max(1, Math.floor(stage1Months) || 1), Math.max(1, totalMonths));
  const stage2Months = Math.max(0, totalMonths - s1);
  const unsecured = creditors.filter((c) => !c.isSecured);
  const priorityList = unsecured.filter((c) => c.isPriority);
  const generalList = unsecured.filter((c) => !c.isPriority);

  const totalPriorityPrincipal = priorityList.reduce((s, c) => s + c.principal, 0);
  const totalGeneralPrincipal = generalList.reduce((s, c) => s + c.principal, 0);

  // 1단계 우선권 채권 월 필요 변제액 (T_priority / s1)
  const reqPriorityMonthly = totalPriorityPrincipal > 0 
    ? Math.ceil(totalPriorityPrincipal / s1) 
    : 0;

  const actualPriorityMonthly = Math.min(Math.max(0, Math.floor(monthlyDisposableIncome)), reqPriorityMonthly);
  const surplusForGeneralStage1 = Math.max(0, Math.floor(monthlyDisposableIncome) - actualPriorityMonthly);
  const priorityShortfall = Math.max(0, totalPriorityPrincipal - actualPriorityMonthly * s1);

  // 원 단위 최대잉여법 안분 (합계 = 투입액)
  const prioShares = apportionByWeights(actualPriorityMonthly, creditors.map((c) => (!c.isSecured && c.isPriority ? c.principal : 0)));
  const genS1Shares = apportionByWeights(surplusForGeneralStage1, creditors.map((c) => (!c.isSecured && !c.isPriority ? c.principal : 0)));
  const genS2Shares = apportionByWeights(monthlyDisposableIncome, creditors.map((c) => (!c.isSecured && !c.isPriority ? c.principal : 0)));

  let stage1CalculatedTotal = 0;
  let stage2CalculatedTotal = 0;

  const resultCreditors: RepaymentCreditor[] = creditors.map((creditor, idx) => {
    if (creditor.isSecured) {
      return {
        ...creditor,
        allocationRatio: 0,
        stage1MonthlyRepayment: 0,
        stage2MonthlyRepayment: 0,
        monthlyRepayment: 0,
        totalRepayment: 0,
        repaymentRate: 0,
      };
    }

    if (creditor.isPriority) {
      // 우선권 채권자: 1단계에서 전액 우선 변제, 2단계는 0원
      const ratio = totalPriorityPrincipal > 0 ? creditor.principal / totalPriorityPrincipal : 0;
      const stage1Monthly = prioShares[idx];
      const stage2Monthly = 0;
      const totalRepay = stage1Monthly * s1;
      const repaymentRate = creditor.principal > 0 ? Math.round((totalRepay / creditor.principal) * 1000) / 10 : 100;

      stage1CalculatedTotal += stage1Monthly;

      return {
        ...creditor,
        allocationRatio: Math.round(ratio * 10000) / 10000,
        stage1MonthlyRepayment: stage1Monthly,
        stage2MonthlyRepayment: stage2Monthly,
        monthlyRepayment: stage1Monthly,
        totalRepayment: totalRepay,
        repaymentRate,
      };
    } else {
      // 일반 채권자: 1단계 잔여분 안분 + 2단계 전액 안분
      const ratio = totalGeneralPrincipal > 0 ? creditor.principal / totalGeneralPrincipal : 0;
      const stage1Monthly = genS1Shares[idx];
      const stage2Monthly = stage2Months > 0 ? genS2Shares[idx] : 0;
      const totalRepay = (stage1Monthly * s1) + (stage2Monthly * stage2Months);
      const repaymentRate = creditor.principal > 0 ? Math.round((totalRepay / creditor.principal) * 1000) / 10 : 0;

      stage1CalculatedTotal += stage1Monthly;
      stage2CalculatedTotal += stage2Monthly;

      return {
        ...creditor,
        allocationRatio: Math.round(ratio * 10000) / 10000,
        stage1MonthlyRepayment: stage1Monthly,
        stage2MonthlyRepayment: stage2Monthly,
        monthlyRepayment: stage2Monthly,
        totalRepayment: totalRepay,
        repaymentRate,
      };
    }
  });

  const totalRepaySum = resultCreditors.reduce((s, c) => s + c.totalRepayment, 0);

  return {
    allocatedCreditors: resultCreditors,
    stage1MonthlyTotal: stage1CalculatedTotal,
    stage2MonthlyTotal: stage2CalculatedTotal,
    totalRepayment: totalRepaySum,
    stage2Months,
    priorityShortfall,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4. 청산가치 보장 및 최저변제액 검증
// ══════════════════════════════════════════════════════════════════

export function verifyLiquidationGuaranteeAndMinRepayment(
  totalPrincipal: number,
  monthlyRepaymentTotal: number,
  months: number,
  totalLiquidationValue: number
): {
  leibnizFactor: number;
  presentValue: number;
  satisfiesLiquidationGuarantee: boolean;
  minimumRepaymentThreshold: number;
  satisfiesMinimumRepayment: boolean;
  totalRepayment: number;
  repaymentRate: number;
  liquidationShortage: number;
} {
  const factor = getLeibnizFactor(months);
  // 현가 계산 시 원 미만은 버림 처리
  const presentValue = Math.floor(monthlyRepaymentTotal * factor);
  const satisfiesLiquidationGuarantee = presentValue >= totalLiquidationValue;
  const liquidationShortage = Math.max(0, totalLiquidationValue - presentValue);

  // 최저변제액 (단일 출처: rehabLegalCore.getMinimumRepaymentThreshold)
  const minimumRepaymentThreshold = getMinimumRepaymentThreshold(totalPrincipal);

  const totalRepayment = monthlyRepaymentTotal * months;
  // 원금 전액 변제 시에는 최저변제액 요건도 충족 (rehabLegalCore.evaluatePlanAt와 동일)
  const satisfiesMinimumRepayment =
    totalRepayment >= minimumRepaymentThreshold || (totalPrincipal > 0 && totalRepayment >= totalPrincipal);
  const repaymentRate =
    totalPrincipal > 0
      ? Math.round((totalRepayment / totalPrincipal) * 1000) / 10
      : 0;

  return {
    leibnizFactor: factor,
    presentValue,
    satisfiesLiquidationGuarantee,
    minimumRepaymentThreshold,
    satisfiesMinimumRepayment,
    totalRepayment,
    repaymentRate,
    liquidationShortage,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5. 통합 변제계획안 자동 산출 & 양식 판정 (D5110 / D5111)
// ══════════════════════════════════════════════════════════════════

export interface BuildPlanOptions {
  planId?: string;
  clientId: string;
  clientName: string;
  courtName?: string;
  caseNumber?: string;
  submissionDate?: string;
  startYearMonth?: string;
  paymentDayOfMonth?: number;
  incomeExpense: IncomeAndExpenseInput;
  assets: RepaymentAsset[];
  creditors: RepaymentCreditor[];
  /** 청년(만 30세 미만)·취약계층 24개월 단축 특례 대상 여부 (rehabLegalCore.checkSpecial24Eligibility) */
  special24Eligible?: boolean;
  
  // 담당자 수동 미세 조정 옵션 (제공 시 자동 계산 대신 우선 반영)
  manualOverride?: {
    months?: number;
    monthlyRepayment?: number;
    creditorMonthlyRepayments?: Record<string, number>; // 채권자 ID -> 월 변제금
    formType?: RepaymentFormType;
    requiredDisposalAmount?: number;
    adjusterMemo?: string;
    isTwoStageRepayment?: boolean;
    stage1Months?: number;
    garnishmentDeposit?: GarnishmentDepositInfo;
    propertyDisposal?: PropertyDisposalInfo;
    interestRepaymentMode?: InterestRepaymentMode;
    childSupport?: ChildSupportInfo;
    adultChildTransition?: AdultChildTransitionInfo;
    clientSubmissionConsent?: ClientSubmissionConsent;
    // ── 실무 튜닝 옵션 ──
    isSeoulPrincipalOnly?: boolean;      // 원금 조기완제형 (이자 제외, 원금 완제 회차로 기간 단축) — 관할 실무 확인 필요
    garnishmentDepositFirstRound?: number; // 1회차 일시 투입 압류적립금
    decimalRepaymentRate?: boolean;       // 변제율 소수점 첫째자리 정밀 표기
  };
}

/**
 * 채권자 목록에 1, 2, 3... 및 보증인 가지번호(예: 4-1, 4-2) 자동 산출
 */
export function computeCreditorDisplayNumbers(creditors: RepaymentCreditor[]): RepaymentCreditor[] {
  let mainNumber = 0;
  const childCountMap: Record<string, number> = {};
  const mainNumberMap: Record<string, number> = {};

  return creditors.map((c) => {
    if (!c.parentCreditorId) {
      // 주채권자
      mainNumber++;
      mainNumberMap[c.id] = mainNumber;
      return {
        ...c,
        creditorNumber: mainNumber,
        displayNumber: `${mainNumber}`,
        isGuarantor: false,
      };
    } else {
      // 보증인 / 보증기관 가지번호
      const parentNum = mainNumberMap[c.parentCreditorId] || 1;
      const count = (childCountMap[c.parentCreditorId] || 0) + 1;
      childCountMap[c.parentCreditorId] = count;
      return {
        ...c,
        creditorNumber: parentNum,
        displayNumber: `${parentNum}-${count}`,
        isGuarantor: true,
      };
    }
  });
}

export function buildRepaymentPlan(options: BuildPlanOptions): RepaymentPlanData {
  const {
    planId = `plan_${Date.now()}`,
    clientId,
    clientName,
    courtName = '',
    caseNumber = '',
    submissionDate = localYmd(),
    paymentDayOfMonth = 25,
    incomeExpense,
    assets,
    creditors: rawCreditors,
    manualOverride,
    special24Eligible = false,
  } = options;

  // 번호 및 가지번호 정렬 처리
  const creditors = computeCreditorDisplayNumbers(rawCreditors);

  // 1. 소득 및 생계비 계산
  const calculatedLiving = calculateLivingExpenseAndDisposableIncome(incomeExpense);
  
  // 2. 총 청산가치(J) 계산
  const totalLiquidationValue = calculateTotalLiquidationValue(assets, incomeExpense.region);

  // 3. 총 채권 원금 및 총 채무
  const totalPrincipal = creditors.reduce((sum, c) => sum + (c.isSecured ? 0 : c.principal), 0);
  const totalInterest = creditors.reduce((sum, c) => sum + (c.isSecured ? 0 : c.interest), 0);
  const totalDebt = totalPrincipal + totalInterest;

  // 무담보부 vs 담보부(별제권) 채권 총액 분리 집계
  const unsecuredDebtTotal = creditors
    .filter((c) => !c.isSecured)
    .reduce((s, c) => s + c.principal + c.interest, 0);

  const securedDebtTotal = creditors
    .filter((c) => c.isSecured)
    .reduce((s, c) => s + c.principal + c.interest, 0);

  // 4. 수동 오버라이드 유무에 따른 기간 및 월 변제금 결정
  let months = 36;
  let monthlyRepaymentTarget = calculatedLiving.actualDisposableIncome;
  let formType: RepaymentFormType = 'D5110';
  let requiredDisposalAmount = 0;
  let isManuallyOverridden = false;

  const isSeoulPrincipalOnly = manualOverride?.isSeoulPrincipalOnly || false;
  const garnishmentDepositFirstRound = manualOverride?.garnishmentDepositFirstRound || 0;
  const decimalRepaymentRate = manualOverride?.decimalRepaymentRate || false;

  if (manualOverride && (manualOverride.months || manualOverride.monthlyRepayment !== undefined)) {
    isManuallyOverridden = true;
    months = manualOverride.months || 36;
    if (manualOverride.monthlyRepayment !== undefined) {
      monthlyRepaymentTarget = manualOverride.monthlyRepayment;
    }
    if (manualOverride.formType) {
      formType = manualOverride.formType;
    }
    if (manualOverride.requiredDisposalAmount !== undefined) {
      requiredDisposalAmount = manualOverride.requiredDisposalAmount;
    }
  } else {
    // ── 자동 판정 알고리즘 (2026 Engine, rehabLegalCore와 동일 순서) ──
    // Step 0: 24개월 단축 특례 (청년·취약계층, 관할 허용 시)
    const alloc24 = special24Eligible ? allocateCreditorRepayments(monthlyRepaymentTarget, creditors, 24) : null;
    const check24 = alloc24
      ? verifyLiquidationGuaranteeAndMinRepayment(totalPrincipal, alloc24.monthlyTotal, 24, totalLiquidationValue)
      : null;
    // Step A: 36개월 가용소득 검증
    const alloc36 = allocateCreditorRepayments(monthlyRepaymentTarget, creditors, 36);
    const check36 = verifyLiquidationGuaranteeAndMinRepayment(
      totalPrincipal,
      alloc36.monthlyTotal,
      36,
      totalLiquidationValue
    );

    if (check24 && check24.satisfiesLiquidationGuarantee && check24.satisfiesMinimumRepayment) {
      months = 24;
      formType = 'D5110';
    } else if (check36.satisfiesLiquidationGuarantee && check36.satisfiesMinimumRepayment) {
      // Case A: 36개월 전산양식 D5110
      months = 36;
      formType = 'D5110';
    } else {
      // Step B: 36개월 미달 시 60개월 연장 검증
      const alloc60 = allocateCreditorRepayments(monthlyRepaymentTarget, creditors, 60);
      const check60 = verifyLiquidationGuaranteeAndMinRepayment(
        totalPrincipal,
        alloc60.monthlyTotal,
        60,
        totalLiquidationValue
      );

      if (check60.satisfiesLiquidationGuarantee && check60.satisfiesMinimumRepayment) {
        // Case B: 60개월 연장 전산양식 D5110
        months = 60;
        formType = 'D5110';
      } else {
        // Step C: 60개월로도 미달 시 -> 월 변제금 최소 상향액 산출
        // rehabLegalCore.determineRepaymentPlan Step C와 동일: 청산가치·최저변제액·우선채권(내부 보수 기준 30회 내 완납) 중 최댓값
        const priorityForStepC = creditors
          .filter((c) => c.isPriority && !c.isSecured)
          .reduce((s, c) => s + c.principal, 0);
        const minTargetMonthly = Math.max(
          Math.ceil(totalLiquidationValue / LEIBNIZ_FACTOR_60),
          Math.ceil(getMinimumRepaymentThreshold(totalPrincipal) / 60),
          priorityForStepC > 0 ? Math.ceil(priorityForStepC / 30) : 0,
        );
        const adjustedLivingExpense = incomeExpense.monthlyNetIncome - minTargetMonthly;

        if (adjustedLivingExpense > 0) {
          // 생계비 축소 후 가용소득 상향 가능 -> D5110 변제금 상향
          months = 60;
          monthlyRepaymentTarget = minTargetMonthly;
          formType = 'D5110';
        } else {
          // 월 소득 전체를 투입해도 청산가치에 미달 -> [전산양식 D5111] (재산처분 병행) 전환
          months = 60;
          monthlyRepaymentTarget = incomeExpense.monthlyNetIncome; // 소득 전액 투입
          formType = 'D5111';
          const pv60 = Math.floor(monthlyRepaymentTarget * LEIBNIZ_FACTOR_60);
          const shortage = totalLiquidationValue - pv60;
          // 재산처분 목표액: 튜닝박스 기본값(1년 내 처분, 1.1배)과 동일 배수로 초안 산정 — 실무자가 튜닝박스에서 조정
          requiredDisposalAmount = Math.ceil(shortage * 1.1);
        }
      }
    }
  }

  // [원금 조기완제형] 가용소득으로 36개월 이내 원금 100% 완제 가능 시
  // 이자를 제외하고 변제기간을 원금 완제 회차로 단축 (관할 법원 실무 확인 필요)
  if (isSeoulPrincipalOnly && monthlyRepaymentTarget > 0 && totalPrincipal > 0) {
    const monthsToPayoff = Math.ceil(totalPrincipal / monthlyRepaymentTarget);
    if (monthsToPayoff <= 36) {
      months = Math.max(1, monthsToPayoff);
    }
  }

  // 5. 총 우선권 채무 사전 집계 및 1단계 인가 타당성 자동 평가 (Priority Claim Algorithm)
  const totalPriorityDebt = creditors
    .filter((c) => c.isPriority && !c.isSecured)
    .reduce((s, c) => s + c.principal, 0);

  const priorityFeasibility = evaluatePriorityRepaymentFeasibility(
    months,
    totalPriorityDebt,
    monthlyRepaymentTarget
  );

  const hasPriority = totalPriorityDebt > 0;
  const isTwoStage = manualOverride?.isTwoStageRepayment !== undefined
    ? manualOverride.isTwoStageRepayment
    : hasPriority;

  // 1단계 변제 회차 자동 판정:
  // Case A (K <= M_max): K = ceil(T_priority / A) 회차 내 완납
  // Case B (K > M_max): 상한선 M_max = floor(months / 2) 적용 및 경고 플래그
  const autoStage1Months = priorityFeasibility.canSettleWithinHalfPeriod
    ? Math.max(1, priorityFeasibility.minRequiredMonths)
    : priorityFeasibility.maxStage1Months;

  // 1단계 회차는 변제기간을 넘을 수 없음 (가상 회차 방지)
  const stage1Months = Math.min(Math.max(1, manualOverride?.stage1Months || autoStage1Months), Math.max(1, months));
  const stage2Months = Math.max(0, months - stage1Months);
  let twoStageTotalRepayment: number | null = null;
  let priorityShortfall = 0;

  let allocatedCreditors: RepaymentCreditor[] = [];
  let monthlyTotal = 0;
  let stage1MonthlyTotal = 0;
  let stage2MonthlyTotal = 0;

  // 원금 조기완제형 활성화 시 이자 변제 모드는 principal_only(이자 제외)
  const interestRepaymentMode = isSeoulPrincipalOnly
    ? 'principal_only'
    : (manualOverride?.interestRepaymentMode || 'principal_only');
  const garnishmentDeposit = manualOverride?.garnishmentDeposit;
  const propertyDisposal = manualOverride?.propertyDisposal;
  const childSupport = manualOverride?.childSupport;
  const adultChildTransition = manualOverride?.adultChildTransition;
  const clientSubmissionConsent = manualOverride?.clientSubmissionConsent;

  if (propertyDisposal?.isExecuted) {
    formType = 'D5111';
    requiredDisposalAmount = propertyDisposal.targetDisposalAmount;
  }

  if (isTwoStage && hasPriority) {
    const twoStageRes = allocateTwoStageRepayments(
      monthlyRepaymentTarget,
      creditors,
      months,
      stage1Months
    );
    allocatedCreditors = twoStageRes.allocatedCreditors;
    stage1MonthlyTotal = twoStageRes.stage1MonthlyTotal;
    stage2MonthlyTotal = twoStageRes.stage2MonthlyTotal;
    // 대표 월 변제금은 1단계 합계(=월 가용소득). 총변제액은 단계별 실제 합계를 사용
    monthlyTotal = stage2Months > 0 ? Math.max(stage1MonthlyTotal, stage2MonthlyTotal) : stage1MonthlyTotal;
    twoStageTotalRepayment = twoStageRes.totalRepayment;
    priorityShortfall = twoStageRes.priorityShortfall;
  } else {
    const singleRes = allocateCreditorRepayments(
      monthlyRepaymentTarget,
      creditors,
      months,
      interestRepaymentMode
    );
    allocatedCreditors = singleRes.allocatedCreditors;
    monthlyTotal = singleRes.monthlyTotal;
    stage1MonthlyTotal = singleRes.monthlyTotal;
    stage2MonthlyTotal = singleRes.monthlyTotal;
  }

  // 실무자가 개별 채권자 월 변제금을 직접 수정한 경우 오버라이드 반영
  if (manualOverride?.creditorMonthlyRepayments) {
    let customMonthlyTotal = 0;
    allocatedCreditors = allocatedCreditors.map((c) => {
      const customMonthly = manualOverride.creditorMonthlyRepayments?.[c.id];
      if (customMonthly !== undefined) {
        const total = customMonthly * months;
        customMonthlyTotal += customMonthly;
        return {
          ...c,
          monthlyRepayment: customMonthly,
          totalRepayment: total,
          repaymentRate:
            c.principal > 0 ? Math.round((total / c.principal) * 1000) / 10 : 0,
          isManuallyAdjusted: true,
        };
      }
      customMonthlyTotal += c.monthlyRepayment;
      return c;
    });
    monthlyTotal = customMonthlyTotal;
  }

  // 미확정 채권 유보금 집계
  const totalUnconfirmedReserve = allocatedCreditors
    .filter((c) => c.isUnconfirmedReserve)
    .reduce((s, c) => s + c.totalRepayment, 0);

  // 6. 최종 라이프니쯔 현가 1·2단계 분할 계산 및 보장 원칙 검증
  let presentValueBreakdown: PresentValueBreakdown;
  let totalCalculatedPresentValue = 0;

  if (isTwoStage && hasPriority) {
    const factorStage1 = getLeibnizFactor(stage1Months);
    const factorTotal = getLeibnizFactor(months);
    const factorStage2Delta = Math.max(0, factorTotal - factorStage1);

    const pv1 = Math.floor(stage1MonthlyTotal * factorStage1);
    const pv2 = Math.floor(stage2MonthlyTotal * factorStage2Delta);
    totalCalculatedPresentValue = pv1 + pv2;

    presentValueBreakdown = {
      stage1Months,
      stage1MonthlyAmount: stage1MonthlyTotal,
      stage1LeibnizFactor: Math.round(factorStage1 * 10000) / 10000,
      stage1PresentValue: pv1,
      stage2Months,
      stage2MonthlyAmount: stage2MonthlyTotal,
      stage2LeibnizFactor: Math.round(factorStage2Delta * 10000) / 10000,
      stage2PresentValue: pv2,
      totalPresentValue: totalCalculatedPresentValue,
    };
  } else {
    const factorTotal = getLeibnizFactor(months);
    totalCalculatedPresentValue = Math.floor(monthlyTotal * factorTotal);
    presentValueBreakdown = {
      stage1Months: months,
      stage1MonthlyAmount: monthlyTotal,
      stage1LeibnizFactor: Math.round(factorTotal * 10000) / 10000,
      stage1PresentValue: totalCalculatedPresentValue,
      stage2Months: 0,
      stage2MonthlyAmount: 0,
      stage2LeibnizFactor: 0,
      stage2PresentValue: 0,
      totalPresentValue: totalCalculatedPresentValue,
    };
  }

  const verification = verifyLiquidationGuaranteeAndMinRepayment(
    totalPrincipal,
    monthlyTotal,
    months,
    totalLiquidationValue
  );
  // 현가 갱신
  verification.presentValue = totalCalculatedPresentValue;
  verification.satisfiesLiquidationGuarantee = totalCalculatedPresentValue >= totalLiquidationValue;
  // 2단계 변제: 총변제액 = 단계별 실제 합계 (월 변제금 × 기간이 아님)
  if (twoStageTotalRepayment !== null && !manualOverride?.creditorMonthlyRepayments) {
    verification.totalRepayment = twoStageTotalRepayment;
    verification.satisfiesMinimumRepayment =
      twoStageTotalRepayment >= verification.minimumRepaymentThreshold ||
      (totalPrincipal > 0 && twoStageTotalRepayment >= totalPrincipal);
    verification.repaymentRate = totalPrincipal > 0 ? Math.round((twoStageTotalRepayment / totalPrincipal) * 1000) / 10 : 0;
  }
  // 1단계에서 우선권 채권이 완납되지 않으면 경고 (조용히 과소 변제하지 않음)
  if (priorityShortfall > 0) {
    const msg = `1단계(${stage1Months}회) 동안 우선권 채권 ${priorityShortfall.toLocaleString()}원이 변제되지 않습니다. 월 변제금 상향 또는 1단계 회차 조정이 필요합니다.`;
    priorityFeasibility.riskWarning = priorityFeasibility.riskWarning ? `${priorityFeasibility.riskWarning} / ${msg}` : msg;
  }

  // 7. 변제 시작월 및 종료월 자동 계산
  const now = new Date();
  const startMonthDate = new Date(now.getFullYear(), now.getMonth() + 3, 1); // 통상 접수 후 3개월 뒤 개시
  const startYearMonth =
    options.startYearMonth ||
    `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [startYear, startM] = startYearMonth.split('-').map(Number);
  const endMonthDate = new Date(startYear, startM - 1 + months - 1, 1);
  const endYearMonth = `${endMonthDate.getFullYear()}-${String(endMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // 압류적립금 1회차 일시 투입액 가산
  const finalTotalRepaymentAmount = verification.totalRepayment + garnishmentDepositFirstRound;
  const finalRepaymentRate = totalPrincipal > 0
    ? (decimalRepaymentRate
        ? Math.round((finalTotalRepaymentAmount / totalPrincipal) * 1000) / 10
        : Math.round((finalTotalRepaymentAmount / totalPrincipal) * 100))
    : 0;

  // 총변제액이 원리금(총채무)을 초과할 경우 법원 실무상 개시후이자 발생 경고
  const requiresPostCommencementInterest = finalTotalRepaymentAmount > totalDebt;

  const totalForgivenAmount = Math.max(0, totalPrincipal - finalTotalRepaymentAmount);
  const forgivenessRate =
    totalPrincipal > 0
      ? Math.round((totalForgivenAmount / totalPrincipal) * 1000) / 10
      : 0;

  return {
    planId,
    clientId,
    clientName,
    courtName,
    caseNumber,
    submissionDate,
    months,
    startYearMonth,
    endYearMonth,
    paymentDayOfMonth,
    incomeExpense,
    calculatedLiving,
    // 저장·출력되는 재산 목록의 공제액·청산가치를 엔진 계산값으로 정규화 (행 표시 = 합계)
    assets: computeAssetBreakdown(assets, incomeExpense.region),
    totalLiquidationValue,
    creditors: allocatedCreditors,
    totalPrincipal,
    totalInterest,
    totalDebt,
    unsecuredDebtTotal,
    securedDebtTotal,
    leibnizFactor: verification.leibnizFactor,
    presentValue: verification.presentValue,
    satisfiesLiquidationGuarantee: verification.satisfiesLiquidationGuarantee,
    monthlyRepaymentTotal: monthlyTotal,
    totalRepaymentAmount: finalTotalRepaymentAmount,
    totalRepaymentRate: finalRepaymentRate,
    totalForgivenAmount,
    forgivenessRate,
    isTwoStageRepayment: isTwoStage,
    stage1Months,
    stage2Months,
    stage1MonthlyRepaymentTotal: stage1MonthlyTotal,
    stage2MonthlyRepaymentTotal: stage2MonthlyTotal,
    totalPriorityDebt,
    totalUnconfirmedReserve,
    priorityFeasibility,
    priorityShortfall,
    minimumRepaymentThreshold: verification.minimumRepaymentThreshold,
    satisfiesMinimumRepayment: verification.satisfiesMinimumRepayment,
    formType,
    requiredDisposalAmount,
    garnishmentDeposit,
    propertyDisposal,
    interestRepaymentMode,
    childSupport,
    adultChildTransition,
    clientSubmissionConsent,
    presentValueBreakdown,
    isManuallyOverridden,
    overrideMonthlyRepayment: manualOverride?.monthlyRepayment,
    overrideMonths: manualOverride?.months,
    adjusterMemo: manualOverride?.adjusterMemo,
    // ── 실무 튜닝 필드 ──
    isSeoulPrincipalOnly,
    requiresPostCommencementInterest,
    decimalRepaymentRate,
    garnishmentDepositFirstRound,
    lastSavedAt: new Date().toISOString(),
  };
}

/**
 * 저장된 변제계획안의 입력값(소득·채권자·튜닝 옵션)은 유지하고 재산 목록만 바꿔 다시 계산한다.
 * (재산만 교체하고 현재가치·청산가치 충족 여부 같은 파생값을 그대로 두면 화면·출력물이 서로 어긋난다)
 */
export function rebuildPlanWithAssets(
  plan: RepaymentPlanData,
  assets: RepaymentAsset[],
  /** 채권자 목록도 교체할 때 전달 (이 경우 채권자별 수동 월 변제금은 초기화) */
  replaceCreditors?: RepaymentCreditor[],
  /** 소득·생계비 입력도 교체할 때 전달 */
  replaceIncomeExpense?: IncomeAndExpenseInput
): RepaymentPlanData {
  const customMonthly: Record<string, number> = {};
  if (!replaceCreditors) {
    for (const c of plan.creditors || []) {
      if (c.isManuallyAdjusted) customMonthly[c.id] = c.monthlyRepayment;
    }
  }
  const rebuilt = buildRepaymentPlan({
    planId: plan.planId,
    clientId: plan.clientId,
    clientName: plan.clientName,
    courtName: plan.courtName,
    caseNumber: plan.caseNumber,
    submissionDate: plan.submissionDate,
    startYearMonth: plan.startYearMonth,
    paymentDayOfMonth: plan.paymentDayOfMonth,
    incomeExpense: replaceIncomeExpense || plan.incomeExpense,
    assets,
    creditors: replaceCreditors || plan.creditors || [],
    manualOverride: {
      months: plan.isManuallyOverridden ? plan.months : undefined,
      monthlyRepayment: plan.isManuallyOverridden ? plan.overrideMonthlyRepayment : undefined,
      creditorMonthlyRepayments: Object.keys(customMonthly).length > 0 ? customMonthly : undefined,
      formType: plan.isManuallyOverridden ? plan.formType : undefined,
      adjusterMemo: plan.adjusterMemo,
      isTwoStageRepayment: plan.isTwoStageRepayment,
      stage1Months: plan.stage1Months,
      garnishmentDeposit: plan.garnishmentDeposit,
      propertyDisposal: plan.propertyDisposal,
      interestRepaymentMode: plan.interestRepaymentMode,
      childSupport: plan.childSupport,
      adultChildTransition: plan.adultChildTransition,
      clientSubmissionConsent: plan.clientSubmissionConsent,
      isSeoulPrincipalOnly: plan.isSeoulPrincipalOnly,
      garnishmentDepositFirstRound: plan.garnishmentDepositFirstRound,
      decimalRepaymentRate: plan.decimalRepaymentRate,
    },
  });
  return {
    ...rebuilt,
    debtGrowthReasons: plan.debtGrowthReasons,
    debtGrowthNarrative: plan.debtGrowthNarrative,
  };
}
