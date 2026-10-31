// ============================================================
// 통합어드민 게시 기준표 → 계산 엔진 (LS-5)
// 게시본(AppSettings.yearlyPolicies)을 엔진이 읽는 칸으로 옮긴다.
// 0원·빈 표는 '미발표'로 보고 옮기지 않는다 (엔진은 앞 해 의결·코드 값을 쓴다).
// 같은 값이 코드 기본값에도 있으므로, 게시본이 없거나 읽지 못하면 계산은 그대로 동작한다.
// ============================================================
import type { AppSettings, RegionKey, YearlyPolicy } from '../../types';
import { setActiveCalcStandard, type ActiveCalcStandard, type CalcStandardYear, type StdRegion } from './calcStandardRegistry';

const REGION: Record<RegionKey, StdRegion> = { Seoul: 'SEOUL', Overcrowded: 'OVERCROWDED', Metro: 'METROPOLITAN', Others: 'OTHERS' };
const pos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function medianAt(p: YearlyPolicy, size: number): number | null {
  const values = p.medianIncome?.values || {};
  if (size <= 6) return pos(values[size]) ? values[size] : null;
  const inc = p.medianIncome?.incrementOver7;
  return pos(values[6]) && pos(inc) ? values[6] + (size - 6) * inc : null;
}

export function standardYearFromPolicy(p: YearlyPolicy): CalcStandardYear {
  const out: CalcStandardYear = {};
  const living: Record<number, number> = {};
  for (let n = 1; n <= 8; n++) {
    const m = medianAt(p, n);
    if (m === null) { Object.keys(living).forEach(k => delete living[Number(k)]); break; }
    living[n] = Math.round(m * 0.6);
  }
  if (Object.keys(living).length === 8) {
    out.living60 = living;
    if (pos(p.medianIncome?.incrementOver7)) out.additionalPerPerson60 = Math.round(p.medianIncome.incrementOver7 * 0.6);
  }
  const housing = p.housingCostLimits;
  if (housing) {
    const limit: Partial<Record<StdRegion, Record<number, number>>> = {};
    let included: Record<number, number> | undefined;
    for (const [key, sizes] of Object.entries(housing) as [RegionKey, Record<number, { additionalLimit: number; includedInMedian: number }>][]) {
      const region = REGION[key];
      if (!region || !sizes) continue;
      const lim: Record<number, number> = {};
      const inc: Record<number, number> = {};
      for (let n = 1; n <= 4; n++) {
        if (pos(sizes[n]?.additionalLimit)) lim[n] = sizes[n].additionalLimit;
        if (pos(sizes[n]?.includedInMedian)) inc[n] = sizes[n].includedInMedian;
      }
      if (Object.keys(lim).length === 4) limit[region] = lim;
      if (!included && Object.keys(inc).length === 4) included = inc;
    }
    if (Object.keys(limit).length > 0) out.housingLimit = limit;
    if (included) out.housingIncluded = included;
  }
  const med = p.medicalCostIncludedInMedian as unknown as Record<number, number> | undefined;
  if (med && [1, 2, 3, 4].every(n => pos(med[n]))) out.medicalIncluded = { 1: med[1], 2: med[2], 3: med[3], 4: med[4] };
  if (pos(p.educationCost?.includedInMedian)) out.educationIncluded = p.educationCost.includedInMedian;
  if (pos(p.educationCost?.additionalLimit)) out.educationLimit = p.educationCost.additionalLimit;
  if (pos(p.specialEducationCost?.additionalLimit)) out.specialEducationLimit = p.specialEducationCost.additionalLimit;
  return out;
}

export function standardFromSettings(settings: AppSettings, version: number | null): ActiveCalcStandard {
  const years: Record<number, CalcStandardYear> = {};
  const policies = settings.yearlyPolicies || {};
  for (const [y, p] of Object.entries(policies)) {
    if (p) years[Number(y)] = standardYearFromPolicy(p);
  }
  // 압류금지·소액임차는 연도와 무관한 법정 금액 → 가장 최근 해 게시값
  const latestYear = Object.keys(policies).map(Number).sort((a, b) => b - a)[0];
  const latest = latestYear ? policies[latestYear] : undefined;
  const depositLimits: ActiveCalcStandard['depositLimits'] = {};
  for (const [key, rule] of Object.entries(latest?.depositRules || {}) as [RegionKey, { limit: number; deduct: number }][]) {
    if (REGION[key] && pos(rule?.limit) && pos(rule?.deduct)) depositLimits[REGION[key]] = { maxDeposit: rule.limit, exemptAmount: rule.deduct };
  }
  return {
    version,
    years,
    depositLimits: Object.keys(depositLimits).length ? depositLimits : undefined,
    depositExemption: pos(latest?.assetExemptions?.deposit) ? latest!.assetExemptions.deposit : undefined,
    insuranceExemption: pos(latest?.assetExemptions?.insurance) ? latest!.assetExemptions.insurance : undefined,
  };
}

/** 게시본을 계산 엔진에 연결 (게시본이 없으면 비운다 → 코드 기본값) */
export function applyPublishedCalcStandard(settings: AppSettings | null, version: number | null): void {
  setActiveCalcStandard(settings && version !== null ? standardFromSettings(settings, version) : null);
}
