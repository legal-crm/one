#!/usr/bin/env node
// ============================================================
// [SEO/GEO] 빌드 전 자동 생성 스크립트 (npm run build 전에 prebuild로 실행)
// ------------------------------------------------------------
// public/ 의 정적 HTML(루트·guide·articles)과 루트 index.html을 읽어 다음을 만든다.
//   1) public/sitemap.xml      — 각 페이지의 canonical URL 기준 (이전: 확장자 없는 URL이라 canonical과 불일치)
//   2) public/rss.xml          — 가이드·칼럼 RSS 2.0 피드 (네이버 서치어드바이저 RSS 제출용, 이전: 파일 없음)
//   3) public/seo-manifest.json — 페이지별 title/description 길이·canonical·JSON-LD·이슈 (관리자 SEO 진단 탭이 읽음)
//
// lastmod: 이전 manifest와 파일 해시가 같으면 이전 날짜 유지, 바뀌었으면 오늘 날짜.
//          이전 manifest가 없으면 dateModified → 기존 sitemap lastmod → datePublished → 오늘 순.
// 실패해도 빌드를 막지 않는다 (경고만 출력, 기존 파일 유지).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PLATFORM_FACTS_LINES } from '../api/_lib/compliance-terms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ORIGIN = 'https://mykim.kr';
/** 검색 노출 대상에서 제외 (robots.txt Disallow와 일치) */
const EXCLUDE = new Set(['check.html']);

const today = new Date().toISOString().slice(0, 10);
const decode = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const xmlEscape = s => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 비교용 URL 키: 확장자·끝 슬래시 제거 */
const urlKey = u => String(u || '').replace(/\.html$/, '').replace(/\/$/, '') || ORIGIN;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function metaContent(html, attr, name) {
  const re1 = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i');
  return decode((html.match(re1) || html.match(re2) || [])[1] || '');
}

function extractJsonLdTypes(html) {
  const types = new Set();
  let valid = true;
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const t = node['@type'];
    if (typeof t === 'string') types.add(t);
    else if (Array.isArray(t)) t.forEach(x => typeof x === 'string' && types.add(x));
    Object.values(node).forEach(walk);
  };
  for (const b of blocks) {
    try { walk(JSON.parse(b[1])); } catch { valid = false; }
  }
  return { types: [...types].sort(), blocks: blocks.length, valid };
}

function extractDate(html, key) {
  const m = html.match(new RegExp(`"${key}"\\s*:\\s*"(\\d{4}-\\d{2}-\\d{2})`));
  return m ? m[1] : '';
}

function analyze(file, rel) {
  const html = fs.readFileSync(file, 'utf8');
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = metaContent(html, 'name', 'description');
  const canonicalRaw = decode((html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '');
  const robots = metaContent(html, 'name', 'robots').toLowerCase();
  const ogTitle = metaContent(html, 'property', 'og:title');
  const ogImage = metaContent(html, 'property', 'og:image');
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const jsonLd = extractJsonLdTypes(html);
  const fallbackUrl = rel === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${rel.replace(/\.html$/, '')}`;
  const url = canonicalRaw || fallbackUrl;

  const issues = [];
  if (!title) issues.push('title 없음');
  else if (title.length > 60) issues.push(`title 김 (${title.length}자, 권장 60자 이하)`);
  else if (title.length < 15) issues.push(`title 짧음 (${title.length}자)`);
  if (!description) issues.push('meta description 없음');
  else if (description.length > 160) issues.push(`description 김 (${description.length}자, 권장 160자 이하)`);
  else if (description.length < 50) issues.push(`description 짧음 (${description.length}자)`);
  if (!canonicalRaw) issues.push('canonical 없음');
  else if (!canonicalRaw.startsWith(ORIGIN)) issues.push('canonical이 다른 도메인');
  if (rel !== 'index.html' && h1Count === 0) issues.push('h1 없음');
  if (h1Count > 1) issues.push(`h1 ${h1Count}개`);
  if (!jsonLd.valid) issues.push('JSON-LD 파싱 오류');
  if (!ogTitle) issues.push('og:title 없음');

  return {
    file: rel,
    url,
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    canonical: canonicalRaw,
    noindex: robots.includes('noindex'),
    h1Count,
    ogImage,
    jsonLdTypes: jsonLd.types,
    jsonLdValid: jsonLd.valid,
    datePublished: extractDate(html, 'datePublished'),
    dateModified: extractDate(html, 'dateModified'),
    section: rel.startsWith('articles/') ? 'article' : rel.startsWith('guide/') ? 'guide' : rel === 'index.html' ? 'home' : 'page',
    hash: crypto.createHash('sha1').update(html).digest('hex').slice(0, 16),
    issues,
  };
}

function collectFiles() {
  const out = [];
  const rootIndex = path.join(ROOT, 'index.html');
  if (fs.existsSync(rootIndex)) out.push({ file: rootIndex, rel: 'index.html' });
  for (const f of fs.readdirSync(PUBLIC)) {
    if (f.endsWith('.html') && !EXCLUDE.has(f)) out.push({ file: path.join(PUBLIC, f), rel: f });
  }
  for (const dir of ['guide', 'articles']) {
    const d = path.join(PUBLIC, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      if (f.endsWith('.html')) out.push({ file: path.join(d, f), rel: `${dir}/${f}` });
    }
  }
  return out;
}

function previousSitemapDates() {
  const map = new Map();
  try {
    const xml = fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8');
    for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
      const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
      const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
      if (loc && lastmod) map.set(urlKey(loc.trim()), lastmod.trim().slice(0, 10));
    }
  } catch {}
  return map;
}

const ORDER = { home: 0, page: 1, guide: 2, article: 3 };

function main() {
  const prevManifest = readJson(path.join(PUBLIC, 'seo-manifest.json'));
  const prevByUrl = new Map((prevManifest?.pages || []).map(p => [urlKey(p.url), p]));
  const prevSitemap = previousSitemapDates();

  const pages = collectFiles().map(({ file, rel }) => {
    const p = analyze(file, rel);
    const prev = prevByUrl.get(urlKey(p.url));
    let lastmod;
    const changed = !prev || prev.hash !== p.hash;
    if (prev && prev.hash === p.hash && prev.lastmod) lastmod = prev.lastmod;
    else if (prev) lastmod = today;
    else lastmod = p.dateModified || prevSitemap.get(urlKey(p.url)) || p.datePublished || today;
    return { ...p, lastmod, changed };
  }).sort((a, b) => (ORDER[a.section] - ORDER[b.section]) || a.url.localeCompare(b.url));

  // 중복 title/description·canonical 탐지
  const dup = (key, label) => {
    const seen = new Map();
    for (const p of pages) {
      if (!p[key]) continue;
      const list = seen.get(p[key]) || [];
      list.push(p);
      seen.set(p[key], list);
    }
    for (const list of seen.values()) {
      if (list.length > 1) list.forEach(p => p.issues.push(`${label} 중복 (${list.length}개 페이지)`));
    }
  };
  dup('title', 'title');
  dup('description', 'description');
  dup('url', 'canonical');

  const indexable = pages.filter(p => !p.noindex);

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- scripts/seo-build.mjs 가 빌드 시 자동 생성합니다. 직접 수정하지 마세요. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexable.map(p => `  <url>\n    <loc>${xmlEscape(p.url)}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');

  const feedItems = indexable
    .filter(p => p.section === 'article' || p.section === 'guide')
    .map(p => ({ ...p, pub: p.datePublished || p.lastmod }))
    .sort((a, b) => b.pub.localeCompare(a.pub) || a.url.localeCompare(b.url));
  const rfc822 = d => new Date(`${d}T09:00:00+09:00`).toUTCString();
  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- scripts/seo-build.mjs 가 빌드 시 자동 생성합니다. 직접 수정하지 마세요. -->',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>my김변 채무·개인회생 가이드 &amp; 칼럼</title>',
    `    <link>${ORIGIN}/</link>`,
    '    <description>개인회생·개인파산·신용회복·압류 대응 등 채무 해결 제도 일반정보 가이드와 칼럼</description>',
    '    <language>ko-KR</language>',
    `    <lastBuildDate>${rfc822(feedItems[0]?.lastmod || today)}</lastBuildDate>`,
    `    <atom:link href="${ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />`,
    ...feedItems.map(p => [
      '    <item>',
      `      <title>${xmlEscape(p.title)}</title>`,
      `      <link>${xmlEscape(p.url)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(p.url)}</guid>`,
      `      <description>${xmlEscape(p.description)}</description>`,
      `      <category>${p.section === 'article' ? '칼럼' : '가이드'}</category>`,
      `      <pubDate>${rfc822(p.pub)}</pubDate>`,
      '    </item>',
    ].join('\n')),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  const manifest = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    counts: {
      pages: pages.length,
      indexable: indexable.length,
      guides: indexable.filter(p => p.section === 'guide').length,
      articles: indexable.filter(p => p.section === 'article').length,
      rssItems: feedItems.length,
      pagesWithIssues: pages.filter(p => p.issues.length).length,
    },
    pages,
  };

  const writeIfChanged = (name, content) => {
    const file = path.join(PUBLIC, name);
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    // manifest는 generatedAt만 바뀐 경우 쓰지 않음 (불필요한 git 변경 방지)
    const strip = s => (s || '').replace(/"generatedAt":\s*"[^"]*"/, '');
    if (prev !== null && strip(prev) === strip(content)) return false;
    fs.writeFileSync(file, content, 'utf8');
    return true;
  };

  const changed = [
    writeIfChanged('sitemap.xml', sitemap) && 'sitemap.xml',
    writeIfChanged('rss.xml', rss) && 'rss.xml',
    writeIfChanged('seo-manifest.json', JSON.stringify(manifest, null, 2).replace(/,\n\s*"changed": (?:true|false)/g, '') + '\n') && 'seo-manifest.json',
    writeIfChanged('llms.txt', buildLlmsTxt(indexable)) && 'llms.txt',
  ].filter(Boolean);

  console.log(`[seo-build] 페이지 ${pages.length}개 (색인 대상 ${indexable.length}, RSS ${feedItems.length}) · 이슈 있는 페이지 ${manifest.counts.pagesWithIssues}개 · 갱신: ${changed.join(', ') || '없음'}`);
  return { indexable };
}

// ── llms.txt 자동 생성 (M0, GEO): 회사 사실은 공통 사전·고정 값, 페이지 목록은 색인 대상에서 ──
function buildLlmsTxt(indexable) {
  const line = p => `- ${p.title.replace(/\s*\|\s*my김변.*$/, '').trim() || p.url}: ${p.url}`;
  const legal = new Set(['tos.html', 'privacy.html', 'legal.html']);
  const pages = indexable.filter(p => (p.section === 'page' || p.section === 'home') && !legal.has(p.file));
  const guides = indexable.filter(p => p.section === 'guide');
  const articles = indexable.filter(p => p.section === 'article');
  const legals = indexable.filter(p => legal.has(p.file));
  return [
    '# my김변 (mykim.kr)',
    '> 채무·소득·지출 정보를 정리하고, 상담받을 변호사를 직접 골라 상담을 요청하는 채무상담 플랫폼',
    '',
    '<!-- scripts/seo-build.mjs 가 빌드 때 자동으로 만듭니다. 직접 고치지 마세요. -->',
    '',
    '## 운영 정보',
    '- 상호: 몬스터랩 (개인사업자)',
    '- 대표: 진성호',
    '- 사업자등록번호: 521-39-01355',
    '- 통신판매업 신고: 제2026-진접오남-0565호',
    '- 고객 문의: support@mykim.kr',
    '- 브랜드: my김변 (마이김변)',
    '- 서비스 시작: 2026년 4월',
    '- 사이트: https://mykim.kr',
    '',
    '## 엔티티 구분',
    'my김변(mykim.kr)은 김변호사(kimbyun.co.kr)와 별개의 서비스입니다. 김변호사는 변호사 간 업무 협업을 위한 B2B 플랫폼이고, my김변은 일반 의뢰인을 위한 채무상담 플랫폼입니다. 운영 주체·서비스 대상·사업 모델이 모두 다릅니다.',
    '',
    '## 서비스 사실',
    ...PLATFORM_FACTS_LINES.map(l => `- ${l}`),
    '- 같은 광고 등급 안의 변호사는 무작위 순서로 보여 주며, 광고비 순으로 정렬하지 않습니다.',
    '- 플랫폼이 의뢰인에게 월 변제금·감면율을 정해 알려 주지 않습니다. 변호사가 보낸 제안서에만 그 변호사의 검토 의견이 담깁니다.',
    '',
    '## 주요 페이지',
    ...pages.map(line),
    '',
    '## 가이드',
    ...guides.map(line),
    '',
    '## 칼럼',
    ...articles.map(line),
    '',
    '## 약관·정책',
    ...legals.map(line),
    '',
    '## 주요 키워드',
    '개인회생, 개인파산, 신용회복, 채무조정, 채무상담, 채무상담 플랫폼, 개인회생 변호사, 개인회생 신청자격, 개인회생 비용, 급여 압류, 통장 압류, 채무자대리인, 세금체납, 스텔스 가명',
    '',
  ].join('\n');
}

// ── 배포 빌드에서만: 운영 중인 SNS(sameAs) 반영, 바뀐 페이지 IndexNow 자동 전송 ──
const SOCIAL_HOSTS = {
  naver_blog: /^https:\/\/(m\.)?blog\.naver\.com\//, naver_cafe: /^https:\/\/(m\.)?cafe\.naver\.com\//,
  instagram: /^https:\/\/(www\.)?instagram\.com\//, threads: /^https:\/\/(www\.)?threads\.(net|com)\//,
  youtube: /^https:\/\/(www\.)?youtube\.com\//, tiktok: /^https:\/\/(www\.)?tiktok\.com\//,
  facebook: /^https:\/\/(www\.)?facebook\.com\//, kakao_channel: /^https:\/\/pf\.kakao\.com\//,
};

async function fetchSocialChannels() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/platform_config?id=eq.social_channels&select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const list = Array.isArray(rows?.[0]?.data?.channels) ? rows[0].data.channels : [];
  return list.filter(c => c && c.active && typeof c.url === 'string' && SOCIAL_HOSTS[c.channel]?.test(c.url)).map(c => c.url).slice(0, 10);
}

function applySameAs(urls) {
  const json = JSON.stringify(urls);
  for (const rel of ['index.html', 'public/about.html']) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const next = html.replace(/"sameAs":\s*\[[^\]]*\]/g, `"sameAs": ${json}`);
    if (next !== html) fs.writeFileSync(file, next, 'utf8');
  }
}

async function submitIndexNow(urls) {
  const key = String(process.env.INDEXNOW_KEY || '5283c27badad10634284ba2943977400').trim();
  const payload = JSON.stringify({ host: 'mykim.kr', key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: urls.slice(0, 100) });
  const endpoints = [['IndexNow', 'https://api.indexnow.org/indexnow'], ['Naver', 'https://searchadvisor.naver.com/indexnow']];
  const results = await Promise.all(endpoints.map(async ([engine, u]) => {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: payload, signal: AbortSignal.timeout(10000) });
      return { engine, status: r.status, ok: r.status === 200 || r.status === 202 };
    } catch { return { engine, status: 0, ok: false }; }
  }));
  // 전송 기록은 서버에 (관리자 SEO 화면이 읽음)
  const sUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sUrl && sKey) {
    await fetch(`${sUrl.replace(/\/$/, '')}/rest/v1/seo_indexnow_log`, {
      method: 'POST',
      headers: { apikey: sKey, Authorization: `Bearer ${sKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ source: 'build', urls: urls.slice(0, 100), ok: results.some(x => x.ok), results }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }
  return results;
}

async function deployExtras(indexable) {
  if (!process.env.VERCEL) return; // 로컬 빌드는 추적 파일을 바꾸지 않는다
  try {
    const social = await fetchSocialChannels();
    if (social) { applySameAs(social); console.log(`[seo-build] sameAs ${social.length}개 반영`); }
  } catch (e) { console.warn('[seo-build] SNS 채널을 읽지 못해 sameAs를 비워 둡니다:', e?.message || e); }
  if (process.env.VERCEL_ENV !== 'production') return;
  const changedUrls = indexable.filter(p => p.changed).map(p => p.url);
  if (changedUrls.length === 0) return;
  try {
    const res = await submitIndexNow(changedUrls);
    console.log(`[seo-build] IndexNow ${changedUrls.length}개 전송: ${res.map(r => `${r.engine} ${r.status}`).join(', ')}`);
  } catch (e) { console.warn('[seo-build] IndexNow 전송 실패(빌드는 계속):', e?.message || e); }
}

try {
  const out = main();
  await deployExtras(out?.indexable || []);
} catch (e) {
  console.warn('[seo-build] 생성 실패 — 기존 파일을 유지하고 빌드를 계속합니다:', e?.message || e);
}
