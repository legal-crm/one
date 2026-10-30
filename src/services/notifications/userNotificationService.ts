// ============================================================
// 서버 알림 (user_notifications, 20261031001100) — 받는 사람 = 로그인 계정
// 알림은 DB 트리거가 만든다(새 상담 요청·채팅·서류·입금 알림·제안서). 화면은 읽고 읽음 표시만 한다.
// Realtime 구독으로 새 알림이 오면 바로 다시 읽는다 (구독 실패 시 60초 확인으로 대신).
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

export interface UserNotification {
  id: string;
  audience: 'office' | 'client';
  officeId?: string;
  kind: string;
  title: string;
  body?: string;
  linkType?: string;
  linkId?: string;
  count: number;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
}

const map = (r: any): UserNotification => ({
  id: r.id, audience: r.audience, officeId: r.office_id || undefined, kind: r.kind, title: r.title, body: r.body || undefined,
  linkType: r.link_type || undefined, linkId: r.link_id || undefined, count: r.count || 1,
  createdAt: r.created_at, updatedAt: r.updated_at, readAt: r.read_at || undefined,
});

export async function listUserNotifications(audience: 'office' | 'client', limit = 30): Promise<{ ok: boolean; data: UserNotification[] }> {
  if (!isSupabaseConfigured) return { ok: true, data: [] };
  const { data, error } = await supabase.from('user_notifications').select('*')
    .eq('audience', audience).order('updated_at', { ascending: false }).limit(limit);
  if (error) return { ok: false, data: [] };
  return { ok: true, data: (data || []).map(map) };
}

export async function markUserNotificationRead(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  return !error;
}

export async function markAllUserNotificationsRead(audience: 'office' | 'client'): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('audience', audience).is('read_at', null);
  return !error;
}

/** 내 알림이 새로 생기거나 바뀌면 onChange (반환값 = 구독 해제) */
export function subscribeUserNotifications(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !userId) return () => {};
  const channel = supabase
    .channel(`user-notifications-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `recipient_user_id=eq.${userId}` }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/** 알림 종류 → 짧은 표시 이름 */
export const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  consult_request_new: '새 상담 요청',
  client_message: '의뢰인 메시지',
  client_document: '의뢰인 서류',
  fee_client_report: '입금 알림',
  lawyer_message: '변호사 메시지',
  proposal_new: '제안서',
  document_rejected: '서류 다시 요청',
};
