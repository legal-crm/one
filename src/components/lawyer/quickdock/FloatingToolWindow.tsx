import React, { useState, useEffect, useRef } from 'react';
import { X, Minus, Square, Move, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { QuickToolId, Position } from './types';
import { ALL_QUICK_TOOLS } from './defaultTools';
import { getToolIcon } from './toolIcons';
import { resetDockShared, useDockShared } from './dockShared';
import { useDialog } from '../../common/DialogProvider';

// 개별 도구 뷰들 import
import CalculatorTool from './tools/CalculatorTool';
import MedianIncomeTool from './tools/MedianIncomeTool';
import ExtraExpenseTool from './tools/ExtraExpenseTool';
import VirtualAccountTool from './tools/VirtualAccountTool';
import RehabPayCalcTool from './tools/RehabPayCalcTool';
import LiquidationCalcTool from './tools/LiquidationCalcTool';
import CourtGuidelinesTool from './tools/CourtGuidelinesTool';
import SeizureLimitsTool from './tools/SeizureLimitsTool';
import QuickMemoTool from './tools/QuickMemoTool';
import InterestCompareTool from './tools/InterestCompareTool';
import LegalArticlesTool from './tools/LegalArticlesTool';
import AssetValuationTool from './tools/AssetValuationTool';
import KoreanAgeCalcTool from './tools/KoreanAgeCalcTool';
import CreditorSearchTool from './tools/CreditorSearchTool';
import DocumentChecklistTool from './tools/DocumentChecklistTool';
import FloatingPinMemoTool from './tools/FloatingPinMemoTool';
import DeadlineCalcTool from './tools/DeadlineCalcTool';

interface FloatingToolWindowProps {
  activeToolId: QuickToolId | null;
  enabledToolIds: QuickToolId[];
  onSelectTool: (id: QuickToolId) => void;
  onClose: () => void;
  dockPosition: Position | null;
  /** 독 메뉴에서 도구를 고를 때마다 바뀌는 값 → 접힌 창을 다시 펼친다 (같은 도구를 다시 골라도) */
  openSignal?: number;
}

const WINDOW_STORAGE_KEY = 'legal_quick_window_pos_v2';
const PADDING = 12;
const WINDOW_WIDTH = 410; // 데스크톱 기본 너비 (좁은 화면에서는 화면 너비에 맞춤)
/** 제목줄 + 도구 탭 바 높이(대략) — 본문 최대 높이 계산용 */
const CHROME_HEIGHT = 84;

function windowWidthFor(viewportWidth: number): number {
  return Math.min(WINDOW_WIDTH, Math.max(240, viewportWidth - PADDING * 2));
}

function clampWindowPos(x: number, y: number, width: number, vw: number, vh: number): Position {
  return {
    x: Math.min(Math.max(PADDING, x), Math.max(PADDING, vw - width - PADDING)),
    y: Math.min(Math.max(PADDING, y), Math.max(PADDING, vh - 100)),
  };
}

function renderTool(id: QuickToolId, isActive: boolean): React.ReactNode {
  switch (id) {
    case 'calculator': return <CalculatorTool />;
    case 'median': return <MedianIncomeTool />;
    case 'extraExpense': return <ExtraExpenseTool />;
    case 'virtualAccount': return <VirtualAccountTool />;
    case 'rehabPayCalc': return <RehabPayCalcTool />;
    case 'liquidationCalc': return <LiquidationCalcTool />;
    case 'courtGuidelines': return <CourtGuidelinesTool />;
    case 'seizureLimits': return <SeizureLimitsTool />;
    case 'quickMemo': return <QuickMemoTool />;
    case 'interestCompare': return <InterestCompareTool />;
    case 'legalArticles': return <LegalArticlesTool />;
    case 'assetValuation': return <AssetValuationTool />;
    case 'koreanAge': return <KoreanAgeCalcTool />;
    case 'creditorSearch': return <CreditorSearchTool />;
    case 'docChecklist': return <DocumentChecklistTool />;
    case 'pinMemo': return <FloatingPinMemoTool isActive={isActive} />;
    case 'deadlineCalc': return <DeadlineCalcTool />;
    default: return null;
  }
}

export default function FloatingToolWindow({
  activeToolId,
  enabledToolIds,
  onSelectTool,
  onClose,
  dockPosition,
  openSignal = 0,
}: FloatingToolWindowProps) {
  const dialog = useDialog();
  const [isMinimized, setIsMinimized] = useState(false);
  const [winPos, setWinPos] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  /** 한 번 연 도구는 창을 닫을 때까지 마운트 유지 → 탭을 바꾸거나 접어도 입력값이 남는다 */
  const [mountedIds, setMountedIds] = useState<QuickToolId[]>([]);
  /** '새 상담' 초기화 시 도구 내부 상태까지 새로 시작하도록 key 갱신 */
  const [resetNonce, setResetNonce] = useState(0);

  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** 접기/펼치기 버튼 — Esc로 접은 뒤 포커스를 옮길 곳 */
  const minimizeBtnRef = useRef<HTMLButtonElement>(null);

  const width = windowWidthFor(viewport.w);
  const bodyMaxHeight = Math.max(
    220,
    Math.min(viewport.h * 0.7, viewport.h - (winPos?.y ?? 0) - CHROME_HEIGHT - PADDING),
  );

  // 초기 윈도우 위치 계산 (저장된 좌표 or 도크 인근 스마트 배치)
  // 창이 새로 열릴 때(null → 도구)만 계산 — 탭 전환·도크 이동 시 창 위치를 유지
  const isOpen = Boolean(activeToolId);
  const dockPosRef = useRef(dockPosition);
  dockPosRef.current = dockPosition;
  useEffect(() => {
    if (!isOpen) {
      setWinPos(null);
      setMountedIds([]);
      return;
    }
    setIsMinimized(false);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = windowWidthFor(vw);
    setViewport({ w: vw, h: vh });

    try {
      const saved = localStorage.getItem(WINDOW_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setWinPos(clampWindowPos(parsed.x, parsed.y, w, vw, vh));
          return;
        }
      }
    } catch {
      // ignore
    }

    // 도크 인근 스마트 배치: 도크의 좌측 상단 또는 화면 안쪽
    // 창 전체(제목줄+탭+본문 최대 70vh)가 화면 아래로 잘리지 않도록 위쪽으로 올려 배치
    const dockX = dockPosRef.current?.x ?? (vw - 180);
    const dockY = dockPosRef.current?.y ?? (vh - 80);
    const estimatedHeight = Math.min(vh * 0.7 + CHROME_HEIGHT, vh - PADDING * 2);
    const initialY = Math.min(dockY - 480, vh - estimatedHeight - PADDING);
    setWinPos(clampWindowPos(dockX - w + 60, initialY, w, vw, vh));
  }, [isOpen]);

  // 창 리사이즈 시 너비·위치 보정 (화면 밖 방지)
  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewport({ w: vw, h: vh });
      setWinPos(prev => (prev ? clampWindowPos(prev.x, prev.y, windowWidthFor(vw), vw, vh) : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 연 도구를 마운트 목록에 추가, 탭을 바꾸면 본문 스크롤을 맨 위로
  useEffect(() => {
    if (!activeToolId) return;
    setMountedIds(prev => (prev.includes(activeToolId) ? prev : [...prev, activeToolId]));
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeToolId]);

  // 독 메뉴에서 도구를 고르면(같은 도구 포함) 접힌 창을 다시 펼친다
  // (Esc가 창을 접게 바뀌어, 접힌 창에 메뉴로 도구를 열면 제목만 바뀌고 본문이 안 보이는 문제 방지)
  useEffect(() => {
    if (openSignal > 0) setIsMinimized(false);
  }, [openSignal]);

  // 드래그 핸들 이벤트 (타이틀 바)
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // 헤더 내 버튼 클릭 시 드래그 방지
    if (target.closest('button')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: winPos?.x ?? 50,
      initY: winPos?.y ?? 50,
    };
    setIsDragging(true);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const next = clampWindowPos(
      dragStartRef.current.initX + deltaX,
      dragStartRef.current.initY + deltaY,
      width,
      window.innerWidth,
      window.innerHeight + 30, // 타이틀바가 하단 가장자리까지 내려갈 수 있게 약간 여유
    );
    setWinPos(next);
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
    dragStartRef.current = null;

    if (winPos) {
      try {
        localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify(winPos));
      } catch {
        // ignore
      }
    }
  };

  const shared = useDockShared();

  // 창 안에서 Esc → 창 접기 (도구는 마운트된 채 숨김 → 입력값 유지). 닫기는 닫기 버튼으로만.
  // 이전: Esc가 창을 닫아(onClose) 유지 중인 도구 목록(mountedIds)이 비워지며 모든 도구 입력이 사라졌음.
  // 도구가 자체적으로 Esc를 처리한 경우(preventDefault)와 한글 조합 중 Esc는 건드리지 않는다.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    // 창 안의 Esc는 뒤쪽 어드민 화면의 Esc 처리로 넘기지 않는다 (이전과 같음 — 접힌 상태에서 Esc를 또 눌러도)
    e.preventDefault();
    e.stopPropagation();
    if (isMinimized) return; // 이미 접힌 상태면 그대로 둔다
    setIsMinimized(true);
    // 포커스가 있던 입력칸이 숨겨지므로 '창 펼치기' 버튼으로 옮겨 키보드로 바로 다시 펼 수 있게 한다
    minimizeBtnRef.current?.focus();
  };

  // 새 상담: 모든 계산기 공유값 초기화 (메모는 유지)
  const handleResetAll = async () => {
    const ok = await dialog.confirm({
      title: '새 상담 시작',
      message: shared.caseContext
        ? `${shared.caseContext.clientName} 님 사건과 연결되어 있습니다. 모든 계산기 입력값을 비우고 초기화하시겠습니까?`
        : '모든 계산기에 입력한 금액·인원수·채권자 목록을 지웁니다. 상담 메모와 핀 메모는 그대로 둡니다.',
      confirmText: '입력값 지우기',
      variant: 'warning',
    });
    if (!ok) return;
    resetDockShared();
    setResetNonce(n => n + 1);
    toast.success('계산기 입력값을 모두 지웠습니다.');
  };

  if (!activeToolId || !winPos) return null;

  const currentTool = ALL_QUICK_TOOLS.find(t => t.id === activeToolId) || ALL_QUICK_TOOLS[0];
  const IconComponent = getToolIcon(currentTool.iconName);

  // 활성화된 도구 탭 목록 (액션 전용 제외)
  const windowTools = ALL_QUICK_TOOLS.filter(
    t => enabledToolIds.includes(t.id) && !t.isActionOnly
  );

  // 마운트 유지 중인 도구 (방금 연 도구는 effect 이전에도 바로 렌더)
  const renderedIds = (mountedIds.includes(activeToolId) ? mountedIds : [...mountedIds, activeToolId])
    .filter(id => id === activeToolId || enabledToolIds.includes(id));

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="quickdock-window-title"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: `${winPos.x}px`,
        top: `${winPos.y}px`,
        width: `${width}px`,
      }}
      // z-40: 어드민 인라인 모달(z-50)이 항상 위에 오도록 (이전: 같은 z-50에 DOM 뒤쪽이라 모달 위에 떠서 눌림)
      className={`z-40 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-300/90 overflow-hidden transition-shadow duration-200 ${
        isDragging ? 'shadow-blue-500/20 ring-2 ring-blue-500/50' : 'shadow-2xl'
      }`}
    >
      {/* ── 윈도우 타이틀바 (라이트 톤 드래그 핸들) ── */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        className="bg-slate-50 text-slate-900 px-3.5 py-2.5 flex items-center justify-between cursor-move select-none border-b border-slate-200 touch-none active:bg-slate-100/90"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
            <Move className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div className={`w-5 h-5 rounded-md ${currentTool.colorClass.bg} ${currentTool.colorClass.text} flex items-center justify-center shrink-0`}>
            <IconComponent className="w-3 h-3" aria-hidden="true" />
          </div>
          <span id="quickdock-window-title" className="font-bold text-xs text-slate-900 truncate">
            {currentTool.title}
          </span>
          {shared.caseContext && (
            <span
              className="text-xs bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1 max-w-[120px] truncate"
              title={`${shared.caseContext.clientName} 님 사건 데이터 연동 중`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
              <span className="truncate">{shared.caseContext.clientName}</span>
            </span>
          )}
        </div>

        {/* 윈도우 컨트롤러 (새 상담, 최소화, 닫기) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            aria-label="계산기 입력값 모두 지우기 (새 상담)"
            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="새 상담: 계산기 입력값 모두 지우기"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            ref={minimizeBtnRef}
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            aria-label={isMinimized ? '창 펼치기' : '창 접기'}
            aria-expanded={!isMinimized}
            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
            title={isMinimized ? '창 펼치기' : '창 접기 (Esc, 입력값 유지)'}
          >
            {isMinimized ? <Square className="w-3 h-3" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 도구 빠른 탭 전환 바 ── */}
      {!isMinimized && (
        <div
          role="tablist"
          aria-label="퀵툴 도구"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200 overflow-x-auto no-scrollbar select-none"
        >
          {windowTools.map(t => {
            const TabIcon = getToolIcon(t.iconName);
            const isActive = t.id === activeToolId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`quickdock-tab-${t.id}`}
                aria-selected={isActive}
                aria-controls={`quickdock-panel-${t.id}`}
                onClick={() => onSelectTool(t.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title={t.title}
              >
                <TabIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{t.shortTitle}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 개별 도구 뷰 (접어도 언마운트하지 않음) ──
          본문 높이는 창 위치 아래 남은 공간까지만 (이전: 70vh 고정이라 창을 아래에 두면 하단 버튼이 화면 밖으로 잘림) */}
      <div
        ref={bodyRef}
        style={isMinimized ? undefined : { maxHeight: `${bodyMaxHeight}px` }}
        className={isMinimized ? 'hidden' : 'overflow-y-auto bg-white'}
      >
        {renderedIds.map(id => (
          <div
            key={`${id}-${resetNonce}`}
            role="tabpanel"
            id={`quickdock-panel-${id}`}
            aria-labelledby={`quickdock-tab-${id}`}
            hidden={id !== activeToolId}
          >
            {renderTool(id, id === activeToolId && !isMinimized)}
          </div>
        ))}
      </div>
    </div>
  );
}
