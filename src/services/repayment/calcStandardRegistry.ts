// ============================================================
// 계산 기준표 연결 (LS-5): 통합어드민이 게시한 기준표(calc_standard_sets) → 계산 엔진
// - 앱이 시작할 때 게시본을 한 번 읽어 여기에 넣는다 (calcStandardBridge.applyPublishedCalcStandard)
// - 게시본이 없으면 비어 있고, 엔진은 코드에 적힌 법령 원문 확인값을 쓴다
// - 0원·빈 표는 '미발표'로 보고 넣지 않는다 → 엔진은 그 전 해(새 의결 전까지 기존 의결) 값을 쓴다
// 이 파일은 다른 계산 모듈을 가져오지 않는다 (순환 참조 방지)
// ============================================================

export type StdRegion = 'SEOUL' | 'OVERCROWDED' | 'METROPOLITAN' | 'OTHERS';

export interface CalcStandardYear {
  /** 기준 중위소득 60% (가구원수 1~8, 원 단위 반올림) */
  living60?: Record<number, number>;
  /** 8인 넘는 1인당 60% 증가분 */
  additionalPerPerson60?: number;
  /** 기초생계비에 포함된 주거비 (1~4인) */
  housingIncluded?: Record<number, number>;
  /** 추가 주거비 한도 (지역 × 1~4인) */
  housingLimit?: Partial<Record<StdRegion, Record<number, number>>>;
  /** 기초생계비에 포함된 의료비 (1~4인) */
  medicalIncluded?: Record<number, number>;
  educationIncluded?: number;
  educationLimit?: number;
  specialEducationLimit?: number;
}

export interface ActiveCalcStandard {
  version: number | null;
  years: Record<number, CalcStandardYear>;
  depositLimits?: Partial<Record<StdRegion, { maxDeposit: number; exemptAmount: number }>>;
  depositExemption?: number;
  insuranceExemption?: number;
}

let active: ActiveCalcStandard | null = null;

export function setActiveCalcStandard(std: ActiveCalcStandard | null): void {
  active = std;
}

export function getActiveCalcStandard(): ActiveCalcStandard | null {
  return active;
}

/** 게시본 버전 (없으면 null = 코드 기본값) — 결과 화면 '기준표 v○' 표시용 */
export function activeCalcStandardVersion(): number | null {
  return active?.version ?? null;
}

/** 그 해 게시본의 한 칸만 (중위소득처럼 해마다 고시되는 값 — 다른 해 값으로 대신하지 않는다) */
export function exactStandard<K extends keyof CalcStandardYear>(year: number, key: K): CalcStandardYear[K] | undefined {
  return active?.years[year]?.[key];
}

/** 그 해(없으면 가장 가까운 앞 해) 게시본의 한 칸 — 추가 생계비 의결처럼 새 의결 전까지 이어 쓰는 값 */
export function pickStandard<K extends keyof CalcStandardYear>(year: number, key: K): CalcStandardYear[K] | undefined {
  if (!active) return undefined;
  const years = Object.keys(active.years).map(Number).filter(y => y <= year).sort((a, b) => b - a);
  for (const y of years) {
    const v = active.years[y]?.[key];
    if (v !== undefined) return v;
  }
  return undefined;
}
