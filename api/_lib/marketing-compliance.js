// 마케팅 콘텐츠 광고 규정 검사기 (서버·브라우저 공용, 의존성 없음)
// 목적: AI가 만든 문장에서 변호사법·변호사 광고에 관한 규정·표시광고법상 위험 표현을 찾아
//       자동 치환하거나 사람 확인이 필요한 항목으로 표시한다.
// 주의: 이 검사는 규칙 기반 1차 필터다. 법률 검토를 대신하지 않는다.

/** 모든 콘텐츠 하단에 붙는 고지문 */
export const MARKETING_DISCLAIMER =
  '마이김변은 법률문서 작성 보조 및 변호사 선택을 지원하는 리걸테크 플랫폼이며, 개별 상담 및 수임은 의뢰인이 선택한 법률사무소가 독립적으로 수행합니다. 회생·파산 인가와 면책 여부는 법원이 사건별로 판단합니다.';

/** 짧은 채널(스레드·틱톡 캡션 등)용 고지문 */
export const MARKETING_DISCLAIMER_SHORT =
  '마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 법률사무소가 수행합니다. 인가·면책은 법원이 판단합니다.';

/**
 * 규칙 목록
 * severity: high(게시 차단 권고) | medium(수정 권고) | low(참고)
 * replace: 있으면 자동 치환(fixCompliance)에 사용
 */
export const COMPLIANCE_RULES = [
  {
    id: 'guarantee',
    severity: 'high',
    label: '결과 보장·단정',
    pattern: /(100\s*%|백\s*퍼센트|무조건|반드시|확실(?:하게|히)?)\s*(?:의\s*)?(탕감|면책|인가|승인|승소|해결|성공|구제|통과)/g,
    hint: '"자격 요건을 충족하면 법원 기준에 따라 검토됩니다"처럼 가능성으로 표현하세요.',
  },
  {
    id: 'guarantee-2',
    severity: 'high',
    label: '결과 보장·단정',
    pattern: /(탕감|면책|인가|승소)\s*(?:을|를)?\s*(보장|확정|약속)/g,
    hint: '결과는 법원이 사건별로 판단합니다. 보장 표현을 빼세요.',
  },
  {
    id: 'superlative',
    severity: 'high',
    label: '근거 없는 최상급·비교',
    pattern: /(국내|업계|대한민국|전국)\s*(최초|유일|최고|최대|1위|넘버원)|최고의\s*변호사|유일한\s*(리걸테크|플랫폼)/g,
    hint: '객관적 근거가 없는 최상급 표현은 광고 규정 위반 소지가 있습니다.',
  },
  {
    id: 'success-rate',
    severity: 'high',
    label: '승소율·성공률 표시',
    pattern: /(승소|성공|인가|면책|탕감)\s*(율|률)/g,
    hint: '성공률·승소율 표시는 오인 우려가 커서 쓰지 않습니다.',
  },
  {
    id: 'self-cert',
    severity: 'high',
    label: '자기 인증 문구',
    pattern: /(변호사법|광고\s*규정)[^\n.]{0,12}(100\s*%|완벽(?:히)?|준수\s*완료|검수\s*완료)|검수\s*(완료|통과)|검증\s*완료|자문위원\s*검수/g,
    hint: '실제로 받지 않은 검수·인증은 표시하지 않습니다.',
  },
  {
    id: 'auction',
    severity: 'high',
    label: '역경매·가격 경쟁 유도',
    pattern: /역경매|입찰|최저가|가격\s*(경쟁|비교\s*입찰)|덤핑|수임료\s*(할인|최저)/g,
    hint: '"의뢰인이 변호사 정보를 확인하고 직접 선택"으로 표현하세요.',
  },
  {
    id: 'free-consult',
    severity: 'medium',
    label: '무료 법률상담 광고',
    pattern: /무료\s*(?:법률\s*)?상담/g,
    replace: '상담 신청',
    hint: '변호사 광고 규정은 무료·염가 법률상담 광고를 제한합니다. 플랫폼 기능(자가진단 등)만 무료로 안내하세요.',
  },
  {
    id: 'specialist',
    severity: 'medium',
    label: '"전문 변호사" 표시',
    pattern: /(도산|회생|파산|개인회생|개인파산)\s*전문\s*변호사/g,
    replace: '$1 사건 경험 변호사',
    hint: '전문분야 등록 없이 "전문"을 표시하면 규정 위반 소지가 있습니다.',
  },
  {
    id: 'absolute-privacy',
    severity: 'medium',
    label: '절대적 보안 표현',
    pattern: /(유출|노출|전화)\s*0\s*(%|통|건)|완벽(?:하게|히|한)?\s*(차단|보호|보장)|절대\s*(유출|노출)(?:되지)?\s*않/g,
    hint: '"010 번호를 변호사에게 공개하지 않고"처럼 기능 사실로 표현하세요.',
  },
  {
    id: 'hype',
    severity: 'medium',
    label: '과장 수식어',
    pattern: /(?<![정일시획])기적(?:의|같은|처럼)|획기적(?:인|으로)?|전격\s*(면책|탕감)|빚\s*(?:0원|제로)|인생\s*역전|꿀팁\s*방출/g,
    hint: '평이한 정보 전달 문장으로 바꾸세요.',
  },
  {
    id: 'testimonial',
    severity: 'medium',
    label: '확인되지 않은 후기·사례',
    pattern: /실제\s*(사례|후기|고객)|[가-힣]{1,3}(씨|님)(?:의)?\s*(사례|후기)/g,
    hint: 'AI가 만든 사례를 실제 후기처럼 쓰면 허위·기만 광고가 됩니다. "예시"로 표시하거나 빼세요.',
  },
  {
    id: 'solicit',
    severity: 'medium',
    label: '특정 변호사 알선·연결 표현',
    pattern: /변호사(?:를|을)?\s*(소개|알선|연결)(?:해\s*드|시켜|해줍)|(최적|맞춤)\s*변호사\s*(배정|매칭)/g,
    hint: '플랫폼은 알선하지 않습니다. "변호사 정보를 확인하고 직접 선택"으로 표현하세요.',
  },
];

/** 숫자 주장(%, 배, 통, 명, 건, 만원, 억) — 출처 텍스트에 없으면 근거 확인 필요 */
const NUMERIC_CLAIM = /(\d[\d,.]*)\s*(%|퍼센트|배|통|명|건|만\s*원|억\s*원?|조\s*원?)/g;

/** 플랫폼 사실로 쓰이는 숫자(허용) */
const ALLOWED_NUMERIC = new Set(['010', '30', '36', '60', '3', '5', '1', '2', '4', '6', '7']);

function normalizeNumber(s) {
  return String(s).replace(/[,\s]/g, '');
}

/**
 * 텍스트를 검사해 문제 목록을 반환한다.
 * @param {string} text
 * @param {{ sourceText?: string }} [opts] sourceText: 뉴스 원문 요약(숫자 근거 대조용)
 * @returns {{ issues: Array<{ruleId:string,severity:'high'|'medium'|'low',label:string,match:string,hint:string}>, score:number, hasDisclaimer:boolean }}
 */
export function scanCompliance(text, opts = {}) {
  const src = typeof text === 'string' ? text : '';
  const sourceNums = new Set();
  if (opts.sourceText) {
    for (const m of String(opts.sourceText).matchAll(/\d[\d,.]*/g)) sourceNums.add(normalizeNumber(m[0]));
  }
  const issues = [];
  const seen = new Set();

  for (const rule of COMPLIANCE_RULES) {
    rule.pattern.lastIndex = 0;
    for (const m of src.matchAll(rule.pattern)) {
      const key = `${rule.id}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({ ruleId: rule.id, severity: rule.severity, label: rule.label, match: m[0], hint: rule.hint });
    }
  }

  for (const m of src.matchAll(NUMERIC_CLAIM)) {
    const num = normalizeNumber(m[1]);
    // 플랫폼 표준 용어 '100% 익명'은 허용 (AGENTS 규칙 4.5)
    if (num === '100' && src.slice((m.index || 0) + m[0].length).trimStart().startsWith('익명')) continue;
    if (ALLOWED_NUMERIC.has(num) && !/%|퍼센트|배/.test(m[2])) continue;
    if (sourceNums.has(num)) continue;
    const key = `numeric:${m[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      ruleId: 'numeric-claim',
      severity: /%|퍼센트|배/.test(m[2]) ? 'high' : 'low',
      label: '출처 확인이 필요한 수치',
      match: m[0],
      hint: '뉴스 원문이나 공식 자료에 없는 수치입니다. 출처를 확인하거나 빼세요.',
    });
  }

  const hasDisclaimer = src.includes('리걸테크 플랫폼') && (src.includes('법률사무소') || src.includes('변호사'));
  if (!hasDisclaimer && !opts.skipDisclaimerCheck) {
    issues.push({ ruleId: 'disclaimer', severity: 'medium', label: '고지문 누락', match: '', hint: '하단 리걸테크 고지문을 붙이세요.' });
  }

  const penalty = { high: 20, medium: 8, low: 3 };
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + penalty[i.severity], 0));
  return { issues, score, hasDisclaimer };
}

/**
 * 안전하게 기계 치환이 가능한 규칙만 적용한다 (의미가 바뀌는 보장·최상급 표현은 치환하지 않고 표시만 한다).
 * @param {string} text
 * @returns {{ text: string, applied: string[] }}
 */
export function fixCompliance(text) {
  let out = typeof text === 'string' ? text : '';
  const applied = [];
  for (const rule of COMPLIANCE_RULES) {
    if (!rule.replace) continue;
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(out)) {
      rule.pattern.lastIndex = 0;
      out = out.replace(rule.pattern, rule.replace);
      applied.push(rule.label);
    }
  }
  return { text: out, applied };
}

/** 고지문이 없으면 붙인다 */
export function ensureDisclaimer(text, short = false) {
  const src = typeof text === 'string' ? text : '';
  if (src.includes('리걸테크 플랫폼')) return src;
  return `${src.trimEnd()}\n\n※ ${short ? MARKETING_DISCLAIMER_SHORT : MARKETING_DISCLAIMER}`;
}

/** 여러 채널 텍스트를 합쳐 캠페인 단위 점수를 낸다 */
export function scanCampaignTexts(textsByChannel, sourceText) {
  const byChannel = {};
  let min = 100;
  let high = 0;
  for (const [channel, text] of Object.entries(textsByChannel || {})) {
    const r = scanCompliance(text, { sourceText });
    byChannel[channel] = r;
    min = Math.min(min, r.score);
    high += r.issues.filter(i => i.severity === 'high').length;
  }
  return { byChannel, score: min, highCount: high, publishable: high === 0 };
}
