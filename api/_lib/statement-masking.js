// ============================================================
// 진술서 AI 비식별화 (P-2·P-4)
//  * 외부 AI(Gemini)로 보내기 전에 이름·회사·주소 같은 고유 이름을 역할 표시(«신청인», «인물_1» …)로 바꾸고,
//    주민등록번호·전화번호·계좌번호·이메일 형식은 종류 표시로 바꾼다.
//  * 답을 받으면 표시를 원래 값으로 되돌린다 (정형 패턴은 되돌리지 않는다 — 진술서에 들어갈 값이 아님).
//  * 표시는 « » 로 감싸 일반 문장과 섞이지 않게 한다.
// ============================================================

const PATTERNS = [
  { re: /\d{6}\s*[-–]?\s*[1-8]\d{6}/g, token: '«주민번호»' },
  { re: /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, token: '«전화번호»' },
  { re: /0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}/g, token: '«전화번호»' },
  { re: /\b\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,4})?\b/g, token: '«계좌번호»' },
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, token: '«이메일»' },
];

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {{ applicantName?: string, terms?: string[] }} opts
 *   terms: 의뢰인 자료에 있는 가족·직장·채권자 이름 등 (2글자 이상, 최대 40개)
 */
export function buildStatementMasker(opts = {}) {
  const pairs = []; // [원래 값, 표시]
  const applicant = String(opts.applicantName || '').replace(/\s*(님|씨)$/, '').trim();
  if (applicant.length >= 2) pairs.push([applicant, '«신청인»']);
  const seen = new Set(pairs.map(p => p[0]));
  let n = 0;
  for (const raw of Array.isArray(opts.terms) ? opts.terms : []) {
    const t = String(raw || '').replace(/[\u0000-\u001f«»]/g, '').trim().slice(0, 40);
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    n += 1;
    pairs.push([t, `«인물_${n}»`]);
    if (n >= 40) break;
  }
  // 긴 이름부터 바꿔야 '김철수'가 '김철'에 먼저 먹히지 않는다
  pairs.sort((a, b) => b[0].length - a[0].length);

  const mask = text => {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    for (const { re, token } of PATTERNS) out = out.replace(re, token);
    for (const [orig, token] of pairs) out = out.replace(new RegExp(escapeRe(orig), 'g'), token);
    return out;
  };
  const unmask = text => {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    for (const [orig, token] of pairs) {
      // 신청인 표시는 진술서 관례대로 '신청인'으로 둔다 (실명은 서식의 인적사항 칸에만)
      out = out.split(token).join(token === '«신청인»' ? '신청인' : orig);
    }
    return out;
  };
  const unmaskDeep = v => {
    if (typeof v === 'string') return unmask(v);
    if (Array.isArray(v)) return v.map(unmaskDeep);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unmaskDeep(x)]));
    return v;
  };
  return { mask, unmask, unmaskDeep, count: pairs.length };
}
