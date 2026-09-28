// ============================================================
// 캘린더 일정 서비스
// Supabase 우선 + localStorage 폴백 하이브리드 동기화
// ============================================================

export type EventType = 'court' | 'consult' | 'meeting' | 'deadline' | 'other';
export type EventVisibility = 'firm' | 'lawyers' | 'personal';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type ReminderType = 'none' | 'at_time' | '10min' | '30min' | '1hour' | '1day';

export const RECURRENCE_CONFIG: Record<RecurrenceType, { label: string; emoji: string }> = {
  none:     { label: '반복 없음', emoji: '' },
  daily:    { label: '매일',     emoji: '🔄' },
  weekly:   { label: '매주',     emoji: '🔄' },
  biweekly: { label: '격주',     emoji: '🔄' },
  monthly:  { label: '매월',     emoji: '🔄' },
};

export const REMINDER_CONFIG: Record<ReminderType, { label: string; emoji: string }> = {
  none:    { label: '알림 없음',    emoji: '' },
  at_time: { label: '일정 시작 시', emoji: '🔔' },
  '10min': { label: '10분 전',     emoji: '🔔' },
  '30min': { label: '30분 전',     emoji: '🔔' },
  '1hour': { label: '1시간 전',    emoji: '🔔' },
  '1day':  { label: '1일 전',      emoji: '🔔' },
};

export interface CalendarEvent {
  id: string;
  tenantId: string;
  title: string;
  date: string;           // YYYY-MM-DD
  startTime?: string;     // HH:mm
  endTime?: string;       // HH:mm
  type: EventType;
  visibility: EventVisibility;
  recurrence: RecurrenceType;
  reminder: ReminderType;
  description?: string;
  clientName?: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
}

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; emoji: string; color: string; bgColor: string; dotColor: string }> = {
  court:    { label: '법원 기일', emoji: '🏛️', color: 'text-red-600',    bgColor: 'bg-red-50',    dotColor: 'bg-red-500' },
  consult:  { label: '상담 일정', emoji: '💬', color: 'text-blue-600',   bgColor: 'bg-blue-50',   dotColor: 'bg-blue-500' },
  meeting:  { label: '내부 회의', emoji: '👥', color: 'text-purple-600', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
  deadline: { label: '마감일',     emoji: '⏰', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' },
  other:    { label: '기타',         emoji: '📌', color: 'text-slate-600',  bgColor: 'bg-slate-100', dotColor: 'bg-slate-400' },
};

export const VISIBILITY_CONFIG: Record<EventVisibility, { label: string; emoji: string; color: string; bgColor: string }> = {
  firm:     { label: '전체 공유', emoji: '🏢', color: 'text-brand',      bgColor: 'bg-brand/10' },
  lawyers:  { label: '변호사만', emoji: '⚖️', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  personal: { label: '나만 보기', emoji: '🔒', color: 'text-slate-500',  bgColor: 'bg-slate-50' },
};

/** 알림(10분~1일 전)은 저장만 된다. 발송하는 스케줄러가 아직 없다. */
export const REMINDER_DELIVERY_SUPPORTED = false;

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { generateUUID } from '../utils/deviceDetector';
import { addMonthsClamped, localYmd, parseLocalYmd } from '../utils/localDate';

// Supabase 미설정(로컬 개발)일 때만 쓰는 저장소
const STORAGE_KEY = 'cal-events';

function calendarError(action: string, error: any): Error {
  const msg = error?.message || String(error || '');
  console.error(`[Calendar] ${action} 실패:`, msg);
  return new Error(`일정을 ${action}하지 못했습니다.${msg ? ` (${msg})` : ''}`);
}

function eventToRow(e: CalendarEvent) {
  return {
    id: e.id,
    tenant_id: e.tenantId,
    title: e.title || '',
    date: e.date,
    time: e.startTime || '',
    category: e.type || 'other',
    client_name: e.clientName || '',
    memo: e.description || '',
    assigned_staff_id: e.createdBy || '',
    // 이전: visibility 컬럼을 쓰지 않아 DB 기본값 'firm'이 남음 → RLS가 '나만 보기' 일정을 모두에게 허용
    visibility: e.visibility,
    created_at: e.createdAt || new Date().toISOString(),
    data: e,
  };
}

function loadFromStorage(tenantId: string): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(tenantId: string, events: CalendarEvent[]) {
  localStorage.setItem(`${STORAGE_KEY}-${tenantId}`, JSON.stringify(events));
}

/** 공개 범위 판정 (화면 표시용 — 서버는 RLS로 한 번 더 거른다) */
export function canViewEvent(e: CalendarEvent, userId: string, userRole: string): boolean {
  if (e.visibility === 'firm') return true;
  if (e.visibility === 'lawyers') return userRole === 'OWNER' || userRole === 'LAWYER' || e.createdBy === userId;
  if (e.visibility === 'personal') return !!userId && e.createdBy === userId;
  return false;
}

/**
 * 공개 범위에 맞는 일정 조회
 * - Supabase 설정 시: 서버 조회 결과만 사용하고 브라우저에 캐시하지 않는다. 실패하면 예외.
 * - '나만 보기' 일정의 서버 측 차단은 RLS(020 마이그레이션)가 맡는다.
 */
export async function getVisibleEvents(
  tenantId: string,
  userId: string,
  userRole: string
): Promise<CalendarEvent[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });
    if (error) throw calendarError('불러오', error);
    return (data || [])
      .map((row: any) => ({ ...(row.data || {}), id: row.id, tenantId: row.tenant_id, visibility: row.visibility || row.data?.visibility || 'personal' }) as CalendarEvent)
      .filter((e: CalendarEvent) => canViewEvent(e, userId, userRole));
  }
  return loadFromStorage(tenantId).filter(e => canViewEvent(e, userId, userRole));
}

/** 일정 삭제 권한 확인 */
export function canDeleteEvent(
  event: CalendarEvent,
  userId: string,
  userRole: string,
  hasManageCalendar: boolean
): boolean {
  if (event.visibility === 'personal') return event.createdBy === userId;
  if (event.visibility === 'lawyers') return event.createdBy === userId || userRole === 'OWNER';
  if (event.visibility === 'firm') return userRole === 'OWNER' || hasManageCalendar;
  return false;
}

/** 사용 가능한 visibility 옵션 */
export function getAvailableVisibilities(
  userRole: string,
  hasManageCalendar: boolean
): EventVisibility[] {
  if (userRole === 'OWNER' || hasManageCalendar) return ['firm', 'lawyers', 'personal'];
  if (userRole === 'LAWYER') return ['lawyers', 'personal'];
  return ['personal'];
}

/** 기본 visibility */
export function getDefaultVisibility(
  userRole: string,
  hasManageCalendar: boolean
): EventVisibility {
  if (userRole === 'OWNER' || hasManageCalendar) return 'firm';
  return 'personal';
}

/**
 * 반복 일정을 [rangeStart, rangeEnd] 범위의 날짜(YYYY-MM-DD) 목록으로 펼친다.
 * - 매월: 시작일과 같은 날짜, 없는 달은 말일 (1/31 → 2/28)
 * - 반복 종료일이 없으므로 범위 밖은 계산하지 않는다
 */
export function expandEventOccurrences(e: Pick<CalendarEvent, 'date' | 'recurrence'>, rangeStart: string, rangeEnd: string): string[] {
  const base = parseLocalYmd(e.date);
  const start = parseLocalYmd(rangeStart);
  const end = parseLocalYmd(rangeEnd);
  if (!base || !start || !end) return e.date ? [e.date] : [];
  const inRange = (d: Date) => d >= start && d <= end;
  const rec = e.recurrence || 'none';
  if (rec === 'none') return inRange(base) ? [localYmd(base)] : [];

  const out: string[] = [];
  if (rec === 'monthly') {
    for (let i = 0; i < 1200; i++) {
      const d = addMonthsClamped(base, i);
      if (d > end) break;
      if (inRange(d)) out.push(localYmd(d));
    }
    return out;
  }
  const stepDays = rec === 'daily' ? 1 : rec === 'weekly' ? 7 : 14;
  const dayMs = 86400000;
  // 범위 시작 직전 회차부터 계산 (자정 기준 일수 차 — 서머타임 없는 지역 가정, 반올림으로 보정)
  const diffDays = Math.round((start.getTime() - base.getTime()) / dayMs);
  let k = diffDays > 0 ? Math.floor(diffDays / stepDays) : 0;
  for (let guard = 0; guard < 400; guard++, k++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k * stepDays);
    if (d > end) break;
    if (inRange(d)) out.push(localYmd(d));
  }
  return out;
}

/** 일정 생성 — 서버 저장 실패 시 예외 (이전: 실패해도 '추가되었습니다' 후 새로고침하면 사라짐) */
export async function createEvent(
  tenantId: string,
  data: Omit<CalendarEvent, 'id' | 'tenantId' | 'createdAt'>
): Promise<CalendarEvent> {
  if (!tenantId) throw new Error('사무소 정보를 확인할 수 없어 일정을 저장하지 못했습니다.');
  if (!parseLocalYmd(data.date)) throw new Error('날짜 형식이 올바르지 않습니다.');
  const newEvent: CalendarEvent = {
    ...data,
    id: generateUUID(),
    tenantId,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('calendar_events').insert(eventToRow(newEvent));
    if (error) throw calendarError('저장', error);
  } else {
    const events = loadFromStorage(tenantId);
    events.push(newEvent);
    saveToStorage(tenantId, events);
  }
  return newEvent;
}

/** 일정 삭제 — 같은 사무소 일정만 */
export async function deleteEvent(tenantId: string, eventId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('calendar_events').delete()
      .eq('tenant_id', tenantId).eq('id', eventId).select('id');
    if (error) throw calendarError('삭제', error);
    if (!data || data.length === 0) throw new Error('일정을 삭제하지 못했습니다. 권한이 없거나 이미 삭제된 일정입니다.');
    return;
  }
  saveToStorage(tenantId, loadFromStorage(tenantId).filter(e => e.id !== eventId));
}
