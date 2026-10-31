// ============================================================
// PDF 글자 조각 읽기 (브라우저 전용, pdf.js) — CR-11 PDF 거래내역
// - 필요할 때만 불러온다(번들 분리). 파일은 서버·외부로 보내지 않는다
// - 글자 PDF만 읽힌다. 스캔(그림) PDF는 조각이 없어 빈 결과
// ============================================================
import type { PdfTextItem } from './pdfStatementTable';

const MAX_PAGES = 60;

export async function extractPdfTextItems(buf: ArrayBuffer): Promise<{ items: PdfTextItem[]; pages: number; truncated: boolean }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // pdf.js 6은 글꼴 해석에 eval을 쓰지 않는다(옛 isEvalSupported 옵션 없음)
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true });
  const doc = await task.promise;
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    const items: PdfTextItem[] = [];
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        if (!('str' in it) || !it.str) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: p });
      }
      page.cleanup();
    }
    return { items, pages, truncated: doc.numPages > MAX_PAGES };
  } finally {
    void task.destroy();
  }
}
