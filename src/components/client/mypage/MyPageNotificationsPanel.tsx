import React, { useReducer } from 'react';
import { Bell, ClipboardCheck, FileText, Info, Megaphone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../utils/cn';
import { loadClientNotifications, markAllAsRead, markAsRead } from '../../../services/clientNotificationService';
import type { ClientNotification } from '../../../services/clientNotificationService';
import { Badge, Button, EmptyState } from '../ui';
import type { MyPageModel } from './useMyPageModel';

// 헤더 알림 목록(ClientHeader)과 같은 아이콘·이름
const TYPE_META: Record<ClientNotification['type'], { label: string; icon: React.ElementType }> = {
  status_change: { label: '진행', icon: ClipboardCheck },
  new_message: { label: '메시지', icon: MessageSquare },
  document_request: { label: '서류', icon: FileText },
  fee_reminder: { label: '수임료', icon: Bell },
  notice: { label: '공지', icon: Megaphone },
  system: { label: '알림', icon: Info },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

/**
 * 마이페이지 알림·설정 탭 (알림 수신함 + 계정 설정 영역, MyPageView에서 분리)
 * - 알림은 헤더 알림과 같은 상태(ClientRole)를 쓴다 → 누르면 읽음 처리 + 관련 화면으로 이동, 헤더 숫자도 함께 줄어든다
 * - 이전: div onClick(키보드로 누를 수 없음), 읽음 처리해도 화면이 다시 그려지지 않음, 이모지·10~11px 글자·깜빡이는 점
 */
export default function MyPageNotificationsPanel({ vm }: { vm: MyPageModel }) {
  const { settingsPanel, notifications: sharedNotifications, onNotificationClick, onMarkAllNotificationsRead } = vm;

  // ClientRole이 알림 상태를 넘기지 않은 경우(단독 사용)에만 이 기기 저장소를 직접 읽고, 바꾼 뒤 다시 그린다
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const notifications: ClientNotification[] = sharedNotifications ?? loadClientNotifications();
  const unread = notifications.filter((n) => !n.isRead).length;

  const openNotification = (n: ClientNotification) => {
    if (onNotificationClick) {
      onNotificationClick(n);
      return;
    }
    if (!n.isRead) markAsRead(n.id);
    rerender();
  };

  const readAll = () => {
    if (onMarkAllNotificationsRead) onMarkAllNotificationsRead();
    else {
      markAllAsRead();
      rerender();
    }
    toast.success('모든 알림을 읽음으로 표시했어요.');
  };

  return (
    <div role="tabpanel" id="mypage-panel-settings" aria-labelledby="mypage-tab-settings" className="space-y-6">
      <section aria-labelledby="mypage-notifications-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mypage-notifications-title" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand" aria-hidden="true">
              <Bell className="h-5 w-5" />
            </span>
            알림
            {unread > 0 && <Badge tone="danger">새 알림 {unread}개</Badge>}
          </h2>
          {unread > 0 && (
            <Button variant="ghost" onClick={readAll}>
              모두 읽음
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            compact
            icon={<Bell className="h-6 w-6" />}
            title="아직 알림이 없어요"
            description="사건 진행 변경, 변호사 메시지, 서류 요청이 생기면 여기에 표시돼요."
          />
        ) : (
          <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto" aria-label="알림 목록">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.system;
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={cn(
                      'flex w-full gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                      n.isRead ? 'border-slate-200 bg-white' : 'border-brand/20 bg-brand-light/60',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('truncate text-sm font-bold', n.isRead ? 'text-slate-700' : 'text-slate-900')}>{n.title}</span>
                        {!n.isRead && (
                          <>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                            <span className="sr-only">읽지 않음</span>
                          </>
                        )}
                      </span>
                      {n.body && <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 break-keep">{n.body}</span>}
                      <span className="mt-1 block text-xs text-slate-500">{formatRelativeTime(n.createdAt)}</span>
                    </span>
                    <Badge className="self-start">{meta.label}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {settingsPanel}
    </div>
  );
}
