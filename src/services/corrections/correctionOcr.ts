import { getAuthHeaders } from '../../supabaseClient';
import { getCaseFileUrl } from '../files/caseFileService';
import { loadCaseFilesByIds } from './correctionService';
import type { OcrItem } from './correctionText';

// ============================================================
// 보정 원문 파일 읽기 (CR-3)
// 사무소가 올린 원문 파일(PDF·사진)을 서버 함수로 읽어 본문 글과 항목 초안을 받는다.
// 분류는 초안이고 답변 문안은 만들지 않는다. 찾은 법원·사건번호·기한은 참고로만 보여 주고 회차에 자동 반영하지 않는다.
// 서버 함수 요청 한도(약 4.5MB) 때문에 파일은 3MB까지 (넘으면 원문 글을 붙여 넣어 나눈다).
// ============================================================

export const OCR_MAX_BYTES = 3 * 1024 * 1024;

export interface OcrResult {
  transcript: string;
  items: OcrItem[];
  found: { courtName?: string; caseNumber?: string; dueDate?: string; itemCount?: number };
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export async function readCorrectionSourceFile(fileId: string): Promise<{ ok: true; data: OcrResult } | { ok: false; message: string }> {
  const [f] = await loadCaseFilesByIds([fileId]);
  if (!f) return { ok: false, message: '원문 파일을 찾지 못했어요.' };
  const url = await getCaseFileUrl({ storagePath: f.storagePath });
  if (!url) return { ok: false, message: '원문 파일을 내려받지 못했어요.' };
  let blob: Blob;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: '원문 파일을 내려받지 못했어요.' };
    blob = await res.blob();
  } catch {
    return { ok: false, message: '원문 파일을 내려받지 못했어요. 인터넷 연결을 확인해 주세요.' };
  }
  if (blob.size > OCR_MAX_BYTES) return { ok: false, message: '파일이 3MB를 넘어 읽을 수 없어요. 원문 글을 복사해 붙여 넣어 나눠 주세요.' };
  const mime = f.mimeType || blob.type || 'application/pdf';
  if (!/^(application\/pdf|image\/(jpeg|png|webp|heic))/.test(mime)) return { ok: false, message: 'PDF·사진 파일만 읽을 수 있어요.' };
  const dataUrl = (await blobToDataUrl(blob)).replace(/^data:[^;]*;/, `data:${mime};`);

  let body: any;
  try {
    const res = await fetch('/api/ocr?kind=correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ imageBase64: dataUrl, fileName: f.name }),
    });
    if (res.status === 401) return { ok: false, message: '로그인이 끊겼어요. 다시 로그인해 주세요.' };
    if (res.status === 413) return { ok: false, message: '파일이 커서 읽을 수 없어요. 원문 글을 붙여 넣어 나눠 주세요.' };
    body = await res.json().catch(() => null);
  } catch {
    return { ok: false, message: '원문을 읽는 서버에 연결하지 못했어요.' };
  }
  if (!body?.ok || body.isValidCorrectionOrder === false) {
    return { ok: false, message: body?.failureReason ? String(body.failureReason) : '원문을 읽지 못했어요. 원문 글을 붙여 넣어 나눠 주세요.' };
  }
  const items: OcrItem[] = Array.isArray(body.items) ? body.items : [];
  return {
    ok: true,
    data: {
      transcript: String(body.transcript || '').slice(0, 60000),
      items,
      found: {
        courtName: body.courtName || undefined,
        caseNumber: body.caseNumber || undefined,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate || '')) ? body.dueDate : undefined,
        itemCount: items.length,
      },
    },
  };
}
