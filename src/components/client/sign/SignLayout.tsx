import React from 'react';
import { BrandMark } from '../BrandLogo';
import { Stepper } from '../ui';
import { cn } from '../../../utils/cn';

/**
 * 원격 전자서명 화면 공통 틀 (docs/mykim_client_ui_upgrade_plan.md 3-7)
 * - 머리: 브랜드 + 사무소명 + 진행 단계(스크롤해도 위에 고정, z-40)
 * - 하단 액션 바: 화면 아래 고정(z-45, safe-area 포함). 본문은 pb-32로 가려지지 않게 둔다
 * - 서명 중 실수로 화면을 떠나지 않도록 브랜드 로고는 링크로 두지 않는다
 */
export function SignHeader({ firmName, steps, current }: { firmName?: string; steps?: string[]; current?: number }) {
  const showSteps = !!steps && steps.length > 0 && typeof current === 'number';
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
        <span className="inline-flex min-w-0 shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white" aria-hidden="true">
            <BrandMark className="h-5 w-5" />
          </span>
          <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-slate-900">my김변</span>
          <span className="whitespace-nowrap text-sm font-bold text-slate-500">전자계약</span>
        </span>
        {firmName && (
          <span className="min-w-0 truncate text-sm font-bold text-slate-600" title={firmName}>
            {firmName}
          </span>
        )}
      </div>
      {showSteps && (
        <div className="mx-auto max-w-xl px-4 pb-3">
          <Stepper steps={steps!} current={current!} ariaLabel="서명 진행 단계" />
        </div>
      )}
    </header>
  );
}

export function SignFooter({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-45 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl px-4 py-3">
        {note && <div className="mb-2.5">{note}</div>}
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function SignPage({
  header,
  footer,
  children,
  className,
}: {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {header}
      <main className={cn('mx-auto w-full max-w-xl px-4 pt-5', footer ? 'pb-36' : 'pb-12', className)}>{children}</main>
      {footer}
    </div>
  );
}

/** 단계 제목. 단계가 바뀌면 이 제목으로 포커스를 옮겨 화면낭독기가 새 단계를 읽게 한다 */
export const SignStepHeading = React.forwardRef<HTMLHeadingElement, { title: React.ReactNode; description?: React.ReactNode }>(
  function SignStepHeading({ title, description }, ref) {
    return (
      <div className="mb-5">
        <h1 ref={ref} tabIndex={-1} className="text-xl font-extrabold tracking-tight text-slate-900 break-keep outline-none">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-600 break-keep">{description}</p>}
      </div>
    );
  },
);
