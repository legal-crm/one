import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** 상대 시간(대기 1시간 등)을 갱신하기 위한 현재 시각 — 기본 1분마다 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** 요소의 실제 폭 (사이드바 접힘까지 반영하기 위해 화면 폭 대신 사용) */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** 팝오버 바깥 클릭·Esc로 닫기. 트리거 버튼은 ignoreRefs로 제외한다 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: Array<RefObject<HTMLElement | null>>
): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (refs.some(r => r.current && r.current.contains(target))) return;
      closeRef.current();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
    // refs 배열은 렌더마다 새로 만들어지지만 담긴 ref 객체는 같으므로 open만 기준으로 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** 터치 위주 기기 여부 — 모바일에서는 Enter를 줄바꿈으로 둔다 */
export function useCoarsePointer(): boolean {
  const [coarse] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  return coarse;
}
