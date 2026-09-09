/**
 * 2026년 기준 개인회생 핵심 법정 상수 및 계산 계수
 * (서울회생법원 실무준칙 및 생계비 검토위원회 가이드라인 반영)
 */

// ==============================================================================
// 1. 2026년 가구원 수별 기준 중위소득 및 기초생계비 (중위소득 60%)
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

// 법원 공시 원 단위 절사 기초생계비 (60%)
export const MIN_LIVING_EXPENSE_60_2026: Record<number, number> = {
  1: 1538542,
  2: 2519575,
  3: 3215421,
  4: 3896842,
  5: 4534031,
  6: 5133571,
  7: 5709090,
  8: 6284608,
};

// 8인 초과 1인당 추가분
export const ADDITIONAL_PER_PERSON_100_2026 = 959198;
export const ADDITIONAL_PER_PERSON_60_2026 = 575518;

/**
 * 부양가족 수(0.5인 맞벌이 공동부양 등 소수점 포함)에 따른 2026년 기초생계비 산출
 */
export function get2026LivingExpense(householdSize: number): number {
  if (householdSize <= 0) return 0;
  if (Number.isInteger(householdSize) && MIN_LIVING_EXPENSE_60_2026[householdSize]) {
    return MIN_LIVING_EXPENSE_60_2026[householdSize];
  }
  if (householdSize > 8) {
    const extra = householdSize - 8;
    return MIN_LIVING_EXPENSE_60_2026[8] + Math.round(extra * ADDITIONAL_PER_PERSON_60_2026);
  }

  // 소수점(0.5인) 보간
  const floor = Math.floor(householdSize);
  const ceil = Math.ceil(householdSize);
  const baseLow = MIN_LIVING_EXPENSE_60_2026[floor] || MIN_LIVING_EXPENSE_60_2026[1];
  const baseHigh = MIN_LIVING_EXPENSE_60_2026[ceil] || MIN_LIVING_EXPENSE_60_2026[2];
  const weight = householdSize - floor;
  return Math.round(baseLow + (baseHigh - baseLow) * weight);
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
export const EXEMPT_DEPOSIT_LIMIT = 1850000;              // 예금 압류금지 기본 공제액
export const EXEMPT_INSURANCE_REFUND_LIMIT = 1500000;      // 보장성 보험 해약환급금 압류금지 공제액
export const EXEMPT_PROPERTY_LIVING_LIMIT = 11100000;      // 6개월간 생계비 법정 한도

// 주택임대차보호법 최우선변제 소액보증금 공제 한도 (보증금 요건 충족 시 공제액)
export const HOUSING_EXEMPT_DEPOSIT_LIMITS: Record<RegionType, { maxDeposit: number; exemptAmount: number }> = {
  SEOUL: { maxDeposit: 165000000, exemptAmount: 55000000 },
  OVERCROWDED: { maxDeposit: 145000000, exemptAmount: 48000000 },
  METROPOLITAN: { maxDeposit: 85000000, exemptAmount: 28000000 },
  OTHERS: { maxDeposit: 75000000, exemptAmount: 25000000 },
};

// ==============================================================================
// 5. 라이프니쯔(Leibniz) 연 5% 복리할인 현가 계수 (선적립 3개월 기준)
// ==============================================================================
// 36개월: 3개월(선적립) + 30.7719(33개월 현가) = 33.7719
export const LEIBNIZ_FACTOR_36 = 33.7719;

// 60개월: 3개월(선적립) + 50.6433(57개월 현가) = 53.6433
export const LEIBNIZ_FACTOR_60 = 53.6433;

/**
 * 임의 개월수(24개월 ~ 60개월)의 라이프니쯔 현가 계수 맵 (특례 및 연장 지원)
 */
export const LEIBNIZ_FACTORS: Record<number, number> = {
  24: 22.8421,
  30: 28.3615,
  36: 33.7719,
  48: 44.0321,
  60: 53.6433,
};
