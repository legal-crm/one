import React, { useState } from 'react';
import { 
  BarChart2, Users, Briefcase, CreditCard, CheckCircle2, AlertTriangle, 
  Trash2, EyeOff, Check, X, ShieldAlert, ShieldCheck, Sparkles, ExternalLink,
  LogOut, Lock 
} from 'lucide-react';
import { ConsultRequest, User, ConsultStatus, NewsArticle } from '../types';
import { platformPlans } from '../data';

interface AdminRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
  newsArticles: NewsArticle[];
  setNewsArticles: React.Dispatch<React.SetStateAction<NewsArticle[]>>;
}

export default function AdminRole({
  requests,
  setRequests,
  lawyers,
  setLawyers,
  newsArticles,
  setNewsArticles
}: AdminRoleProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'lawyers' | 'billing' | 'contents'>('dashboard');

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

  // Estimate Monthly Recurring Revenue (MRR) based on subscription distribution
  // Basic: 300,000 KRW, Pro: 800,000 KRW, Team/Enterprise: 1,500,000 KRW
  const estimateMRR = lawyers.reduce((acc, l) => {
    // If lawyer has matching team/firm, we estimate their billing
    // Default Pro for matchedCount > 80, Basic for others, Enterprise for matchedCount > 120
    if (l.matchedCount > 120) return acc + 1500000;
    if (l.matchedCount > 80) return acc + 800000;
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
          </div>
        </div>

        {/* Workspace Frame */}
        <main className="flex-1 w-full px-4 py-6 overflow-y-auto">

          {/* TAB 1: PLATFORM DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Stat grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">총 처리 위임 채무액</span>
                    <span className="text-xl font-black text-rose-400">{(totalDebtProcessed / 10000).toFixed(1)}억 원</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/10">
                    <AlertTriangle className="w-5 h-5" />
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
                        {filteredClients.map(c => {
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
                                  {selectedClient.financialProfile.debtCause === 'LIVING' ? '생활비' : selectedClient.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : selectedClient.financialProfile.debtCause === 'INVESTMENT' ? '투자 실패' : selectedClient.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}
                                  {` (${selectedClient.financialProfile.creditorCount}곳 금융기관)`}
                                </strong>
                              </div>
                              <div className="flex justify-between text-indigo-400">
                                <span>현재 채무 추심 단계</span>
                                <strong className="font-bold">
                                  {selectedClient.financialProfile.harassmentLevel === 'CALL' ? '추심 전화 및 문자' : selectedClient.financialProfile.harassmentLevel === 'LETTER' ? '독촉장 및 가택방문' : selectedClient.financialProfile.harassmentLevel === 'LAWSUIT' ? '소급/소송 진행' : '급여/통장 압류 단계'}
                                </strong>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="font-bold text-slate-350 block">의뢰서 원본 텍스트 요약:</span>
                          <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]/40 leading-relaxed text-[11px] text-slate-300">
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
                        {filteredLawyers.map(l => {
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
                              가입 시 제출한 자격 확인서 및 소속 로펌 인증을 심사하십시오. 승인을 완료하면 대리인은 RebirthTalk의 모든 상담 세션 및 실시간 채팅 매칭에 정식으로 참여할 권한을 부여받습니다.
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
            <div className="space-y-6 animate-fadeIn">
              {/* Billing revenue stats summary */}
              <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900/40 p-6 rounded-2xl border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
                <div className="space-y-1.5">
                  <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">MONTHLY PLATFORM REVENUE SUMMARY</span>
                  <h2 className="text-xl font-black text-white">이달 멤버십 구독 매출 합산: <span className="text-indigo-400">{estimateMRR.toLocaleString()} 원</span></h2>
                  <p className="text-xs text-slate-400">회생톡 플랫폼은 변호사법을 완벽히 이행하여 정액 광고 구독 수입 모델로만 매출을 창출합니다.</p>
                </div>
              </div>

              {/* Transactions grid */}
              <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                <h3 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">구독료 징수 현황 명세 (실시간 시뮬레이션)</h3>
                
                <div className="overflow-x-auto rounded-xl border border-[#1E293B]/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                        <th className="p-3">정산 대상 변호사</th>
                        <th className="p-3">구독중 멤버십</th>
                        <th className="p-3">월 고정 징수액</th>
                        <th className="p-3">수납 상태</th>
                        <th className="p-3 text-right">누적 실적</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]/30">
                      {lawyers.map(l => {
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
                          <tr key={l.id} className="hover:bg-[#0B0F19]/20">
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
                            <td className="p-3 text-right text-slate-350">{l.matchedCount}건 매칭참여</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SITE CONTENT CRUD OPERATIONS */}
          {activeTab === 'contents' && (
            <div className="space-y-6 animate-fadeIn text-left">
              
              {/* Header card */}
              <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900/40 p-6 rounded-2xl border border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div className="space-y-1">
                  <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">PLATFORM LEGAL COLUMN CONTENT CONTROL</span>
                  <h2 className="text-xl font-black text-white">사이트 법률 정보 콘텐츠 CRUD 제어 센터</h2>
                  <p className="text-xs text-slate-400">의뢰인에게 신뢰를 주는 법률 칼럼 기사를 실시간 추가, 수정, 삭제 제어할 수 있습니다.</p>
                </div>
                
                {!isCreateMode && !editingArticle && (
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
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-5 py-3 rounded-[200px] text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✍️ 새로운 법률 정보 등록</span>
                  </button>
                )}
              </div>

              {/* Creator / Editor Form Panel */}
              {(isCreateMode || editingArticle) && (
                <div className="bg-[#111622] p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-slideDown">
                  <h3 className="font-extrabold text-sm text-indigo-400 border-b border-[#1E293B]/50 pb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>{isCreateMode ? '신규 법률 정보 아티클 등록' : '법률 정보 아티클 수정'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    
                    {/* Category Select */}
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

                    {/* Badge Select */}
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

                    {/* Title Input */}
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

                    {/* Author Lawyer Select */}
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

                    {/* Cover Image URL */}
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

                    {/* Excerpt Input */}
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

                    {/* Main Content Body */}
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] text-slate-450 block uppercase font-bold">칼럼 상세 법률 본문 (HTML/Markdown 줄 바꿈 지원)</label>
                      <textarea 
                        rows={10}
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
                              className="bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg transition-all"
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
                              className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg transition-all"
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

        </main>

        {/* Footer */}
        <footer className="bg-[#161B26] border-t border-[#1E293B]/60 text-center py-4 text-[10px] text-slate-500">
          <p>© 2026 회생톡 도산 전문 어드민 관리 센터. All rights reserved.</p>
        </footer>

      </div>
    </div>
  );
}
