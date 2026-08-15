import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead
} from '../../services/notificationCenterService';
import type { InAppNotification } from '../../types/communication';
import { NOTIFICATION_TYPE_CONFIG } from '../../types/communication';

interface NotificationBellProps {
  tenantId: string;
  userId: string;
  onNavigate?: (linkType: string, linkId: string) => void;
}

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

export default function NotificationBell({ tenantId, userId, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [notifs, count] = await Promise.all([
      getNotifications(tenantId, userId, { limit: 20 }),
      getUnreadCount(tenantId, userId),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
  }, [tenantId, userId]);

  useEffect(() => { refresh(); }, [refresh]);

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

  const handleRead = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      await markAsRead(tenantId, notif.id, userId);
      refresh();
    }
    if (onNavigate) {
      onNavigate(notif.linkType, notif.linkId);
    }
    setOpen(false);
  };

  const handleReadAll = async () => {
    await markAllAsRead(tenantId, userId);
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
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center px-1 animate-pulse">
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
                className="text-[11px] text-brand font-bold hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> 모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="overflow-y-auto max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">새 알림이 없습니다</p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = NOTIFICATION_TYPE_CONFIG[notif.type];
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleRead(notif)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                      notif.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    {/* 읽지 않음 표시 */}
                    <div className="pt-1 shrink-0">
                      {!notif.isRead ? (
                        <span className="block w-2 h-2 bg-brand rounded-full" />
                      ) : (
                        <span className="block w-2 h-2" />
                      )}
                    </div>
                    {/* 아이콘 */}
                    <span className="text-base shrink-0">{cfg?.emoji || '🔔'}</span>
                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{notif.title}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{notif.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
