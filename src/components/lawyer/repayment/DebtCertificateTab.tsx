import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, Eye, Plus, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, FileText, Image as ImageIcon, ExternalLink,
  ShieldCheck, Calculator, ArrowRight, RotateCw, ZoomIn, ZoomOut, Sparkles, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  DebtCertificateOrder, 
  DebtCertificateItem, 
  DebtIssueStatus,
  RepaymentCreditor 
} from '../../../services/repayment/repaymentTypes';
import { 
  loadDebtCertificateOrder, 
  saveDebtCertificateOrder, 
  exportDebtAgencyExcel,
  exportDebtAgencyZipPackage,
  convertDebtItemsToRepaymentCreditors,
  type AgencyPresetType 
} from '../../../services/repayment/debtCertificateService';
import { downloadDebtPowerOfAttorneyPdf } from '../../../services/repayment/debtPowerOfAttorneyGenerator';

interface DebtCertificateTabProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  onNavigateToRepayment?: () => void;
}

const DEFAULT_AGENCIES = ['원클릭부채대행', '클린부채증명사무소', '윈행정사합동', '한국신용발급대행'];

export default function DebtCertificateTab({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  onNavigateToRepayment,
}: DebtCertificateTabProps) {
  // 주문/발급 데이터 상태
  const [order, setOrder] = useState<DebtCertificateOrder>(() => {
    const loaded = loadDebtCertificateOrder(clientId);
    if (loaded) return loaded;

    // 초기 상담 데이터에서 채권자 추정치 시드
    const initialDebt = clientRequest.financialProfile?.debtTotal || 0;
    const initialItems: DebtCertificateItem[] = [
      {
        id: 'item_1',
        creditorName: '국민은행',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.4),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
      },
      {
        id: 'item_2',
        creditorName: '신한카드',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.35),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
      },
      {
        id: 'item_3',
        creditorName: 'OK저축은행',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.25),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
      },
    ];

    return {
      orderId: `order_${clientId}`,
      clientId,
      clientName: clientRequest.clientName || '의뢰인',
      clientPhone: clientRequest.phone || '',
      agencyName: '원클릭부채대행',
      orderStatus: 'draft',
      items: initialItems,
      createdAt: new Date().toISOString(),
      totalAgencyCost: initialItems.length * 17000,
    };
  });

  // 선택된 항목 (우측 Split View에서 증빙서류 확인 및 세부입력)
  const [selectedItemId, setSelectedItemId] = useState<string>(order.items[0]?.id || '');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotate, setViewerRotate] = useState(0);
  const [agencyPreset, setAgencyPreset] = useState<AgencyPresetType>(
    order.agencyPreset || 'standard'
  );
  const [isZipping, setIsZipping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 저장 동기화
  const handleSaveOrder = (newOrder: DebtCertificateOrder) => {
    setOrder(newOrder);
    saveDebtCertificateOrder(newOrder);
  };

  const selectedItem = useMemo(
    () => order.items.find((i) => i.id === selectedItemId),
    [order.items, selectedItemId]
  );

  // 요약 통계
  const stats = useMemo(() => {
    const totalCount = order.items.length;
    const requestedCount = order.items.filter((i) => i.issueStatus === 'agency_requested').length;
    const completedCount = order.items.filter((i) => i.issueStatus === 'issued' || i.issueStatus === 'confirmed').length;
    const totalExpected = order.items.reduce((s, i) => s + (i.expectedPrincipal || 0), 0);
    const totalConfirmed = order.items.reduce((s, i) => s + (i.confirmedPrincipal || i.expectedPrincipal || 0), 0);
    const totalAgencyFee = order.items.reduce((s, i) => s + (i.agencyFee + i.issuanceFee), 0);

    return {
      totalCount,
      requestedCount,
      completedCount,
      totalExpected,
      totalConfirmed,
      totalAgencyFee,
      progressPct: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  }, [order.items]);

  // 대행사 엑셀 의뢰서 내보내기
  const handleExportAgencyExcel = () => {
    exportDebtAgencyExcel(order, agencyPreset);
    toast.success('대행사 제출용 부채증명서 발급의뢰 엑셀이 다운로드되었습니다.');

    // 상태를 의뢰완료로 일괄 전환할지 자동 반영
    const updatedItems = order.items.map((it) => ({
      ...it,
      issueStatus: it.issueStatus === 'pending' ? ('agency_requested' as DebtIssueStatus) : it.issueStatus,
    }));
    handleSaveOrder({
      ...order,
      orderStatus: 'requested',
      requestedAt: new Date().toISOString().slice(0, 10),
      items: updatedItems,
      agencyPreset,
    });
  };

  // 📦 원클릭 ZIP 압축팩 다운로드
  const handleExportZip = async () => {
    setIsZipping(true);
    try {
      await exportDebtAgencyZipPackage(order, crmExt.uploadedFiles || [], agencyPreset);
      toast.success('대행사 전달용 ZIP 압축팩(의뢰서+위임장+신분증)이 다운로드되었습니다!');
    } catch (err) {
      console.error(err);
      toast.error('압축팩 생성 중 오류가 발생했습니다.');
    } finally {
      setIsZipping(false);
    }
  };

  // 📄 부채증명서 발급 위임장 PDF 직접 다운로드
  const handleDownloadPoa = () => {
    downloadDebtPowerOfAttorneyPdf(order);
    toast.success('부채증명원 발급 위임장 PDF가 다운로드되었습니다.');
  };

  // 신규 채권자 추가
  const handleAddCreditor = () => {
    const newItem: DebtCertificateItem = {
      id: `item_${Date.now()}`,
      creditorName: '신규 채권사',
      expectedPrincipal: 10000000,
      issueStatus: 'pending',
      agencyFee: 15000,
      issuanceFee: 2000,
    };
    const updated = {
      ...order,
      items: [...order.items, newItem],
    };
    handleSaveOrder(updated);
    setSelectedItemId(newItem.id);
    toast.success('새 채권자가 추가되었습니다.');
  };

  // 채권자 삭제
  const handleDeleteCreditor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.items.length <= 1) {
      toast.error('최소 1개 이상의 채권자가 필요합니다.');
      return;
    }
    const updated = {
      ...order,
      items: order.items.filter((i) => i.id !== id),
    };
    handleSaveOrder(updated);
    if (selectedItemId === id) {
      setSelectedItemId(updated.items[0]?.id || '');
    }
    toast.info('채권자가 삭제되었습니다.');
  };

  // 개별 채권자 필드 업데이트
  const handleUpdateItem = (id: string, updates: Partial<DebtCertificateItem>) => {
    const updated = {
      ...order,
      items: order.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    };
    handleSaveOrder(updated);
  };

  // 부채증명서 파일(PDF 또는 이미지) 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItemId) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      toast.error('PDF 문서 또는 이미지 파일(JPG, PNG)만 등록 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleUpdateItem(selectedItemId, {
        certificateDocUrl: result,
        docName: file.name,
        docType: isPdf ? 'pdf' : 'image',
        issueStatus: 'issued',
        issueDate: new Date().toISOString().slice(0, 10),
      });
      toast.success(`${file.name} 부채증명서가 등록되었습니다.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 변제계획안 채권자 목록으로 원클릭 동기화
  const handleSyncToRepayment = async () => {
    const repaymentCreditors = convertDebtItemsToRepaymentCreditors(order.items);
    
    // CRM 확장에 동기화 저장
    await onUpdateCrmExt({
      debtCertificateOrders: [order],
    });

    toast.success(`${repaymentCreditors.length}개 채권자의 부채증명서 데이터가 변제계획안으로 동기화되었습니다!`);
    if (onNavigateToRepayment) {
      onNavigateToRepayment();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-slate-50/50 min-h-[85vh]">
      
      {/* ── 상단 헤더 및 종합 파이프라인 통계 ── */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    부채증명서 발급 대행 관리
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    대행사 연계 워크플로우
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  상담 채권자 조사 ➔ 대행업체 엑셀 의뢰 ➔ 증명서(PDF/이미지) 수신 및 검증 ➔ 변제계획안 원클릭 동기화
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold">발급 대행사:</span>
              <select
                value={order.agencyName}
                onChange={(e) => handleSaveOrder({ ...order, agencyName: e.target.value })}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {DEFAULT_AGENCIES.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold">대행사 서식:</span>
              <select
                value={agencyPreset}
                onChange={(e) => setAgencyPreset(e.target.value as AgencyPresetType)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="standard">표준 법률사무소 서식</option>
                <option value="oneclick">원클릭부채대행 전용</option>
                <option value="winadmin">윈행정사합동 전용</option>
                <option value="koreacredit">한국신용발급 전용</option>
              </select>
            </div>

            <button
              onClick={handleDownloadPoa}
              className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="발급 위임장 PDF 양식 자동 생성"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>위임장 PDF</span>
            </button>

            <button
              onClick={handleExportAgencyExcel}
              className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>엑셀 의뢰서</span>
            </button>

            <button
              onClick={handleExportZip}
              disabled={isZipping}
              className="px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="의뢰서 + 위임장 + 신분증 + 인감을 ZIP 하나로 압축"
            >
              {isZipping ? (
                <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
              ) : (
                <Download className="w-4 h-4 text-purple-600" />
              )}
              <span>{isZipping ? '압축 생성 중...' : '📦 대행사 전달 ZIP 팩'}</span>
            </button>

            <button
              onClick={handleSyncToRepayment}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>변제계획안으로 동기화</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 메트릭 카드 4종 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">발급 대상 기관</span>
              <span className="text-xs font-bold text-indigo-600 font-mono">
                {stats.completedCount}/{stats.totalCount}건
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{stats.totalCount}개사</span>
              <span className="text-xs text-slate-500 font-semibold">
                (진행률 {stats.progressPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${stats.progressPct}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500">조사 예상 채무 총액</span>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono">
              {(stats.totalExpected / 10000).toLocaleString()}만원
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              상담 시 채무자 진술 금액
            </span>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <span className="text-xs font-bold text-indigo-900">증명서 확정 채권 총액</span>
            <div className="mt-2 text-xl font-black text-indigo-700 font-mono">
              {(stats.totalConfirmed / 10000).toLocaleString()}만원
            </div>
            <span className="text-[11px] text-indigo-600/80 mt-1 block">
              부채증명서 실발급 원금 합계
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500">발급 대행 수수료 정산</span>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono">
              {stats.totalAgencyFee.toLocaleString()}원
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              대행 수수료 + 금융사 인지대 실비
            </span>
          </div>
        </div>
      </div>

      {/* ── 메인 영역: 좌측 채권자 테이블 + 우측 Split View 증명서 뷰어 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 좌측 채권자 조사 목록 (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                채권자 조사 및 발급 현황표
              </h3>
              <span className="text-xs text-slate-400">
                (채권자를 클릭하면 우측에서 증명서 확인 및 금액 입력)
              </span>
            </div>

            <button
              onClick={handleAddCreditor}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>채권자 추가</span>
            </button>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">금융기관명</th>
                  <th className="py-3 px-3 text-right">예상채무</th>
                  <th className="py-3 px-3 text-center">진행상태</th>
                  <th className="py-3 px-3 text-right">확정원금</th>
                  <th className="py-3 px-3 text-center">증명서</th>
                  <th className="py-3 px-2 text-center w-10">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => {
                  const isSelected = item.id === selectedItemId;
                  const isDone = item.issueStatus === 'issued' || item.issueStatus === 'confirmed';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/70 font-semibold'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.creditorName}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.accountOrContractNo || item.branchName || '전지점'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {item.expectedPrincipal.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            발급완료
                          </span>
                        ) : item.issueStatus === 'agency_requested' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3" />
                            대행의뢰
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            의뢰대기
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {item.confirmedPrincipal ? (
                          <span className="text-indigo-700 font-bold">
                            {item.confirmedPrincipal.toLocaleString()}원
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.certificateDocUrl ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {item.docType === 'pdf' ? <FileText className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                            첨부됨
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">미첨부</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={(e) => handleDeleteCreditor(item.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측 Split View: 부채증명서 서류 뷰어 & 확정값 입력 패널 (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>{selectedItem.creditorName}</span>
                    <span className="text-xs font-normal text-slate-500">부채증명서 확인</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    대행사가 송부한 서류(PDF/이미지)를 보며 확정 채무액을 입력하세요.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="application/pdf,image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>서류 등록(PDF/이미지)</span>
                  </button>
                </div>
              </div>

              {/* 뷰어 영역 */}
              <div className="relative rounded-2xl bg-slate-900/5 border border-slate-200 min-h-[280px] max-h-[380px] flex flex-col items-center justify-center overflow-hidden p-2">
                {selectedItem.certificateDocUrl ? (
                  <>
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-xs border border-slate-200">
                      <button
                        onClick={() => setViewerZoom((z) => Math.max(0.6, z - 0.2))}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                        title="축소"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewerZoom((z) => Math.min(2.5, z + 0.2))}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                        title="확대"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewerRotate((r) => (r + 90) % 360)}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                        title="회전"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-full h-full overflow-auto flex items-center justify-center p-2">
                      {selectedItem.docType === 'pdf' ? (
                        <iframe
                          src={selectedItem.certificateDocUrl}
                          className="w-full h-[320px] rounded-lg border-none"
                          title="부채증명서 PDF"
                        />
                      ) : (
                        <img
                          src={selectedItem.certificateDocUrl}
                          alt="부채증명서"
                          className="max-w-full max-h-[320px] object-contain transition-transform"
                          style={{
                            transform: `scale(${viewerZoom}) rotate(${viewerRotate}deg)`,
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      등록된 부채증명서 파일이 없습니다
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      대행업체에서 보내준 PDF 파일이나 캡처 사진 이미지를 우측 상단 [서류 등록] 버튼을 눌러 업로드해 주세요.
                    </p>
                  </div>
                )}
              </div>

              {/* 확정 금액 및 세부 입력 폼 */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      확정 원금 (증명서상)
                    </label>
                    <input
                      type="number"
                      value={selectedItem.confirmedPrincipal ?? selectedItem.expectedPrincipal}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, {
                          confirmedPrincipal: Number(e.target.value) || 0,
                          issueStatus: 'issued',
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                      placeholder="원 단위 입력"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      개시 전 이자 (선택)
                    </label>
                    <input
                      type="number"
                      value={selectedItem.confirmedInterest ?? 0}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, {
                          confirmedInterest: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                      placeholder="0원"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      부채증명서 발급일자
                    </label>
                    <input
                      type="date"
                      value={selectedItem.issueDate || ''}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, { issueDate: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      발급 상태 변경
                    </label>
                    <select
                      value={selectedItem.issueStatus}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, {
                          issueStatus: e.target.value as DebtIssueStatus,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                    >
                      <option value="pending">의뢰 대기</option>
                      <option value="agency_requested">대행사 의뢰 완료</option>
                      <option value="issued">발급 완료 (서류 수신)</option>
                      <option value="rejected">발급 불가 (양도/이관)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    특이사항 / 메모 (보정 필요사항 등)
                  </label>
                  <input
                    type="text"
                    value={selectedItem.memo || ''}
                    onChange={(e) =>
                      handleUpdateItem(selectedItem.id, { memo: e.target.value })
                    }
                    placeholder="예: 카드론 채권 양도 발생으로 OK저축은행으로 이관됨"
                    className="w-full px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs">
              좌측에서 채권자를 선택해 주세요.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
