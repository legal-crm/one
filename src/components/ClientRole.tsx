import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronLeft, ChevronRight, ChevronDown, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X, Home, BookOpen, MessageSquare, MapPin, Check, Edit2,
  Star, Sparkles, BarChart3, Shield, ShieldAlert, Calculator, ClipboardCheck, Compass, Zap, Heart, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from './common/DialogProvider';
import { Client, FinancialProfile, ConsultRequest, ConsultStatus, User as LawyerType, ConsultMessage, IntakeData, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, PlatformConfig, ClientInquiry, AppSettings, PopupConfig, LawyerInquiry } from '../types';
import { migrateAnonymousRequests, saveConsultRequest } from '../services/consultService';
import { calculateRehabPlan } from '../rehabEngine';
import { generateAlias } from '../utils/generateAlias';
import { ensureUniqueAlias, claimAlias } from '../services/aliasService';
const AIRehabChatbotV2 = React.lazy(() => import('../rehab-chatbot-package/components/rehab/AIRehabChatbotV2'));
import type { RehabChatProgressSnapshot } from '../rehab-chatbot-package/components/rehab/AIRehabChatbotV2';
const ChatbotSidePanel = React.lazy(() => import('./client/ChatbotSidePanel'));
import { RehabUserInput, RehabCalculationResult, calculateRepayment } from '../rehab-chatbot-package/services/calculationService';
import { IncomeSource, AssetDetail, DebtItem, PrevHistory, SpecialCircumstances, ExtraLivingCost, ConsultationLog } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { fetchSettings } from '../services/settingsService';
import { formatKoreanCurrency, formatNumber } from '../utils';
import { mockLawyers } from '../data';
import { RequestDisclaimer, ChatDisclaimer } from './Disclaimers';
import { supabase } from '../supabaseClient';
import PopupContainer from './popup/PopupContainer';
import { loadClientNotifications, markAsRead, markAllAsRead, seedInitialNotifications, getUnreadCount } from '../services/clientNotificationService';
import type { ClientNotification } from '../services/clientNotificationService';
import { secureGetItem, secureSetItem, secureRemoveItem } from '../utils/secureStorage';
import { 
  validateClientSessionOnMount, 
  touchClientActivity, 
  purgeClientSession, 
  setupClientInactivityWatcher, 
  listenToRemoteClientLogout 
} from '../services/clientSessionSecurity';
import { usePageMeta, TAB_META } from '../hooks/usePageMeta';

const ReviewsView = React.lazy(() => import('./client/ReviewsView'));
const CalculatorView = React.lazy(() => import('./client/CalculatorView'));
const QnAView = React.lazy(() => import('./client/QnAView'));
const ChatView = React.lazy(() => import('./client/ChatView'));
const NewsView = React.lazy(() => import('./client/NewsView'));
const NoticesView = React.lazy(() => import('./client/NoticesView'));
const CompanyView = React.lazy(() => import('./client/CompanyView'));
const GuideView = React.lazy(() => import('./client/GuideView'));
const LawyersView = React.lazy(() => import('./client/LawyersView'));
const AuthModal = React.lazy(() => import('./client/AuthModal'));
const MyPageView = React.lazy(() => import('./client/MyPageView'));
const MySettingsView = React.lazy(() => import('./client/MySettingsView'));
const InquiryView = React.lazy(() => import('./client/InquiryView'));
const InquiryPopupModal = React.lazy(() => import('./client/InquiryPopupModal'));

import ClientFooter from './client/ClientFooter';
import ClientHeader from './client/ClientHeader';
import MobileGNB from './client/MobileGNB';
import LandingView from './client/landing/LandingView';
import { remedyData, renderRemedyIcon, SOLUTION_LABELS } from './client/remedyData';
import { CLIENT_TAB_LABELS, isClientTab, readInitialClientTab, resolveClientNavTarget, type ClientTab, type MyPageSection } from './client/clientTabs';
import { Button, EmptyState, Modal, PageSkeleton } from './client/ui';
import { LAWYER_REQUEST_LIMIT, LAWYER_REQUEST_RECEIVED_NOTICE, OPEN_REQUEST_CLIENT_NOTICE, buildClientRequestNotice, clearPendingLawyerRequest, mergeLawyerRequest, readPendingLawyerRequest, stashPendingLawyerRequest } from './client/consultFlow';
import { getDisplayName as getLawyerDisplayName } from './client/lawyerDirectory';
import { commitPendingLoginConsent, recordThirdPartyConsent } from '../services/clientConsentService';
import ThirdPartyConsentModal from './client/ThirdPartyConsentModal';
const RemedyModal = React.lazy(() => import('./client/RemedyModal'));
const NewsDetailModal = React.lazy(() => import('./client/NewsDetailModal'));
const LawyerProfileModal = React.lazy(() => import('./client/LawyerProfileModal'));

import type { SolutionType } from './client/SolutionDetailModal';
const SolutionDetailModal = React.lazy(() => import('./client/SolutionDetailModal'));
const CompanionIntroView = React.lazy(() => import('./client/companion/CompanionIntroView'));
import TabErrorBoundary from './common/TabErrorBoundary';

// 의뢰인이 한 번에 상담 요청할 수 있는 변호사 수 (LawyersView 선택 한도 + 랜딩 안내 문구 + 요청 병합 공용)
const LAWYER_MAX_SELECTIONS = LAWYER_REQUEST_LIMIT;

const mapProfileToIntakeData = (profile: FinancialProfile): IntakeData => {
  const incomeSources: IncomeSource[] = [{
    id: `inc-salary-${Date.now()}`,
    type: profile.jobType === 'SALARIED' ? 'worker' :
          profile.jobType === 'BUSINESS' ? 'business' :
          profile.jobType === 'DAILY' ? 'worker_no_ins' :
          profile.jobType === 'FREELANCER' ? 'freelancer' : 'worker',
    amount: (profile.income || 0) * 10000,
    tenureYears: 1,
    payType: 'bank'
  }];

  const assets: AssetDetail[] = [];
  const rentalDepositWon = (profile.rentalDeposit || 0) * 10000;
  const spouseAssetWon = (profile.spouseAsset || 0) * 10000;
  const retirementPayWon = (profile.retirementPay || 0) * 10000;
  const otherAssetsWon = Math.max(0, (profile.assetsTotal || 0) - (profile.rentalDeposit || 0) - (profile.spouseAsset || 0) - (profile.retirementPay || 0)) * 10000;

  if (otherAssetsWon > 0) {
    assets.push({
      id: `asset-my-${Date.now()}`,
      owner: 'self',
      type: 'other',
      description: '본인 보유 자산',
      marketValue: otherAssetsWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }
  if (spouseAssetWon > 0) {
    assets.push({
      id: `asset-spouse-${Date.now()}`,
      owner: 'spouse',
      type: 'other',
      description: '배우자 보유 자산',
      marketValue: spouseAssetWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }
  if (retirementPayWon > 0) {
    assets.push({
      id: `asset-severance-${Date.now()}`,
      owner: 'self',
      type: 'severance',
      description: profile.retirementPensionType === 'pension' ? '퇴직연금 (가입)' : '예상 퇴직금',
      marketValue: retirementPayWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: profile.retirementPensionType === 'pension'
    });
  }
  if (rentalDepositWon > 0) {
    assets.push({
      id: `asset-deposit-${Date.now()}`,
      owner: 'self',
      type: 'deposit',
      description: '보증금',
      marketValue: rentalDepositWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }

  const debts: DebtItem[] = [];
  const banksWon = (profile.debtTypes?.banks || 0) * 10000;
  const cardsWon = (profile.debtTypes?.cards || 0) * 10000;
  const personalsWon = (profile.debtTypes?.personals || 0) * 10000;
  const priorityDebtWon = (profile.priorityDebt || 0) * 10000;

  if (banksWon > 0) {
    debts.push({
      id: `debt-banks-${Date.now()}`,
      creditor: '은행 대출',
      principal: banksWon,
      interest: 0,
      type: 'secured',
      isRecent: profile.hasRecentJobChange || false,
      isGamblingOrLuxury: false
    });
  }
  if (cardsWon > 0) {
    debts.push({
      id: `debt-cards-${Date.now()}`,
      creditor: '카드 대금',
      principal: cardsWon,
      interest: 0,
      type: 'unsecured',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }
  if (personalsWon > 0) {
    debts.push({
      id: `debt-personals-${Date.now()}`,
      creditor: '대부/기타 채무',
      principal: personalsWon,
      interest: 0,
      type: 'unsecured',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }
  if (priorityDebtWon > 0) {
    debts.push({
      id: `debt-priority-${Date.now()}`,
      creditor: '국세/지방세 체납 세금',
      principal: priorityDebtWon,
      interest: 0,
      type: 'tax',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }

  // 추가생계비 집계 (만원 -> 원)
  let extraHousingWon = 0;
  let extraMedicalWon = 0;
  let extraEducationWon = 0;
  let extraOtherWon = 0;
  if (profile.extraExpensesList && Array.isArray(profile.extraExpensesList)) {
    for (const exp of profile.extraExpensesList) {
      const amtWon = (exp.amount || 0) * 10000;
      if (exp.category === 'housing') extraHousingWon += amtWon;
      else if (exp.category === 'medical') extraMedicalWon += amtWon;
      else if (exp.category === 'education') extraEducationWon += amtWon;
      else extraOtherWon += amtWon;
    }
  }

  // 부양가족 자동 집계
  let computedMinorChildren = (profile.dependents || 0) + (profile.nonCohabitingMinorChildren || 0);
  let computedOtherDependents = 0;
  if (profile.familyMembers && profile.familyMembers.length > 0) {
    const minorKids = profile.familyMembers.filter(m => m.relationship === '자녀' && (m.isMinor ?? true));
    // 법정 부양가족 적격(isEligibleDependent)인 성인만 추가 가구원으로 인정 (기존 isDependent는 존재하지 않는 필드라 항상 0명)
    const adultDeps = profile.familyMembers.filter(m => m.isEligibleDependent && (m.relationship !== '자녀' || !(m.isMinor ?? true)));
    if (minorKids.length > 0) {
      computedMinorChildren = minorKids.length + (profile.nonCohabitingMinorChildren || 0);
    }
    computedOtherDependents = adultDeps.length;
  } else if (profile.supportParents) {
    let parentCount = 0;
    if (profile.cohabitingFather) parentCount++;
    if (profile.cohabitingMother) parentCount++;
    computedOtherDependents = parentCount;
  }

  return {
    clientName: profile.companyNameMasked || '의뢰인',
    // 계산 전용 매핑 — 실제 연락처가 없으면 가짜 번호를 채우지 않는다
    phoneNumber: profile.phone || profile.clientPhone || '',
    birthDate: (profile as any).birthDate || '1991-01-01', // 생년 미입력 시 계산용 기본값(나이 요건 판정에만 사용)
    consultDate: new Date().toISOString().split('T')[0],
    dbVendor: '',
    caseType: 'rehab',
    applyYear: 2026,
    residence: profile.residenceRegion || '서울',
    workplace: '',
    selectedCourt: profile.residenceRegion === '서울' ? '서울회생법원' :
                   profile.residenceRegion === '부산' ? '부산회생법원' :
                   profile.residenceRegion === '수원' ? '수원회생법원' : '서울회생법원',
    maritalStatus: profile.maritalStatus === 'SINGLE' ? 'single' : profile.maritalStatus === 'MARRIED' ? 'married' : 'divorced',
    spouseIncome: (profile.spouseIncome || 0) * 10000,
    spouseAsset: (profile.spouseAsset || 0) * 10000,
    minorChildren: computedMinorChildren,
    minorChildrenFullRecognition: false,
    otherDependents: computedOtherDependents,
    incomeSources,
    monthlyLivingCost: 0,
    monthlyRent: extraHousingWon,
    monthlyInsurance: 0,
    extraLivingCost: {
      utilities: 0,
      education: extraEducationWon,
      specialEducation: 0,
      medical: extraMedicalWon,
      other: extraOtherWon
    },
    specialCircumstances: {
      singleParent: false,
      basicLivelihood: false,
      rentFraud: false,
      severeDisability: false
    },
    assets,
    debts,
    prevHistory: {
      exists: false
    },
    consultationLogs: [],
    speculativeLoss: (profile.speculativeLoss || 0) * 10000,
    gamblingLoss: (profile.gamblingLoss || 0) * 10000,
    legalActions: profile.legalActions || [],
    retirementPensionType: profile.retirementPensionType || 'unknown',
    retirementPay: (profile.retirementPay || 0) * 10000
  };
};

interface ClientRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: LawyerType[];
  /** 서버 저장까지 끝나면 true를 돌려준다 (void를 돌려주는 구현은 성공으로 본다) */
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer' | 'system', senderId: string, name: string, targetLawyerId?: string) => void | Promise<boolean>;
  /** 전송 실패한 의뢰인 메시지를 같은 id로 다시 보낸다 */
  onRetryMessage?: (messageId: string) => Promise<boolean>;
  newsArticles: NewsArticle[];
  setNewsArticles: React.Dispatch<React.SetStateAction<NewsArticle[]>>;
  qas: ClientQA[];
  setQas: React.Dispatch<React.SetStateAction<ClientQA[]>>;
  reviews: SuccessReview[];
  setReviews: React.Dispatch<React.SetStateAction<SuccessReview[]>>;
  banners: MainBanner[];
  setBanners: React.Dispatch<React.SetStateAction<MainBanner[]>>;
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  matchingCooldownHours: number;
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  onLogActivity: (memberId: string, memberName: string, role: MemberRole, action: ActivityLog['action'], details: string) => void;
  platformConfig: PlatformConfig;
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  popupConfig?: PopupConfig;
  lawyerInquiries?: LawyerInquiry[];
  setLawyerInquiries?: React.Dispatch<React.SetStateAction<LawyerInquiry[]>>;
}

export default function ClientRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  onAddMessage,
  onRetryMessage,
  newsArticles,
  setNewsArticles,
  qas,
  setQas,
  reviews,
  setReviews,
  banners,
  setBanners,
  notices,
  setNotices,
  matchingCooldownHours,
  members,
  setMembers,
  onLogActivity,
  platformConfig,
  inquiries,
  setInquiries,
  popupConfig,
  lawyerInquiries,
  setLawyerInquiries
}: ClientRoleProps) {
  const dialog = useDialog();
  // Sub-navigation for user
  // 탭 ID·경로 매핑은 client/clientTabs.ts 한 곳에서 관리한다
  const [activeTab, setActiveTab] = useState<ClientTab>(readInitialClientTab);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [clientNotifications, setClientNotifications] = useState<ClientNotification[]>(() => { seedInitialNotifications(); return loadClientNotifications(); });
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  // 마이페이지 안에서 처음 보여 줄 탭. 비워 두면 마이페이지가 사건 상태로 정한다(계약 전 → 내 사건, 계약 후 → 회생동행)
  const [mypageSubTab, setMypageSubTab] = useState<MyPageSection | undefined>(undefined);

  // [SEO] 탭 전환 시 document.title + meta description 동적 갱신
  const currentMeta = TAB_META[activeTab] || TAB_META.landing;
  usePageMeta(currentMeta.title, currentMeta.description);

  const isPopStateRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 첫 진입 시 초기 브라우저 히스토리 상태 강제 세팅
    // OAuth 콜백(#access_token= 또는 ?code=)이면 Supabase가 처리할 수 있도록 URL을 건드리지 않는다
    if (!window.history.state) {
      const hash = window.location.hash;
      const search = window.location.search;
      const isOAuthCallback = hash.includes('access_token') || hash.includes('error') || search.includes('code=');
      if (!isOAuthCallback) {
        const params = new URLSearchParams(search);
        const tabParam = params.get('tab') || 'landing';
        window.history.replaceState({ tab: tabParam }, '', search || '?tab=landing');
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      const stateTab = event.state?.tab;
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      setActiveTab(isClientTab(stateTab) ? stateTab : isClientTab(tabParam) ? tabParam : 'landing');
      setTimeout(() => {
        isPopStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 뒤로 가기/앞으로 가기 이벤트에 의한 탭 변경 시 pushState 중복 호출 방지
    if (isPopStateRef.current) return;

    // OAuth 콜백 토큰 정보가 URL에 포함되어 있는 경우, pushState가 주소를 덮어써서 
    // Supabase 인증 처리를 방해하지 않도록 스킵합니다.
    const hash = window.location.hash;
    const search = window.location.search;
    const isOAuthCallback = hash.includes('access_token') || hash.includes('error') || search.includes('code=');
    if (isOAuthCallback) return;

    const currentState = window.history.state;
    if (!currentState || currentState.tab !== activeTab) {
      const params = new URLSearchParams(search);
      params.set('tab', activeTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ tab: activeTab }, '', newUrl);
      // 새 화면은 맨 위에서 시작한다(뒤로 가기는 브라우저 스크롤 복원에 맡김)
      window.scrollTo({ top: 0 });
    }
  }, [activeTab]);

  // ── 모바일 GNB 숨김 로직 ──
  const [isGnbHidden, setIsGnbHidden] = useState(false);
  // 챗봇(request) 탭에서는 항상 GNB 숨김
  const isChatbotActive = activeTab === 'request';

  // 모바일 전체 화면 챗봇이 열려 있는 동안 뒤 페이지가 스크롤되지 않게 한다
  useEffect(() => {
    if (!isChatbotActive || typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767.98px)');
    const apply = () => {
      document.documentElement.style.overflow = mq.matches ? 'hidden' : '';
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => {
      mq.removeEventListener?.('change', apply);
      document.documentElement.style.overflow = '';
    };
  }, [isChatbotActive]);

  // ── 공개 변호사 디렉토리: 관리자 승인 상태가 반영되는 앱 공용 목록 사용 (정적 mock 고정 사용 금지) ──
  // 실데이터가 없을 때 가상(mock) 변호사로 채우는 것은 개발 환경에서만 허용한다
  const directoryLawyers = useMemo<LawyerType[]>(
    () => (lawyers && lawyers.length > 0 ? lawyers : (import.meta.env.DEV ? mockLawyers : [])).filter(l =>
      // 변호사 자격자만 공개 (직원·실장 계정 노출 시 비변호사 법률사무 오인 소지)
      l.role === 'LAWYER' &&
      // 테스트 계정은 프로덕션 디렉토리에서 제외
      !(import.meta.env.PROD && l.id.startsWith('test-lawyer'))
    ),
    [lawyers]
  );

  // ── 변호사 프로필 보기 상태 ──
  const [selectedProfileLawyer, setSelectedProfileLawyer] = useState<LawyerType | null>(null);

  const handleOpenLawyerProfile = (lawyerId: string) => {
    const found = lawyers.find(l => l.id === lawyerId);
    if (found) {
      setSelectedProfileLawyer(found);
    } else {
      const mockFound = directoryLawyers.find(l => l.id === lawyerId);
      if (mockFound) {
        setSelectedProfileLawyer(mockFound);
      } else {
        setActiveTab('lawyers');
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let focusTimeout: ReturnType<typeof setTimeout>;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        clearTimeout(focusTimeout);
        setIsGnbHidden(true);
      }
    };

    const handleFocusOut = () => {
      focusTimeout = setTimeout(() => {
        setIsGnbHidden(false);
      }, 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      clearTimeout(focusTimeout);
    };
  }, []);

  // ── 모바일 키보드 대응: visualViewport API ──
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      const vv = window.visualViewport!;
      // 모바일 전체 화면 챗봇: 키보드가 올라오면 보이는 영역 높이·위치에 맞춘다
      document.documentElement.style.setProperty('--chatbot-vh', `${vv.height}px`);
      document.documentElement.style.setProperty('--chatbot-vv-top', `${vv.offsetTop}px`);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const [pendingChatbotData, setPendingChatbotData] = useState<{ res: RehabCalculationResult; input: RehabUserInput } | null>(null);
  // 내 상황 체크 진행 상황 (데스크톱 옆 패널 표시용)
  const [chatbotSnapshot, setChatbotSnapshot] = useState<RehabChatProgressSnapshot | null>(null);

  const handleUpdateFinancialProfile = (updatedProfile: FinancialProfile) => {
    if (!activeRequest) return;

    const intakeData = mapProfileToIntakeData(updatedProfile);
    const result = calculateRehabPlan(intakeData, effectiveSettings);

    let banks = 0;
    let cards = 0;
    let personals = 0;
    let recentLoans = 0;
    let coinCrypto = 0;
    
    intakeData.debts.forEach(d => {
      const amt = Math.round(d.principal / 10000);
      if (d.isRecent) recentLoans += amt;
      if (d.isGamblingOrLuxury) coinCrypto += amt;
      
      if (d.type === 'secured') {
        banks += amt;
      } else if (d.type === 'tax') {
        personals += amt;
      } else {
        cards += amt;
      }
    });

    const riskFlags: string[] = [];
    result.alerts.forEach(a => {
      riskFlags.push(a.message);
    });
    if (intakeData.debts.some(d => d.isRecent)) riskFlags.push('최근 대출 비중 높음 (30% 이상)');
    if (intakeData.debts.some(d => d.isGamblingOrLuxury)) riskFlags.push('투자/사행성 손실 채무 포함');
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      riskFlags.push(`1년 이내 주식/코인 투자 손실: ${formatKoreanCurrency(intakeData.speculativeLoss)}`);
    }
    if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      riskFlags.push(`1년 이내 도박 채무: ${formatKoreanCurrency(intakeData.gamblingLoss)}`);
    }

    let specialNoteLine = '';
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 주식/코인 투자 손실액 ${formatKoreanCurrency(intakeData.speculativeLoss)}`;
    } else if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 도박으로 인한 채무액 ${formatKoreanCurrency(intakeData.gamblingLoss)}`;
    }

    const legalActionLabels: Record<string, string> = {
      collection_call: '독촉 전화/문자',
      court_order: '지급명령/소장 수령',
      seizure: '급여/계좌 압류',
      property_seizure: '부동산 가압류',
      credit_drop: '신용등급 하락 통보',
      none: '해당 없음'
    };
    const activeActions = (intakeData.legalActions || [])
      .filter(x => x !== 'none')
      .map(x => legalActionLabels[x] || x);
    const legalActionsStr = activeActions.length > 0 ? activeActions.join(', ') : '해당 없음';

    const updatedContent = `==================================
📋 의뢰인 종합 사전 자가진단 리포트 (수정됨)
==================================

[1. 가계 및 부양가족 현황]
• 거주지역 / 관할법원: ${intakeData.residence} / ${intakeData.selectedCourt}
• 혼인 상태: ${intakeData.maritalStatus === 'single' ? '미혼' : intakeData.maritalStatus === 'married' ? '기혼' : intakeData.maritalStatus === 'divorced' ? '이혼' : '기타'}
• 부양가족 구성: 미성년 자녀 ${intakeData.minorChildren}명 / 기타 부양가족 ${intakeData.otherDependents}명 (가구원 수: ${intakeData.minorChildren + intakeData.otherDependents + 1}인 가구)

[2. 소득 및 자산 현황]
• 직업 분류: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : intakeData.incomeSources[0]?.type === 'business' ? '자영업/개인사업자' : intakeData.incomeSources[0]?.type === 'freelancer' ? '프리랜서' : '무직'}
• 월 평균 실수령액: ${formatKoreanCurrency(result.client.monthlyIncome)}
• 인정 생계비: ${formatKoreanCurrency(result.base.living)}
• 가용 소득 (예상 월납입금): ${formatKoreanCurrency(result.base.disposable)}
• 총 자산가치 (청산가치): ${formatKoreanCurrency(result.base.liq)}
  - 임대보증금: ${formatKoreanCurrency((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0))}
  - 배우자 자산: ${formatKoreanCurrency((intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0))}
  - 예상 퇴직금: ${intakeData.retirementPay ? formatKoreanCurrency(intakeData.retirementPay) : '없음'}${
      intakeData.retirementPensionType === 'pension' ? ' (퇴직연금 가입 - 0% 반영)' :
      intakeData.retirementPensionType === 'none' ? ' (퇴직연금 미가입 - 50% 반영)' :
      intakeData.retirementPensionType === 'unknown' ? ' (퇴직연금 종류 모름 - 50% 반영)' : ''
    }

[3. 채무 구성 및 특이사항]
• 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)} (채권자 수: ${intakeData.debts.length}곳)
  - 세금/체납 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.type === 'tax')?.principal || 0))}
  - 신용카드 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.creditor.includes('카드'))?.principal || 0))}
• 회생/조정 이력: ${intakeData.prevHistory?.exists ? '있음' : '없음'}
• 주의 위험 지표: ${riskFlags.join(', ') || '없음'}${specialNoteLine}${
      intakeData.retirementPensionType === 'unknown' ? '\n• ⚠️ [확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : ''
    }
• 현재 법적 조치: ${legalActionsStr}

----------------------------------
💡 참고:
- 가용 소득·청산가치는 의뢰인 입력값 기준 자동 계산입니다.
- 소득·재산 자료로 사실관계를 확인해 주세요.
==================================`;

    setRequests(prev => prev.map(req => {
      if (req.id === activeRequest.id) {
        return {
          ...req,
          content: updatedContent,
          financialProfile: {
            ...updatedProfile,
            riskFlags
          }
        };
      }
      return req;
    }));

    const clientName = isLoggedIn ? userAlias : '익명 의뢰인';
    const clientId = secureGetItem('legal_crm_client_id') || 'client-temp';
  };


  // 관리자 환경설정 로드 (localStorage → AppSettings)
  const [effectiveSettings, setEffectiveSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    fetchSettings().then(s => setEffectiveSettings(s)).catch(() => {});
  }, []);

  // Client 1:1 Inquiry state
  const [inquiryTitle, setInquiryTitle] = useState<string>('');
  const [inquiryContent, setInquiryContent] = useState<string>('');

  // 변호사 찾기 '여러 명 골라 요청하기' 모드. 모바일 하단 메뉴 대신 선택 바를 보여 주므로 여기서 상태를 가진다
  const [lawyerSelectionMode, setLawyerSelectionMode] = useState(false);
  // 내 관리방에서 '변호사 더 찾기'로 들어오면 그 상담방의 요청에 변호사를 더한다
  const [lawyerSelectionTargetId, setLawyerSelectionTargetId] = useState<string | null>(null);
  const [pendingNewRequest, setPendingNewRequest] = useState<any>(null);
  // 특정 변호사 프로필·글에서 '상담 요청'으로 시작한 진단: 결과 화면의 상담 요청 버튼에서 그 변호사에게 동의 후 요청
  const [directIntent, setDirectIntent] = useState<{ requestId: string; lawyerId: string } | null>(null);

  const checkCooldown = (): boolean => {
    if (matchingCooldownHours === 0) return true;

    const clientRequests = requests.filter(r => r.clientId === 'client-temp');
    if (clientRequests.length === 0) return true;

    const sorted = [...clientRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestRequest = sorted[0];

    const latestTime = new Date(latestRequest.createdAt).getTime();
    const currentTime = Date.now();
    const diffMs = currentTime - latestTime;
    const cooldownMs = matchingCooldownHours * 60 * 60 * 1000;

    if (diffMs < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - diffMs) / (60 * 60 * 1000));
      toast.info(`${remainingHours}시간 후에 새 상담 요청을 보낼 수 있습니다.`);
      return false;
    }

    return true;
  };

  /**
   * 상담 요청에 변호사를 더하고 안내문을 남긴다.
   * 변호사 찾기 선택 모드와 내 관리방 '좋아요 변호사' 목록이 같은 규칙을 쓴다:
   * 기존 요청 대상은 유지하고, 한도(3명)를 넘는 변호사는 제외하며, 새로 더해진 변호사에게만 알린다.
   * @returns 새로 요청 대상이 된 변호사 수
   */
  const requestLawyersForConsult = (request: ConsultRequest, lawyerIds: string[], options: { isNew?: boolean } = {}): number => {
    const merge = mergeLawyerRequest(request.selectedLawyerIds, lawyerIds);
    const reopen = request.status === 'cancelled' || request.status === 'closed';
    const nextRequest: ConsultRequest = {
      ...request,
      selectedLawyerIds: merge.selectedLawyerIds,
      requestType: 'direct_multi',
      maxParticipants: Math.max(1, merge.selectedLawyerIds.length),
      status: reopen ? 'requested' : request.status,
    };

    if (options.isNew) {
      setRequests(prev => [nextRequest, ...prev.filter(r => r.id !== nextRequest.id)]);
    } else {
      setRequests(prev => prev.map(r => (r.id === request.id
        ? { ...r, selectedLawyerIds: merge.selectedLawyerIds, requestType: 'direct_multi' as const, maxParticipants: nextRequest.maxParticipants, status: reopen ? 'requested' as const : r.status }
        : r)));
    }

    if (merge.overflowLawyerIds.length > 0) {
      toast.info(`한 상담에는 변호사 ${LAWYER_REQUEST_LIMIT}명까지 요청할 수 있어 ${merge.overflowLawyerIds.length}명은 요청하지 않았습니다.`);
    }

    if (merge.addedLawyerIds.length > 0) {
      const addedIds = merge.addedLawyerIds;
      // 안내문이 '○○ 변호사님'으로 끝나므로 이름에 붙은 '변호사'는 뗀다
      const names = addedIds
        .map(id => directoryLawyers.find(x => x.id === id))
        .filter((l): l is LawyerType => !!l)
        .map(getLawyerDisplayName);
      // 상담 요청 행이 서버에 먼저 있어야 안내문이 저장된다(외래키). 임의 지연 대신 요청 저장이 끝난 뒤 보낸다.
      void saveConsultRequest(nextRequest).catch(() => {}).finally(() => {
        // 의뢰인 화면 전용 안내문 ('client-only' → 변호사 화면에는 보이지 않음)
        onAddMessage(request.id, buildClientRequestNotice(names, addedIds.length), 'system', 'system', '시스템 안내', 'client-only');
        // 새로 요청받은 변호사에게만 개별 안내 (다른 변호사 이름은 알리지 않음)
        addedIds.forEach(lawyerId => {
          onAddMessage(request.id, LAWYER_REQUEST_RECEIVED_NOTICE, 'system', 'system', '시스템 안내', lawyerId);
        });
      });
    }
    return merge.addedLawyerIds.length;
  };

  /** 공개 요청: 등록·승인된 변호사가 요청을 확인하고 제안서를 보낼 수 있게 연다 (DB 규칙: status=requested AND request_type=open) */
  const openRequestForMatching = (request: ConsultRequest) => {
    setRequests(prev => prev.map(r => (r.id === request.id
      ? { ...r, requestType: 'open' as const, maxParticipants: LAWYER_REQUEST_LIMIT, status: 'requested' as const }
      : r)));
    const nextRequest: ConsultRequest = { ...request, requestType: 'open', maxParticipants: LAWYER_REQUEST_LIMIT, status: 'requested' };
    void saveConsultRequest(nextRequest).catch(() => {}).finally(() => {
      onAddMessage(request.id, OPEN_REQUEST_CLIENT_NOTICE, 'system', 'system', '시스템 안내', 'client-only');
    });
  };

  // ── 변호사에게 상담 정보 제공(개인정보 제3자 제공) 동의 ──
  // 로그인 때 받지 않고, 상담 정보를 실제로 보내는 순간마다 받는 변호사를 보여 주고 동의를 받는다.
  interface PendingThirdPartyConsent {
    request: ConsultRequest;
    scope: 'selected' | 'open';
    /** selected: 요청하려는 변호사 (이미 요청한 변호사는 병합 시 제외) */
    lawyerIds: string[];
    isNew?: boolean;
  }
  const [pendingConsent, setPendingConsent] = useState<PendingThirdPartyConsent | null>(null);

  /** 고른 변호사에게 상담을 요청하기 전에 동의 창을 연다 */
  const requestLawyersWithConsent = (request: ConsultRequest, lawyerIds: string[], options: { isNew?: boolean } = {}) => {
    const preview = mergeLawyerRequest(request.selectedLawyerIds, lawyerIds);
    if (preview.addedLawyerIds.length === 0) {
      toast.info(preview.overflowLawyerIds.length > 0
        ? `한 상담에는 변호사 ${LAWYER_REQUEST_LIMIT}명까지 요청할 수 있습니다. 기존 요청을 취소하면 다시 고를 수 있어요.`
        : '이미 상담을 요청한 변호사입니다.');
      return;
    }
    setPendingConsent({ request, scope: 'selected', lawyerIds, isNew: options.isNew });
  };

  /** 공개 요청 전에 동의 창을 연다 */
  const requestOpenMatchingWithConsent = (request: ConsultRequest) => {
    setPendingConsent({ request, scope: 'open', lawyerIds: [] });
  };

  const consentRecipients = useMemo(() => {
    if (!pendingConsent || pendingConsent.scope !== 'selected') return [];
    const { addedLawyerIds } = mergeLawyerRequest(pendingConsent.request.selectedLawyerIds, pendingConsent.lawyerIds);
    return addedLawyerIds.map(id => {
      const lawyer = directoryLawyers.find(l => l.id === id);
      // 동의 창이 '○○ 변호사'로 표시하므로 이름에 붙은 '변호사'는 뗀다
      return { id, name: lawyer ? getLawyerDisplayName(lawyer) : '선택한', firmName: lawyer?.firmName || lawyer?.firm || '' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConsent]);

  const handleThirdPartyConsentAgreed = async () => {
    const pending = pendingConsent;
    if (!pending) return;
    // 동의 창을 연 뒤 서버 동기화로 바뀐 내용이 있으면 최신 상담 요청을 기준으로 반영한다
    const latest = pending.isNew ? pending.request : (requests.find(r => r.id === pending.request.id) || pending.request);

    if (pending.scope === 'selected') {
      const { addedLawyerIds } = mergeLawyerRequest(latest.selectedLawyerIds, pending.lawyerIds);
      await recordThirdPartyConsent({ requestId: latest.id, scope: 'selected', lawyerIds: addedLawyerIds });
      const added = requestLawyersForConsult(latest, pending.lawyerIds, { isNew: pending.isNew });
      if (added > 0) toast.success(`변호사 ${added}명에게 상담 요청을 보냈습니다.`);
      setLawyerSelectionMode(false);
      setLawyerSelectionTargetId(null);
      setPendingNewRequest(null);
    } else {
      await recordThirdPartyConsent({ requestId: latest.id, scope: 'open', lawyerIds: [] });
      openRequestForMatching(latest);
      toast.success('공개 요청을 올렸습니다. 제안서가 도착하면 알려 드릴게요.');
    }
    setActiveChatReqId(latest.id);
    setActiveTab('chat');
    setPendingConsent(null);
  };

  /**
   * 변호사 찾기에서 고른 변호사에게 요청 (받는 변호사 확인·동의 창을 연다).
   * 상담 요청과 내 관리방은 로그인 후 쓸 수 있으므로(결과 리포트와 같은 규칙) 로그인 전이면 고른 변호사를 보관하고 로그인 창을 연다.
   */
  const requestFromDirectory = (target: ConsultRequest, lawyerIds: string[]) => {
    if (!isLoggedIn) {
      stashPendingLawyerRequest(target.id, lawyerIds);
      toast.info('상담 요청은 로그인 후 보낼 수 있어요. 로그인하면 고른 변호사를 확인하는 화면이 이어서 열립니다.');
      setShowAuthModal(true);
      return;
    }
    requestLawyersWithConsent(target, lawyerIds);
  };

  // 변호사 찾기 선택 모드에서 선택 완료 시 호출 (동의 후 요청). 대상 요청은 lawyerRequestTarget 참고
  const handleConfirmLawyerSelection = (lawyerIds: string[]) => {
    const target = lawyerRequestTarget;
    if (!target) {
      toast.info('내 상황 체크를 먼저 마치면 변호사에게 상담을 요청할 수 있습니다.');
      return;
    }
    requestFromDirectory(target, lawyerIds);
  };

  /**
   * 변호사 카드·프로필의 '상담 요청'.
   * 체크를 마친 진행 중 요청이 있으면 받는 변호사를 확인하는 동의 창을 바로 열고,
   * 없으면 그 변호사를 정해 둔 채 내 상황 체크부터 시작한다(결과 화면의 상담 요청에서 그 변호사에게 동의 후 전달).
   */
  const handleConsultLawyer = (lawyerId: string) => {
    const target = lawyerRequestTarget;
    if (target) {
      requestFromDirectory(target, [lawyerId]);
      return;
    }
    const l = directoryLawyers.find(x => x.id === lawyerId);
    if (l) setTitle(`${getLawyerDisplayName(l)} 변호사 상담 요청`);
    setSelectedLawyerId(lawyerId);
    setRequestType('direct');
    setRequestStep(1);
    setActiveTab('request');
  };
  
  // 홈(랜딩) 섹션 상태와 DEV 전용 광고 쇼케이스는 client/landing/* 컴포넌트가 직접 관리한다

  const [qnaSearchQuery, setQnaSearchQuery] = useState<string>('');
  const [qnaCategoryFilter, setQnaCategoryFilter] = useState<string>('전체');
  const [qnaPage, setQnaPage] = useState<number>(1);

  // News States
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<string>('전체');
  const [newsPage, setNewsPage] = useState<number>(1);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);


  // User Auth & Privacy States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [isEditingAlias, setIsEditingAlias] = useState<boolean>(false);
  const [tempAlias, setTempAlias] = useState<string>('');
  const [alertMode, setAlertMode] = useState<'NORMAL' | 'STEALTH' | 'SECRET'>('STEALTH');
  const [senderNameOverride, setSenderNameOverride] = useState<string>('my김변');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showInquiryPopup, setShowInquiryPopup] = useState<boolean>(false);
  const [showLogoutSuccessModal, setShowLogoutSuccessModal] = useState<boolean>(false);
  const [showResetDiagnosisModal, setShowResetDiagnosisModal] = useState<boolean>(false);
  const [pendingDiagnosisAfterLogin, setPendingDiagnosisAfterLogin] = useState<boolean>(false);

  // 채무 상황 체크 시작 클릭 처리 (로그인 불필요 → 기존 데이터가 있을 경우 커스텀 팝업)
  const handleStartDiagnosisClick = () => {
    // 로그인 여부와 관계없이 바로 채무 입력 플로우 시작
    const hasData = isLoggedIn && requests.length > 0 && requests.some(r => r.financialProfile);
    if (hasData) {
      setShowResetDiagnosisModal(true);
    } else {
      forceStartNewDiagnosis();
    }
  };

  const forceStartNewDiagnosis = () => {
    setPendingChatbotData(null);
    setRequestType('open');
    setRequestStep(1);
    setActiveTab('request');
  };

  // Email and Real Auth States




  // Helper: Record client login/signup activity
  const recordClientLogin = async (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => {
    // Supabase user ID를 우선 사용 (도메인 간 일관성 보장)
    let targetId = secureGetItem('legal_crm_client_id');
    
    // Try to get Supabase user ID
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        targetId = data.session.user.id;
        secureSetItem('legal_crm_client_id', targetId);
      }
    } catch {}
    
    if (!targetId) {
      targetId = `client-${Date.now()}`;
      secureSetItem('legal_crm_client_id', targetId);
    }
    
    // 익명(client-temp) 상태에서 진행했던 진단/상담 요청을 로그인한 계정으로 이전
    setRequests(prev => prev.map(r => r.clientId === 'client-temp' ? { ...r, clientId: targetId!, clientName: alias } : r));
    
    // Supabase DB에서도 마이그레이션
    migrateAnonymousRequests(targetId!, alias).catch(() => {});
    
    setMembers(prev => {
      const exists = prev.find(m => m.id === targetId || m.alias === alias);
      if (exists) {
        return prev.map(m => m.id === exists.id ? { ...m, lastActiveAt: new Date().toISOString(), loginChannel: channel } : m);
      } else {
        const newMember: Member = {
          id: targetId!,
          alias: alias,
          email: emailOrPhone.includes('@') ? emailOrPhone : undefined,
          phone: !emailOrPhone.includes('@') ? emailOrPhone : undefined,
          role: 'CLIENT',
          createdAt: new Date().toISOString(),
          loginChannel: channel,
          status: 'active',
          lastActiveAt: new Date().toISOString()
        };
        return [...prev, newMember];
      }
    });
  };



  // Suspended, Withdrawn, or Dormant check hook
  useEffect(() => {
    if (isLoggedIn && userAlias) {
      const currentMember = members.find(m => m.alias === userAlias);
      if (currentMember) {
        if (currentMember.status === 'suspended' || currentMember.status === 'withdrawn') {
          const msg = currentMember.status === 'withdrawn'
            ? '탈퇴 완료된 계정입니다. 해당 계정 정보를 더 이상 이용할 수 없습니다.'
            : '이 계정은 운영정책 위반 또는 스팸으로 인해 일시 정지 처리되었습니다. 고객센터에 문의하십시오.';
          dialog.alert({
            title: '계정 이용 제한 안내',
            message: msg,
            variant: 'warning'
          });
          setIsLoggedIn(false);
          setUserAlias('');
          secureRemoveItem('legal_crm_client_alias');
        } else if (currentMember.status === 'dormant') {
          dialog.confirm({
            title: '휴면 계정 해제',
            message: '휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?',
            confirmText: '휴면 해제',
            variant: 'primary'
          }).then(confirmed => {
            if (confirmed) {
              setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
              toast.success('휴면이 해제되었습니다.');
            } else {
              setIsLoggedIn(false);
              setUserAlias('');
              secureRemoveItem('legal_crm_client_alias');
            }
          });
        }
      }
    }
  }, [isLoggedIn, userAlias, members, dialog]);

  // OTP and Verification Simulation States



  useEffect(() => {
    let isCancelled = false;
    let retry1: any = null;
    let retry2: any = null;
    let subscription: any = null;

    const initAuthLifecycle = async () => {
      // 1. 세션 생명주기 엄격 검증 (창 닫힘 재진입 차단 / F5 새로고침 30분 유휴 검증 / OAuth 복귀 승인)
      const { canRestore, reason } = await validateClientSessionOnMount();
      if (isCancelled) return;

      if (!canRestore) {
        // 창이 닫혔다 다시 열렸거나 30분 유휴 초과인 경우 → 세션 복원 차단
        setIsLoggedIn(false);
        setUserAlias('');
        if (reason === 'inactivity_timeout') {
          toast.info('보안을 위해 30분간 활동이 없어 세션이 자동 종료되었습니다.');
        }
        return;
      }

      // 2. 검증 통과(정상 새로고침 또는 OAuth 리턴) 시에만 Supabase 세션 연결
      const pendingOAuth = secureGetItem('pending_oauth_login') || localStorage.getItem('pending_oauth_login');
      const isPendingOAuth = !!pendingOAuth;

      // 세션 감지 시 처리 함수
      const handleSession = (session: any, _source: string) => {
        if (!session?.user || isCancelled) return;
        // Supabase user ID를 client ID로 사용
        if (session.user.id) {
          secureSetItem('legal_crm_client_id', session.user.id);
        }
        setIsLoggedIn(true);
        touchClientActivity();
        // 로그인 직전에 받은 필수 동의(약관·개인정보)를 계정에 기록 (보관된 동의가 없으면 아무것도 하지 않음)
        void commitPendingLoginConsent();
        const existingAlias = session.user.user_metadata?.alias as string | undefined;
        const metaAlias = existingAlias || generateAlias();
        setUserAlias(metaAlias);
        // 서버에서 가명 유일성 확보 (타인과 중복 시 재발급) 후, 신규/변경 가명은 계정에 저장
        ensureUniqueAlias(metaAlias).then(({ alias, changed }) => {
          if (changed) setUserAlias(alias);
          if (changed || !existingAlias) {
            supabase.auth.updateUser({ data: { alias } }).catch((err) => {
              console.warn('[alias] 가명 저장 실패:', err);
            });
          }
        }).catch(() => {});
        recordClientLogin(metaAlias, session.user.email || 'user@system', 'email');
        
        // OAuth 리다이렉트 직후이면 chat 탭으로 이동
        if (isPendingOAuth) {
          secureRemoveItem('pending_oauth_login');
          localStorage.removeItem('pending_oauth_login');
          setActiveTab('chat');
        }
      };

      // 1) getSession 즉시 확인
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isCancelled) handleSession(session, 'getSession');
      }).catch(_err => { /* silent */ });

      // 2) 지연 재시도 (Supabase _initialize 완료 대기)
      retry1 = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!isCancelled && session?.user) handleSession(session, 'retry-1s');
        });
      }, 1000);

      retry2 = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!isCancelled && session?.user) handleSession(session, 'retry-3s');
          else if (isPendingOAuth) {
            secureRemoveItem('pending_oauth_login');
            localStorage.removeItem('pending_oauth_login');
          }
        });
      }, 3000);

      // 3) 실시간 상태 변경 감지
      const { data: subData } = supabase.auth.onAuthStateChange((event, session) => {
        if (isCancelled) return;
        if (session?.user) {
          handleSession(session, `onAuthStateChange(${event})`);
        } else if (event === 'SIGNED_OUT') {
          setIsLoggedIn(false);
          setUserAlias('');
        }
      });
      subscription = subData?.subscription;
    };

    initAuthLifecycle();

    return () => {
      isCancelled = true;
      if (retry1) clearTimeout(retry1);
      if (retry2) clearTimeout(retry2);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // [SECURITY] 30분 무활동(유휴) 실시간 감시 및 타 탭 로그아웃 동기화
  useEffect(() => {
    if (!isLoggedIn) return;

    const cleanupWatcher = setupClientInactivityWatcher((msg) => {
      setIsLoggedIn(false);
      setUserAlias('');
      dialog.alert({
        title: '안심 보안 자동 로그아웃',
        message: msg,
        variant: 'warning',
      });
    });

    const cleanupRemote = listenToRemoteClientLogout(() => {
      setIsLoggedIn(false);
      setUserAlias('');
      toast.info('다른 탭 또는 기기에서 로그아웃되었습니다.');
    });

    return () => {
      cleanupWatcher();
      cleanupRemote();
    };
  }, [isLoggedIn, dialog]);
  
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

  // New Individual Rehabilitation states
  const [jobType, setJobType] = useState<'SALARIED' | 'BUSINESS' | 'DAILY' | 'FREELANCER'>('SALARIED');
  const [companyName, setCompanyName] = useState<string>('');
  const [employmentDate, setEmploymentDate] = useState<string>('');
  const [residenceRegion, setResidenceRegion] = useState<string>('서울');
  const [spouseAsset, setSpouseAsset] = useState<number>(0);
  const [spouseIncome, setSpouseIncome] = useState<number>(0);
  const [hasRecentJobChange, setHasRecentJobChange] = useState<boolean>(false);
  const [rentalDeposit, setRentalDeposit] = useState<number>(0);
  const [debtCause, setDebtCause] = useState<'LIVING' | 'BUSINESS' | 'INVESTMENT' | 'GUARANTEE' | 'OTHER'>('LIVING');
  const [harassmentLevel, setHarassmentLevel] = useState<'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE'>('CALL');
  const [creditorCount, setCreditorCount] = useState<number>(3);

  // Form final step
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [consentCheck, setConsentCheck] = useState<boolean>(false);
  
  // Filter for Directory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('전체');
  const [lawyerPage, setLawyerPage] = useState<number>(1);

  useEffect(() => {
    setLawyerPage(1);
  }, [searchQuery, selectedRegion]);

  // Currently opened Chat consultation request ID
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const [activeRemedyCategory, setActiveRemedyCategory] = useState<string | null>(null);
  const [initialQnACategory, setInitialQnACategory] = useState<string | null>(null);
  const [chatbotAnnouncement, setChatbotAnnouncement] = useState<string | null>(null);
  const [activeSolutionType, setActiveSolutionType] = useState<SolutionType | null>(null);
  const [entryCategory, setEntryCategory] = useState<{ type: 'debt_type' | 'solution' | 'general'; id: string; label: string } | null>(null);

  // Reviews page state
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState<string>('전체');
  const [reviewSearchQuery, setReviewSearchQuery] = useState<string>('');
  const [reviewPage, setReviewPage] = useState<number>(1);

  const currentClientId = secureGetItem('legal_crm_client_id') || 'client-temp';
  const clientRequests = React.useMemo(() => {
    return requests.filter(r => 
      r.clientId === currentClientId || 
      r.clientId === 'client-temp' ||
      (isLoggedIn && userAlias && (r.clientName === userAlias || r.clientName === `${userAlias} (의뢰인)`))
    );
  }, [requests, currentClientId, isLoggedIn, userAlias]);

  // 페이지 새로고침 시 활성 상담이 있으면 자동으로 채팅 탭 복원
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current || clientRequests.length === 0) return;
    // 활성 상담(counseling/responding) 또는 selectedLawyerIds가 있는 요청 찾기
    const activeConsult = clientRequests.find(r => 
      r.status === 'counseling' || r.status === 'responding'
    ) || clientRequests.find(r => 
      r.selectedLawyerIds && r.selectedLawyerIds.length > 0
    );
    if (activeConsult) {
      hasRestoredRef.current = true;
      setActiveChatReqId(activeConsult.id);
      // URL 파라미터로 특정 탭이 지정되지 않은 경우에만 자동 이동
      const params = new URLSearchParams(window.location.search);
      if (!params.get('tab')) {
        setActiveTab('chat');
      }
    }
  }, [clientRequests]);

  // 내 관리방에서 보고 있는 상담의 체크 결과를 우선한다 (상담이 여러 개일 때 '내 채무'가 다른 상담 것을 보여 주지 않도록)
  const activeRequest = clientRequests.find(r => r.id === activeChatReqId && !!r.financialProfile)
    || clientRequests.find(r => r.clientId === 'client-temp')
    || clientRequests[0];

  /**
   * 변호사 찾기에서 변호사를 더 요청할 상담 요청 (내 상황 체크를 마친 본인 요청만).
   * 우선순위: 내 관리방에서 '변호사 더 찾기'로 고른 상담 → 방금 마친 체크 → 보고 있던 상담방 → 가장 최근 진행 중 요청.
   * 변호사를 정해 상담을 이어가는 단계(counseling 이후)에는 더하지 않는다.
   */
  const lawyerRequestTarget = React.useMemo<ConsultRequest | null>(() => {
    const ADDABLE: ReadonlyArray<ConsultStatus> = ['requested', 'responding', 'comparing', 'cancelled'];
    const addable = (r: ConsultRequest | undefined): r is ConsultRequest =>
      !!r && !r.id.startsWith('req-mock-') && !!r.financialProfile && ADDABLE.includes(r.status);
    const preferred = [lawyerSelectionTargetId, pendingNewRequest?.id, activeChatReqId].filter((id): id is string => !!id);
    for (const id of preferred) {
      const r = clientRequests.find(x => x.id === id);
      if (addable(r)) return r;
    }
    return clientRequests.find(r => addable(r) && r.status !== 'cancelled') || null;
  }, [clientRequests, lawyerSelectionTargetId, pendingNewRequest?.id, activeChatReqId]);
  const lawyerTargetRequestedIds = React.useMemo(
    () => Array.from(new Set(lawyerRequestTarget?.selectedLawyerIds || [])),
    [lawyerRequestTarget]
  );

  // 로그인 전에 고른 변호사가 있으면 로그인 직후(소셜 로그인 복귀 포함) 받는 변호사 확인·동의 창을 이어서 연다
  useEffect(() => {
    if (!isLoggedIn) return;
    const pending = readPendingLawyerRequest();
    if (!pending) return;
    clearPendingLawyerRequest();
    const req = clientRequests.find(r => r.id === pending.requestId);
    if (req) requestLawyersWithConsent(req, pending.lawyerIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, clientRequests]);

  // 변호사 찾기를 떠나면 선택 모드를 끝낸다 (다음 방문 때 선택 바가 남아 있지 않도록)
  useEffect(() => {
    if (activeTab !== 'lawyers') {
      setLawyerSelectionMode(false);
      setLawyerSelectionTargetId(null);
    }
  }, [activeTab]);


  const activeResult = React.useMemo(() => {
    if (!activeRequest || !activeRequest.financialProfile) return undefined;
    const profile = activeRequest.financialProfile;
    const userInput: RehabUserInput = {
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
      legalActions: profile.legalActions || []
    };
    try {
      return calculateRepayment(userInput);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, [activeRequest]);







  // Routing and pre-filling request form from category grid
  const handleCategoryClick = (category: string) => {
    setActiveRemedyCategory(category);
  };

  const handleApplyRemedy = (categoryId: string) => {
    const item = remedyData[categoryId];
    if (!item) return;

    // Reset specific breakdowns
    setDebtBanks(0);
    setDebtCards(0);
    setDebtPersonals(0);
    setRecentLoans(0);
    setCoinCrypto(0);

    const { preset } = item;
    
    // Set basic preset fields
    setJobType(preset.jobType);
    setDebtCause(preset.debtCause);
    setHarassmentLevel(preset.harassmentLevel);
    setCreditorCount(preset.creditorCount);
    setDebtBanks(preset.debtBanks);
    setDebtCards(preset.debtCards);
    setDebtPersonals(preset.debtPersonals);
    setRecentLoans(preset.recentLoans);
    setCoinCrypto(preset.coinCrypto);
    setDebtTotal(preset.debtTotal);
    setIncome(preset.income);
    
    if (preset.assetsTotal !== undefined) {
      setAssetsTotal(preset.assetsTotal);
    } else {
      setAssetsTotal(1000); // default
    }

    setTitle(preset.title);
    setContent(preset.content);

    // 진입 카테고리 설정 (채무유형)
    setEntryCategory({ type: 'debt_type', id: categoryId, label: item.title });

    // Close remedy modal
    setActiveRemedyCategory(null);

    // 챗봇 상단 안내 메시지 설정
    setChatbotAnnouncement('정확한 상담을 위해서 채무 내용을 정리해야 합니다.\n실명과 전화번호는 노출되지 않습니다.');

    // Move to next step of request
    setRequestStep(2);
    setActiveTab('request');
  };

  // 비슷한 사례 보기 → QnA 탭으로 이동 (카테고리 필터 적용)
  const handleViewSimilarCases = (categoryId: string) => {
    const qnaCategoryMap: Record<string, string> = {
      card_loan: '추심 차단',
      bank_loan: '최근 대출 회생',
      high_interest: '추심 차단',
      guarantee: '개인파산 면책',
      investment: '코인/주식 손실',
      freelancer: '프리랜서 회생',
      seizure: '급여 압류',
      tax_delinquency: '전체',
    };
    setInitialQnACategory(qnaCategoryMap[categoryId] || '전체');
    setActiveRemedyCategory(null);
    setActiveTab('qna');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pre-fill request form from review card
  const handleReviewClick = (rev: SuccessReview) => {
    // 후기 클릭 시 해당 변호사의 프로필 모달을 엽니다 (로톡 스타일)
    // 상담 절차 예시(가상)는 특정 변호사와 연결하지 않으므로 전문가 목록으로 이동
    if (rev.isExample || !rev.lawyerId) {
      setActiveTab('lawyers');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    handleOpenLawyerProfile(rev.lawyerId);
  };

  // Filtered reviews for reviews tab
  const filteredReviews = reviews.filter(rev => {
    // Category match
    const categoryMatches = reviewCategoryFilter === '전체' || rev.category === reviewCategoryFilter;
    
    // Search match (title, content, lawyer name, tags)
    if (!reviewSearchQuery) return categoryMatches;
    
    const query = reviewSearchQuery.toLowerCase().trim();
    const searchMatches = 
      rev.title.toLowerCase().includes(query) ||
      rev.content.toLowerCase().includes(query) ||
      rev.lawyerName.toLowerCase().includes(query) ||
      rev.tags.some(t => t.toLowerCase().includes(query));
      
    return categoryMatches && searchMatches;
  });

  // Slicing reviews for pagination (9 items per page)
  const itemsPerPage = 9;
  const totalReviewPages = Math.ceil(filteredReviews.length / itemsPerPage);
  const activeReviewPage = Math.min(reviewPage, Math.max(1, totalReviewPages));
  const paginatedReviews = filteredReviews.slice(
    (activeReviewPage - 1) * itemsPerPage,
    activeReviewPage * itemsPerPage
  );

  // Slicing Q&A for pagination (10 items per page)
  const filteredQAs = qas.filter(qa => {
    // Category Filter
    if (qnaCategoryFilter !== '전체' && qa.category !== qnaCategoryFilter) return false;
    
    // Text Search Query
    if (!qnaSearchQuery) return true;
    const query = qnaSearchQuery.toLowerCase();
    return qa.question.toLowerCase().includes(query) || 
           qa.category.toLowerCase().includes(query) || 
           qa.answer.toLowerCase().includes(query) || 
           qa.lawyerName.toLowerCase().includes(query);
  });

  const qnaItemsPerPage = 10;
  const totalQnaPages = Math.ceil(filteredQAs.length / qnaItemsPerPage);
  const activeQnaPage = Math.min(qnaPage, Math.max(1, totalQnaPages));
  const paginatedQAs = filteredQAs.slice(
    (activeQnaPage - 1) * qnaItemsPerPage,
    activeQnaPage * qnaItemsPerPage
  );




  // Auto select active chat request for current client
  useEffect(() => {
    if (clientRequests.length > 0 && (!activeChatReqId || !clientRequests.some(r => r.id === activeChatReqId))) {
      setActiveChatReqId(clientRequests[0].id);
    }
  }, [clientRequests, activeChatReqId]);



  const mapChatbotDataToIntakeData = (
    result: RehabCalculationResult,
    input: RehabUserInput
  ): IntakeData => {
    const age = input.age || 35;
    const birthYear = 2026 - age;
    const birthDate = `${birthYear}-01-01`;
    const gender = input.gender;

    let maritalStatus: IntakeData['maritalStatus'] = 'single';
    if (input.maritalStatus === 'married') {
      maritalStatus = 'married';
    } else if (input.maritalStatus === 'divorced') {
      if (input.childSupportReceived && input.childSupportReceived > 0) {
        maritalStatus = 'divorced_receiving';
      } else if (input.childSupportPaid && input.childSupportPaid > 0) {
        maritalStatus = 'divorced_sending';
      } else {
        maritalStatus = 'divorced';
      }
    }

    const incomeSources: IncomeSource[] = [];
    const monthlyIncome = input.monthlyIncome || 0;
    if (input.employmentType === 'salary' || input.employmentType === 'both') {
      incomeSources.push({
        id: `inc-salary-${Date.now()}`,
        type: 'worker',
        amount: input.salaryIncome || monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'business' || input.employmentType === 'both') {
      incomeSources.push({
        id: `inc-business-${Date.now()}`,
        type: 'business',
        amount: input.businessIncome || monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'freelancer') {
      incomeSources.push({
        id: `inc-freelancer-${Date.now()}`,
        type: 'freelancer',
        amount: monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'daily') {
      incomeSources.push({
        id: `inc-daily-${Date.now()}`,
        type: 'worker_no_ins',
        amount: monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'none' || incomeSources.length === 0) {
      incomeSources.push({
        id: `inc-none-${Date.now()}`,
        type: 'unemployed',
        amount: monthlyIncome,
        tenureYears: 0,
        payType: 'bank'
      });
    }

    const assets: AssetDetail[] = [];
    if (input.myAssets && input.myAssets > 0) {
      assets.push({
        id: `asset-my-${Date.now()}`,
        owner: 'self',
        type: 'other',
        description: '본인 보유 자산',
        marketValue: input.myAssets,
        loanBalance: 0,
        hasPledge: false,
        isExempt: false
      });
    }

    if (input.spouseAssets && input.spouseAssets > 0) {
      assets.push({
        id: `asset-spouse-${Date.now()}`,
        owner: 'spouse',
        type: 'other',
        description: '배우자 보유 자산',
        marketValue: input.spouseAssets,
        loanBalance: 0,
        hasPledge: false,
        isExempt: false
      });
    }

    if (input.retirementPay && input.retirementPay > 0) {
      assets.push({
        id: `asset-severance-${Date.now()}`,
        owner: 'self',
        type: 'severance',
        description: input.retirementPensionType === 'pension' 
          ? '퇴직연금 (가입)' 
          : input.retirementPensionType === 'none' 
          ? '예상 퇴직금 (연금 미가입 - 50% 반영)' 
          : '예상 퇴직금 (연금 모름 - 50% 반영)',
        marketValue: input.retirementPay,
        loanBalance: 0,
        hasPledge: false,
        isExempt: input.retirementPensionType === 'pension'
      });
    }

    if (input.deposit && input.deposit > 0) {
      assets.push({
        id: `asset-deposit-${Date.now()}`,
        owner: input.housingContractHolder === 'spouse' ? 'spouse' : 'self',
        type: 'deposit',
        description: input.housingType === 'jeonse' ? '전세 보증금' : '월세 보증금',
        marketValue: input.deposit,
        loanBalance: input.depositLoan || 0,
        hasPledge: !!(input.depositLoan && input.depositLoan > 0),
        isExempt: false
      });
    }

    const debts: DebtItem[] = [];
    const totalDebt = input.totalDebt || 0;
    const creditCardDebt = input.creditCardDebt || 0;
    const priorityDebt = input.priorityDebt || 0;
    const unsecuredDebt = Math.max(0, totalDebt - creditCardDebt - priorityDebt);

    if (creditCardDebt > 0) {
      debts.push({
        id: `debt-card-${Date.now()}`,
        creditor: '신용카드/카드론 채무',
        principal: creditCardDebt,
        interest: 0,
        type: 'unsecured',
        isGamblingOrLuxury: input.riskFactor === 'gambling' || input.riskFactor === 'investment',
        isRecent: input.riskFactor === 'recent_loan'
      });
    }

    if (priorityDebt > 0) {
      debts.push({
        id: `debt-tax-${Date.now()}`,
        creditor: '세금/국세 체납 채무',
        principal: priorityDebt,
        interest: 0,
        type: 'tax',
        isGamblingOrLuxury: false,
        isRecent: false
      });
    }

    if (unsecuredDebt > 0 || debts.length === 0) {
      debts.push({
        id: `debt-unsecured-${Date.now()}`,
        creditor: '신용대출 및 기타채무',
        principal: unsecuredDebt > 0 ? unsecuredDebt : totalDebt,
        interest: 0,
        type: 'unsecured',
        isGamblingOrLuxury: input.riskFactor === 'gambling' || input.riskFactor === 'investment',
        isRecent: input.riskFactor === 'recent_loan'
      });
    }

    const prevHistory: PrevHistory = {
      exists: false
    };

    const specialCircumstances: SpecialCircumstances = {
      singleParent: input.specialCondition === 'single_parent',
      basicLivelihood: input.specialCondition === 'basic_recipient',
      rentFraud: input.specialCondition === 'rent_fraud',
      severeDisability: input.specialCondition === 'severe_disability'
    };

    const extraLivingCost: ExtraLivingCost = {
      utilities: 0,
      education: input.educationCost || 0,
      specialEducation: input.specialEducationCost || 0,
      medical: input.medicalCost || 0,
      other: 0,
      highIncomeExtraLimit: 0
    };

    const consultationLogs: ConsultationLog[] = [
      {
        id: `chat-log-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        consultantId: 'client',
        consultantName: input.name || '의뢰인',
        content: `챗봇 자가진단 실행완료.\n주요 조언:\n${result.aiAdvice ? result.aiAdvice.join('\n') : ''}`
      }
    ];

    const minorChildren = input.minorChildren || 0;
    const familySize = input.familySize || 1;

    return {
      clientName: input.name || '익명 의뢰인',
      phoneNumber: input.phone || '010-0000-0000',
      birthDate,
      gender,
      consultDate: new Date().toISOString().split('T')[0],
      applyYear: 2026,
      dbVendor: '온라인광고',
      caseType: 'individual_rehab',
      residence: input.address || '',
      workplace: input.workLocation || '',
      selectedCourt: result.courtName || '서울회생법원',
      prevHistory,
      maritalStatus,
      spouseIncome: input.spouseIncome || 0,
      childSupportCost: input.childSupportPaid || 0,
      minorChildren,
      minorChildrenFullRecognition: false,
      otherDependents: Math.max(0, familySize - 1 - minorChildren),
      incomeSources,
      monthlyLivingCost: result.baseLivingCost || 0,
      monthlyRent: input.rentCost || 0,
      monthlyInsurance: 0,
      extraLivingCost,
      specialCircumstances,
      assets,
      debts,
      speculativeLoss: input.speculativeLoss,
      gamblingLoss: input.gamblingLoss,
      legalActions: input.legalActions,
      retirementPensionType: input.retirementPensionType,
      retirementPay: input.retirementPay,
      notes: [
        input.retirementPensionType === 'unknown' ? '[확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : '',
        input.clientNote || ''
      ].filter(Boolean).join('\n') || undefined,
      clientNotes: input.clientNotes || (input.clientNote ? [input.clientNote] : []),
      housingType: input.housingType,
      housingContractHolder: input.housingContractHolder,
      depositLoan: input.depositLoan,
      age: input.age || (birthYear ? 2026 - birthYear : 35),
      specialCondition: input.specialCondition || (input.age && input.age >= 65 ? 'elderly' : (input.specialCondition as any) || 'none'),
      monthlyFixedExpenses: input.monthlyFixedExpenses || ((input.rentCost || 0) + (input.medicalCost || 0) + (input.educationCost || 0) + (input.specialEducationCost || 0)),
      spouseAsset: input.spouseAssets || 0,
      consultationLogs
    };
  };

  const handleIntakeSubmit = (intakeData: IntakeData, navigateToLawyers: boolean = true) => {
    if (!checkCooldown()) return;
    const result = calculateRehabPlan(intakeData, effectiveSettings);
    
    // Convert Won units to Man-won (10,000 KRW) units
    const incomeManWon = Math.round(result.client.monthlyIncome / 10000);
    const debtManWon = Math.round(result.base.debtTotal / 10000);
    const assetsManWon = Math.round(result.base.liq / 10000);
    
    // Calculate detailed debt types
    let banks = 0;
    let cards = 0;
    let personals = 0;
    let recentLoans = 0;
    let coinCrypto = 0;
    
    intakeData.debts.forEach(d => {
      const amt = Math.round(d.principal / 10000);
      if (d.isRecent) recentLoans += amt;
      if (d.isGamblingOrLuxury) coinCrypto += amt;
      
      if (d.type === 'secured') {
        banks += amt;
      } else if (d.type === 'tax') {
        personals += amt;
      } else {
        cards += amt;
      }
    });
    
    // Generate risk flags based on the rehabEngine simulation
    const riskFlags = [];
    result.alerts.forEach(a => {
      riskFlags.push(a.message);
    });
    if (intakeData.debts.some(d => d.isRecent)) riskFlags.push('최근 대출 비중 높음 (30% 이상)');
    if (intakeData.debts.some(d => d.isGamblingOrLuxury)) riskFlags.push('투자/사행성 손실 채무 포함');
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      riskFlags.push(`1년 이내 주식/코인 투자 손실: ${formatKoreanCurrency(intakeData.speculativeLoss)}`);
    }
    if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      riskFlags.push(`1년 이내 도박 채무: ${formatKoreanCurrency(intakeData.gamblingLoss)}`);
    }
    
    let specialNoteLine = '';
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 주식/코인 투자 손실액 ${formatKoreanCurrency(intakeData.speculativeLoss)}`;
    } else if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 도박으로 인한 채무액 ${formatKoreanCurrency(intakeData.gamblingLoss)}`;
    }

    const legalActionLabels: Record<string, string> = {
      collection_call: '독촉 전화/문자',
      court_order: '지급명령/소장 수령',
      seizure: '급여/계좌 압류',
      property_seizure: '부동산 가압류',
      credit_drop: '신용등급 하락 통보',
      none: '해당 없음'
    };
    const activeActions = (intakeData.legalActions || [])
      .filter(x => x !== 'none')
      .map(x => legalActionLabels[x] || x);
    const legalActionsStr = activeActions.length > 0 ? activeActions.join(', ') : '해당 없음';

    let harassmentLevel: 'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE' = 'CALL';
    if (intakeData.legalActions) {
      if (intakeData.legalActions.includes('seizure') || intakeData.legalActions.includes('property_seizure')) {
        harassmentLevel = 'SEIZURE';
      } else if (intakeData.legalActions.includes('court_order')) {
        harassmentLevel = 'LAWSUIT';
      } else if (intakeData.legalActions.includes('credit_drop')) {
        harassmentLevel = 'LETTER';
      }
    }

    // Construct the new ConsultRequest
    // 진단 결과는 본인만 보는 상담 요청으로 만든다. 변호사에게는 의뢰인이 받는 변호사를 확인하고
    // 동의(제3자 제공)한 뒤에만 공개된다. (이전: 기본값 'open'이라 진단을 마치는 즉시 모든 변호사에게 노출,
    // 특정 변호사 프로필에서 시작하면 그 변호사가 바로 '전담'으로 지정됨)
    // 특정 변호사에게 상담하려고 시작했다면 그 변호사는 결과 화면의 상담 요청 단계에서 동의 창에 먼저 보여 준다.
    const directIntentLawyerId = requestType === 'direct' && selectedLawyerId ? selectedLawyerId : null;
    const newRequest = {
      id: `req-${Date.now()}`,
      clientId: isLoggedIn ? (secureGetItem('legal_crm_client_id') || currentClientId || 'client-temp') : 'client-temp',
      clientName: isLoggedIn ? userAlias : '익명 의뢰인',
      // 연락처는 실제 입력값만 사용(가짜 기본 번호 금지)
      phone: intakeData.phoneNumber || '',
      requestType: 'direct_multi' as const,
      maxParticipants: LAWYER_REQUEST_LIMIT,
      selectedLawyerIds: [] as string[],
      status: 'requested' as const,
      createdAt: new Date().toISOString(),
      title: `${intakeData.clientName}님의 개인회생 상담 요청`,
      content: `==================================
📋 의뢰인 종합 사전 자가진단 리포트
==================================

[1. 가계 및 부양가족 현황]
• 거주지역 / 관할법원: ${intakeData.residence} / ${intakeData.selectedCourt}
• 혼인 상태: ${intakeData.maritalStatus === 'single' ? '미혼' : intakeData.maritalStatus === 'married' ? '기혼' : intakeData.maritalStatus === 'divorced' ? '이혼' : '기타'}
• 부양가족 구성: 미성년 자녀 ${intakeData.minorChildren}명 / 기타 부양가족 ${intakeData.otherDependents}명 (가구원 수: ${intakeData.minorChildren + intakeData.otherDependents + 1}인 가구)

[2. 소득 및 자산 현황]
• 직업 분류: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : intakeData.incomeSources[0]?.type === 'business' ? '자영업/개인사업자' : intakeData.incomeSources[0]?.type === 'freelancer' ? '프리랜서' : '무직'}
• 월 평균 실수령액: ${formatKoreanCurrency(result.client.monthlyIncome)}
• 인정 생계비: ${formatKoreanCurrency(result.base.living)}
• 가용 소득 (예상 월납입금): ${formatKoreanCurrency(result.base.disposable)}
• 총 자산가치 (청산가치): ${formatKoreanCurrency(result.base.liq)}
  - 임대보증금: ${formatKoreanCurrency((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0))}
  - 배우자 자산: ${formatKoreanCurrency((intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0))}
  - 예상 퇴직금: ${intakeData.retirementPay ? formatKoreanCurrency(intakeData.retirementPay) : '없음'}${
      intakeData.retirementPensionType === 'pension' ? ' (퇴직연금 가입 - 0% 반영)' :
      intakeData.retirementPensionType === 'none' ? ' (퇴직연금 미가입 - 50% 반영)' :
      intakeData.retirementPensionType === 'unknown' ? ' (퇴직연금 종류 모름 - 50% 반영)' : ''
    }

[3. 채무 구성 및 특이사항]
• 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)} (채권자 수: ${intakeData.debts.length}곳)
  - 세금/체납 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.type === 'tax')?.principal || 0))}
  - 신용카드 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.creditor.includes('카드'))?.principal || 0))}
• 회생/조정 이력: ${intakeData.prevHistory.exists ? '있음' : '없음'}
• 주의 위험 지표: ${riskFlags.join(', ') || '없음'}${specialNoteLine}${
    intakeData.retirementPensionType === 'unknown' ? '\n• ⚠️ [확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : ''
  }
• 현재 법적 조치: ${legalActionsStr}
${(intakeData.clientNotes && intakeData.clientNotes.length > 0) ? `
[4. 의뢰인 전달 메모]
• ${intakeData.clientNotes.join('\n• ')}` : (intakeData.notes ? `
[4. 의뢰인 전달 메모]
• ${intakeData.notes}` : '')}

----------------------------------
💡 참고:
- 가용 소득·청산가치는 의뢰인 입력값 기준 자동 계산입니다.
- 소득·재산 자료로 사실관계를 확인해 주세요.
==================================`,
      financialProfile: {
        clientId: isLoggedIn ? (secureGetItem('legal_crm_client_id') || currentClientId || 'client-temp') : 'client-temp',
        clientName: isLoggedIn ? userAlias : (intakeData.clientName || '익명 의뢰인'),
        age: intakeData.age || (intakeData.birthDate ? (2026 - parseInt(intakeData.birthDate.split('-')[0])) : 35),
        gender: intakeData.gender || 'male',
        income: incomeManWon,
        debtTotal: debtManWon,
        assetsTotal: assetsManWon,
        dependents: result.client.dependents,
        minorChildren: intakeData.minorChildren || 0,
        maritalStatus: (intakeData.maritalStatus === 'single' ? 'SINGLE' : intakeData.maritalStatus === 'married' ? 'MARRIED' : 'DIVORCED') as any,
        debtTypes: {
          banks,
          cards,
          personals,
          recentLoans,
          coinCrypto: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : (intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : coinCrypto)
        },
        riskFlags,
        jobType: intakeData.incomeSources[0]?.type === 'worker' ? 'SALARIED' : 
                 intakeData.incomeSources[0]?.type === 'business' ? 'BUSINESS' : 
                 (intakeData.incomeSources[0]?.type as any) === 'daily' || intakeData.incomeSources[0]?.type === 'worker_no_ins' ? 'DAILY' : 'FREELANCER',
        companyName: intakeData.workplace || '',
        companyNameMasked: intakeData.workplace ? intakeData.workplace.replace(/./g, (c, i) => i > 0 && i < intakeData.workplace.length - 1 ? '*' : c) : '미기재',
        employmentDate: intakeData.consultDate,
        residenceRegion: intakeData.residence,
        workLocation: intakeData.workplace || '',
        address: intakeData.residence || '',
        spouseAsset: Math.round((intakeData.spouseAsset || (intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0)) / 10000),
        spouseIncome: Math.round((intakeData.spouseIncome || 0) / 10000),
        hasRecentJobChange: intakeData.debts.some(d => d.isRecent),
        rentalDeposit: Math.round((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0) / 10000),
        rentCost: Math.round((intakeData.monthlyRent || 0) / 10000),
        depositLoan: Math.round((intakeData.depositLoan || 0) / 10000),
        housingType: intakeData.housingType,
        housingContractHolder: intakeData.housingContractHolder,
        debtCause: (intakeData.speculativeLoss ? 'INVESTMENT' : (intakeData.gamblingLoss ? 'GAMBLING' : 'LIVING')) as any,
        harassmentLevel,
        creditorCount: intakeData.debts.length || 3,
        priorityDebt: Math.round((intakeData.debts.find(d => d.type === 'tax')?.principal || 0) / 10000),
        speculativeLoss: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : undefined,
        gamblingLoss: intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : undefined,
        legalActions: intakeData.legalActions,
        retirementPensionType: intakeData.retirementPensionType,
        retirementPay: intakeData.retirementPay ? Math.round(intakeData.retirementPay / 10000) : undefined,
        specialCondition: (intakeData.specialCondition as any) || (intakeData.specialCircumstances?.basicLivelihood ? 'basic_recipient' : intakeData.specialCircumstances?.severeDisability ? 'severe_disability' : intakeData.specialCircumstances?.singleParent ? 'single_parent' : intakeData.specialCircumstances?.rentFraud ? 'rent_fraud' : 'none'),
        monthlyFixedExpenses: Math.round((intakeData.monthlyFixedExpenses || (intakeData.monthlyRent + (intakeData.extraLivingCost?.medical || 0) + (intakeData.extraLivingCost?.education || 0) + (intakeData.extraLivingCost?.specialEducation || 0))) / 10000),
        clientNote: intakeData.notes || undefined,
        clientNotes: intakeData.clientNotes || (intakeData.notes ? [intakeData.notes] : []),
        debts: (intakeData.debts || []).map(d => ({
          creditor: d.creditor,
          amount: Math.round(d.principal / 10000),
          type: d.type
        })),
        assets: intakeData.assets || [],
      },
      entryCategory: entryCategory || { type: 'general', id: 'direct', label: '일반 상담' },
    };
    
    // 진단 완료 즉시 requests에 저장 (본인 전용 — 변호사 공개 전)
    setRequests(prev => [newRequest, ...prev]);
    setPendingNewRequest(newRequest);
    setDirectIntent(directIntentLawyerId ? { requestId: newRequest.id, lawyerId: directIntentLawyerId } : null);
    // 다음 진단에 이전 지명 상태가 남지 않도록 초기화
    setRequestType('open');
    setSelectedLawyerId('');

    // 보고서 팝업의 "내 전담 변호사 선택하기" 버튼이 즐겨찾기 확인 → 팝업 방식으로 동작하도록
    // 자동 변호사 탭 이동 및 선택 모드 활성화를 하지 않음
  };

  /**
   * 1:1 상담 메시지 전송. 입력창은 바로 비우고, 말풍선에 '보내는 중 → 실패 시 다시 보내기'를 표시한다.
   * @param targetLawyerId 대화 상대 변호사 (비교 상담 중에는 반드시 지정 — ChatView가 없으면 전송을 막는다)
   * @returns 서버 저장까지 끝났으면 true
   */
  const handleSendChat = async (targetLawyerId?: string): Promise<boolean> => {
    const text = chatInput.trim();
    if (!text || !activeChatReqId) return false;
    setChatInput('');
    const delivery = onAddMessage(activeChatReqId, text, 'client', 'client-temp', isLoggedIn ? `${userAlias} (본인)` : '의뢰인 (본인)', targetLawyerId);

    // 개발 환경 전용 시뮬레이션: 서버 미연동 개발 빌드에서만 대화 상대 변호사 이름으로 자동 응답한다
    // (운영 빌드에서는 환경 변수가 빠져도 가짜 변호사 답변을 만들지 않는다)
    const isSupabaseConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL;
    if (import.meta.env.DEV && !isSupabaseConfigured) {
      const devRequest = requests.find(r => r.id === activeChatReqId);
      const replyLawyerId = targetLawyerId
        || devRequest?.selectedLawyerId
        || devRequest?.acceptedLawyerIds?.[0]
        || devRequest?.proposals?.[0]?.lawyerId;
      if (replyLawyerId) {
        const replyName = lawyers.find(l => l.id === replyLawyerId)?.name || '담당 변호사';
        const reqId = activeChatReqId;
        setTimeout(() => {
          onAddMessage(reqId, '[개발용 자동 응답] 메시지를 확인했습니다. 실제 서비스에서는 변호사가 직접 답변합니다.', 'lawyer', replyLawyerId, replyName);
        }, 2500);
      }
    }

    const delivered = (await delivery) !== false;
    if (!delivered) {
      toast.error('메시지를 보내지 못했습니다. 말풍선 아래 \'다시 보내기\'를 눌러 주세요.');
    }
    return delivered;
  };

  // Real Supabase and Fallback Auth Handlers

  const handleRegenAlias = async () => {
    if (!isLoggedIn) {
      // 가입 전: 후보만 보여주고, 로그인 세션 수립 시 서버에서 유일성 확보
      setUserAlias(generateAlias());
      return;
    }
    const { alias } = await ensureUniqueAlias();
    setUserAlias(alias);
    supabase.auth.updateUser({ data: { alias } }).catch(() => {});
  };

  // 마이페이지에서 가명 직접 변경 시 중복 검사 (true = 사용 가능하여 반영됨)
  const handleChangeAlias = async (nextAlias: string): Promise<boolean> => {
    const alias = nextAlias.trim();
    const res = await claimAlias(alias);
    if (res === 'taken') {
      toast.error('이미 다른 회원이 사용 중인 가명입니다. 다른 가명을 입력해 주세요.');
      return false;
    }
    if (res === 'invalid') {
      toast.error('가명은 2~20자이며 밑줄(_)은 사용할 수 없습니다.');
      return false;
    }
    setUserAlias(alias);
    supabase.auth.updateUser({ data: { alias } }).catch(() => {});
    return true;
  };

  // Helper values
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  // Auto scroll to bottom of chat feed when new messages arrive or when channel updates
  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [activeChatMessages]);

  // Formatted calculation
  const totalCalculatedDebt = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;



  // ── 화면 이동 공통: 알림 링크·안내 페이지 CTA·구버전 값도 여기서 정규화한다 ──
  const navigateTo = (raw: string) => {
    const target = resolveClientNavTarget(raw);
    if (target.kind === 'start-check') {
      handleStartDiagnosisClick();
      return;
    }
    // 마이페이지로 갈 때만 영역을 정한다 (영역 없이 가면 사건 상태에 맞는 탭)
    if (target.tab === 'mypage') setMypageSubTab(target.mypageSection);
    if (target.tab === 'notices') setSelectedNoticeId(null);
    setActiveTab(target.tab);
  };

  // ── 로그아웃 (헤더·전체 메뉴·마이페이지 공용) ──
  const handleLogout = async () => {
    await purgeClientSession();
    // 공용 기기 대비: 진행 중이던 채무 정리 대화도 이 기기에서 지운다
    try { localStorage.removeItem('roi_rehab_chatbot_session'); } catch { /* ignore */ }
    setIsLoggedIn(false);
    setUserAlias('');
    // 이 기기의 화면 상태만 비운다(계정에 저장된 기록은 다시 로그인하면 복원)
    setRequests([]);
    setMessages([]);
    setInquiries([]);
    setShowLogoutSuccessModal(true);
    setActiveTab('landing');
  };

  // ── 알림 ──
  const refreshNotifications = () => {
    setClientNotifications(loadClientNotifications());
    setUnreadCount(getUnreadCount());
  };
  useEffect(() => {
    refreshNotifications();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'client_notifications') refreshNotifications();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoggedIn]);

  const handleNotificationClick = (n: ClientNotification) => {
    if (!n.isRead) markAsRead(n.id);
    refreshNotifications();
    if (n.type === 'document_request') {
      setMypageSubTab('diagnosis');
      setActiveTab('mypage');
      return;
    }
    if (n.linkTab) navigateTo(n.linkTab);
  };
  const handleMarkAllNotificationsRead = () => {
    markAllAsRead();
    refreshNotifications();
  };
  // 상담 관련(메시지·진행 상태) 읽지 않은 알림이 있을 때만 '내 관리방'에 점 표시
  const hasUnreadConsultUpdate = isLoggedIn && clientNotifications.some(n => !n.isRead && (n.type === 'new_message' || n.type === 'status_change'));

  // 변호사 선택 모드에서는 하단 선택 확정 바가 GNB 자리를 쓴다
  // (LawyersView와 같은 조건: 요청할 상담이 있고 더 고를 자리가 있을 때만 선택 바가 뜬다)
  const isLawyerSelectionActive = activeTab === 'lawyers' && lawyerSelectionMode
    && !!lawyerRequestTarget && lawyerTargetRequestedIds.length < LAWYER_MAX_SELECTIONS;

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 font-sans">
      <div className="w-full min-h-screen mx-auto flex flex-col relative bg-white">
      <a
        href="#client-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:px-4 focus:py-3 focus:rounded-xl focus:bg-brand focus:text-white focus:font-bold"
      >
        본문으로 바로가기
      </a>

      <ClientHeader
        activeTab={activeTab}
        isLoggedIn={isLoggedIn}
        userAlias={userAlias}
        showLegalNews={!!platformConfig.showLegalNews}
        notifications={clientNotifications}
        unreadCount={unreadCount}
        hasUnreadConsultUpdate={hasUnreadConsultUpdate}
        onNavigate={(tab) => navigateTo(tab)}
        onStartCheck={handleStartDiagnosisClick}
        onOpenSettings={() => navigateTo('settings')}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onOpenNotifications={refreshNotifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      {/* Main Content Area */}
      <main id="client-main" tabIndex={-1} className="flex-1 w-full outline-none">

        {/* 홈(랜딩) */}
        {activeTab === 'landing' && (
          <LandingView
            qas={qas}
            reviews={reviews}
            newsArticles={newsArticles}
            showLegalNews={!!platformConfig.showLegalNews}
            remedies={Object.values(remedyData)}
            maxLawyerSelections={LAWYER_MAX_SELECTIONS}
            onStartCheck={handleStartDiagnosisClick}
            onBrowseLawyers={() => setActiveTab('lawyers')}
            onSelectRemedy={handleCategoryClick}
            onSelectSolution={(type) => setActiveSolutionType(type)}
            onConsultFromQa={(qa) => {
              setTitle(`${qa.category} 관련 상담 요청`);
              setContent(`참고한 상담 사례:\nQ. ${qa.question}\n\n위 사례와 비슷한 상황입니다. 제 경우에도 해당하는지 상담받고 싶습니다.`);
              handleStartDiagnosisClick();
            }}
            onViewAllQna={() => setActiveTab('qna')}
            onViewAllReviews={() => setActiveTab('reviews')}
            onViewAllNews={() => setActiveTab('news')}
            onOpenArticle={(art) => {
              setSelectedArticle(art);
              setNewsArticles(prev => prev.map(a => a.id === art.id ? { ...a, views: a.views + 1 } : a));
            }}
            onOpenLawyerProfile={handleOpenLawyerProfile}
            onOpenInquiry={() => setShowInquiryPopup(true)}
          />
        )}

        {activeTab !== 'landing' && (
        <div className={`w-full max-w-5xl mx-auto ${activeTab === 'request' ? 'md:px-6 md:py-6' : 'px-4 sm:px-6 lg:px-8 py-6 md:py-8'}`}>
          {/* 탭이 바뀌면 오류 경계를 새로 만든다(한 화면의 오류가 다른 화면에 남지 않게) */}
          <TabErrorBoundary key={activeTab} tabName={isClientTab(activeTab) ? CLIENT_TAB_LABELS[activeTab] : undefined} onNavigateHome={() => setActiveTab('landing')}>
          <React.Suspense fallback={<PageSkeleton />}>
            {/* TAB: 회생동행 (3~5년 변제관리 & 면책 완주) */}
            {/* 최상위 회생동행 = 소개 화면. 실제 관리는 마이페이지 '회생동행' 탭 (IA 통합안) */}
            {activeTab === 'companion' && (
              <CompanionIntroView
                lookupIds={[activeRequest?.id, isLoggedIn ? currentClientId : undefined, undefined]}
                onOpenCompanion={() => { setMypageSubTab('companion'); setActiveTab('mypage'); window.scrollTo({ top: 0 }); }}
                onStartCheck={handleStartDiagnosisClick}
              />
            )}

            {/* TAB: 변제금 계산기 */}
            {activeTab === 'calculator' && (<CalculatorView onNavigateToRequest={(data) => { setIncome(data.income); setDebtTotal(data.debtTotal); setDependents(data.dependents); if(data.title) setTitle(data.title); if(data.content) setContent(data.content); if(data.requestType) setRequestType(data.requestType); setRequestStep(data.step); handleStartDiagnosisClick(); }} />)}


            {/* TAB: SUCCESS TESTIMONIALS/REVIEWS */}
            {activeTab === 'reviews' && (<ReviewsView reviews={reviews} onReviewClick={handleReviewClick} />)}

            {/* TAB: CLIENT 1:1 INQUIRY BOARD */}
            {activeTab === 'inquiry' && (<InquiryView inquiries={inquiries} setInquiries={setInquiries} isLoggedIn={isLoggedIn} userAlias={userAlias} onShowAuthModal={() => setShowAuthModal(true)} onOpenGuestInquiry={() => setShowInquiryPopup(true)} inquiryTitle={inquiryTitle} setInquiryTitle={setInquiryTitle} inquiryContent={inquiryContent} setInquiryContent={setInquiryContent} onLogActivity={onLogActivity} />)}

            {/* TAB: MYPAGE (채무 진단 대시보드 + 개인 설정) */}
            {/* TAB: 마이페이지 = 내 사건(진단·서류·계약·수임료) + 회생동행(진행·변제) + 알림·설정 (IA 통합안) */}
            {activeTab === 'mypage' && (
              <MyPageView
                userAlias={userAlias}
                setUserAlias={setUserAlias}
                isEditingAlias={isEditingAlias}
                setIsEditingAlias={setIsEditingAlias}
                tempAlias={tempAlias}
                setTempAlias={setTempAlias}
                activeRequest={activeRequest}
                activeResult={activeResult}
                onUpdateFinancialProfile={handleUpdateFinancialProfile}
                onStartDiagnosis={handleStartDiagnosisClick}
                requests={clientRequests}
                onNavigateToChat={(reqId) => { if (reqId) setActiveChatReqId(reqId); setActiveTab('chat'); }}
                isCompact={false}
                initialSubTab={mypageSubTab}
                lawyers={directoryLawyers}
                isLoggedIn={isLoggedIn}
                // 예전 최상위 회생동행 탭은 로그인한 의뢰인 ID로 기록을 저장했다 → 함께 찾아 기록이 사라져 보이지 않게
                companionFallbackIds={isLoggedIn && currentClientId ? [currentClientId] : undefined}
                // 알림은 헤더와 같은 상태를 쓴다(누르면 읽음 + 관련 화면 이동, 헤더 숫자도 함께 갱신)
                notifications={clientNotifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                settingsPanel={
                  <MySettingsView
                    embedded
                    isLoggedIn={isLoggedIn}
                    userAlias={userAlias}
                    setUserAlias={setUserAlias}
                    onChangeAlias={handleChangeAlias}
                    isEditingAlias={isEditingAlias}
                    setIsEditingAlias={setIsEditingAlias}
                    tempAlias={tempAlias}
                    setTempAlias={setTempAlias}
                    inquiries={inquiries}
                    onNavigateToTab={(tab: string) => navigateTo(tab)}
                    onShowAuthModal={() => setShowAuthModal(true)}
                    onLogout={handleLogout}
                  />
                }
              />
            )}

            {/* TAB: 내 관리방 (3-Zone: 채무대시보드 + 변호사선택 + 채팅) */}
            {activeTab === 'chat' && (
              !isLoggedIn ? (
                <div className="rounded-2xl border border-slate-200 bg-white">
                  {/* 페이지 제목(화면 읽기용): 로그인 안내만 보일 때도 탭마다 h1 하나 */}
                  <h1 className="sr-only">내 관리방</h1>
                  <EmptyState
                    icon={<Lock className="w-6 h-6" />}
                    title="내 관리방은 로그인 후 이용할 수 있습니다"
                    description="변호사에게 보낸 상담 요청, 도착한 제안서, 1:1 대화를 한곳에서 확인합니다. 아직 채무 정리를 하지 않았다면 내 상황 체크하기부터 시작해 보세요."
                    action={<Button onClick={() => setShowAuthModal(true)}>로그인</Button>}
                    secondaryAction={<Button variant="secondary" onClick={handleStartDiagnosisClick}>내 상황 체크하기</Button>}
                  />
                </div>
              ) : (
                <ChatView 
                  requests={clientRequests} messages={messages} activeChatReqId={activeChatReqId} chatInput={chatInput}
                  isLoggedIn={isLoggedIn} userAlias={userAlias}
                  onSetActiveChatReqId={setActiveChatReqId} onSetChatInput={setChatInput}
                  onSetActiveTab={(tab: string) => navigateTo(tab)} onSetRequests={setRequests}
                  onSendChat={handleSendChat} onAddMessage={onAddMessage}
                  onRetryMessage={onRetryMessage}
                  onRequestLawyers={(request, lawyerIds) => requestLawyersWithConsent(request, lawyerIds)}
                  onRequestOpenMatching={requestOpenMatchingWithConsent}
                  onBrowseLawyersToRequest={(requestId) => {
                    setLawyerSelectionTargetId(requestId);
                    setLawyerSelectionMode(true);
                    setActiveTab('lawyers');
                    window.scrollTo({ top: 0 });
                  }}
                  activeRequest={activeRequest} activeResult={activeResult} onUpdateFinancialProfile={handleUpdateFinancialProfile}
                  setUserAlias={setUserAlias} isEditingAlias={isEditingAlias} setIsEditingAlias={setIsEditingAlias}
                  tempAlias={tempAlias} setTempAlias={setTempAlias}
                  lawyers={directoryLawyers}
                  showDiagnosisReport={platformConfig.showDiagnosisReport}
                />
              )
            )}

            {/* TAB: LEGAL NEWS & TIPS BOARD */}
            {activeTab === 'news' && (<NewsView newsArticles={newsArticles} onSelectArticle={(art: any) => setSelectedArticle(art)} onUpdateViews={(id) => setNewsArticles(prev => prev.map(x => x.id === id ? {...x, views: x.views+1} : x))} />)}


            {/* TAB: LIVE Q&A CASE STUDIES */}
            {activeTab === 'qna' && (<QnAView qas={qas} onConsultRequest={(t,c) => { setTitle(t); setContent(c); handleStartDiagnosisClick(); }} initialCategory={initialQnACategory || undefined} />)}

            {/* TAB 1-B: NOTICES TAB */}
            {activeTab === 'notices' && (<NoticesView notices={notices} selectedNoticeId={selectedNoticeId} onSetSelectedNoticeId={setSelectedNoticeId} onGoHome={() => setActiveTab('landing')} />)}

            {/* TAB: COMPANY INTRO — 'diagnosis'·'request' 등은 navigateTo가 '체크 시작'으로 바꾼다 */}
            {activeTab === 'company' && (<CompanyView onNavigate={(tab) => navigateTo(tab)} />)}

            {/* TAB: USAGE GUIDE */}
            {activeTab === 'guide' && (<GuideView onNavigate={(tab) => navigateTo(tab)} />)}


            {/* TAB 2: HIGH-FIDELITY CUSTOMER INTAKE SCREEN */}
            {activeTab === 'request' && (
              // 데스크톱(lg+)은 2열: 대화 + 입력 요약·진행 안내 / 태블릿은 대화만 가운데
              <div className="w-full max-w-3xl lg:max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
              <div className="md:space-y-3 min-w-0">
                {/* 페이지 제목(화면 읽기용). 화면에는 챗봇 머리가 제목 역할을 한다 */}
                <h1 className="sr-only">내 상황 체크하기</h1>
                {/* 목적 고지 (데스크톱: 대화창 위 / 모바일: 첫 인사 메시지에 같은 내용 포함) */}
                <p className="hidden md:flex items-start gap-2 px-1 text-sm text-slate-600 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  <span>채무·소득·지출 정보를 정리하는 도구이며 법률 자문을 제공하지 않습니다. 이름과 연락처는 묻지 않으며, 정리한 내용은 가명으로 처리됩니다.</span>
                </p>
                {/*
                  레이아웃: 데스크톱은 페이지 안에 임베드(헤더·푸터 유지),
                  모바일은 사이트 헤더 위를 덮는 전체 화면(z-50, 키보드 높이는 visualViewport 기준)
                */}
                <section
                  aria-label={CLIENT_TAB_LABELS.request}
                  className="flex flex-col overflow-hidden bg-white max-md:fixed max-md:inset-x-0 max-md:z-50 max-md:top-[var(--chatbot-vv-top,0px)] max-md:h-[var(--chatbot-vh,100dvh)] md:relative md:h-[min(760px,calc(100dvh-13rem))] md:min-h-[520px] md:rounded-3xl md:border md:border-slate-200 md:shadow-sm"
                >
                {/* 동적 안내 메시지 (상황별 정보에서 진입 시) */}
                {chatbotAnnouncement && (
                  <div className="px-4 py-2.5 bg-secondary-light border-b border-teal-200 shrink-0 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-secondary-hover mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-teal-900 font-medium leading-relaxed whitespace-pre-line flex-1">
                      {chatbotAnnouncement}
                    </p>
                    <button type="button" onClick={() => setChatbotAnnouncement(null)} aria-label="안내 닫기" className="w-9 h-9 -my-1.5 -mr-2 rounded-lg flex items-center justify-center text-teal-800 hover:bg-teal-100 shrink-0 cursor-pointer">
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <div className="relative flex-1 min-h-0">
                <AIRehabChatbotV2
                  isOpen={true}
                  layout="embedded"
                  showDiagnosisReport={platformConfig.showDiagnosisReport}
                  onClose={() => {
                    if (pendingChatbotData) {
                      const mappedData = mapChatbotDataToIntakeData(pendingChatbotData.res, pendingChatbotData.input);
                      setPendingChatbotData(null);
                      handleIntakeSubmit(mappedData, false);
                    }
                    setActiveTab('landing');
                  }}
                  onComplete={(res, input) => {
                    setPendingChatbotData({ res, input });
                    // 진단 완결 즉시 requests 및 localStorage에 자동 저장 (내 관리방 채무 현황 연동)
                    const mappedData = mapChatbotDataToIntakeData(res, input);
                    handleIntakeSubmit(mappedData, false);
                  }}
                  templateId="gradient"
                  themeMode="light"
                  characterName="정리도우미"
                  customColors={{
                    // 브랜드 네이비 (보라 테마 폐기)
                    primary: '#1E3A5F',
                    secondary: '#EEF4FA',
                    accent: '#163152',
                    headerText: '#ffffff',
                    userText: '#ffffff',
                    botText: '#1E293B'
                  }}
                  isLoggedIn={isLoggedIn}
                  onShowAuthModal={() => setShowAuthModal(true)}
                  onConsultation={() => {
                    // 특정 변호사에게 상담하려고 시작한 진단이면 그 변호사에게 보낼지 동의 창부터 연다(로그인 전이면 로그인 후 이어서)
                    const intentRequest = directIntent ? requests.find(r => r.id === directIntent.requestId) : undefined;
                    if (directIntent && intentRequest) {
                      setActiveChatReqId(intentRequest.id);
                      if (isLoggedIn) setActiveTab('chat');
                      requestFromDirectory(intentRequest, [directIntent.lawyerId]);
                      setDirectIntent(null);
                      return;
                    }
                    // 변호사 찾기를 '여러 명 골라 요청하기' 모드로 연다. 즐겨찾기한 변호사가 있으면 즐겨찾기만 먼저 보여 준다
                    let favIds: string[] = [];
                    try { favIds = JSON.parse(secureGetItem('lawyer_favorites') || '[]'); } catch { /* ignore */ }
                    if (favIds.length > 0) localStorage.setItem('lawyer_view_favorites_mode', 'true');
                    const targetId = pendingNewRequest?.id || null;
                    if (targetId) setActiveChatReqId(targetId);
                    setLawyerSelectionTargetId(targetId);
                    setLawyerSelectionMode(true);
                    setActiveTab('lawyers');
                    window.scrollTo({ top: 0 });
                  }}
                  onProgressChange={setChatbotSnapshot}
                />
                </div>
                </section>
              </div>
              {/* 데스크톱 옆 패널: 입력 요약·진행 방식 (lg 미만에서는 숨김 — 모바일은 전체 화면 대화) */}
              <div className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
                <React.Suspense fallback={null}>
                  <ChatbotSidePanel snapshot={chatbotSnapshot} />
                </React.Suspense>
              </div>
              </div>
            )}

            {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
            {activeTab === 'lawyers' && (
              <LawyersView
                lawyers={directoryLawyers}
                reviews={reviews}
                onSelectLawyer={handleConsultLawyer}
                selectionMode={lawyerSelectionMode}
                onSelectionModeChange={(on) => {
                  setLawyerSelectionMode(on);
                  if (!on) setLawyerSelectionTargetId(null);
                }}
                maxSelections={Math.max(0, LAWYER_MAX_SELECTIONS - lawyerTargetRequestedIds.length)}
                requestLimit={LAWYER_MAX_SELECTIONS}
                onConfirmSelection={handleConfirmLawyerSelection}
                hasCompletedCheck={!!activeResult}
                canRequestNow={!!lawyerRequestTarget}
                requestedLawyerIds={lawyerTargetRequestedIds}
                requiresLogin={!isLoggedIn}
                onStartCheck={handleStartDiagnosisClick}
                onOpenConsultRoom={() => {
                  if (lawyerRequestTarget) setActiveChatReqId(lawyerRequestTarget.id);
                  setActiveTab('chat');
                }}
              />
            )}

            {/* 404 Not Found Fallback View */}
            {!isClientTab(activeTab) && (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <EmptyState
                  icon={<Search className="w-6 h-6" />}
                  title="요청하신 페이지를 찾을 수 없습니다"
                  description="주소가 잘못되었거나 변경되었습니다. 홈에서 다시 시작해 주세요."
                  action={<Button onClick={() => setActiveTab('landing')}>홈으로 이동</Button>}
                />
              </div>
            )}
          </React.Suspense>
          </TabErrorBoundary>
        </div>
        )}

      </main>

      {/* 챗봇(전체 화면)과 변호사 선택 모드(하단 선택 바)에서는 푸터를 숨긴다 */}
      {!isChatbotActive && !isLawyerSelectionActive && (
        <ClientFooter
          platformConfig={platformConfig}
          onNavigate={(tab) => navigateTo(tab)}
          onStartCheck={handleStartDiagnosisClick}
        />
      )}

      {/* Auth Modal (로그인 / 회원가입) */}
      {showAuthModal && (
        <React.Suspense fallback={null}>
          <AuthModal 
            onClose={() => { setShowAuthModal(false); setPendingDiagnosisAfterLogin(false); clearPendingLawyerRequest(); }} 
            onLoginSuccess={(alias,ep,ch) => { 
              setIsLoggedIn(true); 
              touchClientActivity();
              setUserAlias(alias); 
              setShowAuthModal(false); 
              recordClientLogin(alias,ep,ch); 
              // 진단 목적으로 로그인했으면 진단 페이지로 이동, 아니면 내 관리방으로
              if (pendingDiagnosisAfterLogin) {
                setPendingDiagnosisAfterLogin(false);
                // 로그인 후 기존 진단 데이터 체크
                const hasData = requests.length > 0 && requests.some(r => r.financialProfile);
                if (hasData) {
                  setShowResetDiagnosisModal(true);
                } else {
                  forceStartNewDiagnosis();
                }
              } else if (readPendingLawyerRequest()) {
                // 변호사 찾기에서 고른 변호사가 있으면 이 화면에 머문 채 동의 창을 이어서 연다(위 useEffect)
              } else {
                setActiveTab('chat');
              }
            }} 
          />
        </React.Suspense>
      )}

      <MobileGNB
        activeTab={activeTab}
        onNavigate={(tab) => navigateTo(tab)}
        onStartCheck={handleStartDiagnosisClick}
        showChatDot={hasUnreadConsultUpdate}
        isHidden={isChatbotActive || isGnbHidden || isLawyerSelectionActive}
      />

      {activeRemedyCategory && remedyData[activeRemedyCategory] && (
        <React.Suspense fallback={null}>
          <RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} onViewCases={handleViewSimilarCases} />
        </React.Suspense>
      )}
      {activeSolutionType && (
        <React.Suspense fallback={null}>
          <SolutionDetailModal solutionType={activeSolutionType} onClose={() => setActiveSolutionType(null)} onStartDiagnosis={() => { setEntryCategory({ type: 'solution', id: activeSolutionType, label: SOLUTION_LABELS[activeSolutionType] || activeSolutionType }); setActiveSolutionType(null); handleStartDiagnosisClick(); }} onApplyConsult={(ctaTitle, ctaContent) => { setEntryCategory({ type: 'solution', id: activeSolutionType, label: SOLUTION_LABELS[activeSolutionType] || activeSolutionType }); setActiveSolutionType(null); setTitle(ctaTitle); setContent(ctaContent); handleStartDiagnosisClick(); }} />
        </React.Suspense>
      )}
      {selectedArticle && (
        <React.Suspense fallback={null}>
          <NewsDetailModal article={selectedArticle} lawyers={directoryLawyers} onClose={() => setSelectedArticle(null)} onConsultWithLawyer={(lawyerId, lawyerName, articleTitle) => { setRequestType('direct'); setSelectedLawyerId(lawyerId); setTitle(`[법률 정보 글 보고 상담 요청] ${lawyerName}`); setContent(`${lawyerName.replace(/\s*변호사$/, '')} 변호사님의 글 [${articleTitle}]을 읽고 상담을 요청합니다.\n\n제 소득과 채무 상황에 맞는 절차를 상담받고 싶습니다.`); setRequestStep(2); setActiveTab('request'); setSelectedArticle(null); }} />
        </React.Suspense>
      )}

      {selectedProfileLawyer && (
        <React.Suspense fallback={null}>
          <LawyerProfileModal
            lawyer={selectedProfileLawyer}
            reviews={reviews}
            onClose={() => setSelectedProfileLawyer(null)}
            isRequested={lawyerTargetRequestedIds.includes(selectedProfileLawyer.id)}
            onConsult={(lawyerId) => {
              setSelectedProfileLawyer(null);
              handleConsultLawyer(lawyerId);
            }}
          />
        </React.Suspense>
      )}

      {/* Popup Container */}
      {popupConfig && (
        <PopupContainer
          config={popupConfig}
          landingId="legal-crm-main"
          viewerRole="client"
          onScrollToForm={handleStartDiagnosisClick}
          onOpenChat={handleStartDiagnosisClick}
        />
      )}

      {/* 1:1 고객 문의 팝업 모달 */}
      {showInquiryPopup && (
        <React.Suspense fallback={null}>
          <InquiryPopupModal
            isOpen={showInquiryPopup}
            onClose={() => setShowInquiryPopup(false)}
            inquiries={inquiries}
            setInquiries={setInquiries}
            isLoggedIn={isLoggedIn}
            userAlias={userAlias}
            onNavigateToQnA={() => { setActiveTab('qna'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onNavigateToLawyers={() => { setActiveTab('lawyers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onNavigateToInquiry={() => { setActiveTab('inquiry'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </React.Suspense>
      )}

      {/* 변호사에게 상담 정보 제공 동의 (상담 요청·공개 요청 직전) */}
      <ThirdPartyConsentModal
        open={!!pendingConsent}
        scope={pendingConsent?.scope || 'selected'}
        recipients={consentRecipients}
        onClose={() => setPendingConsent(null)}
        onAgree={handleThirdPartyConsentAgreed}
      />

      {/* 이미 정리한 채무 정보가 있을 때 새로 체크할지 확인 */}
      <Modal
        open={showResetDiagnosisModal}
        onClose={() => setShowResetDiagnosisModal(false)}
        size="sm"
        mobile="center"
        icon={<RefreshCw className="w-5 h-5" />}
        title="이미 정리한 채무 정보가 있습니다"
        description="새로 체크하면 새 결과가 마이페이지와 내 관리방의 채무 현황에 표시됩니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResetDiagnosisModal(false)} className="flex-1 sm:flex-none">
              취소
            </Button>
            <Button
              onClick={() => {
                setShowResetDiagnosisModal(false);
                forceStartNewDiagnosis();
              }}
              className="flex-1 sm:flex-none"
            >
              새로 체크하기
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 leading-relaxed break-keep">
          이전에 보낸 상담 요청과 대화 내용은 그대로 남습니다. 결과가 바뀌면 변호사에게 전달할 내용도 새 결과 기준으로 정리됩니다.
        </p>
      </Modal>

      {/* 로그아웃 완료 안내 */}
      <Modal
        open={showLogoutSuccessModal}
        onClose={() => setShowLogoutSuccessModal(false)}
        size="sm"
        mobile="center"
        icon={<ShieldCheck className="w-5 h-5" />}
        title="로그아웃되었습니다"
        footer={
          <Button onClick={() => setShowLogoutSuccessModal(false)} fullWidth>
            확인
          </Button>
        }
      >
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-secondary shrink-0" aria-hidden="true" />
            <span>이 기기에 저장된 상담 기록·알림·로그인 정보를 지웠습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-secondary shrink-0" aria-hidden="true" />
            <span>계정에 저장된 상담 기록은 다시 로그인하면 이어서 볼 수 있습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-secondary shrink-0" aria-hidden="true" />
            <span>여러 사람이 쓰는 기기라면 브라우저 창도 닫아 주세요.</span>
          </li>
        </ul>
      </Modal>

    </div>
    </div>
  );
}
