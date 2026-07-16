import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Send, Users, Phone, Shield, Clock, AlertTriangle, Award, FileText, X } from 'lucide-react';
import { ConsultRequest, ConsultMessage, ConsultProposal, FinancialProfile } from '../../types';
import { RehabCalculationResult } from '../../rehab-chatbot-package/services/calculationService';
import MyPageView from './MyPageView';

// [SECURITY] 법률상담 비밀유지 + 보안 안내 배너
function ChatPrivacyBanner() {
  return (
    <div className="bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl px-4 py-3 text-[13px] text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium flex gap-2.5 items-start shadow-sm text-left">
      <Shield className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
      <div>
        <strong>🔒 법률상담 비밀 보장</strong>
        <span className="block mt-0.5 text-indigo-600/80 dark:text-indigo-400/80">이 채팅은 법률상담을 위한 비밀 대화입니다. 상담 내용은 전담 변호사와 고객만 확인할 수 있으며, 플랫폼 운영자는 원문 내용을 열람하지 않습니다.</span>
      </div>
    </div>
  );
}

// Inline ChatDisclaimer component
function ChatDisclaimer() {
  return (
    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 text-[13px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium flex gap-2 items-start shadow-sm text-left">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <strong>주의사항:</strong> 대화 중 오가는 상담 내용은 강력하게 암호화되어 안전하게 보호됩니다. 공식 선임계약 체결 전의 법률 상담은 참고용으로만 효력을 지니며, 모든 선임비용 결제 및 계약은 본 플랫폼 외부에서 변호사와 직접 조율하여 안전하게 체결하여 주시기 바랍니다.
      </div>
    </div>
  );
}

interface ChatViewProps {
  requests: ConsultRequest[];
  messages: ConsultMessage[];
  activeChatReqId: string;
  chatInput: string;
  phoneConsultNum: string;
  useSafeNumber050: boolean;
  isLoggedIn: boolean;
  userAlias: string;
  debtBanks: number;
  debtCards: number;
  debtPersonals: number;
  onSetActiveChatReqId: (id: string) => void;
  onSetChatInput: (val: string) => void;
  onSetPhoneConsultNum: (val: string) => void;
  onSetUseSafeNumber050: (val: boolean) => void;
  onSetActiveTab: (tab: string) => void;
  onSetRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  onSendChat: () => void;
  onAddMessage: (requestId: string, message: string, senderType: 'client' | 'lawyer' | 'admin', senderId: string, senderName: string) => void;

  // New combined diagnostic props
  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: FinancialProfile) => void;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
}

export default function ChatView({
  requests, messages, activeChatReqId, chatInput,
  phoneConsultNum, useSafeNumber050, isLoggedIn, userAlias,
  debtBanks, debtCards, debtPersonals,
  onSetActiveChatReqId, onSetChatInput, onSetPhoneConsultNum, onSetUseSafeNumber050,
  onSetActiveTab, onSetRequests, onSendChat, onAddMessage,
  activeRequest,
  activeResult,
  onUpdateFinancialProfile,
  setUserAlias,
  isEditingAlias,
  setIsEditingAlias,
  tempAlias,
  setTempAlias
}: ChatViewProps) {
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const [showProfilePanel, setShowProfilePanel] = useState<boolean>(false);
  const [isBidExpanded, setIsBidExpanded] = useState<boolean>(false);
  const [showPhoneConsultModal, setShowPhoneConsultModal] = useState<boolean>(false);
  const [showAppointModal, setShowAppointModal] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [isAppointed, setIsAppointed] = useState<boolean>(false);
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [activeChatMessages.length]);

  // proposals 데이터를 currentRequest에서 동적으로 읽어옴
  const proposals: ConsultProposal[] = currentRequest?.proposals || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn font-sans text-left">
    {/* Rebirth Bid: 제안서 비교 대시보드 */}
      <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl shadow-premium relative overflow-hidden transition-all duration-300">
        {/* Accordion Trigger Header */}
        <button
          type="button"
          onClick={() => setIsBidExpanded(!isBidExpanded)}
          className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6 text-left border-none bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors cursor-pointer select-none"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] bg-brand text-white dark:bg-brand/20 dark:text-brand-light px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                Rebirth Bid
              </span>
              {proposals.length > 0 ? (
                <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  {proposals.length}건 제안서 도달
                </span>
              ) : (
                <span className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  제안서 대기 중
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
              <span>⚖️ 변호사 솔루션 및 비용 제안서 비교</span>
              <span className="text-slate-500 font-normal text-xs">
                ({isBidExpanded ? '클릭 시 접기 △' : '클릭 시 자세히 보기 ▽'})
              </span>
            </h3>
          </div>
          <div className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1">
            {isBidExpanded ? '제안서 요약 접기 △' : `제안서 ${proposals.length}건 비교하기 ▽`}
          </div>
        </button>

        {isBidExpanded && (
          <div className="p-6 md:p-8 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-fadeIn">
            <div className="absolute -right-24 -top-24 w-72 h-72 bg-brand/10 dark:bg-brand/5 rounded-full blur-3xl pointer-events-none"></div>
            
            {proposals.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 mx-auto bg-amber-50 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">변호사의 솔루션 및 비용 제안서를 기다리고 있습니다.</p>
                <p className="text-xs text-slate-500">선택하신 변호사가 고객님의 채무 현황을 검토한 뒤 제안서를 보내드립니다.</p>
              </div>
            ) : (
              <>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
                  의뢰인님의 소득과 채무 상황을 검토하여 변호사가 산정한 최적 조건입니다. 제안서의 "💬 1:1 상담 시작" 버튼을 클릭하면 해당 변호사와의 채팅이 활성화됩니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                  {proposals.map((bid, index) => {
                    const borderGradient = index === 0 
                      ? 'group-hover:border-brand/40 border-slate-200 dark:border-slate-800 shadow-premium hover:shadow-glow'
                      : index === 1 
                      ? 'group-hover:border-indigo-500/40 border-slate-200 dark:border-slate-800 shadow-premium hover:shadow-glow'
                      : 'group-hover:border-violet-500/40 border-slate-200 dark:border-slate-800 shadow-premium hover:shadow-glow';

                    return (
                      <div 
                        key={bid.id} 
                        className={`bg-white dark:bg-slate-950/65 border rounded-3xl p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-0.5 group relative overflow-hidden ${borderGradient}`}
                      >
                        <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                          index === 0 ? 'from-brand to-indigo-500' : index === 1 ? 'from-indigo-500 to-purple-500' : 'from-purple-500 to-pink-500'
                        }`} />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img 
                                  src={bid.lawyerAvatar} 
                                  alt={bid.lawyerName} 
                                  className="w-12 h-12 rounded-2xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm" 
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
                              </div>
                              <div className="text-left">
                                <span className="text-[12px] text-slate-500 dark:text-slate-500 font-bold block">
                                  {bid.firmName}
                                </span>
                                <strong className="text-sm font-bold text-slate-900 dark:text-white block">
                                  {bid.lawyerName}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500 dark:text-slate-500 font-medium">진행 가능성</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Award className="w-3.5 h-3.5" /> {bid.feasibility}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500 dark:text-slate-500 font-medium">예상 월 변제금</span>
                              <span className="text-slate-900 dark:text-slate-200 font-bold">
                                월 {bid.monthlyPayment}만 원 <span className="text-slate-500 font-normal">({bid.duration}개월)</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500 dark:text-slate-500 font-medium">총 감면율 (원금)</span>
                              <span className="bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand-light px-2 py-0.5 rounded-md font-bold text-[13px]">
                                약 {bid.reductionRate}% 탕감
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500 dark:text-slate-500 font-medium">총 감면 예상액</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                ★ {bid.totalReduction.toLocaleString()}만 원 감면
                              </span>
                            </div>
                            
                            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex justify-between items-center text-[13px] mb-1">
                                <span className="text-slate-500 dark:text-slate-500 font-medium">제시 수임료</span>
                                <span className="text-slate-900 dark:text-slate-200 font-bold">{bid.fee}만 원</span>
                              </div>
                              {bid.installment && (
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-slate-500 dark:text-slate-500 font-medium">분납 조건</span>
                                  <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full font-bold">
                                    {bid.installment}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            <strong className="text-slate-900 dark:text-slate-200 font-bold block mb-1">
                              💡 변호인 솔루션
                            </strong>
                            "{bid.remark}"
                          </div>
                        </div>

                        <button 
                          type="button" 
                          onClick={() => {
                            // 제안서 수락 → 채팅 활성화
                            if (currentRequest) {
                              onSetRequests(prev => prev.map(r => {
                                if (r.id === currentRequest.id) {
                                  return { ...r, status: 'counseling' as const, selectedLawyerId: bid.lawyerId };
                                }
                                return r;
                              }));
                              onAddMessage(
                                currentRequest.id,
                                `${bid.lawyerName}의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 시작할 수 있습니다.`,
                                'lawyer', 'system', '시스템 안내'
                              );
                            }
                            setTimeout(() => { 
                              document.getElementById('chat-workspace-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
                            }, 100);
                          }} 
                          className="w-full text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-bold rounded-2xl transition-all duration-300 shadow-sm hover:shadow-brand-sm flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-[0.98]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>💬 {bid.lawyerName}와 1:1 상담 시작</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="text-[12px] text-slate-500 dark:text-slate-500 leading-normal pt-4 border-t border-slate-100 dark:border-slate-800 font-medium">
              ※ Rebirthtalk은 공인된 변호사들이 제안하는 변제안 및 수임 조건을 투명하게 비교 매칭해주며, 사건 수임료 결제 및 정식 선임 등 모든 법률적 행위는 의뢰인과 변호인 간에 플랫폼을 거치지 않고 직접 성사됩니다.
            </div>
          </div>
        )}
      </div>

      {/* Chat Workspace Grid */}
      <div id="chat-workspace-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-premium border border-slate-200 dark:border-slate-800 min-h-[550px] h-[calc(100vh-14rem)] lg:h-[700px] transition-all">
        {/* LEFT RAIL (상담 목록) */}
        <div className={`border-r border-slate-100 dark:border-slate-800 flex flex-col h-full min-h-0 bg-slate-50/20 dark:bg-slate-900/40 transition-all ${showProfilePanel ? 'hidden' : 'flex lg:col-span-3'}`}>
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/60 backdrop-blur-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
              나의 채무관리방 목록
            </h3>
            <p className="text-slate-500 dark:text-slate-500 text-[13px] font-medium mt-0.5">
              접수 완료된 채무 체크 및 상담 목록입니다.
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 scrollbar-hide">
            {requests.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-slate-500 dark:text-slate-500 text-xs font-medium">
                  작성 완료된 상담 요청이 없습니다.
                </p>
                <button 
                  onClick={() => onSetActiveTab('request')} 
                  className="inline-flex text-xs text-brand hover:text-brand-hover font-bold cursor-pointer transition-colors"
                >
                  무료 채무 체크 바로가기 &rarr;
                </button>
              </div>
            ) : requests.map(r => {
              const isSelected = r.id === activeChatReqId;
              const styleLabel = r.requestType === 'direct' ? '1:1 전담' : r.requestType === 'direct_multi' ? '의뢰인 지정' : '3인 오픈';
              
              // 변호사 아바타 매칭 로직
              let avatarUrl = '';
              let lawyerName = '';
              if (r.selectedLawyerId) {
                const matchedProposal = (r.proposals || []).find(p => p.lawyerId === r.selectedLawyerId);
                if (matchedProposal) {
                  avatarUrl = matchedProposal.lawyerAvatar;
                  lawyerName = matchedProposal.lawyerName;
                }
              }

              return (
                <div 
                  key={r.id} 
                  onClick={() => onSetActiveChatReqId(r.id)} 
                  className={`p-4 cursor-pointer transition-all text-left space-y-2 relative border-l-4 flex gap-3 items-start ${
                    isSelected 
                      ? 'bg-brand/[0.04] dark:bg-brand/[0.06] border-brand' 
                      : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border-transparent'
                  }`}
                >
                  {/* 아바타 / 아이콘 영역 */}
                  <div className="shrink-0 mt-1">
                    {avatarUrl ? (
                      <div className="relative">
                        <img src={avatarUrl} alt={lawyerName} className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand dark:text-brand-light font-black text-xs">
                        <Users className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                        r.requestType === 'direct' 
                          ? 'bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-300' 
                          : 'bg-brand/5 border border-brand/20 text-brand dark:text-brand-light'
                      }`}>
                        {styleLabel}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {new Date(r.createdAt).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}
                      </span>
                    </div>
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-200 line-clamp-1">
                      {lawyerName ? `${lawyerName} (${r.title})` : r.title}
                    </h4>
                    <div className="flex items-center justify-between text-[12px] text-slate-500 dark:text-slate-450 font-semibold">
                      <span>부채: {(r.financialProfile.debtTotal).toLocaleString()}만</span>
                      <span className={`font-bold flex items-center gap-1 ${
                        r.status === 'requested' ? 'text-amber-600 dark:text-amber-500' : r.status === 'responding' ? 'text-brand animate-pulse' : 'text-emerald-600 dark:text-emerald-500'
                      }`}>
                        {r.status === 'requested' ? '제안 대기' : r.status === 'responding' ? '응답 도착' : '1:1 상담'}
                        {r.status === 'responding' && <span className="w-1.5 h-1.5 bg-brand rounded-full"></span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT BOARD (채팅창 영역) */}
        {currentRequest ? (
          <>
          <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 transition-all ${
            showProfilePanel 
              ? 'hidden' 
              : 'flex lg:col-span-9'
          }`}>
            {/* Active chat header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="text-left flex-1 min-w-0">
                <span className="text-[12px] font-bold text-brand dark:text-brand-light uppercase tracking-widest block">
                  ACTIVE PREVIEW
                </span>
                <h3 className="font-bold text-sm md:text-base text-slate-900 dark:text-slate-100 line-clamp-1 mt-0.5">
                  {currentRequest.title}
                </h3>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPhoneConsultModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-xs font-bold text-indigo-600 dark:text-indigo-300 transition-all shadow-sm cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>전화상담 신청</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfilePanel(!showProfilePanel)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    showProfilePanel
                      ? 'bg-brand border-brand text-white'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showProfilePanel ? '리포트 접기' : '리포트 수정'}</span>
                </button>
              </div>
            </div>

            {/* 🤝 전담 변호사 매칭 및 수임 상태 스테이터스 바 */}
            {currentRequest && (() => {
              // 3단계 매칭 라이프사이클 분기
              let step = 1;
              let title = '';
              let desc = '';
              let bannerBg = '';
              let borderClass = '';
              let badgeColor = '';
              let badgeText = '';

              if (isAppointed) {
                step = 3;
                title = '전담 변호사 매칭 완료';
                desc = `${currentRequest.title?.replace(' 변호사 전담 매칭', '') || '담당'} 변호사님이 의뢰인님의 전담 변호사로 지정되어 안전 보호 및 채무 관리가 제공 중입니다.`;
                bannerBg = 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20';
                borderClass = 'border-emerald-200/60 dark:border-emerald-800/40';
                badgeColor = 'bg-emerald-500 text-white';
                badgeText = '선임 완료';
              } else if (proposals.length > 0 || currentRequest.status === 'responding' || currentRequest.status === 'counseling') {
                step = 2;
                title = '전담 변호사 지정 대기 중';
                desc = '도산 전문 변호사와의 1:1 비밀 상담이 가능합니다. 충분히 상담 후 아래 [전담 선임하기] 버튼을 통해 나의 전담 변호사로 지정해 주세요.';
                bannerBg = 'bg-gradient-to-r from-amber-50 to-indigo-50/30 dark:from-amber-950/20 dark:to-indigo-950/10';
                borderClass = 'border-amber-200/60 dark:border-amber-800/30';
                badgeColor = 'bg-amber-500 text-white animate-pulse';
                badgeText = '선임 대기';
              } else {
                step = 1;
                title = '전담 변호사 매칭 대기 중';
                desc = '의뢰인님의 재정 진단 요약 리포트를 바탕으로 도산 전문 변호사단이 맞춤형 채무 솔루션을 준비 중입니다 (평균 10분 소요).';
                bannerBg = 'bg-gradient-to-r from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/10';
                borderClass = 'border-slate-200 dark:border-slate-800';
                badgeColor = 'bg-brand text-white';
                badgeText = '검토 중';
              }

              return (
                <div className={`mx-4 mt-4 p-4 md:p-5 border rounded-2xl ${bannerBg} ${borderClass} transition-all duration-300 shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${badgeColor} px-2 py-0.5 rounded-full font-bold`}>
                        {badgeText}
                      </span>
                      <h4 className="font-extrabold text-sm md:text-base text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {step === 3 ? '👑' : step === 2 ? '🤝' : '🔄'} {title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium max-w-2xl">
                      {desc}
                    </p>
                  </div>

                  {/* Stepper UI */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-white/60 dark:bg-slate-900/60 px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 self-start md:self-auto">
                    {/* Step 1 */}
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">진단제출</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700 text-[10px] font-semibold">&rarr;</span>

                    {/* Step 2 */}
                    <div className="flex items-center gap-1">
                      <div className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                        step >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {step > 2 ? '✓' : '2'}
                      </div>
                      <span className={`text-[10px] font-bold ${
                        step >= 2 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
                      }`}>1:1상담</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700 text-[10px] font-semibold">&rarr;</span>

                    {/* Step 3 */}
                    <div className="flex items-center gap-1">
                      <div className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                        step === 3 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {step === 3 ? '✓' : '3'}
                      </div>
                      <span className={`text-[10px] font-bold ${
                        step === 3 ? 'text-slate-750 dark:text-slate-200' : 'text-slate-400'
                      }`}>전담지정</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* [SECURITY] Privacy + Disclaimer */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <ChatPrivacyBanner />
              <ChatDisclaimer />
            </div>

            {/* Messages feed */}
            <div ref={chatFeedRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 scrollbar-hide bg-slate-50/[0.15] dark:bg-slate-950/[0.05]">
              {/* Chat bubbles */}
              {activeChatMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-bold flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  <span>상담방이 정상적으로 활성화되었습니다.<br />아래 입력란을 통해 변호사에게 무엇이든 물어보세요!</span>
                </div>
              ) : activeChatMessages.map(m => {
                const isSystem = m.message.startsWith('[System]');
                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center my-2">
                      <div className="bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full py-1.5 px-4 text-[12px] text-slate-600 dark:text-slate-400 font-semibold tracking-tight text-center max-w-md">
                        {m.message.replace('[System] ', '')}
                      </div>
                    </div>
                  );
                }

                const isMe = m.senderType === 'client';
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 font-bold px-1">
                      <span className="text-slate-900 dark:text-slate-300">{m.senderName}</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-3.5 rounded-2xl max-w-sm md:max-w-md text-xs leading-relaxed font-semibold shadow-sm ${
                      isMe 
                        ? 'bg-brand text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                    }`}>
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🤝 전담 변호사 선임 CTA */}
            {currentRequest && currentRequest.selectedLawyerId && !isAppointed && activeChatMessages.length >= 2 && (
              <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/30 border border-amber-200/60 dark:border-amber-700/30 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤝</span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white block">이 변호사님을 나의 전담 변호사로 선임할 수 있어요</span>
                    <span className="text-[11px] text-slate-500">무료 · 언제든 변경 가능</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAppointModal(true)}
                  className="shrink-0 px-4 py-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-600 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer transform active:scale-95"
                >
                  전담 선임하기
                </button>
              </div>
            )}

            {/* 선임 확인 모달 */}
            {showAppointModal && currentRequest && (() => {
              const lawyer = currentRequest.selectedLawyerId ? { name: currentRequest.title?.replace(' 변호사 전담 매칭', '') || '담당 변호사' } : null;
              return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAppointModal(false)}>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-fadeIn" onClick={e => e.stopPropagation()}>
                    <div className="text-4xl">🤝</div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {lawyer?.name} 변호사님을<br/>나의 전담 변호사로 선임할까요?
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      선임하시면 {lawyer?.name} 변호사님이 당신의 채무 상담, 서류 준비,<br/>법원 진행까지 끝까지 함께합니다.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 text-left">
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span>✅</span><span>무료이며, 언제든 변경할 수 있어요</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1">
                        <span>🔔</span><span>변호사님에게 알림이 전달돼요</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAppointModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">다음에 할게요</button>
                      <button onClick={() => {
                        setShowAppointModal(false);
                        setIsAppointed(true);
                        setShowCelebration(true);
                        setTimeout(() => setShowCelebration(false), 4000);
                      }} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer transform active:scale-95">네, 선임할게요!</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 🎉 축하 모달 */}
            {showCelebration && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5 animate-fadeIn relative overflow-hidden">
                  {/* 파티클 배경 */}
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="absolute animate-bounce" style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        fontSize: `${12 + Math.random() * 16}px`,
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${1 + Math.random() * 2}s`,
                        opacity: 0.6 + Math.random() * 0.4
                      }}>
                        {['🎉', '✨', '🤝', '⭐', '💛', '🎊'][Math.floor(Math.random() * 6)]}
                      </div>
                    ))}
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="text-5xl">🎉✨🤝</div>
                    <h3 className="text-xl font-black bg-gradient-to-r from-amber-500 to-emerald-500 bg-clip-text text-transparent">
                      전담 파트너가 되었습니다!
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      이제부터 채무 상담, 서류 준비,<br/>법원 진행까지 <strong>끝까지 함께</strong>합니다.
                    </p>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-3">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">🔔 변호사님에게도 알림이 전달되었어요</span>
                    </div>
                    <button onClick={() => setShowCelebration(false)} className="w-full py-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transform active:scale-95 transition-all">
                      💬 전담 변호사와 대화하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Input Bar */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5">
              <input 
                type="text" 
                placeholder="담당 변호사에게 채무 고민 메시지 보내기..." 
                value={chatInput} 
                onChange={(e) => onSetChatInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }} 
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:focus:ring-brand/20 rounded-xl px-4 py-3 text-xs focus:outline-none font-bold transition-all" 
              />
              <button 
                onClick={onSendChat} 
                className="bg-brand hover:bg-brand-hover text-white p-3 rounded-xl transition-all shadow-sm cursor-pointer transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PROFILE SIDE PANEL (오른쪽 나의 상세 진단서 수정 패널) - 그리드 직접 자식 */}
          {showProfilePanel && (
            <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 lg:col-span-12 overflow-hidden">
              {/* Header inside side panel */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand" />
                  나의 상세 리포트 수정
                </span>
                <button
                  type="button"
                  onClick={() => setShowProfilePanel(false)}
                  className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable MyPageView inside side panel */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {/* Mobile back to chat button */}
                <div className="lg:hidden mb-4">
                  <button 
                    type="button"
                    onClick={() => setShowProfilePanel(false)}
                    className="w-full flex items-center justify-center gap-1.5 text-brand font-extrabold text-xs border border-brand/20 bg-brand/5 py-2.5 rounded-xl transition-all"
                  >
                    &larr; 대화방으로 돌아가기
                  </button>
                </div>
                
                <MyPageView
                  userAlias={userAlias}
                  setUserAlias={setUserAlias}
                  isEditingAlias={isEditingAlias}
                  setIsEditingAlias={setIsEditingAlias}
                  tempAlias={tempAlias}
                  setTempAlias={setTempAlias}
                  activeRequest={activeRequest}
                  activeResult={activeResult}
                  onUpdateFinancialProfile={onUpdateFinancialProfile}
                  onStartDiagnosis={() => onSetActiveTab('request')}
                  requests={requests}
                  onNavigateToChat={() => setShowProfilePanel(false)}
                  isCompact={true}
                />
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="lg:col-span-9 flex flex-col items-center justify-center p-8 text-center space-y-4 h-full bg-white dark:bg-slate-900">
            <Users className="w-14 h-14 text-slate-300 dark:text-slate-700" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-200">
              선택된 채무상담방이 없습니다
            </h3>
            <p className="text-slate-500 dark:text-slate-500 text-xs max-w-sm font-medium leading-relaxed">
              왼쪽의 나의 채무관리방 목록에서 특정 방을 선택하시거나, 신규 무료 채무 체크를 신청하여 상담을 활성화하세요.
            </p>
            <button 
              onClick={() => onSetActiveTab('request')} 
              className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-sm hover:shadow-brand-sm transition-all cursor-pointer transform active:scale-[0.98]"
            >
              지금 30초 무료 체크 시작
            </button>
          </div>
        )}
      </div>

      {/* 📞 PHONE CONSULTATION POPUP DIALOG (MODAL) */}
      {showPhoneConsultModal && currentRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 md:p-8 shadow-premium w-full max-w-md space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowPhoneConsultModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-650 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 text-left">
              <span className="text-[12px] bg-brand/10 text-brand px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block">
                변호사 1:1 직통 통화
              </span>
              <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                <Phone className="w-4 h-4 text-brand animate-pulse" /> 5분 내 즉시 안심 전화상담 신청
              </h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                고객님의 채무 체크 정보를 바탕으로 선택하신 변호사가 확인 후 연락을 드립니다.
              </p>
            </div>

            <div className="space-y-4 text-left border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500 dark:text-slate-500 font-bold block">
                  연락받으실 전화번호
                </label>
                <input 
                  type="text" 
                  placeholder="예: 010-1234-5678" 
                  value={phoneConsultNum} 
                  onChange={(e) => onSetPhoneConsultNum(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand/50 focus:border-brand focus:outline-none font-bold" 
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[13px] text-slate-600 dark:text-slate-400 py-1 font-semibold">
                <input 
                  type="checkbox" 
                  checked={useSafeNumber050} 
                  onChange={(e) => onSetUseSafeNumber050(e.target.checked)} 
                  className="rounded border-slate-300 text-brand focus:ring-brand cursor-pointer w-4 h-4" 
                />
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-brand" /> 050 안심번호 무료 활성화 (휴대폰 번호 완전 보호)
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneConsultModal(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!phoneConsultNum.trim()) { alert('전화상담을 받으실 연락처를 입력해 주세요!'); return; }
                    let displayNum = phoneConsultNum.trim();
                    let safeNumberValue: string | undefined; let safeNumberAssignedAtValue: string | undefined; let safeNumberExpiresAtValue: string | undefined;
                    if (useSafeNumber050) {
                      const generated050 = `0507-1428-${Math.floor(1000 + Math.random() * 9000)}`;
                      displayNum = `${generated050} (안심번호 활성화)`;
                      safeNumberValue = generated050; safeNumberAssignedAtValue = new Date().toISOString();
                      safeNumberExpiresAtValue = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
                    }
                    onSetRequests(prev => prev.map(req => req.id === activeChatReqId ? { ...req, phone: phoneConsultNum.trim(), phoneConsultationRequested: true, safeNumber: safeNumberValue, safeNumberAssignedAt: safeNumberAssignedAtValue, safeNumberExpiresAt: safeNumberExpiresAtValue } : req));
                    const systemMsg = `[System] 📞 의뢰인님이 실시간 전화 상담을 신청하셨습니다.\n• 연락 요청처: ${displayNum}\n• 담당 변호사님께 연락 요청 정보가 안전하게 전달되었습니다.`;
                    onAddMessage(activeChatReqId, systemMsg, 'client', 'client-temp', isLoggedIn ? `${userAlias} (본인)` : '의뢰인 (본인)');
                    setTimeout(() => {
                      onAddMessage(activeChatReqId, `안녕하세요, ${isLoggedIn && userAlias ? userAlias : '의뢰인'}님. 신청해 주신 연락처(${displayNum})를 확인했습니다. 기재해주신 금융정보 검토를 완료하였으며, 5분 내로 전화를 드려 원금 감면 절차에 대해 바로 상세 안내해 드리겠습니다.`, 'lawyer', 'lawyer-2', '이소민 변호사');
                    }, 1500);
                    alert('전화상담 요청이 변호사에게 안전하게 발송되었습니다!');
                    setShowPhoneConsultModal(false);
                  }} 
                  className="flex-2 text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-brand-sm flex items-center justify-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <span>📞 전화요청 접수</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
