import React, { useEffect, useId, useState } from 'react';
import { formatWonKorean, parseKoreanMoney } from './money';

interface MoneyInputProps {
  id?: string;
  /** 원 단위 값 */
  value: number;
  onChange: (won: number) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** 입력 아래 '= 1억 2,000만 원' 안내 표시 (기본 true) */
  showHint?: boolean;
  max?: number;
  className?: string;
}

/**
 * 금액 입력칸
 * - 쉼표 표시, '350만'·'1억2천만' 같은 한글 단위 입력 지원
 * - 해석할 수 없는 값은 이전 값을 유지하고 입력칸 아래에 안내 (Rule 1: 인라인 오류)
 */
export default function MoneyInput({
  id,
  value,
  onChange,
  placeholder = '예: 350만, 1억2천만',
  ariaLabel,
  showHint = true,
  max = 100_000_000_000,
  className = '',
}: MoneyInputProps) {
  const [text, setText] = useState(() => (value > 0 ? value.toLocaleString('ko-KR') : ''));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();

  // 입력 중이 아닐 때는 외부 값(다른 도구에서 바뀐 공유값 포함)을 그대로 표시
  useEffect(() => {
    if (!focused) {
      setText(value > 0 ? value.toLocaleString('ko-KR') : '');
      setInvalid(false);
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseKoreanMoney(raw);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(Math.min(max, Math.max(0, parsed)));
  };

  const hint = invalid
    ? '숫자 또는 350만·1억2천만 형식으로 입력하세요'
    : value > 0
    ? `= ${formatWonKorean(value)}`
    : '';

  return (
    <div className="min-w-0">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={showHint && hint ? hintId : undefined}
        className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs font-bold text-slate-900 tabular-nums placeholder:text-slate-500 placeholder:font-medium focus:outline-none focus:ring-2 ${
          invalid ? 'border-rose-400 focus:ring-rose-500/40' : 'border-slate-300 focus:ring-blue-500/40'
        } ${className}`}
      />
      {showHint && hint && (
        <p
          id={hintId}
          className={`text-xs mt-0.5 leading-tight tabular-nums ${invalid ? 'text-rose-700 font-bold' : 'text-slate-500'}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
