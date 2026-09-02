import React, { useState } from 'react';
import { BankruptcyCompanionCase } from '../../../types';
import { Scale, CheckCircle2, Clock, Calendar, FileText, Upload, AlertCircle, ShieldCheck, UserCheck, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface BankruptcyCompanionDashboardProps {
  caseData: BankruptcyCompanionCase;
  onOpenCrisisModal: () => void;
}

export default function BankruptcyCompanionDashboard({
  caseData,
  onOpenCrisisModal
}: BankruptcyCompanionDashboardProps) {
  const [uploadedFiles, setUploadedFiles] = useState(caseData.documents);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc = {
      id: `b-doc-${Date.now()}`,
      name: file.name,
      uploadedAt: new Date().toISOString().split('T')[0],
      status: 'pending' as const
    };

    setUploadedFiles(prev => [newDoc, ...prev]);
    toast.success(`${file.name} 관재인 소명 서류가 등록되었습니다.`);
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
              {caseData.sourceType === 'external_office' ? '타 사무소 진행' : '마이김변 전담 변호사'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            🕊️ <span className="text-purple-600 dark:text-purple-400">{caseData.alias}</span> 님의 파산동행
          </h2>
          <p className="text-xs text-slate-500">
            {caseData.courtName} | 사건번호: {caseData.caseNumberMasked} | 담당 파산관재인: {caseData.bankruptcyTrusteeName || '미지정'}
          </p>
        </div>

        <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 p-4 rounded-2xl shrink-0 w-full md:w-72 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
            <Clock className="w-4 h-4" />
            <span>다음 주요 기일 D-Day</span>
          </div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            2026.09.25 (보정검토)
          </p>
          <span className="text-[11px] text-slate-500 block">
            파산관재인 소명자료 추가 제출 기한
          </span>
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
            5단계 진행 중 (총 6단계)
          </span>
        </div>

        <div className="space-y-4">
          {caseData.timelines.map((stage, idx) => {
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
          <label className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-[0.98]">
            <Upload className="w-3.5 h-3.5" />
            <span>서류 추가 업로드</span>
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
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                {doc.status === 'reviewed' ? '검토 완료' : '제출 대기'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
