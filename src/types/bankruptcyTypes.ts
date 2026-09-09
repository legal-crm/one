/**
 * 개인파산 및 면책 동시신청 종합 데이터 타입 정의
 * 대법원 및 서울회생법원 개인파산·면책 실무준칙 규격 반영
 */

// 1. 파산 및 면책 신청서 (Petition)
export interface BankruptcyPetition {
  id: string;
  clientId: string;
  debtorName: string;
  debtorRrn: string;
  debtorAddress: string;
  courtName: string;            // 관할 법원 (예: 서울회생법원)
  filingDate: string;           // 신청일자
  attorneyName: string;         // 대리인 변호사
  
  // 지급불능 상태 개요
  totalDebtPrincipal: number;   // 채무 원금 합계 (원)
  totalDebtInterest: number;    // 이자 합계 (원)
  totalAssetsValue: number;     // 총 재산 평가액 (원)
  netExemptAssets: number;      // 면제재산 및 압류금지 합계 (원)
  liquidationValue: number;     // 파산재단 환가 예상액 (원)
  monthlyNetIncome: number;     // 월 실수령 소득 (원)
  householdMembersCount: number;// 동거 부양가족 수 (인)
  minimumLivingCost: number;    // 인정 최저생계비 (원)
  
  // 신청 취지
  petitionRelief: {
    bankruptcy: string;         // "1. 채무자를 파산자에 처한다."
    discharge: string;          // "2. 채무자를 면책한다."
    orderStay: boolean;         // 강제집행 중지 신청 병행 여부
  };
  
  // 지급불능의 주된 원인
  insolvencyCause: 
    | 'BUSINESS_FAILURE'        // 사업 실패 및 폐업
    | 'UNEMPLOYMENT_ILLNESS'    // 실직, 질병, 부상
    | 'GUARANTEE_DEBT'          // 타인 보증 채무
    | 'LIVING_COST_SHORTAGE'    // 저소득 및 생활비 부족 누적
    | 'FRAUD_DAMAGE'            // 사기 피해 / 전세 사기
    | 'OTHER';
  
  insolvencyCauseDetail: string;// 지급불능에 이르게 된 구체적 사정
}

// 2. 파산 진술서 (Statement & Risk Screening)
export interface BankruptcyStatement {
  // 경력 및 학력
  finalEducation: string;
  pastJobHistory: {
    period: string;             // 기간 (예: 2018.03 ~ 2022.12)
    companyName: string;        // 직장명/사업체명
    position: string;           // 직위/업종
    reasonForLeaving: string;   // 퇴직/폐업 사유
  }[];

  // 생활 상황 변천사
  livingHistory: string;        // 채무가 늘어나게 된 과정 및 현재 상황

  // 채무자회생법 제564조 면책불허가사유 8대 항목 자가진단
  disallowanceScreening: {
    gamblingOrSpeculation: boolean;  // 1. 과다한 낭비 또는 도박/코인 투기 행위
    fraudulentLoan: boolean;         // 2. 신용사기(허위 소득 증빙, 단기 고액 대출)
    preferentialPayment: boolean;    // 3. 편파변제 (특정 친인척만 변제)
    concealmentOfAssets: boolean;    // 4. 재산 은닉, 명의이전, 헐값 처분
    falseCreditorList: boolean;      // 5. 허위 채권자목록 제출 (고의 누락)
    pastDischargeWithinYears: boolean; // 6. 과거 면책 후 7년(파산) / 5년(회생) 미경과
    falseReportToTrustee: boolean;   // 7. 파산관재인에 대한 허위 진술 / 자료 거부
    creditTransactionBeforeFiling: boolean; // 8. 파산 직전 신용카드/대출 발생
  };

  screeningNotes: Record<string, string>; // 항목별 방어 논리 및 소명 메모
  pastDischargeHistory?: {
    hasPastDischarge: boolean;
    caseNumber?: string;
    dischargeDate?: string;
    isElapsedEligible: boolean; // 7년 경과 여부
  };
}

// 3. 현재의 생활상황표 & 가계수지표 (Living Conditions & Budget)
export interface FamilyMemberItem {
  id: string;
  relationship: string;         // 배우자, 자녀, 모 등
  name: string;
  age: number;
  job: string;                  // 무직, 학생, 아르바이트 등
  monthlyIncome: number;        // 월 수입 (원)
  isCohabiting: boolean;        // 동거 여부
  isDependent: boolean;         // 부양 여부
}

export interface MonthlyBudgetLedger {
  // 수입
  earnedIncome: number;         // 본인 근로소득
  pensionOrWelfare: number;     // 기초연금/생계급여/장애수당
  familySupport: number;        // 가족 지원금
  totalIncome: number;          // 총 월수입 (A)

  // 필수 지출 (가계수지)
  housingRent: number;          // 주거비 (월세)
  medicalExpenses: number;      // 정기 의료비/약값
  foodAndDailySupplies: number; // 식비 및 생필품비
  utilitiesAndCommunication: number; // 공과금, 전기/가스, 통신비
  educationExpenses: number;    // 자녀 공교육비
  transportation: number;       // 대중교통비
  totalLivingExpense: number;   // 총 필수지출 (B)

  // 가용소득 검증
  disposableIncome: number;     // A - B (<= 0원 이어야 파산 적격)
  isDisposableZeroOrNegative: boolean;
}

// 4. 파산 재산목록 및 1,110만 원 면제재산 계산기 (Bankruptcy Assets)
export interface BankruptcyAssetItem {
  id: string;
  assetName: string;            // 예: 서울 보증금 4,500만, 신한은행 잔고 80만
  assetCategory: 'CASH_DEPOSIT' | 'HOUSING_DEPOSIT' | 'CAR' | 'INSURANCE' | 'REAL_ESTATE' | 'OTHER';
  marketValue: number;          // 시가 평가액 (원)
  seniorLien: number;           // 담보 채무 (원)
  
  // 법정 면제재산 및 압류금지 공제
  statutoryExemption: number;   // 소액임차보증금(서울 5,500만 등) 또는 6개월 생계비(1,110만 원)
  appliedExemptionType: 'SMALL_HOUSING_DEPOSIT' | 'SIX_MONTH_LIVING_1110' | 'DEPOSIT_185' | 'INSURANCE_150' | 'NONE';
  
  liquidationValue: number;     // 최종 환가대상 가액 = max(0, 시가 - 담보 - 면제액)
  isExcludedFromEstate: boolean;// 파산재단 환가 배제 확정 여부 (자유재산)
  evidenceDocName?: string;
}

// 5. 파산 15대 필수자료제출목록 체크리스트 (Required Documents)
export interface BankruptcyRequiredDoc {
  id: string;
  itemNumber: number;           // 1 ~ 15
  category: string;
  title: string;
  detailDescription: string;
  isMandatory: boolean;
  status: 'PREPARING' | 'SUBMITTED' | 'UNOBTAINABLE'; // 준비중, 제출완료, 발급불가(사유서대체)
  unobtainableReason?: string;  // 발급 불가 사유 (예: 금융기관 파산폐쇄, 사실조회 신청 등)
  fileUrl?: string;
  fileName?: string;
}

// 종합 파산 사건 모델
export interface BankruptcyFullCaseData {
  petition: BankruptcyPetition;
  statement: BankruptcyStatement;
  livingCondition: {
    familyMembers: FamilyMemberItem[];
    budgetLedger: MonthlyBudgetLedger;
  };
  assets: BankruptcyAssetItem[];
  requiredDocs: BankruptcyRequiredDoc[];
  totalLiquidationEstate: number; // 최종 파산재단 가액 (0원이면 동시폐지 대상)
  isSimultaneousDismissalEligible: boolean; // 파산폐지(동시폐지) 적격 여부
  lastSavedAt: string;
}
