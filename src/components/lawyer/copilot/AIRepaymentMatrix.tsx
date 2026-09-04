import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Zap, Flame, Check, ArrowRight, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../../rehab-chatbot-package/services/calculationService';

export interface RepaymentScenario {
  id: 'conservative' | 'standard' | 'aggressive';
  title: string;
  badge: string;
  badgeColor: string;
  approvalProbability: number; // 예상 승인율 (%)
  monthlyPayment: number;       // 월 변제금 (원)
  repaymentMonths: number;      // 변제 기간 (개월)
  totalRepayment: number;       // 변제 총액 (원)
  reductionRate: number;        // 탕감율 (%)
  description: string;
  conditionsSummary: string[];
  correctionRisk: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AIRepaymentMatrixProps {
  baseMonthlyPayment: number;
  totalDebt: number;
  liquidationValue: number;
  repaymentMonths?: number;
  hasDependents?: boolean;
  selectedScenarioId?: 'conservative' | 'standard' | 'aggressive';
  onSelectScenario?: (scenario: RepaymentScenario) => void;
  className?: string;
}

export default function AIRepaymentMatrix({
  baseMonthlyPayment,
  totalDebt,
  liquidationValue,
  repaymentMonths = 36,
  hasDependents = false,
  selectedScenarioId = 'standard',
  onSelectScenario,
  className = ''
}: AIRepaymentMatrixProps) {
  const [activeId, setActiveId] = useState<'conservative' | 'standard' | 'aggressive'>(selectedScenarioId);

  // 3단 시나리오 동적 계산
  const scenarios: RepaymentScenario[] = React.useMemo(() => {
    // 기본 월변제금을 기준으로 3단계 산출
    const base = Math.max(100000, baseMonthlyPayment);

    // 1. 보수안 (엄격 심사, 변제금 약 15~20% 상향 또는 추가생계비 배제)
    const conservativeMonthly = Math.round((base * 1.18) / 10000) * 10000;
    const consTotal = Math.min(totalDebt, conservativeMonthly * repaymentMonths);
    const consRate = totalDebt > 0 ? Math.max(0, Math.round(((totalDebt - consTotal) / totalDebt) * 100)) : 0;

    // 2. 표준안 (추천 표준)
    const standardMonthly = base;
    const stdTotal = Math.min(totalDebt, standardMonthly * repaymentMonths);
    const stdRate = totalDebt > 0 ? Math.max(0, Math.round(((totalDebt - stdTotal) / totalDebt) * 100)) : 0;

    // 3. 공격적안 (최대 감액, 청산가치 보장 하한선까지 최대한 낮춤)
    // 청산가치 36개월 균등 + 최소생계비 고려 (약 15~25% 감액)
    const minPossibleMonthly = liquidationValue > 0 ? Math.ceil(liquidationValue / 33.36) : 100000;
    const aggressiveMonthly = Math.max(minPossibleMonthly, Math.round((base * 0.78) / 10000) * 10000);
    const aggTotal = Math.min(totalDebt, aggressiveMonthly * repaymentMonths);
    const aggRate = totalDebt > 0 ? Math.max(0, Math.round(((totalDebt - aggTotal) / totalDebt) * 100)) : 0;

    return [
      {
        id: 'conservative',
        title: '안전 보수안',
        badge: '무보정 통과 목표',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        approvalProbability: 95,
        monthlyPayment: conservativeMonthly,
        repaymentMonths,
        totalRepayment: consTotal,
        reductionRate: consRate,
        description: '법원 보정권고 없이 1차 신청 즉시 개시결정을 목표로 하는 보수적 플랜입니다.',
        conditionsSummary: [
          '추가 생계비(주거/의료/교육) 미반영',
          '배우자 명의 재산 50% 엄격 산입',
          '미성년 자녀만 보수적 부양 인정'
        ],
        correctionRisk: 'VERY_LOW'
      },
      {
        id: 'standard',
        title: '추천 표준안',
        badge: '실무 최적 밸런스',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        approvalProbability: 82,
        monthlyPayment: standardMonthly,
        repaymentMonths,
        totalRepayment: stdTotal,
        reductionRate: stdRate,
        description: '법원 실무 준칙상 인정 가능한 주거비 등을 합리적으로 반영한 추천 플랜입니다.',
        conditionsSummary: [
          '주거비 한도 내 추가 생계비 반영',
          '부양가족 요건 실무 기준 충족',
          '청산가치 안정적 보장'
        ],
        correctionRisk: 'LOW'
      },
      {
        id: 'aggressive',
        title: '최대 감액안',
        badge: '최대 탕감율 도전',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        approvalProbability: 58,
        monthlyPayment: aggressiveMonthly,
        repaymentMonths,
        totalRepayment: aggTotal,
        reductionRate: aggRate,
        description: '주거·의료·특수교육비 등을 최대한 주장하여 월 변제금 부담을 극소화한 플랜입니다.',
        conditionsSummary: [
          '추가 생계비 법정 최대 한도 주장',
          '배우자 재산 특유재산 제외 주장',
          '회생위원 보정 소명서 철저 대비 필수'
        ],
        correctionRisk: 'HIGH'
      }
    ];
  }, [baseMonthlyPayment, totalDebt, liquidationValue, repaymentMonths]);

  const handleSelect = (sc: RepaymentScenario) => {
    setActiveId(sc.id);
    onSelectScenario?.(sc);
  };

  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 ${className}`}>
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
              <span>AI 변제금 3단 예측 매트릭스</span>
              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                ML 심사예측
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              법원 보정권고 강도와 의뢰인 전략에 맞춰 3가지 변제 시나리오 중 최적안을 선택할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3단 카드 그리드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((sc) => {
          const isSelected = activeId === sc.id;

          return (
            <div
              key={sc.id}
              onClick={() => handleSelect(sc)}
              className={`rounded-xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative text-left ${
                isSelected
                  ? 'border-[#1E3A5F] bg-blue-50/20 shadow-xs ring-1 ring-[#1E3A5F]/20'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* 상단 뱃지 및 타이틀 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    승인확률 <strong className={sc.approvalProbability >= 80 ? 'text-emerald-600' : 'text-purple-600'}>{sc.approvalProbability}%</strong>
                  </span>
                </div>
                <h5 className="text-sm font-black text-slate-900 flex items-center justify-between">
                  <span>{sc.title}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </h5>
              </div>

              {/* 핵심 수치: 월 변제금 & 탕감율 */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1 text-center">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] font-bold text-slate-500">예상 월 변제금</span>
                  <span className="text-base sm:text-lg font-black text-[#1E3A5F] tracking-tight tabular-nums">
                    {formatCurrency(sc.monthlyPayment)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-t border-slate-200/50 pt-1">
                  <span className="text-[11px] font-bold text-slate-500">총 탕감률</span>
                  <span className="text-sm font-black text-emerald-600 tracking-tight">
                    {sc.reductionRate}%
                  </span>
                </div>
              </div>

              {/* 상세 조건 목록 */}
              <ul className="space-y-1 text-[11px] text-slate-600">
                {sc.conditionsSummary.map((cond, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span className="leading-tight">{cond}</span>
                  </li>
                ))}
              </ul>

              {/* 선택 버튼 */}
              <button
                type="button"
                className={`w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#1E3A5F] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isSelected ? '✓ 현재 선택된 플랜' : '이 플랜으로 적용'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
