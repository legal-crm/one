// ============================================================
// 광고 주문 한 줄의 할 일 (AD-7): 입금 전 신청 취소 · 연장 신청 · 환불 요청
// 규칙은 서버 함수(ad_cancel_my_order·ad_renew_order·ad_request_refund)가 정한다
// ============================================================
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AdOrder } from '../../../types';
import {
  cancelMyAdOrder, quoteAdPrice, quoteAdRefund, renewAdOrder, requestAdRefund, withdrawAdRefundRequest,
  type AdOrderRequest, type AdPriceQuote, type AdRefundQuote,
} from '../../../services/adOrderService';

const won = (n?: number | null) => (typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString('ko-KR')}원` : '-');
const todayYmd = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const MONTH_CHOICES = [1, 3, 6, 12];
const REQ_LABEL: Record<AdOrderRequest['status'], string> = { open: '환불 요청 검토 중', approved: '환불 승인', rejected: '환불 반려', withdrawn: '환불 요청 거둠' };

interface Props {
  order: AdOrder;
  request?: AdOrderRequest;
  renewed: boolean;
  canManage: boolean;
  onChanged: () => void;
}

export default function AdOrderActions({ order, request, renewed, canManage, onChanged }: Props) {
  const [dialog, setDialog] = useState<'refund' | 'renew' | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [refundQuote, setRefundQuote] = useState<AdRefundQuote | null>(null);
  const [months, setMonths] = useState(1);
  const [depositor, setDepositor] = useState('');
  const [renewQuote, setRenewQuote] = useState<AdPriceQuote | null>(null);
  const [inlineError, setInlineError] = useState('');

  const renewStart = order.endsOn && order.endsOn > todayYmd() ? order.endsOn : todayYmd();

  useEffect(() => {
    if (dialog !== 'refund') return;
    let stop = false;
    setRefundQuote(null);
    quoteAdRefund(order.id).then(r => { if (!stop) { if (r.ok) setRefundQuote(r.data); else setInlineError(r.message); } });
    return () => { stop = true; };
  }, [dialog, order.id]);

  useEffect(() => {
    if (dialog !== 'renew' || !order.productId) return;
    let stop = false;
    setRenewQuote(null);
    quoteAdPrice(order.productId, months, renewStart).then(r => { if (!stop) { if (r.ok) { setRenewQuote(r.data); setInlineError(''); } else setInlineError(r.message); } });
    return () => { stop = true; };
  }, [dialog, order.productId, months, renewStart]);

  const open = (d: 'refund' | 'renew') => { setDialog(d); setReason(''); setMonths(1); setDepositor(''); setInlineError(''); };

  const cancelPending = async () => {
    setBusy(true);
    const r = await cancelMyAdOrder(order.id);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('신청을 취소했어요. 예약한 구좌가 풀렸어요.');
    onChanged();
  };

  const submitRefund = async () => {
    if (reason.trim().length < 2) { setInlineError('환불 사유를 적어 주세요.'); return; }
    setBusy(true);
    const r = await requestAdRefund(order.id, reason);
    setBusy(false);
    if (r.ok === false) { setInlineError(r.message); return; }
    toast.success('환불 요청을 보냈어요. 마이김변이 확인한 뒤 결과를 알려 드려요.');
    setDialog(null);
    onChanged();
  };

  const withdraw = async () => {
    if (!request) return;
    setBusy(true);
    const r = await withdrawAdRefundRequest(request.id);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('환불 요청을 거뒀어요.');
    onChanged();
  };

  const submitRenew = async () => {
    setBusy(true);
    const r = await renewAdOrder(order.id, months, depositor);
    setBusy(false);
    if (r.ok === false) { setInlineError(r.message); return; }
    toast.success(`연장 신청을 접수했어요. ${r.data.startsOn}부터 노출돼요. 입금 기한 안에 입금해 주세요.`);
    setDialog(null);
    onChanged();
  };

  const live = order.status === 'paid' || order.status === 'active';
  const btn = 'min-h-[36px] px-2.5 rounded-lg border text-[11px] font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-60';

  return (
    <div className="flex flex-col gap-1.5 items-start">
      {request && <span className={`text-[11px] font-bold ${request.status === 'rejected' ? 'text-rose-700' : 'text-slate-600'}`}>{REQ_LABEL[request.status]}{request.status === 'rejected' && request.resolveNote ? `: ${request.resolveNote}` : ''}</span>}
      {canManage && order.status === 'pending' && (
        <button type="button" disabled={busy} onClick={() => void cancelPending()} className={`${btn} border-slate-300 text-slate-700`}>신청 취소</button>
      )}
      {canManage && live && !renewed && (
        <button type="button" disabled={busy} onClick={() => open('renew')} className={`${btn} border-[#1E3A5F]/40 text-[#1E3A5F]`}>연장 신청</button>
      )}
      {canManage && live && renewed && <span className="text-[11px] text-slate-500">연장 신청함</span>}
      {canManage && live && request?.status !== 'open' && (
        <button type="button" disabled={busy} onClick={() => open('refund')} className={`${btn} border-rose-300 text-rose-700`}>환불 요청</button>
      )}
      {canManage && request?.status === 'open' && (
        <button type="button" disabled={busy} onClick={() => void withdraw()} className={`${btn} border-slate-300 text-slate-700`}>요청 거두기</button>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !busy && setDialog(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby={`ad-act-${order.id}`} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg space-y-4 text-left" onClick={e => e.stopPropagation()}>
            <h3 id={`ad-act-${order.id}`} className="text-base font-black text-slate-900">{order.productName}{order.region ? ` (${order.region})` : ''} {dialog === 'refund' ? '환불 요청' : '연장 신청'}</h3>
            {dialog === 'refund' ? (
              <>
                <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                  {!refundQuote && !inlineError && <div className="h-4 w-40 rounded-lg bg-slate-200 animate-pulse" />}
                  {refundQuote && (
                    <>
                      <p>결제 금액 {won(refundQuote.total)}</p>
                      <p className="font-black text-slate-900">예상 환불액 {won(refundQuote.amount)}</p>
                      <p>{refundQuote.rule === 'before_start' ? '노출이 시작되기 전이라 전액 환불 기준이에요.'
                        : refundQuote.rule === 'prorated' ? `노출 기간 ${refundQuote.days}일 중 남은 ${refundQuote.daysLeft}일만큼 일할 계산했어요. 오늘은 노출한 날로 쳐요. 위약금은 없어요.`
                        : '환불할 금액이 없어요.'}</p>
                      <p className="text-slate-500">마이김변이 확인한 뒤 확정해요. 환불이 승인되면 광고는 바로 내려가요.</p>
                    </>
                  )}
                </div>
                <label className="block text-xs font-semibold text-slate-700">환불 사유
                  <textarea value={reason} maxLength={500} rows={3} onChange={e => { setReason(e.target.value); setInlineError(''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-700">지금 광고가 끝나는 날({renewStart})부터 같은 상품·지역으로 새로 신청해요. 남은 구좌가 없으면 신청할 수 없어요.</p>
                <label className="block text-xs font-semibold text-slate-700">연장 기간
                  <select value={months} onChange={e => setMonths(Number(e.target.value))} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                    {MONTH_CHOICES.map(m => <option key={m} value={m}>{m}개월</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">입금자명 (선택)
                  <input value={depositor} maxLength={40} onChange={e => setDepositor(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
                </label>
                <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
                  {renewQuote ? (
                    <p>공급가 {won(renewQuote.supply)} + VAT {won(renewQuote.vat)} = <span className="font-black text-slate-900">입금액 {won(renewQuote.total)}</span></p>
                  ) : !inlineError && <div className="h-4 w-48 rounded-lg bg-slate-200 animate-pulse" />}
                </div>
              </>
            )}
            {inlineError && <p role="alert" className="text-xs font-semibold text-rose-700">{inlineError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">닫기</button>
              {dialog === 'refund'
                ? <button type="button" disabled={busy || !refundQuote} onClick={() => void submitRefund()} className="min-h-[44px] px-4 rounded-xl bg-rose-700 text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '보내는 중…' : '환불 요청 보내기'}</button>
                : <button type="button" disabled={busy || !renewQuote} onClick={() => void submitRenew()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '신청 중…' : '연장 신청하기'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
