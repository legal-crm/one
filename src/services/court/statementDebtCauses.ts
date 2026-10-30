// 진술서 '개인회생절차에 이르게 된 사정' 선택지 (DP-8)
// 법원 진술서 양식 순서. 서식 작성기·진술서 미리보기·HTML 서식·변제계획 편집기가 이 목록 하나를 쓴다.
// 이전: 화면마다 목록이 달라(8개·8개·9개, '고금리 이자 누적'·'과소비' 등 양식에 없는 항목) 고른 값이 서식에 체크되지 않았다.

export const STATEMENT_DEBT_CAUSES = [
  '생활비 부족',
  '병원비 과다지출',
  '교육비 과다지출',
  '음식, 음주, 여흥, 도박 또는 취미활동',
  '점포 운영의 실패',
  '주식 투자 실패',
  '사기 피해',
  '타인(친지, 친구 등)의 채무보증',
  '기타',
] as const;

export type StatementDebtCause = (typeof STATEMENT_DEBT_CAUSES)[number];

/** 예전 화면에서 저장된 값 → 양식 선택지 */
const LEGACY: Record<string, StatementDebtCause> = {
  '병원비': '병원비 과다지출',
  '의료비': '병원비 과다지출',
  '교육비': '교육비 과다지출',
  '도박 등': '음식, 음주, 여흥, 도박 또는 취미활동',
  '과소비': '음식, 음주, 여흥, 도박 또는 취미활동',
  '점포 운영 실패': '점포 운영의 실패',
  '사업 실패': '점포 운영의 실패',
  '주식·코인 손실': '주식 투자 실패',
  '주식투자 실패': '주식 투자 실패',
  '투자 손실': '주식 투자 실패',
  '타인 채무 보증': '타인(친지, 친구 등)의 채무보증',
  '타인채무의 보증': '타인(친지, 친구 등)의 채무보증',
  '보증 채무': '타인(친지, 친구 등)의 채무보증',
  '고금리 이자 누적': '기타',
};

export function normalizeDebtCause(v: string): StatementDebtCause | null {
  const s = String(v || '').trim();
  if ((STATEMENT_DEBT_CAUSES as readonly string[]).includes(s)) return s as StatementDebtCause;
  return LEGACY[s] ?? null;
}

/** 저장된 목록을 양식 선택지로 바꾸고 중복을 없앤다 (모르는 값은 '기타') */
export function normalizeDebtCauses(list: unknown): StatementDebtCause[] {
  const arr = Array.isArray(list) ? list : [];
  const out = new Set<StatementDebtCause>();
  arr.forEach(v => out.add(normalizeDebtCause(String(v)) ?? '기타'));
  return STATEMENT_DEBT_CAUSES.filter(c => out.has(c));
}
