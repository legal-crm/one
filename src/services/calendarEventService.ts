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

import { supabase, isSupabaseConfigured } from '../supabaseClient';

const STORAGE_KEY = 'cal-events';

function logSupabaseError(op: string, error: any) {
  console.error(`[Calendar] ${op} 실패:`, error?.message || error);
}

function eventToRow(e: CalendarEvent) {
  return {
    id: e.id,
    tenant_id: e.tenantId || 'default',
    title: e.title || '',
    date: e.date,
    time: e.startTime || '',
    category: e.type || 'other',
    client_name: e.clientName || '',
    memo: e.description || '',
    assigned_staff_id: e.createdBy || '',
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

function generateId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

/** 모든 일정 조회 (Supabase 우선, localStorage 폴백) */
export async function getEvents(tenantId: string): Promise<CalendarEvent[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('calendar_events').select('*').eq('tenant_id', tenantId).order('date', { ascending: true });
      if (error) logSupabaseError('getEvents', error);
      else if (data) {
        const events = data.map((row: any) => row.data || row);
        saveToStorage(tenantId, events);
        return events;
      }
    } catch (e) { logSupabaseError('getEvents (exception)', e); }
  }
  return loadFromStorage(tenantId);
}

/** 가시성 기반 필터링된 일정 조회 */
export async function getVisibleEvents(
  tenantId: string,
  userId: string,
  userRole: string
): Promise<CalendarEvent[]> {
  const all = await getEvents(tenantId);
  return all.filter(e => {
    if (e.visibility === 'firm') return true;
    if (e.visibility === 'lawyers') return userRole === 'OWNER' || userRole === 'LAWYER';
    if (e.visibility === 'personal') return e.createdBy === userId;
    return true;
  });
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
  if (userRole === 'LAWYER') return 'personal';
  return 'personal';
}

/** 일정 생성 */
export async function createEvent(
  tenantId: string,
  data: Omit<CalendarEvent, 'id' | 'tenantId' | 'createdAt'>
): Promise<CalendarEvent> {
  const events = loadFromStorage(tenantId);
  const newEvent: CalendarEvent = {
    ...data,
    id: generateId(),
    tenantId,
    createdAt: new Date().toISOString(),
  };
  events.push(newEvent);
  saveToStorage(tenantId, events);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('calendar_events').upsert(eventToRow(newEvent), { onConflict: 'id' });
      if (error) logSupabaseError('createEvent', error);
    } catch (e) { logSupabaseError('createEvent (exception)', e); }
  }

  return newEvent;
}

/** 일정 삭제 */
export async function deleteEvent(tenantId: string, eventId: string): Promise<void> {
  const events = loadFromStorage(tenantId);
  saveToStorage(tenantId, events.filter(e => e.id !== eventId));

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
      if (error) logSupabaseError('deleteEvent', error);
    } catch (e) { logSupabaseError('deleteEvent (exception)', e); }
  }
}
