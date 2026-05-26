import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronRight, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X
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
  
  // Home Landing States
  const [calcIncome, setCalcIncome] = useState<number>(250);
  const [calcDebt, setCalcDebt] = useState<number>(7000);
  const [calcDependents, setCalcDependents] = useState<number>(0);
  const [bannerIndex, setBannerIndex] = useState<number>(0);
  const [openedQaId, setOpenedQaId] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');

  // User Auth & Privacy States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [alertMode, setAlertMode] = useState<'NORMAL' | 'STEALTH' | 'SECRET'>('STEALTH');
  const [senderNameOverride, setSenderNameOverride] = useState<string>('원케어');
  const [panicButtonEnabled, setPanicButtonEnabled] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [isPanicState, setIsPanicState] = useState<boolean>(false);

  // OTP and Verification Simulation States
  const [authPhone, setAuthPhone] = useState<string>('');
  const [authOtp, setAuthOtp] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(180);
  const [otpError, setOtpError] = useState<string>('');
  const [otpSuccess, setOtpSuccess] = useState<boolean>(false);
  const [authConsent, setAuthConsent] = useState<boolean>(false);

  useEffect(() => {
    let timer: number;
    if (otpSent && otpCountdown > 0 && !otpSuccess) {
      timer = window.setInterval(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    } else if (otpCountdown === 0) {
      setOtpSent(false);
      setOtpError('인증 시간이 만료되었습니다. 다시 시도해 주세요.');
    }
    return () => window.clearInterval(timer);
  }, [otpSent, otpCountdown, otpSuccess]);
  
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

  // Banner Carousel Data
  const banners = [
    {
      title: "빚 독촉의 고통, 오늘 끊을 수 있습니다.",
      subtitle: "개인회생 신청 즉시 법원의 금지명령으로 빗발치는 독촉 전화, 추심 방문, 급여 압류가 전면 금지됩니다. 늦기 전에 골든타임을 확보하세요.",
      badge: "신속한 독촉 차단",
      color: "from-blue-900 via-indigo-950 to-slate-950"
    },
    {
      title: "코인·주식 투자 실패도 최대 90% 탕감 가능",
      subtitle: "단순 과장 광고가 아닙니다. 최근 개정된 회생 법원 실무 기준에 맞추어 투자 손실을 최소화하는 개인회생 계획안을 수립합니다.",
      badge: "투자 실패 부채 전문",
      color: "from-indigo-950 via-slate-900 to-slate-950"
    },
    {
      title: "알선료 수수료 0%! 투명한 도산 전문 변호사 매칭",
      subtitle: "본 플랫폼은 불법 사무장 브로커를 철저히 배제하고 법률적 책임이 보장된 정식 변호사단으로만 투명하게 운영됩니다.",
      badge: "변호사법 제34조 준수",
      color: "from-slate-950 via-blue-950 to-indigo-950"
    }
  ];

  // Banner rotation logic
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Panic Mode keyboard shortcut (F2 or double-press Escape)
  useEffect(() => {
    let escapePressCount = 0;
    let escapeTimer: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLoggedIn || !panicButtonEnabled) return;

      if (e.key === 'F2') {
        e.preventDefault();
        setIsPanicState(true);
      } else if (e.key === 'Escape') {
        escapePressCount++;
        if (escapePressCount === 2) {
          setIsPanicState(true);
          escapePressCount = 0;
        }
        window.clearTimeout(escapeTimer);
        escapeTimer = window.setTimeout(() => {
          escapePressCount = 0;
        }, 400);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(escapeTimer);
    };
  }, [isLoggedIn, panicButtonEnabled]);

  // Customized Q&As for Rehabilitation/Bankruptcy (로톡 상담사례 스타일)
  const mockQAs = [
    {
      id: 'qa-1',
      category: '코인/주식 손실',
      question: '코인 투자 실패로 진 빚 8천만 원, 회생 진행 시 탕감이 가능할까요?',
      author: '김*현 (직장인)',
      answer: '주식이나 가상화폐 투자로 인한 손실도 개인회생 신청 대상이 됩니다. 특히 서울회생법원의 경우 실무준칙에 의거하여 투자 손실금 자체를 청산가치에 강제로 반영하지 않도록 유예해주고 있어 변제액을 낮추는 데 매우 유리합니다. 다만 추가 대출 시점이나 최근 채무 비율에 따라 변동 소지가 있으므로 전문 소명서 준비가 관건입니다.',
      lawyerName: '이소민 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      badge: '추천 답변'
    },
    {
      id: 'qa-2',
      category: '급여 압류',
      question: '회사를 다니는 도중 월급 가압류 예정 통지서를 받았습니다. 직장에 소문 안 나고 차단할 수 있나요?',
      author: '박*수 (사무직)',
      answer: '법률 대리인을 통해 개인회생 신청서와 동시에 "금지명령 및 중지명령"을 법원에 접수하면 대개 3~7일 내에 결정문이 발령됩니다. 금지명령이 채권자에게 송달되면 급여 압류 및 독촉 행위가 법적으로 일절 금지됩니다. 직장에 직접 압류 협박 전화가 오는 것도 원천 차단되므로 신속히 개입하셔야 합니다.',
      lawyerName: '김우진 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
      badge: '실시간 답변'
    },
    {
      id: 'qa-3',
      category: '프리랜서 회생',
      question: '배달 대행 프리랜서인데 4대 보험이 안 되어도 개인회생 신청이 가능한가요?',
      author: '이*우 (플랫폼 노동자)',
      answer: '네, 가능합니다. 개인회생은 고용 형태(정규직, 계약직, 일용직, 프리랜서)에 상관없이 정기적이고 확실한 수입(최저생계비 이상)이 있음을 소득 서류로 입증할 수 있다면 신청이 가능합니다. 3.3% 원천징수 영수증이나 입금 계좌 내역, 플랫폼 활동 정산 내역 등을 토대로 평균 소득을 산출하여 개시를 받아낼 수 있습니다.',
      lawyerName: '최덕중 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
      badge: '전문가 소견'
    }
  ];

  // Routing and pre-filling request form from category grid
  const handleCategoryClick = (category: string) => {
    // Reset specific breakdowns
    setDebtBanks(0);
    setDebtCards(0);
    setDebtPersonals(0);
    setRecentLoans(0);
    setCoinCrypto(0);

    if (category === 'card_loan') {
      setTitle('신용카드 및 카드론 연체 독촉 위기 해결 상담');
      setContent('신용카드 사용액 및 카드론 돌려막기로 인해 채무가 눈덩이처럼 늘어났습니다. 연체가 시작되어 채권 독촉 전화를 받고 있으며, 개인회생을 통해 월 납입금을 조정하고 독촉을 즉시 정지시키고 싶습니다.');
      setDebtCards(3500);
      setDebtBanks(1500);
      setDebtTotal(5000);
      setIncome(230);
    } else if (category === 'bank_loan') {
      setTitle('시중은행 신용대출 및 마이너스 통장 연체 회생');
      setContent('직장인 신용대출 및 마이너스 통장 만기 연장이 불가능하다는 통보를 받아 일시 상환 압박을 받고 있습니다. 월급 수준으로는 상환이 불가능해 개인회생 신청이 가능한지 긴급히 상담받고 싶습니다.');
      setDebtBanks(5000);
      setDebtTotal(5000);
      setIncome(250);
    } else if (category === 'high_interest') {
      setTitle('고금리 사채 및 대부업 채무 통합 해결');
      setContent('저축은행, 캐피탈 뿐만 아니라 사채 및 등록 대부업체로부터 고금리 대출을 받았습니다. 무리한 채권자들의 상환 독촉 및 일상생활 위협을 겪고 있어 개인회생 금지명령으로 보호받고자 합니다.');
      setDebtPersonals(3000);
      setDebtCards(1000);
      setDebtTotal(4000);
      setIncome(200);
    } else if (category === 'guarantee') {
      setTitle('연대보증 채무 독촉에 따른 개인회생 대응');
      setContent('주채무자의 도산 및 연락 두절로 인해 연대보증인인 저에게 전액 청구 독촉이 들어왔습니다. 급여 가압류 통지서가 날아온 상태이며, 주위 사실 노출 없이 해결 가능한 개인회생을 긴급히 신청하고자 합니다.');
      setDebtBanks(6000);
      setDebtPersonals(2000);
      setDebtTotal(8000);
      setIncome(350);
    } else if (category === 'investment') {
      setTitle('주식 및 가상화폐(코인) 투자 실패 채무 탕감');
      setContent('비트코인 선물 거래 및 주식 레버리지 투자 실패로 큰 빚을 지게 되었습니다. 최근 대출 비중이 높아 법원의 기각이나 청산가치 반영 비율이 걱정됩니다. 투자 채무 탕감 성공 경험이 많은 변호사의 조력을 구합니다.');
      setCoinCrypto(4000);
      setDebtBanks(3000);
      setRecentLoans(2000);
      setDebtTotal(9000);
      setIncome(280);
    } else if (category === 'freelancer') {
      setTitle('일용직/프리랜서 부정기 소득자의 개인회생');
      setContent('프리랜서 및 일용직 노동자로 근무하여 매달 소득이 불규칙합니다. 소득 증빙 서류 준비와 월 가용 소득 산정 기준이 애매해 상담을 원합니다. 개인회생 개시 조건에 맞는 최적의 소득 소명을 진행하고 싶습니다.');
      setIncome(180);
      setDebtTotal(3500);
      setDebtCards(1500);
      setDebtBanks(2000);
    } else if (category === 'seizure') {
      setTitle('급여/가압류/통장 압류 해제 및 중지 명령 신청');
      setContent('채권자동에 의한 예금 통장 압류 및 직장 급여 가압류 결정문이 송달되었습니다. 당장 가계 생계비 지출이 불가능해, 개인회생 접수와 함께 중지/금지명령을 통해 압류를 해제하고 생업을 유지하고 싶습니다.');
      setDebtBanks(4000);
      setDebtCards(2000);
      setDebtTotal(6000);
      setIncome(240);
    } else if (category === 'bankruptcy') {
      setTitle('고령/폐업 자영업자 개인파산 및 면책 신청');
      setContent('질병 및 건강 악화, 혹은 사업 실패로 인해 앞으로 전혀 소득 활동을 할 수 없는 상황입니다. 보유 재산보다 빚이 훨씬 많아 더 이상 생계 및 상환을 지속할 수 없기에 개인파산을 통한 전액 면책을 희망합니다.');
      setIncome(80);
      setDebtTotal(7500);
      setDebtPersonals(3500);
      setDebtBanks(4000);
      setRequestType('direct');
      if (lawyers.length > 0) setSelectedLawyerId(lawyers[2].id);
    }

    setRequestStep(2);
    setActiveTab('request');
  };

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
      clientName: isLoggedIn ? `${userAlias} (의뢰인)` : '익명 의뢰인',
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
    onAddMessage(activeChatReqId, chatInput.trim(), 'client', 'client-temp', isLoggedIn ? `${userAlias} (본인)` : '의뢰인 (본인)');
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

  // Simulated Auth and Security Handlers
  const handleSocialLogin = (platform: string) => {
    if (!authConsent) {
      alert('필수 개인정보 및 마이데이터 수집 이용 동의를 체크해 주세요.');
      return;
    }
    setTimeout(() => {
      setIsLoggedIn(true);
      const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
      setUserAlias(generatedAlias);
      setShowAuthModal(false);
      setAuthPhone('');
      setAuthOtp('');
      setOtpSent(false);
      setOtpError('');
      alert(`[안내] ${platform} 계정 연동 및 간편 회원가입이 완료되었습니다!\n개인 정보 보호를 위해 의뢰인 식별명은 가명 '${generatedAlias}'으로 자동 생성되었습니다.`);
    }, 400);
  };

  const handleSendOtp = () => {
    if (!authPhone.trim()) {
      setOtpError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (!authConsent) {
      setOtpError('필수 개인정보 수집 이용 동의를 체크해 주세요.');
      return;
    }
    setOtpError('');
    setOtpSent(true);
    setOtpCountdown(180);
    alert('[가상 인증 번호 발송]\n본인인증을 위한 6자리 코드 [777777]이 화면에 임시 발송되었습니다. 입력란에 기입해 주세요.');
  };

  const handleVerifyOtp = () => {
    if (authOtp === '777777') {
      setIsLoggedIn(true);
      const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
      setUserAlias(generatedAlias);
      setShowAuthModal(false);
      setOtpSent(false);
      setOtpError('');
      setAuthPhone('');
      setAuthOtp('');
      alert(`[인증 성공] 안전하게 로그인이 활성화 완료되었습니다!\n배정된 가명: ${generatedAlias}`);
    } else {
      setOtpError('인증번호가 일치하지 않습니다. (가상 테스트용 코드: 777777)');
    }
  };

  const handleRegenAlias = () => {
    const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
    setUserAlias(generatedAlias);
  };

  // Helper values
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  // Formatted calculation
  const totalCalculatedDebt = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;

  if (isPanicState) {
    return (
      <div className="flex flex-col min-h-screen bg-sky-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer select-none"
              onDoubleClick={() => {
                setIsPanicState(false);
              }}
              title="더블클릭하여 원래 화면으로 복구"
            >
              <Activity className="w-5 h-5 text-sky-500 animate-pulse" />
              <span className="font-extrabold text-base tracking-tight text-slate-800 dark:text-white">실시간 전국 날씨 예보</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 rounded font-bold">
                실시간 기상청 위성 연동
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6 text-left">
          {/* Main Weather Card */}
          <div className="bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 text-white rounded-3xl p-6 md:p-8 shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-300/30 rounded-full blur-2xl"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">현재 위치</span>
                <h2 className="text-2xl md:text-3xl font-extrabold flex items-center gap-1.5">
                  서울특별시 서초구 서초동
                </h2>
                <p className="text-xs text-sky-100">최근 업데이트: 오늘 14:02 (실시간 예보)</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-5xl md:text-6xl font-black tracking-tighter">21.5°C</div>
                  <div className="text-sm font-bold text-sky-100">구름 조금, 맑음 (체감 22.0°C)</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 text-xs">
              <div className="bg-white/10 p-3 rounded-2xl">
                <span className="text-sky-200 block mb-0.5">미세먼지</span>
                <strong className="text-sm font-bold">15 ㎍/㎥ (좋음)</strong>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <span className="text-sky-200 block mb-0.5">초미세먼지</span>
                <strong className="text-sm font-bold">8 ㎍/㎥ (좋음)</strong>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <span className="text-sky-200 block mb-0.5">강수확률</span>
                <strong className="text-sm font-bold">10%</strong>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <span className="text-sky-200 block mb-0.5">습도/바람</span>
                <strong className="text-sm font-bold">45% / 북서풍 2.1 m/s</strong>
              </div>
            </div>
          </div>

          {/* Forecast layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Hourly Forecast */}
            <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">시간별 기온 추이</h3>
              <div className="flex justify-between gap-2 overflow-x-auto pb-2">
                {[
                  { time: '14:00', temp: '21.5°', state: '맑음', active: true },
                  { time: '16:00', temp: '22.0°', state: '맑음' },
                  { time: '18:00', temp: '19.5°', state: '구름조금' },
                  { time: '20:00', temp: '17.2°', state: '흐림' },
                  { time: '22:00', temp: '15.0°', state: '비' },
                  { time: '24:00', temp: '13.8°', state: '비' }
                ].map((h, idx) => (
                  <div key={idx} className={`flex flex-col items-center p-3 rounded-2xl min-w-[70px] ${h.active ? 'bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-850 text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500'}`}>
                    <span className="text-[10px]">{h.time}</span>
                    <span className="text-sm font-extrabold my-2">{h.temp}</span>
                    <span className="text-[10px]">{h.state}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Forecast */}
            <div className="md:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">주간 일기 예보</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {[
                  { day: '내일 (수)', temp: '14° / 23°', state: '맑음' },
                  { day: '목요일', temp: '12° / 20°', state: '비' },
                  { day: '금요일', temp: '11° / 21°', state: '맑음' },
                  { day: '토요일', temp: '13° / 24°', state: '구름조금' },
                  { day: '일요일', temp: '14° / 22°', state: '흐림' }
                ].map((w, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-400">{w.day}</span>
                    <span className="text-slate-400">{w.state}</span>
                    <span className="font-bold">{w.temp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weather News / Information */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">기상 속보 & 알림</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300">
                <strong>[특보] 건조주의보 발령:</strong> 일부 경기 내륙 및 강원 산지 대기가 매우 건조하오니 산불 예방 등 화재에 각별히 유의하시기 바랍니다.
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                • <strong>주간 전망:</strong> 목요일 서해상에서 발달하는 비구름대의 영향으로 전국적으로 비가 내리겠으며, 비가 그친 후에는 북서쪽의 찬 공기가 유입되어 기온이 큰 폭으로 떨어질 예정입니다.
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center py-6 text-[10px] text-slate-400 relative">
          <p>© 2026 기상청 국가기상포털 시스템 정보 연동 서비스. All rights reserved.</p>
          <button 
            onClick={() => setIsPanicState(false)}
            className="absolute right-4 bottom-4 text-slate-300 hover:text-slate-500 dark:text-slate-800 dark:hover:text-slate-600 text-[9px] font-semibold transition-colors"
          >
            복구
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* Dynamic Client Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold tracking-wider">CLIENT</span>
            <span className="font-bold text-lg text-slate-800 dark:text-slate-150">개인회생·파산 의뢰인 센터</span>
          </div>

          <nav className="flex items-center gap-1.5">
            <button 
              onClick={() => setActiveTab('landing')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'landing' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              홈 / 안내
            </button>
            <button 
              onClick={() => setActiveTab('request')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'request' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              상담 신청
            </button>
            <button 
              onClick={() => setActiveTab('lawyers')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'lawyers' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              변호사 찾기
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'chat' ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold' : 'text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              내 상담방
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
            </button>

            {/* Auth section */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-850">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    👤 <span className="text-blue-600 dark:text-blue-400">{userAlias}</span>님
                  </span>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded font-semibold leading-none">
                    스텔스 보호중
                  </span>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="스텔스 & 보안 설정"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setIsLoggedIn(false);
                    setUserAlias('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="ml-2 flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>로그인/회원가입</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* TAB 1: LANDING & INTRO */}
        {activeTab === 'landing' && (
          <div className="space-y-10 animate-fadeIn text-left">
            
            {/* 1. Search Box (Lawtalk Search Bar Style) */}
            <div className="text-center py-4 max-w-2xl mx-auto space-y-4">
              <h2 className="text-xl md:text-3xl font-extrabold text-slate-800 dark:text-white leading-tight">
                어떤 채무 고민을 겪고 계신가요?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                개인회생·파산 법원 지원 자격 진단 및 도산 법률 대리인 매칭 서비스
              </p>
              
              <div className="relative flex items-center bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl shadow-md px-4 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Search className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="예: 신용카드 연체, 최근 대출 30%, 코인 실패"
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm py-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                {homeSearchQuery && (
                  <button
                    onClick={() => setHomeSearchQuery('')}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 font-semibold"
                  >
                    지우기
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-400">자주 찾는 키워드:</span>
                <button onClick={() => handleCategoryClick('investment')} className="bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 transition-colors font-medium">#코인실패</button>
                <button onClick={() => handleCategoryClick('seizure')} className="bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 transition-colors font-medium">#급여압류</button>
                <button onClick={() => handleCategoryClick('high_interest')} className="bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 transition-colors font-medium">#대부업독촉</button>
                <button onClick={() => handleCategoryClick('bankruptcy')} className="bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 transition-colors font-medium">#고령파산</button>
              </div>
            </div>

            {/* 2. Hero Section: Sliding Banner & Quick Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Banner Slider */}
              <div className={`lg:col-span-8 bg-gradient-to-br ${banners[bannerIndex].color} text-white p-6 md:p-10 rounded-2xl shadow-lg border border-slate-800/40 flex flex-col justify-between relative overflow-hidden transition-all duration-700 ease-in-out min-h-[250px]`}>
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                
                <div className="space-y-3.5 z-10 text-left">
                  <span className="bg-blue-600/90 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-blue-400/30">
                    {banners[bannerIndex].badge}
                  </span>
                  <h1 className="text-xl md:text-3xl font-extrabold tracking-tight leading-snug">
                    {banners[bannerIndex].title}
                  </h1>
                  <p className="text-slate-300 text-xs md:text-sm max-w-xl leading-relaxed">
                    {banners[bannerIndex].subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-6 z-10">
                  <div className="flex gap-1.5">
                    {banners.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setBannerIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === bannerIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                    }}
                    className="text-xs text-white hover:text-blue-300 font-semibold flex items-center gap-1 group"
                  >
                    <span>신청 바로가기</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Quick Actions (Right Column) */}
              <div className="lg:col-span-4 grid grid-cols-1 gap-3.5">
                
                {/* 3분 자가진단 */}
                <a
                  href="#self-calc-widget"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">3분 자가진단</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">내 빚 탕감액 미리보기</h4>
                    <p className="text-[11px] text-slate-500">소득, 채무만 입력하면 예상 변제금 계산</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Activity className="w-5 h-5" />
                  </div>
                </a>

                {/* 1:1 지정 변호사 */}
                <button
                  onClick={() => setActiveTab('lawyers')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group"
                >
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">변호사 프로필</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">1:1 지정 변호사 상담</h4>
                    <p className="text-[11px] text-slate-500">최근 법원별 성공 수임 사례 직접 확인</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <User className="w-5 h-5" />
                  </div>
                </button>

                {/* 3인 다중매칭 */}
                <button
                  onClick={() => {
                    setRequestType('open');
                    setRequestStep(1);
                    setActiveTab('request');
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group"
                >
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">신속하고 편리하게</span>
                    <h4 className="font-extrabold text-sm">참여형 3인 무료 매칭</h4>
                    <p className="text-[11px] text-blue-100">최대 3인의 변호사 의견 동시에 진단</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Users className="w-5 h-5" />
                  </div>
                </button>

              </div>
            </div>

            {/* 3. Category Grid (Customized for Rehabilitation/Bankruptcy) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-blue-600" />
                  <span>채무 상황별 자격 진단 & 상담</span>
                </h3>
                <span className="text-xs text-slate-400">채무 유형을 선택하시면 변호사가 즉각 검토 가능한 상태가 구성됩니다</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* 1. 신용카드 */}
                <div
                  onClick={() => handleCategoryClick('card_loan')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">신용카드/카드론 연체</h5>
                    <p className="text-[10px] text-slate-400">리볼빙·돌려막기 한계 도달</p>
                  </div>
                </div>

                {/* 2. 은행 대출 */}
                <div
                  onClick={() => handleCategoryClick('bank_loan')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">은행 신용대출 연체</h5>
                    <p className="text-[10px] text-slate-400">기한이익 상실 및 원금상환</p>
                  </div>
                </div>

                {/* 3. 대부업 */}
                <div
                  onClick={() => handleCategoryClick('high_interest')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">대부업/고금리 사채</h5>
                    <p className="text-[10px] text-slate-400">가혹한 추심 행위 즉시 방어</p>
                  </div>
                </div>

                {/* 4. 연대보증 */}
                <div
                  onClick={() => handleCategoryClick('guarantee')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">연대보증 채무 위기</h5>
                    <p className="text-[10px] text-slate-400">지인 채무 전가 완벽 대처</p>
                  </div>
                </div>

                {/* 5. 주식 코인 */}
                <div
                  onClick={() => handleCategoryClick('investment')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">주식/코인 투자 손실</h5>
                    <p className="text-[10px] text-slate-400">탕감률 극대화 실무준칙 설계</p>
                  </div>
                </div>

                {/* 6. 일용직/프리랜서 */}
                <div
                  onClick={() => handleCategoryClick('freelancer')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">일용직/프리랜서 회생</h5>
                    <p className="text-[10px] text-slate-400">불규칙한 월소득 적법 소명</p>
                  </div>
                </div>

                {/* 7. 급여 압류 */}
                <div
                  onClick={() => handleCategoryClick('seizure')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">급여/재산 압류 해제</h5>
                    <p className="text-[10px] text-slate-400">압류 중지·해제명령 긴급신청</p>
                  </div>
                </div>

                {/* 8. 개인파산 */}
                <div
                  onClick={() => handleCategoryClick('bankruptcy')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">개인파산/면책 신청</h5>
                    <p className="text-[10px] text-slate-400">무직·고령·질병 전액 탕감</p>
                  </div>
                </div>

              </div>
            </div>

            {/* 4. Instant Self-Rehabilitation Calculator Widget */}
            <div id="self-calc-widget" className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-lg border border-slate-800 p-6 md:p-8 space-y-6 text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    실시간 자가진단 계산기
                  </span>
                  <h3 className="text-lg md:text-xl font-extrabold">나의 예상 개인회생 탕감액 조회</h3>
                </div>
                <p className="text-xs text-slate-400 leading-normal max-w-sm">
                  소득과 채무, 부양가족 수에 따른 최저생계비를 대입하여 법원에서 인정받을 수 있는 최적의 예상 탕감액과 변제율을 가계산합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Sliders */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Income Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">월 평균 세후 실수령 소득</span>
                      <span className="font-bold text-blue-400 text-sm">{calcIncome}만 원</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="800"
                      step="10"
                      value={calcIncome}
                      onChange={(e) => setCalcIncome(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>100만 원</span>
                      <span>450만 원</span>
                      <span>800만 원</span>
                    </div>
                  </div>

                  {/* Debt Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">총 채무액 (대출, 카드론, 주식/코인 손실 등)</span>
                      <span className="font-bold text-amber-400 text-sm">
                        {calcDebt >= 10000 ? `${(calcDebt / 10000).toFixed(2)}억 원` : ''} ({calcDebt.toLocaleString()}만 원)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="30000"
                      step="500"
                      value={calcDebt}
                      onChange={(e) => setCalcDebt(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>1,000만 원</span>
                      <span>1.5억 원</span>
                      <span>3억 원</span>
                    </div>
                  </div>

                  {/* Dependents Select */}
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-300 font-medium mb-1">부양 가족 수 (본인 제외)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCalcDependents(num)}
                          className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                            calcDependents === num
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {num === 0 ? '0명 (1인 가구)' : `${num}명 (${num+1}인 가구)`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculation Results */}
                <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  {(() => {
                    const minLivingCost = calcDependents === 0 ? 133 : calcDependents === 1 ? 221 : calcDependents === 2 ? 282 : 343;
                    const monthlyRepayment = Math.max(0, calcIncome - minLivingCost);
                    const totalRepayment = Math.min(calcDebt, monthlyRepayment * 36);
                    const totalReduction = Math.max(0, calcDebt - totalRepayment);
                    const reductionRate = calcDebt > 0 ? Math.round((totalReduction / calcDebt) * 100) : 0;
                    
                    const isBankruptcyApplicable = monthlyRepayment <= 0;

                    return (
                      <>
                        <div className="space-y-3 text-left">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block border-b border-slate-800 pb-1.5">
                            🔍 1차 자격 진단 리포트
                          </span>
                          
                          <div className="space-y-2 text-xs text-slate-300">
                            <div className="flex justify-between">
                              <span>보건복지부 고시 최저생계비:</span>
                              <strong className="text-white">{minLivingCost}만 원</strong>
                            </div>
                            
                            {isBankruptcyApplicable ? (
                              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-[11px] text-red-300 font-semibold leading-normal">
                                ⚠️ 월 소득이 법정 최저생계비보다 적습니다. 이 경우 변제금 납부 대신 채무 전액을 탕감받는 **개인파산 면책 신청**이 가장 유리합니다!
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between">
                                  <span>예상 월 가용 변제금 (36개월):</span>
                                  <strong className="text-blue-400">{monthlyRepayment.toLocaleString()}만 원 / 월</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>예상 총 변제액:</span>
                                  <strong className="text-white">{Math.round(totalRepayment).toLocaleString()}만 원</strong>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {!isBankruptcyApplicable && (
                          <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl text-center space-y-1">
                            <span className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">법적 탕감 비율</span>
                            <div className="text-2xl font-extrabold text-blue-400">
                              약 {reductionRate}% 탕감 예정
                            </div>
                            <p className="text-xs text-slate-400">
                              (총 채무 중 약 <strong className="text-white">{Math.round(totalReduction).toLocaleString()}만 원</strong> 감면)
                            </p>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setIncome(calcIncome);
                              setDebtTotal(calcDebt);
                              setDependents(calcDependents);
                              // Pre-fill fields based on calculation
                              setTitle(`자가진단 계산기 연동 개인회생 신청 상담`);
                              setContent(`자가진단 계산기 실행 결과:\n- 월 세후 소득: ${calcIncome}만 원\n- 총 부채액: ${calcDebt}만 원\n- 부양가족 수: ${calcDependents}명 (${calcDependents + 1}인 가구)\n\n상기 수치 데이터를 기반으로 법정 개시가 안전하게 가능한 구조인지, 추가적인 탕감율 극대화 전략에 대한 도산 전문 변호사의 상담을 신청합니다.`);
                              setRequestStep(3); // Go to final submit step
                              setActiveTab('request');
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-4 h-4" />
                            <span>이 계산 결과로 바로 상담 신청하기</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 5. Live Q&A Case Studies (Lawtalk Style) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  <span>실시간 고민 해결 상담사례</span>
                </h3>
                <span className="text-xs text-slate-400">도산 전문 변호사들이 직접 해결한 최근 고민 사례들입니다</span>
              </div>

              <div className="space-y-3.5">
                {mockQAs
                  .filter(qa => {
                    if (!homeSearchQuery) return true;
                    const query = homeSearchQuery.toLowerCase();
                    return qa.question.toLowerCase().includes(query) || qa.category.toLowerCase().includes(query) || qa.answer.toLowerCase().includes(query);
                  })
                  .map(qa => {
                    const isOpen = openedQaId === qa.id;
                    return (
                      <div
                        key={qa.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm"
                      >
                        {/* Header */}
                        <div
                          onClick={() => setOpenedQaId(isOpen ? null : qa.id)}
                          className="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-start justify-between gap-4"
                        >
                          <div className="space-y-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-450 text-[9px] font-extrabold px-2.5 py-0.5 rounded-md">
                                {qa.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {qa.author}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-850 dark:text-slate-200 pr-4 leading-snug">
                              Q. {qa.question}
                            </h4>
                          </div>
                          
                          <span className="text-xs font-bold text-blue-500 shrink-0 select-none pt-1">
                            {isOpen ? '닫기 ▲' : '답변보기 ▼'}
                          </span>
                        </div>

                        {/* Answer Details */}
                        {isOpen && (
                          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4 bg-slate-50/50 dark:bg-slate-950/20 text-left space-y-4 animate-slideDown">
                            <div className="flex items-start gap-3">
                              <img
                                src={qa.lawyerAvatar}
                                alt={qa.lawyerName}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0"
                              />
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-slate-850 dark:text-white">{qa.lawyerName}</span>
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold px-2 py-0.5 rounded-md">전문가 답변</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal pt-1.5 whitespace-pre-wrap text-left">
                                  {qa.answer}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => {
                                  // Pre-fill question context
                                  setTitle(`${qa.category} 관련 법률 상담 신청`);
                                  setContent(`고민 사례 질문:\nQ. ${qa.question}\n\n위의 Q&A 고민 사례를 확인하고 저에게 동일하게 적용될 수 있는 법리적 가능성을 상담받고 싶습니다. 변호사님의 정밀 가이드가 필요합니다.`);
                                  setRequestStep(3); // Go directly to submit step
                                  setActiveTab('request');
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-[10px] transition-colors"
                              >
                                이 변호사에게 유사건 즉시 상담 신청
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

      {/* Auth Modal (로그인 / 회원가입) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 space-y-5 relative overflow-hidden text-left animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  의뢰인 스텔스 보안
                </span>
                <h3 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">로그인 및 회원가입</h3>
                <p className="text-xs text-slate-500 mt-1">
                  채무 사실 노출을 막기 위해 가명 닉네임과 가명 발신자 알림 시스템이 자동으로 활성화됩니다.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAuthModal(false);
                  setOtpSent(false);
                  setOtpError('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Social Logins */}
            <div className="space-y-2.5 pt-2">
              <button 
                onClick={() => handleSocialLogin('Google')}
                className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span>
                <span>Google로 간편 로그인</span>
              </button>

              <button 
                onClick={() => handleSocialLogin('카카오')}
                className="w-full bg-[#FEE500] hover:bg-[#FEE500]/95 text-[#191919] font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-extrabold text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full">K</span>
                <span>카카오로 간편 로그인</span>
              </button>

              <button 
                onClick={() => handleSocialLogin('네이버')}
                className="w-full bg-[#03C75A] hover:bg-[#03C75A]/95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-black text-xs bg-white text-[#03C75A] rounded-full">N</span>
                <span>네이버로 간편 로그인</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold">또는 휴대폰 인증번호 로그인</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            {/* Phone Login Form */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">휴대폰 번호</label>
                <div className="flex gap-2">
                  <input 
                    type="tel"
                    placeholder="010-1234-5678"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    disabled={otpSent}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleSendOtp}
                    disabled={otpSent}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  >
                    {otpSent ? '발송 완료' : '인증번호 발송'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2 animate-slideDown">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">인증번호 6자리</label>
                    <span className="text-[11px] text-red-500 font-bold">
                      {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="인증번호 6자리 입력 (777777)"
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value)}
                      maxLength={6}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      onClick={handleVerifyOtp}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0"
                    >
                      인증 및 로그인
                    </button>
                  </div>
                </div>
              )}

              {otpError && <p className="text-xs text-red-500 font-semibold">{otpError}</p>}
            </div>

            {/* Terms Consent */}
            <div className="flex items-start gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input 
                type="checkbox" 
                id="authConsent" 
                checked={authConsent}
                onChange={(e) => setAuthConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
              />
              <label htmlFor="authConsent" className="text-[11px] text-slate-600 dark:text-slate-400 select-none cursor-pointer leading-normal">
                <strong>(필수)</strong> 개인정보 제3자 제공 및 신용정보원 마이데이터 대출/연체 정보 조회 동의서에 동의합니다.
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (스텔스 & 보안 설정) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden text-left animate-fadeIn">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  스텔스 설정
                </span>
                <h3 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">보안 및 스텔스 설정</h3>
                <p className="text-xs text-slate-500 mt-1">
                  휴대폰 화면 노출을 완전 차단하고, 법률 용어가 들어간 메세지를 일반 안내로 우회합니다.
                </p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-1">
              {/* Alias generation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">의뢰인 가명 설정 (변호사 노출명)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={userAlias}
                    onChange={(e) => setUserAlias(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    onClick={handleRegenAlias}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 rounded-xl text-xs transition-colors shrink-0 border border-slate-200 dark:border-slate-700"
                  >
                    가명 재발급
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  * 실명이 아닌 법적 효력이 무관한 임의의 식별 닉네임을 생성하여 플랫폼 내 모든 노출을 가명화합니다.
                </p>
              </div>

              {/* Sender Name Override */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">카카오 알림톡/SMS 발신자 표기명 변경</label>
                <input 
                  type="text" 
                  value={senderNameOverride}
                  onChange={(e) => setSenderNameOverride(e.target.value)}
                  placeholder="예: 원케어, 오피스원"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['원케어', '오피스원', '가족생활건강', 'L-CRM'].map(name => (
                    <button
                      key={name}
                      onClick={() => setSenderNameOverride(name)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                        senderNameOverride === name 
                        ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' 
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Mode (Stealth Level) */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">스텔스 알림 보안 레벨</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'STEALTH', 'SECRET'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAlertMode(mode)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        alertMode === mode
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'NORMAL' ? '일반 모드' : mode === 'STEALTH' ? '스텔스 모드' : '비밀 모드'}
                    </button>
                  ))}
                </div>

                {/* Dynamic Screen Notification Preview */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl text-left space-y-2">
                  <span className="text-[10px] text-slate-400 block border-b border-slate-200 dark:border-slate-800 pb-1 font-semibold uppercase tracking-wider">
                    🔔 모바일 수신 화면 미리보기
                  </span>
                  
                  <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 max-w-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 text-xs font-bold">
                      {alertMode === 'NORMAL' ? 'L' : senderNameOverride.slice(0, 1)}
                    </div>
                    <div className="space-y-0.5 text-left flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <strong className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {alertMode === 'NORMAL' ? '개인회생CRM' : senderNameOverride}
                        </strong>
                        <span className="text-[9px] text-slate-400">방금 전</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed truncate">
                        {alertMode === 'NORMAL' && '이소민 변호사가 대화방에 입장해 답변을 남겼습니다.'}
                        {alertMode === 'STEALTH' && '요청하신 서비스의 신규 메세지가 도착했습니다. 본인 확인 후 열람 가능합니다.'}
                        {alertMode === 'SECRET' && '안내드립니다. 본인 지정 우편물 발송 안내 메세지입니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panic Button Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">긴급 화면 대피 버튼 활성화</label>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    화면 하단에 긴급 대피 플로팅 버튼을 노출합니다. (단축키 F2/Esc 2회는 항시 작동)
                  </p>
                </div>
                <input 
                  type="checkbox"
                  checked={panicButtonEnabled}
                  onChange={(e) => setPanicButtonEnabled(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer shrink-0"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl text-xs transition-colors shadow-md"
              >
                설정 저장 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Panic Button */}
      {isLoggedIn && panicButtonEnabled && (
        <button
          onClick={() => setIsPanicState(true)}
          className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-500 text-white font-bold p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2 group cursor-pointer"
          title="긴급 화면 대피 (F2 또는 Esc 두 번)"
        >
          <ShieldCheck className="w-5 h-5 text-white animate-pulse" />
          <span className="text-xs pr-1">긴급 대피 (F2)</span>
        </button>
      )}

    </div>
  );
}
