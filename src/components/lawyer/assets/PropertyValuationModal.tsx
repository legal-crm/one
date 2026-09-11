import React, { useState, useMemo } from 'react';
import { 
  X, Building2, Car, Shield, Briefcase, DollarSign, Home, 
  ExternalLink, Copy, Check, Plus, Trash2, Calculator, 
  Sparkles, Save, Printer, AlertTriangle, CheckCircle2, 
  ArrowRight, RefreshCw, FileText, Info, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  PropertyListD5102Data, 
  RealEstateItem, 
  VehicleItem, 
  LeaseDepositItem, 
  InsuranceItem, 
  SeveranceItem, 
  FinancialAssetItem,
  RealEstateType,
  VehicleType
} from '../../../types/propertyTypes';
import { 
  convertConsultRequestToD5102, 
  recalculateD5102Totals,
  calculatePublicPrice130,
  syncD5102ToRepaymentAssets,
  EXEMPT_DEPOSIT_LIMIT_2026
} from '../../../services/documents/propertyValuationService';
import { 
  openExternalSearchPortal, 
  ASSET_SEARCH_PORTALS 
} from '../../../services/documents/assetSearchLinks';
import { 
  REGION_CONFIG_2026, 
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  RegionType
} from '../../../services/repayment/repaymentConstants2026';
import PrintablePropertyListModal from './PrintablePropertyListModal';

interface PropertyValuationModalProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  onSyncToRepaymentPlan?: (syncedAssets: any[], totalLiquidation: number) => void;
}

type TabType = 'realestate' | 'vehicle' | 'deductions' | 'verification';

export default function PropertyValuationModal({
  clientId,
  clientRequest,
  crmExt,
  isOpen,
  onClose,
  onUpdateCrmExt,
  onSyncToRepaymentPlan,
}: PropertyValuationModalProps) {
  // ── 1. 마스터 D5102 상태 관리 ──
  const [data, setData] = useState<PropertyListD5102Data>(() => {
    return convertConsultRequestToD5102(clientRequest, crmExt);
  });

  const [activeTab, setActiveTab] = useState<TabType>('realestate');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const won = (n: number) => (n || 0).toLocaleString();

  // ── 2. 외부 포털 검색 연동 핸들러 ──
  const handleOpenPortal = async (portalKey: keyof typeof ASSET_SEARCH_PORTALS, query?: string) => {
    const res = await openExternalSearchPortal(portalKey, query);
    if (res.copiedQuery) {
      toast.success(`[${ASSET_SEARCH_PORTALS[portalKey]?.name}] 열림 (검색어 '${res.copiedQuery}' 클립보드 복사됨)`);
    } else {
      toast.info(`[${ASSET_SEARCH_PORTALS[portalKey]?.name}] 조회 페이지로 이동합니다.`);
    }
  };

  // ── 3. 상태 변경 및 자동 집계 ──
  const updateData = (updater: (prev: PropertyListD5102Data) => PropertyListD5102Data) => {
    setData(prev => recalculateD5102Totals(updater(prev)));
  };

  // ── 4. 저장 및 변제계획안 동기화 ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const recalculated = recalculateD5102Totals(data);
      await onUpdateCrmExt({
        propertyListD5102: recalculated
      });
      toast.success('D5102 재산목록 및 자산 가치 평가 내역이 성공적으로 저장되었습니다.');
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncToRepayment = async () => {
    const recalculated = recalculateD5102Totals(data);
    await onUpdateCrmExt({
      propertyListD5102: recalculated
    });

    const syncedAssets = syncD5102ToRepaymentAssets(recalculated);

    if (onSyncToRepaymentPlan) {
      onSyncToRepaymentPlan(syncedAssets, recalculated.totalLiquidationValue);
    }

    toast.success(`변제계획안에 총 ${syncedAssets.length}건의 자산과 청산가치 ${won(recalculated.totalLiquidationValue)}원이 실시간 동기화되었습니다!`);
  };

  // ── 5. 청산가치 vs 변제계획안 검증 ──
  const currentPlanTotalRepayment = crmExt.repaymentPlan?.totalRepaymentAmount || 0;
  const isLiquidationGuaranteed = currentPlanTotalRepayment >= data.totalLiquidationValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* ── 헤더 바 ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xl">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  자산 가치 산정 및 [전산양식 D5102] 재산목록 허브
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  대법원 표준
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{data.clientName}</strong> · 공시가격 130% 공식 & 2026 주택임대차 소액보증금 공제 적용
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>D5102 인쇄 / PDF</span>
            </button>
            <button
              onClick={handleSyncToRepayment}
              className="px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 rounded-xl hover:bg-emerald-900 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              title="변제계획안에 계산된 청산가치를 원클릭 전송합니다"
            >
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>변제계획안 청산가치 동기화</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? '저장 중...' : '저장하기'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 상단 집계 통계 바 (실시간 청산가치 현황) ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[11px]">총 자산 평가액</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{won(data.totalMarketValue)}원</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-rose-600 text-[11px]">총 담보 채무 (근저당/할부)</span>
              <p className="text-sm font-bold text-rose-700 mt-0.5">-{won(data.totalEncumbrance)}원</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[11px]">총 법정 공제액</span>
              <p className="text-sm font-bold text-slate-700 mt-0.5">-{won(data.totalStatutoryDeduction)}원</p>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border-2 border-emerald-500 col-span-2 sm:col-span-2 flex items-center justify-between">
              <div>
                <span className="text-emerald-800 font-bold text-[11px]">최종 총 청산가치 (J)</span>
                <p className="text-base font-black text-emerald-700 mt-0.5">{won(data.totalLiquidationValue)}원</p>
              </div>
              <div className="text-right">
                {currentPlanTotalRepayment > 0 && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isLiquidationGuaranteed ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                    {isLiquidationGuaranteed ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {isLiquidationGuaranteed ? '청산가치 보장 충족' : '청산가치 미달 주의'}
                  </span>
                )}
                <div className="text-[10px] text-slate-500 mt-0.5">
                  변제계획안 총변제액: {won(currentPlanTotalRepayment)}원
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 탭 네비게이션 ── */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('realestate')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'realestate'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. 부동산 ({data.realEstates.length}건)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-normal">공시가 130%</span>
          </button>
          <button
            onClick={() => setActiveTab('vehicle')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vehicle'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>2. 자동차·오토바이 ({data.vehicles.length}건)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-normal">엔카/보험개발원</span>
          </button>
          <button
            onClick={() => setActiveTab('deductions')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'deductions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>3. 보증금·보험·퇴직금·예금</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-normal">법정공제 4종</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'verification'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>4. 청산가치 진단 & 동기화</span>
          </button>
        </div>

        {/* ── 탭별 본문 컨텐츠 ── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: 부동산 (아파트, 빌라, 단독, 토지, 상가)               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'realestate' && (
            <div className="space-y-6">
              {/* 외부 조회 사이트 다이렉트 검색 점퍼 툴바 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      실무 공인 부동산 조회 포털 (원클릭 자동검색 및 클립보드 복사)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">클릭 시 주소가 클립보드에 자동 복사되어 새창이 열립니다.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenPortal('kb_realestate', data.realEstates[0]?.address || clientRequest.address || '마포구 공덕동')}
                    className="px-3 py-2 text-xs font-bold text-yellow-900 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🏢 KB부동산 시세 (아파트 1순위)</span>
                    <ExternalLink className="w-3 h-3 text-yellow-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('realty_price', data.realEstates[0]?.address || clientRequest.address)}
                    className="px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🏠 공시가격 알리미 (빌라·주택 130%)</span>
                    <ExternalLink className="w-3 h-3 text-blue-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('eum_land', data.realEstates[0]?.address || clientRequest.address)}
                    className="px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🌄 토지이음 (개별공시지가 130%)</span>
                    <ExternalLink className="w-3 h-3 text-emerald-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('molit_real_trade', data.realEstates[0]?.address || clientRequest.address)}
                    className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>📊 국토부 실거래가 (상가/나홀로)</span>
                    <ExternalLink className="w-3 h-3 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('iros_registry')}
                    className="px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>⚖️ 대법원 인터넷등기소 (을구 근저당)</span>
                    <ExternalLink className="w-3 h-3 text-purple-700" />
                  </button>
                </div>
              </div>

              {/* 부동산 목록 및 편집기 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>보유 부동산 목록</span>
                    <span className="text-xs font-normal text-slate-500">
                      (빌라·토지는 공시가격 입력 시 130% 공식이 자동 적용됩니다)
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      const newRe: RealEstateItem = {
                        id: `re-${Date.now()}`,
                        type: 'villa_multi',
                        address: '서울특별시 마포구 ',
                        valuationMethod: 'public_price_130',
                        officialPublicPrice: 200000000,
                        marketValue: 260000000,
                        mortgageBalance: 150000000,
                        liquidationValue: 110000000,
                        ownerType: 'self',
                        shareRatio: 1.0,
                        note: '공시가격 130% 환산 적용'
                      };
                      updateData(prev => ({
                        ...prev,
                        realEstates: [...prev.realEstates, newRe]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>부동산 추가</span>
                  </button>
                </div>

                {data.realEstates.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                    등록된 부동산이 없습니다. (의뢰인이 무주택자인 경우 생략 가능)
                  </div>
                ) : (
                  data.realEstates.map((re, idx) => (
                    <div key={re.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <select
                            value={re.type}
                            onChange={(e) => {
                              const newType = e.target.value as RealEstateType;
                              const is130 = newType === 'villa_multi' || newType === 'detached_house' || newType === 'land';
                              updateData(prev => ({
                                ...prev,
                                realEstates: prev.realEstates.map(item => item.id === re.id ? {
                                  ...item,
                                  type: newType,
                                  valuationMethod: is130 ? 'public_price_130' : (newType === 'apartment_officetel' ? 'kb_general' : 'actual_trade'),
                                } : item)
                              }));
                            }}
                            className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1"
                          >
                            <option value="apartment_officetel">아파트·오피스텔 (KB시세 일반가)</option>
                            <option value="villa_multi">연립·다세대 빌라 (공시가격 130%)</option>
                            <option value="detached_house">단독·다가구 주택 (개별주택 130%)</option>
                            <option value="land">토지/임야 (개별공시지가 130%)</option>
                            <option value="commercial">상가 (실거래가/감정가)</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              realEstates: prev.realEstates.filter(item => item.id !== re.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 입력 그리드 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">부동산 소재지 (주소)</label>
                          <input
                            type="text"
                            value={re.address}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateData(prev => ({
                                ...prev,
                                realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, address: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-xs"
                            placeholder="예: 서울특별시 마포구 공덕동 123-45 마포자이아파트 101동 1002호"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">전용/대지면적 (㎡)</label>
                          <input
                            type="number"
                            value={re.areaSquareMeter || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || undefined;
                              updateData(prev => ({
                                ...prev,
                                realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, areaSquareMeter: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-xs"
                            placeholder="예: 84.9"
                          />
                        </div>

                        {/* 공시가격 vs 시가 산정 */}
                        {re.valuationMethod === 'public_price_130' ? (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                국토부 공시가격 (원)
                              </label>
                              <input
                                type="number"
                                step={1000000}
                                value={re.officialPublicPrice || 0}
                                onChange={(e) => {
                                  const pub = Number(e.target.value) || 0;
                                  const calcMarket = calculatePublicPrice130(pub);
                                  updateData(prev => ({
                                    ...prev,
                                    realEstates: prev.realEstates.map(item => item.id === re.id ? {
                                      ...item,
                                      officialPublicPrice: pub,
                                      marketValue: calcMarket
                                    } : item)
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-indigo-700 mb-1 flex items-center justify-between">
                                <span>공시가격의 130% 시가 (원)</span>
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 rounded">자동 환산</span>
                              </label>
                              <input
                                type="number"
                                value={re.marketValue}
                                readOnly
                                className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900"
                              />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              KB부동산 시세 일반가 (원)
                            </label>
                            <input
                              type="number"
                              step={1000000}
                              value={re.marketValue}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, marketValue: val } : item)
                                }));
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                            />
                          </div>
                        )}

                        {/* 담보대출 (근저당 피담보채무) */}
                        <div>
                          <label className="block text-[11px] font-bold text-rose-600 mb-1">
                            담보대출 잔액 (근저당 피담보채무)
                          </label>
                          <input
                            type="number"
                            step={1000000}
                            value={re.mortgageBalance}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, mortgageBalance: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800"
                          />
                        </div>
                      </div>

                      {/* 하단 청산가치 결과 */}
                      <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs border border-slate-200">
                        <div className="text-slate-600">
                          계산식: 시가({won(re.marketValue)}원) - 담보대출({won(re.mortgageBalance)}원)
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold text-[11px]">해당 부동산 청산가치:</span>
                          <span className="text-sm font-black text-emerald-600">{won(re.liquidationValue)}원</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: 자동차 및 이륜차 (엔카, KB차차차, 보험개발원)         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'vehicle' && (
            <div className="space-y-6">
              {/* 중고차 시세 포털 점퍼 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    중고차 시세 & 보험개발원 기준가액 원클릭 조회
                  </span>
                  <span className="text-[11px] text-slate-400">법원은 엔카/차차차 2~3곳 평균 또는 보험개발원 가액을 인정합니다.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenPortal('encar', data.vehicles[0]?.modelName || '아반떼')}
                    className="px-3 py-2 text-xs font-bold text-red-900 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🚗 엔카 (Encar) 시세 조회</span>
                    <ExternalLink className="w-3 h-3 text-red-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('kb_chachacha', data.vehicles[0]?.modelName || '아반떼')}
                    className="px-3 py-2 text-xs font-bold text-yellow-900 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🚙 KB차차차 국민시세</span>
                    <ExternalLink className="w-3 h-3 text-yellow-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('kidi_car')}
                    className="px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>📋 보험개발원 차량기준가액</span>
                    <ExternalLink className="w-3 h-3 text-blue-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('passo_bike', data.vehicles[0]?.modelName || '혼다')}
                    className="px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🛵 파쏘 (PASSO) 오토바이</span>
                    <ExternalLink className="w-3 h-3 text-emerald-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('ecar_portal')}
                    className="px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>📄 자동차365 등록원부 저당확인</span>
                    <ExternalLink className="w-3 h-3 text-purple-700" />
                  </button>
                </div>
              </div>

              {/* 차량 목록 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>보유 차량 및 이륜차 목록</span>
                    <span className="text-xs font-normal text-slate-500">
                      (할부금/캐피탈 담보대출 잔액 차감 후 순가치 반영)
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      const newV: VehicleItem = {
                        id: `v-${Date.now()}`,
                        type: 'car',
                        modelName: '현대 아반떼 CN7',
                        plateNumber: '12가 3456',
                        year: 2022,
                        valuationMethod: 'used_avg',
                        marketValue: 16000000,
                        loanBalance: 9000000,
                        liquidationValue: 7000000,
                        ownerType: 'self',
                        note: '출퇴근 및 생계용 차량'
                      };
                      updateData(prev => ({
                        ...prev,
                        vehicles: [...prev.vehicles, newV]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>차량 추가</span>
                  </button>
                </div>

                {data.vehicles.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                    등록된 차량이 없습니다.
                  </div>
                ) : (
                  data.vehicles.map((v, idx) => (
                    <div key={v.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <select
                            value={v.type}
                            onChange={(e) => {
                              const t = e.target.value as VehicleType;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, type: t } : item)
                              }));
                            }}
                            className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1"
                          >
                            <option value="car">승용·화물차 (자동차)</option>
                            <option value="motorcycle">오토바이 (이륜차)</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              vehicles: prev.vehicles.filter(item => item.id !== v.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">차종 및 모델명</label>
                          <input
                            type="text"
                            value={v.modelName}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, modelName: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            placeholder="예: 현대 더 뉴 아반떼"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">차량등록번호</label>
                          <input
                            type="text"
                            value={v.plateNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, plateNumber: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            placeholder="예: 12가 3456"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">연식</label>
                          <input
                            type="number"
                            value={v.year}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 2020;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, year: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">중고시세/평가액 (원)</label>
                          <input
                            type="number"
                            step={500000}
                            value={v.marketValue}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, marketValue: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-rose-600 mb-1">할부/저당채무 (원)</label>
                          <input
                            type="number"
                            step={500000}
                            value={v.loanBalance}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, loanBalance: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">특이사항 (용도 및 소명)</label>
                          <input
                            type="text"
                            value={v.note || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, note: val } : item)
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            placeholder="예: 생계형 필수 차량 (출퇴근용)"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs border border-slate-200">
                        <div className="text-slate-600">
                          계산식: 시가({won(v.marketValue)}원) - 담보대출({won(v.loanBalance)}원)
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold text-[11px]">차량 청산가치:</span>
                          <span className="text-sm font-black text-emerald-600">{won(v.liquidationValue)}원</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: 보증금·보험·퇴직금·예금 (법정 공제 4종)               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'deductions' && (
            <div className="space-y-6">
              {/* 공적 금융 조회 점퍼 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    보험 해약환급금 & 전 계좌 잔액 원클릭 통합조회 바로가기
                  </span>
                  <span className="text-[11px] text-slate-400">의뢰인이 발급받은 증명서와 일치하는지 확인합니다.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenPortal('credit4u')}
                    className="px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>📑 내보험다보여 (신용정보원)</span>
                    <ExternalLink className="w-3 h-3 text-blue-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('payinfo')}
                    className="px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>💳 어카운트인포 (계좌통합조회)</span>
                    <ExternalLink className="w-3 h-3 text-purple-700" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('insure_finder')}
                    className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🔍 내보험 찾아줌 (생·손보협회)</span>
                    <ExternalLink className="w-3 h-3 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('nps_severance')}
                    className="px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>🏢 국민연금공단 (재직/연금조회)</span>
                    <ExternalLink className="w-3 h-3 text-emerald-700" />
                  </button>
                </div>
              </div>

              {/* 1) 임차보증금 반환채권 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>🏠 임차보증금 (2026 주택임대차 소액보증금 공제)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      서울 5,500만 원, 과밀억제 4,800만 원, 광역시 2,800만 원, 기타 2,500만 원 한도 자동 공제
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newLd: LeaseDepositItem = {
                        id: `ld-${Date.now()}`,
                        address: '서울특별시 마포구 ',
                        depositAmount: 70000000,
                        unpaidRent: 0,
                        pledgeLoanAmount: 0,
                        region: 'SEOUL',
                        statutoryExemption: 55000000,
                        liquidationValue: 15000000,
                        leaseType: 'housing',
                        hasFixedDate: true,
                        note: '확정일자부 임대차계약서'
                      };
                      updateData(prev => ({
                        ...prev,
                        leaseDeposits: [...prev.leaseDeposits, newLd]
                      }));
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3 h-3" />
                    <span>보증금 추가</span>
                  </button>
                </div>

                {data.leaseDeposits.map((ld) => (
                  <div key={ld.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">임차 주소</label>
                        <input
                          type="text"
                          value={ld.address}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateData(prev => ({
                              ...prev,
                              leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, address: val } : item)
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">소재 지역 (공제액 결정)</label>
                        <select
                          value={ld.region}
                          onChange={(e) => {
                            const reg = e.target.value as RegionType;
                            updateData(prev => ({
                              ...prev,
                              leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, region: reg } : item)
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        >
                          <option value="SEOUL">서울특별시 (최대 5,500만 공제)</option>
                          <option value="OVERCROWDED">수도권 과밀/세종/용인/화성 (4,800만)</option>
                          <option value="METROPOLITAN">광역시/안산/평택/파주 (2,800만)</option>
                          <option value="OTHERS">그 밖의 지역 (2,500만)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">계약 보증금 (원)</label>
                        <input
                          type="number"
                          step={1000000}
                          value={ld.depositAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            updateData(prev => ({
                              ...prev,
                              leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, depositAmount: val } : item)
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                      <div className="text-slate-600">
                        공제액: 소액보증금 -{won(ld.statutoryExemption)}원 (법정 면제)
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-700">임차보증금 청산가치: <strong className="text-emerald-600">{won(ld.liquidationValue)}원</strong></span>
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              leaseDeposits: prev.leaseDeposits.filter(item => item.id !== ld.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2) 예상퇴직금 (일반 50% vs 퇴직연금 0원) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>💼 예상퇴직금 (퇴직연금 DB/DC/IRP 체크 시 청산가치 0원 전액 면제)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      근로자퇴직급여보장법 제7조에 따라 퇴직연금은 전액 압류금지채권으로 청산가치에 반영하지 않습니다.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newSev: SeveranceItem = {
                        id: `sev-${Date.now()}`,
                        workplaceName: '재직 직장명',
                        isRetirementPension: true,
                        expectedAmount: 30000000,
                        statutoryDeduction: 30000000,
                        liquidationValue: 0,
                        note: 'DC형 퇴직연금 가입 (압류금지 전액 면제)'
                      };
                      updateData(prev => ({
                        ...prev,
                        severances: [...prev.severances, newSev]
                      }));
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3 h-3" />
                    <span>퇴직금 추가</span>
                  </button>
                </div>

                {data.severances.map((sev) => (
                  <div key={sev.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">직장명</label>
                        <input
                          type="text"
                          value={sev.workplaceName}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateData(prev => ({
                              ...prev,
                              severances: prev.severances.map(item => item.id === sev.id ? { ...item, workplaceName: val } : item)
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">퇴직금 예상 총액 (원)</label>
                        <input
                          type="number"
                          step={1000000}
                          value={sev.expectedAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            updateData(prev => ({
                              ...prev,
                              severances: prev.severances.map(item => item.id === sev.id ? { ...item, expectedAmount: val } : item)
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                          <input
                            type="checkbox"
                            checked={sev.isRetirementPension}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateData(prev => ({
                                ...prev,
                                severances: prev.severances.map(item => item.id === sev.id ? { ...item, isRetirementPension: checked } : item)
                              }));
                            }}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-900">퇴직연금 (DB/DC/IRP) 전액 면제</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                      <div className="text-slate-600">
                        {sev.isRetirementPension ? '퇴직연금 적용으로 전액(100%) 청산가치에서 공제' : '일반퇴직금으로 50%(1/2)만 청산가치 반영'}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-700">퇴직금 청산가치: <strong className="text-emerald-600">{won(sev.liquidationValue)}원</strong></span>
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              severances: prev.severances.filter(item => item.id !== sev.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 3) 보험 해약환급금 & 예금 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 보험 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      보험 해약환급금 (150만 원 공제)
                    </span>
                    <button
                      onClick={() => {
                        const newIns: InsuranceItem = {
                          id: `ins-${Date.now()}`,
                          companyName: '삼성생명',
                          policyName: '통합건강보험',
                          isSecurityInsurance: true,
                          surrenderValue: 2500000,
                          policyLoanBalance: 0,
                          statutoryDeduction: 1500000,
                          liquidationValue: 1000000,
                          note: '보장성보험 150만원 공제'
                        };
                        updateData(prev => ({
                          ...prev,
                          insurances: [...prev.insurances, newIns]
                        }));
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + 보험 추가
                    </button>
                  </div>
                  {data.insurances.map((ins) => (
                    <div key={ins.id} className="p-2.5 bg-slate-50 rounded-lg space-y-2 border border-slate-200">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={ins.companyName}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateData(prev => ({
                              ...prev,
                              insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, companyName: val } : item)
                            }));
                          }}
                          className="font-bold text-xs bg-transparent border-b border-slate-300 w-24"
                          placeholder="보험사명"
                        />
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              insurances: prev.insurances.filter(item => item.id !== ins.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">환급금:</span>
                          <input
                            type="number"
                            step={100000}
                            value={ins.surrenderValue}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, surrenderValue: val } : item)
                              }));
                            }}
                            className="w-full font-bold text-right px-1 py-0.5 bg-white rounded border border-slate-200"
                          />
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">청산가치 (150만 차감):</span>
                          <p className="font-bold text-emerald-600">{won(ins.liquidationValue)}원</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 예금 및 금융자산 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      예금 및 주식 (예금 250만 원 공제)
                    </span>
                    <button
                      onClick={() => {
                        const newFa: FinancialAssetItem = {
                          id: `fa-${Date.now()}`,
                          category: 'deposit',
                          institutionName: '국민은행',
                          description: '급여통장',
                          marketValue: 3000000,
                          statutoryDeduction: EXEMPT_DEPOSIT_LIMIT_2026,
                          liquidationValue: 500000,
                          note: '예금 압류금지 250만원 공제'
                        };
                        updateData(prev => ({
                          ...prev,
                          financialAssets: [...prev.financialAssets, newFa]
                        }));
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + 계좌 추가
                    </button>
                  </div>
                  {data.financialAssets.map((fa) => (
                    <div key={fa.id} className="p-2.5 bg-slate-50 rounded-lg space-y-2 border border-slate-200">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={fa.institutionName}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateData(prev => ({
                              ...prev,
                              financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, institutionName: val } : item)
                            }));
                          }}
                          className="font-bold text-xs bg-transparent border-b border-slate-300 w-24"
                          placeholder="기관명"
                        />
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              financialAssets: prev.financialAssets.filter(item => item.id !== fa.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">잔액/평가액:</span>
                          <input
                            type="number"
                            step={100000}
                            value={fa.marketValue}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, marketValue: val } : item)
                              }));
                            }}
                            className="w-full font-bold text-right px-1 py-0.5 bg-white rounded border border-slate-200"
                          />
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">청산가치:</span>
                          <p className="font-bold text-emerald-600">{won(fa.liquidationValue)}원</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 4: 청산가치 진단 & 변제계획안 동기화                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'verification' && (
            <div className="space-y-6">
              {/* 핵심 요약 카드 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    청산가치 보장의 원칙 종합 진단 리포트
                  </h3>
                  <span className="text-xs text-slate-500">
                    채무자회생법 제614조 제1항 제4호 요건
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 청산가치 총액 */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-xs text-slate-600 font-bold">1. 채무자의 총 청산가치 (J)</div>
                    <div className="text-2xl font-black text-slate-900">{won(data.totalLiquidationValue)}원</div>
                    <p className="text-[11px] text-slate-500">
                      채무자가 파산할 경우 모든 재산을 현금화하여 채권자들에게 배당할 수 있는 순가치입니다.
                    </p>
                  </div>

                  {/* 변제계획안 총 변제액 */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-xs text-slate-600 font-bold">2. 변제계획안 총 변제예정액</div>
                    <div className="text-2xl font-black text-indigo-900">{won(currentPlanTotalRepayment)}원</div>
                    <p className="text-[11px] text-slate-500">
                      현재 설정된 월 가용소득으로 36~60개월 동안 갚을 수 있는 변제 총액입니다.
                    </p>
                  </div>
                </div>

                {/* 판정 배너 */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isLiquidationGuaranteed 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  {isLiquidationGuaranteed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-black">
                      {isLiquidationGuaranteed 
                        ? '✅ 청산가치 보장의 원칙을 완벽히 충족합니다!' 
                        : '⚠️ 청산가치 보장의 원칙 미달 (월 변제금 상향 또는 기간 연장 필요)'}
                    </h4>
                    <p className="text-[11px] mt-1 text-slate-700">
                      {isLiquidationGuaranteed
                        ? `총 변제예정액(${won(currentPlanTotalRepayment)}원)이 청산가치(${won(data.totalLiquidationValue)}원)보다 ${won(currentPlanTotalRepayment - data.totalLiquidationValue)}원 많아 법원 인가 요건을 만족합니다.`
                        : `총 변제예정액이 청산가치보다 ${won(data.totalLiquidationValue - currentPlanTotalRepayment)}원 부족합니다. 변제계획안 작성기에서 월 변제금을 상향하거나 변제기간을 60개월로 연장해야 합니다.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* 하단 동기화 액션 바 */}
              <div className="bg-indigo-950 text-white p-6 rounded-2xl flex items-center justify-between shadow-lg">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    변제계획안(D5110/D5111)으로 청산가치 실시간 전송
                  </h4>
                  <p className="text-xs text-slate-300">
                    현재 산출된 총 {data.realEstates.length + data.vehicles.length + data.leaseDeposits.length + data.insurances.length + data.severances.length + data.financialAssets.length}건의 자산과 청산가치 {won(data.totalLiquidationValue)}원을 변제계획안 작성기에 1초 만에 반영합니다.
                  </p>
                </div>
                <button
                  onClick={handleSyncToRepayment}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap"
                >
                  <span>지금 바로 변제계획안에 반영하기</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── 하단 액션 바 ── */}
        <div className="border-t border-slate-200 px-6 py-3.5 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>자산 가치 산정 완료 시:</span>
            <span className="font-bold text-slate-800">[D5102 인쇄/PDF]</span> 또는 <span className="font-bold text-emerald-700">[변제계획안 동기화]</span>를 클릭하세요.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              닫기
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? '저장 중...' : '저장하기'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 대법원 표준 [전산양식 D5102] 인쇄/PDF 모달 */}
      <PrintablePropertyListModal
        data={data}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}
