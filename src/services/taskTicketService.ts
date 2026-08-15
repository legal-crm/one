// ============================================================
// ?…ë¬´ ? ë‹¹ ?°ì¼“ ?œë¹„??// Supabase DB + localStorage ?´ë°±
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

/** ?…ë¬´ ?ì„± */
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
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase ?…ë¬´ ?€???¤íŒ¨, localStorage ?´ë°±:', err);
      const all = loadFromStorage(tenantId);
      all.unshift(ticket);
      saveToStorage(tenantId, all);
    }
  } else {
    const all = loadFromStorage(tenantId);
    all.unshift(ticket);
    saveToStorage(tenantId, all);
  }

  // ?˜í–‰?ì—ê²??Œë¦¼
  await createNotification(tenantId, data.assigneeId, {
    type: 'TASK_ASSIGNED',
    title: `???…ë¬´: ${data.title}`,
    body: `${data.assignerName}?˜ì´ ?…ë¬´ë¥?? ë‹¹?ˆìŠµ?ˆë‹¤.${data.dueDate ? ` ê¸°í•œ: ${data.dueDate}` : ''}`,
    senderId: data.assignerId,
    senderName: data.assignerName,
    linkType: data.targetType,
    linkId: data.targetId,
  });

  return ticket;
}

/** ?…ë¬´ ëª©ë¡ ì¡°íšŒ (?¬ê±´ë³? */
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

/** ???…ë¬´ ì¡°íšŒ */
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

/** ?…ë¬´ ?íƒœ ë³€ê²?*/
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

  // ?„ë£Œ ??ì§€?œì?ê²Œ ?Œë¦¼
  if (newStatus === 'COMPLETED') {
    const task = await getTask(tenantId, taskId);
    if (task) {
      await createNotification(tenantId, task.assignerId, {
        type: 'TASK_COMPLETED',
        title: `?…ë¬´ ?„ë£Œ: ${task.title}`,
        body: `${task.assigneeName}?˜ì´ ?…ë¬´ë¥??„ë£Œ?ˆìŠµ?ˆë‹¤.${completionNote ? ` "${completionNote}"` : ''}`,
        senderId: task.assigneeId,
        senderName: task.assigneeName,
        linkType: task.targetType,
        linkId: task.targetId,
      });
    }
  }

  return true;
}

/** ?…ë¬´ ì¡°íšŒ (?¨ê±´) */
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
      completedAt: updates.completed_at,
      completionNote: updates.completion_note,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
