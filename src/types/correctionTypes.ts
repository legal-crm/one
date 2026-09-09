/**
 * 법원 보정권고 / 보정명령 4대 탭 및 7대 표준 소명표 데이터 타입 정의
 * 서울회생법원 및 대법원 실무준칙 규격 반영
 */

// 1. 7대 표준 소명표 항목 정의

// (1) 최근 1~2년 대출금 사용처 소명표
export interface RecentLoanUsageItem {
  id: string;
  loanDate: string;             // 대출일자
  lenderName: string;           // 대출 금융기관
  amount: number;               // 대출원금 (원)
  usageCategory: 'LIVING' | 'DEBT_REPAYMENT' | 'MEDICAL' | 'BUSINESS' | 'INVESTMENT' | 'OTHER';
  specificUsage: string;        // 구체적 사용처 (예: 신한카드 대금 결제, 병원 수술비 등)
  evidenceDocName?: string;     // 소명자료명 (소갑 제O호증)
  evidenceDocUrl?: string;
  verified: boolean;            // 금융자료 대조 확인 여부
}

// (2) 신용카드 사용내역 및 사치성 지출 배제 소명표
export interface CreditCardUsageItem {
  id: string;
  transactionDate: string;      // 결제일시
  cardCompany: string;          // 카드사
  merchantName: string;         // 가맹점명
  amount: number;               // 결제금액 (원)
  purpose: string;              // 지출 목적 (생필품, 공과금, 병원비 등)
  isLuxuryOrGambling: boolean;  // 사치·유흥·도박 여부 (청산가치 가산 대상 여부)
  evidenceNote?: string;        // 영수증/소명 내용
}

// (3) 50만 원 ~ 100만 원 이상 고액 계좌거래내역 소명표
export interface HighValueTransactionItem {
  id: string;
  transDate: string;            // 거래일자
  bankName: string;             // 거래은행 및 계좌
  transType: 'WITHDRAWAL' | 'DEPOSIT'; // 출금 / 입금
  amount: number;               // 거래금액 (원)
  counterparty: string;         // 상대방 성명/상호
  purposeDetail: string;        // 거래 사유 및 자금 귀속처 소명
  evidenceDocName?: string;     // 통장사본, 이체증 (소갑 제O호증)
}

// (4) 최근 1년 소득 산정 및 실수령액 산출표
export interface IncomeCalculationMonth {
  month: string;                // YYYY-MM
  grossPay: number;             // 기본급 + 수당 총액
  statutoryDeductions: number;  // 4대보험 + 소득세 합계
  netPay: number;               // 실수령액 (원)
  note?: string;                // 명절상여금, 야간수당 등 특이사항
}

// (5) 보장성 보험 해약환급금 및 150만 원 공제 소명표
export interface InsuranceSurrenderItem {
  id: string;
  insurerName: string;          // 보험사명
  policyNumber: string;         // 증권번호
  insuredPerson: string;        // 피보험자
  contractorName: string;       // 계약자
  surrenderRefund: number;      // 현재 해약환급금 (원)
  loanAgainstPolicy: number;    // 약관대출금 (원)
  netRefund: number;            // 순 해약환급금 (원)
  statutoryExemption: number;   // 법정 압류금지액 (최대 1,500,000원)
  liquidationInclusion: number; // 청산가치 반영액 (순환급금 - 공제액)
  isEssentialMedical: boolean;  // 실손의료보험 여부
}

// (6) 과거 회생/파산/워크아웃 사건 비교 및 재신청 사유 소명표
export interface PastCaseComparisonItem {
  id: string;
  caseType: 'REHABILITATION' | 'BANKRUPTCY' | 'WORKOUT';
  courtOrAgency: string;        // 관할법원 또는 신용회복위원회
  caseNumber: string;           // 종전 사건번호
  dispositionDate: string;      // 인가/면책/폐지 결정일
  dispositionResult: 'DISCHARGED' | 'DISMISSED' | 'REVOKED' | 'WITHDRAWN'; // 면책, 기각, 폐지, 취하
  causeOfRevocation?: string;   // 종전 사건 폐지 원인 (변제금 미납, 이직 등)
  currentImprovement: string;   // 금번 사건에서의 개선점 및 성실이행 가능성
}

// (7) 배우자 및 친족 재산형성 자금출처 소명표
export interface FamilyAssetOriginItem {
  id: string;
  relationship: 'SPOUSE' | 'PARENT' | 'CHILD' | 'OTHER';
  familyMemberName: string;     // 가족 성명
  assetName: string;            // 자산명 (예: 배우자 명의 전세보증금, 차량)
  marketValue: number;          // 자산 가액 (원)
  registeredDate: string;       // 취득일자
  originExplanation: string;    // 고유재산 취득 자금 출처 (상속, 증여, 본인 급여 등)
  debtorContributionRate: number; // 채무자 기여도 (원칙 0%, 법원 권고 시 반영)
  liquidationIncludedAmount: number; // 청산가치 반영액
  evidenceDocName?: string;     // 증빙 (부모 증여계약서, 배우자 소득원천징수 등)
}

// 2. 의뢰인 추가 소명자료 체크리스트
export interface CorrectionDocumentRequestItem {
  id: string;
  docTitle: string;             // 서류명
  targetTarget: string;         // 제출 대상 (본인/배우자)
  description: string;          // 요청 상세
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  fileUrl?: string;
  fileName?: string;
  rejectedReason?: string;
  evidenceNumber?: string;      // 소갑 제O호증 부여
}

// 3. 법원 보정서 (Court Correction Brief) 모델
export interface CorrectionBriefData {
  id: string;
  round: number;                // 보정 차수 (1차, 2차...)
  title: string;                // 보정서 제목 (예: 제1차 보정권고에 대한 보정서)
  courtName: string;            // 관할 법원
  caseNumber: string;           // 사건번호
  debtorName: string;           // 채무자 성명
  agentName: string;            // 대리인 변호사
  servedDate: string;           // 송달일자 (YYYY-MM-DD)
  dueDate: string;              // 제출기한 (송달일 + 14일)
  dDay: number;                 // 남은 일수
  isOverdue: boolean;
  trusteeName?: string;         // 회생위원 성명
  
  // 소명 내용 (항목별 답변)
  answers: {
    pointNumber: number;        // 보정사항 번호 (1항, 2항...)
    courtInstruction: string;   // 법원 보정 지시사항
    debtorResponse: string;     // 채무자 대리인 소명 요지
    attachedEvidence?: string;  // 첨부서류 (소갑 제O호증)
  }[];

  // 7대 소명표 데이터
  recentLoans: RecentLoanUsageItem[];
  creditCards: CreditCardUsageItem[];
  highValueTrans: HighValueTransactionItem[];
  monthlyIncomes: IncomeCalculationMonth[];
  insurances: InsuranceSurrenderItem[];
  pastCases: PastCaseComparisonItem[];
  familyAssets: FamilyAssetOriginItem[];

  // 의뢰인 추가서류
  docRequests: CorrectionDocumentRequestItem[];

  // 기한연장 신청 이력
  extensionRequested?: boolean;
  extensionReason?: string;
  extensionNewDueDate?: string;

  createdAt: string;
  updatedAt: string;
}
