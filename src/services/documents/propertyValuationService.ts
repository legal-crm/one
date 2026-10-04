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
  BusinessAssetItem,
  ExemptPropertyItem,
  PropertyListD5102Data,
} from '../../types/propertyTypes';
import {
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  EXEMPT_DEPOSIT_LIMIT,
  RegionType,
} from '../repayment/repaymentConstants2026';
import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { RepaymentAsset } from '../repayment/repaymentTypes';

// 예금 압류금지 공제액 — 단일 기준값(repaymentConstants2026.EXEMPT_DEPOSIT_LIMIT)을 사용해 챗봇·CRM 엔진과 일치시킨다.
// ※ 기존 이 파일만 250만 원을 사용해 다른 엔진(185만 원)과 청산가치가 달랐음. 기준 변경 시 상수 한 곳만 수정.
export const EXEMPT_DEPOSIT_LIMIT_2026 = EXEMPT_DEPOSIT_LIMIT;

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
  
  const net = item.depositAmount - (item.unpaidRent || 0) - (item.pledgeLoanAmount || 0) - getLeaseDepositExemption(item);
  return Math.max(0, net);
}

/**
 * 임차보증금 면제(소액임차인 최우선변제금 상당액) 공제액
 * - 주거용 + 보증금이 지역별 소액임차인 기준 이하인 경우에만 공제 (기존: 기준 초과 시에도 동일 공제 → 청산가치 과소)
 * - 공제액은 연체차임·질권대출을 뺀 잔존 보증금을 넘지 않음
 * ※ 기준 초과 보증금에 대한 법원별 실무 특례는 담당 변호사가 개별 검토
 */
export function getLeaseDepositExemption(item: LeaseDepositItem): number {
  if (item.leaseType !== 'housing') return 0;
  const limitInfo =
    HOUSING_EXEMPT_DEPOSIT_LIMITS[item.region] || HOUSING_EXEMPT_DEPOSIT_LIMITS.SEOUL;
  if (item.depositAmount > limitInfo.maxDeposit) return 0;
  const remaining = Math.max(0, item.depositAmount - (item.unpaidRent || 0) - (item.pledgeLoanAmount || 0));
  return Math.min(limitInfo.exemptAmount, remaining);
}

/**
 * 보험 해약환급금 청산가치 계산: 환급금 - 약관대출 - 150만 원(보장성 법정 압류금지)
 */
export function calculateInsuranceLiquidation(item: InsuranceItem): number {
  const net = Math.max(0, item.surrenderValue - (item.policyLoanBalance || 0));
  return Math.max(0, net - getInsuranceDeduction(item));
}

/** 보장성 보험 해약환급금 공제액 (약관대출 차감 후 환급금을 넘지 않음) */
export function getInsuranceDeduction(item: InsuranceItem): number {
  if (!item.isSecurityInsurance) return 0;
  const net = Math.max(0, item.surrenderValue - (item.policyLoanBalance || 0));
  return Math.min(EXEMPT_INSURANCE_REFUND_LIMIT, net);
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
    // 단일 계좌 기준 참고값 — 실제 합계 공제는 recalculateD5102Totals에서 전체 예금에 1회 적용
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
    // 공시가 130% 추정 방식이면 시가 칸도 같은 값으로 맞춰 총괄표(시가 합계 − 담보 = 청산가치)가 서로 맞도록 함
    const effectiveMarket =
      re.valuationMethod === 'public_price_130' && re.officialPublicPrice && re.officialPublicPrice > 0
        ? calculatePublicPrice130(re.officialPublicPrice)
        : re.marketValue;
    totalMarketValue += effectiveMarket;
    totalEncumbrance += re.mortgageBalance;
    totalLiquidationValue += liq;
    return { ...re, marketValue: effectiveMarket, liquidationValue: liq };
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
    const exemption = getLeaseDepositExemption(ld);
    
    totalMarketValue += ld.depositAmount;
    totalEncumbrance += (ld.unpaidRent || 0) + (ld.pledgeLoanAmount || 0);
    totalStatutoryDeduction += exemption;
    totalLiquidationValue += liq;
    return { ...ld, statutoryExemption: exemption, liquidationValue: liq };
  });

  // 4. 보험
  const updatedInsurances = (data.insurances || []).map((ins) => {
    const liq = calculateInsuranceLiquidation(ins);
    const deduction = getInsuranceDeduction(ins);
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
  // 예금 압류금지 공제는 계좌별이 아니라 전체 예금 합계에 1회 적용 (기존: 계좌마다 공제 → 계좌 수만큼 과다 공제)
  let remainingDepositExemption = EXEMPT_DEPOSIT_LIMIT_2026;
  const updatedFinancialAssets = (data.financialAssets || []).map((fa) => {
    let deduction = 0;
    let liq: number;
    if (fa.category === 'deposit') {
      const balance = Math.max(0, fa.marketValue || 0);
      deduction = Math.min(balance, remainingDepositExemption);
      remainingDepositExemption -= deduction;
      liq = balance - deduction;
    } else {
      liq = calculateFinancialAssetLiquidation(fa);
    }
    totalMarketValue += fa.marketValue;
    totalStatutoryDeduction += deduction;
    totalLiquidationValue += liq;
    return { ...fa, statutoryDeduction: deduction, liquidationValue: liq };
  });

  // 7. 사업용 설비, 대여금 채권, 외상매출금 채권 (리걸플로 7-4 그림 7-12)
  const updatedBusinessAssets = (data.businessAssets || []).map((ba) => {
    const liq = Math.max(0, (ba.marketValue || 0) - (ba.encumbrance || 0));
    totalMarketValue += ba.marketValue || 0;
    totalEncumbrance += ba.encumbrance || 0;
    totalLiquidationValue += liq;
    return { ...ba, liquidationValue: liq };
  });

  // 8. 채무자회생법 제383조 제2항 면제재산 신청 항목 (리걸플로 7-4 그림 7-13)
  const updatedExemptProperties = (data.exemptProperties || []).map((ep) => {
    const deduct = ep.approvedAmount !== undefined ? ep.approvedAmount : (ep.appliedAmount || 0);
    totalStatutoryDeduction += deduct;
    return { ...ep };
  });

  // 최종 청산가치에서 신청된 면제재산 공제 (음수 방지)
  const totalExemptDeduct = (data.exemptProperties || []).reduce((sum, ep) => {
    return sum + (ep.approvedAmount !== undefined ? ep.approvedAmount : (ep.appliedAmount || 0));
  }, 0);
  totalLiquidationValue = Math.max(0, totalLiquidationValue - totalExemptDeduct);

  return {
    ...data,
    realEstates: updatedRealEstates,
    vehicles: updatedVehicles,
    leaseDeposits: updatedLeaseDeposits,
    insurances: updatedInsurances,
    severances: updatedSeverances,
    financialAssets: updatedFinancialAssets,
    businessAssets: updatedBusinessAssets,
    exemptProperties: updatedExemptProperties,
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

  const clientName = request.clientName || '신청인';
  const fp = request.financialProfile;
  const assetsTotal = (fp?.assetsTotal || 0) * 10000;
  const region: RegionType = ((request.region || fp?.residenceRegion) as RegionType) || 'SEOUL';

  // 금융 프로필 자산 파싱
  const realEstates: RealEstateItem[] = [];
  const vehicles: VehicleItem[] = [];
  const leaseDeposits: LeaseDepositItem[] = [];
  const insurances: InsuranceItem[] = [];
  const severances: SeveranceItem[] = [];
  const financialAssets: FinancialAssetItem[] = [];

  // 상담 시 입력한 "총 재산액"만으로 임차보증금·예금(국민은행)·보험(삼성생명) 항목을 임의로 나눠 만들지 않는다.
  // (이전: 총액을 8천만/10%/8% 비율로 쪼개 가공 재산 3건을 생성 → 재산목록·청산가치에 그대로 반영됨)
  // 재산 항목은 재산목록 편집기에서 실제 자료로 입력한다.
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
  // D5102에서 산정한 항목별 공제액을 변제계획 엔진이 그대로 쓰도록 deductionOverridden 표시 (함수 끝에서 일괄 적용)

  // 부동산
  d5102.realEstates.forEach((re) => {
    const isSpouse = re.ownerType === 'spouse';
    result.push({
      id: re.id,
      category: 'REAL_ESTATE',
      name: `부동산: ${re.address} (${re.type === 'apartment_officetel' ? '아파트/오피스텔' : '주택/토지'})`,
      marketValue: re.marketValue,
      encumbrance: re.mortgageBalance,
      statutoryDeduction: 0,
      liquidationValue: re.liquidationValue,
      ownerType: isSpouse ? 'SPOUSE' : 'DEBTOR',
      spouseContributionRatio: isSpouse ? (re.shareRatio || 0.5) : undefined,
      note: re.valuationMethod === 'public_price_130' ? '공시가격 130% 적용' : 'KB시세 일반가',
    });
  });

  // 자동차
  d5102.vehicles.forEach((v) => {
    const isSpouse = v.ownerType === 'spouse';
    result.push({
      id: v.id,
      category: 'CAR',
      name: `차량: ${v.modelName} (${v.plateNumber || '미등록'})`,
      marketValue: v.marketValue,
      encumbrance: v.loanBalance,
      statutoryDeduction: 0,
      liquidationValue: v.liquidationValue,
      ownerType: isSpouse ? 'SPOUSE' : 'DEBTOR',
      spouseContributionRatio: isSpouse ? 0.5 : undefined,
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

  return result.map((a) => ({ ...a, deductionOverridden: true }));
}
