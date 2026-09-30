// 카드뉴스 렌더러
// 사용법:
//   node scripts/cardnews/render.mjs            → 전체 검증 + 렌더
//   node scripts/cardnews/render.mjs --check    → 검증·광고규정 검사만
//   node scripts/cardnews/render.mjs --only=1,5,12
//   node scripts/cardnews/render.mjs --file=part2.mjs [--check]   → 파일 하나만
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { renderPost, buildShellCss, validatePost, postText, plain, W, H, CTA_VARIANTS } from './templates.mjs';
import { scanCompliance, MARKETING_DISCLAIMER } from '../../api/_lib/marketing-compliance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'cardnews');
const CONTENT_DIR = path.join(__dirname, 'content');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const fileArg = (args.find((a) => a.startsWith('--file=')) || '').slice(7);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);

// ── 콘텐츠 로드 ──
async function loadPosts() {
  const files = fileArg ? [fileArg] : fs.readdirSync(CONTENT_DIR).filter((f) => /^part\d+\.mjs$/.test(f)).sort();
  const all = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(CONTENT_DIR, f)).href);
    for (const p of mod.default) all.push({ ...p, _file: f });
  }
  return all.sort((a, b) => a.id - b.id);
}

const pad3 = (n) => String(n).padStart(3, '0');
const dirName = (p) => `${pad3(p.id)}_${p.slug}`;

function captionText(p) {
  const title = plain(p.cover.title);
  const tags = p.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  return [
    `[제목]`,
    title,
    ``,
    `[캡션 · 인스타그램/페이스북 공용]`,
    p.caption.trim(),
    ``,
    `저장해 두고 필요할 때 꺼내 보세요. 내 상황이 궁금하다면 프로필 링크 → 익명 채무 체크`,
    ``,
    tags,
    ``,
    `※ ${MARKETING_DISCLAIMER}`,
    ``,
    `[링크(프로필·스토리)]`,
    `https://mykim.kr/check?utm_source=instagram&utm_medium=cardnews&utm_campaign=cn${pad3(p.id)}`,
    `https://mykim.kr/check?utm_source=facebook&utm_medium=cardnews&utm_campaign=cn${pad3(p.id)}`,
    ``,
    `[대체 텍스트(접근성)]`,
    `${title} — ${plain(p.cover.sub || '')} 마이김변 카드뉴스 ${p.slides.length + 2}장.`,
  ].join('\n');
}

async function main() {
  const posts = await loadPosts();

  // ── 1) 검증 ──
  let hard = 0;
  const ids = new Set();
  const report = [];
  const numReview = [];
  for (const p of posts) {
    const errs = validatePost(p);
    if (ids.has(p.id)) errs.push('id 중복');
    ids.add(p.id);
    const comp = scanCompliance(postText(p), { skipDisclaimerCheck: true });
    // 수치(%, 억 등)는 법령 수치일 수 있어 차단하지 않고 사람이 확인할 목록으로만 출력
    const nums = comp.issues.filter((i) => i.ruleId === 'numeric-claim');
    const high = comp.issues.filter((i) => i.severity === 'high' && i.ruleId !== 'numeric-claim');
    const med = comp.issues.filter((i) => i.severity === 'medium');
    if (nums.length) numReview.push(`#${pad3(p.id)} ${nums.map((i) => i.match).join(', ')}`);
    if (errs.length || high.length || med.length) {
      report.push(`#${pad3(p.id)} ${p.slug} (${p._file})\n  ${[...errs.map((e) => `[스키마] ${e}`), ...high.map((i) => `[HIGH] ${i.label}: "${i.match}"`), ...med.map((i) => `[MED] ${i.label}: "${i.match}"`)].join('\n  ')}`);
    }
    hard += errs.length + high.length + med.length;
  }
  console.log(`포스트 ${posts.length}개 로드`);
  if (report.length) console.log(report.join('\n'));
  if (numReview.length) console.log(`[수치 확인용·비차단]\n  ${numReview.join('\n  ')}`);
  console.log(hard ? `검사 문제 ${hard}건` : '검사 통과');
  if (CHECK_ONLY) return;
  if (hard) {
    console.log('문제를 먼저 수정하세요. 렌더를 중단합니다.');
    process.exitCode = 1;
    return;
  }

  // ── 2) 렌더 ──
  fs.mkdirSync(OUT, { recursive: true });
  const shellPath = path.join(OUT, '_fonts', '_shell.html');
  fs.writeFileSync(
    shellPath,
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${buildShellCss('PretendardVariable.woff2')}</style></head><body><div id="root"></div><div style="font-family:Pretendard;font-weight:900;position:absolute;left:-9999px">가나다 my김변 0123</div></body></html>`,
    'utf8'
  );

  const targets = only.length ? posts.filter((p) => only.includes(p.id)) : posts;
  const overflow = [];
  let count = 0;
  let browser;
  let page;
  // 브라우저가 중간에 죽는 경우(Target closed)를 대비해 포스트 단위로 재시작·재시도한다
  const openBrowser = async () => {
    if (browser) await browser.close().catch(() => {});
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
    page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(shellPath).href, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.load('900 40px Pretendard'); await document.fonts.ready; });
  };
  await openBrowser();
  for (const p of targets) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        count += await renderOne(p);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        console.log(`\n#${pad3(p.id)} 재시도 (${e.message})`);
        await openBrowser();
      }
    }
    process.stdout.write(`\r렌더 ${p.id}/${posts.length}  (슬라이드 ${count})   `);
  }
  await browser.close();
  console.log(`\n완료: 포스트 ${targets.length}개, 슬라이드 ${count}장 → ${OUT}`);
  if (overflow.length) console.log(`축소·넘침 확인 필요:\n  ${overflow.join('\n  ')}`);

  async function renderOne(p) {
    let n = 0;
    const dir = path.join(OUT, dirName(p));
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
    const slides = renderPost(p);
    for (let i = 0; i < slides.length; i++) {
      // 넘치면 --s 배율을 0.02씩 줄여 맞춘다 (최소 0.72)
      const fit = await page.evaluate((html) => {
        const root = document.getElementById('root');
        root.innerHTML = html;
        const slide = root.firstElementChild;
        const content = slide.querySelector('.split-top .content') || slide.querySelector('.content');
        // 본문이 적은 슬라이드는 최대 1.2배까지 키우고, 넘치면 줄인다. 여백 비율(내용 높이/영역)을 88% 이하로 유지
        const isCover = slide.classList.contains('is-cover');
        let s = isCover ? 1 : 1.2;
        slide.style.setProperty('--s', String(s));
        const inner = () => Array.from(content.children).reduce((h, c) => h + c.getBoundingClientRect().height, 0);
        const over = () => content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1 || (!isCover && s > 1 && inner() > content.clientHeight * 0.88);
        while (over() && s > 0.72) { s = Math.round((s - 0.02) * 100) / 100; slide.style.setProperty('--s', String(s)); }
        const hardOver = content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1;
        return { s, over: hardOver };
      }, slides[i]);
      if (fit.over || fit.s < 0.8) overflow.push(`${dirName(p)} #${i + 1} scale=${fit.s}${fit.over ? ' (넘침)' : ''}`);
      const el = await page.$('#root > .slide');
      await el.screenshot({ path: path.join(dir, `${pad3(p.id)}_${String(i + 1).padStart(2, '0')}.png`), type: 'png' });
      n++;
    }
    fs.writeFileSync(path.join(dir, 'caption.txt'), captionText(p), 'utf8');
    return n;
  }

  // ── 3) 목록·인덱스 (전체 렌더 때만) ──
  if (!only.length && !fileArg) {
    const csv = ['번호,폴더,분류,테마,마무리CTA,장수,제목,해시태그'];
    for (const p of posts) {
      const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      csv.push([pad3(p.id), dirName(p), q(p.category), p.theme, p.cta || 'check', p.slides.length + 2, q(plain(p.cover.title)), q(p.hashtags.join(' '))].join(','));
    }
    fs.writeFileSync(path.join(OUT, 'cardnews_list.csv'), '\uFEFF' + csv.join('\r\n'), 'utf8');
    const cards = posts
      .map((p) => `<a href="${dirName(p)}/" title="${plain(p.cover.title)}"><img loading="lazy" src="${dirName(p)}/${pad3(p.id)}_01.png" alt="${plain(p.cover.title)}"><span>${pad3(p.id)} · ${p.category}</span></a>`)
      .join('\n');
    fs.writeFileSync(
      path.join(OUT, 'index.html'),
      `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>마이김변 카드뉴스 100</title><style>body{font-family:system-ui,sans-serif;background:#F1F5F9;margin:0;padding:32px}h1{font-size:22px;margin:0 0 20px}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}a{display:block;text-decoration:none;color:#0F172A;font-size:13px;font-weight:600}img{width:100%;border-radius:10px;display:block;margin-bottom:6px;box-shadow:0 1px 3px rgba(15,23,42,.12)}</style></head><body><h1>마이김변 카드뉴스 ${posts.length}세트 (표지 모음)</h1><div>${cards}</div></body></html>`,
      'utf8'
    );
    console.log('cardnews_list.csv, index.html 생성');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
