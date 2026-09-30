import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../../utils/cn';

/* ─────────────────────────────────────────────
   Badge · Callout · EmptyState · ErrorState · Skeleton
   고객 사이트 상태 표현 공통 부품 (R1 상태 완결성)
   ───────────────────────────────────────────── */

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'teal';

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-brand-light text-brand border-brand/15',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
};

export function Badge({
  tone = 'neutral',
  size = 'sm',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border font-bold whitespace-nowrap leading-none',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const CALLOUT_TONE: Record<Exclude<Tone, 'brand' | 'teal'>, { box: string; icon: React.ReactNode; title: string }> = {
  neutral: { box: 'bg-slate-50 border-slate-200 text-slate-700', icon: <Info className="w-4 h-4 text-slate-500" />, title: 'text-slate-900' },
  info: { box: 'bg-sky-50 border-sky-200 text-sky-900', icon: <Info className="w-4 h-4 text-sky-700" />, title: 'text-sky-950' },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: <CheckCircle2 className="w-4 h-4 text-emerald-700" />, title: 'text-emerald-950' },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: <AlertTriangle className="w-4 h-4 text-amber-700" />, title: 'text-amber-950' },
  danger: { box: 'bg-red-50 border-red-200 text-red-900', icon: <AlertCircle className="w-4 h-4 text-red-700" />, title: 'text-red-950' },
};

/** 안내·주의 박스. 이모지 대신 아이콘과 문장으로 전달한다. */
export function Callout({
  tone = 'neutral',
  title,
  children,
  icon,
  className,
  action,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const t = CALLOUT_TONE[tone];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed', t.box, className)}>
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon || t.icon}
      </span>
      <div className="flex-1 min-w-0 break-keep">
        {title && <p className={cn('font-bold', t.title)}>{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/** 빈 상태: 무엇이 비어 있는지 + 어떻게 채우는지 + 행동 버튼 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-8 px-4' : 'py-12 px-6', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900 break-keep">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-slate-600 max-w-md leading-relaxed break-keep">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** 심각한 오류: 원인 설명 + 복구 버튼 */
export function ErrorState({
  title = '정보를 불러오지 못했습니다',
  description = '잠시 후 다시 시도해 주세요. 문제가 계속되면 1:1 문의로 알려 주세요.',
  onRetry,
  retryLabel = '다시 시도',
  secondaryAction,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center text-center py-10 px-6', className)}>
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4" aria-hidden="true">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 break-keep">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-slate-600 max-w-md leading-relaxed break-keep">{description}</p>}
      {(onRetry || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover active:scale-[0.98] whitespace-nowrap"
            >
              {retryLabel}
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/* ── Skeleton (비동기 로딩은 최종 레이아웃 모양으로) ── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200/70', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 space-y-4', className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** 탭 공통 로딩 화면 */
export function PageSkeleton({ label = '화면을 불러오는 중입니다' }: { label?: string }) {
  return (
    <div className="space-y-6 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
}
