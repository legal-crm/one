import type { FeeInstallment } from '../types';

/**
 * 수임료 금액 단위 해석 (원 / 만원 자동 감지)
 * - 계약서 totalFee는 ContractWizard에서 만원 단위(예: 300 = 300만 원)로 저장되지만,
 *   CRM 동기화·외부 입력으로 원 단위(예: 3,300,000)가 들어오는 경우가 있다.
 * - 규칙: 0보다 크고 10,000 미만이면 만원 단위로 보고 ×10,000, 10,000 이상이면 이미 원 단위로 본다.
 *   (1만 원 미만의 수임료나 1억 원 이상을 '만원' 숫자 10,000 이상으로 적는 경우는 없다고 본다)
 * - alimtokService·원격 서명 화면·계약서 PDF가 같은 규칙을 쓰도록 이 파일 하나로 모았다.
 */
export const MANWON = 10_000;

/** 총 수임료를 원 단위로 반환 */
export function feeTotalWon(total: number | string | undefined | null): number {
  const t = Number(total) || 0;
  return t > 0 && t < MANWON ? t * MANWON : t;
}

/**
 * 분납 회차 금액을 원 단위로 반환
 * - amountUnit이 있으면 그대로 따른다(신규 저장분은 'won')
 * - 없으면 과거 데이터 호환: 10,000 미만이면 만원 단위로 저장된 것으로 본다
 */
export function feeAmountWon(inst: Pick<FeeInstallment, 'amount'> & { amountUnit?: 'won' | 'manwon' }): number {
  const a = Number(inst.amount) || 0;
  if (inst.amountUnit === 'won') return a;
  if (inst.amountUnit === 'manwon') return a * MANWON;
  return a >= MANWON ? a : a * MANWON;
}
