import React from 'react';
import { 
  FileCheck2, FolderArchive, Send, Scale, ShieldCheck, 
  Lock, CheckCircle2, ChevronRight, Sparkles, LayoutList,
  Layers, AlertCircle, UserCheck, FileText, Check
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { useDialog } from '../../common/DialogProvider';

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

  // 제안서 발송 및 의뢰인 연락처 공개 여부
  const isContracted = ['contracted', 'documents_pending', 'filed', 'commenced', 'repaying', 'discharged'].includes(
    crmExt?.crmStatus || clientRequest.status || ''
  );
  const hasProposalSent = Boolean(clientRequest.hasProposalSent || crmExt?.hasProposalSent);
  const isContactShared = Boolean(
    isContracted || 
    clientRequest.isContactShared || 
    crmExt?.isContactShared || 
    (clientRequest.phone && !clientRequest.phone.includes('*'))
  );

  // 선후행 상태 산출
  const isConsultCompleted = (!!crmExt?.crmStatus && crmExt.crmStatus !== 'requested') || isContracted;
  const isContractCompleted = isContracted || (isConsultCompleted && !['requested', 'consulting'].includes(crmExt?.crmStatus || ''));
  const isDocCompleted = isContractCompleted && (crmExt?.uploadedFiles?.length || 0) >= 3;
  const isFilingCompleted = ['filed', 'commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || '');
  const isCommenced = ['commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || '');
  const isDischarged = crmExt?.crmStatus === 'discharged';

  // 단계별 락(Lock) 조건
  const isStage2Locked = !isContracted && (!hasProposalSent || !isContactShared);
  const isStage3Locked = !isContractCompleted;
  const isStage4Locked = !isContractCompleted;
  const isStage5Locked = !isFilingCompleted && !crmExt?.courtCase?.caseNumber;
  const isStage6Locked = !isCommenced;

  const stages = [
    {
      stage: 1 as PipelineStage,
      number: '01',
      title: '상담·적격 검토',
      desc: '제595조 결격사유 & 사건유형 확정',
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
      desc: isStage2Locked 
        ? (!hasProposalSent ? '🔒 제안서 발송 필요' : '🔒 고객 확인 대기') 
        : '실비·수임료 산출 & 모바일 전자계약',
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
      desc: isStage3Locked ? '🔒 수임계약 체결 필요' : '4대 발급처 서류 & 진술서 동기화',
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
      desc: isStage4Locked ? '🔒 수임계약 체결 필요' : '8대 서식 + 금지명령 일괄 패키징',
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
      desc: isStage5Locked ? '🔒 법원 정식접수 필요' : '나의사건 크롤링 & 7대 표 소명서',
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
      desc: isStage6Locked ? '🔒 법원 개시결정 필요' : '가상계좌 적립금 & 채권자집회·면책',
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
      let lockReason = '선행 절차가 아직 완료되지 않았습니다.';
      if (targetStage >= 2 && (!hasProposalSent || !isContactShared)) {
        lockReason = !hasProposalSent
          ? '[Stage 01 맞춤 제안서 발송]이 필요합니다.\n의뢰인에게 제안서를 먼저 작성·발송하고, 의뢰인이 제안서를 확인해야 다음 단계로 이동할 수 있습니다.'
          : '의뢰인이 발송된 제안서를 확인하고 상담 요청(연락처 공개)을 진행해야 다음 단계로 이동할 수 있습니다.';
      } else if (targetStage >= 3 && !isContractCompleted) {
        lockReason = '[Stage 02 계약·착수] 단계에서 수임계약 체결이 완료되어야 서류 수합 및 신청서 작성 단계로 진행할 수 있습니다.';
      } else if (targetStage >= 4 && !isContractCompleted) {
        lockReason = '[Stage 02 수임계약 체결]이 완료되어야 법원 전자소송 접수 단계로 진행할 수 있습니다.';
      } else if (targetStage >= 5 && !isFilingCompleted) {
        lockReason = '[Stage 04 신청서 작성·접수] 단계에서 대법원 전자소송 정식 접수가 완료되어야 법원 대응 및 보정 단계로 진행할 수 있습니다.';
      } else if (targetStage === 6 && !isCommenced) {
        lockReason = '[Stage 05 법원대응·보정] 단계에서 법원의 개시결정이 내려져야 사후관리 및 면책 단계로 진행할 수 있습니다.';
      }

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

  // 전체 파이프라인 진척도 (%)
  const completedCount = stages.filter(s => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / stages.length) * 100);

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      {/* 상단 컨트롤 바: 파이프라인 진척도 & 뷰 모드 토글 */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1E3A5F] animate-pulse" />
            <span className="font-black text-slate-900 text-sm tracking-tight">
              사건 처리 6단계 실무 파이프라인
            </span>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold font-mono">
            {isBankruptcy ? '개인파산·면책' : '개인회생'}
          </span>
          <div className="hidden sm:flex items-center gap-2.5 text-slate-500 text-[11px] pl-2 border-l border-slate-200">
            <span>누적 진척도</span>
            <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#1E3A5F] rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-800">{progressPercent}%</span>
            <span className="text-[10px] text-slate-400 font-medium">({completedCount}/6단계 완료)</span>
          </div>
        </div>

        {/* 뷰 모드 전환 버튼 (단색화) */}
        <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => onToggleViewMode('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer press-scale ${
              viewMode === 'pipeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>순차 파이프라인 뷰</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!isContracted && (!hasProposalSent || !isContactShared)) {
                await dialog.alert({
                  title: '🔒 전체 서브탭 접근 제한',
                  message: '맞춤 제안서 발송 및 고객 확인이 완료되기 전에는 사건의 비밀 보호 및 순차 진행을 위해 전체 서브탭 뷰가 제한됩니다.\n\n먼저 [맞춤 제안서 작성 및 발송]을 진행해 주세요.',
                  variant: 'warning'
                });
                return;
              }
              onToggleViewMode('subtabs');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer press-scale ${
              viewMode === 'subtabs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5 text-slate-500" />
            <span>전체 서브탭 뷰</span>
          </button>
        </div>
      </div>

      {/* 6단계 가로형 스텝 바 (눈에 띄는 백그라운드 쉘프 + 카드 타일 + 고대비 상태별 배경색) */}
      <div className="p-2 sm:p-2.5 bg-slate-100/90 border-t border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {stages.map((st) => {
            const isActive = currentStage === st.stage && viewMode === 'pipeline';
            const IconComponent = st.icon;

            return (
              <button
                key={st.stage}
                type="button"
                onClick={() => handleStageClick(st.stage, st.isLocked)}
                className={`p-2.5 sm:p-3 text-left transition-all relative flex flex-col justify-between rounded-xl cursor-pointer press-scale min-h-[82px] group ${
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
                <div className="flex items-center justify-between mb-2">
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
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors ${
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
                    <div className={`text-[10px] truncate mt-0.5 font-normal ${
                      isActive ? 'text-blue-100' : 'text-slate-500'
                    }`}>
                      {st.desc}
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
