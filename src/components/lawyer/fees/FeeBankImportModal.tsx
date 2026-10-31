// 수임료 수납 › '거래내역 파일로 맞추기' (FE-9)
// 인터넷뱅킹에서 내려받은 입금 내역(엑셀·CSV)을 이 브라우저에서만 읽는다. 원본 파일은 서버에 올리지 않는다.
// 입금 줄마다 회차 후보(금액·입금자 이름)를 제안하고, 사람이 고른 줄만 납부 기록으로 넣는다. 같은 거래는 두 번 넣지 않는다.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { bankTxSeen, loadFeeOverview, recordBankImport, type FeeOverviewRow } from '../../../services/fees/feeService';
import { candidatesFor, depositsFromTable, readStatementTable, type BankDeposit, type DepositCandidate } from '../../../services/fees/bankImport';

interface Line { dep: BankDeposit; cands: DepositCandidate[]; pick: string; done: 'no' | 'saved' | 'seen' }

export default function FeeBankImportModal({ officeId, onClose, onSaved }: { officeId: string; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<FeeOverviewRow[] | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { void loadFeeOverview(officeId).then(r => setRows(r.ok ? r.data : [])); }, [officeId]);

  const onFile = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) { setMsg('5MB 이하 파일만 읽을 수 있어요.'); return; }
    setBusy(true); setMsg('');
    try {
      const table = await readStatementTable(f);
      const { deposits, headerFound } = await depositsFromTable(table, officeId);
      if (!headerFound) { setMsg('거래일·입금 머리글을 찾지 못했어요. 은행에서 내려받은 원본 파일을 그대로 올려 주세요.'); setLines(null); return; }
      if (deposits.length === 0) { setMsg('입금 줄이 없어요.'); setLines([]); return; }
      const seen = await bankTxSeen(officeId, deposits.map(d => d.hash));
      setLines(deposits.map(dep => {
        const cands = candidatesFor(dep, rows || []);
        return { dep, cands, pick: cands[0] && cands[0].score >= 5 ? cands[0].caseId : '', done: seen.has(dep.hash) ? 'seen' : 'no' };
      }));
    } catch {
      setMsg('파일을 읽지 못했어요. 엑셀(xlsx)이나 CSV 파일인지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!lines) return;
    const todo = lines.filter(l => l.done === 'no' && l.pick);
    if (todo.length === 0) { toast.info('넣을 줄을 골라 주세요.'); return; }
    setBusy(true);
    let ok = 0; let dup = 0; let fail = 0;
    const next = [...lines];
    for (const l of todo) {
      const r = await recordBankImport(l.pick, { paidOn: l.dep.date, amountWon: l.dep.amount, payerName: l.dep.payer, txHash: l.dep.hash });
      const i = next.indexOf(l);
      if (r.ok === false) { fail += 1; if (fail === 1) toast.error(r.message); continue; }
      if (r.data.duplicate) { dup += 1; next[i] = { ...l, done: 'seen' }; } else { ok += 1; next[i] = { ...l, done: 'saved' }; }
    }
    setLines(next);
    setBusy(false);
    toast.success(`납부 ${ok}건을 기록했어요.${dup ? ` 이미 넣은 거래 ${dup}건은 건너뛰었어요.` : ''}${fail ? ` ${fail}건은 넣지 못했어요.` : ''}`);
    if (ok > 0) onSaved();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="fee-bank-import-title">
        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 id="fee-bank-import-title" className="font-extrabold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" aria-hidden="true" />거래내역 파일로 맞추기</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-3 overflow-y-auto">
            <p className="text-sm text-slate-600">인터넷뱅킹에서 내려받은 입금 내역(엑셀·CSV)을 고르세요. 파일은 이 브라우저에서만 읽고 서버에 올리지 않아요. 고른 줄만 납부 기록으로 넣고, 같은 거래는 두 번 넣지 않아요.</p>
            <label className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer active:scale-[0.98]">
              {busy ? '읽는 중…' : '파일 고르기'}
              <input type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only" disabled={busy || rows === null} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f); }} />
            </label>
            {msg && <p className="text-sm text-rose-700" role="alert">{msg}</p>}
            {lines && lines.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr><th className="text-left px-3 py-2">입금일</th><th className="text-right px-3 py-2">금액</th><th className="text-left px-3 py-2">입금자</th><th className="text-left px-3 py-2">사건(후보)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={l.dep.hash}>
                        <td className="px-3 py-2 whitespace-nowrap">{l.dep.date}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{l.dep.amount.toLocaleString('ko-KR')}원</td>
                        <td className="px-3 py-2">{l.dep.payer || '-'}</td>
                        <td className="px-3 py-2">
                          {l.done === 'saved' ? <span className="text-emerald-700 font-bold text-xs">기록함</span>
                            : l.done === 'seen' ? <span className="text-slate-500 text-xs">이미 넣은 거래</span>
                            : (
                              <select aria-label="사건 고르기" value={l.pick} onChange={e => setLines(prev => prev!.map((x, j) => (j === i ? { ...x, pick: e.target.value } : x)))}
                                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-2 text-sm">
                                <option value="">넣지 않음</option>
                                {l.cands.map(c => <option key={c.caseId} value={c.caseId}>{c.label} ({c.reason})</option>)}
                                {(rows || []).filter(r => r.remainingWon > 0 && !l.cands.some(c => c.caseId === r.caseId)).slice(0, 50).map(r => (
                                  <option key={r.caseId} value={r.caseId}>{r.clientDisplayName || r.caseTitle || '사건'} · 남은 {r.remainingWon.toLocaleString('ko-KR')}원</option>
                                ))}
                              </select>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lines && lines.length === 0 && !msg && <p className="text-sm text-slate-500">입금 줄이 없어요.</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">닫기</button>
            <button type="button" disabled={busy || !lines?.some(l => l.done === 'no' && l.pick)} onClick={() => void save()}
              className="min-h-[44px] px-4 rounded-xl -brand text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">
              고른 줄 납부 기록
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
