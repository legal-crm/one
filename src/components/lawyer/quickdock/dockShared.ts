// ============================================================
// 퀵독 도구 간 공유 입력값 (상담 1건 단위 및 사건 워크스페이스 연동)
// - 중위소득 → 추가생계비 → 변제율 → 청산가치 순으로 같은 숫자를 도구마다 다시 입력하던 문제를 없앤다.
// - 금액·인원수만 담고 성명·연락처·생년월일은 담지 않는다.
// - 사건 워크스페이스에서 열면 사건 데이터(채무·소득·가구원·재산)를 자동 프리필하고, 사건 전환 시 초기화한다.
// - 메모리 전용: 새로고침·탭 닫기·로그아웃(clearDockSensitiveData) 시 사라진다.
// ============================================================

import { useSyncExternalStore } from 'react';
import type { RegionType } from '../../../services/repayment/repaymentConstants2026';
import { toast } from 'sonner';

/** 청산가치 점검기 입력 (원 단위, 공제 전 금액) */
export interface LiquidationInputs {
  /** 주택·아파트 순가액 (시세 − 근저당 − 임차인 보증금) */
  housing: number;
  /** 토지·임야 순가액 */
  land: number;
  /** 차량 순가액 (시세 − 저당) */
  vehicle: number;
  /** 본인이 임차인인 주거용 임차보증금 */
  leaseDeposit: number;
  /** 임차보증금 담보 대출(전세대출 등) */
  leaseLoan: number;
  /** 예금·적금 잔액 합계 */
  deposits: number;
  /** 보장성보험 해약환급금 합계 */
  insurance: number;
  /** 퇴직금 예상액 (전액 입력, 엔진이 1/2 공제) */
  severance: number;
  /** 퇴직연금(DB·DC·IRP) 가입 → 청산가치 0원 */
  isPension: boolean;
  /** 배우자 명의 순재산 */
  spouseNet: number;
  /** 배우자 재산 반영 비율 (0 또는 0.5) */
  spouseRatio: number;
  /** 기타 재산 (공제 없음) */
  other: number;
  /** 청산가치 가산액 (편파변제·투자손실금 등, 관할 법원 기준에 따라) */
  additional: number;
}

export interface DockCaseContext {
  caseId: string;
  clientName: string;
  phone?: string;
  caseNumber?: string;
  courtName?: string;
  tenantId?: string;
  actorId?: string;
  actorName?: string;
  caseType?: string;
}

export interface DockApplyData {
  monthlyPay?: number;
  periodMonths?: number;
  totalDebt?: number;
  liquidationValue?: number;
  repaymentRate?: number;
  forgivenessRate?: number;
  sourceTool?: string;
  summaryText?: string;
}

export interface DockCaseActionHandlers {
  onApplyToCase?: (data: DockApplyData) => Promise<boolean | void> | boolean | void;
  onAddTaskTicket?: (task: { title: string; description: string; dueDate?: string; priority?: string }) => Promise<boolean | void> | boolean | void;
  onAddMemo?: (text: string, category?: string) => Promise<boolean | void> | boolean | void;
  onOpenAlimtok?: (caseId: string) => void;
}

export interface DockSharedState {
  /** 현재 연결된 사건 컨텍스트 (없으면 null) */
  caseContext: DockCaseContext | null;
  /** 가구원 수 (본인 포함, 0.5 단위) */
  householdSize: number;
  /** 월 실수령 소득 */
  monthlyIncome: number;
  /** 추가생계비 인정 예상액 합계 */
  extraLivingCost: number;
  /** 총 채무 원금 */
  totalDebt: number;
  /** 월 변제금 */
  monthlyPay: number;
  /** 변제기간 (개월) */
  periodMonths: number;
  /** 채권자 수 (0 = 미입력) */
  creditorCount: number;
  /** 거주 지역 (주거비 한도·소액임차보증금) */
  region: RegionType;
  liquidation: LiquidationInputs;
  /** 채권자 송달주소록에서 담은 채권자 ID */
  creditorBasket: string[];
}

export const EMPTY_LIQUIDATION: LiquidationInputs = {
  housing: 0,
  land: 0,
  vehicle: 0,
  leaseDeposit: 0,
  leaseLoan: 0,
  deposits: 0,
  insurance: 0,
  severance: 0,
  isPension: false,
  spouseNet: 0,
  spouseRatio: 0.5,
  other: 0,
  additional: 0,
};

const INITIAL_STATE: DockSharedState = {
  caseContext: null,
  householdSize: 1,
  monthlyIncome: 0,
  extraLivingCost: 0,
  totalDebt: 0,
  monthlyPay: 0,
  periodMonths: 36,
  creditorCount: 0,
  region: 'SEOUL',
  liquidation: EMPTY_LIQUIDATION,
  creditorBasket: [],
};

let state: DockSharedState = INITIAL_STATE;
const listeners = new Set<() => void>();
let globalActionHandlers: DockCaseActionHandlers | null = null;

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function getDockShared(): DockSharedState {
  return state;
}

export function setDockShared(patch: Partial<DockSharedState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setDockLiquidation(patch: Partial<LiquidationInputs>): void {
  state = { ...state, liquidation: { ...state.liquidation, ...patch } };
  emit();
}

/** 지역 문자열을 RegionType으로 안전하게 변환 */
export function parseRegion(raw?: string): RegionType {
  if (!raw) return 'SEOUL';
  const str = raw.toLowerCase();
  if (str.includes('서울')) return 'SEOUL';
  if (
    str.includes('과밀') ||
    str.includes('인천') ||
    str.includes('수원') ||
    str.includes('성남') ||
    str.includes('안양') ||
    str.includes('부천') ||
    str.includes('고양') ||
    str.includes('용인') ||
    str.includes('화성')
  ) {
    return 'OVERCROWDED';
  }
  if (
    str.includes('부산') ||
    str.includes('대구') ||
    str.includes('광주') ||
    str.includes('대전') ||
    str.includes('울산') ||
    str.includes('세종')
  ) {
    return 'METROPOLITAN';
  }
  if (str === 'overcrowded') return 'OVERCROWDED';
  if (str === 'metropolitan') return 'METROPOLITAN';
  if (str === 'others') return 'OTHERS';
  return 'OTHERS';
}

/** 새 상담 시작·로그아웃 시 모든 공유값 초기화 */
export function resetDockShared(): void {
  state = INITIAL_STATE;
  emit();
}

/** 사건 워크스페이스 진입 시 활성 사건 데이터로 퀵독 자동 프리필 */
export function syncDockFromCase(
  caseContext: DockCaseContext,
  fp?: {
    income?: number;
    debtTotal?: number;
    assetsTotal?: number;
    dependents?: number;
    residenceRegion?: string;
    selectedCourt?: string;
    rentalDeposit?: number;
    depositLoan?: number;
    spouseAsset?: number;
    retirementPay?: number;
    retirementPensionType?: string;
    myAssets?: number;
    speculativeLoss?: number;
    gamblingLoss?: number;
    creditorCount?: number;
  } | null,
  crmExt?: {
    repaymentPlan?: {
      monthlyRepayment?: number;
      repaymentMonths?: number;
      totalDebt?: number;
    };
    courtCase?: {
      courtName?: string;
      caseNumber?: string;
    };
  } | null,
  force = false,
): void {
  const isDifferentCase = state.caseContext?.caseId !== caseContext.caseId;
  if (!isDifferentCase && !force) return;

  const debtWon = (fp?.debtTotal || 0) * 10000;
  const incomeWon = (fp?.income || 0) * 10000;
  const dependents = typeof fp?.dependents === 'number' ? fp.dependents : 0;
  const householdSize = Math.max(1, dependents + 1);
  const creditorCount = fp?.creditorCount || 0;
  const region = parseRegion(fp?.residenceRegion || fp?.selectedCourt || crmExt?.courtCase?.courtName);

  const liquidation: LiquidationInputs = {
    ...EMPTY_LIQUIDATION,
    leaseDeposit: (fp?.rentalDeposit || 0) * 10000,
    leaseLoan: (fp?.depositLoan || 0) * 10000,
    spouseNet: (fp?.spouseAsset || 0) * 10000,
    severance: (fp?.retirementPay || 0) * 10000,
    isPension: fp?.retirementPensionType === 'pension',
    other: (fp?.myAssets || fp?.assetsTotal || 0) * 10000,
    additional: ((fp?.speculativeLoss || 0) + (fp?.gamblingLoss || 0)) * 10000,
  };

  const monthlyPay = crmExt?.repaymentPlan?.monthlyRepayment || 0;
  const periodMonths = crmExt?.repaymentPlan?.repaymentMonths || 36;

  state = {
    ...state,
    caseContext,
    totalDebt: debtWon || crmExt?.repaymentPlan?.totalDebt || 0,
    monthlyIncome: incomeWon,
    householdSize,
    creditorCount,
    region,
    liquidation,
    monthlyPay: monthlyPay || 0,
    periodMonths: periodMonths || 36,
  };
  emit();
}

/** 사건 워크스페이스 퇴장 시 사건 연결 해제 및 공유값 초기화 */
export function clearDockCaseContext(): void {
  if (state.caseContext) {
    resetDockShared();
  }
}

/** 액션 핸들러 등록 (사건에 반영 / 할 일 등록 / 메모 추가 / 알림톡) */
export function registerDockCaseHandlers(handlers: DockCaseActionHandlers | null): () => void {
  globalActionHandlers = handlers;
  return () => {
    if (globalActionHandlers === handlers) {
      globalActionHandlers = null;
    }
  };
}

export function getDockCaseHandlers(): DockCaseActionHandlers | null {
  return globalActionHandlers;
}

/** 공유값 구독 (값이 바뀌면 다시 렌더) */
export function useDockShared(): DockSharedState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 퀵툴 결과 사건 반영 헬퍼 */
export async function applyDockToActiveCase(data: DockApplyData): Promise<boolean> {
  if (!state.caseContext) {
    toast.error('현재 연결된 사건이 없습니다.');
    return false;
  }
  if (!globalActionHandlers?.onApplyToCase) {
    toast.error('사건 반영 핸들러가 연결되어 있지 않습니다.');
    return false;
  }
  try {
    const res = await globalActionHandlers.onApplyToCase(data);
    if (res !== false) {
      toast.success(`${state.caseContext.clientName} 사건에 계산 결과가 반영되었습니다.`);
      return true;
    }
    return false;
  } catch (err: any) {
    toast.error(err?.message || '사건 반영 중 오류가 발생했습니다.');
    return false;
  }
}

/** 퀵툴 결과 할 일 등록 헬퍼 */
export async function addDockTaskTicket(task: {
  title: string;
  description: string;
  dueDate?: string;
  priority?: string;
}): Promise<boolean> {
  if (!state.caseContext) {
    toast.error('현재 연결된 사건이 없습니다.');
    return false;
  }
  if (!globalActionHandlers?.onAddTaskTicket) {
    toast.error('할 일 등록 핸들러가 연결되어 있지 않습니다.');
    return false;
  }
  try {
    const res = await globalActionHandlers.onAddTaskTicket(task);
    if (res !== false) {
      toast.success(`${state.caseContext.clientName} 사건의 할 일에 등록되었습니다.`);
      return true;
    }
    return false;
  } catch (err: any) {
    toast.error(err?.message || '할 일 등록 중 오류가 발생했습니다.');
    return false;
  }
}

/** 퀵툴 결과 메모 추가 헬퍼 */
export async function addDockMemo(text: string, category = 'general'): Promise<boolean> {
  if (!state.caseContext) {
    toast.error('현재 연결된 사건이 없습니다.');
    return false;
  }
  if (!globalActionHandlers?.onAddMemo) {
    toast.error('메모 등록 핸들러가 연결되어 있지 않습니다.');
    return false;
  }
  try {
    const res = await globalActionHandlers.onAddMemo(text, category);
    if (res !== false) {
      toast.success(`${state.caseContext.clientName} 사건의 상담 메모에 추가되었습니다.`);
      return true;
    }
    return false;
  } catch (err: any) {
    toast.error(err?.message || '메모 추가 중 오류가 발생했습니다.');
    return false;
  }
}

