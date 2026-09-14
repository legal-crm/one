// src/components/lawyer/filing/CourtFormPreviewModal.tsx
// ============================================================
// [대법원 8대 전산서식] 통합 고해상도 A4 미리보기 & 인쇄 & 즉시편집 연동 모달
// - R01: 개인회생 개시신청서 (표지 + 본문 1쪽 + 본문 2쪽)
// - R02: 채권자목록 (총괄표 + 부속명세서)
// - R06: 재산목록 (D5102)
// - R08: 수입 및 지출에 관한 목록 (D5103)
// - R10: 진술서 (학력/경력 및 채무증대경위서)
// - R04: 변제계획안 및 변제예정표 (D5110)
// - R03: 소송위임장 및 경유확인서
// - R07: 첨부서류 일체 (4대 발급처 체크리스트)
// ============================================================

import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Edit3, ZoomIn, ZoomOut, RotateCcw, 
  FileText, CheckCircle2, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  buildCourtCoverHtml,
  buildCourtApplicationBody1Html,
  buildCourtApplicationBody2Html,
  buildCourtCreditorListHtml,
  buildCourtPropertyListHtml,
  buildCourtIncomeExpenseHtml,
  buildCourtStatementHtml,
  buildCourtRepaymentPlanHtml,
  buildCourtPowerOfAttorneyHtml,
  buildCourtRequiredDocumentChecklistHtml,
  type CourtFormDataContext
} from '../../../services/court/CourtFormHtmlBuilder';

interface CourtFormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormCode?: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
  onOpenEditModal: (formCode: string) => void;
}

interface FormTabMeta {
  code: string;
  name: string;
  shortName: string;
  badge: string;
}

const FORM_TABS: FormTabMeta[] = [
  { code: 'R01', name: '개인회생절차 개시신청서 본안 (D5101)', shortName: 'R01 개시신청서', badge: '필수 기본서식' },
  { code: 'R02', name: '개인회생 채권자목록 및 총괄표', shortName: 'R02 채권자목록', badge: 'CSV/PDF' },
  { code: 'R06', name: '재산목록 (D5102 청산가치)', shortName: 'R06 재산목록', badge: 'D5102' },
  { code: 'R08', name: '수입 및 지출에 관한 목록 (D5103)', shortName: 'R08 수입지출', badge: 'D5103' },
  { code: 'R10', name: '진술서 (채무 증대 경위서)', shortName: 'R10 진술서', badge: '사유서술' },
  { code: 'R04', name: '변제계획안 및 변제예정표 (D5110)', shortName: 'R04 변제계획안', badge: 'D5110' },
  { code: 'R03', name: '소송위임장 및 경유확인서', shortName: 'R03 소송위임장', badge: '대리권' },
  { code: 'R07', name: '첨부서류 일체 (4대 발급처 증빙)', shortName: 'R07 첨부서류', badge: '체크리스트' },
];

export default function CourtFormPreviewModal({
  isOpen,
  onClose,
  initialFormCode = 'R01',
  clientRequest,
  crmExt,
  activeLawyerName = '정충원',
  onOpenEditModal
}: CourtFormPreviewModalProps) {
  if (!isOpen) return null;

  const [activeCode, setActiveCode] = useState<string>(initialFormCode);
  const [zoomLevel, setZoomLevel] = useState<number>(0.9); // 기본 배율 90%

  // HTML 빌더용 컨텍스트 구성
  const ctx: CourtFormDataContext = useMemo(() => {
    return {
      clientRequest,
      crmExt,
      creditors: crmExt.repaymentPlan?.creditors || [],
      lawyerName: crmExt.petitionInfo?.lawyerName || activeLawyerName,
      firmName: crmExt.petitionInfo?.firmName || '법률사무소 보광',
      courtName: crmExt.petitionInfo?.courtName || crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원',
    };
  }, [clientRequest, crmExt, activeLawyerName]);

  // 선택된 서식의 결합 HTML 생성
  const renderedHtml = useMemo(() => {
    try {
      switch (activeCode) {
        case 'R01':
          return (
            buildCourtCoverHtml(ctx) +
            buildCourtApplicationBody1Html(ctx) +
            buildCourtApplicationBody2Html(ctx)
          );
        case 'R02':
          return buildCourtCreditorListHtml(ctx);
        case 'R06':
          return buildCourtPropertyListHtml(ctx);
        case 'R08':
          return buildCourtIncomeExpenseHtml(ctx);
        case 'R10':
          return buildCourtStatementHtml(ctx);
        case 'R04':
          return buildCourtRepaymentPlanHtml(ctx);
        case 'R03':
          return buildCourtPowerOfAttorneyHtml(ctx);
        case 'R07':
          return buildCourtRequiredDocumentChecklistHtml(ctx);
        default:
          return '<div style="padding: 40px; text-align: center;">서식 정보를 찾을 수 없습니다.</div>';
      }
    } catch (err) {
      console.error('Error building court form HTML:', err);
      return `<div style="padding: 40px; color: red; text-align: center;">서식 렌더링 중 오류가 발생했습니다: ${String(err)}</div>`;
    }
  }, [activeCode, ctx]);

  const activeTabMeta = FORM_TABS.find(t => t.code === activeCode) || FORM_TABS[0];

  // 인쇄 실행
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업 차단이 설정되어 있어 인쇄 창을 열 수 없습니다.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeTabMeta.name} - ${clientRequest.clientName || '신청인'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // 줌 조절
  const handleZoomIn = () => setZoomLevel(prev => Math.min(1.2, +(prev + 0.1).toFixed(1)));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.6, +(prev - 0.1).toFixed(1)));
  const handleZoomReset = () => setZoomLevel(0.9);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-slate-900 w-full max-w-6xl h-[92vh] max-h-[calc(100vh-2.5rem)] rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col animate-fadeIn">
        {/* 모달 상단 툴바 */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
                  {activeTabMeta.code}
                </span>
                <h3 className="font-extrabold text-sm text-white truncate">
                  {activeTabMeta.name}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                신청인: {clientRequest.clientName || '신청인'} · 관할: {ctx.courtName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 줌 컨트롤 */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-slate-300 text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="축소"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="px-2 py-0.5 hover:bg-slate-700 rounded-lg font-mono font-bold cursor-pointer"
                title="기본 배율(90%) 복원"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="확대"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 즉시 편집 버튼 */}
            <button
              type="button"
              onClick={() => {
                onOpenEditModal(activeCode);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>이 서식 수정·편집</span>
            </button>

            {/* 인쇄 버튼 */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>A4 인쇄</span>
            </button>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 8대 서식 상단 탭 셀렉터 */}
        <div className="bg-slate-900 border-b border-slate-800 px-3 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-thin">
          {FORM_TABS.map(tab => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveCode(tab.code)}
              className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCode === tab.code
                  ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                {tab.code}
              </span>
              <span>{tab.shortName.replace(/^[A-Z0-9]+\s*/, '')}</span>
            </button>
          ))}
        </div>

        {/* 메인 뷰어 영역 (A4 문서 렌더링) */}
        <div className="flex-1 overflow-y-auto bg-slate-950/80 p-4 sm:p-8 flex justify-center items-start">
          <div 
            style={{ 
              transform: `scale(${zoomLevel})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="shadow-2xl rounded-sm bg-white overflow-hidden"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
