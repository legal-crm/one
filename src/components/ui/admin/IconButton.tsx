import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 스크린리더 및 툴팁용 필수 라벨 */
  label: string;
  /** 활성 상태 */
  active?: boolean;
  /** 버튼 스타일 변형 */
  variant?: 'default' | 'ghost' | 'subtle' | 'danger';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 어드민 표준 아이콘 버튼 (기획서 5.4 & Rule 2)
 * - 44px 모바일/터치 접근성 타깃 보장
 * - 필수 aria-label 및 focus-visible 링
 * - 물리적 눌림 피드백 (press-scale)
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active = false, variant = 'default', size = 'md', className = '', children, disabled, ...rest },
  ref
) {
  const sizeCls =
    size === 'sm'
      ? 'w-7 h-7 min-w-[28px] min-h-[28px] text-xs pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg'
      : size === 'lg'
      ? 'w-10 h-10 min-w-[40px] min-h-[40px] text-base pointer-coarse:w-11 pointer-coarse:h-11 rounded-xl'
      : 'w-8 h-8 min-w-[32px] min-h-[32px] text-sm pointer-coarse:w-11 pointer-coarse:h-11 rounded-xl';

  let variantCls = 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs';

  if (active) {
    variantCls = 'bg-[#1E3A5F]/10 border border-[#1E3A5F]/30 text-[#1E3A5F] font-bold';
  } else if (variant === 'ghost') {
    variantCls = 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900';
  } else if (variant === 'subtle') {
    variantCls = 'bg-slate-100 border border-slate-200/80 text-slate-700 hover:bg-slate-200 hover:text-slate-900';
  } else if (variant === 'danger') {
    variantCls = 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300';
  }

  const disabledCls = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer press-scale';

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40 ${sizeCls} ${variantCls} ${disabledCls} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
