// 상담 채팅 머리 아래 '상담 예약' 줄 (NF-3)
// - 예약 없음: [상담 시간 제안]
// - 의뢰인이 보낸 시간: 고르면 바로 확정 / 다른 시간 제안 / 맞지 않아요
// - 내가 보낸 제안: 답 기다림 · 거두기 · 다시 제안
// - 확정: 시각·방식·받을 번호 · 안내 고치기(회의 링크·장소) · 취소
// 확정되면 서버가 사무소 일정('상담 일정')에 넣고 양쪽에 알린다. 전날·1시간 전 알림도 서버가 보낸다.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CalendarPlus, Check, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { useDialog } from '../../common/DialogProvider';
import BookingSlotsFields from '../../common/BookingSlotsFields';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import {
  BOOKING_METHOD_LABEL, CONSULT_BOOKINGS_CHANGED_EVENT, bookingTimeLabel, bookingTurn, currentBookingFor,
  defaultSlotInput, loadConsultBookings, localInputToIso, officeProposeBooking, respondBooking, updateBookingDetails, validateSlots,
  type BookingMethod, type ConsultBooking,
} from '../../../services/consult/consultBookingService';
import { loadOpenSlots, type OpenSlots } from '../../../services/consult/consultHoursService';

const input = 'w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
const smallBtn = 'inline-flex items-center gap-1 h-8 pointer-coarse:h-11 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors active:scale-[0.98] disabled:opacity-50';

function ProposeModal({ requestId, initialMethod, onClose, onDone }: {
  requestId: string; initialMethod: BookingMethod; onClose: () => void; onDone: () => void;
}) {
  const [method, setMethod] = useState<BookingMethod>(initialMethod);
  const [slots, setSlots] = useState<string[]>([defaultSlotInput(new Date(), 1), defaultSlotInput(new Date(), 2)]);
  const [duration, setDuration] = useState(30);
  const [link, setLink] = useState('');
  const [place, setPlace] = useState(() => {
    const p = getOfficeProfile();
    return p.address ? `${p.firmName ? `${p.firmName} · ` : ''}${p.address}`.slice(0, 200) : '';
  });
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 우리 사무소가 열어 둔 상담 가능 시간 (설정 › 사무소 설정 › 상담 가능 시간)
  const [open, setOpen] = useState<OpenSlots>({ enabled: false, slots: [] });
  useEffect(() => {
    let alive = true;
    void loadOpenSlots(requestId).then(o => {
      if (!alive) return;
      setOpen(o);
      if (o.enabled && o.slots.length) setSlots(['']);
      if (o.methods?.length) setMethod(m => (o.methods!.includes(m) ? m : o.methods![0]));
    });
    return () => { alive = false; };
  }, [requestId]);

  const submit = async () => {
    const iso = slots.map(localInputToIso).filter(Boolean);
    const bad = validateSlots(iso);
    if (bad) { setErr(bad); return; }
    if (method === 'video' && link.trim() && !/^https:\/\/\S{4,}$/.test(link.trim())) { setErr('회의 링크는 https:// 로 시작해야 해요.'); return; }
    setErr('');
    setBusy(true);
    const res = await officeProposeBooking({
      requestId, method, slots: iso, durationMin: duration,
      meetingLink: method === 'video' ? link : undefined, placeNote: method === 'visit' ? place : undefined, note,
    });
    setBusy(false);
    if (res.ok === false) { setErr(res.message); return; }
    toast.success('상담 시간을 제안했어요. 의뢰인이 고르면 일정에 들어가요.');
    onDone();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="booking-propose-title">
        <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 id="booking-propose-title" className="font-extrabold text-slate-900">상담 시간 제안</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-4 text-sm">
            <BookingSlotsFields idPrefix="office-booking" method={method} onMethodChange={setMethod} slots={slots} onSlotsChange={setSlots}
              openSlots={open.enabled ? open.slots : undefined} allowedMethods={open.enabled ? open.methods : undefined} />
            {!open.enabled && (
              <p className="text-xs text-slate-500">설정 › 사무소 설정 › '상담 가능 시간'을 열어 두면 여기서 바로 고를 수 있어요.</p>
            )}
            <label className="block space-y-1 font-bold text-slate-700">상담 시간
              <select className={input} value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {[20, 30, 40, 60, 90].map(m => <option key={m} value={m}>{m}분</option>)}
              </select>
            </label>
            {method === 'video' && (
              <label className="block space-y-1 font-bold text-slate-700">회의 링크 (나중에 넣어도 돼요)
                <input className={input} value={link} onChange={e => setLink(e.target.value)} placeholder="https://" inputMode="url" />
                <span className="block text-xs font-normal text-slate-500">사무소가 쓰는 화상 회의 링크를 붙여 넣어 주세요. 마이김변은 영상 통화를 제공하지 않아요.</span>
              </label>
            )}
            {method === 'visit' && (
              <label className="block space-y-1 font-bold text-slate-700">방문 장소
                <input className={input} value={place} onChange={e => setPlace(e.target.value)} maxLength={200} placeholder="사무소 주소·층·상담실" />
              </label>
            )}
            {method === 'phone' && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                계약 전에는 의뢰인 연락처가 보이지 않아요. 의뢰인이 시간을 고를 때 받을 번호를 적으면 이 예약 안내에만 보여요.
              </p>
            )}
            <label className="block space-y-1 font-bold text-slate-700">함께 보낼 말 (선택)
              <textarea className={`${input} min-h-[72px] py-2`} value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="예: 상담 전에 부채 내역을 준비해 주세요." />
            </label>
            {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap">닫기</button>
            <button type="button" onClick={submit} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">
              {busy ? '보내는 중…' : '제안 보내기'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function DetailsModal({ booking, onClose, onDone }: { booking: ConsultBooking; onClose: () => void; onDone: () => void }) {
  const [link, setLink] = useState(booking.meetingLink || '');
  const [place, setPlace] = useState(booking.placeNote || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (link.trim() && !/^https:\/\/\S{4,}$/.test(link.trim())) { setErr('회의 링크는 https:// 로 시작해야 해요.'); return; }
    setBusy(true);
    const res = await updateBookingDetails(booking, { meetingLink: link, placeNote: place });
    setBusy(false);
    if (res.ok === false) { setErr(res.message); return; }
    toast.success('예약 안내를 고쳤어요. 의뢰인에게 알렸어요.');
    onDone();
  };
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="booking-details-title">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 id="booking-details-title" className="font-extrabold text-slate-900">예약 안내 고치기</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {booking.method === 'video' ? (
              <label className="block space-y-1 font-bold text-slate-700">회의 링크
                <input className={input} value={link} onChange={e => setLink(e.target.value)} placeholder="https://" inputMode="url" />
              </label>
            ) : (
              <label className="block space-y-1 font-bold text-slate-700">장소·안내
                <input className={input} value={place} onChange={e => setPlace(e.target.value)} maxLength={200} />
              </label>
            )}
            {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap">닫기</button>
            <button type="button" onClick={save} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">저장</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function ConsultBookingBar({ requestId, refreshKey, wishMethod }: {
  requestId: string;
  /** 대화가 바뀔 때마다 다시 읽기 (새 안내 메시지가 오면 예약도 바뀌었을 수 있음) */
  refreshKey: unknown;
  /** 의뢰인이 상담 요청 때 고른 희망 방식 (있으면 제안 창 기본값) */
  wishMethod?: string;
}) {
  const dialog = useDialog();
  const [list, setList] = useState<ConsultBooking[] | null>(null);
  const [error, setError] = useState('');
  const [proposeOpen, setProposeOpen] = useState(false);
  const [detailsFor, setDetailsFor] = useState<ConsultBooking | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await loadConsultBookings(requestId);
    if (res.ok === false) { setError(res.code === 'not_configured' ? '' : res.message); setList([]); return; }
    setError('');
    setList(res.data);
  }, [requestId]);

  useEffect(() => { void reload(); }, [reload, refreshKey]);
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail?.requestId === requestId) void reload(); };
    const onFocus = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(CONSULT_BOOKINGS_CHANGED_EVENT, on);
    document.addEventListener('visibilitychange', onFocus);
    const t = window.setInterval(onFocus, 60_000);
    return () => { window.removeEventListener(CONSULT_BOOKINGS_CHANGED_EVENT, on); document.removeEventListener('visibilitychange', onFocus); window.clearInterval(t); };
  }, [requestId, reload]);

  if (list === null) {
    return <div className="shrink-0 h-10 border-b border-slate-200 bg-white px-4 flex items-center"><div className="h-3 w-48 rounded-lg bg-slate-100 animate-pulse" /></div>;
  }

  const current = currentBookingFor(list);
  const initialMethod: BookingMethod = wishMethod === 'video' || wishMethod === 'visit' ? wishMethod : 'phone';

  const act = async (b: ConsultBooking, action: 'confirm' | 'decline' | 'withdraw' | 'cancel', slot?: string) => {
    let note: string | undefined;
    if (action === 'cancel') {
      const r = await dialog.prompt({ title: '확정된 상담 예약 취소', message: '의뢰인에게 알려요. 취소 이유를 짧게 적어 주세요(선택).', placeholder: '예: 재판 일정이 겹쳤어요', confirmText: '예약 취소' });
      if (r === null) return;
      note = r;
    } else if (action === 'decline') {
      const r = await dialog.prompt({ title: '보낸 시간이 맞지 않아요', message: '의뢰인에게 알려요. 다른 시간을 바로 제안하려면 [다른 시간 제안]을 눌러 주세요.', placeholder: '예: 그 주는 어렵습니다', confirmText: '맞지 않다고 답하기' });
      if (r === null) return;
      note = r;
    } else if (action === 'confirm') {
      const ok = await dialog.confirm({ title: '상담 예약 확정', message: `${bookingTimeLabel(slot)} ${BOOKING_METHOD_LABEL[b.method]} 상담으로 확정할까요? 사무소 일정에 넣고 의뢰인에게 알려요.`, confirmText: '확정' });
      if (!ok) return;
    }
    setBusy(true);
    const res = await respondBooking(b, action, { slot, note });
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(action === 'confirm' ? '확정했어요. 사무소 일정에 넣었어요.' : action === 'cancel' ? '예약을 취소했어요.' : action === 'withdraw' ? '제안을 거뒀어요.' : '의뢰인에게 알렸어요.');
    void reload();
  };

  const proposeButton = (label: string) => (
    <button type="button" onClick={() => setProposeOpen(true)} className={`${smallBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
      <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />{label}
    </button>
  );

  let body: ReactNode;
  if (!current) {
    body = (
      <>
        <span className="text-slate-500 truncate">상담 예약 없음{error ? ` · ${error}` : ''}</span>
        <span className="ml-auto shrink-0">{proposeButton('상담 시간 제안')}</span>
      </>
    );
  } else {
    const turn = bookingTurn(current, 'office');
    const method = BOOKING_METHOD_LABEL[current.method];
    if (turn === 'confirmed') {
      const past = current.chosenAt ? new Date(current.chosenAt).getTime() < Date.now() : false;
      body = (
        <>
          <span className="inline-flex items-center h-6 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold shrink-0">{past ? '지난 예약' : '예약 확정'}</span>
          <span className="font-bold text-slate-900 shrink-0">{bookingTimeLabel(current.chosenAt)} · {method} {current.durationMin}분</span>
          {current.clientPhone && <span className="text-slate-600 shrink-0">받을 번호 {current.clientPhone}</span>}
          {current.method === 'video' && (current.meetingLink
            ? <a href={current.meetingLink} target="_blank" rel="noreferrer noopener" className="font-bold text-brand underline underline-offset-2 shrink-0">회의 링크</a>
            : <span className="text-amber-700 font-semibold shrink-0">회의 링크를 넣어 주세요</span>)}
          {current.method === 'visit' && current.placeNote && <span className="text-slate-600 truncate">{current.placeNote}</span>}
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {!past && current.method !== 'phone' && (
              <button type="button" onClick={() => setDetailsFor(current)} className={`${smallBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>안내 고치기</button>
            )}
            {!past && proposeButton('시간 바꾸기')}
            {!past && (
              <button type="button" disabled={busy} onClick={() => act(current, 'cancel')} className={`${smallBtn} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}>취소</button>
            )}
          </span>
        </>
      );
    } else if (turn === 'answer') {
      body = (
        <>
          <span className="inline-flex items-center h-6 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold shrink-0">의뢰인이 고른 시간</span>
          <span className="text-slate-700 shrink-0">{method}{current.clientPhone ? ` · 받을 번호 ${current.clientPhone}` : ''}</span>
          {current.slots.map(s => (
            <button key={s} type="button" disabled={busy} onClick={() => act(current, 'confirm', s)} className={`${smallBtn} bg-brand text-white hover:bg-brand-hover`}>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />{bookingTimeLabel(s)}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {proposeButton('다른 시간 제안')}
            <button type="button" disabled={busy} onClick={() => act(current, 'decline')} className={`${smallBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>맞지 않아요</button>
          </span>
        </>
      );
    } else {
      body = (
        <>
          <span className="inline-flex items-center h-6 px-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-bold shrink-0">답 기다리는 중</span>
          <span className="text-slate-700 truncate">{method} · {current.slots.map(bookingTimeLabel).join(', ')}</span>
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {proposeButton('다시 제안')}
            <button type="button" disabled={busy} onClick={() => act(current, 'withdraw')} className={`${smallBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>거두기</button>
          </span>
        </>
      );
    }
    if (current.note && turn === 'answer') {
      body = <>{body}<span className="basis-full text-slate-600 truncate">의뢰인 메모: {current.note}</span></>;
    }
  }

  return (
    <>
      <div className="shrink-0 min-h-10 px-4 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 bg-white text-[12px]" aria-label="상담 예약">
        <CalendarClock className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
        {body}
      </div>
      {proposeOpen && (
        <ProposeModal requestId={requestId} initialMethod={current?.method || initialMethod} onClose={() => setProposeOpen(false)} onDone={() => { setProposeOpen(false); void reload(); }} />
      )}
      {detailsFor && <DetailsModal booking={detailsFor} onClose={() => setDetailsFor(null)} onDone={() => { setDetailsFor(null); void reload(); }} />}
    </>
  );
}
