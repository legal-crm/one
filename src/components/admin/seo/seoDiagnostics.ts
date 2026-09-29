// ============================================================
// [SEO/GEO] 관리자 SEO 관제센터 — 실측 진단 로직
// ------------------------------------------------------------
// 이전: 관제센터의 '제출 완료(200 OK)', 'GEO 상태 A+', 'AI 봇 수집 허용' 등은 모두 하드코딩 문구였다.
// 현재: 같은 사이트의 실제 파일(/, robots.txt, sitemap.xml, rss.xml, llms.txt, IndexNow 키, seo-manifest.json)을
//       읽어서 판정한다. 검색엔진 콘솔 내부 상태(제출 여부·색인 수)는 외부에서 알 수 없으므로 체크리스트로 남긴다.
// ============================================================

export const SITE_ORIGIN = 'https://mykim.kr';
/** public/<키>.txt 와 api/_lib/indexnow.js 기본값과 같아야 한다 (공개값) */
export const INDEXNOW_KEY = '5283c27badad10634284ba2943977400';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface SeoCheck {
  id: string;
  category: '인증' | '크롤링' | '사이트맵·피드' | 'GEO' | '온페이지' | '구조화 데이터';
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ManifestPage {
  file: string;
  url: string;
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  canonical: string;
  noindex: boolean;
  h1Count: number;
  ogImage: string;
  jsonLdTypes: string[];
  jsonLdValid: boolean;
  datePublished: string;
  dateModified: string;
  section: 'home' | 'page' | 'guide' | 'article';
  hash: string;
  issues: string[];
  lastmod: string;
}
export interface SeoManifest {
  generatedAt: string;
  origin: string;
  counts: { pages: number; indexable: number; guides: number; articles: number; rssItems: number; pagesWithIssues: number };
  pages: ManifestPage[];
}

// ── robots.txt (RFC 9309) ─────────────────────────────────────
export interface RobotsRule { type: 'allow' | 'disallow'; path: string }
export interface RobotsGroup { agents: string[]; rules: RobotsRule[] }
export interface ParsedRobots { groups: RobotsGroup[]; sitemaps: string[] }

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === 'allow' || field === 'disallow') {
      lastWasAgent = false;
      if (current) current.rules.push({ type: field, path: value });
    } else if (field === 'sitemap') {
      sitemaps.push(value);
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

/** 크롤러가 따르는 그룹: 이름이 일치하는 그룹(여러 개면 합침) → 없으면 '*' */
export function robotsRulesFor(parsed: ParsedRobots, userAgent: string): { rules: RobotsRule[]; matched: string } {
  const ua = userAgent.toLowerCase();
  const named = parsed.groups.filter(g => g.agents.includes(ua));
  if (named.length) return { rules: named.flatMap(g => g.rules), matched: userAgent };
  const star = parsed.groups.filter(g => g.agents.includes('*'));
  return { rules: star.flatMap(g => g.rules), matched: star.length ? '*' : '(규칙 없음)' };
}

function patternMatches(pattern: string, target: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = '^' + body.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : '');
  return new RegExp(re).test(target);
}

/** 가장 긴 규칙이 이기고, 길이가 같으면 Allow가 이긴다. 빈 Disallow는 무시 */
export function isPathAllowed(rules: RobotsRule[], pathWithQuery: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!r.path) continue;
    if (!patternMatches(r.path, pathWithQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === 'allow')) best = r;
  }
  return !best || best.type === 'allow';
}

export const CRAWLERS: { ua: string; label: string; kind: 'search' | 'ai' }[] = [
  { ua: 'Googlebot', label: 'Google 검색', kind: 'search' },
  { ua: 'Bingbot', label: 'Bing 검색 (ChatGPT·Copilot 검색 기반)', kind: 'search' },
  { ua: 'Yeti', label: '네이버 검색', kind: 'search' },
  { ua: 'Daumoa', label: '다음 검색', kind: 'search' },
  { ua: 'OAI-SearchBot', label: 'ChatGPT 검색 색인', kind: 'ai' },
  { ua: 'ChatGPT-User', label: 'ChatGPT 사용자 요청 열람', kind: 'ai' },
  { ua: 'GPTBot', label: 'OpenAI 모델 학습', kind: 'ai' },
  { ua: 'PerplexityBot', label: 'Perplexity 검색 색인', kind: 'ai' },
  { ua: 'ClaudeBot', label: 'Anthropic Claude', kind: 'ai' },
  { ua: 'Claude-SearchBot', label: 'Claude 검색', kind: 'ai' },
  { ua: 'Google-Extended', label: 'Gemini 학습·그라운딩', kind: 'ai' },
  { ua: 'Applebot-Extended', label: 'Apple Intelligence', kind: 'ai' },
];

/** 공개 허용이어야 하는 경로 / 반드시 차단되어야 하는 경로 */
export const PUBLIC_PROBES = ['/', '/guide/personal-rehabilitation.html', '/articles/secret-rehabilitation.html', '/faq'];
export const PRIVATE_PROBES = ['/?role=admin', '/?tab=home&role=lawyer', '/?share=abc', '/?reqId=abc', '/api/inquiry', '/check'];

export interface CrawlerPolicy {
  ua: string;
  label: string;
  kind: 'search' | 'ai';
  matched: string;
  publicAllowed: boolean;
  blockedPublic: string[];
  leakedPrivate: string[];
}

export function evaluateCrawlers(parsed: ParsedRobots): CrawlerPolicy[] {
  return CRAWLERS.map(c => {
    const { rules, matched } = robotsRulesFor(parsed, c.ua);
    const blockedPublic = PUBLIC_PROBES.filter(p => !isPathAllowed(rules, p));
    const leakedPrivate = PRIVATE_PROBES.filter(p => isPathAllowed(rules, p));
    return { ...c, matched, publicAllowed: blockedPublic.length === 0, blockedPublic, leakedPrivate };
  });
}

// ── 공통 유틸 ─────────────────────────────────────────────────
/** 비교용 URL 키: 확장자·끝 슬래시 제거 */
export const urlKey = (u: string) => String(u || '').replace(/\.html$/, '').replace(/\/$/, '') || SITE_ORIGIN;

/** https://mykim.kr/x → 현재 origin 기준 경로 (개발·프리뷰에서도 같은 파일을 읽도록) */
export const toLocalPath = (u: string) => {
  try {
    const url = new URL(u, SITE_ORIGIN);
    return url.pathname + url.search;
  } catch {
    return u;
  }
};

interface Fetched { ok: boolean; status: number; contentType: string; text: string; error?: string }

async function fetchText(path: string, timeoutMs = 10000): Promise<Fetched> {
  try {
    const r = await fetch(path, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    return { ok: r.ok, status: r.status, contentType: r.headers.get('content-type') || '', text };
  } catch (e) {
    return { ok: false, status: 0, contentType: '', text: '', error: e instanceof Error ? e.message : String(e) };
  }
}

/** 정적 파일이 없어서 SPA index.html로 대체 응답된 경우 (Vercel rewrite는 200을 돌려줌) */
export const isSpaShell = (text: string) => /<div id="root"/i.test(text) || /<!--\s*seo:site-verification/.test(text);

export interface HomeMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  googleVerification: string;
  naverVerification: string;
  bingVerification: string;
  jsonLdTypes: string[];
  jsonLdValid: boolean;
}

export function parseHtmlMeta(html: string): HomeMeta {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || '';
  const types = new Set<string>();
  let valid = true;
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const o = n as Record<string, unknown>;
    const t = o['@type'];
    if (typeof t === 'string') types.add(t);
    else if (Array.isArray(t)) t.forEach(x => typeof x === 'string' && types.add(x));
    Object.values(o).forEach(walk);
  };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { walk(JSON.parse(s.textContent || '')); } catch { valid = false; }
  });
  return {
    title: doc.querySelector('title')?.textContent?.trim() || '',
    description: meta('meta[name="description"]'),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    googleVerification: meta('meta[name="google-site-verification"]'),
    naverVerification: meta('meta[name="naver-site-verification"]'),
    bingVerification: meta('meta[name="msvalidate.01"]'),
    jsonLdTypes: [...types].sort(),
    jsonLdValid: valid,
  };
}

const isRealToken = (v: string) => !!v && /^[A-Za-z0-9_-]{8,128}$/.test(v) && !/pending|verification_code|placeholder/i.test(v);

export function parseSitemap(xml: string): { url: string; lastmod: string }[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  return [...doc.getElementsByTagName('url')].map(u => ({
    url: u.getElementsByTagName('loc')[0]?.textContent?.trim() || '',
    lastmod: u.getElementsByTagName('lastmod')[0]?.textContent?.trim() || '',
  })).filter(x => x.url);
}

export function countRssItems(xml: string): number {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return -1;
  return doc.getElementsByTagName('item').length;
}

export function extractSiteLinks(text: string): string[] {
  const re = new RegExp(`${SITE_ORIGIN.replace(/[.]/g, '\\.')}[^\\s)\\]>"'<]*`, 'g');
  return [...new Set(text.match(re) || [])];
}

export interface SiteDiagnostics {
  checkedAt: string;
  checks: SeoCheck[];
  score: number;
  home: HomeMeta | null;
  robotsText: string;
  robots: ParsedRobots | null;
  crawlers: CrawlerPolicy[];
  sitemap: { url: string; lastmod: string }[];
  rssItems: number;
  llmsText: string;
  llmsBrokenLinks: string[];
  manifest: SeoManifest | null;
  indexNowKeyOk: boolean;
}

/** 사이트 파일을 읽어 전체 진단 */
export async function runSiteDiagnostics(): Promise<SiteDiagnostics> {
  const [homeR, robotsR, sitemapR, rssR, llmsR, keyR, manifestR] = await Promise.all([
    fetchText('/'),
    fetchText('/robots.txt'),
    fetchText('/sitemap.xml'),
    fetchText('/rss.xml'),
    fetchText('/llms.txt'),
    fetchText(`/${INDEXNOW_KEY}.txt`),
    fetchText('/seo-manifest.json'),
  ]);
  const checks: SeoCheck[] = [];
  const add = (c: SeoCheck) => checks.push(c);

  // ── 홈 메타 / 인증 ──
  const home = homeR.ok ? parseHtmlMeta(homeR.text) : null;
  if (!home) {
    add({ id: 'home', category: '온페이지', label: '홈페이지 응답', status: 'fail', detail: `홈(/)을 읽지 못했습니다. (${homeR.status || homeR.error})` });
  } else {
    add({
      id: 'verify-naver', category: '인증', label: '네이버 소유확인 메타태그',
      status: isRealToken(home.naverVerification) ? 'pass' : 'fail',
      detail: home.naverVerification ? `content="${home.naverVerification.slice(0, 10)}…" 배포됨` : '태그 없음',
    });
    add({
      id: 'verify-google', category: '인증', label: '구글 서치 콘솔 소유확인',
      status: isRealToken(home.googleVerification) ? 'pass' : 'warn',
      detail: isRealToken(home.googleVerification)
        ? `메타태그 배포됨 (${home.googleVerification.slice(0, 10)}…)`
        : '메타태그 없음 — DNS(TXT) 방식으로 인증했다면 정상입니다. HTML 태그 방식이면 Vercel 환경변수 GOOGLE_SITE_VERIFICATION 설정 후 재배포하세요.',
    });
    add({
      id: 'verify-bing', category: '인증', label: '빙 웹마스터 소유확인',
      status: isRealToken(home.bingVerification) ? 'pass' : 'warn',
      detail: isRealToken(home.bingVerification)
        ? `msvalidate.01 배포됨 (${home.bingVerification.slice(0, 10)}…)`
        : '메타태그 없음 — 구글 서치 콘솔 가져오기(GSC Import)로 인증했다면 정상입니다. 아니면 BING_SITE_VERIFICATION 설정 후 재배포하세요.',
    });
    const tl = home.title.length;
    add({ id: 'home-title', category: '온페이지', label: '홈 title', status: tl >= 15 && tl <= 60 ? 'pass' : 'warn', detail: `${tl}자 — ${home.title || '(없음)'}` });
    const dl = home.description.length;
    add({ id: 'home-desc', category: '온페이지', label: '홈 meta description', status: dl >= 50 && dl <= 160 ? 'pass' : 'warn', detail: `${dl}자 (권장 50~160자)` });
    add({ id: 'home-canonical', category: '온페이지', label: '홈 canonical', status: home.canonical.startsWith(SITE_ORIGIN) ? 'pass' : 'fail', detail: home.canonical || '없음' });
    add({ id: 'home-og', category: '온페이지', label: 'OpenGraph (카카오톡·SNS 공유)', status: home.ogTitle && home.ogImage ? 'pass' : 'fail', detail: home.ogImage ? `og:image ${home.ogImage}` : 'og:title/og:image 없음' });
    const need = ['Organization', 'WebSite', 'LegalService'];
    const missing = need.filter(t => !home.jsonLdTypes.includes(t));
    add({
      id: 'home-jsonld', category: '구조화 데이터', label: '홈 JSON-LD (Organization·WebSite·LegalService)',
      status: !home.jsonLdValid ? 'fail' : missing.length ? 'warn' : 'pass',
      detail: !home.jsonLdValid ? 'JSON-LD 파싱 오류' : missing.length ? `누락: ${missing.join(', ')}` : home.jsonLdTypes.join(', '),
    });
  }

  // ── robots.txt ──
  let robots: ParsedRobots | null = null;
  let crawlers: CrawlerPolicy[] = [];
  if (!robotsR.ok || isSpaShell(robotsR.text)) {
    add({ id: 'robots', category: '크롤링', label: 'robots.txt', status: 'fail', detail: `robots.txt를 읽지 못했습니다. (${robotsR.status})` });
  } else {
    robots = parseRobots(robotsR.text);
    crawlers = evaluateCrawlers(robots);
    const blocked = crawlers.filter(c => !c.publicAllowed);
    const leaked = crawlers.filter(c => c.leakedPrivate.length);
    add({
      id: 'robots-public', category: '크롤링', label: '공개 페이지 수집 허용 (검색·AI 크롤러)',
      status: blocked.length ? 'warn' : 'pass',
      detail: blocked.length ? `차단된 크롤러: ${blocked.map(b => b.ua).join(', ')}` : `${crawlers.length}개 크롤러 모두 가이드·칼럼 수집 허용`,
    });
    add({
      id: 'robots-private', category: '크롤링', label: '개인정보·관리자 경로 차단',
      status: leaked.length ? 'fail' : 'pass',
      detail: leaked.length ? leaked.map(l => `${l.ua}: ${l.leakedPrivate.join(' ')}`).join(' / ') : `?role·?share·?reqId·/api/·/check 모두 차단`,
    });
    add({
      id: 'robots-sitemap', category: '크롤링', label: 'robots.txt Sitemap 선언',
      status: robots.sitemaps.some(s => s.startsWith(`${SITE_ORIGIN}/sitemap.xml`)) ? 'pass' : 'warn',
      detail: robots.sitemaps.join(', ') || '선언 없음',
    });
  }

  // ── sitemap / rss / manifest ──
  const sitemap = sitemapR.ok && !isSpaShell(sitemapR.text) ? parseSitemap(sitemapR.text) : [];
  let manifest: SeoManifest | null = null;
  if (manifestR.ok && !isSpaShell(manifestR.text)) {
    try { manifest = JSON.parse(manifestR.text) as SeoManifest; } catch { manifest = null; }
  }
  if (!sitemap.length) {
    add({ id: 'sitemap', category: '사이트맵·피드', label: 'sitemap.xml', status: 'fail', detail: `sitemap.xml이 없거나 형식 오류 (HTTP ${sitemapR.status})` });
  } else {
    const newest = sitemap.map(s => s.lastmod).sort().pop() || '';
    add({ id: 'sitemap', category: '사이트맵·피드', label: 'sitemap.xml', status: 'pass', detail: `URL ${sitemap.length}개 · 최근 lastmod ${newest}` });
    if (manifest) {
      const canon = new Set(manifest.pages.filter(p => !p.noindex).map(p => p.url));
      const nonCanon = sitemap.filter(s => !canon.has(s.url));
      add({
        id: 'sitemap-canonical', category: '사이트맵·피드', label: 'sitemap URL = 각 페이지 canonical',
        status: nonCanon.length ? 'warn' : 'pass',
        detail: nonCanon.length ? `canonical과 다른 URL ${nonCanon.length}개: ${nonCanon.slice(0, 3).map(s => s.url).join(', ')}` : '모두 일치',
      });
    }
  }
  const rssItems = rssR.ok && !isSpaShell(rssR.text) ? countRssItems(rssR.text) : -1;
  add({
    id: 'rss', category: '사이트맵·피드', label: 'rss.xml (네이버 RSS 제출용)',
    status: rssItems > 0 ? 'pass' : 'fail',
    detail: rssItems > 0 ? `피드 항목 ${rssItems}개` : 'rss.xml이 없거나 형식 오류 — 빌드 시 scripts/seo-build.mjs가 생성합니다.',
  });
  add({
    id: 'manifest', category: '사이트맵·피드', label: '빌드 SEO 매니페스트',
    status: manifest ? 'pass' : 'warn',
    detail: manifest ? `${new Date(manifest.generatedAt).toLocaleString('ko-KR')} 생성 · 페이지 ${manifest.counts.pages}개` : 'seo-manifest.json 없음 — npm run build(prebuild)로 생성됩니다.',
  });
  if (manifest) {
    const withIssues = manifest.pages.filter(p => p.issues.length);
    add({
      id: 'pages-issues', category: '온페이지', label: '정적 페이지 메타 점검',
      status: withIssues.length === 0 ? 'pass' : 'warn',
      detail: withIssues.length ? `${manifest.pages.length}개 중 ${withIssues.length}개 페이지 개선 필요 (온페이지 탭에서 확인)` : `${manifest.pages.length}개 페이지 모두 기준 충족`,
    });
    const noSchema = manifest.pages.filter(p => (p.section === 'guide' || p.section === 'article') && !p.jsonLdTypes.some(t => ['Article', 'FAQPage', 'HowTo'].includes(t)));
    add({
      id: 'pages-schema', category: '구조화 데이터', label: '가이드·칼럼 Article/FAQPage 스키마',
      status: noSchema.length ? 'warn' : 'pass',
      detail: noSchema.length ? `스키마 없는 페이지: ${noSchema.map(p => p.file).join(', ')}` : '모든 가이드·칼럼 적용',
    });
  }

  // ── GEO: llms.txt ──
  const llmsText = llmsR.ok && !isSpaShell(llmsR.text) ? llmsR.text : '';
  let llmsBrokenLinks: string[] = [];
  if (!llmsText) {
    add({ id: 'llms', category: 'GEO', label: 'llms.txt', status: 'fail', detail: `llms.txt를 읽지 못했습니다. (HTTP ${llmsR.status})` });
  } else {
    add({ id: 'llms', category: 'GEO', label: 'llms.txt', status: 'pass', detail: `${llmsText.length.toLocaleString()}자 · 제목 "${(llmsText.split(/\r?\n/)[0] || '').replace(/^#\s*/, '')}"` });
    if (manifest) {
      const known = new Set(manifest.pages.map(p => urlKey(p.url)));
      llmsBrokenLinks = extractSiteLinks(llmsText).filter(u => {
        const clean = u.replace(/[.,;]+$/, '');
        if (/\?tab=/.test(clean)) return false; // SPA 탭 링크
        return !known.has(urlKey(clean.split('?')[0]));
      });
      add({
        id: 'llms-links', category: 'GEO', label: 'llms.txt 링크 유효성',
        status: llmsBrokenLinks.length ? 'warn' : 'pass',
        detail: llmsBrokenLinks.length ? `사이트에 없는 링크: ${llmsBrokenLinks.join(', ')}` : '모든 링크가 실제 페이지를 가리킴',
      });
      const inLlms = new Set(extractSiteLinks(llmsText).map(u => urlKey(u.replace(/[.,;]+$/, ''))));
      const notListed = manifest.pages.filter(p => (p.section === 'guide' || p.section === 'article') && !inLlms.has(urlKey(p.url)));
      add({
        id: 'llms-coverage', category: 'GEO', label: 'llms.txt 가이드·칼럼 포함 범위',
        status: notListed.length ? 'warn' : 'pass',
        detail: notListed.length ? `llms.txt에 없는 페이지 ${notListed.length}개: ${notListed.map(p => p.file).join(', ')}` : '모든 가이드·칼럼 포함',
      });
    }
  }

  // ── IndexNow 키 ──
  const indexNowKeyOk = keyR.ok && keyR.text.trim() === INDEXNOW_KEY;
  add({
    id: 'indexnow-key', category: '크롤링', label: 'IndexNow 키 파일',
    status: indexNowKeyOk ? 'pass' : 'fail',
    detail: indexNowKeyOk ? `/${INDEXNOW_KEY.slice(0, 8)}….txt 확인` : `/${INDEXNOW_KEY}.txt 응답이 키와 다릅니다 (HTTP ${keyR.status})`,
  });

  const total = checks.length || 1;
  const points = checks.reduce((s, c) => s + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  return {
    checkedAt: new Date().toISOString(),
    checks,
    score: Math.round((points / total) * 100),
    home,
    robotsText: robotsR.ok ? robotsR.text : '',
    robots,
    crawlers,
    sitemap,
    rssItems,
    llmsText,
    llmsBrokenLinks,
    manifest,
    indexNowKeyOk,
  };
}

export interface CrawlResult { url: string; status: number; ok: boolean; issue: string }

/** sitemap의 각 URL을 실제로 열어 응답·canonical 확인 (동시 4개) */
export async function crawlUrls(urls: string[], onProgress?: (done: number) => void): Promise<CrawlResult[]> {
  const out: CrawlResult[] = new Array(urls.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      const url = urls[i];
      const r = await fetchText(toLocalPath(url), 15000);
      let issue = '';
      if (!r.ok) issue = `HTTP ${r.status || r.error}`;
      else {
        const isHome = urlKey(url) === SITE_ORIGIN;
        if (!isHome && isSpaShell(r.text)) issue = '정적 페이지 없음 (SPA 화면으로 대체됨)';
        else {
          const canon = new DOMParser().parseFromString(r.text, 'text/html').querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
          if (!canon) issue = 'canonical 없음';
          else if (canon !== url) issue = `canonical 불일치: ${canon}`;
        }
      }
      out[i] = { url, status: r.status, ok: !issue, issue };
      onProgress?.(++done);
    }
  };
  await Promise.all([0, 1, 2, 3].map(worker));
  return out;
}

/** 검색 결과 제목 표시 폭 근사 (한글 2, 그 외 1 단위 → 구글 데스크톱 약 60단위 = 약 580px) */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u3131-\uD79D]/.test(ch) ? 2 : 1;
  return w;
}
