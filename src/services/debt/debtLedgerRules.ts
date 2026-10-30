// ============================================================
// 부채증명 장부 규칙 (DC-4·DC-6·DC-7·DC-8·DC-10) — 서버 연결 없는 순수 모듈 (시험 가능)
// 증명서 값 → 검산 → 채권자목록 칸 갱신(덮어쓰지 않기) → 계산. 정책은 경고 + 확인 + 기록, 막지 않는다.
// ============================================================

import type { RepaymentCreditor } from '../repayment/repaymentTypes';

export type CertStatus = 'pending' | 'requested' | 'received' | 'verified' | 'applied' | 'unavailable';
export type CertMethod = 'agency' | 'office' | 'client' | 'other';
export type CertSource = 'client' | 'credit_report' | 'agency' | 'bank' | 'office';
export type CertCategory = 'general' | 'tax_priority' | 'secured' | 'guarantee' | 'future_indemnity' | 'undetermined';
export type Tri = 'yes' | 'no' | 'unknown';
export type UnavailableReason = 'closed' | 'unknown_address' | 'individual' | 'refused' | 'assigned_pending' | 'other';
export type AltProof = 'loan_note' | 'judgment' | 'payment_order' | 'bank_history' | 'message' | 'client_statement' | 'other';

/** 증명서에서 옮겨 적는 값 (원 단위 정수, 날짜는 YYYY-MM-DD) */
export interface CertValues {
  baseDate?: string;
  issueDate?: string;
  principal?: number;
  interest?: number;
  lateInterest?: number;
  otherInterest?: number;
  advance?: number;
  legalCost?: number;
  fee?: number;
  otherCost?: number;
  total?: number;
  normalRate?: number;
  lateRate?: number;
  loanDate?: string;
  loanType?: string;
  initialAmount?: number;
  accountNo?: string;
  guarantor?: string;
  secured?: boolean;
  subrogated?: { yes: boolean; date?: string; by?: string };
  assigned?: { yes: boolean; to?: string; date?: string };
}

export interface DebtCertificate {
  id: string;
  seq: number;
  creditorName: string;
  branch?: string;
  source: CertSource;
  method: CertMethod;
  status: CertStatus;
  requestedOn?: string;
  expectedOn?: string;
  receivedOn?: string;
  unavailableReason?: UnavailableReason;
  altProof?: AltProof;
  docType: string;
  values: CertValues;
  category: CertCategory;
  attrs: { guarantee: Tri; futureIndemnity: Tri; secured: Tri };
  claimedPrincipal?: number;
  fileIds: string[];
  appliedCreditorId?: string;
  verifiedAt?: string;
  appliedAt?: string;
  note?: string;
  version: number;
}

export const STATUS_LABEL: Record<CertStatus, string> = {
  pending: '요청 전', requested: '요청함', received: '받음', verified: '값 확인', applied: '반영', unavailable: '발급 불가',
};
export const METHOD_LABEL: Record<CertMethod, string> = { agency: '대행사', office: '사무소 직접(팩스 등)', client: '의뢰인 직접', other: '기타' };
export const SOURCE_LABEL: Record<CertSource, string> = { client: '의뢰인 진술', credit_report: '신용정보 조회', agency: '대행사 추가', bank: '통장·카드 내역', office: '사무소 추가' };
export const CATEGORY_LABEL: Record<CertCategory, string> = {
  general: '일반', tax_priority: '조세·공과금(우선)', secured: '물적담보', guarantee: '보증채무', future_indemnity: '장래구상권', undetermined: '미확정',
};
export const UNAVAILABLE_LABEL: Record<UnavailableReason, string> = {
  closed: '폐업', unknown_address: '소재 불명', individual: '개인 채권자', refused: '발급 거부', assigned_pending: '양도 후 양수인 확인 중', other: '기타',
};
export const ALT_PROOF_LABEL: Record<AltProof, string> = {
  loan_note: '차용증', judgment: '판결문', payment_order: '지급명령', bank_history: '통장 내역', message: '문자·메신저', client_statement: '의뢰인 진술', other: '기타',
};
/** 산정근거 문서 종류 (로패스 14가지 + 대체 소명) */
export const DOC_TYPES = [
  '부채증명서', '부채증명원', '부채잔액증명서', '부채확인서', '잔고증명서', '대출증명서', '채무확인서', '채무승인서',
  '금융거래확인서', '자료송부서', '채무잔액확인서', '특수채권채무확인서', '대출잔액증명서',
] as const;

const ALT_DOC: Record<AltProof, string> = {
  loan_note: '차용증', judgment: '판결문', payment_order: '지급명령', bank_history: '통장 거래내역', message: '문자·메신저 내역', client_statement: '채무자 진술', other: '소명자료',
};

export const won = (n?: number) => (Number.isFinite(n) ? Math.round(n as number).toLocaleString('ko-KR') : '');

/** YYYY-MM-DD → YYYY. M. D. */
export function dotDate(ymd?: string): string {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : '';
}
/** YYYY-MM-DD → YYYY.MM.DD. (산정근거 칸 표기) */
const dotDate2 = (ymd?: string) => { const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}.${m[2]}.${m[3]}.` : ''; };

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 이자 칸 = 합계 − 원금 (DC-Q5). 합계가 없으면 이자 항목을 더한다 */
export function interestPart(v: CertValues): number {
  const p = v.principal || 0;
  if (Number.isFinite(v.total) && (v.total as number) > 0) return Math.max(0, (v.total as number) - p);
  return (v.interest || 0) + (v.lateInterest || 0) + (v.otherInterest || 0) + (v.advance || 0) + (v.legalCost || 0) + (v.fee || 0) + (v.otherCost || 0);
}

/** 검산: 원금 + 이자·비용 항목 = 총채무액 (1원 이상 다르면 경고) */
export function checkSum(v: CertValues): { ok: boolean; computed: number; diff: number } | null {
  if (!Number.isFinite(v.total)) return null;
  const computed = (v.principal || 0) + (v.interest || 0) + (v.lateInterest || 0) + (v.otherInterest || 0) + (v.advance || 0) + (v.legalCost || 0) + (v.fee || 0) + (v.otherCost || 0);
  const diff = (v.total as number) - computed;
  return { ok: Math.abs(diff) < 1, computed, diff };
}

/** 진술액·증명액 차이 경고 (DC-Q7: 20% 또는 100만 원 이상) */
export function bigDifference(claimed?: number, certified?: number): boolean {
  if (!Number.isFinite(claimed) || !Number.isFinite(certified) || !claimed) return false;
  const d = Math.abs((certified as number) - (claimed as number));
  return d >= 1_000_000 || d / (claimed as number) >= 0.2;
}

/** 확인 필요 표시 */
export function reviewFlags(c: Pick<DebtCertificate, 'status' | 'values' | 'claimedPrincipal' | 'category'>): string[] {
  const out: string[] = [];
  if (c.status === 'received') out.push('검수 필요');
  if ((c.status === 'received' || c.status === 'verified') && !c.values.baseDate) out.push('기준일 없음');
  const s = checkSum(c.values);
  if (s && !s.ok) out.push('합계 확인');
  if ((c.status === 'verified' || c.status === 'applied') && !c.values.loanDate && !c.values.loanType && c.category !== 'tax_priority') out.push('발생원인 확인 필요');
  if (bigDifference(c.claimedPrincipal, c.values.principal)) out.push('진술액과 차이 큼');
  if (c.values.assigned?.yes && !c.values.assigned.to) out.push('양수인 확인 필요');
  if (c.values.subrogated?.yes && !c.values.subrogated.by) out.push('대위변제자 확인 필요');
  return out;
}

/** 산정근거: "○○ 참조 (산정기준일 : YYYY.MM.DD.)" — 발급 불가면 대체 소명 문서 이름 */
export function basisText(c: Pick<DebtCertificate, 'status' | 'docType' | 'altProof' | 'values'>): string {
  const doc = c.status === 'unavailable' ? ALT_DOC[c.altProof || 'other'] : (c.docType || '부채증명서');
  const d = dotDate2(c.values.baseDate);
  return d ? `${doc} 참조 (산정기준일 : ${d})` : `${doc} 참조`;
}

/** 채권자목록 산정근거 칸 기본 (증명서에서 반영한 기준일이 있으면 함께) */
export function basisWithDate(cr: Pick<RepaymentCreditor, 'baseDate'>): string {
  const d = dotDate2(cr.baseDate);
  return d ? `부채증명서 참조 (산정기준일 : ${d})` : '부채증명서 참조';
}

/** 채권의 원인 표준 문장 */
export function claimCauseText(c: Pick<DebtCertificate, 'category' | 'values'>): string {
  const v = c.values;
  if (c.category === 'tax_priority') return v.loanType ? `${v.loanType} 체납` : '조세·공과금 체납';
  if (c.category === 'future_indemnity') return '보증채무 이행에 따른 장래 구상금';
  if (v.subrogated?.yes) return `대위변제에 따른 구상금${v.subrogated.date ? ` (${dotDate(v.subrogated.date)} 대위변제)` : ''}`;
  if (/카드/.test(v.loanType || '')) return `${v.loanDate ? `${dotDate(v.loanDate)}부터 ` : ''}신용카드 이용대금`;
  if (v.loanDate && v.initialAmount) return `${dotDate(v.loanDate)}자 ${v.loanType || '대출거래약정'}에 따른 최초 대출금 ${won(v.initialAmount)}원`;
  if (v.loanDate) return `${dotDate(v.loanDate)}자 ${v.loanType || '대출거래약정'}에 따른 대출금`;
  return v.loanType || '';
}

/** 채권의 내용 표준 문장 (DC-Q11: 연체이율이 있으면 '연체이율', 없으면 '약정이율') */
export function claimContentText(c: Pick<DebtCertificate, 'values'>): string {
  const v = c.values;
  const p = v.principal || 0;
  const total = Number.isFinite(v.total) && (v.total as number) > 0 ? (v.total as number) : p + interestPart(v);
  if (!p && !total) return '';
  const from = v.baseDate ? `${dotDate(nextDay(v.baseDate))}부터` : '산정기준일 다음 날부터';
  const rateWord = v.lateRate ? `연 ${v.lateRate}%의 연체이율` : v.normalRate ? `연 ${v.normalRate}%의 약정이율` : '약정이율';
  if (total <= p) return `원금 ${won(p)}원 및 이에 대한 ${from} 완제일까지 ${rateWord}에 의한 금원`;
  return `${won(total)}원 및 이중 원금 ${won(p)}원에 대한 ${from} 완제일까지 ${rateWord}에 의한 금원`;
}

export interface ApplyChange { creditorId: string; field: string; before: unknown; after: unknown }

/**
 * 확정 값으로 채권자목록을 갱신한다 (DC-6, 덮어쓰지 않기).
 * - 연결된 채권자(appliedCreditorId 또는 certificateId)가 있으면 금액·기준일·산정근거·채권의 원인·내용 칸만 바꾼다.
 *   부속서류·다툼·주소·메모·보증 정보는 그대로 둔다. 채권의 내용을 사람이 고쳤으면(claimContentManual) 그대로 둔다.
 * - 없으면 새 채권자를 뒤에 붙인다(원금 기본값 없음).
 */
export function applyCertificateToCreditors(
  creditors: RepaymentCreditor[], cert: DebtCertificate, newId: () => string,
): { creditors: RepaymentCreditor[]; creditorId: string; changes: ApplyChange[] } {
  const v = cert.values;
  const unavailable = cert.status === 'unavailable';
  const patch: Partial<RepaymentCreditor> = {
    principal: Math.max(0, Math.round(v.principal || 0)),
    interest: Math.max(0, Math.round(interestPart(v))),
    baseDate: v.baseDate,
    principalCalculationBasis: basisText(cert),
    interestCalculationBasis: basisText(cert),
    claimCause: claimCauseText(cert) || undefined,
    certificateId: cert.id,
    isEstimated: unavailable && !v.principal ? true : false,
    isPriority: cert.category === 'tax_priority',
    isSecured: cert.category === 'secured' || cert.attrs.secured === 'yes' || !!v.secured,
    isUnconfirmed: cert.category === 'undetermined',
    interestRate: v.lateRate || v.normalRate || undefined,
    borrowedDate: v.loanDate || undefined,
    initialPrincipal: v.initialAmount || undefined,
  };
  const content = claimContentText(cert);
  const idx = creditors.findIndex(cr => cr.id === cert.appliedCreditorId || (cr.certificateId && cr.certificateId === cert.id));
  const changes: ApplyChange[] = [];
  if (idx >= 0) {
    const cur = creditors[idx];
    const next: RepaymentCreditor = { ...cur };
    (Object.keys(patch) as Array<keyof RepaymentCreditor>).forEach(k => {
      const after = patch[k];
      if (after === undefined && k !== 'interestRate') return;
      if (cur[k] !== after) { changes.push({ creditorId: cur.id, field: String(k), before: cur[k], after }); (next as any)[k] = after; }
    });
    if (!cur.claimContentManual && content && cur.claimContent !== content) {
      changes.push({ creditorId: cur.id, field: 'claimContent', before: cur.claimContent, after: content });
      next.claimContent = content;
    }
    const list = [...creditors];
    list[idx] = next;
    return { creditors: list, creditorId: cur.id, changes };
  }
  const id = newId();
  const created: RepaymentCreditor = {
    id, creditorNumber: creditors.length + 1, name: cert.creditorName, allocationRatio: 0, monthlyRepayment: 0, totalRepayment: 0, repaymentRate: 0,
    ...(patch as any), claimContent: content || undefined,
  };
  changes.push({ creditorId: id, field: '(새 채권자)', before: null, after: cert.creditorName });
  return { creditors: [...creditors, created], creditorId: id, changes };
}

/** 3단계 c2 완료 판정 (DC-10): 빈 목록이면 미완료, 모든 줄이 '반영' 또는 '발급 불가 + 대체 소명' */
export function ledgerComplete(list: Pick<DebtCertificate, 'status' | 'altProof'>[]): boolean {
  return list.length > 0 && list.every(c => c.status === 'applied' || (c.status === 'unavailable' && !!c.altProof));
}

export function ledgerSummary(list: Pick<DebtCertificate, 'status' | 'expectedOn'>[], today: string) {
  const n = (s: CertStatus) => list.filter(c => c.status === s).length;
  return {
    total: list.length,
    requested: n('requested'),
    received: list.filter(c => ['received', 'verified', 'applied'].includes(c.status)).length,
    verified: list.filter(c => ['verified', 'applied'].includes(c.status)).length,
    applied: n('applied'),
    unavailable: n('unavailable'),
    late: list.filter(c => c.status === 'requested' && c.expectedOn && c.expectedOn < today).length,
  };
}

/** 채권자목록 머리 산정기준일 = 채권자별 기준일 중 가장 늦은 날 (DC-Q4) */
export function headerBaseDate(creditors: Pick<RepaymentCreditor, 'baseDate'>[]): string | undefined {
  const ds = creditors.map(c => c.baseDate).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return ds.length ? ds[ds.length - 1] : undefined;
}

/** 기준일 간격 (가장 이른 날 ~ 가장 늦은 날, 일) */
export function baseDateSpread(creditors: Pick<RepaymentCreditor, 'baseDate'>[]): number | null {
  const ds = creditors.map(c => c.baseDate).filter((d): d is string => !!d).sort();
  if (ds.length < 2) return null;
  return Math.round((new Date(`${ds[ds.length - 1]}T00:00:00`).getTime() - new Date(`${ds[0]}T00:00:00`).getTime()) / 86400000);
}

/** 증명서 없이 넣은(추정) 채권자 수 — 서식 출력·제안서 발송 전 경고 (DC-Q6) */
export function estimatedCreditorCount(creditors: Pick<RepaymentCreditor, 'isEstimated' | 'certificateId'>[]): number {
  return creditors.filter(c => c.isEstimated || !c.certificateId).length;
}

/** 같은 채권 이중 등록 의심 (원채권자와 양수인·대위변제자가 둘 다 있는 경우) */
export function duplicateWarnings(list: Pick<DebtCertificate, 'creditorName' | 'values' | 'status'>[]): string[] {
  const names = new Set(list.filter(c => c.status !== 'unavailable').map(c => c.creditorName.replace(/\s/g, '')));
  const out: string[] = [];
  list.forEach(c => {
    const to = c.values.assigned?.yes ? c.values.assigned.to : undefined;
    if (to && names.has(to.replace(/\s/g, ''))) out.push(`${c.creditorName} 채권이 ${to}에 양도됐는데 두 곳이 모두 장부에 있어요. 한 번만 잡히게 정리해 주세요.`);
    const by = c.values.subrogated?.yes ? c.values.subrogated.by : undefined;
    if (by && names.has(by.replace(/\s/g, ''))) out.push(`${c.creditorName} 채권을 ${by}가 대위변제했는데 두 곳이 모두 원금으로 잡혀 있을 수 있어요.`);
  });
  return out;
}
