import React, { useState, useEffect } from 'react';
import { 
  Briefcase, BarChart2, Shield, MessageSquare, ListCheck, FolderHeart, 
  Clock, Plus, Trash2, Send, Save, CreditCard, ChevronRight, CheckCircle2, Check, ExternalLink,
  Users, LogOut, Lock, Settings, MapPin, Bell, Smartphone
} from 'lucide-react';
import { 
  ConsultRequest, User, ConsultMessage, Case, CaseStatus, ConsultStatus, Member, ActivityLog, MemberRole, PlatformConfig 
} from '../types';
import { platformPlans, mockLawyers } from '../data';
import { ChatDisclaimer } from './Disclaimers';
import { calculateRepayment, RehabUserInput } from '../rehab-chatbot-package/services/calculationService';
import CrmTab from './lawyer/CrmTab';
import StaffManagementTab from './lawyer/StaffManagementTab';
import { usePermissions } from '../hooks/usePermissions';
import type { StaffMember, StaffRole as StaffRoleType } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';
import { validateInviteToken, consumeInviteToken } from '../services/inviteService';
import { loadStaffMembers } from '../services/crmService';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

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
  platformConfig
}: LawyerRoleProps) {
  // Lawyer sub navigation inside legal CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'open-requests' | 'cases' | 'billing' | 'client-crm' | 'staff-management' | 'settings'>('dashboard');
  
  // Mobile UI navigation controls
  const [mobilePane, setMobilePane] = useState<'threads' | 'chat' | 'crm'>('threads');
  const [mobileStageFilter, setMobileStageFilter] = useState<'document' | 'filing' | 'commencement' | 'approval' | 'discharge'>('document');

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('legal_crm_lawyer_session') !== null;
  });
  const [activeLawyer, setActiveLawyer] = useState<User>(() => {
    const sessionLawyerId = localStorage.getItem('legal_crm_lawyer_session');
    if (sessionLawyerId) {
      return mockLawyers[0];
    }
    return mockLawyers[0];
  });

  // Sync activeLawyer when lawyers prop updates
  useEffect(() => {
    const sessionLawyerId = localStorage.getItem('legal_crm_lawyer_session');
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

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Invite token states
  const [inviteToken, setInviteToken] = useState<string>('');
  const [inviteTokenValid, setInviteTokenValid] = useState<boolean>(false);
  const [inviteTokenRole, setInviteTokenRole] = useState<StaffRoleType>('CONSULTANT');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Active staff member (for RBAC)
  const [activeStaffMember, setActiveStaffMember] = useState<StaffMember | null>(null);
  const permissionCtx = usePermissions(activeStaffMember);

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
          localStorage.removeItem('legal_crm_lawyer_session');
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
            localStorage.removeItem('legal_crm_lawyer_session');
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

    // Bypass password check for simple bypass account
    if (cleanedLoginId !== '1' && found.password && found.password !== loginPassword) {
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

    localStorage.setItem('legal_crm_lawyer_session', found.id);
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
          localStorage.setItem('legal_crm_lawyer_session', matchedLawyer.id);
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
      localStorage.removeItem('legal_crm_lawyer_session');
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

  // ── 제안서 모달 상태 ──
  const [proposalModalReqId, setProposalModalReqId] = useState<string | null>(null);
  const [proposalForm, setProposalForm] = useState({
    feasibility: '',
    monthlyPayment: 0,
    duration: 36,
    reductionRate: 0,
    fee: 0,
    installment: '',
    remark: ''
  });

  // Submit a proposal (replaces handleJoinConsult)
  const handleSubmitProposal = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    const totalReduction = Math.round(req.financialProfile.debtTotal * proposalForm.reductionRate / 100);
    const firmNames = ['법무법인 한빛', '하늘 법률사무소', '법무법인 해원', '법무법인 정의'];

    const newProposal = {
      id: `prop-${Date.now()}`,
      lawyerId: activeLawyer.id,
      lawyerName: activeLawyer.name,
      lawyerAvatar: activeLawyer.avatar,
      firmName: firmNames[Math.floor(Math.random() * firmNames.length)],
      feasibility: proposalForm.feasibility,
      monthlyPayment: proposalForm.monthlyPayment,
      duration: proposalForm.duration,
      reductionRate: proposalForm.reductionRate,
      totalReduction,
      fee: proposalForm.fee,
      installment: proposalForm.installment,
      remark: proposalForm.remark,
      createdAt: new Date().toISOString()
    };

    setRequests(prev => prev.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          status: 'responding' as const,
          proposals: [...(r.proposals || []), newProposal]
        };
      }
      return r;
    }));

    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CONSULT_REQUEST',
      `의뢰인에게 솔루션/비용 제안서 발송 (수임료: ${proposalForm.fee}만원, 예상 탕감률: ${proposalForm.reductionRate}%)`
    );

    // Reset form & close modal
    setProposalForm({ feasibility: '', monthlyPayment: 0, duration: 36, reductionRate: 0, fee: 0, installment: '', remark: '' });
    setProposalModalReqId(null);
    alert('제안서가 의뢰인에게 성공적으로 발송되었습니다.');
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

  // Live Statistics
  const totalOpenRequestsCount = requests.filter(r => r.status === 'requested').length;
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
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-5 h-5 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span>
                <span>Google 계정으로 로그인</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-bold">또는 이메일로 로그인</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">아이디 (이름 또는 ID)</label>
                  <input 
                    type="text" 
                    placeholder="예: 1 또는 김우진 또는 lawyer-1"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">비밀번호</label>
                  <input 
                    type="password" 
                    placeholder="비밀번호 입력 (기본: 1)"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900 placeholder-slate-400"
                  />
                </div>

                {/* Quick test login info */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[13px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-600 block">🔑 테스트 로그인 계정 정보</span>
                  <div>• 아이디: <strong className="text-slate-900">1</strong> / 비밀번호: <strong className="text-slate-900">1</strong></div>
                  <div>• (또는 변호사명: <strong className="text-slate-700">김우진</strong> / 비밀번호: <strong className="text-slate-700">1234</strong>)</div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    type="submit"
                    className="flex-1 bg-brand hover:bg-brand-hover text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md"
                  >
                    로그인
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const demoLawyer = lawyers.find(l => l.id === 'lawyer-1') || lawyers[0] || mockLawyers[0];
                      localStorage.setItem('legal_crm_lawyer_session', demoLawyer.id);
                      setActiveLawyer(demoLawyer);
                      setIsLoggedIn(true);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-brand font-extrabold py-3 rounded-[200px] text-xs border border-slate-200 transition-colors"
                  >
                    테스트 계정 1초 로그인
                  </button>
                </div>
              </form>

              {/* 비밀번호 찾기 */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(!showPasswordReset)}
                  className="text-xs text-slate-400 hover:text-brand transition-colors font-medium"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              {showPasswordReset && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <p className="text-xs text-slate-600">가입 시 사용한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="이메일 주소 입력"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold transition-colors"
                  >
                    비밀번호 재설정 링크 발송
                  </button>
                </div>
              )}

              <div className="text-center pt-1 text-xs text-slate-500">
                계정이 없으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('signup')}
                  className="text-brand font-bold hover:underline"
                >
                  회원가입하기
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-left max-h-[450px] overflow-y-auto pr-1 scrollbar-hide">
              <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">회원가입</h3>
              {signupError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl">
                  {signupError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">아이디 (ID)*</label>
                  <input 
                    type="text" 
                    placeholder="예: lawyer-kim"
                    value={signupId}
                    onChange={(e) => setSignupId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">비밀번호*</label>
                  <input 
                    type="password" 
                    placeholder="비밀번호 입력"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">이름 (성명)*</label>
                  <input 
                    type="text" 
                    placeholder="예: 홍길동"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">역할 구분*</label>
                  <select 
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as 'LAWYER' | 'STAFF')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  >
                    <option value="LAWYER">변호사 (LAWYER)</option>
                    <option value="STAFF">실장/사무장 (STAFF)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-600 block uppercase font-bold">전문분야 (쉼표로 구분)</label>
                <input 
                  type="text" 
                  placeholder="예: 개인회생, 개인파산, 보정명령대응"
                  onChange={(e) => setSignupFields(e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-600 block uppercase font-bold">활동 지역</label>
                <input 
                  type="text" 
                  placeholder="예: 서울, 경기/수원, 부산"
                  value={signupRegion}
                  onChange={(e) => setSignupRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-600 block uppercase font-bold">프로필 사진 업로드</label>
                <div className="flex items-center gap-3">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="프로필 미리보기" className="w-12 h-12 rounded-xl object-cover border border-brand/30 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-[12px] shrink-0 border border-slate-200">사진</div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-2.5 text-xs text-slate-500 text-center hover:border-brand/50 transition-colors">
                      📷 클릭하여 프로필 사진 선택
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 변호사 등록증 첨부 (핵심 자격 증빙) */}
              <div className="space-y-1.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <label className="text-[12px] text-amber-600 block uppercase font-bold">📋 변호사 등록증 첨부 (필수 자격 증빙)*</label>
                <p className="text-[12px] text-slate-600 leading-relaxed">관리자가 등록증을 확인한 후 계정이 승인됩니다. 이미지 또는 PDF 파일을 첨부해주세요.</p>
                <label className="block cursor-pointer">
                  <div className={`border ${licensePreview ? 'border-emerald-300' : 'border-slate-200 border-dashed'} rounded-xl p-3 text-xs text-center transition-colors hover:border-brand/50 bg-white`}>
                    {licensePreview ? (
                      <div className="space-y-2">
                        <img src={licensePreview} alt="등록증 미리보기" className="max-h-32 mx-auto rounded-lg object-contain" />
                        <span className="text-emerald-600 text-[12px] font-bold">✅ 파일 첨부 완료 — 다시 선택하려면 클릭</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">📎 클릭하여 변호사 등록증 이미지 첨부 (최대 5MB)</span>
                    )}
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleLicenseFileChange} className="hidden" />
                </label>
                <div className="space-y-1.5 pt-1">
                  <label className="text-[12px] text-slate-600 block uppercase font-bold">변호사 등록번호</label>
                  <input
                    type="text"
                    placeholder="예: 12345"
                    value={signupLicenseNumber}
                    onChange={(e) => setSignupLicenseNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-600 block uppercase font-bold">소개 약력(Bio)</label>
                <textarea 
                  rows={2}
                  placeholder="전문 대리인으로서의 약력 및 인사말을 작성하세요."
                  value={signupBio}
                  onChange={(e) => setSignupBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md mt-2"
              >
                신규 대리인 등록 완료
              </button>
              <div className="text-center pt-2 text-xs text-slate-500">
                이미 계정이 있으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('login')}
                  className="text-brand font-bold hover:underline"
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
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-slate-50 border-x border-slate-200 shadow-2xl flex flex-col relative">
      
        {/* Lawyer CRM Premium Header */}
        <header className="sticky top-0 z-40 bg-white backdrop-blur-md border-b border-slate-200 shadow-xl px-4 py-3">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="my김변 로고" className="w-8 h-8 rounded-lg object-cover" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-sm tracking-tight text-white">{(platformConfig.siteLogoText || "my김변")} 변호사 CRM</span>
                  <span className="bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded font-extrabold text-[11px] tracking-wider uppercase">SaaS</span>
                </div>
                <span className="text-[12px] text-slate-500 mt-0.5">도산 전문 법률 대리인 지부</span>
              </div>
              <span className="text-slate-700 text-xs hidden sm:inline ml-2 border-l border-slate-200 pl-3">팀: {activeLawyer.name.split(' ')[0]} 법률지부</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img 
                  src={activeLawyer.avatar} 
                  alt={activeLawyer.name} 
                  className="w-7 h-7 rounded-full object-cover border border-brand/30" 
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-700 leading-none">{activeLawyer.name}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">{activeLawyer.role}</span>
                </div>
              </div>
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-100 text-slate-450 hover:text-white px-2.5 py-1.5 rounded-[200px] border border-slate-200 text-[12px] transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </header>

        {/* Primary tab navigation row — RBAC 가드 적용 */}
        <div className="bg-white border-b border-slate-200 px-4">
          <div className="w-full flex overflow-x-auto gap-4 py-2 text-xs font-semibold scrollbar-hide">
            {permissionCtx.canAccessTab('dashboard') && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'dashboard' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>종합 대시보드</span>
              </button>
            )}
            
            {permissionCtx.canAccessTab('open-requests') && (
              <button 
                onClick={() => setActiveTab('open-requests')}
                className={`relative pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'open-requests' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>신규 상담 요청</span>
                {totalOpenRequestsCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[11px] animate-pulse">
                    {totalOpenRequestsCount}
                  </span>
                )}
              </button>
            )}

            {permissionCtx.canAccessTab('client-crm') && (
              <button 
                onClick={() => setActiveTab('client-crm')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'client-crm' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>고객 관리 (CRM)</span>
                <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 text-[11px]">
                  {requests.length}
                </span>
              </button>
            )}

            {permissionCtx.canAccessTab('cases') && (
              <button 
                onClick={() => setActiveTab('cases')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'cases' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <FolderHeart className="w-4 h-4" />
                <span>진행 중인 수임 사건 (SaaS)</span>
                <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 text-[11px]">
                  {totalCasesCount}
                </span>
              </button>
            )}

            {permissionCtx.canAccessTab('billing') && (
              <button 
                onClick={() => setActiveTab('billing')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'billing' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>이용 요금제 / 빌링</span>
              </button>
            )}

            {permissionCtx.canAccessTab('staff-management') && (
              <button 
                onClick={() => setActiveTab('staff-management')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'staff-management' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>직원 관리</span>
              </button>
            )}

            {permissionCtx.canAccessTab('settings') && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                  activeTab === 'settings' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>알림 및 연동 설정</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Workspace Frame */}
        <main className="flex-1 w-full px-4 py-6 overflow-y-auto">

        {/* TAB 1: LAWYER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* 섹션 1: 상단 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[12px] text-slate-600 block uppercase font-bold">신규 상담 요청</span>
                  <span className="text-2xl font-black text-brand">{totalOpenRequestsCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand/10 text-brand">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[12px] text-slate-600 block uppercase font-bold">내게 지정된 응답 대기</span>
                  <span className="text-2xl font-black text-amber-400">{directCounselingCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-400/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[12px] text-slate-600 block uppercase font-bold">진행 중인 상담</span>
                  <span className="text-2xl font-black text-emerald-400">{activeChatsCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-400/10 text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[12px] text-slate-600 block uppercase font-bold">수임 전환 성공</span>
                  <span className="text-2xl font-black text-purple-400">{totalCasesCount}건</span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-400/10 text-purple-400">
                  <FolderHeart className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* 섹션 2: 신규 상담 요청 미리보기 */}
              <div className="lg:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-brand" />
                    <span>지금 상담을 기다리는 의뢰인</span>
                  </h3>
                  <span className="text-[12px] text-slate-500">{totalOpenRequestsCount}건 대기 중</span>
                </div>

                <div className="space-y-3">
                  {requests
                    .filter(r => r.status === 'requested')
                    .slice(0, 3)
                    .map(r => (
                      <div key={r.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-brand/30 transition-all space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              r.requestType === 'direct'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-brand/10 text-brand border border-brand/20'
                            }`}>
                              {r.requestType === 'direct' ? '단독지명' : '오픈형'}
                            </span>
                            {r.entryCategory && (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                r.entryCategory.type === 'debt_type' ? 'bg-violet-500/10 text-violet-600 border border-violet-500/20' :
                                r.entryCategory.type === 'solution' ? 'bg-teal-500/10 text-teal-600 border border-teal-500/20' :
                                'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}>
                                {r.entryCategory.type === 'debt_type' ? '💳 ' : r.entryCategory.type === 'solution' ? '⚖️ ' : ''}{r.entryCategory.label}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700">{r.clientName}</span>
                          </div>
                          <span className="text-[12px] text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-1 leading-relaxed">{r.content}</p>

                        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 text-[13px]">
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">총 채무</span>
                            <span className="font-bold text-red-400">{r.financialProfile.debtTotal.toLocaleString()}만</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">월 소득</span>
                            <span className="font-bold text-slate-700">{r.financialProfile.income}만</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">직업</span>
                            <span className="font-bold text-slate-700">
                              {r.financialProfile.jobType === 'SALARIED' ? '급여소득' : r.financialProfile.jobType === 'BUSINESS' ? '영업소득' : r.financialProfile.jobType === 'DAILY' ? '일용직' : r.financialProfile.jobType === 'FREELANCER' ? '프리랜서' : '-'}
                            </span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">채무 원인</span>
                            <span className="font-bold text-slate-700">
                              {r.financialProfile.debtCause === 'LIVING' ? '생활비' : r.financialProfile.debtCause === 'BUSINESS' ? '사업실패' : r.financialProfile.debtCause === 'INVESTMENT' ? '투자실패' : r.financialProfile.debtCause === 'GAMBLING' ? '도박' : r.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}
                            </span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">소득대비 부채</span>
                            <span className="font-bold text-red-400">{(r.financialProfile.debtTotal / (r.financialProfile.income * 12 || 1)).toFixed(1)}배</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 text-[13px]">
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">나이</span>
                            <span className="font-bold text-slate-700">{r.financialProfile.age ? `${r.financialProfile.age}세` : '-'}</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">가구원 수</span>
                            <span className="font-bold text-slate-700">{r.financialProfile.dependents + 1}인 가구</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">미성년 자녀</span>
                            <span className="font-bold text-slate-700">{r.financialProfile.minorChildren !== undefined ? `${r.financialProfile.minorChildren}명` : '-'}</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">혼인 상태</span>
                            <span className="font-bold text-slate-700">{r.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : r.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 block text-[11px] font-bold">{r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none' ? '⚡ 특례' : '거주형태'}</span>
                            <span className={`font-bold ${r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none' ? 'text-emerald-500' : 'text-slate-700'}`}>
                              {r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none'
                                ? (r.financialProfile.specialCondition === 'basic_recipient' ? '기초수급 (24개월)' : r.financialProfile.specialCondition === 'severe_disability' ? '중증장애 (24개월)' : '고령자 (24개월)')
                                : (r.financialProfile.housingType === 'rent' ? '월세' : r.financialProfile.housingType === 'jeonse' ? '전세' : r.financialProfile.housingType === 'owned' ? '자가' : r.financialProfile.housingType === 'free' ? '무상거주' : '-')}
                            </span>
                          </div>
                        </div>

                        {r.financialProfile.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.financialProfile.riskFlags.slice(0, 3).map(rf => (
                              <span key={rf} className="bg-red-500/10 text-red-400 border border-red-500/10 text-[11px] px-1.5 py-0.5 rounded font-semibold">
                                ⚠ {rf}
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => setActiveTab('open-requests')}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-brand font-bold py-2 rounded-[200px] text-[13px] border border-slate-200 transition-colors flex items-center justify-center gap-1"
                        >
                          상세 확인 & 상담 참여하기
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                  {requests.filter(r => r.status === 'requested').length === 0 && (
                    <div className="py-12 text-center space-y-2">
                      <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500">현재 대기 중인 신규 상담 요청이 없습니다.</p>
                      <p className="text-[12px] text-slate-500">의뢰인이 상담을 요청하면 이곳에 표시됩니다.</p>
                    </div>
                  )}
                </div>

                {requests.filter(r => r.status === 'requested').length > 3 && (
                  <button
                    onClick={() => setActiveTab('open-requests')}
                    className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-2.5 rounded-[200px] text-xs transition-colors"
                  >
                    전체 상담 요청 {totalOpenRequestsCount}건 모두 보기 &rarr;
                  </button>
                )}
              </div>

              {/* 섹션 3: 나의 상담 활동 요약 */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-3">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  <span>나의 상담 활동</span>
                </h3>

                {(() => {
                  const myParticipated = requests.filter(r => r.selectedLawyerId === activeLawyer.id).length;
                  const myCounseling = requests.filter(r => r.status === 'counseling' && r.selectedLawyerId === activeLawyer.id).length;
                  const myCases = cases.filter(c => c.assignedLawyerId === activeLawyer.id).length;
                  const conversionRate = myParticipated > 0 ? Math.round((myCases / myParticipated) * 100) : 0;
                  return (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">총 상담 참여</span>
                          <span className="font-black text-slate-700">{myParticipated}건</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">현재 진행 중</span>
                          <span className="font-black text-emerald-400">{myCounseling}건</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">수임 전환 성공</span>
                          <span className="font-black text-purple-400">{myCases}건</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">전환율</span>
                          <span className={`font-black ${conversionRate >= 40 ? 'text-emerald-400' : conversionRate >= 20 ? 'text-amber-400' : 'text-slate-600'}`}>{conversionRate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${conversionRate >= 40 ? 'bg-emerald-500' : conversionRate >= 20 ? 'bg-amber-500' : 'bg-slate-300'}`}
                            style={{ width: `${Math.min(100, conversionRate)}%` }}
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4">
                        <div className="bg-brand/5 border border-brand/10 rounded-xl p-3 space-y-1.5">
                          <span className="text-[12px] font-black text-brand uppercase tracking-wide">💡 상담 TIP</span>
                          <p className="text-[13px] text-slate-600 leading-relaxed">
                            의뢰인의 채무 원인에 맞춘 구체적인 해결 방안을 제시하면 수임 전환율이 높아집니다. 채무 구조를 꼼꼼히 분석해 보세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: INCOMING COUNSEL REQUESTS LIST */}
        {activeTab === 'open-requests' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">오픈 및 지정 상담 요청 대기 대시보드</h2>
                <p className="text-xs text-slate-500 mt-0.5">상세 채무 구조와 가용 가계 소득 진단 통계를 검토 후 참여하십시오.</p>
              </div>

              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                전공 연도: 회생파산 전담팀 R-1
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {requests
                .filter(r => (r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id) && (r.status === 'requested' || r.status === 'responding'))
                .filter(r => !(r.proposals || []).some(p => p.lawyerId === activeLawyer.id))
                .map(r => {
                  const debtRatio = (r.financialProfile.debtTotal / (r.financialProfile.income * 12)).toFixed(1);
                  return (
                    <div key={r.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-slate-200 transition-all flex flex-col md:flex-row justify-between gap-6">
                      
                      {/* Left: Client detailed debt statistics query */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-brand/10 text-brand font-bold px-2 py-0.5 rounded text-[12px]">
                            {r.requestType === 'direct' ? '단독지명' : r.requestType === 'direct_multi' ? '의뢰인 지정' : '오픈형'}
                          </span>
                          {r.entryCategory && (
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              r.entryCategory.type === 'debt_type' ? 'bg-violet-500/10 text-violet-600 border border-violet-500/20' :
                              r.entryCategory.type === 'solution' ? 'bg-teal-500/10 text-teal-600 border border-teal-500/20' :
                              'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {r.entryCategory.type === 'debt_type' ? '💳 관심 채무: ' : r.entryCategory.type === 'solution' ? '⚖️ 관심 해결방법: ' : ''}{r.entryCategory.label}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">의뢰인: <strong>{r.clientName}</strong></span>
                          <span className="text-xs text-slate-600">|</span>
                          <span className="text-xs text-slate-500">등록일: {new Date(r.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-slate-900">{r.title}</h3>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{r.content}</p>
                        </div>

                        {/* Calculations Panel */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg text-[13px] text-slate-500 border border-slate-855">
                          <div>• 총 가계 채무: <strong className="text-red-500 font-extrabold">{r.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                          <div>• 기재 자산수준: <strong className="text-slate-700 font-semibold">{r.financialProfile.assetsTotal.toLocaleString()}만 원</strong></div>
                          <div>• 월 가중소득: <strong className="text-slate-700 font-semibold">{r.financialProfile.income}만 원</strong></div>
                          <div>• 소득 대비 부채비: <strong className="text-red-400 font-bold">{debtRatio}배 수준</strong></div>
                        </div>

                        {/* 인적사항 요약 패널 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-blue-50/50 p-3 rounded-lg text-[13px] text-slate-500 border border-blue-100">
                          <div>• 나이: <strong className="text-slate-700 font-semibold">{r.financialProfile.age ? `${r.financialProfile.age}세` : '미기재'}</strong></div>
                          <div>• 가구원 수: <strong className="text-slate-700 font-semibold">{r.financialProfile.dependents + 1}인 가구 (부양 {r.financialProfile.dependents}명)</strong></div>
                          <div>• 미성년 자녀: <strong className="text-slate-700 font-semibold">{r.financialProfile.minorChildren !== undefined ? `${r.financialProfile.minorChildren}명` : '미기재'}</strong></div>
                          <div>• 혼인 상태: <strong className="text-slate-700 font-semibold">{r.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : r.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</strong></div>
                        </div>

                        {/* Expanded Legal Profile details */}
                        {r.financialProfile.jobType && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 bg-slate-50 p-3 rounded-lg text-[12px] text-slate-450 border border-slate-850">
                            <div>• 직업유형: <strong className="text-slate-600">{r.financialProfile.jobType === 'SALARIED' ? '급여소득' : r.financialProfile.jobType === 'BUSINESS' ? '영업소득' : r.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'} ({r.financialProfile.companyName || '미기재'})</strong></div>
                            <div>• 거주지역: <strong className="text-slate-600">{r.financialProfile.residenceRegion || '미기재'}</strong></div>
                            <div>• 채무원인: <strong className="text-slate-600">{r.financialProfile.debtCause === 'LIVING' ? '생활비' : r.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : r.financialProfile.debtCause === 'INVESTMENT' ? `투자 실패${r.financialProfile.speculativeLoss ? ` (${r.financialProfile.speculativeLoss.toLocaleString()}만원)` : ''}` : r.financialProfile.debtCause === 'GAMBLING' ? `도박/사행성${r.financialProfile.gamblingLoss ? ` (${r.financialProfile.gamblingLoss.toLocaleString()}만원)` : ''}` : r.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</strong></div>
                            <div>• 채권자수 / 추심: <strong className="text-amber-400">{r.financialProfile.creditorCount || 0}곳 / {r.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : r.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : r.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '가압류/압류'}</strong></div>

                            {/* 추가 상세 정보 - 주거/배우자/특례 */}
                            <div>• 거주형태: <strong className="text-slate-600">{r.financialProfile.housingType === 'rent' ? '월세' : r.financialProfile.housingType === 'jeonse' ? '전세' : r.financialProfile.housingType === 'owned' ? '자가' : r.financialProfile.housingType === 'free' ? '무상거주' : '미기재'}{r.financialProfile.housingContractHolder ? ` (${r.financialProfile.housingContractHolder === 'self' ? '본인명의' : r.financialProfile.housingContractHolder === 'spouse' ? '배우자명의' : '타인명의'})` : ''}</strong></div>
                            {r.financialProfile.maritalStatus === 'MARRIED' && (
                              <div>• 배우자 소득: <strong className="text-slate-600">{r.financialProfile.spouseIncome !== undefined ? `${r.financialProfile.spouseIncome.toLocaleString()}만 원` : '미기재'}</strong></div>
                            )}
                            {r.financialProfile.monthlyFixedExpenses !== undefined && r.financialProfile.monthlyFixedExpenses > 0 && (
                              <div>• 월 고정지출: <strong className="text-slate-600">{r.financialProfile.monthlyFixedExpenses.toLocaleString()}만 원</strong></div>
                            )}
                            {r.financialProfile.specialCondition && r.financialProfile.specialCondition !== 'none' && (
                              <div className="col-span-2 sm:col-span-4 mt-1 border-t border-emerald-200/50 pt-1">
                                <span className="bg-emerald-500/10 text-emerald-600 text-[11px] px-2 py-0.5 rounded font-black border border-emerald-500/20">
                                  ⚡ 24개월 특례 해당: {r.financialProfile.specialCondition === 'basic_recipient' ? '기초생활수급자' : r.financialProfile.specialCondition === 'severe_disability' ? '중증장애인' : '고령자 (70세 이상)'}
                                </span>
                              </div>
                            )}

                            {r.financialProfile.retirementPay !== undefined && r.financialProfile.retirementPay > 0 && (
                              <div className="col-span-2 sm:col-span-4 mt-1 border-t border-slate-900/30 pt-1 flex items-center justify-between text-slate-500">
                                <span>💼 예상 퇴직금: <strong className="text-slate-600">{r.financialProfile.retirementPay.toLocaleString()}만원</strong> ({r.financialProfile.retirementPensionType === 'pension' ? '퇴직연금 가입 - 0% 반영' : r.financialProfile.retirementPensionType === 'none' ? '퇴직연금 미가입 - 50% 반영' : '퇴직연금 종류 모름 - 50% 반영'})</span>
                                {r.financialProfile.retirementPensionType === 'unknown' && (
                                  <span className="bg-amber-500/20 text-amber-400 text-[11px] px-1.5 py-0.5 rounded font-black border border-amber-500/30 animate-pulse">
                                    ⚠️ 퇴직연금 확인 필요
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {r.financialProfile.retirementPensionType === 'unknown' && (
                          <div className="pt-1">
                            <span className="bg-amber-500/10 text-amber-400 text-[12px] px-2 py-0.5 rounded font-semibold border border-amber-500/10">
                              ⚠️ 예상 퇴직금 조회 및 퇴직연금 가입 형태 확인 필요 (챗봇 모름 선택)
                            </span>
                          </div>
                        )}

                        {r.financialProfile.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {r.financialProfile.riskFlags.map(rf => (
                              <span key={rf} className="bg-red-500/10 text-red-400 text-[12px] px-2 py-0.5 rounded font-semibold border border-red-500/10">
                                ⚠️ {rf}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 의뢰인 메모 */}
                        {r.financialProfile.clientNote && (
                          <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-lg p-3 mt-1">
                            <div className="flex items-start gap-2">
                              <span className="text-base shrink-0">📝</span>
                              <div>
                                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">의뢰인 전달 메모</span>
                                <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{r.financialProfile.clientNote}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Quick action panel to "솔루션 및 비용 제안" */}
                      <div className="md:w-60 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 gap-4">
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex justify-between"><span>지정 변호사 수:</span> <strong className="text-slate-700">{r.selectedLawyerIds?.length || r.maxParticipants}명</strong></div>
                          <div className="flex justify-between"><span>현재 상태:</span> <strong className="text-brand font-bold">제안서 작성 대기</strong></div>
                        </div>

                        <button 
                          onClick={() => setProposalModalReqId(r.id)}
                          className="w-full bg-brand hover:bg-brand-hover text-white font-black py-2.5 rounded-[200px] text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>솔루션 및 비용 제안</span>
                        </button>
                      </div>

                    </div>
                  );
                })}

              {requests.filter(r => (r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id) && (r.status === 'requested' || r.status === 'responding')).filter(r => !(r.proposals || []).some(p => p.lawyerId === activeLawyer.id)).length === 0 && (
                <div className="bg-slate-50 p-12 text-center rounded-xl border border-slate-200 text-slate-600 text-xs">
                  현재 즉시 대응할 신규 상담 신청 건이 존재하지 않습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: (실시간 협업실 채팅 - 추후 추가 예정) */}
        {false && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[700px] animate-fadeIn">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className={`lg:col-span-3 border-r border-slate-200 flex flex-col h-full bg-white ${mobilePane === 'threads' ? 'block' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-slate-200 bg-slate-50/40">
                <h3 className="font-extrabold text-xs text-slate-700 tracking-wider uppercase">상담 진행 메시지함</h3>
                <p className="text-slate-600 text-[12px] mt-0.5">실시간 매칭된 나의 세션 내역</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200 h-[400px] scrollbar-hide">
                {requests
                  .filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open'))
                  .map(r => {
                    const isSelected = r.id === activeChatReqId;
                    return (
                      <div 
                        key={r.id}
                        onClick={() => {
                          setActiveChatReqId(r.id);
                          setMobilePane('chat');
                        }}
                        className={`p-4 cursor-pointer text-left transition-colors space-y-1 ${
                          isSelected ? 'bg-slate-50/90 border-l-4 border-brand font-bold' : 'hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-slate-600">의뢰인: {r.clientName}</span>
                          <span className="text-[12px] text-slate-600">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-700 line-clamp-1">{r.title}</h4>
                        <div className="flex justify-between items-center text-[12px] text-slate-500 pt-0.5">
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
                  <div className="p-8 text-center text-slate-600 text-[13px] space-y-2">
                    <p>내가 배정되어 상담 개시 중인 활성 대화방이 없습니다.</p>
                    <button 
                      onClick={() => setActiveTab('open-requests')}
                      className="text-brand font-bold hover:underline"
                    >
                      상담 참여 대기 목록보기 &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL II: ACTIVE MESSAGING BOARD (CENTER) */}
            <div className={`lg:col-span-6 border-r border-slate-200 flex flex-col h-full bg-slate-50 ${mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
                <>
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/40">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Mobile back button */}
                      <button 
                        onClick={() => setMobilePane('threads')}
                        className="lg:hidden flex items-center justify-center text-brand font-bold text-xs border border-brand/20 bg-brand/5 p-2 rounded-xl shrink-0"
                        title="목록으로"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold tracking-widest text-emerald-400 block uppercase">SECURE CHAT CHANNEL</span>
                        <h3 className="font-extrabold text-xs text-slate-700 line-clamp-1">{currentChatRequest.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Mobile toggle to view CRM profile info */}
                      <button 
                        onClick={() => setMobilePane('crm')}
                        className="lg:hidden text-slate-600 hover:text-white font-semibold text-[12px] border border-slate-200 bg-[#161D30] px-2.5 py-1.5 rounded-[200px] transition-all"
                      >
                        의뢰 정보 ℹ️
                      </button>
                      <span className="hidden sm:inline bg-slate-100 border border-slate-200 text-[12px] text-slate-500 px-2 py-0.5 rounded">
                        의뢰채널 id: {currentChatRequest.id}
                      </span>
                    </div>
                  </div>

                  {/* Chat flow messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[350px] scrollbar-hide">
                    <div className="p-3 bg-[#161D30] rounded-xl text-slate-500 text-xs border border-slate-200 text-left whitespace-pre-wrap">
                      📝 <span className="text-brand font-bold">의뢰서 본문 내용:</span> {currentChatRequest.content}
                    </div>

                    {currentChatMessages.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 mb-1 text-[12px] text-slate-600">
                            <span className="font-semibold text-slate-600">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className={`p-3 rounded-xl max-w-sm text-xs leading-normal text-left ${
                            isMe 
                            ? 'bg-brand text-white rounded-tr-none font-semibold' 
                            : 'bg-[#161D30] text-slate-700 rounded-tl-none border border-slate-200'
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Messenger form */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="의뢰인과의 1:1 보정 대화를 입력하십시오..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChat();
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-900 placeholder-slate-400"
                    />
                    <button 
                      onClick={handleSendChat}
                      className="bg-brand hover:bg-brand-hover text-white font-bold p-3 rounded-xl transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-600 bg-slate-50">
                  <MessageSquare className="w-12 h-12 text-slate-900" />
                  <p className="text-xs">왼쪽 메시지함에서 진행 가능한 의뢰인 대화 스레드를 클릭하십시오.</p>
                </div>
              )}
            </div>

            {/* PANEL III: ATTOURNEY CRM RIGHT-RAIL (RIGHT) */}
            <div className={`lg:col-span-3 flex flex-col h-full bg-white overflow-y-auto ${mobilePane === 'crm' ? 'block' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
                <div className="p-4 space-y-6 text-xs divide-y divide-slate-200">
                  
                  {/* Mobile back button */}
                  <div className="lg:hidden pb-1">
                    <button 
                      onClick={() => setMobilePane('chat')}
                      className="w-full flex items-center justify-center gap-1.5 text-brand font-extrabold text-xs border border-brand/20 bg-brand/5 py-2.5 rounded-[200px] transition-all"
                    >
                      &larr; 대화방으로 돌아가기
                    </button>
                  </div>

                  {/* Option: Client financial summary info */}
                  <div className="space-y-3 pb-4 pt-4 lg:pt-0">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">📈 1차 가계 진단 분석서</span>
                    
                    <div className="bg-[#111827] p-3 rounded-xl border border-slate-200 space-y-2 text-[13px] text-slate-600">
                      <div className="flex justify-between"><span>의뢰인명:</span> <span className="font-bold text-white">{currentChatRequest.clientName}</span></div>
                      <div className="flex justify-between"><span>비상 연락처:</span> <span className="font-mono text-white">{getDisplayPhoneNumber(currentChatRequest)}</span></div>
                      {currentChatRequest.financialProfile.age && (
                        <div className="flex justify-between"><span>나이:</span> <span className="text-white font-bold">{currentChatRequest.financialProfile.age}세</span></div>
                      )}
                      <div className="flex justify-between"><span>월 소득계산:</span> <span className="font-bold text-brand">{currentChatRequest.financialProfile.income}만 원</span></div>
                      <div className="flex justify-between table-auto"><span>총 채무진단:</span> <span className="font-bold text-red-400">{currentChatRequest.financialProfile.debtTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span>자산수준합산:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.assetsTotal.toLocaleString()}만 원</span></div>
                      {currentChatRequest.financialProfile.myAssets !== undefined && currentChatRequest.financialProfile.myAssets > 0 && (
                        <div className="flex justify-between"><span>  ∟ 본인 재산:</span> <span className="text-slate-600">{currentChatRequest.financialProfile.myAssets.toLocaleString()}만 원</span></div>
                      )}
                      <div className="flex justify-between"><span>부양 가족수:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.dependents}명 ({currentChatRequest.financialProfile.dependents + 1}인 가구)</span></div>
                      {currentChatRequest.financialProfile.minorChildren !== undefined && (
                        <div className="flex justify-between"><span>  ∟ 미성년 자녀:</span> <span className="text-white font-semibold">{currentChatRequest.financialProfile.minorChildren}명</span></div>
                      )}
                      <div className="flex justify-between"><span>결혼 자격구조:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : currentChatRequest.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span></div>
                      
                      {/* 24개월 특례 표시 */}
                      {currentChatRequest.financialProfile.specialCondition && currentChatRequest.financialProfile.specialCondition !== 'none' && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded text-[12px] text-emerald-400 font-bold text-center">
                          ⚡ 24개월 특례 해당: {currentChatRequest.financialProfile.specialCondition === 'basic_recipient' ? '기초생활수급자' : currentChatRequest.financialProfile.specialCondition === 'severe_disability' ? '중증장애인' : '고령자 (70세 이상)'}
                        </div>
                      )}

                      {currentChatRequest.financialProfile.jobType && (
                        <>
                          <div className="border-t border-slate-200 my-1.5 pt-1.5 flex justify-between">
                            <span>직업 유형:</span> 
                            <span className="text-white font-bold">
                              {currentChatRequest.financialProfile.jobType === 'SALARIED' ? '급여소득' : currentChatRequest.financialProfile.jobType === 'BUSINESS' ? '영업소득' : currentChatRequest.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                              {currentChatRequest.financialProfile.companyName && ` (${currentChatRequest.financialProfile.companyName})`}
                            </span>
                          </div>
                          <div className="flex justify-between"><span>거주 지역:</span> <span className="text-white">{currentChatRequest.financialProfile.residenceRegion}</span></div>
                          
                          {/* 주거 상세 정보 */}
                          <div className="flex justify-between"><span>거주 형태:</span> <span className="text-white">{currentChatRequest.financialProfile.housingType === 'rent' ? '월세' : currentChatRequest.financialProfile.housingType === 'jeonse' ? '전세' : currentChatRequest.financialProfile.housingType === 'owned' ? '자가' : currentChatRequest.financialProfile.housingType === 'free' ? '무상거주' : '-'}{currentChatRequest.financialProfile.housingContractHolder ? ` (${currentChatRequest.financialProfile.housingContractHolder === 'self' ? '본인명의' : currentChatRequest.financialProfile.housingContractHolder === 'spouse' ? '배우자명의' : '타인명의'})` : ''}</span></div>
                          
                          <div className="flex justify-between"><span>임차 보증금:</span> <span className="text-white">{currentChatRequest.financialProfile.rentalDeposit?.toLocaleString()}만 원</span></div>
                          {currentChatRequest.financialProfile.depositLoan !== undefined && currentChatRequest.financialProfile.depositLoan > 0 && (
                            <div className="flex justify-between"><span>  ∟ 보증금 대출:</span> <span className="text-rose-300">{currentChatRequest.financialProfile.depositLoan.toLocaleString()}만 원</span></div>
                          )}
                          
                          {currentChatRequest.financialProfile.maritalStatus === 'MARRIED' && (
                            <>
                              <div className="flex justify-between"><span>배우자 재산:</span> <span className="text-white">{currentChatRequest.financialProfile.spouseAsset?.toLocaleString()}만 원</span></div>
                              {currentChatRequest.financialProfile.spouseIncome !== undefined && (
                                <div className="flex justify-between"><span>배우자 소득:</span> <span className="text-white">{currentChatRequest.financialProfile.spouseIncome.toLocaleString()}만 원</span></div>
                              )}
                            </>
                          )}

                          {/* 양육비 정보 (이혼 시) */}
                          {currentChatRequest.financialProfile.maritalStatus === 'DIVORCED' && (
                            <>
                              {currentChatRequest.financialProfile.childSupportReceived !== undefined && currentChatRequest.financialProfile.childSupportReceived > 0 && (
                                <div className="flex justify-between"><span>양육비 수령:</span> <span className="text-emerald-400">+{currentChatRequest.financialProfile.childSupportReceived.toLocaleString()}만 원</span></div>
                              )}
                              {currentChatRequest.financialProfile.childSupportPaid !== undefined && currentChatRequest.financialProfile.childSupportPaid > 0 && (
                                <div className="flex justify-between"><span>양육비 지급:</span> <span className="text-rose-300">-{currentChatRequest.financialProfile.childSupportPaid.toLocaleString()}만 원</span></div>
                              )}
                            </>
                          )}

                          <div className="flex justify-between"><span>주된 채무원인:</span> <span className="text-white">{currentChatRequest.financialProfile.debtCause === 'LIVING' ? '생활비' : currentChatRequest.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : currentChatRequest.financialProfile.debtCause === 'INVESTMENT' ? `투자 실패${currentChatRequest.financialProfile.speculativeLoss ? ` (${currentChatRequest.financialProfile.speculativeLoss.toLocaleString()}만원)` : ''}` : currentChatRequest.financialProfile.debtCause === 'GAMBLING' ? `도박/사행성${currentChatRequest.financialProfile.gamblingLoss ? ` (${currentChatRequest.financialProfile.gamblingLoss.toLocaleString()}만원)` : ''}` : currentChatRequest.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</span></div>
                          {currentChatRequest.financialProfile.speculativeLoss !== undefined && currentChatRequest.financialProfile.speculativeLoss > 0 && (
                            <div className="flex justify-between text-rose-400 font-semibold">
                              <span>1년내 주식/코인 손실:</span>
                              <span>{currentChatRequest.financialProfile.speculativeLoss.toLocaleString()}만 원</span>
                            </div>
                          )}
                          {currentChatRequest.financialProfile.gamblingLoss !== undefined && currentChatRequest.financialProfile.gamblingLoss > 0 && (
                            <div className="flex justify-between text-rose-400 font-semibold">
                              <span>1년내 도박 채무금:</span>
                              <span>{currentChatRequest.financialProfile.gamblingLoss.toLocaleString()}만 원</span>
                            </div>
                          )}
                          <div className="flex justify-between text-amber-400"><span>추심 단계:</span> <span>{currentChatRequest.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : currentChatRequest.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : currentChatRequest.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '압류/가압류'}</span></div>
                          {currentChatRequest.financialProfile.legalActions && currentChatRequest.financialProfile.legalActions.length > 0 && currentChatRequest.financialProfile.legalActions.some(x => x !== 'none') && (
                            <div className="flex justify-between text-amber-500">
                              <span>법적 조치 진행:</span>
                              <span className="text-white">
                                {currentChatRequest.financialProfile.legalActions
                                  .filter(x => x !== 'none')
                                  .map(x => ({
                                    collection_call: '독촉',
                                    court_order: '소장수령',
                                    seizure: '급여압류',
                                    property_seizure: '부동산압류',
                                    credit_drop: '신용하락'
                                  }[x] || x))
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between"><span>채권자 기관수:</span> <span className="text-white">{currentChatRequest.financialProfile.creditorCount}곳</span></div>

                          {/* 생계비 상세 섹션 */}
                          {(currentChatRequest.financialProfile.rentCost || currentChatRequest.financialProfile.medicalCost || currentChatRequest.financialProfile.educationCost || currentChatRequest.financialProfile.monthlyFixedExpenses) && (
                            <div className="border-t border-slate-200 my-1.5 pt-1.5 space-y-1">
                              <span className="text-[11px] font-black text-cyan-400 tracking-wide uppercase block">🏠 월 생계비 구성</span>
                              {currentChatRequest.financialProfile.rentCost !== undefined && currentChatRequest.financialProfile.rentCost > 0 && (
                                <div className="flex justify-between"><span>월세:</span> <span className="text-white">{currentChatRequest.financialProfile.rentCost.toLocaleString()}만 원</span></div>
                              )}
                              {currentChatRequest.financialProfile.medicalCost !== undefined && currentChatRequest.financialProfile.medicalCost > 0 && (
                                <div className="flex justify-between"><span>의료비:</span> <span className="text-white">{currentChatRequest.financialProfile.medicalCost.toLocaleString()}만 원</span></div>
                              )}
                              {currentChatRequest.financialProfile.educationCost !== undefined && currentChatRequest.financialProfile.educationCost > 0 && (
                                <div className="flex justify-between"><span>교육비:</span> <span className="text-white">{currentChatRequest.financialProfile.educationCost.toLocaleString()}만 원</span></div>
                              )}
                              {currentChatRequest.financialProfile.specialEducationCost !== undefined && currentChatRequest.financialProfile.specialEducationCost > 0 && (
                                <div className="flex justify-between"><span>특수교육비:</span> <span className="text-white">{currentChatRequest.financialProfile.specialEducationCost.toLocaleString()}만 원</span></div>
                              )}
                              {currentChatRequest.financialProfile.monthlyFixedExpenses !== undefined && currentChatRequest.financialProfile.monthlyFixedExpenses > 0 && (
                                <div className="flex justify-between"><span>고정지출 (통신/보험 등):</span> <span className="text-white">{currentChatRequest.financialProfile.monthlyFixedExpenses.toLocaleString()}만 원</span></div>
                              )}
                            </div>
                          )}

                          {currentChatRequest.financialProfile.retirementPay !== undefined && currentChatRequest.financialProfile.retirementPay > 0 && (
                            <>
                              <div className="border-t border-slate-200 my-1.5 pt-1.5 flex justify-between text-[13px]">
                                <span>예상 퇴직금:</span>
                                <span className="text-white font-bold">{currentChatRequest.financialProfile.retirementPay.toLocaleString()}만 원</span>
                              </div>
                              <div className="flex justify-between text-[13px]">
                                <span>퇴직연금 형태:</span>
                                <span className={currentChatRequest.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                                  {currentChatRequest.financialProfile.retirementPensionType === 'pension' ? '퇴직연금 가입 (0% 반영)' :
                                   currentChatRequest.financialProfile.retirementPensionType === 'none' ? '퇴직연금 미가입 (50% 반영)' : '종류 모름 (50% 반영)'}
                                </span>
                              </div>
                              {currentChatRequest.financialProfile.retirementPensionType === 'unknown' && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[12px] text-amber-400 font-bold mt-1 text-center animate-pulse">
                                  ⚠️ [확인 필요] 예상 퇴직금 조회 및 가입 형태 확인 요망
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {currentChatRequestResult && (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2 text-[13px] text-slate-600 mt-2">
                        <span className="text-[12px] font-black text-emerald-400 tracking-wide uppercase block">💰 실시간 변제 시뮬레이션</span>
                        <div className="flex justify-between"><span>예상 월 변제금:</span> <span className="font-bold text-white">{(currentChatRequestResult.monthlyPayment / 10000).toLocaleString()}만 원 / 월</span></div>
                        <div className="flex justify-between"><span>변제 기간:</span> <span className="text-white">{currentChatRequestResult.repaymentMonths}개월</span></div>
                        <div className="flex justify-between"><span>총 변제금:</span> <span className="text-slate-700">{(currentChatRequestResult.totalRepayment / 10000).toLocaleString()}만 원</span></div>
                        <div className="flex justify-between text-emerald-400 font-semibold">
                          <span>최종 탕감액:</span>
                          <span>{(currentChatRequestResult.totalDebtReduction / 10000).toLocaleString()}만 원 ({currentChatRequestResult.debtReductionRate}%)</span>
                        </div>
                        <div className="flex justify-between"><span>청산가치 (재산):</span> <span className="text-slate-600">{(currentChatRequestResult.liquidationValue / 10000).toLocaleString()}만 원</span></div>
                        
                        <div className="space-y-1 pt-1.5 border-t border-slate-200">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>청산가치 보장율</span>
                            <span className="font-bold text-emerald-400">{Math.round((currentChatRequestResult.totalRepayment / Math.max(1, currentChatRequestResult.liquidationValue)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-[#111827] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full rounded-full" 
                              style={{ width: `${Math.min(100, Math.round((currentChatRequestResult.totalRepayment / Math.max(1, currentChatRequestResult.liquidationValue)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {currentChatRequest.financialProfile.riskFlags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[12px] font-bold text-red-400 block">시스템 자동 추출 리스크 태그:</span>
                        <div className="flex flex-wrap gap-1">
                          {currentChatRequest.financialProfile.riskFlags.map(rf => (
                            <span key={rf} className="bg-red-500/10 text-red-400 border border-red-500/10 text-[11px] px-1.5 py-0.5 rounded uppercase leading-none">
                              {rf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Converting Case: "상담 -> 사건 등록" */}
                  <div className="pt-4 pb-4 space-y-3">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">⚖️ 상담 사건 공식 수임 전환</span>
                    <p className="text-slate-600 text-[12px] leading-relaxed">
                      상담이 성사되어 위임 계약서 서명이 마쳐지면, 본 가입자의 정보를 정식 사건 대장으로 영구 등록해 보정명령 추적을 시작할 수 있습니다.
                    </p>

                    <button 
                      onClick={() => handleConvertToCase(currentChatRequest)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-[200px] text-xs leading-none tracking-wide transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>정식 수임사건으로 신규 전환</span>
                    </button>
                  </div>

                  {/* Internal Law-firm Notes (visible only on Lawyer side) */}
                  <div className="pt-4 space-y-3">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">📌 로펌 내부 협업 및 비망록</span>
                    <p className="text-slate-600 text-[12px]">사무장 및 보조 스태프와 해당 의뢰인의 보정 소명 보조 기록을 메모하는 보안 영역입니다.</p>

                    <textarea
                      rows={4}
                      placeholder="내부 긴급 가이드 및 참고 메모를 작성해 주세요..."
                      value={internalNotes[currentChatRequest.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [currentChatRequest.id]: e.target.value };
                        setInternalNotes(nextNotes);
                      }}
                      className="w-full bg-[#111827] border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-700 placeholder-slate-650"
                    />

                    <span className="text-[12px] text-slate-600 block leading-tight">
                      * 이 비망록은 로펌 구성원 상호 간에만 공유되며 의뢰인 전용 채널에는 절대 전송되지 않습니다.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center text-slate-600 text-[13px] self-center">
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
            <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderHeart className="w-5 h-5 text-brand" />
                  <span>로펌 사건 위임 대장 통합 CRM (소생 및 개인회생 단대)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">서류 준비부터 파산 면책 승인 및 변제 개시 고시까지 일괄적으로 RLS 권한에 의거해 추적합니다.</p>
              </div>

              <div className="flex gap-2">
                <span className="bg-[#111827] border border-slate-200 text-[13px] text-slate-600 px-3 py-1.5 rounded-xl font-semibold">
                  총 감면 탕감 달성액: <strong className="text-emerald-400">11억 4200만 원</strong>
                </span>
              </div>
            </div>

            {/* Mobile Stage Selector Tab bar */}
            <div className="md:hidden flex overflow-x-auto gap-2 py-2 border-b border-slate-200 scrollbar-hide">
              {(['document', 'filing', 'commencement', 'approval', 'discharge'] as const).map(st => {
                const label = st === 'document' ? '서류준비' : st === 'filing' ? '법원접수' : st === 'commencement' ? '개시결정' : st === 'approval' ? '최종인가' : '파산면책';
                const isActive = mobileStageFilter === st;
                const count = cases.filter(c => c.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setMobileStageFilter(st)}
                    className={`px-3.5 py-2 rounded-[200px] text-xs font-extrabold whitespace-nowrap transition-all border ${
                      isActive 
                      ? 'bg-brand/10 text-brand border-brand/50 shadow-sm' 
                      : 'bg-[#111827] text-slate-500 border-slate-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Row structure representing standard case progress:
                서류 -> 접수 -> 개시 -> 인가 -> 면책 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              
              {/* STAGES */}
              {(['document', 'filing', 'commencement', 'approval', 'discharge'] as const).map(stage => {
                const isCurrentMobileStage = stage === mobileStageFilter;
                const stageName = stage === 'document' ? '1. 서류준비' : stage === 'filing' ? '2. 법원접수' : stage === 'commencement' ? '3. 개시결정' : stage === 'approval' ? '4. 최종인가' : '5. 파산면책';
                const stageColor = stage === 'document' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : stage === 'filing' ? 'bg-brand/10 text-brand border-brand/20' : stage === 'commencement' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : stage === 'approval' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                const stageCases = cases.filter(c => c.status === stage);

                return (
                  <div key={stage} className={`bg-white p-3 rounded-2xl border border-slate-200 space-y-3 min-h-[300px] ${
                    isCurrentMobileStage ? 'block' : 'hidden md:block'
                  }`}>
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
                            className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 text-left ${
                              isSelected 
                              ? 'bg-[#111827] border-brand shadow-md ring-1 ring-brand/20' 
                              : 'bg-[#111827]/40 border-slate-200 hover:bg-[#111827] hover:border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="font-bold text-slate-600">{c.clientName} 의뢰인</span>
                              <span className="text-slate-600 text-[11px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>

                            <div className="text-[13px] font-bold text-slate-700">
                              위임채무액: <span className="text-red-500 font-extrabold">{c.debtTotal.toLocaleString()}만 원</span>
                            </div>

                            <p className="text-[12px] text-slate-600 leading-normal line-clamp-1">
                              {c.notes.length > 0 ? `• ${c.notes[0]}` : '기재 메모 없음'}
                            </p>
                          </div>
                        );
                      })}

                      {stageCases.length === 0 && (
                        <div className="text-center py-8 text-[12px] text-slate-600">
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
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 animate-slideUp">
                  {/* Left Side: Case general and state change */}
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <span className="text-[11px] text-slate-600 font-bold block uppercase">CASE FILE SYSTEM</span>
                        <h3 className="font-extrabold text-base text-slate-900">{activeCase.clientName} 의뢰인 파일정보</h3>
                      </div>

                      <span className="text-[13px] text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                        담당: {activeCase.assignedLawyerName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-850 text-[13px] text-slate-500">
                      <div>• 고객 연락처: <strong className="text-slate-700 font-mono">{activeCase.phone}</strong></div>
                      <div>• 세후 월가용소득: <strong className="text-slate-700">{activeCase.income}만 원</strong></div>
                      <div>• 연체 승인부채액: <strong className="text-red-500 font-bold">{activeCase.debtTotal.toLocaleString()}만 원</strong></div>
                      <div>• 최초 선임 등록일: <strong className="text-slate-700">{new Date(activeCase.createdAt).toLocaleDateString()}</strong></div>
                    </div>

                    {/* Change Status dropdown */}
                    <div className="p-3 bg-slate-100/30 rounded-lg border border-slate-850 space-y-2">
                      <label className="block font-bold text-[13px] text-slate-600">법원 추진 단계 일괄 변경:</label>
                      <div className="flex gap-2">
                        <select 
                          value={activeCase.status}
                          onChange={(e) => handleUpdateCaseStatus(activeCase.id, e.target.value as CaseStatus)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded p-1.5 font-bold text-amber-400 text-xs focus:ring-1"
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
                      <span className="font-black text-brand uppercase tracking-widest block text-[13px]">📝 보정 및 추진 명세 성과 로그</span>
                      
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
                          className="flex-1 bg-slate-100 border border-slate-200 rounded px-2.5 py-2 text-xs text-slate-900"
                        />
                        <button 
                          onClick={() => handleAddCaseNote(activeCase.id)}
                          className="bg-brand hover:bg-brand-hover text-white font-extrabold px-4 py-1.5 rounded-[200px] text-xs transition-colors shrink-0"
                        >
                          등록
                        </button>
                      </div>

                      {/* Display of notes */}
                      <div className="bg-slate-50 border border-slate-850 rounded p-3 text-[13px] text-slate-600 space-y-1.5 max-h-40 overflow-y-auto">
                        {activeCase.notes.map((note, idx) => (
                          <div key={idx} className="flex gap-1.5 items-start">
                            <span className="text-brand font-bold select-none shrink-0">•</span>
                            <span className="leading-relaxed">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-900">
                      <button 
                        onClick={() => setSelectedCaseId('')}
                        className="bg-slate-100 hover:bg-slate-100 text-slate-500 font-medium px-4 py-1.5 rounded-[200px] border border-slate-200"
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
                <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[12px] font-bold uppercase tracking-wider">ACTIVE SUBSCRIPTION</span>
                <h2 className="text-xl font-black text-white">동원 법무분소: <span className="text-indigo-400">Team SaaS Pro 요금제 사용 중</span></h2>
                <p className="text-xs text-slate-500">다음 결제 예정일: 2026년 06월 25일 (월 800,000 원 자동 승인)</p>
              </div>

              <div className="bg-slate-100 text-slate-600 p-4 rounded-lg border border-slate-200 text-xs flex gap-6">
                <div>
                  <span className="text-[12px] text-slate-600 block">이달 소진 매칭참여수</span>
                  <strong className="text-base text-brand">14 / 20건</strong>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <span className="text-[12px] text-slate-600 block">누적 가형 충전 충전금</span>
                  <strong className="text-base text-brand">35,000 원</strong>
                </div>
              </div>
            </div>

            {/* List of plans to showcase pricing mock structures */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {platformPlans.map((plan, idx) => (
                <div key={idx} className={`bg-slate-50 rounded-xl p-6 border flex flex-col justify-between gap-6 relative ${plan.color}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-4 bg-brand text-white text-[12px] font-bold px-2 py-0.5 rounded-full border border-brand-light shadow">
                      가장 많은 로펌 선택
                    </span>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                      <p className="text-slate-600 text-xs">수임료 과세 중계 불가 원칙 준수</p>
                    </div>

                    <div className="text-xl font-bold text-brand">{plan.price}</div>

                    <ul className="text-xs space-y-2 text-slate-500">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex gap-1.5 items-start">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button className={`w-full py-2.5 rounded-[200px] text-xs font-bold transition-all ${
                    plan.name === 'Pro' 
                    ? 'bg-brand hover:bg-brand-hover text-white ring-2 ring-brand/20 shadow' 
                    : 'bg-slate-100 hover:bg-slate-850 text-slate-600 border border-slate-200'
                  }`}>
                    {plan.name === 'Pro' ? '현재 요금제 이용 중' : '요금제 업그레이드 문의'}
                  </button>
                </div>
              ))}
            </div>

            {/* Banned details for security */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs h-auto space-y-2 text-slate-500 leading-normal">
              <span className="font-bold text-slate-700 block text-[13px] uppercase tracking-wide">💡 회생/파산 수임 연계 빌링 법적 안전장치</span>
              <p>
                본 Legal CRM은 변호사법 위반을 피하기 위해 **개인회생 수임 성공(계약 성사)에 따른 배분 수수료를 절대 징수하지 않습니다**.
                월 고정 요금제로 책정되는 SaaS 구독료 및 매칭 참여 시 차감되는 클릭 광고 차감 수수료(참여 1건당 무관 소진) 방식만으로 운영되어 사후 보증 및 로펌 운영 안전성이 100% 보장됩니다.
              </p>
            </div>
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

        {/* TAB: STAFF MANAGEMENT */}
        {activeTab === 'staff-management' && (
          <StaffManagementTab
            requests={requests}
            lawyers={lawyers}
            activeLawyer={activeLawyer}
            setRequests={setRequests}
          />
        )}

            {/* Search & Filter row */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header info */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-brand" />
                  <span>실시간 알림 및 외부 연동 설정 (Telegram Gateway)</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed text-left">
                  신규 상담이 접수되거나 선착순 상담이 오픈될 때, 텔레그램 메신저를 통해 실시간 알림을 수신하고 간편 제어 액션을 수행합니다.
                </p>
              </div>
              <span className="bg-brand/10 border border-brand/20 text-brand text-[12px] font-extrabold px-3 py-1 rounded-[200px] whitespace-nowrap self-start md:self-center">
                SaaS Enterprise 가동 중
              </span>
            </div>

            {/* ── 보안 설정: 비밀번호 변경 ── */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand" />
                  <span>비밀번호 및 보안 설정</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                    showPasswordChange ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/20'
                  }`}
                >
                  {showPasswordChange ? '접기' : '비밀번호 변경'}
                </button>
              </div>

              {showPasswordChange && (
                <div className="space-y-3 animate-fadeIn border-t border-slate-100 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-600 font-bold block">현재 비밀번호</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="현재 사용 중인 비밀번호"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-600 font-bold block">새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 (4자리 이상)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-600 font-bold block">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호를 다시 입력"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold transition-colors shadow-md"
                  >
                    비밀번호 변경 저장
                  </button>
                </div>
              )}
            </div>

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

          </div>
        )}

      </main>

      {/* Sub status footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-6 text-left text-[12px] text-slate-600 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-500">
              <span>{platformConfig.siteLogoText || "주식회사 my김변"}</span>
              <span>|</span>
              <span>대표이사 {platformConfig.companyRepresentative}</span>
              <span>|</span>
              <span>사업자등록번호 {platformConfig.companyBusinessNumber}</span>
            </div>
            <p className="leading-relaxed">
              주소: {platformConfig.companyAddress} | 이메일: partners@rebirthtalk.com
            </p>
            <p className="leading-relaxed">
              본 플랫폼의 매출 구조는 변호사법 제34조 정식 원칙 가이드(활동 기반 월 고정 구독료 책정)를 철저하게 이행합니다.
            </p>
          </div>
          <div className="md:text-right shrink-0">
            <p>© 2026 {platformConfig.siteLogoText || "my김변"} 도산 전문 변호사 CRM. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── 솔루션/비용 제안서 작성 모달 ── */}
      {proposalModalReqId && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setProposalModalReqId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">솔루션 및 비용 제안서 작성</h3>
              <p className="text-xs text-slate-500 mt-1">의뢰인에게 보낼 개인회생 솔루션과 비용을 입력하세요.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">진행 가능성 / 성공률 의견 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="예: 진행 가능 (성공률 95%)" value={proposalForm.feasibility} onChange={e => setProposalForm(p => ({...p, feasibility: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">예상 월 변제금 (만원) <span className="text-red-500">*</span></label>
                  <input type="number" value={proposalForm.monthlyPayment || ''} onChange={e => setProposalForm(p => ({...p, monthlyPayment: Number(e.target.value)}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">변제 기간 (개월) <span className="text-red-500">*</span></label>
                  <input type="number" value={proposalForm.duration || ''} onChange={e => setProposalForm(p => ({...p, duration: Number(e.target.value)}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">예상 탕감률 (%) <span className="text-red-500">*</span></label>
                  <input type="number" value={proposalForm.reductionRate || ''} onChange={e => setProposalForm(p => ({...p, reductionRate: Number(e.target.value)}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">수임 비용 (만원) <span className="text-red-500">*</span></label>
                  <input type="number" value={proposalForm.fee || ''} onChange={e => setProposalForm(p => ({...p, fee: Number(e.target.value)}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">분납 조건</label>
                <input type="text" placeholder="예: 최대 6개월 분할 가능" value={proposalForm.installment} onChange={e => setProposalForm(p => ({...p, installment: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">변호사 솔루션 한줄 의견 <span className="text-red-500">*</span></label>
                <textarea placeholder="의뢰인에게 전달할 솔루션 요약 코멘트" value={proposalForm.remark} onChange={e => setProposalForm(p => ({...p, remark: e.target.value}))} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button onClick={() => setProposalModalReqId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors">취소</button>
              <button
                onClick={() => proposalModalReqId && handleSubmitProposal(proposalModalReqId)}
                disabled={!proposalForm.feasibility || !proposalForm.remark || proposalForm.fee <= 0}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-colors"
              >
                제안서 발송
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
