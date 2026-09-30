import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, HelpCircle, Trash2, X } from 'lucide-react';

export type DialogVariant = 'primary' | 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string; // 호환성 별칭
  cancelText?: string;
  cancelLabel?: string;  // 호환성 별칭
  variant?: DialogVariant;
}

export interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  variant?: DialogVariant;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog(): DialogContextType {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'prompt' | 'alert';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant: DialogVariant;
  placeholder?: string;
  inputValue?: string;
  resolve: (value: any) => void;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus prompt input on open
  useEffect(() => {
    if (dialogState?.isOpen && dialogState.type === 'prompt') {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [dialogState?.isOpen, dialogState?.type]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogState?.isOpen) return;
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setDialogState({
        isOpen: true,
        type: 'confirm',
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText || opts.confirmLabel || '확인',
        cancelText: opts.cancelText || opts.cancelLabel || '취소',
        variant: opts.variant || 'primary',
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      const opts: PromptOptions = typeof options === 'string' ? { message: options } : options;
      setPromptInput(opts.defaultValue || '');
      setDialogState({
        isOpen: true,
        type: 'prompt',
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText || '확인',
        cancelText: opts.cancelText || '취소',
        variant: 'primary',
        placeholder: opts.placeholder || '',
        inputValue: opts.defaultValue || '',
        resolve,
      });
    });
  }, []);

  const alertModal = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
      setDialogState({
        isOpen: true,
        type: 'alert',
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText || '확인',
        variant: opts.variant || 'info',
        resolve: () => resolve(),
      });
    });
  }, []);

  const handleConfirm = () => {
    if (!dialogState) return;
    const { type, resolve } = dialogState;
    setDialogState(null);
    if (type === 'confirm') {
      resolve(true);
    } else if (type === 'prompt') {
      resolve(promptInput);
    } else {
      resolve(undefined);
    }
  };

  const handleCancel = () => {
    if (!dialogState) return;
    const { type, resolve } = dialogState;
    setDialogState(null);
    if (type === 'confirm') {
      resolve(false);
    } else if (type === 'prompt') {
      resolve(null);
    } else {
      resolve(undefined);
    }
  };

  // 고객 사이트(body.client-light)는 라이트 고정 → 밝은 확인 창. 변호사·관리자 화면은 기존 어두운 창 유지
  const isClientSurface = typeof document !== 'undefined' && document.body.classList.contains('client-light');

  const getClientVariantStyles = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return { icon: <Trash2 className="w-5 h-5" aria-hidden="true" />, iconBg: 'bg-red-50 text-red-600', confirmBtn: 'bg-red-600 hover:bg-red-700 text-white' };
      case 'warning':
        return { icon: <AlertTriangle className="w-5 h-5" aria-hidden="true" />, iconBg: 'bg-amber-50 text-amber-700', confirmBtn: 'bg-amber-700 hover:bg-amber-800 text-white' };
      case 'success':
        return { icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" />, iconBg: 'bg-emerald-50 text-emerald-700', confirmBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white' };
      case 'info':
        return { icon: <Info className="w-5 h-5" aria-hidden="true" />, iconBg: 'bg-blue-50 text-blue-700', confirmBtn: 'bg-brand hover:bg-brand-hover text-white' };
      case 'primary':
      default:
        return { icon: <HelpCircle className="w-5 h-5" aria-hidden="true" />, iconBg: 'bg-brand-light text-brand', confirmBtn: 'bg-brand hover:bg-brand-hover text-white' };
    }
  };

  const getVariantStyles = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30',
          badgeText: '주의 / 확인 필요',
          badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30',
          badgeText: '확인 필요',
          badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
          iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30',
          badgeText: '완료 안내',
          badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-indigo-400" />,
          iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30',
          badgeText: '시스템 안내',
          badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-teal-400" />,
          iconBg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
          confirmBtn: 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/30',
          badgeText: '확인 요청',
          badgeColor: 'text-teal-400 bg-teal-950/60 border-teal-800/60',
        };
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert: alertModal }}>
      {children}

      {dialogState?.isOpen && isClientSurface && (
        <div
          data-app-dialog=""
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] animate-fadeIn"
          onClick={handleCancel}
        >
          <div
            role={dialogState.type === 'alert' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={dialogState.title ? 'app-dialog-title' : undefined}
            aria-label={dialogState.title ? undefined : '확인'}
            aria-describedby="app-dialog-message"
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden p-5 sm:p-6 text-slate-900 animate-fadeInScale"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${getClientVariantStyles(dialogState.variant).iconBg}`}
                aria-hidden="true"
              >
                {getClientVariantStyles(dialogState.variant).icon}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                {dialogState.title && (
                  <h2 id="app-dialog-title" className="text-lg font-bold text-slate-900 leading-snug break-keep">
                    {dialogState.title}
                  </h2>
                )}
                <div id="app-dialog-message" className="mt-1.5 text-sm text-slate-600 whitespace-pre-line leading-relaxed break-keep">
                  {dialogState.message}
                </div>
              </div>
            </div>

            {dialogState.type === 'prompt' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                className="mt-4"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={dialogState.placeholder}
                  aria-label={dialogState.title || dialogState.message}
                  className="w-full min-h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand"
                />
              </form>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              {dialogState.type !== 'alert' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="min-h-11 px-5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`min-h-11 px-5 rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  getClientVariantStyles(dialogState.variant).confirmBtn
                }`}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogState?.isOpen && !isClientSurface && (
        <div
          role="dialog"
          aria-modal="true"
          data-app-dialog=""
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={handleCancel}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 뱃지 및 닫기 버튼 */}
            <div className="flex items-center justify-between mb-4">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  getVariantStyles(dialogState.variant).badgeColor
                }`}
              >
                {getVariantStyles(dialogState.variant).badgeText}
              </span>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 본문 영역: 아이콘 + 제목 + 메시지 */}
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  getVariantStyles(dialogState.variant).iconBg
                }`}
              >
                {getVariantStyles(dialogState.variant).icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {dialogState.title && (
                  <h3 className="text-base font-extrabold text-white mb-1.5 leading-snug tracking-tight">
                    {dialogState.title}
                  </h3>
                )}
                <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                  {dialogState.message}
                </div>
              </div>
            </div>

            {/* Prompt 전용 입력창 */}
            {dialogState.type === 'prompt' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                className="mt-4"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={dialogState.placeholder}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-medium"
                />
              </form>
            )}

            {/* 하단 버튼 액션 바 */}
            <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800/80">
              {dialogState.type !== 'alert' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-300 bg-slate-800/90 hover:bg-slate-700/90 hover:text-white border border-slate-700/80 transition-all cursor-pointer press-scale"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg transition-all cursor-pointer press-scale whitespace-nowrap ${
                  getVariantStyles(dialogState.variant).confirmBtn
                }`}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
export default DialogProvider;
