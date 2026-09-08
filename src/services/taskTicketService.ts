// ============================================================
// 업무 할당 티켓 서비스
// Supabase DB + localStorage 폴백
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { TaskTicket, TaskPriority, TaskStatus, MessageTargetType } from '../types/communication';
import { createNotification } from './notificationCenterService';

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

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

/** 업무 생성 */
export async function createTask(
  tenantId: string,
  data: {
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
    subtasks?: { id: string; title: string; completed: boolean }[];
    requiresApproval?: boolean;
    templateId?: string;
    caseStage?: string;
  }
): Promise<TaskTicket> {
  const ticket: TaskTicket = {
    id: generateId(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
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
        due_date: ticket.dueDate,
        requires_approval: ticket.requiresApproval,
        template_id: ticket.templateId,
        case_stage: ticket.caseStage,
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase 업무 저장 실패, localStorage 폴백:', err);
      const all = loadFromStorage(tenantId);
      all.unshift(ticket);
      saveToStorage(tenantId, all);
    }
  } else {
    const all = loadFromStorage(tenantId);
    all.unshift(ticket);
    saveToStorage(tenantId, all);
  }

  // 수행자에게 알림
  await createNotification(tenantId, data.assigneeId, {
    type: 'TASK_ASSIGNED',
    title: `새 업무: ${data.title}`,
    body: `${data.assignerName}님이 업무를 할당했습니다.${data.dueDate ? ` 기한: ${data.dueDate}` : ''}`,
    senderId: data.assignerId,
    senderName: data.assignerName,
    linkType: data.targetType,
    linkId: data.targetId,
  });

  return ticket;
}

/** 템플릿 패키지 등을 통한 여러 업무 일괄 생성 */
export async function createTaskBatch(
  tenantId: string,
  items: Parameters<typeof createTask>[1][]
): Promise<TaskTicket[]> {
  const createdList: TaskTicket[] = [];
  for (const item of items) {
    const t = await createTask(tenantId, item);
    createdList.push(t);
  }
  return createdList;
}

/** 업무 목록 조회 (사건/상담별) */
export async function getTasksByTarget(
  tenantId: string, targetType: MessageTargetType, targetId: string
): Promise<TaskTicket[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('task_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDbRow);
    } catch { /* fallthrough */ }
  }
  return loadFromStorage(tenantId)
    .filter(t => t.targetType === targetType && t.targetId === targetId);
}

/** 내 업무 조회 (나에게 할당된 업무) */
export async function getMyTasks(
  tenantId: string, userId: string, statusFilter?: TaskStatus
): Promise<TaskTicket[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('task_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assignee_id', userId)
        .order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapDbRow);
    } catch { /* fallthrough */ }
  }
  let tasks = loadFromStorage(tenantId).filter(t => t.assigneeId === userId);
  if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
  return tasks;
}

/** 내가 지시한 업무 조회 */
export async function getMyAssignedTasks(
  tenantId: string, assignerId: string, statusFilter?: TaskStatus
): Promise<TaskTicket[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('task_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assigner_id', assignerId)
        .order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapDbRow);
    } catch { /* fallthrough */ }
  }
  let tasks = loadFromStorage(tenantId).filter(t => t.assignerId === assignerId);
  if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
  return tasks;
}

/** 테넌트 전체 업무 조회 (변호사/관리자용) */
export async function getAllTenantTasks(
  tenantId: string, statusFilter?: TaskStatus
): Promise<TaskTicket[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('task_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapDbRow);
    } catch { /* fallthrough */ }
  }
  let tasks = loadFromStorage(tenantId);
  if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
  return tasks;
}

/** 업무 삭제 */
export async function deleteTask(tenantId: string, taskId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('task_tickets')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', taskId);
      if (error) throw error;
    } catch {
      const all = loadFromStorage(tenantId);
      saveToStorage(tenantId, all.filter(t => t.id !== taskId));
    }
  } else {
    const all = loadFromStorage(tenantId);
    saveToStorage(tenantId, all.filter(t => t.id !== taskId));
  }
  return true;
}

/** 업무 상태 변경 */
export async function updateTaskStatus(
  tenantId: string, taskId: string, newStatus: TaskStatus, completionNote?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: any = { status: newStatus, updated_at: now };
  if (newStatus === 'COMPLETED') {
    updates.completed_at = now;
    updates.completion_note = completionNote || '';
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('task_tickets')
        .update(updates)
        .eq('tenant_id', tenantId)
        .eq('id', taskId);
      if (error) throw error;
    } catch {
      updateInStorage(tenantId, taskId, updates);
    }
  } else {
    updateInStorage(tenantId, taskId, updates);
  }

  // 완료 시 지시자에게 알림
  if (newStatus === 'COMPLETED') {
    const task = await getTask(tenantId, taskId);
    if (task) {
      await createNotification(tenantId, task.assignerId, {
        type: 'TASK_COMPLETED',
        title: `업무 완료: ${task.title}`,
        body: `${task.assigneeName}님이 업무를 완료했습니다.${completionNote ? ` "${completionNote}"` : ''}`,
        senderId: task.assigneeId,
        senderName: task.assigneeName,
        linkType: task.targetType,
        linkId: task.targetId,
      });
    }
  }

  return true;
}

/** 업무 검토 요청 (수행자 -> 지시자 컨펌 요청) */
export async function requestTaskReview(
  tenantId: string, taskId: string, reviewNote?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: any = {
    status: 'REVIEW_REQUESTED',
    review_note: reviewNote || '',
    updated_at: now
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from('task_tickets').update(updates).eq('tenant_id', tenantId).eq('id', taskId);
    } catch {
      updateInStorage(tenantId, taskId, updates);
    }
  } else {
    updateInStorage(tenantId, taskId, updates);
  }

  const task = await getTask(tenantId, taskId);
  if (task) {
    await createNotification(tenantId, task.assignerId, {
      type: 'TASK_ASSIGNED',
      title: `검토 요청: ${task.title}`,
      body: `${task.assigneeName}님이 작업 완료 후 승인을 요청했습니다.${reviewNote ? ` "${reviewNote}"` : ''}`,
      senderId: task.assigneeId,
      senderName: task.assigneeName,
      linkType: task.targetType,
      linkId: task.targetId,
    });
  }
  return true;
}

/** 업무 승인 완료 (지시자 -> 최종 완료 처리) */
export async function approveTask(
  tenantId: string, taskId: string, approvalNote?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: any = {
    status: 'COMPLETED',
    completed_at: now,
    approval_note: approvalNote || '승인 완료',
    updated_at: now
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from('task_tickets').update(updates).eq('tenant_id', tenantId).eq('id', taskId);
    } catch {
      updateInStorage(tenantId, taskId, updates);
    }
  } else {
    updateInStorage(tenantId, taskId, updates);
  }

  const task = await getTask(tenantId, taskId);
  if (task) {
    await createNotification(tenantId, task.assigneeId, {
      type: 'TASK_COMPLETED',
      title: `업무 승인 완료: ${task.title}`,
      body: `${task.assignerName}님이 업무를 최종 승인했습니다.${approvalNote ? ` "${approvalNote}"` : ''}`,
      senderId: task.assignerId,
      senderName: task.assignerName,
      linkType: task.targetType,
      linkId: task.targetId,
    });
  }
  return true;
}

/** 업무 반려 / 재검토 요청 (지시자 -> 보완 지시) */
export async function rejectTask(
  tenantId: string, taskId: string, rejectionNote: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: any = {
    status: 'IN_PROGRESS',
    approval_note: `[수정보완 요청] ${rejectionNote}`,
    updated_at: now
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from('task_tickets').update(updates).eq('tenant_id', tenantId).eq('id', taskId);
    } catch {
      updateInStorage(tenantId, taskId, updates);
    }
  } else {
    updateInStorage(tenantId, taskId, updates);
  }

  const task = await getTask(tenantId, taskId);
  if (task) {
    await createNotification(tenantId, task.assigneeId, {
      type: 'TASK_ASSIGNED',
      title: `업무 보완 요청: ${task.title}`,
      body: `${task.assignerName}님이 수정보완을 요청했습니다: "${rejectionNote}"`,
      senderId: task.assignerId,
      senderName: task.assignerName,
      linkType: task.targetType,
      linkId: task.targetId,
    });
  }
  return true;
}

/** 서브태스크 완료 여부 토글 */
export async function toggleSubtask(
  tenantId: string, taskId: string, subtaskId: string
): Promise<boolean> {
  const task = await getTask(tenantId, taskId);
  if (!task || !task.subtasks) return false;

  const newSubtasks = task.subtasks.map(st =>
    st.id === subtaskId ? { ...st, completed: !st.completed } : st
  );

  const updates = { subtasks: newSubtasks, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured) {
    try {
      await supabase.from('task_tickets').update(updates).eq('tenant_id', tenantId).eq('id', taskId);
    } catch {
      updateInStorage(tenantId, taskId, updates);
    }
  } else {
    updateInStorage(tenantId, taskId, updates);
  }
  return true;
}

/** 업무 단건 조회 */
export async function getTask(tenantId: string, taskId: string): Promise<TaskTicket | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('task_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', taskId)
        .single();
      if (error || !data) return null;
      return mapDbRow(data);
    } catch { /* fallthrough */ }
  }
  return loadFromStorage(tenantId).find(t => t.id === taskId) || null;
}

function updateInStorage(tenantId: string, taskId: string, updates: any) {
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(t => t.id === taskId);
  if (idx !== -1) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
