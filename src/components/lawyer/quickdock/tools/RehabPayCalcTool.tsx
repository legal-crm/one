import React, { useMemo } from 'react';
import { TrendingDown, CheckCircle, AlertTriangle, Percent } from 'lucide-react';
import { setDockShared, useDockShared } from '../dockShared';
import { computeQuickLiquidation, evaluateQuickPlan } from '../quickCalc';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import { formatWonKorean, won } from '../ui/money';
import DockCaseActionBar from '../DockCaseActionBar';

const PERIOD_OPTIONS: { months: number; note: string }[] = [
  { months: 24, note: '단축' },
  { months: 36, note: '원칙' },
  { months: 48, note: '' },
  { months: 60, note: '최장' },
];

function StatusBadge({ ok, okText = '충족', failText = '미달' }: { ok: boolean; okText?: string; failText?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-1.5 py-0.5 rounded-lg ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}
    >
      {ok ? <CheckCircle className="w-3 h-3" aria-hidden="true" /> : <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
      {ok ? okText : failText}
    </span>
  );
}

/**
 * 변제계획 점검기 (변호사 내부 검토용)
 * - 의뢰인에게 감면율·'탕감' 표현을 보내지 않도록 복사 문구를 '내부 검토용'과 '의뢰인 안내용'으로 나눴다 (T-4).
 * - 현재가치(라이프니츠)·최저변제액·청산가치 판정은 rehabLegalCore(변제계획안 화면과 같은 산식)를 쓴다.
 * - 총 채무·월 변제금·기간은 퀵독 공유값이라 중위소득·청산가치 도구와 함께 바뀐다.
 * - 사건 워크스페이스 연동 시 '사건에 반영', '할 일 등록', '메모에 추가' 가능
 */
export default function RehabPayCalcTool() {
  const shared = useDockShared();
  const { copied, copy } = useCopyFeedback();
  const clientCopy = useCopyFeedback();

  const liquidation = useMemo(
    () => computeQuickLiquidation(shared.liquidation, shared.region).total,
    [shared.liquidation, shared.region],
  );
  const plan = evaluateQuickPlan({
    totalDebt: shared.totalDebt,
    monthlyPay: shared.monthlyPay,
    months: shared.periodMonths,
    liquidationValue: liquidation,
  });
  const hasInput = shared.totalDebt > 0 && shared.monthlyPay > 0;

  const setPeriod = (m: number) => setDockShared({ periodMonths: Math.min(60, Math.max(1, Math.round(m) || 36)) });

  const briefingText = useMemo(() => {
    if (!hasInput) return '';
    const lines = [
      '[내부 검토용 · 의뢰인에게 그대로 보내지 마세요] 변제계획 점검 (참고)',
      `• 총 채무 원금: ${formatWonKorean(plan.principal)}`,
      `• 월 변제금: ${won(plan.monthly)} × ${plan.months}개월 = ${formatWonKorean(plan.totalRepayment)} (변제율 ${plan.repaymentRate.toFixed(1)}%)`,
      plan.fullPayoff && plan.payoffMonths
        ? `• 약 ${plan.payoffMonths}개월 안에 원금 전액 변제 가능`
        : `• 변제 후 면책 대상 원금(예상): ${formatWonKorean(plan.forgiven)}`,
      `• 현재가치(라이프니츠 ${plan.leibnizFactor}): ${won(plan.presentValue)}`,
      `• 최저변제액 기준: ${won(plan.minimumRepayment)} → ${plan.satisfiesMinimum ? '충족' : '미달'}`,
      liquidation > 0
        ? `• 청산가치: ${formatWonKorean(liquidation)} → 현재가치 기준 ${plan.satisfiesLiquidation ? '충족' : `미달 (월 ${won(plan.requiredMonthlyForLiquidation)} 이상 필요)`}`
        : '',
      '* 변제 완료 후 면책결정을 받으면 잔존 채무의 책임이 면제됩니다 (비면책채권 제외). 실제 변제금은 법원 인가 내용에 따릅니다.',
    ].filter(Boolean);
    return lines.join('\n');
  }, [hasInput, plan, liquidation]);

  // 의뢰인 안내용: 월 변제금·기간·총 변제액만 (변제율·감면 표현·인가 요건 판정 없음)
  const clientText = useMemo(() => {
    if (!hasInput) return '';
    return [
      '[변제 계획 참고 안내]',
      `• 월 변제금 ${won(plan.monthly)} × ${plan.months}개월 (총 ${formatWonKorean(plan.totalRepayment)})`,
      '* 실제 월 변제금과 기간은 채권자목록·재산·소득 자료를 확인한 뒤 변호사가 정하고, 법원 인가 내용에 따릅니다.',
    ].join('\n');
  }, [hasInput, plan]);

  const handleCopy = () => {
    if (!briefingText) return;
    copy(briefingText, '내부 검토용 문구가 복사되었습니다.');
  };

  const applyData = hasInput
    ? {
        monthlyPay: plan.monthly,
        periodMonths: plan.months,
        totalDebt: plan.principal,
        liquidationValue: liquidation,
        repaymentRate: plan.repaymentRate,
        sourceTool: '변제계획 점검기',
        summaryText: `월 변제금 ${won(plan.monthly)} (${plan.months}개월, 총 ${formatWonKorean(plan.totalRepayment)})`,
      }
    : undefined;

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      {/* 입력 */}
      <div className="space-y-2.5">
        <div>
          <label htmlFor="rehab-total-debt" className="font-bold text-slate-700 block mb-1">총 채무 원금</label>
          <MoneyInput id="rehab-total-debt" value={shared.totalDebt} onChange={v => setDockShared({ totalDebt: v })} placeholder="예: 8000만" />
        </div>

        <div>
          <label htmlFor="rehab-monthly-pay" className="font-bold text-slate-700 block mb-1">월 변제금</label>
          <MoneyInput id="rehab-monthly-pay" value={shared.monthlyPay} onChange={v => setDockShared({ monthlyPay: v })} placeholder="예: 50만" />
          {shared.monthlyPay === 0 && (
            <p className="text-xs text-slate-500 mt-0.5">중위소득표 도구에서 계산한 가용소득을 바로 적용할 수 있습니다.</p>
          )}
        </div>

        <div>
          <span className="font-bold text-slate-700 block mb-1" id="rehab-period-label">변제 기간</span>
          <div className="flex items-center gap-1" role="radiogroup" aria-labelledby="rehab-period-label">
            {PERIOD_OPTIONS.map(opt => {
              const selected = shared.periodMonths === opt.months;
              return (
                <button
                  key={opt.months}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPeriod(opt.months)}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-colors cursor-pointer text-center whitespace-nowrap press-scale ${
                    selected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt.months}
                  {opt.note && <span className={`ml-0.5 text-xs ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>{opt.note}</span>}
                </button>
              );
            })}
            <label className="flex items-center gap-1 shrink-0 text-xs text-slate-600">
              <span className="sr-only">변제 기간 직접 입력</span>
              <input
                type="number"
                min={1}
                max={60}
                value={shared.periodMonths}
                onChange={e => setPeriod(Number(e.target.value))}
                className="w-12 px-1.5 py-1.5 border border-slate-300 rounded-xl text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              개월
            </label>
          </div>
          {shared.periodMonths === 24 && (
            <p className="text-xs text-slate-500 mt-1">3년 미만 기간은 관할 법원 실무준칙의 단축 사유(65세 이상·중증장애 등)를 확인해야 합니다 (만나이·법원 참고 도구).</p>
          )}
        </div>
      </div>

      {/* 결과 */}
      {hasInput ? (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-3 rounded-2xl border border-indigo-200/80 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">총 변제액 ({plan.months}개월)</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatWonKorean(plan.totalRepayment)}</span>
          </div>
          {plan.fullPayoff && plan.payoffMonths ? (
            <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
              월 변제금으로 약 {plan.payoffMonths}개월 안에 원금 전액을 갚을 수 있습니다 (조기 완제).
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">변제 후 면책 대상 원금 (예상)</span>
              <span className="font-bold text-indigo-700 tabular-nums">{formatWonKorean(plan.forgiven)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span className="font-extrabold text-slate-800">원금 대비 변제율</span>
            </div>
            <span className="text-lg font-black text-indigo-700 tabular-nums">{plan.repaymentRate.toFixed(1)}%</span>
          </div>

          {/* 인가 요건 점검 (참고) */}
          <div className="pt-2 border-t border-indigo-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">현재가치 (라이프니츠 {plan.leibnizFactor})</span>
              <span className="font-bold text-slate-900 tabular-nums">{won(plan.presentValue)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">최저변제액 {won(plan.minimumRepayment)}</span>
              <StatusBadge ok={plan.satisfiesMinimum} />
            </div>
            {!plan.satisfiesMinimum && (
              <p className="text-xs text-rose-700 font-bold">{plan.months}개월이면 월 {won(plan.requiredMonthlyForMinimum)} 이상 필요</p>
            )}
            {liquidation > 0 ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">청산가치 {formatWonKorean(liquidation)}</span>
                  <StatusBadge ok={plan.satisfiesLiquidation} />
                </div>
                {!plan.satisfiesLiquidation && (
                  <p className="text-xs text-rose-700 font-bold">
                    현재가치 기준 {plan.months}개월이면 월 {won(plan.requiredMonthlyForLiquidation)} 이상 필요
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">청산가치 점검기에 재산을 입력하면 청산가치 충족 여부도 함께 표시합니다.</p>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-snug">
            최저변제액: 채무 5천만 원 미만 5%, 이상 3% + 100만 원 (플랫폼 산식). 청산가치는 변제액의 현재가치와 비교합니다.
          </p>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-600 border border-slate-200 space-y-1">
          <Percent className="w-5 h-5 mx-auto text-slate-500" aria-hidden="true" />
          <p className="font-bold">총 채무와 월 변제금을 입력하세요.</p>
          <p className="text-xs text-slate-500">총 변제액·현재가치·최저변제액 충족 여부를 바로 계산합니다.</p>
        </div>
      )}

      <CopyButton copied={copied} onClick={handleCopy} disabled={!hasInput} label="내부 검토용 문구 복사" />
      <CopyButton
        copied={clientCopy.copied}
        onClick={() => clientText && clientCopy.copy(clientText, '의뢰인 안내용 문구가 복사되었습니다.')}
        disabled={!hasInput}
        label="의뢰인 안내용 문구 복사"
        variant="light"
      />
      <DockCaseActionBar
        applyData={applyData}
        memoText={briefingText}
        memoCategory="consultation"
        disabled={!hasInput}
      />
    </div>
  );
}

