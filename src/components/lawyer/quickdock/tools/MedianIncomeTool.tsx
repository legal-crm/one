import React from 'react';
import { Calculator, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { MEDIAN_INCOME_100_2026, MIN_LIVING_EXPENSE_60_2026 } from '../../../../services/repayment/repaymentConstants2026';
import { setDockShared, useDockShared } from '../dockShared';
import { computeQuickDisposable, formatHousehold, HOUSEHOLD_OPTIONS } from '../quickCalc';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import { won } from '../ui/money';

// 2026년 기준중위소득(100%) 및 60% 생계비 — 단일 출처(repaymentConstants2026)
const TABLE_ROWS = [1, 2, 3, 4, 5, 6, 7, 8].map(size => ({
  size,
  full: MEDIAN_INCOME_100_2026[size],
  min60: MIN_LIVING_EXPENSE_60_2026[size],
}));

export default function MedianIncomeTool() {
  const shared = useDockShared();
  const { copied, copy } = useCopyFeedback();

  const d = computeQuickDisposable(shared);
  const incomeBelowLiving = shared.monthlyIncome > 0 && d.disposable <= 0;

  const handleApply = () => {
    setDockShared({ monthlyPay: d.disposable });
    toast.success(`월 변제금을 ${won(d.disposable)}으로 반영했습니다. (변제율·청산가치 도구)`);
  };

  const handleCopy = () => {
    const text = `[2026 가용소득 산정 (참고)]
• 가구원 수: ${formatHousehold(shared.householdSize)}
• 인정 생계비(기준중위소득 60%): ${won(d.baseLivingExpense)}${shared.extraLivingCost > 0 ? `\n• 추가생계비(인정 예상): ${won(shared.extraLivingCost)}` : ''}
• 의뢰인 월 소득(실수령): ${won(shared.monthlyIncome)}
• 예상 월 가용소득: ${won(d.disposable)}
※ 추가생계비 인정 여부와 금액은 관할 법원 판단에 따릅니다.`;
    copy(text, '생계비 및 가용소득 산출 결과가 복사되었습니다.');
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800">
      {/* 기준표 */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-48 overflow-y-auto">
        <table className="w-full text-[11px] text-left">
          <caption className="sr-only">2026년 가구원 수별 기준중위소득과 인정생계비</caption>
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
            <tr>
              <th scope="col" className="py-2 px-2.5">가구원수</th>
              <th scope="col" className="py-2 px-2.5">중위소득(100%)</th>
              <th scope="col" className="py-2 px-2.5 text-teal-800 bg-teal-50/70">인정생계비(60%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TABLE_ROWS.map(item => {
              const selected = shared.householdSize === item.size;
              return (
                <tr
                  key={item.size}
                  onClick={() => setDockShared({ householdSize: item.size })}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${selected ? 'bg-teal-50/80 font-bold' : ''}`}
                >
                  <td className="py-1.5 px-2.5">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setDockShared({ householdSize: item.size });
                      }}
                      aria-pressed={selected}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" aria-hidden="true" />}
                      <span>{item.size}인 가구</span>
                    </button>
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-600 tabular-nums">{item.full.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-teal-800 font-extrabold tabular-nums bg-teal-50/30">
                    {item.min60.toLocaleString()}원
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 가용소득 계산 */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          월 가용소득(예상 월 변제금) 계산
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="median-household" className="text-[10px] text-slate-600 font-semibold block mb-0.5">가구원 수 (본인 포함)</label>
            <select
              id="median-household"
              value={shared.householdSize}
              onChange={e => setDockShared({ householdSize: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {HOUSEHOLD_OPTIONS.map(n => (
                <option key={n} value={n}>
                  {Number.isInteger(n) ? `${n}인 가구` : `${n}인 (공동부양)`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="median-income" className="text-[10px] text-slate-600 font-semibold block mb-0.5">실수령 월 소득</label>
            <MoneyInput id="median-income" value={shared.monthlyIncome} onChange={v => setDockShared({ monthlyIncome: v })} placeholder="예: 320만" />
          </div>
          <div className="col-span-2">
            <label htmlFor="median-extra" className="text-[10px] text-slate-600 font-semibold block mb-0.5">
              추가생계비 (인정 예상액, 선택)
            </label>
            <MoneyInput id="median-extra" value={shared.extraLivingCost} onChange={v => setDockShared({ extraLivingCost: v })} placeholder="추가생계비 검토 도구에서 반영 가능" />
          </div>
        </div>
        {!Number.isInteger(shared.householdSize) && (
          <p className="text-[10px] text-slate-500">0.5인 단위는 앞뒤 가구원 수 생계비의 중간값입니다 (맞벌이 공동부양 등, 관할 법원 기준 확인).</p>
        )}

        <div className="p-2.5 bg-white rounded-xl border border-teal-200 space-y-1" aria-live="polite">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>인정 생계비 ({formatHousehold(shared.householdSize)})</span>
            <span className="font-bold text-slate-900 tabular-nums">{won(d.baseLivingExpense)}</span>
          </div>
          {shared.extraLivingCost > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>추가생계비</span>
              <span className="font-bold text-slate-900 tabular-nums">+ {won(shared.extraLivingCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700">예상 월 가용소득</span>
            <span className="text-sm font-black text-teal-800 tabular-nums">월 {won(d.disposable)}</span>
          </div>
        </div>

        {incomeBelowLiving && (
          <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            월 소득이 인정 생계비 이하입니다. 개인파산 절차도 함께 검토하세요.
          </p>
        )}

        <button
          type="button"
          onClick={handleApply}
          disabled={d.disposable <= 0}
          className="w-full min-h-[36px] py-1.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer press-scale flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
          가용소득을 월 변제금으로 적용
        </button>
      </div>

      <CopyButton copied={copied} onClick={handleCopy} disabled={shared.monthlyIncome <= 0} label="산출 결과 복사" />
    </div>
  );
}
