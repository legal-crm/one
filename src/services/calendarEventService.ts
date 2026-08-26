// ============================================================
// 캘린더 일정 서비스
// localStorage 기반 (사무실별 분리) + 가시성(visibility) 권한
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
  court:    { label: '\uBC95\uC6D0 \uAE30\uC77C', emoji: '\uD83C\uDFDB\uFE0F', color: 'text-red-600',    bgColor: 'bg-red-50',    dotColor: 'bg-red-500' },
  consult:  { label: '\uC0C1\uB2F4 \uC77C\uC815', emoji: '\uD83D\uDCAC', color: 'text-blue-600',   bgColor: 'bg-blue-50',   dotColor: 'bg-blue-500' },
  meeting:  { label: '\uB0B4\uBD80 \uD68C\uC758', emoji: '\uD83D\uDC65', color: 'text-purple-600', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
  deadline: { label: '\uB9C8\uAC10\uC77C',     emoji: '\u23F0', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' },
  other:    { label: '\uAE30\uD0C0',         emoji: '\uD83D\uDCCC', color: 'text-slate-600',  bgColor: 'bg-slate-100', dotColor: 'bg-slate-400' },
};

export const VISIBILITY_CONFIG: Record<EventVisibility, { label: string; emoji: string; color: string; bgColor: string }> = {
  firm:     { label: '\uC804\uCCB4 \uACF5\uC720', emoji: '\uD83C\uDFE2', color: 'text-brand',      bgColor: 'bg-brand/10' },
  lawyers:  { label: '\uBCC0\uD638\uC0AC\uB9CC', emoji: '\u2696\uFE0F', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  personal: { label: '\uB098\uB9CC \uBCF4\uAE30', emoji: '\uD83D\uDD12', color: 'text-slate-500',  bgColor: 'bg-slate-50' },
};

const STORAGE_KEY = 'cal-events';

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

/** 모든 일정 조회 (필터 없음) */
export async function getEvents(tenantId: string): Promise<CalendarEvent[]> {
  return loadFromStorage(tenantId);
}

/** 가시성 기반 필터링된 일정 조회 */
export async function getVisibleEvents(
  tenantId: string,
  userId: string,
  userRole: string
): Promise<CalendarEvent[]> {
  const all = loadFromStorage(tenantId);
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
  return newEvent;
}

/** 일정 삭제 */
export async function deleteEvent(tenantId: string, eventId: string): Promise<void> {
  const events = loadFromStorage(tenantId);
  saveToStorage(tenantId, events.filter(e => e.id !== eventId));
}
