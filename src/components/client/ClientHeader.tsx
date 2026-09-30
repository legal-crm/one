import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Bell, Building2, Calculator, ChevronDown, ClipboardCheck, FileText, HeartHandshake, HelpCircle, Info,
  LogOut, Mail, Megaphone, Menu, MessageSquare, Newspaper, Search, Settings, Star, User, BookOpen,
} from 'lucide-react';
import type { ClientNotification } from '../../services/clientNotificationService';
import BrandLogo, { BRAND_TAGLINE } from './BrandLogo';
import { Button, Modal } from './ui';
import { cn } from '../../utils/cn';
import { CLIENT_TAB_LABELS, clientTabHref, handleSpaLinkClick, type ClientTab } from './clientTabs';

/* ─────────────────────────────────────────────
   고객 사이트 헤더
   - 데스크톱(lg+): 로고 · 주요 메뉴 4개 · 알림/계정 · 전체 메뉴
   - lg 미만: 로고 · 알림(로그인 시)/로그인 · 전체 메뉴(오른쪽 패널)
   - 활성 메뉴는 aria-current="page" + 브랜드 틴트 배경으로 통일
   ───────────────────────────────────────────── */

interface ClientHeaderProps {
  activeTab: ClientTab;
  isLoggedIn: boolean;
  userAlias: string;
  /** 관리자 설정: 법률 정보 메뉴 노출 */
  showLegalNews: boolean;
  notifications: ClientNotification[];
  unreadCount: number;
  /** 상담 관련(메시지·상태 변경) 읽지 않은 알림이 있으면 '내 관리방'에 점 표시 */
  hasUnreadConsultUpdate: boolean;
  onNavigate: (tab: ClientTab) => void;
  onStartCheck: () => void;
  onOpenSettings: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onNotificationClick: (n: ClientNotification) => void;
  onMarkAllNotificationsRead: () => void;
}

const NOTIF_ICON: Record<ClientNotification['type'], React.ElementType> = {
  status_change: ClipboardCheck,
  new_message: MessageSquare,
  document_request: FileText,
  fee_reminder: Bell,
  notice: Megaphone,
  system: Info,
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

/** 바깥 클릭·ESC로 닫히는 팝오버 공통 동작 */
function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  return { open, setOpen, rootRef, buttonRef };
}

const iconButton =
  'relative w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

function NotificationPopover({
  notifications,
  unreadCount,
  onOpen,
  onItemClick,
  onMarkAllRead,
  onViewAll,
}: {
  notifications: ClientNotification[];
  unreadCount: number;
  onOpen: () => void;
  onItemClick: (n: ClientNotification) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
}) {
  const { open, setOpen, rootRef, buttonRef } = usePopover();
  const panelId = useId();
  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        className={iconButton}
        aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}건` : '알림'}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-none flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="알림 목록"
          className="fixed left-2 right-2 top-[4.25rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden z-10 animate-fadeInScale"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">알림</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={onMarkAllRead} className="min-h-11 px-2 text-sm font-bold text-brand hover:underline">
                모두 읽음
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <Bell className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm text-slate-600">새 알림이 없습니다. 상담 진행이나 변호사 답변이 생기면 알려 드립니다.</p>
            </div>
          ) : (
            <ul className="max-h-[min(60dvh,24rem)] overflow-y-auto divide-y divide-slate-100">
              {notifications.slice(0, 10).map((n) => {
                const Icon = NOTIF_ICON[n.type] || Info;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onItemClick(n);
                        setOpen(false);
                      }}
                      className={cn('w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors', !n.isRead && 'bg-brand-light/60')}
                    >
                      <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('text-sm font-bold truncate', n.isRead ? 'text-slate-700' : 'text-slate-900')}>{n.title}</span>
                          {!n.isRead && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-brand shrink-0" aria-hidden="true" />
                              <span className="sr-only">읽지 않음</span>
                            </>
                          )}
                        </span>
                        {n.body && <span className="block text-sm text-slate-600 truncate mt-0.5">{n.body}</span>}
                        <span className="block text-xs text-slate-500 mt-1">{formatRelativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => {
                onViewAll();
                setOpen(false);
              }}
              className="w-full min-h-11 rounded-xl text-sm font-bold text-brand hover:bg-brand-light"
            >
              마이페이지에서 진행 상황 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ alias, onMyPage, onSettings, onLogout }: { alias: string; onMyPage: () => void; onSettings: () => void; onLogout: () => void }) {
  const { open, setOpen, rootRef, buttonRef } = usePopover();
  const panelId = useId();
  const item = 'w-full min-h-11 px-3 rounded-xl flex items-center gap-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left';
  return (
    <div className="relative hidden sm:block" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="min-h-11 max-w-[12rem] pl-2 pr-2.5 rounded-xl flex items-center gap-2 text-sm font-bold text-slate-800 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
          <User className="w-4 h-4" />
        </span>
        <span className="truncate">
          <span className="sr-only">계정 메뉴, </span>
          {alias || '회원'}님
        </span>
        <ChevronDown className={cn('w-4 h-4 text-slate-500 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-lg p-1.5 z-10 animate-fadeInScale">
          <button type="button" className={item} onClick={() => { setOpen(false); onMyPage(); }}>
            <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
            마이페이지
          </button>
          <button type="button" className={item} onClick={() => { setOpen(false); onSettings(); }}>
            <Settings className="w-4 h-4 text-slate-500" aria-hidden="true" />
            계정 설정
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" className={cn(item, 'text-red-700 hover:bg-red-50 hover:text-red-800')} onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut className="w-4 h-4" aria-hidden="true" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

interface MenuEntry {
  tab: ClientTab;
  icon: React.ElementType;
  onClick?: () => void;
}

export default function ClientHeader({
  activeTab,
  isLoggedIn,
  userAlias,
  showLegalNews,
  notifications,
  unreadCount,
  hasUnreadConsultUpdate,
  onNavigate,
  onStartCheck,
  onOpenSettings,
  onLogin,
  onLogout,
  onOpenNotifications,
  onNotificationClick,
  onMarkAllNotificationsRead,
}: ClientHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryNav: { tab: ClientTab; onClick: () => void; dot?: boolean }[] = [
    { tab: 'request', onClick: onStartCheck },
    { tab: 'lawyers', onClick: () => onNavigate('lawyers') },
    { tab: 'qna', onClick: () => onNavigate('qna') },
    { tab: 'chat', onClick: () => onNavigate('chat'), dot: isLoggedIn && hasUnreadConsultUpdate },
  ];

  const menuGroups: { title: string; items: MenuEntry[] }[] = [
    {
      title: '서비스',
      items: [
        { tab: 'lawyers', icon: Search },
        { tab: 'qna', icon: HelpCircle },
        { tab: 'chat', icon: MessageSquare },
        { tab: 'mypage', icon: User },
      ],
    },
    {
      title: '알아보기',
      items: [
        { tab: 'guide', icon: BookOpen },
        { tab: 'reviews', icon: Star },
        { tab: 'calculator', icon: Calculator },
        { tab: 'companion', icon: HeartHandshake },
        ...(showLegalNews ? [{ tab: 'news' as ClientTab, icon: Newspaper }] : []),
      ],
    },
    {
      title: '고객지원',
      items: [
        { tab: 'notices', icon: Megaphone },
        { tab: 'inquiry', icon: Mail },
        { tab: 'company', icon: Building2 },
      ],
    },
  ];

  const go = (tab: ClientTab) => {
    setMenuOpen(false);
    onNavigate(tab);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 md:px-6 h-16 md:h-[72px] flex items-center gap-3">
        <a
          href={clientTabHref('landing')}
          onClick={(e) => handleSpaLinkClick(e, () => onNavigate('landing'))}
          aria-label="my김변 홈으로 이동"
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <BrandLogo tagline={BRAND_TAGLINE} taglineClassName="hidden sm:block lg:hidden xl:block" />
        </a>

        <nav aria-label="주요 메뉴" className="hidden lg:flex items-center gap-1 ml-4 xl:ml-8">
          {primaryNav.map((item) => {
            const active = activeTab === item.tab;
            return (
              <a
                key={item.tab}
                href={clientTabHref(item.tab)}
                onClick={(e) => handleSpaLinkClick(e, item.onClick)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center min-h-11 px-3.5 rounded-xl text-[15px] font-bold whitespace-nowrap transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  active ? 'bg-brand-light text-brand' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {CLIENT_TAB_LABELS[item.tab]}
                {item.dot && (
                  <>
                    <span className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-red-600" aria-hidden="true" />
                    <span className="sr-only">(새 소식 있음)</span>
                  </>
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {isLoggedIn ? (
            <>
              <NotificationPopover
                notifications={notifications}
                unreadCount={unreadCount}
                onOpen={onOpenNotifications}
                onItemClick={onNotificationClick}
                onMarkAllRead={onMarkAllNotificationsRead}
                onViewAll={() => onNavigate('mypage')}
              />
              <AccountMenu alias={userAlias} onMyPage={() => onNavigate('mypage')} onSettings={onOpenSettings} onLogout={onLogout} />
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onLogin} className="min-h-11 sm:min-h-10">
              로그인
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={iconButton}
            aria-label="전체 메뉴 열기"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        variant="drawer"
        title="전체 메뉴"
        bodyClassName="px-4 sm:px-5 py-5"
        footer={
          isLoggedIn ? (
            <Button
              variant="ghost"
              fullWidth
              leftIcon={<LogOut className="w-4 h-4" aria-hidden="true" />}
              className="text-red-700 hover:bg-red-50"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              로그아웃
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {isLoggedIn ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                <User className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{userAlias || '회원'}님</p>
                <p className="text-sm text-slate-600">스텔스 가명으로 이용 중입니다</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setMenuOpen(false); onOpenSettings(); }}>
                설정
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">로그인하면 상담 요청 내역과 변호사 답변을 이어서 확인할 수 있습니다.</p>
              <Button variant="secondary" fullWidth onClick={() => { setMenuOpen(false); onLogin(); }}>
                로그인
              </Button>
            </div>
          )}

          <Button
            size="lg"
            fullWidth
            leftIcon={<ClipboardCheck className="w-5 h-5" aria-hidden="true" />}
            onClick={() => {
              setMenuOpen(false);
              onStartCheck();
            }}
          >
            {CLIENT_TAB_LABELS.request}
          </Button>

          {menuGroups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="px-3 mb-1.5 text-xs font-bold text-slate-500">{group.title}</h3>
              <ul className="space-y-0.5">
                {group.items.map(({ tab, icon: Icon }) => {
                  const active = activeTab === tab;
                  return (
                    <li key={tab}>
                      <a
                        href={clientTabHref(tab)}
                        onClick={(e) => handleSpaLinkClick(e, () => go(tab))}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'min-h-12 px-3 rounded-xl flex items-center gap-3 text-base font-bold transition-colors',
                          active ? 'bg-brand-light text-brand' : 'text-slate-800 hover:bg-slate-100',
                        )}
                      >
                        <Icon className={cn('w-5 h-5 shrink-0', active ? 'text-brand' : 'text-slate-500')} aria-hidden="true" />
                        {CLIENT_TAB_LABELS[tab]}
                      </a>
                    </li>
                  );
                })}
                {group.title === '고객지원' && (
                  <li>
                    <a href="/faq" className="min-h-12 px-3 rounded-xl flex items-center gap-3 text-base font-bold text-slate-800 hover:bg-slate-100">
                      <HelpCircle className="w-5 h-5 shrink-0 text-slate-500" aria-hidden="true" />
                      자주 묻는 질문
                    </a>
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </header>
  );
}
