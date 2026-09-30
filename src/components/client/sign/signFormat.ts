import type { FeeInstallment } from '../../../types';
import { parseLocalYmd } from '../../../utils/localDate';

/**
 * 원격 전자서명 화면 표시용 금액·날짜 도우미
 * - 계약서 totalFee는 만원 단위로 저장된다(ContractWizard·PDF와 같은 해석). 과거·외부 데이터가 원 단위로 들어온 경우를
 *   대비해 10,000 이상이면 원 단위로 본다(alimtokService.feeTotalWon과 같은 규칙, 무거운 서비스 모듈을 끌어오지 않기 위해 복제).
 */
export function contractFeeWon(total: number | undefined | null): number {
  const t = Number(total) || 0;
  return t > 0 && t < 10000 ? t * 10000 : t;
}

/** 분납 회차 금액(원). alimtokService.feeAmountWon과 같은 규칙 */
export function installmentWon(inst: Pick<FeeInstallment, 'amount' | 'amountUnit'>): number {
  const a = Number(inst.amount) || 0;
  if (inst.amountUnit === 'won') return a;
  if (inst.amountUnit === 'manwon') return a * 10000;
  return a >= 10000 ? a : a * 10000;
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
