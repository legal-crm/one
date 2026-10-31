// 의뢰인 '내 사건' › 진행 › '사무소에 알리기' (NF-9) — 이사·이직·소득·가족 변동·납부 어려움을 사실대로 알린다
// 변경 신청이 필요한지는 변호사가 판단한다. 여기서는 판단·가능성 문구를 쓰지 않는다
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, CheckCircle2 } from 'lucide-react';
import {
  CASE_CHANGE_HINT, CASE_CHANGE_LABEL, CASE_REPORTS_CHANGED_EVENT, loadCaseClientReports, reportCaseChange,
  type CaseChangeKind, type CaseClientReport,
} from '../../../services/cases/caseClientReportService';

const KINDS: CaseChangeKind[] = ['moved', 'job_change', 'income_change', 'family_change', 'payment_trouble', 'other'];

export default function MyCaseChangeReport({ caseKey }: { caseKey: string }) {
  const [list, setList] = useState<CaseClientReport[] | null>(null);
  const [kind, setKind] = useState<CaseChangeKind | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await loadCaseClientReports(caseKey);
    setList(r.ok ? r.data : []);
  }, [caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CASE_REPORTS_CHANGED_EVENT, h);
    return () => window.removeEventListener(CASE_REPORTS_CHANGED_EVENT, h);
  }, [load]);

  const send = async () => {
    if (!kind) return;
    if (kind === 'other' && !note.trim()) { setError('알릴 내용을 적어 주세요.'); return; }
    setBusy(true); setError('');
    const r = await reportCaseChange(caseKey, kind, note);
    setBusy(false);
    if (r.ok === false) { setError(r.message); return; }
    toast.success('사무소에 알렸어요. 확인하면 알림으로 알려 드려요.');
    setKind(null); setNote('');
    void load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2" aria-label="사무소에 알리기">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><BellRing className="w-4 h-4 text-slate-500" aria-hidden="true" />생활에 바뀐 일이 있으면 사무소에 알려 주세요</p>
      <p className="text-xs text-slate-600">변제 기간 중 이사·이직·소득 변동 등은 법원에 알려야 할 수 있어요. 무엇을 해야 하는지는 담당 변호사가 확인해 안내해요.</p>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(k => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(kind === k ? null : k); setError(''); }}
            className={`min-h-[44px] px-3 rounded-xl border text-sm font-bold whitespace-nowrap active:scale-[0.98] ${kind === k ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-200'}`}>
            {CASE_CHANGE_LABEL[k]}
          </button>
        ))}
      </div>
      {kind && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            {CASE_CHANGE_HINT[kind]}
            <textarea rows={3} value={note} maxLength={1000} onChange={e => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
          </label>
          {error && <p className="text-xs font-bold text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setKind(null); setNote(''); setError(''); }} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap">취소</button>
            <button type="button" onClick={() => void send()} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '보내는 중…' : '사무소에 알리기'}</button>
          </div>
        </div>
      )}
      {list === null ? (
        <div className="h-8 rounded-lg bg-slate-100 animate-pulse" />
      ) : list.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {list.slice(0, 5).map(r => (
            <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-bold">{CASE_CHANGE_LABEL[r.kind]}</span> · {new Date(r.createdAt).toLocaleDateString('ko-KR')}
              {r.status === 'handled'
                ? <span className="ml-1 inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />사무소 확인{r.handleNote ? `: ${r.handleNote}` : ''}</span>
                : <span className="ml-1 font-bold text-amber-700">사무소 확인 전</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 면책 뒤 신용 회복 일반 안내 (NF-9) — 판단 없이 확인 방법만 */
export function MyCreditRecoveryGuide() {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4 space-y-1.5" aria-label="면책 뒤 안내">
      <p className="text-sm font-bold text-slate-900">면책 뒤 확인해 볼 것</p>
      <ul className="text-xs text-slate-700 space-y-1 leading-relaxed list-disc pl-4">
        <li>내 신용정보(대출·연체·공공정보 기록)는 한국신용정보원 '크레딧포유'(credit4u.or.kr)에서 무료로 볼 수 있어요.</li>
        <li>기록이 정리되는 시기는 사건마다 달라요. 궁금하면 담당 사무소에 물어보세요.</li>
        <li>면책결정문·확정증명은 앞으로 필요할 수 있으니 잘 보관해 두세요.</li>
      </ul>
    </section>
  );
}
