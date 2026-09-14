import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, X, Settings2, RotateCcw, Move, Eye, EyeOff, Minimize2,
  Calculator, Percent, Coins, TrendingDown, Users, Scale, 
  ShieldAlert, Landmark, BookOpen, CreditCard, FileText, Send, Building2 
} from 'lucide-react';
import { toast } from 'sonner';

import { QuickToolId } from './quickdock/types';
import { ALL_QUICK_TOOLS, DEFAULT_ENABLED_TOOL_IDS } from './quickdock/defaultTools';
import { useDraggableDock } from './quickdock/useDraggableDock';
import ToolCustomizerModal from './quickdock/ToolCustomizerModal';
import FloatingToolWindow from './quickdock/FloatingToolWindow';

interface LegalQuickDockProps {
  onOpenAlimtok?: () => void;
}

export type DockVisibilityMode = 'normal' | 'minimized' | 'hidden';

const STORAGE_TOOLS_KEY = 'legal_dock_enabled_tools_v3';
const STORAGE_VISIBILITY_KEY = 'legal_dock_visibility_v1';

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
};

export default function LegalQuickDock({ onOpenAlimtok }: LegalQuickDockProps) {
  // 드래그 훅
  const {
    position,
    isDragging,
    hasMoved,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetPosition,
  } = useDraggableDock();

  // 상태 관리
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState<QuickToolId | null>(null);
  const [enabledToolIds, setEnabledToolIds] = useState<QuickToolId[]>(DEFAULT_ENABLED_TOOL_IDS);
  const [visibilityMode, setVisibilityMode] = useState<DockVisibilityMode>('normal');

  // 로컬스토리지에서 가시성 및 도구 목록 불러오기
  useEffect(() => {
    try {
      const savedVis = localStorage.getItem(STORAGE_VISIBILITY_KEY);
      if (savedVis === 'normal' || savedVis === 'minimized' || savedVis === 'hidden') {
        setVisibilityMode(savedVis);
      }

      const saved = localStorage.getItem(STORAGE_TOOLS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEnabledToolIds(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 전역 단축키 Alt + Q 리스너 (퀵툴 토글)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) {
        e.preventDefault();
        setVisibilityMode(prev => {
          const next = prev === 'hidden' ? 'normal' : 'hidden';
          try {
            localStorage.setItem(STORAGE_VISIBILITY_KEY, next);
          } catch {
            // ignore
          }
          if (next === 'hidden') {
            toast.info('퀵툴이 숨겨졌습니다. (Alt+Q 또는 우측하단 아이콘으로 복원)');
          } else {
            toast.success('퀵툴이 다시 표시되었습니다.');
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 가시성 모드 변경 핸들러
  const handleSetVisibility = (mode: DockVisibilityMode) => {
    setVisibilityMode(mode);
    setIsMenuOpen(false);
    try {
      localStorage.setItem(STORAGE_VISIBILITY_KEY, mode);
    } catch {
      // ignore
    }
    if (mode === 'hidden') {
      toast.info('퀵툴이 숨겨졌습니다. (단축키 Alt+Q 로 언제든 켤 수 있습니다)');
    } else if (mode === 'minimized') {
      toast.info('퀵툴이 화면 가장자리로 접혔습니다. 탭을 클릭하여 펼치세요.');
    } else {
      toast.success('퀵툴이 활성화되었습니다.');
    }
  };

  // 도구 토글 (추가/삭제)
  const handleToggleTool = (id: QuickToolId) => {
    setEnabledToolIds(prev => {
      let next: QuickToolId[];
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast.warning('최소 1개 이상의 도구가 활성화되어 있어야 합니다.');
          return prev;
        }
        next = prev.filter(item => item !== id);
      } else {
        next = [...prev, id];
      }
      try {
        localStorage.setItem(STORAGE_TOOLS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 기본 도구 구성으로 복원
  const handleResetToDefault = () => {
    setEnabledToolIds(DEFAULT_ENABLED_TOOL_IDS);
    try {
      localStorage.setItem(STORAGE_TOOLS_KEY, JSON.stringify(DEFAULT_ENABLED_TOOL_IDS));
    } catch {
      // ignore
    }
    toast.success('퀵툴 구성이 기본 설정으로 복원되었습니다.');
  };

  // 도구 실행 핸들러
  const handleSelectTool = (id: QuickToolId) => {
    const targetTool = ALL_QUICK_TOOLS.find(t => t.id === id);
    if (!targetTool) return;

    // 모바일 알림톡 전송 등 액션형 도구
    if (targetTool.isActionOnly) {
      setIsMenuOpen(false);
      if (id === 'alimtok') {
        if (onOpenAlimtok) {
          onOpenAlimtok();
        } else {
          toast.info('알림톡 발송 센터로 이동합니다.');
        }
      }
      return;
    }

    // 작업형 툴은 Non-modal 플로팅 창으로 열기
    setActiveToolId(id);
    setIsMenuOpen(false);
  };

  // 도크 버튼 클릭 (드래그가 아닐 때만 토글)
  const handleButtonClick = () => {
    if (hasMoved) return;
    setIsMenuOpen(prev => !prev);
  };

  // 현재 활성화된 도구 메타 목록
  const activeTools = ALL_QUICK_TOOLS.filter(t => enabledToolIds.includes(t.id));

  // 메뉴 팝오버 앵커링 계산 (화면 위/아래 스마트 정렬)
  const isUpperHalf = position ? position.y < 380 : false;
  const isLeftHalf = position ? position.x < 320 : false;
  const isDockOnLeft = position ? position.x < window.innerWidth / 2 : false;

  return (
    <>
      {/* ── 1. 완전 숨김(hidden) 상태일 때: 우측 하단 미니 복원 트리거 ── */}
      {visibilityMode === 'hidden' && (
        <button
          onClick={() => handleSetVisibility('normal')}
          className="fixed bottom-4 right-4 z-40 px-2.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700 shadow-lg transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5 text-xs font-bold select-none group"
          title="실무 퀵툴 다시 켜기 (단축키: Alt + Q)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">퀵툴 켜기</span>
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">Alt+Q</span>
        </button>
      )}

      {/* ── 2. 가장자리 접기(minimized) 상태일 때: 화면 벽에 밀착된 슬림 탭 ── */}
      {visibilityMode === 'minimized' && (
        <div
          style={{
            position: 'fixed',
            top: `${position ? Math.min(position.y, window.innerHeight - 60) : window.innerHeight - 80}px`,
            [isDockOnLeft ? 'left' : 'right']: 0,
          }}
          className="z-50 select-none animate-in fade-in slide-in-from-right-2 duration-200"
        >
          <button
            onClick={() => handleSetVisibility('normal')}
            className={`flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-[#2563EB] text-white shadow-2xl border border-blue-400/40 cursor-pointer transition-all hover:brightness-110 active:scale-95 ${
              isDockOnLeft
                ? 'rounded-r-2xl border-l-0 pl-3 hover:pl-4'
                : 'rounded-l-2xl border-r-0 pr-3 hover:pr-4'
            }`}
            title="클릭하여 퀵툴 펼치기"
          >
            <div className="relative">
              <Calculator className="w-3.5 h-3.5 text-amber-300" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-xs font-extrabold tracking-tight">실무 퀵툴</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono font-bold">
              {enabledToolIds.length}
            </span>
          </button>
        </div>
      )}

      {/* ── 3. 일반(normal) 플로팅 도크 버튼 & 메뉴 컨테이너 ── */}
      {visibilityMode === 'normal' && position && (
        <div
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            touchAction: 'none',
          }}
          className="z-50 select-none"
        >
          {/* ── 퀵툴 메뉴 팝오버 ── */}
          {isMenuOpen && (
            <div
              className={`absolute ${
                isUpperHalf ? 'top-full mt-2' : 'bottom-full mb-2'
              } ${
                isLeftHalf ? 'left-0' : 'right-0'
              } bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 w-76 animate-in fade-in zoom-in-95 duration-150 text-slate-100`}
            >
              {/* 팝오버 헤더 */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  리걸 실무 퀵툴 (Quick Dock)
                </span>
                <div className="flex items-center gap-0.5">
                  {/* 가장자리 접기 */}
                  <button
                    onClick={() => handleSetVisibility('minimized')}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="가장자리로 얇게 접기"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                  {/* 완전 숨기기 */}
                  <button
                    onClick={() => handleSetVisibility('hidden')}
                    className="p-1 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="퀵툴 끄기 / 숨기기 (단축키 Alt+Q)"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  {/* 설정 */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsCustomizerOpen(true);
                    }}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="도구 추가 / 삭제 및 설정"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {/* 닫기 */}
                  <button 
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="메뉴 닫기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 활성화된 도구 목록 */}
              <div className="flex flex-col gap-1 mt-2 max-h-[60vh] overflow-y-auto pr-0.5">
                {activeTools.map(tool => {
                  const IconComponent = ICON_MAP[tool.iconName] || Calculator;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleSelectTool(tool.id)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
                    >
                      <div className={`w-7 h-7 rounded-lg ${tool.colorClass.bg} ${tool.colorClass.text} flex items-center justify-center shrink-0 ${tool.colorClass.hoverBg} group-hover:text-white transition-colors`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-200 group-hover:text-white leading-tight truncate">
                            {tool.title}
                          </p>
                          {tool.badge && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded shrink-0">
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight truncate">
                          {tool.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 하단 관리 바 (기능 추가/삭제 바로가기, 숨기기 & 위치 복원) */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-1 text-[11px]">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCustomizerOpen(true);
                  }}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>기능 추가 / 삭제 ({enabledToolIds.length})</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSetVisibility('hidden')}
                    className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    title="퀵툴 끄기 (Alt+Q)"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>숨기기</span>
                  </button>

                  <button
                    onClick={resetPosition}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    title="버튼을 기본 위치(우측 하단)로 이동"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>초기화</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 드래그 가능한 메인 플로팅 독 버튼 ── */}
          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={handleButtonClick}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full font-bold shadow-2xl transition-all press-scale cursor-grab active:cursor-grabbing ${
              isDragging
                ? 'scale-105 ring-2 ring-blue-400 shadow-blue-500/30'
                : isMenuOpen
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] text-white hover:shadow-blue-500/30 shadow-lg'
            }`}
            title="드래그하여 원하는 위치로 이동하세요 (클릭 시 메뉴 열기 / Alt+Q 로 숨기기)"
          >
            {/* 드래그 힌트 아이콘 */}
            <Move className="w-3 h-3 text-slate-400/80 shrink-0" />

            <div className="relative">
              <Calculator className="w-4 h-4 text-amber-300" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1E3A5F] animate-pulse" />
            </div>
            <span className="text-xs tracking-tight font-black hidden sm:inline">실무 퀵툴</span>
            <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono font-extrabold text-white">
              {enabledToolIds.length}
            </span>
          </button>
        </div>
      )}

      {/* ── Non-modal 플로팅 윈도우 (배경 사이트와 100% 동시 작업 가능) ── */}
      <FloatingToolWindow
        activeToolId={activeToolId}
        enabledToolIds={enabledToolIds}
        onSelectTool={setActiveToolId}
        onClose={() => setActiveToolId(null)}
        dockPosition={position}
      />

      {/* ── 퀵툴 기능 추가 / 삭제 커스텀 관리 모달 ── */}
      <ToolCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        enabledToolIds={enabledToolIds}
        onToggleTool={handleToggleTool}
        onResetToDefault={handleResetToDefault}
        visibilityMode={visibilityMode}
        onSetVisibility={handleSetVisibility}
      />
    </>
  );
}
