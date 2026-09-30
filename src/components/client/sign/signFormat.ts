import type { FeeInstallment } from '../../../types';
import { parseLocalYmd } from '../../../utils/localDate';
import { feeAmountWon, feeTotalWon } from '../../../utils/feeUnits';

/**
 * 원격 전자서명 화면 표시용 금액·날짜 도우미
 * - 금액 단위(원/만원 자동 감지)는 utils/feeUnits.ts 규칙을 그대로 쓴다(계약서 PDF·알림톡과 같은 규칙)
 */
export function contractFeeWon(total: number | undefined | null): number {
  return feeTotalWon(total);
}

/** 분납 회차 금액(원) */
export function installmentWon(inst: Pick<FeeInstallment, 'amount' | 'amountUnit'>): number {
  return feeAmountWon(inst);
}

export function formatWon(won: number): string {
  return `${Math.round(Number(won) || 0).toLocaleString('ko-KR')}원`;
}

/** 'YYYY-MM-DD'(또는 ISO) → 2026년 10월 1일 */
export function formatDateKo(value?: string | null): string {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalYmd(value) : new Date(value);
  if (!d || Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** ISO 시각 → 2026년 9월 30일 오후 3:05 */
export function formatDateTimeKo(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
