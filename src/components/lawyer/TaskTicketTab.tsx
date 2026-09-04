import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Calendar, User, Check, Trash2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import {
  createTask, getTasksByTarget, updateTaskStatus, deleteTask
} from '../../services/taskTicketService';
import type { TaskTicket, TaskPriority, TaskStatus, MessageTargetType } from '../../types/communication';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../types/communication';
import type { StaffMember } from '../../types';

interface TaskTicketTabProps {
  tenantId: string;
  targetType: MessageTargetType;
  targetId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  staffMembers: StaffMember[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default function TaskTicketTab({
  tenantId, targetType, targetId, actorId, actorName, actorRole, staffMembers
}: TaskTicketTabProps) {
  const dialog = useDialog();
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // 새 업무 폼 상태
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('업무 제목을 입력해주세요');
      return;
    }
    if (!newAssigneeId) {
      toast.error('담당자를 선택해주세요');
      return;
    }

    const assignee = staffMembers.find(s => s.id === newAssigneeId);
    await createTask(tenantId, {
      targetType,
      targetId,
      assignerId: actorId,
      assignerName: actorName,
      assigneeId: newAssigneeId,
      assigneeName: assignee?.name || '',
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      priority: newPriority,
      dueDate: newDueDate || undefined,
    });

    toast.success('업무가 성공적으로 지시되었습니다');
    setNewTitle('');
    setNewDesc('');
    setNewAssigneeId('');
    setNewPriority('NORMAL');
    setNewDueDate('');
    setShowForm(false);
    refresh();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    if (status === 'COMPLETED') {
      setCompletingId(taskId);
      return;
    }
    await updateTaskStatus(tenantId, taskId, status);
    toast.success('상태가 변경되었습니다');
    refresh();
  };

  const handleComplete = async (taskId: string) => {
    await updateTaskStatus(tenantId, taskId, 'COMPLETED', completionNote);
    toast.success('업무 완료 처리되었습니다');
    setCompletingId(null);
    setCompletionNote('');
    refresh();
  };

  const handleDelete = async (taskId: string) => {
    const confirmed = await dialog.confirm({
      title: '업무 지시 삭제',
      message: '이 업무 지시를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    await deleteTask(tenantId, taskId);
    toast.success('업무가 삭제되었습니다');
    refresh();
  };

  const filtered = statusFilter === 'ALL' ? tasks : tasks.filter(t => t.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* 헤더 & 필터 & 업무 지시 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
                statusFilter === st
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? `전체 (${tasks.length})` : `${TASK_STATUS_CONFIG[st].emoji} ${TASK_STATUS_CONFIG[st].label}`}
            </button>
          ))}
        </div>
        {canAssign && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand text-white rounded-xl px-3.5 py-1.5 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? '닫기' : '새 업무 지시'}
          </button>
        )}
      </div>

      {/* 새 업무 작성 폼 */}
      {showForm && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
            <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-brand" /> 담당 직원 업무 지시서 작성
            </span>
            <span className="text-[11px] text-blue-700 font-medium">
              지시 즉시 해당 직원에게 실시간 알림이 발송됩니다.
            </span>
          </div>

          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="업무 제목 (예: 직전 1년 급여명세서 및 통장 사본 수취)"
            className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand/30"
          />

          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="상세 지시사항 또는 주의사항 (선택)"
            className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-brand/30 resize-none"
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={newAssigneeId}
              onChange={e => setNewAssigneeId(e.target.value)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">담당 직원 선택 *</option>
              {staffMembers.filter(s => s.status === 'active').map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as TaskPriority)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none"
            >
              {(Object.keys(TASK_PRIORITY_CONFIG) as TaskPriority[]).map(p => (
                <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].emoji} {TASK_PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>

            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="bg-white border border-blue-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2 font-bold text-xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newAssigneeId}
              className="bg-brand text-white rounded-xl px-5 py-2 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              업무 할당 완료
            </button>
          </div>
        </div>
      )}

      {/* 업무 목록 컨테이너 */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold">
            {statusFilter === 'ALL' ? '이 사건에 할당된 업무가 없습니다' : '해당 상태의 업무가 없습니다'}
          </p>
          {canAssign && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-brand font-bold hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 지금 직원에게 업무 지시하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(task => {
            const priCfg = TASK_PRIORITY_CONFIG[task.priority];
            const stCfg = TASK_STATUS_CONFIG[task.status];
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
            const isAssignee = task.assigneeId === actorId;

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-2xl p-3.5 shadow-xs transition-all ${
                  isOverdue ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${priCfg.color} ${priCfg.bgColor}`}>
                        {priCfg.emoji} {priCfg.label}
                      </span>
                      <span className={`text-[10px] font-bold ${stCfg.color}`}>
                        {stCfg.emoji} {stCfg.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded-md">
                          ⏰ 기한 초과
                        </span>
                      )}
                    </div>

                    <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {task.title}
                    </p>

                    {task.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <strong className="text-slate-600">{task.assignerName}</strong> → <strong className="text-slate-700">{task.assigneeName}</strong>
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          마감: <span className={isOverdue ? 'text-red-500 font-bold' : 'text-slate-600'}>{task.dueDate}</span>
                        </span>
                      )}
                      <span>{timeAgo(task.createdAt)}</span>
                    </div>

                    {task.completionNote && (
                      <div className="mt-2 bg-green-50 rounded-xl px-3 py-1.5 text-xs text-green-700 flex items-center gap-1.5 border border-green-200/60">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>완료 메모: {task.completionNote}</span>
                      </div>
                    )}
                  </div>

                  {/* 상태 변경 버튼 */}
                  {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {isAssignee && task.status === 'PENDING' && (
                        <button
                          onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                          className="bg-blue-50 text-blue-600 rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-blue-100 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          시작
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(task.id, 'COMPLETED')}
                        className="bg-green-50 text-green-600 rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-green-100 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        완료
                      </button>
                      {canAssign && (
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-slate-400 hover:text-red-500 text-[11px] font-bold p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 완료 메모 입력 */}
                {completingId === task.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                    <input
                      value={completionNote}
                      onChange={e => setCompletionNote(e.target.value)}
                      placeholder="완료 메모를 입력하세요 (선택)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand/30"
                      autoFocus
                    />
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="bg-green-600 text-white rounded-xl px-3.5 py-2 text-xs font-bold hover:bg-green-700 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      완료 확인
                    </button>
                    <button
                      onClick={() => { setCompletingId(null); setCompletionNote(''); }}
                      className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                    >
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
