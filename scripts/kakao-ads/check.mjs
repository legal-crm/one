// 소재 데이터 검사: 카카오 텍스트 규격 + 변호사 광고 규정 + 계산 예시 검증
// 사용법: node scripts/kakao-ads/check.mjs  (문제가 있으면 exit 1)
import { CREATIVES, CONCEPTS, SOURCES, LIVING_COST_2026 } from './creatives.mjs';
import { scanCompliance } from '../../api/_lib/marketing-compliance.js';
import { pathToFileURL } from 'node:url';

export const PROFILE_NAME = '법무법인 명율';
const plain = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\s*\|\s*/g, ' ').replace(/\n/g, ' ');

// 법무법인 광고 추가 금지·주의어 (변호사 광고에 관한 규정 제4·5·6·9·10조, 카카오 심사 기준)
const FIRM_RULES = [
  { re: /무료|공짜|0원\s*상담/, sev: 'high', why: '무료·염가 법률상담 광고 금지(제10조)' },
  { re: /환불|후불|할인|착수금|수임료|분할\s*납부/, sev: 'high', why: '보수 관련 표방 금지(제4조 10·11호)' },
  { re: /최고|유일|1위|넘버원|최초/, sev: 'high', why: '최고·유일 등 표현 금지(제9조②)' },
  { re: /전문(?!가)/, sev: 'medium', why: '"전문" 표시는 근거 확인 필요(제9조①)' },
  { re: /100\s*%|백\s*퍼센트/, sev: 'high', why: '절대적 수치 표현' },
  { re: /보장|확실|장담|책임지고/, sev: 'high', why: '결과 보장 표현' },
  { re: /즉시|바로\s*(중단|해결|탕감|면책)/, sev: 'medium', why: '시점 단정(법원 결정 사항)' },
  { re: /무조건/, sev: 'medium', why: '단정 표현' },
  { re: /탕감률|감면율|\d+\s*%\s*(탕감|감면)|원금\s*\d+\s*%/, sev: 'high', why: '탕감률·결과 예측 표시 금지(제4조 12호)' },
  { re: /AI|인공지능/i, sev: 'high', why: 'AI 이용 광고는 협회 등록·검토 변호사 표시 필요(제6조)' },
  { re: /새\s*출발/, sev: 'medium', why: '정부 새출발기금과 혼동 우려' },
  { re: /(?<![가-힣])정부|국가에서|나라에서|공공기관|신용회복위원회|신복위/, sev: 'medium', why: '공공기관 연관 오인 우려(카카오 심사)' },
  { re: /카카오|kakao/i, sev: 'medium', why: '카카오 서비스 오인 우려' },
  { re: /빚\s*삭제|빚\s*0|전관|판사\s*출신|검사\s*출신/, sev: 'high', why: '과장·전관 표현' },
  { re: /절대|완벽/, sev: 'medium', why: '절대 표현' },
];

// 카카오 타이틀·홍보문구·비즈보드 카피: 자판 기본 특수문자만 허용
const KEYBOARD_OK = /^[\uAC00-\uD7A3\u3131-\u318EA-Za-z0-9 ~!@#$%^&*()_+\-=[\]{}|;:'",.<>/?`\\]*$/;
const CONTACT = /(\d{2,4}-\d{3,4}-\d{4})|(https?:\/\/)|(www\.)|(@[a-z0-9-]+\.)|(\.com|\.kr|\.net)/i;

function textsOf(c) {
  const t = [c.eyebrow, c.headline, c.sub, c.note, c.title, c.promo, ...(c.biz || []), ...(c.checks || [])];
  if (c.steps) t.push(...c.steps.map((s) => s[1]));
  if (c.stat) t.push(`${c.stat.label} ${c.stat.value}${c.stat.unit}`);
  if (c.num) t.push(c.num.label, `${c.num.pre} ${c.num.value}${c.num.unit}`, c.num.caption);
  return t.filter(Boolean).map(plain);
}

function calcCheck(c) {
  if (!c.calc) return { errs: [], nums: '' };
  const { debt, income, household } = c.calc;
  const living = LIVING_COST_2026[household];
  const avail = income - living;
  const shown = Math.round(avail / 10000);
  const total = avail * 36;
  const min = debt < 50000000 ? debt * 0.05 : debt * 0.03 + 1000000; // 시행령 제4조 최저변제액
  const errs = [];
  if (String(shown) !== c.num.value) errs.push(`계산 불일치: ${income}-${living}=${avail} → ${shown}만 원, 표시 ${c.num.value}만 원`);
  if (total < min) errs.push(`최저변제액 미달: 36개월 ${total} < ${min}`);
  if (total >= debt) errs.push('36개월 총액이 채무 이상 (예시 부적절)');
  const eok = Math.floor(debt / 1e8);
  const man = (debt % 1e8) / 1e4;
  const nums = [debt / 10000, income / 10000, shown, avail, living, man].map((n) => n.toLocaleString('ko-KR')).join(' ') + (eok ? ` ${eok}억 ${man.toLocaleString('ko-KR')}만 원` : '');
  return { errs, nums, avail, total };
}

export function checkAll({ quiet = false } = {}) {
  const errors = [];
  const warns = [];
  const seen = { id: new Set(), code: new Set(), slug: new Set(), title: new Set(), headline: new Set() };
  if (CREATIVES.length !== 100) errors.push(`소재 수 ${CREATIVES.length}개 (100개 필요)`);
  CREATIVES.forEach((c, i) => {
    const tag = `#${String(c.id).padStart(3, '0')} ${c.code}`;
    const E = (m) => errors.push(`${tag} ${m}`);
    const W = (m) => warns.push(`${tag} ${m}`);
    if (c.id !== i + 1) E(`id 순서 오류 (${i + 1} 기대)`);
    if (!CONCEPTS[c.code[0]]) E('컨셉 코드 없음');
    for (const k of ['id', 'code', 'slug']) { if (seen[k].has(c[k])) E(`${k} 중복`); seen[k].add(c[k]); }
    const title = plain(c.title); const promo = plain(c.promo); const head = plain(c.headline);
    if (seen.title.has(title)) E('타이틀 중복'); seen.title.add(title);
    if (seen.headline.has(head)) E('헤드라인 중복'); seen.headline.add(head);
    if ([...title].length > 25) E(`타이틀 ${[...title].length}자 (25자 이하)`);
    if ([...promo].length > 45) E(`홍보문구 ${[...promo].length}자 (45자 이하)`);
    if (title === promo || title === PROFILE_NAME || promo === PROFILE_NAME) E('프로필명·타이틀·홍보문구 동일 문구');
    for (const [k, v] of [['타이틀', title], ['홍보문구', promo], ['비즈 메인', c.biz?.[0]], ['비즈 서브', c.biz?.[1]]]) {
      if (!v) { E(`${k} 없음`); continue; }
      if (!KEYBOARD_OK.test(v)) E(`${k} 자판 외 특수문자: "${v}"`);
    }
    const lines = String(c.headline).split('\n');
    if (lines.length > 3) E('헤드라인 3줄 초과');
    lines.forEach((l) => { if ([...plain(l)].length > 16) W(`헤드라인 한 줄 ${[...plain(l)].length}자 (길면 글자가 작아짐)`); });
    if (c.layout === 'hero' && !c.icons?.length) E('hero 레이아웃 아이콘 없음');
    const all = textsOf(c).join(' | ');
    if (CONTACT.test(all)) E('연락처·URL 기재 불가');
    for (const r of FIRM_RULES) {
      const m = all.match(r.re);
      if (m && !(c.allow || []).includes(m[0])) (r.sev === 'high' ? E : W)(`[${r.why}] "${m[0]}"`);
    }
    const cc = calcCheck(c);
    cc.errs.forEach(E);
    const sourceText = [SOURCES[c.src] || '', SOURCES.law, cc.nums].join(' ');
    const comp = scanCompliance(all, { sourceText, skipDisclaimerCheck: true });
    for (const is of comp.issues) {
      if (is.severity === 'high') E(`[규정 ${is.label}] "${is.match}"`);
      else if (is.severity === 'medium') W(`[규정 ${is.label}] "${is.match}"`);
      else if (is.ruleId === 'numeric-claim') W(`[수치 확인] "${is.match}"`);
    }
  });
  if (!quiet) {
    const byRisk = CREATIVES.reduce((a, c) => ((a[c.risk] = (a[c.risk] || 0) + 1), a), {});
    console.log(`소재 ${CREATIVES.length}개 · 위험도 ${JSON.stringify(byRisk)}`);
    if (warns.length) console.log(`[경고 ${warns.length}]\n  ${warns.join('\n  ')}`);
    console.log(errors.length ? `[오류 ${errors.length}]\n  ${errors.join('\n  ')}` : '오류 없음');
  }
  return { errors, warns };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { errors } = checkAll();
  if (errors.length) process.exitCode = 1;
}
