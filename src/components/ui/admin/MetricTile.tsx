import React from 'react';

export interface MetricTileProps {
  title: string;
  value: string | number;
  subtext?: string;
  tone?: 'normal' | 'urgent' | 'brand' | 'success';
  active?: boolean;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * 어드민 인터랙티브 지표 타일 (기획서 4.4 & 5.4)
 * - 누르면 해당 필터 또는 큐로 이동하는 인터랙티브 카드
 * - 누를 수 없는 장식용 카드 제거
 */
export function MetricTile({
  title,
  value,
  subtext,
  tone = 'normal',
  active = false,
  onClick,
  icon: Icon,
  className = '',
}: MetricTileProps) {
  const isClickable = typeof onClick === 'function';

  let toneCls = 'border-slate-200 bg-white text-slate-900';
  let valueCls = 'text-slate-900';

  if (active) {
    toneCls = 'border-[#1E3A5F] bg-[#1E3A5F]/5 ring-1 ring-[#1E3A5F] text-[#1E3A5F]';
    valueCls = 'text-[#1E3A5F]';
  } else if (tone === 'urgent') {
    toneCls = 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 text-slate-900';
    valueCls = 'text-rose-600';
  } else if (tone === 'brand') {
    toneCls = 'border-[#1E3A5F]/30 bg-slate-50 hover:bg-white text-slate-900';
    valueCls = 'text-[#1E3A5F]';
  } else if (tone === 'success') {
    toneCls = 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 text-slate-900';
    valueCls = 'text-emerald-700';
  } else {
    toneCls = 'border-slate-200 bg-white hover:border-slate-300 text-slate-900';
  }

  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${toneCls} ${
        isClickable ? 'cursor-pointer press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-semibold text-slate-500 truncate">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-[20px] font-bold tracking-tight tabular-nums ${valueCls}`}>
          {value}
        </span>
      </div>
      {subtext && (
        <span className="text-[11px] text-slate-500 mt-1 truncate">
          {subtext}
        </span>
      )}
    </Tag>
  );
}
