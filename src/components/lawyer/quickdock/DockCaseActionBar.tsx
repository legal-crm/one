import React, { useState } from 'react';
import { 
  FolderCheck, PlusCircle, StickyNote, RefreshCw, 
  CheckCircle2, ArrowRight, UserCheck 
} from 'lucide-react';
import { 
  useDockShared, 
  applyDockToActiveCase, 
  addDockTaskTicket, 
  addDockMemo,
  DockApplyData 
} from './dockShared';

interface DockCaseActionBarProps {
  /** 사건에 반영할 계산 결과 데이터 */
  applyData?: DockApplyData;
  /** 할 일 등록용 커스텀 데이터 (제목·내용) */
  taskData?: {
    title: string;
    description: string;
    dueDate?: string;
    priority?: string;
  };
  /** 메모에 추가할 브리핑 텍스트 */
  memoText?: string;
  /** 메모 분류 */
  memoCategory?: string;
  /** 버튼 비활성화 여부 */
  disabled?: boolean;
  /** 상단 사건 연결 상태 바 표시 여부 */
  showHeaderBadge?: boolean;
}

/**
 * 퀵툴-사건 연동 공통 액션 바
 * - 사건 워크스페이스 연결 시:
 *   1. '사건에 반영': 월 변제금, 변제기간, 총 채무, 청산가치를 사건 변제계획에 즉시 반영
 *   2. '할 일 등록': 계산 검토 업무 티켓을 사건에 자동 등록
 *   3. '메모에 추가': 계산 브리핑을 사건 상담 메모 타임라인에 기록
 */
export default function DockCaseActionBar({
  applyData,
  taskData,
  memoText,
  memoCategory = 'consultation',
  disabled = false,
  showHeaderBadge = true,
}: DockCaseActionBarProps) {
  const shared = useDockShared();
  const caseCtx = shared.caseContext;

  const [isApplying, setIsApplying] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingMemo, setIsAddingMemo] = useState(false);

  if (!caseCtx) return null;

  const handleApply = async () => {
    if (!applyData || isApplying || disabled) return;
    setIsApplying(true);
    try {
      await applyDockToActiveCase(applyData);
    } finally {
      setIsApplying(false);
    }
  };

  const handleAddTask = async () => {
    if (isAddingTask || disabled) return;
    const fallbackTitle = applyData?.sourceTool 
      ? `[퀵툴] ${applyData.sourceTool} 검토 - ${caseCtx.clientName}`
      : `[퀵툴 계산 결과 검토] ${caseCtx.clientName}`;
    const fallbackDesc = memoText || applyData?.summaryText || '퀵툴에서 산출한 회생/파산 수치를 확인하고 의뢰인 상담 및 서류에 반영하세요.';

    setIsAddingTask(true);
    try {
      await addDockTaskTicket({
        title: taskData?.title || fallbackTitle,
        description: taskData?.description || fallbackDesc,
        dueDate: taskData?.dueDate,
        priority: taskData?.priority || 'NORMAL',
      });
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleAddMemo = async () => {
    if (!memoText || isAddingMemo || disabled) return;
    setIsAddingMemo(true);
    try {
      await addDockMemo(memoText, memoCategory);
    } finally {
      setIsAddingMemo(false);
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200">
      {/* ── 사건 연결 상태 배지 ── */}
      {showHeaderBadge && (
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
            <span className="font-bold truncate">
              {caseCtx.clientName} 님 사건 연결됨
            </span>
            {caseCtx.caseNumber && (
              <span className="text-xs text-blue-700/80 font-mono truncate">
                ({caseCtx.caseNumber})
              </span>
            )}
          </div>
          <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded shrink-0">
            사건 동기화 중
          </span>
        </div>
      )}

      {/* ── 3대 액션 버튼 ── */}
      <div className="flex items-center gap-1.5">
        {/* 1. 사건에 반영 */}
        {applyData && (
          <button
            type="button"
            onClick={handleApply}
            disabled={disabled || isApplying}
            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            title="계산된 변제금 및 채무·기간을 사건 변제계획에 반영합니다"
          >
            <FolderCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isApplying ? '반영 중...' : '사건에 반영'}</span>
          </button>
        )}

        {/* 2. 할 일 등록 */}
        <button
          type="button"
          onClick={handleAddTask}
          disabled={disabled || isAddingTask}
          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          title="사건 담당자 할 일(업무 티켓)으로 등록합니다"
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
          <span>{isAddingTask ? '등록 중...' : '할 일 등록'}</span>
        </button>

        {/* 3. 메모에 추가 */}
        {memoText && (
          <button
            type="button"
            onClick={handleAddMemo}
            disabled={disabled || isAddingMemo}
            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 disabled:opacity-50 text-amber-900 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            title="계산 브리핑 문구를 사건 상담 메모 타임라인에 기록합니다"
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            <span>{isAddingMemo ? '기록 중...' : '메모에 추가'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
