import React, { useState, useMemo } from 'react';
import { 
  X, Search, Sparkles, FileText, Send, CheckCircle2, 
  AlertTriangle, Download, ArrowRight, ShieldCheck, 
  Layers, Filter, Clock, ExternalLink, Smartphone, Copy, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ALL_LEGAL_DOC_REGISTRY, 
  getSmartRecommendedDocs, 
  getDocumentTier,
  type LegalDocItem, 
  type DocCategory 
} from '../../../services/documents/legalDocRegistry';
import { 
  ClientMobileDocService, 
  type MobileDocRequestItem 
} from '../../../services/documents/clientMobileDocService';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import DocFormEditorModal from './DocFormEditorModal';
import MobileDocFillView from '../../client/MobileDocFillView';

interface LegalDocHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
  onOpenBatchFiling?: () => void;
  onAttachDocToPackage?: (docName: string, textContent: string) => void;
}

export default function LegalDocHubModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호',
  onOpenBatchFiling,
  onAttachDocToPackage
}: LegalDocHubModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || '2026개회 50284호';

  const [activeTab, setActiveTab] = useState<'recommend' | 'all' | 'mobile' | 'bundle'>('recommend');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'ALL'>('ALL');

  // 특정 서식 에디터 모달 상태
  const [editingDoc, setEditingDoc] = useState<LegalDocItem | null>(null);

  // 모바일 작성 뷰 시뮬레이션 토큰 모달 상태
  const [mobilePreviewToken, setMobilePreviewToken] = useState<string | null>(null);

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

  // 전체 서식 검색 및 필터 (Hot/Warm vs Cold 딥아카이브 분리)
  const filteredAllDocs = useMemo(() => {
    return ALL_LEGAL_DOC_REGISTRY.filter(doc => {
      const docTier = getDocumentTier(doc);
      const matchCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
      const matchQuery = 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.docCode.includes(searchQuery) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase());

      // COLD(특수·딥아카이브)는 검색어가 있거나 토글이 켜져 있을 때만 인출 (평소 UI 클린 유지)
      const isCold = docTier === 'COLD';
      const allowCold = includeColdArchive || !!searchQuery.trim() || selectedCategory === 'APPEAL';
      if (isCold && !allowCold) {
        return false;
      }

      return matchCategory && matchQuery;
    });
  }, [searchQuery, selectedCategory, includeColdArchive]);

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

  const categories: { key: DocCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: '전체 (80종)', count: ALL_LEGAL_DOC_REGISTRY.length },
    { key: 'STAY_INJUNCT', label: '중지·금지명령', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'STAY_INJUNCT').length },
    { key: 'CORRECTION', label: '보정명령 핵심 14종', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORRECTION').length },
    { key: 'RELEASE', label: '인가 후 압류해제 8종', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'RELEASE').length },
    { key: 'EVIDENCE', label: '소명·부속 서식', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'EVIDENCE').length },
    { key: 'SERVICE', label: '송달·주소보정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'SERVICE').length },
    { key: 'MODIFICATION', label: '채권·변제 수정', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'MODIFICATION').length },
    { key: 'APPEAL', label: '항고·이의·쟁송', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'APPEAL').length },
    { key: 'CORE', label: '본신청 기본', count: ALL_LEGAL_DOC_REGISTRY.filter(d => d.category === 'CORE').length }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-extrabold text-lg">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  스마트 법원 서식 허브 (80종 라이브러리 & 전자소송 자동화)
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

        {/* 탭 네비게이션 */}
        <div className="px-6 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('recommend')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'recommend'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-xs rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>🎯 사건 맞춤 스마트 추천 ({recommendations.criticalList.length + recommendations.conditionalList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-xs rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>📂 80종 전체 서식 라이브러리</span>
            </button>

            <button
              onClick={() => setActiveTab('mobile')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mobile'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-xs rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>📱 의뢰인 모바일 요청 관리 ({mobileRequests.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden md:block">
            담당: {activeLawyerName} 변호사
          </div>
        </div>

        {/* 탭 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* ══════════ [1] 사건 맞춤 스마트 추천 탭 ══════════ */}
          {activeTab === 'recommend' && (
            <div className="space-y-6">
              {/* 상단 알림 배너 */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-extrabold text-sm">
                    의뢰인의 직업, 채무 종류, 주거형태, 사건 단계에 맞춰 지금 작성해야 할 서류를 선별했습니다.
                  </p>
                  <p className="text-blue-700">
                    클릭 한 번으로 CRM 데이터가 서식에 100% 자동 채워지며, 의뢰인 서명이 필요한 서류는 알림톡 모바일 링크로 즉시 요청할 수 있습니다.
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
                  {recommendations.criticalList.map(doc => (
                    <div 
                      key={doc.docCode}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-400 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-500">#{doc.docCode}</span>
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                            필수 권장
                          </span>
                        </div>
                        <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                        <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                        
                        {recommendations.reasonMap[doc.docCode] && (
                          <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/80 text-[11px] text-amber-900 font-medium">
                            💡 <strong>추천 사유:</strong> {recommendations.reasonMap[doc.docCode]}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {doc.isClientMobileSupport ? '📱 모바일 서명 지원' : '⚖️ 대리인 날인 양식'}
                        </span>
                        <div className="flex items-center gap-2">
                          {doc.isClientMobileSupport && (
                            <button
                              onClick={() => handleSendMobileRequest(doc)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer"
                            >
                              모바일 요청
                            </button>
                          )}
                          <button
                            onClick={() => setEditingDoc(doc)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1 press-scale cursor-pointer shadow-xs"
                          >
                            <span>자동 작성</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                  {recommendations.conditionalList.map(doc => (
                    <div 
                      key={doc.docCode}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-500">#{doc.docCode}</span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                            {doc.category}
                          </span>
                        </div>
                        <h5 className="font-extrabold text-sm text-slate-900">{doc.title}</h5>
                        <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>
                        
                        {recommendations.reasonMap[doc.docCode] && (
                          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-[11px] text-slate-700">
                            🔍 <strong>배경:</strong> {recommendations.reasonMap[doc.docCode]}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {doc.isClientMobileSupport ? '📱 의뢰인 자가작성 지원' : '변호사 보정서 작성'}
                        </span>
                        <div className="flex items-center gap-2">
                          {doc.isClientMobileSupport && (
                            <button
                              onClick={() => handleSendMobileRequest(doc)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg press-scale cursor-pointer"
                            >
                              모바일 요청
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
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [2] 80종 전체 서식 라이브러리 탭 ══════════ */}
          {activeTab === 'all' && (
            <div className="space-y-4">
              {/* 검색 및 카테고리 필터 바 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="문서명 또는 번호 검색 (예: 121150, 금지명령, 전세보증금, 압류해제, 사채)..."
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

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCategory(c.key)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCategory === c.key
                          ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* 검색 결과 목록 테이블 / 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAllDocs.map(doc => {
                  const docTier = getDocumentTier(doc);
                  return (
                    <div
                      key={doc.docCode}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-400">#{doc.docCode}</span>
                          <div className="flex items-center gap-1">
                            {docTier === 'COLD' && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                📦 특수보관
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                              {doc.category}
                            </span>
                          </div>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1">{doc.title}</h5>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{doc.description}</p>
                      </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
                      {doc.isClientMobileSupport ? (
                        <button
                          onClick={() => handleSendMobileRequest(doc)}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>모바일 요청</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">전자소송 정규양식</span>
                      )}
                      <button
                        onClick={() => setEditingDoc(doc)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg press-scale cursor-pointer"
                      >
                        작성 및 인쇄
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
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
                    '스마트 추천' 또는 '전체 서식' 탭에서 [모바일 요청]을 누르면 의뢰인용 알림톡 링크가 생성됩니다.
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

      {/* 서식 에디터 모달 */}
      {editingDoc && (
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

    </div>
  );
}
