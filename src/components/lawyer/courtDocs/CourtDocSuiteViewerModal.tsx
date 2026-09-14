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
    { id: 'SERVICE_REPORT', label: '송달 신고서' },
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
    toast.info('대법원 전자소송 제출 규격(A4 300DPI)의 PDF 인쇄 모듈을 실행합니다.');
    setTimeout(() => {
      window.print();
    }, 500);
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
      <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900/95 backdrop-blur-md text-slate-100 animate-in fade-in duration-200">
      {/* ── 1. 최상단 헤더 네비게이션 ── */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800 shadow-md shrink-0">
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
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between shrink-0 overflow-x-auto">
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
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 메인 영역: 실시간 A4 법원 전산 서식 렌더링 캔버스 */}
        <main className="flex-1 bg-slate-900/90 overflow-y-auto p-6 flex justify-center custom-scrollbar">
          <div 
            ref={printAreaRef}
            contentEditable={isEditMode}
            suppressContentEditableWarning
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className={`transition-transform duration-100 ${selectedFont} ${fontSize} outline-none`}
          >
            {/* 1. 표지 */}
            {activeTab === 'PETITION_COVER' && (
              <div className="space-y-6">
                <SummaryAndUrgentNoticeDoc data={masterData} isEditable={isEditMode} />
                <PetitionCoverDoc data={masterData} isEditable={isEditMode} />
              </div>
            )}

            {/* 2. 신청서 본문 */}
            {activeTab === 'PETITION_BODY' && (
              <PetitionBodyDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 3. 진술서 */}
            {activeTab === 'STATEMENT' && (
              <WrittenStatementDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 4. 채권자 목록 */}
            {activeTab === 'CREDITOR_LIST' && (
              <CreditorListDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 5. 부속서류 (별제권/다툼/전부명령 등) */}
            {activeTab === 'ANNEX_DOCS' && (
              <div className="space-y-6">
                <CreditorListDoc data={masterData} isEditable={isEditMode} />
              </div>
            )}

            {/* 6. 재산 목록 */}
            {activeTab === 'ASSET_LIST' && (
              <AssetInventoryDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 7. 수입 및 지출 */}
            {activeTab === 'INCOME_EXPENSE' && (
              <div className="space-y-6">
                <IncomeExpenseDoc data={masterData} isEditable={isEditMode} />
                <MonthlyIncomeLedgerDoc data={masterData} isEditable={isEditMode} />
              </div>
            )}

            {/* 8. 변제계획안 (대법원 전산양식 A5433) */}
            {activeTab === 'REPAYMENT_PLAN' && (
              <RepaymentPlanStandardDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 9. 변제예정액표 */}
            {activeTab === 'REPAYMENT_SCHEDULE' && (
              <div className="space-y-6">
                <SummaryAndUrgentNoticeDoc data={masterData} isEditable={isEditMode} />
                <RepaymentPlanStandardDoc data={masterData} isEditable={isEditMode} />
              </div>
            )}

            {/* 10. 위임장 */}
            {activeTab === 'POWER_OF_ATTORNEY' && (
              <PowerOfAttorneyAndPledgeDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 11. 송달 신고서 */}
            {activeTab === 'SERVICE_REPORT' && (
              <div className="court-page bg-white p-12 max-w-[210mm] mx-auto text-black font-serif text-[12px] leading-relaxed border border-slate-200 shadow-sm space-y-6">
                <div className="text-center border-b border-black pb-2">
                  <h2 className="text-2xl font-bold tracking-widest">송달장소 및 송달영수인 신고서</h2>
                </div>
                <div className="border border-black p-3 space-y-2 text-[12px]">
                  <div>사 건 : {masterData.court.caseNumber} 호 개인회생</div>
                  <div>신청인(채무자) : {masterData.debtor.name} ({masterData.debtor.residentNumber})</div>
                </div>
                <p className="indent-4 text-[12px]">
                  위 사건에 관하여 신청인은 민사소송법 제184조에 따라 다음과 같이 송달장소 및 송달영수인을 신고합니다.
                </p>
                <div className="border border-black p-4 space-y-2 bg-slate-50 text-[12px]">
                  <div><strong>1. 송달장소</strong> : {masterData.debtor.serviceAddress}</div>
                  <div><strong>2. 송달영수인</strong> : {masterData.debtor.serviceRecipient}</div>
                  <div><strong>3. 연락처</strong> : {masterData.debtor.phone}</div>
                </div>
                <div className="text-center pt-8">
                  <p>{masterData.court.applicationDate}</p>
                  <p className="mt-2 font-semibold">신청인 {masterData.debtor.name} (서명 또는 날인)</p>
                  <p className="text-center font-bold text-base mt-6">{masterData.court.courtName} 귀중</p>
                </div>
              </div>
            )}

            {/* 12. 자료 제출 (법원별 제출목록) */}
            {activeTab === 'EVIDENCE_LIST' && (
              <EvidenceSubmissionListDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 13. 금지명령신청서 */}
            {activeTab === 'PROHIBITION_ORDER' && (
              <ProhibitionOrderDoc data={masterData} isEditable={isEditMode} />
            )}

            {/* 14. 중지명령신청서 (사건별 분할) */}
            {activeTab === 'STAY_ORDER' && (
              <div className="space-y-8">
                {masterData.stayCases.map((c, idx) => (
                  <StayOrderDoc key={c.id} data={masterData} caseItem={c} caseIndex={idx} isEditable={isEditMode} />
                ))}
              </div>
            )}

            {/* 15. 전체 일괄 뷰 (35p 전체 시퀀스) */}
            {activeTab === 'ALL' && (
              <div className="space-y-8 print:space-y-0">
                <SummaryAndUrgentNoticeDoc data={masterData} isEditable={isEditMode} />
                <PetitionCoverDoc data={masterData} isEditable={isEditMode} />
                <PetitionBodyDoc data={masterData} isEditable={isEditMode} />
                <CreditorListDoc data={masterData} isEditable={isEditMode} />
                <AssetInventoryDoc data={masterData} isEditable={isEditMode} />
                <IncomeExpenseDoc data={masterData} isEditable={isEditMode} />
                <MonthlyIncomeLedgerDoc data={masterData} isEditable={isEditMode} />
                <WrittenStatementDoc data={masterData} isEditable={isEditMode} />
                <RepaymentPlanStandardDoc data={masterData} isEditable={isEditMode} />
                <ProhibitionOrderDoc data={masterData} isEditable={isEditMode} />
                {masterData.stayCases.map((c, idx) => (
                  <StayOrderDoc key={c.id} data={masterData} caseItem={c} caseIndex={idx} isEditable={isEditMode} />
                ))}
                <EvidenceSubmissionListDoc data={masterData} isEditable={isEditMode} />
                <PowerOfAttorneyAndPledgeDoc data={masterData} isEditable={isEditMode} />
              </div>
            )}
          </div>
        </main>

        {/* 우측 스마트 아코디언 입력 폼 (로패스 2025 규격 사이드바) */}
        {showSidebar && (
          <LawPassCourtFilingSidebar
            data={masterData}
            onChangeData={setMasterData}
            activeDocTab={activeTab}
            onSelectDocTab={(tabId) => setActiveTab(tabId as DocTabId)}
          />
        )}
      </div>
    </div>
  </ModalPortal>
  );
}
