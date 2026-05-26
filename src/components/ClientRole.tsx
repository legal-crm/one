import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronRight, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye
} from 'lucide-react';
import { Client, FinancialProfile, ConsultRequest, User as LawyerType, ConsultMessage } from '../types';
import { mockLawyers, initialConsultRequests, initialConsultMessages } from '../data';
import { RequestDisclaimer, ChatDisclaimer, BannedNotice } from './Disclaimers';

interface ClientRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: LawyerType[];
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string) => void;
}

export default function ClientRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  onAddMessage
}: ClientRoleProps) {
  // Sub-navigation for user
  const [activeTab, setActiveTab] = useState<'landing' | 'request' | 'lawyers' | 'chat'>('landing');
  
  // New Request Form State
  const [requestStep, setRequestStep] = useState<number>(1);
  const [requestType, setRequestType] = useState<'direct' | 'open'>('open');
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('');
  const [income, setIncome] = useState<number>(200); // 10k KRW (만 원)
  const [debtTotal, setDebtTotal] = useState<number>(5000);
  const [assetsTotal, setAssetsTotal] = useState<number>(1000);
  const [dependents, setDependents] = useState<number>(0);
  const [maritalStatus, setMaritalStatus] = useState<'SINGLE' | 'MARRIED' | 'DIVORCED'>('SINGLE');
  
  // Detailed Debt Breakdown
  const [debtBanks, setDebtBanks] = useState<number>(3000);
  const [debtCards, setDebtCards] = useState<number>(1500);
  const [debtPersonals, setDebtPersonals] = useState<number>(500);
  const [recentLoans, setRecentLoans] = useState<number>(0);
  const [coinCrypto, setCoinCrypto] = useState<number>(0);

  // Form final step
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [consentCheck, setConsentCheck] = useState<boolean>(false);
  
  // Filter for Directory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('전체');

  // Currently opened Chat consultation request ID
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');

  // Auto scroll logic for chat window
  useEffect(() => {
    if (requests.length > 0 && !activeChatReqId) {
      setActiveChatReqId(requests[0].id);
    }
  }, [requests, activeChatReqId]);

  // Load random preset MyData profile
  const handleMyDataLoad = () => {
    // Simulated MyData pull
    const presets = [
      { inc: 245, debt: 8200, asset: 1500, bank: 4000, card: 2500, p: 1700, rec: 1500, coin: 3500, dep: 1, m: 'MARRIED' as const },
      { inc: 180, debt: 4500, asset: 300, bank: 2000, card: 1500, p: 1000, rec: 500, coin: 0, dep: 0, m: 'SINGLE' as const },
      { inc: 350, debt: 15000, asset: 4200, bank: 9000, card: 3000, p: 3000, rec: 4000, coin: 6000, dep: 2, m: 'DIVORCED' as const }
    ];
    const rand = presets[Math.floor(Math.random() * presets.length)];
    setIncome(rand.inc);
    setDebtTotal(rand.debt);
    setAssetsTotal(rand.asset);
    setDebtBanks(rand.bank);
    setDebtCards(rand.card);
    setDebtPersonals(rand.p);
    setRecentLoans(rand.rec);
    setCoinCrypto(rand.coin);
    setDependents(rand.dep);
    setMaritalStatus(rand.m);
  };

  // Submit Handler
  const handleRequestSubmit = () => {
    if (!title || !content) {
      alert('상담 요청 제목과 내용을 입력 후 제출해 주세요.');
      return;
    }
    if (!consentCheck) {
      alert('변호사법 제34조 준수 및 자율적 선택 조항에 동의하셔야 제출이 가능합니다.');
      return;
    }

    const calculatedTotal = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;
    const finalDebtTotal = calculatedTotal > 0 ? calculatedTotal : debtTotal;

    // Generate calculated risk tags
    const riskFlags: string[] = [];
    if (recentLoans > finalDebtTotal * 0.3) riskFlags.push('최근 대출 비중 초과 (30% 이상)');
    if (coinCrypto > 2000) riskFlags.push('투자/사행성 손실 채무 포함');
    if (finalDebtTotal > income * 24) riskFlags.push('소득 대비 장기 한계 부채');
    if (income < 130 + dependents * 60) riskFlags.push('최저 생계비 임계점 도달');

    const newRequest: ConsultRequest = {
      id: `req-${Date.now()}`,
      clientId: 'client-temp',
      clientName: '홍준표 (의뢰인)',
      phone: '010-4567-8901',
      requestType,
      maxParticipants: requestType === 'open' ? 3 : 1,
      status: 'requested',
      selectedLawyerId: requestType === 'direct' ? selectedLawyerId : undefined,
      createdAt: new Date().toISOString(),
      title,
      content,
      financialProfile: {
        clientId: 'client-temp',
        income,
        debtTotal: finalDebtTotal,
        assetsTotal,
        dependents,
        maritalStatus,
        debtTypes: {
          banks: debtBanks,
          cards: debtCards,
          personals: debtPersonals,
          recentLoans,
          coinCrypto
        },
        riskFlags
      }
    };

    setRequests(prev => [newRequest, ...prev]);
    setActiveChatReqId(newRequest.id);
    
    // Auto respond simulation
    setTimeout(() => {
      onAddMessage(
        newRequest.id,
        `반갑습니다. 의뢰인님의 개인회생 상담 요청이 정상 등록되었습니다. ${
          requestType === 'open' 
          ? '참여형 매칭 제도를 통해 변호사단에서 최대 3명이 곧 참여를 결정하게 되며, 순차적으로 메세지를 남길 예정입니다.' 
          : '직접 선택하신 담당 변호사와 즉시 상담채널이 활성화되었습니다.'
        }`,
        'lawyer',
        requestType === 'direct' ? selectedLawyerId : 'lawyer-1',
        requestType === 'direct' ? (lawyers.find(l => l.id === selectedLawyerId)?.name || '담당 변호사') : '김우진 변호사'
      );
    }, 1500);

    // Reset Form
    setRequestStep(1);
    setTitle('');
    setContent('');
    setConsentCheck(false);
    setActiveTab('chat');
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    onAddMessage(activeChatReqId, chatInput.trim(), 'client', 'client-temp', '의뢰인(본인)');
    setChatInput('');

    // Simulate lawyer responding back
    setTimeout(() => {
      onAddMessage(
        activeChatReqId,
        '상세 채무 계산 내역을 검토 중입니다. 월 평균 납부 가능한 가용 변제액을 약 40만 원 수준으로 맞춰 법관 보정 대비가 가능한 구조입니다. 법인 통장 거래 내역 및 신분증 사본 준비가 가능하신가요?',
        'lawyer',
        'lawyer-2',
        '이소민 변호사'
      );
    }, 2500);
  };

  // Helper values
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  // Formatted calculation
  const totalCalculatedDebt = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* Dynamic Client Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold tracking-wider">CLIENT</span>
            <span className="font-bold text-lg text-slate-800 dark:text-slate-150">개인회생·파산 의뢰인 센터</span>
          </div>

          <nav className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('landing')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'landing' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              홈 / 안내
            </button>
            <button 
              onClick={() => setActiveTab('request')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'request' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              상담 신청
            </button>
            <button 
              onClick={() => setActiveTab('lawyers')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'lawyers' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              변호사 찾기
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'chat' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              내 상담방
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* TAB 1: LANDING & INTRO */}
        {activeTab === 'landing' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-8 md:p-12 rounded-2xl shadow-xl border border-blue-950 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="max-w-3xl space-y-4">
                <span className="text-blue-300 font-medium text-xs uppercase tracking-widest bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/50">
                  변호사법 제34조 정식 변호사법 위반 소지 없는 순수 SaaS형 매칭
                </span>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
                  개인회생·파산 분산 매칭 및<br />
                  변호사 법률 상담 서비스
                </h1>
                <p className="text-slate-300 text-base max-w-2xl leading-relaxed">
                  본 플랫폼은 수임료 기반의 불법 중개나 환수 알선 행위를 절대 하지 않습니다. 의뢰인은 단지 본인의 채무 정보를 마이데이터 연동이나 수기 수치로 안전하게 분석 및 입력한 후, 직접 상담에 참여하길 원하는 전담 도산 변호사 그룹을 자율적으로 선택하거나 매칭합니다.
                </p>
                
                <div className="pt-4 flex flex-wrap gap-3">
                  <button 
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-transform hover:scale-102"
                  >
                    <span>다중 참여형 상담방 열기 (추천)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('lawyers')}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
                  >
                    <span>변호사 프로필 직접 선택</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Core Features Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-150">다중 분산 상담 매칭 (최대 3인)</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  의뢰인이 오픈 상담을 신청하면, 플랫폼 매칭 필터를 연동하여 법적으로 인가된 최대 3명의 변호사가 자율 서명 형태로 상담에 참여합니다. 과장 수임 광고나 수수료 부담이 없는 안전한 구조입니다.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-150">채무 위기 자가 진단 및 MyData</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  자신의 월소득, 금융권 부채, 카드론, 신용대출 및 투자 손실을 구체적으로 대입하여 최적 개시 변제금과 최저 생계비 적합성을 마이데이터 형식으로 가계산할 수 있는 인텔리전트 가이드를 제공합니다.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-150">법원 전 과정 변제율 투명 사건 CRM</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  상담 완료 후 정식 위임 계약 시 법무 대리인의 사건 상태(서류 -&gt; 접수 -&gt; 개시 결정 -&gt; 인가 -&gt; 면책)를 전용 모바일 연동 브라우저를 통해 실시간 보정까지 투명하게 추적 관리할 수 있습니다.
                </p>
              </div>
            </div>

            <BannedNotice />
          </div>
        )}

        {/* TAB 2: MULTI-STEP REQUEST FORM */}
        {activeTab === 'request' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-6 md:p-8 animate-fadeIn">
            
            {/* Steps Visual Guidance */}
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  requestStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>1</span>
                <div>
                  <span className="block font-semibold text-sm">상담 방식 선정</span>
                  <span className="text-xs text-slate-500">직접 / 분산 다중 연결</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  requestStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>2</span>
                <div>
                  <span className="block font-semibold text-sm">소득 / 채무 자가계산</span>
                  <span className="text-xs text-slate-500">마이데이터 및 상세 내역</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  requestStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>3</span>
                <div>
                  <span className="block font-semibold text-sm">상담 내용 접수</span>
                  <span className="text-xs text-slate-500">법적 책임 동의 및 완료</span>
                </div>
              </div>
            </div>

            {/* STEP 1: CHOICE OF FLOW */}
            {requestStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1 col-slate-800">상담을 원하는 방식을 선택해 주세요.</h2>
                  <p className="text-slate-500 text-sm">본 플랫폼은 변호사법 위반을 막기 위해 의뢰인이 직접 상담 조건과 대상을 설정해야 합니다.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Open Choice */}
                  <div 
                    onClick={() => {
                      setRequestType('open');
                      setSelectedLawyerId('');
                    }}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                      requestType === 'open' ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-base">참여형 다중 상담 (추천)</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal mb-2">
                      요청 건을 오픈해 놓으면, 채무 상황에 능통한 도산 전문 변호사들이 자발적으로 상담참여 버튼을 눌러 매칭됩니다.
                    </p>
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded">
                      최대 3인 변호사 한정 제한
                    </span>
                  </div>

                  {/* Direct Choice */}
                  <div 
                    onClick={() => {
                      setRequestType('direct');
                      if (lawyers.length > 0) setSelectedLawyerId(lawyers[0].id);
                    }}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                      requestType === 'direct' ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-5 h-5 text-indigo-600" />
                      <span className="font-bold text-base">특정 변호사 직접 선정</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal mb-2">
                      의뢰인이 프로필과 최근 수임 이력을 검토한 후 마음에 드는 단 한 명의 변호사를 직접 지명하여 조용하게 단독 진행합니다.
                    </p>
                    <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded">
                      1:1 비공개 상담 채널
                    </span>
                  </div>
                </div>

                {requestType === 'direct' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">상담을 전담할 인센티브 선임 변호사 지명:</label>
                    <select 
                      value={selectedLawyerId} 
                      onChange={(e) => setSelectedLawyerId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 sm:text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      {lawyers.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.region} | {l.fields.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button 
                    onClick={() => setRequestStep(2)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <span>수립 단계로 이동</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: FINANCIAL CALCULATOR */}
            {requestStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold mb-1">소득 및 채무 위기 수준을 기입해 주세요.</h2>
                    <p className="text-slate-500 text-sm">마이데이터 조회 연동으로 원클릭 기입 혹은 수기 작성이 모두 가능합니다.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={handleMyDataLoad}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg transition-colors border border-blue-200/50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
                    <span>마이데이터 채무 불러오기</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Income input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">월 평균 세후 실수령 소득 (만 원)</label>
                    <div className="relative rounded-md shadow-sm">
                      <input 
                        type="number" 
                        value={income}
                        onChange={(e) => setIncome(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400">만 원</div>
                    </div>
                  </div>

                  {/* Assets input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">보유 재산 합산 (부동산/예금 등, 만 원)</label>
                    <div className="relative rounded-md shadow-sm">
                      <input 
                        type="number" 
                        value={assetsTotal}
                        onChange={(e) => setAssetsTotal(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400">만 원</div>
                    </div>
                  </div>

                  {/* Dependents input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">부양 가족 수 (본인 제외, 명)</label>
                    <select 
                      value={dependents}
                      onChange={(e) => setDependents(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={0}>0명 (1인 가구 - 본인만)</option>
                      <option value={1}>1명 (2인 가구 - 부양 1인)</option>
                      <option value={2}>2명 (3인 가구 - 부양 2인)</option>
                      <option value={3}>3명 이상 (4인 이상 가구)</option>
                    </select>
                  </div>

                  {/* Marital status */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">결혼 여부</label>
                    <div className="flex gap-2">
                      {(['SINGLE', 'MARRIED', 'DIVORCED'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMaritalStatus(m)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                            maritalStatus === m 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {m === 'SINGLE' ? '미혼' : m === 'MARRIED' ? '기혼' : '이혼'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub Debt breakdown calculator */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-500" />
                    <span>채무 구조 상세 정보 기입</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">1금융권 은행 채무</label>
                      <input 
                        type="number" 
                        value={debtBanks} 
                        onChange={(e) => setDebtBanks(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs focus:ring-1" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">카드사 카드론/현금서비스</label>
                      <input 
                        type="number" 
                        value={debtCards} 
                        onChange={(e) => setDebtCards(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs focus:ring-1" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">저축은행/캐피탈/사채 등</label>
                      <input 
                        type="number" 
                        value={debtPersonals} 
                        onChange={(e) => setDebtPersonals(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs focus:ring-1" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-amber-500/5 p-2 rounded border border-amber-500/10">
                      <label className="block text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>최근 1년 이내 무리한 추가 대출 (만 원)</span>
                      </label>
                      <input 
                        type="number" 
                        value={recentLoans} 
                        onChange={(e) => setRecentLoans(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs focus:ring-1" 
                      />
                    </div>
                    <div className="bg-red-500/5 p-2 rounded border border-red-500/10">
                      <label className="block text-xs font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>사행성 손실 (주식/코인/도박 투자금, 만 원)</span>
                      </label>
                      <input 
                        type="number" 
                        value={coinCrypto} 
                        onChange={(e) => setCoinCrypto(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs focus:ring-1" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
                    <span className="text-slate-600 dark:text-slate-400 text-xs">상기 구조별 합산 채무액:</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {totalCalculatedDebt > 0 ? `${(totalCalculatedDebt / 10000).toFixed(2)}억 원 (${totalCalculatedDebt.toLocaleString()}만 원)` : `${(debtTotal / 10000).toFixed(2)}억 원 (${debtTotal.toLocaleString()}만 원)`}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button 
                    onClick={() => setRequestStep(1)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2 rounded-lg text-sm"
                  >
                    이전으로
                  </button>
                  <button 
                    onClick={() => setRequestStep(3)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <span>마지막 단계로 이동</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUBMIT */}
            {requestStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold mb-1">마지막으로 변호사가 파악할 상담내용을 기술해 주세요.</h2>
                  <p className="text-slate-500 text-sm">기존 독촉 상황이나 재산 압류 예정 여부를 기입하시면 가장 빠르고 명확한 솔루션이 가능합니다.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">상담 요약 한 줄 (제목)</label>
                    <input 
                      type="text" 
                      placeholder="예) 보증 채무 압류 독촉 대응과 가용 가계 소득 부족 상담 원함"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">구체적인 위기 사유 (설명)</label>
                    <textarea 
                      rows={5}
                      placeholder="돌려막기 여부, 현재 독촉 수준, 채권자 수, 거주 형태, 채무 형성 경로 등을 적어주시면 정확하고 법률적인 상담 변호사의 빠른 개입이 가능합니다."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <RequestDisclaimer />

                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="consentCheck"
                      checked={consentCheck}
                      onChange={(e) => setConsentCheck(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="consentCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 select-none cursor-pointer">
                      본인은 대리로 매칭을 청탁하지 않으며, 자율적인 상담 조건 설계에 상시 동의합니다. (필수 동의)
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => setRequestStep(2)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2 rounded-lg text-sm"
                  >
                    이전으로
                  </button>
                  <button 
                    onClick={handleRequestSubmit}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-2.5 rounded-lg flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>정식 채무 상담방 개설 등록</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
        {activeTab === 'lawyers' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">지역 필터:</span>
                <select 
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1"
                >
                  <option value="전체">전국 대응</option>
                  <option value="서울">서울</option>
                  <option value="서울/경기">서울/경기</option>
                  <option value="경기/수원">경기/수원</option>
                </select>
              </div>
            </div>

            {/* Grid of Lawyers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lawyers
                .filter(l => {
                  const queryLower = searchQuery.toLowerCase();
                  const matchesSearch = l.name.toLowerCase().includes(queryLower) || l.fields.some(f => f.toLowerCase().includes(queryLower)) || l.bio.toLowerCase().includes(queryLower);
                  const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
                  return matchesSearch && matchesRegion;
                })
                .map(l => (
                  <div key={l.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-4">
                    <img 
                      src={l.avatar} 
                      alt={l.name}
                      className="w-20 h-20 rounded-full object-cover bg-slate-100 dark:bg-slate-800 self-start sm:self-center"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{l.name}</h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{l.region} 법원 지원</span>
                        </div>
                        <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded">
                          수임 75건 이상
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">{l.bio}</p>

                      <div className="flex flex-wrap gap-1">
                        {l.fields.map(f => (
                          <span key={f} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded">
                            #{f}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{l.recentActivity}</span>
                        </span>

                        <button 
                          onClick={() => {
                            setRequestType('direct');
                            setSelectedLawyerId(l.id);
                            setRequestStep(1);
                            setActiveTab('request');
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors text-[11px]"
                        >
                          상담 신청하기
                        </button>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ACTIVE COUNSELING/CHAT WORKSPACE */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[650px] animate-fadeIn">
            
            {/* LEFT RAIL: ACTIVE REQUESTS */}
            <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">생성된 나의 상담 요청방</h3>
                <p className="text-slate-500 text-xs mt-0.5">상담 종류 및 매칭 여부를 확인할 수 있습니다.</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800_90 h-[400px]">
                {requests.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-slate-500 text-xs">작성 완료된 상담 요청 건이 현재 존재하지 않습니다.</p>
                    <button 
                      onClick={() => setActiveTab('request')}
                      className="text-xs text-blue-600 hover:underline font-bold"
                    >
                      지금 첫 상담 무료 신청하기 &rarr;
                    </button>
                  </div>
                ) : (
                  requests.map(r => {
                    const isSelected = r.id === activeChatReqId;
                    const styleLabel = r.requestType === 'direct' ? '1:1 전담지정' : '3인 오픈참여';
                    
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => setActiveChatReqId(r.id)}
                        className={`p-4 cursor-pointer transition-colors text-left space-y-1.5 ${
                          isSelected ? 'bg-blue-500/10 border-l-4 border-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                            r.requestType === 'direct' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {styleLabel}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">{r.title}</h4>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>총 부채 {r.financialProfile.debtTotal.toLocaleString()}만 원</span>
                          <span className={`font-semibold ${
                            r.status === 'requested' ? 'text-amber-600' : r.status === 'responding' ? 'text-blue-500' : 'text-emerald-600'
                          }`}>
                            {r.status === 'requested' ? '요청 대기' : r.status === 'responding' ? '변호사 응답중' : '활발한 상담중'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CHAT BOARD & RIGHT WINDOW */}
            {currentRequest ? (
              <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-slate-900">
                {/* Header of Chat */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block">ACTIVE PREVIEW</span>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{currentRequest.title}</h3>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>상담 방 개방일: {new Date(currentRequest.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40">
                  <ChatDisclaimer />
                </div>

                {/* Messages feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[350px]">
                  {/* Embedded Client Profile details summary for Lawyers to see, and client to review */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] text-blue-600 dark:text-blue-400">
                      📝 자가진단 분석 요약표 (변호사 열람 서류)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <div>• 월실수령액: <strong className="text-slate-800 dark:text-slate-200">{currentRequest.financialProfile.income}만 원</strong></div>
                      <div>• 총 채무: <strong className="text-slate-800 dark:text-slate-100">{currentRequest.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                      <div>• 부양가족: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.dependents}명</strong></div>
                      <div>• 결혼: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : '기혼'}</strong></div>
                    </div>
                    {currentRequest.financialProfile.riskFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                        {currentRequest.financialProfile.riskFlags.map(rf => (
                          <span key={rf} className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[9px] px-1.5 py-0.5 rounded leading-none">
                            🚨 {rf}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {activeChatMessages.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      상담이 이제 막 생성되었습니다. 대화를 시작해 보세요.
                    </div>
                  ) : (
                    activeChatMessages.map(m => {
                      const isMe = m.senderType === 'client';
                      return (
                        <div 
                          key={m.id} 
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-350">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          <div className={`p-3 rounded-xl max-w-md text-xs leading-relaxed ${
                            isMe 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="담당 변호사에게 메세지 전송..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChat();
                    }}
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    onClick={handleSendChat}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 flex flex-col items-center justify-center p-8 text-center space-y-3 h-full bg-white dark:bg-slate-900">
                <Users className="w-12 h-12 text-slate-300" />
                <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">활성화된 상담 채널이 없습니다</h3>
                <p className="text-slate-500 text-xs max-w-sm">
                  새 상담을 접수하거나 왼쪽 레일에서 진행 중인 대화방을 선택해 자율 매칭 상황을 모니터링할 수 있습니다.
                </p>
                <button 
                  onClick={() => setActiveTab('request')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  상담 신청하기
                </button>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Subtle Bottom legal status line */}
      <footer className="bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center py-4 text-[10px] text-slate-500 space-y-1">
        <p>© 2026 개인회생·파산 법률 상담 요청 기반 Legal CRM SaaS 플랫폼. All rights reserved.</p>
        <p>본 플랫폼은 변호사법 제34조에 의거 변호사 알선료, 수수료 수취를 금지하는 공공 가이드라인 구조를 채택해 운영 중입니다.</p>
      </footer>

    </div>
  );
}
