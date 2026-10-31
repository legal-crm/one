// 소득이 없거나 생계비 이하일 때 '정리 확인' 화면에서 더 묻는 5개 (I-7·CK-Q3)
// 답은 변호사 자료의 '파산 검토 참고' 묶음으로만 간다. 의뢰인 화면에는 어떤 판정도 보여 주지 않는다.
import { getLivingExpense } from '../../../services/repayment/repaymentConstants2026';

export interface LowIncomeFacts {
  unableSince?: '' | 'under1y' | '1to2y' | 'over2y' | 'unknown';
  disposal2y?: '' | 'yes' | 'no' | 'unknown';
  mainCause?: '' | 'living' | 'business' | 'medical' | 'guarantee' | 'fraud' | 'investment' | 'other';
  preferential1y?: '' | 'yes' | 'no' | 'unknown';
  householdIncome?: '' | 'none' | 'some' | 'unknown';
}

/** 소득이 없거나 기준 생계비(중위소득 60%) 이하인가 — 추가 질문을 보여 줄지만 정한다 (판정·표시 아님). fp 소득은 만 원 단위 */
export function needsLowIncomeQuestions(fp: any, year = new Date().getFullYear()): boolean {
  if (!fp) return false;
  if (fp.jobType === 'UNEMPLOYED') return true;
  const incomeWon = (Number(fp.income) || 0) * 10000;
  if (!(incomeWon > 0)) return true;
  const household = Math.max(1, (Number(fp.dependents) || 0) + 1);
  return incomeWon <= getLivingExpense(household, year);
}

/** 받은 답 → 변호사 자료 '파산 검토 참고' 줄 (답한 것만) */
export function bankruptcyReferenceLines(b: LowIncomeFacts | undefined): string[] {
  if (!b) return [];
  const SINCE: Record<string, string> = { under1y: '1년 안', '1to2y': '1~2년 전', over2y: '2년 넘음', unknown: '모름' };
  const CAUSE: Record<string, string> = { living: '생활비 부족', business: '사업 실패', medical: '병원비', guarantee: '보증', fraud: '사기 피해', investment: '주식·코인 투자', other: '기타' };
  const YN: Record<string, string> = { yes: '있음', no: '없음', unknown: '모름' };
  const HH: Record<string, string> = { none: '없음', some: '있음', unknown: '모름' };
  const out: string[] = [];
  if (b.unableSince) out.push(`• 갚기 어려워진 때: ${SINCE[b.unableSince]}`);
  if (b.mainCause) out.push(`• 빚의 주된 이유: ${CAUSE[b.mainCause]}`);
  if (b.disposal2y) out.push(`• 최근 2년 재산 처분: ${YN[b.disposal2y]}`);
  if (b.preferential1y) out.push(`• 최근 1년 일부 채권자에게만 변제: ${YN[b.preferential1y]}`);
  if (b.householdIncome) out.push(`• 함께 사는 가족 소득: ${HH[b.householdIncome]}`);
  return out;
}
