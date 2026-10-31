// ============================================================
// 제도 이해용 변제금 계산기 (B-7, 고객 기획서 9번·1-G)
//  * 개인 사건 판단이 아니라 공개 기준(기준 중위소득 60% 생계비·추가 생계비 의결·청산가치·변제기간 원칙)을 적용한 일반 계산
//  * 계산은 변호사 '사건 검토'와 같은 통합 엔진(runCaseReview → estimateRehabPlan)을 쓴다
//  * 결과는 단일 숫자가 아니라 범위: 추가 생계비(주거비·의료비·교육비)를 법원이 인정하지 않을 때 ~ 인정할 때
//  * 감면율·감면액·'가능/불가' 판정은 만들지 않는다. 입력·결과는 저장하거나 서버로 보내지 않는다
// ============================================================
import { runCaseReview, emptyReviewInput, type ReviewRegion, type CaseReviewInput, type CaseReviewResult } from '../cases/caseReviewCalc';
import { getLivingExpense } from './repaymentConstants2026';

export type HousingKind = 'rent' | 'jeonse' | 'own' | 'free';

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
  /** 법원 실무준칙의 3년 미만 단축 사유에 해당하는지 (65세 이상·중증장애 등, 확인용) */
  shortPlanReason: boolean;
}

export function emptyPublicCalcInput(year = new Date().getFullYear()): PublicCalcInput {
  return {
    year, monthlyIncome: 0, totalDebt: 0, priorityDebt: 0, householdSize: 1, minorChildren: 0, region: 'SEOUL',
    housing: 'rent', monthlyRent: 0, housingDeposit: 0, medicalExpense: 0, educationPerChild: 0,
    savings: 0, insuranceRefund: 0, carNet: 0, realEstateNet: 0, shortPlanReason: false,
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
}

const TEN_THOUSAND = 10_000;
const floorMan = (n: number) => Math.max(0, Math.floor(n / TEN_THOUSAND) * TEN_THOUSAND);
const ceilMan = (n: number) => Math.max(0, Math.ceil(n / TEN_THOUSAND) * TEN_THOUSAND);
export const formatMan = (won: number) => `${Math.round(won / TEN_THOUSAND).toLocaleString('ko-KR')}만 원`;

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
    allowShortPlan: !!i.shortPlanReason,
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
  if (i.householdSize > 1) factors.push('가족을 부양가족으로 인정하는지(배우자 소득 등)는 법원마다 보는 방식이 달라요.');
  if (i.shortPlanReason) factors.push('3년보다 짧은 기간은 법원 실무준칙의 사유에 해당하는지 변호사가 확인해야 해요.');
  factors.push('소득이 일정하지 않으면(영업·프리랜서) 최근 소득 자료로 다시 계산해요.');

  return {
    high, low,
    range: {
      monthlyLow, monthlyHigh, monthsLow, monthsHigh, totalLow, totalHigh, steps, factors,
      noDisposable: high.disposableIncome <= 0 && low.disposableIncome <= 0,
      liquidationExceeds: high.status === 'LIQUIDATION_EXCEEDS',
      quick,
    },
  };
}
