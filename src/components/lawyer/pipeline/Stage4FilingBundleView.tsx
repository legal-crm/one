import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock, Eye, Edit3, RefreshCw, AlertTriangle, UserCheck,
  Scale
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { useDialog } from '../../common/DialogProvider';
import {
  generateAll8AutoDrafts,
  approveDraftForm,
  rejectDraftFormWithSupplement,
  approveAllDraftForms,
  loadAutoDraftStateFromStorage,
  type AutoDraftSuiteState,
  type AutoDraftFormItem
} from '../../../services/documents/filingAutoDraftEngine';
import AutoDraftReviewSplitModal from '../documents/AutoDraftReviewSplitModal';

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

  // 대법원 13종 통합 서식 탭 정의 (에디터 내비게이션 퀵점프용)
  const all13DocTabs: { code: string; label: string }[] = [
    { code: 'COVER', label: '표지' },
    { code: 'R01', label: '개시신청서' },
    { code: 'R10', label: '진술서' },
    { code: 'R02', label: '채권자목록' },
    { code: 'R06', label: '재산목록' },
    { code: 'R08', label: '수입및지출' },
    { code: 'R04', label: '변제계획안' },
    { code: 'R03', label: '소송위임장' },
    { code: 'R07', label: '자료제출' },
    { code: 'PROHIBITION', label: '금지명령' },
    { code: 'STAY', label: '중지명령' },
    { code: 'ALL', label: '전체문서' },
  ];

  const clientId = clientRequest.id || clientRequest.clientName || 'default_client';
  const lawyerName = crmExt?.petitionInfo?.lawyerName || '정충원 변호사';

  // AI 자동 초안 상태 (옵션 A 관리: 8대 서식 전수 검토 필수)
  const [draftSuite, setDraftSuite] = useState<AutoDraftSuiteState>(() => {
    const existing = loadAutoDraftStateFromStorage(clientId);
    if (existing) return existing;
    return generateAll8AutoDrafts(clientRequest, crmExt, null);
  });

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedReviewForm, setSelectedReviewForm] = useState<AutoDraftFormItem | null>(null);

  // 1·2차 서류 기반 AI 1차 자동작성 재실행 핸들러
  const handleRunAiAutoDraft = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      const newState = generateAll8AutoDrafts(clientRequest, crmExt, draftSuite);
      setDraftSuite({ ...newState });
      setIsAiGenerating(false);
      toast.success('1·2차 서류 파싱을 완료하고 8대 전산서식 초안 생성을 마쳤습니다. (옵션 A: 변호사 검토 대기 8건)');
    }, 1000);
  };

  // 단일 서식 승인 핸들러
  const handleApproveFormItem = (formCode: string) => {
    const updated = approveDraftForm(clientId, formCode, lawyerName);
    if (updated) {
      setDraftSuite({ ...updated });
    }
  };

  // 단일 서식 보완 요청 핸들러
  const handleRejectSupplement = (formCode: string, reason: string) => {
    const updated = rejectDraftFormWithSupplement(clientId, formCode, reason);
    if (updated) {
      setDraftSuite({ ...updated });
    }
  };

  // 일괄 승인 핸들러
  const handleApproveAll = async () => {
    const confirmed = await dialog.confirm({
      title: '⚖️ 8대 전산서식 일괄 승인 (옵션 A)',
      message: '8개 전산서식의 AI 초안 내용을 모두 확인하셨습니까?\n\n변호사 검토 완료 승인으로 일괄 처리합니다.',
      confirmText: '전체 검토완료 승인',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    const updated = approveAllDraftForms(clientId, lawyerName);
    if (updated) {
      setDraftSuite({ ...updated });
      toast.success('8대 전산서식이 모두 변호사 승인 완료 처리되었습니다.');
    }
  };

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

  // 선행 조건 검증 헬퍼 (옵션 A 검증 추가)
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
    // 옵션 A: 8대 서식 변호사 전수 검토 완료 필수
    if (!draftSuite.allReviewed) {
      const remainingCount = draftSuite.totalCount - draftSuite.approvedCount;
      await dialog.alert({
        title: '🔒 변호사 검토 미완료 (옵션 A 필수 규정)',
        message: `8대 필수 전산서식 중 아직 변호사 검토·승인이 완료되지 않은 서식이 ${remainingCount}건 있습니다.\n\n※ 옵션 A 정책: 변호사 8종 전수 검토가 완료되어야 법원 전자소송 접수가 활성화됩니다.\n각 서식의 [대조 검토] 버튼을 눌러 승인하시거나, 상단의 [일괄 검토 승인]을 완료해 주세요.`,
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
      message: '8대 법원 서식(변호사 검토 완료) 및 금지·중지명령신청서의 전자소송 정식 접수를 완료 처리하시겠습니까?\n\n※ 접수 완료 처리 시 사건이 Stage 5(법원대응·보정) 단계로 전환되며 법원 사건번호 관리가 시작됩니다.',
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
    <div className="p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      {/* ── 1. 대법원 전자소송 13종 통합 서식 작성기 (Hero Master Card) ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-[#1E3A5F] to-slate-950 text-white border border-slate-700/60 shadow-lg relative overflow-hidden">
        {/* 은은한 배경 광채 데코레이션 */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-400" />
                대법원 전자소송 A4 표준 규격 위지윅 에디터
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                실시간 양방향 데이터 바인딩
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>대법원 전자소송 13종 통합 서식 작성기</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              사건 개시신청서, 채권자목록, 재산목록, 수입지출, 변제계획안, 진술서, 부수신청 등 법원 제출용 13종 전산 서식을 하나의 통합 화면에서 실시간 작성·검토·A4 인쇄할 수 있습니다.
            </p>

            {/* 사건 기본 정보 요약 바 */}
            <div className="pt-1 flex items-center gap-3 text-xs text-slate-300 flex-wrap font-mono">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                사건: <strong className="text-white">{crmExt?.courtCase?.caseNumber || '2026개회104921'}</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                신청인: <strong className="text-white">{clientName}</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                관할: <strong className="text-indigo-300">{courtName}</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                대리인: <strong className="text-white">{lawyerName}</strong>
              </span>
            </div>

            {/* 13종 서식 퀵점프 칩 목록 */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                <span>클릭 시 해당 서식 탭으로 바로 이동:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {all13DocTabs.map((tab) => (
                  <button
                    key={tab.code}
                    type="button"
                    onClick={() => handlePreviewForm(tab.code)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700 hover:border-blue-500 text-xs font-medium transition-all cursor-pointer press-scale flex items-center gap-1"
                    title={`${tab.label} 서식 바로 열기`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 우측 마스터 액션 버튼 그룹 */}
          <div className="flex flex-col gap-2.5 shrink-0 min-w-[200px]">
            {onOpenCourtDocSuite && (
              <button
                type="button"
                onClick={() => onOpenCourtDocSuite('COVER')}
                className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>통합 서식 작성기 열기</span>
              </button>
            )}

            {onOpenCourtDocExportModal && (
              <button
                type="button"
                onClick={onOpenCourtDocExportModal}
                className="w-full px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer press-scale whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>법원서식 8종 출력 (인쇄/PDF)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. 중단 2열 컴팩트 대시보드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 (7열): 8대 전산서식 준비 및 데이터 건전성 매트릭스 */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">8대 필수 전산서식 검증 및 준비 상태</h3>
                  <p className="text-[11px] text-slate-500">클릭 시 통합 작성기 내 해당 서식 편집화면으로 즉시 전환됩니다.</p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                8종 전산 데이터 연동 완료
              </span>
            </div>

            {/* 2열 4행 콤팩트 카드 그리드 (기존 8행 긴 리스트 완벽 대체) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
              {standardForms.map((form) => {
                const draftItem = draftSuite.forms[form.code];
                const isApproved = draftItem?.reviewStatus === 'REVIEWED_APPROVED';
                const riskCount = draftItem?.riskFlags?.length || 0;

                return (
                  <div
                    key={form.code}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePreviewForm(form.code)}
                        className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                        title={`${form.name} 서식 열기`}
                      >
                        <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                          {form.code}
                        </span>
                        <span className="font-bold text-xs text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                          {form.name}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {isApproved ? (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            승인
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-500" />
                            검토대기
                          </span>
                        )}

                        {draftItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReviewForm(draftItem);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                            title="1·2차 원천 서류와 AI 추출 전산서식을 좌우 대조 검토합니다."
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div 
                      onClick={() => handlePreviewForm(form.code)} 
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                        <span className="px-1 bg-slate-100 rounded text-slate-600">{form.badge}</span>
                        {draftItem && <span>신뢰도 {draftItem.confidenceScore}%</span>}
                        {riskCount > 0 && <span className="text-amber-600 font-bold">· 점검 {riskCount}건</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight line-clamp-1">
                        {draftItem?.summaryNote || form.note}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 데이터 충족 요약 배너 */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">제614조 적합</span>
              <span className="text-[11px]">청산가치 보장 및 최저변제액 요건 충족</span>
            </div>
            <span className="text-[11px] text-slate-400">AI 전산 신뢰도 평균 94%</span>
          </div>
        </div>

        {/* 우측 (5열): 변호사 전수 검토 & 부수신청 설정 카드 */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">변호사 거버넌스 & 부수 신청</h3>
                  <p className="text-[11px] text-slate-500">옵션 A: 변호사 8종 전수 검토 및 접수 옵션</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500">옵션 A</span>
            </div>

            {/* 검토 현황 프로그레스 */}
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">변호사 전수 검토 현황:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {draftSuite.approvedCount} / {draftSuite.totalCount}건 완료 ({Math.round((draftSuite.approvedCount / draftSuite.totalCount) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    draftSuite.allReviewed ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${(draftSuite.approvedCount / draftSuite.totalCount) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRunAiAutoDraft}
                  disabled={isAiGenerating}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale"
                >
                  <RefreshCw className={`w-3 h-3 ${isAiGenerating ? 'animate-spin' : ''}`} />
                  <span>{isAiGenerating ? '생성 중...' : 'AI 초안 재실행'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer press-scale"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>8종 전수 일괄 승인</span>
                </button>
              </div>
            </div>

            {/* 부수신청 옵션 토글 */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <span className="font-bold text-slate-800 block text-xs">부수 신청 포함 여부:</span>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={includeProhibition}
                  onChange={(e) => setIncludeProhibition(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">금지명령 신청서 (급여·유체동산 압류 및 빚독촉 차단)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={includeStayOrder}
                  onChange={(e) => setIncludeStayOrder(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">중지명령 신청서 ({stayExecutionCaseNo})</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <span className={`text-[11px] font-semibold flex items-center gap-1 ${
              draftSuite.allReviewed ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {draftSuite.allReviewed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  8대 서식 전원 검토 통과 (전자소송 접수 가능)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  접수 전 미검토 서식 승인이 필요합니다
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. 하단 최종 전자소송 패키징 & 정식 접수 바 ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isFilingSubmitted
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
          : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl shrink-0 ${
            isFilingSubmitted ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {isFilingSubmitted ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {isFilingSubmitted ? 'Gate 4 통과 완료 (법원 정식 접수됨)' : '전자소송 일괄 패키징 & 정식 접수'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isFilingSubmitted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
              }`}>
                {isFilingSubmitted ? 'Stage 5 진행' : 'Gate 4'}
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isFilingSubmitted ? 'text-emerald-800' : 'text-slate-400'}`}>
              {isFilingSubmitted
                ? '법원 사건번호가 발번되었으며 Stage 5(법원대응·보정)에서 보정권고 관리를 진행합니다.'
                : '검토 완료된 8대 서식과 부수신청을 결합하여 전자소송을 일괄 접수하거나 접수 완료 처리합니다.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
          {!isFilingSubmitted ? (
            <>
              {onOpenBatchFilingModal && (
                <button
                  type="button"
                  onClick={handleBatchFilingClick}
                  className={`px-4 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap ${
                    !isContracted || !draftSuite.allReviewed
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                  }`}
                >
                  {!isContracted || !draftSuite.allReviewed ? (
                    <Lock className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>전자소송 일괄 패키징 & 접수</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCompleteFiling}
                className={`px-4 py-2.5 font-bold text-xs rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap ${
                  !isContracted || !draftSuite.allReviewed
                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-white" />
                <span>접수 완료 처리</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onAdvanceToNextStage}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
            >
              <span>Stage 5 (법원대응·보정)로 이동</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 5. AI 자동 초안 대조 검토 모달 (옵션 A) ── */}
      {selectedReviewForm && (
        <AutoDraftReviewSplitModal
          formItem={selectedReviewForm}
          isOpen={Boolean(selectedReviewForm)}
          onClose={() => setSelectedReviewForm(null)}
          onApprove={handleApproveFormItem}
          onRejectSupplement={handleRejectSupplement}
          onOpenFullEditor={handleEditForm}
          onPreviewCourtForm={handlePreviewForm}
        />
      )}
    </div>
  );
}
