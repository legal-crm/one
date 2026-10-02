import React from 'react';
import { CheckCircle2, Lock, Folder, History } from 'lucide-react';
import type { PipelineGateState } from '../pipeline/pipelineGates';

export type PipelineStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface JourneyRailProps {
  currentStage: PipelineStage;
  onSelectStage: (stage: PipelineStage) => void;
  gates: PipelineGateState;
  isBankruptcy?: boolean;
  onOpenDocuments?: () => void;
  onOpenTimeline?: () => void;
  className?: string;
}

interface StageStepDef {
  stage: PipelineStage;
  number: number;
  label: string;
  isCompleted: boolean;
  isLocked: boolean;
}

/**
 * 6단계 수임 여정 레일 (기획서 4.3 & 2-1)
 * - 수임 순서에 따른 직관적 1줄 연결형 레일
 * - 파산/회생 명칭 분기 지원
 * - 우측 [문서함] 및 [기록(타임라인)] 빠른 진입로 제공
 */
export function JourneyRail({
  currentStage,
  onSelectStage,
  gates,
  isBankruptcy = false,
  onOpenDocuments,
  onOpenTimeline,
  className = '',
}: JourneyRailProps) {
  const steps: StageStepDef[] = [
    {
      stage: 1,
      number: 1,
      label: '상담·제안',
      isCompleted: gates.isConsultCompleted,
      isLocked: false,
    },
    {
      stage: 2,
      number: 2,
      label: '수임 계약',
      isCompleted: gates.isContractCompleted,
      isLocked: gates.locked[2],
    },
    {
      stage: 3,
      number: 3,
      label: '서류 준비',
      isCompleted: gates.isDocCompleted,
      isLocked: gates.locked[3],
    },
    {
      stage: 4,
      number: 4,
      label: isBankruptcy ? '신청·접수' : '신청·접수',
      isCompleted: gates.isFilingCompleted,
      isLocked: gates.locked[4],
    },
    {
      stage: 5,
      number: 5,
      label: isBankruptcy ? '심문·선고' : '보정·개시',
      isCompleted: gates.isCommenced,
      isLocked: gates.locked[5],
    },
    {
      stage: 6,
      number: 6,
      label: isBankruptcy ? '파산·면책' : '변제·면책',
      isCompleted: gates.isDischarged,
      isLocked: gates.locked[6],
    },
  ];

  return (
    <nav
      aria-label="수임 여정 단계 레일"
      className={`bg-slate-50/90 border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar select-none ${className}`}
    >
      {/* 6단계 연결형 스텝 바 */}
      <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0" role="tablist">
        {steps.map((st, idx) => {
          const isActive = currentStage === st.stage;
          const isPast = st.isCompleted;

          return (
            <React.Fragment key={st.stage}>
              {idx > 0 && (
                <div
                  className={`h-0.5 w-3 sm:w-6 shrink-0 transition-colors ${
                    isPast ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectStage(st.stage)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30 ${
                  isActive
                    ? 'bg-white border border-slate-300 text-[#1E3A5F] font-bold shadow-2xs'
                    : isPast
                    ? 'text-emerald-800 hover:bg-emerald-50/70 font-semibold'
                    : st.isLocked
                    ? 'text-slate-400 hover:text-slate-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {/* 단계 상태 마커 */}
                {isPast ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : st.isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-[#1E3A5F]' : 'bg-slate-300'
                    }`}
                  />
                )}

                <span>{st.number}. {st.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* 우측 보조 빠른 진입 (문서함 · 기록) */}
      <div className="flex items-center gap-1 shrink-0 pl-3 border-l border-slate-200 text-[12px]">
        {onOpenDocuments && (
          <button
            type="button"
            onClick={onOpenDocuments}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium cursor-pointer"
            title="사건 전체 문서함 열람"
          >
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span>문서함</span>
          </button>
        )}
        {onOpenTimeline && (
          <button
            type="button"
            onClick={onOpenTimeline}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium cursor-pointer"
            title="사건 타임라인 전체 기록"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>기록</span>
          </button>
        )}
      </div>
    </nav>
  );
}
