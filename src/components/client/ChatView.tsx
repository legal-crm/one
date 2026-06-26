import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Send, Users, Phone, Shield, Clock, AlertTriangle, Award, FileText, X } from 'lucide-react';
import { ConsultRequest, ConsultMessage, FinancialProfile } from '../../types';
import { RehabCalculationResult } from '../../rehab-chatbot-package/services/calculationService';
import MyPageView from './MyPageView';

// Inline ChatDisclaimer component
function ChatDisclaimer() {
  return (
    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium flex gap-2 items-start shadow-sm text-left">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <strong>주의사항:</strong> 대화 중 오가는 상담 내용은 강력하게 암호화되어 안전하게 보호됩니다. 공식 선임계약 체결 전의 법률 상담은 참고용으로만 효력을 지니며, 모든 선임비용 결제 및 계약은 본 플랫폼 외부에서 변호사와 직접 조율하여 안전하게 체결하여 주시기 바랍니다.
      </div>
    </div>
  );
}

interface LawyerBid {
  id: string;
  name: string;
  avatar: string;
  firm: string;
  feasibility: string;
  monthlyPayment: number;
  duration: number;
  reductionRate: number;
  totalReduction: number;
  fee: number;
  installment: string;
  remark: string;
  tag: string;
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
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [activeChatMessages.length]);

  const lawyerBids: LawyerBid[] = [
    {
      id: 'lawyer-1', name: '김우진 변호사',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
      firm: '법무법인 한빛', feasibility: '진행 가능 (성공률 98%)',
      monthlyPayment: 45, duration: 36, reductionRate: 82,
      totalReduction: Math.round((debtBanks + debtCards + debtPersonals) * 0.82),
      fee: 180, installment: '최대 6개월 분할 가능 (월 30만 원)',
      remark: '급여 가압류를 금지명령으로 신속히 방어하고, 채권 추심 및 독촉을 3일 이내에 원천 차단해 드립니다.',
      tag: '신속추심차단'
    },
    {
      id: 'lawyer-2', name: '이소민 변호사',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      firm: '법무법인 한빛', feasibility: '진행 가능 (사행성 채무 특화)',
      monthlyPayment: 42, duration: 36, reductionRate: 85,
      totalReduction: Math.round((debtBanks + debtCards + debtPersonals) * 0.85),
      fee: 200, installment: '최대 12개월 장기 분할 납부 가능!',
      remark: '자녀 교육비를 특별 생계비로 법원에 추가 주장 소명하여 월 변제금을 최소한으로 낮춰드리겠습니다.',
      tag: '최저변제금설계'
    },
    {
      id: 'lawyer-3', name: '최덕중 변호사',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
      firm: '하늘 법률사무소', feasibility: '진행 가능 (수원 전문 15년)',
      monthlyPayment: 48, duration: 36, reductionRate: 80,
      totalReduction: Math.round((debtBanks + debtCards + debtPersonals) * 0.80),
      fee: 170, installment: '최대 3회 분할 납부 가능',
      remark: '복잡한 보정서류 일체를 대행 발급해 드리며, 법원의 까다로운 재산 검증 심사를 완벽히 방어합니다.',
      tag: '서류일체대행'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn font-sans text-left">
      {/* Rebirth Bid: 3-Lawyer Estimate Comparison Dashboard */}
      <div className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-premium space-y-8 relative overflow-hidden">
        {/* Glowing aura decorations */}
        <div className="absolute -right-24 -top-24 w-72 h-72 bg-brand/10 dark:bg-brand/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="border-b border-slate-100 dark:border-slate-800 pb-5 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] bg-brand text-white dark:bg-brand/20 dark:text-brand-light px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm">
                Rebirth Bid
              </span>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                실시간 3인 안심 제안서 도달
              </span>
            </div>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white mt-1 tracking-tight">
              ⚖️ 나를 위해 도착한 도산 변호사 3인의 안심 제안서
            </h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
              의뢰인님의 소득과 채무 상황을 정밀 검토하여 도산 전문 변호사 3명이 산정한 최적 조건입니다. 제안서를 클릭해 1:1 전담 무료 상담을 시작할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {lawyerBids.map((bid, index) => {
            // Distinct gradient borders/glows based on rank or lawyer index for a premium feel
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
                {/* Visual badge top line */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                  index === 0 ? 'from-brand to-indigo-500' : index === 1 ? 'from-indigo-500 to-purple-500' : 'from-purple-500 to-pink-500'
                }`} />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img 
                          src={bid.avatar} 
                          alt={bid.name} 
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm" 
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">
                          {bid.firm}
                        </span>
                        <strong className="text-sm font-bold text-slate-800 dark:text-white block">
                          {bid.name}
                        </strong>
                      </div>
                    </div>
                    <span className="text-[10px] bg-brand/5 dark:bg-brand/15 text-brand dark:text-brand-light px-2.5 py-1 rounded-lg font-bold">
                      {bid.tag}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">진행 가능성</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" /> {bid.feasibility}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">예상 월 변제금</span>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">
                        월 {bid.monthlyPayment}만 원 <span className="text-slate-400 font-normal">({bid.duration}개월)</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">총 감면율 (원금)</span>
                      <span className="bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand-light px-2 py-0.5 rounded-md font-bold text-[11px]">
                        약 {bid.reductionRate}% 탕감
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">총 감면 예상액</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        ★ {bid.totalReduction.toLocaleString()}만 원 감면
                      </span>
                    </div>
                    
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">제시 수임료</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold">{bid.fee}만 원</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">분납 조건</span>
                        <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full font-bold">
                          {bid.installment}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    <strong className="text-slate-800 dark:text-slate-200 font-bold block mb-1">
                      💡 변호인 솔루션
                    </strong>
                    "{bid.remark}"
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => {
                    const matchedRequest = requests.find(r => r.selectedLawyerId === bid.id || r.requestType === 'open');
                    if (matchedRequest) { onSetActiveChatReqId(matchedRequest.id); }
                    else if (requests.length > 0) { onSetActiveChatReqId(requests[0].id); }
                    else { 
                      onSetActiveTab('request'); 
                      alert('제안서의 변호사님과 비밀 대화를 시작하려면 먼저 자가진단 신청을 진행해 주세요! (30초 완료)'); 
                      return; 
                    }
                    setTimeout(() => { 
                      document.getElementById('chat-workspace-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
                    }, 100);
                  }} 
                  className="w-full text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-bold rounded-2xl transition-all duration-300 shadow-sm hover:shadow-brand-sm flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-[0.98]"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>💬 {bid.name}와 1:1 상담 시작</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal pt-4 border-t border-slate-100 dark:border-slate-800 font-medium">
          ※ Rebirthtalk은 공인된 변호사들이 제안하는 변제안 및 수임 조건을 투명하게 비교 매칭해주며, 사건 수임료 결제 및 정식 선임 등 모든 법률적 행위는 의뢰인과 변호인 간에 플랫폼을 거치지 않고 직접 성사됩니다.
        </div>
      </div>

      {/* Chat Workspace Grid */}
      <div id="chat-workspace-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-premium border border-slate-200 dark:border-slate-800 min-h-[550px] h-[calc(100vh-14rem)] lg:h-[700px] transition-all">
        {/* LEFT RAIL (상담 목록) */}
        <div className={`border-r border-slate-100 dark:border-slate-800 flex flex-col h-full min-h-0 bg-slate-50/20 dark:bg-slate-900/40 transition-all ${showProfilePanel ? 'hidden lg:flex lg:col-span-3' : 'flex lg:col-span-3'}`}>
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/60 backdrop-blur-sm">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">
              나의 채무관리방 목록
            </h3>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
              접수 완료된 자가진단 및 변호사 매칭 목록입니다.
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 scrollbar-hide">
            {requests.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
                  작성 완료된 상담 요청이 없습니다.
                </p>
                <button 
                  onClick={() => onSetActiveTab('request')} 
                  className="inline-flex text-xs text-brand hover:text-brand-hover font-bold cursor-pointer transition-colors"
                >
                  무료 자가진단 바로가기 &rarr;
                </button>
              </div>
            ) : requests.map(r => {
              const isSelected = r.id === activeChatReqId;
              const styleLabel = r.requestType === 'direct' ? '1:1 전담' : '3인 오픈';
              return (
                <div 
                  key={r.id} 
                  onClick={() => onSetActiveChatReqId(r.id)} 
                  className={`p-5 cursor-pointer transition-all text-left space-y-2 relative border-l-4 ${
                    isSelected 
                      ? 'bg-brand/[0.04] dark:bg-brand/[0.06] border-brand' 
                      : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold ${
                      r.requestType === 'direct' 
                        ? 'bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-300' 
                        : 'bg-brand/5 border border-brand/20 text-brand dark:text-brand-light'
                    }`}>
                      {styleLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">
                    {r.title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                    <span>총 부채: {r.financialProfile.debtTotal.toLocaleString()}만 원</span>
                    <span className={`font-bold ${
                      r.status === 'requested' ? 'text-amber-600 dark:text-amber-500' : r.status === 'responding' ? 'text-brand' : 'text-emerald-600 dark:text-emerald-500'
                    }`}>
                      {r.status === 'requested' ? '제안 대기' : r.status === 'responding' ? '응답서 도착' : '1:1 상담 중'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT BOARD (채팅창 영역) */}
        {currentRequest ? (
          <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 transition-all ${
            showProfilePanel 
              ? 'hidden lg:flex lg:col-span-5 border-r border-slate-100 dark:border-slate-800' 
              : 'flex lg:col-span-9'
          }`}>
            {/* Active chat header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="text-left flex-1 min-w-0">
                <span className="text-[10px] font-bold text-brand dark:text-brand-light uppercase tracking-widest block">
                  ACTIVE PREVIEW
                </span>
                <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100 line-clamp-1 mt-0.5">
                  {currentRequest.title}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
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
                  <span>{showProfilePanel ? '진단서 접기' : '나의 진단서 수정'}</span>
                </button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-bold hidden sm:flex">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>상담 채널 활성화</span>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
              <ChatDisclaimer />
            </div>

            {/* Messages feed */}
            <div ref={chatFeedRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 scrollbar-hide bg-slate-50/[0.15] dark:bg-slate-950/[0.05]">
              {/* Profile summary card */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-3 shadow-sm">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] text-brand dark:text-brand-light">
                  📝 실시간 자가진단서 접수 데이터 (변호사 검토용)
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-500 dark:text-slate-400 font-semibold">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] mb-0.5">월 실수령액</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold text-sm">{currentRequest.financialProfile.income}만 원</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] mb-0.5">총 채무액</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold text-sm">{currentRequest.financialProfile.debtTotal.toLocaleString()}만 원</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] mb-0.5">가구 부양가족</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold text-sm">{currentRequest.financialProfile.dependents}명</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] mb-0.5">결혼 여부</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                      {currentRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : '기혼'}
                    </strong>
                  </div>
                </div>
                {currentRequest.financialProfile.riskFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    {currentRequest.financialProfile.riskFlags.map(rf => (
                      <span key={rf} className="bg-red-500/5 border border-red-500/15 text-red-600 dark:text-red-400 text-[10px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        🚨 {rf}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone consultation panel */}
              <div className="bg-indigo-50/30 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40 text-xs space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm flex items-center gap-1.5">
                    <Phone className="w-4 h-4" /> 5분 내 즉시 안심 전화상담 신청
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                    변호사 1:1 직통 통화
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">
                      연락받으실 전화번호
                    </label>
                    <input 
                      type="text" 
                      placeholder="예: 010-1234-5678" 
                      value={phoneConsultNum} 
                      onChange={(e) => onSetPhoneConsultNum(e.target.value)} 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand/50 focus:border-brand focus:outline-none font-bold" 
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-500 dark:text-slate-400 py-1 font-semibold">
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
                      }} 
                      className="w-full text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-brand-sm flex items-center justify-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      <span>📞 무료 전화상담 요청 접수</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat bubbles */}
              {activeChatMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  <span>상담방이 정상적으로 활성화되었습니다.<br />아래 입력란을 통해 변호사에게 무엇이든 물어보세요!</span>
                </div>
              ) : activeChatMessages.map(m => {
                const isSystem = m.message.startsWith('[System]');
                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center my-2">
                      <div className="bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full py-1.5 px-4 text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight text-center max-w-md">
                        {m.message.replace('[System] ', '')}
                      </div>
                    </div>
                  );
                }

                const isMe = m.senderType === 'client';
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold px-1">
                      <span className="text-slate-800 dark:text-slate-300">{m.senderName}</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-3.5 rounded-2xl max-w-sm md:max-w-md text-xs leading-relaxed font-semibold shadow-sm ${
                      isMe 
                        ? 'bg-brand text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                    }`}>
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>

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
            
            {/* PROFILE SIDE PANEL (오른쪽 나의 상세 진단서 수정 패널) */}
            <div className={`h-full flex flex-col min-h-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 transition-all ${
              showProfilePanel 
                ? 'flex lg:col-span-4' 
                : 'hidden'
            }`}>
              {/* Header inside side panel */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand" />
                  나의 상세 진단서 수정
                </span>
                <button
                  type="button"
                  onClick={() => setShowProfilePanel(false)}
                  className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer"
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
          </div>
        ) : (
          <div className="lg:col-span-9 flex flex-col items-center justify-center p-8 text-center space-y-4 h-full bg-white dark:bg-slate-900">
            <Users className="w-14 h-14 text-slate-300 dark:text-slate-700" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
              선택된 채무상담방이 없습니다
            </h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs max-w-sm font-medium leading-relaxed">
              왼쪽의 나의 채무관리방 목록에서 특정 방을 선택하시거나, 신규 무료 자가진단을 신청하여 상담을 활성화하세요.
            </p>
            <button 
              onClick={() => onSetActiveTab('request')} 
              className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-sm hover:shadow-brand-sm transition-all cursor-pointer transform active:scale-[0.98]"
            >
              지금 30초 무료 진단 신청
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
