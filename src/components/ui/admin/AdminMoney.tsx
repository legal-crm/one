import React from 'react';

export interface AdminMoneyProps {
  /** 금액 (원 단위) */
  amount: number | null | undefined;
  /** 단위 (기본값: '원') */
  unit?: 'won' | 'manwon';
  /** 우측 정렬 여부 (기본값: true) */
  alignRight?: boolean;
  /** 빈 값일 때 대체 텍스트 (기본값: '-') */
  fallback?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 어드민 금액 포맷팅 헬퍼
 */
export function formatAdminMoney(
  amount: number | null | undefined,
  unit: 'won' | 'manwon' = 'won',
  fallback: string = '-'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallback;
  }

  if (unit === 'manwon') {
    const manwon = Math.floor(amount / 10000);
    return `${manwon.toLocaleString('ko-KR')}만 원`;
  }

  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * 어드민 금액 표기 컴포넌트 (기획서 5.2 & 5.4)
 * - tabular-nums 적용
 * - 일관된 통화 기호 및 단위 표기
 */
export function AdminMoney({
  amount,
  unit = 'won',
  alignRight = false,
  fallback = '-',
  className = '',
}: AdminMoneyProps) {
  const formatted = formatAdminMoney(amount, unit, fallback);

  return (
    <span
      className={`tabular-nums font-medium ${
        alignRight ? 'text-right' : ''
      } ${className}`}
    >
      {formatted}
    </span>
  );
}
