import React, { useState } from 'react';
import { 
  Sparkles, CheckCircle2, Clock, Users, ArrowRight, 
  MessageSquare, FileText, Check, ChevronRight, Scale, ShieldCheck 
} from 'lucide-react';
import type { ConsultProposal, ConsultRequest } from '../../../types';
import ProposalAnalyzingCard from './ProposalAnalyzingCard';
import ProposalHeroCard from './ProposalHeroCard';

interface ClientProposalTrackerProps {
  proposals: Array<{ req: ConsultRequest; proposal: ConsultProposal }>;
  activeRequest?: ConsultRequest;
  onViewReport: (proposal: ConsultProposal) => void;
  onNavigateToChat: (reqId?: string) => void;
  onStartContract: (proposal: ConsultProposal) => void;
  onOpenLawyerCompare?: () => void;
}

export const ClientProposalTracker: React.FC<ClientProposalTrackerProps> = ({
  proposals = [],
  activeRequest,
  onViewReport,
  onNavigateToChat,
  onStartContract,
  onOpenLawyerCompare
}) => {
  const [selectedProposalIdx, setSelectedProposalIdx] = useState(0);

  const hasProposals = proposals.length > 0;
  const currentItem = hasProposals ? proposals[Math.min(selectedProposalIdx, proposals.length - 1)] : null;

  // 파이프라인 단계 계산
  // 1: 접수완료, 2: 작성중, 3: 제안서도착, 4: 추가상담/계약결정
  const currentPipelineStep = hasProposals ? 3 : 2;

  return (
    <div className="space-y-4">
      {/* ── [1] 제안서 중심 4단계 진행 파이프라인 트래커 ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {hasProposals ? '맞춤 제안서 도착 (의뢰인 검토 단계)' : '변호사 사건 분석 및 제안서 작성 단계'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            전체 4단계 중 <strong>{currentPipelineStep}단계</strong> 진행 중
          </span>
        </div>

        {/* 4단계 스텝 바 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Step 1: 상담 신청 */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">1. 상담 신청</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">접수 완료</p>
            </div>
          </div>

          {/* Step 2: 제안서 작성 중 */}
          <div className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
            currentPipelineStep === 2
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
              : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
              currentPipelineStep === 2
                ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-emerald-600 text-white'
            }`}>
              {currentPipelineStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold truncate ${currentPipelineStep === 2 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                2. 제안서 작성
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentPipelineStep === 2 ? '실시간 분석 중' : '작성 완료'}
              </p>
            </div>
          </div>

          {/* Step 3: 제안서 도착 & 검토 */}
          <div className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
            currentPipelineStep === 3
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
              : currentPipelineStep > 3
                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
              currentPipelineStep === 3
                ? 'bg-blue-600 text-white shadow-xs'
                : currentPipelineStep > 3
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              3
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold truncate ${currentPipelineStep === 3 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                3. 제안서 도착
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {hasProposals ? `${proposals.length}건 수신` : '대기 중'}
              </p>
            </div>
          </div>

          {/* Step 4: 추가상담 / 계약 */}
          <div className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
            currentPipelineStep === 4
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
              currentPipelineStep === 4
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              4
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                4. 추가상담 / 계약
              </p>
              <p className="text-[10px] text-slate-400 truncate">의뢰인 결정</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── [2] 메인 카드 렌더링 (작성 중 vs 도착 완료) ── */}
      {!hasProposals ? (
        // 제안서 작성 중 대기 카드
        <ProposalAnalyzingCard
          request={activeRequest}
          onNavigateToChat={() => onNavigateToChat(activeRequest?.id)}
        />
      ) : (
        // 제안서 도착 완료 카드
        <div className="space-y-3">
          {/* 복수 제안서 도착 시 비교 탭 (최대 3인) */}
          {proposals.length > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {proposals.map((item, idx) => (
                  <button
                    key={item.proposal.id || idx}
                    type="button"
                    onClick={() => setSelectedProposalIdx(idx)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      selectedProposalIdx === idx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{item.proposal.lawyerName} 변호사</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      selectedProposalIdx === idx ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300'
                    }`}>
                      {item.proposal.reductionRate}% 탕감
                    </span>
                  </button>
                ))}
              </div>

              {onOpenLawyerCompare && (
                <button
                  type="button"
                  onClick={onOpenLawyerCompare}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold px-3 shrink-0 cursor-pointer"
                >
                  제안서 한눈에 비교
                </button>
              )}
            </div>
          )}

          {/* 선택된 제안서 히어로 카드 */}
          {currentItem && (
            <ProposalHeroCard
              proposal={currentItem.proposal}
              request={currentItem.req}
              onViewReport={onViewReport}
              onNavigateToChat={onNavigateToChat}
              onStartContract={onStartContract}
              isOnlyOne={proposals.length <= 1}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ClientProposalTracker;
