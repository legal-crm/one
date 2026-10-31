import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '../ui';
import type { ClientNotification } from '../../../services/clientNotificationService';
import { isSupabaseConfigured } from '../../../supabaseClient';
import MyPageNotificationsPanel from './MyPageNotificationsPanel';
import PrivacyRequestCard from './PrivacyRequestCard';

/**
 * '내 정보' (MY-1): 알림 · 계정(가명·로그인·기록 삭제·문의 내역·동의 기록) · 개인정보 요청
 * 이전에는 마이페이지 '알림·설정' 탭 안에 있었다. 사건·상담은 '내 사건'에서 본다.
 */
interface MyInfoViewProps {
  userAlias?: string;
  notifications?: ClientNotification[];
  onNotificationClick?: (n: ClientNotification) => void;
  onMarkAllNotificationsRead?: () => void;
  /** 계정 설정 (ClientRole의 MySettingsView embedded) */
  settingsPanel: React.ReactNode;
}

export default function MyInfoView({ userAlias, notifications, onNotificationClick, onMarkAllNotificationsRead, settingsPanel }: MyInfoViewProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 text-left animate-fadeIn">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">내 정보</h1>
          <Badge tone="teal" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}>스텔스 가명 보호</Badge>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 break-keep">
          <strong className="text-slate-900">{userAlias || '회원'}</strong>님의 알림, 가명, 동의 기록, 개인정보 요청을 관리합니다. 사건과 상담은 '내 사건'에서 확인하세요.
        </p>
      </header>
      <MyPageNotificationsPanel
        notifications={notifications}
        onNotificationClick={onNotificationClick}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        settingsPanel={settingsPanel}
      />
      {isSupabaseConfigured && <PrivacyRequestCard />}
    </div>
  );
}
