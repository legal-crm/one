import React, { useEffect, useRef } from 'react';
import { X, Check, RotateCcw, Settings2, Eye, EyeOff, Minimize2 } from 'lucide-react';
import { QuickToolId, ToolCategory } from './types';
import { ALL_QUICK_TOOLS, CATEGORY_LABELS } from './defaultTools';
import { getToolIcon } from './toolIcons';

type VisibilityMode = 'normal' | 'minimized' | 'hidden';

interface ToolCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  enabledToolIds: QuickToolId[];
  onToggleTool: (id: QuickToolId) => void;
  onResetToDefault: () => void;
  visibilityMode?: VisibilityMode;
  onSetVisibility?: (mode: VisibilityMode) => void;
}

const CATEGORIES: ToolCategory[] = ['calculator', 'standards', 'workflow'];

const VISIBILITY_OPTIONS: { mode: VisibilityMode; label: string; desc: string; Icon: React.ElementType; iconClass: string }[] = [
  { mode: 'normal', label: '일반 표시', desc: '버튼 상시 노출', Icon: Eye, iconClass: 'text-blue-600' },
  { mode: 'minimized', label: '가장자리 접기', desc: '미니 탭으로 축소', Icon: Minimize2, iconClass: 'text-amber-600' },
  { mode: 'hidden', label: '완전 숨김', desc: '우측 하단 버튼으로 복원', Icon: EyeOff, iconClass: 'text-rose-600' },
];

/** 훅 순서 규칙: 닫혀 있으면 훅을 쓰는 본문을 아예 렌더하지 않는다 */
export default function ToolCustomizerModal(props: ToolCustomizerModalProps) {
  if (!props.isOpen) return null;
  return <ToolCustomizerModalInner {...props} />;
}

function ToolCustomizerModalInner({
  onClose,
  enabledToolIds,
  onToggleTool,
  onResetToDefault,
  visibilityMode = 'normal',
  onSetVisibility,
}: ToolCustomizerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 부모가 렌더마다 새 onClose를 넘겨도 포커스 효과가 다시 돌지 않도록 ref로 보관
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 열릴 때 대화상자로 포커스, 닫힐 때 원래 위치로 복귀. Esc로 닫기
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickdock-customizer-title"
        tabIndex={-1}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] focus:outline-none"
      >
        {/* 헤더 */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Settings2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="quickdock-customizer-title" className="font-bold text-base text-white flex items-center gap-1.5">
                리걸 퀵툴 기능 관리
                <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-mono font-bold">
                  {enabledToolIds.length}개 활성
                </span>
              </h3>
              <p className="text-xs text-slate-400">자주 쓰는 계산기와 기준표만 골라 퀵 독에 담으세요. 꺼진 도구도 메뉴 검색으로 바로 열 수 있습니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. 화면 표시 모드 제어 */}
          {onSetVisibility && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  퀵툴 화면 표시 설정
                </span>
                <span className="text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">
                  단축키: Alt + Q
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs" role="radiogroup" aria-label="퀵툴 화면 표시 방식">
                {VISIBILITY_OPTIONS.map(({ mode, label, desc, Icon, iconClass }) => {
                  const selected = visibilityMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSetVisibility(mode)}
                      className={`py-2 px-2 rounded-xl font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer border press-scale ${
                        selected
                          ? 'bg-white text-blue-700 shadow-xs border-blue-500'
                          : 'bg-white/60 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${iconClass}`} aria-hidden="true" />
                      <span className="text-xs whitespace-nowrap">{label}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. 도구 추가/삭제 스위치 목록 */}
          {CATEGORIES.map(cat => {
            const tools = ALL_QUICK_TOOLS.filter(t => t.category === cat);
            return (
              <div key={cat} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" aria-hidden="true" />
                    {CATEGORY_LABELS[cat]}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {tools.filter(t => enabledToolIds.includes(t.id)).length} / {tools.length}개 선택
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tools.map(tool => {
                    const isEnabled = enabledToolIds.includes(tool.id);
                    const IconComponent = getToolIcon(tool.iconName);

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={() => onToggleTool(tool.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 text-left press-scale focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isEnabled
                            ? 'bg-blue-50/50 border-blue-300/80 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        {/* 체크 표시 */}
                        <span
                          aria-hidden="true"
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isEnabled ? 'bg-blue-600 text-white' : 'border border-slate-400 bg-white'
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>

                        {/* 아이콘 */}
                        <span
                          aria-hidden="true"
                          className={`w-7 h-7 rounded-lg ${tool.colorClass.bg} ${tool.colorClass.text} flex items-center justify-center shrink-0 ${isEnabled ? '' : 'opacity-70'}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </span>

                        {/* 텍스트 */}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`font-bold text-xs leading-tight truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                              {tool.title}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded shrink-0">
                                {tool.badge}
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                            {tool.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>기본 구성으로 복원</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer press-scale whitespace-nowrap"
          >
            설정 완료 ({enabledToolIds.length}개)
          </button>
        </div>
      </div>
    </div>
  );
}
