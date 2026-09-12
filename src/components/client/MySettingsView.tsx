import React, { useState, useEffect } from 'react';
import { Shield, Edit2, Check, X, LogOut, MessageSquare, ExternalLink, CheckCircle2, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import { supabase } from '../../supabaseClient';
import { purgeAllClientData } from '../../services/consultService';
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
  const dialog = useDialog();
  const [userEmail, setUserEmail] = useState<string>('');
  const [loginProvider, setLoginProvider] = useState<string>('');
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  // [SECURITY Complete Client Purge] 의뢰인 데이터 전체 자폭(영구 파기)
  const handlePurgeAllData = async () => {
    const confirmed = await dialog.confirm({
      title: '나의 모든 상담·진단 데이터 영구 파기 (자폭)',
      message: '의뢰인님의 모든 상담 내역, 1:1 대화 내용, 채무 진단 상세 기록이 서버와 기기에서 즉시 영구 파기됩니다.\n\n파기된 데이터는 절대 복구할 수 없습니다. 정말 진행하시겠습니까?',
      confirmText: '모든 데이터 영구 파기',
      variant: 'danger'
    });

    if (confirmed) {
      const currentClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
      await purgeAllClientData(currentClientId);
      toast.success('모든 상담 및 진단 기록이 서버에서 영구 파기되었습니다.');
      onLogout();
    }
  };

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
  const safeInquiries = Array.isArray(inquiries) ? inquiries : [];
  const myInquiries = safeInquiries.filter(
    (inq) => inq && inq.clientName === userAlias && userAlias !== ''
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
                          {userAlias || '회원'}
                        </span>
                        <button
                          onClick={() => {
                            setTempAlias(userAlias || '회원');
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

              {/* Purge & Logout actions */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handlePurgeAllData}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-650 dark:text-rose-400 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-900/30"
                  title="서버 및 로컬에 저장된 본인의 모든 상담 기록과 진단표를 영구 소멸합니다"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>기록 완전 자폭(영구 파기)</span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>안전 로그아웃</span>
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
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">1:1 대화 AES-256 암호화</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">상담 메시지 및 금융 프로필 DB 저장 시 필드 암호화</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">원클릭 데이터 자폭권 보장</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">원할 때 언제든 모든 대화와 진단 데이터 즉시 영구 소멸</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">외부 타깃 광고 트래커 차단</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">채무 사실 SNS 광고 유출 방지 (Zero-Tracker Shield)</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">스텔스 가명 및 안심번호</span>
                    <span className="text-xs text-slate-555 dark:text-slate-450 block">정식 수임 동의 전까지 실명·실제 연락처 완전 비공개</span>
                  </div>
                </div>
              </div>

              <div className="bg-brand/5 border border-brand/10 p-5 rounded-xl space-y-2 text-left">
                <h4 className="text-sm font-bold text-brand flex items-center gap-1.5">
                  <span>🔒</span> my김변 스텔스 보안 보증
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  본 서비스는 왓츠앱 수준의 저장 암호화(AES-256)와 텔레그램 수준의 데이터 자폭권을 지원하여, 채무 사실이 가족, 직장, 외부 광고망에 노출되지 않도록 철저히 보호합니다.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}