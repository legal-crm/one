import React, { useMemo } from 'react';
import { CheckCircle, AlertTriangle, Coins } from 'lucide-react';
import { setDockLiquidation, setDockShared, useDockShared, LiquidationInputs } from '../dockShared';
import { computeQuickLiquidation, evaluateQuickPlan } from '../quickCalc';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import RegionSelect from '../ui/RegionSelect';
import { formatWonKorean, won } from '../ui/money';
import { REGION_CONFIG_2026 } from '../../../../services/repayment/repaymentConstants2026';

type MoneyField = Exclude<keyof LiquidationInputs, 'isPension' | 'spouseRatio'>;

const ASSET_FIELDS: { key: MoneyField; label: string; placeholder?: string }[] = [
  { key: 'housing', label: '주택·아파트 순가액', placeholder: '시세 − 근저당' },
  { key: 'land', label: '토지·임야 순가액', placeholder: '가액 − 담보' },
  { key: 'vehicle', label: '차량 순가액', placeholder: '시세 − 저당' },
  { key: 'other', label: '기타 재산', placeholder: '공제 없이 반영' },
  { key: 'leaseDeposit', label: '임차보증금', placeholder: '보증금 전액' },
  { key: 'leaseLoan', label: '보증금 담보대출', placeholder: '전세대출 등' },
  { key: 'deposits', label: '예금·적금 합계', placeholder: '전 금융기관 합계' },
  { key: 'insurance', label: '보장성보험 해약환급금', placeholder: '합계' },
];

const PERIODS = [24, 36, 48, 60];

/**
 * 청산가치 보장 점검기
 * - 공제 전 금액을 넣으면 법원 제출용 엔진(computeAssetBreakdown)과 같은 규칙으로 공제한다:
 *   예금 185만(1회), 보장성보험 150만, 퇴직금 1/2(퇴직연금 0원), 임차보증금은 지역별 소액임차 기준.
 * - 판정은 월 변제금 × 기간(명목 합계)이 아니라 라이프니츠 현재가치와 비교한다 (이전 버전의 오류).
 */
export default function LiquidationCalcTool() {
  const shared = useDockShared();
  const inp = shared.liquidation;
  const { copied, copy } = useCopyFeedback();

  const result = useMemo(() => computeQuickLiquidation(inp, shared.region), [inp, shared.region]);
  const plan = evaluateQuickPlan({
    totalDebt: shared.totalDebt,
    monthlyPay: shared.monthlyPay,
    months: shared.periodMonths,
    liquidationValue: result.total,
  });
  const hasAssets = result.rows.length > 0;
  const hasPlan = shared.monthlyPay > 0;

  const handleCopy = () => {
    const rows = result.rows.map(r => `  - ${r.label}: ${formatWonKorean(r.input)} → ${formatWonKorean(r.value)} (${r.note})`);
    const verdict = !hasPlan
      ? '• 판정: 월 변제금 미입력'
      : plan.satisfiesLiquidation
      ? '• 판정: 현재가치 기준 청산가치 충족 (참고)'
      : `• 판정: 현재가치 기준 ${formatWonKorean(Math.max(0, result.total - plan.presentValue))} 부족 → ${plan.months}개월이면 월 ${won(plan.requiredMonthlyForLiquidation)} 이상 필요`;
    const text = [
      '[청산가치 보장 점검 (참고)]',
      `• 거주 지역: ${REGION_CONFIG_2026[shared.region].name}`,
      `• 청산가치 합계: ${formatWonKorean(result.total)}`,
      ...rows,
      hasPlan
        ? `• 변제 계획: 월 ${won(plan.monthly)} × ${plan.months}개월 (명목 ${formatWonKorean(plan.nominalTotal)}, 현재가치 ${won(plan.presentValue)})`
        : '',
      verdict,
      '※ 공제·반영 비율은 관할 법원 실무에 따라 달라질 수 있습니다.',
    ].filter(Boolean);
    copy(text.join('\n'), '청산가치 점검 결과가 복사되었습니다.');
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      {/* 1. 재산 입력 */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-800">1. 재산 (공제 전 금액)</span>
          <span className="text-[10px] text-slate-500">법정 공제는 자동 반영</span>
        </div>

        <div>
          <label htmlFor="liq-region" className="text-[10px] text-slate-600 font-semibold block mb-0.5">거주 지역 (소액임차보증금 기준)</label>
          <RegionSelect id="liq-region" value={shared.region} onChange={region => setDockShared({ region })} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ASSET_FIELDS.map(f => (
            <div key={f.key}>
              <label htmlFor={`liq-${f.key}`} className="text-[10px] text-slate-600 font-semibold block mb-0.5">{f.label}</label>
              <MoneyInput
                id={`liq-${f.key}`}
                value={inp[f.key]}
                onChange={v => setDockLiquidation({ [f.key]: v } as Partial<LiquidationInputs>)}
                placeholder={f.placeholder}
              />
            </div>
          ))}

          <div>
            <label htmlFor="liq-severance" className="text-[10px] text-slate-600 font-semibold block mb-0.5">퇴직금 예상액 (전액)</label>
            <MoneyInput id="liq-severance" value={inp.severance} onChange={v => setDockLiquidation({ severance: v })} placeholder="예상퇴직금확인서" />
            <label className="flex items-center gap-1 mt-1 text-[10px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={inp.isPension}
                onChange={e => setDockLiquidation({ isPension: e.target.checked })}
                className="rounded accent-emerald-600"
              />
              퇴직연금(DB·DC·IRP) → 0원
            </label>
          </div>

          <div>
            <label htmlFor="liq-spouse" className="text-[10px] text-slate-600 font-semibold block mb-0.5">배우자 명의 순재산</label>
            <MoneyInput id="liq-spouse" value={inp.spouseNet} onChange={v => setDockLiquidation({ spouseNet: v })} placeholder="시세 − 담보" />
            <select
              value={inp.spouseRatio}
              onChange={e => setDockLiquidation({ spouseRatio: Number(e.target.value) })}
              aria-label="배우자 재산 반영 비율"
              className="mt-1 w-full px-1.5 py-1 bg-white border border-slate-300 rounded-xl text-[10px] font-bold text-slate-800 cursor-pointer"
            >
              <option value={0.5}>50% 반영</option>
              <option value={0}>반영 안 함</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="liq-additional" className="text-[10px] text-slate-600 font-semibold block mb-0.5">
              청산가치 가산액 (편파변제·투자손실금 등, 관할 법원 기준에 따라)
            </label>
            <MoneyInput id="liq-additional" value={inp.additional} onChange={v => setDockLiquidation({ additional: v })} placeholder="해당 없으면 비워두세요" />
          </div>
        </div>
      </div>

      {/* 2. 공제 내역 */}
      {hasAssets ? (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-[11px]">
            <caption className="sr-only">재산별 청산가치 반영 내역</caption>
            <thead className="bg-slate-50 text-slate-600 font-bold">
              <tr>
                <th scope="col" className="py-1.5 px-2 text-left">항목</th>
                <th scope="col" className="py-1.5 px-2 text-right">입력</th>
                <th scope="col" className="py-1.5 px-2 text-right">반영</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map(r => (
                <tr key={r.key}>
                  <td className="py-1.5 px-2">
                    <span className="font-bold text-slate-800 block leading-tight">{r.label}</span>
                    <span className="text-[10px] text-slate-500">{r.note}</span>
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-slate-600">{formatWonKorean(r.input)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold text-slate-900">{formatWonKorean(r.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-emerald-50/70">
              <tr>
                <th scope="row" colSpan={2} className="py-1.5 px-2 text-left font-extrabold text-emerald-900">청산가치 합계</th>
                <td className="py-1.5 px-2 text-right tabular-nums font-black text-emerald-800">{formatWonKorean(result.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-600 border border-slate-200 space-y-1">
          <Coins className="w-5 h-5 mx-auto text-slate-500" aria-hidden="true" />
          <p className="font-bold">보유 재산을 입력하세요.</p>
          <p className="text-[11px] text-slate-500">자산가액 조회·압류금지 도구의 ‘청산가치 점검기에 반영’ 버튼으로도 채울 수 있습니다.</p>
        </div>
      )}

      {/* 3. 변제 계획 */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-800 block">2. 변제 계획</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="liq-monthly" className="text-[10px] text-slate-600 font-semibold block mb-0.5">월 변제금</label>
            <MoneyInput id="liq-monthly" value={shared.monthlyPay} onChange={v => setDockShared({ monthlyPay: v })} placeholder="예: 60만" />
          </div>
          <div>
            <label htmlFor="liq-period" className="text-[10px] text-slate-600 font-semibold block mb-0.5">변제 기간</label>
            <select
              id="liq-period"
              value={PERIODS.includes(shared.periodMonths) ? shared.periodMonths : ''}
              onChange={e => {
                const months = Number(e.target.value);
                if (months > 0) setDockShared({ periodMonths: months });
              }}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
            >
              {!PERIODS.includes(shared.periodMonths) && <option value="">{shared.periodMonths}개월 (직접 입력)</option>}
              {PERIODS.map(m => (
                <option key={m} value={m}>{m}개월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. 판정 */}
      {hasAssets && hasPlan && (
        <div
          aria-live="polite"
          className={`p-3 rounded-2xl border space-y-1.5 ${
            plan.satisfiesLiquidation ? 'bg-emerald-50/80 border-emerald-300' : 'bg-rose-50/80 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {plan.satisfiesLiquidation ? (
              <CheckCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700" aria-hidden="true" />
            )}
            <span className={`font-bold ${plan.satisfiesLiquidation ? 'text-emerald-900' : 'text-rose-900'}`}>
              {plan.satisfiesLiquidation ? '청산가치 요건 충족 (참고)' : '청산가치 미달 (보정 가능성)'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
            <div>
              <span className="text-slate-600 block">청산가치</span>
              <span className="font-extrabold text-slate-900 tabular-nums">{formatWonKorean(result.total)}</span>
            </div>
            <div>
              <span className="text-slate-600 block">변제액 현재가치 (계수 {plan.leibnizFactor})</span>
              <span className={`font-extrabold tabular-nums ${plan.satisfiesLiquidation ? 'text-emerald-800' : 'text-rose-800'}`}>
                {won(plan.presentValue)}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-600">명목 합계 {formatWonKorean(plan.nominalTotal)} (월 {won(plan.monthly)} × {plan.months}개월)</p>
          {!plan.satisfiesLiquidation && (
            <p className="text-[11px] text-rose-800 font-bold">
              {plan.months}개월이면 월 {won(plan.requiredMonthlyForLiquidation)} 이상 변제해야 현재가치가 청산가치 이상이 됩니다.
            </p>
          )}
        </div>
      )}

      <CopyButton copied={copied} onClick={handleCopy} disabled={!hasAssets} label="점검 결과 복사" />
    </div>
  );
}
