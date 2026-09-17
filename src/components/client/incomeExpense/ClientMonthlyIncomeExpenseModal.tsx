import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calculator, Store, UserCheck, Clock, Hammer, DollarSign, 
  Plus, Trash2, CheckCircle2, AlertCircle, Save, Send, HelpCircle, 
  Sparkles, ArrowRight, ChevronRight, Info, RefreshCw, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  IncomeExpenseD5103Data, 
  DetailedIncomeType,
  DynamicExpenseItem,
  MonthlyLedgerItem,
  BusinessMonthlyLedger,
  FreelancerMonthlyLedger,
  FreelancerExpenseItem,
  DayLaborerLedger,
  PartTimeLedger,
  PartTimeWorkplace
} from '../../../types/incomeExpenseTypes';
import { 
  generateMonthlyLedgerFromWizardInputs,
  recalculateBusinessMonthlyLedger,
  syncBusinessLedgerToD5103,
  syncFreelancerLedgerToD5103,
  syncDayLaborerLedgerToD5103,
  syncPartTimeToD5103
} from '../../../services/documents/incomeExpenseService';

interface ClientMonthlyIncomeExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  initialD5103?: IncomeExpenseD5103Data | null;
  onSaveD5103?: (updatedData: IncomeExpenseD5103Data) => Promise<void> | void;
}

// 자주 쓰이는 추천 경비 칩 프리셋 (원터치 추가)
const POPULAR_EXPENSE_PRESETS: { name: string; target: 'operating' | 'rent' | 'utility' | 'electricity'; defaultAmt: number }[] = [
  { name: '배달대행료 (배민/쿠팡/요기요)', target: 'operating', defaultAmt: 600000 },
  { name: '세무기장료 및 세무신고비', target: 'operating', defaultAmt: 110000 },
  { name: '아르바이트/직원 인건비', target: 'operating', defaultAmt: 1200000 },
  { name: 'POS단말기 및 카드수수료', target: 'operating', defaultAmt: 80000 },
  { name: '매장 정수기/캡스 렌탈료', target: 'operating', defaultAmt: 70000 },
  { name: '매장 인터넷 및 유선전화료', target: 'operating', defaultAmt: 45000 },
  { name: '주방 식자재 및 소모품비', target: 'operating', defaultAmt: 1500000 },
  { name: '상가 관리비 (기본관리비)', target: 'rent', defaultAmt: 150000 },
  { name: '상가 화재/배상책임보험료', target: 'operating', defaultAmt: 50000 },
  { name: '영업용 차량 유류비 및 주차비', target: 'operating', defaultAmt: 250000 }
];

export default function ClientMonthlyIncomeExpenseModal({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  initialD5103,
  onSaveD5103
}: ClientMonthlyIncomeExpenseModalProps) {
  // 소득 유형 탭 ('BUSINESS' | 'FREELANCER' | 'DAY_LABORER' | 'PART_TIME')
  const [selectedIncomeType, setSelectedIncomeType] = useState<DetailedIncomeType>('BUSINESS');
  
  // 사업자 간편 마법사 상태
  const [bizCard, setBizCard] = useState<number>(3500000);
  const [bizCash, setBizCash] = useState<number>(1000000);
  const [bizBaseOperating, setBizBaseOperating] = useState<number>(1200000);
  const [bizRent, setBizRent] = useState<number>(800000);
  const [bizUtility, setBizUtility] = useState<number>(120000);
  const [bizElectricity, setBizElectricity] = useState<number>(180000);
  const [dynamicExpenses, setDynamicExpenses] = useState<DynamicExpenseItem[]>([
    { id: 'exp_1', name: '배달대행료 (배민/쿠팡/요기요)', monthlyAmount: 550000, rollupTarget: 'operating' },
    { id: 'exp_2', name: '세무기장료', monthlyAmount: 110000, rollupTarget: 'operating' }
  ]);
  
  // 사업자: 1분 간편 마법사 vs 12개월 상세 엑셀 토글
  const [viewMode, setViewMode] = useState<'wizard' | 'sheet'>('wizard');
  const [manualMonths, setManualMonths] = useState<MonthlyLedgerItem[]>([]);

  // 프리랜서 상태
  const [flJobType, setFlJobType] = useState<string>('배달라이더/용역');
  const [flGross, setFlGross] = useState<number>(3200000);
  const [flExpenses, setFlExpenses] = useState<FreelancerExpenseItem[]>([
    { id: 'fle_1', name: '오토바이/차량 유류비 및 정비비', monthlyAmount: 450000, category: 'fuel' },
    { id: 'fle_2', name: '스마트폰 통신비 및 업무 플랫폼료', monthlyAmount: 90000, category: 'telecom' },
    { id: 'fle_3', name: '시간제 유상운송보험료', monthlyAmount: 180000, category: 'fee' }
  ]);

  // 일용직 상태
  const [dlWorkDays, setDlWorkDays] = useState<number>(18);
  const [dlDailyWage, setDlDailyWage] = useState<number>(160000);
  const [dlIsCash, setDlIsCash] = useState<boolean>(false);

  // 아르바이트 상태
  const [ptWorkplaces, setPtWorkplaces] = useState<PartTimeWorkplace[]>([
    { id: 'ptw_1', workplaceName: '편의점 야간', hourlyWage: 10030, weeklyHours: 25, hasWeeklyHolidayPay: true, monthlyGrossIncome: 1300000 }
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (!isOpen) return;

    if (initialD5103) {
      if (initialD5103.detailedIncomeType) {
        setSelectedIncomeType(initialD5103.detailedIncomeType);
      } else if (initialD5103.incomeType === 'BUSINESS') {
        setSelectedIncomeType('BUSINESS');
      }

      // 사업자 데이터 복원
      if (initialD5103.monthlyLedger) {
        const ml = initialD5103.monthlyLedger;
        if (ml.months && ml.months.length > 0) {
          setManualMonths(ml.months);
          const first = ml.months[0];
          setBizCard(first.incomeCard || 0);
          setBizCash(first.incomeCash || 0);
          setBizRent(first.expenseRent || 0);
          setBizUtility(first.expenseUtility || 0);
          setBizElectricity(first.expenseElectricity || 0);
          setBizBaseOperating(first.expenseOperating || 0);
        }
        if (ml.dynamicExpenses && ml.dynamicExpenses.length > 0) {
          setDynamicExpenses(ml.dynamicExpenses);
        }
      }

      // 프리랜서 복원
      if (initialD5103.freelancerLedger) {
        const fl = initialD5103.freelancerLedger;
        setFlJobType(fl.jobTypeDetail || '프리랜서');
        setFlGross(fl.monthlyGrossIncome || 3200000);
        if (fl.expenses && fl.expenses.length > 0) {
          setFlExpenses(fl.expenses);
        }
      }

      // 일용직 복원
      if (initialD5103.dayLaborerLedger) {
        const dl = initialD5103.dayLaborerLedger;
        setDlWorkDays(dl.workDaysPerMonth || 18);
        setDlDailyWage(dl.dailyWage || 160000);
        setDlIsCash(!!dl.isDirectCash);
      }

      // 아르바이트 복원
      if (initialD5103.partTimeLedger && initialD5103.partTimeLedger.workplaces) {
        setPtWorkplaces(initialD5103.partTimeLedger.workplaces);
      }
    } else {
      // 기본 12개월 생성
      const initialLedger = generateMonthlyLedgerFromWizardInputs({
        avgMonthlyCard: bizCard,
        avgMonthlyCash: bizCash,
        baseOperatingExpense: bizBaseOperating,
        rentExpense: bizRent,
        utilityExpense: bizUtility,
        electricityExpense: bizElectricity,
        dynamicExpenses
      });
      setManualMonths(initialLedger.months);
    }
  }, [isOpen, initialD5103]);

  // 간편 마법사 입력값 변경 시 12개월 원장 실시간 동기화 계산
  const generatedLedger: BusinessMonthlyLedger = useMemo(() => {
    if (viewMode === 'sheet' && manualMonths.length === 12) {
      return recalculateBusinessMonthlyLedger(manualMonths, dynamicExpenses);
    }
    return generateMonthlyLedgerFromWizardInputs({
      avgMonthlyCard: bizCard,
      avgMonthlyCash: bizCash,
      baseOperatingExpense: bizBaseOperating,
      rentExpense: bizRent,
      utilityExpense: bizUtility,
      electricityExpense: bizElectricity,
      dynamicExpenses
    });
  }, [bizCard, bizCash, bizBaseOperating, bizRent, bizUtility, bizElectricity, dynamicExpenses, viewMode, manualMonths]);

  // 프리랜서 순소득 계산
  const flTotalExpenses = useMemo(() => {
    return flExpenses.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
  }, [flExpenses]);
  const flNetIncome = Math.max(0, flGross - flTotalExpenses);

  // 일용직 월소득 계산
  const dlMonthlyIncome = useMemo(() => {
    return (dlWorkDays || 0) * (dlDailyWage || 0);
  }, [dlWorkDays, dlDailyWage]);

  // 아르바이트 총소득 계산
  const ptTotalIncome = useMemo(() => {
    return ptWorkplaces.reduce((sum, wp) => sum + (wp.monthlyGrossIncome || 0), 0);
  }, [ptWorkplaces]);

  if (!isOpen) return null;

  // 동적 경비 항목 추가
  const handleAddDynamicExpense = () => {
    const newId = `exp_${Date.now()}`;
    setDynamicExpenses(prev => [
      ...prev,
      { id: newId, name: '추가 지출 경비', monthlyAmount: 100000, rollupTarget: 'operating' }
    ]);
  };

  // 프리셋 칩 클릭 추가
  const handleAddPresetExpense = (preset: typeof POPULAR_EXPENSE_PRESETS[0]) => {
    if (dynamicExpenses.some(e => e.name === preset.name)) {
      toast.info('이미 추가된 항목입니다. 금액을 수정해주세요.');
      return;
    }
    const newId = `exp_${Date.now()}`;
    setDynamicExpenses(prev => [
      ...prev,
      { id: newId, name: preset.name, monthlyAmount: preset.defaultAmt, rollupTarget: preset.target }
    ]);
    toast.success(`[${preset.name}] 항목이 추가되었습니다.`);
  };

  // 동적 경비 항목 삭제
  const handleRemoveDynamicExpense = (id: string) => {
    setDynamicExpenses(prev => prev.filter(e => e.id !== id));
  };

  // 시트 모드에서 셀 값 변경
  const handleCellChange = (rowIndex: number, field: keyof MonthlyLedgerItem, value: number) => {
    setManualMonths(prev => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        [field]: Math.max(0, value)
      };
      return next;
    });
  };

  // 저장 및 제출 핸들러
  const handleSave = async (isSubmittingToLawyer: boolean) => {
    setIsSubmitting(true);
    try {
      let baseD5103 = initialD5103 ? { ...initialD5103 } : ({} as IncomeExpenseD5103Data);

      if (selectedIncomeType === 'BUSINESS') {
        const finalLedger = viewMode === 'sheet' && manualMonths.length === 12
          ? recalculateBusinessMonthlyLedger(manualMonths, dynamicExpenses)
          : generatedLedger;
        baseD5103 = syncBusinessLedgerToD5103(baseD5103, finalLedger);
      } else if (selectedIncomeType === 'FREELANCER') {
        const flLedger: FreelancerMonthlyLedger = {
          jobTypeDetail: flJobType,
          monthlyGrossIncome: flGross,
          expenses: flExpenses,
          totalMonthlyExpenses: flTotalExpenses,
          netMonthlyIncome: flNetIncome,
          annualGrossRevenue: flGross * 12,
          evidenceDocuments: [
            '사업소득 원천징수영수증 (3.3%)',
            '최근 1년분 입금 거래내역서',
            '용역/위촉 계약서'
          ]
        };
        baseD5103 = syncFreelancerLedgerToD5103(baseD5103, flLedger);
      } else if (selectedIncomeType === 'DAY_LABORER') {
        const dlLedger: DayLaborerLedger = {
          workDaysPerMonth: dlWorkDays,
          dailyWage: dlDailyWage,
          monthlyGrossIncome: dlMonthlyIncome,
          isDirectCash: dlIsCash,
          evidenceDocuments: [
            '일용근로소득지급명세서',
            '고용산재보험 토탈서비스 일용근로내역서',
            '급여입금통장 거래내역서'
          ]
        };
        baseD5103 = syncDayLaborerLedgerToD5103(baseD5103, dlLedger);
      } else if (selectedIncomeType === 'PART_TIME') {
        const ptLedger: PartTimeLedger = {
          workplaces: ptWorkplaces,
          totalMonthlyGrossIncome: ptTotalIncome,
          evidenceDocuments: [
            '근로계약서 사본',
            '급여입금통장 거래내역서',
            '아르바이트 급여명세서'
          ]
        };
        baseD5103 = syncPartTimeToD5103(baseD5103, ptLedger);
      }

      // 상태 업데이트
      if (isSubmittingToLawyer) {
        baseD5103.d5103ClientStatus = 'client_submitted';
        baseD5103.d5103ClientSubmittedAt = new Date().toISOString();
      } else {
        baseD5103.d5103ClientStatus = 'not_started';
      }
      baseD5103.lastSavedAt = new Date().toISOString();

      if (onSaveD5103) {
        await onSaveD5103(baseD5103);
      }

      if (isSubmittingToLawyer) {
        toast.success('수지표가 작성되어 담당 변호사에게 제출되었습니다! 변호사가 법원 서식 확인 후 검토를 완료합니다.');
        onClose();
      } else {
        toast.success('수지표 작성 내용이 임시 저장되었습니다.');
      }
    } catch (err) {
      console.error(err);
      toast.error('수지표 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const won = (n: number) => (n || 0).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-brand-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">수입 및 지출 내역서 (수지표) 간편 작성</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  고객 맞춤 1분 모드
                </span>
              </div>
              <p className="text-xs text-slate-400">
                복잡한 12개월 엑셀을 몰라도 괜찮습니다. 평소 월평균 매출과 경비만 툭툭 적으시면 법원 양식으로 자동 변환됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 안내 바 & 5대 소득 유형 탭 선택 */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              신청인의 주된 소득 형태를 선택해 주세요
            </span>
            <span className="text-xs text-slate-500">
              * 작성 후 변호사가 최종 검토 및 법원 엑셀 서식으로 인쇄 제출합니다
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedIncomeType('BUSINESS')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all border ${
                selectedIncomeType === 'BUSINESS'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>개인사업자 (매장/도소매)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIncomeType('FREELANCER')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all border ${
                selectedIncomeType === 'FREELANCER'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>프리랜서 (3.3%·배달)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIncomeType('DAY_LABORER')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all border ${
                selectedIncomeType === 'DAY_LABORER'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>일용직 (현장·일당)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIncomeType('PART_TIME')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all border ${
                selectedIncomeType === 'PART_TIME'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>단기/아르바이트</span>
            </button>
          </div>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* ════════════ 1. 개인사업자 입력 영역 ════════════ */}
          {selectedIncomeType === 'BUSINESS' && (
            <div className="space-y-6">
              
              {/* 마법사 vs 12개월 엑셀 전환 버튼 */}
              <div className="flex items-center justify-between bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    {viewMode === 'wizard' ? '현재 모드: 1분 초간편 마법사 (추천)' : '현재 모드: 12개월 정밀 엑셀 표'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'wizard') {
                      setManualMonths(generatedLedger.months);
                      setViewMode('sheet');
                    } else {
                      setViewMode('wizard');
                    }
                  }}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition shadow-xs"
                >
                  {viewMode === 'wizard' ? '월별 엑셀 표 직접 보기/수정 →' : '← 간편 마법사로 돌아가기'}
                </button>
              </div>

              {viewMode === 'wizard' ? (
                <>
                  {/* 카드 1: 월평균 수입(매출) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">월평균 매출 (수입) 입력</h4>
                      </div>
                      <span className="text-xs text-slate-500">통장 및 포스기 평균치</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          월평균 카드 매출액
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={bizCard || ''}
                            onChange={e => setBizCard(Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2.5 pr-10 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-500">원</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">약 {(bizCard / 10000).toLocaleString()}만 원</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          월평균 현금 / 계좌이체 매출액
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={bizCash || ''}
                            onChange={e => setBizCash(Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2.5 pr-10 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-500">원</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">약 {(bizCash / 10000).toLocaleString()}만 원</p>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl flex items-center justify-between border border-emerald-100">
                      <span className="text-xs font-bold text-emerald-800">월 총매출액 합계</span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-900">
                        {won(bizCard + bizCash)} 원 <span className="text-xs font-normal text-emerald-700">({((bizCard + bizCash) / 10000).toFixed(0)}만 원)</span>
                      </span>
                    </div>
                  </div>

                  {/* 카드 2: 고정 사업장 지출 (월세 및 공과금) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">사업장 고정 월세 및 공과금</h4>
                      </div>
                      <span className="text-xs text-slate-500">법원 4대 표준 지출 항목</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          사업장 월세 (임대료)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={bizRent || ''}
                            onChange={e => setBizRent(Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          전기요금 (한전 월평균)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={bizElectricity || ''}
                            onChange={e => setBizElectricity(Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          가스·수도·등유요금
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={bizUtility || ''}
                            onChange={e => setBizUtility(Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        기본 운영비 (재료구입·상품매입 등)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step={10000}
                          value={bizBaseOperating || ''}
                          onChange={e => setBizBaseOperating(Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                      </div>
                    </div>
                  </div>

                  {/* 카드 3: 자주 쓰는 경비 원터치 칩 & 무제한 경비 추가 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">추가 경비 항목 (원터치 추가 & 직접 등록)</h4>
                      </div>
                      <span className="text-xs text-amber-700 font-medium">경비가 많을수록 월 변제금이 줄어듭니다!</span>
                    </div>

                    {/* 추천 칩 */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        💡 아래 추천 항목을 누르면 바로 목록에 추가됩니다:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_EXPENSE_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddPresetExpense(preset)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 border border-slate-200 transition"
                          >
                            <Plus className="w-3 h-3 text-slate-500" />
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 추가된 경비 리스트 */}
                    <div className="space-y-2 pt-2">
                      {dynamicExpenses.map((exp) => (
                        <div key={exp.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <input
                            type="text"
                            value={exp.name}
                            onChange={e => {
                              const val = e.target.value;
                              setDynamicExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, name: val } : item));
                            }}
                            placeholder="경비 항목명"
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="relative w-36 sm:w-44">
                            <input
                              type="number"
                              step={10000}
                              value={exp.monthlyAmount || ''}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setDynamicExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, monthlyAmount: val } : item));
                              }}
                              placeholder="0"
                              className="w-full px-3 py-1.5 pr-8 text-right text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="absolute right-2.5 top-1.5 text-xs text-slate-400">원</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDynamicExpense(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddDynamicExpense}
                        className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" />
                        경비 항목 직접 추가하기
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* 12개월 엑셀 표 직접 편집 모드 */
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">12개월 수입 및 지출 명세서 (엑셀 정밀 수정)</h4>
                      <p className="text-xs text-slate-500">법원 제출용 12개월 원본 표입니다. 각 월별 셀을 직접 수정하실 수 있습니다.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left text-slate-700 border-collapse min-w-[700px]">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2 border-r border-slate-200 text-center">날짜</th>
                          <th className="p-2 border-r border-slate-200 text-right">카드(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right">현금(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right bg-emerald-50 text-emerald-900">수입 소계</th>
                          <th className="p-2 border-r border-slate-200 text-right">운영비(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right">월세(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right">공과금(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right">전기료(원)</th>
                          <th className="p-2 border-r border-slate-200 text-right bg-red-50 text-red-900">지출 소계</th>
                          <th className="p-2 text-right bg-blue-50 text-blue-900 font-bold">월 순수익</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {manualMonths.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-200 text-center font-medium">{row.month}</td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.incomeCard || 0}
                                onChange={e => handleCellChange(idx, 'incomeCard', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.incomeCash || 0}
                                onChange={e => handleCellChange(idx, 'incomeCash', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 text-right font-semibold bg-emerald-50/40">
                              {won((row.incomeCard || 0) + (row.incomeCash || 0))}
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.expenseOperating || 0}
                                onChange={e => handleCellChange(idx, 'expenseOperating', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.expenseRent || 0}
                                onChange={e => handleCellChange(idx, 'expenseRent', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.expenseUtility || 0}
                                onChange={e => handleCellChange(idx, 'expenseUtility', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={row.expenseElectricity || 0}
                                onChange={e => handleCellChange(idx, 'expenseElectricity', Number(e.target.value))}
                                className="w-full p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 text-right font-semibold bg-red-50/40">
                              {won((row.expenseOperating || 0) + (row.expenseRent || 0) + (row.expenseUtility || 0) + (row.expenseElectricity || 0))}
                            </td>
                            <td className="p-2 text-right font-bold text-blue-700 bg-blue-50/40">
                              {won(
                                ((row.incomeCard || 0) + (row.incomeCash || 0)) -
                                ((row.expenseOperating || 0) + (row.expenseRent || 0) + (row.expenseUtility || 0) + (row.expenseElectricity || 0))
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 실시간 월평균 순수익 요약 카드 */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-medium">법원 제출 기준 최종 계산치</span>
                  <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    월평균 실질 순소득: <span className="text-emerald-400 font-extrabold text-xl">{won(generatedLedger.monthlyAverages.avgNetIncome)} 원</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    연간 총매출 {won(generatedLedger.annualTotals.totalGrossRevenue)}원 - 총경비 {won(generatedLedger.annualTotals.totalOperatingExpense)}원 = 연 순익 {won(generatedLedger.annualTotals.totalNetProfit)}원
                  </p>
                </div>
                <div className="text-right sm:text-right shrink-0">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                    변제금 산정 기준 소득 반영 완료
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ 2. 프리랜서 (3.3%) 입력 영역 ════════════ */}
          {selectedIncomeType === 'FREELANCER' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-base">프리랜서 용역 직종 및 월 총수입</h4>
                  <span className="text-xs text-slate-500">3.3% 사업소득자</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      세부 직종 (용역 분야)
                    </label>
                    <input
                      type="text"
                      value={flJobType}
                      onChange={e => setFlJobType(e.target.value)}
                      placeholder="예: 배달라이더, 학습지교사, IT개발자 등"
                      className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      월평균 총 수수료/입금액 (원천징수 전)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={flGross || ''}
                        onChange={e => setFlGross(Number(e.target.value))}
                        className="w-full px-3 py-2 pr-10 text-right font-medium text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 프리랜서 필수 경비 항목 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base">업무 수행 필수 필요경비</h4>
                    <p className="text-xs text-slate-500">유류비, 통신비, 프로그램비 등 인정받을 경비를 입력하세요.</p>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">
                    경비 합계: {won(flTotalExpenses)}원
                  </span>
                </div>

                <div className="space-y-2">
                  {flExpenses.map((exp) => (
                    <div key={exp.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        value={exp.name}
                        onChange={e => {
                          const val = e.target.value;
                          setFlExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, name: val } : item));
                        }}
                        className="flex-1 px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg"
                      />
                      <div className="relative w-36">
                        <input
                          type="number"
                          step={10000}
                          value={exp.monthlyAmount || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setFlExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, monthlyAmount: val } : item));
                          }}
                          className="w-full px-3 py-1.5 pr-8 text-right text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs text-slate-400">원</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlExpenses(prev => prev.filter(item => item.id !== exp.id))}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const newId = `fle_${Date.now()}`;
                      setFlExpenses(prev => [...prev, { id: newId, name: '기타 업무경비', monthlyAmount: 50000, category: 'other' }]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    필요경비 항목 추가
                  </button>
                </div>
              </div>

              {/* 프리랜서 순소득 결과 */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">프리랜서 월평균 순소득 (총수입 - 필요경비)</span>
                  <h4 className="text-xl font-bold text-emerald-400 mt-0.5">{won(flNetIncome)} 원</h4>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  소명자료: 원천징수영수증 + 통장내역
                </div>
              </div>
            </div>
          )}

          {/* ════════════ 3. 일용직 입력 영역 ════════════ */}
          {selectedIncomeType === 'DAY_LABORER' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-base">일용직 근무 현황 및 일당</h4>
                  <p className="text-xs text-slate-500">건설, 물류 등 최근 수개월간의 평균 근무 일수와 일당을 입력하세요.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      월평균 출근 일수
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dlWorkDays || ''}
                        onChange={e => setDlWorkDays(Number(e.target.value))}
                        className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500">일</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      1일 평균 일당 (실수령액 기준)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={dlDailyWage || ''}
                        onChange={e => setDlDailyWage(Number(e.target.value))}
                        className="w-full px-3 py-2 text-right font-medium text-slate-900 border border-slate-300 rounded-xl"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500">원</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="dl_cash"
                    checked={dlIsCash}
                    onChange={e => setDlIsCash(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="dl_cash" className="text-xs text-slate-700 cursor-pointer">
                    통장 입금이 아닌 현금으로 직접 수령하는 경우가 포함되어 있습니다.
                  </label>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">일용근로 월평균 수입 ({dlWorkDays}일 × {won(dlDailyWage)}원)</span>
                  <h4 className="text-xl font-bold text-emerald-400 mt-0.5">{won(dlMonthlyIncome)} 원</h4>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  소명자료: 고용산재보험 일용근로내역서
                </div>
              </div>
            </div>
          )}

          {/* ════════════ 4. 아르바이트 (시간제) 입력 영역 ════════════ */}
          {selectedIncomeType === 'PART_TIME' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base">아르바이트 근무지 및 시급 내역</h4>
                    <p className="text-xs text-slate-500">복수의 아르바이트를 하시는 경우 사업장별로 추가해주세요.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {ptWorkplaces.map((wp) => (
                    <div key={wp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={wp.workplaceName}
                          onChange={e => {
                            const val = e.target.value;
                            setPtWorkplaces(prev => prev.map(item => item.id === wp.id ? { ...item, workplaceName: val } : item));
                          }}
                          placeholder="근무 사업장명 (예: 메가커피, 편의점)"
                          className="font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 w-60"
                        />
                        {ptWorkplaces.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPtWorkplaces(prev => prev.filter(item => item.id !== wp.id))}
                            className="text-slate-400 hover:text-red-500 text-xs p-1"
                          >
                            사업장 삭제
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">적용 시급</label>
                          <input
                            type="number"
                            value={wp.hourlyWage}
                            onChange={e => {
                              const wage = Number(e.target.value);
                              setPtWorkplaces(prev => prev.map(item => item.id === wp.id ? { ...item, hourlyWage: wage } : item));
                            }}
                            className="w-full text-xs font-semibold px-2 py-1.5 border rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">주당 근무시간</label>
                          <input
                            type="number"
                            value={wp.weeklyHours}
                            onChange={e => {
                              const hrs = Number(e.target.value);
                              setPtWorkplaces(prev => prev.map(item => item.id === wp.id ? { ...item, weeklyHours: hrs } : item));
                            }}
                            className="w-full text-xs font-semibold px-2 py-1.5 border rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">월 실수령 급여 (원)</label>
                          <input
                            type="number"
                            step={10000}
                            value={wp.monthlyGrossIncome}
                            onChange={e => {
                              const inc = Number(e.target.value);
                              setPtWorkplaces(prev => prev.map(item => item.id === wp.id ? { ...item, monthlyGrossIncome: inc } : item));
                            }}
                            className="w-full text-xs font-semibold px-2 py-1.5 border rounded-lg bg-white text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const newId = `ptw_${Date.now()}`;
                      setPtWorkplaces(prev => [
                        ...prev,
                        { id: newId, workplaceName: '추가 아르바이트', hourlyWage: 10030, weeklyHours: 15, hasWeeklyHolidayPay: false, monthlyGrossIncome: 650000 }
                      ]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    알바 근무지 추가하기
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">아르바이트 합산 월소득</span>
                  <h4 className="text-xl font-bold text-emerald-400 mt-0.5">{won(ptTotalIncome)} 원</h4>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  소명자료: 근로계약서 + 급여통장 사본
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 하단 액션 버튼 바 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition shadow-xs"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>임시 저장</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-200/60 font-medium text-xs sm:text-sm transition"
            >
              닫기
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-brand-md transition press-scale"
            >
              <Send className="w-4 h-4" />
              <span>작성 완료 (변호사에게 제출)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
