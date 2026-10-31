import React from 'react';
import { FolderOpen, MessageSquare, ShieldCheck } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Badge } from '../ui';
import { clientTabHref, handleSpaLinkClick, type MyCaseHubSection } from '../clientTabs';

/**
 * '내 사건' 머리글 (MY-1)
 * 이전에는 '내 관리방'(상담·제안·계약)과 '마이페이지'(사건·회생동행·설정)가 따로 있어 같은 일을 두 곳에서 찾았다.
 * 이제 한 화면 '내 사건' 안에서 사건 진행 · 상담을 고르고(직접 등록한 회생동행 사건도 사건 진행 안, MY-8), 알림·계정·동의는 '내 정보'로 옮겼다.
 * 영역마다 주소가 따로 있다(?tab=mypage / ?tab=chat) — 알림 링크·뒤로 가기가 그대로 동작한다.
 */
interface MyCaseHubHeaderProps {
  section: MyCaseHubSection;
  onSelect: (section: MyCaseHubSection) => void;
  userAlias?: string;
  /** 상담 관련 읽지 않은 알림이 있으면 '상담'에 점 */
  consultDot?: boolean;
}

const SECTIONS: { id: MyCaseHubSection; label: string; icon: React.ElementType; href: string }[] = [
  { id: 'progress', label: '사건 진행', icon: FolderOpen, href: clientTabHref('mypage') },
  { id: 'consult', label: '상담', icon: MessageSquare, href: clientTabHref('chat') },
];

export default function MyCaseHubHeader({ section, onSelect, userAlias, consultDot = false }: MyCaseHubHeaderProps) {
  return (
    <header className="mx-auto mb-5 w-full max-w-5xl space-y-3 text-left">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">내 사건</h1>
        <Badge tone="teal" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}>스텔스 가명 보호</Badge>
      </div>
      <p className="text-sm leading-relaxed text-slate-600 break-keep">
        <strong className="text-slate-900">{userAlias || '회원'}</strong>님의 상담 요청, 사건 진행, 서류, 납부를 한곳에서 확인합니다. 수임 계약 전까지 변호사에게는 가명으로 표시됩니다.
      </p>
      <nav aria-label="내 사건 메뉴" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {SECTIONS.map(({ id, label, icon: Icon, href }) => {
          const active = id === section;
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => handleSpaLinkClick(e, () => onSelect(id))}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                active ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {id === 'consult' && consultDot && !active && (
                <>
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
                  <span className="sr-only">(새 소식 있음)</span>
                </>
              )}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
