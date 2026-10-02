import React, { useEffect } from 'react';
import { Lock, ArrowRight, X, AlertCircle } from 'lucide-react';
import type { PipelineStage } from './JourneyRail';
import type { PipelineGateState } from '../pipeline/pipelineGates';
import { pipelineLockReason } from '../pipeline/pipelineGates';

export interface StageLockSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetStage: PipelineStage;
  gates: PipelineGateState;
  onNavigateToPrerequisite?: (stage: PipelineStage, section?: string) => void;
}

const STAGE_TITLES: Record<PipelineStage, string> = {
  1: '상담·제안',
  2: '수임 계약',
  3: '서류 준비',
  4: '신청·접수',
  5: '보정·개시',
  6: '변제·면책',
};

/**
 * 잠긴 단계 안내 시트 (기획서 3.4 & 4.3)
 * - 단순 window.alert/경고창 대신 선행 완료 필수 조건 체크리스트 제공
 * - 조건이 있는 이전 단계로 즉시 이동하는 바로가기 버튼 제공
 */
export function StageLockSheet({
  isOpen,
  onClose,
  targetStage,
  gates,
  onNavigateToPrerequisite,
}: StageLockSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 선행 조건 목록 생성
  const getRequirements = () => {
    switch (targetStage) {
      case 2:
        return [
          { label: '의뢰인에게 맞춤 제안서 발송', isMet: gates.hasProposalSent, hintStage: 1 as PipelineStage, hintSection: 'proposal' },
          { label: '의뢰인 제안서 확인 및 연락처 공개 (외부 의뢰인은 자동 충족)', isMet: gates.isContactShared, hintStage: 1 as PipelineStage, hintSection: 'proposal' },
        ];
      case 3:
        return [
          { label: '정식 사건 위임계약 체결 확정', isMet: gates.isContractCompleted, hintStage: 2 as PipelineStage, hintSection: 'contract' },
        ];
      case 4:
        return [
          { label: '사건 위임계약 체결 완료', isMet: gates.isContractCompleted, hintStage: 2 as PipelineStage, hintSection: 'contract' },
          { label: '필수 1차 서류 수합 완료', isMet: gates.isDocCompleted, hintStage: 3 as PipelineStage, hintSection: 'docs' },
        ];
      case 5:
        return [
          { label: '개시신청서 법원 정식 접수 및 사건번호 등록', isMet: gates.isFilingCompleted, hintStage: 4 as PipelineStage, hintSection: 'petition' },
        ];
      case 6:
        return [
          { label: '법원 개시결정 등록 확정', isMet: gates.isCommenced, hintStage: 5 as PipelineStage, hintSection: 'court-progress' },
        ];
      default:
        return [];
    }
  };

  const requirements = getRequirements();
  const firstUnmet = requirements.find((r) => !r.isMet);

  return (
    <div className="fixed inset-0 z-[var(--z-modal,100)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                {targetStage}단계 ({STAGE_TITLES[targetStage]}) 잠금 안내
              </h2>
              <p className="text-xs text-slate-500">
                선행 절차가 완료되어야 활성화되는 단계입니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문: 완료 조건 체크리스트 */}
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
            <span className="text-xs font-bold text-slate-500 block">
              단계 활성화를 위한 필수 선행 조건
            </span>
            <div className="space-y-2">
              {requirements.map((req, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                    req.isMet
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                        req.isMet ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {req.isMet ? '✓' : '!'}
                    </span>
                    <span className={req.isMet ? 'font-medium' : 'font-bold'}>{req.label}</span>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      req.isMet ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.isMet ? '충족' : '미완료'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-[12px] text-blue-900/90 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              {pipelineLockReason(targetStage, gates)}
            </p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            닫기
          </button>
          {firstUnmet && onNavigateToPrerequisite && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToPrerequisite(firstUnmet.hintStage, firstUnmet.hintSection);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1E3A5F] hover:bg-[#163152] rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <span>{firstUnmet.hintStage}단계로 이동하여 완료하기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
