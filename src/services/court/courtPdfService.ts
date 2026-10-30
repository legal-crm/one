import { getAuthHeaders } from '../../supabaseClient';

// ============================================================
// 글자 PDF 만들기 (H-7) — 미리보기와 같은 HTML을 서버(/api/pdf, 헤드리스 크롬 + 나눔 글꼴)에서 PDF로
// 전자소송 규칙 제8조④(직접 작성 문서는 글자 검색 가능)를 지킨다. 이전: html2canvas 그림 PDF.
// 서버가 안 되면 실패를 그대로 알리고, 인쇄 창 'PDF로 저장'을 대안으로 안내한다(조용한 그림 PDF 대체 없음).
// ============================================================

export type PdfResult = { ok: true; bytes: Uint8Array } | { ok: false; message: string };

const MAX_HTML = 3 * 1024 * 1024;

export async function renderTextPdf(html: string, opts: { title?: string; pageNumbers?: boolean } = {}): Promise<PdfResult> {
  if (!html) return { ok: false, message: '서식 내용이 없어요.' };
  if (html.length > MAX_HTML) return { ok: false, message: '서식이 너무 커요(3MB 넘음). 문서를 나눠 만들어 주세요.' };
  try {
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ html, title: opts.title || '법원 서식', pageNumbers: opts.pageNumbers !== false }),
    });
    if (res.status === 401) return { ok: false, message: '로그인이 끊겼어요. 다시 로그인해 주세요.' };
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, message: body?.error || 'PDF를 만들지 못했어요. 인쇄 창에서 PDF로 저장해 주세요.' };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 5 || String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') return { ok: false, message: 'PDF가 올바르지 않아요. 다시 시도해 주세요.' };
    return { ok: true, bytes: buf };
  } catch {
    return { ok: false, message: 'PDF 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 인쇄 창에서 PDF로 저장해 주세요.' };
  }
}

/** 파일 이름 규칙: 이름_개인회생_서류명_날짜.pdf (H-7) */
export function courtPdfFileName(clientName: string, caseType: 'rehab' | 'bankruptcy', docTitle: string, date = new Date()): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${safe(clientName || '신청인')}_${caseType === 'bankruptcy' ? '개인파산' : '개인회생'}_${safe(docTitle)}_${ymd}.pdf`;
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
