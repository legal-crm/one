import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Minus, Square, Move, 
  Calculator, Percent, Coins, TrendingDown, Users, 
  Scale, ShieldAlert, Landmark, BookOpen, CreditCard, FileText, Send, Building2,
  CalendarCheck, Contact, CheckSquare, Pin
} from 'lucide-react';
import { QuickToolId, Position } from './types';
import { ALL_QUICK_TOOLS } from './defaultTools';

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

interface FloatingToolWindowProps {
  activeToolId: QuickToolId | null;
  enabledToolIds: QuickToolId[];
  onSelectTool: (id: QuickToolId) => void;
  onClose: () => void;
  dockPosition: Position | null;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Calculator,
  Percent,
  Coins,
  TrendingDown,
  Users,
  Scale,
  ShieldAlert,
  Landmark,
  BookOpen,
  CreditCard,
  FileText,
  Send,
  Building2,
  CalendarCheck,
  Contact,
  CheckSquare,
  Pin,
};

const WINDOW_STORAGE_KEY = 'legal_quick_window_pos_v2';
const PADDING = 12;
const WINDOW_WIDTH = 410; // 컴팩트 최적 너비

export default function FloatingToolWindow({
  activeToolId,
  enabledToolIds,
  onSelectTool,
  onClose,
  dockPosition,
}: FloatingToolWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [winPos, setWinPos] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // 초기 윈도우 위치 계산 (저장된 좌표 or 도크 인근 스마트 배치)
  useEffect(() => {
    if (!activeToolId) return;

    try {
      const saved = localStorage.getItem(WINDOW_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.min(Math.max(PADDING, parsed.x), window.innerWidth - WINDOW_WIDTH - PADDING);
          const clampedY = Math.min(Math.max(PADDING, parsed.y), window.innerHeight - 100);
          setWinPos({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch {
      // ignore
    }

    // 도크 인근 스마트 배치: 도크의 좌측 상단 또는 화면 안쪽
    const dockX = dockPosition?.x ?? (window.innerWidth - 180);
    const dockY = dockPosition?.y ?? (window.innerHeight - 80);

    let initialX = dockX - WINDOW_WIDTH + 60;
    let initialY = dockY - 480;

    // 화면 경계 안전 보정
    if (initialX < PADDING) initialX = PADDING;
    if (initialX + WINDOW_WIDTH > window.innerWidth - PADDING) {
      initialX = window.innerWidth - WINDOW_WIDTH - PADDING;
    }
    if (initialY < PADDING) initialY = PADDING;
    if (initialY > window.innerHeight - 200) {
      initialY = Math.max(PADDING, window.innerHeight - 520);
    }

    setWinPos({ x: initialX, y: initialY });
  }, [activeToolId, dockPosition]);

  // 창 리사이즈 시 화면 밖 방지
  useEffect(() => {
    const handleResize = () => {
      setWinPos(prev => {
        if (!prev) return prev;
        const clampedX = Math.min(Math.max(PADDING, prev.x), window.innerWidth - WINDOW_WIDTH - PADDING);
        const clampedY = Math.min(Math.max(PADDING, prev.y), window.innerHeight - 100);
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    const nextX = dragStartRef.current.initX + deltaX;
    const nextY = dragStartRef.current.initY + deltaY;

    // 뷰포트 클램프
    const clampedX = Math.min(Math.max(PADDING, nextX), window.innerWidth - WINDOW_WIDTH - PADDING);
    const clampedY = Math.min(Math.max(PADDING, nextY), window.innerHeight - 70);

    setWinPos({ x: clampedX, y: clampedY });
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

  if (!activeToolId || !winPos) return null;

  const currentTool = ALL_QUICK_TOOLS.find(t => t.id === activeToolId) || ALL_QUICK_TOOLS[0];
  const IconComponent = ICON_MAP[currentTool.iconName] || Calculator;

  // 활성화된 도구 탭 목록 (액션 전용 제외)
  const windowTools = ALL_QUICK_TOOLS.filter(
    t => enabledToolIds.includes(t.id) && !t.isActionOnly
  );

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: `${winPos.x}px`,
        top: `${winPos.y}px`,
        width: `${WINDOW_WIDTH}px`,
      }}
      className={`z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-300/90 overflow-hidden transition-shadow duration-200 select-none ${
        isDragging ? 'shadow-blue-500/20 ring-2 ring-blue-500/50' : 'shadow-2xl'
      }`}
    >
      {/* ── 윈도우 타이틀바 (드래그 핸들) ── */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between cursor-move select-none border-b border-slate-800 touch-none active:bg-slate-800"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center text-slate-400 hover:text-slate-200 cursor-grab active:cursor-grabbing">
            <Move className="w-3.5 h-3.5" />
          </div>
          <div className={`w-5 h-5 rounded-md ${currentTool.colorClass.bg} ${currentTool.colorClass.text} flex items-center justify-center shrink-0`}>
            <IconComponent className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="font-bold text-xs text-white truncate">
              {currentTool.title}
            </span>
            <span className="text-[10px] text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded font-medium shrink-0">
              플로팅 위젯
            </span>
          </div>
        </div>

        {/* 윈도우 컨트롤러 (최소화, 닫기) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title={isMinimized ? '창 펼치기' : '창 최소화 (접기)'}
          >
            {isMinimized ? <Square className="w-3 h-3" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 최소화되지 않았을 때만 본문 및 탭 노출 */}
      {!isMinimized && (
        <>
          {/* ── 도구 빠른 탭 전환 바 (작업 능률 극대화) ── */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200 overflow-x-auto no-scrollbar">
            {windowTools.map(t => {
              const TabIcon = ICON_MAP[t.iconName] || Calculator;
              const isActive = t.id === activeToolId;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTool(t.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title={t.title}
                >
                  <TabIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[90px]">{t.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* ── 개별 도구 뷰 렌더링 ── */}
          <div className="max-h-[70vh] overflow-y-auto bg-white">
            {activeToolId === 'calculator' && <CalculatorTool />}
            {activeToolId === 'median' && <MedianIncomeTool />}
            {activeToolId === 'extraExpense' && <ExtraExpenseTool />}
            {activeToolId === 'virtualAccount' && <VirtualAccountTool />}
            {activeToolId === 'rehabPayCalc' && <RehabPayCalcTool />}
            {activeToolId === 'liquidationCalc' && <LiquidationCalcTool />}
            {activeToolId === 'courtGuidelines' && <CourtGuidelinesTool />}
            {activeToolId === 'seizureLimits' && <SeizureLimitsTool />}
            {activeToolId === 'quickMemo' && <QuickMemoTool />}
            {activeToolId === 'interestCompare' && <InterestCompareTool />}
            {activeToolId === 'legalArticles' && <LegalArticlesTool />}
            {activeToolId === 'assetValuation' && <AssetValuationTool />}
            {activeToolId === 'koreanAge' && <KoreanAgeCalcTool />}
            {activeToolId === 'creditorSearch' && <CreditorSearchTool />}
            {activeToolId === 'docChecklist' && <DocumentChecklistTool />}
            {activeToolId === 'pinMemo' && <FloatingPinMemoTool />}
          </div>
        </>
      )}
    </div>
  );
}
