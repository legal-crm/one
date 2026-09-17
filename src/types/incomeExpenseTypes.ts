/**
 * 대법원 전산양식 [D5103] 채무자의 수입 및 지출에 관한 목록 데이터 모델
 * 채무자 회생 및 파산에 관한 법률 제589조 제2항 제3호 및 법원 실무준칙 준용
 */

export type DebtorIncomeType = 'SALARY' | 'BUSINESS' | 'PENSION_OTHER';

export type CohabitationStatus = '동거' | '별거';

/** 1. 급여소득자 수입 상세 */
export interface SalaryIncomeDetail {
  employerName: string;            // 직장명
  jobTitle: string;                // 직위 / 직종
  employmentStartDate: string;     // 입사일자 (YYYY-MM-DD)
  hasRecentJobChange: boolean;     // 최근 1년 이내 직장 변동 여부
  
  monthlyBasePay: number;          // 매월 정기 수령액 (기본급+수당, 원)
  annualBonus: number;             // 정기상여금·연말성과급 등 연간 총액 (원)
  monthlyBonusConverted: number;   // 상여금 월 환산액 (annualBonus / 12, 원)
  grossMonthlyIncome: number;      // 공제 전 월 총수입 (monthlyBasePay + monthlyBonusConverted)
  
  // 법 제579조 제4호 나목 법정 공제세액 및 4대보험
  incomeTax: number;               // 소득세 (원)
  residentTax: number;             // 주민세 (지방소득세, 원)
  healthInsurance: number;         // 건강보험료 (장기요양 포함, 원)
  nationalPension: number;         // 국민연금 (원)
  employmentInsurance: number;     // 고용보험료 (원)
  industrialAccidentInsurance: number; // 산재보험료 등 기타 (원)
  totalStatutoryDeductions: number;// 법정 공제액 합계 (원)
  
  netMonthlyIncome: number;        // 월 실수령 순수입 (grossMonthlyIncome - totalStatutoryDeductions)
  annualConvertedIncome: number;   // 연간 환산 총 순수입 (netMonthlyIncome * 12)
  
  evidenceDocuments: string[];     // 첨부 소명자료 (원천징수영수증, 급여통장, 급여명세서 등)
}

/** 2. 영업소득자 수입 상세 */
export interface BusinessIncomeDetail {
  businessCategory: '사업소득' | '부동산임대소득' | '농업소득' | '임업소득' | '기타소득';
  businessName: string;            // 상호명
  businessRegistrationNo: string;  // 사업자등록번호
  
  annualGrossRevenue: number;      // 최근 1년간 연간 총매출액 (원)
  annualOperatingExpenses: number; // 영업경영·보존·계속 필수비용 (법 제579조 제4호 라목, 원)
  annualTaxes: number;             // 소득세 등 제세공과금 (원)
  netAnnualBusinessIncome: number; // 연간 순소득액 (매출 - 경비 - 세금)
  monthlyAverageIncome: number;    // 월평균 순수입액 (Math.ceil(netAnnualBusinessIncome / 12))
  
  evidenceDocuments: string[];     // 소명자료 (사업자등록증, 부가세표준, 종소세신고서, 세금계산서합계표 등)
}

/** 3. 기타 연금 및 보조금 수입 상세 */
export interface OtherIncomeDetail {
  pensionMonthly: number;          // 국민/퇴직/개인 연금 (원/월)
  subsidyMonthly: number;          // 기초생활수급 등 보조금 (원/월)
  familySupportMonthly: number;    // 계속적 가족 지원금 (원/월)
  totalOtherMonthly: number;       // 기타 월수입 합계 (원)
}

/** 4. 수입에 대한 강제집행 (압류·가압류) 현황 */
export interface IncomeSeizureDetail {
  hasSeizure: boolean;             // 압류/가압류 유무
  courtName: string;               // 결정 법원
  caseNumber: string;              // 사건번호
  creditorName: string;            // 상대방 채권자
  seizedAmount: number;            // 압류된 금액 (원)
  notes?: string;                  // 특이사항
}

/** 5. 피부양자 및 동거가족 명세 */
export interface FamilyMemberItem {
  id: string;
  relationship: string;            // 배우자, 부, 모, 자, 녀, 형제자매 등
  name: string;                    // 성명
  birthDate: string;               // 생년월일 (YYYY.MM.DD) 또는 나이
  cohabitationStatus: CohabitationStatus; // 동거 / 별거
  cohabitationPeriod: string;      // 동거 기간 (예: 5년, 주민등록 등본 기준)
  isSupportedByDebtor: boolean;    // 채무자의 수입에 의해 부양되는지 유무
  hasIncome: boolean;              // 소득 유무
  jobAndIncomeDetail: string;      // 직업 및 월수입 내역 (예: 고등학생(소득없음), 주부, 알바 60만원 등)
  isEligibleDependent: boolean;    // 법정 부양가족 인정 적격 여부
  ineligibilityReason?: string;    // 제외/유보 사유 (예: 만 19세 이상, 1인 최저생계비 이상 소득)
  
  // ── 스마트 연령 판정 & OCR 파싱 연동 필드 ──
  parsedAge?: number;              // 정밀 산출된 만 나이
  isMinor?: boolean;               // 만 19세 미만 미성년자 여부
  ageCategory?: 'minor' | 'seoul_college' | 'adult' | 'elderly'; // 연령 구간
  ageBadgeText?: string;           // 화면 표시용 뱃지 문구 (예: '만 12세 👶 미성년자')
  ageBadgeColor?: string;          // 뱃지 색상 테마
  source?: 'manual' | 'ocr_registration' | 'ocr_family'; // 등록 출처
}

/** 6. 지출 및 생계비 명세 */
export interface ExpenseAndLivingDetail {
  householdSize: number;           // 가족 수 (본인 포함 부양가족 수)
  statutoryBaseCost2026: number;   // 2026 기준중위소득 60% 법정 기초생계비 (원)
  
  claimedCostOption: 'BELOW_60' | 'ABOVE_60'; // 기준중위소득 60% 이하 vs 초과
  claimedBaseCost: number;         // 채무자 신청 기본 생계비 (원)
  
  // 추가 생계비 주장 항목
  additionalHousing: number;       // 추가 주거비 (월세 초과분, 원)
  additionalMedical: number;       // 지속적 필수 의료비 (만성질환 등, 원)
  additionalEducation: number;     // 자녀 필수 교육비 (원)
  additionalChildSupport: number;  // 이혼 양육비 지급액 (원)
  additionalOther: number;         // 기타 인정비용 (간병비 등, 원)
  
  additionalReasonDetail: string;  // 추가 생계비 소명 사유 및 필요성 서술
  additionalEvidenceDocs: string[];// 추가 생계비 입증 서류 목록
  
  totalAdditionalExpenses: number; // 추가 생계비 합계 (원)
  totalMonthlyExpense: number;     // 월평균 총 지출액 (claimedBaseCost + totalAdditionalExpenses)
}

/** 7. 가용소득 산출 결과 */
export interface DisposableIncomeSummary {
  monthlyNetIncome: number;        // [A] 월평균 순수입 (원)
  monthlyTotalExpense: number;     // [B] 월평균 총지출 (원)
  monthlyDisposableIncome: number; // [A - B] 월 가용소득 (월 변제예정액, 원 미만 올림)
  repaymentMonths: number;         // 변제기간 (36개월 또는 24개월)
  totalDisposableIncome: number;   // 총 가용소득 (monthlyDisposableIncome * repaymentMonths, 원)
}

/** 8. 대법원 전산양식 D5103 전체 도큐먼트 데이터 모델 */
export interface IncomeExpenseD5103Data {
  id: string;
  clientId: string;
  debtorName: string;              // 신청인 성명
  residentNumberMasked?: string;   // 생년월일 / 주민번호
  courtName: string;               // 관할 법원 (예: 서울회생법원)
  caseNumber: string;              // 사건번호
  createdDate: string;             // 작성일자 (YYYY년 MM월 DD일)
  attorneyName: string;            // 대리인 변호사
  
  // 1. 현재의 수입목록
  incomeType: DebtorIncomeType;
  salary: SalaryIncomeDetail;
  business: BusinessIncomeDetail;
  other: OtherIncomeDetail;
  seizure: IncomeSeizureDetail;
  
  // 2. 변제계획 수행시의 예상 지출목록
  expenses: ExpenseAndLivingDetail;
  
  // 3. 가족관계
  familyMembers: FamilyMemberItem[];
  
  // 4. 가용소득 산출 요약
  disposableIncome: DisposableIncomeSummary;
  
  // ── 5대 직업별 맞춤 수지표 & 12개월 엑셀 원장 연동 ──
  detailedIncomeType?: DetailedIncomeType;
  monthlyLedger?: BusinessMonthlyLedger;          // 개인사업자 12개월 수지표
  freelancerLedger?: FreelancerMonthlyLedger;      // 프리랜서 거래처·경비 수지표
  dayLaborerLedger?: DayLaborerLedger;            // 일용직 근무일수·일당 수지표
  partTimeLedger?: PartTimeLedger;                // 아르바이트 근무시간·시급표
  
  // 수지표 고객-변호사 협업 상태 추적
  d5103ClientStatus?: 'not_started' | 'client_submitted' | 'lawyer_reviewed';
  d5103ClientSubmittedAt?: string;
  d5103LawyerReviewedAt?: string;
  
  // 상태 관리
  lastSavedAt?: string;
  isCompleted?: boolean;
}

/** 9. 5대 세부 소득 형태 분류 */
export type DetailedIncomeType = 'EMPLOYEE' | 'BUSINESS' | 'FREELANCER' | 'DAY_LABORER' | 'PART_TIME' | 'MIXED';

/** 10. 동적 경비 항목 (고객 무제한 추가 및 법원 4대 경비 롤업 매핑) */
export interface DynamicExpenseItem {
  id: string;
  name: string;               // 항목명 (예: 배달대행료, 세무기장료, 알바비 등)
  monthlyAmount: number;      // 월 금액 (원)
  rollupTarget: 'operating' | 'rent' | 'utility' | 'electricity'; // 법원 4대 표준 경비 매핑
  receiptFileId?: string;     // 영수증/이체증 첨부 파일 ID
  receiptFileName?: string;   // 파일명
  note?: string;              // 세부 메모
}

/** 11. 12개월 엑셀 수지표 월별 행 모델 (사용자 첨부 엑셀 서식 100% 매핑) */
export interface MonthlyLedgerItem {
  month: string;              // 예: "2024.03" 또는 "24.03"
  incomeCard: number;         // 카드 매출 (원)
  incomeCash: number;         // 현금 매출 (원)
  incomeTotal: number;        // 수입 소계 [카드 + 현금]
  expenseOperating: number;   // 운영비 (원)
  expenseRent: number;        // 월세 (원)
  expenseUtility: number;     // 가스/수도/등유 (원)
  expenseElectricity: number; // 전기요금 (원)
  expenseTotal: number;       // 지출 소계 [운영비 + 월세 + 공과금 + 전기]
  netIncome: number;          // 월 순수익 [수입 소계 - 지출 소계]
}

/** 12. 개인사업자 12개월 전체 수지표 원장 모델 */
export interface BusinessMonthlyLedger {
  months: MonthlyLedgerItem[];
  dynamicExpenses?: DynamicExpenseItem[]; // 고객이 추가한 세부 경비 목록
  annualTotals: {
    totalCard: number;
    totalCash: number;
    totalGrossRevenue: number;     // 연간 총매출
    totalOperating: number;
    totalRent: number;
    totalUtility: number;
    totalElectricity: number;
    totalOperatingExpense: number; // 연간 총경비
    totalNetProfit: number;        // 연간 총순수익
  };
  monthlyAverages: {
    avgGrossRevenue: number;       // 월평균 매출액
    avgOperatingExpense: number;   // 월평균 경비
    avgNetIncome: number;          // 월평균 순소득 (D5103 바인딩)
  };
}

/** 13. 프리랜서(3.3%) 수입상황보고서 모델 */
export interface FreelancerExpenseItem {
  id: string;
  name: string;               // 유류비, 통신비, 프로그램구독료, 배달앱수수료 등
  monthlyAmount: number;      // 월 금액 (원)
  category: 'fuel' | 'telecom' | 'software' | 'fee' | 'material' | 'other';
  receiptFileName?: string;
}

export interface FreelancerMonthlyLedger {
  jobTypeDetail: string;      // 배달라이더, 보험설계사, 학원강사, IT개발자, 지입차주 등
  monthlyGrossIncome: number; // 월평균 총 수수료/입금액 (원)
  expenses: FreelancerExpenseItem[];
  totalMonthlyExpenses: number; // 월평균 필요경비 합계 (원)
  netMonthlyIncome: number;   // 월평균 순소득 (총수입 - 필요경비)
  annualGrossRevenue: number; // 연 환산 수입
  evidenceDocuments: string[];
}

/** 14. 일용직 근무일수·일당 수지표 모델 */
export interface DayLaborerLedger {
  workDaysPerMonth: number;   // 월평균 근무일수 (예: 18일)
  dailyWage: number;          // 일당 (원)
  monthlyGrossIncome: number; // 월평균 수령액 (workDaysPerMonth * dailyWage)
  isDirectCash: boolean;      // 현금 수령 여부
  evidenceDocuments: string[];
}

/** 15. 아르바이트 시급·근무시간표 모델 */
export interface PartTimeWorkplace {
  id: string;
  workplaceName: string;      // 사업장명
  hourlyWage: number;         // 시급 (원)
  weeklyHours: number;        // 주당 근무시간
  hasWeeklyHolidayPay: boolean; // 주휴수당 여부
  monthlyGrossIncome: number; // 월 급여
}

export interface PartTimeLedger {
  workplaces: PartTimeWorkplace[];
  totalMonthlyGrossIncome: number; // 복수 알바 합산 월소득
  evidenceDocuments: string[];
}

