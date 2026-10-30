import { useEffect, useState } from 'react';
import { DEBT_LEDGER_CHANGED_EVENT, loadDebtLedger } from '../services/debt/debtLedgerService';
import { ledgerComplete, type DebtCertificate } from '../services/debt/debtLedgerRules';

/** 사건의 부채증명 장부 완료 여부 (3단계 c2, DC-10). 빈 장부는 미완료 */
export function useDebtLedgerStatus(officeId?: string, caseKey?: string) {
  const [rows, setRows] = useState<DebtCertificate[] | null>(null);
  useEffect(() => {
    if (!officeId || !caseKey) { setRows(null); return; }
    let cancel = false;
    const load = () => void loadDebtLedger(officeId, caseKey).then(r => { if (!cancel) setRows(r.ok ? r.data : null); });
    load();
    window.addEventListener(DEBT_LEDGER_CHANGED_EVENT, load);
    return () => { cancel = true; window.removeEventListener(DEBT_LEDGER_CHANGED_EVENT, load); };
  }, [officeId, caseKey]);
  return { rows, complete: rows ? ledgerComplete(rows) : false };
}
