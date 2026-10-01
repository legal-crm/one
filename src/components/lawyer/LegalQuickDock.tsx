import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, X, Settings2, RotateCcw, Move, EyeOff, Minimize2, Calculator, Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { QuickToolId, QuickToolMeta, ToolCategory } from './quickdock/types';
import {
  ALL_QUICK_TOOLS, DEFAULT_ENABLED_TOOL_IDS, LEGACY_TOOL_IDS, CATEGORY_LABELS, matchesToolQuery,
} from './quickdock/defaultTools';
import { getToolIcon } from './quickdock/toolIcons';
import { useDraggableDock } from './quickdock/useDraggableDock';
import ToolCustomizerModal from './quickdock/ToolCustomizerModal';
import FloatingToolWindow from './quickdock/FloatingToolWindow';

interface LegalQuickDockProps {
  onOpenAlimtok?: () => void;
}

export type DockVisibilityMode = 'normal' | 'minimized' | 'hidden';

const STORAGE_TOOLS_KEY = 'legal_dock_enabled_tools_v4';
/** 사용자가 이미 본 도구 목록 — 새로 추가된 기본 도구를 한 번만 자동으로 켜기 위해 저장 */
const STORAGE_KNOWN_KEY = 'legal_dock_known_tools_v1';
const STORAGE_VISIBILITY_KEY = 'legal_dock_visibility_v1';

const CATEGORY_ORDER: ToolCategory[] = ['calculator', 'standards', 'workflow'];

function persistEnabledTools(ids: QuickToolId[]) {
  try {
    localStorage.setItem(STORAGE_TOOLS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export default function LegalQuickDock({ onOpenAlimtok }: LegalQuickDockProps) {
  // 드래그 훅
  const {
    position,
    isDragging,
    wasDragged,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetPosition,
  } = useDraggableDock();

  // 상태 관리
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState<QuickToolId | null>(null);
  /**
   * 메뉴에서 도구를 고를 때마다 1씩 증가 → 접혀 있던 도구 창을 다시 펼친다.
   * Esc가 창을 닫지 않고 접게 바뀌어, 접힌 창에서 같은 도구를 다시 골라도 펼쳐져야 한다.
   */
  const [windowOpenSignal, setWindowOpenSignal] = useState(0);
  const [enabledToolIds, setEnabledToolIds] = useState<QuickToolId[]>(DEFAULT_ENABLED_TOOL_IDS);
  const [visibilityMode, setVisibilityMode] = useState<DockVisibilityMode>('normal');
  const [query, setQuery] = useState('');
  const visibilityRef = useRef<DockVisibilityMode>('normal');
  visibilityRef.current = visibilityMode;
  const dockRef = useRef<HTMLDivElement>(null);
  const dockBtnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** 가시성 변경 + 저장. 숨기거나 접으면 열린 도구 창·메뉴도 닫음 */
  const applyVisibility = (mode: DockVisibilityMode) => {
    setVisibilityMode(mode);
    setIsMenuOpen(false);
    if (mode !== 'normal') setActiveToolId(null);
    try {
      localStorage.setItem(STORAGE_VISIBILITY_KEY, mode);
    } catch {
      // ignore
    }
  };

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
        // 삭제·변경된 도구 ID는 버림 (개수 배지 부풀림 방지)
        const known = new Set(ALL_QUICK_TOOLS.map(t => t.id));
        let valid: QuickToolId[] = Array.isArray(parsed) ? parsed.filter((id: any) => known.has(id)) : [];

        // 저장된 구성이 있어도, 사용자가 처음 보는 새 기본 도구는 한 번 자동으로 추가
        let seen: string[] = LEGACY_TOOL_IDS;
        const seenRaw = localStorage.getItem(STORAGE_KNOWN_KEY);
        if (seenRaw) {
          const seenParsed = JSON.parse(seenRaw);
          if (Array.isArray(seenParsed)) seen = seenParsed;
        }
        const newlyAdded = ALL_QUICK_TOOLS
          .filter(t => t.defaultEnabled && !seen.includes(t.id) && !valid.includes(t.id))
          .map(t => t.id);
        if (valid.length > 0 && newlyAdded.length > 0) {
          valid = [...valid, ...newlyAdded];
          persistEnabledTools(valid);
        }
        if (valid.length > 0) {
          setEnabledToolIds(valid);
        }
      }
      localStorage.setItem(STORAGE_KNOWN_KEY, JSON.stringify(ALL_QUICK_TOOLS.map(t => t.id)));
    } catch {
      // ignore
    }
  }, []);

  // 전역 단축키 Alt + Q 리스너 (기능 유지)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // AltGr(=Ctrl+Alt, 유럽 자판 '@' 입력)·Meta 조합·키 반복은 무시
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
      if (e.code !== 'KeyQ' && e.key !== 'q' && e.key !== 'Q') return;
      e.preventDefault();
      const next = visibilityRef.current === 'hidden' ? 'normal' : 'hidden';
      applyVisibility(next);
      if (next === 'hidden') {
        toast.info('퀵툴이 숨겨졌습니다. (Alt+Q로 다시 표시)');
      } else {
        toast.success('퀵툴이 다시 표시되었습니다.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 메뉴가 열리면 검색어 초기화 + (마우스 환경에서만) 검색창 포커스
  useEffect(() => {
    if (!isMenuOpen) return;
    setQuery('');
    const finePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (finePointer) {
      const raf = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isMenuOpen]);

  // 메뉴 바깥을 누르면 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  // 가시성 모드 변경 핸들러
  const handleSetVisibility = (mode: DockVisibilityMode) => {
    applyVisibility(mode);
    if (mode === 'hidden') {
      toast.info('퀵툴이 숨겨졌습니다. (우측 하단 아이콘으로 언제든 켤 수 있습니다)');
    } else if (mode === 'minimized') {
      toast.info('퀵툴이 화면 가장자리로 접혔습니다. 탭을 클릭하여 펼치세요.');
    } else {
      toast.success('퀵툴이 활성화되었습니다.');
    }
  };

  // 도구 토글 (추가/삭제)
  const handleToggleTool = (id: QuickToolId) => {
    if (enabledToolIds.includes(id) && enabledToolIds.length <= 1) {
      toast.warning('최소 1개 이상의 도구가 활성화되어 있어야 합니다.');
      return;
    }
    const next = enabledToolIds.includes(id)
      ? enabledToolIds.filter(item => item !== id)
      : [...enabledToolIds, id];
    setEnabledToolIds(next);
    persistEnabledTools(next);
    if (!next.includes(id) && activeToolId === id) setActiveToolId(null);
  };

  // 기본 도구 구성으로 복원
  const handleResetToDefault = () => {
    setEnabledToolIds(DEFAULT_ENABLED_TOOL_IDS);
    persistEnabledTools(DEFAULT_ENABLED_TOOL_IDS);
    if (activeToolId && !DEFAULT_ENABLED_TOOL_IDS.includes(activeToolId)) setActiveToolId(null);
    toast.success('퀵툴 구성이 기본 설정으로 복원되었습니다.');
  };

  // 도구 실행 핸들러 (꺼져 있는 도구를 검색으로 고르면 목록에 추가하고 연다)
  const handleSelectTool = (id: QuickToolId) => {
    const targetTool = ALL_QUICK_TOOLS.find(t => t.id === id);
    if (!targetTool) return;

    if (!enabledToolIds.includes(id)) {
      const next = [...enabledToolIds, id];
      setEnabledToolIds(next);
      persistEnabledTools(next);
      toast.success(`퀵툴 목록에 추가했습니다: ${targetTool.title}`);
    }

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

    // 작업형 툴은 Non-modal 플로팅 창으로 열기 (접혀 있으면 펼침)
    setActiveToolId(id);
    setWindowOpenSignal(n => n + 1);
    setIsMenuOpen(false);
  };

  // 도크 버튼 클릭 (드래그가 아닐 때만 토글)
  // 키보드(Enter/Space)로 생긴 click은 detail이 0 → 직전 드래그 여부와 무관하게 연다.
  // 마우스·터치 click은 클릭 시점의 드래그 여부를 훅의 ref에서 직접 읽는다.
  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0 && wasDragged()) return;
    setIsMenuOpen(prev => !prev);
  };

  // 현재 활성화된 도구 메타 목록
  const activeTools = ALL_QUICK_TOOLS.filter(t => enabledToolIds.includes(t.id));
  // 독 배지에 쓰는 도구 수 — 알림톡 같은 바로가기 동작(isActionOnly)은 도구가 아니므로 뺀다
  // (이전: enabledToolIds.length를 그대로 써서 바로가기까지 세었음)
  const enabledToolCount = activeTools.filter(t => !t.isActionOnly).length;
  const trimmedQuery = query.trim();
  // 검색 시 꺼진 도구까지 찾고, 켜진 도구를 먼저 보여준다 (정렬은 안정 정렬 → 분류 순서 유지)
  const searchResults: QuickToolMeta[] = trimmedQuery
    ? ALL_QUICK_TOOLS
        .filter(t => matchesToolQuery(t, trimmedQuery))
        .sort((a, b) => Number(enabledToolIds.includes(b.id)) - Number(enabledToolIds.includes(a.id)))
    : [];

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const first = trimmedQuery ? searchResults[0] : activeTools[0];
      if (first) {
        e.preventDefault();
        handleSelectTool(first.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else setIsMenuOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>('button[data-tool-item]')?.focus();
    }
  };

  // 목록에서 화살표로 이동, Esc로 닫기
  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsMenuOpen(false);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-tool-item]') || []);
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') {
      items[Math.min(items.length - 1, idx + 1)]?.focus();
    } else if (idx === 0) {
      searchRef.current?.focus();
    } else {
      items[idx - 1]?.focus();
    }
  };

  // 메뉴 팝오버 앵커링 계산 (화면 위/아래 스마트 정렬 + 좌우는 화면 안으로 보정)
  // 이전: 도크가 x < 320이면 왼쪽 정렬 → 375px 화면에서 메뉴 오른쪽이 화면 밖으로 잘림
  const isUpperHalf = position ? position.y < 380 : false;
  const isDockOnLeft = position ? position.x < window.innerWidth / 2 : false;
  const menuWidth = Math.min(320, window.innerWidth - 24);
  const dockWidth = dockBtnRef.current?.offsetWidth ?? 120;
  const menuViewportLeft = position
    ? Math.min(
        Math.max(12, position.x + menuWidth <= window.innerWidth - 12 ? position.x : position.x + dockWidth - menuWidth),
        window.innerWidth - menuWidth - 12,
      )
    : 12;
  const menuLeftOffset = position ? menuViewportLeft - position.x : 0;

  const renderToolItem = (tool: QuickToolMeta) => {
    const IconComponent = getToolIcon(tool.iconName);
    const isEnabled = enabledToolIds.includes(tool.id);
    return (
      <button
        key={tool.id}
        type="button"
        data-tool-item
        onClick={() => handleSelectTool(tool.id)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 focus:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:text-white transition-all cursor-pointer group press-scale"
      >
        <div className={`w-7 h-7 rounded-lg ${tool.colorClass.bg} ${tool.colorClass.text} flex items-center justify-center shrink-0 ${tool.colorClass.hoverBg} group-hover:text-white transition-colors`}>
          <IconComponent className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-slate-200 group-hover:text-white leading-tight truncate">
              {tool.title}
            </p>
            {!isEnabled ? (
              <span className="text-[9px] bg-slate-700 text-slate-200 px-1 py-0.5 rounded shrink-0" title="선택하면 퀵툴 목록에 추가하고 엽니다">꺼짐 · 추가</span>
            ) : tool.badge ? (
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded shrink-0">
                {tool.badge}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-400 leading-tight truncate">
            {tool.subtitle}
          </p>
        </div>
      </button>
    );
  };

  return (
    <>
      {/* ── 1. 완전 숨김(hidden) 상태일 때: 우측 하단 미니 복원 트리거 ──
          z-40: 어드민 모달(z-50) 아래. 모바일(lg 미만)은 하단 탭바(--mobile-gnb-height) 위로 올린다
          (이전: bottom-4라 모바일 하단 탭의 '더보기' 버튼을 덮어 누르기 어려웠음) */}
      {visibilityMode === 'hidden' && (
        <button
          type="button"
          onClick={() => handleSetVisibility('normal')}
          className="fixed bottom-[calc(0.75rem+var(--mobile-gnb-height))] lg:bottom-4 right-4 z-40 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700 shadow-lg transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5 text-xs font-bold select-none group"
          title="실무 퀵툴 다시 켜기"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">퀵툴 켜기</span>
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
          // z-40: 어드민 인라인 모달(z-50)이 항상 위에 오도록 (이전: 같은 z-50에 DOM 뒤쪽이라 모달 위에 떠서 눌림)
          className="z-40 select-none animate-in fade-in slide-in-from-right-2 duration-200"
        >
          <button
            type="button"
            onClick={() => handleSetVisibility('normal')}
            className={`flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-[#2563EB] text-white shadow-2xl border border-blue-400/40 cursor-pointer transition-all hover:brightness-110 active:scale-95 ${
              isDockOnLeft
                ? 'rounded-r-2xl border-l-0 pl-3 hover:pl-4'
                : 'rounded-l-2xl border-r-0 pr-3 hover:pr-4'
            }`}
            title="클릭하여 퀵툴 펼치기"
          >
            <div className="relative">
              <Calculator className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-xs font-extrabold tracking-tight">실무 퀵툴</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono font-bold">
              {enabledToolCount}
            </span>
          </button>
        </div>
      )}

      {/* ── 3. 일반(normal) 플로팅 도크 버튼 & 메뉴 컨테이너 ── */}
      {visibilityMode === 'normal' && position && (
        <div
          ref={dockRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            touchAction: 'none',
          }}
          // z-40: 독 버튼·메뉴가 어드민 인라인 모달(z-50) 아래로 가도록 (이전: 같은 z-50에 DOM 뒤쪽이라 모달 위에 떠서 눌림)
          className="z-40 select-none"
        >
          {/* ── 퀵툴 메뉴 팝오버 ── */}
          {isMenuOpen && (
            <div
              role="dialog"
              aria-label="실무 퀵툴 메뉴"
              style={{ left: `${menuLeftOffset}px`, width: `${menuWidth}px` }}
              className={`absolute ${
                isUpperHalf ? 'top-full mt-2' : 'bottom-full mb-2'
              } bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150 text-slate-100`}
            >
              {/* 팝오버 헤더 */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  리걸 실무 퀵툴
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetVisibility('minimized')}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="가장자리로 얇게 접기"
                    aria-label="가장자리로 접기"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetVisibility('hidden')}
                    className="p-1 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="퀵툴 끄기 / 숨기기"
                    aria-label="퀵툴 숨기기"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsCustomizerOpen(true);
                    }}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="도구 추가 / 삭제 및 설정"
                    aria-label="도구 추가·삭제 설정"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer text-slate-400"
                    title="메뉴 닫기"
                    aria-label="메뉴 닫기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 도구 검색 (꺼진 도구 포함) */}
              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="도구 검색 (예: 보정, 청산, 압류)"
                  aria-label="퀵툴 도구 검색"
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder:text-slate-400 select-text focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                />
              </div>

              {/* 도구 목록 */}
              <div
                ref={listRef}
                onKeyDown={handleListKeyDown}
                className="flex flex-col gap-0.5 mt-2 max-h-[55vh] overflow-y-auto pr-0.5"
              >
                {trimmedQuery ? (
                  searchResults.length > 0 ? (
                    searchResults.map(renderToolItem)
                  ) : (
                    <div className="px-3 py-5 text-center space-y-2">
                      <Search className="w-5 h-5 mx-auto text-slate-400" aria-hidden="true" />
                      <p className="text-xs font-bold text-slate-200">‘{trimmedQuery}’와 일치하는 도구가 없습니다.</p>
                      <p className="text-[11px] text-slate-400">다른 검색어를 쓰거나 전체 도구 목록에서 찾아보세요.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsCustomizerOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer press-scale whitespace-nowrap"
                      >
                        <Settings2 className="w-3 h-3" aria-hidden="true" />
                        전체 도구 보기
                      </button>
                    </div>
                  )
                ) : (
                  CATEGORY_ORDER.map(cat => {
                    const tools = activeTools.filter(t => t.category === cat);
                    if (tools.length === 0) return null;
                    return (
                      <div key={cat} className="pb-1">
                        <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold text-slate-400 tracking-wide">
                          {CATEGORY_LABELS[cat]}
                        </p>
                        {tools.map(renderToolItem)}
                      </div>
                    );
                  })
                )}
              </div>

              {/* 하단 관리 바 (기능 추가/삭제 바로가기, 숨기기 & 위치 복원) */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCustomizerOpen(true);
                  }}
                  className="flex items-center gap-1 text-blue-300 hover:text-blue-200 font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings2 className="w-3 h-3" aria-hidden="true" />
                  <span>기능 추가 / 삭제 ({enabledToolIds.length})</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetVisibility('hidden')}
                    className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                    title="퀵툴 끄기"
                  >
                    <EyeOff className="w-3 h-3" aria-hidden="true" />
                    <span>숨기기</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetPosition}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                    title="버튼을 기본 위치(우측 하단)로 이동"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>위치 초기화</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 드래그 가능한 메인 플로팅 독 버튼 ── */}
          <button
            ref={dockBtnRef}
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={handleButtonClick}
            aria-label={`실무 퀵툴 메뉴 (도구 ${enabledToolCount}개)`}
            aria-expanded={isMenuOpen}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full font-bold shadow-2xl transition-all press-scale cursor-grab active:cursor-grabbing ${
              isDragging
                ? 'scale-105 ring-2 ring-blue-400 shadow-blue-500/30'
                : isMenuOpen
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] text-white hover:shadow-blue-500/30 shadow-lg'
            }`}
            title="드래그하여 원하는 위치로 이동하세요 (클릭 시 메뉴 열기)"
          >
            {/* 드래그 힌트 아이콘 */}
            <Move className="w-3 h-3 text-slate-300/80 shrink-0" aria-hidden="true" />

            <div className="relative">
              <Calculator className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1E3A5F] animate-pulse" />
            </div>
            <span className="text-xs tracking-tight font-black hidden sm:inline">실무 퀵툴</span>
            <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono font-extrabold text-white">
              {enabledToolCount}
            </span>
          </button>
        </div>
      )}

      {/* ── Non-modal 플로팅 윈도우 (배경 사이트와 동시 작업 가능) ── */}
      <FloatingToolWindow
        activeToolId={visibilityMode === 'normal' ? activeToolId : null}
        enabledToolIds={enabledToolIds}
        onSelectTool={setActiveToolId}
        onClose={() => setActiveToolId(null)}
        dockPosition={position}
        openSignal={windowOpenSignal}
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
