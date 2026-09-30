import React, { useId } from 'react';
import { cn } from '../../../utils/cn';

/* ─────────────────────────────────────────────
   FormField · inputClass · MoneyInput · formatKoreanWon
   - 입력 글자 16px(iOS 확대 방지), 높이 44px 이상
   - 라벨-입력 연결(htmlFor), 필수/선택 표시, 필드 아래 인라인 오류(aria-describedby)
   ───────────────────────────────────────────── */

export const inputClass =
  'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand disabled:bg-slate-100 disabled:text-slate-500 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20';

export const textareaClass = inputClass.replace('min-h-11', 'min-h-28') + ' py-3 leading-relaxed resize-y';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function FormField({
  label,
  required,
  optional,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: (props: FieldControlProps) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-800">
        {label}
        {required && (
          <>
            <span className="text-red-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(필수)</span>
          </>
        )}
        {optional && <span className="text-xs font-medium text-slate-500">(선택)</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-slate-600 leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** 원 단위 금액을 읽기 쉬운 한글 표기로 (예: 12,345,000 → 1,234만 5,000원) */
export function formatKoreanWon(won: number): string {
  const n = Math.round(Math.abs(Number(won) || 0));
  if (n === 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const rest = n % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) parts.push(rest.toLocaleString('ko-KR'));
  return `${won < 0 ? '-' : ''}${parts.join(' ')}원`;
}

/**
 * 금액 입력
 * - 숫자 키패드(inputMode=numeric), 천 단위 콤마, 단위(원/만원) 고정 표시, 빈 값 허용
 * - 아래에 한글 금액을 함께 보여줘 자릿수 착오를 줄인다
 */
export function MoneyInput({
  value,
  onChange,
  unit = 'won',
  max,
  showKoreanHint = true,
  className,
  placeholder = '0',
  ...rest
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  unit?: 'won' | 'manwon';
  max?: number;
  showKoreanHint?: boolean;
  className?: string;
  placeholder?: string;
} & Partial<FieldControlProps> &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'max'>) {
  const display = value === null || value === undefined || Number.isNaN(value) ? '' : Number(value).toLocaleString('ko-KR');
  const won = value === null || value === undefined ? null : unit === 'manwon' ? Number(value) * 10_000 : Number(value);
  return (
    <div>
      <div className="relative">
        <input
          {...rest}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            if (digits === '') {
              onChange(null);
              return;
            }
            const n = Number(digits);
            onChange(typeof max === 'number' ? Math.min(n, max) : n);
          }}
          className={cn(inputClass, 'pr-14 text-right tabular-nums font-bold', className)}
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none" aria-hidden="true">
          {unit === 'manwon' ? '만원' : '원'}
        </span>
      </div>
      {showKoreanHint && won !== null && won > 0 && <p className="mt-1 text-xs text-slate-600 tabular-nums text-right">{formatKoreanWon(won)}</p>}
    </div>
  );
}
