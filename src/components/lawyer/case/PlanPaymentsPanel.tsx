// 변제 수행 장부 (CM-8) — 법원 변제금 회차(인가 전 적립금 포함)와 납부 확인
// 의뢰인이 '납부했어요'를 누르면 '보고됨'으로 오고 사무소가 확인한다. 연속 미납 1·2·3회는 단계 경고.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarRange, CheckCircle2 } from 'lucide-react';
import {
  buildMonthlyRounds, listPlanPayments, loadPlanPaymentOverview, markPlanPayment, setPlanPayments,
  type PlanPayment, type PlanPaymentOverview,
} from '../../../services/cases/caseCoreService';
import { localYmd } from '../../../utils/localDate';

const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5';
const input = 'w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm';
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const STATUS: Record<PlanPayment['status'], { label: string; cls: string }> = {
  unpaid: { label: '미확인', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  client_reported: { label: '의뢰인 납부 알림', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: '납부 확인', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  waived: { label: '해당 없음', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export default function PlanPaymentsPanel({ caseId, canEdit, commencedOn, confirmedOn }: { caseId: string; canEdit: boolean; commencedOn?: string | null; confirmedOn?: string | null }) {
  const [rows, setRows] = useState<PlanPayment[] | null>(null);
  const [ov, setOv] = useState<PlanPaymentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kind: 'plan' as PlanPayment['kind'], firstDue: '', months: '36', amount: '' });
  const [busy, setBusy] = useState(false);
  const today = localYmd();

  const load = useCallback(async () => {
    const [r, o] = await Promise.all([listPlanPayments(caseId), loadPlanPaymentOverview(caseId)]);
    if (!r.ok) { setError(r.message); return; }
    setError(null);
    setRows(r.data);
    if (o.ok) setOv(o.data);
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => ({
    pre: (rows || []).filter(r => r.kind === 'pre_confirmation'),
    plan: (rows || []).filter(r => r.kind === 'plan'),
  }), [rows]);

  const create = async () => {
    const months = Number(form.months);
    const amount = Number(form.amount.replace(/[^0-9]/g, ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.firstDue)) { toast.error('첫 납부일을 넣어 주세요.'); return; }
    if (!Number.isInteger(months) || months < 1 || months > 120) { toast.error('회차 수는 1~120으로 넣어 주세요.'); return; }
    if (!amount) { toast.error('월 변제금을 넣어 주세요.'); return; }
    const existing = form.kind === 'pre_confirmation' ? groups.pre : groups.plan;
    const keep = existing.filter(r => r.status !== 'unpaid');
    // 확인·보고된 회차는 서버가 그대로 둔다. 같은 종류의 남은 회차만 새로 만든다
    const other = (form.kind === 'pre_confirmation' ? groups.plan : groups.pre).filter(r => r.status === 'unpaid')
      .map(r => ({ roundNo: r.roundNo, dueOn: r.dueOn, amount: r.amount, kind: r.kind }));
    const next = buildMonthlyRounds(form.firstDue, months, amount, 1, form.kind).filter(r => !keep.some(k => k.roundNo === r.roundNo));
    setBusy(true);
    const res = await setPlanPayments(caseId, [...other, ...next]);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`${form.kind === 'pre_confirmation' ? '인가 전 적립' : '변제'} 회차표를 만들었어요.`);
    setShowForm(false);
    void load();
  };

  const mark = async (p: PlanPayment, action: 'confirm' | 'unpaid' | 'waive') => {
    const r = await markPlanPayment(p.id, action, action === 'confirm' ? (p.paidOn || today) : undefined);
    if (!r.ok) { toast.error(r.message); return; }
    void load();
  };

  if (error) return <p role="alert" className="text-xs text-rose-700">변제 장부를 불러오지 못했어요: {error}</p>;
  if (rows === null) return <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-labelledby="plan-pay-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="plan-pay-title" className="text-sm font-black text-slate-900 flex items-center gap-1.5"><CalendarRange className="w-4 h-4" aria-hidden="true" /> 변제 수행 장부</h4>
        {canEdit && <button type="button" onClick={() => setShowForm(v => !v)} className={`${btn} border border-slate-300 text-slate-700`}>회차표 만들기·바꾸기</button>}
      </div>
      {ov && ov.rounds > 0 && (
        <p className="text-xs text-slate-700">
          {ov.rounds}회 중 확인 {ov.confirmed}{ov.reported ? ` · 의뢰인 알림 ${ov.reported}` : ''} · 납부 확인 {won(ov.paidWon)} / {won(ov.totalWon)}{ov.nextDue ? ` · 다음 ${ov.nextDue}` : ''}
        </p>
      )}
      {ov && ov.streak > 0 && (
        <div role="alert" className={`rounded-xl border p-2.5 text-xs flex items-start gap-2 ${ov.streak >= 3 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {ov.streak}회 연속 납부 확인이 안 됐어요.{' '}
            {ov.streak >= 3 ? '변제계획 변경 신청이나 폐지 가능성을 의뢰인과 바로 상의해 주세요.' : ov.streak === 2 ? '의뢰인에게 사정을 확인하고 변경 신청이 필요한지 검토해 주세요.' : '법원 계좌 입금 여부를 확인해 주세요.'}
          </span>
        </div>
      )}
      {showForm && canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <label className="font-semibold text-slate-700 space-y-1">종류
            <select className={input} value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as PlanPayment['kind'] }))}>
              <option value="plan">인가 후 변제</option>
              <option value="pre_confirmation">인가 전 적립</option>
            </select>
          </label>
          <label className="font-semibold text-slate-700 space-y-1">첫 납부일<input type="date" className={input} value={form.firstDue} onChange={e => setForm(f => ({ ...f, firstDue: e.target.value }))} /></label>
          <label className="font-semibold text-slate-700 space-y-1">회차 수<input className={input} inputMode="numeric" value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} /></label>
          <label className="font-semibold text-slate-700 space-y-1">월 변제금(원)<input className={input} inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></label>
          <p className="sm:col-span-3 text-slate-500 self-center">
            {form.kind === 'pre_confirmation' ? `개시결정(${commencedOn || '미기록'})부터 인가 전까지 법원 계좌에 쌓는 적립금이에요.` : `인가결정(${confirmedOn || '미기록'}) 뒤 변제계획안의 회차예요.`} 확인·알림이 있는 회차는 그대로 두고 나머지만 다시 만들어요.
          </p>
          <button type="button" disabled={busy} onClick={() => void create()} className={`${btn} bg-[#1E3A5F] text-white justify-center`}>{busy ? '만드는 중…' : '회차표 저장'}</button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">아직 회차표가 없어요. 개시결정·인가결정 뒤 '회차표 만들기'로 법원 변제금 일정을 넣으면 의뢰인 화면에도 보여요.</p>
      ) : (
        <div className="space-y-2">
          {(['pre', 'plan'] as const).map(g => groups[g].length > 0 && (
            <div key={g}>
              <p className="text-xs font-bold text-slate-600 mb-1">{g === 'pre' ? '인가 전 적립' : '인가 후 변제'}</p>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                {groups[g].map(p => {
                  const late = p.status === 'unpaid' && p.dueOn < today;
                  return (
                    <li key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-black text-slate-500 w-10">{p.roundNo}회</span>
                      <span className="text-slate-700 w-24">{p.dueOn}</span>
                      <span className="font-bold text-slate-800 w-28">{won(p.amount)}</span>
                      <span className={`border rounded-lg px-1.5 py-0.5 font-bold ${late ? 'bg-rose-50 text-rose-700 border-rose-200' : STATUS[p.status].cls}`}>{late ? '기한 지남' : STATUS[p.status].label}{p.paidOn ? ` · ${p.paidOn}` : ''}</span>
                      {canEdit && p.status !== 'confirmed' && <button type="button" onClick={() => void mark(p, 'confirm')} className={`${btn} border border-emerald-200 text-emerald-700 ml-auto`}><CheckCircle2 className="w-3.5 h-3.5" /> 납부 확인</button>}
                      {canEdit && p.status === 'confirmed' && <button type="button" onClick={() => void mark(p, 'unpaid')} className={`${btn} border border-slate-200 text-slate-600 ml-auto`}>확인 취소</button>}
                      {canEdit && p.status === 'unpaid' && <button type="button" onClick={() => void mark(p, 'waive')} className={`${btn} border border-slate-200 text-slate-500`}>해당 없음</button>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
