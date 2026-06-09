import React from 'react';
import { PlatformConfig } from '../../types';

interface ClientFooterProps {
  platformConfig: PlatformConfig;
  onShowTerms: (type: 'tos' | 'privacy') => void;
  onNavigate?: (tab: string) => void;
}

export default function ClientFooter({ platformConfig, onShowTerms, onNavigate }: ClientFooterProps) {
  return (
    <>
      {/* Babitalk-style Footer (Company Info) */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 p-6 md:p-8 text-slate-500 text-left space-y-6">
        <div className="flex items-center gap-2">
          <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="회생톡 로고" className="w-6 h-6 rounded-md object-cover opacity-70" />
          <span className="font-extrabold text-sm text-[#484760] dark:text-slate-400">{platformConfig.siteLogoText || "주식회사 회생톡"}</span>
        </div>
        <div className="flex flex-col md:flex-row w-full justify-between items-start gap-4 text-xs text-[#7e7e8f] dark:text-slate-500">
          <div className="flex-1 flex-col justify-start items-start gap-2 inline-flex">
            <div className="self-stretch justify-start items-center gap-1.5 flex flex-wrap font-semibold text-[#484760] dark:text-slate-400">
              <span>{platformConfig.siteLogoText || "주식회사 회생톡"}</span>
              <span className="text-slate-200">|</span>
              <span>대표이사 {platformConfig.companyRepresentative}</span>
              <span className="text-slate-200">|</span>
              <span>개인정보 관리책임자 {platformConfig.companyRepresentative}</span>
            </div>
            <p className="leading-relaxed">
              사업자등록번호 {platformConfig.companyBusinessNumber}<br/>
              통신판매업신고번호 제 2026-서울강남-0000호
            </p>
            <p className="leading-relaxed">
              {platformConfig.companyAddress}<br/>
              이메일 help@rebirthtalk.com
            </p>
          </div>
          <div className="flex-1 flex-col justify-start items-start md:items-end gap-2 inline-flex">
            <div className="self-stretch justify-start md:justify-end items-center gap-1.5 flex flex-wrap font-semibold text-[#484760] dark:text-slate-400 underline text-[11px] sm:text-xs">
              {onNavigate && (
                <>
                  <span 
                    onClick={() => onNavigate('notices')}
                    className="cursor-pointer hover:text-[#313142] dark:hover:text-white"
                  >
                    공지사항
                  </span>
                  <span className="text-slate-200">|</span>
                  <span 
                    onClick={() => onNavigate('calculator')}
                    className="cursor-pointer hover:text-[#313142] dark:hover:text-white"
                  >
                    탕감액 계산기
                  </span>
                  <span className="text-slate-200">|</span>
                  <span 
                    onClick={() => onNavigate('inquiry')}
                    className="cursor-pointer hover:text-[#313142] dark:hover:text-white"
                  >
                    1:1 문의
                  </span>
                  <span className="text-slate-200">|</span>
                </>
              )}
              <span 
                onClick={() => onShowTerms('tos')}
                className="cursor-pointer hover:text-[#313142] dark:hover:text-white"
              >
                서비스 이용약관
              </span>
              <span className="text-slate-200">|</span>
              <span 
                onClick={() => onShowTerms('privacy')}
                className="cursor-pointer hover:text-[#313142] dark:hover:text-white"
              >
                개인정보 처리방침
              </span>
              <span className="text-slate-200">|</span>
              <span className="cursor-pointer hover:text-[#313142] dark:hover:text-white">법적 고지사항</span>
            </div>
            <p className="leading-relaxed text-left md:text-right">
              {platformConfig.siteLogoText || "회생톡"}은 채무 해결 매칭 플랫폼으로서 통신판매의 당사자가 아니며,<br/>
              제휴 법률사무소가 제공하는 법률 서비스에 대해 어써한 법적 책임도 지지 않습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-200 dark:bg-slate-950/80 border-t border-slate-300 dark:border-slate-900 py-6 px-4 text-[10px] text-center text-slate-500 space-y-1">
        <p>© 2026 개인회생·파산 법률 상담 요청 기반 Legal CRM SaaS 플랫폼 회생톡. All rights reserved.</p>
        <p className="mt-1">본 플랫폼은 변호사법 제34조에 의거 변호사 알선료, 수수료 수취를 금지하는 공공 가이드라인 구조를 채택해 운영 중입니다.</p>
      </footer>
    </>
  );
}
