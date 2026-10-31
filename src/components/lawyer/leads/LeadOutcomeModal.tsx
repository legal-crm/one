// 결과 적기 (SL-3, 15 기획서 5-3) — 첫 질문 "연결됐나요?"
//  아니요 → 부재(자동 n차·다음 시도 시각) / 결번
//  네 → 상담 중(다음 할 일 선택) / 재통화 약속(빠른 버튼) / 종료(사유 필수)
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PhoneCall, X } from 'lucide-react';
import type { LeadCloseReason, SalesLead } from '../../../types/leadTypes';
import { LEAD_CLOSE_REASONS, NOT_ELIGIBLE_DETAILS } from '../../../types/leadTypes';
import { nextAttemptAfterNoAnswer, type CallOutcome } from '../../../services/sales/leadRules';
import { getSalesSettings } from '../../../services/sales/salesSettingsService';
import { recordLeadOutcome } from '../../../services/leadService';
import { sendQuickSmsOrCopy } from '../../../services/communicationService';

const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50';
const choice = (on: boolean) => `min-h-[44px] p-3 rounded-xl border text-left text-sm font-bold active:scale-[0.98] cursor-pointer ${on ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] ring-2 ring-[#1E3A5F]/30' : 'border-slate-200 bg-white text-slate-700'}`;
const fmt = (d: Date) => d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const localInput = (d: Date) => { const k = new Date(d.getTime() + 9 * 3600e3); return k.toISOString().slice(0, 16); };
const fromLocalInput = (v: string) => new Date(`${v}:00+09:00`);

export default function LeadOutcomeModal({ lead, caller, officeName, onClose, onSaved }: {
  lead: SalesLead;
  caller: { id: string; name: string };
  officeName?: string;
  onClose: () => void;
  onSaved: (lead: SalesLead) => void;
}) {
  const rules = getSalesSettings().rules;
  const [connected, setConnected] = useState<boolean | null>(null);
  const [kind, setKind] = useState<'no_answer' | 'wrong_number' | 'counseling' | 'callback' | 'closed' | null>(null);
  const [callbackAt, setCallbackAt] = useState(() => localInput(new Date(Date.now() + 3600e3)));
  const [nextAt, setNextAt] = useState('');
  const [reason, setReason] = useState<LeadCloseReason | ''>('');
  const [detail, setDetail] = useState('');
  const [recontactOn, setRecontactOn] = useState('');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState('');
  const nextCount = (lead.noAnswerCount || 0) + 1;
  const nextNoAnswer = useMemo(() => nextAttemptAfterNoAnswer(nextCount, new Date(), rules), [nextCount, rules]);

  const quick = (label: string, at: Date) => (
    <button key={label} type="button" onClick={() => setCallbackAt(localInput(at))} className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">{label}</button>
  );
  const today = (h: number) => { const k = new Date(Date.now() + 9 * 3600e3); k.setUTCHours(h, 0, 0, 0); return new Date(k.getTime() - 9 * 3600e3); };
  const tomorrow = (h: number) => new Date(today(h).getTime() + 24 * 3600e3);

  const save = async () => {
    setErr('');
    let outcome: CallOutcome;
    if (kind === 'no_answer') outcome = { kind: 'no_answer' };
    else if (kind === 'wrong_number') outcome = { kind: 'closed', reason: 'wrong_number' };
    else if (kind === 'counseling') outcome = { kind: 'counseling', nextAt: nextAt ? fromLocalInput(nextAt).toISOString() : undefined };
    else if (kind === 'callback') {
      if (!callbackAt) { setErr('다시 연락할 시각을 골라 주세요.'); return; }
      outcome = { kind: 'callback', at: fromLocalInput(callbackAt).toISOString() };
    } else if (kind === 'closed') {
      if (!reason) { setErr('종료 사유를 골라 주세요.'); return; }
      if (reason === 'later' && !recontactOn) { setErr('다시 연락할 날을 골라 주세요.'); return; }
      outcome = { kind: 'closed', reason, detail, recontactOn: reason === 'later' ? recontactOn : undefined };
    } else { setErr('결과를 골라 주세요.'); return; }
    const res = recordLeadOutcome(lead.id, caller, outcome, memo.trim() || undefined);
    if (!res) { setErr('리드를 찾지 못했어요. 목록을 새로 불러와 주세요.'); return; }
    onSaved(res.lead);
    if (res.autoClosed) toast.info(`부재 ${res.lead.noAnswerCount}회라 '연락 불가'로 종료했어요.`);
    else toast.success('결과를 기록했어요.');
    if (res.suggestSms) {
      const text = getSalesSettings().noAnswerSms.replace(/\{사무소\}/g, officeName || '법률사무소');
      toast(`부재 ${res.lead.noAnswerCount}회예요. 부재 문자를 한 번 보낼까요?`, {
        duration: 12000,
        action: { label: '문자 보내기', onClick: () => { void sendQuickSmsOrCopy(lead.phone, text).then(r => (r.sent ? toast.success(r.message) : toast.info(r.message))); } },
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="lead-outcome-title" className="w-full max-w-lg rounded-3xl bg-white shadow-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 id="lead-outcome-title" className="text-base font-black text-slate-900 flex items-center gap-2"><PhoneCall className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" /> {lead.customerName} 결과 적기</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm text-slate-700">
          <p className="text-xs text-slate-500">{lead.phone} · 지금까지 부재 {lead.noAnswerCount || 0}회 · 통화 {lead.callCount || 0}회</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-800 mb-1">연결됐나요?</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={choice(connected === false)} onClick={() => { setConnected(false); setKind('no_answer'); }}>아니요</button>
              <button type="button" className={choice(connected === true)} onClick={() => { setConnected(true); setKind('counseling'); }}>네, 통화했어요</button>
            </div>
          </fieldset>

          {connected === false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" className={choice(kind === 'no_answer')} onClick={() => setKind('no_answer')}>
                부재 ({nextCount}차)
                <span className="block text-xs font-medium text-slate-500 mt-0.5">{nextNoAnswer ? `다음 시도 ${fmt(nextNoAnswer)}` : `${nextCount}번째 부재라 '연락 불가'로 종료돼요`}</span>
              </button>
              <button type="button" className={choice(kind === 'wrong_number')} onClick={() => setKind('wrong_number')}>
                결번·잘못된 번호
                <span className="block text-xs font-medium text-slate-500 mt-0.5">종료로 기록해요</span>
              </button>
            </div>
          )}

          {connected === true && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className={choice(kind === 'counseling')} onClick={() => setKind('counseling')}>상담 중</button>
                <button type="button" className={choice(kind === 'callback')} onClick={() => setKind('callback')}>재통화 약속</button>
                <button type="button" className={choice(kind === 'closed')} onClick={() => setKind('closed')}>종료</button>
              </div>
              {kind === 'counseling' && (
                <label className="block text-xs font-semibold text-slate-700">다음 할 일 시각 (선택)
                  <input type="datetime-local" value={nextAt} onChange={e => setNextAt(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
                </label>
              )}
              {kind === 'callback' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {quick('1시간 뒤', new Date(Date.now() + 3600e3))}
                    {quick('오늘 저녁', today(19))}
                    {quick('내일 오전', tomorrow(10))}
                    {quick('내일 오후', tomorrow(15))}
                  </div>
                  <label className="block text-xs font-semibold text-slate-700">약속 시각
                    <input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
                  </label>
                </div>
              )}
              {kind === 'closed' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">종료 사유
                    <select value={reason} onChange={e => { setReason(e.target.value as LeadCloseReason); setDetail(''); }} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                      <option value="">고르세요</option>
                      {LEAD_CLOSE_REASONS.filter(r => r.key !== 'unreachable' && r.key !== 'wrong_number').map(r => <option key={r.key} value={r.key}>{r.label}{r.hint ? ` (${r.hint})` : ''}</option>)}
                    </select>
                  </label>
                  {reason === 'not_eligible' && (
                    <label className="block text-xs font-semibold text-slate-700">세부 (선택)
                      <select value={detail} onChange={e => setDetail(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                        <option value="">고르지 않음</option>
                        {NOT_ELIGIBLE_DETAILS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <span className="block mt-1 text-[11px] font-medium text-slate-500">사무소 안 기록이에요. 고객에게 '대상 아님' 같은 결과를 보내지 않아요.</span>
                    </label>
                  )}
                  {reason === 'later' && (
                    <label className="block text-xs font-semibold text-slate-700">다시 연락할 날
                      <input type="date" value={recontactOn} onChange={e => setRecontactOn(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
                    </label>
                  )}
                  {reason === 'opt_out' && <p className="text-[11px] text-slate-500">이 번호는 수신 거부 목록에 남고, 접수 주소로 다시 들어오면 받지 않아요.</p>}
                </div>
              )}
            </>
          )}

          <label className="block text-xs font-semibold text-slate-700">메모 (선택)
            <input value={memo} maxLength={300} onChange={e => setMemo(e.target.value)} placeholder="예: 저녁 7시 이후 통화 원함" className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
          </label>
          {err && <p role="alert" className="text-xs font-semibold text-rose-700">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className={`${btn} border border-slate-300 bg-white text-slate-700`}>닫기</button>
          <button type="button" disabled={!kind} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}>기록하기</button>
        </div>
      </div>
    </div>
  );
}
