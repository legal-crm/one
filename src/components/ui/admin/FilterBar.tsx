import React from 'react';
import { Search, X } from 'lucide-react';

export interface FilterBarProps {
  /** 검색어 */
  searchQuery?: string;
  /** 검색어 변경 콜백 */
  onSearchChange?: (q: string) => void;
  /** 검색 플레이스홀더 */
  searchPlaceholder?: string;
  /** 필터 칩 또는 드롭다운 슬롯 */
  children?: React.ReactNode;
  /** 우측 부가 액션 슬롯 (정렬, 필터 초기화, 컬럼 토글 등) */
  rightSlot?: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 어드민 1줄 필터 바 (기획서 4.5 & 5.4)
 * - 검색 + 빠른 필터 칩 + 우측 정렬/도구
 * - 2단 툴바를 1줄의 고밀도 정돈된 바 형태로 통합
 */
export function FilterBar({
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = '검색어를 입력하세요...',
  children,
  rightSlot,
  className = '',
}: FilterBarProps) {
  return (
    <div
      className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 py-2 ${className}`}
    >
      {/* 좌측: 검색창 및 필터 칩 */}
      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
        {onSearchChange && (
          <div className="relative min-w-[200px] max-w-sm w-full md:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-1.5 h-9 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="검색어 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 필터 칩 슬롯 */}
        {children && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto no-scrollbar py-0.5">
            {children}
          </div>
        )}
      </div>

      {/* 우측: 정렬, 추가 액션 슬롯 */}
      {rightSlot && (
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
