// 수임료 수납 탭 위 '서버 수납 현황' (FE-1·FE-9) — fee_office_overview
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Wallet } from 'lucide-react';
import { loadFeeOverview, type FeeOverviewRow } from '../../../services/fees/feeService';
import { listCases } from '../../../services/cases/caseCoreService';

const won = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-');

export default function ServerFeeOverview({ officeId, onOpenCase }: { officeId: string; onOpenCase: (consultRequestId: string) => void }) {
  const [rows, setRows] = useState<FeeOverviewRow[] | null>(null);
  const [requestIdByCase, setRequestIdByCase] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [o, c] = await Promise.all([loadFeeOverview(officeId), listCases({ officeId, view: 'all', limit: 500 })]);
    if (o.ok === false) { setError(o.message); return; }
    setRows(o.data);
    if (c.ok) {
      const map: Record<string, string> = {};
      c.data.forEach(cs => { if (cs.consultRequestId) map[cs.id] = cs.consultRequestId; });
      setRequestIdByCase(map);
    }
  }, [officeId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => (rows || []).reduce((acc, r) => ({
    total: acc.total + r.totalFeeWon,
    paid: acc.paid + r.paidWon,
    overdue: acc.overdue + (r.overdueCount > 0 ? 1 : 0),
    reports: acc.reports + r.pendingReports,
  }), { total: 0, paid: 0, overdue: 0, reports: 0 }), [rows]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-4 mb-6" aria-label="서버 수납 현황">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-slate-700" />수납 현황 (서버 기록)</h3>
        <button onClick={() => void load()} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 whitespace-nowrap cursor-pointer"><RefreshCw className="w-3.5 h-3.5" />새로고침</button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4" />{error}</p>
      )}
      {!error && rows === null && <div className="h-20 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
      {!error && rows && rows.length === 0 && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">서버에 기록된 수납 일정이 없습니다. 사건 화면의 '수임료 수납 (서버 기록)'에서 일정을 만들면 여기에 모입니다.</p>
      )}
      {!error && rows && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '약정 합계', value: won(totals.total) },
              { label: '납부 합계', value: won(totals.paid) },
              { label: '기한 지난 사건', value: `${totals.overdue}건` },
              { label: '입금 알림 확인 필요', value: `${totals.reports}건` },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500 font-bold block">{c.label}</span>
                <strong className="text-base text-slate-900 tabular-nums">{c.value}</strong>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-600"><th className="p-2 text-left">의뢰인</th><th className="p-2 text-right">약정</th><th className="p-2 text-right">납부</th><th className="p-2 text-right">남은 금액</th><th className="p-2 text-left">다음 납부</th><th className="p-2 text-left">확인</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => {
                  const reqId = requestIdByCase[r.caseId];
                  return (
                    <tr key={r.caseId} className={reqId ? 'hover:bg-slate-50 cursor-pointer' : ''} onClick={() => reqId && onOpenCase(reqId)}>
                      <td className="p-2 font-bold text-slate-900">{r.clientDisplayName || r.caseTitle || '이름 없음'}</td>
                      <td className="p-2 text-right tabular-nums">{won(r.totalFeeWon)}</td>
                      <td className="p-2 text-right tabular-nums">{won(r.paidWon)}</td>
                      <td className="p-2 text-right tabular-nums">{won(r.remainingWon)}</td>
                      <td className="p-2 tabular-nums">{r.nextDueOn ? `${r.nextDueOn} · ${won(r.nextDueWon)}` : '완납'}</td>
                      <td className="p-2 space-x-1 whitespace-nowrap">
                        {r.overdueCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">기한 지남 {r.overdueCount}</span>}
                        {r.pendingReports > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">입금 알림 {r.pendingReports}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
