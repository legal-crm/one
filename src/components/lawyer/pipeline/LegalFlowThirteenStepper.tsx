import React from 'react';
import { 
  CheckCircle2, ChevronRight, AlertTriangle, Lock, ShieldAlert,
  HelpCircle, ArrowRight, RefreshCw, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  LEGALFLOW_REHAB_STAGES, 
  LEGALFLOW_BANKRUPTCY_STAGES, 
  type LegalFlowStageConfig 
} from '../../../types';

interface LegalFlowThirteenStepperProps {
  currentStageId?: string;
  isBankruptcy?: boolean;
  isDismissedRevoked?: boolean;
  onSelectStage: (stageId: string) => void;
  onToggleDismissedRevoked?: (val: boolean) => void;
  readOnly?: boolean;
}

export default function LegalFlowThirteenStepper({
  currentStageId = 'consult_waiting',
  isBankruptcy = false,
  isDismissedRevoked = false,
  onSelectStage,
  onToggleDismissedRevoked,
  readOnly = false,
}: LegalFlowThirteenStepperProps) {
  const stages: LegalFlowStageConfig[] = isBankruptcy 
    ? LEGALFLOW_BANKRUPTCY_STAGES 
    : LEGALFLOW_REHAB_STAGES;

  const currentIndex = stages.findIndex(s => s.id === currentStageId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentStageConfig = stages[safeCurrentIndex] || stages[0];

  // 신청서 제출(접수) 단계 인덱스 (통상 5: 6번째 단계 'petition_submitted')
  const SUBMISSION_INDEX = stages.findIndex(s => s.id === 'petition_submitted');
  const isAfterSubmission = safeCurrentIndex >= SUBMISSION_INDEX;

  const handleStageClick = (targetStage: LegalFlowStageConfig, targetIndex: number) => {
    if (readOnly) return;

    // 기각 및 폐지 단계는 전용 토글로 분기 처리
    if (targetStage.id === 'dismissed_revoked' || targetStage.id === 'bankruptcy_closed') {
      if (onToggleDismissedRevoked) {
        onToggleDismissedRevoked(!isDismissedRevoked);
        toast.info(isDismissedRevoked ? '기각·폐지 플래그가 해제되었습니다.' : '기각·폐지 상태로 지정되었습니다.');
      }
      return;
    }

    // 규칙: 신청서 제출 이후 단계에서는 신청서 제출 이전 단계로의 임의 역행 차단
    if (isAfterSubmission && targetIndex < SUBMISSION_INDEX) {
      toast.error('법원 접수(신청서 제출) 이후 단계에서는 접수 이전 단계로 변경할 수 없습니다.', {
        description: '법원 심리 진행 중인 사건의 역행은 불가하며, 취하/기각 시에는 폐지 플래그를 사용하세요.',
      });
      return;
    }

    onSelectStage(targetStage.id);
    toast.success(`사건 단계가 [${targetStage.label}] 단계로 변경되었습니다.`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-200 shadow-md select-none">
      {/* 상단: 타이틀 + 현재 단계 요약 + 기각/폐지 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide ${
            isBankruptcy ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {isBankruptcy ? '개인파산 13단계' : '개인회생 13단계'}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="text-slate-500">현재 단계:</span>
            <span className="font-extrabold text-white text-sm tracking-tight">{currentStageConfig.label}</span>
            <span className="text-slate-500 text-[11px]">({safeCurrentIndex + 1}/13)</span>
          </div>
        </div>

        {/* 기각 및 폐지 체크박스 토글 */}
        <div className="flex items-center gap-3">
          {onToggleDismissedRevoked && (
            <label className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
              isDismissedRevoked 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}>
              <input 
                type="checkbox"
                checked={isDismissedRevoked}
                onChange={e => onToggleDismissedRevoked(e.target.checked)}
                className="rounded accent-rose-500 cursor-pointer"
              />
              <span>기각 및 폐지</span>
            </label>
          )}

          {isAfterSubmission && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
              <Lock className="w-3 h-3" />
              <span>접수 후 이전 단계 역행 제한</span>
            </span>
          )}
        </div>
      </div>

      {/* 가로 스크롤 가능한 13단계 체인 바 */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center min-w-[780px] gap-1">
          {stages.map((stg, idx) => {
            const isCompleted = idx < safeCurrentIndex;
            const isCurrent = idx === safeCurrentIndex;
            const isLocked = isAfterSubmission && idx < SUBMISSION_INDEX;
            const isDismissedStage = stg.id === 'dismissed_revoked' || stg.id === 'bankruptcy_closed';

            return (
              <React.Fragment key={stg.id}>
                <button
                  type="button"
                  onClick={() => handleStageClick(stg, idx)}
                  disabled={readOnly}
                  className={`group relative flex flex-col items-center justify-center py-2 px-2.5 rounded-xl text-center transition-all cursor-pointer select-none shrink-0 min-w-[56px] ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400 font-black'
                      : isCompleted
                      ? 'bg-slate-800/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60 font-semibold'
                      : isDismissedStage && isDismissedRevoked
                      ? 'bg-rose-600 text-white font-black'
                      : isLocked
                      ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                  title={`${idx + 1}단계: ${stg.label}`}
                >
                  {/* 상단 번호 / 완료 아이콘 */}
                  <div className="flex items-center gap-1 mb-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : isLocked ? (
                      <Lock className="w-3 h-3 text-slate-500" />
                    ) : (
                      <span className={`text-[10px] font-mono leading-none ${isCurrent ? 'text-blue-100' : 'text-slate-500'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* 라벨 (짧은 라벨 + 풀 라벨 툴팁) */}
                  <span className={`text-xs tracking-tight whitespace-nowrap ${isCurrent ? 'text-white' : ''}`}>
                    {stg.shortLabel}
                  </span>

                  {/* 접수 단계 구분선 악센트 뱃지 */}
                  {stg.id === 'petition_submitted' && (
                    <span className="absolute -bottom-1.5 bg-amber-500 text-slate-950 font-black text-[8px] px-1 rounded-sm leading-tight">
                      접수
                    </span>
                  )}
                </button>

                {/* 단계 간 화살표 */}
                {idx < stages.length - 1 && (
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    idx < safeCurrentIndex ? 'text-emerald-500/60' : 'text-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
