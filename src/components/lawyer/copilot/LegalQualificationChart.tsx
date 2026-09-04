import React from 'react';
import { Scale, CheckCircle2, AlertTriangle, ArrowUpRight, TrendingUp, ShieldAlert, Sparkles } from 'lucide-react';

interface LegalQualificationChartProps {
  liquidationValue: number; // 청산가치 (원)
  monthlyPayment: number;   // 월 변제금 (원)
  repaymentMonths: number;  // 변제 기간 (개월)
  totalDebt: number;        // 총 채무 (원)
  monthlyIncome: number;    // 월 소득 (원)
  monthlyLivingCost: number;// 인정 생계비 (원)
  className?: string;
  onAdjustPlan?: (newMonths: number, newMonthlyPayment: number) => void;
}

/** 금액 포맷팅 */
function formatWon(val: number): string {
  if (!val && val !== 0) return '0원';
  if (val >= 100000000) {
    const eok = (val / 100000000).toFixed(1);
    return `${eok}억 원`;
  }
  if (val >= 10000) {
    return `${Math.round(val / 10000).toLocaleString()}만 원`;
  }
  return `${val.toLocaleString()}원`;
}

export default function LegalQualificationChart({
  liquidationValue,
  monthlyPayment,
  repaymentMonths,
  totalDebt,
  monthlyIncome,
  monthlyLivingCost,
  className = '',
  onAdjustPlan
}: LegalQualificationChartProps) {
  // 1. 변제금 총액
  const totalRepayment = monthlyPayment * repaymentMonths;

  // 2. 라이프니츠(Leibniz) 계수 적용 현재가치 (PV) 산출
  // 법원 실무: 월 5% 복리할인(라이프니츠) 적용 계수
  // 36개월 계수 약 33.3657, 48개월 약 43.4304, 60개월 약 52.9907
  const getLeibnizFactor = (months: number) => {
    if (months <= 24) return 22.79;
    if (months <= 36) return 33.36;
    if (months <= 48) return 43.43;
    return 52.99;
  };
  const leibnizFactor = getLeibnizFactor(repaymentMonths);
  const presentValue = Math.round(monthlyPayment * leibnizFactor);

  // 3. 인가 요건 3대 판별
  // 요건 A: 청산가치 보장 (PV >= 청산가치)
  const meetsLiquidationGuarantee = presentValue >= liquidationValue;
  const liquidationGap = liquidationValue - presentValue; // 양수이면 부족

  // 요건 B: 지급불능 원칙 (청산가치 < 총 채무)
  const meetsInsolvency = totalDebt > liquidationValue;

  // 요건 C: 가용소득 적격 (가용소득 > 0)
  const disposableIncome = Math.max(0, monthlyIncome - monthlyLivingCost);
  const meetsDisposableIncome = disposableIncome > 0 && monthlyPayment > 0;

  // 청산가치 충족을 위해 필요한 최소 월 변제금 (현재 기간 기준)
  const requiredMonthlyPayment = Math.ceil(liquidationValue / leibnizFactor);
  const deficitMonthlyPayment = Math.max(0, requiredMonthlyPayment - monthlyPayment);

  // 전체 요건 통과 여부
  const isFullyQualified = meetsLiquidationGuarantee && meetsInsolvency && meetsDisposableIncome;

  // 차트 시각화용 최대 기준값 (비율 계산용)
  const maxBaseline = Math.max(totalDebt, liquidationValue * 1.2, totalRepayment * 1.1, 1);
  const liqPercent = Math.min(100, Math.round((liquidationValue / maxBaseline) * 100));
  const pvPercent = Math.min(100, Math.round((presentValue / maxBaseline) * 100));
  const totalRepayPercent = Math.min(100, Math.round((totalRepayment / maxBaseline) * 100));

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}>
      {/* ── 헤더: 인가 가능성 상태 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isFullyQualified ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900">3대 법적 인가 요건 실시간 검증</h4>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isFullyQualified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'}`}>
                {isFullyQualified ? '✅ 법원 인가 적격' : '⚠️ 요건 미달 (기각 위험)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              청산가치 보장 · 지급불능 요건 · 가용소득 투입 여부를 라이프니츠 현재가치(PV)로 동시 검증합니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 실시간 비교 워터폴 바 차트 ── */}
      <div className="space-y-3 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-100">
        {/* 바 1: 총 채무액 (상한선) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>총 채무액 (상한선)</span>
            <span className="text-slate-900 font-extrabold">{formatWon(totalDebt)}</span>
          </div>
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div className="bg-slate-400 h-full rounded-full w-full" />
          </div>
        </div>

        {/* 바 2: 변제금 총액 (원금 합계) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>변제금 총액 ({repaymentMonths}개월 단순 합산)</span>
            <span className="text-slate-900 font-extrabold">{formatWon(totalRepayment)}</span>
          </div>
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div className="bg-indigo-400 h-full rounded-full transition-all duration-500" style={{ width: `${totalRepayPercent}%` }} />
          </div>
        </div>

        {/* 바 3: 변제금 현재가치 (PV - 법원 심사 기준) vs 청산가치 */}
        <div className="space-y-1 pt-1 border-t border-slate-200/60">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-[#1E3A5F] flex items-center gap-1">
              ⚡ 변제금 현재가치 (PV, 라이프니츠 할인)
            </span>
            <span className={`font-black ${meetsLiquidationGuarantee ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatWon(presentValue)}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden relative">
            {/* 현재가치 바 */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${meetsLiquidationGuarantee ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${pvPercent}%` }}
            />
            {/* 청산가치 기준선 마커 */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-500 shadow-xs z-10"
              style={{ left: `${liqPercent}%` }}
              title={`청산가치 기준선: ${formatWon(liquidationValue)}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span className="text-amber-700 font-bold">▲ 청산가치 기준선: {formatWon(liquidationValue)}</span>
            <span>{meetsLiquidationGuarantee ? `청산가치 대비 +${formatWon(presentValue - liquidationValue)} 상회` : `부족: -${formatWon(liquidationGap)}`}</span>
          </div>
        </div>
      </div>

      {/* ── 3대 요건 체크리스트 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* 요건 1 */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${meetsLiquidationGuarantee ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-rose-50/70 border-rose-200 text-rose-800'}`}>
          {meetsLiquidationGuarantee ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <div>
            <p className="font-extrabold">1. 청산가치 보장</p>
            <p className="text-[10px] opacity-80 mt-0.5">{meetsLiquidationGuarantee ? '현재가치 충족' : '기각 위험 (미달)'}</p>
          </div>
        </div>

        {/* 요건 2 */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${meetsInsolvency ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-rose-50/70 border-rose-200 text-rose-800'}`}>
          {meetsInsolvency ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <div>
            <p className="font-extrabold">2. 지급불능 상태</p>
            <p className="text-[10px] opacity-80 mt-0.5">{meetsInsolvency ? '채무 > 재산 충족' : '재산초과 (기각)'}</p>
          </div>
        </div>

        {/* 요건 3 */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${meetsDisposableIncome ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-rose-50/70 border-rose-200 text-rose-800'}`}>
          {meetsDisposableIncome ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <div>
            <p className="font-extrabold">3. 가용소득 투입</p>
            <p className="text-[10px] opacity-80 mt-0.5">{meetsDisposableIncome ? `월 ${formatWon(disposableIncome)}` : '가용소득 부족'}</p>
          </div>
        </div>
      </div>

      {/* ── 미달(Gap) 발생 시 즉시 해결 가이드 배너 ── */}
      {!meetsLiquidationGuarantee && liquidationGap > 0 && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3.5 space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-xs font-black text-rose-900">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>청산가치 보장 요건 미달 해결 가이드 (-{formatWon(liquidationGap)})</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            채무자회생법 제614조 제1항 제4호에 따라 변제금의 현재가치({formatWon(presentValue)})가 청산가치({formatWon(liquidationValue)})보다 적으면 법원에서 <strong>인가가 기각</strong>됩니다.
          </p>
          
          <div className="flex flex-wrap gap-2 pt-1">
            {deficitMonthlyPayment > 0 && (
              <button
                onClick={() => onAdjustPlan?.(repaymentMonths, requiredMonthlyPayment)}
                className="bg-white border border-rose-300 text-rose-800 hover:bg-rose-100/80 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                월 변제금 +{formatWon(deficitMonthlyPayment)} 인상 ({formatWon(requiredMonthlyPayment)}으로 조정)
              </button>
            )}
            {repaymentMonths < 60 && (
              <button
                onClick={() => onAdjustPlan?.(repaymentMonths === 36 ? 48 : 60, monthlyPayment)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
              >
                변제기간 {repaymentMonths}개월 → {repaymentMonths === 36 ? '48' : '60'}개월로 연장하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
