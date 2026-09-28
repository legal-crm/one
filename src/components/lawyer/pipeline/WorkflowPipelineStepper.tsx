import React from 'react';
import { 
  FileCheck2, FolderArchive, Send, Scale, ShieldCheck, 
  Lock, CheckCircle2, ChevronRight, Sparkles, LayoutList,
  Layers, AlertCircle, UserCheck, FileText, Check
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { useDialog } from '../../common/DialogProvider';
import { computePipelineGates, pipelineLockReason } from './pipelineGates';

export type PipelineStage = 1 | 2 | 3 | 4 | 5 | 6;

interface WorkflowPipelineStepperProps {
  currentStage: PipelineStage;
  onSelectStage: (stage: PipelineStage) => void;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  isBankruptcy?: boolean;
  viewMode: 'pipeline' | 'subtabs';
  onToggleViewMode: (mode: 'pipeline' | 'subtabs') => void;
}

export default function WorkflowPipelineStepper({
  currentStage,
  onSelectStage,
  clientRequest,
  crmExt,
  isBankruptcy = false,
  viewMode,
  onToggleViewMode,
}: WorkflowPipelineStepperProps) {
  const dialog = useDialog();

  // 게이트 산식은 pipelineGates.ts 단일 출처 (CrmTab의 '다음 단계' 이동에도 동일 적용)
  // 이전: 'document'(서류수집) 상태가 계약완료 목록에 없어 서류 단계 사건이 잠김으로 표시됨
  const gates = computePipelineGates(clientRequest, crmExt);
  const { isConsultCompleted, isContractCompleted, isDocCompleted, isFilingCompleted, isCommenced, isDischarged } = gates;
  const isStage2Locked = gates.locked[2];
  const isStage3Locked = gates.locked[3];
  const isStage4Locked = gates.locked[4];
  const isStage5Locked = gates.locked[5];
  const isStage6Locked = gates.locked[6];

  const stages = [
    {
      stage: 1 as PipelineStage,
      number: '01',
      title: '상담·적격 검토',
      icon: UserCheck,
      isCompleted: isConsultCompleted,
      isLocked: false,
      badgeText: isConsultCompleted ? '적격 판정' : '상담 중',
      badgeColor: isConsultCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      stage: 2 as PipelineStage,
      number: '02',
      title: '계약·착수',
      icon: FileCheck2,
      isCompleted: isContractCompleted,
      isLocked: isStage2Locked,
      badgeText: isContractCompleted ? '체결 완료' : isStage2Locked ? '잠김' : '계약 대기',
      badgeColor: isContractCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      stage: 3 as PipelineStage,
      number: '03',
      title: '고객정보·서류수집',
      icon: FolderArchive,
      isCompleted: isDocCompleted,
      isLocked: isStage3Locked,
      badgeText: isDocCompleted ? '서류 완비' : isStage3Locked ? '잠김' : `${(crmExt?.uploadedFiles || []).length}건 수합중`,
      badgeColor: isDocCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      stage: 4 as PipelineStage,
      number: '04',
      title: '신청서 작성·접수',
      icon: Send,
      isCompleted: isFilingCompleted,
      isLocked: isStage4Locked,
      badgeText: isFilingCompleted ? '접수 완료' : isStage4Locked ? '잠김' : '작성 대기',
      badgeColor: isFilingCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
      stage: 5 as PipelineStage,
      number: '05',
      title: '법원대응·보정',
      icon: Scale,
      isCompleted: isCommenced,
      isLocked: isStage5Locked,
      badgeText: (crmExt?.corrections?.length || 0) > 0 ? `보정 ${crmExt?.corrections?.length}건` : isStage5Locked ? '잠김' : '심리 중',
      badgeColor: (crmExt?.corrections?.length || 0) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
    },
    {
      stage: 6 as PipelineStage,
      number: '06',
      title: '사후관리·면책',
      icon: ShieldCheck,
      isCompleted: isDischarged,
      isLocked: isStage6Locked,
      badgeText: isDischarged ? '면책 확정' : isCommenced ? '인가 관리' : isStage6Locked ? '잠김' : '개시 대기',
      badgeColor: isDischarged ? 'bg-purple-50 text-purple-700 border-purple-200' : isCommenced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
    }
  ];

  // 잠긴 단계 클릭 시 경고 안내 팝업
  const handleStageClick = async (targetStage: PipelineStage, isLocked: boolean) => {
    if (isLocked) {
      const lockReason = pipelineLockReason(targetStage, gates);

      await dialog.alert({
        title: `🔒 Stage 0${targetStage} 잠김 안내`,
        message: lockReason,
        variant: 'warning'
      });
      return;
    }

    onToggleViewMode('pipeline');
    onSelectStage(targetStage);
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      {/* 6단계 가로형 스텝 바 (각 버튼에 단계 및 진척도 완결 노출) */}
      <div className="p-2 sm:p-2.5 bg-slate-100/90">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {stages.map((st) => {
            const isActive = currentStage === st.stage && viewMode === 'pipeline';
            const IconComponent = st.icon;

            return (
              <button
                key={st.stage}
                type="button"
                onClick={() => handleStageClick(st.stage, st.isLocked)}
                className={`p-2.5 text-left transition-all relative flex flex-col justify-between rounded-xl cursor-pointer press-scale min-h-[66px] group ${
                  isActive 
                    ? 'bg-[#1E3A5F] text-white shadow-md border-2 border-[#1E3A5F] ring-2 ring-blue-500/25 z-10' 
                    : st.isCompleted
                      ? 'bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-300/80 text-emerald-950 shadow-2xs'
                      : st.isLocked
                        ? 'bg-white/60 hover:bg-white/90 border border-dashed border-slate-300 text-slate-400 opacity-80 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 shadow-2xs'
                }`}
              >
                {/* 활성화 시 상단 발광 바 */}
                {isActive && (
                  <div className="absolute top-0 left-3 right-3 h-0.5 bg-blue-400 rounded-full" />
                )}

                {/* 스텝 헤더 (번호 + 뱃지) */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded ${
                      isActive 
                        ? 'text-blue-100 bg-white/15' 
                        : st.isCompleted 
                          ? 'text-emerald-800 bg-emerald-100/80' 
                          : 'text-slate-600 bg-slate-100'
                    }`}>
                      {st.number}
                    </span>
                    {st.isCompleted ? (
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`} />
                    ) : st.isLocked ? (
                      <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-blue-200' : 'text-slate-400'}`} />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    )}
                  </div>

                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap shadow-2xs border ${
                    isActive
                      ? 'bg-blue-500 text-white border-blue-400'
                      : st.isCompleted
                        ? 'bg-white/90 text-emerald-800 border-emerald-300'
                        : st.isLocked
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {st.badgeText}
                  </span>
                </div>

                {/* 스텝 본문 (아이콘 + 타이틀) */}
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isActive 
                      ? 'bg-white text-[#1E3A5F] shadow-xs font-black' 
                      : st.isCompleted
                        ? 'bg-emerald-200/80 text-emerald-800'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}>
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-black truncate tracking-tight ${
                      isActive ? 'text-white' : 'text-slate-900'
                    }`}>
                      {st.title}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
