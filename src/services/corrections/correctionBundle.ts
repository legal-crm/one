import JSZip from 'jszip';
import { getCaseFileUrl } from '../files/caseFileService';
import { COURT_FILE_SIZE_LIMIT, COURT_TOTAL_SIZE_LIMIT, formatFileSize } from '../pdfQualityService';
import { loadCaseFilesByIds, type CaseExhibit, type CorrectionItem, type CorrectionOrder } from './correctionService';

// ============================================================
// 보정 전자소송 묶음 (CR-9)
// 순서: 보정서 → 수정한 목록(변제계획안·채권자목록 등) → 항목 순서대로 소명자료(소갑 번호 순).
// 파일 이름: 보정{회차}_{항목}_{자료}.pdf. 파일당 20MB·총 100MB(전자소송포털 안내)를 넘으면 경고한다.
// ============================================================

export interface BundlePlanEntry { fileId: string; zipName: string; group: 'brief' | 'revised' | 'exhibit' }

const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || '자료';
const ext = (name: string) => (name.match(/\.[a-z0-9]{2,5}$/i)?.[0] || '.pdf').toLowerCase();

/** 묶음 순서·파일 이름만 정한다 (내려받기 없음, 시험 가능) */
export function planCorrectionBundle(
  order: CorrectionOrder, items: CorrectionItem[], exhibits: CaseExhibit[], names: Record<string, string>,
): { entries: BundlePlanEntry[]; warnings: string[] } {
  const entries: BundlePlanEntry[] = [];
  const warnings: string[] = [];
  const used = new Set<string>();
  const add = (fileId: string | undefined, base: string, group: BundlePlanEntry['group']) => {
    if (!fileId || used.has(fileId)) return;
    used.add(fileId);
    let name = `${base}${ext(names[fileId] || '')}`;
    let n = 2;
    while (entries.some(e => e.zipName === name)) name = `${base}_${n++}${ext(names[fileId] || '')}`;
    entries.push({ fileId, zipName: name, group });
  };
  const r = `보정${order.round}`;
  if (order.briefFileId) add(order.briefFileId, `${r}_00_보정서`, 'brief');
  else warnings.push('제출할 보정서 파일이 없어요. 요약보정서를 PDF로 저장해 이 회차에 올려 주세요.');
  order.revisedDocs.forEach((d, i) => {
    if (d.unchanged) return;
    if (!d.fileId) { warnings.push(`수정본 '${d.label}' 파일이 없어요.`); return; }
    add(d.fileId, `${r}_0${Math.min(i + 1, 9)}_수정_${safe(d.label)}`, 'revised');
  });
  const byItem = new Map(items.map(i => [i.id, i]));
  const ordered = [...items].sort((a, b) => a.seq - b.seq);
  ordered.forEach(it => {
    const label = safe(it.label || String(it.seq));
    const myExhibits = exhibits.filter(e => e.itemId === it.id).sort((a, b) => a.number - b.number);
    myExhibits.forEach(e => {
      if (e.fileId) add(e.fileId, `${r}_${label}_소갑${e.number}_${safe(e.title)}`, 'exhibit');
    });
    const firstNo = myExhibits[0]?.number;
    it.fileIds.forEach((fid, k) => add(fid, `${r}_${label}_${firstNo ? `소갑${firstNo}_` : ''}${safe(names[fid]?.replace(/\.[^.]+$/, '') || `자료${k + 1}`)}`, 'exhibit'));
    if ((it.status === 'submitted' || it.status === 'requested' || it.status === 'in_progress' || it.status === 'needs_fix') && it.owner !== 'office') {
      warnings.push(`${it.label || it.seq}번 항목은 아직 확인 전이에요.`);
    }
  });
  exhibits.filter(e => e.fileId && (!e.itemId || !byItem.has(e.itemId))).forEach(e => add(e.fileId, `${r}_소갑${e.number}_${safe(e.title)}`, 'exhibit'));
  return { entries, warnings };
}

export async function buildCorrectionBundleZip(
  order: CorrectionOrder, items: CorrectionItem[], exhibits: CaseExhibit[],
): Promise<{ ok: true; blob: Blob; fileName: string; warnings: string[]; count: number } | { ok: false; message: string }> {
  const ids = Array.from(new Set([order.briefFileId, ...order.revisedDocs.map(d => d.fileId), ...exhibits.map(e => e.fileId), ...items.flatMap(i => i.fileIds)].filter(Boolean) as string[]));
  const files = ids.length ? await loadCaseFilesByIds(ids) : [];
  const meta = new Map(files.map(f => [f.id, f]));
  const names: Record<string, string> = Object.fromEntries(files.map(f => [f.id, f.name]));
  const { entries, warnings } = planCorrectionBundle(order, items, exhibits, names);
  if (entries.length === 0) return { ok: false, message: '묶을 파일이 없어요. 보정서와 확인한 소명자료를 먼저 올려 주세요.' };

  const zip = new JSZip();
  let total = 0;
  for (const e of entries) {
    const f = meta.get(e.fileId);
    if (!f) { warnings.push(`${e.zipName}: 파일을 찾지 못했어요(지워졌을 수 있어요).`); continue; }
    const url = await getCaseFileUrl({ storagePath: f.storagePath });
    if (!url) { warnings.push(`${e.zipName}: 내려받지 못했어요.`); continue; }
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) { warnings.push(`${e.zipName}: 내려받지 못했어요.`); continue; }
    const buf = await res.arrayBuffer();
    total += buf.byteLength;
    if (buf.byteLength > COURT_FILE_SIZE_LIMIT) warnings.push(`${e.zipName}: ${formatFileSize(buf.byteLength)} — 파일당 20MB를 넘어 나눠 올려야 해요.`);
    zip.file(e.zipName, buf);
  }
  if (total > COURT_TOTAL_SIZE_LIMIT) warnings.push(`전체 ${formatFileSize(total)} — 첨부 총용량 100MB를 넘어요. 나눠 제출해야 해요.`);
  const list = entries.map((e, i) => `${i + 1}. ${e.zipName}`).join('\r\n');
  zip.file(`보정${order.round}_첨부목록.txt`, `\uFEFF${order.round}차 보정 제출 묶음 (${new Date().toLocaleDateString('ko-KR')})\r\n\r\n${list}\r\n\r\n확인할 점:\r\n${warnings.length ? warnings.map(w => `- ${w}`).join('\r\n') : '- 없음'}\r\n`);
  const blob = await zip.generateAsync({ type: 'blob' });
  return { ok: true, blob, fileName: `보정${order.round}_전자소송_묶음.zip`, warnings, count: entries.length };
}
