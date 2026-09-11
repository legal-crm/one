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
  
  // 상태 관리
  lastSavedAt?: string;
  isCompleted?: boolean;
}
