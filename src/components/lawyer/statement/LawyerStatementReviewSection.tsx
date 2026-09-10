import React, { useState } from 'react';
import { 
  FileText, CheckCircle2, AlertTriangle, Printer, 
  Send, Sparkles, User, ShieldCheck, Clock, RefreshCw, MessageSquare, Download 
} from 'lucide-react';
import { toast } from 'sonner';
import type { CourtStatementData } from '../../../types/statementTypes';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { StatementService } from '../../../services/statementService';
import PrintableCourtStatementModal from '../../client/statement/PrintableCourtStatementModal';

interface LawyerStatementReviewSectionProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

export default function LawyerStatementReviewSection({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사'
}: LawyerStatementReviewSectionProps) {
  const statement = crmExt.courtStatement;
  const isRehab = clientRequest.caseType === 'rehab' || clientRequest.category === 'individual_rehab' || !crmExt.bankruptcyData;
  const clientName = clientRequest.clientName || '의뢰인';

  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [lawyerNote, setLawyerNote] = useState(statement?.lawyerNotes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // 변호사 감수 메모 저장
  const handleSaveLawyerNote = async () => {
    if (!statement) return;
    setIsSavingNote(true);
    try {
      const updated: CourtStatementData = {
        ...statement,
        lawyerNotes: lawyerNote,
        status: 'lawyer_reviewed',
        updatedAt: new Date().toISOString()
      };
      await StatementService.saveStatement(updated);
      if (onUpdateCrmExt) {
        await onUpdateCrmExt({ courtStatement: updated });
      }
      toast.success('변호사 감수 메모가 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // 고객에게 진술서 작성 안내 요청 발송
  const handleRequestClientStatement = () => {
    toast.success(`[알림톡 발송] ${clientName}님께 법원 진술서 간편 작성 링크가 전송되었습니다.`);
  };

  // 진술서가 아직 없는 경우: 빈 상태
  if (!statement || !statement.story.initialCauseDetail) {
    return (
      <div className="p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
          <FileText className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
            고객 작성 법원 진술서 접수 대기 중
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            개인회생·파산 사건 신청 시 필수 첨부 서류인 진술서는 채무자(고객)가 직접 작성해야 합니다. 고객이 모바일에서 음성(말로) 또는 메모로 작성하면 이곳에 실시간 연동됩니다.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={handleRequestClientStatement}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale"
          >
            <Send className="w-3.5 h-3.5" />
            <span>고객에게 진술서 작성 요청 알림톡 발송</span>
          </button>
        </div>
      </div>
    );
  }

  const s = statement.story;

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      
      {/* 상단 상태 및 액션 바 */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                고객 제출 법원 진술서 (AI 정제 및 대법원 양식 완비)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                {statement.status === 'client_completed' ? '고객 제출 완료' : '변호사 검토 완료'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              제출 일시: {statement.deliveredToLawyerAt ? new Date(statement.deliveredToLawyerAt).toLocaleString('ko-KR') : '방금 전'} · 관할: {statement.courtName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrintOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale shadow-sm whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>법원 서식 인쇄 / PDF</span>
          </button>
        </div>
      </div>

      {/* 전자소송 서류철 자동 첨부 안내 카드 */}
      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-indigo-950 dark:text-indigo-200">
            전자소송 일괄 패키징 서류철에 자동 마운트되었습니다
          </p>
          <p className="text-indigo-700 dark:text-indigo-400 leading-relaxed">
            [전자소송 일괄 서류철]의 <span className="font-bold underline">{isRehab ? '10. 진술서' : '02. 파산 진술서'}</span> 슬롯에 법원 제출용 PDF로 자동 연결되어 있습니다. 전자소송 단일 PDF 일괄 결합 및 출력 시 포함되어 접수됩니다.
          </p>
        </div>
      </div>

      {/* 진술서 상세 본문 (4단 구조) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
          <h5 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>대법원 표준 진술 본문</span>
            {s.initialCauseKeywords && s.initialCauseKeywords.length > 0 && (
              <span className="text-xs font-normal text-slate-500">
                (키워드: {s.initialCauseKeywords.join(', ')})
              </span>
            )}
          </h5>
          {s.aiToneUsed && (
            <span className="text-[11px] text-slate-400">
              AI 톤: {s.aiToneUsed === 'formal' ? '정중·격식' : s.aiToneUsed === 'emotional' ? '진솔·호소' : '간결'}
            </span>
          )}
        </div>

        {/* 1. 발생 원인 */}
        <div className="space-y-1.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">
            1. 채무 발생의 최초 원인
          </span>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800">
            {s.initialCauseDetail}
          </div>
        </div>

        {/* 2. 증대 경위 */}
        <div className="space-y-1.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">
            2. 채무가 점차 증대된 구체적 경위 (돌려막기, 고금리 등)
          </span>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800">
            {s.growthProcessDetail}
          </div>
        </div>

        {/* 3. 지급불능 사정 */}
        <div className="space-y-1.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">
            3. 지급불능에 이르게 된 결정적 사정 및 시점
          </span>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800">
            {s.insolvencyTriggerDetail}
          </div>
        </div>

        {/* 4. 반성과 다짐 */}
        <div className="space-y-1.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">
            4. 신청인의 반성과 향후 성실한 변제/갱생 다짐
          </span>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800">
            {s.resolutionAndApology}
          </div>
        </div>

        {/* 고객 입력 원본 메모 비교 뷰 */}
        {(s.voiceTranscript || s.rawCustomerNotes) && (
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
            <details className="text-xs cursor-pointer group">
              <summary className="font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5">
                <span>🎙️ 고객이 음성/메모로 입력한 원본 사연 보기</span>
              </summary>
              <div className="mt-2 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-sans">
                {s.voiceTranscript || s.rawCustomerNotes}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* 변호사 감수 의견 입력란 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-brand" />
          <span>변호사 검토 메모 및 소명 보완 지시사항</span>
        </label>
        <textarea
          rows={3}
          value={lawyerNote}
          onChange={e => setLawyerNote(e.target.value)}
          placeholder="재판부 보정명령 대비 추가 소명이나 의뢰인 안내 사항을 기록하세요."
          className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-sans"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveLawyerNote}
            disabled={isSavingNote}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
          >
            {isSavingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>검토 메모 저장</span>
          </button>
        </div>
      </div>

      {/* 법원 정식 서식 인쇄 모달 */}
      <PrintableCourtStatementModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        statement={statement}
      />
    </div>
  );
}
