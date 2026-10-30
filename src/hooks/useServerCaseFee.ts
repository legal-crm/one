// 사건 화면용 서버 수납 요약 (FE): 약정·납부 합계·기한 지남·다음 회차·입금 계좌
// 사건 관리 사본(crm_clients.fee_schedule)의 납부 상태는 서버 기록과 따로 놀아 쓰지 않는다.
// 수납 패널에서 기록이 바뀌면 FEE_CHANGED_EVENT로 다시 읽는다.
import { useCallback, useEffect, useState } from 'react';
import { findCaseByWorkspaceKey } from '../services/cases/caseCoreService';
import {
  loadCurrentAgreement, loadDepositAccount, loadFeeStatus,
  type DepositAccount, type FeeInstallmentStatus,
} from '../services/fees/feeService';

export const FEE_CHANGED_EVENT = 'mykim:fee-changed';
export const notifyFeeChanged = () => window.dispatchEvent(new Event(FEE_CHANGED_EVENT));

export interface ServerCaseFee {
  loaded: boolean;
  caseId: string | null;
  hasAgreement: boolean;
  totalFeeWon: number;
  paidWon: number;
  remainingWon: number;
  overdueCount: number;
  rows: FeeInstallmentStatus[];
  /** 기한 지난 회차 먼저, 없으면 다음 예정 회차 */
  nextUnpaid: FeeInstallmentStatus | null;
  account: DepositAccount | null;
}

const EMPTY: ServerCaseFee = { loaded: false, caseId: null, hasAgreement: false, totalFeeWon: 0, paidWon: 0, remainingWon: 0, overdueCount: 0, rows: [], nextUnpaid: null, account: null };

export function useServerCaseFee(officeId: string | undefined, workspaceKey: string | undefined): ServerCaseFee & { refresh: () => void } {
  const [state, setState] = useState<ServerCaseFee>(EMPTY);

  const refresh = useCallback(async () => {
    if (!officeId || !workspaceKey) { setState(EMPTY); return; }
    const found = await findCaseByWorkspaceKey(officeId, workspaceKey);
    if (found.ok === false || !found.data) { setState({ ...EMPTY, loaded: true }); return; }
    const caseId = found.data.id;
    const [s, a, acc] = await Promise.all([loadFeeStatus(caseId), loadCurrentAgreement(caseId), loadDepositAccount(caseId)]);
    const rows = s.ok ? s.data : [];
    const agreement = a.ok ? a.data : null;
    const paidWon = rows.reduce((sum, r) => sum + r.allocatedWon, 0);
    const totalFeeWon = agreement?.totalFeeWon ?? 0;
    const overdue = rows.filter(r => r.status === 'overdue');
    setState({
      loaded: true,
      caseId,
      hasAgreement: !!agreement,
      totalFeeWon,
      paidWon,
      remainingWon: Math.max(0, totalFeeWon - paidWon),
      overdueCount: overdue.length,
      rows,
      nextUnpaid: overdue[0] || rows.find(r => r.status !== 'paid') || null,
      account: acc.ok ? acc.data : null,
    });
  }, [officeId, workspaceKey]);

  useEffect(() => {
    void refresh();
    const on = () => { void refresh(); };
    window.addEventListener(FEE_CHANGED_EVENT, on);
    return () => window.removeEventListener(FEE_CHANGED_EVENT, on);
  }, [refresh]);

  return { ...state, refresh: () => { void refresh(); } };
}
