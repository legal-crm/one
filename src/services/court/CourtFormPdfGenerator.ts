/**
 * 법원 전산양식 고해상도 PDF 생성기 (CourtFormPdfGenerator)
 * html2canvas + pdf-lib 기반:
 * - 한글 폰트 완벽 지원 (맑은 고딕 / Pretendard)
 * - 대한민국 법원 규격 A4(595.28 x 841.89 pt) 고해상도 렌더링
 * - 슬롯 코드별(R00, R03, R05, R07, R09, R10, R11, R12, R13) 전산양식 자동 빌드
 */

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { 
  type CourtFormDataContext,
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

/**
 * 단일 HTML 문자열을 렌더링하여 PDF 바이트로 변환
 */
export async function renderHtmlToPdfBytes(htmlContent: string): Promise<Uint8Array> {
  // 1. 오프스크린 렌더링 컨테이너 생성
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.background = '#ffffff';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    // 2. html2canvas로 2배율(고해상도 인쇄 품질) 캡처
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imgBytes = dataUrlToUint8Array(imgDataUrl);

    // 3. pdf-lib 문서 생성 및 페이지 추가 (A4 규격)
    const pdfDoc = await PDFDocument.create();
    const jpgImage = await pdfDoc.embedJpg(imgBytes);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4 포인트 규격
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
    });

    return await pdfDoc.save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 여러 개의 HTML 페이지를 순차적으로 렌더링하여 하나의 PDF 바이트로 병합 변환
 */
export async function renderMultipleHtmlPagesToPdfBytes(htmlPages: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const pageHtml of htmlPages) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.zIndex = '-9999';
    container.style.background = '#ffffff';
    container.innerHTML = pageHtml;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const imgBytes = dataUrlToUint8Array(imgDataUrl);
      const jpgImage = await pdfDoc.embedJpg(imgBytes);

      const page = pdfDoc.addPage([595.28, 841.89]);
      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89,
      });
    } finally {
      document.body.removeChild(container);
    }
  }

  return await pdfDoc.save();
}

/**
 * 슬롯 코드(R00, R03, R05 등)에 해당하는 대한민국 법원 정식 서식 PDF 바이트 생성
 */
export async function generateCourtOfficialFormPdf(
  slotCode: string,
  ctx: CourtFormDataContext
): Promise<Uint8Array | null> {
  switch (slotCode) {
    case 'R00': {
      // 01. 개인회생절차 개시신청서 (표지 + 본문 1쪽 + 본문 2쪽 = 총 3쪽)
      const p1 = buildCourtCoverHtml(ctx);
      const p2 = buildCourtApplicationBody1Html(ctx);
      const p3 = buildCourtApplicationBody2Html(ctx);
      return await renderMultipleHtmlPagesToPdfBytes([p1, p2, p3]);
    }

    case 'R03': {
      // 04. 개인회생채권자목록 (총괄표 + 채권자별 상세표)
      const p = buildCourtCreditorListHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R05': {
      // 06. 재산목록 (D5102)
      const p = buildCourtPropertyListHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R07': {
      // 08. 수입 및 지출에 관한 목록 (D5103)
      const p = buildCourtIncomeExpenseHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R09': {
      // 10. 진술서 (학력/경력 및 상세 채무증대경위서)
      const p = buildCourtStatementHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R10': {
      // 11. 변제계획안 (D5110)
      const p = buildCourtRepaymentPlanHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R11': {
      // 12. 금지명령 신청서
      const p = buildCourtStayOrderHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R12': {
      // 13. 소송위임장 및 경유확인서
      const p = buildCourtPowerOfAttorneyHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    case 'R13': {
      // 14. 서울회생법원 필수자료제출목록
      const p = buildCourtRequiredDocumentChecklistHtml(ctx);
      return await renderHtmlToPdfBytes(p);
    }

    default:
      return null;
  }
}

/** Data URL -> Uint8Array 변환 헬퍼 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',');
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
