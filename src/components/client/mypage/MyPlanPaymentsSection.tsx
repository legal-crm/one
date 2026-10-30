// 의뢰인 '내 사건' › 법원 변제금 (CM-8, CM-11)
// 사무소가 만든 법원 변제금 회차를 보여 주고, 냈으면 '납부했어요'로 알린다. 확인은 사무소가 한다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck } from 'lucide-react';
import { listPlanPayments, markPlanPayment, type PlanPayment } from '../../../services/cases/caseCoreService';
import { localYmd } from '../../../utils/localDate';

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export default function MyPlanPaymentsSection({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<PlanPayment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const today = localYmd();
  const load = useCallback(async () => {
    const r = await listPlanPayments(caseId);
    setRows(r.ok ? r.data : []);
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);
  if (!rows || rows.length === 0) return null;

  const open = rows.filter(r => r.status === 'unpaid');
  const upcoming = open.filter(r => r.dueOn >= today).slice(0, 2);
  const late = open.filter(r => r.dueOn < today);
  const done = rows.filter(r => r.status === 'confirmed').length;
  const show = [...late, ...upcoming];

  const report = async (p: PlanPayment) => {
    setBusy(p.id);
    const r = await markPlanPayment(p.id, 'client_report', today);
    setBusy(null);
    if (!r.ok) { toast.error('알리지 못했어요. 잠시 뒤 다시 눌러 주세요.'); return; }
    toast.success('사무소에 알렸어요. 법원 계좌 입금을 확인하면 \'확인됨\'으로 바뀌어요.');
    void load();
  };

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2" aria-label="법원 변제금">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><CalendarCheck className="w-4 h-4 text-slate-500" aria-hidden="true" /> 법원 변제금 {rows.length}회 중 {done}회 확인됨</p>
      {late.length > 0 && <p className="text-xs font-bold text-rose-700">기한이 지난 회차가 {late.length}개 있어요. 이미 냈다면 '납부했어요'를 눌러 주시고, 내기 어렵다면 사무소에 바로 알려 주세요.</p>}
      <ul className="space-y-1.5">
        {show.map(p => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-slate-800">{p.kind === 'pre_confirmation' ? '적립' : ''}{p.roundNo}회</span>
            <span className={p.dueOn < today ? 'text-rose-700 font-bold' : 'text-slate-600'}>{p.dueOn}</span>
            <span className="font-bold text-slate-900">{won(p.amount)}</span>
            <button type="button" disabled={busy === p.id} onClick={() => void report(p)}
              className="ml-auto min-h-[44px] px-3 rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
              {busy === p.id ? '알리는 중…' : '납부했어요'}
            </button>
          </li>
        ))}
        {rows.filter(r => r.status === 'client_reported').slice(0, 3).map(p => (
          <li key={p.id} className="text-xs text-amber-800">{p.roundNo}회 납부를 알렸어요 · 사무소 확인 중</li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">변제금은 법원이 정한 계좌(회생위원 계좌)로 내요. 계좌는 법원 안내문이나 사무소 안내를 확인해 주세요.</p>
    </section>
  );
}
