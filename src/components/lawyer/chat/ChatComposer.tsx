import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Lock, MessageSquareText, Send } from 'lucide-react';
import type { ChatReplyTemplate } from './chatTemplates';
import { useCoarsePointer, useDismiss } from './chatHooks';

const MAX_TEXTAREA_HEIGHT = 6 * 24 + 20; // 약 6줄

interface ChatComposerProps {
  /**
   * 작성창이 화면 오른쪽 아래 모서리에 닿는 레이아웃(서랍 모드)이면 true.
   * 모서리에 떠 있는 실무 퀵툴 버튼 기본 위치 아래로 입력창·전송 버튼이 들어가지 않도록 아래 줄을 높인다.
   */
  reserveCornerSpace?: boolean;
  /** false면 입력·전송 비활성 (자격 심사 대기 계정) */
  canSend: boolean;
  /** 전송 — 받아들였으면 true (입력창을 비운다) */
  onSend: (text: string) => boolean;
  /** 스레드별 임시 저장된 입력값 */
  initialValue?: string;
  onDraftChange?: (text: string) => void;
  templates: ChatReplyTemplate[];
}

/** 스레드마다 key로 새로 마운트한다 (입력값은 스레드별로 따로 보관) */
export default function ChatComposer({ reserveCornerSpace = false, canSend, onSend, initialValue = '', onDraftChange, templates }: ChatComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  const inputId = useId();
  const hintId = useId();

  useDismiss(templatesOpen, () => setTemplatesOpen(false), [templateButtonRef, templateMenuRef]);

  // 1~6줄 자동 높이
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const updateValue = (next: string) => {
    setValue(next);
    onDraftChange?.(next);
  };

  const send = () => {
    const text = value.trim();
    if (!text || !canSend) return;
    if (onSend(text)) updateValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // 한글 조합 중 Enter는 글자 확정용 — 전송하지 않는다 (Safari는 keyCode 229)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // 터치 기기에서는 Enter를 줄바꿈으로 두고 전송 버튼을 쓴다
    if (coarse) return;
    e.preventDefault();
    send();
  };

  const insertTemplate = (text: string) => {
    setTemplatesOpen(false);
    const next = value.trim() ? `${value.replace(/\s+$/, '')}\n\n${text}` : text;
    updateValue(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  };

  return (
    <div className={`shrink-0 border-t border-slate-200 bg-white px-4 pt-2.5 ${reserveCornerSpace ? 'pb-9' : 'pb-3'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="relative">
          <button
            ref={templateButtonRef}
            type="button"
            disabled={!canSend}
            aria-haspopup="menu"
            aria-expanded={templatesOpen}
            onClick={() => setTemplatesOpen(v => !v)}
            className="inline-flex items-center gap-1.5 h-8 pointer-coarse:h-11 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors press-scale cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
            자주 쓰는 답변
          </button>
          {templatesOpen && (
            <div
              ref={templateMenuRef}
              role="menu"
              aria-label="자주 쓰는 답변"
              className="absolute bottom-full left-0 mb-2 w-80 max-w-[80vw] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg z-20"
            >
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => insertTemplate(t.text)}
                  className="w-full text-left rounded-xl px-3 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50 cursor-pointer"
                >
                  <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-600 line-clamp-2">{t.text.replace(/\n/g, ' ')}</span>
                </button>
              ))}
              <p className="px-3 pt-1.5 pb-1 text-[12px] text-slate-500">누르면 입력창에 넣습니다. 보내기 전에 내용을 확인해 주세요.</p>
            </div>
          )}
        </div>
        {!coarse && canSend && !reserveCornerSpace && (
          <span id={hintId} className="text-[12px] text-slate-500 whitespace-nowrap">Enter 전송 · Shift+Enter 줄바꿈</span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <label htmlFor={inputId} className="sr-only">의뢰인에게 보낼 메시지</label>
        <textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={!canSend}
          onChange={e => updateValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={!coarse && canSend ? hintId : undefined}
          placeholder={canSend ? '의뢰인에게 보낼 메시지를 입력하세요' : '관리자 승인 후 메시지를 보낼 수 있습니다'}
          className="flex-1 min-h-[44px] resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] leading-6 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend || !value.trim()}
          aria-label="메시지 보내기"
          className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold whitespace-nowrap transition-colors press-scale cursor-pointer disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          전송
        </button>
      </div>

      {!coarse && canSend && reserveCornerSpace && (
        <p id={hintId} className="mt-2 text-[12px] text-slate-500">Enter 전송 · Shift+Enter 줄바꿈</p>
      )}

      {!canSend && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          자격 심사 대기(체험 모드) 중에는 메시지를 보낼 수 없습니다. 관리자 승인 후 이용해 주세요.
        </p>
      )}
    </div>
  );
}
