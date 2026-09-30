import React from 'react';
import { Building2, CreditCard, Wallet } from 'lucide-react';
import type { ConsultRequest, FinancialProfile } from '../../../../types';
import {
  DEBT_CAUSE_SHORT_LABELS, DEBT_ITEM_TYPE_LABELS, HARASSMENT_SHORT_LABELS, LEGAL_ACTION_LABELS,
  harassmentSeverity, lookupLabel,
} from '../../../../constants/clientProfileLabels';
import { formatManwon } from '../chatFormat';
import type { RepaymentSummary } from './useRepaymentSimulation';
import { DataRow, RailSection } from './railUi';

function DebtTypeChip({ type }: { type: string }) {
  const label = lookupLabel(DEBT_ITEM_TYPE_LABELS, type, '신용');
  const isTax = String(type || '').toLowerCase() === 'tax';
  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded-lg border text-[12px] font-semibold whitespace-nowrap ${
        isTax ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-600'
      }`}
    >
      {label}
    </span>
  );
}

const COMPOSITION = [
  { key: 'banks', label: '1금융 (은행)', color: 'bg-brand' },
  { key: 'cards', label: '2금융 (카드·캐피탈)', color: 'bg-sky-500' },
  { key: 'personals', label: '대부·개인 채무', color: 'bg-slate-400' },
] as const;

interface FinanceTabProps {
  request: ConsultRequest;
  simulation: RepaymentSummary | null;
}

export default function FinanceTab({ request, simulation }: FinanceTabProps) {
  const fp: FinancialProfile = request.financialProfile || ({} as FinancialProfile);
  const debts = (fp.debts || []).filter(d => d && (d.creditor || d.amount));
  const listTotal = debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const creditorCount = fp.creditorCount || debts.length || 0;

  const dt = fp.debtTypes || ({} as FinancialProfile['debtTypes']);
  const parts = COMPOSITION.map(c => ({ ...c, value: Number((dt as any)?.[c.key]) || 0 })).filter(p => p.value > 0);
  const partsTotal = parts.reduce((s, p) => s + p.value, 0);

  const actions = (fp.legalActions || []).filter(a => a && a !== 'none');
  const severity = harassmentSeverity(fp.harassmentLevel);
  const isMarried = String(fp.maritalStatus || '').toUpperCase() === 'MARRIED';
  const assets = fp.assetsTotal || fp.myAssets || 0;

  const livingRows = [
    { label: '월세', value: fp.rentCost },
    { label: '월 의료비', value: fp.medicalCost },
    { label: '자녀 교육비', value: (fp.educationCost || 0) + (fp.specialEducationCost || 0) },
    { label: '고정 지출 (통신·보험 등)', value: fp.monthlyFixedExpenses },
  ].filter(r => (r.value || 0) > 0);

  return (
    <div className="divide-y divide-slate-100">
      <RailSection
        icon={CreditCard}
        title="채무"
        aside={<span className="tabular-nums">{formatManwon(fp.debtTotal || 0)}{creditorCount ? ` · ${creditorCount}곳` : ''}</span>}
      >
        {debts.length > 0 && (
          <table className="w-full text-sm">
            <caption className="sr-only">채권자별 채무 목록</caption>
            <thead>
              <tr className="text-[12px] text-slate-500">
                <th scope="col" className="pb-1.5 text-left font-medium">채권기관</th>
                <th scope="col" className="pb-1.5 text-left font-medium">구분</th>
                <th scope="col" className="pb-1.5 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {debts.map((d, i) => (
                <tr key={`${d.creditor}-${i}`}>
                  <td className="py-2 pr-2 text-slate-800 [overflow-wrap:anywhere]">{d.creditor || '미기재'}</td>
                  <td className="py-2 pr-2"><DebtTypeChip type={d.type} /></td>
                  <td className="py-2 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatManwon(Number(d.amount) || 0, { unit: false })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <th scope="row" colSpan={2} className="pt-2 text-left text-xs font-semibold text-slate-600">목록 합계</th>
                <td className="pt-2 text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatManwon(listTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {parts.length > 0 && (
          <div className={debts.length > 0 ? 'mt-4' : ''}>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-600">채무 유형 구성</p>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100" role="img" aria-label={parts.map(p => `${p.label} ${formatManwon(p.value)}`).join(', ')}>
              {parts.map(p => (
                <div key={p.key} className={p.color} style={{ width: `${(p.value / partsTotal) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-2 space-y-1">
              {parts.map(p => (
                <li key={p.key} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-sm shrink-0 ${p.color}`} aria-hidden="true" />
                  <span className="text-slate-600">{p.label}</span>
                  <span className="ml-auto font-semibold text-slate-900 tabular-nums">{formatManwon(p.value, { unit: false })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          {(dt?.recentLoans || 0) > 0 && <DataRow label="최근 1년 내 대출" value={formatManwon(dt.recentLoans)} tone="risk" />}
          {(dt?.coinCrypto || 0) > 0 && <DataRow label="투자·코인 손실" value={formatManwon(dt.coinCrypto)} tone="risk" />}
          {(fp.priorityDebt || 0) > 0 && <DataRow label="우선변제 채무" hint="국세·4대보험 등 전액 변제 대상" value={formatManwon(fp.priorityDebt)} tone="risk" />}
          <DataRow label="채무 원인" value={lookupLabel(DEBT_CAUSE_SHORT_LABELS, fp.debtCause)} />
          <DataRow
            label="추심 단계"
            value={lookupLabel(HARASSMENT_SHORT_LABELS, fp.harassmentLevel)}
            tone={severity === 'risk' ? 'risk' : 'default'}
          />
          {actions.length > 0 && (
            <DataRow label="진행 중인 법적 조치" value={actions.map(a => lookupLabel(LEGAL_ACTION_LABELS, a, a)).join(', ')} />
          )}
        </div>
      </RailSection>

      <RailSection icon={Building2} title="재산·청산가치" aside={<span className="tabular-nums">{formatManwon(assets)}</span>}>
        {(fp.rentalDeposit || 0) > 0 && (
          <DataRow
            label="임대차 보증금"
            hint={fp.depositLoan ? `보증금 대출 ${formatManwon(fp.depositLoan)} 차감 전` : undefined}
            value={formatManwon(fp.rentalDeposit)}
          />
        )}
        {(fp.myAssets || 0) > 0 && <DataRow label="본인 명의 재산" value={formatManwon(fp.myAssets)} />}
        {isMarried && (fp.spouseAsset || 0) > 0 && (
          <DataRow label="배우자 재산" hint="법원별 반영 비율 적용" value={formatManwon(fp.spouseAsset)} />
        )}
        {(fp.retirementPay || 0) > 0 && (
          <DataRow
            label="예상 퇴직금"
            hint={fp.retirementPensionType === 'pension' ? '퇴직연금 (청산가치 제외)' : '청산가치 50% 반영'}
            value={formatManwon(fp.retirementPay)}
          />
        )}
        {simulation && <DataRow label="청산가치" hint="시뮬레이션 기준" value={formatManwon(simulation.liquidationValue)} />}
        {!(fp.rentalDeposit || fp.myAssets || fp.retirementPay || (isMarried && fp.spouseAsset)) && !simulation && (
          <p className="text-xs text-slate-600">입력된 재산 정보가 없습니다.</p>
        )}
      </RailSection>

      <RailSection icon={Wallet} title="소득·생계비" aside={<span className="tabular-nums">월 {formatManwon(fp.income || 0)}</span>}>
        {livingRows.map(r => <DataRow key={r.label} label={r.label} value={formatManwon(r.value)} />)}
        {(fp.childSupportReceived || 0) > 0 && (
          <DataRow label="양육비 수령" value={`+${formatManwon(fp.childSupportReceived)}`} tone="positive" />
        )}
        {(fp.childSupportPaid || 0) > 0 && (
          <DataRow label="양육비 지급" value={`-${formatManwon(fp.childSupportPaid)}`} tone="negative" />
        )}
        {livingRows.length === 0 && !(fp.childSupportReceived || fp.childSupportPaid) && (
          <p className="text-xs text-slate-600">추가로 인정받을 생계비 항목이 없습니다.</p>
        )}
      </RailSection>
    </div>
  );
}
