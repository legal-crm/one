import React, { useState } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { useDialog } from '../../common/DialogProvider';

interface Stage4FilingBundleViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onUpdateStatus?: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onOpenBatchFilingModal?: () => void;
  onOpenAncillaryModal?: () => void;
  onOpenCourtDocExportModal?: () => void;
  onOpenPropertyValuationModal?: () => void;
  onOpenIncomeExpenseModal?: () => void;
}

export default function Stage4FilingBundleView({
  clientRequest,
  crmExt,
  onUpdateStatus,
  onAdvanceToNextStage,
  onOpenBatchFilingModal,
  onOpenAncillaryModal,
  onOpenCourtDocExportModal,
  onOpenPropertyValuationModal,
  onOpenIncomeExpenseModal,
}: Stage4FilingBundleViewProps) {
  const dialog = useDialog();
  const [includeProhibition, setIncludeProhibition] = useState(true);
  const [includeStayOrder, setIncludeStayOrder] = useState(true);
  const [stayExecutionCaseNo, setStayExecutionCaseNo] = useState('2025타채 54321호 (급여압류)');
  const [isClientConsented, setIsClientConsented] = useState(true);

  // 선행 충족 조건 산출
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

  const [isFilingSubmitted, setIsFilingSubmitted] = useState(() => {
    return ['filed', 'commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || clientRequest.status || '');
  });

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';

  // 선행 조건 검증 헬퍼
  const checkPreconditions = async (): Promise<boolean> => {
    if (!hasProposalSent || !isContactShared) {
      await dialog.alert({
        title: '🔒 선행 단계 미완료 (제안서 미발송)',
        message: '의뢰인에게 맞춤 제안서가 아직 발송되지 않았거나 의뢰인이 확인하지 않았습니다.\n\n[Stage 01 맞춤 제안서 발송]을 먼저 완료해야 법원 정식 접수가 가능합니다.',
        variant: 'warning',
      });
      return false;
    }
    if (!isContracted) {
      await dialog.alert({
        title: '🔒 선행 단계 미완료 (수임계약 미체결)',
        message: '의뢰인과의 사건 위임계약(전자계약 또는 서면계약) 체결이 완료되지 않았습니다.\n\n[Stage 02 계약·착수] 단계를 먼저 완료해 주세요.',
        variant: 'warning',
      });
      return false;
    }
    return true;
  };

  // 원클릭 번들 다운로드
  const handleDownloadBundle = () => {
    toast.success('대법원 전자소송 제출용 ZIP 패키지(8대 서식 + 금지/중지명령)가 다운로드되었습니다.');
  };

  // 법원 접수 완료 처리 (2단계 확인 팝업 적용)
  const handleCompleteFiling = async () => {
    const passed = await checkPreconditions();
    if (!passed) return;

    const confirmed = await dialog.confirm({
      title: '🏛️ 대법원 전자소송 접수 완료 처리',
      message: '8대 법원 서식 및 금지·중지명령신청서의 전자소송 정식 접수를 완료 처리하시겠습니까?\n\n※ 접수 완료 처리 시 사건이 Stage 5(법원대응·보정) 단계로 전환되며 법원 사건번호 관리가 시작됩니다.',
      confirmText: '접수 완료 승인',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    setIsFilingSubmitted(true);
    if (onUpdateStatus) {
      onUpdateStatus('filed');
    }
    toast.success('대법원 전자소송 정식 접수가 완료되었습니다. [Gate 4 통과]');
  };

  // 전자소송 일괄 패키징 & 접수 클릭 시 선행 조건 검증
  const handleBatchFilingClick = async () => {
    const passed = await checkPreconditions();
    if (!passed) return;
    if (onOpenBatchFilingModal) {
      onOpenBatchFilingModal();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 04 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            8대 법원 서식 검증 및 대법원 전자소송 정식 접수
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">서식 완비율:</span>
          <span className="font-mono font-bold text-emerald-600">8 / 8건 완료 (100%)</span>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs ${
        isFilingSubmitted 
          ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
              isFilingSubmitted ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {isFilingSubmitted ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {isFilingSubmitted ? 'Gate 4 통과 완료' : '지금 해야 할 핵심 작업'}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {isFilingSubmitted 
                    ? '법원 정식 접수가 완료되었습니다. Stage 5(법원대응·보정)로 이동하세요.' 
                    : '8대 법원 서식과 금지·중지명령을 결합하여 전자소송 패키징을 생성하세요.'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isFilingSubmitted 
                  ? '법원 사건번호가 발번되면 나의사건 연동 및 보정센터가 즉시 활성화됩니다.' 
                  : 'D5102 재산목록과 D5103 수입지출목록의 청산가치 보장의 원칙을 최종 점검한 뒤 일괄 접수합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!isFilingSubmitted ? (
              <>
                {onOpenBatchFilingModal && (
                  <button
                    type="button"
                    onClick={handleBatchFilingClick}
                    className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer ${
                      !isContracted
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-[#1E3A5F] hover:bg-slate-800 text-white'
                    }`}
                  >
                    {!isContracted ? <Lock className="w-4 h-4 text-amber-300" /> : <Send className="w-4 h-4 text-emerald-400" />}
                    <span>전자소송 일괄 패키징 & 접수 (Major)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCompleteFiling}
                  className={`px-3.5 py-2.5 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale ${
                    !isContracted 
                      ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {!isContracted ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Check className="w-3.5 h-3.5 text-slate-600" />}
                  <span>접수 완료 처리</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <span>Stage 5 (법원대응·보정)로 진행</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {onOpenCourtDocExportModal && (
              <button
                type="button"
                onClick={onOpenCourtDocExportModal}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>법원서식 8종 출력</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. 8대 전산 서식 검증 테이블 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" />
            <h4 className="font-black text-xs text-slate-900">8대 필수 전산서식 검증 및 번들링 상태</h4>
          </div>
          <span className="text-[11px] font-mono text-slate-500">관할: {courtName}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {standardForms.map((form) => (
            <div key={form.code} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 text-xs">
              <div className="flex items-center gap-3">
                <span className="w-9 text-center font-mono font-black text-slate-500 bg-slate-100 px-1 py-0.5 rounded text-[11px]">
                  {form.code}
                </span>
                <div>
                  <span className="font-bold text-slate-900">{form.name}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{form.note}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>준비완료</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. 단계 완료 조건 바 ── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold">Stage 4 완료 조건:</span>
          <span className="text-slate-300">
            8대 전산서식 패키징 완료 및 전자소송 접수 ({isFilingSubmitted ? '완료' : '대기'})
          </span>
        </div>

        {isFilingSubmitted ? (
          <button
            type="button"
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>Stage 5 (법원대응·보정)로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCompleteFiling}
            className={`px-4 py-2 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs ${
              !isContracted 
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {!isContracted && <Lock className="w-3.5 h-3.5 text-amber-300" />}
            <span>전자소송 접수완료 처리</span>
          </button>
        )}
      </div>
    </div>
  );
}
