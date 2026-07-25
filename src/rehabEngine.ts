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
  const region: RegionKey = jurisdiction.region;

  // 4. Calculate Total Liquidation Value (총 청산가치)
  let totalLiquidationValue = 0;

  data.assets.forEach(asset => {
    if (asset.isExempt) return; // Skip if marked exempt

    // 퇴직금(severance): 연금형(pension)이면 압류 불가 → 청산가치 미반영
    if (asset.type === 'severance' && data.retirementPensionType === 'pension') {
      return;
    }

    // 퇴직금(severance): 비연금형이면 50%만 청산가치 반영 (법적으로 1/2만 압류 가능)
    if (asset.type === 'severance' && data.retirementPensionType !== 'pension') {
      const severanceValue = Math.round(asset.marketValue * 0.5);
      totalLiquidationValue += severanceValue;
      return;
    }

    // 코인/주식(stock): 법원별 설정에 따라 청산가치 포함/제외
    // 서울/수원/부산/대전/대구/광주 회생법원은 코인·주식 청산가치 제외
    if (asset.type === 'stock' && !courtConfig.includeCryptoStock) {
      return;
    }

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

  // ─── 추가 생계비 항목별 계산 (2026년 서울회생법원 생계비검토위원회 의결기준) ───
  const extra = data.extraLivingCost;
  let additionalHousing = 0;
  let additionalEducation = 0;
  let additionalSpecialEd = 0;
  let additionalMedical = 0;
  let additionalOther = 0;

  if (courtConfig.allowAdditionalLivingCost) {
    // ① 주거비: 실제 지출(월세+공과금) - 기초생계비 포함분, 지역×가구원수별 한도
    const actualHousing = (data.monthlyRent || 0) + (extra.utilities || 0);
    const householdSizeInt = Math.max(1, Math.round(householdSize));

    let includedHousing = 0;
    let housingAdditionalLimit = 0;

    if (householdSizeInt <= 4) {
      const housingRule = yearPolicy.housingCostLimits?.[region]?.[householdSizeInt];
      if (housingRule) {
        includedHousing = housingRule.includedInMedian;
        housingAdditionalLimit = housingRule.additionalLimit;
      }
    } else {
      // 5인 이상: 기초 생계비 × 17.8%, 추가 한도는 4인 기준 준용
      includedHousing = Math.round(basicLivingCost * 0.178);
      const rule4 = yearPolicy.housingCostLimits?.[region]?.[4];
      housingAdditionalLimit = rule4?.additionalLimit || 0;
    }

    const housingExcess = Math.max(0, actualHousing - includedHousing);
    additionalHousing = Math.min(housingExcess, housingAdditionalLimit);

    // ② 교육비: 미성년 자녀 1인당 일반 20만 / 특수 50만 한도
    const minorChildrenCount = data.minorChildren || 0;
    const eduLimit = yearPolicy.educationCost?.additionalLimit || 200000;
    const specialEduLimit = yearPolicy.specialEducationCost?.additionalLimit || 500000;

    additionalEducation = Math.min(extra.education || 0, eduLimit * minorChildrenCount);
    additionalSpecialEd = Math.min(extra.specialEducation || 0, specialEduLimit * minorChildrenCount);

    // ③ 의료비: 가구원수별 기초생계비 포함분 초과액만 인정
    const medicalSizeKey = Math.min(householdSizeInt, 4) as 1 | 2 | 3 | 4;
    const includedMedical = yearPolicy.medicalCostIncludedInMedian?.[medicalSizeKey] || 0;
    additionalMedical = Math.max(0, (extra.medical || 0) - includedMedical);
  }

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

  // Clamp living cost so it cannot exceed total income
  totalLivingCost = Math.min(totalLivingCost, totalMonthlyIncome);

  // Monthly Disposable Income (가용소득)
  const disposable = Math.max(0, totalMonthlyIncome - totalLivingCost);

  // 7. Determine if 24-Month Special Rule applies
  const hasSpecialCircumstance = data.specialCircumstances.singleParent ||
                                 data.specialCircumstances.basicLivelihood ||
                                 data.specialCircumstances.rentFraud ||
                                 data.specialCircumstances.severeDisability;
  const allow2435 = courtConfig.allow24Month && hasSpecialCircumstance;

  // 8. 최저 변제액 제공의 원칙 (채무 규모 기준)
  let minTotalByDebtScale = 0;
  if (totalDebt < 50000000) {
    // 총 채무 5,000만 원 미만: 채무 총액의 5% 이상
    minTotalByDebtScale = Math.ceil(totalDebt * 0.05);
  } else {
    // 총 채무 5,000만 원 이상: 채무 총액의 3% + 100만 원 이상
    minTotalByDebtScale = Math.ceil(totalDebt * 0.03) + 1000000;
  }

  // 일반 최소 월 변제금: 10만 원
  const generalMinMonthly = 100000;

  // 9. Simulation Rows for 24, 36, 48, 60 Months
  const simulatedMonths = allow2435 ? [24, 36, 48, 60] : [36, 48, 60];
  const rows: CalculationRow[] = [];

  simulatedMonths.forEach(m => {
    // Satisfy Liquidation Value Guarantee Principle: total repayment over m months >= totalLiquidationValue
    const minMonthlyToGuaranteeLiq = totalLiquidationValue > 0 ? Math.ceil(totalLiquidationValue / m) : 0;
    
    // Monthly repayment must be at least the disposable income, or higher to guarantee liquidation value
    let monthly = Math.max(disposable, minMonthlyToGuaranteeLiq);

    // 24개월 특례: 총 채무의 최소 20% 이상 변제 의무
    if (m === 24) {
      const minMonthlyFor20Pct = totalDebt > 0 ? Math.ceil((totalDebt * 0.2) / 24) : 0;
      monthly = Math.max(monthly, minMonthlyFor20Pct);
    }

    // 최저 변제액 원칙 적용: 채무 규모별 최소 총 변제액 + 일반 최소 월 10만 원
    const minMonthlyByDebtScale = Math.ceil(minTotalByDebtScale / m);
    monthly = Math.max(monthly, minMonthlyByDebtScale, generalMinMonthly);
    
    // Monthly repayment cannot exceed total monthly income
    monthly = Math.min(monthly, totalMonthlyIncome);

    // 변제금 총액은 채무를 초과할 수 없음 → 초과 시 기간 단축
    let actualM = m;
    let total = monthly * m;
    if (total > totalDebt && monthly > 0) {
      actualM = Math.ceil(totalDebt / monthly);
      total = totalDebt;
    }
    
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

    // 채무 전액 변제 시 기간 단축됨을 표시
    if (actualM < m) {
      mode = `${actualM}개월 완납 (채무 전액 변제)`;
    }

    if (monthly * actualM < totalLiquidationValue) {
      mode = '청산가치 불만족 (기각)';
    }

    // 24개월 특례: 총 변제액이 채무의 20% 미만이면 최소 변제 조건 미충족
    if (m === 24 && total < Math.ceil(totalDebt * 0.2)) {
      mode = '20% 최소 변제 미충족 (소득 부족)';
    }

    rows.push({
      m: actualM,
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
    
    if (row.m <= 36 && row.m > 24) {
      label = `${row.m}개월 ${row.m < 36 ? '단축' : '표준'} 플랜`;
      why = row.m < 36 ? `채무 전액 변제로 ${row.m}개월 단축` : '법정 표준 개인회생 변제 기간';
    } else if (row.m > 36 && row.m <= 48) {
      label = `${row.m}개월 연장 플랜`;
      why = '36개월로 청산가치 충족 불가 → 기간 연장으로 청산가치 변제';
    } else if (row.m > 48) {
      label = `${row.m}개월 최장 연장 플랜`;
      why = '청산가치 충족을 위한 최장 기간 변제';
    } else if (row.m <= 24) {
      label = '24개월 특례 단기 플랜';
      why = '취약계층 특별 생계 지원 최단 기간 변제 (총 채무의 20% 이상 변제 의무)';
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
  // 원칙: 36개월이 기본. 48/60개월 연장은 36개월로 청산가치를 충족하지 못할 때만.
  let preferred: PreferredPlan | null = null;
  const plan24 = rows.find(r => r.m <= 24);
  const plan36 = rows.find(r => r.m > 24 && r.m <= 36);
  const plan48 = rows.find(r => r.m > 36 && r.m <= 48);
  const plan60 = rows.find(r => r.m > 48 && r.m <= 60);

  if (plan24) {
    const minTotal20Pct = Math.ceil(totalDebt * 0.2);
    const meets20Pct = plan24.total >= minTotal20Pct;
    preferred = {
      m: plan24.m,
      monthly: plan24.monthly,
      total: plan24.total,
      mode: meets20Pct ? plan24.mode : '20% 최소 변제 미충족',
      why: `취약계층 24개월 특례 (최소 변제: 총 채무의 20% = ${Math.round(minTotal20Pct).toLocaleString()}원 이상${meets20Pct ? ' ✅ 충족' : ' ❌ 미충족'})`
    };
  } else if (plan36) {
    // 기본: 36개월 (또는 채무 전액 변제로 단축된 기간)
    preferred = {
      m: plan36.m,
      monthly: plan36.monthly,
      total: plan36.total,
      mode: plan36.mode,
      why: plan36.m < 36
        ? `가용소득으로 ${plan36.m}개월만에 채무 전액 변제 가능`
        : '36개월 표준 변제 플랜'
    };

    // 36개월로 청산가치를 충족하지 못할 때만 48/60개월 연장
    // (청산가치가 높아 36개월 × 월변제로 부족한 경우)
    if (totalLiquidationValue > 0) {
      const baseMonthlyWithoutLiq = Math.max(disposable, Math.ceil(minTotalByDebtScale / 36), generalMinMonthly);
      const liqMonthly36 = Math.ceil(totalLiquidationValue / 36);

      if (liqMonthly36 > baseMonthlyWithoutLiq) {
        // 청산가치 때문에 36개월 월변제가 높아짐 → 기간 연장으로 월 부담 완화
        if (plan48) {
          const liqMonthly48 = Math.ceil(totalLiquidationValue / 48);
          if (liqMonthly48 <= baseMonthlyWithoutLiq) {
            preferred = {
              m: plan48.m, monthly: plan48.monthly, total: plan48.total, mode: plan48.mode,
              why: `36개월로 청산가치(${totalLiquidationValue.toLocaleString()}원) 충족 불가 → 48개월 연장`
            };
          } else if (plan60) {
            preferred = {
              m: plan60.m, monthly: plan60.monthly, total: plan60.total, mode: plan60.mode,
              why: `36개월로 청산가치(${totalLiquidationValue.toLocaleString()}원) 충족 불가 → 60개월 연장`
            };
          } else {
            preferred = {
              m: plan48.m, monthly: plan48.monthly, total: plan48.total, mode: plan48.mode,
              why: `청산가치 충족을 위한 48개월 연장 (월 부담 완화)`
            };
          }
        } else if (plan60) {
          preferred = {
            m: plan60.m, monthly: plan60.monthly, total: plan60.total, mode: plan60.mode,
            why: `36개월로 청산가치(${totalLiquidationValue.toLocaleString()}원) 충족 불가 → 60개월 연장`
          };
        }
      }
    }
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
