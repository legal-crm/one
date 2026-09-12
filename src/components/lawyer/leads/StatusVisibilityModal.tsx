import React from 'react';
import { X, Check, EyeOff } from 'lucide-react';

interface StatusVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  allStatuses: string[];
  hiddenStatuses: string[];
  onToggleStatus: (status: string) => void;
  title?: string;
}

export default function StatusVisibilityModal({
  isOpen,
  onClose,
  allStatuses,
  hiddenStatuses,
  onToggleStatus,
  title = '상태 보기 설정'
}: StatusVisibilityModalProps) {
  if (!isOpen) return null;

  const handleSelectAll = () => {
    allStatuses.forEach(s => {
      if (hiddenStatuses.includes(s)) onToggleStatus(s);
    });
  };

  const handleDeselectAll = () => {
    allStatuses.forEach(s => {
      if (!hiddenStatuses.includes(s)) onToggleStatus(s);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm">
            <EyeOff className="text-slate-500 w-4 h-4" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 bg-blue-50/80 border-b border-blue-100 text-xs text-blue-900 leading-relaxed">
          <p className="font-bold">💡 체크 해제된 상태는 목록에서 숨겨집니다.</p>
          <p className="text-blue-700 text-[11px] mt-0.5">(단, 상단 필터에서 해당 상태를 직접 선택하면 즉시 표시됩니다.)</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer press-scale active:scale-[0.98]"
            >
              모두 보이기
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer press-scale active:scale-[0.98]"
            >
              모두 숨기기
            </button>
          </div>

          <div className="space-y-1.5 pt-1">
            {allStatuses.map(status => {
              const isHidden = hiddenStatuses.includes(status);
              return (
                <label
                  key={status}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isHidden
                      ? 'bg-slate-50 border-slate-200/60 text-slate-400'
                      : 'bg-white border-blue-200 text-slate-800 shadow-xs'
                  }`}
                >
                  <span className="text-xs font-bold">{status}</span>
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => onToggleStatus(status)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer press-scale active:scale-[0.98]"
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
}
