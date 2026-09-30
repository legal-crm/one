import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * 고객 사이트 공통 모달/시트
 * - document.body 포털, role="dialog" + aria-modal, ESC 닫기, 포커스 트랩·복귀, 배경 스크롤 잠금
 * - 모바일: sheet(하단 시트) · fullscreen(전체 화면) · center(가운데) 중 선택
 * - footer는 하단 고정 액션 바(safe-area 포함)로 렌더링
 * - z-index 60 (공용 확인 다이얼로그 DialogProvider는 그 위 99999)
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type ModalMobileMode = 'sheet' | 'fullscreen' | 'center';

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 중첩 모달 대응: 스크롤 잠금 카운터와 최상단 모달 스택
let scrollLockCount = 0;
let savedOverflow = '';
const modalStack: string[] = [];

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = savedOverflow;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: ModalSize;
  mobile?: ModalMobileMode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 배경 클릭·ESC로 닫기 허용 (기본 true) */
  dismissible?: boolean;
  hideCloseButton?: boolean;
  closeLabel?: string;
  /** 닫기 전에 확인이 필요할 때(저장하지 않은 변경 등). false를 돌려주면 닫지 않는다 */
  onBeforeClose?: () => boolean | Promise<boolean>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** title이 없을 때의 접근성 이름 */
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  /** 헤더 제목·설명 아래 한 줄(상태 배지·저장 상태 등). 대화상자 이름(aria-labelledby)에는 포함되지 않는다 */
  meta?: React.ReactNode;
  /** 헤더 아래 고정 영역(단계 표시 등) */
  subHeader?: React.ReactNode;
  /** dialog: 가운데/하단 시트(기본) · drawer: 오른쪽에서 열리는 전체 높이 패널(전체 메뉴 등) */
  variant?: 'dialog' | 'drawer';
  /** 층 순서. 기본 z-[60](모달 층). 로그인처럼 다른 모달 위에 떠야 하면 'z-[70]' */
  zIndexClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  mobile = 'sheet',
  footer,
  children,
  dismissible = true,
  hideCloseButton = false,
  closeLabel = '닫기',
  onBeforeClose,
  initialFocusRef,
  ariaLabel,
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
  meta,
  subHeader,
  variant = 'dialog',
  zIndexClassName = 'z-[60]',
}: ModalProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onBeforeCloseRef = useRef(onBeforeClose);
  // 닫기 확인(onBeforeClose)이 진행 중인지. 확인 창이 떠 있는 동안 ESC·배경 클릭이 두 번째 확인을 띄우지 않게 한다
  const closingRef = useRef(false);
  onCloseRef.current = onClose;
  onBeforeCloseRef.current = onBeforeClose;

  const requestClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      if (onBeforeCloseRef.current) {
        const ok = await onBeforeCloseRef.current();
        if (!ok) return;
      }
      onCloseRef.current();
    } finally {
      closingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    modalStack.push(uid);
    lockBodyScroll();

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocusRef?.current || panel.querySelector<HTMLElement>('[data-autofocus]') || panel;
      target.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== uid) return; // 가장 위 모달만 반응
      // 공용 확인 창(DialogProvider)이 떠 있거나 닫기 확인 중이면 키 처리를 그 창에 맡긴다(ESC=취소, Tab=확인 창 안 이동)
      if (closingRef.current || document.querySelector('[data-app-dialog]')) return;
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        void requestClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (nodes.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.lastIndexOf(uid);
      if (idx >= 0) modalStack.splice(idx, 1);
      unlockBodyScroll();
      const prev = restoreFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const showHeader = Boolean(title) || !hideCloseButton;

  const isDrawer = variant === 'drawer';
  const panelShape = isDrawer
    ? 'h-[100dvh] max-h-[100dvh] max-w-sm rounded-none sm:rounded-l-3xl'
    : mobile === 'fullscreen'
      ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90dvh] sm:rounded-3xl'
      : mobile === 'sheet'
        ? 'max-h-[92dvh] rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl'
        : 'max-h-[90dvh] rounded-3xl';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex',
        zIndexClassName,
        isDrawer ? 'justify-end' : 'justify-center',
        !isDrawer && (mobile === 'center' ? 'items-center p-4' : 'items-end sm:items-center sm:p-4'),
      )}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fadeIn"
        onClick={dismissible ? () => void requestClose() : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col w-full bg-white shadow-xl outline-none overflow-hidden',
          isDrawer ? 'animate-slideInRight' : mobile === 'sheet' ? 'animate-slideUp sm:animate-fadeInScale' : 'animate-fadeInScale',
          panelShape,
          !isDrawer && SIZE[size],
          className,
        )}
      >
        {!isDrawer && mobile === 'sheet' && <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 shrink-0" aria-hidden="true" />}

        {showHeader && (
          <div className={cn('shrink-0 flex items-start gap-3 px-5 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-slate-100', headerClassName)}>
            {icon && (
              <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center" aria-hidden="true">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              {title && (
                <h2 id={titleId} className="text-lg font-bold text-slate-900 leading-snug break-keep">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                  {description}
                </p>
              )}
              {meta && <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">{meta}</div>}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={() => void requestClose()}
                aria-label={closeLabel}
                className="shrink-0 -mr-2 -mt-1 w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {subHeader && <div className="shrink-0 border-b border-slate-100">{subHeader}</div>}

        <div className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5', bodyClassName)}>{children}</div>

        {footer && (
          <div
            className={cn(
              'shrink-0 border-t border-slate-200 bg-white px-5 sm:px-6 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 flex flex-wrap items-center justify-end gap-2',
              footerClassName,
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
