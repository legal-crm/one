// ============================================================
// 의뢰인 정리 자료 v2 (I-4): '내 상황 체크하기'에서 답한 그대로 (원 단위, 계산값 없음, 버전 2)
//  * consult_requests.intake 에 저장 → 변호사는 동의 뒤 consult_requests_for_lawyers 뷰로 본다
//  * 이름·전화번호는 넣지 않는다 (상담 요청의 다른 칸이 동의·계약 규칙으로 따로 관리)
//  * 고칠 때 바뀐 칸 이름(changedKeys)을 남겨 변호사 화면에 '바뀜'으로 표시 (I-5)
// ============================================================
import type { RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import type { IntakeExtraFacts } from '../../components/client/intake/IntakeReviewModal';

export interface ClientIntakeV2 {
  version: 2;
  answeredAt: string;
  units: 'won';
  answers: Record<string, string | number | boolean | string[] | null>;
  extra?: Partial<IntakeExtraFacts>;
  /** 답하지 않았거나 '모름'인 칸 */
  needCheck: string[];
  /** 지난번과 달라진 칸 (처음 저장이면 없음) */
  changedKeys?: string[];
}

type FieldDef = { key: string; label: string; group: string; kind?: 'won' | 'count' | 'text' | 'list' | 'bool'; map?: Record<string, string> };

export const INTAKE_FIELDS: FieldDef[] = [
  { group: '가족', key: 'familySize', label: '가구원 수', kind: 'count' },
  { group: '가족', key: 'minorChildren', label: '미성년 자녀', kind: 'count' },
  { group: '가족', key: 'maritalStatus', label: '혼인 상태', map: { single: '미혼', married: '기혼', divorced: '이혼', widowed: '사별' } },
  { group: '가족', key: 'elderlyParentCount', label: '부양하는 부모', kind: 'count' },
  { group: '가족', key: 'childSupportPaid', label: '보내는 양육비', kind: 'won' },
  { group: '가족', key: 'childSupportReceived', label: '받는 양육비', kind: 'won' },
  { group: '소득·일', key: 'employmentType', label: '일하는 형태', map: { salary: '급여', business: '자영업', freelancer: '프리랜서', both: '급여+사업', daily: '일용직', none: '소득 없음', basic_recipient: '기초생활 수급' } },
  { group: '소득·일', key: 'monthlyIncome', label: '월 실수령액', kind: 'won' },
  { group: '소득·일', key: 'spouseIncome', label: '배우자 월 소득', kind: 'won' },
  { group: '소득·일', key: 'workLocation', label: '일하는 곳(지역)', kind: 'text' },
  { group: '사는 곳', key: 'address', label: '사는 지역', kind: 'text' },
  { group: '사는 곳', key: 'housingType', label: '주거 형태', map: { rent: '월세', jeonse: '전세', owned: '자가', free: '무상 거주', owned_mortgage: '자가(담보 대출)' } },
  { group: '사는 곳', key: 'housingContractHolder', label: '계약 명의', map: { self: '본인', spouse: '배우자', others: '다른 가족' } },
  { group: '사는 곳', key: 'deposit', label: '보증금', kind: 'won' },
  { group: '사는 곳', key: 'rentCost', label: '월세', kind: 'won' },
  { group: '사는 곳', key: 'depositLoan', label: '보증금 대출', kind: 'won' },
  { group: '생활비', key: 'medicalCost', label: '월 의료비', kind: 'won' },
  { group: '생활비', key: 'educationCost', label: '월 교육비', kind: 'won' },
  { group: '재산', key: 'myAssets', label: '본인 재산 합계', kind: 'won' },
  { group: '재산', key: 'spouseAssets', label: '배우자 재산', kind: 'won' },
  { group: '재산', key: 'retirementPensionType', label: '퇴직연금', map: { pension: '퇴직연금 가입', none: '가입 안 함(퇴직금)', unknown: '모름' } },
  { group: '재산', key: 'retirementPay', label: '예상 퇴직금', kind: 'won' },
  { group: '채무', key: 'totalDebt', label: '총 채무', kind: 'won' },
  { group: '채무', key: 'priorityDebt', label: '세금·4대보험 체납', kind: 'won' },
  { group: '채무', key: 'creditCardDebt', label: '카드 채무', kind: 'won' },
  { group: '채무', key: 'speculativeLoss', label: '투자 손실(1년 안)', kind: 'won' },
  { group: '채무', key: 'gamblingLoss', label: '도박 채무(1년 안)', kind: 'won' },
  { group: '채무', key: 'riskFactor', label: '빚이 늘어난 주된 이유', map: { none: '생활비 등', recent_loan: '최근 대출', investment: '투자', gambling: '도박' } },
  { group: '독촉·법적 조치', key: 'legalActions', label: '받은 조치', kind: 'list', map: { collection_call: '독촉 전화·문자', court_order: '지급명령·소장', seizure: '급여·계좌 압류', property_seizure: '부동산 가압류', credit_drop: '신용 하락 통보', none: '없음' } },
  { group: '사정', key: 'specialCondition', label: '해당하는 사정', map: { none: '없음', basic_recipient: '기초생활 수급', severe_disability: '중증 장애', elderly: '65세 이상', single_parent: '한부모', rent_fraud: '전세사기 피해' } },
  { group: '사정', key: 'age', label: '나이', kind: 'count' },
];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 챗봇 입력(원 단위)에서 v2 자료를 만든다. 0원·빈 값은 그대로 두고 '확인 필요'는 답이 없는 칸만 */
export function buildIntakeV2(input: Partial<RehabUserInput> & Record<string, any>, extra?: Partial<IntakeExtraFacts>, previous?: ClientIntakeV2 | null): ClientIntakeV2 {
  const answers: ClientIntakeV2['answers'] = {};
  for (const f of INTAKE_FIELDS) {
    const raw = input[f.key];
    if (raw === undefined || raw === null || raw === '') { answers[f.key] = null; continue; }
    if (f.kind === 'won' || f.kind === 'count') answers[f.key] = num(Number(raw));
    else if (f.kind === 'list') answers[f.key] = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    else answers[f.key] = typeof raw === 'boolean' ? raw : String(raw);
  }
  // 기혼이 아니면 배우자 칸은 '해당 없음' (확인 필요로 세지 않음)
  const married = answers.maritalStatus === 'married';
  const needCheck = INTAKE_FIELDS
    .filter(f => answers[f.key] === null)
    .filter(f => married || (f.key !== 'spouseIncome' && f.key !== 'spouseAssets'))
    .filter(f => !['rentCost', 'deposit', 'depositLoan', 'housingContractHolder'].includes(f.key) || ['rent', 'jeonse'].includes(String(answers.housingType)))
    .filter(f => !['childSupportPaid', 'childSupportReceived', 'speculativeLoss', 'gamblingLoss', 'creditCardDebt', 'elderlyParentCount', 'medicalCost', 'educationCost', 'age'].includes(f.key))
    .map(f => f.label);
  if (answers.retirementPensionType === 'unknown') needCheck.push('퇴직연금 가입 여부');
  const next: ClientIntakeV2 = { version: 2, answeredAt: new Date().toISOString(), units: 'won', answers, extra, needCheck };
  if (previous) {
    const changed = Object.keys(answers).filter(k => JSON.stringify(answers[k]) !== JSON.stringify(previous.answers?.[k]));
    const extraChanged = JSON.stringify(extra || {}) !== JSON.stringify(previous.extra || {}) ? ['extra'] : [];
    next.changedKeys = [...changed, ...extraChanged];
  }
  return next;
}

export function formatIntakeValue(f: FieldDef, v: ClientIntakeV2['answers'][string]): string {
  if (v === null || v === undefined) return '';
  if (f.kind === 'won') return `${Math.round(Number(v)).toLocaleString('ko-KR')}원`;
  if (f.kind === 'count') return `${v}${f.key === 'age' ? '세' : f.key === 'familySize' ? '인' : '명'}`;
  if (f.kind === 'list') return (v as string[]).map(x => f.map?.[x] || x).join(', ');
  return f.map?.[String(v)] || String(v);
}

/** '내 사건'에서 고친 채무 정보(만 원 단위 financialProfile) → v2 입력 칸 (I-5: 고치면 같은 요청 갱신) */
export function intakeInputFromProfile(fp: any): Record<string, any> {
  const w = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Math.round(Number(v) * 10000));
  const marital: Record<string, string> = { SINGLE: 'single', MARRIED: 'married', DIVORCED: 'divorced', WIDOWED: 'widowed' };
  return {
    familySize: fp?.dependents != null ? Number(fp.dependents) + 1 : undefined,
    minorChildren: fp?.minorChildren,
    maritalStatus: marital[String(fp?.maritalStatus || '').toUpperCase()] || fp?.maritalStatus,
    employmentType: fp?.employmentType,
    monthlyIncome: w(fp?.income ?? fp?.monthlyIncome),
    spouseIncome: w(fp?.spouseIncome),
    workLocation: fp?.workLocation,
    address: fp?.residenceRegion || fp?.address,
    housingType: fp?.housingType,
    housingContractHolder: fp?.housingContractHolder,
    deposit: w(fp?.rentalDeposit),
    rentCost: w(fp?.rentCost),
    depositLoan: w(fp?.depositLoan),
    myAssets: w(fp?.myAssets ?? fp?.assetsTotal),
    spouseAssets: w(fp?.spouseAsset),
    retirementPensionType: fp?.retirementPensionType,
    retirementPay: w(fp?.retirementPay),
    totalDebt: w(fp?.debtTotal),
    priorityDebt: w(fp?.priorityDebt),
    speculativeLoss: w(fp?.speculativeLoss),
    gamblingLoss: w(fp?.gamblingLoss),
    legalActions: fp?.legalActions,
    specialCondition: fp?.specialCondition,
    age: fp?.age,
  };
}
