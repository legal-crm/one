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

const getDisplayPhoneNumber = (req: ConsultRequest): string => {
  if (req.phoneConsultationRequested) {
    if (req.safeNumber) {
      const now = Date.now();
      const expires = req.safeNumberExpiresAt ? new Date(req.safeNumberExpiresAt).getTime() : 0;
      if (now > expires) {
        return "050 ?ˆì‹¬ë²ˆí˜¸ ë§Œë£Œ??(72?œê°„ ì´ˆê³¼)";
      }
      return `${req.safeNumber} (050 ?ˆì‹¬ë²ˆí˜¸)`;
    }
    return `${req.phone} (?¼ë°˜ ë²ˆí˜¸)`;
  }
  return "050 ë¯¸ë°°??(?„í™” ?ë‹´ ?”ì²­ ???ë™ ?°ë™)";
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
            ? '?ˆí‡´ ì²˜ë¦¬ ?„ë£Œ??ê³„ì •?…ë‹ˆ?? ?´ë‹¹ ê³„ì • ?•ë³´ë¥????´ìƒ ?´ìš©?????†ìŠµ?ˆë‹¤.'
            : '???€ë¦¬ì¸ ê³„ì •?€ ?´ì˜?•ì±… ?„ë°˜?¼ë¡œ ?¸í•´ ?„ì‹œ ?•ì? ì²˜ë¦¬?˜ì—ˆ?µë‹ˆ?? ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì‹­?œì˜¤.';
          alert(msg);
          localStorage.removeItem('legal_crm_lawyer_session');
          setIsLoggedIn(false);
        } else if (currentMember.status === 'dormant') {
          if (confirm('?´ë©´ ì²˜ë¦¬??ê³„ì •?…ë‹ˆ?? ?´ë©´???´ì œ?˜ê³  ?•ìƒ ?œì„±?”í•˜?œê² ?µë‹ˆê¹?')) {
            setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
            onLogActivity(
              currentMember.id,
              currentMember.alias,
              'LAWYER',
              'LOGIN',
              `ë³€?¸ì‚¬ ?´ë©´ ê³„ì • ?˜ë™ ?´ë©´ ?´ì œ ?±ê³µ`
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
  const [signupFields, setSignupFields] = useState<string[]>(['ê°œì¸?Œìƒ']);
  const [signupRegion, setSignupRegion] = useState<string>('?œìš¸');
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
      alert('?Œì¼ ?¬ê¸°ê°€ 5MBë¥?ì´ˆê³¼?©ë‹ˆ?? ???‘ì? ?Œì¼??? íƒ?´ì£¼?¸ìš”.');
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
      alert('?„ë¡œ???¬ì§„?€ 2MB ?´í•˜ë¡??¬ë ¤ì£¼ì„¸??');
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
    'req-1': 'ì±„ë¬´?ê? ê°€???”í ? ë¬¼ ê±°ë˜ ëª…ì„¸???Œì‹±???Œê·¹?ì„. ë²•ê? ìµœê·¼ ?¬ì‚¬??ë¶ˆë¦¬?¨ì„ ?¬ìƒ???„ìš”.',
    'req-2': '?”ì–‘ë³´í˜¸???˜ì…??ë³´ê±´?„ìƒë¶€ ê³ ì‹œ ìµœì??ê³„ë¹??´í•˜??ê°œì¸?Œì‚° ë©´ì±… ?„í–¥??ë§¤ìš° ?ˆì „??ë³´ì„.',
    'req-3': '?Œì‚¬ ê¸‰ì—¬ ê°€?•ë¥˜ ?µì? ?¨ë ¥ ?•ì?ë¥??„í•œ ê¸´ê¸‰ ê¸ˆì?ëª…ë ¹ ?¬ë¦¬ ?‘ì„±?€??? ì† ë°°ì • ?„ë£Œ.'
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
      time: '?¤í›„ 1:12',
      text: '?¤– ?¤ì‹œ?œì‘ ?Œë¦¼ë´?@restart_alarm_bot)??ê·¸ë£¹??ì°¸ì—¬?ˆìŠµ?ˆë‹¤.'
    },
    {
      id: 'tg-sys-2',
      sender: 'system',
      time: '?¤í›„ 1:13',
      text: '?™ï¸ ?€?œë°© ?”ë ˆê·¸ë¨ ?°ë™ Chat ID(12948592948) ë°”ì¸???„ë£Œ'
    },
    {
      id: 'tg-msg-1',
      sender: 'bot',
      time: '?¤í›„ 2:20',
      card: {
        type: 'direct',
        reqId: 'req-2',
        region: '?œìš¸/ê²½ê¸°',
        debt: '5ì²œë§Œ ~ 1????,
        income: '150ë§?~ 200ë§???,
        dependents: '?ë? 1??,
        tags: ['#?ì˜?…í??, '#?í™œê³ ìƒê³„ë¹„ë¶€ì¡?, '#?Œì‚°ë©´ì±…?í•©'],
        assignedLawyer: '?´ì†Œë¯?ë³€?¸ì‚¬'
      }
    }
  ]);

  const handleTgTestNotification = () => {
    if (!tgConnected) {
      alert('?”ë ˆê·¸ë¨ ë´‡ì´ ?œì„±?”ë˜???ˆì? ?ŠìŠµ?ˆë‹¤.');
      return;
    }
    const testCard = {
      id: `tg-test-${Date.now()}`,
      sender: 'bot' as const,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      card: {
        type: 'open' as const,
        reqId: 'req-1',
        region: '?œìš¸ ?œì´ˆ',
        debt: '5ì²œë§Œ ~ 1????,
        income: '200ë§?~ 300ë§???,
        dependents: '?†ìŒ',
        tags: ['#ì½”ì¸? ë¬¼?µì…˜?¤íŒ¨', '#?Œë ¤ë§‰ê¸°?œê³„', '#?…ì´‰?„ê¸°'],
      }
    };
    setTgMessages(prev => [...prev, testCard]);
    alert('?”ë ˆê·¸ë¨ ë³´ì•ˆ ?ŒìŠ¤???Œë¦¼??ë°œì†¡?˜ì—ˆ?µë‹ˆ?? ?°ì¸¡ ?”ë ˆê·¸ë¨ ?œë??ˆì´??ì°½ì„ ?•ì¸?˜ì„¸??');
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

    alert(`[?¤ì‹œ?œì‘ CRM ?°ë™] ${activeLawyer.name} ?˜ì´ ?´ë‹¹ ë³€?¸ì‚¬ë¡?ì§€?•ë˜?ˆìŠµ?ˆë‹¤. ?¤ì‹œê°??‘ì—…??ì±„íŒ…) ??—???˜ë¢°???Œëª… ë¶„ì„??ê°œì‹œ?????ˆìŠµ?ˆë‹¤.`);
  };

  // Auth logic
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('?´ë©”??ID)ê³?ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.');
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
        l.name.replace(/\s*ë³€?¸ì‚¬|\s*?¤ì¥/g, '').toLowerCase() === cleanedLoginId
      );
    }

    if (!found) {
      setLoginError('?±ë¡?˜ì? ?Šì? ?´ë©”??ID) ?ëŠ” ?¬ìš©?ëª…?…ë‹ˆ??');
      return;
    }

    // Bypass password check for simple bypass account
    if (cleanedLoginId !== '1' && found.password && found.password !== loginPassword) {
      setLoginError('ë¹„ë?ë²ˆí˜¸ê°€ ?¼ì¹˜?˜ì? ?ŠìŠµ?ˆë‹¤.');
      return;
    }

    // Unapproved account check
    if (found.approved === false) {
      setLoginError('ê´€ë¦¬ì ?ê²© ?¹ì¸ ?¬ì‚¬ê°€ ?„ë£Œ?˜ì? ?Šì? ê³„ì •?…ë‹ˆ?? ê´€ë¦¬ì ?¹ì¸ ??ë¡œê·¸?¸ì´ ê°€?¥í•©?ˆë‹¤.');
      return;
    }

    // Suspended, Withdrawn, or Dormant check before logging in
    const currentMember = members.find(m => m.id === found.id);
    if (currentMember) {
      if (currentMember.status === 'suspended' || currentMember.status === 'withdrawn') {
        const errorMsg = currentMember.status === 'withdrawn'
          ? '?ˆí‡´ ?„ë£Œ??ê³„ì •?…ë‹ˆ?? ?´ë‹¹ ê³„ì •?€ ???´ìƒ ?¬ìš©?????†ìŠµ?ˆë‹¤.'
          : '??ê³„ì •?€ ê´€ë¦¬ì???˜í•´ ?„ì‹œ ?•ì? ì²˜ë¦¬?˜ì—ˆ?µë‹ˆ?? ?´ë“œë¯??¬í„¸??ë¬¸ì˜?˜ì‹­?œì˜¤.';
        setLoginError(errorMsg);
        return;
      } else if (currentMember.status === 'dormant') {
        if (confirm('?´ë©´ ì²˜ë¦¬??ê³„ì •?…ë‹ˆ?? ?´ë©´???´ì œ?˜ê³  ?•ìƒ ?œì„±?”í•˜?œê² ?µë‹ˆê¹?')) {
          setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
          onLogActivity(
            currentMember.id,
            currentMember.alias,
            'LAWYER',
            'LOGIN',
            `ë³€?¸ì‚¬ ?´ë©´ ê³„ì • ?˜ë™ ?´ë©´ ?´ì œ ?±ê³µ`
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

    onLogActivity(found.id, found.name, found.role as MemberRole, 'LOGIN', 'ë¡œíŒ CRM ?ŒíŠ¸??ë¡œê·¸???±ê³µ');
    setMembers(prev => prev.map(m => m.id === found.id ? { ...m, lastActiveAt: new Date().toISOString() } : m));
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupId.trim() || !signupPassword.trim() || !signupName.trim()) {
      setSignupError('?„ìˆ˜ ?…ë ¥ ??ª©(* ?œì‹œ)??ëª¨ë‘ ?…ë ¥?´ì£¼?¸ìš”.');
      return;
    }

    const cleanedSignupId = signupId.trim().toLowerCase();
    const exists = lawyers.some(l => 
      l.id.toLowerCase() === cleanedSignupId || 
      l.name.toLowerCase() === signupName.trim().toLowerCase()
    );

    if (exists) {
      setSignupError('?´ë? ?±ë¡?˜ì–´ ?ˆëŠ” ID ?ëŠ” ?´ë¦„?…ë‹ˆ??');
      return;
    }

    const newLawyer: User = {
      id: signupId.trim(),
      lawFirmId: 'firm-1',
      teamId: signupRole === 'LAWYER' ? 'team-1' : 'team-1',
      name: signupName.trim() + (signupRole === 'LAWYER' ? ' ë³€?¸ì‚¬' : ' ?¤ì¥'),
      role: signupRole,
      fields: signupFields,
      region: signupRegion,
      avatar: avatarImageData || signupAvatar,
      avatarData: avatarImageData || undefined,
      bio: signupBio.trim() || `${signupName.trim()} ${signupRole === 'LAWYER' ? 'ë³€?¸ì‚¬' : '?¤ì¥'}?…ë‹ˆ??`,
      recentActivity: '? ê·œ ?Œì› ê°€???„ë£Œ',
      matchedCount: 0,
      password: signupPassword,
      approved: false, // New lawyer accounts must be approved by the admin portal
      licenseImageData: licenseImageData || undefined,
      licenseNumber: signupLicenseNumber.trim() || undefined,
      licenseStatus: 'pending'
    };

    setLawyers(prev => [...prev, newLawyer]);

    // Create a new Member for admin tracking
    const newMember: Member = {
      id: signupId.trim(),
      email: signupId.trim() + '@rehablaw.com',
      alias: signupName.trim() + (signupRole === 'LAWYER' ? ' ë³€?¸ì‚¬' : ' ?¤ì¥'),
      role: signupRole as MemberRole,
      createdAt: new Date().toISOString(),
      loginChannel: 'email',
      status: 'pending', // Awaiting admin approval
      lastActiveAt: new Date().toISOString()
    };
    setMembers(prev => [...prev, newMember]);
    onLogActivity(newMember.id, newMember.alias, newMember.role, 'SIGNUP', 'ë¡œíŒ CRM ?ŒíŠ¸??? ê·œ ê°€??? ì²­ ?„ë£Œ (?ê²© ?¬ì‚¬ ?€ê¸?');

    alert('?Œì›ê°€?…ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??\n\nê´€ë¦¬ìê°€ ë³€?¸ì‚¬ ?±ë¡ì¦ì„ ?•ì¸?????¹ì¸ ì²˜ë¦¬?©ë‹ˆ??\n?¹ì¸ ?„ë£Œ ??ë¡œê·¸?¸ì´ ê°€?¥í•©?ˆë‹¤.');
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
  };

  const handleLogout = () => {
    if (confirm('ë¡œê·¸?„ì›ƒ ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) {
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
    alert('?˜ë¢°??ê¸°ë³¸ ?¸ì  ?•ë³´ê°€ ?±ê³µ?ìœ¼ë¡??…ë°?´íŠ¸?˜ì—ˆ?µë‹ˆ??');
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
    alert('?ë‹´ ?¸ì…˜ ë°°ì • ë°??íƒœê°€ ?±ê³µ?ìœ¼ë¡??€?¥ë˜?ˆìŠµ?ˆë‹¤.');
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
      `?ˆë…•?˜ì‹­?ˆê¹Œ, ${activeLawyer.name}?…ë‹ˆ?? ?”ì²­??ì£¼ì‹  ê°€ê³??Œë“ ë°?ì±„ë¬´ ?„ê¸° ëª…ì„¸ë¥?ê¸´ê¸‰ ?¡ë‹¬ ê²€? í•˜?€?µë‹ˆ?? ?•ë¥˜ ?ˆê³  ë°?ë³´ì • ?€????ì¦‰ì‹œ ?¨ë ¥??ë°œìƒ?˜ëŠ” ë²•ì  ?€?‘ì— ?€?˜ì—¬ ?¸ë? ë²•ë¦¬ ê²€? ë? ?„ì??œë¦¬ê² ìŠµ?ˆë‹¤.`,
      'lawyer',
      activeLawyer.id,
      activeLawyer.name
    );

    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'CONSULT_REQUEST',
      `?˜ë¢°???ë‹´ ?”ì²­ ì°¸ì—¬ ?˜ë½ (?”ì²­ ID: ${reqId})`
    );

    setActiveChatReqId(reqId);
    setMobilePane('chat');
    setActiveTab('active-chats');
  };

  // Turn active request into an formal Case (?˜ì„ ?„ë£Œ)
  const handleConvertToCase = (req: ConsultRequest) => {
    const isAlreadyCase = cases.some(c => c.clientId === req.clientId);
    if (isAlreadyCase) {
      alert('?´ë? ?•ì‹ ?˜ì„ ?¬ê±´?¼ë¡œ ?±ë¡??ê³ ê°?…ë‹ˆ??');
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
        '?ë‹´ ?„ë£Œ ???•ì‹ ë³€ì±??¬ê±´ ? ì„ ?„ë£Œ',
        `ê°€ê³?ì±„ë¬´ ë¶„ì„??${req.financialProfile.debtTotal.toLocaleString()}ë§??? ë°?? ë¶„ ?œë¥˜ ë³´ì™„ ì§€??,
        'ê´€??ë²•ì› ê°€?•ë¥˜ ì§ë¬´ ì¤‘ë‹¨ ëª…ë ¹ ì²?µ¬ ?ˆì •'
      ]
    };

    setCases(prev => [newCase, ...prev]);
    // Close consultation
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'closed' } : r));
    alert(`${req.clientName} ?˜ë¢°?¸ì´ ?•ì‹ ?¬ê±´(? ì„ê³??„ë£Œ)?¼ë¡œ ?„í™˜ ?˜ì„ ?±ë¡?˜ì—ˆ?µë‹ˆ??`);
    setActiveTab('cases');
  };

  const handleUpdateCaseStatus = (caseId: string, nextStatus: CaseStatus) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() } : c));
    
    // Log case status update
    const targetCase = cases.find(c => c.id === caseId);
    const clientName = targetCase ? targetCase.clientName : '?˜ë¢°??;
    onLogActivity(
      activeLawyer.id,
      activeLawyer.name,
      activeLawyer.role as MemberRole,
      'STATUS_CHANGE',
      `?¬ê±´ ì§„í–‰ ?¨ê³„ ?˜ì •: ${clientName} ?˜ë¢°??-> [${nextStatus}]`
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
      `?˜ë¢°???ë‹´ ?€???‘ì„±: "${chatInput.trim().substring(0, 30)}${chatInput.trim().length > 30 ? '...' : ''}"`
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
      address: profile.residenceRegion || '?œìš¸',
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
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="myê¹€ë³€ ë¡œê³ " className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-slate-800">{(platformConfig.siteLogoText || "myê¹€ë³€")} ë³€?¸ì‚¬ CRM</span>
            </div>
            <p className="text-slate-500 text-xs">?„ì‚° ?„ë¬¸ ë²•ë¥  ?€ë¦¬ì¸ ?µí•© ?”ë£¨??/p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-200 pb-2">ë¡œê·¸??/h3>
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl">
                  {loginError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">?„ì´??(?´ë¦„ ?ëŠ” ID)</label>
                <input 
                  type="text" 
                  placeholder="?? 1 ?ëŠ” ê¹€?°ì§„ ?ëŠ” lawyer-1"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800 placeholder-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">ë¹„ë?ë²ˆí˜¸</label>
                <input 
                  type="password" 
                  placeholder="ë¹„ë?ë²ˆí˜¸ ?…ë ¥ (ê¸°ë³¸: 1)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* Quick test login info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-600 block">?”‘ ?ŒìŠ¤??ë¡œê·¸??ê³„ì • ?•ë³´</span>
                <div>???„ì´?? <strong className="text-slate-800">1</strong> / ë¹„ë?ë²ˆí˜¸: <strong className="text-slate-800">1</strong></div>
                <div>??(?ëŠ” ë³€?¸ì‚¬ëª? <strong className="text-slate-700">ê¹€?°ì§„</strong> / ë¹„ë?ë²ˆí˜¸: <strong className="text-slate-700">1234</strong>)</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  type="submit"
                  className="flex-1 bg-brand hover:bg-brand-hover text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md"
                >
                  ë¡œê·¸??
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
                  ?ŒìŠ¤??ê³„ì • 1ì´?ë¡œê·¸??
                </button>
              </div>
              <div className="text-center pt-2 text-xs text-slate-400">
                ê³„ì •???†ìœ¼? ê???{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('signup')}
                  className="text-brand font-bold hover:underline"
                >
                  ?Œì›ê°€?…í•˜ê¸?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-left max-h-[450px] overflow-y-auto pr-1 scrollbar-hide">
              <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-200 pb-2">?Œì›ê°€??/h3>
              {signupError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl">
                  {signupError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">?„ì´??(ID)*</label>
                  <input 
                    type="text" 
                    placeholder="?? lawyer-kim"
                    value={signupId}
                    onChange={(e) => setSignupId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">ë¹„ë?ë²ˆí˜¸*</label>
                  <input 
                    type="password" 
                    placeholder="ë¹„ë?ë²ˆí˜¸ ?…ë ¥"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">?´ë¦„ (?±ëª…)*</label>
                  <input 
                    type="text" 
                    placeholder="?? ?ê¸¸??
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">??•  êµ¬ë¶„*</label>
                  <select 
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as 'LAWYER' | 'STAFF')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                  >
                    <option value="LAWYER">ë³€?¸ì‚¬ (LAWYER)</option>
                    <option value="STAFF">?¤ì¥/?¬ë¬´??(STAFF)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">?„ë¬¸ë¶„ì•¼ (?¼í‘œë¡?êµ¬ë¶„)</label>
                <input 
                  type="text" 
                  placeholder="?? ê°œì¸?Œìƒ, ê°œì¸?Œì‚°, ë³´ì •ëª…ë ¹?€??
                  onChange={(e) => setSignupFields(e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">?œë™ ì§€??/label>
                <input 
                  type="text" 
                  placeholder="?? ?œìš¸, ê²½ê¸°/?˜ì›, ë¶€??
                  value={signupRegion}
                  onChange={(e) => setSignupRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">?„ë¡œ???¬ì§„ ?…ë¡œ??/label>
                <div className="flex items-center gap-3">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="?„ë¡œ??ë¯¸ë¦¬ë³´ê¸°" className="w-12 h-12 rounded-xl object-cover border border-brand/30 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] shrink-0 border border-slate-200">?¬ì§„</div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-2.5 text-xs text-slate-400 text-center hover:border-brand/50 transition-colors">
                      ?“· ?´ë¦­?˜ì—¬ ?„ë¡œ???¬ì§„ ? íƒ
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* ë³€?¸ì‚¬ ?±ë¡ì¦?ì²¨ë? (?µì‹¬ ?ê²© ì¦ë¹™) */}
              <div className="space-y-1.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <label className="text-[10px] text-amber-600 block uppercase font-bold">?“‹ ë³€?¸ì‚¬ ?±ë¡ì¦?ì²¨ë? (?„ìˆ˜ ?ê²© ì¦ë¹™)*</label>
                <p className="text-[10px] text-slate-500 leading-relaxed">ê´€ë¦¬ìê°€ ?±ë¡ì¦ì„ ?•ì¸????ê³„ì •???¹ì¸?©ë‹ˆ?? ?´ë?ì§€ ?ëŠ” PDF ?Œì¼??ì²¨ë??´ì£¼?¸ìš”.</p>
                <label className="block cursor-pointer">
                  <div className={`border ${licensePreview ? 'border-emerald-300' : 'border-slate-200 border-dashed'} rounded-xl p-3 text-xs text-center transition-colors hover:border-brand/50 bg-white`}>
                    {licensePreview ? (
                      <div className="space-y-2">
                        <img src={licensePreview} alt="?±ë¡ì¦?ë¯¸ë¦¬ë³´ê¸°" className="max-h-32 mx-auto rounded-lg object-contain" />
                        <span className="text-emerald-600 text-[10px] font-bold">???Œì¼ ì²¨ë? ?„ë£Œ ???¤ì‹œ ? íƒ?˜ë ¤ë©??´ë¦­</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">?“ ?´ë¦­?˜ì—¬ ë³€?¸ì‚¬ ?±ë¡ì¦??´ë?ì§€ ì²¨ë? (ìµœë? 5MB)</span>
                    )}
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleLicenseFileChange} className="hidden" />
                </label>
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] text-slate-500 block uppercase font-bold">ë³€?¸ì‚¬ ?±ë¡ë²ˆí˜¸</label>
                  <input
                    type="text"
                    placeholder="?? 12345"
                    value={signupLicenseNumber}
                    onChange={(e) => setSignupLicenseNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 block uppercase font-bold">?Œê°œ ?½ë ¥(Bio)</label>
                <textarea 
                  rows={2}
                  placeholder="?„ë¬¸ ?€ë¦¬ì¸?¼ë¡œ?œì˜ ?½ë ¥ ë°??¸ì‚¬ë§ì„ ?‘ì„±?˜ì„¸??"
                  value={signupBio}
                  onChange={(e) => setSignupBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md mt-2"
              >
                ? ê·œ ?€ë¦¬ì¸ ?±ë¡ ?„ë£Œ
              </button>
              <div className="text-center pt-2 text-xs text-slate-400">
                ?´ë? ê³„ì •???ˆìœ¼? ê???{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('login')}
                  className="text-brand font-bold hover:underline"
                >
                  ë¡œê·¸?¸í•˜ê¸?
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
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* logo & brand header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="myê¹€ë³€ ë¡œê³ " className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-xl tracking-tight text-slate-800">{(platformConfig.siteLogoText || "myê¹€ë³€")} ë³€?¸ì‚¬ CRM</span>
            </div>
            <p className="text-slate-500 text-xs">?„ì‚° ?„ë¬¸ ë²•ë¥  ?€ë¦¬ì¸ ?µí•© ?”ë£¨??/p>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-xs text-left space-y-2 leading-relaxed">
            <h4 className="font-bold text-sm text-center">??ê³„ì • ?¹ì¸ ?¬ì‚¬ ?€ê¸?ì¤?/h4>
            <p>?ˆë…•?˜ì„¸?? <strong>{activeLawyer.name}</strong> ??</p>
            <p>?„ì¬ ê³„ì • ?ê²© ?•ì¸ ë°??•ì‹ ?Œì† ?¹ì¸ ?ˆì°¨ê°€ ì§„í–‰ ì¤‘ì…?ˆë‹¤.</p>
            <p>{platformConfig.siteLogoText || "myê¹€ë³€"} ?Œë«?¼ì? ë³€?¸ì‚¬ë²???4ì¡??•ì‹ ë³€?¸ì‚¬ ?ê²© ê²€ì¦??˜ë¬´???°ë¼, ê´€ë¦¬ì???˜ë™ ?¼ì´? ìŠ¤ ê²€? ë? ê±°ì³ ?œë™???¹ì¸?˜ê³  ?ˆìŠµ?ˆë‹¤.</p>
            <p className="text-[11px] text-slate-500">* ?´ë“œë¯??˜ì´ì§€(Admin Portal)?ì„œ ë³?ê³„ì •???¹ì¸ ì²˜ë¦¬ë¥??˜ì‹¤ ???ˆìŠµ?ˆë‹¤.</p>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold py-3 rounded-[200px] text-xs border border-slate-200 transition-colors shrink-0"
          >
            ë¡œê·¸?„ì›ƒ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand selection:text-white">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-slate-50 border-x border-slate-200 shadow-2xl flex flex-col relative">
      
        {/* Lawyer CRM Premium Header */}
        <header className="sticky top-0 z-40 bg-white backdrop-blur-md border-b border-slate-200 shadow-xl px-4 py-3">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt="myê¹€ë³€ ë¡œê³ " className="w-8 h-8 rounded-lg object-cover" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-sm tracking-tight text-white">{(platformConfig.siteLogoText || "myê¹€ë³€")} ë³€?¸ì‚¬ CRM</span>
                  <span className="bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded font-extrabold text-[9px] tracking-wider uppercase">SaaS</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">?„ì‚° ?„ë¬¸ ë²•ë¥  ?€ë¦¬ì¸ ì§€ë¶€</span>
              </div>
              <span className="text-slate-700 text-xs hidden sm:inline ml-2 border-l border-slate-200 pl-3">?€: {activeLawyer.name.split(' ')[0]} ë²•ë¥ ì§€ë¶€</span>
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
                  <span className="text-[9px] text-slate-400 mt-0.5">{activeLawyer.role}</span>
                </div>
              </div>
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-100 text-slate-450 hover:text-white px-2.5 py-1.5 rounded-[200px] border border-slate-200 text-[10px] transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>ë¡œê·¸?„ì›ƒ</span>
              </button>
            </div>
          </div>
        </header>

        {/* Primary tab navigation row */}
        <div className="bg-white border-b border-slate-200 px-4">
          <div className="w-full flex overflow-x-auto gap-4 py-2 text-xs font-semibold scrollbar-hide">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'dashboard' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>ì¢…í•© ?€?œë³´??/span>
            </button>
            
            <button 
              onClick={() => setActiveTab('open-requests')}
              className={`relative pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'open-requests' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>? ê·œ ?ë‹´ ?”ì²­</span>
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
              <span>?¤ì‹œê°??‘ì—…??(ì±„íŒ…)</span>
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
              <span>ê³ ê° ê´€ë¦?(CRM)</span>
              <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 text-[9px]">
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
              <span>ì§„í–‰ ì¤‘ì¸ ?˜ì„ ?¬ê±´ (SaaS)</span>
              <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 text-[9px]">
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
              <span>?´ìš© ?”ê¸ˆ??/ ë¹Œë§</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'settings' ? 'border-brand text-brand font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>?Œë¦¼ ë°??°ë™ ?¤ì •</span>
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
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">?¤í”ˆ ?€ê¸°ì¤‘ ? ì²­</span>
                  <span className="text-2xl font-black text-brand-light">{totalOpenRequestsCount}ê°?/span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand/10 text-brand-light">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">ì§ì ‘ ì§€???‘ë‹µ ?€ê¸?/span>
                  <span className="text-2xl font-black text-brand-light">{directCounselingCount}ê°?/span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand/10 text-brand-light">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">?´ê? ì°¸ì—¬ì¤‘ì¸ ?ë‹´</span>
                  <span className="text-2xl font-black text-emerald-400">{activeChatsCount}ê°?/span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-400/10 text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">?¬ê±´???˜ì„ ê³„ì•½) ?±ê³µ</span>
                  <span className="text-2xl font-black text-purple-400">{totalCasesCount}ê±?/span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-400/10 text-purple-400">
                  <FolderHeart className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Daily Conversion Stats and Team KPIs */}
              <div className="lg:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>?€ë³??„ì‚° ?„ë¬¸ ?ì—… KPI ë¶„ì„ (?¤ì‹œê°?</span>
                  </h3>
                  <span className="bg-slate-100 border border-slate-850 px-2 py-0.5 rounded text-[10px]">?¤ëŠ˜: 2026-05-26</span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* KPI Progress 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">?Œìƒ/?Œì‚° ?ë‹´?„í™” ?¬ê±´ ?˜ì„ ë³€?˜ë¥  (Target: 40%)</span>
                      <span className="text-emerald-400 font-bold">44.5% (?¬ì„±)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[85%] rounded-full"></div>
                    </div>
                  </div>

                  {/* KPI Progress 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">?‰ê·  ë²•ì› ë³´ì • ê¶Œê³ ?€???©ê¸° (Target: 7????</span>
                      <span className="text-indigo-400 font-bold">5.8??(ë³´ê°• ?„ìš”)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full w-[70%] rounded-full"></div>
                    </div>
                  </div>

                  {/* KPI Progress 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs font-semibold">?ë‹´ ì°¸ì—¬ ??Lock) ?Œì§„??- ë§ˆì????ê? ?€ë¹??„í™˜</span>
                      <span className="text-brand-light font-bold">68.2%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand h-full w-[68%] rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Sub regional performance box */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">?˜ì›ì§€ë²?ì§€ë¶€</span>
                    <strong className="text-xs text-indigo-300">ì´??˜ì„ 42M</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">?œìš¸?Œìƒë²•ì›</span>
                    <strong className="text-xs text-brand-light">ì´??˜ì„ 155M</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">ë¶€?°ì?ë°©ë²•??/span>
                    <strong className="text-xs text-emerald-300">ì´??˜ì„ 60M</strong>
                  </div>
                </div>
              </div>

              {/* CRM Active Info Guide */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-3">
                  <Shield className="w-4 h-4 text-brand-light" />
                  <span>?Œë«??ê³µì¡´ ?ì¹™ ì¤€???”ì•½</span>
                </h3>
                <ul className="text-xs space-y-2.5 text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>?˜ë¢°?¸ì´ ?ë‹´???ë°œ?ìœ¼ë¡?ê°œì„¤???”ì²­???€?´ì„œë§?ë³´ì • ?‘ê·¼?????ˆìŠµ?ˆë‹¤.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>?¤í”ˆ ?¤ì¤‘ì°¸ì—¬??ë§¤ì¹­?€ ? ì°©??3???„ë‹¬ ???ìœ¨ ?œìŠ¤?œì´ ??Lock)???ì„±?©ë‹ˆ??</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>ê°œë³„ ?„ì˜ DM ë°??€??ê´‘ê³  ?¸ì¶œ?€ ë¶ˆê??˜ë©°, ?±ê³¼ ?˜ìˆ˜ë£?ê°ˆì·¨ ?‰ìœ„??ê¸ˆì??©ë‹ˆ??</span>
                  </li>
                </ul>

                <button 
                  onClick={() => setActiveTab('open-requests')}
                  className="w-full bg-slate-850 hover:bg-slate-100 text-brand-light font-bold py-2 rounded-[200px] text-xs border border-slate-200 transition-colors"
                >
                  ???ë‹´?”ì²­ ?˜ì§‘?•ì¸ &rarr;
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: INCOMING COUNSEL REQUESTS LIST */}
        {activeTab === 'open-requests' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-800">?¤í”ˆ ë°?ì§€???ë‹´ ?”ì²­ ?€ê¸??€?œë³´??/h2>
                <p className="text-xs text-slate-400 mt-0.5">?ì„¸ ì±„ë¬´ êµ¬ì¡°?€ ê°€??ê°€ê³??Œë“ ì§„ë‹¨ ?µê³„ë¥?ê²€????ì°¸ì—¬?˜ì‹­?œì˜¤.</p>
              </div>

              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                ?„ê³µ ?°ë„: ?Œìƒ?Œì‚° ?„ë‹´?€ R-1
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {requests
                .filter(r => r.status === 'requested' || (r.status === 'responding' && r.selectedLawyerId === activeLawyer.id))
                .map(r => {
                  const debtRatio = (r.financialProfile.debtTotal / (r.financialProfile.income * 12)).toFixed(1);
                  return (
                    <div key={r.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-slate-200 transition-all flex flex-col md:flex-row justify-between gap-6">
                      
                      {/* Left: Client detailed debt statistics query */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand/10 text-brand-light font-bold px-2 py-0.5 rounded text-[10px]">
                            {r.requestType === 'direct' ? '?¨ë…ì§€ëª? : '?¤í”ˆ??}
                          </span>
                          <span className="text-xs text-slate-400">?˜ë¢°?? <strong>{r.clientName}</strong></span>
                          <span className="text-xs text-slate-500">|</span>
                          <span className="text-xs text-slate-400">?±ë¡?? {new Date(r.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-slate-800">{r.title}</h3>
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{r.content}</p>
                        </div>

                        {/* Calculations Panel */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg text-[11px] text-slate-400 border border-slate-855">
                          <div>??ì´?ê°€ê³?ì±„ë¬´: <strong className="text-brand-light font-extrabold">{r.financialProfile.debtTotal.toLocaleString()}ë§???/strong></div>
                          <div>??ê¸°ì¬ ?ì‚°?˜ì?: <strong className="text-slate-700 font-semibold">{r.financialProfile.assetsTotal.toLocaleString()}ë§???/strong></div>
                          <div>????ê°€ì¤‘ì†Œ?? <strong className="text-slate-700 font-semibold">{r.financialProfile.income}ë§???/strong></div>
                          <div>???Œë“ ?€ë¹?ë¶€ì±„ë¹„: <strong className="text-red-400 font-bold">{debtRatio}ë°??˜ì?</strong></div>
                        </div>

                        {/* Expanded Legal Profile details */}
                        {r.financialProfile.jobType && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 bg-slate-50 p-3 rounded-lg text-[10px] text-slate-450 border border-slate-850">
                            <div>??ì§ì—…? í˜•: <strong className="text-slate-600">{r.financialProfile.jobType === 'SALARIED' ? 'ê¸‰ì—¬?Œë“' : r.financialProfile.jobType === 'BUSINESS' ? '?ì—…?Œë“' : r.financialProfile.jobType === 'DAILY' ? '?¼ìš©ì§? : '?„ë¦¬?œì„œ'} ({r.financialProfile.companyName || 'ë¯¸ê¸°??})</strong></div>
                            <div>??ê±°ì£¼ì§€?? <strong className="text-slate-600">{r.financialProfile.residenceRegion || 'ë¯¸ê¸°??}</strong></div>
                            <div>??ì±„ë¬´?ì¸: <strong className="text-slate-600">{r.financialProfile.debtCause === 'LIVING' ? '?í™œë¹? : r.financialProfile.debtCause === 'BUSINESS' ? '?¬ì—… ?¤íŒ¨' : r.financialProfile.debtCause === 'INVESTMENT' ? `?¬ì ?¤íŒ¨${r.financialProfile.speculativeLoss ? ` (${r.financialProfile.speculativeLoss.toLocaleString()}ë§Œì›)` : ''}` : r.financialProfile.debtCause === 'GAMBLING' ? `?„ë°•/?¬í–‰??{r.financialProfile.gamblingLoss ? ` (${r.financialProfile.gamblingLoss.toLocaleString()}ë§Œì›)` : ''}` : r.financialProfile.debtCause === 'GUARANTEE' ? 'ë³´ì¦' : 'ê¸°í?'}</strong></div>
                            <div>??ì±„ê¶Œ?ìˆ˜ / ì¶”ì‹¬: <strong className="text-amber-400">{r.financialProfile.creditorCount || 0}ê³?/ {r.financialProfile.harassmentLevel === 'CALL' ? 'ì¶”ì‹¬?„í™”' : r.financialProfile.harassmentLevel === 'LETTER' ? '?…ì´‰?? : r.financialProfile.harassmentLevel === 'LAWSUIT' ? '?Œì†¡?œê¸°' : 'ê°€?•ë¥˜/?•ë¥˜'}</strong></div>
                            {r.financialProfile.retirementPay !== undefined && r.financialProfile.retirementPay > 0 && (
                              <div className="col-span-2 sm:col-span-4 mt-1 border-t border-slate-900/30 pt-1 flex items-center justify-between text-slate-400">
                                <span>?’¼ ?ˆìƒ ?´ì§ê¸? <strong className="text-slate-600">{r.financialProfile.retirementPay.toLocaleString()}ë§Œì›</strong> ({r.financialProfile.retirementPensionType === 'pension' ? '?´ì§?°ê¸ˆ ê°€??- 0% ë°˜ì˜' : r.financialProfile.retirementPensionType === 'none' ? '?´ì§?°ê¸ˆ ë¯¸ê???- 50% ë°˜ì˜' : '?´ì§?°ê¸ˆ ì¢…ë¥˜ ëª¨ë¦„ - 50% ë°˜ì˜'})</span>
                                {r.financialProfile.retirementPensionType === 'unknown' && (
                                  <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-amber-500/30 animate-pulse">
                                    ? ï¸ ?´ì§?°ê¸ˆ ?•ì¸ ?„ìš”
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {r.financialProfile.retirementPensionType === 'unknown' && (
                          <div className="pt-1">
                            <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-amber-500/10">
                              ? ï¸ ?ˆìƒ ?´ì§ê¸?ì¡°íšŒ ë°??´ì§?°ê¸ˆ ê°€???•íƒœ ?•ì¸ ?„ìš” (ì±—ë´‡ ëª¨ë¦„ ? íƒ)
                            </span>
                          </div>
                        )}

                        {r.financialProfile.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {r.financialProfile.riskFlags.map(rf => (
                              <span key={rf} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-red-500/10">
                                ? ï¸ {rf}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Quick action panel to "?ë‹´ ì°¸ì—¬" or "?¨ë… ?˜ì„" */}
                      <div className="md:w-60 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 gap-4">
                        <div className="text-xs text-slate-400 space-y-1">
                          <div className="flex justify-between"><span>ìµœë? ì°¸ì—¬ ?œë„:</span> <strong className="text-slate-700">{r.maxParticipants}ëª?/strong></div>
                          <div className="flex justify-between"><span>?„ì¬ ?íƒœ:</span> <strong className="text-brand-light">?”ì²­?€ê¸?/strong></div>
                        </div>

                        <button 
                          onClick={() => handleJoinConsult(r.id)}
                          className="w-full bg-brand hover:bg-brand-hover text-white font-black py-2.5 rounded-[200px] text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>?ë‹´ ì°¸ì—¬ & ?¤ì‹œê°?ì±„íŒ… ì°¸ì—¬</span>
                        </button>
                      </div>

                    </div>
                  );
                })}

              {requests.filter(r => r.status === 'requested' || (r.status === 'responding' && r.selectedLawyerId === activeLawyer.id)).length === 0 && (
                <div className="bg-slate-50 p-12 text-center rounded-xl border border-slate-200 text-slate-500 text-xs">
                  ?„ì¬ ì¦‰ì‹œ ?€?‘í•  ? ê·œ ?ë‹´ ? ì²­ ê±´ì´ ì¡´ì¬?˜ì? ?ŠìŠµ?ˆë‹¤.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: THREE-PANE REAL-TIME CHAT & ë²•ë¥  CRM PANEL */}
        {activeTab === 'active-chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[700px] animate-fadeIn">
            
            {/* PANEL I: INBOX THREADS (LEFT) */}
            <div className={`lg:col-span-3 border-r border-slate-200 flex flex-col h-full bg-white ${mobilePane === 'threads' ? 'block' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-slate-200 bg-slate-50/40">
                <h3 className="font-extrabold text-xs text-slate-700 tracking-wider uppercase">?ë‹´ ì§„í–‰ ë©”ì‹œì§€??/h3>
                <p className="text-slate-500 text-[10px] mt-0.5">?¤ì‹œê°?ë§¤ì¹­???˜ì˜ ?¸ì…˜ ?´ì—­</p>
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
                          <span className="text-[10px] font-bold text-slate-500">?˜ë¢°?? {r.clientName}</span>
                          <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-700 line-clamp-1">{r.title}</h4>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                          <span>ë¶€ì±? {r.financialProfile.debtTotal.toLocaleString()}ë§?/span>
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>?ë‹´ì¤?/span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {requests.filter(r => r.status === 'counseling' && (r.selectedLawyerId === activeLawyer.id || r.requestType === 'open')).length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-[11px] space-y-2">
                    <p>?´ê? ë°°ì •?˜ì–´ ?ë‹´ ê°œì‹œ ì¤‘ì¸ ?œì„± ?€?”ë°©???†ìŠµ?ˆë‹¤.</p>
                    <button 
                      onClick={() => setActiveTab('open-requests')}
                      className="text-brand font-bold hover:underline"
                    >
                      ?ë‹´ ì°¸ì—¬ ?€ê¸?ëª©ë¡ë³´ê¸° &rarr;
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
                        title="ëª©ë¡?¼ë¡œ"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold tracking-widest text-emerald-400 block uppercase">SECURE CHAT CHANNEL</span>
                        <h3 className="font-extrabold text-xs text-slate-700 line-clamp-1">{currentChatRequest.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Mobile toggle to view CRM profile info */}
                      <button 
                        onClick={() => setMobilePane('crm')}
                        className="lg:hidden text-slate-600 hover:text-white font-semibold text-[10px] border border-slate-200 bg-[#161D30] px-2.5 py-1.5 rounded-[200px] transition-all"
                      >
                        ?˜ë¢° ?•ë³´ ?¹ï¸
                      </button>
                      <span className="hidden sm:inline bg-slate-100 border border-slate-200 text-[10px] text-slate-400 px-2 py-0.5 rounded">
                        ?˜ë¢°ì±„ë„ id: {currentChatRequest.id}
                      </span>
                    </div>
                  </div>

                  {/* Chat flow messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[350px] scrollbar-hide">
                    <div className="p-3 bg-[#161D30] rounded-xl text-slate-400 text-xs border border-slate-200 text-left whitespace-pre-wrap">
                      ?“ <span className="text-brand font-bold">?˜ë¢°??ë³¸ë¬¸ ?´ìš©:</span> {currentChatRequest.content}
                    </div>

                    {currentChatMessages.map(m => {
                      const isMe = m.senderId === activeLawyer.id;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
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
                      placeholder="?˜ë¢°?¸ê³¼??1:1 ë³´ì • ?€?”ë? ?…ë ¥?˜ì‹­?œì˜¤..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChat();
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800 placeholder-slate-400"
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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500 bg-slate-50">
                  <MessageSquare className="w-12 h-12 text-slate-800" />
                  <p className="text-xs">?¼ìª½ ë©”ì‹œì§€?¨ì—??ì§„í–‰ ê°€?¥í•œ ?˜ë¢°???€???¤ë ˆ?œë? ?´ë¦­?˜ì‹­?œì˜¤.</p>
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
                      &larr; ?€?”ë°©?¼ë¡œ ?Œì•„ê°€ê¸?
                    </button>
                  </div>

                  {/* Option: Client financial summary info */}
                  <div className="space-y-3 pb-4 pt-4 lg:pt-0">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">?“ˆ 1ì°?ê°€ê³?ì§„ë‹¨ ë¶„ì„??/span>
                    
                    <div className="bg-[#111827] p-3 rounded-xl border border-slate-200 space-y-2 text-[11px] text-slate-600">
                      <div className="flex justify-between"><span>?˜ë¢°?¸ëª…:</span> <span className="font-bold text-white">{currentChatRequest.clientName}</span></div>
                      <div className="flex justify-between"><span>ë¹„ìƒ ?°ë½ì²?</span> <span className="font-mono text-white">{getDisplayPhoneNumber(currentChatRequest)}</span></div>
                      <div className="flex justify-between"><span>???Œë“ê³„ì‚°:</span> <span className="font-bold text-brand-light">{currentChatRequest.financialProfile.income}ë§???/span></div>
                      <div className="flex justify-between table-auto"><span>ì´?ì±„ë¬´ì§„ë‹¨:</span> <span className="font-bold text-red-400">{currentChatRequest.financialProfile.debtTotal.toLocaleString()}ë§???/span></div>
                      <div className="flex justify-between"><span>?ì‚°?˜ì??©ì‚°:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.assetsTotal.toLocaleString()}ë§???/span></div>
                      <div className="flex justify-between"><span>ë¶€??ê°€ì¡±ìˆ˜:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.dependents}ëª?/span></div>
                      <div className="flex justify-between"><span>ê²°í˜¼ ?ê²©êµ¬ì¡°:</span> <span className="text-slate-700">{currentChatRequest.financialProfile.maritalStatus === 'SINGLE' ? 'ë¯¸í˜¼' : currentChatRequest.financialProfile.maritalStatus === 'MARRIED' ? 'ê¸°í˜¼' : '?´í˜¼'}</span></div>
                      
                      {currentChatRequest.financialProfile.jobType && (
                        <>
                          <div className="border-t border-slate-200 my-1.5 pt-1.5 flex justify-between">
                            <span>ì§ì—… ? í˜•:</span> 
                            <span className="text-white font-bold">
                              {currentChatRequest.financialProfile.jobType === 'SALARIED' ? 'ê¸‰ì—¬?Œë“' : currentChatRequest.financialProfile.jobType === 'BUSINESS' ? '?ì—…?Œë“' : currentChatRequest.financialProfile.jobType === 'DAILY' ? '?¼ìš©ì§? : '?„ë¦¬?œì„œ'}
                              {currentChatRequest.financialProfile.companyName && ` (${currentChatRequest.financialProfile.companyName})`}
                            </span>
                          </div>
                          <div className="flex justify-between"><span>ê±°ì£¼ ì§€??</span> <span className="text-white">{currentChatRequest.financialProfile.residenceRegion}</span></div>
                          <div className="flex justify-between"><span>?„ì°¨ ë³´ì¦ê¸?</span> <span className="text-white">{currentChatRequest.financialProfile.rentalDeposit?.toLocaleString()}ë§???/span></div>
                          {currentChatRequest.financialProfile.maritalStatus === 'MARRIED' && (
                            <div className="flex justify-between"><span>ë°°ìš°???¬ì‚°:</span> <span className="text-white">{currentChatRequest.financialProfile.spouseAsset?.toLocaleString()}ë§???/span></div>
                          )}
                          <div className="flex justify-between"><span>ì£¼ëœ ì±„ë¬´?ì¸:</span> <span className="text-white">{currentChatRequest.financialProfile.debtCause === 'LIVING' ? '?í™œë¹? : currentChatRequest.financialProfile.debtCause === 'BUSINESS' ? '?¬ì—… ?¤íŒ¨' : currentChatRequest.financialProfile.debtCause === 'INVESTMENT' ? `?¬ì ?¤íŒ¨${currentChatRequest.financialProfile.speculativeLoss ? ` (${currentChatRequest.financialProfile.speculativeLoss.toLocaleString()}ë§Œì›)` : ''}` : currentChatRequest.financialProfile.debtCause === 'GAMBLING' ? `?„ë°•/?¬í–‰??{currentChatRequest.financialProfile.gamblingLoss ? ` (${currentChatRequest.financialProfile.gamblingLoss.toLocaleString()}ë§Œì›)` : ''}` : currentChatRequest.financialProfile.debtCause === 'GUARANTEE' ? 'ë³´ì¦' : 'ê¸°í?'}</span></div>
                          {currentChatRequest.financialProfile.speculativeLoss !== undefined && currentChatRequest.financialProfile.speculativeLoss > 0 && (
                            <div className="flex justify-between text-rose-400 font-semibold">
                              <span>1?„ë‚´ ì£¼ì‹/ì½”ì¸ ?ì‹¤:</span>
                              <span>{currentChatRequest.financialProfile.speculativeLoss.toLocaleString()}ë§???/span>
                            </div>
                          )}
                          {currentChatRequest.financialProfile.gamblingLoss !== undefined && currentChatRequest.financialProfile.gamblingLoss > 0 && (
                            <div className="flex justify-between text-rose-400 font-semibold">
                              <span>1?„ë‚´ ?„ë°• ì±„ë¬´ê¸?</span>
                              <span>{currentChatRequest.financialProfile.gamblingLoss.toLocaleString()}ë§???/span>
                            </div>
                          )}
                          <div className="flex justify-between text-amber-400"><span>ì¶”ì‹¬ ?¨ê³„:</span> <span>{currentChatRequest.financialProfile.harassmentLevel === 'CALL' ? 'ì¶”ì‹¬?„í™”' : currentChatRequest.financialProfile.harassmentLevel === 'LETTER' ? '?…ì´‰?? : currentChatRequest.financialProfile.harassmentLevel === 'LAWSUIT' ? '?Œì†¡?œê¸°' : '?•ë¥˜/ê°€?•ë¥˜'}</span></div>
                          {currentChatRequest.financialProfile.legalActions && currentChatRequest.financialProfile.legalActions.length > 0 && currentChatRequest.financialProfile.legalActions.some(x => x !== 'none') && (
                            <div className="flex justify-between text-amber-500">
                              <span>ë²•ì  ì¡°ì¹˜ ì§„í–‰:</span>
                              <span className="text-white">
                                {currentChatRequest.financialProfile.legalActions
                                  .filter(x => x !== 'none')
                                  .map(x => ({
                                    collection_call: '?…ì´‰',
                                    court_order: '?Œì¥?˜ë ¹',
                                    seizure: 'ê¸‰ì—¬?•ë¥˜',
                                    property_seizure: 'ë¶€?™ì‚°?•ë¥˜',
                                    credit_drop: '? ìš©?˜ë½'
                                  }[x] || x))
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between"><span>ì±„ê¶Œ??ê¸°ê???</span> <span className="text-white">{currentChatRequest.financialProfile.creditorCount}ê³?/span></div>
                          {currentChatRequest.financialProfile.retirementPay !== undefined && currentChatRequest.financialProfile.retirementPay > 0 && (
                            <>
                              <div className="border-t border-slate-200 my-1.5 pt-1.5 flex justify-between text-[11px]">
                                <span>?ˆìƒ ?´ì§ê¸?</span>
                                <span className="text-white font-bold">{currentChatRequest.financialProfile.retirementPay.toLocaleString()}ë§???/span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span>?´ì§?°ê¸ˆ ?•íƒœ:</span>
                                <span className={currentChatRequest.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                                  {currentChatRequest.financialProfile.retirementPensionType === 'pension' ? '?´ì§?°ê¸ˆ ê°€??(0% ë°˜ì˜)' :
                                   currentChatRequest.financialProfile.retirementPensionType === 'none' ? '?´ì§?°ê¸ˆ ë¯¸ê???(50% ë°˜ì˜)' : 'ì¢…ë¥˜ ëª¨ë¦„ (50% ë°˜ì˜)'}
                                </span>
                              </div>
                              {currentChatRequest.financialProfile.retirementPensionType === 'unknown' && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[10px] text-amber-400 font-bold mt-1 text-center animate-pulse">
                                  ? ï¸ [?•ì¸ ?„ìš”] ?ˆìƒ ?´ì§ê¸?ì¡°íšŒ ë°?ê°€???•íƒœ ?•ì¸ ?”ë§
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {currentChatRequestResult && (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2 text-[11px] text-slate-600 mt-2">
                        <span className="text-[10px] font-black text-emerald-400 tracking-wide uppercase block">?’° ?¤ì‹œê°?ë³€???œë??ˆì´??/span>
                        <div className="flex justify-between"><span>?ˆìƒ ??ë³€?œê¸ˆ:</span> <span className="font-bold text-white">{(currentChatRequestResult.monthlyPayment / 10000).toLocaleString()}ë§???/ ??/span></div>
                        <div className="flex justify-between"><span>ë³€??ê¸°ê°„:</span> <span className="text-white">{currentChatRequestResult.repaymentMonths}ê°œì›”</span></div>
                        <div className="flex justify-between"><span>ì´?ë³€?œê¸ˆ:</span> <span className="text-slate-700">{(currentChatRequestResult.totalRepayment / 10000).toLocaleString()}ë§???/span></div>
                        <div className="flex justify-between text-emerald-400 font-semibold">
                          <span>ìµœì¢… ?•ê°??</span>
                          <span>{(currentChatRequestResult.totalDebtReduction / 10000).toLocaleString()}ë§???({currentChatRequestResult.debtReductionRate}%)</span>
                        </div>
                        <div className="flex justify-between"><span>ì²?‚°ê°€ì¹?(?¬ì‚°):</span> <span className="text-slate-600">{(currentChatRequestResult.liquidationValue / 10000).toLocaleString()}ë§???/span></div>
                        
                        <div className="space-y-1 pt-1.5 border-t border-slate-200">
                          <div className="flex justify-between text-[9px] text-slate-400">
                            <span>ì²?‚°ê°€ì¹?ë³´ì¥??/span>
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
                        <span className="text-[10px] font-bold text-red-400 block">?œìŠ¤???ë™ ì¶”ì¶œ ë¦¬ìŠ¤???œê·¸:</span>
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

                  {/* Converting Case: "?ë‹´ -> ?¬ê±´ ?±ë¡" */}
                  <div className="pt-4 pb-4 space-y-3">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">?–ï¸ ?ë‹´ ?¬ê±´ ê³µì‹ ?˜ì„ ?„í™˜</span>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      ?ë‹´???±ì‚¬?˜ì–´ ?„ì„ ê³„ì•½???œëª…??ë§ˆì³ì§€ë©? ë³?ê°€?…ì???•ë³´ë¥??•ì‹ ?¬ê±´ ?€?¥ìœ¼ë¡??êµ¬ ?±ë¡??ë³´ì •ëª…ë ¹ ì¶”ì ???œì‘?????ˆìŠµ?ˆë‹¤.
                    </p>

                    <button 
                      onClick={() => handleConvertToCase(currentChatRequest)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-[200px] text-xs leading-none tracking-wide transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>?•ì‹ ?˜ì„?¬ê±´?¼ë¡œ ? ê·œ ?„í™˜</span>
                    </button>
                  </div>

                  {/* Internal Law-firm Notes (visible only on Lawyer side) */}
                  <div className="pt-4 space-y-3">
                    <span className="text-xs font-black text-brand tracking-wide uppercase block">?“Œ ë¡œíŒ ?´ë? ?‘ì—… ë°?ë¹„ë§ë¡?/span>
                    <p className="text-slate-500 text-[10px]">?¬ë¬´??ë°?ë³´ì¡° ?¤íƒœ?„ì? ?´ë‹¹ ?˜ë¢°?¸ì˜ ë³´ì • ?Œëª… ë³´ì¡° ê¸°ë¡??ë©”ëª¨?˜ëŠ” ë³´ì•ˆ ?ì—­?…ë‹ˆ??</p>

                    <textarea
                      rows={4}
                      placeholder="?´ë? ê¸´ê¸‰ ê°€?´ë“œ ë°?ì°¸ê³  ë©”ëª¨ë¥??‘ì„±??ì£¼ì„¸??.."
                      value={internalNotes[currentChatRequest.id] || ''}
                      onChange={(e) => {
                        const nextNotes = { ...internalNotes, [currentChatRequest.id]: e.target.value };
                        setInternalNotes(nextNotes);
                      }}
                      className="w-full bg-[#111827] border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-700 placeholder-slate-650"
                    />

                    <span className="text-[10px] text-slate-500 block leading-tight">
                      * ??ë¹„ë§ë¡ì? ë¡œíŒ êµ¬ì„±???í˜¸ ê°„ì—ë§?ê³µìœ ?˜ë©° ?˜ë¢°???„ìš© ì±„ë„?ëŠ” ?ˆë? ?„ì†¡?˜ì? ?ŠìŠµ?ˆë‹¤.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center text-slate-600 text-[11px] self-center">
                  ?˜ë¢°???ë‹´ë°©ì´ ?œì„±?”ë˜ë©??¤ì‹œê°?ê°€ê³?ì±„ë¬´ ë¶„ì„ CRM ëª¨ë“ˆ???ë™ ë¡œë“œ?©ë‹ˆ??
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
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FolderHeart className="w-5 h-5 text-brand" />
                  <span>ë¡œíŒ ?¬ê±´ ?„ì„ ?€???µí•© CRM (?Œìƒ ë°?ê°œì¸?Œìƒ ?¨ë?)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">?œë¥˜ ì¤€ë¹„ë????Œì‚° ë©´ì±… ?¹ì¸ ë°?ë³€??ê°œì‹œ ê³ ì‹œê¹Œì? ?¼ê´„?ìœ¼ë¡?RLS ê¶Œí•œ???˜ê±°??ì¶”ì ?©ë‹ˆ??</p>
              </div>

              <div className="flex gap-2">
                <span className="bg-[#111827] border border-slate-200 text-[11px] text-slate-600 px-3 py-1.5 rounded-xl font-semibold">
                  ì´?ê°ë©´ ?•ê° ?¬ì„±?? <strong className="text-emerald-400">11??4200ë§???/strong>
                </span>
              </div>
            </div>

            {/* Mobile Stage Selector Tab bar */}
            <div className="md:hidden flex overflow-x-auto gap-2 py-2 border-b border-slate-200 scrollbar-hide">
              {(['document', 'filing', 'commencement', 'approval', 'discharge'] as const).map(st => {
                const label = st === 'document' ? '?œë¥˜ì¤€ë¹? : st === 'filing' ? 'ë²•ì›?‘ìˆ˜' : st === 'commencement' ? 'ê°œì‹œê²°ì •' : st === 'approval' ? 'ìµœì¢…?¸ê?' : '?Œì‚°ë©´ì±…';
                const isActive = mobileStageFilter === st;
                const count = cases.filter(c => c.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setMobileStageFilter(st)}
                    className={`px-3.5 py-2 rounded-[200px] text-xs font-extrabold whitespace-nowrap transition-all border ${
                      isActive 
                      ? 'bg-brand/10 text-brand border-brand/50 shadow-sm' 
                      : 'bg-[#111827] text-slate-400 border-slate-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Row structure representing standard case progress:
                ?œë¥˜ -> ?‘ìˆ˜ -> ê°œì‹œ -> ?¸ê? -> ë©´ì±… */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              
              {/* STAGES */}
              {(['document', 'filing', 'commencement', 'approval', 'discharge'] as const).map(stage => {
                const isCurrentMobileStage = stage === mobileStageFilter;
                const stageName = stage === 'document' ? '1. ?œë¥˜ì¤€ë¹? : stage === 'filing' ? '2. ë²•ì›?‘ìˆ˜' : stage === 'commencement' ? '3. ê°œì‹œê²°ì •' : stage === 'approval' ? '4. ìµœì¢…?¸ê?' : '5. ?Œì‚°ë©´ì±…';
                const stageColor = stage === 'document' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : stage === 'filing' ? 'bg-brand/10 text-brand-light border-brand/20' : stage === 'commencement' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : stage === 'approval' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20';
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
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-600">{c.clientName} ?˜ë¢°??/span>
                              <span className="text-slate-500 text-[9px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>

                            <div className="text-[11px] font-bold text-slate-700">
                              ?„ì„ì±„ë¬´?? <span className="text-brand-light font-extrabold">{c.debtTotal.toLocaleString()}ë§???/span>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-normal line-clamp-1">
                              {c.notes.length > 0 ? `??${c.notes[0]}` : 'ê¸°ì¬ ë©”ëª¨ ?†ìŒ'}
                            </p>
                          </div>
                        );
                      })}

                      {stageCases.length === 0 && (
                        <div className="text-center py-8 text-[10px] text-slate-600">
                          ???¨ê³„???˜ë¢°?¸ì´ ?†ìŠµ?ˆë‹¤.
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
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">CASE FILE SYSTEM</span>
                        <h3 className="font-extrabold text-base text-slate-800">{activeCase.clientName} ?˜ë¢°???Œì¼?•ë³´</h3>
                      </div>

                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                        ?´ë‹¹: {activeCase.assignedLawyerName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-850 text-[11px] text-slate-400">
                      <div>??ê³ ê° ?°ë½ì²? <strong className="text-slate-700 font-mono">{activeCase.phone}</strong></div>
                      <div>???¸í›„ ?”ê??©ì†Œ?? <strong className="text-slate-700">{activeCase.income}ë§???/strong></div>
                      <div>???°ì²´ ?¹ì¸ë¶€ì±„ì•¡: <strong className="text-brand-light font-bold">{activeCase.debtTotal.toLocaleString()}ë§???/strong></div>
                      <div>??ìµœì´ˆ ? ì„ ?±ë¡?? <strong className="text-slate-700">{new Date(activeCase.createdAt).toLocaleDateString()}</strong></div>
                    </div>

                    {/* Change Status dropdown */}
                    <div className="p-3 bg-slate-100/30 rounded-lg border border-slate-850 space-y-2">
                      <label className="block font-bold text-[11px] text-slate-600">ë²•ì› ì¶”ì§„ ?¨ê³„ ?¼ê´„ ë³€ê²?</label>
                      <div className="flex gap-2">
                        <select 
                          value={activeCase.status}
                          onChange={(e) => handleUpdateCaseStatus(activeCase.id, e.target.value as CaseStatus)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded p-1.5 font-bold text-amber-400 text-xs focus:ring-1"
                        >
                          <option value="document">1. ?œë¥˜ ê¸°íš ?íƒœ</option>
                          <option value="filing">2. ë³?ë²•ì› ?‘ìˆ˜ ?„ë£Œ</option>
                          <option value="commencement">3. ë²•ì› ì§€??ê°€??ê°œì‹œ ê²°ì • ê³ ì‹œ</option>
                          <option value="approval">4. ìµœì¢… ?¸ê? ê²°ì • ?„ë‹¬</option>
                          <option value="discharge">5. ?„ì•¡ ë©´ì±… ?±ì‹¤ ë¶ˆì… ?„ì„±</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Log and notes tracking */}
                  <div className="space-y-4 text-xs flex flex-col justify-between">
                    <div className="space-y-3">
                      <span className="font-black text-brand-light uppercase tracking-widest block text-[11px]">?“ ë³´ì • ë°?ì¶”ì§„ ëª…ì„¸ ?±ê³¼ ë¡œê·¸</span>
                      
                      {/* Interactive form to add a note */}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="?ˆë¡œ??ë³´ì •?´ë‚˜ ë²•ì› ê²°ì • ê³ ì‹œ ?¬í•­ ë©”ëª¨ ê¸°ì…..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCaseNote(activeCase.id);
                          }}
                          className="flex-1 bg-slate-100 border border-slate-200 rounded px-2.5 py-2 text-xs text-slate-800"
                        />
                        <button 
                          onClick={() => handleAddCaseNote(activeCase.id)}
                          className="bg-brand hover:bg-brand-hover text-white font-extrabold px-4 py-1.5 rounded-[200px] text-xs transition-colors shrink-0"
                        >
                          ?±ë¡
                        </button>
                      </div>

                      {/* Display of notes */}
                      <div className="bg-slate-50 border border-slate-850 rounded p-3 text-[11px] text-slate-600 space-y-1.5 max-h-40 overflow-y-auto">
                        {activeCase.notes.map((note, idx) => (
                          <div key={idx} className="flex gap-1.5 items-start">
                            <span className="text-brand-light font-bold select-none shrink-0">??/span>
                            <span className="leading-relaxed">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-900">
                      <button 
                        onClick={() => setSelectedCaseId('')}
                        className="bg-slate-100 hover:bg-slate-100 text-slate-400 font-medium px-4 py-1.5 rounded-[200px] border border-slate-200"
                      >
                        ?«ê¸°
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
                <h2 className="text-xl font-black text-white">?™ì› ë²•ë¬´ë¶„ì†Œ: <span className="text-indigo-400">Team SaaS Pro ?”ê¸ˆ???¬ìš© ì¤?/span></h2>
                <p className="text-xs text-slate-400">?¤ìŒ ê²°ì œ ?ˆì •?? 2026??06??25??(??800,000 ???ë™ ?¹ì¸)</p>
              </div>

              <div className="bg-slate-100 text-slate-600 p-4 rounded-lg border border-slate-200 text-xs flex gap-6">
                <div>
                  <span className="text-[10px] text-slate-500 block">?´ë‹¬ ?Œì§„ ë§¤ì¹­ì°¸ì—¬??/span>
                  <strong className="text-base text-brand-light">14 / 20ê±?/strong>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <span className="text-[10px] text-slate-500 block">?„ì  ê°€??ì¶©ì „ ì¶©ì „ê¸?/span>
                  <strong className="text-base text-brand-light">35,000 ??/strong>
                </div>
              </div>
            </div>

            {/* List of plans to showcase pricing mock structures */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {platformPlans.map((plan, idx) => (
                <div key={idx} className={`bg-slate-50 rounded-xl p-6 border flex flex-col justify-between gap-6 relative ${plan.color}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-4 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-light shadow">
                      ê°€??ë§ì? ë¡œíŒ ? íƒ
                    </span>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{plan.name}</h3>
                      <p className="text-slate-500 text-xs">?˜ì„ë£?ê³¼ì„¸ ì¤‘ê³„ ë¶ˆê? ?ì¹™ ì¤€??/p>
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
                    : 'bg-slate-100 hover:bg-slate-850 text-slate-600 border border-slate-200'
                  }`}>
                    {plan.name === 'Pro' ? '?„ì¬ ?”ê¸ˆ???´ìš© ì¤? : '?”ê¸ˆ???…ê·¸?ˆì´??ë¬¸ì˜'}
                  </button>
                </div>
              ))}
            </div>

            {/* Banned details for security */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs h-auto space-y-2 text-slate-400 leading-normal">
              <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">?’¡ ?Œìƒ/?Œì‚° ?˜ì„ ?°ê³„ ë¹Œë§ ë²•ì  ?ˆì „?¥ì¹˜</span>
              <p>
                ë³?Legal CRM?€ ë³€?¸ì‚¬ë²??„ë°˜???¼í•˜ê¸??„í•´ **ê°œì¸?Œìƒ ?˜ì„ ?±ê³µ(ê³„ì•½ ?±ì‚¬)???°ë¥¸ ë°°ë¶„ ?˜ìˆ˜ë£Œë? ?ˆë? ì§•ìˆ˜?˜ì? ?ŠìŠµ?ˆë‹¤**.
                ??ê³ ì • ?”ê¸ˆ?œë¡œ ì±…ì •?˜ëŠ” SaaS êµ¬ë…ë£?ë°?ë§¤ì¹­ ì°¸ì—¬ ??ì°¨ê°?˜ëŠ” ?´ë¦­ ê´‘ê³  ì°¨ê° ?˜ìˆ˜ë£?ì°¸ì—¬ 1ê±´ë‹¹ ë¬´ê? ?Œì§„) ë°©ì‹ë§Œìœ¼ë¡??´ì˜?˜ì–´ ?¬í›„ ë³´ì¦ ë°?ë¡œíŒ ?´ì˜ ?ˆì „?±ì´ 100% ë³´ì¥?©ë‹ˆ??
              </p>
            </div>
          </div>
        )}

        {/* TAB 6: CLIENT CRM (ê³ ê° ê´€ë¦? */}
        {activeTab === 'client-crm' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top overview card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand" />
                  <span>?ë‹´ ? ì²­ ê³ ê° ?µí•© ê´€ë¦?CRM</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">?ë‹´???‘ìˆ˜???„ì²´ ?˜ë¢°?¸ì˜ ì§„ë‹¨ ê²°ê³¼, ?´ë‹¹??ì§€??ë°?ì§„í–‰ ?¨ê³„ë¥??ì„¸ ê´€ë¦¬í•©?ˆë‹¤.</p>
              </div>
            </div>

            {/* Search & Filter row */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <input 
                  type="text" 
                  placeholder="ê³ ê°ëª??ëŠ” ?°ë½ì²?ê²€??.." 
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800 placeholder-slate-400"
                />
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">?”</span>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <select 
                  value={crmStatusFilter} 
                  onChange={(e) => setCrmStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600"
                >
                  <option value="all">?íƒœ: ?„ì²´ë³´ê¸°</option>
                  <option value="requested">?”ì²­ ?€ê¸?(requested)</option>
                  <option value="responding">ì§€???€ê¸?(responding)</option>
                  <option value="counseling">?ë‹´ ì§„í–‰ (counseling)</option>
                  <option value="closed">?˜ì„ ?„ë£Œ/ì¢…ê²° (closed)</option>
                </select>

                <select 
                  value={crmLawyerFilter} 
                  onChange={(e) => setCrmLawyerFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600"
                >
                  <option value="all">?´ë‹¹?? ?„ì²´ë³´ê¸°</option>
                  <option value="unassigned">?´ë‹¹ ë³€?¸ì‚¬ ë¯¸ë°°??/option>
                  {lawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split layout: List on left, details on right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left column: Clients table list */}
              <div className="lg:col-span-7 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/80 text-slate-400 font-bold border-b border-slate-200">
                        <th className="p-3">ê³ ê°ëª?/th>
                        <th className="p-3">?°ë½ì²?/th>
                        <th className="p-3">? ì²­? í˜•</th>
                        <th className="p-3">?íƒœ</th>
                        <th className="p-3 text-right">ì´?ì±„ë¬´??/th>
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
                          requested: '?”ì²­ ?€ê¸?,
                          responding: 'ì§€???€ê¸?,
                          counseling: '?ë‹´ ì§„í–‰',
                          closed: '?˜ì„/ì¢…ê²°'
                        };
                        return (
                          <tr 
                            key={r.id}
                            onClick={() => setCrmSelectedId(r.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-brand/5 hover:bg-brand/10' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-3 font-bold text-white">{r.clientName}</td>
                            <td className="p-3 font-mono text-slate-600">{getDisplayPhoneNumber(r)}</td>
                            <td className="p-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                                {r.requestType === 'direct' ? '?¨ë…ì§€ëª? : '?¤í”ˆ??}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${statusColors[r.status]}`}>
                                {statusLabels[r.status]}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-brand-light">
                              {r.financialProfile.debtTotal.toLocaleString()}ë§Œì›
                            </td>
                          </tr>
                        );
                      })}

                      {filteredRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            ê²€??ì¡°ê±´??ë¶€?©í•˜???ë‹´ ê³ ê°???†ìŠµ?ˆë‹¤.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right column: Selected Client CRM Details Panel */}
              <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-5">
                {crmSelectedClient ? (
                  <>
                    <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                      <div>
                        <span className="text-[9px] text-brand font-bold block uppercase tracking-wider">CLIENT DETAIL SHEET</span>
                        <h3 className="text-base font-extrabold text-white">{crmSelectedClient.clientName} ?˜ë¢°??/h3>
                      </div>
                      <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-400 px-2 py-1 rounded">
                        ID: {crmSelectedClient.id}
                      </span>
                    </div>

                    {/* Edit general info */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 block">?‘¤ ?¸ì  ?•ë³´ ?˜ì •</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">?˜ë¢°???´ë¦„</label>
                          <input 
                            type="text" 
                            value={crmEditName} 
                            onChange={(e) => setCrmEditName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">ë¹„ìƒ ?°ë½ì²?/label>
                          <input 
                            type="text" 
                            value={crmEditPhone} 
                            onChange={(e) => setCrmEditPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleUpdateClientInfo}
                        className="w-full bg-slate-100 hover:bg-slate-850 text-brand-light border border-slate-200 py-1.5 rounded-[200px] text-xs font-semibold"
                      >
                        ê¸°ë³¸ ?•ë³´ ?…ë°?´íŠ¸
                      </button>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 block">?“Š ê°€ê³?ì±„ë¬´ ë°??Œë“ ì§„ë‹¨ ëª…ì„¸</span>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-850 text-[11px] text-slate-355">
                        <div>???‰ê·  ?Œë“: <strong className="text-white">{crmSelectedClient.financialProfile.income}ë§Œì›</strong></div>
                        <div>ì´?ì±„ë¬´ ê·œëª¨: <strong className="text-red-400 font-extrabold">{crmSelectedClient.financialProfile.debtTotal.toLocaleString()}ë§Œì›</strong></div>
                        <div>?ì‚°?˜ì??©ì‚°: <strong className="text-white">{crmSelectedClient.financialProfile.assetsTotal.toLocaleString()}ë§Œì›</strong></div>
                        <div>ë¶€??ê°€ì¡±ìˆ˜: <strong className="text-white">{crmSelectedClient.financialProfile.dependents}ëª?/strong></div>
                        {crmSelectedClient.financialProfile.jobType && (
                          <>
                            <div className="col-span-2 border-t border-slate-200 my-1 pt-1.5 flex justify-between">
                              <span>ì§ì—… (ì§ì¥ëª?:</span> 
                              <strong className="text-slate-700">
                                {crmSelectedClient.financialProfile.jobType === 'SALARIED' ? 'ê¸‰ì—¬?Œë“' : crmSelectedClient.financialProfile.jobType === 'BUSINESS' ? '?ì—…?Œë“' : crmSelectedClient.financialProfile.jobType === 'DAILY' ? '?¼ìš©ì§? : '?„ë¦¬?œì„œ'}
                                {crmSelectedClient.financialProfile.companyName && ` (${crmSelectedClient.financialProfile.companyName})`}
                              </strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>?…ì‚¬/ê°œì—…??</span>
                              <strong className="text-slate-700">{crmSelectedClient.financialProfile.employmentDate || 'ë¯¸ê¸°??}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>ê±°ì£¼ì§€ (ê´€? ë²•??:</span>
                              <strong className="text-slate-700">{crmSelectedClient.financialProfile.residenceRegion}</strong>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <span>?„ì°¨ ë³´ì¦ê¸?</span>
                              <strong className="text-slate-700">{crmSelectedClient.financialProfile.rentalDeposit?.toLocaleString()}ë§Œì›</strong>
                            </div>
                            {crmSelectedClient.financialProfile.maritalStatus === 'MARRIED' && (
                              <div className="col-span-2 flex justify-between">
                                <span>ë°°ìš°???ì‚°/?Œë“:</span>
                                <strong className="text-slate-700">{crmSelectedClient.financialProfile.spouseAsset?.toLocaleString()}ë§?/ {crmSelectedClient.financialProfile.spouseIncome}ë§Œì›</strong>
                              </div>
                            )}
                            <div className="col-span-2 flex justify-between">
                              <span>ì±„ë¬´ ?ì¸:</span>
                              <strong className="text-slate-700">{crmSelectedClient.financialProfile.debtCause === 'LIVING' ? '?í™œë¹? : crmSelectedClient.financialProfile.debtCause === 'BUSINESS' ? '?¬ì—… ?¤íŒ¨' : crmSelectedClient.financialProfile.debtCause === 'INVESTMENT' ? `?¬ì ?¤íŒ¨${crmSelectedClient.financialProfile.speculativeLoss ? ` (${crmSelectedClient.financialProfile.speculativeLoss.toLocaleString()}ë§Œì›)` : ''}` : crmSelectedClient.financialProfile.debtCause === 'GAMBLING' ? `?„ë°•/?¬í–‰??{crmSelectedClient.financialProfile.gamblingLoss ? ` (${crmSelectedClient.financialProfile.gamblingLoss.toLocaleString()}ë§Œì›)` : ''}` : crmSelectedClient.financialProfile.debtCause === 'GUARANTEE' ? 'ë³´ì¦' : 'ê¸°í?'}</strong>
                            </div>
                            {crmSelectedClient.financialProfile.speculativeLoss !== undefined && crmSelectedClient.financialProfile.speculativeLoss > 0 && (
                              <div className="col-span-2 flex justify-between text-rose-400">
                                <span>1?„ë‚´ ì£¼ì‹/ì½”ì¸ ?ì‹¤:</span>
                                <strong>{crmSelectedClient.financialProfile.speculativeLoss.toLocaleString()}ë§Œì›</strong>
                              </div>
                            )}
                            {crmSelectedClient.financialProfile.gamblingLoss !== undefined && crmSelectedClient.financialProfile.gamblingLoss > 0 && (
                              <div className="col-span-2 flex justify-between text-rose-400">
                                <span>1?„ë‚´ ?„ë°• ì±„ë¬´ê¸?</span>
                                <strong>{crmSelectedClient.financialProfile.gamblingLoss.toLocaleString()}ë§Œì›</strong>
                              </div>
                            )}
                            <div className="col-span-2 flex justify-between text-amber-400">
                              <span>ì¶”ì‹¬ ?¨ê³„:</span>
                              <strong>{crmSelectedClient.financialProfile.harassmentLevel === 'CALL' ? 'ì¶”ì‹¬?„í™”' : crmSelectedClient.financialProfile.harassmentLevel === 'LETTER' ? '?…ì´‰ ìµœê³ ?? : crmSelectedClient.financialProfile.harassmentLevel === 'LAWSUIT' ? '?Œì†¡?œê¸°' : 'ê°€?•ë¥˜/ì§€ê¸‰ëª…??}</strong>
                            </div>
                            {crmSelectedClient.financialProfile.legalActions && crmSelectedClient.financialProfile.legalActions.length > 0 && crmSelectedClient.financialProfile.legalActions.some(x => x !== 'none') && (
                              <div className="col-span-2 flex justify-between text-amber-500">
                                <span>ë²•ì  ì¡°ì¹˜ ì§„í–‰:</span>
                                <strong className="text-slate-700">
                                  {crmSelectedClient.financialProfile.legalActions
                                    .filter(x => x !== 'none')
                                    .map(x => ({
                                      collection_call: '?…ì´‰',
                                      court_order: '?Œì¥?˜ë ¹',
                                      seizure: 'ê¸‰ì—¬?•ë¥˜',
                                      property_seizure: 'ë¶€?™ì‚°?•ë¥˜',
                                      credit_drop: '? ìš©?˜ë½'
                                    }[x] || x))
                                    .join(', ')}
                                </strong>
                              </div>
                            )}
                            <div className="col-span-2 flex justify-between">
                              <span>ì±„ê¶Œ????</span>
                              <strong className="text-slate-700">{crmSelectedClient.financialProfile.creditorCount}ê³?/strong>
                            </div>
                            {crmSelectedClient.financialProfile.retirementPay !== undefined && crmSelectedClient.financialProfile.retirementPay > 0 && (
                              <>
                                <div className="col-span-2 border-t border-slate-200 my-1 pt-1.5 flex justify-between">
                                  <span>?ˆìƒ ?´ì§ê¸?</span>
                                  <strong className="text-white">{crmSelectedClient.financialProfile.retirementPay.toLocaleString()}ë§Œì›</strong>
                                </div>
                                <div className="col-span-2 flex justify-between">
                                  <span>?´ì§?°ê¸ˆ ì¢…ë¥˜:</span>
                                  <strong className={crmSelectedClient.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-400' : 'text-slate-700'}>
                                    {crmSelectedClient.financialProfile.retirementPensionType === 'pension' ? '?´ì§?°ê¸ˆ ê°€??(0% ë°˜ì˜)' :
                                     crmSelectedClient.financialProfile.retirementPensionType === 'none' ? '?´ì§?°ê¸ˆ ë¯¸ê???(50% ë°˜ì˜)' : 'ëª¨ë¦„ (50% ë°˜ì˜)'}
                                  </strong>
                                </div>
                                {crmSelectedClient.financialProfile.retirementPensionType === 'unknown' && (
                                  <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[10px] text-amber-400 font-bold space-y-1 text-center animate-pulse">
                                    ? ï¸ [?•ì¸ ?„ìš”] ?ˆìƒ ?´ì§ê¸?ì¡°íšŒ ë°?ê°€???•íƒœ ?•ì¸ ?”ë§
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* CRM Assign & Status workflow */}
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-850">
                      <span className="text-[11px] font-bold text-brand-light block">?™ï¸ ?ë‹´ ?¸ì…˜ ?œì–´</span>
                      
                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">?´ë‹¹ ë³€?¸ì‚¬ ì§€??</span>
                          <select 
                            value={crmEditLawyerId}
                            onChange={(e) => setCrmEditLawyerId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-semibold text-slate-600 focus:outline-none"
                          >
                            <option value="">ë¯¸ë°°??(? íƒ??ì£¼ì„¸??</option>
                            {lawyers.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">?ë‹´ ?¸ì…˜ ?íƒœ:</span>
                          <select 
                            value={crmEditStatus}
                            onChange={(e) => setCrmEditStatus(e.target.value as ConsultStatus)}
                            className="bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-semibold text-slate-600 focus:outline-none"
                          >
                            <option value="requested">?”ì²­ ?€ê¸?(requested)</option>
                            <option value="responding">ì§€???€ê¸?(responding)</option>
                            <option value="counseling">?ë‹´ ì§„í–‰ (counseling)</option>
                            <option value="closed">?˜ì„/?ë‹´ ì¢…ê²° (closed)</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        onClick={handleSaveCrmSession}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-2 rounded-[200px] text-xs font-extrabold mt-2"
                      >
                        ?ë‹´ ?¸ì…˜ ë°°ì • ë°??íƒœ ?€??
                      </button>
                    </div>

                    {/* Converting to Cases tab (?˜ì„ ?„í™˜ CTA) */}
                    <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-xl space-y-2.5">
                      <span className="text-[11px] font-bold text-emerald-400 block">?–ï¸ ?•ì‹ ?¬ê±´ ?˜ì„ ?„í™˜</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        ?ë‹´???„ë£Œ?˜ì–´ ë³??˜ë¢°?¸ì„ ?•ì‹ ?˜ì„ ?¬ê±´ ?€??Kanban ë³´ë“œ)?¼ë¡œ ?„í™˜ ?±ë¡?˜ë ¤ë©??„ë˜ ë²„íŠ¼???´ë¦­?˜ì‹­?œì˜¤.
                      </p>
                      <button 
                        onClick={() => handleConvertToCase(crmSelectedClient)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-[200px] text-xs font-extrabold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>?•ì‹ ?˜ì„?¬ê±´?¼ë¡œ ?„í™˜ ?±ë¡</span>
                      </button>
                    </div>

                    {/* Consultation Notes log */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 block">?“Œ CRM ?ë‹´ ê¸°ë¡ ë¹„ë§ë¡?/span>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="?ë‹´ ë©”ëª¨ ì¶”ê?..."
                          value={crmNewNote}
                          onChange={(e) => setCrmNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCrmNote();
                          }}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                        />
                        <button 
                          onClick={handleAddCrmNote}
                          className="bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-[200px] text-xs font-semibold shrink-0"
                        >
                          ì¶”ê?
                        </button>
                      </div>

                      {/* Notes list */}
                      <div className="bg-slate-50 border border-slate-850 rounded p-3 text-[11px] text-slate-600 space-y-2 max-h-40 overflow-y-auto">
                        {crmSelectedNotes.length > 0 ? (
                          crmSelectedNotes.map((note, idx) => (
                            <div key={idx} className="flex gap-1.5 items-start justify-between">
                              <div className="flex gap-1.5 items-start">
                                <span className="text-brand-light font-bold select-none shrink-0">??/span>
                                <span className="leading-relaxed text-left">{note}</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteCrmNote(idx)}
                                className="text-slate-650 hover:text-red-400 text-[10px]"
                              >
                                ?? œ
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-650">
                            ê¸°ë¡???ë‹´ ë¹„ë§ë¡?ë©”ëª¨ê°€ ?†ìŠµ?ˆë‹¤.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-600 text-xs">
                    ê³ ê° ë¦¬ìŠ¤?¸ì—???ì„¸ ì¡°íšŒ???ë‹´ ? ì²­ ê³ ê°??? íƒ??ì£¼ì‹­?œì˜¤.
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
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-brand" />
                  <span>?¤ì‹œê°??Œë¦¼ ë°??¸ë? ?°ë™ ?¤ì • (Telegram Gateway)</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed text-left">
                  ? ê·œ ?ë‹´???‘ìˆ˜?˜ê±°??? ì°©???ë‹´???¤í”ˆ???? ?”ë ˆê·¸ë¨ ë©”ì‹ ?€ë¥??µí•´ ?¤ì‹œê°??Œë¦¼???˜ì‹ ?˜ê³  ê°„í¸ ?œì–´ ?¡ì…˜???˜í–‰?©ë‹ˆ??
                </p>
              </div>
              <span className="bg-brand/10 border border-brand/20 text-brand text-[10px] font-extrabold px-3 py-1 rounded-[200px] whitespace-nowrap self-start md:self-center">
                SaaS Enterprise ê°€??ì¤?
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Config Panel */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* ?¤– 1. Bot Integration */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">?¤– 1?¨ê³„: ?”ë ˆê·¸ë¨ ?Œë¦¼ë´?ë°”ì¸??/span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${tgConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 text-slate-400'}`}>
                      {tgConnected ? '?°ê²°??(ACTIVE)' : '?°ê²° ?´ì œ??}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs text-left">
                    <p className="text-slate-500 leading-normal text-[11px]">
                      ?„ë˜ ?”ë ˆê·¸ë¨ ë´?ë§í¬ë¥??µí•´ ?¤ì‹œ?œì‘ ?Œë¦¼ë°©ì— ë´‡ì„ ì¶”ê????? ë´‡ì´ ?Œë ¤ì£¼ëŠ” ê·¸ë£¹ë°?ê³ ìœ  Chat IDë¥?ë°”ì¸?©í•˜?¸ìš”.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a 
                        href="https://t.me/restart_alarm_bot" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-slate-100 hover:bg-slate-100 border border-slate-200 text-brand-light font-extrabold px-3 py-2 rounded-xl text-center flex items-center justify-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-brand" />
                        <span>Restart ?Œë¦¼ë´??´ê¸°</span>
                      </a>
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          placeholder="Chat ID ?…ë ¥ (?? 12948592948)"
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
                        <span>?“¢ ë³´ì•ˆ ?°ë™ ?ŒìŠ¤???Œë¦¼ ë°œì†¡</span>
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
                        {tgConnected ? '?°ê²° ?¼ì‹œ ?´ì œ' : '?Œë¦¼ ?œì„±??}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ?“… 2. Receiving Hours */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">?“… 2?¨ê³„: ?Œë¦¼ ?”ì¼ ë°?ê·¼ë¬´?œê°„ ?¤ì •</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={tgDutyMode} 
                        onChange={(e) => setTgDutyMode(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-100 border-slate-200 text-brand focus:ring-brand" 
                      />
                      <span className="text-[10px] font-bold text-amber-400">?š¨ ?¼ê°„ ?¹ì§ë°??°íšŒ ?œì„±??/span>
                    </label>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">?Œë¦¼ ?˜ì‹  ?”ì¼</label>
                      <div className="flex gap-1.5">
                        {['??, '??, '??, 'ëª?, 'ê¸?, '??, '??].map(d => (
                          <label key={d} className="flex-1 bg-slate-100 border border-slate-200 rounded-lg py-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-slate-200 select-none">
                            <input 
                              type="checkbox" 
                              defaultChecked={d !== '?? && d !== '??} 
                              className="w-3.5 h-3.5 rounded bg-slate-50 border-slate-200 text-brand"
                            />
                            <span className="text-[10px] font-bold text-slate-600">{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 block uppercase font-bold">ê·¼ë¬´ ?œì‘ ?œê°</label>
                        <input 
                          type="text" 
                          value={tgWorkHoursStart}
                          onChange={(e) => setTgWorkHoursStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 block uppercase font-bold">ê·¼ë¬´ ì¢…ë£Œ ?œê°</label>
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

                {/* ?±ï¸ 3. Escalation and Reminder */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-850 space-y-4 text-left">
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">?±ï¸ 3?¨ê³„: ë¯¸ì‘??ë¦¬ë§ˆ?¸ë“œ & ?ìŠ¤ì»¬ë ˆ?´ì…˜</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">?ë‹´ ë°°ì • ë¯¸ìˆ˜???¬ì•Œë¦?ì£¼ê¸°</label>
                      <select 
                        value={tgRemindDelay}
                        onChange={(e) => setTgRemindDelay(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 focus:outline-none"
                      >
                        <option value="5">5ë¶?ê°„ê²© ë¦¬ë§ˆ?¸ë“œ</option>
                        <option value="10">10ë¶?ê°„ê²© ë¦¬ë§ˆ?¸ë“œ</option>
                        <option value="20">20ë¶?ê°„ê²© ë¦¬ë§ˆ?¸ë“œ</option>
                        <option value="30">30ë¶?ê°„ê²© ë¦¬ë§ˆ?¸ë“œ</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">ìµœì¢… ë¯¸ì‘?????„ì²´ ?ìŠ¤ì»¬ë ˆ?´ì…˜</label>
                      <select 
                        value={tgEscalation}
                        onChange={(e) => setTgEscalation(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 focus:outline-none"
                      >
                        <option value="15">15ë¶?ë¯¸ìˆ˜?????„ì²´ ?€?œë°© ê³µì?</option>
                        <option value="30">30ë¶?ë¯¸ìˆ˜?????„ì²´ ?€?œë°© ê³µì?</option>
                        <option value="60">1?œê°„ ë¯¸ìˆ˜?????„ì²´ ?€?œë°© ê³µì?</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Simulated Live Telegram Widget */}
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block text-left uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-brand-light" />
                  ?“± ?”ë ˆê·¸ë¨ ?¤ì‹œê°??Œë¦¼ë°??œë??ˆì´??(Mock Telegram Client)
                </span>

                {/* Mock Telegram Window */}
                <div className="bg-[#182533] border border-slate-200 rounded-3xl shadow-xl w-full h-[540px] flex flex-col overflow-hidden animate-fadeIn relative">
                  
                  {/* Telegram Header */}
                  <div className="bg-[#22313F] px-4 py-3 flex items-center justify-between border-b border-[#141E28]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-extrabold text-sm select-none">
                        ??
                      </div>
                      <div className="text-left leading-tight">
                        <h4 className="font-extrabold text-xs text-white">?¤ì‹œ?œì‘ ë²•ë¥ ì§€ë¶€ ?Œë¦¼ë°?/h4>
                        <span className="text-[10px] text-[#86959E] font-medium">ë©¤ë²„ 5ëª? ë´?1ê°??±ë¡??/span>
                      </div>
                    </div>
                    <div className="text-[#86959E] hover:text-white transition-colors cursor-pointer select-none text-xs font-bold">
                      ?¢â€¢â€?
                    </div>
                  </div>

                  {/* Telegram Message Area */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col-reverse justify-start scrollbar-hide bg-[#182533]">
                    {/* Reverse map to show newest at bottom */}
                    {tgMessages.slice().reverse().map((m) => {
                      if (m.sender === 'system') {
                        return (
                          <div key={m.id} className="w-full flex justify-center py-1 select-none">
                            <span className="bg-[#111A24]/60 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-[100px] border border-[#1C2836]">
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
                              <span className="font-extrabold text-[11px] text-[#5288C1]">{m.name || '?¤ì‹œ?œì‘ ?Œë¦¼ë´?}</span>
                              <span className="bg-[#22313F] text-[#5288C1] text-[8px] px-1 py-0.2 rounded font-extrabold uppercase">BOT</span>
                            </div>

                            {/* Alert Card Box */}
                            {m.card && (
                              <div className="bg-[#22313F] border border-[#2B3E50] rounded-2xl p-4 space-y-3 shadow-md relative text-left">
                                <div className="flex items-center justify-between border-b border-[#2C3B4B] pb-2 leading-none">
                                  <span className="font-black text-xs text-white flex items-center gap-1">
                                    <Bell className="w-3.5 h-3.5 text-brand" />
                                    <span>{m.card.type === 'direct' ? '?”” ? ê·œ ì§ì ‘? íƒ ?ë‹´ ?”ì²­' : '?“¢ ì°¸ì—¬???ë‹´ ?¤í”ˆ ?”ì²­'}</span>
                                  </span>
                                  <span className="text-[#86959E] text-[9px]">{m.time}</span>
                                </div>

                                <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
                                  <div>??<strong className="text-slate-400">?˜ì‹  ? í˜•:</strong> {m.card.type === 'direct' ? '1:1 ?€ë¦¬ì¸ ?¤ì´?‰íŠ¸ ì§€?? : 'ìµœë? 3ëª?? ì°©???¤í”ˆ ë°°ì •'}</div>
                                  <div>??<strong className="text-slate-400">ê´€??ì§€??</strong> {m.card.region} ë²•ì› ê´€??/div>
                                  {/* [SECURITY] êµ¬ê°„ê°’ë§Œ ?œì‹œ ???ì‹œ ê¸ˆì•¡ ë°?PII ë¯¸í¬??*/}
                                  <div>??<strong className="text-slate-400">ì±„ë¬´ êµ¬ê°„:</strong> {m.card.debt}</div>
                                  <div>??<strong className="text-slate-400">?Œë“ êµ¬ê°„:</strong> {m.card.income}</div>
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
                                      <span>{m.card.assignedLawyer} ?˜ì„ ë°°ì • ?„ë£Œ</span>
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        type="button"
                                        onClick={() => handleTgAssign(m.id, m.card!.reqId)}
                                        className="w-full py-2 bg-brand hover:bg-brand-hover text-white text-[10px] font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1 select-none cursor-pointer"
                                      >
                                        <span>?™‹ ?´ê? ì¦‰ì‹œ ?´ë‹¹?ë¡œ ë°°ì • ?±ë¡</span>
                                      </button>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setActiveChatReqId(m.card!.reqId);
                                            setActiveTab('open-requests');
                                            alert('?Œë«?¼ì˜ ? ê·œ ?ë‹´ ??œ¼ë¡?ì¦‰ì‹œ ?ˆì „?˜ê²Œ ?¤ìœ„ì¹?•˜???˜ë¢°???ì„¸ ëª…ì„¸ë¥?ì¡°íšŒ?©ë‹ˆ??');
                                          }}
                                          className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-slate-600 text-[9px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                        >
                                          ?’» CRM ?ì„¸ë³´ê¸°
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => alert('30ë¶????´ë‹¹ ì±„ë¬´?ì˜ ?ë‹´ ?‘ë‹µ ë¯¸ê²° ?íƒœë¥??”ë ˆê·¸ë¨ ê·¸ë£¹ë°©ì— ?¤ì‹œ ë¦¬ë§ˆ?¸ë“œ ?¸ì¶œ?©ë‹ˆ??')}
                                          className="py-1.5 bg-[#1C2836] hover:bg-[#253547] text-slate-600 text-[9px] font-bold rounded-lg border border-[#2D3E50] transition-colors cursor-pointer"
                                        >
                                          ??30ë¶???ë¦¬ë§ˆ?¸ë“œ
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
                    ?”’ ê·¸ë£¹ë°??„ë¼?´ë²„??ëª¨ë“œ ê°€??ì¤?(ë´‡ì? ?¼ë°˜ ?€?”ë? ê¸°ë¡?˜ì? ?Šê³  ëª…ë ¹???¡ì…˜ë§??˜ì‹ ?©ë‹ˆ??
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Sub status footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-6 text-left text-[10px] text-slate-500 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-400">
              <span>{platformConfig.siteLogoText || "ì£¼ì‹?Œì‚¬ myê¹€ë³€"}</span>
              <span>|</span>
              <span>?€?œì´??{platformConfig.companyRepresentative}</span>
              <span>|</span>
              <span>?¬ì—…?ë“±ë¡ë²ˆ??{platformConfig.companyBusinessNumber}</span>
            </div>
            <p className="leading-relaxed">
              ì£¼ì†Œ: {platformConfig.companyAddress} | ?´ë©”?? partners@rebirthtalk.com
            </p>
            <p className="leading-relaxed">
              ë³??Œë«?¼ì˜ ë§¤ì¶œ êµ¬ì¡°??ë³€?¸ì‚¬ë²???4ì¡??•ì‹ ?ì¹™ ê°€?´ë“œ(?œë™ ê¸°ë°˜ ??ê³ ì • êµ¬ë…ë£?ì±…ì •)ë¥?ì² ì??˜ê²Œ ?´í–‰?©ë‹ˆ??
            </p>
          </div>
          <div className="md:text-right shrink-0">
            <p>Â© 2026 {platformConfig.siteLogoText || "myê¹€ë³€"} ?„ì‚° ?„ë¬¸ ë³€?¸ì‚¬ CRM. All rights reserved.</p>
          </div>
        </div>
      </footer>

      </div>
    </div>
  );
}
