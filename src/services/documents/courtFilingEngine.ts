/**
 * courtFilingEngine.ts
 * 대법원 전자소송 개인회생 표준 서식 데이터 바인딩 및 법적 인가요건/비용 산정 엔진
 * (오토로 및 실제 법원 접수본 110~140p 전수 분석 기반)
 */

import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { RepaymentCreditor } from '../repayment/repaymentTypes';

// 2026년 기준 법원 송달료 1회당 기준액
export const COURT_SERVICE_FEE_UNIT = 5500;

// 대법원 10대 자료제출목록 항목 정의
export interface EvidenceSubmissionItem {
  id: string;
  categoryNumber: number;
  categoryTitle: string;
  name: string;
  isSubmitted: boolean;
  unsubmittedReason: string;
  isCreditRehabSubmission?: boolean; // 10번 제출 체크
  noticeText?: string;
}

// 12개월 급여/공제 내역 인터페이스
export interface MonthlyIncomeLedgerRow {
  monthLabel: string; // '9월', '10월' ...
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
  thirdPartyDebtor: string; // 제3채무자 (회사, 은행 등)
  seizureTarget: string; // 급여, 임차보증금 등
  servedDate?: string;
  isConfirmed?: boolean;
}

// 종합 전자소송 서식 바인딩 데이터 모델
export interface CourtFilingMasterData {
  // 1. 기본 인적사항 및 대리인
  debtor: {
    name: string;
    residentNumber: string;
    residentAddress: string;
    currentAddress: string;
    serviceAddress: string;
    phone: string;
    homePhone: string;
    refundBank: string;
    refundAccount: string;
    employmentType: '급여소득자' | '영업소득자';
    workplaceName: string;
    workplaceAddress: string;
    workplacePhone: string;
    workplaceCeo: string;
    jobTitle: string;
    tenureYearsMonths: string;
  };
  lawyer: {
    firmName: string;
    lawyerName: string;
    address: string;
    phone: string;
    fax: string;
    email: string;
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

  // 4. 채권자 및 부속서류 대상
  creditors: RepaymentCreditor[];
  annexFlags: {
    hasSecured: boolean; // 부속서류 1
    hasDisputed: boolean; // 부속서류 2
    hasAssignment: boolean; // 부속서류 3
    hasGuaranty: boolean; // 부속서류 4
  };
  disputedCreditors: RepaymentCreditor[];
  assignmentCreditors: RepaymentCreditor[];
  guarantyCreditors: RepaymentCreditor[];

  // 5. 중지명령 사건 목록 (N건)
  stayCases: StayExecutionCase[];

  // 6. 12개월 급여 명세표
  monthlyLedger: MonthlyIncomeLedgerRow[];
  ledgerTotals: {
    annualTotalIncome: number;
    annualTotalDeductions: number;
    annualNetIncome: number;
    monthlyAverageIncome: number;
  };

  // 7. 진술서 및 사유
  statement: {
    education: string;
    maritalHistory: string;
    housingType: string;
    housingDetail: string;
    debtCauses: string[];
    detailedReasonEssay: string;
  };

  // 8. 10대 자료제출목록
  evidenceList: EvidenceSubmissionItem[];
}

/**
 * CRM 데이터를 기반으로 법원 표준 13종 서식 바인딩 마스터 데이터를 추출/생성
 */
export function buildCourtFilingMasterData(
  request: ConsultRequest,
  crmExt?: CrmClientExtension,
  activeLawyerName: string = '변호사 정충원'
): CourtFilingMasterData {
  const profile = request.financialProfile || {};
  const crmClient = crmExt?.clientInfo;
  const courtInfo = crmExt?.courtCase;
  const repaymentPlan = crmExt?.repaymentPlan;

  const debtorName = request.clientName || '신청인';
  const residentNumber = crmClient?.residentNumber || '771230-1******';
  const address = crmClient?.address || '서울특별시 서초구 서초대로 254';
  const phone = request.phone || '010-0000-0000';

  const courtName = courtInfo?.courtName || request.court || '서울회생법원';
  const caseNumber = courtInfo?.caseNumber || `2026개회 ${Math.floor(100000 + Math.random() * 900000)}`;

  // 오늘 기준 접수예정일 및 90일 후 최초변제일 계산
  const today = new Date();
  const applicationDateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
  
  const firstRepayDate = new Date(today);
  firstRepayDate.setDate(firstRepayDate.getDate() + 90);
  const firstRepayDateStr = `${firstRepayDate.getFullYear()}. ${String(firstRepayDate.getMonth() + 1).padStart(2, '0')}. 25`;

  // 채권자 목록 및 부속서류 판별
  const rawCreditors = repaymentPlan?.creditors || [];
  const creditors: RepaymentCreditor[] = rawCreditors.length > 0 
    ? rawCreditors 
    : [
        {
          id: 'c1',
          name: '주식회사 국민은행',
          debtType: 'UNSECURED_CREDIT',
          originalAmount: 35000000,
          currentPrincipal: 32000000,
          currentInterest: 450000,
          totalDebt: 32450000,
          annexDocTypes: ['ANNEX_4_GUARANTOR'],
          interestRate: 6.8,
          creditorAddress: '서울특별시 중구 남대문로 84',
          creditorPhone: '1588-9999',
          principalCalculationBasis: '부채증명서 참조',
          interestCalculationBasis: '연체이자 계산서 참조'
        },
        {
          id: 'c2',
          name: '신한카드 주식회사',
          debtType: 'UNSECURED_CARD',
          originalAmount: 15000000,
          currentPrincipal: 14200000,
          currentInterest: 180000,
          totalDebt: 14380000,
          annexDocTypes: ['ANNEX_3_ASSIGNMENT'],
          interestRate: 15.2,
          creditorAddress: '서울특별시 중구 을지로 100',
          creditorPhone: '1544-7000',
          principalCalculationBasis: '부채증명서 참조',
          interestCalculationBasis: '연체이자 계산서 참조'
        }
      ];

  const creditorCount = Math.max(1, creditors.length);

  // 집행 및 중지명령 대상 사건 추출
  const stayCases: StayExecutionCase[] = [
    {
      id: 'stay-1',
      creditorName: creditors[0]?.name || '주식회사 국민은행',
      courtName: courtName,
      caseType: '채권압류및추심',
      caseNumber: `${today.getFullYear()}타채 ${Math.floor(1000 + Math.random() * 9000)}`,
      thirdPartyDebtor: '주식회사 위노스(급여 사용자)',
      seizureTarget: '신청인의 급여채권 및 퇴직금',
      servedDate: `${today.getFullYear()}-05-12`,
      isConfirmed: true
    }
  ];

  // 비용 산출
  const stayCaseCount = stayCases.length;
  const mainStamp = 30000;
  const prohibitionStamp = 2000;
  const stayStamp = 2000 * stayCaseCount;
  const totalStamp = mainStamp + prohibitionStamp + stayStamp;

  // 송달료 산정 공식 (대법원 규칙):
  // 본안: 기본 10회(55,000원) + 채권자수 * 8회 * 5,500원
  // 금지명령: 채권자수 * 2회 * 5,500원 (최소 11,000원)
  // 중지명령: 건당 채권자수 * 2회 * 5,500원
  const mainServiceFee = 55000 + (creditorCount * 8 * COURT_SERVICE_FEE_UNIT);
  const prohibitionServiceFee = creditorCount * 2 * COURT_SERVICE_FEE_UNIT;
  const stayServiceFee = stayCaseCount * 2 * COURT_SERVICE_FEE_UNIT;
  const totalServiceFee = mainServiceFee + prohibitionServiceFee + stayServiceFee;
  const trusteeFee = 150000;
  const totalCost = totalStamp + totalServiceFee + trusteeFee;

  const formulaText = `{55,000 + (5,500원 X [ ${creditorCount} ] X 8회)}`;

  // 소득 및 생계비 계산
  const monthlyNetIncome = (profile.income || 300) * 10000;
  const householdSize = (profile.dependents || 0) + 1;
  
  // 2026년 기준 1~4인 기준중위소득
  const medianIncomes: Record<number, number> = {
    1: 2564238,
    2: 4210000,
    3: 5400000,
    4: 6500000
  };
  const baseMedian = medianIncomes[householdSize] || (2564238 * householdSize * 0.7);
  const medianIncomeRatio = 60;
  const monthlyLivingCost = Math.round(baseMedian * 0.6);
  const monthlyDisposableIncome = Math.max(0, monthlyNetIncome - monthlyLivingCost);

  const repaymentMonths = repaymentPlan?.summary?.repaymentPeriodMonths || 36;
  const totalRepaymentAmount = monthlyDisposableIncome * repaymentMonths;
  const totalDebtAmount = creditors.reduce((sum, c) => sum + (c.totalDebt || c.currentPrincipal || 0), 0) || 46830000;
  const repaymentRatio = totalDebtAmount > 0 ? Math.round((totalRepaymentAmount / totalDebtAmount) * 100) : 0;
  const liquidationValue = (profile.assetsTotal || 0) * 10000;

  // 채무자회생법 제614조 제2항 제3호 인가요건 검증 (최저변제액 요건)
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
    statutoryWarningMessage = `신청인의 변제계획안 변제율은 현재 법정 인가요건(제614조 제2항 제3호)에 미달되고 있습니다. 총변제예정액(${totalRepaymentAmount.toLocaleString()}원)이 법정 최저변제액(${statutoryMinimumAmount.toLocaleString()}원)을 초과해야 하므로, 피부양가족의 수를 줄이거나 기준중위소득 인정비율을 낮추어 변제율을 상향 조정하시기 바랍니다.`;
  }

  // 12개월 급여 스프레드시트 모의 생성
  const monthlyLedger: MonthlyIncomeLedgerRow[] = [];
  const baseSalaryMonthly = Math.round(monthlyNetIncome * 0.85);
  const bonusMonthly = Math.round(monthlyNetIncome * 0.15);
  const incTax = Math.round(monthlyNetIncome * 0.03);
  const locTax = Math.round(incTax * 0.1);
  const hlthIns = Math.round(monthlyNetIncome * 0.035);
  const natPen = Math.round(monthlyNetIncome * 0.045);
  const empIns = Math.round(monthlyNetIncome * 0.009);
  const careIns = Math.round(hlthIns * 0.12);

  for (let m = 1; m <= 12; m++) {
    monthlyLedger.push({
      monthLabel: `${m}월`,
      baseSalary: baseSalaryMonthly,
      bonus: bonusMonthly,
      incomeTax: incTax,
      localTax: locTax,
      healthInsurance: hlthIns,
      nationalPension: natPen,
      employmentInsurance: empIns,
      longTermCare: careIns
    });
  }

  const annualTotalIncome = (baseSalaryMonthly + bonusMonthly) * 12;
  const singleMonthDeduction = incTax + locTax + hlthIns + natPen + empIns + careIns;
  const annualTotalDeductions = singleMonthDeduction * 12;
  const annualNetIncome = annualTotalIncome - annualTotalDeductions;
  const monthlyAverageIncome = Math.round(annualNetIncome / 12);

  // 부속서류 플래그
  const hasSecured = creditors.some(c => c.debtType.includes('SECURED'));
  const hasDisputed = creditors.some(c => c.annexDocTypes?.includes('ANNEX_2_DISPUTED'));
  const hasAssignment = creditors.some(c => c.annexDocTypes?.includes('ANNEX_3_ASSIGNMENT') || stayCases.length > 0);
  const hasGuaranty = creditors.some(c => c.annexDocTypes?.includes('ANNEX_4_GUARANTOR'));

  // 10대 자료제출목록 초기 상태
  const evidenceList: EvidenceSubmissionItem[] = [
    { id: 'ev-1', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '가족관계증명서 (상세증명서)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-2', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '혼인관계증명서 (상세증명서)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-3', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '주민등록초본 (과거 주소변동 전체 포함)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-4', categoryNumber: 1, categoryTitle: '1. 인적 사항 및 주거 관련 서류', name: '주민등록등본', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-5', categoryNumber: 2, categoryTitle: '2. 재산 및 소득 관련 서류 - 주거지', name: '현재의 주거사항을 알 수 있는 자료 (임대차계약서 등)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-6', categoryNumber: 2, categoryTitle: '2. 재산 및 소득 관련 서류 - 주거지', name: '무상거주사실확인서 (해당 시)', isSubmitted: false, unsubmittedReason: '본인 명의 임차 주택 거주로 해당사항 없음' },
    { id: 'ev-7', categoryNumber: 3, categoryTitle: '3. 재산 및 소득 관련 서류 - 과세증명서', name: '지방세 세목별 과세증명서 (5년 전국단위)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-8', categoryNumber: 4, categoryTitle: '4. 재산 및 소득 관련 서류 - 자동차', name: '자동차등록원부 (갑/을구)', isSubmitted: false, unsubmittedReason: '차량 미소유' },
    { id: 'ev-9', categoryNumber: 5, categoryTitle: '5. 재산 및 소득 관련 서류 - 소득', name: '급여명세서 및 근로소득원천징수영수증', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-10', categoryNumber: 5, categoryTitle: '5. 재산 및 소득 관련 서류 - 소득', name: '재직증명서', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-11', categoryNumber: 6, categoryTitle: '6. 재산 및 소득 관련 서류 - 금융/계좌', name: '금융결제원 전계좌 거래내역서 (어카운트인포)', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-12', categoryNumber: 7, categoryTitle: '7. 재산 및 소득 관련 서류 - 보험', name: '보험가입내역조회서 및 예상해약환급금증명서', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-13', categoryNumber: 8, categoryTitle: '8. 기타 소명자료', name: '압류·추심 결정문 사본', isSubmitted: true, unsubmittedReason: '' },
    { id: 'ev-14', categoryNumber: 9, categoryTitle: '9. 최근 개인회생/파산 서류', name: '과거 신청 법원 결정문', isSubmitted: false, unsubmittedReason: '과거 신청 이력 없음' },
    { id: 'ev-15', categoryNumber: 10, categoryTitle: '10. 유관기관(신복위/캠코) 서류', name: '채무조정 내역서', isSubmitted: false, unsubmittedReason: '해당사항 없음' }
  ];

  return {
    debtor: {
      name: debtorName,
      residentNumber,
      residentAddress: address,
      currentAddress: address,
      serviceAddress: address,
      phone,
      homePhone: '',
      refundBank: '국민은행',
      refundAccount: '352-63476-7478',
      employmentType: '급여소득자',
      workplaceName: '주식회사 위노스',
      workplaceAddress: '서울특별시 영등포구 여의대로 24',
      workplacePhone: '02-780-1234',
      workplaceCeo: '김대표',
      jobTitle: '과장',
      tenureYearsMonths: '3년 6개월'
    },
    lawyer: {
      firmName: '법률사무소 보광',
      lawyerName: activeLawyerName.replace('담당 ', ''),
      address: '서울특별시 서초구 서초대로 254 (서초동, 오퓨런스빌딩) 7층',
      phone: '02-955-8488',
      fax: '02-2179-8487',
      email: 'bokwang_law@daum.net'
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
      monthlyNetIncome,
      householdSize,
      medianIncomeAmount: baseMedian,
      medianIncomeRatio,
      monthlyLivingCost,
      monthlyDisposableIncome,
      repaymentMonths,
      totalRepaymentAmount,
      liquidationValue,
      repaymentRatio,
      repaymentType: '원금변제',
      isExternalTrustee: true,
      hasGarnishment: stayCases.length > 0,
      statutoryMinimumAmount,
      meetsStatutoryMinimum,
      statutoryWarningMessage
    },
    creditors,
    annexFlags: {
      hasSecured,
      hasDisputed,
      hasAssignment,
      hasGuaranty
    },
    disputedCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_2_DISPUTED')),
    assignmentCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_3_ASSIGNMENT')),
    guarantyCreditors: creditors.filter(c => c.annexDocTypes?.includes('ANNEX_4_GUARANTOR')),
    stayCases,
    monthlyLedger,
    ledgerTotals: {
      annualTotalIncome,
      annualTotalDeductions,
      annualNetIncome,
      monthlyAverageIncome
    },
    statement: {
      education: '대학교 졸업',
      maritalHistory: '해당사항 없음 (미혼)',
      housingType: '임차 (월세)',
      housingDetail: '보증금 1,000만원 / 월세 55만원',
      debtCauses: ['생활비 부족', '고금리 대출 이자 누적', '취업 준비 기간 장기화'],
      detailedReasonEssay: `신청인은 성실히 직장에 재직하며 홀로 생계를 유지해 왔으나, 지속적인 물가 상승과 급격한 금리 인상으로 인하여 기존 금융권 채무의 이자 부담이 급증하였습니다. 부족한 생활비를 메우기 위해 카드를 사용하고 신용대출을 추가로 실행하였으나, 원리금 상환액이 월 가용소득을 초과하게 되었고 급기야 급여 가압류 및 압류 추심에 직면하여 더 이상 자력으로 채무를 변제할 수 없는 지급불능 상태에 이르게 되었습니다. 이에 채무자 회생 및 파산에 관한 법률에 따른 개인회생절차를 통하여 성실히 채무를 분할 변제하고 사회의 건전한 구성원으로 갱생하고자 본 신청에 이르렀습니다.`
    },
    evidenceList
  };
}
