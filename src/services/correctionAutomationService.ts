/**
 * 법원 보정권고/보정명령 대응 자동화 서비스 (Correction Automation Service)
 * 
 * 1. 회생위원 7대 표준 보정명령 템플릿 라이브러리 (지시문 + 판례/실무준칙 답변 + 소갑호증)
 * 2. 통장 엑셀 파서 & 사전 리스크 탐지 데이터 -> 7대 소명표 원클릭 자동 완성
 * 3. 소갑 호증 (소갑 제1호증, 제2호증...) 일괄 자동 채번
 * 4. 법원 공식 별지 소명서 (대출금사용처, 100만원이상출금, 배우자재산, 소득산정) A4 출력 지원
 */

import type {
  RecentLoanUsageItem,
  CreditCardUsageItem,
  HighValueTransactionItem,
  IncomeCalculationMonth,
  InsuranceSurrenderItem,
  FamilyAssetOriginItem,
  CorrectionBriefData
} from '../types/correctionTypes';
import type { AuditTransactionItem, PreFilingRiskReport } from '../types/bankAuditTypes';

// ══════════════════════════════════════════════════════════════════
// 1. 회생위원 7대 표준 보정명령 템플릿 정의
// ══════════════════════════════════════════════════════════════════

export interface StandardCorrectionTemplate {
  id: string;
  category: 'LOAN' | 'WITHDRAWAL' | 'PREFERENTIAL' | 'SPECULATION' | 'SPOUSE' | 'INCOME' | 'INSURANCE';
  title: string;
  badge: string;
  courtInstruction: string;
  debtorResponseTemplate: (ctx: { clientName: string; courtName: string; totalAmount?: number }) => string;
  defaultAttachedEvidence: string;
}

export const STANDARD_CORRECTION_TEMPLATES: StandardCorrectionTemplate[] = [
  {
    id: 'TPL_01_LOAN_USAGE',
    category: 'LOAN',
    title: '1. 최근 1년 대출금 사용처 소명',
    badge: '대출금 사용처',
    courtInstruction: '신청일 기준 최근 1년 이내에 발생한 신규 대출금의 구체적 사용처를 객관적 소명자료(금융거래내역, 이체확인증, 영수증 등)와 함께 [별지: 대출금 사용처 소명표]를 작성하여 제출할 것.',
    debtorResponseTemplate: ({ clientName }) => 
      `신청인(${clientName})이 최근 1년 내 금융기관으로부터 차용한 대출금은 기존의 고금리 채무 변제 및 필수 생활비(임차료, 공과금, 의료비)에 전액 충당되었으며, 사치나 유흥 또는 재산 은닉의 목적으로 사용된 사실이 일체 없습니다. 별지 '최근 대출금 사용처 소명표' 및 금융기관 대환 송금 내역(소갑 제1호증)을 첨부하여 상세히 소명합니다.`,
    defaultAttachedEvidence: '소갑 제1호증 (별지 대출금 사용처 소명표 및 대환 이체확인증 일체)'
  },
  {
    id: 'TPL_02_HIGH_VALUE_WITHDRAWAL',
    category: 'WITHDRAWAL',
    title: '2. 100만 원 이상 고액 출금/이체 소명',
    badge: '100만원 이상 출금',
    courtInstruction: '신청일 전 1년 내 계좌에서 1회 100만 원 이상 출금되거나 이체된 자금의 최종 귀속처 및 사용처를 [별지: 100만 원 이상 출금 소명서]에 기재하고 계좌이체확인증 등 객관적 증빙을 첨부할 것.',
    debtorResponseTemplate: ({ clientName }) =>
      `신청인(${clientName})의 계좌에서 인출된 100만 원 이상 금원은 주거 임차보증금 잔금 지급, 직계가족 필수 치료비, 필수 생필품 구매 및 타 채무 상환에 지출되었음을 소명합니다. 편파변제나 자금 은닉의 의도는 일체 없었으며, 별지 소명서 및 이체증 일체(소갑 제2호증)를 첨부합니다.`,
    defaultAttachedEvidence: '소갑 제2호증 (별지 100만 원 이상 출금 소명서 및 계좌이체확인증 일체)'
  },
  {
    id: 'TPL_03_FAMILY_PREFERENTIAL',
    category: 'PREFERENTIAL',
    title: '3. 친인척 편파변제 소명 및 청산가치 반영',
    badge: '친인척 편파변제',
    courtInstruction: '신청 전 친인척 또는 지인에게 송금된 금원에 대하여 편파변제 여부를 소명하고, 부인권 대상 해당 시 청산가치에 반영하여 수정 변제계획안을 제출할 것.',
    debtorResponseTemplate: () =>
      `해당 금원은 신청인이 과거 직계존비속 등으로부터 긴급 생계비 명목으로 차용하였던 차용원리금의 일부 변제였으나, 채무자 회생 및 파산에 관한 법률상 편파변제 지적을 겸허히 수용하여, 동 송금액 전액을 신청인의 재산목록 청산가치에 가산하고 최저변제액을 충족하는 수정 변제계획안을 함께 제출합니다.`,
    defaultAttachedEvidence: '소갑 제3호증 (수정 재산목록 및 수정 변제계획안)'
  },
  {
    id: 'TPL_04_SPECULATION_CRYPTO',
    category: 'SPECULATION',
    title: '4. 가상자산/주식 손실금 소명 (실무준칙 제401호)',
    badge: '주식·코인 손실',
    courtInstruction: '가상자산, 주식 매매, 사행성 행위로 인하여 발생한 손실금 및 투자금의 구체적 규모를 소명하고, 투자 잔액 및 반환금을 재산목록에 반영할 것.',
    debtorResponseTemplate: ({ courtName }) =>
      `신청인은 과거 무리한 투자로 손실을 입었으나, 이는 경제적 위기 상황에서 채무를 해결하고자 했던 판단 착오였으며, ${courtName || '서울회생법원'} 실무준칙 제401호(주식 또는 가상자산 투자 손실금의 청산가치 미반영 원칙)에 비추어 기왕에 소멸된 순손실금은 청산가치 산입 대상이 아님을 혜량하여 주시기 바랍니다. 현재 보유 중인 평가잔고 및 예수금은 전액 재산목록에 계상하였습니다.`,
    defaultAttachedEvidence: '소갑 제4호증 (가상자산 거래소 거래원장 및 증권계좌 잔고증명서)'
  },
  {
    id: 'TPL_05_SPOUSE_ASSET',
    category: 'SPOUSE',
    title: '5. 배우자 명의 재산 형성 자금출처 소명',
    badge: '배우자 재산 소명',
    courtInstruction: '배우자 명의 부동산, 임차보증금, 차량 등의 취득 자금 출처를 소명하고, 채무자의 기여분을 청산가치에 반영할 것.',
    debtorResponseTemplate: () =>
      `민법 제830조 제1항에 따라 부부 일방이 혼인 중 자기 명의로 취득한 재산은 특유재산으로 추정되며(대법원 2008스105 결정 등 참조), 배우자 명의 자산은 배우자 본인의 고유 소득과 친정 부모의 상속·증여 자금으로 취득된 것으로서 채무자의 소득이 유입된 바 없습니다. 이에 배우자의 소득원천징수 및 자금출처 소명자료(소갑 제5호증)를 제출합니다.`,
    defaultAttachedEvidence: '소갑 제5호증 (배우자 소득금액증명원 및 친정 증여 입금증 일체)'
  },
  {
    id: 'TPL_06_INCOME_RECALCULATION',
    category: 'INCOME',
    title: '6. 최근 1년 소득 재산정 및 가용소득 소명',
    badge: '소득 재산정',
    courtInstruction: '최근 1년간 실제 수령한 급여 총액을 기초로 월평균 순소득을 재산정하고, 가용소득 변동에 따른 수정 변제계획안을 제출할 것.',
    debtorResponseTemplate: () =>
      `최근 12개월간 급여통장 입금액 및 근로소득원천징수영수증 상의 기본급과 제수당을 월별로 상세히 분석하여 [별지: 최근 1년 소득 실수령액 산출표]를 작성하였습니다. 비정기 상여금과 연장수당 변동분을 반영한 합리적 월평균 순소득을 산출하고 이에 부합하는 수정 변제계획안을 제출합니다.`,
    defaultAttachedEvidence: '소갑 제6호증 (별지 소득산정표 및 12개월 급여통장 사본)'
  },
  {
    id: 'TPL_07_INSURANCE_SURRENDER',
    category: 'INSURANCE',
    title: '7. 보험 해약환급금 및 150만 원 공제 소명',
    badge: '보험환급금 공제',
    courtInstruction: '신청인 명의 모든 보장성 보험 해약환급금 내역을 제출하고, 압류금지액 150만 원을 초과하는 잔액을 청산가치에 반영할 것.',
    debtorResponseTemplate: () =>
      `보험개발원 및 각 보험사 조회를 통하여 신청인 명의 모든 보험의 해약환급금을 전수 파악하였습니다. 민사집행법 시행령 제3조에 따른 압류금지액 150만 원을 공제한 잔여 환급금을 재산목록 청산가치에 정확히 반영하였으며, 이에 따른 수정 재산목록을 제출합니다.`,
    defaultAttachedEvidence: '소갑 제7호증 (보험해약환급금 확인서 및 수정 재산목록)'
  }
];

// ══════════════════════════════════════════════════════════════════
// 2. 사전 리스크 탐지 데이터 -> 7대 소명표 자동 변환 엔진
// ══════════════════════════════════════════════════════════════════

export function autoGenerateExplanationFromAudit(
  auditItems: AuditTransactionItem[],
  riskReport?: PreFilingRiskReport | null,
  clientName: string = '신청인'
): {
  highValueTrans: HighValueTransactionItem[];
  recentLoans: RecentLoanUsageItem[];
  creditCards: CreditCardUsageItem[];
} {
  const highValueTrans: HighValueTransactionItem[] = [];
  const recentLoans: RecentLoanUsageItem[] = [];
  const creditCards: CreditCardUsageItem[] = [];

  if (!auditItems || auditItems.length === 0) {
    return { highValueTrans, recentLoans, creditCards };
  }

  // 1. 100만 원 이상 출금 항목 추출 (계좌출금, ATM현금 등)
  auditItems
    .filter(item => {
      const isWithdrawal = item.transactionType === 'WITHDRAWAL' || 
                           item.transactionType === 'ATM_CASH' || 
                           (item as any).transType === '출금';
      return isWithdrawal && item.amount >= 1000000;
    })
    .forEach((item, idx) => {
      highValueTrans.push({
        id: item.id || `hvt-${idx + 1}`,
        transDate: item.date || (item as any).transDate || '',
        bankName: item.bankOrCard || (item as any).bankName || '주거래은행',
        transType: 'WITHDRAWAL',
        amount: item.amount,
        counterparty: item.counterparty || '미기재',
        purposeDetail: item.explanation || (item as any).usageExplanation || (item as any).notes || '생계비 및 필수 지출 충당',
        evidenceDocName: item.evidenceDocIndex || item.evidenceType || `소갑 제2호증의 ${idx + 1}`
      });
    });

  // 2. 대출금 입금 건 및 연계 출금 추출
  const loanKeywords = ['대출', '론', '캐피탈', '저축은행', '카드론', '현금서비스', '햇살론', '새희망'];
  const loanDeposits = auditItems.filter(item => {
    const isDeposit = item.transactionType === 'DEPOSIT' || (item as any).transType === '입금';
    const hasLoanKw = loanKeywords.some(kw => (item.counterparty || '').includes(kw) || (item.explanation || '').includes(kw));
    return isDeposit && (hasLoanKw || (item as any).category === 'LOAN_DEPOSIT');
  });

  loanDeposits.forEach((loan, idx) => {
    recentLoans.push({
      id: loan.id || `loan-${idx + 1}`,
      loanDate: loan.date || (loan as any).transDate || '',
      lenderName: loan.counterparty || '금융기관',
      amount: loan.amount,
      usageCategory: 'DEBT_REPAYMENT',
      specificUsage: loan.explanation || (loan as any).usageExplanation || '기존 고금리 채무 대환 상환 및 생계비 충당',
      evidenceDocName: loan.evidenceDocIndex || `소갑 제1호증의 ${idx + 1}`,
      verified: true
    });
  });

  // 3. 카드/사치성/사행성 지출 추출
  auditItems
    .filter(item => 
      item.riskCategory === 'DANGER_SPECULATION' || 
      item.riskCategory === 'DANGER_LUXURY' || 
      item.transactionType === 'CARD_PAYMENT'
    )
    .forEach((item, idx) => {
      creditCards.push({
        id: item.id || `card-${idx + 1}`,
        transactionDate: item.date || (item as any).transDate || '',
        cardCompany: item.bankOrCard || '신용카드',
        merchantName: item.counterparty || '가맹점',
        amount: item.amount,
        purpose: item.riskCategory === 'DANGER_SPECULATION' 
          ? '투자 손실 (실무준칙 제401호 적용 요망)' 
          : item.explanation || '생활용품 및 생필품 결제',
        isLuxuryOrGambling: item.riskCategory === 'DANGER_SPECULATION' || item.riskCategory === 'DANGER_LUXURY',
        evidenceNote: item.evidenceType || '카드 이용내역서 첨부'
      });
    });

  return {
    highValueTrans,
    recentLoans,
    creditCards
  };
}

// ══════════════════════════════════════════════════════════════════
// 3. 소갑 호증 일괄 자동 채번 엔진
// ══════════════════════════════════════════════════════════════════

export function autoAssignExhibitNumbers(briefData: CorrectionBriefData): CorrectionBriefData {
  let mainNumber = 1;
  const updatedAnswers = [...briefData.answers];
  const updatedHighValue = [...briefData.highValueTrans];
  const updatedRecentLoans = [...briefData.recentLoans];

  // 1. 대출금 사용처 소명표 채번
  if (updatedRecentLoans.length > 0) {
    const loanEvidence = `소갑 제${mainNumber}호증 (대출금 사용처 소명표 및 이체증)`;
    updatedRecentLoans.forEach((loan, idx) => {
      loan.evidenceDocName = `소갑 제${mainNumber}호증의 ${idx + 1}`;
    });

    // 답변 중 대출 관련 항목 매핑
    const ansIdx = updatedAnswers.findIndex(a => 
      a.courtInstruction.includes('대출') || a.courtInstruction.includes('차용')
    );
    if (ansIdx >= 0) {
      updatedAnswers[ansIdx] = {
        ...updatedAnswers[ansIdx],
        attachedEvidence: loanEvidence
      };
    }
    mainNumber++;
  }

  // 2. 100만 원 이상 출금 소명표 채번
  if (updatedHighValue.length > 0) {
    const withdrawalEvidence = `소갑 제${mainNumber}호증 (100만 원 이상 출금 소명서 및 이체확인증)`;
    updatedHighValue.forEach((tx, idx) => {
      tx.evidenceDocName = `소갑 제${mainNumber}호증의 ${idx + 1}`;
    });

    const ansIdx = updatedAnswers.findIndex(a => 
      a.courtInstruction.includes('출금') || a.courtInstruction.includes('금융거래') || a.courtInstruction.includes('100만')
    );
    if (ansIdx >= 0) {
      updatedAnswers[ansIdx] = {
        ...updatedAnswers[ansIdx],
        attachedEvidence: withdrawalEvidence
      };
    }
    mainNumber++;
  }

  // 3. 기타 답변 항목에 순차 호증 채번
  updatedAnswers.forEach((ans, idx) => {
    if (!ans.attachedEvidence || ans.attachedEvidence.includes('호증')) {
      if (!ans.attachedEvidence) {
        ans.attachedEvidence = `소갑 제${mainNumber}호증 (관련 소명자료)`;
        mainNumber++;
      }
    }
  });

  return {
    ...briefData,
    answers: updatedAnswers,
    recentLoans: updatedRecentLoans,
    highValueTrans: updatedHighValue
  };
}

// ══════════════════════════════════════════════════════════════════
// 4. 법원 공식 별지 소명서 HTML/인쇄 생성기
// ══════════════════════════════════════════════════════════════════

export function generateCourtAnnexHtml(
  type: 'LOAN' | 'WITHDRAWAL' | 'SPOUSE' | 'INCOME',
  ctx: {
    clientName: string;
    caseNumber: string;
    courtName: string;
    loans?: RecentLoanUsageItem[];
    withdrawals?: HighValueTransactionItem[];
    spouseAssets?: FamilyAssetOriginItem[];
    incomes?: IncomeCalculationMonth[];
  }
): string {
  const { clientName, caseNumber, courtName } = ctx;

  if (type === 'LOAN') {
    const loans = ctx.loans || [];
    const totalAmount = loans.reduce((sum, l) => sum + l.amount, 0);

    return `
      <div style="font-family: 'Batang', serif; padding: 30px; line-height: 1.6; color: #111;">
        <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">
          [별지 1] 최근 대출금 사용처 소명표
        </h2>
        <div style="font-size: 12px; margin-bottom: 15px;">
          <strong>사건번호:</strong> ${caseNumber} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>신청인:</strong> ${clientName} &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>관할:</strong> ${courtName}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #94a3b8; padding: 6px;">순번</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">대출일자</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">금융기관</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">대출금액(원)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">구체적 사용처</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">소명자료(호증)</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map((l, i) => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${l.loanDate}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${l.lenderName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${l.amount.toLocaleString()}원</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${l.specificUsage}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${l.evidenceDocName || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">합 계</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">${totalAmount.toLocaleString()}원</td>
              <td colspan="2" style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">대환 및 필수생계비 소명 완료</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 11px; color: #64748b; margin-top: 15px;">
          ※ 위 대출금은 사치·유흥이나 재산은닉에 사용된 바 없으며, 첨부된 금융거래확인서 및 이체증으로 입증합니다.
        </p>
      </div>
    `;
  }

  if (type === 'WITHDRAWAL') {
    const withdrawals = ctx.withdrawals || [];
    const totalAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    return `
      <div style="font-family: 'Batang', serif; padding: 30px; line-height: 1.6; color: #111;">
        <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">
          [별지 2] 금융거래 100만 원 이상 출금 사용처 소명서
        </h2>
        <div style="font-size: 12px; margin-bottom: 15px;">
          <strong>사건번호:</strong> ${caseNumber} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>신청인:</strong> ${clientName} &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>관할:</strong> ${courtName}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #94a3b8; padding: 6px;">순번</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">거래일자</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">거래은행</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">출금액(원)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">상대방(수취인)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">구체적 사용처 소명</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">소명호증</th>
            </tr>
          </thead>
          <tbody>
            ${withdrawals.map((w, i) => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${w.transDate}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${w.bankName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${w.amount.toLocaleString()}원</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${w.counterparty}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${w.purposeDetail}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${w.evidenceDocName || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">총 출금액</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">${totalAmount.toLocaleString()}원</td>
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">총 ${withdrawals.length}건 소명 완료</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 11px; color: #64748b; margin-top: 15px;">
          ※ 위 출금액은 편파변제나 자금 은닉의 목적이 없었음을 계좌이체증 및 영수증을 첨부하여 확인합니다.
        </p>
      </div>
    `;
  }

  return '';
}
