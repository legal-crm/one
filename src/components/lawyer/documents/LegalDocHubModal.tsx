import React, { useState, useMemo } from 'react';
import { 
  X, Search, Sparkles, FileText, Send, CheckCircle2, 
  AlertTriangle, Download, ArrowRight, ShieldCheck, 
  Layers, Filter, Clock, ExternalLink, Smartphone, Copy, Plus, Printer, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

// 저장 경로(onUpdateCrmExt)가 없을 때: 조용히 성공한 척하지 않고 실패로 처리해 에디터가 '저장하지 못했습니다'를 표시하게 한다
const noSavePath = async (): Promise<void> => {
  throw new Error('이 화면에서는 사건 정보 저장이 연결되어 있지 않습니다. 사건 상세(CRM)에서 열어 저장하세요.');
};
import { 
  ALL_LEGAL_DOC_REGISTRY, 
  getSmartRecommendedDocs, 
  getDocumentTier,
  getIssuanceGuideForDoc,
  type LegalDocItem, 
  type DocCategory,
  type DocCaseScope,
  type DocTypeNature
} from '../../../services/documents/legalDocRegistry';
import { clientFormSchemaFor } from '../../../services/forms/clientFormSchemas';
import { requestClientForm } from '../../../services/forms/clientFormService';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import DocFormEditorModal from './DocFormEditorModal';
import ClientFormRequestsPanel from './ClientFormRequestsPanel';
import DocumentIssuanceGuideModal from '../../common/DocumentIssuanceGuideModal';
import IncomeExpenseModal from '../repayment/IncomeExpenseModal';
import PropertyValuationModal from '../assets/PropertyValuationModal';
import CourtDocSuiteViewerModal from '../courtDocs/CourtDocSuiteViewerModal';
import ModalPortal from '../../common/ModalPortal';

interface LegalDocHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
  onOpenBatchFiling?: () => void;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
  /** 서버 사무소 ID — 의뢰인 작성 요청(H-14)·작성 내용 저장(H-12)·PDF 저장(H-13)에 필요 */
  officeId?: string;
  /** PDF를 사건 서류함에 저장한 뒤 */
  onCaseFilesChanged?: () => void;
}

type TabKey = 'recommend' | 'all' | 'rehab' | 'bankruptcy' | 'common' | 'mobile';

function LegalDocHubModalInner({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '',
  onOpenBatchFiling,
  onUpdateCrmExt,
  officeId,
  onCaseFilesChanged
}: LegalDocHubModalProps) {

  const clientName = clientRequest.clientName || '신청인';
  // 이전: 사건번호·법원이 없으면 '2026개회 50284호'·'서울회생법원'을 지어 넣었다
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '관할 법원 미정';
  const caseNumber = crmExt.courtCase?.caseNumber || '사건번호 미등록';

  const [activeTab, setActiveTab] = useState<TabKey>('recommend');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'ALL'>('ALL');
  const [selectedNature, setSelectedNature] = useState<'ALL' | DocTypeNature>('ALL');

  // 특정 서식 에디터 모달 상태
  const [editingDoc, setEditingDoc] = useState<LegalDocItem | null>(null);

  // 발급 안내 모달 상태
  const [selectedGuideDoc, setSelectedGuideDoc] = useState<LegalDocItem | null>(null);


  // 13종 법원 표준 서식 통합 웹 에디터/인쇄 모달 상태 (오토로 규격)
  const [showCourtDocSuite, setShowCourtDocSuite] = useState(false);

  // 스마트 추천 서식 계산
  const recommendations = useMemo(() => {
    return getSmartRecommendedDocs(clientRequest, crmExt);
  }, [clientRequest, crmExt]);

  // 의뢰인 작성 요청 (서버, H-14): 진행 중 건수만 탭에 표시
  const [openFormCount, setOpenFormCount] = useState<number | null>(null);
  const [requestingCode, setRequestingCode] = useState<string | null>(null);

  const [includeColdArchive, setIncludeColdArchive] = useState(false);
  const [onlyOfficialCourt, setOnlyOfficialCourt] = useState(false);
  const [onlyPendingUpload, setOnlyPendingUpload] = useState(false);

  // 서류 목록 필터 (사건 관할 범위 + 서류 성격 + 카테고리 + 검색어 + Cold Archive + 정식 서식 전용 + 미등록 대기 전용)
  const filteredAllDocs = useMemo(() => {
    return ALL_LEGAL_DOC_REGISTRY.filter(doc => {
      const docTier = getDocumentTier(doc);

      // 0. 대법원 정식 서식 전용 필터
      if (onlyOfficialCourt && !doc.isOfficialCourtForm) {
        return false;
      }

      // 0-1. 서식 파일 미등록 (업로드 대기) 전용 필터
      if (onlyPendingUpload && !doc.isPendingUpload) {
        return false;
      }

      // 1. 관할 범위 필터 (activeTab 기반)
      if (activeTab === 'rehab' && doc.caseScope !== 'REHAB' && doc.caseScope !== 'COMMON') {
        return false;
      }
      if (activeTab === 'bankruptcy' && doc.caseScope !== 'BANKRUPTCY' && doc.caseScope !== 'COMMON') {
        return false;
      }
      if (activeTab === 'common' && doc.caseScope !== 'COMMON') {
        return false;
      }

      // 2. 카테고리 필터
      const matchCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
      if (!matchCategory) return false;

      // 3. 성격 필터 (발급형 / 자가작성형 / 변호사작성)
      if (selectedNature === 'ISSUED_BY_AGENCY') {
        const isIssued = doc.docTypeNature === 'ISSUED_BY_AGENCY' || !!getIssuanceGuideForDoc(doc.docCode) || !!getIssuanceGuideForDoc(doc.title);
        if (!isIssued) return false;
      } else if (selectedNature === 'SELF_WRITTEN') {
        const isSelf = doc.docTypeNature === 'SELF_WRITTEN' || !!doc.isClientMobileSupport;
        if (!isSelf) return false;
      } else if (selectedNature === 'LAWYER_COURT') {
        const isLawyer = doc.docTypeNature === 'LAWYER_COURT' || (!doc.isClientMobileSupport && !getIssuanceGuideForDoc(doc.docCode));
        if (!isLawyer) return false;
      }

      // 4. 검색어 매칭
      const matchQuery = 
        !searchQuery.trim() ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.docCode.includes(searchQuery) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchQuery) return false;

      // 5. COLD(특수·딥아카이브) 필터
      const isCold = docTier === 'COLD';
      const allowCold = includeColdArchive || !!searchQuery.trim() || selectedCategory === 'APPEAL';
      if (isCold && !allowCold) {
        return false;
      }

      return true;
    });
  }, [activeTab, searchQuery, selectedCategory, selectedNature, includeColdArchive, onlyOfficialCourt, onlyPendingUpload]);

  // 대법원 정식 서식 HWPX/XLSX/PDF 다운로드 핸들러
  const handleDownloadHwpx = (doc: LegalDocItem) => {
    if (!doc.downloadUrl) {
      toast.error('해당 서식의 원본 파일이 준비되지 않았습니다.');
      return;
    }
    const link = document.createElement('a');
    link.href = doc.downloadUrl;
    link.download = doc.hwpxFileName || `${doc.title}.hwpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const ext = doc.hwpxFileName?.endsWith('.xlsx') ? 'XLSX' : doc.hwpxFileName?.endsWith('.pdf') ? 'PDF' : 'HWPX';
    toast.success(`'${doc.title}' 정식 서식 파일(${ext})을 다운로드했습니다.`);
  };

  // 의뢰인에게 작성 요청 (H-14): 서버에 요청을 만들고 의뢰인 '내 사건'에 알림
  // 이전: 변호사 브라우저에만 저장 + 의뢰인이 열 수 없는 /mobile-doc?token= 링크 복사
  const canRequestFromClient = (doc: LegalDocItem) => !!officeId && !!clientFormSchemaFor(doc.docCode);
  const handleRequestClientForm = async (doc: LegalDocItem) => {
    const schema = clientFormSchemaFor(doc.docCode);
    if (!officeId || !schema) {
      toast.error('이 서식은 아직 의뢰인 작성 칸이 없어요. 사무소에서 직접 작성해 주세요.');
      return;
    }
    setRequestingCode(doc.docCode);
    const r = await requestClientForm(officeId, clientRequest.id, schema);
    setRequestingCode(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`'${schema.title}' 작성을 요청했어요. 의뢰인이 로그인하면 '내 사건'에서 작성할 수 있어요.`);
    setActiveTab('mobile');
  };

  // 카테고리 필터 목록
  const categories: { key: DocCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: '전체', count: ALL_LEGAL_DOC_REGISTRY.length },
    { key: 'CORE', label: '본신청·기본 서식', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORE').length },
    { key: 'STAY_INJUNCT', label: '중지·금지명령', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'STAY_INJUNCT').length },
    { key: 'CORRECTION', label: '보정명령·실무 보정례', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORRECTION').length },
    { key: 'MODIFICATION', label: '채권·변제계획 수정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'MODIFICATION').length },
    { key: 'RELEASE', label: '면책·압류해제', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'RELEASE').length },
    { key: 'SERVICE', label: '송달·주소보정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'SERVICE').length },
    { key: 'EVIDENCE', label: '소명·부속 서식', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'EVIDENCE').length },
    { key: 'APPEAL', label: '항고·이의·쟁송', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'APPEAL').length }
  ];

  // 서류 개수 집계
  const countAll = ALL_LEGAL_DOC_REGISTRY.length;
  const countRehab = ALL_LEGAL_DOC_REGISTRY.filter(d => d.caseScope === 'REHAB' || d.caseScope === 'COMMON').length;
  const countBankruptcy = ALL_LEGAL_DOC_REGISTRY.filter(d => d.caseScope === 'BANKRUPTCY' || d.caseScope === 'COMMON').length;
  const countCommon = ALL_LEGAL_DOC_REGISTRY.filter(d => d.caseScope === 'COMMON').length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-extrabold text-lg">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  법원 서식 허브
                </h3>
                <span className="text-xs bg-slate-700 text-slate-200 font-bold px-2 py-0.5 rounded-full">
                  작성기 · 빈 공식 양식 · 발급 안내
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{clientName}</strong> · 사건: {caseNumber} ({courtName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCourtDocSuite(true)}
              className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
              title="신청서·채권자목록·재산목록 등 핵심 서식을 사건 정보로 채워 고치고 인쇄합니다."
            >
              <Printer className="w-3.5 h-3.5" />
              <span>핵심 서식 편집기</span>
            </button>
            {onOpenBatchFiling && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBatchFiling();
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>전자소송 일괄 결합실</span>
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션: 1축(사건 관할 범위) + 스마트 추천 + 모바일 관리 */}
        <div className="px-6 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between shrink-0 overflow-x-auto">
          <div className="flex gap-1.5 py-1">
            <button
              onClick={() => setActiveTab('recommend')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'recommend'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>🎯 이 사건 서식 ({recommendations.criticalList.length + recommendations.conditionalList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>📂 전체 ({countAll})</span>
            </button>

            <button
              onClick={() => setActiveTab('rehab')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'rehab'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>💼 회생 ({countRehab})</span>
            </button>

            <button
              onClick={() => setActiveTab('bankruptcy')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'bankruptcy'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>⚖️ 파산 ({countBankruptcy})</span>
            </button>

            <button
              onClick={() => setActiveTab('common')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'common'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>🌐 공통 서식 ({countCommon})</span>
            </button>

            <button
              onClick={() => setActiveTab('mobile')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'mobile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 의뢰인 작성 요청{openFormCount ? ` (${openFormCount})` : ''}</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden lg:block shrink-0 pl-3">
            담당: {activeLawyerName} 변호사
          </div>
        </div>

        {/* 탭 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* ══════════ [1] 사건 맞춤 스마트 추천 탭 ══════════ */}
          {activeTab === 'recommend' && (
            <div className="space-y-6">
              {/* 상단 안내 배너 */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-extrabold text-sm">
                    사건 종류·소득 유형·주거 형태·사건 단계로 골라 본 서식이에요. 최종 판단은 담당 변호사가 해 주세요.
                  </p>
                  <p className="text-blue-700">
                    <strong>발급형 서류</strong>는 발급처·유의사항을 바로 확인하고, <strong>의뢰인 작성 서류</strong>는 의뢰인 &apos;내 사건&apos;으로 작성 요청을 보내거나 사무소에서 직접 작성할 수 있어요. HWPX 버튼은 사건 내용이 채워지지 않은 빈 공식 양식이에요.
                  </p>
                </div>
              </div>

              {/* 1) 즉시 제출 권장 서식 (CRITICAL) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h4 className="font-extrabold text-sm text-slate-900">
                    🚨 즉시 신청·제출 필수 서식 ({recommendations.criticalList.length}건)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {recommendations.criticalList.map(doc => {
                    const hasIssuanceGuide = !!getIssuanceGuideForDoc(doc.docCode) || !!getIssuanceGuideForDoc(doc.title) || doc.docTypeNature === 'ISSUED_BY_AGENCY';
                    const isSelfWritten = doc.docTypeNature === 'SELF_WRITTEN' || doc.isClientMobileSupport;

                    return (
                      <div 
                        key={doc.docCode}
                        className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-400 transition-all shadow-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-xs font-mono font-bold text-slate-500">#{doc.docCode}</span>
                            <div className="flex items-center gap-1.5">
                              {/* 2축 성격 뱃지 */}
                              {hasIssuanceGuide && (
                                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md">
                                  ✍️ 자가작성
                                </span>
                              )}
                              <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                                필수 권장
                              </span>
                            </div>
                          </div>
                          <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                          
                          {recommendations.reasonMap[doc.docCode] && (
                            <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/80 text-xs text-amber-900 font-medium">
                              💡 <strong>나온 이유:</strong> {recommendations.reasonMap[doc.docCode]}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-2">
                          <span className="text-xs text-slate-400 font-mono">
                            {doc.isClientMobileSupport ? '📱 모바일 서명 지원' : hasIssuanceGuide ? '🏛️ 관공서 발급 대상' : '⚖️ 대리인 날인 양식'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasIssuanceGuide && (
                              <button
                                onClick={() => setSelectedGuideDoc(doc)}
                                className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>발급안내</span>
                              </button>
                            )}
                            {canRequestFromClient(doc) && (
                              <button
                                onClick={() => void handleRequestClientForm(doc)}
                                disabled={requestingCode === doc.docCode}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>의뢰인에게 작성 요청</span>
                              </button>
                            )}
                            {doc.downloadUrl && doc.hasOfficialFormFile && (
                              <button
                                onClick={() => handleDownloadHwpx(doc)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                                title={`${doc.hwpxFileName || '법원 서식'} 원본 파일 다운로드`}
                              >
                                <Download className="w-3 h-3 text-slate-600" />
                                <span>{doc.hwpxFileName?.endsWith('.xlsx') ? 'XLSX' : doc.hwpxFileName?.endsWith('.pdf') ? 'PDF' : 'HWPX'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => setEditingDoc(doc)}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1 press-scale cursor-pointer shadow-xs"
                            >
                              <span>서식 열기</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2) 상황별 소명 및 보정 대비 서식 (CONDITIONAL) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h4 className="font-extrabold text-sm text-slate-900">
                    ⚠️ 상황별 소명 및 법원 보정 대비 서식 ({recommendations.conditionalList.length}건)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {recommendations.conditionalList.map(doc => {
                    const hasIssuanceGuide = !!getIssuanceGuideForDoc(doc.docCode) || !!getIssuanceGuideForDoc(doc.title) || doc.docTypeNature === 'ISSUED_BY_AGENCY';
                    const isSelfWritten = doc.docTypeNature === 'SELF_WRITTEN' || doc.isClientMobileSupport;

                    return (
                      <div 
                        key={doc.docCode}
                        className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-xs font-mono font-bold text-slate-500">#{doc.docCode}</span>
                            <div className="flex items-center gap-1.5">
                              {hasIssuanceGuide && (
                                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md">
                                  ✍️ 자가작성
                                </span>
                              )}
                              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                {doc.category}
                              </span>
                            </div>
                          </div>
                          <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                          
                          {recommendations.reasonMap[doc.docCode] && (
                            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs text-slate-700">
                              🔍 <strong>배경:</strong> {recommendations.reasonMap[doc.docCode]}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-2">
                          <span className="text-xs text-slate-400 font-mono">
                            {doc.isClientMobileSupport ? '📱 의뢰인 자가작성 지원' : hasIssuanceGuide ? '🏛️ 외부 발급 서류' : '변호사 보정서 작성'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasIssuanceGuide && (
                              <button
                                onClick={() => setSelectedGuideDoc(doc)}
                                className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>발급안내</span>
                              </button>
                            )}
                            {canRequestFromClient(doc) && (
                              <button
                                onClick={() => void handleRequestClientForm(doc)}
                                disabled={requestingCode === doc.docCode}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>의뢰인에게 작성 요청</span>
                              </button>
                            )}
                            {doc.downloadUrl && doc.hasOfficialFormFile && (
                              <button
                                onClick={() => handleDownloadHwpx(doc)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg press-scale cursor-pointer flex items-center gap-1 shadow-xs"
                                title={`${doc.hwpxFileName || '법원 서식'} 원본 파일 다운로드`}
                              >
                                <Download className="w-3 h-3 text-slate-600" />
                                <span>{doc.hwpxFileName?.endsWith('.xlsx') ? 'XLSX' : doc.hwpxFileName?.endsWith('.pdf') ? 'PDF' : 'HWPX'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => setEditingDoc(doc)}
                              className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 press-scale cursor-pointer"
                            >
                              <span>서식 열기</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [2] 서식 라이브러리 브라우징 (all, rehab, bankruptcy, common) ══════════ */}
          {(activeTab === 'all' || activeTab === 'rehab' || activeTab === 'bankruptcy' || activeTab === 'common') && (
            <div className="space-y-4">
              {/* 검색 및 2축(서류 성격) + 카테고리 필터 바 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="문서명 또는 번호 검색 (예: 121150, 금지명령, 전세보증금, 무상거주, 사채, 압류해제)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* 대법원 정식 서식만 보기 토글 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        setOnlyOfficialCourt(!onlyOfficialCourt);
                        if (!onlyOfficialCourt) setOnlyPendingUpload(false);
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer transition-all shrink-0 select-none ${
                        onlyOfficialCourt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100/70'
                      }`}
                    >
                      <span>🏛️ 대법원 정식 서식</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                        onlyOfficialCourt ? 'bg-white/25 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {ALL_LEGAL_DOC_REGISTRY.filter(d => d.isOfficialCourtForm).length}
                      </span>
                    </button>

                    {/* 서식 미등록 (업로드 대기)만 보기 토글 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        setOnlyPendingUpload(!onlyPendingUpload);
                        if (!onlyPendingUpload) setOnlyOfficialCourt(false);
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer transition-all shrink-0 select-none ${
                        onlyPendingUpload
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-amber-50/70 text-amber-800 border-amber-300 hover:bg-amber-100/70'
                      }`}
                      title="아직 HWPX 원본 파일이 등록되지 않은 실무 서식 목록만 필터링합니다 (추후 업로드용)"
                    >
                      <span>📁 서식 미등록 (대기)</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                        onlyPendingUpload ? 'bg-white/25 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        {ALL_LEGAL_DOC_REGISTRY.filter(d => d.isPendingUpload).length}
                      </span>
                    </button>

                    {/* Cold Storage 딥아카이브 토글 스위치 */}
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100/80 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-200/80 transition-colors shrink-0 select-none">
                      <input
                        type="checkbox"
                        checked={includeColdArchive}
                        onChange={e => setIncludeColdArchive(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>📦 딥아카이브</span>
                    </label>
                  </div>
                </div>

                {/* 2축: 서류 성격 필터 (발급형 vs 자가작성형 vs 변호사작성) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 mr-1">서류 성격:</span>
                  {[
                    { key: 'ALL', label: '전체 성격' },
                    { key: 'ISSUED_BY_AGENCY', label: '🏛️ 관공서·기관 발급형' },
                    { key: 'SELF_WRITTEN', label: '✍️ 의뢰인 자가작성형 (모바일)' },
                    { key: 'LAWYER_COURT', label: '⚖️ 대리인·법원 전산서식' }
                  ].map(n => (
                    <button
                      key={n.key}
                      onClick={() => setSelectedNature(n.key as any)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        selectedNature === n.key
                          ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>

                {/* 법원 절차 카테고리 필터 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCategory(c.key)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        selectedCategory === c.key
                          ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* 검색 결과 목록 테이블 / 카드 */}
              {filteredAllDocs.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-sm text-slate-700">검색 조건에 일치하는 서식이 없습니다.</p>
                  <p className="text-xs text-slate-400">검색어를 변경하거나 '특수·쟁송 딥아카이브 포함' 체크를 확인해 보세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredAllDocs.map(doc => {
                    const docTier = getDocumentTier(doc);
                    const hasIssuanceGuide = !!getIssuanceGuideForDoc(doc.docCode) || !!getIssuanceGuideForDoc(doc.title) || doc.docTypeNature === 'ISSUED_BY_AGENCY';
                    const isSelfWritten = doc.docTypeNature === 'SELF_WRITTEN' || doc.isClientMobileSupport;

                    return (
                      <div
                        key={doc.docCode}
                        className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-xs font-mono font-bold text-slate-400">#{doc.docCode}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* 관할 뱃지 */}
                              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                {doc.caseScope === 'REHAB' ? '💼 회생' : doc.caseScope === 'BANKRUPTCY' ? '⚖️ 파산' : '🌐 공통'}
                              </span>
                              {/* 대법원 정식 서식 뱃지 */}
                              {doc.isOfficialCourtForm && (
                                <span 
                                  className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xs"
                                  title={doc.officialSourceNote || '대법원/회생법원 정식 서식'}
                                >
                                  🏛️ 정식서식
                                </span>
                              )}
                              {/* 실무 커스텀 서식 (파일 보유) 뱃지 */}
                              {doc.isPracticeCustomTemplate && doc.hasOfficialFormFile && (
                                <span 
                                  className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xs"
                                  title={doc.officialSourceNote || '실무 소명 및 보정 대체 양식'}
                                >
                                  📄 실무서식
                                </span>
                              )}
                              {/* 서식 미등록 (업로드 대기) 뱃지 */}
                              {doc.isPendingUpload && (
                                <span 
                                  className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xs"
                                  title="아직 HWPX 파일이 등록되지 않은 실무 서식입니다 (추후 법원양식 폴더 업로드 대상)"
                                >
                                  📁 서식 미등록 (대기)
                                </span>
                              )}
                              {/* 성격 뱃지 */}
                              {hasIssuanceGuide && (
                                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                                  ✍️ 자가작성
                                </span>
                              )}
                              {docTier === 'COLD' && (
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                  📦 딥보관
                                </span>
                              )}
                            </div>
                          </div>
                          <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1 flex items-center gap-1.5">
                            <span>{doc.title}</span>
                          </h5>
                          {doc.isPendingUpload ? (
                            <p className="text-[11px] text-amber-700 font-semibold line-clamp-1 flex items-center gap-1">
                              <span>⏳ 서식 파일 미등록 (법원양식 폴더 업로드 대기)</span>
                            </p>
                          ) : doc.officialSourceNote ? (
                            <p className="text-[11px] text-blue-600/80 font-medium line-clamp-1">
                              출처: {doc.officialSourceNote}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{doc.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-1.5">
                          <div className="flex items-center gap-1">
                            {hasIssuanceGuide && (
                              <button
                                onClick={() => setSelectedGuideDoc(doc)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                                title="어디서 어떻게 발급받는지 안내 팝업을 엽니다."
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>발급안내</span>
                              </button>
                            )}
                            {canRequestFromClient(doc) && (
                              <button
                                onClick={() => void handleRequestClientForm(doc)}
                                disabled={requestingCode === doc.docCode}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer ml-1 whitespace-nowrap disabled:opacity-50"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>작성 요청</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* HWPX / XLSX / PDF 원본 다운로드 버튼 */}
                            {doc.downloadUrl && doc.hasOfficialFormFile ? (
                              <button
                                onClick={() => handleDownloadHwpx(doc)}
                                className="px-2 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                                title={`${doc.hwpxFileName || '법원 서식'} 원본 파일 다운로드`}
                              >
                                <Download className="w-3 h-3 text-slate-600" />
                                <span>{doc.hwpxFileName?.endsWith('.xlsx') ? 'XLSX' : doc.hwpxFileName?.endsWith('.pdf') ? 'PDF' : 'HWPX'}</span>
                              </button>
                            ) : doc.isPendingUpload ? (
                              <button
                                onClick={() => toast.info(`'${doc.title}'은(는) 아직 서식 파일이 등록되지 않았습니다.\n'법원양식' 폴더에 해당 HWPX 파일을 추가하시면 즉시 다운로드가 활성화됩니다.`)}
                                className="px-2 py-1 text-xs font-semibold text-amber-700/90 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-lg cursor-pointer flex items-center gap-1"
                                title="서식 파일 업로드 대기 중 (클릭 시 안내)"
                              >
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>업로드 대기</span>
                              </button>
                            ) : null}

                            <button
                              onClick={() => setEditingDoc(doc)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg press-scale cursor-pointer"
                            >
                              서식열기
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════ [3] 의뢰인 작성 요청 (서버, H-14) ══════════ */}
          {activeTab === 'mobile' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>의뢰인 작성 요청</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  의뢰인이 로그인해 '내 사건'에서 작성하고 보낸 내용을 확인해요. 주민등록번호는 받지 않아요. 집 명의자처럼 다른 사람 서명이 필요한 서류는 의뢰인이 출력해 서명받은 사진을 올려요.
                </p>
              </div>
              {officeId ? (
                <ClientFormRequestsPanel officeId={officeId} caseKey={clientRequest.id} onCountChange={setOpenFormCount} />
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-xs text-slate-600">
                  사무소 정보를 불러오지 못해 작성 요청을 쓸 수 없어요. 다시 로그인해 주세요.
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* 🏛️ 관공서 발급형 서류 안내 팝업 모달 */}
      {selectedGuideDoc && (() => {
        const guide = getIssuanceGuideForDoc(selectedGuideDoc.docCode) || getIssuanceGuideForDoc(selectedGuideDoc.title) || selectedGuideDoc.issuanceGuide;
        return (
          <DocumentIssuanceGuideModal
            isOpen={!!selectedGuideDoc}
            onClose={() => setSelectedGuideDoc(null)}
            docTitle={selectedGuideDoc.title}
            docCode={selectedGuideDoc.docCode}
            agencyName={guide?.agencyName || '정부24 / 해당 관공서'}
            agencyUrl={guide?.agencyUrl || 'https://www.gov.kr'}
            agencyPhone={guide?.agencyPhone}
            steps={guide?.issuanceSteps}
            tips={guide?.tips || selectedGuideDoc.description}
            maskingRequired={guide?.maskingRequired ?? true}
            validityPeriod={guide?.validityPeriod}
            clientName={clientName}
            onUploadFile={(file) => {
              // 이 안내 화면은 파일을 저장하지 않는다 (이전: '성공적으로 접수' 안내만 표시)
              toast.info(`'${file.name}'을 선택했습니다. 이 화면은 파일을 저장하지 않으니 [서류함]에서 업로드해 주세요.`);
              setSelectedGuideDoc(null);
            }}
          />
        );
      })()}

      {/* 서식 에디터 모달 (D5102, D5103 전용 에디터 및 범용 에디터 분기) */}
      {editingDoc && editingDoc.docCode === 'D5102' ? (
        <PropertyValuationModal
          isOpen={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          clientId={clientRequest.id}
          clientRequest={clientRequest}
          crmExt={crmExt}
          onUpdateCrmExt={onUpdateCrmExt || noSavePath}
        />
      ) : editingDoc && editingDoc.docCode === 'D5103' ? (
        <IncomeExpenseModal
          isOpen={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          clientId={clientRequest.id}
          clientRequest={clientRequest}
          crmExt={crmExt}
          onUpdateCrmExt={onUpdateCrmExt || noSavePath}
          activeLawyerName={activeLawyerName}
          onOpenBatchFiling={onOpenBatchFiling}
        />
      ) : editingDoc && (
        <DocFormEditorModal
          isOpen={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          docItem={editingDoc}
          clientRequest={clientRequest}
          crmExt={crmExt}
          activeLawyerName={activeLawyerName}
          officeId={officeId}
          onSavedToCase={(file) => {
            // 사건 자료함 사본에 정보만 더해 묶음(편철)이 이 PDF를 찾게 한다 (본문은 저장소에 있음)
            if (onUpdateCrmExt) void onUpdateCrmExt({ uploadedFiles: [...(crmExt.uploadedFiles || []), file] }).catch(() => toast.error('사건 자료함 목록을 갱신하지 못했어요. 새로고침하면 서류 자료함에서 보여요.'));
            onCaseFilesChanged?.();
          }}
          onRequestClientForm={canRequestFromClient(editingDoc) ? () => void handleRequestClientForm(editingDoc) : undefined}
        />
      )}

      {/* 대법원 전자소송 13종 법원 표준 서식 통합 에디터 & 인쇄 뷰어 (오토로 규격) */}
      {showCourtDocSuite && (
        <CourtDocSuiteViewerModal
          isOpen={showCourtDocSuite}
          onClose={() => setShowCourtDocSuite(false)}
          clientRequest={clientRequest}
          crmExt={crmExt}
          activeLawyerName={activeLawyerName}
          onUpdateCrmExt={onUpdateCrmExt}
        />
      )}
      </div>
    </ModalPortal>
  );
}

/** 닫힌 상태에서는 내부 훅을 실행하지 않도록 바깥에서 먼저 분기 (Rules of Hooks: 조건부 return을 훅보다 앞에 두지 않음) */
export default function LegalDocHubModal(props: React.ComponentProps<typeof LegalDocHubModalInner>) {
  if (!props.isOpen) return null;
  return <LegalDocHubModalInner {...props} />;
}
