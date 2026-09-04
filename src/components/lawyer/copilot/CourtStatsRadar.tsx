import React, { useState } from 'react';
import { Scale, TrendingUp, Clock, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, Building2 } from 'lucide-react';
import { getCourtStats, compareJurisdictions, JurisdictionComparisonResult } from '../../../constants/courtStatistics';

interface CourtStatsRadarProps {
  residenceAddress: string;
  workLocation?: string;
  selectedCourtName: string;
  className?: string;
}

export default function CourtStatsRadar({
  residenceAddress,
  workLocation,
  selectedCourtName,
  className = ''
}: CourtStatsRadarProps) {
  // 관할 경합 비교 계산
  const comparison = React.useMemo<JurisdictionComparisonResult>(() => {
    return compareJurisdictions(selectedCourtName, workLocation);
  }, [selectedCourtName, workLocation]);

  const [showFullComparison, setShowFullComparison] = useState(false);
  const currentStats = getCourtStats(selectedCourtName);

  // 속도 뱃지 스타일
  const getSpeedBadge = (rating: string) => {
    switch (rating) {
      case 'VERY_FAST': return { label: '초고속 (2개월대)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'FAST': return { label: '신속 (3개월대)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'NORMAL': return { label: '보통 (4~5개월)', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'SLOW': return { label: '다소 지연 (6~7개월)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'VERY_SLOW': return { label: '매우 지연 (9개월+)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default: return { label: '보통', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const speedInfo = getSpeedBadge(currentStats.speedRating);

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}>
      {/* ── 헤더: 관할 법원 정보 & 특성 뱃지 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#1E3A5F] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{currentStats.courtName}</h4>
              {currentStats.isSpecialized ? (
                <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                  회생전문법원
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  일반 지방법원
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              거주지: <span className="font-medium text-slate-700">{residenceAddress || '미입력'}</span>
              {workLocation && <> | 직장: <span className="font-medium text-slate-700">{workLocation}</span></>}
            </p>
          </div>
        </div>

        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border self-start sm:self-auto ${speedInfo.color}`}>
          {speedInfo.label}
        </span>
      </div>

      {/* ── 3대 핵심 실무 통계 지표 그리드 ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        {/* 1. 금지명령 인용률 */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 block">금지명령 인용률</span>
          <div className="flex items-baseline justify-center gap-0.5">
            <span className={`text-lg sm:text-xl font-black tracking-tight ${currentStats.injunctionRate >= 90 ? 'text-emerald-600' : currentStats.injunctionRate >= 80 ? 'text-[#1E3A5F]' : 'text-amber-600'}`}>
              {currentStats.injunctionRate}%
            </span>
          </div>
          {/* 간이 미니 게이지 바 */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${currentStats.injunctionRate >= 90 ? 'bg-emerald-500' : currentStats.injunctionRate >= 80 ? 'bg-indigo-600' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, currentStats.injunctionRate)}%` }}
            />
          </div>
        </div>

        {/* 2. 평균 변제율 */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 block">평균 변제율</span>
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
              {currentStats.avgRepaymentRate}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">원금 대비 변제율</span>
        </div>

        {/* 3. 개시 소요기간 */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 block">개시결정 소요</span>
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-lg sm:text-xl font-black tracking-tight text-[#1E3A5F]">
              {currentStats.avgProcessingMonths}
            </span>
            <span className="text-xs text-slate-600 font-bold">개월</span>
          </div>
          <span className="text-[10px] text-slate-400 block">접수 후 개시까지</span>
        </div>
      </div>

      {/* ── 법원별 실무 특례 태그 ── */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {currentStats.cryptoStockExempt && (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 코인/주식 손실금 청산가치 제외
          </span>
        )}
        {currentStats.spousePropertyExempt && (
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 배우자 명의 재산 0% 반영
          </span>
        )}
        {currentStats.features.map((feat, idx) => (
          <span key={idx} className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
            {feat}
          </span>
        ))}
      </div>

      {/* ── 킬러 기능: 거주지 vs 직장 관할 유불리 1:1 비교 배너 ── */}
      {comparison.hasConflict && (
        <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-blue-900">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>관할 경합 분석 (거주지 vs 직장 소재지)</span>
            </div>
            <button
              onClick={() => setShowFullComparison(!showFullComparison)}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline active:scale-[0.98] transition-all cursor-pointer"
            >
              {showFullComparison ? '간략히' : '1:1 비교표'}
            </button>
          </div>

          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            {comparison.recommendationMessage}
          </p>

          {/* 확장 1:1 비교 테이블 */}
          {showFullComparison && (
            <div className="bg-white rounded-xl border border-blue-200/60 overflow-hidden text-xs mt-2 animate-fadeIn">
              <div className="grid grid-cols-3 bg-slate-50 p-2 font-bold text-slate-600 border-b border-slate-100 text-center">
                <span>비교 항목</span>
                <span className="text-slate-800">거주지: {comparison.residenceCourt.courtName}</span>
                <span className="text-blue-700 font-black">직장: {comparison.workplaceCourt.courtName}</span>
              </div>
              <div className="divide-y divide-slate-100 text-center">
                <div className="grid grid-cols-3 p-2">
                  <span className="font-bold text-slate-500">금지명령 인용률</span>
                  <span className="font-semibold text-slate-700">{comparison.residenceCourt.injunctionRate}%</span>
                  <span className="font-black text-blue-700">{comparison.workplaceCourt.injunctionRate}%</span>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <span className="font-bold text-slate-500">평균 개시 소요기간</span>
                  <span className="font-semibold text-slate-700">{comparison.residenceCourt.avgProcessingMonths}개월</span>
                  <span className="font-black text-blue-700">{comparison.workplaceCourt.avgProcessingMonths}개월</span>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <span className="font-bold text-slate-500">주식·코인 손실금 제외</span>
                  <span className="font-semibold text-slate-700">{comparison.residenceCourt.cryptoStockExempt ? '✅ 적용' : '❌ 불인정'}</span>
                  <span className="font-black text-blue-700">{comparison.workplaceCourt.cryptoStockExempt ? '✅ 적용' : '❌ 불인정'}</span>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <span className="font-bold text-slate-500">배우자 재산 반영</span>
                  <span className="font-semibold text-slate-700">{comparison.residenceCourt.spousePropertyExempt ? '0% (제외)' : '50% (반영)'}</span>
                  <span className="font-black text-blue-700">{comparison.workplaceCourt.spousePropertyExempt ? '0% (제외)' : '50% (반영)'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
