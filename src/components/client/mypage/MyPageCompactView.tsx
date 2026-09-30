import { FileText, Save, Scale, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { MyPageModel } from './useMyPageModel';
import BlueprintEditForm from './BlueprintEditForm';
import ClientNotesEditor from './ClientNotesEditor';

/**
 * 내 관리방 '내 채무' 창에서 쓰는 간단 보기 (isCompact, MyPageView에서 분리)
 */
export default function MyPageCompactView({ vm }: { vm: MyPageModel }) {
  const {
    activeResult, formatCurrency, formatResultMonthly, formatResultTotal, onNavigateToChat, onStartDiagnosis,
    profile, totalDebtValue,
  } = vm;
  if (!profile) {
    return (
      <div className="p-8 text-center space-y-4 animate-fadeIn text-left">
        <div className="w-14 h-14 mx-auto bg-brand/10 rounded-full flex items-center justify-center text-brand">
          <FileText className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-base text-slate-900 dark:text-white text-center">아직 자가진단 기록이 없습니다</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed text-center">
          내 상황 체크하기를 먼저 진행해 주시면 채무 및 인적사항을 바로 확인하고 수정하실 수 있습니다.
        </p>
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onStartDiagnosis}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>내 상황 체크하기</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 text-left animate-fadeIn">
      {/* 상단 안내 배너 */}
      <div className="bg-gradient-to-r from-brand/10 via-blue-50/50 to-blue-50/40 dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl border border-brand/20">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand shrink-0" />
          <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white">
            내 상황 체크 입력 내용과 채무 현황
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          내 상황 체크에서 입력한 가족·소득·채무 정보입니다. 고치면 예상 변제금이 다시 계산되고, 상담을 요청한 변호사에게도 바뀐 정보가 전달됩니다.
        </p>
      </div>

      {/* 4대 주요 지표 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">총 채무액 (원금)</span>
          <p className="text-base md:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {formatCurrency(totalDebtValue)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">예상 감면액</span>
          <p className="text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {activeResult ? formatResultTotal(activeResult.totalDebtReduction) : '-'}
            {activeResult && activeResult.debtReductionRate > 0 && (
              <span className="text-xs font-bold text-emerald-600 ml-1">({activeResult.debtReductionRate}%)</span>
            )}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/20">
          <span className="text-xs font-bold text-brand dark:text-brand-light block">예상 월 변제금</span>
          <p className="text-base md:text-lg font-black text-brand dark:text-brand-light mt-0.5">
            {activeResult ? formatResultMonthly(activeResult.monthlyPayment) : '-'}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">인정 생계비</span>
          <p className="text-base md:text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {activeResult ? formatResultMonthly(activeResult.recognizedLivingCost) : '-'}
          </p>
        </div>
      </div>

      {/* 0~6번 상세 폼 (누락 없이 전부 편집 가능) */}
      <BlueprintEditForm vm={vm} />

      {/* 7번 의뢰인 특이사항 및 전달 메모 */}
      <ClientNotesEditor vm={vm} />

      {/* 하단 저장 & 닫기 액션 */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-5 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-2 z-10">
        <button
          type="button"
          onClick={() => onNavigateToChat()}
          className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={() => {
            // 입력값은 바뀔 때마다 바로 반영된다. 이 버튼은 편집을 마치는 역할만 한다
            toast.success('수정한 내용이 반영되었습니다.', {
              description: '상단의 예상 변제금과 채무 지표도 새 값으로 다시 계산했습니다.',
              duration: 3000,
            });
            onNavigateToChat();
          }}
          className="flex-1 flex items-center justify-center gap-2 min-h-11 px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          수정 완료
        </button>
      </div>
    </div>
  );
}
