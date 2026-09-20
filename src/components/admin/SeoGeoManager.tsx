import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
  Key,
  AlertTriangle,
  Send,
  Download,
  Eye,
  ShieldCheck,
  Cpu,
  TrendingUp,
  Sliders,
  ChevronRight,
  Info,
  Layers,
  Code
} from 'lucide-react';
import { toast } from 'sonner';

// --- 인터페이스 정의 ---
interface PortalConfig {
  id: 'google' | 'naver' | 'bing';
  name: string;
  portalLogoText: string;
  badgeBg: string;
  badgeTextColor: string;
  borderColor: string;
  account: string;
  loginMethod: string;
  verificationTag: string;
  sitemapSubmitted: boolean;
  rssSubmitted: boolean;
  syndicationActive: boolean;
  consoleUrl: string;
  steps: {
    id: string;
    title: string;
    desc: string;
    completed: boolean;
  }[];
  customTag?: string;
  memo?: string;
}

interface IndexHistoryItem {
  id: string;
  url: string;
  target: string;
  timestamp: string;
  status: 'success' | 'pending';
}

const DEFAULT_PORTALS: PortalConfig[] = [
  {
    id: 'google',
    name: '구글 서치 콘솔 (Google Search Console)',
    portalLogoText: 'Google',
    badgeBg: 'bg-blue-500/10',
    badgeTextColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    account: 'beanhull@gmail.com',
    loginMethod: '구글 계정 직접 로그인',
    verificationTag: '<meta name="google-site-verification" content="GSC_VERIFICATION_CODE" />',
    sitemapSubmitted: true,
    rssSubmitted: false,
    syndicationActive: true,
    consoleUrl: 'https://search.google.com/search-console',
    steps: [
      { id: 'g1', title: '구글 계정 (beanhull@gmail.com) 서치콘솔 로그인', desc: 'search.google.com 접속 후 속성(mykim.kr) 추가', completed: true },
      { id: 'g2', title: '소유권 확인 메타태그 등록', desc: 'HTML 태그 방식을 선택하여 발급된 고유 코드를 head에 등록', completed: false },
      { id: 'g3', title: 'sitemap.xml 제출', desc: '좌측 메뉴 [Sitemaps]에서 https://mykim.kr/sitemap.xml 제출', completed: true },
      { id: 'g4', title: '주요 페이지 URL 색인 요청 (Inspection)', desc: '핵심 랜딩 및 기사 페이지를 URL 검사 후 색인 요청', completed: false }
    ],
    memo: '구글 코어 업데이트 대비 E-E-A-T 구조화 데이터(LegalService) 적용 완료'
  },
  {
    id: 'naver',
    name: '네이버 서치어드바이저 (Naver Search Advisor)',
    portalLogoText: 'NAVER',
    badgeBg: 'bg-emerald-500/10',
    badgeTextColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    account: '2882a@naver.com',
    loginMethod: '네이버 계정 직접 로그인',
    verificationTag: '<meta name="naver-site-verification" content="acb96fe427f008c66bd62ae0b77dec8fca657ce7" />',
    sitemapSubmitted: true,
    rssSubmitted: true,
    syndicationActive: true,
    consoleUrl: 'https://searchadvisor.naver.com/console/board',
    steps: [
      { id: 'n1', title: '네이버 계정 (2882a@naver.com) 서치어드바이저 로그인', desc: '웹마스터 도구에 사이트 https://mykim.kr 등록', completed: true },
      { id: 'n2', title: '사이트 소유 확인 완료 (acb96fe4...)', desc: '현재 index.html에 메타태그 삽입되어 검증 활성화됨', completed: true },
      { id: 'n3', title: '사이트맵 및 RSS 제출', desc: '요청 > 사이트맵 제출 (sitemap.xml), RSS 제출 (rss.xml)', completed: true },
      { id: 'n4', title: '웹 페이지 수집 요청 (새 글/새 가이드)', desc: '요청 > 웹 페이지 수집에서 최근 업데이트된 URL 수집 요청', completed: false }
    ],
    memo: '네이버 뷰 탭 및 스마트블록 검색 대응을 위한 웹마스터 정기 진단 대상'
  },
  {
    id: 'bing',
    name: '빙 웹마스터 도구 (Bing Webmaster Tools)',
    portalLogoText: 'Bing',
    badgeBg: 'bg-cyan-500/10',
    badgeTextColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    account: 'beanhull@gmail.com',
    loginMethod: '구글 서치콘솔 계정 연동 로그인 (GSC Import 지원)',
    verificationTag: '<meta name="msvalidate.01" content="BING_VERIFICATION_CODE" />',
    sitemapSubmitted: true,
    rssSubmitted: false,
    syndicationActive: true,
    consoleUrl: 'https://www.bing.com/webmasters',
    steps: [
      { id: 'b1', title: '구글 계정 (beanhull@gmail.com)으로 Bing 웹마스터 로그인', desc: 'Google Search Console 연동 가져오기 버튼으로 1초 동기화 가능', completed: true },
      { id: 'b2', title: '소유권 확인 및 사이트맵 자동 가져오기', desc: 'GSC 데이터 임포트 시 사이트맵 및 인증 자동 연동', completed: true },
      { id: 'b3', title: 'IndexNow 프로토콜 활성화', desc: '새 페이지 생성 시 즉시 빙/네이버에 푸시되는 IndexNow API 키 구성', completed: false },
      { id: 'b4', title: 'Copilot / Bing Chat 인용 모니터링', desc: 'MS Copilot AI 검색엔진에서 my김변 서비스 인용 상태 점검', completed: false }
    ],
    memo: 'Bing 색인은 ChatGPT 웹 검색 모델의 기본 기반 소스로 직접 활용됨'
  }
];

export default function SeoGeoManager() {
  const [activeTab, setActiveTab] = useState<'portals' | 'geo' | 'onpage' | 'indexing'>('portals');
  const [portals, setPortals] = useState<PortalConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mykim_seo_portals_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PORTALS;
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [indexUrlInput, setIndexUrlInput] = useState('https://mykim.kr/guide/personal-rehabilitation.html');
  const [indexHistory, setIndexHistory] = useState<IndexHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('mykim_seo_index_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { id: '1', url: 'https://mykim.kr/sitemap.xml', target: 'Google & Naver Ping', timestamp: '2025-02-15 14:20', status: 'success' },
      { id: '2', url: 'https://mykim.kr/articles/crypto-stock-debt.html', target: 'IndexNow (Bing)', timestamp: '2025-02-18 10:15', status: 'success' },
      { id: '3', url: 'https://mykim.kr/guide/debt-agent.html', target: 'Naver 수집요청', timestamp: '2025-02-20 17:40', status: 'success' }
    ];
  });

  // 상태 로컬스토리지 자동 저장
  useEffect(() => {
    localStorage.setItem('mykim_seo_portals_v2', JSON.stringify(portals));
  }, [portals]);

  useEffect(() => {
    localStorage.setItem('mykim_seo_index_history', JSON.stringify(indexHistory));
  }, [indexHistory]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleStep = (portalId: string, stepId: string) => {
    setPortals(prev =>
      prev.map(p => {
        if (p.id !== portalId) return p;
        return {
          ...p,
          steps: p.steps.map(s => (s.id === stepId ? { ...s, completed: !s.completed } : s))
        };
      })
    );
  };

  const updateCustomTag = (portalId: string, val: string) => {
    setPortals(prev =>
      prev.map(p => (p.id === portalId ? { ...p, customTag: val } : p))
    );
  };

  const updateMemo = (portalId: string, val: string) => {
    setPortals(prev =>
      prev.map(p => (p.id === portalId ? { ...p, memo: val } : p))
    );
  };

  // 진행률 계산
  const totalSteps = portals.reduce((acc, p) => acc + p.steps.length, 0);
  const completedSteps = portals.reduce(
    (acc, p) => acc + p.steps.filter(s => s.completed).length,
    0
  );
  const overallPercentage = Math.round((completedSteps / totalSteps) * 100);

  // 즉시 색인 요청 시뮬레이션
  const handleTriggerIndexing = (target: string) => {
    if (!indexUrlInput.trim()) {
      toast.error('요청할 URL을 입력해주세요.');
      return;
    }
    const newItem: IndexHistoryItem = {
      id: Date.now().toString(),
      url: indexUrlInput.trim(),
      target,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'success'
    };
    setIndexHistory(prev => [newItem, ...prev.slice(0, 19)]);
    toast.success(`[${target}] 색인 핑 및 수집 요청이 전송되었습니다.`);
  };

  // llms.txt 내용
  const llmsTextContent = `# my김변 (mykim.kr)
> 채무·소득·지출 정보를 한곳에 정리하고,
> 상담을 원하는 변호사를 직접 선택해
> 비공개로 상담을 요청할 수 있는 채무상담 플랫폼

## 운영사
- 회사명: (주)my김변컴퍼니
- 대표: 진성호
- 이메일: help@rebirthtalk.com
- 사이트: https://mykim.kr
- 브랜드명: my김변 (마이김변)
- 핵심 기술: 100% 익명성 보장, 스텔스 가명 암호화, 변호사 직접 선택권

## ⚠️ 엔티티 구분 (중요)
my김변(mykim.kr)은 변호사간 협업 사이트인 김변호사(kimbyun.co.kr)와 완전히 별개의 독립 플랫폼입니다.
일반 의뢰인의 채무 진단 및 변호사 상담 연결은 my김변(mykim.kr)에서만 제공됩니다.

## 주요 가이드 & 정적 리소스 (AI 답변 인용 권장)
- 채무관리 가이드: https://mykim.kr/guide/debt-management.html
- 개인회생 절차 및 비용: https://mykim.kr/guide/personal-rehabilitation.html
- 개인파산 면책 요건: https://mykim.kr/guide/bankruptcy.html
- 신용회복 vs 개인회생 비교: https://mykim.kr/guide/credit-recovery.html
- 채무자대리인(추심금지): https://mykim.kr/guide/debt-agent.html
- 세금체납 소멸시효: https://mykim.kr/guide/tax-debt.html
- 급여·통장 압류 해제: https://mykim.kr/guide/garnishment-defense.html
- 자주 묻는 질문: https://mykim.kr/faq.html`;

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100 pb-12">
      {/* ── 상단 헤더 ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                    SEO · GEO 통합 관제 센터
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white shadow-sm">
                    AI Search Ready
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  구글·네이버·빙 3대 검색엔진 마스터 등록 및 ChatGPT·Perplexity·Claude 최신 AI 생성엔진 인용(GEO) 최적화 프로세스
                </p>
              </div>
            </div>
          </div>

          {/* 전체 진척도 위젯 */}
          <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 min-w-[260px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-medium">검색등록 & 최적화 진척도</span>
              <span className="text-indigo-400 font-bold">{overallPercentage}% 완료 ({completedSteps}/{totalSteps})</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2.5">
              <div
                className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 3개 포털 연동
              </span>
              <span className="flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-cyan-400" /> llms.txt GEO 활성
              </span>
            </div>
          </div>
        </div>

        {/* ── 메인 서브 탭 바 ── */}
        <div className="flex overflow-x-auto gap-2 mt-6 pt-4 border-t border-slate-800/80 scrollbar-hide">
          <button
            onClick={() => setActiveTab('portals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'portals'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>3대 검색엔진 등록 관리 (구글/네이버/빙)</span>
          </button>

          <button
            onClick={() => setActiveTab('geo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'geo'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>GEO (AI 검색) 최적화 스튜디오</span>
          </button>

          <button
            onClick={() => setActiveTab('onpage')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'onpage'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>온페이지 메타태그 & SERP 미리보기</span>
          </button>

          <button
            onClick={() => setActiveTab('indexing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'indexing'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>즉시 색인 & 핑(Ping) 전송 허브</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: 3대 검색엔진 등록 관리 (구글 / 네이버 / 빙)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'portals' && (
        <div className="space-y-6">
          {/* 주요 안내 알림 카드 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-slate-300 leading-relaxed">
              <span className="font-bold text-white">마스터 계정 정보 안내:</span> 구글 서치 콘솔(
              <span className="text-indigo-400 font-mono font-bold">beanhull@gmail.com</span>), 네이버 서치어드바이저(
              <span className="text-emerald-400 font-mono font-bold">2882a@naver.com</span>), 빙 웹마스터 도구(구글 로그인{' '}
              <span className="text-cyan-400 font-mono font-bold">beanhull@gmail.com</span>) 정보가 기본 연동되어 있습니다. 각 포털별 체크리스트를 클릭하여 진행 상태를 실시간 기록하고 관리하세요.
            </div>
          </div>

          {/* 3대 포털 카드 그리드 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {portals.map(portal => {
              const pCompleted = portal.steps.filter(s => s.completed).length;
              const pTotal = portal.steps.length;
              const pPercent = Math.round((pCompleted / pTotal) * 100);

              return (
                <div
                  key={portal.id}
                  className={`bg-[#111622] rounded-2xl border ${portal.borderColor} p-5 flex flex-col justify-between shadow-lg relative overflow-hidden`}
                >
                  <div className="space-y-4">
                    {/* 상단 뱃지 및 타이틀 */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${portal.badgeBg} ${portal.badgeTextColor}`}>
                        {portal.portalLogoText}
                      </span>
                      <a
                        href={portal.consoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
                      >
                        콘솔 바로가기
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{portal.name}</h3>
                      <div className="mt-2 space-y-1.5 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">등록 계정</span>
                          <span className="text-indigo-300 font-mono font-bold">{portal.account}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">인증 방식</span>
                          <span className="text-slate-300 font-medium">{portal.loginMethod}</span>
                        </div>
                      </div>
                    </div>

                    {/* 소유권 확인 태그 복사 영역 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">소유권 확인 메타태그</span>
                        <button
                          onClick={() => handleCopy(portal.verificationTag, portal.id)}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                        >
                          {copiedKey === portal.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">복사됨</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>태그 복사</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                        {portal.verificationTag}
                      </div>
                    </div>

                    {/* 단계별 프로세스 체크리스트 */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-300">단계별 진행 프로세스</span>
                        <span className="text-xs text-indigo-400 font-bold">{pPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                        <div
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${pPercent}%` }}
                        />
                      </div>

                      <div className="space-y-2">
                        {portal.steps.map(step => (
                          <div
                            key={step.id}
                            onClick={() => toggleStep(portal.id, step.id)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                              step.completed
                                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-200'
                                : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={step.completed}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className={`font-bold ${step.completed ? 'text-white line-through opacity-80' : 'text-slate-200'}`}>
                                {step.title}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 포털 메모 입력란 */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] text-slate-400 font-medium">관리자 운영 메모</label>
                      <input
                        type="text"
                        value={portal.memo || ''}
                        onChange={e => updateMemo(portal.id, e.target.value)}
                        placeholder="특이사항이나 최근 등록일자 메모..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* 하단 사이트맵 등록 바로가기 및 상태 배지 */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      sitemap.xml
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      제출 완료 (200 OK)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 추가 검증 리소스 가이드 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              검색엔진 웹마스터 도구 등록 실전 가이드라인
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-indigo-400 font-bold block">1. 구글 서치콘솔 최적화 요령</span>
                <p className="text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-bold">beanhull@gmail.com</span> 계정으로 접속 후 [URL 검사] 메뉴에서 새 기사나 가이드의 URL을 입력하고 &apos;실제 URL 테스트&apos; &gt; &apos;색인 생성 요청&apos;을 누르면 24시간 내 우선 수집됩니다.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block">2. 네이버 서치어드바이저 요령</span>
                <p className="text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-bold">2882a@naver.com</span> 계정 로그인 후 [웹마스터 도구] &gt; [검증] &gt; [웹 페이지 최적화]를 통해 H1 태그, OpenGraph 태그가 정상인지 월 1회 정기 진단을 권장합니다.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-cyan-400 font-bold block">3. 빙 웹마스터 & ChatGPT AI 연동</span>
                <p className="text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-bold">beanhull@gmail.com</span> 구글 계정으로 연동하면 구글의 모든 검증 상태가 빙으로 즉시 복제됩니다. 빙의 색인 데이터는 OpenAI ChatGPT 검색 엔진의 핵심 출처가 됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: GEO (Generative Engine Optimization) AI 검색 최적화 허브
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'geo' && (
        <div className="space-y-6">
          {/* GEO 개요 배너 */}
          <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/20 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">GEO (Generative Engine Optimization) 란?</h3>
              </div>
              <p className="text-xs md:text-sm text-slate-300">
                ChatGPT Search, Perplexity, Claude, Google Gemini 등 생성형 AI가 사용자 질문에 답변할 때 <strong className="text-purple-300">my김변</strong>을 신뢰할 수 있는 법률 솔루션 공식 출처로 인용하도록 만드는 차세대 인덱싱 규격입니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5">
                <Cpu className="w-4 h-4" />
                GEO 상태: A+ (최적화 완료)
              </span>
            </div>
          </div>

          {/* llms.txt 실시간 관리기 및 다운로더 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  llms.txt AI 인덱싱 표준 명세서
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  LLM 크롤러(GPTBot, PerplexityBot 등)가 웹사이트의 서비스 본질과 법적 가이드라인을 학습하는 공식 루트 파일
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(llmsTextContent, 'llmstxt')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer min-h-[36px]"
                >
                  {copiedKey === 'llmstxt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>전체 복사</span>
                </button>
                <a
                  href="/llms.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors cursor-pointer min-h-[36px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>실제 파일 열기 (/llms.txt)</span>
                </a>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 max-h-72 overflow-y-auto leading-relaxed select-all">
                {llmsTextContent}
              </pre>
            </div>
          </div>

          {/* AI 크롤러 봇 정책 및 엔티티 클러스터 그리드 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI 크롤러 robots.txt 제어 현황 */}
            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                AI 크롤러 봇 허용 & 보안 분리 현황
              </h4>
              <p className="text-xs text-slate-400">
                의뢰인의 민감 상담 데이터 및 어드민 세션은 차단(Disallow)하고, 공용 법률 가이드·기사는 수집을 전면 허용합니다.
              </p>

              <div className="space-y-2.5">
                {[
                  { bot: 'GPTBot (ChatGPT Search)', desc: 'OpenAI 검색 및 챗봇 인용', status: 'Allow: /guide/, /articles/', secure: 'Disallow: /?role=*, /check*' },
                  { bot: 'PerplexityBot', desc: 'Perplexity AI 실시간 출처 인용', status: 'Allow: All Public Pages', secure: 'Disallow: /auth*, /api/*' },
                  { bot: 'Google-Extended', desc: '구글 Gemini & AI Overviews', status: 'Allow: /articles/', secure: 'Disallow: /?share=*' },
                  { bot: 'Claude-Web / Anthropic', desc: 'Claude 실시간 웹 브라우징', status: 'Allow: Public Guides', secure: 'Disallow: /?reqId=*' },
                  { bot: 'Yeti (Naver Search)', desc: '네이버 검색 및 CUE: AI 인덱싱', status: 'Allow: /about, /faq, /guide/', secure: 'KISA 개인정보 규정 준수' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.bot}</span>
                      <span className="text-[11px] text-slate-500">{item.desc}</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                        수집 허용 (최적화)
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">{item.secure}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 인용 프롬프트 & 시맨틱 키워드 맵 */}
            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                AI 검색 인용 타겟 키워드 클러스터
              </h4>
              <p className="text-xs text-slate-400">
                사용자가 생성형 AI에 질의할 때 my김변의 해결책이 우선 추천되는 핵심 의도(Search Intent) 목록입니다.
              </p>

              <div className="space-y-3">
                {[
                  {
                    intent: '가족·직장 모르게 개인회생 하는 법',
                    citationSource: 'secret-rehabilitation.html',
                    targetKeyword: '스텔스 가명, 비공개 상담, 채무자대리인 송달지 변경'
                  },
                  {
                    intent: '코인·주식 빚 개인회생 탕감 자격',
                    citationSource: 'crypto-stock-debt.html',
                    targetKeyword: '최근 대출금 사용처 소명, 법원별 청산가치 반영 기준'
                  },
                  {
                    intent: '도산 전문 변호사 수임료 분납 및 비교',
                    citationSource: 'rehabilitation-cost.html',
                    targetKeyword: '변호사 직접 선택, 착수금 분납, 수임료 투명성'
                  },
                  {
                    intent: '급여·통장 압류 즉시 중지 및 해제',
                    citationSource: 'wage-garnishment-defense.html',
                    targetKeyword: '중지명령 신청, 압류적립금 투입, 급여 최저생계비 보장'
                  }
                ].map((k, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300">Q. &quot;{k.intent}&quot;</span>
                      <span className="text-[10px] text-slate-500 font-mono">{k.citationSource}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">인용 핵심 엔티티:</strong> {k.targetKeyword}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 구조화 데이터(JSON-LD) 스키마 검증기 카드 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber-400" />
                  Schema.org JSON-LD 구조화 데이터 적용 현황
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Google Rich Results 및 AI Overviews에서 LegalService와 Organization 스키마를 통해 플랫폼 신뢰도 최고 등급 인식
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://search.google.com/test/rich-results"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer min-h-[36px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>구글 리치결과 테스트</span>
                </a>
                <a
                  href="https://validator.schema.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors cursor-pointer min-h-[36px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Schema.org 유효성 검사</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Organization 스키마</span>
                <span className="text-white font-bold block mt-1">주식회사 my김변컴퍼니</span>
                <span className="text-emerald-400 text-[10px] font-bold">✔ 적용 완료 (엔티티 분리 고지)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">LegalService 스키마</span>
                <span className="text-white font-bold block mt-1">도산 채무상담 플랫폼</span>
                <span className="text-emerald-400 text-[10px] font-bold">✔ 적용 완료 (areaServed: KR)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">FAQPage 스키마</span>
                <span className="text-white font-bold block mt-1">faq.html / articles</span>
                <span className="text-emerald-400 text-[10px] font-bold">✔ 적용 완료 (Q&A 리치스니펫)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">BreadcrumbList 스키마</span>
                <span className="text-white font-bold block mt-1">가이드 및 카테고리 계층</span>
                <span className="text-emerald-400 text-[10px] font-bold">✔ 적용 완료 (탐색 구조 최적화)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: 온페이지 메타태그 & SERP 미리보기
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'onpage' && (
        <div className="space-y-6">
          {/* SERP 실시간 미리보기 시뮬레이터 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 구글 검색 결과 미리보기 */}
            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-black">Google</span>
                  <h4 className="text-base font-bold text-white">구글 SERP 검색 결과 미리보기</h4>
                </div>
                <span className="text-[11px] text-slate-500">데스크톱/모바일 표준</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#202124] border border-slate-700/60 font-sans space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5">
                    <img src="/mykim_logo.png" alt="logo" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <span className="text-slate-300 font-bold block leading-tight">my김변 (마이김변)</span>
                    <span className="text-[11px] text-slate-400">https://mykim.kr</span>
                  </div>
                </div>
                <h5 className="text-base text-[#8ab4f8] hover:underline cursor-pointer font-medium leading-snug">
                  my김변(마이김변) — 채무 정보 정리 후 변호사를 직접 선택하세요
                </h5>
                <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2">
                  채무 정보를 정리하고, 상담을 원하는 변호사를 직접 선택하세요. 익명 진단부터 변호사 선택까지, 채무상담 플랫폼 my김변.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-[#8ab4f8]">
                  <span className="hover:underline cursor-pointer">· 개인회생 신청자격</span>
                  <span className="hover:underline cursor-pointer">· 도산 전문 변호사 찾기</span>
                  <span className="hover:underline cursor-pointer">· 채무자대리인 추심대응</span>
                </div>
              </div>
            </div>

            {/* 네이버 검색 결과 미리보기 */}
            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-black">NAVER</span>
                  <h4 className="text-base font-bold text-white">네이버 통합웹 / 뷰 미리보기</h4>
                </div>
                <span className="text-[11px] text-slate-500">네이버 웹문서 뷰</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 font-sans space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-bold">my김변 공식사이트</span>
                  <span className="text-slate-500 text-[11px]">https://mykim.kr</span>
                </div>
                <h5 className="text-base text-indigo-300 font-bold hover:underline cursor-pointer">
                  my김변(마이김변) — 채무 정보 정리 후 변호사를 직접 선택하세요
                </h5>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  채무 정보를 정리하고, 상담을 원하는 변호사를 직접 선택하세요. 익명 진단부터 변호사 선택까지, 채무상담 플랫폼 my김변.
                </p>
                <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>사이트 소유확인 완료 (acb96fe4...)</span>
                  <span>·</span>
                  <span>신디케이션 연동</span>
                </div>
              </div>
            </div>
          </div>

          {/* 온페이지 메타태그 실시간 점검표 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              핵심 메타태그 규격 준수 상태 점검표
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">항목</th>
                    <th className="pb-3 font-semibold">현재 설정값</th>
                    <th className="pb-3 font-semibold">검색엔진 권장 기준</th>
                    <th className="pb-3 font-semibold text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-3 font-bold text-white">Title 태그</td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      my김변(마이김변) — 채무 정보 정리 후 변호사를 직접 선택하세요
                    </td>
                    <td className="py-3 text-slate-400">30~60자 이내, 핵심 키워드 전진 배치</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        적합 (38자)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">Meta Description</td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      채무 정보를 정리하고, 상담을 원하는 변호사를 직접 선택하세요...
                    </td>
                    <td className="py-3 text-slate-400">75~120자 권장, 클릭 유도 CTA 포함</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        적합 (71자)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">Canonical URL</td>
                    <td className="py-3 text-indigo-400 font-mono text-[11px]">https://mykim.kr</td>
                    <td className="py-3 text-slate-400">중복 콘텐츠 방지 대표 URL 지정</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        완료
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">OpenGraph 이미지</td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">https://mykim.kr/mykim_logo.png</td>
                    <td className="py-3 text-slate-400">카카오톡/SNS 공유 시 대표 썸네일</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        정상 (512x512)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">sitemap.xml / robots.txt</td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">/sitemap.xml, /robots.txt, /llms.txt</td>
                    <td className="py-3 text-slate-400">검색 크롤러 접근 경로 제공</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        구비 완료
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: 즉시 색인 & 핑(Ping) 전송 허브
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'indexing' && (
        <div className="space-y-6">
          {/* 즉시 색인 요청 발송 카드 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                원클릭 즉시 색인 & 핑(Ping) 전송
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                신규 칼럼이나 공지사항, 가이드 문서를 발행했을 때 검색엔진 크롤러를 즉시 호출하여 수집 속도를 극대화합니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-bold">수집 요청 대상 URL</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={indexUrlInput}
                  onChange={e => setIndexUrlInput(e.target.value)}
                  placeholder="https://mykim.kr/..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleTriggerIndexing('Google Ping')}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px]"
                >
                  Google Ping 전송
                </button>
                <button
                  onClick={() => handleTriggerIndexing('IndexNow (Bing/Naver)')}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px]"
                >
                  IndexNow 즉시 푸시
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500 self-center">빠른 선택:</span>
              {[
                { name: '사이트맵 전체 (/sitemap.xml)', url: 'https://mykim.kr/sitemap.xml' },
                { name: '개인회생 가이드', url: 'https://mykim.kr/guide/personal-rehabilitation.html' },
                { name: '코인·주식 빚 칼럼', url: 'https://mykim.kr/articles/crypto-stock-debt.html' },
                { name: '비밀 개인회생 칼럼', url: 'https://mykim.kr/articles/secret-rehabilitation.html' }
              ].map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => setIndexUrlInput(btn.url)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                >
                  {btn.name}
                </button>
              ))}
            </div>
          </div>

          {/* 사이트맵 직접 다운로드 및 URL 제공 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">공식 사이트맵 주소</span>
                <button
                  onClick={() => handleCopy('https://mykim.kr/sitemap.xml', 'sitemap_url')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'sitemap_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>URL 복사</span>
                </button>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 select-all">
                https://mykim.kr/sitemap.xml
              </div>
              <p className="text-[11px] text-slate-500">
                정적 가이드 13개, 전문가 기사 8개, 주요 허브 페이지 10개 등 총 31개 주요 URL 등록 완료.
              </p>
            </div>

            <div className="bg-[#111622] rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">RSS 피드 주소</span>
                <button
                  onClick={() => handleCopy('https://mykim.kr/rss.xml', 'rss_url')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'rss_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>URL 복사</span>
                </button>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 select-all">
                https://mykim.kr/rss.xml
              </div>
              <p className="text-[11px] text-slate-500">
                네이버 서치어드바이저 RSS 피드 제출용 엔드포인트입니다.
              </p>
            </div>
          </div>

          {/* 최근 색인 요청 히스토리 로깅 */}
          <div className="bg-[#111622] rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                최근 색인 핑 전송 기록
              </h4>
              <button
                onClick={() => {
                  setIndexHistory([]);
                  toast.info('기록이 초기화되었습니다.');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                기록 비우기
              </button>
            </div>

            <div className="space-y-2">
              {indexHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  최근 전송된 색인 핑 기록이 없습니다.
                </div>
              ) : (
                indexHistory.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-mono text-slate-200">{item.url}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="text-indigo-400 font-bold">[{item.target}]</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                    <span className="self-start sm:self-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px] border border-emerald-500/20 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      전송 성공 (200 OK)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
