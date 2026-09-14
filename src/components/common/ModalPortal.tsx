// src/components/common/ModalPortal.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * ModalPortal
 * React createPortal(children, document.body)를 활용하여
 * 부모 컨테이너의 Stacking Context(animate-fadeIn, overflow, transform 등)를
 * 완전히 탈출하여 document.body 최상위에 모달을 안전하게 렌더링합니다.
 */
export default function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
}
