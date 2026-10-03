/**
 * CourtDocSuiteViewerModal.tsx
 * 대법원 전자소송 개인회생 13종 표준 서식 통합 웹 위지윅(WYSIWYG) 에디터 & 인쇄/PDF 뷰어 모달
 * - Split-Screen 실시간 양방향 반응형 인터페이스 (Live-Binding Dual Screen)
 * - 상단 12개 가로형 서식 탭 ([표지] ~ [자료 제출] + [전체 일괄])
 * - 좌측 62%: A4 실시간 캔버스 (대법원 바탕체 표준 규격)
 * - 우측 38%: CourtFilingInputSidebar (스마트 아코디언 입력 폼 & 5대 특약 원클릭 삽입기)
 * - 4대 관할법원(전국공통, 강릉지원, 대전지법, 청주지법) 자료제출목록 동적 전환 및 HWP 원본 다운로드
 * - 110~140p 첨부 직결(Interleaved) 완성본 번들 PDF 머징 연동
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Printer, Download, Save, Edit3, CheckCircle2, 
  AlertTriangle, FileText, Layers, RefreshCw, ZoomIn, 
  ZoomOut, ShieldCheck, Scale, Sparkles, FolderArchive,
  PanelRightClose, PanelRightOpen, ArrowRight, Eye, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  buildCourtFilingMasterData, 
  recalculateMasterData,
  getEvidenceListForJurisdiction,
  type CourtFilingMasterData 
} from '../../../services/documents/courtFilingEngine';
import {
  computeFieldIssues,
  summarizeFieldIssues,
  getFieldDef,
  type CourtDocTabKey,
} from '../../../services/documents/courtFieldRegistry';
import { 
  SummaryAndUrgentNoticeDoc,
  PetitionCoverDoc,
  PetitionBodyDoc,
  CreditorListDoc,
  AssetInventoryDoc,
  IncomeExpenseDoc,
  MonthlyIncomeLedgerDoc,
  WrittenStatementDoc,
  RepaymentPlanStandardDoc,
  ProhibitionOrderDoc,
  StayOrderDoc,
  EvidenceSubmissionListDoc,
  PowerOfAttorneyAndPledgeDoc
} from './CourtFilingDocTemplates';
import CourtFilingInputSidebar, { type CourtFilingInputSidebarHandle } from './CourtFilingInputSidebar';
import { useCourtEditorHotkeys } from './useCourtEditorHotkeys';
import { exportCourtPagesToPdf } from '../../../services/documents/courtPdfExportService';
import { exportCourtFilingCompleteBundle } from '../../../services/documents/courtFilingBundleService';
import { downloadFilledHwpx, HWPX_TEMPLATE_CATALOG } from '../../../services/court/hwpxTemplateEngine';
import { mapMasterDataToHwpxFields, type CourtFormType } from '../../../services/court/hwpxFieldMapper';

/**
 * 편집기에서 사용자가 직접 입력한 값 묶음.
 * CRM 원본(채권자 등)은 매번 새로 만들고, 사용자가 입력한 인적사항·일정은 이 초안으로 덮어쓴다.
 */
type CourtFilingDraft = Pick<CourtFilingMasterData, 'debtor' | 'lawyer' | 'court' | 'statement' | 'trusteeAccount'> & {
  repaymentSummary?: Partial<CourtFilingMasterData['repaymentSummary']>;
  courtJurisdiction?: CourtFilingMasterData['courtJurisdiction'];
};

const DRAFT_SUMMARY_KEYS = [
  'monthlyNetIncome', 'householdSize', 'medianIncomeAmount', 'medianIncomeRatio',
  'monthlyLivingCost', 'additionalLivingCost', 'repaymentMonths',
] as const;

function extractDraft(d: CourtFilingMasterData): CourtFilingDraft {
  const summary: Partial<CourtFilingMasterData['repaymentSummary']> = {};
  DRAFT_SUMMARY_KEYS.forEach(k => { (summary as Record<string, unknown>)[k] = d.repaymentSummary[k]; });
  return {
    debtor: d.debtor, lawyer: d.lawyer, court: d.court, statement: d.statement,
    trusteeAccount: d.trusteeAccount, repaymentSummary: summary, courtJurisdiction: d.courtJurisdiction,
  };
}

function applyDraft(base: CourtFilingMasterData, draft?: Partial<CourtFilingDraft> | null): CourtFilingMasterData {
  if (!draft || typeof draft !== 'object') return base;
  const jurisdiction = draft.courtJurisdiction ?? base.courtJurisdiction;
  return recalculateMasterData({
    ...base,
    courtJurisdiction: jurisdiction,
    evidenceList: jurisdiction !== base.courtJurisdiction ? getEvidenceListForJurisdiction(jurisdiction) : base.evidenceList,
    debtor: { ...base.debtor, ...(draft.debtor || {}) },
    lawyer: { ...base.lawyer, ...(draft.lawyer || {}) },
    court: { ...base.court, ...(draft.court || {}) },
    statement: { ...base.statement, ...(draft.statement || {}) },
    trusteeAccount: { ...base.trusteeAccount, ...(draft.trusteeAccount || {}) },
    repaymentSummary: { ...base.repaymentSummary, ...(draft.repaymentSummary || {}) },
  });
}

// ── 법원 원본 1:1 양식 컴포넌트 (HWPX 파싱 기반) ──
import { PetitionFormD5100 } from './forms/PetitionFormD5100';
import { AssetInventoryFormD5101 } from './forms/AssetInventoryFormD5101';
import { IncomeExpenseFormD5103 } from './forms/IncomeExpenseFormD5103';
import { WrittenStatementFormD5105 } from './forms/WrittenStatementFormD5105';
import { CreditorListFormD5106 } from './forms/CreditorListFormD5106';
import { RepaymentPlanFormD5110 } from './forms/RepaymentPlanFormD5110';
import { RepaymentScheduleTable } from './forms/RepaymentScheduleTable';
import { ProhibitionOrderFormD5114 } from './forms/ProhibitionOrderFormD5114';
import { PowerOfAttorneyForm } from './forms/PowerOfAttorneyForm';
import { ServiceReportForm } from './forms/ServiceReportForm';
import { StayOrderFormD5113 } from './forms/StayOrderFormD5113';
import { EvidenceListForm } from './forms/EvidenceListForm';
import { PetitionCoverPage } from './forms/PetitionCoverPage';

interface CourtDocSuiteViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyerName?: string;
  initialTab?: DocTabId;
  initialFormCode?: string;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
}

export type DocTabId = 
  | 'PETITION_COVER'     // 표지
  | 'PETITION_BODY'      // 신청서
  | 'STATEMENT'          // 진술서
  | 'CREDITOR_LIST'      // 채권자 목록
  | 'ANNEX_DOCS'         // 부속서류
  | 'ASSET_LIST'         // 재산 목록
  | 'INCOME_EXPENSE'     // 수입 및 지출
  | 'REPAYMENT_PLAN'     // 변제계획안
  | 'REPAYMENT_SCHEDULE' // 변제예정액표
  | 'POWER_OF_ATTORNEY'  // 위임장
  | 'SERVICE_REPORT'     // 송달 신고서
  | 'EVIDENCE_LIST'      // 자료 제출
  | 'PROHIBITION_ORDER'  // 금지명령
  | 'STAY_ORDER'         // 중지명령
  | 'ALL';               // 전체 일괄

export function formCodeToDocTabId(code: string): DocTabId {
  switch (code) {
    case 'R01': return 'PETITION_BODY';
    case 'R02': return 'CREDITOR_LIST';
    case 'R06': return 'ASSET_LIST';
    case 'R08': return 'INCOME_EXPENSE';
    case 'R10': return 'STATEMENT';
    case 'R04': return 'REPAYMENT_PLAN';
    case 'R03': return 'POWER_OF_ATTORNEY';
    case 'R07': return 'EVIDENCE_LIST';
    case 'PROHIBITION': return 'PROHIBITION_ORDER';
    case 'STAY': return 'STAY_ORDER';
    case 'COVER': return 'PETITION_COVER';
    case 'ALL': return 'ALL';
    default: return 'PETITION_BODY';
  }
}

function CourtDocSuiteViewerModalInner({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '',
  initialTab,
  initialFormCode,
  onUpdateCrmExt
}: CourtDocSuiteViewerModalProps) {

  const resolveInitialTab = (): DocTabId => {
    if (initialTab) return initialTab;
    if (initialFormCode) return formCodeToDocTabId(initialFormCode);
    return 'PETITION_BODY';
  };

  // 데이터 바인딩 (CRM 원본 + 이전에 저장한 편집 초안)
  const [masterData, setMasterData] = useState<CourtFilingMasterData>(() => {
    const base = buildCourtFilingMasterData(clientRequest, crmExt, activeLawyerName);
    return applyDraft(base, (crmExt?.courtCase as Record<string, any> | undefined)?.courtFilingDraft);
  });

  const [activeTab, setActiveTab] = useState<DocTabId>(resolveInitialTab);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const selectedFont = 'font-serif';
  const [fontSize, setFontSize] = useState<string>('text-[12px]');
  const [zoomLevel, setZoomLevel] = useState<number>(95);
  const [isBundling, setIsBundling] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<CourtFilingInputSidebarHandle | null>(null);

  // 입력 칸 ↔ 서식 매핑: 현재 선택된 필드 키
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  // 입력 칸에서 온 선택이면 서식 쪽을 해당 위치로 스크롤
  const scrollCanvasRef = useRef(false);

  // 미입력·형식 오류
  const issueSummary = useMemo(() => summarizeFieldIssues(computeFieldIssues(masterData)), [masterData]);

  // initialTab 또는 initialFormCode 변경 시 동기화
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (initialFormCode) {
      setActiveTab(formCodeToDocTabId(initialFormCode));
    }
  }, [initialTab, initialFormCode, isOpen]);

  // 표준 가로 서식 탭 목록
  const horizontalTabs: { id: DocTabId; label: string; badge?: string }[] = [
    { id: 'PETITION_COVER', label: '표지' },
    { id: 'PETITION_BODY', label: '신청서' },
    { id: 'STATEMENT', label: '진술서' },
    { id: 'CREDITOR_LIST', label: '채권자 목록' },
    { id: 'ANNEX_DOCS', label: '부속서류' },
    { id: 'ASSET_LIST', label: '재산 목록' },
    { id: 'INCOME_EXPENSE', label: '수입 및 지출' },
    { id: 'REPAYMENT_PLAN', label: '변제계획안' },
    { id: 'REPAYMENT_SCHEDULE', label: '변제예정액표' },
    { id: 'POWER_OF_ATTORNEY', label: '위임장' },
    { id: 'EVIDENCE_LIST', label: '자료 제출', badge: 'HWP' },
    { id: 'PROHIBITION_ORDER', label: '금지명령' },
    { id: 'STAY_ORDER', label: '중지명령' },
    { id: 'ALL', label: '전체문서', badge: '통합' }
  ];

  // ── 서식 위 강조·미입력 표시 (값 래퍼 F 의 data-field 기준, 렌더마다 동기화) ──
  useEffect(() => {
    const root = printAreaRef.current;
    if (!root) return;
    let firstActive: HTMLElement | null = null;
    root.querySelectorAll<HTMLElement>('[data-field]').forEach(el => {
      const key = el.dataset.field || '';
      const isActive = key === activeFieldKey;
      el.classList.toggle('cf-active', isActive);
      el.classList.toggle('cf-missing', issueSummary.byKey.get(key)?.kind === 'missing');
      el.classList.toggle('cf-invalid', issueSummary.byKey.get(key)?.kind === 'invalid');
      if (isActive && !firstActive) firstActive = el;
    });
    if (scrollCanvasRef.current && firstActive) {
      (firstActive as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    scrollCanvasRef.current = false;
  });

  /** 입력 칸 포커스 → 서식 강조 */
  const handleSidebarFieldFocus = (key: string | null) => {
    if (key === activeFieldKey) return;
    scrollCanvasRef.current = !!key;
    setActiveFieldKey(key);
  };

  /** 서식 클릭 → 입력 칸으로 이동 (직접 타이핑 모드에서는 커서를 뺏지 않고 위치만 표시) */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-field]');
    if (!target) return;
    const key = target.dataset.field || '';
    if (!getFieldDef(key)) return;
    setActiveFieldKey(key);
    if (!showSidebar) setShowSidebar(true);
    // 사이드바가 막 열렸다면 렌더 후 호출
    window.setTimeout(() => sidebarRef.current?.revealField(key, { focus: !isEditMode }), 0);
  };

  /** F2 / 버튼: 다음 미입력·오류 항목으로 이동 */
  const goToNextIssue = () => {
    const list = issueSummary.issues;
    if (list.length === 0) {
      toast.success('확인이 필요한 항목이 없습니다.');
      return;
    }
    const curIdx = activeFieldKey ? list.findIndex(i => i.key === activeFieldKey) : -1;
    const next = list[(curIdx + 1) % list.length];
    const onCurrentTab = next.docTabs.includes(activeTab as CourtDocTabKey);
    if (!onCurrentTab && activeTab !== 'ALL') setActiveTab(next.docTabs[0] as DocTabId);
    if (!showSidebar) setShowSidebar(true);
    scrollCanvasRef.current = true;
    setActiveFieldKey(next.key);
    window.setTimeout(() => sidebarRef.current?.revealField(next.key, { focus: true }), 0);
  };

  const moveTab = (dir: 1 | -1) => {
    const idx = horizontalTabs.findIndex(t => t.id === activeTab);
    const next = horizontalTabs[(idx + dir + horizontalTabs.length) % horizontalTabs.length];
    setActiveTab(next.id);
  };

  // 수정사항 저장 핸들러
  const handleSave = async () => {
    try {
      if (onUpdateCrmExt) {
        const prevCourtCase = (crmExt?.courtCase || {}) as Record<string, any>;
        const prevPlan = (crmExt?.repaymentPlan || {}) as Record<string, any>;
        await onUpdateCrmExt({
          courtCase: {
            // 기존 사건 정보(caseType, 개시결정일, 이벤트 등)는 유지하고 편집한 값만 덮어쓴다
            ...prevCourtCase,
            caseType: prevCourtCase.caseType || '개인회생',
            courtName: masterData.court.courtName,
            caseNumber: masterData.court.caseNumber,
            applicantName: masterData.debtor.name,
            serviceRecipient: masterData.debtor.serviceRecipient,
            serviceAddress: masterData.debtor.serviceAddress,
            refundBank: masterData.debtor.refundBank,
            refundAccount: masterData.debtor.refundAccount,
            courtFilingDraft: extractDraft(masterData),
          },
          repaymentPlan: {
            ...prevPlan,
            creditors: masterData.creditors,
            months: masterData.repaymentSummary.repaymentMonths,
          } as CrmClientExtension['repaymentPlan'],
        });
      }
      toast.success('서식 입력 내용을 저장했습니다.');
    } catch (err: any) {
      toast.error(`저장 중 오류: ${err.message || '저장 실패'}`);
    }
  };

  // 키보드 단축키 (Enter 이동은 사이드바에서 처리)
  useCourtEditorHotkeys({
    enabled: isOpen,
    onSave: () => { void handleSave(); },
    onNextTab: () => moveTab(1),
    onPrevTab: () => moveTab(-1),
    onOpenSection: (index) => {
      if (!showSidebar) setShowSidebar(true);
      window.setTimeout(() => sidebarRef.current?.openSectionAt(index), 0);
    },
    onNextIssue: goToNextIssue,
    onToggleHelp: () => {
      if (!showSidebar) setShowSidebar(true);
      window.setTimeout(() => sidebarRef.current?.toggleShortcuts(), 0);
    },
  });

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // PDF 다운로드 핸들러 (실제 A4 PDF 파일 즉시 생성 및 다운로드)
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    try {
      setIsGeneratingPdf(true);
      const currentTabObj = horizontalTabs.find(t => t.id === activeTab);
      const tabLabel = currentTabObj?.label || '법원서식';
      const defaultName = `[${tabLabel}]_${masterData.debtor.name || '신청인'}_${masterData.court.caseNumber || '개인회생'}.pdf`;

      toast.info(`'${tabLabel}' A4 PDF를 생성 중입니다...`);
      await exportCourtPagesToPdf(printAreaRef.current, defaultName, {
        scale: 2,
      });
      toast.success(`'${defaultName}' PDF 다운로드가 완료되었습니다.`);
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('PDF 자동 생성 중 오류가 발생하여 인쇄 대화상자로 전환합니다.');
      setTimeout(() => window.print(), 300);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 법원 양식 다운로드 핸들러 — 법원 원본 양식(HWP)을 다운로드 (HWPX 시 자동 바인딩)
  const handleDownloadHwpx = async () => {
    // 현재 활성 탭에 해당하는 대법원 공식 전산양식 D-Code 매핑
    const tabToFormCode: Record<string, CourtFormType> = {
      'PETITION_COVER': 'D5100',
      'PETITION_BODY': 'D5100',
      'CREDITOR_LIST': 'D5106',
      'ASSET_LIST': 'D5101',
      'INCOME_EXPENSE': 'D5103',
      'MONTHLY_LEDGER': 'D5103',
      'STATEMENT': 'D5105',
      'REPAYMENT_PLAN': 'D5110',
      'REPAYMENT_SCHEDULE': 'D5110',
      'PROHIBITION_ORDER': 'D5114',
      'STAY_ORDER': 'D5113',
    };

    const formCode = tabToFormCode[activeTab];
    if (!formCode) {
      toast.info('이 서식은 법원 양식 다운로드를 지원하지 않습니다. PDF 인쇄를 이용해 주세요.');
      return;
    }

    const template = HWPX_TEMPLATE_CATALOG.find(t => t.formCode === formCode);
    if (!template) {
      toast.error('해당 양식의 법원 템플릿을 찾을 수 없습니다.');
      return;
    }

    const fieldData = mapMasterDataToHwpxFields(masterData, formCode);
    const ext = template.templatePath.split('.').pop() || 'hwp';
    const fileName = `[${formCode}]_${template.title}_${masterData.debtor.name}.${ext}`;
    await downloadFilledHwpx(template.templatePath, fieldData, fileName);
  };

  // 110~140p 첨부 직결 번들 머징 핸들러
  const handleGenerateBundle = async () => {
    try {
      setIsBundling(true);
      toast.info('고객 제출 증빙(부채증명서, 주민등초본, 과세증명 등)과 13종 본안 서식을 법원 공식 순서로 결합 중입니다...');
      const mergedPdfBytes = await exportCourtFilingCompleteBundle(masterData, crmExt);
      // 결합할 첨부 서류가 없으면 빈 PDF 가 만들어지므로 다운로드하지 않는다
      const { PDFDocument } = await import('pdf-lib');
      const pageCount = (await PDFDocument.load(mergedPdfBytes)).getPageCount();
      if (pageCount === 0) {
        toast.info('결합할 첨부 서류가 아직 없습니다. 서식은 [인쇄 미리보기]에서 PDF로 저장할 수 있습니다.', { duration: 6000 });
        return;
      }
      
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[전자소송완성본]_${masterData.debtor.name}_개인회생_첨부직결_${masterData.court.caseNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`묶음 PDF(${pageCount}쪽)를 다운로드했습니다.`);
    } catch (err: any) {
      toast.error(`번들 생성 중 오류 발생: ${err.message || '파일 처리 실패'}`);
    } finally {
      setIsBundling(false);
    }
  };

  return (
    <ModalPortal>
      {/* ── 인쇄 및 화면 미리보기 전용 CSS (대법원 표준 규격 A4 210mm 가로 고정) ── */}
      <style>{`
        /* ── 화면 미리보기 & 인쇄 공통: 대법원 A4 규격 (가로 210mm) 영구 고정 ── */
        .court-suite-canvas {
          font-family: 'Batang', 'BatangChe', '바탕', '바탕체', 'KoPub Batang', 'Noto Serif KR', 'AppleMyungjo', serif !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          box-sizing: border-box !important;
        }

        .court-page {
          font-family: 'Batang', 'BatangChe', '바탕', '바탕체', 'KoPub Batang', 'Noto Serif KR', 'AppleMyungjo', serif !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        @media screen {
          .court-page {
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25) !important;
          }

          /* ── 입력 칸 ↔ 서식 매핑 (화면 전용) ── */
          .cf-field {
            cursor: pointer;
            border-radius: 2px;
            transition: background-color 120ms ease, outline-color 120ms ease;
          }
          .cf-field:hover { background-color: rgba(37, 99, 235, 0.08); }
          /* 빈 값도 클릭·표시할 수 있도록 최소 폭 확보 (인쇄 시 해제) */
          .cf-field:empty {
            display: inline-block;
            min-width: 3.5em;
            min-height: 1em;
            vertical-align: middle;
          }
          .cf-field.cf-missing { outline: 1.5px dashed #dc2626; outline-offset: 1px; }
          .cf-field.cf-invalid { outline: 1.5px solid #f59e0b; outline-offset: 1px; }
          .cf-field.cf-active {
            outline: 2px solid #2563eb;
            outline-offset: 1px;
            background-color: rgba(37, 99, 235, 0.14);
          }

          /* 사이드바 입력 칸 상태 */
          .cf-input-missing { border-color: rgba(245, 158, 11, 0.7) !important; }
          .cf-input-invalid { border-color: rgba(244, 63, 94, 0.8) !important; }
          @keyframes cf-flash {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.9); }
            100% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
          }
          .cf-input-flash {
            animation: cf-flash 0.6s ease-out 2;
            border-color: #3b82f6 !important;
          }
          /* PDF 캡처 중 화면 전용 아웃라인/배경색 완전 은닉 */
          .cf-pdf-capturing .cf-field,
          .cf-pdf-capturing .cf-field.cf-active,
          .cf-pdf-capturing .cf-field.cf-missing,
          .cf-pdf-capturing .cf-field.cf-invalid {
            outline: none !important;
            background: transparent !important;
            cursor: auto !important;
          }
          .cf-pdf-capturing .cf-field:empty { display: inline !important; min-width: 0 !important; }
        }

        @media print {
          .cf-field, .cf-field.cf-active, .cf-field.cf-missing, .cf-field.cf-invalid {
            outline: none !important;
            background: transparent !important;
            cursor: auto !important;
          }
          .cf-field:empty { display: inline !important; min-width: 0 !important; }
        }

        @media print {
          /* 1. 배경 웹 CRM 앱 및 Sonner 토스트 알림 완벽 차단 */
          #root,
          [data-sonner-toaster],
          .no-print {
            display: none !important;
          }

          /* 2. 브라우저 인쇄 기본 여백 0 초기화 (법원 서식 A4 내부 여백과 이중 중첩 방지) */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* 3. 모달 컨테이너 풀스크린 fixed/overflow 해제하여 일반 A4 문서 흐름으로 전환 */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .court-suite-modal-container {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            inset: auto !important;
            z-index: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 4. 최상단 헤더, 서식 탭 네비게이션, 우측 정보입력 편집창(사이드바) 완벽 은닉 */
          .court-suite-header,
          .court-suite-tabs,
          .court-suite-sidebar,
          header,
          nav,
          aside {
            display: none !important;
          }

          /* 5. 메인 바디 래퍼: flex 및 overflow 클리핑 해제하여 다중 페이지 자연 출력 */
          .court-suite-body-wrapper {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .court-suite-main {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 6. A4 캔버스: 화면 줌(scale) 해제 및 100% 실규격 A4 출력 */
          .court-suite-canvas {
            font-family: 'Batang', 'BatangChe', '바탕', '바탕체', 'KoPub Batang', 'Noto Serif KR', 'AppleMyungjo', serif !important;
            transform: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            outline: none !important;
          }

          /* 7. 법원 전산 서식 페이지 스타일 보존 및 페이지 브레이크 최적화 */
          .court-page {
            font-family: 'Batang', 'BatangChe', '바탕', '바탕체', 'KoPub Batang', 'Noto Serif KR', 'AppleMyungjo', serif !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* 마지막 페이지 뒤 불필요한 공백 페이지 생성 방지 */
          .court-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* 타이핑 커서/선택 테두리 제거 */
          [contenteditable] {
            outline: none !important;
            user-select: none !important;
          }
        }
      `}</style>

      <div className="court-suite-modal-container fixed inset-0 z-[9999] flex flex-col bg-slate-900/95 backdrop-blur-md text-slate-100 animate-in fade-in duration-200 print:static print:bg-white print:text-black print:overflow-visible print:h-auto print:p-0 print:m-0">
      {/* ── 1. 최상단 헤더 네비게이션 ── */}
      <header className="court-suite-header flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800 shadow-md shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-white">
                대법원 전자소송 개인회생 서식 에디터
              </h1>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>사건: <strong className="text-slate-200">{masterData.court.caseNumber}</strong></span>
              <span>•</span>
              <span>신청인: <strong className="text-slate-200">{masterData.debtor.name}</strong></span>
              <span>•</span>
              <span>관할: <strong className="text-indigo-300">{masterData.court.courtName}</strong></span>
              <span>•</span>
              <span>대리인: <strong className="text-slate-200">{masterData.lawyer.firmName} {masterData.lawyer.lawyerName}</strong></span>
            </div>
          </div>
        </div>

        {/* 상단 우측 액션 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 법정 인가요건 충족 배지 */}
          {masterData.repaymentSummary.meetsStatutoryMinimum ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>제614조 적합</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950 border border-red-700 text-red-300 rounded-lg text-xs font-semibold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>최저변제액 미달</span>
            </div>
          )}

          {/* 사이드바 토글 버튼 */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showSidebar 
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                : 'bg-blue-600/30 border-blue-500 text-blue-300 hover:bg-blue-600/40'
            }`}
            title={showSidebar ? '우측 입력 패널 접기' : '우측 입력 패널 펼치기'}
          >
            {showSidebar ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span>{showSidebar ? '패널 접기' : '입력 패널 열기'}</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Save className="w-3.5 h-3.5 text-slate-300" />
            <span>저장</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>인쇄 미리보기</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white shadow-sm transition"
            title="현재 서식을 고해상도 A4 규격 PDF 파일로 즉시 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'PDF 생성 중...' : '단일 PDF'}</span>
          </button>

          <button
            onClick={handleDownloadHwpx}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold text-white shadow-sm transition whitespace-nowrap"
            title="법원 공식 HWPX 양식에 CRM 데이터를 자동 주입하여 다운로드 — ecfs.scourt.go.kr에 그대로 업로드 가능"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>HWPX 법원양식</span>
          </button>

          <button
            onClick={handleGenerateBundle}
            disabled={isBundling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white shadow-sm transition"
            title="고객이 보낸 부채증명서, 등초본, 과세증명을 법원 공식 순서로 결합한 전자소송 완성본(110~140p) 출력"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>{isBundling ? '번들 병합 중...' : '110~140p 완성본 번들'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg ml-1 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── 2. 가로 서식 탭 네비게이션 바 ── */}
      <div className="court-suite-tabs bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between shrink-0 overflow-x-auto print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {horizontalTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {(() => {
                  const c = issueSummary.countByTab[tab.id as CourtDocTabKey];
                  if (!c || (c.missing + c.invalid) === 0) return null;
                  const total = c.missing + c.invalid;
                  return (
                    <span
                      className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-lg text-[11px] font-bold ${
                        c.invalid > 0 ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50' : 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      }`}
                      title={`미입력 ${c.missing}건 · 형식 확인 ${c.invalid}건`}
                    >
                      {total}
                    </span>
                  );
                })()}
                {tab.badge && (
                  <span className={`text-xs px-1 py-0.1 rounded font-mono ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 뷰어 제어 툴바 (글꼴, 글자크기, 줌) */}
        <div className="flex items-center gap-3 text-xs pl-4 border-l border-slate-800 shrink-0">
          <button
            type="button"
            onClick={goToNextIssue}
            className={`press-scale flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap transition ${
              issueSummary.issues.length > 0
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 hover:bg-amber-500/25'
                : 'bg-emerald-500/10 border-emerald-600/50 text-emerald-300'
            }`}
            title="다음 미입력 항목으로 이동 (F2)"
          >
            {issueSummary.issues.length > 0 ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{issueSummary.issues.length > 0 ? `확인 필요 ${issueSummary.issues.length}건 → 다음` : '필수 항목 입력 완료'}</span>
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              checked={isEditMode} 
              onChange={(e) => setIsEditMode(e.target.checked)}
              className="rounded border-slate-700 text-blue-600"
            />
            <span className={isEditMode ? 'text-blue-300 font-semibold text-xs' : 'text-slate-400 text-xs'}>
              ✏️ 캔버스 직접타이핑
            </span>
          </label>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 border border-slate-700/80 rounded-lg text-xs text-amber-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>대법원 표준 바탕체 고정</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 5))}
              className="p-1 hover:bg-slate-800 rounded"
              title="축소"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-xs w-9 text-center">{zoomLevel}%</span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(140, prev + 5))}
              className="p-1 hover:bg-slate-800 rounded"
              title="확대"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 메인 바디 (좌측 A4 캔버스 + 우측 입력 사이드바) ── */}
      <div className="court-suite-body-wrapper flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
        {/* 좌측 메인 영역: 실시간 A4 법원 전산 서식 렌더링 캔버스 */}
        <main className="court-suite-main flex-1 bg-slate-900/90 overflow-auto p-6 flex justify-center custom-scrollbar print:block print:overflow-visible print:bg-white print:p-0 print:m-0 print:h-auto print:w-full">
          <div 
            ref={printAreaRef}
            onClick={handleCanvasClick}
            contentEditable={isEditMode}
            suppressContentEditableWarning
            style={{ 
              transform: `scale(${zoomLevel / 100})`, 
              transformOrigin: 'top center',
              fontFamily: "'Batang', 'BatangChe', '바탕', '바탕체', 'KoPub Batang', 'Noto Serif KR', 'AppleMyungjo', serif"
            }}
            className={`court-suite-canvas w-[210mm] min-w-[210mm] max-w-[210mm] shrink-0 transition-transform duration-100 font-serif ${fontSize} outline-none print:transform-none`}
          >
            {/* 1. 표지 (법원 원본 표지) */}
            {activeTab === 'PETITION_COVER' && (
              <PetitionCoverPage data={masterData} isEditable={isEditMode} />
            )}

            {/* 2. 신청서 본문 (법원 원본 D5100) */}
            {activeTab === 'PETITION_BODY' && (
              <PetitionFormD5100 data={masterData} isEditable={isEditMode} />
            )}

            {/* 3. 진술서 (법원 원본 D5105) */}
            {activeTab === 'STATEMENT' && (
              <WrittenStatementFormD5105 data={masterData} isEditable={isEditMode} />
            )}

            {/* 4. 채권자 목록 (법원 원본 D5106) */}
            {activeTab === 'CREDITOR_LIST' && (
              <CreditorListFormD5106 data={masterData} isEditable={isEditMode} />
            )}

            {/* 5. 부속서류 (채권자목록 부속) */}
            {activeTab === 'ANNEX_DOCS' && (
              <CreditorListFormD5106 data={masterData} isEditable={isEditMode} />
            )}

            {/* 6. 재산 목록 (법원 원본 D5101) */}
            {activeTab === 'ASSET_LIST' && (
              <AssetInventoryFormD5101 data={masterData} isEditable={isEditMode} />
            )}

            {/* 7. 수입 및 지출 (법원 원본 D5103) */}
            {activeTab === 'INCOME_EXPENSE' && (
              <IncomeExpenseFormD5103 data={masterData} isEditable={isEditMode} />
            )}

            {/* 8. 변제계획안 (법원 원본 D5110) */}
            {activeTab === 'REPAYMENT_PLAN' && (
              <RepaymentPlanFormD5110 data={masterData} isEditable={isEditMode} />
            )}

            {/* 9. 변제예정액표 (채권자별 분배표) */}
            {activeTab === 'REPAYMENT_SCHEDULE' && (
              <RepaymentScheduleTable data={masterData} isEditable={isEditMode} />
            )}

            {/* 10. 위임장 (법원 표준 양식) */}
            {activeTab === 'POWER_OF_ATTORNEY' && (
              <PowerOfAttorneyForm data={masterData} isEditable={isEditMode} />
            )}

            {/* 11. 송달 신고서 (법원 표준 양식) */}
            {activeTab === 'SERVICE_REPORT' && (
              <ServiceReportForm data={masterData} isEditable={isEditMode} />
            )}

            {/* 12. 자료 제출 (법원 표준 양식) */}
            {activeTab === 'EVIDENCE_LIST' && (
              <EvidenceListForm data={masterData} isEditable={isEditMode} />
            )}

            {/* 13. 금지명령신청서 (D5114 법원 원본 1:1) */}
            {activeTab === 'PROHIBITION_ORDER' && (
              <ProhibitionOrderFormD5114 data={masterData} isEditable={isEditMode} />
            )}

            {/* 14. 중지명령신청서 (D5113 법원 원본 1:1) */}
            {activeTab === 'STAY_ORDER' && (
              <StayOrderFormD5113 data={masterData} isEditable={isEditMode} />
            )}

            {/* 15. 전체 일괄 뷰 — 법원 양식 순서대로 */}
            {activeTab === 'ALL' && (
              <div className="space-y-8 print:space-y-0">
                <PetitionCoverPage data={masterData} isEditable={isEditMode} />
                <PetitionFormD5100 data={masterData} isEditable={isEditMode} />
                <WrittenStatementFormD5105 data={masterData} isEditable={isEditMode} />
                <CreditorListFormD5106 data={masterData} isEditable={isEditMode} />
                <AssetInventoryFormD5101 data={masterData} isEditable={isEditMode} />
                <IncomeExpenseFormD5103 data={masterData} isEditable={isEditMode} />
                <RepaymentPlanFormD5110 data={masterData} isEditable={isEditMode} />
                <RepaymentScheduleTable data={masterData} isEditable={isEditMode} />
                <PowerOfAttorneyForm data={masterData} isEditable={isEditMode} />
                <ProhibitionOrderFormD5114 data={masterData} isEditable={isEditMode} />
                <StayOrderFormD5113 data={masterData} isEditable={isEditMode} />
                <EvidenceListForm data={masterData} isEditable={isEditMode} />
              </div>
            )}
          </div>
        </main>

        {/* 우측 아코디언 입력 폼 */}
        {showSidebar && (
          <div className="court-suite-sidebar h-full shrink-0 print:hidden">
            <CourtFilingInputSidebar
              ref={sidebarRef}
              data={masterData}
              onChangeData={setMasterData}
              activeDocTab={activeTab}
              onSelectDocTab={(tabId) => setActiveTab(tabId as DocTabId)}
              issueSummary={issueSummary}
              onActiveFieldChange={handleSidebarFieldFocus}
            />
          </div>
        )}
      </div>
    </div>
  </ModalPortal>
  );
}

/** 닫힌 상태에서는 내부 훅을 실행하지 않도록 바깥에서 먼저 분기 (Rules of Hooks: 조건부 return을 훅보다 앞에 두지 않음) */
export default function CourtDocSuiteViewerModal(props: React.ComponentProps<typeof CourtDocSuiteViewerModalInner>) {
  if (!props.isOpen) return null;
  return <CourtDocSuiteViewerModalInner {...props} />;
}
