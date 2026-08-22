import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck, CheckCircle2, Clock, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Activity,
  ListCheck, Briefcase, MessageSquare, FolderHeart
} from 'lucide-react';
import { getMyTasks, updateTaskStatus } from '../../services/taskTicketService';
import type { TaskTicket } from '../../types/communication';
import { TASK_PRIORITY_CONFIG } from '../../types/communication';

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

export default function TasksScheduleTab({ tenantId, userId, userName, requests, cases, qas, activeLawyerId }: TasksScheduleTabProps) {
  const [sub, setSub] = useState<SubTab>('tasks');
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    const all = await getMyTasks(tenantId, userId);
    setTasks(all.filter(t => t.status !== 'CANCELLED'));
  }, [tenantId, userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleStart = async (id: string) => {
    await updateTaskStatus(tenantId, id, 'IN_PROGRESS');
    refresh();
  };

  const handleComplete = async (id: string) => {
    await updateTaskStatus(tenantId, id, 'COMPLETED', completionNote);
    setCompletingId(null);
    setCompletionNote('');
    refresh();
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
  const isToday = (d: number) => today.getFullYear() === calYear && today.getMonth() === calMon && today.getDate() === d;

  const tasksByDay = useMemo(() => {
    const map: Record<number, TaskTicket[]> = {};
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const dd = new Date(t.dueDate);
      if (dd.getFullYear() === calYear && dd.getMonth() === calMon) {
        const day = dd.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(t);
      }
    });
    return map;
  }, [tasks, calYear, calMon]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks.filter(t => t.status !== 'COMPLETED');
    if (filter === 'pending') return tasks.filter(t => t.status === 'PENDING');
    if (filter === 'in_progress') return tasks.filter(t => t.status === 'IN_PROGRESS');
    return tasks.filter(t => t.status === 'COMPLETED').slice(0, 10);
  }, [tasks, filter]);

  const filteredActivity = activityFilter === 'all' ? activityItems : activityItems.filter(a => a.type === activityFilter);

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
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tasks sub-tab */}
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
                        {task.completionNote && <p className="text-xs text-slate-500 mt-1 italic">&quot;{task.completionNote}&quot;</p>}
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
                        <input value={completionNote} onChange={e => setCompletionNote(e.target.value)} placeholder={'\uC644\uB8CC \uBA54\uBAA8 (\uC120\uD0DD)'} autoFocus
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
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

      {/* Calendar sub-tab */}
      {sub === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalMonth(new Date(calYear, calMon - 1))} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer active:scale-[0.98] transition-all"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <h3 className="text-base font-black text-slate-800">{calYear + '\uB144 ' + (calMon + 1) + '\uC6D4'}</h3>
              <button onClick={() => setCalMonth(new Date(calYear, calMon + 1))} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer active:scale-[0.98] transition-all"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['\uC77C','\uC6D4','\uD654','\uC218','\uBAA9','\uAE08','\uD1A0'].map((d, i) => (
                <div key={d} className={`text-center text-xs font-bold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const hasTasks = !!tasksByDay[day];
                const sel = selectedDay === day;
                return (
                  <button key={day} onClick={() => setSelectedDay(sel ? null : day)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.95] ${
                      sel ? 'bg-brand text-white shadow-md' :
                      isToday(day) ? 'bg-brand/10 text-brand border border-brand/20' :
                      'text-slate-700 hover:bg-slate-100'
                    }`}>
                    {day}
                    {hasTasks && !sel && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-brand" />}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="font-bold text-sm text-slate-800 mb-3">{(calMon + 1) + '\uC6D4 ' + selectedDay + '\uC77C \uC77C\uC815'}</h4>
              {(tasksByDay[selectedDay] || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">{'\uC774 \uB0A0\uC9DC\uC5D0 \uC608\uC815\uB41C \uC5C5\uBB34\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
              ) : (
                <div className="space-y-2">
                  {(tasksByDay[selectedDay] || []).map(t => {
                    const pri = TASK_PRIORITY_CONFIG[t.priority];
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${pri.bgColor} ${pri.color}`}>{pri.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{t.title}</p>
                          <p className="text-[11px] text-slate-400">{t.assignerName}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{t.status === 'COMPLETED' ? '\uC644\uB8CC' : t.status === 'IN_PROGRESS' ? '\uC9C4\uD589\uC911' : '\uB300\uAE30'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity sub-tab */}
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
                      <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                      </div>
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
    </div>
  );
}
