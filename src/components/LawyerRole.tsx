import React, { useState } from 'react';
import { 
  Briefcase, BarChart2, Shield, MessageSquare, ListCheck, FolderHeart, 
  Clock, Plus, Trash2, Send, Save, CreditCard, ChevronRight, CheckCircle2, Check, ExternalLink 
} from 'lucide-react';
import { 
  ConsultRequest, User, ConsultMessage, Case, CaseStatus, ConsultStatus 
} from '../types';
import { platformPlans, mockLawyers } from '../data';
import { ChatDisclaimer } from './Disclaimers';

interface LawyerRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: User[];
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string) => void;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
}

export default function LawyerRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  onAddMessage,
  cases,
  setCases
}: LawyerRoleProps) {
  // Lawyer sub navigation inside legal CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'open-requests' | 'active-chats' | 'cases' | 'billing'>('dashboard');
  
  // Custom states
  const [activeLawyer, setActiveLawyer] = useState<User>(lawyers[0]); // Simulated current logged lawyer
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  
  // Custom case creation / note creation states
  const [newNote, setNewNote] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<{ [reqId: string]: string }>({
    'req-1': '채무자가 가상 화폐 선물 거래 명세서 파싱에 소극적임. 법관 최근 심사에 불리함을 재상담 필요.',
    'req-2': '요양보호사 수입이 보건위생부 고시 최저생계비 이하라 개인파산 면책 전향이 매우 안전해 보임.',
    'req-3': '회사 급여 가압류 통지 효력 정지를 위한 긴급 금지명령 심리 작성팀에 신속 배정 완료.'
  });

  // Participate in an Open Request
  const handleJoinConsult = (reqId: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        // Change state to respond/counsel
        return { 
          ...req, 
          status: 'counseling',
          selectedLawyerId: activeLawyer.id 
        };
      }
      return req;
    }));

    // Auto greetings inside chat feed
    onAddMessage(
      reqId,
      `안녕하십니까, ${activeLawyer.name}입니다. 요청해 주신 가계 소득 및 채무 위기 명세를 긴급 송달 검토하였습니다. 압류 예고 및 보정 대응 등 즉시 효력이 발생하는 법적 대응에 대하여 세부 법리 검토를 도와드리겠습니다.`,
      'lawyer',
      activeLawyer.id,
      activeLawyer.name
    );

    setActiveChatReqId(reqId);
    setActiveTab('active-chats');
  };

  // Turn active request into an formal Case (수임 완료)
  const handleConvertToCase = (req: ConsultRequest) => {
    const isAlreadyCase = cases.some(c => c.clientId === req.clientId);
    if (isAlreadyCase) {
      alert('이미 정식 수임 사건으로 등록된 고객입니다.');
      return;
    }

    const newCase: Case = {
      id: `case-${Date.now()}`,
      clientId: req.clientId,
      clientName: req.clientName,
      phone: req.phone,
      status: 'document',
      assignedLawyerId: activeLawyer.id,
      assignedLawyerName: activeLawyer.name,
      debtTotal: req.financialProfile.debtTotal,
      income: req.financialProfile.income,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [
        '상담 완료 후 정식 변책 사건 선임 완료',
        `가계 채무 분석서(${req.financialProfile.debtTotal.toLocaleString()}만 원) 및 신분 서류 보완 지시`,
        '관할 법원 가압류 직무 중단 명령 청구 예정'
      ]
    };

    setCases(prev => [newCase, ...prev]);
    // Close consultation
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'closed' } : r));
    alert(`${req.clientName} 의뢰인이 정식 사건(선임계 완료)으로 전환 수임 등록되었습니다.`);
    setActiveTab('cases');
  };

  const handleUpdateCaseStatus = (caseId: string, nextStatus: CaseStatus) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() } : c));
  };

  const handleAddCaseNote = (caseId: string) => {
    if (!newNote.trim()) return;
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          notes: [newNote.trim(), ...c.notes],
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    }));
    setNewNote('');
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !activeChatReqId) return;
    onAddMessage(activeChatReqId, chatInput.trim(), 'lawyer', activeLawyer.id, activeLawyer.name);
    setChatInput('');
  };

  // Live Statistics
  const totalOpenRequestsCount = requests.filter(r => r.status === 'requested').length;
  const activeChatsCount = requests.filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open')).length;
  const totalCasesCount = cases.length;
  const directCounselingCount = requests.filter(r => r.status === 'responding' && r.selectedLawyerId === activeLawyer.id).length;

  const currentChatRequest = requests.find(r => r.id === activeChatReqId);
  const currentChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans">
      
      {/* Lawyer CRM Premium Header */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 shadow-xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="./logo.png" alt="회생톡 로고" className="w-8 h-8 rounded-lg object-cover" />
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-sm tracking-tight text-white">회생톡 변호사 CRM</span>
                <span className="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-extrabold text-[9px] tracking-wider uppercase">SaaS</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">도산 전문 법률 대리인 지부</span>
            </div>
            <span className="text-slate-700 text-xs hidden sm:inline ml-2 border-l border-slate-800 pl-3">팀: {activeLawyer.name.split(' ')[0]} 법률지부</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">인증 가입자:</label>
            <select 
              value={activeLawyer.id} 
              onChange={(e) => {
                const selected = lawyers.find(l => l.id === e.target.value);
                if (selected) setActiveLawyer(selected);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-semibold text-amber-400 focus:outline-none"
            >
              {lawyers.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.role})</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Primary tab navigation row */}
      <div className="bg-slate-950 border-b border-slate-800 px-4">
        <div className="max-w-7xl mx-auto flex overflow-x-auto gap-4 py-2 text-xs font-semibold">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm ${
              activeTab === 'dashboard' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>종합 대시보드</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('open-requests')}
            className={`relative pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm ${
              activeTab === 'open-requests' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>신규 상담 요청</span>
            {totalOpenRequestsCount > 0 && (
              <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] animate-pulse">
                {totalOpenRequestsCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('active-chats')}
            className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm ${
              activeTab === 'active-chats' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>실시간 협업실 (채팅)</span>
            {activeChatsCount > 0 && (
              <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                {activeChatsCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('cases')}
            className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm ${
              activeTab === 'cases' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span>진행 중인 수임 사건 (SaaS)</span>
            <span className="bg-slate-800 text-slate-300 rounded-full px-1.5 text-[9px]">
              {totalCasesCount}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('billing')}
            className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm ${
              activeTab === 'billing' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>이용 요금제 / 빌링</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* TAB 1: LAWYER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">오픈 대기중 신청</span>
                  <span className="text-2xl font-black text-amber-400">{totalOpenRequestsCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-400/10 text-amber-400">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">직접 지정 응답 대기</span>
                  <span className="text-2xl font-black text-blue-400">{directCounselingCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-400/10 text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">내가 참여중인 상담</span>
                  <span className="text-2xl font-black text-emerald-400">{activeChatsCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-400/10 text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">사건화(수임 계약) 성공</span>
                  <span className="text-2xl font-black text-purple-400">{totalCasesCount}건</span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-400/10 text-purple-400">
                  <FolderHeart className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Daily Conversion Stats and Team KPIs */}
              <div className="lg:col-span-2 bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>팀별 도산 전문 영업 KPI 분석 (실시간)</span>
                  </h3>
                  <span className="bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-[10px]">오늘: 2026-05-26</span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* KPI Progress 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">회생/파산 상담전화 사건 수임 변환률 (Target: 40%)</span>
                      <span className="text-emerald-400 font-bold">44.5% (달성)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[85%] rounded-full"></div>
                    </div>
                  </div>

                  {/* KPI Progress 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">평균 법원 보정 권고대응 납기 (Target: 7일 내)</span>
                      <span className="text-amber-400 font-bold">5.8일 (보강 필요)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full w-[70%] rounded-full"></div>
                    </div>
                  </div>

                  {/* KPI Progress 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">상담 참여 락(Lock) 소진율 - 마케팅 원가 대비 전환</span>
                      <span className="text-blue-400 font-bold">68.2%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[68%] rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Sub regional performance box */}
                <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">수원지법 지부</span>
                    <strong className="text-xs text-amber-300">총 수임 42M</strong>
                  </div>
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">서울회생법원</span>
                    <strong className="text-xs text-blue-300">총 수임 155M</strong>
                  </div>
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">부산지방법원</span>
                    <strong className="text-xs text-emerald-300">총 수임 60M</strong>
                  </div>
                </div>
              </div>

              {/* CRM Active Info Guide */}
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>플랫폼 공존 원칙 준수 요약</span>
                </h3>
                <ul className="text-xs space-y-2.5 text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>의뢰인이 상담을 자발적으로 개설한 요청에 대해서만 보정 접근할 수 있습니다.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>오픈 다중참여형 매칭은 선착순 3인 도달 시 자율 시스템이 락(Lock)을 생성합니다.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>개별 임의 DM 및 타인 광고 노출은 불가하며, 성과 수수료 갈취 행위는 금지됩니다.</span>
                  </li>
                </ul>

                <button 
                  onClick={() => setActiveTab('open-requests')}
                  className="w-full bg-slate-850 hover:bg-slate-800 text-amber-400 font-bold py-2 rounded-lg text-xs border border-slate-800 transition-colors"
                >
                  새 상담요청 수집확인 &rarr;
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: INCOMING COUNSEL REQUESTS LIST */}
        {activeTab === 'open-requests' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-100">오픈 및 지정 상담 요청 대기 대시보드</h2>
                <p className="text-xs text-slate-400 mt-0.5">상세 채무 구조와 가용 가계 소득 진단 통계를 검토 후 참여하십시오.</p>
              </div>

              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                전공 연도: 회생파산 전담팀 R-1
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {requests
                .filter(r => r.status === 'requested' || (r.status === 'responding' && r.selectedLawyerId === activeLawyer.id))
                .map(r => {
                  const debtRatio = (r.financialProfile.debtTotal / (r.financialProfile.income * 12)).toFixed(1);
                  return (
                    <div key={r.id} className="bg-slate-950 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row justify-between gap-6">
                      
                      {/* Left: Client detailed debt statistics query */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded text-[10px]">
                            {r.requestType === 'direct' ? '단독지명' : '오픈형'}
                          </span>
                          <span className="text-xs text-slate-400">의뢰인: <strong>{r.clientName}</strong></span>
                          <span className="text-xs text-slate-500">|</span>
                          <span className="text-xs text-slate-400">등록일: {new Date(r.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-slate-100">{r.title}</h3>
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{r.content}</p>
                        </div>

                        {/* Calculations Panel */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/50 p-3 rounded-lg text-[11px] text-slate-400 border border-slate-850">
                          <div>• 총 가계 채무: <strong className="text-amber-400 font-extrabold">{r.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                          <div>• 기재 자산수준: <strong className="text-slate-200 font-semibold">{r.financialProfile.assetsTotal.toLocaleString()}만 원</strong></div>
                          <div>• 월 가중소득: <strong className="text-slate-200 font-semibold">{r.financialProfile.income}만 원</strong></div>
                          <div>• 소득 대비 부채비: <strong className="text-red-400 font-bold">{debtRatio}배 수준</strong></div>
                        </div>

                        {r.financialProfile.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {r.financialProfile.riskFlags.map(rf => (
                              <span key={rf} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-red-500/10">
                                ⚠️ {rf}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Quick action panel to "상담 참여" or "단독 수임" */}
                      <div className="md:w-60 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 gap-4">
                        <div className="text-xs text-slate-400 space-y-1">
                          <div className="flex justify-between"><span>최대 참여 한도:</span> <strong className="text-slate-200">{r.maxParticipants}명</strong></div>
                          <div className="flex justify-between"><span>현재 상태:</span> <strong className="text-amber-400">요청대기</strong></div>
                        </div>

                        <button 
                          onClick={() => handleJoinConsult(r.id)}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-lg text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>상담 참여 & 실시간 채팅 참여</span>
                        </button>
                      </div>

                    </div>
                  );
                })}

              {requests.filter(r => r.status === 'requested' || (r.status === 'responding' && r.selectedLawyerId === activeLawyer.id)).length === 0 && (
                <div className="bg-slate-950 p-12 text-center rounded-xl border border-slate-800 text-slate-500 text-xs">
                  현재 즉시 대응할 신규 상담 신청 건이 존재하지 않습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: THREE-PANE REAL-TIME CHAT & 법률 CRM PANEL */}
        {activeTab === 'active-chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-800 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[700px] animate-fadeIn">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className="lg:col-span-3 border-r border-slate-805 flex flex-col h-full bg-slate-950">
              <div className="p-4 border-b border-slate-850">
                <h3 className="font-extrabold text-xs text-slate-200 tracking-wider uppercase">상담 진행 메시지함</h3>
                <p className="text-slate-500 text-[10px] mt-0.5">실시간 매칭된 나의 세션 내역</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-900 h-[400px]">
                {requests
                  .filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open'))
                  .map(r => {
                    const isSelected = r.id === activeChatReqId;
                    return (
                      <div 
                        key={r.id}
                        onClick={() => setActiveChatReqId(r.id)}
                        className={`p-4 cursor-pointer text-left transition-colors space-y-1 ${
                          isSelected ? 'bg-slate-900/80 border-l-4 border-amber-400' : 'hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500">의뢰인: {r.clientName}</span>
                          <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-200 line-clamp-1">{r.title}</h4>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                          <span>부채: {r.financialProfile.debtTotal.toLocaleString()}만</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>상담중</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {requests.filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open')).length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-[11px] space-y-2">
                    <p>내가 배정되어 상담 개시 중인 활성 대화방이 없습니다.</p>
                    <button 
                      onClick={() => setActiveTab('open-requests')}
                      className="text-amber-400 font-bold hover:underline"
                    >
                      상담 참여 대기 목록보기 &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL II: ACTIVE MESSAGING BOARD (CENTER) */}
            <div className="lg:col-span-6 border-r border-slate-805 flex flex-col h-full bg-slate-950">
              {currentChatRequest ? (
                <>
                  <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-900/20">
                    <div>
                      <span className="text-[9px] font-bold tracking-widest text-emerald-400 block uppercase">SECURE CHAT CHANNEL</span>
                      <h3 className="font-extrabold text-xs text-slate-200 line-clamp-1">{currentChatRequest.title}</h3>
                    </div>

                    <span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-400 px-2 py-0.5 rounded">
                      의뢰채널 id: {currentChatRequest.id}
                    </span>
                  </div>

                  {/* Chat flow messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[350px]">
                    <div className="p-3 bg-slate-900/50 rounded-lg text-slate-400 text-xs border border-slate-850">
                      📝 <span className="text-amber-400 font-semibold">의뢰서 본문 내용:</span> {currentChatRequest.content}
                    </div>

                    {currentChatMessages.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-350">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className={`p-3 rounded-xl max-w-sm text-xs leading-normal ${
                            isMe 
                            ? 'bg-amber-500 text-slate-950 rounded-tr-none font-semibold' 
                            : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800'
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Messenger form */}
                  <div className="p-4 border-t border-slate-850 bg-slate-900/60 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="의뢰인과의 1:1 보정 대화를 입력하십시오..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChat();
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-400 text-slate-100"
                    />
                    <button 
                      onClick={handleSendChat}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold p-2 rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500">
                  <MessageSquare className="w-12 h-12 text-slate-800" />
                  <p className="text-xs">왼쪽 메시지함에서 진행 가능한 의뢰인 대화 스레드를 클릭하십시오.</p>
                </div>
              )}
            </div>

            {/* PANEL III: ATTOURNEY CRM RIGHT-RAIL (RIGHT) */}
            <div className="lg:col-span-3 flex flex-col h-full bg-slate-950 overflow-y-auto">
              {currentChatRequest ? (
                <div className="p-4 space-y-6 text-xs divide-y divide-slate-900">
                  
                  {/* Option: Client financial summary info */}
                  <div className="space-y-3 pb-4">
                    <span className="text-xs font-black text-amber-400 tracking-wide uppercase block">📈 1차 가계 진단 분석서</span>
                    
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 space-y-2 text-[11px] text-slate-300">
                      <div className="flex justify-between"><span>의뢰인명:</span> <span className="font-bold text-white">{currentChatRequest.clientName}</span></div>
                      <div className="flex justify-between"><span>비상 연락처:</span> <span className="font-mono text-white">{currentChatRequest.phone}</span></div>
                      <div className="flex justify-between"><span>월 소득계산:</span> <span className="font-bold text-amber-300">{currentChatRequest.financialProfile.income}만 원</span></div>
                      <div className="flex justify-between table-auto"><span>총 채무진단:</span> <span className="font-bold text-red-400">{currentChatRequest.financialProfile.debtTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span>자산수준합산:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.assetsTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span>부양 가족수:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.dependents}명</span></div>
                      <div className="flex justify-between"><span>결혼 자격구조:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.maritalStatus}</span></div>
                    </div>

                    {currentChatRequest.financialProfile.riskFlags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-red-400 block">시스템 자동 추출 리스크 태그:</span>
                        <div className="flex flex-wrap gap-1">
                          {currentChatRequest.financialProfile.riskFlags.map(rf => (
                            <span key={rf} className="bg-red-500/10 text-red-400 border border-red-500/10 text-[9px] px-1.5 py-0.5 rounded uppercase leading-none">
                              {rf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Converting Case: "상담 -> 사건 등록" */}
                  <div className="pt-4 pb-4 space-y-3">
                    <span className="text-xs font-black text-amber-400 tracking-wide uppercase block">⚖️ 상담 사건 공식 수임 전환</span>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      상담이 성사되어 위임 계약서 서명이 마쳐지면, 본 가입자의 정보를 정식 사건 대장으로 영구 등록해 보정명령 추적을 시작할 수 있습니다.
                    </p>

                    <button 
                      onClick={() => handleConvertToCase(currentChatRequest)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-lg text-xs leading-none tracking-wide transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>정식 수임사건으로 신규 전환</span>
                    </button>
                  </div>

                  {/* Internal Law-firm Notes (visible only on Lawyer side) */}
                  <div className="pt-4 space-y-3">
                    <span className="text-xs font-black text-amber-400 tracking-wide uppercase block">📌 로펌 내부 협업 및 비망록</span>
                    <p className="text-slate-500 text-[10px]">사무장 및 보조 스태프와 해당 의뢰인의 보정 소명 보조 기록을 메모하는 보안 영역입니다.</p>

                    <textarea
                      rows={4}
                      placeholder="내부 긴급 가이드 및 참고 메모를 작성해 주세요..."
                      value={internalNotes[currentChatRequest.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [currentChatRequest.id]: e.target.value };
                        setInternalNotes(nextNotes);
                      }}
                      className="w-full bg-slate-900 border border-slate-850 rounded p-2 text-xs focus:ring-1 focus:ring-amber-400 text-slate-200 placeholder-slate-600"
                    />

                    <span className="text-[10px] text-slate-500 block leading-tight">
                      * 이 비망록은 로펌 구성원 상호 간에만 공유되며 의뢰인 전용 채널에는 절대 전송되지 않습니다.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center text-slate-600 text-[11px] self-center">
                  의뢰인 상담방이 활성화되면 실시간 가계 채무 분석 CRM 모듈이 자동 로드됩니다.
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: CASE MANAGEMENT SYSTEM (KANBAN & LIST) */}
        {activeTab === 'cases' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Top Bar with metric details */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FolderHeart className="w-5 h-5 text-amber-400" />
                  <span>로펌 사건 위임 대장 통합 CRM (소생 및 개인회생 단대)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">서류 준비부터 파산 면책 승인 및 변제 개시 고시까지 일괄적으로 RLS 권한에 의거해 추적합니다.</p>
              </div>

              <div className="flex gap-2">
                <span className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded font-semibold">
                  총 감면 탕감 달성액: <strong className="text-emerald-400">11억 4200만 원</strong>
                </span>
              </div>
            </div>

            {/* Row structure representing standard case progress:
                서류 -> 접수 -> 개시 -> 인가 -> 면책 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              
              {/* STAGES */}
              {(['document', 'filing', 'commencement', 'approval', 'discharge'] as const).map(stage => {
                const stageName = stage === 'document' ? '1. 서류준비' : stage === 'filing' ? '2. 법원접수' : stage === 'commencement' ? '3. 개시결정' : stage === 'approval' ? '4. 최종인가' : '5. 파산면책';
                const stageColor = stage === 'document' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-505' : stage === 'filing' ? 'bg-blue-500/20 text-blue-400 border-blue-505' : stage === 'commencement' ? 'bg-amber-500/20 text-amber-400 border-amber-505' : stage === 'approval' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-505' : 'bg-purple-500/20 text-purple-400 border-purple-505';
                const stageCases = cases.filter(c => c.status === stage);

                return (
                  <div key={stage} className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3 min-h-[300px]">
                    <div className={`p-2 rounded font-extrabold text-xs text-center border ${stageColor}`}>
                      {stageName} ({stageCases.length})
                    </div>

                    <div className="space-y-2">
                      {stageCases.map(c => {
                        const isSelected = c.id === selectedCaseId;
                        return (
                          <div 
                            key={c.id}
                            onClick={() => setSelectedCaseId(c.id)}
                            className={`p-3 rounded border cursor-pointer transition-all space-y-2 ${
                              isSelected 
                              ? 'bg-slate-900 border-amber-400 shadow-md ring-1 ring-amber-400/20' 
                              : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-350">{c.clientName} 의뢰인</span>
                              <span className="text-slate-500 text-[9px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>

                            <div className="text-[11px] font-bold text-slate-200">
                              위임채무액: <span className="text-amber-300 font-extrabold">{c.debtTotal.toLocaleString()}만 원</span>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-normal line-clamp-1">
                              {c.notes.length > 0 ? `• ${c.notes[0]}` : '기재 메모 없음'}
                            </p>
                          </div>
                        );
                      })}

                      {stageCases.length === 0 && (
                        <div className="text-center py-8 text-[10px] text-slate-600">
                          이 단계의 의뢰인이 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Detailed Case Editor Panel when selected */}
            {selectedCaseId && (() => {
              const activeCase = cases.find(c => c.id === selectedCaseId);
              if (!activeCase) return null;
              
              return (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 animate-slideUp">
                  {/* Left Side: Case general and state change */}
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">CASE FILE SYSTEM</span>
                        <h3 className="font-extrabold text-base text-slate-100">{activeCase.clientName} 의뢰인 파일정보</h3>
                      </div>

                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                        담당: {activeCase.assignedLawyerName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-850 text-[11px] text-slate-400">
                      <div>• 고객 연락처: <strong className="text-slate-200 font-mono">{activeCase.phone}</strong></div>
                      <div>• 세후 월가용소득: <strong className="text-slate-200">{activeCase.income}만 원</strong></div>
                      <div>• 연체 승인부채액: <strong className="text-amber-400 font-bold">{activeCase.debtTotal.toLocaleString()}만 원</strong></div>
                      <div>• 최초 선임 등록일: <strong className="text-slate-200">{new Date(activeCase.createdAt).toLocaleDateString()}</strong></div>
                    </div>

                    {/* Change Status dropdown */}
                    <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-850 space-y-2">
                      <label className="block font-bold text-[11px] text-slate-300">법원 추진 단계 일괄 변경:</label>
                      <div className="flex gap-2">
                        <select 
                          value={activeCase.status}
                          onChange={(e) => handleUpdateCaseStatus(activeCase.id, e.target.value as CaseStatus)}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 font-bold text-amber-400 text-xs focus:ring-1"
                        >
                          <option value="document">1. 서류 기획 상태</option>
                          <option value="filing">2. 본 법원 접수 완료</option>
                          <option value="commencement">3. 법원 지정 가상 개시 결정 고시</option>
                          <option value="approval">4. 최종 인가 결정 도달</option>
                          <option value="discharge">5. 전액 면책 성실 불입 완성</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Log and notes tracking */}
                  <div className="space-y-4 text-xs flex flex-col justify-between">
                    <div className="space-y-3">
                      <span className="font-black text-amber-400 uppercase tracking-widest block text-[11px]">📝 보정 및 추진 명세 성과 로그</span>
                      
                      {/* Interactive form to add a note */}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="새로운 보정이나 법원 결정 고시 사항 메모 기입..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCaseNote(activeCase.id);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-100"
                        />
                        <button 
                          onClick={() => handleAddCaseNote(activeCase.id)}
                          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-3 py-1.5 rounded text-xs transition-colors shrink-0"
                        >
                          등록
                        </button>
                      </div>

                      {/* Display of notes */}
                      <div className="bg-slate-950/40 border border-slate-850 rounded p-3 text-[11px] text-slate-300 space-y-1.5 max-h-40 overflow-y-auto">
                        {activeCase.notes.map((note, idx) => (
                          <div key={idx} className="flex gap-1.5 items-start">
                            <span className="text-amber-400 font-bold select-none shrink-0">•</span>
                            <span className="leading-relaxed">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-900">
                      <button 
                        onClick={() => setSelectedCaseId('')}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium px-4 py-1.5 rounded border border-slate-800"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* TAB 5: BILLING & SUBSCRIPTIONS */}
        {activeTab === 'billing' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top overview plan status */}
            <div className="bg-gradient-to-r from-indigo-950 to-slate-950 p-6 rounded-xl border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
              <div className="space-y-1.5">
                <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">ACTIVE SUBSCRIPTION</span>
                <h2 className="text-xl font-black text-white">동원 법무분소: <span className="text-indigo-400">Team SaaS Pro 요금제 사용 중</span></h2>
                <p className="text-xs text-slate-400">다음 결제 예정일: 2026년 06월 25일 (월 800,000 원 자동 승인)</p>
              </div>

              <div className="bg-slate-900 text-slate-300 p-4 rounded-lg border border-slate-800 text-xs flex gap-6">
                <div>
                  <span className="text-[10px] text-slate-500 block">이달 소진 매칭참여수</span>
                  <strong className="text-base text-amber-400">14 / 20건</strong>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <span className="text-[10px] text-slate-500 block">누적 가형 충전 충전금</span>
                  <strong className="text-base text-blue-400">35,000 원</strong>
                </div>
              </div>
            </div>

            {/* List of plans to showcase pricing mock structures */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {platformPlans.map((plan, idx) => (
                <div key={idx} className={`bg-slate-950 rounded-xl p-6 border flex flex-col justify-between gap-6 relative ${plan.color}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400 shadow">
                      가장 많은 로펌 선택
                    </span>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-100">{plan.name}</h3>
                      <p className="text-slate-500 text-xs">수임료 과세 중계 불가 원칙 준수</p>
                    </div>

                    <div className="text-xl font-bold text-amber-400">{plan.price}</div>

                    <ul className="text-xs space-y-2 text-slate-400">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex gap-1.5 items-start">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                    plan.name === 'Pro' 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/20 shadow' 
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                  }`}>
                    {plan.name === 'Pro' ? '현재 요금제 이용 중' : '요금제 업그레이드 문의'}
                  </button>
                </div>
              ))}
            </div>

            {/* Banned details for security */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-855 text-xs h-auto space-y-2 text-slate-400 leading-normal">
              <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wide">💡 회생/파산 수임 연계 빌링 법적 안전장치</span>
              <p>
                본 Legal CRM은 변호사법 위반을 피하기 위해 **개인회생 수임 성공(계약 성사)에 따른 배분 수수료를 절대 징수하지 않습니다**.
                월 고정 요금제로 책정되는 SaaS 구독료 및 매칭 참여 시 차감되는 클릭 광고 차감 수수료(참여 1건당 무관 소진) 방식만으로 운영되어 사후 보증 및 로펌 운영 안전성이 100% 보장됩니다.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Sub status footer */}
      <footer className="bg-slate-950 border-t border-slate-850 text-center py-4 text-[10px] text-slate-500 space-y-1">
        <p>© 2026 회생톡 도산 전문 변호사 CRM. All rights reserved.</p>
        <p>본 플랫폼의 매출 구조는 변호사법 제34조 정식 원칙 가이드(활동 기반 월 고정 구독료 책정)를 철저하게 이행합니다.</p>
      </footer>

    </div>
  );
}
