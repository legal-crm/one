import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Sparkles, Printer, Download, Save, Plus, Trash2, 
  AlertTriangle, CheckCircle2, DollarSign, Users, Home, 
  HeartPulse, GraduationCap, ShieldAlert, FileText, ArrowRight,
  Info, RefreshCw, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  IncomeExpenseD5103Data, 
  DebtorIncomeType, 
  FamilyMemberItem 
} from '../../../types/incomeExpenseTypes';
import { 
  createDefaultIncomeExpenseD5103, 
  recalculateD5103Data, 
  validateD5103Data 
} from '../../../services/documents/incomeExpenseService';
import { MIN_LIVING_EXPENSE_60_2026 } from '../../../services/repayment/repaymentConstants2026';
import PrintableIncomeExpenseModal from './PrintableIncomeExpenseModal';

interface IncomeExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
  onOpenBatchFiling?: () => void;
}

export default function IncomeExpenseModal({
  isOpen,
  onClose,
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
  onOpenBatchFiling
}: IncomeExpenseModalProps) {
  if (!isOpen) return null;

  // 1. 초기 데이터 로딩: CRM에 저장된 데이터가 있으면 로드, 없으면 상담 프로필에서 자동 생성
  const [formData, setFormData] = useState<IncomeExpenseD5103Data>(() => {
    if (crmExt.incomeExpenseD5103) {
      return crmExt.incomeExpenseD5103;
    }
    return createDefaultIncomeExpenseD5103(clientRequest, crmExt, activeLawyerName);
  });

  // 서브탭 상태
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'family' | 'summary'>('income');
  // 인쇄/PDF 뷰어 모달 상태
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 실시간 보정 검증 결과
  const validation = useMemo(() => {
    return validateD5103Data(formData);
  }, [formData]);

  // 상담 데이터 기반 원클릭 자동 완성 리셋
  const handleAutoFillFromProfile = () => {
    const generated = createDefaultIncomeExpenseD5103(clientRequest, crmExt, activeLawyerName);
    setFormData(generated);
    toast.success('✨ 의뢰인 상담 및 진단 데이터로부터 최신 2026 규격으로 자동 완성되었습니다!');
  };

  // 값 변경 헬퍼: 변경 후 자동 재집계(recalculateD5103Data) 실행
  const updateData = (updater: (prev: IncomeExpenseD5103Data) => IncomeExpenseD5103Data) => {
    setFormData(prev => recalculateD5103Data(updater(prev)));
  };

  // 저장 핸들러
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateCrmExt({
        incomeExpenseD5103: formData
      });
      toast.success('💾 수입 및 지출에 관한 목록(D5103)이 안전하게 저장되었습니다.');
    } catch (err: any) {
      toast.error('저장 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 변제계획안(D5110/D5111) 동기화
  const handleSyncToRepaymentPlan = async () => {
    try {
      const currentPlan = crmExt.repaymentPlan;
      const monthlyNet = formData.disposableIncome.monthlyNetIncome;
      const household = formData.expenses.householdSize;
      const rent = formData.expenses.additionalHousing;
      const med = formData.expenses.additionalMedical;
      const edu = formData.expenses.additionalEducation;

      let updatedPlan = currentPlan;
      if (updatedPlan) {
        updatedPlan = {
          ...updatedPlan,
          calculatedLiving: {
            ...updatedPlan.calculatedLiving,
            baseLivingExpense: formData.expenses.statutoryBaseCost2026,
            totalAdditionalExpense: formData.expenses.totalAdditionalExpenses,
            finalTotalLivingExpense: formData.expenses.totalMonthlyExpense,
            actualDisposableIncome: formData.disposableIncome.monthlyDisposableIncome,
          },
          monthlyRepaymentTotal: formData.disposableIncome.monthlyDisposableIncome,
          months: formData.disposableIncome.repaymentMonths,
          totalRepaymentAmount: formData.disposableIncome.totalDisposableIncome
        };
      }

      await onUpdateCrmExt({
        incomeExpenseD5103: formData,
        repaymentPlan: updatedPlan
      });
      toast.success('⚖️ D5103의 가용소득(월 변제예정액)이 변제계획안에 성공적으로 동기화되었습니다!');
    } catch (err: any) {
      toast.error('변제계획안 동기화 실패: ' + (err?.message || ''));
    }
  };

  // 전자소송 R08 슬롯 첨부
  const handleAttachToFiling = async () => {
    await handleSave();
    toast.success('📄 대법원 표준 D5103 서식이 전자소송 R08(수입 및 지출목록) 슬롯에 자동 첨부되었습니다.');
    if (onOpenBatchFiling) {
      onOpenBatchFiling();
    }
  };

  const sal = formData.salary;
  const biz = formData.business;
  const exp = formData.expenses;
  const fam = formData.familyMembers;
  const disp = formData.disposableIncome;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-extrabold text-lg">
              💰
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  수입 및 지출에 관한 목록 (대법원 전산양식 D5103)
                </h3>
                <span className="text-[10px] bg-blue-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                  2026 AUTO-FILING PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{formData.debtorName}</strong> · 사건: {formData.caseNumber} ({formData.courtName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFillFromProfile}
              className="px-3.5 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap shadow-xs"
              title="의뢰인 상담 접수 데이터로부터 양식을 자동 완성합니다."
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>1초 자동 완성</span>
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>D5103 서식 미리보기</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 바 & 가용소득 퀵 스냅샷 */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            {[
              { key: 'income', label: '1. 수입 목록', icon: '💵' },
              { key: 'expense', label: '2. 지출 & 생계비', icon: '🏠' },
              { key: 'family', label: `3. 가족관계 (${fam.length}인)`, icon: '👨‍👩‍👧‍👦' },
              { key: 'summary', label: '4. 가용소득 검증', icon: '⚖️' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 press-scale ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 우측 퀵 계산 결과 칩 */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">월 실수령: <strong className="text-slate-900 font-mono">{(disp.monthlyNetIncome / 10000).toFixed(0)}만</strong></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium">생계비: <strong className="text-rose-600 font-mono">{(disp.monthlyTotalExpense / 10000).toFixed(0)}만</strong></span>
            <span className="text-slate-300">|</span>
            <span className="bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              <span>월 가용소득:</span>
              <span className="font-mono text-blue-700 font-black">{(disp.monthlyDisposableIncome / 10000).toFixed(0)}만 원</span>
            </span>
          </div>
        </div>

        {/* 탭별 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">

          {/* ══════════════════════════════════════════════════════════
              TAB 1: 수입 목록 (급여 vs 영업)
          ══════════════════════════════════════════════════════════ */}
          {activeTab === 'income' && (
            <div className="space-y-5 animate-fadeIn">
              {/* 소득 구분 라디오 선택 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">소득 형태 구분</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="incomeType"
                        checked={formData.incomeType === 'SALARY'}
                        onChange={() => updateData(p => ({ ...p, incomeType: 'SALARY' }))}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span>💼 급여소득자 (근로소득자, 아르바이트, 일용직)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="incomeType"
                        checked={formData.incomeType === 'BUSINESS'}
                        onChange={() => updateData(p => ({ ...p, incomeType: 'BUSINESS' }))}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span>🏢 영업소득자 (사업소득, 부동산임대, 농·임업)</span>
                    </label>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  대법원 전산양식 D5103 1항
                </div>
              </div>

              {/* 급여소득자 폼 */}
              {formData.incomeType === 'SALARY' ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>💼 급여소득자 수입 산정 및 공제액 계산기</span>
                    </h4>
                    <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
                      법 제579조 제4호 나목 준용
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">근무처(직장명)</label>
                      <input
                        type="text"
                        value={sal.employerName}
                        onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, employerName: e.target.value } }))}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">직위 및 담당업무</label>
                      <input
                        type="text"
                        value={sal.jobTitle}
                        onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, jobTitle: e.target.value } }))}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">입사일자</label>
                      <input
                        type="date"
                        value={sal.employmentStartDate}
                        onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, employmentStartDate: e.target.value } }))}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* 수입 및 상여금 계산 */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">수입 명세 (세전)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[11px] text-slate-500 font-bold mb-1 block">
                          매월 정기 수령액 (기본급+수당)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={sal.monthlyBasePay}
                            onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, monthlyBasePay: Number(e.target.value) } }))}
                            className="w-full text-xs p-2.5 pr-8 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-right"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 font-bold mb-1 block">
                          정기상여금·성과급 (연간 총액)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={10000}
                            value={sal.annualBonus}
                            onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, annualBonus: Number(e.target.value) } }))}
                            className="w-full text-xs p-2.5 pr-8 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-right"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block text-right font-mono">
                          월 환산: +{sal.monthlyBonusConverted.toLocaleString()}원
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                        <span className="text-[11px] text-slate-400 font-bold">공제 전 월 총수입</span>
                        <span className="text-sm font-mono font-black text-slate-900">
                          {sal.grossMonthlyIncome.toLocaleString()} 원
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 세금 및 4대보험 법정 공제액 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        공제 세액 및 4대 보험료 (실수령액 차감 항목)
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-600">
                        공제 합계: -{sal.totalStatutoryDeductions.toLocaleString()} 원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">소득세</label>
                        <input
                          type="number"
                          value={sal.incomeTax}
                          onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, incomeTax: Number(e.target.value) } }))}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">주민세(지방세)</label>
                        <input
                          type="number"
                          value={sal.residentTax}
                          onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, residentTax: Number(e.target.value) } }))}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">건강보험료</label>
                        <input
                          type="number"
                          value={sal.healthInsurance}
                          onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, healthInsurance: Number(e.target.value) } }))}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">국민연금</label>
                        <input
                          type="number"
                          value={sal.nationalPension}
                          onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, nationalPension: Number(e.target.value) } }))}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">고용보험료</label>
                        <input
                          type="number"
                          value={sal.employmentInsurance}
                          onChange={e => updateData(p => ({ ...p, salary: { ...p.salary, employmentInsurance: Number(e.target.value) } }))}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 실수령액 최종 산출 배너 */}
                  <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-blue-950 block">월 실수령 순수입액</span>
                      <span className="text-[11px] text-blue-700">
                        연간 환산 총 순수입: {sal.annualConvertedIncome.toLocaleString()}원
                      </span>
                    </div>
                    <span className="text-lg font-mono font-black text-blue-900">
                      {sal.netMonthlyIncome.toLocaleString()} 원
                    </span>
                  </div>
                </div>
              ) : (
                /* 영업소득자 폼 */
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>🏢 영업소득자 매출 및 필수비용 산정</span>
                    </h4>
                    <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md">
                      법 제579조 제4호 라목 준용
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">수입 명목</label>
                      <select
                        value={biz.businessCategory}
                        onChange={e => updateData(p => ({ ...p, business: { ...p.business, businessCategory: e.target.value as any } }))}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-500 font-bold"
                      >
                        <option value="사업소득">사업소득 (도소매, 음식점, 서비스 등)</option>
                        <option value="부동산임대소득">부동산임대소득</option>
                        <option value="농업소득">농업소득</option>
                        <option value="임업소득">임업소득</option>
                        <option value="기타소득">기타소득</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">상호명</label>
                      <input
                        type="text"
                        value={biz.businessName}
                        onChange={e => updateData(p => ({ ...p, business: { ...p.business, businessName: e.target.value } }))}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">사업자등록번호</label>
                      <input
                        type="text"
                        value={biz.businessRegistrationNo}
                        onChange={e => updateData(p => ({ ...p, business: { ...p.business, businessRegistrationNo: e.target.value } }))}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold mb-1 block">
                        최근 1년간 총수입 (매출액)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step={100000}
                          value={biz.annualGrossRevenue}
                          onChange={e => updateData(p => ({ ...p, business: { ...p.business, annualGrossRevenue: Number(e.target.value) } }))}
                          className="w-full text-xs p-2.5 pr-8 bg-white border border-slate-200 rounded-xl font-mono font-bold text-right"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 font-bold mb-1 block">
                        영업비용 (경영·보존 필요경비)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step={100000}
                          value={biz.annualOperatingExpenses}
                          onChange={e => updateData(p => ({ ...p, business: { ...p.business, annualOperatingExpenses: Number(e.target.value) } }))}
                          className="w-full text-xs p-2.5 pr-8 bg-white border border-slate-200 rounded-xl font-mono font-bold text-right text-rose-600"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 font-bold mb-1 block">
                        제세공과금 (종합소득세 등)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step={50000}
                          value={biz.annualTaxes}
                          onChange={e => updateData(p => ({ ...p, business: { ...p.business, annualTaxes: Number(e.target.value) } }))}
                          className="w-full text-xs p-2.5 pr-8 bg-white border border-slate-200 rounded-xl font-mono font-bold text-right text-rose-600"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-purple-950 block">연간 순소득액 및 월평균 수입</span>
                      <span className="text-[11px] text-purple-700">
                        연간 순소득: {biz.netAnnualBusinessIncome.toLocaleString()} 원
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-purple-600 font-bold block">월평균 수입액</span>
                      <span className="text-lg font-mono font-black text-purple-900">
                        {biz.monthlyAverageIncome.toLocaleString()} 원
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 압류·가압류 유무 설정 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    수입에 대한 압류·가압류 등 강제집행 유무
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.seizure.hasSeizure}
                      onChange={e => updateData(p => ({ ...p, seizure: { ...p.seizure, hasSeizure: e.target.checked } }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>압류/가압류 집행 중임</span>
                  </label>
                </div>

                {formData.seizure.hasSeizure && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 animate-fadeIn">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold block mb-1">결정 법원</label>
                      <input
                        type="text"
                        placeholder="예: 서울중앙지방법원"
                        value={formData.seizure.courtName}
                        onChange={e => updateData(p => ({ ...p, seizure: { ...p.seizure, courtName: e.target.value } }))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold block mb-1">사건번호</label>
                      <input
                        type="text"
                        placeholder="예: 2025타채 12345"
                        value={formData.seizure.caseNumber}
                        onChange={e => updateData(p => ({ ...p, seizure: { ...p.seizure, caseNumber: e.target.value } }))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold block mb-1">상대방 채권자</label>
                      <input
                        type="text"
                        placeholder="예: 국민은행"
                        value={formData.seizure.creditorName}
                        onChange={e => updateData(p => ({ ...p, seizure: { ...p.seizure, creditorName: e.target.value } }))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold block mb-1">압류 금액 (원)</label>
                      <input
                        type="number"
                        step={10000}
                        value={formData.seizure.seizedAmount}
                        onChange={e => updateData(p => ({ ...p, seizure: { ...p.seizure, seizedAmount: Number(e.target.value) } }))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg font-mono text-right"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 2: 지출 및 생계비 관리
          ══════════════════════════════════════════════════════════ */}
          {activeTab === 'expense' && (
            <div className="space-y-5 animate-fadeIn">
              {/* 2026 기준생계비 배너 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                      🏛️
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        2026년 가구원 수별 법정 최저생계비 (기준 중위소득 60%)
                      </h4>
                      <p className="text-xs text-slate-500">
                        피부양자 {exp.householdSize}인 가구 기준 법정 인정액: <strong className="text-emerald-700 font-mono font-black">{exp.statutoryBaseCost2026.toLocaleString()}원</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="claimedCostOption"
                        checked={exp.claimedCostOption === 'BELOW_60'}
                        onChange={() => updateData(p => ({ ...p, expenses: { ...p.expenses, claimedCostOption: 'BELOW_60' } }))}
                        className="text-emerald-600"
                      />
                      <span>기준 60% 이하 (표준)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="claimedCostOption"
                        checked={exp.claimedCostOption === 'ABOVE_60'}
                        onChange={() => updateData(p => ({ ...p, expenses: { ...p.expenses, claimedCostOption: 'ABOVE_60' } }))}
                        className="text-rose-600"
                      />
                      <span>기준 60% 초과 (추가생계비 주장)</span>
                    </label>
                  </div>
                </div>

                {/* 2026 기준표 요약 칩 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                  {[1, 2, 3, 4].map(size => (
                    <div 
                      key={size} 
                      className={`p-2 rounded-xl border text-center ${
                        exp.householdSize === size 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold ring-1 ring-emerald-400' 
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="block text-[11px]">{size}인 가구</span>
                      <span className="font-mono font-black text-xs">
                        {MIN_LIVING_EXPENSE_60_2026[size].toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추가 생계비 주장 세부 입력 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>🏠 추가 생계비 소명 항목 (법원 허가 심사 대상)</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-rose-600">
                    추가 합계: +{exp.totalAdditionalExpenses.toLocaleString()} 원
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Home className="w-3.5 h-3.5 text-blue-600" />
                      추가 주거비 (월세 초과분)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={exp.additionalHousing}
                        onChange={e => updateData(p => ({ ...p, expenses: { ...p.expenses, additionalHousing: Number(e.target.value) } }))}
                        className="w-full text-xs p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono text-right font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">기준 주거비 초과 월세 실비</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                      추가 의료비 (지속적 치료)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={exp.additionalMedical}
                        onChange={e => updateData(p => ({ ...p, expenses: { ...p.expenses, additionalMedical: Number(e.target.value) } }))}
                        className="w-full text-xs p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono text-right font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">만성질환 진료비/약제비</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                      추가 교육비 (미성년 자녀)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={exp.additionalEducation}
                        onChange={e => updateData(p => ({ ...p, expenses: { ...p.expenses, additionalEducation: Number(e.target.value) } }))}
                        className="w-full text-xs p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono text-right font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">필수 특수교육비 등</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      양육비 지급액 (이혼 판결)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={10000}
                        value={exp.additionalChildSupport}
                        onChange={e => updateData(p => ({ ...p, expenses: { ...p.expenses, additionalChildSupport: Number(e.target.value) } }))}
                        className="w-full text-xs p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono text-right font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">원</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">미성년 자녀 양육비 실비</span>
                  </div>
                </div>

                {/* 추가생계비 소명 사유 텍스트에어리어 */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    추가 생계비 소명 사유 및 필요성 서술 (법원 제출용)
                  </label>
                  <textarea
                    rows={3}
                    value={exp.additionalReasonDetail}
                    onChange={e => updateData(p => ({ ...p, expenses: { ...p.expenses, additionalReasonDetail: e.target.value } }))}
                    placeholder="추가 지출이 불가피한 사유를 구체적으로 기재하세요 (예: 서울 관내 월세 실거주 유지, 만성질환 약제비 발생 사유)..."
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
                  />
                </div>

                {/* 월평균 총 지출 배너 */}
                <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-rose-950 block">[B] 월평균 총 지출액 (생계비)</span>
                    <span className="text-[11px] text-rose-700">
                      기본 생계비({exp.claimedBaseCost.toLocaleString()}원) + 추가 생계비({exp.totalAdditionalExpenses.toLocaleString()}원)
                    </span>
                  </div>
                  <span className="text-lg font-mono font-black text-rose-900">
                    {exp.totalMonthlyExpense.toLocaleString()} 원
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: 가족관계 (피부양자 명세)
          ══════════════════════════════════════════════════════════ */}
          {activeTab === 'family' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>👨‍👩‍👧‍👦 동거 가족 및 피부양자 명세</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      총 {fam.length}명 (부양가족 인정: <strong className="text-emerald-600 font-bold">{fam.filter(f => f.isEligibleDependent).length}명</strong>)
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const newMember: FamilyMemberItem = {
                        id: `fam_${Date.now()}`,
                        relationship: '자',
                        name: '새 가족',
                        birthDate: '2015.01.01',
                        cohabitationStatus: '동거',
                        cohabitationPeriod: '3년',
                        isSupportedByDebtor: true,
                        hasIncome: false,
                        jobAndIncomeDetail: '미성년자 (소득 없음)',
                        isEligibleDependent: true
                      };
                      updateData(p => ({ ...p, familyMembers: [...p.familyMembers, newMember] }));
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>가족 추가</span>
                  </button>
                </div>

                {/* 가족 테이블 */}
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2.5 text-left border-r border-slate-200 w-24">관계</th>
                        <th className="p-2.5 text-left border-r border-slate-200 w-24">성명</th>
                        <th className="p-2.5 text-left border-r border-slate-200 w-28">생년월일</th>
                        <th className="p-2.5 text-center border-r border-slate-200 w-20">동거</th>
                        <th className="p-2.5 text-left border-r border-slate-200 w-28">동거기간</th>
                        <th className="p-2.5 text-left border-r border-slate-200">직업 및 월소득 내역</th>
                        <th className="p-2.5 text-center border-r border-slate-200 w-24">부양 인정</th>
                        <th className="p-2.5 text-center w-12">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fam.map((member, index) => (
                        <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-2 border-r border-slate-100">
                            <input
                              type="text"
                              value={member.relationship}
                              onChange={e => {
                                const val = e.target.value;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, relationship: val } : m)
                                }));
                              }}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <input
                              type="text"
                              value={member.name}
                              onChange={e => {
                                const val = e.target.value;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, name: val } : m)
                                }));
                              }}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <input
                              type="text"
                              value={member.birthDate}
                              placeholder="YYYY.MM.DD"
                              onChange={e => {
                                const val = e.target.value;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, birthDate: val } : m)
                                }));
                              }}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs font-mono"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center">
                            <select
                              value={member.cohabitationStatus}
                              onChange={e => {
                                const val = e.target.value as any;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, cohabitationStatus: val } : m)
                                }));
                              }}
                              className="p-1 border border-slate-200 rounded text-xs"
                            >
                              <option value="동거">동거</option>
                              <option value="별거">별거</option>
                            </select>
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <input
                              type="text"
                              value={member.cohabitationPeriod}
                              placeholder="예: 5년"
                              onChange={e => {
                                const val = e.target.value;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, cohabitationPeriod: val } : m)
                                }));
                              }}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <input
                              type="text"
                              value={member.jobAndIncomeDetail}
                              placeholder="예: 학생(소득없음)"
                              onChange={e => {
                                const val = e.target.value;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, jobAndIncomeDetail: val } : m)
                                }));
                              }}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center">
                            <input
                              type="checkbox"
                              checked={member.isEligibleDependent}
                              onChange={e => {
                                const checked = e.target.checked;
                                updateData(p => ({
                                  ...p,
                                  familyMembers: p.familyMembers.map((m, i) => i === index ? { ...m, isEligibleDependent: checked } : m)
                                }));
                              }}
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {member.id !== 'fam_self' && (
                              <button
                                onClick={() => {
                                  updateData(p => ({
                                    ...p,
                                    familyMembers: p.familyMembers.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                  <span className="font-bold block flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    법원 실무준칙상 부양가족 인정 안내
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    • 19세 미만 직계비속 또는 60세 이상 직계존속으로서 주민등록상 상당기간 동거하며 소득이 1인 최저생계비 미만인 경우 인정됩니다.<br />
                    • 경제활동 가능 연령대의 배우자는 질병·장애 또는 미취학 자녀 다수 양육 사유를 진단서 등으로 소명하지 않으면 제외됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 4: 가용소득 종합 요약 및 검증
          ══════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="space-y-5 animate-fadeIn">
              {/* 핵심 산출 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-center">
                  <span className="text-xs font-bold text-slate-400 block mb-1">[A] 월평균 총 순수입</span>
                  <span className="text-xl font-black font-mono text-slate-900">
                    {disp.monthlyNetIncome.toLocaleString()} 원
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {formData.incomeType === 'SALARY' ? '급여 실수령액' : '영업 순소득액'}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-center">
                  <span className="text-xs font-bold text-slate-400 block mb-1">[B] 월평균 총 생계비</span>
                  <span className="text-xl font-black font-mono text-rose-600">
                    -{disp.monthlyTotalExpense.toLocaleString()} 원
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {exp.householdSize}인 가구 기준 + 추가생계비
                  </span>
                </div>

                <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md text-center">
                  <span className="text-xs font-bold text-blue-200 block mb-1">[A - B] 월 가용소득 (월 변제금)</span>
                  <span className="text-2xl font-black font-mono text-white">
                    {disp.monthlyDisposableIncome.toLocaleString()} 원
                  </span>
                  <span className="text-[11px] text-blue-100 block mt-1">
                    변제 {disp.repaymentMonths}개월간 총 {disp.totalDisposableIncome.toLocaleString()}원 변제
                  </span>
                </div>
              </div>

              {/* 사전 검증 및 보정 리스크 체크 배너 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center justify-between">
                  <span>⚖️ 법원 보정명령 대비 사전 적격성 검증</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    validation.hasCriticalIssue 
                      ? 'bg-rose-100 text-rose-800' 
                      : (validation.warnings.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                  }`}>
                    {validation.hasCriticalIssue ? '위험 발견' : (validation.warnings.length > 0 ? `${validation.warnings.length}건 유의` : '검증 통과')}
                  </span>
                </h4>

                {validation.warnings.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>가용소득 및 부양가족 산정 기준이 대법원 실무준칙에 부합합니다.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validation.warnings.map((w, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          w.level === 'CRITICAL' 
                            ? 'bg-rose-50 border-rose-200 text-rose-900' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                          w.level === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                        }`} />
                        <div>
                          <strong className="block font-bold">{w.title}</strong>
                          <p className="text-[11px] leading-relaxed mt-0.5 opacity-90">{w.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 변제계획안과의 연결 안내 */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-950 block">변제계획안(D5110/D5111) 자동 동기화</span>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    산출된 월 가용소득 <strong className="font-mono">{disp.monthlyDisposableIncome.toLocaleString()}원</strong>을 변제계획안의 월 변제예정액으로 즉시 동기화합니다.
                  </p>
                </div>
                <button
                  onClick={handleSyncToRepaymentPlan}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap shadow-xs"
                >
                  <span>변제계획안에 반영</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 하단 공통 액션 바 */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>대법원 D5103 서식 인쇄 / PDF</span>
            </button>
            <button
              onClick={handleAttachToFiling}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>전자소송 R08 슬롯에 첨부</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? '저장 중...' : '저장하기'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 대법원 전산양식 D5103 인쇄/PDF 뷰어 모달 */}
      {isPrintModalOpen && (
        <PrintableIncomeExpenseModal
          data={formData}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          onAttachToPackage={handleAttachToFiling}
        />
      )}
    </div>
  );
}
