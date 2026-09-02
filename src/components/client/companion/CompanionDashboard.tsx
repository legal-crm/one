import React, { useState } from 'react';
import { RehabCompanionCase, RepaymentRoundItem } from '../../../types';
import { 
  Calendar, CheckCircle, Clock, DollarSign, FileText, 
  TrendingUp, AlertTriangle, ShieldCheck, Copy, 
  ChevronRight, ArrowUpRight, Sparkles, Upload, 
  Layers, Percent, Activity, RefreshCw, Send, Check
} from 'lucide-react';
import { toast } from 'sonner';

interface CompanionDashboardProps {
  caseData: RehabCompanionCase;
  onOpenPaymentModal: (roundItem: RepaymentRoundItem) => void;
  onOpenCrisisModal: () => void;
  onOpenRegisterModal: () => void;
  onUpdateCashflow: (updated: any) => void;
  onNavigateToSupport?: () => void;
}

export default function CompanionDashboard({
  caseData,
  onOpenPaymentModal,
  onOpenCrisisModal,
  onOpenRegisterModal,
  onUpdateCashflow,
  onNavigateToSupport
}: CompanionDashboardProps) {
  // 이번 달 납부 예정 회차 찾기
  const nextRoundIndex = caseData.schedules.findIndex(
    s => !['court_confirmed', 'receipt_uploaded', 'self_marked'].includes(s.status)
  );
  const currentTargetRound = nextRoundIndex >= 0 ? caseData.schedules[nextRoundIndex] : caseData.schedules[caseData.schedules.length - 1];

  // D-Day 계산
  const calculateDday = (dueDateStr?: string): number => {
    if (!dueDateStr) return 7;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const dDay = calculateDday(currentTargetRound?.dueDate);

  // 통계 계산
  const totalRounds = caseData.totalRounds || 36;
  const completedCount = caseData.schedules.filter(s => 
    ['court_confirmed', 'receipt_uploaded', 'self_marked'].includes(s.status)
  ).length;
  const progressPercent = totalRounds > 0 ? ((completedCount / totalRounds) * 100).toFixed(1) : '0';

  const courtConfirmedCount = caseData.schedules.filter(s => s.status === 'court_confirmed').length;
  const receiptCount = caseData.schedules.filter(s => s.status === 'receipt_uploaded').length;
  const selfMarkedCount = caseData.schedules.filter(s => s.status === 'self_marked').length;
  const checkNeededCount = caseData.schedules.filter(s => s.status === 'overdue_check_needed').length;

  const totalScheduledAmount = totalRounds * caseData.monthlyRepaymentAmount;
  const totalConfirmedPaidAmount = completedCount * caseData.monthlyRepaymentAmount;
  const totalRemainingAmount = Math.max(0, totalScheduledAmount - totalConfirmedPaidAmount);

  // 30일 생계 밸런서 계산
  const { monthlyIncome, essentialLivingCost, repaymentAmount, otherFixedExpenses } = caseData.cashflow;
  const expectedSurplus = monthlyIncome - (essentialLivingCost + repaymentAmount + otherFixedExpenses);

  // 가상계좌 복사
  const handleCopyAccount = () => {
    if (caseData.courtVirtualAccount) {
      navigator.clipboard.writeText(caseData.courtVirtualAccount);
      toast.success('법원 가상계좌가 클립보드에 복사되었습니다.');
    }
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* ═══ 1. 사건 헤더 & 가상계좌 바 ═══ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light px-2.5 py-0.5 rounded-full">
              {caseData.sourceType === 'external_office' ? '타 법률사무소 진행' : 
               caseData.sourceType === 'self_litigant' ? '나홀로 전자소송' : '마이김변 전담 변호사'}
            </span>
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
              {caseData.courtName}
            </span>
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-semibold">
              사건번호: {caseData.caseNumberMasked}
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🌱 <span className="text-brand dark:text-brand-light">{caseData.alias}</span> 님의 회생동행</span>
          </h2>
          
          <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
            대한민국 법원 전자소송에 등록된 변제계획을 토대로 면책까지의 매월 납부 일정과 생활 안정을 함께 관리합니다.
          </p>
        </div>

        {/* 우측 사건 정보 수정 & 가상계좌 버튼 */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-64">
          {caseData.courtVirtualAccount && (
            <button
              type="button"
              onClick={handleCopyAccount}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.98]"
              title="가상계좌 복사"
            >
              <div className="flex items-center gap-2 truncate">
                <DollarSign className="w-4 h-4 text-brand shrink-0" />
                <span className="truncate">{caseData.courtVirtualAccount}</span>
              </div>
              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand shrink-0" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center cursor-pointer"
          >
            ⚙️ 사건 정보 / 변제 조건 변경
          </button>
        </div>
      </div>

      {/* ═══ 2. Hero D-Day & 이번 달 납부 현황 배너 ═══ */}
      <div className="bg-gradient-to-br from-brand/90 to-brand-hover text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-white/20 text-white px-3 py-1 rounded-full backdrop-blur-sm">
              {dDay > 0 ? `⚡ 이번 달 변제일까지 D-${dDay}일` : dDay === 0 ? '🔥 오늘이 변제금 납부일입니다!' : '⚠️ 변제일이 도래했습니다'}
            </span>
            <span className="text-xs text-brand-light font-bold">
              {currentTargetRound?.dueDate} 납부 예정
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-white/80 font-medium block">
              {currentTargetRound?.round || completedCount + 1}회차 이번 달 납부 예정액
            </span>
            <div className="text-2xl md:text-4xl font-black tracking-tight">
              {caseData.monthlyRepaymentAmount.toLocaleString()}원
            </div>
          </div>

          <p className="text-xs text-white/80 leading-relaxed">
            * 등록된 변제계획 기준 금액입니다. 납부 후 아래 버튼을 눌러 영수증을 첨부하거나 납부 표시를 완료해 주세요.
          </p>
        </div>

        {/* 액션 CTA 버튼들 */}
        <div className="flex flex-col gap-2.5 shrink-0 w-full md:w-64">
          <button
            type="button"
            onClick={() => currentTargetRound && onOpenPaymentModal(currentTargetRound)}
            className="w-full py-3.5 bg-white hover:bg-slate-50 text-brand font-black text-xs md:text-sm rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>이번 달 납부 완료 / 증빙 등록</span>
          </button>

          <button
            type="button"
            onClick={onOpenCrisisModal}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>이번 달 변제금이 부족하신가요?</span>
          </button>
        </div>
      </div>

      {/* ═══ 3. 회생 완주 진행률 게이지 & 통계 ═══ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand" />
              <span>변제계획상 납부 진행률</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              인가된 변제계획(총 {totalRounds}회차)에 따른 상환 완주 진척도입니다.
            </p>
          </div>

          <div className="text-right">
            <span className="text-2xl md:text-3xl font-black text-brand dark:text-brand-light">
              {progressPercent}%
            </span>
            <span className="text-xs text-slate-500 font-bold ml-1.5">
              ({completedCount}회 / 총 {totalRounds}회)
            </span>
          </div>
        </div>

        {/* 프로그레스 바 */}
        <div className="space-y-2">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-brand to-emerald-500 rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${Math.min(100, Math.max(3, Number(progressPercent)))}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
            <span>시작 (1회차)</span>
            <span>반환점 (18회차)</span>
            <span>완주 ({totalRounds}회차 / 면책신청)</span>
          </div>
        </div>

        {/* 누적 금액 3열 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-500 font-bold">총 변제 예정액</span>
            <p className="text-sm md:text-base font-black text-slate-900 dark:text-white">
              {totalScheduledAmount.toLocaleString()}원
            </p>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-1">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">확인된 누적 납부액</span>
            <p className="text-sm md:text-base font-black text-emerald-700 dark:text-emerald-300">
              {totalConfirmedPaidAmount.toLocaleString()}원
            </p>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-1">
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">남은 변제 예정액</span>
            <p className="text-sm md:text-base font-black text-amber-700 dark:text-amber-300">
              {totalRemainingAmount.toLocaleString()}원
            </p>
          </div>
        </div>

        {/* 법적 면책 안내 고지 */}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          * 개인회생은 인가된 변제계획을 완료한 후 법원의 최종 면책결정이 확정되어야 잔여 채무에 관한 법적 책임이 면제됩니다.
        </p>
      </div>

      {/* ═══ 4. 36~60개월 납부 히트맵 캘린더 ═══ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand" />
              <span>{totalRounds}개월 상환 히트맵 & 캘린더</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 회차 블록을 클릭하여 납부 상태 변경 및 영수증을 첨부할 수 있습니다.
            </p>
          </div>

          {/* 범례 배지 */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
              🟢 법원자료 ({courtConfirmedCount})
            </span>
            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
              🔵 증빙첨부 ({receiptCount})
            </span>
            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
              🟡 고객표시 ({selfMarkedCount})
            </span>
            {checkNeededCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                🔴 확인필요 ({checkNeededCount})
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
              ⚪ 도래전 ({totalRounds - completedCount})
            </span>
          </div>
        </div>

        {/* 캘린더 그리드 (6열 or 12열 반응형) */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2.5">
          {caseData.schedules.map((item) => {
            const isCourt = item.status === 'court_confirmed';
            const isReceipt = item.status === 'receipt_uploaded';
            const isSelf = item.status === 'self_marked';
            const isOverdue = item.status === 'overdue_check_needed';
            const isPending = item.status === 'pending';

            return (
              <button
                key={item.round}
                type="button"
                onClick={() => onOpenPaymentModal(item)}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-between items-center h-20 active:scale-95 group ${
                  isCourt ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400' :
                  isReceipt ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 hover:border-blue-400' :
                  isSelf ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:border-amber-400' :
                  isOverdue ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:border-red-500 animate-pulse' :
                  'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black">{item.round}회</span>
                  <span className="text-xs">
                    {isCourt ? '🟢' : isReceipt ? '🔵' : isSelf ? '🟡' : isOverdue ? '🔴' : '⚪'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] block text-slate-400 truncate">
                    {item.dueDate.slice(2, 7)}
                  </span>
                  <span className="text-[9px] font-bold block truncate">
                    {isCourt || isReceipt || isSelf ? '완료' : '예정'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          💡 각 회차 카드를 클릭하여 과거 납부 영수증을 확인하거나, 납부 완료 표시를 변경할 수 있습니다.
        </p>
      </div>

      {/* ═══ 5. 30일 생계 현금흐름 밸런서 ═══ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand" />
              <span>이번 달 생계 현금흐름 밸런서</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              월 소득에서 필수생계비와 변제금을 제외한 실제 가계 잔여 여유자금을 점검합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-black px-3 py-1 rounded-full ${
              expectedSurplus >= 0
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200'
            }`}>
              {expectedSurplus >= 0 ? '💡 이번 달 상환 안정권' : '⚠️ 이번 달 적자 예상 (위기)'}
            </span>
          </div>
        </div>

        {/* 4분할 수식 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
          
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-bold block">월 실수령 소득 (+)</span>
            <span className="text-sm font-black text-slate-800 dark:text-white mt-1 block">
              {monthlyIncome.toLocaleString()}원
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-bold block">필수 생계비 (-)</span>
            <span className="text-sm font-black text-slate-800 dark:text-white mt-1 block">
              {essentialLivingCost.toLocaleString()}원
            </span>
          </div>

          <div className="bg-brand/5 dark:bg-brand/10 p-4 rounded-2xl border border-brand/20">
            <span className="text-[11px] text-brand font-bold block">월 변제금 (-)</span>
            <span className="text-sm font-black text-brand dark:text-brand-light mt-1 block">
              {repaymentAmount.toLocaleString()}원
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-bold block">기타 고정지출 (-)</span>
            <span className="text-sm font-black text-slate-800 dark:text-white mt-1 block">
              {otherFixedExpenses.toLocaleString()}원
            </span>
          </div>

          <div className={`p-4 rounded-2xl border ${
            expectedSurplus >= 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}>
            <span className="text-[11px] font-bold block">예상 잔여액 (=)</span>
            <span className="text-sm font-black mt-1 block">
              {expectedSurplus >= 0 ? `+${expectedSurplus.toLocaleString()}원` : `${expectedSurplus.toLocaleString()}원`}
            </span>
          </div>

        </div>

        {/* 적자 예상 시 변호사 & 복지 연결 배너 */}
        {expectedSurplus < 0 ? (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">
                이번 달 예상 잔고가 부족합니다. 연체 방지를 위해 공적 긴급생계비 지원을 신청하거나 담당 변호사에게 변제계획 변경 검토를 요청하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCrisisModal}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
            >
              생활위기 SOS 접수
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>현재 안정적인 잉여금이 유지되고 있습니다. 남은 기간도 성실 상환을 응원합니다!</span>
            </div>
            <button
              type="button"
              onClick={onNavigateToSupport}
              className="text-xs font-bold underline hover:text-emerald-800 dark:hover:text-emerald-200 cursor-pointer"
            >
              성실상환자 혜택 보기 ➔
            </button>
          </div>
        )}
      </div>

      {/* ═══ 6. 스마트 법원 서류 보관함 ═══ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand" />
              <span>스마트 법원 서류 보관함</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              인가결정문, 변제계획안, 납부 영수증이 종단간 암호화되어 안전하게 보관됩니다.
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {caseData.documents.length}개 서류 보관 중
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {caseData.documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col justify-between gap-3 hover:border-brand/40 transition-all"
            >
              <div className="flex items-start gap-2.5">
                <FileText className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {doc.name}
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {new Date(doc.uploadedAt).toLocaleDateString('ko')} 등록
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.success(`${doc.name} 문서를 열람합니다.`)}
                className="w-full py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-brand transition-colors cursor-pointer"
              >
                문서 열람 / 다운로드
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
