// ============================================================
// 채무 관련 제도 일반 안내 (NF-1, 25 기획서 4장) — 홈 '제도별로 보기'·제도 상세 창·정리 확인 화면이 같이 쓴다.
// 판단 없이 일반 정보·공식 연락처·확인일만. "위 목록은 추천 순서가 아닙니다". 외부 자문(R6) 전이라 "일반적으로" 수준.
// 수치·기준은 원문을 확인한 것만 적고(확인일), 모르면 '공식 안내에서 확인'으로 둔다.
// ============================================================

export type SolutionType =
  | 'rehab' | 'bankruptcy' | 'credit' | 'representation' | 'tax'
  | 'direct_adjust' | 'new_leap' | 'legal_aid' | 'living_account';

export interface DebtProgram {
  title: string;
  summary: string;
  keyPoints: string[];
  links: Array<{ label: string; url?: string; phone?: string }>;
  /** 마지막으로 원문·공식 안내와 대조한 날 */
  checkedOn: string;
  ctaTitle: string;
  ctaContent: string;
}


import { useEffect, useState } from 'react';
import { DEBT_PROGRAMS_DATA, DEBT_PROGRAM_ORDER_DATA } from '../../content/debtProgramsData.js';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

/** 제도 데이터 (원본: src/content/debtProgramsData.js, 서버 덮어쓰기는 applyDebtProgramOverrides) */
export const DEBT_PROGRAMS: Record<SolutionType, DebtProgram> = JSON.parse(JSON.stringify(DEBT_PROGRAMS_DATA));
const BASE: Record<SolutionType, DebtProgram> = JSON.parse(JSON.stringify(DEBT_PROGRAMS_DATA));

/** 홈·정리 확인 화면에 보여 주는 순서 (추천 순서 아님) */
export const DEBT_PROGRAM_ORDER: SolutionType[] = [...DEBT_PROGRAM_ORDER_DATA] as SolutionType[];

/** 서버 덮어쓰기 한 건 (통합어드민 '제도 안내') */
export interface DebtProgramOverride {
  summary?: string;
  keyPoints?: string[];
  links?: DebtProgram['links'];
  checkedOn?: string;
  hidden?: boolean;
}
export type DebtProgramOverrides = Partial<Record<SolutionType, DebtProgramOverride>>;
let hiddenSet = new Set<SolutionType>();

/** 서버 덮어쓰기를 반영한다 (빈 값은 원본 유지). 앱 시작 때 App이 부른다 */
export function applyDebtProgramOverrides(o: DebtProgramOverrides | null | undefined): void {
  hiddenSet = new Set();
  for (const k of Object.keys(BASE) as SolutionType[]) {
    const base = BASE[k];
    const x = o?.[k] || {};
    DEBT_PROGRAMS[k] = {
      ...base,
      summary: x.summary?.trim() || base.summary,
      keyPoints: Array.isArray(x.keyPoints) && x.keyPoints.filter(Boolean).length ? x.keyPoints.filter(Boolean) : base.keyPoints,
      links: Array.isArray(x.links) && x.links.length ? x.links.filter(l => l && l.label) : base.links,
      checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(x.checkedOn || '') ? x.checkedOn! : base.checkedOn,
    };
    if (x.hidden && k !== 'rehab' && k !== 'bankruptcy') hiddenSet.add(k);
  }
}
/** 숨긴 제도를 뺀 화면 순서 */
export function visibleDebtPrograms(): SolutionType[] {
  return DEBT_PROGRAM_ORDER.filter(k => !hiddenSet.has(k));
}
export function baseDebtProgram(k: SolutionType): DebtProgram { return BASE[k]; }

// ── 서버 덮어쓰기 불러오기 (platform_config 'debt_programs', 누구나 읽기·관리자 쓰기) ──
export const DEBT_PROGRAMS_CONFIG_ID = 'debt_programs';
let version = 0;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

/** 서버 값을 한 번 읽어 반영한다. 실패하면 원본 그대로 (일반 안내라 화면을 막지 않음) */
export function loadDebtProgramOverrides(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('platform_config').select('data').eq('id', DEBT_PROGRAMS_CONFIG_ID).maybeSingle();
    if (error) { console.warn('[debtPrograms] 제도 안내 덮어쓰기를 못 읽었어요:', error.message); return; }
    applyDebtProgramOverrides(((data?.data as any)?.programs ?? null) as DebtProgramOverrides | null);
    version += 1;
    listeners.forEach(fn => fn());
  })();
  return loading;
}

/** 제도 안내를 쓰는 화면이 부른다: 처음 한 번 서버 값을 읽고, 바뀌면 다시 그린다 */
export function useDebtProgramsVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const fn = () => setV(version);
    listeners.add(fn);
    void loadDebtProgramOverrides();
    return () => { listeners.delete(fn); };
  }, []);
  return v;
}
