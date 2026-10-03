import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock, Eye, Edit3, RefreshCw, AlertTriangle, UserCheck,
  Scale, FileSignature, Shield, CheckSquare, Square, ChevronRight
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
import FilingChecklistPanel from './FilingChecklistPanel';
import { localYmd } from '../../../utils/localDate';
import { computePipelineGates } from './pipelineGates';
import { getDisplayClientName } from '../../../utils/clientDisplay';

export type Stage4SectionTab = 'petition' | 'ancillary' | 'filing';

interface Stage4FilingBundleViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  /** @returns 상태 저장 여부 */
  onUpdateStatus?: (newStatus: any) => void | boolean | Promise<boolean | void>;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
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
  activeSection?: string;
  onSelectSection?: (section: string) => void;
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
  onUpdateCrmExt,
  activeSection = 'petition',
  onSelectSection,
}: Stage4FilingBundleViewProps) {
  const dialog = useDialog();

  // 3대 섹션 탭 연동
  const currentSection: Stage4SectionTab = useMemo(() => {
    if (activeSection === 'ancillary' || activeSection === 'filing') {
      return activeSection;
    }
    return 'petition';
  }, [activeSection]);

  const handleSwitchSection = (section: Stage4SectionTab) => {
    if (onSelectSection) {
      onSelectSection(section);
    }
  };

  // 부수 신청 상태
  const [includeProhibition, setIncludeProhibition] = useState(true);
  const [includeStayOrder, setIncludeStayOrder] = useState<boolean>(() => {
    return !!((crmExt as any)?.courtCase?.executionCaseNumber);
  });
  const [stayExecutionCaseNo, setStayExecutionCaseNo] = useState<string>(
    (crmExt as any)?.courtCase?.executionCaseNumber || ''
  );
  const [stayExecutionCourt, setStayExecutionCourt] = useState<string>(
    (crmExt as any)?.courtCase?.executionCourt || ''
  );
  const [stayExecutionCreditor, setStayExecutionCreditor] = useState<string>(
    (crmExt as any)?.courtCase?.executionCreditor || ''
  );
  const [isSavingStayInfo, setIsSavingStayInfo] = useState(false);

  // 의뢰인 제출 동의 상태
  const [isClientConsented, setIsClientConsented] = useState<boolean>(() => {
    return !!(crmExt?.courtCase as any)?.clientConsent?.consented;
  });
  const [clientConsentDate, setClientConsentDate] = useState<string>(
    (crmExt?.courtCase as any)?.clientConsent?.consentDate || ''
  );
  const [isRequestingConsent, setIsRequestingConsent] = useState(false);

  // 법원 접수 정보 상태 (사건번호, 법원명, 접수일자)
  const [caseNumberInput, setCaseNumberInput] = useState<string>(
    crmExt?.courtCase?.caseNumber || (clientRequest as any)?.caseNumber || ''
  );
  const [courtNameInput, setCourtNameInput] = useState<string>(
    crmExt?.courtCase?.courtName || clientRequest.court || ''
  );
  const [filingDateInput, setFilingDateInput] = useState<string>(
    crmExt?.courtCase?.filingDate || localYmd()
  );
  const [isSavingFilingInfo, setIsSavingFilingInfo] = useState(false);

  // 선행 충족 조건 산출
  const gates = computePipelineGates(clientRequest, crmExt);
  const { isContracted, hasProposalSent, isContactShared } = gates;

  const [isFilingSubmitted, setIsFilingSubmitted] = useState(() => {
    return ['filed', 'commenced', 'repaying', 'discharged'].includes(
      crmExt?.crmStatus || clientRequest.status || ''
    );
  });

  const clientName = getDisplayClientName(clientRequest, crmExt) || '신청인';
  const courtName = courtNameInput.trim() || crmExt?.courtCase?.courtName || clientRequest.court || '관할 법원 미입력';
  const clientId = clientRequest.id || clientRequest.clientName || 'default_client';
  const lawyerName = crmExt?.petitionInfo?.lawyerName || '대리인 변호사';

  // 사건 유형 자동 감지 (회생/파산 분기)
  const caseType: 'rehabilitation' | 'bankruptcy' = useMemo(() => {
    const ct = (crmExt as any)?.caseType || clientRequest.caseType || '';
    if (ct.includes('파산') || ct.includes('bankruptcy') || ct === 'bankruptcy') return 'bankruptcy';
    return 'rehabilitation';
  }, [crmExt, clientRequest]);

  // AI 자동 초안 상태
  const [draftSuite, setDraftSuite] = useState<AutoDraftSuiteState>(() => {
    const existing = loadAutoDraftStateFromStorage(clientId);
    if (existing) return existing;
    return generateAll8AutoDrafts(clientRequest, crmExt, null);
  });

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedReviewForm, setSelectedReviewForm] = useState<AutoDraftFormItem | null>(null);

  // 파산 7대 필수 서식 목록
  const bankruptcyForms = [
    {
      code: 'B01',
      name: '파산 및 면책 신청서',
      isReady: !!crmExt?.petitionInfo,
      badge: 'D7101',
      note: `${courtName} 접수 · 신청인 ${clientName} · 파산 및 면책 동시 신청`
    },
    {
      code: 'B02',
      name: '진술서 (채무경위 및 파산원인)',
      isReady: !!crmExt?.courtStatement,
      badge: '진술서',
      note: crmExt?.courtStatement ? '과거 경력·채무 발생·지급불능 시점·소송 경험' : '진술서 미작성'
    },
    {
      code: 'B03',
      name: '채권자목록',
      isReady: (crmExt?.repaymentPlan?.creditors || []).length > 0,
      badge: 'PDF+CSV',
      note: `파산 채권자 ${(crmExt?.repaymentPlan?.creditors || []).length}개소`
    },
    {
      code: 'B04',
      name: '재산목록 (현금·예금·보험·부동산·자동차)',
      isReady: !!(crmExt as any)?.propertyListD5102,
      badge: '재산',
      note: '현금·예금·보험·임차보증금·부동산·자동차·퇴직금·처분재산'
    },
    {
      code: 'B05',
      name: '현재의 생활상황',
      isReady: (crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 0) > 0,
      badge: '생활',
      note: '직업·수입·동거가족·주거상황·세금 체납'
    },
    {
      code: 'B06',
      name: '수입 및 지출에 관한 목록',
      isReady: (crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 0) > 0,
      badge: 'D7103',
      note: '신청인·배우자·가족 수입 및 월 지출'
    },
    {
      code: 'B07',
      name: '자료제출목록',
      isReady: (crmExt?.uploadedFiles || []).length > 0,
      badge: '첨부',
      note: '법원 양식 기준 제출 여부·해당 없음 정리'
    },
  ];

  // 회생 8대 필수 서식 목록
  const standardForms = caseType === 'bankruptcy' ? bankruptcyForms : [
    { 
      code: 'R01', 
      name: '개인회생절차 개시신청서 본안', 
      isReady: !!crmExt?.petitionInfo, 
      badge: 'D5101',
      note: `${courtName} 접수 · 신청인 ${clientName} (${crmExt?.petitionInfo?.incomeType === 'business' ? '영업소득자' : '급여소득자'})`
    },
    { 
      code: 'R02', 
      name: '개인회생 채권자목록 (CSV)', 
      isReady: (crmExt?.repaymentPlan?.creditors || []).length > 0, 
      badge: 'PDF+CSV',
      note: `채권사 ${(crmExt?.repaymentPlan?.creditors || []).length}개소 · 원금 ${(crmExt?.repaymentPlan?.totalPrincipal || 0).toLocaleString()}원`
    },
    { 
      code: 'R06', 
      name: '재산목록 (D5102)', 
      isReady: !!(crmExt as any)?.propertyListD5102, 
      badge: 'D5102',
      note: `총 청산가치 ${(crmExt?.repaymentPlan?.totalLiquidationValue || 0).toLocaleString()}원`
    },
    { 
      code: 'R08', 
      name: '수입 및 지출에 관한 목록 (D5103)', 
      isReady: !!(crmExt as any)?.incomeExpenseD5103 || (crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 0) > 0, 
      badge: 'D5103',
      note: `월 순소득 ${((crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 0)).toLocaleString()}원 · 생계비 ${((crmExt?.repaymentPlan?.calculatedLiving?.finalTotalLivingExpense || 0)).toLocaleString()}원`
    },
    { 
      code: 'R10', 
      name: '진술서 (채무 증대 경위서)', 
      isReady: !!crmExt?.courtStatement, 
      badge: '진술서',
      note: crmExt?.courtStatement ? '학력·경력·채무발생 경위 작성 완료' : '의뢰인 진술서 미작성'
    },
    { 
      code: 'R04', 
      name: '변제계획안 및 변제예정표', 
      isReady: (crmExt?.repaymentPlan?.monthlyRepaymentTotal || 0) > 0, 
      badge: 'D5110',
      note: `월 ${(crmExt?.repaymentPlan?.monthlyRepaymentTotal || 0).toLocaleString()}원 (${crmExt?.repaymentPlan?.months || 36}개월) · 변제율 ${crmExt?.repaymentPlan?.totalRepaymentRate || 0}%`
    },
    { 
      code: 'R03', 
      name: '소송위임장', 
      isReady: !!crmExt?.petitionInfo?.lawyerName, 
      badge: '대리권',
      note: crmExt?.petitionInfo?.lawyerName ? `대리인 변호사 ${crmExt.petitionInfo.lawyerName}` : '대리인 정보 미입력'
    },
    { 
      code: 'R07', 
      name: '첨부서류 일체 (4대 발급처 증빙)', 
      isReady: (crmExt?.uploadedFiles || []).length > 0, 
      badge: '첨부',
      note: `업로드된 첨부서류 ${(crmExt?.uploadedFiles || []).length}건`
    },
  ];

  // 1·2차 서류 기반 AI 1차 자동작성 재실행
  const handleRunAiAutoDraft = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      const newState = generateAll8AutoDrafts(clientRequest, crmExt, draftSuite);
      setDraftSuite({ ...newState });
      setIsAiGenerating(false);
      toast.success('CRM 입력 데이터로 전산 서식 초안을 재생성했습니다. 변호사 검토를 진행해 주세요.');
    }, 800);
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
      title: '전산 서식 일괄 승인',
      message: `${caseType === 'bankruptcy' ? '7대' : '8대'} 필수 전산서식의 초안 내용을 모두 확인하셨습니까?\n\n변호사 검토 완료 승인으로 일괄 처리합니다.`,
      confirmText: '전체 검토완료 승인',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    const updated = approveAllDraftForms(clientId, lawyerName);
    if (updated) {
      setDraftSuite({ ...updated });
      toast.success('필수 전산서식이 모두 변호사 승인 완료 처리되었습니다.');
    }
  };

  // 서식별 에디터 직결
  const handleOpenFormEditor = (code: string) => {
    if (onOpenCourtDocSuite) {
      onOpenCourtDocSuite(code);
      return;
    }
    switch (code) {
      case 'R01':
      case 'B01':
        if (onOpenPetitionEditModal) onOpenPetitionEditModal();
        break;
      case 'R02':
      case 'B03':
        if (onOpenCreditorEditModal) onOpenCreditorEditModal();
        break;
      case 'R06':
      case 'B04':
        if (onOpenPropertyValuationModal) onOpenPropertyValuationModal();
        break;
      case 'R08':
      case 'B06':
        if (onOpenIncomeExpenseModal) onOpenIncomeExpenseModal();
        break;
      case 'R10':
      case 'B02':
        if (onOpenStatementSyncModal) onOpenStatementSyncModal();
        break;
      case 'R04':
        if (onOpenRepaymentPlanEditor) onOpenRepaymentPlanEditor();
        break;
      case 'R03':
        if (onOpenPowerOfAttorneyModal) onOpenPowerOfAttorneyModal();
        break;
      case 'R07':
      case 'B07':
        if (onOpenDocScannerModal) onOpenDocScannerModal();
        break;
      default:
        break;
    }
  };

  // 서식별 A4 미리보기
  const handlePreviewForm = (code: string) => {
    if (onOpenCourtDocSuite) {
      onOpenCourtDocSuite(code);
      return;
    }
    if (onOpenCourtFormPreviewModal) {
      onOpenCourtFormPreviewModal(code);
    } else {
      handleOpenFormEditor(code);
    }
  };

  // 선행 조건 검증
  const checkPreconditions = async (): Promise<boolean> => {
    if (!hasProposalSent || !isContactShared) {
      await dialog.alert({
        title: '선행 단계 미완료 (제안서 미발송)',
        message: '의뢰인에게 맞춤 제안서가 아직 발송되지 않았거나 의뢰인이 확인하지 않았습니다.\n\n[1단계 상담·제안]을 먼저 완료해 주세요.',
        variant: 'warning',
      });
      return false;
    }
    if (!isContracted) {
      await dialog.alert({
        title: '선행 단계 미완료 (수임계약 미체결)',
        message: '의뢰인과의 사건 위임계약 체결이 완료되지 않았습니다.\n\n[2단계 수임 계약] 단계를 먼저 완료해 주세요.',
        variant: 'warning',
      });
      return false;
    }
    if (!draftSuite.allReviewed) {
      const remainingCount = draftSuite.totalCount - draftSuite.approvedCount;
      await dialog.alert({
        title: '변호사 검토 미완료',
        message: `필수 전산서식 중 아직 변호사 검토·승인이 완료되지 않은 서식이 ${remainingCount}건 있습니다.\n\n변호사 전수 검토가 완료되어야 법원 전자소송 접수가 활성화됩니다.`,
        variant: 'warning',
      });
      return false;
    }
    return true;
  };

  // 중지명령 사건정보 저장
  const handleSaveStayInfo = async () => {
    if (!stayExecutionCaseNo.trim()) {
      toast.error('집행사건번호를 입력해 주세요 (예: 2026타채12345).');
      return;
    }
    if (!onUpdateCrmExt) return;
    setIsSavingStayInfo(true);
    try {
      await onUpdateCrmExt({
        courtCase: {
          ...(crmExt?.courtCase || {}),
          caseNumber: crmExt?.courtCase?.caseNumber || '',
          courtName: crmExt?.courtCase?.courtName || courtName,
          executionCaseNumber: stayExecutionCaseNo.trim(),
          executionCourt: stayExecutionCourt.trim(),
          executionCreditor: stayExecutionCreditor.trim(),
        } as any,
      });
      toast.success('중지명령 대상 강제집행 사건정보가 저장되었습니다.');
    } catch (e: any) {
      toast.error(e?.message || '저장에 실패했습니다.');
    } finally {
      setIsSavingStayInfo(false);
    }
  };

  // 의뢰인 제출 동의 토글/저장
  const handleToggleClientConsent = async (consented: boolean) => {
    const today = localYmd();
    setIsClientConsented(consented);
    setClientConsentDate(consented ? today : '');

    if (onUpdateCrmExt) {
      try {
        await onUpdateCrmExt({
          courtCase: {
            ...(crmExt?.courtCase || {}),
            caseNumber: crmExt?.courtCase?.caseNumber || '',
            courtName: crmExt?.courtCase?.courtName || courtName,
            clientConsent: {
              consented,
              consentDate: consented ? today : undefined,
              consentMethod: 'direct_confirmation',
            },
          } as any,
        });
        toast.success(consented ? '의뢰인 제출 동의가 등록되었습니다.' : '의뢰인 제출 동의가 해제되었습니다.');
      } catch (err: any) {
        toast.error('동의 상태 저장에 실패했습니다.');
      }
    }
  };

  // 의뢰인 제출 동의 알림톡/문자 발송 시뮬레이션
  const handleRequestClientConsentNotification = async () => {
    setIsRequestingConsent(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      toast.success(`${clientName} 님에게 최종 신청서 초안 확인 및 제출 동의 요청 알림톡을 발송했습니다.`);
      // 의뢰인 확인 동의 유도
      const confirmed = await dialog.confirm({
        title: '의뢰인 제출 동의 확인',
        message: `${clientName} 님이 신청서 내용을 확인하고 법원 접수에 동의하였습니까?\n\n'동의 완료' 선택 시 제출 동의 상태로 즉시 등록됩니다.`,
        confirmText: '동의 완료',
        cancelText: '대기 유지',
        variant: 'primary',
      });
      if (confirmed) {
        await handleToggleClientConsent(true);
      }
    } finally {
      setIsRequestingConsent(false);
    }
  };

  // 법원 접수 정보 저장 핸들러
  const handleSaveFilingInfo = async () => {
    if (!caseNumberInput.trim()) {
      toast.error('법원 사건번호를 입력해 주세요 (예: 2026개회10234).');
      return;
    }
    if (!onUpdateCrmExt) {
      toast.info('저장 핸들러가 연결되지 않았습니다.');
      return;
    }
    setIsSavingFilingInfo(true);
    try {
      await onUpdateCrmExt({
        courtCase: {
          ...(crmExt?.courtCase || {}),
          caseType: crmExt?.courtCase?.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
          caseNumber: caseNumberInput.trim(),
          courtName: courtNameInput.trim() || courtName,
          filingDate: filingDateInput,
        },
      });
      toast.success('법원 접수 정보(사건번호·법원·접수일)가 저장되었습니다.');
    } catch (e: any) {
      toast.error(e?.message || '접수 정보 저장에 실패했습니다.');
    } finally {
      setIsSavingFilingInfo(false);
    }
  };

  // 법원 접수 완료 처리
  const handleCompleteFiling = async () => {
    const passed = await checkPreconditions();
    if (!passed) return;

    if (!isClientConsented) {
      const proceedWithoutConsent = await dialog.confirm({
        title: '의뢰인 제출 동의 미확인',
        message: '의뢰인의 최종 신청서 제출 동의가 아직 확인되지 않았습니다.\n\n동의 확인을 완료하고 접수하시겠습니까?',
        confirmText: '동의 완료 처리 후 접수',
        cancelText: '취소',
        variant: 'warning',
      });
      if (!proceedWithoutConsent) return;
      await handleToggleClientConsent(true);
    }

    const confirmed = await dialog.confirm({
      title: '대법원 전자소송 접수 완료 기록',
      message: '대법원 전자소송에서 실제 접수를 마치셨습니까?\n\n사건 상태를 [법원 접수(filed)]로 변경하고 접수 정보를 보존합니다.',
      confirmText: '접수 완료 승인',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    if (caseNumberInput.trim() && onUpdateCrmExt) {
      await onUpdateCrmExt({
        courtCase: {
          ...(crmExt?.courtCase || {}),
          caseType: crmExt?.courtCase?.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
          caseNumber: caseNumberInput.trim(),
          courtName: courtNameInput.trim() || courtName,
          filingDate: filingDateInput,
        },
      });
    }

    const ok = onUpdateStatus ? await onUpdateStatus('filed') : false;
    if (ok === false) return;
    setIsFilingSubmitted(true);
    toast.success(
      caseNumberInput.trim()
        ? `사건 상태를 [법원 접수]로 기록했습니다. (사건번호: ${caseNumberInput.trim()})`
        : '사건 상태를 [법원 접수]로 기록했습니다. 사건번호를 등록해 주세요.'
    );
  };

  // 전자소송 일괄 패키징 클릭
  const handleBatchFilingClick = async () => {
    const passed = await checkPreconditions();
    if (!passed) return;
    if (onOpenBatchFilingModal) {
      onOpenBatchFilingModal();
    }
  };

  // 미검토 첫 서식 대조 검토 모달 열기
  const handleReviewFirstPending = () => {
    const pendingForm = standardForms.find(f => draftSuite.forms[f.code]?.reviewStatus !== 'REVIEWED_APPROVED');
    if (pendingForm && draftSuite.forms[pendingForm.code]) {
      setSelectedReviewForm(draftSuite.forms[pendingForm.code]);
    } else {
      handleApproveAll();
    }
  };

  // 주 버튼(Primary CTA) 렌더링 로직 (상태별 단일 주 버튼 원칙)
  const renderPrimaryAction = () => {
    if (isFilingSubmitted) {
      return (
        <button
          type="button"
          onClick={onAdvanceToNextStage}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <span>Stage 5 (법원대응·보정)로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      );
    }

    // Step 1: 서식 검토 미완료
    if (!draftSuite.allReviewed) {
      const remaining = draftSuite.totalCount - draftSuite.approvedCount;
      return (
        <button
          type="button"
          onClick={handleReviewFirstPending}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Clock className="w-4 h-4 text-amber-300" />
          <span>서식 대조 검토 ({remaining}건 대기)</span>
        </button>
      );
    }

    // Step 2: 의뢰인 제출 동의 미확인
    if (!isClientConsented) {
      return (
        <button
          type="button"
          onClick={handleRequestClientConsentNotification}
          disabled={isRequestingConsent}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-blue-300" />
          <span>{isRequestingConsent ? '발송 중...' : '의뢰인 제출 동의 요청'}</span>
        </button>
      );
    }

    // Step 3: 동의 확인 완료, 접수 대기
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBatchFilingClick}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Archive className="w-4 h-4 text-emerald-300" />
          <span>전자소송 일괄 패키징 & 접수</span>
        </button>
        <button
          type="button"
          onClick={handleCompleteFiling}
          className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Check className="w-4 h-4 text-emerald-600" />
          <span>접수 완료 기록</span>
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      {/* ── 1. 상단 라이트 헤더 & 3대 섹션 내비게이션 ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#1E3A5F]" />
                대법원 전자소송 표준 전산 서식
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E3A5F] border border-blue-200 text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                {caseType === 'bankruptcy' ? '개인파산 7대 서식' : '개인회생 8대 서식'}
              </span>
              {crmExt?.courtCase?.caseNumber && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-bold">
                  사건번호: {crmExt.courtCase.caseNumber}
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>전자소송 신청 서식 및 통합 작성기</span>
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              신청서, 채권자목록, 재산목록, 수입지출, 변제계획안, 진술서, 부수신청을 통합 화면에서 작성·검토하고 전자소송에 접수합니다.
            </p>

            {/* 사건 기본 정보 요약 한 줄 */}
            <div className="pt-1 flex items-center gap-2 text-xs text-slate-600 flex-wrap font-mono">
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                신청인: <strong className="text-slate-900">{clientName}</strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                관할: <strong className="text-slate-900">{courtName}</strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                대리인: <strong className="text-slate-900">{lawyerName}</strong>
              </span>
            </div>
          </div>

          {/* 우측 마스터 액션 버튼 그룹 */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[200px]">
            {onOpenCourtDocSuite && (
              <button
                type="button"
                onClick={() => onOpenCourtDocSuite('COVER')}
                className="w-full px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>통합 서식 작성기 열기</span>
              </button>
            )}

            {onOpenCourtDocExportModal && (
              <button
                type="button"
                onClick={onOpenCourtDocExportModal}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer press-scale whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>법원 서식 8종 출력 (인쇄/PDF)</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 3대 섹션 탭 네비게이션 (신청 서식 · 부수 신청 · 검토·제출) ── */}
        <div className="pt-4 flex items-center gap-2 border-slate-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSwitchSection('petition')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'petition'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>신청 서식 ({caseType === 'bankruptcy' ? '7대' : '8대'} 서식 준비도)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${
              currentSection === 'petition' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {draftSuite.approvedCount}/{draftSuite.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('ancillary')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'ancillary'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>부수 신청 (금지·중지명령)</span>
            {includeStayOrder && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                currentSection === 'ancillary' ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-amber-100 text-amber-800'
              }`}>
                중지포함
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('filing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'filing'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>검토·제출 (의뢰인 동의 · 접수 등록)</span>
            {isFilingSubmitted ? (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                currentSection === 'filing' ? 'bg-emerald-400 text-slate-900 font-bold' : 'bg-emerald-100 text-emerald-800'
              }`}>
                접수완료
              </span>
            ) : isClientConsented ? (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                currentSection === 'filing' ? 'bg-blue-300 text-slate-900 font-bold' : 'bg-blue-100 text-blue-800'
              }`}>
                동의완료
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ── 2. 섹션 1: 신청 서식 (petition) ── */}
      {currentSection === 'petition' && (
        <div className="space-y-6">
          {/* 서식 검증 매트릭스 & 변호사 전수 검토 상태 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#1E3A5F] rounded-xl">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {caseType === 'bankruptcy' ? '파산 7대' : '회생 8대'} 필수 전산서식 검증 및 준비 상태
                  </h3>
                  <p className="text-xs text-slate-500">
                    원천 증빙과 대조 검토 후 승인하면 전자소송 일괄 패키징에 포함됩니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunAiAutoDraft}
                  disabled={isAiGenerating}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                  <span>{isAiGenerating ? '초안 생성 중...' : 'AI 초안 재실행'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>전수 일괄 승인</span>
                </button>
              </div>
            </div>

            {/* 검토 현황 프로그레스 바 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  변호사 전수 검토 현황:
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {draftSuite.approvedCount} / {draftSuite.totalCount}건 승인 완료 ({Math.round((draftSuite.approvedCount / draftSuite.totalCount) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    draftSuite.allReviewed ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${(draftSuite.approvedCount / draftSuite.totalCount) * 100}%` }}
                />
              </div>
            </div>

            {/* 8대 서식 그리드 카드 (2열 그리드) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {standardForms.map((form) => {
                const draftItem = draftSuite.forms[form.code];
                const isApproved = draftItem?.reviewStatus === 'REVIEWED_APPROVED';
                const isSupplement = draftItem?.reviewStatus === 'SUPPLEMENT_REQUIRED';
                const riskCount = draftItem?.riskFlags?.length || 0;

                return (
                  <div
                    key={form.code}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isApproved
                        ? 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40'
                        : isSupplement
                        ? 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/40'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                            {form.code}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {form.name}
                          </span>
                        </div>

                        {/* 상태 배지 */}
                        <div className="shrink-0">
                          {isApproved ? (
                            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              승인 완료
                            </span>
                          ) : isSupplement ? (
                            <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              보완 필요
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              검토 대기
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        {draftItem?.summaryNote || form.note}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{form.badge}</span>
                        {draftItem && <span>신뢰도 {draftItem.confidenceScore}%</span>}
                        {riskCount > 0 && <span className="text-amber-600 font-semibold">점검 {riskCount}건</span>}
                      </div>
                    </div>

                    {/* 단일 액션 버튼 (미승인 시: 대조 검토, 승인 시: A4 미리보기/편집) */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {form.isReady ? '데이터 연동됨' : '데이터 입력 필요'}
                      </span>

                      {!isApproved ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (draftItem) setSelectedReviewForm(draftItem);
                            else handleOpenFormEditor(form.code);
                          }}
                          className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>대조 검토</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePreviewForm(form.code)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>A4 보기</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFormEditor(form.code)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>편집</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 제614조 청산가치 보장 안내 */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs">법 제614조 점검</span>
                <span>청산가치 보장 및 가용소득 전액 투입 원칙은 변제계획안(R04)에서 최종 확인됩니다.</span>
              </div>
              <button
                type="button"
                onClick={() => handleSwitchSection('filing')}
                className="text-xs text-[#1E3A5F] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>검토·제출 단계로 이동</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 섹션 2: 부수 신청 (ancillary) ── */}
      {currentSection === 'ancillary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 금지명령 신청서 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">금지명령 신청서 (법 제593조)</h3>
                      <p className="text-xs text-slate-500">급여·유체동산 압류 차단 및 채권자 독촉·추심 일체 중지</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeProhibition}
                      onChange={(e) => setIncludeProhibition(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">신청 포함</span>
                  </label>
                </div>

                <div className="pt-3 space-y-2.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    개인회생 개시신청과 동시에 법원에 금지명령을 신청하여, 개시결정 전까지 채권자들의 무분별한 급여 가압류, 유체동산 압류 및 빚독촉 전화/방문 추심을 법적으로 차단합니다.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">신청인:</span>
                      <span className="font-bold text-slate-800">{clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">관할 법원:</span>
                      <span className="font-bold text-slate-800">{courtName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">통상 발령 기한:</span>
                      <span className="font-bold text-emerald-700">접수 후 3~7영업일 내</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {includeProhibition ? '✓ 전자소송 접수 패키지에 포함됨' : '미포함 상태'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCourtDocSuite) onOpenCourtDocSuite('PROHIBITION_ORDER');
                    else toast.info('금지명령 서식 미리보기를 엽니다.');
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>금지명령 서식 미리보기/편집</span>
                </button>
              </div>
            </div>

            {/* 중지명령 신청서 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">중지명령 신청서 (법 제593조 제1항 제2호)</h3>
                      <p className="text-xs text-slate-500">이미 진행 중인 강제집행·가압류·경매 절차의 일시 중지</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeStayOrder}
                      onChange={(e) => setIncludeStayOrder(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">신청 포함</span>
                  </label>
                </div>

                <div className="pt-3 space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    급여 압류·추심명령, 부동산 임의경매, 통장 압류 등 이미 강제집행이 착수된 경우, 해당 집행사건번호를 특정하여 집행 정지를 구합니다.
                  </p>

                  {/* 강제집행 정보 입력 폼 */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">강제집행 사건번호 *</label>
                      <input
                        type="text"
                        value={stayExecutionCaseNo}
                        onChange={(e) => setStayExecutionCaseNo(e.target.value)}
                        placeholder="예: 2026타채12345 (채권압류및추심명령)"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">집행 법원</label>
                        <input
                          type="text"
                          value={stayExecutionCourt}
                          onChange={(e) => setStayExecutionCourt(e.target.value)}
                          placeholder="예: 서울중앙지방법원"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">압류 채권자</label>
                        <input
                          type="text"
                          value={stayExecutionCreditor}
                          onChange={(e) => setStayExecutionCreditor(e.target.value)}
                          placeholder="예: 주식회사 국민은행"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div className="text-right pt-1">
                      <button
                        type="button"
                        onClick={handleSaveStayInfo}
                        disabled={isSavingStayInfo}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer press-scale disabled:opacity-50"
                      >
                        {isSavingStayInfo ? '저장 중...' : '집행정보 저장'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {includeStayOrder ? '✓ 중지명령 신청서 작성 대상' : '중지명령 미신청'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCourtDocSuite) onOpenCourtDocSuite('STAY_ORDER');
                    else toast.info('중지명령 서식 미리보기를 엽니다.');
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>중지명령 서식 미리보기/편집</span>
                </button>
              </div>
            </div>
          </div>

          {/* 포괄적 금지명령 및 법원 안내 카드 */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-slate-800 block">포괄적 금지명령 및 회생법원 실무 안내</strong>
              <p>
                서울회생법원, 수원회생법원, 부산회생법원 등 전문 회생법원은 개별 금지명령과 함께 포괄적 금지명령을 병행 발령하여 채무자의 재산 보전에 만전을 기하고 있습니다. 급여 가압류가 이미 발생한 경우 중지명령을 통해 적립금을 확보할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. 섹션 3: 검토·제출 및 접수 (filing) ── */}
      {currentSection === 'filing' && (
        <div className="space-y-6">
          {/* 대법원 전자소송 제출목록 종합 관리 패널 */}
          <FilingChecklistPanel
            clientRequest={clientRequest}
            crmExt={crmExt}
            activeLawyerName={lawyerName}
            onOpenCourtDocSuite={onOpenCourtDocSuite}
            onOpenBatchFilingModal={onOpenBatchFilingModal}
          />

          {/* 4대 관문 게이트웨이 파이프라인 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gate 1: 변호사 전수 검토 완료 여부 */}
            <div className={`p-5 rounded-2xl border transition-all ${
              draftSuite.allReviewed
                ? 'bg-emerald-50/30 border-emerald-200'
                : 'bg-amber-50/30 border-amber-200'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    draftSuite.allReviewed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {draftSuite.allReviewed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">Gate 1: 변호사 서식 전수 검토</h4>
                </div>
                <span className={`text-xs font-mono font-bold ${
                  draftSuite.allReviewed ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {draftSuite.approvedCount}/{draftSuite.totalCount} 완료
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                {draftSuite.allReviewed
                  ? '모든 필수 전산서식의 변호사 검토 및 승인이 완료되었습니다.'
                  : `아직 승인되지 않은 서식이 ${draftSuite.totalCount - draftSuite.approvedCount}건 남아있습니다. 서식 대조 검토를 완료해 주세요.`}
              </p>
              {!draftSuite.allReviewed && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleReviewFirstPending}
                    className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-bold rounded-lg transition-all press-scale cursor-pointer"
                  >
                    미승인 서식 검토하기
                  </button>
                </div>
              )}
            </div>

            {/* Gate 2: 의뢰인 최종 제출 동의 */}
            <div className={`p-5 rounded-2xl border transition-all ${
              isClientConsented
                ? 'bg-blue-50/30 border-blue-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    isClientConsented ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <FileSignature className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">Gate 2: 의뢰인 최종 제출 동의</h4>
                </div>
                <span className={`text-xs font-bold ${
                  isClientConsented ? 'text-blue-700' : 'text-slate-500'
                }`}>
                  {isClientConsented ? '동의 완료' : '동의 대기'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                {isClientConsented
                  ? `의뢰인 ${clientName} 님이 최종 서식 내용 확인 및 법원 제출에 동의하였습니다. (${clientConsentDate || '확인됨'})`
                  : '최종 신청서 초안을 의뢰인에게 안내하고 제출 동의를 확인받습니다.'}
              </p>
              <div className="pt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleRequestClientConsentNotification}
                  disabled={isRequestingConsent}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>동의 요청 알림톡</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleClientConsent(!isClientConsented)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale ${
                    isClientConsented
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{isClientConsented ? '동의 해제' : '동의 완료 확인'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 법원 접수 정보 등록 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">법원 접수 정보 등록 (사건번호 · 관할법원 · 접수일)</h3>
                  <p className="text-xs text-slate-500">
                    전자소송 접수 후 법원에서 부여한 사건번호를 등록하면 5단계 보정 관리와 자동 연동됩니다.
                  </p>
                </div>
              </div>

              {crmExt?.courtCase?.caseNumber && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shrink-0">
                  ✓ 등록된 사건번호: {crmExt.courtCase.caseNumber}
                </span>
              )}
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">법원 사건번호 *</label>
                <input
                  type="text"
                  value={caseNumberInput}
                  onChange={(e) => setCaseNumberInput(e.target.value)}
                  placeholder="예: 2026개회10234 / 2026하단5012"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">관할 법원 *</label>
                <input
                  type="text"
                  value={courtNameInput}
                  onChange={(e) => setCourtNameInput(e.target.value)}
                  placeholder="예: 서울회생법원, 수원회생법원"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">접수 일자 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filingDateInput}
                    onChange={(e) => setFilingDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveFilingInfo}
                    disabled={isSavingFilingInfo}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap cursor-pointer press-scale shrink-0 disabled:opacity-50"
                  >
                    {isSavingFilingInfo ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 전자소송 일괄 패키징 안내 카드 */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Archive className="w-4 h-4 text-[#1E3A5F]" />
                <span>대법원 전자소송 제출용 일괄 패키징</span>
              </h4>
              <p className="text-xs text-slate-600">
                8대 필수 서식과 부수신청, 4대 발급처 첨부서류를 하나의 ZIP 압축 번들 또는 결합 PDF로 생성하여 대법원 전자소송에 원클릭으로 제출할 수 있습니다.
              </p>
            </div>
            {onOpenBatchFilingModal && (
              <button
                type="button"
                onClick={handleBatchFilingClick}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition-all flex items-center gap-2 cursor-pointer press-scale shrink-0 whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-[#1E3A5F]" />
                <span>일괄 패키징 모달 열기</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 5. 하단 단일 주 액션 바 (라이트 서페이스, 12px 하한, AGENTS.md 준수) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sticky bottom-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isFilingSubmitted
              ? 'bg-emerald-600 text-white'
              : draftSuite.allReviewed && isClientConsented
              ? 'bg-[#1E3A5F] text-white'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {isFilingSubmitted ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">
                {isFilingSubmitted
                  ? '법원 정식 접수 완료'
                  : !draftSuite.allReviewed
                  ? '1. 변호사 전수 검토 필요'
                  : !isClientConsented
                  ? '2. 의뢰인 최종 제출 동의 필요'
                  : '3. 전자소송 패키징 및 접수 대기'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                isFilingSubmitted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : draftSuite.allReviewed && isClientConsented
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {isFilingSubmitted ? 'Stage 5 진행 가능' : '접수 준비'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFilingSubmitted
                ? (crmExt?.courtCase?.caseNumber ? `사건번호 ${crmExt.courtCase.caseNumber} · Stage 5에서 보정명령을 관리합니다.` : '접수 완료되었습니다. 사건번호를 등록해 주세요.')
                : !draftSuite.allReviewed
                ? `8대 서식 중 ${draftSuite.totalCount - draftSuite.approvedCount}건의 검토가 남아있습니다.`
                : !isClientConsented
                ? '의뢰인에게 최종 신청서 초안 확인 및 동의를 요청해 주세요.'
                : '검토 및 동의가 완료되었습니다. 전자소송에 접수하고 접수 완료를 기록하세요.'}
            </p>
          </div>
        </div>

        {/* 주 액션 버튼 (상태별 단일 주 버튼 흐름) */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {renderPrimaryAction()}
        </div>
      </div>

      {/* ── 6. AI 자동 초안 대조 검토 모달 ── */}
      {selectedReviewForm && (
        <AutoDraftReviewSplitModal
          formItem={selectedReviewForm}
          isOpen={Boolean(selectedReviewForm)}
          onClose={() => setSelectedReviewForm(null)}
          onApprove={handleApproveFormItem}
          onRejectSupplement={handleRejectSupplement}
          onOpenFullEditor={handleOpenFormEditor}
          onPreviewCourtForm={handlePreviewForm}
        />
      )}
    </div>
  );
}
