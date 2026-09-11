import React, { useState, useEffect } from 'react';
import { 
  X, Printer, Download, Sparkles, Send, FileText, CheckCircle2, 
  RotateCcw, Scale, Copy, ExternalLink, ShieldCheck 
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

export default function DocFormEditorModal({
  isOpen,
  onClose,
  docItem,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호',
  onAttachToFilingPackage,
  onOpenMobileFillModal
}: DocFormEditorModalProps) {
  if (!isOpen) return null;

  const [boundData, setBoundData] = useState<BoundDocumentData>(() => {
    return bindDocumentVariables(docItem, clientRequest, crmExt, activeLawyerName);
  });

  const [purposeInput, setPurposeInput] = useState(boundData.purpose);
  const [reasonInput, setReasonInput] = useState(boundData.reason);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [userPromptMemo, setUserPromptMemo] = useState('');
  const [showPrecedentModal, setShowPrecedentModal] = useState(false);

  // AI 사유서 보강 생성기 (시뮬레이션)
  const handleAiDraft = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      let enrichedReason = reasonInput;
      if (docItem.category === 'STAY_INJUNCT') {
        enrichedReason = `1. 신청인은 성실히 직장에 재직 중이나, 채권자들의 무차별적인 급여채권 압류 및 일상적 채권추심으로 인하여 헌법상 보장된 최저인간다운 생활이 위협받고 있습니다.\n2. 만일 본 강제집행이 지속될 경우 신청인은 회생절차의 원활한 변제계획 수행이 원천적으로 불가능해지는 회복할 수 없는 손해를 입게 됩니다.\n3. 따라서 채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호에 따라 본 신청에 이르렀사오니 신속히 인용하여 주시기 바랍니다.`;
      } else if (docItem.category === 'CORRECTION') {
        enrichedReason = `1. 귀원의 보정권고 취지를 엄중히 수용하며, 지적하신 사항에 대하여 사실관계와 금융소명자료를 바탕으로 투명하게 소명합니다.\n2. 본 사안의 채무 증대 및 지출 과정에는 일체의 재산 은닉이나 사해행위 의도가 없었으며, 채무자 본인의 부양가족 생계유지와 불가피했던 대환 과정에서 발생한 것임을 증명원과 함께 제출합니다.\n3. 이에 보정서 및 수정 변제계획안을 성실히 이행할 것을 서약하오니 관대한 처분을 간청드립니다.`;
      } else if (docItem.category === 'RELEASE') {
        enrichedReason = `1. 신청인에 대한 귀원 개인회생사건에 관하여 채무자회생법 제615조 제2항에 의거하여 변제계획인가결정이 확정되었습니다.\n2. 따라서 개시결정 전후에 행하여진 채권자들의 모든 가압류, 압류 및 추심명령은 법률상 당연 실효되었으므로, 별지 기재 사건에 대한 압류 해제 통지를 제3채무자에게 신속히 송달하여 주시기를 신청합니다.`;
      }
      setReasonInput(enrichedReason);
      setIsAiGenerating(false);
      toast.success('AI 법률 사유 초안이 법원 판례 문체로 생성되었습니다!');
    }, 700);
  };

  // 인쇄 기능
  const handlePrint = () => {
    window.print();
  };

  // 모바일 작성 링크 생성 및 알림톡 복사
  const handleSendMobileRequest = () => {
    const req = ClientMobileDocService.createRequest(
      clientRequest.id,
      clientRequest.clientName || '신청인',
      clientRequest.phone || '010-0000-0000',
      docItem.docCode,
      docItem.title
    );
    const msg = ClientMobileDocService.generateNotificationMessage(req);
    navigator.clipboard.writeText(msg);
    toast.success('📱 의뢰인 전송용 모바일 작성 안내문이 클립보드에 복사되었습니다! (알림톡/문자 즉시 발송 가능)');

    if (onOpenMobileFillModal) {
      onOpenMobileFillModal(req.token);
    }
  };

  // 전자소송 패키지에 첨부
  const handleAttach = () => {
    if (onAttachToFilingPackage) {
      const fullText = `[${docItem.title}]\n\n사건: ${boundData.caseNumber}\n신청인: ${boundData.debtorName}\n\n[신청취지]\n${purposeInput}\n\n[신청이유]\n${reasonInput}`;
      onAttachToFilingPackage(docItem.title, fullText);
    }
    toast.success(`'${docItem.title}'이(가) 전자소송 일괄 결합 슬롯에 성공적으로 연결되었습니다.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
              #{docItem.docCode}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">{docItem.title}</h3>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {docItem.category}
                </span>
                {docItem.isClientMobileSupport && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    의뢰인 모바일 작성 지원
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                사건: {boundData.caseNumber} · 신청인: {boundData.debtorName} · 법원: {boundData.courtName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {docItem.isClientMobileSupport && (
              <button
                onClick={handleSendMobileRequest}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>의뢰인 모바일 요청</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 press-scale cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>양식 인쇄</span>
            </button>
            <button
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
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
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
                  className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer press-scale shadow-xs"
                >
                  <Copy className="w-3 h-3 text-blue-600" />
                  <span>📁 과거 선례 참고</span>
                </button>
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">CRM 자동 바인딩 완료</span>
              </div>
            </div>

            {/* 당사자 정보 미리보기 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>신청인: <strong className="text-slate-900">{boundData.debtorName}</strong></div>
                <div>주민번호: <strong className="text-slate-900 font-mono">{boundData.debtorRrn}</strong></div>
                <div>관할법원: <strong className="text-slate-900">{boundData.courtName}</strong></div>
                <div>사건번호: <strong className="text-slate-900 font-mono">{boundData.caseNumber}</strong></div>
              </div>
              <div className="text-slate-600 text-[11px] border-t border-slate-100 pt-2">
                대리인: {boundData.agentLawfirm}
              </div>
            </div>

            {/* 신청취지 입력란 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">신청취지 / 보정취지</label>
              <textarea
                rows={3}
                value={purposeInput}
                onChange={e => setPurposeInput(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-sans leading-relaxed"
              />
            </div>

            {/* 신청이유 & 법률 AI 코파일럿 */}
            <div className="space-y-1.5 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">신청이유 / 소명사유</label>
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={isAiGenerating}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80 flex items-center gap-1 cursor-pointer press-scale"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{isAiGenerating ? 'AI 법률 문안 생성 중...' : 'AI 사유 자동 보강'}</span>
                </button>
              </div>
              <textarea
                rows={10}
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
          <div className="w-full md:w-1/2 bg-slate-200/80 p-4 md:p-6 overflow-y-auto flex justify-center">
            
            {/* A4 용지 렌더링 컨테이너 */}
            <div 
              id="court-a4-printable"
              className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg rounded-sm p-10 md:p-14 text-slate-900 font-serif flex flex-col justify-between select-text"
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
                    <span className="font-mono">{boundData.caseNumber}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 font-bold">신&nbsp;&nbsp;청&nbsp;&nbsp;인</span>
                    <div>
                      <span>{boundData.debtorName} ({boundData.debtorRrn})</span>
                      <div className="text-xs text-slate-600 font-sans mt-0.5">{boundData.debtorAddress}</div>
                      <div className="text-xs text-slate-500 font-sans">연락처: {boundData.debtorPhone}</div>
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
                  <div className="w-12 h-12 rounded-full border border-rose-400 flex items-center justify-center text-[10px] text-rose-600 font-bold bg-rose-50/30">
                    (인)
                  </div>
                </div>

                <div className="text-lg font-bold tracking-widest text-slate-900 pt-4">
                  {boundData.courtName} 귀중
                </div>
              </div>

            </div>

          </div>

      </div>

      {/* 과거 유사 선례 모범 기재례 팝업 모달 */}
      {showPrecedentModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
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
                  <p className="text-[11px] text-slate-500 font-mono">
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
                  const precedent = getDocumentPrecedent(docItem.docCode);
                  setReasonInput(prev => (prev ? prev + '\n\n' + precedent : precedent));
                  setShowPrecedentModal(false);
                  toast.success('과거 선례 문안이 신청이유에 성공적으로 추가되었습니다!');
                }}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs press-scale cursor-pointer"
              >
                본문(신청이유)에 바로 적용
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
