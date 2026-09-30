import { ChevronDown, ChevronUp, Download, Edit2, FileText, Scale } from 'lucide-react';
import type { MyPageModel } from './useMyPageModel';
import BlueprintEditForm from './BlueprintEditForm';
import ClientNotesEditor from './ClientNotesEditor';

/**
 * 내 사건 탭: 가계 재정·채무 요약과 상세 수정 (MyPageView에서 분리)
 */
export default function FinancialBlueprintCard({ vm }: { vm: MyPageModel }) {
  const {
    activeResult, formatCurrency, formatResultMonthly, formatResultTotal, isEditingBlueprint, profile,
    setIsEditingBlueprint, totalDebtValue,
  } = vm;
  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        {/* 헤더 & 컨트롤 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-brand/10 text-brand">
                <Scale className="w-5 h-5" />
              </span>
              <h3 className="font-black text-lg md:text-xl text-slate-900 dark:text-white">
                나의 가계 재정 & 채무 진단서 원안
              </h3>
              <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                자가진단 원본
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              자가진단 시 입력한 재정·채무 데이터 원본입니다. 변호사가 사건을 검토하는 기준이 되며 언제든지 수정할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>인쇄/PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBlueprint(prev => !prev)}
              aria-expanded={isEditingBlueprint}
              className="min-h-11 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-[0.98] whitespace-nowrap"
            >
              <Edit2 className="w-4 h-4" aria-hidden="true" />
              <span>{isEditingBlueprint ? '수정 창 닫기' : '상세 항목 수정하기'}</span>
              {isEditingBlueprint ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* 4대 주요 지표 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">총 채무액 (원금)</span>
            <p className="text-base md:text-xl font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(totalDebtValue)}
            </p>
            <span className="text-xs text-slate-400 block mt-0.5">금융권 원금 합산</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block whitespace-nowrap">예상 감면액</span>
              {activeResult && activeResult.debtReductionRate > 0 && (
                <span className="text-xs font-extrabold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                  {activeResult.debtReductionRate}% 감면
                </span>
              )}
            </div>
            <p className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {activeResult ? formatResultTotal(activeResult.totalDebtReduction) : '-'}
            </p>
            <span className="text-xs text-emerald-700 dark:text-emerald-400/70 block mt-0.5">면책 시 갚지 않아도 되는 원금(예상)</span>
          </div>
          <div className="p-4 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/20">
            <span className="text-xs font-bold text-brand dark:text-brand-light block">예상 월 변제금</span>
            <p className="text-base md:text-xl font-black text-brand dark:text-brand-light mt-1">
              {activeResult ? formatResultMonthly(activeResult.monthlyPayment) : '-'}
            </p>
            <span className="text-xs text-brand/70 block mt-0.5">36개월 기준 산정</span>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">법정 인정 생계비</span>
            <p className="text-base md:text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {activeResult ? formatResultMonthly(activeResult.recognizedLivingCost) : '-'}
            </p>
            <span className="text-xs text-blue-600/70 dark:text-blue-400/70 block mt-0.5">
              {(profile?.dependents || 0) + 1}인 가구 기준
            </span>
          </div>
        </div>

        {/* 가계 재정 & 채무 세부 명세 요약표 */}
        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 md:p-5 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              가계 재정 및 채무 세부 명세 요약
            </span>
            <span className="text-xs text-slate-400 font-medium">단위: 만 원</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block">월 평균 소득</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                {(profile?.monthlyIncome || profile?.income || 0).toLocaleString()}만원
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                {(profile?.incomeType || profile?.employmentType || profile?.jobType) === 'salary' || (profile?.jobType === 'SALARIED') ? '근로소득자' : (profile?.incomeType || profile?.employmentType || profile?.jobType) === 'business' || (profile?.jobType === 'BUSINESS') ? '사업소득자' : (profile?.incomeType || profile?.employmentType || profile?.jobType) === 'freelancer' || (profile?.jobType === 'FREELANCER') ? '프리랜서' : '소득자'}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block">부양가족 / 가구원</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                {(profile?.dependents || 0) + 1}인 가구
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                본인 외 부양 {profile?.dependents || 0}명
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block">주거형태 / 보증금</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                {profile?.housingType === 'rent' ? '월세' : profile?.housingType === 'jeonse' ? '전세' : profile?.housingType === 'owned' ? '자가' : '무상거주'}
                {profile?.rentalDeposit ? ` (${profile.rentalDeposit.toLocaleString()}만)` : ''}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                월세 {profile?.rentCost ? `${profile.rentCost.toLocaleString()}만원` : '0원'}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block">재산 총액 (청산가치)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                {activeResult ? formatResultTotal(activeResult.liquidationValue) : `${(profile?.myAssets || 0).toLocaleString()}만원`}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                최우선 변제 공제 반영
              </span>
            </div>
          </div>

          {/* 금융권별 세부 내역 */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold self-center">채무 구성:</span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              은행 <strong>{(profile?.debtTypes?.banks || 0).toLocaleString()}만</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              카드/캐피탈 <strong>{(profile?.debtTypes?.cards || 0).toLocaleString()}만</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              대부/개인 <strong>{(profile?.debtTypes?.personals || 0).toLocaleString()}만</strong>
            </span>
            {(profile?.priorityDebt || 0) > 0 && (
              <span className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold">
                세금 체납 {profile?.priorityDebt?.toLocaleString()}만
              </span>
            )}
            {(profile?.speculativeLoss || 0) > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 font-bold">
                투자손실 {profile?.speculativeLoss?.toLocaleString()}만
              </span>
            )}
          </div>
        </div>

        {/* 접이식 상세 수정 폼 */}
        {isEditingBlueprint && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
            <BlueprintEditForm vm={vm} />
          </div>
        )}

        {/* 의뢰인 전달사항 메모 */}
        <ClientNotesEditor vm={vm} />
      </div>
    </>
  );
}
