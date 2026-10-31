// ============================================================
// 상담 예약 (NF-3, 20261101005200)
// 사무소: office_propose_consult_booking ("이 시간 어때요?" 최대 3개)
// 의뢰인: client_propose_consult_booking (편한 시간 최대 3개)
// 상대가 하나를 고르면 확정 → 사무소 일정('상담 일정')·양쪽 알림·전날/1시간 전 알림 (서버)
// 결제·예약 수 집계 없음. 영상은 사무소가 쓰는 외부 회의 링크만
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export type BookingMethod = 'phone' | 'video' | 'visit';
export type BookingStatus = 'proposed' | 'confirmed' | 'declined' | 'cancelled';
export type BookingSide = 'office' | 'client';

export const BOOKING_METHOD_LABEL: Record<BookingMethod, string> = {
  phone: '전화',
  video: '화상',
  visit: '사무소 방문',
};

export interface ConsultBooking {
  id: string;
  requestId: string;
  lawyerId: string;
  lawyerName: string;
  proposedBy: BookingSide;
  method: BookingMethod;
  slots: string[];
  durationMin: number;
  meetingLink?: string;
  placeNote?: string;
  note?: string;
  clientPhone?: string;
  status: BookingStatus;
  chosenAt?: string;
  confirmedAt?: string;
  confirmedBy?: BookingSide;
  closeReason?: string;
  cancelNote?: string;
  inCalendar: boolean;
  createdAt: string;
}

const map = (r: any): ConsultBooking => ({
  id: r.id,
  requestId: r.request_id,
  lawyerId: r.lawyer_id,
  lawyerName: r.lawyer_name || '',
  proposedBy: r.proposed_by,
  method: r.method,
  slots: Array.isArray(r.slots) ? r.slots : [],
  durationMin: Number(r.duration_min) || 30,
  meetingLink: r.meeting_link || undefined,
  placeNote: r.place_note || undefined,
  note: r.note || undefined,
  clientPhone: r.client_phone || undefined,
  status: r.status,
  chosenAt: r.chosen_at || undefined,
  confirmedAt: r.confirmed_at || undefined,
  confirmedBy: r.confirmed_by || undefined,
  closeReason: r.close_reason || undefined,
  cancelNote: r.cancel_note || undefined,
  inCalendar: !!r.in_calendar,
  createdAt: r.created_at,
});

export const CONSULT_BOOKINGS_CHANGED_EVENT = 'mykim:consult-bookings-changed';
const changed = (requestId: string) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSULT_BOOKINGS_CHANGED_EVENT, { detail: { requestId } }));
};

const RULES: Array<[RegExp, string]> = [
  [/choose 1 to 3 times/i, '시간을 1~3개 골라 주세요.'],
  [/times must be between/i, '지금부터 30분 뒤 ~ 60일 안의 시간만 고를 수 있어요.'],
  [/meeting link must start with https/i, '회의 링크는 https:// 로 시작해야 해요.'],
  [/invalid client phone/i, '전화번호를 확인해 주세요. 예: 010-1234-5678'],
  [/consultation is closed for this lawyer/i, '이 변호사와의 상담이 끝나 예약할 수 없어요.'],
  [/pick one of the proposed times/i, '제안된 시간 중 하나를 골라 주세요.'],
  [/this time has already passed/i, '이미 지났거나 너무 가까운 시간이에요. 다른 시간을 맞춰 주세요.'],
  [/booking is not waiting for an answer|booking is not confirmed|booking is closed/i, '이미 처리된 예약이에요. 새로고침해 주세요.'],
  [/the other side must pick a time/i, '내가 보낸 제안은 상대가 골라야 확정돼요.'],
  [/only your own waiting proposal/i, '내가 보낸, 답을 기다리는 제안만 거둘 수 있어요.'],
  [/too many booking proposals today/i, '오늘은 이 상담으로 예약 제안을 더 보낼 수 없어요. 채팅으로 시간을 맞춰 주세요.'],
  [/not allowed for this (booking|request)/i, '이 상담을 볼 권한이 없어요.'],
  [/account suspended/i, '이용이 정지된 계정이라 예약할 수 없어요.'],
];

function friendly(e: { message?: string; code?: string } | null): RpcResult<never> {
  const m = e?.message || '';
  for (const [re, text] of RULES) if (re.test(m)) return { ok: false, code: 'booking', message: text };
  return toRpcError(e);
}

/** 이 상담 요청의 예약 (의뢰인 = 전체, 사무소 = 우리 사무소 것만) */
export async function loadConsultBookings(requestId: string): Promise<RpcResult<ConsultBooking[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('consult_bookings_for_request', { p_request_id: requestId });
  if (error) return friendly(error);
  return { ok: true, data: (Array.isArray(data) ? data : []).map(map) };
}

export async function officeProposeBooking(input: {
  requestId: string; method: BookingMethod; slots: string[]; durationMin: number;
  meetingLink?: string; placeNote?: string; note?: string;
}): Promise<RpcResult<ConsultBooking>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_propose_consult_booking', {
    p_request_id: input.requestId, p_method: input.method, p_slots: input.slots, p_duration: input.durationMin,
    p_meeting_link: input.meetingLink?.trim() || null, p_place_note: input.placeNote?.trim() || null, p_note: input.note?.trim() || null,
  });
  if (error) return friendly(error);
  changed(input.requestId);
  return { ok: true, data: map(data) };
}

export async function clientProposeBooking(input: {
  requestId: string; lawyerId: string; method: BookingMethod; slots: string[]; note?: string; clientPhone?: string;
}): Promise<RpcResult<ConsultBooking>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('client_propose_consult_booking', {
    p_request_id: input.requestId, p_lawyer_id: input.lawyerId, p_method: input.method, p_slots: input.slots,
    p_note: input.note?.trim() || null, p_client_phone: input.clientPhone?.trim() || null,
  });
  if (error) return friendly(error);
  changed(input.requestId);
  return { ok: true, data: map(data) };
}

export async function respondBooking(
  booking: Pick<ConsultBooking, 'id' | 'requestId'>,
  action: 'confirm' | 'decline' | 'withdraw' | 'cancel',
  opts: { slot?: string; note?: string; clientPhone?: string } = {},
): Promise<RpcResult<ConsultBooking>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('respond_consult_booking', {
    p_booking_id: booking.id, p_action: action, p_slot: opts.slot || null,
    p_note: opts.note?.trim() || null, p_client_phone: opts.clientPhone?.trim() || null,
  });
  if (error) return friendly(error);
  changed(booking.requestId);
  return { ok: true, data: map(data) };
}

export async function updateBookingDetails(
  booking: Pick<ConsultBooking, 'id' | 'requestId'>,
  input: { meetingLink?: string; placeNote?: string; clientPhone?: string },
): Promise<RpcResult<ConsultBooking>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('update_consult_booking_details', {
    p_booking_id: booking.id, p_meeting_link: input.meetingLink?.trim() || null,
    p_place_note: input.placeNote?.trim() || null, p_client_phone: input.clientPhone?.trim() || null,
  });
  if (error) return friendly(error);
  changed(booking.requestId);
  return { ok: true, data: map(data) };
}

// ── 화면 도움 ──────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** 한국 시간 'M월 D일(요일) HH:mm' */
export function bookingTimeLabel(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const wd = get('weekday') || WEEKDAY[d.getDay()];
  return `${get('month')}월 ${get('day')}일(${wd.replace('요일', '')}) ${get('hour')}:${get('minute')}`;
}

/** <input type="datetime-local"> 값(사용자 기기 시간) → ISO. 비었거나 잘못되면 '' */
export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** 고른 시간 검사 (서버도 같은 규칙으로 다시 검사) */
export function validateSlots(isoList: string[], now: Date = new Date()): string | null {
  const list = isoList.filter(Boolean);
  if (list.length < 1) return '시간을 하나 이상 골라 주세요.';
  if (list.length > 3) return '시간은 3개까지 고를 수 있어요.';
  const min = now.getTime() + 30 * 60 * 1000;
  const max = now.getTime() + 60 * 24 * 60 * 60 * 1000;
  for (const iso of list) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '시간 형식을 확인해 주세요.';
    if (t < min || t > max) return '지금부터 30분 뒤 ~ 60일 안의 시간만 고를 수 있어요.';
  }
  if (new Set(list.map(s => new Date(s).toISOString().slice(0, 16))).size !== list.length) return '같은 시간을 두 번 골랐어요.';
  return null;
}

/** 이 변호사와의 지금 예약: 앞으로 있을 확정 예약 > 답을 기다리는 제안 */
export function currentBookingFor(list: ConsultBooking[], lawyerId?: string, now: Date = new Date()): ConsultBooking | undefined {
  const mine = lawyerId ? list.filter(b => b.lawyerId === lawyerId) : list;
  const upcoming = mine
    .filter(b => b.status === 'confirmed' && b.chosenAt && new Date(b.chosenAt).getTime() > now.getTime() - 2 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.chosenAt!).getTime() - new Date(b.chosenAt!).getTime());
  if (upcoming[0]) return upcoming[0];
  return mine.find(b => b.status === 'proposed');
}

/** 다른 쪽 제안을 기다리는지 / 내가 답할 차례인지 */
export function bookingTurn(b: ConsultBooking, me: BookingSide): 'answer' | 'waiting' | 'confirmed' | 'closed' {
  if (b.status === 'confirmed') return 'confirmed';
  if (b.status !== 'proposed') return 'closed';
  return b.proposedBy === me ? 'waiting' : 'answer';
}

/** datetime-local 입력 기본값: 다음 평일 오전 10시 (사용자 기기 시간) */
export function defaultSlotInput(now: Date = new Date(), offsetDays = 1): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
