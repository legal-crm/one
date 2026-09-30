import React from 'react';
import { CONSULT_STAGE_DOT_CLASS, getConsultStatusMeta } from '../../../constants/consultStatus';

/** 상담 단계 칩: 흰 칩 + 단계색 점 (색이 넓게 칠해지지 않도록) */
export function ConsultStatusChip({ status, className = '' }: { status?: string; className?: string }) {
  const meta = getConsultStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 whitespace-nowrap ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${CONSULT_STAGE_DOT_CLASS[meta.group]}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

const AVATAR_TONES = [
  'bg-[#DCE7F3] text-brand',
  'bg-sky-100 text-sky-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-slate-200 text-slate-700',
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** 가명 첫 글자 아바타 — 같은 가명은 같은 색 */
export function ChatAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = (name || '?').trim().charAt(0) || '?';
  const dims = size === 'sm' ? 'w-8 h-8 text-[13px]' : 'w-9 h-9 text-sm';
  return (
    <span
      className={`${dims} rounded-full flex items-center justify-center font-bold shrink-0 ${toneFor(name || '')}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

/** 아이콘 버튼 (aria-label 필수) */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active = false, className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-xl border transition-colors press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
        active
          ? 'bg-brand-light border-brand/20 text-brand'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
