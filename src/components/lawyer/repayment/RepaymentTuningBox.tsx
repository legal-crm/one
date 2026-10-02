// src/components/lawyer/repayment/RepaymentTuningBox.tsx
// ============================================================
// 변제예정액 산정 실무 튜닝박스 (Tuning Box)
// ※ 6(장래양육비)·7(성년도달 자녀)은 현재 기록용이며 엔진이 월 변제금에 자동 반영하지 않는다.
// 1. 세금 등 우선권 있는 채권 (2단계 분할: 1단계 회차 자동 산정 = 내부 보수 기준 기간 1/2 이내, 직접 조정 가능)
// 2. 별제권부 채권 (담보물 낙찰률 70%/100%/50% 및 예정부족액)
// 3. 압류적립금 처리 (제3채무자 및 1회차 투입/제3채무자 수령)
// 4. 재산처분에 의한 변제 (처분 목표액 배수: 1년 내 1.1배, 2년 내 1.3배 — 시스템 기본값, 관할 실무 확인 필요)
// 5. 원금과 이자 변제 (3대 변제 방식)
// 6. 장래양육비 (양육권자 등록 및 부담조서 확정)
// 7. 변제기 내 성년 도달 부양가족 (1단계/2단계 변제금 스텝업)
// ============================================================

import React, { useState } from 'react';
import { 
  Sliders, ShieldAlert, Landmark, Building2, Coins, 
  AlertTriangle, CheckCircle2, HeartPulse, Users, DollarSign,
  Scale, Sparkles, FileText, Check
} from 'lucide-react';
import type { 
  RepaymentPlanData, 
  RepaymentCreditor,
  GarnishmentDepositInfo,
  PropertyDisposalInfo,
  InterestRepaymentMode,
  ChildSupportInfo,
  AdultChildTransitionInfo
} from '../../../services/repayment/repaymentTypes';

interface RepaymentTuningBoxProps {
  plan: RepaymentPlanData;
  creditors: RepaymentCreditor[];
  totalMonths: number;
  onUpdateMonths: (months: number) => void;
  // 튜닝 상태 변경 콜백들
  isTwoStage: boolean;
  onToggleTwoStage: (val: boolean) => void;
  stage1Months: number;
  onUpdateStage1Months: (months: number) => void;
  // 압류적립금
  garnishment: GarnishmentDepositInfo;
  onUpdateGarnishment: (data: GarnishmentDepositInfo) => void;
  // 재산처분
  propertyDisposal: PropertyDisposalInfo;
  onUpdatePropertyDisposal: (data: PropertyDisposalInfo) => void;
  // 원리금 변제
  interestMode: InterestRepaymentMode;
  onUpdateInterestMode: (mode: InterestRepaymentMode) => void;
  // 장래양육비
  childSupport: ChildSupportInfo;
  onUpdateChildSupport: (data: ChildSupportInfo) => void;
  // 성년도달
  adultChild: AdultChildTransitionInfo;
  onUpdateAdultChild: (data: AdultChildTransitionInfo) => void;

  // ── 원금 조기완제형 · 변제율 표기 · 압류적립금 튜닝 props ──
  isSeoulPrincipalOnly?: boolean;
  onToggleSeoulPrincipalOnly?: (val: boolean) => void;
  garnishmentDepositFirstRound?: number;
  onUpdateGarnishmentDepositFirstRound?: (amt: number) => void;
  decimalRepaymentRate?: boolean;
  onToggleDecimalRepaymentRate?: (val: boolean) => void;
  overrideMonthlyRepayment?: number;
  onUpdateOverrideMonthlyRepayment?: (amt: number | undefined) => void;
  adjusterMemo?: string;
  onUpdateAdjusterMemo?: (memo: string) => void;
  // v2.0: 외부회생위원 보수 선택
  trusteeType?: 'INTERNAL' | 'EXTERNAL';
  onUpdateTrusteeType?: (type: 'INTERNAL' | 'EXTERNAL') => void;
}

export default function RepaymentTuningBox({
  plan,
  creditors,
  totalMonths,
  onUpdateMonths,
  isTwoStage,
  onToggleTwoStage,
  stage1Months,
  onUpdateStage1Months,
  garnishment,
  onUpdateGarnishment,
  propertyDisposal,
  onUpdatePropertyDisposal,
  interestMode,
  onUpdateInterestMode,
  childSupport,
  onUpdateChildSupport,
  adultChild,
  onUpdateAdultChild,
  isSeoulPrincipalOnly = false,
  onToggleSeoulPrincipalOnly,
  garnishmentDepositFirstRound = 0,
  onUpdateGarnishmentDepositFirstRound,
  decimalRepaymentRate = false,
  onToggleDecimalRepaymentRate,
  overrideMonthlyRepayment,
  onUpdateOverrideMonthlyRepayment,
  adjusterMemo = '',
  onUpdateAdjusterMemo,
  trusteeType = 'INTERNAL',
  onUpdateTrusteeType,
}: RepaymentTuningBoxProps) {
  const [activeTab, setActiveTab] = useState<
    'priority' | 'secured' | 'garnishment' | 'disposal' | 'interest' | 'child_support' | 'adult_child' | 'seoul_principal' | 'correction' | 'trustee'
  >('priority');

  const priorityCreditors = creditors.filter(c => c.isPriority && !c.isSecured);
  const totalPriorityDebt = priorityCreditors.reduce((s, c) => s + c.principal, 0);
  const securedCreditors = creditors.filter(c => c.isSecured);
  const totalPrincipal = plan.totalPrincipal;
  const totalInterest = plan.totalInterest;

  // 원금 조기완제형: 현재 월 변제금으로 36개월 내 원금 완제 가능 여부
  const monthsToPayoff = plan.monthlyRepaymentTotal > 0
    ? Math.ceil(totalPrincipal / plan.monthlyRepaymentTotal)
    : 999;
  const canSeoulPrincipalOnly = monthsToPayoff <= 36;
  const shortenedMonths = Math.max(0, 36 - monthsToPayoff);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-md">
      {/* 상단 헤더 & 튜닝 안내 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              실무 튜닝박스 (Tuning Box)
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30">
                10개 실무 옵션
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              원금 조기완제형, 보정권고 오버라이드, 세금 우선권, 담보부족액, 압류적립금 등을 조정합니다. 적용 전 관할 법원 실무를 확인하세요.
            </p>
          </div>
        </div>

        {/* 변제기간(36/60) 퀵 스위처 */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <span className="text-xs font-bold text-slate-400 px-1.5">총 변제기간</span>
          <button
            type="button"
            onClick={() => onUpdateMonths(36)}
            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
              totalMonths === 36 ? 'bg-brand text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            36개월 (원칙)
          </button>
          <button
            type="button"
            onClick={() => onUpdateMonths(60)}
            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
              totalMonths === 60 ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            60개월 (연장)
          </button>
        </div>
      </div>

      {/* 9대 탭 네비게이션 버튼 (가로 스크롤 대응) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none border-b border-slate-800/80">
        {/* 원금 조기완제형 탭 */}
        <button
          type="button"
          onClick={() => setActiveTab('seoul_principal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'seoul_principal'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-emerald-300" />
          <span>원금 조기완제형</span>
          {isSeoulPrincipalOnly && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        </button>

        {/* 보정권고 정밀튜닝 탭 (신규) */}
        <button
          type="button"
          onClick={() => setActiveTab('correction')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'correction'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-300" />
          <span>보정권고 튜닝</span>
          {(overrideMonthlyRepayment !== undefined || garnishmentDepositFirstRound > 0) && (
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
          )}
        </button>

        {/* v2.0: 외부회생위원 보수 탭 */}
        <button
          type="button"
          onClick={() => setActiveTab('trustee')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'trustee'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-cyan-300" />
          <span>회생위원 보수</span>
          {trusteeType === 'EXTERNAL' && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('priority')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'priority'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>우선권 채권(세금)</span>
          {totalPriorityDebt > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('secured')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'secured'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>별제권부 채권</span>
          {securedCreditors.length > 0 && (
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
              {securedCreditors.length}건
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('garnishment')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'garnishment'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>압류적립금 처리</span>
          {garnishment.isExecuted && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disposal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'disposal'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>재산처분 변제(D5111)</span>
          {propertyDisposal.isExecuted && <span className="w-2 h-2 rounded-full bg-purple-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('interest')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'interest'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>원금과 이자 변제</span>
          <span className="text-xs text-slate-400">
            {interestMode === 'principal_only' ? '원금만' : interestMode === 'principal_then_interest' ? '이자후변제' : '동시안분'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('child_support')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'child_support'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" />
          <span>장래양육비</span>
          {childSupport.isExecuted && <span className="w-2 h-2 rounded-full bg-rose-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adult_child')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'adult_child'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>성년도달 부양가족</span>
          {adultChild.isExecuted && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </button>
      </div>

      {/* ── 탭별 상세 제어 패널 ── */}
      <div className="pt-3">
        {/* [신규 1] 원금 조기완제형 */}
        {activeTab === 'seoul_principal' && (
          <div className="space-y-3 animate-fadeIn text-xs">
            <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">
                    원금 조기완제형 (이자 제외 · 기간 단축)
                  </span>
                  <span className="text-xs text-emerald-300 font-mono">
                    제422조 준용 특례
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSeoulPrincipalOnly}
                    onChange={(e) => onToggleSeoulPrincipalOnly?.(e.target.checked)}
                    disabled={!canSeoulPrincipalOnly && !isSeoulPrincipalOnly}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-white">원금형 변제계획 적용</span>
                </label>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                가용소득으로 36개월 이내에 원금을 100% 변제할 수 있는 경우, 남은 기간 이자를 변제하지 않고{' '}
                <strong className="text-emerald-400 font-bold">원금 완제 시점에서 변제기간을 즉시 종료(단축)</strong>하고 이자는 전액 면책합니다.
              </p>
            </div>

            {/* 실시간 시뮬레이션 지표 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400 block">총 원금 채무</span>
                <span className="font-black text-white font-mono text-sm">{totalPrincipal.toLocaleString()}원</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400 block">월 가용소득</span>
                <span className="font-black text-emerald-400 font-mono text-sm">{plan.monthlyRepaymentTotal.toLocaleString()}원</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400 block">원금 100% 완제 회차</span>
                <span className="font-black text-amber-300 font-mono text-sm">{monthsToPayoff <= 60 ? `${monthsToPayoff}회차` : '60회 초과'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400 block">단축 가능 기간</span>
                <span className="font-black text-blue-300 font-mono text-sm">
                  {shortenedMonths > 0 ? `-${shortenedMonths}개월 단축` : '단축 불가'}
                </span>
              </div>
            </div>

            {/* 상태별 상세 가이드 */}
            {canSeoulPrincipalOnly ? (
              <div className="p-3 rounded-xl bg-slate-800/40 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-white">36개월 내 원금 완제 가능</div>
                  <p className="text-xs text-slate-300 leading-normal">
                    현재 월 가용소득으로 <strong className="text-emerald-300">{monthsToPayoff}개월</strong> 만에 원금 100%가 완납됩니다.
                    적용하면 변제기간을 <strong className="text-white">{monthsToPayoff}개월로 단축</strong>(36개월 대비 {shortenedMonths}개월 단축)하고 이자 {' '}
                    <strong className="text-amber-300">{totalInterest.toLocaleString()}원</strong>은 변제 대상에서 제외한 계획안을 만듭니다. 이자 면책 여부와 기간 단축 허용은 관할 법원 판단이므로 제출 전 확인하세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-2.5 text-slate-400">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-300">36개월 내 원금 완제 불가</div>
                  <p className="text-xs text-slate-400 leading-normal">
                    현재 월 가용소득으로는 36개월 내 원금 100% 완제가 불가능(필요: {monthsToPayoff}회차)하므로, 일반 가용소득 변제(원금 일부 변제)로 진행됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [신규 2] 보정권고 가용소득 & 기간 정밀 튜닝 */}
        {activeTab === 'correction' && (
          <div className="space-y-3.5 animate-fadeIn text-xs">
            {/* 개시후이자 발생 경고 배너 */}
            {plan.requiresPostCommencementInterest && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-600/60 flex items-start gap-2 text-rose-200 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-white block">⚠️ 법원 개시후이자 발생 주의 상태</span>
                  <p className="text-xs text-rose-300">
                    총 변제예정액({(plan.totalRepaymentAmount).toLocaleString()}원)이 총 채무({(plan.totalDebt).toLocaleString()}원)를 초과하여 변제금이 남습니다. 
                    변제기간을 단축하거나 월 변제금을 하향 조정하십시오.
                  </p>
                </div>
              </div>
            )}

            {/* 가용소득 강제 오버라이드 & 압류적립금 1회차 투입 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <span>월 가용소득 수동 오버라이드</span>
                    <span className="text-xs text-indigo-400 font-normal">(보정권고 지시액)</span>
                  </label>
                  {overrideMonthlyRepayment !== undefined && (
                    <button
                      type="button"
                      onClick={() => onUpdateOverrideMonthlyRepayment?.(undefined)}
                      className="text-xs text-slate-400 hover:text-rose-300 underline"
                    >
                      엔진 자동값 복귀
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={overrideMonthlyRepayment !== undefined ? overrideMonthlyRepayment : ''}
                  placeholder={`기본 자동값: ${plan.calculatedLiving.actualDisposableIncome.toLocaleString()}원`}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    onUpdateOverrideMonthlyRepayment?.(val);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  입력 시 생계비 엔진 대신 입력된 금액으로 전 채권자 안분 및 변제율이 즉시 재계산됩니다.
                </span>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  1회차 일괄 투입 압류적립금 (원)
                </label>
                <input
                  type="number"
                  value={garnishmentDepositFirstRound || ''}
                  placeholder="0"
                  onChange={(e) => onUpdateGarnishmentDepositFirstRound?.(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  인가 후 1회차에 투입되는 압류적립금으로, 총변제액에 합산되어 변제율을 상승시킵니다.
                </span>
              </div>
            </div>

            {/* 변제기간 미세 슬라이더 & 소수점 변제율 토글 */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-bold">변제기간 미세 슬라이더:</span>
                  <span className="text-indigo-400 font-black font-mono text-sm">{totalMonths}개월</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[24, 36, 48, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onUpdateMonths(m)}
                      className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all ${
                        totalMonths === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {m}개월
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min={12}
                max={60}
                value={totalMonths}
                onChange={(e) => onUpdateMonths(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />

              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decimalRepaymentRate}
                    onChange={(e) => onToggleDecimalRepaymentRate?.(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-300 font-bold">변제율 소수점 첫째자리 정밀 표기 (예: 52.4%)</span>
                </label>
                <span className="font-mono font-black text-indigo-300 text-sm">
                  현재 변제율: {plan.totalRepaymentRate}%
                </span>
              </div>
            </div>

            {/* 보정권고 사유 및 담당자 메모 */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <label className="text-slate-300 font-bold block mb-1">
                보정권고 대응 사유 및 실무자 튜닝 메모
              </label>
              <textarea
                value={adjusterMemo}
                onChange={(e) => onUpdateAdjusterMemo?.(e.target.value)}
                placeholder="예: 2026.03.10 서울회생법원 보정권고에 따라 배우자 소득 기여도 반영 및 가용소득 120만원으로 상향 조정함."
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* v2.0: [10] 외부회생위원 보수 */}
        {activeTab === 'trustee' && (
          <div className="space-y-3.5 animate-fadeIn text-xs">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <span className="text-slate-200 font-bold block mb-2">회생위원 선임 유형</span>
              <p className="text-xs text-slate-400 mb-3">
                법원이 외부 회생위원(변호사·회계사)을 선임한 경우, 가용소득의 1%가 회생위원 보수로 공제되어 
                실제 월 변제금이 줄어듭니다. 대부분의 서울회생법원 사건은 내부위원이 선임됩니다.
              </p>

              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all flex-1 text-center justify-center
                  ${trusteeType === 'INTERNAL' ? 'bg-emerald-900/50 border-emerald-500/60 text-emerald-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'}
                `}>
                  <input
                    type="radio"
                    name="trusteeType"
                    value="INTERNAL"
                    checked={trusteeType === 'INTERNAL'}
                    onChange={() => onUpdateTrusteeType?.('INTERNAL')}
                    className="w-3.5 h-3.5 text-emerald-500 border-slate-600"
                  />
                  <div>
                    <span className="font-bold block">내부 회생위원</span>
                    <span className="text-xs text-slate-500">보수 공제 없음</span>
                  </div>
                </label>

                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all flex-1 text-center justify-center
                  ${trusteeType === 'EXTERNAL' ? 'bg-cyan-900/50 border-cyan-500/60 text-cyan-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'}
                `}>
                  <input
                    type="radio"
                    name="trusteeType"
                    value="EXTERNAL"
                    checked={trusteeType === 'EXTERNAL'}
                    onChange={() => onUpdateTrusteeType?.('EXTERNAL')}
                    className="w-3.5 h-3.5 text-cyan-500 border-slate-600"
                  />
                  <div>
                    <span className="font-bold block">외부 회생위원</span>
                    <span className="text-xs text-slate-500">가용소득 1% 공제</span>
                  </div>
                </label>
              </div>

              {trusteeType === 'EXTERNAL' && plan.monthlyRepaymentTotal > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-cyan-900/30 border border-cyan-700/40 text-cyan-200">
                  <div className="flex items-center justify-between">
                    <span>월 변제금</span>
                    <span className="font-mono font-bold">{plan.monthlyRepaymentTotal.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>외부위원 보수 (가용소득 1% 추정)</span>
                    <span className="font-mono font-bold text-amber-300">별도 공제</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-cyan-700/40">
                    <span className="font-bold">안내</span>
                    <span className="text-xs text-cyan-300">엔진이 가용소득에서 자동 공제 후 월 변제금을 산출합니다</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/40 text-xs text-slate-400">
              <strong className="text-slate-300">참고:</strong> 채무자회생법 제83조, 외부회생위원 보수는 변제계획안 D5110 상단에 별도 표기됩니다. 
              관할 법원에 따라 보수 비율이 다를 수 있으니 사전에 확인하세요.
            </div>
          </div>
        )}

        {/* [1] 우선권 채권 (세금) */}
        {activeTab === 'priority' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-slate-200 block">우선권 채권(국세/지방세/건보료) 2단계 분할 변제</span>
                <span className="text-xs text-slate-400">
                  총 {totalPriorityDebt.toLocaleString()}원 · 변제계획 내 전액 우선 변제(제611조 제1항 제2호). 1단계 회차 자동값은 내부 보수 기준(기간 1/2 이내)
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTwoStage}
                  onChange={(e) => onToggleTwoStage(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-white">2단계 분할 활성화</span>
              </label>
            </div>

            {isTwoStage && (
              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">1단계 우선변제 회차 설정:</span>
                  <span className="text-blue-400 font-black font-mono text-sm">{stage1Months}회차 완납</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.floor(totalMonths / 2)}
                  value={stage1Months}
                  onChange={(e) => onUpdateStage1Months(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>1회차</span>
                  <span>보수 기준 {Math.floor(totalMonths / 2)}회차 (총 {totalMonths}개월의 1/2, 법정 상한 아님)</span>
                </div>

                {/* 인가 타당성 경고 */}
                {plan.priorityFeasibility?.riskWarning && (
                  <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg flex items-start gap-2 text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">{plan.priorityFeasibility.riskWarning}</p>
                      {plan.priorityFeasibility.recommendedMonths && totalMonths < 60 && (
                        <button
                          type="button"
                          onClick={() => onUpdateMonths(60)}
                          className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-black border border-rose-500/40 press-scale"
                        >
                          60개월로 기간 자동 연장하기 →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* [2] 별제권부 채권 */}
        {activeTab === 'secured' && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-xs text-slate-300 leading-relaxed">
              담보권(근저당권, 질권, 전세권 등) 채권의 환가예상액과 별제권 행사 후 예정부족액을 산출합니다.
            </p>
            {securedCreditors.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center text-xs text-slate-400">
                현재 등록된 별제권부(담보부) 채권이 없습니다. (STEP 2 채권자목록에서 별제권 체크 가능)
              </div>
            ) : (
              <div className="space-y-2">
                {securedCreditors.map((cred) => (
                  <div key={cred.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-white block">{cred.name} (담보부 채무)</span>
                      <span className="text-xs text-slate-400 font-mono">
                        채권최고액: {cred.principal.toLocaleString()}원 · 담보평가액: {(cred.securedValue || 0).toLocaleString()}원
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">환가율 프리셋:</span>
                      {['70%(일반부동산)', '100%(보증금)', '50%(자동차)'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-slate-200"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* [3] 압류적립금 처리 */}
        {activeTab === 'garnishment' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-white block">급여 압류적립금 변제계획 투입</span>
                <span className="text-xs text-slate-400">
                  제3채무자(직장)가 보관 중인 압류금을 개시 후 변제재원에 투입하고 압류를 해제합니다.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={garnishment.isExecuted}
                  onChange={(e) => onUpdateGarnishment({ ...garnishment, isExecuted: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-white">투입 처리</span>
              </label>
            </div>

            {garnishment.isExecuted && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/70 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">제3채무자 (회사명 / 공탁법원)</label>
                  <input
                    type="text"
                    value={garnishment.thirdPartyDebtor}
                    onChange={(e) => onUpdateGarnishment({ ...garnishment, thirdPartyDebtor: e.target.value })}
                    placeholder="예: 주식회사 한국물산"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">압류적립금 총액 (원)</label>
                  <input
                    type="number"
                    value={garnishment.depositAmount || ''}
                    onChange={(e) => onUpdateGarnishment({ ...garnishment, depositAmount: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-4 pt-1">
                  <span className="text-slate-400">투입 방식:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="g_input"
                      checked={garnishment.inputMode === 'first_round'}
                      onChange={() => onUpdateGarnishment({ ...garnishment, inputMode: 'first_round' })}
                      className="text-blue-500"
                    />
                    <span className="text-slate-200">1회차에 전액 일괄 투입</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="g_input"
                      checked={garnishment.inputMode === 'spread'}
                      onChange={() => onUpdateGarnishment({ ...garnishment, inputMode: 'spread' })}
                      className="text-blue-500"
                    />
                    <span className="text-slate-200">변제기간 전체 균등 분할</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [4] 재산처분에 의한 변제 (D5111) */}
        {activeTab === 'disposal' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-white block">재산처분에 의한 변제 (전산양식 D5111)</span>
                <span className="text-xs text-slate-400">
                  부동산·차량 등을 처분하여 인가 후 1~2년 이내 청산가치 부족분을 변제재원에 투입합니다.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={propertyDisposal.isExecuted}
                  onChange={(e) => onUpdatePropertyDisposal({ ...propertyDisposal, isExecuted: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-white">D5111 전환</span>
              </label>
            </div>

            {propertyDisposal.isExecuted && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/70 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-400 block mb-1">처분 대상 재산명</label>
                    <input
                      type="text"
                      value={propertyDisposal.assetName}
                      onChange={(e) => onUpdatePropertyDisposal({ ...propertyDisposal, assetName: e.target.value })}
                      placeholder="예: 서울시 도봉구 소재 아파트 지분"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">처분 기한 및 법원 가중 승수</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdatePropertyDisposal({ ...propertyDisposal, deadlineMode: 'within_1yr', multiplier: 1.1 })}
                        className={`py-1.5 rounded-lg font-bold border transition-all ${
                          propertyDisposal.deadlineMode === 'within_1yr'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        1년 이내 (1.1배수)
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePropertyDisposal({ ...propertyDisposal, deadlineMode: 'within_2yr', multiplier: 1.3 })}
                        className={`py-1.5 rounded-lg font-bold border transition-all ${
                          propertyDisposal.deadlineMode === 'within_2yr'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        2년 이내 (1.3배수)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-between">
                  <span className="text-purple-200">법원 투입 예정액 (승수 {propertyDisposal.multiplier}배 적용):</span>
                  <span className="font-mono text-sm font-black text-purple-300">
                    {Math.round((plan.totalLiquidationValue - (plan.presentValue || 0)) * propertyDisposal.multiplier).toLocaleString()}원
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [5] 원금과 이자 변제 방식 */}
        {activeTab === 'interest' && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-xs text-slate-300">
              변제율이 높거나 36개월 내 원금을 모두 변제할 수 있는 경우 이자 변제 방식을 선택합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateInterestMode('principal_only')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  interestMode === 'principal_only'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5 mb-1 text-white">
                  <span>① 원금만 전액 변제</span>
                  {interestMode === 'principal_only' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 ml-auto" />}
                </div>
                <p className="text-xs text-slate-400">개인회생 표준 원칙. 원금만 변제하고 이자는 전액 면책 처리합니다.</p>
              </button>

              <button
                type="button"
                onClick={() => onUpdateInterestMode('principal_then_interest')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  interestMode === 'principal_then_interest'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5 mb-1 text-white">
                  <span>② 원금 완제 후 이자</span>
                  {interestMode === 'principal_then_interest' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 ml-auto" />}
                </div>
                <p className="text-xs text-slate-400">법원 실무 다수. 원금을 먼저 100% 충당한 후 남은 기간에 이자를 변제합니다.</p>
              </button>

              <button
                type="button"
                onClick={() => onUpdateInterestMode('simultaneous_all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  interestMode === 'simultaneous_all'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5 mb-1 text-white">
                  <span>③ 원리금 동시안분</span>
                  {interestMode === 'simultaneous_all' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 ml-auto" />}
                </div>
                <p className="text-xs text-slate-400">총 채무액(원금+이자)을 기준으로 안분비율을 산출하여 매월 동시 변제합니다.</p>
              </button>
            </div>
          </div>
        )}

        {/* [6] 장래양육비 */}
        {activeTab === 'child_support' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-white block">장래양육비 지급 정보 (기록용)</span>
                <span className="text-xs text-amber-300">
                  ⚠️ 이 값은 월 변제금 계산에 자동 반영되지 않습니다. 추가생계비로 인정받으려면 [소득·생계비] 섹션의 '기타 인정 생계비'에 직접 입력하세요.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={childSupport.isExecuted}
                  onChange={(e) => onUpdateChildSupport({ ...childSupport, isExecuted: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-white">양육비 반영</span>
              </label>
            </div>

            {childSupport.isExecuted && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/70 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">양육권자 성명 (전 배우자)</label>
                  <input
                    type="text"
                    value={childSupport.recipientName}
                    onChange={(e) => onUpdateChildSupport({ ...childSupport, recipientName: e.target.value })}
                    placeholder="성명 입력"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">월 정기 양육비 (원)</label>
                  <input
                    type="number"
                    value={childSupport.monthlyAmount || ''}
                    onChange={(e) => onUpdateChildSupport({ ...childSupport, monthlyAmount: Number(e.target.value) })}
                    placeholder="예: 500000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 pb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={childSupport.hasCourtDecree}
                      onChange={(e) => onUpdateChildSupport({ ...childSupport, hasCourtDecree: e.target.checked })}
                      className="rounded text-blue-600 border-slate-600"
                    />
                    <span className="text-slate-200">법원 양육비부담조서 확정본 소지</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [7] 성년도달 부양가족 */}
        {activeTab === 'adult_child' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-white block">변제기간 중 성년 도달 자녀 (기록용)</span>
                <span className="text-xs text-amber-300">
                  ⚠️ 단계별 생계비 축소·변제금 상향은 아직 자동 계산되지 않습니다. 성년 도달 회차를 기록해 두고, 필요하면 수동 조정으로 반영하세요.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adultChild.isExecuted}
                  onChange={(e) => onUpdateAdultChild({ ...adultChild, isExecuted: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-white">단계별 상향 활성화</span>
              </label>
            </div>

            {adultChild.isExecuted && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/70 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-slate-400 block mb-1">성년 도달 자녀명</label>
                    <input
                      type="text"
                      value={adultChild.childName}
                      onChange={(e) => onUpdateAdultChild({ ...adultChild, childName: e.target.value })}
                      placeholder="자녀 성명"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">성년 도달일 (만 19세)</label>
                    <input
                      type="date"
                      value={adultChild.adultDate}
                      onChange={(e) => onUpdateAdultChild({ ...adultChild, adultDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">변환 회차 (예: 19회차부터)</label>
                    <input
                      type="number"
                      value={adultChild.transitionMonthIndex || 19}
                      onChange={(e) => onUpdateAdultChild({ ...adultChild, transitionMonthIndex: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
                  💡 법원 실무상 1~{adultChild.transitionMonthIndex - 1}회차는 부양가족을 포함하고 {adultChild.transitionMonthIndex}~{totalMonths}회차는 가구원 수를 줄여 생계비를 다시 산정할 수 있습니다. 현재 계획안에는 자동 반영되지 않으니 수동으로 확인하세요.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
