// 사무소 '사건 검토 기준' (CV-5, 19 기획서 2-5)
// 사무소가 정한 기준으로 사건 검토 결과에 '확인할 점'을 붙이고, 사무소 확인 목록을 보여 준다.
// 저장: 서버 사무소 설정 office_settings 'work_defaults'.caseReviewRules (고치기 = 사무소 설정 수정 권한)
// 이전: '기준 관리'(CopilotRuleSetManager)는 브라우저 저장이고, 분석은 늘 기본 규칙만 써서 저장한 기준이 반영되지 않았다.
// 판정('적격'·'추천')은 하지 않는다. 기준에 걸리면 변호사가 볼 '확인할 점' 문장만 만든다.
import { loadOfficeSettings, saveOfficeSettings } from '../office/officeSettingsService';
import type { CaseReviewInput, CaseReviewResult } from './caseReviewCalc';

export interface CaseReviewRules {
  /** 월 변제금이 이 금액보다 적으면 확인 (0 = 안 봄) */
  minMonthlyPayment: number;
  /** 총 채무가 연 소득의 몇 배를 넘으면 확인 (0 = 안 봄) */
  maxDebtToAnnualIncome: number;
  /** 총 변제액이 청산가치보다 몇 % 이상 많아야 하는지 (0 = 안 봄) */
  minLiquidationMarginPct: number;
  /** 우선채권이 전체 채무의 몇 %를 넘으면 확인 (0 = 안 봄) */
  priorityShareWarnPct: number;
  /** 사무소 확인 목록 (사건마다 체크) */
  checklist: string[];
}

export const EMPTY_CASE_REVIEW_RULES: CaseReviewRules = {
  minMonthlyPayment: 0, maxDebtToAnnualIncome: 0, minLiquidationMarginPct: 0, priorityShareWarnPct: 0, checklist: [],
};

const MAX_CHECKLIST = 20;
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export function normalizeCaseReviewRules(v: unknown): CaseReviewRules {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<CaseReviewRules>;
  const num = (x: unknown, max: number) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
  return {
    minMonthlyPayment: Math.round(num(o.minMonthlyPayment, 10_000_000)),
    maxDebtToAnnualIncome: num(o.maxDebtToAnnualIncome, 100),
    minLiquidationMarginPct: num(o.minLiquidationMarginPct, 100),
    priorityShareWarnPct: num(o.priorityShareWarnPct, 100),
    checklist: (Array.isArray(o.checklist) ? o.checklist : [])
      .map(s => String(s || '').trim().slice(0, 80)).filter(Boolean).slice(0, MAX_CHECKLIST),
  };
}

/** 사무소 기준에 걸린 '확인할 점' (변호사용, 판정 아님) */
export function applyCaseReviewRules(input: CaseReviewInput, result: CaseReviewResult, rules: CaseReviewRules): string[] {
  const out: string[] = [];
  if (rules.minMonthlyPayment > 0 && result.monthlyPayment > 0 && result.monthlyPayment < rules.minMonthlyPayment) {
    out.push(`월 변제금 ${won(result.monthlyPayment)}이 사무소 기준 ${won(rules.minMonthlyPayment)}보다 적어요. 소득·생계비 자료를 다시 확인해 주세요.`);
  }
  const totalDebt = input.generalDebt + input.priorityDebt;
  if (rules.maxDebtToAnnualIncome > 0 && input.monthlyIncome > 0) {
    const ratio = totalDebt / (input.monthlyIncome * 12);
    if (ratio > rules.maxDebtToAnnualIncome) {
      out.push(`총 채무가 연 소득의 ${ratio.toFixed(1)}배로 사무소 기준(${rules.maxDebtToAnnualIncome}배)을 넘어요. 채무 발생 경위·사용처를 확인해 주세요.`);
    }
  }
  if (rules.minLiquidationMarginPct > 0 && result.liquidationValue > 0) {
    const need = result.liquidationValue * (1 + rules.minLiquidationMarginPct / 100);
    if (result.totalRepayment < need) {
      out.push(`총 변제액이 청산가치보다 ${rules.minLiquidationMarginPct}% 이상 많아야 한다는 사무소 기준에 못 미쳐요 (필요 ${won(need)}). 재산 평가를 다시 확인해 주세요.`);
    }
  }
  if (rules.priorityShareWarnPct > 0 && totalDebt > 0) {
    const share = (input.priorityDebt / totalDebt) * 100;
    if (share > rules.priorityShareWarnPct) {
      out.push(`우선채권이 전체 채무의 ${Math.round(share)}%로 사무소 기준(${rules.priorityShareWarnPct}%)을 넘어요. 조세 체납 내역과 우선 변제 기간을 확인해 주세요.`);
    }
  }
  return out;
}

// ── 서버 저장 ──────────────────────────────────────────────
export async function loadCaseReviewRules(officeId: string): Promise<{ ok: true; rules: CaseReviewRules } | { ok: false; message: string }> {
  const r = await loadOfficeSettings<Record<string, unknown>>(officeId, 'work_defaults');
  if (r.ok === false) return { ok: false, message: r.message };
  return { ok: true, rules: normalizeCaseReviewRules(r.data?.data?.caseReviewRules) };
}

/** 저장 직전에 다시 읽어 같은 구역의 다른 칸(수임료 프리셋 등)을 지우지 않는다 */
export async function saveCaseReviewRules(officeId: string, rules: CaseReviewRules): Promise<{ ok: true } | { ok: false; message: string }> {
  const cur = await loadOfficeSettings<Record<string, unknown>>(officeId, 'work_defaults');
  if (cur.ok === false) return { ok: false, message: cur.message };
  const payload = { ...(cur.data?.data || {}), caseReviewRules: normalizeCaseReviewRules(rules) };
  const r = await saveOfficeSettings(officeId, 'work_defaults', payload, cur.data?.version);
  if (r.ok === false) return { ok: false, message: r.message };
  return { ok: true };
}
