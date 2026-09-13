import React from 'react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Scale, FileText, 
  MessageSquare, ArrowRight, User, TrendingDown, DollarSign, 
  Calendar, Check, ChevronRight, Award, ExternalLink 
} from 'lucide-react';
import type { ConsultProposal, ConsultRequest } from '../../../types';
import { formatKoreanCurrency, formatNumber } from '../../../utils';

interface ProposalHeroCardProps {
  proposal: ConsultProposal;
  request?: ConsultRequest;
  onViewReport: (proposal: ConsultProposal) => void;
  onNavigateToChat: (reqId?: string) => void;
  onStartContract: (proposal: ConsultProposal) => void;
  isOnlyOne?: boolean;
}

export const ProposalHeroCard: React.FC<ProposalHeroCardProps> = ({
  proposal,
  request,
  onViewReport,
  onNavigateToChat,
  onStartContract,
  isOnlyOne = true
}) => {
  const isAIPremium = Boolean(proposal.proposalData?.aiInsights);
  const totalDebtManWon = request?.financialProfile?.debtTotal || 0;

  return (
    <div className="bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-950 border-2 border-blue-500/40 dark:border-blue-500/50 rounded-3xl p-6 sm:p-8 shadow-xl shadow-blue-950/10 relative overflow-hidden">
      {/* 상단 앰비언트 글로우 */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* 헤더 & 변호사 프로필 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            {/* 변호사 아바타 */}
            <div className="relative shrink-0">
              {proposal.lawyerAvatar ? (
                <img
                  src={proposal.lawyerAvatar}
                  alt={proposal.lawyerName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/40 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-[#1E3A5F] text-white flex items-center justify-center font-black text-xl shadow-md">
                  {proposal.lawyerName.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-[10px]">
                <Check className="w-3 h-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                  맞춤 제안서 도착
                </span>
                {isAIPremium && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-3 h-3" />
                    AI 7p 정밀 진단
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString('ko-KR') : '방금 전'}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                <span>{proposal.lawyerName} 변호사</span>
                <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({proposal.firmName})
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              진행 가능성: {proposal.feasibility || '진행 가능'}
            </span>
          </div>
        </div>

        {/* 3대 핵심 수치 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. 예상 탕감률 */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                예상 채무 탕감률
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">최대치 기준</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 pt-0.5">
              {proposal.reductionRate}%
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {proposal.totalReduction > 0 ? (
                <>원금 중 약 <strong>{proposal.totalReduction}만원</strong> 탕감 예상</>
              ) : (
                <>총 채무 {totalDebtManWon}만원 기준 시뮬레이션</>
              )}
            </p>
          </div>

          {/* 2. 예상 월 변제금 */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-blue-500" />
                예상 월 변제금
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">{proposal.duration || 36}개월</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 pt-0.5">
              월 {proposal.monthlyPayment}만원
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              가용소득 기반 법정 생계비 반영 완료
            </p>
          </div>

          {/* 3. 변호사 수임료 및 분납 */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                정찰제 수임료
              </span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">분납 지원</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white pt-0.5">
              {proposal.fee}만원
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {proposal.installment || '무이자 분납 협의 가능'}
            </p>
          </div>
        </div>

        {/* 변호사 법률 소견 한줄 요약 (따옴표 박스) */}
        {proposal.remark && (
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-150 dark:border-blue-900/40 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#1E3A5F] dark:text-blue-300 text-xs">
              <Scale className="w-3.5 h-3.5" />
              <span>{proposal.lawyerName} 변호사의 검토 의견:</span>
            </div>
            <p className="leading-relaxed whitespace-pre-line pl-5 border-l-2 border-blue-400/50 italic text-slate-600 dark:text-slate-300">
              "{proposal.remark}"
            </p>
          </div>
        )}

        {/* 1-Click 메인 CTA: [맞춤 제안서 & 7p 정밀 진단서 전문 열람] */}
        <div>
          <button
            type="button"
            onClick={() => onViewReport(proposal)}
            className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 hover:from-blue-800 hover:to-indigo-700 text-white font-black text-sm sm:text-base shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            <FileText className="w-4 h-4" />
            <span>맞춤 제안서 & 7p 정밀 진단서 전문 열람하기</span>
            <ArrowRight className="w-4 h-4 text-white/80" />
          </button>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            변호사가 직접 검수한 탕감 계산식, 관할법원 분석표, 절차 타임라인이 포함되어 있습니다.
          </p>
        </div>

        {/* 제안서 확인 후 2대 의사결정 분기 액션 패널 */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              제안서를 확인하셨나요? 다음 단계를 선택하세요:
            </span>
            <span className="text-[11px] text-slate-400">선택 1 or 선택 2</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 액션 A: 추가 상담하기 */}
            <button
              type="button"
              onClick={() => onNavigateToChat(request?.id)}
              className="min-h-[44px] px-4 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] shadow-xs"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>제안서 내용으로 1:1 추가 상담하기</span>
            </button>

            {/* 액션 B: 즉시 계약 진행하기 */}
            <button
              type="button"
              onClick={() => onStartContract(proposal)}
              className="min-h-[44px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>이 조건으로 즉시 수임계약 진행하기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalHeroCard;
