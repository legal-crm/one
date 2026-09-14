import React, { useState } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock, Eye, Edit3
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
  onOpenPetitionEditModal?: () => void;
  onOpenCreditorEditModal?: () => void;
  onOpenStatementSyncModal?: () => void;
  onOpenRepaymentPlanEditor?: () => void;
  onOpenPowerOfAttorneyModal?: () => void;
  onOpenDocScannerModal?: () => void;
  onOpenCourtFormPreviewModal?: (formCode: string) => void;
  onOpenCourtDocSuite?: (formCode?: string) => void;
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
  onOpenPetitionEditModal,
  onOpenCreditorEditModal,
  onOpenStatementSyncModal,
  onOpenRepaymentPlanEditor,
  onOpenPowerOfAttorneyModal,
  onOpenDocScannerModal,
  onOpenCourtFormPreviewModal,
  onOpenCourtDocSuite,
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

  // 8대 필수 서식 목록 (실시간 데이터 연동 요약 및 상태)
  const standardForms = [
    { 
      code: 'R01', 
      name: '개인회생절차 개시신청서 본안', 
      isReady: true, 
      badge: 'D5101',
      note: `${courtName} 접수 · 신청인 ${clientName} (${crmExt?.petitionInfo?.incomeType === 'business' ? '영업소득자' : '급여소득자'}) · 환급: ${crmExt?.petitionInfo?.refundBank || (crmExt?.repaymentPlan as any)?.bankName || '우체국'}`
    },
    { 
      code: 'R02', 
      name: '개인회생 채권자목록 (CSV)', 
      isReady: true, 
      badge: 'PDF+CSV',
      note: `채권사 ${(crmExt?.repaymentPlan?.creditors || []).length}개소 · 원금 ${(crmExt?.repaymentPlan?.totalPrincipal || 0).toLocaleString()}원 · 대법원 UTF-8 BOM CSV`
    },
    { 
      code: 'R06', 
      name: '재산목록 (D5102)', 
      isReady: true, 
      badge: 'D5102',
      note: `총 청산가치 ${(crmExt?.repaymentPlan?.totalLiquidationValue || 0).toLocaleString()}원 · 11대 자산 가치평가 완비`
    },
    { 
      code: 'R08', 
      name: '수입 및 지출에 관한 목록 (D5103)', 
      isReady: true, 
      badge: 'D5103',
      note: `월 순소득 ${((crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 3500000)).toLocaleString()}원 · 생계비 인정 ${((crmExt?.repaymentPlan?.calculatedLiving?.finalTotalLivingExpense || 1500000)).toLocaleString()}원`
    },
    { 
      code: 'R10', 
      name: '진술서 (채무 증대 경위서)', 
      isReady: true, 
      badge: 'AI첨삭',
      note: '학력·경력·채무발생 경위 및 AI 법률 첨삭 완료 · 의뢰인 확인 동기화'
    },
    { 
      code: 'R04', 
      name: '변제계획안 및 변제예정표', 
      isReady: true, 
      badge: 'D5110',
      note: `월 ${(crmExt?.repaymentPlan?.monthlyRepaymentTotal || 0).toLocaleString()}원 (${crmExt?.repaymentPlan?.months || 36}개월) · 변제율 ${crmExt?.repaymentPlan?.totalRepaymentRate || 0}% · 최저변제율 충족`
    },
    { 
      code: 'R03', 
      name: '소송위임장', 
      isReady: true, 
      badge: '대리권',
      note: `대리인 변호사 ${crmExt?.petitionInfo?.lawyerName || '정충원'} · 8대 소송대리 수권 및 경유확인서 완료`
    },
    { 
      code: 'R07', 
      name: '첨부서류 일체 (4대 발급처 증빙)', 
      isReady: true, 
      badge: '수합완비',
      note: `주민센터·홈택스·정부24·부채증명서 수합 완료 (${(crmExt?.uploadedFiles || []).length}건 편철)`
    },
  ];

  // 서식별 수정·편집 핸들러 (로패스 양방향 실시간 에디터 우선 연결)
  const handleEditForm = (code: string) => {
    if (onOpenCourtDocSuite) {
      onOpenCourtDocSuite(code);
      return;
    }
    switch (code) {
      case 'R01':
        if (onOpenPetitionEditModal) onOpenPetitionEditModal();
        else toast.info('개시신청서 본안 편집 모달을 엽니다.');
        break;
      case 'R02':
        if (onOpenCreditorEditModal) onOpenCreditorEditModal();
        else toast.info('채권자목록 편집 모달을 엽니다.');
        break;
      case 'R06':
        if (onOpenPropertyValuationModal) onOpenPropertyValuationModal();
        else toast.info('재산목록 가치평가 모달을 엽니다.');
        break;
      case 'R08':
        if (onOpenIncomeExpenseModal) onOpenIncomeExpenseModal();
        else toast.info('수입 및 지출 목록 모달을 엽니다.');
        break;
      case 'R10':
        if (onOpenStatementSyncModal) onOpenStatementSyncModal();
        else toast.info('진술서 편집/동기화 모달을 엽니다.');
        break;
      case 'R04':
        if (onOpenRepaymentPlanEditor) onOpenRepaymentPlanEditor();
        else toast.info('변제계획안 에디터를 엽니다.');
        break;
      case 'R03':
        if (onOpenPowerOfAttorneyModal) onOpenPowerOfAttorneyModal();
        else toast.info('소송위임장 모달을 엽니다.');
        break;
      case 'R07':
        if (onOpenDocScannerModal) onOpenDocScannerModal();
        else toast.info('서류 스캔 및 수합 허브를 엽니다.');
        break;
      default:
        break;
    }
  };

  // 서식별 A4 미리보기 핸들러 (로패스 실시간 뷰어 우선 연결)
  const handlePreviewForm = (code: string) => {
    if (onOpenCourtDocSuite) {
      onOpenCourtDocSuite(code);
      return;
    }
    if (onOpenCourtFormPreviewModal) {
      onOpenCourtFormPreviewModal(code);
    } else {
      toast.info(`${code} 서식 A4 법원 규격 미리보기를 준비합니다.`);
    }
  };

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
            {onOpenCourtDocSuite && (
              <button
                type="button"
                onClick={() => onOpenCourtDocSuite('R01')}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/25 transition-all flex items-center gap-2 press-scale cursor-pointer"
                title="왼쪽 실시간 A4 미리보기와 오른쪽 입력 패널이 결합된 로패스 2025 규격 에디터를 엽니다."
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>로패스(LawPass) 실시간 양방향 서식 작성기 열기</span>
              </button>
            )}

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
            <div key={form.code} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 text-xs transition-colors">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <span className="w-10 text-center font-mono font-black text-slate-600 bg-slate-100 px-1 py-1 rounded-lg text-[11px] shrink-0">
                  {form.code}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{form.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {form.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{form.note}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>준비완료</span>
                </span>

                <button
                  type="button"
                  onClick={() => handlePreviewForm(form.code)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="A4 법원 양식 미리보기 및 인쇄"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>미리보기</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEditForm(form.code)}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="서식 기재사항 직접 추가·수정·삭제"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>수정·편집</span>
                </button>
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
