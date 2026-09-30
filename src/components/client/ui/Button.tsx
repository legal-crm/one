import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * 고객 사이트 공통 버튼
 * - 높이: sm 40px(데스크톱 보조), md 44px(기본·모바일 터치 기준), lg 48px(주요 CTA)
 * - 한 줄 고정(whitespace-nowrap), 눌림 피드백, 포커스 링, 로딩 상태 포함
 */
export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger' | 'inverse' | 'outlineInverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
  subtle: 'bg-brand-light text-brand hover:bg-brand/10',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  // 어두운(네이비) 배경 위에서 쓰는 버튼
  inverse: 'bg-white text-brand hover:bg-slate-100 shadow-sm',
  outlineInverse: 'bg-transparent text-white border border-white/40 hover:bg-white/10',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3.5 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
  lg: 'min-h-12 px-6 text-base gap-2',
};

export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer select-none',
    'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, leftIcon, rightIcon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, size, cn(fullWidth && 'w-full', className))}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
