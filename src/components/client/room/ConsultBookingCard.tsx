// 의뢰인 상담방 '상담 예약' (NF-3)
// - 변호사가 시간을 제안하면: 하나를 고르면 확정 (전화 상담은 받을 번호를 이 예약에만 적을 수 있음)
// - 내가 편한 시간을 보내면: 변호사가 고르면 확정
// - 확정되면 전날·1시간 전에 알려 줌 (서버). 상담료 결제는 마이김변에서 받지 않음
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, CalendarClock, ExternalLink, Phone } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useDialog } from '../../common/DialogProvider';
import BookingSlotsFields from '../../common/BookingSlotsFields';
import {
  BOOKING_METHOD_LABEL, CONSULT_BOOKINGS_CHANGED_EVENT, bookingTimeLabel, bookingTurn, clientProposeBooking, currentBookingFor,
  defaultSlotInput, loadConsultBookings, localInputToIso, respondBooking, updateBookingDetails, validateSlots,
  type BookingMethod, type ConsultBooking,
} from '../../../services/consult/consultBookingService';

const field = 'w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

function PhoneField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <label htmlFor={id} className="block space-y-1 text-sm font-bold text-slate-700">
      전화 받을 번호 (선택)
      <input id={id} className={field} inputMode="tel" autoComplete="tel" value={value} onChange={e => onChange(e.target.value)} placeholder="010-0000-0000" />
      <span className="block text-xs font-normal text-slate-500">이 예약을 받은 변호사 사무소에만 보여요. 비워 두면 채팅으로 연락 방법을 정해요.</span>
    </label>
  );
}

export default function ConsultBookingCard({
  requestId, lawyerId, lawyerName, canBook, wishMethod, openSignal,
}: {
  requestId: string;
  lawyerId?: string;
  lawyerName?: string;
  /** 대화가 열려 있고 이 변호사와 상담이 끝나지 않았을 때 */
  canBook: boolean;
  wishMethod?: string;
  /** 머리의 [상담 예약] 버튼을 누를 때마다 바뀌는 값 → 보내기 창 열기 */
  openSignal: number;
}) {
  const dialog = useDialog();
  const [list, setList] = useState<ConsultBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [method, setMethod] = useState<BookingMethod>(wishMethod === 'video' || wishMethod === 'visit' ? wishMethod : 'phone');
  const [slots, setSlots] = useState<string[]>([defaultSlotInput(new Date(), 1)]);
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ booking: ConsultBooking; slot: string } | null>(null);
  const [pickPhone, setPickPhone] = useState('');

  const reload = useCallback(async () => {
    const res = await loadConsultBookings(requestId);
    setLoaded(true);
    if (res.ok === false) return; // 읽기 실패는 조용히 비워 두지 않고 다음 새로고침에서 다시 시도
    setList(res.data);
  }, [requestId]);

  useEffect(() => { void reload(); }, [reload, lawyerId]);
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail?.requestId === requestId) void reload(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(CONSULT_BOOKINGS_CHANGED_EVENT, on);
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(onVisible, 60_000);
    return () => { window.removeEventListener(CONSULT_BOOKINGS_CHANGED_EVENT, on); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(t); };
  }, [requestId, reload]);

  useEffect(() => {
    if (openSignal > 0 && canBook && lawyerId) { setErr(''); setProposeOpen(true); }
  }, [openSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = lawyerId ? currentBookingFor(list, lawyerId) : undefined;

  const sendProposal = async () => {
    if (!lawyerId) return;
    const iso = slots.map(localInputToIso).filter(Boolean);
    const bad = validateSlots(iso);
    if (bad) { setErr(bad); return; }
    if (method === 'phone' && phone.trim() && !PHONE_RE.test(phone.trim())) { setErr('전화번호를 확인해 주세요. 예: 010-1234-5678'); return; }
    setErr('');
    setBusy(true);
    const res = await clientProposeBooking({ requestId, lawyerId, method, slots: iso, note, clientPhone: method === 'phone' ? phone : undefined });
    setBusy(false);
    if (res.ok === false) { setErr(res.message); return; }
    setProposeOpen(false);
    setNote('');
    toast.success('편한 시간을 보냈어요. 변호사가 고르면 알려 드려요.');
    void reload();
  };

  const confirmPick = async () => {
    if (!pick) return;
    if (pickPhone.trim() && !PHONE_RE.test(pickPhone.trim())) { toast.error('전화번호를 확인해 주세요. 예: 010-1234-5678'); return; }
    setBusy(true);
    const res = await respondBooking(pick.booking, 'confirm', { slot: pick.slot, clientPhone: pick.booking.method === 'phone' ? pickPhone : undefined });
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    setPick(null);
    toast.success('상담 예약이 확정됐어요. 전날과 1시간 전에 알려 드려요.');
    void reload();
  };

  const simple = async (b: ConsultBooking, action: 'decline' | 'withdraw' | 'cancel') => {
    let note: string | undefined;
    if (action === 'cancel' || action === 'decline') {
      const r = await dialog.prompt({
        title: action === 'cancel' ? '상담 예약 취소' : '제안받은 시간이 맞지 않아요',
        message: action === 'cancel' ? '변호사 사무소에 알려요. 이유를 짧게 적어 주세요(선택).' : '변호사 사무소에 알려요. 편한 시간을 바로 보내려면 [다른 시간 보내기]를 눌러 주세요.',
        placeholder: action === 'cancel' ? '예: 회사 일정이 생겼어요' : '예: 평일 저녁이 좋아요',
        confirmText: action === 'cancel' ? '예약 취소' : '답하기',
      });
      if (r === null) return;
      note = r;
    }
    setBusy(true);
    const res = await respondBooking(b, action, { note });
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(action === 'cancel' ? '예약을 취소했어요.' : action === 'withdraw' ? '보낸 시간을 거뒀어요.' : '변호사 사무소에 알렸어요.');
    void reload();
  };

  const changePhone = async (b: ConsultBooking) => {
    const r = await dialog.prompt({ title: '전화 받을 번호', message: '이 예약을 받은 변호사 사무소에만 보여요. 비우면 번호를 지워요.', placeholder: '010-0000-0000', defaultValue: b.clientPhone || '', confirmText: '저장' });
    if (r === null) return;
    if (r.trim() && !PHONE_RE.test(r.trim())) { toast.error('전화번호를 확인해 주세요. 예: 010-1234-5678'); return; }
    const res = await updateBookingDetails(b, { clientPhone: r });
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(r.trim() ? '번호를 저장했어요.' : '번호를 지웠어요.');
    void reload();
  };

  const who = lawyerName ? `${lawyerName} 변호사` : '변호사';
  let strip: ReactNode = null;
  if (loaded && current) {
    const turn = bookingTurn(current, 'client');
    const m = BOOKING_METHOD_LABEL[current.method];
    if (turn === 'confirmed') {
      const past = current.chosenAt ? new Date(current.chosenAt).getTime() < Date.now() : false;
      strip = (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-sm text-slate-800 break-keep">
            <CalendarCheck className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span><span className="font-bold">{past ? '지난 상담 예약' : '상담 예약 확정'}</span> · {bookingTimeLabel(current.chosenAt)} · {m} {current.durationMin}분</span>
          </p>
          {current.method === 'video' && (current.meetingLink
            ? <a href={current.meetingLink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-bold text-brand underline underline-offset-2">회의 링크 열기<ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a>
            : <p className="text-xs text-slate-600">회의 링크는 변호사 사무소가 곧 보내 드려요.</p>)}
          {current.method === 'visit' && current.placeNote && <p className="text-xs text-slate-700">장소: {current.placeNote}</p>}
          {current.method === 'phone' && (
            <p className="text-xs text-slate-700">{current.clientPhone ? `받을 번호 ${current.clientPhone}` : '받을 번호를 아직 적지 않았어요. 채팅으로 정하거나 번호를 적어 주세요.'}</p>
          )}
          {!past && (
            <div className="flex flex-wrap gap-2">
              {current.method === 'phone' && <Button variant="secondary" size="sm" onClick={() => changePhone(current)} leftIcon={<Phone className="w-3.5 h-3.5" aria-hidden="true" />}>{current.clientPhone ? '번호 바꾸기' : '번호 적기'}</Button>}
              {canBook && <Button variant="secondary" size="sm" onClick={() => { setErr(''); setProposeOpen(true); }}>다른 시간 보내기</Button>}
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => simple(current, 'cancel')}>예약 취소</Button>
            </div>
          )}
        </div>
      );
    } else if (turn === 'answer') {
      strip = (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-sm text-slate-800 break-keep">
            <CalendarClock className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" aria-hidden="true" />
            <span><span className="font-bold">{who}가 상담 시간을 제안했어요</span> · {m} {current.durationMin}분 · 편한 시간을 하나 골라 주세요</span>
          </p>
          {current.note && <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-2.5">{current.note}</p>}
          <div className="flex flex-wrap gap-2">
            {current.slots.map(s => (
              <Button key={s} size="sm" disabled={busy || !canBook} onClick={() => { setPickPhone(''); setPick({ booking: current, slot: s }); }}>{bookingTimeLabel(s)}</Button>
            ))}
          </div>
          {canBook && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setErr(''); setProposeOpen(true); }}>다른 시간 보내기</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => simple(current, 'decline')}>맞지 않아요</Button>
            </div>
          )}
        </div>
      );
    } else if (turn === 'waiting') {
      strip = (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-0 flex items-start gap-2 text-sm text-slate-800 break-keep">
            <CalendarClock className="w-4 h-4 mt-0.5 text-sky-700 shrink-0" aria-hidden="true" />
            <span><span className="font-bold">보낸 시간</span> · {m} · {current.slots.map(s => bookingTimeLabel(s)).join(', ')} · {who}의 답을 기다리고 있어요</span>
          </p>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => simple(current, 'withdraw')}>거두기</Button>
        </div>
      );
    }
  }

  return (
    <>
      {strip && <div className="shrink-0 px-4 py-2.5 border-b border-slate-200 bg-emerald-50/40" aria-label="상담 예약">{strip}</div>}

      <Modal
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        title="상담 예약"
        icon={<CalendarClock className="w-5 h-5" />}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProposeOpen(false)}>취소</Button>
            <Button onClick={sendProposal} loading={busy} disabled={!lawyerId}>시간 보내기</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed break-keep">
            {who}에게 편한 시간을 보내요. 변호사가 하나를 고르면 예약이 확정되고, 전날과 1시간 전에 알려 드려요. 상담 비용이 있다면 사무소와 직접 정해요.
          </p>
          <BookingSlotsFields idPrefix="client-booking" method={method} onMethodChange={setMethod} slots={slots} onSlotsChange={setSlots} />
          {method === 'phone' && <PhoneField id="client-booking-phone" value={phone} onChange={setPhone} />}
          <label className="block space-y-1 text-sm font-bold text-slate-700">
            변호사에게 남길 말 (선택)
            <textarea className={`${field} min-h-[72px] py-2`} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="예: 점심시간(12~13시)에는 통화가 어려워요" />
            <span className="block text-xs font-normal text-slate-500">주민등록번호는 적지 마세요.</span>
          </label>
          {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
        </div>
      </Modal>

      <Modal
        open={!!pick}
        onClose={() => setPick(null)}
        title="이 시간으로 예약할까요?"
        icon={<CalendarCheck className="w-5 h-5" />}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPick(null)}>취소</Button>
            <Button onClick={confirmPick} loading={busy}>예약 확정</Button>
          </>
        }
      >
        {pick && (
          <div className="space-y-3">
            <p className="text-sm text-slate-800 break-keep">
              <span className="font-bold">{bookingTimeLabel(pick.slot)}</span> · {BOOKING_METHOD_LABEL[pick.booking.method]} {pick.booking.durationMin}분 상담
            </p>
            {pick.booking.method === 'phone' && <PhoneField id="client-booking-pick-phone" value={pickPhone} onChange={setPickPhone} />}
          </div>
        )}
      </Modal>
    </>
  );
}
