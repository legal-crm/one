import React, { useRef, useEffect } from 'react';
import { MessageSquare, Send, Users } from 'lucide-react';
import { ConsultRequest, ConsultMessage } from '../../types';

// Inline ChatDisclaimer component
function ChatDisclaimer() {
  return (
    <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2 text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
      ⚠️ <strong>주의:</strong> 상담 내용은 암호화 처리되며, 법률 조언은 공식 수임 계약 후에만 법적 효력을 갖습니다. 모든 결제 및 계약은 본 플랫폼 외부에서 변호사와 직접 진행하시기 바랍니다.
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
}

export default function ChatView({
  requests, messages, activeChatReqId, chatInput,
  phoneConsultNum, useSafeNumber050, isLoggedIn, userAlias,
  debtBanks, debtCards, debtPersonals,
  onSetActiveChatReqId, onSetChatInput, onSetPhoneConsultNum, onSetUseSafeNumber050,
  onSetActiveTab, onSetRequests, onSendChat, onAddMessage
}: ChatViewProps) {
  const chatFeedRef = useRef<HTMLDivElement>(null);
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
      remark: '급여 가압류를 금지명령으로 신속히 방어하고, 채권 추심 및 독촉을 3일 이내에 원천 차단해 드립니다.'
    },
    {
      id: 'lawyer-2', name: '이소민 변호사',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      firm: '법무법인 한빛', feasibility: '진행 가능 (사행성 채무 특화)',
      monthlyPayment: 42, duration: 36, reductionRate: 85,
      totalReduction: Math.round((debtBanks + debtCards + debtPersonals) * 0.85),
      fee: 200, installment: '최대 12개월 장기 분할 납부 가능!',
      remark: '자녀 교육비를 특별 생계비로 법원에 추가 주장 소명하여 월 변제금을 최소한으로 낮춰드리겠습니다.'
    },
    {
      id: 'lawyer-3', name: '최덕중 변호사',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
      firm: '하늘 법률사무소', feasibility: '진행 가능 (수원 전문 15년)',
      monthlyPayment: 48, duration: 36, reductionRate: 80,
      totalReduction: Math.round((debtBanks + debtCards + debtPersonals) * 0.80),
      fee: 170, installment: '최대 3회 분할 납부 가능',
      remark: '복잡한 보정서류 일체를 대행 발급해 드리며, 법원의 까다로운 재산 검증 심사를 완벽히 방어합니다.'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Rebirth Bid: 3-Lawyer Estimate Comparison Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 text-left">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Rebirth Bid</span>
            <span className="text-[10px] bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light px-2 py-0.5 rounded-full font-bold">실시간 3인 안심 제안서 도달</span>
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-white mt-1">⚖️ 나를 위해 도착한 도산 변호사 3인의 안심 제안서</h3>
          <p className="text-xs text-slate-500 mt-1">의뢰인님의 소득과 채무 상황을 바탕으로 도산 전문 변호사 3명이 산정한 맞춤 조건입니다. 마음에 드는 변호사와 즉시 1:1 상담을 나눌 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {lawyerBids.map((bid) => (
            <div key={bid.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img src={bid.avatar} alt={bid.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  <div className="text-left">
                    <span className="text-[9px] text-[#7e7e8f] dark:text-slate-500 font-bold block">{bid.firm}</span>
                    <strong className="text-xs font-black text-slate-800 dark:text-white block">{bid.name}</strong>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex justify-between items-center text-[10px]"><span className="text-slate-400 font-medium">진행 가능 여부</span><span className="text-emerald-600 dark:text-emerald-400 font-bold">{bid.feasibility}</span></div>
                  <div className="flex justify-between items-center text-[10px]"><span className="text-slate-400 font-medium">월 예상 변제금</span><span className="text-slate-800 dark:text-slate-200 font-bold">월 {bid.monthlyPayment}만 원 ({bid.duration}개월)</span></div>
                  <div className="flex justify-between items-center text-[10px]"><span className="text-slate-400 font-medium">예상 총 감면액</span><span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-[9px] sm:text-[10px]">원금의 {bid.reductionRate}% 감면 (★{bid.totalReduction.toLocaleString()}만 원)</span></div>
                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-200/30 dark:border-slate-800/30"><span className="text-slate-400 font-medium">제시 수임료</span><span className="text-slate-800 dark:text-slate-200 font-bold">{bid.fee}만 원</span></div>
                  <div className="flex justify-between items-center text-[10px]"><span className="text-slate-400 font-medium">수임료 분납 조건</span><span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-[9px] bg-indigo-500/5 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">{bid.installment}</span></div>
                </div>
                <div className="bg-white dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850 p-3 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-left">
                  <strong>변호사 특별 솔루션:</strong><br/>"{bid.remark}"
                </div>
              </div>
              <button type="button" onClick={() => {
                const matchedRequest = requests.find(r => r.selectedLawyerId === bid.id || r.requestType === 'open');
                if (matchedRequest) { onSetActiveChatReqId(matchedRequest.id); }
                else if (requests.length > 0) { onSetActiveChatReqId(requests[0].id); }
                else { onSetActiveTab('request'); alert('제안서의 변호사님과 대화를 나누시려면, 먼저 간단 자가진단 상담 신청을 완료해 주세요! (1초 완료)'); return; }
                setTimeout(() => { document.getElementById('chat-workspace-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
              }} className="w-full text-center py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                <MessageSquare className="w-3.5 h-3.5" /><span>💬 {bid.name}와 1:1 비밀 상담 시작</span>
              </button>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 leading-normal text-left pt-2 border-t border-slate-100 dark:border-slate-800/80">
          ※ Rebirthtalk은 변호사들이 제시한 수임조건(분납 조건 등)을 비교 매칭해줄 뿐, 수임 계약 및 선임 비용 결제 등 모든 거래는 의뢰인과 변호인 간에 플랫폼 외부에서 100% 직접 안전하게 거래됩니다.
        </div>
      </div>

      {/* Chat Workspace Grid */}
      <div id="chat-workspace-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[650px]">
        {/* LEFT RAIL */}
        <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">생성된 나의 상담 요청방</h3>
            <p className="text-slate-500 text-xs mt-0.5">상담 종류 및 매칭 여부를 확인할 수 있습니다.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/90">
            {requests.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-slate-500 text-xs">작성 완료된 상담 요청 건이 현재 존재하지 않습니다.</p>
                <button onClick={() => onSetActiveTab('request')} className="text-xs text-brand hover:underline font-bold">지금 첫 상담 무료 신청하기 &rarr;</button>
              </div>
            ) : requests.map(r => {
              const isSelected = r.id === activeChatReqId;
              const styleLabel = r.requestType === 'direct' ? '1:1 전담지정' : '3인 오픈참여';
              return (
                <div key={r.id} onClick={() => onSetActiveChatReqId(r.id)} className={`p-4 cursor-pointer transition-colors text-left space-y-1.5 ${isSelected ? 'bg-brand/10 border-l-4 border-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${r.requestType === 'direct' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light'}`}>{styleLabel}</span>
                    <span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">{r.title}</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>총 부채 {r.financialProfile.debtTotal.toLocaleString()}만 원</span>
                    <span className={`font-semibold ${r.status === 'requested' ? 'text-amber-600' : r.status === 'responding' ? 'text-brand' : 'text-emerald-600'}`}>
                      {r.status === 'requested' ? '요청 대기' : r.status === 'responding' ? '변호사 응답중' : '활발한 상담중'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT BOARD */}
        {currentRequest ? (
          <div className="lg:col-span-8 flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-brand dark:text-brand-light uppercase tracking-widest block">ACTIVE PREVIEW</span>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{currentRequest.title}</h3>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>상담 방 개방일: {new Date(currentRequest.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40"><ChatDisclaimer /></div>

            {/* Messages feed */}
            <div ref={chatFeedRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {/* Profile summary */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] text-brand dark:text-brand-light">📝 자가진단 분석 요약표 (변호사 열람 서류)</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                  <div>• 월실수령액: <strong className="text-slate-800 dark:text-slate-200">{currentRequest.financialProfile.income}만 원</strong></div>
                  <div>• 총 채무: <strong className="text-slate-800 dark:text-slate-100">{currentRequest.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                  <div>• 부양가족: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.dependents}명</strong></div>
                  <div>• 결혼: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : '기혼'}</strong></div>
                </div>
                {currentRequest.financialProfile.riskFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                    {currentRequest.financialProfile.riskFlags.map(rf => (
                      <span key={rf} className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[9px] px-1.5 py-0.5 rounded leading-none">🚨 {rf}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone consultation panel */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center gap-1">📞 실시간 안심 전화상담 신청</span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">변호사 직통 번호 지원</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">전화 상담 받으실 연락처</label>
                    <input type="text" placeholder="예: 010-1234-5678" value={phoneConsultNum} onChange={(e) => onSetPhoneConsultNum(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-brand focus:outline-none" />
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] text-slate-650 dark:text-slate-400 py-1.5">
                      <input type="checkbox" checked={useSafeNumber050} onChange={(e) => onSetUseSafeNumber050(e.target.checked)} className="rounded border-slate-300 text-brand focus:ring-brand cursor-pointer" />
                      <span>🛡️ 050 안심번호 서비스 사용 (실제 연락처 암호화 보호)</span>
                    </label>
                    <button type="button" onClick={() => {
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
                      const systemMsg = `[System] 📞 의뢰인님이 실시간 전화 상담을 신청하셨습니다.\n• 연락 요청처: ${displayNum}\n• 변호사님은 이 번호로 의뢰인님에게 즉각 연락해 주시기 바랍니다.`;
                      onAddMessage(activeChatReqId, systemMsg, 'client', 'client-temp', isLoggedIn ? `${userAlias} (본인)` : '의뢰인 (본인)');
                      setTimeout(() => {
                        onAddMessage(activeChatReqId, `안녕하세요, ${isLoggedIn && userAlias ? userAlias : '의뢰인'}님. 신청해 주신 연락처(${displayNum})를 확인했습니다. 가입하신 사건 요약 문서를 신속하게 검토한 뒤 5분 내로 즉시 전화를 드려 개인회생 가능 여부를 직접 브리핑해 드리겠습니다. 잠시만 대기해 주세요!`, 'lawyer', 'lawyer-2', '이소민 변호사');
                      }, 1500);
                      alert('변호사에게 전화상담 요청이 안전하게 발송되었습니다!');
                    }} className="w-full text-center py-2 bg-brand hover:bg-brand text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                      <span>📞 전화상담 요청 안전 전달</span>
                    </button>
                  </div>
                </div>
              </div>

              {activeChatMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">상담이 이제 막 생성되었습니다. 대화를 시작해 보세요.</div>
              ) : activeChatMessages.map(m => {
                const isMe = m.senderType === 'client';
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-350">{m.senderName}</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-3 rounded-xl max-w-md text-xs leading-relaxed ${isMe ? 'bg-brand text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
              <input type="text" placeholder="담당 변호사에게 메세지 전송..." value={chatInput} onChange={(e) => onSetChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }} className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-brand" />
              <button onClick={onSendChat} className="bg-brand hover:bg-brand text-white p-2 rounded-lg transition-colors"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex flex-col items-center justify-center p-8 text-center space-y-3 h-full bg-white dark:bg-slate-900">
            <Users className="w-12 h-12 text-slate-300" />
            <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">활성화된 상담 채널이 없습니다</h3>
            <p className="text-slate-500 text-xs max-w-sm">새 상담을 접수하거나 왼쪽 레일에서 진행 중인 대화방을 선택해 자율 매칭 상황을 모니터링할 수 있습니다.</p>
            <button onClick={() => onSetActiveTab('request')} className="bg-brand hover:bg-brand text-white font-semibold px-4 py-2 rounded-lg text-xs">상담 신청하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
