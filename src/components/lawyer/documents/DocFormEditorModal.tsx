import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import A4PagedSheets from './A4PagedSheets';
import { 
  X, Printer, Download, Sparkles, Send, FileText, CheckCircle2, 
  RotateCcw, Scale, Copy, ExternalLink, ShieldCheck, Eye, Edit3, ArrowRight,
  ChevronLeft, ChevronRight, Layers, BookOpen, ZoomIn, ZoomOut
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  type LegalDocItem, 
  getDocumentPrecedent 
} from '../../../services/documents/legalDocRegistry';
import { 
  bindDocumentVariables, 
  bindHwpxTemplateHtml,
  generateAiLegalDraftPrompt, 
  type BoundDocumentData 
} from '../../../services/documents/documentTemplateEngine';
import { ClientMobileDocService } from '../../../services/documents/clientMobileDocService';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import ModalPortal from '../../common/ModalPortal';

interface CourtFormEntry {
  id: string;
  name: string;
  dCode: string | null;
  category: string;
  fileName: string;
  html: string;
}

interface DocFormEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  docItem: LegalDocItem;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyerName?: string;
  onAttachToFilingPackage?: (docName: string, textContent: string) => void;
  onOpenMobileFillModal?: (token: string) => void;
}

function DocFormEditorModalInner({
  isOpen,
  onClose,
  docItem,
  clientRequest,
  crmExt,
  activeLawyerName = '',
  onAttachToFilingPackage,
  onOpenMobileFillModal
}: DocFormEditorModalProps) {

  const [boundData, setBoundData] = useState<BoundDocumentData>(() => {
    return bindDocumentVariables(docItem, clientRequest, crmExt, activeLawyerName);
  });

  const [purposeInput, setPurposeInput] = useState(boundData.purpose);
  const [reasonInput, setReasonInput] = useState(boundData.reason);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showPrecedentModal, setShowPrecedentModal] = useState(false);

  // docItem이나 의뢰인 정보 변경 시 boundData, 취지, 이유 동기화
  useEffect(() => {
    if (!isOpen) return;
    const fresh = bindDocumentVariables(docItem, clientRequest, crmExt, activeLawyerName);
    setBoundData(fresh);
    setPurposeInput(fresh.purpose);
    setReasonInput(fresh.reason);
    setHwpxEditedHtml(''); // 새로운 서식이 열리면 에디터 상태 초기화
  }, [isOpen, docItem, clientRequest, crmExt, activeLawyerName]);

  // HWPX 정식 법원 서식 원본 라이브러리 연동 상태
  const [hwpxEntry, setHwpxEntry] = useState<CourtFormEntry | null>(null);
  const [isLoadingHwpx, setIsLoadingHwpx] = useState(false);
  const [viewMode, setViewMode] = useState<'HWPX_OFFICIAL' | 'A4_CUSTOM'>('HWPX_OFFICIAL');
  const [hwpxEditedHtml, setHwpxEditedHtml] = useState<string>('');
  const hwpxContentRef = useRef<HTMLDivElement | null>(null);
  const printSourceRef = useRef<HTMLDivElement | null>(null);

  // 법원 HWPX 원본 라이브러리 데이터 로드 및 1:1 매칭
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingHwpx(true);

    fetch('/court-forms-library.json')
      .then(res => res.json())
      .then((data: CourtFormEntry[]) => {
        const targetFile = docItem.hwpxFileName;
        const targetTitle = docItem.title.replace(/\s+/g, '');

        // 스마트 매칭 알고리즘:
        // 1. hwpxFileName 완전 일치
        // 2. fileName 확장자 제외 명칭 일치
        // 3. dCode 일치
        // 4. 서식 명칭 정규화 일치
        const matched = data.find(f => {
          if (targetFile && f.fileName === targetFile) return true;
          if (targetFile && f.name === targetFile.replace(/\.hwpx$/, '')) return true;
          if (docItem.docCode && f.dCode && f.dCode === docItem.docCode) return true;
          if (f.name.replace(/\s+/g, '') === targetTitle) return true;
          if (f.name.includes(docItem.title) || docItem.title.includes(f.name)) return true;
          return false;
        });

        if (matched) {
          setHwpxEntry(matched);
          setViewMode('HWPX_OFFICIAL');
        } else {
          setHwpxEntry(null);
          setViewMode('A4_CUSTOM');
        }
        setIsLoadingHwpx(false);
      })
      .catch(() => {
        setIsLoadingHwpx(false);
        setViewMode('A4_CUSTOM');
      });
  }, [isOpen, docItem]);

  // HWPX 템플릿에 실시간 의뢰인 데이터 및 수정된 취지·이유를 바인딩한 최종 렌더링 HTML
  const activeHwpxHtml = useMemo(() => {
    if (!hwpxEntry) return '';
    const baseHtml = hwpxEditedHtml || hwpxEntry.html;
    return bindHwpxTemplateHtml(
      baseHtml,
      boundData,
      docItem,
      purposeInput,
      reasonInput
    );
  }, [hwpxEntry, hwpxEditedHtml, boundData, docItem, purposeInput, reasonInput]);

  // A4 규격 시트 및 페이지 넘김 상태
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageViewMode, setPageViewMode] = useState<'SINGLE' | 'CONTINUOUS'>('SINGLE');
  const [zoomScale, setZoomScale] = useState<number>(100);

  // 총 장 수: A4PagedSheets가 실제 A4 분할 결과를 측정하여 전달
  const [totalPages, setTotalPages] = useState<number>(1);
  const handlePageCountChange = useCallback((count: number) => {
    setTotalPages(count);
    setCurrentPage(p => Math.min(p, count));
  }, []);

  // 서식이나 뷰 모드가 변경되면 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [docItem.docCode, viewMode]);

  // 키보드 방향키/PageUp/PageDown으로 자연스러운 페이지 넘김
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentPage(p => Math.min(totalPages, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage(p => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  // AI 사유서 보강 생성기 (서식 유형별 전문 법률 문안)
  const handleAiDraft = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      let enrichedReason = reasonInput;
      if (docItem.title.includes('부동산')) {
        enrichedReason = `1. 신청인(채무자 겸 소유자)은 귀원에 개인회생절차 개시신청을 접수하여 성실히 변제계획을 준비 중에 있습니다.\n2. 그러나 채권자의 부동산 강제경매(또는 임의경매) 절차가 계속 진행될 경우, 신청인 및 부양가족의 유일한 주거지가 매각되어 생계유지가 불가능해지고 변제계획의 정상적 수행이 원천적으로 차단됩니다.\n3. 이에 채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호에 따라 경매절차의 긴급한 중지를 구하오니 신속히 인용하여 주시기 바랍니다.`;
      } else if (docItem.title.includes('유체동산')) {
        enrichedReason = `1. 신청인은 귀원에 개인회생절차 개시신청을 접수하고 성실히 절차를 이행하고 있습니다.\n2. 채권자의 신청에 기한 가재도구 및 집기비품에 대한 유체동산 경매 매각이 임박하여, 기본 일상생활 유지가 위태로운 상황입니다.\n3. 이에 채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호에 따라 유체동산 집행 절차의 즉시 중지를 신청합니다.`;
      } else if (docItem.title.includes('급여')) {
        enrichedReason = `1. 신청인은 직장에 성실히 재직 중이나, 채권자들의 급여채권 압류 및 추심명령으로 인하여 최저생계비 보장이 곤란하여 회생절차 변제계획 수행이 심각하게 위협받고 있습니다.\n2. 이에 채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호에 따라 급여 압류집행 절차의 중지를 신청하오니 인용하여 주시기 바랍니다.`;
      } else if (docItem.category === 'RELEASE') {
        enrichedReason = `1. 신청인에 대한 귀원 개인회생사건에 관하여 변제계획인가결정이 확정되었습니다.\n2. 채무자 회생 및 파산에 관한 법률 제615조 제3항에 따라 인가 전 행하여진 강제집행 및 가압류는 그 효력을 상실하였으므로, 그 집행을 즉시 해제하여 주시기 바랍니다.`;
      } else if (docItem.category === 'CORRECTION') {
        enrichedReason = `1. 귀원의 보정명령 지적사항을 엄숙히 수용하며, 사실관계와 금융소명자료를 바탕으로 상세히 소명합니다.\n2. 본 사안의 채무 증대 및 지출 과정에는 일체의 재산 은닉이나 사해행위가 없었음을 입증자료와 함께 명백히 밝힙니다.\n3. 이에 성실한 변제계획 이행을 다짐하오니 관대한 처분을 간청드립니다.`;
      }
      setReasonInput(enrichedReason);
      setIsAiGenerating(false);
      toast.success('사건 유형별 전문 실무 문안으로 보강되었습니다.');
    }, 150);
  };

  // 인쇄 기능: 미리보기 축소와 무관하게 원본 본문을 A4 규격 새 창에서 인쇄
  const handlePrint = () => {
    const isHwpx = viewMode === 'HWPX_OFFICIAL' && !!hwpxEntry;
    const bodyHtml = isHwpx
      ? `<div class="court-hwpx-render">${activeHwpxHtml}</div>`
      : printSourceRef.current?.innerHTML || '';
    if (!bodyHtml) {
      toast.error('인쇄할 내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.');
      return;
    }
    const appStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(n => n.outerHTML)
      .join('\n');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docItem.title}</title>
          <meta charset="utf-8" />
          <base href="${window.location.origin}/" />
          ${appStyles}
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            html, body { background: #fff !important; overflow: visible !important; height: auto !important; }
            body {
              margin: 0; padding: 0;
              font-family: 'Batang', 'BatangChe', '바탕', serif;
              font-size: 15px; line-height: 1.9; color: #000;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .court-hwpx-render table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
            .court-hwpx-render td, .court-hwpx-render th { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
            .court-hwpx-render h2 { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 0.15em; margin: 18px 0; }
            .court-hwpx-render p { margin: 6px 0; }
            tr { break-inside: avoid; }
          </style>
        </head>
        <body>${bodyHtml}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  // HWPX 파일 직접 다운로드 핸들러
  const handleDownloadHwpxFile = () => {
    if (!docItem.downloadUrl) {
      toast.error('해당 서식의 원본 파일이 등록되어 있지 않습니다.');
      return;
    }
    const link = document.createElement('a');
    link.href = docItem.downloadUrl;
    link.download = docItem.hwpxFileName || `${docItem.title}.hwpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`'${docItem.title}' 원본 서식 파일을 다운로드했습니다.`);
  };

  // 모바일 작성 링크 생성 및 알림톡 복사
  const handleSendMobileRequest = () => {
    const req = ClientMobileDocService.createRequest(
      clientRequest.id,
      clientRequest.clientName || '신청인',
      clientRequest.phone || '',
      docItem.docCode,
      docItem.title
    );
    const msg = ClientMobileDocService.generateNotificationMessage(req);
    navigator.clipboard.writeText(msg).then(
      () => toast.success('모바일 작성 안내문이 복사되었습니다. 카카오톡·문자로 전달해 주세요.'),
      () => toast.error('클립보드 복사에 실패했습니다.'),
    );

    if (onOpenMobileFillModal) {
      onOpenMobileFillModal(req.token);
    }
  };

  // 전자소송 패키지에 첨부
  const handleAttach = () => {
    if (!onAttachToFilingPackage) {
      toast.error('이 화면에서는 전자소송 패키지 첨부가 연결되어 있지 않습니다.');
      return;
    }
    const fullText = `[${docItem.title}]\n\n사건: ${boundData.caseNumber}\n신청인: ${boundData.debtorName}\n\n[신청취지]\n${purposeInput}\n\n[신청이유]\n${reasonInput}`;
    onAttachToFilingPackage(docItem.title, fullText);
    toast.success(`'${docItem.title}'을(를) 전자소송 패키지 목록에 추가했습니다.`);
    onClose();
  };

  return (
    <ModalPortal>
      {/* ── 인쇄 전용 CSS ── */}
      <style>{`
        @media print {
          #root, [data-sonner-toaster], .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            background: white !important;
            overflow: visible !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
        .court-hwpx-render table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 12px 0 !important;
          font-size: 13px !important;
        }
        .court-hwpx-render td, .court-hwpx-render th {
          border: 1px solid #475569 !important;
          padding: 6px 8px !important;
          vertical-align: middle !important;
        }
        .court-hwpx-render h2 {
          text-align: center !important;
          font-size: 20px !important;
          font-weight: bold !important;
          letter-spacing: 0.15em !important;
          margin: 18px 0 !important;
        }
        .court-hwpx-render p {
          margin: 6px 0 !important;
          line-height: 1.8 !important;
        }
        .court-hwpx-render {
          font-size: 15px;
          line-height: 1.8;
          color: #0f172a;
          word-break: keep-all;
          overflow-wrap: anywhere;
        }
        .a4-flow-content img,
        .a4-flow-content table,
        .a4-flow-content div {
          max-width: 100% !important;
        }
        .a4-flow-content tr {
          break-inside: avoid;
        }
        .a4-flow-content h1,
        .a4-flow-content h2,
        .a4-flow-content h3 {
          break-after: avoid;
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn print:static print:bg-white print:p-0 print:overflow-visible">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:max-h-none print:rounded-none print:overflow-visible">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
              #{docItem.docCode}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">{docItem.title}</h3>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {docItem.category}
                </span>
                {docItem.hwpxFileName && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold border border-blue-400/30">
                    🏛️ HWPX 법원서식 연동됨
                  </span>
                )}
                {docItem.isClientMobileSupport && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    의뢰인 모바일 작성 지원
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                사건: {boundData.caseNumber || '미지정'} · 신청인: <strong className="text-white">{boundData.debtorName}</strong> · 법원: {boundData.courtName || '관할법원'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {docItem.downloadUrl && (
              <button
                type="button"
                onClick={handleDownloadHwpxFile}
                className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 press-scale cursor-pointer border border-slate-700"
                title="원본 HWPX 파일 다운로드"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>HWPX 다운로드</span>
              </button>
            )}
            {docItem.isClientMobileSupport && (
              <button
                type="button"
                onClick={handleSendMobileRequest}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>의뢰인 모바일 요청</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 press-scale cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>양식 인쇄</span>
            </button>
            <button
              type="button"
              onClick={handleAttach}
              className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>전자소송 패키지에 첨부</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2열 분할 작업 영역: 좌측 폼 입력 & AI / 우측 실시간 A4 프리뷰 */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden print:block print:overflow-visible">
          
          {/* ── 좌측: 폼 편집 & AI 코파일럿 ── */}
          <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col overflow-y-auto p-5 space-y-4 bg-slate-50/50 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>서식 변수 및 사유 작성</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrecedentModal(true)}
                  className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 cursor-pointer press-scale"
                >
                  <span>📁 과거 선례 참고</span>
                </button>
                <span className="text-[11px] text-slate-600 font-mono">CRM 자동 바인딩 완료</span>
              </div>
            </div>

            {/* 당사자 및 사건 기본 정보 (2열 그리드) */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-600">신청인:</span>
                <span className="font-bold text-slate-900 ml-1.5">{boundData.debtorName}</span>
              </div>
              <div>
                <span className="text-slate-600">주민번호:</span>
                <span className="font-mono text-slate-700 ml-1.5">{boundData.debtorRrn || '미등록'}</span>
              </div>
              <div>
                <span className="text-slate-600">관할법원:</span>
                <span className="font-bold text-slate-900 ml-1.5">{boundData.courtName || '서울회생법원'}</span>
              </div>
              <div>
                <span className="text-slate-600">사건번호:</span>
                <span className="font-mono text-slate-700 ml-1.5">{boundData.caseNumber || '진행예정'}</span>
              </div>
              <div className="col-span-2 text-slate-600">
                <span>대리인:</span>
                <span className="font-bold text-slate-900 ml-1.5">{boundData.agentLawfirm}</span>
              </div>
            </div>

            {/* 신청취지 / 보정취지 입력 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>신청취지 / 보정취지</span>
                <span className="text-[11px] text-slate-600 font-normal">법원 결정 주문에 해당</span>
              </label>
              <textarea
                rows={3}
                value={purposeInput}
                onChange={e => setPurposeInput(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-sans leading-relaxed resize-none"
              />
            </div>

            {/* 신청이유 / 소명사유 입력 & AI 문안 보강 */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[180px]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  <span>신청이유 / 소명사유</span>
                </label>
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={isAiGenerating}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80 flex items-center gap-1 cursor-pointer press-scale"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{isAiGenerating ? '법률 사유 작성 중...' : 'AI 사유 자동 보강'}</span>
                </button>
              </div>
              <textarea
                rows={8}
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                className="w-full flex-1 text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-sans leading-relaxed resize-none"
              />
            </div>

            {/* 첨부서류 목록 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">첨부서류</label>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                {boundData.evidenceList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-blue-500 font-bold">▪</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 우측: 대법원 표준 규격 A4 실시간 프리뷰 & 자연스러운 페이지 넘김 ── */}
          <div className="w-full md:w-1/2 min-h-0 bg-slate-200/80 flex flex-col overflow-hidden print:w-full print:bg-white print:overflow-visible">

            {/* 상단 툴바 (스크롤 영역 밖에 고정) */}
            <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-slate-300 bg-slate-100/95 print:hidden text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* 모드 탭 */}
                <div className="flex items-center gap-1.5">
                  {hwpxEntry && (
                    <button
                      type="button"
                      onClick={() => { setViewMode('HWPX_OFFICIAL'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap press-scale ${
                        viewMode === 'HWPX_OFFICIAL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                      }`}
                    >
                      🏛️ 정식 서식 (HWPX)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setViewMode('A4_CUSTOM'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap press-scale ${
                      viewMode === 'A4_CUSTOM'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                    }`}
                  >
                    ✍️ 신청취지·사유 서면
                  </button>
                </div>

                {docItem.downloadUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadHwpxFile}
                    className="text-xs text-blue-700 font-bold flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-50 cursor-pointer whitespace-nowrap press-scale"
                  >
                    <Download className="w-3 h-3 text-blue-600" />
                    <span>HWPX 받기</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* 페이지 넘김 컨트롤 */}
                <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-xl border border-slate-300">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || pageViewMode === 'CONTINUOUS'}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                    title="이전 장 (←)"
                    aria-label="이전 장"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-800 font-mono px-1.5 select-none whitespace-nowrap">
                    {pageViewMode === 'SINGLE' ? currentPage : '전체'} / {totalPages}
                    <span className="font-sans font-normal text-[11px] text-slate-500 ml-0.5">장</span>
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || pageViewMode === 'CONTINUOUS'}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                    title="다음 장 (→)"
                    aria-label="다음 장"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button
                    type="button"
                    onClick={() => setPageViewMode(m => (m === 'SINGLE' ? 'CONTINUOUS' : 'SINGLE'))}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    title="보기 방식 전환"
                  >
                    {pageViewMode === 'SINGLE' ? (
                      <><BookOpen className="w-3 h-3" /><span>1장씩 넘김</span></>
                    ) : (
                      <><Layers className="w-3 h-3" /><span>전장 연속</span></>
                    )}
                  </button>
                </div>

                {/* 배율 */}
                <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-xl border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setZoomScale(z => Math.max(60, z - 10))}
                    className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-700"
                    aria-label="축소"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomScale(100)}
                    className="font-mono font-bold text-slate-700 w-12 text-center cursor-pointer"
                    title="패널 폭에 맞춤"
                  >
                    {zoomScale}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomScale(z => Math.min(160, z + 10))}
                    className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-700"
                    aria-label="확대"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-500 pl-1 whitespace-nowrap hidden lg:inline">A4 210×297mm</span>
                </div>
              </div>

              {viewMode === 'HWPX_OFFICIAL' && hwpxEntry && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <span className="truncate">
                    <span className="font-bold text-blue-700">대법원 정식 서식</span> · {hwpxEntry.name}
                    <span className="ml-1.5 text-emerald-700 font-bold">✓ CRM 데이터 반영</span>
                  </span>
                  {hwpxEditedHtml && (
                    <button
                      type="button"
                      onClick={() => setHwpxEditedHtml('')}
                      className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap"
                    >
                      편집 내용 초기화
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* A4 시트 스크롤 영역 */}
            <div className="flex-1 overflow-auto p-4 md:p-5 print:p-0 print:overflow-visible">
              {isLoadingHwpx ? (
                <div className="mx-auto w-full max-w-[794px] aspect-[210/297] bg-white ring-1 ring-slate-300 shadow-lg p-[10%] space-y-4 animate-pulse">
                  <div className="h-6 w-1/2 mx-auto bg-slate-200 rounded-lg" />
                  <div className="h-3 w-full bg-slate-100 rounded-lg" />
                  <div className="h-3 w-5/6 bg-slate-100 rounded-lg" />
                  <div className="h-3 w-4/6 bg-slate-100 rounded-lg" />
                </div>
              ) : viewMode === 'HWPX_OFFICIAL' && hwpxEntry ? (
                <A4PagedSheets
                  key={`hwpx-${docItem.docCode}`}
                  html={activeHwpxHtml}
                  mode={pageViewMode}
                  currentPage={currentPage}
                  zoom={zoomScale}
                  onPageCountChange={handlePageCountChange}
                  editable
                  onHtmlEdit={setHwpxEditedHtml}
                />
              ) : (
                <A4PagedSheets
                  key={`a4-${docItem.docCode}`}
                  mode={pageViewMode}
                  currentPage={currentPage}
                  zoom={zoomScale}
                  onPageCountChange={handlePageCountChange}
                  fontFamily={`'Batang', 'BatangChe', 'Gungsuh', serif`}
                  sourceRef={printSourceRef}
                >
                  <div className="a4-written-doc" style={{ fontSize: 15, lineHeight: 1.9 }}>
                    <h1 className="text-center font-bold text-slate-900 pb-4 mb-6 border-b-2 border-slate-800" style={{ fontSize: 26, letterSpacing: '0.2em' }}>
                      {docItem.title}
                    </h1>

                    <table className="w-full mb-6" style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td className="align-top font-bold py-1" style={{ width: 96 }}>사&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;건</td>
                          <td className="py-1 font-bold">{boundData.caseNumber || '귀원 개인회생 사건'}</td>
                        </tr>
                        <tr>
                          <td className="align-top font-bold py-1">신&nbsp;&nbsp;청&nbsp;&nbsp;인</td>
                          <td className="py-1">
                            <span className="font-bold">{boundData.debtorName}</span>
                            {boundData.debtorRrn ? ` (${boundData.debtorRrn})` : ''}
                            {boundData.debtorAddress && <div style={{ fontSize: 13 }} className="text-slate-700">{boundData.debtorAddress}</div>}
                            {boundData.debtorPhone && <div style={{ fontSize: 13 }} className="text-slate-600">연락처: {boundData.debtorPhone}</div>}
                          </td>
                        </tr>
                        <tr>
                          <td className="align-top font-bold py-1">대&nbsp;&nbsp;리&nbsp;&nbsp;인</td>
                          <td className="py-1">{boundData.agentLawfirm}</td>
                        </tr>
                      </tbody>
                    </table>

                    <h3 className="font-bold text-center mb-2" style={{ fontSize: 17, letterSpacing: '0.4em' }}>신청취지</h3>
                    <div className="whitespace-pre-wrap mb-6 text-slate-900">{purposeInput}</div>

                    <h3 className="font-bold text-center mb-2" style={{ fontSize: 17, letterSpacing: '0.4em' }}>신청이유</h3>
                    <div className="whitespace-pre-wrap mb-6 text-slate-900">{reasonInput}</div>

                    <h3 className="font-bold mb-1" style={{ fontSize: 15, letterSpacing: '0.3em' }}>첨부서류</h3>
                    <div className="mb-8 pl-4" style={{ fontSize: 14 }}>
                      {boundData.evidenceList.map((doc, idx) => (
                        <div key={idx}>{doc}</div>
                      ))}
                    </div>

                    {/* 날짜·날인·관할법원은 한 장 안에 함께 배치 */}
                    <div className="text-center pt-4" style={{ breakInside: 'avoid' }}>
                      <div className="mb-6" style={{ letterSpacing: '0.1em' }}>{boundData.submissionDate}</div>
                      <div className="flex justify-end items-center gap-4 pr-6 mb-8">
                        <span>신청인의 대리인 {boundData.agentLawyerName}</span>
                        <span className="w-11 h-11 rounded-full border border-rose-500 inline-flex items-center justify-center text-rose-600 font-bold" style={{ fontSize: 12 }}>
                          (인)
                        </span>
                      </div>
                      <div className="font-bold text-slate-900" style={{ fontSize: 19, letterSpacing: '0.15em' }}>
                        {boundData.courtName || '서울회생법원'} 귀중
                      </div>
                    </div>
                  </div>
                </A4PagedSheets>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 과거 유사 선례 모범 기재례 팝업 모달 */}
      {showPrecedentModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                  📁
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    과거 인가·면책 모범 작성 선례
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    서식: {docItem.title} (#{docItem.docCode})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrecedentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/80 p-3 rounded-xl border border-blue-200/80">
              💡 당 로펌에서 유사 사건에 실제로 제출하여 회생위원 및 판사의 인가를 이끌어낸 검증된 모범 문안입니다.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto select-text">
              {getDocumentPrecedent(docItem.docCode)}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrecedentModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  const prec = getDocumentPrecedent(docItem.docCode);
                  if (prec) {
                    setReasonInput(prec);
                    toast.success('모범 선례 문안이 본문에 적용되었습니다.');
                  }
                  setShowPrecedentModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs"
              >
                선례 본문에 적용
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </ModalPortal>
  );
}

export default function DocFormEditorModal(props: DocFormEditorModalProps) {
  if (!props.isOpen) return null;
  return <DocFormEditorModalInner {...props} />;
}
