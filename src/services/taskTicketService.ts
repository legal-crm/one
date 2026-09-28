// ============================================================
// 업무 할당 티켓 서비스
// - Supabase가 설정돼 있으면 서버(task_tickets)만 사용한다. 저장·변경에 실패하면 예외를 던진다.
//   (이전: 서버 오류를 삼키고 이 브라우저 localStorage에만 저장 → '등록되었습니다' 후 목록에서 사라짐)
// - Supabase 미설정(로컬 개발)일 때만 localStorage를 쓴다.
// - 상태 전이는 assertTaskTransition()으로 검사한다.
//   · 검토 승인이 필요한 업무는 '완료'로 바로 바꿀 수 없고 검토 요청 → 승인을 거쳐야 한다.
//   · 승인·반려는 '검토 요청' 상태에서만, 담당자 본인이 아닌 사람만 할 수 있다.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { TaskTicket, TaskPriority, TaskStatus, MessageTargetType, TaskSubtask } from '../types/communication';
import { createNotification } from './notificationCenterService';
import { generateUUID } from '../utils/deviceDetector';

const STORAGE_KEY = 'task-tickets';

function loadFromStorage(tenantId: string): TaskTicket[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(tenantId: string, tickets: TaskTicket[]) {
  localStorage.setItem(`${STORAGE_KEY}-${tenantId}`, JSON.stringify(tickets));
}

function serverError(action: string, error: any): Error {
  const msg = error?.message || String(error || '');
  console.error(`[TaskTicket] ${action} 실패:`, msg);
  return new Error(`업무를 ${action}하지 못했습니다. 잠시 후 다시 시도해 주세요.${msg ? ` (${msg})` : ''}`);
}

/** 알림 실패는 업무 처리 자체를 되돌리지 않는다 */
async function notifySafe(...args: Parameters<typeof createNotification>) {
  try { await createNotification(...args); } catch (e) { console.warn('[TaskTicket] 알림 생성 실패:', e); }
}

// ── 상태 전이 규칙 ──

export type TaskAction = 'start' | 'complete' | 'request_review' | 'approve' | 'reject' | 'cancel';

/**
 * 상태 전이 가능 여부 — 가능하면 null, 불가하면 사유 문자열
 * @param actorId 행위자 ID (승인·반려 시 담당자 본인 여부 판단)
 */
export function checkTaskTransition(task: Pick<TaskTicket, 'status' | 'requiresApproval' | 'assigneeId'>, action: TaskAction, actorId?: string): string | null {
  const s = task.status;
  if (s === 'COMPLETED' || s === 'CANCELLED') return '이미 종료된 업무입니다.';
  switch (action) {
    case 'start':
      return s === 'PENDING' ? null : '대기 중인 업무만 시작할 수 있습니다.';
    case 'complete':
      if (task.requiresApproval) return '검토 승인이 필요한 업무입니다. 검토 요청 후 승인받아 완료해 주세요.';
      return s === 'PENDING' || s === 'IN_PROGRESS' ? null : '진행 중인 업무만 완료할 수 있습니다.';
    case 'request_review':
      if (!task.requiresApproval) return '검토 승인이 필요 없는 업무입니다.';
      return s === 'IN_PROGRESS' || s === 'PENDING' ? null : '진행 중인 업무만 검토 요청할 수 있습니다.';
    case 'approve':
    case 'reject':
      if (s !== 'REVIEW_REQUESTED') return '검토 요청된 업무만 승인·반려할 수 있습니다.';
      if (actorId && actorId === task.assigneeId) return '담당자 본인은 자기 업무를 승인·반려할 수 없습니다.';
      return null;
    case 'cancel':
      return null;
  }
}

function assertTaskTransition(task: TaskTicket | null, action: TaskAction, actorId?: string): TaskTicket {
  if (!task) throw new Error('업무를 찾을 수 없습니다.');
  const reason = checkTaskTransition(task, action, actorId);
  if (reason) throw new Error(reason);
  return task;
}

// ── 생성 ──

export type CreateTaskInput = {
  targetType: MessageTargetType;
  targetId: string;
  assignerId: string;
  assignerName: string;
  assigneeId: string;
  assigneeName: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  subtasks?: TaskSubtask[];
  requiresApproval?: boolean;
  templateId?: string;
  caseStage?: string;
  taskDomain?: 'sales' | 'client';
  leadId?: string;
  leadPhone?: string;
  leadDebt?: number;
};

/** 업무 생성 — 서버 저장 실패 시 예외 */
export async function createTask(tenantId: string, data: CreateTaskInput): Promise<TaskTicket> {
  const now = new Date().toISOString();
  const ticket: TaskTicket = {
    id: generateUUID(),
    tenantId,
    targetType: data.targetType,
    targetId: data.targetId,
    assignerId: data.assignerId,
    assignerName: data.assignerName,
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    title: data.title,
    description: data.description,
    priority: data.priority || 'NORMAL',
    status: 'PENDING',
    dueDate: data.dueDate,
    subtasks: data.subtasks || [],
    requiresApproval: data.requiresApproval || false,
    templateId: data.templateId,
    caseStage: data.caseStage,
    taskDomain: data.taskDomain,
    leadId: data.leadId,
    leadPhone: data.leadPhone,
    leadDebt: data.leadDebt,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('task_tickets').insert({
      id: ticket.id,
      tenant_id: ticket.tenantId,
      target_type: ticket.targetType,
      target_id: ticket.targetId,
      assigner_id: ticket.assignerId,
      assigner_name: ticket.assignerName,
      assignee_id: ticket.assigneeId,
      assignee_name: ticket.assigneeName,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      due_date: ticket.dueDate || null,
      subtasks: ticket.subtasks,
      requires_approval: ticket.requiresApproval,
      template_id: ticket.templateId || null,
      case_stage: ticket.caseStage || null,
      task_domain: ticket.taskDomain || null,
      lead_id: ticket.leadId || null,
      lead_phone: ticket.leadPhone || null,
      lead_debt: ticket.leadDebt ?? null,
    });
    if (error) throw serverError('저장', error);
  } else {
    const all = loadFromStorage(tenantId);
    all.unshift(ticket);
    saveToStorage(tenantId, all);
  }

  if (data.assigneeId !== data.assignerId) {
    await notifySafe(tenantId, data.assigneeId, {
      type: 'TASK_ASSIGNED',
      title: `새 업무: ${data.title}`,
      body: `${data.assignerName}님이 업무를 할당했습니다.${data.dueDate ? ` 기한: ${data.dueDate}` : ''}`,
      senderId: data.assignerId,
      senderName: data.assignerName,
      linkType: data.targetType,
      linkId: data.targetId,
    });
  }

  return ticket;
}

/** 여러 업무 일괄 생성 — 성공·실패 건수를 돌려준다 */
export async function createTaskBatch(
  tenantId: string,
  items: CreateTaskInput[]
): Promise<{ created: TaskTicket[]; failed: number }> {
  const created: TaskTicket[] = [];
  let failed = 0;
  for (const item of items) {
    try {
      created.push(await createTask(tenantId, item));
    } catch (e) {
      failed++;
      console.warn('[TaskTicket] 일괄 생성 중 실패:', e);
    }
  }
  return { created, failed };
}

// ── 조회 (서버 오류 시 예외) ──

async function queryTasks(tenantId: string, filters: Record<string, string>, statusFilter?: TaskStatus): Promise<TaskTicket[]> {
  if (isSupabaseConfigured) {
    let query = supabase.from('task_tickets').select('*').eq('tenant_id', tenantId);
    for (const [col, val] of Object.entries(filters)) query = query.eq(col, val);
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw serverError('불러오', error);
    return (data || []).map(mapDbRow);
  }
  const colToField: Record<string, keyof TaskTicket> = {
    target_type: 'targetType', target_id: 'targetId', assignee_id: 'assigneeId', assigner_id: 'assignerId',
  };
  let tasks = loadFromStorage(tenantId).filter(t =>
    Object.entries(filters).every(([col, val]) => t[colToField[col]] === val)
  );
  if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
  return tasks;
}

/** 사건/상담별 업무 */
export function getTasksByTarget(tenantId: string, targetType: MessageTargetType, targetId: string): Promise<TaskTicket[]> {
  return queryTasks(tenantId, { target_type: targetType, target_id: targetId });
}

/** 나에게 할당된 업무 */
export function getMyTasks(tenantId: string, userId: string, statusFilter?: TaskStatus): Promise<TaskTicket[]> {
  return queryTasks(tenantId, { assignee_id: userId }, statusFilter);
}

/** 내가 지시한 업무 */
export function getMyAssignedTasks(tenantId: string, assignerId: string, statusFilter?: TaskStatus): Promise<TaskTicket[]> {
  return queryTasks(tenantId, { assigner_id: assignerId }, statusFilter);
}

/** 사무실 전체 업무 (변호사/관리자용) */
export function getAllTenantTasks(tenantId: string, statusFilter?: TaskStatus): Promise<TaskTicket[]> {
  return queryTasks(tenantId, {}, statusFilter);
}

/** 업무 단건 조회 */
export async function getTask(tenantId: string, taskId: string): Promise<TaskTicket | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('task_tickets').select('*')
      .eq('tenant_id', tenantId).eq('id', taskId)
      .maybeSingle();
    if (error) throw serverError('불러오', error);
    return data ? mapDbRow(data) : null;
  }
  return loadFromStorage(tenantId).find(t => t.id === taskId) || null;
}

// ── 변경 ──

async function applyUpdate(tenantId: string, taskId: string, updates: Record<string, any>, action: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('task_tickets')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', taskId)
      .select('id');
    if (error) throw serverError(action, error);
    if (!data || data.length === 0) throw new Error(`업무를 ${action}하지 못했습니다. 권한이 없거나 이미 삭제된 업무입니다.`);
    return;
  }
  updateInStorage(tenantId, taskId, updates);
}

/** 업무 삭제 */
export async function deleteTask(tenantId: string, taskId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('task_tickets').delete()
      .eq('tenant_id', tenantId).eq('id', taskId);
    if (error) throw serverError('삭제', error);
    return true;
  }
  saveToStorage(tenantId, loadFromStorage(tenantId).filter(t => t.id !== taskId));
  return true;
}

/** 업무 상태 변경 (시작·완료·취소) — 검토 승인이 필요한 업무는 완료로 바꿀 수 없음 */
export async function updateTaskStatus(
  tenantId: string, taskId: string, newStatus: TaskStatus, completionNote?: string
): Promise<boolean> {
  const action: TaskAction | null =
    newStatus === 'IN_PROGRESS' ? 'start' :
    newStatus === 'COMPLETED' ? 'complete' :
    newStatus === 'CANCELLED' ? 'cancel' : null;
  if (!action) throw new Error('이 화면에서 바꿀 수 없는 상태입니다. 검토 요청·승인 버튼을 이용해 주세요.');
  const task = assertTaskTransition(await getTask(tenantId, taskId), action);

  const now = new Date().toISOString();
  const updates: Record<string, any> = { status: newStatus, updated_at: now };
  if (newStatus === 'COMPLETED') {
    updates.completed_at = now;
    updates.completion_note = completionNote || '';
  }
  await applyUpdate(tenantId, taskId, updates, '변경');

  if (newStatus === 'COMPLETED' && task.assignerId !== task.assigneeId) {
    await notifySafe(tenantId, task.assignerId, {
      type: 'TASK_COMPLETED',
      title: `업무 완료: ${task.title}`,
      body: `${task.assigneeName}님이 업무를 완료했습니다.${completionNote ? ` "${completionNote}"` : ''}`,
      senderId: task.assigneeId,
      senderName: task.assigneeName,
      linkType: task.targetType,
      linkId: task.targetId,
    });
  }
  return true;
}

/** 검토 요청 (담당자 → 지시자·승인권자) */
export async function requestTaskReview(tenantId: string, taskId: string, reviewNote?: string): Promise<boolean> {
  const task = assertTaskTransition(await getTask(tenantId, taskId), 'request_review');
  await applyUpdate(tenantId, taskId, {
    status: 'REVIEW_REQUESTED',
    review_note: reviewNote || '',
    updated_at: new Date().toISOString(),
  }, '검토 요청');

  await notifySafe(tenantId, task.assignerId, {
    type: 'TASK_ASSIGNED',
    title: `검토 요청: ${task.title}`,
    body: `${task.assigneeName}님이 작업 완료 후 승인을 요청했습니다.${reviewNote ? ` "${reviewNote}"` : ''}`,
    senderId: task.assigneeId,
    senderName: task.assigneeName,
    linkType: task.targetType,
    linkId: task.targetId,
  });
  return true;
}

/** 승인 (검토 요청 상태 + 담당자 본인이 아닌 사람만) */
export async function approveTask(
  tenantId: string, taskId: string, approvalNote: string | undefined, actor: { id: string; name: string }
): Promise<boolean> {
  const task = assertTaskTransition(await getTask(tenantId, taskId), 'approve', actor.id);
  const now = new Date().toISOString();
  await applyUpdate(tenantId, taskId, {
    status: 'COMPLETED',
    completed_at: now,
    approval_note: approvalNote?.trim() || `승인 (${actor.name})`,
    updated_at: now,
  }, '승인');

  await notifySafe(tenantId, task.assigneeId, {
    type: 'TASK_COMPLETED',
    title: `업무 승인 완료: ${task.title}`,
    body: `${actor.name}님이 업무를 승인했습니다.${approvalNote ? ` "${approvalNote}"` : ''}`,
    senderId: actor.id,
    senderName: actor.name,
    linkType: task.targetType,
    linkId: task.targetId,
  });
  return true;
}

/** 반려 → 진행 중으로 되돌림 (검토 요청 상태 + 담당자 본인이 아닌 사람만) */
export async function rejectTask(
  tenantId: string, taskId: string, rejectionNote: string, actor: { id: string; name: string }
): Promise<boolean> {
  if (!rejectionNote.trim()) throw new Error('반려 사유를 입력해 주세요.');
  const task = assertTaskTransition(await getTask(tenantId, taskId), 'reject', actor.id);
  await applyUpdate(tenantId, taskId, {
    status: 'IN_PROGRESS',
    approval_note: `[수정보완 요청] ${rejectionNote.trim()} (${actor.name})`,
    updated_at: new Date().toISOString(),
  }, '반려');

  await notifySafe(tenantId, task.assigneeId, {
    type: 'TASK_ASSIGNED',
    title: `업무 보완 요청: ${task.title}`,
    body: `${actor.name}님이 수정보완을 요청했습니다: "${rejectionNote.trim()}"`,
    senderId: actor.id,
    senderName: actor.name,
    linkType: task.targetType,
    linkId: task.targetId,
  });
  return true;
}

/** 서브태스크 완료 여부 토글 */
export async function toggleSubtask(tenantId: string, taskId: string, subtaskId: string): Promise<boolean> {
  const task = await getTask(tenantId, taskId);
  if (!task || !task.subtasks) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') throw new Error('종료된 업무의 세부 항목은 바꿀 수 없습니다.');
  const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
  await applyUpdate(tenantId, taskId, { subtasks: newSubtasks, updated_at: new Date().toISOString() }, '변경');
  return true;
}

function updateInStorage(tenantId: string, taskId: string, updates: any) {
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(t => t.id === taskId);
  if (idx === -1) throw new Error('업무를 찾을 수 없습니다.');
  all[idx] = {
    ...all[idx],
    status: updates.status || all[idx].status,
    completedAt: updates.completed_at !== undefined ? updates.completed_at : all[idx].completedAt,
    completionNote: updates.completion_note !== undefined ? updates.completion_note : all[idx].completionNote,
    reviewNote: updates.review_note !== undefined ? updates.review_note : all[idx].reviewNote,
    approvalNote: updates.approval_note !== undefined ? updates.approval_note : all[idx].approvalNote,
    subtasks: updates.subtasks !== undefined ? updates.subtasks : all[idx].subtasks,
    updatedAt: updates.updated_at || new Date().toISOString(),
  };
  saveToStorage(tenantId, all);
}

function mapDbRow(row: any): TaskTicket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    targetType: row.target_type,
    targetId: row.target_id,
    assignerId: row.assigner_id,
    assignerName: row.assigner_name,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completionNote: row.completion_note,
    subtasks: typeof row.subtasks === 'string' ? JSON.parse(row.subtasks || '[]') : (row.subtasks || []),
    requiresApproval: !!row.requires_approval,
    reviewNote: row.review_note,
    approvalNote: row.approval_note,
    templateId: row.template_id,
    caseStage: row.case_stage,
    taskDomain: row.task_domain || undefined,
    leadId: row.lead_id || undefined,
    leadPhone: row.lead_phone || undefined,
    leadDebt: row.lead_debt ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
