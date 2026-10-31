// ============================================================
// 증빙 내보내기 (CL-10) — 사건 하나의 소통 기록·녹음 원본·대화록을 ZIP 하나로
//  * 녹음은 열람 기록(log_evidence_access 'download')을 남긴 뒤 서버 주소로 받고, 받은 파일 지문을 서버 지문과 대조한다
//  * AI 대화록은 '참고용(원본 녹음이 기준)'으로 표시
//  * 브라우저에서만 묶고 서버로 다시 보내지 않는다. 권한: comm.export
// ============================================================
import JSZip from 'jszip';
import { CHANNEL_LABEL, RESULT_LABEL, getRecordingPlayUrl, listCommLogs, listRecordings, sha256OfFile, type CallRecording, type CommLog, type CommTarget } from './commService';
import { listLatestTranscripts, type CallTranscript } from './callTranscriptService';

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // 수식 주입 막기
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const kst = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '');
const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

export function commLogsCsv(logs: CommLog[]): string {
  const head = ['일시', '종류', '방향', '결과', '통화 길이(초)', '회선', '보낸 사람', '내용', '메모', '내용 지문', '출처'];
  const rows = logs.map(l => [
    kst(l.occurredAt), CHANNEL_LABEL[l.channel] || l.channel, l.direction === 'in' ? '받음' : '보냄', RESULT_LABEL[l.result] || '',
    l.durationSec ?? '', l.lineLabel, l.senderName || '', l.body || '', l.note || '', l.contentHash, l.source,
  ]);
  return '\uFEFF' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function transcriptText(t: CallTranscript, rec: CallRecording): string {
  const lines = [
    `AI 대화록 (참고용 · 원본 녹음이 기준) — 녹음 ${rec.originalName || rec.id} · 버전 ${t.version}${t.model ? ` · ${t.model}` : ''}`,
    `만든 때: ${kst(t.createdAt)}`, '',
    ...t.segments.map(s => `${s.start != null ? `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, '0')}] ` : ''}${s.speaker}: ${s.text}`),
  ];
  if (t.summary) lines.push('', '요약', t.summary);
  return lines.join('\n');
}

export interface EvidenceExportResult {
  blob: Blob;
  fileName: string;
  recordings: number;
  mismatched: number;
  failed: number;
}

export async function buildEvidenceZip(officeId: string, target: CommTarget, label: string, range: { from?: string; to?: string } = {}): Promise<EvidenceExportResult> {
  const [l, r] = await Promise.all([listCommLogs(officeId, target, 2000), listRecordings(officeId, target)]);
  if (l.ok === false) throw new Error(l.message);
  const inRange = (iso?: string | null) => {
    if (!iso) return !range.from && !range.to;
    const d = iso.slice(0, 10);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
  const logs = l.data.filter(x => inRange(x.occurredAt)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const recs = (r.ok ? r.data : []).filter(x => (x.status === 'verified' || x.status === 'mismatch') && inRange(x.recordedAt || x.createdAt));
  const transcripts = await listLatestTranscripts(recs.map(x => x.id));

  const zip = new JSZip();
  zip.file('소통기록.csv', commLogsCsv(logs));
  const fp: string[] = ['녹음 파일 지문 (SHA-256)', '파일 | 서버 지문 | 받은 파일 지문 | 일치', ''];
  let mismatched = 0; let failed = 0;
  for (const rec of recs) {
    const name = `녹음/${safe(kst(rec.recordedAt || rec.createdAt))}_${safe(rec.originalName || rec.id)}`;
    const url = await getRecordingPlayUrl(rec.id, 'download');
    if (url.ok === false) { failed++; fp.push(`${name} | ${rec.serverSha256 || '-'} | 받지 못함 (${url.message}) | -`); continue; }
    try {
      const res = await fetch(url.data);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const got = await sha256OfFile(blob);
      const same = !!rec.serverSha256 && got === rec.serverSha256;
      if (!same) mismatched++;
      zip.file(name, blob);
      fp.push(`${name} | ${rec.serverSha256 || '-'} | ${got} | ${same ? '일치' : '불일치'}`);
    } catch (e: any) {
      failed++;
      fp.push(`${name} | ${rec.serverSha256 || '-'} | 받지 못함 (${e?.message || '오류'}) | -`);
    }
    const t = transcripts.get(rec.id);
    if (t) zip.file(`대화록/${safe(rec.originalName || rec.id)}.txt`, transcriptText(t, rec));
  }
  zip.file('녹음_지문.txt', fp.join('\n'));
  zip.file('읽어 보기.txt', [
    `마이김변 증빙 내보내기 — ${label}`,
    `만든 때: ${kst(new Date().toISOString())}`,
    `기간: ${range.from || '처음'} ~ ${range.to || '지금'}`,
    `소통 기록 ${logs.length}건 · 녹음 ${recs.length}개${mismatched ? ` (지문 불일치 ${mismatched})` : ''}${failed ? ` (받지 못함 ${failed})` : ''}`,
    '',
    '· 소통기록.csv: 마이김변에 저장된 통화·문자·카톡·방문 기록 (내용 지문은 저장할 때 서버가 계산한 값)',
    '· 녹음 원본은 마이김변 비공개 저장소에서 받은 그대로이며, 받은 파일 지문을 서버 지문과 대조했어요.',
    '· AI 대화록은 참고용이에요. 원본 녹음이 기준이에요.',
    '· 이 파일에는 개인정보가 들어 있어요. 사건에 필요한 곳에만 쓰고 보관에 주의해 주세요.',
  ].join('\n'));
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, fileName: `증빙_${safe(label)}_${new Date().toISOString().slice(0, 10)}.zip`, recordings: recs.length, mismatched, failed };
}
