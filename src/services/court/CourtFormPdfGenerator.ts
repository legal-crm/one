/**
 * 법원 전산양식 텍스트 PDF 생성기 (인쇄 창 방식)
 * 브라우저 네이티브 인쇄 → PDF 저장 방식:
 * - 텍스트 선택/검색 가능
 * - 한글 폰트(바탕체) OS 레벨 임베딩
 * - 대한민국 법원 규격 A4(210mm x 297mm) 정확 렌더링
 * - 파일 용량 최적화 (래스터 대비 1/15)
 */

import { toast } from 'sonner';
import {
  type CourtFormDataContext,
  escapeHtml,
  buildCourtCoverHtml,
  buildCourtApplicationBody1Html,
  buildCourtApplicationBody2Html,
  buildCourtCreditorListHtml,
  buildCourtPropertyListHtml,
  buildCourtIncomeExpenseHtml,
  buildCourtStatementHtml,
  buildCourtRepaymentPlanHtml,
  buildCourtStayOrderHtml,
  buildCourtPowerOfAttorneyHtml,
  buildCourtRequiredDocumentChecklistHtml
} from './CourtFormHtmlBuilder';
import { renderTextPdf } from './courtPdfService';

/** 법원 표준 인쇄 CSS */
const COURT_PRINT_CSS = `
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: 'NanumMyeongjo', 'Batang', 'BatangChe', '바탕', 'Noto Serif KR', 'AppleMyungjo', serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color: #000000;
  }
  @media print {
    body {
      background: #ffffff;
    }
  }
`;

/**
 * 단일 HTML 문서를 법원 규격 인쇄 창으로 열어 PDF 저장 유도
 */
export function openCourtFormPrintWindow(htmlContent: string, title: string = '법원 전산양식'): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('팝업이 막혀 있어요. 이 사이트의 팝업을 허용해 주세요.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>${COURT_PRINT_CSS}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/**
 * 여러 개의 HTML 페이지를 하나의 인쇄 창으로 합쳐 열기
 */
export function openCourtFormPrintWindowMulti(htmlPages: string[], title: string = '법원 전산양식'): void {
  const combined = htmlPages.join('\n');
  openCourtFormPrintWindow(combined, title);
}

/**
 * 슬롯 코드(R00, R03, R05 등)에 해당하는 법원 서식을 인쇄 창으로 열기
 */
export function openCourtFormForPrint(
  slotCode: string,
  ctx: CourtFormDataContext,
  title?: string
): void {
  const formTitle = title || `법원 전산양식 ${slotCode}`;
  
  switch (slotCode) {
    case 'R00': {
      const p1 = buildCourtCoverHtml(ctx);
      const p2 = buildCourtApplicationBody1Html(ctx);
      const p3 = buildCourtApplicationBody2Html(ctx);
      openCourtFormPrintWindowMulti([p1, p2, p3], formTitle);
      break;
    }
    case 'R03': {
      openCourtFormPrintWindow(buildCourtCreditorListHtml(ctx), formTitle);
      break;
    }
    case 'R05': {
      openCourtFormPrintWindow(buildCourtPropertyListHtml(ctx), formTitle);
      break;
    }
    case 'R07': {
      openCourtFormPrintWindow(buildCourtIncomeExpenseHtml(ctx), formTitle);
      break;
    }
    case 'R09': {
      openCourtFormPrintWindow(buildCourtStatementHtml(ctx), formTitle);
      break;
    }
    case 'R10': {
      openCourtFormPrintWindow(buildCourtRepaymentPlanHtml(ctx), formTitle);
      break;
    }
    case 'R11': {
      openCourtFormPrintWindow(buildCourtStayOrderHtml(ctx), formTitle);
      break;
    }
    case 'R12': {
      openCourtFormPrintWindow(buildCourtPowerOfAttorneyHtml(ctx), formTitle);
      break;
    }
    case 'R13': {
      openCourtFormPrintWindow(buildCourtRequiredDocumentChecklistHtml(ctx), formTitle);
      break;
    }
    default:
      console.warn(`Unknown court form slot code: ${slotCode}`);
  }
}

/**
 * Legacy compatibility: 기존 renderHtmlToPdfBytes 호출을 인쇄 창 방식으로 대체
 * @deprecated Use openCourtFormPrintWindow instead
 */
export async function renderHtmlToPdfBytes(htmlContent: string): Promise<Uint8Array> {
  openCourtFormPrintWindow(htmlContent, '법원 전산양식');
  return new Uint8Array(0);
}

/**
 * Legacy compatibility: 기존 renderMultipleHtmlPagesToPdfBytes 호출을 인쇄 창 방식으로 대체  
 * @deprecated Use openCourtFormPrintWindowMulti instead
 */
export async function renderMultipleHtmlPagesToPdfBytes(htmlPages: string[]): Promise<Uint8Array> {
  openCourtFormPrintWindowMulti(htmlPages, '법원 전산양식');
  return new Uint8Array(0);
}

/** 슬롯 코드 → 서식 HTML 쪽들 (인쇄 창·글자 PDF가 같은 정의를 쓴다, H-8) */
export function courtFormPagesForSlot(slotCode: string, ctx: CourtFormDataContext): string[] | null {
  switch (slotCode) {
    case 'R00': return [buildCourtCoverHtml(ctx), buildCourtApplicationBody1Html(ctx), buildCourtApplicationBody2Html(ctx)];
    case 'R03': return [buildCourtCreditorListHtml(ctx)];
    case 'R05': return [buildCourtPropertyListHtml(ctx)];
    case 'R07': return [buildCourtIncomeExpenseHtml(ctx)];
    case 'R09': return [buildCourtStatementHtml(ctx)];
    case 'R10': return [buildCourtRepaymentPlanHtml(ctx)];
    case 'R11': return [buildCourtStayOrderHtml(ctx)];
    case 'R12': return [buildCourtPowerOfAttorneyHtml(ctx)];
    case 'R13': return [buildCourtRequiredDocumentChecklistHtml(ctx)];
    default: return null;
  }
}

/** 쪽 HTML들을 인쇄용 한 문서로 (쪽마다 나눔) */
export function wrapCourtHtml(pages: string[], title: string): string {
  const body = pages.map((p, i) => `<section style="${i < pages.length - 1 ? 'page-break-after: always;' : ''}">${p}</section>`).join('\n');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${COURT_PRINT_CSS}</style></head><body>${body}</body></html>`;
}

/**
 * 슬롯 서식을 글자 PDF로 (H-7). 서버에서 만들지 못하면 null — 부르는 쪽이 사유를 알린다.
 * 이전: 인쇄 창을 띄우고 빈 결과(null)를 돌려줘 묶음에 서식이 들어가지 않았다.
 */
export async function generateCourtOfficialFormPdf(slotCode: string, ctx: CourtFormDataContext): Promise<Uint8Array | null> {
  const pages = courtFormPagesForSlot(slotCode, ctx);
  if (!pages) return null;
  const r = await renderTextPdf(wrapCourtHtml(pages, `법원 서식 ${slotCode}`), { title: slotCode });
  return r.ok ? r.bytes : null;
}