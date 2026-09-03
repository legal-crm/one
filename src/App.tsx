import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { DialogProvider } from './components/common/DialogProvider';
import { 
  loadConsultRequests, 
  saveConsultRequest, 
  saveAllConsultRequests, 
  loadConsultMessages, 
  saveConsultMessage, 
  saveAllConsultMessages, 
  migrateAnonymousRequests 
} from './services/consultService';
import { 
  mockLawyers, 
  initialConsultRequests, 
  initialConsultMessages, 
  initialCases,
  mockNewsArticles,
  initialQAs,
  initialReviews,
  initialBanners,
  initialNotices,
  initialMembers,
  initialActivityLogs,
  initialInquiries,
  initialPlatformConfig,
  initialPopupConfig,
  initialLawyerInquiries
} from './data';
import { ConsultRequest, ConsultMessage, Case, User as LawyerType, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, ClientInquiry, LawyerInquiry, PlatformConfig, PopupConfig } from './types';
const ClientRole = React.lazy(() => import('./components/ClientRole'));
const LawyerRole = React.lazy(() => import('./components/LawyerRole'));
const AdminRole = React.lazy(() => import('./components/AdminRole'));
const HoneypotAdminLogin = React.lazy(() => import('./components/admin/HoneypotAdminLogin'));
import { ShieldCheck, Info, Sparkles, Scale, RefreshCw, Lock, AlertCircle, Shield } from 'lucide-react';
import { decryptReport } from './utils';
import SharedReportViewer from './components/client/SharedReportViewer';
import { secureGetItem, secureSetItem } from './utils/secureStorage';

// [SECURITY] 진짜 관리자 전용 비공개 난수 경로 (뻔한 ?role=admin은 허니팟으로 유인)
export const ADMIN_SECRET_ROLE = 'adm_sec_9k7q';

export default function App() {
  // Quad role state: 'client' | 'lawyer' | 'admin' | 'honeypot'
  // 1순위: URL 쿼리 파라미터, 2순위: 활성 세션 감지 (새로고침 시 홈페이지 플래시 방지)
  const [currentRole, setCurrentRole] = useState<'client' | 'lawyer' | 'admin' | 'honeypot'>(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'admin') return 'honeypot'; // [SECURITY] 공격자/봇은 가짜 허니팟으로 유인
    if (roleParam === ADMIN_SECRET_ROLE) return 'admin'; // [SECURITY] 비공개 난수 주소로만 진짜 관리자 진입
    if (roleParam === 'lawyer') return 'lawyer';
    if (roleParam) return 'client';

    // URL에 role 파라미터가 없을 때 → 활성 세션으로 역할 복원
    try {
      if (sessionStorage.getItem('legal_crm_lawyer_session')) return 'lawyer';
      const adminSession = secureGetItem('legal_crm_admin_session');
      if (adminSession) {
        const { timestamp, signature } = JSON.parse(adminSession);
        if (timestamp && signature && Date.now() - timestamp <= 30 * 60 * 1000) return 'admin';
      }
    } catch {}

    return 'client';
  });

  // Share report viewer states (URL에서 즉시 읽어 플래시 방지)
  const [sharePayload, setSharePayload] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('share');
  });
  const [unlockedData, setUnlockedData] = useState<{ result: any; userInput: any } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    // [FLASH 방지] index.html의 전체 화면 로더를 페이드아웃 후 제거
    const appLoader = document.getElementById('app-loader');
    if (appLoader) {
      appLoader.style.opacity = '0';
      setTimeout(() => appLoader.remove(), 200);
    }

    // [보안 마이그레이션] localStorage에 남아있는 기존 Supabase 세션 토큰 정리
    // sessionStorage로 전환했으므로 localStorage의 세션 데이터는 더 이상 불필요
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (_) { /* silent */ }

    // OAuth 리다이렉트 후 URL에 남는 #access_token=... 또는 빈 # 제거
    if (window.location.hash) {
      const hash = window.location.hash;
      const isOAuthToken = hash.includes('access_token') || hash.includes('error') || hash.includes('refresh_token');
      if (isOAuthToken) {
        // Supabase가 해시 토큰을 파싱할 수 있도록 2초 대기 후 제거
        setTimeout(() => {
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState({}, document.title, cleanUrl);
        }, 2000);
      } else {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    // Share/Role parameter detection은 useState 초기화에서 동기적으로 처리됨 (플래시 방지)
  }, []);

  // [SECURITY] 검색엔진 봇 차단 동적 메타태그 (제주항공 검색엔진 노출 사태 방지)
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const isPrivate = currentRole !== 'client' || Boolean(sharePayload) || window.location.search.includes('share=') || window.location.search.includes('reqId=');
    if (isPrivate) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'robots';
        document.head.appendChild(meta);
      }
      meta.content = 'noindex, nofollow, noarchive, nosnippet';
    } else {
      if (meta) {
        meta.content = 'index, follow';
      }
    }
  }, [currentRole, sharePayload]);

  const handleUnlock = async () => {
    if (pin.length !== 6) return;
    if (!sharePayload) return;
    try {
      const decrypted = await decryptReport(sharePayload, pin);
      const parsed = JSON.parse(decrypted);
      if (parsed.result && parsed.userInput) {
        setUnlockedData(parsed);
        setPinError(false);
      } else {
        throw new Error('Invalid payload structure');
      }
    } catch (err) {
      console.error('Decryption failed:', err);
      setPinError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPin('');
    }
  };

  const handleRedirectToSelfDiagnosis = () => {
    // Clear URL parameter and reset view states
    window.history.replaceState({}, document.title, window.location.pathname);
    setSharePayload(null);
    setUnlockedData(null);
    setCurrentRole('client');
  };

  // ── Helper: Smart merge for consult requests (preserves mock edits & incoming data) ──
  const mergeConsultRequests = React.useCallback((existingList: ConsultRequest[], incomingList: ConsultRequest[] = []): ConsultRequest[] => {
    const map = new Map<string, ConsultRequest>();

    // 1. Base mock requests
    initialConsultRequests.forEach(mock => {
      map.set(mock.id, { ...mock });
    });

    // 2. Apply existing requests (preserves user actions on mocks or created ones)
    existingList.forEach(item => {
      const mockBase = map.get(item.id);
      if (mockBase) {
        map.set(item.id, {
          ...mockBase,
          ...item,
          financialProfile: {
            ...mockBase.financialProfile,
            ...(item.financialProfile || {}),
          },
          proposals: item.proposals && item.proposals.length > 0 ? item.proposals : mockBase.proposals,
          acceptedLawyerIds: item.acceptedLawyerIds && item.acceptedLawyerIds.length > 0 ? item.acceptedLawyerIds : mockBase.acceptedLawyerIds,
          status: item.status || mockBase.status,
        });
      } else {
        map.set(item.id, item);
      }
    });

    // 3. Apply incoming DB requests
    incomingList.forEach(item => {
      const existing = map.get(item.id);
      if (existing) {
        const mergedProposals = (existing.proposals?.length || 0) > (item.proposals?.length || 0)
          ? existing.proposals
          : (item.proposals || existing.proposals);
        const mergedAcceptedLawyerIds = Array.from(new Set([
          ...(existing.acceptedLawyerIds || []),
          ...(item.acceptedLawyerIds || [])
        ]));
        map.set(item.id, {
          ...existing,
          ...item,
          proposals: mergedProposals,
          acceptedLawyerIds: mergedAcceptedLawyerIds,
          status: existing.status !== 'requested' && item.status === 'requested' ? existing.status : (item.status || existing.status),
        });
      } else {
        map.set(item.id, item);
      }
    });

    return Array.from(map.values()).filter(r => r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3');
  }, []);

  // ── Helper: Smart merge for messages ──
  const mergeConsultMessages = React.useCallback((existingList: ConsultMessage[], incomingList: ConsultMessage[] = []): ConsultMessage[] => {
    const map = new Map<string, ConsultMessage>();
    existingList.forEach(m => map.set(m.id, m));
    incomingList.forEach(m => map.set(m.id, m));
    return Array.from(map.values())
      .filter(m => m.consultRequestId !== 'req-1' && m.consultRequestId !== 'req-2' && m.consultRequestId !== 'req-3')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, []);

  // Core application states
  // Initial load from localStorage (instant)
  const [requests, _setRequests] = useState<ConsultRequest[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_requests');
      if (saved) {
        const parsed = JSON.parse(saved).filter((r: any) => 
          r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3'
        );
        return mergeConsultRequests(parsed);
      }
    } catch {}
    return initialConsultRequests;
  });

  const setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>> = React.useCallback((action) => {
    _setRequests(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try { secureSetItem('legal_crm_requests', JSON.stringify(next)); } catch {}
      saveAllConsultRequests(next).catch(() => {});
      return next;
    });
  }, []);

  const [messages, _setMessages] = useState<ConsultMessage[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_messages');
      if (saved) {
        return JSON.parse(saved).filter((m: any) => m.consultRequestId !== 'req-1' && m.consultRequestId !== 'req-2' && m.consultRequestId !== 'req-3');
      }
    } catch {}
    return [];
  });

  // Async load from Supabase + 5초 간격 폴링 동기화
  useEffect(() => {
    let isMounted = true;

    const syncFromDb = async () => {
      try {
        const [dbRequests, dbMessages] = await Promise.all([
          loadConsultRequests(),
          loadConsultMessages(),
        ]);
        if (!isMounted) return;
        if (dbRequests.length > 0) {
          _setRequests(prev => {
            const merged = mergeConsultRequests(prev, dbRequests);
            try { secureSetItem('legal_crm_requests', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
        if (dbMessages.length > 0) {
          _setMessages(prev => {
            const merged = mergeConsultMessages(prev, dbMessages);
            try { secureSetItem('legal_crm_messages', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}
    };

    // 초기 로드
    syncFromDb();

    // 5초 간격 폴링 (변호사 ↔ 고객 실시간 동기화)
    const intervalId = setInterval(syncFromDb, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [mergeConsultRequests, mergeConsultMessages]);

  const setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>> = React.useCallback((action) => {
    _setMessages(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try { secureSetItem('legal_crm_messages', JSON.stringify(next)); } catch {}
      saveAllConsultMessages(next).catch(() => {});
      return next;
    });
  }, []);
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<LawyerType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(() => {
    const savedNews = secureGetItem('legal_crm_news');
    return savedNews ? JSON.parse(savedNews) : mockNewsArticles;
  });

  const [qas, setQas] = useState<ClientQA[]>(() => {
    const saved = secureGetItem('legal_crm_qas');
    if (saved) {
      const parsed: ClientQA[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map(q => q.id));
      const newEntries = initialQAs.filter(q => !existingIds.has(q.id));
      return newEntries.length > 0 ? [...parsed, ...newEntries] : parsed;
    }
    return initialQAs;
  });

  const [reviews, setReviews] = useState<SuccessReview[]>(() => {
    const saved = secureGetItem('legal_crm_reviews');
    return saved ? JSON.parse(saved) : initialReviews;
  });

  const [banners, setBanners] = useState<MainBanner[]>(() => {
    const saved = secureGetItem('legal_crm_banners');
    return saved ? JSON.parse(saved) : initialBanners;
  });

  const [notices, setNotices] = useState<Notice[]>(() => {
    const saved = secureGetItem('legal_crm_notices');
    return saved ? JSON.parse(saved) : initialNotices;
  });

  const [matchingCooldownHours, setMatchingCooldownHours] = useState<number>(() => {
    const saved = secureGetItem('legal_crm_matching_cooldown_hours');
    return saved ? Number(saved) : 24;
  });

  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(() => {
    const saved = secureGetItem('legal_crm_platform_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          companyRepresentative: initialPlatformConfig.companyRepresentative,
          companyBusinessNumber: initialPlatformConfig.companyBusinessNumber,
          companyAddress: initialPlatformConfig.companyAddress,
          termsOfService: initialPlatformConfig.termsOfService,
          privacyPolicy: initialPlatformConfig.privacyPolicy,
        };
      } catch (e) {
        return initialPlatformConfig;
      }
    }
    return initialPlatformConfig;
  });

  const [popupConfig, setPopupConfig] = useState<PopupConfig>(() => {
    const saved = secureGetItem('legal_crm_popup_config');
    return saved ? JSON.parse(saved) : initialPopupConfig;
  });

  const [lawyerInquiries, setLawyerInquiries] = useState<LawyerInquiry[]>(() => {
    const saved = secureGetItem('legal_crm_lawyer_inquiries');
    return saved ? JSON.parse(saved) : initialLawyerInquiries;
  });

  // Sync states to localStorage
  useEffect(() => {
    secureSetItem('legal_crm_news', JSON.stringify(newsArticles));
  }, [newsArticles]);

  useEffect(() => {
    secureSetItem('legal_crm_qas', JSON.stringify(qas));
  }, [qas]);

  useEffect(() => {
    secureSetItem('legal_crm_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    secureSetItem('legal_crm_banners', JSON.stringify(banners));
  }, [banners]);

  useEffect(() => {
    secureSetItem('legal_crm_notices', JSON.stringify(notices));
  }, [notices]);

  useEffect(() => {
    secureSetItem('legal_crm_matching_cooldown_hours', String(matchingCooldownHours));
  }, [matchingCooldownHours]);

  useEffect(() => {
    if (inquiries.length > 0) {
      secureSetItem('legal_crm_inquiries', JSON.stringify(inquiries));
    }
  }, [inquiries]);

  useEffect(() => {
    secureSetItem('legal_crm_platform_config', JSON.stringify(platformConfig));
  }, [platformConfig]);

  useEffect(() => {
    secureSetItem('legal_crm_popup_config', JSON.stringify(popupConfig));
  }, [popupConfig]);

  useEffect(() => {
    secureSetItem('legal_crm_lawyer_inquiries', JSON.stringify(lawyerInquiries));
  }, [lawyerInquiries]);

  // Load state from localStorage on startup or fallback to initial mock data.
  useEffect(() => {
    const savedCases = secureGetItem('legal_crm_cases');
    const savedLawyers = secureGetItem('legal_crm_lawyers');
    const savedMembers = secureGetItem('legal_crm_members');
    const savedLogs = secureGetItem('legal_crm_activity_logs');

    // requests와 messages는 lazy initializer에서 이미 로드됨

    if (savedCases) {
      setCases(JSON.parse(savedCases));
    } else {
      setCases(initialCases);
    }

    if (savedLawyers && JSON.parse(savedLawyers).length >= mockLawyers.length) {
      setLawyers(JSON.parse(savedLawyers));
    } else {
      // Set initial passwords to '1234' for easy mockup login
      const lawyersWithPass = mockLawyers.map(l => ({ ...l, password: '1234' }));
      setLawyers(lawyersWithPass);
    }

    if (savedMembers) {
      setMembers(JSON.parse(savedMembers));
    } else {
      setMembers(initialMembers);
    }

    if (savedLogs) {
      setActivityLogs(JSON.parse(savedLogs));
    } else {
      setActivityLogs(initialActivityLogs);
    }

    const savedInquiries = secureGetItem('legal_crm_inquiries');
    if (savedInquiries) {
      setInquiries(JSON.parse(savedInquiries));
    } else {
      setInquiries(initialInquiries);
    }
  }, []);


  // requests/messages는 setRequests/setMessages 래퍼에서 즉시 동기 저장됨

  useEffect(() => {
    if (cases.length > 0) {
      secureSetItem('legal_crm_cases', JSON.stringify(cases));
    }
  }, [cases]);

  useEffect(() => {
    if (lawyers.length > 0) {
      secureSetItem('legal_crm_lawyers', JSON.stringify(lawyers));
    }
  }, [lawyers]);

  useEffect(() => {
    if (members.length > 0) {
      secureSetItem('legal_crm_members', JSON.stringify(members));
    }
  }, [members]);

  useEffect(() => {
    if (activityLogs.length > 0) {
      secureSetItem('legal_crm_activity_logs', JSON.stringify(activityLogs));
    }
  }, [activityLogs]);

  // Method to add customized chat messages
  const handleAddMessage = (
    reqId: string, 
    text: string, 
    sender: 'client' | 'lawyer', 
    senderId: string, 
    name: string,
    targetLawyerId?: string
  ) => {
    const newMessage: ConsultMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      consultRequestId: reqId,
      senderType: sender,
      senderId,
      senderName: name,
      message: text,
      createdAt: new Date().toISOString(),
      ...(targetLawyerId ? { targetLawyerId } : {})
    };
    setMessages(prev => mergeConsultMessages(prev, [newMessage]));
    saveConsultMessage(newMessage).catch(() => {});

    // Update the corresponding request status to active 'counseling' & preserve acceptedLawyerIds
    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        const accepted = req.acceptedLawyerIds || [];
        const isLawyerSender = sender === 'lawyer' && senderId && senderId !== 'system';
        const updatedAccepted = isLawyerSender && !accepted.includes(senderId) ? [...accepted, senderId] : accepted;
        return {
          ...req,
          acceptedLawyerIds: updatedAccepted,
          status: (req.status === 'requested' || req.status === 'responding') ? 'counseling' : req.status
        };
      }
      return req;
    }));
  };

  // Log activity helper
  const handleLogActivity = (
    memberId: string,
    memberName: string,
    role: MemberRole,
    action: ActivityLog['action'],
    details: string
  ) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      memberId,
      memberName,
      role,
      action,
      details,
      ipAddress: `121.138.45.${Math.floor(10 + Math.random() * 200)}`,
      createdAt: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev.slice(0, 199)]); // Keep up to 200 logs
  };

  // Reset entire database to default mock
  const handleResetData = () => {
    if (confirm('모든 입력 데이터를 기동 초기값으로 리셋하시겠습니까?')) {
      localStorage.removeItem('legal_crm_requests');
      localStorage.removeItem('legal_crm_messages');
      localStorage.removeItem('legal_crm_cases');
      localStorage.removeItem('legal_crm_lawyers');
      localStorage.removeItem('legal_crm_news');
      localStorage.removeItem('legal_crm_qas');
      localStorage.removeItem('legal_crm_reviews');
      localStorage.removeItem('legal_crm_banners');
      localStorage.removeItem('legal_crm_notices');
      localStorage.removeItem('legal_crm_matching_cooldown_hours');
      localStorage.removeItem('legal_crm_members');
      localStorage.removeItem('legal_crm_activity_logs');
      localStorage.removeItem('legal_crm_inquiries');
      localStorage.removeItem('legal_crm_platform_config');
      localStorage.removeItem('legal_crm_popup_config');
      setRequests(initialConsultRequests);
      setMessages(initialConsultMessages);

      saveAllConsultRequests(initialConsultRequests).catch(() => {});
      saveAllConsultMessages(initialConsultMessages).catch(() => {});

      setCases(initialCases);
      setMembers(initialMembers);
      setActivityLogs(initialActivityLogs);
      window.location.reload();
    }
  };

  // Share mode conditional rendering
  if (sharePayload) {
    if (unlockedData) {
      return (
        <SharedReportViewer 
          result={unlockedData.result}
          userInput={unlockedData.userInput}
          onStartSelfDiagnosis={handleRedirectToSelfDiagnosis}
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-[Pretendard] flex items-center justify-center p-4">
        {/* Shaking & unlock css inject */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
            20%, 40%, 60%, 80% { transform: translateX(6px); }
          }
          .shake-input {
            animation: shake 0.4s ease-in-out;
          }
        `}</style>

        <div className={`w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5 ${isShaking ? 'shake-input' : ''}`}>
          <div className="p-4 bg-[#7264FF]/10 text-[#7264FF] rounded-2xl">
            <Lock className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-extrabold text-lg text-white">보안 보호된 채무 리포트</h3>
            <p className="text-xs text-slate-500 leading-relaxed px-4">
              본 채무 리포트는 비밀번호로 보호되어 있습니다.<br />
              공유자로부터 전달받은 <strong>숫자 6자리 비밀번호</strong>를 입력해 주세요.
            </p>
          </div>

          <div className="w-full space-y-3">
            <input 
              type="password"
              maxLength={6}
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                if (pinError) setPinError(false);
              }}
              placeholder="••••••"
              className={`w-full text-center text-3xl tracking-[0.6em] font-bold py-3.5 border-2 ${
                pinError ? 'border-red-500 bg-red-500/5 focus:border-red-500' : 'border-slate-800 bg-slate-950 focus:border-[#7264FF]'
              } rounded-xl outline-none transition-colors placeholder:text-slate-700`}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />

            {pinError && (
              <div className="flex items-center gap-1.5 justify-center text-red-400 text-[13px] font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>비밀번호가 일치하지 않습니다. 다시 입력해주세요.</span>
              </div>
            )}
          </div>

          <button
            onClick={handleUnlock}
            disabled={pin.length !== 6}
            className="w-full py-3.5 bg-[#7264FF] hover:bg-[#5b4cf5] disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold rounded-xl transition-colors"
          >
            보고서 잠금 해제하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <DialogProvider>
      <div className="flex flex-col min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white">
        
        {/* Role View Render */}
        <div className="flex-1">
          <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-bold">권한 페이지를 불러오고 있습니다...</p>
            </div>
          }>
            {currentRole === 'honeypot' ? (
              <HoneypotAdminLogin />
            ) : currentRole === 'client' ? (
              <ClientRole 
                requests={requests}
                setRequests={setRequests}
                messages={messages}
                setMessages={setMessages}
                lawyers={lawyers}
                onAddMessage={handleAddMessage}
                newsArticles={newsArticles}
                setNewsArticles={setNewsArticles}
                qas={qas}
                setQas={setQas}
                reviews={reviews}
                setReviews={setReviews}
                banners={banners}
                setBanners={setBanners}
                notices={notices}
                setNotices={setNotices}
                matchingCooldownHours={matchingCooldownHours}
                members={members}
                setMembers={setMembers}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                inquiries={inquiries}
                setInquiries={setInquiries}
                popupConfig={popupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
              />
            ) : currentRole === 'lawyer' ? (
              <LawyerRole 
                requests={requests}
                setRequests={setRequests}
                messages={messages}
                setMessages={setMessages}
                lawyers={lawyers}
                setLawyers={setLawyers}
                onAddMessage={handleAddMessage}
                cases={cases}
                setCases={setCases}
                members={members}
                setMembers={setMembers}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                qas={qas}
                setQas={setQas}
                popupConfig={popupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
                notices={notices}
              />
            ) : (
              <AdminRole 
                requests={requests}
                setRequests={setRequests}
                lawyers={lawyers}
                setLawyers={setLawyers}
                newsArticles={newsArticles}
                setNewsArticles={setNewsArticles}
                qas={qas}
                setQas={setQas}
                reviews={reviews}
                setReviews={setReviews}
                banners={banners}
                setBanners={setBanners}
                notices={notices}
                setNotices={setNotices}
                matchingCooldownHours={matchingCooldownHours}
                setMatchingCooldownHours={setMatchingCooldownHours}
                members={members}
                setMembers={setMembers}
                activityLogs={activityLogs}
                setActivityLogs={setActivityLogs}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                setPlatformConfig={setPlatformConfig}
                inquiries={inquiries}
                setInquiries={setInquiries}
                popupConfig={popupConfig}
                setPopupConfig={setPopupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
              />
            )}
          </React.Suspense>
        </div>

        <Toaster position="top-center" richColors closeButton />
      </div>
    </DialogProvider>
  );
}

