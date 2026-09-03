import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useDialog } from './common/DialogProvider';
import { 
  Briefcase, BarChart2, Shield, ShieldAlert, MessageSquare, ListCheck, FolderHeart, 
  Clock, Plus, Trash2, Send, Save, CreditCard, ChevronRight, ChevronLeft, CheckCircle2, Check, ExternalLink,
  Users, LogOut, Lock, Settings, MapPin, Bell, Smartphone, FileText, Eye, Megaphone, Info, Tag, TrendingUp, ChevronDown, ChevronUp, Zap, AlertTriangle, Receipt, Microscope, Trophy, Calendar, Target, MessageCircle, ArrowRight, UserCheck, UserX, CalendarCheck, Search, FileSignature
} from 'lucide-react';
import { 
  ConsultRequest, User, ConsultMessage, Case, CaseStatus, ConsultStatus, Member, ActivityLog, MemberRole, PlatformConfig, AdOrder, ClientQA, PopupConfig, LawyerInquiry, Notice 
} from '../types';
import { platformPlans, adProducts, mockLawyers, mockAdOrders, BANK_ACCOUNT_INFO, initialNotices } from '../data';
import { ChatDisclaimer } from './Disclaimers';
import { calculateRepayment, RehabUserInput, type RehabCalculationResult } from '../rehab-chatbot-package/services/calculationService';
import LawyerProposalDraft from './lawyer/LawyerProposalDraft';
import ProposalWorkspace from './lawyer/ProposalWorkspace';
import { mapToRehabUserInput } from './lawyer/mapToRehabUserInput';
import CrmTab from './lawyer/CrmTab';
const ContractManagementTab = React.lazy(() => import('./lawyer/ContractManagementTab'));
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
import { validateInviteToken, consumeInviteToken } from '../services/inviteService';
import { loadStaffMembers } from '../services/crmService';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { createNotification } from '../services/notificationCenterService';
import { loadLawyerBusinessInfo, saveLawyerBusinessInfo, checkCorpNum, formatCorpNum, type LawyerBusinessInfo } from '../services/taxInvoiceService';
import {
  loadNotificationSettings, saveNotificationSettings, loadNotificationLogs,
  testTelegramConnection, sendEmailNotification, formatEmailConsultHtml,
  requestBrowserPushPermission, sendBrowserPushNotification,
} from '../services/notificationService';
import type { NotificationSettings, NotificationLog } from '../types';
import PopupContainer from './popup/PopupContainer';
import LawyerInquiryTab from './lawyer/LawyerInquiryTab';
import LawyerProfileEditor from './lawyer/LawyerProfileEditor';
const NewCaseModal = React.lazy(() => import('./lawyer/NewCaseModal'));
const GlobalSearchPalette = React.lazy(() => import('./lawyer/GlobalSearchPalette'));
import ContractConversionModal from './lawyer/ContractConversionModal';

const getDisplayPhoneNumber = (req: ConsultRequest): string => {
  return req.phone || (req as any).clientPhone || (req as any).userPhone || "-";
};

interface LawyerRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string, targetLawyerId?: string) => void;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'cases' | 'billing' | 'client-crm' | 'case-copilot' | 'staff-management' | 'settings' | 'qna-answer' | 'tasks-schedule' | 'inquiry-to-admin' | 'contracts'>('dashboard');
  const [billingSub, setBillingSub] = useState<'status' | 'products' | 'orders' | 'business'>('status');
  const [settingsCategory, setSettingsCategory] = useState<'profile' | 'notifications' | 'rules' | 'notices'>('profile');
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
  const [adModalMonths, setAdModalMonths] = useState(1);
  const [adModalDepositor, setAdModalDepositor] = useState('');
  const [adModalRegion, setAdModalRegion] = useState('');
  const [adModalStep, setAdModalStep] = useState<'select' | 'done'>('select');
  const [adOrders, setAdOrders] = useState<AdOrder[]>(mockAdOrders);

  // 세금계산서 / 사업자 정보 상태
  const [bizInfo, setBizInfo] = useState<LawyerBusinessInfo | null>(() => loadLawyerBusinessInfo());
  const [bizFormOpen, setBizFormOpen] = useState(false);
  const [bizForm, setBizForm] = useState({ corpNum: '', corpName: '', ceoName: '', bizType: '전문서비스업', bizClass: '법률서비스', addr: '', taxEmail: '' });
  const [bizCheckResult, setBizCheckResult] = useState<string | null>(null);
  const [bizSaving, setBizSaving] = useState(false);
  const [tempFirmName, setTempFirmName] = useState('');

  // ── 전역 검색 & 외부 고객 등록 ──
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExternalClientModalOpen, setIsExternalClientModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  
  // Mobile UI navigation controls
  const [mobilePane, setMobilePane] = useState<'threads' | 'chat' | 'crm'>('threads');
  const [mobileStageFilter, setMobileStageFilter] = useState<'document' | 'filing' | 'commencement' | 'approval' | 'discharge'>('document');

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('legal_crm_lawyer_session') !== null;
  });
  const [activeLawyer, setActiveLawyer] = useState<User>(() => {
    const cached = sessionStorage.getItem('legal_crm_active_lawyer');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    const sessionLawyerId = sessionStorage.getItem('legal_crm_lawyer_session');
    if (sessionLawyerId) {
      try {
        const raw = localStorage.getItem('legal_crm_lawyers');
        if (raw) {
          const list: User[] = JSON.parse(raw);
          const found = list.find(l => l.id === sessionLawyerId);
          if (found) return found;
        }
      } catch (e) {}
    }
    return mockLawyers[0];
  });

  // Sync activeLawyer when lawyers prop updates
  useEffect(() => {
    const sessionLawyerId = sessionStorage.getItem('legal_crm_lawyer_session');
    if (sessionLawyerId && lawyers.length > 0) {
      const found = lawyers.find(l => l.id === sessionLawyerId);
      if (found) {
        setActiveLawyer(found);
        sessionStorage.setItem('legal_crm_active_lawyer', JSON.stringify(found));
        setIsLoggedIn(true);
      }
    } else if (lawyers.length > 0 && !isLoggedIn) {
      setActiveLawyer(lawyers[0]);
    }
  }, [lawyers, isLoggedIn]);

  // Sync tempFirmName when activeLawyer changes
  useEffect(() => {
    if (activeLawyer) {
      setTempFirmName(activeLawyer.firmName || '');
    }
  }, [activeLawyer]);

  // ── Cmd+K 전역 검색 단축키 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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

  // ── Browser history management: 뒤로 가기로 사이트 이탈 방지 ──
  const isPopStateRef = useRef(false);

  // 1) popstate listener: 뒤로 가기 시 이전 탭으로 이동, dashboard 이전은 차단
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      if (event.state && event.state.lawyerTab) {
        setActiveTab(event.state.lawyerTab);
      } else {
        // history에 상태가 없으면 dashboard로 복귀 + guard 재설치
        setActiveTab('dashboard');
        window.history.pushState({ lawyerTab: 'dashboard', guard: true }, '');
      }
      setTimeout(() => { isPopStateRef.current = false; }, 50);
    };

    // 초기 guard: dashboard 상태를 history에 넣어서 이전으로 못 빠지게
    window.history.replaceState({ lawyerTab: activeTab, guard: true }, '');

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2) 탭 변경 시 pushState로 history에 기록
  useEffect(() => {
    if (isPopStateRef.current) return;
    const currentState = window.history.state;
    if (!currentState || currentState.lawyerTab !== activeTab) {
      window.history.pushState({ lawyerTab: activeTab }, '');
    }
  }, [activeTab]);

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
          setIsLoggedIn(false);
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
              setIsLoggedIn(false);
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
  useEffect(() => {
    if (isLoggedIn && activeLawyer) {
      loadStaffMembers().then(members => {
        setStaffMembers(members);
        const found = members.find(m => m.linkedUserId === activeLawyer.id || m.authEmail === activeLawyer.id);
        if (found) {
          setActiveStaffMember(found);
        } else {
          setActiveStaffMember(null);
        }
      });
    }
  }, [isLoggedIn, activeLawyer]);
  
  // Login form state
  const [loginId, setLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showServiceGuide, setShowServiceGuide] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

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
  const [crmNewNote, setCrmNewNote] = useState<string>('');

  // CRM Detailed fields
  const [crmEditName, setCrmEditName] = useState<string>('');
  const [crmEditPhone, setCrmEditPhone] = useState<string>('');
  const [crmEditLawyerId, setCrmEditLawyerId] = useState<string>('');
  const [crmEditStatus, setCrmEditStatus] = useState<ConsultStatus>('requested');

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [contractTargetRequest, setContractTargetRequest] = useState<ConsultRequest | null>(null);
  
  // Custom case creation / note creation states
  const [newNote, setNewNote] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<{ [reqId: string]: string }>({
    'req-1': '채무자가 가상 화폐 선물 거래 명세서 파싱에 소극적임. 법관 최근 심사에 불리함을 재상담 필요.',
    'req-2': '요양보호사 수입이 보건위생부 고시 최저생계비 이하라 개인파산 면책 전향이 매우 안전해 보임.',
    'req-3': '회사 급여 가압류 통지 효력 정지를 위한 긴급 금지명령 심리 작성팀에 신속 배정 완료.'
  });

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

  // Auth logic
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('이메일(ID)과 비밀번호를 입력해주세요.');
      return;
    }

    const cleanedLoginId = loginId.trim().toLowerCase();
    
    // [SECURITY] Quick simple login bypass for testing (DEV Only)
    let found = null;
    if (import.meta.env.DEV) {
      if (cleanedLoginId === '1' && loginPassword === '1') {
        found = lawyers.find(l => l.id === 'lawyer-1') || lawyers[0];
      } else if (cleanedLoginId === '2' && loginPassword === '2') {
        found = lawyers.find(l => l.id === 'test-lawyer-1');
      } else if (cleanedLoginId === '3' && loginPassword === '3') {
        found = lawyers.find(l => l.id === 'test-lawyer-2');
      } else if (cleanedLoginId === '4' && loginPassword === '4') {
        found = lawyers.find(l => l.id === 'test-lawyer-3');
      } else if (cleanedLoginId === '5' && loginPassword === '5') {
        found = lawyers.find(l => l.id === 'test-lawyer-5');
      } else if (cleanedLoginId === '6' && loginPassword === '6') {
        found = lawyers.find(l => l.id === 'test-lawyer-6');
      } else if (cleanedLoginId === '7' && loginPassword === '7') {
        found = lawyers.find(l => l.id === 'test-lawyer-7');
      }
    }
    
    if (!found) {
      found = lawyers.find(l => 
        l.id.toLowerCase() === cleanedLoginId || 
        l.name.toLowerCase() === cleanedLoginId ||
        l.name.replace(/\s*변호사|\s*실장/g, '').toLowerCase() === cleanedLoginId
      );
    }

    if (!found) {
      setLoginError('등록되지 않은 이메일(ID) 또는 사용자명입니다.');
      return;
    }

    // [SECURITY] Bypass password check for simple bypass accounts ONLY in DEV
    const bypassIds = ['1', '2', '3', '4', '5', '6', '7'];
    if (import.meta.env.DEV && bypassIds.includes(cleanedLoginId)) {
      // Dev bypass allowed
    } else {
      // [SECURITY] Fix bug: missing/empty password should fail validation
      if (!found.password || found.password !== loginPassword) {
        setLoginError('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    // Unapproved account check
    if (found.approved === false) {
      setLoginError('관리자 자격 승인 심사가 완료되지 않은 계정입니다. 관리자 승인 후 로그인이 가능합니다.');
      return;
    }

    // Suspended, Withdrawn, or Dormant check before logging in
    const currentMember = members.find(m => m.id === found.id);
    if (currentMember) {
      if (currentMember.status === 'suspended' || currentMember.status === 'withdrawn') {
        const errorMsg = currentMember.status === 'withdrawn'
          ? '탈퇴 완료된 계정입니다. 해당 계정은 더 이상 사용할 수 없습니다.'
          : '이 계정은 관리자에 의해 임시 정지 처리되었습니다. 어드민 포털에 문의하십시오.';
        setLoginError(errorMsg);
        return;
      } else if (currentMember.status === 'dormant') {
        const confirmed = await dialog.confirm({
          title: '휴면 해제 확인',
          message: '휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?',
          confirmText: '휴면 해제',
          variant: 'warning'
        });
        if (confirmed) {
          setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
          onLogActivity(currentMember.id, currentMember.alias, 'LAWYER', 'LOGIN', `변호사 휴면 계정 수동 휴면 해제 성공`);
        } else {
          return;
        }
      }
    }

    sessionStorage.setItem('legal_crm_lawyer_session', found.id);
    setActiveLawyer(found);
    setIsLoggedIn(true);
    setLoginError('');
    setLoginId('');
    setLoginPassword('');

    onLogActivity(found.id, found.name, found.role as MemberRole, 'LOGIN', '로펌 CRM 파트너 로그인 성공');
    setMembers(prev => prev.map(m => m.id === found.id ? { ...m, lastActiveAt: new Date().toISOString() } : m));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupId.trim() || !signupPassword.trim() || !signupName.trim()) {
      setSignupError('필수 입력 항목(* 표시)을 모두 입력해주세요.');
      return;
    }

    const cleanedSignupId = signupId.trim().toLowerCase();
    const exists = lawyers.some(l => 
      l.id.toLowerCase() === cleanedSignupId || 
      l.name.toLowerCase() === signupName.trim().toLowerCase()
    );

    if (exists) {
      setSignupError('이미 등록되어 있는 ID 또는 이름입니다.');
      return;
    }

    let resolvedRole = signupRole;
    if (inviteToken && inviteTokenValid) {
      resolvedRole = inviteTokenRole as any;
    }

    const newLawyer: User = {
      id: signupId.trim(),
      lawFirmId: 'firm-1',
      teamId: resolvedRole === 'LAWYER' ? 'team-1' : 'team-1',
      name: signupName.trim() + (resolvedRole === 'LAWYER' ? ' 변호사' : ' 실장'),
      role: resolvedRole,
      fields: signupFields,
      region: signupRegion,
      avatar: avatarImageData || signupAvatar,
      avatarData: avatarImageData || undefined,
      bio: signupBio.trim() || `${signupName.trim()} ${resolvedRole === 'LAWYER' ? '변호사' : '실장'}입니다.`,
      recentActivity: '신규 회원 가입 완료',
      matchedCount: 0,
      password: signupPassword,
      approved: false,
      licenseImageData: licenseImageData || undefined,
      licenseNumber: signupLicenseNumber.trim() || undefined,
      licenseStatus: 'pending'
    };

    setLawyers(prev => [...prev, newLawyer]);

    const newMember: Member = {
      id: signupId.trim(),
      email: signupId.trim() + '@rehablaw.com',
      alias: signupName.trim() + (resolvedRole === 'LAWYER' ? ' 변호사' : ' 실장'),
      role: resolvedRole as MemberRole,
      createdAt: new Date().toISOString(),
      loginChannel: 'email',
      status: 'pending',
      lastActiveAt: new Date().toISOString()
    };
    setMembers(prev => [...prev, newMember]);
    onLogActivity(newMember.id, newMember.alias, newMember.role, 'SIGNUP', '로펌 CRM 파트너 신규 가입 신청 완료 (자격 심사 대기)');

    if (inviteToken && inviteTokenValid) {
      try {
        const { saveStaffMember } = await import('../services/crmService');
        const newStaff: StaffMember = {
          id: `staff-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: signupName.trim() + (resolvedRole === 'LAWYER' ? ' 변호사' : ''),
          role: inviteTokenRole,
          email: signupId.trim(),
          isActive: false,
          assignedCount: 0,
          createdAt: new Date().toISOString(),
          permissions: DEFAULT_PERMISSIONS[inviteTokenRole],
          status: 'pending',
          authEmail: signupId.trim(),
          authProvider: 'email',
          linkedUserId: signupId.trim(),
          inviteToken: inviteToken,
        };
        await saveStaffMember(newStaff);
        await consumeInviteToken(inviteToken, newStaff.id);
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        console.warn('[Signup] 초대 토큰 연동 실패:', err);
      }
    }

    dialog.alert({
      title: '회원가입 접수 완료',
      message: '회원가입이 완료되었습니다!\n\n관리자가 변호사 등록증을 확인한 후 승인 처리됩니다.\n승인 완료 후 로그인이 가능합니다.',
      variant: 'success'
    });
    setAuthMode('login');
    setLoginId(newLawyer.id);
    setSignupId('');
    setSignupPassword('');
    setSignupName('');
    setSignupBio('');
    setSignupError('');
    setSignupLicenseNumber('');
    setLicensePreview('');
    setLicenseImageData('');
    setAvatarPreview('');
    setAvatarImageData('');
    setInviteToken('');
    setInviteTokenValid(false);
  };

  // Google & Kakao OAuth 콜백 및 세션 동기화 처리 (리다이렉트 복귀 처리)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const processOAuthSession = async (session: any, source: string) => {
      if (!session?.user?.email) return;
      const user = session.user;
      const email = user.email.toLowerCase().trim();
      const provider = user.app_metadata?.provider || 'google';
      const providerName = provider === 'kakao' ? '카카오' : 'Google';

      console.log(`[LawyerRole] OAuth 세션 확인 (${source}):`, email);

      // 1. 기존 변호사 계정과 매칭 시도 (email, id, 또는 이름 매칭)
      const matchedLawyer = lawyers.find(l => 
        (l.email && l.email.toLowerCase().trim() === email) ||
        l.id.toLowerCase() === email ||
        l.name.toLowerCase().includes(email.split('@')[0].toLowerCase())
      );

      if (matchedLawyer) {
        sessionStorage.removeItem('pending_lawyer_oauth');
        sessionStorage.setItem('legal_crm_lawyer_session', matchedLawyer.id);
        setActiveLawyer(matchedLawyer);
        setIsLoggedIn(true);
        toast.success(`[인증 완료] ${matchedLawyer.name} 님으로 로그인되었습니다.`);
      } else {
        // 2. 신규 소셜 연동 변호사 — 가입 접수 및 심사 대기(approved: false) 등록
        sessionStorage.removeItem('pending_lawyer_oauth');
        const newId = `lawyer-${Date.now()}`;
        const rawName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || '신규 변호사';
        const formattedName = rawName.includes('변호사') ? rawName : `${rawName} 변호사`;
        
        const newLawyerObj: User = {
          id: newId,
          lawFirmId: 'firm-1',
          teamId: 'team-1',
          name: formattedName,
          role: 'LAWYER',
          fields: ['개인회생', '개인파산'],
          region: '전국',
          email: email,
          avatar: user.user_metadata?.avatar_url,
          bio: `${providerName} 계정으로 가입 신청된 변호사입니다.`,
          recentActivity: `${providerName} 소셜 연동 신청 완료 (자격 심사 대기)`,
          matchedCount: 0,
          approved: false,
          licenseStatus: 'pending'
        };

        setLawyers(prev => {
          if (prev.some(l => l.id === newId || (l.email && l.email.toLowerCase() === email))) {
            return prev;
          }
          return [...prev, newLawyerObj];
        });

        sessionStorage.setItem('legal_crm_lawyer_session', newLawyerObj.id);
        sessionStorage.setItem('legal_crm_active_lawyer', JSON.stringify(newLawyerObj));
        try {
          const raw = localStorage.getItem('legal_crm_lawyers');
          const existingList: User[] = raw ? JSON.parse(raw) : [];
          if (!existingList.some(l => l.id === newId || (l.email && l.email.toLowerCase() === email))) {
            localStorage.setItem('legal_crm_lawyers', JSON.stringify([...existingList, newLawyerObj]));
          }
        } catch (e) {}

        setActiveLawyer(newLawyerObj);
        setIsLoggedIn(true);
        toast.info(`${formattedName} 님, 신규 대리인 등록 접수되었습니다. 자격 증빙 제출 후 승인됩니다.`);

        try {
          const { saveStaffMember: saveSM } = await import('../services/crmService');
          const newStaff: StaffMember = {
            id: `staff-${Date.now()}`,
            name: newLawyerObj.name,
            role: 'LAWYER' as StaffRoleType,
            email: email,
            avatar: user.user_metadata?.avatar_url,
            isActive: false,
            assignedCount: 0,
            createdAt: new Date().toISOString(),
            permissions: DEFAULT_PERMISSIONS['LAWYER'],
            status: 'pending',
            authEmail: email,
            authProvider: provider === 'google' ? 'google' : 'kakao',
            supabaseUserId: user.id,
          };
          await saveSM(newStaff);
        } catch (err) {
          console.warn('[OAuth] StaffMember 생성 실패:', err);
        }
      }
    };

    // 1) 마운트 즉시 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !isLoggedIn) {
        processOAuthSession(session, '초기 getSession');
      }
    }).catch(err => {
      console.warn('[LawyerRole] getSession 실패:', err);
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
      } else if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('legal_crm_lawyer_session');
        setIsLoggedIn(false);
      }
    });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      subscription?.unsubscribe();
    };
  }, [lawyers, isLoggedIn]);

  // 비밀번호 변경 상태
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('비밀번호는 4자리 이상으로 설정해주세요.');
      return;
    }
    
    // 현재 비밀번호 확인
    if (activeLawyer.password && activeLawyer.password !== currentPassword) {
      toast.error('현재 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 로컬 비밀번호 업데이트
    setLawyers(prev => prev.map(l => 
      l.id === activeLawyer.id ? { ...l, password: newPassword } : l
    ));
    setActiveLawyer(prev => ({ ...prev, password: newPassword }));

    // Supabase Auth 비밀번호 업데이트 (설정된 경우)
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (err) {
        console.warn('[Auth] Supabase 비밀번호 업데이트 실패:', err);
      }
    }

    toast.success('비밀번호가 성공적으로 변경되었습니다.');
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'LOGIN', '비밀번호 변경 완료');
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
      sessionStorage.setItem('pending_lawyer_oauth', 'true');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/?role=lawyer`
        }
      });
      if (error) throw error;
    } catch (err: any) {
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
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => {});
      }
      setIsLoggedIn(false);
      setActiveStaffMember(null);
      if (lawyers.length > 0) {
        setActiveLawyer(lawyers[0]);
      }
    }
  };

  // CRM Logic
  const crmSelectedClient = requests.find(r => r.id === crmSelectedId);
  const crmSelectedNotes = crmSelectedId ? (internalNotes[crmSelectedId] ? internalNotes[crmSelectedId].split('\n').filter(Boolean) : []) : [];

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

  const handleAddCrmNote = () => {
    if (!crmSelectedId || !crmNewNote.trim()) return;
    setInternalNotes(prev => {
      const current = prev[crmSelectedId] || '';
      const updated = current ? `${current}\n${crmNewNote.trim()}` : crmNewNote.trim();
      return { ...prev, [crmSelectedId]: updated };
    });
    setCrmNewNote('');
  };

  const handleDeleteCrmNote = async (idxToDelete: number) => {
    if (!crmSelectedId) return;
    const confirmed = await dialog.confirm({
      title: '상담 메모 삭제',
      message: '해당 상담 메모를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    setInternalNotes(prev => {
      const notesArray = prev[crmSelectedId] ? prev[crmSelectedId].split('\n').filter(Boolean) : [];
      const updatedArray = notesArray.filter((_, idx) => idx !== idxToDelete);
      return { ...prev, [crmSelectedId]: updatedArray.join('\n') };
    });
    toast.success('상담 메모가 삭제되었습니다.');
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

  // 솔루션 및 비용 제안 버튼 클릭 시 자동 계산 후 워크스페이스 열기
  const [previousTab, setPreviousTab] = useState<string>('client-crm');
  const handleOpenProposalDraft = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

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

  // LawyerProposalDraft에서 제안서 발송 시 기존 데이터 플로우 유지 + 채팅 연동
  const handleSubmitProposalFromDraft = (reqId: string, proposalData: any) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    const isAIPremium = !!proposalData.aiInsights;

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
      remark: proposalData.lawyerOpinion || '제안서 발송',
      specialNotes: proposalData.specialNotes,
      clientQnA: proposalData.clientQnA,
      createdAt: new Date().toISOString(),
      proposalData: isAIPremium ? proposalData : undefined,
    };

    // 1) 상태를 'comparing'으로 변경 + acceptedLawyerIds에 변호사 추가 → 채팅탭에 노출
    setRequests(prev => prev.map(r => {
      if (r.id === reqId) {
        const currentAccepted = r.acceptedLawyerIds || [];
        return {
          ...r,
          status: 'comparing' as const,
          acceptedLawyerIds: currentAccepted.includes(activeLawyer.id) 
            ? currentAccepted 
            : [...currentAccepted, activeLawyer.id],
          proposals: [...(r.proposals || []), newProposal]
        };
      }
      return r;
    }));

    // 2) 채팅 메시지 생성: 시스템 알림 + 제안서 요약 메시지
    onAddMessage(
      reqId,
      `[System] ${activeLawyer.name} 변호사가 상담에 참여하였습니다.`,
      'lawyer',
      'system',
      'System'
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

    // 3) 채팅탭으로 자동 전환 + 해당 스레드 활성화
    setActiveChatReqId(reqId);
    setActiveTab('chat');
    toast.success('제안서가 발송되었습니다. 상담 채팅이 시작됩니다.');

    // 모달 닫기 및 상태 초기화
    setProposalModalReqId(null);
    setProposalRehabResult(null);
    setProposalRehabInput(null);
    setProposalConsultRequest(null);
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

  const handleRequestProposalConfirm = (reqId: string, proposalData: any, memo: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

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
      activeLawyer.firmName || 'default',
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
    );

    toast.success(`${supervisingLawyer.name} 변호사에게 컨펌 요청을 보냈습니다.`);

    setProposalModalReqId(null);
    setProposalRehabResult(null);
    setProposalRehabInput(null);
    setProposalConsultRequest(null);
  };

  const handleApproveProposal = (pendingId: string, proposalData: any) => {
    const pending = pendingProposals.find(p => p.id === pendingId);
    if (!pending) return;

    // 제안서를 승인 → 고객에게 실제 발송
    handleSubmitProposalFromDraft(pending.reqId, proposalData);

    // pending에서 제거
    setPendingProposals(prev => prev.filter(p => p.id !== pendingId));
    setReviewModalProposal(null);

    // 직원에게 승인 알림
    createNotification(
      activeLawyer.firmName || 'default',
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
    );

    toast.success('제안서를 승인하고 고객에게 발송했습니다.');
  };

  const handleRejectProposal = (pendingId: string, reason: string) => {
    const pending = pendingProposals.find(p => p.id === pendingId);
    if (!pending) return;

    setPendingProposals(prev => prev.filter(p => p.id !== pendingId));
    setReviewModalProposal(null);

    // 직원에게 반려 알림
    createNotification(
      activeLawyer.firmName || 'default',
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
    );

    toast.info('제안서를 반려했습니다.');
  };

  // Open contract conversion modal for formal case intake
  const handleConvertToCase = (req: ConsultRequest) => {
    const isAlreadyCase = cases.some(c => c.clientId === req.clientId);
    if (isAlreadyCase) {
      toast.error('이미 정식 수임 사건으로 등록된 고객입니다.');
      return;
    }
    setContractTargetRequest(req);
  };

  const handleContractSuccess = (newCase: Case, newContract: any) => {
    setCases(prev => [newCase, ...prev]);
    // Promote consultation request to contracted/counseling and ensure lawyer assignment
    if (contractTargetRequest) {
      setRequests(prev => prev.map(r => {
        if (r.id === contractTargetRequest.id) {
          const accepted = r.acceptedLawyerIds ? [...r.acceptedLawyerIds] : [];
          if (!accepted.includes(activeLawyer.id)) accepted.push(activeLawyer.id);
          return {
            ...r,
            status: 'counseling',
            assignedLawyerId: activeLawyer.id,
            acceptedLawyerIds: accepted
          };
        }
        return r;
      }));
    }
    setActiveTab('client-crm');
    setContractTargetRequest(null);

    // Log activity
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'STATUS_CHANGE',
      `정식 수임 계약 체결: ${newCase.clientName} 의뢰인 (${newContract?.totalFee ? (newContract.totalFee / 10000) + '만 원' : '수임 완료'}) -> [서류 준비 착수]`
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

  const handleSendChat = () => {
    if (!chatInput.trim() || !activeChatReqId) return;
    onAddMessage(activeChatReqId, chatInput.trim(), 'lawyer', activeLawyer.id, activeLawyer.name);
    
    // Log message sent
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CHAT_SEND',
      `의뢰인 상담 대화 작성: "${chatInput.trim().substring(0, 30)}${chatInput.trim().length > 30 ? '...' : ''}"`
    );

    setChatInput('');
  };

  // Live Statistics - 현재 변호사 관련 요청만 필터
  const isRelevantRequest = (r: ConsultRequest) => {
    const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
    const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
      const targetLawyer = lawyers.find(l => l.id === id);
      return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
    });
    const openMatch = r.requestType === 'open';
    return directMatch || sameFirmMatch || openMatch;
  };
  const totalOpenRequestsCount = requests.filter(r => r.status === 'requested' && isRelevantRequest(r)).length;
  const activeChatsCount = requests.filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open')).length;
  const totalCasesCount = cases.length;
  const directCounselingCount = requests.filter(r => r.status === 'responding' && r.selectedLawyerId === activeLawyer.id).length;

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

          {/* Main Card Content */}
          <div className="space-y-4 text-left">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">변호사 및 파트너 로그인</h3>

            {/* 초대 링크 배너 */}
            {inviteToken && inviteTokenValid && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span><strong>초대 링크가 확인되었습니다!</strong> 아래 소셜 계정으로 로그인하시면 담당 역할({inviteTokenRole === 'LAWYER' ? '담당 변호사' : inviteTokenRole === 'CONSULTANT' ? '상담 직원' : inviteTokenRole === 'STAFF' ? '사무 직원' : '경리 직원'})로 즉시 연동됩니다.</span>
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
                onClick={handleKakaoLogin}
                className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#191919] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-base cursor-pointer active:scale-[0.98]"
              >
                <span className="w-6 h-6 flex items-center justify-center font-black text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full shrink-0">K</span>
                <span>카카오 계정으로 변호사 로그인</span>
              </button>

              {/* Google 로그인 */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-base cursor-pointer active:scale-[0.98]"
              >
                <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full shrink-0">G</span>
                <span>Google 계정으로 변호사 로그인</span>
              </button>
            </div>

            {/* Dev Only Fast Login */}
            {import.meta.env.DEV && (
              <div className="pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => {
                    const demoLawyer = lawyers.find(l => l.id === 'lawyer-1') || lawyers[0] || mockLawyers[0];
                    sessionStorage.setItem('legal_crm_lawyer_session', demoLawyer.id);
                    setActiveLawyer(demoLawyer);
                    setIsLoggedIn(true);
                    toast.success('[DEV] 김우진 대표변호사 테스트 계정으로 로그인되었습니다.');
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

  if (isLoggedIn && activeLawyer?.approved === false) {
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

          {/* 자격 증빙 등록증 제출 영역 */}
          {(!activeLawyer?.licenseNumber && !activeLawyer?.licenseImageData) ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>변호사 자격 증빙 서류 제출</span>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">변호사 등록번호</label>
                <input
                  type="text"
                  placeholder="예: 12345"
                  value={signupLicenseNumber}
                  onChange={(e) => setSignupLicenseNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">변호사 등록증 첨부 (이미지/PDF)</label>
                <label className="block cursor-pointer">
                  <div className={`border ${licensePreview ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 border-dashed bg-white'} rounded-xl p-3 text-xs text-center transition-colors hover:border-brand/50`}>
                    {licensePreview ? (
                      <span className="text-emerald-700 font-bold">✅ 등록증 파일 첨부 완료</span>
                    ) : (
                      <span className="text-slate-500">📎 클릭하여 등록증 첨부 (최대 5MB)</span>
                    )}
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleLicenseFileChange} className="hidden" />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!signupLicenseNumber.trim() && !licenseImageData) {
                    toast.error('변호사 등록번호 또는 등록증 이미지를 첨부해주세요.');
                    return;
                  }
                  setActiveLawyer(prev => ({
                    ...prev,
                    licenseNumber: signupLicenseNumber.trim() || undefined,
                    licenseImageData: licenseImageData || undefined,
                    recentActivity: '변호사 등록증 자격 증빙 제출 완료'
                  }));
                  setLawyers(prev => prev.map(l => l.id === activeLawyer?.id ? {
                    ...l,
                    licenseNumber: signupLicenseNumber.trim() || undefined,
                    licenseImageData: licenseImageData || undefined,
                    recentActivity: '변호사 등록증 자격 증빙 제출 완료'
                  } : l));
                  toast.success('자격 증빙 서류가 제출되었습니다! 관리자 확인 후 즉시 승인됩니다.');
                }}
                className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                자격 증빙 제출하기
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs text-left space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>변호사 자격 증빙 접수 완료</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                제출하신 변호사 등록번호({activeLawyer?.licenseNumber || '제출됨'})와 등록증 서류를 관리자가 확인 중입니다. 심사가 완료되면 다음 로그인 시 즉시 CRM에 접근하실 수 있습니다.
              </p>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold py-3 rounded-[200px] text-xs border border-slate-200 transition-colors shrink-0"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white">
      <div className="w-full h-full flex flex-col relative">
      
        {/* ── Top Header Bar (다크 네이비) ── */}
        <header className="sticky top-0 z-40 bg-[#1E293B] h-16 px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-sm border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <img 
              src="./mykim_logo.png" 
              alt="my김변 로고" 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-sm" 
            />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">my김변</span>
              <span className="text-xs sm:text-[13px] text-slate-300 font-bold">변호사 관리 시스템</span>
            </div>
            {activeLawyer.firmName && (
              <span className="text-slate-300 text-sm font-semibold hidden md:inline ml-2 border-l border-slate-600 pl-3">
                {activeLawyer.firmName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <img 
                src={activeLawyer.avatarData || activeLawyer.avatar} 
                alt={activeLawyer.name} 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-white/20 shadow-sm" 
              />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm sm:text-base font-bold text-white leading-tight">{activeLawyer.name}</span>
                <span className="text-xs text-slate-300 font-medium">{activeLawyer.role}</span>
              </div>
            </div>

            {/* 전역 검색 버튼 (자간 겹침 해결 & OS 자동 분기) */}
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-slate-200 hover:text-white transition-all cursor-pointer text-xs active:scale-95 shadow-xs" 
              title="전역 검색 (사건, 고객, 메모)"
            >
              <Search className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-semibold text-slate-200">검색</span>
              <kbd className="ml-1 text-[11px] bg-black/30 border border-white/15 px-1.5 py-0.5 rounded-md font-mono text-slate-300 font-bold tracking-tight">
                {typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac') ? '⌘ K' : 'Ctrl K'}
              </kbd>
            </button>

            <NotificationBell
              tenantId={activeLawyer.lawFirmId || activeLawyer.id}
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
                  setActiveTab('client-crm');
                } else if (linkType === 'case') {
                  setActiveTab('cases');
                } else if (linkType === 'copilot_review') {
                  setActiveTab('case-copilot');
                } else if (linkType === 'task') {
                  setActiveTab('tasks-schedule');
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

            {/* 스크롤 가능한 네비게이션 메뉴 영역 */}
            <nav className={`flex-1 py-3 overflow-y-auto no-scrollbar ${sidebarCollapsed ? 'px-2.5' : 'px-3.5'} space-y-1.5`}>
              {/* 그룹 1: 업무 (펼쳐진 상태에서는 타이틀 옆에 인라인 접기 버튼 배치) */}
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">업무</p>
                  <button 
                    onClick={() => setSidebarCollapsed(true)} 
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="사이드바 접기"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>접기</span>
                  </button>
                </div>
              )}
              {permissionCtx.canAccessTab('dashboard') && (
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                  title={sidebarCollapsed ? '종합 대시보드' : undefined}
                >
                  <BarChart2 className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">종합 대시보드</span>}
                </button>
              )}
              
              <button 
                onClick={() => setActiveTab('chat')} 
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                  activeTab === 'chat' 
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
                title={sidebarCollapsed ? '상담 채팅' : undefined}
              >
                <MessageSquare className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">상담 채팅</span>}
                {(() => { 
                  const c = requests.filter(r => (r.status === 'comparing' || r.status === 'counseling') && ((r.acceptedLawyerIds || []).includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id)).length; 
                  if (c === 0) return null;
                  return sidebarCollapsed ? (
                    <span className="absolute top-1.5 right-1.5 bg-brand text-white rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-black ring-2 ring-[#111827]">
                      {c > 9 ? '9+' : c}
                    </span>
                  ) : (
                    <span className="ml-auto bg-slate-700 text-slate-200 rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">
                      {c}
                    </span>
                  );
                })()}
              </button>

              {permissionCtx.canAccessTab('client-crm') && (
                <button 
                  onClick={() => setActiveTab('client-crm')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'client-crm' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                  title={sidebarCollapsed ? '고객 관리 (CRM)' : undefined}
                >
                  <Users className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">고객 관리 (CRM)</span>}
                  {requests.length > 0 && (
                    sidebarCollapsed ? (
                      <span className="absolute top-1.5 right-1.5 bg-slate-700 text-slate-200 rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold ring-2 ring-[#111827]">
                        {requests.length > 99 ? '99+' : requests.length}
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-md">
                        {requests.length}
                      </span>
                    )
                  )}
                </button>
              )}

              <button 
                onClick={() => setActiveTab('tasks-schedule')} 
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                  activeTab === 'tasks-schedule' 
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
                title={sidebarCollapsed ? '일정 / 할일' : undefined}
              >
                <CalendarCheck className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">일정 / 할일</span>}
              </button>

              <button 
                onClick={() => setActiveTab('contracts')} 
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                  activeTab === 'contracts' 
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
                title={sidebarCollapsed ? '전자 계약' : undefined}
              >
                <FileSignature className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">전자 계약</span>}
              </button>

              {/* 그룹 2: AI 도구 */}
              <div className="pt-2.5 pb-1"><div className="border-t border-slate-800/80" /></div>
              {!sidebarCollapsed && <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 pb-1 pt-1">AI 도구</p>}
              
              {permissionCtx.canAccessTab('case-copilot') && (
                <button 
                  onClick={() => setActiveTab('case-copilot')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'case-copilot' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  } ${!activeLawyer.aiCaseAnalysisEnabled ? 'opacity-60' : ''}`}
                  title={sidebarCollapsed ? 'AI 사건 분석' : undefined}
                >
                  {activeLawyer.aiCaseAnalysisEnabled ? (
                    <Microscope className="w-5 h-5 shrink-0" />
                  ) : (
                    <Lock className="w-5 h-5 shrink-0 text-slate-500" />
                  )}
                  {!sidebarCollapsed && <span className="truncate">AI 사건 분석</span>}
                  {!activeLawyer.aiCaseAnalysisEnabled ? (
                    !sidebarCollapsed && <span className="ml-auto bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-md px-1.5 py-0.5 text-[10px] font-bold">유료</span>
                  ) : (
                    (() => { 
                      const n = requests.filter(r => r.status === 'requested' || r.status === 'responding').length; 
                      if (n === 0) return null;
                      return sidebarCollapsed ? (
                        <span className="absolute top-1.5 right-1.5 bg-brand text-white rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold ring-2 ring-[#111827]">
                          {n}
                        </span>
                      ) : (
                        <span className="ml-auto bg-slate-700 text-slate-200 rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">{n}</span>
                      );
                    })()
                  )}
                </button>
              )}

              <button 
                onClick={() => setActiveTab('qna-answer')} 
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                  activeTab === 'qna-answer' 
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
                title={sidebarCollapsed ? '고민상담 Q&A' : undefined}
              >
                <ListCheck className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">고민상담 Q&A</span>}
                {qas && (() => { 
                  const w = qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length; 
                  if (w === 0) return null;
                  return sidebarCollapsed ? (
                    <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold ring-2 ring-[#111827]">
                      {w}
                    </span>
                  ) : (
                    <span className="ml-auto bg-rose-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">
                      {w}
                    </span>
                  );
                })()}
              </button>

              {/* 그룹 3: 관리 */}
              <div className="pt-2.5 pb-1"><div className="border-t border-slate-800/80" /></div>
              {!sidebarCollapsed && <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 pb-1 pt-1">관리</p>}
              
              {permissionCtx.canAccessTab('billing') && (
                <button 
                  onClick={() => setActiveTab('billing')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'billing' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                  title={sidebarCollapsed ? '요금제 / 빌링' : undefined}
                >
                  <CreditCard className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">요금제 / 빌링</span>}
                </button>
              )}

              {permissionCtx.canAccessTab('staff-management') && (
                <button 
                  onClick={() => setActiveTab('staff-management')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'staff-management' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                  title={sidebarCollapsed ? '직원 관리' : undefined}
                >
                  <Shield className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">직원 관리</span>}
                  {(() => { 
                    const p = staffMembers.filter(m => m.status === 'pending').length; 
                    if (p === 0) return null;
                    return sidebarCollapsed ? (
                      <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold ring-2 ring-[#111827]">
                        {p}
                      </span>
                    ) : (
                      <span className="ml-auto bg-rose-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold">{p}</span>
                    );
                  })()}
                </button>
              )}

              <button 
                onClick={() => setActiveTab('inquiry-to-admin')} 
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                  activeTab === 'inquiry-to-admin' 
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
                title={sidebarCollapsed ? '마이김변 문의' : undefined}
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">마이김변 문의</span>}
              </button>

              {permissionCtx.canAccessTab('settings') && (
                <button 
                  onClick={() => setActiveTab('settings')} 
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'} rounded-xl text-[15px] transition-all cursor-pointer ${
                    activeTab === 'settings' 
                      ? 'bg-brand text-white font-bold shadow-md shadow-brand/20' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                  title={sidebarCollapsed ? '알림 및 설정' : undefined}
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">알림 및 설정</span>}
                </button>
              )}
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
              ? 'h-[calc(100vh-4rem)] overflow-hidden bg-[#F8FAFC] p-3 lg:p-5'
              : 'overflow-y-auto bg-[#F8FAFC] px-4 lg:px-8 py-6 pb-20 lg:pb-8'
          } ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'} transition-all duration-200`}>

          {/* ── Mobile Bottom Tab Bar ── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-lg">
            <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <BarChart2 className="w-5 h-5" /><span className="text-xs font-bold">대시보드</span>
            </button>
            <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'chat' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <MessageSquare className="w-5 h-5" /><span className="text-xs font-bold">채팅</span>
            </button>
            <button onClick={() => setActiveTab('client-crm')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'client-crm' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Users className="w-5 h-5" /><span className="text-xs font-bold">CRM</span>
            </button>
            <button onClick={() => { /* Toggle more menu */ const tabs: Array<typeof activeTab> = ['cases','tasks-schedule','billing','case-copilot','qna-answer','staff-management','settings']; const curr = tabs.indexOf(activeTab as any); setActiveTab(tabs[curr >= 0 ? (curr + 1) % tabs.length : 0]); }} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${!['dashboard','chat','client-crm'].includes(activeTab) ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Settings className="w-5 h-5" /><span className="text-xs font-bold">더보기</span>
            </button>
          </div>

        {/* TAB 1: LAWYER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* ═══ 컨펌 대기 제안서 위젯 (변호사/대표만 표시) ═══ */}
            {isLawyerOrOwner && pendingProposals.filter(p => p.supervisingLawyerId === activeLawyer.id).length > 0 && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-amber-900 flex items-center gap-2 text-sm">
                    📋 컨펌 대기 제안서
                    <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {pendingProposals.filter(p => p.supervisingLawyerId === activeLawyer.id).length}
                    </span>
                  </h3>
                </div>
                <div className="space-y-2">
                  {pendingProposals.filter(p => p.supervisingLawyerId === activeLawyer.id).map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-amber-200/60 p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{p.clientName}</p>
                        <p className="text-xs text-slate-500">작성: {p.staffName} · {new Date(p.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        {p.memo && <p className="text-xs text-amber-700 mt-0.5">💬 {p.memo}</p>}
                      </div>
                      <button
                        onClick={() => {
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
                        className="px-4 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-all active:scale-[0.98] whitespace-nowrap"
                      >
                        검토하기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ 섹션 1: 상단 요약 카드 6열 (모노크롬 고대비 + 스파크라인) ═══ */}
            {(() => {
              // 미니 스파크라인 SVG 생성 헬퍼
              const Sparkline = ({ data, color = '#94a3b8', height = 24, width = 48 }: { data: number[]; color?: string; height?: number; width?: number }) => {
                if (data.length < 2) return null;
                const max = Math.max(...data, 1); const min = Math.min(...data, 0);
                const range = max - min || 1;
                const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
                return (<svg width={width} height={height} className="mt-1 opacity-60"><polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} /></svg>);
              };
              // 주간 트렌드 데이터 (최근 7일 기준 mock - 실데이터 누적 시 대체)
              const now = Date.now(); const dayMs = 86400000;
              const weeklyNew = Array.from({ length: 7 }, (_, i) => requests.filter(r => { const d = new Date(r.createdAt).getTime(); return d >= now - (7 - i) * dayMs && d < now - (6 - i) * dayMs; }).length);
              const weeklyChat = Array.from({ length: 7 }, (_, i) => Math.max(0, activeChatsCount + Math.round((Math.sin(i) * 2))));
              const weeklyCase = Array.from({ length: 7 }, (_, i) => Math.max(0, totalCasesCount + Math.round((Math.cos(i) * 1.5))));
              return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. 신규 상담 (신규 건수 있을 때 단독 펄스 애니메이션 적용) */}
              <button
                onClick={() => setActiveTab('client-crm')}
                className={`p-4.5 rounded-2xl border flex items-center justify-between transition-all press-scale cursor-pointer active:scale-[0.98] group text-left ${
                  totalOpenRequestsCount > 0
                    ? 'bg-gradient-to-br from-rose-50/60 via-white to-rose-50/20 new-consult-pulse-card hover:shadow-lg'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold tracking-tight ${totalOpenRequestsCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>신규 상담</span>
                    {totalOpenRequestsCount > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums block ${totalOpenRequestsCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{totalOpenRequestsCount}</span>
                  <Sparkline data={weeklyNew} color={totalOpenRequestsCount > 0 ? '#e11d48' : '#94a3b8'} />
                </div>
                <div className={`p-2.5 rounded-xl transition-all shrink-0 ${totalOpenRequestsCount > 0 ? 'bg-rose-500 text-white shadow-xs shadow-rose-200 group-hover:bg-[#1E3A5F]' : 'bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white'}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
              </button>

              {/* 2. 응답 대기 */}
              <button onClick={() => setActiveTab('client-crm')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-bold tracking-tight">응답 대기</span>
                    {directCounselingCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                    )}
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{directCounselingCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </button>

              {/* 3. 진행 중 상담 */}
              <button onClick={() => setActiveTab('chat')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold tracking-tight block">진행 중 상담</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{activeChatsCount}</span>
                  <Sparkline data={weeklyChat} color="#3b82f6" />
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </button>

              {/* 4. 수임 전환 */}
              <button onClick={() => setActiveTab('client-crm')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold tracking-tight block">수임 전환</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{totalCasesCount}</span>
                  <Sparkline data={weeklyCase} color="#10b981" />
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <FolderHeart className="w-5 h-5" />
                </div>
              </button>

              {/* 5. 미답변 Q&A */}
              <button onClick={() => setActiveTab('qna-answer')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-bold tracking-tight">미답변 Q&A</span>
                    {(() => {
                      const waitingCount = qas ? qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length : 0;
                      return waitingCount > 0 ? <span className="w-2 h-2 rounded-full bg-rose-500" /> : null;
                    })()}
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{qas ? qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length : 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <ListCheck className="w-5 h-5" />
                </div>
              </button>

              {/* 6. 활성 광고 */}
              <button onClick={() => setActiveTab('billing')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold tracking-tight block">활성 광고</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{adOrders.filter(o => o.status === 'active').length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
              </button>
            </div>
              );
            })()}

            {/* ═══ Row 3: 지금 상담을 기다리는 의뢰인 — 긴급 Action Zone ═══ */}
            {(
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-500 shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span>지금 상담을 기다리는 의뢰인</span>
                </h3>
                <span className="bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-xs">
                  {totalOpenRequestsCount}건 대기 중
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {requests
                  .filter(r => r.status === 'requested' && isRelevantRequest(r))
                  .slice(0, 3)
                  .map((r, idx) => {
                    const assets = r.financialProfile.assetsTotal ?? r.financialProfile.myAssets ?? 0;
                    return (
                    <button
                      key={r.id}
                      onClick={() => setActiveTab('client-crm')}
                      className="bg-slate-50/70 hover:bg-slate-100/90 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md p-4 flex flex-col gap-3 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left"
                    >
                      {/* 상단: 뱃지 + 이름 + 날짜 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            r.requestType === 'direct'
                              ? 'bg-[#1E3A5F] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {r.requestType === 'direct' ? '지명' : '오픈'}
                          </span>
                          {r.entryCategory && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap truncate max-w-[80px] bg-white text-slate-700 border border-slate-200">
                              {r.entryCategory.label}
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-900 truncate">{r.clientName}</span>
                          {Date.now() - new Date(r.createdAt).getTime() < 48 * 60 * 60 * 1000 && (
                            <span className="inline-flex items-center text-[10px] font-black tracking-wider text-white bg-rose-500 px-1.5 py-[1px] rounded-md shadow-sm animate-pulse whitespace-nowrap shrink-0">NEW</span>
                          )}
                        </div>
                        <span className={`text-[10px] whitespace-nowrap shrink-0 ${Date.now() - new Date(r.createdAt).getTime() < 48 * 60 * 60 * 1000 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* 핵심 지표 3열 (채무 / 월소득 / 자산) */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">채무</div>
                          <div className="text-xs font-black text-slate-900">{r.financialProfile.debtTotal.toLocaleString()}만</div>
                        </div>
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">월소득</div>
                          <div className="text-xs font-bold text-slate-700">{r.financialProfile.income.toLocaleString()}만</div>
                        </div>
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">자산</div>
                          <div className="text-xs font-bold text-slate-700">{assets.toLocaleString()}만</div>
                        </div>
                      </div>

                      {/* 하단: 위험 플래그 + 화살표 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          {r.financialProfile.riskFlags.length > 0 && (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 truncate">
                              ⚠ 위험 {r.financialProfile.riskFlags.length}건
                            </span>
                          )}
                          {r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none' && (
                            <span className="text-[10px] text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              ⚡특례
                            </span>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A5F] transition-all shrink-0" />
                      </div>
                    </button>
                    );
                  })}
              </div>

              {requests.filter(r => r.status === 'requested').length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-700 font-bold">현재 대기 중인 신규 상담 요청이 없습니다.</p>
                  <p className="text-xs text-slate-500">의뢰인이 상담을 요청하면 이곳에 표시됩니다.</p>
                </div>
              )}

              {requests.filter(r => r.status === 'requested').length > 0 && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setActiveTab('client-crm')}
                    className="w-full sm:w-[32%] min-w-[240px] bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold py-3 px-5 rounded-xl text-sm transition-all press-scale cursor-pointer active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>신규 상담 {totalOpenRequestsCount}건 자세히 보기</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              )}
            </div>
            )}

            {/* ═══ Row 3: 고민상담 Q&A 미답변 + 광고/빌링 요약 (2열) ═══ */}
            {(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 좌측: 고민상담 Q&A 미답변 */}
              <button onClick={() => setActiveTab('qna-answer')} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ListCheck className="w-5 h-5 text-slate-700" />
                    <span>고민상담 Q&A</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-bold group-hover:text-[#1E3A5F] transition-colors flex items-center gap-1">전체 보기 <ArrowRight className="w-3 h-3" /></span>
                </div>
                {(() => {
                  const waitingQas = qas ? qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).slice(0, 4) : [];
                  return waitingQas.length > 0 ? (
                    <div className="space-y-2">
                      {waitingQas.map(q => (
                        <div key={q.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">{q.question}</p>
                            <p className="text-[11px] text-slate-400">{(q as any).userName || q.author || '의뢰인'} · {new Date(q.createdAt).toLocaleDateString()}</p>
                          </div>
                          {q.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">{q.category}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center space-y-1">
                      <ListCheck className="w-8 h-8 text-slate-200 mx-auto" />
                      <p className="text-xs text-slate-400 font-bold">대기 중인 고민상담이 없습니다</p>
                    </div>
                  );
                })()}
              </button>

              {/* 우측: 광고 & 요금 현황 */}
              <button onClick={() => setActiveTab('billing')} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-slate-700" />
                    <span>광고 & 요금 현황</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-bold group-hover:text-[#1E3A5F] transition-colors flex items-center gap-1">상세 보기 <ArrowRight className="w-3 h-3" /></span>
                </div>
                {(() => {
                  const activeAds = adOrders.filter(o => o.status === 'active');
                  const monthlyAdTotal = activeAds.reduce((s, o) => s + o.monthlyPrice, 0);
                  const currentPlan = platformPlans[1] || platformPlans[0];
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] text-slate-500 font-bold mb-1">활성 광고</div>
                        <div className="text-xl font-black text-slate-900 tabular-nums">{activeAds.length}건</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] text-slate-500 font-bold mb-1">이달 광고비</div>
                        <div className="text-xl font-black text-slate-900 tabular-nums">{(monthlyAdTotal / 10000).toFixed(0)}만원</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] text-slate-500 font-bold mb-1">구독 요금제</div>
                        <div className="text-sm font-black text-slate-900">{currentPlan ? currentPlan.name : 'Pro'}</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] text-slate-500 font-bold mb-1">월 구독료</div>
                        <div className="text-xl font-black text-slate-900 tabular-nums">{currentPlan ? currentPlan.price : '월 80만원'}</div>
                      </div>
                    </div>
                  );
                })()}
              </button>
            </div>
            )}

            {/* ═══ Row 4: 알림/공지 + 일정/할일 요약 (2열) ═══ */}
            {(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 좌측: 공지 사항 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-brand" />
                    <span>공지 사항</span>
                  </h3>
                  <button 
                    onClick={() => { setActiveTab('settings'); setSettingsCategory('notices'); setSettingsSub('notices'); }}
                    className="text-xs text-slate-500 hover:text-brand font-extrabold transition-colors flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50"
                  >
                    <span>더보기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {(notices || []).slice(0, 3).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setSelectedNoticeId(n.id);
                        setActiveTab('settings');
                        setSettingsCategory('notices');
                        setSettingsSub('notices');
                      }}
                      className="w-full flex items-start gap-3 py-1.5 hover:bg-slate-50/80 p-1.5 rounded-xl transition-all text-left cursor-pointer group/item"
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${n.isImportant ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-brand/10 text-brand'}`}>
                        {n.isImportant ? <AlertTriangle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {n.isImportant && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded shrink-0">중요</span>
                          )}
                          <p className="text-sm font-bold text-slate-800 group-hover/item:text-brand transition-colors truncate">{n.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{n.date}</p>
                      </div>
                    </button>
                  ))}
                  {(!notices || notices.length === 0) && (
                    <p className="text-xs text-slate-400 py-4 text-center">등록된 공지사항이 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 우측: 일정/할일 요약 */}
              <button onClick={() => setActiveTab('tasks-schedule')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-teal-500" />
                    <span>일정 / 할일</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-bold group-hover:text-brand transition-colors flex items-center gap-1">전체 보기 <ArrowRight className="w-3 h-3" /></span>
                </div>
                {(() => {
                  // 오늘 일정 로드
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const tenantId = activeLawyer.lawFirmId || activeLawyer.id;
                  const allEvts: { title: string; date: string; type: string }[] = [];
                  try {
                    const raw = localStorage.getItem(`calendar_events_${tenantId}`);
                    if (raw) {
                      const evts = JSON.parse(raw);
                      (evts as { title: string; date: string; type: string }[]).forEach(e => {
                        if (e.date === todayStr) allEvts.push(e);
                      });
                    }
                  } catch {}
                  const todayEvents = allEvts.slice(0, 5);
                  return (
                    <div>
                      {/* 오늘의 일정 */}
                      <div className="bg-brand/5 border border-brand/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-xs font-bold text-slate-700">{'\uD83D\uDCC5 \uC624\uB298\uC758 \uC77C\uC815'}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{todayStr.slice(5)}</span>
                        </div>
                        {todayEvents.length > 0 ? todayEvents.map((evt, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span>{evt.type === 'deadline' ? '\uD83D\uDD14' : evt.type === 'court' ? '\u2696\uFE0F' : evt.type === 'meeting' ? '\uD83E\uDD1D' : '\uD83D\uDCC5'}</span>
                            <span className="text-slate-700 font-medium truncate flex-1">{evt.title}</span>
                          </div>
                        )) : (
                          <p className="text-[11px] text-slate-400">{'\uC624\uB298 \uC608\uC815\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </button>
            </div>
            )}

            {/* ═══ Row 5: 수임 전환 퍼널 + 주요 상담 유형 ═══ */}
            {(() => {
              const myParticipated = requests.filter(r => r.selectedLawyerId === activeLawyer.id).length;
              const myCounseling = requests.filter(r => r.status === 'counseling' && r.selectedLawyerId === activeLawyer.id).length;
              const myCases = cases.filter(c => c.assignedLawyerId === activeLawyer.id).length;
              const conversionRate = myParticipated > 0 ? Math.round((myCases / myParticipated) * 100) : 0;
              const totalRequested = requests.filter(r => isRelevantRequest(r)).length;
              const funnelStages = [
                { label: '상담 요청 접수', count: totalRequested, color: 'bg-slate-400', icon: <Briefcase className="w-4 h-4" /> },
                { label: '상담 참여', count: myParticipated, color: 'bg-brand', icon: <MessageCircle className="w-4 h-4" /> },
                { label: '상담 진행 중', count: myCounseling, color: 'bg-amber-500', icon: <MessageSquare className="w-4 h-4" /> },
                { label: '수임 전환 성공', count: myCases, color: 'bg-emerald-500', icon: <Trophy className="w-4 h-4" /> },
              ];
              const funnelMax = Math.max(totalRequested, 1);
              const categoryMap: Record<string, number> = {};
              requests.filter(r => r.selectedLawyerId === activeLawyer.id && r.entryCategory).forEach(r => {
                const label = r.entryCategory!.label;
                categoryMap[label] = (categoryMap[label] || 0) + 1;
              });
              const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* 수임 전환 퍼널 */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                      <Target className="w-5 h-5 text-brand" />
                      <span>수임 전환 퍼널</span>
                    </h3>
                    <div className="space-y-4">
                      {funnelStages.map((stage, i) => {
                        const pct = funnelMax > 0 ? Math.round((stage.count / funnelMax) * 100) : 0;
                        const dropRate = i > 0 && funnelStages[i - 1].count > 0
                          ? Math.round(((funnelStages[i - 1].count - stage.count) / funnelStages[i - 1].count) * 100)
                          : 0;
                        return (
                          <div key={stage.label} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                <span className={`p-1.5 rounded-lg ${stage.color} text-white`}>{stage.icon}</span>
                                {stage.label}
                              </div>
                              <div className="flex items-center gap-3">
                                {i > 0 && dropRate > 0 && (
                                  <span className="text-xs text-red-500 font-bold">-{dropRate}% 이탈</span>
                                )}
                                <span className="font-black text-slate-900 text-base">{stage.count}건</span>
                                <span className="text-slate-400 w-12 text-right font-medium">{pct}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${stage.color}`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 전환율 프로그레스 */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-bold">전체 수임 전환율</span>
                        <span className={`text-xl font-black ${conversionRate >= 40 ? 'text-emerald-600' : conversionRate >= 20 ? 'text-amber-500' : 'text-slate-700'}`}>{conversionRate}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${conversionRate >= 40 ? 'bg-emerald-500' : conversionRate >= 20 ? 'bg-amber-500' : 'bg-slate-300'}`}
                          style={{ width: `${Math.min(100, conversionRate)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 주요 상담 유형 */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                      <Tag className="w-5 h-5 text-violet-500" />
                      <span>주요 상담 유형</span>
                    </h3>
                    {topCategories.length > 0 ? (
                      <div className="space-y-2.5">
                        {topCategories.map(([label, count], i) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-teal-500' : 'bg-slate-400'}`} />
                              {label}
                            </span>
                            <span className="font-black text-slate-700">{count}건</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">상담 데이터가 쌓이면 유형별 분석이 표시됩니다.</p>
                    )}
                  </div>
                </div>
              );
            })()}


            {/* ═══ Row 6: 유입 채널 + 수임료 + 보정명령 ═══ */}
            {(() => {
              const crmStore = (() => { try { const raw = localStorage.getItem('legal_crm_data'); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
              const allExts = Object.values(crmStore) as any[];
              const channelCounts: Record<string, number> = {};
              allExts.forEach((ext: any) => { const ch = ext.intakeChannel || 'mykim'; channelCounts[ch] = (channelCounts[ch] || 0) + 1; });
              const totalClients = allExts.length || 1;
              const channelEntries = Object.entries(INTAKE_CHANNEL_CONFIG).map(([key, cfg]) => ({ key, ...cfg, count: channelCounts[key] || 0 })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
              let totalFeeAmount = 0; let totalPaidAmount = 0; let overdueCount = 0;
              allExts.forEach((ext: any) => { if (ext.feeSchedule) { ext.feeSchedule.forEach((f: any) => { totalFeeAmount += f.amount || 0; if (f.status === 'paid') totalPaidAmount += f.amount || 0; if (f.status === 'overdue') overdueCount++; }); } });
              const receivable = totalFeeAmount - totalPaidAmount;
              const urgentCorrections: { title: string; dDay: number; deadline: string }[] = [];
              allExts.forEach((ext: any) => { if (ext.correctionOrders) { ext.correctionOrders.forEach((co: any) => { if (co.status === 'pending') { const diff = Math.ceil((new Date(co.deadline).getTime() - Date.now()) / 86400000); if (diff <= 7) urgentCorrections.push({ title: co.title, dDay: diff, deadline: co.deadline }); } }); } });
              urgentCorrections.sort((a, b) => a.dDay - b.dDay);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4"><span className="text-lg">📊</span><span className="font-bold text-slate-800 text-sm">유입 채널 분석</span></div>
                    {channelEntries.length > 0 ? channelEntries.slice(0, 5).map(ch => (
                      <div key={ch.key} className="flex items-center gap-2 mb-2.5">
                        <span className="text-sm w-5">{ch.emoji}</span><span className="text-xs text-slate-600 w-20 truncate">{ch.label}</span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden"><div className={`h-full rounded-lg ${ch.bgColor.replace('/10', '/40')}`} style={{ width: `${Math.max(8, (ch.count / totalClients) * 100)}%` }}><span className="text-[10px] font-bold text-slate-700 px-1.5 leading-5">{ch.count}</span></div></div>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round((ch.count / totalClients) * 100)}%</span>
                      </div>
                    )) : <p className="text-xs text-slate-400 text-center py-4">고객 데이터가 쌓이면 채널별 분석이 표시됩니다.</p>}
                    <button onClick={() => setIsExternalClientModalOpen(true)} className="w-full mt-3 py-2 text-xs font-bold text-brand border border-brand/20 rounded-xl hover:bg-brand/5 transition-colors press-scale whitespace-nowrap">+ 외부 고객 등록</button>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4"><span className="text-lg">💰</span><span className="font-bold text-slate-800 text-sm">수임료 현황</span></div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center"><span className="text-xs text-slate-500">총 약정액</span><span className="font-bold text-slate-800 text-sm">{totalFeeAmount.toLocaleString()}만원</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-slate-500">수금 완료</span><span className="font-bold text-emerald-600 text-sm">{totalPaidAmount.toLocaleString()}만원</span></div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: totalFeeAmount > 0 ? `${(totalPaidAmount / totalFeeAmount) * 100}%` : '0%' }} /></div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100"><span className="text-xs text-slate-500">미수금</span><span className={`font-bold text-sm ${receivable > 0 ? 'text-red-500' : 'text-slate-400'}`}>{receivable.toLocaleString()}만원</span></div>
                      {overdueCount > 0 && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-medium">⚠️ 연체 {overdueCount}건</div>}
                      {totalFeeAmount === 0 && <p className="text-xs text-slate-400 text-center py-2">수임료를 등록하면 현황이 표시됩니다.</p>}
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4"><span className="text-lg">📮</span><span className="font-bold text-slate-800 text-sm">보정명령 D-Day</span></div>
                    {urgentCorrections.length > 0 ? urgentCorrections.slice(0, 4).map((co, i) => (
                      <div key={i} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-slate-700 truncate">{co.title}</p><p className="text-[10px] text-slate-400">{co.deadline}</p></div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black whitespace-nowrap ${co.dDay <= 1 ? 'bg-red-100 text-red-600 animate-pulse' : co.dDay <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-amber-50 text-amber-600'}`}>{co.dDay <= 0 ? '기한 도과!' : `D-${co.dDay}`}</span>
                      </div>
                    )) : <div className="text-center py-6"><span className="text-2xl">✅</span><p className="text-xs text-slate-400 mt-2">긴급 보정명령 없음</p></div>}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* TAB 3: 상담 채팅 */}
        {activeTab === 'chat' && (() => {
          const chatThreads = requests
            .filter(r => {
              if ((r as any).isSoftDeleted) return false;
              const hasMyProposal = (r.proposals || []).some((p: any) => p.lawyerId === activeLawyer.id);
              const isAccepted = (r.acceptedLawyerIds || []).includes(activeLawyer.id);
              const isSelected = r.selectedLawyerId === activeLawyer.id || (r.selectedLawyerIds || []).includes(activeLawyer.id);
              const hasMessages = messages.some(m => m.consultRequestId === r.id);
              const isCounselingOrActive = ['comparing', 'counseling', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'].includes(r.status);
              return hasMyProposal || isAccepted || isSelected || (hasMessages && isCounselingOrActive);
            })
            .sort((a, b) => {
              const lastMsgA = messages.filter(m => m.consultRequestId === a.id).slice(-1)[0];
              const lastMsgB = messages.filter(m => m.consultRequestId === b.id).slice(-1)[0];
              const timeA = lastMsgA ? new Date(lastMsgA.createdAt).getTime() : new Date(a.createdAt).getTime();
              const timeB = lastMsgB ? new Date(lastMsgB.createdAt).getTime() : new Date(b.createdAt).getTime();
              return timeB - timeA;
            });

          const selectedThread = (activeChatReqId && requests.find(r => r.id === activeChatReqId)) || chatThreads[0] || null;
          const activeThreadId = selectedThread?.id || activeChatReqId;
          const currentMsgs = selectedThread ? messages.filter(m => m.consultRequestId === selectedThread.id) : [];

          const chatEndRef = React.createRef<HTMLDivElement>();
          return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 h-full min-h-0">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className={`lg:col-span-3 border-r border-slate-200 flex flex-col h-full min-h-0 bg-white ${mobilePane === 'threads' ? 'block' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h3 className="font-bold text-base text-slate-900">상담 메시지함</h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">상담 진행 및 매칭 고객</p>
                </div>
                {chatThreads.length > 0 && (
                  <span className="bg-brand/10 text-brand text-xs font-bold px-2.5 py-1 rounded-lg">{chatThreads.length}명</span>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
                {chatThreads.map(r => {
                    const isSelected = r.id === activeThreadId;
                    const lastMsg = messages.filter(m => m.consultRequestId === r.id).slice(-1)[0];
                    return (
                      <div 
                        key={r.id}
                        onClick={() => {
                          setActiveChatReqId(r.id);
                          setMobilePane('chat');
                        }}
                        className={`p-4 cursor-pointer text-left transition-all ${
                          isSelected ? 'bg-brand/5 border-l-4 border-l-brand' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'}`}>
                            {r.clientName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-900 truncate">{r.clientName}</span>
                              <span className="text-xs text-slate-400 shrink-0 font-medium">
                                {lastMsg ? new Date(lastMsg.createdAt).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-normal">
                              {lastMsg ? lastMsg.message : r.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                r.status === 'comparing' ? 'bg-amber-100 text-amber-700' :
                                r.status === 'counseling' ? 'bg-emerald-100 text-emerald-700' :
                                r.status === 'contracted' ? 'bg-blue-100 text-blue-700' :
                                r.status === 'document' ? 'bg-indigo-100 text-indigo-700' :
                                r.status === 'filed' ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {r.status === 'comparing' ? '비교 상담중' :
                                 r.status === 'counseling' ? '상담 진행중' :
                                 r.status === 'contracted' ? '수임 계약' :
                                 r.status === 'document' ? '서류 준비' :
                                 r.status === 'filed' ? '접수 완료' : '상담중'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">채무 {r.financialProfile?.debtTotal?.toLocaleString() || 0}만</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {chatThreads.length === 0 && (
                  <div className="p-8 text-center space-y-3">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-600 font-bold">활성 대화방이 없습니다</p>
                    <p className="text-xs text-slate-400">제안서를 발송하거나 상담을 시작하면 여기에 표시됩니다</p>
                    <button 
                      onClick={() => setActiveTab('client-crm')}
                      className="text-brand font-bold text-sm hover:underline press-scale cursor-pointer"
                    >
                      고객 관리(CRM)에서 신규 의뢰 확인하기 →
                    </button>
                  </div>
                )}
              </div>
            </div>


            {/* PANEL II: ACTIVE MESSAGING BOARD (CENTER) */}
            <div className={`lg:col-span-6 border-r border-slate-200 flex flex-col h-full min-h-0 bg-slate-50/30 ${mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {selectedThread ? (
                <>
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => setMobilePane('threads')}
                        className="lg:hidden flex items-center justify-center text-brand font-bold text-xs border border-brand/20 bg-brand/5 p-2 rounded-xl shrink-0 press-scale cursor-pointer"
                        title="목록으로"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                        {selectedThread.clientName[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-slate-900 line-clamp-1">{selectedThread.clientName}</h3>
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          보안 채널 연결됨
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => setMobilePane('crm')}
                        className="lg:hidden text-slate-700 font-bold text-xs border border-slate-200 bg-slate-100 px-3 py-2 rounded-xl transition-all press-scale cursor-pointer"
                      >
                        의뢰 정보 ℹ️
                      </button>
                      <span className="hidden sm:inline bg-slate-100 border border-slate-200 text-xs text-slate-500 px-2.5 py-1 rounded-lg font-mono">
                        {selectedThread.id.substring(0, 12)}
                      </span>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                    <div className="p-4 bg-brand/5 rounded-2xl text-slate-700 text-xs sm:text-sm border border-brand/15 text-left whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto shadow-xs">
                      📝 <span className="text-brand font-bold">의뢰서 본문:</span> {selectedThread.content}
                    </div>

                    {currentMsgs.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      const isSystem = (m as any).senderType === 'admin' || m.senderName === 'System' || m.message.startsWith('[System]');
                      
                      if (isSystem) {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                              {m.message.replace('[System] ', '')}
                            </span>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 mb-1 text-xs text-slate-400 font-medium">
                            <span className="font-bold text-slate-600">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`p-3.5 rounded-2xl max-w-md text-sm sm:text-base leading-relaxed text-left shadow-xs ${
                            isMe 
                            ? 'bg-brand text-white rounded-tr-none' 
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                          }`}>
                            {m.message}
                          </div>
                          {isMe && (
                            <span className="text-xs text-slate-400 mt-0.5">✓</span>
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick replies + Messenger form */}
                  <div className="border-t border-slate-200 bg-white shrink-0">
                    <div className="px-4 pt-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
                      {['📋 준비서류 안내', '💰 상담료 안내', '📅 일정 조율'].map(label => (
                        <button
                          key={label}
                          onClick={() => setChatInput(label.substring(2).trim())}
                          className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors press-scale shrink-0 font-medium cursor-pointer"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="p-3.5 flex items-center gap-2.5">
                      <input 
                        type="text" 
                        placeholder="메시지를 입력하세요..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (!chatInput.trim() || !activeThreadId) return;
                            onAddMessage(activeThreadId, chatInput.trim(), 'lawyer', activeLawyer.id, activeLawyer.name);
                            onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'CHAT_SEND', `의뢰인 상담 대화 작성: "${chatInput.trim().substring(0, 30)}"`);
                            setChatInput('');
                            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400"
                      />
                      <button 
                        onClick={() => {
                          if (!chatInput.trim() || !activeThreadId) return;
                          onAddMessage(activeThreadId, chatInput.trim(), 'lawyer', activeLawyer.id, activeLawyer.name);
                          onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'CHAT_SEND', `의뢰인 상담 대화 작성: "${chatInput.trim().substring(0, 30)}"`);
                          setChatInput('');
                          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                        }}
                        className="bg-brand hover:bg-brand-hover text-white font-bold p-3 rounded-xl transition-all shrink-0 press-scale cursor-pointer active:scale-[0.98]"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <MessageSquare className="w-14 h-14 text-slate-300" />
                  <p className="text-base text-slate-700 font-bold">대화를 선택하세요</p>
                  <p className="text-sm text-slate-400">좌측 메시지함에서 스레드를 클릭하면 대화가 시작됩니다.</p>
                </div>
              )}
            </div>

            {/* PANEL III: CRM RIGHT-RAIL (RIGHT) */}
            <div className={`lg:col-span-3 flex flex-col h-full min-h-0 bg-white overflow-y-auto ${mobilePane === 'crm' ? 'block' : 'hidden lg:flex'}`}>
              {selectedThread ? (
                <div className="p-5 space-y-5 text-sm">
                  
                  {/* Mobile back button */}
                  <div className="lg:hidden">
                    <button 
                      onClick={() => setMobilePane('chat')}
                      className="w-full flex items-center justify-center gap-1.5 text-brand font-bold text-sm border border-brand/20 bg-brand/5 py-3 rounded-xl transition-all press-scale cursor-pointer"
                    >
                      ← 대화방으로 돌아가기
                    </button>
                  </div>

                  {/* 가계 진단 분석서 */}
                  <div className="space-y-3.5">
                    <span className="text-sm font-black text-brand tracking-wide uppercase block">📈 가계 진단 분석서</span>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">의뢰인명</span> <span className="font-bold text-slate-900">{selectedThread.clientName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">연락처</span> <span className="font-mono text-slate-800 font-semibold">{getDisplayPhoneNumber(selectedThread)}</span></div>
                      {selectedThread.financialProfile.age && (
                        <div className="flex justify-between"><span className="text-slate-500">나이/성별</span> <span className="font-bold text-slate-900">{selectedThread.financialProfile.age}세 / {selectedThread.financialProfile.gender === 'male' ? '남성' : selectedThread.financialProfile.gender === 'female' ? '여성' : '미기재'}</span></div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">월 소득</span> <span className="font-bold text-brand">{selectedThread.financialProfile.income}만 원</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">총 채무</span> <span className="font-bold text-red-500">{selectedThread.financialProfile.debtTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">자산합산</span> <span className="text-slate-800 font-medium">{(selectedThread.financialProfile.assetsTotal || 0).toLocaleString()}만 원</span></div>
                      {selectedThread.financialProfile.myAssets !== undefined && selectedThread.financialProfile.myAssets > 0 && (
                        <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 본인 재산</span> <span className="text-slate-700">{selectedThread.financialProfile.myAssets.toLocaleString()}만</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-slate-500">부양 가족</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.dependents}명 ({selectedThread.financialProfile.dependents + 1}인 가구)</span></div>
                      {selectedThread.financialProfile.minorChildren !== undefined && (
                        <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 미성년 자녀</span> <span className="font-semibold text-slate-800">{selectedThread.financialProfile.minorChildren}명</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-slate-500">혼인상태</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : selectedThread.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span></div>
                      
                      {selectedThread.financialProfile.specialCondition && selectedThread.financialProfile.specialCondition !== 'none' && (
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs text-emerald-700 font-bold text-center">
                          ⚡ 24개월 특례: {selectedThread.financialProfile.specialCondition === 'basic_recipient' ? '기초수급' : selectedThread.financialProfile.specialCondition === 'severe_disability' ? '중증장애' : selectedThread.financialProfile.specialCondition === 'single_parent' ? '한부모' : selectedThread.financialProfile.specialCondition === 'rent_fraud' ? '전세사기' : '고령자'}
                        </div>
                      )}

                      {selectedThread.financialProfile.jobType && (
                        <>
                          <div className="border-t border-slate-200 pt-2 flex justify-between">
                            <span className="text-slate-500">직업</span> 
                            <span className="font-bold text-slate-900">
                              {selectedThread.financialProfile.jobType === 'SALARIED' ? '급여소득' : selectedThread.financialProfile.jobType === 'BUSINESS' ? '영업소득' : selectedThread.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                              {selectedThread.financialProfile.companyName && ` (${selectedThread.financialProfile.companyName})`}
                            </span>
                          </div>
                          <div className="flex justify-between"><span className="text-slate-500">거주지역</span> <span className="text-slate-700">{selectedThread.financialProfile.residenceRegion}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">거주형태</span> <span className="text-slate-700">{selectedThread.financialProfile.housingType === 'rent' ? '월세' : selectedThread.financialProfile.housingType === 'jeonse' ? '전세' : selectedThread.financialProfile.housingType === 'owned' ? '자가' : selectedThread.financialProfile.housingType === 'free' ? '무상거주' : '-'}{selectedThread.financialProfile.housingContractHolder ? ` (${selectedThread.financialProfile.housingContractHolder === 'self' ? '본인' : selectedThread.financialProfile.housingContractHolder === 'spouse' ? '배우자' : '타인'}명의)` : ''}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">보증금</span> <span className="text-slate-700">{selectedThread.financialProfile.rentalDeposit?.toLocaleString()}만</span></div>
                          {selectedThread.financialProfile.depositLoan !== undefined && selectedThread.financialProfile.depositLoan > 0 && (
                            <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 보증금 대출</span> <span className="text-red-400">{selectedThread.financialProfile.depositLoan.toLocaleString()}만</span></div>
                          )}
                          {selectedThread.financialProfile.maritalStatus === 'MARRIED' && (
                            <>
                              <div className="flex justify-between"><span className="text-slate-500">배우자 재산</span> <span className="text-slate-700">{selectedThread.financialProfile.spouseAsset?.toLocaleString()}만</span></div>
                              {selectedThread.financialProfile.spouseIncome !== undefined && (
                                <div className="flex justify-between"><span className="text-slate-500">배우자 소득</span> <span className="text-slate-700">{selectedThread.financialProfile.spouseIncome.toLocaleString()}만</span></div>
                              )}
                            </>
                          )}
                          {selectedThread.financialProfile.maritalStatus === 'DIVORCED' && (
                            <>
                              {selectedThread.financialProfile.childSupportReceived !== undefined && selectedThread.financialProfile.childSupportReceived > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">양육비 수령</span> <span className="text-emerald-500">+{selectedThread.financialProfile.childSupportReceived.toLocaleString()}만</span></div>
                              )}
                              {selectedThread.financialProfile.childSupportPaid !== undefined && selectedThread.financialProfile.childSupportPaid > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">양육비 지급</span> <span className="text-red-400">-{selectedThread.financialProfile.childSupportPaid.toLocaleString()}만</span></div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">채무원인</span> <span className="text-slate-700">{selectedThread.financialProfile.debtCause === 'LIVING' ? '생활비' : selectedThread.financialProfile.debtCause === 'BUSINESS' ? '사업실패' : selectedThread.financialProfile.debtCause === 'INVESTMENT' ? '투자실패' : selectedThread.financialProfile.debtCause === 'GAMBLING' ? '도박' : selectedThread.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</span></div>
                          {selectedThread.financialProfile.speculativeLoss !== undefined && selectedThread.financialProfile.speculativeLoss > 0 && (
                            <div className="flex justify-between text-red-400 font-semibold"><span>투기손실</span><span>{selectedThread.financialProfile.speculativeLoss.toLocaleString()}만</span></div>
                          )}
                          {selectedThread.financialProfile.gamblingLoss !== undefined && selectedThread.financialProfile.gamblingLoss > 0 && (
                            <div className="flex justify-between text-red-400 font-semibold"><span>도박손실</span><span>{selectedThread.financialProfile.gamblingLoss.toLocaleString()}만</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">추심단계</span> <span className="text-amber-500 font-semibold">{selectedThread.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : selectedThread.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : selectedThread.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '압류'}</span></div>
                          {selectedThread.financialProfile.legalActions && selectedThread.financialProfile.legalActions.length > 0 && selectedThread.financialProfile.legalActions.some(x => x !== 'none') && (
                            <div className="flex justify-between"><span className="text-slate-500">법적조치</span><span className="text-slate-700">{selectedThread.financialProfile.legalActions.filter(x => x !== 'none').map(x => ({ collection_call: '독촉', court_order: '소장수령', seizure: '급여압류', property_seizure: '부동산압류', credit_drop: '신용하락' }[x] || x)).join(', ')}</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">채권자</span> <span className="text-slate-700">{selectedThread.financialProfile.creditorCount}곳</span></div>

                          {(selectedThread.financialProfile.rentCost || selectedThread.financialProfile.medicalCost || selectedThread.financialProfile.educationCost || selectedThread.financialProfile.monthlyFixedExpenses) && (
                            <div className="border-t border-slate-200 pt-2.5 space-y-1.5">
                              <span className="text-xs font-black text-slate-500 tracking-wide uppercase block">🏠 월 생계비</span>
                              {selectedThread.financialProfile.rentCost !== undefined && selectedThread.financialProfile.rentCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">월세</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.rentCost.toLocaleString()}만</span></div>
                              )}
                              {selectedThread.financialProfile.medicalCost !== undefined && selectedThread.financialProfile.medicalCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">의료비</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.medicalCost.toLocaleString()}만</span></div>
                              )}
                              {selectedThread.financialProfile.educationCost !== undefined && selectedThread.financialProfile.educationCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">교육비</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.educationCost.toLocaleString()}만</span></div>
                              )}
                              {selectedThread.financialProfile.specialEducationCost !== undefined && selectedThread.financialProfile.specialEducationCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">특수교육비</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.specialEducationCost.toLocaleString()}만</span></div>
                              )}
                              {selectedThread.financialProfile.monthlyFixedExpenses !== undefined && selectedThread.financialProfile.monthlyFixedExpenses > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">고정지출</span> <span className="text-slate-800 font-medium">{selectedThread.financialProfile.monthlyFixedExpenses.toLocaleString()}만</span></div>
                              )}
                            </div>
                          )}

                          {selectedThread.financialProfile.retirementPay !== undefined && selectedThread.financialProfile.retirementPay > 0 && (
                            <div className="border-t border-slate-200 pt-2.5 space-y-1.5">
                              <div className="flex justify-between"><span className="text-slate-500">퇴직금</span><span className="font-bold text-slate-900">{selectedThread.financialProfile.retirementPay.toLocaleString()}만</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">퇴직연금</span>
                                <span className={selectedThread.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-600 font-bold' : 'text-slate-700 font-medium'}>
                                  {selectedThread.financialProfile.retirementPensionType === 'pension' ? '가입 (0%반영)' : selectedThread.financialProfile.retirementPensionType === 'none' ? '미가입 (50%반영)' : '확인필요 (50%반영)'}
                                </span>
                              </div>
                              {selectedThread.financialProfile.retirementPensionType === 'unknown' && (
                                <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-xs text-amber-700 font-bold text-center">
                                  ⚠️ 퇴직연금 확인 필요
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 변제 시뮬레이션 */}
                    {(() => {
                      const profile = selectedThread.financialProfile;
                      if (!profile) return null;
                      const res = calculateRepayment({
                        address: profile.residenceRegion || '서울',
                        age: profile.age || 35,
                        employmentType: profile.jobType === 'SALARIED' ? 'salary' : profile.jobType === 'BUSINESS' ? 'business' : profile.jobType === 'DAILY' ? 'daily' : profile.jobType === 'FREELANCER' ? 'freelancer' : 'salary',
                        monthlyIncome: Math.max(0, (profile.income || 0) * 10000),
                        familySize: Math.max(1, (profile.dependents || 0) + 1),
                        spouseAssets: Math.max(0, (profile.spouseAsset || 0) * 10000),
                        totalDebt: Math.max(0, (profile.debtTotal || 0) * 10000),
                        totalAssets: Math.max(0, (profile.assetsTotal || profile.myAssets || 0) * 10000),
                        hasMortgage: false,
                        specialCondition: profile.specialCondition || 'none',
                        gamblingDebt: Math.max(0, ((profile.speculativeLoss || 0) + (profile.gamblingLoss || 0)) * 10000),
                        recentDebtRatio: 0,
                        monthlyRent: Math.max(0, (profile.rentCost || 0) * 10000),
                        monthlyMedical: Math.max(0, (profile.medicalCost || 0) * 10000),
                        monthlyEducation: Math.max(0, ((profile.educationCost || 0) + (profile.specialEducationCost || 0)) * 10000),
                        housingType: profile.housingType || 'rent',
                        rentalDeposit: Math.max(0, (profile.rentalDeposit || 0) * 10000),
                        depositLoan: Math.max(0, (profile.depositLoan || 0) * 10000),
                        childSupportReceived: Math.max(0, (profile.childSupportReceived || 0) * 10000),
                        childSupportPaid: Math.max(0, (profile.childSupportPaid || 0) * 10000),
                      });

                      const monthlyPay = Number.isFinite(res.monthlyPayment) ? Math.round(res.monthlyPayment / 10000) : 0;
                      const totalRepay = Number.isFinite(res.totalRepayment) ? Math.round(res.totalRepayment / 10000) : 0;
                      const debtReduct = Number.isFinite(res.totalDebtReduction) ? Math.round(res.totalDebtReduction / 10000) : 0;
                      const reductRate = Number.isFinite(res.debtReductionRate) ? res.debtReductionRate : 0;
                      const liqValue = Number.isFinite(res.liquidationValue) ? Math.round(res.liquidationValue / 10000) : 0;

                      return (
                        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 space-y-2 text-sm">
                          <span className="text-xs font-black text-emerald-700 tracking-wide uppercase block">💰 변제 시뮬레이션</span>
                          <div className="flex justify-between"><span className="text-slate-500">월 변제금</span> <span className="font-bold text-slate-900">{monthlyPay.toLocaleString()}만/월</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">변제 기간</span> <span className="text-slate-800 font-medium">{res.repaymentMonths || 36}개월</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">총 변제금</span> <span className="text-slate-800 font-medium">{totalRepay.toLocaleString()}만</span></div>
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>탕감액</span>
                            <span>{debtReduct.toLocaleString()}만 ({reductRate}%)</span>
                          </div>
                          <div className="flex justify-between"><span className="text-slate-500">청산가치</span> <span className="text-slate-700">{liqValue.toLocaleString()}만</span></div>
                        </div>
                      );
                    })()}

                    {/* 리스크 태그 */}
                    {selectedThread.financialProfile.riskFlags && selectedThread.financialProfile.riskFlags.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-red-500 block">⚠️ 리스크 태그</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedThread.financialProfile.riskFlags.map(rf => (
                            <span key={rf} className="bg-red-50 text-red-500 border border-red-200 text-xs px-2 py-0.5 rounded-lg font-bold">
                              {rf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 수임 전환 */}
                  <div className="border-t border-slate-200 pt-4 space-y-2.5">
                    <span className="text-sm font-black text-brand tracking-wide uppercase block">⚖️ 수임 전환</span>
                    <p className="text-slate-600 text-xs leading-relaxed font-normal">
                      위임 계약서 서명 후, 정식 사건 대장으로 등록할 수 있습니다.
                    </p>
                    <button 
                      onClick={() => handleConvertToCase(selectedThread)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all flex items-center justify-center gap-2 press-scale cursor-pointer active:scale-[0.98] shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      정식 수임사건 전환
                    </button>
                  </div>

                  {/* 내부 비망록 */}
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <span className="text-sm font-black text-brand tracking-wide uppercase block">📌 내부 비망록</span>
                    <textarea
                      rows={3}
                      placeholder="내부 메모를 작성하세요..."
                      value={internalNotes[selectedThread.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [selectedThread.id]: e.target.value };
                        setInternalNotes(nextNotes);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-800 placeholder-slate-400"
                    />
                    <span className="text-xs text-slate-400 block">
                      * 로펌 내부 전용 — 의뢰인에게 노출되지 않습니다.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                  <Info className="w-8 h-8 text-slate-300" />
                  <p className="text-xs text-slate-500">대화방 선택 시 의뢰인 정보가 표시됩니다.</p>
                </div>
              )}
            </div>

          </div>
          );
        })()}




        {/* TAB 5: BILLING & SUBSCRIPTIONS */}
        {activeTab === 'billing' && (
          <div className="space-y-8">
            {/* 서브탭 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {([
                { key: 'status' as const, label: '구독 현황' },
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
                    <div className="flex items-center gap-2">
                      <span className="bg-white/10 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-white/20">Active</span>
                      <span className="text-emerald-400 text-sm font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>정상 운영 중</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">이용 요금제 · 빌링 관리</h2>
                    <p className="text-sm text-slate-400">다음 결제 예정일: 2026년 07월 25일 (월 800,000 원)</p>
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
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-bold">SaaS 구독</span>
                      <strong className="text-2xl font-black text-white block mt-1 tracking-tight tabular-nums">80만</strong>
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
                    <div className="bg-gradient-to-br from-[#0F2440] via-[#163152] to-[#1E3A5F] p-6 text-white relative overflow-hidden">
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
                          <span className="text-[11px] text-slate-300 mt-1 block font-medium">{product.maxSlots - (product.usedSlots || 0)}구좌 남음</span>
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

            {(billingSub === 'status') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Zap className="w-6 h-6 text-slate-700" />
                <h3 className="font-extrabold text-xl text-slate-900">SaaS CRM 요금제</h3>
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full">월 정액 구독</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {platformPlans.map((plan, idx) => (
                  <div key={idx} className={`bg-white rounded-2xl p-6 flex flex-col justify-between gap-5 relative transition-all hover:shadow-md shadow-xs ${plan.popular ? 'border-2 border-[#1E3A5F]' : 'border border-slate-200/80'}`}>
                    {plan.popular && (<span className="absolute -top-3 left-4 bg-[#1E3A5F] text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-xs">가장 많은 로펌 선택</span>)}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                        <p className="text-slate-500 text-xs mt-0.5">월 정액 구독 · 수임료 과세 중계 불가 원칙 준수</p>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{plan.price}</div>
                      <ul className="text-sm space-y-2.5 text-slate-700">
                        {plan.features.map((feat, i) => (<li key={i} className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" /><span className="leading-tight">{feat}</span></li>))}
                      </ul>
                    </div>
                    <button className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${plan.name === 'Pro' ? 'bg-[#1E3A5F] hover:bg-[#163152] text-white shadow-xs active:scale-[0.98]' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 active:scale-[0.98]'}`}>{plan.name === 'Pro' ? '✅ 현재 이용 중' : '요금제 업그레이드 문의'}</button>
                  </div>
                ))}
              </div>
            </div>

            )}

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
                          <button onClick={() => { if (!adModalDepositor.trim()) return; if (adModalProduct.id === 'ad-regional-top' && !adModalRegion) return; const disc = adModalProduct.discounts.find((d: any) => d.months === adModalMonths); const mp = disc ? parseInt(disc.price.replace(/[^0-9]/g, '')) * 10000 : adModalProduct.price; const newOrder: AdOrder = { id: `ado-${Date.now()}`, lawyerId: activeLawyer.id, lawyerName: activeLawyer.name, productId: adModalProduct.id, productName: adModalProduct.name, contractMonths: adModalMonths, monthlyPrice: mp, totalPrice: mp * adModalMonths, status: 'pending', requestedAt: new Date().toISOString(), depositorName: adModalDepositor, region: adModalRegion || undefined }; setAdOrders(prev => [newOrder, ...prev]); setAdModalStep('done'); }} disabled={!adModalDepositor.trim() || (adModalProduct.id === 'ad-regional-top' && !adModalRegion)} className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer bg-[#1E3A5F] hover:bg-[#163152] text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed">신청 완료</button>
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
                        <button onClick={async () => { setBizCheckResult('확인 중...'); const r = await checkCorpNum(bizForm.corpNum); setBizCheckResult(r.ok ? '✅ 정상 사업자' : `❌ ${r.error}`); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer">확인</button>
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
                      <button onClick={() => { setBizForm({corpNum: bizInfo.corpNum, corpName: bizInfo.corpName, ceoName: bizInfo.ceoName, bizType: bizInfo.bizType, bizClass: bizInfo.bizClass, addr: bizInfo.addr, taxEmail: bizInfo.taxEmail}); setBizFormOpen(true); }} className="text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer">수정</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500">사업자번호</span> <span className="font-bold text-slate-900 ml-1.5">{formatCorpNum(bizInfo.corpNum)}</span></div>
                      <div><span className="text-slate-500">상호</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.corpName}</span></div>
                      <div><span className="text-slate-500">대표자</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.ceoName}</span></div>
                      <div><span className="text-slate-500">이메일</span> <span className="font-bold text-slate-900 ml-1.5">{bizInfo.taxEmail}</span></div>
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
                      <div className="space-y-2.5">
                        {adOrders.filter(o => o.taxInvoice).map(order => (
                          <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-900">{order.productName}</p>
                              <p className="text-xs text-slate-500 font-medium">{order.taxInvoice?.issuedAt ? new Date(order.taxInvoice.issuedAt).toLocaleDateString('ko-KR') : ''}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm font-black text-slate-900 tracking-tight tabular-nums">{order.taxInvoice?.totalAmount.toLocaleString()}원</p>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">발행완료</span>
                            </div>
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


        {/* TAB 6: CLIENT CRM (고객 관리) — CrmTab 컴포넌트 */}
        {activeTab === 'client-crm' && (
          <CrmTab
            requests={requests}
            lawyers={lawyers}
            activeLawyer={activeLawyer}
            setRequests={setRequests}
            getDisplayPhoneNumber={getDisplayPhoneNumber}
            handleOpenProposalDraft={handleOpenProposalDraft}
            setActiveTab={setActiveTab}
            setCopilotPreselectedReqId={setCopilotPreselectedReqId}
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
            onSendProposal={(proposalData) => {
              handleSubmitProposalFromDraft(proposalModalReqId, proposalData);
            }}
            onRequestConfirm={(proposalData, memo) => {
              handleRequestProposalConfirm(proposalModalReqId, proposalData, memo);
            }}
            aiAnalysis={undefined}
            isAIPremiumEnabled={!!activeLawyer.aiCaseAnalysisEnabled}
            lawyerInfo={{
              name: activeLawyer.name,
              firmName: activeLawyer.firmName,
              avatar: activeLawyer.avatarData || activeLawyer.avatar
            }}
          />
        )}

        {/* TAB: CASE REVIEW COPILOT (사건검토 코파일럿) */}
        {activeTab === 'case-copilot' && (
          activeLawyer.aiCaseAnalysisEnabled ? (
            <CaseReviewCopilot
              consultRequests={requests}
              tenantId={activeLawyer.lawFirmId || activeLawyer.id}
              actorId={activeStaffMember?.id || activeLawyer.id}
              actorRole={activeStaffMember?.role || 'OWNER'}
              actorName={activeStaffMember?.name || activeLawyer.name}
              preselectedRequestId={copilotPreselectedReqId}
              onProposalSent={(reqId: string, proposalData: any) => {
                handleSubmitProposalFromDraft(reqId, proposalData);
              }}
            />
          ) : (
            <AICaseAnalysisLocked
              onContactAdmin={() => setActiveTab('inquiry-to-admin')}
            />
          )
        )}

        {/* TAB: STAFF MANAGEMENT */}
        {activeTab === 'staff-management' && (
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
              tenantId={activeLawyer.lawFirmId || activeLawyer.id}
              userId={activeStaffMember?.id || activeLawyer.id}
              userName={activeStaffMember?.name || activeLawyer.name}
              userRole={activeStaffMember?.role || 'OWNER'}
              requests={requests}
              cases={cases}
              qas={qas}
              activeLawyerId={activeLawyer.id}
              staffMembers={staffMembers}
              lawyers={lawyers}
            />
          </div>
        )}

        {/* TAB: 전자 계약 */}
        {activeTab === 'contracts' && (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full" /></div>}>
            <ContractManagementTab lawyerName={activeLawyer.name} lawFirmName={activeLawyer.lawFirmName || '법무법인'} />
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
            {/* 1단: 4대 스마트 카테고리 탭 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {[
                { key: 'profile' as const, label: '👤 프로필 & 브랜딩', defaultSub: 'profile-edit' },
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

            {/* 2단: 카테고리별 서브 세그먼트 (서브탭이 2개 이상일 때 노출) */}
            {settingsCategory === 'profile' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'profile-edit', label: '✏️ 내 프로필 편집' },
                  { key: 'consult-style', label: '💬 AI 및 상담 스타일 프로필' },
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
                  ...(isLawyerOrOwner && staffRole === 'OWNER' ? [{ key: 'data-backup', label: '🔒 데이터 백업 및 복원' }] : []),
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
            {settingsSub === 'profile-edit' && (
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
                    toast.success('프로필이 저장되었습니다');
                  }}
                  onClose={() => setSettingsSub('notices')}
                  inline={true}
                />
              </div>
            )}

            {/* AI 상담 스타일 프로필 */}
            {settingsSub === 'consult-style' && (
              <div>
                <ConsultStyleProfile
                  tenantId={activeLawyer.lawFirmId || activeLawyer.id}
                  actorId={activeLawyer.id}
                  actorName={activeLawyer.name}
                />
              </div>
            )}

            {/* 공지 사항 탭 */}
            {settingsSub === 'notices' && (() => {
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

              {/* 보안 설정: 비밀번호 변경 */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs md:text-sm text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-brand" />
                    <span>계정 비밀번호 보안</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      showPasswordChange ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/20'
                    }`}
                  >
                    {showPasswordChange ? '접기' : '비밀번호 변경'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 text-left">
                  변호사 계정의 로그인 비밀번호를 안전하게 변경합니다.
                </p>
                {showPasswordChange && (
                  <div className="space-y-2 border-t border-slate-100 pt-2.5">
                    <div>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="새 비밀번호 확인"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      className="w-full bg-brand hover:bg-brand-hover text-white py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                    >
                      비밀번호 변경 저장
                    </button>
                  </div>
                )}
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
                      <span className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">🔔 브라우저 Push</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${notifSettings.browserPush.enabled ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {notifSettings.browserPush.enabled ? '🟢 허용됨' : '⚪ 미허용'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">데스크탑 브라우저 알림으로 즉시 팝업</p>
                  </div>
                  <div className="pt-3">
                    <button onClick={async () => {
                      const perm = await requestBrowserPushPermission();
                      if (perm === 'granted') {
                        const updated = { ...notifSettings, browserPush: { enabled: true, permission: 'granted' } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        sendBrowserPushNotification('🔔 알림 테스트', '브라우저 Push 알림이 활성화되었습니다!');
                        setNotifLogs(loadNotificationLogs());
                      } else {
                        toast.error('브라우저 알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
                      }
                    }}
                      className="w-full py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {notifSettings.browserPush.enabled ? '🔔 테스트 알림' : '🔔 권한 허용하기'}
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
                                                toast.info('플랫폼의 고객 관리(CRM) 탭으로 이동하여 의뢰인 상세 명세를 조회합니다.');
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
          viewerRole={isLawyerOrOwner ? 'lawyer' : 'staff'}
          onSendProposal={(proposalData) => {
            handleSubmitProposalFromDraft(proposalModalReqId, proposalData);
          }}
          onRequestConfirm={(proposalData, memo) => {
            handleRequestProposalConfirm(proposalModalReqId, proposalData, memo);
          }}
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
          <GlobalSearchPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} requests={requests} lawyers={lawyers} onNavigate={(tab) => { setActiveTab(tab as any); setIsSearchOpen(false); }} />
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

    </div>
    </div>
  );
}
