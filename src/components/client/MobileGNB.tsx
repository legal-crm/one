import React from 'react';
import { Home, ClipboardCheck, MessageSquare, Search, User } from 'lucide-react';
import { cn } from '../../utils/cn';
import { CLIENT_TAB_LABELS, clientTabHref, handleSpaLinkClick, type ClientTab } from './clientTabs';

/**
 * 모바일 하단 GNB (md 미만)
 * - 높이 3.75rem + safe-area. 이 높이를 바꾸면 clientTabs.ts의 MOBILE_GNB_SPACER도 같이 바꾼다.
 * - z-index 45 (헤더 40 위, 모달 60 아래)
 */
interface MobileGNBProps {
  activeTab: ClientTab;
  onNavigate: (tab: ClientTab) => void;
  onStartCheck: () => void;
  /** 로그인 상태에서 상담 관련 읽지 않은 알림이 있으면 '내 관리방'에 점 표시 */
  showChatDot?: boolean;
  isHidden?: boolean;
}

export default function MobileGNB({ activeTab, onNavigate, onStartCheck, showChatDot = false, isHidden = false }: MobileGNBProps) {
  const items: { tab: ClientTab; label: string; icon: React.ElementType; onClick: () => void; dot?: boolean }[] = [
    { tab: 'landing', label: CLIENT_TAB_LABELS.landing, icon: Home, onClick: () => onNavigate('landing') },
    { tab: 'request', label: '상황 체크', icon: ClipboardCheck, onClick: onStartCheck },
    { tab: 'chat', label: CLIENT_TAB_LABELS.chat, icon: MessageSquare, onClick: () => onNavigate('chat'), dot: showChatDot },
    { tab: 'lawyers', label: CLIENT_TAB_LABELS.lawyers, icon: Search, onClick: () => onNavigate('lawyers') },
    { tab: 'mypage', label: CLIENT_TAB_LABELS.mypage, icon: User, onClick: () => onNavigate('mypage') },
  ];

  return (
    <nav
      aria-label="하단 메뉴"
      aria-hidden={isHidden || undefined}
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-45 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]',
        'h-[calc(3.75rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out',
        isHidden && 'translate-y-full pointer-events-none',
      )}
    >
      <ul className="h-full flex items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.tab;
          return (
            <li key={item.tab} className="flex-1 min-w-0">
              <a
                href={clientTabHref(item.tab)}
                onClick={(e) => handleSpaLinkClick(e, item.onClick)}
                tabIndex={isHidden ? -1 : undefined}
                aria-current={active ? 'page' : undefined}
                aria-label={item.tab === 'request' ? CLIENT_TAB_LABELS.request : undefined}
                className={cn(
                  'relative h-full flex flex-col items-center justify-center gap-1 transition-colors',
                  active ? 'text-brand' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <span className={cn('relative w-11 h-7 rounded-full flex items-center justify-center', active && 'bg-brand-light')}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {item.dot && (
                    <>
                      <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" aria-hidden="true" />
                      <span className="sr-only">(새 소식 있음)</span>
                    </>
                  )}
                </span>
                <span className="text-[0.75rem] leading-none font-bold tracking-tight whitespace-nowrap">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
