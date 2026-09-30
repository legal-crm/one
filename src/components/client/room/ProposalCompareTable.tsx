import React from 'react';
import type { ConsultProposal } from '../../../types';
import { formatKoreanWon } from '../ui/form';
import { feeTotalWon } from '../../../services/alimtokService';

/**
 * 도착한 제안서 비교표 (2건 이상일 때)
 * - 변호사가 적은 값만 보여 주고, 없으면 '제안서 참고'로 둔다 (임의 값으로 채우지 않는다)
 * - 순서는 도착 순이며 더 나은 조건을 표시하거나 추천하지 않는다
 */
const EMPTY = '제안서 참고';

function wonOrEmpty(value: unknown): string {
  const n = Number(value) || 0;
  return n > 0 ? formatKoreanWon(feeTotalWon(n)) : EMPTY;
}

interface Row {
  label: string;
  value: (p: ConsultProposal) => string;
}

const ROWS: Row[] = [
  { label: '예상 월 변제금', value: (p) => (Number(p.monthlyPayment) > 0 ? `${p.monthlyPayment}만원` : EMPTY) },
  {
    label: '변제 기간',
    value: (p) => {
      const months = Number(p.duration) || Number(p.proposalData?.diagnosis?.repaymentMonths) || 0;
      return months > 0 ? `${months}개월` : EMPTY;
    },
  },
  { label: '예상 감면율', value: (p) => (Number(p.reductionRate) > 0 ? `${p.reductionRate}%` : EMPTY) },
  {
    label: '수임료 총액',
    value: (p) => (Number(p.fee) > 0 ? `${p.fee}만원` : wonOrEmpty(p.proposalData?.fees?.totalFee)),
  },
  { label: '착수금', value: (p) => wonOrEmpty(p.proposalData?.fees?.downPayment) },
  {
    label: '분납',
    value: (p) => {
      if (p.installment) return p.installment;
      const count = Number(p.proposalData?.fees?.installments) || 0;
      const monthly = Number(p.proposalData?.fees?.monthlyInstallment) || 0;
      if (count > 0 && monthly > 0) return `${count}회 · 회당 ${formatKoreanWon(feeTotalWon(monthly))}`;
      return count > 0 ? `${count}회` : EMPTY;
    },
  },
  { label: '법원 예납금·실비', value: (p) => wonOrEmpty(p.proposalData?.fees?.courtDeposit) },
  { label: '수임료 메모', value: (p) => String(p.proposalData?.fees?.feeMemo || '').trim() || EMPTY },
];

export default function ProposalCompareTable({ proposals }: { proposals: ConsultProposal[] }) {
  if (proposals.length < 2) return null;
  return (
    <section aria-labelledby="proposal-compare-title" className="space-y-2">
      <h3 id="proposal-compare-title" className="text-sm font-bold text-slate-900">제안서 한눈에 비교</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200 -mx-1 px-1" tabIndex={0} role="region" aria-label="제안서 비교표 (가로로 넘겨 볼 수 있어요)">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">변호사별 제안 조건 비교. 도착한 순서로 표시합니다.</caption>
          <thead>
            <tr className="bg-slate-50">
              <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-600 w-28">항목</th>
              {proposals.map((p) => (
                <th key={p.id} scope="col" className="px-3 py-2.5 text-left text-xs font-bold text-slate-900 whitespace-nowrap">
                  {String(p.lawyerName || '').replace(/\s*변호사$/, '')} 변호사
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-600 align-top">{row.label}</th>
                {proposals.map((p) => {
                  const v = row.value(p);
                  return (
                    <td key={p.id} className={`px-3 py-2.5 align-top break-keep ${v === EMPTY ? 'text-slate-500' : 'font-bold text-slate-900 tabular-nums'}`}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed break-keep">
        도착한 순서로 보여 주며, 플랫폼은 특정 변호사를 추천하지 않습니다. 부가세 포함 여부와 추가 비용은 제안서와 상담에서 꼭 확인하세요.
      </p>
    </section>
  );
}
