// 서버 알림 목록·읽지 않은 수 (사무소 종 / 의뢰인 종 공용)
import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  listUserNotifications, markAllUserNotificationsRead, markUserNotificationRead, subscribeUserNotifications,
  type UserNotification,
} from '../services/notifications/userNotificationService';

export function useServerNotifications(audience: 'office' | 'client', enabled: boolean) {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured) { setItems([]); return; }
    const r = await listUserNotifications(audience, 30);
    if (r.ok) setItems(r.data);
  }, [audience, enabled]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) { setUserId(null); return; }
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => { if (!cancelled) setUserId(data.user?.id || null); });
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const unsubscribe = subscribeUserNotifications(userId, () => { void refresh(); });
    // 구독이 끊겨도 놓치지 않게: 화면이 보일 때 60초마다·화면 복귀 때 다시 읽기
    const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { unsubscribe(); window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [userId, refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
    await markUserNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.readAt ? n : { ...n, readAt: now })));
    await markAllUserNotificationsRead(audience);
  }, [audience]);

  return { items, unreadCount: items.filter(n => !n.readAt).length, refresh, markRead, markAllRead };
}
