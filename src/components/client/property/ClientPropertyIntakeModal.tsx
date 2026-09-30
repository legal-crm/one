import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Car, Shield, Briefcase, DollarSign, Home, 
  ExternalLink, Plus, Trash2, CheckCircle2, AlertCircle, 
  Printer, ArrowRight, ArrowLeft, RefreshCw, FileText, 
  HelpCircle, Send, Check, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import { Badge, Button, Callout, DocModal, FormField, MoneyInput, SegmentedTabs, buildSubmitConfirm, inputClass, useDocAutosave } from '../ui';
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
  RealEstateValuationMethod,
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
  EXEMPT_PROPERTY_LIVING_LIMIT,
  RegionType
} from '../../../services/repayment/repaymentConstants2026';
import PrintablePropertyIntakeModal from './PrintablePropertyIntakeModal';

interface ClientPropertyIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  onSyncToLawyerCrm?: (updates: { propertyListD5102: PropertyListD5102Data }) => Promise<boolean | void> | boolean | void;
}

type TabKey = 'deposits' | 'vehicles' | 'leases' | 'realestates' | 'business' | 'severance' | 'summary';

const TAB_ORDER: TabKey[] = ['deposits', 'vehicles', 'leases', 'realestates', 'business', 'severance', 'summary'];

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
  // 저장본을 불러온 뒤에 변경 감지 기준점을 잡는다
  const [isLoaded, setIsLoaded] = useState(false);
  // 변호사에게 전달한 뒤 이번에 고친 내용이 있는지(다시 전달 안내)
  const [editedAfterSubmit, setEditedAfterSubmit] = useState(false);
  const dialog = useDialog();

  // 변호사 사건 기록과 연결된 화면(마이페이지)인지. 연결이 없으면(회생동행) 이 기기에만 저장된다
  const canSync = typeof onSyncToLawyerCrm === 'function';

  useEffect(() => {
    if (isOpen) {
      const loaded = ClientPropertyService.loadClientData(clientId, clientName);
      setData(loaded);
      setIsLoaded(true);
    }
  }, [isOpen, clientId, clientName]);

  // 입력이 멈추면 이 기기에 자동 저장(닫을 때도 남은 변경 저장)
  const { saveState, isDirty, saveNow, markSaved } = useDocAutosave({
    snapshot: JSON.stringify(data),
    ready: isLoaded,
    save: () => {
      ClientPropertyService.saveClientData(data);
    },
    auto: true,
  });

  // 탭을 바꾸면 탭 줄에서 보이게 하고 본문은 맨 위부터
  useEffect(() => {
    if (!isOpen) return;
    document.getElementById(`pi-tab-${activeTab}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    document.getElementById(`pi-panel-${activeTab}`)?.scrollIntoView({ block: 'start' });
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const won = (n: number) => (n || 0).toLocaleString();

  const isSubmitted = data.clientIntakeStatus === 'submitted_to_lawyer' || data.clientIntakeStatus === 'reviewed_by_lawyer';

  // 상태 업데이트 및 실시간 재계산
  const updateData = (updater: (prev: PropertyListD5102Data) => PropertyListD5102Data) => {
    setData(prev => recalculateD5102Totals(updater(prev)));
    if (isSubmitted) setEditedAfterSubmit(true);
  };

  // 닫기(X·ESC·배경): 남은 변경을 이 기기에 저장하고 닫는다
  const handleBeforeClose = async (): Promise<boolean> => {
    if (isSubmitting) return false;
    if (isDirty) await saveNow();
    return true;
  };

  const counts = ClientPropertyService.getCategoryCounts(data);

  // 담당 변호사에게 전달(연결이 없으면 작성 완료로 이 기기에 저장)
  const handleSubmitToLawyer = async () => {
    if (isSubmitting) return;
    const ok = await dialog.confirm(
      buildSubmitConfirm({
        title: canSync ? '재산 기초자료를 변호사에게 전달할까요?' : '재산 기초자료 작성을 마칠까요?',
        lines: [
          `입력한 재산 ${counts.totalCount}건`,
          `재산 평가액 합계 ${won(data.totalMarketValue)}원`,
          data.totalEncumbrance > 0 ? `담보 채무(근저당·할부) ${won(data.totalEncumbrance)}원` : null,
        ],
        note: [
          counts.totalCount === 0 ? '입력한 재산이 없어요. 가진 재산이 없다면 그대로 진행해도 됩니다.' : '',
          canSync
            ? '전달하면 담당 변호사 사건 기록에 저장되고, 변호사가 검토해 재산목록을 작성합니다.'
            : '작성 내용은 이 기기에 저장돼요. 변호사에게 보내려면 서류 전달 화면에서 공유해 주세요.',
        ].filter(Boolean).join('\n'),
        confirmText: canSync ? '전달하기' : '작성 완료',
      })
    );
    if (!ok) return;

    setIsSubmitting(true);
    try {
      const { data: submitted, synced } = await ClientPropertyService.submitToLawyer(data, onSyncToLawyerCrm);
      setData(submitted);
      markSaved();
      setEditedAfterSubmit(false);
      if (canSync && !synced) {
        toast.warning('재산 기초자료는 이 기기에 저장되었지만 변호사에게 전달하지 못했습니다. 잠시 후 다시 전달해 주세요.');
        return;
      }
      toast.success(
        canSync
          ? '재산 기초자료를 담당 변호사에게 전달했습니다. 변호사가 검토 후 재산목록을 작성합니다.'
          : '재산 기초자료 작성을 마치고 이 기기에 저장했습니다. 담당 변호사에게 보내려면 서류 전달 화면에서 공유해 주세요.'
      );
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('저장 중 오류가 발생했습니다. 입력한 내용은 그대로 있으니 잠시 후 다시 시도해 주세요.');
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

  const tabIdx = TAB_ORDER.indexOf(activeTab);
  const countBadge = (n: number) =>
    n > 0 ? (
      <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-light text-brand text-xs font-bold inline-flex items-center justify-center tabular-nums">
        {n}
        <span className="sr-only">건</span>
      </span>
    ) : null;
  const tabs: { id: TabKey; label: string; badge?: React.ReactNode }[] = [
    { id: 'deposits', label: '예금·보험', badge: countBadge(counts.depositsAndInsurances) },
    { id: 'vehicles', label: '자동차', badge: countBadge(counts.vehicles) },
    { id: 'leases', label: '임차보증금', badge: countBadge(counts.leaseDeposits) },
    { id: 'realestates', label: '부동산', badge: countBadge(counts.realEstates) },
    { id: 'business', label: '사업설비·채권', badge: countBadge(counts.businessAssets) },
    { id: 'severance', label: '퇴직금·면제재산', badge: countBadge(counts.severancesAndExempt) },
    { id: 'summary', label: canSync ? '확인·전달' : '확인·완료' },
  ];

  const submitLabel = canSync ? (isSubmitted ? '다시 전달하기' : '변호사에게 전달') : '작성 완료';

  return (
    <>
    <DocModal
      open={isOpen}
      onClose={onClose}
      onBeforeClose={handleBeforeClose}
      closeLabel="재산 기초자료 닫기"
      size="2xl"
      icon={<ClipboardList className="w-5 h-5" />}
      title="재산 기초자료 작성"
      description="가진 재산을 항목별로 적으면 담당 변호사가 검토해 법원 재산목록(D5102)을 작성합니다."
      badges={
        <>
          {isSubmitted && <Badge tone="success" icon={<Check className="w-3 h-3" aria-hidden="true" />}>{canSync ? '변호사에게 전달함' : '작성 완료'}</Badge>}
          {isSubmitted && editedAfterSubmit && canSync && <Badge tone="warning">전달 뒤 고친 내용은 다시 전달해 주세요</Badge>}
        </>
      }
      saveState={saveState}
      saveTarget="device"
      dirtyLabel="입력 중 · 잠시 뒤 자동 저장돼요"
      idleLabel="입력하면 이 기기에 자동 저장돼요"
      subHeader={
        <div className="bg-white px-4 sm:px-6 py-3 space-y-2">
          <SegmentedTabs<TabKey>
            tabs={tabs}
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="재산 항목"
            idPrefix="pi"
            fullWidth={false}
          />
          <p className="text-xs text-slate-600 tabular-nums">
            입력 {counts.totalCount}건 · 평가액 {won(data.totalMarketValue)}원
            {data.totalEncumbrance > 0 && <> · 담보 채무 {won(data.totalEncumbrance)}원</>}
          </p>
        </div>
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => setIsPrintModalOpen(true)}
            leftIcon={<Printer className="w-4 h-4" aria-hidden="true" />}
          >
            양식 미리보기
          </Button>
          <div className="flex items-center gap-2">
            {tabIdx > 0 && (
              <Button variant="ghost" onClick={() => setActiveTab(TAB_ORDER[tabIdx - 1])} leftIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}>
                이전
              </Button>
            )}
            {activeTab !== 'summary' ? (
              <Button onClick={() => setActiveTab(TAB_ORDER[tabIdx + 1])} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                다음 단계
              </Button>
            ) : (
              <Button onClick={handleSubmitToLawyer} loading={isSubmitting} leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}>
                {submitLabel}
              </Button>
            )}
          </div>
        </>
      }
    >
        <div role="tabpanel" id={`pi-panel-${activeTab}`} aria-labelledby={`pi-tab-${activeTab}`} tabIndex={-1} className="space-y-6 scroll-mt-5 outline-none">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: 예금 및 보험 (리걸플로 7-4 그림 7-8)                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'deposits' && (
            <div className="space-y-6">
              {/* 조회 안내 */}
              <Callout
                tone="info"
                title="계좌정보통합관리서비스(어카운트인포) & 내보험다보여 조회 안내"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('payinfo')}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      어카운트인포 조회
                      <span className="sr-only">(새 창)</span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('credit4u')}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      내보험다보여 조회
                      <span className="sr-only">(새 창)</span>
                    </Button>
                  </div>
                }
              >
                모든 은행의 활동성 계좌와 보험 예상해약환급금을 빠짐없이 입력해 주세요. 누락되면 법원 보정권고를 받을 수 있습니다.
              </Callout>

              {/* 예금 목록 */}
              <section aria-labelledby="pi-deposit-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 id="pi-deposit-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <DollarSign className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                      은행 예금 및 적금 계좌
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      민사집행법상 185만 원 이하의 예금은 법정 압류금지 채권으로 보호됩니다.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newFa: FinancialAssetItem = {
                        id: `fa-${Date.now()}`,
                        category: 'deposit',
                        institutionName: '',
                        description: '',
                        marketValue: 0,
                        statutoryDeduction: 1850000,
                        liquidationValue: 0,
                      };
                      updateData(prev => ({
                        ...prev,
                        financialAssets: [...prev.financialAssets, newFa]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    예금 계좌 추가
                  </Button>
                </div>

                {data.financialAssets.filter(f => f.category === 'deposit').length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 예금 계좌가 없습니다. 보유 중인 주거래 통장 잔액을 추가해 주세요.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.financialAssets.filter(f => f.category === 'deposit').map((fa, idx) => {
                      const itemLabel = [(fa.institutionName || '').trim(), (fa.description || '').trim()].filter(Boolean).join(' ') || `예금 계좌 ${idx + 1}`;
                      return (
                        <li key={fa.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">예금 계좌 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  financialAssets: prev.financialAssets.filter(item => item.id !== fa.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <FormField label="은행/금융사">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={fa.institutionName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, institutionName: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                  placeholder="예: 신한은행"
                                />
                              )}
                            </FormField>
                            <FormField label="계좌 구분/끝자리">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={fa.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, description: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                  placeholder="예: 급여통장 (1234)"
                                />
                              )}
                            </FormField>
                            <FormField label="현재 잔액" hint="압류금지 기준 적용">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={fa.marketValue || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      financialAssets: prev.financialAssets.map(item => item.id === fa.id ? { ...item, marketValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 보험 목록 */}
              <section aria-labelledby="pi-insurance-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 id="pi-insurance-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Shield className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                      보험 해약환급금
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      보장성 보험은 150만 원까지 법정 공제되며, 약관대출 잔액이 있다면 차감됩니다.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newIns: InsuranceItem = {
                        id: `ins-${Date.now()}`,
                        companyName: '',
                        policyName: '',
                        policyNumber: '',
                        isSecurityInsurance: false,
                        surrenderValue: 0,
                        policyLoanBalance: 0,
                        statutoryDeduction: 0,
                        liquidationValue: 0,
                      };
                      updateData(prev => ({
                        ...prev,
                        insurances: [...prev.insurances, newIns]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    보험 추가
                  </Button>
                </div>

                {data.insurances.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 보험이 없습니다. 본인 명의 가입 보험이 있다면 추가해 주세요.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.insurances.map((ins, idx) => {
                      const itemLabel = [(ins.companyName || '').trim(), (ins.policyName || '').trim()].filter(Boolean).join(' ') || `보험 ${idx + 1}`;
                      return (
                        <li key={ins.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">보험 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  insurances: prev.insurances.filter(item => item.id !== ins.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="보험사">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={ins.companyName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, companyName: val } : item)
                                    }));
                                  }}
                                  placeholder="예: 한화손보"
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                            <FormField label="보험 상품명">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={ins.policyName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, policyName: val } : item)
                                    }));
                                  }}
                                  placeholder="예: 실손의료비보험"
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                          </div>
                          <label className="flex items-center gap-3 min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 cursor-pointer">
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
                              className="w-5 h-5 shrink-0 accent-brand"
                            />
                            <span className="text-sm text-slate-800">보장성 보험 (150만 원 법정공제)</span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="예상 해약환급금 전액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ins.surrenderValue || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, surrenderValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                            <FormField label="보험계약 대출금(약관대출) 잔액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ins.policyLoanBalance || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      insurances: prev.insurances.map(item => item.id === ins.id ? { ...item, policyLoanBalance: val } : item)
                                    }));
                                  }}
                                  className="text-rose-700"
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: 자동차 (리걸플로 7-4 그림 7-9)                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'vehicles' && (
            <div className="space-y-6">
              <Callout
                tone="info"
                title="자동차 및 오토바이 시세 확인 팁"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('encar', data.vehicles[0]?.modelName)}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      엔카 시세 조회
                      <span className="sr-only">(새 창)</span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('kidi_car')}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      보험개발원 가액
                      <span className="sr-only">(새 창)</span>
                    </Button>
                  </div>
                }
              >
                자동차 보험 가입증명서에 기재된 가액 또는 엔카/KB차차차 중고차 평균 시세를 입력합니다. 할부 대출이 있다면 담보금액을 입력하세요.
              </Callout>

              <section aria-labelledby="pi-vehicle-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 id="pi-vehicle-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Car className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                      보유 차량 목록
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      배우자 명의 차량도 소유 관계를 골라 함께 적어 주세요. 공동명의라면 담당 변호사에게 지분을 알려 주세요.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newVeh: VehicleItem = {
                        id: `veh-${Date.now()}`,
                        type: 'car',
                        modelName: '',
                        plateNumber: '',
                        year: new Date().getFullYear(),
                        valuationMethod: 'used_avg',
                        marketValue: 0,
                        loanBalance: 0,
                        liquidationValue: 0,
                        ownerType: 'self',
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        vehicles: [...prev.vehicles, newVeh]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    차량 추가
                  </Button>
                </div>

                {data.vehicles.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 차량이 없습니다. (차량을 소유하지 않은 경우 생략 가능)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.vehicles.map((v, idx) => {
                      const itemLabel = [(v.modelName || '').trim(), (v.plateNumber || '').trim()].filter(Boolean).join(' ') || `차량 ${idx + 1}`;
                      return (
                        <li key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">차량 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  vehicles: prev.vehicles.filter(item => item.id !== v.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <FormField label="차종/모델명">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={v.modelName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, modelName: val } : item)
                                    }));
                                  }}
                                  placeholder="예: 쏘나타 DN8"
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                            <FormField label="차량번호">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={v.plateNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, plateNumber: val } : item)
                                    }));
                                  }}
                                  placeholder="예: 12가 3456"
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                            <FormField label="소유 관계">
                              {(p) => (
                                <select
                                  {...p}
                                  value={v.ownerType}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    updateData(prev => ({
                                      ...prev,
                                      vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, ownerType: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="self">본인 단독소유</option>
                                  <option value="spouse">배우자 소유</option>
                                </select>
                              )}
                            </FormField>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="현재 중고 시세">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={v.marketValue || null}
                                  onChange={(amount) => {
                                    const val = amount ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, marketValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                            <FormField label="자동차 할부/담보대출 잔액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={v.loanBalance || null}
                                  onChange={(amount) => {
                                    const val = amount ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      vehicles: prev.vehicles.map(item => item.id === v.id ? { ...item, loanBalance: val } : item)
                                    }));
                                  }}
                                  className="text-rose-700"
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: 임차보증금 (리걸플로 7-4 그림 7-10)                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'leases' && (
            <div className="space-y-6">
              <Callout tone="info" title="2026 주택임대차보호법 최우선변제 소액보증금 공제 안내">
                <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-sky-200 bg-white px-3 py-2">
                    <dt className="font-bold text-slate-900">서울특별시</dt>
                    <dd className="text-slate-700">최대 5,500만 원 공제</dd>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-white px-3 py-2">
                    <dt className="font-bold text-slate-900">과밀억제권역·세종·용인·화성·김포</dt>
                    <dd className="text-slate-700">최대 4,800만 원 공제</dd>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-white px-3 py-2">
                    <dt className="font-bold text-slate-900">광역시·안산·광주·파주·이천·평택</dt>
                    <dd className="text-slate-700">최대 2,800만 원 공제</dd>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-white px-3 py-2">
                    <dt className="font-bold text-slate-900">그 밖의 지역</dt>
                    <dd className="text-slate-700">최대 2,500만 원 공제</dd>
                  </div>
                </dl>
              </Callout>

              <section aria-labelledby="pi-lease-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 id="pi-lease-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Home className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                      임차 주택 및 상가 보증금
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      연체된 월세 및 전세대출(질권설정/양도담보) 잔액은 보증금에서 차감됩니다.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newLd: LeaseDepositItem = {
                        id: `ld-${Date.now()}`,
                        address: '',
                        depositAmount: 0,
                        unpaidRent: 0,
                        pledgeLoanAmount: 0,
                        region: 'SEOUL',
                        statutoryExemption: 55000000,
                        liquidationValue: 0,
                        leaseType: 'housing',
                        hasFixedDate: false,
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        leaseDeposits: [...prev.leaseDeposits, newLd]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    임차보증금 추가
                  </Button>
                </div>

                {data.leaseDeposits.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 임차보증금이 없습니다. (자가 주택 거주 또는 무상거주 시 생략 가능)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.leaseDeposits.map((ld, idx) => {
                      const address = (ld.address || '').trim();
                      const itemLabel = address ? `${address} 임차보증금` : `임차보증금 ${idx + 1}`;
                      return (
                        <li key={ld.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">임차보증금 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  leaseDeposits: prev.leaseDeposits.filter(item => item.id !== ld.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="소재 지역">
                              {(p) => (
                                <select
                                  {...p}
                                  value={ld.region}
                                  onChange={(e) => {
                                    const val = e.target.value as RegionType;
                                    updateData(prev => ({
                                      ...prev,
                                      leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, region: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="SEOUL">서울특별시 (공제 5,500만)</option>
                                  <option value="OVERCROWDED">과밀억제권역·세종·용인·화성·김포 (공제 4,800만)</option>
                                  <option value="METROPOLITAN">광역시·안산·광주·파주·이천·평택 (공제 2,800만)</option>
                                  <option value="OTHERS">그 밖의 지역 (공제 2,500만)</option>
                                </select>
                              )}
                            </FormField>
                            <FormField label="임차 용도">
                              {(p) => (
                                <select
                                  {...p}
                                  value={ld.leaseType}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    updateData(prev => ({
                                      ...prev,
                                      leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, leaseType: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="housing">주거용 주택</option>
                                  <option value="commercial">사업용 상가</option>
                                </select>
                              )}
                            </FormField>
                          </div>
                          <FormField label="임차 주택 소재지 주소">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                value={ld.address}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateData(prev => ({
                                    ...prev,
                                    leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, address: val } : item)
                                  }));
                                }}
                                className={inputClass}
                                placeholder="예: 서울특별시 마포구 백범로 123 (임차 주택)"
                              />
                            )}
                          </FormField>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <FormField label="계약서상 보증금">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ld.depositAmount || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, depositAmount: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                            <FormField label="연체된 월세·관리비">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ld.unpaidRent || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, unpaidRent: val } : item)
                                    }));
                                  }}
                                  className="text-rose-700"
                                />
                              )}
                            </FormField>
                            <FormField label="전세대출(질권/담보대출)">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ld.pledgeLoanAmount || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      leaseDeposits: prev.leaseDeposits.map(item => item.id === ld.id ? { ...item, pledgeLoanAmount: val } : item)
                                    }));
                                  }}
                                  className="text-rose-700"
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 4: 부동산 (리걸플로 7-4 그림 7-11)                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'realestates' && (
            <div className="space-y-6">
              <Callout
                tone="info"
                title="부동산 시세 산정 기준 안내"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('kb_realestate', data.realEstates[0]?.address)}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      KB부동산 시세
                      <span className="sr-only">(새 창)</span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenPortal('realty_price', data.realEstates[0]?.address)}
                      rightIcon={<ExternalLink className="w-4 h-4" aria-hidden="true" />}
                    >
                      부동산공시가격알리미
                      <span className="sr-only">(새 창)</span>
                    </Button>
                  </div>
                }
              >
                아파트는 KB부동산 일반평균가, 빌라·단독주택·토지는 공시가격의 130% 등으로 시가를 추정하는 경우가 많습니다. 최종 평가액은 담당 변호사가 관할법원 기준으로 확정합니다.
              </Callout>

              <section aria-labelledby="pi-realestate-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 id="pi-realestate-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Building2 className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                      보유 부동산 목록
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      공시가격을 입력하신 후 [130% 계산]을 누르면 산술치가 자동 산정됩니다.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newRe: RealEstateItem = {
                        id: `re-${Date.now()}`,
                        type: 'villa_multi',
                        address: '',
                        valuationMethod: 'public_price_130',
                        officialPublicPrice: 0,
                        marketValue: 0,
                        mortgageBalance: 0,
                        liquidationValue: 0,
                        ownerType: 'self',
                        shareRatio: 1.0,
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        realEstates: [...prev.realEstates, newRe]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    부동산 추가
                  </Button>
                </div>

                {data.realEstates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 부동산이 없습니다. (무주택자인 경우 생략 가능)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.realEstates.map((re, idx) => {
                      const itemLabel = (re.address || '').trim() || `부동산 ${idx + 1}`;
                      return (
                        <li key={re.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">부동산 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  realEstates: prev.realEstates.filter(item => item.id !== re.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="부동산 유형">
                              {(p) => (
                                <select
                                  {...p}
                                  value={re.type}
                                  onChange={(e) => {
                                    const newType = e.target.value as RealEstateType;
                                    // 유형에 맞는 평가 방법으로 함께 전환 (아파트=KB시세, 상가=실거래가, 그 외=공시가 130% 추정)
                                    const method: RealEstateValuationMethod =
                                      newType === 'apartment_officetel' ? 'kb_general'
                                      : newType === 'commercial' ? 'actual_trade'
                                      : 'public_price_130';
                                    updateData(prev => ({
                                      ...prev,
                                      realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, type: newType, valuationMethod: method } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="apartment_officetel">아파트·오피스텔 (KB시세)</option>
                                  <option value="villa_multi">연립·다세대 빌라 (공시가 130%)</option>
                                  <option value="detached_house">단독·다가구 주택 (공시가 130%)</option>
                                  <option value="land">토지/임야 (공시지가 130%)</option>
                                  <option value="commercial">상가 (실거래가)</option>
                                </select>
                              )}
                            </FormField>
                            <FormField label="소유 관계">
                              {(p) => (
                                <select
                                  {...p}
                                  value={re.ownerType}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    updateData(prev => ({
                                      ...prev,
                                      realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, ownerType: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="self">본인 단독 소유</option>
                                  <option value="spouse">배우자 소유</option>
                                  <option value="joint">공동명의</option>
                                </select>
                              )}
                            </FormField>
                          </div>
                          <FormField label="소재지 주소 (동·호수 포함)">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                value={re.address}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateData(prev => ({
                                    ...prev,
                                    realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, address: val } : item)
                                  }));
                                }}
                                className={inputClass}
                                placeholder="예: 서울특별시 마포구 공덕동 123 마포자이아파트 101동 1002호"
                              />
                            )}
                          </FormField>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="공시가격">
                              {(p) => (
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <MoneyInput
                                      {...p}
                                      value={re.officialPublicPrice || null}
                                      onChange={(v) => {
                                        const val = v ?? 0;
                                        updateData(prev => ({
                                          ...prev,
                                          realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, officialPublicPrice: val } : item)
                                        }));
                                      }}
                                    />
                                  </div>
                                  <Button
                                    variant="secondary"
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
                                    className="shrink-0"
                                  >
                                    130% 계산
                                  </Button>
                                </div>
                              )}
                            </FormField>
                            <FormField label="산정 시세">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={re.marketValue || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, marketValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                            <FormField label="근저당 담보대출 잔액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={re.mortgageBalance || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      realEstates: prev.realEstates.map(item => item.id === re.id ? { ...item, mortgageBalance: val } : item)
                                    }));
                                  }}
                                  className="text-rose-700"
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 5: 사업설비·채권 (리걸플로 7-4 그림 7-12)                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <Callout tone="info" title="사업장 기계·설비 및 대여금/외상매출금 채권 입력 안내">
                개인사업자의 경우 사업장 집기·기계의 감가상각 가액을 기재하며, 빌려준 돈이나 외상매출금 중 거래처 폐업 등으로 받을 수 없는 부실채권은 실제 회수가능액 기준으로 신고합니다.
              </Callout>

              <section aria-labelledby="pi-business-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 id="pi-business-title" className="flex items-center gap-2 text-base font-bold text-slate-900 min-w-0">
                    <Briefcase className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                    사업 설비 및 미수 채권 목록
                  </h3>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newBa: BusinessAssetItem = {
                        id: `ba-${Date.now()}`,
                        type: 'equipment',
                        name: '',
                        description: '',
                        bookValue: 0,
                        marketValue: 0,
                        encumbrance: 0,
                        liquidationValue: 0,
                        recoveryStatus: 'normal',
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        businessAssets: [...(prev.businessAssets || []), newBa]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    항목 추가
                  </Button>
                </div>

                {(!data.businessAssets || data.businessAssets.length === 0) ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 사업용 자산이나 채권이 없습니다. (해당 없는 경우 생략)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.businessAssets.map((ba, idx) => {
                      const itemLabel = (ba.name || '').trim() || `사업설비·채권 ${idx + 1}`;
                      return (
                        <li key={ba.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">사업설비·채권 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  businessAssets: (prev.businessAssets || []).filter(item => item.id !== ba.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="구분">
                              {(p) => (
                                <select
                                  {...p}
                                  value={ba.type}
                                  onChange={(e) => {
                                    const val = e.target.value as BusinessAssetType;
                                    updateData(prev => ({
                                      ...prev,
                                      businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, type: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="equipment">사업용 설비·비품</option>
                                  <option value="loan_receivable">대여금 채권 (빌려준 돈)</option>
                                  <option value="sales_receivable">외상매출금 채권 (거래처 미수금)</option>
                                </select>
                              )}
                            </FormField>
                            <FormField label="명칭 또는 채무자/거래처명">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={ba.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, name: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="장부/원금 가액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ba.bookValue || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, bookValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                            <FormField label="실제 회수가능액/평가액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={ba.marketValue || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      businessAssets: (prev.businessAssets || []).map(item => item.id === ba.id ? { ...item, marketValue: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 6: 퇴직금 & 면제재산 (리걸플로 7-4 그림 7-13)               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'severance' && (
            <div className="space-y-6">
              <Callout tone="info" title="퇴직금 및 채무자회생법 제383조 면제재산 법정 보호 안내">
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  <li><strong>퇴직연금(DB/DC/IRP)</strong>: 근로자퇴직급여보장법에 따라 전액 압류가 금지되어 청산가치에 산입되지 않습니다.</li>
                  <li><strong>일반 퇴직금</strong>: 50%(1/2)만 법정 청산가치에 반영됩니다.</li>
                  <li><strong>면제재산 신청</strong>: 6개월간 생계비(1,110만 원)를 면제재산으로 신청하여 청산가치에서 추가 차감할 수 있습니다.</li>
                </ul>
              </Callout>

              {/* 퇴직금 */}
              <section aria-labelledby="pi-severance-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 id="pi-severance-title" className="flex items-center gap-2 text-base font-bold text-slate-900 min-w-0">
                    <Shield className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                    직장 예상 퇴직금
                  </h3>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newSev: SeveranceItem = {
                        id: `sev-${Date.now()}`,
                        workplaceName: '',
                        // 퇴직연금 가입 여부는 의뢰인이 직접 확인해 체크 (기본값으로 전액 면제 처리하지 않음)
                        isRetirementPension: false,
                        expectedAmount: 0,
                        statutoryDeduction: 0,
                        liquidationValue: 0,
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        severances: [...prev.severances, newSev]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    퇴직금 추가
                  </Button>
                </div>

                {data.severances.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    등록된 퇴직금 정보가 없습니다. (급여소득자인 경우 추가해 주세요)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.severances.map((sev, idx) => {
                      const workplace = (sev.workplaceName || '').trim();
                      const itemLabel = workplace ? `${workplace} 퇴직금` : `퇴직금 ${idx + 1}`;
                      return (
                        <li key={sev.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">퇴직금 {idx + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                updateData(prev => ({
                                  ...prev,
                                  severances: prev.severances.filter(item => item.id !== sev.id)
                                }));
                              }}
                              aria-label={`${itemLabel} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="직장명">
                              {(p) => (
                                <input
                                  {...p}
                                  type="text"
                                  value={sev.workplaceName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateData(prev => ({
                                      ...prev,
                                      severances: prev.severances.map(item => item.id === sev.id ? { ...item, workplaceName: val } : item)
                                    }));
                                  }}
                                  className={inputClass}
                                />
                              )}
                            </FormField>
                            <FormField label="예상 퇴직금 총액">
                              {(p) => (
                                <MoneyInput
                                  {...p}
                                  value={sev.expectedAmount || null}
                                  onChange={(v) => {
                                    const val = v ?? 0;
                                    updateData(prev => ({
                                      ...prev,
                                      severances: prev.severances.map(item => item.id === sev.id ? { ...item, expectedAmount: val } : item)
                                    }));
                                  }}
                                />
                              )}
                            </FormField>
                          </div>
                          <label className="flex items-center gap-3 min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 cursor-pointer">
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
                              className="w-5 h-5 shrink-0 accent-brand"
                            />
                            <span className="text-sm text-slate-800">퇴직연금(DB/DC/IRP) 가입 (전액 보호)</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 면제재산 신청 희망 */}
              <section aria-labelledby="pi-exempt-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 id="pi-exempt-title" className="flex items-center gap-2 text-base font-bold text-slate-900 min-w-0">
                    <Shield className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden="true" />
                    법 제383조 제2항 면제재산 신청 희망
                  </h3>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const newEp: ExemptPropertyItem = {
                        id: `ep-${Date.now()}`,
                        type: 'living_expense_383_2',
                        appliedAmount: EXEMPT_PROPERTY_LIVING_LIMIT,
                        description: '6개월간 생계비(1,110만 원) 면제재산 신청 희망 (법원 결정 전까지 신청액)',
                        note: ''
                      };
                      updateData(prev => ({
                        ...prev,
                        exemptProperties: [...(prev.exemptProperties || []), newEp]
                      }));
                    }}
                    leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    면제재산 신청 희망 추가
                  </Button>
                </div>

                {(!data.exemptProperties || data.exemptProperties.length === 0) ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 break-keep">
                    신청 희망한 면제재산이 없습니다. (6개월 생계비 1,110만 원 보호 신청을 권장합니다)
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.exemptProperties.map((ep, idx) => (
                      <li key={ep.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                        <div className="min-w-0 py-1">
                          <p className="text-sm font-bold text-slate-900 break-keep">{ep.description}</p>
                          <p className="mt-0.5 text-sm text-slate-600 tabular-nums">신청 희망액: {won(ep.appliedAmount)}원</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateData(prev => ({
                              ...prev,
                              exemptProperties: (prev.exemptProperties || []).filter(item => item.id !== ep.id)
                            }));
                          }}
                          aria-label={`면제재산 신청 희망 ${idx + 1} 삭제`}
                          className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 7: 취합 확인 및 담당 변호사 제출                           */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* 항목별 입력 요약 — 누르면 그 항목으로 이동 */}
              <section aria-labelledby="pi-summary-title" className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                <h3 id="pi-summary-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  입력한 재산 확인
                </h3>

                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {([
                    ['deposits', '예금·보험', counts.depositsAndInsurances],
                    ['vehicles', '자동차', counts.vehicles],
                    ['leases', '임차보증금', counts.leaseDeposits],
                    ['realestates', '부동산', counts.realEstates],
                    ['business', '사업설비·채권', counts.businessAssets],
                    ['severance', '퇴직금·면제재산', counts.severancesAndExempt],
                  ] as [TabKey, string, number][]).map(([tab, label, n]) => (
                    <li key={tab}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className="w-full min-h-11 text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-brand hover:bg-brand-light/60 transition-colors"
                      >
                        <span className="block text-xs font-bold text-slate-600">{label}</span>
                        <span className="mt-0.5 block text-sm font-bold text-slate-900 tabular-nums">{n > 0 ? `${n}건` : '없음'}</span>
                        <span className="sr-only"> · 눌러서 고치기</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <dt className="font-bold text-slate-700">재산 평가액 합계</dt>
                    <dd className="font-extrabold text-slate-900 tabular-nums">{won(data.totalMarketValue)}원</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <dt className="font-bold text-slate-700">담보 채무(근저당·할부)</dt>
                    <dd className="font-extrabold text-red-700 tabular-nums">{data.totalEncumbrance > 0 ? `-${won(data.totalEncumbrance)}원` : '없음'}</dd>
                  </div>
                </dl>

                <Callout tone="warning" title="담당 변호사가 검토해 확정해요">
                  이 화면은 법원에 내는 재산목록(D5102 양식)을 만들기 위해 재산 사실관계를 모으는 자료입니다. 배우자 재산 반영 여부, 주식·가상자산 손실 처리, 담보 채권 분리, 최종 변제금은 관할 법원 실무에 따라 담당 변호사가 검토해 정합니다.
                </Callout>
              </section>

              {/* 전달 안내(전달 버튼은 하단 고정 바에 하나만) */}
              <Callout
                tone="info"
                icon={<Send className="w-4 h-4 text-sky-700" aria-hidden="true" />}
                title={canSync ? '확인이 끝나면 아래 \'변호사에게 전달\'을 눌러 주세요' : '확인이 끝나면 아래 \'작성 완료\'를 눌러 주세요'}
              >
                {canSync
                  ? '전달하면 담당 변호사 사건 기록에 저장되고, 변호사가 검토해 재산목록과 변제계획안을 작성합니다.'
                  : '작성 내용은 이 기기에 저장돼요. 담당 변호사에게 보내려면 서류 전달 화면에서 공유해 주세요.'}
              </Callout>
            </div>
          )}

        </div>
    </DocModal>

      {/* 재산목록(D5102 양식) 미리보기 — 작성 창 위에 뜨는 별도 창 */}
      {isPrintModalOpen && (
        <PrintablePropertyIntakeModal
          data={data}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </>
  );
}
