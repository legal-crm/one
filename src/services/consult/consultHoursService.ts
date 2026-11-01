// ============================================================
// 사무소 상담 가능 시간표 (NF-3 나머지, 20261101005600)
// 사무소: office_consult_hours(같은 사무소 읽기) · set_office_consult_hours(office.settings.edit)
// 예약 화면: consult_open_slots(요청, 변호사) → 열어 둔 시간(공휴일·쉬는 날·여유 시간·확정된 예약 제외)
// 시간표는 고르기 편하게 하는 것일 뿐이고, 확정은 상대가 고르는 방식 그대로
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';
import type { BookingMethod } from './consultBookingService';

/** 0=일 ~ 6=토, 하루 최대 3구간 ['HH:MM','HH:MM'] */
export type WeeklyHours = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Array<[string, string]>>>;

export interface ConsultHours {
  enabled: boolean;
  weekly: WeeklyHours;
  slotMinutes: 20 | 30 | 40 | 60;
  leadHours: number;
  horizonDays: number;
  closedDates: string[];
  methods: BookingMethod[];
  updatedAt?: string;
}

export const DEFAULT_CONSULT_HOURS: ConsultHours = {
  enabled: true,
  weekly: { '1': [['10:00', '12:00'], ['14:00', '18:00']], '2': [['10:00', '12:00'], ['14:00', '18:00']], '3': [['10:00', '12:00'], ['14:00', '18:00']], '4': [['10:00', '12:00'], ['14:00', '18:00']], '5': [['10:00', '12:00'], ['14:00', '18:00']] },
  slotMinutes: 30,
  leadHours: 24,
  horizonDays: 14,
  closedDates: [],
  methods: ['phone', 'video', 'visit'],
};

const fromRow = (r: any): ConsultHours => ({
  enabled: r.enabled !== false,
  weekly: (r.weekly || {}) as WeeklyHours,
  slotMinutes: (r.slot_minutes || 30) as ConsultHours['slotMinutes'],
  leadHours: Number(r.lead_hours) || 24,
  horizonDays: Number(r.horizon_days) || 14,
  closedDates: Array.isArray(r.closed_dates) ? r.closed_dates : [],
  methods: Array.isArray(r.methods) && r.methods.length ? r.methods : ['phone', 'video', 'visit'],
  updatedAt: r.updated_at || undefined,
});

/** 저장된 시간표 (없으면 null) */
export async function loadConsultHours(officeId: string): Promise<RpcResult<ConsultHours | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_consult_hours').select('*').eq('office_id', officeId).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? fromRow(data) : null };
}

/** 화면 검사 (서버도 같은 규칙: 06:00~23:00, 시작 < 끝, 하루 3구간) */
export function validateWeekly(weekly: WeeklyHours): string | null {
  for (const [day, wins] of Object.entries(weekly)) {
    if (!/^[0-6]$/.test(day)) return '요일 값이 올바르지 않아요.';
    if ((wins || []).length > 3) return '하루에 시간은 3구간까지 둘 수 있어요.';
    for (const [s, e] of wins || []) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(e)) return '시간은 10:00처럼 적어 주세요.';
      if (s < '06:00' || e > '23:00') return '상담 시간은 06:00~23:00 안에서 정해 주세요.';
      if (s >= e) return '끝나는 시간이 시작 시간보다 뒤여야 해요.';
    }
  }
  return null;
}

export async function saveConsultHours(officeId: string, h: ConsultHours): Promise<RpcResult<ConsultHours>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_office_consult_hours', {
    p_office_id: officeId,
    p: {
      enabled: h.enabled, weekly: h.weekly, slot_minutes: h.slotMinutes, lead_hours: h.leadHours,
      horizon_days: h.horizonDays, closed_dates: h.closedDates, methods: h.methods,
    },
  });
  if (error) {
    if (/invalid weekly hours/i.test(error.message)) return { ok: false, code: 'weekly', message: '요일별 시간을 확인해 주세요. 06:00~23:00, 시작이 끝보다 앞이어야 해요.' };
    if (/at least one consult method/i.test(error.message)) return { ok: false, code: 'methods', message: '받는 상담 방식을 하나 이상 골라 주세요.' };
    return toRpcError(error);
  }
  return { ok: true, data: fromRow(data) };
}

export interface OpenSlots { enabled: boolean; slotMinutes?: number; methods?: BookingMethod[]; slots: string[] }

/** 이 상담에서 고를 수 있는 시간 (의뢰인은 lawyerId 필수, 사무소는 생략) — 실패하면 빈 목록(예약은 직접 입력으로 계속) */
export async function loadOpenSlots(requestId: string, lawyerId?: string): Promise<OpenSlots> {
  if (!isSupabaseConfigured) return { enabled: false, slots: [] };
  const { data, error } = await supabase.rpc('consult_open_slots', { p_request_id: requestId, p_lawyer_id: lawyerId || null });
  if (error || !data) return { enabled: false, slots: [] };
  const d = data as any;
  return {
    enabled: !!d.enabled,
    slotMinutes: d.slot_minutes || undefined,
    methods: Array.isArray(d.methods) ? d.methods : undefined,
    slots: Array.isArray(d.slots) ? d.slots.filter((s: unknown) => typeof s === 'string') : [],
  };
}

/** ISO → <input type="datetime-local"> 값 (이 기기 시간) */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 열어 둔 시간을 한국 날짜별로 묶는다 [{day:'11월 3일(화)', slots:[{iso, time:'10:00'}]}] */
export function groupSlotsByDay(slots: string[]): Array<{ key: string; day: string; slots: Array<{ iso: string; time: string }> }> {
  const fmtDay = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
  const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
  const fmtTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const out = new Map<string, { key: string; day: string; slots: Array<{ iso: string; time: string }> }>();
  for (const iso of slots) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const key = fmtKey.format(d);
    const parts = fmtDay.formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    const day = `${get('month')}월 ${get('day')}일(${get('weekday')})`;
    if (!out.has(key)) out.set(key, { key, day, slots: [] });
    out.get(key)!.slots.push({ iso, time: fmtTime.format(d) });
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** 요일 화면 순서 (월~일) */
export const WEEKDAY_ORDER: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: '1', label: '월' }, { key: '2', label: '화' }, { key: '3', label: '수' }, { key: '4', label: '목' },
  { key: '5', label: '금' }, { key: '6', label: '토' }, { key: '0', label: '일' },
];
