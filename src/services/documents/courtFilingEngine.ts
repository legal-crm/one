/**
 * courtFilingEngine.ts
 * 대법원 전자소송 개인회생 표준 서식 데이터 바인딩 및 법적 인가요건/비용 산정 엔진
 * (로패스 2025 실무 분할형 및 대법원/대전/강릉/청주 4대 관할법원 제출목록 전수 분석 기반)
 */

import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { RepaymentCreditor } from '../repayment/repaymentTypes';
import { MEDIAN_INCOME_100_2026, MIN_LIVING_EXPENSE_60_2026 } from '../repayment/repaymentConstants2026';
import { DELIVERY_UNIT_FEE_KRW } from '../court/courtFees';
import { getOfficeProfile } from '../lawyer/officeProfile';

// 법원 송달료 1회분 — 퀵독·전자계약과 같은 단일 상수 사용 (이전: 5,500원으로 불일치)
export const COURT_SERVICE_FEE_UNIT = DELIVERY_UNIT_FEE_KRW;

// 4대 관할법원 구분
export type CourtJurisdiction = 'NATIONWIDE' | 'GANGNEUNG' | 'DAEJEON' | 'CHEONGJU';

// 관할 법원 메타데이터
export interface CourtJurisdictionMeta {
  id: CourtJurisdiction;
  title: string;
  subTitle: string;
  appliedDate: string;
  courtNames: string[];
  hwpFileName: string;
  downloadUrl: string;
  specialNotice: string;
  accountStatementsPeriodYears: number; // 계좌거래내역 기간 (1년 or 2년)
  hasSpecialFamilyReq: boolean; // 가족서류(배우자/부모/자녀) 필수 여부
  hasCreditEducationReq: boolean; // 신용교육 이수증 필수 여부
}

export const COURT_JURISDICTIONS: Record<CourtJurisdiction, CourtJurisdictionMeta> = {
  NATIONWIDE: {
    id: 'NATIONWIDE',
    title: '서울·수원 등 전국 공통 (12개 법원)',
    subTitle: '개인회생 및 면책신청사건의 처리에 관한 예규(재민 2005-1) 일부개정예규 (2022.9.1. 시행)',
    appliedDate: '2022. 9. 1. 시행',
    courtNames: ['서울회생법원', '의정부지방법원', '인천지방법원', '수원회생법원', '춘천지방법원', '대구지방법원', '부산회생법원', '울산지방법원', '창원지방법원', '광주지방법원', '전주지방법원', '제주지방법원'],
    hwpFileName: '개인회생_자료제출목록_개정.hwp',
    downloadUrl: '/templates/court/court_submission_nationwide.hwp',
    specialNotice: '가족관계증명서, 혼인관계증명서, 주민등록등본은 신청인 외 제3자의 주민등록번호 뒷자리가 표기되지 않은 것을 제출합니다. (본인은 전체 표기)',
    accountStatementsPeriodYears: 1,
    hasSpecialFamilyReq: false,
    hasCreditEducationReq: false
  },
  GANGNEUNG: {
    id: 'GANGNEUNG',
    title: '춘천지방법원 강릉지원',
    subTitle: '춘천지방법원 강릉지원 개인회생 전용 자료제출목록 (별지 서식)',
    appliedDate: '강릉지원 시행',
    courtNames: ['춘천지방법원 강릉지원'],
    hwpFileName: '[개인회생]_춘천지방법원 강릉지원_자료제출목록.hwp',
    downloadUrl: '/templates/court/court_submission_gangneung.hwp',
    specialNotice: '※ 주의: 채무자 등본상 배우자 미등재 시 배우자의 주민등록초본[주소변동내역 전체 및 개명 포함]을 필수 추가제출해야 합니다. 무상거주 시 소유자 확인 서류 필수.',
    accountStatementsPeriodYears: 1,
    hasSpecialFamilyReq: true,
    hasCreditEducationReq: false
  },
  DAEJEON: {
    id: 'DAEJEON',
    title: '대전지방법원 (2023.10.16 시행)',
    subTitle: '대전지방법원 개인회생사건 필수제출목록 (2023년 10월 16일 시행 개정본)',
    appliedDate: '2023. 10. 16. 시행',
    courtNames: ['대전지방법원'],
    hwpFileName: '개인회생사건_필수제출목록(2023년10월16일_시행)_대전지방법원.hwp',
    downloadUrl: '/templates/court/court_submission_daejeon.hwp',
    specialNotice: '※ 필수 요건: ① 과거 2년간 전 금융기관 계좌거래내역 제출 ② 11번 가족 관련 서류(배우자·전배우자·부모·자녀 초본 및 5년치 세목별과세증명서 전국단위) 필수 ③ 신용교육원 온라인 수료 이수증 제출 필수.',
    accountStatementsPeriodYears: 2,
    hasSpecialFamilyReq: true,
    hasCreditEducationReq: true
  },
  CHEONGJU: {
    id: 'CHEONGJU',
    title: '청주지방법원 (2022.8.30 시행)',
    subTitle: '청주지방법원 개인회생 자료제출목록 (2022년 8월 30일부터 시행 개정본)',
    appliedDate: '2022. 8. 30. 시행',
    courtNames: ['청주지방법원'],
    hwpFileName: '개인회생_자료제출목록_개정_2022년8월30일부터_청주.hwp',
    downloadUrl: '/templates/court/court_submission_cheongju.hwp',
    specialNotice: '청주지방법원 개인회생 전담재판부 개정 지침 준용. 소득 및 주거 소명자료 완비 필수.',
    accountStatementsPeriodYears: 1,
    hasSpecialFamilyReq: false,
    hasCreditEducationReq: false
  }
};

// 법원 이름으로부터 관할 권역 감지
export function detectCourtJurisdiction(courtName: string): CourtJurisdiction {
  if (courtName.includes('강릉')) return 'GANGNEUNG';
  if (courtName.includes('대전')) return 'DAEJEON';
  if (courtName.includes('청주')) return 'CHEONGJU';
  return 'NATIONWIDE';
}

// 5대 변제계획안 필수 특약문구 인터페이스
export interface SpecialClauseItem {
  id: string;
  title: string;
  content: string;
  isSelected: boolean;
}

// 기본 5대 특약 문구
export const DEFAULT_SPECIAL_CLAUSES: SpecialClauseItem[] = [
  {
    id: 'clause-job',
    title: '이직 등 신고의무',
    content: '채무자는 변제기간 중 이직, 전직, 퇴직, 급여의 변동 또는 기타 수입에 중대한 변동이 발생한 때에는 지체 없이 회생위원에게 그 사실을 서면으로 신고하고 관련 소득 증빙자료를 제출하여야 한다.',
    isSelected: true
  },
  {
    id: 'clause-asset',
    title: '재산목록 제출 의무',
    content: '채무자는 변제계획인가결정일로부터 변제계획 수행이 완료될 때까지 매년 정기적으로(또는 회생위원의 요구가 있을 때) 재산상태 및 소득 변동내역에 관한 자료를 회생위원에게 제출하여야 한다.',
    isSelected: true
  },
  {
    id: 'clause-mod',
    title: '변제계획안의 수정허가신청 등',
    content: '채무자는 예측하지 못한 소득의 감소, 질병 또는 불가피한 재해 등으로 인하여 변제계획을 수행할 수 없는 중대한 사유가 발생한 때에는 법원에 변제계획의 변경허가를 신청할 수 있다.',
    isSelected: true
  },
  {
    id: 'clause-audit',
    title: '수시자료 제출 의무',
    content: '회생위원이 채무자의 변제계획 수행상황을 감독하기 위하여 필요하다고 인정하는 경우, 채무자는 금융거래내역서 및 신용정보조회서 등 관련 자료를 지체 없이 제출하여야 한다.',
    isSelected: false
  },
  {
    id: 'clause-stay',
    title: '강제집행 등의 효력',
    content: '변제계획인가결정이 있는 때에는 개인회생채권에 기하여 개인회생재단에 속하는 재산에 대하여 행하여진 강제집행·가압류 또는 가처분은 그 효력을 잃는다.',
    isSelected: true
  }
];

// 대법원/법원별 자료제출목록 항목 정의
export interface EvidenceSubmissionItem {
  id: string;
  categoryNumber: number;
  categoryTitle: string;
  name: string;
  isSubmitted: boolean;
  unsubmittedReason: string;
  isCreditRehabSubmission?: boolean;
  noticeText?: string;
  isRequired?: boolean;
}

// 12개월 급여/공제 내역 인터페이스
export interface MonthlyIncomeLedgerRow {
  monthLabel: string;
  baseSalary: number;
  bonus: number;
  incomeTax: number;
  localTax: number;
  healthInsurance: number;
  nationalPension: number;
  employmentInsurance: number;
  longTermCare: number;
}

// 집행/중지명령 대상 사건
export interface StayExecutionCase {
  id: string;
  creditorName: string;
  courtName: string;
  caseType: '채권압류및추심' | '채권압류및전부' | '가압류' | '부동산경매' | '유체동산압류' | '기타';
  caseNumber: string;
  thirdPartyDebtor: string;
  seizureTarget: string;
  servedDate?: string;
  isConfirmed?: boolean;
}

// 종합 전자소송 서식 바인딩 데이터 모델
export interface CourtFilingMasterData {
  courtJurisdiction: CourtJurisdiction;

  // 1. 기본 인적사항 및 대리인
  debtor: {
    name: string;
    residentNumber: string;
    residentAddress: string;
    currentAddress: string;
    serviceAddress: string;
    serviceRecipient: string;
    phone: string;
    homePhone: string;
    refundBank: string;
    refundAccount: string;
    applicationType: '주채무자' | '보증채무자' | '연대채무자' | '배우자';
    employmentType: '급여소득자' | '영업소득자';
    hasAdditionalIncome: boolean;
    workplaceName: string;
    workplaceAddress: string;
    workplacePhone: string;
    workplaceCeo: string;
    jobTitle: string;
    tenureYearsMonths: string;
    sealImageUrl?: string;
  };
  lawyer: {
    firmName: string;
    lawyerName: string;
    address: string;
    phone: string;
    fax: string;
    email: string;
    sealImageUrl?: string;
  };
  court: {
    courtName: string;
    caseYear: string;
    caseType: string;
    caseNumber: string;
    applicationDate: string;
    firstRepaymentDate: string;
  };
  
  // 2. 비용 계산
  fees: {
    mainStamp: number;
    prohibitionStamp: number;
    stayStamp: number;
    totalStamp: number;
    mainServiceFee: number;
    prohibitionServiceFee: number;
    stayServiceFee: number;
    totalServiceFee: number;
    trusteeFee: number;
    totalCost: number;
    formulaText: string;
  };

  // 3. 변제계획 요약 및 인가요건 검증
  repaymentSummary: {
    monthlyNetIncome: number;
    householdSize: number;
    medianIncomeAmount: number;
    medianIncomeRatio: number;
    monthlyLivingCost: number;
    additionalLivingCost: number;
    monthlyDisposableIncome: number;
    repaymentMonths: number;
    totalRepaymentAmount: number;
    liquidationValue: number;
    repaymentRatio: number;
    repaymentType: '원금변제' | '원리금변제';
    isExternalTrustee: boolean;
    hasGarnishment: boolean;
    
    // 제614조 제2항 제3호 최저변제액 요건
    statutoryMinimumAmount: number;
    meetsStatutoryMinimum: boolean;
    statutoryWarningMessage: string | null;
  };

  // 4. 회생위원 계좌 및 5대 특약
  trusteeAccount: {
    bank: string;
    accountNumber: string;
  };
  specialClauses: SpecialClauseItem[];

  // 5. 채권자 및 부속서류 대상
  creditors: RepaymentCreditor[];
  annexFlags: {
    hasSecured: boolean;
    hasDisputed: boolean;
    hasAssignment: boolean;
    hasGuaranty: boolean;
  };
  disputedCreditors: RepaymentCreditor[];
  assignmentCreditors: RepaymentCreditor[];
  guarantyCreditors: RepaymentCreditor[];

  // 6. 재산 상세 (로패스 규격 7종)
  assets: {
    cash: number;
    bankAccounts: { bankName: string; accountNumber: string; balance: number }[];
    bankDeduction: number;
    insurance: { companyName: string; policyNumber: string; refundAmount: number }[];
    insuranceDeduction: number;
    vehicle: { modelYear: string; estimatedValue: number; securedLoan: number; netValue: number };
    leaseDeposit: { address: string; deposit: number; monthlyRent: number; exemptDeposit: number; netValue: number };
    realEstate: { address: string; area: string; marketValue: number; mortgage: number; netValue: number };
    severancePay: { company: string; amount: number; exemptAmount: number; netValue: number };
  };

  // 7. 중지명령 사건 목록 (N건)
  stayCases: StayExecutionCase[];

  // 8. 12개월 급여 명세표
  monthlyLedger: MonthlyIncomeLedgerRow[];
  ledgerTotals: {
    annualTotalIncome: number;
    annualTotalDeductions: number;
    annualNetIncome: number;
    monthlyAverageIncome: number;
  };

  // 9. 진술서 및 사유
  statement: {
    education: string;
    maritalHistory: string;
    housingType: '신청인 소유' | '사택 또는 기숙사' | '임차(전월세) 주택' | '친족 소유 무상거주' | '친족 이외 무상거주' | '기타';
    housingDetail: string;
    housingStartDate: string;
    hasLitigationOrSeizure: boolean;
    debtCauses: string[];
    detailedReasonEssay: string;
  };

  // 10. 법원별 자료제출목록
  evidenceList: EvidenceSubmissionItem[];
}

/**
 * 4대 관할법원별 자료제출목록 생성
 */
export function getEvidenceListForJurisdiction(jurisdiction: CourtJurisdiction): EvidenceSubmissionItem[] {
  const commonItems: EvidenceSubmissionItem[] = [
    { id: 'ev-1', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '가족관계증명서 (상세증명서)', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-2', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '혼인관계증명서 (상세증명서)', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-3', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '주민등록초본 [주소변동내역 전체 및 개명사항 포함]', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-4', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '주민등록등본', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-5', categoryNumber: 2, categoryTitle: '2. 재산 및 소득 관련 서류 - 주거지', name: '임대차계약서 사본 또는 무상거주사실확인서', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-6', categoryNumber: 2, categoryTitle: '2. 재산 및 소득 관련 서류 - 주거지', name: '부동산등기사항전부증명서 (임차/소유 주택)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-7', categoryNumber: 3, categoryTitle: '3. 재산 및 소득 관련 서류 - 과세증명서', name: '지방세 세목별 과세증명서 (과거 5년치 전국단위)', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-8', categoryNumber: 4, categoryTitle: '4. 재산 및 소득 관련 서류 - 자동차', name: '자동차등록원부 (갑/을구) 및 시가확인자료', isSubmitted: false, unsubmittedReason: '차량 미소유' },
    { id: 'ev-9', categoryNumber: 5, categoryTitle: '5. 재산 및 소득 관련 서류 - 재산처분', name: '과거 2년 내 처분한 부동산·자동차 등 매매계약서', isSubmitted: false, unsubmittedReason: '처분 재산 없음' },
    { id: 'ev-10', categoryNumber: 6, categoryTitle: '6. 재산 및 소득 관련 서류 - 보험', name: '한국신용정보원 보험가입내역조회서 및 예상해약환급금증명서', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-11', categoryNumber: 7, categoryTitle: '7. 재산 및 소득 관련 서류 - 소득', name: '급여명세서(최근 1년), 근로소득원천징수영수증, 재직증명서', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-12', categoryNumber: 8, categoryTitle: '8. 재산 및 소득 관련 서류 - 계좌 등', name: jurisdiction === 'DAEJEON' ? '과거 2년간 모든 은행계좌 거래내역서 (금융결제원 어카운트인포)' : '과거 1년간 모든 은행계좌 거래내역서 (금융결제원 어카운트인포)', isSubmitted: true, unsubmittedReason: '', isRequired: true },
    { id: 'ev-13', categoryNumber: 9, categoryTitle: '9. 재산 및 소득 관련 서류 - 이혼', name: '재판상 이혼 시 판결문·조정조서 및 확정증명원 (해당 시)', isSubmitted: false, unsubmittedReason: '해당사항 없음' },
    { id: 'ev-14', categoryNumber: 10, categoryTitle: '10. 신용회복위원회, 한국자산관리공사 등 유관기관', name: '사적 채무조정(신복위/캠코) 열람서류 또는 신용상담보고서', isSubmitted: false, unsubmittedReason: '해당사항 없음', isCreditRehabSubmission: false }
  ];

  if (jurisdiction === 'DAEJEON') {
    return [
      ...commonItems,
      {
        id: 'ev-daejeon-edu',
        categoryNumber: 10,
        categoryTitle: '10. 유관기관 서류 및 필수 신용교육',
        name: '★ 신용교육원(educredit.or.kr) 온라인 동영상 수료 이수증 (대전지법 필수)',
        isSubmitted: true,
        unsubmittedReason: '',
        isRequired: true,
        noticeText: '대전지방법원 지침: 교육 수료 후 이수증을 개인파산·회생 채권자집회기일 전까지 반드시 제출'
      },
      {
        id: 'ev-daejeon-family',
        categoryNumber: 11,
        categoryTitle: '11. 가족 관련 서류 (대전지방법원 필수)',
        name: '★ 배우자(2년 내 전배우자 포함), 부모, 자녀의 주민등록초본 (주소변동 전체 포함)',
        isSubmitted: true,
        unsubmittedReason: '',
        isRequired: true
      },
      {
        id: 'ev-daejeon-family-tax',
        categoryNumber: 11,
        categoryTitle: '11. 가족 관련 서류 (대전지방법원 필수)',
        name: '★ 배우자, 부모, 자녀의 지방세 세목별 과세증명서 (과거 5년치 전국단위)',
        isSubmitted: true,
        unsubmittedReason: '',
        isRequired: true
      }
    ];
  }

  if (jurisdiction === 'GANGNEUNG') {
    return commonItems.map(item => {
      if (item.id === 'ev-4') {
        return {
          ...item,
          name: '주민등록등본 ↳ (※채무자 등본상 배우자 미등재시 배우자 주민초본[주소변동 전체] 필수 추가)',
          noticeText: '춘천지법 강릉지원 별지 예규: 배우자 분리 세대 시 배우자 초본 의무 제출'
        };
      }
      return item;
    });
  }

  return commonItems;
}

/**
 * 2026년 기준 가구원수별 기준중위소득표 (보건복지부 고시)
 */
// 단일 출처(repaymentConstants2026)에서 가져옴 — 이전 값(2인 421만, 3인 540만, 4인 650만 등)은 반올림된 오류값이었음
export const MEDIAN_INCOMES_2026: Record<number, number> = MEDIAN_INCOME_100_2026;
export const STATUTORY_LIVING_COST_60_2026: Record<number, number> = MIN_LIVING_EXPENSE_60_2026;

/**
 * 마스터 데이터 전체 재계산 함수
 */
export function recalculateMasterData(prev: CourtFilingMasterData): CourtFilingMasterData {
  const creditorCount = Math.max(1, prev.creditors.length);
  const stayCaseCount = prev.stayCases.length;

  // 1. 비용 재계산
  const mainStamp = 30000;
  const prohibitionStamp = 2000;
  const stayStamp = 2000 * stayCaseCount;
  const totalStamp = mainStamp + prohibitionStamp + stayStamp;

  const mainServiceFee = (10 * COURT_SERVICE_FEE_UNIT) + (creditorCount * 8 * COURT_SERVICE_FEE_UNIT);
  const prohibitionServiceFee = creditorCount * 2 * COURT_SERVICE_FEE_UNIT;
  const stayServiceFee = stayCaseCount * 2 * COURT_SERVICE_FEE_UNIT;
  const totalServiceFee = mainServiceFee + prohibitionServiceFee + stayServiceFee;
  const trusteeFee = 150000;
  const totalCost = totalStamp + totalServiceFee + trusteeFee;

  const formulaText = `{55,000 + (5,500원 X [ ${creditorCount} ] X 8회)}`;

  // 2. 가용소득 및 변제액 재계산
  const monthlyNet = prev.repaymentSummary.monthlyNetIncome;
  const totalLivingCost = prev.repaymentSummary.monthlyLivingCost + (prev.repaymentSummary.additionalLivingCost || 0);
  const monthlyDisposableIncome = Math.max(0, monthlyNet - totalLivingCost);
  const months = prev.repaymentSummary.repaymentMonths || 36;
  const totalRepaymentAmount = monthlyDisposableIncome * months;

  const totalDebtAmount = prev.creditors.reduce((sum, c) => sum + (c.totalDebt || c.currentPrincipal || 0), 0) || 1;
  const repaymentRatio = Math.round((totalRepaymentAmount / totalDebtAmount) * 100);

  // 3. 제614조 제2항 제3호 인가요건 검증
  let statutoryMinimumAmount = 0;
  let meetsStatutoryMinimum = true;
  let statutoryWarningMessage: string | null = null;

  if (totalDebtAmount < 50000000) {
    statutoryMinimumAmount = Math.round(totalDebtAmount * 0.05);
    meetsStatutoryMinimum = totalRepaymentAmount > statutoryMinimumAmount;
  } else {
    statutoryMinimumAmount = Math.round((totalDebtAmount * 0.03) + 1000000);
    meetsStatutoryMinimum = totalRepaymentAmount > statutoryMinimumAmount;
  }

  if (!meetsStatutoryMinimum) {
    statutoryWarningMessage = `신청인의 총변제예정액(${totalRepaymentAmount.toLocaleString()}원)은 법정 최저변제액(${statutoryMinimumAmount.toLocaleString()}원)에 미달하여 법 제614조 제2항 제3호 인가요건을 충족하지 못하고 있습니다. 부양가족 수나 생계비율을 조정하여 월 가용소득을 상향해야 기각을 방지할 수 있습니다.`;
  }

  return {
    ...prev,
    fees: {
      mainStamp,
      prohibitionStamp,
      stayStamp,
      totalStamp,
      mainServiceFee,
      prohibitionServiceFee,
      stayServiceFee,
      totalServiceFee,
      trusteeFee,
      totalCost,
      formulaText
    },
    repaymentSummary: {
      ...prev.repaymentSummary,
      monthlyDisposableIncome,
      totalRepaymentAmount,
      repaymentRatio,
      statutoryMinimumAmount,
      meetsStatutoryMinimum,
      statutoryWarningMessage
    }
  };
}

/**
 * CRM 데이터로부터 법원 표준 13종 서식 마스터 데이터 초기 생성
 */
export function buildCourtFilingMasterData(
  request: ConsultRequest,
  crmExt?: CrmClientExtension,
  activeLawyerName: string = ''
): CourtFilingMasterData {
  const profile = request.financialProfile || {};
  const crmClient = crmExt?.clientInfo;
  const courtInfo = crmExt?.courtCase;
  const repaymentPlan = crmExt?.repaymentPlan;

  const debtorName = request.clientName || '신청인';
  // 미입력 항목은 빈 값으로 둔다 (이전: 가짜 주민번호·주소·전화번호로 채움)
  const residentNumber = crmClient?.residentNumber || '';
  const address = crmClient?.address || '';
  const phone = request.phone && !request.phone.includes('*') ? request.phone : '';
  const office = getOfficeProfile(activeLawyerName);

  const courtName = courtInfo?.courtName || request.court || '서울회생법원';
  const courtJurisdiction = detectCourtJurisdiction(courtName);
  // 사건번호는 접수 후 부여되므로 없으면 비워둔다 (이전: 무작위 가짜 사건번호 생성)
  const caseNumber = courtInfo?.caseNumber || '';

  const today = new Date();
  const applicationDateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
  
  const firstRepayDate = new Date(today);
  firstRepayDate.setDate(firstRepayDate.getDate() + 90);
  const firstRepayDateStr = `${firstRepayDate.getFullYear()}. ${String(firstRepayDate.getMonth() + 1).padStart(2, '0')}. 25`;

  const rawCreditors = repaymentPlan?.creditors || [];
  // 채권자는 변제계획안(부채증명서 동기화)에 입력된 것만 사용 — 없으면 빈 목록 (이전: 국민은행·신한카드 샘플)
  const creditors: RepaymentCreditor[] = rawCreditors;

  // 중지명령 대상 강제집행 사건은 CRM에 등록된 것만 (이전: 무작위 타채 번호·가상 제3채무자 '주식회사 위노스'를 확정 사건으로 생성)
  const stayCases: StayExecutionCase[] = Array.isArray((crmExt as any)?.stayCases) ? (crmExt as any).stayCases : [];

  const monthlyNetIncome = ((profile as any).income || 0) * 10000;
  const householdSize = (profile.dependents || 0) + 1;
  const baseMedian = MEDIAN_INCOMES_2026[householdSize] || MEDIAN_INCOMES_2026[Math.min(8, Math.max(1, householdSize))] || 0;
  const monthlyLivingCost = STATUTORY_LIVING_COST_60_2026[householdSize] || Math.round(baseMedian * 0.6);

  // 12개월 급여 명세표: 실제 급여명세서 입력 전에는 빈 표 (이전: 월소득에 고정 비율을 곱한 가공 명세 12개월 생성)
  const monthlyLedger: MonthlyIncomeLedgerRow[] = Array.isArray((crmExt as any)?.monthlyIncomeLedger) ? (crmExt as any).monthlyIncomeLedger : [];
  const annualTotalIncome = monthlyLedger.reduce((sum, r) => sum + (r.baseSalary || 0) + (r.bonus || 0), 0);
  const annualTotalDeductions = monthlyLedger.reduce((sum, r) => sum + (r.incomeTax || 0) + (r.localTax || 0) + (r.healthInsurance || 0) + (r.nationalPension || 0) + (r.employmentInsurance || 0) + (r.longTermCare || 0), 0);
  const annualNetIncome = annualTotalIncome - annualTotalDeductions;
  const monthlyAverageIncome = monthlyLedger.length > 0 ? Math.round(annualNetIncome / monthlyLedger.length) : 0;

  const initialData: CourtFilingMasterData = {
    courtJurisdiction,
    debtor: {
      name: debtorName,
      residentNumber,
      residentAddress: address,
      currentAddress: address,
      serviceAddress: address,
      serviceRecipient: debtorName,
      phone,
      homePhone: '',
      refundBank: '',
      refundAccount: '',
      applicationType: '주채무자',
      employmentType: '급여소득자',
      hasAdditionalIncome: false,
      workplaceName: (profile as any).companyName || '',
      workplaceAddress: '',
      workplacePhone: '',
      workplaceCeo: '',
      jobTitle: '',
      tenureYearsMonths: ''
    },
    lawyer: {
      firmName: office.firmName,
      lawyerName: activeLawyerName.replace('담당 ', ''),
      address: office.address,
      phone: office.phone,
      fax: office.fax,
      email: office.email
    },
    court: {
      courtName,
      caseYear: `${today.getFullYear()}`,
      caseType: '개회',
      caseNumber,
      applicationDate: applicationDateStr,
      firstRepaymentDate: firstRepayDateStr
    },
    fees: {
      mainStamp: 30000,
      prohibitionStamp: 2000,
      stayStamp: 2000,
      totalStamp: 34000,
      mainServiceFee: (10 * COURT_SERVICE_FEE_UNIT) + (creditors.length * 8 * COURT_SERVICE_FEE_UNIT),
      prohibitionServiceFee: creditors.length * 2 * COURT_SERVICE_FEE_UNIT,
      stayServiceFee: stayCases.length * 2 * COURT_SERVICE_FEE_UNIT,
      totalServiceFee: 0,
      trusteeFee: 150000,
      totalCost: 0,
      formulaText: ''
    },
    repaymentSummary: {
      monthlyNetIncome,
      householdSize,
      medianIncomeAmount: baseMedian,
      medianIncomeRatio: 60,
      monthlyLivingCost,
      additionalLivingCost: 0,
      monthlyDisposableIncome: Math.max(0, monthlyNetIncome - monthlyLivingCost),
      repaymentMonths: (repaymentPlan as any)?.months || 36,
      totalRepaymentAmount: 0,
      liquidationValue: (profile.assetsTotal || 0) * 10000,
      repaymentRatio: 0,
      repaymentType: '원금변제',
      isExternalTrustee: true,
      hasGarnishment: stayCases.length > 0,
      statutoryMinimumAmount: 0,
      meetsStatutoryMinimum: true,
      statutoryWarningMessage: null
    },
    // 회생위원 계좌는 개시결정 후 사건별로 부여 — 임의 계좌 기재 금지
    trusteeAccount: {
      bank: '',
      accountNumber: ''
    },
    specialClauses: DEFAULT_SPECIAL_CLAUSES,
    creditors,
    annexFlags: {
      hasSecured: creditors.some(c => c.debtType.includes('SECURED')),
      hasDisputed: creditors.some(c => c.annexDocTypes?.includes('ANNEX_2_DISPUTED')),
      hasAssignment: creditors.some(c => c.annexDocTypes?.includes('ANNEX_3_ASSIGNMENT') || stayCases.length > 0),
      hasGuaranty: creditors.some(c => c.annexDocTypes?.includes('ANNEX_4_GUARANTOR'))
    },
    disputedCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_2_DISPUTED')),
    assignmentCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_3_ASSIGNMENT')),
    guarantyCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_4_GUARANTOR')),
    // 재산은 재산목록(D5102) 입력 전에는 0원·빈 항목 (이전: 아반떼 차량·삼성생명 보험·임차보증금·퇴직금 등 가공 재산)
    assets: {
      cash: 0,
      bankAccounts: [],
      bankDeduction: 0,
      insurance: [],
      insuranceDeduction: 0,
      vehicle: { modelYear: '', estimatedValue: 0, securedLoan: 0, netValue: 0 },
      leaseDeposit: { address: '', deposit: 0, monthlyRent: 0, exemptDeposit: 0, netValue: 0 },
      realEstate: { address: '', area: '', marketValue: 0, mortgage: 0, netValue: 0 },
      severancePay: { company: '', amount: 0, exemptAmount: 0, netValue: 0 }
    },
    stayCases,
    monthlyLedger,
    ledgerTotals: {
      annualTotalIncome,
      annualTotalDeductions,
      annualNetIncome,
      monthlyAverageIncome
    },
    // 진술서는 의뢰인·변호사가 작성한 내용만 (이전: 학력·주거·채무경위 문장을 가공해 채움)
    statement: {
      education: '',
      maritalHistory: '',
      housingType: '' as any,
      housingDetail: '',
      housingStartDate: '',
      hasLitigationOrSeizure: stayCases.length > 0,
      debtCauses: [],
      detailedReasonEssay: ''
    },
    evidenceList: getEvidenceListForJurisdiction(courtJurisdiction)
  };

  return recalculateMasterData(initialData);
}
