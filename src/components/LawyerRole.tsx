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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'open-requests' | 'active-chats' | 'cases' | 'billing' | 'client-crm' | 'settings'>('dashboard');
  
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
  
  // Login form state
  const [loginId, setLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
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

    alert(`[다시시작 CRM 연동] ${activeLawyer.name} 님이 담당 변호사로 지정되었습니다. 실시간 협업실(채팅) 탭에서 의뢰인 소명 분석을 개시할 수 있습니다.`);
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
          onLogActivity(
            currentMember.id,
            currentMember.alias,
            'LAWYER',
            'LOGIN',
            `변호사 휴면 계정 수동 휴면 해제 성공`
          );
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

  const handleSignup = (e: React.FormEvent) => {
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

    const newLawyer: User = {
      id: signupId.trim(),
      lawFirmId: 'firm-1',
      teamId: signupRole === 'LAWYER' ? 'team-1' : 'team-1',
      name: signupName.trim() + (signupRole === 'LAWYER' ? ' 변호사' : ' 실장'),
      role: signupRole,
      fields: signupFields,
      region: signupRegion,
      avatar: signupAvatar,
      bio: signupBio.trim() || `${signupName.trim()} ${signupRole === 'LAWYER' ? '변호사' : '실장'}입니다.`,
      recentActivity: '신규 회원 가입 완료',
      matchedCount: 0,
      password: signupPassword,
      approved: false // New lawyer accounts must be approved by the admin portal
    };

    setLawyers(prev => [...prev, newLawyer]);

    // Create a new Member for admin tracking
    const newMember: Member = {
      id: signupId.trim(),
      email: signupId.trim() + '@rehablaw.com',
      alias: signupName.trim() + (signupRole === 'LAWYER' ? ' 변호사' : ' 실장'),
      role: signupRole as MemberRole,
      createdAt: new Date().toISOString(),
      loginChannel: 'email',
      status: 'pending', // Awaiting admin approval
      lastActiveAt: new Date().toISOString()
    };
    setMembers(prev => [...prev, newMember]);
    onLogActivity(newMember.id, newMember.alias, newMember.role, 'SIGNUP', '로펌 CRM 파트너 신규 가입 신청 완료 (자격 심사 대기)');

    alert('회원가입이 완료되었습니다. 로그인 해주세요!');
    setAuthMode('login');
    setLoginId(newLawyer.id);
    setSignupId('');
    setSignupPassword('');
    setSignupName('');
    setSignupBio('');
    setSignupError('');
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('legal_crm_lawyer_session');
      setIsLoggedIn(false);
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

  // Participate in an Open Request
  const handleJoinConsult = (reqId: string) => {
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

    onAddMessage(
      reqId,
      `안녕하십니까, ${activeLawyer.name}입니다. 요청해 주신 가계 소득 및 채무 위기 명세를 긴급 송달 검토하였습니다. 압류 예고 및 보정 대응 등 즉시 효력이 발생하는 법적 대응에 대하여 세부 법리 검토를 도와드리겠습니다.`,
      'lawyer',
      activeLawyer.id,
      activeLawyer.name
    );

    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CONSULT_REQUEST',
      `의뢰인 상담 요청 참여 수락 (요청 ID: ${reqId})`
    );

    setActiveChatReqId(reqId);
    setMobilePane('chat');
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

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-[#070A13] text-slate-100 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0F1626]/90 backdrop-blur-md border border-[#1F2937]/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="회생톡 로고" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-white">{(platformConfig.siteLogoText || "회생톡")} 변호사 CRM</span>
            </div>
            <p className="text-slate-400 text-xs">도산 전문 법률 대리인 통합 솔루션</p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <h3 className="font-extrabold text-sm text-slate-200 border-b border-[#1F2937]/60 pb-2">로그인</h3>
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                  {loginError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">아이디 (이름 또는 ID)</label>
                <input 
                  type="text" 
                  placeholder="예: 1 또는 김우진 또는 lawyer-1"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100 placeholder-slate-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">비밀번호</label>
                <input 
                  type="password" 
                  placeholder="비밀번호 입력 (기본: 1)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100 placeholder-slate-600"
                />
              </div>

              {/* Quick test login info */}
              <div className="bg-slate-900 border border-[#1F2937]/60 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-350 block">🔑 테스트 로그인 계정 정보</span>
                <div>• 아이디: <strong className="text-white">1</strong> / 비밀번호: <strong className="text-white">1</strong></div>
                <div>• (또는 변호사명: <strong className="text-slate-300">김우진</strong> / 비밀번호: <strong className="text-slate-300">1234</strong>)</div>
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
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-brand-light font-extrabold py-3 rounded-[200px] text-xs border border-slate-800 transition-colors"
                >
                  테스트 계정 1초 로그인
                </button>
              </div>
              <div className="text-center pt-2 text-xs text-slate-400">
                계정이 없으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('signup')}
                  className="text-brand font-bold hover:underline"
                >
                  회원가입하기
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-left max-h-[450px] overflow-y-auto pr-1 scrollbar-hide">
              <h3 className="font-extrabold text-sm text-slate-200 border-b border-[#1F2937]/60 pb-2">회원가입</h3>
              {signupError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                  {signupError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">아이디 (ID)*</label>
                  <input 
                    type="text" 
                    placeholder="예: lawyer-kim"
                    value={signupId}
                    onChange={(e) => setSignupId(e.target.value)}
                    className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">비밀번호*</label>
                  <input 
                    type="password" 
                    placeholder="비밀번호 입력"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">이름 (성명)*</label>
                  <input 
                    type="text" 
                    placeholder="예: 홍길동"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">역할 구분*</label>
                  <select 
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as 'LAWYER' | 'STAFF')}
                    className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                  >
                    <option value="LAWYER">변호사 (LAWYER)</option>
                    <option value="STAFF">실장/사무장 (STAFF)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">전문분야 (쉼표로 구분)</label>
                <input 
                  type="text" 
                  placeholder="예: 개인회생, 개인파산, 보정명령대응"
                  onChange={(e) => setSignupFields(e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">활동 지역</label>
                <input 
                  type="text" 
                  placeholder="예: 서울, 경기/수원, 부산"
                  value={signupRegion}
                  onChange={(e) => setSignupRegion(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">프로필 사진 URL</label>
                <input 
                  type="text" 
                  value={signupAvatar}
                  onChange={(e) => setSignupAvatar(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">소개 약력(Bio)</label>
                <textarea 
                  rows={2}
                  placeholder="전문 대리인으로서의 약력 및 인사말을 작성하세요."
                  value={signupBio}
                  onChange={(e) => setSignupBio(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md mt-2"
              >
                신규 대리인 등록 완료
              </button>
              <div className="text-center pt-2 text-xs text-slate-400">
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
        </div>
      </div>
    );
  }

  if (isLoggedIn && activeLawyer.approved === false) {
    return (
      <div className="flex flex-col min-h-screen bg-[#070A13] text-slate-100 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0F1626]/90 backdrop-blur-md border border-[#1F2937]/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="회생톡 로고" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-white">{(platformConfig.siteLogoText || "회생톡")} 변호사 CRM</span>
            </div>
            <p className="text-slate-400 text-xs">도산 전문 법률 대리인 통합 솔루션</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl p-4 text-xs text-left space-y-2 leading-relaxed">
            <h4 className="font-bold text-sm text-center">⏳ 계정 승인 심사 대기 중</h4>
            <p>안녕하세요, <strong>{activeLawyer.name}</strong> 님.</p>
            <p>현재 계정 자격 확인 및 정식 소속 승인 절차가 진행 중입니다.</p>
            <p>{platformConfig.siteLogoText || "회생톡"} 플랫폼은 변호사법 제34조 정식 변호사 자격 검증 의무에 따라, 관리자의 수동 라이선스 검토를 거쳐 활동을 승인하고 있습니다.</p>
            <p className="text-[11px] text-slate-400">* 어드민 페이지(Admin Portal)에서 본 계정의 승인 처리를 하실 수 있습니다.</p>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-extrabold py-3 rounded-[200px] text-xs border border-slate-800 transition-colors shrink-0"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#070A13] text-slate-100 font-sans selection:bg-brand selection:text-white">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-[#0B111E] border-x border-[#1F2937]/80 shadow-2xl flex flex-col relative">
      
        {/* Lawyer CRM Premium Header */}
        <header className="sticky top-0 z-40 bg-[#0F1626]/90 backdrop-blur-md border-b border-[#1F2937]/80 shadow-xl px-4 py-3">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="회생톡 로고" className="w-8 h-8 rounded-lg object-cover" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-sm tracking-tight text-white">{(platformConfig.siteLogoText || "회생톡")} 변호사 CRM</span>
                  <span className="bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded font-extrabold text-[9px] tracking-wider uppercase">SaaS</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">도산 전문 법률 대리인 지부</span>
              </div>
              <span className="text-slate-700 text-xs hidden sm:inline ml-2 border-l border-[#1F2937] pl-3">팀: {activeLawyer.name.split(' ')[0]} 법률지부</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img 
                  src={activeLawyer.avatar} 
                  alt={activeLawyer.name} 
                  className="w-7 h-7 rounded-full object-cover border border-brand/30" 
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-200 leading-none">{activeLawyer.name}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">{activeLawyer.role}</span>
                </div>
              </div>
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-slate-450 hover:text-white px-2.5 py-1.5 rounded-[200px] border border-slate-800 text-[10px] transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </header>

        {/* Primary tab navigation row */}
        <div className="bg-[#0F1626] border-b border-[#1F2937]/80 px-4">
          <div className="w-full flex overflow-x-auto gap-4 py-2 text-xs font-semibold scrollbar-hide">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'dashboard' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>종합 대시보드</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('open-requests')}
              className={`relative pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'open-requests' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
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
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'active-chats' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>실시간 협업실 (채팅)</span>
              {activeChatsCount > 0 && (
                <span className="bg-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                  {activeChatsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('client-crm')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'client-crm' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>고객 관리 (CRM)</span>
              <span className="bg-slate-800 text-slate-350 rounded-full px-1.5 text-[9px]">
                {requests.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('cases')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'cases' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>진행 중인 수임 사건 (SaaS)</span>
              <span className="bg-slate-800 text-slate-350 rounded-full px-1.5 text-[9px]">
                {totalCasesCount}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('billing')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'billing' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>이용 요금제 / 빌링</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'settings' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>알림 및 연동 설정</span>
            </button>
          </div>
        </div>

        {/* Main Workspace Frame */}
        <main className="flex-1 w-full px-4 py-6 overflow-y-auto">

        {/* TAB 1: LAWYER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">오픈 대기중 신청</span>
                  <span className="text-2xl font-black text-brand-light">{totalOpenRequestsCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand/10 text-brand-light">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">직접 지정 응답 대기</span>
                  <span className="text-2xl font-black text-brand-light">{directCounselingCount}개</span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand/10 text-brand-light">
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
                      <span className="text-indigo-400 font-bold">5.8일 (보강 필요)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full w-[70%] rounded-full"></div>
                    </div>
                  </div>

                  {/* KPI Progress 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">상담 참여 락(Lock) 소진율 - 마케팅 원가 대비 전환</span>
                      <span className="text-brand-light font-bold">68.2%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand h-full w-[68%] rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Sub regional performance box */}
                <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">수원지법 지부</span>
                    <strong className="text-xs text-indigo-300">총 수임 42M</strong>
                  </div>
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">서울회생법원</span>
                    <strong className="text-xs text-brand-light">총 수임 155M</strong>
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
                  <Shield className="w-4 h-4 text-brand-light" />
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
                  className="w-full bg-slate-850 hover:bg-slate-800 text-brand-light font-bold py-2 rounded-[200px] text-xs border border-slate-800 transition-colors"
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
                          <span className="bg-brand/10 text-brand-light font-bold px-2 py-0.5 rounded text-[10px]">
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/50 p-3 rounded-lg text-[11px] text-slate-400 border border-slate-855">
                          <div>• 총 가계 채무: <strong className="text-brand-light font-extrabold">{r.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                          <div>• 기재 자산수준: <strong className="text-slate-200 font-semibold">{r.financialProfile.assetsTotal.toLocaleString()}만 원</strong></div>
                          <div>• 월 가중소득: <strong className="text-slate-200 font-semibold">{r.financialProfile.income}만 원</strong></div>
                          <div>• 소득 대비 부채비: <strong className="text-red-400 font-bold">{debtRatio}배 수준</strong></div>
                        </div>

                        {/* Expanded Legal Profile details */}
                        {r.financialProfile.jobType && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 bg-slate-950/40 p-3 rounded-lg text-[10px] text-slate-450 border border-slate-850">
                            <div>• 직업유형: <strong className="text-slate-300">{r.financialProfile.jobType === 'SALARIED' ? '급여소득' : r.financialProfile.jobType === 'BUSINESS' ? '영업소득' : r.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'} ({r.financialProfile.companyName || '미기재'})</strong></div>
                            <div>• 거주지역: <strong className="text-slate-300">{r.financialProfile.residenceRegion || '미기재'}</strong></div>
                            <div>• 채무원인: <strong className="text-slate-300">{r.financialProfile.debtCause === 'LIVING' ? '생활비' : r.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : r.financialProfile.debtCause === 'INVESTMENT' ? '투자 실패' : r.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</strong></div>
                            <div>• 채권자수 / 추심: <strong className="text-amber-400">{r.financialProfile.creditorCount || 0}곳 / {r.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : r.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : r.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '가압류/압류'}</strong></div>
                          </div>
                        )}

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
                          <div className="flex justify-between"><span>현재 상태:</span> <strong className="text-brand-light">요청대기</strong></div>
                        </div>

                        <button 
                          onClick={() => handleJoinConsult(r.id)}
                          className="w-full bg-brand hover:bg-brand-hover text-white font-black py-2.5 rounded-[200px] text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-[#0B111E] rounded-3xl overflow-hidden shadow-2xl border border-[#1F2937]/80 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[700px] animate-fadeIn">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className={`lg:col-span-3 border-r border-[#1F2937]/80 flex flex-col h-full bg-[#0F1626] ${mobilePane === 'threads' ? 'block' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-[#1F2937]/80 bg-[#0B111E]/40">
                <h3 className="font-extrabold text-xs text-slate-200 tracking-wider uppercase">상담 진행 메시지함</h3>
                <p className="text-slate-500 text-[10px] mt-0.5">실시간 매칭된 나의 세션 내역</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#1F2937]/50 h-[400px] scrollbar-hide">
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
                          isSelected ? 'bg-[#0B111E]/90 border-l-4 border-brand font-bold' : 'hover:bg-[#0B111E]/40'
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
                      className="text-brand font-bold hover:underline"
                    >
                      상담 참여 대기 목록보기 &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL II: ACTIVE MESSAGING BOARD (CENTER) */}
            <div className={`lg:col-span-6 border-r border-[#1F2937]/80 flex flex-col h-full bg-[#0B111E] ${mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
                <>
                  <div className="p-4 border-b border-[#1F2937]/80 flex items-center justify-between bg-[#0B111E]/40">
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
                        <span className="text-[9px] font-bold tracking-widest text-emerald-400 block uppercase">SECURE CHAT CHANNEL</span>
                        <h3 className="font-extrabold text-xs text-slate-200 line-clamp-1">{currentChatRequest.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Mobile toggle to view CRM profile info */}
                      <button 
                        onClick={() => setMobilePane('crm')}
                        className="lg:hidden text-slate-350 hover:text-white font-semibold text-[10px] border border-[#1F2937] bg-[#161D30] px-2.5 py-1.5 rounded-[200px] transition-all"
                      >
                        의뢰 정보 ℹ️
                      </button>
                      <span className="hidden sm:inline bg-slate-900 border border-[#1F2937] text-[10px] text-slate-400 px-2 py-0.5 rounded">
                        의뢰채널 id: {currentChatRequest.id}
                      </span>
                    </div>
                  </div>

                  {/* Chat flow messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[350px] scrollbar-hide">
                    <div className="p-3 bg-[#161D30] rounded-xl text-slate-400 text-xs border border-[#1F2937]/60 text-left">
                      📝 <span className="text-brand font-bold">의뢰서 본문 내용:</span> {currentChatRequest.content}
                    </div>

                    {currentChatMessages.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-350">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className={`p-3 rounded-xl max-w-sm text-xs leading-normal text-left ${
                            isMe 
                            ? 'bg-brand text-white rounded-tr-none font-semibold' 
                            : 'bg-[#161D30] text-slate-200 rounded-tl-none border border-[#1F2937]/80'
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Messenger form */}
                  <div className="p-4 border-t border-[#1F2937]/80 bg-[#0B111E]/60 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="의뢰인과의 1:1 보정 대화를 입력하십시오..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChat();
                      }}
                      className="flex-1 bg-[#0F1626] border border-[#1F2937] rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100 placeholder-slate-600"
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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500 bg-[#0B111E]">
                  <MessageSquare className="w-12 h-12 text-slate-800" />
                  <p className="text-xs">왼쪽 메시지함에서 진행 가능한 의뢰인 대화 스레드를 클릭하십시오.</p>
                </div>
              )}
            </div>

            {/* PANEL III: ATTOURNEY CRM RIGHT-RAIL (RIGHT) */}
            <div className={`lg:col-span-3 flex flex-col h-full bg-[#0F1626] overflow-y-auto ${mobilePane === 'crm' ? 'block' : 'hidden lg:flex'}`}>
              {currentChatRequest ? (
                <div className="p-4 space-y-6 text-xs divide-y divide-[#1F2937]/50">
                  
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
                    
                    <div className="bg-[#111827] p-3 rounded-xl border border-[#1F2937]/80 space-y-2 text-[11px] text-slate-300">
                      <div className="flex justify-between"><span>의뢰인명:</span> <span className="font-bold text-white">{currentChatRequest.clientName}</span></div>
                      <div className="flex justify-between"><span>비상 연락처:</span> <span className="font-mono text-white">{getDisplayPhoneNumber(currentChatRequest)}</span></div>
                      <div className="flex justify-between"><span>월 소득계산:</span> <span className="font-bold text-brand-light">{currentChatRequest.financialProfile.income}만 원</span></div>
                      <div className="flex justify-between table-auto"><span>총 채무진단:</span> <span className="font-bold text-red-400">{currentChatRequest.financialProfile.debtTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span>자산수준합산:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.assetsTotal.toLocaleString()}만 원</span></div>
                      <div className="flex justify-between"><span>부양 가족수:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.dependents}명</span></div>
                      <div className="flex justify-between"><span>결혼 자격구조:</span> <span className="text-slate-200">{currentChatRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : currentChatRequest.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span></div>
                      
                      {currentChatRequest.financialProfile.jobType && (
                        <>
                          <div className="border-t border-slate-800 my-1.5 pt-1.5 flex justify-between">
                            <span>직업 유형:</span> 
                            <span className="text-white font-bold">
                              {currentChatRequest.financialProfile.jobType === 'SALARIED' ? '급여소득' : currentChatRequest.financialProfile.jobType === 'BUSINESS' ? '영업소득' : currentChatRequest.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                              {currentChatRequest.financialProfile.companyName && ` (${currentChatRequest.financialProfile.companyName})`}
                            </span>
                          </div>
                          <div className="flex justify-between"><span>거주 지역:</span> <span className="text-white">{currentChatRequest.financialProfile.residenceRegion}</span></div>
                          <div className="flex justify-between"><span>임차 보증금:</span> <span className="text-white">{currentChatRequest.financialProfile.rentalDeposit?.toLocaleString()}만 원</span></div>
                          {currentChatRequest.financialProfile.maritalStatus === 'MARRIED' && (
                            <div className="flex justify-between"><span>배우자 재산:</span> <span className="text-white">{currentChatRequest.financialProfile.spouseAsset?.toLocaleString()}만 원</span></div>
                          )}
                          <div className="flex justify-between"><span>주된 채무원인:</span> <span className="text-white">{currentChatRequest.financialProfile.debtCause === 'LIVING' ? '생활비' : currentChatRequest.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : currentChatRequest.financialProfile.debtCause === 'INVESTMENT' ? '투자 실패' : currentChatRequest.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</span></div>
                          <div className="flex justify-between text-amber-400"><span>추심 단계:</span> <span>{currentChatRequest.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : currentChatRequest.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : currentChatRequest.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '압류/가압류'}</span></div>
                          <div className="flex justify-between"><span>채권자 기관수:</span> <span className="text-white">{currentChatRequest.financialProfile.creditorCount}곳</span></div>
                        </>
                      )}
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
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">⚖️ 상담 사건 공식 수임 전환</span>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
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
                    <p className="text-slate-500 text-[10px]">사무장 및 보조 스태프와 해당 의뢰인의 보정 소명 보조 기록을 메모하는 보안 영역입니다.</p>

                    <textarea
                      rows={4}
                      placeholder="내부 긴급 가이드 및 참고 메모를 작성해 주세요..."
                      value={internalNotes[currentChatRequest.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [currentChatRequest.id]: e.target.value };
                        setInternalNotes(nextNotes);
                      }}
                      className="w-full bg-[#111827] border border-[#1F2937]/80 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-200 placeholder-slate-650"
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
            <div className="bg-[#0F1626] p-5 rounded-3xl border border-[#1F2937]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FolderHeart className="w-5 h-5 text-brand" />
                  <span>로펌 사건 위임 대장 통합 CRM (소생 및 개인회생 단대)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">서류 준비부터 파산 면책 승인 및 변제 개시 고시까지 일괄적으로 RLS 권한에 의거해 추적합니다.</p>
              </div>

              <div className="flex gap-2">
                <span className="bg-[#111827] border border-[#1F2937]/80 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl font-semibold">
                  총 감면 탕감 달성액: <strong className="text-emerald-400">11억 4200만 원</strong>
                </span>
              </div>
            </div>

            {/* Mobile Stage Selector Tab bar */}
            <div className="md:hidden flex overflow-x-auto gap-2 py-2 border-b border-[#1F2937]/80 scrollbar-hide">
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
                      : 'bg-[#111827] text-slate-400 border-[#1F2937]/60'
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
                const stageColor = stage === 'document' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : stage === 'filing' ? 'bg-brand/10 text-brand-light border-brand/20' : stage === 'commencement' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : stage === 'approval' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                const stageCases = cases.filter(c => c.status === stage);

                return (
                  <div key={stage} className={`bg-[#0F1626] p-3 rounded-2xl border border-[#1F2937]/80 space-y-3 min-h-[300px] ${
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
                              : 'bg-[#111827]/40 border-[#1F2937]/80 hover:bg-[#111827] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-350">{c.clientName} 의뢰인</span>
                              <span className="text-slate-500 text-[9px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>

                            <div className="text-[11px] font-bold text-slate-200">
                              위임채무액: <span className="text-brand-light font-extrabold">{c.debtTotal.toLocaleString()}만 원</span>
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
                      <div>• 연체 승인부채액: <strong className="text-brand-light font-bold">{activeCase.debtTotal.toLocaleString()}만 원</strong></div>
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
                      <span className="font-black text-brand-light uppercase tracking-widest block text-[11px]">📝 보정 및 추진 명세 성과 로그</span>
                      
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
                          className="bg-brand hover:bg-brand-hover text-white font-extrabold px-4 py-1.5 rounded-[200px] text-xs transition-colors shrink-0"
                        >
                          등록
                        </button>
                      </div>

                      {/* Display of notes */}
                      <div className="bg-slate-950/40 border border-slate-850 rounded p-3 text-[11px] text-slate-300 space-y-1.5 max-h-40 overflow-y-auto">
                        {activeCase.notes.map((note, idx) => (
                          <div key={idx} className="flex gap-1.5 items-start">
                            <span className="text-brand-light font-bold select-none shrink-0">•</span>
                            <span className="leading-relaxed">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-900">
                      <button 
                        onClick={() => setSelectedCaseId('')}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium px-4 py-1.5 rounded-[200px] border border-slate-800"
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

              <div className="bg-slate-900 text-slate-350 p-4 rounded-lg border border-slate-800 text-xs flex gap-6">
                <div>
                  <span className="text-[10px] text-slate-500 block">이달 소진 매칭참여수</span>
                  <strong className="text-base text-brand-light">14 / 20건</strong>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <span className="text-[10px] text-slate-500 block">누적 가형 충전 충전금</span>
                  <strong className="text-base text-brand-light">35,000 원</strong>
                </div>
              </div>
            </div>

            {/* List of plans to showcase pricing mock structures */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {platformPlans.map((plan, idx) => (
                <div key={idx} className={`bg-slate-950 rounded-xl p-6 border flex flex-col justify-between gap-6 relative ${plan.color}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-4 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-light shadow">
                      가장 많은 로펌 선택
                    </span>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-100">{plan.name}</h3>
                      <p className="text-slate-500 text-xs">수임료 과세 중계 불가 원칙 준수</p>
                    </div>

                    <div className="text-xl font-bold text-brand-light">{plan.price}</div>

                    <ul className="text-xs space-y-2 text-slate-400">
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
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                  }`}>
                    {plan.name === 'Pro' ? '현재 요금제 이용 중' : '요금제 업그레이드 문의'}
                  </button>
                </div>
              ))}
            </div>

            {/* Banned details for security */}
            <div className="bg-slate-950 p-4 rounded-xl border border-[#1F2937]/80 text-xs h-auto space-y-2 text-slate-400 leading-normal">
              <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wide">💡 회생/파산 수임 연계 빌링 법적 안전장치</span>
              <p>
                본 Legal CRM은 변호사법 위반을 피하기 위해 **개인회생 수임 성공(계약 성사)에 따른 배분 수수료를 절대 징수하지 않습니다**.
                월 고정 요금제로 책정되는 SaaS 구독료 및 매칭 참여 시 차감되는 클릭 광고 차감 수수료(참여 1건당 무관 소진) 방식만으로 운영되어 사후 보증 및 로펌 운영 안전성이 100% 보장됩니다.
              </p>
            </div>
          </div>
        )}

        {/* TAB 6: CLIENT CRM (고객 관리) */}
        {activeTab === 'client-crm' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top overview card */}
            <div className="bg-[#0F1626] p-5 rounded-3xl border border-[#1F2937]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand" />
                  <span>상담 신청 고객 통합 관리 CRM</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">상담이 접수된 전체 의뢰인의 진단 결과, 담당자 지정 및 진행 단계를 상세 관리합니다.</p>
              </div>
            </div>

            {/* Search & Filter row */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <input 
                  type="text" 
                  placeholder="고객명 또는 연락처 검색..." 
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="w-full bg-[#0B111E] border border-[#1F2937] rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-100 placeholder-slate-600"
                />
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <select 
                  value={crmStatusFilter} 
                  onChange={(e) => setCrmStatusFilter(e.target.value)}
                  className="bg-[#0B111E] border border-[#1F2937] rounded-xl px-3 py-1.5 text-xs text-slate-350"
                >
                  <option value="all">상태: 전체보기</option>
                  <option value="requested">요청 대기 (requested)</option>
                  <option value="responding">지정 대기 (responding)</option>
                  <option value="counseling">상담 진행 (counseling)</option>
                  <option value="closed">수임 완료/종결 (closed)</option>
                </select>

                <select 
                  value={crmLawyerFilter} 
                  onChange={(e) => setCrmLawyerFilter(e.target.value)}
                  className="bg-[#0B111E] border border-[#1F2937] rounded-xl px-3 py-1.5 text-xs text-slate-350"
                >
                  <option value="all">담당자: 전체보기</option>
                  <option value="unassigned">담당 변호사 미배정</option>
                  {lawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split layout: List on left, details on right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left column: Clients table list */}
              <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0F1626]/80 text-slate-400 font-bold border-b border-slate-800">
                        <th className="p-3">고객명</th>
                        <th className="p-3">연락처</th>
                        <th className="p-3">신청유형</th>
                        <th className="p-3">상태</th>
                        <th className="p-3 text-right">총 채무액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredRequests.map(r => {
                        const isSelected = r.id === crmSelectedId;
                        const statusColors = {
                          requested: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                          responding: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                          counseling: 'bg-brand/10 text-brand-light border-brand/20',
                          closed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        };
                        const statusLabels = {
                          requested: '요청 대기',
                          responding: '지정 대기',
                          counseling: '상담 진행',
                          closed: '수임/종결'
                        };
                        return (
                          <tr 
                            key={r.id}
                            onClick={() => setCrmSelectedId(r.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-brand/5 hover:bg-brand/10' : 'hover:bg-slate-900/50'
                            }`}
                          >
                            <td className="p-3 font-bold text-white">{r.clientName}</td>
                            <td className="p-3 font-mono text-slate-300">{getDisplayPhoneNumber(r)}</td>
                            <td className="p-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                                {r.requestType === 'direct' ? '단독지명' : '오픈형'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${statusColors[r.status]}`}>
                                {statusLabels[r.status]}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-brand-light">
                              {r.financialProfile.debtTotal.toLocaleString()}만원
                            </td>
                          </tr>
                        );
                      })}

                      {filteredRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            검색 조건에 부합하는 상담 고객이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right column: Selected Client CRM Details Panel */}
              <div className="lg:col-span-5 bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-5">
                {crmSelectedClient ? (
                  <>
                    <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[9px] text-brand font-bold block uppercase tracking-wider">CLIENT DETAIL SHEET</span>
                        <h3 className="text-base font-extrabold text-white">{crmSelectedClient.clientName} 의뢰인</h3>
                      </div>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-1 rounded">
                        ID: {crmSelectedClient.id}
                      </span>
                    </div>

                    {/* Edit general info */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 block">👤 인적 정보 수정</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">의뢰인 이름</label>
                          <input 
                            type="text" 
                            value={crmEditName} 
                            onChange={(e) => setCrmEditName(e.target.value)}
                            className="w-full bg-[#0B111E] border border-slate-800 rounded p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">비상 연락처</label>
                          <input 
                            type="text" 
                            value={crmEditPhone} 
                            onChange={(e) => setCrmEditPhone(e.target.value)}
                            className="w-full bg-[#0B111E] border border-slate-800 rounded p-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleUpdateClientInfo}
                        className="w-full bg-slate-900 hover:bg-slate-850 text-brand-light border border-slate-800 py-1.5 rounded-[200px] text-xs font-semibold"
                      >
                        기본 정보 업데이트
                      </button>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 block">📊 가계 채무 및 소득 진단 명세</span>
                      <div className="grid grid-cols-2 gap-2 bg-[#0B111E] p-3 rounded-lg border border-slate-850 text-[11px] text-slate-355">
                        <div>월 평균 소득: <strong className="text-white">{crmSelectedClient.financialProfile.income}만원</strong></div>
                        <div>총 채무 규모: <strong className="text-red-400 font-extrabold">{crmSelectedClient.financialProfile.debtTotal.toLocaleString()}만원</strong></div>
                        <div>자산수준합산: <strong className="text-white">{crmSelectedClient.financialProfile.assetsTotal.toLocaleString()}만원</strong></div>
                        <div>부양 가족수: <strong className="text-white">{crmSelectedClient.financialProfile.dependents}명</strong></div>
                        {crmSelectedClient.financialProfile.jobType && (
                          <>
                            <div className="col-span-2 border-t border-slate-800 my-1 pt-1.5 flex justify-between">
                              <span>직업 (직장명):</span> 
                              <strong className="text-slate-200">
                                {crmSelectedClient.financialProfile.jobType === 'SALARIED' ? '급여소득' : crmSelectedClient.financialProfile.jobType === 'BUSINESS' ? '영업소득' : crmSelectedClient.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                                {crmSelectedClient.financialProfile.companyName && ` (${crmSelectedClient.financialProfile.companyName})`}
                              </strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>입사/개업일:</span>
                              <strong className="text-slate-200">{crmSelectedClient.financialProfile.employmentDate || '미기재'}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>거주지 (관할법원):</span>
                              <strong className="text-slate-200">{crmSelectedClient.financialProfile.residenceRegion}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>임차 보증금:</span>
                              <strong className="text-slate-200">{crmSelectedClient.financialProfile.rentalDeposit?.toLocaleString()}만원</strong>
                            </div>
                            {crmSelectedClient.financialProfile.maritalStatus === 'MARRIED' && (
                              <div className="col-span-2 flex justify-between">
                                <span>배우자 자산/소득:</span>
                                <strong className="text-slate-200">{crmSelectedClient.financialProfile.spouseAsset?.toLocaleString()}만 / {crmSelectedClient.financialProfile.spouseIncome}만원</strong>
                              </div>
                            )}
                            <div className="col-span-2 flex justify-between">
                              <span>채무 원인:</span>
                              <strong className="text-slate-200">{crmSelectedClient.financialProfile.debtCause === 'LIVING' ? '생활비' : crmSelectedClient.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : crmSelectedClient.financialProfile.debtCause === 'INVESTMENT' ? '투자 실패' : crmSelectedClient.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between text-amber-400">
                              <span>추심 단계:</span>
                              <strong>{crmSelectedClient.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : crmSelectedClient.financialProfile.harassmentLevel === 'LETTER' ? '독촉 최고서' : crmSelectedClient.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '가압류/지급명령'}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>채권자 수:</span>
                              <strong className="text-slate-200">{crmSelectedClient.financialProfile.creditorCount}곳</strong>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* CRM Assign & Status workflow */}
                    <div className="space-y-3 bg-[#0B111E] p-4 rounded-xl border border-slate-850">
                      <span className="text-[11px] font-bold text-brand-light block">⚙️ 상담 세션 제어</span>
                      
                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">담당 변호사 지정:</span>
                          <select 
                            value={crmEditLawyerId}
                            onChange={(e) => setCrmEditLawyerId(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                          >
                            <option value="">미배정 (선택해 주세요)</option>
                            {lawyers.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">상담 세션 상태:</span>
                          <select 
                            value={crmEditStatus}
                            onChange={(e) => setCrmEditStatus(e.target.value as ConsultStatus)}
                            className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                          >
                            <option value="requested">요청 대기 (requested)</option>
                            <option value="responding">지정 대기 (responding)</option>
                            <option value="counseling">상담 진행 (counseling)</option>
                            <option value="closed">수임/상담 종결 (closed)</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        onClick={handleSaveCrmSession}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-2 rounded-[200px] text-xs font-extrabold mt-2"
                      >
                        상담 세션 배정 및 상태 저장
                      </button>
                    </div>

                    {/* Converting to Cases tab (수임 전환 CTA) */}
                    <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-xl space-y-2.5">
                      <span className="text-[11px] font-bold text-emerald-400 block">⚖️ 정식 사건 수임 전환</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        상담이 완료되어 본 의뢰인을 정식 수임 사건 대장(Kanban 보드)으로 전환 등록하려면 아래 버튼을 클릭하십시오.
                      </p>
                      <button 
                        onClick={() => handleConvertToCase(crmSelectedClient)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-[200px] text-xs font-extrabold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>정식 수임사건으로 전환 등록</span>
                      </button>
                    </div>

                    {/* Consultation Notes log */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 block">📌 CRM 상담 기록 비망록</span>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="상담 메모 추가..."
                          value={crmNewNote}
                          onChange={(e) => setCrmNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCrmNote();
                          }}
                          className="flex-1 bg-[#0B111E] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                        />
                        <button 
                          onClick={handleAddCrmNote}
                          className="bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-[200px] text-xs font-semibold shrink-0"
                        >
                          추가
                        </button>
                      </div>

                      {/* Notes list */}
                      <div className="bg-[#0B111E] border border-slate-850 rounded p-3 text-[11px] text-slate-300 space-y-2 max-h-40 overflow-y-auto">
                        {crmSelectedNotes.length > 0 ? (
                          crmSelectedNotes.map((note, idx) => (
                            <div key={idx} className="flex gap-1.5 items-start justify-between">
                              <div className="flex gap-1.5 items-start">
                                <span className="text-brand-light font-bold select-none shrink-0">•</span>
                                <span className="leading-relaxed text-left">{note}</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteCrmNote(idx)}
                                className="text-slate-650 hover:text-red-400 text-[10px]"
                              >
                                삭제
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-650">
                            기록된 상담 비망록 메모가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-600 text-xs">
                    고객 리스트에서 상세 조회할 상담 신청 고객을 선택해 주십시오.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 7: NOTIFICATION & TELEGRAM ALERTS GATEWAY SIMULATOR */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header info */}
            <div className="bg-[#0F1626] border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-brand" />
                  <span>실시간 알림 및 외부 연동 설정 (Telegram Gateway)</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed text-left">
                  신규 상담이 접수되거나 선착순 상담이 오픈될 때, 텔레그램 메신저를 통해 실시간 알림을 수신하고 간편 제어 액션을 수행합니다.
                </p>
              </div>
              <span className="bg-brand/10 border border-brand/20 text-brand text-[10px] font-extrabold px-3 py-1 rounded-[200px] whitespace-nowrap self-start md:self-center">
                SaaS Enterprise 가동 중
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Config Panel */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* 🤖 1. Bot Integration */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">🤖 1단계: 텔레그램 알림봇 바인딩</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${tgConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                      {tgConnected ? '연결됨 (ACTIVE)' : '연결 해제됨'}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs text-left">
                    <p className="text-slate-500 leading-normal text-[11px]">
                      아래 텔레그램 봇 링크를 통해 다시시작 알림방에 봇을 추가한 뒤, 봇이 알려주는 그룹방 고유 Chat ID를 바인딩하세요.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a 
                        href="https://t.me/restart_alarm_bot" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-brand-light font-extrabold px-3 py-2 rounded-xl text-center flex items-center justify-center gap-1 shrink-0"
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
                          className="w-full bg-[#0B111E] border border-slate-800 rounded-xl p-2.5 pr-12 focus:ring-1 focus:ring-brand focus:outline-none"
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
                            ? 'bg-slate-900 border-slate-850 hover:bg-slate-850 text-red-400 hover:text-red-300' 
                            : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                        }`}
                      >
                        {tgConnected ? '연결 일시 해제' : '알림 활성화'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 📅 2. Receiving Hours */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">📅 2단계: 알림 요일 및 근무시간 설정</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={tgDutyMode} 
                        onChange={(e) => setTgDutyMode(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-800 text-brand focus:ring-brand" 
                      />
                      <span className="text-[10px] font-bold text-amber-400">🚨 야간 당직방 우회 활성화</span>
                    </label>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">알림 수신 요일</label>
                      <div className="flex gap-1.5">
                        {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                          <label key={d} className="flex-1 bg-slate-900 border border-slate-800 rounded-lg py-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-slate-700 select-none">
                            <input 
                              type="checkbox" 
                              defaultChecked={d !== '토' && d !== '일'} 
                              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-brand"
                            />
                            <span className="text-[10px] font-bold text-slate-350">{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 block uppercase font-bold">근무 시작 시각</label>
                        <input 
                          type="text" 
                          value={tgWorkHoursStart}
                          onChange={(e) => setTgWorkHoursStart(e.target.value)}
                          className="w-full bg-[#0B111E] border border-slate-800 rounded-xl p-2.5 text-center focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 block uppercase font-bold">근무 종료 시각</label>
                        <input 
                          type="text" 
                          value={tgWorkHoursEnd}
                          onChange={(e) => setTgWorkHoursEnd(e.target.value)}
                          className="w-full bg-[#0B111E] border border-slate-800 rounded-xl p-2.5 text-center focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ⏱️ 3. Escalation and Reminder */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">⏱️ 3단계: 미응답 리마인드 & 에스컬레이션</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">상담 배정 미수락 재알림 주기</label>
                      <select 
                        value={tgRemindDelay}
                        onChange={(e) => setTgRemindDelay(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-350 focus:outline-none"
                      >
                        <option value="5">5분 간격 리마인드</option>
                        <option value="10">10분 간격 리마인드</option>
                        <option value="20">20분 간격 리마인드</option>
                        <option value="30">30분 간격 리마인드</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">최종 미응답 시 전체 에스컬레이션</label>
                      <select 
                        value={tgEscalation}
                        onChange={(e) => setTgEscalation(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-350 focus:outline-none"
                      >
                        <option value="15">15분 미수락 시 전체 대표방 공지</option>
                        <option value="30">30분 미수락 시 전체 대표방 공지</option>
                        <option value="60">1시간 미수락 시 전체 대표방 공지</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Simulated Live Telegram Widget */}
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block text-left uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-brand-light" />
                  📱 텔레그램 실시간 알림방 시뮬레이터 (Mock Telegram Client)
                </span>

                {/* Mock Telegram Window */}
                <div className="bg-[#182533] border border-slate-800 rounded-3xl shadow-xl w-full h-[540px] flex flex-col overflow-hidden animate-fadeIn relative">
                  
                  {/* Telegram Header */}
                  <div className="bg-[#22313F] px-4 py-3 flex items-center justify-between border-b border-[#141E28]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-extrabold text-sm select-none">
                        다
                      </div>
                      <div className="text-left leading-tight">
                        <h4 className="font-extrabold text-xs text-white">다시시작 법률지부 알림방</h4>
                        <span className="text-[10px] text-[#86959E] font-medium">멤버 5명, 봇 1개 등록됨</span>
                      </div>
                    </div>
                    <div className="text-[#86959E] hover:text-white transition-colors cursor-pointer select-none text-xs font-bold">
                      •••
                    </div>
                  </div>

                  {/* Telegram Message Area */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col-reverse justify-start scrollbar-hide bg-[#182533]">
                    {/* Reverse map to show newest at bottom */}
                    {tgMessages.slice().reverse().map((m) => {
                      if (m.sender === 'system') {
                        return (
                          <div key={m.id} className="w-full flex justify-center py-1 select-none">
                            <span className="bg-[#111A24]/60 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-[100px] border border-[#1C2836]">
                              {m.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={m.id} className="w-full flex items-start gap-2 text-left">
                          <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-extrabold text-xs shrink-0 select-none">
                            Bot
                          </div>
                          
                          <div className="space-y-1 max-w-[85%] text-left">
                            <div className="flex items-center gap-1.5 leading-none">
                              <span className="font-extrabold text-[11px] text-[#5288C1]">{m.name || '다시시작 알림봇'}</span>
                              <span className="bg-[#22313F] text-[#5288C1] text-[8px] px-1 py-0.2 rounded font-extrabold uppercase">BOT</span>
                            </div>

                            {/* Alert Card Box */}
                            {m.card && (
                              <div className="bg-[#22313F] border border-[#2B3E50] rounded-2xl p-4 space-y-3 shadow-md relative text-left">
                                <div className="flex items-center justify-between border-b border-[#2C3B4B] pb-2 leading-none">
                                  <span className="font-black text-xs text-white flex items-center gap-1">
                                    <Bell className="w-3.5 h-3.5 text-brand" />
                                    <span>{m.card.type === 'direct' ? '🔔 신규 직접선택 상담 요청' : '📢 참여형 상담 오픈 요청'}</span>
                                  </span>
                                  <span className="text-[#86959E] text-[9px]">{m.time}</span>
                                </div>

                                <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
                                  <div>• <strong className="text-slate-400">수신 유형:</strong> {m.card.type === 'direct' ? '1:1 대리인 다이렉트 지정' : '최대 3명 선착순 오픈 배정'}</div>
                                  <div>• <strong className="text-slate-400">관할 지역:</strong> {m.card.region} 법원 관할</div>
                                  <div>• <strong className="text-slate-400">채무 규모:</strong> {m.card.debt}</div>
                                  <div>• <strong className="text-slate-400">소득 수준:</strong> {m.card.income} ({m.card.dependents})</div>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {m.card.tags.map(t => (
                                    <span key={t} className="bg-[#1C2836] text-brand-light text-[9px] px-2 py-0.5 rounded font-bold">{t}</span>
                                  ))}
                                </div>

                                {/* Inline Actions inside Telegram message */}
                                <div className="pt-2 border-t border-[#2C3B4B] flex flex-col gap-2">
                                  {m.card.assignedLawyer ? (
                                    <div className="w-full py-2 bg-emerald-950/40 text-emerald-400 text-center rounded-lg border border-emerald-500/20 text-[10px] font-extrabold flex items-center justify-center gap-1 animate-fadeIn select-none">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{m.card.assignedLawyer} 수임 배정 완료</span>
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        type="button"
                                        onClick={() => handleTgAssign(m.id, m.card!.reqId)}
                                        className="w-full py-2 bg-brand hover:bg-brand-hover text-white text-[10px] font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1 select-none cursor-pointer"
                                      >
                                        <span>🙋 내가 즉시 담당자로 배정 등록</span>
                                      </button>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setActiveChatReqId(m.card!.reqId);
                                            setActiveTab('open-requests');
                                            alert('플랫폼의 신규 상담 탭으로 즉시 안전하게 스위칭하여 의뢰인 상세 명세를 조회합니다.');
                                          }}
                                          className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-slate-300 text-[9px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                        >
                                          💻 CRM 상세보기
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => alert('30분 후 해당 채무자의 상담 응답 미결 상태를 텔레그램 그룹방에 다시 리마인드 호출합니다.')}
                                          className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-slate-350 text-[9px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
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
                  <div className="bg-[#22313F] px-4 py-3 flex items-center gap-3 border-t border-[#141E28] select-none text-[10px] text-slate-400 text-center justify-center font-semibold">
                    🔒 그룹방 프라이버시 모드 가동 중 (봇은 일반 대화를 기록하지 않고 명령어 액션만 수신합니다)
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Sub status footer */}
      <footer className="bg-[#0F1626] border-t border-[#1F2937]/80 px-6 py-6 text-left text-[10px] text-slate-500 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-400">
              <span>{platformConfig.siteLogoText || "주식회사 회생톡"}</span>
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
            <p>© 2026 {platformConfig.siteLogoText || "회생톡"} 도산 전문 변호사 CRM. All rights reserved.</p>
          </div>
        </div>
      </footer>

      </div>
    </div>
  );
}
