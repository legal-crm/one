import React from 'react';

/** 분석서 섹션 — 카드 대신 여백과 구분선으로 나눈다 (AGENTS Rule 5-3) */
export function RailSection({
  icon: Icon,
  iconClassName = 'text-slate-500',
  title,
  aside,
  children,
}: {
  icon?: React.ElementType;
  iconClassName?: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center gap-2 min-w-0">
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconClassName}`} aria-hidden="true" />}
        <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
        {aside && <div className="ml-auto shrink-0 text-[12px] text-slate-500">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** 금액 행: 라벨 왼쪽, 값 오른쪽 (숫자는 tabular-nums) */
export function DataRow({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'risk' | 'positive' | 'negative';
  hint?: string;
}) {
  const valueClass = tone === 'risk'
    ? 'text-rose-700'
    : tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-rose-700'
        : 'text-slate-900';
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <div className="min-w-0">
        <span className="text-xs text-slate-600">{label}</span>
        {hint && <span className="block text-[12px] text-slate-500">{hint}</span>}
      </div>
      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/** 라벨/값 2열 목록 (긴 값도 자기 칸 안에서 줄바꿈) */
export function DefinitionGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(item => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[12px] text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 목록 앞 색 점: 빨강 = 법적 위험, 주황 = 확인 필요, 초록 = 유리한 조건 */
export function ToneDot({ tone }: { tone: 'risk' | 'caution' | 'positive' }) {
  const cls = tone === 'risk' ? 'bg-rose-600' : tone === 'caution' ? 'bg-amber-500' : 'bg-emerald-500';
  return <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} aria-hidden="true" />;
}
