/**
 * 오늘의 오토파일럿 — 뉴스 수집 → 이슈 선정(3단 공식) → 6채널 생성 → 규정 검사 → 저장·승인 → 게시/내보내기
 * 서버 크론이 매일 아침(07:30 KST) 초안을 만들어 두면, 관리자는 검토·승인만 하면 된다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Newspaper, RefreshCcw, Sparkles, ShieldCheck, ShieldAlert, CheckCircle, XCircle, Copy, Save,
  FileText, Video, Smartphone, Image as ImageIcon, MessageCircle, Facebook, Send, Link2, Download, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import {
  autopilotApi, AutopilotStatus, CampaignChannels, CampaignStatus, ChannelId, ChannelPost, DailyContext, GroupId, GROUP_CHANNELS,
  NewsItem, RotationTheme, Scene, scanChannelsLocal, channelPlainText, blogTextToHtml, explainAutopilotError,
  fallbackImageUrl, toDataUrl, MARKETING_DISCLAIMER_SHORT, CampaignRow, ComplianceIssue,
} from '../../../services/marketingAutopilotService';
import ShortsVideoRenderer from './ShortsVideoRenderer';
import { drawBlogImage, drawCardSlide, ensureFonts, loadImage, canvasToBlob, downloadBlob } from './canvasArt';

const CHANNEL_META: Record<ChannelId, { name: string; icon: React.ElementType; color: string }> = {
  blog: { name: '네이버 블로그', icon: FileText, color: 'text-emerald-400' },
  threads: { name: '스레드', icon: MessageCircle, color: 'text-slate-100' },
  facebook: { name: '페이스북', icon: Facebook, color: 'text-blue-400' },
  cardnews: { name: '인스타그램 카드뉴스', icon: ImageIcon, color: 'text-pink-400' },
  shorts: { name: '유튜브 쇼츠', icon: Video, color: 'text-red-400' },
  tiktok: { name: '틱톡', icon: Smartphone, color: 'text-cyan-400' },
};
const CHANNEL_ORDER: ChannelId[] = ['blog', 'threads', 'facebook', 'cardnews', 'shorts', 'tiktok'];
const GROUP_LABEL: Record<GroupId, string> = { blog: '블로그 칼럼', shortform: '쇼츠·틱톡 대본', social: '카드뉴스·스레드·페이스북' };
const STATUS_LABEL: Record<CampaignStatus, string> = { ready: '검토 대기', approved: '승인됨', rejected: '반려', published: '게시 진행' };
const DAY = ['일', '월', '화', '수', '목', '금', '토'];

const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors press-scale disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const btnPrimary = `${btn} bg-indigo-600 hover:bg-indigo-700 text-white`;
const btnGhost = `${btn} bg-slate-800 hover:bg-slate-700 text-slate-100`;
const input = 'w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3.5 rounded bg-slate-800 animate-pulse" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

async function copyText(text: string, html?: string) {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    toast.success(html ? '서식 포함으로 복사했습니다. 네이버 스마트에디터에 붙여넣으세요.' : '복사했습니다.');
  } catch {
    toast.error('클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.');
  }
}

function IssueList({ issues }: { issues: ComplianceIssue[] }) {
  if (!issues.length) {
    return <p className="text-xs text-emerald-300 flex items-center gap-1.5"><ShieldCheck size={14} />규칙 검사에서 걸린 표현이 없습니다. 게시 전 최종 확인은 사람이 합니다.</p>;
  }
  const color = { high: 'text-red-300 bg-red-500/10 border-red-500/30', medium: 'text-amber-200 bg-amber-500/10 border-amber-500/30', low: 'text-slate-300 bg-slate-800 border-slate-700' };
  const label = { high: '고위험', medium: '수정 권고', low: '참고' };
  return (
    <ul className="space-y-1.5" aria-label="광고 규정 검사 결과">
      {issues.map((i, k) => (
        <li key={k} className={`text-xs rounded-xl border px-3 py-2 ${color[i.severity]}`}>
          <span className="font-bold mr-1">[{label[i.severity]}] {i.label}</span>
          {i.match && <span className="font-mono">"{i.match}"</span>}
          <span className="block opacity-90 mt-0.5">{i.hint}</span>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────
export default function DailyAutopilotPanel({ loadDate }: { loadDate?: string | null }) {
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState('');
  const [info, setInfo] = useState<AutopilotStatus | null>(null);
  const [themeCode, setThemeCode] = useState<string>('');

  const [candidates, setCandidates] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [manualTopic, setManualTopic] = useState('');
  const [manualFacts, setManualFacts] = useState('');

  const [ctx, setCtx] = useState<DailyContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  const [channels, setChannels] = useState<CampaignChannels>({});
  const [groupState, setGroupState] = useState<Record<GroupId, { s: 'idle' | 'loading' | 'done' | 'error'; err?: string; model?: string; revised?: boolean }>>({
    blog: { s: 'idle' }, shortform: { s: 'idle' }, social: { s: 'idle' },
  });
  const [models, setModels] = useState<Record<string, unknown>>({});
  const [campaign, setCampaign] = useState<{ id: string; status: CampaignStatus; source: string; posts: ChannelPost[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<ChannelId>('blog');

  const themes = info?.themes || [];
  const theme: RotationTheme | undefined = ctx?.theme || themes.find(t => t.code === themeCode);
  const compliance = useMemo(() => scanChannelsLocal(channels, ctx || undefined), [channels, ctx]);
  const hasChannels = Object.keys(channels).length > 0;

  const hydrate = useCallback((row: CampaignRow & { posts: ChannelPost[] }, allThemes: RotationTheme[]) => {
    const th = allThemes.find(t => t.code === row.day_theme_code) || allThemes[0];
    setCtx({
      date: row.campaign_date, theme: th, news: row.news,
      facts: row.context?.facts || [], bridge: row.context?.bridge || { step1Fact: '', step2Dilemma: '', step3Bridge: '' },
      angle: row.context?.angle || '', reason: row.context?.reason || '',
    });
    setThemeCode(th.code);
    setCandidates(row.context?.candidates || []);
    setChannels(row.channels || {});
    setModels(row.models || {});
    setCampaign({ id: row.id, status: row.status, source: row.source, posts: row.posts || [] });
    setGroupState({ blog: { s: row.channels?.blog ? 'done' : 'idle' }, shortform: { s: row.channels?.shorts ? 'done' : 'idle' }, social: { s: row.channels?.cardnews ? 'done' : 'idle' } });
    setDirty(false);
  }, []);

  const resetAll = () => {
    setCtx(null); setChannels({}); setCampaign(null); setDirty(false); setSelectedIdx(null);
    setGroupState({ blog: { s: 'idle' }, shortform: { s: 'idle' }, social: { s: 'idle' } });
  };

  // 초기 로드: 서버 상태 + 오늘(또는 캘린더에서 고른 날) 캠페인
  useEffect(() => {
    let alive = true;
    (async () => {
      setBoot('loading');
      try {
        const st = await autopilotApi.status();
        if (!alive) return;
        setInfo(st);
        const date = loadDate || st.today.date;
        setThemeCode(st.themes[new Date(`${date}T00:00:00Z`).getUTCDay()]?.code || st.themes[0].code);
        const { campaign: row } = await autopilotApi.get({ date }).catch(e => {
          if (/does not exist|schema cache|relation/i.test(String(e?.message))) throw e;
          return { campaign: null };
        });
        if (!alive) return;
        if (row) hydrate(row, st.themes); else resetAll();
        setBoot('ready');
      } catch (e) {
        if (!alive) return;
        setBootError(explainAutopilotError(e));
        setBoot('error');
      }
    })();
    return () => { alive = false; };
  }, [loadDate, hydrate]);

  const fetchNews = async () => {
    setNewsLoading(true); setNewsError('');
    try {
      const r = await autopilotApi.news(themeCode);
      setCandidates(r.candidates);
      setSelectedIdx(null);
      if (!r.candidates.length) setNewsError('최근 3일 안에 수집된 기사가 없습니다. 아래에 주제를 직접 입력하세요.');
    } catch (e) {
      setNewsError(explainAutopilotError(e));
    } finally {
      setNewsLoading(false);
    }
  };

  const buildContext = async (mode: 'ai' | 'selected' | 'manual') => {
    setCtxLoading(true);
    try {
      const r = mode === 'manual'
        ? await autopilotApi.context({ themeCode, manualTopic, manualFacts: manualFacts.split('\n').map(s => s.trim()).filter(Boolean) })
        : await autopilotApi.context({ themeCode, candidates: candidates.length ? candidates : undefined, selectedIndex: mode === 'selected' && selectedIdx !== null ? selectedIdx : undefined });
      setCtx(r.ctx);
      if (r.candidates) setCandidates(r.candidates);
      setModels(m => ({ ...m, editor: r.model || null }));
      setChannels({}); setCampaign(null); setDirty(false);
      setGroupState({ blog: { s: 'idle' }, shortform: { s: 'idle' }, social: { s: 'idle' } });
      toast.success('오늘의 이슈와 3단 공식을 정했습니다. 내용을 확인한 뒤 6채널을 생성하세요.');
    } catch (e) {
      toast.error(explainAutopilotError(e));
    } finally {
      setCtxLoading(false);
    }
  };

  const runGroup = async (g: GroupId, c: DailyContext) => {
    setGroupState(s => ({ ...s, [g]: { s: 'loading' } }));
    try {
      const r = await autopilotApi.generate(g, c);
      setChannels(prev => ({ ...prev, ...r.channels }));
      setModels(m => ({ ...m, [g]: r.model }));
      setGroupState(s => ({ ...s, [g]: { s: 'done', model: r.model, revised: r.revised } }));
      setDirty(true);
    } catch (e) {
      setGroupState(s => ({ ...s, [g]: { s: 'error', err: explainAutopilotError(e) } }));
    }
  };

  const generateAll = async () => {
    if (!ctx) return;
    const t = toast.loading('6채널 콘텐츠를 생성 중입니다 (20~50초).');
    await Promise.all((['blog', 'shortform', 'social'] as GroupId[]).map(g => runGroup(g, ctx)));
    toast.dismiss(t);
    toast.success('생성을 마쳤습니다. 채널별 검사 결과를 확인하세요.');
  };

  const updateChannel = <K extends ChannelId>(ch: K, value: NonNullable<CampaignChannels[K]>) => {
    setChannels(prev => ({ ...prev, [ch]: value }));
    setDirty(true);
  };

  const save = async (): Promise<string | null> => {
    if (!ctx || !hasChannels) return null;
    setSaving(true);
    try {
      if (campaign) {
        const r = await autopilotApi.update(campaign.id, { channels });
        setCampaign(c => c && { ...c, status: r.campaign.status });
        setDirty(false);
        toast.success('변경 내용을 저장했습니다.');
        return campaign.id;
      }
      const r = await autopilotApi.save(ctx, channels, candidates, models);
      setCampaign({ id: r.id, status: 'ready', source: 'manual', posts: [] });
      setDirty(false);
      toast.success(`${ctx.date} 캠페인을 저장했습니다.`);
      return r.id;
    } catch (e) {
      toast.error(explainAutopilotError(e));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: CampaignStatus) => {
    const id = dirty || !campaign ? await save() : campaign.id;
    if (!id) return;
    try {
      const r = await autopilotApi.update(id, { status });
      setCampaign(c => c && { ...c, status: r.campaign.status });
      toast.success(status === 'approved' ? '승인했습니다. 채널별로 게시하세요.' : '반려했습니다.');
    } catch (e) {
      toast.error(explainAutopilotError(e));
    }
  };

  const onPublished = (post: ChannelPost) => {
    setCampaign(c => c && { ...c, status: 'published', posts: [...c.posts, post] });
  };

  // ─── 렌더 ───
  if (boot === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6"><Skeleton lines={3} /></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 h-36"><Skeleton lines={4} /></div>)}
        </div>
      </div>
    );
  }
  if (boot === 'error') {
    return (
      <div className="bg-[#111622] rounded-2xl border border-red-500/30 p-6 space-y-3" role="alert">
        <h3 className="text-white font-bold flex items-center gap-2"><AlertTriangle size={18} className="text-red-400" />오토파일럿 서버에 연결하지 못했습니다</h3>
        <p className="text-sm text-slate-300">{bootError}</p>
        <button type="button" className={btnGhost} onClick={() => window.location.reload()}><RefreshCcw size={16} />다시 시도</button>
      </div>
    );
  }

  const scheduleFor = (ch: ChannelId) => info?.schedule.find(s => s.channel === ch)?.time || '';

  return (
    <div className="space-y-6">
      {/* 헤더: 날짜·테마·상태 */}
      <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-300">{ctx?.date || loadDate || info?.today.date} ({DAY[theme?.day ?? 0]})</span>
            {campaign && (
              <span className={`text-xs px-2 py-1 rounded-lg border ${campaign.status === 'approved' || campaign.status === 'published' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : campaign.status === 'rejected' ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                {STATUS_LABEL[campaign.status]}{campaign.source === 'cron' ? ' · 아침 자동 생성' : ''}
              </span>
            )}
            {dirty && <span className="text-xs text-amber-300">저장하지 않은 변경</span>}
          </div>
          {ctx ? (
            <h2 className="text-xl font-bold text-white">{theme?.emoji} {theme?.title} — {ctx.news.title}</h2>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="mk-theme" className="text-sm text-slate-300">오늘의 장점 테마</label>
              <select id="mk-theme" value={themeCode} onChange={e => setThemeCode(e.target.value)} className={`${input} w-auto`}>
                {themes.map(t => <option key={t.code} value={t.code}>{DAY[t.day]} · {t.emoji} {t.title}</option>)}
              </select>
            </div>
          )}
          {theme && <p className="text-sm text-slate-400 leading-relaxed">공감 훅: "{theme.hook}" → {theme.solution}</p>}
        </div>
        <div className="lg:w-72 space-y-2 lg:border-l border-[#1E293B]/60 lg:pl-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">규칙 검사 점수</span>
            <span className={`font-bold ${!hasChannels ? 'text-slate-400' : compliance.highCount ? 'text-red-300' : compliance.score >= 80 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {hasChannels ? `${compliance.score}/100` : '—'}
            </span>
          </div>
          {hasChannels && compliance.highCount > 0 && <p className="text-xs text-red-300">고위험 표현 {compliance.highCount}건 — 수정 전에는 승인할 수 없습니다.</p>}
          <div className="flex gap-2">
            <button type="button" className={`${btnGhost} flex-1`} disabled={!hasChannels || saving || (!dirty && !!campaign)} onClick={save}>
              <Save size={16} />{campaign ? '변경 저장' : '저장'}
            </button>
            {ctx && <button type="button" className={btnGhost} onClick={resetAll} aria-label="처음부터 다시"><RefreshCcw size={16} /></button>}
          </div>
          <div className="flex gap-2">
            <button type="button" className={`${btnPrimary} flex-1`} disabled={!hasChannels || saving || compliance.highCount > 0 || campaign?.status === 'approved' || campaign?.status === 'published'} onClick={() => setStatus('approved')}>
              <CheckCircle size={16} />승인
            </button>
            <button type="button" className={btnGhost} disabled={!campaign || saving} onClick={() => setStatus('rejected')} aria-label="반려">
              <XCircle size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 1단계: 뉴스 & 3단 공식 */}
      {!ctx && (
        <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Newspaper size={18} className="text-indigo-400" />1. 오늘의 뉴스 고르기</h3>
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={fetchNews} disabled={newsLoading}><RefreshCcw size={16} />{newsLoading ? '수집 중…' : '최신 뉴스 수집'}</button>
              <button type="button" className={btnPrimary} onClick={() => buildContext(selectedIdx !== null ? 'selected' : 'ai')} disabled={ctxLoading || newsLoading}>
                <Sparkles size={16} />{ctxLoading ? '분석 중…' : selectedIdx !== null ? '선택 기사로 진행' : 'AI가 1건 선정'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            출처: Google 뉴스 RSS{info?.status.newsProviders.naver ? ' + 네이버 뉴스 API' : ' (네이버 뉴스 API는 NAVER_CLIENT_ID/SECRET 설정 시 추가)'}. 점수 = 대중성 40 + 신뢰성 30 + 테마 연결성 30. 사무소 홍보성 기사는 감점합니다.
          </p>
          {newsLoading && <Skeleton lines={5} />}
          {newsError && <p className="text-sm text-amber-200" role="alert">{newsError}</p>}
          {!newsLoading && candidates.length > 0 && (
            <ul className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden">
              {candidates.map((c, i) => (
                <li key={`${c.url}-${i}`}>
                  <label className={`flex gap-3 p-3 cursor-pointer hover:bg-white/5 ${selectedIdx === i ? 'bg-indigo-500/10' : ''}`}>
                    <input type="radio" name="mk-news" className="mt-1 accent-indigo-500" checked={selectedIdx === i} onChange={() => setSelectedIdx(i)} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-100">{c.title}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{c.source} · {c.publishedAt ? new Date(c.publishedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </span>
                    {c.score && <span className="text-xs font-mono text-indigo-300 shrink-0" title={`대중성 ${c.score.popularity} · 신뢰성 ${c.score.trust} · 연결성 ${c.score.relevance}`}>{c.score.total}점</span>}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white shrink-0" aria-label="원문 열기" onClick={e => e.stopPropagation()}><ExternalLink size={14} /></a>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {!newsLoading && !candidates.length && !newsError && (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-2xl">
              <Newspaper size={28} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm text-slate-300">아직 수집한 뉴스가 없습니다.</p>
              <p className="text-xs text-slate-400 mt-1">"최신 뉴스 수집"을 누르거나, 바로 "AI가 1건 선정"을 누르면 수집과 선정을 한 번에 합니다.</p>
            </div>
          )}
          <details className="rounded-xl border border-slate-800 p-3">
            <summary className="text-sm text-slate-300 cursor-pointer">뉴스 대신 주제를 직접 입력</summary>
            <div className="mt-3 space-y-2">
              <label htmlFor="mk-topic" className="text-xs text-slate-400">주제</label>
              <input id="mk-topic" className={input} value={manualTopic} onChange={e => setManualTopic(e.target.value)} placeholder="예: 2026년 개인회생 생계비 기준 변경 정리" maxLength={200} />
              <label htmlFor="mk-facts" className="text-xs text-slate-400">확인된 사실 (한 줄에 하나, 출처가 있는 내용만)</label>
              <textarea id="mk-facts" className={input} rows={3} value={manualFacts} onChange={e => setManualFacts(e.target.value)} />
              <button type="button" className={btnGhost} disabled={!manualTopic.trim() || ctxLoading} onClick={() => buildContext('manual')}>이 주제로 진행</button>
            </div>
          </details>
        </section>
      )}

      {ctx && (
        <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">2. 3단 귀속 공식 확인</h3>
            <button type="button" className={btnPrimary} onClick={generateAll} disabled={Object.values(groupState).some(g => g.s === 'loading')}>
              <Sparkles size={16} />{hasChannels ? '6채널 다시 생성' : '6채널 생성'}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {ctx.news.url ? <a href={ctx.news.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{ctx.news.source} 원문</a> : ctx.news.source}
            {ctx.reason ? ` · 선정 이유: ${ctx.reason}` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([['step1Fact', 'Step 1 · 뉴스 팩트 (50%)'], ['step2Dilemma', 'Step 2 · 채무자 딜레마 (25%)'], ['step3Bridge', 'Step 3 · 마이김변 연결 (25%)']] as const).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label htmlFor={`mk-${k}`} className="text-xs font-bold text-slate-300">{label}</label>
                <textarea id={`mk-${k}`} rows={4} className={input} value={ctx.bridge[k]} onChange={e => setCtx({ ...ctx, bridge: { ...ctx.bridge, [k]: e.target.value } })} />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300 mb-1">추출한 팩트 (AI는 이 범위 안의 수치만 사용)</p>
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-0.5">{ctx.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['blog', 'shortform', 'social'] as GroupId[]).map(g => {
              const st = groupState[g];
              return (
                <div key={g} className="rounded-xl border border-slate-800 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-medium">{GROUP_LABEL[g]}</span>
                    <span className={`text-xs ${st.s === 'done' ? 'text-emerald-300' : st.s === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                      {st.s === 'loading' ? '생성 중' : st.s === 'done' ? '완료' : st.s === 'error' ? '실패' : '대기'}
                    </span>
                  </div>
                  {st.s === 'loading' && <div className="mt-2"><Skeleton lines={2} /></div>}
                  {st.model && <p className="text-xs text-slate-400 mt-1">{st.model}{st.revised ? ' · 검수관 1회 수정' : ''}</p>}
                  {st.s === 'error' && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-red-300">{st.err}</p>
                      <button type="button" className={`${btnGhost} w-full`} onClick={() => runGroup(g, ctx)}>이 그룹만 다시 생성</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3단계: 채널별 검토 */}
      {hasChannels && (
        <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 space-y-5">
          <h3 className="text-lg font-bold text-white">3. 채널별 검토·게시</h3>
          <div className="flex overflow-x-auto gap-2 pb-1" role="tablist">
            {CHANNEL_ORDER.filter(ch => channels[ch]).map(ch => {
              const M = CHANNEL_META[ch];
              const r = compliance.byChannel[ch];
              const high = r?.issues.some(i => i.severity === 'high');
              const posted = campaign?.posts.some(p => p.channel === ch && p.publish_status.startsWith('published'));
              return (
                <button key={ch} type="button" role="tab" aria-selected={active === ch} onClick={() => setActive(ch)}
                  className={`min-h-[44px] px-3 rounded-xl text-sm flex items-center gap-2 whitespace-nowrap border transition-colors ${active === ch ? 'bg-white/10 border-indigo-500 text-white font-bold' : 'border-slate-800 text-slate-300 hover:bg-white/5'}`}>
                  <M.icon size={16} className={M.color} />{M.name}
                  <span className="text-[11px] text-slate-400">{scheduleFor(ch)}</span>
                  {posted ? <CheckCircle size={14} className="text-emerald-400" aria-label="게시됨" /> : high ? <ShieldAlert size={14} className="text-red-400" aria-label="고위험 표현" /> : null}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            <div className="min-w-0">
              {active === 'blog' && channels.blog && <BlogEditor value={channels.blog} onChange={v => updateChannel('blog', v)} date={ctx?.date || ''} />}
              {active === 'shorts' && channels.shorts && (
                <ScenesEditor
                  key="shorts" scenes={channels.shorts.scenes} fileBase={`mykim-shorts-${ctx?.date}`}
                  onScenes={scenes => updateChannel('shorts', { ...channels.shorts!, scenes, totalSeconds: Math.round(scenes.reduce((a, s) => a + s.seconds, 0)) })}
                  fields={[
                    ['제목', channels.shorts.title, v => updateChannel('shorts', { ...channels.shorts!, title: v })],
                    ['루프 문장', channels.shorts.loopLine, v => updateChannel('shorts', { ...channels.shorts!, loopLine: v })],
                    ['고정 댓글', channels.shorts.pinnedComment, v => updateChannel('shorts', { ...channels.shorts!, pinnedComment: v })],
                    ['설명란', channels.shorts.description, v => updateChannel('shorts', { ...channels.shorts!, description: v })],
                  ]}
                />
              )}
              {active === 'tiktok' && channels.tiktok && (
                <ScenesEditor
                  key="tiktok" scenes={channels.tiktok.scenes} fileBase={`mykim-tiktok-${ctx?.date}`}
                  onScenes={scenes => updateChannel('tiktok', { ...channels.tiktok!, scenes, totalSeconds: Math.round(scenes.reduce((a, s) => a + s.seconds, 0)) })}
                  fields={[['게시글 캡션', channels.tiktok.caption, v => updateChannel('tiktok', { ...channels.tiktok!, caption: v })]]}
                />
              )}
              {active === 'cardnews' && channels.cardnews && <CardnewsEditor value={channels.cardnews} onChange={v => updateChannel('cardnews', v)} date={ctx?.date || ''} />}
              {active === 'threads' && channels.threads && (
                <div className="space-y-3">
                  {channels.threads.posts.map((p, i) => (
                    <div key={i}>
                      <label htmlFor={`mk-th-${i}`} className="text-xs text-slate-300 flex justify-between"><span>{i + 1}/{channels.threads!.posts.length}</span><span className={p.length > 500 ? 'text-red-300' : 'text-slate-400'}>{p.length}/500</span></label>
                      <textarea id={`mk-th-${i}`} rows={5} className={input} value={p} onChange={e => { const posts = [...channels.threads!.posts]; posts[i] = e.target.value; updateChannel('threads', { ...channels.threads!, posts }); }} />
                    </div>
                  ))}
                  <label htmlFor="mk-th-c" className="text-xs text-slate-300">첫 댓글 ({'{LINK}'} 자리에 랜딩 URL이 들어갑니다)</label>
                  <textarea id="mk-th-c" rows={2} className={input} value={channels.threads.firstComment} onChange={e => updateChannel('threads', { ...channels.threads!, firstComment: e.target.value })} />
                </div>
              )}
              {active === 'facebook' && channels.facebook && (
                <div className="space-y-2">
                  <label htmlFor="mk-fb" className="text-xs text-slate-300">본문 ({channels.facebook.body.length}자)</label>
                  <textarea id="mk-fb" rows={18} className={input} value={channels.facebook.body} onChange={e => updateChannel('facebook', { ...channels.facebook!, body: e.target.value })} />
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">광고 규정 검사</h4>
                <IssueList issues={compliance.byChannel[active]?.issues || []} />
              </div>
              <button type="button" className={`${btnGhost} w-full`} onClick={() => {
                const text = channelPlainText(active, channels);
                copyText(text, active === 'blog' && channels.blog ? channels.blog.html : undefined);
              }}>
                <Copy size={16} />{active === 'blog' ? '서식 포함 복사' : '전문 복사'}
              </button>
              <PublishBox
                channel={active}
                campaign={campaign}
                dirty={dirty}
                autoAvailable={Boolean(info?.status.publishers[active])}
                blocked={Boolean(compliance.byChannel[active]?.issues.some(i => i.severity === 'high'))}
                onPublished={onPublished}
              />
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 게시 박스 ───
const MANUAL_GUIDE: Partial<Record<ChannelId, string>> = {
  blog: '네이버 블로그는 공식 글쓰기 API가 없습니다. "서식 포함 복사" 후 스마트에디터에 붙여넣고 이미지 4컷을 올리세요.',
  shorts: 'YouTube Data API 업로드는 OAuth 앱 검증 전에는 비공개로 제한됩니다. 녹화한 영상을 YouTube Studio에서 올리세요.',
  tiktok: '틱톡 Content Posting API는 감사(audit) 전에는 비공개(SELF_ONLY) 게시만 됩니다. 앱에서 직접 올리세요.',
  cardnews: '인스타그램 API 게시는 이미지 공개 URL과 Meta 앱 검수가 필요합니다. PNG ZIP을 내려받아 앱에서 올리세요.',
  threads: 'THREADS_USER_ID / THREADS_ACCESS_TOKEN 을 서버에 설정하면 타래를 API로 게시합니다.',
  facebook: 'META_PAGE_ID / META_PAGE_ACCESS_TOKEN 을 서버에 설정하면 페이지에 API로 게시합니다.',
};

function PublishBox({ channel, campaign, dirty, autoAvailable, blocked, onPublished }: {
  channel: ChannelId; campaign: { id: string; status: CampaignStatus; posts: ChannelPost[] } | null; dirty: boolean;
  autoAvailable: boolean; blocked: boolean; onPublished: (p: ChannelPost) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const posts = campaign?.posts.filter(p => p.channel === channel) || [];
  const approved = campaign && (campaign.status === 'approved' || campaign.status === 'published');
  const disabledReason = !campaign ? '먼저 저장하고 승인하세요.' : dirty ? '변경 내용을 저장하세요.' : !approved ? '승인 후 게시할 수 있습니다.' : blocked ? '고위험 표현을 먼저 고치세요.' : '';

  const run = async (manual: boolean) => {
    if (!campaign) return;
    setErr('');
    if (manual && url && !/^https:\/\//.test(url)) { setErr('https:// 로 시작하는 게시물 주소를 입력하세요.'); return; }
    setBusy(true);
    try {
      const r = await autopilotApi.publish(campaign.id, channel, manual ? url : undefined);
      onPublished(r.post);
      setUrl('');
      toast.success(manual ? '게시 기록을 남겼습니다.' : 'API로 게시했습니다.');
    } catch (e) {
      setErr(explainAutopilotError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-800 pt-4">
      <h4 className="text-sm font-bold text-white">게시</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{MANUAL_GUIDE[channel]}</p>
      {disabledReason && <p className="text-xs text-amber-200">{disabledReason}</p>}
      {autoAvailable && (
        <button type="button" className={`${btnPrimary} w-full`} disabled={!!disabledReason || busy} onClick={() => run(false)}>
          <Send size={16} />{busy ? '게시 중…' : 'API로 지금 게시'}
        </button>
      )}
      <label htmlFor={`mk-url-${channel}`} className="text-xs text-slate-300">직접 게시한 게시물 주소</label>
      <input id={`mk-url-${channel}`} className={input} placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} disabled={!!disabledReason} />
      <button type="button" className={`${btnGhost} w-full`} disabled={!!disabledReason || busy} onClick={() => run(true)}>
        <Link2 size={16} />게시 완료 기록
      </button>
      {err && <p className="text-xs text-red-300" role="alert">{err}</p>}
      {posts.length > 0 && (
        <ul className="text-xs space-y-1">
          {posts.map((p, i) => (
            <li key={i} className={p.publish_status === 'failed' ? 'text-red-300' : 'text-emerald-300'}>
              {p.publish_status === 'failed' ? `실패: ${p.error_message || ''}` : `게시됨 ${p.published_at ? new Date(p.published_at).toLocaleString('ko-KR') : ''}`}
              {p.external_post_url && <> · <a href={p.external_post_url} target="_blank" rel="noopener noreferrer" className="underline">열기</a></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 블로그 편집 + 이미지 4컷 ───
const BLOG_IMAGE_SPECS = [
  { tag: '대표 썸네일', w: 1080, h: 1080, ar: '1:1' as const },
  { tag: '뉴스 인포그래픽', w: 1080, h: 810, ar: '4:3' as const },
  { tag: '앱 사용 장면', w: 1080, h: 1080, ar: '1:1' as const },
  { tag: '안내 배너', w: 1200, h: 675, ar: '16:9' as const },
];

function BlogEditor({ value, onChange, date }: { value: NonNullable<CampaignChannels['blog']>; onChange: (v: NonNullable<CampaignChannels['blog']>) => void; date: string }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [bgs, setBgs] = useState<(HTMLImageElement | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState(false);

  const redraw = useCallback(async () => {
    await ensureFonts(value.images.flatMap(i => [i.headline, i.sub]).concat(BLOG_IMAGE_SPECS.map(s => s.tag)));
    value.images.slice(0, 4).forEach((img, i) => {
      const c = canvases.current[i];
      const s = BLOG_IMAGE_SPECS[i];
      if (c) drawBlogImage(c, { bg: bgs[i], headline: img.headline, sub: img.sub, tag: s.tag, w: s.w, h: s.h, index: i });
    });
  }, [value.images, bgs]);
  useEffect(() => { redraw(); }, [redraw]);

  const makeImages = async () => {
    setLoading(true);
    const out = await Promise.all(value.images.slice(0, 4).map(async (img, i) => {
      try { return await loadImage((await autopilotApi.image(img.prompt, BLOG_IMAGE_SPECS[i].ar)).dataUrl); } catch {
        try { return await loadImage(await toDataUrl(fallbackImageUrl(img.prompt, BLOG_IMAGE_SPECS[i].w, BLOG_IMAGE_SPECS[i].h, 31 + i))); } catch { return null; }
      }
    }));
    setBgs(out);
    setLoading(false);
    const miss = out.filter(o => !o).length;
    if (miss) toast.info(`${miss}장은 배경 없이 그라데이션으로 표시합니다.`);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (let i = 0; i < 4; i++) {
      const c = canvases.current[i];
      if (c) zip.file(`mykim-blog-${date}-${i + 1}.png`, await canvasToBlob(c));
    }
    zip.file(`mykim-blog-${date}.html`, value.html);
    zip.file(`mykim-blog-${date}.txt`, `${value.title}\n\n${value.fullBody}`);
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `mykim-blog-${date}.zip`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="mk-blog-title" className="text-xs text-slate-300">제목 ({value.title.length}자)</label>
        <input id="mk-blog-title" className={input} value={value.title} onChange={e => onChange({ ...value, title: e.target.value, html: blogTextToHtml(e.target.value, value.fullBody) })} />
      </div>
      <div className="space-y-1">
        <label htmlFor="mk-blog-body" className="text-xs text-slate-300">본문 ({value.fullBody.replace(/\s/g, '').length}자, 공백 제외) — "■ " 로 시작하는 줄은 소제목</label>
        <textarea id="mk-blog-body" rows={20} className={`${input} font-sans leading-relaxed`} value={value.fullBody} onChange={e => onChange({ ...value, fullBody: e.target.value, html: blogTextToHtml(value.title, e.target.value) })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-white">본문 이미지 4컷</h4>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={makeImages} disabled={loading}><Sparkles size={16} />{loading ? '배경 생성 중…' : 'AI 배경 생성'}</button>
          <button type="button" className={btnGhost} onClick={downloadZip}><Download size={16} />PNG·HTML ZIP</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {value.images.slice(0, 4).map((img, i) => (
          <div key={i} className="space-y-1.5">
            <canvas ref={el => { canvases.current[i] = el; }} className={`w-full rounded-xl border border-slate-700 ${loading ? 'animate-pulse' : ''}`} aria-label={`블로그 이미지 ${i + 1}`} />
            <input className={input} value={img.headline} aria-label={`이미지 ${i + 1} 제목`} onChange={e => { const images = [...value.images]; images[i] = { ...img, headline: e.target.value }; onChange({ ...value, images }); }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 카드뉴스 편집 + 렌더 ───
function CardnewsEditor({ value, onChange, date }: { value: NonNullable<CampaignChannels['cardnews']>; onChange: (v: NonNullable<CampaignChannels['cardnews']>) => void; date: string }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const total = value.slides.length;

  useEffect(() => {
    let alive = true;
    ensureFonts(value.slides.flatMap(s => [s.headline, s.body]).concat(MARKETING_DISCLAIMER_SHORT)).then(() => {
      if (!alive) return;
      value.slides.forEach((s, i) => {
        const c = canvases.current[i];
        if (c) drawCardSlide(c, { bg, headline: s.headline, body: s.body, index: i, total, footnote: i === total - 1 ? MARKETING_DISCLAIMER_SHORT : undefined });
      });
    });
    return () => { alive = false; };
  }, [value.slides, bg, total]);

  const makeBg = async () => {
    setLoading(true);
    try { setBg(await loadImage((await autopilotApi.image(value.backgroundPrompt, '1:1')).dataUrl)); } catch {
      try { setBg(await loadImage(await toDataUrl(fallbackImageUrl(value.backgroundPrompt, 1080, 1080, 77)))); toast.info('무료 폴백 배경을 썼습니다.'); } catch { toast.error('배경을 만들지 못했습니다.'); }
    }
    setLoading(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (let i = 0; i < total; i++) {
      const c = canvases.current[i];
      if (c) zip.file(`mykim-card-${date}-${String(i + 1).padStart(2, '0')}.png`, await canvasToBlob(c));
    }
    zip.file(`mykim-card-${date}-caption.txt`, value.caption);
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `mykim-cardnews-${date}.zip`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" className={btnGhost} onClick={makeBg} disabled={loading}><Sparkles size={16} />{loading ? '배경 생성 중…' : 'AI 배경 생성'}</button>
        <button type="button" className={btnGhost} onClick={downloadZip}><Download size={16} />{total}장 PNG ZIP</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {value.slides.map((s, i) => (
          <div key={i} className="space-y-1.5">
            <canvas ref={el => { canvases.current[i] = el; }} className={`w-full aspect-square rounded-xl border border-slate-700 ${loading ? 'animate-pulse' : ''}`} aria-label={`카드 ${i + 1}`} />
            <input className={input} value={s.headline} aria-label={`카드 ${i + 1} 제목`} onChange={e => { const slides = [...value.slides]; slides[i] = { ...s, headline: e.target.value }; onChange({ ...value, slides }); }} />
            <textarea className={input} rows={2} value={s.body} aria-label={`카드 ${i + 1} 본문`} onChange={e => { const slides = [...value.slides]; slides[i] = { ...s, body: e.target.value }; onChange({ ...value, slides }); }} />
          </div>
        ))}
      </div>
      <label htmlFor="mk-card-cap" className="text-xs text-slate-300">게시글 캡션</label>
      <textarea id="mk-card-cap" rows={6} className={input} value={value.caption} onChange={e => onChange({ ...value, caption: e.target.value })} />
    </div>
  );
}

// ─── 숏폼 장면 편집 + 영상 렌더러 ───
function ScenesEditor({ scenes, onScenes, fields, fileBase }: {
  scenes: Scene[]; onScenes: (s: Scene[]) => void; fileBase: string;
  fields: [string, string, (v: string) => void][];
}) {
  const [edit, setEdit] = useState(false);
  return (
    <div className="space-y-5">
      <ShortsVideoRenderer scenes={scenes} badge="오늘의 회생 뉴스" disclaimer={MARKETING_DISCLAIMER_SHORT} fileBase={fileBase} />
      <button type="button" className={btnGhost} onClick={() => setEdit(v => !v)} aria-expanded={edit}>{edit ? '대본 편집 닫기' : '대본·자막 편집'}</button>
      {edit && (
        <div className="space-y-3">
          {scenes.map((s, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[80px_1fr_2fr] gap-2 items-start">
              <input type="number" min={1.5} max={15} step={0.5} className={input} aria-label={`${i + 1}번 장면 길이(초)`} value={s.seconds}
                onChange={e => { const n = [...scenes]; n[i] = { ...s, seconds: Math.min(15, Math.max(1.5, Number(e.target.value) || s.seconds)) }; onScenes(n); }} />
              <input className={input} aria-label={`${i + 1}번 장면 자막`} value={s.caption} onChange={e => { const n = [...scenes]; n[i] = { ...s, caption: e.target.value }; onScenes(n); }} />
              <textarea className={input} rows={2} aria-label={`${i + 1}번 장면 나레이션`} value={s.narration} onChange={e => { const n = [...scenes]; n[i] = { ...s, narration: e.target.value }; onScenes(n); }} />
            </div>
          ))}
          {fields.map(([label, v, set]) => (
            <div key={label} className="space-y-1">
              <label className="text-xs text-slate-300">{label}</label>
              <textarea className={input} aria-label={label} rows={label === '설명란' ? 5 : 2} value={v} onChange={e => set(e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
