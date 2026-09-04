import React from 'react';
import { Shield, CheckCircle2, TrendingDown, Info, HelpCircle } from 'lucide-react';
import { AssetSummary } from '../../../engines/factEngine';

interface ExemptAssetBasketProps {
  assetsSummary?: AssetSummary;
  rawAssets?: any[];
  className?: string;
}

/** 금액 포맷 */
function fmt(val: number): string {
  if (!val && val !== 0) return '0원';
  if (val >= 100000000) return `${(val / 100000000).toFixed(1)}억 원`;
  if (val >= 10000) return `${Math.round(val / 10000).toLocaleString()}만 원`;
  return `${val.toLocaleString()}원`;
}

export default function ExemptAssetBasket({
  assetsSummary,
  rawAssets = [],
  className = ''
}: ExemptAssetBasketProps) {
  if (!assetsSummary) return null;

  const {
    totalMarketValue = 0,
    exemptDepositTotal = 0,
    exemptInsuranceTotal = 0,
    exemptHousingDeposit = 0,
    totalExemptDeductions = 0,
    effectiveLiquidationValue = 0
  } = assetsSummary;

  // 절감 비율 계산
  const savingRate = totalMarketValue > 0 ? Math.round((totalExemptDeductions / totalMarketValue) * 100) : 0;

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 ${className}`}>
      {/* ── 헤더: 타이틀 및 절감 요약 뱃지 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
              <span>민사집행법 제246조 압류금지채권 공제</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                법정 공제 바스켓
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              예금 185만 원, 보험 150만 원, 소액임차보증금을 법정 기준에 따라 청산가치에서 자동 공제합니다.
            </p>
          </div>
        </div>

        {totalExemptDeductions > 0 && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span>청산가치 -{fmt(totalExemptDeductions)} 절감 ({savingRate}% 감액)</span>
          </div>
        )}
      </div>

      {/* ── 3대 바스켓 공제 명세 테이블 ── */}
      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3">공제 바스켓 항목</th>
              <th className="py-2.5 px-3 text-right">법정 공제 기준</th>
              <th className="py-2.5 px-3 text-right text-emerald-700">실제 공제액</th>
              <th className="py-2.5 px-3 text-center">적용 법령</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {/* 1. 예금 185만 원 일괄 공제 */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2.5 px-3 font-bold text-slate-800">
                🏦 예금·적금 바스켓
                <span className="block text-[10px] text-slate-400 font-normal">모든 금융기관 계좌 잔액 합산</span>
              </td>
              <td className="py-2.5 px-3 text-right text-slate-600">최대 185만 원</td>
              <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                {exemptDepositTotal > 0 ? `-${fmt(exemptDepositTotal)}` : '0원'}
              </td>
              <td className="py-2.5 px-3 text-center text-[11px] text-slate-500">민사집행법 §246①(8)</td>
            </tr>

            {/* 2. 보장성 보험 150만 원 한도 공제 */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2.5 px-3 font-bold text-slate-800">
                🛡️ 보장성 보험 해약환급금
                <span className="block text-[10px] text-slate-400 font-normal">보장성 보험에 한함 (저축성 제외)</span>
              </td>
              <td className="py-2.5 px-3 text-right text-slate-600">최대 150만 원</td>
              <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                {exemptInsuranceTotal > 0 ? `-${fmt(exemptInsuranceTotal)}` : '0원'}
              </td>
              <td className="py-2.5 px-3 text-center text-[11px] text-slate-500">동법 시행령 §3</td>
            </tr>

            {/* 3. 소액임차보증금 최우선변제금 */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2.5 px-3 font-bold text-slate-800">
                🏠 주거용 소액임차보증금
                <span className="block text-[10px] text-slate-400 font-normal">지역별 최우선변제금 범위 내</span>
              </td>
              <td className="py-2.5 px-3 text-right text-slate-600">서울 5,500만 / 과밀 4,800만 등</td>
              <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                {exemptHousingDeposit > 0 ? `-${fmt(exemptHousingDeposit)}` : '0원'}
              </td>
              <td className="py-2.5 px-3 text-center text-[11px] text-slate-500">주택임대차보호법 §8</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 최종 청산가치 비교 요약 바 ── */}
      <div className="bg-slate-50 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 border border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-bold">자산 시가 총액:</span>
          <span className="font-extrabold text-slate-800">{fmt(totalMarketValue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-700 font-bold">총 압류금지 공제:</span>
          <span className="font-black text-emerald-600">-{fmt(totalExemptDeductions)}</span>
        </div>
        <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-1 sm:pt-0 sm:pl-3">
          <span className="text-[#1E3A5F] font-bold">최종 순 청산가치:</span>
          <span className="font-black text-sm text-[#1E3A5F] tracking-tight">{fmt(effectiveLiquidationValue)}</span>
        </div>
      </div>
    </div>
  );
}
