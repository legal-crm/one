// 보정 대응 보조 (CR-11·CR-12): 사건 조회 보정 감지 · 통장 표 → T2 · 선례 문안 · 사무소 보정 통계
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, BookMarked, Landmark, Radar } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { CourtEvent } from '../../../types';
import {
  deletePrecedent, loadCorrectionStats, loadPrecedents, savePrecedent, updateCorrectionItem,
  type CorrectionItem, type CorrectionOrder, type CorrectionPrecedent, type CorrectionStats,
} from '../../../services/corrections/correctionService';
import { parseCsv, statementToT2Rows } from '../../../services/corrections/bankStatementParse';

const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

// ── 대법원 사건 조회 기록에서 보정 감지 → 등록 안내 (자동 등록 안 함, 송달일은 원문 기준) ──
export function CourtCorrectionHint({ events, orders, canManage, onRegister }: {
  events?: CourtEvent[]; orders: CorrectionOrder[]; canManage: boolean; onRegister: () => void;
}) {
  const hit = useMemo(() => {
    const list = (events || []).filter(e => e && (e.type === 'correction' || /보정/.test(`${e.title || ''} ${e.detail || ''}`)) && /^\d{4}-\d{2}-\d{2}/.test(e.date || ''));
    if (list.length === 0) return null;
    const latest = list.sort((a, b) => b.date.localeCompare(a.date))[0];
    // 그 날짜 3일 전 이후 송달일로 등록한 회차가 있으면 이미 등록한 것으로 본다
    const day = latest.date.slice(0, 10);
    const border = new Date(`${day}T00:00:00`);
    border.setDate(border.getDate() - 3);
    const covered = orders.some(o => new Date(`${o.servedOn}T00:00:00`) >= border);
    return covered ? null : latest;
  }, [events, orders]);
  if (!hit) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-2" role="status">
      <Radar className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
      <p className="text-xs text-amber-900 flex-1">
        사건 조회 기록에 보정 관련 기록이 있어요 ({hit.date.slice(0, 10)} · {hit.title}). 원문을 받으셨다면 회차를 등록해 주세요. 송달일은 원문에 적힌 날짜를 넣어 주세요.
      </p>
      {canManage && <button type="button" onClick={onRegister} className={`${btn} bg-amber-600 text-white`}>회차 등록</button>}
    </div>
  );
}

// ── 통장 거래내역 표 → T2 (CR-11) ──
const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf';

/** PDF는 글자 조각을 위치로 묶어 표로 만든다. 표를 못 만들면 사유를 담아 실패 */
async function readPdfTable(buf: ArrayBuffer): Promise<unknown[][]> {
  const { extractPdfTextItems } = await import('../../../services/corrections/pdfTextExtract');
  const { pdfItemsToTable } = await import('../../../services/corrections/pdfStatementTable');
  const { items, truncated } = await extractPdfTextItems(buf);
  if (items.length === 0) throw new Error('scan');
  const table = pdfItemsToTable(items);
  if (!table) throw new Error('noheader');
  if (truncated) toast.info('앞 60쪽까지만 읽었어요. 나머지는 기간을 나눠 다시 올려 주세요.');
  return table;
}

async function readTable(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  if (isPdf(file)) return readPdfTable(buf);
  if (/\.csv$|\.txt$/i.test(file.name) || file.type === 'text/csv') {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) text = new TextDecoder('euc-kr').decode(buf);
    return parseCsv(text.replace(/^\uFEFF/, ''));
  }
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][];
}

export function T2ImportButton({ item, onDone }: { item: CorrectionItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState('1000000');
  const [account, setAccount] = useState('');
  if (item.tableType !== 'T2') return null;
  const run = async (file: File) => {
    const th = Number(threshold.replace(/[^0-9]/g, ''));
    if (!th) { toast.error('기준 금액을 적어 주세요.'); return; }
    // 엑셀 읽기 라이브러리(SheetJS 0.18.5) 알려진 취약점 노출을 줄이려고 크기를 제한한다. PDF는 10MB까지
    const limitMb = isPdf(file) ? 10 : 5;
    if (file.size > limitMb * 1024 * 1024) { toast.error(`${limitMb}MB 이하 파일만 읽을 수 있어요. 기간을 나눠 내려받아 주세요.`); return; }
    setBusy(true);
    try {
      const table = await readTable(file);
      const r = statementToT2Rows(table, th, account.trim());
      if (!r.headerFound) { toast.error('거래일·입금·출금 머리글을 찾지 못했어요. 은행 원본 엑셀을 그대로 올려 주세요.'); return; }
      if (r.rows.length === 0) { toast.info(`${r.scanned}건 중 기준 금액 이상인 거래가 없어요.`); return; }
      const merged: Array<Record<string, string>> = [...item.tableRows, ...r.rows.map(x => ({ ...x }) as Record<string, string>)].slice(0, 300);
      const saved = await updateCorrectionItem(item.id, { tableRows: merged });
      if (saved.ok === false) { toast.error(saved.message); return; }
      toast.success(`${r.scanned}건 중 ${r.rows.length}건을 표에 넣었어요. 확인한 뒤 의뢰인에게 요청하면 의뢰인이 사용처를 채워요.`);
      onDone();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'scan') toast.error('PDF에서 글자를 찾지 못했어요. 스캔한 그림 PDF는 읽을 수 없어요. 은행에서 엑셀·CSV 또는 글자 PDF로 내려받아 주세요.');
      else if (code === 'noheader') toast.error('PDF에서 거래일·입금·출금 머리글을 찾지 못했어요. 은행 거래내역 원본 PDF인지 확인하거나 엑셀로 내려받아 주세요.');
      else toast.error('파일을 읽지 못했어요. 은행에서 받은 엑셀·CSV·PDF 파일인지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-black text-slate-800 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> 통장 거래내역에서 큰 금액 줄 채우기</p>
      <p className="text-xs text-slate-500">은행 엑셀·CSV·글자 PDF를 이 화면에서만 읽어요(서버·외부 AI로 보내지 않음). 스캔 PDF는 읽지 못해요. 사용처 칸은 비워 두고 의뢰인이 채워요. 넣은 줄은 원본과 맞는지 꼭 확인해 주세요.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-700 space-y-1">기준 금액(원)
          <input value={threshold} onChange={e => setThreshold(e.target.value)} inputMode="numeric" className="block w-36 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-700 space-y-1">계좌 (예: 국민 1234)
          <input value={account} onChange={e => setAccount(e.target.value)} maxLength={30} className="block w-40 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
        <label className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}>
          {busy ? '읽는 중…' : '거래내역 파일 고르기'}
          <input type="file" accept=".xlsx,.xls,.csv,.txt,.pdf,application/pdf" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} />
        </label>
      </div>
    </div>
  );
}

// ── 선례 문안 (CR-12) ──
export function usePrecedents(officeId: string) {
  const [list, setList] = useState<CorrectionPrecedent[] | null>(null);
  const reload = async () => {
    const r = await loadPrecedents(officeId);
    setList(r.ok ? r.data : []);
  };
  useEffect(() => { void reload(); }, [officeId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, reload };
}

export function PrecedentTools({ item, precedents, canFinalize, maskTerms, onPick, onSaved }: {
  item: CorrectionItem; precedents: CorrectionPrecedent[] | null; canFinalize: boolean; maskTerms: string[];
  onPick: (text: string) => void; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const sameCat = (precedents || []).filter(p => !item.category || p.category === item.category);
  const save = async () => {
    setBusy(true);
    const r = await savePrecedent(item.id, item.clientTitle || item.category || '', maskTerms);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('선례로 저장했어요. 이름·사건번호·전화번호는 가렸어요 — 보관함에서 한 번 더 확인해 주세요.');
    onSaved();
  };
  const remove = async (id: string) => {
    const r = await deletePrecedent(id);
    if (r.ok === false) { toast.error(r.message); return; }
    onSaved();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <BookMarked className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
      {sameCat.length > 0 ? (
        <select aria-label="선례 문안 불러오기" defaultValue="" onChange={e => { const p = sameCat.find(x => x.id === e.target.value); if (p) onPick(p.answerText); e.target.value = ''; }}
          className="min-h-[44px] rounded-xl border border-slate-200 px-2 bg-white max-w-[16rem]">
          <option value="">선례 문안 불러오기 ({sameCat.length})</option>
          {sameCat.map(p => <option key={p.id} value={p.id}>{p.title}{p.courtName ? ` · ${p.courtName}` : ''}</option>)}
        </select>
      ) : <span className="text-slate-500">같은 분류의 선례가 없어요</span>}
      {canFinalize && item.answerText && <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} border border-slate-200 text-slate-700`}>이 문안을 선례로 저장</button>}
      {canFinalize && sameCat.length > 0 && (
        <details className="relative">
          <summary className="cursor-pointer min-h-[44px] inline-flex items-center text-slate-500 underline underline-offset-2">선례 지우기</summary>
          <ul className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-xl shadow-md p-2 space-y-1 min-w-[14rem]">
            {sameCat.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.title}</span>
                <button type="button" onClick={() => void remove(p.id)} className="min-h-[36px] px-2 rounded-lg border border-rose-200 text-rose-700">지우기</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ── 사무소 보정 통계 (CR-12, 사무소 안에서만) ──
export function CorrectionStatsCard({ officeId }: { officeId: string }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<CorrectionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || stats) return;
    void loadCorrectionStats(officeId).then(r => { if (r.ok === false) setError(r.message); else setStats(r.data); });
  }, [open, stats, officeId]);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-left">
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> 사무소 보정 통계</span>
        <span className="text-xs text-slate-500">법원별 횟수·처리 일수·자주 나온 분류</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-xs">
          {error && <p className="text-rose-700" role="alert">{error}</p>}
          {!stats && !error && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {stats && stats.byCourt.length === 0 && <p className="text-slate-500">아직 보정 기록이 없어요. 회차를 등록하면 법원별로 모여요.</p>}
          {stats && stats.byCourt.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr className="text-slate-500">{['법원', '회차', '제출', '평균 처리(일)', '연장 신청'].map(h => <th key={h} className="text-left font-bold border-b border-slate-200 py-1 pr-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.byCourt.map(c => (
                      <tr key={c.court}><td className="py-1 pr-3 font-bold text-slate-800">{c.court}</td><td className="pr-3">{c.orders}</td><td className="pr-3">{c.submitted}</td><td className="pr-3">{c.avgDays ?? '–'}</td><td>{c.extensions}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-bold text-slate-700 mb-1">자주 나온 분류</p>
                <ul className="flex flex-wrap gap-1.5">
                  {stats.byCategory.slice(0, 15).map(c => (
                    <li key={`${c.court}-${c.category}`} className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                      {c.court} · {c.category} {c.items}건{c.cannot ? ` · 못 냄 ${c.cannot}` : ''}{c.needsFix ? ` · 보완 ${c.needsFix}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-slate-500">이 사무소 기록만 모았어요. 의뢰인 이름·사건번호는 들어가지 않아요.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
