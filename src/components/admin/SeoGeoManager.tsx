import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe, Search, Bot, CheckCircle2, Clock, ExternalLink, Copy, Check, FileText, RefreshCw, Sparkles, Key,
  AlertTriangle, Send, Download, Eye, ShieldCheck, TrendingUp, Info, Code, XCircle, Loader2, Activity, Rss, ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SITE_ORIGIN, INDEXNOW_KEY, runSiteDiagnostics, crawlUrls, urlKey, displayWidth,
  type SiteDiagnostics, type CheckStatus, type SeoCheck, type CrawlResult, type ManifestPage,
} from './seo/seoDiagnostics';
import { submitIndexNow, type IndexNowEngineResult } from '../../services/indexNowService';

// ============================================================
// [SEO/GEO] 통합 관제센터
// ------------------------------------------------------------
// 이전 버전의 문제 (점검 결과)
//  - '제출 완료 (200 OK)', 'GEO 상태 A+', 'AI 봇 수집 허용', 'LegalService 적용 완료' 등이 모두 하드코딩 → 실제와 무관
//  - 'Google Ping 전송'·'IndexNow 즉시 푸시' 버튼은 아무 요청도 보내지 않음 (Google sitemap ping은 2023년 종료)
//  - 화면의 llms.txt는 실제 파일과 다른 복사본, rss.xml은 존재하지 않는 파일을 안내
//  - index.html의 구글/빙 인증 태그는 'pending' 가짜 값
// 현재
//  - 실시간 진단: 배포된 사이트 파일을 직접 읽어 판정 (seo/seoDiagnostics.ts)
//  - IndexNow: 서버(/api/generate-statement mode=indexnow)가 Bing·Naver에 실제 전송, 결과 기록
//  - sitemap.xml·rss.xml·seo-manifest.json 은 빌드 시 scripts/seo-build.mjs 가 자동 생성
//  - 검색엔진 콘솔 내부 상태(제출·색인 수)는 외부에서 알 수 없으므로 관리자 체크리스트로 기록 (이 브라우저에만 저장)
// ============================================================

type TabId = 'health' | 'portals' | 'geo' | 'onpage' | 'indexing';
type PortalId = 'google' | 'naver' | 'bing';

interface PortalStep { id: string; title: string; desc: string; checkId?: string }
interface PortalDef {
  id: PortalId;
  name: string;
  badge: string;
  badgeClass: string;
  borderClass: string;
  defaultAccount: string;
  loginMethod: string;
  consoleUrl: string;
  verifyMeta?: string;
  verifyEnv?: string;
  steps: PortalStep[];
}
interface PortalState { account: string; memo: string; done: Record<string, boolean>; verifyCode: string }

const PORTALS: PortalDef[] = [
  {
    id: 'google',
    name: '구글 서치 콘솔',
    badge: 'GOOGLE',
    badgeClass: 'bg-blue-500/10 text-blue-400',
    borderClass: 'border-blue-500/30',
    defaultAccount: '회사 관리 Google 계정',
    loginMethod: '구글 계정 직접 로그인',
    consoleUrl: 'https://search.google.com/search-console',
    verifyMeta: 'google-site-verification',
    verifyEnv: 'GOOGLE_SITE_VERIFICATION',
    steps: [
      { id: 'g1', title: '속성 추가 (도메인 속성 권장)', desc: 'mykim.kr 도메인 속성 추가 — www·http 변형까지 한 번에 관리' },
      { id: 'g2', title: '소유권 확인', desc: 'DNS TXT 레코드 또는 HTML 태그(아래 입력기) 방식', checkId: 'verify-google' },
      { id: 'g3', title: 'sitemap.xml 제출', desc: '[Sitemaps] 메뉴에 https://mykim.kr/sitemap.xml 제출', checkId: 'sitemap' },
      { id: 'g4', title: '핵심 URL 색인 요청', desc: '[URL 검사]로 새 가이드·칼럼 색인 요청 (색인 탭의 바로가기 사용)' },
      { id: 'g5', title: '페이지 색인 보고서 월간 점검', desc: '[페이지] 보고서의 "색인이 생성되지 않음" 사유 확인' },
    ],
  },
  {
    id: 'naver',
    name: '네이버 서치어드바이저',
    badge: 'NAVER',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
    borderClass: 'border-emerald-500/30',
    defaultAccount: '2882a@naver.com',
    loginMethod: '네이버 계정 직접 로그인',
    consoleUrl: 'https://searchadvisor.naver.com/console/board',
    verifyMeta: 'naver-site-verification',
    steps: [
      { id: 'n1', title: '사이트 등록', desc: '웹마스터 도구에 https://mykim.kr 등록' },
      { id: 'n2', title: '사이트 소유 확인', desc: 'index.html의 naver-site-verification 메타태그', checkId: 'verify-naver' },
      { id: 'n3', title: 'sitemap.xml 제출', desc: '요청 > 사이트맵 제출', checkId: 'sitemap' },
      { id: 'n4', title: 'RSS 제출', desc: '요청 > RSS 제출 (https://mykim.kr/rss.xml)', checkId: 'rss' },
      { id: 'n5', title: '웹 페이지 수집 요청 / IndexNow', desc: '새 글은 색인 탭의 IndexNow로 자동 전달, 필요 시 수동 수집 요청' },
    ],
  },
  {
    id: 'bing',
    name: '빙 웹마스터 도구',
    badge: 'BING',
    badgeClass: 'bg-cyan-500/10 text-cyan-400',
    borderClass: 'border-cyan-500/30',
    defaultAccount: '회사 관리 Google 계정 (연동 로그인)',
    loginMethod: 'Google 계정 연동 · GSC 가져오기 지원',
    consoleUrl: 'https://www.bing.com/webmasters',
    verifyMeta: 'msvalidate.01',
    verifyEnv: 'BING_SITE_VERIFICATION',
    steps: [
      { id: 'b1', title: 'GSC에서 사이트 가져오기', desc: '구글 서치 콘솔 연동 시 소유권·사이트맵이 함께 넘어옴', checkId: 'verify-bing' },
      { id: 'b2', title: 'sitemap.xml 확인', desc: '[Sitemaps]에 https://mykim.kr/sitemap.xml 등록 여부 확인', checkId: 'sitemap' },
      { id: 'b3', title: 'IndexNow 키 확인', desc: `[IndexNow] 메뉴에서 키 ${INDEXNOW_KEY.slice(0, 8)}… 수신 여부 확인`, checkId: 'indexnow-key' },
      { id: 'b4', title: 'Copilot·ChatGPT 검색 인용 점검', desc: 'Bing 색인은 ChatGPT·Copilot 웹 검색의 주요 출처 — GEO 탭의 질의로 확인' },
    ],
  },
];

const STORAGE_PORTALS = 'mykim_seo_portals_v3';
const STORAGE_PORTALS_V2 = 'mykim_seo_portals_v2';
const STORAGE_HISTORY = 'mykim_seo_indexnow_history_v1';
const STORAGE_GSC_PROPERTY = 'mykim_seo_gsc_property';

interface IndexHistoryItem { id: string; at: string; urls: string[]; ok: boolean; results: IndexNowEngineResult[]; error?: string }

function loadPortalState(): Record<PortalId, PortalState> {
  const base = Object.fromEntries(PORTALS.map(p => [p.id, { account: p.defaultAccount, memo: '', done: {}, verifyCode: '' }])) as Record<PortalId, PortalState>;
  try {
    const saved = localStorage.getItem(STORAGE_PORTALS);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Record<PortalId, Partial<PortalState>>>;
      for (const p of PORTALS) base[p.id] = { ...base[p.id], ...(parsed[p.id] || {}), done: { ...(parsed[p.id]?.done || {}) } };
      return base;
    }
    // v2(이전 버전) 기록에서 메모·체크만 이어받음
    const v2 = localStorage.getItem(STORAGE_PORTALS_V2);
    if (v2) {
      const arr = JSON.parse(v2) as { id: PortalId; memo?: string; steps?: { id: string; completed: boolean }[] }[];
      for (const old of arr) {
        if (!base[old.id]) continue;
        base[old.id].memo = old.memo || '';
        for (const s of old.steps || []) if (s.completed) base[old.id].done[s.id] = true;
      }
    }
  } catch { /* 손상된 기록은 무시 */ }
  return base;
}

function loadHistory(): IndexHistoryItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_HISTORY);
    return saved ? (JSON.parse(saved) as IndexHistoryItem[]).slice(0, 50) : [];
  } catch {
    return [];
  }
}

const STATUS_STYLE: Record<CheckStatus, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  pass: { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: '정상', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: '확인 필요', Icon: AlertTriangle },
  fail: { cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30', label: '문제', Icon: XCircle },
};

function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${s.cls}`}>
      <s.Icon className="w-3 h-3" aria-hidden="true" />
      {label || s.label}
    </span>
  );
}

const card = 'bg-[#111622] rounded-2xl border border-slate-800 p-5 md:p-6';
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors cursor-pointer min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed';

/** AI 검색 인용 점검 질의 — 인용 목표 페이지는 manifest로 존재 여부 확인 */
const GEO_QUERIES = [
  { q: '가족이나 회사 모르게 개인회생 할 수 있나요?', target: `${SITE_ORIGIN}/articles/secret-rehabilitation.html`, entities: '비공개 상담, 가명 상담, 송달 주소' },
  { q: '코인·주식 투자 손실 빚도 개인회생 되나요?', target: `${SITE_ORIGIN}/articles/crypto-stock-debt.html`, entities: '투자 손실 소명, 청산가치' },
  { q: '개인회생 변호사 비용과 분납은 어떻게 되나요?', target: `${SITE_ORIGIN}/guide/rehabilitation-cost.html`, entities: '수임료 구성, 분납, 변호사 직접 선택' },
  { q: '급여 압류 통지를 받았는데 멈출 수 있나요?', target: `${SITE_ORIGIN}/articles/wage-garnishment-defense.html`, entities: '중지명령, 금지명령, 압류 적립금' },
  { q: '개인회생 신청 자격 조건이 뭔가요?', target: `${SITE_ORIGIN}/guide/rehabilitation-eligibility.html`, entities: '소득 요건, 채무 한도, 청산가치' },
];

export default function SeoGeoManager() {
  const [tab, setTab] = useState<TabId>('health');
  const [diag, setDiag] = useState<SiteDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [crawl, setCrawl] = useState<CrawlResult[] | null>(null);
  const [crawlDone, setCrawlDone] = useState<number | null>(null);
  const [portalState, setPortalState] = useState<Record<PortalId, PortalState>>(loadPortalState);
  const [history, setHistory] = useState<IndexHistoryItem[]>(loadHistory);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [indexUrls, setIndexUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gscProperty, setGscProperty] = useState<string>(() => localStorage.getItem(STORAGE_GSC_PROPERTY) || 'sc-domain:mykim.kr');
  const [selectedPageUrl, setSelectedPageUrl] = useState<string>('');
  const [simTitle, setSimTitle] = useState('');
  const [simDesc, setSimDesc] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_PORTALS, JSON.stringify(portalState)); }, [portalState]);
  useEffect(() => { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 50))); }, [history]);
  useEffect(() => { localStorage.setItem(STORAGE_GSC_PROPERTY, gscProperty); }, [gscProperty]);

  const refresh = useCallback(async () => {
    setDiagLoading(true);
    try {
      setDiag(await runSiteDiagnostics());
    } catch (e) {
      toast.error(`진단에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDiagLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const checkById = useMemo(() => new Map((diag?.checks || []).map(c => [c.id, c])), [diag]);
  const pages: ManifestPage[] = diag?.manifest?.pages || [];
  const pageByKey = useMemo(() => new Map(pages.map(p => [urlKey(p.url), p])), [pages]);
  const selectedPage = pages.find(p => p.url === selectedPageUrl) || pages[0];

  useEffect(() => {
    if (selectedPage) {
      setSimTitle(selectedPage.title);
      setSimDesc(selectedPage.description);
    }
  }, [selectedPage?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('클립보드에 복사했습니다.');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('복사하지 못했습니다. 직접 선택해 복사해 주세요.');
    }
  };
  const CopyBtn = ({ text, k, label = '복사' }: { text: string; k: string; label?: string }) => (
    <button type="button" onClick={() => handleCopy(text, k)} className={btnGhost}>
      {copiedKey === k ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
      <span>{copiedKey === k ? '복사됨' : label}</span>
    </button>
  );

  const updatePortal = (id: PortalId, patch: Partial<PortalState>) =>
    setPortalState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggleStep = (id: PortalId, stepId: string) =>
    setPortalState(prev => ({ ...prev, [id]: { ...prev[id], done: { ...prev[id].done, [stepId]: !prev[id].done[stepId] } } }));

  const totalSteps = PORTALS.reduce((s, p) => s + p.steps.length, 0);
  const doneSteps = PORTALS.reduce((s, p) => s + p.steps.filter(st => portalState[p.id].done[st.id]).length, 0);
  const checklistPct = Math.round((doneSteps / totalSteps) * 100);

  // ── IndexNow ──
  const lastSubmitted = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of [...history].reverse()) if (h.ok) for (const u of h.urls) m.set(u, h.at);
    return m;
  }, [history]);
  /** 마지막 IndexNow 전송 이후 lastmod가 바뀐 URL */
  const changedSinceSubmit = useMemo(() => (diag?.sitemap || []).filter(s => {
    const at = lastSubmitted.get(s.url);
    return !at || (s.lastmod && s.lastmod > at.slice(0, 10));
  }).map(s => s.url), [diag, lastSubmitted]);

  const parsedIndexUrls = indexUrls.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  const handleSubmitIndexNow = async () => {
    const urls = [...new Set(parsedIndexUrls)];
    const invalid = urls.filter(u => !u.startsWith(`${SITE_ORIGIN}/`) && u !== SITE_ORIGIN);
    if (!urls.length) { toast.error('전송할 URL을 입력해 주세요.'); return; }
    if (invalid.length) { toast.error(`${SITE_ORIGIN} 주소만 보낼 수 있습니다: ${invalid[0]}`); return; }
    if (urls.length > 100) { toast.error('한 번에 100개까지 보낼 수 있습니다.'); return; }
    setSubmitting(true);
    const res = await submitIndexNow(urls);
    setSubmitting(false);
    const item: IndexHistoryItem = {
      id: `${Date.now()}`,
      at: new Date().toISOString(),
      urls: res.urls?.length ? res.urls : urls,
      ok: res.ok,
      results: res.results || [],
      error: res.ok === false ? res.error : undefined,
    };
    setHistory(prev => [item, ...prev].slice(0, 50));
    if (res.ok === false) toast.error(res.error);
    else toast.success(`IndexNow 전송 완료: ${item.urls.length}개 URL`);
  };

  const gscInspectUrl = (u: string) =>
    `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(gscProperty)}&id=${encodeURIComponent(u)}`;

  const handleCrawl = async () => {
    const urls = (diag?.sitemap || []).map(s => s.url);
    if (!urls.length) { toast.error('sitemap.xml에서 URL을 읽지 못했습니다.'); return; }
    setCrawl(null);
    setCrawlDone(0);
    const res = await crawlUrls(urls, setCrawlDone);
    setCrawl(res);
    setCrawlDone(null);
    const bad = res.filter(r => !r.ok).length;
    if (bad) toast.warning(`${res.length}개 중 ${bad}개 URL에 문제가 있습니다.`);
    else toast.success(`${res.length}개 URL 모두 정상입니다.`);
  };

  const downloadText = (name: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLocal = typeof window !== 'undefined' && !/(^|\.)mykim\.kr$/.test(window.location.hostname);
  const score = diag?.score ?? null;
  const scoreColor = score === null ? 'text-slate-400' : score >= 85 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
  const counts = { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>;
  (diag?.checks || []).forEach(c => { counts[c.status]++; });

  const tabs: { id: TabId; label: string; Icon: typeof Search }[] = [
    { id: 'health', label: '실시간 진단', Icon: Activity },
    { id: 'portals', label: '검색엔진 등록 (구글/네이버/빙)', Icon: Search },
    { id: 'geo', label: 'GEO (AI 검색) 최적화', Icon: Bot },
    { id: 'onpage', label: '온페이지 & SERP 미리보기', Icon: Eye },
    { id: 'indexing', label: '즉시 색인 (IndexNow)', Icon: Send },
  ];

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100 pb-12">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Globe className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">SEO · GEO 통합 관제 센터</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                배포된 사이트 파일을 직접 읽어 진단하고, 검색엔진 등록·AI 검색 최적화·즉시 색인을 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 min-w-[200px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-medium">사이트 진단 점수</span>
                <button type="button" onClick={refresh} disabled={diagLoading} className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" aria-label="진단 다시 실행">
                  <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </div>
              <div className={`text-3xl font-black ${scoreColor}`}>{diagLoading && !diag ? '…' : score === null ? '-' : `${score}점`}</div>
              <div className="flex gap-2 text-[11px] mt-1">
                <span className="text-emerald-400">정상 {counts.pass}</span>
                <span className="text-amber-400">확인 {counts.warn}</span>
                <span className="text-rose-400">문제 {counts.fail}</span>
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 min-w-[220px]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-medium">콘솔 등록 체크리스트</span>
                <span className="text-indigo-400 font-bold">{checklistPct}% ({doneSteps}/{totalSteps})</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={checklistPct} aria-valuemin={0} aria-valuemax={100} aria-label="콘솔 등록 체크리스트 진행률">
                <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500" style={{ width: `${checklistPct}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">관리자가 직접 기록 (이 브라우저에 저장)</p>
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-2 mt-6 pt-4 border-t border-slate-800/80 scrollbar-hide" role="tablist" aria-label="SEO GEO 메뉴">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
                tab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <t.Icon className="w-4 h-4" aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLocal && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            지금 주소({typeof window !== 'undefined' ? window.location.host : ''})의 파일을 진단하고 있습니다. 운영 상태는 https://mykim.kr 관리자 화면에서 확인하세요.
            개발 서버에서는 확장자 없는 경로(/about 등)가 SPA 화면으로 응답해 URL 검사에서 문제로 보일 수 있습니다.
          </span>
        </div>
      )}

      {/* ───────────── TAB: 실시간 진단 ───────────── */}
      {tab === 'health' && (
        <div className="space-y-6">
          {diagLoading && !diag && (
            <div className={`${card} flex items-center gap-3 text-sm text-slate-300`}>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> 사이트 파일을 읽는 중…
            </div>
          )}
          {diag && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(['인증', '크롤링', '사이트맵·피드', 'GEO', '온페이지', '구조화 데이터'] as SeoCheck['category'][]).map(cat => {
                  const items = diag.checks.filter(c => c.category === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} className={card}>
                      <h4 className="text-sm font-bold text-white mb-3">{cat}</h4>
                      <ul className="space-y-2">
                        {items.map(c => (
                          <li key={c.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-200">{c.label}</span>
                              <StatusBadge status={c.status} />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 break-all">{c.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className={card}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-indigo-400" aria-hidden="true" /> sitemap URL 실제 응답 검사
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">sitemap의 {diag.sitemap.length}개 URL을 열어 응답 코드·정적 페이지 여부·canonical 일치를 확인합니다.</p>
                  </div>
                  <button type="button" onClick={handleCrawl} disabled={crawlDone !== null} className={btnPrimary}>
                    {crawlDone !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Search className="w-3.5 h-3.5" aria-hidden="true" />}
                    {crawlDone !== null ? `검사 중 ${crawlDone}/${diag.sitemap.length}` : '전체 URL 검사'}
                  </button>
                </div>
                {crawl && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead><tr className="text-slate-400 border-b border-slate-800"><th className="py-2">URL</th><th className="py-2">HTTP</th><th className="py-2 text-right">결과</th></tr></thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {[...crawl].sort((a, b) => Number(a.ok) - Number(b.ok)).map(r => (
                          <tr key={r.url}>
                            <td className="py-2 font-mono text-[11px] text-slate-300 break-all">{r.url}</td>
                            <td className="py-2 text-slate-400">{r.status || '-'}</td>
                            <td className="py-2 text-right">{r.ok ? <StatusBadge status="pass" /> : <span className="text-rose-400 text-[11px]">{r.issue}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" /> 마지막 진단 {new Date(diag.checkedAt).toLocaleString('ko-KR')}
                {diag.manifest && <> · 빌드 매니페스트 {new Date(diag.manifest.generatedAt).toLocaleString('ko-KR')}</>}
              </p>
            </>
          )}
        </div>
      )}

      {/* ───────────── TAB: 검색엔진 등록 ───────────── */}
      {tab === 'portals' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-xs md:text-sm text-slate-300">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              각 단계 오른쪽 배지는 <strong className="text-white">사이트 쪽 준비 상태(실측)</strong>이고, 체크박스는 <strong className="text-white">콘솔에서 직접 한 작업(관리자 기록)</strong>입니다.
              콘솔 내부의 제출·색인 상태는 외부에서 확인할 수 없으니 콘솔에서 확인한 뒤 체크해 주세요. 계정·메모는 이 브라우저에만 저장됩니다.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PORTALS.map(portal => {
              const st = portalState[portal.id];
              const pDone = portal.steps.filter(s => st.done[s.id]).length;
              const pPct = Math.round((pDone / portal.steps.length) * 100);
              const rawCode = st.verifyCode.trim();
              const code = (rawCode.match(/content=["']([^"']+)["']/)?.[1] || rawCode).trim();
              const codeValid = /^[A-Za-z0-9_-]{8,128}$/.test(code);
              const deployed = portal.id === 'google' ? diag?.home?.googleVerification : portal.id === 'bing' ? diag?.home?.bingVerification : diag?.home?.naverVerification;
              return (
                <div key={portal.id} className={`bg-[#111622] rounded-2xl border ${portal.borderClass} p-5 flex flex-col gap-4`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider ${portal.badgeClass}`}>{portal.badge}</span>
                    <a href={portal.consoleUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                      콘솔 바로가기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                  <h3 className="text-lg font-bold text-white">{portal.name}</h3>

                  <div className="space-y-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 shrink-0">등록 계정</span>
                      <input
                        value={st.account}
                        onChange={e => updatePortal(portal.id, { account: e.target.value })}
                        className="bg-transparent text-right text-indigo-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 min-w-0 flex-1"
                        aria-label={`${portal.name} 등록 계정`}
                      />
                    </label>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">인증 방식</span>
                      <span className="text-slate-300">{portal.loginMethod}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">배포된 인증 태그</span>
                      <span className="font-mono text-[11px] text-slate-300 truncate">{deployed ? `${deployed.slice(0, 14)}…` : '없음'}</span>
                    </div>
                  </div>

                  {portal.verifyEnv && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 font-medium" htmlFor={`verify-${portal.id}`}>
                        소유확인 코드 입력기 (콘솔에서 받은 태그 또는 content 값)
                      </label>
                      <input
                        id={`verify-${portal.id}`}
                        value={st.verifyCode}
                        onChange={e => updatePortal(portal.id, { verifyCode: e.target.value })}
                        placeholder={`<meta name="${portal.verifyMeta}" content="..." />`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                      {rawCode && (codeValid ? (
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <p className="text-[11px] text-slate-400">
                            Vercel 프로젝트 환경변수에 아래 값을 넣고 재배포하면 index.html에 태그가 들어갑니다.
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[11px] text-emerald-300 break-all">{portal.verifyEnv}={code}</code>
                            <CopyBtn text={`${portal.verifyEnv}=${code}`} k={`env-${portal.id}`} />
                          </div>
                          {deployed === code && <StatusBadge status="pass" label="배포 확인됨" />}
                        </div>
                      ) : (
                        <p className="text-[11px] text-rose-400">코드 형식이 올바르지 않습니다 (영문·숫자·-·_ 8자 이상).</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">단계별 진행</span>
                      <span className="text-indigo-400 font-bold">{pPct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${pPct}%` }} />
                    </div>
                    {portal.steps.map(step => {
                      const chk = step.checkId ? checkById.get(step.checkId) : undefined;
                      const done = !!st.done[step.id];
                      return (
                        <label
                          key={step.id}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                            done ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <input type="checkbox" checked={done} onChange={() => toggleStep(portal.id, step.id)} className="mt-0.5 rounded text-indigo-600 cursor-pointer" />
                          <span className="flex-1">
                            <span className={`font-bold block ${done ? 'text-white' : 'text-slate-200'}`}>{step.title}</span>
                            <span className="text-[11px] text-slate-500">{step.desc}</span>
                          </span>
                          {chk && <StatusBadge status={chk.status} label={chk.status === 'pass' ? '사이트 준비됨' : chk.status === 'warn' ? '확인 필요' : '사이트 미흡'} />}
                        </label>
                      );
                    })}
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 font-medium">관리자 운영 메모</span>
                    <input
                      type="text"
                      value={st.memo}
                      onChange={e => updatePortal(portal.id, { memo: e.target.value })}
                      placeholder="최근 제출일, 특이사항…"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────── TAB: GEO ───────────── */}
      {tab === 'geo' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-white">GEO (Generative Engine Optimization)</h3>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-1">
              ChatGPT 검색·Perplexity·Claude·Gemini 같은 AI 답변 엔진이 my김변 페이지를 출처로 인용하도록, 크롤러 접근·요약 문서(llms.txt)·구조화 데이터를 관리합니다.
              AI 인용 여부는 검색엔진처럼 보고서가 없어 아래 질의로 직접 확인해야 합니다.
            </p>
          </div>

          {/* AI 크롤러 정책 (robots.txt 실측) */}
          <div className={card}>
            <h4 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" /> 크롤러별 robots.txt 적용 결과 (실측)
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              공개 경로(홈·가이드·칼럼·FAQ)는 허용, 개인정보 경로(?role·?share·?reqId·/api/·/check)는 차단되어야 합니다.
            </p>
            {!diag?.crawlers.length ? (
              <p className="text-xs text-slate-500">robots.txt를 읽지 못했습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-2">크롤러</th><th className="py-2">용도</th><th className="py-2">적용 그룹</th><th className="py-2">공개 페이지</th><th className="py-2 text-right">민감 경로</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {diag.crawlers.map(c => (
                      <tr key={c.ua}>
                        <td className="py-2 font-mono font-bold text-white">{c.ua}</td>
                        <td className="py-2 text-slate-400">{c.label}</td>
                        <td className="py-2 font-mono text-slate-500">{c.matched}</td>
                        <td className="py-2">{c.publicAllowed ? <StatusBadge status="pass" label="수집 허용" /> : <StatusBadge status="warn" label={`차단 ${c.blockedPublic.join(' ')}`} />}</td>
                        <td className="py-2 text-right">{c.leakedPrivate.length ? <StatusBadge status="fail" label={`노출 ${c.leakedPrivate.join(' ')}`} /> : <StatusBadge status="pass" label="차단됨" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {diag?.robotsText && (
              <details className="mt-3">
                <summary className="text-xs text-indigo-400 cursor-pointer">robots.txt 원문 보기</summary>
                <pre className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-60 overflow-auto">{diag.robotsText}</pre>
              </details>
            )}
          </div>

          {/* llms.txt 실물 */}
          <div className={card}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" aria-hidden="true" /> llms.txt (배포된 실제 파일)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">AI 에이전트가 사이트 성격·주요 페이지를 빠르게 파악하도록 돕는 요약 문서입니다. 수정은 public/llms.txt에서 합니다.</p>
              </div>
              <div className="flex items-center gap-2">
                {diag?.llmsText && <CopyBtn text={diag.llmsText} k="llms" label="전체 복사" />}
                {diag?.llmsText && (
                  <button type="button" onClick={() => downloadText('llms.txt', diag.llmsText)} className={btnGhost}>
                    <Download className="w-3.5 h-3.5" aria-hidden="true" /> 다운로드
                  </button>
                )}
                <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> /llms.txt 열기
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {['llms', 'llms-links', 'llms-coverage'].map(id => {
                const c = checkById.get(id);
                return c ? <span key={id} className="text-[11px] text-slate-400 flex items-center gap-1.5"><StatusBadge status={c.status} /> {c.label}</span> : null;
              })}
            </div>
            {(checkById.get('llms-coverage')?.status === 'warn' || (diag?.llmsBrokenLinks.length ?? 0) > 0) && (
              <p className="text-[11px] text-amber-300 mb-3 break-all">
                {checkById.get('llms-links')?.status === 'warn' && <>{checkById.get('llms-links')?.detail}<br /></>}
                {checkById.get('llms-coverage')?.status === 'warn' && checkById.get('llms-coverage')?.detail}
              </p>
            )}
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {diag?.llmsText || (diagLoading ? '불러오는 중…' : 'llms.txt를 읽지 못했습니다.')}
            </pre>
          </div>

          {/* AI 인용 점검 질의 */}
          <div className={card}>
            <h4 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-cyan-400" aria-hidden="true" /> AI 검색 인용 점검 질의
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              질의를 AI 검색에 직접 넣어 답변 출처에 목표 페이지(mykim.kr)가 인용되는지 확인하세요. 목표 페이지가 사이트에 실제로 있는지도 함께 표시합니다.
            </p>
            <div className="space-y-2">
              {GEO_QUERIES.map(g => {
                const exists = pageByKey.has(urlKey(g.target));
                const enc = encodeURIComponent(g.q);
                return (
                  <div key={g.q} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <span className="font-bold text-indigo-300">Q. "{g.q}"</span>
                      <div className="flex flex-wrap gap-1.5">
                        <a className={btnGhost} href={`https://chatgpt.com/?q=${enc}&hints=search`} target="_blank" rel="noopener noreferrer">ChatGPT</a>
                        <a className={btnGhost} href={`https://www.perplexity.ai/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Perplexity</a>
                        <a className={btnGhost} href={`https://www.bing.com/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Bing</a>
                        <a className={btnGhost} href={`https://search.naver.com/search.naver?query=${enc}`} target="_blank" rel="noopener noreferrer">네이버</a>
                        <a className={btnGhost} href={`https://www.google.com/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Google</a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-500">인용 목표</span>
                      <a href={g.target} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-300 hover:underline break-all">{g.target.replace(SITE_ORIGIN, '')}</a>
                      {pages.length > 0 && (exists ? <StatusBadge status="pass" label="페이지 있음" /> : <StatusBadge status="fail" label="페이지 없음" />)}
                      <span className="text-slate-500">· 핵심 엔티티: {g.entities}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 구조화 데이터 */}
          <div className={card}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-amber-400" aria-hidden="true" /> Schema.org JSON-LD 적용 현황 (실측)
              </h4>
              <div className="flex gap-2">
                <a href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(selectedPage?.url || SITE_ORIGIN)}`} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> 리치결과 테스트
                </a>
                <a href={`https://validator.schema.org/#url=${encodeURIComponent(selectedPage?.url || SITE_ORIGIN)}`} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Schema 검사
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {['Organization', 'WebSite', 'LegalService', 'FAQPage', 'Article', 'BreadcrumbList'].map(t => {
                const n = pages.filter(p => p.jsonLdTypes.includes(t)).length;
                return (
                  <div key={t} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">{t}</span>
                    <span className={`font-black text-lg ${n ? 'text-white' : 'text-rose-400'}`}>{n}</span>
                    <span className="text-slate-500 text-[11px]"> / {pages.length} 페이지</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───────────── TAB: 온페이지 ───────────── */}
      {tab === 'onpage' && (
        <div className="space-y-6">
          {!pages.length ? (
            <div className={`${card} text-xs text-slate-400`}>seo-manifest.json이 없어 페이지 목록을 표시할 수 없습니다. npm run build(prebuild) 후 배포하면 생성됩니다.</div>
          ) : (
            <>
              <div className={card}>
                <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
                  <label className="flex-1 space-y-1">
                    <span className="text-xs text-slate-400 font-medium">미리볼 페이지</span>
                    <select
                      value={selectedPage?.url || ''}
                      onChange={e => setSelectedPageUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {pages.map(p => <option key={p.url} value={p.url}>{p.url.replace(SITE_ORIGIN, '') || '/'} — {p.title}</option>)}
                    </select>
                  </label>
                  <button type="button" className={btnGhost} onClick={() => { if (selectedPage) { setSimTitle(selectedPage.title); setSimDesc(selectedPage.description); } }}>
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> 원래 값으로
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">제목 시뮬레이션 · {simTitle.length}자 · 표시폭 {displayWidth(simTitle)}/60 {displayWidth(simTitle) > 60 && <span className="text-amber-400">(잘릴 수 있음)</span>}</span>
                    <input value={simTitle} onChange={e => setSimTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">설명 시뮬레이션 · {simDesc.length}자 (권장 50~160) {simDesc.length > 160 && <span className="text-amber-400">(잘릴 수 있음)</span>}</span>
                    <input value={simDesc} onChange={e => setSimDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">시뮬레이션은 미리보기만 바꿉니다. 실제 수정은 해당 HTML 파일에서 하세요 ({selectedPage?.file}).</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-[#202124] border border-slate-700/60 font-sans space-y-1.5">
                    <span className="text-[10px] font-black text-blue-400">GOOGLE</span>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5"><img src="/mykim_logo.png" alt="" className="w-5 h-5 object-contain" /></div>
                      <div>
                        <span className="text-slate-300 font-bold block leading-tight">my김변</span>
                        <span className="text-[11px] text-slate-400">{(selectedPage?.url || SITE_ORIGIN).replace('https://', '').replace(/\//g, ' › ')}</span>
                      </div>
                    </div>
                    <h5 className="text-base text-[#8ab4f8] font-medium leading-snug line-clamp-1">{simTitle || '(제목 없음)'}</h5>
                    <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2">{simDesc || '(설명 없음 — 검색엔진이 본문 일부를 임의로 표시)'}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 font-sans space-y-1.5">
                    <span className="text-[10px] font-black text-emerald-600">NAVER</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-700 font-bold">my김변</span>
                      <span className="text-slate-400 text-[11px]">{(selectedPage?.url || SITE_ORIGIN).replace('https://', '')}</span>
                    </div>
                    <h5 className="text-base text-[#0033cc] font-bold line-clamp-1">{simTitle || '(제목 없음)'}</h5>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{simDesc || '(설명 없음)'}</p>
                  </div>
                </div>
              </div>

              <div className={card}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-bold text-white">페이지별 메타 점검 ({pages.length}개)</h4>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={issuesOnly} onChange={e => setIssuesOnly(e.target.checked)} className="rounded" /> 개선 필요만
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-2">페이지</th><th className="py-2">title</th><th className="py-2">description</th><th className="py-2">스키마</th><th className="py-2">lastmod</th><th className="py-2 text-right">점검</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {pages.filter(p => !issuesOnly || p.issues.length).map(p => (
                        <tr key={p.url} className="align-top">
                          <td className="py-2 pr-2">
                            <button type="button" onClick={() => setSelectedPageUrl(p.url)} className="font-mono text-[11px] text-indigo-300 hover:underline text-left cursor-pointer">{p.url.replace(SITE_ORIGIN, '') || '/'}</button>
                          </td>
                          <td className={`py-2 ${p.titleLength > 60 || p.titleLength < 15 ? 'text-amber-400' : 'text-slate-300'}`}>{p.titleLength}자</td>
                          <td className={`py-2 ${p.descriptionLength > 160 || p.descriptionLength < 50 ? 'text-amber-400' : 'text-slate-300'}`}>{p.descriptionLength}자</td>
                          <td className="py-2 text-slate-400 text-[11px]">{p.jsonLdTypes.filter(t => ['Article', 'FAQPage', 'LegalService', 'Organization', 'BreadcrumbList', 'Service'].includes(t)).join(', ') || '-'}</td>
                          <td className="py-2 text-slate-400">{p.lastmod}</td>
                          <td className="py-2 text-right">
                            {p.issues.length ? <span className="text-amber-300 text-[11px]">{p.issues.join(' · ')}</span> : <StatusBadge status="pass" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────── TAB: 즉시 색인 ───────────── */}
      {tab === 'indexing' && (
        <div className="space-y-6">
          <div className={card}>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" aria-hidden="true" /> IndexNow 즉시 색인 요청 (Bing · Naver 등)
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              서버가 IndexNow 공용 엔드포인트와 네이버에 실제로 전송하고 결과를 기록합니다. 관리자 2단계 인증 세션에서만 동작합니다.
              구글은 IndexNow를 받지 않고 sitemap ping도 2023년에 종료되어, 구글은 아래 URL 검사 바로가기를 쓰세요.
            </p>

            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <span className="text-slate-500 self-center">자동 선택:</span>
              <button type="button" className={btnGhost} onClick={() => setIndexUrls(changedSinceSubmit.join('\n'))} disabled={!changedSinceSubmit.length}>
                마지막 전송 이후 변경분 ({changedSinceSubmit.length})
              </button>
              <button type="button" className={btnGhost} onClick={() => setIndexUrls((diag?.sitemap || []).map(s => s.url).join('\n'))}>
                sitemap 전체 ({diag?.sitemap.length || 0})
              </button>
              <button type="button" className={btnGhost} onClick={() => setIndexUrls(pages.filter(p => p.section === 'guide').map(p => p.url).join('\n'))}>가이드</button>
              <button type="button" className={btnGhost} onClick={() => setIndexUrls(pages.filter(p => p.section === 'article').map(p => p.url).join('\n'))}>칼럼</button>
            </div>

            <label className="block mt-3 space-y-1">
              <span className="text-xs text-slate-300 font-bold">전송할 URL (한 줄에 하나, 최대 100개) · {parsedIndexUrls.length}개</span>
              <textarea
                value={indexUrls}
                onChange={e => setIndexUrls(e.target.value)}
                rows={6}
                placeholder={`${SITE_ORIGIN}/guide/personal-rehabilitation.html`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button type="button" onClick={handleSubmitIndexNow} disabled={submitting || !parsedIndexUrls.length} className={`${btnPrimary} min-h-[44px] px-4`}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                IndexNow 전송
              </button>
              {checkById.get('indexnow-key') && <StatusBadge status={checkById.get('indexnow-key')!.status} label={diag?.indexNowKeyOk ? '키 파일 정상' : '키 파일 문제'} />}
            </div>
          </div>

          <div className={card}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" aria-hidden="true" /> 구글 URL 검사 바로가기
              </h4>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                서치 콘솔 속성
                <select value={gscProperty} onChange={e => setGscProperty(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200">
                  <option value="sc-domain:mykim.kr">도메인 속성 (sc-domain:mykim.kr)</option>
                  <option value="https://mykim.kr/">URL 접두어 (https://mykim.kr/)</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-400 mb-3">URL 검사 화면이 열리면 [색인 생성 요청]을 누르세요. 구글은 하루 요청 수가 제한되어 있어 새 글·크게 바뀐 글 위주로 쓰는 것이 좋습니다.</p>
            <div className="flex flex-wrap gap-2">
              {(parsedIndexUrls.length ? parsedIndexUrls.slice(0, 10) : changedSinceSubmit.slice(0, 10)).map(u => (
                <a key={u} href={gscInspectUrl(u)} target="_blank" rel="noopener noreferrer" className={`${btnGhost} font-mono`}>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" /> {u.replace(SITE_ORIGIN, '') || '/'}
                </a>
              ))}
              {!parsedIndexUrls.length && !changedSinceSubmit.length && <span className="text-xs text-slate-500">위 입력칸에 URL을 넣으면 바로가기가 만들어집니다.</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { k: 'sitemap', label: '사이트맵', url: `${SITE_ORIGIN}/sitemap.xml`, Icon: FileText, note: diag?.sitemap.length ? `URL ${diag.sitemap.length}개 (빌드 시 자동 생성, canonical 기준)` : '읽지 못함' },
              { k: 'rss', label: 'RSS 피드 (네이버 제출용)', url: `${SITE_ORIGIN}/rss.xml`, Icon: Rss, note: (diag?.rssItems ?? -1) > 0 ? `가이드·칼럼 ${diag?.rssItems}개 (빌드 시 자동 생성)` : '읽지 못함' },
            ].map(x => (
              <div key={x.k} className={`${card} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm flex items-center gap-2"><x.Icon className="w-4 h-4 text-indigo-400" aria-hidden="true" /> {x.label}</span>
                  <CopyBtn text={x.url} k={`${x.k}-url`} label="URL 복사" />
                </div>
                <a href={x.url.replace(SITE_ORIGIN, '')} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white">{x.url}</a>
                <p className="text-[11px] text-slate-500">{x.note}</p>
              </div>
            ))}
          </div>

          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" aria-hidden="true" /> IndexNow 전송 기록 (이 브라우저)
              </h4>
              {history.length > 0 && (
                <button type="button" onClick={() => { setHistory([]); toast.info('기록을 비웠습니다.'); }} className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer">기록 비우기</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="p-6 text-center text-slate-500 text-xs">아직 전송 기록이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {history.map(h => (
                  <li key={h.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-300">{new Date(h.at).toLocaleString('ko-KR')} · URL {h.urls.length}개</span>
                      <StatusBadge status={h.ok ? 'pass' : 'fail'} label={h.ok ? '접수됨' : '실패'} />
                    </div>
                    {h.results.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {h.results.map(r => (
                          <span key={r.engine} className={`text-[11px] ${r.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{r.engine}: {r.message}{r.status ? ` (${r.status})` : ''}</span>
                        ))}
                      </div>
                    )}
                    {h.error && <p className="text-[11px] text-rose-400">{h.error}</p>}
                    <details>
                      <summary className="text-[11px] text-slate-500 cursor-pointer">URL 목록</summary>
                      <p className="font-mono text-[11px] text-slate-400 break-all mt-1">{h.urls.join('\n')}</p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
