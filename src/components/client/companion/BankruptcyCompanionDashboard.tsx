import React, { useState } from 'react';
import { BankruptcyCompanionCase } from '../../../types';
import { Scale, CheckCircle2, Clock, Calendar, FileText, Upload, AlertCircle, ShieldCheck, UserCheck, MessageSquare, Search } from 'lucide-react';
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
}

export default function BankruptcyCompanionDashboard({
  caseData,
  clientId,
  onCaseUpdated,
  onOpenCrisisModal
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

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* 사건 요약 카드 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full">
              개인파산·면책 절차 모드
            </span>
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
              {caseData.sourceType === 'external_office' ? '타 사무소 진행' : caseData.sourceType === 'self_litigant' ? '나홀로 진행' : '마이김변 변호사'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            🕊️ <span className="text-purple-600 dark:text-purple-400">{caseData.alias}</span> 님의 파산동행
          </h2>
          <p className="text-xs text-slate-500">
            {caseData.courtName} | 사건번호: {caseData.caseNumberMasked || '미등록'} | 담당 파산관재인: {caseData.bankruptcyTrusteeName || '미등록'}
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full md:w-72">
          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
              <Clock className="w-4 h-4" />
              <span>다음 주요 기일 D-Day</span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {nextStage ? `${nextStage.targetDate} (${nextStage.stageName})` : '등록된 기일 없음'}
            </p>
            <span className="text-[11px] text-slate-600 dark:text-slate-300 block">
              {nextDday === null ? '법원·관재인에게 받은 기일을 등록하면 D-Day를 표시합니다.' : nextDday >= 0 ? `D-${nextDday}` : `${-nextDday}일 지남`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCourtModalOpen(true)}
            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-purple-400 dark:text-purple-600" />
              <span>대법원 파산사건 실시간 조회</span>
            </div>
            <Scale className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 파산 절차 6단계 타임라인 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-600" />
            <span>파산·면책 절차 타임라인</span>
          </h3>
          <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            {timelines.length === 0 ? '단계 미등록' : currentIdx >= 0 ? `${currentIdx + 1}단계 진행 중 (총 ${timelines.length}단계)` : `${doneCount}/${timelines.length}단계 완료`}
          </span>
        </div>

        <div className="space-y-4">
          {(caseData.timelines || []).map((stage, idx) => {
            const isDone = stage.status === 'completed';
            const isCurrent = stage.status === 'in_progress';

            return (
              <div
                key={stage.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-950/20 ring-1 ring-purple-500/20'
                    : isDone
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50'
                    : 'border-slate-150 dark:border-slate-850 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                    isDone ? 'bg-emerald-500 text-white' :
                    isCurrent ? 'bg-purple-600 text-white animate-pulse' :
                    'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-bold ${isCurrent ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {stage.stageName}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isDone ? 'bg-emerald-50 text-emerald-600' :
                        isCurrent ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isDone ? '완료' : isCurrent ? '진행 중' : '예정'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {stage.description}
                    </p>
                  </div>
                </div>

                {stage.targetDate && (
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {stage.targetDate}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 파산관재인 소명 서류 보관함 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <span>파산관재인 제출 및 소명 서류함</span>
          </h3>
          <label className="px-3.5 min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-[0.98]">
            <Upload className="w-3.5 h-3.5" />
            <span>제출 서류 기록</span>
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="space-y-2">
          {uploadedFiles.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{doc.name}</p>
                  <p className="text-[10px] text-slate-400">등록일: {doc.uploadedAt}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${doc.status === 'reviewed' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                {doc.status === 'reviewed' ? '검토 완료' : '제출 준비'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 대법원 실시간 파산사건 조회 모달 */}
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
