/**
 * 2026년 기준 개인회생 핵심 법정 상수 및 계산 계수
 * (서울회생법원 실무준칙 및 생계비 검토위원회 가이드라인 반영)
 */

// ==============================================================================
// 0. 민사집행법 압류금지 기준 (단일 출처) — 개정 시 이 값만 수정
//    민사집행법 시행령 개정(2026-02-01 시행) 원문 확인(10-29, 27 기획서 10장):
//    현금·예금 합쳐 250만 원, 급여 최저 250만 원, 보장성보험 해약·만기환급금 합산 250만 원
//    (이전 값 185만·150만은 개정 전 금액)
// ==============================================================================
/** 압류금지 현금·예금 (개인별 합계 1회, 민사집행법 시행령 제7조) */
export const DEPOSIT_EXEMPTION_KRW = 2_500_000;
/** 압류금지 최저 급여액 (민사집행법 시행령 제3조) */
export const WAGE_EXEMPTION_MIN_KRW = 2_500_000;
/** 표준적 가구 생계비 기준 압류금지 상한 기준액 (민사집행법 시행령 제4조) */
export const WAGE_EXEMPTION_CAP_BASE_KRW = 3_000_000;

/**
 * 월 급여(세후) 중 압류금지 금액 (민사집행법 제246조 제1항 제4호)
 *  - 원칙: 급여의 1/2
 *  - 1/2이 250만원 미만이면 250만원 (급여가 250만원 이하이면 전액)
 *  - 1/2이 300만원 초과이면 300만원 + (급여/2 − 300만원)/2
 */
export function wageExemptAmount(monthlyWage: number): number {
  const w = Math.max(0, Number(monthlyWage) || 0);
  const half = w / 2;
  if (half < WAGE_EXEMPTION_MIN_KRW) return Math.min(w, WAGE_EXEMPTION_MIN_KRW);
  if (half > WAGE_EXEMPTION_CAP_BASE_KRW) return Math.floor(WAGE_EXEMPTION_CAP_BASE_KRW + (half - WAGE_EXEMPTION_CAP_BASE_KRW) / 2);
  return Math.floor(half);
}

// ==============================================================================
// 1. 2026년 / 2025년 가구원 수별 기준 중위소득 및 기초생계비 (중위소득 60%)
// ==============================================================================
export const MEDIAN_INCOME_100_2026: Record<number, number> = {
  1: 2564238,
  2: 4199292,
  3: 5359036,
  4: 6494738,
  5: 7556719,
  6: 8555952,
  7: 9515150,
  8: 10474348,
};

// 기초생계비 (기준 중위소득 60%, 원 단위 반올림 — LS-Q2 결정, 실제 접수본·경쟁사 표와 같음)
// (이전: 2026 표를 절사해 1인 1,538,542 등 1원 차이, 2025 표는 다른 해 값이라 1인 1,438,432로 틀렸음)
export const MIN_LIVING_EXPENSE_60_2026: Record<number, number> = {
  1: 1538543,
  2: 2519575,
  3: 3215422,
  4: 3896843,
  5: 4534031,
  6: 5133571,
  7: 5709090,
  8: 6284609,
};

// 8인 초과 1인당 추가분 - 2026년 (7인 − 6인)
export const ADDITIONAL_PER_PERSON_100_2026 = 959198;
export const ADDITIONAL_PER_PERSON_60_2026 = 575519;

// 2025년 기준 중위소득(보건복지부고시) 1~7인: 2,392,013 / 3,932,658 / 5,025,353 / 6,097,773 / 7,108,192 / 8,064,805 / 8,988,428
export const MIN_LIVING_EXPENSE_60_2025: Record<number, number> = {
  1: 1435208,
  2: 2359595,
  3: 3015212,
  4: 3658664,
  5: 4264915,
  6: 4838883,
  7: 5393057,
  8: 5947231,
};
export const ADDITIONAL_PER_PERSON_60_2025 = 554174;

// 2027년 기준 중위소득 (보건복지부고시 제2026-157호, 2027-01-01 시행)
export const MEDIAN_INCOME_100_2027: Record<number, number> = {
  1: 2736042,
  2: 4480645,
  3: 5718091,
  4: 6929885,
  5: 8063019,
  6: 9129201,
  7: 10152665,
  8: 11176129,
};
export const ADDITIONAL_PER_PERSON_100_2027 = 1023464;
export const MIN_LIVING_EXPENSE_60_2027: Record<number, number> = {
  1: 1641625,
  2: 2688387,
  3: 3430855,
  4: 4157931,
  5: 4837811,
  6: 5477521,
  7: 6091599,
  8: 6705677,
};
export const ADDITIONAL_PER_PERSON_60_2027 = 614078;

export type LivingExpenseYear = 2025 | 2026 | 2027;

/**
 * 부양가족 수(0.5인 맞벌이 공동부양 등 소수점 포함) 및 적용 연도에 따른 기초생계비 산출
 * 적용 연도 = 신청(예정)일 연도 (LS-Q1). 표가 없는 연도는 가장 가까운 연도 표.
 */
export function getLivingExpense(householdSize: number, year: number = 2026): number {
  if (householdSize <= 0) return 0;
  const y: LivingExpenseYear = year <= 2025 ? 2025 : year >= 2027 ? 2027 : 2026;
  const expenseMap = y === 2025 ? MIN_LIVING_EXPENSE_60_2025 : y === 2027 ? MIN_LIVING_EXPENSE_60_2027 : MIN_LIVING_EXPENSE_60_2026;
  const additionalPerPerson = y === 2025 ? ADDITIONAL_PER_PERSON_60_2025 : y === 2027 ? ADDITIONAL_PER_PERSON_60_2027 : ADDITIONAL_PER_PERSON_60_2026;

  if (Number.isInteger(householdSize) && expenseMap[householdSize]) {
    return expenseMap[householdSize];
  }
  if (householdSize > 8) {
    const extra = householdSize - 8;
    return expenseMap[8] + Math.round(extra * additionalPerPerson);
  }

  // 소수점(0.5인) 보간
  const floor = Math.floor(householdSize);
  const ceil = Math.ceil(householdSize);
  const baseLow = expenseMap[floor] || expenseMap[1];
  const baseHigh = expenseMap[ceil] || expenseMap[2];
  const weight = householdSize - floor;
  return Math.round(baseLow + (baseHigh - baseLow) * weight);
}

/**
 * 2026년 기초생계비 산출 (기존 호환성 유지)
 */
export function get2026LivingExpense(householdSize: number): number {
  return getLivingExpense(householdSize, 2026);
}

// ==============================================================================
// 2. 2026년 지역별 주거비 인정 한도 및 기초 주거비
// ==============================================================================
export type RegionType = 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS';

export interface RegionInfo {
  label: string;
  name: string;
  housingLimit: number; // 1인 기준 총 인정 한도
}

export const REGION_CONFIG_2026: Record<RegionType, RegionInfo> = {
  SEOUL: {
    label: '서울특별시',
    name: '서울',
    housingLimit: 863069,
  },
  OVERCROWDED: {
    label: '수도권 과밀억제권역 / 세종 / 용인 / 화성 / 김포',
    name: '과밀억제권역',
    housingLimit: 703983,
  },
  METROPOLITAN: {
    label: '광역시 / 안산 / 광주 / 파주 / 이천 / 평택 등',
    name: '광역시/대도시',
    housingLimit: 503652,
  },
  OTHERS: {
    label: '그 밖의 지역',
    name: '기타지역',
    housingLimit: 450623,
  },
};

/**
 * 가구원수별 추가 주거비 인정 한도 (2026 서울회생법원 생계비 검토 위원회 의결, 1~4인)
 * 추가 주거비 = min(실제 주거비 − 기초 포함분, 이 한도). 5인 이상은 의결에 없어 4인 한도를 쓴다('확인 필요').
 * 새 의결이 나오기 전까지 다음 해에도 이 표를 쓴다 (27 기획서 10-3).
 * (이전: 모든 가구원수에 1인 총액 한도를 써서 2인 이상 주거비가 낮게 나왔음 — B-3)
 */
export const HOUSING_ADDITIONAL_LIMIT_2026: Record<RegionType, Record<number, number>> = {
  SEOUL: { 1: 589208, 2: 982013, 3: 1253955, 4: 1510789 },
  OVERCROWDED: { 1: 430122, 2: 716869, 3: 915387, 4: 1102876 },
  METROPOLITAN: { 1: 229791, 2: 382985, 3: 489042, 4: 589208 },
  OTHERS: { 1: 176762, 2: 294604, 3: 376186, 4: 453237 },
};

// 가구원수별 기초생계비에 이미 포함된 주거비 (지역 무관, 기초생계비의 약 17.8%)
export const BASE_HOUSING_INCLUDED_2026: Record<number, number> = {
  1: 273861,
  2: 448484,
  3: 572345,
  4: 693638,
};

// ==============================================================================
// 3. 2026년 기초 의료비 및 교육비 공제 기준
// ==============================================================================
// 기초 의료비 공제 시작 기준액 (해당 가구원수 기준액 초과 지출분만 추가 공제)
export const BASE_MEDICAL_EXPENSE_2026: Record<number, number> = {
  1: 64619,
  2: 105822,
  3: 135048,
  4: 163667,
};

// 교육비 공제 기준 (자녀 1인당)
export const BASE_EDUCATION_EXPENSE_DEDUCTION = 89627;      // 기초생계비 내 포함분
export const MAX_ADDITIONAL_REGULAR_EDUCATION = 200000;    // 일반 사교육/교육비 추가공제 한도 (자녀 1인당)
export const MAX_ADDITIONAL_SPECIAL_EDUCATION = 500000;    // 특수 교육비 추가공제 한도 (장애 등)

// ==============================================================================
// 4. 압류금지 채권 및 재산 공제 한도 (민사집행법 및 주임법 소액보증금)
// ==============================================================================
export const EXEMPT_DEPOSIT_LIMIT = DEPOSIT_EXEMPTION_KRW;  // 예금 압류금지 기본 공제액 (단일 출처: 상단 DEPOSIT_EXEMPTION_KRW)
/** 보장성 보험 해약·만기환급금 압류금지 — 모든 보험 합산 1회 250만 원 (시행령 제6조, 2026-02-01) */
export const EXEMPT_INSURANCE_REFUND_LIMIT = 2500000;

/**
 * 파산 면제재산 '6개월간 생계비' (채무자회생법 시행령 제16조 제2항)
 * = 파산선고 당시 4인 가구 기준 중위소득 × 40% × 6
 * 2025: 14,634,655 / 2026: 15,587,371 / 2027: 16,631,724 (이전 고정값 1,110만 원은 근거 없음)
 */
export function sixMonthLivingExemption(year: number = 2026): number {
  const median4 = year <= 2025 ? 6097773 : year >= 2027 ? MEDIAN_INCOME_100_2027[4] : MEDIAN_INCOME_100_2026[4];
  return Math.round(median4 * 0.4 * 6);
}
export const EXEMPT_PROPERTY_LIVING_LIMIT = sixMonthLivingExemption(2026);

// 주택임대차보호법 최우선변제 소액보증금 공제 한도 (보증금 요건 충족 시 공제액)
export const HOUSING_EXEMPT_DEPOSIT_LIMITS: Record<RegionType, { maxDeposit: number; exemptAmount: number }> = {
  SEOUL: { maxDeposit: 165000000, exemptAmount: 55000000 },
  OVERCROWDED: { maxDeposit: 145000000, exemptAmount: 48000000 },
  METROPOLITAN: { maxDeposit: 85000000, exemptAmount: 28000000 },
  OTHERS: { maxDeposit: 75000000, exemptAmount: 25000000 },
};

// ==============================================================================
// 5. 라이프니쯔(Leibniz) 연 5% 복리할인 현가 계수 — 플랫폼 단일 표준
// ==============================================================================
// 월 5/12% 복리 연금현가: Σ(k=1..M) 1/(1+r)^k = (1 - (1+r)^-M) / r
// 36개월 = 33.3657 / 60개월 = 52.9907
// (기존 '선적립 3개월' 방식 33.7719·53.6433은 2026-09 단일화 결정으로 폐기 — rehabLegalCore.ts 참고)
export const LEIBNIZ_MONTHLY_RATE = 0.05 / 12;

/** 임의 개월수에 대한 라이프니쯔 현가 계수 (소수 4자리 반올림) */
export function getLeibnizFactor(months: number): number {
  if (months <= 0) return 0;
  const r = LEIBNIZ_MONTHLY_RATE;
  const factor = (1 - Math.pow(1 + r, -months)) / r;
  return Math.round(factor * 10000) / 10000;
}

export const LEIBNIZ_FACTOR_36 = getLeibnizFactor(36); // 33.3657
export const LEIBNIZ_FACTOR_60 = getLeibnizFactor(60); // 52.9907

/** 주요 개월수 계수 표 (화면 표시용, 모두 동일 공식에서 산출) */
export const LEIBNIZ_FACTORS: Record<number, number> = Object.fromEntries(
  [12, 18, 24, 30, 36, 48, 60].map(m => [m, getLeibnizFactor(m)])
) as Record<number, number>;
