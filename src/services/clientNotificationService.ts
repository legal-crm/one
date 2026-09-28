// ============================================================
// 의뢰인용 알림 서비스
// localStorage 기반 + CRM 상태 연동 자동 생성
// ============================================================

export interface ClientNotification {
  id: string;
  type: 'status_change' | 'new_message' | 'document_request' | 'fee_reminder' | 'notice' | 'system';
  title: string;
  body?: string;
  createdAt: string;
  isRead: boolean;
  linkTab?: string;
  emoji?: string;
}

const STORAGE_KEY = 'client_notifications';

export function loadClientNotifications(): ClientNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function saveClientNotifications(notifications: ClientNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function addClientNotification(notif: Omit<ClientNotification, 'id' | 'createdAt' | 'isRead'>): ClientNotification {
  const notifications = loadClientNotifications();
  const newNotif: ClientNotification = {
    ...notif,
    body: notif.body || '',
    id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  notifications.unshift(newNotif);
  if (notifications.length > 50) notifications.splice(50);
  saveClientNotifications(notifications);
  return newNotif;
}

export function markAsRead(notifId: string): void {
  const notifications = loadClientNotifications();
  const idx = notifications.findIndex(n => n.id === notifId);
  if (idx >= 0) {
    notifications[idx].isRead = true;
    saveClientNotifications(notifications);
  }
}

export function markAllAsRead(): void {
  const notifications = loadClientNotifications();
  notifications.forEach(n => n.isRead = true);
  saveClientNotifications(notifications);
}

export function getUnreadCount(): number {
  return loadClientNotifications().filter(n => !n.isRead).length;
}

/**
 * 최초 방문 안내 알림 1건만 생성
 * - 기존: "상담 신청이 접수되었습니다", "담당 변호사의 메시지가 도착했습니다", "추가 서류 제출 요청" 등
 *   실제로 일어나지 않은 일을 미읽음 3건으로 표시 → 이전 버전이 저장한 가짜 시드(cn-seed-1~4)도 정리
 */
export function seedInitialNotifications(): void {
  const existing = loadClientNotifications();
  const cleaned = existing.filter(n => !/^cn-seed-[1-9]$/.test(n.id));
  if (cleaned.length !== existing.length) saveClientNotifications(cleaned);
  if (cleaned.length > 0) return;
  saveClientNotifications([{
    type: 'system',
    title: '마이김변에 오신 것을 환영합니다',
    body: '상담 진행, 변호사 답변, 서류 요청 등 실제 알림이 생기면 이곳에 표시됩니다.',
    emoji: '👋',
    linkTab: 'mypage',
    id: 'cn-seed-0',
    createdAt: new Date().toISOString(),
    isRead: true,
  } as ClientNotification]);
}

/** 로그아웃·데이터 삭제 시 이 기기의 알림 삭제 (공용 기기에서 다음 사용자에게 노출 방지) */
export function clearClientNotifications(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
