/**
 * 개인파산 및 면책 동시신청 종합 데이터 타입 정의
 * 대법원 및 서울회생법원 개인파산·면책 실무준칙 + 리걸플로 실무 규격 반영
 */

// 1. 파산 및 면책 신청서 (Petition)
export interface BankruptcyPetition {
  id: string;
  clientId: string;
  debtorName: string;
  debtorRrn: string;
  debtorAddress: string;
  registeredDomicile?: string;  // 등록기준지 (가족관계증명서 기준)
  serviceAddress?: string;      // 송달장소 (대리인 사무소 등)
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
  debtorStoryRaw?: string;      // 의뢰인 사전 입력 원본 진술 (모바일 연동)
  debtorStoryPolished?: string; // 변호사 감수 및 정리 완료된 법률 진술문

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
  
  // 과거 법적 이력 체크
  pastDischargeHistory?: {
    hasPastDischarge: boolean;
    caseNumber?: string;
    dischargeDate?: string;
    isElapsedEligible: boolean; // 7년 경과 여부
  };
  concurrentFamilyBankruptcy?: {
    hasConcurrent: boolean;
    relation?: string;
    caseNumber?: string;
  };
  criminalRecordForFraud?: {
    hasRecord: boolean;
    detail?: string;
  };
}

// 3. 채권자목록 & 소송/가압류 이력
export interface BankruptcyCreditorItem {
  id: string;
  creditorName: string;
  debtCause: 'CASH_LOAN' | 'CREDIT_CARD' | 'PURCHASE_GOODS' | 'INDEMNITY' | 'GUARANTEE' | 'PRIVATE_LOAN' | 'OTHER';
  debtCauseDetail: string;      // 대출금, 카드대금, 물품대금 등
  borrowedDate: string;         // 최초 발생일자
  principal: number;            // 원금
  interest: number;             // 이자
  isNonDischargeable: boolean;  // 비면책 채권 여부 (조세, 양육비, 벌금, 불법행위 손해배상)
  lawsuitInfo?: {
    hasLawsuit: boolean;
    lawsuitType?: 'LOAN_LAWSUIT' | 'PAYMENT_ORDER' | 'SEIZURE_COLLECTION' | 'CHATTEL_SEIZURE' | 'AUCTION' | 'OTHER';
    courtName?: string;
    caseNumber?: string;
    statusText?: string;
  };

  // 법원 송달용 채권자 주소 및 법인 정보
  zipCode?: string;                // 우편번호
  address?: string;                // 본점 소재지 / 주소
  serviceAddress?: string;         // 법원 우편물 송달장소
  representative?: string;         // 대표자
  bizNumber?: string;              // 법인/사업자/주민번호
}

// 4. 파산관재인 5대 심층 조사재산 (리걸플로 핵심 벤치마킹)
export interface DisposedAssetItem {
  id: string;
  itemTitle: string;            // 처분 품목 (예: 경기 안양시 아파트, 승용차)
  disposedDate: string;         // 처분 일자
  disposedAmount: number;       // 매각/처분 금액 (원)
  counterparty: string;         // 매수인/상대방 (친인척 여부)
  usageDetail: string;          // 매각대금 사용처 소명 (금융기관 상환, 생활비 등)
}

export interface ReturnedDepositItem {
  id: string;
  housingAddress: string;       // 종전 임차지 주소
  returnedDate: string;         // 보증금 수령 일자
  returnedAmount: number;       // 반환받은 보증금 (원)
  usageDetail: string;          // 반환금 사용처 소명 (월세/의료비/타채무변제)
}

export interface DivorceDivisionItem {
  hasDivorceWithin2Years: boolean;
  divorceDate?: string;
  divorceType?: 'CONSENSUS' | 'JUDICIAL';
  propertyDivisionAmount?: number; // 재산분할 금액 (원)
  alimonyAmount?: number;          // 위자료 (원)
  divisionDetail?: string;         // 재산분할 내역 및 소명
}

export interface InheritanceItem {
  hasInheritance: boolean;
  decedentRelation?: string;       // 망인과의 관계 (부, 모, 배우자 등)
  dateOfDeath?: string;            // 사망일자 (상속개시일)
  inheritanceAssetsDetail?: string;// 상속 재산 내역 (토지/주택 등)
  divisionStatus?: 'WAIVED' | 'AGREED_DIVISION' | 'LEGAL_PORTION' | 'NONE'; // 상속포기, 협의분할, 법정상속분, 없음
  waiverCourtAndDate?: string;     // 상속포기·한정승인 수리 법원 및 일자
  notes?: string;
}

export interface SeverancePayItem {
  hasSeverance: boolean;
  companyName?: string;
  expectedTotalAmount: number;     // 예상 퇴직금 총액 (원)
  exemptAmount: number;            // 1/2 압류금지액 (원)
  liquidationAmount: number;       // 파산재단 환가 대상액 (원)
}

export interface BankruptcyInvestigationAssets {
  disposedAssets1Year: DisposedAssetItem[];       // 1. 최근 1년 내 처분재산
  returnedDeposits2Years: ReturnedDepositItem[];   // 2. 최근 2년 내 반환 임차보증금
  divorceProperty2Years: DivorceDivisionItem;     // 3. 최근 2년 내 이혼 재산분할
  inheritanceProperty: InheritanceItem;           // 4. 친족 사망 상속재산
  severancePay: SeverancePayItem;                 // 5. 퇴직금 (1/2 압류금지)
}

// 5. 현재의 생활상황표 & 가계수지표 (주거 6분류 & 비면책 조세 체납표)
export type BankruptcyResidenceType = 
  | 'APPLICANT_OWNED'      // 1. 신청인 소유 부동산
  | 'DORMITORY'            // 2. 사택 또는 기숙사
  | 'RENT_LEASE'           // 3. 임차(전·월세) 주택
  | 'RELATIVE_FREE'        // 4. 친족 소유 주택에 무상거주
  | 'NON_RELATIVE_FREE'    // 5. 친족 외 소유 주택에 무상거주
  | 'OTHER';               // 6. 기타

export interface BankruptcyResidenceDetail {
  residenceType: BankruptcyResidenceType;
  startDate: string;            // 거주시작 시점
  deposit: number;              // 보증금 (원)
  monthlyRent: number;          // 월세 (원)
  ownerName?: string;           // 소유자 성명
  ownerRelation?: string;       // 소유자와의 관계 (부, 모, 지인 등)
  freeStayReason?: string;      // 무상거주 사유
}

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

export interface TaxArrearsDetail {
  incomeTax: number;            // 소득세/국세
  localIncomeTax: number;       // 주민세/지방소득세
  propertyTax: number;          // 재산세/자동차세
  healthInsurance: number;      // 건강보험료 체납
  nationalPension: number;      // 국민연금 체납
  otherTax: number;             // 기타 공과금
  totalArrears: number;         // 비면책 조세 총 체납액 (자동 합계)
}

export interface MonthlyBudgetLedger {
  // 수입
  earnedIncome: number;         // 본인 근로소득
  pensionOrWelfare: number;     // 기초연금/생계급여/장애수당
  familySupport: number;        // 가족 지원금
  totalIncome: number;          // 총 월수입 (A)

  // 필수 지출 (가계수지 기본 8개 항목)
  housingRent: number;          // 주거비 (월세, 관리비)
  foodAndDailySupplies: number; // 식비 (외식비 포함)
  educationExpenses: number;    // 교육비
  utilitiesAndCommunication: number; // 전기·가스·수도·통신비
  transportation: number;       // 교통비 (차량유지비 포함)
  clothingExpenses?: number;    // 피복비
  medicalExpenses: number;      // 의료비 / 약값
  otherLivingExpense?: number;  // 기타 필수비용
  totalLivingExpense: number;   // 총 필수지출 (B)

  // 가용소득 검증
  disposableIncome: number;     // A - B (<= 0원 이어야 파산 적격)
  isDisposableZeroOrNegative: boolean;
}

// 6. 기본 파산 재산목록 (1,110만 원 면제재산 계산기)
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

// 7. 파산 15대 필수자료제출목록 체크리스트 (Required Documents)
export interface BankruptcyRequiredDoc {
  id: string;
  itemNumber: number;           // 1 ~ 15
  category: string;
  title: string;
  detailDescription: string;
  isMandatory: boolean;
  status: 'PREPARING' | 'SUBMITTED' | 'UNOBTAINABLE'; // 준비중, 제출완료, 발급불가(사유서대체)
  unobtainableReason?: string;  // 발급 불가 또는 일부 제출 사유 (리걸플로 실무 양식)
  fileUrl?: string;
  fileName?: string;
}

// 종합 파산 사건 모델
export interface BankruptcyFullCaseData {
  petition: BankruptcyPetition;
  statement: BankruptcyStatement;
  creditors?: BankruptcyCreditorItem[];
  investigationAssets?: BankruptcyInvestigationAssets; // 파산관재인 5대 심층 조사재산
  livingCondition: {
    residence?: BankruptcyResidenceDetail;
    familyMembers: FamilyMemberItem[];
    taxArrears?: TaxArrearsDetail;
    budgetLedger: MonthlyBudgetLedger;
  };
  assets: BankruptcyAssetItem[];
  requiredDocs: BankruptcyRequiredDoc[];
  totalLiquidationEstate: number; // 최종 파산재단 가액 (0원이면 동시폐지 대상)
  isSimultaneousDismissalEligible: boolean; // 파산폐지(동시폐지) 적격 여부
  lastSavedAt: string;
}
