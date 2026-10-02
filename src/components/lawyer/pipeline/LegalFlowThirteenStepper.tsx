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
  /** false(또는 false로 끝나는 Promise)를 돌려주면 저장 실패로 보고 '변경되었습니다' 안내를 띄우지 않는다 */
  onSelectStage: (stageId: string) => void | boolean | Promise<void | boolean>;
  onToggleDismissedRevoked?: (val: boolean) => void;
  readOnly?: boolean;
}

export default function LegalFlowThirteenStepper({
  currentStageId = 'consult_waiting',
  isBankruptcy = false,
  isDismissedRevoked = false,
  onSelectStage,
  onToggleDismissedRevoked,
  readOnly = true,
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

  const handleStageClick = async (targetStage: LegalFlowStageConfig, targetIndex: number) => {
    if (readOnly) {
      toast.info(`세부 절차 안내: [${targetStage.label}]`, {
        description: '법원 진행 단계는 결정 등록 및 사건 진행 상황에 따라 자동으로 동기화됩니다.',
      });
      return;
    }

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

    // 저장 결과를 기다린 뒤 안내
    const result = await onSelectStage(targetStage.id);
    if (result === false) return;
    toast.success(`사건 단계가 [${targetStage.label}] 단계로 변경되었습니다.`);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 text-slate-800 shadow-xs select-none">
      {/* 상단: 타이틀 + 현재 단계 요약 + 동기화 안내 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${
            isBankruptcy 
              ? 'bg-purple-50 text-purple-700 border border-purple-200' 
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {isBankruptcy ? '개인파산 13단계 세부 절차' : '개인회생 13단계 세부 절차'}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-slate-400">현재 법원 단계:</span>
            <span className="font-bold text-slate-900 text-sm tracking-tight">{currentStageConfig.label}</span>
            <span className="text-slate-400 text-xs">({safeCurrentIndex + 1}/13)</span>
          </div>
        </div>

        {/* 상태 표시 및 기각/폐지 플래그 */}
        <div className="flex items-center gap-2.5">
          {readOnly ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>법원 결정 등록 시 자동 갱신 (읽기 전용 타임라인)</span>
            </span>
          ) : (
            onToggleDismissedRevoked && (
              <label className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                isDismissedRevoked 
                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}>
                <input 
                  type="checkbox"
                  checked={isDismissedRevoked}
                  onChange={e => onToggleDismissedRevoked(e.target.checked)}
                  className="rounded accent-rose-600 cursor-pointer"
                />
                <span>기각 및 폐지</span>
              </label>
            )
          )}

          {isAfterSubmission && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              <Lock className="w-3.5 h-3.5" />
              <span>법원 심리 진행 중</span>
            </span>
          )}
        </div>
      </div>

      {/* 가로 스크롤 가능한 13단계 타임라인 체인 바 */}
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
                  className={`group relative flex flex-col items-center justify-center py-2 px-2.5 rounded-xl text-center transition-all cursor-pointer select-none shrink-0 min-w-[58px] ${
                    isCurrent
                      ? 'bg-[#1E3A5F] text-white shadow-sm ring-2 ring-[#1E3A5F]/20 font-bold'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70 border border-emerald-200/80 font-medium'
                      : isDismissedStage && isDismissedRevoked
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                      : isLocked
                      ? 'bg-slate-50 text-slate-400 border border-slate-200/50 cursor-default opacity-70'
                      : 'bg-slate-50/70 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/60'
                  }`}
                  title={`${idx + 1}단계: ${stg.label} ${readOnly ? '(상세 안내 보기)' : ''}`}
                >
                  {/* 상단 번호 / 완료 아이콘 */}
                  <div className="flex items-center gap-1 mb-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <span className={`text-xs font-mono font-bold leading-none ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* 라벨 (짧은 라벨) */}
                  <span className={`text-xs tracking-tight whitespace-nowrap font-medium ${isCurrent ? 'text-white font-bold' : ''}`}>
                    {stg.shortLabel}
                  </span>

                  {/* 접수 단계 구분선 악센트 뱃지 */}
                  {stg.id === 'petition_submitted' && (
                    <span className="absolute -bottom-1.5 bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs px-1 rounded leading-tight scale-90">
                      접수
                    </span>
                  )}
                </button>

                {/* 단계 간 화살표 */}
                {idx < stages.length - 1 && (
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    idx < safeCurrentIndex ? 'text-emerald-500' : 'text-slate-300'
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
