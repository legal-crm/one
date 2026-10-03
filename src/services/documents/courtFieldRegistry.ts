/**
 * courtFieldRegistry.ts
 * 법원 서식 편집기의 필드 키 목록 (Field Registry)
 *
 * 하나의 목록을 세 기능이 함께 사용한다.
 *  1) 입력 칸 ↔ A4 서식 위치 매핑 (data-field 속성 키)
 *  2) 미입력·형식 오류 검증 (탭/섹션별 뱃지)
 *  3) 키보드 이동 순서 (F2 다음 미입력 항목)
 *
 * key 는 CourtFilingMasterData 의 경로('debtor.name')와 같다.
 */
import type { CourtFilingMasterData } from './courtFilingEngine';

/** 입력 사이드바 아코디언 섹션 ID (CourtFilingInputSidebar 의 openSection 값과 동일) */
export type CourtSectionId =
  | 'basic' | 'statement' | 'creditor' | 'annex' | 'assets'
  | 'income' | 'plan' | 'lawyer' | 'evidence';

/** 서식 탭 ID (CourtDocSuiteViewerModal 의 DocTabId 와 동일한 문자열) */
export type CourtDocTabKey =
  | 'PETITION_COVER' | 'PETITION_BODY' | 'STATEMENT' | 'CREDITOR_LIST' | 'ANNEX_DOCS'
  | 'ASSET_LIST' | 'INCOME_EXPENSE' | 'REPAYMENT_PLAN' | 'REPAYMENT_SCHEDULE'
  | 'POWER_OF_ATTORNEY' | 'SERVICE_REPORT' | 'EVIDENCE_LIST' | 'PROHIBITION_ORDER' | 'STAY_ORDER';

/** 섹션 순서 — Alt+숫자 단축키와 Enter 이동(섹션 끝 → 다음 섹션)에 사용 */
export const COURT_SECTION_ORDER: CourtSectionId[] = [
  'basic', 'statement', 'creditor', 'annex', 'assets', 'income', 'plan', 'lawyer', 'evidence',
];

export const COURT_SECTION_LABELS: Record<CourtSectionId, string> = {
  basic: '기본 정보',
  statement: '진술서',
  creditor: '채권자',
  annex: '부속서류',
  assets: '재산',
  income: '수입 및 지출',
  plan: '변제계획안',
  lawyer: '대리인',
  evidence: '자료 제출',
};

export interface CourtFieldDef {
  key: string;
  label: string;
  section: CourtSectionId;
  /** 이 값이 표시되는 서식 탭 (첫 번째 탭이 대표 탭) */
  docTabs: CourtDocTabKey[];
  required?: boolean;
  /** 값이 있을 때만 실행. 문제가 있으면 안내 문구를 반환 */
  validate?: (value: unknown, data: CourtFilingMasterData) => string | null;
}

export interface CourtFieldIssue {
  key: string;
  label: string;
  section: CourtSectionId;
  docTabs: CourtDocTabKey[];
  kind: 'missing' | 'invalid';
  message: string;
}

// ── 형식 검증 ──
const RRN_RE = /^\d{6}-?[0-9*]{7}$/;
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?$/;

const vRrn = (v: unknown) => (RRN_RE.test(String(v).trim()) ? null : '주민등록번호 형식(000000-0000000)을 확인하세요.');
const vPhone = (v: unknown) => (PHONE_RE.test(String(v).replace(/\s/g, '')) ? null : '전화번호 형식(010-0000-0000)을 확인하세요.');
const vEmail = (v: unknown) => (EMAIL_RE.test(String(v).trim()) ? null : '이메일 형식을 확인하세요.');
const vDate = (v: unknown) => (DATE_RE.test(String(v).trim()) ? null : '날짜 형식(2026. 10. 3.)을 확인하세요.');

/**
 * 등록 순서 = 키보드 이동 순서.
 * 사이드바에 입력 칸이 있는 필드만 등록한다 (입력 칸이 없으면 이동·포커스가 불가능).
 */
export const COURT_FIELD_REGISTRY: CourtFieldDef[] = [
  // ── 기본 정보 ──
  { key: 'debtor.name', label: '신청인 성명', section: 'basic', required: true,
    docTabs: ['PETITION_BODY', 'PETITION_COVER', 'POWER_OF_ATTORNEY', 'PROHIBITION_ORDER', 'REPAYMENT_SCHEDULE', 'SERVICE_REPORT', 'EVIDENCE_LIST'] },
  { key: 'debtor.residentNumber', label: '주민등록번호', section: 'basic', required: true, validate: vRrn,
    docTabs: ['PETITION_BODY', 'POWER_OF_ATTORNEY', 'PROHIBITION_ORDER', 'SERVICE_REPORT'] },
  { key: 'debtor.residentAddress', label: '주민등록상 주소', section: 'basic', required: true, docTabs: ['PETITION_BODY'] },
  { key: 'debtor.currentAddress', label: '현거주지 주소', section: 'basic', required: true,
    docTabs: ['PETITION_BODY', 'POWER_OF_ATTORNEY', 'PROHIBITION_ORDER', 'STAY_ORDER'] },
  { key: 'debtor.serviceAddress', label: '송달 장소', section: 'basic', required: true, docTabs: ['PETITION_BODY'] },
  { key: 'debtor.serviceRecipient', label: '송달 영수인', section: 'basic', docTabs: ['PETITION_BODY'] },
  { key: 'debtor.phone', label: '휴대전화 번호', section: 'basic', required: true, validate: vPhone,
    docTabs: ['PETITION_BODY', 'PROHIBITION_ORDER', 'STAY_ORDER', 'SERVICE_REPORT'] },
  { key: 'debtor.homePhone', label: '전화번호(집·직장)', section: 'basic', validate: vPhone, docTabs: ['PETITION_BODY'] },
  { key: 'court.caseNumber', label: '사건번호', section: 'basic',
    docTabs: ['PETITION_COVER', 'REPAYMENT_SCHEDULE', 'SERVICE_REPORT', 'EVIDENCE_LIST'] },
  { key: 'court.applicationDate', label: '신청일', section: 'basic', required: true, validate: vDate,
    docTabs: ['PETITION_BODY', 'CREDITOR_LIST'] },

  // ── 진술서 ──
  { key: 'statement.detailedReasonEssay', label: '채무 부담 경위', section: 'statement', required: true, docTabs: ['STATEMENT'] },

  // ── 수입 및 지출 ──
  { key: 'repaymentSummary.monthlyNetIncome', label: '월 평균 세후 소득', section: 'income', required: true,
    validate: (v) => (Number(v) > 0 ? null : '월 소득은 0원보다 커야 합니다.'), docTabs: ['INCOME_EXPENSE'] },
  { key: 'debtor.jobTitle', label: '직위·직업', section: 'income', docTabs: ['INCOME_EXPENSE'] },
  { key: 'debtor.tenureYearsMonths', label: '근무 기간', section: 'income', docTabs: ['INCOME_EXPENSE'] },

  // ── 변제계획안 ──
  { key: 'repaymentSummary.repaymentMonths', label: '변제 기간(개월)', section: 'plan', required: true,
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return '변제 기간을 입력하세요.';
      if (n > 60) return '변제 기간은 최장 60개월입니다.';
      return null;
    },
    docTabs: ['REPAYMENT_PLAN', 'PETITION_BODY'] },
  { key: 'court.firstRepaymentDate', label: '제1회 변제일', section: 'plan', required: true, validate: vDate,
    docTabs: ['REPAYMENT_PLAN', 'PETITION_BODY', 'REPAYMENT_SCHEDULE'] },
  { key: 'debtor.refundBank', label: '적립금 반환 은행', section: 'plan', required: true, docTabs: ['PETITION_BODY'] },
  { key: 'debtor.refundAccount', label: '적립금 반환 계좌번호', section: 'plan', required: true, docTabs: ['PETITION_BODY'] },

  // ── 대리인 ──
  { key: 'lawyer.firmName', label: '대리인 법률사무소', section: 'lawyer', required: true,
    docTabs: ['POWER_OF_ATTORNEY', 'PETITION_COVER', 'SERVICE_REPORT', 'EVIDENCE_LIST'] },
  { key: 'lawyer.lawyerName', label: '담당 변호사 성명', section: 'lawyer', required: true,
    docTabs: ['POWER_OF_ATTORNEY', 'PETITION_BODY', 'PETITION_COVER', 'SERVICE_REPORT', 'EVIDENCE_LIST'] },
  { key: 'lawyer.address', label: '사무실 주소', section: 'lawyer', required: true, docTabs: ['PETITION_BODY'] },
  { key: 'lawyer.phone', label: '사무실 전화', section: 'lawyer', required: true, validate: vPhone, docTabs: ['PETITION_BODY'] },
  { key: 'lawyer.fax', label: 'FAX 번호', section: 'lawyer', validate: vPhone, docTabs: ['PETITION_BODY'] },
  { key: 'lawyer.email', label: '이메일', section: 'lawyer', validate: vEmail, docTabs: ['PETITION_BODY'] },
];

const REGISTRY_MAP = new Map(COURT_FIELD_REGISTRY.map((f) => [f.key, f]));

/**
 * 서식 컴포넌트에서 쓰는 별칭 키 → 대표 키.
 * (일부 서식은 court.lawyerName 처럼 다른 경로로 같은 값을 출력한다)
 */
export const COURT_FIELD_ALIASES: Record<string, string> = {
  'court.lawyerName': 'lawyer.lawyerName',
  'court.lawyerFirm': 'lawyer.firmName',
  'debtor.address': 'debtor.currentAddress',
};

export function resolveFieldKey(key: string): string {
  return COURT_FIELD_ALIASES[key] ?? key;
}

export function getFieldDef(key: string): CourtFieldDef | undefined {
  return REGISTRY_MAP.get(resolveFieldKey(key));
}

/** 'debtor.name' 경로로 값 읽기 */
export function getFieldValue(data: CourtFilingMasterData, key: string): unknown {
  return resolveFieldKey(key).split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, data);
}

/** 'debtor.name' 경로로 값 쓰기 (2단계 경로까지, 불변 업데이트) */
export function setFieldValue(data: CourtFilingMasterData, key: string, value: unknown): CourtFilingMasterData {
  const [group, field] = resolveFieldKey(key).split('.');
  if (!field) return { ...data, [group]: value } as CourtFilingMasterData;
  const prevGroup = ((data as unknown as Record<string, unknown>)[group] ?? {}) as Record<string, unknown>;
  return { ...data, [group]: { ...prevGroup, [field]: value } } as CourtFilingMasterData;
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  return false;
}

/** 등록 순서대로 미입력·형식 오류 목록 계산 */
export function computeFieldIssues(data: CourtFilingMasterData): CourtFieldIssue[] {
  const issues: CourtFieldIssue[] = [];
  for (const def of COURT_FIELD_REGISTRY) {
    const value = getFieldValue(data, def.key);
    const base = { key: def.key, label: def.label, section: def.section, docTabs: def.docTabs };
    if (isEmptyValue(value)) {
      if (def.required) issues.push({ ...base, kind: 'missing', message: `${def.label}을(를) 입력하세요.` });
      continue;
    }
    const msg = def.validate?.(value, data);
    if (msg) issues.push({ ...base, kind: 'invalid', message: msg });
  }
  return issues;
}

export interface CourtIssueSummary {
  issues: CourtFieldIssue[];
  byKey: Map<string, CourtFieldIssue>;
  countByTab: Partial<Record<CourtDocTabKey, { missing: number; invalid: number }>>;
  countBySection: Partial<Record<CourtSectionId, number>>;
}

export function summarizeFieldIssues(issues: CourtFieldIssue[]): CourtIssueSummary {
  const byKey = new Map<string, CourtFieldIssue>();
  const countByTab: CourtIssueSummary['countByTab'] = {};
  const countBySection: CourtIssueSummary['countBySection'] = {};
  for (const issue of issues) {
    byKey.set(issue.key, issue);
    countBySection[issue.section] = (countBySection[issue.section] ?? 0) + 1;
    for (const tab of issue.docTabs) {
      const c = countByTab[tab] ?? { missing: 0, invalid: 0 };
      c[issue.kind] += 1;
      countByTab[tab] = c;
    }
  }
  return { issues, byKey, countByTab, countBySection };
}
