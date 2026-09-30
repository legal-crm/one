// ============================================================
// 퀵독 도구 간 공유 입력값 (상담 1건 단위)
// - 중위소득 → 추가생계비 → 변제율 → 청산가치 순으로 같은 숫자를 도구마다 다시 입력하던 문제를 없앤다.
// - 금액·인원수만 담고 성명·연락처·생년월일은 담지 않는다.
// - 메모리 전용: 새로고침·탭 닫기·로그아웃(clearDockSensitiveData) 시 사라진다.
// ============================================================

import { useSyncExternalStore } from 'react';
import type { RegionType } from '../../../services/repayment/repaymentConstants2026';

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

export interface DockSharedState {
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

/** 새 상담 시작·로그아웃 시 모든 공유값 초기화 */
export function resetDockShared(): void {
  state = INITIAL_STATE;
  emit();
}

/** 공유값 구독 (값이 바뀌면 다시 렌더) */
export function useDockShared(): DockSharedState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
