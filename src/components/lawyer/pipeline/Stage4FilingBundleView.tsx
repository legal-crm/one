import React, { useState } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';

interface Stage4FilingBundleViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
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
  onAdvanceToNextStage,
  onOpenBatchFilingModal,
  onOpenAncillaryModal,
  onOpenCourtDocExportModal,
  onOpenPropertyValuationModal,
  onOpenIncomeExpenseModal,
}: Stage4FilingBundleViewProps) {
  const [includeProhibition, setIncludeProhibition] = useState(true);
  const [includeStayOrder, setIncludeStayOrder] = useState(true);
  const [stayExecutionCaseNo, setStayExecutionCaseNo] = useState('2025타채 54321호 (급여압류)');
  const [isClientConsented, setIsClientConsented] = useState(true);
  const [isFilingSubmitted, setIsFilingSubmitted] = useState(false);

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';

  // 8대 필수 서식 목록
  const standardForms = [
    { code: 'R01', name: '개인회생절차 개시신청서 본안', isReady: true, note: '당사자 기본 인적사항 및 관할법원 지정' },
    { code: 'R02', name: '개인회생 채권자목록 (CSV)', isReady: true, note: '8개 채권사 원금·이자 산정 및 CSV 변환 완료' },
    { code: 'R06', name: '재산목록 (D5102)', isReady: true, note: '부동산, 자동차, 예금, 보험환급금 청산가치 산정' },
    { code: 'R08', name: '수입 및 지출에 관한 목록 (D5103)', isReady: true, note: '중위소득 60% 기준 생계비 및 가용소득 확정' },
    { code: 'R10', name: '진술서 (채무 증대 경위서)', isReady: true, note: 'AI 첨삭 및 신청인 확인 완료' },
    { code: 'R04', name: '변제계획안 및 변제예정표', isReady: true, note: '제614조 제2항 최저변제율(28.4% > 5%) 충족' },
    { code: 'R03', name: '소송위임장', isReady: true, note: '전자서명 체결 완료' },
    { code: 'R07', name: '첨부서류 일체 (4대 발급처 증빙)', isReady: true, note: 'Stage 3 수합 20종 서류 번들링 완료' },
  ];

  // 원클릭 번들 다운로드
  const handleDownloadBundle = () => {
    toast.success('대법원 전자소송 제출용 ZIP 패키지(8대 서식 + 금지/중지명령)가 다운로드되었습니다.');
  };

  // 법원 접수 완료 처리
  const handleCompleteFiling = () => {
    setIsFilingSubmitted(true);
    toast.success('대법원 전자소송 정식 접수가 완료되었습니다. [Gate 4 통과]');
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
                    onClick={onOpenBatchFilingModal}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>전자소송 일괄 패키징 & 접수 (Major)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCompleteFiling}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Check className="w-3.5 h-3.5 text-slate-600" />
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>전자소송 접수완료 처리</span>
          </button>
        )}
      </div>
    </div>
  );
}
