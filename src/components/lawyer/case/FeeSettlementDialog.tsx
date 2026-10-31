// 사건 수납 › '수임료 정산' (FE-10): 계약 해지·사임·의뢰인 철회 때. 환불액은 변호사가 직접 넣는다(자동 계산 안 함).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { useDialog } from '../../common/DialogProvider';
import { SETTLEMENT_REASON_LABEL, loadSettlements, settleFeeCase, type FeeSettlement, type SettlementReason } from '../../../services/fees/feeService';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const num = (s: string) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
const input = 'w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm bg-white';

export function FeeSettlementHistory({ caseId, refreshKey }: { caseId: string; refreshKey: unknown }) {
  const [list, setList] = useState<FeeSettlement[]>([]);
  useEffect(() => { void loadSettlements(caseId).then(setList); }, [caseId, refreshKey]);
  if (list.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-slate-600">정산 기록</h4>
      {list.map(s => (
        <p key={s.id} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          {new Date(s.createdAt).toLocaleDateString('ko-KR')} · {SETTLEMENT_REASON_LABEL[s.reason]} · 받은 {won(s.receivedWon)} · 실비 {won(s.expenseWon)} · 환불 {won(s.refundWon)}{s.refundOn ? `(${s.refundOn})` : ''}{s.note ? ` · ${s.note}` : ''}
        </p>
      ))}
    </div>
  );
}

export default function FeeSettlementDialog({ caseId, paidTotal, onClose, onDone }: { caseId: string; paidTotal: number; onClose: () => void; onDone: () => void }) {
  const dialog = useDialog();
  const [reason, setReason] = useState<SettlementReason>('client_withdrew');
  const [expenses, setExpenses] = useState<Array<{ label: string; amount: string }>>([{ label: '인지대·송달료', amount: '' }]);
  const [refund, setRefund] = useState('');
  const [refundOn, setRefundOn] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);

  const submit = async () => {
    const r = num(refund);
    if (r > paidTotal) { setErr('환불액이 받은 금액보다 많아요.'); return; }
    if (r > 0 && !refundOn) { setErr('환불일을 넣어 주세요.'); return; }
    setErr('');
    const ok = await dialog.confirm({
      title: '수임료 정산',
      message: `받은 ${won(paidTotal)} · 실비 ${won(expenseTotal)} · 환불 ${won(r)}로 정산합니다. 남은 회차는 없어지고 안내도 나가지 않아요. 정산 기록은 고칠 수 없어요.`,
      confirmText: '정산하기', variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    const res = await settleFeeCase(caseId, { reason, refundWon: r, refundOn: refundOn || undefined, note, expenses: expenses.filter(e => num(e.amount) > 0).map(e => ({ label: e.label, amountWon: num(e.amount) })) });
    setBusy(false);
    if (res.ok === false) { setErr(res.message); return; }
    toast.success('정산했어요. 남은 회차를 정리했어요.');
    onDone();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="fee-settle-title">
        <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 id="fee-settle-title" className="font-extrabold text-slate-900">수임료 정산 (해지·사임·철회)</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <p className="text-slate-600">받은 수임료 {won(paidTotal)}. 계약서 특약(예: 접수 전 철회 시 실비 외 환불)을 확인하고 환불액을 직접 넣어 주세요.</p>
            <label className="block space-y-1 font-bold text-slate-700">사유
              <select className={input} value={reason} onChange={e => setReason(e.target.value as SettlementReason)}>
                {(Object.keys(SETTLEMENT_REASON_LABEL) as SettlementReason[]).map(k => <option key={k} value={k}>{SETTLEMENT_REASON_LABEL[k]}</option>)}
              </select>
            </label>
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700">쓴 실비</span>
              {expenses.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <input className={input} value={e.label} aria-label="실비 이름" onChange={ev => setExpenses(p => p.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
                  <input className={`${input} max-w-[9rem] text-right`} inputMode="numeric" value={e.amount} placeholder="원" aria-label="실비 금액" onChange={ev => setExpenses(p => p.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))} />
                  <button type="button" onClick={() => setExpenses(p => p.filter((_, j) => j !== i))} aria-label="실비 줄 지우기" className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setExpenses(p => [...p, { label: '', amount: '' }])} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"><Plus className="w-3.5 h-3.5" />실비 줄 더하기</button>
              <p className="text-xs text-slate-500">실비 합계 {won(expenseTotal)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 font-bold text-slate-700">환불액
                <input className={`${input} text-right`} inputMode="numeric" value={refund} onChange={e => setRefund(e.target.value)} placeholder="0" />
              </label>
              <label className="space-y-1 font-bold text-slate-700">환불일
                <input type="date" className={input} value={refundOn} onChange={e => setRefundOn(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1 font-bold text-slate-700">메모 (선택)
              <input className={input} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="예: 접수 전 철회, 특약 3조 적용" />
            </label>
            {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl border border-slate-200 font-bold text-sm whitespace-nowrap">닫기</button>
            <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white font-bold text-sm whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">정산하기</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
