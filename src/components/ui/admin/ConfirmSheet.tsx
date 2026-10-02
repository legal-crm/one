import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

export interface SummaryItem {
  label: string;
  value: React.ReactNode;
}

export interface AutoActionItem {
  id: string;
  label: string;
  subtext?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  tone?: 'brand' | 'danger' | 'success';
  summaryItems?: SummaryItem[];
  notifyClient?: boolean;
  onNotifyClientChange?: (checked: boolean) => void;
  notifyPreview?: string;
  autoActions?: AutoActionItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * 어드민 단계 완료 및 상태 확정 확인 시트 (기획서 3.4 & 5.4)
 * - 단계 결과 요약
 * - 의뢰인 알림 발송 옵션 및 미리보기
 * - 후속 자동 할 일/일정 생성 체크리스트
 */
export function ConfirmSheet({
  isOpen,
  onClose,
  title,
  description,
  tone = 'brand',
  summaryItems = [],
  notifyClient = true,
  onNotifyClientChange,
  notifyPreview,
  autoActions = [],
  confirmLabel = '확인 및 진행',
  cancelLabel = '취소',
  isConfirming = false,
  onConfirm,
}: ConfirmSheetProps) {
  // ESC 키 닫기 지원
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirming) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isConfirming, onClose]);

  if (!isOpen) return null;

  const toneBtnCls =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : 'bg-[#1E3A5F] hover:bg-[#163152] text-white';

  return (
    <div className="fixed inset-0 z-[var(--z-modal,100)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {tone === 'danger' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#1E3A5F] shrink-0" />
            )}
            <h2 id="confirm-sheet-title" className="text-[16px] font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px] leading-relaxed">
          {description && (
            <p className="text-slate-600">{description}</p>
          )}

          {/* 결과 요약 */}
          {summaryItems.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2">
              <p className="text-[12px] font-bold text-slate-700">진행 결과 요약</p>
              <div className="divide-y divide-slate-200/60 text-[12px]">
                {summaryItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 gap-2">
                    <span className="text-slate-500 shrink-0">{item.label}</span>
                    <span className="font-semibold text-slate-800 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 의뢰인 알림 옵션 */}
          {onNotifyClientChange && (
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyClient}
                  onChange={(e) => onNotifyClientChange(e.target.checked)}
                  className="rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]/40 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-slate-500" />
                  의뢰인에게 단계 진행 알림톡 발송
                </span>
              </label>
              {notifyClient && notifyPreview && (
                <div className="pl-6 text-[12px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-600 block mb-0.5">알림 문구 미리보기:</span>
                  {notifyPreview}
                </div>
              )}
            </div>
          )}

          {/* 후속 자동 생성 항목 체크리스트 */}
          {autoActions.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <p className="text-[12px] font-bold text-slate-700">자동 준비 항목 (선택)</p>
              <div className="space-y-2">
                {autoActions.map((action) => (
                  <label key={action.id} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={action.checked}
                      onChange={(e) => action.onChange(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]/40 cursor-pointer"
                    />
                    <div className="text-[12px]">
                      <span className="font-semibold text-slate-800 block">{action.label}</span>
                      {action.subtext && <span className="text-slate-500">{action.subtext}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-[13px] press-scale cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 min-h-[38px] rounded-xl font-bold text-[13px] shadow-sm press-scale cursor-pointer ${toneBtnCls} ${
              isConfirming ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
            }`}
          >
            {isConfirming ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
