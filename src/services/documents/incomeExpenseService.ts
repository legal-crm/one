/**
 * 대법원 전산양식 [D5103] 수입 및 지출에 관한 목록 서비스
 * 2026년 기준중위소득 60% 생계비 및 법원 실무준칙에 따른 자동 산출 및 검증
 */

import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { 
  IncomeExpenseD5103Data, 
  DebtorIncomeType, 
  SalaryIncomeDetail,
  BusinessIncomeDetail,
  OtherIncomeDetail,
  IncomeSeizureDetail,
  FamilyMemberItem,
  ExpenseAndLivingDetail,
  DisposableIncomeSummary,
  DetailedIncomeType,
  DynamicExpenseItem,
  MonthlyLedgerItem,
  BusinessMonthlyLedger,
  FreelancerMonthlyLedger,
  DayLaborerLedger,
  PartTimeLedger
} from '../../types/incomeExpenseTypes';
import { get2026LivingExpense, MIN_LIVING_EXPENSE_60_2026 } from '../repayment/repaymentConstants2026';

/**
 * 상담 신청 데이터(FinancialProfile) 및 CRM 데이터로부터 D5103 도큐먼트 초기 데이터 자동 생성
 */
export function createDefaultIncomeExpenseD5103(
  clientRequest: ConsultRequest,
  crmExt?: CrmClientExtension,
  lawyerName: string = '담당 변호사'
): IncomeExpenseD5103Data {
  const fp = clientRequest.financialProfile;
  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt?.courtCase?.caseNumber || '2026개회 (접수 예정)';
  
  // 소득 형태 결정
  const jobType = (fp?.jobType || fp?.employmentType || '').toLowerCase();
  const isBusiness = jobType.includes('business') || jobType.includes('사업');
  const incomeType: DebtorIncomeType = isBusiness ? 'BUSINESS' : 'SALARY';
  
  // 기준 월 소득 (원 단위)
  const baseMonthlyIncomeWon = fp?.income ? fp.income * 10000 : (fp?.monthlyIncome ? fp.monthlyIncome * 10000 : 3200000);
  
  // ── 1. 급여소득자 기본값 산출 ──
  // 기본급과 상여금 분리 (통상 기본급 85%, 상여금 연 200% 수준 추산)
  const monthlyBasePay = Math.round(baseMonthlyIncomeWon * 0.9);
  const annualBonus = Math.round(baseMonthlyIncomeWon * 1.2);
  const monthlyBonusConverted = Math.round(annualBonus / 12);
  const grossMonthlyIncome = monthlyBasePay + monthlyBonusConverted;
  
  // 4대보험 및 근로소득세 법정 공제 표준 추산 (약 9~12%)
  const nationalPension = Math.round(grossMonthlyIncome * 0.045); // 국민연금 4.5%
  const healthInsurance = Math.round(grossMonthlyIncome * 0.03545 * 1.1295); // 건강보험 3.545% + 장기요양 12.95%
  const employmentInsurance = Math.round(grossMonthlyIncome * 0.009); // 고용보험 0.9%
  const incomeTax = Math.round(grossMonthlyIncome * 0.025); // 간이세액 소득세 추정
  const residentTax = Math.round(incomeTax * 0.1); // 지방소득세 10%
  const totalStatutoryDeductions = nationalPension + healthInsurance + employmentInsurance + incomeTax + residentTax;
  
  const netMonthlySalary = grossMonthlyIncome - totalStatutoryDeductions;
  
  const salary: SalaryIncomeDetail = {
    employerName: fp?.companyName || '(주)성실기업',
    jobTitle: '사원 / 일반근무',
    employmentStartDate: fp?.employmentDate || '2024-03-01',
    hasRecentJobChange: fp?.hasRecentJobChange || false,
    monthlyBasePay,
    annualBonus,
    monthlyBonusConverted,
    grossMonthlyIncome,
    incomeTax,
    residentTax,
    healthInsurance,
    nationalPension,
    employmentInsurance,
    industrialAccidentInsurance: 0,
    totalStatutoryDeductions,
    netMonthlyIncome: netMonthlySalary,
    annualConvertedIncome: netMonthlySalary * 12,
    evidenceDocuments: ['근로소득원천징수영수증', '급여명세서(최근 1년분)', '급여입금통장 사본', '재직증명서']
  };
  
  // ── 2. 영업소득자 기본값 산출 ──
  const annualGrossRevenue = baseMonthlyIncomeWon * 24; // 연매출 추정
  const annualOperatingExpenses = Math.round(annualGrossRevenue * 0.45); // 통상 필요경비 45%
  const annualTaxes = Math.round(annualGrossRevenue * 0.05); // 제세공과금 5%
  const netAnnualBusinessIncome = Math.max(0, annualGrossRevenue - annualOperatingExpenses - annualTaxes);
  const monthlyAverageBusinessIncome = Math.ceil(netAnnualBusinessIncome / 12);
  
  const business: BusinessIncomeDetail = {
    businessCategory: '사업소득',
    businessName: fp?.companyName || '개인사업체',
    businessRegistrationNo: '123-45-67890',
    annualGrossRevenue,
    annualOperatingExpenses,
    annualTaxes,
    netAnnualBusinessIncome,
    monthlyAverageIncome: monthlyAverageBusinessIncome,
    evidenceDocuments: ['사업자등록증 사본', '종합소득세 확정신고서', '부가가치세과세표준증명', '매출/매입 세금계산서합계표']
  };
  
  // ── 3. 기타 수입 ──
  const other: OtherIncomeDetail = {
    pensionMonthly: 0,
    subsidyMonthly: 0,
    familySupportMonthly: (fp?.childSupportReceived || 0) * 10000,
    totalOtherMonthly: (fp?.childSupportReceived || 0) * 10000,
  };
  
  // ── 4. 압류/가압류 ──
  const hasSeizure = fp?.harassmentLevel === 'SEIZURE' || (fp?.legalActions && fp.legalActions.includes('압류'));
  const seizure: IncomeSeizureDetail = {
    hasSeizure: !!hasSeizure,
    courtName: hasSeizure ? courtName : '',
    caseNumber: hasSeizure ? '2025타채 9981호' : '',
    creditorName: hasSeizure ? '주요 채권금융기관' : '',
    seizedAmount: hasSeizure ? 1850000 : 0,
    notes: hasSeizure ? '급여 및 예금계좌 압류결정 송달됨' : ''
  };
  
  // ── 5. 가족관계 (피부양자 명세) ──
  const familyMembers: FamilyMemberItem[] = [];
  
  // 본인
  familyMembers.push({
    id: 'fam_self',
    relationship: '본인(신청인)',
    name: clientName,
    birthDate: fp?.age ? `${2026 - fp.age}.05.12` : '1988.05.12',
    cohabitationStatus: '동거',
    cohabitationPeriod: '출생시부터',
    isSupportedByDebtor: true,
    hasIncome: true,
    jobAndIncomeDetail: `${salary.employerName} 재직 (월 실수령 약 ${(netMonthlySalary / 10000).toFixed(0)}만 원)`,
    isEligibleDependent: true,
  });
  
  // 배우자
  const isMarried = (fp?.maritalStatus || '').toLowerCase().includes('marri') || fp?.maritalStatus === '기혼';
  if (isMarried) {
    const spouseIncome = (fp?.spouseIncome || 0) * 10000;
    const isSpouseWorking = spouseIncome > 1000000;
    familyMembers.push({
      id: 'fam_spouse',
      relationship: '배우자',
      name: '배우자',
      birthDate: fp?.age ? `${2026 - fp.age + 1}.08.20` : '1989.08.20',
      cohabitationStatus: '동거',
      cohabitationPeriod: '결혼 이후 6년',
      isSupportedByDebtor: !isSpouseWorking,
      hasIncome: isSpouseWorking,
      jobAndIncomeDetail: isSpouseWorking 
        ? `직장 근무 (월 소득 약 ${(spouseIncome / 10000).toFixed(0)}만 원)` 
        : '가사 전담 주부 (소득 없음, 미성년 양육)',
      isEligibleDependent: !isSpouseWorking,
      ineligibilityReason: isSpouseWorking ? '경제활동 가능 연령 및 1인 최저생계비 이상 소득 보유' : undefined,
    });
  }
  
  // 미성년 자녀
  const childrenCount = fp?.minorChildren || (fp?.dependents ? Math.max(0, fp.dependents - (isMarried ? 1 : 0)) : 0);
  for (let i = 0; i < childrenCount; i++) {
    const childAge = 8 + i * 4; // 예: 8세, 12세
    familyMembers.push({
      id: `fam_child_${i + 1}`,
      relationship: i === 0 ? '자' : '녀',
      name: `자녀 ${i + 1}`,
      birthDate: `${2026 - childAge}.03.15`,
      cohabitationStatus: '동거',
      cohabitationPeriod: '출생시부터',
      isSupportedByDebtor: true,
      hasIncome: false,
      jobAndIncomeDetail: '학생 / 미성년자 (소득 없음)',
      isEligibleDependent: true,
    });
  }
  
  // 총 가구원 수 (부양가족 인정 인원 계산: 본인 1 + 적격 피부양자 수)
  const eligibleDependentsCount = familyMembers.filter(f => f.isEligibleDependent).length;
  const householdSize = Math.max(1, eligibleDependentsCount);
  
  // ── 6. 지출 및 생계비 명세 ──
  const statutoryBaseCost2026 = get2026LivingExpense(householdSize);
  
  // 추가 생계비 주장 데이터 (월세 차액, 필수 의료비, 교육비)
  const actualRentWon = (fp?.rentCost || 0) * 10000;
  // 기준 주거비(서울 1인 기준 약 35~40만 원) 초과 월세 인정 신청
  const additionalHousing = actualRentWon > 400000 ? Math.min(600000, actualRentWon - 400000) : 0;
  const additionalMedical = (fp?.medicalCost || 0) * 10000;
  const additionalEducation = (fp?.educationCost || 0) * 10000;
  const additionalChildSupport = (fp?.childSupportPaid || 0) * 10000;
  
  const totalAdditionalExpenses = additionalHousing + additionalMedical + additionalEducation + additionalChildSupport;
  const claimedCostOption = totalAdditionalExpenses > 0 ? 'ABOVE_60' : 'BELOW_60';
  const claimedBaseCost = statutoryBaseCost2026;
  const totalMonthlyExpense = claimedBaseCost + totalAdditionalExpenses;
  
  const additionalReasonDetail = totalAdditionalExpenses > 0
    ? `신청인은 현재 서울 관내에서 월세 ${(actualRentWon / 10000).toFixed(0)}만 원의 임대차 계약을 체결하여 실거주 중이며, 기준 주거비(보건복지부 고시)를 초과하는 주거비 ${(additionalHousing / 10000).toFixed(0)}만 원에 대하여 실제 거주 유지를 위한 필수생계비로 인정받고자 합니다.\n아울러 부양가족의 지속적 의료비/교육비 등 불가피한 지출을 고려하여 추가생계비를 인정하여 주실 것을 간청드립니다.`
    : '보건복지부 공표 2026년 기준 중위소득의 60% 금액을 표준 생계비로 인정받고자 신청합니다.';
  
  const expenses: ExpenseAndLivingDetail = {
    householdSize,
    statutoryBaseCost2026,
    claimedCostOption,
    claimedBaseCost,
    additionalHousing,
    additionalMedical,
    additionalEducation,
    additionalChildSupport,
    additionalOther: 0,
    additionalReasonDetail,
    additionalEvidenceDocs: [
      ...(additionalHousing > 0 ? ['부동산 임대차계약서 사본', '최근 3개월간 월세 계좌이체 확인증'] : []),
      ...(additionalMedical > 0 ? ['병원 진단서 및 진료비영수증', '원외처방전/약제비영수증'] : []),
      ...(additionalEducation > 0 ? ['자녀 재학증명서', '교육비 납입증명서'] : []),
      '주민등록등본 및 가족관계증명서(상세)'
    ],
    totalAdditionalExpenses,
    totalMonthlyExpense
  };
  
  // ── 7. 가용소득 산출 결과 ──
  const primaryMonthlyNet = isBusiness ? monthlyAverageBusinessIncome : netMonthlySalary;
  const totalMonthlyNetIncome = primaryMonthlyNet + other.totalOtherMonthly;
  const monthlyDisposableIncome = Math.max(0, totalMonthlyNetIncome - totalMonthlyExpense);
  
  // 청년 특례(만 30세 미만) 여부 확인
  const isYouthRelief = fp?.age ? fp.age < 30 : false;
  const repaymentMonths = isYouthRelief ? 24 : 36;
  const totalDisposableIncome = monthlyDisposableIncome * repaymentMonths;
  
  const disposableIncome: DisposableIncomeSummary = {
    monthlyNetIncome: totalMonthlyNetIncome,
    monthlyTotalExpense: totalMonthlyExpense,
    monthlyDisposableIncome,
    repaymentMonths,
    totalDisposableIncome
  };
  
  return {
    id: `d5103_${clientRequest.id}`,
    clientId: clientRequest.id,
    debtorName: clientName,
    residentNumberMasked: fp?.age ? `${(2026 - fp.age).toString().slice(2)}0512-1******` : '880512-1******',
    courtName,
    caseNumber,
    createdDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
    attorneyName: lawyerName,
    incomeType,
    salary,
    business,
    other,
    seizure,
    expenses,
    familyMembers,
    disposableIncome,
    lastSavedAt: new Date().toISOString(),
    isCompleted: true
  };
}

/**
 * 실시간 입력값 수정에 따른 전체 합계 및 가용소득 재계산
 */
export function recalculateD5103Data(prev: IncomeExpenseD5103Data): IncomeExpenseD5103Data {
  const next = { ...prev };
  
  // 1. 급여소득 재계산
  if (next.incomeType === 'SALARY') {
    const sal = { ...next.salary };
    sal.monthlyBonusConverted = Math.round((sal.annualBonus || 0) / 12);
    sal.grossMonthlyIncome = (sal.monthlyBasePay || 0) + sal.monthlyBonusConverted;
    sal.totalStatutoryDeductions = 
      (sal.incomeTax || 0) +
      (sal.residentTax || 0) +
      (sal.healthInsurance || 0) +
      (sal.nationalPension || 0) +
      (sal.employmentInsurance || 0) +
      (sal.industrialAccidentInsurance || 0);
    sal.netMonthlyIncome = Math.max(0, sal.grossMonthlyIncome - sal.totalStatutoryDeductions);
    sal.annualConvertedIncome = sal.netMonthlyIncome * 12;
    next.salary = sal;
  }
  
  // 2. 영업소득 재계산
  if (next.incomeType === 'BUSINESS') {
    const biz = { ...next.business };
    biz.netAnnualBusinessIncome = Math.max(
      0, 
      (biz.annualGrossRevenue || 0) - (biz.annualOperatingExpenses || 0) - (biz.annualTaxes || 0)
    );
    biz.monthlyAverageIncome = Math.ceil(biz.netAnnualBusinessIncome / 12);
    next.business = biz;
  }
  
  // 3. 기타 소득 재계산
  next.other.totalOtherMonthly = 
    (next.other.pensionMonthly || 0) + 
    (next.other.subsidyMonthly || 0) + 
    (next.other.familySupportMonthly || 0);
  
  // 4. 가족 수에 따른 2026 기준생계비 재산정
  const eligibleDependentsCount = next.familyMembers.filter(f => f.isEligibleDependent).length;
  const householdSize = Math.max(1, eligibleDependentsCount);
  next.expenses.householdSize = householdSize;
  next.expenses.statutoryBaseCost2026 = get2026LivingExpense(householdSize);
  
  if (next.expenses.claimedCostOption === 'BELOW_60') {
    next.expenses.claimedBaseCost = next.expenses.statutoryBaseCost2026;
  }
  
  // 5. 추가생계비 및 총지출액 재계산
  next.expenses.totalAdditionalExpenses = 
    (next.expenses.additionalHousing || 0) +
    (next.expenses.additionalMedical || 0) +
    (next.expenses.additionalEducation || 0) +
    (next.expenses.additionalChildSupport || 0) +
    (next.expenses.additionalOther || 0);
  
  next.expenses.totalMonthlyExpense = 
    next.expenses.claimedBaseCost + next.expenses.totalAdditionalExpenses;
  
  // 6. 월평균 순수입 및 가용소득(월 변제금) 최종 확정
  const currentNetIncome = next.incomeType === 'SALARY' 
    ? next.salary.netMonthlyIncome 
    : (next.incomeType === 'BUSINESS' ? next.business.monthlyAverageIncome : 0);
  
  const totalNet = currentNetIncome + next.other.totalOtherMonthly;
  const monthlyDisposable = Math.max(0, totalNet - next.expenses.totalMonthlyExpense);
  
  next.disposableIncome = {
    monthlyNetIncome: totalNet,
    monthlyTotalExpense: next.expenses.totalMonthlyExpense,
    monthlyDisposableIncome: monthlyDisposable,
    repaymentMonths: next.disposableIncome.repaymentMonths || 36,
    totalDisposableIncome: monthlyDisposable * (next.disposableIncome.repaymentMonths || 36)
  };
  
  next.lastSavedAt = new Date().toISOString();
  return next;
}

/**
 * 법원 보정권고 및 기각 위험 선제적 검증 (Warning / Validation Checklist)
 */
export interface D5103ValidationResult {
  hasCriticalIssue: boolean;
  warnings: {
    code: string;
    level: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
  }[];
}

export function validateD5103Data(data: IncomeExpenseD5103Data): D5103ValidationResult {
  const warnings: D5103ValidationResult['warnings'] = [];
  
  // 1. 가용소득 0원 이하 여부 검증
  if (data.disposableIncome.monthlyDisposableIncome <= 0) {
    warnings.push({
      code: 'ZERO_DISPOSABLE_INCOME',
      level: 'CRITICAL',
      title: '월 가용소득(변제예정액) 부족 (개인회생 자격 미달 위험)',
      description: '월평균 수입에서 법정 생계비를 차감한 가용소득이 0원 이하입니다. 회생위원은 가용소득이 없는 사건을 기각할 수 있으므로, 소득을 재소명하거나 개인파산으로 전환을 검토해야 합니다.'
    });
  }
  
  // 2. 추가생계비 소명 사유 미기재 여부
  if (data.expenses.totalAdditionalExpenses > 0 && (!data.expenses.additionalReasonDetail || data.expenses.additionalReasonDetail.trim().length < 15)) {
    warnings.push({
      code: 'MISSING_ADDITIONAL_REASON',
      level: 'WARNING',
      title: '추가 생계비 소명 사유 미비 (법원 삭감 가능성)',
      description: '기준중위소득 60%를 초과하는 추가생계비(주거비, 의료비 등)를 신청하였으나 구체적 소명 사유가 불충분합니다. 보정명령에 대비하여 사유를 상세히 기술하세요.'
    });
  }
  
  // 3. 부양가족 적격성 (배우자 부양 인정 시 경고)
  const spouse = data.familyMembers.find(f => f.relationship.includes('배우자'));
  if (spouse && spouse.isEligibleDependent && !spouse.hasIncome) {
    warnings.push({
      code: 'SPOUSE_DEPENDENT_SCRUTINY',
      level: 'WARNING',
      title: '배우자 부양가족 인정 심사 주의',
      description: '법원 실무상 경제활동이 가능한 연령의 배우자는 원칙적으로 부양가족에서 제외됩니다. 장애, 중병, 미취학 자녀 다수 양육 등 특별한 사정 소명자료(진단서 등)가 필요합니다.'
    });
  }
  
  // 4. 급여 압류 시 진술서 연계 확인
  if (data.seizure.hasSeizure && (!data.seizure.courtName || !data.seizure.caseNumber)) {
    warnings.push({
      code: 'INCOMPLETE_SEIZURE_INFO',
      level: 'INFO',
      title: '압류·가압류 결정법원 및 사건번호 기재 요망',
      description: '급여나 통장에 압류가 있는 경우 결정법원, 사건번호 및 압류금액을 명시하고 관련 결정문 사본을 진술서 첨부서류에 포함해야 합니다.'
    });
  }
  
  return {
    hasCriticalIssue: warnings.some(w => w.level === 'CRITICAL'),
    warnings
  };
}

/**
 * 최근 12개월 기준 년.월 라벨 목록 생성 (예: ["25.04", "25.05", ..., "26.03"])
 */
export function generateDefaultRecent12MonthsLabels(baseDate: Date = new Date()): string[] {
  const result: string[] = [];
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1; // 1-12

  for (let i = 11; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    const yy = year.toString().slice(-2);
    const mm = month < 10 ? `0${month}` : `${month}`;
    result.push(`${yy}.${mm}`);
  }
  return result;
}

/**
 * 12개월 수지표 각 월별 행 및 합계/월평균 재계산 순수 함수
 */
export function recalculateBusinessMonthlyLedger(
  months: MonthlyLedgerItem[],
  dynamicExpenses: DynamicExpenseItem[] = []
): BusinessMonthlyLedger {
  // 각 행의 소계 및 순수익 보정
  const calculatedMonths: MonthlyLedgerItem[] = months.map(m => {
    const incomeCard = Math.max(0, m.incomeCard || 0);
    const incomeCash = Math.max(0, m.incomeCash || 0);
    const incomeTotal = incomeCard + incomeCash;

    const expenseOperating = Math.max(0, m.expenseOperating || 0);
    const expenseRent = Math.max(0, m.expenseRent || 0);
    const expenseUtility = Math.max(0, m.expenseUtility || 0);
    const expenseElectricity = Math.max(0, m.expenseElectricity || 0);
    const expenseTotal = expenseOperating + expenseRent + expenseUtility + expenseElectricity;

    const netIncome = incomeTotal - expenseTotal;

    return {
      month: m.month,
      incomeCard,
      incomeCash,
      incomeTotal,
      expenseOperating,
      expenseRent,
      expenseUtility,
      expenseElectricity,
      expenseTotal,
      netIncome
    };
  });

  // 12개월 합계 산출
  let totalCard = 0;
  let totalCash = 0;
  let totalGrossRevenue = 0;
  let totalOperating = 0;
  let totalRent = 0;
  let totalUtility = 0;
  let totalElectricity = 0;
  let totalOperatingExpense = 0;
  let totalNetProfit = 0;

  for (const row of calculatedMonths) {
    totalCard += row.incomeCard;
    totalCash += row.incomeCash;
    totalGrossRevenue += row.incomeTotal;
    totalOperating += row.expenseOperating;
    totalRent += row.expenseRent;
    totalUtility += row.expenseUtility;
    totalElectricity += row.expenseElectricity;
    totalOperatingExpense += row.expenseTotal;
    totalNetProfit += row.netIncome;
  }

  const monthCount = calculatedMonths.length || 12;
  const avgGrossRevenue = Math.round(totalGrossRevenue / monthCount);
  const avgOperatingExpense = Math.round(totalOperatingExpense / monthCount);
  const avgNetIncome = Math.round(totalNetProfit / monthCount);

  return {
    months: calculatedMonths,
    dynamicExpenses,
    annualTotals: {
      totalCard,
      totalCash,
      totalGrossRevenue,
      totalOperating,
      totalRent,
      totalUtility,
      totalElectricity,
      totalOperatingExpense,
      totalNetProfit
    },
    monthlyAverages: {
      avgGrossRevenue,
      avgOperatingExpense,
      avgNetIncome
    }
  };
}

/**
 * 고객 초간편 마법사 입력값으로부터 12개월 엑셀 수지표 자동 생성
 * - 동적 경비(배달비, 기장료, 알바비 등)를 법원 4대 표준 경비에 자동 롤업 합산
 */
export interface WizardLedgerInputs {
  avgMonthlyCard: number;          // 월평균 카드 매출 (원)
  avgMonthlyCash: number;          // 월평균 현금 매출 (원)
  baseOperatingExpense: number;    // 기본 운영비 (식자재, 매입대금 등, 원)
  rentExpense: number;             // 월세 (원)
  utilityExpense: number;          // 가스/수도/등유 (원)
  electricityExpense: number;      // 전기요금 (원)
  dynamicExpenses: DynamicExpenseItem[]; // 추가 경비 항목 목록
  monthsLabels?: string[];         // 12개월 라벨 (생략시 최근 12개월)
}

export function generateMonthlyLedgerFromWizardInputs(inputs: WizardLedgerInputs): BusinessMonthlyLedger {
  const labels = inputs.monthsLabels && inputs.monthsLabels.length === 12
    ? inputs.monthsLabels
    : generateDefaultRecent12MonthsLabels();

  // 1. 동적 경비 항목을 법원 4대 표준 경비로 롤업 합산
  let extraOperating = 0;
  let extraRent = 0;
  let extraUtility = 0;
  let extraElectricity = 0;

  for (const exp of inputs.dynamicExpenses) {
    const amt = exp.monthlyAmount || 0;
    if (exp.rollupTarget === 'rent') {
      extraRent += amt;
    } else if (exp.rollupTarget === 'utility') {
      extraUtility += amt;
    } else if (exp.rollupTarget === 'electricity') {
      extraElectricity += amt;
    } else {
      // 기본값 operating
      extraOperating += amt;
    }
  }

  const finalOperating = (inputs.baseOperatingExpense || 0) + extraOperating;
  const finalRent = (inputs.rentExpense || 0) + extraRent;
  const finalUtility = (inputs.utilityExpense || 0) + extraUtility;
  const finalElectricity = (inputs.electricityExpense || 0) + extraElectricity;

  // 2. 12개월 행 생성 (월평균치 분배)
  const rows: MonthlyLedgerItem[] = labels.map(month => {
    const incomeCard = inputs.avgMonthlyCard || 0;
    const incomeCash = inputs.avgMonthlyCash || 0;
    const incomeTotal = incomeCard + incomeCash;

    const expenseOperating = finalOperating;
    const expenseRent = finalRent;
    const expenseUtility = finalUtility;
    const expenseElectricity = finalElectricity;
    const expenseTotal = expenseOperating + expenseRent + expenseUtility + expenseElectricity;

    const netIncome = incomeTotal - expenseTotal;

    return {
      month,
      incomeCard,
      incomeCash,
      incomeTotal,
      expenseOperating,
      expenseRent,
      expenseUtility,
      expenseElectricity,
      expenseTotal,
      netIncome
    };
  });

  return recalculateBusinessMonthlyLedger(rows, inputs.dynamicExpenses);
}

/**
 * 개인사업자 12개월 수지표 원장을 D5103 양식 및 가용소득 계산에 양방향 동기화
 */
export function syncBusinessLedgerToD5103(
  prev: IncomeExpenseD5103Data,
  ledger: BusinessMonthlyLedger
): IncomeExpenseD5103Data {
  const next: IncomeExpenseD5103Data = {
    ...prev,
    incomeType: 'BUSINESS',
    detailedIncomeType: 'BUSINESS',
    monthlyLedger: ledger,
    business: {
      ...prev.business,
      annualGrossRevenue: ledger.annualTotals.totalGrossRevenue,
      annualOperatingExpenses: ledger.annualTotals.totalOperatingExpense,
      annualTaxes: prev.business.annualTaxes || Math.round(ledger.annualTotals.totalGrossRevenue * 0.03),
      netAnnualBusinessIncome: ledger.annualTotals.totalNetProfit,
      monthlyAverageIncome: ledger.monthlyAverages.avgNetIncome
    }
  };

  return recalculateD5103Data(next);
}

/**
 * 프리랜서(3.3%) 수입·경비 내역을 D5103 양식에 동기화
 */
export function syncFreelancerLedgerToD5103(
  prev: IncomeExpenseD5103Data,
  freelancer: FreelancerMonthlyLedger
): IncomeExpenseD5103Data {
  const totalAnnualRevenue = freelancer.annualGrossRevenue || (freelancer.monthlyGrossIncome * 12);
  const totalAnnualExpense = freelancer.totalMonthlyExpenses * 12;
  const netAnnual = Math.max(0, totalAnnualRevenue - totalAnnualExpense);
  const monthlyNet = freelancer.netMonthlyIncome;

  const next: IncomeExpenseD5103Data = {
    ...prev,
    incomeType: 'BUSINESS',
    detailedIncomeType: 'FREELANCER',
    freelancerLedger: freelancer,
    business: {
      ...prev.business,
      businessCategory: '사업소득',
      businessName: `${freelancer.jobTypeDetail || '프리랜서'} 3.3% 용역소득`,
      annualGrossRevenue: totalAnnualRevenue,
      annualOperatingExpenses: totalAnnualExpense,
      annualTaxes: 0, // 원천징수 후 금액인 경우
      netAnnualBusinessIncome: netAnnual,
      monthlyAverageIncome: monthlyNet,
      evidenceDocuments: freelancer.evidenceDocuments || [
        '원천징수영수증(사업소득)',
        '최근 1년분 입금통장 사본',
        '용역계약서 또는 위촉증명서'
      ]
    }
  };

  return recalculateD5103Data(next);
}

/**
 * 일용직 근무내역을 D5103 양식에 동기화
 */
export function syncDayLaborerLedgerToD5103(
  prev: IncomeExpenseD5103Data,
  dayLaborer: DayLaborerLedger
): IncomeExpenseD5103Data {
  const monthlyGross = dayLaborer.monthlyGrossIncome || (dayLaborer.workDaysPerMonth * dayLaborer.dailyWage);
  const annualGross = monthlyGross * 12;

  const next: IncomeExpenseD5103Data = {
    ...prev,
    incomeType: 'SALARY',
    detailedIncomeType: 'DAY_LABORER',
    dayLaborerLedger: dayLaborer,
    salary: {
      ...prev.salary,
      employerName: '건설·현장 일용직 (다수 현장)',
      jobTitle: `일용근로자 (월평균 ${dayLaborer.workDaysPerMonth}일 근무, 일당 ${(dayLaborer.dailyWage / 10000).toFixed(0)}만원)`,
      monthlyBasePay: monthlyGross,
      annualBonus: 0,
      monthlyBonusConverted: 0,
      grossMonthlyIncome: monthlyGross,
      totalStatutoryDeductions: 0,
      netMonthlyIncome: monthlyGross,
      annualConvertedIncome: annualGross,
      evidenceDocuments: dayLaborer.evidenceDocuments || [
        '일용근로소득지급명세서',
        '고용산재보험 토탈서비스 일용근로내역서',
        '급여입금통장 거래내역서'
      ]
    }
  };

  return recalculateD5103Data(next);
}

/**
 * 아르바이트 근무내역을 D5103 양식에 동기화
 */
export function syncPartTimeToD5103(
  prev: IncomeExpenseD5103Data,
  partTime: PartTimeLedger
): IncomeExpenseD5103Data {
  const monthlyGross = partTime.totalMonthlyGrossIncome;
  const annualGross = monthlyGross * 12;
  const workplaceNames = partTime.workplaces.map(w => w.workplaceName).filter(Boolean).join(', ') || '단기 아르바이트';

  const next: IncomeExpenseD5103Data = {
    ...prev,
    incomeType: 'SALARY',
    detailedIncomeType: 'PART_TIME',
    partTimeLedger: partTime,
    salary: {
      ...prev.salary,
      employerName: workplaceNames,
      jobTitle: '단기·시간제 아르바이트',
      monthlyBasePay: monthlyGross,
      annualBonus: 0,
      monthlyBonusConverted: 0,
      grossMonthlyIncome: monthlyGross,
      totalStatutoryDeductions: 0,
      netMonthlyIncome: monthlyGross,
      annualConvertedIncome: annualGross,
      evidenceDocuments: partTime.evidenceDocuments || [
        '근로계약서 사본',
        '급여입금통장 거래내역서',
        '아르바이트 급여명세서'
      ]
    }
  };

  return recalculateD5103Data(next);
}
