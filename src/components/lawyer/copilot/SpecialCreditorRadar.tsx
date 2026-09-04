import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, RefreshCw, Users, FileText, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { SpecialDebtItem } from '../../../engines/factEngine';

interface SpecialCreditorRadarProps {
  specialDebts?: SpecialDebtItem[];
  rawDebts?: any[];
  className?: string;
}

function fmt(val: number): string {
  if (!val && val !== 0) return '0원';
  if (val >= 100000000) return `${(val / 100000000).toFixed(1)}억 원`;
  if (val >= 10000) return `${Math.round(val / 10000).toLocaleString()}만 원`;
  return `${val.toLocaleString()}원`;
}

export default function SpecialCreditorRadar({
  specialDebts = [],
  rawDebts = [],
  className = ''
}: SpecialCreditorRadarProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!specialDebts || specialDebts.length === 0) {
    return null; // 특수 채권이 감지되지 않으면 미노출
  }

  const fraudDebts = specialDebts.filter(d => d.riskType === 'FRAUD_RISK');
  const taxDebts = specialDebts.filter(d => d.riskType === 'TAX_PRIORITY');
  const transferredDebts = specialDebts.filter(d => d.riskType === 'TRANSFERRED');

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 ${className}`}>
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
              <span>특수 채권 관리 레이더</span>
              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                {specialDebts.length}건 감지
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              사기죄 고소 위험 채권, 세금 우선변제 채무, 양도/대위변제 채권을 정밀 추적합니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 채권 위험도 카드 목록 ── */}
      <div className="space-y-2.5">
        {specialDebts.map((debt, idx) => {
          const isExpanded = expandedIndex === idx;
          const isFraud = debt.riskType === 'FRAUD_RISK';
          const isTax = debt.riskType === 'TAX_PRIORITY';
          const isTransferred = debt.riskType === 'TRANSFERRED';

          const cardStyle = isFraud
            ? 'border-rose-200 bg-rose-50/40 text-rose-900'
            : isTax
            ? 'border-amber-200 bg-amber-50/40 text-amber-900'
            : 'border-blue-200 bg-blue-50/40 text-blue-900';

          const badgeStyle = isFraud
            ? 'bg-rose-100 text-rose-800 border-rose-200'
            : isTax
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-blue-100 text-blue-800 border-blue-200';

          const badgeLabel = isFraud ? '🚨 사기 고소 주의' : isTax ? '⚖️ 세금 우선변제' : '🔄 채권양도/추심';

          return (
            <div
              key={idx}
              className={`rounded-xl border p-3.5 transition-all text-left space-y-2 ${cardStyle}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                      {badgeLabel}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">{debt.creditor}</span>
                    <span className="text-xs font-black text-slate-700">({fmt(debt.principal)})</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-snug">{debt.reason}</p>
                </div>

                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer shrink-0"
                  title="대응 가이드 보기"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* 상세 대응 가이드 토글 */}
              {isExpanded && (
                <div className="bg-white rounded-xl p-3 border border-slate-200/80 text-xs space-y-1.5 mt-2 animate-fadeIn text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>법률사무소 대응 가이드:</span>
                  </div>
                  <p className="leading-relaxed pl-5 text-slate-600">
                    {debt.recommendedAction}
                  </p>
                  {isFraud && (
                    <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-100 text-[11px] text-rose-800 mt-1 leading-relaxed">
                      💡 <strong>실무 팁:</strong> 대출 실행일 직전·직후의 계좌 거래내역을 확인하여 도박이나 편취가 아닌 실제 생활비, 병원비, 채무변제 돌려막기로 소비되었음을 입증하는 소명서를 미리 작성해 두면 사기죄 불송치(무혐의) 처분을 유도할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
