// ============================================================
// [NF-1] 채무 관련 제도 일반 안내 → 정적 페이지 public/guide/debt-programs.html
// - 원본: src/content/debtProgramsData.js (앱 홈 '제도별로 보기'와 같은 데이터)
// - Vercel 빌드에서는 통합어드민 '제도 안내'(platform_config 'debt_programs') 덮어쓰기를 합쳐서 만든다
//   (로컬 빌드는 원본만 → 저장소에 들어가는 파일은 늘 원본 기준)
// - 판단·추천 없이 일반 정보·공식 연락처·확인일만. 실패해도 빌드를 막지 않는다 (기존 파일 유지)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEBT_PROGRAMS_DATA, DEBT_PROGRAM_ORDER_DATA } from '../src/content/debtProgramsData.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'guide', 'debt-programs.html');
const FOOTER_SOURCE = path.join(ROOT, 'public', 'guide', 'debt-agent.html');
const ORIGIN = 'https://mykim.kr';
const URL = `${ORIGIN}/guide/debt-programs.html`;
const FIXED_VISIBLE = new Set(['rehab', 'bankruptcy']);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 앱 debtPrograms.ts applyDebtProgramOverrides 와 같은 규칙 */
export function mergePrograms(overrides) {
  const out = {};
  const hidden = new Set();
  for (const k of DEBT_PROGRAM_ORDER_DATA) {
    const b = DEBT_PROGRAMS_DATA[k];
    const x = (overrides && overrides[k]) || {};
    const points = Array.isArray(x.keyPoints) ? x.keyPoints.filter(Boolean) : [];
    const links = Array.isArray(x.links) ? x.links.filter((l) => l && l.label) : [];
    out[k] = {
      ...b,
      summary: (typeof x.summary === 'string' && x.summary.trim()) || b.summary,
      keyPoints: points.length ? points : b.keyPoints,
      links: links.length ? links : b.links,
      checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(x.checkedOn || '') ? x.checkedOn : b.checkedOn,
    };
    if (x.hidden && !FIXED_VISIBLE.has(k)) hidden.add(k);
  }
  return { programs: out, order: DEBT_PROGRAM_ORDER_DATA.filter((k) => !hidden.has(k)) };
}

function footerHtml() {
  try {
    const s = fs.readFileSync(FOOTER_SOURCE, 'utf8');
    const a = s.indexOf('<!-- 3-Zone Dark Footer -->');
    const b = s.indexOf('</footer>', a);
    if (a >= 0 && b > a) return s.slice(a, b + '</footer>'.length);
  } catch { /* 아래 기본 푸터 */ }
  return `<footer style="background:#111827;color:#94a3b8;padding:24px 16px;font-size:13px;line-height:1.7">
<p>상호: 몬스터랩 | 대표: 진성호 | 사업자등록번호: 521-39-01355 | 통신판매업 신고: 제2026-진접오남-0565호 | 개인정보 보호책임자: 진성호(대표) | 호스팅 서비스 제공자: Vercel Inc.</p>
<p>사업장 주소지: 경기도 남양주시 진접읍 해밀예당1로189번길 3, 2102동 301호(원일플로라아파트) | 고객문의: support@mykim.kr</p>
<p><a href="/tos" style="color:#cbd5e1">서비스 이용약관</a> · <a href="/privacy" style="color:#cbd5e1">개인정보 처리방침</a> · <a href="/legal" style="color:#cbd5e1">법적 고지 및 책임한계</a></p>
</footer>`;
}

const linkHtml = (l) => {
  const parts = [`<strong>${esc(l.label)}</strong>`];
  if (l.phone) parts.push(`<a href="tel:${esc(String(l.phone).replace(/[^0-9]/g, ''))}">☎ ${esc(l.phone)}</a>`);
  if (l.url && /^https:\/\//.test(l.url)) parts.push(`<a href="${esc(l.url)}" rel="noopener nofollow" target="_blank">${esc(l.url.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a>`);
  return `<li>${parts.join(' · ')}</li>`;
};

export function renderPage({ programs, order }) {
  const title = '채무 관련 제도 한눈에 보기 — 개인회생·파산·채무조정·생계비계좌';
  const desc = '개인회생, 개인파산, 신용회복위원회 채무조정, 금융회사 직접 채무조정 요청, 채무자대리인, 세금 체납, 법률구조, 생계비계좌의 일반 정보와 공식 연락처를 모았습니다. 추천 순서가 아닙니다.';
  const modified = order.map((k) => programs[k].checkedOn).sort().pop() || '';
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: ORIGIN },
        { '@type': 'ListItem', position: 2, name: '채무상담 가이드', item: `${ORIGIN}/guide/debt-management.html` },
        { '@type': 'ListItem', position: 3, name: '제도 한눈에 보기', item: URL },
      ] },
      { '@type': 'Article', headline: title, description: desc, dateModified: modified,
        author: { '@type': 'Organization', name: '마이김변 편집팀' },
        publisher: { '@type': 'Organization', name: 'my김변', url: ORIGIN } },
      { '@type': 'ItemList', name: '채무 관련 제도', itemListElement: order.map((k, i) => ({
        '@type': 'ListItem', position: i + 1, name: programs[k].title, url: `${URL}#${k}` })) },
    ],
  };
  const sections = order.map((k) => {
    const p = programs[k];
    return `    <section class="program" id="${esc(k)}">
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        <ul>${p.keyPoints.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="sub">공식 연락처</p>
        <ul class="links">${p.links.map(linkHtml).join('')}</ul>
        <p class="checked">공식 안내와 대조한 날: ${esc(p.checkedOn)}</p>
    </section>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- scripts/debt-programs-build.mjs 가 빌드 때 만듭니다. 직접 고치지 마세요 (원본 src/content/debtProgramsData.js, 운영 값은 통합어드민 '제도 안내'). -->
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="shortcut icon" href="/favicon.ico">
    <title>${esc(title)} | my김변</title>
    <meta name="description" content="${esc(desc)}">
    <link rel="canonical" href="${URL}">
    <meta property="og:title" content="${esc(title)} | my김변">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${URL}">
    <meta property="og:type" content="article">
    <meta property="og:image" content="${ORIGIN}/mykim_logo.png">
    <meta property="og:locale" content="ko_KR">
    <meta property="og:site_name" content="my김변">
    <meta name="twitter:card" content="summary">
    <meta name="article:modified_time" content="${esc(modified)}">
    <style>
        body { font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; background: #fafafa; min-height: 100vh; display: flex; flex-direction: column; }
        h1 { font-size: 24px; border-bottom: 2px solid #6C5CE7; padding-bottom: 12px; color: #2d3436; }
        h2 { margin-top: 0; font-size: 18px; color: #6C5CE7; }
        p, li { font-size: 15px; color: #444; }
        ul { padding-left: 20px; }
        li { margin-bottom: 6px; }
        a { color: #4c3fcf; }
        nav.breadcrumb { font-size: 12px; color: #777; margin-bottom: 16px; }
        nav.breadcrumb a { color: #6C5CE7; text-decoration: none; }
        .highlight-box { background: #f0edfc; border-left: 4px solid #6C5CE7; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #2d3436; }
        .toc { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 16px 0 24px; }
        .toc a { display: inline-block; padding: 8px 12px; border: 1px solid #ddd6fe; border-radius: 10px; background: #fff; text-decoration: none; font-size: 14px; }
        .program { background: #fff; border: 1px solid #e8e5f8; border-radius: 16px; padding: 20px 22px; margin: 16px 0; scroll-margin-top: 16px; }
        .program .sub { font-weight: 700; margin: 12px 0 4px; color: #2d3436; }
        .program .links { list-style: none; padding-left: 0; }
        .program .checked { font-size: 12px; color: #777; margin-bottom: 0; }
        .cta-box { background: linear-gradient(135deg, #6C5CE7, #a29bfe); color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 32px 0; }
        .cta-box a { color: white; text-decoration: none; font-weight: 700; font-size: 16px; }
        .footer-note { margin-top: 32px; font-size: 12px; color: #777; }
    </style>
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900 font-sans antialiased flex flex-col min-h-screen">
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 pb-20">
    <nav class="breadcrumb"><a href="/">홈</a> &gt; <a href="/guide/debt-management.html">채무관리 가이드</a> &gt; 제도 한눈에 보기</nav>
    <h1>채무 관련 제도 한눈에 보기</h1>
    <div class="highlight-box">
        빚 문제와 관련해 확인할 수 있는 제도의 일반 정보와 공식 연락처를 모았습니다. <strong>아래 목록은 추천 순서가 아닙니다.</strong> 어떤 제도를 쓸 수 있는지, 결과가 어떻게 될지는 소득·재산·채무 사정에 따라 달라지므로 해당 기관이나 변호사에게 확인하세요.
    </div>
    <ul class="toc">${order.map((k) => `<li><a href="#${esc(k)}">${esc(programs[k].title)}</a></li>`).join('')}</ul>
${sections}
    <div class="cta-box">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: white;">내 상황을 먼저 정리해 보세요</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: rgba(255,255,255,0.9);">채무·소득을 정리하고, 상담받을 변호사를 직접 고를 수 있어요.</p>
        <a href="/check">내 상황 체크하기 →</a>
    </div>
    <p class="footer-note">이 페이지는 일반적인 제도 안내이며 개별 사건에 대한 법률 판단이 아닙니다. 기준과 절차는 바뀔 수 있으니 각 기관의 공식 안내를 함께 확인하세요.</p>
    </main>
    ${footerHtml()}
</body>
</html>
`;
}

async function fetchOverrides() {
  if (!process.env.VERCEL) return null; // 로컬 빌드는 원본만
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/platform_config?id=eq.debt_programs&select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const rows = await r.json();
  return rows?.[0]?.data?.programs || null;
}

async function main() {
  let overrides = null;
  try { overrides = await fetchOverrides(); }
  catch (e) { console.warn('[debt-programs-build] 덮어쓰기를 못 읽어 원본으로 만듭니다:', e?.message || e); }
  const html = renderPage(mergePrograms(overrides));
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== html) fs.writeFileSync(OUT, html, 'utf8');
  console.log(`[debt-programs-build] /guide/debt-programs.html${overrides ? ' (운영 덮어쓰기 반영)' : ''}`);
}

if (process.argv[1]?.endsWith('debt-programs-build.mjs')) {
  try { await main(); } catch (e) { console.warn('[debt-programs-build] 생성 실패 — 기존 파일 유지:', e?.message || e); }
}
