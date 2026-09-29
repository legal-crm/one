/**
 * 마케팅 데일리 오토파일럿 클라이언트
 * 서버: /api/generate-statement (mode: mk-*) — 관리자(2단계 인증) 세션 필요
 * 규칙 검사기는 서버와 같은 파일(api/_lib/marketing-compliance.js)을 공유한다.
 */
import { getAuthHeaders } from '../supabaseClient';
// @ts-ignore — 순수 JS 모듈 (서버·브라우저 공용)
import * as compliance from '../../api/_lib/marketing-compliance.js';

export type ChannelId = 'blog' | 'shorts' | 'tiktok' | 'cardnews' | 'threads' | 'facebook';
export type GroupId = 'blog' | 'shortform' | 'social';
export const GROUP_CHANNELS: Record<GroupId, ChannelId[]> = {
  blog: ['blog'],
  shortform: ['shorts', 'tiktok'],
  social: ['cardnews', 'threads', 'facebook'],
};

export interface RotationTheme { day: number; code: string; emoji: string; title: string; hook: string; solution: string; keywords: string[] }
export interface NewsItem { title: string; url: string; source: string; description: string; publishedAt: string; provider?: string; score?: { total: number; popularity: number; trust: number; relevance: number } }
export interface DailyContext {
  date: string;
  theme: RotationTheme;
  news: NewsItem;
  facts: string[];
  bridge: { step1Fact: string; step2Dilemma: string; step3Bridge: string };
  angle: string;
  reason: string;
}
export interface Scene { seconds: number; caption: string; narration: string; visualPrompt: string; motion?: string }
export interface BlogChannel {
  title: string; summary: string; answerFirst: string[];
  sections: { heading: string; body: string }[];
  comparisonTable?: { caption?: string; columns: string[]; rows: string[][] } | null;
  faq: { q: string; a: string }[]; hashtags: string[];
  images: { prompt: string; headline: string; sub: string }[];
  fullBody: string; html: string;
}
export interface ShortsChannel { title: string; hookLine: string; scenes: Scene[]; loopLine: string; description: string; pinnedComment: string; hashtags: string[]; totalSeconds: number }
export interface TiktokChannel { hookLine: string; scenes: Scene[]; caption: string; hashtags: string[]; totalSeconds: number }
export interface CardnewsChannel { slides: { headline: string; body: string }[]; caption: string; hashtags: string[]; backgroundPrompt: string }
export interface ThreadsChannel { posts: string[]; firstComment: string }
export interface FacebookChannel { body: string; hashtags: string[] }
export interface CampaignChannels {
  blog?: BlogChannel; shorts?: ShortsChannel; tiktok?: TiktokChannel;
  cardnews?: CardnewsChannel; threads?: ThreadsChannel; facebook?: FacebookChannel;
}
export interface ComplianceIssue { ruleId: string; severity: 'high' | 'medium' | 'low'; label: string; match: string; hint: string }
export interface ChannelCompliance { issues: ComplianceIssue[]; score: number; hasDisclaimer: boolean }
export interface CampaignCompliance { byChannel: Partial<Record<ChannelId, ChannelCompliance>>; score: number; highCount: number; publishable: boolean }
export type CampaignStatus = 'ready' | 'approved' | 'rejected' | 'published';
export interface ChannelPost { id?: string; campaign_id: string; channel: ChannelId; publish_status: string; external_post_url: string | null; published_at: string | null; error_message?: string | null }
export interface CampaignSummary { id: string; campaign_date: string; day_theme_code: string; news_title: string; status: CampaignStatus; compliance_score: number; source: 'manual' | 'cron'; posts: ChannelPost[] }
export interface CampaignRow extends CampaignSummary {
  news: NewsItem; context: { facts: string[]; bridge: DailyContext['bridge']; angle: string; reason: string; candidates: NewsItem[] };
  channels: CampaignChannels; compliance: CampaignCompliance; models: Record<string, unknown>;
}
export interface AutopilotStatus {
  status: {
    commonConfigured: boolean;
    roles: { role: string; label: string; env: string; dedicated: boolean; configured: boolean }[];
    textModels: string[]; imageModels: string[]; ttsModels: string[];
    newsProviders: { googleNews: boolean; naver: boolean };
    publishers: Record<ChannelId | 'instagram' | 'youtube', boolean>;
    cron: boolean;
  };
  today: { date: string; dayOfWeek: number };
  themes: RotationTheme[];
  schedule: { channel: ChannelId; label: string; time: string }[];
}

export class AutopilotError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function call<T>(mode: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode, ...payload }),
    });
  } catch {
    throw new AutopilotError('서버에 연결하지 못했습니다. 네트워크를 확인하세요.', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new AutopilotError(json?.error || `서버 응답 오류 (${res.status})`, res.status);
  }
  return json as T;
}

export const autopilotApi = {
  status: () => call<AutopilotStatus & { ok: true }>('mk-status'),
  news: (themeCode?: string) => call<{ theme: RotationTheme; candidates: NewsItem[] }>('mk-news', { themeCode }),
  context: (p: { themeCode?: string; candidates?: NewsItem[]; selectedIndex?: number; manualTopic?: string; manualFacts?: string[] }) =>
    call<{ ctx: DailyContext; candidates?: NewsItem[]; model?: string }>('mk-context', p),
  generate: (group: GroupId, ctx: DailyContext) =>
    call<{ channels: CampaignChannels; compliance: CampaignCompliance; model: string; revised: boolean; autoFixed: string[] }>('mk-generate', { group, ctx }),
  save: (ctx: DailyContext, channels: CampaignChannels, candidates?: NewsItem[], models?: Record<string, unknown>) =>
    call<{ id: string; compliance: CampaignCompliance }>('mk-save', { ctx, channels, candidates, models }),
  list: (month: string) => call<{ campaigns: CampaignSummary[] }>('mk-list', { month }),
  get: (p: { id?: string; date?: string }) => call<{ campaign: (CampaignRow & { posts: ChannelPost[] }) | null }>('mk-get', p),
  update: (id: string, p: { status?: CampaignStatus; channels?: CampaignChannels }) =>
    call<{ campaign: { id: string; status: CampaignStatus; compliance_score: number; compliance: CampaignCompliance } }>('mk-update', { id, ...p }),
  publish: (id: string, channel: ChannelId, manualUrl?: string) => call<{ post: ChannelPost }>('mk-publish', { id, channel, manualUrl }),
  image: (prompt: string, aspectRatio: '1:1' | '9:16' | '16:9' | '4:3') => call<{ dataUrl: string; model: string }>('mk-image', { prompt, aspectRatio }),
  tts: (text: string, voice = 'Kore') => call<{ mimeType: string; data: string; model: string }>('mk-tts', { text, voice }),
  stats: () => call<{ since: string; campaigns: CampaignSummary[]; posts: ChannelPost[] }>('mk-stats'),
};

// ─── 규칙 검사 (브라우저에서 수정 즉시 재검사) ───
export const MARKETING_DISCLAIMER: string = compliance.MARKETING_DISCLAIMER;
export const MARKETING_DISCLAIMER_SHORT: string = compliance.MARKETING_DISCLAIMER_SHORT;

/** 블로그 본문 평문 → 네이버 스마트에디터 붙여넣기용 HTML (■ 소제목 → h3) */
export function blogTextToHtml(title: string, text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = text.split('\n').map(line => {
    const l = line.trim();
    if (!l) return '';
    if (l.startsWith('■ ')) return `<h3>${esc(l.slice(2))}</h3>`;
    if (/^\[📷/.test(l)) return `<p style="color:#6366f1">${esc(l)}</p>`;
    return `<p>${esc(l)}</p>`;
  }).join('');
  return `<h2>${esc(title)}</h2>${body}`;
}

/** 저장 실패 메시지를 관리자가 조치할 수 있는 안내로 바꾼다 */
export function explainAutopilotError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (e instanceof AutopilotError && e.status === 403) return '관리자 2단계 인증(MFA) 세션에서만 사용할 수 있습니다. 다시 로그인해 2단계 인증을 완료하세요.';
  if (/does not exist|schema cache|relation/i.test(msg)) return 'DB 테이블이 없습니다. Supabase에서 supabase/migrations/027_marketing_autopilot.sql 을 실행하세요.';
  if (/GEMINI_API_KEY/.test(msg)) return '서버 환경변수 GEMINI_API_KEY가 설정되지 않았습니다 (Vercel 프로젝트 설정).';
  return msg;
}
export function scanText(text: string, sourceText?: string): ChannelCompliance {
  return compliance.scanCompliance(text, { sourceText });
}

/** 채널 콘텐츠 → 검사/복사용 평문 */
export function channelPlainText(channel: ChannelId, c: CampaignChannels): string {
  switch (channel) {
    case 'blog': return c.blog ? `${c.blog.title}\n\n${c.blog.fullBody}` : '';
    case 'shorts': return c.shorts ? [c.shorts.title, ...c.shorts.scenes.map((s, i) => `#${i + 1} (${s.seconds}초) 자막: ${s.caption}\n나레이션: ${s.narration}`), `루프: ${c.shorts.loopLine}`, `고정 댓글: ${c.shorts.pinnedComment}`, '', c.shorts.description].join('\n') : '';
    case 'tiktok': return c.tiktok ? [...c.tiktok.scenes.map((s, i) => `#${i + 1} (${s.seconds}초) 자막: ${s.caption}\n나레이션: ${s.narration}`), '', c.tiktok.caption].join('\n') : '';
    case 'cardnews': return c.cardnews ? [...c.cardnews.slides.map((s, i) => `[${i + 1}장] ${s.headline}\n${s.body}`), '', c.cardnews.caption].join('\n') : '';
    case 'threads': return c.threads ? [...c.threads.posts.map((p, i) => `(${i + 1}/${c.threads!.posts.length})\n${p}`), '', `첫 댓글: ${c.threads.firstComment}`].join('\n\n') : '';
    case 'facebook': return c.facebook ? c.facebook.body : '';
  }
}

/** 채널별 검사용 텍스트 (서버 channelTexts 와 같은 범위) */
function channelScanText(channel: ChannelId, c: CampaignChannels): string {
  switch (channel) {
    case 'shorts': return c.shorts ? [c.shorts.title, ...c.shorts.scenes.flatMap(s => [s.caption, s.narration]), c.shorts.loopLine, c.shorts.pinnedComment, c.shorts.description].join('\n') : '';
    case 'tiktok': return c.tiktok ? [...c.tiktok.scenes.flatMap(s => [s.caption, s.narration]), c.tiktok.caption].join('\n') : '';
    case 'cardnews': return c.cardnews ? [...c.cardnews.slides.flatMap(s => [s.headline, s.body]), c.cardnews.caption].join('\n') : '';
    case 'threads': return c.threads ? [...c.threads.posts, c.threads.firstComment].join('\n') : '';
    default: return channelPlainText(channel, c);
  }
}

export function scanChannelsLocal(c: CampaignChannels, ctx?: Pick<DailyContext, 'news' | 'facts'>): CampaignCompliance {
  const texts: Record<string, string> = {};
  (Object.keys(c) as ChannelId[]).forEach(ch => { if (c[ch]) texts[ch] = channelScanText(ch, c); });
  const source = ctx ? [ctx.news?.title, ctx.news?.description, ...(ctx.facts || [])].join(' ') : '';
  return compliance.scanCampaignTexts(texts, source);
}

/** Gemini TTS PCM(L16) base64 → AudioBuffer */
export async function pcmBase64ToAudioBuffer(ctx: BaseAudioContext, base64: string, mimeType: string): Promise<AudioBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (/wav|mpeg|mp3|ogg/.test(mimeType)) {
    return ctx.decodeAudioData(bytes.buffer.slice(0));
  }
  const rate = Number((mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
  const samples = Math.floor(bytes.length / 2);
  const buf = ctx.createBuffer(1, samples, rate);
  const ch = buf.getChannelData(0);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
  return buf;
}

/** 무료 폴백 배경 (Pollinations, 키 불필요 — 제3자 서비스이므로 상업 이용 조건 확인 필요) */
export function fallbackImageUrl(prompt: string, w: number, h: number, seed = 7): string {
  const clean = prompt.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').replace(/\s+/g, ' ').trim();
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(`${clean}, photorealistic, no text, no letters, no logo`)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
}

/** 외부 이미지 URL → data URL (캔버스 오염 방지) */
export async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const r = await fetch(src);
  if (!r.ok) throw new Error(`이미지를 불러오지 못했습니다 (${r.status})`);
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('이미지 변환 실패'));
    fr.readAsDataURL(blob);
  });
}
