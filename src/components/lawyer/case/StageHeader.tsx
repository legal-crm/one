import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';

export interface StageCondition {
  id: string;
  label: string;
  isMet: boolean;
  hint?: string;
  onClickHint?: () => void;
}

export interface SectionTabItem {
  id: string;
  label: string;
  count?: number;
}

export interface StageHeaderProps {
  stageNumber: number;
  stageTitle: string;
  stageDescription?: string;
  conditions?: StageCondition[];
  progressText?: string;
  progressPercent?: number;
  sectionTabs?: SectionTabItem[];
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
  className?: string;
}

/**
 * 단계 헤더 및 완료 조건 체크리스트 (기획서 3.4 & 4.3)
 * - 단계명 및 완료 조건 3~5개를 체크리스트 형태로 상단에 투명하게 제시
 * - 섹션 탭(2~4개) 내장
 */
export function StageHeader({
  stageNumber,
  stageTitle,
  stageDescription,
  conditions = [],
  progressText,
  progressPercent,
  sectionTabs = [],
  activeSection,
  onSelectSection,
  className = '',
}: StageHeaderProps) {
  return (
    <div className={`bg-white border-b border-slate-200/80 p-4 sm:p-5 space-y-4 ${className}`}>
      {/* 1열: 단계 제목 & 실무 진행도 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-md">
              {stageNumber}단계
            </span>
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
              {stageTitle}
            </h2>
          </div>
          {stageDescription && (
            <p className="mt-1 text-[13px] text-slate-500">
              {stageDescription}
            </p>
          )}
        </div>

        {/* 진행률 인디케이터 */}
        {(progressText || typeof progressPercent === 'number') && (
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {progressText && (
              <span className="text-[12px] font-bold text-slate-600 tabular-nums">
                {progressText}
              </span>
            )}
            {typeof progressPercent === 'number' && (
              <div className="w-24 sm:w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                <div
                  className="h-full bg-[#1E3A5F] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2열: 완료 조건 체크리스트 (기획서 3.4: 완료 조건을 먼저 보여 줍니다) */}
      {conditions.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            다음 단계 진행 필수 조건
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
            {conditions.map((cond) => (
              <div
                key={cond.id}
                className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-slate-200/80"
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    cond.isMet
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {cond.isMet ? <Check className="w-3 h-3 stroke-[3]" /> : <Clock className="w-3 h-3" />}
                </span>
                <span
                  className={`truncate flex-1 font-medium ${
                    cond.isMet ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {cond.label}
                </span>
                {cond.hint && (
                  <button
                    type="button"
                    onClick={cond.onClickHint}
                    className="text-xs text-[#1E3A5F] hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    {cond.hint}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3열: 단계별 섹션 탭 (기획서 4.3: 단계 레일 1개 + 단계별 섹션 탭 2~4개) */}
      {sectionTabs.length > 0 && onSelectSection && (
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar" role="tablist">
          {sectionTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30 ${
                  isActive
                    ? 'bg-[#1E3A5F] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-xs font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
