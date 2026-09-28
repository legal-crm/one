// ============================================================
// ?�앱 ?�림 ?�터 ?�비??// Supabase DB + localStorage ?�백
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { InAppNotification, NotificationType, NotificationLinkType } from '../types/communication';
import { generateUUID } from '../utils/deviceDetector';

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

// in_app_notifications.id 는 UUID 컬럼 — 이전 'notif-…' 문자열은 서버 저장이 항상 실패해 보낸 사람 브라우저에만 남았음
function generateId(): string {
  return generateUUID();
}

/** ?�림 ?�성 */
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
    } catch (err: any) {
      // 보낸 사람 브라우저에 저장해도 받는 사람에게는 가지 않으므로 실패로 알린다
      console.warn('[Notification] 서버 저장 실패:', err?.message || err);
      throw new Error('알림을 보내지 못했습니다.');
    }
  } else {
    const all = loadFromStorage(tenantId, recipientId);
    all.unshift(notif);
    saveToStorage(tenantId, recipientId, all);
  }

  return notif;
}

/** ???�림 목록 조회 */
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

/** ?��? ?��? ?�림 ??*/
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

/** ?�림 ?�음 처리 */
export async function markAsRead(tenantId: string, notificationId: string, recipientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      // 본인 수신 알림만 읽음 처리 (recipient_id 조건 추가)
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: now })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId);
      if (!error) return;
      console.warn('[notification] 읽음 처리 실패:', error.message);
    } catch { /* fallthrough */ }
  }

  const all = loadFromStorage(tenantId, recipientId);
  const idx = all.findIndex(n => n.id === notificationId);
  if (idx !== -1) {
    all[idx] = { ...all[idx], isRead: true, readAt: now };
    saveToStorage(tenantId, recipientId, all);
  }
}

/** 모든 ?�림 ?�음 처리 */
export async function markAllAsRead(tenantId: string, recipientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: now })
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId)
        .eq('is_read', false);
      if (!error) return;
      console.warn('[notification] 전체 읽음 처리 실패:', error.message);
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
