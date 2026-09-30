import React from 'react';
import { Sparkles, ShieldCheck, Calculator, Scale, Bell } from 'lucide-react';
import type { ConsultRequest, User } from '../../../types';

interface ProposalAnalyzingCardProps {
  request?: ConsultRequest;
  onNavigateToChat?: () => void;
  /** 실제 등록 변호사 목록 (없으면 이름 대신 선택 인원만 표시) */
  lawyers?: User[];
}

// 제안서 작성 대기 카드
// - 소요 시간·알림 채널·수임료 조건을 약속하지 않는다 (변호사마다 다름)
// - 변호사 정보는 실제 등록 변호사 목록에서만 조회 (mock 데이터 사용 금지)
export const ProposalAnalyzingCard: React.FC<ProposalAnalyzingCardProps> = ({
  request,
  lawyers = [],
}) => {
  const targetIds = request?.selectedLawyerIds?.length
    ? request.selectedLawyerIds
    : [request?.assignedLawyerId || request?.selectedLawyerId].filter((v): v is string => !!v);
  const matched = targetIds
    .map(id => lawyers.find(l => l.id === id))
    .filter((l): l is User => !!l);
  const requestedCount = targetIds.length;
  // 변호사가 실제로 답변을 시작했을 때(responding)만 '검토 중'이라고 쓴다. 그 전에는 '확인 대기'
  const reviewing = request?.status === 'responding';

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 rounded-3xl p-6 sm:p-8 shadow-xl shadow-blue-950/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 space-y-6">
        {/* 상태 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                  {reviewing ? '변호사 검토 중' : '변호사 확인 대기'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">요청 보냄</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                {reviewing ? '선택하신 변호사가 사건 내용을 검토하고 있습니다' : '선택하신 변호사의 확인을 기다리고 있습니다'}
              </h3>
            </div>
          </div>
        </div>

        {/* 프로세스 3단계 인디케이터 */}
        <ol className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <li className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-300/40" aria-hidden="true">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">1. 상담 신청 접수</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">채무·소득 현황 전달 완료</p>
            </div>
          </li>
          <li className="flex items-start gap-3" aria-current="step">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md shadow-blue-500/30" aria-hidden="true">
              2
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400">{reviewing ? '2. 변호사 검토 중' : '2. 변호사 확인'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">가용소득·변제 계획 검토</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
              3
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">3. 제안서 도착</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">마이페이지·상담방에서 확인</p>
            </div>
          </li>
        </ol>

        {/* 제안서에 담기는 내용 */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <span>제안서에는 이런 내용이 담깁니다</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Calculator className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <span>예상 월 변제금</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                법원 기준 생계비와 추가 주거비 등을 반영한 예상 변제액
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Scale className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <span>관할법원 실무 검토</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                거주지 관할법원 실무준칙에 맞춘 변제 계획과 유의사항
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                <span>수임료와 납부 조건</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                변호사별 수임료와 분납 여부를 제안서에서 비교할 수 있어요
              </p>
            </div>
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
          <div className="text-slate-600 dark:text-slate-400">
            {matched.length > 0 ? (
              <span>
                요청한 변호사: <strong className="text-slate-800 dark:text-slate-200">{matched.map(l => `${l.name.replace(/\s*변호사$/, '')} 변호사`).join(', ')}</strong>
              </span>
            ) : requestedCount > 0 ? (
              <span>선택하신 변호사 <strong>{requestedCount}명</strong>에게 요청했습니다.</span>
            ) : (
              <span>변호사를 선택하시면 제안서 작성이 시작됩니다.</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
            <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            <span>제안서가 도착하면 이 화면과 상담방에서 확인하실 수 있어요. 검토 기간은 변호사마다 다를 수 있습니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalAnalyzingCard;
