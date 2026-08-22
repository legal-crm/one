import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck, CheckCircle2, Clock, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Activity,
  ListCheck, Briefcase, MessageSquare, FolderHeart,
  Plus, Trash2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { getMyTasks, updateTaskStatus } from '../../services/taskTicketService';
import type { TaskTicket } from '../../types/communication';
import { TASK_PRIORITY_CONFIG } from '../../types/communication';
import { getEvents, createEvent, deleteEvent, EVENT_TYPE_CONFIG } from '../../services/calendarEventService';
import type { CalendarEvent, EventType } from '../../services/calendarEventService';

interface TasksScheduleTabProps {
  tenantId: string;
  userId: string;
  userName: string;
  requests: any[];
  cases: any[];
  qas: any[] | undefined;
  activeLawyerId: string;
}

type SubTab = 'tasks' | 'calendar' | 'activity';
type TaskFilter = 'all' | 'pending' | 'in_progress' | 'completed';
type CalView = 'month' | 'week';

const KOREAN_HOLIDAYS: Record<string, string> = {
  '01-01': '\uC2E0\uC815',
  '03-01': '\uC0BC\uC77C\uC808',
  '05-05': '\uC5B4\uB9B0\uC774\uB0A0',
  '06-06': '\uD604\uCDA9\uC77C',
  '08-15': '\uAD11\uBCF5\uC808',
  '10-03': '\uAC1C\uCC9C\uC808',
  '10-09': '\uD55C\uAE00\uB0A0',
  '12-25': '\uC131\uD0C4\uC808',
  '02-16': '\uC124\uB0A0 \uC804\uB0A0',
  '02-17': '\uC124\uB0A0',
  '02-18': '\uC124\uB0A0 \uB2E4\uC74C\uB0A0',
  '05-24': '\uBD80\uCC98\uB2D8\uC624\uC2E0\uB0A0',
  '09-24': '\uCD94\uC11D \uC804\uB0A0',
  '09-25': '\uCD94\uC11D',
  '09-26': '\uCD94\uC11D \uB2E4\uC74C\uB0A0',
};

function getHoliday(year: number, month: number, day: number): string | null {
  const key = String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  return KOREAN_HOLIDAYS[key] || null;
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '\uBC29\uAE08 \uC804';
  if (mins < 60) return mins + '\uBD84 \uC804';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + '\uC2DC\uAC04 \uC804';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + '\uC77C \uC804';
  return (d.getMonth() + 1) + '\uC6D4 ' + d.getDate() + '\uC77C';
}

function toDateKey(y: number, m: number, d: number): string {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function dDay(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function TasksScheduleTab({ tenantId, userId, userName, requests, cases, qas, activeLawyerId }: TasksScheduleTabProps) {
  const [sub, setSub] = useState<SubTab>('tasks');
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [calView, setCalView] = useState<CalView>('month');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
  });
  // Event type filter
  const [typeFilters, setTypeFilters] = useState<Record<EventType, boolean>>({
    court: true, consult: true, meeting: true, deadline: true, other: true,
  });
  // Add event modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvt, setNewEvt] = useState({ title: '', date: '', startTime: '', endTime: '', type: 'consult' as EventType, description: '', clientName: '' });

  const refreshTasks = useCallback(async () => {
    const all = await getMyTasks(tenantId, userId);
    setTasks(all.filter(t => t.status !== 'CANCELLED'));
  }, [tenantId, userId]);

  const refreshEvents = useCallback(async () => {
    const all = await getEvents(tenantId);
    setEvents(all);
  }, [tenantId]);

  useEffect(() => { refreshTasks(); refreshEvents(); }, [refreshTasks, refreshEvents]);

  const handleStart = async (id: string) => { await updateTaskStatus(tenantId, id, 'IN_PROGRESS'); refreshTasks(); };
  const handleComplete = async (id: string) => { await updateTaskStatus(tenantId, id, 'COMPLETED', completionNote); setCompletingId(null); setCompletionNote(''); refreshTasks(); };

  const handleAddEvent = async () => {
    if (!newEvt.title.trim() || !newEvt.date) { toast.error('\uC81C\uBAA9\uACFC \uB0A0\uC9DC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
    await createEvent(tenantId, { ...newEvt, createdBy: userId });
    toast.success('\uC77C\uC815\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    setShowAddModal(false);
    setNewEvt({ title: '', date: '', startTime: '', endTime: '', type: 'consult', description: '', clientName: '' });
    refreshEvents();
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(tenantId, id);
    toast.success('\uC77C\uC815\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    refreshEvents();
  };

  const openAddModalForDate = (dateStr: string) => {
    setNewEvt({ title: '', date: dateStr, startTime: '', endTime: '', type: 'consult', description: '', clientName: '' });
    setShowAddModal(true);
  };

  // Activity items
  const activityItems = useMemo(() => {
    const items: { id: string; type: string; icon: any; title: string; desc: string; date: Date; color: string; bg: string }[] = [];
    requests.forEach(r => {
      if (r.status === 'requested' || r.selectedLawyerId === userId || (r.acceptedLawyerIds || []).includes(userId)) {
        items.push({ id: 'r-' + r.id, type: 'request', icon: Briefcase, title: '\uC0C1\uB2F4 \uC694\uCCAD \uC811\uC218', desc: r.clientName, date: new Date(r.createdAt), color: 'text-brand', bg: 'bg-brand/10' });
      }
      if (r.status === 'counseling' && r.selectedLawyerId === userId) {
        items.push({ id: 'rc-' + r.id, type: 'counseling', icon: MessageSquare, title: '\uC0C1\uB2F4 \uC9C4\uD589 \uC911', desc: r.clientName, date: new Date(r.createdAt), color: 'text-indigo-600', bg: 'bg-indigo-50' });
      }
    });
    cases.forEach(c => {
      if (c.assignedLawyerId === userId) {
        items.push({ id: 'c-' + c.id, type: 'case', icon: FolderHeart, title: '\uC218\uC784 \uC804\uD658 \uC131\uACF5', desc: c.clientName, date: new Date(c.createdAt), color: 'text-purple-600', bg: 'bg-purple-50' });
      }
    });
    if (qas) {
      qas.filter(q => q.answer).forEach(q => {
        items.push({ id: 'q-' + q.id, type: 'qna', icon: ListCheck, title: 'Q&A \uB2F5\uBCC0 \uC791\uC131', desc: (q.question || '').slice(0, 30), date: new Date(q.createdAt), color: 'text-orange-600', bg: 'bg-orange-50' });
      });
    }
    tasks.filter(t => t.status === 'COMPLETED').forEach(t => {
      items.push({ id: 't-' + t.id, type: 'task', icon: CheckCircle2, title: '\uD0DC\uC2A4\uD06C \uC644\uB8CC', desc: t.title, date: new Date(t.completedAt || t.updatedAt), color: 'text-green-600', bg: 'bg-green-50' });
    });
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30);
  }, [requests, cases, qas, tasks, userId]);

  // Calendar helpers
  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const firstDow = new Date(calYear, calMon, 1).getDay();
  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const isTodayFn = (y: number, m: number, d: number) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  // Events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.filter(e => typeFilters[e.type]).forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events, typeFilters]);

  // Tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskTicket[]> = {};
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const dd = new Date(t.dueDate);
      const key = toDateKey(dd.getFullYear(), dd.getMonth(), dd.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // Today's events
  const todayEvents = eventsByDate[todayKey] || [];
  const todayTasks = tasksByDate[todayKey] || [];

  // Week view
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks.filter(t => t.status !== 'COMPLETED');
    if (filter === 'pending') return tasks.filter(t => t.status === 'PENDING');
    if (filter === 'in_progress') return tasks.filter(t => t.status === 'IN_PROGRESS');
    return tasks.filter(t => t.status === 'COMPLETED').slice(0, 10);
  }, [tasks, filter]);

  const filteredActivity = activityFilter === 'all' ? activityItems : activityItems.filter(a => a.type === activityFilter);
  const DAY_HEADERS = ['\uC77C','\uC6D4','\uD654','\uC218','\uBAA9','\uAE08','\uD1A0'];

  // Upcoming court dates
  const upcomingCourt = events.filter(e => e.type === 'court' && dDay(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-sm">
        {([
          { key: 'tasks' as const, label: '\uD560\uC77C \uBAA9\uB85D', icon: CalendarCheck },
          { key: 'calendar' as const, label: '\uC77C\uC815 \uCE98\uB9B0\uB354', icon: Calendar },
          { key: 'activity' as const, label: '\uD65C\uB3D9 \uAE30\uB85D', icon: Activity },
        ]).map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer press-scale active:scale-[0.98] flex items-center gap-2 ${sub === t.key ? 'bg-[#0F766E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══ Tasks ══ */}
      {sub === 'tasks' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all' as const, label: '\uD65C\uC131 \uC804\uCCB4' },
              { key: 'pending' as const, label: '\uB300\uAE30' },
              { key: 'in_progress' as const, label: '\uC9C4\uD589\uC911' },
              { key: 'completed' as const, label: '\uC644\uB8CC' },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer active:scale-[0.98] ${filter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center space-y-3">
              <CalendarCheck className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-500 font-bold">{'\uD560\uB2F9\uB41C \uC5C5\uBB34\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
              <p className="text-xs text-slate-400">{'\uACE0\uAC1D \uAD00\uB9AC(CRM)\uC5D0\uC11C \uC5C5\uBB34\uB97C \uC9C0\uC2DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const pri = TASK_PRIORITY_CONFIG[task.priority];
                const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';
                return (
                  <div key={task.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${pri.bgColor} ${pri.color}`}>{pri.emoji} {pri.label}</span>
                          {overdue && <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{'\uAE30\uD55C \uCD08\uACFC'}</span>}
                          {task.status === 'COMPLETED' && <span className="text-[10px] text-green-600 font-bold">{'\u2713 \uC644\uB8CC'}</span>}
                        </div>
                        <p className={`text-sm font-bold text-slate-800 ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                          <span>{task.assignerName}</span>
                          {task.dueDate && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{task.dueDate}</span>}
                        </div>
                      </div>
                      {task.status !== 'COMPLETED' && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {task.status === 'PENDING' && (
                            <button onClick={() => handleStart(task.id)} className="bg-blue-50 text-blue-600 rounded-xl px-3 py-1.5 text-[11px] font-bold hover:bg-blue-100 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer">{'\uC2DC\uC791'}</button>
                          )}
                          <button onClick={() => setCompletingId(completingId === task.id ? null : task.id)} className="bg-green-50 text-green-600 rounded-xl px-3 py-1.5 text-[11px] font-bold hover:bg-green-100 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer">{'\uC644\uB8CC'}</button>
                        </div>
                      )}
                    </div>
                    {completingId === task.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                        <input value={completionNote} onChange={e => setCompletionNote(e.target.value)} placeholder={'\uC644\uB8CC \uBA54\uBAA8 (\uC120\uD0DD)'} autoFocus className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                        <button onClick={() => handleComplete(task.id)} className="bg-green-600 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer active:scale-[0.98]">{'\uD655\uC778'}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Calendar ══ */}
      {sub === 'calendar' && (
        <div className="space-y-4">
          {/* Today banner */}
          {(todayEvents.length > 0 || todayTasks.length > 0) && (
            <div className="bg-brand/5 border border-brand/15 rounded-2xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand/10 shrink-0"><CalendarCheck className="w-5 h-5 text-brand" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800">{'\uC624\uB298\uC758 \uC77C\uC815'} ({todayEvents.length + todayTasks.length}{'\uAC74'})</p>
                <div className="mt-1 space-y-0.5">
                  {todayEvents.map(e => {
                    const cfg = EVENT_TYPE_CONFIG[e.type];
                    return <p key={e.id} className="text-xs text-slate-600"><span className="font-bold">{cfg.emoji}</span> {e.startTime && <span className="text-slate-400">{e.startTime} </span>}{e.title}</p>;
                  })}
                  {todayTasks.map(t => <p key={t.id} className="text-xs text-slate-600"><span className="font-bold">{'\uD83D\uDCCB'}</span> {t.title}</p>)}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming court dates */}
          {upcomingCourt.length > 0 && (
            <div className="bg-red-50/60 border border-red-200 rounded-2xl p-4">
              <p className="text-xs font-black text-red-700 mb-2">{'\uD83C\uDFDB\uFE0F \uB2E4\uAC00\uC624\uB294 \uBC95\uC6D0 \uAE30\uC77C'}</p>
              <div className="flex gap-3 flex-wrap">
                {upcomingCourt.map(e => {
                  const dd = dDay(e.date);
                  return (
                    <div key={e.id} className="bg-white rounded-xl px-3 py-2 border border-red-100 flex items-center gap-2">
                      <span className={`text-xs font-black ${dd <= 3 ? 'text-red-600' : 'text-red-400'}`}>{dd === 0 ? 'D-Day' : 'D-' + dd}</span>
                      <span className="text-xs font-bold text-slate-700">{e.title}</span>
                      <span className="text-[10px] text-slate-400">{e.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Type filters + Add button */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map(type => {
                const cfg = EVENT_TYPE_CONFIG[type];
                return (
                  <button key={type} onClick={() => setTypeFilters(p => ({ ...p, [type]: !p[type] }))}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1 ${typeFilters[type] ? cfg.bgColor + ' ' + cfg.color + ' border-current/20' : 'bg-slate-50 text-slate-300 border-slate-200 line-through'}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />{cfg.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => { const dk = selectedDay ? toDateKey(calYear, calMon, selectedDay) : toDateKey(today.getFullYear(), today.getMonth(), today.getDate()); openAddModalForDate(dk); }}
              className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm whitespace-nowrap">
              <Plus className="w-4 h-4" />{'\uC77C\uC815 \uCD94\uAC00'}
            </button>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {calView === 'month' ? (
                    <>
                      <button onClick={() => setCalMonth(new Date(calYear, calMon - 1))} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"><ChevronLeft className="w-5 h-5 text-white" /></button>
                      <h3 className="text-lg font-black text-white min-w-[140px] text-center">{calYear + '\uB144 ' + (calMon + 1) + '\uC6D4'}</h3>
                      <button onClick={() => setCalMonth(new Date(calYear, calMon + 1))} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"><ChevronRight className="w-5 h-5 text-white" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"><ChevronLeft className="w-5 h-5 text-white" /></button>
                      <h3 className="text-lg font-black text-white min-w-[200px] text-center">
                        {(weekStart.getMonth() + 1) + '\uC6D4 ' + weekStart.getDate() + '\uC77C ~ ' + (weekDays[6].getMonth() + 1) + '\uC6D4 ' + weekDays[6].getDate() + '\uC77C'}
                      </h3>
                      <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"><ChevronRight className="w-5 h-5 text-white" /></button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setCalMonth(new Date()); const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); setWeekStart(d); }} className="text-xs font-bold text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-all">{'\uC624\uB298'}</button>
                  <div className="flex bg-white/10 rounded-lg p-0.5">
                    <button onClick={() => setCalView('month')} className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${calView === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>{'\uC6D4'}</button>
                    <button onClick={() => setCalView('week')} className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${calView === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>{'\uC8FC'}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAY_HEADERS.map((d, i) => (
                <div key={d} className={`text-center text-sm font-bold py-3 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'} bg-slate-50`}>{d}</div>
              ))}
            </div>

            {/* Month view */}
            {calView === 'month' && (
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dow = (firstDow + i) % 7;
                  const isT = isTodayFn(calYear, calMon, day);
                  const holiday = getHoliday(calYear, calMon, day);
                  const dateKey = toDateKey(calYear, calMon, day);
                  const dayTasks = tasksByDate[dateKey] || [];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const sel = selectedDay === day;
                  const isHoliday = dow === 0 || !!holiday;
                  const allItems = [...dayEvents.map(e => ({ kind: 'event' as const, ...e })), ...dayTasks.map(t => ({ kind: 'task' as const, ...t }))];

                  return (
                    <button key={day} onClick={() => setSelectedDay(sel ? null : day)}
                      className={`min-h-[100px] p-2 border-b border-r border-slate-100 text-left transition-all cursor-pointer hover:bg-blue-50/40 ${sel ? 'bg-brand/5 ring-2 ring-brand/30 ring-inset' : ''} ${isT ? 'bg-brand/5' : ''}`}>
                      <div className="flex items-start justify-between mb-1">
                        {isT ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white text-sm font-black">{day}</span>
                        ) : (
                          <span className={`text-sm font-bold pl-0.5 pt-0.5 ${isHoliday ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'}`}>{day}</span>
                        )}
                        {holiday && <span className="text-[9px] font-bold text-red-400 truncate max-w-[60px]">{holiday}</span>}
                      </div>
                      {allItems.length > 0 && (
                        <div className="space-y-0.5">
                          {allItems.slice(0, 2).map((item, idx) => {
                            if (item.kind === 'event') {
                              const cfg = EVENT_TYPE_CONFIG[item.type as EventType];
                              return <div key={idx} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${cfg.bgColor} ${cfg.color}`}>{cfg.emoji} {item.title}</div>;
                            } else {
                              const pri = TASK_PRIORITY_CONFIG[(item as any).priority];
                              return <div key={idx} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${pri.bgColor} ${pri.color}`}>{item.title}</div>;
                            }
                          })}
                          {allItems.length > 2 && <div className="text-[9px] text-slate-400 font-bold pl-1">+{allItems.length - 2}</div>}
                        </div>
                      )}
                    </button>
                  );
                })}
                {(() => { const lastDow = (firstDow + daysInMonth - 1) % 7; return Array.from({ length: lastDow < 6 ? 6 - lastDow : 0 }).map((_, i) => <div key={'t' + i} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30" />); })()}
              </div>
            )}

            {/* Week view */}
            {calView === 'week' && (
              <div className="grid grid-cols-7">
                {weekDays.map((wd, i) => {
                  const isT = isTodayFn(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const holiday = getHoliday(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const dateKey = toDateKey(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const dayTasks = tasksByDate[dateKey] || [];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isHoliday = i === 0 || !!holiday;
                  return (
                    <div key={i} className={`min-h-[200px] p-2 border-r border-slate-100 last:border-r-0 ${isT ? 'bg-brand/5' : ''}`}>
                      <div className="flex flex-col items-center mb-2">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black ${isT ? 'bg-brand text-white' : isHoliday ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-700'}`}>{wd.getDate()}</span>
                        {holiday && <span className="text-[9px] font-bold text-red-400 mt-0.5">{holiday}</span>}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map(e => {
                          const cfg = EVENT_TYPE_CONFIG[e.type];
                          return <div key={e.id} className={`text-[10px] font-bold p-1.5 rounded-lg ${cfg.bgColor} ${cfg.color}`}><div className="truncate">{cfg.emoji} {e.title}</div>{e.startTime && <div className="text-[9px] opacity-70">{e.startTime}</div>}</div>;
                        })}
                        {dayTasks.map(t => {
                          const pri = TASK_PRIORITY_CONFIG[t.priority];
                          return <div key={t.id} className={`text-[10px] font-bold p-1.5 rounded-lg ${pri.bgColor} ${pri.color}`}><div className="truncate">{t.title}</div></div>;
                        })}
                        {dayEvents.length === 0 && dayTasks.length === 0 && <p className="text-[10px] text-slate-300 text-center pt-4">-</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected day detail */}
          {calView === 'month' && selectedDay && (() => {
            const dateKey = toDateKey(calYear, calMon, selectedDay);
            const dayEvents = eventsByDate[dateKey] || [];
            const dayTasks = tasksByDate[dateKey] || [];
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-800">{(calMon + 1) + '\uC6D4 ' + selectedDay + '\uC77C \uC77C\uC815'}</h4>
                  <button onClick={() => openAddModalForDate(dateKey)} className="text-xs font-bold text-brand flex items-center gap-1 cursor-pointer hover:text-brand/80"><Plus className="w-3.5 h-3.5" />{'\uC77C\uC815 \uCD94\uAC00'}</button>
                </div>
                {dayEvents.length === 0 && dayTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">{'\uC774 \uB0A0\uC9DC\uC5D0 \uC608\uC815\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
                ) : (
                  <div className="space-y-2">
                    {dayEvents.map(e => {
                      const cfg = EVENT_TYPE_CONFIG[e.type];
                      return (
                        <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bgColor}`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.dotColor} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold ${cfg.color}`}>{cfg.emoji} {e.title}</p>
                            <div className="text-[11px] text-slate-400 flex gap-2">
                              {e.startTime && <span>{e.startTime}{e.endTime ? ' ~ ' + e.endTime : ''}</span>}
                              {e.clientName && <span>{e.clientName}</span>}
                            </div>
                            {e.description && <p className="text-[11px] text-slate-500 mt-0.5">{e.description}</p>}
                          </div>
                          <button onClick={(ev) => { ev.stopPropagation(); handleDeleteEvent(e.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 cursor-pointer active:scale-[0.95] transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })}
                    {dayTasks.map(t => {
                      const pri = TASK_PRIORITY_CONFIG[t.priority];
                      return (
                        <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${pri.bgColor} ${pri.color}`}>{pri.emoji}</span>
                          <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{t.title}</p><p className="text-[11px] text-slate-400">{t.assignerName}</p></div>
                          <span className="text-[10px] font-bold text-slate-500">{t.status === 'COMPLETED' ? '\uC644\uB8CC' : t.status === 'IN_PROGRESS' ? '\uC9C4\uD589\uC911' : '\uB300\uAE30'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Holiday legend */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h4 className="text-xs font-bold text-slate-500 mb-2">{'\uC774\uBC88 \uB2EC \uD734\uC77C'}</h4>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const holidays: { day: number; name: string }[] = [];
                for (let d = 1; d <= daysInMonth; d++) { const h = getHoliday(calYear, calMon, d); if (h) holidays.push({ day: d, name: h }); }
                return holidays.length > 0 ? holidays.map(h => (
                  <span key={h.day} className="text-xs bg-red-50 text-red-500 font-bold px-2 py-1 rounded-lg border border-red-100">{(calMon + 1) + '/' + h.day + ' ' + h.name}</span>
                )) : <span className="text-xs text-slate-300">{'\uD734\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</span>;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══ Activity ══ */}
      {sub === 'activity' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all', label: '\uC804\uCCB4' },
              { key: 'request', label: '\uC0C1\uB2F4 \uC811\uC218' },
              { key: 'counseling', label: '\uC0C1\uB2F4 \uC9C4\uD589' },
              { key: 'case', label: '\uC218\uC784 \uC804\uD658' },
              { key: 'qna', label: 'Q&A \uB2F5\uBCC0' },
              { key: 'task', label: '\uD0DC\uC2A4\uD06C' },
            ]).map(f => (
              <button key={f.key} onClick={() => setActivityFilter(f.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer active:scale-[0.98] ${activityFilter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {filteredActivity.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center space-y-3">
              <Activity className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-500 font-bold">{'\uD65C\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="space-y-0">
                {filteredActivity.map((item, idx) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0`}><item.icon className={`w-4 h-4 ${item.color}`} /></div>
                      {idx < filteredActivity.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="pb-5 flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-500 truncate">{item.desc}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Add Event Modal ══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-brand" />{'\uC77C\uC815 \uCD94\uAC00'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {/* Type selection */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uC77C\uC815 \uC720\uD615'}</label>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map(type => {
                  const cfg = EVENT_TYPE_CONFIG[type];
                  return (
                    <button key={type} onClick={() => setNewEvt(p => ({ ...p, type }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1 ${newEvt.type === type ? cfg.bgColor + ' ' + cfg.color + ' border-current shadow-sm ring-2 ring-current/20' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uC81C\uBAA9'} *</label>
              <input value={newEvt.title} onChange={e => setNewEvt(p => ({ ...p, title: e.target.value }))} placeholder={'\uC77C\uC815 \uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694'} autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uB0A0\uC9DC'} *</label>
                <input type="date" value={newEvt.date} onChange={e => setNewEvt(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uC2DC\uC791'}</label>
                <input type="time" value={newEvt.startTime} onChange={e => setNewEvt(p => ({ ...p, startTime: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uC885\uB8CC'}</label>
                <input type="time" value={newEvt.endTime} onChange={e => setNewEvt(p => ({ ...p, endTime: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
            </div>

            {/* Client + Description */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uAD00\uB828 \uC758\uB8B0\uC778'}</label>
              <input value={newEvt.clientName} onChange={e => setNewEvt(p => ({ ...p, clientName: e.target.value }))} placeholder={'\uC120\uD0DD'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">{'\uBA54\uBAA8'}</label>
              <textarea value={newEvt.description} onChange={e => setNewEvt(p => ({ ...p, description: e.target.value }))} placeholder={'\uC120\uD0DD'} rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand resize-none" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-[0.98] transition-all">{'\uCDE8\uC18C'}</button>
              <button onClick={handleAddEvent} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm">{'\uC800\uC7A5'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
