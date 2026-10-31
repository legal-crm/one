// ============================================================
// 부채증명서 발급 실비 기본값 (DC-9) — 사무소 '대행사 설정'(office_debt_agencies)의 건당 대행비 + 발급비
// 이전: 계약서·실비 계산이 곳당 15,000원을 근거 없이 고정해 썼다. 설정이 없으면 0원으로 두고 계약서에서 직접 넣는다.
// ============================================================
import { loadDebtAgencies } from './debtLedgerService';

let cachedUnitFee = 0;

export function getDefaultDebtCertUnitFee(): number {
  return cachedUnitFee;
}

export function setDefaultDebtCertUnitFee(n: number): void {
  cachedUnitFee = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** 로그인 때 사무소 대행사 설정을 읽어 둔다 (첫 대행사의 건당 대행비 + 발급비) */
export async function loadDefaultDebtCertUnitFee(officeId: string | null | undefined): Promise<void> {
  if (!officeId) { setDefaultDebtCertUnitFee(0); return; }
  try {
    const list = await loadDebtAgencies(officeId);
    const a = list[0];
    setDefaultDebtCertUnitFee(a ? (a.feePer || 0) + (a.issueFeePer || 0) : 0);
  } catch {
    setDefaultDebtCertUnitFee(0);
  }
}
