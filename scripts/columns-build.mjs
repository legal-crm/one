// ============================================================
// [M-3] 게시된 칼럼(news_articles) → 정적 페이지 public/articles/c-<id>.html
// - Vercel 빌드에서만 실행 (로컬 빌드는 추적 파일을 바꾸지 않는다). seo-build가 이어서 사이트맵·RSS·llms.txt·IndexNow에 넣는다
// - 예시 글(is_example)은 만들지 않는다. 금지 표현(공통 사전)이 걸린 글은 빼고 경고만 (빌드는 막지 않는다)
// - 글쓴이는 '마이김변 편집팀' (가상 변호사 명의 금지, CT-Q1). 법률 검토 표시는 외부 자문(R6) 확정 전 넣지 않는다
// - 실패해도 빌드를 막지 않는다 (기존 파일 유지)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_RULES, decisionRuleRegex } from '../api/_lib/compliance-terms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'articles');
const ORIGIN = 'https://mykim.kr';
const PREFIX = 'c-';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeId = (id) => String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);

/** 글 본문: 빈 줄로 문단, '## '·'### ' 제목, '- ' 목록. HTML은 그대로 쓰지 않는다 */
export function renderBody(text) {
  const blocks = String(text || '').replace(/<[^>]+>/g, '').replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    if (b.startsWith('### ')) return `<h3>${esc(b.slice(4))}</h3>`;
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => /^[-•]\s/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-•]\s/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('\n');
}

export function findBannedTerms(text) {
  const hits = [];
  for (const rule of DECISION_RULES) {
    const m = String(text || '').match(decisionRuleRegex(rule));
    if (m) hits.push(`${rule.label}: ${m[0]}`);
  }
  return hits;
}

export function renderArticle(a) {
  const id = safeId(a.id);
  const url = `${ORIGIN}/articles/${PREFIX}${id}.html`;
  const title = String(a.title || '').slice(0, 80);
  const desc = String(a.excerpt || a.content || '').replace(/<[^>]+>/g, '').replace(/[#*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
  const date = /^\d{4}-\d{2}-\d{2}/.test(a.date || '') ? a.date.slice(0, 10) : (a.updatedAt || '').slice(0, 10);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: ORIGIN },
        { '@type': 'ListItem', position: 2, name: '법률 정보', item: `${ORIGIN}/news` },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ] },
      { '@type': 'Article', headline: title, description: desc, datePublished: date, dateModified: (a.updatedAt || date).slice(0, 10),
        author: { '@type': 'Organization', name: '마이김변 편집팀' },
        publisher: { '@type': 'Organization', name: 'my김변', url: ORIGIN } },
    ],
  };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- scripts/columns-build.mjs 가 게시된 칼럼으로 빌드 때 만듭니다. 직접 고치지 마세요(통합어드민 콘텐츠에서 고치면 다음 배포에 반영). -->
<title>${esc(title)} | my김변</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)} | my김변">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:image" content="${ORIGIN}/mykim_logo.png">
<meta property="og:locale" content="ko_KR">
<link rel="icon" href="/favicon.ico">
<style>body{font-family:'Pretendard Variable',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.8;color:#1e293b;margin:0;background:#f8fafc}main{max-width:760px;margin:0 auto;padding:40px 20px 80px}h1{font-size:26px;line-height:1.4}h2{font-size:19px;margin-top:32px}h3{font-size:16px;margin-top:24px}p,li{font-size:16px;color:#334155}.meta{font-size:13px;color:#64748b;margin-bottom:24px}.cta{margin-top:40px;padding:20px;border-radius:16px;background:#1e3a5f;color:#fff}.cta a{color:#fff;font-weight:700}.note{margin-top:32px;font-size:13px;color:#64748b}nav a{color:#1e3a5f}</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<main>
<nav class="meta"><a href="/">홈</a> &gt; <a href="/?tab=news">법률 정보</a></nav>
<h1>${esc(title)}</h1>
<p class="meta">${esc(a.category || '법률 정보')} · 마이김변 편집팀${date ? ` · ${esc(date)}` : ''}</p>
${renderBody(a.content)}
<div class="cta"><p>내 상황은 변호사마다 판단이 다를 수 있어요. 채무·소득을 정리하고 상담받을 변호사를 직접 골라 보세요.</p><a href="/check">내 상황 체크하기</a></div>
<p class="note">이 글은 일반적인 제도 안내이며 개별 사건에 대한 법률 판단이 아닙니다. 실제 결과는 법원 심사와 사건 사정에 따라 달라집니다.</p>
</main>
</body>
</html>
`;
}

async function main() {
  if (!process.env.VERCEL) return; // 로컬 빌드는 추적 파일을 바꾸지 않는다
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) { console.warn('[columns-build] Supabase 설정 없음 → 건너뜀'); return; }
  let rows;
  try {
    const res = await fetch(`${url}/rest/v1/news_articles?select=id,data,updated_at,is_example,status&status=eq.published&is_example=eq.false&order=sort_order.asc&limit=500`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = await res.json();
  } catch (e) {
    console.warn('[columns-build] 칼럼을 읽지 못함 → 기존 파일 유지:', e?.message || e);
    return;
  }
  fs.mkdirSync(DIR, { recursive: true });
  const keep = new Set();
  for (const r of rows || []) {
    const a = { ...(r.data || {}), id: r.id, updatedAt: r.updated_at };
    const id = safeId(a.id);
    if (!id || !a.title || !a.content) continue;
    const hits = findBannedTerms(`${a.title}\n${a.excerpt || ''}\n${a.content}`);
    if (hits.length) { console.warn(`[columns-build] ${id} 금지 표현으로 제외: ${hits.join(', ')}`); continue; }
    const file = path.join(DIR, `${PREFIX}${id}.html`);
    const html = renderArticle(a);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) fs.writeFileSync(file, html);
    keep.add(`${PREFIX}${id}.html`);
  }
  // 내리거나 지운 칼럼의 페이지는 지운다 (직접 쓴 정적 글은 접두어가 달라 건드리지 않는다)
  for (const f of fs.readdirSync(DIR)) {
    if (f.startsWith(PREFIX) && f.endsWith('.html') && !keep.has(f)) fs.unlinkSync(path.join(DIR, f));
  }
  console.log(`[columns-build] 칼럼 정적 페이지 ${keep.size}개`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('columns-build.mjs')) {
  await main();
}
