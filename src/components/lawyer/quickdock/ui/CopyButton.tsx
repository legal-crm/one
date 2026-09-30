import React from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  copied: boolean;
  onClick: () => void;
  label: string;
  copiedLabel?: string;
  disabled?: boolean;
  /** dark: 기본 검정 버튼, light: 보조 버튼 */
  variant?: 'dark' | 'light';
}

/** 퀵독 공용 '복사' 버튼 (복사 성공 시 2초간 체크 표시) */
export default function CopyButton({
  copied,
  onClick,
  label,
  copiedLabel = '복사되었습니다',
  disabled = false,
  variant = 'dark',
}: CopyButtonProps) {
  const base =
    'w-full min-h-[40px] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
  const tone =
    variant === 'dark'
      ? 'bg-slate-900 hover:bg-slate-800 text-white'
      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      {copied ? (
        <Check className={`w-3.5 h-3.5 ${variant === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} aria-hidden="true" />
      ) : (
        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
