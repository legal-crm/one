// ============================================================
// ?∏Ïï± ?åÎ¶º ?ºÌÑ∞ ?úÎπÑ??// Supabase DB + localStorage ?¥Î∞±
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { InAppNotification, NotificationType, NotificationLinkType } from '../types/communication';

const STORAGE_KEY = 'in-app-notifications';

function loadFromStorage(tenantId: string, recipientId: string): InAppNotification[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantId}-${recipientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(tenantId: string, recipientId: string, notifications: InAppNotification[]) {
  localStorage.setItem(`${STORAGE_KEY}-${tenantId}-${recipientId}`, JSON.stringify(notifications));
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

/** ?åÎ¶º ?ùÏÑ± */
export async function createNotification(
  tenantId: string,
  recipientId: string,
  data: {
    type: NotificationType;
    title: string;
    body: string;
    senderId?: string;
    senderName?: string;
    linkType: NotificationLinkType;
    linkId: string;
  }
): Promise<InAppNotification> {
  const notif: InAppNotification = {
    id: generateId(),
    tenantId,
    recipientId,
    type: data.type,
    title: data.title,
    body: data.body,
    senderId: data.senderId,
    senderName: data.senderName,
    linkType: data.linkType,
    linkId: data.linkId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('in_app_notifications').insert({
        id: notif.id,
        tenant_id: notif.tenantId,
        recipient_id: notif.recipientId,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        sender_id: notif.senderId,
        sender_name: notif.senderName,
        link_type: notif.linkType,
        link_id: notif.linkId,
        is_read: false,
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase ?åÎ¶º ?Ä???§Ìå®, localStorage ?¥Î∞±:', err);
      const all = loadFromStorage(tenantId, recipientId);
      all.unshift(notif);
      saveToStorage(tenantId, recipientId, all);
    }
  } else {
    const all = loadFromStorage(tenantId, recipientId);
    all.unshift(notif);
    saveToStorage(tenantId, recipientId, all);
  }

  return notif;
}

/** ???åÎ¶º Î™©Î°ù Ï°∞Ìöå */
export async function getNotifications(
  tenantId: string,
  recipientId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<InAppNotification[]> {
  const limit = options.limit || 50;

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('in_app_notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options.unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapDbRow);
    } catch { /* fallthrough */ }
  }

  let all = loadFromStorage(tenantId, recipientId);
  if (options.unreadOnly) {
    all = all.filter(n => !n.isRead);
  }
  return all.slice(0, limit);
}

/** ?ΩÏ? ?äÏ? ?åÎ¶º ??*/
export async function getUnreadCount(tenantId: string, recipientId: string): Promise<number> {
  if (isSupabaseConfigured) {
    try {
      const { count, error } = await supabase
        .from('in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    } catch { /* fallthrough */ }
  }

  return loadFromStorage(tenantId, recipientId).filter(n => !n.isRead).length;
}

/** ?åÎ¶º ?ΩÏùå Ï≤òÎ¶¨ */
export async function markAsRead(tenantId: string, notificationId: string, recipientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: now })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId);
      return;
    } catch { /* fallthrough */ }
  }

  const all = loadFromStorage(tenantId, recipientId);
  const idx = all.findIndex(n => n.id === notificationId);
  if (idx !== -1) {
    all[idx] = { ...all[idx], isRead: true, readAt: now };
    saveToStorage(tenantId, recipientId, all);
  }
}

/** Î™®Îì† ?åÎ¶º ?ΩÏùå Ï≤òÎ¶¨ */
export async function markAllAsRead(tenantId: string, recipientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: now })
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId)
        .eq('is_read', false);
      return;
    } catch { /* fallthrough */ }
  }

  const all = loadFromStorage(tenantId, recipientId).map(n =>
    n.isRead ? n : { ...n, isRead: true, readAt: now }
  );
  saveToStorage(tenantId, recipientId, all);
}

function mapDbRow(row: any): InAppNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recipientId: row.recipient_id,
    type: row.type,
    title: row.title,
    body: row.body,
    senderId: row.sender_id,
    senderName: row.sender_name,
    linkType: row.link_type,
    linkId: row.link_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
