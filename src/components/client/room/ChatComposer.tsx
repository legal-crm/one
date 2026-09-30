import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * 1:1 상담 입력창
 * - 글이 길어지면 5줄까지 높이가 늘어난다
 * - 데스크톱: Enter 보내기 · Shift+Enter 줄바꿈 / 터치 기기: Enter는 줄바꿈, 보내기 버튼으로 전송
 * - 한글 조합 중 Enter는 무시한다
 */
export interface ChatComposerHandle {
  focus: () => void;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  label: string;
  /** 받는 사람 표시 (예: '김우진 변호사') */
  recipient?: string;
  /** 보낼 수 없는 이유 등 안내 */
  hint?: string;
}

const MAX_HEIGHT = 160;

const ChatComposer = React.forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { value, onChange, onSend, disabled, placeholder, label, recipient, hint },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => areaRef.current?.focus() }), []);

  // 내용에 맞춰 높이 조절 (보낸 뒤 비워지면 한 줄로 돌아간다)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse) return;
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  };

  const hintId = 'chat-composer-hint';
  return (
    <div className="border-t border-slate-200 bg-white px-3 sm:px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 space-y-2">
      {recipient && !disabled && (
        <p className="px-1 text-xs font-semibold text-slate-600">
          받는 사람: <span className="text-slate-900">{recipient}</span>
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={areaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={hint ? hintId : undefined}
          disabled={disabled}
          maxLength={2000}
          className={cn(
            'flex-1 min-w-0 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-6 text-slate-900 placeholder:text-slate-500',
            'focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20',
            'disabled:bg-slate-100 disabled:cursor-not-allowed',
          )}
          style={{ maxHeight: MAX_HEIGHT }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="메시지 보내기"
          className="shrink-0 w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-brand-hover active:scale-95 disabled:bg-slate-300 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <p id={hintId} role="status" className="px-1 text-xs font-semibold text-amber-800 break-keep">
          {hint}
        </p>
      )}
    </div>
  );
});

export default ChatComposer;
