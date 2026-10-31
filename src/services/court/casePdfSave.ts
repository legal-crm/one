// ============================================================
// 화면 서식 → 글자 PDF → 사건 서류함 저장 (H-13·BK-2 공통)
// 서버 PDF(/api/pdf)는 외부 요청을 막으므로 화면 스타일(같은 출처)을 글로 넣어 보낸다.
// ============================================================
import type { DocumentFile } from '../../types';
import { renderTextPdf } from './courtPdfService';
import { uploadCaseFile } from '../files/caseFileService';

/** 같은 출처 스타일시트 규칙을 글로 모은다 (@font-face는 서버 글꼴을 쓰므로 뺀다) */
export function inlineAppCss(): string {
  if (typeof document === 'undefined') return '';
  return Array.from(document.styleSheets).map(s => {
    try { return Array.from(s.cssRules).map(r => r.cssText).filter(t => !t.startsWith('@font-face')).join('\n'); } catch { return ''; }
  }).join('\n');
}

export function wrapDomHtml(innerHtml: string, title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /><title>${safeTitle}</title>
<style>${inlineAppCss()}</style>
<style>@page { size: A4 portrait; margin: 18mm; } html, body { background: #fff !important; } body { margin: 0; font-family: 'NanumMyeongjo', serif; color: #000; }
.print\\:hidden, [data-print-hide] { display: none !important; } .break-after-page { break-after: page; } tr { break-inside: avoid; }</style>
</head><body>${innerHtml}</body></html>`;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
}

/** 이미 만든 PDF 바이트를 사건 서류함(case-files, 사무소)에 저장 */
export async function savePdfBytesToCase(p: {
  bytes: Uint8Array; officeId: string; caseKey: string; fileName: string; actorName?: string; note?: string;
}): Promise<{ ok: true; file: DocumentFile } | { ok: false; message: string }> {
  const dataUrl = await blobToDataUrl(new Blob([p.bytes], { type: 'application/pdf' }));
  const up = await uploadCaseFile({
    source: 'office', clientKey: p.caseKey, officeId: p.officeId,
    file: {
      id: '', name: p.fileName, category: 'court_filing', uploadedAt: new Date().toISOString(), uploadedBy: p.actorName || '사무소',
      mimeType: 'application/pdf', dataUrl, uploadSource: 'lawyer', reviewStatus: 'approved', notes: p.note,
    } as DocumentFile,
  });
  if (!up.ok || !up.file) return { ok: false, message: up.message || 'PDF를 저장하지 못했어요.' };
  return { ok: true, file: { ...up.file, dataUrl: undefined } };
}

export async function saveHtmlPdfToCase(p: {
  html: string; title: string; officeId: string; caseKey: string; fileName: string; actorName?: string; note?: string;
}): Promise<{ ok: true; file: DocumentFile } | { ok: false; message: string }> {
  const pdf = await renderTextPdf(p.html, { title: p.title });
  if (pdf.ok === false) return { ok: false, message: pdf.message };
  const dataUrl = await blobToDataUrl(new Blob([pdf.bytes], { type: 'application/pdf' }));
  const up = await uploadCaseFile({
    source: 'office', clientKey: p.caseKey, officeId: p.officeId,
    file: {
      id: '', name: p.fileName, category: 'court_filing', uploadedAt: new Date().toISOString(), uploadedBy: p.actorName || '사무소',
      mimeType: 'application/pdf', dataUrl, uploadSource: 'lawyer', reviewStatus: 'approved', notes: p.note,
    } as DocumentFile,
  });
  if (!up.ok || !up.file) return { ok: false, message: up.message || 'PDF를 저장하지 못했어요.' };
  return { ok: true, file: { ...up.file, dataUrl: undefined } };
}
