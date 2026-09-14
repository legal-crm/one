import { useState, useEffect, useRef, useCallback } from 'react';
import { Position } from './types';

const STORAGE_KEY = 'legal_dock_pos_v2';
const PADDING = 16;

export function useDraggableDock() {
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number } | null>(null);
  const hasMovedRef = useRef(false);

  // 초기 위치 로드 (저장된 좌표 또는 기본 우측 하단)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          // 뷰포트 내인지 검증
          const validX = Math.min(Math.max(PADDING, parsed.x), window.innerWidth - 140);
          const validY = Math.min(Math.max(PADDING, parsed.y), window.innerHeight - 60);
          setPosition({ x: validX, y: validY });
          return;
        }
      }
    } catch {
      // ignore
    }

    // 기본값: 우측 하단
    const defaultX = Math.max(PADDING, window.innerWidth - 160);
    const defaultY = Math.max(PADDING, window.innerHeight - 80);
    setPosition({ x: defaultX, y: defaultY });
  }, []);

  // 창 크기 변경 시 화면 밖으로 나가지 않도록 조정
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return prev;
        const validX = Math.min(Math.max(PADDING, prev.x), window.innerWidth - 140);
        const validY = Math.min(Math.max(PADDING, prev.y), window.innerHeight - 60);
        return { x: validX, y: validY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 드래그 시작
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // 마우스 우클릭 제외
    if (e.button !== 0) return;

    const currentTarget = e.currentTarget as HTMLElement;
    currentTarget.setPointerCapture(e.pointerId);

    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: position?.x ?? (window.innerWidth - 160),
      initPosY: position?.y ?? (window.innerHeight - 80),
    };
    setIsDragging(true);
  }, [position]);

  // 드래그 중
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    // 4px 이상 움직여야 드래그로 판정 (단순 클릭과 구분)
    if (!hasMovedRef.current && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      hasMovedRef.current = true;
    }

    if (hasMovedRef.current) {
      const nextX = dragStartRef.current.initPosX + deltaX;
      const nextY = dragStartRef.current.initPosY + deltaY;

      // 뷰포트 클램핑
      const clampedX = Math.min(Math.max(PADDING, nextX), window.innerWidth - 150);
      const clampedY = Math.min(Math.max(PADDING, nextY), window.innerHeight - 70);

      setPosition({ x: clampedX, y: clampedY });
    }
  }, [isDragging]);

  // 드래그 종료
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      const currentTarget = e.currentTarget as HTMLElement;
      currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setIsDragging(false);
    dragStartRef.current = null;

    // 위치 저장
    if (position && hasMovedRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      } catch {
        // ignore
      }
    }
  }, [isDragging, position]);

  // 기본 위치 리셋
  const resetPosition = useCallback(() => {
    const defaultX = Math.max(PADDING, window.innerWidth - 160);
    const defaultY = Math.max(PADDING, window.innerHeight - 80);
    const defaultPos = { x: defaultX, y: defaultY };
    setPosition(defaultPos);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    position,
    setPosition,
    isDragging,
    hasMoved: hasMovedRef.current,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetPosition,
  };
}
