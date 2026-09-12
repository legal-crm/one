import React, { useState } from 'react';
import { Copy, ChevronDown, ChevronUp, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerBriefingData } from '../../../types/leadTypes';

interface CaseBriefingBannerProps {
  data: CustomerBriefingData;
  className?: string;
  defaultExpanded?: boolean;
}

export const CaseBriefingBanner: React.FC<CaseBriefingBannerProps> = ({
  data,
  className = '',
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyBriefing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyText = `* 고객이름 : ${data.customerName}
* 연락처 : ${data.phone}
* 출생년도 : ${data.birthYear}
* 성별 : ${data.gender}
* 거주지역 : ${data.region}
* 직업 : ${data.job}
* 4대보험 가입유무 : ${data.insurance4}
* 결혼유무 : ${data.maritalStatus}
* 미성년 자녀 수 : ${data.childrenCount}
* 월 세후소득 (실급여) : ${data.income}
* 월 대출납입금 : ${data.loanMonthlyPay}
* 거주 형태 : ${data.housingType}
* 보증금, 월세 : ${data.depositRent}
* 자산 : ${data.assets}
* 신용 대출 : ${data.creditLoan}
* 담보 대출 (차량/집/토지 등) : ${data.collateralLoan}
* 신용카드 사용유무 : ${data.creditCardUse}
* 개인회생 / 파산 / 회복 이력 : ${data.history}
* 특이사항 :
${data.specialMemo || '없음'}`;

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    toast.success('고객 브리핑이 클립보드에 복사되었습니다. (카톡/메신저 보고용)');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-slate-900 text-slate-100 rounded-2xl border border-slate-700/80 shadow-md overflow-hidden transition-all ${className}`}>
      {/* Header Toolbar (Executive Dark Navy) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none gap-2 hover:bg-slate-950 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
          <span className="font-bold text-white text-sm flex items-center gap-1.5">
            📋 고객 종합 브리핑
            <span className="text-xs font-normal text-slate-400">(상황 및 채무 요약)</span>
          </span>

          {data.isAiSource ? (
            <span className="bg-purple-950/80 text-purple-300 border border-purple-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={11} className="text-purple-400" />
              AI 분석 기반
            </span>
          ) : (
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <FileText size={11} className="text-slate-400" />
              CRM 데이터 기반
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyBriefing}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer press-scale active:scale-[0.98] ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
            }`}
            title="브리핑 전체 텍스트 복사"
          >
            {copied ? <CheckCircle2 size={13} className="text-white" /> : <Copy size={13} className="text-slate-300" />}
            <span>{copied ? '복사 완료' : '브리핑 복사'}</span>
          </button>

          <button
            type="button"
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded 2-Column Content */}
      {isExpanded && (
        <div className="p-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 좌측: 인적 / 직업 / 소득 / 주거 */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
              <p className="font-extrabold text-indigo-400 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2">
                👤 인적사항 및 소득·주거
              </p>
              <div className="grid grid-cols-2 gap-y-1.5 text-slate-300">
                <div><span className="text-slate-500">고객명:</span> <strong className="text-white">{data.customerName}</strong></div>
                <div><span className="text-slate-500">연락처:</span> <strong className="text-white">{data.phone}</strong></div>
                <div><span className="text-slate-500">나이/성별:</span> {data.birthYear} · {data.gender}</div>
                <div><span className="text-slate-500">거주지:</span> {data.region}</div>
                <div><span className="text-slate-500">직업(4대보험):</span> {data.job} ({data.insurance4})</div>
                <div><span className="text-slate-500">혼인/자녀:</span> {data.maritalStatus} · 자녀 {data.childrenCount}</div>
                <div><span className="text-slate-500">월 실급여:</span> <strong className="text-emerald-400">{data.income}</strong></div>
                <div><span className="text-slate-500">월 대출상환:</span> <strong className="text-rose-400">{data.loanMonthlyPay}</strong></div>
                <div className="col-span-2"><span className="text-slate-500">주거:</span> {data.housingType} ({data.depositRent})</div>
              </div>
            </div>

            {/* 우측: 채무 / 자산 / 과거이력 */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
              <p className="font-extrabold text-rose-400 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2">
                💳 채무·대출 및 자산·이력
              </p>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">총 채무액:</span>
                  <strong className="text-rose-400 text-sm font-black">{data.creditLoan}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">담보대출:</span>
                  <span>{data.collateralLoan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">신용카드 사용:</span>
                  <span className="font-bold text-amber-300">{data.creditCardUse}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">보유 자산:</span>
                  <span className="text-right">{data.assets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">과거 조정이력:</span>
                  <span className="text-right">{data.history}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 하단: 특이사항 메모 */}
          {data.specialMemo && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-slate-300">
              <span className="text-slate-500 font-bold block mb-1">💬 상담 특이사항 및 메모:</span>
              <p className="whitespace-pre-wrap leading-relaxed">{data.specialMemo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseBriefingBanner;
