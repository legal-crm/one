import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Printer, Download, Sparkles, Send, FileText, CheckCircle2, 
  RotateCcw, Scale, Copy, ExternalLink, ShieldCheck, Eye, Edit3, ArrowRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  type LegalDocItem, 
  getDocumentPrecedent 
} from '../../../services/documents/legalDocRegistry';
import { 
  bindDocumentVariables, 
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

  // HWPX 정식 법원 서식 원본 라이브러리 연동 상태
  const [hwpxEntry, setHwpxEntry] = useState<CourtFormEntry | null>(null);
  const [isLoadingHwpx, setIsLoadingHwpx] = useState(false);
  const [viewMode, setViewMode] = useState<'HWPX_OFFICIAL' | 'A4_CUSTOM'>('HWPX_OFFICIAL');
  const [hwpxEditedHtml, setHwpxEditedHtml] = useState<string>('');
  const hwpxContentRef = useRef<HTMLDivElement | null>(null);

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
          setHwpxEditedHtml(matched.html);
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

  // 인쇄 기능 (선택된 뷰 모드에 맞춰 최적화 인쇄)
  const handlePrint = () => {
    if (viewMode === 'HWPX_OFFICIAL' && hwpxEntry) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.');
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docItem.title} - 대법원 정식 서식</title>
            <meta charset="utf-8" />
            <style>
              @page { size: A4 portrait; margin: 30mm 20mm 25mm 20mm; }
              body {
                margin: 0; padding: 0;
                font-family: 'Batang', 'BatangChe', '바탕', serif;
                font-size: 15px; line-height: 1.9; color: #000;
                -webkit-print-color-adjust: exact;
              }
              table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
              td, th { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
              h2 { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 0.15em; margin: 18px 0; }
              p { margin: 6px 0; }
            </style>
          </head>
          <body>${hwpxEditedHtml || hwpxEntry.html}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 400);
    } else {
      window.print();
    }
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
      `}</style>

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn print:static print:bg-white print:p-0 print:overflow-visible">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:max-h-none print:rounded-none print:overflow-visible">
        
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

          {/* ── 우측: 대법원 표준 규격 A4 실시간 프리뷰 ── */}
          <div className="w-full md:w-1/2 bg-slate-200/80 p-4 md:p-6 overflow-y-auto flex flex-col items-center print:w-full print:p-0 print:bg-white print:overflow-visible">
            
            {/* 상단 뷰 모드 탭 바 (HWPX 원본 서식 vs A4 서면 변수 에디터) */}
            <div className="w-full max-w-[210mm] flex items-center justify-between pb-3 mb-3 border-b border-slate-300 print:hidden">
              <div className="flex items-center gap-1.5">
                {hwpxEntry && (
                  <button
                    type="button"
                    onClick={() => setViewMode('HWPX_OFFICIAL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'HWPX_OFFICIAL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    <span>🏛️ 대법원 정식 서식 (HWPX)</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-extrabold">원본 규격</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode('A4_CUSTOM')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'A4_CUSTOM'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  <span>✍️ 신청취지·사유 A4 서면</span>
                </button>
              </div>

              {docItem.downloadUrl && (
                <button
                  type="button"
                  onClick={handleDownloadHwpxFile}
                  className="text-xs text-blue-700 font-bold hover:underline flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs"
                >
                  <Download className="w-3 h-3 text-blue-600" />
                  <span>HWPX 원본 받기</span>
                </button>
              )}
            </div>

            {/* [모드 1] 대법원 정식 HWPX 파싱 실시간 캔버스 */}
            {viewMode === 'HWPX_OFFICIAL' && hwpxEntry ? (
              <div 
                id="court-hwpx-printable"
                className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg rounded-sm p-8 md:p-12 text-slate-900 font-serif select-text print:shadow-none print:border-none print:m-0 print:p-0 print:mx-auto"
                style={{ fontFamily: `'Batang', 'BatangChe', '바탕', serif`, lineHeight: '1.8' }}
              >
                {/* 상단 안내 바 */}
                <div className="mb-4 pb-2 border-b border-blue-200 bg-blue-50/70 p-3 rounded-xl text-xs text-blue-900 font-sans flex items-center justify-between print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-blue-700">🏛️ 대법원 정식 서식 원본:</span>
                    <span className="font-bold">{hwpxEntry.name}</span>
                    <span className="text-[11px] text-blue-600">({hwpxEntry.fileName})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">클릭하여 본문 직접 수정 가능</span>
                </div>

                {/* HWPX 원본 HTML 본문 (수정 및 인쇄 지원) */}
                <div
                  ref={hwpxContentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => setHwpxEditedHtml(e.currentTarget.innerHTML)}
                  className="outline-none focus:ring-1 focus:ring-blue-300/40 rounded-sm p-1 court-hwpx-render text-slate-900"
                  dangerouslySetInnerHTML={{ __html: hwpxEditedHtml || hwpxEntry.html }}
                />
              </div>
            ) : (
              /* [모드 2] 신청취지·사유 중심 대법원 규격 A4 실시간 프리뷰 */
              <div 
                id="court-a4-printable"
                className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg rounded-sm p-10 md:p-14 text-slate-900 font-serif flex flex-col justify-between select-text print:shadow-none print:border-none print:m-0 print:mx-auto"
                style={{ fontFamily: `'Batang', 'BatangChe', 'Gungsuh', serif` }}
              >
                {/* 법원 문서 상단 */}
                <div className="space-y-6">
                  {/* 대제목 */}
                  <div className="text-center pt-2 pb-4 border-b-2 border-slate-800">
                    <h1 className="text-2xl font-bold tracking-widest text-slate-900">
                      {docItem.title}
                    </h1>
                  </div>

                  {/* 사건 및 당사자 표시 */}
                  <div className="space-y-2 text-sm leading-relaxed">
                    <div className="flex">
                      <span className="w-24 font-bold">사&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;건</span>
                      <span className="font-mono">{boundData.caseNumber || '귀원 개인회생 사건'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold">신&nbsp;&nbsp;청&nbsp;&nbsp;인</span>
                      <div>
                        <span>{boundData.debtorName} {boundData.debtorRrn ? `(${boundData.debtorRrn})` : ''}</span>
                        {boundData.debtorAddress && (
                          <div className="text-xs text-slate-600 font-sans mt-0.5">{boundData.debtorAddress}</div>
                        )}
                        {boundData.debtorPhone && (
                          <div className="text-xs text-slate-500 font-sans">연락처: {boundData.debtorPhone}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex pt-2">
                      <span className="w-24 font-bold">대&nbsp;&nbsp;리&nbsp;&nbsp;인</span>
                      <div>
                        <span>{boundData.agentLawfirm}</span>
                      </div>
                    </div>
                  </div>

                  {/* 신청취지 */}
                  <div className="space-y-2 pt-4">
                    <h3 className="font-bold text-base tracking-wider">[ 신 청 취 지 ]</h3>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-slate-200 text-slate-800">
                      {purposeInput}
                    </div>
                  </div>

                  {/* 신청이유 */}
                  <div className="space-y-2 pt-4">
                    <h3 className="font-bold text-base tracking-wider">[ 신 청 이 유 ]</h3>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-slate-200 text-slate-800">
                      {reasonInput}
                    </div>
                  </div>

                  {/* 첨부서류 */}
                  <div className="space-y-1.5 pt-4">
                    <h3 className="font-bold text-sm tracking-wider">[ 첨 부 서 류 ]</h3>
                    <div className="text-xs text-slate-700 pl-4 space-y-1">
                      {boundData.evidenceList.map((doc, idx) => (
                        <div key={idx}>{doc}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 법원 문서 하단: 제출일자, 대리인 날인, 관할법원 */}
                <div className="space-y-8 pt-10 text-center">
                  <div className="text-sm tracking-widest font-mono">
                    {boundData.submissionDate}
                  </div>

                  <div className="flex justify-end pr-8 items-center gap-4 text-sm">
                    <span>신청인의 대리인 {boundData.agentLawyerName}</span>
                    <div className="w-12 h-12 rounded-full border border-rose-400 flex items-center justify-center text-xs text-rose-600 font-bold bg-rose-50/30">
                      (인)
                    </div>
                  </div>

                  <div className="text-lg font-bold tracking-widest text-slate-900 pt-4">
                    {boundData.courtName || '서울회생법원'} 귀중
                  </div>
                </div>

              </div>
            )}

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
