import React from 'react';
import { Sparkles, Clock, ShieldCheck, FileSearch, Calculator, Scale, ArrowRight, UserCheck } from 'lucide-react';
import type { ConsultRequest } from '../../../types';
import { mockLawyers } from '../../../data';

interface ProposalAnalyzingCardProps {
  request?: ConsultRequest;
  onNavigateToChat?: () => void;
}

export const ProposalAnalyzingCard: React.FC<ProposalAnalyzingCardProps> = ({
  request,
  onNavigateToChat
}) => {
  // 배정된 변호사 정보 조회
  const assignedLawyer = request?.assignedLawyerId 
    ? mockLawyers.find(l => l.id === request.assignedLawyerId)
    : (request?.selectedLawyerId ? mockLawyers.find(l => l.id === request.selectedLawyerId) : null);

  const lawyerName = assignedLawyer?.name || '도산전문 변호사';
  const lawyerFirm = assignedLawyer?.firmName || '회생파산 전담센터';
  const lawyerAvatar = assignedLawyer?.avatar;

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-150 dark:border-blue-900/40 rounded-3xl p-6 sm:p-8 shadow-xl shadow-blue-950/5 relative overflow-hidden">
      {/* 상단 앰비언트 글로우 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      
      <div className="relative z-10 space-y-6">
        {/* 상태 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  실시간 제안서 작성 중
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  신청 접수 완료
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                변호사가 맞춤 회생 솔루션 제안서를 작성하고 있습니다
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>예상 소요 시간: <strong>10~30분 이내</strong></span>
          </div>
        </div>

        {/* 프로세스 3단계 인디케이터 */}
        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-150 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-300/40">
                ✓
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">1. 상담 신청 접수</p>
                <p className="text-[11px] text-slate-400 mt-0.5">채무·소득 현황 전달 완료</p>
              </div>
            </div>

            {/* Step 2 (현재 진행 중) */}
            <div className="flex items-start gap-3 relative">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md shadow-blue-500/30 animate-pulse">
                2
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">2. 변호사 정밀 분석 중</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">가용소득 및 탕감률 산출</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 opacity-60">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">3. 맞춤 제안서 발송</p>
                <p className="text-[11px] text-slate-400 mt-0.5">알림톡 및 앱 알림 전달</p>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 변호사팀이 검토 중인 3대 핵심 항목 */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>변호사팀이 의뢰인 데이터를 바탕으로 작성 중인 제안서 내용:</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Calculator className="w-4 h-4 text-blue-500" />
                <span>최적 월 변제금 산출</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                법정 최저생계비와 추가 주거비 등을 반영한 실부담 변제액 검토
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Scale className="w-4 h-4 text-indigo-500" />
                <span>관할법원 인가율 분석</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                거주지 및 관할법원 실무준칙에 부합하는 최대 탕감 플랜 수립
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>투명한 수임료 분납안</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                성공보수 없는 정찰제 수임료와 최대 6회 무이자 분납 조건 구성
              </p>
            </div>
          </div>
        </div>

        {/* 하단 안내 및 배정 정보 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            {assignedLawyer ? (
              <div className="flex items-center gap-2">
                {lawyerAvatar ? (
                  <img src={lawyerAvatar} alt={lawyerName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                    {lawyerName.charAt(0)}
                  </div>
                )}
                <span><strong>{lawyerName} 변호사</strong> ({lawyerFirm}) 배정</span>
              </div>
            ) : (
              <span>💡 회생파산 전담 변호사팀이 순차적으로 배정되어 검토하고 있습니다.</span>
            )}
          </div>

          <div className="text-slate-500 dark:text-slate-400 text-[11px]">
            제안서 발송 시 <strong>카카오 알림톡</strong>으로 즉시 알려드립니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalAnalyzingCard;
