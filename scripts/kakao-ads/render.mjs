// 카카오모먼트 광고 렌더러
// 사용법:
//   node scripts/kakao-ads/render.mjs            → 파일럿 10종 (컨셉별 1개)
//   node scripts/kakao-ads/render.mjs --all      → 100종 전체
//   node scripts/kakao-ads/render.mjs --only=1,12 [--ratios=2x1,1x1] [--no-biz] [--fit-only] [--out=검수폴더]
//   광고책임변호사 성명 표시: 환경변수 KAKAO_AD_LAWYER="홍길동" 또는 --lawyer=홍길동
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { CREATIVES, CONCEPTS, PILOT_IDS } from './creatives.mjs';
import { checkAll, PROFILE_NAME } from './check.mjs';
import { RATIOS, BIZ, buildCss, renderAd, renderBiz, renderBizObject, plain } from './templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const arg = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
// --out=DIR: 검수용으로 다른 폴더에 출력 (글꼴·아이콘·로고는 항상 기본 폴더의 _src 사용)
const OUT = arg('out') ? path.resolve(arg('out')) : path.join(ROOT, 'assets', 'kakao-moment-ads');
const SRC = path.join(ROOT, 'assets', 'kakao-moment-ads', '_src');
const STAGE = path.join(OUT, '_stage');
const has = (k) => args.includes(`--${k}`);
const LAWYER = arg('lawyer') || process.env.KAKAO_AD_LAWYER || '';
const ONLY = arg('only').split(',').filter(Boolean).map(Number);
const RATIO_KEYS = (arg('ratios') || Object.keys(RATIOS).join(',')).split(',');
const TARGETS = CREATIVES.filter((c) => (ONLY.length ? ONLY.includes(c.id) : has('all') ? true : PILOT_IDS.includes(c.id)));
const FIT_ONLY = has('fit-only');

const pad3 = (n) => String(n).padStart(3, '0');
export const dirName = (c) => `${pad3(c.id)}_${c.slug}`;
const kakaoText = (s) => plain(s).replace(/·/g, ', ').replace(/−/g, '-').replace(/→/g, '에서 ').replace(/[^\uAC00-\uD7A3A-Za-z0-9 ~!@#$%^&*()_+\-=[\]{}|;:'",.<>/?]/g, '').replace(/\s+/g, ' ').trim();
const altText = (c) => kakaoText(`${plain(c.headline)}. ${c.sub ? plain(c.sub) + '. ' : ''}${c.num ? `${c.num.pre} ${c.num.value}${c.num.unit}. ` : ''}${c.stat ? `${c.stat.label} ${c.stat.value}${c.stat.unit}. ` : ''}${PROFILE_NAME} 개인회생 상담`);
const bizIcon = (c) => c.bizIcon || (['hero', 'type'].includes(c.layout) && c.icons?.[0]) || CONCEPTS[c.code[0]].bizIcon;

// ── 페이지 안에서 실행: 글자 크기 자동 맞춤 + 규격 측정 ──
async function fitInPage(html, R, ratio) {
  const root = document.getElementById('root');
  root.innerHTML = html;
  const ad = root.firstElementChild;
  await Promise.all([...ad.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  const box = ad.querySelector('.box');
  const vis = ad.querySelector('.vis');
  const stage = vis && vis.querySelector('.stage');
  const TEXT = '.eb,.h,.sub,.note,.ans,.cl li,.sl,.ns,.na,.nv,.nv small,.ncap,.slabel,.sval,.sval small';
  const texts = () => [...ad.querySelectorAll(TEXT)];
  const visMin = { '2x1': 150, '1x1': 220, '4x5': 240, '9x16': 220 }[ratio];
  const setStage = () => {
    if (!stage) return;
    stage.style.width = stage.style.height = '1px';
    const s = Math.floor(Math.min(vis.clientWidth, vis.clientHeight, ratio === '2x1' ? 330 : 520));
    stage.style.width = stage.style.height = `${Math.max(1, s)}px`;
  };
  const main = ad.querySelector('.main');
  const over = () => {
    if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) return 'box';
    if (main && main.scrollHeight > main.clientHeight + 1) return 'main';
    for (const el of texts()) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') return 'text-wide';
    if (stage && stage.clientHeight < visMin && !ad.classList.contains('l-type')) return 'visual-small';
    return '';
  };
  let k = 1;
  const apply = () => { ad.style.setProperty('--k', String(k)); setStage(); };
  const visible = (el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  // 헤드라인이 의도한 줄바꿈보다 더 쪼개지면(고아 단어) 조금(최대 22%)까지 줄여서 맞춘다
  const hLines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    for (const rr of range.getClientRects()) if (rr.width > 2 && !tops.some((t) => Math.abs(t - rr.top) < rr.height * 0.5)) tops.push(rr.top);
    return tops.length;
  };
  const extraWrap = () => { const h = ad.querySelector('.box .h'); return !!h && visible(h) && hLines(h) > h.querySelectorAll('br').length + 1; };
  const dec = (v) => Math.round((v - 0.02) * 100) / 100;
  // 큰 숫자(통계·변제금)는 먼저 자기 폭에 맞춰 따로 줄인다 → 헤드라인 등 다른 글자 크기는 유지
  const nums = [...ad.querySelectorAll('.sval,.nv,.na')];
  let kn = 1;
  const numWide = () => nums.some((el) => el.scrollWidth > el.clientWidth + 1) || box.scrollWidth > box.clientWidth + 1;
  if (nums.length) { apply(); while (kn > 0.5 && numWide()) { kn = dec(kn); ad.style.setProperty('--kn', String(kn)); setStage(); } }
  // 넘치지 않을 때까지 줄이고, 헤드라인이 의도보다 더 쪼개지면 0.78배까지 더 줄여 본다. 그래도 안 되면 되돌린다(자연 줄바꿈)
  let kOver = 1; // 넘침(높이·폭) 때문에 줄어든 배율 (고아줄 맞춤 축소 제외)
  const fitLoop = () => {
    k = 1; apply();
    while (k > 0.56 && over()) { k = dec(k); apply(); }
    kOver = k;
    if (!extraWrap()) return;
    const base = k;
    while (k > 0.78 && extraWrap()) { k = dec(k); apply(); }
    if (extraWrap()) { k = base; apply(); }
  };
  const countLines = () => {
    const rows = [];
    for (const el of texts()) {
      if (!visible(el) || el.classList.contains('note')) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const rr of range.getClientRects()) if (rr.width > 2 && rr.height > 2) rows.push([rr.top, rr.bottom]);
    }
    rows.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const [t, b] of rows) {
      const last = merged[merged.length - 1];
      if (last && t < last[1] - Math.min(b - t, last[1] - last[0]) * 0.4) last[1] = Math.max(last[1], b);
      else merged.push([t, b]);
    }
    return merged.length;
  };
  fitLoop();
  // 2:1 은 텍스트 3줄 권장: 넘치면 아이브로우 → 서브 순서로 이미지에서 빼고 다시 맞춘다 (타이틀·홍보문구가 설명을 이어받음)
  const dropped = [];
  if (R.lines) {
    for (const sel of ['.eb', '.sub']) {
      if (countLines() <= R.lines) break;
      const el = ad.querySelector(`.box ${sel}`);
      if (el && visible(el)) {
        el.style.display = 'none'; dropped.push(sel.slice(1));
        // 서브를 설명하던 부가 안내(noteOpt)는 서브와 함께 뺀다
        const on = sel === '.sub' && ad.querySelector('.box .note.opt');
        if (on && visible(on)) { on.style.display = 'none'; dropped.push('note'); }
        fitLoop();
      }
    }
  }
  // 모든 비율: 넘침 때문에 글자가 0.8배 밑으로 줄면 장식 요소를 순서대로 빼고 다시 맞춘다
  // 부가 안내(noteOpt, 법적 고지 아님) → 아이브로우 → 큰 타이포형 상단 아이콘(1:1·4:5). 법적 고지·변호사 성명은 빼지 않는다
  for (const [sel, tag] of [['.box .note.opt', 'note'], ['.box .eb', 'eb'], ['.r-1x1.l-type .box > .vis, .r-4x5.l-type .box > .vis', 'icon']]) {
    if (kOver >= 0.8) break;
    const el = ad.querySelector(sel);
    if (el && visible(el)) { el.style.display = 'none'; dropped.push(tag); fitLoop(); }
  }
  const overflow = over();
  // 진행 단계 연결선
  const sl = ad.querySelector('.sline');
  if (sl) {
    const sis = [...ad.querySelectorAll('.si')];
    const st = ad.querySelector('.steps').getBoundingClientRect();
    const a = sis[0].getBoundingClientRect();
    const b = sis[sis.length - 1].getBoundingClientRect();
    if (Math.abs(a.top - b.top) < 4) Object.assign(sl.style, { left: `${a.left + a.width / 2 - st.left}px`, width: `${b.left - a.left}px`, top: `${a.top + a.height / 2 - st.top - 3}px`, height: '6px' });
    else Object.assign(sl.style, { top: `${a.top + a.height / 2 - st.top}px`, height: `${b.top - a.top}px`, left: `${a.left + a.width / 2 - st.left - 3}px`, width: '6px' });
  }
  // 측정: 최소/최대 글자, 세이프존 이탈, 권장영역(9:16), 우하단(4:5), 텍스트 줄 수(고지 제외)
  const A = ad.getBoundingClientRect();
  const W = ad.clientWidth; const H = ad.clientHeight; const S = R.safe;
  const res = { k, kn, overflow, dropped, minText: 999, minNote: 999, maxText: 0, outside: [], outRec: [], cornerHit: [], lines: 0, colors: [] };
  const styleSet = new Set();
  for (const el of texts()) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const f = parseFloat(cs.fontSize);
    const isNote = el.classList.contains('note');
    if (isNote) res.minNote = Math.min(res.minNote, f); else { res.minText = Math.min(res.minText, f); res.maxText = Math.max(res.maxText, f); }
    const r = el.getBoundingClientRect();
    const x0 = r.left - A.left; const y0 = r.top - A.top; const x1 = r.right - A.left; const y1 = r.bottom - A.top;
    if (x0 < S.l - 0.5 || y0 < S.t - 0.5 || x1 > W - S.r + 0.5 || y1 > H - S.b + 0.5) res.outside.push(el.className || el.tagName);
    if (R.rec && (y0 < R.rec.t - 0.5 || y1 > H - R.rec.b + 0.5) && !isNote) res.outRec.push(el.className || el.tagName);
    if (ratio === '4x5' && x1 > W - 280 && y1 > H - 135 - 140) res.cornerHit.push(el.className || el.tagName);
    styleSet.add(`${cs.fontWeight}|${cs.color}`);
    for (const em of el.querySelectorAll('em')) { const ec = getComputedStyle(em); styleSet.add(`${ec.fontWeight}|${ec.color}`); }
  }
  res.lines = countLines();
  res.wrap = extraWrap(); // 헤드라인 자연 줄바꿈(의도한 줄보다 많음) 여부
  res.styles = styleSet.size;
  res.colors = [...styleSet];
  return res;
}

async function bizInPage(html) {
  const root = document.getElementById('root');
  root.innerHTML = html;
  await Promise.all([...root.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  const w = (sel) => { const el = root.querySelector(sel); return el ? Math.ceil(el.getBoundingClientRect().width) : 0; };
  return { main: w('.bz-main span'), sub: w('.bz-sub span') };
}

// ── 규격 판정 (오류=제작 불가 / 경고=사람 확인) ──
function judge(ratio, m) {
  const R = RATIOS[ratio];
  const errs = [];
  const warns = [];
  if (m.overflow) errs.push(`넘침(${m.overflow})`);
  if (m.minText < R.min - 0.5) errs.push(`글자 ${m.minText.toFixed(0)}px < 최소 ${R.min}px`);
  if (m.minNote < 999 && m.minNote < R.nmin - 0.5) errs.push(`고지 ${m.minNote.toFixed(0)}px < ${R.nmin}px`);
  if (m.maxText > R.max + 0.5) errs.push(`글자 ${m.maxText.toFixed(0)}px > 최대 ${R.max}px`);
  if (m.outside.length) errs.push(`세이프존 이탈: ${m.outside.join(',')}`);
  if (m.styles > 3) errs.push(`텍스트 스타일·색 ${m.styles}종 (3종 이하)`);
  if (R.lines && m.lines > R.lines) warns.push(`텍스트 ${m.lines}줄 (2:1 권장 ${R.lines}줄)`);
  if (m.outRec?.length) warns.push(`9:16 권장영역 밖: ${m.outRec.join(',')}`);
  if (m.cornerHit?.length) warns.push(`4:5 우하단 UI 겹침 가능: ${m.cornerHit.join(',')}`);
  if (m.k < 0.78) warns.push(`글자 축소 ${m.k}`);
  if (m.dropped?.length) warns.push(`공간 맞춤으로 생략: ${m.dropped.join(',')}`);
  return { errs, warns };
}

function copySheet(c, bizSubNoLogo, files) {
  const con = CONCEPTS[c.code[0]];
  const len = (s) => [...plain(s)].length;
  return [
    `[소재 ${pad3(c.id)} · ${c.code}] ${con.name} (${con.type}) · 위험도 ${c.risk}`,
    '',
    '■ 이미지 문구',
    `헤드라인: ${plain(c.headline)}`,
    c.sub ? `서브: ${plain(c.sub)}` : null,
    c.num ? `숫자: ${c.num.label} → ${c.num.pre} ${c.num.value}${c.num.unit} (${c.num.caption})` : null,
    c.stat ? `통계: ${c.stat.label} ${c.stat.value}${c.stat.unit}` : null,
    c.checks ? `체크: ${c.checks.join(' / ')}` : null,
    c.steps ? `단계: ${c.steps.map((s) => s[1]).join(' → ')}` : null,
    c.note ? `고지: ${c.note}` : null,
    '',
    '■ 카카오 디스플레이 입력값',
    `프로필 이름: ${PROFILE_NAME}`,
    `타이틀 (${len(c.title)}/25자): ${plain(c.title)}`,
    `홍보문구 (${len(c.promo)}/45자): ${plain(c.promo)}`,
    '행동유도버튼: 신청하기 계열 (목록에 없으면 바로가기)',
    `소재 설명(대체텍스트): ${altText(c)}`,
    '',
    '■ 카카오 비즈보드 (메인 Spoqa Han Sans Bold 48 / 서브 Regular 39)',
    `메인 카피: ${c.biz[0]}`,
    `서브 카피 - 로고 버전: ${c.biz[1]}`,
    `서브 카피 - 로고 없음 버전(광고주체 표기): ${bizSubNoLogo}`,
    `오브젝트 아이콘: ${bizIcon(c)} (Fluent Emoji 3D, MIT)`,
    '',
    '■ 파일',
    ...files.map((f) => `- ${f}`),
  ].filter((l) => l !== null).join('\r\n');
}

async function main() {
  const { errors } = checkAll({ quiet: true });
  if (errors.length) { console.log(`카피 검사 오류 ${errors.length}건 — node scripts/kakao-ads/check.mjs 로 확인 후 수정하세요`); process.exitCode = 1; return; }
  fs.mkdirSync(STAGE, { recursive: true });
  const shell = path.join(SRC, '_shell.html');
  fs.writeFileSync(shell, `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${buildCss()}</style></head><body><div id="root"></div>`
    + `<div style="position:absolute;left:-9999px;font-family:Pretendard;font-weight:800">가나다 0123 개인회생</div><div style="position:absolute;left:-9999px;font-family:'Spoqa Han Sans Neo';font-weight:700">가나다<span style="font-weight:400">라마</span></div></body></html>`, 'utf8');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1920, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(shell).href, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.load('800 40px Pretendard'); await document.fonts.load('500 40px Pretendard'); await document.fonts.load('700 48px "Spoqa Han Sans Neo"'); await document.fonts.load('400 39px "Spoqa Han Sans Neo"'); await document.fonts.ready; });

  const qa = [];
  const jobs = [];
  let n = 0;
  for (const c of TARGETS) {
    const dir = path.join(OUT, dirName(c));
    if (!FIT_ONLY) fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const ratio of RATIO_KEYS) {
      for (const logo of [true, false]) {
        const name = `${pad3(c.id)}_${RATIOS[ratio].label}_${logo ? 'logo' : 'nologo'}`;
        const m = await page.evaluate(fitInPage, renderAd(c, ratio, { logo, lawyer: LAWYER, decoIcon: CONCEPTS[c.code[0]].bizIcon }), RATIOS[ratio], ratio);
        const j = judge(ratio, m);
        qa.push({ id: c.id, code: c.code, file: name, ratio, logo, ...j, k: m.k, kn: m.kn, wrap: m.wrap, lines: m.lines, minText: Math.round(m.minText), styles: m.styles });
        if (!FIT_ONLY) {
          const el = await page.$('#root > .ad');
          const png = path.join(STAGE, `${name}.png`);
          await el.screenshot({ path: png, type: 'png' });
          jobs.push({ src: png, dst: path.join(dir, `${name}.jpg`), kind: 'display', w: RATIOS[ratio].W, h: RATIOS[ratio].H });
        }
        files.push(`${name}.jpg`);
        n++;
      }
    }
    // 비즈보드 (배너 + 배너 제작툴용 오브젝트)
    let subNoLogo = `${PROFILE_NAME} 개인회생 상담`;
    if (!has('no-biz')) {
      const maxW = BIZ.W - BIZ.OBJ_W - BIZ.GAP - BIZ.PAD_L;
      const icon3d = bizIcon(c);
      for (const logo of [true, false]) {
        // 로고 없음 버전은 서브 카피로 광고주체를 표기한다 (카카오 비즈보드 필수)
        const cands = logo ? [c.biz[1]] : [`${PROFILE_NAME} 개인회생 상담`];
        let chosen = cands[cands.length - 1];
        let w = null;
        for (const sub of cands) { w = await page.evaluate(bizInPage, renderBiz(c, { logo, icon3d, sub })); if (w.main <= maxW && w.sub <= maxW) { chosen = sub; break; } }
        w = await page.evaluate(bizInPage, renderBiz(c, { logo, icon3d, sub: chosen }));
        if (!logo) subNoLogo = chosen;
        const errs = [];
        if (w.main > maxW) errs.push(`비즈보드 메인 ${w.main}px > ${maxW}px`);
        if (w.sub > maxW) errs.push(`비즈보드 서브 ${w.sub}px > ${maxW}px`);
        if (Math.max(w.main, w.sub) < 290) errs.push('비즈보드 카피 최소 길이 290px 미만');
        const name = `${pad3(c.id)}_bizboard_1029x258_${logo ? 'logo' : 'nologo'}`;
        qa.push({ id: c.id, code: c.code, file: name, ratio: 'bizboard', logo, errs, warns: [], main: w.main, sub: w.sub });
        if (!FIT_ONLY) {
          await (await page.$('#root > .bz')).screenshot({ path: path.join(dir, `${name}.png`), omitBackground: true });
          jobs.push({ src: path.join(dir, `${name}.png`), kind: 'biz', w: BIZ.W, h: BIZ.H });
          await page.evaluate(bizInPage, renderBizObject({ logo, icon3d }));
          const oname = `${pad3(c.id)}_bizboard_object_315x258_${logo ? 'logo' : 'nologo'}`;
          await (await page.$('#root > .bzo')).screenshot({ path: path.join(dir, `${oname}.png`), omitBackground: true });
          jobs.push({ src: path.join(dir, `${oname}.png`), kind: 'object', w: BIZ.OBJ_W, h: BIZ.H });
          files.push(`${name}.png`, `${oname}.png`);
        }
      }
    }
    if (!FIT_ONLY) fs.writeFileSync(path.join(dir, 'copy.txt'), '\uFEFF' + copySheet(c, subNoLogo, files), 'utf8');
    process.stdout.write(`\r렌더 ${c.code} (${TARGETS.indexOf(c) + 1}/${TARGETS.length})   `);
  }
  await browser.close();

  // 후처리: PNG → JPG(4:4:4, 500KB 미만), 비즈보드 용량·투명도 검사
  if (jobs.length) {
    const jobFile = path.join(STAGE, '_jobs.json');
    fs.writeFileSync(jobFile, JSON.stringify(jobs), 'utf8');
    const out = execFileSync('python', [path.join(__dirname, 'finalize.py'), jobFile], { encoding: 'utf8' });
    const fin = JSON.parse(out.trim().split('\n').pop());
    for (const f of fin.files) {
      const key = path.basename(f.path).replace(/\.(jpg|png)$/, '');
      const row = qa.find((q) => q.file === key);
      if (row) { row.bytes = f.bytes; if (f.err) row.errs.push(f.err); }
    }
  }
  fs.rmSync(STAGE, { recursive: true, force: true });

  const bad = qa.filter((q) => q.errs.length);
  const warn = qa.filter((q) => q.warns.length);
  // --fit-only 는 측정만 한다 (폴더·copy.txt·QA 리포트·목록을 건드리지 않음)
  if (!FIT_ONLY) {
    const qaPath = path.join(OUT, '_qa_report.json');
    const prev = fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, 'utf8')) : [];
    const merged = [...prev.filter((p) => !qa.some((q) => q.file === p.file)), ...qa].sort((a, b) => a.id - b.id || a.file.localeCompare(b.file));
    fs.writeFileSync(qaPath, JSON.stringify(merged, null, 1), 'utf8');
    writeCsv();
    writeIndex();
  }
  console.log(`\n완료: 소재 ${TARGETS.length}종, 이미지 ${n}장(+비즈보드) · 오류 ${bad.length}건 · 경고 ${warn.length}건`);
  for (const q of bad) console.log(`  [오류] ${q.file}: ${q.errs.join(' / ')}`);
  for (const q of warn) console.log(`  [경고] ${q.file}: ${q.warns.join(' / ')}`);
  const wraps = qa.filter((q) => q.wrap && q.logo);
  if (wraps.length) console.log(`  [참고] 헤드라인 자연 줄바꿈(로고 버전 기준): ${wraps.map((q) => q.file.replace(/_(\d+x\d+)_\d+x\d+_logo$/, ':$1')).join(', ')}`);
  if (bad.length) process.exitCode = 1;
}

function writeCsv() {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['번호', '코드', '컨셉', '유형', '레이아웃', '테마', '위험도', '헤드라인', '서브/답', '고지', '타이틀', '타이틀자수', '홍보문구', '홍보문구자수', '소재설명', '비즈보드메인', '비즈보드서브', '폴더', '파일럿', '제작'];
  const rows = CREATIVES.map((c) => {
    const con = CONCEPTS[c.code[0]];
    const made = fs.existsSync(path.join(OUT, dirName(c), `${pad3(c.id)}_1x1_1080x1080_logo.jpg`));
    return [pad3(c.id), c.code, con.name, con.type, c.layout, c.theme, c.risk, plain(c.headline), plain(c.sub || (c.num ? `${c.num.pre} ${c.num.value}${c.num.unit}` : c.stat ? `${c.stat.label} ${c.stat.value}${c.stat.unit}` : (c.checks || c.steps?.map((s) => s[1]) || []).join(' / '))), c.note || '',
      plain(c.title), [...plain(c.title)].length, plain(c.promo), [...plain(c.promo)].length, altText(c), c.biz[0], c.biz[1], dirName(c), PILOT_IDS.includes(c.id) ? 'Y' : '', made ? 'Y' : ''].map(q).join(',');
  });
  fs.writeFileSync(path.join(OUT, '소재목록_100.csv'), '\uFEFF' + [head.map(q).join(','), ...rows].join('\r\n'), 'utf8');
}

function writeIndex() {
  const made = CREATIVES.filter((c) => fs.existsSync(path.join(OUT, dirName(c), `${pad3(c.id)}_1x1_1080x1080_logo.jpg`)));
  const img = (c, f, cls = '') => `<a href="${dirName(c)}/${f}" target="_blank"><img class="${cls}" loading="lazy" src="${dirName(c)}/${f}" alt=""></a>`;
  const block = (c) => {
    const con = CONCEPTS[c.code[0]];
    const set = (v) => ['2x1_1200x600', '1x1_1080x1080', '4x5_1080x1350', '9x16_1080x1920'].map((r) => img(c, `${pad3(c.id)}_${r}_${v}.jpg`, `r${r.split('_')[0]}`)).join('')
      + `<span class="biz">${img(c, `${pad3(c.id)}_bizboard_1029x258_${v}.png`)}</span>`;
    return `<section><h2>${pad3(c.id)} · ${c.code} <small>${con.name} · ${con.type} · 위험도 ${c.risk}</small></h2><p>${plain(c.title)} — ${plain(c.promo)}</p><div class="row"><b>로고</b>${set('logo')}</div><div class="row"><b>로고 없음</b>${set('nologo')}</div></section>`;
  };
  const css = 'body{font-family:system-ui,sans-serif;background:#EEF0F3;margin:0;padding:28px;color:#111}h1{font-size:22px}section{background:#fff;border-radius:16px;padding:18px 20px;margin:0 0 18px}h2{font-size:17px;margin:0 0 4px}h2 small{font-weight:500;color:#555;font-size:13px}p{margin:0 0 10px;color:#444;font-size:13px}.row{display:flex;gap:10px;align-items:flex-end;margin:8px 0;flex-wrap:wrap}.row b{width:70px;font-size:12px;color:#666}img{display:block;height:180px;width:auto;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.15)}.biz{background:#F3F3F3;padding:6px;border-radius:8px}.biz img{height:64px;box-shadow:none}';
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>법무법인 명율 카카오모먼트 소재</title><style>${css}</style></head><body><h1>법무법인 명율 · 카카오모먼트 개인회생 소재 (${made.length}/100종 제작)</h1>${made.map(block).join('')}</body></html>`, 'utf8');
}

main().catch((e) => { console.error(e); process.exit(1); });
