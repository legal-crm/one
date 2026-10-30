// 의뢰인 '내 사건' 수임료 납부 일정 (FE-7·FE-Q2): 회차·납부 상태 읽기 + '입금했어요' 알림 (확정은 사무소)
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  INSTALLMENT_STATUS_LABEL,
  clientReportPayment,
  loadClientReports,
  loadFeeStatus,
  type FeeClientReport,
  type FeeInstallmentStatus,
} from '../../../services/fees/feeService';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default function MyCaseFeeSection({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<FeeInstallmentStatus[] | null>(null);
  const [reports, setReports] = useState<FeeClientReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([loadFeeStatus(caseId), loadClientReports(caseId)]);
    if (s.ok === false) { setError(s.message); return; }
    setError(null);
    setRows(s.data);
    setReports(r.ok ? r.data : []);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="mt-3 text-xs text-rose-600" role="alert">수임료 일정을 불러오지 못했어요: {error}</p>;
  if (rows === null) return <div className="mt-3 h-12 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />;
  if (rows.length === 0) return null;

  const next = rows.find(r => r.status !== 'paid');
  const pending = reports.filter(r => r.status === 'pending');
  const lastRejected = reports.find(r => r.status === 'rejected');

  const send = async () => {
    setFormError('');
    const amt = Number(amount.replace(/[^0-9]/g, ''));
    if (!amt) { setFormError('입금한 금액을 입력해 주세요.'); return; }
    setSending(true);
    const r = await clientReportPayment(caseId, { paidOn, amountWon: amt, payerName: payer.trim() || undefined });
    setSending(false);
    if (r.ok === false) { setFormError(r.message); return; }
    toast.success('입금 알림을 보냈어요. 사무소가 통장을 확인한 뒤 납부로 기록해요.');
    setFormOpen(false);
    setAmount('');
    void load();
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">수임료 납부 일정</span>
        {next && <span className="text-xs text-slate-600">다음 납부 {next.dueOn} · {won(next.remainingWon)}</span>}
      </div>
      <ul className="divide-y divide-slate-200 text-sm">
        {rows.map(r => (
          <li key={r.installmentId} className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-slate-700">{r.label} · {r.dueOn}</span>
            <span className="tabular-nums text-slate-900">{won(r.amountWon)} <span className={`ml-1 text-xs font-bold ${r.status === 'paid' ? 'text-emerald-700' : r.status === 'overdue' ? 'text-rose-700' : 'text-slate-500'}`}>{INSTALLMENT_STATUS_LABEL[r.status]}</span></span>
          </li>
        ))}
      </ul>
      {pending.length > 0 && <p className="text-xs text-amber-800">사무소 확인을 기다리는 입금 알림 {pending.length}건이 있어요.</p>}
      {lastRejected && pending.length === 0 && <p className="text-xs text-slate-600">최근 입금 알림이 확인되지 않았어요: {lastRejected.rejectReason}</p>}
      {!formOpen ? (
        <button onClick={() => { setFormOpen(true); setAmount(next ? String(next.remainingWon) : ''); }} className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 whitespace-nowrap active:scale-[0.98] cursor-pointer">
          입금했어요
        </button>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">입금일</span><input type="date" value={paidOn} max={today()} onChange={e => setPaidOn(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">금액(원)</span><input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" /></label>
            <label className="space-y-1 col-span-2"><span className="text-xs font-bold text-slate-700">입금자명 (통장에 찍힌 이름)</span><input value={payer} onChange={e => setPayer(e.target.value)} maxLength={40} className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" /></label>
          </div>
          {formError && <p className="text-xs text-rose-600" role="alert">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setFormOpen(false)} className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold whitespace-nowrap cursor-pointer">취소</button>
            <button onClick={send} disabled={sending} className="flex-1 min-h-[44px] rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{sending ? '보내는 중…' : '사무소에 알리기'}</button>
          </div>
          <p className="text-[11px] text-slate-500">이 알림은 영수증이 아니에요. 사무소가 입금을 확인하면 '완납'으로 바뀌어요.</p>
        </div>
      )}
    </div>
  );
}
