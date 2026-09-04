import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, FileText, Send, Clock, Edit3, CheckCircle2, 
  Microscope, Eye, Sparkles, Settings, User, X
} from 'lucide-react';
import { toast } from 'sonner';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import type { AIAnalysisData, ProposalData } from './LawyerProposalDraft';
import { ClientReferencePanel } from './ClientReferencePanel';
import LawyerProposalDraft from './LawyerProposalDraft';
import { useProposalDraft, ProposalDraftState } from '../../hooks/useProposalDraft';
import { TemplateManageModal } from './TemplateManageModal';

interface ProposalWorkspaceProps {
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  consultRequest: any;
  onClose: () => void;
  onSendProposal: (proposalData: ProposalData) => void;
  viewerRole?: 'lawyer' | 'staff' | 'reviewer';
  onRequestConfirm?: (proposalData: ProposalData, memo: string) => void;
  onApproveProposal?: (proposalData: ProposalData) => void;
  onRejectProposal?: (reason: string) => void;
  pendingStaffName?: string;
  aiAnalysis?: AIAnalysisData;
  crmNotes?: Array<{ id: string; content: string; category: string; createdAt: string; authorName: string }>;
  isAIPremiumEnabled?: boolean;
  factOutput?: any;
  ruleOutput?: any;
  lawyerInfo?: {
    name: string;
    firmName?: string;
    avatar?: string;
  };
}

export default function ProposalWorkspace({
  rehabCalcResult,
  rehabUserInput,
  consultRequest,
  onClose,
  onSendProposal,
  viewerRole = 'lawyer',
  onRequestConfirm,
  onApproveProposal,
  onRejectProposal,
  pendingStaffName,
  aiAnalysis,
  crmNotes,
  isAIPremiumEnabled = false,
  factOutput,
  ruleOutput,
  lawyerInfo
}: ProposalWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<'info' | 'editor'>('editor');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  const clientId = consultRequest?.id || 'unknown';
  const clientName = rehabUserInput.name || consultRequest?.clientName || consultRequest?.financialProfile?.clientName || '고객';
  const { savedDraft, scheduleAutoSave, clearDraft, lastSavedAt, isDirty } = useProposalDraft(clientId);
  
  // 초안 복원 여부 결정
  const [useDraft, setUseDraft] = useState<boolean>(!!savedDraft);

  useEffect(() => {
    if (savedDraft) {
      toast('이전 작성 내용이 있습니다. 이어서 작성하시겠습니까?', {
        action: {
          label: '이어쓰기',
          onClick: () => setUseDraft(true)
        },
        cancel: {
          label: '새로 작성',
          onClick: () => {
            clearDraft();
            setUseDraft(false);
          }
        },
        duration: 6000,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft 변경 시 자동 저장 스케줄링
  const handleDraftChange = useCallback((draft: ProposalDraftState) => {
    scheduleAutoSave(draft);
  }, [scheduleAutoSave]);

  const handleSendProposal = useCallback((data: ProposalData) => {
    onSendProposal(data);
    clearDraft();
  }, [onSendProposal, clearDraft]);

  const handleRequestConfirm = useCallback((data: ProposalData, memo: string) => {
    if (onRequestConfirm) {
      onRequestConfirm(data, memo);
      clearDraft();
    }
  }, [onRequestConfirm, clearDraft]);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const isAIPremium = !!aiAnalysis || isAIPremiumEnabled;

  // 좌측 패널 ➔ 우측 제안서 이벤트 디스패치 브리지
  const handleQuoteQuestion = useCallback((question: string, defaultAnswer?: string) => {
    document.dispatchEvent(new CustomEvent('proposal-quote-question', {
      detail: { question, defaultAnswer }
    }));
    // 모바일인 경우 작성 탭으로 자동 이동
    setMobileTab('editor');
  }, []);

  const handleApplyPlan = useCallback((plan: { monthlyPayment: number; months: number; reductionRate: number; name?: string }) => {
    document.dispatchEvent(new CustomEvent('proposal-apply-plan', {
      detail: plan
    }));
    setMobileTab('editor');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden font-sans select-none animate-fadeIn">
      
      {/* ── 1. 프리미엄 상단 헤더 ── */}
      <header className="shrink-0 h-14 bg-[#0F172A] text-white flex items-center justify-between px-4 sm:px-6 shadow-md z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer min-h-[38px]"
            title="사건 분석으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
            <span className="font-bold text-xs whitespace-nowrap">사건 분석으로 돌아가기</span>
          </button>
          
          <div className="hidden md:block w-px h-5 bg-slate-700" />
          
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-sm sm:text-[15px] text-white truncate flex items-center gap-1.5">
              <span>{clientName}님 맞춤 제안서 스튜디오</span>
            </h1>
            {isAIPremium && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-[#1E3A5F] text-blue-200 text-[11px] font-extrabold px-2 py-0.5 rounded-lg border border-blue-400/30">
                <Microscope className="w-3 h-3 text-blue-300" />
                AI 실무분석 연동
              </span>
            )}
          </div>
        </div>

        {/* 중앙: 에디터 ↔ 고객 미리보기 탭 스위처 */}
        <div className="hidden md:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setViewMode('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'editor' 
                ? 'bg-[#1E3A5F] text-white shadow-xs' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            제안서 작성
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'preview' 
                ? 'bg-[#1E3A5F] text-white shadow-xs' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            고객 시점 미리보기
          </button>
        </div>

        {/* 우측: 저장 상태 & 닫기 */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[11px] text-amber-300 font-bold animate-pulse">저장 중...</span>
          )}
          {lastSavedAt && !isDirty && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300 text-xs bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>자동저장 {formatTime(lastSavedAt)}</span>
            </div>
          )}

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="템플릿 & 패키지 설정"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile Segmented Tabs ── */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setMobileTab('info')}
          className={`flex-1 flex justify-center items-center py-3 text-xs font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
            mobileTab === 'info' 
              ? 'border-[#1E3A5F] text-[#1E3A5F] bg-[#1E3A5F]/5' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          고객 상황 및 AI 분석
        </button>
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 flex justify-center items-center py-3 text-xs font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
            mobileTab === 'editor' 
              ? 'border-[#1E3A5F] text-[#1E3A5F] bg-[#1E3A5F]/5' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Edit3 className="w-4 h-4 mr-1.5" />
          제안서 작성
        </button>
      </div>

      {/* ── Main Split-Pane Content (독립 듀얼 스크롤) ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0 bg-slate-100">
        
        {/* 좌측: 고객 상황 360° 인텔리전스 패널 (42% 폭, 독립 스크롤) */}
        <div className={`
          lg:w-[42%] h-full min-h-0 lg:border-r border-slate-200 overflow-hidden flex flex-col bg-slate-50
          ${mobileTab === 'info' ? 'block' : 'hidden lg:block'}
        `}>
          <ClientReferencePanel 
            rehabCalcResult={rehabCalcResult}
            rehabUserInput={rehabUserInput}
            consultRequest={consultRequest}
            aiAnalysis={aiAnalysis}
            crmNotes={crmNotes}
            isAIPremiumEnabled={isAIPremium}
            factOutput={factOutput}
            ruleOutput={ruleOutput}
            onQuoteQuestion={handleQuoteQuestion}
            onApplyPlan={handleApplyPlan}
          />
        </div>

        {/* 우측: 초고속 제안서 빌더 & Live Preview (58% 폭, 독립 스크롤) */}
        <div className={`
          lg:w-[58%] h-full min-h-0 overflow-hidden flex flex-col bg-white
          ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}
        `}>
          <LawyerProposalDraft 
            mode="embedded"
            rehabCalcResult={rehabCalcResult}
            rehabUserInput={rehabUserInput}
            consultRequest={consultRequest}
            onClose={onClose}
            onSendProposal={handleSendProposal}
            viewerRole={viewerRole}
            onRequestConfirm={handleRequestConfirm}
            onApproveProposal={onApproveProposal}
            onRejectProposal={onRejectProposal}
            pendingStaffName={pendingStaffName}
            aiAnalysis={aiAnalysis}
            initialDraft={useDraft ? savedDraft : null}
            onDraftChange={handleDraftChange}
            activeViewMode={viewMode}
            onToggleViewMode={setViewMode}
            lawyerInfo={lawyerInfo}
          />
        </div>
      </div>

      {/* ── Sticky Action Footer ── */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center justify-between shadow-md z-10">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors active:scale-95 min-h-[44px] whitespace-nowrap cursor-pointer"
        >
          사건 분석으로 돌아가기
        </button>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(prev => prev === 'editor' ? 'preview' : 'editor')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
          >
            {viewMode === 'editor' ? (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                고객 시점 미리보기
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-[#1E3A5F]" />
                에디터로 돌아가기
              </>
            )}
          </button>

          {viewerRole === 'lawyer' ? (
            <button
              onClick={() => {
                document.dispatchEvent(new CustomEvent('proposal-workspace-submit'));
              }}
              className="px-6 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              <Send className="w-4 h-4" />
              고객에게 제안서 발송하기
            </button>
          ) : viewerRole === 'reviewer' ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onRejectProposal && onRejectProposal('보완 필요')}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all active:scale-95 whitespace-nowrap min-h-[44px] cursor-pointer"
              >
                반려
              </button>
              <button 
                onClick={() => {
                  document.dispatchEvent(new CustomEvent('proposal-workspace-submit'));
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap min-h-[44px] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                승인 및 고객 발송
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                document.dispatchEvent(new CustomEvent('proposal-workspace-submit'));
              }}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-amber-500 hover:bg-amber-600 shadow-md flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap min-h-[44px] cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              변호사 컨펌 요청
            </button>
          )}
        </div>
      </footer>

      {/* 템플릿 관리 모달 */}
      <TemplateManageModal
        lawyerId={consultRequest?.selectedLawyerId || 'default'}
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
}
