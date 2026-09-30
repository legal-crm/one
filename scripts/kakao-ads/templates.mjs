// 카카오모먼트 광고 템플릿 엔진 — 소재 데이터 → HTML (셸 페이지 _src/_shell.html 기준 상대경로)
// 규격 근거: 카카오 비즈니스 가이드 > 디스플레이 광고 제작 가이드, 카카오 비즈보드 제작 가이드

// 비율별 캔버스·세이프존·글자 크기 (px). min=일반 텍스트 최소, nmin=법적 고지 최소
export const RATIOS = {
  '2x1': { W: 1200, H: 600, label: '2x1_1200x600', min: 48, nmin: 24, max: 164, safe: { t: 40, r: 40, b: 90, l: 40 }, lines: 3 },
  '1x1': { W: 1080, H: 1080, label: '1x1_1080x1080', min: 44, nmin: 24, max: 150, safe: { t: 40, r: 40, b: 40, l: 40 } },
  '4x5': { W: 1080, H: 1350, label: '4x5_1080x1350', min: 65, nmin: 33, max: 221, safe: { t: 135, r: 40, b: 135, l: 54 } },
  '9x16': { W: 1080, H: 1920, label: '9x16_1080x1920', min: 58, nmin: 36, max: 246, safe: { t: 134, r: 71, b: 134, l: 71 }, rec: { t: 419, b: 657 } },
};
export const BIZ = { W: 1029, H: 258, OBJ_W: 315, PAD_L: 48, GAP: 33, MAIN: 48, SUB: 39 };

// 테마: 배경·본문·포인트·보조 색 (텍스트 스타일은 본문 굵게 / 포인트 굵게 / 보조 보통 3종으로 제한)
export const THEMES = {
  navy: { bg: 'linear-gradient(160deg,#12234A 0%,#0B1631 100%)', fg: '#FFFFFF', acc: '#F2C66D', sub: '#C9D2E3', orb: 'rgba(255,255,255,.055)', o: '#7FE0B8', x: '#FF8A80', dark: 1 },
  charcoal: { bg: 'linear-gradient(160deg,#23262D 0%,#15171B 100%)', fg: '#FFFFFF', acc: '#FFC857', sub: '#C4C9D2', orb: 'rgba(255,255,255,.05)', o: '#7FE0B8', x: '#FF8A80', dark: 1 },
  night: { bg: 'linear-gradient(180deg,#0B1230 0%,#1C2656 100%)', fg: '#F5F7FF', acc: '#F6D48B', sub: '#C7CDEA', orb: 'rgba(255,255,255,.06)', o: '#7FE0B8', x: '#FF8A80', dark: 1 },
  blue: { bg: 'linear-gradient(160deg,#2463EB 0%,#1846C4 100%)', fg: '#FFFFFF', acc: '#FFD877', sub: '#DDE7FF', orb: 'rgba(255,255,255,.09)', o: '#8EF0C4', x: '#FFB4A8', dark: 1 },
  teal: { bg: 'linear-gradient(160deg,#115650 0%,#0A3B37 100%)', fg: '#FFFFFF', acc: '#F4D38C', sub: '#CBE6E1', orb: 'rgba(255,255,255,.065)', o: '#9BF0CF', x: '#FF9C8F', dark: 1 },
  white: { bg: 'linear-gradient(180deg,#FFFFFF 0%,#F4F6F9 100%)', fg: '#111827', acc: '#D9434A', sub: '#4B5563', orb: '#EEF1F5', o: '#0E9F6E', x: '#D9434A', dark: 0 },
  ivory: { bg: 'linear-gradient(170deg,#FBF7EF 0%,#F2EADB 100%)', fg: '#1C2230', acc: '#1F4E9C', sub: '#585E6A', orb: 'rgba(31,78,156,.06)', o: '#0E8A63', x: '#C8413F', dark: 0 },
  sand: { bg: 'linear-gradient(170deg,#F4EBDD 0%,#E9DBC6 100%)', fg: '#2A231D', acc: '#B0431F', sub: '#5E5349', orb: 'rgba(255,255,255,.45)', o: '#1B7F5A', x: '#B0431F', dark: 0 },
  peach: { bg: 'linear-gradient(170deg,#FFEEE2 0%,#FFDCC7 100%)', fg: '#2B1D14', acc: '#D0461E', sub: '#654D40', orb: 'rgba(255,255,255,.55)', o: '#1B7F5A', x: '#D0461E', dark: 0 },
  mint: { bg: 'linear-gradient(170deg,#EAF6F0 0%,#D5EEE2 100%)', fg: '#10302A', acc: '#0D7656', sub: '#3E5E55', orb: 'rgba(255,255,255,.6)', o: '#0D7656', x: '#C8413F', dark: 0 },
};

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
export const plain = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\s*\|\s*/g, ' ').replace(/\n/g, ' ');

// ── 한국어 줄바꿈 다듬기 (서브·답·고지·체크 문구) ──
// keep-all 만 쓰면 '신청할 수 / 있습니다', '검토해 볼 / 때입니다'처럼 끊긴다.
// 의존명사·단위·보조용언은 앞말에, 1음절 관형사·부사는 뒷말에 붙여(줄바꿈 없는 공백) 덩어리로 묶고
// 덩어리 사이에서만 줄을 바꾼다. 줄 길이는 CSS text-wrap:balance 로 고르게 맞춘다.
// 카피에 '|' 를 넣으면 그 자리에서만 줄을 바꾼다 (수동 지정, 화면에는 공백으로 표시).
const PRE1 = new Set('또 빚 월 총 약 안 못 더 꼭 잘 왜 내 그 이 저 각 제 첫 한 두 세 네 몇 매 온 좀 딱 늘 곧 참 다 집 돈 옛'.split(' '));
const DEP = '수|것|거|때|줄|뿐|데|등|중|적|전|후|채|척|듯|번|건|원|곳|분|쪽|째|씩|쯤|만큼|대로|동안|정도|이상|이하|이내|미만|초과|가량|무렵|이후|이전|만에';
const JOSA = '(?:은|는|이|가|을|를|도|만|에|의|로|와|과|인|에서|에게|에도|에는|부터|까지|이면|이라면|이어도|이라도|입니다|이다|이죠|인가요|일까요?|예요|이에요|이지만|인데|이고|으로|으로도|로도|이나|나|이라|이란)?';
const POST_RE = new RegExp(`^(?:${DEP})${JOSA}[.,?!…)]*$`);
const AUX_RE = /^(?:보세요|봅니다|보기|볼|봐|봐요|봐야|보면|보고|보는|보셔도|보십시오|드립니다|드려요|드릴게요|드려|드리는|주세요|줍니다|있습니다|없습니다|있어요|없어요|있다|없다|있나요|없나요|있을까요?|있고|없고|있는|없는|있으면|없으면|있어도|없어도|않습니다|않아요|않는|않고|않아도|않나요|않다|않게|않으면|됩니다|돼요|된다|됩니까|되나요|될까요?)[.,?!…]*$/;
const MAX_GROUP = 9; // 한 덩어리 최대 폭 (한글 1음절 = 1, 숫자·영문 = 0.6)
const syl = (w) => (w.match(/[\uAC00-\uD7A3]/g) || []).length + (w.match(/[A-Za-z0-9]/g) || []).length * 0.6;
const core = (w) => w.replace(/\*\*/g, '').replace(/^[("'“‘]+/, '');
const TIME_END = /\d(?:년|달|개월|주|일|시간|분)$/;
// a(앞말)와 b(뒷말) 사이에서 줄을 바꾸면 안 되는가
function glued(a, b, isLast) {
  if (/[,.!?…:]$/.test(a)) return false; // 쉼표·마침표 뒤는 자연스러운 끊김
  if (/^[−+=×÷~]$/.test(a) || /^[−+=×÷~]$/.test(b)) return true; // '소득 − 생계비' 는 한 덩어리
  if (a === '→') return true; // 화살표는 줄 끝에 남기지 않는다
  if (/^\d+인$/.test(a)) return true; // '1인 가구'
  if (/\d[만억천]$/.test(a) && /^\d/.test(b)) return true; // '8만 1,723건'
  if (/^\(?제\d+(?:조|항|호)/.test(b)) return true; // '채무자회생법 제579조'
  if (b === '새') return TIME_END.test(a); // '10년 새' (사이) / '새 출발' (관형사)
  if (a === '새') return !TIME_END.test(ws_prev(a));
  if (syl(a) === 1 && PRE1.has(a)) return true; // '또 빚', '월 소득', '한 번'
  if (POST_RE.test(b) || AUX_RE.test(b)) return true; // '할 수', '볼 때입니다', '방법이 있습니다'
  if (syl(b) === 1 && (!PRE1.has(b) || isLast)) return true; // 1음절 단위·의존명사, 끝에 홀로 남는 1음절
  return false;
}
const ws_prev = () => ''; // '새' 가 관형사로 쓰일 때는 앞말과 무관하게 뒷말에 붙인다
export function koGroups(line) {
  if (line.includes('|')) return line.split('|').map((s) => s.trim()).filter(Boolean);
  const ws = line.split(/ +/).filter(Boolean);
  const out = [];
  let cur = [];
  ws.forEach((w, i) => {
    if (!cur.length) { cur.push(w); return; }
    const bind = glued(core(cur[cur.length - 1]), core(w), i === ws.length - 1);
    if (bind && syl(cur.join('')) + syl(w) <= MAX_GROUP) cur.push(w);
    else { out.push(cur.join(' ')); cur = [w]; }
  });
  if (cur.length) out.push(cur.join(' '));
  return out;
}
const NBSP = '\u00A0';
export const mdk = (s) => md(String(s ?? '').split('\n').map((l) => koGroups(l).map((g) => g.replace(/ /g, NBSP)).join(' ')).join('\n'));

const icon = (slug, cls = '') => `<img class="${cls}" src="icons/color/${slug}.svg" alt="">`;
const logoImg = (theme) => `<img class="logo" src="logo/myungyul_h_${THEMES[theme].dark ? 'white' : 'color'}.png" alt="법무법인 명율">`;
const vars = (t) => `--bg:${t.bg};--fg:${t.fg};--acc:${t.acc};--sub:${t.sub};--orb:${t.orb};--o:${t.o};--x:${t.x};`;

// ─────────────────────────────────────────────────────────────
// CSS (셸 페이지에 한 번 주입)
// ─────────────────────────────────────────────────────────────
const CSS_BASE = `
@font-face{font-family:'Pretendard';src:url('fonts/PretendardVariable.woff2') format('woff2-variations');font-weight:45 920;font-display:block}
@font-face{font-family:'Spoqa Han Sans Neo';src:url('fonts/SpoqaHanSansNeo-Bold.woff2') format('woff2');font-weight:700;font-display:block}
@font-face{font-family:'Spoqa Han Sans Neo';src:url('fonts/SpoqaHanSansNeo-Regular.woff2') format('woff2');font-weight:400;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
ul{list-style:none}
.ad{--k:1;position:relative;overflow:hidden;background:var(--bg);color:var(--fg);font-family:'Pretendard',sans-serif;letter-spacing:-0.035em;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
.ad .orb{position:absolute;border-radius:50%;background:var(--orb);pointer-events:none}
.ad .logo{position:absolute;display:block;width:auto}
.ad .box{position:absolute;display:flex;flex-direction:column;justify-content:safe center;overflow:hidden}
.ad .txt{display:flex;flex-direction:column;min-width:0;flex:0 0 auto}
.eb{font-weight:800;color:var(--acc);font-size:max(var(--min),calc(var(--es)*var(--k)));line-height:1.25;margin-bottom:calc(var(--gap)*.5)}
.h{font-weight:800;font-size:calc(var(--hs)*var(--k));line-height:1.2;letter-spacing:-0.045em}
.h em,.nv em,.sval em{font-style:normal;color:var(--acc)}
.sub{font-weight:500;color:var(--sub);font-size:max(var(--min),calc(var(--ss)*var(--k)));line-height:1.35;margin-top:var(--gap)}
.note{font-weight:500;color:var(--sub);font-size:var(--ns);line-height:1.4;margin-top:calc(var(--gap)*.9);letter-spacing:-0.02em}
.sub,.ans,.note,.ncap,.slabel,.cl li>span{text-wrap:balance}
.vis{position:relative;flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center}
.vis .stage{position:relative;width:300px;height:300px;flex:none}
.vis img{position:absolute;display:block;object-fit:contain}
.vis.n1 .i1{width:92%;height:92%;left:4%;top:4%}
.vis.n2 .i1{width:76%;height:76%;left:2%;top:2%}
.vis.n2 .i2{width:48%;height:48%;right:0;bottom:0}
.vis.n3 .i1{width:64%;height:64%;left:0;top:18%}
.vis.n3 .i2{width:42%;height:42%;right:2%;top:0}
.vis.n3 .i3{width:42%;height:42%;right:0;bottom:0}
.ic-svg{display:block;width:100%;height:100%}
`;

// 비율별 변수·로고·박스 위치 (has-logo 면 박스 상단을 로고 아래로 내린다)
const CSS_RATIO = `
.r-2x1{width:1200px;height:600px;--hs:96px;--es:48px;--ss:48px;--ns:24px;--min:48px;--gap:16px;--na:84px;--nv:150px;--as:52px;--cs:48px;--ls:48px;--sv:150px}
.r-1x1{width:1080px;height:1080px;--hs:110px;--es:44px;--ss:46px;--ns:25px;--min:44px;--gap:24px;--na:96px;--nv:150px;--as:60px;--cs:54px;--ls:50px;--sv:150px}
.r-4x5{width:1080px;height:1350px;--hs:122px;--es:65px;--ss:66px;--ns:33px;--min:65px;--gap:28px;--na:108px;--nv:210px;--as:74px;--cs:68px;--ls:66px;--sv:210px}
.r-9x16{width:1080px;height:1920px;--hs:126px;--es:60px;--ss:62px;--ns:36px;--min:58px;--gap:30px;--na:112px;--nv:220px;--as:72px;--cs:66px;--ls:62px;--sv:220px}
.r-2x1 .logo{left:64px;top:50px;height:36px}
.r-1x1 .logo{left:84px;top:80px;height:42px}
.r-4x5 .logo{left:88px;top:150px;height:46px}
.r-9x16 .logo{left:96px;top:292px;height:52px}
.r-2x1 .box{left:64px;right:64px;top:56px;bottom:100px}
.r-2x1.has-logo .box{top:106px}
.r-1x1 .box{left:84px;right:84px;top:84px;bottom:88px}
.r-1x1.has-logo .box{top:150px}
.r-4x5 .box{left:88px;right:88px;top:150px;bottom:150px}
.r-4x5.has-logo .box{top:226px}
.r-9x16 .box{left:96px;right:96px;top:419px;bottom:150px;justify-content:flex-start}
.r-9x16 .main{flex:0 0 844px;height:844px;display:flex;flex-direction:column;justify-content:safe center;overflow:hidden;min-height:0}
.r-9x16 .box > .vis{flex:1 1 auto;align-self:stretch;margin-top:20px;justify-content:center;align-items:center}
.l-number .main{align-items:center;text-align:center}
.l-stat .main{align-items:flex-start}
.r-4x5 .notes,.r-4x5.l-ox .ans,.r-4x5.l-check .sub{max-width:76%}
`;

// 레이아웃: hero(헤드라인+일러스트) / type(큰 타이포)
const CSS_HERO = `
.r-2x1.l-hero .box,.r-2x1.l-type .box{flex-direction:row;align-items:center;gap:24px}
.r-2x1.l-hero .txt,.r-2x1.l-type .txt{flex:1 1 auto}
.r-2x1.l-hero .vis{flex:0 0 290px;height:100%;max-height:300px}
.r-2x1.l-type .vis{flex:0 0 220px;height:220px}
.r-1x1.l-hero .vis{justify-content:flex-end;align-items:flex-end;margin-top:12px}
.r-4x5.l-hero .vis{margin-top:20px}
.l-type .h{font-size:calc(var(--hs)*1.18*var(--k))}
.r-1x1.l-type .vis,.r-4x5.l-type .vis{order:-1;flex:0 0 auto;height:210px;justify-content:flex-start;margin-bottom:30px}
.r-2x1.l-type .vis{order:2}
`;

// 레이아웃: number(총 채무 → 월 변제금 예시)
const CSS_NUMBER = `
.l-number .box{align-items:center;text-align:center}
.nrow{display:flex;flex-direction:column;align-items:center;gap:calc(var(--gap)*.6)}
.ncol{display:flex;flex-direction:column;align-items:center}
.ns{font-weight:500;color:var(--sub);font-size:max(var(--min),calc(var(--ss)*var(--k)));line-height:1.3}
.na{font-weight:800;font-size:calc(var(--na)*var(--k));line-height:1.15;letter-spacing:-0.045em;white-space:nowrap}
.nv{font-weight:800;font-size:calc(var(--nv)*var(--k));line-height:1.05;letter-spacing:-0.05em;white-space:nowrap}
.nv small{font-size:.42em;color:var(--acc);font-weight:800;margin-left:.08em;letter-spacing:-0.03em}
.narrow{width:calc(var(--na)*.9*var(--k));height:calc(var(--na)*.9*var(--k));color:var(--acc);transform:rotate(90deg)}
.ncap{font-weight:500;color:var(--sub);font-size:max(var(--min),calc(var(--ss)*var(--k)));line-height:1.3;margin-top:calc(var(--gap)*.8)}
.l-number .note{max-width:100%}
.r-4x5.l-number .notes{max-width:500px}
.r-2x1 .nrow{flex-direction:row;align-items:flex-end;gap:34px}
.r-2x1 .narrow{transform:none;margin-bottom:calc(var(--nv)*.22*var(--k))}
.r-2x1 .ncol.l .na{margin-bottom:calc(var(--nv)*.1*var(--k))}
.r-2x1.l-number .ncap{margin-top:10px}
`;

// 레이아웃: ox(오해 X / 사실 O)
const CSS_OX = `
.oxm{flex:none;color:var(--x);width:var(--om);height:var(--om)}
.oxm.o{color:var(--o)}
.l-ox .h em{color:inherit}
.ans{font-weight:800;color:var(--acc);font-size:max(var(--min),calc(var(--as)*var(--k)));line-height:1.3;margin-top:var(--gap)}
.r-2x1.l-ox .box{flex-direction:row;align-items:center;gap:52px;--om:250px}
.r-2x1.l-ox .txt{flex:1 1 auto}
.r-1x1.l-ox .box{--om:210px}
.r-4x5.l-ox .box{--om:250px}
.r-9x16.l-ox .box{--om:300px}
.r-1x1.l-ox .oxm,.r-4x5.l-ox .oxm,.r-9x16.l-ox .oxm{margin-bottom:calc(var(--gap)*1.6)}
`;

// 레이아웃: check(셀프 체크, 표·박스 없이 아이콘만) / steps(진행 순서) / stat(공식 통계)
const CSS_LIST = `
.cl{display:flex;flex-direction:column;gap:calc(var(--gap)*.85);margin-top:calc(var(--gap)*1.3)}
.cl li{display:flex;align-items:center;gap:.42em;font-weight:800;font-size:max(var(--min),calc(var(--cs)*var(--k)));line-height:1.25}
.cl .ck{flex:none;width:1.08em;height:1.08em;color:var(--acc)}
.cl.x .ck{color:var(--x)}
.r-2x1.l-check .box{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);column-gap:44px;align-content:center;align-items:center;justify-content:stretch}
.r-2x1.l-check .ch{grid-column:1;grid-row:1}
.r-2x1.l-check .cl{grid-column:2;grid-row:1 / span 2;margin-top:0}
.r-2x1.l-check .notes{grid-column:1;grid-row:2;align-self:start}
.r-2x1.l-check .sub{display:none}
.steps{display:flex;flex-direction:column;gap:calc(var(--gap)*.6);margin-top:calc(var(--gap)*1.4);position:relative;font-weight:800;font-size:max(var(--min),calc(var(--ls)*var(--k)))}
.st{display:flex;align-items:center;gap:.5em;line-height:1.2;position:relative;z-index:1}
.si{flex:none;width:1.35em;height:1.35em;display:block}
.si img{width:100%;height:100%;object-fit:contain;display:block}
.sline{position:absolute;background:currentColor;opacity:.16;border-radius:4px;z-index:0}
.r-1x1 .steps{--ls:64px}
.r-2x1 .steps{flex-direction:row;justify-content:space-between;align-items:flex-start;gap:10px;margin-top:30px}
.r-2x1 .st{flex-direction:column;gap:12px;text-align:center}
.r-2x1 .si{width:80px;height:80px}
.l-stat .box{align-items:flex-start}
.slabel{font-weight:500;color:var(--sub);font-size:max(var(--min),calc(var(--ss)*var(--k)));line-height:1.3}
.sval{font-weight:800;font-size:calc(var(--sv)*var(--k));line-height:1.02;letter-spacing:-0.05em;margin:calc(var(--gap)*.35) 0 calc(var(--gap)*.8);white-space:nowrap}
.sval small{font-size:.4em;color:var(--acc);font-weight:800;margin-left:.1em;letter-spacing:-0.03em}
.l-stat .h{font-size:calc(var(--hs)*.8*var(--k))}
.r-2x1.l-stat .h br{display:none}
`;

// 카카오 비즈보드 1029x258 (배경 투명, 박스는 카카오 시스템이 그림) — 카피 스타일 고정
const CSS_BIZ = `
.bz{position:relative;width:${BIZ.W}px;height:${BIZ.H}px;background:transparent;font-family:'Spoqa Han Sans Neo',sans-serif;letter-spacing:0;overflow:hidden}
.bz-copy{position:absolute;left:${BIZ.PAD_L}px;top:0;bottom:0;width:${BIZ.W - BIZ.OBJ_W - BIZ.GAP - BIZ.PAD_L}px;display:flex;flex-direction:column;justify-content:center}
.bz-main{font-weight:700;font-size:${BIZ.MAIN}px;color:#4C4C4C;line-height:1.3;white-space:nowrap}
.bz-sub{font-weight:400;font-size:${BIZ.SUB}px;color:#777777;line-height:1.3;white-space:nowrap;margin-top:4px}
.bz-main span,.bz-sub span{display:inline-block}
.bzo{position:relative;width:${BIZ.OBJ_W}px;height:${BIZ.H}px;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center}
.bz .bzo{position:absolute;right:0;top:0}
.bzo .bl{height:34px;width:auto;margin-bottom:10px;display:block}
.bzo .bi{height:236px;width:auto;display:block}
.bzo.with-logo .bi{height:196px}
`;

export const buildCss = () => CSS_BASE + CSS_RATIO + CSS_HERO + CSS_NUMBER + CSS_OX + CSS_LIST + CSS_BIZ;

// ─────────────────────────────────────────────────────────────
// HTML 빌더
// ─────────────────────────────────────────────────────────────
const SVG = {
  check: '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" opacity=".18"/><path d="M7 12.4l3.3 3.3L17.2 8.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  xmark: '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" opacity=".18"/><path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  O: '<svg class="ic-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" stroke-width="13"/></svg>',
  X: '<svg class="ic-svg" viewBox="0 0 100 100" aria-hidden="true"><path d="M24 24L76 76M76 24L24 76" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round"/></svg>',
  arrow: '<svg class="ic-svg" viewBox="0 0 48 48" aria-hidden="true"><path d="M7 24h30M26 12.5L37.5 24 26 35.5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// 배경 장식 원(옅은 톤). 홀수 id 는 큰 원의 상하 위치를 바꿔 소재마다 변화를 준다
const ORBS = {
  '2x1': [[560, 'right:-150px;top:-190px'], [250, 'left:-90px;bottom:-130px']],
  '1x1': [[720, 'right:-240px;bottom:-260px'], [320, 'left:-130px;top:-140px']],
  '4x5': [[780, 'right:-270px;bottom:-230px'], [340, 'left:-150px;top:-120px']],
  '9x16': [[920, 'right:-380px;top:-160px'], [620, 'left:-280px;bottom:-220px']],
};
const flipY = (pos) => pos.replace(/top|bottom/, (m) => (m === 'top' ? 'bottom' : 'top'));
const orbs = (c, r) => ORBS[r].map(([s, pos], i) => `<i class="orb" style="width:${s}px;height:${s}px;${i === 0 && c.id % 2 && r !== '2x1' ? flipY(pos) : pos}"></i>`).join('');

const lineCount = (s) => String(s || '').split('\n').length;
// 고지 문구. noteOpt(부가 안내, 법적 고지 아님)는 2:1 에서 글자가 너무 작아지면 렌더러가 뺀다. 변호사 성명은 항상 유지
const notes = (c, o) => {
  const arr = [c.note ? [c.note, c.noteOpt ? ' opt' : ''] : null, o.lawyer ? [`광고책임변호사 ${o.lawyer}`, ''] : null].filter(Boolean);
  return arr.length ? `<div class="notes">${arr.map(([n, cls]) => `<div class="note${cls}">${mdk(n)}</div>`).join('')}</div>` : '';
};
const visual = (c) => {
  const ics = (c.icons || []).slice(0, 3);
  if (!ics.length) return '';
  return `<div class="vis n${ics.length}"><div class="stage">${ics.map((s, i) => icon(s, `i${i + 1}`)).join('')}</div></div>`;
};

function heroBody(c, r, o) {
  // 2:1 은 텍스트 3줄 권장 → 헤드라인+서브가 3줄이면 아이브로우 생략
  const useEb = c.eyebrow && (r !== '2x1' || lineCount(c.headline) + (c.sub ? 1 : 0) + 1 <= 3);
  const eb = useEb ? `<div class="eb">${esc(c.eyebrow)}</div>` : '';
  const sub = c.sub ? `<div class="sub">${mdk(c.sub)}</div>` : '';
  return `<div class="txt">${eb}<div class="h">${md(c.headline)}</div>${sub}${notes(c, o)}</div>${o.noVis ? '' : visual(c)}`;
}
function numberBody(c, r, o) {
  const m = c.num.label.match(/^(\S+\s\S+)\s+(.+)$/) || [null, c.num.label, ''];
  return `<div class="nrow"><div class="ncol l"><span class="ns">${esc(m[1])}</span><span class="na">${esc(m[2])}</span></div>`
    + `<div class="narrow">${SVG.arrow}</div><div class="ncol r"><span class="ns">${esc(c.num.pre)}</span><span class="nv"><em>${esc(c.num.value)}</em><small>${esc(c.num.unit)}</small></span></div></div>`
    + `<div class="ncap">${mdk(c.num.caption)}</div>${notes(c, o)}`;
}
const oxBody = (c, r, o) => `<div class="oxm ${c.ox === 'O' ? 'o' : 'x'}">${SVG[c.ox]}</div><div class="txt"><div class="h">${md(c.headline)}</div><div class="ans">${mdk(c.sub)}</div>${notes(c, o)}</div>`;
const checkBody = (c, r, o) => `<div class="ch"><div class="h">${md(c.headline)}</div></div><ul class="cl${c.mark === 'x' ? ' x' : ''}">${c.checks.map((t) => `<li>${c.mark === 'x' ? SVG.xmark : SVG.check}<span>${mdk(t)}</span></li>`).join('')}</ul>${c.sub ? `<div class="sub">${mdk(c.sub)}</div>` : ''}${notes(c, o)}`;
const stepsBody = (c, r, o) => `<div class="h">${md(c.headline)}</div><div class="steps"><i class="sline"></i>${c.steps.map(([ic, label]) => `<div class="st"><span class="si"><img src="icons/color/${ic}.svg" alt=""></span><span class="sl">${esc(label)}</span></div>`).join('')}</div>${notes(c, o)}`;
const statBody = (c, r, o) => `<div class="slabel">${mdk(c.stat.label)}</div><div class="sval"><em>${esc(c.stat.value)}</em><small>${esc(c.stat.unit)}</small></div><div class="h">${md(r === '2x1' ? c.headline.replace(/\n/g, ' ') : c.headline)}</div>${notes(c, o)}`;
const BODY = { hero: heroBody, type: heroBody, number: numberBody, ox: oxBody, check: checkBody, steps: stepsBody, stat: statBody };

// 9:16 은 주요 문구를 권장 영역(상단 419px~하단 657px 제외)에 두고, 아래쪽 여백은 일러스트로 채운다
const decoVisual = (c, fallback) => { const s = c.icons?.[0] || fallback; return s ? `<div class="vis n1 deco"><div class="stage">${icon(s, 'i1')}</div></div>` : ''; };

export function renderAd(c, r, o = {}) {
  const cls = ['ad', `r-${r}`, `l-${c.layout}`, o.logo ? 'has-logo' : ''].filter(Boolean).join(' ');
  let inner = BODY[c.layout](c, r, o);
  if (r === '9x16') {
    const hero = ['hero', 'type'].includes(c.layout);
    inner = `<div class="main">${BODY[c.layout](c, r, { ...o, noVis: true })}</div>${(hero && visual(c)) || decoVisual(c, o.decoIcon)}`;
  }
  return `<div class="${cls}" data-id="${c.id}" style="${vars(THEMES[c.theme])}">${orbs(c, r)}${o.logo ? logoImg(c.theme) : ''}<div class="box">${inner}</div></div>`;
}

// 비즈보드: 오브젝트(3D 아이콘, 로고 버전은 로고 포함) + 고정 스타일 카피
export const renderBizObject = (o) => `<div class="bzo${o.logo ? ' with-logo' : ''}">${o.logo ? '<img class="bl" src="logo/myungyul_h_color.png" alt="법무법인 명율">' : ''}<img class="bi" src="icons/3d/${o.icon3d}.png" alt=""></div>`;
export const renderBiz = (c, o) => `<div class="bz"><div class="bz-copy"><div class="bz-main"><span>${esc(c.biz[0])}</span></div><div class="bz-sub"><span>${esc(o.sub)}</span></div></div>${renderBizObject(o)}</div>`;
