import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EmptyState } from '../../client/ui/feedback';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField: keyof T | ((item: T) => string);
  isLoading?: boolean;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  density?: 'standard' | 'compact';
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  onRowClick?: (item: T) => void;
  className?: string;
}

/**
 * 어드민 고밀도 표준 데이터 테이블 (기획서 5.4 & Rule 1/2)
 * - 48px 표준 / 40px 컴팩트 행 높이
 * - 숫자 tabular-nums 및 우측 정렬
 * - 정렬 머리글, 스켈레톤 행, 빈 상태(EmptyState) 내장
 */
export function DataTable<T>({
  columns,
  data,
  keyField,
  isLoading = false,
  sortColumn,
  sortDirection,
  onSort,
  density = 'standard',
  emptyTitle = '데이터가 없습니다',
  emptyDescription,
  emptyAction,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const rowHeightCls = density === 'compact' ? 'h-10 py-1.5' : 'h-12 py-2.5';

  const getKey = (item: T, idx: number): string => {
    if (typeof keyField === 'function') return keyField(item);
    return String(item[keyField] ?? idx);
  };

  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs ${className}`}>
      <table className="w-full text-left border-collapse text-[13px]">
        {/* 머리글 */}
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold select-none">
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              const alignCls =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left';

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-3.5 py-2.5 text-[12px] font-bold text-slate-600 whitespace-nowrap ${alignCls}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1E3A5F]/40 rounded"
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* 본문 */}
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            // 스켈레톤 로딩 행 (3~5줄)
            Array.from({ length: 5 }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                {columns.map((col, cIdx) => (
                  <td key={`sk-${rIdx}-${cIdx}`} className={`px-3.5 ${rowHeightCls}`}>
                    <div className="h-4 bg-slate-200/80 rounded w-4/5" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            // 빈 상태
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-12 text-center">
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={
                    emptyAction ? (
                      <button
                        type="button"
                        onClick={emptyAction.onClick}
                        className="px-3.5 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white text-[13px] font-semibold tracking-tight shadow-sm press-scale cursor-pointer"
                      >
                        {emptyAction.label}
                      </button>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          ) : (
            // 데이터 행
            data.map((item, idx) => {
              const key = getKey(item, idx);
              const isClickable = typeof onRowClick === 'function';

              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    isClickable ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => {
                    const alignCls =
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    const content = col.render
                      ? col.render(item, idx)
                      : (item as any)[col.key];

                    return (
                      <td
                        key={col.key}
                        className={`px-3.5 ${rowHeightCls} text-slate-700 whitespace-nowrap ${alignCls}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
