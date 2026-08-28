// ============================================================
// 의뢰인용 알림 서비스
// localStorage 기반 + CRM 상태 연동 자동 생성
// ============================================================

export interface ClientNotification {
  id: string;
  type: 'status_change' | 'new_message' | 'document_request' | 'fee_reminder' | 'notice' | 'system';
  title: string;
  body: string;
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

export function seedInitialNotifications(): void {
  const existing = loadClientNotifications();
  if (existing.length > 0) return;

  const now = new Date();
  const seeds: Omit<ClientNotification, 'id' | 'createdAt' | 'isRead'>[] = [
    { type: 'system', title: '마이김변에 오신 것을 환영합니다', body: '안심 가명 보호가 적용된 마이페이지에서 사건 진행 상황을 확인하세요.', emoji: '👋', linkTab: 'mypage' },
    { type: 'status_change', title: '상담 신청이 접수되었습니다', body: '담당 변호사가 배정되면 알림을 보내드리겠습니다.', emoji: '📋', linkTab: 'mypage' },
    { type: 'new_message', title: '담당 변호사의 메시지가 도착했습니다', body: '이소민 변호사가 내 관리방에 새 메시지를 보냈습니다.', emoji: '💬', linkTab: 'chat' },
    { type: 'document_request', title: '추가 서류 제출 요청', body: '부채증명서 및 소득증빙 자료를 마이페이지에서 업로드해 주세요.', emoji: '📁', linkTab: 'mypage' },
    { type: 'notice', title: '서비스 업데이트 안내', body: '사건 진행 트래커 기능이 추가되었습니다. 마이페이지에서 확인하세요.', emoji: '📢', linkTab: 'mypage' },
  ];

  const notifications: ClientNotification[] = seeds.map((s, i) => ({
    ...s,
    id: `cn-seed-${i}`,
    createdAt: new Date(now.getTime() - i * 3600000).toISOString(),
    isRead: i >= 3,
  }));

  saveClientNotifications(notifications);
}
