import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead
} from '../../services/notificationCenterService';
import type { InAppNotification } from '../../types/communication';
import { NOTIFICATION_TYPE_CONFIG } from '../../types/communication';
import { useServerNotifications } from '../../hooks/useServerNotifications';

interface NotificationBellProps {
  tenantId: string;
  userId: string;
  onNavigate?: (linkType: string, linkId: string) => void;
  /** 서버 알림(user_notifications: 새 상담 요청·의뢰인 채팅·서류·입금 알림)도 함께 보여 줄지 */
  serverEnabled?: boolean;
}

// 화면 한 줄 (옛 앱 안 알림 + 서버 알림)
type BellItem = { id: string; source: 'legacy' | 'server'; title: string; body?: string; count?: number; isRead: boolean; at: string; emoji: string; linkType?: string; linkId?: string };
const SERVER_EMOJI: Record<string, string> = {
  consult_request_new: '📥', client_message: '💬', client_document: '📄', fee_client_report: '💳',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  return `${days}일 전`;
}

export default function NotificationBell({ tenantId, userId, onNavigate, serverEnabled = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [legacyUnread, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const server = useServerNotifications('office', serverEnabled);
  const unreadCount = legacyUnread + server.unreadCount;
  const items: BellItem[] = [
    ...server.items.map(n => ({
      id: n.id, source: 'server' as const, title: n.title, body: n.body, count: n.count, isRead: !!n.readAt, at: n.updatedAt,
      emoji: SERVER_EMOJI[n.kind] || '🔔', linkType: n.linkType, linkId: n.linkId,
    })),
    ...notifications.map(n => ({
      id: n.id, source: 'legacy' as const, title: n.title, body: n.body, isRead: n.isRead, at: n.createdAt,
      emoji: NOTIFICATION_TYPE_CONFIG[n.type]?.emoji || '🔔', linkType: n.linkType, linkId: n.linkId,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const refresh = useCallback(async () => {
    const [notifs, count] = await Promise.all([
      getNotifications(tenantId, userId, { limit: 20 }),
      getUnreadCount(tenantId, userId),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
  }, [tenantId, userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // 새 알림 반영: 60초 주기 + 탭 복귀 시 갱신 (백그라운드 탭에서는 폴링 생략)
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleRead = async (item: BellItem) => {
    if (!item.isRead) {
      if (item.source === 'server') await server.markRead(item.id);
      else { await markAsRead(tenantId, item.id, userId); refresh(); }
    }
    if (onNavigate && item.linkType) {
      onNavigate(item.linkType, item.linkId || '');
    }
    setOpen(false);
  };

  const handleReadAll = async () => {
    await Promise.all([markAllAsRead(tenantId, userId), serverEnabled ? server.markAllRead() : Promise.resolve()]);
    refresh();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 벨 버튼 */}
      <button
        onClick={() => { setOpen(!open); if (!open) refresh(); }}
        className="relative p-2 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all"
        aria-label="알림"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-extrabold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-fadeIn">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h4 className="font-extrabold text-sm text-slate-800">알림</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs text-brand font-bold hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> 모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="overflow-y-auto max-h-[360px]">
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-bold">새 알림이 없습니다</p>
              </div>
            ) : (
              items.map(item => (
                <button
                  key={`${item.source}-${item.id}`}
                  onClick={() => handleRead(item)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                    item.isRead ? 'opacity-60' : ''
                  }`}
                >
                  {/* 읽지 않음 표시 */}
                  <div className="pt-1 shrink-0">
                    {!item.isRead ? <span className="block w-2 h-2 bg-brand rounded-full" /> : <span className="block w-2 h-2" />}
                  </div>
                  <span className="text-base shrink-0" aria-hidden="true">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {item.title}{item.count && item.count > 1 ? ` ${item.count}건` : ''}
                    </p>
                    {item.body && <p className="text-xs text-slate-600 truncate mt-0.5">{item.body}</p>}
                    <p className="text-xs text-slate-500 mt-1">{timeAgo(item.at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
