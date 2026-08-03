import React, { useRef, useEffect, useState } from 'react';
import { DollarSign, TrendingDown, Percent, Shield, ChevronDown, ChevronUp, Lock, Send, Phone, MessageCircle, Check, AlertTriangle, FileText, User, Star, ArrowUp, X, Users, ShieldCheck, Clock, Award, Heart, Scale, Search, ArrowRight } from 'lucide-react';
import MyPageView from './MyPageView';
import { ConsultRequest, ConsultMessage, ConsultProposal, FinancialProfile, User as UserType } from '../../types';
import { RehabCalculationResult, RehabUserInput, formatCurrency } from '../../rehab-chatbot-package/services/calculationService';

const PrintableReportTemplate = React.lazy(() => import('./PrintableReportTemplate'));
const RehabResultReport = React.lazy(() => import('../../rehab-chatbot-package/components/rehab/RehabResultReport'));

interface BannerProps {
  onClose: () => void;
}

// [SECURITY] 법률상담 비밀유지 + 보안 안내 배너
function ChatPrivacyBanner({ onClose }: BannerProps) {
  return (
    <div className="bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl px-4 py-3 text-[13px] text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium flex gap-2.5 items-start shadow-sm text-left relative pr-8 animate-fadeIn">
      <Shield className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
      <div>
        <strong>🔒 법률상담 비밀 보장</strong>
        <span className="block mt-0.5 text-indigo-600/80 dark:text-indigo-400/80">이 채팅은 법률상담을 위한 비밀 대화입니다. 상담 내용은 전담 변호사와 고객만 확인할 수 있으며, 플랫폼 운영자는 원문 내용을 열람하지 않습니다.</span>
      </div>
      <button 
        onClick={onClose}
        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-indigo-500 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
        title="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Inline ChatDisclaimer component
function ChatDisclaimer({ onClose }: BannerProps) {
  return (
    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 text-[13px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium flex gap-2 items-start shadow-sm text-left relative pr-8 animate-fadeIn">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <strong>주의사항:</strong> 대화 중 오가는 상담 내용은 강력하게 암호화되어 안전하게 보호됩니다. 공식 선임계약 체결 전의 법률 상담은 참고용으로만 효력을 지니며, 모든 선임비용 결제 및 계약은 본 플랫폼 외부에서 변호사와 직접 조율하여 안전하게 체결하여 주시기 바랍니다.
      </div>
      <button 
        onClick={onClose}
        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-900/50 cursor-pointer transition-colors"
        title="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// CountUp Component for numbers
const CountUp = ({ end, duration = 1000, suffix = '', prefix = '' }: { end: number, duration?: number, suffix?: string, prefix?: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  return <>{prefix}{count.toLocaleString()}{suffix}</>;
};

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

  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: FinancialProfile) => void;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  lawyers?: UserType[];
  initialModalTrigger?: 'fav' | 'no_fav' | null;
  onClearModalTrigger?: () => void;
  showDiagnosisReport?: boolean;
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
  setTempAlias,
  lawyers = [],
  initialModalTrigger,
  onClearModalTrigger,
  showDiagnosisReport
}: ChatViewProps) {
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const [showProfilePanel, setShowProfilePanel] = useState<boolean>(false);
  const [isReportExpanded, setIsReportExpanded] = useState<boolean>(false);
  const [showPhoneConsultModal, setShowPhoneConsultModal] = useState<boolean>(false);
  const [showAppointModal, setShowAppointModal] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [activeChatLawyerId, setActiveChatLawyerId] = useState<string | null>(null);

  // 자동 모달 트리거 감지 (리포트 팝업 -> 내 전담 변호사 선택하기 클릭 시)
  useEffect(() => {
    if (initialModalTrigger === 'fav') {
      setSelectedFavLawyers([]);
      setShowFavLawyerModal(true);
      if (onClearModalTrigger) onClearModalTrigger();
    } else if (initialModalTrigger === 'no_fav') {
      setShowNoFavoritesModal(true);
      if (onClearModalTrigger) onClearModalTrigger();
    }
  }, [initialModalTrigger, onClearModalTrigger]);
  const [appointedLawyerId, setAppointedLawyerId] = useState<string | null>(null);
  const [showFavLawyerModal, setShowFavLawyerModal] = useState<boolean>(false);
  const [selectedFavLawyers, setSelectedFavLawyers] = useState<string[]>([]);
  const [requestedLawyerIds, setRequestedLawyerIds] = useState<string[]>([]);
  const [cancelTargetLawyer, setCancelTargetLawyer] = useState<{id: string, name: string} | null>(null);
  const [showNoFavoritesModal, setShowNoFavoritesModal] = useState<boolean>(false);
  const [showNeedCheckModal, setShowNeedCheckModal] = useState<boolean>(false);

  useEffect(() => {
    setAppointedLawyerId(localStorage.getItem('legal_crm_appointed_lawyer_id'));
  }, [activeChatReqId]);


  // financialProfile → RehabUserInput 재구성 (상세 진단서 표시용)
  const reportUserInput: RehabUserInput | undefined = React.useMemo(() => {
    const profile = activeRequest?.financialProfile;
    if (!profile) return undefined;
    return {
      address: profile.residenceRegion || '서울',
      workLocation: undefined,
      age: 35,
      employmentType: profile.jobType === 'SALARIED' ? 'salary' :
                      profile.jobType === 'BUSINESS' ? 'business' :
                      profile.jobType === 'DAILY' ? 'daily' :
                      profile.jobType === 'FREELANCER' ? 'freelancer' : 'salary',
      monthlyIncome: (profile.income || 0) * 10000,
      familySize: (profile.dependents || 0) + 1,
      spouseAssets: (profile.spouseAsset || 0) * 10000,
      rentCost: (profile.rentCost || 0) * 10000,
      deposit: (profile.rentalDeposit || 0) * 10000,
      depositLoan: (profile.depositLoan || 0) * 10000,
      housingType: profile.housingType,
      housingContractHolder: profile.housingContractHolder,
      myAssets: Math.max(0, (profile.assetsTotal || 0) - (profile.rentalDeposit || 0) - (profile.spouseAsset || 0) - (profile.retirementPay || 0)) * 10000,
      totalDebt: (profile.debtTotal || 0) * 10000,
      priorityDebt: (profile.priorityDebt || 0) * 10000,
      speculativeLoss: (profile.speculativeLoss || 0) * 10000,
      gamblingLoss: (profile.gamblingLoss || 0) * 10000,
      retirementPensionType: profile.retirementPensionType || 'unknown',
      retirementPay: (profile.retirementPay || 0) * 10000,
      isMarried: profile.maritalStatus === 'MARRIED',
      maritalStatus: profile.maritalStatus === 'SINGLE' ? 'single' : profile.maritalStatus === 'MARRIED' ? 'married' : 'divorced',
      minorChildren: profile.dependents || 0,
      legalActions: profile.legalActions || [],
      name: profile.name || userAlias || '의뢰인',
    };
  }, [activeRequest]);

  const [showPrivacyBanner, setShowPrivacyBanner] = useState<boolean>(true);
  const [showDisclaimerBanner, setShowDisclaimerBanner] = useState<boolean>(true);

  useEffect(() => {
    const privacyDismissTime = localStorage.getItem('legal_crm_dismiss_privacy_banner');
    if (privacyDismissTime) {
      const isExpired = Date.now() - parseInt(privacyDismissTime, 10) > 3600000;
      setShowPrivacyBanner(isExpired);
    } else {
      setShowPrivacyBanner(true);
    }

    const disclaimerDismissTime = localStorage.getItem('legal_crm_dismiss_disclaimer_banner');
    if (disclaimerDismissTime) {
      const isExpired = Date.now() - parseInt(disclaimerDismissTime, 10) > 3600000;
      setShowDisclaimerBanner(isExpired);
    } else {
      setShowDisclaimerBanner(true);
    }
  }, [activeChatReqId]);

  const handleClosePrivacyBanner = () => {
    localStorage.setItem('legal_crm_dismiss_privacy_banner', Date.now().toString());
    setShowPrivacyBanner(false);
  };

  const handleCloseDisclaimerBanner = () => {
    localStorage.setItem('legal_crm_dismiss_disclaimer_banner', Date.now().toString());
    setShowDisclaimerBanner(false);
  };

  const currentRequest = requests.find(r => r.id === activeChatReqId) || activeRequest;

  // 페이지 새로고침 시 DB에서 로드된 selectedLawyerIds로 requestedLawyerIds 복원
  useEffect(() => {
    if (currentRequest?.selectedLawyerIds && currentRequest.selectedLawyerIds.length > 0 && requestedLawyerIds.length === 0) {
      setRequestedLawyerIds(currentRequest.selectedLawyerIds);
    }
  }, [currentRequest?.selectedLawyerIds]);

  const isComparing = currentRequest?.status === 'comparing';
  const hasMultipleAccepted = (currentRequest?.acceptedLawyerIds || []).length > 1;

  const activeChatMessages = messages.filter(m => {
    if (m.consultRequestId !== (currentRequest?.id || activeChatReqId)) return false;
    if ((isComparing || currentRequest?.status === 'counseling') && hasMultipleAccepted && activeChatLawyerId) {
      return m.senderType === 'client' || m.senderId === activeChatLawyerId || m.senderId === 'system';
    }
    return true;
  });

  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [activeChatMessages.length]);

  const proposals: ConsultProposal[] = currentRequest?.proposals || [];
  
  const totalDebt = Math.round(((activeResult?.totalRepayment || 0) + (activeResult?.totalDebtReduction || 0)) / 10000);
  const monthlyPayment = Math.round((activeResult?.monthlyPayment || 0) / 10000);
  const reductionRate = Math.round(activeResult?.debtReductionRate || 0);
  const isSelectedLawyer = !!currentRequest?.selectedLawyerId;
  const isAppointed = currentRequest?.selectedLawyerId === appointedLawyerId;

  let currentStep = 1;
  if (isSelectedLawyer) {
    currentStep = 3;
  } else if (proposals.length > 0 || requestedLawyerIds.length > 0) {
    currentStep = 2;
  }

  return (
    <>
      <style>{`
        @keyframes customPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.05); }
        }
        .animate-customPulse {
          animation: customPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.5s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out forwards;
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6 font-sans text-left animate-fadeIn">

        {/* =========================================================================
            ZONE A: 채무 현황 대시보드
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">📊</span> 채무 진단 현황
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowProfilePanel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-brand shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                상세 진단서 보기/수정
              </button>
              {currentRequest && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentRequest.status === 'requested' ? 'bg-amber-100 text-amber-700' : 
                  currentRequest.status === 'counseling' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {currentRequest.status === 'requested' ? '진단 대기' : currentRequest.status === 'counseling' ? '상담 진행 중' : '검토 중'}
                </span>
              )}
            </div>
          </div>

          {!activeResult ? (
            /* 내상황 체크 미진행 시 CTA 배너 */
            <div className="relative bg-gradient-to-br from-indigo-50 via-blue-50/60 to-violet-50/40 dark:from-indigo-950/30 dark:via-slate-800/40 dark:to-violet-950/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/40 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -translate-y-8 translate-x-8"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full translate-y-6 -translate-x-6"></div>
              <div className="relative flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="flex-shrink-0 w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-md flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                  <ShieldCheck className="w-7 h-7 text-brand" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-white">아직 내 상황 체크를 진행하지 않았어요</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">간단한 질문에 답하면 <strong className="text-brand">예상 감면율, 월 변제금, 인가 가능성</strong>을 바로 확인할 수 있어요.</p>
                </div>
                <button
                  onClick={() => onSetActiveTab('request')}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-[#5b4cf5] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  내 상황 체크하기
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* 진단 결과 있을 때 통계 카드 */
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 총 채무액 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-rose-500 mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-500">총 채무액</span>
                </div>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">
                  <CountUp end={totalDebt} suffix="만" />
                </div>
              </div>

              {/* 월 변제금 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-emerald-500 mb-2">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-500">예상 월 변제금</span>
                </div>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">
                  <CountUp end={monthlyPayment} suffix="만" />
                </div>
              </div>

              {/* 예상 감면율 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-indigo-500 mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-500">예상 감면율</span>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  <CountUp end={reductionRate} suffix="%" />
                </div>
              </div>

              {/* 인가 가능성 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-brand mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-500">인가 가능성</span>
                </div>
                <div className={`text-xl md:text-2xl font-bold pt-1 ${
                  activeResult.status === 'POSSIBLE' ? 'text-emerald-600 dark:text-emerald-400' :
                  activeResult.status === 'DIFFICULT' ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {activeResult.status === 'POSSIBLE' ? '매우 높음' :
                   activeResult.status === 'DIFFICULT' ? '보완 필요' :
                   '불가'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            ZONE B: 변호사 매칭 현황
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-lg">🤝</span> 변호사 매칭 현황
            </h2>
          </div>

          {/* Compact Stepper */}
          <div className="flex items-center gap-0">
            {[
              { step: 1, label: '진단완료', activeColor: 'bg-emerald-500', ringColor: 'ring-emerald-500/20', textColor: 'text-emerald-600' },
              { step: 2, label: '매칭대기', activeColor: 'bg-brand', ringColor: 'ring-brand/20', textColor: 'text-brand' },
              { step: 3, label: '상담시작', activeColor: 'bg-indigo-600', ringColor: 'ring-indigo-600/20', textColor: 'text-indigo-600' },
            ].map(({ step, label, activeColor, ringColor, textColor }) => (
              <React.Fragment key={step}>
                {step > 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${currentStep >= step ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    currentStep >= step ? `${activeColor} text-white` : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  } ${currentStep === step ? `animate-customPulse ring-2 ${ringColor}` : ''}`}>
                    {currentStep > step ? <Check className="w-3.5 h-3.5" /> : step}
                  </div>
                  <span className={`text-[11px] font-bold ${currentStep >= step ? textColor : 'text-slate-400'}`}>{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Conditional Content for Zone B */}
          <div className="animate-fadeIn">
            {/* Step 1: 매칭 전 - 변호사 수임 안내 */}
            {currentStep === 1 && proposals.length === 0 && (
              <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-indigo-950/20 rounded-2xl p-5 text-center space-y-3 border border-slate-200/60 dark:border-slate-700/50">
                <div className="flex items-center justify-center gap-3">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 bg-brand/10 rounded-xl rotate-6"></div>
                    <div className="relative w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <Scale className="w-6 h-6 text-brand" />
                    </div>
                  </div>
                  <div className="text-left">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">아직 변호사 매칭 전이에요</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">관심 있는 변호사를 선택하여 무료 상담을 요청해 보세요</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // 1. 내상황 체크 미완료 시 안내
                    if (!activeResult) {
                      setShowNeedCheckModal(true);
                      return;
                    }
                    // 2. 좋아요 변호사 확인
                    const FAVORITES_KEY = 'lawyer_favorites';
                    let favIds: string[] = [];
                    try { favIds = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { /* ignore */ }
                    if (favIds.length > 0) {
                      setSelectedFavLawyers([]);
                      setShowFavLawyerModal(true);
                    } else {
                      setShowNoFavoritesModal(true);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-md shadow-brand/20 cursor-pointer active:scale-[0.97]"
                >
                  <Search className="w-4 h-4" />
                  무료 상담 변호사 수임하기
                  <ArrowRight className="w-4 h-4 text-white/70" />
                </button>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  ♥ 좋아요한 변호사 중 최대 3명에게 무료 상담을 요청할 수 있어요
                </p>
              </div>
            )}

            {/* Step 2: 매칭대기 - 상담 요청 완료 상태 */}
            {currentStep === 2 && requestedLawyerIds.length > 0 && proposals.length === 0 && (() => {
              const reqLawyers = requestedLawyerIds.map(id => lawyers.find(l => l.id === id)).filter(Boolean);
              return (
              <div className="bg-gradient-to-br from-brand/5 via-indigo-50/30 to-blue-50/20 dark:from-brand/10 dark:via-slate-800/30 dark:to-slate-800/20 rounded-2xl p-5 space-y-3 border border-brand/20 dark:border-brand/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-brand animate-customPulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">상담 요청을 보냈어요!</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">변호사님이 확인하면 1:1 상담이 시작됩니다</p>
                  </div>
                </div>

                {/* 요청한 변호사 목록 - 아바타 + 개별 취소 */}
                <div className="space-y-2">
                  {reqLawyers.map(lawyer => lawyer && (
                    <div key={lawyer.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                      {lawyer.avatar || lawyer.avatarData ? (
                        <img src={lawyer.avatarData || lawyer.avatar} alt={lawyer.name} className="w-9 h-9 rounded-full object-cover border border-slate-100 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">{lawyer.name.charAt(0)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white">{lawyer.name} 변호사</div>
                        <div className="text-[10px] text-slate-400 truncate">{lawyer.firmName || '개인'} · {lawyer.region}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold">확인 대기</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setCancelTargetLawyer({ id: lawyer.id, name: lawyer.name });
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        >
                          상담 취소하기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}

            {currentStep === 2 && !isSelectedLawyer && proposals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proposals.map((bid, index) => (
                  <div key={bid.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 hover:border-brand/50 hover:shadow-md transition-all bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      {bid.lawyerAvatar ? (
                        <img src={bid.lawyerAvatar} alt={bid.lawyerName} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-lg">{bid.lawyerName.charAt(0)}</div>
                      )}
                      <div>
                        <div className="text-xs text-slate-500 font-semibold">{bid.firmName}</div>
                        <div className="font-bold text-slate-900 dark:text-white text-base">{bid.lawyerName} 변호사</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">월 변제금</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{bid.monthlyPayment}만원</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">감면율</span>
                        <span className="font-bold text-brand">{bid.reductionRate}% 탕감</span>
                      </div>

                    </div>
                    
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 rounded-xl italic">
                      "{bid.remark}"
                    </div>

                    <button 
                      onClick={() => {
                        if (currentRequest) {
                          if (currentRequest.requestType === 'direct') {
                            onSetRequests(prev => prev.map(r => 
                              r.id === currentRequest.id 
                                ? { ...r, status: 'counseling' as const, selectedLawyerId: bid.lawyerId } 
                                : r
                            ));
                            // 전담 변호사 저장
                            localStorage.setItem('legal_crm_appointed_lawyer_id', bid.lawyerId);
                            setAppointedLawyerId(bid.lawyerId);
                            onAddMessage(
                              currentRequest.id,
                              `${bid.lawyerName} 변호사님의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 시작할 수 있습니다.`,
                              'lawyer', 'system', '시스템 안내'
                            );
                          } else {
                            const newAccepted = Array.from(new Set([...(currentRequest.acceptedLawyerIds || []), bid.lawyerId]));
                            onSetRequests(prev => prev.map(r => 
                              r.id === currentRequest.id 
                                ? { ...r, status: 'comparing' as const, acceptedLawyerIds: newAccepted } 
                                : r
                            ));
                            setActiveChatLawyerId(bid.lawyerId);
                            onAddMessage(
                              currentRequest.id,
                              `${bid.lawyerName} 변호사님과 비교 상담을 시작합니다.`,
                              'lawyer', 'system', '시스템 안내'
                            );
                          }
                        }
                      }}
                      disabled={currentRequest?.acceptedLawyerIds?.includes(bid.lawyerId)}
                      className={`w-full py-3 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                        currentRequest?.acceptedLawyerIds?.includes(bid.lawyerId)
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-brand hover:bg-brand-hover text-white'
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" /> {currentRequest?.acceptedLawyerIds?.includes(bid.lawyerId) ? '💬 상담 진행중' : '💬 상담 시작'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isSelectedLawyer && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-xl font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-0.5">전담 변호사 매칭 완료</div>
                    <div className="font-bold text-slate-900 dark:text-white">성공적으로 매칭되었습니다.</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (confirm("정말 전담 지정을 해지하시겠습니까? 해지 시 다른 변호사를 전담 변호사로 선임하실 수 있습니다.")) {
                      localStorage.removeItem('legal_crm_appointed_lawyer_id');
                      setAppointedLawyerId(null);
                      if (currentRequest) {
                        onSetRequests(prev => prev.map(r => 
                          r.id === currentRequest.id ? { ...r, selectedLawyerId: undefined, status: 'responding' } : r
                        ));
                      }
                    }
                  }}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                >
                  전담 해지
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            ZONE C: 1:1 비밀 상담 (Bottom)
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col relative transition-all duration-300">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">💬</span> 1:1 비밀 상담
            </h2>
            {isSelectedLawyer && (
              <button
                type="button"
                onClick={() => setShowPhoneConsultModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-all shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>전화상담 신청</span>
              </button>
            )}
          </div>

          {(!isSelectedLawyer && currentRequest?.status !== 'comparing') ? (
            /* Locked / Waiting State */
            <div className="h-[250px] flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80 dark:to-slate-900/80 z-10"></div>
              <div className="z-20 text-center space-y-3 animate-slideUp">
                {requestedLawyerIds.length > 0 ? (
                  <>
                    <div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center mx-auto">
                      <MessageCircle className="w-7 h-7 text-brand animate-customPulse" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        변호사님 확인 대기 중
                      </div>
                      <div className="text-xs text-slate-400 mt-1">확인이 완료되면 상담방이 활성화됩니다</div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md mx-auto">
                      <Lock className="w-7 h-7 text-slate-400" />
                    </div>
                    <div className="font-bold text-sm text-slate-600 dark:text-slate-300">
                      변호사를 선택하시면 1:1 비밀 상담이 활성화됩니다
                    </div>
                    <ArrowUp className="w-5 h-5 text-brand animate-bounce mx-auto" />
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Active Chat State */
            <>
              {/* Lawyer Tabs for Comparing / Multiple Accepted */}
              {((currentRequest?.status === 'comparing' || currentRequest?.status === 'counseling') && hasMultipleAccepted) && (
                <div className="flex bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  {currentRequest?.acceptedLawyerIds?.map(lawyerId => {
                    const lawyerName = proposals.find(p => p.lawyerId === lawyerId)?.lawyerName || '변호사';
                    const isSelected = currentRequest.status === 'counseling' && currentRequest.selectedLawyerId === lawyerId;
                    const isOther = currentRequest.status === 'counseling' && currentRequest.selectedLawyerId !== lawyerId;
                    return (
                      <button
                        key={lawyerId}
                        onClick={() => !isOther && setActiveChatLawyerId(lawyerId)}
                        disabled={isOther}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                          activeChatLawyerId === lawyerId ? 'border-brand text-brand bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 bg-slate-50'
                        } ${isOther ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isOther ? '🔒 상담 종료' : isSelected ? `🟢 ${lawyerName}` : `🟠 ${lawyerName}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {(showPrivacyBanner || showDisclaimerBanner) && (
                <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 space-y-2">
                  {showPrivacyBanner && <ChatPrivacyBanner onClose={handleClosePrivacyBanner} />}
                  {showDisclaimerBanner && <ChatDisclaimer onClose={handleCloseDisclaimerBanner} />}
                </div>
              )}

              <div ref={chatFeedRef} className="h-[450px] overflow-y-auto p-5 space-y-6 scrollbar-hide bg-slate-50/[0.15] dark:bg-slate-950/[0.05]">
                {activeChatMessages.map(m => {
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

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2.5">
                {currentRequest?.status === 'comparing' && activeChatLawyerId && (
                  <button
                    onClick={() => {
                      if (confirm("이 변호사님을 전담으로 선임하시겠습니까? 다른 변호사님들과의 상담은 종료됩니다.")) {
                        onSetRequests(prev => prev.map(r => 
                          r.id === currentRequest.id 
                            ? { ...r, status: 'counseling' as const, selectedLawyerId: activeChatLawyerId, rejectionNotified: true } 
                            : r
                        ));
                        localStorage.setItem('legal_crm_appointed_lawyer_id', activeChatLawyerId);
                        setAppointedLawyerId(activeChatLawyerId);
                        
                        onAddMessage(
                          currentRequest.id,
                          `[System] 🎉 의뢰인이 귀하를 전담 변호사로 선임하였습니다!`,
                          'client', activeChatLawyerId, '시스템 안내'
                        );

                        const otherLawyers = (currentRequest.acceptedLawyerIds || []).filter(id => id !== activeChatLawyerId);
                        otherLawyers.forEach(otherId => {
                          onAddMessage(
                            currentRequest.id,
                            `[System] 📋 의뢰인이 다른 변호사를 전담으로 선임하였습니다. 상담에 참여해 주셔서 감사합니다.`,
                            'client', otherId, '시스템 안내'
                          );
                        });
                      }
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    ⭐ 이 변호사를 전담으로 선임하기
                  </button>
                )}
                <div className="flex items-center gap-2.5 w-full">
                  <input 
                    type="text" 
                    placeholder={currentRequest?.status === 'counseling' && currentRequest?.selectedLawyerId !== activeChatLawyerId && activeChatLawyerId ? '상담이 종료되었습니다.' : '담당 변호사에게 채무 고민 메시지 보내기...'} 
                    value={chatInput} 
                    onChange={(e) => onSetChatInput(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }} 
                    disabled={currentRequest?.status === 'counseling' && currentRequest?.selectedLawyerId !== activeChatLawyerId && activeChatLawyerId !== null}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:focus:ring-brand/20 rounded-xl px-4 py-3 text-sm focus:outline-none font-medium transition-all disabled:bg-slate-100 disabled:cursor-not-allowed" 
                  />
                  <button 
                    onClick={onSendChat} 
                    disabled={currentRequest?.status === 'counseling' && currentRequest?.selectedLawyerId !== activeChatLawyerId && activeChatLawyerId !== null}
                    className="bg-brand hover:bg-brand-hover disabled:bg-slate-300 text-white p-3 rounded-xl transition-all shadow-sm cursor-pointer transform active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          SLIDE-OVER PANEL: Report Edit
          ========================================================================= */}
      {showProfilePanel && (
        <div className="fixed inset-0 z-[9999] flex justify-end">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowProfilePanel(false)}
          ></div>
          <div className="relative w-full md:w-[640px] lg:w-[720px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-slideInRight">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white">상세 진단서</h2>
              <div className="flex items-center gap-2">
                {activeResult && reportUserInput && (
                  <button 
                    onClick={async () => {
                      try {
                        const totalPages = 7;
                        const pageElements: HTMLElement[] = [];
                        for (let i = 1; i <= totalPages; i++) {
                          const el = document.getElementById(`pdf-page-${i}`);
                          if (el) pageElements.push(el);
                        }
                        if (pageElements.length === 0) {
                          alert('PDF 템플릿을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
                          return;
                        }
                        const { default: html2canvas } = await import('html2canvas');
                        const { default: jsPDF } = await import('jspdf');
                        const canvases = await Promise.all(
                          pageElements.map(el => html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }))
                        );
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        canvases.forEach((canvas, idx) => {
                          if (idx > 0) pdf.addPage();
                          const imgData = canvas.toDataURL('image/jpeg', 0.95);
                          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                        });
                        pdf.save(`채무분석_리포트_${new Date().toISOString().slice(0,10)}.pdf`);
                      } catch (err) {
                        console.error('PDF generation error:', err);
                        alert('PDF 생성 중 오류가 발생했습니다.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF 다운로드
                  </button>
                )}
                <button 
                  onClick={() => setShowProfilePanel(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* 의뢰인 종합 채무·자산 분석 리포트 (embedded) - 토글 ON일 때만 표시 */}
              {activeResult && reportUserInput && showDiagnosisReport !== false ? (
                <React.Suspense fallback={
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand rounded-full animate-spin"></div>
                  </div>
                }>
                  <RehabResultReport
                    result={activeResult}
                    userInput={reportUserInput}
                    onClose={() => setShowProfilePanel(false)}
                    isLoggedIn={isLoggedIn}
                    embedded={true}
                    onConsultation={() => {
                      setShowProfilePanel(false);
                      // 좋아요 변호사 확인 (무료 상담 변호사 수임하기와 동일 로직)
                      const FAVORITES_KEY = 'lawyer_favorites';
                      let favIds: string[] = [];
                      try { favIds = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { /* ignore */ }
                      if (favIds.length > 0) {
                        setSelectedFavLawyers([]);
                        setShowFavLawyerModal(true);
                      } else {
                        setShowNoFavoritesModal(true);
                      }
                    }}
                  />
                </React.Suspense>
              ) : activeResult && reportUserInput && showDiagnosisReport === false ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <Shield className="w-7 h-7 text-brand" />
                  </div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">나의 진단 정보</h4>
                  <p className="text-sm text-slate-500">진단 정보는 내 관리방에서 조회 및 수정할 수 있습니다.</p>
                  <button
                    onClick={() => setShowProfilePanel(false)}
                    className="mt-2 px-5 py-2.5 bg-brand hover:bg-brand/90 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-sm text-slate-500">진단 결과가 없습니다. 먼저 내 상황 체크를 진행해 주세요.</p>
                </div>
              )}

              {/* 구분선 */}
              <div className="border-t-4 border-slate-100 dark:border-slate-800 my-2"></div>

              {/* 하단 수정 폼 */}
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
                onStartDiagnosis={() => { setShowProfilePanel(false); onSetActiveTab('request'); }}
                requests={requests}
                onNavigateToChat={() => setShowProfilePanel(false)}
                isCompact={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* 오프스크린 PDF 템플릿 (화면에 안 보이지만 html2canvas가 캡처) */}
      {showProfilePanel && activeResult && reportUserInput && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
          <React.Suspense fallback={null}>
            <PrintableReportTemplate result={activeResult} userInput={reportUserInput} />
          </React.Suspense>
        </div>
      )}

      {/* Other Modals preserved */}
      {showPhoneConsultModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <h3 className="font-bold text-lg">전화상담 신청</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">안심번호(050)를 통해 안전하게 상담이 진행됩니다.</p>
            <button onClick={() => setShowPhoneConsultModal(false)} className="w-full py-2 bg-brand text-white rounded-lg font-bold">닫기</button>
          </div>
        </div>
      )}

      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
           {/* Celebration Content */}
           <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5 animate-fadeIn">
              <div className="text-5xl">🎉</div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">전담 파트너가 되었습니다!</h3>
              <button onClick={() => setShowCelebration(false)} className="w-full py-3 bg-brand text-white rounded-xl text-sm font-bold">확인</button>
           </div>
        </div>
      )}
      {/* =========================================================================
          CANCEL CONFIRMATION MODAL
          ========================================================================= */}
      {cancelTargetLawyer && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelTargetLawyer(null)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-fadeIn">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">상담 요청을 취소할까요?</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                <strong className="text-slate-700 dark:text-slate-300">{cancelTargetLawyer.name}</strong> 변호사님에 대한<br />상담 요청이 취소됩니다
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setCancelTargetLawyer(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                아니요
              </button>
              <button
                onClick={() => {
                  // 1. 로컬 UI 상태 업데이트
                  setRequestedLawyerIds(prev => prev.filter(id => id !== cancelTargetLawyer.id));
                  
                  // 2. 실제 ConsultRequest 객체 업데이트 (변호사 측에 반영)
                  if (currentRequest) {
                    const updatedLawyerIds = (currentRequest.selectedLawyerIds || []).filter(id => id !== cancelTargetLawyer.id);
                    const allCancelled = updatedLawyerIds.length === 0;
                    
                    onSetRequests(prev => prev.map(r => 
                      r.id === currentRequest.id 
                        ? { 
                            ...r, 
                            selectedLawyerIds: updatedLawyerIds,
                            status: allCancelled ? 'cancelled' as const : r.status,
                          } 
                        : r
                    ));
                    
                    // 3. 시스템 메시지 (고객 + 변호사 양쪽에 표시)
                    onAddMessage(
                      currentRequest.id, 
                      allCancelled 
                        ? `의뢰인이 모든 변호사에 대한 상담 요청을 취소하였습니다.`
                        : `의뢰인이 ${cancelTargetLawyer.name} 변호사님에 대한 상담 요청을 취소하였습니다.`, 
                      'lawyer', 'system', '시스템 안내'
                    );
                  }
                  setCancelTargetLawyer(null);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer shadow-md shadow-red-500/20"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FAVORITE LAWYER SELECTION MODAL
          ========================================================================= */}
      {showFavLawyerModal && (() => {
        const FAVORITES_KEY = 'lawyer_favorites';
        let favIds: string[] = [];
        try { favIds = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { /* ignore */ }
        const favLawyers = lawyers.filter(l => favIds.includes(l.id));
        
        // 현재 활성 요청 중인 변호사 수 (취소된 건 제외)
        const activeRequestedCount = requestedLawyerIds.length;
        const remainingSlots = Math.max(0, 3 - activeRequestedCount);

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFavLawyerModal(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col animate-fadeIn overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                    좋아요 변호사 선택
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeRequestedCount > 0 
                      ? `현재 ${activeRequestedCount}명 상담 대기 중 · 추가 ${remainingSlots}명 선택 가능`
                      : '최대 3명을 선택하여 무료 상담을 요청하세요'}
                  </p>
                </div>
                <button onClick={() => setShowFavLawyerModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* 정책 안내 배너 */}
              <div className="px-4 pt-3 pb-1 shrink-0 space-y-2">
                {/* 슬롯 프로그레스 바 */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">상담 요청 현황</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{activeRequestedCount} / 3명</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeRequestedCount >= 3 ? 'bg-red-400' : activeRequestedCount >= 2 ? 'bg-amber-400' : 'bg-brand'
                      }`}
                      style={{ width: `${(activeRequestedCount / 3) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${i <= activeRequestedCount ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-600'}`} />
                        <span className={i <= activeRequestedCount ? 'text-brand font-bold' : ''}>{i}번째</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 안내 메시지 */}
                {activeRequestedCount >= 3 ? (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                      <strong>3명 모두 요청 중입니다.</strong><br />
                      추가 요청을 원하시면 기존 요청을 취소해 주세요. 
                      <span className="text-red-400"> 내 관리방 → 상담 대기 목록에서 취소할 수 있습니다.</span>
                    </div>
                  </div>
                ) : activeRequestedCount > 0 ? (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                      <strong>추가 {remainingSlots}명에게 더 요청할 수 있어요!</strong><br />
                      상담 대기 중인 변호사는 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-bold align-middle">상담 대기중</span>으로 표시됩니다.
                      기존 요청을 취소하면 빈 자리만큼 다시 요청할 수 있어요.
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
                      <strong>최대 3명의 변호사에게 무료 상담을 요청할 수 있어요.</strong><br />
                      여러 변호사의 제안을 비교한 뒤 가장 적합한 변호사를 선택하세요.
                    </div>
                  </div>
                )}
              </div>

              {/* Lawyer List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {favLawyers.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Heart className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-sm text-slate-500 font-medium">좋아요한 변호사가 없습니다</p>
                    <button
                      onClick={() => { setShowFavLawyerModal(false); onSetActiveTab('lawyers'); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold cursor-pointer"
                    >
                      <Search className="w-4 h-4" /> 변호사 찾기
                    </button>
                  </div>
                ) : (
                  favLawyers.map(lawyer => {
                    const isAlreadyRequested = requestedLawyerIds.includes(lawyer.id);
                    const isSelected = selectedFavLawyers.includes(lawyer.id);
                    const isDisabled = isAlreadyRequested || (!isSelected && selectedFavLawyers.length >= remainingSlots);
                    
                    return (
                      <button
                        key={lawyer.id}
                        type="button"
                        onClick={() => {
                          if (isAlreadyRequested) return; // 이미 요청 중인 변호사는 클릭 불가
                          setSelectedFavLawyers(prev => {
                            if (prev.includes(lawyer.id)) return prev.filter(x => x !== lawyer.id);
                            if (prev.length >= remainingSlots) { 
                              alert(`현재 ${activeRequestedCount}명이 대기 중이므로 추가 ${remainingSlots}명까지만 선택 가능합니다.`); 
                              return prev; 
                            }
                            return [...prev, lawyer.id];
                          });
                        }}
                        disabled={isDisabled && !isSelected}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                          isAlreadyRequested
                            ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 opacity-80 cursor-not-allowed'
                            : isSelected
                            ? 'border-brand bg-brand/5 shadow-md shadow-brand/10 cursor-pointer'
                            : isDisabled
                            ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-50 cursor-not-allowed'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-300 cursor-pointer'
                        }`}
                      >
                        {/* Checkbox / Status */}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isAlreadyRequested ? 'bg-amber-400 border-amber-400' :
                          isSelected ? 'bg-brand border-brand' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isAlreadyRequested ? <Clock className="w-3.5 h-3.5 text-white" /> : isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>

                        {/* Avatar */}
                        {lawyer.avatar || lawyer.avatarData ? (
                          <img src={lawyer.avatarData || lawyer.avatar} alt={lawyer.name} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-lg shrink-0">{lawyer.name.charAt(0)}</div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{lawyer.name} 변호사</span>
                            {isAlreadyRequested && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-bold border border-amber-200">상담 대기중</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">{lawyer.firmName || '개인'} 변호사 · {lawyer.region}</p>
                          {lawyer.fields && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(lawyer.fields || []).slice(0, 2).map((s, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand rounded font-medium">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Fav Icon */}
                        <Heart className="w-5 h-5 text-rose-400 fill-rose-400 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {favLawyers.length > 0 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>선택된 변호사: <strong className="text-brand">{selectedFavLawyers.length}</strong> / 3명</span>
                    <button
                      onClick={() => { setShowFavLawyerModal(false); onSetActiveTab('lawyers'); }}
                      className="text-brand font-bold hover:underline cursor-pointer"
                    >
                      + 더 많은 변호사 보기
                    </button>
                  </div>
                  <button
                    disabled={selectedFavLawyers.length === 0}
                    onClick={() => {
                      const selectedNames = selectedFavLawyers.map(id => lawyers.find(l => l.id === id)?.name).filter(Boolean) as string[];
                      if (currentRequest) {
                        // ConsultRequest에 selectedLawyerIds 저장 (변호사가 요청을 볼 수 있도록)
                        onSetRequests(prev => prev.map(r => 
                          r.id === currentRequest.id 
                            ? { ...r, selectedLawyerIds: selectedFavLawyers, status: 'requested' as const, requestType: 'direct_multi' as const }
                            : r
                        ));
                        onAddMessage(
                          currentRequest.id,
                          `${selectedNames.join(', ')} 변호사님에게 무료 상담을 요청했습니다. 변호사님의 검토 후 제안서가 도착할 예정입니다.`,
                          'lawyer', 'system', '시스템 안내'
                        );
                      }
                      setRequestedLawyerIds(selectedFavLawyers);
                      setShowFavLawyerModal(false);
                    }}
                    className={`w-full py-3.5 rounded-2xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                      selectedFavLawyers.length > 0
                        ? 'bg-gradient-to-r from-brand to-indigo-600 text-white shadow-lg shadow-brand/20 cursor-pointer active:scale-[0.97]'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    선택한 {selectedFavLawyers.length}명에게 상담 요청 보내기
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 좋아요 변호사 없음 커스텀 모달 */}
      {showNoFavoritesModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setShowNoFavoritesModal(false)}>
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 그라데이션 헤더 */}
            <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-brand p-5 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                <Heart className="w-7 h-7 text-white" fill="white" />
              </div>
              <h3 className="text-white font-extrabold text-base">좋아요한 변호사가 없어요</h3>
            </div>

            {/* 본문 */}
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                먼저 <strong className="text-brand">변호사 찾기</strong> 페이지에서<br />
                마음에 드는 변호사를 <span className="text-rose-500 font-bold">♥ 좋아요</span> 해 주세요!
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                좋아요한 변호사 중 최대 3명에게 무료 상담을 요청할 수 있어요.
              </p>
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={() => setShowNoFavoritesModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowNoFavoritesModal(false);
                  onSetActiveTab('lawyers');
                }}
                className="flex-1 py-2.5 bg-brand hover:bg-[#5b4cf5] text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                변호사 찾기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내상황 체크 필요 커스텀 모달 */}
      {showNeedCheckModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setShowNeedCheckModal(false)}>
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 그라데이션 헤더 */}
            <div className="bg-gradient-to-r from-brand via-indigo-600 to-blue-600 p-5 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-white font-extrabold text-base">내 상황 체크가 필요해요</h3>
            </div>

            {/* 본문 */}
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                변호사에게 상담을 요청하려면<br />
                먼저 <strong className="text-brand">내 상황 체크</strong>를 완료해 주세요.
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-left space-y-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" />
                  <span>채무 현황 및 개인 상황 정보가 변호사에게 전달됩니다</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" />
                  <span>정확한 정보가 있어야 변호사도 실질적인 상담이 가능해요</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" />
                  <span>약 3분이면 간편하게 완료할 수 있어요</span>
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={() => setShowNeedCheckModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowNeedCheckModal(false);
                  onSetActiveTab('request');
                }}
                className="flex-1 py-2.5 bg-brand hover:bg-[#5b4cf5] text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                내 상황 체크하기
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
