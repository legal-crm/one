// ============================================================
// 사건 검토 (CV-1, 19 기획서) — 통합 엔진(estimateRehabPlan) 하나로 계산하고 서버 case_reviews 에 기록
//  * 입력은 사무소가 확인한 값이 먼저, 없으면 의뢰인이 정리한 값. 지어낸 기본값 없음(빈 칸은 0이 아니라 '입력 필요')
//  * 결과는 월 변제금·기간·총 변제액 중심. '추천'·'적격' 같은 판정 문구 없음 (CV-Q3)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';
import { estimateRehabPlan } from '../repayment/repaymentCalculationEngine';
import type { RepaymentAsset } from '../repayment/repaymentTypes';

export type ReviewRegion = 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS';
export const REVIEW_REGION_LABEL: Record<ReviewRegion, string> = {
  SEOUL: '서울', OVERCROWDED: '과밀억제권역(서울 제외)', METROPOLITAN: '광역시 등', OTHERS: '그 밖의 지역',
};

export interface CaseReviewInput {
  year: number;
  householdSize: number;
  region: ReviewRegion;
  monthlyIncome: number;
  housingExpense: number;
  medicalExpense: number;
  children: number;
  educationPerChild: number;
  generalDebt: number;
  priorityDebt: number;
  deposit: number;            // 예금·적금
  insurance: number;          // 보장성보험 해약환급금
  housingDeposit: number;     // 임차보증금
  car: number;                // 자동차 시가 - 담보
  realEstate: number;         // 부동산 시가 - 담보
  retirement: number;         // 예상 퇴직금 (연금 아님)
  otherAssets: number;
  additionalInclusion: number; // 청산가치 가산(편파변제 등) — 변호사 판단
  allowShortPlan: boolean;
  trusteeExternal: boolean;
}

export interface CaseReviewResult {
  monthlyPayment: number;
  months: number;
  totalRepayment: number;
  recognizedLivingCost: number;
  baseLivingCost: number;
  disposableIncome: number;
  liquidationValue: number;
  status: string;
  why: string;
  warnings: string[];
  satisfiesLiquidation: boolean;
}

export const STATUS_LABEL: Record<string, string> = {
  SHORT_PLAN: '3년 미만 검토안', STANDARD: '36개월', EXTENDED: '60개월까지 연장', FULL_PAYOFF: '원금 조기 완제',
  LIVING_COST_CUT: '60개월로도 부족(생계비 조정 검토)', ASSET_DISPOSAL: '재산 처분 병행 검토', LIQUIDATION_EXCEEDS: '청산가치가 채무 이상', NO_DEBT: '채무 없음',
};

export function emptyReviewInput(year = new Date().getFullYear()): CaseReviewInput {
  return {
    year, householdSize: 1, region: 'SEOUL', monthlyIncome: 0, housingExpense: 0, medicalExpense: 0, children: 0, educationPerChild: 0,
    generalDebt: 0, priorityDebt: 0, deposit: 0, insurance: 0, housingDeposit: 0, car: 0, realEstate: 0, retirement: 0, otherAssets: 0,
    additionalInclusion: 0, allowShortPlan: false, trusteeExternal: false,
  };
}

const asset = (id: string, category: RepaymentAsset['category'], name: string, v: number): RepaymentAsset | null =>
  v > 0 ? { id, category, name, marketValue: v, encumbrance: 0, statutoryDeduction: 0, liquidationValue: 0 } : null;

export function runCaseReview(i: CaseReviewInput): CaseReviewResult {
  const assets = [
    asset('dep', 'DEPOSIT', '예금·적금', i.deposit),
    asset('ins', 'INSURANCE', '보장성보험 해약환급금', i.insurance),
    asset('hd', 'HOUSING_DEPOSIT', '임차보증금', i.housingDeposit),
    asset('car', 'CAR', '자동차', i.car),
    asset('re', 'REAL_ESTATE', '부동산', i.realEstate),
    asset('ret', 'RETIREMENT', '퇴직금', i.retirement),
    asset('oth', 'OTHER', '기타 재산', i.otherAssets),
    asset('add', 'ADDITIONAL_INCLUSION', '청산가치 가산', i.additionalInclusion),
  ].filter(Boolean) as RepaymentAsset[];
  const r = estimateRehabPlan({
    year: i.year, householdSize: i.householdSize, region: i.region, monthlyIncome: i.monthlyIncome,
    housingExpense: i.housingExpense, medicalExpense: i.medicalExpense, children: i.children, educationPerChild: i.educationPerChild,
    trusteeType: i.trusteeExternal ? 'EXTERNAL' : 'INTERNAL', assets, generalDebt: i.generalDebt, priorityDebt: i.priorityDebt,
    allowShortPlan: i.allowShortPlan,
  });
  const p = r.plan;
  return {
    monthlyPayment: Math.round(p.monthlyPayment || 0),
    months: p.months || 0,
    totalRepayment: Math.round(p.totalRepayment || 0),
    recognizedLivingCost: Math.round(r.recognizedLivingCost),
    baseLivingCost: Math.round(r.living.baseLivingExpense),
    disposableIncome: Math.round(p.disposableIncome || 0),
    liquidationValue: Math.round(r.liquidationValue),
    status: p.status,
    why: p.why || '',
    warnings: p.warnings || [],
    satisfiesLiquidation: !!p.satisfiesLiquidation,
  };
}

/** 의뢰인 정리 자료(financialProfile, 만원/원 혼재)에서 채울 수 있는 칸만 (모르면 0으로 두고 '입력 필요' 표시) */
export function inputFromProfile(fp: any, ext?: any): { input: CaseReviewInput; missing: string[] } {
  const i = emptyReviewInput();
  const won = (v: unknown, unit: 'won' | 'man' = 'won') => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(unit === 'man' ? n * 10000 : n) : 0; };
  const ep = ext?.externalProfile || {};
  i.monthlyIncome = won(ep.monthlyIncome) || won(fp?.income) || won(fp?.monthlyIncome);
  i.householdSize = Math.max(1, Math.floor(Number(ep.householdSize || fp?.householdSize || (fp?.dependents != null ? Number(fp.dependents) + 1 : 1)) || 1));
  i.generalDebt = won(ep.totalDebt) || won(fp?.totalDebt) || won(fp?.debt);
  i.priorityDebt = won(fp?.taxDebt);
  i.housingExpense = won(fp?.monthlyRent) || won(fp?.rent);
  i.housingDeposit = won(fp?.rentalDeposit) || won(fp?.deposit);
  i.deposit = won(fp?.savings);
  i.car = won(fp?.carValue);
  i.realEstate = won(fp?.realEstateValue);
  i.children = Math.max(0, Math.floor(Number(fp?.minorChildren || 0)) || 0);
  const missing: string[] = [];
  if (!i.monthlyIncome) missing.push('월 소득');
  if (!i.generalDebt) missing.push('총 채무');
  return { input: i, missing };
}

export interface CaseReviewRecord { id: string; input: CaseReviewInput; result: CaseReviewResult; note?: string; createdAt: string; standardVersion?: number }

export async function loadLatestReview(officeId: string, caseKey: string): Promise<RpcResult<CaseReviewRecord | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_reviews').select('id, input, result, note, created_at, standard_version')
    .eq('office_id', officeId).eq('case_key', caseKey).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? { id: data.id, input: { ...emptyReviewInput(), ...data.input }, result: data.result, note: data.note || undefined, createdAt: data.created_at, standardVersion: data.standard_version ?? undefined } : null };
}

export async function saveReview(officeId: string, caseKey: string, input: CaseReviewInput, result: CaseReviewResult, note?: string, standardVersion?: number | null): Promise<RpcResult<{ id: string; createdAt: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_reviews').insert({ office_id: officeId, case_key: caseKey, input, result, note: note?.trim() || null, standard_version: standardVersion ?? null }).select('id, created_at').single();
  if (error) return toRpcError(error);
  return { ok: true, data: { id: data.id, createdAt: data.created_at } };
}
