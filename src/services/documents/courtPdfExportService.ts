/**
 * courtPdfExportService.ts
 * 대법원 전자소송 법원 서식용 실제 PDF 생성 및 즉시 다운로드 엔진
 * - html2canvas + jsPDF 기반으로 .court-page 단위 정밀 A4 (210mm x 297mm) 페이지네이션
 * - 한글 파일명 보장 및 파일명 내 금지 특수문자 자동 정제
 * - 캡처 시 화면 전용 편집/매핑 테두리(.cf-active, .cf-missing 등) 자동 은닉
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface CourtPdfExportOptions {
  fileName?: string;
  scale?: number;
  onProgress?: (current: number, total: number) => void;
}

/** 파일명에서 Windows/Mac 금지 문자 치환 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * 주어진 컨테이너 내부의 법원 서식(.court-page)들을 고해상도 A4 PDF로 생성하여 다운로드
 */
export async function exportCourtPagesToPdf(
  containerEl: HTMLElement,
  defaultFileName: string,
  options: CourtPdfExportOptions = {}
): Promise<void> {
  const scale = options.scale ?? 2;
  const fileName = sanitizeFileName(options.fileName || defaultFileName);

  // 1. 컨테이너 내부에서 캡처 대상 페이지(.court-page) 탐색
  let pages = Array.from(containerEl.querySelectorAll<HTMLElement>('.court-page'));
  if (pages.length === 0) {
    // .court-page 클래스가 없으면 컨테이너 자체를 단일 페이지로 취급
    pages = [containerEl];
  }

  // 2. 캡처 중 화면 전용 하이라이트 임시 차단 클래스 부여
  containerEl.classList.add('cf-pdf-capturing');

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      options.onProgress?.(i + 1, pages.length);

      // 원본 스타일 보존을 위한 캡처
      const canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 96dpi 근사치 폭
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    // 3. 다운로드 트리거
    const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    pdf.save(finalName);
  } finally {
    containerEl.classList.remove('cf-pdf-capturing');
  }
}
