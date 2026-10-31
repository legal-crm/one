// ============================================================
// 제도 이해용 변제금 계산기 (B-7, 고객 기획서 9번·1-G)
//  * 개인 사건 판단이 아니라 공개 기준(기준 중위소득 60% 생계비·추가 생계비 의결·청산가치·변제기간 원칙)을 적용한 일반 계산
//  * 계산은 변호사 '사건 검토'와 같은 통합 엔진(runCaseReview → estimateRehabPlan)을 쓴다
//  * 결과는 단일 숫자가 아니라 범위: 추가 생계비(주거비·의료비·교육비)를 법원이 인정하지 않을 때 ~ 인정할 때
//  * 감면율·감면액·'가능/불가' 판정은 만들지 않는다. 입력·결과는 저장하거나 서버로 보내지 않는다
// ============================================================
import { runCaseReview, emptyReviewInput, type ReviewRegion, type CaseReviewInput, type CaseReviewResult } from '../cases/caseReviewCalc';
import { getLivingExpense } from './repaymentConstants2026';
import { checkShortPlanReason } from './rehabLegalCore';
import { activeCalcStandardVersion, exactStandard } from './calcStandardRegistry';

export type HousingKind = 'rent' | 'jeonse' | 'own' | 'free';
export type IncomeKind = 'salary' | 'business' | 'freelance';
/** 관할 법원 종류 — 3년 미만 단축 사유 목록(실무준칙 제424호)은 6개 회생법원만 운영 */
export type CourtKind = 'rehab_court' | 'seoul_rehab' | 'district' | 'unknown';

export interface PublicCalcInput {
  /** 적용 연도 (보통 올해, 신청 예정 연도) */
  year: number;
  /** 월 실수령 소득 (원) */
  monthlyIncome: number;
  /** 총 채무 (원, 세금 체납 포함) */
  totalDebt: number;
  /** 그중 세금·4대보험 체납 (원) — 먼저 갚아야 하는 채무 */
  priorityDebt: number;
  /** 본인 포함 가구원 수 */
  householdSize: number;
  /** 미성년 자녀 수 (교육비 추가 생계비 판단용) */
  minorChildren: number;
  region: ReviewRegion;
  housing: HousingKind;
  /** 월세 (원, 월세일 때) */
  monthlyRent: number;
  /** 임차보증금 (원, 전세·월세) */
  housingDeposit: number;
  /** 매달 쓰는 의료비 (원) */
  medicalExpense: number;
  /** 자녀 1인당 매달 교육비 (원) */
  educationPerChild: number;
  /** 예금·적금 (원) */
  savings: number;
  /** 보장성 보험 해약환급금 합계 (원) */
  insuranceRefund: number;
  /** 자동차 시세 − 할부 잔액 (원) */
  carNet: number;
  /** 부동산 시세 − 담보 대출 (원) */
  realEstateNet: number;
  /** (옛 입력) 단축 사유가 있다고 직접 표시 — 새 화면은 아래 사실 입력을 쓴다 */
  shortPlanReason: boolean;
  /** 소득 형태 (결과는 같고, 결과를 바꾸는 요인 안내만 달라짐) */
  incomeKind?: IncomeKind;
  /** 배우자 소득 (부양가족 인정 범위 안내용) */
  spouseIncome?: 'none' | 'yes' | 'unknown';
  /** 출생연도 (만 65세 이상·만 30세 미만 단축 사유 판단용, 저장 안 함) */
  birthYear?: number;
  /** 관할 법원 */
  court?: CourtKind;
  /** 3년 미만 단축 사유 관련 사실 (화면 안에서만 쓰고 저장·전송 안 함) */
  shortFacts?: { severeDisability?: boolean; singleParent?: boolean; rentFraud?: boolean; vulnerableSeoul?: boolean };
}

export function emptyPublicCalcInput(year = new Date().getFullYear()): PublicCalcInput {
  return {
    year, monthlyIncome: 0, totalDebt: 0, priorityDebt: 0, householdSize: 1, minorChildren: 0, region: 'SEOUL',
    housing: 'rent', monthlyRent: 0, housingDeposit: 0, medicalExpense: 0, educationPerChild: 0,
    savings: 0, insuranceRefund: 0, carNet: 0, realEstateNet: 0, shortPlanReason: false,
    incomeKind: 'salary', spouseIncome: 'none', court: 'unknown', shortFacts: {},
  };
}

export interface PublicCalcRange {
  /** 월 변제금 범위 (원, 만 원 단위로 바깥쪽 반올림) */
  monthlyLow: number;
  monthlyHigh: number;
  monthsLow: number;
  monthsHigh: number;
  totalLow: number;
  totalHigh: number;
  /** 계산 과정 (높은 쪽 = 추가 생계비 인정 안 될 때, 낮은 쪽 = 인정될 때) */
  steps: { label: string; value: string; note?: string }[];
  /** 결과를 바꾸는 요인 (입력에 따라 고른 일반 안내) */
  factors: string[];
  /** 소득이 생계비보다 적거나 같아 변제금이 계산되지 않음 */
  noDisposable: boolean;
  /** 재산 가치가 채무 이상 */
  liquidationExceeds: boolean;
  /** 빠른 모드라 재산·주거비를 모름 */
  quick: boolean;
  /** 3년 미만 단축 사유 확인 결과 (판정 아님 — 검토안 범위에만 반영) */
  shortPlan: { reasons: string; applied: boolean; needsCourtCheck: boolean };
  /** 근거 표시: 적용 연도·게시 기준표 버전·추가 생계비 의결 기준 */
  source: { year: number; tableVersion: number | null; medianNotice: string; additionalBasis: string };
}

const TEN_THOUSAND = 10_000;
/** 확인한 고시 번호만 적는다 (모르면 연도만) */
const MEDIAN_NOTICE: Record<number, string> = {
  2027: '보건복지부고시 제2026-157호(2027년 기준 중위소득)',
};
const floorMan = (n: number) => Math.max(0, Math.floor(n / TEN_THOUSAND) * TEN_THOUSAND);
const ceilMan = (n: number) => Math.max(0, Math.ceil(n / TEN_THOUSAND) * TEN_THOUSAND);
export const formatMan = (won: number) => `${Math.round(won / TEN_THOUSAND).toLocaleString('ko-KR')}만 원`;

/** 단축 사유 확인 (실무준칙 제424호, 서울은 2026-10-01 제7호 취약채무자 추가) — 판정이 아니라 '3년 미만 검토안'을 범위에 넣을지 */
export function publicShortPlan(i: PublicCalcInput): PublicCalcRange['shortPlan'] {
  const age = i.birthYear && i.birthYear > 1900 ? i.year - i.birthYear : undefined;
  const f = i.shortFacts || {};
  const court = i.court || 'unknown';
  const hasRule = court === 'rehab_court' || court === 'seoul_rehab';
  const probe = checkShortPlanReason({
    courtHasRule: true, age, severeDisability: !!f.severeDisability, singleParent: !!f.singleParent, rentFraud: !!f.rentFraud,
    minorChildren: i.minorChildren, vulnerableDebtorSeoul: court === 'seoul_rehab' && !!f.vulnerableSeoul,
  });
  const legacy = !!i.shortPlanReason && !probe.eligible;
  if (!probe.eligible && !legacy) return { reasons: '', applied: false, needsCourtCheck: false };
  const reasons = probe.eligible ? probe.reason : '직접 표시한 사유';
  return { reasons, applied: hasRule || legacy, needsCourtCheck: !hasRule && !legacy };
}

function toReviewInput(i: PublicCalcInput, withAdditional: boolean, quick: boolean): CaseReviewInput {
  const r = emptyReviewInput(i.year);
  const priority = Math.min(Math.max(0, i.priorityDebt), Math.max(0, i.totalDebt));
  // 빠른 모드에서 월세 금액을 모르면 '지역 한도까지 인정될 때'를 낮은 쪽 끝으로 본다 (엔진이 한도에서 자른다)
  const rent = i.housing === 'rent'
    ? (i.monthlyRent > 0 ? i.monthlyRent : (quick ? 5_000_000 : 0))
    : 0;
  return {
    ...r,
    year: i.year,
    householdSize: Math.max(1, Math.floor(i.householdSize || 1)),
    region: i.region,
    monthlyIncome: Math.max(0, i.monthlyIncome),
    housingExpense: withAdditional ? rent : 0,
    medicalExpense: withAdditional ? Math.max(0, i.medicalExpense) : 0,
    children: Math.max(0, Math.floor(i.minorChildren || 0)),
    educationPerChild: withAdditional ? Math.max(0, i.educationPerChild) : 0,
    generalDebt: Math.max(0, i.totalDebt - priority),
    priorityDebt: priority,
    deposit: Math.max(0, i.savings),
    insurance: Math.max(0, i.insuranceRefund),
    housingDeposit: i.housing === 'rent' || i.housing === 'jeonse' ? Math.max(0, i.housingDeposit) : 0,
    car: Math.max(0, i.carNet),
    realEstate: i.housing === 'own' || i.realEstateNet > 0 ? Math.max(0, i.realEstateNet) : 0,
    // 단축 검토안은 범위의 낮은 쪽(추가 생계비 인정 쪽)에만 넣는다 — 높은 쪽은 3년 원칙
    allowShortPlan: withAdditional && !quick && publicShortPlan(i).applied,
  };
}

/**
 * 범위 계산. quick = 홈 빠른 모드(소득·채무·가구원·주거 형태만 입력).
 * 같은 입력이면 변호사 '사건 검토'(runCaseReview)와 같은 엔진·같은 기준표로 계산한다.
 */
export function computePublicRange(i: PublicCalcInput, quick = false): { range: PublicCalcRange; high: CaseReviewResult; low: CaseReviewResult } {
  const high = runCaseReview(toReviewInput(i, false, quick)); // 추가 생계비 인정 안 됨 → 변제금 많음
  const low = runCaseReview(toReviewInput(i, true, quick));   // 추가 생계비 인정 → 변제금 적음
  const monthlyLow = floorMan(Math.min(low.monthlyPayment, high.monthlyPayment));
  const monthlyHigh = ceilMan(Math.max(low.monthlyPayment, high.monthlyPayment));
  const monthsLow = Math.min(low.months, high.months);
  const monthsHigh = Math.max(low.months, high.months);
  const totalLow = floorMan(Math.min(low.totalRepayment, high.totalRepayment));
  const totalHigh = ceilMan(Math.max(low.totalRepayment, high.totalRepayment));
  const base = getLivingExpense(Math.max(1, Math.floor(i.householdSize || 1)), i.year);

  const steps: PublicCalcRange['steps'] = [
    { label: `${i.year}년 기본 생계비 (${Math.max(1, Math.floor(i.householdSize || 1))}인 가구)`, value: formatMan(base), note: '기준 중위소득의 60%' },
    { label: '추가로 인정될 수 있는 생계비', value: low.recognizedLivingCost > high.recognizedLivingCost ? `0 ~ ${formatMan(low.recognizedLivingCost - high.recognizedLivingCost)}` : '없음', note: '주거비·의료비·교육비, 법원 위원회 의결 한도 안에서' },
    { label: '매달 갚을 수 있는 돈 (소득 − 생계비)', value: `${formatMan(low.disposableIncome)} ~ ${formatMan(high.disposableIncome)}` },
    { label: '재산 가치 (청산가치, 참고)', value: quick ? '입력 안 함' : formatMan(high.liquidationValue), note: quick ? undefined : '압류금지 예금·보험 250만 원 등 공제 뒤' },
    { label: '변제기간', value: monthsLow === monthsHigh ? `${monthsLow}개월` : `${monthsLow} ~ ${monthsHigh}개월`, note: '3년 원칙, 재산 가치·우선 채무를 채우려면 최장 5년' },
  ];

  const factors: string[] = [];
  if (quick) factors.push('재산·월세·세금 체납을 넣으면 범위가 좁아져요.');
  if (i.housing === 'rent' || i.medicalExpense > 0 || i.minorChildren > 0) factors.push('주거비·의료비·교육비를 생계비에 더 넣어 주는지는 관할 법원이 정해요. 그래서 범위로 보여 드려요.');
  if (!quick && (i.savings + i.insuranceRefund + i.carNet + i.realEstateNet + i.housingDeposit) > 0) factors.push('재산이 있으면 그 가치 이상을 갚아야 해서 기간이 늘거나 월 변제금이 커질 수 있어요.');
  if (i.priorityDebt > 0) factors.push('세금·4대보험 체납은 다른 채무보다 먼저, 보통 변제기간 절반 안에 갚아야 해요.');
  if (i.householdSize > 1) factors.push(i.spouseIncome === 'yes'
    ? '배우자에게 소득이 있으면 부양가족으로 인정하는 범위가 줄 수 있어요. 법원마다 보는 방식이 달라요.'
    : '가족을 부양가족으로 인정하는지(배우자 소득 등)는 법원마다 보는 방식이 달라요.');
  const sp = publicShortPlan(i);
  if (!quick && sp.applied) factors.push(`입력한 사정(${sp.reasons})은 관할 회생법원 실무준칙의 3년 미만 변제기간 사유에 들어가요. 그래서 짧은 기간도 범위에 넣었어요. 실제로 줄일지는 변호사가 서류를 보고 검토해요.`);
  if (!quick && sp.needsCourtCheck) factors.push(`입력한 사정(${sp.reasons})이 있지만, 관할 법원의 3년 미만 단축 기준을 확인해야 해서 3년으로 계산했어요.`);
  if (!quick && i.incomeKind && i.incomeKind !== 'salary') factors.push('영업·프리랜서 소득은 최근 소득 자료와 필요경비를 보고 다시 계산해요.');
  if (quick) factors.push('소득이 일정하지 않으면(영업·프리랜서) 최근 소득 자료로 다시 계산해요.');
  if (i.year >= 2027) factors.push(`추가 생계비는 ${i.year}년 새 의결이 나오기 전까지 2026년 의결 기준을 써요.`);

  return {
    high, low,
    range: {
      monthlyLow, monthlyHigh, monthsLow, monthsHigh, totalLow, totalHigh, steps, factors,
      noDisposable: high.disposableIncome <= 0 && low.disposableIncome <= 0,
      liquidationExceeds: high.status === 'LIQUIDATION_EXCEEDS',
      quick,
      shortPlan: quick ? { reasons: '', applied: false, needsCourtCheck: false } : sp,
      source: {
        year: i.year,
        tableVersion: activeCalcStandardVersion(),
        medianNotice: MEDIAN_NOTICE[i.year] || `보건복지부 ${i.year}년 기준 중위소득 고시`,
        additionalBasis: i.year >= 2027 && !exactStandard(i.year, 'housingLimit') ? '각 회생법원 생계비 검토 위원회 2026년 의결(새 의결 전까지 적용)' : `각 회생법원 생계비 검토 위원회 의결`,
      },
    },
  };
}

/**
 * '정리 확인' 화면에서 의뢰인이 직접 누를 때만 쓰는 변환 (CK-Q1).
 * 정리 자료(financialProfile, 만 원 단위)의 입력 항목만 옮기고, 결과는 상담 요청에 붙이지 않는다.
 * 재산은 종류를 알 수 없어 옮기지 않는다(합계만 있어 공제 계산이 틀어짐) — 화면에서 직접 넣는다.
 */
export function calcSeedFromProfile(fp: any, birthYear?: string): Partial<PublicCalcInput> {
  const won = (v: unknown) => Math.max(0, Math.round(Number(v) || 0) * 10_000);
  const job = String(fp?.jobType || '');
  const housing: HousingKind = fp?.housingType === 'jeonse' ? 'jeonse' : fp?.housingType === 'owned' ? 'own' : fp?.housingType === 'free' ? 'free' : 'rent';
  const dependents = Number(fp?.dependents);
  const by = Number(birthYear);
  return {
    monthlyIncome: won(fp?.income),
    incomeKind: job === 'BUSINESS' ? 'business' : job === 'FREELANCER' || job === 'DAILY' ? 'freelance' : 'salary',
    totalDebt: won(fp?.debtTotal),
    priorityDebt: won(fp?.priorityDebt),
    householdSize: Number.isFinite(dependents) && dependents >= 0 ? Math.min(7, dependents + 1) : 1,
    minorChildren: Math.max(0, Math.min(4, Math.floor(Number(fp?.minorChildren) || 0))),
    spouseIncome: fp?.maritalStatus === 'MARRIED' ? (Number(fp?.spouseIncome) > 0 ? 'yes' : 'unknown') : 'none',
    housing,
    monthlyRent: housing === 'rent' ? won(fp?.rentCost) : 0,
    housingDeposit: housing === 'rent' || housing === 'jeonse' ? won(fp?.rentalDeposit) : 0,
    ...(by >= 1900 && by <= new Date().getFullYear() ? { birthYear: by } : {}),
  };
}
