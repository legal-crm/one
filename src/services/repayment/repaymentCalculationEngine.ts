/**
 * 2026년 기준 개인회생 핵심 계산 엔진 (Calculation Engine)
 * - 가용소득 산정 (중위소득 60% + 추가주거/의료/교육비)
 * - 서울회생법원 규칙 원 미만 올림(Math.ceil) 채권자 안분 배분
 * - 라이프니쯔 연 5% 복리할인 현가 검증 (36개월 33.7719 / 60개월 53.6433)
 * - 전산양식 D5110 / D5111 자동 판정 및 상향 조정
 * - 실무자 수동 미세 조정(Fine-Tuning) 실시간 재계산 지원
 */

import {
  get2026LivingExpense,
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

import type {
  IncomeAndExpenseInput,
  CalculatedLivingExpense,
  RepaymentAsset,
  RepaymentCreditor,
  RepaymentPlanData,
  RepaymentFormType,
  PriorityFeasibilityInfo,
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
  } = input;

  // 1. 2026 기초생계비 (중위소득 60%)
  const baseLivingExpense = get2026LivingExpense(householdSize);

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

export function calculateAssetLiquidationValue(
  asset: RepaymentAsset,
  region: 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS' = 'SEOUL'
): number {
  const { category, marketValue, encumbrance = 0, isRetirementPension } = asset;

  let statutoryDeduction = 0;

  switch (category) {
    case 'DEPOSIT':
      // 예금: 185만 원 압류금지 공제
      statutoryDeduction = EXEMPT_DEPOSIT_LIMIT;
      break;

    case 'INSURANCE':
      // 보장성 보험: 150만 원 공제
      statutoryDeduction = EXEMPT_INSURANCE_REFUND_LIMIT;
      break;

    case 'HOUSING_DEPOSIT': {
      // 주거용 임차보증금: 소액보증금 공제
      const limitInfo = HOUSING_EXEMPT_DEPOSIT_LIMITS[region] || HOUSING_EXEMPT_DEPOSIT_LIMITS.SEOUL;
      if (marketValue <= limitInfo.maxDeposit) {
        statutoryDeduction = limitInfo.exemptAmount;
      }
      break;
    }

    case 'RETIREMENT':
      // 퇴직연금(DB/DC/IRP)은 청산가치 0원, 일반 퇴직금은 50% 반영 (1/2 공제)
      if (isRetirementPension) {
        return 0;
      }
      statutoryDeduction = Math.round(marketValue * 0.5);
      break;

    case 'ADDITIONAL_INCLUSION':
      // 편파변제, 주식/코인 손실금, 도박 낭비액 등은 공제 없이 전액 합산
      return marketValue;

    case 'CAR':
    case 'REAL_ESTATE':
    case 'OTHER':
    default:
      statutoryDeduction = 0;
      break;
  }

  const net = marketValue - encumbrance - statutoryDeduction;
  return Math.max(0, net);
}

export function calculateTotalLiquidationValue(
  assets: RepaymentAsset[],
  region: 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS' = 'SEOUL'
): number {
  return assets.reduce((sum, asset) => {
    return sum + calculateAssetLiquidationValue(asset, region);
  }, 0);
}

// ══════════════════════════════════════════════════════════════════
// STEP 3. 채권자별 안분 배분 엔진 (서울회생법원 원 미만 올림 준수)
// ══════════════════════════════════════════════════════════════════

export function allocateCreditorRepayments(
  monthlyDisposableIncome: number,
  creditors: RepaymentCreditor[],
  months: number = 36
): {
  allocatedCreditors: RepaymentCreditor[];
  monthlyTotal: number;
  totalRepayment: number;
  roundingDifference: number;
} {
  const unsecuredCreditors = creditors.filter((c) => !c.isSecured);
  const totalPrincipal = unsecuredCreditors.reduce((sum, c) => sum + c.principal, 0);

  if (totalPrincipal <= 0 || monthlyDisposableIncome <= 0) {
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

  for (const creditor of creditors) {
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

    const ratio = creditor.principal / totalPrincipal;
    // 법원 실무: 원 미만 무조건 '올림(Math.ceil)'
    const monthlyRepay = Math.ceil(monthlyDisposableIncome * ratio);
    calculatedMonthlyTotal += monthlyRepay;

    const totalRepay = monthlyRepay * months;
    const repaymentRate =
      creditor.principal > 0
        ? Math.round((totalRepay / creditor.principal) * 1000) / 10
        : 0;

    resultCreditors.push({
      ...creditor,
      allocationRatio: Math.round(ratio * 10000) / 10000,
      monthlyRepayment: monthlyRepay,
      totalRepayment: totalRepay,
      repaymentRate,
    });
  }

  // 원 미만 올림에 따른 월 가용소득과의 차액
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
 * 우선권 채권 1단계 변제 회차 및 인가 타당성 자동 산출 엔진 (Priority Claim Algorithm)
 * 1. M_max = Math.floor(totalMonths / 2) (36개월 플랜 시 18회차, 60개월 플랜 시 30회차)
 * 2. K = Math.ceil(T_priority / A)
 * 3. Case A (K <= M_max): 정상 2단계 변제 가능 (1단계 1~K회 완제, 잔여분 일반채권 안분)
 * 4. Case B (K > M_max): 가용소득 부족으로 1/2 기간 내 완납 불가능 -> 자동 보정 엔진(60개월 연장 or 가용소득 상향)
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
    if (totalMonths < 60) {
      const max60 = Math.floor(60 / 2); // 30
      if (minRequiredMonths <= max60) {
        riskWarning = `36개월 변제 시 1/2(${maxStage1Months}회차) 내 세금 완납 불가 (필요 회차: ${minRequiredMonths}회). 60개월로 변제기간 연장 시 정상 인가 가능합니다.`;
        recommendedMonths = 60;
      } else {
        riskWarning = `세금 체납액 과다로 인가 불허 위험 (60개월 최장 연장 시에도 30회 내 완납 불가, 월 가용소득을 ${requiredDisposableForHalfPeriod.toLocaleString()}원 이상으로 상향 필요).`;
        recommendedMonths = 60;
      }
    } else {
      riskWarning = `세금 체납액 과다로 인가 불허 위험 (최대 30회 내 완납 불가, 월 가용소득 ${Math.ceil(totalPriorityDebt / 30).toLocaleString()}원 이상 상향 필요).`;
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
} {
  const stage2Months = Math.max(1, totalMonths - stage1Months);
  const unsecured = creditors.filter((c) => !c.isSecured);
  const priorityList = unsecured.filter((c) => c.isPriority);
  const generalList = unsecured.filter((c) => !c.isPriority);

  const totalPriorityPrincipal = priorityList.reduce((s, c) => s + c.principal, 0);
  const totalGeneralPrincipal = generalList.reduce((s, c) => s + c.principal, 0);

  // 1단계 우선권 채권 월 필요 변제액 (T_priority / stage1Months)
  const reqPriorityMonthly = totalPriorityPrincipal > 0 
    ? Math.ceil(totalPriorityPrincipal / stage1Months) 
    : 0;

  const actualPriorityMonthly = Math.min(monthlyDisposableIncome, reqPriorityMonthly);
  const surplusForGeneralStage1 = Math.max(0, monthlyDisposableIncome - actualPriorityMonthly);

  let stage1CalculatedTotal = 0;
  let stage2CalculatedTotal = 0;

  const resultCreditors: RepaymentCreditor[] = creditors.map((creditor) => {
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
      const stage1Monthly = Math.ceil(actualPriorityMonthly * ratio);
      const stage2Monthly = 0;
      const totalRepay = stage1Monthly * stage1Months;
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
      const stage1Monthly = surplusForGeneralStage1 > 0 ? Math.ceil(surplusForGeneralStage1 * ratio) : 0;
      const stage2Monthly = Math.ceil(monthlyDisposableIncome * ratio);
      const totalRepay = (stage1Monthly * stage1Months) + (stage2Monthly * stage2Months);
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
  const factor = LEIBNIZ_FACTORS[months] || (months === 60 ? LEIBNIZ_FACTOR_60 : LEIBNIZ_FACTOR_36);
  // 현가 계산 시 원 미만은 버림 처리
  const presentValue = Math.floor(monthlyRepaymentTotal * factor);
  const satisfiesLiquidationGuarantee = presentValue >= totalLiquidationValue;
  const liquidationShortage = Math.max(0, totalLiquidationValue - presentValue);

  // 최저변제액 제공의 원칙 (총 채권 5,000만 원 기준)
  let minimumRepaymentThreshold = 0;
  if (totalPrincipal < 50000000) {
    minimumRepaymentThreshold = Math.round(totalPrincipal * 0.05); // 5%
  } else {
    minimumRepaymentThreshold = Math.round(totalPrincipal * 0.03) + 1000000; // 3% + 100만 원
  }

  const totalRepayment = monthlyRepaymentTotal * months;
  const satisfiesMinimumRepayment = totalRepayment >= minimumRepaymentThreshold;
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
    courtName = '서울회생법원',
    caseNumber = '',
    submissionDate = new Date().toISOString().slice(0, 10),
    paymentDayOfMonth = 25,
    incomeExpense,
    assets,
    creditors: rawCreditors,
    manualOverride,
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
    // ── 자동 판정 알고리즘 (2026 Engine) ──
    // Step A: 36개월 가용소득 검증
    const alloc36 = allocateCreditorRepayments(monthlyRepaymentTarget, creditors, 36);
    const check36 = verifyLiquidationGuaranteeAndMinRepayment(
      totalPrincipal,
      alloc36.monthlyTotal,
      36,
      totalLiquidationValue
    );

    if (check36.satisfiesLiquidationGuarantee && check36.satisfiesMinimumRepayment) {
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
        const minTargetMonthly = Math.ceil(totalLiquidationValue / LEIBNIZ_FACTOR_60);
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
          requiredDisposalAmount = Math.ceil(shortage * 1.3); // 1년 내 처분 1.3배수
        }
      }
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

  const stage1Months = manualOverride?.stage1Months || autoStage1Months;
  const stage2Months = Math.max(1, months - stage1Months);

  let allocatedCreditors: RepaymentCreditor[] = [];
  let monthlyTotal = 0;
  let stage1MonthlyTotal = 0;
  let stage2MonthlyTotal = 0;

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
    monthlyTotal = Math.max(stage1MonthlyTotal, stage2MonthlyTotal);
  } else {
    const singleRes = allocateCreditorRepayments(
      monthlyRepaymentTarget,
      creditors,
      months
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

  // 6. 최종 라이프니쯔 현가 및 보장 원칙 검증
  const verification = verifyLiquidationGuaranteeAndMinRepayment(
    totalPrincipal,
    monthlyTotal,
    months,
    totalLiquidationValue
  );

  // 7. 변제 시작월 및 종료월 자동 계산
  const now = new Date();
  const startMonthDate = new Date(now.getFullYear(), now.getMonth() + 3, 1); // 통상 접수 후 3개월 뒤 개시
  const startYearMonth =
    options.startYearMonth ||
    `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [startYear, startM] = startYearMonth.split('-').map(Number);
  const endMonthDate = new Date(startYear, startM - 1 + months - 1, 1);
  const endYearMonth = `${endMonthDate.getFullYear()}-${String(endMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const totalForgivenAmount = Math.max(0, totalPrincipal - verification.totalRepayment);
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
    assets,
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
    totalRepaymentAmount: verification.totalRepayment,
    totalRepaymentRate: verification.repaymentRate,
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
    minimumRepaymentThreshold: verification.minimumRepaymentThreshold,
    satisfiesMinimumRepayment: verification.satisfiesMinimumRepayment,
    formType,
    requiredDisposalAmount,
    isManuallyOverridden,
    overrideMonthlyRepayment: manualOverride?.monthlyRepayment,
    overrideMonths: manualOverride?.months,
    adjusterMemo: manualOverride?.adjusterMemo,
    lastSavedAt: new Date().toISOString(),
  };
}
