/**
 * hwpxFieldMapper.ts
 * ============================================================
 * CRM 마스터 데이터(CourtFilingMasterData) → HWPX 템플릿 필드 매핑
 * 
 * 법원 전산양식의 누름틀(CLICK_HERE) 필드명 또는 {{placeholder}}에
 * CRM 데이터를 정확히 매핑합니다.
 * ============================================================
 */

import type { CourtFilingMasterData } from '../documents/courtFilingEngine';
import type { HwpxFieldData } from './hwpxTemplateEngine';

/** 법원 전산양식 코드 */
export type CourtFormType = 'D5101' | 'D5102' | 'D5103' | 'D5104' | 'D5105' | 'D5110';

/**
 * CourtFilingMasterData를 HWPX 템플릿 필드 데이터로 변환합니다.
 * 
 * @param masterData - CRM 마스터 데이터
 * @param formType - 법원 양식 코드
 * @returns HWPX 필드 데이터 (키-값 쌍)
 */
export function mapMasterDataToHwpxFields(
  masterData: CourtFilingMasterData,
  formType: CourtFormType
): HwpxFieldData {
  // 공통 필드 (모든 양식에 사용)
  const commonFields: HwpxFieldData = {
    // 채무자 인적사항
    '채무자성명': masterData.debtor.name,
    '주민등록번호': masterData.debtor.residentNumber,
    '주민등록주소': masterData.debtor.residentAddress,
    '현주소': masterData.debtor.currentAddress,
    '송달주소': masterData.debtor.serviceAddress,
    '전화번호': masterData.debtor.phone,
    '자택전화': masterData.debtor.homePhone,
    '직업': masterData.debtor.jobTitle,
    '직장명': masterData.debtor.workplaceName,
    '직장주소': masterData.debtor.workplaceAddress,
    '직장전화': masterData.debtor.workplacePhone,
    '근무기간': masterData.debtor.tenureYearsMonths,

    // 대리인 정보
    '법률사무소명': masterData.lawyer.firmName,
    '변호사명': masterData.lawyer.lawyerName,
    '대리인주소': masterData.lawyer.address,
    '대리인전화': masterData.lawyer.phone,
    '대리인팩스': masterData.lawyer.fax,
    '대리인이메일': masterData.lawyer.email,

    // 법원 정보
    '관할법원': masterData.court.courtName,
    '사건번호': `${masterData.court.caseYear}${masterData.court.caseType}${masterData.court.caseNumber}`,
    '신청일자': masterData.court.applicationDate,
    '변제개시일': masterData.court.firstRepaymentDate,

    // 금액 정보 (공통)
    '총채무액': formatCurrency(masterData.creditors.reduce((sum, c) => sum + (c.currentPrincipal || 0) + (c.currentInterest || 0), 0)),
    '채권자수': String(masterData.creditors.length),
    '월변제액': formatCurrency(masterData.repaymentSummary.monthlyDisposableIncome),
    '변제기간': `${masterData.repaymentSummary.repaymentMonths}개월`,
    '총변제액': formatCurrency(masterData.repaymentSummary.totalRepaymentAmount),
    '변제비율': `${masterData.repaymentSummary.repaymentRatio.toFixed(1)}%`,
    '청산가치': formatCurrency(masterData.repaymentSummary.liquidationValue),
  };

  // 양식별 추가 필드
  switch (formType) {
    case 'D5101':
      return { ...commonFields, ...mapD5101Fields(masterData) };
    case 'D5102':
      return { ...commonFields, ...mapD5102Fields(masterData) };
    case 'D5103':
      return { ...commonFields, ...mapD5103Fields(masterData) };
    case 'D5104':
      return { ...commonFields, ...mapD5104Fields(masterData) };
    case 'D5105':
      return { ...commonFields, ...mapD5105Fields(masterData) };
    case 'D5110':
      return { ...commonFields, ...mapD5110Fields(masterData) };
    default:
      return commonFields;
  }
}

// ── D5101: 개인회생절차 개시신청서 ──

function mapD5101Fields(data: CourtFilingMasterData): HwpxFieldData {
  return {
    '인지대합계': formatCurrency(data.fees.totalStamp),
    '인지대본안': formatCurrency(data.fees.mainStamp),
    '인지대금지명령': formatCurrency(data.fees.prohibitionStamp),
    '인지대중지명령': formatCurrency(data.fees.stayStamp),
    '송달료합계': formatCurrency(data.fees.totalServiceFee),
    '송달료산식': data.fees.formulaText,
    '회생위원보수': formatCurrency(data.fees.trusteeFee),
    '비용합계': formatCurrency(data.fees.totalCost),
    '소득유형': data.debtor.employmentType,
    '신청인유형': data.debtor.applicationType,
    '환급은행': data.debtor.refundBank,
    '환급계좌': data.debtor.refundAccount,
    '회생위원계좌은행': data.trusteeAccount.bank,
    '회생위원계좌번호': data.trusteeAccount.accountNumber,
  };
}

// ── D5102: 개인회생채권자목록 ──

function mapD5102Fields(data: CourtFilingMasterData): HwpxFieldData {
  const fields: HwpxFieldData = {};
  const totalPrincipal = data.creditors.reduce((sum, c) => sum + (c.currentPrincipal || 0), 0);
  const totalInterest = data.creditors.reduce((sum, c) => sum + (c.currentInterest || 0), 0);

  fields['원금합계'] = formatCurrency(totalPrincipal);
  fields['이자합계'] = formatCurrency(totalInterest);
  fields['채권현재액합계'] = formatCurrency(totalPrincipal + totalInterest);
  fields['무담보채권합계'] = formatCurrency(totalPrincipal + totalInterest);
  fields['담보부채권합계'] = '0원';

  // 개별 채권자 필드 (최대 30명)
  data.creditors.forEach((c, idx) => {
    const n = idx + 1;
    fields[`채권자${n}_성명`] = c.name;
    fields[`채권자${n}_원금`] = formatCurrency(c.currentPrincipal || 0);
    fields[`채권자${n}_이자`] = formatCurrency(c.currentInterest || 0);
    fields[`채권자${n}_합계`] = formatCurrency((c.currentPrincipal || 0) + (c.currentInterest || 0));
    fields[`채권자${n}_유형`] = c.debtType?.includes('CARD') ? '신용카드 사용대금' : '대여금(신용대출)';
    fields[`채권자${n}_이율`] = `연 ${c.interestRate || 10}%`;
    fields[`채권자${n}_주소`] = c.creditorAddress || '';
    fields[`채권자${n}_전화`] = c.creditorPhone || '고객센터';
  });

  return fields;
}

// ── D5103: 재산목록 ──

function mapD5103Fields(data: CourtFilingMasterData): HwpxFieldData {
  const assets = data.assets;
  const bankTotal = assets.bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const insuranceTotal = assets.insurance.reduce((sum, i) => sum + i.refundAmount, 0);

  return {
    '현금': '0원',
    '예금합계': formatCurrency(bankTotal),
    '예금상세': assets.bankAccounts.map(a => `${a.bankName} ${formatCurrency(a.balance)}`).join(', '),
    '보험합계': formatCurrency(insuranceTotal),
    '보험상세': assets.insurance.map(i => `${i.companyName} 해약환급금 ${formatCurrency(i.refundAmount)}`).join(', '),
    '자동차시가': formatCurrency(assets.vehicle.estimatedValue),
    '자동차담보': formatCurrency(assets.vehicle.securedLoan),
    '자동차순가': formatCurrency(assets.vehicle.netValue),
    '임차보증금': formatCurrency(assets.leaseDeposit.deposit),
    '임차주소': assets.leaseDeposit.address,
    '임차순가': formatCurrency(assets.leaseDeposit.netValue),
    '부동산시가': formatCurrency(assets.realEstate.marketValue),
    '부동산담보': formatCurrency(assets.realEstate.mortgage),
    '부동산순가': formatCurrency(assets.realEstate.netValue),
    '퇴직금예상': formatCurrency(assets.severancePay.amount),
    '퇴직금순가': formatCurrency(assets.severancePay.netValue),
    '자산합계': formatCurrency(
      bankTotal + insuranceTotal + assets.vehicle.netValue +
      assets.leaseDeposit.netValue + assets.realEstate.netValue + assets.severancePay.netValue
    ),
  };
}

// ── D5104: 수입 및 지출에 관한 목록 ──

function mapD5104Fields(data: CourtFilingMasterData): HwpxFieldData {
  const rep = data.repaymentSummary;
  return {
    '월순수입': formatCurrency(rep.monthlyNetIncome),
    '가구원수': `${rep.householdSize}인`,
    '기준중위소득': formatCurrency(rep.medianIncomeAmount),
    '중위소득비율': `${rep.medianIncomeRatio.toFixed(0)}%`,
    '생계비': formatCurrency(rep.monthlyLivingCost),
    '추가생계비': formatCurrency(rep.additionalLivingCost),
    '가용소득': formatCurrency(rep.monthlyDisposableIncome),
    '최저변제액': formatCurrency(rep.statutoryMinimumAmount),
    '최저변제액충족': rep.meetsStatutoryMinimum ? '충족' : '미충족',
    // 12개월 급여 명세
    '연간총수입': formatCurrency(data.ledgerTotals.annualTotalIncome),
    '연간총공제': formatCurrency(data.ledgerTotals.annualTotalDeductions),
    '연간순수입': formatCurrency(data.ledgerTotals.annualNetIncome),
    '월평균수입': formatCurrency(data.ledgerTotals.monthlyAverageIncome),
  };
}

// ── D5105: 진술서 ──

function mapD5105Fields(data: CourtFilingMasterData): HwpxFieldData {
  return {
    '학력': data.statement.education,
    '혼인경력': data.statement.maritalHistory,
    '주거형태': data.statement.housingType,
    '주거상세': data.statement.housingDetail,
    '주거시작일': data.statement.housingStartDate,
    '압류유무': data.statement.hasLitigationOrSeizure ? '있음' : '없음',
    '채무원인': data.statement.debtCauses.join(', '),
    '채무증대경위': data.statement.detailedReasonEssay,
  };
}

// ── D5110: 변제계획안 ──

function mapD5110Fields(data: CourtFilingMasterData): HwpxFieldData {
  const rep = data.repaymentSummary;
  return {
    '변제유형': rep.repaymentType,
    '외부위원여부': rep.isExternalTrustee ? '있음' : '없음',
    '압류여부': rep.hasGarnishment ? '있음' : '없음',
    '변제횟수': `${rep.repaymentMonths}회`,
  };
}

// ── 유틸리티 ──

/** 숫자를 한국 원화 형식으로 변환 */
function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * 특정 양식의 HWPX 파일을 생성하여 다운로드합니다.
 * (UI에서 직접 호출하는 편의 함수)
 */
export { downloadFilledHwpx } from './hwpxTemplateEngine';
