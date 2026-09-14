import React from 'react';
import { 
  X, Check, RotateCcw, Settings2, Calculator, Percent, Coins, 
  TrendingDown, Users, Scale, ShieldAlert, Landmark, BookOpen, 
  CreditCard, FileText, Send, Sparkles, Building2 
} from 'lucide-react';
import { QuickToolId, ToolCategory } from './types';
import { ALL_QUICK_TOOLS, DEFAULT_ENABLED_TOOL_IDS, CATEGORY_LABELS } from './defaultTools';

interface ToolCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  enabledToolIds: QuickToolId[];
  onToggleTool: (id: QuickToolId) => void;
  onResetToDefault: () => void;
}

// 아이콘 맵
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

export default function ToolCustomizerModal({
  isOpen,
  onClose,
  enabledToolIds,
  onToggleTool,
  onResetToDefault,
}: ToolCustomizerModalProps) {
  if (!isOpen) return null;

  const categories: ToolCategory[] = ['calculator', 'standards', 'workflow'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                리걸 퀵툴 기능 관리 & 커스텀
                <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {enabledToolIds.length}개 활성
                </span>
              </h3>
              <p className="text-xs text-slate-400">자주 쓰는 실무 계산기 및 기준표만 골라서 퀵 독에 담아보세요.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 도구 목록 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {categories.map(cat => {
            const tools = ALL_QUICK_TOOLS.filter(t => t.category === cat);
            return (
              <div key={cat} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    {CATEGORY_LABELS[cat]}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {tools.filter(t => enabledToolIds.includes(t.id)).length} / {tools.length}개 선택
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tools.map(tool => {
                    const isEnabled = enabledToolIds.includes(tool.id);
                    const IconComponent = ICON_MAP[tool.iconName] || Calculator;

                    return (
                      <div
                        key={tool.id}
                        onClick={() => onToggleTool(tool.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 text-left ${
                          isEnabled
                            ? 'bg-blue-50/50 border-blue-300/80 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200/80 opacity-60 hover:opacity-100 hover:bg-slate-50'
                        }`}
                      >
                        {/* 체크박스 */}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isEnabled ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'
                        }`}>
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        {/* 아이콘 */}
                        <div className={`w-7 h-7 rounded-lg ${tool.colorClass.bg} ${tool.colorClass.text} flex items-center justify-center shrink-0`}>
                          <IconComponent className="w-4 h-4" />
                        </div>

                        {/* 텍스트 */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 leading-tight truncate">
                              {tool.title}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.2 rounded shrink-0">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                            {tool.subtitle}
                          </p>
                        </div>
                      </div>
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
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본 구성으로 복원</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer press-scale active:scale-95"
          >
            설정 완료 ({enabledToolIds.length}개 저장)
          </button>
        </div>
      </div>
    </div>
  );
}
