// 카드뉴스 템플릿 엔진 — 1080x1350 (Instagram/Facebook 4:5 세로형)
// 슬라이드 데이터(JSON) → HTML 문자열. 스타일은 buildShellCss()에서 한 번에 정의한다.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';

export const W = 1080;
export const H = 1350;

// ─────────────────────────────────────────────────────────────
// 아이콘 (lucide-react SSR)
// ─────────────────────────────────────────────────────────────
export function hasIcon(name) {
  return Boolean(name && Lucide[name] && typeof Lucide[name] === 'object');
}
export function icon(name, size = 48, strokeWidth = 2, cls = '') {
  const Comp = hasIcon(name) ? Lucide[name] : Lucide.Circle;
  return renderToStaticMarkup(
    createElement(Comp, { size, strokeWidth, className: `ico ${cls}`.trim(), 'aria-hidden': 'true' })
  );
}

// ─────────────────────────────────────────────────────────────
// 텍스트 마크업: **강조**, ==형광펜==, \n 줄바꿈
// ─────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<em class="acc">$1</em>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\n/g, '<br>');
}
export const plain = (s) => String(s ?? '').replace(/\*\*|==/g, '').replace(/\n/g, ' ');
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// ─────────────────────────────────────────────────────────────
// 테마 팔레트 (inner = 본문 슬라이드, cover = 표지·마무리)
// ─────────────────────────────────────────────────────────────
export const THEMES = {
  navy: {
    cover: { bg: 'linear-gradient(160deg,#1E3A5F 0%,#152B47 100%)', fg: '#FFFFFF', sub: '#CBD5E1', acc: '#5EEAD4', hl: 'rgba(94,234,212,.30)', chipbg: 'rgba(255,255,255,.12)', chipfg: '#E2E8F0', deco: 'rgba(255,255,255,.06)' },
    inner: { bg: '#F8FAFC', fg: '#0F172A', sub: '#475569', acc: '#1E3A5F', pt: '#0D9488', card: '#FFFFFF', line: '#E2E8F0', hl: 'rgba(13,148,136,.20)', chipbg: '#E2E8F0', chipfg: '#1E3A5F', deco: 'rgba(30,58,95,.05)' },
  },
  teal: {
    cover: { bg: 'linear-gradient(160deg,#0F766E 0%,#115E59 100%)', fg: '#FFFFFF', sub: '#CCFBF1', acc: '#FDE68A', hl: 'rgba(253,230,138,.32)', chipbg: 'rgba(255,255,255,.14)', chipfg: '#F0FDFA', deco: 'rgba(255,255,255,.07)' },
    inner: { bg: '#F0FDFA', fg: '#0F172A', sub: '#334155', acc: '#0F766E', pt: '#1E3A5F', card: '#FFFFFF', line: '#CCFBF1', hl: 'rgba(15,118,110,.18)', chipbg: '#CCFBF1', chipfg: '#115E59', deco: 'rgba(15,118,110,.06)' },
  },
  white: {
    cover: { bg: '#FFFFFF', fg: '#0F172A', sub: '#475569', acc: '#1E3A5F', hl: 'rgba(13,148,136,.22)', chipbg: '#1E3A5F', chipfg: '#FFFFFF', deco: 'rgba(30,58,95,.05)' },
    inner: { bg: '#FFFFFF', fg: '#0F172A', sub: '#475569', acc: '#1E3A5F', pt: '#0D9488', card: '#F8FAFC', line: '#E2E8F0', hl: 'rgba(13,148,136,.20)', chipbg: '#F1F5F9', chipfg: '#1E3A5F', deco: 'rgba(30,58,95,.04)' },
  },
  dark: {
    cover: { bg: 'linear-gradient(160deg,#0B1220 0%,#111827 100%)', fg: '#F8FAFC', sub: '#CBD5E1', acc: '#FBBF24', hl: 'rgba(251,191,36,.28)', chipbg: 'rgba(251,191,36,.14)', chipfg: '#FDE68A', deco: 'rgba(255,255,255,.05)' },
    inner: { bg: '#111827', fg: '#F1F5F9', sub: '#CBD5E1', acc: '#FBBF24', pt: '#5EEAD4', card: '#1F2937', line: '#334155', hl: 'rgba(251,191,36,.25)', chipbg: '#1F2937', chipfg: '#FDE68A', deco: 'rgba(255,255,255,.04)' },
  },
  cream: {
    cover: { bg: '#F6F1E7', fg: '#1F2937', sub: '#57534E', acc: '#9A3412', hl: 'rgba(217,119,6,.25)', chipbg: '#1F2937', chipfg: '#FEF3C7', deco: 'rgba(154,52,18,.06)' },
    inner: { bg: '#FBF8F2', fg: '#1F2937', sub: '#57534E', acc: '#1E3A5F', pt: '#9A3412', card: '#FFFFFF', line: '#E7E5E4', hl: 'rgba(217,119,6,.22)', chipbg: '#F5EBDD', chipfg: '#9A3412', deco: 'rgba(154,52,18,.05)' },
  },
  sky: {
    cover: { bg: 'linear-gradient(170deg,#DBEAFE 0%,#EFF6FF 100%)', fg: '#0F172A', sub: '#334155', acc: '#1D4ED8', hl: 'rgba(29,78,216,.16)', chipbg: '#1D4ED8', chipfg: '#FFFFFF', deco: 'rgba(29,78,216,.07)' },
    inner: { bg: '#F8FAFC', fg: '#0F172A', sub: '#475569', acc: '#1D4ED8', pt: '#0D9488', card: '#FFFFFF', line: '#DBEAFE', hl: 'rgba(29,78,216,.14)', chipbg: '#DBEAFE', chipfg: '#1E40AF', deco: 'rgba(29,78,216,.05)' },
  },
  coral: {
    cover: { bg: '#FFF1F2', fg: '#111827', sub: '#4B5563', acc: '#BE123C', hl: 'rgba(225,29,72,.16)', chipbg: '#BE123C', chipfg: '#FFFFFF', deco: 'rgba(190,18,60,.06)' },
    inner: { bg: '#FFFFFF', fg: '#111827', sub: '#4B5563', acc: '#BE123C', pt: '#1E3A5F', card: '#FFF7F8', line: '#FFE4E6', hl: 'rgba(225,29,72,.14)', chipbg: '#FFE4E6', chipfg: '#9F1239', deco: 'rgba(190,18,60,.04)' },
  },
  memo: {
    cover: { bg: '#FEF9C3', fg: '#1F2937', sub: '#44403C', acc: '#1E3A5F', hl: 'rgba(13,148,136,.22)', chipbg: '#1F2937', chipfg: '#FEF9C3', deco: 'rgba(31,41,55,.06)' },
    inner: { bg: '#FFFDF2', fg: '#1F2937', sub: '#44403C', acc: '#1E3A5F', pt: '#0F766E', card: '#FFFFFF', line: '#FDE68A', hl: 'rgba(250,204,21,.45)', chipbg: '#FEF3C7', chipfg: '#92400E', deco: 'rgba(31,41,55,.04)' },
  },
};

function varsCss() {
  let out = '';
  for (const [name, t] of Object.entries(THEMES)) {
    const block = (p) =>
      `--bg:${p.bg};--fg:${p.fg};--sub:${p.sub};--acc:${p.acc};--pt:${p.pt || p.acc};--card:${p.card || 'rgba(255,255,255,.08)'};--line:${p.line || 'rgba(255,255,255,.16)'};--hl:${p.hl};--chipbg:${p.chipbg};--chipfg:${p.chipfg};--deco:${p.deco};`;
    out += `.t-${name}{${block(t.inner)}}\n.t-${name}.is-cover{${block(t.cover)}}\n`;
  }
  return out;
}

// S(64) → 자동 축소 배율(--s)을 곱한 px
const S = (n) => `calc(var(--s) * ${n}px)`;

export function buildShellCss(fontUrl) {
  return `
@font-face{font-family:'Pretendard';src:url('${fontUrl}') format('woff2-variations');font-weight:45 920;font-display:block;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:#E5E7EB;}
body{font-family:'Pretendard',system-ui,sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:break-word;}
${varsCss()}
.slide{--s:1;width:${W}px;height:${H}px;position:relative;overflow:hidden;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;padding:72px 88px 64px;letter-spacing:-0.03em;}
.slide > *{position:relative;z-index:2;}
.slide .deco{position:absolute;inset:0;z-index:0;pointer-events:none;}
.ico{display:block;flex:none;}
em.acc{font-style:normal;color:var(--acc);}
mark{background:linear-gradient(transparent 58%,var(--hl) 58%);color:inherit;padding:0 4px;border-radius:4px;}
.top{display:flex;align-items:center;justify-content:space-between;height:56px;flex:none;}
.logo{font-size:34px;font-weight:600;letter-spacing:-0.04em;color:var(--fg);display:flex;align-items:center;gap:10px;}
.logo b{font-weight:900;}
.logo .dot{width:14px;height:14px;border-radius:50%;background:var(--pt);display:inline-block;}
.is-cover .logo .dot{background:var(--acc);}
.cat{font-size:24px;font-weight:700;padding:10px 20px;border-radius:14px;background:var(--chipbg);color:var(--chipfg);white-space:nowrap;}
.bot{display:flex;align-items:center;justify-content:space-between;height:44px;flex:none;font-size:24px;font-weight:600;color:var(--sub);}
.bot .pg{font-variant-numeric:tabular-nums;font-weight:700;}
.bot .swipe{display:flex;align-items:center;gap:10px;color:var(--fg);font-weight:700;}
.content{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:28px 0 24px;overflow:hidden;}
.note{margin-top:${S(28)};font-size:${S(24)};line-height:1.5;color:var(--sub);font-weight:500;}
/* 본문 공통 제목 */
.h-bar{width:56px;height:8px;border-radius:8px;background:var(--pt);margin-bottom:${S(28)};}
.h{font-size:${S(62)};font-weight:800;line-height:1.28;letter-spacing:-0.04em;margin-bottom:${S(44)};}
.kicker{font-size:${S(28)};font-weight:800;color:var(--pt);margin-bottom:${S(16)};letter-spacing:-0.02em;}
.body p{font-size:${S(38)};line-height:1.62;color:var(--sub);font-weight:500;}
.body p + p{margin-top:${S(26)};}
.body p b, .item-d b{color:var(--fg);font-weight:700;}

/* ── COVER ───────────────────────── */
.cv-chip{display:inline-flex;align-self:flex-start;align-items:center;gap:10px;font-size:${S(28)};font-weight:800;padding:12px 22px;border-radius:14px;background:var(--chipbg);color:var(--chipfg);margin-bottom:${S(40)};}
.cv-title{font-size:${S(104)};font-weight:850;line-height:1.2;letter-spacing:-0.05em;}
.cv-sub{margin-top:${S(40)};font-size:${S(38)};line-height:1.55;color:var(--sub);font-weight:500;}
.cv-big{font-size:${S(250)};font-weight:900;line-height:1;letter-spacing:-0.06em;color:var(--acc);margin-bottom:${S(24)};}
.cv-big small{font-size:${S(96)};font-weight:800;margin-left:8px;letter-spacing:-0.04em;}
.cv-q{position:absolute;right:40px;top:120px;font-size:720px;font-weight:900;line-height:1;color:var(--deco);letter-spacing:-0.08em;z-index:1;}
.cv-icon{width:${S(184)};height:${S(184)};border-radius:36px;background:var(--chipbg);color:var(--chipfg);display:flex;align-items:center;justify-content:center;margin-bottom:${S(48)};}
.cv-icon .ico{width:${S(96)};height:${S(96)};}
.cover-headline .content, .cover-number .content, .cover-question .content, .cover-icon .content{justify-content:flex-end;padding-bottom:64px;}
.cover-split{padding:0;}
.cover-split .split-top{background:var(--bg);color:var(--fg);padding:72px 88px 72px;height:880px;display:flex;flex-direction:column;}
.cover-split .split-bot{flex:1;background:#FFFFFF;color:#0F172A;padding:56px 88px 64px;display:flex;flex-direction:column;justify-content:space-between;}
.cover-split .split-bot .cv-sub{margin-top:0;color:#334155;}
.cover-split .split-bot .bot{color:#475569;}
.cover-split .split-bot .bot .swipe{color:#0F172A;}
.cover-list{margin-top:${S(44)};display:flex;flex-direction:column;gap:${S(18)};}
.cover-list div{display:flex;align-items:center;gap:18px;font-size:${S(34)};font-weight:700;color:var(--fg);opacity:.92;}
.cover-list .ico{color:var(--acc);}

/* ── LIST / STEPS / CHECK ────────── */
.items{display:flex;flex-direction:column;}
.item{display:flex;gap:${S(30)};align-items:flex-start;padding:${S(28)} 0;border-top:2px solid var(--line);}
.item:first-child{border-top:none;padding-top:0;}
.num{flex:none;width:${S(68)};height:${S(68)};border-radius:50%;background:var(--acc);color:var(--bg);font-size:${S(32)};font-weight:800;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;}
.t-dark .num{color:#111827;}
.item-ic{flex:none;width:${S(68)};height:${S(68)};border-radius:20px;background:var(--chipbg);color:var(--pt);display:flex;align-items:center;justify-content:center;}
.item-ic .ico{width:${S(38)};height:${S(38)};}
.item-t{font-size:${S(40)};font-weight:800;line-height:1.35;}
.item-d{margin-top:${S(10)};font-size:${S(31)};line-height:1.55;color:var(--sub);font-weight:500;}
.check .item{align-items:center;}
.check .item-t{font-weight:700;font-size:${S(38)};}
.chk{flex:none;color:var(--pt);}
.chk .ico{width:${S(54)};height:${S(54)};}
.steps{position:relative;display:flex;flex-direction:column;gap:${S(34)};}
.step{display:flex;gap:${S(30)};position:relative;}
.step:not(:last-child)::after{content:'';position:absolute;left:calc(var(--s) * 33px);top:calc(var(--s) * 76px);bottom:calc(var(--s) * -30px);width:3px;background:var(--line);}
.step .num{background:var(--bg);color:var(--acc);border:4px solid var(--acc);}
.step:last-child .num{background:var(--acc);color:var(--bg);}
.t-dark .step:last-child .num{color:#111827;}

/* ── OX ──────────────────────────── */
.ox{display:flex;flex-direction:column;gap:${S(36)};}
.ox-row{display:flex;gap:${S(30)};align-items:flex-start;}
.ox-b{flex:none;width:${S(92)};height:${S(92)};border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:${S(54)};font-weight:900;color:#fff;}
.ox-b.o{background:#0F766E;} .ox-b.x{background:#BE123C;}
.ox-q{font-size:${S(40)};font-weight:800;line-height:1.35;}
.ox-d{margin-top:${S(12)};font-size:${S(31)};line-height:1.55;color:var(--sub);font-weight:500;}
.ox-single .ox-b{width:${S(150)};height:${S(150)};font-size:${S(92)};border-radius:36px;margin-bottom:${S(36)};}
.ox-single .ox-q{font-size:${S(54)};}
.ox-single .ox-d{font-size:${S(36)};margin-top:${S(24)};}

/* ── COMPARE ─────────────────────── */
.cmp{border-radius:28px;overflow:hidden;border:2px solid var(--line);background:var(--card);}
.cmp-r{display:grid;border-top:2px solid var(--line);}
.cmp-r:first-child{border-top:none;}
.cmp-c{padding:${S(24)} ${S(22)};font-size:${S(29)};line-height:1.45;font-weight:600;}
.cmp-c + .cmp-c{border-left:2px solid var(--line);}
.cmp-h .cmp-c{font-size:${S(32)};font-weight:800;color:#fff;text-align:center;}
.cmp-h .cmp-c.a{background:var(--acc);} .cmp-h .cmp-c.b{background:var(--pt);} .cmp-h .cmp-c.l{background:transparent;}
.t-dark .cmp-h .cmp-c{color:#111827;}
.cmp-c.l{font-weight:800;color:var(--sub);font-size:${S(27)};}

/* ── Q&A ─────────────────────────── */
.qa-q{display:flex;gap:${S(24)};align-items:flex-start;margin-bottom:${S(44)};}
.qa-mark{flex:none;font-size:${S(84)};font-weight:900;line-height:1;color:var(--acc);letter-spacing:-0.06em;}
.qa-qt{font-size:${S(54)};font-weight:800;line-height:1.32;padding-top:${S(8)};}
.qa-a{border-radius:28px;background:var(--card);border:2px solid var(--line);padding:${S(44)} ${S(44)};display:flex;gap:${S(24)};}
.qa-a .qa-mark{color:var(--pt);font-size:${S(64)};}
.qa-a .body p{font-size:${S(34)};}

/* ── CHAT ────────────────────────── */
.chat{border-radius:36px;background:var(--card);border:2px solid var(--line);overflow:hidden;}
.chat-top{display:flex;justify-content:space-between;align-items:center;padding:${S(24)} ${S(36)};border-bottom:2px solid var(--line);font-size:${S(26)};font-weight:700;color:var(--sub);}
.chat-top .tag{font-size:${S(22)};padding:6px 14px;border-radius:12px;background:var(--chipbg);color:var(--chipfg);}
.chat-body{padding:${S(36)};display:flex;flex-direction:column;gap:${S(22)};}
.msg{max-width:82%;display:flex;flex-direction:column;gap:6px;}
.msg .who{font-size:${S(22)};font-weight:700;color:var(--sub);}
.msg .bub{font-size:${S(31)};line-height:1.5;padding:${S(22)} ${S(28)};border-radius:28px;font-weight:500;}
.msg.l{align-self:flex-start;} .msg.l .bub{background:var(--bg);border:2px solid var(--line);border-top-left-radius:8px;}
.msg.r{align-self:flex-end;align-items:flex-end;} .msg.r .bub{background:var(--acc);color:#fff;border-top-right-radius:8px;}
.t-dark .msg.r .bub{color:#111827;}

/* ── STAT ────────────────────────── */
.stat-big{font-size:${S(210)};font-weight:900;line-height:1;letter-spacing:-0.06em;color:var(--acc);}
.stat-big small{font-size:${S(80)};font-weight:800;margin-left:6px;letter-spacing:-0.03em;}
.stat .h{margin-top:${S(36)};margin-bottom:${S(28)};font-size:${S(56)};}

/* ── TIP / WARN / QUOTE ─────────── */
.box{border-radius:28px;background:var(--card);border:2px solid var(--line);padding:${S(52)} ${S(48)};position:relative;}
.box-lab{display:inline-flex;align-items:center;gap:12px;font-size:${S(28)};font-weight:800;color:var(--pt);margin-bottom:${S(24)};}
.box-lab .ico{width:${S(40)};height:${S(40)};}
.box .h{font-size:${S(52)};margin-bottom:${S(26)};}
.box.warn{border-color:#FDA4AF;background:#FFF1F2;color:#111827;}
.box.warn .box-lab{color:#BE123C;}
.box.warn .body p, .box.warn .item-t{color:#1F2937;}
.box.warn .item{border-top-color:#FECDD3;}
.warn-list .item-t{font-size:${S(34)};font-weight:700;}
.warn-list .dotb{flex:none;width:14px;height:14px;border-radius:50%;background:#BE123C;margin-top:${S(20)};}
.quote-mark{font-size:${S(220)};line-height:.7;font-weight:900;color:var(--acc);opacity:.9;height:${S(110)};}
.quote-t{font-size:${S(50)};font-weight:700;line-height:1.5;letter-spacing:-0.035em;}
.quote-by{margin-top:${S(36)};font-size:${S(30)};font-weight:700;color:var(--sub);}
.sample{display:inline-block;align-self:flex-start;margin-top:${S(24)};font-size:${S(22)};font-weight:700;color:var(--sub);padding:6px 14px;border-radius:12px;border:2px solid var(--line);}

/* ── GLOSSARY ───────────────────── */
.gl .item-t{color:var(--acc);}

/* ── CTA ─────────────────────────── */
.cta .content{justify-content:center;}
.cta-logo{font-size:${S(52)};font-weight:600;letter-spacing:-0.04em;margin-bottom:${S(44)};display:flex;align-items:center;gap:14px;}
.cta-logo b{font-weight:900;}
.cta-logo .dot{width:20px;height:20px;border-radius:50%;background:var(--acc);}
.cta-title{font-size:${S(84)};font-weight:850;line-height:1.24;letter-spacing:-0.05em;margin-bottom:${S(52)};}
.cta-pts{display:flex;flex-direction:column;gap:${S(24)};margin-bottom:${S(56)};}
.cta-pt{display:flex;align-items:center;gap:${S(22)};font-size:${S(34)};font-weight:600;line-height:1.4;}
.cta-pt .ico{color:var(--acc);width:${S(44)};height:${S(44)};}
.cta-btn{align-self:flex-start;display:inline-flex;align-items:center;gap:16px;white-space:nowrap;font-size:${S(36)};font-weight:800;padding:${S(28)} ${S(44)};border-radius:20px;background:var(--acc);color:#0F172A;}
.t-white.is-cover .cta-btn, .t-sky.is-cover .cta-btn, .t-coral.is-cover .cta-btn, .t-cream.is-cover .cta-btn, .t-memo.is-cover .cta-btn{color:#FFFFFF;}
.cta-disc{margin-top:${S(48)};font-size:${S(22)};line-height:1.55;color:var(--sub);font-weight:500;}

/* ── 장식 ───────────────────────── */
.dz-circles::before{content:'';position:absolute;width:760px;height:760px;border-radius:50%;right:-300px;top:-260px;background:var(--deco);}
.dz-circles::after{content:'';position:absolute;width:420px;height:420px;border-radius:50%;left:-160px;bottom:220px;background:var(--deco);}
.dz-grid{background-image:radial-gradient(var(--deco) 3px,transparent 3px);background-size:44px 44px;}
.dz-bar::before{content:'';position:absolute;left:0;top:0;bottom:0;width:18px;background:var(--acc);}
.dz-ring::before{content:'';position:absolute;width:640px;height:640px;border-radius:50%;right:-220px;bottom:-200px;border:90px solid var(--deco);}
.dz-corner::before{content:'';position:absolute;right:0;top:0;width:360px;height:360px;background:var(--deco);border-bottom-left-radius:360px;}
`;
}

// ─────────────────────────────────────────────────────────────
// 슬라이드 조각
// ─────────────────────────────────────────────────────────────
function chrome({ category, page, total, isCover }) {
  const top = `<header class="top"><span class="logo"><span class="dot"></span>my<b>김변</b></span><span class="cat">${esc(category)}</span></header>`;
  const bot = isCover
    ? `<footer class="bot"><span>mykim.kr</span><span class="swipe">옆으로 넘겨보세요 ${icon('ArrowRight', 30, 2.5)}</span></footer>`
    : `<footer class="bot"><span>mykim.kr</span><span class="pg">${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></footer>`;
  return { top, bot };
}

const noteHtml = (n) => (n ? `<p class="note">※ ${md(n)}</p>` : '');
const titleHtml = (s) => (s.title ? `<div class="h-bar"></div><h2 class="h">${md(s.title)}</h2>` : '');
const bodyHtml = (b) => `<div class="body">${arr(b).map((p) => `<p>${md(p)}</p>`).join('')}</div>`;

const DECOS = ['dz-circles', 'dz-grid', 'dz-ring', 'dz-corner', 'dz-bar'];

function renderCover(post, ctx) {
  const c = post.cover;
  const style = c.style || 'headline';
  const chip = `<span class="cv-chip">${c.icon && style !== 'icon' ? icon(c.icon, 30, 2.5) : ''}${esc(c.tag || post.category)}</span>`;
  const title = `<h1 class="cv-title">${md(c.title)}</h1>`;
  const sub = c.sub ? `<p class="cv-sub">${md(c.sub)}</p>` : '';
  const preview = c.preview?.length
    ? `<div class="cover-list">${c.preview.map((p) => `<div>${icon('CircleCheck', 40, 2.4)}${md(p)}</div>`).join('')}</div>`
    : '';
  const deco = DECOS[(post.id * 7) % DECOS.length];

  if (style === 'split') {
    return `<div class="slide t-${post.theme} is-cover cover-split">
      <div class="deco ${deco}" style="height:880px;"></div>
      <div class="split-top">${ctx.top}<main class="content" style="justify-content:flex-end;">${chip}${title}</main></div>
      <div class="split-bot">${sub || '<span></span>'}${ctx.bot}</div>
    </div>`;
  }
  let inner = '';
  if (style === 'number') inner = `<div class="cv-big">${md(c.big)}${c.unit ? `<small>${esc(c.unit)}</small>` : ''}</div>${chip}${title}${sub}`;
  else if (style === 'question') inner = `${chip}${title}${sub}${preview}`;
  else if (style === 'icon') inner = `<div class="cv-icon">${icon(c.icon || 'Scale', 96, 2)}</div>${chip}${title}${sub}${preview}`;
  else inner = `${chip}${title}${sub}${preview}`;
  const qBg = style === 'question' ? `<div class="cv-q">Q</div>` : '';
  return `<div class="slide t-${post.theme} is-cover cover-${style}">
    <div class="deco ${style === 'question' ? '' : deco}"></div>${qBg}
    ${ctx.top}<main class="content">${inner}</main>${ctx.bot}
  </div>`;
}

const R = {
  text: (s) => `${s.kicker ? `<div class="kicker">${md(s.kicker)}</div>` : ''}${titleHtml(s)}${bodyHtml(s.body)}${noteHtml(s.note)}`,

  list: (s) => {
    const items = s.items
      .map((it, i) => {
        const lead = it.icon ? `<div class="item-ic">${icon(it.icon, 38, 2.2)}</div>` : `<div class="num">${i + 1}</div>`;
        return `<div class="item">${lead}<div><div class="item-t">${md(it.t)}</div>${it.d ? `<div class="item-d">${md(it.d)}</div>` : ''}</div></div>`;
      })
      .join('');
    return `${titleHtml(s)}<div class="items">${items}</div>${noteHtml(s.note)}`;
  },

  check: (s) => {
    const items = s.items
      .map((it) => {
        const t = typeof it === 'string' ? { t: it } : it;
        return `<div class="item"><span class="chk">${icon('SquareCheckBig', 54, 2.3)}</span><div><div class="item-t">${md(t.t)}</div>${t.d ? `<div class="item-d">${md(t.d)}</div>` : ''}</div></div>`;
      })
      .join('');
    return `${titleHtml(s)}<div class="items check">${items}</div>${noteHtml(s.note)}`;
  },

  steps: (s) => {
    const steps = s.steps
      .map((it, i) => `<div class="step"><div class="num">${i + 1}</div><div><div class="item-t">${md(it.t)}</div>${it.d ? `<div class="item-d">${md(it.d)}</div>` : ''}</div></div>`)
      .join('');
    return `${titleHtml(s)}<div class="steps">${steps}</div>${noteHtml(s.note)}`;
  },

  ox: (s) => {
    const single = s.items.length === 1;
    const rows = s.items
      .map((it) => {
        const o = String(it.a).toUpperCase() === 'O';
        const badge = `<div class="ox-b ${o ? 'o' : 'x'}">${o ? 'O' : 'X'}</div>`;
        return single
          ? `<div>${badge}<div class="ox-q">${md(it.q)}</div>${it.d ? `<div class="ox-d">${md(it.d)}</div>` : ''}</div>`
          : `<div class="ox-row">${badge}<div><div class="ox-q">${md(it.q)}</div>${it.d ? `<div class="ox-d">${md(it.d)}</div>` : ''}</div></div>`;
      })
      .join('');
    return `${titleHtml(s)}<div class="ox ${single ? 'ox-single' : ''}">${rows}</div>${noteHtml(s.note)}`;
  },

  compare: (s) => {
    const hasLabel = s.rows.some((r) => r.length === 3);
    const cols = hasLabel ? '0.78fr 1fr 1fr' : '1fr 1fr';
    const head = `<div class="cmp-r cmp-h" style="grid-template-columns:${cols}">${hasLabel ? '<div class="cmp-c l"></div>' : ''}<div class="cmp-c a">${md(s.cols[0])}</div><div class="cmp-c b">${md(s.cols[1])}</div></div>`;
    const rows = s.rows
      .map((r) => {
        const cells = hasLabel ? r : ['', ...r];
        return `<div class="cmp-r" style="grid-template-columns:${cols}">${hasLabel ? `<div class="cmp-c l">${md(cells[0])}</div>` : ''}<div class="cmp-c">${md(cells[1])}</div><div class="cmp-c">${md(cells[2])}</div></div>`;
      })
      .join('');
    return `${titleHtml(s)}<div class="cmp">${head}${rows}</div>${noteHtml(s.note)}`;
  },

  qa: (s) =>
    `<div class="qa-q"><span class="qa-mark">Q.</span><div class="qa-qt">${md(s.q)}</div></div>
     <div class="qa-a"><span class="qa-mark">A.</span>${bodyHtml(s.a)}</div>${noteHtml(s.note)}`,

  chat: (s) => {
    const msgs = s.msgs
      .map((m) => {
        const side = m.from === 'r' || m.from === 'right' ? 'r' : 'l';
        return `<div class="msg ${side}">${m.name ? `<span class="who">${esc(m.name)}</span>` : ''}<div class="bub">${md(m.text)}</div></div>`;
      })
      .join('');
    return `${titleHtml(s)}<div class="chat"><div class="chat-top"><span>${esc(s.header || '메시지')}</span><span class="tag">이해를 돕기 위한 예시</span></div><div class="chat-body">${msgs}</div></div>${noteHtml(s.note)}`;
  },

  stat: (s) =>
    `<div class="stat">${s.kicker ? `<div class="kicker">${md(s.kicker)}</div>` : ''}<div class="stat-big">${md(s.big)}${s.unit ? `<small>${esc(s.unit)}</small>` : ''}</div><h2 class="h">${md(s.title)}</h2>${bodyHtml(s.body)}</div>${noteHtml(s.note)}`,

  tip: (s) =>
    `<div class="box"><div class="box-lab">${icon(s.icon || 'Lightbulb', 40, 2.3)}${esc(s.label || '핵심 포인트')}</div>${s.title ? `<h2 class="h">${md(s.title)}</h2>` : ''}${bodyHtml(s.body)}</div>${noteHtml(s.note)}`,

  warn: (s) => {
    const inner = s.items
      ? `<div class="items warn-list">${s.items.map((t) => `<div class="item"><span class="dotb"></span><div class="item-t">${md(t)}</div></div>`).join('')}</div>`
      : bodyHtml(s.body);
    return `<div class="box warn"><div class="box-lab">${icon('TriangleAlert', 40, 2.3)}${esc(s.label || '이것만은 주의')}</div>${s.title ? `<h2 class="h">${md(s.title)}</h2>` : ''}${inner}</div>${noteHtml(s.note)}`;
  },

  glossary: (s) => {
    const items = s.terms
      .map((it) => `<div class="item"><div><div class="item-t">${md(it.t)}</div><div class="item-d">${md(it.d)}</div></div></div>`)
      .join('');
    return `${titleHtml(s)}<div class="items gl">${items}</div>${noteHtml(s.note)}`;
  },

  quote: (s) =>
    `<div class="quote-mark">“</div><div class="quote-t">${md(s.text)}</div>${s.by ? `<div class="quote-by">${md(s.by)}</div>` : ''}<span class="sample">이해를 돕기 위한 가상 예시입니다</span>${noteHtml(s.note)}`,
};

export const SLIDE_TYPES = Object.keys(R);

// ─────────────────────────────────────────────────────────────
// 마무리(CTA) 슬라이드 — 마이김변 홍보. 문구는 실제 기능 사실만 사용.
// ─────────────────────────────────────────────────────────────
export const CTA_VARIANTS = {
  check: {
    btn: 'mykim.kr/check 익명 채무 체크',
    title: '내 채무 상황부터\n**정리해 보세요**',
    pts: [['ClipboardList', '익명 채무 체크로 현재 상황 정리'], ['GitCompare', '회생·파산·채무조정 해결 경로 비교'], ['Info', '결과는 참고용, 인가·면책은 법원이 판단']],
  },
  anon: {
    btn: 'mykim.kr 에서 가명으로 상담 요청',
    title: '이름·번호 없이\n**먼저 물어보세요**',
    pts: [['UserRoundX', '스텔스 가명으로 상담 요청'], ['PhoneOff', '010 번호 없이 시작'], ['Lock', '실명·연락처는 계약 전까지 비공개']],
  },
  compare: {
    btn: 'mykim.kr 에서 변호사 프로필 보기',
    title: '변호사는\n**직접 보고 고르세요**',
    pts: [['IdCard', '변호사 프로필을 먼저 확인'], ['Users', '최대 3명에게 한 번에 상담 요청'], ['MessagesSquare', '답변 비교 후 원할 때만 진행']],
  },
  docs: {
    btn: 'mykim.kr 에서 서류 준비 시작',
    title: '서류·진술서 준비,\n**혼자 끙끙대지 마세요**',
    pts: [['Mic', 'AI 음성 진술서로 초안 작성 보조'], ['FolderOpen', '서류 허브에서 제출 서류 한곳에 정리'], ['UserCheck', '최종 검토는 선택한 변호사가']],
  },
  contract: {
    btn: 'mykim.kr 에서 상담 요청하기',
    title: '사무실 안 가도\n**상담부터 계약까지**',
    pts: [['MessageCircle', '상담방에서 편한 시간에 대화'], ['PenLine', '모바일 전자서명으로 계약'], ['Fingerprint', '전자지문(해시)으로 원본 확인']],
  },
  companion: {
    btn: 'mykim.kr 회생동행 알아보기',
    title: '인가 후 변제기간,\n**납부일 놓치지 않게**',
    pts: [['CalendarClock', '회생동행 캘린더로 다음 변제일 확인'], ['BellRing', '납부 기록이 없으면 미납 경고'], ['ListChecks', '회차별 납부 기록을 한곳에']],
  },
  fee: {
    btn: 'mykim.kr 에서 수임료 조건 확인',
    title: '비용도 미리\n**확인하고 선택하세요**',
    pts: [['Wallet', '상담 요청 단계 플랫폼 이용료 0원'], ['Filter', '수임료 분납 가능 변호사 필터'], ['Handshake', '금액은 선택한 법률사무소와 직접 협의']],
  },
};
const DISCLAIMER =
  '마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 법률사무소가 수행합니다. 회생·파산 인가와 면책 여부는 법원이 사건별로 판단합니다.';

function renderCta(post, ctx) {
  const v = CTA_VARIANTS[post.cta] || CTA_VARIANTS.check;
  const title = post.ctaTitle || v.title;
  const pts = v.pts.map(([ic, t]) => `<div class="cta-pt">${icon(ic, 44, 2.3)}<span>${md(t)}</span></div>`).join('');
  return `<div class="slide t-${post.theme} is-cover cta">
    <div class="deco dz-circles"></div>
    ${ctx.top}
    <main class="content">
      <h2 class="cta-title">${md(title)}</h2>
      <div class="cta-pts">${pts}</div>
      <div class="cta-btn">${esc(v.btn)} ${icon('ArrowRight', 36, 2.6)}</div>
      <p class="cta-disc">${DISCLAIMER}</p>
    </main>
    ${ctx.bot}
  </div>`;
}

/** 포스트 하나 → 슬라이드 HTML 배열 (표지 + 본문 + CTA) */
export function renderPost(post) {
  const total = post.slides.length + 2;
  const out = [];
  out.push(renderCover(post, chrome({ category: post.category, page: 1, total, isCover: true })));
  post.slides.forEach((s, i) => {
    const ctx = chrome({ category: post.category, page: i + 2, total });
    const fn = R[s.type];
    const deco = i % 3 === 1 ? `<div class="deco dz-grid" style="opacity:.6"></div>` : '';
    out.push(`<div class="slide t-${post.theme} k-${s.type}">${deco}${ctx.top}<main class="content">${fn(s)}</main>${ctx.bot}</div>`);
  });
  out.push(renderCta(post, chrome({ category: post.category, page: total, total })));
  return out;
}

/** 스키마 검증 — 문제 목록 반환 */
export function validatePost(p) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };
  need(Number.isInteger(p.id), 'id');
  need(/^[a-z0-9-]+$/.test(p.slug || ''), 'slug 형식');
  need(p.category, 'category');
  need(THEMES[p.theme], `theme(${p.theme})`);
  need(p.cover?.title, 'cover.title');
  need(!p.cover?.style || ['headline', 'number', 'question', 'split', 'icon'].includes(p.cover.style), `cover.style(${p.cover?.style})`);
  if (p.cover?.style === 'number') need(p.cover.big, 'cover.big');
  if (p.cover?.icon) need(hasIcon(p.cover.icon), `cover.icon(${p.cover.icon})`);
  need(!p.cta || CTA_VARIANTS[p.cta], `cta(${p.cta})`);
  need(Array.isArray(p.slides) && p.slides.length >= 3 && p.slides.length <= 7, 'slides 3~7개');
  (p.slides || []).forEach((s, i) => {
    const at = `slides[${i}]`;
    need(R[s.type], `${at}.type(${s.type})`);
    if (s.type === 'list') { need(s.items?.length >= 2 && s.items.length <= 5, `${at} list items 2~5`); s.items?.forEach((it) => it.icon && need(hasIcon(it.icon), `${at} icon(${it.icon})`)); }
    if (s.type === 'check') need(s.items?.length >= 2 && s.items.length <= 6, `${at} check items 2~6`);
    if (s.type === 'steps') need(s.steps?.length >= 2 && s.steps.length <= 5, `${at} steps 2~5`);
    if (s.type === 'ox') need(s.items?.length >= 1 && s.items.length <= 3, `${at} ox items 1~3`);
    if (s.type === 'compare') need(s.cols?.length === 2 && s.rows?.length >= 2 && s.rows.length <= 6, `${at} compare`);
    if (s.type === 'qa') need(s.q && s.a, `${at} qa`);
    if (s.type === 'chat') need(s.msgs?.length >= 2 && s.msgs.length <= 6, `${at} chat msgs 2~6`);
    if (s.type === 'stat') need(s.big && s.title, `${at} stat`);
    if (s.type === 'glossary') need(s.terms?.length >= 2 && s.terms.length <= 5, `${at} glossary`);
    if (s.type === 'quote') need(s.text, `${at} quote`);
    if (s.type === 'warn') need(s.items || s.body, `${at} warn`);
    if (s.icon) need(hasIcon(s.icon), `${at} icon(${s.icon})`);
  });
  need(p.caption && p.caption.length >= 80, 'caption 80자 이상');
  need(Array.isArray(p.hashtags) && p.hashtags.length >= 5 && p.hashtags.length <= 15, 'hashtags 5~15');
  return errs;
}

/** 규정 검사용 평문 추출 */
export function postText(p) {
  const bits = [p.cover?.title, p.cover?.sub, p.cover?.big, ...(p.cover?.preview || []), p.caption];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') bits.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'type' && k !== 'icon' && k !== 'from' && walk(x));
  };
  walk(p.slides);
  return bits.filter(Boolean).map(plain).join('\n');
}
