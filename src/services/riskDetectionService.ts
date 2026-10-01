/**
 * 사전 리스크 탐지 엔진 (보정 예방 시스템)
 * 
 * 개시신청 전에 통장 거래내역을 분석하여 보정권고 예상 항목을 미리 탐지합니다.
 * AI나 유료 API 없이 규칙 기반 키워드 매칭 + CRM 데이터 교차 검증으로 동작합니다.
 * 브라우저에서 실행 — 서버 비용 ₩0
 * 
 * 탐지 항목 7가지:
 *  1. 대출금 입금 후 자금 흐름 추적
 *  2. 대액 출금 (100만원 이상)
 *  3. 친인척 이체 (편파변제 의심)
 *  4. 사행성 지출 (주식·코인·도박)
 *  5. 사치성 소비 (명품·유흥·골프)
 *  6. 현금서비스·카드론 입금 패턴
 *  7. 급여 외 정기 입금원
 */

import type {
  AuditTransactionItem,
  RiskDetectionType,
  RiskDetectionItem,
  RiskReportSummary,
  PreFilingRiskReport,
} from '../types/bankAuditTypes';

// ═══════════════════════════════════════════════
// 1. 키워드 사전 (관리자 페이지에서 추가/수정 가능하도록 분리)
// ═══════════════════════════════════════════════

/** 대출 관련 키워드 — 입금 적요/상대방에서 탐지 */
export const LOAN_KEYWORDS = [
  '대출', '신용대출', '카드론', '현금서비스', '마이너스', '한도대출',
  '중금리', '비상금대출', '생활안정자금', '소액대출', '학자금',
  '햇살론', '바꿔드림론', '사잇돌', '새희망홀씨',
];

/** 사행성 지출 키워드 — 출금 상대방에서 탐지 */
export const GAMBLING_KEYWORDS = [
  // 주식
  '증권', '주식', 'HTS', 'MTS', '선물옵션', '해외선물',
  // 가상화폐
  '코인', '비트', '업비트', '빗썸', '바이낸스', '코빗', '코인원', '두나무',
  '가상화폐', '비트코인', '이더리움',
  // 도박
  '카지노', '베팅', '토토', '로또', '경마', '경륜', '경정', '포커', '슬롯',
  '배트맨', '스포츠배팅', 'BET',
];

/** 사치성 소비 키워드 — 출금 상대방에서 탐지 */
export const LUXURY_KEYWORDS = [
  // 명품
  '루이비통', '구찌', '샤넬', '에르메스', '프라다', '버버리', '디올',
  '몽클레르', '발렌시아가', '보테가', '셀린느', '생로랑',
  '롤렉스', '오메가', '까르띠에', '불가리',
  // 유흥
  '주점', '유흥', '단란', '클럽', '나이트', '룸싸롱', '가라오케',
  // 레저/여행
  '골프', '면세', '해외항공', '호텔', '리조트', '크루즈',
  // 미용 (고액)
  '피부과', '성형외과',
];

/** 현금서비스/카드론 키워드 — 입금 상대방에서 탐지 */
export const CASH_ADVANCE_KEYWORDS = [
  '카드론', '현금서비스', '단기카드대출', 'CA입금', '카드대출',
  '리볼빙', '카드할부',
];

// ═══════════════════════════════════════════════
// 2. CRM 교차 검증 데이터 인터페이스
// ═══════════════════════════════════════════════

/** CRM에서 가져올 사건 데이터 (리스크 탐지용) */
export interface CaseDataForRiskDetection {
  /** 가족관계증명서에서 가져온 가족 이름 목록 */
  familyNames?: string[];
  /** 선언된 근무처 (급여 교차검증용) */
  employer?: string;
  /** 선언된 월 급여 (원) */
  declaredMonthlyIncome?: number;
  /** 대액 출금 기준 금액 (기본: 1,000,000원) */
  largeAmountThreshold?: number;
  /** 대출금 추적 기간 (일, 기본: 7일) */
  loanTrackingDays?: number;
}

// ═══════════════════════════════════════════════
// 3. 유틸리티 함수
// ═══════════════════════════════════════════════

function normalize(text: string): string {
  return (text || '').toLowerCase().replace(/\s+/g, '');
}

function matchesKeyword(text: string, keywords: string[]): boolean {
  const norm = normalize(text);
  return keywords.some(kw => norm.includes(kw.toLowerCase()));
}

function diffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function sumAmounts(items: AuditTransactionItem[]): number {
  return items.reduce((sum, t) => sum + t.amount, 0);
}

function getDateRange(items: AuditTransactionItem[]): string {
  if (items.length === 0) return '기간 없음';
  const dates = items.map(t => t.date).sort();
  const first = dates[0]?.slice(0, 7) || '';
  const last = dates[dates.length - 1]?.slice(0, 7) || '';
  return first === last ? first : `${first} ~ ${last}`;
}

// ═══════════════════════════════════════════════
// 4. 개별 리스크 탐지 함수
// ═══════════════════════════════════════════════

/** ① 대출금 입금 후 자금 흐름 추적 */
function detectLoanFlow(
  allItems: AuditTransactionItem[],
  trackingDays: number
): RiskDetectionItem[] {
  const results: RiskDetectionItem[] = [];

  // 입금 건 중 대출 키워드 매칭
  const loanDeposits = allItems.filter(t =>
    t.transactionType === 'DEPOSIT' &&
    matchesKeyword(t.counterparty, LOAN_KEYWORDS)
  );

  for (const loan of loanDeposits) {
    // 대출 입금 후 trackingDays일 이내의 50만원+ 출금 추적
    const followingWithdrawals = allItems.filter(t =>
      t.transactionType !== 'DEPOSIT' &&
      t.date >= loan.date &&
      diffDays(t.date, loan.date) <= trackingDays &&
      t.amount >= 500_000
    );

    if (followingWithdrawals.length > 0) {
      const totalOut = sumAmounts(followingWithdrawals);
      results.push({
        id: `risk-loan-${loan.id}`,
        type: 'LOAN_FLOW',
        level: totalOut >= 3_000_000 ? 'HIGH' : 'MEDIUM',
        title: '대출금 사용처 소명 필요',
        message: `${loan.counterparty}에서 ${loan.amount.toLocaleString()}원 입금 후 ${trackingDays}일 이내 ${followingWithdrawals.length}건 (총 ${totalOut.toLocaleString()}원) 출금 감지. 회생위원이 대출금 사용처를 별지표로 요구할 가능성이 높습니다.`,
        transactions: followingWithdrawals,
        totalAmount: totalOut,
        suggestedAction: '대출금 사용처 별지표 사전 작성 권장',
        suggestedEvidence: '이체확인증 / 영수증 / 대출금 사용내역 별지표',
        sourceLoanTransaction: loan,
      });
    }
  }
  return results;
}

/** ② 대액 출금 탐지 */
function detectLargeWithdrawals(
  allItems: AuditTransactionItem[],
  threshold: number
): RiskDetectionItem[] {
  const largeItems = allItems.filter(t =>
    t.transactionType !== 'DEPOSIT' && t.amount >= threshold
  );
  if (largeItems.length === 0) return [];

  return [{
    id: `risk-large-${Date.now()}`,
    type: 'LARGE_WITHDRAWAL',
    level: largeItems.length >= 10 ? 'HIGH' : 'MEDIUM',
    title: `${threshold.toLocaleString()}원 이상 출금 ${largeItems.length}건`,
    message: `기준 금액(${threshold.toLocaleString()}원) 이상 출금이 ${largeItems.length}건 (총 ${sumAmounts(largeItems).toLocaleString()}원) 감지되었습니다. 각 건에 대한 사용처 소명이 필요합니다.`,
    transactions: largeItems,
    totalAmount: sumAmounts(largeItems),
    suggestedAction: '각 출금 건에 대한 사용처 소명 작성',
    suggestedEvidence: '영수증 / 이체확인증 / 사용내역 메모',
  }];
}

/** ③ 친인척 이체 탐지 — CRM 가족 데이터 교차 검증 */
function detectFamilyTransfers(
  allItems: AuditTransactionItem[],
  familyNames: string[]
): RiskDetectionItem[] {
  if (familyNames.length === 0) return [];

  const familyTransfers = allItems.filter(t =>
    t.transactionType !== 'DEPOSIT' &&
    familyNames.some(name => (t.counterparty || '').includes(name))
  );
  if (familyTransfers.length === 0) return [];

  const total = sumAmounts(familyTransfers);
  const matchedNames = [...new Set(
    familyTransfers.map(t =>
      familyNames.find(name => t.counterparty.includes(name)) || ''
    ).filter(Boolean)
  )];

  return [{
    id: `risk-family-${Date.now()}`,
    type: 'FAMILY_TRANSFER',
    level: 'HIGH',
    title: `편파변제 의심 — ${matchedNames.join(', ')} 이체 ${familyTransfers.length}건`,
    message: `가족관계증명서상 가족(${matchedNames.join(', ')})에게 총 ${total.toLocaleString()}원 이체가 감지되었습니다. 법원은 이를 편파변제로 보아 부인권 행사 또는 청산가치 반영을 요구할 수 있습니다.`,
    transactions: familyTransfers,
    totalAmount: total,
    suggestedAction: '각 이체 건에 대해 생활비 보조/차용금 상환 등 소명서 작성 필수',
    suggestedEvidence: '가족관계증명서 / 주민등록등본 / 차용증 / 계좌이체확인증',
  }];
}

/** ④ 사행성 지출 탐지 */
function detectSpeculation(allItems: AuditTransactionItem[]): RiskDetectionItem[] {
  const specItems = allItems.filter(t =>
    matchesKeyword(t.counterparty, GAMBLING_KEYWORDS)
  );
  if (specItems.length === 0) return [];

  const total = sumAmounts(specItems);
  return [{
    id: `risk-spec-${Date.now()}`,
    type: 'SPECULATION',
    level: 'HIGH',
    title: `사행성 지출 ${specItems.length}건 — 소명 필수`,
    message: `주식·가상화폐·도박 관련 거래 ${specItems.length}건 (총 ${total.toLocaleString()}원)이 감지되었습니다. 회생위원이 투자 손실금 전액을 청산가치에 산입하거나 변제율 상향을 요구할 가능성이 매우 높습니다.`,
    transactions: specItems,
    totalAmount: total,
    suggestedAction: '거래소 출입금내역서 + 손실증명원 사전 확보. 도산 실무준칙 적용 여부 법원별 확인.',
    suggestedEvidence: '거래소 출입금내역서 / 손실증명원 / 계좌 거래내역',
  }];
}

/** ⑤ 사치성 소비 탐지 */
function detectLuxury(allItems: AuditTransactionItem[]): RiskDetectionItem[] {
  const luxItems = allItems.filter(t =>
    matchesKeyword(t.counterparty, LUXURY_KEYWORDS) ||
    (normalize(t.counterparty).includes('백화점') && t.amount >= 1_000_000)
  );
  if (luxItems.length === 0) return [];

  const total = sumAmounts(luxItems);
  return [{
    id: `risk-lux-${Date.now()}`,
    type: 'LUXURY_SPENDING',
    level: total >= 3_000_000 ? 'HIGH' : 'MEDIUM',
    title: `사치성 소비 ${luxItems.length}건 감지`,
    message: `명품·유흥·레저 관련 지출 ${luxItems.length}건 (총 ${total.toLocaleString()}원)이 감지되었습니다. 회생위원이 청산가치 산입 또는 변제율 상향을 요구할 수 있습니다.`,
    transactions: luxItems,
    totalAmount: total,
    suggestedAction: '일회성 경조사/업무 지출로 소명 가능한 건 분리. 지속적 사치가 아님을 입증.',
    suggestedEvidence: '경조사 관련 증빙 / 업무 접대 증빙 / 소명서',
  }];
}

/** ⑥ 현금서비스·카드론 입금 패턴 탐지 */
function detectCashAdvances(allItems: AuditTransactionItem[]): RiskDetectionItem[] {
  const caItems = allItems.filter(t =>
    t.transactionType === 'DEPOSIT' &&
    matchesKeyword(t.counterparty, CASH_ADVANCE_KEYWORDS)
  );
  if (caItems.length === 0) return [];

  const total = sumAmounts(caItems);
  return [{
    id: `risk-ca-${Date.now()}`,
    type: 'CASH_ADVANCE',
    level: caItems.length >= 3 ? 'HIGH' : 'MEDIUM',
    title: `현금서비스·카드론 ${caItems.length}건 감지`,
    message: `카드사 단기대출(현금서비스/카드론) 입금이 ${caItems.length}건 (총 ${total.toLocaleString()}원) 감지되었습니다. 채무 발생 경위 및 사용처 소명이 필요합니다.`,
    transactions: caItems,
    totalAmount: total,
    suggestedAction: '각 대출금 사용처 소명 + 채권자목록에 해당 카드사 채무 반영 확인',
    suggestedEvidence: '카드사 거래내역서 / 대출금 사용내역 별지표',
  }];
}

/** ⑦ 급여 외 정기 입금 탐지 — 패턴 분석 */
function detectUnexplainedIncome(
  allItems: AuditTransactionItem[],
  employer?: string,
  declaredIncome?: number
): RiskDetectionItem[] {
  // 입금 건만 필터
  const deposits = allItems.filter(t => t.transactionType === 'DEPOSIT');
  if (deposits.length < 3) return [];

  // 상대방별 입금 그룹화
  const groupedByCounterparty = new Map<string, AuditTransactionItem[]>();
  for (const d of deposits) {
    const key = normalize(d.counterparty);
    if (!key || key.length < 2) continue;
    const existing = groupedByCounterparty.get(key) || [];
    existing.push(d);
    groupedByCounterparty.set(key, existing);
  }

  const unexplained: AuditTransactionItem[] = [];

  for (const [key, items] of groupedByCounterparty) {
    // 3회 이상 반복 입금 = 정기 입금 패턴
    if (items.length < 3) continue;

    // 선언된 근무처와 일치하면 스킵
    if (employer && key.includes(normalize(employer))) continue;

    // 대출/카드론 관련이면 스킵 (별도 탐지)
    if (matchesKeyword(items[0].counterparty, LOAN_KEYWORDS)) continue;
    if (matchesKeyword(items[0].counterparty, CASH_ADVANCE_KEYWORDS)) continue;

    unexplained.push(...items);
  }

  if (unexplained.length === 0) return [];

  const total = sumAmounts(unexplained);
  const sources = [...new Set(unexplained.map(t => t.counterparty))];

  return [{
    id: `risk-income-${Date.now()}`,
    type: 'UNEXPLAINED_INCOME',
    level: total >= 5_000_000 ? 'HIGH' : 'MEDIUM',
    title: `급여 외 정기 입금 ${unexplained.length}건 — 소득원 소명 필요`,
    message: `선언된 근무처 외 정기 입금원이 감지되었습니다: ${sources.slice(0, 5).join(', ')}${sources.length > 5 ? ` 외 ${sources.length - 5}건` : ''}. 총 ${total.toLocaleString()}원. 추가 소득원이 있다면 수입목록에 반영해야 합니다.`,
    transactions: unexplained,
    totalAmount: total,
    suggestedAction: '추가 소득원 여부 확인 → 수입 및 지출에 관한 목록에 반영. 일시적 입금이면 소명서 작성.',
    suggestedEvidence: '소득 증빙 / 근로계약서 / 소명서',
  }];
}

// ═══════════════════════════════════════════════
// 5. 메인 리스크 분석 함수
// ═══════════════════════════════════════════════

/**
 * 통장 거래내역 사전 리스크 분석
 * 
 * @param items - parseExcelBankStatement()로 파싱된 전체 거래 내역 (입금+출금 모두)
 * @param caseData - CRM에서 가져온 사건 데이터 (가족명, 급여 등)
 * @returns PreFilingRiskReport - 보정 예방 리포트
 */
export function analyzePreFilingRisks(
  items: AuditTransactionItem[],
  clientId: string,
  clientName: string,
  caseData: CaseDataForRiskDetection = {}
): PreFilingRiskReport {
  const {
    familyNames = [],
    employer,
    declaredMonthlyIncome,
    largeAmountThreshold = 1_000_000,
    loanTrackingDays = 7,
  } = caseData;

  // 7가지 리스크 탐지 실행
  const allRisks: RiskDetectionItem[] = [
    ...detectLoanFlow(items, loanTrackingDays),
    ...detectLargeWithdrawals(items, largeAmountThreshold),
    ...detectFamilyTransfers(items, familyNames),
    ...detectSpeculation(items),
    ...detectLuxury(items),
    ...detectCashAdvances(items),
    ...detectUnexplainedIncome(items, employer, declaredMonthlyIncome),
  ];

  // 중복 거래 제거 (같은 거래가 여러 리스크에 걸릴 수 있음)
  const flaggedTxIds = new Set(allRisks.flatMap(r => r.transactions.map(t => t.id)));

  const highRisks = allRisks.filter(r => r.level === 'HIGH');
  const medRisks = allRisks.filter(r => r.level === 'MEDIUM');

  const summary: RiskReportSummary = {
    totalTransactions: items.length,
    analyzedPeriod: getDateRange(items),
    flaggedCount: flaggedTxIds.size,
    highRiskCount: highRisks.length,
    mediumRiskCount: medRisks.length,
    highRiskAmount: highRisks.reduce((s, r) => s + r.totalAmount, 0),
    mediumRiskAmount: medRisks.reduce((s, r) => s + r.totalAmount, 0),
    estimatedCorrectionItems: highRisks.length + Math.ceil(medRisks.length * 0.5),
  };

  // 종합 권고 메시지 생성
  let overallAdvice = '';
  if (highRisks.length === 0 && medRisks.length === 0) {
    overallAdvice = '✅ 특이 거래가 감지되지 않았습니다. 보정권고 위험이 낮습니다.';
  } else if (highRisks.length === 0) {
    overallAdvice = `⚠️ 주의 항목 ${medRisks.length}건이 감지되었습니다. 접수 전 소명 자료를 준비하면 보정권고를 예방할 수 있습니다.`;
  } else {
    const types = highRisks.map(r => r.title).join(', ');
    overallAdvice = `🔴 고위험 항목 ${highRisks.length}건 감지: ${types}. 접수 전에 반드시 소명서와 증빙자료를 준비해야 합니다. 미준비 시 보정권고가 예상됩니다.`;
  }

  return {
    clientId,
    clientName,
    generatedAt: new Date().toISOString(),
    summary,
    risks: allRisks,
    overallAdvice,
  };
}

/**
 * 리스크 리포트 요약 텍스트 생성 (변호사 대시보드용 한줄 요약)
 */
export function getRiskBadgeSummary(report: PreFilingRiskReport): {
  label: string;
  color: 'green' | 'yellow' | 'red';
  count: number;
} {
  if (report.summary.highRiskCount > 0) {
    return {
      label: `🔴 고위험 ${report.summary.highRiskCount}건`,
      color: 'red',
      count: report.summary.highRiskCount + report.summary.mediumRiskCount,
    };
  }
  if (report.summary.mediumRiskCount > 0) {
    return {
      label: `⚠️ 주의 ${report.summary.mediumRiskCount}건`,
      color: 'yellow',
      count: report.summary.mediumRiskCount,
    };
  }
  return {
    label: '✅ 리스크 없음',
    color: 'green',
    count: 0,
  };
}

// ═══════════════════════════════════════════════
// 6. Money Trail 타임라인 어댑터 (v2.0 신규)
// ═══════════════════════════════════════════════

/**
 * 대출금 입금 → D+7일 출금 체인을 시각화용 타임라인 구조체로 변환
 * 기존 detectLoanFlow 결과를 래핑하여 UI에서 즉시 렌더링 가능한 형태로 제공
 */

export interface MoneyTrailEvent {
  id: string;
  date: string;
  type: 'LOAN_DEPOSIT' | 'OUTFLOW_SAFE' | 'OUTFLOW_CAUTION' | 'OUTFLOW_DANGER';
  label: string;               // "카카오뱅크 대출 2,000만원 입금" 또는 "업비트 1,000만원 이체"
  amount: number;
  counterparty: string;
  riskCategory: string;        // bankAuditService의 AuditRiskCategory
  transaction: AuditTransactionItem;
}

export interface MoneyTrailChain {
  id: string;
  loanDeposit: MoneyTrailEvent;              // 대출 입금 이벤트
  outflows: MoneyTrailEvent[];               // D+7일 이내 출금 이벤트들 (시간순)
  totalLoanAmount: number;                   // 대출 입금 총액
  totalOutflowAmount: number;                // 추적된 출금 총액
  coverageRate: number;                      // 출금/입금 비율 (%) — 100% 미만이면 잔여 자금 미추적
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  trackingDays: number;                      // 추적 기간 (일)
  dangerOutflowCount: number;                // 고위험 출금 건수 (투자/사치)
}

export interface MoneyTrailReport {
  chains: MoneyTrailChain[];
  totalLoanDeposits: number;                 // 총 대출 입금 건수
  totalLoanAmount: number;                   // 총 대출 입금액
  totalTrackedOutflows: number;              // 추적된 출금 건수
  hasHighRisk: boolean;                      // 고위험 체인 존재 여부
}

/**
 * 기존 PreFilingRiskReport에서 LOAN_FLOW 항목을 추출하여
 * Money Trail 타임라인 시각화용 데이터로 변환
 */
export function buildMoneyTrailReport(
  riskReport: PreFilingRiskReport,
  allItems: AuditTransactionItem[],
  trackingDays: number = 7
): MoneyTrailReport {
  const loanFlowRisks = riskReport.risks.filter(r => r.type === 'LOAN_FLOW');

  const chains: MoneyTrailChain[] = loanFlowRisks.map((risk, idx) => {
    const sourceLoan = risk.sourceLoanTransaction;
    if (!sourceLoan) {
      return null;
    }

    // 대출 입금 이벤트
    const loanEvent: MoneyTrailEvent = {
      id: `mt-loan-${idx}`,
      date: sourceLoan.date,
      type: 'LOAN_DEPOSIT',
      label: `${sourceLoan.counterparty} ${sourceLoan.amount.toLocaleString()}원 입금`,
      amount: sourceLoan.amount,
      counterparty: sourceLoan.counterparty,
      riskCategory: 'SAFE_DEBT',
      transaction: sourceLoan,
    };

    // 연계 출금 이벤트들 (시간순 정렬)
    const outflows: MoneyTrailEvent[] = risk.transactions
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t, tIdx) => {
        let eventType: MoneyTrailEvent['type'] = 'OUTFLOW_SAFE';
        if (t.riskCategory === 'DANGER_SPECULATION' || t.riskCategory === 'DANGER_LUXURY') {
          eventType = 'OUTFLOW_DANGER';
        } else if (t.riskCategory === 'CAUTION_CASH' || t.riskCategory === 'CAUTION_TRANSFER') {
          eventType = 'OUTFLOW_CAUTION';
        }

        return {
          id: `mt-out-${idx}-${tIdx}`,
          date: t.date,
          type: eventType,
          label: `${t.counterparty} ${t.amount.toLocaleString()}원`,
          amount: t.amount,
          counterparty: t.counterparty,
          riskCategory: t.riskCategory,
          transaction: t,
        };
      });

    const totalOutflow = outflows.reduce((sum, e) => sum + e.amount, 0);
    const dangerCount = outflows.filter(e => e.type === 'OUTFLOW_DANGER').length;
    const coverageRate = sourceLoan.amount > 0
      ? Math.round((totalOutflow / sourceLoan.amount) * 100)
      : 0;

    return {
      id: `mt-chain-${idx}`,
      loanDeposit: loanEvent,
      outflows,
      totalLoanAmount: sourceLoan.amount,
      totalOutflowAmount: totalOutflow,
      coverageRate,
      riskLevel: dangerCount > 0 ? 'HIGH' : (coverageRate >= 80 ? 'MEDIUM' : 'LOW'),
      trackingDays,
      dangerOutflowCount: dangerCount,
    } as MoneyTrailChain;
  }).filter((c): c is MoneyTrailChain => c !== null);

  return {
    chains,
    totalLoanDeposits: chains.length,
    totalLoanAmount: chains.reduce((s, c) => s + c.totalLoanAmount, 0),
    totalTrackedOutflows: chains.reduce((s, c) => s + c.outflows.length, 0),
    hasHighRisk: chains.some(c => c.riskLevel === 'HIGH'),
  };
}
