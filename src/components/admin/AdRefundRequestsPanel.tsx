// 통합어드민 › 광고 주문 › 환불 요청 (AD-8 환불 도우미)
// 규정(AD-Q4): 노출 시작 전 전액, 노출 중 남은 날 일할·위약금 없음. 계산은 서버가 하고 관리자는 확정만 한다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { AdOrder } from '../../types';
import { adminResolveAdRequest, fetchAdOrderRequests, type AdOrderRequest } from '../../services/adOrderService';
import { useDialog } from '../common/DialogProvider';

const btn = 'min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50';
const won = (n?: number | null) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-');

export default function AdRefundRequestsPanel({ orders, onResolved }: { orders: AdOrder[]; onResolved: () => void }) {
  const dialog = useDialog();
  const [list, setList] = useState<AdOrderRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const r = await fetchAdOrderRequests(true);
    if (r.ok === false) { setError(r.message); return; }
    setList(r.data);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // 주문 목록이 새로 읽힐 때(60초) 같이 새로 읽는다
  useEffect(() => { void load(); }, [orders.length, load]);

  const approve = async (q: AdOrderRequest, order?: AdOrder) => {
    const raw = (amounts[q.id] ?? String(q.suggestedRefund)).replace(/[^0-9]/g, '');
    const amount = Number(raw);
    const total = order?.totalPrice ?? 0;
    if (!raw || !Number.isFinite(amount) || amount < 0 || (total > 0 && amount > total)) { toast.error('환불액은 0원 이상, 결제 금액 이하로 적어 주세요.'); return; }
    const ok = await dialog.confirm({
      title: '환불 승인',
      message: `${won(amount)}을 환불하고 광고를 바로 내립니다. 이체는 따로 해 주세요.${order?.taxInvoice ? ' 세금계산서가 발행된 주문이라 수정세금계산서도 발행해 주세요.' : ''}`,
      confirmText: '승인',
    });
    if (!ok) return;
    setBusy(q.id);
    const r = await adminResolveAdRequest(q.id, 'approve', amount, amount !== q.suggestedRefund ? `규정 계산 ${won(q.suggestedRefund)}과 다르게 확정` : undefined);
    setBusy(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('환불을 승인했어요. 주문이 취소되고 사무소에 알림이 갔어요.');
    void load();
    onResolved();
  };

  const reject = async (q: AdOrderRequest) => {
    const note = await dialog.prompt({ title: '환불 요청 반려', message: '사무소에 보낼 반려 사유를 적어 주세요.', placeholder: '사유' });
    if (!note || !String(note).trim()) return;
    setBusy(q.id);
    const r = await adminResolveAdRequest(q.id, 'reject', null, String(note));
    setBusy(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('반려했어요. 사무소에 사유가 전달됐어요.');
    void load();
  };

  if (error) {
    return (
      <div role="alert" className="bg-[#111622] border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-sm text-rose-300">
        <AlertTriangle className="w-4 h-4 shrink-0" /> 환불 요청을 불러오지 못했어요: {error}
        <button onClick={() => void load()} className={`${btn} ml-auto bg-white/10 text-white`}><RefreshCw className="w-3.5 h-3.5 inline mr-1" />다시</button>
      </div>
    );
  }
  if (!list || list.length === 0) return null;

  return (
    <section className="bg-[#111622] border border-rose-500/20 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-black text-white">환불 요청 {list.length}건 <span className="text-xs font-medium text-slate-400 ml-2">노출 시작 전 전액 · 노출 중 남은 날 일할 (오늘은 노출한 날로 계산)</span></h3>
      <ul className="space-y-2">
        {list.map(q => {
          const o = orders.find(x => x.id === q.orderId);
          return (
            <li key={q.id} className="rounded-xl border border-white/10 p-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-bold text-white">{o ? `${o.lawyerName} · ${o.productName}${o.region ? ` (${o.region})` : ''}` : q.orderId}</p>
                <p className="text-xs text-slate-400">{o ? `${o.startsOn || '-'} ~ ${o.endsOn || '-'} · 결제 ${won(o.totalPrice)} · ` : ''}요청 {new Date(q.requestedAt).toLocaleDateString('ko-KR')}</p>
                <p className="text-xs text-slate-300">사유: {q.reason}</p>
              </div>
              <label className="text-xs text-slate-300">환불액
                <input
                  inputMode="numeric"
                  value={amounts[q.id] ?? String(q.suggestedRefund)}
                  onChange={e => setAmounts(a => ({ ...a, [q.id]: e.target.value }))}
                  className="ml-2 w-32 min-h-[36px] rounded-lg bg-[#0B0F19] border border-white/10 px-2 text-right text-white tabular-nums"
                />
              </label>
              <span className="text-[11px] text-slate-400">규정 계산 {won(q.suggestedRefund)}</span>
              <button disabled={busy === q.id} onClick={() => void approve(q, o)} className={`${btn} bg-emerald-600 text-white`}>환불 승인</button>
              <button disabled={busy === q.id} onClick={() => void reject(q)} className={`${btn} bg-white/10 text-slate-200`}>반려</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
