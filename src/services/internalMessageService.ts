// ============================================================
// Internal Message Service (Case-specific threads)
// Supabase DB + localStorage fallback
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type {
  InternalMessage, MessageCategory, MessageVisibility, MessageTargetType
} from '../types/communication';
import { createNotification } from './notificationCenterService';

const STORAGE_KEY = 'internal-messages';

function loadFromStorage(tenantId: string): InternalMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(tenantId: string, messages: InternalMessage[]) {
  localStorage.setItem(`${STORAGE_KEY}-${tenantId}`, JSON.stringify(messages));
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

export async function createMessage(
  tenantId: string, targetType: MessageTargetType, targetId: string,
  authorId: string, authorName: string, authorRole: string, content: string,
  options: {
    category?: MessageCategory; visibility?: MessageVisibility;
    designatedUserIds?: string[]; mentions?: string[]; parentId?: string | null;
  } = {}
): Promise<InternalMessage> {
  const msg: InternalMessage = {
    id: generateId(), tenantId, targetType, targetId,
    parentId: options.parentId || null,
    authorId, authorName, authorRole, content,
    category: options.category || 'general',
    visibility: options.visibility || 'all_staff',
    designatedUserIds: options.designatedUserIds || [],
    mentions: options.mentions || [],
    isPinned: false, isEdited: false,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('internal_messages').insert({
        id: msg.id, tenant_id: msg.tenantId, target_type: msg.targetType,
        target_id: msg.targetId, parent_id: msg.parentId,
        author_id: msg.authorId, author_name: msg.authorName, author_role: msg.authorRole,
        content: msg.content, category: msg.category, visibility: msg.visibility,
        designated_user_ids: msg.designatedUserIds, mentions: msg.mentions, is_pinned: msg.isPinned,
      });
      if (error) throw error;
    } catch {
      const all = loadFromStorage(tenantId); all.unshift(msg); saveToStorage(tenantId, all);
    }
  } else {
    const all = loadFromStorage(tenantId); all.unshift(msg); saveToStorage(tenantId, all);
  }

  if (msg.mentions.length > 0) {
    for (const userId of msg.mentions) {
      await createNotification(tenantId, userId, {
        type: 'MENTION', title: `${authorName} mentioned you`,
        body: content.length > 50 ? content.substring(0, 50) + '...' : content,
        senderId: authorId, senderName: authorName, linkType: targetType, linkId: targetId,
      });
    }
  }

  if (msg.parentId) {
    const parentMsg = await getMessage(tenantId, msg.parentId);
    if (parentMsg && parentMsg.authorId !== authorId) {
      await createNotification(tenantId, parentMsg.authorId, {
        type: 'REPLY_RECEIVED', title: `${authorName} replied`,
        body: content.length > 50 ? content.substring(0, 50) + '...' : content,
        senderId: authorId, senderName: authorName, linkType: targetType, linkId: targetId,
      });
    }
  }

  return msg;
}

export async function getMessage(tenantId: string, messageId: string): Promise<InternalMessage | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('internal_messages').select('*')
        .eq('tenant_id', tenantId).eq('id', messageId).single();
      if (error || !data) return null;
      return mapDbRow(data);
    } catch { /* fallthrough */ }
  }
  return loadFromStorage(tenantId).find(m => m.id === messageId) || null;
}

export async function getMessages(
  tenantId: string, targetType: MessageTargetType, targetId: string,
  viewerRole: string, viewerId: string
): Promise<InternalMessage[]> {
  let messages: InternalMessage[];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('internal_messages').select('*')
        .eq('tenant_id', tenantId).eq('target_type', targetType).eq('target_id', targetId)
        .is('parent_id', null).order('created_at', { ascending: false });
      if (error) throw error;
      messages = (data || []).map(mapDbRow);
    } catch {
      messages = loadFromStorage(tenantId)
        .filter(m => m.targetType === targetType && m.targetId === targetId && !m.parentId);
    }
  } else {
    messages = loadFromStorage(tenantId)
      .filter(m => m.targetType === targetType && m.targetId === targetId && !m.parentId);
  }
  return messages.filter(m => canView(m, viewerRole, viewerId));
}

export async function getReplies(
  tenantId: string, parentId: string, viewerRole: string, viewerId: string
): Promise<InternalMessage[]> {
  let replies: InternalMessage[];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('internal_messages').select('*')
        .eq('tenant_id', tenantId).eq('parent_id', parentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      replies = (data || []).map(mapDbRow);
    } catch {
      replies = loadFromStorage(tenantId).filter(m => m.parentId === parentId);
    }
  } else {
    replies = loadFromStorage(tenantId).filter(m => m.parentId === parentId);
  }
  return replies.filter(m => canView(m, viewerRole, viewerId));
}

export async function updateMessage(
  tenantId: string, messageId: string, newContent: string
): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('internal_messages')
        .update({ content: newContent, is_edited: true, edited_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('id', messageId);
      if (error) throw error;
      return true;
    } catch { /* fallthrough */ }
  }
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(m => m.id === messageId);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], content: newContent, isEdited: true, editedAt: new Date().toISOString() };
  saveToStorage(tenantId, all);
  return true;
}

export async function deleteMessage(tenantId: string, messageId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('internal_messages').delete()
        .eq('tenant_id', tenantId).eq('id', messageId);
      if (error) throw error;
      return true;
    } catch { /* fallthrough */ }
  }
  const all = loadFromStorage(tenantId);
  saveToStorage(tenantId, all.filter(m => m.id !== messageId && m.parentId !== messageId));
  return true;
}

export async function togglePin(tenantId: string, messageId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('internal_messages')
        .select('is_pinned').eq('id', messageId).single();
      if (data) {
        await supabase.from('internal_messages')
          .update({ is_pinned: !data.is_pinned }).eq('id', messageId);
      }
      return true;
    } catch { /* fallthrough */ }
  }
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(m => m.id === messageId);
  if (idx === -1) return false;
  all[idx].isPinned = !all[idx].isPinned;
  saveToStorage(tenantId, all);
  return true;
}

function canView(msg: InternalMessage, viewerRole: string, viewerId: string): boolean {
  if (msg.visibility === 'all_staff') return true;
  if (msg.visibility === 'lawyers_only') return viewerRole === 'OWNER' || viewerRole === 'LAWYER';
  if (msg.visibility === 'designated') return msg.designatedUserIds.includes(viewerId) || msg.authorId === viewerId;
  return true;
}

function mapDbRow(row: any): InternalMessage {
  return {
    id: row.id, tenantId: row.tenant_id, targetType: row.target_type,
    targetId: row.target_id, parentId: row.parent_id,
    authorId: row.author_id, authorName: row.author_name, authorRole: row.author_role,
    content: row.content, category: row.category, visibility: row.visibility,
    designatedUserIds: row.designated_user_ids || [], mentions: row.mentions || [],
    isPinned: row.is_pinned, isEdited: row.is_edited, editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}

export function parseMentions(content: string, staffList: { id: string; name: string }[]): string[] {
  const ids: string[] = [];
  staffList.forEach(s => { if (content.includes('@' + s.name)) ids.push(s.id); });
  return ids;
}
