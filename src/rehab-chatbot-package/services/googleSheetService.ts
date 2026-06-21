import { GlobalSettings } from '../types';
import { RehabPolicyConfig, CourtTrait, DEFAULT_POLICY_CONFIG_2026 } from '../config/PolicyConfig';
import { AppSettings, YearlyPolicy, CourtConfig, CourtRegionMapItem, RegionKey } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';

/**
 * 지역 키 매핑 (AppSettings 영문 → RehabPolicyConfig 한글)
 */
const REGION_KEY_TO_KR: Record<string, string> = {
  'Seoul': '서울특별시',
  'Overcrowded': '과밀억제권역',
  'Metro': '광역시기준',
  'Others': '그외',
};

/**
 * AppSettings.YearlyPolicy → RehabPolicyConfig 변환 어댑터
 * 
 * 관리자 환경설정(AppSettings)에서 저장된 값을 챗봇 계산 엔진(RehabPolicyConfig)이
 * 이해할 수 있는 형태로 변환합니다.
 */
function convertToRehabPolicyConfig(
  year: number,
  yearPolicy: YearlyPolicy,
  appSettings: AppSettings
): RehabPolicyConfig {
  const defaultTraits = DEFAULT_POLICY_CONFIG_2026.courtTraits;

  // 1. 중위소득 → 직접 복사
  const medianIncome: Record<number, number> = { ...yearPolicy.medianIncome.values };
  const medianIncomeIncrement = yearPolicy.medianIncome.incrementOver7;

  // 2. 인정 생계비 → 중위소득 × 60% 계산
  const recognizedLivingCost: Record<number, number> = {};
  for (const [sizeStr, income] of Object.entries(medianIncome)) {
    recognizedLivingCost[Number(sizeStr)] = Math.round(income * 0.6);
  }

  // 3. 보증금 공제 → 영문 키를 한글 키로 변환
  const depositExemptions: Record<string, { limit: number; deduct: number }> = {};
  for (const [engKey, rule] of Object.entries(yearPolicy.depositRules)) {
    const krKey = REGION_KEY_TO_KR[engKey] || engKey;
    depositExemptions[krKey] = { limit: rule.limit, deduct: rule.deduct };
  }

  // 4. 주거비 한도 → 영문 키 + 필드명 변환
  const additionalHousingCosts: Record<string, Record<number, { limit: number; included: number; totalLimit: number }>> = {};
  for (const [engKey, sizeMap] of Object.entries(yearPolicy.housingCostLimits)) {
    const krKey = REGION_KEY_TO_KR[engKey] || engKey;
    additionalHousingCosts[krKey] = {};
    for (const [sizeStr, rule] of Object.entries(sizeMap)) {
      additionalHousingCosts[krKey][Number(sizeStr)] = {
        limit: rule.additionalLimit,
        included: rule.includedInMedian,
        totalLimit: rule.totalLimit,
      };
    }
  }

  // 5. 의료비 포함분 → 직접 복사
  const medicalCostIncluded: Record<number, number> = { ...yearPolicy.medicalCostIncludedInMedian };

  // 6. 교육비 기준 → educationCost + specialEducationCost 합산
  const educationCostCriteria = {
    included: yearPolicy.educationCost.includedInMedian,
    limit: yearPolicy.educationCost.additionalLimit,
    specialLimit: yearPolicy.specialEducationCost.additionalLimit,
  };

  // 7. 고소득자 설정
  const highIncomeConfig = {
    thresholdRate: yearPolicy.highIncomeEarnerMultiplier,
    maxLivingCostRate: 1.0,
    minRepaymentRate: yearPolicy.highIncomeRepaymentRateThreshold,
  };

  // 8. 법원 성향 → courtConfigs boolean 플래그 + DEFAULT 기본값 병합
  const courtTraits: Record<string, CourtTrait> = {};
  for (const [courtName, config] of Object.entries(appSettings.courtConfigs)) {
    const defaultTrait = defaultTraits[courtName] || defaultTraits['Default'];
    courtTraits[courtName] = {
      name: defaultTrait?.name || courtName,
      allow24Months: config.allow24Month,
      spousePropertyRate: config.includeSpouseProperty ? 0.5 : 0.0,
      investLossInclude: config.includeCryptoStock,
      processingMonths: defaultTrait?.processingMonths || 6.0,
      description: config.description || defaultTrait?.description || '',
    };
  }
  // Default 항목 보장
  if (!courtTraits['Default']) {
    courtTraits['Default'] = defaultTraits['Default'];
  }

  // 9. 지역 → 법원 매핑 (courtRegionMap 배열 → 딕셔너리)
  const regionToCourtMap: Record<string, string> = {};
  for (const item of appSettings.courtRegionMap) {
    regionToCourtMap[item.keyword] = item.court;
  }

  // 10. 지역 → 그룹 매핑 (courtRegionMap 배열 → 한글 그룹 딕셔너리)
  const regionToGroupMap: Record<string, string> = {};
  for (const item of appSettings.courtRegionMap) {
    const krGroup = REGION_KEY_TO_KR[item.region] || '그외';
    regionToGroupMap[item.keyword] = krGroup;
  }

  return {
    baseYear: year,
    medianIncome,
    medianIncomeIncrement,
    recognizedLivingCost,
    depositExemptions,
    livingCostRate: 0.6,
    additionalHousingCosts,
    medicalCostIncluded,
    educationCostCriteria,
    highIncomeConfig,
    courtTraits,
    regionToCourtMap,
    regionToGroupMap,
  };
}

/**
 * 전역 설정 로드 — localStorage에서 AppSettings를 읽어 RehabPolicyConfig로 변환
 * 
 * 관리자가 환경설정 페이지에서 저장한 값(localStorage 'rehab_policy_settings')을
 * 챗봇 V1/V2가 사용하는 RehabPolicyConfig 형태로 변환하여 반환합니다.
 * 저장된 값이 없으면 null을 반환하여 챗봇이 DEFAULT_POLICY_CONFIG_2026을 사용하도록 합니다.
 */
export const fetchGlobalSettings = async (): Promise<GlobalSettings | null> => {
  try {
    const stored = localStorage.getItem('rehab_policy_settings');
    if (!stored) return null;

    const appSettings: AppSettings = JSON.parse(stored);

    // 연도별 RehabPolicyConfig 생성
    const rehabPolicyConfigs: Record<number, RehabPolicyConfig> = {};
    for (const yearStr of Object.keys(appSettings.yearlyPolicies)) {
      const year = Number(yearStr);
      const yearPolicy = appSettings.yearlyPolicies[year];
      if (yearPolicy) {
        rehabPolicyConfigs[year] = convertToRehabPolicyConfig(year, yearPolicy, appSettings);
      }
    }

    // 현재 연도 또는 2026년 fallback
    const currentYear = new Date().getFullYear();
    const currentConfig = rehabPolicyConfigs[currentYear] || rehabPolicyConfigs[2026] || rehabPolicyConfigs[Object.keys(rehabPolicyConfigs).map(Number).sort()[0]];

    return {
      rehabPolicyConfigs,          // V1용: Record<number, RehabPolicyConfig>
      policyConfig: currentConfig, // V2용: 단일 RehabPolicyConfig
    } as any;
  } catch (err) {
    console.warn('환경설정 로드 실패, 기본값 사용:', err);
    return null;
  }
};
