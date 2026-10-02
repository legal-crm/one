import React from 'react';
import { Scale, Info, Building2 } from 'lucide-react';
import { getCourtStats, COURT_STATS_UNAVAILABLE_NOTICE } from '../../../constants/courtStatistics';

interface CourtStatsRadarProps {
  residenceAddress: string;
  workLocation?: string;
  selectedCourtName: string;
  className?: string;
}

/**
 * 관할 법원 정보 카드
 * 이전: 근거 없는 법원별 인용률·변제율·소요기간 게이지와 "접수를 강력 권고" 비교 배너를 표시.
 * 또한 직장 '주소'를 법원명으로 취급해 항상 관할 경합으로 판정했다.
 * 현재: 법원명·회생전문법원 여부·거주지/직장 정보만 표시하고, 관할 선택은 변호사가 판단하도록 안내한다.
 */
export default function CourtStatsRadar({
  residenceAddress,
  workLocation,
  selectedCourtName,
  className = ''
}: CourtStatsRadarProps) {
  const court = getCourtStats(selectedCourtName);
  const hasWorkLocation = !!workLocation && workLocation.trim() !== '' && workLocation !== residenceAddress;

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#1E3A5F] flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{court.courtName || '관할 법원 미입력'}</h4>
            {court.courtName && (court.isSpecialized ? (
              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black px-2 py-0.5 rounded-full">
                회생법원
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                지방법원
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            거주지: <span className="font-medium text-slate-700">{residenceAddress || '미입력'}</span>
            {workLocation && <> | 직장: <span className="font-medium text-slate-700">{workLocation}</span></>}
          </p>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{COURT_STATS_UNAVAILABLE_NOTICE}</span>
      </p>

      {hasWorkLocation && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
          <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            거주지와 직장 소재지가 다릅니다. 직장 소재지 관할 법원 신청이 가능한지 검토하세요.
          </span>
        </div>
      )}
    </div>
  );
}
