// 카카오톡 '대화 내보내기' 파일 올리기 (KT-4)
// 1) 파일 고르기 → 이 화면에서 해석(서버·외부 AI로 내용을 보내 해석하지 않음)
// 2) 보낸 사람 맞추기: 이름마다 의뢰인 / 우리 사무소 / 넣지 않음
// 3) 원본 파일 그대로 비공개 저장소에 올리고 서버가 지문(SHA-256)을 다시 계산 → 같을 때만 줄을 소통 기록에 넣음
// 같은 대화를 다시 올리면 이미 있는 줄은 건너뛰고 새 줄만 들어간다. 원본 파일은 회차마다 보관된다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, ShieldCheck, Upload, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { parseKakaoExport, type KakaoParseResult } from '../../../services/comm/kakaoExportParse';
import { getKakaoExportDownloadUrl, importKakaoExport, listKakaoExports, type KakaoExportRecord } from '../../../services/comm/clientNoticeService';
import type { CommTarget } from '../../../services/comm/commService';

type Role = 'client' | 'office' | 'skip';
const FORMAT_LABEL: Record<string, string> = { pc: 'PC 카카오톡', android: '안드로이드', ios: '아이폰', mac_csv: '맥 카카오톡(CSV)', unknown: '알 수 없음' };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  // 오래된 PC 버전은 CP949로 저장되기도 한다
  if (text.includes('\uFFFD')) text = new TextDecoder('euc-kr').decode(buf);
  return text;
}

export default function KakaoExportImportModal({ officeId, target, onClose, onImported }: {
  officeId: string; target: CommTarget; onClose: () => void; onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<KakaoParseResult | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [history, setHistory] = useState<KakaoExportRecord[] | null>(null);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    const r = await listKakaoExports(officeId, target);
    setHistory(r.ok ? r.data : []);
    // 이전에 고른 이름을 다음 파일에 그대로 쓴다
    if (r.ok && r.data[0]) {
      const last = r.data[0];
      setRoles(prev => {
        const next = { ...prev };
        for (const n of last.clientNames) if (!(n in next)) next[n] = 'client';
        for (const n of last.officeNames) if (!(n in next)) next[n] = 'office';
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, target.workspaceKey, target.salesLeadId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const pick = async (f: File) => {
    setError('');
    if (f.size > 10 * 1024 * 1024) { setError('10MB 이하 파일만 올릴 수 있어요. 기간을 나눠 내보내 주세요.'); return; }
    if (!/\.(txt|csv)$/i.test(f.name)) { setError("카카오톡 '대화 내보내기'로 저장한 .txt(맥은 .csv) 파일을 골라 주세요."); return; }
    const text = await readText(f);
    const r = parseKakaoExport(text);
    if (r.lines.length === 0) { setError('대화 줄을 찾지 못했어요. 카카오톡 대화방 › 설정 › 대화 내용 내보내기로 저장한 파일인지 확인해 주세요.'); return; }
    setFile(f);
    setParsed(r);
    setRoles(prev => {
      const next: Record<string, Role> = {};
      for (const s of r.senders) {
        next[s.name] = prev[s.name] || (r.title && s.name === r.title ? 'client' : s.name === '나' || s.name === 'Me' ? 'office' : 'skip');
      }
      return next;
    });
  };

  const clientNames = useMemo(() => Object.entries(roles).filter(([, v]) => v === 'client').map(([k]) => k), [roles]);
  const officeNames = useMemo(() => Object.entries(roles).filter(([, v]) => v === 'office').map(([k]) => k), [roles]);
  const picked = parsed ? parsed.lines.filter(l => roles[l.sender] === 'client' || roles[l.sender] === 'office').length : 0;

  const run = async () => {
    if (!file || !parsed) return;
    if (clientNames.length === 0) { setError('의뢰인 이름을 하나 이상 골라 주세요.'); return; }
    setBusy(true); setError(''); setProgress({ done: 0, total: picked });
    const lines = parsed.lines.filter(l => roles[l.sender] === 'client' || roles[l.sender] === 'office');
    const res = await importKakaoExport(officeId, target, file, {
      format: parsed.format, lines, unparsed: parsed.unparsed, clientNames, officeNames,
    }, (done, total) => setProgress({ done, total }));
    setBusy(false); setProgress(null);
    if (!res.ok) { setError(res.message); void loadHistory(); return; }
    toast.success(`대화를 백업했어요. 새 줄 ${res.data.inserted}개${res.data.duplicates ? `, 이미 있던 줄 ${res.data.duplicates}개는 건너뜀` : ''}.`);
    setFile(null); setParsed(null);
    void loadHistory();
    onImported();
  };

  const download = async (x: KakaoExportRecord) => {
    const r = await getKakaoExportDownloadUrl(x.id);
    if (!r.ok) { toast.error(r.message); return; }
    window.open(r.data, '_blank', 'noopener');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={busy ? undefined : onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="kakao-export-title" className="w-full max-w-3xl rounded-3xl bg-white shadow-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 id="kakao-export-title" className="text-lg font-extrabold text-slate-900">카톡 대화 백업</h2>
              <p className="text-xs text-slate-500 mt-0.5">카카오톡 대화방 › 메뉴 › 설정 › 대화 내용 내보내기 › '텍스트만 보내기'로 저장한 파일을 올려 주세요.</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="min-h-10 min-w-10 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="w-5 h-5 mx-auto" aria-hidden="true" /></button>
          </div>

          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {!parsed && (
              <label className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center cursor-pointer hover:bg-slate-50">
                <Upload className="w-6 h-6 text-slate-500" aria-hidden="true" />
                <span className="text-sm font-bold text-slate-800">대화 파일 고르기 (.txt · 맥은 .csv, 10MB까지)</span>
                <span className="text-xs text-slate-500">파일 내용은 이 화면에서 읽고, 원본은 사무소 비공개 저장소에만 보관돼요. 1:1 대화방 파일만 올려 주세요.</span>
                <input type="file" accept=".txt,.csv,text/plain,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />
              </label>
            )}

            {parsed && file && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-bold text-slate-900"><FileText className="w-4 h-4 inline mr-1" aria-hidden="true" />{file.name}</span>
                  <span>형식: {FORMAT_LABEL[parsed.format]}</span>
                  <span>대화 {parsed.lines.length.toLocaleString()}줄</span>
                  {parsed.lines.length > 0 && <span>{fmt(parsed.lines[0].at)} ~ {fmt(parsed.lines[parsed.lines.length - 1].at)}</span>}
                  {parsed.unparsed > 0 && <span className="text-amber-700">읽지 못한 줄 {parsed.unparsed}개(원본 파일에는 그대로 남아요)</span>}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">보낸 사람 맞추기</h3>
                  <p className="text-xs text-slate-500">의뢰인과 우리 사무소 사람만 소통 기록에 들어가요. 다른 사람의 말은 넣지 않아요.</p>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {parsed.senders.map(s => (
                      <li key={s.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="flex-1 min-w-[120px] text-sm font-semibold text-slate-800">{s.name} <span className="text-xs font-normal text-slate-500">{s.count}줄</span></span>
                        <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} 구분`}>
                          {([['client', '의뢰인'], ['office', '우리 사무소'], ['skip', '넣지 않음']] as const).map(([k, l]) => (
                            <button key={k} type="button" role="radio" aria-checked={roles[s.name] === k} onClick={() => setRoles(r => ({ ...r, [s.name]: k }))}
                              className={`min-h-9 px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] ${roles[s.name] === k ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{l}</button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {progress && <p className="text-xs text-slate-600" aria-live="polite">넣는 중… {progress.done.toLocaleString()} / {progress.total.toLocaleString()}줄</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => { setFile(null); setParsed(null); }} className="min-h-10 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap">다른 파일</button>
                  <button type="button" disabled={busy || clientNames.length === 0} onClick={() => void run()} className="min-h-10 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-50 active:scale-[0.98] whitespace-nowrap">
                    {busy ? '올리는 중…' : `원본 보관하고 ${picked.toLocaleString()}줄 넣기`}
                  </button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

            <div>
              <h3 className="text-sm font-extrabold text-slate-900">올린 대화 파일</h3>
              {history === null ? (
                <div className="mt-2 h-12 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />
              ) : history.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">아직 올린 파일이 없어요.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {history.map(x => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">{x.originalName || '대화 파일'}</span>
                      <span>{fmt(x.createdAt)}</span>
                      {x.status === 'imported' ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 font-bold"><ShieldCheck className="w-3 h-3" aria-hidden="true" />지문 일치 · 새 줄 {x.insertedCount}{x.duplicateCount ? ` · 건너뜀 ${x.duplicateCount}` : ''}</span>
                      ) : x.status === 'mismatch' ? (
                        <span className="rounded-lg bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 font-bold">지문 불일치</span>
                      ) : (
                        <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 font-bold">{x.status === 'uploading' ? '올리다 멈춤' : x.status === 'stored' ? '줄 넣기 전' : '실패'}</span>
                      )}
                      <button type="button" onClick={() => void download(x)} className="ml-auto min-h-8 px-2 rounded-lg text-brand font-bold hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"><Download className="w-3.5 h-3.5" aria-hidden="true" />원본</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-slate-500">원본을 내려받으면 열람 기록이 남아요. 단체 대화방은 다른 사람의 대화가 섞이니 올리지 마세요.</p>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
