import React, { useRef, useEffect, useState } from 'react';
import { DollarSign, TrendingDown, Percent, Shield, ChevronDown, ChevronUp, Lock, Send, Phone, MessageCircle, Check, AlertTriangle, FileText, User, Star, ArrowUp, X, Users, ShieldCheck, Clock, Award } from 'lucide-react';
import MyPageView from './MyPageView';
import { ConsultRequest, ConsultMessage, ConsultProposal, FinancialProfile } from '../../types';
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
  const [isReportExpanded, setIsReportExpanded] = useState<boolean>(false);
  const [showPhoneConsultModal, setShowPhoneConsultModal] = useState<boolean>(false);
  const [showAppointModal, setShowAppointModal] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [appointedLawyerId, setAppointedLawyerId] = useState<string | null>(null);

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
  const activeChatMessages = messages.filter(m => m.consultRequestId === (currentRequest?.id || activeChatReqId));

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
  } else if (proposals.length > 0) {
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
            {currentRequest && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                currentRequest.status === 'requested' ? 'bg-amber-100 text-amber-700' : 
                currentRequest.status === 'counseling' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {currentRequest.status === 'requested' ? '진단 대기' : currentRequest.status === 'counseling' ? '상담 진행 중' : '검토 중'}
              </span>
            )}
          </div>

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
              <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white pt-1">
                {activeResult?.status === 'infeasible' ? '불가' : '매우 높음'}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => setIsReportExpanded(!isReportExpanded)}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <span>📊 자세히 보기</span>
              {isReportExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {isReportExpanded && (
              <div className="mt-4 p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-4 animate-slideUp">
                <div className="grid grid-cols-2 text-sm gap-4">
                  <div>
                    <span className="block text-xs text-slate-500">월 소득</span>
                    <strong className="text-slate-800 dark:text-slate-200">{(currentRequest?.financialProfile?.monthlyIncome ?? 0).toLocaleString()}만원</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">부양 가족</span>
                    <strong className="text-slate-800 dark:text-slate-200">{currentRequest?.financialProfile?.dependents ?? 0}명</strong>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowProfilePanel(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand shadow-sm hover:shadow-md transition-shadow"
                  >
                    <FileText className="w-4 h-4" />
                    📝 상세 진단서 보기/수정
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            ZONE B: 변호사 매칭 현황
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">🤝</span> 변호사 매칭 현황
            </h2>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>
            
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all ${
                currentStep >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              } ${currentStep === 1 ? 'animate-customPulse ring-4 ring-emerald-500/20' : ''}`}>
                {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className={`text-xs font-bold ${currentStep >= 1 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>진단완료</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all ${
                currentStep >= 2 ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'
              } ${currentStep === 2 ? 'animate-customPulse ring-4 ring-brand/20' : ''}`}>
                {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
              </div>
              <span className={`text-xs font-bold ${currentStep >= 2 ? 'text-brand' : 'text-slate-400'}`}>매칭대기</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all ${
                currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
              } ${currentStep === 3 ? 'animate-customPulse ring-4 ring-indigo-600/20' : ''}`}>
                3
              </div>
              <span className={`text-xs font-bold ${currentStep >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>상담시작</span>
            </div>
          </div>

          {/* Conditional Content for Zone B */}
          <div className="pt-4 animate-fadeIn">
            {currentStep === 1 && proposals.length === 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 text-center space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="w-12 h-12 rounded-full border-4 border-brand/30 border-t-brand animate-spin mx-auto"></div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">전문 변호사 3인이 검토 중</h3>
                  <p className="text-sm text-slate-500 mt-1">곧 최적의 솔루션과 견적을 제안해 드립니다.</p>
                </div>
              </div>
            )}

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
                      <div className="flex justify-between">
                        <span className="text-slate-500">평점</span>
                        <span className="font-bold text-amber-500 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" /> 4.9</span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 rounded-xl italic">
                      "{bid.remark}"
                    </div>

                    <button 
                      onClick={() => {
                        if (currentRequest) {
                          onSetRequests(prev => prev.map(r => 
                            r.id === currentRequest.id 
                              ? { ...r, status: 'counseling', selectedLawyerId: bid.lawyerId } 
                              : r
                          ));
                          onAddMessage(
                            currentRequest.id,
                            `${bid.lawyerName}의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 시작할 수 있습니다.`,
                            'lawyer', 'system', '시스템 안내'
                          );
                        }
                      }}
                      className="w-full py-3 bg-brand hover:bg-brand-hover text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> 💬 1:1 상담 시작
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

          {!isSelectedLawyer ? (
            /* Locked State */
            <div className="h-[300px] flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80 dark:to-slate-900/80 z-10"></div>
              <div className="z-20 text-center space-y-4 animate-slideUp">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md mx-auto">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <div className="font-bold text-slate-600 dark:text-slate-300">
                  변호사를 선택하시면 1:1 비밀 상담이 활성화됩니다
                </div>
                <ArrowUp className="w-6 h-6 text-brand animate-bounce mx-auto mt-4" />
              </div>
            </div>
          ) : (
            /* Active Chat State */
            <>
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
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5">
                <input 
                  type="text" 
                  placeholder="담당 변호사에게 채무 고민 메시지 보내기..." 
                  value={chatInput} 
                  onChange={(e) => onSetChatInput(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }} 
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:focus:ring-brand/20 rounded-xl px-4 py-3 text-sm focus:outline-none font-medium transition-all" 
                />
                <button 
                  onClick={onSendChat} 
                  className="bg-brand hover:bg-brand-hover text-white p-3 rounded-xl transition-all shadow-sm cursor-pointer transform active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
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
              {/* 의뢰인 종합 채무·자산 분석 리포트 (embedded) */}
              {activeResult && reportUserInput ? (
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
                  />
                </React.Suspense>
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
    </>
  );
}
