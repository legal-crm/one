import React, { useState } from 'react';
import { BankruptcyCompanionCase } from '../../../types';
import { Scale, CheckCircle2, Clock, Calendar, FileText, Upload, Search, Pencil } from 'lucide-react';
import { Badge, Button, buttonClassName } from '../ui';
import { toast } from 'sonner';
import { validateUploadFile } from '../../../utils/fileSecurity';
import CourtCaseModal from './CourtCaseModal';
import { saveBankruptcyCase } from '../../../services/companionService';
import { parseLocalYmd } from '../../../utils/localDate';

interface BankruptcyCompanionDashboardProps {
  caseData: BankruptcyCompanionCase;
  clientId?: string;
  onCaseUpdated?: (updated: BankruptcyCompanionCase) => void;
  onOpenCrisisModal: () => void;
  /** 사건 정보 변경(등록 창 열기) */
  onOpenRegisterModal?: () => void;
}

export default function BankruptcyCompanionDashboard({
  caseData,
  clientId,
  onCaseUpdated,
  onOpenRegisterModal
}: BankruptcyCompanionDashboardProps) {
  const uploadedFiles = caseData?.documents || [];
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const timelines = caseData?.timelines || [];
  const doneCount = timelines.filter(s => s.status === 'completed').length;
  const currentIdx = timelines.findIndex(s => s.status === 'in_progress');
  // 다음 주요 기일: 완료되지 않은 단계 중 날짜가 입력된 가장 이른 단계 (기존: '2026.09.25' 고정 표시)
  const nextStage = timelines
    .filter(s => s.status !== 'completed' && s.targetDate)
    .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)))[0];
  const nextDday = (() => {
    const due = parseLocalYmd(String(nextStage?.targetDate || ''));
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  })();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    e.target.value = '';
    const newDoc = {
      id: `b-doc-${Date.now()}`,
      name: file.name,
      uploadedAt: new Date().toISOString().split('T')[0],
      status: 'pending' as const
    };
    // 목록(파일명·날짜)만 이 기기에 기록 — 파일은 관재인·사무소에 자동 제출되지 않음 (기존: '등록되었습니다' 안내 후 새로고침하면 사라짐)
    const updated = { ...caseData, documents: [newDoc, ...uploadedFiles] };
    saveBankruptcyCase(updated, clientId);
    onCaseUpdated?.(updated);
    toast.success(`'${file.name}'을(를) 제출 준비 목록에 기록했습니다. 파산관재인 제출은 관재인 안내 방법(우편·이메일 등) 또는 담당 사무소를 통해 진행해 주세요.`, { duration: 6000 });
  };

  const sourceLabel =
    caseData.sourceType === 'external_office' ? '다른 법률사무소 진행' : caseData.sourceType === 'self_litigant' ? '직접 진행' : '마이김변 담당 변호사';

  return (
    <div className="space-y-5 text-left">

      {/* 다음 기일(가장 위) + 사건 요약 */}
      <section aria-labelledby="bk-summary-title" className="rounded-3xl border-2 border-brand/15 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-bold text-brand">다음 할 일</p>
            <h2 id="bk-summary-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 break-keep">
              {nextStage ? `${nextStage.stageName} · ${nextStage.targetDate}` : '등록된 기일이 아직 없어요'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed break-keep">
              {nextDday === null
                ? '법원이나 파산관재인에게 받은 기일을 등록하면 남은 날을 알려 드려요.'
                : nextDday > 0 ? `${nextDday}일 남았어요.` : nextDday === 0 ? '오늘이에요.' : `${-nextDday}일 지났어요. 진행 상황을 담당자에게 확인해 주세요.`}
            </p>
          </div>
          {nextDday !== null && (
            <Badge tone={nextDday < 0 ? 'warning' : 'brand'} size="md" icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}>
              {nextDday > 0 ? `D-${nextDday}` : nextDday === 0 ? '오늘' : `${-nextDday}일 지남`}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{sourceLabel}</Badge>
          {caseData.courtName && <Badge tone="neutral">{caseData.courtName}</Badge>}
          <Badge tone="neutral">사건번호 {caseData.caseNumberMasked || '미등록'}</Badge>
          <Badge tone="neutral">파산관재인 {caseData.bankruptcyTrusteeName || '미등록'}</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={() => setIsCourtModalOpen(true)} leftIcon={<Search className="w-4 h-4" aria-hidden="true" />} className="w-full sm:w-auto">
            대법원 사건검색
          </Button>
          {onOpenRegisterModal && (
            <Button variant="ghost" onClick={onOpenRegisterModal} leftIcon={<Pencil className="w-4 h-4" aria-hidden="true" />} className="w-full sm:w-auto">
              사건 정보 변경
            </Button>
          )}
        </div>
      </section>

      {/* 파산·면책 절차 타임라인 */}
      <section aria-labelledby="bk-timeline-title" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bk-timeline-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand" aria-hidden="true" />
            파산·면책 절차
          </h2>
          <Badge tone="neutral">
            {timelines.length === 0 ? '단계 미등록' : currentIdx >= 0 ? `${currentIdx + 1}단계 진행 중 · 총 ${timelines.length}단계` : `${doneCount}/${timelines.length}단계 완료`}
          </Badge>
        </div>

        {timelines.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            등록된 절차 단계가 없어요.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {timelines.map((stage, idx) => {
              const isDone = stage.status === 'completed';
              const isCurrent = stage.status === 'in_progress';
              return (
                <li
                  key={stage.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent ? 'border-brand/40 bg-brand-light/50' : isDone ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isDone ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                      aria-hidden="true"
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{stage.stageName}</h3>
                        <Badge tone={isDone ? 'success' : isCurrent ? 'brand' : 'neutral'}>{isDone ? '완료' : isCurrent ? '진행 중' : '예정'}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">{stage.description}</p>
                    </div>
                  </div>
                  {stage.targetDate && (
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1 shrink-0 tabular-nums">
                      <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      {stage.targetDate}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 파산관재인 제출 서류 기록 */}
      <section aria-labelledby="bk-docs-title" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 id="bk-docs-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand" aria-hidden="true" />
              파산관재인 제출 서류 기록
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">
              제출할 서류의 이름과 날짜를 이 기기에 기록해요. 파일은 관재인에게 자동으로 제출되지 않아요.
            </p>
          </div>
          <label className={buttonClassName('secondary', 'md', 'shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2')}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            제출 서류 기록
            <input type="file" className="sr-only" accept="image/*,.pdf" onChange={handleFileUpload} />
          </label>
        </div>

        {uploadedFiles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            기록한 서류가 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {uploadedFiles.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-600">기록일 {doc.uploadedAt}</p>
                  </div>
                </div>
                <Badge tone={doc.status === 'reviewed' ? 'success' : 'warning'}>{doc.status === 'reviewed' ? '검토 완료' : '제출 준비'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 대법원 사건 조회 안내 모달 */}
      <CourtCaseModal
        isOpen={isCourtModalOpen}
        onClose={() => setIsCourtModalOpen(false)}
        courtName={caseData.courtName}
        caseNumber={caseData.caseNumber || ''}
        clientName={caseData.alias}
      />
    </div>
  );
}
