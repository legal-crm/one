/**
 * MoneyTrailTimeline — v2.0 대출금 사용처 역추적 시각화
 * 
 * 대출 입금 → D+7일 이내 출금 체인을 타임라인 형태로 시각화합니다.
 * riskDetectionService의 buildMoneyTrailReport() 결과를 받아 렌더링합니다.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, ArrowRight, TrendingDown, DollarSign } from 'lucide-react';
import type { MoneyTrailReport, MoneyTrailChain, MoneyTrailEvent } from '../../services/riskDetectionService';

interface MoneyTrailTimelineProps {
  report: MoneyTrailReport;
}

const EVENT_STYLES: Record<MoneyTrailEvent['type'], { bg: string; border: string; text: string; dot: string }> = {
  LOAN_DEPOSIT: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500' },
  OUTFLOW_SAFE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  OUTFLOW_CAUTION: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  OUTFLOW_DANGER: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' },
};

function ChainCard({ chain, index }: { chain: MoneyTrailChain; index: number }) {
  const [isOpen, setIsOpen] = useState(chain.riskLevel === 'HIGH');

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      chain.riskLevel === 'HIGH' ? 'border-rose-300 shadow-sm' :
      chain.riskLevel === 'MEDIUM' ? 'border-amber-200' : 'border-slate-200'
    }`}>
      {/* 체인 헤더 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${
            chain.riskLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' :
            chain.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {index + 1}
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              {chain.loanDeposit.counterparty} — {chain.loanDeposit.amount.toLocaleString()}원
            </p>
            <p className="text-[11px] text-slate-500">
              {chain.loanDeposit.date} · 추적 출금 {chain.outflows.length}건 · 
              추적률 {chain.coverageRate}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {chain.dangerOutflowCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              ⚠️ 위험 {chain.dangerOutflowCount}건
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* 타임라인 상세 */}
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
          {/* 대출 입금 이벤트 */}
          <div className="relative pl-6 pb-3">
            <div className={`absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full ${EVENT_STYLES.LOAN_DEPOSIT.dot} ring-2 ring-white`} />
            <div className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200" />
            <div className={`${EVENT_STYLES.LOAN_DEPOSIT.bg} ${EVENT_STYLES.LOAN_DEPOSIT.border} border rounded-xl px-3 py-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${EVENT_STYLES.LOAN_DEPOSIT.text}`}>
                  💰 대출 입금
                </span>
                <span className="text-[11px] text-slate-500">{chain.loanDeposit.date}</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {chain.loanDeposit.counterparty} — +{chain.loanDeposit.amount.toLocaleString()}원
              </p>
            </div>
          </div>

          {/* D+7일 이내 출금 이벤트들 */}
          {chain.outflows.map((event, eIdx) => {
            const style = EVENT_STYLES[event.type];
            const isLast = eIdx === chain.outflows.length - 1;
            return (
              <div key={event.id} className="relative pl-6 pb-3">
                <div className={`absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full ${style.dot} ring-2 ring-white`} />
                {!isLast && <div className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200" />}
                <div className={`${style.bg} ${style.border} border rounded-xl px-3 py-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${style.text}`}>
                      {event.type === 'OUTFLOW_DANGER' ? '🔴 위험 출금' :
                       event.type === 'OUTFLOW_CAUTION' ? '⚠️ 주의 출금' : '✅ 일반 출금'}
                    </span>
                    <span className="text-[11px] text-slate-500">{event.date}</span>
                  </div>
                  <p className="text-xs text-slate-800 mt-0.5">
                    {event.counterparty} — -{event.amount.toLocaleString()}원
                  </p>
                </div>
              </div>
            );
          })}

          {/* 추적률 요약 바 */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-500">자금 추적률</span>
              <span className="font-bold text-slate-700">{chain.coverageRate}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  chain.coverageRate >= 80 ? 'bg-emerald-500' :
                  chain.coverageRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, chain.coverageRate)}%` }}
              />
            </div>
            {chain.coverageRate < 80 && (
              <p className="text-[10px] text-amber-600 mt-1">
                ⚠️ 미추적 잔여 자금 {(chain.totalLoanAmount - chain.totalOutflowAmount).toLocaleString()}원 — 추가 소명 필요
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoneyTrailTimeline({ report }: MoneyTrailTimelineProps) {
  if (!report || report.chains.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 헤더 요약 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">
            대출금 사용처 역추적 (Money Trail)
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">
            대출 {report.totalLoanDeposits}건 · 총 {report.totalLoanAmount.toLocaleString()}원
          </span>
          {report.hasHighRisk && (
            <span className="font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              🔴 고위험 체인 포함
            </span>
          )}
        </div>
      </div>

      {/* 체인 카드 목록 */}
      <div className="space-y-2">
        {report.chains.map((chain, idx) => (
          <ChainCard key={chain.id} chain={chain} index={idx} />
        ))}
      </div>
    </div>
  );
}
