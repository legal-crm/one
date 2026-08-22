// ============================================================
// 캘린더 일정 서비스
// localStorage 기반 (사무실별 분리)
// ============================================================

export type EventType = 'court' | 'consult' | 'meeting' | 'deadline' | 'other';

export interface CalendarEvent {
  id: string;
  tenantId: string;
  title: string;
  date: string;           // YYYY-MM-DD
  startTime?: string;     // HH:mm
  endTime?: string;       // HH:mm
  type: EventType;
  description?: string;
  clientName?: string;
  createdBy: string;
  createdAt: string;
}

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; emoji: string; color: string; bgColor: string; dotColor: string }> = {
  court:    { label: '\uBC95\uC6D0 \uAE30\uC77C', emoji: '\uD83C\uDFDB\uFE0F', color: 'text-red-600',    bgColor: 'bg-red-50',    dotColor: 'bg-red-500' },
  consult:  { label: '\uC0C1\uB2F4 \uC77C\uC815', emoji: '\uD83D\uDCAC', color: 'text-blue-600',   bgColor: 'bg-blue-50',   dotColor: 'bg-blue-500' },
  meeting:  { label: '\uB0B4\uBD80 \uD68C\uC758', emoji: '\uD83D\uDC65', color: 'text-purple-600', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
  deadline: { label: '\uB9C8\uAC10\uC77C',     emoji: '\u23F0', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' },
  other:    { label: '\uAE30\uD0C0',         emoji: '\uD83D\uDCCC', color: 'text-slate-600',  bgColor: 'bg-slate-100', dotColor: 'bg-slate-400' },
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

export async function getEvents(tenantId: string): Promise<CalendarEvent[]> {
  return loadFromStorage(tenantId);
}

export async function getEventsByDate(tenantId: string, date: string): Promise<CalendarEvent[]> {
  const all = loadFromStorage(tenantId);
  return all.filter(e => e.date === date);
}

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

export async function deleteEvent(tenantId: string, eventId: string): Promise<void> {
  const events = loadFromStorage(tenantId);
  const filtered = events.filter(e => e.id !== eventId);
  saveToStorage(tenantId, filtered);
}
