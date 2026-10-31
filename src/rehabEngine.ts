import { IntakeData, AppSettings, ComputeResponse, CalculationRow, Top3Item, PreferredPlan, Alert, RegionKey, CalculationBreakdown } from './types';
import { detectJurisdiction } from './utils';
import {
  determineRepaymentPlan,
  evaluatePlanAt,
  checkShortPlanReason,
  getLeibnizFactor,
  getMinimumRepaymentThreshold,
  getRecognizedLivingCost2026,
} from './services/repayment/rehabLegalCore';
import {
  additionalLivingCostRules,
  calculateLivingExpenseAndDisposableIncome,
  computeAssetBreakdown,
} from './services/repayment/repaymentCalculationEngine';
import type { AssetCategory, IncomeAndExpenseInput, RepaymentAsset } from './services/repayment/repaymentTypes';
import { MAX_ADDITIONAL_REGULAR_EDUCATION, MAX_ADDITIONAL_SPECIAL_EDUCATION } from './services/repayment/repaymentConstants2026';

/** 의뢰인 접수 지역 키 → 공통 엔진 지역 구분 */
const REGION_KEY_TO_TYPE: Record<string, 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS'> = {
  Seoul: 'SEOUL', Overcrowded: 'OVERCROWDED', Metro: 'METROPOLITAN', Others: 'OTHERS',
};

/** 의뢰인 재산 종류 → 공통 엔진 재산 분류 */
function assetCategoryOf(type: string): AssetCategory {
  switch (type) {
    case 'deposit': return 'HOUSING_DEPOSIT';
    case 'savings': return 'DEPOSIT';
    case 'insurance': return 'INSURANCE';
    case 'severance': return 'RETIREMENT';
    case 'realestate': case 'realestate_general': case 'land': return 'REAL_ESTATE';
    case 'vehicle': case 'business_vehicle': return 'CAR';
    default: return 'OTHER';
  }
}

/**
 * Korean Individual Rehabilitation Calculation Engine
 * Strictly computes disposable income, liquidation value, and simulates repayment plans.
 */
export const calculateRehabPlan = (data: IntakeData, settings: AppSettings): ComputeResponse => {
  const applyYear = data.applyYear || new Date().getFullYear();
  // 미정의 연도는 최신 확정 기준(2026)으로 fallback
  const yearPolicy = settings.yearlyPolicies[applyYear] || settings.yearlyPolicies[2026] || settings.yearlyPolicies[2025];
  const courtConfig = settings.courtConfigs[data.selectedCourt] || {
    includeSpouseProperty: true,
    includeCryptoStock: true,
    shortPlanRule: String(data.selectedCourt || '').endsWith('회생법원'),
    allowAdditionalLivingCost: true,
    allowOtherLivingCost: false
  };

  // 1. Calculate Total Dependents (Consider joint custody/support where child counts as 0.5)
  let recognizedMinorChildren = data.minorChildren || 0;
  if (data.maritalStatus === 'married' && data.spouseIncome && data.spouseIncome > 0) {
    const myIncome = data.incomeSources.reduce((sum, s) => sum + s.amount, 0);
    const spouseIncome = data.spouseIncome;
    const spouseIncomeRatio = myIncome > 0 ? spouseIncome / myIncome : 0;

    const underLimit = settings.policy.spouseIncomeRatioUnder ?? 0.7;
    const underRate = settings.policy.spouseIncomeRatioUnderRate ?? 1.0;
    const betweenLimit = settings.policy.spouseIncomeRatioBetween ?? 1.3;
    const betweenRate = settings.policy.spouseIncomeRatioBetweenRate ?? 0.5;
    const overRate = settings.policy.spouseIncomeRatioOverRate ?? 0.0;

    if (spouseIncomeRatio < underLimit) {
      recognizedMinorChildren = (data.minorChildren || 0) * underRate;
    } else if (spouseIncomeRatio <= betweenLimit) {
      recognizedMinorChildren = (data.minorChildren || 0) * betweenRate;
    } else {
      recognizedMinorChildren = (data.minorChildren || 0) * overRate;
    }
  }

  // 배우자 부양가족 인정: (미성년자녀 또는 장애부양가족 有) AND (배우자 연소득 ≤ 100만원)
  let spouseAsDependant = 0;
  if (data.maritalStatus === 'married') {
    const spouseAnnualIncome = (data.spouseIncome || 0) * 12;
    const hasMinorOrDisabled = (data.minorChildren || 0) > 0 ||
      data.specialCircumstances.severeDisability;
    const spouseIncomeLimit = yearPolicy.adultChildDependentCriteria?.incomeLimit || 1000000;
    if (hasMinorOrDisabled && spouseAnnualIncome <= spouseIncomeLimit) {
      spouseAsDependant = 1;
    }
  }

  const adultChildrenCount = data.adultChildrenCount || 0;
  const otherDependents = data.otherDependents || 0;
  const totalDependents = recognizedMinorChildren + adultChildrenCount + otherDependents + spouseAsDependant;

  // 2. Calculate Total Net Income (Monthly)
  const totalMonthlyIncome = data.incomeSources.reduce((sum, source) => sum + source.amount, 0);

  // 3. Determine Region for Asset Exemptions (소액임차보증금 범위)
  const jurisdiction = detectJurisdiction(data.residence, settings.courtRegionMap);
  // 소액임차보증금은 주택임대차보호법 시행령 지역 구분 (LS-9)
  const region: RegionKey = jurisdiction.smallLeaseRegion || jurisdiction.region;

  // 4. 청산가치 — 법원 서식 엔진과 같은 재산 계산 (B-3, computeAssetBreakdown)
  //  · 예금·보장성보험 압류금지 각각 합계 250만 원 1회 (이전: 이 엔진만 예금 공제가 없었음)
  //  · 임차보증금 소액임차 공제, 퇴직금 1/2(연금은 0), 담보대출 차감
  //  · 배우자 명의 재산은 법원 실무에 따라 50% 또는 0 (공제 없이)
  //  · 보유 주식·코인 평가액은 언제나 넣는다 (제408호 '투자 손실금 미가산'은 이미 잃은 돈 이야기)
  const regionType = REGION_KEY_TO_TYPE[region] || 'OTHERS';
  const liqSource = data.assets.filter(asset => !asset.isExempt && !(asset.owner === 'spouse' && !courtConfig.includeSpouseProperty));
  const liqRows = computeAssetBreakdown(liqSource.map((asset, i): RepaymentAsset => ({
    id: `a${i}`,
    name: asset.type,
    category: assetCategoryOf(asset.type),
    marketValue: Math.max(0, asset.marketValue || 0),
    encumbrance: asset.hasPledge ? Math.max(0, asset.loanBalance || 0) : 0,
    statutoryDeduction: 0,
    liquidationValue: 0,
    isRetirementPension: asset.type === 'severance' && data.retirementPensionType === 'pension',
    ...(asset.owner === 'spouse' ? { ownerType: 'SPOUSE' as const, spouseContributionRatio: 0.5 } : {}),
  })), regionType);
  const totalLiquidationValue = liqRows.reduce((sum, row) => sum + row.liquidationValue, 0);

  // 5. Calculate Total Debt — 채무 유형별 분리 (법원 기준)
  // 무담보 채권: 가용소득 안분 변제 대상
  // 담보부 채권: 별제권 행사 예상액은 제외, 부족액만 안분 변제 편입
  // 세금/우선권 채권: 우선 변제 대상 (일반 채권보다 먼저 변제)
  const unsecuredDebt = data.debts
    .filter(d => d.type === 'unsecured')
    .reduce((sum, d) => sum + d.principal, 0);

  const securedDebtTotal = data.debts
    .filter(d => d.type === 'secured')
    .reduce((sum, d) => sum + d.principal, 0);

  const taxDebt = data.debts
    .filter(d => d.type === 'tax')
    .reduce((sum, d) => sum + d.principal, 0);

  // 우선권 있는 채권 (건강보험, 국민연금 미납금 등)
  // 법원 기준: 변제계획 인가일 직후 첫 변제기일에 원리금 전액 우선 변제
  const priorityDebt = data.debts
    .filter(d => d.type === 'priority')
    .reduce((sum, d) => sum + d.principal, 0);

  // 담보부 채권의 별제권 행사 후 예정부족액 계산
  // (별제권 행사 예상액 = 담보물 시가 × 환가예상율, 보통 70%)
  // 부족액만 일반 개인회생채권으로 편입
  // 현재 DebtItem에 securedRecovery(별제권 행사 예상액) 필드가 없으므로,
  // 담보부 채권의 대응 자산(hasPledge)의 환가예상액을 사용
  let securedRecoveryTotal = 0;
  data.assets.forEach(asset => {
    if (asset.hasPledge && asset.marketValue > 0) {
      // 법원 기준 환가예상율: 일반적으로 70% (차량/동산)
      const estimatedAuctionValue = Math.round(asset.marketValue * 0.7);
      const assessedValue = Math.max(0, estimatedAuctionValue - asset.loanBalance);
      securedRecoveryTotal += Math.max(0, estimatedAuctionValue - assessedValue);
      // 실제 별제권 행사 예상 변제액
      securedRecoveryTotal = Math.min(securedRecoveryTotal, securedDebtTotal);
    }
  });

  // 별제권 행사 후 부족액 (일반채권 편입분)
  const securedDeficit = Math.max(0, securedDebtTotal - securedRecoveryTotal);

  // 총 채무액 (명목 합계 — UI 표시용)
  const grossTotalDebt = unsecuredDebt + securedDebtTotal + taxDebt + priorityDebt;

  // 안분 변제 대상 채무 (가용소득 변제계획 산정 기준)
  // = 무담보 채권 + 담보부 채권 부족액 + 우선권 채권
  // (세금 채권은 별도 우선 변제이므로 제외, 우선권 채권은 안분 변제 내에서 우선 배분)
  const totalDebt = unsecuredDebt + securedDeficit + priorityDebt;

  // 총 이자 합계 (채권현재액 표시용 — 이자는 변제율 0%)
  const totalInterest = data.debts.reduce((sum, d) => sum + (d.interest || 0), 0);
  const totalDebtWithInterest = grossTotalDebt + totalInterest;

  // 6. Calculate Minimum Living Cost (인정 생계비)
  const householdSize = 1 + totalDependents;
  const medianIncomeValues = yearPolicy.medianIncome.values;
  let baseMedianIncome = 0;

  const lowerSize = Math.floor(householdSize);
  const upperSize = Math.ceil(householdSize);
  const fraction = householdSize - lowerSize;

  let lowerMedian = 0;
  let upperMedian = 0;

  if (lowerSize > 6) {
    lowerMedian = medianIncomeValues[6] + (lowerSize - 6) * yearPolicy.medianIncome.incrementOver7;
  } else {
    lowerMedian = medianIncomeValues[lowerSize] || medianIncomeValues[1];
  }

  if (upperSize > 6) {
    upperMedian = medianIncomeValues[6] + (upperSize - 6) * yearPolicy.medianIncome.incrementOver7;
  } else {
    upperMedian = medianIncomeValues[upperSize] || medianIncomeValues[1];
  }

  baseMedianIncome = lowerMedian + (upperMedian - lowerMedian) * fraction;

  // 인정 생계비 — 법원 서식 엔진과 같은 함수 (B-3, repaymentCalculationEngine)
  //  기본 생계비 = 중위소득 60% 반올림 표, 주거비 = min(실제 − 포함분, 가구원수별 지역 한도),
  //  교육비 = 자녀 1인당 min(지출 − 포함분 89,627원, 한도), 의료비 = 포함분 초과액
  //  (이전: 교육비 포함분을 빼지 않았고, 2027년부터 주거·의료·교육비가 0원이었음 — 새 의결 전까지 2026 의결 적용)
  const extra = data.extraLivingCost;
  const allowAdditional = !!courtConfig.allowAdditionalLivingCost;
  const minorChildCount = Math.max(0, Math.floor(data.minorChildren || 0));
  const educationTotal = (extra.education || 0) + (extra.specialEducation || 0);
  const hasSpecialEducation = (extra.specialEducation || 0) > 0;
  const living = calculateLivingExpenseAndDisposableIncome({
    incomeType: 'salary',
    monthlyNetIncome: totalMonthlyIncome,
    householdSize,
    region: regionType,
    actualHousingExpense: allowAdditional ? (data.monthlyRent || 0) + (extra.utilities || 0) : 0,
    actualMedicalExpense: allowAdditional ? (extra.medical || 0) : 0,
    numberOfChildren: allowAdditional ? minorChildCount : 0,
    educationExpensePerChild: minorChildCount > 0 ? educationTotal / minorChildCount : 0,
    isSpecialEducation: hasSpecialEducation,
    otherApprovedExpense: 0,
    trusteeType: 'INTERNAL',
    medianIncomeYear: applyYear,
  } as IncomeAndExpenseInput);
  const livingRulesBd = additionalLivingCostRules(householdSize, regionType, living.baseLivingExpense, hasSpecialEducation, applyYear);
  const basicLivingCost = living.baseLivingExpense;
  const additionalHousing = living.additionalHousingDeduction;
  const additionalEducation = living.additionalEducationDeduction;
  const additionalSpecialEd = 0; // 교육비에 함께 계산 (특수교육이면 한도 50만 원)
  const additionalMedical = living.additionalMedicalDeduction;
  let additionalOther = 0;

  // ④ 기타생계비: 회생법원 관할 + 고소득(중위150%↑) + 변제율40%↑ 조건부 인정
  if (courtConfig.allowOtherLivingCost) {
    const actualOther = (extra.other || 0) + (data.monthlyInsurance || 0);
    const highIncomeMultiplier = yearPolicy.highIncomeEarnerMultiplier || 1.5;
    const repaymentThreshold = yearPolicy.highIncomeRepaymentRateThreshold || 0.4;

    if (totalMonthlyIncome > baseMedianIncome * highIncomeMultiplier) {
      // 최근 6개월 채무 비중 50% 초과 시 불인정
      const recentDebtTotal = data.debts.filter(d => d.isRecent).reduce((sum, d) => sum + d.principal, 0);
      const recentDebtRatio = totalDebt > 0 ? recentDebtTotal / totalDebt : 0;

      if (recentDebtRatio <= 0.5) {
        // 기준 중위소득 100% 한도 내에서 인정
        const maxTotalLivingCost = baseMedianIncome; // 중위소득 100%
        const currentBeforeOther = basicLivingCost + additionalHousing + additionalEducation + additionalSpecialEd + additionalMedical;
        const remainingBudget = Math.max(0, maxTotalLivingCost - currentBeforeOther);
        additionalOther = Math.min(actualOther, remainingBudget);

        // 변제율 40% 유지 검증
        const tentativeLivingCost = currentBeforeOther + additionalOther;
        const tentativeDisposable = Math.max(0, totalMonthlyIncome - tentativeLivingCost);
        const tentativeRepaymentRate = totalDebt > 0 ? (tentativeDisposable * 36) / totalDebt : 0;

        if (tentativeRepaymentRate < repaymentThreshold) {
          // 변제율 40% 유지하도록 기타생계비 축소
          const minDisposable = Math.ceil((totalDebt * repaymentThreshold) / 36);
          const maxAllowedLivingCost = totalMonthlyIncome - minDisposable;
          additionalOther = Math.max(0, maxAllowedLivingCost - currentBeforeOther);
        }
      }
    }
  }

  // Total Allowed Living Cost (기본생계비 + 항목별 추가 생계비)
  let totalLivingCost = data.monthlyLivingCost > 0 ? data.monthlyLivingCost : basicLivingCost;
  totalLivingCost += additionalHousing + additionalEducation + additionalSpecialEd + additionalMedical + additionalOther;

  // 일반 최소 월 변제금: 10만 원
  const generalMinMonthly = 100000;

  // ─── [단일 기준] 변제계획 판정은 rehabLegalCore(법원 정밀 엔진 산식)에 위임 ───
  //  · 인정 생계비는 임의 조정하지 않음 (기존 "소득의 70%를 생계비로 재조정" 규칙 제거)
  //  · 라이프니츠 현가(36개월 33.3657) 청산가치 보장, 최저변제액, 조세 우선채권 1/2 기간 완납
  //  · 청년(만 30세 미만)·취약계층 3년 미만 단축 검토
  const disposable = Math.max(0, totalMonthlyIncome - totalLivingCost);

  // 7. 3년 미만 단축 사유 판정 (청년 포함)
  const shortPlan = checkShortPlanReason({
    courtHasRule: courtConfig.shortPlanRule,
    age: data.age,
    // 기초생활수급자는 제424호 사유가 아님 → 사유에서 뺌 (파산 검토 정보로만, LS-5a)
    minorChildren: data.minorChildren,
    severeDisability: data.specialCircumstances.severeDisability || data.specialCondition === 'severe_disability',
    singleParent: data.specialCircumstances.singleParent || data.specialCondition === 'single_parent',
    rentFraud: data.specialCircumstances.rentFraud || data.specialCondition === 'rent_fraud',
    elderly: data.specialCondition === 'elderly',
  });
  const allow2435 = shortPlan.eligible;

  // 조세·우선권 채권은 우선변제(1/2 기간 내 완납) 대상으로 분리
  const generalDebtForPlan = unsecuredDebt + securedDeficit;
  const priorityDebtForPlan = priorityDebt + taxDebt;
  const planPrincipal = generalDebtForPlan + priorityDebtForPlan;

  // 8. 최저 변제액 제공의 원칙
  const minTotalByDebtScale = getMinimumRepaymentThreshold(planPrincipal);

  const planCtx = {
    liquidationValue: totalLiquidationValue,
    generalDebt: generalDebtForPlan,
    priorityDebt: priorityDebtForPlan,
  };

  // 9. Simulation Rows (24*/36/48/60개월) — 동일 산식으로 기간별 비교표 생성
  const simulatedMonths = allow2435 ? [24, 36, 48, 60] : [36, 48, 60];
  const rows: CalculationRow[] = [];

  simulatedMonths.forEach(m => {
    const minMonthlyToGuaranteeLiq = totalLiquidationValue > 0 ? Math.ceil(totalLiquidationValue / getLeibnizFactor(m)) : 0;
    const minMonthlyByDebtScale = Math.ceil(minTotalByDebtScale / m);
    const minMonthlyForPriority = priorityDebtForPlan > 0 ? Math.ceil(priorityDebtForPlan / Math.floor(m / 2)) : 0;

    let monthly = Math.max(disposable, minMonthlyToGuaranteeLiq, minMonthlyByDebtScale, minMonthlyForPriority);
    monthly = Math.min(monthly, totalMonthlyIncome);

    // 변제금 총액은 채무 원금을 초과할 수 없음 → 초과 시 기간 단축
    let actualM = m;
    let total = monthly * m;
    if (planPrincipal > 0 && total > planPrincipal && monthly > 0) {
      actualM = Math.ceil(planPrincipal / monthly);
      total = planPrincipal;
    }

    let needCutPct = 0;
    if (monthly > disposable && totalLivingCost > 0) {
      needCutPct = (monthly - disposable) / totalLivingCost;
    }
    needCutPct = Math.min(Math.max(needCutPct, 0), 1);

    const check = evaluatePlanAt(actualM, monthly, planCtx);
    let mode = '정상 상환';
    if (needCutPct > 0) {
      mode = needCutPct <= 0.15 ? '생계비 소폭 조정' : needCutPct <= 0.3 ? '생계비 대폭 조정' : '변제액 한도 초과';
    }
    if (actualM < m) mode = `${actualM}개월 완납 (채무 전액 변제)`;
    if (!check.satisfiesLiquidation) mode = '청산가치 불만족 (기각)';
    else if (!check.satisfiesPriority) mode = '우선채권 1/2 기간 내 완납 불가';

    rows.push({ m: actualM, monthly, total, needCutPct, mode });
  });

  // 9. Generate Top 3 Recommendations
  const top3: Top3Item[] = rows.map(row => {
    let label = `${row.m}개월 기본안`;
    let why = '청산가치 보장(라이프니츠 현가) 및 가용소득 전액 변제';
    if (row.m <= 24) {
      label = '3년 미만 단축 검토 단기 플랜';
      why = `3년 미만 단축 사유 (${shortPlan.reason})`;
    } else if (row.m <= 36) {
      label = `${row.m}개월 ${row.m < 36 ? '단축' : '표준'} 플랜`;
      why = row.m < 36 ? `채무 전액 변제로 ${row.m}개월 단축` : '법정 표준 개인회생 변제 기간';
    } else if (row.m <= 48) {
      label = `${row.m}개월 연장 플랜`;
      why = '36개월로 청산가치 충족 불가 시 비교용 연장안';
    } else {
      label = `${row.m}개월 최장 연장 플랜`;
      why = '청산가치 충족을 위한 최장 기간 변제';
    }
    const cutPct = Math.round(row.needCutPct * 100);
    return {
      label,
      m: row.m,
      monthly: row.monthly,
      total: row.total,
      needCutPct: row.needCutPct,
      mode: row.mode,
      limits: cutPct > 0 ? `생계비 ${cutPct}% 감액 필요` : '추가 감액 없음',
      why,
    };
  });

  // 10. Preferred Plan — 고객 진단기와 동일한 determineRepaymentPlan 결과를 그대로 사용
  const corePlan = determineRepaymentPlan({
    monthlyIncome: totalMonthlyIncome,
    recognizedLivingCost: totalLivingCost,
    liquidationValue: totalLiquidationValue,
    generalDebt: generalDebtForPlan,
    priorityDebt: priorityDebtForPlan,
    allowShortPlan: allow2435,
  });
  const preferred: PreferredPlan | null = corePlan.status === 'NO_DEBT' ? null : {
    m: corePlan.months,
    monthly: corePlan.monthlyPayment,
    total: corePlan.totalRepayment,
    mode: corePlan.status === 'LIVING_COST_CUT'
      ? '생계비 감액 필요'
      : corePlan.status === 'ASSET_DISPOSAL'
        ? '재산처분 병행 필요 (D5111)'
        : corePlan.status === 'LIQUIDATION_EXCEEDS'
          ? '청산가치 불만족 (기각)'
          : '정상 상환',
    why: `${corePlan.why} · 라이프니츠 계수 ${corePlan.leibnizFactor.toFixed(4)} → 현재가치 ${corePlan.presentValue.toLocaleString()}원 (청산가치 ${totalLiquidationValue.toLocaleString()}원)`,
  };


  // 11. Alerts Generation
  const alerts: Alert[] = [];

  if (totalLiquidationValue > totalDebt) {
    alerts.push({
      type: 'impossible',
      message: '보유한 총 재산 가치(청산가치)가 총 채무 금액보다 많습니다. 법률상 개인회생 신청 요건에 해당하지 않아 기각될 확률이 매우 높습니다.',
      severity: 'error'
    });
  }

  if (disposable <= 0) {
    alerts.push({
      type: 'income',
      message: '월 가용소득이 발생하지 않습니다. 생계비 공제 범위를 수동으로 축소하거나 추가 소득원(투잡, 파트타임 등)을 마련하여 가용소득을 확보해야 합니다.',
      severity: 'error'
    });
  }

  const preferredPlanRow = rows.find(r => r.m === (preferred?.m || 36));
  if (preferredPlanRow && preferredPlanRow.needCutPct > 0.3) {
    alerts.push({
      type: 'excess',
      message: '예상 월 변제금을 충당하기 위해 생계비에서 30% 이상의 대폭 감액이 불가피합니다. 법원 심사 시 변제 계획안의 성실성 및 생계 지속 가능성을 의심받아 기각될 우려가 있습니다.',
      severity: 'warn'
    });
  }

  // Check recent debt ratio
  const recentDebtTotal = data.debts.filter(d => d.isRecent).reduce((sum, d) => sum + d.principal, 0);
  if (totalDebt > 0 && (recentDebtTotal / totalDebt) >= 0.3) {
    alerts.push({
      type: 'recent_debt',
      message: '최근 1년 이내에 발생한 대출 금액의 비중이 30%를 초과합니다. 법원의 소명 요구가 극도로 까다로울 예정이며 변제율이 다소 상향 조정될 수 있습니다.',
      severity: 'warn'
    });
  }

  // ─── Breakdown: 계산 과정 상세 데이터 수집 ───
  const myIncome = data.incomeSources.reduce((sum, s) => sum + s.amount, 0);
  const spouseIncomeVal = data.spouseIncome || 0;
  const spouseIncomeRatioVal = myIncome > 0 && data.maritalStatus === 'married' ? spouseIncomeVal / myIncome : 0;
  let childRecogRate = 1.0;
  if (data.maritalStatus === 'married' && spouseIncomeVal > 0) {
    const uL = settings.policy.spouseIncomeRatioUnder ?? 0.7;
    const bL = settings.policy.spouseIncomeRatioBetween ?? 1.3;
    if (spouseIncomeRatioVal < uL) childRecogRate = settings.policy.spouseIncomeRatioUnderRate ?? 1.0;
    else if (spouseIncomeRatioVal <= bL) childRecogRate = settings.policy.spouseIncomeRatioBetweenRate ?? 0.5;
    else childRecogRate = settings.policy.spouseIncomeRatioOverRate ?? 0.0;
  }

  const dependentRules: string[] = [];
  if ((data.minorChildren || 0) > 0) dependentRules.push(`미성년 자녀 ${data.minorChildren}명 입력`);
  if (data.maritalStatus === 'married' && spouseIncomeVal > 0) {
    dependentRules.push(`배우자 소득 비율 ${Math.round(spouseIncomeRatioVal * 100)}% → 자녀 인정률 ${Math.round(childRecogRate * 100)}%`);
  }
  if (spouseAsDependant > 0) dependentRules.push('배우자 부양 인정: 미성년자녀/장애 有 + 연소득 100만원 이하');
  if (adultChildrenCount > 0) dependentRules.push(`성년자녀 ${adultChildrenCount}명 (소득기준 충족)`);
  dependentRules.push(`총 가구원수 = 1(본인) + ${totalDependents}(부양가족) = ${householdSize}인`);

  // 주거비 breakdown (계산과 같은 기준값)
  const householdSizeIntBd = Math.max(1, Math.floor(householdSize));
  const includedHousingBd = allowAdditional ? livingRulesBd.housingIncluded : 0;
  const housingLimitBd = allowAdditional ? livingRulesBd.housingLimit : 0;
  const actualHousingBd = (data.monthlyRent || 0) + (extra.utilities || 0);
  const housingRules: string[] = [];
  housingRules.push(`실제 주거비: ${actualHousingBd.toLocaleString()}원 (월세 ${(data.monthlyRent||0).toLocaleString()} + 공과금 ${(extra.utilities||0).toLocaleString()})`);
  housingRules.push(`기초생계비 포함 주거비: ${includedHousingBd.toLocaleString()}원 (${householdSizeIntBd <= 4 ? '의결사항 고정값' : '기초생계비 × 17.8%'})`);
  housingRules.push(`초과분: ${Math.max(0, actualHousingBd - includedHousingBd).toLocaleString()}원`);
  housingRules.push(`지역별 한도(${region}/${householdSizeIntBd}인): ${housingLimitBd.toLocaleString()}원`);
  housingRules.push(`최종 인정: ${additionalHousing.toLocaleString()}원 = min(초과분, 한도)`);

  // 교육비 breakdown
  const minorCntBd = data.minorChildren || 0;
  const eduLimitBd = MAX_ADDITIONAL_REGULAR_EDUCATION;
  const specEduLimitBd = MAX_ADDITIONAL_SPECIAL_EDUCATION;
  const eduRules: string[] = [];
  eduRules.push(`미성년 자녀 ${minorCntBd}명 × 1인당 (지출 − 기본 포함분 ${livingRulesBd.educationIncluded.toLocaleString()}원), 1인당 한도 ${livingRulesBd.educationLimit.toLocaleString()}원`);
  eduRules.push(`실제 교육비: ${(extra.education || 0).toLocaleString()}원 → 인정: ${additionalEducation.toLocaleString()}원`);

  const specEduRules: string[] = [];
  specEduRules.push(`미성년 자녀 ${minorCntBd}명 × 1인당 한도 ${specEduLimitBd.toLocaleString()}원 = 총 한도 ${(specEduLimitBd * minorCntBd).toLocaleString()}원`);
  specEduRules.push(`실제 특수교육비: ${(extra.specialEducation || 0).toLocaleString()}원 → 인정: ${additionalSpecialEd.toLocaleString()}원`);

  // 의료비 breakdown
  const medSizeKey = Math.min(householdSizeIntBd, 4) as 1|2|3|4;
  const includedMedicalBd = allowAdditional ? livingRulesBd.medicalIncluded : 0;
  const medRules: string[] = [];
  medRules.push(`기초생계비 포함 의료비(${householdSizeIntBd}인): ${includedMedicalBd.toLocaleString()}원`);
  medRules.push(`실제 의료비: ${(extra.medical || 0).toLocaleString()}원`);
  medRules.push(`초과분 인정: ${additionalMedical.toLocaleString()}원`);

  // 기타생계비 breakdown
  const otherEligible = courtConfig.allowOtherLivingCost && totalMonthlyIncome > baseMedianIncome * (yearPolicy.highIncomeEarnerMultiplier || 1.5);
  let otherEligibilityReason = '';
  const otherRules: string[] = [];
  if (!courtConfig.allowOtherLivingCost) {
    otherEligibilityReason = '해당 법원은 기타생계비 인정 대상 아님';
    otherRules.push('회생법원(서울/수원/부산/대전/대구/광주)만 기타생계비 인정 가능');
  } else if (!otherEligible) {
    otherEligibilityReason = `소득(${totalMonthlyIncome.toLocaleString()}) < 중위소득 150%(${Math.round(baseMedianIncome * 1.5).toLocaleString()}) → 미해당`;
    otherRules.push('기타생계비 조건: 소득이 기준 중위소득의 150% 이상이어야 함');
  } else {
    otherEligibilityReason = '조건 충족';
    otherRules.push('회생법원 관할 + 고소득(중위150%↑) + 변제율40%↑ 충족');
  }

  // 생계비 전체 rules
  const livingRules: string[] = [];
  livingRules.push(`${applyYear}년 ${householdSize}인가구 기준 중위소득: ${Math.round(baseMedianIncome).toLocaleString()}원`);
  livingRules.push(`기본 생계비 = 중위소득 × 60% = ${basicLivingCost.toLocaleString()}원`);
  const totalAdditional = additionalHousing + additionalEducation + additionalSpecialEd + additionalMedical + additionalOther;
  livingRules.push(`추가 생계비 합계: ${totalAdditional.toLocaleString()}원`);
  livingRules.push(`최종 인정 생계비: ${totalLivingCost.toLocaleString()}원`);

  // 변제금 breakdown
  const liqGuarantee36 = totalLiquidationValue > 0 ? Math.ceil(totalLiquidationValue / 36) : 0;
  const repayRules: string[] = [];
  repayRules.push(`가용소득 = 소득(${totalMonthlyIncome.toLocaleString()}) - 생계비(${totalLivingCost.toLocaleString()}) = ${disposable.toLocaleString()}원`);
  repayRules.push(`최저변제액(${totalDebt < 50000000 ? '5천만 미만: 채무×5%' : '5천만 이상: 채무×3%+100만'}): 총 ${minTotalByDebtScale.toLocaleString()}원`);
  repayRules.push(`청산가치 보장(36개월): 월 ${liqGuarantee36.toLocaleString()}원`);
  repayRules.push(`일반 최소 월 변제금: ${generalMinMonthly.toLocaleString()}원`);
  repayRules.push('월 변제금 = MAX(가용소득, 최저변제/기간, 청산가치보장, 일반최소)');

  // 청산가치 breakdown
  const liqItems: { label: string; amount: number; rule: string }[] = [];
  const liqExemptions: { label: string; amount: number }[] = [];
  let spouseAssetContrib = 0;
  let retirementContrib = 0;
  let retirementRule = '해당 없음';
  let totalBeforeExempt = 0;
  const typeLabels: Record<string, string> = { deposit: '임차보증금', realestate: '부동산', realestate_general: '부동산', land: '토지', vehicle: '차량', business_vehicle: '차량', savings: '예금/적금', stock: '주식/코인', insurance: '보험', severance: '퇴직금', other: '기타' };
  data.assets.forEach(asset => {
    if (asset.isExempt) return;
    totalBeforeExempt += asset.marketValue;
    if (asset.owner === 'spouse' && !courtConfig.includeSpouseProperty) {
      liqItems.push({ label: typeLabels[asset.type] || asset.type, amount: 0, rule: '법원 정책: 배우자 재산 미반영' });
    }
  });
  liqSource.forEach((asset, i) => {
    const row = liqRows[i];
    const label = asset.type === 'severance' && data.retirementPensionType === 'pension' ? '퇴직금(연금형)' : (typeLabels[asset.type] || asset.type);
    let rule = '시가 기준 평가';
    if (asset.owner === 'spouse') {
      rule = '배우자 재산 50% 반영 (공제 없음)';
      spouseAssetContrib += row.liquidationValue;
    } else if (row.category === 'RETIREMENT') {
      rule = row.isRetirementPension ? 'DB/DC형 연금 → 압류 불가, 청산가치 0원' : '비연금형 → 50%만 압류 가능';
      retirementRule = rule;
      retirementContrib += row.liquidationValue;
    } else if (row.category === 'HOUSING_DEPOSIT') {
      rule = row.statutoryDeduction > 0 ? `소액임차보증금 면제(${region}): ${row.statutoryDeduction.toLocaleString()}원 공제` : '소액임차 기준 초과 · 공제 없음';
    } else if (row.category === 'DEPOSIT') {
      rule = `예금 압류금지: 합산 250만 원 중 ${row.statutoryDeduction.toLocaleString()}원 공제`;
    } else if (row.category === 'INSURANCE') {
      rule = `보험 압류금지: 합산 250만 원 중 ${row.statutoryDeduction.toLocaleString()}원 공제`;
    } else if (asset.type === 'stock') {
      rule = '보유 주식·코인 평가액 (투자 손실금은 법원 실무에 따라 따로 판단)';
    }
    if (asset.owner !== 'spouse' && row.statutoryDeduction > 0 && row.category !== 'RETIREMENT') {
      liqExemptions.push({ label: asset.type, amount: Math.min(row.statutoryDeduction, Math.max(0, row.marketValue - row.encumbrance)) });
    }
    liqItems.push({ label, amount: row.liquidationValue, rule });
  });
  const liqRules: string[] = [];
  liqRules.push(`총 자산 시가: ${totalBeforeExempt.toLocaleString()}원`);
  liqRules.push(`면제 적용 후 순 청산가치: ${totalLiquidationValue.toLocaleString()}원`);
  liqRules.push('청산가치 보장 원칙: 총 변제금 ≥ 청산가치');

  const breakdown: CalculationBreakdown = {
    dependents: {
      minorChildren: data.minorChildren || 0,
      recognizedMinorChildren,
      spouseAsDependant,
      adultChildren: adultChildrenCount,
      otherDependents,
      totalDependents,
      spouseIncomeRatio: spouseIncomeRatioVal,
      childRecognitionRate: childRecogRate,
      householdSize,
      rules: dependentRules
    },
    livingCost: {
      baseMedianIncome: Math.round(baseMedianIncome),
      basicLivingCost,
      householdSize,
      housing: {
        actualExpense: actualHousingBd,
        includedInMedian: includedHousingBd,
        additionalLimit: housingLimitBd,
        recognized: additionalHousing,
        region,
        householdSizeUsed: householdSizeIntBd,
        rules: housingRules
      },
      education: {
        actualExpense: extra.education || 0,
        limitPerChild: eduLimitBd,
        childCount: minorCntBd,
        recognized: additionalEducation,
        rules: eduRules
      },
      specialEducation: {
        actualExpense: extra.specialEducation || 0,
        limitPerChild: specEduLimitBd,
        childCount: minorCntBd,
        recognized: additionalSpecialEd,
        rules: specEduRules
      },
      medical: {
        actualExpense: extra.medical || 0,
        includedInMedian: includedMedicalBd,
        recognized: additionalMedical,
        rules: medRules
      },
      otherLiving: {
        actualExpense: (extra.other || 0) + (data.monthlyInsurance || 0),
        recognized: additionalOther,
        eligible: otherEligible,
        eligibilityReason: otherEligibilityReason,
        rules: otherRules
      },
      totalAdditional,
      totalLivingCost,
      rules: livingRules
    },
    repayment: {
      disposableIncome: disposable,
      minTotalByDebtScale,
      minRepaymentRule: totalDebt < 50000000 ? '총 채무 5천만원 미만: 채무 × 5%' : '총 채무 5천만원 이상: 채무 × 3% + 100만원',
      generalMinMonthly,
      liquidationValue: totalLiquidationValue,
      liquidationGuaranteeMonthly36: liqGuarantee36,
      rules: repayRules
    },
    liquidation: {
      items: liqItems,
      totalBeforeExemption: totalBeforeExempt,
      exemptions: liqExemptions,
      spouseAssetContribution: spouseAssetContrib,
      spouseAssetRule: courtConfig.includeSpouseProperty ? '배우자 재산 50% 반영 (법원 정책)' : '배우자 재산 미반영',
      retirementPayContribution: retirementContrib,
      retirementPayRule: retirementRule,
      totalLiquidationValue,
      rules: liqRules
    }
  };

  return {
    caseId: 'SIMULATED',
    ownerId: data.ownerId || 'unknown',
    status: 'counseling',
    client: {
      name: data.clientName,
      age: 30,
      monthlyIncome: totalMonthlyIncome,
      dependents: totalDependents,
      court: data.selectedCourt,
      residence: data.residence
    },
    base: {
      disposable,
      living: totalLivingCost,
      debtTotal: totalDebt,
      liq: totalLiquidationValue,
      // 법원 기준 채무 분류
      grossDebtTotal: grossTotalDebt,
      debtTotalWithInterest: totalDebtWithInterest,
      unsecuredDebt,
      securedDebt: securedDebtTotal,
      securedRecovery: securedRecoveryTotal,
      securedDeficit,
      taxDebt,
      priorityDebt,
      totalInterest,
    },
    allow2435,
    rows,
    top3,
    preferred,
    alerts,
    breakdown
  };
};
