// ============================================================
// 파산 진술서 공식 문항·채권자 변환 (BK-1·BK-3·BK-4)
// 문항은 서울회생법원 실무준칙 제407호 '추가 진술사항' 양식(06 기획서 7-4)을 그대로 따른다.
// 판단 문장은 넣지 않는다 — 사실을 묻고 답을 적는 칸만.
// ============================================================
import type { BankruptcyCreditorItem } from '../../types/bankruptcyTypes';
import type { RepaymentCreditor } from '../repayment/repaymentTypes';

export interface OfficialQuestion {
  id: string;
  text: string;
  /** 지급불능 시점을 기준으로 기간을 보여 줄 문항 */
  period?: 'insolvency_1y' | 'since_insolvency' | 'recent_2y' | 'recent_1y';
  detailHint: string;
}

export const BANKRUPTCY_OFFICIAL_QUESTIONS: OfficialQuestion[] = [
  { id: 'q01_crime', text: '사기·사기파산·과태파산·도박 등으로 고소되거나 재판을 받은 적이 있나요?', detailHint: '사건번호·법원·결과' },
  { id: 'q02_installment', text: '최근 1년 사이 할부로 산 물건을 처분(판매·담보 제공 등)한 적이 있나요?', period: 'recent_1y', detailHint: '물건·처분일·금액·대금 사용처' },
  { id: 'q03_business', text: '개인 영업(자영업)을 한 적이 있나요? (상업장부 기장, 영업 재산 염가 매각 여부 포함)', detailHint: '업종·기간·폐업일·장부 기장·재고 처분' },
  { id: 'q04_negotiation', text: '채권자와 채무 조정을 협의하거나 합의·변제한 적이 있나요?', detailHint: '채권자·시기·내용' },
  { id: 'q05_insolvency', text: '지급불능(빚을 갚을 수 없게 된 상태)이 된 계기와 시점은 언제인가요?', detailHint: '계기와 구체적 사정 (시점은 위 지급불능 시점 칸)' },
  { id: 'q06_borrow_after', text: '지급불능 이후에 새로 돈을 빌리거나 카드를 쓴 적이 있나요?', period: 'since_insolvency', detailHint: '채권자·일자·금액·사용처' },
  { id: 'q07_preferential', text: '지급불능 이후 일부 채권자에게만 갚은 적이 있나요?', period: 'since_insolvency', detailHint: '채권자·일자·금액·관계' },
  { id: 'q08_disposal', text: '지급불능 1년 전부터 지금까지 1,000만 원 이상 재산을 처분한 적이 있나요? (부동산은 금액과 관계없이, 보험·정기예금 해약, 퇴직금 수령 포함)', period: 'insolvency_1y', detailHint: '재산·처분일·금액·대금 사용처' },
  { id: 'q09_deposit', text: '최근 2년 사이 이사하면서 임차보증금을 돌려받은 적이 있나요?', period: 'recent_2y', detailHint: '주소·수령일·금액·사용처' },
  { id: 'q10_divorce', text: '최근 2년 사이 이혼하면서 재산을 나눠 준 적이 있나요?', period: 'recent_2y', detailHint: '이혼일·나눈 재산·금액' },
  { id: 'q11_inheritance', text: '부모 등 친족이 사망해 상속받은 재산이 있나요?', detailHint: '사망일·관계·상속 재산·분할 여부' },
];

function shiftYear(ymd: string, years: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 문항 기간 문구 (지급불능 시점·신청일 기준) */
export function questionPeriodText(q: OfficialQuestion, insolventOn?: string, filingOn?: string): string {
  if (q.period === 'insolvency_1y') return insolventOn ? `${shiftYear(insolventOn, -1)} 이후` : '지급불능 시점을 먼저 입력해 주세요';
  if (q.period === 'since_insolvency') return insolventOn ? `${insolventOn} 이후` : '지급불능 시점을 먼저 입력해 주세요';
  if (q.period === 'recent_2y') return filingOn ? `${shiftYear(filingOn, -2)} 이후` : '최근 2년';
  if (q.period === 'recent_1y') return filingOn ? `${shiftYear(filingOn, -1)} 이후` : '최근 1년';
  return '';
}

/** 아직 답하지 않은 공식 문항 수 */
export function unansweredCount(answers?: Record<string, { answer: string }>): number {
  return BANKRUPTCY_OFFICIAL_QUESTIONS.filter(q => !answers?.[q.id]?.answer).length;
}

const CAUSE_FROM_TYPE: Record<BankruptcyCreditorItem['debtCause'], '1' | '2' | '3' | '4'> = {
  CASH_LOAN: '1', PRIVATE_LOAN: '1', CREDIT_CARD: '2', PURCHASE_GOODS: '2', GUARANTEE: '3', INDEMNITY: '4', OTHER: '4',
};

/** 회생 채권자목록(부채증명 반영분) → 파산 채권자목록. 파산에만 필요한 칸은 확인 필요로 표시 (BK-1) */
export function bankruptcyCreditorsFromRepayment(list: RepaymentCreditor[]): BankruptcyCreditorItem[] {
  return list.map((c, i) => {
    const t = `${c.debtCauseDetail || ''} ${c.claimCause || ''}`;
    const debtCause: BankruptcyCreditorItem['debtCause'] = c.isGuaranteedDebt || /보증/.test(t) ? 'GUARANTEE'
      : /카드/.test(t) || /카드/.test(c.name || '') ? 'CREDIT_CARD'
      : /물품|구입|할부/.test(t) ? 'PURCHASE_GOODS'
      : /대출|대여|차용|금전/.test(t) ? 'CASH_LOAN' : 'OTHER';
    return {
      id: `bkc-${c.id || i}`,
      creditorName: c.name || '',
      debtCause,
      debtCauseDetail: c.debtCauseDetail || '',
      borrowedDate: c.borrowedDate || '',
      principal: Math.round(c.principal || 0),
      interest: Math.round(c.interest || 0),
      isNonDischargeable: false,
      zipCode: c.zipCode,
      address: c.address,
      serviceAddress: c.serviceAddress,
      representative: c.representative,
      initialPrincipal: c.initialPrincipal || undefined,
      debtUsage: c.debtUsage || undefined,
      causeCode: c.bankruptcyCause,
      displayNumber: c.displayNumber,
      needsReview: true,
      sourceCreditorId: c.id,
    };
  });
}

/** 파산 채권자목록 → 전자소송 CSV용 (BK-3) */
export function bankruptcyCreditorsForCsv(list: BankruptcyCreditorItem[]): RepaymentCreditor[] {
  return list.map((c, i) => ({
    id: c.id,
    creditorNumber: i + 1,
    displayNumber: c.displayNumber,
    name: c.creditorName,
    principal: c.principal || 0,
    interest: c.interest || 0,
    zipCode: c.zipCode,
    address: c.address,
    serviceAddress: c.serviceAddress,
    representative: c.representative,
    debtCauseDetail: c.debtCauseDetail,
    borrowedDate: c.borrowedDate,
    initialPrincipal: c.initialPrincipal,
    debtUsage: c.debtUsage,
    bankruptcyCause: c.causeCode || CAUSE_FROM_TYPE[c.debtCause],
    isGuaranteedDebt: c.debtCause === 'GUARANTEE',
  }) as unknown as RepaymentCreditor);
}
