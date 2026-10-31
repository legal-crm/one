// ============================================================
// 개인회생채권자목록 부속서류 1~4 줄 만들기 (DC-14)
// 번호 뜻: 1 별제권부 · 2 다툼(예상 포함) · 3 전부명령 · 4 기타(신청인이 보증인인 경우 등) — 법원 양식·접수본·경쟁 3사 동일
// 값이 없는 칸은 빈칸으로 둔다 (지어낸 기본값 없음)
// ============================================================
import type { RepaymentCreditor } from '../repayment/repaymentTypes';
import { isAssignmentCreditor, isDisputedCreditor, isGuarantyCreditor } from './courtFilingEngine';
import { normalizeAnnexType } from '../repayment/repaymentTypes';

export const SECURED_RIGHT_LABEL: Record<NonNullable<RepaymentCreditor['securedRightType']>, string> = {
  mortgage_max: '근저당권',
  mortgage: '저당권',
  pledge: '질권',
  transfer_security: '양도담보',
  jeonse: '전세권',
  other: '기타',
};

const COLLATERAL_LABEL: Record<string, string> = { REAL_ESTATE: '부동산', VEHICLE: '자동차', LEASE_DEPOSIT: '임차보증금', OTHER: '기타' };

const num = (c: RepaymentCreditor) => String(c.creditorNumber ?? '');
const nameOf = (c: RepaymentCreditor) => String(c.name || (c as any).creditorName || '');
const principalOf = (c: RepaymentCreditor) => Number((c as any).principal ?? (c as any).currentPrincipal ?? 0) || 0;

export interface AnnexRows {
  secured: Array<{ no: string; name: string; right: string; rank: string; collateral: string; maxAmount?: number; prior?: number; appraisal?: number; shortage?: number; expectedRecovery?: number }>;
  disputed: Array<{ no: string; name: string; creditorClaim?: number; debtorClaim?: number; reason: string; lawsuits: string }>;
  assignment: Array<{ no: string; name: string; courtCase: string; decidedOn: string; servedOn: string; garnishee: string; amount?: number }>;
  other: Array<{ no: string; name: string; principalDebtor: string; amount?: number; date: string; detail: string }>;
}

export function annexRows(creditors: RepaymentCreditor[]): AnnexRows {
  const out: AnnexRows = { secured: [], disputed: [], assignment: [], other: [] };
  for (const c of creditors) {
    if (c.isSecured || normalizeAnnexType(c.annexDocType) === 'ANNEX_1_SECURED') {
      const shortage = typeof c.unsecuredExpectedShortage === 'number' ? c.unsecuredExpectedShortage : undefined;
      out.secured.push({
        no: num(c), name: nameOf(c),
        right: c.securedRightType ? SECURED_RIGHT_LABEL[c.securedRightType] : '',
        rank: c.securedRank || '',
        collateral: [c.securedCollateralType ? COLLATERAL_LABEL[c.securedCollateralType] : '', c.collateralDescription || ''].filter(Boolean).join(' · '),
        maxAmount: c.securedMaxAmount || undefined,
        prior: c.priorSecuredAmount || undefined,
        appraisal: c.collateralAppraisalValue || undefined,
        shortage,
        expectedRecovery: typeof c.securedValue === 'number' && c.securedValue > 0 ? c.securedValue : shortage !== undefined ? Math.max(0, principalOf(c) - shortage) : undefined,
      });
    }
    if (isDisputedCreditor(c)) {
      const lawsuits = (c.disputeLawsuits || [])
        .filter(l => l.court || l.caseNumber || l.status)
        .map(l => `${l.instance}심 ${[l.court, l.caseNumber, l.status].filter(Boolean).join(' ')}`)
        .join(' / ');
      out.disputed.push({ no: num(c), name: nameOf(c), creditorClaim: c.disputeCreditorClaim || undefined, debtorClaim: c.disputeDebtorClaim || undefined, reason: c.disputeReason || c.annexDetail || '', lawsuits });
    }
    if (isAssignmentCreditor(c)) {
      out.assignment.push({ no: num(c), name: nameOf(c), courtCase: c.garnishmentCourtCase || '', decidedOn: c.garnishmentDecidedOn || '', servedOn: c.garnishmentServedOn || '', garnishee: c.garnisheeName || '', amount: c.garnishmentAmount || undefined });
    }
    if (isGuarantyCreditor(c)) {
      out.other.push({ no: num(c), name: nameOf(c), principalDebtor: c.principalDebtorName || '', amount: c.guaranteeAmount || undefined, date: c.guaranteeDate || '', detail: c.annexDetail || '' });
    }
  }
  return out;
}

/** 회사 형태 표기((주)·㈜·주식회사·(유)·유한회사)를 통째로 지운 뒤 공백·괄호를 지운 이름 */
const normalizedName = (raw: string) => raw
  .replace(/[(（]\s*(주|유)\s*[)）]|㈜|주식회사|유한회사/g, '')
  .replace(/[\s()（）]/g, '');

/** 같은 채권자를 한 번만 센 수 (이름·주소의 공백·괄호를 지우고 비교) */
export function uniqueCreditorCount(creditors: RepaymentCreditor[]): number {
  const key = (c: RepaymentCreditor) => `${normalizedName(nameOf(c))}|${(c.address || '').replace(/\s/g, '')}`;
  return new Set(creditors.filter(c => (nameOf(c)).trim()).map(key)).size;
}
