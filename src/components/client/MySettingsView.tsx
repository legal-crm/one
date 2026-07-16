import React, { useState, useEffect } from 'react';
import { Shield, Edit2, Check, X, LogOut, MessageSquare, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import type { ClientInquiry } from '../../types';

interface MySettingsViewProps {
  isLoggedIn: boolean;
  userAlias: string;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  inquiries: ClientInquiry[];
  onNavigateToTab: (tab: string) => void;
  onShowAuthModal: () => void;
  onLogout: () => void;
}

export default function MySettingsView({
  isLoggedIn,
  userAlias,
  setUserAlias,
  isEditingAlias,
  setIsEditingAlias,
  tempAlias,
  setTempAlias,
  inquiries,
  onNavigateToTab,
  onShowAuthModal,
  onLogout
}: MySettingsViewProps) {
  const [userEmail, setUserEmail] = useState<string>('');
  const [loginProvider, setLoginProvider] = useState<string>('');
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUserEmail(session.user.email || '');
          setLoginProvider(session.user.app_metadata?.provider || '이메일');
        }
      });
    }
  }, [isLoggedIn]);

  // Filter inquiries related to the current user's alias
  const myInquiries = inquiries.filter(
    (inq) => inq.clientName === userAlias && userAlias !== ''
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn text-left pb-24">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">마이페이지</h2>
        <p className="text-sm text-slate-550 dark:text-slate-400 font-medium">
          의뢰인님의 가명 계정 보안 설정 및 1:1 서비스 지원 현황입니다.
        </p>
      </div>

      {!isLoggedIn ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">안심 로그인이 필요합니다</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              마이페이지 및 문의 확인은 의뢰인의 개인 정보 보호를 위해 안전 로그인 후에만 조회가 가능합니다.
            </p>
          </div>
          <button
            onClick={onShowAuthModal}
            className="px-8 py-4 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>3초 로그인하고 확인하기</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Account settings & Inquiries */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Account Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-8 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span>👤</span> 스텔스 안심 프로필
                </h3>
                <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">
                  스텔스 보안 활성
                </span>
              </div>

              <div className="space-y-5 bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-850">
                {/* Nickname/Alias editing */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-bold block">스텔스 가명 (채팅 발신 명칭)</span>
                    {isEditingAlias ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (tempAlias.trim()) {
                            setUserAlias(tempAlias.trim());
                            supabase.auth.updateUser({
                              data: { alias: tempAlias.trim() }
                            });
                          }
                          setIsEditingAlias(false);
                        }}
                        className="flex items-center gap-1.5 pt-1"
                      >
                        <input
                          type="text"
                          value={tempAlias}
                          onChange={(e) => setTempAlias(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none w-44 text-slate-800 dark:text-white"
                          maxLength={12}
                          autoFocus
                        />
                        <button type="submit" className="p-2 bg-brand text-white rounded-lg hover:bg-brand-hover cursor-pointer" title="저장">
                          <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setIsEditingAlias(false)} className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-400 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer" title="취소">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-800 dark:text-slate-200">
                          {userAlias || '새출발'}
                        </span>
                        <button
                          onClick={() => {
                            setTempAlias(userAlias || '새출발');
                            setIsEditingAlias(true);
                          }}
                          className="text-slate-400 hover:text-brand p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                          title="가명 변경"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email details */}
                <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                  <span className="text-xs text-slate-500 font-bold block">연동 계정 이메일</span>
                  <span className="text-sm text-slate-750 dark:text-slate-300 font-medium">
                    {userEmail || '확인 불가'} <span className="text-xs text-brand/80 font-bold">({loginProvider === 'google' ? 'Google' : loginProvider === 'kakao' ? 'Kakao' : loginProvider} 연동)</span>
                  </span>
                </div>
              </div>

              {/* Logout action */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-955/20 dark:hover:bg-red-900/30 text-red-650 dark:text-red-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>안전 로그아웃 및 흔적 지우기</span>
                </button>
              </div>
            </div>

            {/* Inquiries list */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-8 shadow-lg space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span>✉️</span> 나의 1:1 문의 내역
                </h3>
                <button
                  onClick={() => onNavigateToTab('inquiry')}
                  className="text-sm text-brand hover:text-brand-hover font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>새 문의 접수</span> <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {myInquiries.length === 0 ? (
                <div className="py-12 text-center space-y-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                  <MessageSquare className="w-9 h-9 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm text-slate-500 dark:text-slate-500 font-semibold">
                    접수된 1:1 문의 내역이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {myInquiries.map((inq) => {
                    const isExpanded = expandedInquiryId === inq.id;
                    return (
                      <div
                        key={inq.id}
                        className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-955/20"
                      >
                        <div
                          onClick={() => setExpandedInquiryId(isExpanded ? null : inq.id)}
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors"
                        >
                          <div className="space-y-1 text-left">
                            <span className="text-xs text-slate-400 font-medium">
                              {new Date(inq.createdAt).toLocaleDateString()}
                            </span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {inq.title}
                            </h4>
                          </div>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                              inq.status === 'replied'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {inq.status === 'replied' ? '답변 완료' : '답변 대기'}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 space-y-4 text-sm border-t border-slate-100 dark:border-slate-850/80 animate-slideDown bg-white dark:bg-slate-900/40">
                            {/* Question body */}
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                              {inq.content}
                            </div>
                            
                            {/* Reply content */}
                            {inq.status === 'replied' && inq.replyContent && (
                              <div className="bg-brand/5 border border-brand/10 p-4 rounded-lg space-y-2">
                                <div className="flex items-center gap-1.5 text-brand font-bold text-xs">
                                  <span>🤖</span> <span>my김변 플랫폼 답변</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                  {inq.replyContent}
                                </p>
                                <span className="block text-xs text-slate-400 text-right">
                                  답변 시각: {new Date(inq.repliedAt || '').toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Stealth settings & Security status */}
          <div className="space-y-8">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-8 shadow-lg space-y-6">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span>🛡️</span> 보안 및 약관 상태
              </h3>

              <div className="space-y-5">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">개인정보 제3자 제공 동의</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">의뢰인 안심 상담 진행을 위한 동의 완료</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">마이데이터 조회 동의</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">채무 분석 조회 연동 동의 완료</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">가명 안심 번호 필터링</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">050 가상번호 매핑 필터 작동 중</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">암호화 흔적 보호</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">브라우저 내 로그아웃 시 완전 삭제 보증</span>
                  </div>
                </div>
              </div>

              <div className="bg-brand/5 border border-brand/10 p-5 rounded-xl space-y-2 text-left">
                <h4 className="text-sm font-bold text-brand flex items-center gap-1.5">
                  <span>🔒</span> my김변 스텔스 안전 보증
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  본 서비스는 채무 사실의 외부 원천 노출을 방지하기 위해 가명 닉네임만을 변호사에게 전달하며, 제3자 알림 차단을 완벽히 준수하고 있습니다.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}