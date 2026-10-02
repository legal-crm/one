import React from 'react';
import { getConsultStatusMeta, CONSULT_STAGE_DOT_CLASS } from '../../../constants/consultStatus';

export type StatusTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusChipProps {
  /** 직접 라벨을 지정할 때 */
  label?: string;
  /** ConsultStatus 또는 CRM 상태값 자동 매핑 */
  status?: string | null;
  /** 톤 (기본값: neutral) */
  tone?: StatusTone;
  /** 추가 클래스 */
  className?: string;
  /** 크기 (기본값: md) */
  size?: 'sm' | 'md';
}

const TONE_DOT_CLASSES: Record<StatusTone, string> = {
  brand: 'bg-[#1E3A5F]',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  info: 'bg-blue-600',
  neutral: 'bg-slate-400',
};

/**
 * 어드민 표준 상태 칩 (기획서 5.3 & taste-skill Rule 5)
 * - 흰 배경 + 미세 테두리 + 상태색 점 + 한국어 라벨
 * - 10색 무지개 배경 배지를 대체하여 조용한 업무 도구 톤 유지
 */
export function StatusChip({
  label,
  status,
  tone,
  className = '',
  size = 'md',
}: StatusChipProps) {
  let displayLabel = label;
  let dotClass = TONE_DOT_CLASSES.neutral;

  if (status) {
    const meta = getConsultStatusMeta(status);
    displayLabel = displayLabel || meta.label;
    dotClass = CONSULT_STAGE_DOT_CLASS[meta.group] || TONE_DOT_CLASSES.neutral;
  } else if (tone) {
    dotClass = TONE_DOT_CLASSES[tone];
  }

  const heightCls = size === 'sm' ? 'h-5 px-2 text-[12px]' : 'h-6 px-2.5 text-[12px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 whitespace-nowrap shadow-2xs ${heightCls} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
      <span>{displayLabel || '미지정'}</span>
    </span>
  );
}
