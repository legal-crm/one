// 직인·도장 이미지 메모리 캐시 (ST-5)
// 로그인 때 서버(비공개 저장소)에서 한 번 받아 data URL로 둔다 → 계약서 미리보기·인쇄·서버 PDF(외부 요청 차단)에 바로 넣을 수 있다.
import { loadActiveSeals, logSealUsage } from './officeSettingsService';

let officeId = '';
const cache: Partial<Record<'office_seal' | 'lawyer_seal' | 'lawyer_signature', { id: string; dataUrl: string }>> = {};

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadSealCache(id: string | null | undefined): Promise<void> {
  officeId = id || '';
  delete cache.office_seal; delete cache.lawyer_seal; delete cache.lawyer_signature;
  if (!officeId) return;
  const r = await loadActiveSeals(officeId);
  if (r.ok === false) return;
  for (const s of r.data) {
    if (!s.imageUrl) continue;
    const d = await toDataUrl(s.imageUrl);
    if (d) cache[s.kind] = { id: s.id, dataUrl: d };
  }
}

export function getSealDataUrl(kind: 'office_seal' | 'lawyer_seal' | 'lawyer_signature'): string | undefined {
  return cache[kind]?.dataUrl;
}

/** 문서에 찍었을 때 기록 (어떤 문서인지만) */
export function recordSealUse(kind: 'office_seal' | 'lawyer_seal' | 'lawyer_signature', documentName: string): void {
  const s = cache[kind];
  if (!s || !officeId) return;
  void logSealUsage(officeId, s.id, documentName).catch(() => undefined);
}
