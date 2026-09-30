import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * 퀵독 공용 클립보드 복사
 * - 이전에는 navigator.clipboard.writeText()의 결과를 기다리지 않고 바로 '복사되었습니다'를 띄워서,
 *   권한 거부·비보안 컨텍스트에서 복사가 실패해도 성공으로 안내했다.
 * - 실패하면 textarea 방식으로 한 번 더 시도하고, 그래도 실패하면 오류 토스트를 띄운다.
 */
export async function copyText(text: string, successMessage?: string): Promise<boolean> {
  let ok = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }

  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }

  if (ok) {
    if (successMessage) toast.success(successMessage);
  } else {
    toast.error('클립보드에 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.');
  }
  return ok;
}

/**
 * 복사 버튼의 '복사됨' 표시(기본 2초)를 관리한다.
 * key로 여러 버튼 중 어느 것이 복사됐는지 구분할 수 있다.
 */
export function useCopyFeedback(resetMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = useCallback(async (text: string, successMessage?: string, key = 'default') => {
    const ok = await copyText(text, successMessage);
    if (ok) {
      setCopiedKey(key);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedKey(null), resetMs);
    }
    return ok;
  }, [resetMs]);

  return { copied: copiedKey !== null, copiedKey, copy };
}
