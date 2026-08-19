import React from 'react';
import { PlatformConfig } from '../../types';

interface ClientFooterProps {
  platformConfig: PlatformConfig;
  onShowTerms: (type: 'tos' | 'privacy') => void;
  onNavigate?: (tab: string) => void;
}

export default function ClientFooter({ platformConfig, onShowTerms, onNavigate }: ClientFooterProps) {
  const navItems = [
    { label: '공지사항', tab: 'notices' },
    { label: '이용후기', tab: 'reviews' },
    { label: '변제 시뮬레이션', tab: 'calculator' },
    { label: '1:1 문의', tab: 'inquiry' },
  ];

  return (
    <footer className="w-full bg-[#111827] text-slate-400">
      {/* ZONE 1: 내비게이션 링크 */}
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {navItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate?.(item.tab)}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ZONE 2: 회사 정보 + 법적 면책 */}
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          {/* 브랜드 */}
          <div className="space-y-4 mb-6">
            <div className="space-y-1">
              <p className="text-white font-bold text-sm">채무 해결, 전문가와 함께</p>
              <p className="text-xs text-slate-500">내 사건에 맞는 변호사를 비교하세요.</p>
            </div>
            <p className="text-sm font-bold text-slate-300">(주) my김변컴퍼니</p>
          </div>

          {/* 회사 정보 */}
          <div className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
            <p>
              사업자등록번호 {platformConfig.companyBusinessNumber}
              <span className="mx-1.5 text-slate-700">|</span>
              대표이사 {platformConfig.companyRepresentative}
              <span className="mx-1.5 text-slate-700">|</span>
              고객문의 help@rebirthtalk.com
            </p>
            <p>
              주소: {platformConfig.companyAddress}
            </p>
            <p>통신판매업신고번호 제 2026-서울강남-0000호</p>
          </div>

          {/* 법적 면책 요약 */}
          <div className="mt-6 pt-5 border-t border-white/5 space-y-2 text-[11px] text-slate-600 leading-relaxed">
            <p>
              본 서비스는 이용자가 자신의 채무·소득·지출 정보를 정리하고, 공개된 전문가 정보를 검색·열람할 수 있도록 지원하는 정보기술 플랫폼입니다. 플랫폼은 통신판매중개자로서 통신판매의 당사자가 아니며, 변호사회원이 제공하는 법률 서비스의 내용과 질에 대해 법적 책임을 부담하지 않습니다.
            </p>
            <p>
              플랫폼은 변호사법 제34조에 의거 변호사 알선료·수수료 수취를 금지하는 구조를 채택하고 있으며, 광고비는 정액제로 상담 건수·수임 여부·사건 결과와 연동되지 않습니다.
            </p>
          </div>
        </div>
      </div>

      {/* ZONE 3: 하단 바 */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* 약관 링크 */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <a
              href="/tos.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors font-medium"
            >
              서비스 이용약관
            </a>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors font-bold"
            >
              개인정보 처리방침
            </a>
            <a
              href="/legal.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors font-medium"
            >
              법적 고지사항
            </a>
          </div>

          {/* 저작권 */}
          <p className="text-[11px] text-slate-600">
            © 2026 my김변(마이김변). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
