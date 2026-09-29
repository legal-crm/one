// 마이김변 데일리 마케팅 오토파일럿 엔진 (서버 전용)
//   뉴스 수집 → 이슈 선정·팩트 추출 → 요일 테마 결합(3단 귀속) → 6채널 생성 → 규정 검사·자동 수정 → 저장 → (선택) 게시
// 호출 위치: api/generate-statement.js (Vercel 함수 개수 한도 때문에 mode 로 분기)

import { z } from 'zod';
import { supabase } from './auth-middleware.js';
import {
  fixCompliance, ensureDisclaimer, scanCampaignTexts, scanCompliance,
  MARKETING_DISCLAIMER, MARKETING_DISCLAIMER_SHORT,
} from './marketing-compliance.js';

// ─────────────────────────────────────────────────────────────
// 1. 요일별 7대 장점 로테이션 (0=일 ~ 6=토, 한국 시간 기준)
//    기획서 문구 중 규정 위반 소지('유출 0%', '전문 변호사 매칭')는 사실 표현으로 바꿨다.
// ─────────────────────────────────────────────────────────────
export const ROTATION_THEMES = [
  { day: 0, code: 'weekly_diagnosis', emoji: '📊', title: '주간 자가진단', hook: '이번 주 회생 뉴스, 내 빚에도 해당될까?', solution: '최신 기준을 반영한 30초 익명 자가진단과 변제금 계산기로 먼저 확인해 보세요 (결과는 참고용).', keywords: ['기준', '생계비', '변제', '개정', '통계', '계산'] },
  { day: 1, code: 'voice_statement', emoji: '⚡', title: '서류 혁신', hook: '수십 종 서류 떼고 진술서 쓰다 밤새우셨나요?', solution: '말로 설명하면 진술서 초안을 만들어 주는 AI 음성 진술서와 제출 서류 정리 기능(DocHub)을 써 보세요.', keywords: ['서류', '진술서', '신청', '절차', '보정', '제출'] },
  { day: 2, code: 'stealth_selection', emoji: '🛡️', title: '안심 탐색', hook: '번호 남겼다가 영업 전화에 시달리셨죠?', solution: '변호사 프로필을 직접 확인하고, 010 번호를 공개하지 않는 스텔스 가명으로 여러 사무소에 견적·상담을 요청할 수 있습니다.', keywords: ['불법추심', '추심', '대출', '광고', '개인정보', '브로커', '사기'] },
  { day: 3, code: 'lawyer_welcome', emoji: '⚖️', title: '전문가 협업', hook: '서류가 부실해서 보정명령 받으면 어쩌나 걱정되시나요?', solution: '표준 양식으로 정리한 서류를 선택한 변호사와 공유해, 변호사가 사건 검토에 집중할 수 있게 돕습니다.', keywords: ['법원', '보정', '실무준칙', '변호사', '기각', '인가'] },
  { day: 4, code: 'doc_compatibility', emoji: '🔗', title: '높은 호환성', hook: '이미 다른 곳에 맡겼는데 서류 준비가 막막하신가요?', solution: '어느 사무소에서 진행하든, 나홀로 신청하든 마이김변에서 서류를 만들어 담당 변호사에게 링크·QR로 전달할 수 있습니다.', keywords: ['나홀로', '신청', '서류', '법률구조', '지원'] },
  { day: 5, code: 'mobile_contract', emoji: '📱', title: '비대면 기술', hook: '평일에 사무실 방문할 시간이 없으신가요?', solution: '모바일 전자계약으로 방문 없이 계약하고, 계약서 해시를 블록체인에 기록해 원본을 확인할 수 있습니다.', keywords: ['비대면', '디지털', '모바일', '온라인', '전자'] },
  { day: 6, code: 'rehab_companion', emoji: '🤝', title: '면책 완주', hook: '인가 후 혼자 갚다가 미납되면 어떻게 되나요?', solution: '매월 변제금 납부일 알림과 미납 경고를 챙겨주는 회생동행 캘린더로 변제 기간을 관리해 보세요.', keywords: ['변제', '미납', '면책', '폐지', '인가', '생계'] },
];

export const GOLDEN_SCHEDULE = [
  { channel: 'blog', label: '네이버 블로그', time: '10:00' },
  { channel: 'threads', label: '스레드', time: '12:30' },
  { channel: 'facebook', label: '페이스북', time: '14:00' },
  { channel: 'cardnews', label: '인스타그램', time: '17:30' },
  { channel: 'shorts', label: '유튜브 쇼츠', time: '18:40' },
  { channel: 'tiktok', label: '틱톡', time: '20:30' },
];

/** 한국 시간 기준 날짜(YYYY-MM-DD)와 요일 */
export function kstToday(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), dayOfWeek: d.getUTCDay() };
}

export function themeForDay(dayOfWeek) {
  return ROTATION_THEMES[((dayOfWeek % 7) + 7) % 7];
}

export function themeByCode(code) {
  return ROTATION_THEMES.find(t => t.code === code) || null;
}

// ─────────────────────────────────────────────────────────────
// 2. 뉴스 수집 (Google News RSS: 키 불필요 / 네이버 뉴스 API: NAVER_CLIENT_ID·SECRET 있을 때)
// ─────────────────────────────────────────────────────────────
export const NEWS_KEYWORDS = ['개인회생', '개인파산', '채무조정', '새출발기금', '최저생계비', '불법추심', '가계부채', '회생법원'];

const decodeEntities = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
};

async function fetchGoogleNews(keyword) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${keyword} when:3d`)}&hl=ko&gl=KR&ceid=KR:ko`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MykimMarketingBot/1.0)' } });
  if (!r.ok) return [];
  const xml = await r.text();
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 10).map(item => {
    const rawTitle = tag(item, 'title');
    const source = tag(item, 'source');
    const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    return {
      title,
      url: tag(item, 'link'),
      source: source || 'Google News',
      description: tag(item, 'description').replace(title, '').replace(source, '').trim().slice(0, 400),
      publishedAt: tag(item, 'pubDate'),
      keyword,
      provider: 'google-news',
    };
  });
}

async function fetchNaverNews(keyword) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=10&sort=date`;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
  });
  if (!r.ok) return [];
  const json = await r.json();
  return (json.items || []).map(it => {
    const link = it.originallink || it.link || '';
    let source = '네이버 뉴스';
    try { source = new URL(link).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
    return {
      title: decodeEntities(it.title),
      url: link,
      source,
      description: decodeEntities(it.description).slice(0, 400),
      publishedAt: it.pubDate || '',
      keyword,
      provider: 'naver',
    };
  });
}

const OFFICIAL_TERMS = ['대법원', '회생법원', '법원', '금융위', '금융위원회', '금감원', '금융감독원', '서민금융진흥원', '신용회복위원회', '정부', '국회', '법무부', '개정', '시행', '발표'];
const PUBLIC_TERMS = ['개인회생', '파산', '채무', '빚', '생계비', '추심', '대출', '연체', '이자', '신용', '서민', '자영업', '청년', '전세'];
const TRUSTED_SOURCES = ['연합뉴스', '뉴시스', '뉴스1', 'KBS', 'MBC', 'SBS', 'YTN', '한국경제', '매일경제', '조선일보', '중앙일보', '동아일보', '한겨레', '경향신문', '서울신문', '법률신문', 'yna.co.kr', 'newsis.com', 'news1.kr', 'lawtimes.co.kr'];
const PROMO_TERMS = ['법무법인', '법률사무소', '무료상담', '무료 상담', '광고', '[AD]', '홍보', '이벤트', '수임료'];

/**
 * 기획서 기준 점수: 대중성 40 + 법적 신뢰성 30 + 오늘 테마 연결성 30
 * (AI 선정 전 1차 정렬용. 경쟁 사무소 홍보성 기사는 감점)
 */
export function scoreNews(item, theme) {
  const text = `${item.title} ${item.description}`;
  const count = (terms) => terms.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
  const popularity = Math.min(40, count(PUBLIC_TERMS) * 8);
  const trust = Math.min(30, count(OFFICIAL_TERMS) * 8 + (TRUSTED_SOURCES.some(s => item.source.includes(s)) ? 8 : 0));
  const relevance = Math.min(30, count(theme?.keywords || []) * 10 + (text.includes('회생') || text.includes('파산') ? 10 : 0));
  const promoPenalty = count(PROMO_TERMS) * 15;
  let recency = 0;
  const t = Date.parse(item.publishedAt);
  if (Number.isFinite(t)) {
    const hours = (Date.now() - t) / 3600000;
    recency = hours <= 24 ? 5 : hours <= 72 ? 0 : -10;
  }
  const total = Math.max(0, Math.min(100, popularity + trust + relevance + recency - promoPenalty));
  return { total, popularity, trust, relevance };
}

/** 여러 키워드로 뉴스를 모아 중복 제거 후 점수순 정렬 */
export async function collectNews(theme, { keywords = NEWS_KEYWORDS, limit = 12 } = {}) {
  const jobs = [];
  for (const k of keywords) {
    jobs.push(fetchGoogleNews(k).catch(() => []));
    jobs.push(fetchNaverNews(k).catch(() => []));
  }
  const all = (await Promise.all(jobs)).flat();
  const seen = new Set();
  const unique = [];
  for (const it of all) {
    if (!it.title || !it.url) continue;
    const key = it.title.replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...it, score: scoreNews(it, theme) });
  }
  unique.sort((a, b) => b.score.total - a.score.total);
  return unique.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// 3. Gemini 호출 (역할별 키 + 모델 폴백)
//   역할별 키(GEMINI_API_KEY_EDITOR 등)가 없으면 공통 GEMINI_API_KEY 사용.
//   429 시 같은 키로 다음 모델을 시도한다(여러 계정을 돌려 한도를 우회하지 않음 — Gemini API 약관상 우회 금지).
// ─────────────────────────────────────────────────────────────
export const AI_ROLES = {
  editor: { env: 'GEMINI_API_KEY_EDITOR', label: '#1 뉴스 분석·수석 검수' },
  blog: { env: 'GEMINI_API_KEY_BLOG', label: '#2 네이버 블로그 작가' },
  shorts: { env: 'GEMINI_API_KEY_SHORTS', label: '#3 숏폼 영상 디렉터' },
  social: { env: 'GEMINI_API_KEY_SOCIAL', label: '#4 소셜 스토리텔러' },
  visual: { env: 'GEMINI_API_KEY_VISUAL', label: '#5 비주얼·음성' },
};

const listEnv = (name, fallback) => (process.env[name] ? process.env[name].split(',').map(s => s.trim()).filter(Boolean) : fallback);
export const textModels = () => listEnv('MARKETING_TEXT_MODELS', ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash']);
export const imageModels = () => listEnv('MARKETING_IMAGE_MODELS', ['gemini-3.1-flash-image', 'gemini-2.5-flash-image']);
export const ttsModels = () => listEnv('MARKETING_TTS_MODELS', ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts']);

const commonKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
export const keyForRole = (role) => process.env[AI_ROLES[role]?.env] || commonKey();

/** 관리자 화면용 키 상태 (키 값은 절대 반환하지 않음) */
export function aiKeyStatus() {
  return {
    commonConfigured: Boolean(commonKey()),
    roles: Object.entries(AI_ROLES).map(([role, v]) => ({
      role, label: v.label, env: v.env,
      dedicated: Boolean(process.env[v.env]),
      configured: Boolean(process.env[v.env] || commonKey()),
    })),
    textModels: textModels(), imageModels: imageModels(), ttsModels: ttsModels(),
    newsProviders: { googleNews: true, naver: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) },
    publishers: publisherStatus(),
    cron: Boolean(process.env.CRON_SECRET),
  };
}

class AiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/**
 * generateContent 호출. 모델 목록을 순서대로 시도하고 응답의 parts 를 돌려준다.
 */
async function geminiCall({ role, models, body, deadline, perCallMs = 45000 }) {
  const key = keyForRole(role);
  if (!key) throw new AiError('서버에 GEMINI_API_KEY가 설정되지 않았습니다.', 503);
  let lastErr = null;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 4000) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(perCallMs, remaining - 1000)),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        lastErr = new AiError(`${model} 응답 오류 (${r.status})`, r.status);
        // 모델 없음(404)·한도(429)·서버 오류(5xx)·모델 미지원 파라미터(400)면 다음 모델
        if ([400, 404, 429, 500, 502, 503, 504].includes(r.status)) {
          console.warn(`[marketing] ${model} ${r.status}: ${errText.slice(0, 200)}`);
          continue;
        }
        throw lastErr;
      }
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      if (!parts.length) { lastErr = new AiError(`${model} 빈 응답`, 502); continue; }
      return { parts, model };
    } catch (e) {
      lastErr = e instanceof AiError ? e : new AiError(`${model} 호출 실패: ${e?.message || e}`, 504);
      if (e instanceof AiError && ![400, 404, 429, 500, 502, 503, 504].includes(e.status)) throw e;
    }
  }
  throw lastErr || new AiError('AI 호출 시간이 부족합니다.', 504);
}

function parseJsonLoose(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(clean); } catch { /* try slice */ }
  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  if (s >= 0 && e > s) return JSON.parse(clean.slice(s, e + 1));
  throw new Error('JSON 파싱 실패');
}

/**
 * JSON 생성 + zod 검증. 실패하면 오류를 알려 주고 1회 재시도.
 */
async function generateJson({ role, prompt, schema, deadline, temperature = 0.6 }) {
  let attemptPrompt = prompt;
  let lastIssue = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (deadline - Date.now() < 6000) break;
    const { parts, model } = await geminiCall({
      role, models: textModels(), deadline,
      body: {
        contents: [{ role: 'user', parts: [{ text: attemptPrompt }] }],
        generationConfig: { temperature, responseMimeType: 'application/json' },
      },
    });
    const text = parts.map(p => p.text || '').join('');
    try {
      const parsed = schema.safeParse(parseJsonLoose(text));
      if (parsed.success) return { data: parsed.data, model };
      lastIssue = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    } catch (e) {
      lastIssue = e.message;
    }
    attemptPrompt = `${prompt}\n\n[중요] 직전 응답이 형식에 맞지 않았습니다 (${lastIssue}). 지정한 JSON 구조만 정확히 반환하세요.`;
  }
  throw new AiError(`AI 응답 형식 오류: ${lastIssue || '시간 초과'}`, 502);
}

// ─────────────────────────────────────────────────────────────
// 4. 스키마 (zod) — 배열 최대 길이는 검증 후 잘라낸다
// ─────────────────────────────────────────────────────────────
const str = () => z.string().trim().min(1);
const EditorSchema = z.object({
  selectedIndex: z.coerce.number().int().min(0),
  reason: str(),
  facts: z.array(str()).min(1),
  step1Fact: str(),
  step2Dilemma: str(),
  step3Bridge: str(),
  angle: str(),
});
const BlogSchema = z.object({
  title: str(),
  summary: str(),
  answerFirst: z.array(str()).min(3),
  sections: z.array(z.object({ heading: str(), body: str() })).min(3),
  comparisonTable: z.object({ caption: z.string().optional(), columns: z.array(str()).min(2), rows: z.array(z.array(z.string())).min(2) }).optional().nullable(),
  faq: z.array(z.object({ q: str(), a: str() })).min(3),
  hashtags: z.array(str()).min(3),
  images: z.array(z.object({ prompt: str(), headline: str(), sub: z.string().default('') })).min(4),
});
const SceneSchema = z.object({ seconds: z.coerce.number().min(1.5).max(15), caption: str(), narration: str(), visualPrompt: str(), motion: z.string().optional() });
const ShortFormSchema = z.object({
  shorts: z.object({ title: str(), hookLine: str(), scenes: z.array(SceneSchema).min(4), loopLine: str(), description: str(), pinnedComment: str(), hashtags: z.array(str()).min(3) }),
  tiktok: z.object({ hookLine: str(), scenes: z.array(SceneSchema).min(3), caption: str(), hashtags: z.array(str()).min(3) }),
});
const SocialSchema = z.object({
  cardnews: z.object({ slides: z.array(z.object({ headline: str(), body: str() })).min(6), caption: str(), hashtags: z.array(str()).min(3), backgroundPrompt: str() }),
  threads: z.object({ posts: z.array(str()).min(4), firstComment: str() }),
  facebook: z.object({ body: str(), hashtags: z.array(str()).min(3) }),
});

// ─────────────────────────────────────────────────────────────
// 5. 프롬프트
// ─────────────────────────────────────────────────────────────
const PLATFORM_FACTS = `[마이김변 기능 사실 — 아래 목록에 있는 기능만, 아래 표현 수준으로만 언급]
- 변호사 탐색: 의뢰인이 변호사 프로필(경력·분야·후기)을 직접 보고 여러 사무소를 골라 견적·상담을 요청할 수 있음
- 스텔스 가명: 상담 요청 단계에서 010 번호를 변호사에게 공개하지 않고 인앱 채팅으로 소통할 수 있음
- AI 음성 진술서: 말로 설명하면 법원 제출용 진술서 초안을 만들어 줌 (최종 검토는 변호사와 본인)
- 서류 정리(DocHub): 수입지출목록·재산목록 등 제출 서류를 한곳에서 정리
- 서류 공유(LawyerDocShare): 다른 사무소에 맡겼거나 나홀로 신청하는 경우에도 서류를 만들어 담당 변호사에게 링크·QR로 전달
- 모바일 전자계약: 방문 없이 계약하고 계약서 해시를 블록체인에 기록해 원본 확인 가능
- 회생동행: 인가 후 매월 변제금 납부일 알림과 미납 경고
- 익명 자가진단·변제금 계산기: 30초 입력으로 참고용 결과 확인 (법적 판단 아님)`;

const RULES = `[광고 규정 — 반드시 지킬 것]
1. 결과 보장·단정 금지: "100% 탕감/면책", "무조건 인가", "반드시 해결" 등. → "요건을 충족하면 법원 기준에 따라 검토됩니다"
2. 근거 없는 수치·통계·성공률·승소율 금지. 숫자는 [뉴스 팩트]에 있는 것만 쓴다.
3. "국내 최초/유일/최고/1위" 같은 최상급·비교 표현 금지.
4. "역경매·입찰·최저가·가격 경쟁" 표현 금지. 플랫폼은 변호사를 알선·배정하지 않는다. → "의뢰인이 변호사 정보를 확인하고 직접 선택"
5. "무료 상담", "○○ 전문 변호사" 표현 금지 (무료는 자가진단 같은 플랫폼 기능에만).
6. "검수 완료", "변호사법 100% 준수" 같은 자기 인증 금지. 실제 후기·사례를 지어내지 않는다 (예시는 "예시"라고 밝힌다).
7. 공포 조장·과장 수식어("기적", "인생 역전", "빚 0원") 금지. 차분하고 정확한 정보 전달 톤.
8. 법원 판단은 사건마다 다르며 개별 사안은 변호사 상담이 필요하다는 점을 밝힌다.
9. 뉴스 원문에 없는 제도 변경·날짜·금액을 만들지 않는다. 불확실하면 "보도에 따르면"으로 쓴다.`;

function contextBlock(ctx) {
  const n = ctx.news;
  return `[오늘 날짜] ${ctx.date} (${['일', '월', '화', '수', '목', '금', '토'][ctx.theme.day]}요일)
[오늘의 뉴스] ${n.title} — ${n.source}${n.publishedAt ? ` (${n.publishedAt})` : ''}
[뉴스 팩트]
${(ctx.facts || []).map(f => `- ${f}`).join('\n') || `- ${n.description || n.title}`}
[오늘의 요일 테마] ${ctx.theme.emoji} ${ctx.theme.title} — 공감 훅: "${ctx.theme.hook}" / 솔루션: "${ctx.theme.solution}"
[3단 귀속 공식] Step1 뉴스 팩트체크(50%) → Step2 채무자의 현실적 딜레마 공감(25%) → Step3 오늘 테마 기능 안내 + 행동 유도(25%)
[3단 요약] Step1: ${ctx.bridge.step1Fact}
Step2: ${ctx.bridge.step2Dilemma}
Step3: ${ctx.bridge.step3Bridge}

${PLATFORM_FACTS}

${RULES}`;
}

function editorPrompt(candidates, theme, date) {
  const list = candidates.map((c, i) => `${i}. [${c.source}] ${c.title}\n   ${c.description || '(요약 없음)'}`).join('\n');
  return `당신은 마이김변(개인회생·파산 리걸테크 플랫폼)의 뉴스 분석관 겸 광고 규정 수석 검수관입니다.
오늘(${date}) 요일 테마는 "${theme.title}"(${theme.solution}) 입니다.

아래 후보 기사 중 1건을 고르세요. 기준: 대중성 40점(일반 채무자가 체감), 법적 신뢰성 30점(법원·금융당국·공식 발표), 테마 연결성 30점.
법무법인·사무소 홍보성 기사, 개인 사건 가십, 사실관계가 불분명한 기사는 고르지 마세요.

[후보]
${list}

선택한 기사의 제목과 요약에 적힌 내용만으로 팩트를 2~5개 뽑으세요. 적혀 있지 않은 수치·날짜·제도 내용을 추가하지 마세요.
그리고 3단 귀속 공식 문장을 쓰세요.
- step1Fact: 뉴스 팩트 요약 (2문장 이내)
- step2Dilemma: 채무자가 겪는 현실적 고민 (영업 전화, 서류 부담, 비교의 어려움 등 중 뉴스와 맞는 것) (2문장 이내)
- step3Bridge: 오늘 테마 기능으로 자연스럽게 연결 + 행동 유도 (2문장 이내)

${RULES}

JSON만 반환: {"selectedIndex": 0, "reason": "선정 이유", "facts": ["..."], "step1Fact": "...", "step2Dilemma": "...", "step3Bridge": "...", "angle": "오늘 콘텐츠의 한 줄 앵글"}`;
}

function blogPrompt(ctx) {
  return `당신은 네이버 블로그 개인회생·파산 정보 칼럼 작가입니다. 아래 맥락으로 SEO 칼럼을 쓰세요.
${contextBlock(ctx)}

[작성 규칙]
- 제목: 핵심 검색어를 앞쪽에, 32자 안팎, 과장 금지
- answerFirst: 본문 첫머리 요약 3문장 (검색자가 바로 답을 얻게)
- sections: 4~5개. heading 은 H2 수준 소제목. body 는 각 350~550자, 문단은 줄바꿈으로 구분. 필요한 곳에 "• " 목록 사용
  1~2번 섹션: 뉴스 팩트와 의미 (Step1) / 3번: 채무자 입장의 현실적 고민 (Step2) / 4번 이후: 오늘 테마 기능 안내와 이용 방법 (Step3)
- comparisonTable: 뉴스 주제나 절차를 정리하는 비교 표 (열 2~4개, 행 3~5개). 근거 없는 수치 금지
- faq: 3개 (실제 검색 질문 형태)
- 전체 본문 합계 2,000~2,800자
- images: 4개 (1: 대표 썸네일, 2: 뉴스 주제 인포그래픽 배경, 3: 스마트폰 앱 사용 장면, 4: 하단 안내 배너 배경). prompt 는 영어, 사진풍, 글자·로고·실존 인물 없음. headline 은 이미지 위에 올릴 한글 12~18자, sub 는 20~30자
- hashtags: 8~10개, # 포함

JSON만 반환:
{"title":"","summary":"","answerFirst":["","",""],"sections":[{"heading":"","body":""}],"comparisonTable":{"caption":"","columns":["",""],"rows":[["",""]]},"faq":[{"q":"","a":""}],"hashtags":["#개인회생"],"images":[{"prompt":"","headline":"","sub":""}]}`;
}

function shortFormPrompt(ctx) {
  return `당신은 유튜브 쇼츠·틱톡 숏폼 디렉터입니다. 법률 정보 숏폼은 무음 시청이 많으므로 화면 자막이 핵심입니다.
${contextBlock(ctx)}

[쇼츠 (30~38초, 장면 4~5개)]
- 첫 장면 0~3초: 인사말 없이 공감 질문 훅 (hookLine 과 같은 문장)
- 장면 흐름: 훅 → 뉴스 팩트(Step1) → 채무자 딜레마(Step2) → 오늘 테마 기능(Step3) → 행동 유도
- caption: 화면 중앙 자막, 장면당 18자 이내, 한 줄에 핵심 단어
- narration: 성우 대사, 장면 길이(seconds)에 맞게 1초당 약 4~5음절
- visualPrompt: 영어, 세로 9:16 사진풍 배경 설명, 글자·로고·실존 인물 없음
- motion: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" 중 하나
- loopLine: 마지막 문장. 첫 문장으로 자연스럽게 이어지는 반복 시청 유도
- description: 영상 설명란 (3~4문장 + 출처 기사명)
- pinnedComment: 고정 댓글 (프로필 링크에서 자가진단 안내, 결과 보장 금지)

[틱톡 (15~25초, 장면 3~4개)]
- 더 빠른 호흡, caption 14자 이내, 뉴스 팩트체크 중심
- caption(게시글 본문)은 2~3문장

JSON만 반환:
{"shorts":{"title":"","hookLine":"","scenes":[{"seconds":3,"caption":"","narration":"","visualPrompt":"","motion":"zoom-in"}],"loopLine":"","description":"","pinnedComment":"","hashtags":["#개인회생"]},
 "tiktok":{"hookLine":"","scenes":[{"seconds":3,"caption":"","narration":"","visualPrompt":"","motion":"zoom-in"}],"caption":"","hashtags":["#개인회생"]}}`;
}

function socialPrompt(ctx) {
  return `당신은 인스타그램·스레드·페이스북 소셜 스토리텔러입니다.
${contextBlock(ctx)}

[인스타그램 카드뉴스 6~7장 (1080x1080)]
- 1장: 표지 훅 (headline 16자 이내), 2장: 뉴스 팩트, 3장: 무엇이 달라지나/의미, 4장: 채무자 고민, 5~6장: 오늘 테마 기능(1장 1메시지), 마지막 장: 저장·프로필 링크 안내
- headline 16자 이내, body 60자 이내
- caption: 게시글 본문 4~6줄, hashtags 10~15개
- backgroundPrompt: 영어, 카드 배경용 추상적·차분한 사진풍 이미지 설명 (글자 없음)

[스레드 4단 타래]
- 친구에게 말하듯 담백한 반말 독백체. 1~2줄마다 줄바꿈. 각 글 350자 이내. 본문에 링크 금지
- 1: 뉴스로 시작하는 훅, 2: 팩트 정리, 3: 현실적 고민, 4: 오늘 테마 기능 + 질문으로 댓글 유도
- firstComment: 첫 댓글용 안내 (링크 자리는 {LINK} 로 표시)

[페이스북]
- 40~60대 자영업자·중장년 대상, 존댓말, 700~1,000자 장문. 문단 구분, 이모지는 2~3개까지
- 3단 공식 흐름을 따르고 마지막에 행동 유도

JSON만 반환:
{"cardnews":{"slides":[{"headline":"","body":""}],"caption":"","hashtags":["#개인회생"],"backgroundPrompt":""},
 "threads":{"posts":["","","",""],"firstComment":""},
 "facebook":{"body":"","hashtags":["#개인회생"]}}`;
}

// ─────────────────────────────────────────────────────────────
// 6. 후처리: 자동 치환 + 고지문 + 합성 텍스트
// ─────────────────────────────────────────────────────────────
function deepFix(value, applied) {
  if (typeof value === 'string') {
    const r = fixCompliance(value);
    r.applied.forEach(a => applied.add(a));
    return r.text;
  }
  if (Array.isArray(value)) return value.map(v => deepFix(v, applied));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = /prompt$/i.test(k) ? v : deepFix(v, applied);
    return out;
  }
  return value;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const normTags = (tags, max) => [...new Set((tags || []).map(t => `#${String(t).replace(/^#+/, '').replace(/\s+/g, '')}`).filter(t => t.length > 1))].slice(0, max);

function finalizeBlog(b, ctx) {
  const blog = { ...b };
  blog.answerFirst = b.answerFirst.slice(0, 3);
  blog.sections = b.sections.slice(0, 6);
  blog.faq = b.faq.slice(0, 5);
  blog.images = b.images.slice(0, 4);
  blog.hashtags = normTags(b.hashtags, 10);
  const table = b.comparisonTable && b.comparisonTable.columns?.length ? b.comparisonTable : null;
  const src = `출처: ${ctx.news.source} 「${ctx.news.title}」${ctx.news.url ? ` ${ctx.news.url}` : ''}`;

  const lines = [];
  lines.push('[📷 이미지 1: 대표 썸네일]', '');
  lines.push('■ 핵심 요약');
  blog.answerFirst.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  blog.sections.forEach((s, i) => {
    lines.push('', `■ ${s.heading}`, s.body);
    if (i === 0) lines.push('', '[📷 이미지 2: 뉴스 인포그래픽]');
    if (i === 1 && table) {
      lines.push('', table.caption ? `[표] ${table.caption}` : '[표]', table.columns.join(' | '));
      table.rows.forEach(r => lines.push(r.join(' | ')));
    }
    if (i === blog.sections.length - 2) lines.push('', '[📷 이미지 3: 앱 사용 장면]');
  });
  lines.push('', '■ 자주 묻는 질문');
  blog.faq.forEach(f => lines.push(`Q. ${f.q}`, `A. ${f.a}`, ''));
  lines.push('[📷 이미지 4: 하단 안내 배너]', '', src, '', blog.hashtags.join(' '));
  blog.fullBody = ensureDisclaimer(lines.join('\n'));

  const para = (t) => String(t).split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  let html = `<h2>${esc(blog.title)}</h2><blockquote>${blog.answerFirst.map(a => `<p>✔ ${esc(a)}</p>`).join('')}</blockquote>`;
  blog.sections.forEach((s, i) => {
    html += `<h3>${esc(s.heading)}</h3>${para(s.body)}`;
    if (i === 1 && table) {
      html += `<table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr>${table.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
  });
  html += `<h3>자주 묻는 질문</h3>${blog.faq.map(f => `<p><strong>Q. ${esc(f.q)}</strong></p><p>A. ${esc(f.a)}</p>`).join('')}`;
  html += `<p><small>${esc(src)}</small></p><p>${esc(blog.hashtags.join(' '))}</p><p><small>※ ${esc(MARKETING_DISCLAIMER)}</small></p>`;
  blog.html = html;
  return blog;
}

function finalizeShortForm(sf, ctx) {
  const shorts = { ...sf.shorts, scenes: sf.shorts.scenes.slice(0, 6), hashtags: normTags(sf.shorts.hashtags, 8) };
  shorts.description = ensureDisclaimer(`${shorts.description}\n\n출처: ${ctx.news.source} 「${ctx.news.title}」\n${shorts.hashtags.join(' ')}`, true);
  shorts.totalSeconds = Math.round(shorts.scenes.reduce((s, c) => s + c.seconds, 0));
  const tiktok = { ...sf.tiktok, scenes: sf.tiktok.scenes.slice(0, 5), hashtags: normTags(sf.tiktok.hashtags, 6) };
  tiktok.caption = ensureDisclaimer(`${tiktok.caption}\n${tiktok.hashtags.join(' ')}`, true);
  tiktok.totalSeconds = Math.round(tiktok.scenes.reduce((s, c) => s + c.seconds, 0));
  return { shorts, tiktok };
}

function finalizeSocial(so) {
  const cardnews = { ...so.cardnews, slides: so.cardnews.slides.slice(0, 7), hashtags: normTags(so.cardnews.hashtags, 15) };
  cardnews.caption = ensureDisclaimer(`${cardnews.caption}\n\n${cardnews.hashtags.join(' ')}`, true);
  const posts = so.threads.posts.slice(0, 4);
  posts[posts.length - 1] = ensureDisclaimer(posts[posts.length - 1], true);
  const threads = { posts, firstComment: so.threads.firstComment };
  const facebook = { ...so.facebook, hashtags: normTags(so.facebook.hashtags, 8) };
  facebook.body = ensureDisclaimer(`${facebook.body}\n\n${facebook.hashtags.join(' ')}`);
  return { cardnews, threads, facebook };
}

/** 채널별 검사 대상 텍스트 */
export function channelTexts(channels) {
  const t = {};
  if (channels.blog) t.blog = `${channels.blog.title}\n${channels.blog.fullBody}`;
  if (channels.shorts) t.shorts = [channels.shorts.title, ...channels.shorts.scenes.flatMap(s => [s.caption, s.narration]), channels.shorts.loopLine, channels.shorts.pinnedComment, channels.shorts.description].join('\n');
  if (channels.tiktok) t.tiktok = [...channels.tiktok.scenes.flatMap(s => [s.caption, s.narration]), channels.tiktok.caption].join('\n');
  if (channels.cardnews) t.cardnews = [...channels.cardnews.slides.flatMap(s => [s.headline, s.body]), channels.cardnews.caption].join('\n');
  if (channels.threads) t.threads = [...channels.threads.posts, channels.threads.firstComment].join('\n');
  if (channels.facebook) t.facebook = channels.facebook.body;
  return t;
}

const sourceTextOf = (ctx) => [ctx.news?.title, ctx.news?.description, ...(ctx.facts || [])].join(' ');

export function scanChannels(channels, ctx) {
  return scanCampaignTexts(channelTexts(channels), sourceTextOf(ctx));
}

const GROUPS = {
  blog: { role: 'blog', schema: BlogSchema, prompt: blogPrompt, finalize: (d, ctx) => ({ blog: finalizeBlog(d, ctx) }), channels: ['blog'] },
  shortform: { role: 'shorts', schema: ShortFormSchema, prompt: shortFormPrompt, finalize: finalizeShortForm, channels: ['shorts', 'tiktok'] },
  social: { role: 'social', schema: SocialSchema, prompt: socialPrompt, finalize: finalizeSocial, channels: ['cardnews', 'threads', 'facebook'] },
};
export const GROUP_NAMES = Object.keys(GROUPS);

/**
 * 채널 그룹 생성: 생성 → 자동 치환 → 검사 → (고위험 표현이 남으면) 수석 검수관이 1회 수정
 */
export async function generateGroup(groupName, ctx, deadline) {
  const g = GROUPS[groupName];
  if (!g) throw new AiError('알 수 없는 채널 그룹입니다.', 400);
  const applied = new Set();
  const { data, model } = await generateJson({ role: g.role, schema: g.schema, prompt: g.prompt(ctx), deadline, temperature: 0.7 });
  let fixed = deepFix(data, applied);
  let channels = g.finalize(fixed, ctx);
  let scan = scanChannels(channels, ctx);
  let revised = false;

  if (scan.highCount > 0 && deadline - Date.now() > 15000) {
    const issues = Object.entries(scan.byChannel)
      .flatMap(([ch, r]) => r.issues.filter(i => i.severity !== 'low' && i.ruleId !== 'disclaimer').map(i => `- [${ch}] "${i.match}" → ${i.label}: ${i.hint}`))
      .join('\n');
    try {
      const { data: rev } = await generateJson({
        role: 'editor', schema: g.schema, deadline, temperature: 0.3,
        prompt: `당신은 광고 규정 수석 검수관입니다. 아래 JSON 콘텐츠에서 지적된 문장만 규정에 맞게 고치고, 나머지 내용과 구조는 그대로 유지해 같은 JSON 구조로 반환하세요.\n\n[지적 사항]\n${issues}\n\n${RULES}\n\n[콘텐츠 JSON]\n${JSON.stringify(data)}`,
      });
      fixed = deepFix(rev, applied);
      channels = g.finalize(fixed, ctx);
      scan = scanChannels(channels, ctx);
      revised = true;
    } catch (e) {
      console.warn('[marketing] revise failed', e?.message);
    }
  }
  return { channels, compliance: scan, model, revised, autoFixed: [...applied] };
}

/**
 * 뉴스 수집 + 수석 검수관 선정 → 오늘의 맥락(ctx)
 */
export async function buildDailyContext({ themeCode, date, dayOfWeek, deadline, candidates: given, selectedIndex } = {}) {
  const today = kstToday();
  const d = date || today.date;
  const theme = (themeCode && themeByCode(themeCode)) || themeForDay(dayOfWeek ?? today.dayOfWeek);
  const candidates = Array.isArray(given) && given.length ? given.slice(0, 10) : await collectNews(theme);
  if (!candidates.length) throw new AiError('오늘 수집된 뉴스가 없습니다. 잠시 후 다시 시도하거나 주제를 직접 입력하세요.', 404);

  const pool = Number.isInteger(selectedIndex) && candidates[selectedIndex] ? [candidates[selectedIndex]] : candidates.slice(0, 8);
  let editor;
  let editorModel = null;
  try {
    const r = await generateJson({ role: 'editor', schema: EditorSchema, prompt: editorPrompt(pool, theme, d), deadline, temperature: 0.2 });
    editor = r.data;
    editorModel = r.model;
  } catch (e) {
    // AI 선정 실패 시 점수 1위 기사 + 기본 3단 문장
    console.warn('[marketing] editor failed', e?.message);
    editor = {
      selectedIndex: 0, reason: '점수 1위 기사 (AI 선정 실패)',
      facts: [pool[0].description || pool[0].title],
      step1Fact: `보도에 따르면 ${pool[0].title}`,
      step2Dilemma: '하지만 막상 알아보려 하면 영업 전화와 복잡한 서류가 먼저 걱정됩니다.',
      step3Bridge: theme.solution,
      angle: pool[0].title,
    };
  }
  const idx = Math.min(Math.max(0, editor.selectedIndex), pool.length - 1);
  const news = pool[idx];
  const ctx = {
    date: d, theme, news,
    facts: editor.facts.slice(0, 5),
    bridge: { step1Fact: editor.step1Fact, step2Dilemma: editor.step2Dilemma, step3Bridge: editor.step3Bridge },
    angle: editor.angle,
    reason: editor.reason,
  };
  // 3단 문장도 치환 규칙 적용
  const applied = new Set();
  ctx.bridge = deepFix(ctx.bridge, applied);
  return { ctx, candidates, editorModel };
}

/** 뉴스 대신 관리자가 직접 주제를 줄 때 */
export function manualContext({ topic, facts, themeCode, date }) {
  const today = kstToday();
  const theme = (themeCode && themeByCode(themeCode)) || themeForDay(today.dayOfWeek);
  const t = String(topic || '').slice(0, 200);
  const factList = (Array.isArray(facts) ? facts : []).map(f => String(f).slice(0, 300)).filter(Boolean).slice(0, 5);
  return {
    date: date || today.date, theme,
    news: { title: t, source: '관리자 입력', url: '', description: factList.join(' '), publishedAt: '' },
    facts: factList.length ? factList : [t],
    bridge: {
      step1Fact: factList[0] || t,
      step2Dilemma: '막상 알아보려 하면 영업 전화와 복잡한 서류, 비교의 어려움이 먼저 걱정됩니다.',
      step3Bridge: theme.solution,
    },
    angle: t, reason: '관리자 지정 주제',
  };
}

/** 클라이언트가 보낸 ctx 를 서버 기준으로 정리 (신뢰하지 않음) */
export function sanitizeContext(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
  const theme = themeByCode(c.theme?.code) || themeForDay(kstToday().dayOfWeek);
  const n = c.news || {};
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : kstToday().date,
    theme,
    news: { title: clip(n.title, 200), source: clip(n.source, 60), url: /^https?:\/\//.test(n.url || '') ? clip(n.url, 600) : '', description: clip(n.description, 500), publishedAt: clip(n.publishedAt, 60) },
    facts: (Array.isArray(c.facts) ? c.facts : []).map(f => clip(f, 300)).filter(Boolean).slice(0, 5),
    bridge: { step1Fact: clip(c.bridge?.step1Fact, 400), step2Dilemma: clip(c.bridge?.step2Dilemma, 400), step3Bridge: clip(c.bridge?.step3Bridge, 400) },
    angle: clip(c.angle, 200), reason: clip(c.reason, 300),
  };
}

// ─────────────────────────────────────────────────────────────
// 7. 이미지·음성 (Gemini 이미지 모델 / TTS)
// ─────────────────────────────────────────────────────────────
const ASPECTS = ['1:1', '9:16', '16:9', '4:3', '3:4'];
export async function generateImage(prompt, aspectRatio = '1:1', deadline = Date.now() + 50000) {
  const ar = ASPECTS.includes(aspectRatio) ? aspectRatio : '1:1';
  const clean = String(prompt || '').replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').slice(0, 900);
  const { parts, model } = await geminiCall({
    role: 'visual', models: imageModels(), deadline, perCallMs: 50000,
    body: {
      contents: [{ role: 'user', parts: [{ text: `${clean}. Photorealistic, cinematic soft lighting, calm and trustworthy mood, clean composition with empty space for overlay text. Absolutely no text, letters, numbers, logos, watermarks, or identifiable real people.` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ar } },
    },
  });
  const img = parts.find(p => p.inlineData?.data || p.inline_data?.data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline) throw new AiError('이미지가 생성되지 않았습니다.', 502);
  return { dataUrl: `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`, model };
}

const VOICES = ['Kore', 'Charon', 'Aoede', 'Puck', 'Leda', 'Orus'];
export async function generateSpeech(text, voice = 'Kore', deadline = Date.now() + 50000) {
  const t = String(text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 1200);
  if (!t) throw new AiError('읽을 문장이 없습니다.', 400);
  const { parts, model } = await geminiCall({
    role: 'visual', models: ttsModels(), deadline, perCallMs: 50000,
    body: {
      contents: [{ role: 'user', parts: [{ text: `차분하고 신뢰감 있는 한국어 뉴스 해설 톤으로, 또렷하고 약간 빠르게 읽어 주세요:\n${t}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.includes(voice) ? voice : 'Kore' } } },
      },
    },
  });
  const a = parts.find(p => p.inlineData?.data || p.inline_data?.data);
  const inline = a?.inlineData || a?.inline_data;
  if (!inline) throw new AiError('음성이 생성되지 않았습니다.', 502);
  return { mimeType: inline.mimeType || inline.mime_type || 'audio/L16;rate=24000', data: inline.data, model };
}

// ─────────────────────────────────────────────────────────────
// 8. 저장 (Supabase: 027_marketing_autopilot.sql)
// ─────────────────────────────────────────────────────────────
const CAMPAIGNS = 'marketing_daily_campaigns';
const POSTS = 'marketing_channel_posts';
const STATUSES = ['ready', 'approved', 'rejected', 'published'];

export async function saveCampaign({ ctx, channels, candidates, models, source = 'manual', userId = null, overwrite = true }) {
  const compliance = scanChannels(channels, ctx);
  const row = {
    campaign_date: ctx.date,
    day_theme_code: ctx.theme.code,
    news_title: ctx.news.title,
    news: ctx.news,
    context: { facts: ctx.facts, bridge: ctx.bridge, angle: ctx.angle, reason: ctx.reason, candidates: (candidates || []).slice(0, 10).map(c => ({ title: c.title, source: c.source, url: c.url, description: c.description, publishedAt: c.publishedAt, score: c.score })) },
    step1_news_fact: ctx.bridge.step1Fact,
    step2_debtor_dilemma: ctx.bridge.step2Dilemma,
    step3_mykim_bridge: ctx.bridge.step3Bridge,
    channels,
    compliance,
    compliance_score: compliance.score,
    models: models || {},
    source,
    status: 'ready',
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (!overwrite) {
    const { data: exist } = await supabase.from(CAMPAIGNS).select('id').eq('campaign_date', ctx.date).maybeSingle();
    if (exist) return { id: exist.id, skipped: true, compliance };
  }
  const { data, error } = await supabase.from(CAMPAIGNS).upsert(row, { onConflict: 'campaign_date' }).select('id').single();
  if (error) throw new AiError(`저장 실패: ${error.message}`, 500);
  return { id: data.id, skipped: false, compliance };
}

export async function listCampaigns(month) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : kstToday().date.slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const start = `${m}-01`;
  const end = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from(CAMPAIGNS)
    .select('id,campaign_date,day_theme_code,news_title,status,compliance_score,source,created_at,updated_at')
    .gte('campaign_date', start).lt('campaign_date', end)
    .order('campaign_date', { ascending: true });
  if (error) throw new AiError(`조회 실패: ${error.message}`, 500);
  const ids = (data || []).map(r => r.id);
  let posts = [];
  if (ids.length) {
    const r = await supabase.from(POSTS).select('campaign_id,channel,publish_status,external_post_url,published_at').in('campaign_id', ids);
    posts = r.data || [];
  }
  return (data || []).map(r => ({ ...r, posts: posts.filter(p => p.campaign_id === r.id) }));
}

export async function getCampaign({ id, date }) {
  let q = supabase.from(CAMPAIGNS).select('*');
  q = id ? q.eq('id', id) : q.eq('campaign_date', date || kstToday().date);
  const { data, error } = await q.maybeSingle();
  if (error) throw new AiError(`조회 실패: ${error.message}`, 500);
  if (!data) return null;
  const { data: posts } = await supabase.from(POSTS).select('*').eq('campaign_id', data.id).order('created_at', { ascending: true });
  return { ...data, posts: posts || [] };
}

export async function updateCampaign({ id, status, channels, userId }) {
  const { data: cur, error: e1 } = await supabase.from(CAMPAIGNS).select('*').eq('id', id).maybeSingle();
  if (e1 || !cur) throw new AiError('캠페인을 찾을 수 없습니다.', 404);
  const patch = { updated_at: new Date().toISOString() };
  if (channels && typeof channels === 'object') {
    const merged = { ...cur.channels };
    for (const k of ['blog', 'shorts', 'tiktok', 'cardnews', 'threads', 'facebook']) if (channels[k]) merged[k] = channels[k];
    const ctx = { news: cur.news, facts: cur.context?.facts || [] };
    patch.channels = merged;
    patch.compliance = scanChannels(merged, ctx);
    patch.compliance_score = patch.compliance.score;
    if (cur.status === 'approved') patch.status = 'ready'; // 수정되면 재승인 필요
  }
  if (status) {
    if (!STATUSES.includes(status)) throw new AiError('잘못된 상태입니다.', 400);
    const comp = patch.compliance || cur.compliance;
    if (status === 'approved' && comp?.highCount > 0) {
      throw new AiError(`고위험 표현 ${comp.highCount}건이 남아 있어 승인할 수 없습니다. 수정 후 다시 승인하세요.`, 409);
    }
    patch.status = status;
    if (status === 'approved') { patch.approved_by = userId; patch.approved_at = new Date().toISOString(); }
  }
  const { data, error } = await supabase.from(CAMPAIGNS).update(patch).eq('id', id).select('id,status,compliance_score,compliance').single();
  if (error) throw new AiError(`수정 실패: ${error.message}`, 500);
  return data;
}

// ─────────────────────────────────────────────────────────────
// 9. 게시 (Threads·Facebook 페이지는 API 자동 게시 / 나머지는 수동 게시 후 URL 기록)
//   네이버 블로그: 공식 글쓰기 API 없음 → 복사/다운로드 후 직접 게시
//   유튜브: YouTube Data API 는 OAuth + 검증 전 업로드는 비공개 제한 → 수동 게시 권장
//   틱톡: 감사(audit) 전 Content Posting API 는 비공개(SELF_ONLY)만 가능 → 수동 게시 권장
//   인스타그램: 이미지 공개 URL 필요 → 이번 단계는 수동 게시
// ─────────────────────────────────────────────────────────────
const GRAPH_VER = () => process.env.META_GRAPH_VERSION || 'v23.0';
export function publisherStatus() {
  return {
    threads: Boolean(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN),
    facebook: Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN),
    instagram: false, youtube: false, tiktok: false, blog: false,
  };
}

async function postForm(url, params) {
  const r = await fetch(url, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new AiError(j.error?.message || `게시 API 오류 (${r.status})`, 502);
  return j;
}

async function publishThreads(threads, link) {
  const uid = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  const base = `https://graph.threads.net/v1.0/${uid}`;
  let replyTo = null;
  let firstId = null;
  const posts = [...threads.posts];
  if (threads.firstComment) posts.push(threads.firstComment.replace('{LINK}', link || 'https://mykim.kr'));
  for (const text of posts) {
    const params = { media_type: 'TEXT', text: text.slice(0, 500), access_token: token };
    if (replyTo) params.reply_to_id = replyTo;
    const c = await postForm(`${base}/threads`, params);
    const p = await postForm(`${base}/threads_publish`, { creation_id: c.id, access_token: token });
    if (!firstId) firstId = p.id;
    replyTo = p.id;
  }
  let url = null;
  try {
    const r = await fetch(`https://graph.threads.net/v1.0/${firstId}?fields=permalink&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
    url = (await r.json()).permalink || null;
  } catch { /* ignore */ }
  return { externalId: firstId, url };
}

async function publishFacebook(fb, link) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const params = { message: fb.body, access_token: token };
  if (link) params.link = link;
  const j = await postForm(`https://graph.facebook.com/${GRAPH_VER()}/${pageId}/feed`, params);
  return { externalId: j.id, url: `https://www.facebook.com/${j.id}` };
}

export async function publishChannel({ campaignId, channel, manualUrl, userId }) {
  const cur = await getCampaign({ id: campaignId });
  if (!cur) throw new AiError('캠페인을 찾을 수 없습니다.', 404);
  if (!['approved', 'published'].includes(cur.status)) throw new AiError('승인된 캠페인만 게시할 수 있습니다.', 409);
  const chComp = cur.compliance?.byChannel?.[channel];
  if (chComp && chComp.issues?.some(i => i.severity === 'high')) throw new AiError('이 채널에 고위험 표현이 남아 있습니다.', 409);
  const payload = cur.channels?.[channel];
  if (!payload) throw new AiError('해당 채널 콘텐츠가 없습니다.', 404);

  const slot = GOLDEN_SCHEDULE.find(s => s.channel === channel);
  const base = { campaign_id: campaignId, channel, post_type: channel, payload, scheduled_at: `${cur.campaign_date}T${slot?.time || '12:00'}:00+09:00`, created_by: userId };
  let result;
  let status = 'published';
  let errorMessage = null;
  try {
    if (manualUrl !== undefined) {
      if (manualUrl && !/^https:\/\//.test(manualUrl)) throw new AiError('게시물 URL은 https:// 로 시작해야 합니다.', 400);
      result = { externalId: null, url: manualUrl || null };
      status = 'published_manual';
    } else if (channel === 'threads' && publisherStatus().threads) {
      result = await publishThreads(payload, process.env.MARKETING_LANDING_URL);
    } else if (channel === 'facebook' && publisherStatus().facebook) {
      result = await publishFacebook(payload, process.env.MARKETING_LANDING_URL);
    } else {
      throw new AiError('이 채널은 자동 게시가 설정되지 않았습니다. 직접 게시한 뒤 URL을 기록하세요.', 400);
    }
  } catch (e) {
    status = 'failed';
    errorMessage = e.message;
    await supabase.from(POSTS).insert({ ...base, publish_status: status, error_message: errorMessage });
    throw e;
  }
  const { data, error } = await supabase.from(POSTS).insert({
    ...base, publish_status: status, published_at: new Date().toISOString(),
    external_post_id: result.externalId, external_post_url: result.url,
  }).select('*').single();
  if (error) throw new AiError(`게시 기록 저장 실패: ${error.message}`, 500);
  if (cur.status !== 'published') await supabase.from(CAMPAIGNS).update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', campaignId);
  return data;
}

export async function marketingStats(days = 90) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data: camps } = await supabase.from(CAMPAIGNS).select('id,campaign_date,day_theme_code,status,compliance_score').gte('campaign_date', since);
  const ids = (camps || []).map(c => c.id);
  let posts = [];
  if (ids.length) posts = (await supabase.from(POSTS).select('campaign_id,channel,publish_status,published_at,external_post_url').in('campaign_id', ids)).data || [];
  return { since, campaigns: camps || [], posts };
}

// ─────────────────────────────────────────────────────────────
// 10. 크론: 매일 아침 한 번에 전 과정 수행 (사람 승인 전까지 게시하지 않음)
// ─────────────────────────────────────────────────────────────
export async function runDailyAutopilot({ deadline = Date.now() + 55000 } = {}) {
  const today = kstToday();
  const { data: exist } = await supabase.from(CAMPAIGNS).select('id,status').eq('campaign_date', today.date).maybeSingle();
  if (exist) return { skipped: true, reason: '오늘 캠페인이 이미 있습니다.', id: exist.id };

  const { ctx, candidates, editorModel } = await buildDailyContext({ deadline: Math.min(deadline, Date.now() + 20000) });
  const results = await Promise.allSettled(GROUP_NAMES.map(g => generateGroup(g, ctx, deadline)));
  const channels = {};
  const models = { editor: editorModel };
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { Object.assign(channels, r.value.channels); models[GROUP_NAMES[i]] = r.value.model; }
    else errors.push(`${GROUP_NAMES[i]}: ${r.reason?.message || r.reason}`);
  });
  if (!Object.keys(channels).length) throw new AiError(`생성 실패: ${errors.join(' / ')}`, 502);
  const saved = await saveCampaign({ ctx, channels, candidates, models: { ...models, errors }, source: 'cron', overwrite: false });
  return { ...saved, date: today.date, theme: ctx.theme.code, news: ctx.news.title, errors };
}

export { AiError, scanCompliance, MARKETING_DISCLAIMER_SHORT };
