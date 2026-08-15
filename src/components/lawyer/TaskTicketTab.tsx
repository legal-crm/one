import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, Calendar, User
} from 'lucide-react';
import {
  createTask, getTasksByTarget, updateTaskStatus
} from '../../services/taskTicketService';
import type { TaskTicket, TaskPriority, TaskStatus } from '../../types/communication';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../types/communication';
import type { StaffMember } from '../../types';

interface TaskTicketTabProps {
  tenantId: string;
  targetType: 'consult_request' | 'case' | 'copilot_review';
  targetId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  staffMembers: StaffMember[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default function TaskTicketTab({
  tenantId, targetType, targetId, actorId, actorName, actorRole, staffMembers
}: TaskTicketTabProps) {
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // 새 업무 폼
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('NORMAL');
  const [newDueDate, setNewDueDate] = useState('');

  const canAssign = actorRole === 'OWNER' || actorRole === 'LAWYER';

  const refresh = useCallback(async () => {
    const all = await getTasksByTarget(tenantId, targetType, targetId);
    setTasks(all);
  }, [tenantId, targetType, targetId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newAssigneeId) return;
    const assignee = staffMembers.find(s => s.id === newAssigneeId);
    await createTask(tenantId, {
      targetType, targetId,
      assignerId: actorId, assignerName: actorName,
      assigneeId: newAssigneeId, assigneeName: assignee?.name || '',
      title: newTitle.trim(), description: newDesc.trim() || undefined,
      priority: newPriority, dueDate: newDueDate || undefined,
    });
    setNewTitle(''); setNewDesc(''); setNewAssigneeId(''); setNewPriority('NORMAL'); setNewDueDate('');
    setShowForm(false);
    refresh();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    if (status === 'COMPLETED') {
      setCompletingId(taskId);
      return;
    }
    await updateTaskStatus(tenantId, taskId, status);
    refresh();
  };

  const handleComplete = async (taskId: string) => {
    await updateTaskStatus(tenantId, taskId, 'COMPLETED', completionNote);
    setCompletingId(null); setCompletionNote('');
    refresh();
  };

  const filtered = statusFilter === 'ALL' ? tasks : tasks.filter(t => t.status === statusFilter);
  const pendingCount = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                statusFilter === st ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? `전체 (${tasks.length})` : `${TASK_STATUS_CONFIG[st].emoji} ${TASK_STATUS_CONFIG[st].label}`}
            </button>
          ))}
        </div>
        {canAssign && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand text-white rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 업무 지시
          </button>
        )}
      </div>

      {/* 새 업무 폼 */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2.5">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="업무 제목 (예: 재직증명서 수취)"
            className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"
          />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="상세 설명 (선택)"
            className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs resize-none outline-none focus:ring-2 focus:ring-brand/30"
            rows={2}
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs outline-none">
              <option value="">담당자 선택</option>
              {staffMembers.filter(s => s.status === 'active').map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs outline-none">
              {(Object.keys(TASK_PRIORITY_CONFIG) as TaskPriority[]).map(p => (
                <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].emoji} {TASK_PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newTitle.trim() || !newAssigneeId}
              className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50">
              할당
            </button>
            <button onClick={() => setShowForm(false)}
              className="bg-slate-100 text-slate-600 rounded-xl px-4 py-2 font-bold text-xs hover:bg-slate-200 active:scale-[0.98] transition-all">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 업무 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-bold">
            {statusFilter === 'ALL' ? '할당된 업무가 없습니다' : '해당 상태의 업무가 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const priCfg = TASK_PRIORITY_CONFIG[task.priority];
            const stCfg = TASK_STATUS_CONFIG[task.status];
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
            const isAssignee = task.assigneeId === actorId;

            return (
              <div key={task.id} className={`bg-white border rounded-xl p-3 ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold ${priCfg.color} ${priCfg.bgColor}`}>{priCfg.emoji} {priCfg.label}</span>
                      <span className={`text-[10px] font-bold ${stCfg.color}`}>{stCfg.emoji} {stCfg.label}</span>
                      {isOverdue && <span className="text-[9px] text-red-500 font-bold">⏰ 기한 초과</span>}
                    </div>
                    <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                    {task.description && <p className="text-[11px] text-slate-500 mt-0.5">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5"><User className="w-3 h-3" /> {task.assignerName} → {task.assigneeName}</span>
                      {task.dueDate && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {task.dueDate}</span>}
                      <span>{timeAgo(task.createdAt)}</span>
                    </div>
                    {task.completionNote && (
                      <p className="text-[11px] text-green-600 mt-1 bg-green-50 rounded-lg px-2 py-1">✓ {task.completionNote}</p>
                    )}
                  </div>

                  {/* 상태 변경 버튼 */}
                  {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {isAssignee && task.status === 'PENDING' && (
                        <button onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                          className="bg-blue-50 text-blue-600 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-blue-100 active:scale-[0.98] transition-all">
                          시작
                        </button>
                      )}
                      {isAssignee && (
                        <button onClick={() => handleStatusChange(task.id, 'COMPLETED')}
                          className="bg-green-50 text-green-600 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-green-100 active:scale-[0.98] transition-all">
                          완료
                        </button>
                      )}
                      {canAssign && (
                        <button onClick={() => handleStatusChange(task.id, 'CANCELLED')}
                          className="bg-slate-50 text-slate-400 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-slate-100 active:scale-[0.98] transition-all">
                          취소
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 완료 메모 입력 */}
                {completingId === task.id && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2">
                    <input value={completionNote} onChange={e => setCompletionNote(e.target.value)}
                      placeholder="완료 메모 (선택)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand/30"
                      autoFocus
                    />
                    <button onClick={() => handleComplete(task.id)}
                      className="bg-green-600 text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-green-700 active:scale-[0.98] transition-all">
                      완료 확인
                    </button>
                    <button onClick={() => { setCompletingId(null); setCompletionNote(''); }}
                      className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold">
                      취소
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
