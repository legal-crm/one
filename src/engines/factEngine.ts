import { IntakeData, AppSettings, ComputeResponse, DebtItem, AssetDetail } from '../types';
import { calculateRehabPlan } from '../rehabEngine';
import { DEFAULT_SETTINGS } from '../constants';

// ============================================================
// Fact Engine — 사실 기반 계산 엔진
// 법률 판단을 생성하지 않으며, 객관적 사실만 정리합니다.
// ============================================================

/** 누락 필드 정보 */
export interface MissingField {
  fieldName: string;
  fieldLabel: string;
  importance: 'required' | 'recommended' | 'optional';
  description: string;
}

/** 입력값 불일치 정보 */
export interface InputConflict {
  fieldA: string;
  fieldB: string;
  description: string;
  severity: 'warning' | 'error' | 'info';
}

/** 자산 요약 */
export interface AssetSummary {
  totalMarketValue: number;
  totalLoanBalance: number;
  netAssetValue: number;
  hasRealEstate: boolean;
  hasVehicle: boolean;
  hasInsurance: boolean;
  hasSeverance: boolean;
  hasStock: boolean;
  spouseAssetCount: number;
  // 민사집행법 제246조 압류금지 바스켓 필드
  exemptDepositTotal: number;       // 예금 185만 원 통합 공제액
  exemptInsuranceTotal: number;     // 보장성 보험 150만 원 한도 공제액
  exemptHousingDeposit: number;     // 주거용 소액임차보증금 공제액
  totalExemptDeductions: number;    // 총 압류금지 공제액
  effectiveLiquidationValue: number; // 압류금지 공제 후 최종 청산가치
}

/** 특수 채권 인터페이스 */
export interface SpecialDebtItem {
  creditor: string;
  principal: number;
  riskType: 'FRAUD_RISK' | 'TRANSFERRED' | 'GUARANTEED' | 'TAX_PRIORITY';
  reason: string;
  recommendedAction: string;
}

/** Fact Engine 출력 */
export interface FactEngineOutput {
  /** ① 입력사실 요약 */
  factSummary: {
    totalDebt: number;
    securedDebt: number;
    unsecuredDebt: number;
    taxDebt: number;
    monthlyIncome: number;
    monthlyExpense: number;
    disposableIncome: number;
    dependents: number;
    creditorCount: number;
    assets: AssetSummary;
    recentDebts: { creditor: string; principal: number; isRecent: boolean }[];
    delinquencyStatus: string;  // 연체 상태 텍스트 (사실)
    seizureStatus: string;      // 압류 상태 텍스트 (사실)
    previousHistory: boolean;
    delinquencyMonths: number;
    // 별제권 및 특수 채권 고도화 지표
    securedDebtCovered: number;              // 담보물로 우선 변제되는 유담보 채권
    pledgedAssetsEstimatedDeficit: number;  // 담보 처분 후 남는 무담보 예정부족액
    specialDebts: SpecialDebtItem[];        // 특수 채권(사기죄 위험, 양도, 보증) 목록
  };
  /** ② 누락정보 */
  missingFields: MissingField[];
  /** ③ 입력값 불일치 */
  conflicts: InputConflict[];
  /** ④ 원본 계산 결과 (내부 참고용, 고객 노출 금지) */
  rawComputeResponse: ComputeResponse;
  /** 메타데이터 */
  engineVersion: string;
  executedAt: string;
}

function detectMissingFields(data: IntakeData): MissingField[] {
  const missing: MissingField[] = [];
  if (!data.debts || data.debts.length === 0) {
    missing.push({ fieldName: 'debts', fieldLabel: '채권자별 채무 정보', importance: 'required', description: '채무 정보가 등록되지 않았습니다.' });
  } else {
    const hasEmptyCreditor = data.debts.some(d => !d.creditor || d.creditor.trim() === '');
    if (hasEmptyCreditor) {
      missing.push({ fieldName: 'debts.creditor', fieldLabel: '채권자명', importance: 'recommended', description: '일부 채무의 채권자명이 누락되었습니다.' });
    }
  }

  if (!data.incomeSources || data.incomeSources.length === 0) {
    missing.push({ fieldName: 'incomeSources', fieldLabel: '소득 정보', importance: 'required', description: '소득 정보가 등록되지 않았습니다.' });
  }

  if (!data.assets || data.assets.length === 0) {
    missing.push({ fieldName: 'assets', fieldLabel: '자산 정보', importance: 'recommended', description: '자산 정보가 등록되지 않았습니다.' });
  }

  if (!data.birthDate) {
    missing.push({ fieldName: 'birthDate', fieldLabel: '생년월일', importance: 'recommended', description: '생년월일이 누락되었습니다.' });
  }

  if (!data.residence) {
    missing.push({ fieldName: 'residence', fieldLabel: '거주지', importance: 'required', description: '거주지 정보가 누락되었습니다.' });
  }

  if (!data.maritalStatus) {
    missing.push({ fieldName: 'maritalStatus', fieldLabel: '혼인 상태', importance: 'recommended', description: '혼인 상태가 누락되었습니다.' });
  }

  if (data.specialCircumstances) {
    const { singleParent, basicLivelihood, rentFraud, severeDisability } = data.specialCircumstances;
    if (!singleParent && !basicLivelihood && !rentFraud && !severeDisability) {
      missing.push({ fieldName: 'specialCircumstances', fieldLabel: '특수사정', importance: 'optional', description: '특수사정이 하나도 체크되지 않았습니다.' });
    }
  }

  return missing;
}

function detectConflicts(data: IntakeData, totalIncome: number, totalDebt: number): InputConflict[] {
  const conflicts: InputConflict[] = [];

  if (totalIncome === 0 && totalDebt > 0) {
    conflicts.push({
      fieldA: 'incomeSources',
      fieldB: 'debts',
      severity: 'warning',
      description: '소득이 0원인데 채무가 존재합니다. 현재 무직 상태인지 확인이 필요합니다.'
    });
  }

  const hasDependents = (data.minorChildren || 0) > 0 || (data.otherDependents || 0) > 0;
  if (hasDependents && data.maritalStatus === 'single') {
    conflicts.push({
      fieldA: 'dependents',
      fieldB: 'maritalStatus',
      severity: 'warning',
      description: '혼인상태가 미혼(single)이나 부양가족(자녀 등)이 존재합니다.'
    });
  }

  const totalExpense = (data.monthlyLivingCost || 0) + (data.monthlyRent || 0) + (data.monthlyInsurance || 0);
  if (totalExpense > totalIncome && totalIncome > 0) {
    conflicts.push({
      fieldA: 'expenses',
      fieldB: 'incomeSources',
      severity: 'warning',
      description: '월 지출 총액이 월 소득을 초과합니다.'
    });
  }

  const hasRecentDebt = (data.debts || []).some(d => d.isRecent);
  if (hasRecentDebt) {
    conflicts.push({
      fieldA: 'debts.isRecent',
      fieldB: 'delinquencyStatus',
      severity: 'info',
      description: '최근 발생한 채무가 포함되어 있습니다.'
    });
  }

  return conflicts;
}

/**
 * Fact Engine 실행
 * IntakeData를 받아 사실 요약, 누락정보, 불일치를 계산합니다.
 * ★ 법률 판단(가능/불가능/추천/최적)을 생성하지 않습니다.
 */
export function runFactEngine(intakeData: IntakeData, settings?: AppSettings): FactEngineOutput {
  const effectiveSettings = settings || DEFAULT_SETTINGS;
  const rawComputeResponse = calculateRehabPlan(intakeData, effectiveSettings);

  const debts = intakeData.debts || [];
  let securedDebt = 0;
  let unsecuredDebt = 0;
  let taxDebt = 0;
  const recentDebts: { creditor: string; principal: number; isRecent: boolean }[] = [];

  debts.forEach(d => {
    if (d.type === 'secured') securedDebt += d.principal;
    else if (d.type === 'tax') taxDebt += d.principal;
    else unsecuredDebt += d.principal;

    if (d.isRecent) {
      recentDebts.push({ creditor: d.creditor, principal: d.principal, isRecent: d.isRecent });
    }
  });

  const assets = intakeData.assets || [];
  let totalMarketValue = 0;
  let totalLoanBalance = 0;
  let hasRealEstate = false;
  let hasVehicle = false;
  let hasInsurance = false;
  let hasSeverance = false;
  let hasStock = false;
  let spouseAssetCount = 0;

  // 압류금지 바스켓 분류 계산
  let bankDepositTotal = 0;
  let insuranceTotal = 0;
  let housingRentalDeposit = 0;
  let collateralEstimatedValue = 0; // 담보물 예상 환가액 합산 (부동산 70%, 차량 50%)

  assets.forEach(a => {
    totalMarketValue += a.marketValue;
    totalLoanBalance += a.loanBalance;
    if (a.type === 'realestate' || a.type === 'realestate_general') {
      hasRealEstate = true;
      collateralEstimatedValue += Math.round(a.marketValue * 0.7);
    }
    if (a.type === 'vehicle' || a.type === 'business_vehicle') {
      hasVehicle = true;
      collateralEstimatedValue += Math.round(a.marketValue * 0.5);
    }
    if (a.type === 'insurance') {
      hasInsurance = true;
      insuranceTotal += a.marketValue;
    }
    if (a.type === 'severance') hasSeverance = true;
    if (a.type === 'stock') hasStock = true;
    if (a.type === 'savings') {
      bankDepositTotal += a.marketValue;
    }
    if (a.type === 'deposit') {
      housingRentalDeposit += a.marketValue;
    }
    if (a.owner === 'spouse') spouseAssetCount++;
  });

  // 민사집행법 제246조 압류금지 바스켓 공제 계산
  // 1) 예금 185만 원 일괄 공제
  const exemptDepositTotal = Math.min(bankDepositTotal, 1850000);
  // 2) 보장성 보험 해약환급금 150만 원 한도 공제
  const exemptInsuranceTotal = Math.min(insuranceTotal, 1500000);
  // 3) 주거용 소액임차보증금 공제 (rawComputeResponse의 exemptions 참조 또는 서울 기본 5,500만 원 적용)
  let exemptHousingDeposit = 0;
  if (housingRentalDeposit > 0) {
    const deductFound = rawComputeResponse.breakdown?.liquidation?.exemptions?.find(e => e.label === 'deposit');
    exemptHousingDeposit = deductFound ? deductFound.amount : Math.min(housingRentalDeposit, 55000000);
  }
  const totalExemptDeductions = exemptDepositTotal + exemptInsuranceTotal + exemptHousingDeposit;
  const effectiveLiquidationValue = rawComputeResponse.base.liq;

  const netAssetValue = totalMarketValue - totalLoanBalance;
  const assetSummary: AssetSummary = {
    totalMarketValue,
    totalLoanBalance,
    netAssetValue,
    hasRealEstate,
    hasVehicle,
    hasInsurance,
    hasSeverance,
    hasStock,
    spouseAssetCount,
    exemptDepositTotal,
    exemptInsuranceTotal,
    exemptHousingDeposit,
    totalExemptDeductions,
    effectiveLiquidationValue
  };

  // 별제권 담보 충당 및 예정부족액 계산
  const securedDebtCovered = Math.min(securedDebt, collateralEstimatedValue);
  const pledgedAssetsEstimatedDeficit = Math.max(0, securedDebt - collateralEstimatedValue);

  // 특수 채권(사기죄 위험, 양도, 보증, 세금) 레이더 탐지
  const specialDebts: SpecialDebtItem[] = [];
  debts.forEach(d => {
    // 1) 세금/우선권 채권
    if (d.type === 'tax') {
      specialDebts.push({
        creditor: d.creditor,
        principal: d.principal,
        riskType: 'TAX_PRIORITY',
        reason: '국세/지방세/건강보험 등 우선권 회생채권',
        recommendedAction: '전체 변제기간의 절반(18회차 이내)에 전액 우선 변제 스케줄링 필요'
      });
    }
    // 2) 최근 채무 & 사기 피소 리스크 (최근 대출이거나 6개월 내 의심)
    if (d.isRecent) {
      specialDebts.push({
        creditor: d.creditor,
        principal: d.principal,
        riskType: 'FRAUD_RISK',
        reason: '최근 6개월 이내 발생 채무 (이자 납부 미흡 시 사기죄 고소 위험)',
        recommendedAction: '차용 당시 변제 의사 및 실제 생활비/병원비 사용처 소명 영수증 필수 구비'
      });
    }
    // 3) 대부업/채권양도 의심
    const creditorLower = d.creditor.toLowerCase();
    if (creditorLower.includes('대부') || creditorLower.includes('자산관리') || creditorLower.includes('대위') || creditorLower.includes('엔피엘')) {
      specialDebts.push({
        creditor: d.creditor,
        principal: d.principal,
        riskType: 'TRANSFERRED',
        reason: '원채권사에서 대부업 또는 추심사로 매각(양도)된 채권',
        recommendedAction: '원채권자 확인 및 양도통지서, 채무잔액확인서 교차 검증 필요'
      });
    }
  });

  const totalIncome = rawComputeResponse.client.monthlyIncome;
  const totalDebt = rawComputeResponse.base.debtTotal;

  const totalExpense = (intakeData.monthlyLivingCost || 0) + (intakeData.monthlyRent || 0) + (intakeData.monthlyInsurance || 0);

  const missingFields = detectMissingFields(intakeData);
  const conflicts = detectConflicts(intakeData, totalIncome, totalDebt);

  return {
    factSummary: {
      totalDebt,
      securedDebt,
      unsecuredDebt,
      taxDebt,
      monthlyIncome: totalIncome,
      monthlyExpense: totalExpense,
      disposableIncome: rawComputeResponse.base.disposable,
      dependents: rawComputeResponse.client.dependents,
      creditorCount: debts.length,
      assets: assetSummary,
      recentDebts,
      delinquencyStatus: '확인 필요',
      seizureStatus: '확인 필요',
      previousHistory: intakeData.prevHistory?.exists || false,
      delinquencyMonths: 0,
      securedDebtCovered,
      pledgedAssetsEstimatedDeficit,
      specialDebts
    },
    missingFields,
    conflicts,
    rawComputeResponse,
    engineVersion: '2.0.0',
    executedAt: new Date().toISOString()
  };
}
