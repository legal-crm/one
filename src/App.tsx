import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
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
  initialPlatformConfig
} from './data';
import { ConsultRequest, ConsultMessage, Case, User as LawyerType, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, ClientInquiry, PlatformConfig } from './types';
import ClientRole from './components/ClientRole';
import LawyerRole from './components/LawyerRole';
import AdminRole from './components/AdminRole';
import { ShieldCheck, Info, Sparkles, Scale, RefreshCw, Lock, AlertCircle, Shield } from 'lucide-react';
import { decryptReport } from './utils';
import SharedReportViewer from './components/client/SharedReportViewer';

export default function App() {
  // Triple role state: 'client' | 'lawyer' | 'admin'
  const [currentRole, setCurrentRole] = useState<'client' | 'lawyer' | 'admin'>('client');

  // Share report viewer states
  const [sharePayload, setSharePayload] = useState<string | null>(null);
  const [unlockedData, setUnlockedData] = useState<{ result: any; userInput: any } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // 1. Share parameter detection
    const shareParam = params.get('share');
    if (shareParam) {
      setSharePayload(shareParam);
    }

    // 2. Role parameter detection
    const roleParam = params.get('role');
    if (roleParam === 'admin') {
      setCurrentRole('admin');
    } else if (roleParam === 'lawyer') {
      setCurrentRole('lawyer');
    }
  }, []);

  const handleUnlock = () => {
    if (pin.length !== 4) return;
    if (!sharePayload) return;
    try {
      const decrypted = decryptReport(sharePayload, pin);
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

  // Core application states
  const [requests, setRequests] = useState<ConsultRequest[]>([]);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<LawyerType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(() => {
    const savedNews = localStorage.getItem('legal_crm_news');
    return savedNews ? JSON.parse(savedNews) : mockNewsArticles;
  });

  const [qas, setQas] = useState<ClientQA[]>(() => {
    const saved = localStorage.getItem('legal_crm_qas');
    return saved ? JSON.parse(saved) : initialQAs;
  });

  const [reviews, setReviews] = useState<SuccessReview[]>(() => {
    const saved = localStorage.getItem('legal_crm_reviews');
    return saved ? JSON.parse(saved) : initialReviews;
  });

  const [banners, setBanners] = useState<MainBanner[]>(() => {
    const saved = localStorage.getItem('legal_crm_banners');
    return saved ? JSON.parse(saved) : initialBanners;
  });

  const [notices, setNotices] = useState<Notice[]>(() => {
    const saved = localStorage.getItem('legal_crm_notices');
    return saved ? JSON.parse(saved) : initialNotices;
  });

  const [matchingPolicy, setMatchingPolicy] = useState<'daily' | 'weekly' | 'unlimited'>(() => {
    const saved = localStorage.getItem('legal_crm_matching_policy');
    return (saved as 'daily' | 'weekly' | 'unlimited') || 'daily';
  });

  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(() => {
    const saved = localStorage.getItem('legal_crm_platform_config');
    return saved ? JSON.parse(saved) : initialPlatformConfig;
  });

  // Sync states to localStorage
  useEffect(() => {
    localStorage.setItem('legal_crm_news', JSON.stringify(newsArticles));
  }, [newsArticles]);

  useEffect(() => {
    localStorage.setItem('legal_crm_qas', JSON.stringify(qas));
  }, [qas]);

  useEffect(() => {
    localStorage.setItem('legal_crm_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem('legal_crm_banners', JSON.stringify(banners));
  }, [banners]);

  useEffect(() => {
    localStorage.setItem('legal_crm_notices', JSON.stringify(notices));
  }, [notices]);

  useEffect(() => {
    localStorage.setItem('legal_crm_matching_policy', matchingPolicy);
  }, [matchingPolicy]);

  useEffect(() => {
    if (inquiries.length > 0) {
      localStorage.setItem('legal_crm_inquiries', JSON.stringify(inquiries));
    }
  }, [inquiries]);

  useEffect(() => {
    localStorage.setItem('legal_crm_platform_config', JSON.stringify(platformConfig));
  }, [platformConfig]);

  // Load state from localStorage on startup or fallback to initial mock data.
  useEffect(() => {
    const savedRequests = localStorage.getItem('legal_crm_requests');
    const savedMessages = localStorage.getItem('legal_crm_messages');
    const savedCases = localStorage.getItem('legal_crm_cases');
    const savedLawyers = localStorage.getItem('legal_crm_lawyers');
    const savedMembers = localStorage.getItem('legal_crm_members');
    const savedLogs = localStorage.getItem('legal_crm_activity_logs');

    if (savedRequests) {
      setRequests(JSON.parse(savedRequests));
    } else {
      setRequests(initialConsultRequests);
    }

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages(initialConsultMessages);
    }

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

    const savedInquiries = localStorage.getItem('legal_crm_inquiries');
    if (savedInquiries) {
      setInquiries(JSON.parse(savedInquiries));
    } else {
      setInquiries(initialInquiries);
    }
  }, []);

  // Sync state to localStorage whenever it updates
  useEffect(() => {
    if (requests.length > 0) {
      localStorage.setItem('legal_crm_requests', JSON.stringify(requests));
    }
  }, [requests]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('legal_crm_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (cases.length > 0) {
      localStorage.setItem('legal_crm_cases', JSON.stringify(cases));
    }
  }, [cases]);

  useEffect(() => {
    if (lawyers.length > 0) {
      localStorage.setItem('legal_crm_lawyers', JSON.stringify(lawyers));
    }
  }, [lawyers]);

  useEffect(() => {
    if (members.length > 0) {
      localStorage.setItem('legal_crm_members', JSON.stringify(members));
    }
  }, [members]);

  useEffect(() => {
    if (activityLogs.length > 0) {
      localStorage.setItem('legal_crm_activity_logs', JSON.stringify(activityLogs));
    }
  }, [activityLogs]);

  // Method to add customized chat messages
  const handleAddMessage = (
    reqId: string, 
    text: string, 
    sender: 'client' | 'lawyer', 
    senderId: string, 
    name: string
  ) => {
    const newMessage: ConsultMessage = {
      id: `msg-${Date.now()}`,
      consultRequestId: reqId,
      senderType: sender,
      senderId,
      senderName: name,
      message: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);

    // Update the corresponding request status to active 'counseling' if it was just 'requested' or 'responding'
    setRequests(prev => prev.map(req => {
      if (req.id === reqId && req.status === 'requested') {
        return { ...req, status: 'counseling' };
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
      localStorage.removeItem('legal_crm_matching_policy');
      localStorage.removeItem('legal_crm_members');
      localStorage.removeItem('legal_crm_activity_logs');
      localStorage.removeItem('legal_crm_inquiries');
      localStorage.removeItem('legal_crm_platform_config');
      setRequests(initialConsultRequests);
      setMessages(initialConsultMessages);
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
            <h3 className="font-extrabold text-lg text-white">보안 보호된 진단 보고서</h3>
            <p className="text-xs text-slate-400 leading-relaxed px-4">
              본 진단 보고서는 비밀번호로 보호되어 있습니다.<br />
              공유자로부터 전달받은 <strong>숫자 4자리 비밀번호</strong>를 입력해 주세요.
            </p>
          </div>

          <div className="w-full space-y-3">
            <input 
              type="password"
              maxLength={4}
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                if (pinError) setPinError(false);
              }}
              placeholder="••••"
              className={`w-full text-center text-3xl tracking-[0.6em] font-bold py-3.5 border-2 ${
                pinError ? 'border-red-500 bg-red-500/5 focus:border-red-500' : 'border-slate-800 bg-slate-950 focus:border-[#7264FF]'
              } rounded-xl outline-none transition-colors placeholder:text-slate-700`}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />

            {pinError && (
              <div className="flex items-center gap-1.5 justify-center text-red-400 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>비밀번호가 일치하지 않습니다. 다시 입력해주세요.</span>
              </div>
            )}
          </div>

          <button
            onClick={handleUnlock}
            disabled={pin.length !== 4}
            className="w-full py-3.5 bg-[#7264FF] hover:bg-[#5b4cf5] disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition-colors"
          >
            보고서 잠금 해제하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Role View Render */}
      <div className="flex-1">
        {currentRole === 'client' ? (
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
            matchingPolicy={matchingPolicy}
            members={members}
            setMembers={setMembers}
            onLogActivity={handleLogActivity}
            platformConfig={platformConfig}
            inquiries={inquiries}
            setInquiries={setInquiries}
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
            matchingPolicy={matchingPolicy}
            setMatchingPolicy={setMatchingPolicy}
            members={members}
            setMembers={setMembers}
            activityLogs={activityLogs}
            setActivityLogs={setActivityLogs}
            onLogActivity={handleLogActivity}
            platformConfig={platformConfig}
            setPlatformConfig={setPlatformConfig}
            inquiries={inquiries}
            setInquiries={setInquiries}
          />
        )}
      </div>



      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
