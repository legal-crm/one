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
// 별지 HTML은 dangerouslySetInnerHTML / document.write로 출력되므로 모든 입력값을 이스케이프 (저장형 XSS 방지)
import { escapeHtml as esc } from './court/CourtFormHtmlBuilder';

/**
 * ⚠️ 답변 템플릿 원칙: 의뢰인에 관한 **사실을 단정하지 않는다**.
 *   [대괄호] 부분은 실제 소명자료를 확인한 뒤 담당자가 채워야 하는 빈칸이다.
 *   (이전: '고금리 채무 변제에 전액 충당', '친정 부모 증여 자금', '편파변제 지적을 수용' 등 확인되지 않은 사실을 기본 문안으로 제공)
 */

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
      `신청인(${clientName})이 최근 1년 내 금융기관으로부터 차용한 대출금의 사용처는 별지 '최근 대출금 사용처 소명표' 기재와 같습니다. [대출별 실제 사용처 요지 기재 — 예: ○○카드 대금 결제 ○○원, 임차료 ○○원]. 이를 확인할 수 있는 금융거래내역 및 이체확인증을 첨부하여 소명합니다.`,
    defaultAttachedEvidence: '[호증 번호] (별지 대출금 사용처 소명표 및 이체확인증)'
  },
  {
    id: 'TPL_02_HIGH_VALUE_WITHDRAWAL',
    category: 'WITHDRAWAL',
    title: '2. 100만 원 이상 고액 출금/이체 소명',
    badge: '100만원 이상 출금',
    courtInstruction: '신청일 전 1년 내 계좌에서 1회 100만 원 이상 출금되거나 이체된 자금의 최종 귀속처 및 사용처를 [별지: 100만 원 이상 출금 소명서]에 기재하고 계좌이체확인증 등 객관적 증빙을 첨부할 것.',
    debtorResponseTemplate: ({ clientName }) =>
      `신청인(${clientName})의 계좌에서 1회 100만 원 이상 출금·이체된 금원의 수취인과 사용처는 별지 '100만 원 이상 출금 소명서' 기재와 같습니다. [건별 사용처 요지 기재]. 이를 확인할 수 있는 계좌이체확인증·영수증 등을 첨부합니다.`,
    defaultAttachedEvidence: '[호증 번호] (별지 100만 원 이상 출금 소명서 및 계좌이체확인증)'
  },
  {
    id: 'TPL_03_FAMILY_PREFERENTIAL',
    category: 'PREFERENTIAL',
    title: '3. 친인척 편파변제 소명 및 청산가치 반영',
    badge: '친인척 편파변제',
    courtInstruction: '신청 전 친인척 또는 지인에게 송금된 금원에 대하여 편파변제 여부를 소명하고, 부인권 대상 해당 시 청산가치에 반영하여 수정 변제계획안을 제출할 것.',
    debtorResponseTemplate: () =>
      `지적하신 송금 [일자·수취인·금액]은 [송금 사유 기재 — 예: 차용금 변제 / 생활비 지원 / 기타]입니다. [편파변제에 해당한다고 판단되는 경우: 해당 금액을 재산목록 청산가치에 가산하고 수정 변제계획안을 제출합니다. / 해당하지 않는다고 판단되는 경우: 그 근거와 소명자료를 기재합니다.]`,
    defaultAttachedEvidence: '[호증 번호] (송금 내역 및 수정 재산목록·변제계획안)'
  },
  {
    id: 'TPL_04_SPECULATION_CRYPTO',
    category: 'SPECULATION',
    title: '4. 가상자산/주식 손실금 소명',
    badge: '주식·코인 손실',
    courtInstruction: '가상자산, 주식 매매, 사행성 행위로 인하여 발생한 손실금 및 투자금의 구체적 규모를 소명하고, 투자 잔액 및 반환금을 재산목록에 반영할 것.',
    debtorResponseTemplate: ({ courtName }) =>
      `신청인의 주식·가상자산 거래 내역과 손실 규모는 첨부 거래원장 기재와 같습니다 [총 투자액 ○○원, 순손실 ○○원, 현재 평가잔고·예수금 ○○원]. 현재 보유 중인 평가잔고 및 예수금은 재산목록에 계상하였습니다. 손실금의 청산가치 반영 여부는 ${courtName || '관할 법원'}의 주식·가상자산 투자 손실금 처리 기준(서울회생법원 실무준칙 제408호 및 수원·부산회생법원의 같은 취지 기준)에 따라 판단하여 주시기 바랍니다.`,
    defaultAttachedEvidence: '[호증 번호] (가상자산 거래소 거래원장 및 증권계좌 잔고증명서)'
  },
  {
    id: 'TPL_05_SPOUSE_ASSET',
    category: 'SPOUSE',
    title: '5. 배우자 명의 재산 형성 자금출처 소명',
    badge: '배우자 재산 소명',
    courtInstruction: '배우자 명의 부동산, 임차보증금, 차량 등의 취득 자금 출처를 소명하고, 채무자의 기여분을 청산가치에 반영할 것.',
    debtorResponseTemplate: () =>
      `배우자 명의 [재산 종류·취득일·취득가액]의 취득 자금은 [자금 출처 기재 — 예: 배우자 근로소득 ○○원, 증여·상속 ○○원]으로 마련되었습니다. [채무자 소득 유입 여부 및 기여분에 대한 설명 기재]. 민법 제830조 제1항(부부 일방이 혼인 중 자기 명의로 취득한 재산은 그 특유재산)을 참고하되, 자금 출처는 첨부 자료로 소명합니다.`,
    defaultAttachedEvidence: '[호증 번호] (배우자 소득금액증명원 및 자금출처 자료)'
  },
  {
    id: 'TPL_06_INCOME_RECALCULATION',
    category: 'INCOME',
    title: '6. 최근 1년 소득 재산정 및 가용소득 소명',
    badge: '소득 재산정',
    courtInstruction: '최근 1년간 실제 수령한 급여 총액을 기초로 월평균 순소득을 재산정하고, 가용소득 변동에 따른 수정 변제계획안을 제출할 것.',
    debtorResponseTemplate: () =>
      `최근 12개월간 급여통장 입금액 및 근로소득원천징수영수증을 기초로 [별지: 최근 1년 소득 실수령액 산출표]를 작성하였습니다. 재산정한 월평균 순소득은 [○○원]이며, 이에 맞춘 수정 변제계획안을 제출합니다.`,
    defaultAttachedEvidence: '[호증 번호] (별지 소득산정표 및 12개월 급여통장 사본)'
  },
  {
    id: 'TPL_07_INSURANCE_SURRENDER',
    category: 'INSURANCE',
    title: '7. 보험 해약환급금 및 150만 원 공제 소명',
    badge: '보험환급금 공제',
    courtInstruction: '신청인 명의 모든 보장성 보험 해약환급금 내역을 제출하고, 압류금지액 150만 원을 초과하는 잔액을 청산가치에 반영할 것.',
    debtorResponseTemplate: () =>
      `신청인 명의 보험의 해약환급금은 첨부 확인서 기재와 같습니다 [보험사·상품별 환급금 ○○원]. 보장성보험 해약환급금 중 압류금지 금액(민사집행법 시행령 제6조 제1항 제3호, 150만 원)을 공제한 잔액을 재산목록 청산가치에 반영하였으며, 수정 재산목록을 제출합니다.`,
    defaultAttachedEvidence: '[호증 번호] (보험해약환급금 확인서 및 수정 재산목록)'
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
        // 계좌 분석 데이터에 없는 값은 빈칸 (이전: '주거래은행'·'생계비 및 필수 지출 충당' 같은 사용처를 지어냄)
        bankName: item.bankOrCard || (item as any).bankName || '',
        transType: 'WITHDRAWAL',
        amount: item.amount,
        counterparty: item.counterparty || '',
        purposeDetail: item.explanation || (item as any).usageExplanation || (item as any).notes || '',
        evidenceDocName: item.evidenceDocIndex || item.evidenceType || ''
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
      lenderName: loan.counterparty || '',
      amount: loan.amount,
      usageCategory: 'OTHER',
      specificUsage: loan.explanation || (loan as any).usageExplanation || '',
      evidenceDocName: loan.evidenceDocIndex || '',
      // 입금 내역만으로는 사용처가 확인되지 않으므로 항상 '미확인'으로 시작
      verified: false
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
        cardCompany: item.bankOrCard || '',
        merchantName: item.counterparty || '',
        amount: item.amount,
        purpose: item.explanation || (item.riskCategory === 'DANGER_SPECULATION' ? '[투자 관련 지출 — 사용처 확인 필요]' : ''),
        isLuxuryOrGambling: item.riskCategory === 'DANGER_SPECULATION' || item.riskCategory === 'DANGER_LUXURY',
        evidenceNote: item.evidenceType || ''
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
  // 원본 state를 직접 수정하지 않도록 항목까지 복사 (이전: 배열만 복사하고 객체를 제자리 수정)
  const updatedAnswers = briefData.answers.map((a) => ({ ...a }));
  let updatedHighValue = briefData.highValueTrans.map((t) => ({ ...t }));
  let updatedRecentLoans = briefData.recentLoans.map((l) => ({ ...l }));

  // 1. 대출금 사용처 소명표 채번
  if (updatedRecentLoans.length > 0) {
    const loanEvidence = `소갑 제${mainNumber}호증 (대출금 사용처 소명표 및 이체증)`;
    const n = mainNumber;
    updatedRecentLoans = updatedRecentLoans.map((loan, idx) => ({ ...loan, evidenceDocName: `소갑 제${n}호증의 ${idx + 1}` }));

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
    const n = mainNumber;
    updatedHighValue = updatedHighValue.map((tx, idx) => ({ ...tx, evidenceDocName: `소갑 제${n}호증의 ${idx + 1}` }));

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

  // 3. 호증 번호가 비어 있거나 '[호증 번호]' 빈칸인 답변에 순차 채번
  updatedAnswers.forEach((ans) => {
    const ev = ans.attachedEvidence || '';
    if (!ev || ev.includes('[호증 번호]')) {
      const rest = ev.replace('[호증 번호]', '').trim();
      ans.attachedEvidence = `소갑 제${mainNumber}호증${rest ? ` ${rest}` : ' (관련 소명자료)'}`;
      mainNumber++;
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
  const clientName = esc(ctx.clientName);
  const caseNumber = esc(ctx.caseNumber);
  const courtName = esc(ctx.courtName);
  const won = (n: number) => esc((Number(n) || 0).toLocaleString());

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
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(l.loanDate)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(l.lenderName)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${won(l.amount)}원</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${esc(l.specificUsage)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(l.evidenceDocName || '-')}</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">합 계</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">${won(totalAmount)}원</td>
              <td colspan="2" style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">총 ${loans.length}건</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 11px; color: #64748b; margin-top: 15px;">
          ※ 각 대출금의 사용처는 첨부한 금융거래확인서 및 이체증으로 소명합니다.
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
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(w.transDate)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(w.bankName)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${won(w.amount)}원</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(w.counterparty)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${esc(w.purposeDetail)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${esc(w.evidenceDocName || '-')}</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">총 출금액</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">${won(totalAmount)}원</td>
              <td colspan="3" style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">총 ${withdrawals.length}건</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 11px; color: #64748b; margin-top: 15px;">
          ※ 각 출금의 수취인과 사용처는 첨부한 계좌이체확인증 및 영수증으로 소명합니다.
        </p>
      </div>
    `;
  }

  return '';
}
