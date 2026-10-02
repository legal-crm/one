import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useDialog } from './common/DialogProvider';
import { parseLocalYmd } from '../utils/localDate';
import { getDisplayPhoneNumber, getDisplayClientName, isClientContactDisclosed, isClientPseudonymous } from '../utils/clientDisplay';
import { 
  Briefcase, BarChart2, Shield, ShieldAlert, MessageSquare, ListCheck, FolderHeart, 
  Clock, Plus, Trash2, Send, Save, CreditCard, ChevronRight, ChevronLeft, CheckCircle2, Check, ExternalLink,
  Users, LogOut, Lock, Settings, MapPin, Bell, Smartphone, FileText, Eye, Megaphone, Info, Tag, TrendingUp, ChevronDown, ChevronUp, Zap, AlertTriangle, Receipt, Microscope, Trophy, Calendar, Target, MessageCircle, ArrowRight, UserCheck, UserX, CalendarCheck, Search, FileSignature, Compass, Building2, UserCircle, Printer, Stamp, Scale, PhoneCall, Coins, Menu, Inbox
} from 'lucide-react';
import { 
  ConsultRequest, User, ConsultMessage, Case, CaseStatus, ConsultStatus, Member, ActivityLog, MemberRole, PlatformConfig, AdOrder, ClientQA, PopupConfig, LawyerInquiry, Notice, LawyerFirmType, LawyerSealInfo 
} from '../types';
import { adProducts, mockLawyers, mockAdOrders, BANK_ACCOUNT_INFO, initialNotices } from '../data';
import { ChatDisclaimer } from './Disclaimers';
import { calculateRepayment, RehabUserInput, type RehabCalculationResult } from '../rehab-chatbot-package/services/calculationService';
import LawyerProposalDraft from './lawyer/LawyerProposalDraft';
import ProposalWorkspace from './lawyer/ProposalWorkspace';
import { getProposalBlockReason, hasProposalFrom, isChatOpenWithLawyer, isNewRequestForLawyer, isOpenForProposals, requestTypeLabel } from './lawyer/requestScope';
import { mapToRehabUserInput } from './lawyer/mapToRehabUserInput';
import CrmTab from './lawyer/CrmTab';
import { LawyerDashboardView } from './lawyer/dashboard';
import SalesLeadsTab from './lawyer/leads/SalesLeadsTab';
import { loadSalesLeads, setSalesLeadScope } from '../services/leadService';
import { claimLawyerAccount, getMyLawyerAccount, type LawyerAccount } from '../services/lawyerAccountService';
const ContractManagementTab = React.lazy(() => import('./lawyer/ContractManagementTab'));
const FeeSettlementTab = React.lazy(() => import('./lawyer/FeeSettlementTab'));
import { ConsultRequestManagementView } from './lawyer/requests';
import CaseReviewCopilot from './lawyer/CaseReviewCopilot';
import AICaseAnalysisLocked from './lawyer/AICaseAnalysisLocked';
import ClientOriginalInfo from './lawyer/ClientOriginalInfo';
import RequestWorkflowPanel from './lawyer/RequestWorkflowPanel';
import RequestTimeline from './lawyer/RequestTimeline';
import NotificationBell from './lawyer/NotificationBell';
import ConsultStyleProfile from './lawyer/ConsultStyleProfile';
import TasksScheduleTab from './lawyer/TasksScheduleTab';
import StaffManagementTab from './lawyer/StaffManagementTab';
import LawyerQnAAnswerSection from './lawyer/LawyerQnAAnswerSection';
import DataBackupSection from './lawyer/DataBackupSection';
import RehabSettingsPanel from './RehabSettingsPanel';
import { usePermissions } from '../hooks/usePermissions';
import type { StaffMember, StaffRole as StaffRoleType, IntakeChannel, CrmStatus, AlimtokMilestone } from '../types';
import { DEFAULT_PERMISSIONS, INTAKE_CHANNEL_CONFIG, ALIMTOK_MILESTONE_CONFIG } from '../types';
import { validateInviteToken, acceptStaffInvite } from '../services/inviteService';
import { loadStaffMembers, findStaffRecordForUser, loadCrmExtMap, getCrmExt } from '../services/crmService';
import { feeAmountWon } from '../services/alimtokService';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { createNotification } from '../services/notificationCenterService';
import { loadLawyerBusinessInfo, saveLawyerBusinessInfo, checkCorpNum, formatCorpNum, getTaxInvoicePdfUrl, type LawyerBusinessInfo } from '../services/taxInvoiceService';
import {
  loadNotificationSettings, saveNotificationSettings, loadNotificationLogs,
  testTelegramConnection, sendEmailNotification, formatEmailConsultHtml,
  requestBrowserPushPermission, sendBrowserPushNotification, getBrowserNotificationPermission, notifyAllChannels,
  notifyAdminNewAdOrder,
} from '../services/notificationService';
import type { NotificationSettings, NotificationLog } from '../types';
import PopupContainer from './popup/PopupContainer';
import LawyerInquiryTab from './lawyer/LawyerInquiryTab';
import LawyerProfileEditor from './lawyer/LawyerProfileEditor';
import DeviceSessionManager from './common/DeviceSessionManager';
import { useSessionGuard } from '../hooks/useSessionGuard';
import { useAdminUrlSync } from '../hooks/useAdminUrlSync';
import { registerSession } from '../services/sessionService';
const NewCaseModal = React.lazy(() => import('./lawyer/NewCaseModal'));
const GlobalSearchPalette = React.lazy(() => import('./lawyer/GlobalSearchPalette'));
import ContractConversionModal from './lawyer/ContractConversionModal';
import { loadAdOrders, saveNewAdOrder, subscribeToAdOrders } from '../services/adOrderService';
import LegalQuickDock from './lawyer/LegalQuickDock';
import LawyerChatWorkspace from './lawyer/chat/LawyerChatWorkspace';
import { clearDockSensitiveData } from './lawyer/quickdock/dockStorage';
import LawyerSealManagerModal from './lawyer/LawyerSealManagerModal';
import SealStudioModal from './lawyer/branding/SealStudioModal';

/** 로컬(KST 등 사용자 시간대) 기준 YYYY-MM-DD — toISOString()은 UTC라 자정~09시에 하루 밀림 */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD'(또는 ISO) 마감일까지 남은 일수 (오늘 = 0). 해석 불가 시 null */
function daysUntilLocalDate(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

/** 모바일 '더보기' 메뉴 (기획서 1-4, 1-7 표준 용어 적용) */
const MOBILE_MORE_TABS: Array<{ id: string; label: string; perm?: string }> = [
  { id: 'case-copilot', label: 'AI 사건 분석', perm: 'case-copilot' },
  { id: 'contracts', label: '계약 현황' },
  { id: 'fee-settlement', label: '수임료 수납', perm: 'fee-settlement' },
  { id: 'sales-leads', label: '영업 DB', perm: 'sales-leads' },
  { id: 'qna-answer', label: '공개 Q&A' },
  { id: 'billing', label: '광고·결제', perm: 'billing' },
  { id: 'staff-management', label: '직원·권한', perm: 'staff-management' },
  { id: 'inquiry-to-admin', label: '마이김변 문의' },
  { id: 'settings', label: '설정', perm: 'settings' },
];

/** DEV 빌드 전용 데모 로그인 세션 키 (PROD에서는 읽지도 쓰지도 않음) */
const DEV_LAWYER_SESSION_KEY = 'legal_crm_lawyer_dev_session';

/** 로그인 전 placeholder — 특정 변호사 프로필을 기본값으로 노출하지 않기 위함 */
const EMPTY_LAWYER: User = {
  id: '',
  lawFirmId: '',
  teamId: '',
  name: '',
  role: 'LAWYER',
  fields: [],
  region: '',
  avatar: '',
  bio: '',
  recentActivity: '',
  matchedCount: 0,
  approved: false,
};

interface LawyerRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
  /** 서버 저장까지 끝나면 true (App.handleAddMessage) — 변호사 대화 메시지는 말풍선에 전송 상태를 표시한다 */
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string, targetLawyerId?: string) => void | Promise<boolean>;
  /** 전송 실패한 메시지를 같은 id로 다시 보낸다 */
  onRetryMessage?: (messageId: string) => Promise<boolean>;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  onLogActivity: (memberId: string, memberName: string, role: MemberRole, action: ActivityLog['action'], details: string) => void;
  platformConfig: PlatformConfig;
  qas?: ClientQA[];
  setQas?: React.Dispatch<React.SetStateAction<ClientQA[]>>;
  popupConfig?: PopupConfig;
  lawyerInquiries?: LawyerInquiry[];
  setLawyerInquiries?: React.Dispatch<React.SetStateAction<LawyerInquiry[]>>;
  notices?: Notice[];
}

export default function LawyerRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  setLawyers,
  onAddMessage,
  onRetryMessage,
  cases,
  setCases,
  members,
  setMembers,
  onLogActivity,
  platformConfig,
  qas,
  setQas,
  popupConfig,
  lawyerInquiries,
  setLawyerInquiries,
  notices = initialNotices
}: LawyerRoleProps) {
  const dialog = useDialog();
  // Lawyer sub navigation inside legal CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'cases' | 'billing' | 'client-crm' | 'sales-leads' | 'case-copilot' | 'staff-management' | 'settings' | 'qna-answer' | 'tasks-schedule' | 'inquiry-to-admin' | 'contracts' | 'fee-settlement' | 'requests'>('dashboard');
  const [billingSub, setBillingSub] = useState<'status' | 'products' | 'orders' | 'business'>('status');
  const [settingsCategory, setSettingsCategory] = useState<'profile' | 'branding' | 'consult-style' | 'notifications' | 'rules' | 'notices' | 'security'>('profile');
  const [settingsSub, setSettingsSub] = useState<string>('profile-edit');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [noticeSearchTerm, setNoticeSearchTerm] = useState<string>('');
  const [copilotPreselectedReqId, setCopilotPreselectedReqId] = useState<string | undefined>();
  // 건너뛴 상담 요청 ID 관리 (localStorage 영속)
  const [dismissedReqIds, setDismissedReqIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`dismissed_reqs_${activeLawyer?.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const handleDismissReq = (reqId: string) => {
    setDismissedReqIds(prev => {
      const next = new Set(prev);
      next.add(reqId);
      localStorage.setItem(`dismissed_reqs_${activeLawyer?.id}`, JSON.stringify([...next]));
      return next;
    });
  };
  const handleRestoreDismissed = () => {
    setDismissedReqIds(new Set());
    localStorage.removeItem(`dismissed_reqs_${activeLawyer?.id}`);
  };
  // Ad order modal states
  const [adModalProduct, setAdModalProduct] = useState<any>(null);
  const [adModalStep, setAdModalStep] = useState<'select' | 'done'>('select');
  const [adModalMonths, setAdModalMonths] = useState(1);
  const [adModalDepositor, setAdModalDepositor] = useState('');
  const [adModalRegion, setAdModalRegion] = useState('');
  const [adOrders, setAdOrders] = useState<AdOrder[]>(() => loadAdOrders());
  const [crmTargetClientId, setCrmTargetClientId] = useState<string>('');
  const [crmTargetDetailTab, setCrmTargetDetailTab] = useState<'info' | 'notes' | 'timeline' | 'tasks' | 'fees' | 'contracts' | 'documents' | 'debt-certs' | 'repayment' | 'corrections' | 'court'>('info');

  // 관리자가 입금 확인/승인 또는 취소 처리 시 변호사 화면 실시간 동기화
  useEffect(() => {
    const unsub = subscribeToAdOrders(
      () => setAdOrders(loadAdOrders()),
      () => setAdOrders(loadAdOrders())
    );
    return unsub;
  }, []);

  // 세금계산서 / 사업자 정보 상태
  const [bizInfo, setBizInfo] = useState<LawyerBusinessInfo | null>(() => loadLawyerBusinessInfo());
  const [bizFormOpen, setBizFormOpen] = useState(false);
  const [bizForm, setBizForm] = useState({ corpNum: '', corpName: '', ceoName: '', bizType: '전문서비스업', bizClass: '법률서비스', addr: '', taxEmail: '', taxEmail2: '' });
  const [bizCheckResult, setBizCheckResult] = useState<string | null>(null);
  const [bizSaving, setBizSaving] = useState(false);
  const [lawyerPdfLoadingKey, setLawyerPdfLoadingKey] = useState<string | null>(null);
  const [tempFirmName, setTempFirmName] = useState('');

  // ── 전역 검색 & 외부 고객 등록 ──
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExternalClientModalOpen, setIsExternalClientModalOpen] = useState(false);
  const [isSealModalOpen, setIsSealModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  
  // Mobile UI navigation controls (상담 채팅의 목록·대화·분석서 전환은 LawyerChatWorkspace 안에서 관리)
  const [mobileStageFilter, setMobileStageFilter] = useState<'document' | 'filing' | 'commencement' | 'approval' | 'discharge'>('document');

  // Authentication states
  // [SECURITY] 로그인 여부는 저장소 값이 아니라 Supabase 세션 + lawyer_accounts 매핑(서버 판정)으로만 결정한다.
  //  - sessionStorage 'legal_crm_lawyer_session'은 새로고침 시 로딩 화면을 띄우기 위한 힌트일 뿐 인증 근거가 아니다.
  //  - DEV 빌드에서만 개발용 데모 세션(DEV_LAWYER_SESSION_KEY)을 복원한다. (PROD 번들에서는 코드 자체가 제거됨)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (import.meta.env.DEV) {
      return sessionStorage.getItem(DEV_LAWYER_SESSION_KEY) !== null;
    }
    return false;
  });

  // [FLICKER 방지] 세션 확인 / OAuth 리다이렉트 복귀 시점 즉시 감지 (로그인 폼 깜빡 노출 차단)
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(() => {
    if (import.meta.env.DEV && sessionStorage.getItem(DEV_LAWYER_SESSION_KEY)) return false;
    if (!isSupabaseConfigured) return false;
    if (sessionStorage.getItem('legal_crm_lawyer_session')) return true;
    const hasPendingOauth = sessionStorage.getItem('pending_lawyer_oauth') === 'true';
    const hasOAuthReturn = typeof window !== 'undefined' && Boolean(
      (window.location.hash && (
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('refresh_token')
      )) ||
      (window.location.search && (
        window.location.search.includes('code=') ||
        window.location.search.includes('error=')
      ))
    );
    return hasPendingOauth || hasOAuthReturn;
  });
  const [isStartingOAuth, setIsStartingOAuth] = useState<'kakao' | 'google' | null>(null);
  const [isAuthSuccess, setIsAuthSuccess] = useState(false);

  // 세션 확인 무한 대기 방지 안전 타임아웃 (8초 후 자동 해제 → 로그인 화면)
  useEffect(() => {
    if (isAuthenticating) {
      const fallbackTimer = setTimeout(() => {
        setIsAuthenticating(false);
        sessionStorage.removeItem('pending_lawyer_oauth');
      }, 8000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isAuthenticating]);

  // 서버가 확인한 변호사 계정 (lawyer_id, 승인 여부). DEV 데모 세션은 null.
  const verifiedAccountRef = useRef<LawyerAccount | null>(null);
  const oauthProcessingRef = useRef(false);

  const [activeLawyer, setActiveLawyer] = useState<User>(() => {
    if (import.meta.env.DEV) {
      const devId = sessionStorage.getItem(DEV_LAWYER_SESSION_KEY);
      if (devId) {
        const found = lawyers.find(l => l.id === devId) || mockLawyers.find(l => l.id === devId);
        if (found) return found;
      }
    }
    // 로그인 전에는 빈 프로필 (다른 변호사 프로필을 기본값으로 쓰지 않음)
    return EMPTY_LAWYER;
  });

  // lawyers 목록 갱신 시 현재 로그인 계정의 프로필만 새로 반영 (승인 여부는 서버 판정 유지)
  useEffect(() => {
    if (!isLoggedIn || !activeLawyer?.id || lawyers.length === 0) return;
    const found = lawyers.find(l => l.id === activeLawyer.id);
    if (!found) return;
    const account = verifiedAccountRef.current;
    setActiveLawyer(prev => {
      const next = account
        ? { ...found, email: account.authEmail || found.email, approved: account.approved }
        : found;
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [lawyers, isLoggedIn, activeLawyer?.id]);

  // [SECURITY] 로그인 시 실시간 기기 세션 등록
  useEffect(() => {
    if (isLoggedIn && activeLawyer?.id) {
      registerSession({
        userId: activeLawyer.id,
        userName: activeLawyer.name,
        userEmail: (activeLawyer as any).email || undefined,
        userRole: 'LAWYER',
        firmName: activeLawyer.firmName || '법률사무소',
      });
    }
  }, [isLoggedIn, activeLawyer?.id]);

  // [SECURITY] 실시간 세션 가드 (원격 강제 로그아웃 감시)
  useSessionGuard({
    userId: activeLawyer?.id,
    isLoggedIn,
    onForceLogout: () => {
      sessionStorage.removeItem('legal_crm_lawyer_session');
      sessionStorage.removeItem('legal_crm_active_lawyer');
      sessionStorage.removeItem('pending_lawyer_oauth');
      if (import.meta.env.DEV) sessionStorage.removeItem(DEV_LAWYER_SESSION_KEY);
      verifiedAccountRef.current = null; clearDockSensitiveData();
      if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
      setIsLoggedIn(false);
      setActiveStaffMember(null);
      setActiveLawyer(EMPTY_LAWYER);
    },
  });

  // Sync tempFirmName when activeLawyer changes
  useEffect(() => {
    if (activeLawyer) {
      setTempFirmName(activeLawyer.firmName || '');
    }
  }, [activeLawyer]);

  // ── Cmd+K 전역 검색 단축키 (기능 유지) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // e.code 기준: 한글 입력기(ㅏ)·Caps Lock(K) 상태에서도 동작
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 외부 고객 등록 핸들러 ──
  const handleExternalClientRegister = useCallback((data: {
    clientName: string; phone: string; debtTotal: number; income: number;
    intakeChannel: IntakeChannel; channelDetail?: string; initialStatus: CrmStatus;
    caseType?: string; gender?: string; region?: string; birth?: string;
    jobTypes?: string[]; maritalStatus?: string; childrenCount?: number;
    housingType?: string; deposit?: number; rent?: number; ownHousePrice?: number; ownHouseLoan?: number;
    loanMonthlyPay?: number; specialMemo?: string;
  }) => {
    const newId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRequest: ConsultRequest = {
      id: newId, clientId: newId, clientName: data.clientName, phone: data.phone,
      requestType: 'direct', maxParticipants: 1, status: 'counseling',
      createdAt: new Date().toISOString(), title: `[외부] ${data.clientName} 상담`,
      content: data.channelDetail || '',
      financialProfile: {
        clientName: data.clientName, age: 0,
        gender: data.gender === '여' ? 'female' : 'male',
        maritalStatus: data.maritalStatus === '기혼' ? 'MARRIED' : data.maritalStatus === '이혼' ? 'DIVORCED' : 'SINGLE',
        dependents: data.childrenCount || 0, minorChildren: data.childrenCount || 0,
        income: data.income, debtTotal: data.debtTotal,
        priorityDebt: 0, assetsTotal: 0, creditorCount: 0,
        jobType: (data.jobTypes?.[0] === '직장인' ? 'SALARIED' : data.jobTypes?.[0] === '개인사업자' ? 'SELF_EMPLOYED' : 'SALARIED') as any,
        companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: data.region || '',
        workLocation: '', housingType: (data.housingType === '전세' ? 'jeonse' : data.housingType === '자가' ? 'owned' : 'rent') as any,
        housingContractHolder: 'self',
        debtCause: 'LIVING', harassmentLevel: 'NONE',
        debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
        legalActions: [], myAssets: 0, spouseAsset: 0, spouseIncome: 0,
        rentalDeposit: data.deposit || 0, depositLoan: 0, rentCost: data.rent || 0, medicalCost: 0,
        educationCost: 0, monthlyFixedExpenses: data.loanMonthlyPay || 0, retirementPay: 0,
        retirementPensionType: 'none', specialCondition: 'none', riskFlags: [],
        clientNotes: [], debts: [], assets: [],
      },
    };
    setRequests(prev => [newRequest, ...prev]);
    import('../services/crmService').then(({ saveCrmClient, createDefaultCrmExtension }) => {
      const ext = createDefaultCrmExtension(newId);
      ext.crmStatus = data.initialStatus;
      ext.intakeChannel = data.intakeChannel;
      ext.intakeChannelDetail = data.channelDetail;
      ext.isExternalClient = true;
      ext.caseType = data.caseType as any;
      ext.region = data.region;
      if (data.specialMemo) ext.preInfo = data.specialMemo;
      saveCrmClient(newId, ext);
    });
    setIsExternalClientModalOpen(false);
  }, [setRequests]);

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Invite token states
  const [inviteToken, setInviteToken] = useState<string>('');
  const [inviteTokenValid, setInviteTokenValid] = useState<boolean>(false);
  const [inviteTokenRole, setInviteTokenRole] = useState<StaffRoleType>('CONSULTANT');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Active staff member (for RBAC)
  const [activeStaffMember, setActiveStaffMember] = useState<StaffMember | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const permissionCtx = usePermissions(activeStaffMember);

  // ── Browser history & URL synchronization (기획서 1-6 & 3.6) ──
  // 이전: tab 상태만 history.state에 기록하고 URL 동기화가 없어 새로고침·뒤로가기 시 view/case/stage 유실
  useAdminUrlSync({
    activeTab,
    setActiveTab,
    crmTargetClientId,
    setCrmTargetClientId,
    crmTargetDetailTab,
    setCrmTargetDetailTab,
    isLoggedIn,
  });

  // Dynamically sync document title
  useEffect(() => {
    if (platformConfig.siteTitle) {
      document.title = platformConfig.siteTitle;
    }
  }, [platformConfig.siteTitle]);

  // Suspended, Withdrawn, or Dormant check hook for logged-in lawyers
  useEffect(() => {
    if (isLoggedIn && activeLawyer) {
      const currentMember = members.find(m => m.id === activeLawyer.id);
      if (currentMember) {
        if (currentMember.status === 'suspended' || currentMember.status === 'withdrawn') {
          const msg = currentMember.status === 'withdrawn'
            ? '탈퇴 처리 완료된 계정입니다. 해당 계정 정보를 더 이상 이용할 수 없습니다.'
            : '이 대리인 계정은 운영정책 위반으로 인해 임시 정지 처리되었습니다. 관리자에게 문의하십시오.';
          dialog.alert({ title: '계정 상태 안내', message: msg, variant: 'danger' });
          sessionStorage.removeItem('legal_crm_lawyer_session');
          if (import.meta.env.DEV) sessionStorage.removeItem(DEV_LAWYER_SESSION_KEY);
          verifiedAccountRef.current = null; clearDockSensitiveData();
          if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
          setIsLoggedIn(false);
          setActiveLawyer(EMPTY_LAWYER);
        } else if (currentMember.status === 'dormant') {
          dialog.confirm({
            title: '휴면 해제 안내',
            message: '휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?',
            confirmText: '휴면 해제',
            variant: 'warning'
          }).then(confirmed => {
            if (confirmed) {
              setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
              onLogActivity(
                currentMember.id,
                currentMember.alias,
                'LAWYER',
                'LOGIN',
                `변호사 휴면 계정 수동 휴면 해제 성공`
              );
            } else {
              sessionStorage.removeItem('legal_crm_lawyer_session');
              if (import.meta.env.DEV) sessionStorage.removeItem(DEV_LAWYER_SESSION_KEY);
              verifiedAccountRef.current = null; clearDockSensitiveData();
              if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
              setIsLoggedIn(false);
              setActiveLawyer(EMPTY_LAWYER);
            }
          });
        }
      }
    }
  }, [isLoggedIn, activeLawyer, members, dialog, onLogActivity, setMembers]);

  // Detect invite token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setInviteToken(invite);
      setAuthMode('signup');
      validateInviteToken(invite).then(result => {
        if (result.valid && result.token) {
          setInviteTokenValid(true);
          setInviteTokenRole(result.token.role);
          setSignupRole(result.token.role === 'OWNER' ? 'LAWYER' : result.token.role as any);
        } else {
          toast.error(result.error || '유효하지 않은 초대 링크입니다.');
          setInviteTokenValid(false);
        }
      });
    }
  }, []);

  // Load staff member data for RBAC
  // - 로그인 계정에 연결된 직원 기록이 있으면 그 역할·권한을 적용한다.
  // - 승인 대기·정지·탈퇴 상태면 포털을 잠근다 (이전: 상태를 보지 않아 정지·탈퇴 직원도 계속 사용)
  // - 1분마다 다시 확인해 대표가 정지·탈퇴 처리하면 최대 1분 안에 차단된다.
  const lockPortalForStaff = useCallback((reason: string) => {
    sessionStorage.removeItem('legal_crm_lawyer_session');
    sessionStorage.removeItem('legal_crm_active_lawyer');
    if (import.meta.env.DEV) sessionStorage.removeItem(DEV_LAWYER_SESSION_KEY);
    verifiedAccountRef.current = null; clearDockSensitiveData();
    if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
    setIsLoggedIn(false);
    setActiveStaffMember(null);
    setActiveLawyer(EMPTY_LAWYER);
    setLoginError(reason);
    toast.error(reason);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !activeLawyer?.id) return;
    let cancelled = false;
    const check = async () => {
      let mine: StaffMember | null = null;
      try {
        mine = await findStaffRecordForUser(activeLawyer.id);
      } catch (err: any) {
        // 조회 실패는 기존 판정을 유지 (네트워크 오류로 강제 로그아웃하지 않음)
        console.warn('[RBAC] 직원 기록 확인 실패:', err?.message || err);
        return;
      }
      if (cancelled) return;
      if (mine && mine.status !== 'active') {
        lockPortalForStaff(
          mine.status === 'pending' ? '대표 변호사의 승인 후 이용할 수 있습니다.' :
          mine.status === 'suspended' ? '대표 변호사가 계정 사용을 정지했습니다.' :
          '사무소에서 탈퇴 처리된 계정입니다.'
        );
        return;
      }
      setActiveStaffMember(mine);
      try {
        const members = await loadStaffMembers(mine?.invitedBy || activeLawyer.id);
        if (!cancelled) setStaffMembers(members);
      } catch (err: any) {
        console.warn('[RBAC] 직원 목록 조회 실패:', err?.message || err);
      }
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isLoggedIn, activeLawyer?.id, lockPortalForStaff]);

  // 업무·일정·알림 공유 단위: 직원이면 초대한 대표 변호사, 아니면 사무소(없으면 본인)
  const firmTenantId = activeStaffMember?.invitedBy || activeLawyer.lawFirmId || activeLawyer.id;
  
  // Login form state
  const [loginId, setLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showServiceGuide, setShowServiceGuide] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  // 승인 심사 대기 중 포털 둘러보기(체험 모드) 상태
  const [isGuestPreviewMode, setIsGuestPreviewMode] = useState<boolean>(false);

  // Signup form state
  const [signupId, setSignupId] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupName, setSignupName] = useState<string>('');
  const [signupRole, setSignupRole] = useState<'LAWYER' | 'STAFF'>('LAWYER');
  const [signupFields, setSignupFields] = useState<string[]>(['개인회생']);
  const [signupRegion, setSignupRegion] = useState<string>('서울');
  const [signupBio, setSignupBio] = useState<string>('');
  const [signupAvatar, setSignupAvatar] = useState<string>('https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=256');
  const [signupError, setSignupError] = useState<string>('');
  const [signupLicenseNumber, setSignupLicenseNumber] = useState<string>('');
  const [licensePreview, setLicensePreview] = useState<string>('');
  const [licenseImageData, setLicenseImageData] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarImageData, setAvatarImageData] = useState<string>('');
  // 심사 대기 중 서류 추가/수정 접이식 상태 (기본 닫힘)
  const [showDocSubmit, setShowDocSubmit] = useState<boolean>(false);
  const [signupFirmType, setSignupFirmType] = useState<LawyerFirmType>(() => activeLawyer?.firmType || 'INDIVIDUAL');
  const [signupFirmName, setSignupFirmName] = useState<string>(() => activeLawyer?.firmName || '');
  const [signupBizNumber, setSignupBizNumber] = useState<string>(() => activeLawyer?.businessNumber || '');
  const [signupNtsStatus, setSignupNtsStatus] = useState<string>(() => activeLawyer?.ntsStatus || 'UNCHECKED');
  const [checkingFirmNts, setCheckingFirmNts] = useState<boolean>(false);

  useEffect(() => {
    if (activeLawyer?.licenseNumber) {
      setSignupLicenseNumber(activeLawyer.licenseNumber);
    }
    if (activeLawyer?.licenseImageData) {
      setLicensePreview(activeLawyer.licenseImageData);
    }
    if (activeLawyer?.firmType) {
      setSignupFirmType(activeLawyer.firmType);
    }
    if (activeLawyer?.firmName) {
      setSignupFirmName(activeLawyer.firmName);
    }
    if (activeLawyer?.businessNumber) {
      setSignupBizNumber(activeLawyer.businessNumber);
    }
  }, [activeLawyer]);

  const handleCheckFirmNts = async () => {
    const cleanNum = signupBizNumber.replace(/\D/g, '');
    if (cleanNum.length !== 10) {
      toast.error('사업자등록번호 10자리를 입력해주세요.');
      return;
    }
    setCheckingFirmNts(true);
    try {
      // 개업일자·대표자명은 사업자등록증 기준으로 직접 입력받음 (이전: window.prompt 사용 -> dialog.prompt로 교체)
      const inputOpenDate = await dialog.prompt({
        title: '사업자등록증 개업연월일',
        message: '사업자등록증상의 개업연월일 8자리를 입력하세요 (예: 20200101)',
        placeholder: '20200101',
      });
      const openDate = (inputOpenDate || '').replace(/\D/g, '');

      const inputRepName = await dialog.prompt({
        title: '사업자등록증 대표자 성명',
        message: '사업자등록증상의 대표자 성명을 입력하세요',
        defaultValue: activeLawyer?.name || '',
        placeholder: '대표자 성명',
      });
      const repName = (inputRepName || '').trim();

      if (openDate.length !== 8 || !repName) {
        setCheckingFirmNts(false);
        toast.error('개업일자(8자리)와 대표자 성명이 필요합니다.');
        return;
      }
      const { validateBusinessRegistration } = await import('../services/ntsService');
      const result = await validateBusinessRegistration({
        businessNumber: cleanNum,
        openingDate: openDate,
        representativeName: repName,
      });
      setCheckingFirmNts(false);
      // 일치 + 계속사업자일 때만 확인 완료 (이전: 불일치·휴업도 CLOSED만 아니면 '확인 완료')
      if (result.success && result.isValid && result.status === 'VALID') {
        setSignupNtsStatus('VALID');
        toast.success(`국세청 진위확인 완료: ${result.statusName} (${result.taxType || '정상 사업자'})`);
      } else {
        setSignupNtsStatus(result.status);
        toast.warning(result.error || `국세청 상태: ${result.statusName}`);
      }
    } catch (err: any) {
      setCheckingFirmNts(false);
      setSignupNtsStatus('UNCHECKED');
      toast.error('국세청 사업자 상태 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleSubmitLicenseDoc = () => {
    if (!signupLicenseNumber.trim() && !licenseImageData) {
      toast.error('변호사 등록번호 또는 신분증 이미지를 첨부해주세요.');
      return;
    }
    const updated: User = {
      ...activeLawyer,
      firmType: signupFirmType,
      firmName: signupFirmName.trim() || activeLawyer.firmName || undefined,
      businessNumber: signupBizNumber.trim() || activeLawyer.businessNumber || undefined,
      ntsStatus: signupNtsStatus,
      licenseNumber: signupLicenseNumber.trim() || activeLawyer.licenseNumber || undefined,
      licenseImageData: licenseImageData || activeLawyer.licenseImageData || undefined,
      licenseStatus: 'pending',
      recentActivity: '변호사 등록증 및 소속 자격 증빙 제출 완료'
    };
    setActiveLawyer(updated);
    setLawyers(prev => {
      const next = prev.map(l => l.id === activeLawyer?.id ? updated : l);
      try {
        localStorage.setItem('legal_crm_lawyers', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setMembers(prev => prev.map(m => m.id === activeLawyer.id ? { ...m, firmType: signupFirmType } : m));
    setShowDocSubmit(false);
    toast.success('자격 증빙 정보가 저장되었습니다. 관리자 확인 후 승인 결과가 반영됩니다.');
  };

  const handleLicenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기가 5MB를 초과합니다. 더 작은 파일을 선택해주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLicensePreview(result);
      setLicenseImageData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('프로필 사진은 2MB 이하로 올려주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarImageData(result);
    };
    reader.readAsDataURL(file);
  };

  // CRM States
  const [crmSearch, setCrmSearch] = useState<string>('');
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('all');
  const [crmLawyerFilter, setCrmLawyerFilter] = useState<string>('all');
  const [crmSelectedId, setCrmSelectedId] = useState<string>('');

  // CRM Detailed fields
  const [crmEditName, setCrmEditName] = useState<string>('');
  const [crmEditPhone, setCrmEditPhone] = useState<string>('');
  const [crmEditLawyerId, setCrmEditLawyerId] = useState<string>('');
  const [crmEditStatus, setCrmEditStatus] = useState<ConsultStatus>('requested');

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [contractTargetRequest, setContractTargetRequest] = useState<ConsultRequest | null>(null);

  // ── 이동 함수 단일화 (기획서 0-8) ──
  const openCase = useCallback((clientIdOrReqId?: string, detailTab?: any) => {
    if (clientIdOrReqId) {
      setCrmTargetClientId(clientIdOrReqId);
      setCrmTargetDetailTab(detailTab || 'info');
    } else {
      setCrmTargetClientId('');
      setCrmTargetDetailTab('info');
    }
    setActiveTab('client-crm');
  }, []);

  const openRequest = useCallback((reqId: string) => {
    openCase(reqId, 'info');
  }, [openCase]);

  const openThread = useCallback((reqId: string) => {
    if (reqId) setActiveChatReqId(reqId);
    setActiveTab('chat');
  }, []);
  
  // Custom case creation / note creation states
  const [newNote, setNewNote] = useState<string>('');
  // (이전: chatInput·internalNotes·expandedRawContent — 상담 채팅 입력값·내부 비망록(새로고침 시 유실)·원문 펼침.
  //  채팅 탭을 lawyer/chat/LawyerChatWorkspace로 옮기면서 입력값은 스레드별로, 메모는 crmExt.notes로 이동)

  // Notification System States
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => loadNotificationSettings());
  const [notifLogs, setNotifLogs] = useState<NotificationLog[]>(() => loadNotificationLogs());
  const [tgBotToken, setTgBotToken] = useState<string>(notifSettings.telegram.botToken);
  const [showBotTokenGuide, setShowBotTokenGuide] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailSender, setEmailSender] = useState(notifSettings.email.senderGmail);
  const [emailAppPassword, setEmailAppPassword] = useState(notifSettings.email.senderAppPassword);
  const [emailRecipients, setEmailRecipients] = useState(notifSettings.email.recipientEmails.join(', '));
  const [showBotToken, setShowBotToken] = useState(false);
  const [notifTestLoading, setNotifTestLoading] = useState<string | null>(null);

  // Telegram Integration States
  const [tgConnected, setTgConnected] = useState<boolean>(true);
  const [tgChatId, setTgChatId] = useState<string>('12948592948');
  const [tgDutyMode, setTgDutyMode] = useState<boolean>(false);
  const [tgWorkHoursStart, setTgWorkHoursStart] = useState<string>('09:00');
  const [tgWorkHoursEnd, setTgWorkHoursEnd] = useState<string>('18:00');
  const [tgEscalation, setTgEscalation] = useState<string>('30');
  const [tgRemindDelay, setTgRemindDelay] = useState<string>('10');
  const [tgMessages, setTgMessages] = useState<Array<{
    id: string;
    sender: 'bot' | 'system' | 'user';
    name?: string;
    avatar?: string;
    time: string;
    text?: string;
    card?: {
      type: 'direct' | 'open';
      reqId: string;
      region: string;
      debt: string;
      income: string;
      dependents: string;
      tags: string[];
      assignedLawyer?: string;
    };
  }>>([
    {
      id: 'tg-sys-1',
      sender: 'system',
      time: '오후 1:12',
      text: '🤖 다시시작 알림봇(@restart_alarm_bot)이 그룹에 참여했습니다.'
    },
    {
      id: 'tg-sys-2',
      sender: 'system',
      time: '오후 1:13',
      text: '⚙️ 대표방 텔레그램 연동 Chat ID(12948592948) 바인딩 완료'
    },
    {
      id: 'tg-msg-1',
      sender: 'bot',
      time: '오후 2:20',
      card: {
        type: 'direct',
        reqId: 'req-2',
        region: '서울/경기',
        debt: '5천만 ~ 1억 원',
        income: '150만 ~ 200만 원',
        dependents: '자녀 1인',
        tags: ['#자영업폐업', '#생활고생계비부족', '#파산면책적합'],
        assignedLawyer: '이소민 변호사'
      }
    }
  ]);

  const handleTgTestNotification = () => {
    if (!tgConnected) {
      toast.warning('텔레그램 봇이 활성화되어 있지 않습니다.');
      return;
    }
    const testCard = {
      id: `tg-test-${Date.now()}`,
      sender: 'bot' as const,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      card: {
        type: 'open' as const,
        reqId: 'req-1',
        region: '서울 서초',
        debt: '5천만 ~ 1억 원',
        income: '200만 ~ 300만 원',
        dependents: '없음',
        tags: ['#코인선물옵션실패', '#돌려막기한계', '#독촉위기'],
      }
    };
    setTgMessages(prev => [...prev, testCard]);
    toast.success('텔레그램 보안 테스트 알림이 발송되었습니다! 우측 텔레그램 시뮬레이터 창을 확인하세요.');
  };

  const handleTgAssign = (msgId: string, reqId: string) => {
    setTgMessages(prev => prev.map(m => {
      if (m.id === msgId && m.card) {
        return {
          ...m,
          card: {
            ...m.card,
            assignedLawyer: activeLawyer.name
          }
        };
      }
      return m;
    }));

    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        return {
          ...req,
          status: 'counseling',
          selectedLawyerId: activeLawyer.id
        };
      }
      return req;
    }));

    toast.success(`[다시시작 CRM 연동] ${activeLawyer.name} 님이 담당 변호사로 지정되었습니다. 의뢰인 CRM 탭에서 소명 분석을 개시할 수 있습니다.`);
  };

  // [SECURITY] 아이디/비밀번호 로그인·가입(클라이언트 평문 비교)은 제거됨.
  //  변호사 인증은 소셜 로그인(Supabase Auth) + lawyer_accounts 매핑(서버 판정)으로만 처리한다.

  // Google & Kakao OAuth 콜백 및 세션 동기화 처리 (리다이렉트 복귀 처리)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // 여러 경로(getSession 재시도·onAuthStateChange)와 effect 재실행에서 호출되므로 ref로 1회만 처리
    const processOAuthSession = async (session: any, source: string) => {
      if (oauthProcessingRef.current || verifiedAccountRef.current) return;
      if (!session?.user) {
        setIsAuthenticating(false);
        return;
      }
      oauthProcessingRef.current = true;
      try {
        const user = session.user;
        const email = (user.email || '').toLowerCase().trim();
        const provider = user.app_metadata?.provider || 'google';
        const providerName = provider === 'kakao' ? '카카오' : 'Google';
        const userStartedLawyerLogin = sessionStorage.getItem('pending_lawyer_oauth') === 'true';

        if (import.meta.env.DEV) console.log(`[LawyerRole] 세션 확인 (${source})`);

        // 1. 서버 매핑 조회 → 없고 사용자가 변호사 로그인을 직접 시작한 경우에만 신규 매핑 생성
        //    (의뢰인 세션이 변호사 화면에 들어와도 자동으로 변호사 계정이 만들어지지 않음)
        let account: LawyerAccount | null = null;
        const existing = await getMyLawyerAccount();
        if (!existing.ok) {
          sessionStorage.removeItem('pending_lawyer_oauth');
          sessionStorage.removeItem('legal_crm_lawyer_session');
          setLoginError('변호사 계정 권한을 확인하지 못했습니다. 잠시 후 다시 시도하시거나 관리자에게 문의해 주세요.');
          setIsAuthenticating(false);
          return;
        }
        account = existing.account;
        let isNewAccount = false;
        if (!account) {
          if (!userStartedLawyerLogin) {
            // 변호사로 로그인한 적 없는 세션(예: 의뢰인 로그인) → 로그인 화면 유지
            sessionStorage.removeItem('legal_crm_lawyer_session');
            setIsAuthenticating(false);
            return;
          }
          const claimed = await claimLawyerAccount();
          if (!claimed.ok) {
            sessionStorage.removeItem('pending_lawyer_oauth');
            setLoginError('변호사 계정 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            setIsAuthenticating(false);
            return;
          }
          account = claimed.account;
          isNewAccount = true;
        }
        sessionStorage.removeItem('pending_lawyer_oauth');
        verifiedAccountRef.current = account;

        // 2. 프로필: 서버가 지정한 lawyer_id의 프로필만 사용 (이름·이메일 추측 매칭 금지)
        const known = lawyers.find(l => l.id === account!.lawyerId);
        let profile: User;
        if (known) {
          profile = { ...known, email: account.authEmail || known.email, approved: account.approved };
        } else {
          const rawName = user.user_metadata?.full_name || user.user_metadata?.name || (email ? email.split('@')[0] : '') || '신규';
          const formattedName = rawName.includes('변호사') ? rawName : `${rawName} 변호사`;
          profile = {
            id: account.lawyerId,
            lawFirmId: '',
            teamId: '',
            name: formattedName,
            role: 'LAWYER',
            fields: [],
            region: '',
            email: account.authEmail || email || undefined,
            avatar: user.user_metadata?.avatar_url || '',
            bio: '',
            recentActivity: `${providerName} 소셜 계정 연결 (자격 심사 대기)`,
            matchedCount: 0,
            approved: account.approved,
            licenseStatus: account.approved ? 'verified' : 'pending',
          };
          setLawyers(prev => (prev.some(l => l.id === profile.id) ? prev : [...prev, profile]));
        }

        // 3. 정지·탈퇴 계정 차단 (관리자 회원 상태)
        const member = members.find(m => m.id === profile.id);
        if (member && (member.status === 'suspended' || member.status === 'withdrawn')) {
          await supabase.auth.signOut().catch(() => {});
          verifiedAccountRef.current = null; clearDockSensitiveData();
          sessionStorage.removeItem('legal_crm_lawyer_session');
          setLoginError(member.status === 'withdrawn'
            ? '탈퇴 완료된 계정입니다. 해당 계정은 더 이상 사용할 수 없습니다.'
            : '이 계정은 관리자에 의해 임시 정지 처리되었습니다. 관리자에게 문의해 주세요.');
          setIsAuthenticating(false);
          return;
        }

        // 새로고침 시 로딩 화면 표시용 힌트 (인증 근거 아님)
        sessionStorage.setItem('legal_crm_lawyer_session', profile.id);
        sessionStorage.removeItem('legal_crm_active_lawyer');
        setActiveLawyer(profile);
        setLoginError('');
        setIsAuthSuccess(true);
        setTimeout(() => {
          setIsLoggedIn(true);
          setIsAuthenticating(false);
          setIsAuthSuccess(false);
        }, 280);

        if (isNewAccount) {
          toast.info(`${profile.name} 님, 변호사 계정 연결이 접수되었습니다. 자격 서류 제출 후 관리자 승인이 필요합니다.`);
          onLogActivity(profile.id, profile.name, 'LAWYER', 'SIGNUP', `${providerName} 소셜 계정으로 변호사 가입 신청 (자격 심사 대기)`);

        } else {
          toast.success(`[인증 완료] ${profile.name} 님으로 로그인되었습니다.`);
          onLogActivity(profile.id, profile.name, 'LAWYER', 'LOGIN', `${providerName} 소셜 로그인 성공`);
        }

        // 초대 링크로 들어온 경우 (신규·기존 계정 모두): 서버가 토큰 소비 + 승인 대기 직원 기록 생성
        // 이전: 신규 계정일 때만 처리, 토큰을 먼저 소비한 뒤 클라이언트가 역할을 넣어 직원 기록 저장(실패해도 무시)
        if (inviteToken && inviteTokenValid) {
          const staffId = `staff-${account.lawyerId}`;
          const accepted = await acceptStaffInvite(inviteToken, {
            staffId,
            linkedUserId: account.lawyerId,
            name: profile.name,
            email: profile.email || undefined,
            avatar: profile.avatar || undefined,
            provider: provider === 'kakao' ? 'kakao' : 'google',
          });
          if (accepted.ok) {
            let staffSaved = accepted.staffCreatedOnServer;
            if (!staffSaved) {
              // 020 미적용 환경 — 클라이언트에서 승인 대기 기록 생성 (대표가 승인해야 권한이 생김)
              try {
                const { saveStaffMember: saveSM } = await import('../services/crmService');
                const newStaff: StaffMember = {
                  id: staffId,
                  name: profile.name,
                  role: accepted.role,
                  email: profile.email || '',
                  avatar: profile.avatar || undefined,
                  isActive: false,
                  assignedCount: 0,
                  createdAt: new Date().toISOString(),
                  permissions: DEFAULT_PERMISSIONS[accepted.role],
                  status: 'pending',
                  invitedBy: accepted.invitedBy,
                  authEmail: profile.email || '',
                  authProvider: provider === 'kakao' ? 'kakao' : 'google',
                  linkedUserId: account.lawyerId,
                  supabaseUserId: user.id,
                };
                await saveSM(newStaff);
                staffSaved = true;
              } catch (err: any) {
                console.warn('[OAuth] StaffMember 생성 실패:', err?.message || err);
              }
            }
            if (staffSaved) toast.success('초대를 수락했습니다. 대표 변호사가 승인하면 사무소 업무를 이용할 수 있습니다.');
            else toast.error('초대는 확인했지만 직원 등록을 저장하지 못했습니다. 대표 변호사에게 새 초대 링크를 요청해 주세요.');
            const url = new URL(window.location.href);
            url.searchParams.delete('invite');
            window.history.replaceState({}, '', url.toString());
          } else {
            toast.error(('error' in accepted && accepted.error) || '초대 링크 처리에 실패했습니다.');
          }
        }
      } finally {
        oauthProcessingRef.current = false;
      }
    };

    // 1) 마운트 즉시 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !isLoggedIn) {
        processOAuthSession(session, '초기 getSession');
      } else if (!session?.user && !sessionStorage.getItem('pending_lawyer_oauth') && !window.location.hash) {
        sessionStorage.removeItem('legal_crm_lawyer_session');
        setIsAuthenticating(false);
      }
    }).catch(err => {
      console.warn('[LawyerRole] getSession 실패:', err);
      setIsAuthenticating(false);
    });

    // 2) URL 해시 비동기 파싱 지연 대응 (1초, 2.5초 재시도)
    const timer1 = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && !isLoggedIn) {
          processOAuthSession(session, '1초 지연 세션');
        }
      });
    }, 1000);

    const timer2 = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && !isLoggedIn) {
          processOAuthSession(session, '2.5초 지연 세션');
        }
      });
    }, 2500);

    // 3) 실시간 Auth 상태 변화 감지 (INITIAL_SESSION, SIGNED_IN 등 모든 이벤트 수용)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !isLoggedIn) {
        processOAuthSession(session, `onAuthStateChange(${event})`);
      } else if (event === 'SIGNED_OUT' && verifiedAccountRef.current) {
        // 서버 세션 종료(만료·다른 기기에서 전체 로그아웃 등) → 즉시 포털 잠금
        verifiedAccountRef.current = null; clearDockSensitiveData();
        sessionStorage.removeItem('legal_crm_lawyer_session');
        setIsLoggedIn(false);
        setActiveLawyer(EMPTY_LAWYER);
        setActiveStaffMember(null);
      }
    });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      subscription?.unsubscribe();
    };
  }, [lawyers, isLoggedIn]);

  // [SECURITY] 변호사 계정은 소셜 로그인 전용 — 앱 내 비밀번호 저장/변경 없음.
  //  대신 Supabase 세션을 모든 기기에서 종료하는 기능을 제공한다.
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const handleSignOutAllDevices = async () => {
    if (!isSupabaseConfigured || !verifiedAccountRef.current) {
      toast.error('소셜 로그인 세션이 없어 전체 로그아웃을 진행할 수 없습니다.');
      return;
    }
    const confirmed = await dialog.confirm({
      title: '모든 기기에서 로그아웃',
      message: '이 계정으로 로그인된 모든 기기(현재 기기 포함)의 세션을 종료합니다. 계속하시겠습니까?',
      confirmText: '전체 로그아웃',
      variant: 'warning'
    });
    if (!confirmed) return;
    setIsSigningOutAll(true);
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    setIsSigningOutAll(false);
    if (error) {
      toast.error('전체 로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'LOGIN', '모든 기기 세션 종료');
    verifiedAccountRef.current = null; clearDockSensitiveData();
    sessionStorage.removeItem('legal_crm_lawyer_session');
    setIsLoggedIn(false);
    setActiveLawyer(EMPTY_LAWYER);
    setActiveStaffMember(null);
    toast.success('모든 기기에서 로그아웃되었습니다.');
  };

  // 소속 법률사무소 / 법인 설정 저장
  const handleSaveFirmName = () => {
    const trimmed = tempFirmName.trim();
    if (!trimmed) {
      toast.error('소속 명칭을 입력해주세요.');
      return;
    }

    setLawyers(prev => prev.map(l => 
      l.id === activeLawyer.id ? { ...l, firmName: trimmed } : l
    ));
    setActiveLawyer(prev => ({ ...prev, firmName: trimmed }));

    toast.success('소속 법률사무소/법인 명칭이 저장되었습니다.');
    onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'SETTINGS', `소속 명칭 설정 변경: ${trimmed}`);
  };

  // Google OAuth 로그인
  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      dialog.alert({
        title: 'Google 로그인 설정 필요',
        message: 'Google 로그인을 사용하려면 Supabase 설정이 필요합니다.\n.env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.',
        variant: 'warning'
      });
      return;
    }
    try {
      setIsStartingOAuth('google');
      sessionStorage.setItem('pending_lawyer_oauth', 'true');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/?role=lawyer`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setIsStartingOAuth(null);
      sessionStorage.removeItem('pending_lawyer_oauth');
      toast.error(`Google 로그인 실패: ${err.message || err}`);
    }
  };

  // Kakao OAuth 로그인
  const handleKakaoLogin = async () => {
    if (!isSupabaseConfigured) {
      dialog.alert({
        title: '카카오 로그인 설정 필요',
        message: '카카오 로그인을 사용하려면 Supabase 설정이 필요합니다.\n.env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.',
        variant: 'warning'
      });
      return;
    }
    try {
      setIsStartingOAuth('kakao');
      sessionStorage.setItem('pending_lawyer_oauth', 'true');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/?role=lawyer`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setIsStartingOAuth(null);
      sessionStorage.removeItem('pending_lawyer_oauth');
      toast.error(`카카오 로그인 실패: ${err.message || err}`);
    }
  };

  // 비밀번호 찾기
  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      toast.error('비밀번호를 재설정할 이메일 주소를 입력해주세요.');
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error('비밀번호 재설정은 Supabase 설정이 필요합니다.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/?role=lawyer`
      });
      if (error) throw error;
      dialog.alert({
        title: '비밀번호 재설정 링크 발송',
        message: '비밀번호 재설정 링크가 이메일로 발송되었습니다.\n이메일을 확인해주세요.',
        variant: 'success'
      });
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (err: any) {
      toast.error(`비밀번호 재설정 실패: ${err.message || err}`);
    }
  };

  const handleLogout = async () => {
    const confirmed = await dialog.confirm({
      title: '로그아웃 확인',
      message: '변호사 포털에서 로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      variant: 'warning'
    });
    if (confirmed) {
      sessionStorage.removeItem('legal_crm_lawyer_session');
      sessionStorage.removeItem('legal_crm_active_lawyer');
      sessionStorage.removeItem('pending_lawyer_oauth');
      if (import.meta.env.DEV) sessionStorage.removeItem(DEV_LAWYER_SESSION_KEY);
      verifiedAccountRef.current = null; clearDockSensitiveData();
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => {});
      }
      setIsLoggedIn(false);
      setActiveStaffMember(null);
      setActiveLawyer(EMPTY_LAWYER);
    }
  };

  // CRM Logic
  const crmSelectedClient = requests.find(r => r.id === crmSelectedId);

  useEffect(() => {
    if (crmSelectedClient) {
      setCrmEditName(crmSelectedClient.clientName);
      setCrmEditPhone(crmSelectedClient.phone);
      setCrmEditLawyerId(crmSelectedClient.selectedLawyerId || '');
      setCrmEditStatus(crmSelectedClient.status);
    }
  }, [crmSelectedId, crmSelectedClient]);

  const handleUpdateClientInfo = () => {
    if (!crmSelectedId || !crmEditName.trim() || !crmEditPhone.trim()) return;
    setRequests(prev => prev.map(r => {
      if (r.id === crmSelectedId) {
        return {
          ...r,
          clientName: crmEditName.trim(),
          phone: crmEditPhone.trim()
        };
      }
      return r;
    }));
    toast.success('의뢰인 기본 인적 정보가 성공적으로 업데이트되었습니다.');
  };

  const handleSaveCrmSession = () => {
    if (!crmSelectedId) return;
    setRequests(prev => prev.map(r => {
      if (r.id === crmSelectedId) {
        return {
          ...r,
          selectedLawyerId: crmEditLawyerId || undefined,
          status: crmEditStatus
        };
      }
      return r;
    }));
    toast.success('상담 세션 배정 및 상태가 성공적으로 저장되었습니다.');
  };


  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.clientName.toLowerCase().includes(crmSearch.toLowerCase()) ||
      r.phone.includes(crmSearch);
    
    const matchesStatus = crmStatusFilter === 'all' || r.status === crmStatusFilter;
    
    let matchesLawyer = true;
    if (crmLawyerFilter === 'unassigned') {
      matchesLawyer = !r.selectedLawyerId;
    } else if (crmLawyerFilter !== 'all') {
      matchesLawyer = r.selectedLawyerId === crmLawyerFilter;
    }
    
    return matchesSearch && matchesStatus && matchesLawyer;
  });

  // ── 제안서 모달 상태 (통합: LawyerProposalDraft 사용) ──
  const [proposalModalReqId, setProposalModalReqId] = useState<string | null>(null);
  const [proposalRehabResult, setProposalRehabResult] = useState<RehabCalculationResult | null>(null);
  const [proposalRehabInput, setProposalRehabInput] = useState<RehabUserInput | null>(null);
  const [proposalConsultRequest, setProposalConsultRequest] = useState<any>(null);

  // 탭 전환 시 제안서 모달 자동 닫기 (모달이 다른 탭 위에 잔류하는 문제 방지)
  useEffect(() => {
    if (activeTab !== 'client-crm' && activeTab !== ('proposal-workspace' as any)) {
      if (proposalModalReqId) {
        setProposalModalReqId(null);
        setProposalRehabResult(null);
        setProposalRehabInput(null);
        setProposalConsultRequest(null);
      }
    }
  }, [activeTab]);

  // ── 제안서 발송 가드 (requestScope.getProposalBlockReason 공용 규칙) ──
  // 변호사는 본인 기준, 직원은 컨펌 뒤 담당(감독) 변호사 이름으로 발송되므로 그 변호사 기준으로 판정한다.
  // 이전: 요청받지 않은 변호사·이미 제안서를 보낸 변호사·종료된 요청에도 제안서가 발송됐다.
  const getProposalSendBlockReason = (reqId: string | null | undefined, opts: { ignoreApproval?: boolean } = {}): string | null => {
    const req = reqId ? requests.find(r => r.id === reqId) : undefined;
    if (!req) return '상담 요청을 찾을 수 없습니다.';
    if (isLawyerOrOwner) {
      return getProposalBlockReason(req, activeLawyer, { approved: opts.ignoreApproval ? undefined : activeLawyer.approved });
    }
    const supervisingId = activeStaffMember?.supervisingLawyerId;
    if (!supervisingId) return null; // 담당 변호사 미지정 — 컨펌 승인(최종 발송) 단계에서 판정
    const supervisor = lawyers.find(l => l.id === supervisingId);
    return getProposalBlockReason(req, supervisor || { id: supervisingId }, { approved: opts.ignoreApproval ? undefined : supervisor?.approved });
  };

  // 솔루션 및 비용 제안 버튼 클릭 시 자동 계산 후 워크스페이스 열기
  const [previousTab, setPreviousTab] = useState<string>('client-crm');
  const handleOpenProposalDraft = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    // 보낼 수 없는 요청이면 작성 화면을 열지 않는다 (이전: 다 작성한 뒤에야 막히거나 그대로 발송됨)
    // 자격 심사 대기(체험 모드)만은 작성·미리보기를 허용하고 발송 버튼에서 사유를 보여 준다
    const blockReason = getProposalSendBlockReason(reqId, { ignoreApproval: true });
    if (blockReason) {
      toast.error(blockReason);
      return;
    }

    const rehabInput = mapToRehabUserInput(req);
    const rehabResult = calculateRepayment(rehabInput);

    setProposalRehabResult(rehabResult);
    setProposalRehabInput(rehabInput);
    setProposalConsultRequest(req);
    setProposalModalReqId(reqId);
    // 워크스페이스 뷰로 전환 (이전 탭 저장)
    setPreviousTab(activeTab);
    setActiveTab('proposal-workspace' as any);
  };

  // 제안서 발송 (워크스페이스·모달·AI 사건 분석·직원 컨펌 승인 공용)
  // - 제안서만 추가한다. 대화는 의뢰인이 제안서의 '상담 시작'을 눌러야 열린다 (client/consultFlow.ts getConsultRoomStage)
  // - 이전: 발송과 동시에 status 'comparing'·acceptedLawyerIds에 변호사를 넣어 의뢰인 화면의 '제안서 도착' 단계가 건너뛰어졌다
  // @returns 실제로 발송했으면 true — 막히면 작성 중인 초안·컨펌 대기 건을 그대로 둔다
  const handleSubmitProposalFromDraft = (reqId: string, proposalData: any): boolean => {
    const req = requests.find(r => r.id === reqId);
    if (!req) {
      toast.error('상담 요청을 찾을 수 없습니다.');
      return false;
    }
    // 변호사법: 직원 계정은 의뢰인에게 직접 발송 불가 → 변호사 컨펌 요청 경로만 허용
    if (!isLawyerOrOwner) {
      toast.error('직원 계정은 제안서를 직접 발송할 수 없습니다. 변호사 컨펌을 요청해 주세요.');
      return false;
    }
    // 요청받지 않았거나 이미 보냈거나 종료된 요청, 자격 심사 대기 계정은 발송하지 않는다
    const blockReason = getProposalBlockReason(req, activeLawyer, { approved: activeLawyer.approved });
    if (blockReason) {
      toast.error(blockReason);
      return false;
    }

    const isAIPremium = !!proposalData.aiInsights;

    // 의뢰인 비교표(client/room/ProposalCompareTable)가 읽는 값만 담은 요약 — 초안에 실제로 있는 값만 넣는다
    // (이전: AI 프리미엄이 아니면 proposalData를 저장하지 않아 착수금·예납금·수임료 메모가 '제안서 참고'로만 보였다)
    const draftFees = proposalData.fees || {};
    const compareFees: Record<string, number | string> = {};
    for (const key of ['totalFee', 'downPayment', 'installments', 'monthlyInstallment', 'courtDeposit']) {
      const value = draftFees[key];
      if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) compareFees[key] = Number(value);
    }
    if (typeof draftFees.feeMemo === 'string' && draftFees.feeMemo.trim()) compareFees.feeMemo = draftFees.feeMemo.trim();
    const draftMonths = Number(proposalData.diagnosis?.repaymentMonths);
    const compareSummary = {
      fees: compareFees,
      ...(draftMonths > 0 ? { diagnosis: { repaymentMonths: draftMonths } } : {}),
    };

    const newProposal = {
      id: `prop-${Date.now()}`,
      lawyerId: activeLawyer.id,
      lawyerName: activeLawyer.name,
      lawyerAvatar: activeLawyer.avatar || activeLawyer.avatarData,
      firmName: activeLawyer.firmName || '개인 변호사',
      feasibility: proposalData.diagnosis.status === 'POSSIBLE' ? '진행 가능' : proposalData.diagnosis.status === 'DIFFICULT' ? '진행 어려움' : '진행 불가',
      monthlyPayment: Math.round(proposalData.diagnosis.monthlyPayment / 10000),
      duration: proposalData.diagnosis.repaymentMonths,
      reductionRate: proposalData.diagnosis.debtReductionRate,
      totalReduction: Math.round(proposalData.diagnosis.estimatedReduction / 10000),
      fee: Math.round(proposalData.fees.totalFee / 10000),
      installment: `착수금 ${Math.round(proposalData.fees.downPayment / 10000)}만원, ${proposalData.fees.installments}회 분납`,
      // '제안서 발송'은 소견 없이 보낼 때의 자리표시 문구 — 의뢰인 화면(client/proposalText.ts PLACEHOLDER_REMARKS)이
      // 이 문자열로 비교해 변호사 소견처럼 보이지 않게 하므로, 바꾸려면 그쪽과 함께 바꾼다
      remark: proposalData.lawyerOpinion || '제안서 발송',
      specialNotes: proposalData.specialNotes,
      clientQnA: proposalData.clientQnA,
      createdAt: new Date().toISOString(),
      // AI 프리미엄은 보고서 전체, 그 외에는 비교표용 요약
      proposalData: isAIPremium ? proposalData : compareSummary,
    };

    // 1) 제안서만 추가 — 상태는 'requested'일 때만 'responding'으로, 그 외(비교 상담 중 등)는 그대로 둔다
    setRequests(prev => prev.map(r => {
      if (r.id !== reqId) return r;
      return {
        ...r,
        status: r.status === 'requested' ? ('responding' as const) : r.status,
        proposals: [...(r.proposals || []), newProposal],
      };
    }));

    // 2) 채팅 메시지: 시스템 안내 + 제안서 요약 메시지
    //    안내는 이 변호사 대상으로만 남긴다 (의뢰인 화면의 다른 변호사 탭에 섞이지 않게)
    onAddMessage(
      reqId,
      `[System] ${activeLawyer.name} 변호사가 제안서를 보냈습니다.`,
      'lawyer',
      'system',
      'System',
      activeLawyer.id
    );

    const feeText = `${Math.round(proposalData.fees.totalFee / 10000)}만원`;
    const reductionText = `${proposalData.diagnosis.debtReductionRate}%`;
    const monthlyText = `${Math.round(proposalData.diagnosis.monthlyPayment / 10000)}만원/월`;

    // AI 프리미엄일 때 확장 메시지
    const aiSuffix = isAIPremium && proposalData.aiInsights
      ? `\n\n📊 정밀 분석 기반 진단입니다.\n• 채무 구조: 무담보 ${Math.round(proposalData.aiInsights.debtBreakdown.unsecured / 10000)}만원 / 담보 ${Math.round(proposalData.aiInsights.debtBreakdown.secured / 10000)}만원${proposalData.aiInsights.debtBreakdown.tax > 0 ? ` / 조세 ${Math.round(proposalData.aiInsights.debtBreakdown.tax / 10000)}만원` : ''}\n• 검토 등급: ${proposalData.aiInsights.reviewGrade === 'NORMAL_REVIEW' ? '일반 검토' : proposalData.aiInsights.reviewGrade === 'ENHANCED_REVIEW' ? '강화 검토' : '정밀 검토'}`
      : '';

    const proposalMsg = `안녕하세요, ${req.clientName}님. ${activeLawyer.name} 변호사입니다.\n\n📋 제안 내용을 안내드립니다:\n• 예상 탕감률: ${reductionText}\n• 월 변제금: ${monthlyText}\n• 수임료: ${feeText}\n\n${proposalData.lawyerOpinion ? `💬 소견: ${proposalData.lawyerOpinion}` : ''}${aiSuffix}\n\n자세한 사항은 편하게 문의해 주세요.`;

    onAddMessage(
      reqId,
      proposalMsg.trim(),
      'lawyer',
      activeLawyer.id,
      activeLawyer.name
    );

    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CONSULT_REQUEST',
      `의뢰인에게 제안서 발송 (수임료: ${Math.round(proposalData.fees.totalFee / 10000)}만원, 예상 탕감률: ${proposalData.diagnosis.debtReductionRate}%${isAIPremium ? ', AI 정밀 분석' : ''})`
    );

    // 3) 대화는 의뢰인이 '상담 시작'을 누른 뒤 열리므로 채팅 탭으로 옮기지 않고, 작성 화면을 열기 전 탭으로 돌아간다
    //    (이전: 곧바로 채팅 탭으로 이동하며 '상담 채팅이 시작됩니다'라고 안내)
    if ((activeTab as string) === 'proposal-workspace') {
      if (previousTab === 'client-crm') {
        setCrmTargetClientId(reqId);
        setCrmTargetDetailTab('info');
      }
      setActiveTab(previousTab as any);
    }
    toast.success('제안서를 보냈습니다. 의뢰인이 상담을 시작하면 대화할 수 있습니다.');

    // 모달 닫기 및 상태 초기화
    setProposalModalReqId(null);
    setProposalRehabResult(null);
    setProposalRehabInput(null);
    setProposalConsultRequest(null);
    return true;
  };

  // ── 직원용: 변호사 컨펌 요청 (변호사법 준수) ──
  const [pendingProposals, setPendingProposals] = useState<Array<{
    id: string;
    reqId: string;
    clientName: string;
    staffId: string;
    staffName: string;
    proposalData: any;
    supervisingLawyerId: string;
    memo: string;
    createdAt: string;
  }>>(() => {
    try {
      const stored = localStorage.getItem('legal_crm_pending_proposals');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [reviewModalProposal, setReviewModalProposal] = useState<typeof pendingProposals[0] | null>(null);

  // pendingProposals를 localStorage에 영속화 (브라우저 새로고침 시 유지)
  useEffect(() => {
    localStorage.setItem('legal_crm_pending_proposals', JSON.stringify(pendingProposals));
  }, [pendingProposals]);

  const staffRole = activeStaffMember?.role || 'OWNER';
  const isLawyerOrOwner = staffRole === 'OWNER' || staffRole === 'LAWYER';

  // @returns 컨펌 요청을 보냈으면 true — 막히면 작성 중인 초안을 그대로 둔다
  const handleRequestProposalConfirm = (reqId: string, proposalData: any, memo: string): boolean => {
    const req = requests.find(r => r.id === reqId);
    if (!req) {
      toast.error('상담 요청을 찾을 수 없습니다.');
      return false;
    }
    // 컨펌 뒤 담당 변호사 이름으로 발송되므로 그 변호사가 보낼 수 있는 요청인지 먼저 확인한다 (승인 시 한 번 더 확인)
    const blockReason = getProposalSendBlockReason(reqId);
    if (blockReason) {
      toast.error(blockReason);
      return false;
    }

    // 담당 변호사 결정
    const supervisingId = activeStaffMember?.supervisingLawyerId || activeLawyer.id;
    const supervisingLawyer = lawyers.find(l => l.id === supervisingId) || activeLawyer;

    const pending = {
      id: `pending-${Date.now()}`,
      reqId,
      clientName: req.clientName || (req as any).client_name || '고객',
      staffId: activeStaffMember?.id || '',
      staffName: activeStaffMember?.name || '직원',
      proposalData,
      supervisingLawyerId: supervisingId,
      memo,
      createdAt: new Date().toISOString()
    };

    setPendingProposals(prev => [...prev, pending]);

    // 알림 발송
    createNotification(
      firmTenantId, // NotificationBell과 동일한 tenant 키
      supervisingId,
      {
        type: 'REVIEW_REQUESTED',
        title: '제안서 컨펌 요청',
        body: `${pending.staffName}님이 ${pending.clientName}님 제안서 검토를 요청했습니다.`,
        senderId: pending.staffId,
        senderName: pending.staffName,
        linkType: 'proposal_review',
        linkId: pending.id
      }
    ).catch(err => console.warn('[알림] 발송 실패:', err?.message || err));

    toast.success(`${supervisingLawyer.name} 변호사에게 컨펌 요청을 보냈습니다.`);

    setProposalModalReqId(null);
    setProposalRehabResult(null);
    setProposalRehabInput(null);
    setProposalConsultRequest(null);
    return true;
  };

  const handleApproveProposal = async (pendingId: string, proposalData: any) => {
    const pending = pendingProposals.find(p => p.id === pendingId);
    if (!pending) return;

    // 승인하는 변호사 기준으로 발송 가능 여부를 먼저 확인한다
    // (이전: 발송이 막혀도 컨펌 대기 건을 지우고 직원에게 '승인하고 발송' 알림을 보냈다)
    const pendingReq = requests.find(r => r.id === pending.reqId);
    const blockReason = pendingReq
      ? getProposalBlockReason(pendingReq, activeLawyer, { approved: activeLawyer.approved })
      : '상담 요청을 찾을 수 없습니다.';
    if (blockReason) {
      // 자격 심사 대기는 승인 후 다시 보낼 수 있으므로 안내만 하고, 그 밖의 사유는 반려로 정리할 수 있게 한다
      // (검토 모달에는 반려 버튼이 없어, 보낼 수 없는 컨펌 요청이 목록에 계속 남았다)
      const onlyApproval = pendingReq && !getProposalBlockReason(pendingReq, activeLawyer);
      if (onlyApproval) {
        toast.error(blockReason);
        return;
      }
      const reject = await dialog.confirm({
        title: '제안서를 보낼 수 없습니다',
        message: `${blockReason}\n\n이 컨펌 요청을 반려하고 작성한 직원에게 알릴까요?`,
        confirmText: '반려하기',
        cancelText: '그대로 두기',
        variant: 'warning',
      });
      if (reject) handleRejectProposal(pendingId, blockReason);
      return;
    }

    // 제안서를 승인 → 고객에게 실제 발송 (막히면 컨펌 대기 건을 그대로 둔다)
    if (!handleSubmitProposalFromDraft(pending.reqId, proposalData)) return;

    // pending에서 제거
    setPendingProposals(prev => prev.filter(p => p.id !== pendingId));
    setReviewModalProposal(null);

    // 직원에게 승인 알림
    createNotification(
      firmTenantId, // NotificationBell과 동일한 tenant 키
      pending.staffId,
      {
        type: 'REVIEW_APPROVED',
        title: '제안서 승인 완료',
        body: `${activeLawyer.name} 변호사가 ${pending.clientName}님 제안서를 승인하고 발송했습니다.`,
        senderId: activeLawyer.id,
        senderName: activeLawyer.name,
        linkType: 'consult_request',
        linkId: pending.reqId
      }
    ).catch(err => console.warn('[알림] 발송 실패:', err?.message || err));

    toast.success('제안서를 승인하고 고객에게 발송했습니다.');
  };

  const handleRejectProposal = (pendingId: string, reason: string) => {
    const pending = pendingProposals.find(p => p.id === pendingId);
    if (!pending) return;

    setPendingProposals(prev => prev.filter(p => p.id !== pendingId));
    setReviewModalProposal(null);

    // 직원에게 반려 알림
    createNotification(
      firmTenantId, // NotificationBell과 동일한 tenant 키
      pending.staffId,
      {
        type: 'REVIEW_REJECTED',
        title: '제안서 반려',
        body: `${activeLawyer.name} 변호사가 ${pending.clientName}님 제안서를 반려했습니다. 사유: ${reason}`,
        senderId: activeLawyer.id,
        senderName: activeLawyer.name,
        linkType: 'consult_request',
        linkId: pending.reqId
      }
    ).catch(err => console.warn('[알림] 발송 실패:', err?.message || err));

    toast.info('제안서를 반려했습니다.');
  };

  // Open contract conversion modal for formal case intake
  const handleConvertToCase = (req: ConsultRequest) => {
    // 사건(Case)의 clientId에는 상담 요청 ID가 저장된다(ContractConversionModal) — 요청 ID로 비교한다
    // (이전: req.clientId로 비교해 clientId가 빈 요청·익명('client-temp') 요청끼리 이미 수임된 것으로 잘못 판정됐다)
    const isAlreadyCase = cases.some(c => c.clientId === req.id);
    if (isAlreadyCase) {
      toast.error('이미 정식 수임 사건으로 등록된 고객입니다.');
      return;
    }
    setContractTargetRequest(req);
  };

  const handleContractSuccess = (newCase: Case, newContract: any) => {
    setCases(prev => [newCase, ...prev]);
    // Promote consultation request to contracted/document and ensure lawyer assignment
    if (contractTargetRequest) {
      const targetReqId = contractTargetRequest.id;
      const nextStatus = (newCase.status === 'document' ? 'document' : 'contracted') as ConsultStatus;
      setRequests(prev => prev.map(r => {
        if (r.id === targetReqId) {
          const accepted = r.acceptedLawyerIds ? [...r.acceptedLawyerIds] : [];
          if (!accepted.includes(activeLawyer.id)) accepted.push(activeLawyer.id);
          return {
            ...r,
            status: nextStatus,
            assignedLawyerId: activeLawyer.id,
            acceptedLawyerIds: accepted
          };
        }
        return r;
      }));
      setCrmTargetClientId(targetReqId);
      setCrmTargetDetailTab('contracts');
    }
    setActiveTab('client-crm');
    setContractTargetRequest(null);

    // Log activity
    const feeText = newContract?.totalFee ? `${newContract.totalFee}만 원` : '수임 완료';
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'STATUS_CHANGE',
      `정식 수임 계약 체결: ${newCase.clientName} 의뢰인 (${feeText}) -> [${newCase.status === 'document' ? '서류 준비 착수' : '수임 계약'}]`
    );
  };

  const handleUpdateCaseStatus = (caseId: string, nextStatus: CaseStatus) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() } : c));
    
    // Log case status update
    const targetCase = cases.find(c => c.id === caseId);
    const clientName = targetCase ? targetCase.clientName : '의뢰인';
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'STATUS_CHANGE',
      `사건 진행 단계 수정: ${clientName} 의뢰인 -> [${nextStatus}]`
    );
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

  /**
   * 상담 채팅 전송 — 승인 확인과 활동 로그를 한곳에서 처리한다.
   * (이전: 채팅 탭이 이 함수를 거치지 않고 onAddMessage를 직접 호출해 체험 모드 계정도 전송이 실행됨)
   * @returns 전송을 받아들였으면 true (입력창을 비움)
   */
  const handleSendChat = (reqId: string, text: string): boolean => {
    if (activeLawyer?.approved === false) {
      toast.warning('현재 자격 심사 대기(체험 모드) 상태입니다. 관리자 정식 승인 완료 후 실제 의뢰인 상담 메시지를 전송하실 수 있습니다.');
      return false;
    }
    const trimmed = text.trim();
    if (!trimmed || !reqId) return false;
    // 의뢰인이 제안서의 '상담 시작'을 누르기 전에는 대화가 열리지 않는다 (의뢰인 화면 consultFlow 규칙과 같게)
    // (이전: 제안서 발송 시 자동 수락되어 의뢰인이 고르기 전부터 메시지를 보낼 수 있었다)
    const targetReq = requests.find(r => r.id === reqId);
    if (targetReq && !isChatOpenWithLawyer(targetReq, activeLawyer.id)) {
      toast.warning(hasProposalFrom(targetReq, activeLawyer.id)
        ? '의뢰인이 제안서를 확인하고 상담 시작을 누르면 대화가 열립니다.'
        : '먼저 제안서를 보내 주세요. 의뢰인이 상담 시작을 누르면 대화가 열립니다.');
      return false;
    }
    // 입력창은 바로 비우고(ChatComposer 계약), 서버 저장 결과는 말풍선(보내는 중·다시 보내기)과 안내로 알린다
    // (이전: 저장 결과를 받지 않아 전송이 실패해도 입력창만 비워지고 아무 표시가 없었다)
    void Promise.resolve(onAddMessage(reqId, trimmed, 'lawyer', activeLawyer.id, activeLawyer.name)).then(ok => {
      if (ok === false) toast.error('메시지를 보내지 못했습니다. 말풍선의 다시 보내기를 눌러 주세요.');
    });
    
    // Log message sent (본문은 platformActivityService에서 제거됨)
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CHAT_SEND',
      `의뢰인 상담 대화 작성: "${trimmed.substring(0, 30)}${trimmed.length > 30 ? '...' : ''}"`
    );
    return true;
  };

  // Live Statistics - 현재 변호사 관련 요청만 필터
  const isRelevantRequest = (r: ConsultRequest) => {
    const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || 
                        r.selectedLawyerId === activeLawyer.id ||
                        r.acceptedLawyerIds?.includes(activeLawyer.id) ||
                        r.assignedLawyerId === activeLawyer.id ||
                        (activeLawyer.email && (r.assignedLawyerEmail === activeLawyer.email || r.selectedLawyerEmails?.includes(activeLawyer.email) || r.selectedLawyerIds?.includes(activeLawyer.email)));
    const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
      const targetLawyer = lawyers.find(l => l.id === id);
      return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
    });
    // 공개 요청은 제안서 자리가 남아 있는 동안만 포함 — 진행 중 건은 담당 변호사 본인 것만
    // (이전: status === 'requested'일 때만 포함해, 첫 제안서가 도착해 'responding'이 되면 다른 변호사에게서 사라졌다)
    const openMatch = isOpenForProposals(r);
    return directMatch || sameFirmMatch || openMatch;
  };
  /** 본인(또는 같은 사무소)이 담당·참여 중인 요청만 (오픈 매칭 대기 제외) */
  const isOwnRequest = (r: ConsultRequest) => {
    if (!activeLawyer.id) return false;
    return Boolean(
      r.selectedLawyerIds?.includes(activeLawyer.id) ||
      r.selectedLawyerId === activeLawyer.id ||
      r.acceptedLawyerIds?.includes(activeLawyer.id) ||
      r.assignedLawyerId === activeLawyer.id ||
      (r as any).createdByLawyerId === activeLawyer.id ||
      (activeLawyer.email && (r.assignedLawyerEmail === activeLawyer.email || r.selectedLawyerEmails?.includes(activeLawyer.email)))
    );
  };
  const ownRequests = requests.filter(isOwnRequest);
  // 영업 리드 저장소를 로그인 사무소(변호사) 단위로 분리 — 아래 사이드바 배지·영업관리 탭이 이 범위를 사용
  setSalesLeadScope(activeLawyer.lawFirmId || activeLawyer.id);
  const ownRequestIds = new Set(ownRequests.map(r => r.id));
  // '신규 상담' — 내가 아직 제안서를 보내지 않았고 보낼 수 있는 요청 (requestScope 공용 판정, 상태와 무관)
  // 이전: status === 'requested'만 신규로 세어, 비교 상담 중 첫 제안서 뒤 나머지 변호사에게서 요청이 사라지고
  //       비교 상담 중 추가로 요청받은 변호사는 대시보드·알림에서 요청을 볼 수 없었다
  const newRequestsForMe = requests.filter(r => isNewRequestForLawyer(r, activeLawyer, lawyers));
  const totalOpenRequestsCount = newRequestsForMe.length;
  const activeChatsCount = ownRequests.filter(r => r.status === 'counseling').length;
  const ownCases = cases.filter(c => !c.assignedLawyerId || c.assignedLawyerId === activeLawyer.id || ownRequestIds.has(c.clientId));
  const totalCasesCount = ownCases.length;
  const directCounselingCount = ownRequests.filter(r => r.status === 'responding').length;

  // ── 신규 상담 접수 알림 (설정 탭의 텔레그램·이메일·브라우저 알림 채널) ──
  // 로그인 직후 이미 있던 요청은 알리지 않고, 이후 새로 '신규 상담'이 된 요청만 1회 발송.
  // 비교 상담 중 의뢰인이 나를 추가로 요청한 경우도 포함한다 (isNewRequestForLawyer, 이전: status 'requested'만).
  // CRM이 열려 있는 브라우저에서만 동작한다 (서버 푸시 아님).
  const notifiedRequestIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isLoggedIn || !activeLawyer.id) {
      notifiedRequestIdsRef.current = null;
      return;
    }
    const candidates = requests.filter(r => isNewRequestForLawyer(r, activeLawyer, lawyers));
    if (notifiedRequestIdsRef.current === null) {
      notifiedRequestIdsRef.current = new Set(candidates.map(r => r.id));
      return;
    }
    const seen = notifiedRequestIdsRef.current;
    const fresh = candidates.filter(r => !seen.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach(r => seen.add(r.id));
    const settings = notifSettings;
    fresh.slice(0, 5).forEach(r => {
      const fp: any = r.financialProfile || {};
      notifyAllChannels(settings, {
        type: r.entryCategory?.label || r.title || '회생·파산 상담',
        region: fp.residenceRegion || '지역 미기재',
        debt: fp.debtTotal ? `${Number(fp.debtTotal).toLocaleString()}만원` : '미기재',
        income: fp.income ? `${Number(fp.income).toLocaleString()}만원` : '미기재',
        tags: [],
      }).then(() => setNotifLogs(loadNotificationLogs())).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, isLoggedIn, activeLawyer.id]);

  const currentChatRequest = requests.find(r => r.id === activeChatReqId);
  const currentChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  const currentChatRequestResult = React.useMemo(() => {
    if (!currentChatRequest || !currentChatRequest.financialProfile) return undefined;
    const profile = currentChatRequest.financialProfile;
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
      rentCost: 0,
      deposit: (profile.rentalDeposit || 0) * 10000,
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
  }, [currentChatRequest]);

  if (!isLoggedIn) {
    // [FLICKER 방지] OAuth 복귀 세션 확인 중 또는 인증 성공 시 매끄러운 브릿지 뷰 렌더링
    if (isAuthenticating || isAuthSuccess) {
      return (
        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl p-8 space-y-6 text-center animate-fadeIn">
            {/* 세련된 로고 & 펄스 애니메이션 */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="my김변 로고" className="w-14 h-14 rounded-2xl object-cover shadow-md" />
                <div className="absolute -inset-1.5 rounded-2xl border-2 border-brand/30 animate-ping opacity-25 pointer-events-none"></div>
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-slate-900">
                  {isAuthSuccess ? '대리인 보안 인증 완료' : '변호사 보안 인증 확인 중'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAuthSuccess ? 'CRM 대시보드로 안전하게 이동합니다...' : '보안 세션 토큰을 검증하고 있습니다.'}
                </p>
              </div>
            </div>

            {/* 인디케이터 바 */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-brand h-full rounded-full animate-pulse w-3/4 mx-auto"></div>
            </div>

            <p className="text-[11px] text-slate-400">
              🔒 암호화된 토큰 검증 및 자격 인가 절차 진행 중
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="my김변 로고" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-slate-900">{(platformConfig.siteLogoText || "my김변")} 변호사 CRM</span>
            </div>
            <p className="text-slate-600 text-xs">도산 전문 법률 대리인 통합 솔루션</p>
          </div>

          {/* Main Card Content */}
          <div className="space-y-4 text-left">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">변호사 및 파트너 로그인</h3>

            {/* 초대 링크 배너 */}
            {inviteToken && inviteTokenValid && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span><strong>초대 링크가 확인되었습니다.</strong> 아래 소셜 계정으로 로그인하시면 담당 역할({inviteTokenRole === 'LAWYER' ? '담당 변호사' : inviteTokenRole === 'CONSULTANT' ? '상담 직원' : inviteTokenRole === 'STAFF' ? '사무 직원' : '경리 직원'})로 즉시 연동됩니다.</span>
              </div>
            )}

            {/* Security Portal Notice */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Lock className="w-3.5 h-3.5 text-brand" />
                <span>변호사 및 로펌 파트너 전용 보안 포털</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                비밀번호 저장 없는 소셜 보안 계정으로 1초 로그인하세요.<br/>
                신규 대리인은 최초 로그인 시 자격 심사 절차가 진행됩니다.
              </p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3.5 rounded-xl font-medium">
                {loginError}
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-3 pt-1">
              {/* Kakao 로그인 */}
              <button
                type="button"
                disabled={!!isStartingOAuth}
                onClick={handleKakaoLogin}
                className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 disabled:opacity-60 text-[#191919] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-base cursor-pointer active:scale-[0.98]"
              >
                <span className="w-6 h-6 flex items-center justify-center font-black text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full shrink-0">K</span>
                <span>{isStartingOAuth === 'kakao' ? '카카오 인증 연결 중...' : '카카오 계정으로 변호사 로그인'}</span>
              </button>

              {/* Google 로그인 */}
              <button
                type="button"
                disabled={!!isStartingOAuth}
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-base cursor-pointer active:scale-[0.98]"
              >
                <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full shrink-0">G</span>
                <span>{isStartingOAuth === 'google' ? 'Google 인증 연결 중...' : 'Google 계정으로 변호사 로그인'}</span>
              </button>
            </div>

            {/* Dev Only Fast Login */}
            {import.meta.env.DEV && (
              <div className="pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => {
                    if (!import.meta.env.DEV) return;
                    const demoLawyer = lawyers.find(l => l.id === 'lawyer-1') || lawyers[0] || mockLawyers[0];
                    sessionStorage.setItem(DEV_LAWYER_SESSION_KEY, demoLawyer.id);
                    setActiveLawyer(demoLawyer);
                    setIsLoggedIn(true);
                    toast.success(`[DEV] ${demoLawyer.name} 테스트 계정으로 로그인되었습니다. (서버 권한 없음)`);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-brand font-bold py-3 rounded-xl text-sm border border-slate-200 transition-all cursor-pointer active:scale-[0.98]"
                >
                  🛠️ 개발용 1초 즉시 로그인 (DEV Only)
                </button>
              </div>
            )}
          </div>

          {/* 변호사 가입 안내 버튼 */}
          <button
            type="button"
            onClick={() => setShowServiceGuide(true)}
            className="w-full border border-brand/30 text-brand font-bold py-3 rounded-2xl text-sm hover:bg-brand/5 transition-colors mt-2"
          >
            변호사 가입 안내
          </button>
        </div>

        {/* ── 서비스 안내 모달 (풀스크린) ── */}
        {showServiceGuide && (
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            {/* 상단 네비 */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="로고" className="w-8 h-8 rounded-lg object-cover" />
                  <span className="font-black text-lg text-slate-900">{platformConfig.siteLogoText || 'my김변'} <span className="text-brand">for Lawyers</span></span>
                </div>
                <button onClick={() => setShowServiceGuide(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold transition-colors">✕</button>
              </div>
            </header>

            {/* 히어로 */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-20 md:py-28">
              <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-500/15 rounded-full blur-[80px]" />
              </div>
              <div className="relative z-10 max-w-4xl mx-auto px-4 text-center space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  변호사 전용 파트너 플랫폼
                </div>
                <h1 className="text-3xl md:text-5xl font-black leading-tight">
                  의뢰인이 <span className="text-brand-light">먼저 찾아오는</span><br />회생·파산 전문 플랫폼
                </h1>
                <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                  의뢰인이 AI 자가진단을 완료하고, 채무 구조 데이터를 정리한 상태로 변호사님께 상담을 요청합니다.<br />
                  더 이상 기초 상담에 시간을 낭비하지 마세요.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <button onClick={() => setShowServiceGuide(false)} className="bg-brand hover:bg-brand-hover text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-brand/30">
                    지금 바로 시작하기
                  </button>
                  <button onClick={() => setShowServiceGuide(false)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all">
                    로그인 하기
                  </button>
                </div>
              </div>
            </section>

            {/* 핵심 가치 3가지 */}
            <section className="py-16 md:py-20 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <div className="text-center space-y-3 mb-12">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900">왜 {platformConfig.siteLogoText || 'my김변'}인가요?</h2>
                  <p className="text-sm text-slate-500 max-w-lg mx-auto">단순 사건 중개가 아닙니다. 의뢰인의 채무 데이터를 사전 정리해서 변호사님의 업무 효율을 극대화합니다.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: '📊', title: 'AI 사전 진단 데이터', desc: '의뢰인이 상담 전 AI 챗봇으로 채무 구조를 입력합니다. 총 채무, 소득, 자산, 부양가족 등 핵심 데이터가 정리된 상태로 전달됩니다.', color: 'from-indigo-500/10 to-violet-500/10' },
                    { icon: '⚖️', title: '정밀 시뮬레이션 리포트', desc: '2026년 법원 기준 생계비, 청산가치, 변제금을 자동 계산한 리포트와 함께 의뢰인이 도착합니다. 기초 상담 시간이 70% 절감됩니다.', color: 'from-emerald-500/10 to-teal-500/10' },
                    { icon: '💼', title: '솔루션 제안 경쟁 입찰', desc: '최대 3명의 변호사가 의뢰인에게 솔루션과 비용을 제안합니다. 전문성으로 승부하세요. 실력 있는 변호사가 더 많은 사건을 수임합니다.', color: 'from-amber-500/10 to-orange-500/10' }
                  ].map((item, i) => (
                    <div key={i} className={`rounded-2xl bg-gradient-to-br ${item.color} p-6 md:p-8 space-y-4 group hover:shadow-lg transition-all`}>
                      <div className="text-4xl group-hover:scale-110 transition-transform">{item.icon}</div>
                      <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 사용법 4단계 */}
            <section className="py-16 md:py-20 bg-slate-50">
              <div className="max-w-5xl mx-auto px-4">
                <div className="text-center space-y-3 mb-12">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900">이용 방법</h2>
                  <p className="text-sm text-slate-500">가입부터 수임까지 4단계로 간단합니다.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { step: '01', title: '회원가입', desc: '변호사 등록증을 첨부하여 가입 신청', icon: '📝' },
                    { step: '02', title: '승인 완료', desc: '관리자가 자격을 확인하고 계정 활성화', icon: '✅' },
                    { step: '03', title: '상담 요청 수신', desc: 'AI 진단 완료 의뢰인의 상담 요청이 도착', icon: '🔔' },
                    { step: '04', title: '솔루션 제안 & 수임', desc: '변제금·비용 제안서를 보내고 사건 수임', icon: '🤝' }
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 text-center space-y-3 hover:shadow-md hover:border-brand/20 transition-all">
                      <div className="text-3xl">{item.icon}</div>
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand text-xs font-black">{item.step}</div>
                      <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* CRM 기능 소개 */}
            <section className="py-16 md:py-20 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <div className="text-center space-y-3 mb-12">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900">변호사 전용 CRM 기능</h2>
                  <p className="text-sm text-slate-500">사건 관리부터 의뢰인 소통까지, 하나의 플랫폼에서.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: '📋', title: '오픈/지정 상담 대시보드', desc: '의뢰인의 채무 구조, 소득, 리스크 플래그를 한눈에 파악' },
                    { icon: '💬', title: '실시간 채팅 상담', desc: '의뢰인과 1:1 채팅으로 추가 정보 확인 및 상담 진행' },
                    { icon: '📑', title: '솔루션 제안서 발송', desc: '예상 변제금, 탕감률, 수임 비용을 정리한 제안서 전송' },
                    { icon: '📊', title: '사건 진행 관리', desc: '수임 → 접수 → 보정 → 인가까지 단계별 사건 관리' },
                    { icon: '👥', title: '의뢰인 CRM', desc: '의뢰인 연락처, 상담 이력, 진행 상태를 통합 관리' },
                    { icon: '🔒', title: '개인정보 보호', desc: '의뢰인 익명성 및 민감 금융 정보 암호화 보호' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3.5 bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 비용 안내 */}
            <section className="py-16 md:py-20 bg-gradient-to-br from-brand/5 to-violet-500/5">
              <div className="max-w-3xl mx-auto px-4 text-center space-y-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">합리적인 비용 구조</h2>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 md:p-10 space-y-6">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold px-4 py-1.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    초기 비용 0원
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">가입비·월정액 없음. 수임 성공 시에만 과금.</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                    사건을 수임하지 않으면 비용이 발생하지 않습니다.<br />
                    변호사님의 리스크를 최소화하는 성과 기반 과금 구조입니다.
                  </p>
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-black text-brand">0원</div>
                      <div className="text-xs text-slate-500 mt-1">가입비</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-brand">0원</div>
                      <div className="text-xs text-slate-500 mt-1">월정액</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-emerald-600">성과형</div>
                      <div className="text-xs text-slate-500 mt-1">수임 시 과금</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="py-16 md:py-20 bg-white">
              <div className="max-w-3xl mx-auto px-4">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-center mb-10">자주 묻는 질문</h2>
                <div className="space-y-3">
                  {[
                    { q: '어떤 분야의 변호사가 가입할 수 있나요?', a: '현재 개인회생·파산·신용회복 전문 변호사님을 대상으로 운영하고 있습니다. 향후 다른 법률 분야로 확장 예정입니다.' },
                    { q: '의뢰인은 어떻게 유입되나요?', a: '온라인 광고, SEO, SNS 마케팅을 통해 채무 문제로 고민하는 의뢰인이 플랫폼에 유입됩니다. AI 자가진단을 거쳐 채무 데이터가 정리된 상태로 상담을 요청합니다.' },
                    { q: '한 건에 여러 변호사가 제안할 수 있나요?', a: '네, 최대 3명의 변호사가 솔루션 제안서를 보낼 수 있습니다. 의뢰인이 제안서를 비교하고 최종 선택합니다.' },
                    { q: '계정 승인은 얼마나 걸리나요?', a: '변호사 등록증 확인 후 평균 1~2 영업일 이내에 승인됩니다.' },
                    { q: '기존 사무소 홈페이지와 병행 사용이 가능한가요?', a: '물론입니다. 기존 채널은 유지하시면서 추가 사건 수임 채널로 활용하시면 됩니다.' }
                  ].map((item, i) => (
                    <details key={i} className="group bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-sm text-slate-900 hover:bg-slate-100 transition-colors">
                        <span>{item.q}</span>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform text-lg">▾</span>
                      </summary>
                      <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="py-16 md:py-20 bg-slate-900 text-white text-center">
              <div className="max-w-3xl mx-auto px-4 space-y-6">
                <h2 className="text-2xl md:text-3xl font-black">지금 바로 시작하세요</h2>
                <p className="text-sm text-slate-400">가입비·월정액 없음. AI가 정리한 의뢰인 데이터로 더 효율적인 수임을 경험하세요.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => setShowServiceGuide(false)} className="bg-brand hover:bg-brand-hover text-white font-bold px-10 py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand/30">
                    변호사 간편 로그인 / 시작하기
                  </button>
                  <button onClick={() => setShowServiceGuide(false)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-10 py-4 rounded-2xl text-sm transition-all">
                    로그인 페이지로 돌아가기
                  </button>
                </div>
              </div>
            </section>

            {/* 푸터 */}
            <footer className="bg-slate-950 text-slate-500 text-xs text-center py-8 px-4">
              <p>© 2026 {platformConfig.siteLogoText || 'my김변'}. 도산 전문 법률 대리인 통합 플랫폼.</p>
              <p className="mt-1">문의: partner@mykim.law | 사업자등록번호: 000-00-00000</p>
            </footer>
          </div>
        )}
      </div>
    );
  }

  if (isLoggedIn && activeLawyer?.approved === false && !isGuestPreviewMode) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="my김변 로고" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-slate-900">{(platformConfig.siteLogoText || "my김변")} 변호사 CRM</span>
            </div>
            <p className="text-slate-600 text-xs">도산 전문 법률 대리인 통합 솔루션</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-xs text-left space-y-2 leading-relaxed">
            <h4 className="font-bold text-sm text-center">⏳ 계정 승인 심사 대기 중</h4>
            <p>안녕하세요, <strong>{activeLawyer?.name || '변호사'}</strong> 님.</p>
            <p>현재 계정 자격 확인 및 정식 소속 승인 절차가 진행 중입니다.</p>
            <p>{platformConfig.siteLogoText || "my김변"} 플랫폼은 변호사법 제34조 정식 변호사 자격 검증 의무에 따라, 관리자의 수동 라이선스 검토를 거쳐 활동을 승인하고 있습니다.</p>
            <p className="text-[13px] text-slate-600">* 관리자(Admin Portal)가 자격을 확인한 후 정식 승인 처리됩니다.</p>
          </div>

          {/* 심사 진행 상태 카드 (상시 노출) */}
          <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-900 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>변호사 자격 및 서류 심사 진행 중</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              접수된 변호사 등록 정보 및 자격 서류를 관리자가 확인하고 있습니다.<br/>
              변호사법 제34조 검증 완료 후 즉시 정식 CRM 활동이 승인됩니다.
            </p>
            {activeLawyer?.licenseNumber && (
              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-slate-700">
                <span>등록번호: <strong className="text-emerald-800 font-bold">{activeLawyer.licenseNumber}</strong></span>
                <span className="text-[11px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md">서류 확인 중</span>
              </div>
            )}
          </div>

          {/* 서류 추가 제출 / 수정 접이식 영역 (기본은 닫힘) */}
          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={() => setShowDocSubmit(prev => !prev)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-4 cursor-pointer"
            >
              {showDocSubmit ? '서류 제출/수정 창 닫기 ▲' : '서류 추가 보완 또는 등록번호 수정이 필요하신가요? ▼'}
            </button>
          </div>

          {showDocSubmit && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>소속 형태 및 변호사 자격 증빙 제출 / 수정</span>
              </div>

              {/* ── 1. 소속 형태 3가지 선택 카드 ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">소속 및 개업 형태 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupFirmType('INDIVIDUAL')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      signupFirmType === 'INDIVIDUAL'
                        ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-lg mb-1">👤</div>
                    <div className="font-bold text-xs">1인 개인사무소</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">단독 개업 변호사</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupFirmType('LAW_FIRM')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      signupFirmType === 'LAW_FIRM'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-600/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-lg mb-1">🏢</div>
                    <div className="font-bold text-xs">법무법인/팀 대표</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">로펌 개설 (팀원 초대)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupFirmType('ASSOCIATE')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      signupFirmType === 'ASSOCIATE'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-lg mb-1">👥</div>
                    <div className="font-bold text-xs">소속 변호사</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">로펌 소속/초대 합류</div>
                  </button>
                </div>
              </div>

              {/* ── 2. 소속 로펌 정보 & 국세청 진위확인 ── */}
              <div className="space-y-2 pt-1 border-t border-slate-200/60">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {signupFirmType === 'LAW_FIRM' ? '법무법인명' : signupFirmType === 'ASSOCIATE' ? '소속 법무법인 / 로펌명' : '법률사무소 상호명'}
                  </label>
                  <input
                    type="text"
                    placeholder={signupFirmType === 'LAW_FIRM' ? '예: 법무법인 한강' : signupFirmType === 'ASSOCIATE' ? '예: 법무법인 태평양' : '예: 김우진 법률사무소'}
                    value={signupFirmName}
                    onChange={(e) => setSignupFirmName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                {signupFirmType !== 'ASSOCIATE' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">사업자등록번호 (10자리)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="123-45-67890"
                        value={signupBizNumber}
                        onChange={(e) => setSignupBizNumber(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <button
                        type="button"
                        onClick={handleCheckFirmNts}
                        disabled={checkingFirmNts}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
                      >
                        {checkingFirmNts ? '조회 중...' : '국세청 검증'}
                      </button>
                    </div>
                    {signupNtsStatus === 'VALID' && (
                      <p className="text-[11px] text-emerald-600 font-bold mt-1">✅ 국세청 정상 계속사업자 확인 완료</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-normal bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                    💡 소속(어쏘) 변호사는 별도의 사업자등록증 없이, 본인의 변호사 신분증만 촬영하여 제출하시면 관리자 확인 후 해당 로펌에 자동 배속됩니다.
                  </p>
                )}
              </div>

              {/* ── 3. 변호사 등록번호 ── */}
              <div className="space-y-1 pt-1 border-t border-slate-200/60">
                <label className="text-xs font-bold text-slate-700 block">대한변협 변호사 등록번호 (5자리)</label>
                <input
                  type="text"
                  placeholder="예: 12345"
                  value={signupLicenseNumber}
                  onChange={(e) => setSignupLicenseNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900 font-mono"
                />
              </div>

              {/* ── 4. 변호사 신분증 스마트폰 촬영 / 첨부 ── */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                  <span>대한변협 변호사 신분증 (스마트폰 촬영 / PDF)</span>
                </label>
                <label className="block cursor-pointer">
                  <div className={`border-2 ${licensePreview ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300 border-dashed bg-slate-50 hover:bg-slate-100'} rounded-2xl p-4 text-xs text-center transition-all hover:border-brand/50`}>
                    {licensePreview ? (
                      <div className="space-y-2">
                        <img src={licensePreview} alt="신분증 미리보기" className="max-h-36 mx-auto rounded-xl object-contain border border-emerald-300 bg-white shadow-xs" />
                        <span className="text-emerald-700 font-bold block text-xs">✅ 신분증 촬영/첨부 완료 (터치하여 다시 촬영)</span>
                      </div>
                    ) : (
                      <div className="py-2 space-y-1.5">
                        <div className="text-2xl">📷</div>
                        <span className="text-slate-800 font-bold block text-xs">스마트폰 카메라로 직접 촬영하거나 앨범에서 선택</span>
                        <span className="text-slate-500 text-[11px] block leading-normal">
                          지갑 속 대한변협 변호사 신분증 앞면 (최대 5MB)
                        </span>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleLicenseFileChange} className="hidden" />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSubmitLicenseDoc}
                className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                자격 증빙 서류 저장
              </button>
            </div>
          )}

          {/* 둘러보기 및 로그아웃 버튼 영역 */}
          <div className="space-y-2 pt-1">
            <button 
              type="button"
              onClick={() => {
                setIsGuestPreviewMode(true);
                toast.info('변호사 포털 체험 모드로 진입했습니다. 기능을 자유롭게 둘러보세요.');
              }}
              className="w-full bg-brand hover:bg-brand-hover text-white font-extrabold py-3.5 rounded-2xl text-xs sm:text-sm shadow-md shadow-brand/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Compass className="w-4 h-4" />
              <span>변호사 어드민 페이지 둘러보기 (체험 모드)</span>
            </button>
            <button 
              type="button"
              onClick={handleLogout}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs border border-slate-200 transition-colors cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white animate-fadeIn">
      {/* ── 둘러보기(체험 모드) 상단 안내 배너 ── */}
      {isLoggedIn && activeLawyer?.approved === false && isGuestPreviewMode && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium shadow-md z-50 shrink-0 border-b border-amber-500/30">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full font-bold text-[11px] animate-pulse flex items-center gap-1 shrink-0">
              <Compass className="w-3.5 h-3.5" />
              <span>체험 모드</span>
            </span>
            <span className="text-amber-100 leading-snug">
              현재 <strong className="text-white font-bold underline underline-offset-2">변호사 자격 심사 대기 중</strong>입니다. 포털 기능을 미리 둘러보실 수 있으며, 관리자 승인 완료 후 실시간 의뢰인 수임 및 상담이 정식 개시됩니다.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={() => setIsGuestPreviewMode(false)}
              className="bg-white text-amber-900 hover:bg-amber-50 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              심사 대기 화면으로 돌아가기
            </button>
            <button 
              type="button"
              onClick={handleLogout}
              className="bg-black/25 hover:bg-black/40 text-white px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col relative">
      
        {/* ── Top Header Bar (단일 딥 네이비, 기획서 1-1, 1-3) ── */}
        <header className="sticky top-0 z-40 bg-[#1E3A5F] h-16 px-3 sm:px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-xs border-b border-[#162d4a]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img 
              src="./mykim_logo.png" 
              alt="my김변 로고" 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-xs" 
            />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">my김변</span>
              <span className="text-[11px] sm:text-[12px] text-slate-300 font-bold">변호사 관리 시스템</span>
            </div>
            {activeLawyer.firmName && (
              <span className="text-slate-300 text-xs sm:text-sm font-semibold hidden md:inline ml-2 border-l border-white/20 pl-3">
                {activeLawyer.firmName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <img 
                src={activeLawyer.avatarData || activeLawyer.avatar} 
                alt={activeLawyer.name} 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-white/20 shadow-xs" 
              />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm sm:text-base font-bold text-white leading-tight">{activeLawyer.name}</span>
                <span className="text-[11px] text-slate-300 font-medium">
                  {/* 역할 영문(LAWYER) 노출 방지 -> 한국어 표준 라벨 (기획서 1-3) */}
                  {activeLawyer.role === 'LAWYER' ? '담당 변호사' : activeLawyer.role === 'ADMIN' ? '대표 관리자' : '변호사'}
                </span>
              </div>
            </div>

            {/* 전역 검색 버튼 (모바일 및 데스크톱 공통 지원) */}
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-slate-200 hover:text-white transition-all cursor-pointer text-xs active:scale-95 shadow-2xs" 
              title="전역 검색 (사건, 의뢰인, 메모)"
            >
              <Search className="w-3.5 h-3.5 text-slate-200" />
              <span className="hidden sm:inline font-semibold text-slate-200">검색</span>
            </button>


            <NotificationBell
              tenantId={firmTenantId}
              userId={activeStaffMember?.id || activeLawyer.id}
              onNavigate={(linkType, linkId) => {
                if (linkType === 'proposal_review') {
                  const pending = pendingProposals.find(p => p.id === linkId);
                  if (pending) {
                    const req = requests.find(r => r.id === pending.reqId);
                    if (req) {
                      const rehabInput = mapToRehabUserInput(req);
                      const rehabResult = calculateRepayment(rehabInput);
                      setProposalRehabResult(rehabResult);
                      setProposalRehabInput(rehabInput);
                      setProposalConsultRequest(req);
                      setReviewModalProposal(pending);
                    }
                  }
                  setActiveTab('dashboard');
                } else if (linkType === 'consult_request') {
                  if (linkId) openCase(linkId, 'info');
                  else openCase();
                } else if (linkType === 'case') {
                  // 빈 'cases' 탭 대신 CRM 해당 사건으로 직행 (기획서 0-8)
                  if (linkId) openCase(linkId, 'court');
                  else openCase();
                } else if (linkType === 'copilot_review') {
                  if (linkId) setCopilotPreselectedReqId(linkId);
                  setActiveTab('case-copilot');
                } else if (linkType === 'task') {
                  setActiveTab('tasks-schedule');
                } else if (linkType === 'chat' || (linkType as any) === 'consult_message') {
                  if (linkId) openThread(linkId);
                  else setActiveTab('chat');
                }
              }}
            />
          </div>
        </header>

        {/* ── Body: Sidebar + Main Content ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar (Desktop/Tablet) — 접기/펼치기 가능 ── */}
          <aside className={`hidden lg:flex ${sidebarCollapsed ? 'w-[72px]' : 'w-64'} bg-[#111827] flex-col shrink-0 fixed top-16 left-0 bottom-0 z-30 border-r border-slate-800 transition-all duration-200 select-none`}>
            
            {/* 접힌 상태: 최상단 펼치기 토글 버튼 */}
            {sidebarCollapsed && (
              <div className="pt-3 pb-1 px-2.5 flex flex-col items-center">
                <button 
                  onClick={() => setSidebarCollapsed(false)} 
                  className="w-full flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer group"
                  title="사이드바 펼치기"
                >
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand transition-colors" />
                </button>
                <div className="w-full border-t border-slate-800/80 my-2" />
              </div>
            )}

            {/* 스크롤 가능한 네비게이션 메뉴 영역 (기획서 1-2: 5대 그룹 메뉴 설정 배열) */}
            <nav className={`flex-1 py-3 overflow-y-auto no-scrollbar ${sidebarCollapsed ? 'px-2.5' : 'px-3.5'} space-y-3`}>
              {(() => {
                // 1. 배지 카운트 계산
                const chatBadgeCount = requests.filter(r => {
                  const acceptedMe = (r.acceptedLawyerIds || []).includes(activeLawyer.id);
                  if (r.status === 'comparing' || r.status === 'counseling') return acceptedMe || r.selectedLawyerId === activeLawyer.id;
                  return r.status === 'responding' && acceptedMe;
                }).length;

                const crmMap = loadCrmExtMap();
                let feeAlertCount = 0;
                const todayStr = localDateStr();
                ownRequests.forEach(r => {
                  const ext = crmMap[r.id] || getCrmExt(r.id);
                  (ext.feeSchedule || []).forEach(inst => {
                    if (inst.status === 'overdue' || (inst.status === 'pending' && inst.dueDate <= todayStr)) {
                      feeAlertCount++;
                    }
                  });
                });

                const salesNewCount = loadSalesLeads().filter(l => l.status === 'new').length;
                const qnaWaitingCount = qas ? qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length : 0;
                const staffPendingCount = staffMembers.filter(m => m.status === 'pending').length;

                type SidebarBadge = { count: number; label?: string; variant: 'normal' | 'urgent'; };
                type SidebarItem = { id: any; label: string; icon: any; badge?: SidebarBadge | null; isLocked?: boolean; };
                type SidebarGroupDef = { groupKey: string; title: string; items: SidebarItem[]; };

                // 2. 5대 그룹 메뉴 정의 (기획서 4.1: 홈, 상담, 사건, 영업·홍보, 사무소)
                const sidebarGroups: SidebarGroupDef[] = [
                  {
                    groupKey: 'home',
                    title: '홈',
                    items: [
                      { id: 'dashboard', label: '오늘의 업무', icon: BarChart2 },
                    ],
                  },
                  {
                    groupKey: 'consultation',
                    title: '상담',
                    items: [
                      {
                        id: 'requests',
                        label: '상담 요청',
                        icon: Inbox,
                        badge: totalOpenRequestsCount > 0 ? { count: totalOpenRequestsCount, variant: 'urgent' as const } : null,
                      },
                      {
                        id: 'chat',
                        label: '상담 채팅',
                        icon: MessageSquare,
                        badge: chatBadgeCount > 0 ? { count: chatBadgeCount, variant: 'normal' as const } : null,
                      },
                      {
                        id: 'case-copilot',
                        label: 'AI 사건 분석',
                        icon: activeLawyer.aiCaseAnalysisEnabled ? Microscope : Lock,
                        badge: !activeLawyer.aiCaseAnalysisEnabled
                          ? { count: 0, label: '유료', variant: 'normal' as const }
                          : (newRequestsForMe.length > 0 ? { count: newRequestsForMe.length, variant: 'normal' as const } : null),
                        isLocked: !activeLawyer.aiCaseAnalysisEnabled,
                      },
                    ],
                  },
                  {
                    groupKey: 'cases',
                    title: '사건',
                    items: [
                      {
                        id: 'client-crm',
                        label: '사건 관리',
                        icon: Users,
                        badge: ownRequests.length > 0 ? { count: ownRequests.length, variant: 'normal' as const } : null,
                      },
                      { id: 'tasks-schedule', label: '일정·기한', icon: CalendarCheck },
                      { id: 'contracts', label: '계약 현황', icon: FileSignature },
                      {
                        id: 'fee-settlement',
                        label: '수임료 수납',
                        icon: Coins,
                        badge: feeAlertCount > 0 ? { count: feeAlertCount, variant: 'urgent' as const } : null,
                      },
                    ],
                  },
                  {
                    groupKey: 'marketing',
                    title: '영업·홍보',
                    items: [
                      {
                        id: 'sales-leads',
                        label: '영업 DB',
                        icon: PhoneCall,
                        badge: salesNewCount > 0 ? { count: salesNewCount, label: `신규 ${salesNewCount}`, variant: 'normal' as const } : null,
                      },
                      {
                        id: 'qna-answer',
                        label: '공개 Q&A',
                        icon: ListCheck,
                        badge: qnaWaitingCount > 0 ? { count: qnaWaitingCount, variant: 'urgent' as const } : null,
                      },
                      { id: 'billing', label: '광고·결제', icon: CreditCard },
                    ],
                  },
                  {
                    groupKey: 'office',
                    title: '사무소',
                    items: [
                      {
                        id: 'staff-management',
                        label: '직원·권한',
                        icon: Shield,
                        badge: staffPendingCount > 0 ? { count: staffPendingCount, variant: 'urgent' as const } : null,
                      },
                      { id: 'inquiry-to-admin', label: '마이김변 문의', icon: MessageCircle },
                      { id: 'settings', label: '설정', icon: Settings },
                    ],
                  },
                ];

                return sidebarGroups.map((group, groupIdx) => {
                  const visibleItems = group.items.filter(item => permissionCtx.canAccessTab(item.id));
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={group.groupKey} className="space-y-1">
                      {groupIdx > 0 && <div className="border-t border-slate-800/80 my-2" />}
                      {!sidebarCollapsed && (
                        <div className="flex items-center justify-between px-3 pb-1 pt-1">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{group.title}</p>
                          {groupIdx === 0 && (
                            <button
                              onClick={() => setSidebarCollapsed(true)}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              title="사이드바 접기"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>접기</span>
                            </button>
                          )}
                        </div>
                      )}
                      {visibleItems.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        const b = item.badge;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-[14px] transition-all cursor-pointer ${
                              isActive
                                ? 'bg-brand text-white font-bold shadow-xs'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                            } ${item.isLocked ? 'opacity-60' : ''}`}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <Icon className={`w-4.5 h-4.5 shrink-0 ${item.id === 'fee-settlement' ? 'text-amber-400' : ''} ${item.id === 'sales-leads' ? 'text-blue-400' : ''}`} />
                            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                            {b && (
                              sidebarCollapsed ? (
                                <span
                                  className={`absolute top-1.5 right-1.5 rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-black ring-2 ring-[#0F2440] ${
                                    b.variant === 'urgent' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-200'
                                  }`}
                                >
                                  {b.label ? b.label.slice(0, 1) : (b.count > 99 ? '99+' : b.count)}
                                </span>
                              ) : b.label === '유료' ? (
                                <span className="ml-auto bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                                  유료
                                </span>
                              ) : (
                                <span
                                  className={`ml-auto rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-2xs ${
                                    b.variant === 'urgent' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {b.count > 99 ? '99+' : b.count}
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </nav>

            {/* 사이드바 하단: 로그아웃 + 버전 */}
            <div className={`py-3 border-t border-slate-800 ${sidebarCollapsed ? 'px-2' : 'px-3.5'} space-y-1`}>
              <button 
                onClick={handleLogout}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-[15px] text-slate-400 hover:bg-white/5 hover:text-white transition-all font-bold cursor-pointer`}
                title={sidebarCollapsed ? '로그아웃' : undefined}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>로그아웃</span>}
              </button>
              {!sidebarCollapsed && <p className="text-[11px] text-slate-500 px-3.5 font-mono">v2.6.0</p>}
            </div>
          </aside>

          {/* ── Main Content Area ── */}
          <main className={`flex-1 ${
            (activeTab as string) === 'proposal-workspace' 
              ? 'h-[calc(100vh-4rem)] overflow-hidden p-0' 
              : activeTab === 'chat'
              // 패널 사이 여백이 보이도록 slate-100 바탕. 모바일은 하단 탭바(fixed)만큼 아래 여백 (이전: 작성창이 탭바에 가림)
              ? 'h-[calc(100dvh-4rem)] overflow-hidden bg-slate-100 p-3 pb-[calc(0.75rem+var(--mobile-gnb-height))] lg:p-5'
              : 'overflow-y-auto bg-[#F8FAFC] px-4 lg:px-8 py-6 pb-20 lg:pb-8'
          } ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'} transition-all duration-200 admin-scale`}>

          {/* ── Mobile Bottom Tab Bar (기획서 1-4: 홈·상담·사건·일정·메뉴 5대 탭) ── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
            <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <BarChart2 className="w-5 h-5" /><span className="text-[11px] font-bold">홈</span>
            </button>
            <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'chat' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <MessageSquare className="w-5 h-5" /><span className="text-[11px] font-bold">상담</span>
            </button>
            <button onClick={() => setActiveTab('client-crm')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'client-crm' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Users className="w-5 h-5" /><span className="text-[11px] font-bold">사건</span>
            </button>
            <button onClick={() => setActiveTab('tasks-schedule')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'tasks-schedule' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <CalendarCheck className="w-5 h-5" /><span className="text-[11px] font-bold">일정</span>
            </button>
            <button
              onClick={() => setIsMobileMoreOpen(prev => !prev)}
              aria-expanded={isMobileMoreOpen}
              aria-haspopup="menu"
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${!['dashboard','chat','client-crm','tasks-schedule'].includes(activeTab) ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}
            >
              <Menu className="w-5 h-5" /><span className="text-[11px] font-bold">메뉴</span>
            </button>
          </div>

          {/* ── 모바일 '더보기' 메뉴 시트 (사이드바와 동일한 권한 기준) ── */}
          {isMobileMoreOpen && (
            <div className="lg:hidden fixed inset-0 z-[45]" onClick={() => setIsMobileMoreOpen(false)}>
              <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" />
              <div
                role="menu"
                aria-label="전체 메뉴"
                className="absolute bottom-16 left-2 right-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 grid grid-cols-3 gap-1.5"
                onClick={e => e.stopPropagation()}
              >
                {MOBILE_MORE_TABS.filter(t => !t.perm || permissionCtx.canAccessTab(t.perm as any)).map(t => (
                  <button
                    key={t.id}
                    role="menuitem"
                    onClick={() => { setActiveTab(t.id as any); setIsMobileMoreOpen(false); }}
                    className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${activeTab === t.id ? 'bg-brand text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* TAB 1: LAWYER DASHBOARD (Task 3-6 개편된 오늘의 업무 대시보드) */}
        {activeTab === 'dashboard' && (
          <LawyerDashboardView
            activeLawyer={activeLawyer}
            activeStaff={activeStaffMember}
            isLawyerOrOwner={isLawyerOrOwner}
            requests={requests}
            pendingProposals={pendingProposals}
            staffMembers={staffMembers}
            onNavigateTab={(tabId) => setActiveTab(tabId as any)}
            onOpenProposalReview={(p) => {
              const req = requests.find(r => r.id === p.reqId);
              if (req) {
                const rehabInput = mapToRehabUserInput(req);
                const rehabResult = calculateRepayment(rehabInput);
                setProposalRehabResult(rehabResult);
                setProposalRehabInput(rehabInput);
                setProposalConsultRequest(req);
                setReviewModalProposal(p);
              }
            }}
            onOpenCase={(caseId, options) => {
              setCrmTargetClientId(caseId);
              if (options?.section) {
                setCrmTargetDetailTab(options.section as any);
              }
              setActiveTab('client-crm');
            }}
            onOpenChat={(client) => {
              setActiveChatReqId(client.id);
              setActiveTab('chat');
            }}
            onNewCase={() => setIsExternalClientModalOpen(true)}
          />
        )}

        {/* TAB 3: 상담 채팅 — 메시지함 / 대화 / 가계 진단 분석서 (src/components/lawyer/chat) */}
        {activeTab === 'chat' && (
          <LawyerChatWorkspace
            requests={requests}
            messages={messages}
            activeLawyer={activeLawyer}
            currentStaff={activeStaffMember}
            activeChatReqId={activeChatReqId}
            onSelectThread={setActiveChatReqId}
            onSendMessage={handleSendChat}
            onRetryMessage={async (messageId) => {
              // 다시 보내기도 전송과 같은 승인 확인을 거친다
              if (activeLawyer?.approved === false) {
                toast.warning('현재 자격 심사 대기(체험 모드) 상태입니다. 관리자 정식 승인 완료 후 메시지를 보낼 수 있습니다.');
                return false;
              }
              if (!onRetryMessage) return false;
              const ok = await onRetryMessage(messageId);
              if (!ok) toast.error('다시 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
              return ok;
            }}
            onConvertToCase={(req) => {
              // 기획서 2-7: 수임 진행 -> 사건 워크스페이스 2단계(수임 계약)로 직행
              openCase(req.id, 'contracts');
            }}
            // 사건(Case)의 clientId에는 상담 요청 ID가 저장된다 — 이미 수임된 요청이면 '정식 수임 전환' 대신 '사건 열기'
            hasCaseForRequest={(reqId) => !!reqId && (cases.some(c => c.clientId === reqId) || requests.some(r => r.id === reqId && (r.status === 'contracted' || r.status === 'document' || r.status === 'filed')))}
            onOpenCrm={(reqId, detailTab) => {
              if (reqId) {
                openCase(reqId, detailTab || 'info');
              } else {
                openCase();
              }
            }}
            getDisplayClientName={getDisplayClientName}
            getDisplayPhoneNumber={getDisplayPhoneNumber}
          />
        )}




        {/* TAB 5: BILLING & SUBSCRIPTIONS */}
        {activeTab === 'billing' && (
          <div className="space-y-8">
            {/* 서브탭 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {([
                { key: 'status' as const, label: '광고 현황' },
                { key: 'products' as const, label: '광고 상품' },
                { key: 'orders' as const, label: '내 광고 주문' },
                { key: 'business' as const, label: '사업자 · 세금계산서' },
              ]).map(t => (
                <button key={t.key} onClick={() => setBillingSub(t.key)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${billingSub === t.key ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {(billingSub === 'status') && (<>
            {/* Section 1: Status */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 p-6 md:p-8 shadow-xl">
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-white">광고 · 빌링 현황</h2>
                    {/* 이전: 가짜 '다음 결제 예정일: 2026년 07월 25일 (월 800,000 원)'과 'Active · 정상 운영 중' 배지 */}
                    <p className="text-sm text-slate-400">마이김변 이용료는 정액 광고비뿐입니다. 수임료는 의뢰인이 사무소에 직접 납부합니다.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center min-w-[120px]">
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-bold">활성 광고</span>
                      <strong className="text-2xl font-black text-white block mt-1 tracking-tight tabular-nums">{adOrders.filter(o => o.status === 'active').length}건</strong>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center min-w-[120px]">
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-bold">이달 광고비</span>
                      <strong className="text-2xl font-black text-white block mt-1 tracking-tight tabular-nums">{(adOrders.filter(o => o.status === 'active').reduce((s, o) => s + o.monthlyPrice, 0) / 10000).toFixed(0)}만</strong>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center min-w-[120px]">
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-bold">입금 대기</span>
                      <strong className="text-2xl font-black text-white block mt-1 tracking-tight tabular-nums">{adOrders.filter(o => o.status === 'pending').length}건</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            </>)}

            {(billingSub === 'products') && (<>
            {/* Section 2: Ad Products */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-6 h-6 text-slate-700" />
                <h3 className="font-extrabold text-xl text-slate-900">광고 상품</h3>
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full">노출 광고 전용</span>
              </div>
              <p className="text-sm text-slate-500 -mt-2">마이김변 플랫폼에서 변호사 프로필 노출을 강화하는 광고 상품입니다.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {adProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md transition-all duration-300 group shadow-xs flex flex-col justify-between">
                    {/* Dark Deep Navy Header Box */}
                    <div className="bg-[#1E3A5F] p-6 text-white relative overflow-hidden">
                      <div className="relative z-10 flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{product.icon}</span>
                            <span className="font-extrabold text-lg text-white">{product.name}</span>
                          </div>
                          <p className="text-slate-300 text-xs mt-0.5">{product.location}</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/20">{product.badge}</span>
                      </div>
                      <div className="relative z-10 mt-5 flex items-end justify-between">
                        <div>
                          <span className="text-3xl font-black text-white tracking-tight tabular-nums">{product.priceLabel}</span>
                          <span className="text-slate-300 text-xs ml-1">(VAT 별도)</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-300 block font-bold">{product.maxSlots ? '구좌 현황' : '구좌 제한'}</span>
                          <span className="text-sm font-black text-white">{product.maxSlots ? `${product.usedSlots}/${product.maxSlots}` : '무제한'}</span>
                        </div>
                      </div>
                      {product.maxSlots && (
                        <div className="relative z-10 mt-2.5">
                          <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${((product.usedSlots || 0) / product.maxSlots) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-300 mt-1 block font-medium">{product.maxSlots - (product.usedSlots || 0)}구좌 남음</span>
                        </div>
                      )}
                    </div>
                    {/* Body */}
                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <p className="text-sm text-slate-700 leading-relaxed">{product.description}</p>
                        <ul className="space-y-2">
                          {product.features.map((feat, i) => (
                            <li key={i} className="flex gap-2 items-start text-sm text-slate-700">
                              <Check className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" />
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                        {product.discounts.length > 0 && (
                          <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200/80">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-slate-500" /> 장기 계약 할인</span>
                            <div className="flex flex-wrap gap-2">
                              {product.discounts.map((d, i) => (
                                <span key={i} className="bg-white border border-slate-200 text-xs text-slate-700 px-3 py-1.5 rounded-lg shadow-xs font-medium">
                                  {d.months}개월 <strong className="text-[#1E3A5F] font-bold">{d.rate}%↓</strong> {d.price}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-600 leading-relaxed">본 상품은 고객에게 <strong className="text-slate-900">"광고"</strong> 라벨이 명확히 표시되며, 같은 등급 내 <strong className="text-slate-900">랜덤 셔플 정렬</strong>로 운영됩니다.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setAdModalProduct(product); setAdModalMonths(1); setAdModalDepositor(''); setAdModalRegion(''); setAdModalStep('select'); }}
                        className="w-full py-3.5 rounded-xl text-sm font-bold transition-all bg-[#1E3A5F] hover:bg-[#163152] text-white shadow-xs cursor-pointer active:scale-[0.98] mt-4"
                      >
                        광고 신청하기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-slate-700" />
                <h4 className="font-extrabold text-base text-slate-900">변호사 찾기 페이지 광고 노출 구조</h4>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2.5 overflow-x-auto">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <span className="text-slate-900 font-bold flex items-center gap-1.5 mb-1.5">🔝 상단 노출 광고 (월 30만원)</span>
                  <div className="flex gap-2.5 flex-wrap">
                    <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">[ 광고 ] 변호사A</span>
                    <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">[ 광고 ] 변호사B</span>
                    <span className="bg-slate-50 border border-dashed border-slate-300 px-3 py-1.5 rounded-lg text-xs text-slate-400 font-medium">... 최대 6구좌</span>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <span className="text-slate-900 font-bold flex items-center gap-1.5 mb-1.5">📍 지역 상단 노출 (월 20만원)</span>
                  <div className="flex gap-2.5 flex-wrap">
                    <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">[ 광고 ] 지역 변호사D</span>
                    <span className="bg-slate-50 border border-dashed border-slate-300 px-3 py-1.5 rounded-lg text-xs text-slate-400 font-medium">... 지역당 최대 4구좌</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium"><Info className="w-3.5 h-3.5" /> 정렬 순서: 상단 노출 → 지역 상단(필터 시) → 일반 회원 | 같은 등급 내 랜덤 셔플</p>
            </div>
            </>)}

            {(billingSub === 'orders') && (<>
            {/* Section 3: My Ad Orders */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-slate-700" />
                <h3 className="font-extrabold text-xl text-slate-900">내 광고 신청 내역</h3>
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full">{adOrders.length}건</span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="p-3.5">신청일</th>
                        <th className="p-3.5">상품명</th>
                        <th className="p-3.5">계약기간</th>
                        <th className="p-3.5">월 결제액</th>
                        <th className="p-3.5">총 금액</th>
                        <th className="p-3.5">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adOrders.length === 0 ? (
                        <tr><td colSpan={6} className="p-10 text-center text-slate-400 text-sm font-medium">신청한 광고 상품이 없습니다.</td></tr>
                      ) : adOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3.5 text-slate-600 font-mono text-xs">{new Date(order.requestedAt).toLocaleDateString('ko-KR')}</td>
                          <td className="p-3.5 font-bold text-slate-900">{order.productName}{order.region && <span className="text-slate-600 ml-1">({order.region})</span>}</td>
                          <td className="p-3.5 text-slate-700 font-medium">{order.contractMonths}개월</td>
                          <td className="p-3.5 font-bold text-slate-800 tracking-tight tabular-nums">{order.monthlyPrice.toLocaleString()}원</td>
                          <td className="p-3.5 font-black text-slate-900 tracking-tight tabular-nums">{order.totalPrice.toLocaleString()}원</td>
                          <td className="p-3.5"><span className={`text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${order.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : order.status === 'cancelled' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${order.status === 'pending' ? 'bg-amber-500' : order.status === 'active' ? 'bg-emerald-500' : order.status === 'cancelled' ? 'bg-rose-500' : 'bg-slate-400'}`}></span>{order.status === 'pending' ? '입금 대기' : order.status === 'active' ? '활성' : order.status === 'cancelled' ? '취소' : '만료'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            </>)}

            {/* (이전: 월 30/80/150만 원 'SaaS CRM 요금제' 카드 — 플랫폼은 정액 광고비만 받으므로 삭제. docs/feature_expansion_plan.md 0장) */}

            {(billingSub === 'business') && (<>
            {/* Section 6: Legal & Payment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 space-y-4 shadow-xs">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-2"><Shield className="w-5 h-5 text-slate-700" /> 법적 안전장치 (변호사법 준수)</span>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>모든 광고 영역에 <strong className="text-slate-900">"광고" 라벨</strong> 상시 표시</span></li>
                  <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>같은 등급 내 <strong className="text-slate-900">랜덤 셔플 정렬</strong> (광고비 순 정렬 금지)</span></li>
                  <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong className="text-slate-900">고객 직접 선택</strong> 구조만 운영 (매칭·배정 없음)</span></li>
                  <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>상담 건당 과금 · 수임 성공 수수료 <strong className="text-rose-600">절대 없음</strong></span></li>
                  <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>고객 연락처 열람권 판매 <strong className="text-rose-600">절대 없음</strong></span></li>
                </ul>
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2"><Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" /><span className="text-xs text-slate-600 leading-relaxed">법무부 「변호사검색서비스 운영 가이드라인」(2025.05.27) 및 변호사법 제109조 준수</span></div>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 space-y-4 shadow-xs">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-2"><CreditCard className="w-5 h-5 text-slate-700" /> 결제 및 환불 정책</span>
                <div className="space-y-3.5 text-sm text-slate-700">
                  <div>
                    <span className="font-bold text-slate-900 block mb-1.5">결제 수단</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">🏦 계좌이체 (현금 입금)</span>
                      <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">📄 세금계산서 발행</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <span className="font-bold text-slate-800 text-xs block">💰 입금 안내 계좌</span>
                    <div className="bg-white rounded-xl p-3 border border-slate-200">
                      <span className="text-base font-black text-slate-900 block tracking-tight">{BANK_ACCOUNT_INFO.bank} {BANK_ACCOUNT_INFO.accountNumber}</span>
                      <span className="text-xs text-slate-500 font-medium">예금주: {BANK_ACCOUNT_INFO.holder}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block mb-1.5">결제 프로세스</span>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">① 상품 선택</span><span className="text-slate-300">→</span>
                      <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">② 기간 선택</span><span className="text-slate-300">→</span>
                      <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">③ 계좌 입금</span><span className="text-slate-300">→</span>
                      <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">④ 입금 확인</span><span className="text-slate-300">→</span>
                      <span className="bg-[#1E3A5F] text-white px-2.5 py-1 rounded-lg font-bold">⑤ 광고 활성화</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block mb-1.5">환불 정책</span>
                    <ul className="space-y-1 text-xs text-slate-500">
                      <li>• 결제 후 7일 이내 + 노출 100회 미만: <strong className="text-slate-900 font-bold">전액 환불</strong></li>
                      <li>• 결제 후 7일 이후: 잔여 일수 일할 계산 환불</li>
                      <li>• 광고 소재 심사 반려: <strong className="text-slate-900 font-bold">전액 환불</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* AD ORDER MODAL */}
            {adModalProduct && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAdModalProduct(null)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 mt-10" onClick={e => e.stopPropagation()}>
                  {adModalStep === 'select' && (
                    <>
                      <div className="bg-gradient-to-br from-[#0F2440] via-[#163152] to-[#1E3A5F] p-6 text-white">
                        <div className="flex items-center gap-2.5 mb-1"><span className="text-3xl">{adModalProduct.icon}</span><span className="font-extrabold text-xl">{adModalProduct.name}</span></div>
                        <p className="text-slate-300 text-xs">{adModalProduct.location}</p>
                      </div>
                      <div className="p-6 md:p-8 space-y-5">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-800">계약 기간 선택</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[1, 3, 6, 12].map(m => {
                              const disc = adModalProduct.discounts.find((d: any) => d.months === m);
                              const price = disc ? parseInt(disc.price.replace(/[^0-9]/g, '')) * 10000 : adModalProduct.price;
                              return (
                                <button key={m} onClick={() => setAdModalMonths(m)} className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${adModalMonths === m ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 ring-2 ring-[#1E3A5F]/20' : 'border-slate-200 hover:border-slate-300'}`}>
                                  <span className="text-sm font-black text-slate-800 block">{m}개월</span>
                                  {disc && <span className="text-xs text-[#1E3A5F] font-bold">{disc.rate}% 할인</span>}
                                  <span className="text-xs text-slate-500 block mt-0.5">{(price / 10000).toFixed(0)}만/월</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {adModalProduct.id === 'ad-regional-top' && (
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800">구매 지역 선택</label>
                            <select value={adModalRegion} onChange={e => setAdModalRegion(e.target.value)} className="w-full p-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 focus:border-[#1E3A5F] outline-none">
                              <option value="">지역을 선택해주세요</option>
                              {['서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (<option key={r} value={r}>{r}</option>))}
                            </select>
                          </div>
                        )}
                        {(() => {
                          const disc = adModalProduct.discounts.find((d: any) => d.months === adModalMonths);
                          const mp = disc ? parseInt(disc.price.replace(/[^0-9]/g, '')) * 10000 : adModalProduct.price;
                          const tp = mp * adModalMonths;
                          return (
                            <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-200 space-y-2.5">
                              <div className="flex justify-between text-sm"><span className="text-slate-600 font-medium">월 결제액</span><span className="font-bold text-slate-900">{mp.toLocaleString()}원</span></div>
                              <div className="flex justify-between text-sm"><span className="text-slate-600 font-medium">계약 기간</span><span className="font-bold text-slate-900">{adModalMonths}개월</span></div>
                              <div className="border-t border-slate-200 pt-2.5 flex justify-between"><span className="font-bold text-slate-800">총 결제 금액</span><span className="text-xl font-black text-slate-900">{tp.toLocaleString()}원</span></div>
                            </div>
                          );
                        })()}
                        <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-200 space-y-2">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">🏦 입금 안내 계좌</span>
                          <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-center">
                            <span className="text-xl font-black text-slate-900 block">{BANK_ACCOUNT_INFO.bank} {BANK_ACCOUNT_INFO.accountNumber}</span>
                            <span className="text-xs text-slate-500 font-medium">예금주: {BANK_ACCOUNT_INFO.holder}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-800">입금자명</label>
                          <input type="text" value={adModalDepositor} onChange={e => setAdModalDepositor(e.target.value)} placeholder="입금자명을 입력해주세요" className="w-full p-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => setAdModalProduct(null)} className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">취소</button>
                          <button onClick={() => {
                            if (!adModalDepositor.trim()) return;
                            if (adModalProduct.id === 'ad-regional-top' && !adModalRegion) return;
                            const disc = adModalProduct.discounts.find((d: any) => d.months === adModalMonths);
                            const mp = disc ? parseInt(disc.price.replace(/[^0-9]/g, '')) * 10000 : adModalProduct.price;
                            const newOrder: AdOrder = {
                              id: `ado-${Date.now()}`,
                              lawyerId: activeLawyer.id,
                              lawyerName: activeLawyer.name,
                              productId: adModalProduct.id,
                              productName: adModalProduct.name,
                              contractMonths: adModalMonths,
                              monthlyPrice: mp,
                              totalPrice: mp * adModalMonths,
                              status: 'pending',
                              requestedAt: new Date().toISOString(),
                              depositorName: adModalDepositor.trim(),
                              region: adModalRegion || undefined,
                              buyerCorpNum: (activeLawyer as any).businessNumber || (activeLawyer as any).bizNumber || undefined,
                              buyerCorpName: (activeLawyer as any).firmName || (activeLawyer as any).officeName || `${activeLawyer.name} 법률사무소`,
                              buyerCEOName: activeLawyer.name,
                              buyerEmail: activeLawyer.email,
                            };
                            // 스토리지 저장 및 브라우저/탭 간 실시간 전파
                            saveNewAdOrder(newOrder);
                            setAdOrders(loadAdOrders());
                            // 관리자 실시간 알림 (텔레그램 / 슬랙 / 브라우저 푸시)
                            notifyAdminNewAdOrder(newOrder);
                            setAdModalStep('done');
                          }} disabled={!adModalDepositor.trim() || (adModalProduct.id === 'ad-regional-top' && !adModalRegion)} className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer bg-[#1E3A5F] hover:bg-[#163152] text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed">신청 완료</button>
                        </div>
                      </div>
                    </>
                  )}
                  {adModalStep === 'done' && (
                    <div className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
                      <h3 className="text-2xl font-black text-slate-900">광고 신청 완료!</h3>
                      <p className="text-sm text-slate-600">아래 계좌로 입금해주시면 <strong className="text-slate-800">1영업일 이내</strong>에 입금 확인 후 광고가 활성화됩니다.</p>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                        <span className="text-xl font-black text-slate-900 block">{BANK_ACCOUNT_INFO.bank} {BANK_ACCOUNT_INFO.accountNumber}</span>
                        <span className="text-xs text-slate-500 font-medium">예금주: {BANK_ACCOUNT_INFO.holder}</span>
                      </div>
                      <button onClick={() => setAdModalProduct(null)} className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer">확인</button>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* ========== 세금계산서 섹션 ========== */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">전자세금계산서</h3>
                    <p className="text-sm text-slate-500">광고비 입금 시 자동 발행 · 국세청 자동 전송</p>
                  </div>
                </div>
                {bizInfo && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />사업자 등록 완료
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 md:p-8">
              {/* 사업자 정보 미등록 시 등록 안내 */}
              {!bizInfo && !bizFormOpen && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 mb-1">사업자 정보를 등록해주세요</h4>
                  <p className="text-sm text-slate-500 mb-5">세금계산서 자동 발행을 위해 법률사무소 사업자 정보가 필요합니다.</p>
                  <button onClick={() => setBizFormOpen(true)} className="bg-[#1E3A5F] hover:bg-[#163152] text-white text-sm font-bold px-7 py-3 rounded-xl transition-all shadow-xs cursor-pointer">
                    🏢 사업자 정보 등록
                  </button>
                </div>
              )}

              {/* 사업자 정보 등록 폼 */}
              {bizFormOpen && (
                <div className="space-y-5">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2"><Receipt className="w-5 h-5 text-slate-700" />사업자 정보 등록</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">사업자등록번호 *</label>
                      <div className="flex gap-2">
                        <input type="text" value={bizForm.corpNum} onChange={e => setBizForm(p => ({...p, corpNum: e.target.value}))} placeholder="000-00-00000" maxLength={12} className="flex-1 p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                        <button onClick={async () => { setBizCheckResult('확인 중...'); const r = await checkCorpNum(bizForm.corpNum); const st = (r.data as any)?.state; setBizCheckResult(!r.ok ? `❌ ${r.error || '확인 실패'}` : st === '1' || st === 1 ? '✅ 사업 중 (팝빌 휴폐업 조회)' : st === '2' || st === 2 ? '⚠️ 폐업' : st === '3' || st === 3 ? '⚠️ 휴업' : `조회 결과 상태: ${st ?? '확인 불가'}`); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer">확인</button>
                      </div>
                      {bizCheckResult && <p className="text-xs mt-1.5 font-bold text-slate-500">{bizCheckResult}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">상호 (법률사무소명) *</label>
                      <input type="text" value={bizForm.corpName} onChange={e => setBizForm(p => ({...p, corpName: e.target.value}))} placeholder="법무법인 ○○" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">대표자명 *</label>
                      <input type="text" value={bizForm.ceoName} onChange={e => setBizForm(p => ({...p, ceoName: e.target.value}))} placeholder="홍길동" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">세금계산서 수신 이메일 *</label>
                      <input type="email" value={bizForm.taxEmail} onChange={e => setBizForm(p => ({...p, taxEmail: e.target.value}))} placeholder="tax@lawfirm.com" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">사무장 / 회계담당자 이메일 (선택)</label>
                      <input type="email" value={bizForm.taxEmail2 || ''} onChange={e => setBizForm(p => ({...p, taxEmail2: e.target.value}))} placeholder="accounting@lawfirm.com" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">사업장 주소</label>
                      <input type="text" value={bizForm.addr} onChange={e => setBizForm(p => ({...p, addr: e.target.value}))} placeholder="서울특별시 강남구..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#1E3A5F] outline-none placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-3">
                    <button onClick={() => { setBizFormOpen(false); setBizCheckResult(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors cursor-pointer">취소</button>
                    <button
                      disabled={!bizForm.corpNum || !bizForm.corpName || !bizForm.ceoName || !bizForm.taxEmail || bizSaving}
                      onClick={() => {
                        setBizSaving(true);
                        const info: LawyerBusinessInfo = { ...bizForm };
                        saveLawyerBusinessInfo(info);
                        setBizInfo(info);
                        setBizFormOpen(false);
                        setBizSaving(false);
                        setBizCheckResult(null);
                        toast.success('사업자 정보가 저장되었습니다.');
                      }}
                      className="flex-1 py-3 bg-[#1E3A5F] hover:bg-[#163152] text-white text-sm font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />사업자 정보 저장
                    </button>
                  </div>
                </div>
              )}

              {/* 사업자 정보 등록 완료 시 */}
              {bizInfo && !bizFormOpen && (
                <div className="space-y-5">
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700">등록된 사업자 정보</span>
                      <button onClick={() => { setBizForm({corpNum: bizInfo.corpNum, corpName: bizInfo.corpName, ceoName: bizInfo.ceoName, bizType: bizInfo.bizType, bizClass: bizInfo.bizClass, addr: bizInfo.addr, taxEmail: bizInfo.taxEmail, taxEmail2: bizInfo.taxEmail2 || ''}); setBizFormOpen(true); }} className="text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer">수정</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500">사업자번호</span> <span className="font-bold text-slate-900 ml-1.5">{formatCorpNum(bizInfo.corpNum)}</span></div>
                      <div><span className="text-slate-500">상호</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.corpName}</span></div>
                      <div><span className="text-slate-500">대표자</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.ceoName}</span></div>
                      <div><span className="text-slate-500">계산서 이메일</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.taxEmail}</span></div>
                      {bizInfo.taxEmail2 && (
                        <div className="col-span-2"><span className="text-slate-500">사무장/회계 이메일</span> <span className="font-bold text-indigo-700 ml-1.5">{bizInfo.taxEmail2}</span></div>
                      )}
                    </div>
                  </div>

                  {/* 세금계산서 발행 이력 */}
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-3.5 flex items-center gap-2"><FileText className="w-5 h-5 text-slate-700" />발행 내역</h4>
                    {adOrders.filter(o => o.taxInvoice).length === 0 ? (
                      <div className="text-center py-8 text-sm text-slate-400 font-medium">
                        아직 발행된 세금계산서가 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {adOrders.filter(o => o.taxInvoice).map(order => (
                          <div key={order.id} className="space-y-2">
                            {/* 당초 정발행 건 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-900">{order.productName}</p>
                                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">정발행</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">
                                  {order.taxInvoice?.issuedAt ? new Date(order.taxInvoice.issuedAt).toLocaleDateString('ko-KR') : ''}
                                  {order.taxInvoice?.ntsConfirmNum && <span className="ml-2 font-mono text-[11px] text-slate-400">승인번호: {order.taxInvoice.ntsConfirmNum}</span>}
                                </p>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-3">
                                <p className="text-sm font-black text-slate-900 tracking-tight tabular-nums">{order.taxInvoice?.totalAmount.toLocaleString()}원</p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={async () => {
                                      if (!order.taxInvoice?.itemKey) return;
                                      setLawyerPdfLoadingKey(order.id);
                                      const res = await getTaxInvoicePdfUrl(order.taxInvoice.itemKey);
                                      if (res.ok && res.data?.url) {
                                        window.open(res.data.url, '_blank', 'width=900,height=800');
                                      } else {
                                        toast.error(res.error || 'PDF 뷰어 호출 실패');
                                      }
                                      setLawyerPdfLoadingKey(null);
                                    }}
                                    disabled={lawyerPdfLoadingKey === order.id}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  >
                                    <Printer className="w-3 h-3 text-slate-500" />
                                    {lawyerPdfLoadingKey === order.id ? '로딩...' : '계산서 PDF'}
                                  </button>
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 whitespace-nowrap">
                                    {order.modifiedTaxInvoice ? '수정발행됨' : '발행완료'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 수정발행(취소/환불) 내역이 있는 경우 차감 표시 */}
                            {order.modifiedTaxInvoice && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-red-50/70 rounded-xl border border-red-200/80 gap-3 ml-2 border-l-4 border-l-red-500">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                                      수정발행: {order.modifiedTaxInvoice.modifyCode === 2 ? '공급가액 변동' : '계약의 해제'}
                                    </span>
                                    <p className="text-xs text-red-600 font-medium">사유: {order.modifiedTaxInvoice.modifyReason}</p>
                                  </div>
                                  <p className="text-[11px] text-red-500 font-mono">
                                    {new Date(order.modifiedTaxInvoice.issuedAt).toLocaleDateString('ko-KR')} | 국세청 승인번호: {order.modifiedTaxInvoice.ntsConfirmNum || '승인완료'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-red-700 tracking-tight tabular-nums">{order.modifiedTaxInvoice.totalAmount.toLocaleString()}원</p>
                                  <span className="text-[11px] font-bold text-red-600">국세청 차감 반영</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
        </div>
        </div>
        </>)}
        </div>
        )}


        {/* TAB 5.5: SALES LEADS (영업 관리 — 리드 DB 및 콜 워크스페이스) */}
        {activeTab === 'sales-leads' && (
          <SalesLeadsTab
            activeLawyer={activeLawyer}
            staffMembers={staffMembers}
            lawyers={lawyers}
            requests={requests}
            setRequests={setRequests}
            onNavigateToCrm={(clientId) => openCase(clientId, 'info')}
          />
        )}

        {/* TAB 6: CLIENT CRM (고객 관리) — CrmTab 컴포넌트 */}
        {activeTab === 'client-crm' && (
          <CrmTab
            requests={requests}
            lawyers={lawyers}
            activeLawyer={activeLawyer}
            currentStaff={activeStaffMember}
            firmTenantId={firmTenantId}
            setRequests={setRequests}
            getDisplayPhoneNumber={getDisplayPhoneNumber}
            getDisplayClientName={getDisplayClientName}
            handleOpenProposalDraft={handleOpenProposalDraft}
            setActiveTab={(tab: any) => setActiveTab(tab)}
            setCopilotPreselectedReqId={setCopilotPreselectedReqId}
            initialClientId={crmTargetClientId}
            initialDetailTab={crmTargetDetailTab}
            onClearInitialTarget={() => {
              setCrmTargetClientId('');
              setCrmTargetDetailTab('info');
            }}
          />
        )}

        {/* TAB: PROPOSAL WORKSPACE (제안서 작성 워크스페이스) */}
        {(activeTab as string) === 'proposal-workspace' && proposalModalReqId && proposalRehabResult && proposalRehabInput && (
          <ProposalWorkspace
            rehabCalcResult={proposalRehabResult}
            rehabUserInput={proposalRehabInput}
            consultRequest={proposalConsultRequest}
            onClose={() => {
              setProposalModalReqId(null);
              setProposalRehabResult(null);
              setProposalRehabInput(null);
              setProposalConsultRequest(null);
              setActiveTab(previousTab as any);
            }}
            viewerRole={isLawyerOrOwner ? 'lawyer' : 'staff'}
            // 발송·컨펌 요청이 막히면 false — 워크스페이스가 작성 중인 초안을 지우지 않는다
            onSendProposal={(proposalData) => handleSubmitProposalFromDraft(proposalModalReqId, proposalData)}
            onRequestConfirm={(proposalData, memo) => handleRequestProposalConfirm(proposalModalReqId, proposalData, memo)}
            aiAnalysis={undefined}
            isAIPremiumEnabled={!!activeLawyer.aiCaseAnalysisEnabled}
            lawyerInfo={{
              name: activeLawyer.name,
              firmName: activeLawyer.firmName,
              avatar: activeLawyer.avatarData || activeLawyer.avatar
            }}
          />
        )}

        {/* TAB: CONSULT REQUESTS MANAGEMENT (상담 요청 새 화면 - 기획서 4.6 Phase 2-6) */}
        {activeTab === 'requests' && (
          <ConsultRequestManagementView
            requests={requests}
            setRequests={setRequests}
            activeLawyer={activeLawyer}
            activeStaff={activeStaffMember}
            onOpenCase={(clientId, stage, section) => {
              openCase(clientId, section as any);
            }}
            onOpenChat={(threadId) => openThread(threadId)}
          />
        )}

        {/* TAB: CASE REVIEW COPILOT (사건검토 코파일럿) */}
        {activeTab === 'case-copilot' && (
          activeLawyer.aiCaseAnalysisEnabled ? (
            <CaseReviewCopilot
              consultRequests={requests.filter(isRelevantRequest)}
              tenantId={firmTenantId}
              actorId={activeStaffMember?.id || activeLawyer.id}
              actorRole={activeStaffMember?.role || 'OWNER'}
              actorName={activeStaffMember?.name || activeLawyer.name}
              preselectedRequestId={copilotPreselectedReqId}
              onProposalSent={(reqId: string, proposalData: any) => handleSubmitProposalFromDraft(reqId, proposalData)}
            />
          ) : (
            <AICaseAnalysisLocked
              onContactAdmin={() => setActiveTab('inquiry-to-admin')}
            />
          )
        )}

        {/* TAB: STAFF MANAGEMENT */}
        {activeTab === 'staff-management' && !permissionCtx.canAccessTab('staff-management') && (
          <div role="alert" className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
            사용자 관리는 대표 변호사만 이용할 수 있습니다.
          </div>
        )}
        {/* 이전: 사이드바 버튼만 숨기고 탭 자체는 권한 없이 렌더링 */}
        {activeTab === 'staff-management' && permissionCtx.canAccessTab('staff-management') && (
          <StaffManagementTab
            requests={requests}
            lawyers={lawyers}
            activeLawyer={activeLawyer}
            setRequests={setRequests}
          />
        )}

        {/* TAB: 일정 / 할일 */}
        {activeTab === 'tasks-schedule' && (
          <div className="">
            <TasksScheduleTab
              tenantId={firmTenantId}
              userId={activeStaffMember?.id || activeLawyer.id}
              userName={activeStaffMember?.name || activeLawyer.name}
              userRole={activeStaffMember?.role || 'OWNER'}
              hasManageCalendar={!activeStaffMember || activeStaffMember.role === 'OWNER' || activeStaffMember.role === 'LAWYER' || permissionCtx.hasPermission('manageCalendar')}
              canAssignTasks={!activeStaffMember || activeStaffMember.role === 'OWNER' || activeStaffMember.role === 'LAWYER' || permissionCtx.hasPermission('canAssignTasks')}
              canManageAllTasks={!activeStaffMember || activeStaffMember.role === 'OWNER' || permissionCtx.hasPermission('canManageAllTasks')}
              canApproveTasks={!activeStaffMember || activeStaffMember.role === 'OWNER' || activeStaffMember.role === 'LAWYER' || permissionCtx.hasPermission('canApproveTasks')}
              requests={requests}
              cases={cases}
              qas={qas}
              activeLawyerId={activeLawyer.id}
              staffMembers={staffMembers}
              lawyers={lawyers}
            />
          </div>
        )}

        {/* TAB: 전자 계약 (총괄 관리 센터 & 경영 대시보드) */}
        {activeTab === 'contracts' && (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full" /></div>}>
            <ContractManagementTab 
              lawyerName={activeLawyer.name} 
              lawFirmName={activeLawyer.firmName || activeLawyer.firm || '법무법인'} 
              onNavigateToCrm={(clientId, detailTab) => openCase(clientId, detailTab || 'contracts')}
            />
          </React.Suspense>
        )}

        {/* TAB: 수임료 분납 종합 정산 관리 센터 */}
        {activeTab === 'fee-settlement' && (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full" /></div>}>
            <FeeSettlementTab
              requests={requests}
              activeLawyer={activeLawyer}
              onNavigateToClientCrm={(clientId, targetDetailTab) => openCase(clientId, targetDetailTab || 'fees')}
            />
          </React.Suspense>
        )}

        {/* TAB: 마이김변 문의 */}
        {activeTab === 'inquiry-to-admin' && lawyerInquiries && setLawyerInquiries && (
          <div className="">
            <LawyerInquiryTab
              lawyerInquiries={lawyerInquiries}
              setLawyerInquiries={setLawyerInquiries}
              currentLawyerId={activeLawyer.id}
              currentLawyerName={activeLawyer.name}
            />
          </div>
        )}

        {/* TAB 7: 알림 및 플랫폼 설정 */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* 1단: 5대 스마트 카테고리 탭 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {[
                { key: 'profile' as const, label: '👤 프로필 & 브랜딩', defaultSub: 'profile-edit' },
                { key: 'security' as const, label: '🛡️ 보안 & 기기 관리', defaultSub: 'devices' },
                { key: 'notifications' as const, label: '🔔 알림 & 보안 연동', defaultSub: 'channels' },
                { key: 'rules' as const, label: '⚖️ 법률 기준 & 데이터', defaultSub: 'calc-rules' },
                { key: 'notices' as const, label: '📢 플랫폼 공지', defaultSub: 'notices' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => {
                    setSettingsCategory(cat.key);
                    setSettingsSub(cat.defaultSub);
                  }}
                  className={`px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] ${
                    settingsCategory === cat.key
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 보안 & 기기 관리 뷰 */}
            {settingsCategory === 'security' && (
              <DeviceSessionManager
                userId={activeLawyer.id}
                userName={activeLawyer.name}
                userRole="LAWYER"
                userEmail={(activeLawyer as any).email || ''}
                firmName={activeLawyer.firmName || '법률사무소'}
              />
            )}

            {/* 2단: 카테고리별 서브 세그먼트 (서브탭이 2개 이상일 때 노출) */}
            {settingsCategory === 'profile' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'profile-edit', label: '✏️ 내 프로필 편집' },
                  { key: 'consult-style', label: '💬 AI 및 상담 스타일 프로필' },
                  { key: 'seals', label: '🏷️ 직인·도장 & 브랜딩 스튜디오' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSettingsSub(s.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      settingsSub === s.key
                        ? 'bg-brand/10 border border-brand/30 text-brand shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {settingsCategory === 'notifications' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'channels', label: '⚡ 실시간 알림 및 보안 연동' },
                  { key: 'logs', label: '📋 알림 발송 로그' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSettingsSub(s.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      settingsSub === s.key
                        ? 'bg-brand/10 border border-brand/30 text-brand shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {settingsCategory === 'rules' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'calc-rules', label: '📊 2026 회생/파산 산정 기준표' },
                  ...(isLawyerOrOwner && staffRole === 'OWNER' ? [{ key: 'data-backup', label: '🔒 데이터 백업' }] : []),
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSettingsSub(s.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      settingsSub === s.key
                        ? 'bg-brand/10 border border-brand/30 text-brand shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* 프로필 편집 뷰 */}
            {(settingsCategory === 'profile' || settingsSub === 'profile-edit') && (
              <div>
                <LawyerProfileEditor
                  lawyer={activeLawyer}
                  onImageChange={(newAvatar) => {
                    setActiveLawyer(prev => ({ ...prev, avatar: newAvatar, avatarData: newAvatar }));
                    setLawyers(prev => prev.map(l => l.id === activeLawyer.id ? { ...l, avatar: newAvatar, avatarData: newAvatar } : l));
                  }}
                  onSave={(updatedLawyer) => {
                    const finalLawyer = {
                      ...updatedLawyer,
                      avatar: updatedLawyer.avatarData || updatedLawyer.avatar,
                      avatarData: updatedLawyer.avatarData || updatedLawyer.avatar,
                    };
                    setLawyers(prev => prev.map(l => l.id === finalLawyer.id ? finalLawyer : l));
                    setActiveLawyer(finalLawyer);
                    // 저장 안내는 편집기 자체 토스트로 표시 (이전: 토스트 2개가 동시에 뜸)
                  }}
                  onClose={() => setSettingsSub('notices')}
                  inline={true}
                />
              </div>
            )}

            {/* AI 상담 스타일 프로필 */}
            {(settingsCategory === 'consult-style' || settingsSub === 'consult-style') && (
              <div>
                <ConsultStyleProfile
                  tenantId={firmTenantId}
                  actorId={activeLawyer.id}
                  actorName={activeLawyer.name}
                />
              </div>
            )}

            {/* 직인·도장 & 브랜딩 스튜디오 */}
            {(settingsCategory === 'branding' || settingsSub === 'seals') && (
              <div>
                <SealStudioModal
                  isInline={true}
                  lawyerId={activeLawyer.id}
                  lawyerName={activeLawyer.name}
                  firmName={activeLawyer.firmName || '법무법인'}
                  initialSealInfo={activeLawyer.sealInfo}
                  onSaveSealInfo={(newInfo) => {
                    setActiveLawyer(prev => ({ ...prev, sealInfo: newInfo }));
                  }}
                />
              </div>
            )}

            {/* 공지 사항 탭 */}
            {(settingsCategory === 'notices' || settingsSub === 'notices') && (() => {
              const filteredNotices = (notices || []).filter(n => {
                if (!noticeSearchTerm.trim()) return true;
                const q = noticeSearchTerm.toLowerCase();
                return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
              });
              const importantCount = (notices || []).filter(n => n.isImportant).length;

              return (
                <div className="space-y-6">
                  {/* Header info */}
                  <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1">
                      <h3 className="font-black text-xl text-slate-900 flex items-center gap-2.5">
                        <Megaphone className="w-6 h-6 text-brand" />
                        <span>공지 사항</span>
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed text-left">
                        회생/파산 플랫폼의 주요 정책 변경, 시스템 업데이트 및 법률 실무 가이드라인을 확인하세요.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-brand/10 text-brand text-xs font-black px-3 py-1.5 rounded-full whitespace-nowrap shadow-xs">
                        전체 {notices?.length || 0}건
                      </span>
                      {importantCount > 0 && (
                        <span className="bg-red-50 border border-red-200 text-red-600 text-xs font-black px-3 py-1.5 rounded-full whitespace-nowrap shadow-xs">
                          중요 {importantCount}건
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
                    <div className="relative w-full sm:max-w-md">
                      <input
                        type="text"
                        placeholder="공지사항 제목 또는 내용 검색..."
                        value={noticeSearchTerm}
                        onChange={e => setNoticeSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:bg-white"
                      />
                    </div>
                    {noticeSearchTerm && (
                      <button
                        onClick={() => setNoticeSearchTerm('')}
                        className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                      >
                        검색 초기화
                      </button>
                    )}
                  </div>

                  {/* Notices List */}
                  <div className="space-y-3">
                    {filteredNotices.map((n) => {
                      const isExpanded = selectedNoticeId === n.id;
                      return (
                        <div
                          key={n.id}
                          className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                            n.isImportant 
                              ? 'border-red-200 bg-gradient-to-r from-red-50/20 to-white' 
                              : 'border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <button
                            onClick={() => setSelectedNoticeId(isExpanded ? null : n.id)}
                            className="w-full p-5 md:p-6 text-left flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {n.isImportant ? (
                                  <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1 shrink-0 shadow-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    중요 공지
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-0.5 rounded-lg shrink-0">
                                    일반 공지
                                  </span>
                                )}
                                <span className="text-xs text-slate-400 font-medium">{n.date}</span>
                                <span className="text-xs text-slate-300">·</span>
                                <span className="text-xs text-slate-400 font-medium">조회 {n.views || 0}</span>
                              </div>
                              <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                                {n.title}
                              </h4>
                            </div>
                            <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 shrink-0 mt-1">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 md:px-6 pb-6 pt-2 border-t border-slate-100">
                              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/60 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                                {n.content}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {filteredNotices.length === 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2 shadow-sm">
                        <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">해당하는 공지사항이 없습니다.</p>
                        <p className="text-xs text-slate-400">검색어를 변경하거나 다시 시도해 주세요.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {settingsSub === 'channels' && (<>
            {/* ── 단일 통합 헤더 ── */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand" />
                  <span>실시간 알림 및 보안 연동 센터</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed text-left">
                  상담 접수 실시간 수신 알림, 의뢰인 자동 알림톡 발송 및 계정 보안 설정을 관리합니다.
                </p>
              </div>
              <span className="bg-brand/10 border border-brand/20 text-brand text-[11px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center shadow-2xs">
                SaaS Enterprise 가동 중
              </span>
            </div>

            {/* ── [섹션 1] 소속 법인 명칭 & 계정 보안 (2열 슬림 그리드) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 소속 법률사무소 / 법인 설정 */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5 shadow-xs">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand" />
                    <span>소속 법률사무소 / 법인 명칭</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 text-left">
                    플랫폼 노출 및 어드민 헤더에 표시될 소속 명칭입니다.
                  </p>
                </div>
                <div className="flex gap-2 items-center pt-0.5">
                  <input
                    type="text"
                    value={tempFirmName}
                    onChange={e => setTempFirmName(e.target.value)}
                    placeholder="소속 명칭 입력 (예: 법무법인 한빛)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSaveFirmName}
                    className="bg-brand hover:bg-brand-hover text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shrink-0 flex items-center gap-1 shadow-xs cursor-pointer active:scale-[0.98]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>저장</span>
                  </button>
                </div>
              </div>

              {/* 보안 설정: 소셜 로그인 계정 */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-brand" />
                    <span>로그인 보안</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleSignOutAllDevices}
                    disabled={isSigningOutAll}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer bg-brand/10 text-brand border-brand/20 hover:bg-brand/20 disabled:opacity-50"
                  >
                    {isSigningOutAll ? '처리 중...' : '모든 기기에서 로그아웃'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 text-left leading-relaxed">
                  변호사 계정은 카카오·Google 소셜 로그인으로만 인증되며, 이 서비스는 비밀번호를 저장하지 않습니다.
                  {activeLawyer.email ? <> 연결된 계정: <strong className="text-slate-700">{activeLawyer.email}</strong></> : null}
                  <br />계정 보안(2단계 인증 등)은 각 소셜 계정 설정에서 관리해 주세요.
                </p>
              </div>
            </div>


            {/* ── [섹션 2] 상담 접수 실시간 수신 알림 (내부용 - 3열 균형 그리드) ── */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-xs">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-brand" />
                  <span>상담 접수 실시간 수신 채널 (변호사 / 스태프 내부 알림용)</span>
                </h3>
                <p className="text-xs text-slate-500">신규 고객의 법률 상담이 접수될 때 즉시 알림을 수신할 채널을 설정합니다.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Telegram 채널 카드 */}
                <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${tgConnected ? 'border-emerald-500/40 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">📱 Telegram 봇</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${tgConnected ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {tgConnected ? '🟢 연결됨' : '⚪ 미연결'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">변호사/직원 단체방에 실시간 봇 알림</p>
                  </div>
                  <div className="flex gap-1.5 pt-3">
                    <button onClick={() => setShowBotTokenGuide(!showBotTokenGuide)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {showBotTokenGuide ? '닫기' : '📖 가이드'}
                    </button>
                    <button onClick={async () => {
                      if (!tgBotToken || !tgChatId) { toast.error('Bot Token과 Chat ID를 입력하세요.'); return; }
                      setNotifTestLoading('telegram');
                      const res = await testTelegramConnection(tgBotToken, tgChatId);
                      setNotifTestLoading(null);
                      setNotifLogs(loadNotificationLogs());
                      if (res.ok) {
                        setTgConnected(true);
                        const updated = { ...notifSettings, telegram: { botToken: tgBotToken, chatId: tgChatId, connected: true } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        toast.success('텔레그램 테스트 메시지가 발송되었습니다!');
                      } else {
                        toast.error(`발송 실패: ${res.error}`);
                      }
                    }}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors cursor-pointer">
                      {notifTestLoading === 'telegram' ? '⏳...' : '🔔 테스트'}
                    </button>
                  </div>
                </div>

                {/* 2. 이메일 채널 카드 */}
                <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${notifSettings.email.enabled ? 'border-blue-500/40 bg-blue-50/20' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">📧 이메일 알림</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${notifSettings.email.enabled ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {notifSettings.email.enabled ? '🟢 설정됨' : '⚪ 미설정'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">로펌 Gmail 계정으로 자동 메일 발송</p>
                  </div>
                  <div className="flex gap-1.5 pt-3">
                    <button onClick={() => setShowEmailSetup(!showEmailSetup)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {showEmailSetup ? '닫기' : '⚙️ 설정'}
                    </button>
                    {notifSettings.email.enabled && (
                      <button onClick={async () => {
                        setNotifTestLoading('email');
                        const { subject, html } = formatEmailConsultHtml({ type: '테스트', region: '서울/경기', debt: '5천만~1억', income: '200만~300만', tags: ['#테스트알림'] });
                        const res = await sendEmailNotification(notifSettings.email.senderGmail, notifSettings.email.senderAppPassword, notifSettings.email.recipientEmails, subject, html);
                        setNotifTestLoading(null);
                        setNotifLogs(loadNotificationLogs());
                        if (res.ok) {
                          toast.success('테스트 이메일이 발송되었습니다!');
                        } else {
                          toast.error(`발송 실패: ${res.error}`);
                        }
                      }}
                        className="flex-1 py-1.5 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer">
                        {notifTestLoading === 'email' ? '⏳...' : '📧 테스트'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. 브라우저 Push 채널 카드 */}
                <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${notifSettings.browserPush.enabled ? 'border-amber-500/40 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">🔔 브라우저 알림</span>
                      {(() => {
                        // 저장된 설정이 아니라 브라우저의 실제 권한 상태로 표시 (사용자가 브라우저에서 권한을 끈 경우 반영)
                        const perm = getBrowserNotificationPermission();
                        const on = notifSettings.browserPush.enabled && perm === 'granted';
                        return (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${on ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                            {on ? '🟢 사용 중' : perm === 'denied' ? '⛔ 브라우저에서 차단됨' : '⚪ 미사용'}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">CRM 탭이 열려 있을 때 데스크톱 알림 표시 (창을 닫으면 수신되지 않음)</p>
                  </div>
                  <div className="pt-3">
                    <button onClick={async () => {
                      const perm = await requestBrowserPushPermission();
                      if (perm === 'granted') {
                        const updated = { ...notifSettings, browserPush: { enabled: true, permission: 'granted' } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        const shown = sendBrowserPushNotification('🔔 알림 테스트', '브라우저 알림이 활성화되었습니다.');
                        setNotifLogs(loadNotificationLogs());
                        if (!shown) toast.error('알림 표시에 실패했습니다. 브라우저·운영체제 알림 설정을 확인해 주세요.');
                      } else {
                        const updated = { ...notifSettings, browserPush: { enabled: false, permission: perm } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        toast.error('브라우저 알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
                      }
                    }}
                      className="w-full py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {notifSettings.browserPush.enabled && getBrowserNotificationPermission() === 'granted' ? '🔔 테스트 알림' : '🔔 권한 허용하기'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 봇 생성 가이드 (토글 아코디언) */}
              {showBotTokenGuide && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">📖 텔레그램 봇 생성 가이드</h4>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed font-medium">
                    <li>텔레그램 앱에서 <strong className="text-brand">@BotFather</strong> 검색 후 대화 시작</li>
                    <li><code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">/newbot</code> 입력하여 봇 생성</li>
                    <li>발급된 <strong className="text-rose-600">Bot Token</strong>을 아래에 입력</li>
                    <li>직원 그룹방에 생성한 봇을 <strong>관리자로 추가</strong> 후 Chat ID 확인</li>
                  </ol>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <input
                      type={showBotToken ? 'text' : 'password'}
                      value={tgBotToken}
                      onChange={e => setTgBotToken(e.target.value)}
                      placeholder="Bot Token (예: 7123456789:AAF...)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={tgChatId}
                        onChange={e => setTgChatId(e.target.value)}
                        placeholder="Chat ID (예: -1001234567890)"
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <button onClick={() => {
                        const updated = { ...notifSettings, telegram: { botToken: tgBotToken, chatId: tgChatId, connected: tgConnected } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        toast.success('텔레그램 설정이 저장되었습니다.');
                      }}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-brand text-white hover:bg-brand-hover cursor-pointer shrink-0">
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 이메일 설정 (토글 아코디언) */}
              {showEmailSetup && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">📧 Gmail 이메일 알림 설정</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="email" value={emailSender} onChange={e => setEmailSender(e.target.value)}
                      placeholder="발신 Gmail 주소"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    <input type="password" value={emailAppPassword} onChange={e => setEmailAppPassword(e.target.value)}
                      placeholder="Gmail 앱 비밀번호 (16자리)"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    <input type="text" value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)}
                      placeholder="수신 이메일 (쉼표 구분)"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button onClick={() => {
                      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(Boolean);
                      if (!emailSender || !emailAppPassword || recipients.length === 0) {
                        toast.error('발신 Gmail, 앱 비밀번호, 수신 이메일을 모두 입력해주세요.');
                        return;
                      }
                      const updated = { ...notifSettings, email: { senderGmail: emailSender, senderAppPassword: emailAppPassword, recipientEmails: recipients, enabled: true } };
                      setNotifSettings(updated);
                      saveNotificationSettings(updated);
                      toast.success('이메일 설정이 저장되었습니다.');
                    }}
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-brand text-white hover:bg-brand-hover cursor-pointer shadow-xs">
                      이메일 설정 저장
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── [섹션 3] 의뢰인 자동 발송 카카오 알림톡 (고객 안내용 - 와이드 스마트 패널) ── */}
            <div className={`p-4 rounded-2xl border transition-all shadow-xs ${notifSettings.kakao.enabled ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/20 via-white to-amber-50/10' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                    <span className="text-base">💬</span>
                    <span>의뢰인 자동 발송 카카오 알림톡 시스템</span>
                  </h3>
                  <p className="text-xs text-slate-500">사건 진행 단계(파이프라인) 변경 시 의뢰인에게 카카오톡 알림톡을 자동 발송합니다.</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs font-bold text-slate-600">{notifSettings.kakao.enabled ? '알림톡 활성화됨' : '알림톡 비활성'}</span>
                  <button onClick={() => {
                    const updated = { ...notifSettings, kakao: { ...notifSettings.kakao, enabled: !notifSettings.kakao.enabled, status: !notifSettings.kakao.enabled ? 'connected' as const : 'disconnected' as const } };
                    setNotifSettings(updated); saveNotificationSettings(updated);
                  }} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${notifSettings.kakao.enabled ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifSettings.kakao.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {notifSettings.kakao.enabled && (
                <div className="space-y-3.5 pt-3 animate-fadeIn">
                  {/* 발송자 정보 & CRM 트리거 (2열) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-4">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">발송 표시 법무법인명</label>
                      <input value={notifSettings.kakao.firmName || ''} onChange={e => {
                        const updated = { ...notifSettings, kakao: { ...notifSettings.kakao, firmName: e.target.value } };
                        setNotifSettings(updated); saveNotificationSettings(updated);
                      }} placeholder="예: 법무법인 한빛" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">담당 변호사명</label>
                      <input value={notifSettings.kakao.lawyerName || ''} onChange={e => {
                        const updated = { ...notifSettings, kakao: { ...notifSettings.kakao, lawyerName: e.target.value } };
                        setNotifSettings(updated); saveNotificationSettings(updated);
                      }} placeholder="예: 김우진 변호사" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                    </div>
                    <div className="md:col-span-4 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">CRM 상태 변경 시 자동 전송</p>
                        <p className="text-[10px] text-slate-400">파이프라인 이동 시 즉시 발송</p>
                      </div>
                      <button onClick={() => {
                        const updated = { ...notifSettings, kakao: { ...notifSettings.kakao, autoTrigger: !notifSettings.kakao.autoTrigger } };
                        setNotifSettings(updated); saveNotificationSettings(updated);
                      }} className={`relative w-9 h-4.5 rounded-full transition-colors cursor-pointer ${notifSettings.kakao.autoTrigger ? 'bg-amber-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${notifSettings.kakao.autoTrigger ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* 활성화할 마일스톤 단계 (3열 2행) */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-extrabold text-slate-700">📌 자동 발송 활성화 마일스톤 단계 선택</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {(Object.entries(ALIMTOK_MILESTONE_CONFIG) as [AlimtokMilestone, { label: string; emoji: string }][]).map(([key, cfg]) => {
                        const isEnabled = (notifSettings.kakao.enabledMilestones || []).includes(key);
                        return (
                          <button key={key} onClick={() => {
                            const milestones = notifSettings.kakao.enabledMilestones || [];
                            const updated = { ...notifSettings, kakao: { ...notifSettings.kakao, enabledMilestones: isEnabled ? milestones.filter((m: AlimtokMilestone) => m !== key) : [...milestones, key] as AlimtokMilestone[] } };
                            setNotifSettings(updated); saveNotificationSettings(updated);
                          }} className={`text-center py-2 px-2 rounded-xl border text-xs transition-all cursor-pointer active:scale-[0.98] ${isEnabled ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold shadow-2xs' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                            <span className="mr-1">{cfg.emoji}</span> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── [섹션 4] 외부 캘린더 연동 ── */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                  <span>📅</span>
                  <span>외부 캘린더 동기화</span>
                </h3>
                <span className="text-[11px] text-slate-400">사건 기일 및 상담 일정 자동 연동</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href="https://calendar.google.com/calendar/r" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📆</span>
                    <div><p className="text-xs font-bold text-slate-800">Google Calendar</p><p className="text-[10px] text-slate-400">구글 캘린더에서 기일/일정 확인</p></div>
                  </div>
                  <span className="text-xs text-brand font-bold">연결 →</span>
                </a>
                <a href="https://outlook.live.com/calendar" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📧</span>
                    <div><p className="text-xs font-bold text-slate-800">Outlook Calendar</p><p className="text-[10px] text-slate-400">아웃룩 캘린더와 일정 동기화</p></div>
                  </div>
                  <span className="text-xs text-brand font-bold">연결 →</span>
                </a>
              </div>
            </div>
            </>)}

            {settingsSub === 'logs' && (
            <>
            {/* 알림 발송 이력 */}
            {/* ══════════════════════════════════════════ */}
            {notifLogs.length > 0 && (
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg text-slate-900 flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-brand" />
                    <span>알림 발송 이력</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full">최근 {notifLogs.length}건</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-3.5">시간</th>
                        <th className="p-3.5 text-center">채널</th>
                        <th className="p-3.5 text-center">상태</th>
                        <th className="p-3.5">상세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {notifLogs.slice(0, 10).map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 text-slate-600 whitespace-nowrap font-mono text-xs">{new Date(log.sentAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="p-3.5 text-center text-base">
                            {log.channel === 'telegram' ? '📱' : log.channel === 'email' ? '📧' : log.channel === 'browser_push' ? '🔔' : '📲'}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              {log.status === 'sent' ? '✅ 발송' : '❌ 실패'}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 font-medium truncate max-w-[240px]">{log.errorMessage || log.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Config Panel */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* 🤖 1. Bot Integration */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">🤖 1단계: 텔레그램 알림봇 바인딩</span>
                    <span className={`px-2 py-0.5 rounded text-[12px] font-extrabold ${tgConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 text-slate-500'}`}>
                      {tgConnected ? '연결됨 (ACTIVE)' : '연결 해제됨'}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs text-left">
                    <p className="text-slate-600 leading-normal text-[13px]">
                      아래 텔레그램 봇 링크를 통해 다시시작 알림방에 봇을 추가한 뒤, 봇이 알려주는 그룹방 고유 Chat ID를 바인딩하세요.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a 
                        href="https://t.me/restart_alarm_bot" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-brand font-extrabold px-3 py-2 rounded-xl text-center flex items-center justify-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-brand" />
                        <span>Restart 알림봇 열기</span>
                      </a>
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          placeholder="Chat ID 입력 (예: 12948592948)"
                          value={tgChatId}
                          onChange={(e) => setTgChatId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pr-12 focus:ring-1 focus:ring-brand focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1.5">
                      <button 
                        type="button" 
                        onClick={handleTgTestNotification}
                        className="flex-1 bg-brand hover:bg-brand-hover text-white font-extrabold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>📢 보안 연동 테스트 알림 발송</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setTgConnected(!tgConnected)}
                        className={`px-4 py-2.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                          tgConnected 
                            ? 'bg-slate-100 border-slate-850 hover:bg-slate-850 text-red-400 hover:text-red-300' 
                            : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                        }`}
                      >
                        {tgConnected ? '연결 일시 해제' : '알림 활성화'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 📅 2. Receiving Hours */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">📅 2단계: 알림 요일 및 근무시간 설정</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={tgDutyMode} 
                        onChange={(e) => setTgDutyMode(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-100 border-slate-200 text-brand focus:ring-brand" 
                      />
                      <span className="text-[12px] font-bold text-amber-400">🚨 야간 당직방 우회 활성화</span>
                    </label>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[12px] text-slate-600 block uppercase font-bold">알림 수신 요일</label>
                      <div className="flex gap-1.5">
                        {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                          <label key={d} className="flex-1 bg-slate-100 border border-slate-200 rounded-lg py-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-slate-200 select-none">
                            <input 
                              type="checkbox" 
                              defaultChecked={d !== '토' && d !== '일'} 
                              className="w-3.5 h-3.5 rounded bg-slate-50 border-slate-200 text-brand"
                            />
                            <span className="text-[12px] font-bold text-slate-600">{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] text-slate-600 block uppercase font-bold">근무 시작 시각</label>
                        <input 
                          type="text" 
                          value={tgWorkHoursStart}
                          onChange={(e) => setTgWorkHoursStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] text-slate-600 block uppercase font-bold">근무 종료 시각</label>
                        <input 
                          type="text" 
                          value={tgWorkHoursEnd}
                          onChange={(e) => setTgWorkHoursEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ⏱️ 3. Escalation and Reminder */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">⏱️ 3단계: 미응답 리마인드 & 에스컬레이션</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[12px] text-slate-600 block uppercase font-bold">상담 배정 미수락 재알림 주기</label>
                      <select 
                        value={tgRemindDelay}
                        onChange={(e) => setTgRemindDelay(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 focus:outline-none"
                      >
                        <option value="5">5분 간격 리마인드</option>
                        <option value="10">10분 간격 리마인드</option>
                        <option value="20">20분 간격 리마인드</option>
                        <option value="30">30분 간격 리마인드</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] text-slate-600 block uppercase font-bold">최종 미응답 시 전체 에스컬레이션</label>
                      <select 
                        value={tgEscalation}
                        onChange={(e) => setTgEscalation(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 focus:outline-none"
                      >
                        <option value="15">15분 미수락 시 전체 대표방 공지</option>
                        <option value="30">30분 미수락 시 전체 대표방 공지</option>
                        <option value="60">1시간 미수락 시 전체 대표방 공지</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Simulated Live Telegram Widget — Smartphone Frame */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-600 block text-left uppercase tracking-wider flex items-center gap-1.5 w-full mb-3">
                  <Smartphone className="w-4 h-4 text-brand" />
                  텔레그램 실시간 알림방 시뮬레이터
                </span>

                {/* ── Smartphone Outer Frame ── */}
                <div className="relative mx-auto w-full max-w-[360px]">
                  {/* Phone body */}
                  <div className="bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-2xl border-[3px] border-[#2a2a2a] relative"
                    style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset' }}>
                    
                    {/* Side buttons (volume + power) */}
                    <div className="absolute -left-[5px] top-[100px] w-[3px] h-[28px] bg-[#2a2a2a] rounded-l-sm"></div>
                    <div className="absolute -left-[5px] top-[140px] w-[3px] h-[50px] bg-[#2a2a2a] rounded-l-sm"></div>
                    <div className="absolute -left-[5px] top-[200px] w-[3px] h-[50px] bg-[#2a2a2a] rounded-l-sm"></div>
                    <div className="absolute -right-[5px] top-[160px] w-[3px] h-[70px] bg-[#2a2a2a] rounded-r-sm"></div>

                    {/* Inner screen area */}
                    <div className="bg-[#182533] rounded-[36px] overflow-hidden flex flex-col" style={{ height: '620px' }}>
                      
                      {/* Dynamic Island / Notch */}
                      <div className="flex justify-center pt-2 pb-0 bg-[#182533] relative z-20">
                        <div className="bg-black rounded-full w-[120px] h-[28px] flex items-center justify-center gap-2">
                          <div className="w-[8px] h-[8px] rounded-full bg-[#1a1a2e] border border-[#333] ring-1 ring-[#222]"></div>
                          <div className="w-[5px] h-[5px] rounded-full bg-[#0a3d2a]"></div>
                        </div>
                      </div>

                      {/* Status Bar */}
                      <div className="flex items-center justify-between px-6 py-1 text-[12px] text-white/60 font-semibold bg-[#182533]">
                        <span>10:27</span>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h20V2z"/><path d="M12 12H2v10h10z" opacity="0.3"/></svg>
                          <span>87%</span>
                        </div>
                      </div>

                      {/* Telegram Header */}
                      <div className="bg-[#22313F] px-4 py-2.5 flex items-center justify-between border-b border-[#141E28]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1 text-[#86959E]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-extrabold text-[13px] select-none">
                            다
                          </div>
                          <div className="text-left leading-tight">
                            <h4 className="font-extrabold text-[13px] text-white">다시시작 법률지부 알림방</h4>
                            <span className="text-[11px] text-[#86959E] font-medium">멤버 5명, 봇 1개 등록됨</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[#86959E]">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          <span className="text-xs font-bold cursor-pointer">•••</span>
                        </div>
                      </div>

                      {/* Telegram Message Area */}
                      <div className="flex-1 p-3 overflow-y-auto space-y-3 flex flex-col-reverse justify-start scrollbar-hide bg-[#182533]">
                        {tgMessages.slice().reverse().map((m) => {
                          if (m.sender === 'system') {
                            return (
                              <div key={m.id} className="w-full flex justify-center py-1 select-none">
                                <span className="bg-[#111A24]/60 text-[#86959E] text-[11px] font-bold px-3 py-1 rounded-full border border-[#1C2836]">
                                  {m.text}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div key={m.id} className="w-full flex items-start gap-2 text-left">
                              <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-extrabold text-[11px] shrink-0 select-none">
                                Bot
                              </div>
                              
                              <div className="space-y-1 max-w-[88%] text-left">
                                <div className="flex items-center gap-1.5 leading-none">
                                  <span className="font-extrabold text-[12px] text-[#5288C1]">{m.name || '다시시작 알림봇'}</span>
                                  <span className="bg-[#22313F] text-[#5288C1] text-[7px] px-1 py-px rounded font-extrabold uppercase">BOT</span>
                                </div>

                                {/* Alert Card Box */}
                                {m.card && (
                                  <div className="bg-[#22313F] border border-[#2B3E50] rounded-xl p-3 space-y-2.5 shadow-md text-left">
                                    <div className="flex items-center justify-between border-b border-[#2C3B4B] pb-1.5 leading-none">
                                      <span className="font-black text-[12px] text-white flex items-center gap-1">
                                        {m.card.type === 'direct' ? '🔔' : '📢'} {m.card.type === 'direct' ? '신규 직접선택 상담 요청' : '참여형 상담 오픈'}
                                      </span>
                                      <span className="text-[#86959E] text-[10px]">{m.time}</span>
                                    </div>

                                    <div className="space-y-1 text-[12px] leading-relaxed text-[#86959E]">
                                      <div>• <strong className="text-slate-500">수신 유형:</strong> {m.card.type === 'direct' ? '1:1 다이렉트 지정' : '선착순 오픈 배정'}</div>
                                      <div>• <strong className="text-slate-500">관할 지역:</strong> {m.card.region} 법원 관할</div>
                                      <div>• <strong className="text-slate-500">채무 구간:</strong> {m.card.debt}</div>
                                      <div>• <strong className="text-slate-500">소득 구간:</strong> {m.card.income}</div>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {m.card.tags.map(t => (
                                        <span key={t} className="bg-brand/15 text-brand text-[10px] px-1.5 py-0.5 rounded font-bold">{t}</span>
                                      ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-2 border-t border-[#2C3B4B] flex flex-col gap-1.5">
                                      {m.card.assignedLawyer ? (
                                        <div className="w-full py-2 bg-emerald-950/40 text-emerald-400 text-center rounded-lg border border-emerald-500/20 text-[11px] font-extrabold flex items-center justify-center gap-1 select-none">
                                          <Check className="w-3 h-3" />
                                          <span>{m.card.assignedLawyer} 수임 배정 완료</span>
                                        </div>
                                      ) : (
                                        <>
                                          <button 
                                            type="button"
                                            onClick={() => handleTgAssign(m.id, m.card!.reqId)}
                                            className="w-full py-2 bg-brand hover:bg-brand-hover text-white text-[11px] font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1 select-none cursor-pointer"
                                          >
                                            🙋 내가 즉시 담당자로 배정
                                          </button>
                                          <div className="grid grid-cols-2 gap-1">
                                            <button 
                                              type="button"
                                              onClick={() => {
                                                setActiveChatReqId(m.card!.reqId);
                                                setActiveTab('client-crm');
                                                toast.info('플랫폼의 고객관리 탭으로 이동하여 의뢰인 상세 명세를 조회합니다.');
                                              }}
                                              className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-[#86959E] text-[10px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                            >
                                              💻 CRM 상세보기
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => toast.info('30분 후 해당 채무자의 상담 응답 미결 상태를 텔레그램 그룹방에 다시 리마인드합니다.')}
                                              className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-[#86959E] text-[10px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                            >
                                              ⏰ 30분 후 리마인드
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>

                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Telegram Bottom Bar */}
                      <div className="bg-[#22313F] px-3 py-2.5 flex items-center gap-2 border-t border-[#141E28] select-none">
                        <div className="flex-1 bg-[#182533] border border-[#2D3E50] rounded-full px-3 py-1.5 text-[12px] text-[#86959E]">메시지 입력...</div>
                        <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-brand" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </div>
                      </div>

                      {/* Privacy notice */}
                      <div className="bg-[#182533] px-3 py-1.5 text-[10px] text-[#86959E]/60 text-center font-medium">
                        🔒 프라이버시 모드 · 봇은 명령어 액션만 수신
                      </div>

                      {/* Home Indicator Bar */}
                      <div className="flex justify-center py-2 bg-[#182533]">
                        <div className="w-[100px] h-[4px] bg-white/20 rounded-full"></div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>


            </div>

            </>)}

            {settingsSub === 'calc-rules' && (
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm">
                <RehabSettingsPanel mode="lawyer" />
              </div>
            )}

            {settingsSub === ('data-backup' as any) && (
              <DataBackupSection
                isOwner={staffRole === 'OWNER'}
                lawyerName={activeLawyer.name}
                lawyerId={activeLawyer.id}
                tenantId={firmTenantId}
              />
            )}

          </div>
        )}

        {/* TAB: Q&A ANSWER - 고민상담 Q&A 답변 */}
        {activeTab === 'qna-answer' && (
          <LawyerQnAAnswerSection
            qas={qas || []}
            setQas={setQas}
            currentLawyer={activeLawyer}
          />
        )}

      </main>
      </div>{/* close flex body */}

      {/* ── 고객 제안서 초안 모달 (레거시 — 워크스페이스 모드에서는 비활성) ── */}
      {/* 워크스페이스 탭이 아닌 경우에만 기존 모달 렌더링 (하위호환) */}
      {proposalModalReqId && proposalRehabResult && proposalRehabInput && (activeTab as string) !== 'proposal-workspace' && (
        <LawyerProposalDraft
          rehabCalcResult={proposalRehabResult}
          rehabUserInput={proposalRehabInput}
          consultRequest={proposalConsultRequest}
          onClose={() => {
            setProposalModalReqId(null);
            setProposalRehabResult(null);
            setProposalRehabInput(null);
            setProposalConsultRequest(null);
          }}
          mode="modal"
          viewerRole={isLawyerOrOwner ? 'lawyer' : 'staff'}
          onSendProposal={(proposalData) => handleSubmitProposalFromDraft(proposalModalReqId, proposalData)}
          onRequestConfirm={(proposalData, memo) => handleRequestProposalConfirm(proposalModalReqId, proposalData, memo)}
        />
      )}

      {/* 제안서 검토 모달 (변호사용) */}
      {reviewModalProposal && proposalRehabResult && proposalRehabInput && (
        <LawyerProposalDraft
          rehabCalcResult={proposalRehabResult}
          rehabUserInput={proposalRehabInput}
          consultRequest={proposalConsultRequest}
          onClose={() => {
            setReviewModalProposal(null);
            setProposalRehabResult(null);
            setProposalRehabInput(null);
            setProposalConsultRequest(null);
          }}
          mode="modal"
          viewerRole="reviewer"
          pendingStaffName={reviewModalProposal.staffName}
          onSendProposal={() => {}}
          onApproveProposal={(proposalData) => {
            handleApproveProposal(reviewModalProposal.id, proposalData);
          }}
          onRejectProposal={(reason) => {
            handleRejectProposal(reviewModalProposal.id, reason);
          }}
        />
      )}

      {/* Popup Container for Lawyer-targeted popups */}
      {popupConfig && (
        <PopupContainer
          config={popupConfig}
          landingId="legal-crm-lawyer"
          viewerRole="lawyer"
        />
      )}

      {/* ── 전역 검색 팔레트 (Cmd+K) ── */}
      <React.Suspense fallback={null}>
        {isSearchOpen && (
          <GlobalSearchPalette
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            requests={requests.filter(r => isOwnRequest(r) || (r.requestType === 'open' && r.status === 'requested'))}
            getDisplayName={getDisplayClientName}
            getDisplayPhone={getDisplayPhoneNumber}
            onNavigate={(tab, id) => {
              if (tab === 'client-crm' && id) setCrmTargetClientId(id);
              setActiveTab(tab as any);
              setIsSearchOpen(false);
            }}
          />
        )}
      </React.Suspense>

      {/* ── 신규 케이스 등록 모달 ── */}
      <React.Suspense fallback={null}>
        {isExternalClientModalOpen && (
          <NewCaseModal isOpen={isExternalClientModalOpen} onClose={() => setIsExternalClientModalOpen(false)} onRegister={handleExternalClientRegister} existingRequests={requests} />
        )}
      </React.Suspense>

      {/* ── 정식 수임 & 계약 체결 모달 (전자계약 / 대면계약 / 서류 패키지) ── */}
      {contractTargetRequest && (
        <ContractConversionModal
          request={contractTargetRequest}
          activeLawyer={activeLawyer}
          isOpen={!!contractTargetRequest}
          onClose={() => setContractTargetRequest(null)}
          onSuccess={handleContractSuccess}
          onAddMessage={onAddMessage}
        />
      )}

      {/* ── 리걸플로 벤치마킹: 상시 법률 실무 퀵툴 독 (Legal Quick Dock) ── */}
      <LegalQuickDock onOpenAlimtok={() => setActiveTab('client-crm')} />

      {/* ── 법무법인 로고 및 변호사 직인(인장) 관리 스튜디오 모달 ── */}
      {isSealModalOpen && (
        <SealStudioModal
          isOpen={isSealModalOpen}
          onClose={() => setIsSealModalOpen(false)}
          lawyerId={activeLawyer.id}
          lawyerName={activeLawyer.name}
          firmName={activeLawyer.firmName || '법무법인'}
          initialSealInfo={activeLawyer.sealInfo}
          onSaveSealInfo={(newInfo) => {
            setActiveLawyer(prev => ({ ...prev, sealInfo: newInfo }));
          }}
        />
      )}

    </div>
    </div>
  );
}
