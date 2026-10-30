// ============================================================
// 서류 준비 조건 규칙 (DP-1·DP-3)
// 사건 사실(주거 형태·소득 유형·차량·이혼·개인채권자·압류·투자 손실·퇴직연금) → 서류가 필요한지·필수인지.
// 예전에는 조건이 서류 이름 글자에만 있어("자가 소유자는 불필요") 모든 사건에 같은 목록이 나왔다.
// 모르는 사실은 '확인 필요'로 남기고 빼지 않는다. 변호사가 사건마다 넣고 뺄 수 있다.
// ============================================================

export type HousingFact = 'rent' | 'jeonse' | 'owned' | 'free' | 'dormitory' | 'unknown';
export type IncomeFact = 'salary' | 'business' | 'freelancer' | 'daily' | 'none' | 'unknown';

export interface CaseDocFacts {
  caseType: 'rehab' | 'bankruptcy';
  housing: HousingFact;
  income: IncomeFact;
  hasVehicle: boolean | null;
  ownsRealEstate: boolean | null;
  married: boolean;
  divorced: boolean;
  hasPrivateDebt: boolean;
  hasSeizure: boolean;
  hasInvestmentLoss: boolean;
  retirementPension: 'pension' | 'none' | 'unknown';
  specialSupport: boolean;
}

const has = (v: unknown, ...keys: string[]) => keys.some(k => String(v ?? '').toLowerCase().includes(k.toLowerCase()));

/** 상담 요청·사건 기록에서 서류 판단에 쓰는 사실만 뽑는다 (만 원 단위 금액은 0보다 큰지만 본다) */
export function deriveDocFacts(req: any, crmExt?: any): CaseDocFacts {
  const fp = req?.financialProfile || {};
  const caseTypeRaw = crmExt?.caseType || req?.caseType || crmExt?.serverCaseType;
  const caseType: CaseDocFacts['caseType'] = has(caseTypeRaw, 'bankrupt', '파산') ? 'bankruptcy' : 'rehab';

  const h = String(fp.housingType || '');
  const housing: HousingFact = h === 'rent' || h === 'jeonse' || h === 'owned' || h === 'free' || h === 'dormitory' ? h
    : has(h, '자가', '소유') ? 'owned' : has(h, '무상') ? 'free' : has(h, '전세') ? 'jeonse' : has(h, '월세', '임차') ? 'rent' : 'unknown';

  const jt = `${fp.jobType || ''} ${fp.employmentType || ''} ${fp.incomeType || ''} ${req?.incomeType || ''}`;
  const income: IncomeFact = has(jt, 'business', '사업', '자영')
    ? 'business'
    : has(jt, 'freelancer', '프리랜서', '3.3') ? 'freelancer'
    : has(jt, 'daily', '일용') ? 'daily'
    : has(jt, 'salaried', 'salary', '급여', '직장') ? 'salary'
    : has(jt, 'none', '무직') ? 'none' : 'unknown';

  const assets: any[] = Array.isArray(fp.assets) ? fp.assets : [];
  const assetText = assets.map(a => `${a?.type || ''} ${a?.category || ''} ${a?.name || ''}`).join(' ');
  const hasVehicle = assets.length ? has(assetText, 'vehicle', 'car', '차량', '자동차') : null;
  const ownsRealEstate = housing === 'owned' ? true : assets.length ? has(assetText, 'real_estate', 'house', '부동산', '토지', '주택') : null;

  const ms = String(fp.maritalStatus || '').toLowerCase();
  const legal: string[] = Array.isArray(fp.legalActions) ? fp.legalActions : [];
  const rp = fp.retirementPensionType;

  return {
    caseType,
    housing,
    income,
    hasVehicle,
    ownsRealEstate,
    married: ms === 'married',
    divorced: ms.startsWith('divorced'),
    hasPrivateDebt: Number(fp.debtTypes?.personals) > 0,
    hasSeizure: fp.harassmentLevel === 'SEIZURE' || legal.some(a => has(a, 'seizure', '압류', 'garnish')),
    hasInvestmentLoss: Number(fp.speculativeLoss) > 0 || Number(fp.debtTypes?.coinCrypto) > 0,
    retirementPension: rp === 'pension' || rp === 'none' ? rp : 'unknown',
    specialSupport: ['basic_recipient', 'severe_disability', 'single_parent'].includes(String(fp.specialCondition || '')),
  };
}

export interface RuleResult {
  /** true = 필요, false = 이 사건엔 해당 없음, null = 사실을 몰라 확인 필요 */
  applies: boolean | null;
  required: boolean;
  why: string;
}

type Rule = (f: CaseDocFacts) => RuleResult;
const yes = (why: string, required = true): RuleResult => ({ applies: true, required, why });
const no = (why: string): RuleResult => ({ applies: false, required: false, why });
const maybe = (why: string): RuleResult => ({ applies: null, required: false, why });

const isTenant = (f: CaseDocFacts) => f.housing === 'rent' || f.housing === 'jeonse';
const salaryLike = (f: CaseDocFacts) => f.income === 'salary' || f.income === 'daily';

/** 템플릿 ID별 규칙. 없는 항목은 템플릿의 필수 여부를 그대로 쓴다 */
export const DOC_RULES: Record<string, Rule> = {
  // 주거
  'rs-p2-10': f => (isTenant(f) ? yes('임차(월세·전세) 거주') : f.housing === 'unknown' ? maybe('주거 형태를 확인해 주세요') : no('임차 거주가 아님')),
  'rs-p2-11': f => (f.housing === 'free' || f.housing === 'dormitory' ? yes('무상·사택 거주') : f.housing === 'unknown' ? maybe('주거 형태를 확인해 주세요') : no('무상 거주가 아님')),
  'rs-p2-12': f => (f.ownsRealEstate ? yes('본인 명의 부동산') : f.ownsRealEstate === null ? maybe('부동산 소유를 확인해 주세요') : no('본인 명의 부동산 없음')),
  'rs-p2-21': f => (f.ownsRealEstate ? yes('본인 명의 부동산 시가 소명') : f.ownsRealEstate === null ? maybe('부동산 소유를 확인해 주세요') : no('본인 명의 부동산 없음')),
  // 차량
  'rs-p1-9': f => (f.hasVehicle ? yes('차량 보유') : f.hasVehicle === null ? maybe('차량 보유를 확인해 주세요') : no('차량 없음')),
  'rs-p2-22': f => (f.hasVehicle ? yes('차량 시가 소명') : f.hasVehicle === null ? maybe('차량 보유를 확인해 주세요') : no('차량 없음')),
  // 급여 소득
  'rs-p2-13': f => (salaryLike(f) ? yes('급여 소득') : f.income === 'unknown' ? maybe('소득 유형을 확인해 주세요') : no('급여 소득이 아님')),
  'rs-p2-14': f => (salaryLike(f) ? yes('급여 소득 (재직 3개월 미만이면 필수)', false) : no('급여 소득이 아님')),
  'rs-p2-15': f => (salaryLike(f) ? yes('급여 소득') : f.income === 'unknown' ? maybe('소득 유형을 확인해 주세요') : no('급여 소득이 아님')),
  'rs-p2-16': f => (f.income === 'salary' ? yes('근로자 예상 퇴직금') : f.income === 'unknown' ? maybe('소득 유형을 확인해 주세요') : no('근로자가 아님')),
  'rs-p2-17': f => (salaryLike(f) ? yes('근로자 필수') : f.income === 'unknown' ? maybe('소득 유형을 확인해 주세요') : no('근로 소득이 아님')),
  'rs-p2-34': f => (f.retirementPension === 'pension' ? yes('퇴직연금 가입') : f.income === 'salary' && f.retirementPension === 'unknown' ? maybe('퇴직연금 가입 여부를 확인해 주세요') : no('퇴직연금 가입 아님')),
  // 영업 소득
  'rb-p2-1': f => (f.income === 'business' ? yes('영업 소득') : f.income === 'unknown' ? maybe('소득 유형을 확인해 주세요') : no('영업 소득이 아님')),
  'rb-p2-2': f => (f.income === 'business' ? yes('영업 소득') : no('영업 소득이 아님')),
  'rb-p2-3': f => (f.income === 'business' || f.income === 'freelancer' ? yes('사업·프리랜서 소득') : no('사업 소득이 아님')),
  'rb-p2-4': f => (f.income === 'business' ? yes('사업장이 있으면 필요', false) : no('영업 소득이 아님')),
  'rb-p2-5': f => (f.income === 'business' ? yes('영업 소득') : no('영업 소득이 아님')),
  'rb-p2-6': f => (f.income === 'business' ? yes('영업 소득') : no('영업 소득이 아님')),
  'rb-p2-7': f => (f.income === 'business' ? yes('복식부기 사업자면 필요', false) : no('영업 소득이 아님')),
  'rb-p2-8': f => (f.income === 'business' ? yes('영업 소득') : no('영업 소득이 아님')),
  'rb-p2-9': f => (f.income === 'business' ? yes('영업 소득', false) : no('영업 소득이 아님')),
  // 특수 사정
  'rs-p2-20': f => (f.specialSupport ? yes('수급·장애·한부모 소명') : no('해당 사정 없음')),
  'rs-p2-25': f => (f.hasPrivateDebt ? yes('개인 채권자 있음') : no('개인 채권자 없음')),
  'rs-p2-27': f => (f.hasSeizure ? yes('압류·강제집행 있음') : no('압류 없음')),
  'cor-2': f => (f.hasInvestmentLoss ? yes('주식·가상자산 손실 있음') : no('투자 손실 없음')),
  'cor-3': f => (f.divorced ? yes('이혼') : no('이혼 아님')),
};

export interface RuledItem<T> {
  item: T;
  applies: boolean | null;
  isRequired: boolean;
  why?: string;
}

/**
 * 규칙을 적용한다. overrides: 사건별 변호사 결정 ('include' = 이 사건에 필요, 'exclude' = 해당 없음)
 */
export function applyDocRules<T extends { id: string; isRequired: boolean }>(
  items: T[], facts: CaseDocFacts, overrides: Record<string, 'include' | 'exclude' | undefined> = {},
): RuledItem<T>[] {
  return items.map(item => {
    const o = overrides[item.id];
    const rule = DOC_RULES[item.id];
    const r = rule ? rule(facts) : { applies: true, required: item.isRequired, why: undefined as string | undefined };
    if (o === 'include') return { item, applies: true, isRequired: r.applies === true ? r.required : item.isRequired, why: '변호사가 이 사건에 넣음' };
    if (o === 'exclude') return { item, applies: false, isRequired: false, why: '변호사가 해당 없음으로 뺌' };
    return { item, applies: r.applies, isRequired: r.applies === true ? r.required : false, why: r.why };
  });
}

// ── 발급일 확인 (DP-3) ──
/** 발급일을 확인해야 하는 서류 (관공서·금융기관 발급분). 사무소 작성 서식·본인 보관 서류는 제외 */
export function needsIssueDate(item: { id: string; agency?: string; name?: string }): boolean {
  if (/사무소 작성|신청인 보유|신청인 작성|직접 작성/.test(item.agency || '')) return false;
  if (/도장|신분증|진술서|통장사본|소명표|소명서/.test(item.name || '')) return false;
  return true;
}

/** 발급일이 기준(개월)을 넘었는지. baseDate(접수 예정일, 없으면 오늘) 기준 */
export function isIssueStale(issuedOn: string | undefined, validMonths: number, baseDate?: string): boolean {
  if (!issuedOn) return false;
  const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  const limit = new Date(base);
  limit.setMonth(limit.getMonth() - Math.max(1, validMonths));
  return new Date(`${issuedOn}T00:00:00`) < limit;
}
