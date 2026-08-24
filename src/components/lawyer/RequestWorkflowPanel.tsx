import React, { useState } from 'react';
import { StickyNote, Gavel, Send, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowData {
  staffMemo?: string;
  staffChecklist?: { missingInfoChecked: boolean; factVerified: boolean };
  lawyerOpinion?: {
    procedureOpinion: string;
    legalIssues: string;
    consultationConclusion: string;
    clientGuidance: string;
    nextSteps: string;
  };
  reviewStatus?: string;
}

interface RequestWorkflowPanelProps {
  requestId: string;
  clientName: string;
  isLawyerOrOwner: boolean;
  workflow: WorkflowData;
  onUpdateWorkflow: (requestId: string, updates: Partial<WorkflowData>) => void;
}

function CollapsibleSection({ title, icon, badge, defaultOpen, children }: {
  title: string; icon: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-slate-200/80 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-slate-50/80 hover:bg-slate-100 transition-colors cursor-pointer text-left"
      >
        {icon}
        <span className="text-xs font-extrabold text-slate-700 flex-1">{title}</span>
        {badge}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && <div className="p-3.5 space-y-3 bg-white">{children}</div>}
    </div>
  );
}

export default function RequestWorkflowPanel({
  requestId,
  clientName,
  isLawyerOrOwner,
  workflow,
  onUpdateWorkflow
}: RequestWorkflowPanelProps) {
  const { staffMemo = '', staffChecklist, lawyerOpinion, reviewStatus = 'DRAFT' } = workflow;

  // Local state for editing
  const [localMemo, setLocalMemo] = useState(staffMemo);
  const [missingInfoChecked, setMissingInfoChecked] = useState(staffChecklist?.missingInfoChecked ?? false);
  const [factVerified, setFactVerified] = useState(staffChecklist?.factVerified ?? false);

  const [localOpinion, setLocalOpinion] = useState(lawyerOpinion ?? {
    procedureOpinion: '', legalIssues: '', consultationConclusion: '', clientGuidance: '', nextSteps: ''
  });

  const handleSaveStaffMemo = () => {
    onUpdateWorkflow(requestId, {
      staffMemo: localMemo,
      staffChecklist: { missingInfoChecked, factVerified },
      reviewStatus: (missingInfoChecked && factVerified) ? 'STAFF_REVIEWED' : reviewStatus
    });
    toast.success('직원 메모가 저장되었습니다.');
  };

  const handleSaveLawyerOpinion = () => {
    onUpdateWorkflow(requestId, { lawyerOpinion: localOpinion });
    toast.success('변호사 검토 의견이 저장되었습니다.');
  };

  const opinionFields = [
    { key: 'procedureOpinion' as const, label: '검토 가능 절차' },
    { key: 'legalIssues' as const, label: '법률적 쟁점' },
    { key: 'consultationConclusion' as const, label: '상담 결론' },
    { key: 'clientGuidance' as const, label: '고객 안내사항' },
    { key: 'nextSteps' as const, label: '다음 단계' },
  ];

  const statusBadge = reviewStatus !== 'DRAFT' ? (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
      reviewStatus === 'STAFF_REVIEWED' ? 'bg-amber-50 text-amber-700' :
      reviewStatus === 'LAWYER_APPROVED' ? 'bg-emerald-50 text-emerald-700' :
      reviewStatus === 'LAWYER_REJECTED' ? 'bg-red-50 text-red-700' :
      reviewStatus === 'SENT_TO_CLIENT' ? 'bg-brand/10 text-brand' :
      'bg-slate-100 text-slate-500'
    }`}>
      {reviewStatus === 'STAFF_REVIEWED' ? '직원 확인' :
       reviewStatus === 'LAWYER_APPROVED' ? '승인됨' :
       reviewStatus === 'LAWYER_REJECTED' ? '반려' :
       reviewStatus === 'SENT_TO_CLIENT' ? '발송완료' : reviewStatus}
    </span>
  ) : null;

  return (
    <div className="mt-3 space-y-2">
      {/* 직원 메모 */}
      <CollapsibleSection
        title="직원 메모"
        icon={<StickyNote className="w-3.5 h-3.5 text-amber-500" />}
        badge={statusBadge}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <label className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
            <input type="checkbox" checked={missingInfoChecked} onChange={e => setMissingInfoChecked(e.target.checked)} className="rounded" />
            <span className="text-xs text-slate-700 font-bold">누락정보 확인 완료</span>
          </label>
          <label className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
            <input type="checkbox" checked={factVerified} onChange={e => setFactVerified(e.target.checked)} className="rounded" />
            <span className="text-xs text-slate-700 font-bold">사실관계 검증 완료</span>
          </label>
          <textarea
            value={localMemo}
            onChange={e => setLocalMemo(e.target.value)}
            placeholder="내부 메모를 입력하세요..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            rows={2}
          />
          <button
            onClick={handleSaveStaffMemo}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-[0.98] whitespace-nowrap min-h-[36px]"
          >
            메모 저장
          </button>
        </div>
      </CollapsibleSection>

      {/* 변호사 검토 의견 (변호사만) */}
      {isLawyerOrOwner && (
        <CollapsibleSection
          title="변호사 검토 의견"
          icon={<Gavel className="w-3.5 h-3.5 text-brand" />}
        >
          <div className="space-y-2">
            {opinionFields.map(f => (
              <div key={f.key}>
                <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">{f.label}</label>
                <textarea
                  value={localOpinion[f.key]}
                  onChange={e => setLocalOpinion(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={`${f.label}을 입력하세요...`}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  rows={1}
                />
              </div>
            ))}
            <button
              onClick={handleSaveLawyerOpinion}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand hover:bg-brand/90 transition-all active:scale-[0.98] whitespace-nowrap min-h-[36px]"
            >
              의견 저장
            </button>
          </div>
        </CollapsibleSection>
      )}

      {/* 승인 및 발송 (변호사만) */}
      {isLawyerOrOwner && reviewStatus === 'STAFF_REVIEWED' && (
        <CollapsibleSection
          title="승인 및 발송"
          icon={<Send className="w-3.5 h-3.5 text-emerald-500" />}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onUpdateWorkflow(requestId, { reviewStatus: 'LAWYER_APPROVED' });
                toast.success(`${clientName}님 상담 건을 승인했습니다.`);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap min-h-[36px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              승인
            </button>
            <button
              onClick={() => {
                onUpdateWorkflow(requestId, { reviewStatus: 'LAWYER_REJECTED' });
                toast.info('반려 처리되었습니다.');
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all active:scale-[0.98] whitespace-nowrap min-h-[36px]"
            >
              반려
            </button>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
