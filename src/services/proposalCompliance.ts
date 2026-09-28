// ============================================================
// 제안서 광고 규정 검사
// [설정 > AI 및 상담 스타일 프로필]의 '금지 표현'을 실제 발송 전에 검사한다.
// (이전: 금지 표현 목록을 저장만 하고 어디에서도 사용하지 않았다)
// ============================================================

/** 변협 광고규정상 문제 소지가 큰 기본 금지 표현 (결과 보장·과장) */
export const DEFAULT_PROHIBITED_EXPRESSIONS = [
  '100% 보장',
  '100% 비밀 보장',
  '인가 보장',
  '면책 보장',
  '무조건',
  '확실히',
  '반드시 인가',
  '전격 면책',
  '획기적',
  '완벽히 방어',
];

const STYLE_KEY_PREFIX = 'consult-style-';

/** 저장된 상담 스타일 프로필의 금지 표현 (tenantId가 없으면 이 브라우저에 저장된 프로필 전체) */
export function loadProhibitedExpressions(tenantId?: string): string[] {
  const set = new Set<string>(DEFAULT_PROHIBITED_EXPRESSIONS);
  try {
    if (typeof localStorage === 'undefined') return [...set];
    const keys: string[] = [];
    if (tenantId) keys.push(`${STYLE_KEY_PREFIX}${tenantId}`);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STYLE_KEY_PREFIX) && !keys.includes(k)) keys.push(k);
    }
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const list = JSON.parse(raw)?.prohibitedExpressions;
      if (Array.isArray(list)) list.forEach((s: unknown) => { if (typeof s === 'string' && s.trim()) set.add(s.trim()); });
    }
  } catch {
    // 손상된 프로필은 무시하고 기본 목록 사용
  }
  return [...set];
}

/** 본문에 포함된 금지 표현 목록 (공백 차이 무시) */
export function findProhibitedExpressions(text: string, tenantId?: string, list?: string[]): string[] {
  const norm = (s: string) => s.replace(/\s+/g, '');
  const body = norm(text || '');
  if (!body) return [];
  const exprs = list || loadProhibitedExpressions(tenantId);
  return exprs.filter(e => { const n = norm(e); return n.length > 0 && body.includes(n); });
}
