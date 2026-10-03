import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A4PagedSheets
 * ─────────────────────────────────────────────────────────────
 * 대법원 제출 규격 A4(210×297mm) 시트 렌더러.
 *
 * - 시트는 항상 96dpi 기준 794×1123px 고정 크기로 레이아웃한 뒤,
 *   부모 폭에 맞춰 transform: scale 로 "비율 그대로" 축소/확대한다.
 *   (패널이 좁아져도 세로로 길쭉해지지 않음)
 * - 본문은 CSS 다단(column) 레이아웃으로 실제 분할한다.
 *   각 단(column) = 한 장. 줄 단위로 분할되므로 글자가 페이지 경계에서 잘리지 않는다.
 * - 페이지 수는 문서 끝 센티널 위치를 측정하여 정확히 계산한다.
 */

export const A4_PAGE_W = 794; // 210mm @96dpi
export const A4_PAGE_H = 1123; // 297mm @96dpi
const PAD_TOP = 76; // ≈ 20mm
const PAD_BOTTOM = 40;
const PAD_X = 76; // ≈ 20mm
const FOOTER_H = 40;
const CONTENT_W = A4_PAGE_W - PAD_X * 2; // 642
const CONTENT_H = A4_PAGE_H - PAD_TOP - PAD_BOTTOM - FOOTER_H; // 967
const COLUMN_GAP = PAD_X * 2; // 단 간격 = 좌우 여백 합 → 단 간 이동폭 = 시트 폭(794)

const flowStyle: React.CSSProperties = {
  width: CONTENT_W,
  height: CONTENT_H,
  columnWidth: CONTENT_W,
  columnGap: COLUMN_GAP,
  columnFill: 'auto',
};

const A4_CONTENT_CSS = `
  .a4-flow-content { font-size: 15px; line-height: 1.8; color: #0f172a; word-break: keep-all; overflow-wrap: anywhere; }
  .a4-flow-content img, .a4-flow-content table, .a4-flow-content div { max-width: 100% !important; }
  .a4-flow-content tr { break-inside: avoid; }
  .a4-flow-content h1, .a4-flow-content h2, .a4-flow-content h3 { break-after: avoid; }
  .court-hwpx-render table { width: 100% !important; border-collapse: collapse !important; margin: 12px 0 !important; font-size: 13px !important; }
  .court-hwpx-render td, .court-hwpx-render th { border: 1px solid #475569 !important; padding: 6px 8px !important; vertical-align: middle !important; }
  .court-hwpx-render h2 { text-align: center !important; font-size: 20px !important; font-weight: bold !important; letter-spacing: 0.15em !important; margin: 18px 0 !important; }
  .court-hwpx-render p { margin: 6px 0 !important; line-height: 1.8 !important; }
`;

interface A4PagedSheetsProps {
  /** HWPX 파싱 HTML (html 또는 children 중 하나 사용) */
  html?: string;
  children?: React.ReactNode;
  mode: 'SINGLE' | 'CONTINUOUS';
  currentPage: number;
  /** 사용자 배율(%) — 패널 폭 맞춤 배율에 곱해진다 */
  zoom: number;
  onPageCountChange: (count: number) => void;
  /** SINGLE 모드에서 html 본문 직접 편집 허용 */
  editable?: boolean;
  onHtmlEdit?: (html: string) => void;
  contentClassName?: string;
  fontFamily?: string;
  /** 인쇄용 원본 노드 참조 (분할 전 전체 본문) */
  sourceRef?: React.MutableRefObject<HTMLDivElement | null>;
}

export default function A4PagedSheets({
  html,
  children,
  mode,
  currentPage,
  zoom,
  onPageCountChange,
  editable = false,
  onHtmlEdit,
  contentClassName = '',
  fontFamily = `'Batang', 'BatangChe', '바탕', serif`,
  sourceRef,
}: A4PagedSheetsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureFlowRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLSpanElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  // 부모 폭에 맞춘 A4 비율 유지 배율
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const avail = el.clientWidth - 8;
      if (avail > 0) setFitScale(Math.min(1, avail / A4_PAGE_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 실제 분할된 장 수 측정
  const measure = useCallback(() => {
    const flow = measureFlowRef.current;
    const sentinel = sentinelRef.current;
    if (!flow || !sentinel) return;
    const offset = sentinel.getBoundingClientRect().left - flow.getBoundingClientRect().left;
    const count = Math.max(1, Math.floor((offset + 1) / A4_PAGE_W) + 1);
    setPageCount(prev => (prev === count ? prev : count));
  }, []);

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(measure, 150);
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!cancelled) measure(); });
    }
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [html, measure]);

  useEffect(() => {
    onPageCountChange(pageCount);
  }, [pageCount, onPageCountChange]);

  const scale = fitScale * (zoom / 100);
  const safePage = Math.min(Math.max(1, currentPage), pageCount);

  const renderBody = (opts: { editableNode?: boolean } = {}) =>
    html !== undefined ? (
      <div
        className={`court-hwpx-render a4-flow-content ${contentClassName} ${opts.editableNode ? 'outline-none focus:ring-1 focus:ring-blue-300/50 rounded-sm' : ''}`}
        contentEditable={opts.editableNode || undefined}
        suppressContentEditableWarning
        onBlur={opts.editableNode && onHtmlEdit ? e => onHtmlEdit(e.currentTarget.innerHTML) : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      <div className={`a4-flow-content ${contentClassName}`}>{children}</div>
    );

  const renderSheet = (pageIdx: number, isActiveSingle: boolean) => (
    <div
      key={pageIdx}
      className="relative mx-auto"
      style={{ width: A4_PAGE_W * scale, height: A4_PAGE_H * scale }}
    >
      <div
        className="absolute top-0 left-0 bg-white text-slate-900 shadow-lg ring-1 ring-slate-300 select-text"
        style={{
          width: A4_PAGE_W,
          height: A4_PAGE_H,
          padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily,
        }}
      >
        <div style={{ width: CONTENT_W, height: CONTENT_H, overflow: 'hidden' }}>
          <div
            className="a4-flow"
            style={{
              ...flowStyle,
              transform: `translateX(-${pageIdx * A4_PAGE_W}px)`,
              transition: isActiveSingle ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
            }}
          >
            {renderBody({ editableNode: isActiveSingle && editable && html !== undefined })}
          </div>
        </div>
        <div
          className="flex items-end justify-center text-slate-500 select-none"
          style={{ height: FOOTER_H, fontSize: 13 }}
        >
          - {pageIdx + 1} -
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="w-full">
      <style>{A4_CONTENT_CSS}</style>
      {/* 측정 전용 (화면 밖, 동일 레이아웃) */}
      <div
        aria-hidden
        style={{ position: 'fixed', left: -100000, top: 0, visibility: 'hidden', pointerEvents: 'none', fontFamily }}
      >
        <div ref={measureFlowRef} className="a4-flow" style={flowStyle}>
          <div ref={sourceRef ?? undefined}>{renderBody()}</div>
          <span ref={sentinelRef} style={{ display: 'block', height: 0 }} />
        </div>
      </div>

      {mode === 'SINGLE' ? (
        <div className="flex flex-col items-center">{renderSheet(safePage - 1, true)}</div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {Array.from({ length: pageCount }).map((_, i) => renderSheet(i, false))}
        </div>
      )}
    </div>
  );
}
