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
          <div className="space-y-3">
            <BrandLogo tagline={BRAND_TAGLINE} taglineClassName="block" onDark />
            <p className="text-sm text-slate-400 leading-relaxed flex items-start gap-1.5 max-w-xs">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
              <span>상담정보는 가명으로 처리되며, 변호사가 사건 내용을 파악하고 답변하기 위한 목적으로만 사용됩니다.</span>
            </p>
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
            <p className="text-base font-bold text-slate-200">몬스터랩</p>
            <p className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>상호: 몬스터랩</span>
              <span>대표: 진성호</span>
              <span>사업자등록번호: 521-39-01355</span>
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>사업장 주소지: 서울특별시 서초구 강남대로53길 8</span>
              <span>전화번호: 070-4187-2882</span>
              <span>고객문의: support@mykim.kr</span>
            </p>
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
