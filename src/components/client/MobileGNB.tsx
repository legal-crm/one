import React from 'react';
import { Home, ClipboardCheck, MessageSquare, Search, HelpCircle } from 'lucide-react';
import { getUnreadCount } from '../../services/clientNotificationService';

interface MobileGNBProps {
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  onRequestConsult: () => void;
  onStartDiagnosis: () => void;
  onNavigateToLawyers: () => void;
  onNavigateToQna: () => void;
  isHidden?: boolean;
}

export default function MobileGNB({ activeTab, onSetActiveTab, onRequestConsult, onStartDiagnosis, onNavigateToLawyers, onNavigateToQna, isHidden = false }: MobileGNBProps) {
  const unreadCount = getUnreadCount();

  const navItems = [
    {
      key: 'landing',
      label: '홈',
      icon: Home,
      onClick: () => onSetActiveTab('landing'),
      isActive: activeTab === 'landing',
    },
    {
      key: 'request',
      label: '내 상황 체크',
      icon: ClipboardCheck,
      onClick: onStartDiagnosis,
      isActive: activeTab === 'request',
    },
    {
      key: 'chat',
      label: '내 관리방',
      icon: MessageSquare,
      onClick: () => onSetActiveTab('chat'),
      isActive: activeTab === 'chat',
      badgeCount: unreadCount,
    },
    {
      key: 'lawyers',
      label: '변호사 찾기',
      icon: Search,
      onClick: onNavigateToLawyers,
      isActive: activeTab === 'lawyers',
    },
    {
      key: 'qna',
      label: '고민상담 Q&A',
      icon: HelpCircle,
      onClick: onNavigateToQna,
      isActive: activeTab === 'qna',
    },
  ];

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2.5 pb-safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-in-out ${isHidden ? 'translate-y-full' : ''}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={item.onClick}
            className={`flex flex-col items-center gap-0.5 flex-1 text-center transition-colors relative ${
              item.isActive ? 'text-brand font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            {item.isActive && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-9 h-9 bg-brand/10 rounded-full" />}
            <Icon className="w-5 h-5 relative z-10" />
            <span className="text-xs font-bold tracking-tight relative z-10 leading-tight mt-0.5">{item.label}</span>
            {(item as any).badgeCount > 0 && (
              <span className="absolute top-0 right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 z-20">
                {(item as any).badgeCount > 9 ? '9+' : (item as any).badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
