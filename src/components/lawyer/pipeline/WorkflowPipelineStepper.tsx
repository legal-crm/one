import React from 'react';
import { 
  FileCheck, FolderArchive, Send, Scale, ShieldCheck, 
  Lock, CheckCircle2, ChevronRight, Sparkles, LayoutList,
  Layers, AlertCircle
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension } from '../../../types';

export type PipelineStage = 1 | 2 | 3 | 4 | 5;

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
  // 선후행 상태 산출
  const isContractCompleted = crmExt?.crmStatus !== 'requested' && crmExt?.crmStatus !== 'consulting';
  const isDocCompleted = isContractCompleted && (crmExt?.uploadedFiles?.length || 0) >= 3;
  const isFilingCompleted = ['filed', 'commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || '');
  const isCommenced = ['commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || '');

  const stages = [
    {
      stage: 1 as PipelineStage,
      number: '01',
      title: '수임·계약',
      desc: 'AI 재무진단 & 실비 산정·전자계약',
      icon: FileCheck,
      isCompleted: isContractCompleted,
      isLocked: false,
      badgeText: isContractCompleted ? '체결 완료' : '계약 대기',
      badgeColor: isContractCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      stage: 2 as PipelineStage,
      number: '02',
      title: '서류·부채 허브',
      desc: '4대 발급처별 수합 & 제3자 마스킹',
      icon: FolderArchive,
      isCompleted: isDocCompleted,
      isLocked: false, // 열람 가능하되 안내
      badgeText: isDocCompleted ? '서류 완비' : `${(crmExt?.uploadedFiles || []).length}건 수합중`,
      badgeColor: isDocCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      stage: 3 as PipelineStage,
      number: '03',
      title: '접수·금지명령',
      desc: '8대 서식 + 금지·중지명령 일괄 결합',
      icon: Send,
      isCompleted: isFilingCompleted,
      isLocked: !isContractCompleted,
      badgeText: isFilingCompleted ? '접수 완료' : '패키징 작성',
      badgeColor: isFilingCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
      stage: 4 as PipelineStage,
      number: '04',
      title: '법원·보정센터',
      desc: '나의사건 크롤링 & 7대 표 소명서',
      icon: Scale,
      isCompleted: isCommenced,
      isLocked: !isFilingCompleted && !crmExt?.courtCase?.caseNumber,
      badgeText: (crmExt?.corrections?.length || 0) > 0 ? `보정 ${crmExt?.corrections?.length}건` : '심리 중',
      badgeColor: (crmExt?.corrections?.length || 0) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
    },
    {
      stage: 5 as PipelineStage,
      number: '05',
      title: '개시·사후관리',
      desc: '가상계좌 적립금·집회 & 별도면책',
      icon: ShieldCheck,
      isCompleted: crmExt?.crmStatus === 'discharged',
      isLocked: !isCommenced,
      badgeText: crmExt?.crmStatus === 'discharged' ? '면책 확정' : isCommenced ? '인가 관리' : '개시 대기',
      badgeColor: crmExt?.crmStatus === 'discharged' ? 'bg-purple-50 text-purple-700 border-purple-200' : isCommenced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
    }
  ];

  // 전체 파이프라인 진척도 (%)
  const completedCount = stages.filter(s => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / stages.length) * 100);

  return (
    <div className="bg-white border-b border-slate-200/80 shadow-xs">
      {/* 상단 컨트롤 바: 파이프라인 진척도 & 뷰 모드 토글 */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
            <Sparkles className="w-4 h-4 text-brand" />
            리걸플로 5단계 실무 파이프라인
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-bold">
            {isBankruptcy ? '개인파산·면책 트랙' : '개인회생 표준 트랙'}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-slate-500 text-[11px]">
            <span>진척률</span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono font-bold text-brand">{progressPercent}%</span>
          </div>
        </div>

        {/* 뷰 모드 전환 버튼 */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl">
          <button
            onClick={() => onToggleViewMode('pipeline')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'pipeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-brand" />
            <span>5단계 파이프라인 뷰</span>
          </button>
          <button
            onClick={() => onToggleViewMode('subtabs')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'subtabs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5 text-slate-500" />
            <span>상세 서브탭 뷰 (메모/태스크)</span>
          </button>
        </div>
      </div>

      {/* 5단계 가로형 스텝 바 */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-100">
        {stages.map((st) => {
          const isActive = currentStage === st.stage && viewMode === 'pipeline';
          const IconComponent = st.icon;

          return (
            <button
              key={st.stage}
              onClick={() => {
                onToggleViewMode('pipeline');
                onSelectStage(st.stage);
              }}
              className={`p-3.5 text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
                isActive 
                  ? 'bg-brand/5 ring-1 ring-inset ring-brand/20' 
                  : 'hover:bg-slate-50/80'
              }`}
            >
              {/* 활성화 인디케이터 바 */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand" />
              )}

              {/* 스텝 헤더 (번호 + 뱃지) */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono font-black ${
                    isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {st.number}
                  </span>
                  {st.isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : st.isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  )}
                </div>

                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold border whitespace-nowrap ${st.badgeColor}`}>
                  {st.badgeText}
                </span>
              </div>

              {/* 스텝 본문 (아이콘 + 타이틀) */}
              <div className="flex items-start gap-2">
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  isActive 
                    ? 'bg-brand text-white shadow-xs' 
                    : st.isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                }`}>
                  <IconComponent className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-black truncate ${
                    isActive ? 'text-brand' : 'text-slate-900 group-hover:text-slate-800'
                  }`}>
                    {st.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                    {st.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
