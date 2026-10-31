// ============================================================
// 출력 전 검사 CourtDocGuard (H-3)
//  * block: 내려받기를 막는다 (필수 항목 누락·형식 오류·양식에서 채울 칸을 못 찾음·합계 불일치)
//  * warn : 알리고 확인 뒤 진행 (변제 완료 미확인 등)
//  * 서식마다 규칙을 모아 runGuard()로 한 번에 돌린다
// ============================================================

export type GuardLevel = 'block' | 'warn';
export interface GuardIssue { level: GuardLevel; field?: string; message: string }

export const guard = {
  required(value: unknown, field: string, label: string): GuardIssue | null {
    const empty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    return empty ? { level: 'block', field, message: `${label}을(를) 넣어 주세요.` } : null;
  },
  pattern(value: string | undefined, re: RegExp, field: string, message: string, level: GuardLevel = 'block'): GuardIssue | null {
    if (!value) return null;
    return re.test(value.trim()) ? null : { level, field, message };
  },
  /** 합계가 1원 단위까지 같은지 */
  sumEquals(parts: number[], total: number, label: string): GuardIssue | null {
    const s = parts.reduce((a, b) => a + Math.round(b || 0), 0);
    return s === Math.round(total || 0) ? null : { level: 'block', message: `${label} 합계가 맞지 않아요 (항목 합 ${s.toLocaleString('ko-KR')}원 / 합계 ${Math.round(total || 0).toLocaleString('ko-KR')}원).` };
  },
  /** HWPX 빌더가 채울 칸을 찾지 못함 (양식이 바뀐 경우) */
  missingAnchors(missing: string[]): GuardIssue | null {
    return missing.length ? { level: 'block', message: `법원 양식에서 채울 위치를 찾지 못했어요: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' 외' : ''}. 양식이 바뀌었을 수 있어 관리자에게 알려 주세요.` } : null;
  },
  warn(cond: boolean, message: string, field?: string): GuardIssue | null {
    return cond ? { level: 'warn', field, message } : null;
  },
};

export function runGuard(checks: Array<GuardIssue | null | undefined>): { blocks: GuardIssue[]; warns: GuardIssue[]; ok: boolean } {
  const list = checks.filter(Boolean) as GuardIssue[];
  const blocks = list.filter(i => i.level === 'block');
  return { blocks, warns: list.filter(i => i.level === 'warn'), ok: blocks.length === 0 };
}

/** 주민등록번호 형식 (앞 6자리-뒤 7자리, 뒤 첫 자리 1~8) */
export const RRN_RE = /^\d{6}-?[1-8]\d{6}$/;
/** 개인회생 사건번호: 2024개회12345 */
export const REHAB_CASE_NO_RE = /^(19|20)\d{2}\s*개회\s*\d{1,7}$/;
