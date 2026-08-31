import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileText, Send, Clock, Edit3, CheckCircle2, Microscope } from 'lucide-react';
import { toast } from 'sonner';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import type { AIAnalysisData, ProposalData } from './LawyerProposalDraft';
import { ClientReferencePanel } from './ClientReferencePanel';
import LawyerProposalDraft from './LawyerProposalDraft';
import { useProposalDraft } from '../../hooks/useProposalDraft';
import type { ProposalDraftState } from '../../hooks/useProposalDraft';

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
  crmNotes
}: ProposalWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<'info' | 'editor'>('editor');
  
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

  const isAIPremium = !!aiAnalysis;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* ── Sticky Header ── */}
      <header className="shrink-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-800 transition-colors active:scale-[0.98] min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden lg:inline font-medium whitespace-nowrap text-sm">고객 CRM으로 돌아가기</span>
          </button>
          
          <div className="hidden lg:block w-px h-5 bg-slate-700" />
          
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-[15px] truncate">
              {clientName}님 · 제안서 작성
            </h1>
            {isAIPremium && (
              <span className="inline-flex items-center gap-1 bg-[#1E3A5F]/30 text-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[#1E3A5F]/40">
                <Microscope className="w-3 h-3" />
                AI 정밀 분석
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-300 font-medium">저장 중...</span>
          )}
          {lastSavedAt && !isDirty && (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs bg-slate-800 px-2.5 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span>임시저장됨 {formatTime(lastSavedAt)}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile Segmented Tabs ── */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setMobileTab('info')}
          className={`flex-1 flex justify-center items-center py-3 text-sm font-semibold border-b-2 transition-colors min-h-[44px] ${
            mobileTab === 'info' 
              ? 'border-[#7264FF] text-[#7264FF]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          채무 정보
        </button>
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 flex justify-center items-center py-3 text-sm font-semibold border-b-2 transition-colors min-h-[44px] ${
            mobileTab === 'editor' 
              ? 'border-[#7264FF] text-[#7264FF]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Edit3 className="w-4 h-4 mr-1.5" />
          제안서 작성
        </button>
      </div>

      {/* ── Main Split-Pane Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* 좌측: 고객 참조 패널 (38%) */}
        <div className={`
          lg:w-[38%] h-full lg:border-r border-slate-200 overflow-y-auto
          ${mobileTab === 'info' ? 'block' : 'hidden lg:block'}
        `}>
          <ClientReferencePanel 
            rehabCalcResult={rehabCalcResult}
            rehabUserInput={rehabUserInput}
            consultRequest={consultRequest}
            aiAnalysis={aiAnalysis}
            crmNotes={crmNotes}
          />
        </div>

        {/* 우측: 제안서 편집 폼 (62%) */}
        <div className={`
          lg:w-[62%] h-full overflow-y-auto bg-white
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
          />
        </div>
      </div>

      {/* ── Sticky Footer ── */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)]">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors active:scale-[0.98] min-h-[44px] whitespace-nowrap"
        >
          닫기
        </button>
        
        {viewerRole === 'lawyer' ? (
          <button
            onClick={() => {
              // LawyerProposalDraft 내부의 handleSubmit을 트리거
              document.dispatchEvent(new CustomEvent('proposal-workspace-submit'));
            }}
            className="px-6 py-2.5 rounded-xl bg-[#7264FF] hover:bg-[#5f51e5] text-white font-semibold shadow-lg shadow-[#7264FF]/20 flex items-center gap-2 transition-all active:scale-[0.98] min-h-[44px] whitespace-nowrap"
          >
            <Send className="w-4.5 h-4.5" />
            고객에게 제안서 발송
          </button>
        ) : viewerRole === 'reviewer' ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {}}
              className="px-5 py-2.5 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
            >
              반려
            </button>
            <button 
              onClick={() => {}}
              className="px-6 py-2.5 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              승인 및 발송
            </button>
          </div>
        ) : (
          <button 
            onClick={() => {}}
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
          >
            <FileText className="w-4.5 h-4.5" />
            변호사 컨펌 요청
          </button>
        )}
      </footer>
    </div>
  );
}
