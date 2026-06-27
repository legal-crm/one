import { IntakeData, AppSettings, ComputeResponse, CalculationRow, Top3Item, PreferredPlan, Alert, RegionKey } from './types';
import { detectJurisdiction } from './utils';

/**
 * Korean Individual Rehabilitation Calculation Engine
 * Strictly computes disposable income, liquidation value, and simulates repayment plans.
 */
export const calculateRehabPlan = (data: IntakeData, settings: AppSettings): ComputeResponse => {
  const applyYear = data.applyYear || new Date().getFullYear();
  const yearPolicy = settings.yearlyPolicies[applyYear] || settings.yearlyPolicies[2025];
  const courtConfig = settings.courtConfigs[data.selectedCourt] || {
    includeSpouseProperty: true,
    includeCryptoStock: true,
    allow24Month: data.selectedCourt === '서울회생법원',
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

  const adultChildrenCount = data.adultChildrenCount || 0;
  const otherDependents = data.otherDependents || 0;
  const totalDependents = recognizedMinorChildren + adultChildrenCount + otherDependents;

  // 2. Calculate Total Net Income (Monthly)
  const totalMonthlyIncome = data.incomeSources.reduce((sum, source) => sum + source.amount, 0);

  // 3. Determine Region for Asset Exemptions (소액임차보증금 범위)
  const jurisdiction = detectJurisdiction(data.residence, settings.courtRegionMap);
  const region: RegionKey = jurisdiction.region;

  // 4. Calculate Total Liquidation Value (총 청산가치)
  let totalLiquidationValue = 0;

  data.assets.forEach(asset => {
    if (asset.isExempt) return; // Skip if marked exempt

    let value = asset.marketValue;
    
    // Subtract secured loan if it has a pledge
    if (asset.hasPledge) {
      value = Math.max(0, value - asset.loanBalance);
    }

    // Apply specific exemption rules
    if (asset.type === 'deposit') {
      const depositRule = yearPolicy.depositRules[region];
      if (depositRule) {
        // If the deposit is within the limit, protect up to deduct
        if (asset.marketValue <= depositRule.limit) {
          value = Math.max(0, value - depositRule.deduct);
        }
      }
    } else if (asset.type === 'insurance') {
      const insuranceExempt = yearPolicy.assetExemptions.insurance;
      value = Math.max(0, value - insuranceExempt);
    }

    // Apply spouse asset inclusion (usually 50% in Korea)
    if (asset.owner === 'spouse') {
      if (courtConfig.includeSpouseProperty) {
        value = Math.round(value * 0.5);
      } else {
        value = 0;
      }
    }

    totalLiquidationValue += value;
  });

  // 5. Calculate Total Debt (총 채무액)
  const totalDebt = data.debts.reduce((sum, d) => sum + d.principal, 0);

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

  // Basic Living Cost is 60% of Median Income
  const basicLivingCost = Math.round(baseMedianIncome * 0.6);

  // Additional living costs (월세, 보험료 등 추가 생계비)
  const rent = data.monthlyRent || 0;
  const insurance = data.monthlyInsurance || 0;
  const extra = data.extraLivingCost;
  const extraSum = (extra.utilities || 0) + (extra.education || 0) + (extra.specialEducation || 0) + (extra.medical || 0) + (extra.other || 0);

  // Total Allowed Living Cost (기본생계비 + 수동 추가 공제 적용)
  let totalLivingCost = data.monthlyLivingCost > 0 ? data.monthlyLivingCost : basicLivingCost;
  
  if (courtConfig.allowAdditionalLivingCost) {
    totalLivingCost += rent + insurance + extraSum;
  }

  // Clamp living cost so it cannot exceed total income (debtor must have at least some disposable income)
  totalLivingCost = Math.min(totalLivingCost, totalMonthlyIncome);

  // Monthly Disposable Income (가용소득)
  const disposable = Math.max(0, totalMonthlyIncome - totalLivingCost);

  // 7. Determine if 24-Month Special Rule applies
  const hasSpecialCircumstance = data.specialCircumstances.singleParent ||
                                 data.specialCircumstances.basicLivelihood ||
                                 data.specialCircumstances.rentFraud ||
                                 data.specialCircumstances.severeDisability;
  const allow2435 = courtConfig.allow24Month && hasSpecialCircumstance;

  // 8. Simulation Rows for 24, 36, 48, 60 Months
  const simulatedMonths = allow2435 ? [24, 36, 48, 60] : [36, 48, 60];
  const rows: CalculationRow[] = [];

  simulatedMonths.forEach(m => {
    // Satisfy Liquidation Value Guarantee Principle: total repayment over m months >= totalLiquidationValue
    const minMonthlyToGuaranteeLiq = totalLiquidationValue > 0 ? Math.ceil(totalLiquidationValue / m) : 0;
    
    // Monthly repayment must be at least the disposable income, or higher to guarantee liquidation value
    let monthly = Math.max(disposable, minMonthlyToGuaranteeLiq);
    
    // Monthly repayment cannot exceed total monthly income
    monthly = Math.min(monthly, totalMonthlyIncome);
    
    const total = monthly * m;
    
    // Calculate how much living cost the debtor must sacrifice
    let needCutPct = 0;
    if (monthly > disposable && totalLivingCost > 0) {
      needCutPct = (monthly - disposable) / totalLivingCost;
    }
    needCutPct = Math.min(Math.max(needCutPct, 0), 1);

    let mode = '정상 상환';
    if (needCutPct > 0) {
      if (needCutPct <= 0.15) {
        mode = '생계비 소폭 조정';
      } else if (needCutPct <= 0.3) {
        mode = '생계비 대폭 조정';
      } else {
        mode = '변제액 한도 초과';
      }
    }

    if (monthly * m < totalLiquidationValue) {
      mode = '청산가치 불만족 (기각)';
    }

    rows.push({
      m,
      monthly,
      total,
      needCutPct,
      mode
    });
  });

  // 9. Generate Top 3 Recommendations
  const top3: Top3Item[] = rows.map(row => {
    let label = `${row.m}개월 기본안`;
    let why = '청산가치 보장 및 가용소득 전액 변제';
    
    if (row.m === 36) {
      label = '36개월 표준 플랜';
      why = '법정 표준 개인회생 변제 기간';
    } else if (row.m === 48) {
      label = '48개월 부담 경감 플랜';
      why = '변제 기간을 연장하여 월 부담 최소화';
    } else if (row.m === 60) {
      label = '60개월 최장 연장 플랜';
      why = '고액 채무 및 고가 자산 보유자 변제 보장';
    } else if (row.m === 24) {
      label = '24개월 특례 단기 플랜';
      why = '취약계층 특별 생계 지원 최단 기간 변제';
    }

    const cutPct = Math.round(row.needCutPct * 100);
    const limits = cutPct > 0 ? `생계비 ${cutPct}% 감액 필요` : '추가 감액 없음';

    return {
      label,
      m: row.m,
      monthly: row.monthly,
      total: row.total,
      needCutPct: row.needCutPct,
      mode: row.mode,
      limits,
      why
    };
  });

  // 10. Preferred Plan Choice
  // Standard preference: 36 months if no cut is required, otherwise extend to 48 or 60 to minimize the cut percentage.
  let preferred: PreferredPlan | null = null;
  const plan36 = rows.find(r => r.m === 36);
  const plan48 = rows.find(r => r.m === 48);
  const plan60 = rows.find(r => r.m === 60);
  const plan24 = rows.find(r => r.m === 24);

  if (plan24) {
    preferred = {
      m: 24,
      monthly: plan24.monthly,
      total: plan24.total,
      mode: plan24.mode,
      why: '취약계층을 위한 24개월 최단기 특별 탕감안 제공 대상'
    };
  } else if (plan36 && plan36.needCutPct === 0) {
    preferred = {
      m: 36,
      monthly: plan36.monthly,
      total: plan36.total,
      mode: plan36.mode,
      why: '추가 생계비 조정 없이 36개월 표준 기간 내 완료 가능한 플랜'
    };
  } else if (plan48 && plan48.needCutPct <= 0.1) {
    preferred = {
      m: 48,
      monthly: plan48.monthly,
      total: plan48.total,
      mode: plan48.mode,
      why: '월 생계비 감액 부담을 10% 이하로 줄이기 위한 48개월 연장 플랜'
    };
  } else if (plan60) {
    preferred = {
      m: 60,
      monthly: plan60.monthly,
      total: plan60.total,
      mode: plan60.mode,
      why: '청산가치 보장 한도를 만족하기 위한 최장 60개월 변제 플랜'
    };
  } else if (plan36) {
    preferred = {
      m: 36,
      monthly: plan36.monthly,
      total: plan36.total,
      mode: plan36.mode,
      why: '36개월 표준 플랜'
    };
  }

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

  return {
    caseId: 'SIMULATED',
    ownerId: data.ownerId || 'unknown',
    status: 'counseling',
    client: {
      name: data.clientName,
      age: 30, // Default age for simulation
      monthlyIncome: totalMonthlyIncome,
      dependents: totalDependents,
      court: data.selectedCourt,
      residence: data.residence
    },
    base: {
      disposable,
      living: totalLivingCost,
      debtTotal: totalDebt,
      liq: totalLiquidationValue
    },
    allow2435,
    rows,
    top3,
    preferred,
    alerts
  };
};
