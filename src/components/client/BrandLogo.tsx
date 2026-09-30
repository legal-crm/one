import React from 'react';
import { cn } from '../../utils/cn';

/**
 * my김변 브랜드 마크 (네이비 브랜드 적용)
 * 기존 보라색 PNG(방패 + KM 이니셜 + 받치는 손)를 단순화한 SVG. 색은 currentColor를 따른다.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {/* 방패 (오른쪽 위가 열린 형태) */}
      <path d="M50 35V21.6c0-2.5-1.6-4.6-4-5.3L33.8 12.7a6.4 6.4 0 0 0-3.6 0L18 16.3c-2.4.7-4 2.8-4 5.3V31c0 11.3 7.3 19.7 18 24.5" strokeWidth="5.5" />
      {/* 받치는 손 */}
      <path d="M24.5 47.2c3.6-2.9 8-3.3 11.9-1.3l1.6.8c4.3 2 9-.4 12.3-6.2" strokeWidth="5.5" />
      {/* K */}
      <path d="M23.5 24.5v15" strokeWidth="4.5" />
      <path d="M32 24.5 25.2 32l6.8 7.5" strokeWidth="4.5" />
      {/* m */}
      <path d="M35.5 39.5v-7l3.6 3.6 3.6-3.6v7" strokeWidth="3.6" />
    </svg>
  );
}

interface BrandLogoProps {
  /** 워드마크 아래 보조 문구 */
  tagline?: string;
  /** 태그라인 표시 반응형 클래스(기본: sm 이상) */
  taglineClassName?: string;
  /** 어두운 배경(푸터 등)에서 사용 */
  onDark?: boolean;
  className?: string;
}

export default function BrandLogo({ tagline, taglineClassName = 'hidden sm:block', onDark = false, className }: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 min-w-0', className)}>
      <span
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          onDark ? 'bg-white text-brand' : 'bg-brand text-white shadow-brand-sm',
        )}
      >
        <BrandMark className="w-7 h-7" />
      </span>
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className={cn('font-extrabold text-lg sm:text-xl tracking-tight whitespace-nowrap', onDark ? 'text-white' : 'text-slate-900')}>
          my김변
        </span>
        {tagline && (
          <span className={cn('text-xs font-bold whitespace-nowrap', onDark ? 'text-slate-300' : 'text-slate-500', taglineClassName)}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}

export const BRAND_TAGLINE = '채무 정리부터 변호사 선택까지';
