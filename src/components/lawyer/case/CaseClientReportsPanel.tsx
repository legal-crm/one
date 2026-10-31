// 사건 화면 › 의뢰인이 알린 변동 (NF-9) — 이사·이직·소득·가족 변동·납부 어려움. 확인하면 의뢰인에게 알림
// 변경 신청(변제계획 변경·주소 변경 신고 등)이 필요한지는 변호사가 판단한다
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import {
  CASE_CHANGE_LABEL, CASE_REPORTS_CHANGED_EVENT, handleCaseClientReport, loadCaseClientReports, type CaseClientReport,
} from '../../../services/cases/caseClientReportService';
import { useDialog } from '../../common/DialogProvider';

export default function CaseClientReportsPanel({ caseKey, canEdit }: { caseKey: string; canEdit: boolean }) {
  const dialog = useDialog();
  const [list, setList] = useState<CaseClientReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadCaseClientReports(caseKey);
    if (r.ok === false) { setError(r.message); setList([]); return; }
    setError(null);
    setList(r.data);
  }, [caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CASE_REPORTS_CHANGED_EVENT, h);
    return () => window.removeEventListener(CASE_REPORTS_CHANGED_EVENT, h);
  }, [load]);

  if (list === null) return <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;
  if (error || list.length === 0) return null; // 알린 일이 없으면 칸을 그리지 않는다

  const open = list.filter(r => r.status === 'open');
  const handle = async (r: CaseClientReport) => {
    const note = await dialog.prompt({
      title: '확인 처리',
      message: '의뢰인에게 보낼 한 줄 안내 (비워도 돼요). 실명·주민번호는 적지 마세요.',
      placeholder: '예: 주소 변경 신고서를 준비해 연락드릴게요',
    });
    if (note === null) return;
    setBusy(r.id);
    const res = await handleCaseClientReport(r.id, String(note));
    setBusy(null);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success('확인 처리했어요. 의뢰인에게 알림이 갔어요.');
    void load();
  };

  return (
    <section className={`rounded-2xl border p-3 space-y-2 ${open.length ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`} aria-label="의뢰인이 알린 변동">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <BellRing className="w-4 h-4 text-amber-600" aria-hidden="true" />의뢰인이 알린 변동{open.length ? ` · 확인 전 ${open.length}건` : ''}
      </p>
      <ul className="space-y-1.5">
        {list.slice(0, 10).map(r => (
          <li key={r.id} className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p><span className="font-bold text-slate-900">{CASE_CHANGE_LABEL[r.kind]}</span> · {new Date(r.createdAt).toLocaleString('ko-KR')}</p>
              {r.note && <p className="mt-0.5 whitespace-pre-line">{r.note}</p>}
              {r.status === 'handled' && <p className="mt-0.5 text-emerald-700 font-bold">확인함{r.handleNote ? ` · ${r.handleNote}` : ''}</p>}
            </div>
            {r.status === 'open' && canEdit && (
              <button type="button" onClick={() => void handle(r)} disabled={busy === r.id}
                className="min-h-[44px] px-3 rounded-xl bg-slate-900 text-white font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">
                {busy === r.id ? '처리 중…' : '확인 처리'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">변제계획 변경·주소 변경 신고 등이 필요한지는 변호사가 판단해요.</p>
    </section>
  );
}
