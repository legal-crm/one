import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Briefcase, BarChart2, Shield, MessageSquare, ListCheck, FolderHeart, 
  Clock, Plus, Trash2, Send, Save, CreditCard, ChevronRight, CheckCircle2, Check, ExternalLink,
  Users, LogOut, Lock, Settings, MapPin, Bell, Smartphone, FileText, Eye, Megaphone, Info, Tag, TrendingUp, ChevronDown, ChevronUp, Zap, AlertTriangle, Receipt, Microscope, Trophy, Calendar, Target, MessageCircle, ArrowRight, UserCheck, UserX, CalendarCheck
} from 'lucide-react';
import { 
  ConsultRequest, User, ConsultMessage, Case, CaseStatus, ConsultStatus, Member, ActivityLog, MemberRole, PlatformConfig, AdOrder, ClientQA, PopupConfig, LawyerInquiry 
} from '../types';
import { platformPlans, adProducts, mockLawyers, mockAdOrders, BANK_ACCOUNT_INFO } from '../data';
import { ChatDisclaimer } from './Disclaimers';
import { calculateRepayment, RehabUserInput, type RehabCalculationResult } from '../rehab-chatbot-package/services/calculationService';
import LawyerProposalDraft from './lawyer/LawyerProposalDraft';
import { mapToRehabUserInput } from './lawyer/mapToRehabUserInput';
import CrmTab from './lawyer/CrmTab';
import CaseReviewCopilot from './lawyer/CaseReviewCopilot';
import ClientOriginalInfo from './lawyer/ClientOriginalInfo';
import RequestWorkflowPanel from './lawyer/RequestWorkflowPanel';
import RequestTimeline from './lawyer/RequestTimeline';
import NotificationBell from './lawyer/NotificationBell';
import MyTasksWidget from './lawyer/MyTasksWidget';
import TasksScheduleTab from './lawyer/TasksScheduleTab';
import StaffManagementTab from './lawyer/StaffManagementTab';
import LawyerQnAAnswerSection from './lawyer/LawyerQnAAnswerSection';
import RehabSettingsPanel from './RehabSettingsPanel';
import { usePermissions } from '../hooks/usePermissions';
import type { StaffMember, StaffRole as StaffRoleType } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';
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

const getDisplayPhoneNumber = (req: ConsultRequest): string => {
  if (req.phoneConsultationRequested) {
    if (req.safeNumber) {
      const now = Date.now();
      const expires = req.safeNumberExpiresAt ? new Date(req.safeNumberExpiresAt).getTime() : 0;
      if (now > expires) {
        return "050 안심번호 만료됨 (72시간 초과)";
      }
      return `${req.safeNumber} (050 안심번호)`;
    }
    return `${req.phone} (일반 번호)`;
  }
  return "050 미배정 (전화 상담 요청 시 자동 연동)";
};

interface LawyerRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string) => void;
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
  setLawyerInquiries
}: LawyerRoleProps) {
  // Lawyer sub navigation inside legal CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'open-requests' | 'chat' | 'cases' | 'billing' | 'client-crm' | 'case-copilot' | 'staff-management' | 'settings' | 'qna-answer' | 'tasks-schedule' | 'inquiry-to-admin'>('dashboard');
  const [dashboardSub, setDashboardSub] = useState<'overview' | 'requests' | 'activity'>('overview');
  const [billingSub, setBillingSub] = useState<'status' | 'products' | 'orders' | 'business'>('status');
  const [casesSub, setCasesSub] = useState<'kanban' | 'active' | 'closed'>('kanban');
  const [settingsSub, setSettingsSub] = useState<'channels' | 'logs' | 'profile' | 'calc-rules'>('channels');
  const [copilotPreselectedReqId, setCopilotPreselectedReqId] = useState<string | undefined>();
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

  
  // Mobile UI navigation controls
  const [mobilePane, setMobilePane] = useState<'threads' | 'chat' | 'crm'>('threads');
  const [mobileStageFilter, setMobileStageFilter] = useState<'document' | 'filing' | 'commencement' | 'approval' | 'discharge'>('document');

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('legal_crm_lawyer_session') !== null;
  });
  const [activeLawyer, setActiveLawyer] = useState<User>(() => {
    const sessionLawyerId = sessionStorage.getItem('legal_crm_lawyer_session');
    if (sessionLawyerId) {
      return mockLawyers[0];
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
          alert(msg);
          sessionStorage.removeItem('legal_crm_lawyer_session');
          setIsLoggedIn(false);
        } else if (currentMember.status === 'dormant') {
          if (confirm('휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?')) {
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
        }
      }
    }
  }, [isLoggedIn, activeLawyer, members]);

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
          alert(result.error || '유효하지 않은 초대 링크입니다.');
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
  const [signupAvatar, setSignupAvatar] = useState<string>('https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256');
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
      alert('파일 크기가 5MB를 초과합니다. 더 작은 파일을 선택해주세요.');
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
      alert('프로필 사진은 2MB 이하로 올려주세요.');
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
      alert('텔레그램 봇이 활성화되어 있지 않습니다.');
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
    alert('텔레그램 보안 테스트 알림이 발송되었습니다! 우측 텔레그램 시뮬레이터 창을 확인하세요.');
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

    alert(`[다시시작 CRM 연동] ${activeLawyer.name} 님이 담당 변호사로 지정되었습니다. 의뢰인 CRM 탭에서 소명 분석을 개시할 수 있습니다.`);
  };

  // Auth logic
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('이메일(ID)과 비밀번호를 입력해주세요.');
      return;
    }

    const cleanedLoginId = loginId.trim().toLowerCase();
    
    // Quick simple login bypass for testing
    let found = null;
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
    } else {
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

    // Bypass password check for simple bypass accounts (1~7)
    const bypassIds = ['1', '2', '3', '4', '5', '6', '7'];
    if (!bypassIds.includes(cleanedLoginId) && found.password && found.password !== loginPassword) {
      setLoginError('비밀번호가 일치하지 않습니다.');
      return;
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
        if (confirm('휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?')) {
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

    alert('회원가입이 완료되었습니다!\n\n관리자가 변호사 등록증을 확인한 후 승인 처리됩니다.\n승인 완료 후 로그인이 가능합니다.');
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

  // Google OAuth 콜백 처리 (리다이렉트 후 세션 매핑)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        const email = user.email || '';
        const provider = user.app_metadata?.provider || 'email';
        
        // 기존 변호사 계정과 매칭 시도
        const matchedLawyer = lawyers.find(l => 
          l.id.toLowerCase() === email.toLowerCase() ||
          l.name.toLowerCase().includes(email.split('@')[0].toLowerCase())
        );
        
        if (matchedLawyer) {
          sessionStorage.setItem('legal_crm_lawyer_session', matchedLawyer.id);
          setActiveLawyer(matchedLawyer);
          setIsLoggedIn(true);
        } else {
          // 신규 Google 사용자 — StaffMember로 등록
          try {
            const { saveStaffMember: saveSM } = await import('../services/crmService');
            const newStaff: StaffMember = {
              id: `staff-google-${Date.now()}`,
              name: user.user_metadata?.full_name || email.split('@')[0],
              role: 'CONSULTANT' as StaffRoleType,
              email: email,
              avatar: user.user_metadata?.avatar_url,
              isActive: false,
              assignedCount: 0,
              createdAt: new Date().toISOString(),
              permissions: DEFAULT_PERMISSIONS['CONSULTANT'],
              status: 'pending',
              authEmail: email,
              authProvider: provider === 'google' ? 'google' : 'email',
              supabaseUserId: user.id,
            };
            await saveSM(newStaff);
          } catch (err) {
            console.warn('[OAuth] StaffMember 생성 실패:', err);
          }
          alert('Google 계정으로 가입되었습니다.\n관리자 승인 후 로그인이 가능합니다.');
        }
      }
    });
    return () => { listener?.subscription?.unsubscribe(); };
  }, [lawyers]);

  // 비밀번호 변경 상태
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      alert('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 4) {
      alert('비밀번호는 4자리 이상으로 설정해주세요.');
      return;
    }
    
    // 현재 비밀번호 확인
    if (activeLawyer.password && activeLawyer.password !== currentPassword) {
      alert('현재 비밀번호가 일치하지 않습니다.');
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

    alert('비밀번호가 성공적으로 변경되었습니다.');
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
      alert('소속 명칭을 입력해주세요.');
      return;
    }

    setLawyers(prev => prev.map(l => 
      l.id === activeLawyer.id ? { ...l, firmName: trimmed } : l
    ));
    setActiveLawyer(prev => ({ ...prev, firmName: trimmed }));

    alert('소속 법률사무소/법인 명칭이 저장되었습니다.');
    onLogActivity(activeLawyer.id, activeLawyer.name, activeLawyer.role as MemberRole, 'SETTINGS', `소속 명칭 설정 변경: ${trimmed}`);
  };

  // Google OAuth 로그인
  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      alert('Google 로그인을 사용하려면 Supabase 설정이 필요합니다.\n.env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '?role=lawyer'
        }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`Google 로그인 실패: ${err.message || err}`);
    }
  };

  // 비밀번호 찾기
  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      alert('비밀번호를 재설정할 이메일 주소를 입력해주세요.');
      return;
    }
    if (!isSupabaseConfigured) {
      alert('비밀번호 재설정은 Supabase 설정이 필요합니다.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: window.location.origin + '?role=lawyer'
      });
      if (error) throw error;
      alert('비밀번호 재설정 링크가 이메일로 발송되었습니다.\n이메일을 확인해주세요.');
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (err: any) {
      alert(`비밀번호 재설정 실패: ${err.message || err}`);
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      sessionStorage.removeItem('legal_crm_lawyer_session');
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
    alert('의뢰인 기본 인적 정보가 성공적으로 업데이트되었습니다.');
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
    alert('상담 세션 배정 및 상태가 성공적으로 저장되었습니다.');
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

  const handleDeleteCrmNote = (idxToDelete: number) => {
    if (!crmSelectedId) return;
    setInternalNotes(prev => {
      const notesArray = prev[crmSelectedId] ? prev[crmSelectedId].split('\n').filter(Boolean) : [];
      const updatedArray = notesArray.filter((_, idx) => idx !== idxToDelete);
      return { ...prev, [crmSelectedId]: updatedArray.join('\n') };
    });
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

  // 솔루션 및 비용 제안 버튼 클릭 시 자동 계산 후 팝업 열기
  const handleOpenProposalDraft = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    const rehabInput = mapToRehabUserInput(req);
    const rehabResult = calculateRepayment(rehabInput);

    setProposalRehabResult(rehabResult);
    setProposalRehabInput(rehabInput);
    setProposalConsultRequest(req);
    setProposalModalReqId(reqId);
  };

  // LawyerProposalDraft에서 제안서 발송 시 기존 데이터 플로우 유지 + 채팅 연동
  const handleSubmitProposalFromDraft = (reqId: string, proposalData: any) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

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
      createdAt: new Date().toISOString()
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
    const proposalMsg = `안녕하세요, ${req.clientName}님. ${activeLawyer.name} 변호사입니다.\n\n📋 제안 내용을 안내드립니다:\n• 예상 탕감률: ${reductionText}\n• 월 변제금: ${monthlyText}\n• 수임료: ${feeText}\n\n${proposalData.lawyerOpinion ? `💬 소견: ${proposalData.lawyerOpinion}` : ''}자세한 사항은 편하게 문의해 주세요.`;

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
      `의뢰인에게 제안서 발송 (수임료: ${Math.round(proposalData.fees.totalFee / 10000)}만원, 예상 탕감률: ${proposalData.diagnosis.debtReductionRate}%)`
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
  }>>([]);
  const [reviewModalProposal, setReviewModalProposal] = useState<typeof pendingProposals[0] | null>(null);

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
      clientName: req.clientName || req.client_name || '고객',
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

  // Turn active request into an formal Case (수임 완료)
  const handleConvertToCase = (req: ConsultRequest) => {
    const isAlreadyCase = cases.some(c => c.clientId === req.clientId);
    if (isAlreadyCase) {
      toast.error('이미 정식 수임 사건으로 등록된 고객입니다.');
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
    toast.success(`${req.clientName} 의뢰인이 정식 사건으로 수임 등록되었습니다.`);
    setActiveTab('client-crm');
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
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="my김변 로고" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-slate-900">{(platformConfig.siteLogoText || "my김변")} 변호사 CRM</span>
            </div>
            <p className="text-slate-600 text-xs">도산 전문 법률 대리인 통합 솔루션</p>
          </div>

          {authMode === 'login' ? (
            <div className="space-y-4 text-left">
              <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">로그인</h3>

              {/* 초대 링크 배너 */}
              {inviteToken && inviteTokenValid && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span><strong>초대 링크가 확인되었습니다!</strong> 아래에서 회원가입을 완료해주세요. 역할: {inviteTokenRole === 'LAWYER' ? '담당 변호사' : inviteTokenRole === 'CONSULTANT' ? '상담 직원' : inviteTokenRole === 'STAFF' ? '사무 직원' : '경리 직원'}</span>
                </div>
              )}

              {/* Google 로그인 */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm text-base cursor-pointer active:scale-[0.98]"
              >
                <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span>
                <span>Google 계정으로 로그인</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-xs font-bold">또는 이메일로 로그인</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3.5 rounded-xl font-medium">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-700 block font-bold">아이디 (이름 또는 ID)</label>
                  <input 
                    type="text" 
                    placeholder="예: 1 또는 김우진 또는 lawyer-1"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-700 block font-bold">비밀번호</label>
                  <input 
                    type="password" 
                    placeholder="비밀번호 입력 (기본: 1)"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400"
                  />
                </div>

                {/* Quick test login info */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-sm text-slate-700 space-y-1.5 leading-relaxed font-normal">
                  <span className="font-bold text-slate-800 block text-sm">🔑 테스트 로그인 계정 정보</span>
                  <div>• 아이디: <strong className="text-slate-900 font-bold">1</strong> / 비밀번호: <strong className="text-slate-900 font-bold">1</strong></div>
                  <div>• (또는 변호사명: <strong className="text-slate-800 font-bold">김우진</strong> / 비밀번호: <strong className="text-slate-800 font-bold">1234</strong>)</div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button 
                    type="submit"
                    className="flex-1 bg-brand hover:bg-brand-hover text-white font-extrabold py-3.5 rounded-xl text-base transition-all shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    로그인
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const demoLawyer = lawyers.find(l => l.id === 'lawyer-1') || lawyers[0] || mockLawyers[0];
                      sessionStorage.setItem('legal_crm_lawyer_session', demoLawyer.id);
                      setActiveLawyer(demoLawyer);
                      setIsLoggedIn(true);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-brand font-extrabold py-3.5 rounded-xl text-base border border-slate-200 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    테스트 계정 1초 로그인
                  </button>
                </div>
              </form>

              {/* 비밀번호 찾기 */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(!showPasswordReset)}
                  className="text-sm text-slate-500 hover:text-brand transition-colors font-medium cursor-pointer"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              {showPasswordReset && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <p className="text-sm text-slate-600 leading-relaxed">가입 시 사용한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="이메일 주소 입력"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                  >
                    비밀번호 재설정 링크 발송
                  </button>
                </div>
              )}

              <div className="text-center pt-2 text-sm text-slate-600">
                계정이 없으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('signup')}
                  className="text-brand font-bold hover:underline cursor-pointer"
                >
                  회원가입하기
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-left max-h-[450px] overflow-y-auto pr-1 scrollbar-hide">
              <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-200 pb-2.5">대리인 회원가입</h3>
              {signupError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl font-medium">
                  {signupError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700 block font-bold">아이디 (ID)*</label>
                  <input 
                    type="text" 
                    placeholder="예: lawyer-kim"
                    value={signupId}
                    onChange={(e) => setSignupId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700 block font-bold">비밀번호*</label>
                  <input 
                    type="password" 
                    placeholder="비밀번호 입력"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700 block font-bold">이름 (성명)*</label>
                  <input 
                    type="text" 
                    placeholder="예: 홍길동"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700 block font-bold">역할 구분*</label>
                  <select 
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as 'LAWYER' | 'STAFF')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  >
                    <option value="LAWYER">변호사 (LAWYER)</option>
                    <option value="STAFF">실장/사무장 (STAFF)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 block font-bold">전문분야 (쉼표로 구분)</label>
                <input 
                  type="text" 
                  placeholder="예: 개인회생, 개인파산, 보정명령대응"
                  onChange={(e) => setSignupFields(e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 block font-bold">활동 지역</label>
                <input 
                  type="text" 
                  placeholder="예: 서울, 경기/수원, 부산"
                  value={signupRegion}
                  onChange={(e) => setSignupRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 block font-bold">프로필 사진 업로드</label>
                <div className="flex items-center gap-3">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="프로필 미리보기" className="w-14 h-14 rounded-xl object-cover border border-brand/30 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-xs shrink-0 border border-slate-200 font-bold">사진</div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-3 text-sm text-slate-600 text-center hover:border-brand/50 transition-colors font-medium">
                      📷 클릭하여 프로필 사진 선택
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 변호사 등록증 첨부 (핵심 자격 증빙) */}
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <label className="text-sm text-amber-800 block font-bold">📋 변호사 등록증 첨부 (필수 자격 증빙)*</label>
                <p className="text-sm text-slate-600 leading-relaxed">관리자가 등록증을 확인한 후 계정이 승인됩니다. 이미지 또는 PDF 파일을 첨부해주세요.</p>
                <label className="block cursor-pointer">
                  <div className={`border ${licensePreview ? 'border-emerald-300' : 'border-slate-200 border-dashed'} rounded-xl p-3 text-sm text-center transition-colors hover:border-brand/50 bg-white`}>
                    {licensePreview ? (
                      <div className="space-y-2">
                        <img src={licensePreview} alt="등록증 미리보기" className="max-h-32 mx-auto rounded-lg object-contain" />
                        <span className="text-emerald-600 text-xs font-bold">✅ 파일 첨부 완료 — 다시 선택하려면 클릭</span>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-medium">📎 클릭하여 변호사 등록증 이미지 첨부 (최대 5MB)</span>
                    )}
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleLicenseFileChange} className="hidden" />
                </label>
                <div className="space-y-1.5 pt-1">
                  <label className="text-sm text-slate-700 block font-bold">변호사 등록번호</label>
                  <input
                    type="text"
                    placeholder="예: 12345"
                    value={signupLicenseNumber}
                    onChange={(e) => setSignupLicenseNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 block font-bold">소개 약력(Bio)</label>
                <textarea 
                  rows={2}
                  placeholder="전문 대리인으로서의 약력 및 인사말을 작성하세요."
                  value={signupBio}
                  onChange={(e) => setSignupBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-white font-extrabold py-3.5 rounded-xl text-base transition-all shadow-md mt-2 cursor-pointer active:scale-[0.98]"
              >
                신규 대리인 등록 완료
              </button>
              <div className="text-center pt-2 text-sm text-slate-600">
                이미 계정이 있으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('login')}
                  className="text-brand font-bold hover:underline cursor-pointer"
                >
                  로그인하기
                </button>
              </div>
            </form>
          )}

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
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-fadeIn">
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
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
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
                  <button onClick={() => { setShowServiceGuide(false); setAuthMode('signup'); }} className="bg-brand hover:bg-brand-hover text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-brand/30">
                    지금 무료로 시작하기
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
                    { icon: '📞', title: '050 안심번호', desc: '의뢰인 개인정보 보호를 위한 가상 전화번호 자동 발급' }
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
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                <p className="text-sm text-slate-400">가입비 0원, 월정액 0원. AI가 정리한 의뢰인 데이터로 더 효율적인 수임을 경험하세요.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => { setShowServiceGuide(false); setAuthMode('signup'); }} className="bg-brand hover:bg-brand-hover text-white font-bold px-10 py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand/30">
                    무료 회원가입
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

  if (isLoggedIn && activeLawyer.approved === false) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
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
            <p>안녕하세요, <strong>{activeLawyer.name}</strong> 님.</p>
            <p>현재 계정 자격 확인 및 정식 소속 승인 절차가 진행 중입니다.</p>
            <p>{platformConfig.siteLogoText || "my김변"} 플랫폼은 변호사법 제34조 정식 변호사 자격 검증 의무에 따라, 관리자의 수동 라이선스 검토를 거쳐 활동을 승인하고 있습니다.</p>
            <p className="text-[13px] text-slate-600">* 어드민 페이지(Admin Portal)에서 본 계정의 승인 처리를 하실 수 있습니다.</p>
          </div>

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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white">
      <div className="w-full min-h-screen flex flex-col relative">
      
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
                  setActiveTab('open-requests');
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

          {/* ── Sidebar (Desktop/Tablet) — 고정 사이드바 ── */}
          <aside className="hidden lg:flex w-64 bg-[#111827] flex-col shrink-0 fixed top-16 left-0 bottom-0 overflow-y-auto z-30 border-r border-slate-800">
            <nav className="flex-1 py-4 px-3.5 space-y-1.5">
              {/* 그룹 1: 업무 */}
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3.5 pb-1 pt-2">업무</p>
              {permissionCtx.canAccessTab('dashboard') && (
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <BarChart2 className="w-5 h-5 shrink-0" /><span>종합 대시보드</span>
                </button>
              )}
              {permissionCtx.canAccessTab('open-requests') && (
                <button onClick={() => setActiveTab('open-requests')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'open-requests' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <Briefcase className="w-5 h-5 shrink-0" /><span>신규 상담 요청</span>
                  {totalOpenRequestsCount > 0 && (<span className="ml-auto bg-rose-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">{totalOpenRequestsCount}</span>)}
                </button>
              )}
              <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'chat' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                <MessageSquare className="w-5 h-5 shrink-0" /><span>상담 채팅</span>
                {(() => { const c = requests.filter(r => (r.status === 'comparing' || r.status === 'counseling') && ((r.acceptedLawyerIds || []).includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id)).length; return c > 0 ? (<span className="ml-auto bg-slate-700 text-slate-200 rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">{c}</span>) : null; })()}
              </button>
              {permissionCtx.canAccessTab('client-crm') && (
                <button onClick={() => setActiveTab('client-crm')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'client-crm' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <Users className="w-5 h-5 shrink-0" /><span>고객 관리 (CRM)</span>
                  <span className="ml-auto text-xs text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-md">{requests.length}</span>
                </button>
              )}
              <button onClick={() => setActiveTab('tasks-schedule')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'tasks-schedule' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                <CalendarCheck className="w-5 h-5 shrink-0" /><span>일정 / 할일</span>
              </button>

              {/* 그룹 2: AI 도구 */}
              <div className="pt-3 pb-1"><div className="border-t border-slate-800" /></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3.5 pb-1 pt-1">AI 도구</p>
              {permissionCtx.canAccessTab('case-copilot') && (
                <button onClick={() => setActiveTab('case-copilot')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'case-copilot' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <Microscope className="w-5 h-5 shrink-0" /><span>AI 사건 분석</span>
                {(() => { const n = requests.filter(r => r.status === 'requested' || r.status === 'responding').length; return n > 0 ? (<span className="ml-auto bg-slate-700 text-slate-200 rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">{n}</span>) : null; })()}
                </button>
              )}
              <button onClick={() => setActiveTab('qna-answer')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all relative cursor-pointer ${activeTab === 'qna-answer' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                <ListCheck className="w-5 h-5 shrink-0" /><span>고민상담 Q&A</span>
                {qas && (() => { const w = qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length; return w > 0 ? (<span className="ml-auto bg-rose-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold shadow-sm">{w}</span>) : null; })()}
              </button>

              {/* 그룹 3: 관리 */}
              <div className="pt-3 pb-1"><div className="border-t border-slate-800" /></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3.5 pb-1 pt-1">관리</p>
              {permissionCtx.canAccessTab('billing') && (
                <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'billing' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <CreditCard className="w-5 h-5 shrink-0" /><span>요금제 / 빌링</span>
                </button>
              )}
              {permissionCtx.canAccessTab('staff-management') && (
                <button onClick={() => setActiveTab('staff-management')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all relative cursor-pointer ${activeTab === 'staff-management' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <Shield className="w-5 h-5 shrink-0" /><span>직원 관리</span>
                  {(() => { const p = staffMembers.filter(m => m.status === 'pending').length; return p > 0 ? (<span className="ml-auto bg-rose-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold">{p}</span>) : null; })()}
                </button>
              )}
              <button onClick={() => setActiveTab('inquiry-to-admin')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'inquiry-to-admin' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                <MessageCircle className="w-5 h-5 shrink-0" /><span>마이김변 문의</span>
              </button>
              {permissionCtx.canAccessTab('settings') && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-white/10 text-white font-bold border-l-4 border-blue-400 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent font-medium'}`}>
                  <Settings className="w-5 h-5 shrink-0" /><span>알림 및 설정</span>
                </button>
              )}
            </nav>

            {/* 사이드바 하단: 로그아웃 + 버전 */}
            <div className="px-3.5 py-4 border-t border-slate-800 space-y-2">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] text-slate-300 hover:bg-white/5 hover:text-white transition-all font-bold cursor-pointer"
              >
                <LogOut className="w-5 h-5 shrink-0" /><span>로그아웃</span>
              </button>
              <p className="text-xs text-slate-400 px-3.5 font-medium">v2.6.0</p>
            </div>
          </aside>

          {/* ── Main Content Area ── */}
          <main className="flex-1 overflow-y-auto bg-[#F8FAFC] px-4 lg:px-8 py-6 lg:ml-64 pb-20 lg:pb-8">

          {/* ── Mobile Bottom Tab Bar ── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-lg">
            <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <BarChart2 className="w-5 h-5" /><span className="text-xs font-bold">대시보드</span>
            </button>
            <button onClick={() => setActiveTab('open-requests')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors relative cursor-pointer ${activeTab === 'open-requests' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Briefcase className="w-5 h-5" /><span className="text-xs font-bold">신규요청</span>
              {totalOpenRequestsCount > 0 && (<span className="absolute -top-0.5 right-1 bg-red-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-xs font-bold">{totalOpenRequestsCount}</span>)}
            </button>
            <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'chat' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <MessageSquare className="w-5 h-5" /><span className="text-xs font-bold">채팅</span>
            </button>
            <button onClick={() => setActiveTab('client-crm')} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${activeTab === 'client-crm' ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Users className="w-5 h-5" /><span className="text-xs font-bold">CRM</span>
            </button>
            <button onClick={() => { /* Toggle more menu */ const tabs: Array<typeof activeTab> = ['cases','tasks-schedule','billing','case-copilot','qna-answer','staff-management','settings']; const curr = tabs.indexOf(activeTab as any); setActiveTab(tabs[curr >= 0 ? (curr + 1) % tabs.length : 0]); }} className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${!['dashboard','open-requests','chat','client-crm'].includes(activeTab) ? 'text-brand font-bold' : 'text-slate-500 font-medium'}`}>
              <Settings className="w-5 h-5" /><span className="text-xs font-bold">더보기</span>
            </button>
          </div>

        {/* TAB 1: LAWYER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* 서브탭 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {([
                { key: 'overview' as const, label: '전체 현황' },
                { key: 'activity' as const, label: '활동 분석' },
              ]).map(t => (
                <button key={t.key} onClick={() => setDashboardSub(t.key)} className={`px-5 py-2.5 rounded-lg text-[15px] font-bold transition-all whitespace-nowrap cursor-pointer ${dashboardSub === t.key ? 'bg-[#1E3A5F] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {t.label}
                </button>
              ))}
            </div>
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

            {/* ═══ 섹션 1: 상단 요약 카드 6열 (모노크롬 고대비 리디자인) ═══ */}
            {(dashboardSub === 'overview') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. 신규 상담 */}
              <button onClick={() => setActiveTab('open-requests')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-bold tracking-tight">신규 상담</span>
                    {totalOpenRequestsCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums block">{totalOpenRequestsCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
              </button>

              {/* 2. 응답 대기 */}
              <button onClick={() => setActiveTab('open-requests')} className="bg-white p-4.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-bold tracking-tight">응답 대기</span>
                    {directCounselingCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
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
                      return waitingCount > 0 ? <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> : null;
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
            )}

            {/* ═══ Row 3: 지금 상담을 기다리는 의뢰인 — 긴급 Action Zone ═══ */}
            {(dashboardSub === 'overview') && (
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
                    const debtRatio = (r.financialProfile.debtTotal / (r.financialProfile.income * 12 || 1)).toFixed(1);
                    return (
                    <button
                      key={r.id}
                      onClick={() => setActiveTab('open-requests')}
                      className="bg-slate-50/70 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm p-4 flex flex-col gap-3 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left"
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
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* 핵심 지표 3열 (고대비 모던 박스) */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">채무</div>
                          <div className="text-xs font-black text-slate-900">{r.financialProfile.debtTotal.toLocaleString()}만</div>
                        </div>
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">월소득</div>
                          <div className="text-xs font-bold text-slate-700">{r.financialProfile.income}만</div>
                        </div>
                        <div className="bg-white rounded-lg py-2 px-1 border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-medium">부채비율</div>
                          <div className={`text-xs font-black ${parseFloat(debtRatio) > 3 ? 'text-rose-600' : 'text-slate-900'}`}>{debtRatio}배</div>
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
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A5F] transition-colors shrink-0" />
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
                    onClick={() => setActiveTab('open-requests')}
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
            {(dashboardSub === 'overview') && (
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
                            <p className="text-[11px] text-slate-400">{q.userName} · {new Date(q.createdAt).toLocaleDateString()}</p>
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
                  const currentPlan = platformPlans.find(p => p.current);
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
                        <div className="text-sm font-black text-slate-900">{currentPlan ? currentPlan.name : '-'}</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] text-slate-500 font-bold mb-1">월 구독료</div>
                        <div className="text-xl font-black text-slate-900 tabular-nums">{currentPlan ? `${(currentPlan.price / 10000).toFixed(0)}만` : '-'}</div>
                      </div>
                    </div>
                  );
                })()}
              </button>
            </div>
            )}

            {/* ═══ Row 4: 알림/공지 + 일정/할일 요약 (2열) ═══ */}
            {(dashboardSub === 'overview') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 좌측: 최근 알림 */}
              <button onClick={() => setActiveTab('settings')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all press-scale cursor-pointer active:scale-[0.98] group text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    <span>알림 & 공지</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-bold group-hover:text-brand transition-colors flex items-center gap-1">설정 <ArrowRight className="w-3 h-3" /></span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 py-1.5">
                    <div className="p-1.5 rounded-lg bg-brand/10 text-brand shrink-0 mt-0.5"><Briefcase className="w-3.5 h-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">새로운 상담 요청이 접수되었습니다</p>
                      <p className="text-[11px] text-slate-400">방금 전</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-1.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0 mt-0.5"><MessageSquare className="w-3.5 h-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">의뢰인이 채팅 메시지를 보냈습니다</p>
                      <p className="text-[11px] text-slate-400">5분 전</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-1.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 shrink-0 mt-0.5"><Info className="w-3.5 h-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">[공지] 플랫폼 업데이트 안내</p>
                      <p className="text-[11px] text-slate-400">1시간 전</p>
                    </div>
                  </div>
                </div>
              </button>

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
                  const myParticipated = requests.filter(r => r.selectedLawyerId === activeLawyer.id).length;
                  const myCases = cases.filter(c => c.assignedLawyerId === activeLawyer.id).length;
                  const conversionRate = myParticipated > 0 ? Math.round((myCases / myParticipated) * 100) : 0;
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
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <div className="text-[11px] text-slate-400 font-bold">{'\uC0C1\uB2F4 \uCC38\uC5EC'}</div>
                          <div className="text-lg font-black text-slate-800">{myParticipated}{'\uAC74'}</div>
                        </div>
                        <div className="bg-purple-50/60 rounded-xl p-3 text-center">
                          <div className="text-[11px] text-slate-400 font-bold">{'\uC218\uC784 \uC804\uD658'}</div>
                          <div className="text-lg font-black text-purple-600">{myCases}{'\uAC74'}</div>
                        </div>
                        <div className="bg-emerald-50/60 rounded-xl p-3 text-center">
                          <div className="text-[11px] text-slate-400 font-bold">{'\uC804\uD658\uC728'}</div>
                          <div className={`text-lg font-black ${conversionRate >= 40 ? 'text-emerald-600' : conversionRate >= 20 ? 'text-amber-500' : 'text-slate-700'}`}>{conversionRate}%</div>
                        </div>
                      </div>
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


            {/* ═══ 서브탭: 활동 분석 (고도화) ═══ */}
            {dashboardSub === 'activity' && (() => {
              const myParticipated = requests.filter(r => r.selectedLawyerId === activeLawyer.id).length;
              const myCounseling = requests.filter(r => r.status === 'counseling' && r.selectedLawyerId === activeLawyer.id).length;
              const myCases = cases.filter(c => c.assignedLawyerId === activeLawyer.id).length;
              const conversionRate = myParticipated > 0 ? Math.round((myCases / myParticipated) * 100) : 0;
              const totalRequested = requests.filter(r => isRelevantRequest(r)).length;
              // 퍼널 단계별 비율 계산
              const funnelStages = [
                { label: '상담 요청 접수', count: totalRequested, color: 'bg-slate-400', icon: <Briefcase className="w-4 h-4" /> },
                { label: '상담 참여', count: myParticipated, color: 'bg-brand', icon: <MessageCircle className="w-4 h-4" /> },
                { label: '상담 진행 중', count: myCounseling, color: 'bg-amber-500', icon: <MessageSquare className="w-4 h-4" /> },
                { label: '수임 전환 성공', count: myCases, color: 'bg-emerald-500', icon: <Trophy className="w-4 h-4" /> },
              ];
              const funnelMax = Math.max(totalRequested, 1);
              // 주요 상담 유형 분석
              const categoryMap: Record<string, number> = {};
              requests.filter(r => r.selectedLawyerId === activeLawyer.id && r.entryCategory).forEach(r => {
                const label = r.entryCategory!.label;
                categoryMap[label] = (categoryMap[label] || 0) + 1;
              });
              const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

              return (
                <div className="space-y-6">
                  {/* 상단 핵심 성과 지표 카드 (모노크롬 리디자인) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-xs">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0"><Users className="w-6 h-6" /></div>
                      <div>
                        <span className="text-xs text-slate-500 font-bold block">총 상담 참여</span>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{myParticipated}건</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-xs">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0"><MessageCircle className="w-6 h-6" /></div>
                      <div>
                        <span className="text-xs text-slate-500 font-bold block">현재 진행 중</span>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{myCounseling}건</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-xs">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0"><Trophy className="w-6 h-6" /></div>
                      <div>
                        <span className="text-xs text-slate-500 font-bold block">수임 전환</span>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{myCases}건</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-xs">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-bold block">수임 전환율</span>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{conversionRate}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 수임 전환 퍼널 */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-sm">
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
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

                    {/* 활동 요약 인사이트 */}
                    <div className="space-y-4">
                      {/* 활동 요약 카드 */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                          <BarChart2 className="w-5 h-5 text-emerald-500" />
                          <span>활동 요약</span>
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> 평균 응답 시간</span>
                            {/* <!-- mock --> */}
                            <span className="font-black text-slate-900">2.3시간</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" /> 최근 7일 참여</span>
                            {/* <!-- mock --> */}
                            <span className="font-black text-brand">{Math.min(myParticipated, 3)}건</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 font-semibold flex items-center gap-2"><Target className="w-4 h-4" /> 응답률</span>
                            {/* <!-- mock --> */}
                            <span className="font-black text-emerald-600">85%</span>
                          </div>
                        </div>
                      </div>

                      {/* 주요 상담 유형 */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
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

                      {/* 상담 TIP */}
                      <div className="bg-brand/5 border border-brand/10 rounded-xl p-4 space-y-1.5">
                        <span className="text-[11px] font-black text-brand uppercase tracking-wide">💡 상담 TIP</span>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                          의뢰인의 채무 원인에 맞춘 구체적인 해결 방안을 제시하면 수임 전환율이 높아집니다. 채무 구조를 꼼꼼히 분석해 보세요.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}




          </div>
        )}



        {/* TAB 2: INCOMING COUNSEL REQUESTS LIST */}
        {activeTab === 'open-requests' && (
          <div className="space-y-6 animate-fadeIn">
            {/* 페이지 헤더 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-brand" />
                  신규 상담 요청
                </h2>
                <p className="text-sm text-slate-500 mt-1">채무 구조와 소득 진단 통계를 검토한 후 제안서를 작성하세요.</p>
              </div>
              <span className="text-xs bg-brand/10 text-brand px-3.5 py-1.5 rounded-lg font-bold whitespace-nowrap">
                회생파산 전담팀 R-1
              </span>
            </div>

            {/* 요청 목록: 2열 그리드 배치 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              {requests
                .filter(r => {
                  const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
                  const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
                    const targetLawyer = lawyers.find(l => l.id === id);
                    return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
                  });
                  const openMatch = r.requestType === 'open';
                  return (directMatch || sameFirmMatch || openMatch) && (r.status === 'requested' || r.status === 'responding');
                })
                .filter(r => !(r.proposals || []).some(p => p.lawyerId === activeLawyer.id))
                .map((r, idx) => {
                  const debtRatio = (r.financialProfile.debtTotal / (r.financialProfile.income * 12)).toFixed(1);
                  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">

                      {/* 카드 헤더 */}
                      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                            r.requestType === 'direct' ? 'bg-[#1E3A5F] text-white' :
                            r.requestType === 'direct_multi' ? 'bg-slate-800 text-white' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {r.requestType === 'direct' ? '단독지명' : r.requestType === 'direct_multi' ? '의뢰인 지정' : '오픈형'}
                          </span>
                          {r.entryCategory && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-xs">
                              {r.entryCategory.type === 'debt_type' ? '💳 ' : r.entryCategory.type === 'solution' ? '⚖️ ' : ''}{r.entryCategory.label}
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-900">{r.clientName}</span>
                          <span className="text-[11px] text-slate-400">등록 {new Date(r.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 text-[11px]">지정 변호사: <strong className="text-slate-800">{r.selectedLawyerIds?.length || r.maxParticipants}명</strong></span>
                          <span className="bg-rose-50 text-rose-600 font-bold text-[11px] px-2 py-0.5 rounded-md border border-rose-200">제안서 작성 대기</span>
                        </div>
                      </div>

                      {/* 카드 본문 */}
                      <div className="p-5 space-y-4 flex-1 flex flex-col">
                        {/* 제목 + 사연 */}
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-base text-slate-900 line-clamp-1">{r.title}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">{r.content}</p>
                        </div>

                        {/* 의뢰인 메모 */}
                        {((r.financialProfile.clientNotes && r.financialProfile.clientNotes.length > 0) || r.financialProfile.clientNote) && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs sm:text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-base shrink-0">📝</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">의뢰인 전달 메모</span>
                                {r.financialProfile.clientNotes && r.financialProfile.clientNotes.length > 0 ? (
                                  <ul className="space-y-0.5 text-left list-none">
                                    {r.financialProfile.clientNotes.map((note, index) => (
                                      <li key={index} className="text-xs text-slate-800 leading-relaxed break-all">
                                        • {note}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line break-all">{r.financialProfile.clientNote}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 고객 원본 정보 */}
                        <ClientOriginalInfo
                          fp={r.financialProfile}
                          clientName={r.clientName}
                          phone={r.phone}
                          consultType={r.consultType || r.request_type || r.requestType}
                          createdAt={r.createdAt}
                          compact
                        />

                        {/* 위험 플래그 — 해당시만 표시 */}
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                          {r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none' && (
                            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-bold border border-slate-200">
                              ⚡ 24개월 특례: {r.financialProfile.specialCondition === 'basic_recipient' ? '기초수급' : r.financialProfile.specialCondition === 'severe_disability' ? '중증장애' : r.financialProfile.specialCondition === 'single_parent' ? '한부모' : r.financialProfile.specialCondition === 'rent_fraud' ? '전세사기' : '고령자'}
                            </span>
                          )}
                          {r.financialProfile.retirementPay !== undefined && r.financialProfile.retirementPay > 0 && (
                            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-semibold border border-slate-200">
                              💼 퇴직금 {r.financialProfile.retirementPay.toLocaleString()}만 ({r.financialProfile.retirementPensionType === 'pension' ? '연금 0%반영' : r.financialProfile.retirementPensionType === 'none' ? '미가입 50%반영' : '확인필요 50%반영'})
                            </span>
                          )}
                          {r.financialProfile.retirementPensionType === 'unknown' && (
                            <span className="bg-rose-50 text-rose-600 text-xs px-2.5 py-0.5 rounded-md font-bold border border-rose-200">
                              ⚠️ 퇴직연금 확인 필요
                            </span>
                          )}
                          {r.financialProfile.riskFlags.map(rf => (
                            <span key={rf} className="bg-rose-50 text-rose-600 text-xs px-2.5 py-0.5 rounded-md font-bold border border-rose-200">
                              ⚠️ {rf}
                            </span>
                          ))}
                          {(r.financialProfile.speculativeLoss && r.financialProfile.speculativeLoss > 0) && (
                            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-bold border border-slate-200">
                              📉 투기손실 {r.financialProfile.speculativeLoss.toLocaleString()}만
                            </span>
                          )}
                          {(r.financialProfile.gamblingLoss && r.financialProfile.gamblingLoss > 0) && (
                            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-bold border border-slate-200">
                              🎰 도박손실 {r.financialProfile.gamblingLoss.toLocaleString()}만
                            </span>
                          )}
                        </div>

                      </div>

                      {/* 워크플로우 패널 (직원 메모, 변호사 의견, 승인) */}
                      <div className="px-5">
                        <RequestWorkflowPanel
                          requestId={r.id}
                          clientName={r.clientName || r.client_name || '고객'}
                          isLawyerOrOwner={isLawyerOrOwner}
                          workflow={{
                            staffMemo: (r as any).staffMemo,
                            staffChecklist: (r as any).staffChecklist,
                            lawyerOpinion: (r as any).lawyerOpinion,
                            reviewStatus: (r as any).reviewStatus,
                          }}
                          onUpdateWorkflow={(reqId, updates) => {
                            setRequests(prev => prev.map(req => req.id === reqId ? { ...req, ...updates } : req));
                          }}
                        />
                        {/* 처리 이력 타임라인 */}
                        <RequestTimeline
                          events={(r as any).timeline || [
                            { id: `tl-${r.id}-1`, action: 'RECEIVED' as const, actor: '시스템', timestamp: r.createdAt || new Date().toISOString() }
                          ]}
                        />
                      </div>

                      {/* 카드 푸터: 액션 버튼 */}
                      <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5 mt-auto">
                        <button 
                          onClick={() => { setCopilotPreselectedReqId(r.id); setActiveTab('case-copilot'); }}
                          className="bg-white hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border border-slate-200 whitespace-nowrap press-scale cursor-pointer active:scale-[0.98]"
                        >
                          <Microscope className="w-4 h-4 text-slate-600" />
                          🔬 AI 심층 분석
                        </button>
                        <button 
                          onClick={() => handleOpenProposalDraft(r.id)}
                          className="bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm tracking-wide transition-all shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap press-scale cursor-pointer active:scale-[0.98]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          고객 제안서 작성
                        </button>
                      </div>

                    </div>
                  );
                })}

              {requests.filter(r => {
                  const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
                  const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
                    const targetLawyer = lawyers.find(l => l.id === id);
                    return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
                  });
                  const openMatch = r.requestType === 'open';
                  return (directMatch || sameFirmMatch || openMatch) && (r.status === 'requested' || r.status === 'responding');
                }).filter(r => !(r.proposals || []).some(p => p.lawyerId === activeLawyer.id)).length === 0 && (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-base text-slate-700 font-bold">현재 대응할 신규 상담 요청이 없습니다.</p>
                  <p className="text-sm text-slate-400">의뢰인이 상담을 요청하면 이곳에 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: 상담 채팅 */}
        {activeTab === 'chat' && (() => {
          const chatThreads = requests.filter(r => (r.status === 'comparing' || r.status === 'counseling') && ((r.acceptedLawyerIds || []).includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id));
          const chatEndRef = React.createRef<HTMLDivElement>();
          return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 min-h-[550px] h-[calc(100vh-14rem)] lg:h-[720px] animate-fadeIn">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className={`lg:col-span-3 border-r border-slate-200 flex flex-col h-full bg-white ${mobilePane === 'threads' ? 'block' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">상담 메시지함</h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">매칭된 상담 세션</p>
                </div>
                {chatThreads.length > 0 && (
                  <span className="bg-brand/10 text-brand text-xs font-bold px-2.5 py-1 rounded-lg">{chatThreads.length}건</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
                {chatThreads.map(r => {
                    const isSelected = r.id === activeChatReqId;
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
                              <span className="text-xs text-slate-400 shrink-0 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-normal">
                              {lastMsg ? lastMsg.message : r.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                r.status === 'comparing' ? 'bg-amber-100 text-amber-700' :
                                r.status === 'counseling' && r.selectedLawyerId === activeLawyer.id ? 'bg-emerald-100 text-emerald-700' :
                                r.selectedLawyerId && r.selectedLawyerId !== activeLawyer.id ? 'bg-red-100 text-red-600' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {r.status === 'comparing' ? '비교 상담중' : r.status === 'counseling' && r.selectedLawyerId === activeLawyer.id ? '전담 매칭' : r.selectedLawyerId && r.selectedLawyerId !== activeLawyer.id ? '매칭 종료' : '상담중'}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">채무 {r.financialProfile.debtTotal.toLocaleString()}만</span>
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
                    <p className="text-xs text-slate-400">제안서 수락 후 상담이 시작됩니다</p>
                    <button 
                      onClick={() => setActiveTab('open-requests')}
                      className="text-brand font-bold text-sm hover:underline press-scale cursor-pointer"
                    >
                      상담 요청 목록보기 →
                    </button>
                  </div>
                )}
              </div>
            </div>


            {/* PANEL II: ACTIVE MESSAGING BOARD (CENTER) */}
            <div className={`lg:col-span-6 border-r border-slate-200 flex flex-col h-full bg-slate-50/30 ${mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
                <>
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => setMobilePane('threads')}
                        className="lg:hidden flex items-center justify-center text-brand font-bold text-xs border border-brand/20 bg-brand/5 p-2 rounded-xl shrink-0 press-scale cursor-pointer"
                        title="목록으로"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                        {currentChatRequest.clientName[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-slate-900 line-clamp-1">{currentChatRequest.clientName}</h3>
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
                        {currentChatRequest.id.substring(0, 12)}
                      </span>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-hide">
                    <div className="p-4 bg-brand/5 rounded-2xl text-slate-700 text-sm border border-brand/15 text-left whitespace-pre-wrap leading-relaxed">
                      📝 <span className="text-brand font-bold">의뢰서 본문:</span> {currentChatRequest.content}
                    </div>

                    {currentChatMessages.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      const isSystem = m.senderType === 'admin' || m.senderName === 'System' || m.message.startsWith('[System]');
                      
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
                  <div className="border-t border-slate-200 bg-white">
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
                            handleSendChat();
                            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400"
                      />
                      <button 
                        onClick={() => {
                          handleSendChat();
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
            <div className={`lg:col-span-3 flex flex-col h-full bg-white overflow-y-auto ${mobilePane === 'crm' ? 'block' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
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
                      <div className="flex justify-between"><span className="text-slate-500">의뢰인명</span> <span className="font-bold text-slate-900">{currentChatRequest.clientName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">연락처</span> <span className="font-mono text-slate-800 font-semibold">{getDisplayPhoneNumber(currentChatRequest)}</span></div>
                      {currentChatRequest.financialProfile.age && (
                        <div className="flex justify-between"><span className="text-slate-500">나이/성별</span> <span className="font-bold text-slate-900">{currentChatRequest.financialProfile.age}세 / {currentChatRequest.financialProfile.gender === 'male' ? '남성' : currentChatRequest.financialProfile.gender === 'female' ? '여성' : '미기재'}</span></div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">월 소득</span> <span className="font-bold text-brand">{currentChatRequest.financialProfile.income}만 원</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">총 채무</span> <span className="font-bold text-red-500">{currentChatRequest.financialProfile.debtTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">자산합산</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.assetsTotal.toLocaleString()}만 원</span></div>
                      {currentChatRequest.financialProfile.myAssets !== undefined && currentChatRequest.financialProfile.myAssets > 0 && (
                        <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 본인 재산</span> <span className="text-slate-700">{currentChatRequest.financialProfile.myAssets.toLocaleString()}만</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-slate-500">부양 가족</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.dependents}명 ({currentChatRequest.financialProfile.dependents + 1}인 가구)</span></div>
                      {currentChatRequest.financialProfile.minorChildren !== undefined && (
                        <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 미성년 자녀</span> <span className="font-semibold text-slate-800">{currentChatRequest.financialProfile.minorChildren}명</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-slate-500">혼인상태</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : currentChatRequest.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span></div>
                      
                      {currentChatRequest.financialProfile.specialCondition && currentChatRequest.financialProfile.specialCondition !== 'none' && (
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs text-emerald-700 font-bold text-center">
                          ⚡ 24개월 특례: {currentChatRequest.financialProfile.specialCondition === 'basic_recipient' ? '기초수급' : currentChatRequest.financialProfile.specialCondition === 'severe_disability' ? '중증장애' : currentChatRequest.financialProfile.specialCondition === 'single_parent' ? '한부모' : currentChatRequest.financialProfile.specialCondition === 'rent_fraud' ? '전세사기' : '고령자'}
                        </div>
                      )}

                      {currentChatRequest.financialProfile.jobType && (
                        <>
                          <div className="border-t border-slate-200 pt-2 flex justify-between">
                            <span className="text-slate-500">직업</span> 
                            <span className="font-bold text-slate-900">
                              {currentChatRequest.financialProfile.jobType === 'SALARIED' ? '급여소득' : currentChatRequest.financialProfile.jobType === 'BUSINESS' ? '영업소득' : currentChatRequest.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                              {currentChatRequest.financialProfile.companyName && ` (${currentChatRequest.financialProfile.companyName})`}
                            </span>
                          </div>
                          <div className="flex justify-between"><span className="text-slate-500">거주지역</span> <span className="text-slate-700">{currentChatRequest.financialProfile.residenceRegion}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">거주형태</span> <span className="text-slate-700">{currentChatRequest.financialProfile.housingType === 'rent' ? '월세' : currentChatRequest.financialProfile.housingType === 'jeonse' ? '전세' : currentChatRequest.financialProfile.housingType === 'owned' ? '자가' : currentChatRequest.financialProfile.housingType === 'free' ? '무상거주' : '-'}{currentChatRequest.financialProfile.housingContractHolder ? ` (${currentChatRequest.financialProfile.housingContractHolder === 'self' ? '본인' : currentChatRequest.financialProfile.housingContractHolder === 'spouse' ? '배우자' : '타인'}명의)` : ''}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">보증금</span> <span className="text-slate-700">{currentChatRequest.financialProfile.rentalDeposit?.toLocaleString()}만</span></div>
                          {currentChatRequest.financialProfile.depositLoan !== undefined && currentChatRequest.financialProfile.depositLoan > 0 && (
                            <div className="flex justify-between"><span className="text-slate-400 pl-2">∟ 보증금 대출</span> <span className="text-red-400">{currentChatRequest.financialProfile.depositLoan.toLocaleString()}만</span></div>
                          )}
                          {currentChatRequest.financialProfile.maritalStatus === 'MARRIED' && (
                            <>
                              <div className="flex justify-between"><span className="text-slate-500">배우자 재산</span> <span className="text-slate-700">{currentChatRequest.financialProfile.spouseAsset?.toLocaleString()}만</span></div>
                              {currentChatRequest.financialProfile.spouseIncome !== undefined && (
                                <div className="flex justify-between"><span className="text-slate-500">배우자 소득</span> <span className="text-slate-700">{currentChatRequest.financialProfile.spouseIncome.toLocaleString()}만</span></div>
                              )}
                            </>
                          )}
                          {currentChatRequest.financialProfile.maritalStatus === 'DIVORCED' && (
                            <>
                              {currentChatRequest.financialProfile.childSupportReceived !== undefined && currentChatRequest.financialProfile.childSupportReceived > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">양육비 수령</span> <span className="text-emerald-500">+{currentChatRequest.financialProfile.childSupportReceived.toLocaleString()}만</span></div>
                              )}
                              {currentChatRequest.financialProfile.childSupportPaid !== undefined && currentChatRequest.financialProfile.childSupportPaid > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">양육비 지급</span> <span className="text-red-400">-{currentChatRequest.financialProfile.childSupportPaid.toLocaleString()}만</span></div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">채무원인</span> <span className="text-slate-700">{currentChatRequest.financialProfile.debtCause === 'LIVING' ? '생활비' : currentChatRequest.financialProfile.debtCause === 'BUSINESS' ? '사업실패' : currentChatRequest.financialProfile.debtCause === 'INVESTMENT' ? '투자실패' : currentChatRequest.financialProfile.debtCause === 'GAMBLING' ? '도박' : currentChatRequest.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</span></div>
                          {currentChatRequest.financialProfile.speculativeLoss !== undefined && currentChatRequest.financialProfile.speculativeLoss > 0 && (
                            <div className="flex justify-between text-red-400 font-semibold"><span>투기손실</span><span>{currentChatRequest.financialProfile.speculativeLoss.toLocaleString()}만</span></div>
                          )}
                          {currentChatRequest.financialProfile.gamblingLoss !== undefined && currentChatRequest.financialProfile.gamblingLoss > 0 && (
                            <div className="flex justify-between text-red-400 font-semibold"><span>도박손실</span><span>{currentChatRequest.financialProfile.gamblingLoss.toLocaleString()}만</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">추심단계</span> <span className="text-amber-500 font-semibold">{currentChatRequest.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : currentChatRequest.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : currentChatRequest.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '압류'}</span></div>
                          {currentChatRequest.financialProfile.legalActions && currentChatRequest.financialProfile.legalActions.length > 0 && currentChatRequest.financialProfile.legalActions.some(x => x !== 'none') && (
                            <div className="flex justify-between"><span className="text-slate-500">법적조치</span><span className="text-slate-700">{currentChatRequest.financialProfile.legalActions.filter(x => x !== 'none').map(x => ({ collection_call: '독촉', court_order: '소장수령', seizure: '급여압류', property_seizure: '부동산압류', credit_drop: '신용하락' }[x] || x)).join(', ')}</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">채권자</span> <span className="text-slate-700">{currentChatRequest.financialProfile.creditorCount}곳</span></div>

                          {(currentChatRequest.financialProfile.rentCost || currentChatRequest.financialProfile.medicalCost || currentChatRequest.financialProfile.educationCost || currentChatRequest.financialProfile.monthlyFixedExpenses) && (
                            <div className="border-t border-slate-200 pt-2.5 space-y-1.5">
                              <span className="text-xs font-black text-slate-500 tracking-wide uppercase block">🏠 월 생계비</span>
                              {currentChatRequest.financialProfile.rentCost !== undefined && currentChatRequest.financialProfile.rentCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">월세</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.rentCost.toLocaleString()}만</span></div>
                              )}
                              {currentChatRequest.financialProfile.medicalCost !== undefined && currentChatRequest.financialProfile.medicalCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">의료비</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.medicalCost.toLocaleString()}만</span></div>
                              )}
                              {currentChatRequest.financialProfile.educationCost !== undefined && currentChatRequest.financialProfile.educationCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">교육비</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.educationCost.toLocaleString()}만</span></div>
                              )}
                              {currentChatRequest.financialProfile.specialEducationCost !== undefined && currentChatRequest.financialProfile.specialEducationCost > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">특수교육비</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.specialEducationCost.toLocaleString()}만</span></div>
                              )}
                              {currentChatRequest.financialProfile.monthlyFixedExpenses !== undefined && currentChatRequest.financialProfile.monthlyFixedExpenses > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">고정지출</span> <span className="text-slate-800 font-medium">{currentChatRequest.financialProfile.monthlyFixedExpenses.toLocaleString()}만</span></div>
                              )}
                            </div>
                          )}

                          {currentChatRequest.financialProfile.retirementPay !== undefined && currentChatRequest.financialProfile.retirementPay > 0 && (
                            <div className="border-t border-slate-200 pt-2.5 space-y-1.5">
                              <div className="flex justify-between"><span className="text-slate-500">퇴직금</span><span className="font-bold text-slate-900">{currentChatRequest.financialProfile.retirementPay.toLocaleString()}만</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">퇴직연금</span>
                                <span className={currentChatRequest.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-600 font-bold' : 'text-slate-700 font-medium'}>
                                  {currentChatRequest.financialProfile.retirementPensionType === 'pension' ? '가입 (0%반영)' : currentChatRequest.financialProfile.retirementPensionType === 'none' ? '미가입 (50%반영)' : '확인필요 (50%반영)'}
                                </span>
                              </div>
                              {currentChatRequest.financialProfile.retirementPensionType === 'unknown' && (
                                <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-xs text-amber-700 font-bold text-center animate-pulse">
                                  ⚠️ 퇴직연금 확인 필요
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 변제 시뮬레이션 */}
                    {currentChatRequestResult && (
                      <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 space-y-2 text-sm">
                        <span className="text-xs font-black text-emerald-700 tracking-wide uppercase block">💰 변제 시뮬레이션</span>
                        <div className="flex justify-between"><span className="text-slate-500">월 변제금</span> <span className="font-bold text-slate-900">{(currentChatRequestResult.monthlyPayment / 10000).toLocaleString()}만/월</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">변제 기간</span> <span className="text-slate-800 font-medium">{currentChatRequestResult.repaymentMonths}개월</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">총 변제금</span> <span className="text-slate-800 font-medium">{(currentChatRequestResult.totalRepayment / 10000).toLocaleString()}만</span></div>
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>탕감액</span>
                          <span>{(currentChatRequestResult.totalDebtReduction / 10000).toLocaleString()}만 ({currentChatRequestResult.debtReductionRate}%)</span>
                        </div>
                        <div className="flex justify-between"><span className="text-slate-500">청산가치</span> <span className="text-slate-700">{(currentChatRequestResult.liquidationValue / 10000).toLocaleString()}만</span></div>
                        <div className="space-y-1.5 pt-2 border-t border-emerald-200/50">
                          <div className="flex justify-between text-xs text-slate-500 font-medium">
                            <span>청산가치 보장율</span>
                            <span className="font-bold text-emerald-700">{Math.round((currentChatRequestResult.totalRepayment / Math.max(1, currentChatRequestResult.liquidationValue)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-400 to-brand h-full rounded-full" style={{ width: `${Math.min(100, Math.round((currentChatRequestResult.totalRepayment / Math.max(1, currentChatRequestResult.liquidationValue)) * 100))}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 리스크 태그 */}
                    {currentChatRequest.financialProfile.riskFlags.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-red-500 block">⚠️ 리스크 태그</span>
                        <div className="flex flex-wrap gap-1.5">
                          {currentChatRequest.financialProfile.riskFlags.map(rf => (
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
                      onClick={() => handleConvertToCase(currentChatRequest)}
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
                      value={internalNotes[currentChatRequest.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [currentChatRequest.id]: e.target.value };
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
          <div className="space-y-8 animate-fadeIn">
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
                      <span className="text-emerald-400 text-sm font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>정상 운영 중</span>
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
                          <td className="p-3.5"><span className={`text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${order.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : order.status === 'cancelled' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${order.status === 'pending' ? 'bg-amber-500' : order.status === 'active' ? 'bg-emerald-500 animate-pulse' : order.status === 'cancelled' ? 'bg-rose-500' : 'bg-slate-400'}`}></span>{order.status === 'pending' ? '입금 대기' : order.status === 'active' ? '활성' : order.status === 'cancelled' ? '취소' : '만료'}</span></td>
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
          />
        )}

        {/* TAB: CASE REVIEW COPILOT (사건검토 코파일럿) */}
        {activeTab === 'case-copilot' && (
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
          <div className="animate-fadeIn">
            <TasksScheduleTab
              tenantId={activeLawyer.lawFirmId || activeLawyer.id}
              userId={activeStaffMember?.id || activeLawyer.id}
              userName={activeStaffMember?.name || activeLawyer.name}
              userRole={activeStaffMember?.role || 'OWNER'}
              hasManageCalendar={activeStaffMember?.permissions?.manageCalendar ?? true}
              requests={requests}
              cases={cases}
              qas={qas}
              activeLawyerId={activeLawyer.id}
            />
          </div>
        )}

        {/* TAB: 마이김변 문의 */}
        {activeTab === 'inquiry-to-admin' && lawyerInquiries && setLawyerInquiries && (
          <div className="animate-fadeIn">
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
          <div className="space-y-6 animate-fadeIn">
            {/* 서브탭 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
              {([
                { key: 'profile' as const, label: '내 프로필' },
                { key: 'channels' as const, label: '알림 채널 설정' },
                { key: 'logs' as const, label: '알림 로그' },
                { key: 'calc-rules' as const, label: '회생/파산 계산 기준 확인' },
              ]).map(t => (
                <button key={t.key} onClick={() => setSettingsSub(t.key)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${settingsSub === t.key ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {settingsSub === 'profile' && (
              <div className="animate-fadeIn">
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
                  onClose={() => setSettingsSub('channels')}
                  inline={true}
                />
              </div>
            )}
            {settingsSub === 'channels' && (<>
            {/* Header info */}
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <h3 className="font-black text-xl text-slate-900 flex items-center gap-2.5">
                  <Bell className="w-6 h-6 text-brand" />
                  <span>실시간 알림 및 외부 연동 설정 (Telegram Gateway)</span>
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed text-left">
                  신규 상담이 접수되거나 선착순 상담이 오픈될 때, 텔레그램 메신저를 통해 실시간 알림을 수신하고 간편 제어 액션을 수행합니다.
                </p>
              </div>
              <span className="bg-brand/10 border border-brand/20 text-brand text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap self-start md:self-center shadow-xs">
                SaaS Enterprise 가동 중
              </span>
            </div>

            {/* ── 소속 법률사무소 / 법인 설정 ── */}
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-base md:text-lg text-slate-900 flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-brand" />
                    <span>소속 법률사무소 / 법인 명칭 설정</span>
                  </h3>
                  <p className="text-sm text-slate-500 text-left">
                    변호사 어드민 헤더 및 플랫폼 노출용 소속 법무법인 또는 사무소의 명칭을 입력하거나 수정합니다.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1 space-y-2 text-left">
                  <label className="text-sm text-slate-700 font-bold block">소속 명칭 입력 (예: 법무법인 보광, 이준법률사무소)</label>
                  <input
                    type="text"
                    value={tempFirmName}
                    onChange={e => setTempFirmName(e.target.value)}
                    placeholder="소속 명칭을 입력해주세요"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 font-bold text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveFirmName}
                  className="bg-brand hover:bg-brand-hover text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shrink-0 flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>설정 저장</span>
                </button>
              </div>
            </div>

            {/* ── 보안 설정: 비밀번호 변경 ── */}
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base md:text-lg text-slate-900 flex items-center gap-2.5">
                  <Lock className="w-5 h-5 text-brand" />
                  <span>비밀번호 및 보안 설정</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className={`text-sm font-bold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                    showPasswordChange ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/20'
                  }`}
                >
                  {showPasswordChange ? '접기' : '비밀번호 변경'}
                </button>
              </div>

              {showPasswordChange && (
                <div className="space-y-4 animate-fadeIn border-t border-slate-100 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700 font-bold block">현재 비밀번호</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="현재 사용 중인 비밀번호"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700 font-bold block">새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 (4자리 이상)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700 font-bold block">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호를 다시 입력"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    className="w-full bg-brand hover:bg-brand-hover text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    비밀번호 변경 저장
                  </button>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════ */}
            {/* 알림 채널 관리 */}
            {/* ══════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-4 shadow-sm">
              <h3 className="font-black text-base md:text-lg text-slate-900 flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-brand" />
                <span>알림 채널 관리</span>
              </h3>
              <p className="text-sm text-slate-500">신규 상담 접수 시 아래 활성화된 채널로 알림이 발송됩니다.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Telegram 채널 카드 */}
                <div className={`p-5 rounded-2xl border-2 transition-all ${tgConnected ? 'border-emerald-500/30 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-base font-black text-slate-900">📱 Telegram</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${tgConnected ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {tgConnected ? '✅ 연결됨' : '미연결'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 font-medium">변호사/직원 그룹방에 봇 알림 발송</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowBotTokenGuide(!showBotTokenGuide)}
                      className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {showBotTokenGuide ? '가이드 닫기' : '📖 봇 생성 가이드'}
                    </button>
                    <button onClick={async () => {
                      if (!tgBotToken || !tgChatId) { alert('Bot Token과 Chat ID를 입력하세요.'); return; }
                      setNotifTestLoading('telegram');
                      const res = await testTelegramConnection(tgBotToken, tgChatId);
                      setNotifTestLoading(null);
                      setNotifLogs(loadNotificationLogs());
                      if (res.ok) {
                        setTgConnected(true);
                        const updated = { ...notifSettings, telegram: { botToken: tgBotToken, chatId: tgChatId, connected: true } };
                        setNotifSettings(updated);
                        saveNotificationSettings(updated);
                        alert('✅ 텔레그램 테스트 메시지가 발송되었습니다!');
                      } else {
                        alert(`❌ 발송 실패: ${res.error}`);
                      }
                    }}
                      className="flex-1 py-2 text-xs font-bold rounded-xl bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors cursor-pointer">
                      {notifTestLoading === 'telegram' ? '⏳ 발송 중...' : '🔔 테스트'}
                    </button>
                  </div>
                </div>

                {/* 이메일 채널 카드 */}
                <div className={`p-5 rounded-2xl border-2 transition-all ${notifSettings.email.enabled ? 'border-blue-500/30 bg-blue-50/30' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-base font-black text-slate-900">📧 이메일 알림</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${notifSettings.email.enabled ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {notifSettings.email.enabled ? '✅ 설정됨' : '미설정'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 font-medium">로펌 Gmail로 변호사/직원에게 발송</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowEmailSetup(!showEmailSetup)}
                      className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                      {showEmailSetup ? '닫기' : '⚙️ 설정하기'}
                    </button>
                    {notifSettings.email.enabled && (
                      <button onClick={async () => {
                        setNotifTestLoading('email');
                        const { subject, html } = formatEmailConsultHtml({ type: '테스트', region: '서울/경기', debt: '5천만~1억', income: '200만~300만', tags: ['#테스트알림'] });
                        const res = await sendEmailNotification(notifSettings.email.senderGmail, notifSettings.email.senderAppPassword, notifSettings.email.recipientEmails, subject, html);
                        setNotifTestLoading(null);
                        setNotifLogs(loadNotificationLogs());
                        alert(res.ok ? '✅ 테스트 이메일이 발송되었습니다!' : `❌ 발송 실패: ${res.error}`);
                      }}
                        className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer">
                        {notifTestLoading === 'email' ? '⏳ 발송 중...' : '📧 테스트'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 브라우저 Push 채널 카드 */}
                <div className={`p-5 rounded-2xl border-2 transition-all ${notifSettings.browserPush.enabled ? 'border-amber-500/30 bg-amber-50/30' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-base font-black text-slate-900">🔔 브라우저 Push</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${notifSettings.browserPush.enabled ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {notifSettings.browserPush.enabled ? '✅ 허용됨' : '허용 필요'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 font-medium">브라우저 알림으로 즉시 데스크탑 알림</p>
                  <button onClick={async () => {
                    const perm = await requestBrowserPushPermission();
                    if (perm === 'granted') {
                      const updated = { ...notifSettings, browserPush: { enabled: true, permission: 'granted' } };
                      setNotifSettings(updated);
                      saveNotificationSettings(updated);
                      sendBrowserPushNotification('🔔 알림 테스트', '브라우저 Push 알림이 활성화되었습니다!');
                      setNotifLogs(loadNotificationLogs());
                    } else {
                      alert('브라우저 알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
                    }
                  }}
                    className="w-full py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer">
                    {notifSettings.browserPush.enabled ? '🔔 테스트 알림 보내기' : '🔔 알림 허용하기'}
                  </button>
                </div>

                {/* SMS/카카오톡 채널 카드 (준비중) */}
                <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/50 opacity-60">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-base font-black text-slate-900">📲 SMS / 카카오톡</span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                      🔒 준비중
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">SMS 및 카카오톡 알림 (추후 업데이트)</p>
                  <button disabled
                    className="w-full py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed">
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* 봇 생성 가이드 (토글) */}
              {showBotTokenGuide && (
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-200/50 rounded-2xl p-6 space-y-4 animate-fadeIn">
                  <h4 className="font-black text-base text-slate-900 flex items-center gap-2">📖 텔레그램 봇 생성 가이드</h4>
                  <ol className="text-sm text-slate-700 space-y-2.5 list-decimal list-inside leading-relaxed font-medium">
                    <li>텔레그램 앱에서 <strong className="text-brand">@BotFather</strong> 검색 후 대화 시작</li>
                    <li><code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-xs font-mono">/newbot</code> 명령어 입력</li>
                    <li>봇 이름 설정 (예: <strong>"OO법률사무소 알림봇"</strong>)</li>
                    <li>봇 사용자명 설정 (예: <strong>"oo_lawfirm_bot"</strong>) — <code>_bot</code>으로 끝나야 합니다</li>
                    <li>발급된 <strong className="text-red-500">Bot Token</strong>을 아래에 붙여넣기</li>
                    <li>직원 그룹방을 만들고 생성한 봇을 <strong>관리자로 추가</strong></li>
                    <li>그룹방에서 <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-xs font-mono">/start</code> 입력 후, Chat ID 확인</li>
                  </ol>
                  <div className="flex gap-3 pt-2">
                    <a href="https://t.me/BotFather" target="_blank" rel="noreferrer"
                      className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 hover:bg-[#0088cc]/20 transition-colors">
                      ▶ BotFather 열기
                    </a>
                    <a href="https://api.telegram.org" target="_blank" rel="noreferrer"
                      className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
                      📋 Telegram API 문서
                    </a>
                  </div>
                  {/* Bot Token 입력 */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <label className="text-sm text-slate-700 font-bold block">Bot Token</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showBotToken ? 'text' : 'password'}
                          value={tgBotToken}
                          onChange={e => setTgBotToken(e.target.value)}
                          placeholder="예: 7123456789:AAF1x2y3z..."
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                        <button onClick={() => setShowBotToken(!showBotToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer">
                          {showBotToken ? '숨기기' : '보기'}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-sm text-slate-700 font-bold block">Chat ID (그룹방)</label>
                        <input
                          type="text"
                          value={tgChatId}
                          onChange={e => setTgChatId(e.target.value)}
                          placeholder="예: -1001234567890"
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>
                    <button onClick={() => {
                      const updated = { ...notifSettings, telegram: { botToken: tgBotToken, chatId: tgChatId, connected: tgConnected } };
                      setNotifSettings(updated);
                      saveNotificationSettings(updated);
                      alert('✅ 텔레그램 설정이 저장되었습니다.');
                    }}
                      className="w-full py-3 text-sm font-bold rounded-xl bg-brand hover:bg-brand-hover text-white transition-all cursor-pointer shadow-sm active:scale-[0.98]">
                      💾 텔레그램 설정 저장
                    </button>
                  </div>
                </div>
              )}

              {/* 이메일 설정 (토글) */}
              {showEmailSetup && (
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-200/50 rounded-2xl p-6 space-y-4 animate-fadeIn">
                  <h4 className="font-black text-base text-slate-900 flex items-center gap-2">📧 Gmail 이메일 알림 설정</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    로펌의 Gmail 계정에서 변호사/직원에게 상담 알림 이메일을 자동 발송합니다. Gmail <strong>앱 비밀번호</strong>가 필요합니다.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700 font-bold block">발신 Gmail 주소</label>
                      <input type="email" value={emailSender} onChange={e => setEmailSender(e.target.value)}
                        placeholder="lawfirm@gmail.com"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700 font-bold block">Gmail 앱 비밀번호 (16자리)</label>
                      <input type="password" value={emailAppPassword} onChange={e => setEmailAppPassword(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30" />
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer"
                        className="text-xs text-brand hover:underline font-medium inline-block mt-0.5">
                        앱 비밀번호 발급 방법 →
                      </a>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700 font-bold block">수신 이메일 주소 (쉼표로 구분)</label>
                      <input type="text" value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)}
                        placeholder="lawyer1@naver.com, staff1@gmail.com"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    </div>
                    <button onClick={() => {
                      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(Boolean);
                      if (!emailSender || !emailAppPassword || recipients.length === 0) {
                        alert('발신 Gmail, 앱 비밀번호, 수신 이메일을 모두 입력해주세요.');
                        return;
                      }
                      const updated = { ...notifSettings, email: { senderGmail: emailSender, senderAppPassword: emailAppPassword, recipientEmails: recipients, enabled: true } };
                      setNotifSettings(updated);
                      saveNotificationSettings(updated);
                      alert('✅ 이메일 알림 설정이 저장되었습니다.');
                    }}
                      className="w-full py-3 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-sm active:scale-[0.98]">
                      💾 이메일 설정 저장
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════ */}
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
                                        <div className="w-full py-2 bg-emerald-950/40 text-emerald-400 text-center rounded-lg border border-emerald-500/20 text-[11px] font-extrabold flex items-center justify-center gap-1 animate-fadeIn select-none">
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
                                                setActiveTab('open-requests');
                                                alert('플랫폼의 신규 상담 탭으로 즉시 안전하게 스위칭하여 의뢰인 상세 명세를 조회합니다.');
                                              }}
                                              className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-[#86959E] text-[10px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                            >
                                              💻 CRM 상세보기
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => alert('30분 후 해당 채무자의 상담 응답 미결 상태를 텔레그램 그룹방에 다시 리마인드 호출합니다.')}
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
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm animate-fadeIn">
                <RehabSettingsPanel mode="lawyer" />
              </div>
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

      {/* ── 고객 제안서 초안 모달 (통합: LawyerProposalDraft) ── */}
      {proposalModalReqId && proposalRehabResult && proposalRehabInput && (
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

    </div>
    </div>
  );
}
