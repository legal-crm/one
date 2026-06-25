import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Users, Briefcase, CreditCard, CheckCircle2, AlertTriangle, 
  Trash2, EyeOff, Check, X, ShieldAlert, ShieldCheck, Sparkles, ExternalLink,
  LogOut, Lock, UserPlus, Calendar, TrendingUp, Smartphone, Mail, Search, Filter, Activity, Server,
  Edit2, Plus, Save, RotateCcw
} from 'lucide-react';
import { ConsultRequest, User, ConsultStatus, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, MemberStatus, PlatformConfig, ClientInquiry, DiagnosisQuestion } from '../types';
import { platformPlans } from '../data';
import { DEFAULT_DIAGNOSIS_QUESTIONS } from '../engines/diagnosisEngine';
import { saveDiagnosisConfig } from '../services/diagnosisService';
import RehabSettingsPanel from './RehabSettingsPanel';

interface AdminRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
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
  matchingPolicy: 'daily' | 'weekly' | 'unlimited';
  setMatchingPolicy: React.Dispatch<React.SetStateAction<'daily' | 'weekly' | 'unlimited'>>;
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  activityLogs: ActivityLog[];
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  onLogActivity: (memberId: string, memberName: string, role: MemberRole, action: ActivityLog['action'], details: string) => void;
  platformConfig: PlatformConfig;
  setPlatformConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
}

export default function AdminRole({
  requests,
  setRequests,
  lawyers,
  setLawyers,
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
  matchingPolicy,
  setMatchingPolicy,
  members,
  setMembers,
  activityLogs,
  setActivityLogs,
  onLogActivity,
  platformConfig,
  setPlatformConfig,
  inquiries,
  setInquiries
}: AdminRoleProps) {
  // Triple tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'lawyers' | 'billing' | 'contents' | 'settings' | 'members'>('dashboard');
  const [billingSubTab, setBillingSubTab] = useState<'overview' | 'active' | 'exited'>('overview');

  // Members tab states
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('all');
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [activityActionFilter, setActivityActionFilter] = useState<string>('all');

  // CRUD states for News Article Management
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [isCreateMode, setIsCreateMode] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formExcerpt, setFormExcerpt] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('개인회생');
  const [formBadge, setFormBadge] = useState<'HOT' | 'NEW' | 'BEST' | null>(null);
  const [formAuthorId, setFormAuthorId] = useState<string>('lawyer-1');
  const [formImageUrl, setFormImageUrl] = useState<string>('');

  // Site Content sub-navigation state
  const [contentSubTab, setContentSubTab] = useState<'news' | 'qna' | 'reviews' | 'banner' | 'notice' | 'inquiry' | 'diagnosis'>('news');

  // CRUD states for Diagnosis Config
  const [diagQuestions, setDiagQuestions] = useState<DiagnosisQuestion[]>(DEFAULT_DIAGNOSIS_QUESTIONS);
  const [editingDiagIdx, setEditingDiagIdx] = useState<number | null>(null);
  const [diagSaving, setDiagSaving] = useState(false);

  // CRUD states for Notices
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [isNoticeCreateMode, setIsNoticeCreateMode] = useState<boolean>(false);
  const [noticeTitle, setNoticeTitle] = useState<string>('');
  const [noticeContent, setNoticeContent] = useState<string>('');
  const [noticeIsImportant, setNoticeIsImportant] = useState<boolean>(false);

  // CRUD states for Q&A (고민 상담사례)
  const [editingQa, setEditingQa] = useState<ClientQA | null>(null);
  const [isQaCreateMode, setIsQaCreateMode] = useState<boolean>(false);
  const [qaQuestion, setQaQuestion] = useState<string>('');
  const [qaAnswer, setQaAnswer] = useState<string>('');
  const [qaCategory, setQaCategory] = useState<string>('코인/주식 손실');
  const [qaAuthor, setQaAuthor] = useState<string>('');
  const [qaLawyerId, setQaLawyerId] = useState<string>('lawyer-1');
  const [qaBadge, setQaBadge] = useState<string>('실시간 답변');

  // CRUD states for Success Reviews (채무 해결 성공후기)
  const [editingReview, setEditingReview] = useState<SuccessReview | null>(null);
  const [isReviewCreateMode, setIsReviewCreateMode] = useState<boolean>(false);
  const [reviewTitle, setReviewTitle] = useState<string>('');
  const [reviewCategory, setReviewCategory] = useState<string>('코인/주식 손실');
  const [reviewAuthor, setReviewAuthor] = useState<string>('');
  const [reviewOriginalDebt, setReviewOriginalDebt] = useState<number>(5000);
  const [reviewRemainingDebt, setReviewRemainingDebt] = useState<number>(1000);
  const [reviewLawyerId, setReviewLawyerId] = useState<string>('lawyer-1');
  const [reviewContent, setReviewContent] = useState<string>('');
  const [reviewTagsText, setReviewTagsText] = useState<string>('');

  // CRUD states for Main Banners (메인 배너)
  const [editingBanner, setEditingBanner] = useState<MainBanner | null>(null);
  const [isBannerCreateMode, setIsBannerCreateMode] = useState<boolean>(false);
  const [bannerTitle, setBannerTitle] = useState<string>('');
  const [bannerSubtitle, setBannerSubtitle] = useState<string>('');
  const [bannerBadge, setBannerBadge] = useState<string>('');
  const [bannerColor, setBannerColor] = useState<string>('rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)');
  const [bannerImage, setBannerImage] = useState<string>('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200');

  // Auth states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('legal_crm_admin_session') !== null;
  });
  const [loginId, setLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const id = loginId.trim().toLowerCase();
    const pw = loginPassword.trim();

    if ((id === 'admin' && pw === 'admin') || (id === '1' && pw === '1')) {
      localStorage.setItem('legal_crm_admin_session', 'active');
      setIsLoggedIn(true);
      setLoginError('');
      setLoginId('');
      setLoginPassword('');
    } else {
      setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleLogout = () => {
    if (confirm('어드민 세션을 로그아웃 하시겠습니까?')) {
      localStorage.removeItem('legal_crm_admin_session');
      setIsLoggedIn(false);
    }
  };

  // Search/Filter states
  const [clientSearch, setClientSearch] = useState<string>('');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('all');
  const [lawyerSearch, setLawyerSearch] = useState<string>('');
  const [lawyerApprovalFilter, setLawyerApprovalFilter] = useState<string>('all');

  // Selected entities for detail panels
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('');

  // Pagination states
  const [clientPage, setClientPage] = useState<number>(1);
  const [lawyerPage, setLawyerPage] = useState<number>(1);
  const [billingPage, setBillingPage] = useState<number>(1);

  // Reset billing page when subtab changes
  useEffect(() => {
    setBillingPage(1);
  }, [billingSubTab]);

  // Reset pagination to page 1 on search or filter changes
  useEffect(() => {
    setClientPage(1);
  }, [clientSearch, clientStatusFilter]);

  useEffect(() => {
    setLawyerPage(1);
  }, [lawyerSearch, lawyerApprovalFilter]);

  // Dashboard sort type state
  const [dashboardSortType, setDashboardSortType] = useState<'weekly' | 'monthly'>('weekly');

  // Client inquiry states
  const [selectedInquiryId, setSelectedInquiryId] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');

  // Global platform configuration states (form fields)
  const [formSiteTitle, setFormSiteTitle] = useState<string>(platformConfig ? platformConfig.siteTitle : '');
  const [formSiteLogoText, setFormSiteLogoText] = useState<string>(platformConfig ? platformConfig.siteLogoText : '');
  const [formSiteLogoUrl, setFormSiteLogoUrl] = useState<string>(platformConfig ? platformConfig.siteLogoUrl || '' : '');
  const [formCompanyAddress, setFormCompanyAddress] = useState<string>(platformConfig ? platformConfig.companyAddress : '');
  const [formCompanyBusinessNumber, setFormCompanyBusinessNumber] = useState<string>(platformConfig ? platformConfig.companyBusinessNumber : '');
  const [formCompanyRepresentative, setFormCompanyRepresentative] = useState<string>(platformConfig ? platformConfig.companyRepresentative : '');
  const [formTermsOfService, setFormTermsOfService] = useState<string>(platformConfig ? platformConfig.termsOfService : '');
  const [formPrivacyPolicy, setFormPrivacyPolicy] = useState<string>(platformConfig ? platformConfig.privacyPolicy : '');

  // Synchronize configuration form fields when platformConfig prop updates
  useEffect(() => {
    if (platformConfig) {
      setFormSiteTitle(platformConfig.siteTitle);
      setFormSiteLogoText(platformConfig.siteLogoText);
      setFormSiteLogoUrl(platformConfig.siteLogoUrl || '');
      setFormCompanyAddress(platformConfig.companyAddress);
      setFormCompanyBusinessNumber(platformConfig.companyBusinessNumber);
      setFormCompanyRepresentative(platformConfig.companyRepresentative);
      setFormTermsOfService(platformConfig.termsOfService);
      setFormPrivacyPolicy(platformConfig.privacyPolicy);
    }
  }, [platformConfig]);

  // 1. Calculations for Dashboard Stats
  const totalRequestsCount = requests.length;
  const activeConsultsCount = requests.filter(r => r.status === 'counseling').length;
  const completedConsultsCount = requests.filter(r => r.status === 'closed').length;
  const totalLawyersCount = lawyers.length;
  const pendingLawyersCount = lawyers.filter(l => l.approved === false).length;

  // Processed Debt calculation (sum of debt totals in KRW ten thousand)
  const totalDebtProcessed = requests.reduce((acc, r) => acc + r.financialProfile.debtTotal, 0);

  // Platform conversion rate (completed / total)
  const conversionRate = totalRequestsCount > 0 
    ? Math.round((completedConsultsCount / totalRequestsCount) * 100) 
    : 0;

  // Active partners list for billing (exclude suspended, withdrawn, dormant)
  const billingActiveLawyers = lawyers.filter(l => {
    const member = members.find(m => m.id === l.id);
    return !member || (member.status !== 'suspended' && member.status !== 'withdrawn' && member.status !== 'dormant');
  });

  // Exited or suspended partners list for billing
  const billingExitedLawyers = members.filter(m => 
    (m.role === 'LAWYER' || m.role === 'STAFF') && 
    (m.status === 'suspended' || m.status === 'withdrawn' || m.status === 'dormant')
  );

  // Estimate Monthly Recurring Revenue (MRR) based on active subscribers
  // Basic: 300,000 KRW, Pro: 800,000 KRW, Team/Enterprise: 1,500,000 KRW
  const activeMRR = billingActiveLawyers.reduce((acc, l) => {
    if (l.matchedCount > 120) return acc + 1500000;
    if (l.matchedCount > 80) return acc + 800000;
    return acc + 300000;
  }, 0);

  const estimateMRR = activeMRR;

  // Excluded or lost revenue calculation
  const lostMRR = billingExitedLawyers.reduce((acc, m) => {
    const l = lawyers.find(law => law.id === m.id);
    const matched = l ? l.matchedCount : 0;
    if (matched > 120) return acc + 1500000;
    if (matched > 80) return acc + 800000;
    return acc + 300000;
  }, 0);

  // 2. Client monitoring list filtering (respecting compliance)
  const filteredClients = requests.filter(r => {
    const matchesSearch = r.clientName.toLowerCase().includes(clientSearch.toLowerCase());
    const matchesStatus = clientStatusFilter === 'all' || r.status === clientStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedClient = requests.find(r => r.id === selectedClientId);

  // Mask client phone and detailed asset values to comply with Personal Data Protection Act
  const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
  };

  // 3. Lawyer approval directory filtering
  const filteredLawyers = lawyers.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(lawyerSearch.toLowerCase()) || 
                          l.id.toLowerCase().includes(lawyerSearch.toLowerCase());
    
    let matchesApproval = true;
    if (lawyerApprovalFilter === 'approved') {
      matchesApproval = l.approved !== false;
    } else if (lawyerApprovalFilter === 'pending') {
      matchesApproval = l.approved === false;
    }
    
    return matchesSearch && matchesApproval;
  });

  const selectedLawyer = lawyers.find(l => l.id === selectedLawyerId);

  // Pagination constants & calculation
  const ITEMS_PER_PAGE = 8;
  const BILLING_ITEMS_PER_PAGE = 5;

  // Paginated Clients
  const totalClientPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE) || 1;
  const currentClientPage = Math.min(clientPage, totalClientPages);
  const startIndexClient = (currentClientPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndexClient, startIndexClient + ITEMS_PER_PAGE);

  // Paginated Lawyers
  const totalLawyerPages = Math.ceil(filteredLawyers.length / ITEMS_PER_PAGE) || 1;
  const currentLawyerPage = Math.min(lawyerPage, totalLawyerPages);
  const startIndexLawyer = (currentLawyerPage - 1) * ITEMS_PER_PAGE;
  const paginatedLawyers = filteredLawyers.slice(startIndexLawyer, startIndexLawyer + ITEMS_PER_PAGE);

  // Paginated Active Billing
  const totalBillingPages = Math.ceil(billingActiveLawyers.length / BILLING_ITEMS_PER_PAGE) || 1;
  const currentBillingPage = Math.min(billingPage, totalBillingPages);
  const startIndexBilling = (currentBillingPage - 1) * BILLING_ITEMS_PER_PAGE;
  const paginatedActiveBilling = billingActiveLawyers.slice(startIndexBilling, startIndexBilling + BILLING_ITEMS_PER_PAGE);

  // Handlers
  const handleToggleBlockRequest = (reqId: string) => {
    // Toggles request content to [노출 제한] and status to closed (spam filtering)
    if (confirm('이 의뢰글을 불량 스팸성 글로 판단하여 노출을 전면 차단하시겠습니까? (변호사 대기 목록에서 즉시 숨겨집니다)')) {
      setRequests(prev => prev.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            title: `[노출 차단] 어드민에 의해 스팸 글로 분류되었습니다.`,
            content: `이 요청글은 광고/장난 등 플랫폼 정책에 위반되는 비정상 유입 데이터로 판명되어 관리자에 의해 비공개 처리되었습니다.`,
            status: 'closed'
          };
        }
        return r;
      }));
      alert('스팸 노출 제한 처리가 완료되었습니다.');
    }
  };

  const handleApproveLawyer = (lawyerId: string) => {
    setLawyers(prev => prev.map(l => {
      if (l.id === lawyerId) {
        return {
          ...l,
          approved: true,
          recentActivity: '자격 승인 검토 완료 (정식 활동 개시)'
        };
      }
      return l;
    }));
    setMembers(prev => prev.map(m => m.id === lawyerId ? { ...m, status: 'active' } : m));
    onLogActivity('admin', '최고관리자', 'ADMIN', 'ADMIN_ACTION', `변호사 자격 승인 완료: ${lawyerId}`);
    alert('해당 대리인의 자격 심사가 승인되었습니다. 즉시 포털 이용 및 상담 참여가 가능합니다.');
  };

  const handleSuspendLawyer = (lawyerId: string) => {
    if (confirm('이 변호사의 활동 라이선스를 일시 정지(미승인 상태로 강제 전환)하시겠습니까? 포털 접속이 즉각 차단됩니다.')) {
      setLawyers(prev => prev.map(l => {
        if (l.id === lawyerId) {
          return {
            ...l,
            approved: false,
            recentActivity: '운영정책 위반으로 승인 정지 처리됨'
          };
        }
        return l;
      }));
      setMembers(prev => prev.map(m => m.id === lawyerId ? { ...m, status: 'suspended' } : m));
      onLogActivity('admin', '최고관리자', 'ADMIN', 'ADMIN_ACTION', `변호사 라이선스 강제 정지 처리: ${lawyerId}`);
      alert('대리인 라이선스 정지 처리가 완료되었습니다.');
    }
  };

  const handleChangeLawyerPlan = (lawyerId: string, matchedCountTarget: number) => {
    // Simulates changing active subscription plan via mock stats matchedCount
    setLawyers(prev => prev.map(l => {
      if (l.id === lawyerId) {
        return {
          ...l,
          matchedCount: matchedCountTarget
        };
      }
      return l;
    }));
    alert('구독 플랜 한도가 수동 조정되었습니다.');
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-indigo-600 selection:text-white items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0F121C] border border-[#1E293B]/60 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          {/* Logo / Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <span className="font-black text-xl tracking-tight text-white">회생톡 통합 어드민</span>
            </div>
            <p className="text-slate-400 text-xs">플랫폼 통합 의뢰인 및 파트너 제어 관리 센터</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <h3 className="font-extrabold text-sm text-slate-200 border-b border-[#1E293B]/50 pb-2 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>관리자 인증</span>
            </h3>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-xs p-3 rounded-xl">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 block uppercase font-bold">어드민 ID</label>
              <input 
                type="text" 
                placeholder="어드민 아이디 입력 (기본: admin 또는 1)"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 block uppercase font-bold">비밀번호</label>
              <input 
                type="password" 
                placeholder="비밀번호 입력 (기본: admin 또는 1)"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600"
              />
            </div>

            {/* Test credentials info */}
            <div className="bg-[#111622] border border-[#1E293B]/40 rounded-xl p-3.5 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-indigo-400 block">🔑 테스트용 관리자 계정</span>
              <div>• 아이디: <strong className="text-white">admin</strong> / 비밀번호: <strong className="text-white">admin</strong></div>
              <div>• (또는 초간편 바이패스: <strong className="text-slate-350">1</strong> / <strong className="text-slate-350">1</strong>)</div>
            </div>

            <div className="flex gap-2 pt-1">
              <button 
                type="submit"
                className="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>어드민 로그인</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  localStorage.setItem('legal_crm_admin_session', 'active');
                  setIsLoggedIn(true);
                }}
                className="flex-1 bg-[#111622] hover:bg-[#161B26] text-indigo-400 font-extrabold py-3 rounded-[200px] text-xs border border-[#1E293B]/60 transition-colors cursor-pointer"
              >
                테스트 계정 1초 로그인
              </button>
            </div>
          </form>

          {/* Compliance statement */}
          <div className="text-[10px] text-slate-500 leading-normal border-t border-[#1E293B]/30 pt-3 flex items-center justify-center gap-1">
            <span>🔒 플랫폼 보안 1등급 마스터 라이선스 적용됨</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-[#0F121C] border-x border-[#1E293B]/60 shadow-2xl flex flex-col relative">
        
        {/* Admin Header */}
        <header className="sticky top-0 z-40 bg-[#161B26]/90 backdrop-blur-md border-b border-[#1E293B]/60 shadow-xl px-4 py-3.5">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-sm tracking-tight text-white">회생톡 플랫폼 어드민</span>
                  <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-extrabold text-[9px] tracking-wider uppercase">Master</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">통합 통합 의뢰인 및 파트너 자격 제어 모듈</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>실시간 운영 모니터링 가동 중</span>
              </span>

              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 bg-[#111622] hover:bg-[#161B26] text-slate-400 hover:text-white px-2.5 py-1.5 rounded-[200px] border border-[#1E293B]/60 text-[10px] transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </header>

        {/* Tab row */}
        <div className="bg-[#161B26] border-b border-[#1E293B]/60 px-4">
          <div className="w-full flex overflow-x-auto gap-4 py-2 text-xs font-semibold scrollbar-hide">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>플랫폼 통합 대시보드</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('clients')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'clients' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>의뢰인(소비자) 모니터링</span>
            </button>

            <button 
              onClick={() => setActiveTab('lawyers')}
              className={`relative pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'lawyers' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>변호사 심사 및 자격 관리</span>
              {pendingLawyersCount > 0 && (
                <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold animate-pulse">
                  {pendingLawyersCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('billing')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'billing' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>과금 분석 및 예상 정산</span>
            </button>

            <button 
              onClick={() => setActiveTab('contents')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'contents' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>사이트 콘텐츠 제어</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'settings' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>⚖️ 매칭 정책 설정</span>
            </button>

            <button 
              onClick={() => setActiveTab('members')}
              className={`pb-2 pt-1 px-1 border-b-2 flex items-center gap-1.5 transition-all text-sm shrink-0 ${
                activeTab === 'members' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent text-slate-450 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>회원 및 활동 모니터링</span>
            </button>
          </div>
        </div>

        {/* Workspace Frame */}
        <main className="flex-1 w-full px-4 py-6 overflow-y-auto">

          {/* TAB 1: PLATFORM DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Stat grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">누적 상담 신청 건수</span>
                    <span className="text-2xl font-black text-indigo-400">{totalRequestsCount}개</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">진행 사건 전환율</span>
                    <span className="text-2xl font-black text-emerald-400">{conversionRate}%</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">등록 파트너 대리인</span>
                    <span className="text-2xl font-black text-sky-400">
                      {totalLawyersCount}명 {pendingLawyersCount > 0 && <strong className="text-red-400 text-xs font-bold">({pendingLawyersCount} 대기)</strong>}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/10">
                    <Briefcase className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">일일 방문자수</span>
                    <span className="text-2xl font-black text-rose-400">248명</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/10">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">오늘 신규 가입자</span>
                    <span className="text-2xl font-black text-indigo-400">
                      {members.filter(m => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        return m.createdAt.startsWith(todayStr);
                      }).length}명
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                    <UserPlus className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">시스템 서버 상태</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">ONLINE</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                    <Server className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Graphical Analysis grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Platform Health and Compliance status */}
                <div className="md:col-span-2 bg-[#111622] p-6 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E293B]/50 pb-3">
                    <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span>변호사법 제34조 알선수수료 배제 준수율</span>
                    </h3>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded font-mono">COMPLIANT</span>
                  </div>

                  <div className="space-y-3.5 text-xs leading-relaxed text-slate-400">
                    <p>회생톡 플랫폼은 가입 변호사로부터 <strong>사건 성사당 수임 소개 수수료를 1원도 징수하지 않습니다.</strong></p>
                    <div className="p-3 bg-[#0B0F19] rounded-xl border border-[#1E293B]/40 space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span>• 사건 당 중개 수수료 수취율</span>
                        <strong className="text-emerald-400">0.0% (완전 합법)</strong>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>• 소비자 매칭 자율 선택 모델 준수</span>
                        <strong className="text-emerald-400">100% 준수 (임의 배정 없음)</strong>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>• 정액 광고료/구독료 정산 상태</span>
                        <strong className="text-indigo-400">월 고정형 SaaS 과금</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estimation Box */}
                <div className="bg-[#111622] p-6 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <h3 className="font-bold text-sm text-slate-200 border-b border-[#1E293B]/50 pb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                    <span>이달 예상 플랫폼 매출 (MRR)</span>
                  </h3>
                  <div className="space-y-3 text-center py-2">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">월 고정 회원제 정산액</span>
                    <strong className="text-2xl font-black text-indigo-400">{estimateMRR.toLocaleString()} 원</strong>
                    <span className="text-[9px] text-slate-450 block leading-tight">* 소속 변호사 {totalLawyersCount}명의 구독 멤버십 징수 추정액입니다.</span>
                  </div>
                </div>

              </div>

              {/* SignUp & Traffic Analytics Chart Panel */}
              <div className="bg-[#111622] p-6 rounded-2xl border border-[#1E293B]/60 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#1E293B]/50 pb-3 gap-3">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-indigo-400" />
                    <span>가입자 추이 및 방문자(유입량) 분석</span>
                  </h3>
                  <div className="flex bg-[#0B0F19] p-0.5 rounded-lg border border-[#1E293B]/60">
                    <button
                      onClick={() => setDashboardSortType('weekly')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${
                        dashboardSortType === 'weekly' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      주별 보기 (최근 4주)
                    </button>
                    <button
                      onClick={() => setDashboardSortType('monthly')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${
                        dashboardSortType === 'monthly' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      월별 보기 (최근 6개월)
                    </button>
                  </div>
                </div>

                {/* Chart Visualization */}
                <div className="space-y-6">
                  <div className="flex items-end justify-between h-48 pt-4 px-2 sm:px-6 bg-[#0B0F19]/40 rounded-xl border border-[#1E293B]/30 gap-3 sm:gap-6">
                    {/* Y-axis Labels */}
                    <div className="flex flex-col justify-between h-full text-[9px] text-slate-500 font-mono pr-2 border-r border-[#1E293B]/30 pb-4">
                      <span>{dashboardSortType === 'weekly' ? '250명' : '1000명'}</span>
                      <span>{dashboardSortType === 'weekly' ? '125명' : '500명'}</span>
                      <span>0명</span>
                    </div>

                    {/* Chart Bars */}
                    {(dashboardSortType === 'weekly' ? [
                      { label: '1주차', signups: 8, traffic: 120 },
                      { label: '2주차', signups: 12, traffic: 160 },
                      { label: '3주차', signups: 15, traffic: 190 },
                      { label: '4주차 (현재)', signups: 19, traffic: 248 }
                    ] : [
                      { label: '1월', signups: 30, traffic: 450 },
                      { label: '2월', signups: 35, traffic: 510 },
                      { label: '3월', signups: 42, traffic: 600 },
                      { label: '4월', signups: 48, traffic: 720 },
                      { label: '5월', signups: 55, traffic: 850 },
                      { label: '6월 (현재)', signups: 64, traffic: 980 }
                    ]).map((data, index) => {
                      const maxTraffic = dashboardSortType === 'weekly' ? 250 : 1000;
                      const maxSignups = dashboardSortType === 'weekly' ? 25 : 80;
                      const trafficHeight = Math.min((data.traffic / maxTraffic) * 100, 100);
                      const signupHeight = Math.min((data.signups / maxSignups) * 100, 100);

                      return (
                        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                          <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32 relative">
                            
                            {/* Tooltip */}
                            <div className="absolute -top-10 scale-0 group-hover:scale-100 bg-slate-900 border border-[#1E293B] rounded-lg p-2 text-[10px] text-slate-200 z-10 transition-all shadow-xl pointer-events-none whitespace-nowrap">
                              <div className="font-bold text-slate-100 mb-0.5">{data.label}</div>
                              <div className="flex items-center gap-1.5 text-indigo-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                가입자: {data.signups}명
                              </div>
                              <div className="flex items-center gap-1.5 text-rose-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                유입량: {data.traffic}명
                              </div>
                            </div>

                            {/* Traffic Bar (Background/Taller) */}
                            <div 
                              style={{ height: `${trafficHeight}%` }} 
                              className="w-3 sm:w-5 bg-gradient-to-t from-rose-500/20 to-rose-500/80 rounded-t-sm sm:rounded-t transition-all duration-500 group-hover:brightness-125"
                            />
                            {/* Signup Bar (Foreground/Shorter) */}
                            <div 
                              style={{ height: `${signupHeight}%` }} 
                              className="w-3 sm:w-5 bg-gradient-to-t from-indigo-500/20 to-indigo-500/80 rounded-t-sm sm:rounded-t transition-all duration-500 group-hover:brightness-125"
                            />
                          </div>
                          
                          {/* Label */}
                          <span className="text-[10px] text-slate-400 mt-2 font-medium truncate max-w-full text-center">
                            {data.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-6 text-xs border-t border-[#1E293B]/20 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-indigo-500/20 to-indigo-500/80" />
                      <span className="text-slate-400">신규 가입자수</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-rose-500/20 to-rose-500/80" />
                      <span className="text-slate-400">일일 방문자수 (유입량)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 마케팅 유입 채널별 효과 및 회원가입 종합 현황 분석 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1) 회원가입 종합 요약 지표 */}
                <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <h3 className="font-bold text-sm text-slate-200 border-b border-[#1E293B]/50 pb-3 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>실시간 가입 및 회원 종합 지표</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#07090E]/60 p-3 rounded-xl border border-[#1E293B]/30 flex flex-col justify-between">
                      <span className="text-slate-500 font-bold block mb-1">전체 회원수</span>
                      <strong className="text-lg font-black text-slate-200">{members.length}명</strong>
                    </div>
                    <div className="bg-[#07090E]/60 p-3 rounded-xl border border-[#1E293B]/30 flex flex-col justify-between">
                      <span className="text-slate-500 font-bold block mb-1">오늘 신규 가입</span>
                      <strong className="text-lg font-black text-indigo-400">
                        {members.filter(m => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          return m.createdAt.startsWith(todayStr);
                        }).length}명
                      </strong>
                    </div>
                    <div className="bg-[#07090E]/60 p-3 rounded-xl border border-[#1E293B]/30 flex flex-col justify-between">
                      <span className="text-slate-500 font-bold block mb-1">정상 활동 회원</span>
                      <strong className="text-lg font-black text-emerald-400">
                        {members.filter(m => m.status === 'active').length}명
                      </strong>
                    </div>
                    <div className="bg-[#07090E]/60 p-3 rounded-xl border border-[#1E293B]/30 flex flex-col justify-between">
                      <span className="text-slate-500 font-bold block mb-1">정지 회원 / 대기</span>
                      <strong className="text-lg font-black text-red-400">
                        {members.filter(m => m.status === 'suspended').length}명
                        <span className="text-slate-500 text-[10px] font-normal"> / {members.filter(m => m.status === 'pending').length}명</span>
                      </strong>
                    </div>
                    <div className="bg-[#07090E]/65 p-3 rounded-xl border border-[#1E293B]/30 col-span-2 flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">탈퇴 회원수</span>
                        <strong className="text-lg font-black text-slate-400">
                          {members.filter(m => m.status === 'withdrawn').length}명
                        </strong>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                        <div 
                          style={{ 
                            width: `${members.length > 0 ? Math.round((members.filter(m => m.status === 'withdrawn').length / members.length) * 100) : 0}%` 
                          }} 
                          className="bg-slate-500 h-full rounded-full" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2) 마케팅 유입 채널별 전환 효과 분석 (Funnel Analytics) */}
                <div className="lg:col-span-2 bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E293B]/50 pb-3">
                    <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                      <span>마케팅 유입 경로별 전환율 (Funnel)</span>
                    </h3>
                    
                    {/* 최우수 마케팅 채널 계산 */}
                    {(() => {
                      const channels: ('email' | 'google' | 'kakao' | 'naver' | 'sms')[] = ['naver', 'kakao', 'google', 'sms', 'email'];
                      let bestChannel = '없음';
                      let maxConv = -1;

                      channels.forEach(ch => {
                        const chUsers = members.filter(m => m.loginChannel === ch);
                        if (chUsers.length > 0) {
                          const chUserIds = chUsers.map(u => u.id);
                          const chConsults = activityLogs.filter(log => log.action === 'CONSULT_REQUEST' && chUserIds.includes(log.memberId)).length;
                          const convRate = (chConsults / chUsers.length) * 100;
                          if (convRate > maxConv) {
                            maxConv = convRate;
                            bestChannel = ch === 'naver' ? '네이버' : ch === 'kakao' ? '카카오' : ch === 'google' ? '구글' : ch === 'sms' ? 'SMS인증' : '이메일';
                          }
                        }
                      });

                      return maxConv > 0 ? (
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase flex items-center gap-1">
                          🏆 최우수 채널: {bestChannel} ({Math.round(maxConv)}% 전환)
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* 채널 테이블 및 상세 마케팅 성과 매트릭스 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-500 font-bold border-b border-[#1E293B]/30 pb-2">
                          <th className="pb-2">가입 채널</th>
                          <th className="pb-2 text-center">가입수</th>
                          <th className="pb-2 text-center">상담 신청수</th>
                          <th className="pb-2 text-center">상담 전환율</th>
                          <th className="pb-2 text-right">인당 계산기 실행수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/20">
                        {['naver', 'kakao', 'google', 'sms', 'email'].map(ch => {
                          const chUsers = members.filter(m => m.loginChannel === ch);
                          const chUserIds = chUsers.map(u => u.id);
                          const chConsults = activityLogs.filter(log => log.action === 'CONSULT_REQUEST' && chUserIds.includes(log.memberId)).length;
                          const chCalculates = activityLogs.filter(log => log.action === 'CALCULATE' && chUserIds.includes(log.memberId)).length;
                          const convRate = chUsers.length > 0 ? Math.round((chConsults / chUsers.length) * 100) : 0;
                          const avgCalculates = chUsers.length > 0 ? (chCalculates / chUsers.length).toFixed(1) : '0.0';
                          
                          const label = ch === 'naver' ? '💬 네이버 간편' : ch === 'kakao' ? '💬 카카오 간편' : ch === 'google' ? '💬 구글 간편' : ch === 'sms' ? '📱 휴대폰인증' : '✉️ 일반이메일';
                          const color = ch === 'naver' ? 'text-emerald-400' : ch === 'kakao' ? 'text-yellow-400' : ch === 'google' ? 'text-indigo-400' : ch === 'sms' ? 'text-sky-400' : 'text-slate-350';

                          return (
                            <tr key={ch} className="hover:bg-[#0B0F19]/20 transition-colors">
                              <td className={`py-2.5 font-bold ${color}`}>{label}</td>
                              <td className="py-2.5 text-center font-semibold text-slate-100">{chUsers.length}명</td>
                              <td className="py-2.5 text-center font-semibold text-slate-100">{chConsults}건</td>
                              <td className="py-2.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <strong className="text-emerald-400 font-extrabold">{convRate}%</strong>
                                  <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                    <div style={{ width: `${convRate}%` }} className="bg-emerald-500 h-full rounded-full" />
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 text-right font-mono text-slate-300">{avgCalculates}회/인</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 leading-normal">
                    * 상담 전환율 = (해당 유입 채널 가입자의 총 상담신청 건수 / 총 가입자 수) × 100 <br />
                    * 인당 계산기 실행수 = (해당 채널 가입자의 자가진단 계산 실행 횟수 / 총 가입자 수). 수치가 높을수록 서비스 적극 관여 고객입니다.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CLIENT MONITORING */}
          {activeTab === 'clients' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Search Control */}
              <div className="bg-[#111622] p-4 rounded-xl border border-[#1E293B]/60 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <input 
                    type="text" 
                    placeholder="의뢰인 성명 검색..." 
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E293B]/80 rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600"
                  />
                  <span className="absolute left-3 top-2 text-slate-500 text-xs">🔍</span>
                </div>

                <select 
                  value={clientStatusFilter} 
                  onChange={(e) => setClientStatusFilter(e.target.value)}
                  className="bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl px-3 py-1.5 text-xs text-slate-300"
                >
                  <option value="all">전체 상태 조회</option>
                  <option value="requested">요청 대기</option>
                  <option value="responding">지정 응답</option>
                  <option value="counseling">상담 중</option>
                  <option value="closed">수임/종결</option>
                </select>
              </div>

              {/* Data Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* List container */}
                <div className="lg:col-span-7 bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">의뢰인명</th>
                          <th className="p-3">연락처 (마스킹)</th>
                          <th className="p-3">상태</th>
                          <th className="p-3 text-right">총 채무 규모</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/30">
                        {paginatedClients.map(c => {
                          const isSelected = c.id === selectedClientId;
                          const isSpamBlocked = c.title.includes('[노출 차단]');
                          return (
                            <tr 
                              key={c.id}
                              onClick={() => setSelectedClientId(c.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-600/5 hover:bg-indigo-600/10' : 'hover:bg-[#0B0F19]/40'
                              } ${isSpamBlocked ? 'opacity-40' : ''}`}
                            >
                              <td className="p-3 font-bold text-white flex items-center gap-1.5">
                                <span>{c.clientName}</span>
                                {isSpamBlocked && (
                                  <span className="bg-red-500/15 text-red-400 border border-red-500/20 text-[8px] px-1 py-0.2 rounded font-extrabold uppercase">
                                    SPAM
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-400">{maskPhone(c.phone)}</td>
                              <td className="p-3">
                                <span className={`text-[9px] px-2 py-0.5 rounded border ${
                                  c.status === 'requested' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  c.status === 'counseling' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  c.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  'bg-slate-800 text-slate-400 border-slate-750'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-200">
                                {c.financialProfile.debtTotal.toLocaleString()}만원
                              </td>
                            </tr>
                          );
                        })}

                        {filteredClients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-500">
                              등록된 의뢰 데이터가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Client Pagination Controls */}
                  {totalClientPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#161B26] border-t border-[#1E293B]/60 text-xs">
                      <span className="text-slate-400 font-mono">
                        Page {currentClientPage} of {totalClientPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={currentClientPage === 1}
                          onClick={() => setClientPage(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          이전
                        </button>
                        {Array.from({ length: totalClientPages }).map((_, i) => {
                          const p = i + 1;
                          return (
                            <button
                              key={p}
                              onClick={() => setClientPage(p)}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                currentClientPage === p
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                        <button
                          disabled={currentClientPage === totalClientPages}
                          onClick={() => setClientPage(prev => Math.min(totalClientPages, prev + 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          다음
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Details view */}
                <div className="lg:col-span-5 bg-[#111622] rounded-xl border border-[#1E293B]/60 p-5 space-y-4">
                  {selectedClient ? (
                    <>
                      <div className="flex justify-between items-start border-b border-[#1E293B]/60 pb-3">
                        <div>
                          <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">CLIENT INFO MONITORS</span>
                          <h3 className="text-sm font-extrabold text-white">{selectedClient.clientName} 의뢰 모니터링</h3>
                        </div>
                        <span className="text-[10px] bg-[#0B0F19] border border-[#1E293B]/60 text-slate-400 px-2 py-0.5 rounded">
                          ID: {selectedClient.id}
                        </span>
                      </div>

                      <div className="space-y-3.5 text-xs text-slate-400">
                        {/* Legal warning */}
                        <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]/40 space-y-1.5">
                          <span className="text-[10px] font-extrabold text-indigo-400 block uppercase">⚖️ 법률 데이터 무결성 보호 안내</span>
                          <p className="leading-relaxed text-[11px]">
                            개인정보 보호법 및 변호사법 준수에 근거하여 관리자는 의뢰인의 원본 기재 금융 채무 구조 금액을 임의 수정할 수 없습니다. 아래 정보는 읽기 전용 상태로 안전하게 렌더링됩니다.
                          </p>
                        </div>

                        {/* Masked Data sheet */}
                        <div className="space-y-2 bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B]/40">
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>연락처 (개인정보 보호 마스킹)</span>
                            <strong className="text-white font-mono">{maskPhone(selectedClient.phone)}</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>월 가용 기재소득</span>
                            <strong className="text-white">{selectedClient.financialProfile.income}만 원</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>총 기재 채무액</span>
                            <strong className="text-white">{selectedClient.financialProfile.debtTotal.toLocaleString()}만 원</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>부양 가족수 / 결혼 구조</span>
                            <strong className="text-white">{selectedClient.financialProfile.dependents}명 / {selectedClient.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : selectedClient.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</strong>
                          </div>

                          {selectedClient.financialProfile.jobType && (
                            <>
                              <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5 pt-0.5">
                                <span>직업 유형 및 직장명</span>
                                <strong className="text-white">
                                  {selectedClient.financialProfile.jobType === 'SALARIED' ? '급여소득' : selectedClient.financialProfile.jobType === 'BUSINESS' ? '영업소득' : selectedClient.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}
                                  {selectedClient.financialProfile.companyNameMasked && ` (${selectedClient.financialProfile.companyNameMasked})`}
                                </strong>
                              </div>
                              <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                                <span>실거주 지역 / 임차보증금</span>
                                <strong className="text-white">{selectedClient.financialProfile.residenceRegion} / {selectedClient.financialProfile.rentalDeposit?.toLocaleString()}만원</strong>
                              </div>
                              {selectedClient.financialProfile.maritalStatus === 'MARRIED' && (
                                <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                                  <span>배우자 재산 / 소득</span>
                                  <strong className="text-white">{selectedClient.financialProfile.spouseAsset?.toLocaleString()}만 / {selectedClient.financialProfile.spouseIncome}만원</strong>
                                </div>
                              )}
                              <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                                <span>채무 주원인 / 채권자수</span>
                                <strong className="text-white">
                                  {selectedClient.financialProfile.debtCause === 'LIVING' ? '생활비' : 
                                   selectedClient.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : 
                                   selectedClient.financialProfile.debtCause === 'INVESTMENT' ? `투자 실패${selectedClient.financialProfile.speculativeLoss ? ` (${selectedClient.financialProfile.speculativeLoss.toLocaleString()}만원)` : ''}` : 
                                   selectedClient.financialProfile.debtCause === 'GAMBLING' ? `도박/사행성${selectedClient.financialProfile.gamblingLoss ? ` (${selectedClient.financialProfile.gamblingLoss.toLocaleString()}만원)` : ''}` : 
                                   selectedClient.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}
                                  {` (${selectedClient.financialProfile.creditorCount}곳 금융기관)`}
                                </strong>
                              </div>
                              <div className="flex justify-between text-indigo-400">
                                <span>현재 채무 추심 단계</span>
                                <strong className="font-bold">
                                  {selectedClient.financialProfile.harassmentLevel === 'CALL' ? '추심 전화 및 문자' : selectedClient.financialProfile.harassmentLevel === 'LETTER' ? '독촉장 및 가택방문' : selectedClient.financialProfile.harassmentLevel === 'LAWSUIT' ? '소급/소송 진행' : '급여/통장 압류 단계'}
                                </strong>
                              </div>
                              {selectedClient.financialProfile.legalActions && selectedClient.financialProfile.legalActions.length > 0 && selectedClient.financialProfile.legalActions.some(x => x !== 'none') && (
                                <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5 text-indigo-400">
                                  <span>진행중인 법적 조치</span>
                                  <strong className="font-bold">
                                    {selectedClient.financialProfile.legalActions
                                      .filter(x => x !== 'none')
                                      .map(x => ({
                                        collection_call: '독촉',
                                        court_order: '소장수령',
                                        seizure: '급여압류',
                                        property_seizure: '부동산압류',
                                        credit_drop: '신용하락'
                                      }[x] || x))
                                      .join(', ')}
                                  </strong>
                                </div>
                              )}
                              {selectedClient.financialProfile.speculativeLoss !== undefined && selectedClient.financialProfile.speculativeLoss > 0 && (
                                <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5 text-rose-450">
                                  <span>1년내 주식/코인 손실액</span>
                                  <strong className="font-bold">{selectedClient.financialProfile.speculativeLoss.toLocaleString()}만원</strong>
                                </div>
                              )}
                              {selectedClient.financialProfile.gamblingLoss !== undefined && selectedClient.financialProfile.gamblingLoss > 0 && (
                                <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5 text-rose-455">
                                  <span>1년내 도박 채무액</span>
                                  <strong className="font-bold">{selectedClient.financialProfile.gamblingLoss.toLocaleString()}만원</strong>
                                </div>
                              )}
                              {selectedClient.financialProfile.retirementPay !== undefined && selectedClient.financialProfile.retirementPay > 0 && (
                                <>
                                  <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5 pt-0.5 text-slate-300">
                                    <span>예상 퇴직금 원금</span>
                                    <strong className="text-white">{selectedClient.financialProfile.retirementPay.toLocaleString()}만원</strong>
                                  </div>
                                  <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                                    <span>퇴직연금 가입 형태</span>
                                    <strong className={selectedClient.financialProfile.retirementPensionType === 'unknown' ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                                      {selectedClient.financialProfile.retirementPensionType === 'pension' ? '퇴직연금 가입 (0% 반영)' :
                                       selectedClient.financialProfile.retirementPensionType === 'none' ? '퇴직연금 미가입 (50% 반영)' : '모름 (50% 반영)'}
                                    </strong>
                                  </div>
                                  {selectedClient.financialProfile.retirementPensionType === 'unknown' && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[10px] text-amber-400 font-bold text-center animate-pulse">
                                      ⚠️ [확인 필요] 예상 퇴직금 조회 및 가입 형태 확인 요망
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="font-bold text-slate-350 block">의뢰서 원본 텍스트 요약:</span>
                          <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]/40 leading-relaxed text-[11px] text-slate-300 whitespace-pre-wrap">
                            {selectedClient.content}
                          </div>
                        </div>

                        {/* Spam filter action */}
                        {!selectedClient.title.includes('[노출 차단]') ? (
                          <div className="bg-red-950/20 border border-red-500/10 p-4 rounded-xl space-y-2.5">
                            <span className="text-[11px] font-bold text-red-400 block flex items-center gap-1">
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>불량 광고 및 허위 의뢰글 숨김</span>
                            </span>
                            <p className="text-[10px] leading-relaxed text-slate-400">
                              해당 게시물이 광고글, 장난, 또는 변호사법상 의뢰가 아닌 유해글로 판정되면 노출을 영구 차단할 수 있습니다. (클릭 시 제목 및 내용이 치환되며 대기열에서 즉시 숨겨집니다)
                            </p>
                            <button 
                              onClick={() => handleToggleBlockRequest(selectedClient.id)}
                              className="w-full bg-red-600/10 hover:bg-red-600 hover:text-white text-red-400 py-2 rounded-[200px] text-xs font-extrabold border border-red-500/20 transition-all flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>이 의뢰글 노출 영구 차단</span>
                            </button>
                          </div>
                        ) : (
                          <div className="bg-red-500/5 border border-red-500/25 p-4 rounded-xl text-center text-red-400 text-xs font-bold leading-normal">
                            🔒 본 의뢰글은 스팸 필터링에 의거하여 노출이 완벽히 차단된 상태입니다.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-slate-600 text-xs">
                      조회 또는 모니터링할 의뢰인을 왼쪽 표에서 선택해 주십시오.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: LAWYER DIRECTORY & APPROVAL */}
          {activeTab === 'lawyers' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Search Control */}
              <div className="bg-[#111622] p-4 rounded-xl border border-[#1E293B]/60 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <input 
                    type="text" 
                    placeholder="변호사명 또는 ID 검색..." 
                    value={lawyerSearch}
                    onChange={(e) => setLawyerSearch(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E293B]/80 rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600"
                  />
                  <span className="absolute left-3 top-2 text-slate-500 text-xs">🔍</span>
                </div>

                <select 
                  value={lawyerApprovalFilter} 
                  onChange={(e) => setLawyerApprovalFilter(e.target.value)}
                  className="bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl px-3 py-1.5 text-xs text-slate-300"
                >
                  <option value="all">전체 자격 승인 현황</option>
                  <option value="approved">정식 활동 중 (승인 완료)</option>
                  <option value="pending">승인 대기 중</option>
                </select>
              </div>

              {/* Split Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* List container */}
                <div className="lg:col-span-7 bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">성명 (역할)</th>
                          <th className="p-3">소속 로펌 지부</th>
                          <th className="p-3">활동 상태</th>
                          <th className="p-3 text-right">이달 매칭수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/30">
                        {paginatedLawyers.map(l => {
                          const isSelected = l.id === selectedLawyerId;
                          const isApproved = l.approved !== false;
                          return (
                            <tr 
                              key={l.id}
                              onClick={() => setSelectedLawyerId(l.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-600/5 hover:bg-indigo-600/10' : 'hover:bg-[#0B0F19]/40'
                              }`}
                            >
                              <td className="p-3 flex items-center gap-2">
                                <img 
                                  src={l.avatar} 
                                  alt={l.name} 
                                  className="w-6 h-6 rounded-full object-cover border border-[#1E293B]/40" 
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-white">{l.name}</span>
                                  <span className="text-[9px] text-slate-500 font-semibold">{l.role}</span>
                                </div>
                              </td>
                              <td className="p-3 text-slate-350">{l.region} 지부</td>
                              <td className="p-3">
                                <span className={`text-[9px] px-2 py-0.5 rounded border ${
                                  isApproved 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {isApproved ? '정식 파트너' : '승인 대기중'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-200">
                                {l.matchedCount}건
                              </td>
                            </tr>
                          );
                        })}

                        {filteredLawyers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-500">
                              등록된 대리인 정보가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Lawyer Pagination Controls */}
                  {totalLawyerPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#161B26] border-t border-[#1E293B]/60 text-xs">
                      <span className="text-slate-400 font-mono">
                        Page {currentLawyerPage} of {totalLawyerPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={currentLawyerPage === 1}
                          onClick={() => setLawyerPage(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          이전
                        </button>
                        {Array.from({ length: totalLawyerPages }).map((_, i) => {
                          const p = i + 1;
                          return (
                            <button
                              key={p}
                              onClick={() => setLawyerPage(p)}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                currentLawyerPage === p
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                        <button
                          disabled={currentLawyerPage === totalLawyerPages}
                          onClick={() => setLawyerPage(prev => Math.min(totalLawyerPages, prev + 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          다음
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail card */}
                <div className="lg:col-span-5 bg-[#111622] rounded-xl border border-[#1E293B]/60 p-5 space-y-5">
                  {selectedLawyer ? (
                    <>
                      <div className="flex items-start justify-between border-b border-[#1E293B]/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={selectedLawyer.avatar} 
                            alt={selectedLawyer.name} 
                            className="w-10 h-10 rounded-full object-cover border border-indigo-500/30" 
                          />
                          <div>
                            <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">{selectedLawyer.role} DETAILS</span>
                            <h3 className="text-sm font-extrabold text-white">{selectedLawyer.name}</h3>
                          </div>
                        </div>
                        <span className="text-[10px] bg-[#0B0F19] border border-[#1E293B]/60 text-slate-400 px-2 py-0.5 rounded">
                          ID: {selectedLawyer.id}
                        </span>
                      </div>

                      <div className="space-y-4 text-xs text-slate-400">
                        {/* Bio summary */}
                        <div className="space-y-1">
                          <span className="font-bold text-slate-350 block">소개 약력:</span>
                          <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]/40 leading-relaxed text-[11px] text-slate-300">
                            {selectedLawyer.bio}
                          </div>
                        </div>

                        {/* Fields & Region */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]/40">
                          <div>• 소속/지부: <strong className="text-slate-200">{selectedLawyer.region}</strong></div>
                          <div>• 이달 매칭실적: <strong className="text-slate-200">{selectedLawyer.matchedCount}건</strong></div>
                          <div className="col-span-2 mt-1">• 전문 분야: <strong className="text-indigo-400">{selectedLawyer.fields.join(', ')}</strong></div>
                        </div>

                        {/* Qualifications / License check block */}
                        {selectedLawyer.approved === false ? (
                          <div className="bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-xl space-y-2.5">
                            <span className="text-[11px] font-bold text-indigo-400 block flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>변호사 자격 승인 검토 요청</span>
                            </span>
                            <p className="text-[10px] leading-relaxed text-slate-400">
                              가입 시 제출한 자격 확인서 및 소속 로펌 인증을 심사하십시오. 승인을 완료하면 대리인은 my김변의 모든 상담 세션 및 실시간 채팅 매칭에 정식으로 참여할 권한을 부여받습니다.
                            </p>
                            <button 
                              onClick={() => handleApproveLawyer(selectedLawyer.id)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>소속 대리인 자격 정식 승인</span>
                            </button>
                          </div>
                        ) : (
                          <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-xl space-y-2.5">
                            <span className="text-[11px] font-bold text-emerald-400 block flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>정식 활동 자격 승인 완료됨</span>
                            </span>
                            <p className="text-[10px] leading-relaxed text-slate-400">
                              위 회원은 현재 변호사 자격 및 로펌 심사가 승인된 활성화 파트너 상태입니다. 운영 원칙 및 광고 규정 위반이 감지될 경우 수임 권한을 임시 정지(블록)할 수 있습니다.
                            </p>
                            <button 
                              onClick={() => handleSuspendLawyer(selectedLawyer.id)}
                              className="w-full bg-slate-900 hover:bg-red-600 hover:text-white text-slate-400 py-2 rounded-[200px] text-xs font-extrabold border border-slate-800 transition-colors flex items-center justify-center gap-1"
                            >
                              <EyeOff className="w-4 h-4" />
                              <span>변호사 정식 자격 임시 정지</span>
                            </button>
                          </div>
                        )}

                        {/* Subscription manual control */}
                        <div className="p-4 bg-[#0B0F19] rounded-xl border border-[#1E293B]/40 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-400 block">💳 로펌 정액 멤버십 플랜 제어</span>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleChangeLawyerPlan(selectedLawyer.id, 10)}
                              className={`flex-1 py-1.5 rounded-xl border text-[10px] font-bold ${
                                selectedLawyer.matchedCount <= 50 
                                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30' 
                                : 'bg-[#111622] text-slate-500 border-[#1E293B]/60 hover:text-slate-200'
                              }`}
                            >
                              Basic 요금제
                            </button>
                            
                            <button 
                              onClick={() => handleChangeLawyerPlan(selectedLawyer.id, 90)}
                              className={`flex-1 py-1.5 rounded-xl border text-[10px] font-bold ${
                                selectedLawyer.matchedCount > 50 && selectedLawyer.matchedCount <= 100
                                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30' 
                                : 'bg-[#111622] text-slate-500 border-[#1E293B]/60 hover:text-slate-200'
                              }`}
                            >
                              Pro 요금제
                            </button>

                            <button 
                              onClick={() => handleChangeLawyerPlan(selectedLawyer.id, 130)}
                              className={`flex-1 py-1.5 rounded-xl border text-[10px] font-bold ${
                                selectedLawyer.matchedCount > 100
                                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30' 
                                : 'bg-[#111622] text-slate-500 border-[#1E293B]/60 hover:text-slate-200'
                              }`}
                            >
                              Enterprise
                            </button>
                          </div>
                        </div>

                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-slate-600 text-xs">
                      조회할 변호사 파트너를 왼쪽 명부에서 클릭하십시오.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: BILLING OPERATIONS */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-fadeIn text-left">
              
              {/* Local Navigation Bar */}
              <div className="flex border-b border-[#1E293B]/60 gap-4 text-xs font-bold pb-1 text-slate-400">
                <button
                  onClick={() => setBillingSubTab('overview')}
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${
                    billingSubTab === 'overview' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'
                  }`}
                >
                  📊 통합 매출/정산 분석 (Sales Overview)
                </button>
                <button
                  onClick={() => setBillingSubTab('active')}
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${
                    billingSubTab === 'active' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'
                  }`}
                >
                  💳 구독료 수납 현황 (Active Receipts)
                </button>
                <button
                  onClick={() => setBillingSubTab('exited')}
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${
                    billingSubTab === 'exited' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'
                  }`}
                >
                  ⚠️ 정지/이탈 대리인 정산 (Exited Partners)
                </button>
              </div>

              {/* OVERVIEW SUBTAB */}
              {billingSubTab === 'overview' && (
                <div className="space-y-6">
                  {/* Financial Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-2">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">일 평균 예상 매출</span>
                      <strong className="text-xl font-black text-emerald-400">
                        {Math.round(activeMRR / 30).toLocaleString()} 원
                      </strong>
                      <p className="text-[10px] text-slate-500 leading-normal">구독 활성 파트너 기준 일정산 환산</p>
                    </div>
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-2">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">주간 누적 예상 매출</span>
                      <strong className="text-xl font-black text-indigo-400">
                        {Math.round(activeMRR / 4).toLocaleString()} 원
                      </strong>
                      <p className="text-[10px] text-slate-500 leading-normal">최근 7일간의 총 정산 구독료</p>
                    </div>
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-2">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">월 고정 구독 매출 (MRR)</span>
                      <strong className="text-xl font-black text-white">
                        {activeMRR.toLocaleString()} 원
                      </strong>
                      <p className="text-[10px] text-slate-500 leading-normal">현재 활성화된 대리인 광고 구독 총액</p>
                    </div>
                    <div className="bg-[#111622] p-5 rounded-2xl border border-red-500/20 bg-red-950/5 space-y-2">
                      <span className="text-[9px] text-red-400/80 font-bold block uppercase">이탈/정지 누수 매출액</span>
                      <strong className="text-xl font-black text-red-400">
                        -{lostMRR.toLocaleString()} 원
                      </strong>
                      <p className="text-[10px] text-red-500/60 leading-normal">정지/탈퇴 대리인의 미청구 구독 손실</p>
                    </div>
                  </div>

                  {/* Revenue Breakdowns */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* 1. Daily Breakdown */}
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider flex items-center justify-between">
                        <span>일별 매출 추이 (최근 5일)</span>
                        <span className="text-[10px] text-slate-500 font-mono">Daily Trend</span>
                      </h4>
                      <div className="space-y-2">
                        {[
                          { date: '오늘 (6/4)', amount: Math.round(activeMRR / 30 + 8000), count: 5, pct: 98 },
                          { date: '어제 (6/3)', amount: Math.round(activeMRR / 30 - 12000), count: 4, pct: 86 },
                          { date: '그저께 (6/2)', amount: Math.round(activeMRR / 30 + 4000), count: 4, pct: 92 },
                          { date: '6/1 (월)', amount: Math.round(activeMRR / 30 - 3000), count: 3, pct: 88 },
                          { date: '5/31 (일)', amount: Math.round(activeMRR / 30 + 15000), count: 6, pct: 100 }
                        ].map((d, i) => (
                          <div key={i} className="bg-[#0B0F19]/40 p-2.5 rounded-lg border border-[#1E293B]/30 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-bold text-slate-355">{d.date}</span>
                              <span className="font-mono text-emerald-450 font-bold">{d.amount.toLocaleString()}원</span>
                            </div>
                            <div className="w-full bg-[#1E293B]/40 h-1 rounded overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${d.pct}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                              <span>정수 구독 수납</span>
                              <span>{d.count}건 정산완료</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Weekly Breakdown */}
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider flex items-center justify-between">
                        <span>주별 매출 추이 (6월 누적)</span>
                        <span className="text-[10px] text-slate-500 font-mono">Weekly Trend</span>
                      </h4>
                      <div className="space-y-2">
                        {[
                          { week: '1주차 (6/1~6/7)', amount: Math.round(activeMRR / 4), status: '진행중 (정산중)', pct: 75, color: 'bg-indigo-500' },
                          { week: '5월 4주차', amount: Math.round(activeMRR / 4 - 30000), status: '징수 완료', pct: 95, color: 'bg-slate-500' },
                          { week: '5월 3주차', amount: Math.round(activeMRR / 4 + 50000), status: '징수 완료', pct: 100, color: 'bg-slate-500' },
                          { week: '5월 2주차', amount: Math.round(activeMRR / 4 - 10000), status: '징수 완료', pct: 90, color: 'bg-slate-500' }
                        ].map((w, i) => (
                          <div key={i} className="bg-[#0B0F19]/40 p-2.5 rounded-lg border border-[#1E293B]/30 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-bold text-slate-355">{w.week}</span>
                              <span className="font-mono text-indigo-400 font-bold">{w.amount.toLocaleString()}원</span>
                            </div>
                            <div className="w-full bg-[#1E293B]/40 h-1.5 rounded overflow-hidden">
                              <div className={`${w.color} h-full rounded-full`} style={{ width: `${w.pct}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                              <span>상태: {w.status}</span>
                              <span>실적 보정 완료</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Monthly Breakdown */}
                    <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider flex items-center justify-between">
                        <span>월별 매출 추이 (최근 5개월)</span>
                        <span className="text-[10px] text-slate-500 font-mono">Monthly Trend</span>
                      </h4>
                      <div className="space-y-2">
                        {[
                          { month: '6월 (현재 기준)', amount: activeMRR, count: billingActiveLawyers.length, pct: 100, color: 'from-indigo-650 to-brand' },
                          { month: '5월', amount: Math.max(3000000, activeMRR - 300000), count: Math.max(1, billingActiveLawyers.length - 1), pct: 90, color: 'from-slate-700 to-slate-650' },
                          { month: '4월', amount: Math.max(3000000, activeMRR - 600000), count: Math.max(1, billingActiveLawyers.length - 2), pct: 85, color: 'from-slate-700 to-slate-650' },
                          { month: '3월', amount: Math.max(3000000, activeMRR - 900000), count: Math.max(1, billingActiveLawyers.length - 3), pct: 78, color: 'from-slate-700 to-slate-650' },
                          { month: '2월', amount: Math.max(3000000, activeMRR - 1200000), count: Math.max(1, billingActiveLawyers.length - 4), pct: 70, color: 'from-slate-700 to-slate-650' }
                        ].map((m, i) => (
                          <div key={i} className="bg-[#0B0F19]/40 p-2.5 rounded-lg border border-[#1E293B]/30 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-bold text-slate-355">{m.month}</span>
                              <span className="font-mono text-white font-black">{m.amount.toLocaleString()}원</span>
                            </div>
                            <div className="w-full bg-[#1E293B]/40 h-1.5 rounded overflow-hidden">
                              <div className={`bg-gradient-to-r ${m.color} h-full rounded-full`} style={{ width: `${m.pct}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                              <span>활성 구독 파트너 {m.count}명</span>
                              <span>수납률 100%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ACTIVE SUBSCRIBERS BILLING SUBTAB */}
              {billingSubTab === 'active' && (
                <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">구독료 징수 현황 명세 (활성 파트너)</h3>
                    <span className="text-[10px] text-slate-400 font-mono">총 {billingActiveLawyers.length}명 대리인 활성 구독 중</span>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-[#1E293B]/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">정산 대상 변호사</th>
                          <th className="p-3">구독료 멤버십</th>
                          <th className="p-3">월 고정 징수액</th>
                          <th className="p-3">수납 상태</th>
                          <th className="p-3 text-right">플랫폼 매칭 참여 실적</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/30">
                        {paginatedActiveBilling.map(l => {
                          let planName = 'Basic';
                          let planPrice = '300,000 원';
                          if (l.matchedCount > 120) {
                            planName = 'Team / Enterprise';
                            planPrice = '1,500,000 원';
                          } else if (l.matchedCount > 80) {
                            planName = 'Pro';
                            planPrice = '800,000 원';
                          }
                          return (
                            <tr key={l.id} className="hover:bg-[#0B0F19]/20 transition-colors">
                              <td className="p-3 font-bold text-white flex items-center gap-1.5">
                                <img src={l.avatar} alt={l.name} className="w-5 h-5 rounded-full object-cover" />
                                <span>{l.name}</span>
                              </td>
                              <td className="p-3">{planName}</td>
                              <td className="p-3 font-semibold text-indigo-400">{planPrice}</td>
                              <td className="p-3">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded flex items-center gap-1 w-max">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>정상수납</span>
                                </span>
                              </td>
                              <td className="p-3 text-right text-slate-350">{l.matchedCount}회 매칭참여</td>
                            </tr>
                          );
                        })}

                        {billingActiveLawyers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 bg-[#111622]/50 font-semibold">
                              현재 활성화된 과금 대상 대리인이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Billing List Pagination Controls */}
                  {totalBillingPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#161B26] border-t border-[#1E293B]/60 text-xs">
                      <span className="text-slate-400 font-mono">
                        Page {currentBillingPage} of {totalBillingPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={currentBillingPage === 1}
                          onClick={() => setBillingPage(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          이전
                        </button>
                        {Array.from({ length: totalBillingPages }).map((_, i) => {
                          const p = i + 1;
                          return (
                            <button
                              key={p}
                              onClick={() => setBillingPage(p)}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                currentBillingPage === p
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                        <button
                          disabled={currentBillingPage === totalBillingPages}
                          onClick={() => setBillingPage(prev => Math.min(totalBillingPages, prev + 1))}
                          className="px-2.5 py-1 rounded bg-[#0B0F19] text-slate-350 hover:text-white border border-[#1E293B]/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          다음
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* EXITED/SUSPENDED BILLING SUBTAB */}
              {billingSubTab === 'exited' && (
                <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <div className="space-y-1 text-left">
                    <h3 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">이탈 및 정지 대리인 정산조정 명세</h3>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      정지, 탈퇴, 휴면 처리되어 정상적인 구독이 중단된 대리인 명단입니다. 일할 정산(환불/조정) 금액이 자동 계산됩니다.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#1E293B]/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">대리인 성명</th>
                          <th className="p-3">상태</th>
                          <th className="p-3">중단 일자 (마지막 활동)</th>
                          <th className="p-3">구독 정보</th>
                          <th className="p-3 text-right">환불 정산 조정액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/30">
                        {billingExitedLawyers.map(m => {
                          const matchingLawyer = lawyers.find(l => l.id === m.id);
                          const matchedCount = matchingLawyer ? matchingLawyer.matchedCount : 0;
                          
                          let planName = 'Basic (300,000원)';
                          let lostAmount = 300000;
                          if (matchedCount > 120) {
                            planName = 'Team (1,500,000원)';
                            lostAmount = 1500000;
                          } else if (matchedCount > 80) {
                            planName = 'Pro (800,000원)';
                            lostAmount = 800000;
                          }

                          // Prorated refund estimation:
                          // If lastActiveAt is set, we estimate how many days were used in the exit month.
                          // Say 15 days used on average -> 50% refund.
                          const exitDateStr = m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleDateString() : 'N/A';
                          const refundAmount = Math.round(lostAmount * 0.5); // 50% pro-rated refund

                          return (
                            <tr key={m.id} className="hover:bg-[#0B0F19]/20 transition-colors">
                              <td className="p-3 font-bold text-white flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-extrabold text-slate-350">
                                  {m.alias.charAt(0)}
                                </div>
                                <span>{m.alias}</span>
                              </td>
                              <td className="p-3">
                                <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                                  m.status === 'suspended' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  m.status === 'withdrawn' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-slate-800 text-slate-400 border-slate-750'
                                }`}>
                                  {m.status === 'suspended' ? '자격 정지' : m.status === 'withdrawn' ? '영구 탈퇴' : '휴면 전환'}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-400">{exitDateStr}</td>
                              <td className="p-3 text-slate-350">{planName}</td>
                              <td className="p-3 text-right font-bold text-red-400">
                                -{refundAmount.toLocaleString()} 원
                              </td>
                            </tr>
                          );
                        })}

                        {billingExitedLawyers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 bg-[#111622]/50 font-semibold">
                              최근 3개월 이내에 정지되거나 이탈한 대리인이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
  
            {/* TAB 5: SITE CONTENT CRUD OPERATIONS */}
            {activeTab === 'contents' && (
            <div className="space-y-6 animate-fadeIn text-left">
              
              {/* Header card */}
              <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900/40 p-6 rounded-2xl border border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div className="space-y-1">
                  <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">PLATFORM MULTI-CONTENT CONTROL PANEL</span>
                  <h2 className="text-xl font-black text-white">통합 사이트 콘텐츠 CRUD 제어 센터</h2>
                  <p className="text-xs text-slate-400">의뢰인 전용 페이지의 주요 칼럼 기사, 고민사례 Q&A, 실제 해결 성공후기, 메인 캐러셀 배너를 실시간 제어합니다.</p>
                </div>
                
                {/* New Content Create Button tailored to active subtab */}
                {contentSubTab === 'news' && !isCreateMode && !editingArticle && (
                  <button 
                    onClick={() => {
                      setIsCreateMode(true);
                      setEditingArticle(null);
                      setFormTitle('');
                      setFormExcerpt('');
                      setFormContent('');
                      setFormCategory('개인회생');
                      setFormBadge(null);
                      setFormAuthorId(lawyers[0]?.id || 'lawyer-1');
                      setFormImageUrl('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=600');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 법률 칼럼 등록</span>
                  </button>
                )}

                {contentSubTab === 'qna' && !isQaCreateMode && !editingQa && (
                  <button 
                    onClick={() => {
                      setIsQaCreateMode(true);
                      setEditingQa(null);
                      setQaQuestion('');
                      setQaAnswer('');
                      setQaCategory('코인/주식 손실');
                      setQaAuthor('');
                      setQaLawyerId(lawyers[0]?.id || 'lawyer-1');
                      setQaBadge('추천 답변');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 고민 상담사례 등록</span>
                  </button>
                )}

                {contentSubTab === 'reviews' && !isReviewCreateMode && !editingReview && (
                  <button 
                    onClick={() => {
                      setIsReviewCreateMode(true);
                      setEditingReview(null);
                      setReviewTitle('');
                      setReviewCategory('코인/주식 손실');
                      setReviewAuthor('');
                      setReviewOriginalDebt(5000);
                      setReviewRemainingDebt(1000);
                      setReviewLawyerId(lawyers[0]?.id || 'lawyer-1');
                      setReviewContent('');
                      setReviewTagsText('');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 해결 성공후기 등록</span>
                  </button>
                )}

                {contentSubTab === 'banner' && !isBannerCreateMode && !editingBanner && (
                  <button 
                    onClick={() => {
                      setIsBannerCreateMode(true);
                      setEditingBanner(null);
                      setBannerTitle('');
                      setBannerSubtitle('');
                      setBannerBadge('');
                      setBannerColor('rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)');
                      setBannerImage('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 메인 배너 등록</span>
                  </button>
                )}

                {contentSubTab === 'notice' && !isNoticeCreateMode && !editingNotice && (
                  <button 
                    onClick={() => {
                      setIsNoticeCreateMode(true);
                      setEditingNotice(null);
                      setNoticeTitle('');
                      setNoticeContent('');
                      setNoticeIsImportant(false);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 공지사항 등록</span>
                  </button>
                )}
              </div>

              {/* Sub-tab navigation */}
              <div className="flex border-b border-[#1E293B]/60 pb-3 gap-6 text-xs font-bold text-slate-400">
                <button 
                  onClick={() => { setContentSubTab('news'); setIsCreateMode(false); setEditingArticle(null); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'news' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  📰 법률 칼럼 기사 관리
                </button>
                <button 
                  onClick={() => { setContentSubTab('qna'); setIsQaCreateMode(false); setEditingQa(null); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'qna' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  💬 고민 상담사례 관리
                </button>
                <button 
                  onClick={() => { setContentSubTab('reviews'); setIsReviewCreateMode(false); setEditingReview(null); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'reviews' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  🏆 해결 성공후기 관리
                </button>
                <button 
                  onClick={() => { setContentSubTab('banner'); setIsBannerCreateMode(false); setEditingBanner(null); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'banner' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  🖼️ 메인 배너 캐러셀 관리
                </button>
                <button 
                  onClick={() => { setContentSubTab('notice'); setIsNoticeCreateMode(false); setEditingNotice(null); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'notice' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  📢 공지사항 관리
                </button>
                <button 
                  onClick={() => { setContentSubTab('inquiry'); setSelectedInquiryId(''); setReplyText(''); }}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'inquiry' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  🙋 1:1 문의 내역 관리
                </button>
                <button 
                  onClick={() => setContentSubTab('diagnosis')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${contentSubTab === 'diagnosis' ? 'border-indigo-500 text-indigo-400 font-extrabold' : 'border-transparent hover:text-white'}`}
                >
                  🧪 진단 문항 관리
                </button>
              </div>

              {/* 1. NEWS ARTICLE CRUD SECTION */}
              {contentSubTab === 'news' && (
                <div className="space-y-6">
                  {/* Creator / Editor Form Panel */}
                  {(isCreateMode || editingArticle) && (
                    <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                      <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>{isCreateMode ? '신규 법률 정보 아티클 등록' : '법률 정보 아티클 수정'}</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">카테고리 분야</label>
                          <select 
                            value={formCategory} 
                            onChange={(e) => setFormCategory(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            <option value="개인회생">개인회생</option>
                            <option value="개인파산">개인파산</option>
                            <option value="금지명령/추심">금지명령/추심</option>
                            <option value="변제금/생계비">변제금/생계비</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">노출용 태그 배지</label>
                          <select 
                            value={formBadge || ''} 
                            onChange={(e) => setFormBadge((e.target.value as any) || null)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            <option value="">배지 없음</option>
                            <option value="HOT">HOT (오렌지)</option>
                            <option value="NEW">NEW (인디고)</option>
                            <option value="BEST">BEST (에메랄드)</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">칼럼 제목</label>
                          <input 
                            type="text" 
                            placeholder="이목을 끄는 굵직하고 신뢰감 높은 제목을 입력하세요"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 placeholder-slate-650"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">작성 변호사 지정</label>
                          <select 
                            value={formAuthorId} 
                            onChange={(e) => setFormAuthorId(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            {lawyers.filter(l => l.role === 'LAWYER').map(l => (
                              <option key={l.id} value={l.id}>{l.name} ({l.region})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">대표 커버 이미지 URL</label>
                          <input 
                            type="text" 
                            placeholder="대표 이미지 unsplash URL 입력"
                            value={formImageUrl}
                            onChange={(e) => setFormImageUrl(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">기사 요약 요약문 (Excerpt)</label>
                          <input 
                            type="text" 
                            placeholder="목록 화면에 노출될 2줄 이내의 매력적인 한글 요약문을 작성하세요"
                            value={formExcerpt}
                            onChange={(e) => setFormExcerpt(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 placeholder-slate-655"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">칼럼 상세 법률 본문 (HTML/Markdown 줄 바꿈 지원)</label>
                          <textarea 
                            rows={8}
                            placeholder="의뢰인에게 해결 방안을 명확히 안내하는 고품격 전문 법률 본문 원고를 작성하세요."
                            value={formContent}
                            onChange={(e) => setFormContent(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3.5 text-slate-200 placeholder-slate-655 font-normal leading-relaxed text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => {
                            setIsCreateMode(false);
                            setEditingArticle(null);
                          }}
                          className="bg-[#161B26] hover:bg-[#202738] text-slate-400 font-extrabold px-5 py-2.5 rounded-[200px] text-xs transition-colors cursor-pointer"
                        >
                          취소하기
                        </button>
                        <button 
                          onClick={() => {
                            if (!formTitle.trim() || !formContent.trim() || !formExcerpt.trim()) {
                              alert('기사 제목, 요약문, 상세 본문 내용을 모두 기입해 주세요.');
                              return;
                            }
                            const targetLawyer = lawyers.find(l => l.id === formAuthorId) || lawyers[0];
                            if (isCreateMode) {
                              const newArt: NewsArticle = {
                                id: `news-${Date.now()}`,
                                title: formTitle.trim(),
                                excerpt: formExcerpt.trim(),
                                content: formContent.trim(),
                                category: formCategory,
                                badge: formBadge,
                                authorId: formAuthorId,
                                authorName: targetLawyer.name,
                                authorAvatar: targetLawyer.avatar,
                                views: 0,
                                date: new Date().toISOString().split('T')[0],
                                imageUrl: formImageUrl.trim() || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=600'
                              };
                              setNewsArticles(prev => [newArt, ...prev]);
                              alert('신규 법률 기사가 성공적으로 게재 등록되었습니다!');
                            } else if (editingArticle) {
                              setNewsArticles(prev => prev.map(a => a.id === editingArticle.id ? {
                                ...a,
                                title: formTitle.trim(),
                                excerpt: formExcerpt.trim(),
                                content: formContent.trim(),
                                category: formCategory,
                                badge: formBadge,
                                authorId: formAuthorId,
                                authorName: targetLawyer.name,
                                authorAvatar: targetLawyer.avatar,
                                imageUrl: formImageUrl.trim() || a.imageUrl
                              } : a));
                              alert('법률 아티클 정보가 정상적으로 수정 반영되었습니다!');
                            }
                            setIsCreateMode(false);
                            setEditingArticle(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-6 py-2.5 rounded-[200px] text-xs transition-all shadow-sm cursor-pointer"
                        >
                          {isCreateMode ? '✍️ 기사 영구 발행' : '💾 변경 사항 저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Contents Table Data Grid */}
                  <div className="bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">커버</th>
                            <th className="p-3">기사 분류</th>
                            <th className="p-3">법률 아티클 기사명</th>
                            <th className="p-3">집필 대리인</th>
                            <th className="p-3">조회수</th>
                            <th className="p-3">게재일</th>
                            <th className="p-3 text-right">콘텐츠 조율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {newsArticles.map(art => (
                            <tr key={art.id} className="hover:bg-[#0B0F19]/25 transition-colors">
                              <td className="p-3">
                                <img 
                                  src={art.imageUrl} 
                                  alt={art.title} 
                                  className="w-10 h-6 object-cover rounded-md border border-[#1E293B]/45" 
                                />
                              </td>
                              <td className="p-3">
                                <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded border ${
                                  art.category === '개인회생' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  art.category === '개인파산' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  art.category === '금지명령/추심' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {art.category}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-100 max-w-[200px] truncate leading-normal">
                                <div className="flex items-center gap-1.5">
                                  {art.badge && (
                                    <span className={`text-[7px] font-black px-1 rounded-sm text-white ${
                                      art.badge === 'HOT' ? 'bg-orange-500' :
                                      art.badge === 'NEW' ? 'bg-indigo-600' : 'bg-emerald-600'
                                    }`}>
                                      {art.badge}
                                    </span>
                                  )}
                                  <span>{art.title}</span>
                                </div>
                              </td>
                              <td className="p-3 font-bold text-slate-300">By {art.authorName}</td>
                              <td className="p-3 text-slate-400">{art.views.toLocaleString()}회</td>
                              <td className="p-3 font-mono text-slate-450">{art.date}</td>
                              <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                                <button 
                                  onClick={() => {
                                    setEditingArticle(art);
                                    setIsCreateMode(false);
                                    setFormTitle(art.title);
                                    setFormExcerpt(art.excerpt);
                                    setFormContent(art.content);
                                    setFormCategory(art.category);
                                    setFormBadge(art.badge);
                                    setFormAuthorId(art.authorId);
                                    setFormImageUrl(art.imageUrl);
                                  }}
                                  className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  수정
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm(`[${art.title}] 법률 기사를 영구 삭제 처리하시겠습니까?`)) {
                                      setNewsArticles(prev => prev.filter(a => a.id !== art.id));
                                      alert('해당 아티클 기사가 플랫폼에서 전면 영구 삭제 처리되었습니다.');
                                    }
                                  }}
                                  className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}

                          {newsArticles.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                                게재된 법률 기사 정보가 존재하지 않습니다. 새로운 기사를 작성하여 게시해 보십시오.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CLIENT Q&A CRUD SECTION */}
              {contentSubTab === 'qna' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Creator / Editor Form Panel */}
                  {(isQaCreateMode || editingQa) && (
                    <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                      <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>{isQaCreateMode ? '신규 고민 상담사례 등록' : '고민 상담사례 수정'}</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">카테고리 분야</label>
                          <select 
                            value={qaCategory} 
                            onChange={(e) => setQaCategory(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            <option value="코인/주식 손실">코인/주식 손실</option>
                            <option value="급여 압류">급여 압류</option>
                            <option value="프리랜서 회생">프리랜서 회생</option>
                            <option value="배우자 재산">배우자 재산</option>
                            <option value="전세사기 피해">전세사기 피해</option>
                            <option value="최근 대출 회생">최근 대출 회생</option>
                            <option value="자영업자 회생">자영업자 회생</option>
                            <option value="전문직 면허보존">전문직 면허보존</option>
                            <option value="추심 차단">추심 차단</option>
                            <option value="개인파산 면책">개인파산 면책</option>
                            <option value="일용직 소득증빙">일용직 소득증빙</option>
                            <option value="보정권고 지연">보정권고 지연</option>
                            <option value="해외선물/주식">해외선물/주식</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">노출용 상담사례 배지</label>
                          <input 
                            type="text" 
                            placeholder="예: 추천 답변, 실시간 답변, 전문가 소견 등"
                            value={qaBadge}
                            onChange={(e) => setQaBadge(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">의뢰 가명 작성자</label>
                          <input 
                            type="text" 
                            placeholder="예: 김*현 (직장인)"
                            value={qaAuthor}
                            onChange={(e) => setQaAuthor(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">대표 집필 변호사</label>
                          <select 
                            value={qaLawyerId} 
                            onChange={(e) => setQaLawyerId(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            {lawyers.filter(l => l.role === 'LAWYER').map(l => (
                              <option key={l.id} value={l.id}>{l.name} ({l.region})</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">의뢰인 질문 (Question)</label>
                          <input 
                            type="text" 
                            placeholder="의뢰인의 핵심 고민 질문 내용을 입력하세요"
                            value={qaQuestion}
                            onChange={(e) => setQaQuestion(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">변호사 답변 상세 (Answer)</label>
                          <textarea 
                            rows={6}
                            placeholder="변호사의 친절하고 논리정연한 법률 검토 답변을 입력하세요."
                            value={qaAnswer}
                            onChange={(e) => setQaAnswer(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => {
                            setIsQaCreateMode(false);
                            setEditingQa(null);
                          }}
                          className="bg-[#161B26] hover:bg-[#202738] text-slate-400 font-extrabold px-5 py-2.5 rounded-[200px] text-xs transition-colors cursor-pointer"
                        >
                          취소하기
                        </button>
                        <button 
                          onClick={() => {
                            if (!qaQuestion.trim() || !qaAnswer.trim() || !qaAuthor.trim()) {
                              alert('질문, 답변 및 의뢰인 작성자 가명을 모두 기입해 주세요.');
                              return;
                            }
                            const targetLawyer = lawyers.find(l => l.id === qaLawyerId) || lawyers[0];
                            if (isQaCreateMode) {
                              const newQa: ClientQA = {
                                id: `qa-${Date.now()}`,
                                category: qaCategory,
                                question: qaQuestion.trim(),
                                author: qaAuthor.trim(),
                                answer: qaAnswer.trim(),
                                lawyerName: targetLawyer.name,
                                lawyerAvatar: targetLawyer.avatar,
                                badge: qaBadge.trim() || '실시간 답변'
                              };
                              setQas(prev => [newQa, ...prev]);
                              alert('새로운 상담사례 Q&A가 정상 등록되었습니다!');
                            } else if (editingQa) {
                              setQas(prev => prev.map(q => q.id === editingQa.id ? {
                                ...q,
                                category: qaCategory,
                                question: qaQuestion.trim(),
                                author: qaAuthor.trim(),
                                answer: qaAnswer.trim(),
                                lawyerName: targetLawyer.name,
                                lawyerAvatar: targetLawyer.avatar,
                                badge: qaBadge.trim() || q.badge
                              } : q));
                              alert('상담사례 정보가 성공적으로 변경되었습니다!');
                            }
                            setIsQaCreateMode(false);
                            setEditingQa(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-6 py-2.5 rounded-[200px] text-xs transition-all shadow-sm cursor-pointer"
                        >
                          {isQaCreateMode ? '✍️ 상담사례 발행' : '💾 변경 사항 저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Q&A Data Grid */}
                  <div className="bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">분류</th>
                            <th className="p-3">질문 헤드라인</th>
                            <th className="p-3">의뢰 가명</th>
                            <th className="p-3">답변인</th>
                            <th className="p-3">배지</th>
                            <th className="p-3 text-right">콘텐츠 조율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {qas.map(qa => (
                            <tr key={qa.id} className="hover:bg-[#0B0F19]/25 transition-colors">
                              <td className="p-3 shrink-0 whitespace-nowrap">
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-extrabold px-2 py-0.5 rounded">
                                  {qa.category}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-100 max-w-[200px] truncate">{qa.question}</td>
                              <td className="p-3 text-slate-400">{qa.author}</td>
                              <td className="p-3 text-slate-300 font-bold">{qa.lawyerName}</td>
                              <td className="p-3">
                                <span className="bg-slate-800 text-slate-400 text-[8px] px-1.5 py-0.2 rounded font-semibold border border-slate-700">
                                  {qa.badge}
                                </span>
                              </td>
                              <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                                <button 
                                  onClick={() => {
                                    setEditingQa(qa);
                                    setIsQaCreateMode(false);
                                    setQaQuestion(qa.question);
                                    setQaAnswer(qa.answer);
                                    setQaCategory(qa.category);
                                    setQaAuthor(qa.author);
                                    setQaBadge(qa.badge);
                                    const matchingLawyer = lawyers.find(l => l.name === qa.lawyerName);
                                    setQaLawyerId(matchingLawyer ? matchingLawyer.id : (lawyers[0]?.id || 'lawyer-1'));
                                  }}
                                  className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  수정
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm(`고민사례 [${qa.question}] 건을 영구 삭제 처리하시겠습니까?`)) {
                                      setQas(prev => prev.filter(q => q.id !== qa.id));
                                      alert('해당 상담사례 데이터가 플랫폼에서 영구 배제 삭제되었습니다.');
                                    }
                                  }}
                                  className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}

                          {qas.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                                등록된 실시간 고민 Q&A 데이터가 없습니다. 새로운 상담사례를 등록해 주세요.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SUCCESS REVIEWS CRUD SECTION */}
              {contentSubTab === 'reviews' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Creator / Editor Form Panel */}
                  {(isReviewCreateMode || editingReview) && (
                    <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                      <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>{isReviewCreateMode ? '신규 채무 해결 성공후기 등록' : '채무 해결 성공후기 수정'}</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">후기 대리인 변호사</label>
                          <select 
                            value={reviewLawyerId} 
                            onChange={(e) => setReviewLawyerId(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            {lawyers.filter(l => l.role === 'LAWYER').map(l => (
                              <option key={l.id} value={l.id}>{l.name} ({l.region})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">의뢰 분야 카테고리</label>
                          <select 
                            value={reviewCategory} 
                            onChange={(e) => setReviewCategory(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          >
                            <option value="코인/주식 손실">코인/주식 손실</option>
                            <option value="신용카드 연체">신용카드 연체</option>
                            <option value="개인파산">개인파산</option>
                            <option value="연대보증 채무">연대보증 채무</option>
                            <option value="프리랜서 회생">프리랜서 회생</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">의뢰인 가명 및 인적 (Author)</label>
                          <input 
                            type="text" 
                            placeholder="예: 홍*동 님 (30대 직장인)"
                            value={reviewAuthor}
                            onChange={(e) => setReviewAuthor(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">기존 채무총액 (원금, 만 원 단위)</label>
                          <input 
                            type="number" 
                            placeholder="예: 8000"
                            value={reviewOriginalDebt}
                            onChange={(e) => setReviewOriginalDebt(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">조정 후 갚을 원금 (만 원 단위, 파산 면책은 0)</label>
                          <input 
                            type="number" 
                            placeholder="예: 1200"
                            value={reviewRemainingDebt}
                            onChange={(e) => setReviewRemainingDebt(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">해시태그 키워드들 (쉼표로 구분 입력)</label>
                          <input 
                            type="text" 
                            placeholder="예: #코인실패, #추심동결, #탕감율85%"
                            value={reviewTagsText}
                            onChange={(e) => setReviewTagsText(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 placeholder-slate-600"
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">성공후기 매력적인 제목</label>
                          <input 
                            type="text" 
                            placeholder="의뢰인의 극적인 탕감 성과를 한눈에 보여주는 임팩트 있는 제목"
                            value={reviewTitle}
                            onChange={(e) => setReviewTitle(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">성공후기 상세 서술 원고 (Content)</label>
                          <textarea 
                            rows={6}
                            placeholder="사건 수임 전 빚 독촉 상황, 소명 방향성, 탕감 성과 및 최종 대리인에 대한 감사 내용 등을 실감나게 서술하세요."
                            value={reviewContent}
                            onChange={(e) => setReviewContent(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => {
                            setIsReviewCreateMode(false);
                            setEditingReview(null);
                          }}
                          className="bg-[#161B26] hover:bg-[#202738] text-slate-400 font-extrabold px-5 py-2.5 rounded-[200px] text-xs transition-colors cursor-pointer"
                        >
                          취소하기
                        </button>
                        <button 
                          onClick={() => {
                            if (!reviewTitle.trim() || !reviewContent.trim() || !reviewAuthor.trim()) {
                              alert('후기 제목, 내용 및 의뢰인 작성자명을 모두 기입해 주세요.');
                              return;
                            }
                            const targetLawyer = lawyers.find(l => l.id === reviewLawyerId) || lawyers[0];
                            const cleanTags = reviewTagsText.trim()
                              ? reviewTagsText.split(/[,，\s]+/).map(t => t.startsWith('#') ? t.trim() : `#${t.trim()}`).filter(t => t !== '#')
                              : ["#도산성공", "#부채탕감"];

                            if (isReviewCreateMode) {
                              const newRev: SuccessReview = {
                                id: `rev-${Date.now()}`,
                                title: reviewTitle.trim(),
                                category: reviewCategory,
                                author: reviewAuthor.trim(),
                                originalDebt: reviewOriginalDebt,
                                remainingDebt: reviewRemainingDebt,
                                lawyerId: reviewLawyerId,
                                lawyerName: targetLawyer.name,
                                lawyerAvatar: targetLawyer.avatar,
                                content: reviewContent.trim(),
                                tags: cleanTags
                              };
                              setReviews(prev => [newRev, ...prev]);
                              alert('새로운 도산 성공후기가 공식 게재되었습니다!');
                            } else if (editingReview) {
                              setReviews(prev => prev.map(r => r.id === editingReview.id ? {
                                ...r,
                                title: reviewTitle.trim(),
                                category: reviewCategory,
                                author: reviewAuthor.trim(),
                                originalDebt: reviewOriginalDebt,
                                remainingDebt: reviewRemainingDebt,
                                lawyerId: reviewLawyerId,
                                lawyerName: targetLawyer.name,
                                lawyerAvatar: targetLawyer.avatar,
                                content: reviewContent.trim(),
                                tags: cleanTags
                              } : r));
                              alert('성공후기 정보가 성공적으로 수정되었습니다!');
                            }
                            setIsReviewCreateMode(false);
                            setEditingReview(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-6 py-2.5 rounded-[200px] text-xs transition-all shadow-sm cursor-pointer"
                        >
                          {isReviewCreateMode ? '✍️ 성공후기 게재' : '💾 변경 사항 저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reviews Data Grid */}
                  <div className="bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">후기 분류</th>
                            <th className="p-3">성공후기 제목 헤드라인</th>
                            <th className="p-3">채무 탕감 실적 (전/후)</th>
                            <th className="p-3">수임 대리인</th>
                            <th className="p-3">의뢰 가명</th>
                            <th className="p-3">키워드 태그</th>
                            <th className="p-3 text-right">콘텐츠 조율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {reviews.map(rev => {
                            const isTotalFree = rev.remainingDebt === 0;
                            const cutPct = Math.round(((rev.originalDebt - rev.remainingDebt) / rev.originalDebt) * 100);
                            return (
                              <tr key={rev.id} className="hover:bg-[#0B0F19]/25 transition-colors">
                                <td className="p-3 shrink-0 whitespace-nowrap">
                                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-extrabold px-2 py-0.5 rounded">
                                    {rev.category}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-slate-100 max-w-[200px] truncate">
                                  <div className="flex flex-col gap-0.5">
                                    <span>{rev.title}</span>
                                    <span className="text-[10px] text-emerald-400 font-bold font-mono">원금 {cutPct}% 면제</span>
                                  </div>
                                </td>
                                <td className="p-3 font-bold text-slate-200 font-mono">
                                  {rev.originalDebt.toLocaleString()}만 ➔ {isTotalFree ? '100% 탕감(전액면제)' : `${rev.remainingDebt.toLocaleString()}만`}
                                </td>
                                <td className="p-3 text-slate-350">{rev.lawyerName}</td>
                                <td className="p-3 text-slate-450">{rev.author}</td>
                                <td className="p-3 max-w-[120px] truncate text-[9px] text-slate-455">
                                  {rev.tags.join(' ')}
                                </td>
                                <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                                  <button 
                                    onClick={() => {
                                      setEditingReview(rev);
                                      setIsReviewCreateMode(false);
                                      setReviewTitle(rev.title);
                                      setReviewCategory(rev.category);
                                      setReviewAuthor(rev.author);
                                      setReviewOriginalDebt(rev.originalDebt);
                                      setReviewRemainingDebt(rev.remainingDebt);
                                      setReviewLawyerId(rev.lawyerId);
                                      setReviewContent(rev.content);
                                      setReviewTagsText(rev.tags.join(', '));
                                    }}
                                    className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                  >
                                    수정
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm(`성공후기 [${rev.title}] 건을 영구 삭제 처리하시겠습니까?`)) {
                                        setReviews(prev => prev.filter(r => r.id !== rev.id));
                                        alert('해당 성공후기 포스트가 영구 삭제 처리되었습니다.');
                                      }
                                    }}
                                    className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                  >
                                    삭제
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {reviews.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                                등록된 채무 해결 성공후기 콘텐츠가 없습니다. 새로운 리얼 후기를 등록해 보세요.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. MAIN BANNER CRUD SECTION */}
              {contentSubTab === 'banner' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Creator / Editor Form Panel */}
                  {(isBannerCreateMode || editingBanner) && (
                    <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                      <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>{isBannerCreateMode ? '신규 메인배너 등록' : '메인배너 수정'}</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">노출용 얇은 배지명</label>
                          <input 
                            type="text" 
                            placeholder="예: 신속한 독촉 차단, 투자 실패 전문 등"
                            value={bannerBadge}
                            onChange={(e) => setBannerBadge(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">배너 백그라운드 그라데이션 색상 (CSS gradient 값)</label>
                          <input 
                            type="text" 
                            placeholder="예: rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)"
                            value={bannerColor}
                            onChange={(e) => setBannerColor(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 font-mono text-[11px]"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">배너 굵은 제목</label>
                          <input 
                            type="text" 
                            placeholder="예: 빚 독촉의 고통, 오늘 끊을 수 있습니다."
                            value={bannerTitle}
                            onChange={(e) => setBannerTitle(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">배너 커버 이미지 unsplash 주소</label>
                          <input 
                            type="text" 
                            placeholder="예: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?..."
                            value={bannerImage}
                            onChange={(e) => setBannerImage(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">배너 상세 설명 부제</label>
                          <textarea 
                            rows={3}
                            placeholder="배너 타이틀 아래에 출력될 2줄 분량의 호소력 짙은 문장을 작성해 주세요."
                            value={bannerSubtitle}
                            onChange={(e) => setBannerSubtitle(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3.5 text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => {
                            setIsBannerCreateMode(false);
                            setEditingBanner(null);
                          }}
                          className="bg-[#161B26] hover:bg-[#202738] text-slate-400 font-extrabold px-5 py-2.5 rounded-[200px] text-xs transition-colors cursor-pointer"
                        >
                          취소하기
                        </button>
                        <button 
                          onClick={() => {
                            if (!bannerTitle.trim() || !bannerSubtitle.trim()) {
                              alert('배너 제목과 부제 설명을 작성해 주세요.');
                              return;
                            }
                            if (isBannerCreateMode) {
                              const newBann: MainBanner = {
                                id: `banner-${Date.now()}`,
                                title: bannerTitle.trim(),
                                subtitle: bannerSubtitle.trim(),
                                badge: bannerBadge.trim() || '이벤트 배너',
                                color: bannerColor.trim() || 'rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)',
                                image: bannerImage.trim() || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200'
                              };
                              setBanners(prev => [...prev, newBann]);
                              alert('새로운 메인 배너 캐러셀 슬라이드가 추가 등록되었습니다!');
                            } else if (editingBanner) {
                              setBanners(prev => prev.map(b => b.id === editingBanner.id ? {
                                ...b,
                                title: bannerTitle.trim(),
                                subtitle: bannerSubtitle.trim(),
                                badge: bannerBadge.trim() || b.badge,
                                color: bannerColor.trim() || b.color,
                                image: bannerImage.trim() || b.image
                              } : b));
                              alert('메인 배너 캐러셀 설정이 완료되었습니다!');
                            }
                            setIsBannerCreateMode(false);
                            setEditingBanner(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-6 py-2.5 rounded-[200px] text-xs transition-all shadow-sm cursor-pointer"
                        >
                          {isBannerCreateMode ? '✍️ 배너 등록' : '💾 변경 사항 저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Banners Data Grid */}
                  <div className="bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">배경 썸네일</th>
                            <th className="p-3">태그</th>
                            <th className="p-3">배너 헤드라인 대문구</th>
                            <th className="p-3">설명 소문구</th>
                            <th className="p-3">백그라운드 그라데이션 필터</th>
                            <th className="p-3 text-right">콘텐츠 조율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {banners.map(bann => (
                            <tr key={bann.id} className="hover:bg-[#0B0F19]/25 transition-colors">
                              <td className="p-3">
                                <img 
                                  src={bann.image} 
                                  alt={bann.title} 
                                  className="w-12 h-8 object-cover rounded-md border border-[#1E293B]/45" 
                                />
                              </td>
                              <td className="p-3">
                                <span className="bg-slate-800 text-slate-350 text-[9px] px-2 py-0.5 rounded border border-slate-700 font-semibold whitespace-nowrap">
                                  {bann.badge}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-100 max-w-[150px] truncate">{bann.title}</td>
                              <td className="p-3 text-slate-400 max-w-[150px] truncate">{bann.subtitle}</td>
                              <td className="p-3 font-mono text-[9px] text-slate-455 max-w-[120px] truncate">{bann.color}</td>
                              <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                                <button 
                                  onClick={() => {
                                    setEditingBanner(bann);
                                    setIsBannerCreateMode(false);
                                    setBannerTitle(bann.title);
                                    setBannerSubtitle(bann.subtitle);
                                    setBannerBadge(bann.badge);
                                    setBannerColor(bann.color);
                                    setBannerImage(bann.image);
                                  }}
                                  className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  수정
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm(`배너 [${bann.title}] 슬라이드를 영구 삭제하시겠습니까?`)) {
                                      setBanners(prev => prev.filter(b => b.id !== bann.id));
                                      alert('해당 배너 슬라이드가 캐러셀 회전에서 배제되었습니다.');
                                    }
                                  }}
                                  className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}

                          {banners.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                                게재된 캐러셀 배너가 존재하지 않습니다. 새로운 배너를 작성하여 활성화해 보십시오.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. NOTICE CRUD SECTION */}
              {contentSubTab === 'notice' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Creator / Editor Form Panel */}
                  {(isNoticeCreateMode || editingNotice) && (
                    <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                      <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>{isNoticeCreateMode ? '신규 공지사항 등록' : '공지사항 수정'}</span>
                      </h3>

                      <div className="grid grid-cols-1 gap-4 text-xs">
                        <div className="flex items-center gap-2 py-1">
                          <input 
                            type="checkbox" 
                            id="noticeIsImportant" 
                            checked={noticeIsImportant}
                            onChange={(e) => setNoticeIsImportant(e.target.checked)}
                            className="rounded border-[#1E293B] bg-[#07090E] text-[#6366f1] focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="noticeIsImportant" className="text-slate-350 select-none cursor-pointer font-bold">
                            🚨 중요 공지로 설정 (리스트 상단 중요 표시)
                          </label>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">공지사항 제목</label>
                          <input 
                            type="text" 
                            placeholder="공지사항 제목을 입력하세요"
                            value={noticeTitle}
                            onChange={(e) => setNoticeTitle(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-450 block uppercase font-bold">공지사항 상세 본문 (줄 바꿈 지원)</label>
                          <textarea 
                            rows={8}
                            placeholder="공지사항 상세 본문을 작성해 주세요."
                            value={noticeContent}
                            onChange={(e) => setNoticeContent(e.target.value)}
                            className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3.5 text-slate-200 font-normal leading-relaxed text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => {
                            setIsNoticeCreateMode(false);
                            setEditingNotice(null);
                          }}
                          className="bg-[#161B26] hover:bg-[#202738] text-slate-400 font-extrabold px-5 py-2.5 rounded-[200px] text-xs transition-colors cursor-pointer"
                        >
                          취소하기
                        </button>
                        <button 
                          onClick={() => {
                            if (!noticeTitle.trim() || !noticeContent.trim()) {
                              alert('공지사항 제목과 상세 본문을 모두 입력해 주세요.');
                              return;
                            }
                            if (isNoticeCreateMode) {
                              const newNotice: Notice = {
                                id: `notice-${Date.now()}`,
                                title: noticeTitle.trim(),
                                content: noticeContent.trim(),
                                date: new Date().toISOString().split('T')[0],
                                isImportant: noticeIsImportant,
                                views: 0
                              };
                              setNotices(prev => [newNotice, ...prev]);
                              alert('신규 공지사항이 성공적으로 등록되었습니다!');
                            } else if (editingNotice) {
                              setNotices(prev => prev.map(n => n.id === editingNotice.id ? {
                                ...n,
                                title: noticeTitle.trim(),
                                content: noticeContent.trim(),
                                isImportant: noticeIsImportant
                              } : n));
                              alert('공지사항이 성공적으로 수정되었습니다!');
                            }
                            setIsNoticeCreateMode(false);
                            setEditingNotice(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-6 py-2.5 rounded-[200px] text-xs transition-all shadow-sm cursor-pointer"
                        >
                          {isNoticeCreateMode ? '✍️ 공지 발행' : '💾 변경 사항 저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notices Table Data Grid */}
                  <div className="bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">중요 여부</th>
                            <th className="p-3">공지사항 제목</th>
                            <th className="p-3">조회수</th>
                            <th className="p-3">등록일</th>
                            <th className="p-3 text-right">콘텐츠 조율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {notices.map(notice => (
                            <tr key={notice.id} className="hover:bg-[#0B0F19]/25 transition-colors">
                              <td className="p-3">
                                <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded border ${
                                  notice.isImportant 
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                  {notice.isImportant ? '중요' : '일반'}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-100 max-w-[300px] truncate leading-normal">
                                {notice.title}
                              </td>
                              <td className="p-3 text-slate-400">{notice.views.toLocaleString()}회</td>
                              <td className="p-3 font-mono text-slate-450">{notice.date}</td>
                              <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                                <button 
                                  onClick={() => {
                                    setEditingNotice(notice);
                                    setIsNoticeCreateMode(false);
                                    setNoticeTitle(notice.title);
                                    setNoticeContent(notice.content);
                                    setNoticeIsImportant(notice.isImportant || false);
                                  }}
                                  className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  수정
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm(`[${notice.title}] 공지사항을 영구 삭제 처리하시겠습니까?`)) {
                                      setNotices(prev => prev.filter(n => n.id !== notice.id));
                                      alert('해당 공지사항이 영구 삭제되었습니다.');
                                    }
                                  }}
                                  className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}

                          {notices.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                                등록된 공지사항이 없습니다. 신규 공지사항을 작성해 보십시오.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. CLIENT 1:1 INQUIRY BOARD SECTION */}
              {contentSubTab === 'inquiry' && (() => {
                const selectedInq = inquiries.find(inq => inq.id === selectedInquiryId);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
                    
                    {/* Left Column: Inquiry List */}
                    <div className="lg:col-span-7 bg-[#111622] rounded-xl border border-[#1E293B]/60 overflow-hidden flex flex-col">
                      <div className="p-4 bg-[#161B26] border-b border-[#1E293B]/60 flex items-center justify-between">
                        <h4 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">의뢰인 1:1 문의 내역</h4>
                        <span className="text-[10px] text-slate-400">총 {inquiries.length}건</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#161B26]/30 text-slate-400 font-bold border-b border-[#1E293B]/60">
                              <th className="p-3">작성자</th>
                              <th className="p-3">문의 제목</th>
                              <th className="p-3">상태</th>
                              <th className="p-3 text-right">등록일</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B]/30">
                            {inquiries.map(inq => {
                              const isSelected = inq.id === selectedInquiryId;
                              return (
                                <tr
                                  key={inq.id}
                                  onClick={() => {
                                    setSelectedInquiryId(inq.id);
                                    setReplyText(inq.replyContent || '');
                                  }}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected ? 'bg-indigo-600/5 hover:bg-indigo-600/10' : 'hover:bg-[#0B0F19]/45'
                                  }`}
                                >
                                  <td className="p-3">
                                    <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-100">{inq.clientName}</span>
                                      <span className="text-[9px] text-slate-500 font-mono">{inq.clientId}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-semibold text-slate-200 max-w-[200px] truncate">
                                    {inq.title}
                                  </td>
                                  <td className="p-3">
                                    <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                                      inq.status === 'replied' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {inq.status === 'replied' ? '답변 완료' : '답변 대기'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-450">
                                    {new Date(inq.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              );
                            })}

                            {inquiries.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-500 font-semibold bg-[#111622]/50">
                                  등록된 1:1 문의 사항이 없습니다.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Column: Inquiry Details & Answer Editor */}
                    <div className="lg:col-span-5 bg-[#111622] rounded-xl border border-[#1E293B]/60 p-5 flex flex-col space-y-4">
                      {selectedInq ? (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="flex justify-between items-start border-b border-[#1E293B]/60 pb-3">
                            <div className="space-y-1">
                              <span className="text-[9px] text-indigo-400 font-black block uppercase tracking-wider">INQUIRY DETAIL VIEW</span>
                              <h3 className="text-sm font-extrabold text-white">
                                {selectedInq.clientName} 의뢰인의 문의
                              </h3>
                            </div>
                            <button
                              onClick={() => setSelectedInquiryId('')}
                              className="text-slate-400 hover:text-white text-xs font-bold bg-[#07090E] border border-[#1E293B]/60 px-2 py-0.5 rounded transition-all"
                            >
                              닫기
                            </button>
                          </div>

                          {/* Inquiry Content box */}
                          <div className="space-y-2 bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B]/40 text-xs">
                            <div className="text-[10px] text-slate-500 font-mono">
                              등록일시: {new Date(selectedInq.createdAt).toLocaleString()}
                            </div>
                            <h4 className="text-slate-100 font-extrabold text-xs mb-1">
                              Q. {selectedInq.title}
                            </h4>
                            <p className="text-slate-350 leading-relaxed font-normal whitespace-pre-wrap">
                              {selectedInq.content}
                            </p>
                          </div>

                          {/* Answer Editor Section */}
                          <div className="bg-[#161B26] p-4 rounded-xl border border-[#1E293B]/40 space-y-3">
                            <span className="text-[10px] font-black text-indigo-400 block uppercase tracking-wider">✍️ 관리자 답변 작성 에디터</span>
                            
                            <textarea
                              rows={6}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="의뢰인의 문의사항에 대한 답변을 작성하십시오. 등록 즉시 의뢰인의 마이페이지에서 확인이 가능합니다."
                              className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 font-normal leading-relaxed text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                            />

                            <div className="flex gap-2">
                              {selectedInq.status === 'replied' && (
                                <button
                                  onClick={() => {
                                    if (confirm('등록된 답변을 삭제하시겠습니까?')) {
                                      setInquiries(prev => prev.map(inq => {
                                        if (inq.id === selectedInq.id) {
                                          return {
                                            ...inq,
                                            replyContent: undefined,
                                            repliedAt: undefined,
                                            status: 'pending'
                                          };
                                        }
                                        return inq;
                                      }));
                                      setReplyText('');
                                      onLogActivity(
                                        'admin',
                                        '최고관리자',
                                        'ADMIN',
                                        'ADMIN_ACTION',
                                        `1:1 문의 답변 삭제: 문의 ID ${selectedInq.id}`
                                      );
                                      alert('답변이 삭제되었습니다.');
                                    }
                                  }}
                                  className="flex-1 bg-red-500/10 hover:bg-red-650 text-red-400 hover:text-white border border-red-500/20 py-2 rounded-[200px] text-xs font-extrabold transition-all text-center cursor-pointer"
                                >
                                  답변 삭제
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (!replyText.trim()) {
                                    alert('답변 내용을 입력해 주세요.');
                                    return;
                                  }
                                  setInquiries(prev => prev.map(inq => {
                                    if (inq.id === selectedInq.id) {
                                      return {
                                        ...inq,
                                        replyContent: replyText.trim(),
                                        repliedAt: new Date().toISOString(),
                                        status: 'replied'
                                      };
                                    }
                                    return inq;
                                  }));
                                  onLogActivity(
                                    'admin',
                                    '최고관리자',
                                    'ADMIN',
                                    'ADMIN_ACTION',
                                    `1:1 문의 답변 등록/수정: 문의 ID ${selectedInq.id} (의뢰인: ${selectedInq.clientName})`
                                  );
                                  alert('답변이 성공적으로 등록되었습니다.');
                                }}
                                className="flex-2 bg-indigo-650 hover:bg-indigo-600 text-white py-2 rounded-[200px] text-xs font-extrabold transition-all text-center cursor-pointer"
                              >
                                {selectedInq.status === 'replied' ? '답변 수정 등록' : '답변 작성 완료'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-600 text-xs">
                          상세 조회 및 답변 작성을 위해 왼쪽의 1:1 문의 건을 클릭하십시오.
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}

              {/* 7. DIAGNOSIS CONFIG CRUD SECTION */}
              {contentSubTab === 'diagnosis' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">🧪 간이 진단 문항 편집</h3>
                      <p className="text-[11px] text-slate-500 mt-1">고객 랜딩 페이지의 5문항 진단 퀴즈를 편집합니다. 변경 후 저장하면 즉시 반영됩니다.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { if (confirm('모든 문항을 기본값으로 초기화하시겠습니까?')) { setDiagQuestions(DEFAULT_DIAGNOSIS_QUESTIONS); setEditingDiagIdx(null); } }} className="flex items-center gap-1 px-3 py-1.5 bg-[#111622] border border-[#1E293B]/60 rounded-lg text-xs text-slate-400 hover:text-white transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> 기본값 복원
                      </button>
                      <button onClick={async () => { setDiagSaving(true); try { await saveDiagnosisConfig({ questions: diagQuestions, isActive: true, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'admin' }); alert('진단 문항이 저장되었습니다.'); } catch { alert('저장에 실패했습니다.'); } finally { setDiagSaving(false); } }} disabled={diagSaving} className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" /> {diagSaving ? '저장 중...' : '전체 저장'}
                      </button>
                    </div>
                  </div>

                  {diagQuestions.map((q, qIdx) => (
                    <div key={q.id} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 overflow-hidden">
                      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#161B26] transition-colors" onClick={() => setEditingDiagIdx(editingDiagIdx === qIdx ? null : qIdx)}>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm">{q.step}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-200">{q.title}</p>
                            <p className="text-[11px] text-slate-500">{q.subtitle} · 옵션 {q.options.length}개</p>
                          </div>
                        </div>
                        <Edit2 className={`w-4 h-4 transition-colors ${editingDiagIdx === qIdx ? 'text-indigo-400' : 'text-slate-600'}`} />
                      </div>

                      {editingDiagIdx === qIdx && (
                        <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]/40 space-y-4 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1 font-bold uppercase">질문 제목</label>
                              <input type="text" value={q.title} onChange={(e) => { const u = [...diagQuestions]; u[qIdx] = { ...u[qIdx], title: e.target.value }; setDiagQuestions(u); }} className="w-full bg-[#0B0F19] border border-[#1E293B]/60 rounded-lg p-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1 font-bold uppercase">질문 부제</label>
                              <input type="text" value={q.subtitle || ''} onChange={(e) => { const u = [...diagQuestions]; u[qIdx] = { ...u[qIdx], subtitle: e.target.value }; setDiagQuestions(u); }} className="w-full bg-[#0B0F19] border border-[#1E293B]/60 rounded-lg p-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">선택지 옵션</label>
                              <button type="button" onClick={() => { const u = [...diagQuestions]; u[qIdx] = { ...u[qIdx], options: [...u[qIdx].options, { id: `opt-${Date.now()}`, label: '새 옵션', icon: '❓' }] }; setDiagQuestions(u); }} className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"><Plus className="w-3 h-3" /> 옵션 추가</button>
                            </div>
                            <div className="space-y-2">
                              {q.options.map((opt, optIdx) => (
                                <div key={opt.id} className="flex items-center gap-2 bg-[#0B0F19] p-2.5 rounded-lg border border-[#1E293B]/40">
                                  <input type="text" value={opt.icon} onChange={(e) => { const u = [...diagQuestions]; const o = [...u[qIdx].options]; o[optIdx] = { ...o[optIdx], icon: e.target.value }; u[qIdx] = { ...u[qIdx], options: o }; setDiagQuestions(u); }} className="w-12 bg-transparent border border-[#1E293B]/60 rounded p-1.5 text-center text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none" title="아이콘" />
                                  <input type="text" value={opt.label} onChange={(e) => { const u = [...diagQuestions]; const o = [...u[qIdx].options]; o[optIdx] = { ...o[optIdx], label: e.target.value }; u[qIdx] = { ...u[qIdx], options: o }; setDiagQuestions(u); }} className="flex-1 bg-transparent border border-[#1E293B]/60 rounded p-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="옵션 텍스트" />
                                  <input type="text" value={opt.description || ''} onChange={(e) => { const u = [...diagQuestions]; const o = [...u[qIdx].options]; o[optIdx] = { ...o[optIdx], description: e.target.value }; u[qIdx] = { ...u[qIdx], options: o }; setDiagQuestions(u); }} className="w-40 bg-transparent border border-[#1E293B]/60 rounded p-1.5 text-xs text-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="설명 (선택)" />
                                  {q.options.length > 2 && (<button type="button" onClick={() => { const u = [...diagQuestions]; u[qIdx] = { ...u[qIdx], options: u[qIdx].options.filter((_, i) => i !== optIdx) }; setDiagQuestions(u); }} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 5: MATCHING POLICY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#111622] p-6 md:p-8 rounded-2xl border border-[#1E293B]/60 text-left space-y-6">
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-400" />
                    <span>상담 매칭 및 견적 제한 정책 설정</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    의뢰인이 상담 신청 후 최대 3명의 변호사로부터 견적/상담을 받을 수 있는 주기 정책을 구성합니다.<br />
                    과도한 연속 신청으로 인한 플랫폼 스패밍 및 변호사단 피로도를 예방합니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {[
                    {
                      id: 'daily',
                      title: '매일 최대 3인 매칭 정책 (권장)',
                      desc: '의뢰인은 하루(24시간)에 최대 3명의 변호사에게만 상담 신청 및 제안서 매칭이 가능합니다.',
                      badge: '일일 제한'
                    },
                    {
                      id: 'weekly',
                      title: '매주 최대 3인 매칭 정책',
                      desc: '의뢰인은 일주일(7일)에 최대 3명의 변호사에게만 상담 신청 및 제안서 매칭이 가능합니다.',
                      badge: '주간 제한'
                    },
                    {
                      id: 'unlimited',
                      title: '매칭 제한 없음',
                      desc: '제한 없이 원할 때마다 언제든지 상담을 신청하여 3인 제안서를 받아볼 수 있습니다.',
                      badge: '무제한'
                    }
                  ].map((policy) => (
                    <button
                      key={policy.id}
                      type="button"
                      onClick={() => {
                        setMatchingPolicy(policy.id as 'daily' | 'weekly' | 'unlimited');
                        alert(`매칭 정책이 [${policy.title}]으로 변경되었습니다.`);
                      }}
                      className={`p-5 rounded-xl border text-left flex flex-col justify-between gap-4 transition-all cursor-pointer ${
                        matchingPolicy === policy.id
                          ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-lg'
                          : 'bg-[#161B26]/50 border-[#1E293B]/60 text-slate-355 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                            matchingPolicy === policy.id
                              ? 'bg-indigo-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {policy.badge}
                          </span>
                          {matchingPolicy === policy.id && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                          )}
                        </div>
                        <h4 className="font-extrabold text-sm text-white">{policy.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{policy.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bg-[#161B26] p-4 rounded-xl border border-indigo-500/10 flex items-start gap-3 mt-4 text-xs text-slate-400">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-slate-300">정책 변경 시 주의사항</strong>
                    <p>
                      - 정책 변경 시, 의뢰인 포털에서 실시간으로 신규 상담 신청 접수에 대한 시간 검증이 활성화됩니다.<br />
                      - 이미 등록된 과거 상담 및 활성화된 대화방 매칭 건은 소급 제한되지 않습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 📞 050 Virtual Number Real-time Allocation Monitor */}
              <div className="bg-[#111622] p-6 md:p-8 rounded-2xl border border-[#1E293B]/60 text-left space-y-6 mt-6">
                <div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    <span>📞</span> 050 안심번호 실시간 배정 현황 (72시간 유지 정책)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    현재 의뢰인들의 실시간 전화 상담 신청으로 인해 임시 배정된 050 가상 회선 매칭 내역입니다.<br />
                    신청 시점으로부터 72시간이 지나면 자동으로 매칭이 종료되며, 필요한 경우 수동으로 즉시 회수할 수 있습니다.
                  </p>
                </div>

                <div className="bg-[#161B26]/50 rounded-xl border border-[#1E293B]/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#111622] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">의뢰인</th>
                          <th className="p-3">실제 연락처</th>
                          <th className="p-3">배정된 050 번호</th>
                          <th className="p-3">배정 시점 / 만료 시점</th>
                          <th className="p-3">상태</th>
                          <th className="p-3 text-right">제어</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/40">
                        {requests.filter(r => r.phoneConsultationRequested).map(r => {
                          const isExpired = r.safeNumberExpiresAt ? new Date().getTime() > new Date(r.safeNumberExpiresAt).getTime() : true;
                          return (
                            <tr key={r.id} className="hover:bg-[#111622]/50">
                              <td className="p-3 font-bold text-white">{r.clientName}</td>
                              <td className="p-3 font-mono text-slate-350">{r.phone}</td>
                              <td className="p-3 font-mono text-indigo-400 font-extrabold">{r.safeNumber || '배정 대기'}</td>
                              <td className="p-3 text-slate-400 space-y-0.5">
                                <div className="text-[10px]">배정: {r.safeNumberAssignedAt ? new Date(r.safeNumberAssignedAt).toLocaleString() : '-'}</div>
                                <div className="text-[10px] text-amber-500/80">만료: {r.safeNumberExpiresAt ? new Date(r.safeNumberExpiresAt).toLocaleString() : '-'}</div>
                              </td>
                              <td className="p-3">
                                {isExpired ? (
                                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold">만료됨 (회선 해제)</span>
                                ) : (
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">사용중 (72H 이내)</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRequests(prev => prev.map(req => {
                                      if (req.id === r.id) {
                                        return {
                                          ...req,
                                          safeNumber: undefined,
                                          safeNumberAssignedAt: undefined,
                                          safeNumberExpiresAt: undefined,
                                          phoneConsultationRequested: false
                                        };
                                      }
                                      return req;
                                    }));
                                    alert('050 안심번호 매칭이 강제 해제되어 회선이 회수되었습니다.');
                                  }}
                                  className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2 py-1 rounded transition-all cursor-pointer text-[10px]"
                                >
                                  회선 강제 회수
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {requests.filter(r => r.phoneConsultationRequested).length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 font-semibold bg-[#111622]">
                              현재 활성화되거나 요청된 050 안심번호 가상 배정 내역이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 📋 기본 홈페이지 설정 및 약관/법률 관리 패널 */}
                <div className="bg-[#111622] p-6 md:p-8 rounded-2xl border border-[#1E293B]/60 text-left space-y-6 mt-6">
                  <div>
                    <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                      <span>⚙️</span>
                      <span>기본 홈페이지 설정 및 법률 약관 관리</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      플랫폼 전역(의뢰인/변호사 포털)에 적용되는 공통 브랜딩 정보 및 이용약관 내용을 실시간 변경/저장합니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-left">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">홈페이지 브라우저 타이틀</label>
                        <input 
                          type="text" 
                          value={formSiteTitle}
                          onChange={(e) => setFormSiteTitle(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="홈페이지 브라우저 상단 타이틀을 입력하세요"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">네비게이션 로고 텍스트 (CI/BI)</label>
                        <input 
                          type="text" 
                          value={formSiteLogoText}
                          onChange={(e) => setFormSiteLogoText(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="로고 텍스트를 입력하세요"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">회사 공식 주소</label>
                        <input 
                          type="text" 
                          value={formCompanyAddress}
                          onChange={(e) => setFormCompanyAddress(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="회사 주소를 입력하세요"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">사업자 등록 번호</label>
                        <input 
                          type="text" 
                          value={formCompanyBusinessNumber}
                          onChange={(e) => setFormCompanyBusinessNumber(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="사업자 등록 번호를 입력하세요"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">대표자명</label>
                        <input 
                          type="text" 
                          value={formCompanyRepresentative}
                          onChange={(e) => setFormCompanyRepresentative(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="대표자명을 입력하세요"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">로고 이미지 URL (선택)</label>
                        <input 
                          type="text" 
                          value={formSiteLogoUrl}
                          onChange={(e) => setFormSiteLogoUrl(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="http:// 로 시작하는 로고 이미지 경로"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">이용약관 본문 (가입 동의 약관)</label>
                        <textarea 
                          rows={6}
                          value={formTermsOfService}
                          onChange={(e) => setFormTermsOfService(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3.5 text-slate-200 font-normal leading-relaxed text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                          placeholder="이용약관 내용을 입력하세요"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 block uppercase font-bold">개인정보처리방침 본문</label>
                        <textarea 
                          rows={6}
                          value={formPrivacyPolicy}
                          onChange={(e) => setFormPrivacyPolicy(e.target.value)}
                          className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3.5 text-slate-200 font-normal leading-relaxed text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                          placeholder="개인정보처리방침 내용을 입력하세요"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[#1E293B]/30">
                    <button
                      type="button"
                      onClick={() => {
                        setPlatformConfig({
                          siteTitle: formSiteTitle.trim(),
                          siteLogoText: formSiteLogoText.trim(),
                          siteLogoUrl: formSiteLogoUrl.trim() || undefined,
                          companyAddress: formCompanyAddress.trim(),
                          companyBusinessNumber: formCompanyBusinessNumber.trim(),
                          companyRepresentative: formCompanyRepresentative.trim(),
                          termsOfService: formTermsOfService,
                          privacyPolicy: formPrivacyPolicy
                        });
                        onLogActivity(
                          'admin',
                          '최고관리자',
                          'ADMIN',
                          'ADMIN_ACTION',
                          `기본 홈페이지 환경설정 및 법률약관 정보 갱신 적용 완료`
                        );
                        alert('기본 환경 설정 및 약관이 성공적으로 저장 및 전역 반영되었습니다!');
                      }}
                      className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-8 py-3 rounded-[200px] text-xs transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>기본 설정 저장 및 전역 적용</span>
                    </button>
                  </div>
                </div>

                {/* 🏛️ 회생/파산 정책 및 계산 기준 설정 (관리자 전용) */}
                <div className="mt-6">
                  <RehabSettingsPanel />
                </div>

              </div>
            </div>
          )}

          {/* TAB 7: MEMBER MANAGEMENT & ACTIVITY MONITORING */}
          {activeTab === 'members' && (() => {
            const totalClientsCount = members.filter(m => m.role === 'CLIENT').length;
            const totalPartnersCount = members.filter(m => m.role === 'LAWYER' || m.role === 'STAFF').length;
            const totalActiveCount = members.filter(m => m.status === 'active').length;
            const totalSuspendedCount = members.filter(m => m.status === 'suspended').length;
            const totalPendingCount = members.filter(m => m.status === 'pending').length;
            const totalWithdrawnCount = members.filter(m => m.status === 'withdrawn').length;
            const totalDormantCount = members.filter(m => m.status === 'dormant').length;
            const todaySignupsCount = members.filter(m => m.createdAt.startsWith(new Date().toISOString().split('T')[0])).length;


            const channelCounts = members.reduce((acc, m) => {
              acc[m.loginChannel] = (acc[m.loginChannel] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const pctGoogle = members.length > 0 ? Math.round(((channelCounts['google'] || 0) / members.length) * 100) : 0;
            const pctKakao = members.length > 0 ? Math.round(((channelCounts['kakao'] || 0) / members.length) * 100) : 0;
            const pctNaver = members.length > 0 ? Math.round(((channelCounts['naver'] || 0) / members.length) * 100) : 0;
            const pctEmail = members.length > 0 ? Math.round(((channelCounts['email'] || 0) / members.length) * 100) : 0;
            const pctSms = members.length > 0 ? Math.round(((channelCounts['sms'] || 0) / members.length) * 100) : 0;

            const getSignupCountForDateOffset = (offset: number) => {
              const d = new Date();
              d.setDate(d.getDate() - offset);
              const dateStr = d.toISOString().split('T')[0];
              return members.filter(m => m.createdAt.startsWith(dateStr)).length;
            };

            const signupData = [6, 5, 4, 3, 2, 1, 0].map(offset => {
              const d = new Date();
              d.setDate(d.getDate() - offset);
              const label = `${d.getMonth() + 1}/${d.getDate()}`;
              const count = getSignupCountForDateOffset(offset);
              return { label, count };
            });

            const maxSignupCount = Math.max(...signupData.map(s => s.count), 1);

            const filteredMembersList = members.filter(m => {
              const matchesSearch = 
                m.alias.toLowerCase().includes(memberSearch.toLowerCase()) ||
                m.id.toLowerCase().includes(memberSearch.toLowerCase()) ||
                (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase())) ||
                (m.phone && m.phone.includes(memberSearch));
              const matchesRole = memberRoleFilter === 'all' || m.role === memberRoleFilter;
              const matchesStatus = memberStatusFilter === 'all' || m.status === memberStatusFilter;
              return matchesSearch && matchesRole && matchesStatus;
            });

            const selectedMember = members.find(m => m.id === selectedMemberId);
            const selectedMemberLogs = selectedMemberId 
              ? activityLogs.filter(log => log.memberId === selectedMemberId)
              : [];

            const filteredGlobalLogs = activityLogs.filter(log => {
              const matchesAction = activityActionFilter === 'all' || log.action === activityActionFilter;
              return matchesAction;
            });

            const handleToggleMemberStatus = (memberId: string) => {
              const current = members.find(m => m.id === memberId);
              if (!current) return;
              const newStatus = current.status === 'active' ? 'suspended' : 'active';
              const statusText = newStatus === 'active' ? '활성화' : '임시 정지';
              if (confirm(`이 회원의 계정 상태를 [${statusText}]로 변경하시겠습니까?`)) {
                setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m));
                
                // If it is a lawyer/staff, also sync approved flag in lawyers state
                if (current.role === 'LAWYER' || current.role === 'STAFF') {
                  setLawyers(prev => prev.map(l => l.id === memberId ? { ...l, approved: newStatus === 'active' } : l));
                }

                onLogActivity(
                  'admin',
                  '최고관리자',
                  'ADMIN',
                  'ADMIN_ACTION',
                  `회원 계정 상태 수동 조절: ${current.alias} (${current.role}) -> [${newStatus.toUpperCase()}]`
                );
                alert(`해당 계정이 성공적으로 ${statusText} 처리되었습니다.`);
              }
            };

            const handleToggleDormantStatus = (memberId: string) => {
              const current = members.find(m => m.id === memberId);
              if (!current) return;
              const newStatus = current.status === 'dormant' ? 'active' : 'dormant';
              const statusText = newStatus === 'active' ? '휴면 해제 (활성화)' : '휴면 계정 전환';
              if (confirm(`이 회원의 계정 상태를 [${statusText}]로 변경하시겠습니까?`)) {
                setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus, lastActiveAt: new Date().toISOString() } : m));
                
                onLogActivity(
                  'admin',
                  '최고관리자',
                  'ADMIN',
                  'ADMIN_ACTION',
                  `회원 계정 휴면 상태 수동 조절: ${current.alias} (${current.role}) -> [${newStatus.toUpperCase()}]`
                );
                alert(`해당 계정이 성공적으로 ${statusText} 처리되었습니다.`);
              }
            };

            const handleWithdrawMember = (memberId: string) => {
              const current = members.find(m => m.id === memberId);
              if (!current) return;
              if (current.status === 'withdrawn') {
                alert('이미 탈퇴 처리된 회원입니다.');
                return;
              }
              if (confirm(`정말로 회원 [${current.alias}]을 강제 탈퇴 처리하시겠습니까?\n이메일, 연락처 등 모든 개인 식별 정보가 즉시 완전 파기되며 복구할 수 없습니다.`)) {
                setMembers(prev => prev.map(m => {
                  if (m.id === memberId) {
                    return {
                      ...m,
                      alias: '(탈퇴한 회원)',
                      email: undefined,
                      phone: undefined,
                      status: 'withdrawn',
                      lastActiveAt: new Date().toISOString()
                    };
                  }
                  return m;
                }));

                // If it is a lawyer/staff, also sync with lawyers array
                if (current.role === 'LAWYER' || current.role === 'STAFF') {
                  setLawyers(prev => prev.map(l => {
                    if (l.id === memberId) {
                      return {
                        ...l,
                        name: '(탈퇴한 대리인)',
                        approved: false
                      };
                    }
                    return l;
                  }));
                }

                // Add withdrawal log
                onLogActivity(
                  memberId,
                  '(탈퇴한 회원)',
                  current.role,
                  'WITHDRAWAL',
                  `관리자 수동 조치에 의한 계정 강제 탈퇴 및 개인정보 파기 완료`
                );

                // Add admin log
                onLogActivity(
                  'admin',
                  '최고관리자',
                  'ADMIN',
                  'ADMIN_ACTION',
                  `회원 강제 탈퇴 실행: ID ${memberId} (${current.role})`
                );

                alert('회원 강제 탈퇴 및 개인정보 파기가 완료되었습니다.');
              }
            };

            const maskEmail = (email?: string) => {
              if (!email) return '-';
              const parts = email.split('@');
              if (parts.length !== 2) return email;
              const name = parts[0];
              const domain = parts[1];
              return `${name.substring(0, Math.min(3, name.length))}****@${domain}`;
            };

            const maskPhone = (phone?: string) => {
              if (!phone) return '-';
              return phone.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
            };

            return (
              <div className="space-y-6 animate-fadeIn text-left">
                {/* 1. Stats and Charts Header Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stats breakdown card */}
                  <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3.5 flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-400 block uppercase font-black tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>전체 회원 지표</span>
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-[#07090E]/60 p-2.5 rounded-xl border border-[#1E293B]/30">
                        <span className="text-[10px] text-slate-500 block font-bold">의뢰인 회원</span>
                        <strong className="text-xl font-black text-indigo-400">{totalClientsCount}명</strong>
                      </div>
                      <div className="bg-[#07090E]/60 p-2.5 rounded-xl border border-[#1E293B]/30">
                        <span className="text-[10px] text-slate-500 block font-bold">대리인 파트너</span>
                        <strong className="text-xl font-black text-sky-400">{totalPartnersCount}명</strong>
                      </div>
                      <div className="bg-[#07090E]/65 p-2.5 rounded-xl border border-[#1E293B]/30 col-span-2 flex flex-col gap-2 text-[10px] text-left">
                        <div className="flex justify-around text-center border-b border-[#1E293B]/20 pb-1.5 flex-wrap gap-y-1">
                          <div>정상: <strong className="text-emerald-400 font-bold">{totalActiveCount}명</strong></div>
                          <div className="border-r border-[#1E293B]/30 h-3 my-auto"></div>
                          <div>정지: <strong className="text-red-400 font-bold">{totalSuspendedCount}명</strong></div>
                          <div className="border-r border-[#1E293B]/30 h-3 my-auto"></div>
                          <div>휴면: <strong className="text-amber-500 font-bold">{totalDormantCount}명</strong></div>
                          <div className="border-r border-[#1E293B]/30 h-3 my-auto"></div>
                          <div>대기: <strong className="text-slate-400 font-bold">{totalPendingCount}명</strong></div>
                        </div>
                        <div className="flex justify-around text-center text-slate-400">
                          <div>오늘 가입: <strong className="text-indigo-400 font-bold">{todaySignupsCount}명</strong></div>
                          <div className="border-r border-[#1E293B]/30 h-3 my-auto"></div>
                          <div>탈퇴 회원: <strong className="text-slate-400 font-bold">{totalWithdrawnCount}명</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Channel chart card */}
                  <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
                    <span className="text-[10px] text-indigo-400 block uppercase font-black tracking-wider flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>가입 채널 분포</span>
                    </span>
                    <div className="space-y-2 text-xs text-slate-400">
                      {/* Naver */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>네이버 간편가입 ({channelCounts['naver'] || 0}명)</span>
                          <strong className="text-slate-200">{pctNaver}%</strong>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div style={{ width: `${pctNaver}%` }} className="bg-emerald-500 h-full rounded-full" />
                        </div>
                      </div>
                      {/* Kakao */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>카카오 간편가입 ({channelCounts['kakao'] || 0}명)</span>
                          <strong className="text-slate-200">{pctKakao}%</strong>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div style={{ width: `${pctKakao}%` }} className="bg-yellow-550 h-full rounded-full" />
                        </div>
                      </div>
                      {/* Google */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>구글 간편가입 ({channelCounts['google'] || 0}명)</span>
                          <strong className="text-slate-200">{pctGoogle}%</strong>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div style={{ width: `${pctGoogle}%` }} className="bg-indigo-500 h-full rounded-full" />
                        </div>
                      </div>
                      {/* SMS & Email combined */}
                      <div className="flex gap-4 text-[10px] pt-1">
                        <div>SMS OTP: <strong className="text-slate-200">{pctSms}%</strong> ({channelCounts['sms'] || 0}명)</div>
                        <div>일반 이메일: <strong className="text-slate-200">{pctEmail}%</strong> ({channelCounts['email'] || 0}명)</div>
                      </div>
                    </div>
                  </div>

                  {/* Daily signups sparkline chart */}
                  <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-2.5">
                    <span className="text-[10px] text-indigo-400 block uppercase font-black tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>최근 7일 가입 추이</span>
                    </span>
                    {/* Vertical bars chart */}
                    <div className="h-24 flex items-end justify-between gap-2.5 pt-2">
                      {signupData.map((d, i) => {
                        const heightPct = Math.round((d.count / maxSignupCount) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group cursor-default">
                            <span className="text-[9px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                              {d.count}명
                            </span>
                            <div 
                              style={{ height: `${Math.max(5, heightPct)}%` }} 
                              className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-300 hover:from-indigo-400 hover:to-indigo-300"
                            />
                            <span className="text-[9px] text-slate-500 font-bold">{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Split Screen View */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Member List Table */}
                  <div className="lg:col-span-7 bg-[#111622] rounded-2xl border border-[#1E293B]/60 overflow-hidden flex flex-col">
                    {/* Table Filters */}
                    <div className="p-4 bg-[#161B26] border-b border-[#1E293B]/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
                      <div className="relative w-full sm:max-w-xs">
                        <input 
                          type="text" 
                          placeholder="성명, 가명, 연락처, ID 검색..." 
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="w-full bg-[#0B0F19] border border-[#1E293B]/80 rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600"
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-500 w-3.5 h-3.5" />
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <select 
                          value={memberRoleFilter} 
                          onChange={(e) => setMemberRoleFilter(e.target.value)}
                          className="bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-350 focus:outline-none"
                        >
                          <option value="all">전체 역할</option>
                          <option value="CLIENT">의뢰인 (CLIENT)</option>
                          <option value="LAWYER">변호사 (LAWYER)</option>
                          <option value="STAFF">실장 (STAFF)</option>
                        </select>

                        <select 
                          value={memberStatusFilter} 
                          onChange={(e) => setMemberStatusFilter(e.target.value)}
                          className="bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-350 focus:outline-none"
                        >
                          <option value="all">전체 상태</option>
                          <option value="active">정상 (Active)</option>
                          <option value="suspended">정지 (Suspended)</option>
                          <option value="pending">대기 (Pending)</option>
                          <option value="dormant">휴면 (Dormant)</option>
                          <option value="withdrawn">탈퇴 (Withdrawn)</option>
                        </select>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161B26]/30 text-slate-400 font-bold border-b border-[#1E293B]/60">
                            <th className="p-3">회원명/가명</th>
                            <th className="p-3">역할</th>
                            <th className="p-3">가입 경로</th>
                            <th className="p-3">상태</th>
                            <th className="p-3 text-right">최근 접속 시각</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]/30">
                          {filteredMembersList.map(m => {
                            const isSelected = m.id === selectedMemberId;
                            return (
                              <tr 
                                key={m.id}
                                onClick={() => setSelectedMemberId(m.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-indigo-600/5 hover:bg-indigo-600/10' : 'hover:bg-[#0B0F19]/45'
                                } ${m.status === 'withdrawn' ? 'opacity-60 line-through text-slate-500' : ''} ${
                                  m.status === 'dormant' ? 'border-l-2 border-amber-500/80 bg-amber-500/5' : ''
                                }`}
                              >
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-slate-100">{m.alias}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{m.id}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border ${
                                    m.role === 'CLIENT' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                    m.role === 'LAWYER' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                    m.role === 'STAFF' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    'bg-red-500/10 text-red-400 border-red-500/20'
                                  }`}>
                                    {m.role}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="text-slate-350 capitalize font-medium text-[11px] flex items-center gap-1">
                                    {m.loginChannel === 'google' || m.loginChannel === 'kakao' || m.loginChannel === 'naver' ? (
                                      <span>💬 소셜 ({m.loginChannel})</span>
                                    ) : m.loginChannel === 'sms' ? (
                                      <span>📱 휴대폰 (SMS)</span>
                                    ) : (
                                      <span>✉️ 이메일 (Direct)</span>
                                    )}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                                    m.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    m.status === 'suspended' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    m.status === 'withdrawn' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                                    m.status === 'dormant' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    {m.status === 'active' ? '정상 활동' : m.status === 'suspended' ? '이용 정지' : m.status === 'withdrawn' ? '탈퇴 완료' : m.status === 'dormant' ? '휴면 계정' : '승인 대기'}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-slate-400 font-mono text-[10px]">
                                  {new Date(m.lastActiveAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })}

                          {filteredMembersList.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center text-slate-500 font-semibold bg-[#111622]/50">
                                조건에 부합하는 가입 회원 데이터가 존재하지 않습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Member Details Timeline OR Global Stream */}
                  <div className="lg:col-span-5 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 flex flex-col space-y-4">
                    {selectedMember ? (
                      /* Individual Member Detail and Activity Timeline View */
                      <div className="space-y-4 animate-fadeIn">
                        {/* Member Identity Details Card */}
                        <div className="flex justify-between items-start border-b border-[#1E293B]/60 pb-3">
                          <div className="space-y-1">
                            <span className="text-[9px] text-indigo-400 font-black block uppercase tracking-wider">MEMBER ACCOUNT DETAIL</span>
                            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                              <span>{selectedMember.alias}</span>
                              <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                                {selectedMember.role}
                              </span>
                            </h3>
                          </div>
                          <button 
                            onClick={() => setSelectedMemberId('')}
                            className="text-slate-400 hover:text-white text-xs font-bold bg-[#07090E] border border-[#1E293B]/60 px-2 py-0.5 rounded transition-all"
                          >
                            닫기 (전체 로그)
                          </button>
                        </div>

                        {/* Masked Data sheet */}
                        <div className="space-y-2 bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B]/40 text-xs">
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>계정 식별 ID:</span>
                            <strong className="text-white font-mono text-[11px]">{selectedMember.id}</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>연락처 (개인정보 마스킹):</span>
                            <strong className="text-white font-mono">{maskPhone(selectedMember.phone)}</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>가입 이메일 주소:</span>
                            <strong className="text-white font-mono">{maskEmail(selectedMember.email)}</strong>
                          </div>
                          <div className="flex justify-between border-b border-[#1E293B]/20 pb-1.5">
                            <span>가입 경로 / 가입 시점:</span>
                            <strong className="text-white">
                              {selectedMember.loginChannel.toUpperCase()} / {new Date(selectedMember.createdAt).toLocaleDateString()}
                            </strong>
                          </div>
                          <div className="flex justify-between text-indigo-400">
                            <span>현재 계정 상태:</span>
                            <strong className="font-extrabold capitalize">{selectedMember.status}</strong>
                          </div>
                        </div>

                        {/* Account Controls */}
                        <div className="bg-[#161B26] p-4 rounded-xl border border-[#1E293B]/40 space-y-2.5">
                          <span className="text-[10px] font-black text-indigo-400 block uppercase tracking-wider">🔒 관리자 계정 활동 제어 조치</span>
                          <p className="text-[10px] leading-relaxed text-slate-400">
                            불량 의뢰 등록, 스팸성 계산기 조작, 혹은 허위 자격 정보 기입이 감지되면 이 계정을 즉각 일시정지 조치할 수 있습니다. 즉시 모든 포털의 로그인 세션이 끊기고 활동이 차단됩니다.
                          </p>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              {selectedMember.status === 'withdrawn' ? (
                                <div className="flex-1 bg-[#0F121C] text-slate-500 py-2 rounded-[200px] text-xs font-extrabold text-center border border-slate-800">
                                  🔒 이미 탈퇴가 완료된 회원 계정입니다.
                                </div>
                              ) : selectedMember.status === 'pending' ? (
                                <button 
                                  onClick={() => handleApproveLawyer(selectedMember.id)}
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>대리인 자격 승인</span>
                                </button>
                              ) : selectedMember.status === 'dormant' ? (
                                <button 
                                  onClick={() => handleToggleDormantStatus(selectedMember.id)}
                                  className="flex-1 bg-emerald-650 hover:bg-emerald-600 text-white py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>휴면 해제 (활성화)</span>
                                </button>
                              ) : (
                                <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                                  <button 
                                    onClick={() => handleToggleMemberStatus(selectedMember.id)}
                                    className={`flex-1 py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                      selectedMember.status === 'active'
                                      ? 'bg-[#1E293B]/20 hover:bg-red-950/20 border border-red-500/30 text-red-400'
                                      : 'bg-emerald-650 hover:bg-emerald-600 text-white'
                                    }`}
                                  >
                                    {selectedMember.status === 'active' ? (
                                      <>
                                        <EyeOff className="w-3.5 h-3.5" />
                                        <span>계정 임시 정지 (Block)</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>계정 차단 해제 (Activate)</span>
                                      </>
                                    )}
                                  </button>
                                  {selectedMember.status === 'active' && (
                                    <button 
                                      onClick={() => handleToggleDormantStatus(selectedMember.id)}
                                      className="flex-1 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 text-amber-400 py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                      <span>휴면 계정 수동 전환</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {selectedMember.status !== 'withdrawn' && (
                              <button 
                                onClick={() => handleWithdrawMember(selectedMember.id)}
                                className="w-full bg-[#1E293B]/10 hover:bg-red-650 text-slate-400 hover:text-white border border-red-500/20 py-2 rounded-[200px] text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>회원 강제 탈퇴 처리 (Withdraw)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Chronological Activity Timeline */}
                        <div className="space-y-3 pt-1">
                          <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">⏱️ 회원 개별 활동 타임라인</span>
                          <div className="border-l-2 border-[#1E293B]/60 ml-2.5 pl-4 space-y-4 py-1 text-xs">
                            {selectedMemberLogs.map(log => (
                              <div key={log.id} className="relative space-y-1">
                                {/* Chronology dot */}
                                <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#0F121C] bg-indigo-500" />
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <span className="bg-[#161B26] border border-[#1E293B]/65 px-1.5 py-0.2 rounded font-bold text-[9px] text-indigo-400">
                                    {log.action}
                                  </span>
                                  <span className="font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-200 text-xs font-semibold leading-normal">{log.details}</p>
                                <span className="text-[10px] text-slate-500 block font-mono">IP: {log.ipAddress}</span>
                              </div>
                            ))}

                            {selectedMemberLogs.length === 0 && (
                              <div className="text-center py-6 text-slate-600 text-xs pl-0">
                                타임라인에 수집된 가입자 활동 내역이 아직 없습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Platform Global Live Activity Log Stream View */
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b border-[#1E293B]/60 pb-3">
                          <div className="space-y-1 text-left">
                            <span className="text-[9px] text-indigo-400 font-black block uppercase tracking-wider">PLATFORM AUDIT TRAIL MONITOR</span>
                            <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                              <span>실시간 통합 플랫폼 활동 피드</span>
                            </h3>
                          </div>

                          <select 
                            value={activityActionFilter}
                            onChange={(e) => setActivityActionFilter(e.target.value)}
                            className="bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl px-2 py-1 text-[9px] font-black text-slate-400 focus:outline-none"
                          >
                            <option value="all">모든 액션</option>
                            <option value="SIGNUP">가입 (SIGNUP)</option>
                            <option value="LOGIN">로그인 (LOGIN)</option>
                            <option value="CALCULATE">계산기 (CALCULATE)</option>
                            <option value="CONSULT_REQUEST">의뢰 (CONSULT)</option>
                            <option value="CHAT_SEND">채팅 (CHAT)</option>
                            <option value="STATUS_CHANGE">상태변경 (STATUS)</option>
                            <option value="ADMIN_ACTION">관리자조치 (ADMIN)</option>
                          </select>
                        </div>

                        {/* Scrolling live feed */}
                        <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1 text-xs">
                          {filteredGlobalLogs.slice(0, 25).map(log => {
                            const isClient = log.role === 'CLIENT';
                            return (
                              <div key={log.id} className="bg-[#0B0F19]/45 border border-[#1E293B]/30 hover:border-slate-800 p-3 rounded-xl space-y-1.5 transition-all">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] font-black px-1 rounded-sm text-white ${
                                      log.action === 'SIGNUP' ? 'bg-orange-650' :
                                      log.action === 'LOGIN' ? 'bg-blue-650' :
                                      log.action === 'CALCULATE' ? 'bg-purple-650' :
                                      log.action === 'CONSULT_REQUEST' ? 'bg-indigo-650' :
                                      log.action === 'CHAT_SEND' ? 'bg-slate-655' :
                                      log.action === 'STATUS_CHANGE' ? 'bg-emerald-650' :
                                      'bg-red-650'
                                    }`}>
                                      {log.action}
                                    </span>
                                    <strong className="text-slate-200 text-[11px]">{log.memberName}</strong>
                                    <span className={`text-[8px] font-extrabold px-1 rounded-md border ${
                                      isClient ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                    }`}>
                                      {log.role}
                                    </span>
                                  </div>
                                  <span className="font-mono text-slate-500 text-[9px]">
                                    {new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-350 leading-normal text-[11px] font-medium">{log.details}</p>
                                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                                  <span>ID: {log.memberId}</span>
                                  <span>IP: {log.ipAddress}</span>
                                </div>
                              </div>
                            );
                          })}

                          {filteredGlobalLogs.length === 0 && (
                            <div className="text-center py-12 text-slate-600 text-xs">
                              수집된 실시간 활동 로그 내역이 존재하지 않습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })()}

        </main>

        {/* Footer */}
        <footer className="bg-[#161B26] border-t border-[#1E293B]/60 text-center py-4 text-[10px] text-slate-500">
          <p>© 2026 회생 및 파산 전문 어드민 관리센터. All rights reserved.</p>
        </footer>

      </div>
    </div>
  );
}
