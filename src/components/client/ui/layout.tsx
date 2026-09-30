import React, { useId, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

/* ─────────────────────────────────────────────
   PageHeader · SectionHeader · Card · SearchField · FilterChips · Pagination · SegmentedTabs · Stepper
   고객 사이트 페이지 구성 공통 부품
   ───────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  back,
  variant = 'plain',
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { label: string; onClick: () => void };
  /** plain: 흰 배경 제목 / hero: 네이비 카드 */
  variant?: 'plain' | 'hero';
  className?: string;
  children?: React.ReactNode;
}) {
  const backLink = back && (
    <button
      type="button"
      onClick={back.onClick}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-11 -ml-2 px-2 rounded-xl text-sm font-bold transition-colors',
        variant === 'hero' ? 'text-slate-200 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
      )}
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      {back.label}
    </button>
  );

  if (variant === 'hero') {
    return (
      <section className={cn('rounded-3xl bg-brand-deep text-white px-5 py-6 sm:px-8 sm:py-8', className)}>
        {backLink && <div className="mb-3">{backLink}</div>}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight break-keep">{title}</h1>
            {description && <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed break-keep max-w-2xl">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </section>
    );
  }

  return (
    <header className={cn('pb-5 mb-6 border-b border-slate-200', className)}>
      {backLink && <div className="mb-2">{backLink}</div>}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-keep">{title}</h1>
          {description && <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed break-keep max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  align = 'left',
  as: Tag = 'h2',
  className,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  as?: 'h2' | 'h3';
  className?: string;
  id?: string;
}) {
  if (align === 'center') {
    return (
      <div className={cn('text-center max-w-2xl mx-auto mb-8 md:mb-10', className)}>
        <Tag id={id} className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight break-keep">
          {title}
        </Tag>
        {description && <p className="mt-3 text-base md:text-lg text-slate-600 leading-relaxed break-keep">{description}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5', className)}>
      <div className="min-w-0">
        <Tag id={id} className={cn('font-extrabold text-slate-900 tracking-tight break-keep', Tag === 'h2' ? 'text-xl md:text-2xl' : 'text-lg')}>
          {title}
        </Tag>
        {description && <p className="mt-1.5 text-sm md:text-base text-slate-600 leading-relaxed break-keep">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** 섹션 카드 (R5: 섹션 카드 rounded-2xl) */
export function Card({
  children,
  className,
  padded = true,
  as: Tag = 'div',
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <Tag {...rest} className={cn('rounded-2xl border border-slate-200 bg-white shadow-xs', padded && 'p-5 sm:p-6', className)}>
      {children}
    </Tag>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 화면에 보이지 않는 입력란 이름(스크린리더용) */
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  wrap = false,
  className,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** false면 가로 스크롤(모바일 기본) */
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex gap-2', wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'shrink-0 min-h-11 sm:min-h-10 px-4 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors active:scale-[0.98]',
              active ? 'bg-brand border-brand text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50',
            )}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className={cn('ml-1.5 text-xs font-bold', active ? 'text-white/80' : 'text-slate-500')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function pageList(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, page, page - 1, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const nav = 'min-h-11 min-w-11 px-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 transition-colors';
  return (
    <nav aria-label="페이지 이동" className={cn('flex flex-wrap items-center justify-center gap-1.5 pt-6', className)}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={cn(nav, 'text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent')}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        이전
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`${p}페이지`}
            onClick={() => onChange(p)}
            className={cn(nav, p === page ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-100')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={cn(nav, 'text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent')}>
        다음
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

export interface SegmentTab<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

/** WAI-ARIA 탭 패턴(←/→/Home/End). 패널에는 id={`${idPrefix}-panel-${tab}`}를 쓰면 된다. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  fullWidth = true,
  className,
}: {
  tabs: SegmentTab<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  idPrefix: string;
  fullWidth?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-1 p-1 rounded-2xl bg-slate-100 overflow-x-auto scrollbar-hide', className)}
    >
      {tabs.map((t, idx) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              'min-h-11 px-3.5 rounded-xl text-sm font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-colors',
              fullWidth && 'flex-1',
              active ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

/** 단계 표시(위저드·전자서명 등). current는 0부터 */
export function Stepper({
  steps,
  current,
  className,
  ariaLabel = '진행 단계',
}: {
  steps: string[];
  current: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <ol aria-label={ariaLabel} className={cn('flex items-center gap-1.5', className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex-1 min-w-0" aria-current={active ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full', done ? 'bg-brand' : active ? 'bg-brand/60' : 'bg-slate-200')} />
            <p className={cn('mt-1.5 text-xs font-bold truncate', active ? 'text-brand' : done ? 'text-slate-700' : 'text-slate-500')}>
              <span className="sr-only">{done ? '완료: ' : active ? '현재 단계: ' : '예정: '}</span>
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
