import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Scale, Calculator, FileSpreadsheet, Printer, RotateCcw, AlertTriangle, 
  CheckCircle2, Info, ChevronDown, ChevronUp, Sliders, Edit3, Lock, 
  Unlock, Save, Sparkles, Building2, Coins, ArrowRight, ShieldCheck,
  Calendar, Users, Home, HeartPulse, GraduationCap, DollarSign, Download,
  Trash2, Plus, FileText, MapPin, Search, X, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  RepaymentPlanData, 
  RepaymentCreditor, 
  RepaymentAsset,
  AssetCategory,
  IncomeAndExpenseInput,
  RepaymentFormType 
} from '../../../services/repayment/repaymentTypes';
import { 
  buildRepaymentPlan,
  calculateLivingExpenseAndDisposableIncome,
  calculateTotalLiquidationValue,
  calculateAssetLiquidationValue
} from '../../../services/repayment/repaymentCalculationEngine';
import { exportCourtRepaymentScheduleExcel } from '../../../services/repayment/repaymentExcelExporter';
import { convertDebtItemsToRepaymentCreditors } from '../../../services/repayment/debtCertificateService';
import { matchCreditorPreset, searchCreditorAddress, CREDITOR_DIRECTORY, type CreditorDirectoryItem } from '../../../services/court/creditorAddressDirectory';
import PrintableRepaymentPlanModal from './PrintableRepaymentPlanModal';
import SecuredDebtCalculatorModal from './SecuredDebtCalculatorModal';
import IncomeExpenseModal from './IncomeExpenseModal';
import PropertyValuationModal from '../assets/PropertyValuationModal';
import CreditorAddressModal from './CreditorAddressModal';
import { REGION_CONFIG_2026, RegionType } from '../../../services/repayment/repaymentConstants2026';

interface RepaymentPlanEditorProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

export default function RepaymentPlanEditor({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
}: RepaymentPlanEditorProps) {
  // ── 1. 기본 입력 상태 초기화 ──
  const initialIncome = clientRequest.financialProfile?.income 
    ? clientRequest.financialProfile.income * 10000 
    : 3500000;

  const [incomeExpense, setIncomeExpense] = useState<IncomeAndExpenseInput>(() => {
    if (crmExt.repaymentPlan?.incomeExpense) {
      return crmExt.repaymentPlan.incomeExpense;
    }
    return {
      incomeType: 'salary',
      monthlyNetIncome: initialIncome,
      householdSize: clientRequest.financialProfile?.dependents ? clientRequest.financialProfile.dependents + 1 : 2,
      region: 'SEOUL',
      actualHousingExpense: 600000,
      actualMedicalExpense: 0,
      numberOfChildren: Math.max(0, (clientRequest.financialProfile?.dependents || 1) - 1),
      educationExpensePerChild: 0,
      isSpecialEducation: false,
      otherApprovedExpense: 0,
      trusteeType: 'INTERNAL',
    };
  });

  // 재산 목록 상태
  const [assets, setAssets] = useState<RepaymentAsset[]>(() => {
    if (crmExt.repaymentPlan?.assets && crmExt.repaymentPlan.assets.length > 0) {
      return crmExt.repaymentPlan.assets;
    }
    const initialAssetTotal = (clientRequest.financialProfile?.assetsTotal || 0) * 10000;
    return [
      {
        id: 'asset_1',
        category: 'DEPOSIT',
        name: '예금/적금 잔액',
        marketValue: Math.min(3000000, Math.round(initialAssetTotal * 0.3)),
        encumbrance: 0,
        statutoryDeduction: 1850000,
        liquidationValue: Math.max(0, Math.min(3000000, Math.round(initialAssetTotal * 0.3)) - 1850000),
      },
      {
        id: 'asset_2',
        category: 'INSURANCE',
        name: '보장성보험 환급금',
        marketValue: Math.min(2500000, Math.round(initialAssetTotal * 0.2)),
        encumbrance: 0,
        statutoryDeduction: 1500000,
        liquidationValue: Math.max(0, Math.min(2500000, Math.round(initialAssetTotal * 0.2)) - 1500000),
      },
      {
        id: 'asset_3',
        category: 'HOUSING_DEPOSIT',
        name: '주거 임차보증금',
        marketValue: Math.max(0, initialAssetTotal - 5500000),
        encumbrance: 0,
        statutoryDeduction: 55000000,
        liquidationValue: Math.max(0, Math.max(0, initialAssetTotal - 5500000) - 55000000),
      },
    ];
  });

  // 채권자 목록 상태
  const [creditors, setCreditors] = useState<RepaymentCreditor[]>(() => {
    if (crmExt.repaymentPlan?.creditors && crmExt.repaymentPlan.creditors.length > 0) {
      return crmExt.repaymentPlan.creditors;
    }
    // 부채증명서 대행에 등록된 채권자가 있다면 우선 매핑
    const debtOrders = crmExt.debtCertificateOrders;
    if (debtOrders && debtOrders.length > 0 && debtOrders[0].items.length > 0) {
      return convertDebtItemsToRepaymentCreditors(debtOrders[0].items);
    }

    const totalDebt = (clientRequest.financialProfile?.debtTotal || 6000) * 10000;
    const p1 = matchCreditorPreset('국민은행');
    const p2 = matchCreditorPreset('신한카드');
    const p3 = matchCreditorPreset('OK저축은행');

    return [
      {
        id: 'cred_1',
        creditorNumber: 1,
        name: '국민은행',
        principal: Math.round(totalDebt * 0.5),
        interest: 0,
        isSecured: false,
        isUnconfirmed: false,
        isPriority: false,
        allocationRatio: 0.5,
        monthlyRepayment: 0,
        totalRepayment: 0,
        repaymentRate: 0,
        zipCode: p1?.zipCode || '07331',
        address: p1?.address || '서울특별시 영등포구 의사당대로 141 (여의도동)',
        serviceAddress: p1?.serviceAddress || '서울특별시 영등포구 의사당대로 141, 여의도영업부 (법원송달팀)',
        representative: p1?.representative || '은행장 이재근',
        bizNumber: p1?.bizNumber || '201-81-47789',
        debtCauseDetail: '대여금 / 신용대출',
        borrowedDate: '2023-05-15',
      },
      {
        id: 'cred_2',
        creditorNumber: 2,
        name: '신한카드',
        principal: Math.round(totalDebt * 0.3),
        interest: 0,
        isSecured: false,
        isUnconfirmed: false,
        isPriority: false,
        allocationRatio: 0.3,
        monthlyRepayment: 0,
        totalRepayment: 0,
        repaymentRate: 0,
        zipCode: p2?.zipCode || '04543',
        address: p2?.address || '서울특별시 중구 을지로 100, 파인에비뉴 A동 (을지로2가)',
        serviceAddress: p2?.serviceAddress || '서울특별시 중구 을지로 100, 파인에비뉴 A동 사후관리팀',
        representative: p2?.representative || '대표이사 문동권',
        bizNumber: p2?.bizNumber || '202-81-48079',
        debtCauseDetail: '신용카드 대금',
        borrowedDate: '2023-08-20',
      },
      {
        id: 'cred_3',
        creditorNumber: 3,
        name: 'OK저축은행',
        principal: Math.round(totalDebt * 0.2),
        interest: 0,
        isSecured: false,
        isUnconfirmed: false,
        isPriority: false,
        allocationRatio: 0.2,
        monthlyRepayment: 0,
        totalRepayment: 0,
        repaymentRate: 0,
        zipCode: p3?.zipCode || '04523',
        address: p3?.address || '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층',
        serviceAddress: p3?.serviceAddress || '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 여신관리실',
        representative: p3?.representative || '대표이사 정길호',
        bizNumber: p3?.bizNumber || '214-81-88987',
        debtCauseDetail: '금원차용(신용대출)',
        borrowedDate: '2024-01-10',
      },
    ];
  });

  // 채권자 송달주소 및 법인정보 편집 모달 상태
  const [editingAddressCreditor, setEditingAddressCreditor] = useState<RepaymentCreditor | null>(null);

  // ── 2. 실무자 수동 미세 조정 상태 (Fine-tuning Overrides) ──
  const [isManualMode, setIsManualMode] = useState<boolean>(
    crmExt.repaymentPlan?.isManuallyOverridden || false
  );
  const [manualMonths, setManualMonths] = useState<number>(
    crmExt.repaymentPlan?.months || 36
  );
  const [manualMonthlyRepayment, setManualMonthlyRepayment] = useState<number | undefined>(
    crmExt.repaymentPlan?.overrideMonthlyRepayment
  );
  const [customCreditorMonthly, setCustomCreditorMonthly] = useState<Record<string, number>>({});
  const [adjusterMemo, setAdjusterMemo] = useState<string>(
    crmExt.repaymentPlan?.adjusterMemo || ''
  );
  const [startYearMonth, setStartYearMonth] = useState<string>(
    crmExt.repaymentPlan?.startYearMonth || '2026-12'
  );
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState<number>(
    crmExt.repaymentPlan?.paymentDayOfMonth || 25
  );

  // 우선권 채권 2단계 자동 분할 배분 모드 (기본 18개월)
  const [isTwoStageRepayment, setIsTwoStageRepayment] = useState<boolean>(
    crmExt.repaymentPlan?.isTwoStageRepayment || false
  );
  const [stage1Months, setStage1Months] = useState<number>(
    crmExt.repaymentPlan?.stage1Months || 18
  );
  const [selectedSecuredCreditor, setSelectedSecuredCreditor] = useState<RepaymentCreditor | null>(null);

  // 모달 제어
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isD5103ModalOpen, setIsD5103ModalOpen] = useState(false);
  const [isD5102ModalOpen, setIsD5102ModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'plan' | 'income' | 'assets'>('plan');

  // ── 3. 핵심 엔진 연산 실행 (2026 Engine + Fine-tuning) ──
  const plan: RepaymentPlanData = useMemo(() => {
    return buildRepaymentPlan({
      clientId,
      clientName: clientRequest.clientName || '의뢰인',
      courtName: (clientRequest as any).court || clientRequest.financialProfile?.selectedCourt || '서울회생법원',
      caseNumber: crmExt.courtCase?.caseNumber || '',
      startYearMonth,
      paymentDayOfMonth,
      incomeExpense,
      assets,
      creditors,
      manualOverride: isManualMode
        ? {
            months: manualMonths,
            monthlyRepayment: manualMonthlyRepayment,
            creditorMonthlyRepayments: Object.keys(customCreditorMonthly).length > 0 ? customCreditorMonthly : undefined,
            adjusterMemo,
            isTwoStageRepayment,
            stage1Months,
          }
        : (isTwoStageRepayment ? { isTwoStageRepayment, stage1Months } : undefined),
    });
  }, [
    clientId,
    clientRequest.clientName,
    (clientRequest as any).court,
    clientRequest.financialProfile?.selectedCourt,
    crmExt.courtCase?.caseNumber,
    startYearMonth,
    paymentDayOfMonth,
    incomeExpense,
    assets,
    creditors,
    isManualMode,
    manualMonths,
    manualMonthlyRepayment,
    customCreditorMonthly,
    adjusterMemo,
    isTwoStageRepayment,
    stage1Months,
  ]);

  // 채권자별 인라인 월 변제금 개별 수정 핸들러
  const handleCreditorMonthlyChange = (creditorId: string, val: number) => {
    setIsManualMode(true);
    setCustomCreditorMonthly((prev) => ({
      ...prev,
      [creditorId]: val,
    }));
  };

  // 채권자 속성 토글 (우선권 / 미확정 공탁유보 / 별제권)
  const handleToggleCreditorFlag = (
    creditorId: string,
    flag: 'isPriority' | 'isUnconfirmedReserve' | 'isSecured'
  ) => {
    setCreditors((prev) =>
      prev.map((c) => {
        if (c.id === creditorId) {
          const nextVal = !c[flag];
          const updated = { ...c, [flag]: nextVal };
          if (flag === 'isPriority' && nextVal) {
            setIsTwoStageRepayment(true);
            toast.info('우선권(세금/보험) 채권이 설정되어 2단계 분할 배분 모드가 활성화되었습니다.');
          }
          if (flag === 'isSecured' && nextVal) {
            setTimeout(() => setSelectedSecuredCreditor(c), 50);
          }
          return updated;
        }
        return c;
      })
    );
  };

  // 별제권 예정부족액 계산 결과 반영
  const handleApplySecuredCalculation = (
    creditorId: string,
    shortageAmount: number,
    details: any
  ) => {
    setCreditors((prev) =>
      prev.map((c) => {
        if (c.id === creditorId) {
          return {
            ...c,
            principal: shortageAmount,
            securedShortageInfo: details,
            isSecured: false, // 별제권 예정부족액은 일반 회생채권으로 변제계획안에 산입
          };
        }
        return c;
      })
    );
    toast.success('별제권 예정부족액이 일반 회생채권 원금으로 산입되었습니다.');
  };

  // 신규 채권자 추가
  const handleAddNewCreditor = () => {
    const newId = `cred_${Date.now()}`;
    const newCred: RepaymentCreditor = {
      id: newId,
      creditorNumber: creditors.length + 1,
      name: '신규 채권사',
      principal: 10000000,
      interest: 0,
      isSecured: false,
      isUnconfirmed: false,
      isPriority: false,
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
    };
    setCreditors((prev) => [...prev, newCred]);
    toast.success('새 채권자가 추가되었습니다.');
  };

  // 채권자 삭제
  const handleDeleteCreditor = (creditorId: string) => {
    if (creditors.length <= 1) {
      toast.error('최소 1개 이상의 채권자가 필요합니다.');
      return;
    }
    setCreditors((prev) =>
      prev
        .filter((c) => c.id !== creditorId)
        .map((c, idx) => ({ ...c, creditorNumber: idx + 1 }))
    );
    toast.info('채권자가 삭제되었습니다.');
  };

  // ── 재산 목록 수동 미세 조정 CRUD ──
  // 신규 재산 항목 추가
  const handleAddNewAsset = () => {
    const newId = `asset_${Date.now()}`;
    const newAsset: RepaymentAsset = {
      id: newId,
      category: 'DEPOSIT',
      name: '새 예금/자산',
      marketValue: 1000000,
      encumbrance: 0,
      statutoryDeduction: 1850000,
      liquidationValue: 0,
    };
    setAssets((prev) => [...prev, newAsset]);
    setIsManualMode(true);
    toast.success('새 재산 항목이 추가되었습니다.');
  };

  // 재산 항목 삭제
  const handleDeleteAsset = (assetId: string) => {
    if (assets.length <= 1) {
      toast.error('최소 1개 이상의 재산 항목이 필요합니다.');
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setIsManualMode(true);
    toast.info('재산 항목이 삭제되었습니다.');
  };

  // 재산 항목 필드 업데이트
  const handleUpdateAsset = (assetId: string, updates: Partial<RepaymentAsset>) => {
    setIsManualMode(true);
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id === assetId) {
          const merged = { ...a, ...updates };

          // 카테고리 변경 시 법정 공제액 자동 제안
          if (updates.category && updates.category !== a.category) {
            if (updates.category === 'DEPOSIT') {
              merged.statutoryDeduction = 1850000;
            } else if (updates.category === 'INSURANCE') {
              merged.statutoryDeduction = 1500000;
            } else if (updates.category === 'HOUSING_DEPOSIT') {
              merged.statutoryDeduction = incomeExpense.region === 'SEOUL' ? 55000000 : 48000000;
            } else if (updates.category === 'RETIREMENT') {
              merged.statutoryDeduction = Math.round(merged.marketValue * 0.5);
            } else {
              merged.statutoryDeduction = 0;
            }
          }

          // 청산가치 계산: max(0, marketValue - encumbrance - statutoryDeduction)
          let calculatedLiquidation = 0;
          if (merged.category === 'RETIREMENT' && merged.isRetirementPension) {
            calculatedLiquidation = 0;
          } else if (merged.category === 'ADDITIONAL_INCLUSION') {
            calculatedLiquidation = merged.marketValue;
          } else {
            calculatedLiquidation = Math.max(0, merged.marketValue - merged.encumbrance - merged.statutoryDeduction);
          }

          return {
            ...merged,
            liquidationValue: calculatedLiquidation,
          };
        }
        return a;
      })
    );
  };

  // 자동 추천안으로 전체 리셋
  const handleResetToAuto = () => {
    setIsManualMode(false);
    setManualMonthlyRepayment(undefined);
    setCustomCreditorMonthly({});
    setManualMonths(plan.formType === 'D5110' && plan.months === 60 ? 60 : 36);
    toast.success('2026년 법원 표준 알고리즘에 따른 자동 추천안으로 재계산되었습니다.');
  };

  // 60개월로 자동 연장 원클릭 적용
  const handleApply60MonthsExtension = () => {
    setIsManualMode(true);
    setManualMonths(60);
    toast.info('변제기간을 60개월로 연장하여 청산가치 보장 여부를 재계산했습니다.');
  };

  // 청산가치 충족을 위한 최소 월 변제금 자동 상향 원클릭 적용
  const handleApplyMinTargetRepayment = () => {
    const minTarget = Math.ceil(plan.totalLiquidationValue / plan.leibnizFactor);
    setIsManualMode(true);
    setManualMonthlyRepayment(minTarget);
    setCustomCreditorMonthly({});
    toast.info(`청산가치 보장을 위해 월 변제금을 ${minTarget.toLocaleString()}원으로 상향 조정했습니다.`);
  };

  // 우선권 채권 1/2 기한 충족을 위한 필요 가용소득 원클릭 적용
  const handleApplyPriorityIncomeRaise = () => {
    if (plan.priorityFeasibility?.requiredDisposableForHalfPeriod) {
      setIsManualMode(true);
      setManualMonthlyRepayment(plan.priorityFeasibility.requiredDisposableForHalfPeriod);
      setCustomCreditorMonthly({});
      toast.info(`우선채권 1/2 기간 완납을 위해 월 변제금을 ${plan.priorityFeasibility.requiredDisposableForHalfPeriod.toLocaleString()}원으로 상향했습니다.`);
    }
  };

  // 부채증명서 발급 대행 데이터 동기화
  const handleSyncFromDebtCerts = () => {
    const debtOrders = crmExt.debtCertificateOrders;
    if (!debtOrders || debtOrders.length === 0 || debtOrders[0].items.length === 0) {
      toast.error('등록된 부채증명서 발급 내역이 없습니다. 먼저 [부채증명서] 탭에서 채권사를 등록해 주세요.');
      return;
    }
    const syncedCreditors = convertDebtItemsToRepaymentCreditors(debtOrders[0].items);
    setCreditors(syncedCreditors);
    setCustomCreditorMonthly({});
    toast.success(`부채증명서 발급 탭에서 ${syncedCreditors.length}개 채권사의 최신 원금·이자 내역을 불러왔습니다!`);
  };

  // 변제계획안 CRM 저장
  const handleSavePlan = async () => {
    try {
      await onUpdateCrmExt({
        repaymentPlan: plan,
      });
      toast.success('변제계획안이 CRM 사건 정보에 성공적으로 저장되었습니다.');
    } catch (err) {
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-slate-50/50 min-h-[85vh]">
      
      {/* ── 1. 상단 종합 대시보드 (Key Status & Badges) ── */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    2026 개인회생 변제계획안 에디터
                  </h2>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    plan.formType === 'D5111'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}>
                    전산양식 {plan.formType} {plan.formType === 'D5111' ? '(재산처분 병행)' : '(가용소득 전용)'}
                  </span>
                  {isManualMode && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      실무자 미세조정 중
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  관할: {plan.courtName} | 신청인: {plan.clientName} | 2026 법원 준칙 라이프니쯔 현가 검증
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isManualMode ? (
              <button
                onClick={handleResetToAuto}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>엔진 자동 추천안 리셋</span>
              </button>
            ) : (
              <button
                onClick={() => setIsManualMode(true)}
                className="px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>수동 미세조정 모드</span>
              </button>
            )}

            <button
              onClick={() => exportCourtRepaymentScheduleExcel(plan)}
              className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>변제예정액표 엑셀 다운로드</span>
            </button>

            <button
              onClick={() => setIsD5102ModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              title="대법원 [전산양식 D5102] 재산목록 편집 및 11대 자산 가치 산정 허브"
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>D5102 자산·재산목록</span>
            </button>

            <button
              onClick={() => setIsD5103ModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              title="대법원 [전산양식 D5103] 수입 및 지출에 관한 목록 편집 및 서식 출력"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span>D5103 수입·지출</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>D5110 전문 인쇄/PDF</span>
            </button>

            <button
              onClick={handleSavePlan}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>저장</span>
            </button>
          </div>
        </div>

        {/* ── 2. 핵심 지표 카드 5종 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-6">
          
          {/* 카드 1: 월 변제금 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500">월 변제금 (가용소득)</span>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono">
              {plan.monthlyRepaymentTotal.toLocaleString()}원
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {plan.months}개월간 납부 (매월 {plan.paymentDayOfMonth}일)
            </div>
          </div>

          {/* 카드 2: 총 변제액 & 탕감률 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">총 변제예정액</span>
              <span className="text-xs font-bold text-blue-600 font-mono">
                변제율 {plan.totalRepaymentRate}%
              </span>
            </div>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono">
              {Math.round(plan.totalRepaymentAmount / 10000).toLocaleString()}만원
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-bold">
              총 {Math.round(plan.totalForgivenAmount / 10000).toLocaleString()}만원 탕감 ({plan.forgivenessRate}%)
            </div>
          </div>

          {/* 카드 3: 청산가치 vs 현재가치 비교 (가장 중요) */}
          <div className={`p-4 rounded-2xl border ${
            plan.satisfiesLiquidationGuarantee 
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
              : 'bg-rose-50/60 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">청산가치 보장 원칙</span>
              {plan.satisfiesLiquidationGuarantee ? (
                <span className="text-[10px] font-black bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded">
                  통과 (L ≥ J)
                </span>
              ) : (
                <span className="text-[10px] font-black bg-rose-200/80 text-rose-800 px-1.5 py-0.5 rounded">
                  미달 (L &lt; J)
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1 font-mono">
              <span className="text-lg font-black">
                {Math.round(plan.presentValue / 10000).toLocaleString()}만
              </span>
              <span className="text-xs opacity-70">
                / {Math.round(plan.totalLiquidationValue / 10000).toLocaleString()}만원
              </span>
            </div>
            <div className="mt-1 text-[11px] opacity-80">
              라이프니쯔 현가: {plan.presentValue.toLocaleString()}원
            </div>
          </div>

          {/* 카드 4: 최저변제액 충족 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">법정 최저변제액</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                충족
              </span>
            </div>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono">
              {Math.round(plan.minimumRepaymentThreshold / 10000).toLocaleString()}만원
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              총 채무액 대비 법정 하한선
            </div>
          </div>

          {/* 카드 5: 변제기간 & 일정 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500">변제 일정</span>
            <div className="mt-2 text-base font-black text-slate-900 font-mono">
              {plan.startYearMonth} ~ {plan.endYearMonth}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              총 {plan.months}회 납부 (매월 {plan.paymentDayOfMonth}일)
            </div>
          </div>

        </div>

        {/* ── 청산가치 미달 시 실무자 가이드 배너 ── */}
        {!plan.satisfiesLiquidationGuarantee && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black">
                  청산가치 보장 원칙 미달 (인가 불가 위험)
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  총변제액의 현재가치({plan.presentValue.toLocaleString()}원)가 청산가치({plan.totalLiquidationValue.toLocaleString()}원)보다{' '}
                  <strong className="font-bold underline">
                    {(plan.totalLiquidationValue - plan.presentValue).toLocaleString()}원
                  </strong> 부족합니다. 법원 인가를 위해 변제기간을 연장하거나 월 변제금을 상향해야 합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {plan.months < 60 && (
                <button
                  onClick={handleApply60MonthsExtension}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  60개월로 연장하기
                </button>
              )}
              <button
                onClick={handleApplyMinTargetRepayment}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-xl transition-colors cursor-pointer border border-rose-300 whitespace-nowrap"
              >
                필요 최소변제금 자동 상향
              </button>
            </div>
          </div>
        )}

        {/* ── 우선권 채권 1/2 회차 초과 시 인가 불허 경고 배너 ── */}
        {plan.priorityFeasibility && !plan.priorityFeasibility.canSettleWithinHalfPeriod && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-amber-900">
                    우선권 채권 변제기간 초과 위험 (세금 체납액 과다로 인가 불허 위험)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                    법원 실무준칙(1/2 기한 완납)
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  우선권 채권(조세·공과금 합계 <strong className="font-bold underline">{(plan.totalPriorityDebt || 0).toLocaleString()}원</strong>)은 법원 실무상 총 변제기간의 1/2(<strong className="font-bold">{plan.priorityFeasibility.maxStage1Months}회차</strong>) 이내에 완납되어야 합니다. 현재 가용소득으로는 최소 <strong className="font-bold text-rose-700">{plan.priorityFeasibility.minRequiredMonths}회차</strong>가 소요되므로 변제기간 연장 또는 가용소득 상향 보정이 필수적입니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {plan.months < 60 && (
                <button
                  onClick={handleApply60MonthsExtension}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  60개월로 연장하기
                </button>
              )}
              {plan.priorityFeasibility.requiredDisposableForHalfPeriod && (
                <button
                  onClick={handleApplyPriorityIncomeRaise}
                  className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors cursor-pointer border border-amber-300 whitespace-nowrap"
                >
                  필요 가용소득으로 상향 ({plan.priorityFeasibility.requiredDisposableForHalfPeriod.toLocaleString()}원)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 데이터 연동 및 작성 프로세스 파이프라인 안내 ── */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 p-4 rounded-2xl border border-blue-200/70 text-xs text-slate-700 space-y-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-black">법원 변제계획안 데이터 파이프라인 안내</span>
          </div>
          <span className="text-[11px] text-blue-800 font-bold bg-white/90 px-2.5 py-0.5 rounded-full border border-blue-200 self-start sm:self-auto">
            실무 연동 가이드
          </span>
        </div>
        <p className="leading-relaxed text-slate-600 text-xs">
          의뢰인의 최초 <strong>"내 상황 체크하기"</strong> 정보는 상담 접수용 추정치입니다. 실제 법원(전자소송) 제출 서식은 아래 3개 워크스페이스에서 <strong>[부채증명서 발급 확정액]</strong>, <strong>[소득 및 추가생계비 증빙]</strong>, <strong>[재산공제 후 청산가치]</strong>를 정밀 확정하여 100% 자동 완성됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
          <div className="bg-white/90 p-3 rounded-xl border border-blue-100/80 shadow-2xs flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
            <div>
              <div className="font-bold text-slate-900 text-xs">부채증명서 발급 대행 연동</div>
              <div className="text-[11px] text-slate-500 mt-0.5">금융사별 확정원금·개시전이자·담보권·우선권 자동 반영</div>
            </div>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border border-emerald-100/80 shadow-2xs flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
            <div>
              <div className="font-bold text-slate-900 text-xs">2026 생계비 & 가용소득</div>
              <div className="text-[11px] text-slate-500 mt-0.5">중위 60% 기초생계비 + 주거·의료·교육비 정밀 산정</div>
            </div>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border border-purple-100/80 shadow-2xs flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
            <div>
              <div className="font-bold text-slate-900 text-xs">청산가치 보장 & 현가 검증</div>
              <div className="text-[11px] text-slate-500 mt-0.5">압류금지·소액임차 공제 및 라이프니쯔 현가 실시간 판정</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. 하단 섹션 탭 & 워크스페이스 ── */}
      <div className="space-y-4">
        
        {/* 서브 섹션 선택 바 */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          {[
            { id: 'plan', label: '채권자별 안분표 및 수동 미세조정', icon: Sliders },
            { id: 'income', label: '소득 및 2026 생계비 설정', icon: DollarSign },
            { id: 'assets', label: '재산 목록 및 청산가치(J)', icon: Home },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── SECTION 1: 채권자별 안분표 & 담당자 미세 수동 조정 (핵심 기능!) ── */}
        {activeSection === 'plan' && (
          <div className="space-y-6">
            
            {/* 상단 컨트롤러 (변제기간 슬라이더, 월 변제금 오버라이드, 변제일 설정) */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    실무자 미세 조정 파라미터 (Fine-Tuning Controls)
                  </h3>
                </div>
                <div className="text-xs text-slate-500">
                  슬라이더를 움직이거나 금액을 직접 입력하면 실시간으로 현가 및 변제율이 재계산됩니다.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                
                {/* 1. 변제기간 슬라이더 (24 ~ 60개월) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600">변제기간 (개월수)</span>
                    <span className="font-mono text-purple-700 font-black text-sm">
                      {plan.months}개월
                    </span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="60"
                    step="1"
                    value={plan.months}
                    onChange={(e) => {
                      setIsManualMode(true);
                      setManualMonths(Number(e.target.value));
                    }}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>24개월(특례)</span>
                    <span className="font-bold text-slate-600">36개월(기본)</span>
                    <span>48개월</span>
                    <span className="font-bold text-purple-600">60개월(최장)</span>
                  </div>
                </div>

                {/* 2. 월 가용소득 강제 오버라이드 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600">월 총 변제금 오버라이드</span>
                    {plan.isManuallyOverridden && (
                      <span className="text-[10px] text-purple-600 font-semibold">수동 입력됨</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={manualMonthlyRepayment ?? plan.monthlyRepaymentTotal}
                      onChange={(e) => {
                        setIsManualMode(true);
                        setManualMonthlyRepayment(Number(e.target.value) || 0);
                        setCustomCreditorMonthly({});
                      }}
                      className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:bg-white outline-none"
                      placeholder="원 단위 입력"
                    />
                    <span className="text-xs text-slate-500 font-bold shrink-0">원</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    생계비 계산 기준 가용소득: {plan.calculatedLiving.actualDisposableIncome.toLocaleString()}원
                  </p>
                </div>

                {/* 3. 변제 시작월 & 매월 변제기일 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">
                      변제 시작월
                    </label>
                    <input
                      type="month"
                      value={startYearMonth}
                      onChange={(e) => {
                        setIsManualMode(true);
                        setStartYearMonth(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:bg-white outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">
                      매월 납부일
                    </label>
                    <select
                      value={paymentDayOfMonth}
                      onChange={(e) => {
                        setIsManualMode(true);
                        setPaymentDayOfMonth(Number(e.target.value));
                      }}
                      className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:bg-white outline-none"
                    >
                      <option value="5">매월 5일</option>
                      <option value="10">매월 10일</option>
                      <option value="15">매월 15일</option>
                      <option value="20">매월 20일</option>
                      <option value="25">매월 25일 (표준)</option>
                    </select>
                  </div>
                </div>

                {/* 4. 우선권 채권 2단계 자동 분할 배분 엔진 */}
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      우선권 2단계 분할 배분
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsTwoStageRepayment(!isTwoStageRepayment)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                        isTwoStageRepayment
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {isTwoStageRepayment ? '2단계 ON' : '1단계 기본'}
                    </button>
                  </div>

                  {isTwoStageRepayment ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">1단계 기간 (세금 완납):</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max={plan.months - 1}
                            value={stage1Months}
                            onChange={(e) => setStage1Months(Number(e.target.value) || 1)}
                            className="w-12 px-1.5 py-0.5 text-center font-mono font-bold text-xs bg-white border border-indigo-200 rounded-lg outline-none"
                          />
                          <span className="text-slate-500 font-bold">회차</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-indigo-800 leading-tight">
                        1~{plan.stage1Months}회차(세금 전액완제) ➔ {plan.stage1Months + 1}~{plan.months}회차(일반채권 전액 재배분)
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-tight">
                      국세/지방세/건보료 채권이 있을 시 전체 변제기간의 1/2 내 우선 완납하도록 2단계로 자동 배분합니다.
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* 채권자별 안분표 (인라인 셀 직접 편집) */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      개인회생채권 변제예정액표 (채권자별 안분 상세)
                    </h3>
                    {plan.isTwoStageRepayment && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        2단계 분할 배분 적용됨 (1단계 1~{plan.stage1Months}회 / 2단계 {plan.stage1Months + 1}~{plan.months}회)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    서울회생법원 규칙에 따라 원 미만은 올림(Math.ceil) 처리되었습니다. 개별 채권자의 월 변제금과 우선권/공탁유보 여부를 직접 설정할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncFromDebtCerts}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="[부채증명서] 탭에서 대행업체를 통해 발급 완료된 채권사 및 확정 금액을 불러옵니다"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>부채증명서 내역 불러오기</span>
                  </button>
                  <button
                    onClick={handleAddNewCreditor}
                    className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ 채권자 추가</span>
                  </button>
                  <div className="text-xs font-bold text-slate-600">
                    채권자 총 {plan.creditors.length}개사 | 원금: {(plan.totalPrincipal / 10000).toLocaleString()}만원
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">번호</th>
                      <th className="py-3 px-4">채권자명 및 유형</th>
                      <th className="py-3 px-3 text-right">원금 (원)</th>
                      <th className="py-3 px-3 text-right">개시전이자</th>
                      <th className="py-3 px-3 text-center">안분비율</th>
                      {plan.isTwoStageRepayment ? (
                        <>
                          <th className="py-3 px-3 text-right w-36 bg-amber-50/60 text-amber-900 border-x border-amber-200">
                            1단계 월변제금 (1~{plan.stage1Months}회)
                          </th>
                          <th className="py-3 px-3 text-right w-36 bg-indigo-50/60 text-indigo-900 border-r border-indigo-200">
                            2단계 월변제금 ({plan.stage1Months + 1}~{plan.months}회)
                          </th>
                        </>
                      ) : (
                        <th className="py-3 px-4 text-right w-44">
                          월 변제예정액 (수정가능)
                        </th>
                      )}
                      <th className="py-3 px-4 text-right">총 변제예정액</th>
                      <th className="py-3 px-3 text-center">변제율</th>
                      <th className="py-3 px-3 text-center w-16">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plan.creditors.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          {c.creditorNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                              <button
                                type="button"
                                onClick={() => setEditingAddressCreditor(c)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border press-scale ${
                                  c.address
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }`}
                                title={c.address ? `${c.address} (${c.zipCode || '우편번호 없음'}) - 클릭하여 수정` : '대법원 전자소송 송달을 위해 주소를 입력해 주세요 (클릭)'}
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                <span>{c.address ? '주소완료' : '송달주소 입력필요'}</span>
                              </button>
                            </div>
                            
                            {c.address && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs" title={`${c.serviceAddress || c.address} (우: ${c.zipCode || '-'})`}>
                                📍 {c.serviceAddress || c.address}
                              </div>
                            )}
                            
                            {/* 채권 유형 칩 버튼 3종 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleToggleCreditorFlag(c.id, 'isPriority')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                  c.isPriority
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                                title="국세, 지방세, 건강보험료 등 우선권 채권 (전체기간 1/2 내 우선완납)"
                              >
                                {c.isPriority ? '★ 우선권(세금)' : '+ 우선권'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleCreditorFlag(c.id, 'isUnconfirmedReserve')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                  c.isUnconfirmedReserve
                                    ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                                title="채권액 미확정 또는 별제권 행사 미료 채권 (법원 공탁 유보금 분리)"
                              >
                                {c.isUnconfirmedReserve ? '🛡️ 공탁유보' : '+ 공탁유보'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleCreditorFlag(c.id, 'isSecured')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                  c.isSecured
                                    ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                                title="담보대출 별제권 채권 (담보평가액 초과 예정부족액만 회생채권 산입)"
                              >
                                {c.isSecured ? '🔒 담보(별제권)' : '+ 별제권'}
                              </button>

                              {c.isSecured && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSecuredCreditor(c)}
                                  className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white hover:bg-rose-700 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Calculator className="w-3 h-3" />
                                  <span>예정부족액 계산</span>
                                </button>
                              )}
                            </div>

                            {/* 별제권 예정부족액 산출 정보 안내 */}
                            {c.securedShortageInfo && (
                              <div className="text-[10px] text-rose-700 bg-rose-50/70 px-2 py-0.5 rounded border border-rose-200">
                                담보평가액: {Math.round(c.securedShortageInfo.assessedCollateralValue / 10000).toLocaleString()}만원 ➔ 예정부족액: {Math.round(c.securedShortageInfo.calculatedShortage / 10000).toLocaleString()}만원 산입됨
                              </div>
                            )}

                            {/* 미확정 공탁 유보금 안내 */}
                            {c.isUnconfirmedReserve && (
                              <div className="text-[10px] text-purple-700 bg-purple-50/70 px-2 py-0.5 rounded border border-purple-200">
                                인가 확정 시까지 법원 공탁소 유보 (월 {c.monthlyRepayment.toLocaleString()}원)
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {c.principal.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {c.interest.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                          {(c.allocationRatio * 100).toFixed(2)}%
                        </td>

                        {/* 2단계 분할 배분 모드 컬럼 또는 단일 모드 컬럼 */}
                        {plan.isTwoStageRepayment ? (
                          <>
                            <td className="py-2 px-3 text-right font-mono font-bold bg-amber-50/30 border-x border-amber-100">
                              {c.isPriority ? (
                                <span className="text-amber-950">
                                  {(c.stage1MonthlyRepayment || c.monthlyRepayment).toLocaleString()}원
                                </span>
                              ) : (
                                <span className="text-slate-700">
                                  {(c.stage1MonthlyRepayment || 0).toLocaleString()}원
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold bg-indigo-50/30 border-r border-indigo-100">
                              {c.isPriority ? (
                                <span className="text-emerald-600 text-[11px] font-bold">
                                  0원 (1단계 완납)
                                </span>
                              ) : (
                                <span className="text-indigo-950">
                                  {(c.stage2MonthlyRepayment || c.monthlyRepayment).toLocaleString()}원
                                </span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="py-2 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={c.monthlyRepayment}
                                onChange={(e) =>
                                  handleCreditorMonthlyChange(c.id, Number(e.target.value) || 0)
                                }
                                className="w-32 px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 bg-purple-50/50 hover:bg-purple-50 border border-purple-200 rounded-lg focus:border-purple-600 focus:bg-white outline-none"
                              />
                              <span className="text-[11px] text-slate-500 font-bold">원</span>
                            </div>
                          </td>
                        )}

                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                          {c.totalRepayment.toLocaleString()}원
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={c.repaymentRate >= 50 ? 'text-emerald-600' : 'text-slate-700'}>
                            {c.repaymentRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCreditor(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="채권자 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* 합계 행 */}
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 text-center text-slate-800">
                        합계 ({plan.creditors.length}개사)
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900">
                        {plan.totalPrincipal.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {plan.totalInterest.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-900">
                        100.0%
                      </td>
                      {plan.isTwoStageRepayment ? (
                        <>
                          <td className="py-3 px-3 text-right font-mono text-amber-950 font-black text-xs bg-amber-50/50 border-x border-amber-200">
                            월 {plan.stage1MonthlyRepaymentTotal?.toLocaleString() || plan.monthlyRepaymentTotal.toLocaleString()}원
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-indigo-950 font-black text-xs bg-indigo-50/50 border-r border-indigo-200">
                            월 {plan.stage2MonthlyRepaymentTotal?.toLocaleString() || plan.monthlyRepaymentTotal.toLocaleString()}원
                          </td>
                        </>
                      ) : (
                        <td className="py-3 px-4 text-right font-mono text-purple-900 font-black text-sm">
                          {plan.monthlyRepaymentTotal.toLocaleString()}원
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono text-blue-900 font-black text-sm">
                        {plan.totalRepaymentAmount.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-blue-900">
                        {plan.totalRepaymentRate}%
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 하단 요약 정보 카드: 우선권 채무 및 미확정 공탁 유보금 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-950">★ 우선권 채권 총액</span>
                    <span className="font-mono font-bold text-amber-900">
                      {(plan.totalPriorityDebt || 0).toLocaleString()}원
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 mt-1">
                    {plan.isTwoStageRepayment
                      ? `제1회차부터 제${plan.stage1Months}회차까지 전액 우선 변제 충당`
                      : '우선권 채권 2단계 분할 배분 모드를 권장합니다.'}
                  </p>
                </div>

                <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-950">🛡️ 미확정 공탁 유보금</span>
                    <span className="font-mono font-bold text-purple-900">
                      {(plan.totalUnconfirmedReserve || 0).toLocaleString()}원
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800/80 mt-1">
                    {plan.totalUnconfirmedReserve && plan.totalUnconfirmedReserve > 0
                      ? `인가 확정 시까지 회생위원 공탁계좌에 매월 ${Math.round(plan.totalUnconfirmedReserve / plan.months).toLocaleString()}원 적립`
                      : '미확정 채권이 없습니다.'}
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-950">💵 확정 채권 실지급 월액</span>
                    <span className="font-mono font-bold text-blue-900">
                      {(plan.monthlyRepaymentTotal - Math.round((plan.totalUnconfirmedReserve || 0) / plan.months)).toLocaleString()}원
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800/80 mt-1">
                    전체 가용소득 중 공탁 유보금을 제외하고 채권자들에게 즉시 배당되는 월 총액
                  </p>
                </div>
              </div>

            </div>

            {/* 실무자 메모 란 */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                실무자 미세 조정 사유 및 법원 보정 대비 메모
              </label>
              <textarea
                value={adjusterMemo}
                onChange={(e) => {
                  setAdjusterMemo(e.target.value);
                  setIsManualMode(true);
                }}
                rows={2}
                placeholder="예: 청산가치 충족을 위해 변제기간 60개월로 연장 및 월 변제금 559,251원으로 상향함. 생계비 축소 소명서 첨부 예정."
                className="w-full px-4 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white outline-none"
              />
            </div>

          </div>
        )}

        {/* ── SECTION 2: 소득 및 2026 생계비 설정 ── */}
        {activeSection === 'income' && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                소득 및 2026년 기준 생계비 산정 설정
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                2026년 중위소득 60% 기초생계비와 서울회생법원 지역별 추가 주거비/의료비/교육비 준칙이 자동 연동됩니다.
              </p>
            </div>

            {/* D5103 정밀 연동 배너 */}
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                  📄
                </span>
                <div>
                  <h4 className="text-xs font-black text-amber-950">
                    대법원 공식 [전산양식 D5103] 수입 및 지출에 관한 목록 정밀 에디터
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    급여·상여금·세금공제 상세, 피부양자 동거 가족관계 명세를 정밀 편집하고 법원 제출용 A4 서식을 즉시 출력할 수 있습니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsD5103ModalOpen(true)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale shadow-xs whitespace-nowrap"
              >
                <span>D5103 정밀 편집 / 서식 출력</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  월 평균 실수령 소득 (세후)
                </label>
                <input
                  type="number"
                  value={incomeExpense.monthlyNetIncome}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, monthlyNetIncome: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  부양가족 수 (본인 포함, 0.5인 가능)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={incomeExpense.householdSize}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, householdSize: Number(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                />
                <span className="text-[11px] text-slate-400">
                  맞벌이 공동부양 시 0.5인 적용 (예: 2.5인)
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  거주 지역 (추가 주거비 한도 기준)
                </label>
                <select
                  value={incomeExpense.region}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, region: e.target.value as RegionType })
                  }
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                >
                  <option value="SEOUL">서울특별시 (한도 863,069원)</option>
                  <option value="OVERCROWDED">수도권 과밀억제권역 / 세종 / 용인 / 화성 (한도 703,983원)</option>
                  <option value="METROPOLITAN">광역시 / 안산 / 김포 / 광주 / 파주 (한도 503,652원)</option>
                  <option value="OTHERS">그 밖의 지역 (한도 450,623원)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  실제 월 주거비 지출 (월세/이자)
                </label>
                <input
                  type="number"
                  value={incomeExpense.actualHousingExpense}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, actualHousingExpense: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                />
                <span className="text-[11px] text-blue-600 font-semibold">
                  추가 주거비 인정액: {plan.calculatedLiving.additionalHousingDeduction.toLocaleString()}원
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  실제 월 의료비 지출 (지병/치료)
                </label>
                <input
                  type="number"
                  value={incomeExpense.actualMedicalExpense}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, actualMedicalExpense: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  외부 회생위원 선임 여부
                </label>
                <select
                  value={incomeExpense.trusteeType}
                  onChange={(e) =>
                    setIncomeExpense({ ...incomeExpense, trusteeType: e.target.value as any })
                  }
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
                >
                  <option value="INTERNAL">내부 회생위원 (법원 사무관 - 보수 0%)</option>
                  <option value="EXTERNAL">외부 회생위원 (변호사/회계사 - 가용소득 1% 차감)</option>
                </select>
              </div>
            </div>

            {/* 생계비 계산 요약 박스 */}
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-wrap gap-6 items-center text-xs">
              <div>
                <span className="text-slate-500">2026 기초생계비: </span>
                <strong className="font-mono text-slate-900">{plan.calculatedLiving.baseLivingExpense.toLocaleString()}원</strong>
              </div>
              <div>
                <span className="text-slate-500">인정 추가생계비: </span>
                <strong className="font-mono text-slate-900">{plan.calculatedLiving.totalAdditionalExpense.toLocaleString()}원</strong>
              </div>
              <div>
                <span className="text-slate-500">최종 인정 총 생계비: </span>
                <strong className="font-mono text-blue-900 font-bold text-sm">{plan.calculatedLiving.finalTotalLivingExpense.toLocaleString()}원</strong>
              </div>
              <div>
                <span className="text-slate-500">기준 가용소득: </span>
                <strong className="font-mono text-emerald-700 font-bold text-sm">{plan.calculatedLiving.actualDisposableIncome.toLocaleString()}원</strong>
              </div>
            </div>

          </div>
        )}

        {/* ── SECTION 3: 재산 목록 및 청산가치(J) ── */}
        {activeSection === 'assets' && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">
                    재산 목록 및 청산가치 산정표
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    실무자 직접 수정 가능
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  각 자산의 시가, 담보액, 법정 공제액을 직접 입력하거나 새 자산을 추가할 수 있습니다.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddNewAsset}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ 재산 항목 추가</span>
                </button>
                <div className="text-right pl-3 border-l border-slate-200">
                  <span className="text-xs text-slate-500">총 청산가치(J): </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {plan.totalLiquidationValue.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* D5102 정밀 연동 배너 */}
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-sm">
                  🏛️
                </span>
                <div>
                  <h4 className="text-xs font-black text-indigo-950">
                    대법원 공식 [전산양식 D5102] 재산목록 & 11대 자산 가치 산정 허브
                  </h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    KB부동산 시세, 공시가격 130% 공식, 엔카/보험개발원 중고차 시세, 2026 소액임차보증금 공제를 적용하여 청산가치를 원클릭으로 동기화합니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsD5102ModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale shadow-xs whitespace-nowrap"
              >
                <span>D5102 자산조회 & 동기화 허브 열기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-44">재산 구분</th>
                    <th className="py-3 px-3 min-w-[140px]">항목명</th>
                    <th className="py-3 px-3 text-right w-32">시가/평가액 (원)</th>
                    <th className="py-3 px-3 text-right w-32">담보/채무액 (원)</th>
                    <th className="py-3 px-3 text-right w-32">법정 공제액 (원)</th>
                    <th className="py-3 px-3 text-right w-32">청산가치 반영액</th>
                    <th className="py-3 px-2 text-center w-12">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 재산 구분 */}
                      <td className="py-2.5 px-3">
                        <select
                          value={a.category}
                          onChange={(e) => handleUpdateAsset(a.id, { category: e.target.value as AssetCategory })}
                          className="w-full px-2 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                        >
                          <option value="DEPOSIT">예금/적금 (185만 공제)</option>
                          <option value="INSURANCE">보험환급금 (150만 공제)</option>
                          <option value="HOUSING_DEPOSIT">주거 임차보증금</option>
                          <option value="CAR">자동차</option>
                          <option value="REAL_ESTATE">부동산</option>
                          <option value="RETIREMENT">퇴직금/퇴직연금</option>
                          <option value="ADDITIONAL_INCLUSION">가산재산 (주식/코인)</option>
                          <option value="OTHER">기타 재산</option>
                        </select>
                      </td>

                      {/* 항목명 */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) => handleUpdateAsset(a.id, { name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                          placeholder="항목명 입력"
                        />
                        {a.category === 'RETIREMENT' && (
                          <label className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!a.isRetirementPension}
                              onChange={(e) => handleUpdateAsset(a.id, { isRetirementPension: e.target.checked })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>퇴직연금(DB/DC/IRP) 전액 비반영(0원)</span>
                          </label>
                        )}
                      </td>

                      {/* 시가/평가액 */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={a.marketValue}
                          onChange={(e) => handleUpdateAsset(a.id, { marketValue: Number(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-right font-mono font-bold text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                        />
                      </td>

                      {/* 담보/채무액 */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={a.encumbrance}
                          onChange={(e) => handleUpdateAsset(a.id, { encumbrance: Number(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-right font-mono text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                        />
                      </td>

                      {/* 법정 공제액 */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={a.statutoryDeduction}
                          onChange={(e) => handleUpdateAsset(a.id, { statutoryDeduction: Number(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-right font-mono text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                        />
                      </td>

                      {/* 청산가치 반영액 */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 text-sm">
                        {a.liquidationValue.toLocaleString()}원
                      </td>

                      {/* 삭제 버튼 */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(a.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="재산 항목 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-right text-slate-700">
                      총 청산가치 (J) 합계
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">
                      {plan.totalLiquidationValue.toLocaleString()}원
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 법정 공제 기준 안내 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-slate-600 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px]">💰 예금 압류금지 공제</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  민사집행법 제246조에 따라 금융기관별 개인 예금 총 185만 원까지 공제
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px]">🛡️ 보장성보험 환급금 공제</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  보장성 보험 해약환급금 중 150만 원 한도 내 면제재산 자동 공제
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px]">🏠 소액임차보증금 공제</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  주택임대차보호법상 서울 5,500만 / 과밀 4,800만 / 광역시 2,800만 공제
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px]">🏢 퇴직금 / 가산재산</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  일반퇴직금은 50% 반영, IRP 등 퇴직연금은 0원. 주식·코인 손실액은 전액 합산
                </p>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── 4. 별제권(담보채권) 예정부족액 계산 모달 ── */}
      {selectedSecuredCreditor && (
        <SecuredDebtCalculatorModal
          isOpen={!!selectedSecuredCreditor}
          onClose={() => setSelectedSecuredCreditor(null)}
          creditorName={selectedSecuredCreditor.name}
          initialTotalDebt={selectedSecuredCreditor.principal}
          onApply={(shortage, info) => {
            handleApplySecuredCalculation(selectedSecuredCreditor.id, shortage, info);
          }}
        />
      )}

      {/* ── 5. 전산양식 D5110/D5111 PDF/인쇄 모달 ── */}
      <PrintableRepaymentPlanModal
        plan={plan}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        lawyerName={activeLawyerName}
      />

      {/* ── 6. 대법원 전산양식 D5103 수입 및 지출에 관한 목록 모달 ── */}
      {isD5103ModalOpen && (
        <IncomeExpenseModal
          isOpen={isD5103ModalOpen}
          onClose={() => setIsD5103ModalOpen(false)}
          clientId={clientId}
          clientRequest={clientRequest}
          crmExt={crmExt}
          onUpdateCrmExt={onUpdateCrmExt}
          activeLawyerName={activeLawyerName}
        />
      )}

      {/* ── 7. 대법원 전산양식 D5102 재산목록 및 자산 가치 산정 모달 ── */}
      {isD5102ModalOpen && (
        <PropertyValuationModal
          isOpen={isD5102ModalOpen}
          onClose={() => setIsD5102ModalOpen(false)}
          clientId={clientId}
          clientRequest={clientRequest}
          crmExt={crmExt}
          onUpdateCrmExt={onUpdateCrmExt}
          onSyncToRepaymentPlan={(syncedAssets) => {
            setAssets(syncedAssets);
            setIsD5102ModalOpen(false);
          }}
        />
      )}

      {/* ── 8. 채권자 법원 송달주소 및 법인정보 편집 모달 ── */}
      <CreditorAddressModal
        isOpen={!!editingAddressCreditor}
        creditor={editingAddressCreditor}
        onClose={() => setEditingAddressCreditor(null)}
        onSave={(updated) => {
          setCreditors(prev => prev.map(c => c.id === updated.id ? updated : c));
          setEditingAddressCreditor(null);
        }}
      />

    </div>
  );
}
