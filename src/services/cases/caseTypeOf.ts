// 사건 유형 판단 한 곳 (BK-1)
// 저장된 사건 유형 값만 본다. 소득·채무 금액으로 파산을 짐작하지 않는다
// (이전: 서식 추천·묶음·1단계 화면이 각자 '소득 0원 또는 채무 5억 초과 = 파산'으로 짐작했다).
const BANKRUPTCY_VALUES = new Set(['bankruptcy', 'individual_bankruptcy', '개인파산', '파산', '개인파산·면책']);

export function isBankruptcyCaseType(
  ext?: { caseType?: string | null } | null,
  req?: { caseType?: string | null; caseCategory?: string | null; category?: string | null } | null,
): boolean {
  const t = ext?.caseType || req?.caseType || req?.caseCategory || req?.category || '';
  return BANKRUPTCY_VALUES.has(String(t));
}
