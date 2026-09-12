/**
 * 숨은 채무·체납·계좌 전수조회 통합 서비스
 * 한국신용정보원(크레딧포유), 금융결제원(어카운트인포), 국세청/위택스(조세공과금), 대법원 나의사건검색 연동
 */

import { matchCreditorPreset, searchCreditorAddress } from './creditorAddressDirectory';
import type { 
  RepaymentCreditor, 
  DebtCertificateItem, 
  RepaymentAsset 
} from '../repayment/repaymentTypes';

export type AuthProviderType = 'kakao' | 'pass' | 'toss';

export interface CreditDebtItem {
  id: string;
  creditorName: string;
  debtType: string;
  accountNo: string;
  openedDate: string;
  originalAmount: number;
  currentBalance: number;
  pastDueDays: number;
  branchName: string;
  isSecured: boolean;
  securedCollateral?: string;
  status: string;
}

export interface TaxArrearItem {
  id: string;
  agencyName: string;
  taxType: string;
  taxYear: string;
  arrearAmount: number;
  originalTaxAmount: number;
  dueDate: string;
  isPriority: boolean;
  priorityClass: string;
  hasSeizure: boolean;
  seizureDetail?: string;
}

export interface BankAccountItem {
  id: string;
  bankName: string;
  accountNo: string;
  accountType: string;
  balance: number;
  isDormant: boolean;
  openedDate: string;
  lastTransDate: string;
}

export interface CourtLawsuitItem {
  id: string;
  caseNumber: string;
  courtName: string;
  caseType: string;
  plaintiff: string;
  claimAmount: number;
  status: string;
  filingDate: string;
  hint: string;
}

export interface DebtDiscoverySummary {
  totalCreditDebtAmount: number;
  totalCreditDebtCount: number;
  totalTaxArrearAmount: number;
  totalTaxArrearCount: number;
  totalDepositBalance: number;
  exemptDepositLimit: number;
  excessDepositLiquidation: number;
  totalCourtCaseCount: number;
}

export interface DebtDiscoveryResult {
  queriedAt: string;
  clientName: string;
  phone: string;
  authProvider: AuthProviderType;
  creditDebts: CreditDebtItem[];
  taxArrears: TaxArrearItem[];
  bankAccounts: BankAccountItem[];
  courtCases: CourtLawsuitItem[];
  summary: DebtDiscoverySummary;
  isLiveB2B?: boolean;
}

const CACHE_STORAGE_KEY = 'debt_discovery_cache_';

/**
 * 간편인증 요청 발송
 */
export async function requestSimpleAuth(params: {
  clientName: string;
  phone: string;
  authProvider: AuthProviderType;
}): Promise<{ ok: boolean; sessionId: string; message: string }> {
  const res = await fetch('/api/debt-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: params.clientName,
      clientPhone: params.phone,
      authProvider: params.authProvider,
      step: 'request_auth'
    })
  });

  if (!res.ok) {
    throw new Error(`간편인증 요청 실패 (HTTP ${res.status})`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || '간편인증 요청 처리에 실패했습니다.');
  }

  return json;
}

/**
 * 간편인증 확인 및 4대 기관 통합 스크래핑 결과 가져오기
 */
export async function fetchDebtDiscoveryResults(params: {
  clientName: string;
  phone: string;
  authProvider: AuthProviderType;
  sessionId: string;
}): Promise<DebtDiscoveryResult> {
  const res = await fetch('/api/debt-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: params.clientName,
      clientPhone: params.phone,
      authProvider: params.authProvider,
      step: 'check_auth_and_fetch',
      twoWaySessionId: params.sessionId
    })
  });

  if (!res.ok) {
    throw new Error(`전수조회 스크래핑 실패 (HTTP ${res.status})`);
  }

  const json = await res.json();
  if (!json.ok || !json.data) {
    throw new Error(json.error || '조회 결과를 불러오지 못했습니다.');
  }

  const result: DebtDiscoveryResult = {
    ...json.data,
    isLiveB2B: json.isLiveB2B
  };

  // 클라이언트 캐싱
  try {
    localStorage.setItem(`${CACHE_STORAGE_KEY}${params.clientName}`, JSON.stringify(result));
  } catch {}

  return result;
}

export function getCachedDebtDiscovery(clientName: string): DebtDiscoveryResult | null {
  try {
    const raw = localStorage.getItem(`${CACHE_STORAGE_KEY}${clientName}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 발굴된 금융 채무 및 조세 체납을 변제계획안 채권자 목록(RepaymentCreditor[])으로 변환
 * (50+ 금융기관 공식 주소 자동 완성 및 우선권 채권 자동 세팅)
 */
export function convertDiscoveryToRepaymentCreditors(
  selectedDebts: CreditDebtItem[],
  selectedTaxes: TaxArrearItem[],
  startIndex: number = 1
): RepaymentCreditor[] {
  let seq = startIndex;
  const result: RepaymentCreditor[] = [];

  // 1. 우선권 채권 (조세 및 공과금 체납) 우선 편성 (법 제415조)
  selectedTaxes.forEach((tax) => {
    const addressPreset = matchCreditorPreset(tax.agencyName);
    result.push({
      id: `cred_tax_${tax.id}_${Date.now()}`,
      creditorNumber: seq++,
      name: tax.agencyName,
      principal: tax.arrearAmount,
      interest: 0,
      isSecured: false,
      isUnconfirmed: false,
      isPriority: true, // ⭐ 일반 우선권 채권
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 100,
      debtCauseDetail: `${tax.taxType} 체납액 (${tax.taxYear})`,
      borrowedDate: tax.dueDate,
      zipCode: addressPreset?.zipCode || '07331',
      address: addressPreset?.address || '서울특별시 영등포구 선유동1로 38 (세무서)',
      serviceAddress: addressPreset?.serviceAddress || '영등포세무서 징세계 (체납관리팀)',
      representative: addressPreset?.representative || '영등포세무서장',
      bizNumber: addressPreset?.bizNumber || '107-83-00000',
    });
  });

  // 2. 일반 금융채무 (신용대출, 카드, 캐피탈, 대부업)
  selectedDebts.forEach((debt) => {
    const addressPreset = matchCreditorPreset(debt.creditorName);
    result.push({
      id: `cred_debt_${debt.id}_${Date.now()}`,
      creditorNumber: seq++,
      name: debt.creditorName,
      principal: debt.currentBalance || debt.originalAmount,
      interest: 0,
      isSecured: debt.isSecured,
      securedValue: debt.isSecured ? Math.round(debt.currentBalance * 0.7) : undefined,
      isUnconfirmed: false,
      isPriority: false,
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
      debtCauseDetail: `${debt.debtType} (계좌: ${debt.accountNo})`,
      borrowedDate: debt.openedDate,
      zipCode: addressPreset?.zipCode,
      address: addressPreset?.address,
      serviceAddress: addressPreset?.serviceAddress,
      representative: addressPreset?.representative,
      bizNumber: addressPreset?.bizNumber,
    });
  });

  return result;
}

/**
 * 발굴된 금융 채무를 부채증명서 발급 대행 항목(DebtCertificateItem[])으로 변환
 */
export function convertDiscoveryToDebtItems(
  selectedDebts: CreditDebtItem[]
): DebtCertificateItem[] {
  return selectedDebts.map((debt, idx) => {
    const addressPreset = matchCreditorPreset(debt.creditorName);
    return {
      id: `discovered_item_${debt.id}_${Date.now()}_${idx}`,
      creditorName: debt.creditorName,
      accountOrContractNo: debt.accountNo,
      branchName: debt.branchName,
      expectedPrincipal: debt.currentBalance || debt.originalAmount,
      expectedInterest: 0,
      issueStatus: 'pending',
      agencyFee: 15000,
      issuanceFee: 2000,
      zipCode: addressPreset?.zipCode,
      address: addressPreset?.address,
      serviceAddress: addressPreset?.serviceAddress,
      representative: addressPreset?.representative,
      bizNumber: addressPreset?.bizNumber,
      debtCauseDetail: `${debt.debtType} (${debt.accountNo})`,
      borrowedDate: debt.openedDate,
    };
  });
}

/**
 * 발굴된 계좌 잔액 합산액을 변제계획안 청산가치 예금 자산(RepaymentAsset)으로 변환
 * (법정 압류금지 최저한도 185만 원 자동 공제)
 */
export function convertDiscoveryToDepositAsset(
  bankAccounts: BankAccountItem[]
): RepaymentAsset {
  const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const STATUTORY_EXEMPT_DEPOSIT = 1850000; // 민사집행법 및 채무자회생법상 압류금지 예금
  const liquidation = Math.max(0, totalBalance - STATUTORY_EXEMPT_DEPOSIT);

  const bankSummaryNames = bankAccounts
    .filter(a => a.balance > 0)
    .map(a => `${a.bankName} ${(a.balance / 10000).toFixed(0)}만`)
    .join(', ');

  return {
    id: `asset_deposit_discovered_${Date.now()}`,
    category: 'DEPOSIT',
    name: `전 금융기관 예금 잔액 (${bankAccounts.length}개 계좌 합산)`,
    marketValue: totalBalance,
    encumbrance: 0,
    statutoryDeduction: STATUTORY_EXEMPT_DEPOSIT,
    liquidationValue: liquidation,
    note: `어카운트인포 실시간 조회 합산: ${bankSummaryNames} (법정공제 185만 원 적용)`
  };
}
