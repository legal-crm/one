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

// ── 바깥 채널 (ST-7 내 알림 받기 · ST-8 팀 알림 방) ──────────────────────────
export const OFFICE_NOTIFICATION_KINDS: Array<{ kind: string; label: string }> = [
  { kind: 'consult_request_new', label: '새 상담 요청' },
  { kind: 'client_message', label: '의뢰인 메시지' },
  { kind: 'client_document', label: '의뢰인 서류 제출' },
  { kind: 'fee_client_report', label: '의뢰인 입금 알림' },
  { kind: 'consult_request_due_soon', label: '상담 요청 응답 기한 하루 전' },
  { kind: 'consult_request_expired', label: '상담 요청 응답 기한 지남' },
];

export interface MyNotificationPrefs { emailEnabled: boolean; kindsOff: string[]; quietStart: number; quietEnd: number }
export const DEFAULT_MY_PREFS: MyNotificationPrefs = { emailEnabled: true, kindsOff: [], quietStart: 21, quietEnd: 8 };

export async function loadMyNotificationPrefs(): Promise<MyNotificationPrefs | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('user_notification_prefs').select('*').maybeSingle();
  if (error) return null;
  if (!data) return DEFAULT_MY_PREFS;
  return { emailEnabled: data.email_enabled, kindsOff: data.kinds_off || [], quietStart: data.quiet_start, quietEnd: data.quiet_end };
}

export async function saveMyNotificationPrefs(p: MyNotificationPrefs): Promise<string | null> {
  if (!isSupabaseConfigured) return '서버가 설정되지 않았어요.';
  const { error } = await supabase.rpc('set_my_notification_prefs', {
    p: { email_enabled: p.emailEnabled, kinds_off: p.kindsOff, quiet_start: p.quietStart, quiet_end: p.quietEnd },
  });
  return error ? '알림 설정을 저장하지 못했어요.' : null;
}

export interface TeamChannelStatus { telegramEnabled: boolean; chatId: string; tokenLast4?: string; hasToken: boolean; kinds: string[]; lastOkAt?: string; lastError?: string }

export async function loadTeamChannelStatus(officeId: string): Promise<TeamChannelStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('office_team_channel_status', { p_office_id: officeId });
  if (error) return null;
  const r = (data as any[] | null)?.[0];
  if (!r) return { telegramEnabled: false, chatId: '', hasToken: false, kinds: OFFICE_NOTIFICATION_KINDS.map(k => k.kind) };
  return {
    telegramEnabled: r.telegram_enabled, chatId: r.telegram_chat_id || '', tokenLast4: r.token_last4 || undefined, hasToken: r.has_token,
    kinds: r.kinds || [], lastOkAt: r.last_ok_at || undefined, lastError: r.last_error || undefined,
  };
}

export async function saveTeamChannel(officeId: string, p: { telegramEnabled: boolean; chatId: string; token?: string; kinds: string[] }): Promise<string | null> {
  if (!isSupabaseConfigured) return '서버가 설정되지 않았어요.';
  const { error } = await supabase.rpc('set_office_team_channel', {
    p_office_id: officeId,
    p: { telegram_enabled: p.telegramEnabled, telegram_chat_id: p.chatId.trim() || null, telegram_token: p.token?.trim() || null, kinds: p.kinds },
  });
  if (!error) return null;
  if (/invalid telegram token/i.test(error.message)) return '봇 토큰 형식이 맞지 않아요. BotFather가 준 토큰(숫자:영문)을 그대로 붙여 넣어 주세요.';
  if (/telegram_chat_id|check/i.test(error.message)) return '채팅방 ID는 숫자(그룹은 -100으로 시작)로 입력해 주세요.';
  if (/permission/i.test(error.message)) return '사무소 설정을 바꿀 권한이 없어요.';
  return '팀 알림 방을 저장하지 못했어요.';
}

export async function requestTeamChannelTest(officeId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return '서버가 설정되지 않았어요.';
  const { error } = await supabase.rpc('request_team_channel_test', { p_office_id: officeId });
  if (!error) return null;
  if (/not configured/i.test(error.message)) return '먼저 봇 토큰과 채팅방 ID를 저장해 주세요.';
  if (/too often/i.test(error.message)) return '테스트는 1분에 한 번만 보낼 수 있어요.';
  return '테스트를 요청하지 못했어요.';
}

export interface DeliveryRow { id: string; channel: 'email' | 'telegram'; kind: string; status: string; error?: string; createdAt: string; sentAt?: string }

export async function loadRecentDeliveries(officeId?: string): Promise<DeliveryRow[]> {
  if (!isSupabaseConfigured) return [];
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  let q = supabase.from('notification_deliveries').select('id, channel, kind, status, error, created_at, sent_at').gte('created_at', since).order('created_at', { ascending: false }).limit(50);
  if (officeId) q = q.eq('office_id', officeId);
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map((r: any) => ({ id: r.id, channel: r.channel, kind: r.kind, status: r.status, error: r.error || undefined, createdAt: r.created_at, sentAt: r.sent_at || undefined }));
}
