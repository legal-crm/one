import { useEffect, useRef } from 'react';

/** 단축키 안내 목록 (사이드바 안내 팝오버에 표시) */
export const COURT_EDITOR_SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Enter', desc: '다음 입력 칸' },
  { keys: 'Shift + Enter', desc: '이전 입력 칸' },
  { keys: 'Ctrl + Enter', desc: '긴 글 입력 칸에서 다음 칸' },
  { keys: 'Ctrl + ] / [', desc: '다음 / 이전 서식 탭' },
  { keys: 'Alt + 1~9', desc: '입력 섹션 바로 열기' },
  { keys: 'F2', desc: '다음 미입력 항목으로 이동' },
  { keys: 'Ctrl + S', desc: '저장' },
  { keys: '?', desc: '단축키 안내 열기/닫기' },
];

interface Handlers {
  enabled: boolean;
  onSave: () => void;
  onNextTab: () => void;
  onPrevTab: () => void;
  onOpenSection: (index: number) => void;
  onNextIssue: () => void;
  onToggleHelp: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * 법원 서식 편집기 전역 단축키.
 * Enter 이동은 사이드바가 직접 처리한다 (CourtFilingInputSidebar).
 * - Ctrl+←/→ 는 입력 칸의 단어 이동, Alt+← 는 브라우저 뒤로가기와 겹쳐서 Ctrl+[ ] 를 사용
 */
export function useCourtEditorHotkeys(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;
      if (!h.enabled || e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        h.onSave();
        return;
      }
      if (mod && !e.altKey && (e.key === ']' || e.code === 'BracketRight')) {
        e.preventDefault();
        h.onNextTab();
        return;
      }
      if (mod && !e.altKey && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        h.onPrevTab();
        return;
      }
      if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) {
        e.preventDefault();
        h.onOpenSection(Number(e.code.slice(5)) - 1);
        return;
      }
      if (e.key === 'F2' && !mod && !e.altKey) {
        e.preventDefault();
        h.onNextIssue();
        return;
      }
      if (e.key === '?' && !mod && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        h.onToggleHelp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
