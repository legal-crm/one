/**
 * 법원 부수/기타신청서 및 개시/인가 사후관리 데이터 타입 정의
 * 강제집행 중지명령, 면제재산결정, 금지명령, 압류해제, 법원 가상계좌, 집회 관리
 */

// 1. 강제집행 중지명령신청서 (Stay Order)
export interface StayOrderPetition {
  id: string;
  clientId: string;
  debtorName: string;
  debtorRrn: string;
  debtorAddress: string;
  courtName: string;            // 회생법원
  mainCaseNumber: string;       // 본안사건번호 (2026개회OO)
  
  // 중지 대상 집행사건 정보
  executionCourt: string;       // 집행법원 (예: 서울동부지방법원)
  executionCaseNumber: string;  // 집행사건번호 (예: 2026타채1234, 2026타경567)
  executionType: 
    | 'SALARY_ATTACHMENT'       // 급여 압류 및 추심명령
    | 'BANK_ACCOUNT_ATTACHMENT' // 은행 계좌(예금) 압류
    | 'MOVABLE_PROPERTY'        // 유체동산 압류 (빨간딱지)
    | 'REAL_ESTATE_AUCTION'     // 부동산 강제/임의경매
    | 'OTHER';
  
  creditorName: string;         // 채권자 (압류권자)
  thirdPartyDebtor?: string;    // 제3채무자 (예: 주식회사 카카오, 국민은행 등)
  claimAmount: number;          // 청구금액 (원)
  
  stayReason: string;           // 중지신청 사유
  createdAt: string;
}

// 2. 면제재산결정신청서 (Exempt Property Petition)
export interface ExemptPropertyPetition {
  id: string;
  clientId: string;
  debtorName: string;
  courtName: string;
  mainCaseNumber: string;
  
  // 면제 신청 재산 구분
  exemptCategory: 
    | 'HOUSING_LEASE_DEPOSIT'   // 주거용 건물 임차보증금 반환채권
    | 'SIX_MONTHS_LIVING_COST'; // 6개월간의 생계비 (1,110만 원)
  
  targetAssetName: string;      // 임차목적물 소재지 및 계약 정보 또는 계좌명
  totalAssetAmount: number;     // 자산 총액
  requestedExemptAmount: number;// 면제 신청 금액 (서울 최대 5,500만 또는 생계비 1,110만)
  
  // 채무자회생법 제383조 제2항 / 제580조 제3항 신청 취지 및 이유
  petitionReason: string;       // 주거 안정 및 최소한의 인간다운 생활 유지 필요성
  createdAt: string;
}

// 3. 금지명령신청서 및 실시간 추심 방어 가이드
export interface StayHarassmentNotice {
  debtorName: string;
  caseNumber: string;
  courtName: string;
  lawFirmName: string;
  lawFirmPhone: string;
  filedDate: string;
  stayOrderIssuedDate?: string;
  
  // 의뢰인용 대처 가이드 매뉴얼 팁
  guidelineForCollectors: {
    rule1: string; // "사건번호를 고지하고 대리인 사무실로 연락할 것을 통보하십시오."
    rule2: string; // "채권의 공정한 추심에 관한 법률 제8조의2에 의해 대리인 선임 통보 후 채무자 직접 연락은 불법입니다."
    rule3: string; // "야간(21시~08시) 연락, 직장 방문, 제3자 고지 행위는 과태료 처분 대상입니다."
  };
}

// 4. 인가결정 후 압류해제신청서 (Levy Release)
export interface LevyReleasePetition {
  id: string;
  clientId: string;
  debtorName: string;
  courtName: string;            // 인가법원
  mainCaseNumber: string;       // 인가 확정 사건번호
  confirmationDate: string;     // 변제계획인가결정 확정일
  
  // 해제 대상 사건 정보
  executionCourt: string;       // 압류 집행법원
  executionCaseNumber: string;  // 압류 사건번호 (2025타채OO)
  seizingCreditorName: string;  // 압류 채권자
  thirdPartyDebtor: string;     // 제3채무자 (예: 국민은행, 주식회사 OO)
  
  releaseReason: string;        // 채무자회생법 제615조에 의한 실효 및 압류해제 신청
  createdAt: string;
}

// 5. 개시결정 이후 법원 가상계좌 및 소급 적립금 관리
export interface CourtVirtualAccountPlan {
  courtName: string;
  caseNumber: string;
  virtualAccountBank: string;   // 신한은행, 농협 등
  virtualAccountNumber: string; // 법원 지정 가상계좌
  accountHolder: string;        // 회생위원 (예: 서울회생법원 홍길동)
  
  monthlyPayment: number;       // 월 변제금 (원)
  paymentDayOfMonth: number;    // 매월 변제일 (보통 25일)
  commencementDate: string;     // 개시결정일
  retroactiveStartMonth: string;// 소급 기준월 (신청 후 60~90일 시점)
  accumulatedMonths: number;    // 개시결정까지 누적된 지연 개월수
  totalAccumulatedDue: number;  // 일괄 소급 납부 필요 총액 (월 변제금 * 누적월)
  
  // 적립금 납부 스케줄
  scheduleItems: {
    round: number;
    yearMonth: string;
    amount: number;
    isPaid: boolean;
    paidDate?: string;
  }[];
}

// 6. 채권자집회 출석 및 이의신청 관리
export interface CreditorsMeetingPlan {
  meetingDate: string;          // 집회 일시 (YYYY-MM-DD HH:mm)
  meetingPlace: string;         // 집회 법정 (예: 서울회생법원 제3호 법정)
  dDay: number;
  preparationChecklist: {
    bringIdCard: boolean;       // 주민등록증/운전면허증 필참
    bringNoticeLetter: boolean; // 채권자집회 통지서
    dressCodeNotice: boolean;   // 단정한 복장
    noLateWarning: boolean;     // 10분 전 입정 (지각 시 즉시 불출석 처리)
  };
  objections: {
    id: string;
    creditorName: string;
    objectionType: 'DEBT_TRANSFER' | 'AMOUNT_DISPUTE' | 'FRAUD_CLAIM'; // 채권양도, 금액이의, 부정행위주장
    content: string;
    responseDraft?: string;     // 이의답변서 초안
    status: 'RECEIVED' | 'ANSWERED' | 'SETTLED';
  }[];
}

// 7. 법원별 미납 폐지 실무 기준 및 임계치
export interface CourtRepealThreshold {
  courtName: string;
  cautionRounds: number;       // 1~2회 주의
  warningRounds: number;       // 3회 경고 (폐지예고 통지서)
  repealRiskRounds: number;    // 폐지 착수 임계치 (서울 4~5회, 수원/부산 3회, 지방 3회 즉시)
  leniencyLevel: 'HIGH_FLEXIBLE' | 'MODERATE' | 'STRICT'; // 서울(유연) / 수원·부산(보통) / 지방(엄격)
  description: string;
  goldenTimeNotice: string;
}

// 8. 미납·폐지방어 3대 법원 서식 구분
export type RepealDefensePetitionType = 
  | 'REPAYMENT_PLAN_MODIFICATION' // 변제계획 변경신청서 (급여감소, 실직, 부양가족)
  | 'SPECIAL_DISCHARGE'           // 채무자회생법 제624조 제2항 특별면책신청서
  | 'IMMEDIATE_APPEAL';           // 폐지결정에 대한 즉시항고장 (14일 이내)

// 9. 변제금 미납·폐지방어 종합 플랜
export interface OverdueDefensePlan {
  courtName: string;
  overdueCount: number;
  unpaidRoundNumbers: number[];
  monthlyRepayment: number;
  totalOverdueAmount: number;
  threshold: CourtRepealThreshold;
  riskStage: 'SAFE' | 'CAUTION_1_2' | 'WARNING_3' | 'REPEAL_RISK_4' | 'REPEALED_APPEAL';
  repealedDate?: string;
  immediateAppealDeadline?: string; // 공고일로부터 14일 불변기간
  liquidationValue?: number;         // 특별면책 검토용 청산가치
  totalPaidAmount?: number;          // 기납부 변제액
}
