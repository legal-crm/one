import React, { useState } from 'react';
import { Landmark, Car, Home, Layers, ArrowRight, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface CollateralPledgeSectionProps {
  securedDebt: number;                 // 담보부 채무 총액 (원)
  securedDebtCovered: number;          // 담보로 충당되는 유담보 채권 (원)
  pledgedAssetsEstimatedDeficit: number;// 담보 부족으로 남는 무담보 예정부족액 (원)
  rawDebts?: any[];
  rawAssets?: any[];
  className?: string;
}

function fmt(val: number): string {
  if (!val && val !== 0) return '0원';
  if (val >= 100000000) return `${(val / 100000000).toFixed(1)}억 원`;
  if (val >= 10000) return `${Math.round(val / 10000).toLocaleString()}만 원`;
  return `${val.toLocaleString()}원`;
}

export default function CollateralPledgeSection({
  securedDebt = 0,
  securedDebtCovered = 0,
  pledgedAssetsEstimatedDeficit = 0,
  rawDebts = [],
  rawAssets = [],
  className = ''
}: CollateralPledgeSectionProps) {
  const [showTable, setShowTable] = useState(false);

  // 담보 자산 목록 필터 (부동산, 차량)
  const collateralAssets = rawAssets.filter(
    a => a.type === 'realestate' || a.type === 'realestate_general' || a.type === 'vehicle' || a.type === 'business_vehicle'
  );

  // 담보 채무 목록 필터
  const securedDebtList = rawDebts.filter(d => d.type === 'secured');

  if (securedDebt === 0 && collateralAssets.length === 0) {
    return null; // 담보 채무 및 담보 자산이 없으면 미노출
  }

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 ${className}`}>
      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
              <span>별제권(담보부 채권) & 공동담보 정밀 분석</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                부속서류 연동
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              담보물 환가예상액을 기준으로 '유담보 회생채권'과 '무담보 예정부족액'을 자동 분할합니다.
            </p>
          </div>
        </div>

        {collateralAssets.length > 1 && (
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer active:scale-[0.98] self-start sm:self-auto"
          >
            {showTable ? '안분표 접기' : '공동담보 안분표 보기'}
          </button>
        )}
      </div>

      {/* ── 2단 분할 요약 카드: 유담보 vs 무담보 예정부족액 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. 유담보 회생채권 (담보 처분 충당분) */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1 text-left">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              유담보 회생채권 (별제권 충당)
            </span>
            <span className="text-[10px] text-slate-400">담보물 처분 변제</span>
          </div>
          <p className="text-lg font-black text-slate-900 tracking-tight">
            {fmt(securedDebtCovered)}
          </p>
          <p className="text-[11px] text-slate-500 leading-tight">
            부동산/차량의 경매 환가액 범위 내에서 별제권 행사를 통해 우선 변제됩니다.
          </p>
        </div>

        {/* 2. 무담보 회생채권 (예정부족액 - 변제계획안 투입) */}
        <div className={`rounded-xl p-3.5 border space-y-1 text-left ${pledgedAssetsEstimatedDeficit > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={`flex items-center gap-1 ${pledgedAssetsEstimatedDeficit > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              무담보 회생채권 (예정부족액)
            </span>
            <span className="text-[10px] text-amber-700 font-bold">변제계획안 산입</span>
          </div>
          <p className={`text-lg font-black tracking-tight ${pledgedAssetsEstimatedDeficit > 0 ? 'text-amber-900' : 'text-slate-900'}`}>
            {fmt(pledgedAssetsEstimatedDeficit)}
          </p>
          <p className="text-[11px] text-slate-500 leading-tight">
            담보 처분으로 전액 변제되지 못한 잔액은 일반 무담보 채무와 동일하게 <strong>탕감 대상</strong>에 산입됩니다.
          </p>
        </div>
      </div>

      {/* ── 공동담보 가액비율 안분표 (토글) ── */}
      {showTable && collateralAssets.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden text-xs animate-fadeIn text-left">
          <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
            <span>공동담보 목적물별 가액비율 안분 내역서</span>
            <span className="text-[10px] text-slate-500">법원 회생실무준칙 제411호 규격</span>
          </div>
          <div className="p-3 divide-y divide-slate-100">
            {collateralAssets.map((asset, i) => {
              const ratio = Math.round((asset.marketValue / (collateralAssets.reduce((s, a) => s + a.marketValue, 0) || 1)) * 100);
              const allocatedDebt = Math.round(securedDebt * (ratio / 100));

              return (
                <div key={i} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {asset.type.includes('vehicle') ? <Car className="w-4 h-4 text-blue-600" /> : <Home className="w-4 h-4 text-indigo-600" />}
                    <div>
                      <span className="font-bold text-slate-800">{asset.label || asset.name || `목적물 ${i+1}`}</span>
                      <span className="text-[10px] text-slate-400 block">시가: {fmt(asset.marketValue)} (안분비율: {ratio}%)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900">{fmt(allocatedDebt)}</span>
                    <span className="text-[10px] text-slate-500 block">피담보채권 배당액</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
