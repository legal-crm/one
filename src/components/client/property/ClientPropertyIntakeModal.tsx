import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Building2, Car, Shield, Briefcase, DollarSign, Home, 
  ExternalLink, Plus, Trash2, CheckCircle2, AlertCircle, 
  Save, Printer, ArrowRight, ArrowLeft, RefreshCw, FileText, 
  HelpCircle, Sparkles, Send, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  PropertyListD5102Data, 
  RealEstateItem, 
  VehicleItem, 
  LeaseDepositItem, 
  InsuranceItem, 
  SeveranceItem, 
  FinancialAssetItem,
  BusinessAssetItem,
  ExemptPropertyItem,
  RealEstateType,
  BusinessAssetType,
  ExemptPropertyType
} from '../../../types/propertyTypes';
import { ClientPropertyService } from '../../../services/documents/clientPropertyService';
import { 
  calculatePublicPrice130, 
  recalculateD5102Totals 
} from '../../../services/documents/propertyValuationService';
import { 
  openExternalSearchPortal, 
  ASSET_SEARCH_PORTALS 
} from '../../../services/documents/assetSearchLinks';
import { 
  REGION_CONFIG_2026, 
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  RegionType
} from '../../../services/repayment/repaymentConstants2026';
import PrintablePropertyIntakeModal from './PrintablePropertyIntakeModal';

interface ClientPropertyIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  onSyncToLawyerCrm?: (updates: { propertyListD5102: PropertyListD5102Data }) => Promise<void> | void;
}

type TabKey = 'deposits' | 'vehicles' | 'leases' | 'realestates' | 'business' | 'severance' | 'summary';

export default function ClientPropertyIntakeModal({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  onSyncToLawyerCrm
}: ClientPropertyIntakeModalProps) {
  // 로컬 데이터 상태
  const [data, setData] = useState<PropertyListD5102Data>(() => {
    return ClientPropertyService.loadClientData(clientId, clientName);
  });

  const [activeTab, setActiveTab] = useState<TabKey>('deposits');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loaded = ClientPropertyService.loadClientData(clientId, clientName);
      setData(loaded);
      setHasSaved(false);
    }
  }, [isOpen, clientId, clientName]);

  if (!isOpen) return null;

  const won = (n: number) => (n || 0).toLocaleString();

  // 상태 업데이트 및 실시간 재계산
  const updateData = (updater: (prev: PropertyListD5102Data) => PropertyListD5102Data) => {
    setData(prev => recalculateD5102Totals(updater(prev)));
    setHasSaved(false);
  };

  // 임시 저장
  const handleSaveDraft = () => {
    const saved = ClientPropertyService.saveClientData(data);
    setData(saved);
    setHasSaved(true);
    toast.success('재산상황 기초자료가 안전하게 임시 저장되었습니다.');
  };

  // 담당 변호사에게 제출
  const handleSubmitToLawyer = async () => {
    setIsSubmitting(true);
    try {
      const submitted = ClientPropertyService.submitToLawyer(data, onSyncToLawyerCrm);
      setData(submitted);
      setHasSaved(true);
      toast.success('재산 기초자료가 담당 변호사에게 전달되었습니다! 변호사가 법리 검토 후 재산목록을 최종 완성합니다.');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      toast.error('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 외부 조회 포털 연동
  const handleOpenPortal = async (portalKey: keyof typeof ASSET_SEARCH_PORTALS, query?: string) => {
    const res = await openExternalSearchPortal(portalKey, query);
    if (res.copiedQuery) {
      toast.success(`[${ASSET_SEARCH_PORTALS[portalKey]?.name}] 열림 (검색어 복사됨)`);
    } else {
      toast.info(`[${ASSET_SEARCH_PORTALS[portalKey]?.name}] 조회 페이지로 이동합니다.`);
    }
  };

  const counts = ClientPropertyService.getCategoryCounts(data);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* ── 1. 헤더 바 ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xl">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  법원 제출용 재산상황 기초자료 작성기
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  대법원 [전산양식 D5102] 연계
                </span>
                {data.clientIntakeStatus === 'submitted_to_lawyer' && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                    <Check className="w-3 h-3" /> 변호사 제출완료
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{data.clientName}</strong> · 리걸플로 매뉴얼 7-4 규격 6대 재산 사실관계 입력
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>D5102 양식 미리보기</span>
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>임시저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. 상단 신고 현황 브리핑 바 ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[11px]">등록된 자산 건수</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">총 {counts.totalCount}건 입력됨</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[11px]">신고 자산 총 평가액</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{won(data.totalMarketValue)}원</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-rose-600 text-[11px]">신고 담보 채무 (근저당/할부)</span>
              <p className="text-sm font-bold text-rose-700 mt-0.5">-{won(data.totalEncumbrance)}원</p>
            </div>
            <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-indigo-900 font-bold text-[11px]">자료 취합 상태</span>
                <p className="text-xs font-black text-indigo-700 mt-0.5">
                  {data.clientIntakeStatus === 'submitted_to_lawyer' ? '변호사 전달 완료' : '작성 진행 중'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('summary')}
                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer whitespace-nowrap"
              >
                요약 확인
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. 6대 카테고리 탭 네비게이션 ── */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'deposits'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>1. 예금 및 보험 ({counts.depositsAndInsurances}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vehicles'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>2. 자동차 ({counts.vehicles}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('leases')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'leases'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>3. 임차보증금 ({counts.leaseDeposits}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('realestates')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'realestates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>4. 부동산 ({counts.realEstates}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('business')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'business'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>5. 사업설비·채권 ({counts.businessAssets}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('severance')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'severance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>6. 퇴직금·면제재산 ({counts.severancesAndExempt}건)</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>취합 확인 및 제출</span>
          </button>
        </div>

        {/* ── 4. 탭별 본문 컨텐츠 ── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: 예금 및 보험 (리걸플로 7-4 그림 7-8)                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'deposits' && (
            <div className="space-y-6">
              {/* 조회 안내 박스 */}
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>계좌정보통합관리서비스(어카운트인포) & 내보험다보여 조회 안내</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    모든 은행의 활동성 계좌와 보험 예상해약환급금을 누락 없이 입력해야 법원 보정명령을 피할 수 있습니다.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenPortal('account_info')}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>어카운트인포 조회</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('my_insurance')}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>내보험다보여 조회</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 예금 목록 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-indigo-600" />
                      <span>은행 예금 및 적금 계좌</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      민사집행법상 185만 원 이하의 예금은 법정 압류금지 채권으로 보호됩니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newFa: FinancialAssetItem = {
                        id: `fa-${Date.now()}`,
                        category: 'deposit',
                        institutionName: '국민은행',
                        description: '급여통장 (끝자리 1234)',
                        marketValue: 500000,
                        statutoryDeduction: 1850000,
                        liquidationValue: 0,
                      };
                      updateData(prev => ({
                        ...prev,
                        financialAssets: [...prev.financialAssets, newFa]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 예금 계좌 추가</span>
                  </button>
                </div>

                {data.financialAssets.filter(f => f.category === 'deposit').length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 예금 계좌가 없습니다. 보유 중인 주거래 통장 잔액을 추가해 주세요.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.financialAssets.filter(f => f.category === 'deposit').map((fa, idx) => (
                      <div key={fa.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-center">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">은행/금융사</label>
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
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            placeholder="예: 신한은행"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">계좌 구분/끝자리</label>
                          <input
                            type="text"
                            value={fa.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateData(prev => ({
                                ...prev,
                                financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, description: val } : item)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            placeholder="예: 급여통장 (1234)"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">현재 잔액 (원)</label>
                          <input
                            type="number"
                            step={10000}
                            value={fa.marketValue}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateData(prev => ({
                                ...prev,
                                financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, marketValue: val } : item)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-4">
                          <span className="text-[11px] text-slate-400">압류금지 기준 적용</span>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                financialAssets: prev.financialAssets.filter(item => item.id !== fa.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 보험 목록 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>보험 해약환급금</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      보장성 보험은 150만 원까지 법정 공제되며, 약관대출 잔액이 있다면 차감됩니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newIns: InsuranceItem = {
                        id: `ins-${Date.now()}`,
                        companyName: '삼성생명',
                        policyName: '통합건강보험',
                        policyNumber: '',
                        isSecurityInsurance: true,
                        surrenderValue: 2000000,
                        policyLoanBalance: 0,
                        statutoryDeduction: 1500000,
                        liquidationValue: 500000,
                      };
                      updateData(prev => ({
                        ...prev,
                        insurances: [...prev.insurances, newIns]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 보험 추가</span>
                  </button>
                </div>

                {data.insurances.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 보험이 없습니다. 본인 명의 가입 보험이 있다면 추가해 주세요.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.insurances.map((ins, idx) => (
                      <div key={ins.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
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
                              placeholder="보험사명 (예: 한화손보)"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-32"
                            />
                            <input
                              type="text"
                              value={ins.policyName}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateData(prev => ({
                                  ...prev,
                                  insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, policyName: val } : item)
                                }));
                              }}
                              placeholder="보험 상품명 (예: 실손의료비보험)"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-44"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 ml-2">
                              <input
                                type="checkbox"
                                checked={ins.isSecurityInsurance}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateData(prev => ({
                                    ...prev,
                                    insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, isSecurityInsurance: checked } : item)
                                  }));
                                }}
                                className="rounded text-indigo-600"
                              />
                              <span>보장성 보험 (150만 원 법정공제)</span>
                            </label>
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                insurances: prev.insurances.filter(item => item.id !== ins.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">예상 해약환급금 전액 (원)</span>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 font-bold block mb-1">보험계약 대출금(약관대출) 잔액 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={ins.policyLoanBalance || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, policyLoanBalance: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: 자동차 (리걸플로 7-4 그림 7-9)                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'vehicles' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Car className="w-4 h-4 text-indigo-600" />
                    <span>자동차 및 오토바이 시세 확인 팁</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    자동차 보험 가입증명서에 기재된 가액 또는 엔카/KB차차차 중고차 평균 시세를 입력합니다. 할부 대출이 있다면 담보금액을 입력하세요.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenPortal('encar_price', data.vehicles[0]?.modelName)}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>엔카 시세 조회</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('kidi_car')}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>보험개발원 가액</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-600" />
                      <span>보유 차량 목록</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      배우자 명의 또는 공동명의 차량도 실질 기여도와 지분율을 입력해 주셔야 합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newVeh: VehicleItem = {
                        id: `veh-${Date.now()}`,
                        type: 'car',
                        modelName: '아반떼 CN7',
                        plateNumber: '12가 3456',
                        year: 2021,
                        valuationMethod: 'used_avg',
                        marketValue: 15000000,
                        loanBalance: 8000000,
                        liquidationValue: 7000000,
                        ownerType: 'self',
                        note: '캐피탈 할부금 잔액 차감'
                      };
                      updateData(prev => ({
                        ...prev,
                        vehicles: [...prev.vehicles, newVeh]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 차량 추가</span>
                  </button>
                </div>

                {data.vehicles.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 차량이 없습니다. (차량을 소유하지 않은 경우 생략 가능)
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.vehicles.map((v, idx) => (
                      <div key={v.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
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
                              placeholder="차종/모델명 (예: 쏘나타 DN8)"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-40"
                            />
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
                              placeholder="차량번호 (예: 12가 3456)"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-28"
                            />
                            <select
                              value={v.ownerType}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                updateData(prev => ({
                                  ...prev,
                                  vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, ownerType: val } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1"
                            >
                              <option value="self">본인 단독소유</option>
                              <option value="spouse">배우자 소유</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                vehicles: prev.vehicles.filter(item => item.id !== v.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">현재 중고 시세 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={v.marketValue}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, marketValue: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 font-bold block mb-1">자동차 할부/담보대출 잔액 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={v.loanBalance}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, loanBalance: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: 임차보증금 (리걸플로 7-4 그림 7-10)                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'leases' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-2 text-xs">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>2026 주택임대차보호법 최우선변제 소액보증금 공제 안내</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="font-bold text-slate-900 block">서울특별시</span>
                    최대 5,500만 원 공제
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="font-bold text-slate-900 block">과밀억제권역/용인/화성</span>
                    최대 4,800만 원 공제
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="font-bold text-slate-900 block">광역시/안산/평택 등</span>
                    최대 2,800만 원 공제
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="font-bold text-slate-900 block">그 밖의 지역</span>
                    최대 2,500만 원 공제
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Home className="w-4 h-4 text-indigo-600" />
                      <span>임차 주택 및 상가 보증금</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      연체된 월세 및 전세대출(질권설정/양도담보) 잔액은 보증금에서 차감됩니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newLd: LeaseDepositItem = {
                        id: `ld-${Date.now()}`,
                        address: '서울특별시 마포구 ',
                        depositAmount: 50000000,
                        unpaidRent: 0,
                        pledgeLoanAmount: 0,
                        region: 'SEOUL',
                        statutoryExemption: 55000000,
                        liquidationValue: 0,
                        leaseType: 'housing',
                        hasFixedDate: true,
                        note: '확정일자부 임대차계약서'
                      };
                      updateData(prev => ({
                        ...prev,
                        leaseDeposits: [...prev.leaseDeposits, newLd]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 임차보증금 추가</span>
                  </button>
                </div>

                {data.leaseDeposits.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 임차보증금이 없습니다. (자가 주택 거주 또는 무상거주 시 생략 가능)
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.leaseDeposits.map((ld, idx) => (
                      <div key={ld.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <select
                              value={ld.region}
                              onChange={(e) => {
                                const val = e.target.value as RegionType;
                                updateData(prev => ({
                                  ...prev,
                                  leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, region: val } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                            >
                              <option value="SEOUL">서울특별시 (공제 5,500만)</option>
                              <option value="OVERCROWDED">수도권 과밀억제권역/세종/용인/화성 (공제 4,800만)</option>
                              <option value="METROPOLITAN">광역시/안산/평택 등 (공제 2,800만)</option>
                              <option value="OTHERS">그 밖의 지역 (공제 2,500만)</option>
                            </select>
                            <select
                              value={ld.leaseType}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                updateData(prev => ({
                                  ...prev,
                                  leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, leaseType: val } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1"
                            >
                              <option value="housing">주거용 주택</option>
                              <option value="commercial">사업용 상가</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                leaseDeposits: prev.leaseDeposits.filter(item => item.id !== ld.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">임차 주택 소재지 주소</label>
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
                            placeholder="예: 서울특별시 마포구 백범로 123 (임차 주택)"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">계약서상 보증금 (원)</span>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 font-bold block mb-1">연체된 월세·관리비 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={ld.unpaidRent || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, unpaidRent: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-700"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 font-bold block mb-1">전세대출(질권/담보대출) (원)</span>
                            <input
                              type="number"
                              step={1000000}
                              value={ld.pledgeLoanAmount || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, pledgeLoanAmount: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 4: 부동산 (리걸플로 7-4 그림 7-11)                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'realestates' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>부동산 시세 산정 기준 안내</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    아파트는 KB부동산 일반평균가, 빌라·단독주택·토지는 국토부 공시가격의 130% 공식이 실무상 적용됩니다.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenPortal('kb_land', data.realEstates[0]?.address)}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>KB부동산 시세</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleOpenPortal('realty_price', data.realEstates[0]?.address)}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <span>부동산공시가격알리미</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>보유 부동산 목록</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      공시가격을 입력하신 후 [공시가 130% 자동 계산]을 누르면 산술치가 자동 산정됩니다.
                    </p>
                  </div>
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
                        note: '공시가격 130% 적용'
                      };
                      updateData(prev => ({
                        ...prev,
                        realEstates: [...prev.realEstates, newRe]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 부동산 추가</span>
                  </button>
                </div>

                {data.realEstates.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 부동산이 없습니다. (무주택자인 경우 생략 가능)
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.realEstates.map((re, idx) => (
                      <div key={re.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <select
                              value={re.type}
                              onChange={(e) => {
                                const newType = e.target.value as RealEstateType;
                                updateData(prev => ({
                                  ...prev,
                                  realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, type: newType } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                            >
                              <option value="apartment_officetel">아파트·오피스텔 (KB시세)</option>
                              <option value="villa_multi">연립·다세대 빌라 (공시가 130%)</option>
                              <option value="detached_house">단독·다가구 주택 (공시가 130%)</option>
                              <option value="land">토지/임야 (공시지가 130%)</option>
                              <option value="commercial">상가 (실거래가)</option>
                            </select>
                            <select
                              value={re.ownerType}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                updateData(prev => ({
                                  ...prev,
                                  realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, ownerType: val } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1"
                            >
                              <option value="self">본인 단독 소유</option>
                              <option value="spouse">배우자 소유</option>
                              <option value="joint">공동명의</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                realEstates: prev.realEstates.filter(item => item.id !== re.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">소재지 주소 (동·호수 포함)</label>
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
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            placeholder="예: 서울특별시 마포구 공덕동 123 마포자이아파트 101동 1002호"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">공시가격 (원)</span>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                step={1000000}
                                value={re.officialPublicPrice || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  updateData(prev => ({
                                    ...prev,
                                    realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, officialPublicPrice: val } : item)
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (re.officialPublicPrice) {
                                    const calculated = calculatePublicPrice130(re.officialPublicPrice);
                                    updateData(prev => ({
                                      ...prev,
                                      realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, marketValue: calculated } : item)
                                    }));
                                    toast.success('공시가격 130% 공식이 시세에 자동 반영되었습니다.');
                                  }
                                }}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 shrink-0 whitespace-nowrap cursor-pointer"
                              >
                                130% 계산
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-indigo-900 font-bold block mb-1">산정 시세 (원)</span>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-right font-bold text-indigo-950 text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 font-bold block mb-1">근저당 담보대출 잔액 (원)</span>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-700 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 5: 사업설비·채권 (리걸플로 7-4 그림 7-12)                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 text-xs text-indigo-950">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>사업장 기계·설비 및 대여금/외상매출금 채권 입력 안내</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  개인사업자의 경우 사업장 집기·기계의 감가상각 가액을 기재하며, 빌려준 돈이나 외상매출금 중 거래처 폐업 등으로 받을 수 없는 부실채권은 실제 회수가능액 기준으로 신고합니다.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <span>사업 설비 및 미수 채권 목록</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      const newBa: BusinessAssetItem = {
                        id: `ba-${Date.now()}`,
                        type: 'equipment',
                        name: '사업장 영업 집기 및 비품',
                        description: '',
                        bookValue: 3000000,
                        marketValue: 1000000,
                        encumbrance: 0,
                        liquidationValue: 1000000,
                        recoveryStatus: 'normal',
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        businessAssets: [...(prev.businessAssets || []), newBa]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 항목 추가</span>
                  </button>
                </div>

                {(!data.businessAssets || data.businessAssets.length === 0) ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 사업용 자산이나 채권이 없습니다. (해당 없는 경우 생략)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.businessAssets.map((ba, idx) => (
                      <div key={ba.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <select
                              value={ba.type}
                              onChange={(e) => {
                                const val = e.target.value as BusinessAssetType;
                                updateData(prev => ({
                                  ...prev,
                                  businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, type: val } : item)
                                }));
                              }}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                            >
                              <option value="equipment">사업용 설비·비품</option>
                              <option value="loan_receivable">대여금 채권 (빌려준 돈)</option>
                              <option value="sales_receivable">외상매출금 채권 (거래처 미수금)</option>
                            </select>
                            <input
                              type="text"
                              value={ba.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateData(prev => ({
                                  ...prev,
                                  businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, name: val } : item)
                                }));
                              }}
                              placeholder="명칭 또는 채무자/거래처명"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-44"
                            />
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                businessAssets: (prev.businessAssets || []).filter(item => item.id !== ba.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">장부/원금 가액 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={ba.bookValue}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, bookValue: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-indigo-900 font-bold block mb-1">실제 회수가능액/평가액 (원)</span>
                            <input
                              type="number"
                              step={100000}
                              value={ba.marketValue}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateData(prev => ({
                                  ...prev,
                                  businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, marketValue: val } : item)
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-right font-bold text-indigo-950"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 6: 퇴직금 & 면제재산 (리걸플로 7-4 그림 7-13)               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'severance' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>퇴직금 및 채무자회생법 제383조 면제재산 법정 보호 안내</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  • <strong>퇴직연금(DB/DC/IRP)</strong>: 근로자퇴직급여보장법에 따라 전액 압류가 금지되어 청산가치에 산입되지 않습니다.<br/>
                  • <strong>일반 퇴직금</strong>: 50%(1/2)만 법정 청산가치에 반영됩니다.<br/>
                  • <strong>면제재산 신청</strong>: 6개월간 생계비(1,110만 원)를 면제재산으로 신청하여 청산가치에서 추가 차감할 수 있습니다.
                </p>
              </div>

              {/* 퇴직금 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>직장 예상 퇴직금</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      const newSev: SeveranceItem = {
                        id: `sev-${Date.now()}`,
                        workplaceName: '현재 직장',
                        isRetirementPension: true,
                        expectedAmount: 20000000,
                        statutoryDeduction: 20000000,
                        liquidationValue: 0,
                        note: 'DC형 퇴직연금 가입'
                      };
                      updateData(prev => ({
                        ...prev,
                        severances: [...prev.severances, newSev]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 퇴직금 추가</span>
                  </button>
                </div>

                {data.severances.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    등록된 퇴직금 정보가 없습니다. (급여소득자인 경우 추가해 주세요)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.severances.map((sev, idx) => (
                      <div key={sev.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
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
                              placeholder="직장명"
                              className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-lg w-40"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-indigo-900 ml-2 font-bold">
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
                                className="rounded text-indigo-600"
                              />
                              <span>퇴직연금(DB/DC/IRP) 가입 (전액 보호)</span>
                            </label>
                          </div>
                          <button
                            onClick={() => {
                              updateData(prev => ({
                                ...prev,
                                severances: prev.severances.filter(item => item.id !== sev.id)
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block mb-1">예상 퇴직금 총액 (원)</span>
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
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 면제재산 신청 희망 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>법 제383조 제2항 면제재산 신청 희망</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      const newEp: ExemptPropertyItem = {
                        id: `ep-${Date.now()}`,
                        type: 'living_expense_383_2',
                        appliedAmount: 11100000,
                        description: '6개월간 생계비(1,110만 원) 면제재산 신청 희망',
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        exemptProperties: [...(prev.exemptProperties || []), newEp]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 flex items-center gap-1 cursor-pointer press-scale"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 면제재산 신청 희망 추가</span>
                  </button>
                </div>

                {(!data.exemptProperties || data.exemptProperties.length === 0) ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    신청 희망한 면제재산이 없습니다. (6개월 생계비 1,110만 원 보호 신청을 권장합니다)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.exemptProperties.map((ep, idx) => (
                      <div key={ep.id} className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-emerald-950 block">{ep.description}</span>
                          <span className="text-[11px] text-slate-500">신청 희망액: {won(ep.appliedAmount)}원</span>
                        </div>
                        <button
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              exemptProperties: (prev.exemptProperties || []).filter(item => item.id !== ep.id)
                            }));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 7: 취합 확인 및 담당 변호사 제출                           */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* 카테고리별 등록 요약 카드 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>의뢰인 재산상황 기초자료 취합 요약표</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">1. 예금 및 보험</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.depositsAndInsurances}건
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">2. 자동차</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.vehicles}건
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">3. 임차보증금</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.leaseDeposits}건
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">4. 부동산</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.realEstates}건
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">5. 사업설비·채권</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.businessAssets}건
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">6. 퇴직금·면제신청</span>
                    <span className="font-black text-slate-900 text-sm mt-1 block">
                      총 {counts.severancesAndExempt}건
                    </span>
                  </div>
                </div>

                {/* 법적 고지 (변호사법 준수) */}
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-950">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-amber-900">변호사법에 따른 중요 법적 고지 안내</h4>
                    <p className="text-[11px] leading-relaxed text-amber-900/90">
                      본 입력표는 법원에 제출할 대법원 표준 재산목록(D5102) 서식 작성을 위해 의뢰인님의 재산 사실관계를 취합·정리하는 양식입니다. 
                      관할 법원(서울/수원 등 회생법원) 실무준칙에 따른 배우자 재산 0% 배제 심사, 코인/주식 손실금 청산가치 제외 특례 적용, 
                      별제권부 채권 분리 및 최종 변제금 확정은 <strong>담당 변호사의 전문 법률 검토를 통해 확정</strong>됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 제출 CTA 카드 */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-sm font-black flex items-center justify-center sm:justify-start gap-2">
                    <Send className="w-4 h-4 text-indigo-400" />
                    담당 변호사에게 재산 기초자료 전달하기
                  </h4>
                  <p className="text-xs text-slate-300">
                    작성하신 재산 내역이 변호사 전자 CRM에 즉시 전송되어, 담당 변호사가 법원 서류와 변제계획안을 완성합니다.
                  </p>
                </div>
                <button
                  onClick={handleSubmitToLawyer}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? '전달 중...' : '담당 변호사에게 전달하기'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── 5. 하단 고정 네비게이션 바 ── */}
        <div className="border-t border-slate-200 px-6 py-3.5 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            총 <strong className="text-slate-800">{counts.totalCount}건</strong>의 재산 사실관계 등록됨
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              닫기
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Save className="w-3.5 h-3.5" />
              <span>임시저장</span>
            </button>
            {activeTab !== 'summary' ? (
              <button
                onClick={() => {
                  const tabs: TabKey[] = ['deposits', 'vehicles', 'leases', 'realestates', 'business', 'severance', 'summary'];
                  const curIdx = tabs.indexOf(activeTab);
                  if (curIdx < tabs.length - 1) {
                    setActiveTab(tabs[curIdx + 1]);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <span>다음 단계</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmitToLawyer}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>변호사에게 전달</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 대법원 [전산양식 D5102] 미리보기 모달 */}
      <PrintablePropertyIntakeModal
        data={data}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}
