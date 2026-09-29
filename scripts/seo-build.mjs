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
    if (prev && prev.hash === p.hash && prev.lastmod) lastmod = prev.lastmod;
    else if (prev) lastmod = today;
    else lastmod = p.dateModified || prevSitemap.get(urlKey(p.url)) || p.datePublished || today;
    return { ...p, lastmod };
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
    writeIfChanged('seo-manifest.json', JSON.stringify(manifest, null, 2) + '\n') && 'seo-manifest.json',
  ].filter(Boolean);

  console.log(`[seo-build] 페이지 ${pages.length}개 (색인 대상 ${indexable.length}, RSS ${feedItems.length}) · 이슈 있는 페이지 ${manifest.counts.pagesWithIssues}개 · 갱신: ${changed.join(', ') || '없음'}`);
}

try {
  main();
} catch (e) {
  console.warn('[seo-build] 생성 실패 — 기존 파일을 유지하고 빌드를 계속합니다:', e?.message || e);
}
