/**
 * 개인회생 부채증명서 발급 대행 및 변제계획안(D5110/D5111) 데이터 타입 정의
 */
import { RegionType } from './repaymentConstants2026';

// ══════════════════════════════════════════════════════════════════
// 1. 부채증명서 발급 대행 관리 모델 (Debt Certificate Outsourcing)
// ══════════════════════════════════════════════════════════════════

export type DebtIssueStatus = 
  | 'pending'          // 의뢰 대기
  | 'agency_requested'// 대행사 의뢰 완료 (발송)
  | 'in_progress'     // 대행사 발급 진행 중
  | 'issued'          // 발급 완료 (PDF/이미지 수신)
  | 'rejected'        // 발급 불가 / 양도양수 이관
  | 'confirmed';       // 법원 서류 및 변제계획안 반영 완료

export interface DebtCertificateItem {
  id: string;
  creditorName: string;            // 금융기관/채권자명 (예: 국민은행, 신한카드)
  accountOrContractNo?: string;    // 카드/계좌/대출 관리번호
  branchName?: string;             // 발급 지점
  expectedPrincipal: number;       // 상담 시 예상 원금
  expectedInterest?: number;       // 상담 시 예상 이자
  issueStatus: DebtIssueStatus;    // 발급 진행 상태
  
  // 대행사 발급 결과값
  confirmedPrincipal?: number;     // 증명서상 확정 원금
  confirmedInterest?: number;      // 개시 전 확정 이자
  issueDate?: string;              // 발급일자 (YYYY-MM-DD)
  expiryDate?: string;             // 유효기한 (통상 1~3개월)
  
  // 증빙 서류 파일
  certificateDocUrl?: string;      // 서류 URL 또는 Data URI (PDF or Image)
  docName?: string;                // 첨부 파일명
  docType?: 'pdf' | 'image';       // 문서 포맷
  
  // 비용 및 메모
  agencyFee: number;               // 건당 대행 수수료 (기본 15,000원~20,000원)
  issuanceFee: number;             // 금융기관 제증명 발급 실비 (보통 2,000~3,000원)
  memo?: string;                   // 특이사항 (양도사, 특수채권 등)

  // 보증인 가지번호 및 기타 체크사항 (이자 3회 미납, 별제권)
  parentItemId?: string;           // 주채권자 ID (보증인일 경우)
  displayNumber?: string;          // 표시 번호 (1, 2, 4-1 등)
  isGuarantor?: boolean;           // 보증인/보증기관 여부
  isUnpaidInterest3Times?: boolean;// 이자 3회 미납 여부 (최근 채무 사기죄 리스크 관리)
  isSecured?: boolean;             // 별제권부(담보부) 채권 여부

  // 법원 송달용 채권자 주소 및 법인 정보 (채권자목록 연동)
  zipCode?: string;                // 우편번호 (5자리)
  address?: string;                // 본점 소재지 / 주민등록상 주소
  serviceAddress?: string;         // 법원 우편물 송달장소
  representative?: string;         // 대표자 (예: 은행장 OOO)
  bizNumber?: string;              // 법인/사업자/주민등록번호
  debtCauseDetail?: string;        // 차용원인 (예: 대여금 / 신용대출)
  borrowedDate?: string;           // 차용일자 (YYYY-MM-DD)
}

export interface DebtCertificateOrder {
  orderId: string;
  clientId: string;
  clientName: string;
  clientRrnFront?: string;         // 주민등록번호 앞자리 (생년월일 6자리)
  clientPhone?: string;            // 의뢰인 연락처
  clientAddress?: string;          // 의뢰인 주소
  agencyName: string;              // 발급 대행업체명 (예: 윈행정사, 원클릭대행 등)
  agencyPreset?: 'standard' | 'oneclick' | 'winadmin' | 'koreacredit'; // 대행사별 양식 프리셋
  orderStatus: 'draft' | 'requested' | 'in_progress' | 'completed' | 'partial';
  items: DebtCertificateItem[];
  createdAt: string;
  requestedAt?: string;
  completedAt?: string;
  totalAgencyCost: number;         // 총 대행비용
  notes?: string;
}

// ══════════════════════════════════════════════════════════════════
// 2. 변제계획안 핵심 데이터 모델 (Repayment Plan)
// ══════════════════════════════════════════════════════════════════

export type RepaymentFormType = 
  | 'D5110' // [전산양식 D5110] 가용소득만으로 변제
  | 'D5111'; // [전산양식 D5111] 가용소득 + 재산처분(부동산, 자동차 등) 병행

export type TrusteeType = 
  | 'INTERNAL' // 내부회생위원 (보수 0%)
  | 'EXTERNAL'; // 외부회생위원 (가용소득 1% 차감)

export interface RepaymentCreditor {
  id: string;
  creditorNumber: number;          // 채권번호 (1, 2, 3...)
  name: string;                    // 채권자명
  principal: number;               // 원금
  interest: number;                // 개시전 이자
  isSecured: boolean;              // 별제권(담보권) 유무
  securedValue?: number;           // 별제권 행사 예상액 (담보물 환가 후 변제 예상액)
  isUnconfirmed: boolean;          // 미확정 채권 여부
  isPriority: boolean;             // 일반 우선권 있는 채권 여부 (조세, 4대보험 등)
  
  // 계산 및 안분 결과
  allocationRatio: number;         // 안분 비율 (0.0 ~ 1.0)
  monthlyRepayment: number;        // 채권자별 월 변제예정액 (원 미만 올림)
  totalRepayment: number;          // 변제기간 동안 총 변제예정액 (monthly * months)
  repaymentRate: number;           // 변제율 (%)
  // 2단계 분할 변제 (우선권 세금 등 회차별 분할)
  stage1MonthlyRepayment?: number; // 1단계 월 변제예정액 (예: 1~18회차)
  stage2MonthlyRepayment?: number; // 2단계 월 변제예정액 (예: 19~36회차)

  // 미확정 채권 유보금 플래그
  isUnconfirmedReserve?: boolean;  // 체크 시 실지급 제외 및 공탁 유보금으로 분류

  // 별제권 예정부족액 세부 정보
  securedShortageInfo?: {
    collateralType: string;
    marketValue: number;
    seniorEncumbrance: number;
    exemptDeposit: number;
    appraisalRate: number;
    assessedCollateralValue: number;
    calculatedShortage: number;
  };

  // 담당자 수동 미세 조정 플래그
  isManuallyAdjusted?: boolean;

  // 보증인 가지번호 및 기타 체크사항 (이자 3회 미납, 메모)
  parentCreditorId?: string;       // 주채권자 ID (보증인/보증기관일 경우 상위 채권자 참조)
  displayNumber?: string;          // 표시 번호 (예: "1", "2", "4-1", "6-1")
  isGuarantor?: boolean;           // 보증인/보증기관 여부
  isUnpaidInterest3Times?: boolean;// 이자 3회 미납 여부 (최근 채무 사기죄 리스크 관리)
  memo?: string;                   // 채권자별 메모/특이사항

  // 법원 송달용 채권자 주소 및 법인 정보 (대법원 전자소송 CSV 연동)
  zipCode?: string;                // 우편번호 (5자리)
  address?: string;                // 본점 소재지 / 주민등록상 주소
  serviceAddress?: string;         // 법원 우편물 송달장소
  representative?: string;         // 대표자 (예: 은행장 OOO)
  bizNumber?: string;              // 법인/사업자/주민등록번호
  debtCauseDetail?: string;        // 차용원인 (예: 대여금 / 신용대출)
  borrowedDate?: string;           // 차용일자 (YYYY-MM-DD)
}

export type AssetCategory = 
  | 'DEPOSIT'              // 예금 / 적금 (185만 원 공제)
  | 'INSURANCE'            // 보장성 보험 해약환급금 (150만 원 공제)
  | 'HOUSING_DEPOSIT'      // 주거용 임차보증금 (지역별 소액보증금 공제)
  | 'CAR'                  // 자동차 (시가 - 담보대출)
  | 'REAL_ESTATE'          // 부동산 (시가 - 근저당권)
  | 'RETIREMENT'           // 퇴직금 (일반 50% 반영, 퇴직연금 0원)
  | 'ADDITIONAL_INCLUSION' // 가상 청산가치 가산 (편파변제, 주식/코인 손실, 도박 등)
  | 'OTHER';               // 기타 동산/유가증권

export interface RepaymentAsset {
  id: string;
  category: AssetCategory;
  name: string;                    // 자산명 (예: 신한은행 청약통장, 마포구 아파트)
  marketValue: number;             // 시가 / 평가액
  encumbrance: number;             // 담보 채무액 (근저당, 질권 등)
  statutoryDeduction: number;      // 압류금지/면제재산 법정 공제액
  liquidationValue: number;        // 청산가치 = max(0, 시가 - 담보액 - 공제액)
  isRetirementPension?: boolean;   // 퇴직연금(DB/DC/IRP) 여부 (true시 0원)
  note?: string;
}

export interface IncomeAndExpenseInput {
  incomeType: 'salary' | 'business'; // 급여소득자 / 영업소득자
  monthlyNetIncome: number;          // 월 실수령 소득 (세후 평균)
  householdSize: number;             // 부양가족 수 (0.5인 포함 가능)
  region: RegionType;                // 거주지역
  
  // 지출 및 추가생계비 항목
  actualHousingExpense: number;      // 월 실제 주거비 지출 (월세, 주담대 이자 등)
  actualMedicalExpense: number;      // 월 평균 실제 의료비 지출
  numberOfChildren: number;          // 부양 미성년 자녀 수
  educationExpensePerChild: number;  // 자녀 1인당 월 교육비 지출
  isSpecialEducation?: boolean;      // 특수교육(장애 등) 여부
  otherApprovedExpense: number;      // 기타 법원 인정 생계비 (간병비, 이사회생비 등)
  
  // 회생위원 선임 형태
  trusteeType: TrusteeType;
}

export interface CalculatedLivingExpense {
  baseLivingExpense: number;         // 2026 기준 중위소득 60% 기초생계비
  additionalHousingDeduction: number;// 추가 인정 주거비
  additionalMedicalDeduction: number;// 추가 인정 의료비
  additionalEducationDeduction: number; // 추가 인정 교육비
  otherApprovedExpense: number;      // 기타 추가생계비
  totalAdditionalExpense: number;    // 추가생계비 합계
  finalTotalLivingExpense: number;   // 최종 인정 총 생계비
  rawDisposableIncome: number;       // 실수령 소득 - 최종 생계비
  trusteeFee: number;                // 회생위원 보수 (외부 1%)
  actualDisposableIncome: number;    // 월 실제 가용소득 (월 변제금)
}

export interface RepaymentPlanData {
  // 기본 설정
  planId: string;
  clientId: string;
  clientName: string;
  courtName: string;                 // 관할법원 (예: 서울회생법원)
  caseNumber?: string;               // 사건번호
  submissionDate?: string;           // 작성/접수일자
  
  // 변제 기간 및 일정
  months: number;                    // 변제 횟수 (36개월 ~ 60개월, 단축 특례 24~30개월)
  startYearMonth: string;            // 변제개시월 (YYYY-MM)
  endYearMonth: string;              // 변제종료월 (YYYY-MM)
  paymentDayOfMonth: number;         // 매월 변제기일 (보통 25일)
  
  // 소득 및 생계비 산정 결과
  incomeExpense: IncomeAndExpenseInput;
  calculatedLiving: CalculatedLivingExpense;
  
  // 재산 및 청산가치
  assets: RepaymentAsset[];
  totalLiquidationValue: number;     // 총 청산가치 (J)
  
  // 채권자 목록 및 안분 결과
  creditors: RepaymentCreditor[];
  totalPrincipal: number;            // 채권 원금 총액 (G)
  totalInterest: number;             // 개시전 이자 총액
  totalDebt: number;                 // 총 채무액
  unsecuredDebtTotal?: number;       // 무담보부 채무액 합계 (만원/원 단위 산출용)
  securedDebtTotal?: number;         // 담보부 채무액 합계

  // 채무 증대 사유 (이미지 3-5 실무 양식)
  debtGrowthReasons?: string[];      // 채무 증대 사유 복수 선택 항목 (예: ['생활비 부족', '점포 운영의 실패'])
  debtGrowthNarrative?: string;      // 채무 증대 사유에 관한 상세 서술
  
  // 청산가치 보장 및 라이프니쯔 현가 검증 결과
  leibnizFactor: number;             // 적용된 라이프니쯔 현가 계수 (36개월: 33.7719, 60개월: 53.6433)
  presentValue: number;              // 라이프니쯔 현재가치 (L = H * 계수)
  satisfiesLiquidationGuarantee: boolean; // L >= J 보장 여부
  
  // 변제금 및 변제율
  monthlyRepaymentTotal: number;     // 채권자별 월 변제액 합계 (H)
  totalRepaymentAmount: number;      // 총 변제예정액 (I = H * 개월수)
  totalRepaymentRate: number;        // 변제율 (%)
  totalForgivenAmount: number;       // 총 탕감액
  forgivenessRate: number;           // 원금 탕감률 (%)

  // 2단계 분할 변제 (우선권 세금 등 회차별 분할)
  isTwoStageRepayment?: boolean;     // 2단계 분할 변제 활성화 여부
  stage1Months?: number;             // 1단계 변제 회차수 (예: 18회)
  stage2Months?: number;             // 2단계 변제 회차수 (예: 18회)
  stage1MonthlyRepaymentTotal?: number; // 1단계 월 총 변제금
  stage2MonthlyRepaymentTotal?: number; // 2단계 월 총 변제금

  // 우선권 채권 및 미확정 채권 유보금 합계
  totalPriorityDebt?: number;        // 우선권 채무 총액
  totalUnconfirmedReserve?: number;  // 미확정 채권 공탁 유보금 총액
  priorityFeasibility?: PriorityFeasibilityInfo; // 1단계 우선변제 타당성 및 보정 경고

  // 최저변제액 검증
  minimumRepaymentThreshold: number; // 법정 최저변제액 하한선
  satisfiesMinimumRepayment: boolean;
  
  // 양식 판정 및 재산처분 병행
  formType: RepaymentFormType;       // D5110 또는 D5111
  requiredDisposalAmount: number;    // D5111인 경우 재산처분 투입 예정액
  disposalTargetDeadline?: string;   // 처분 예정 기한
  
  // 실무자 미세 수동 조정 (Fine-Tuning) 메타데이터
  isManuallyOverridden: boolean;     // 수동 조정 여부
  overrideMonthlyRepayment?: number; // 수동 오버라이드한 월 변제금
  overrideMonths?: number;           // 수동 오버라이드한 개월수
  adjusterMemo?: string;             // 담당자 조정 사유 메모 (보정권고 대응 등)
  lastSavedAt: string;
}

export interface PriorityFeasibilityInfo {
  maxStage1Months: number;            // M_max = Math.floor(N / 2) (36개월 시 18, 60개월 시 30)
  minRequiredMonths: number;          // K = Math.ceil(T_priority / A)
  canSettleWithinHalfPeriod: boolean; // K <= M_max
  riskWarning?: string;               // '세금 체납액 과다로 인가 불허 위험'
  requiredDisposableForHalfPeriod?: number; // Math.ceil(T_priority / M_max)
  recommendedMonths?: number;         // 60개월 권장
}
