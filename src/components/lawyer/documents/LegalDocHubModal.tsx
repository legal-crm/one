import React, { useState, useMemo } from 'react';
import { 
  X, Search, Sparkles, FileText, Send, CheckCircle2, 
  AlertTriangle, Download, ArrowRight, ShieldCheck, 
  Layers, Filter, Clock, ExternalLink, Smartphone, Copy, Plus, Printer, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
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
import { 
  ClientMobileDocService, 
  type MobileDocRequestItem 
} from '../../../services/documents/clientMobileDocService';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import DocFormEditorModal from './DocFormEditorModal';
import MobileDocFillView from '../../client/MobileDocFillView';
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
  onAttachDocToPackage?: (docName: string, textContent: string) => void;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
}

type TabKey = 'recommend' | 'all' | 'rehab' | 'bankruptcy' | 'common' | 'mobile';

export default function LegalDocHubModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호',
  onOpenBatchFiling,
  onAttachDocToPackage,
  onUpdateCrmExt
}: LegalDocHubModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || '2026개회 50284호';

  const [activeTab, setActiveTab] = useState<TabKey>('recommend');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'ALL'>('ALL');
  const [selectedNature, setSelectedNature] = useState<'ALL' | DocTypeNature>('ALL');

  // 특정 서식 에디터 모달 상태
  const [editingDoc, setEditingDoc] = useState<LegalDocItem | null>(null);

  // 발급 안내 모달 상태
  const [selectedGuideDoc, setSelectedGuideDoc] = useState<LegalDocItem | null>(null);

  // 모바일 작성 뷰 시뮬레이션 토큰 모달 상태
  const [mobilePreviewToken, setMobilePreviewToken] = useState<string | null>(null);

  // 13종 법원 표준 서식 통합 웹 에디터/인쇄 모달 상태 (오토로 규격)
  const [showCourtDocSuite, setShowCourtDocSuite] = useState(false);

  // 스마트 추천 서식 계산
  const recommendations = useMemo(() => {
    return getSmartRecommendedDocs(clientRequest, crmExt);
  }, [clientRequest, crmExt]);

  // 의뢰인 모바일 요청 목록
  const [mobileRequests, setMobileRequests] = useState<MobileDocRequestItem[]>(() => {
    return ClientMobileDocService.getRequests(clientRequest.id);
  });

  const refreshMobileRequests = () => {
    setMobileRequests(ClientMobileDocService.getRequests(clientRequest.id));
  };

  const [includeColdArchive, setIncludeColdArchive] = useState(false);

  // 서류 목록 필터 (사건 관할 범위 + 서류 성격 + 카테고리 + 검색어 + Cold Archive)
  const filteredAllDocs = useMemo(() => {
    return ALL_LEGAL_DOC_REGISTRY.filter(doc => {
      const docTier = getDocumentTier(doc);

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
  }, [activeTab, searchQuery, selectedCategory, selectedNature, includeColdArchive]);

  // 모바일 작성 요청 발송 핸들러
  const handleSendMobileRequest = (doc: LegalDocItem) => {
    const req = ClientMobileDocService.createRequest(
      clientRequest.id,
      clientName,
      clientRequest.phone || '010-0000-0000',
      doc.docCode,
      doc.title
    );
    refreshMobileRequests();
    const msg = ClientMobileDocService.generateNotificationMessage(req);
    navigator.clipboard.writeText(msg);
    toast.success(`📱 '${doc.title}' 모바일 서류 작성 요청이 생성되고 알림톡 문구가 복사되었습니다.`);
  };

  // 모바일 작성 뷰 즉시 테스트 (시뮬레이터)
  const handleSimulateMobileFill = (doc: LegalDocItem) => {
    const req = ClientMobileDocService.createRequest(
      clientRequest.id,
      clientName,
      clientRequest.phone || '010-0000-0000',
      doc.docCode,
      doc.title
    );
    refreshMobileRequests();
    setMobilePreviewToken(req.token);
  };

  // 카테고리 필터 목록
  const categories: { key: DocCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: '전체', count: ALL_LEGAL_DOC_REGISTRY.length },
    { key: 'STAY_INJUNCT', label: '중지·금지명령', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'STAY_INJUNCT').length },
    { key: 'CORRECTION', label: '보정명령 핵심 14종', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORRECTION').length },
    { key: 'RELEASE', label: '인가 후 압류해제 8종', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'RELEASE').length },
    { key: 'EVIDENCE', label: '소명·부속 서식', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'EVIDENCE').length },
    { key: 'SERVICE', label: '송달·주소보정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'SERVICE').length },
    { key: 'MODIFICATION', label: '채권·변제 수정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'MODIFICATION').length },
    { key: 'APPEAL', label: '항고·이의·쟁송', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'APPEAL').length },
    { key: 'CORE', label: '본신청 기본', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORE').length }
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
                  스마트 법원 서식 허브 (80여 종 분류 체계 & 발급/작성 자동화)
                </h3>
                <span className="text-[10px] bg-blue-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                  AUTO-FILING PRO
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
              title="13종 법원표준서식(35p)을 브라우저에서 직접 수기 수정(WYSIWYG)하고 인쇄 및 PDF로 내보냅니다."
            >
              <Printer className="w-3.5 h-3.5" />
              <span>13종 법원서식 에디터</span>
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
              <span>🎯 스마트 추천 ({recommendations.criticalList.length + recommendations.conditionalList.length})</span>
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
              <span>💼 개인회생 전용 ({countRehab})</span>
            </button>

            <button
              onClick={() => setActiveTab('bankruptcy')}
              className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xl ${
                activeTab === 'bankruptcy'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>⚖️ 개인파산 전용 ({countBankruptcy})</span>
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
              <span>📱 모바일 요청 ({mobileRequests.length})</span>
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
                    의뢰인의 직업, 채무 종류, 주거형태, 사건 단계에 맞춰 지금 작성해야 할 서류를 선별했습니다.
                  </p>
                  <p className="text-blue-700">
                    <strong>발급형 서류</strong>는 발급처 및 유의사항 안내를 바로 팝업으로 확인하고, <strong>자가작성형 서류</strong>는 알림톡으로 의뢰인 모바일 작성을 요청하거나 법원 표준 A4 서식으로 즉시 작성할 수 있습니다.
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
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md">
                                  ✍️ 자가작성
                                </span>
                              )}
                              <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                                필수 권장
                              </span>
                            </div>
                          </div>
                          <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                          
                          {recommendations.reasonMap[doc.docCode] && (
                            <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/80 text-[11px] text-amber-900 font-medium">
                              💡 <strong>추천 사유:</strong> {recommendations.reasonMap[doc.docCode]}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-2">
                          <span className="text-[11px] text-slate-400 font-mono">
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
                            {isSelfWritten && (
                              <>
                                <button
                                  onClick={() => handleSendMobileRequest(doc)}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  <span>모바일 요청</span>
                                </button>
                                <button
                                  onClick={() => handleSimulateMobileFill(doc)}
                                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg press-scale cursor-pointer"
                                  title="의뢰인이 스마트폰에서 마주할 문답형 위자드를 미리 체험합니다."
                                >
                                  <span>작성 테스트</span>
                                </button>
                              </>
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
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md">
                                  ✍️ 자가작성
                                </span>
                              )}
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                {doc.category}
                              </span>
                            </div>
                          </div>
                          <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                          
                          {recommendations.reasonMap[doc.docCode] && (
                            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-[11px] text-slate-700">
                              🔍 <strong>배경:</strong> {recommendations.reasonMap[doc.docCode]}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-2">
                          <span className="text-[11px] text-slate-400 font-mono">
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
                            {isSelfWritten && (
                              <>
                                <button
                                  onClick={() => handleSendMobileRequest(doc)}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer flex items-center gap-1"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  <span>모바일 요청</span>
                                </button>
                                <button
                                  onClick={() => handleSimulateMobileFill(doc)}
                                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg press-scale cursor-pointer"
                                >
                                  <span>작성 테스트</span>
                                </button>
                              </>
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
                  
                  {/* Cold Storage 딥아카이브 토글 스위치 */}
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100/80 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-200/80 transition-colors shrink-0 select-none">
                    <input
                      type="checkbox"
                      checked={includeColdArchive}
                      onChange={e => setIncludeColdArchive(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>📦 특수·쟁송 딥아카이브 포함</span>
                  </label>
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
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                {doc.caseScope === 'REHAB' ? '💼 회생' : doc.caseScope === 'BANKRUPTCY' ? '⚖️ 파산' : '🌐 공통'}
                              </span>
                              {/* 성격 뱃지 */}
                              {hasIssuanceGuide && (
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  🏛️ 발급형
                                </span>
                              )}
                              {isSelfWritten && (
                                <span className="text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                                  ✍️ 자가작성
                                </span>
                              )}
                              {docTier === 'COLD' && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                  📦 딥보관
                                </span>
                              )}
                            </div>
                          </div>
                          <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1">{doc.title}</h5>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{doc.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3 flex-wrap gap-1.5">
                          <div className="flex items-center gap-1">
                            {hasIssuanceGuide && (
                              <button
                                onClick={() => setSelectedGuideDoc(doc)}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                                title="어디서 어떻게 발급받는지 안내 팝업을 엽니다."
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>발급안내</span>
                              </button>
                            )}
                            {isSelfWritten && (
                              <button
                                onClick={() => handleSendMobileRequest(doc)}
                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer ml-1"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>모바일요청</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {isSelfWritten && (
                              <button
                                onClick={() => handleSimulateMobileFill(doc)}
                                className="px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg press-scale cursor-pointer"
                                title="의뢰인 작성 화면 테스트"
                              >
                                작성체험
                              </button>
                            )}
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

          {/* ══════════ [3] 의뢰인 모바일 요청 관리 탭 ══════════ */}
          {activeTab === 'mobile' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>의뢰인 전용 모바일 작성 및 전자서명 요청 현황</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    의뢰인이 스마트폰에서 직접 입력하고 자필 서명한 서류는 실시간으로 법원 제출 패키지에 자동 반영됩니다.
                  </p>
                </div>
                <button
                  onClick={refreshMobileRequests}
                  className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  새로고침
                </button>
              </div>

              {mobileRequests.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
                  <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
                  <h5 className="font-bold text-sm text-slate-700">발송된 모바일 요청이 없습니다.</h5>
                  <p className="text-xs text-slate-400">
                    '스마트 추천' 또는 서식 라이브러리에서 [모바일 요청]을 누르면 의뢰인용 알림톡 링크가 생성됩니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mobileRequests.map(req => (
                    <div 
                      key={req.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">#{req.docCode}</span>
                          <h5 className="font-bold text-sm text-slate-900">{req.docTitle}</h5>
                          {req.status === 'SUBMITTED' || req.status === 'VERIFIED' ? (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              작성 및 전자서명 완료
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              의뢰인 작성 대기중
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          요청일시: {new Date(req.requestedAt).toLocaleString()} · 의뢰인: {req.clientName} ({req.clientPhone})
                        </p>
                        {req.completedAt && (
                          <p className="text-[11px] text-emerald-600 font-mono">
                            완료일시: {new Date(req.completedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const msg = ClientMobileDocService.generateNotificationMessage(req);
                            navigator.clipboard.writeText(msg);
                            toast.success('알림톡/문자 안내 문구가 복사되었습니다.');
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1 cursor-pointer press-scale"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>링크 복사</span>
                        </button>
                        <button
                          onClick={() => setMobilePreviewToken(req.token)}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer press-scale shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>모바일 뷰 열기</span>
                        </button>
                      </div>
                    </div>
                  ))}
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
              toast.success(`'${selectedGuideDoc.title}' 파일이 성공적으로 접수되었습니다: ${file.name}`);
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
          onUpdateCrmExt={onUpdateCrmExt || (async () => {})}
        />
      ) : editingDoc && editingDoc.docCode === 'D5103' ? (
        <IncomeExpenseModal
          isOpen={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          clientId={clientRequest.id}
          clientRequest={clientRequest}
          crmExt={crmExt}
          onUpdateCrmExt={onUpdateCrmExt || (async () => {})}
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
          onAttachToFilingPackage={onAttachDocToPackage}
          onOpenMobileFillModal={(token) => {
            refreshMobileRequests();
            setMobilePreviewToken(token);
          }}
        />
      )}

      {/* 모바일 작성 뷰 모달 시뮬레이션 */}
      {mobilePreviewToken && (
        <MobileDocFillView
          token={mobilePreviewToken}
          onClose={() => {
            setMobilePreviewToken(null);
            refreshMobileRequests();
          }}
          onComplete={() => {
            refreshMobileRequests();
          }}
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
