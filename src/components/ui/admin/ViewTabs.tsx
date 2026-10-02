import React from 'react';

export interface ViewTabItem {
  id: string;
  label: string;
  count?: number;
  countVariant?: 'normal' | 'urgent';
  isLocked?: boolean;
}

export interface ViewTabsProps {
  tabs: ViewTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline';
  className?: string;
}

/**
 * 어드민 뷰 탭 (기획서 5.4 & Rule 2)
 * - 저장된 보기 탭 (전체, 서약 대기, 보정 등) + 카운트 배지
 * - 배지 2종 규칙: 일반(slate-700), 긴급(rose-500), 상한 99+
 */
export function ViewTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}: ViewTabsProps) {
  return (
    <nav
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 ${className}`}
      role="tablist"
      aria-label="저장된 보기 목록"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const displayCount =
          typeof tab.count === 'number'
            ? tab.count > 99
              ? '99+'
              : tab.count
            : null;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              disabled={tab.isLocked}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30 ${
                isActive
                  ? 'border-[#1E3A5F] text-[#1E3A5F] font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              } ${tab.isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <span>{tab.label}</span>
              {displayCount !== null && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold ${
                    tab.countVariant === 'urgent'
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {displayCount}
                </span>
              )}
            </button>
          );
        }

        // pills variant (기본값)
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            disabled={tab.isLocked}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-all whitespace-nowrap cursor-pointer press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30 ${
              isActive
                ? 'bg-white border border-slate-300/90 text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            } ${tab.isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span>{tab.label}</span>
            {displayCount !== null && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold ${
                  tab.countVariant === 'urgent'
                    ? 'bg-rose-500 text-white'
                    : isActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {displayCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
