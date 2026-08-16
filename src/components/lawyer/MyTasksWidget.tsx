import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, User, Calendar } from 'lucide-react';
import { getMyTasks, updateTaskStatus } from '../../services/taskTicketService';
import type { TaskTicket, TaskStatus } from '../../types/communication';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../types/communication';

interface MyTasksWidgetProps {
  tenantId: string;
  userId: string;
  userName: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MyTasksWidget({ tenantId, userId, userName }: MyTasksWidgetProps) {
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [completionNote, setCompletionNote] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await getMyTasks(tenantId, userId);
    setTasks(all.filter(t => t.status !== 'CANCELLED'));
  }, [tenantId, userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const recentCompleted = tasks.filter(t => t.status === 'COMPLETED').slice(0, 3);

  const handleStart = async (taskId: string) => {
    await updateTaskStatus(tenantId, taskId, 'IN_PROGRESS');
    refresh();
  };

  const handleComplete = async (taskId: string) => {
    await updateTaskStatus(tenantId, taskId, 'COMPLETED', completionNote);
    setCompletingId(null);
    setCompletionNote('');
    refresh();
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-brand" /> My Tasks
        </h3>
        <div className="text-center py-4">
          <CheckCircle2 className="w-6 h-6 text-slate-200 mx-auto mb-1" />
          <p className="text-xs text-slate-400 font-bold">No tasks assigned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand" /> My Tasks
          {activeTasks.length > 0 && (
            <span className="bg-brand text-white text-[10px] font-extrabold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {activeTasks.length}
            </span>
          )}
        </h3>
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-2 mb-3">
          {activeTasks.map(task => {
            const priCfg = TASK_PRIORITY_CONFIG[task.priority];
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

            return (
              <div key={task.id} className={`rounded-xl p-3 border ${isOverdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`text-[9px] font-extrabold px-1 py-0.5 rounded ${priCfg.color} ${priCfg.bgColor}`}>
                        {priCfg.emoji}
                      </span>
                      {isOverdue && <span className="text-[9px] text-red-500 font-bold">overdue</span>}
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{task.assignerName}</span>
                      {task.dueDate && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{task.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {task.status === 'PENDING' && (
                      <button onClick={() => handleStart(task.id)}
                        className="bg-blue-50 text-blue-600 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-blue-100 active:scale-[0.98] transition-all whitespace-nowrap">
                        Start
                      </button>
                    )}
                    <button onClick={() => setCompletingId(completingId === task.id ? null : task.id)}
                      className="bg-green-50 text-green-600 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-green-100 active:scale-[0.98] transition-all whitespace-nowrap">
                      Done
                    </button>
                  </div>
                </div>
                {completingId === task.id && (
                  <div className="mt-2 pt-2 border-t border-slate-200 flex gap-1.5">
                    <input value={completionNote} onChange={e => setCompletionNote(e.target.value)}
                      placeholder="Note (optional)" autoFocus
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none" />
                    <button onClick={() => handleComplete(task.id)}
                      className="bg-green-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold">OK</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Completed */}
      {recentCompleted.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">Recently completed</p>
          {recentCompleted.map(task => (
            <div key={task.id} className="flex items-center gap-2 py-1 text-[10px] text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
              <span className="truncate line-through">{task.title}</span>
              <span className="shrink-0">{timeAgo(task.completedAt || task.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
