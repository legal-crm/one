import { useMemo } from 'react';
import type { ConsultRequest } from '../../../../types';
import { calculateRepayment } from '../../../../rehab-chatbot-package/services/calculationService';
import { mapToRehabUserInput } from '../../mapToRehabUserInput';

export interface RepaymentSummary {
  /** 월 변제금 (만 원) */
  monthlyPay: number;
  months: number;
  /** 총 변제금 (만 원) */
  totalRepay: number;
  /** 탕감액 (만 원) */
  reduction: number;
  /** 탕감률 (%) */
  reductionRate: number;
  /** 청산가치 (만 원) */
  liquidationValue: number;
}

const toManwon = (won: number) => (Number.isFinite(won) ? Math.round(won / 10000) : 0);

/**
 * 제안서 워크스페이스와 같은 입력(mapToRehabUserInput)으로 계산한다.
 * 이전 채팅 탭은 입력을 따로 조립하면서 엔진이 읽지 않는 필드명(monthlyRent·monthlyMedical·gamblingDebt 등)을 넘겨
 * 월세·의료비·교육비·사행성 손실이 계산에서 빠졌다.
 */
export function useRepaymentSimulation(request: ConsultRequest | null): RepaymentSummary | null {
  return useMemo(() => {
    if (!request?.financialProfile) return null;
    try {
      const res = calculateRepayment(mapToRehabUserInput(request));
      return {
        monthlyPay: toManwon(res.monthlyPayment),
        months: res.repaymentMonths || 36,
        totalRepay: toManwon(res.totalRepayment),
        reduction: toManwon(res.totalDebtReduction),
        reductionRate: Number.isFinite(res.debtReductionRate) ? res.debtReductionRate : 0,
        liquidationValue: toManwon(res.liquidationValue),
      };
    } catch (e) {
      console.warn('[chat] 변제 시뮬레이션 계산 실패', e);
      return null;
    }
  }, [request]);
}
