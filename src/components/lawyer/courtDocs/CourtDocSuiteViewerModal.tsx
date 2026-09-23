/**
 * CourtDocSuiteViewerModal.tsx
 * 대법원 전자소송 개인회생 13종 표준 서식 통합 웹 위지윅(WYSIWYG) 에디터 & 인쇄/PDF 뷰어 모달
 * - 로패스(LawPass 2025) Split-Screen 실시간 양방향 반응형 인터페이스 (Live-Binding Dual Screen)
 * - 상단 12개 가로형 서식 탭 ([표지] ~ [자료 제출] + [전체 일괄])
 * - 좌측 62%: A4 실시간 캔버스 (대법원 바탕체 표준 규격)
 * - 우측 38%: LawPassCourtFilingSidebar (스마트 아코디언 입력 폼 & 5대 특약 원클릭 삽입기)
 * - 4대 관할법원(전국공통, 강릉지원, 대전지법, 청주지법) 자료제출목록 동적 전환 및 HWP 원본 다운로드
 * - 110~140p 첨부 직결(Interleaved) 완성본 번들 PDF 머징 연동
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Printer, Download, Save, Edit3, CheckCircle2, 
  AlertTriangle, FileText, Layers, RefreshCw, ZoomIn, 
  ZoomOut, ShieldCheck, Scale, Sparkles, FolderArchive,
  PanelRightClose, PanelRightOpen, ArrowRight, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  buildCourtFilingMasterData, 
  type CourtFilingMasterData 
} from '../../../services/documents/courtFilingEngine';
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
import LawPassCourtFilingSidebar from './LawPassCourtFilingSidebar';
import { exportCourtFilingCompleteBundle } from '../../../services/documents/courtFilingBundleService';
import { downloadFilledHwpx, HWPX_TEMPLATE_CATALOG } from '../../../services/court/hwpxTemplateEngine';
import { mapMasterDataToHwpxFields, type CourtFormType } from '../../../services/court/hwpxFieldMapper';

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

export default function CourtDocSuiteViewerModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '변호사 정충원',
  initialTab,
  initialFormCode,
  onUpdateCrmExt
}: CourtDocSuiteViewerModalProps) {
  if (!isOpen) return null;

  const resolveInitialTab = (): DocTabId => {
    if (initialTab) return initialTab;
    if (initialFormCode) return formCodeToDocTabId(initialFormCode);
    return 'PETITION_BODY';
  };

  // 데이터 바인딩
  const [masterData, setMasterData] = useState<CourtFilingMasterData>(() => {
    return buildCourtFilingMasterData(clientRequest, crmExt, activeLawyerName);
  });

  const [activeTab, setActiveTab] = useState<DocTabId>(resolveInitialTab);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [selectedFont, setSelectedFont] = useState<'font-serif' | 'font-sans'>('font-serif');
  const [fontSize, setFontSize] = useState<string>('text-[12px]');
  const [zoomLevel, setZoomLevel] = useState<number>(95);
  const [isBundling, setIsBundling] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // initialTab 또는 initialFormCode 변경 시 동기화
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (initialFormCode) {
      setActiveTab(formCodeToDocTabId(initialFormCode));
    }
  }, [initialTab, initialFormCode, isOpen]);

  // 로패스(LawPass 2025) 표준 12개 가로 탭 목록
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
    { id: 'ALL', label: '전체문서 (35p)', badge: '통합' }
  ];

  // 수정사항 저장 핸들러
  const handleSave = async () => {
    try {
      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          courtCase: {
            courtName: masterData.court.courtName,
            caseNumber: masterData.court.caseNumber,
            applicantName: masterData.debtor.name,
            serviceRecipient: masterData.debtor.serviceRecipient,
            serviceAddress: masterData.debtor.serviceAddress,
            refundBank: masterData.debtor.refundBank,
            refundAccount: masterData.debtor.refundAccount,
            refundDepositor: masterData.debtor.refundDepositor,
          },
          repaymentPlan: {
            ...(crmExt?.repaymentPlan || {}),
            creditors: masterData.creditors,
            monthlyIncome: masterData.repaymentSummary.monthlyIncome,
            livingCost: masterData.repaymentSummary.monthlyLivingCost,
            monthlyAvailableIncome: masterData.repaymentSummary.monthlyRepaymentAmount,
            repaymentMonths: masterData.repaymentSummary.repaymentPeriodMonths,
            totalPrincipal: masterData.repaymentSummary.totalPrincipal,
            totalRepaymentAmount: masterData.repaymentSummary.totalRepaymentAmount,
            repaymentRatio: masterData.repaymentSummary.repaymentRatio,
            clearingValue: masterData.repaymentSummary.clearingValue,
          }
        });
      }
      toast.success('로패스형 위지윅 입력 데이터가 사건 및 CRM 데이터베이스에 안전하게 저장되었습니다.');
    } catch (err: any) {
      toast.error(`저장 중 오류: ${err.message || '저장 실패'}`);
    }
  };

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // PDF 다운로드 핸들러
  const handleDownloadPdf = () => {
    toast.info('인쇄 대화상자에서 "PDF로 저장"을 선택하면 대법원 전자소송 제출용 텍스트 PDF가 생성됩니다.', { duration: 5000 });
    setTimeout(() => {
      window.print();
    }, 500);
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
      
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[전자소송완성본]_${masterData.debtor.name}_개인회생_첨부직결_${masterData.court.caseNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('110~140p 분량의 법원 전자소송 완성본 번들 PDF가 성공적으로 생성 및 다운로드되었습니다!');
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
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          box-sizing: border-box !important;
        }

        .court-page {
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

          /* 4. 최상단 헤더, 서식 탭 네비게이션, 우측 LawPass 2025 정보입력 편집창(사이드바) 완벽 은닉 */
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
              <span className="text-[10px] bg-blue-900/80 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded font-mono font-semibold">
                로패스 2025 규격
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                전산양식 A5433
              </span>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>단일 PDF</span>
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

      {/* ── 2. 로패스형 가로 서식 탭 네비게이션 바 ── */}
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
                {tab.badge && (
                  <span className={`text-[9px] px-1 py-0.1 rounded font-mono ${
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
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              checked={isEditMode} 
              onChange={(e) => setIsEditMode(e.target.checked)}
              className="rounded border-slate-700 text-blue-600"
            />
            <span className={isEditMode ? 'text-blue-300 font-semibold text-[11px]' : 'text-slate-400 text-[11px]'}>
              ✏️ 캔버스 직접타이핑
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-[11px]"
            >
              <option value="font-serif">바탕체 (법원표준)</option>
              <option value="font-sans">고딕체</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 5))}
              className="p-1 hover:bg-slate-800 rounded"
              title="축소"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] w-9 text-center">{zoomLevel}%</span>
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

      {/* ── 3. 메인 바디 (좌측 A4 캔버스 + 우측 로패스형 스마트 사이드바) ── */}
      <div className="court-suite-body-wrapper flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
        {/* 좌측 메인 영역: 실시간 A4 법원 전산 서식 렌더링 캔버스 */}
        <main className="court-suite-main flex-1 bg-slate-900/90 overflow-auto p-6 flex justify-center custom-scrollbar print:block print:overflow-visible print:bg-white print:p-0 print:m-0 print:h-auto print:w-full">
          <div 
            ref={printAreaRef}
            contentEditable={isEditMode}
            suppressContentEditableWarning
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className={`court-suite-canvas w-[210mm] min-w-[210mm] max-w-[210mm] shrink-0 transition-transform duration-100 ${selectedFont} ${fontSize} outline-none print:transform-none`}
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

        {/* 우측 스마트 아코디언 입력 폼 (로패스 2025 규격 사이드바) */}
        {showSidebar && (
          <div className="court-suite-sidebar h-full shrink-0 print:hidden">
            <LawPassCourtFilingSidebar
              data={masterData}
              onChangeData={setMasterData}
              activeDocTab={activeTab}
              onSelectDocTab={(tabId) => setActiveTab(tabId as DocTabId)}
            />
          </div>
        )}
      </div>
    </div>
  </ModalPortal>
  );
}
