// ============================================================
// 사건 화면 '수임료 수납' (FE-1~FE-6) — 서버 원본
// 약정(회차) 만들기·바꾸기(사유), 납부 기록(추가만)·취소(사유), 의뢰인 '입금했어요' 확정·반려
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronUp, Plus, RefreshCw, Wallet } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import { findCaseByConsultRequest } from '../../../services/cases/caseCoreService';
import {
  INSTALLMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  buildInstallments,
  loadClientReports,
  loadCurrentAgreement,
  loadFeePayments,
  loadFeeStatus,
  recordFeePayment,
  rejectClientReport,
  setFeeAgreement,
  voidFeePayment,
  type FeeAgreement,
  type FeeClientReport,
  type FeeInstallmentStatus,
  type FeePayment,
  type InstallmentInput,
} from '../../../services/fees/feeService';

interface Props {
  officeId: string;
  consultRequestId: string;
  canRecord: boolean;
  /** 계약서 수임료 (원) — 처음 약정을 만들 때 기본값 */
  contractTotalFeeWon?: number;
  contractId?: string;
}

const won = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-');
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const nextMonth = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};
const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-sky-50 text-sky-700 border-sky-200',
  overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  scheduled: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function ServerFeePanel({ officeId, consultRequestId, canRecord, contractTotalFeeWon, contractId }: Props) {
  const dialog = useDialog();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<FeeAgreement | null>(null);
  const [rows, setRows] = useState<FeeInstallmentStatus[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [reports, setReports] = useState<FeeClientReport[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const found = await findCaseByConsultRequest(officeId, consultRequestId);
    if (found.ok === false) { setError(found.message); setLoading(false); return; }
    if (!found.data) { setCaseId(null); setLoading(false); return; }
    const id = found.data.id;
    setCaseId(id);
    const [a, s, p, r] = await Promise.all([loadCurrentAgreement(id), loadFeeStatus(id), loadFeePayments(id), loadClientReports(id)]);
    const firstErr = [a, s, p, r].find(x => x.ok === false) as { message: string } | undefined;
    if (firstErr) { setError(firstErr.message); setLoading(false); return; }
    setAgreement(a.ok ? a.data : null);
    setRows(s.ok ? s.data : []);
    setPayments(p.ok ? p.data : []);
    setReports(r.ok ? r.data : []);
    setLoading(false);
  }, [officeId, consultRequestId]);

  useEffect(() => { void load(); }, [load]);

  // ── 약정 편집 ──
  const [editing, setEditing] = useState(false);
  const [total, setTotal] = useState('');
  const [down, setDown] = useState('');
  const [downOn, setDownOn] = useState(today());
  const [count, setCount] = useState('5');
  const [firstDue, setFirstDue] = useState(nextMonth());
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const base = agreement?.totalFeeWon ?? contractTotalFeeWon ?? 0;
    setTotal(base ? String(base) : '');
    setDown('');
    setDownOn(today());
    setCount('5');
    setFirstDue(nextMonth());
    setReason('');
    setFormError('');
    setEditing(true);
  };

  const preview: InstallmentInput[] = useMemo(() => {
    const t = Number(total.replace(/[^0-9]/g, ''));
    const d = Number(down.replace(/[^0-9]/g, '')) || 0;
    const c = Number(count) || 0;
    if (!t || !firstDue) return [];
    return buildInstallments({ totalFeeWon: t, downPaymentWon: d, downPaymentOn: downOn, count: c, firstDueOn: firstDue });
  }, [total, down, downOn, count, firstDue]);

  const saveAgreement = async () => {
    if (!caseId || saving) return;
    setFormError('');
    const t = Number(total.replace(/[^0-9]/g, ''));
    if (!t) { setFormError('총 수임료를 입력해 주세요.'); return; }
    if (preview.length === 0) { setFormError('회차를 만들 수 없어요. 착수금·회차 수·첫 납부일을 확인해 주세요.'); return; }
    if (agreement && !reason.trim()) { setFormError('일정을 바꾸는 사유를 입력해 주세요.'); return; }
    setSaving(true);
    const r = await setFeeAgreement(caseId, {
      totalFeeWon: t,
      installments: preview,
      source: !agreement && contractId ? 'contract' : 'manual',
      contractId: !agreement ? contractId : undefined,
      reason: agreement ? reason.trim() : undefined,
    });
    setSaving(false);
    if (r.ok === false) { setFormError(r.message); return; }
    toast.success(agreement ? `수납 일정을 바꿨습니다 (v${r.data.version}).` : '수납 일정을 만들었습니다.');
    setEditing(false);
    void load();
  };

  // ── 납부 기록 ──
  const [payOpen, setPayOpen] = useState(false);
  const [payOn, setPayOn] = useState(today());
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<FeePayment['method']>('transfer');
  const [payer, setPayer] = useState('');
  const [payMemo, setPayMemo] = useState('');
  const [payError, setPayError] = useState('');
  const [payReportId, setPayReportId] = useState<string | undefined>();

  const openPay = (preset?: { amount?: number; on?: string; payer?: string; reportId?: string }) => {
    setPayOn(preset?.on || today());
    setPayAmount(preset?.amount ? String(preset.amount) : '');
    setPayMethod('transfer');
    setPayer(preset?.payer || '');
    setPayMemo('');
    setPayError('');
    setPayReportId(preset?.reportId);
    setPayOpen(true);
  };

  const savePayment = async () => {
    if (!caseId || saving) return;
    setPayError('');
    const amt = Number(payAmount.replace(/[^0-9]/g, ''));
    if (!amt) { setPayError('입금액을 입력해 주세요.'); return; }
    const ok = await dialog.confirm({ title: '납부 기록', message: `${payOn} ${amt.toLocaleString('ko-KR')}원을 납부로 기록합니다. 기록은 고칠 수 없고 취소만 할 수 있습니다.`, confirmText: '기록' });
    if (!ok) return;
    setSaving(true);
    const r = await recordFeePayment(caseId, { paidOn: payOn, amountWon: amt, method: payMethod, payerName: payer, memo: payMemo, clientReportId: payReportId });
    setSaving(false);
    if (r.ok === false) { setPayError(r.message); return; }
    toast.success('납부를 기록했습니다.');
    setPayOpen(false);
    void load();
  };

  const voidPayment = async (p: FeePayment) => {
    const reasonText = await dialog.prompt({ title: '납부 기록 취소', message: `${p.paidOn} ${won(p.amountWon)} 기록을 취소합니다. 사유를 입력해 주세요.`, placeholder: '예: 금액 잘못 입력' });
    if (!reasonText || !reasonText.trim()) return;
    const r = await voidFeePayment(p.id, reasonText.trim());
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('납부 기록을 취소했습니다.');
    void load();
  };

  const rejectReport = async (rep: FeeClientReport) => {
    const reasonText = await dialog.prompt({ title: '입금 알림 반려', message: '통장에서 입금을 찾지 못한 경우 등 사유를 입력해 주세요. 의뢰인 화면에 표시됩니다.', placeholder: '반려 사유' });
    if (!reasonText || !reasonText.trim()) return;
    const r = await rejectClientReport(rep.id, reasonText.trim());
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('입금 알림을 반려했습니다.');
    void load();
  };

  const paidTotal = payments.filter(p => !p.voidedAt).reduce((s, p) => s + p.amountWon, 0);
  const overdue = rows.filter(r => r.status === 'overdue');
  const pendingReports = reports.filter(r => r.status === 'pending');
  const field = 'w-full p-2.5 rounded-xl border border-slate-200 text-sm';

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-xs" aria-label="수임료 수납">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2 font-extrabold text-slate-900"><Wallet className="w-5 h-5 text-slate-700" />수임료 수납 (서버 기록)</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {agreement && <span className="tabular-nums">납부 {won(paidTotal)} / {won(agreement.totalFeeWon)}</span>}
          {overdue.length > 0 && <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold">기한 지남 {overdue.length}</span>}
          {pendingReports.length > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold">입금 알림 {pendingReports.length}</span>}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {loading && <div className="h-24 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {!loading && error && (
            <div role="alert" className="flex items-center justify-between gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
              <button onClick={() => void load()} className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap cursor-pointer"><RefreshCw className="w-3.5 h-3.5 inline mr-1" />다시</button>
            </div>
          )}
          {!loading && !error && !caseId && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">위 '서버 사건 기록'을 먼저 시작하면 수납 일정을 서버에 기록할 수 있습니다.</p>
          )}

          {!loading && !error && caseId && (
            <>
              {pendingReports.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-amber-800">의뢰인 입금 알림 (확인 필요)</h4>
                  {pendingReports.map(rep => (
                    <div key={rep.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm">
                      <span>{rep.reportedPaidOn} · <strong className="tabular-nums">{won(rep.amountWon)}</strong>{rep.payerName ? ` · 입금자 ${rep.payerName}` : ''}{rep.note ? ` · ${rep.note}` : ''}</span>
                      {canRecord && (
                        <span className="flex gap-2">
                          <button onClick={() => rejectReport(rep)} className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold whitespace-nowrap cursor-pointer">반려</button>
                          <button onClick={() => openPay({ amount: rep.amountWon, on: rep.reportedPaidOn, payer: rep.payerName, reportId: rep.id })} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap cursor-pointer">통장 확인 후 기록</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!agreement && !editing && (
                <div className="text-center py-6 space-y-3 border border-dashed border-slate-300 rounded-xl">
                  <p className="text-sm text-slate-600">수납 일정이 없습니다.{contractTotalFeeWon ? ` 계약서 수임료 ${won(contractTotalFeeWon)}로 시작할 수 있습니다.` : ''}</p>
                  {canRecord && <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer"><Plus className="w-4 h-4" />수납 일정 만들기</button>}
                </div>
              )}

              {editing && (
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">총 수임료(원)</span><input inputMode="numeric" value={total} onChange={e => setTotal(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">착수금(원)</span><input inputMode="numeric" value={down} onChange={e => setDown(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">착수금 납부일</span><input type="date" value={downOn} onChange={e => setDownOn(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">나머지 분할 회차</span><input type="number" min={0} max={60} value={count} onChange={e => setCount(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">첫 분할 납부일</span><input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className={field} /></label>
                    {agreement && <label className="space-y-1 col-span-2 md:col-span-1"><span className="text-xs font-bold text-slate-700">바꾸는 사유 *</span><input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} className={field} /></label>}
                  </div>
                  {preview.length > 0 && (
                    <ul className="text-xs text-slate-700 grid grid-cols-2 md:grid-cols-4 gap-1">
                      {preview.map(p => <li key={p.label + p.dueOn} className="tabular-nums">{p.label} {p.dueOn} {won(p.amountWon)}</li>)}
                    </ul>
                  )}
                  {formError && <p className="text-sm text-rose-600" role="alert">{formError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(false)} className="px-4 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold whitespace-nowrap cursor-pointer">취소</button>
                    <button onClick={saveAgreement} disabled={saving} className="px-4 min-h-[44px] rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{saving ? '저장 중…' : agreement ? '새 일정으로 바꾸기' : '일정 만들기'}</button>
                  </div>
                </div>
              )}

              {agreement && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">약정 v{agreement.version} · {agreement.source === 'contract' ? '계약서 기준' : '직접 입력'} · 총 {won(agreement.totalFeeWon)} · 남은 금액 {won(Math.max(0, agreement.totalFeeWon - paidTotal))}</p>
                    {canRecord && !editing && (
                      <span className="flex gap-2">
                        <button onClick={startEdit} className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold whitespace-nowrap cursor-pointer">일정 바꾸기</button>
                        <button onClick={() => openPay()} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap cursor-pointer">납부 기록</button>
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-50 text-slate-600 text-xs"><th className="p-2 text-left">회차</th><th className="p-2 text-left">납부일</th><th className="p-2 text-right">금액</th><th className="p-2 text-right">남은 금액</th><th className="p-2 text-left">상태</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map(r => (
                          <tr key={r.installmentId}>
                            <td className="p-2 font-bold">{r.label}</td>
                            <td className="p-2 tabular-nums">{r.dueOn}</td>
                            <td className="p-2 text-right tabular-nums">{won(r.amountWon)}</td>
                            <td className="p-2 text-right tabular-nums">{won(r.remainingWon)}</td>
                            <td className="p-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${STATUS_STYLE[r.status]}`}>{INSTALLMENT_STATUS_LABEL[r.status]}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {payOpen && (
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">입금일</span><input type="date" value={payOn} onChange={e => setPayOn(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">입금액(원)</span><input inputMode="numeric" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={field} /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">방법</span>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value as FeePayment['method'])} className={field}>
                        {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-700">입금자</span><input value={payer} onChange={e => setPayer(e.target.value)} maxLength={40} className={field} /></label>
                    <label className="space-y-1 col-span-2"><span className="text-xs font-bold text-slate-700">메모</span><input value={payMemo} onChange={e => setPayMemo(e.target.value)} maxLength={300} className={field} /></label>
                  </div>
                  {payError && <p className="text-sm text-rose-600" role="alert">{payError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setPayOpen(false)} className="px-4 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold whitespace-nowrap cursor-pointer">취소</button>
                    <button onClick={savePayment} disabled={saving} className="px-4 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{saving ? '기록 중…' : '납부 기록'}</button>
                  </div>
                </div>
              )}

              {payments.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-800">납부 기록</h4>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {payments.map(p => (
                      <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm ${p.voidedAt ? 'opacity-60' : ''}`}>
                        <span className="tabular-nums">{p.paidOn} · <strong>{won(p.amountWon)}</strong> · {PAYMENT_METHOD_LABEL[p.method]}{p.payerName ? ` · ${p.payerName}` : ''}{p.source === 'client_report_confirmed' ? ' · 의뢰인 알림 확인' : ''}{p.voidedAt ? ` · 취소됨(${p.voidReason || ''})` : ''}</span>
                        {canRecord && !p.voidedAt && <button onClick={() => voidPayment(p)} className="text-xs font-bold text-rose-600 hover:underline whitespace-nowrap cursor-pointer">기록 취소</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
