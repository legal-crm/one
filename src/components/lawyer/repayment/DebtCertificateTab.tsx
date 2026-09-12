import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, Eye, Plus, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, FileText, Image as ImageIcon, ExternalLink,
  ShieldCheck, Calculator, ArrowRight, RotateCw, ZoomIn, ZoomOut, Sparkles, Building2,
  MapPin, Search, Check, CornerDownRight, AlertOctagon, Minus
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
import { matchCreditorPreset, searchCreditorAddress, CREDITOR_DIRECTORY } from '../../../services/court/creditorAddressDirectory';
import DebtDiscoveryModal from '../../common/DebtDiscoveryModal';

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

    // 초기 상담 데이터에서 채권자 추정치 시드 (주소 프리셋 자동 매핑)
    const initialDebt = clientRequest.financialProfile?.debtTotal || 0;
    const p1 = matchCreditorPreset('국민은행');
    const p2 = matchCreditorPreset('신한카드');
    const p3 = matchCreditorPreset('OK저축은행');

    const initialItems: DebtCertificateItem[] = [
      {
        id: 'item_1',
        creditorName: '국민은행',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.4),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
        zipCode: p1?.zipCode || '07331',
        address: p1?.address || '서울특별시 영등포구 의사당대로 141 (여의도동)',
        serviceAddress: p1?.serviceAddress || '서울특별시 영등포구 의사당대로 141, 여의도영업부 (법원송달팀)',
        representative: p1?.representative || '은행장 이재근',
        bizNumber: p1?.bizNumber || '201-81-47789',
        debtCauseDetail: '대여금 / 신용대출',
        borrowedDate: '2023-05-15',
      },
      {
        id: 'item_2',
        creditorName: '신한카드',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.35),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
        zipCode: p2?.zipCode || '04543',
        address: p2?.address || '서울특별시 중구 을지로 100, 파인에비뉴 A동 (을지로2가)',
        serviceAddress: p2?.serviceAddress || '서울특별시 중구 을지로 100, 파인에비뉴 A동 사후관리팀',
        representative: p2?.representative || '대표이사 문동권',
        bizNumber: p2?.bizNumber || '202-81-48079',
        debtCauseDetail: '신용카드 대금',
        borrowedDate: '2023-08-20',
      },
      {
        id: 'item_3',
        creditorName: 'OK저축은행',
        expectedPrincipal: Math.round(initialDebt * 10000 * 0.25),
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
        zipCode: p3?.zipCode || '04523',
        address: p3?.address || '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층',
        serviceAddress: p3?.serviceAddress || '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 여신관리실',
        representative: p3?.representative || '대표이사 정길호',
        bizNumber: p3?.bizNumber || '214-81-88987',
        debtCauseDetail: '금원차용(신용대출)',
        borrowedDate: '2024-01-10',
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
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 저장 동기화
  const handleSaveOrder = (newOrder: DebtCertificateOrder) => {
    setOrder(newOrder);
    saveDebtCertificateOrder(newOrder);
  };

  // 간편인증 발굴 채무 일괄 반영 핸들러
  const handleImportFromDiscovery = (newItems: DebtCertificateItem[]) => {
    const existingNames = new Set(order.items.map((i) => i.creditorName.trim()));
    const toAdd = newItems.filter((i) => !existingNames.has(i.creditorName.trim()));
    if (toAdd.length === 0) {
      toast.info('선택한 채무가 이미 발급 목록에 모두 등록되어 있습니다.');
      return;
    }
    const updatedItems = [...order.items, ...toAdd];
    handleSaveOrder({
      ...order,
      items: updatedItems,
      totalAgencyCost: updatedItems.length * 17000,
    });
    toast.success(`${toAdd.length}건의 금융 채무가 부채증명서 발급 목록에 추가되었습니다.`);
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

  // 보증기관 가지번호 항목 추가 (그림 3-4 가지번호 생성)
  const handleAddGuarantor = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const parentIndex = order.items.findIndex((i) => i.id === parentId);
    if (parentIndex === -1) return;

    const newGuarantor: DebtCertificateItem = {
      id: `item_g_${Date.now()}`,
      creditorName: '보증기관 (예: 서울보증보험, 신용보증기금)',
      expectedPrincipal: 0,
      issueStatus: 'pending',
      agencyFee: 15000,
      issuanceFee: 2000,
      parentItemId: parentId,
      isGuarantor: true,
      debtCauseDetail: '연대보증 / 보증채무',
    };

    const updatedItems = [...order.items];
    let insertIndex = parentIndex + 1;
    while (insertIndex < updatedItems.length && updatedItems[insertIndex].parentItemId === parentId) {
      insertIndex++;
    }
    updatedItems.splice(insertIndex, 0, newGuarantor);

    const updated = {
      ...order,
      items: updatedItems,
      totalAgencyCost: updatedItems.length * 17000,
    };
    handleSaveOrder(updated);
    setSelectedItemId(newGuarantor.id);
    toast.success('보증기관이 가지번호로 추가되었습니다.');
  };

  // 항목별 가지번호 (1, 2, 4-1 등) 계산
  const itemsWithDisplay = useMemo(() => {
    let mainNumber = 0;
    const childCountMap: Record<string, number> = {};
    const mainNumberMap: Record<string, number> = {};

    return order.items.map((item) => {
      if (!item.parentItemId) {
        mainNumber++;
        mainNumberMap[item.id] = mainNumber;
        return {
          ...item,
          displayNumber: `${mainNumber}`,
          isGuarantor: false,
        };
      } else {
        const parentNum = mainNumberMap[item.parentItemId] || 1;
        const count = (childCountMap[item.parentItemId] || 0) + 1;
        childCountMap[item.parentItemId] = count;
        return {
          ...item,
          displayNumber: `${parentNum}-${count}`,
          isGuarantor: true,
        };
      }
    });
  }, [order.items]);

  // 채권자 삭제
  const handleDeleteCreditor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.items.length <= 1) {
      toast.error('최소 1개 이상의 채권자가 필요합니다.');
      return;
    }
    const updated = {
      ...order,
      items: order.items.filter((i) => i.id !== id && i.parentItemId !== id),
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
    
    // CRM 확장에 동기화 저장 (기존 plan이 있는 경우 creditors도 함께 갱신)
    const existingPlan = crmExt.repaymentPlan;
    await onUpdateCrmExt({
      debtCertificateOrders: [order],
      repaymentPlan: existingPlan ? {
        ...existingPlan,
        creditors: repaymentCreditors,
      } : undefined,
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
              onClick={() => setIsDiscoveryModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              title="한국신용정보원 및 국세청 간편인증 실시간 전수조회"
            >
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>⚡ 간편인증 숨은 채무 발굴</span>
            </button>

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
                {itemsWithDisplay.map((item, idx) => {
                  const isSelected = item.id === selectedItemId;
                  const isDone = item.issueStatus === 'issued' || item.issueStatus === 'confirmed';
                  const isGuarantor = !!item.parentItemId;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/70 font-semibold'
                          : isGuarantor
                          ? 'bg-slate-50/50 hover:bg-slate-100/60'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {item.displayNumber || idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isGuarantor && (
                              <div className="flex items-center text-indigo-500 shrink-0 font-bold" title="보증기관">
                                <CornerDownRight className="w-3.5 h-3.5 mr-0.5" />
                                <span className="text-[10px] bg-indigo-100/80 px-1 py-0.2 rounded text-indigo-800">보증</span>
                              </div>
                            )}
                            <span className="font-bold text-slate-900">{item.creditorName}</span>

                            {item.isUnpaidInterest3Times && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
                                <AlertOctagon className="w-2.5 h-2.5" /> 이자3회미납
                              </span>
                            )}

                            {item.isSecured && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 border border-blue-200">
                                별제권(담보)
                              </span>
                            )}

                            {item.address ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5" title={`${item.address} (우: ${item.zipCode || '-'})`}>
                                <MapPin className="w-2.5 h-2.5" /> 주소등록
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5" title="대법원 전자소송 송달을 위해 주소 입력이 필요합니다">
                                <AlertCircle className="w-2.5 h-2.5" /> 송달주소 누락
                              </span>
                            )}

                            {!isGuarantor && (
                              <button
                                type="button"
                                onClick={(e) => handleAddGuarantor(item.id, e)}
                                className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 inline-flex items-center gap-0.5 cursor-pointer"
                                title="보증기관 가지번호 추가"
                              >
                                <Plus className="w-2.5 h-2.5" /> 보증기관
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px]" title={item.serviceAddress || item.address || ''}>
                            {item.serviceAddress || item.address || item.accountOrContractNo || item.branchName || '송달주소 미지정'}
                          </div>
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
                          title={isGuarantor ? '보증기관 삭제' : '채권자 삭제'}
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

                {/* 기타 체크사항 (이자 3회 미납 & 별제권부 채권) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50/50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!selectedItem.isUnpaidInterest3Times}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, {
                          isUnpaidInterest3Times: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-black text-rose-700 block">이자 3회 미납</span>
                      <span className="text-[10px] text-slate-400">사기죄 고소 위험 관리</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!selectedItem.isSecured}
                      onChange={(e) =>
                        handleUpdateItem(selectedItem.id, {
                          isSecured: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-blue-700 block">별제권부 채권</span>
                      <span className="text-[10px] text-slate-400">담보대출/근저당 채무</span>
                    </div>
                  </label>
                </div>

                {/* ══════════ 법원 송달주소 및 채권자 법인 정보 (채권자목록 연동) ══════════ */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  {(() => {
                    const preset = matchCreditorPreset(selectedItem.creditorName);
                    return (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-700">
                              <MapPin className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-extrabold text-xs text-slate-900">
                              법원 송달주소 (개인회생채권자목록 기재용)
                            </span>
                          </div>

                          {preset && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateItem(selectedItem.id, {
                                  zipCode: preset.zipCode,
                                  address: preset.address,
                                  serviceAddress: preset.serviceAddress,
                                  representative: preset.representative,
                                  bizNumber: preset.bizNumber,
                                  debtCauseDetail: selectedItem.debtCauseDetail || '대여금 / 신용대출'
                                });
                                toast.success(`'${preset.officialName}' 공식 송달주소가 자동 반영되었습니다!`);
                              }}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer press-scale shadow-2xs"
                              title="공식 법인명, 우편번호, 송달주소, 대표자 1클릭 채우기"
                            >
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>{preset.officialName} 주소 자동채우기</span>
                            </button>
                          )}
                        </div>

                        {preset && (!selectedItem.address || selectedItem.address !== preset.address) && (
                          <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 flex items-center justify-between">
                            <div>
                              <span className="font-bold">🏢 추천 DB 일치:</span> {preset.officialName} ({preset.zipCode})
                              <div className="text-[10px] text-indigo-700 mt-0.5 truncate max-w-sm">
                                {preset.address}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateItem(selectedItem.id, {
                                  zipCode: preset.zipCode,
                                  address: preset.address,
                                  serviceAddress: preset.serviceAddress,
                                  representative: preset.representative,
                                  bizNumber: preset.bizNumber,
                                });
                                toast.success('추천 송달주소가 적용되었습니다.');
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-extrabold border border-indigo-200 cursor-pointer"
                            >
                              적용
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              우편번호 (5자리)
                            </label>
                            <input
                              type="text"
                              value={selectedItem.zipCode || ''}
                              onChange={(e) =>
                                handleUpdateItem(selectedItem.id, { zipCode: e.target.value })
                              }
                              placeholder="예: 07331"
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              대표자 (대표이사 등)
                            </label>
                            <input
                              type="text"
                              value={selectedItem.representative || ''}
                              onChange={(e) =>
                                handleUpdateItem(selectedItem.id, { representative: e.target.value })
                              }
                              placeholder="예: 은행장 이재근"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            본점 소재지 / 채권자 주소 (등기부상)
                          </label>
                          <input
                            type="text"
                            value={selectedItem.address || ''}
                            onChange={(e) =>
                              handleUpdateItem(selectedItem.id, { address: e.target.value })
                            }
                            placeholder="예: 서울특별시 영등포구 의사당대로 141 (여의도동)"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            법원 우편물 송달장소 (우편물 수신처)
                          </label>
                          <input
                            type="text"
                            value={selectedItem.serviceAddress || ''}
                            onChange={(e) =>
                              handleUpdateItem(selectedItem.id, { serviceAddress: e.target.value })
                            }
                            placeholder="본점과 동일하거나 특정 부서 지정 시 입력 (미입력 시 본점 주소 적용)"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              사업자/법인등록번호
                            </label>
                            <input
                              type="text"
                              value={selectedItem.bizNumber || ''}
                              onChange={(e) =>
                                handleUpdateItem(selectedItem.id, { bizNumber: e.target.value })
                              }
                              placeholder="예: 201-81-47789"
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              차용원인
                            </label>
                            <input
                              type="text"
                              value={selectedItem.debtCauseDetail || ''}
                              onChange={(e) =>
                                handleUpdateItem(selectedItem.id, { debtCauseDetail: e.target.value })
                              }
                              placeholder="예: 대여금 / 신용대출"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[10px] text-amber-900 leading-relaxed">
                          ⚠️ <strong>법원 송달 유의사항:</strong> 법원은 개시결정문 및 변제계획안을 위 송달장소로 우편 송달합니다. 채권이 양도되었거나 주소가 누락되면 즉시 송달불능 및 주소보정명령이 내려져 절차가 지연됩니다.
                        </div>
                      </>
                    );
                  })()}
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

      {/* 간편인증 4대 기관 숨은 채무 발굴 모달 */}
      <DebtDiscoveryModal
        isOpen={isDiscoveryModalOpen}
        onClose={() => setIsDiscoveryModalOpen(false)}
        clientName={order.clientName || clientRequest.clientName || '의뢰인'}
        clientPhone={order.clientPhone || clientRequest.phone || '010-0000-0000'}
        onImportToDebtCertificates={handleImportFromDiscovery}
      />
    </div>
  );
}
