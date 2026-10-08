import React, { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { PlatformConfig } from '../../types';
import BrandLogo, { BRAND_TAGLINE } from './BrandLogo';
import { cn } from '../../utils/cn';
import { CLIENT_TAB_LABELS, MOBILE_GNB_SPACER, clientTabHref, handleSpaLinkClick, type ClientTab } from './clientTabs';

interface ClientFooterProps {
  platformConfig: PlatformConfig;
  onNavigate: (tab: ClientTab) => void;
  onStartCheck: () => void;
  /** 모바일 하단 GNB가 보이는 화면이면 그만큼 아래 여백을 둔다(약관 줄이 가려지지 않게) */
  reserveBottomNav?: boolean;
}

interface SocialChannel {
  name: string;
  href: string;
  label: string;
  hoverColor: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

const SOCIAL_CHANNELS: SocialChannel[] = [
  {
    name: '유튜브',
    href: 'https://www.youtube.com/channel/UCJr9fGI1Tr8eoQd3U0ASaHg',
    label: 'my김변 공식 유튜브 채널 (새 창에서 열림)',
    hoverColor: 'hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    name: '인스타그램',
    href: 'https://www.instagram.com/my_kim999/',
    label: 'my김변 공식 인스타그램 (새 창에서 열림)',
    hoverColor: 'hover:text-pink-400 hover:border-pink-500/40 hover:bg-pink-500/10',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
  },
  {
    name: '틱톡',
    href: 'https://www.tiktok.com/@mykim9992',
    label: 'my김변 공식 틱톡 채널 (새 창에서 열림)',
    hoverColor: 'hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.96-4.57V8.5a8.28 8.28 0 0 0 4.81 1.54V6.69z"/>
      </svg>
    ),
  },
  {
    name: '스레드',
    href: 'https://www.threads.net/@my_kim999',
    label: 'my김변 공식 스레드 (새 창에서 열림)',
    hoverColor: 'hover:text-slate-100 hover:border-slate-400/40 hover:bg-white/10',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.186 24C5.467 24 0 18.533 0 11.814 0 5.094 5.467 0 12.186 0c6.643 0 11.977 5.234 12.022 11.854 0 .092-.008.183-.008.275 0 6.643-5.234 11.871-12.014 11.871zm.008-2.182c5.441 0 9.774-4.25 9.825-9.673C21.966 6.804 17.584 2.182 12.194 2.182c-5.325 0-9.64 4.316-9.64 9.632 0 5.317 4.315 9.632 9.64 9.632v.372z"/>
      </svg>
    ),
  },
];

const linkClass = 'inline-flex items-center min-h-11 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap';

export default function ClientFooter({ platformConfig, onNavigate, onStartCheck, reserveBottomNav = true }: ClientFooterProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  // 앱 기능은 앱 안에서 이동하고, 안내 문서(서비스 소개·FAQ·가이드)는 정적 페이지로 연다
  const appLinks: { tab: ClientTab; onClick: () => void }[] = [
    { tab: 'request', onClick: onStartCheck },
    { tab: 'lawyers', onClick: () => onNavigate('lawyers') },
    { tab: 'qna', onClick: () => onNavigate('qna') },
    { tab: 'reviews', onClick: () => onNavigate('reviews') },
    { tab: 'calculator', onClick: () => onNavigate('calculator') },
    { tab: 'guide', onClick: () => onNavigate('guide') },
  ];
  const supportLinks: { tab: ClientTab; onClick: () => void }[] = [
    { tab: 'notices', onClick: () => onNavigate('notices') },
    { tab: 'inquiry', onClick: () => onNavigate('inquiry') },
    { tab: 'company', onClick: () => onNavigate('company') },
  ];
  const docLinks = [
    { label: '서비스 소개', href: '/about' },
    { label: '자주 묻는 질문', href: '/faq' },
    { label: '채무관리 가이드', href: '/guide/debt-management' },
  ];

  return (
    <footer className={cn('w-full bg-slate-900 text-slate-400', reserveBottomNav && MOBILE_GNB_SPACER)}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-[1.2fr_3fr]">
          <div className="space-y-4">
            <BrandLogo tagline={BRAND_TAGLINE} taglineClassName="block" onDark />
            <p className="text-sm text-slate-400 leading-relaxed flex items-start gap-1.5 max-w-xs">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
              <span>상담정보는 가명으로 처리되며, 변호사가 사건 내용을 파악하고 답변하기 위한 목적으로만 사용됩니다.</span>
            </p>

            {/* 공식 SNS 채널 바로가기 */}
            <div className="pt-1">
              <span className="block text-xs font-semibold text-slate-300 mb-2.5">공식 채널</span>
              <div className="flex items-center gap-2">
                {SOCIAL_CHANNELS.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <a
                      key={ch.name}
                      href={ch.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={ch.label}
                      title={ch.name}
                      className={cn(
                        'min-w-11 min-h-11 w-11 h-11 rounded-xl border border-white/10 bg-slate-800/80 text-slate-300 flex items-center justify-center transition-all press-scale shadow-xs',
                        ch.hoverColor
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 모바일: 2열(서비스 | 알아보기·고객지원), sm 이상: 3열 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
          <nav aria-label="서비스 바로가기" className="row-span-2 sm:row-span-1">
            <h2 className="text-sm font-bold text-white mb-1">서비스</h2>
            <ul>
              {appLinks.map((l) => (
                <li key={l.tab}>
                  <a href={clientTabHref(l.tab)} onClick={(e) => handleSpaLinkClick(e, l.onClick)} className={linkClass}>
                    {CLIENT_TAB_LABELS[l.tab]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="안내 문서">
            <h2 className="text-sm font-bold text-white mb-1">알아보기</h2>
            <ul>
              {docLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="고객지원">
            <h2 className="text-sm font-bold text-white mb-1">고객지원</h2>
            <ul>
              {supportLinks.map((l) => (
                <li key={l.tab}>
                  <a href={clientTabHref(l.tab)} onClick={(e) => handleSpaLinkClick(e, l.onClick)} className={linkClass}>
                    {CLIENT_TAB_LABELS[l.tab]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          </div>
        </div>

        {/* 회사 정보 + 법적 면책 (모바일은 펼쳐 보기, md 이상은 항상 표시) */}
        <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-white/10 space-y-5">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-controls="client-footer-business-info"
            className="md:hidden w-full min-h-11 flex items-center justify-between gap-2 text-sm font-bold text-slate-200"
          >
            사업자 정보 및 법적 고지
            <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', infoOpen && 'rotate-180')} aria-hidden="true" />
          </button>
          <div id="client-footer-business-info" className={cn('space-y-5 md:block', infoOpen ? 'block' : 'hidden')}>
          <div className="space-y-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
            <p className="text-base font-bold text-slate-200">my김변컴퍼니</p>
            <p className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>상호: my김변컴퍼니</span>
              <span>대표: 진성호</span>
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>사업장 주소지: 서울특별시 서초구 강남대로53길 8</span>
              <span>전화번호: 070-4187-2882</span>
              <span>고객문의: support@mykim.kr</span>
            </p>
            <p className="text-xs text-slate-400">Founded April 2026</p>
          </div>

          <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
            <p>
              본 서비스는 이용자가 자신의 채무·소득·지출 정보를 정리하고, 공개된 변호사 정보를 검색·열람할 수 있도록 지원하는 정보기술 플랫폼입니다. 플랫폼은 통신판매중개자로서 통신판매의 당사자가 아니며, 변호사회원이 제공하는 법률 서비스의 내용과 질에 대해 법적 책임을 부담하지 않습니다.
            </p>
            <p>
              플랫폼은 변호사법 제34조에 의거 변호사 알선료·수수료 수취를 금지하는 구조를 채택하고 있으며, 광고비는 정액제로 상담 건수·수임 여부·사건 결과와 연동되지 않습니다.
            </p>
          </div>
          </div>
          <div className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            <p>
              공적 상담기관: 신용회복위원회{' '}
              <a href="tel:1600-5500" className="font-semibold text-slate-300 hover:text-white underline-offset-2 hover:underline">
                1600-5500
              </a>
              <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
              대한법률구조공단{' '}
              <a href="tel:132" className="font-semibold text-slate-300 hover:text-white underline-offset-2 hover:underline">
                132
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* 하단 바 */}
      <div className="border-t border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center justify-center gap-x-5">
            <a href="/tos.html" target="_blank" rel="noopener noreferrer" className={linkClass}>
              서비스 이용약관
            </a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={cn(linkClass, 'font-bold text-white')}>
              개인정보 처리방침
            </a>
            <a href="/legal.html" target="_blank" rel="noopener noreferrer" className={linkClass}>
              법적 고지 및 책임한계
            </a>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            &copy; 2026 {platformConfig.companyName || 'my김변'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
