/**
 * 대법원 공식 [전산양식 D5102] 개인회생 재산목록 및
 * 신우법무사 기준 11대 자산 가치 산정 & 변제계획안 동기화 엔진
 */

import {
  RealEstateItem,
  VehicleItem,
  LeaseDepositItem,
  InsuranceItem,
  SeveranceItem,
  FinancialAssetItem,
  PropertyListD5102Data,
} from '../../types/propertyTypes';
import {
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  RegionType,
} from '../repayment/repaymentConstants2026';
import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { RepaymentAsset } from '../repayment/repaymentTypes';

// 예금 압류금지 최신 기준 (민사집행법 시행령 개정: 250만 원)
export const EXEMPT_DEPOSIT_LIMIT_2026 = 2500000;

// ── 1. 자산별 개별 평가 및 청산가치 연산 ──

/**
 * 부동산 공시가격 130% 공식 계산
 */
export function calculatePublicPrice130(publicPrice: number): number {
  if (!publicPrice || publicPrice <= 0) return 0;
  return Math.round(publicPrice * 1.3);
}

/**
 * 부동산 청산가치 계산: 시가(공시가 130% or KB시세) - 담보대출(근저당 피담보채무)
 */
export function calculateRealEstateLiquidation(item: RealEstateItem): number {
  let effectiveMarketValue = item.marketValue;
  if (
    item.valuationMethod === 'public_price_130' &&
    item.officialPublicPrice &&
    item.officialPublicPrice > 0
  ) {
    effectiveMarketValue = calculatePublicPrice130(item.officialPublicPrice);
  }

  // 지분율 반영
  const share = item.shareRatio > 0 ? item.shareRatio : 1.0;
  const netValue = Math.max(0, effectiveMarketValue * share - item.mortgageBalance);
  return Math.round(netValue);
}

/**
 * 자동차/오토바이 청산가치 계산: 시가(엔카/차차차 평균 or 보험개발원) - 담보할부대출
 */
export function calculateVehicleLiquidation(item: VehicleItem): number {
  const net = item.marketValue - item.loanBalance;
  return Math.max(0, net);
}

/**
 * 임차보증금 반환채권 청산가치 계산: 보증금 - 연체차임 - 질권대출 - 2026 소액보증금 공제
 */
export function calculateLeaseDepositLiquidation(item: LeaseDepositItem): number {
  const limitInfo =
    HOUSING_EXEMPT_DEPOSIT_LIMITS[item.region] || HOUSING_EXEMPT_DEPOSIT_LIMITS.SEOUL;
  
  let exemption = 0;
  // 주거용인 경우 소액임차보증금 요건 확인 (보증금이 기준액 이하일 때 최우선변제금 공제)
  if (item.leaseType === 'housing') {
    if (item.depositAmount <= limitInfo.maxDeposit) {
      exemption = limitInfo.exemptAmount;
    } else {
      // 보증금 요건을 초과하더라도 서울회생법원 등 실무상 소액보증금 상당액을 공제하는 경우 지원
      exemption = limitInfo.exemptAmount;
    }
  }

  const deductTotal = (item.unpaidRent || 0) + (item.pledgeLoanAmount || 0) + exemption;
  const net = item.depositAmount - deductTotal;
  return Math.max(0, net);
}

/**
 * 보험 해약환급금 청산가치 계산: 환급금 - 약관대출 - 150만 원(보장성 법정 압류금지)
 */
export function calculateInsuranceLiquidation(item: InsuranceItem): number {
  const statutoryDeduction = item.isSecurityInsurance ? EXEMPT_INSURANCE_REFUND_LIMIT : 0;
  const net = item.surrenderValue - (item.policyLoanBalance || 0) - statutoryDeduction;
  return Math.max(0, net);
}

/**
 * 퇴직금 청산가치 계산: 퇴직연금(DB/DC/IRP)은 0원 (전액 면제), 일반 퇴직금은 50% (1/2) 반영
 */
export function calculateSeveranceLiquidation(item: SeveranceItem): number {
  if (item.isRetirementPension) {
    return 0;
  }
  return Math.round(item.expectedAmount * 0.5);
}

/**
 * 금융자산(예금/주식/코인) 청산가치 계산
 */
export function calculateFinancialAssetLiquidation(item: FinancialAssetItem): number {
  if (item.category === 'deposit') {
    // 예금 250만 원 공제
    const net = item.marketValue - EXEMPT_DEPOSIT_LIMIT_2026;
    return Math.max(0, net);
  }
  if (item.isLossExcluded) {
    // 손실금 특례 배제 시 0원
    return 0;
  }
  return item.marketValue;
}

// ── 2. D5102 재산목록 총괄 집계 ──

export function recalculateD5102Totals(data: PropertyListD5102Data): PropertyListD5102Data {
  let totalMarketValue = 0;
  let totalEncumbrance = 0;
  let totalStatutoryDeduction = 0;
  let totalLiquidationValue = 0;

  // 1. 부동산
  const updatedRealEstates = (data.realEstates || []).map((re) => {
    const liq = calculateRealEstateLiquidation(re);
    totalMarketValue += re.marketValue;
    totalEncumbrance += re.mortgageBalance;
    totalLiquidationValue += liq;
    return { ...re, liquidationValue: liq };
  });

  // 2. 차량
  const updatedVehicles = (data.vehicles || []).map((v) => {
    const liq = calculateVehicleLiquidation(v);
    totalMarketValue += v.marketValue;
    totalEncumbrance += v.loanBalance;
    totalLiquidationValue += liq;
    return { ...v, liquidationValue: liq };
  });

  // 3. 임차보증금
  const updatedLeaseDeposits = (data.leaseDeposits || []).map((ld) => {
    const liq = calculateLeaseDepositLiquidation(ld);
    const limitInfo =
      HOUSING_EXEMPT_DEPOSIT_LIMITS[ld.region] || HOUSING_EXEMPT_DEPOSIT_LIMITS.SEOUL;
    const exemption = ld.leaseType === 'housing' ? limitInfo.exemptAmount : 0;
    
    totalMarketValue += ld.depositAmount;
    totalEncumbrance += (ld.unpaidRent || 0) + (ld.pledgeLoanAmount || 0);
    totalStatutoryDeduction += exemption;
    totalLiquidationValue += liq;
    return { ...ld, statutoryExemption: exemption, liquidationValue: liq };
  });

  // 4. 보험
  const updatedInsurances = (data.insurances || []).map((ins) => {
    const liq = calculateInsuranceLiquidation(ins);
    const deduction = ins.isSecurityInsurance ? EXEMPT_INSURANCE_REFUND_LIMIT : 0;
    totalMarketValue += ins.surrenderValue;
    totalEncumbrance += ins.policyLoanBalance || 0;
    totalStatutoryDeduction += deduction;
    totalLiquidationValue += liq;
    return { ...ins, statutoryDeduction: deduction, liquidationValue: liq };
  });

  // 5. 퇴직금
  const updatedSeverances = (data.severances || []).map((sev) => {
    const liq = calculateSeveranceLiquidation(sev);
    const deduction = sev.isRetirementPension
      ? sev.expectedAmount
      : Math.round(sev.expectedAmount * 0.5);
    totalMarketValue += sev.expectedAmount;
    totalStatutoryDeduction += deduction;
    totalLiquidationValue += liq;
    return { ...sev, statutoryDeduction: deduction, liquidationValue: liq };
  });

  // 6. 금융자산
  const updatedFinancialAssets = (data.financialAssets || []).map((fa) => {
    const liq = calculateFinancialAssetLiquidation(fa);
    const deduction = fa.category === 'deposit' ? Math.min(fa.marketValue, EXEMPT_DEPOSIT_LIMIT_2026) : 0;
    totalMarketValue += fa.marketValue;
    totalStatutoryDeduction += deduction;
    totalLiquidationValue += liq;
    return { ...fa, statutoryDeduction: deduction, liquidationValue: liq };
  });

  return {
    ...data,
    realEstates: updatedRealEstates,
    vehicles: updatedVehicles,
    leaseDeposits: updatedLeaseDeposits,
    insurances: updatedInsurances,
    severances: updatedSeverances,
    financialAssets: updatedFinancialAssets,
    totalMarketValue,
    totalEncumbrance,
    totalStatutoryDeduction,
    totalLiquidationValue,
    updatedAt: new Date().toISOString(),
  };
}

// ── 3. 상담 의뢰 데이터 기반 D5102 초기 데이터 자동 생성 ──

export function convertConsultRequestToD5102(
  request: ConsultRequest,
  crmExt?: CrmClientExtension
): PropertyListD5102Data {
  if (crmExt?.propertyListD5102) {
    return recalculateD5102Totals(crmExt.propertyListD5102);
  }

  const clientName = request.userName || request.clientName || '신청인';
  const fp = request.financialProfile;
  const assetsTotal = (fp?.assetsTotal || 0) * 10000;
  const region: RegionType = (fp?.region as RegionType) || 'SEOUL';

  // 금융 프로필 자산 파싱
  const realEstates: RealEstateItem[] = [];
  const vehicles: VehicleItem[] = [];
  const leaseDeposits: LeaseDepositItem[] = [];
  const insurances: InsuranceItem[] = [];
  const severances: SeveranceItem[] = [];
  const financialAssets: FinancialAssetItem[] = [];

  // 기본 주택/보증금 슬롯 생성
  if (assetsTotal > 0) {
    // 3,000만 원 초과 시 임차보증금 가산
    if (assetsTotal >= 30000000) {
      leaseDeposits.push({
        id: 'ld-init-1',
        address: request.address || '서울특별시 마포구 백범로 (임차 주택)',
        depositAmount: Math.min(assetsTotal, 80000000),
        unpaidRent: 0,
        pledgeLoanAmount: 0,
        region,
        statutoryExemption: 55000000,
        liquidationValue: Math.max(0, Math.min(assetsTotal, 80000000) - 55000000),
        leaseType: 'housing',
        hasFixedDate: true,
        note: '확정일자부 임대차계약서 구비',
      });
    }

    // 예금 슬롯
    financialAssets.push({
      id: 'fa-init-1',
      category: 'deposit',
      institutionName: '국민은행',
      description: '주거래 급여통장',
      marketValue: Math.min(3000000, Math.round(assetsTotal * 0.1)),
      statutoryDeduction: EXEMPT_DEPOSIT_LIMIT_2026,
      liquidationValue: Math.max(0, Math.min(3000000, Math.round(assetsTotal * 0.1)) - EXEMPT_DEPOSIT_LIMIT_2026),
      note: '압류금지 250만 원 공제 반영',
    });

    // 보험 슬롯
    insurances.push({
      id: 'ins-init-1',
      companyName: '삼성생명',
      policyName: '보장성 통합건강보험',
      isSecurityInsurance: true,
      surrenderValue: Math.min(2500000, Math.round(assetsTotal * 0.08)),
      policyLoanBalance: 0,
      statutoryDeduction: EXEMPT_INSURANCE_REFUND_LIMIT,
      liquidationValue: Math.max(0, Math.min(2500000, Math.round(assetsTotal * 0.08)) - EXEMPT_INSURANCE_REFUND_LIMIT),
      note: '보장성보험 150만 원 법정 공제',
    });
  }

  const initialData: PropertyListD5102Data = {
    id: `D5102-${request.id}`,
    clientId: request.id,
    clientName,
    baseDate: new Date().toISOString().slice(0, 10),
    realEstates,
    vehicles,
    leaseDeposits,
    insurances,
    severances,
    financialAssets,
    totalMarketValue: 0,
    totalEncumbrance: 0,
    totalStatutoryDeduction: 0,
    totalLiquidationValue: 0,
    isCompleted: false,
    updatedAt: new Date().toISOString(),
  };

  return recalculateD5102Totals(initialData);
}

// ── 4. D5102 데이터를 변제계획안 RepaymentAsset 배열로 변환 ──

export function syncD5102ToRepaymentAssets(d5102: PropertyListD5102Data): RepaymentAsset[] {
  const result: RepaymentAsset[] = [];

  // 부동산
  d5102.realEstates.forEach((re) => {
    result.push({
      id: re.id,
      category: 'REAL_ESTATE',
      name: `부동산: ${re.address} (${re.type === 'apartment_officetel' ? '아파트/오피스텔' : '주택/토지'})`,
      marketValue: re.marketValue,
      encumbrance: re.mortgageBalance,
      statutoryDeduction: 0,
      liquidationValue: re.liquidationValue,
      note: re.valuationMethod === 'public_price_130' ? '공시가격 130% 적용' : 'KB시세 일반가',
    });
  });

  // 자동차
  d5102.vehicles.forEach((v) => {
    result.push({
      id: v.id,
      category: 'CAR',
      name: `차량: ${v.modelName} (${v.plateNumber || '미등록'})`,
      marketValue: v.marketValue,
      encumbrance: v.loanBalance,
      statutoryDeduction: 0,
      liquidationValue: v.liquidationValue,
      note: `연식: ${v.year}년`,
    });
  });

  // 임차보증금
  d5102.leaseDeposits.forEach((ld) => {
    result.push({
      id: ld.id,
      category: 'HOUSING_DEPOSIT',
      name: `임차보증금: ${ld.address}`,
      marketValue: ld.depositAmount,
      encumbrance: (ld.unpaidRent || 0) + (ld.pledgeLoanAmount || 0),
      statutoryDeduction: ld.statutoryExemption,
      liquidationValue: ld.liquidationValue,
      note: `지역: ${ld.region} 최우선변제금 공제`,
    });
  });

  // 보험
  d5102.insurances.forEach((ins) => {
    result.push({
      id: ins.id,
      category: 'INSURANCE',
      name: `보험: ${ins.companyName} (${ins.policyName})`,
      marketValue: ins.surrenderValue,
      encumbrance: ins.policyLoanBalance,
      statutoryDeduction: ins.statutoryDeduction,
      liquidationValue: ins.liquidationValue,
      note: ins.isSecurityInsurance ? '보장성 150만 원 공제' : '저축성보험',
    });
  });

  // 퇴직금
  d5102.severances.forEach((sev) => {
    result.push({
      id: sev.id,
      category: 'RETIREMENT',
      name: `퇴직금: ${sev.workplaceName}`,
      marketValue: sev.expectedAmount,
      encumbrance: 0,
      statutoryDeduction: sev.statutoryDeduction,
      liquidationValue: sev.liquidationValue,
      isRetirementPension: sev.isRetirementPension,
      note: sev.isRetirementPension ? '퇴직연금 전액 면제 (0원)' : '일반퇴직금 50% 반영',
    });
  });

  // 금융자산
  d5102.financialAssets.forEach((fa) => {
    result.push({
      id: fa.id,
      category: fa.category === 'deposit' ? 'DEPOSIT' : 'OTHER',
      name: `${fa.institutionName} (${fa.description})`,
      marketValue: fa.marketValue,
      encumbrance: 0,
      statutoryDeduction: fa.statutoryDeduction,
      liquidationValue: fa.liquidationValue,
      note: fa.note,
    });
  });

  return result;
}
