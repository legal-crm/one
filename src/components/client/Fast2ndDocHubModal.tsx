import React, { useState } from 'react';
import { 
  X, Sparkles, FileText, CheckCircle2, ChevronRight, Mic, 
  HelpCircle, Send, Printer, ShieldCheck, ArrowRight, BookOpen,
  DollarSign, Calculator, Layers, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import LawyerDocShareModal from './LawyerDocShareModal';
import type { SharedDocPackageItem } from '../../services/lawyerDocShareService';

interface Fast2ndDocHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientId?: string;
  hasStatement?: boolean;
  hasIncomeExpense?: boolean;
  hasProperty?: boolean;
  statementData?: any;
  incomeExpenseData?: any;
  propertySummary?: any;
  debtSummary?: any;
  onOpenStatementModal: () => void;
  onOpenIncomeExpenseModal: () => void;
  onOpenPropertyModal: () => void;
}

export default function Fast2ndDocHubModal({
  isOpen,
  onClose,
  clientName = '김가람',
  clientId = 'client-self',
  hasStatement = true,
  hasIncomeExpense = true,
  hasProperty = false,
  statementData,
  incomeExpenseData,
  propertySummary,
  debtSummary,
  onOpenStatementModal,
  onOpenIncomeExpenseModal,
  onOpenPropertyModal
}: Fast2ndDocHubModalProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [expandedWhyHow, setExpandedWhyHow] = useState<string | null>(null);

  if (!isOpen) return null;

  // 전체 완성도 계산
  const completedCount = (hasStatement ? 1 : 0) + (hasIncomeExpense ? 1 : 0) + (hasProperty ? 1 : 0);
  const totalCount = 3;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const docPackage: SharedDocPackageItem = {
    hasStatement,
    statementData,
    hasIncomeExpense,
    incomeExpenseData,
    hasProperty,
    propertySummary: propertySummary || {
      totalAssetValue: 12000000,
      depositAmount: 10000000,
      vehicleValue: 2000000,
      realEstateValue: 0
    },
    hasDebtSummary: true,
    debtSummary: debtSummary || {
      totalDebt: 58000000,
      monthlyIncome: 2450000,
      courtName: '서울회생법원',
      expectedReductionRate: 62,
      monthlyPayment: 620000
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 & 브랜드 슬로건 */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white relative shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand text-white">
                Open Legal Prep Hub
              </span>
              <span className="text-xs text-indigo-300 font-bold">
                2차 핵심 서류 원스톱 완성센터
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1 mt-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              "개인회생 서류와 모든 준비는 <span className="text-emerald-400">마이김변에서 쉽고 빠르게!</span>"
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              변호사를 어디서 선임하셨든 상관없습니다. 복잡한 진술서와 수지표를 말로 편하게 작성하고, 담당 변호사·사무장님께 1초 만에 전달하세요.
            </p>
          </div>

          {/* 진행도 게이지 바 */}
          <div className="mt-5 p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-indigo-200">2차 필수서류 준비 완료율</span>
              <span className="text-emerald-400 font-black">{completedCount}/{totalCount}건 준비됨 ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 바디 컨텐츠: 3대 필수 서류 카드 목록 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-left">
          
          {/* 열린 안내 배너 */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-emerald-950 dark:text-emerald-200 block">
                🌱 타 법률사무소 진행자 및 나홀로 전자소송 준비자도 100% 무료 이용
              </span>
              <p className="text-emerald-800/80 dark:text-emerald-300 leading-relaxed text-[11px]">
                의뢰인이 직접 써야 하는 진술서와 수지표를 마이김변 AI가 법원 표준 양식으로 완성해 드립니다. 완성 후 담당자 휴대폰 번호로 전송하면 변호사·사무장님이 즉시 열람 및 전자소송에 접수할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 1. 법원 진술서(D5104) 카드 */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3.5 transition-all hover:border-indigo-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      1. 대법원 표준 진술서 (D5104)
                    </h3>
                    {hasStatement ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>작성 완료됨</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        작성 대기
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    학력·경력, 거주형태, 채무증대과정, 지급불능 사정, 갱생다짐 4단 법원 서식
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpandedWhyHow(expandedWhyHow === 'stmt' ? null : 'stmt')}
                  className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 transition"
                >
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                    <span>왜 & 어떻게?</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenStatementModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{hasStatement ? '🎙️ 말로 수정하기' : '🎙️ 말로 작성하기'}</span>
                </button>
              </div>
            </div>

            {/* Why & How 가이드 아코디언 */}
            {expandedWhyHow === 'stmt' && (
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 text-xs space-y-2 animate-fadeIn">
                <div className="space-y-1">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                    🎯 왜 법원에 제출해야 하나요? (Why)
                  </span>
                  <p className="text-indigo-900/80 dark:text-indigo-300 text-[11px] leading-relaxed pl-3.5">
                    진술서는 신청인이 직접 작성해야 하는 유일한 서류입니다. 판사와 회생위원은 진술서를 통해 채무가 사치·낭비가 아닌 '불가피한 생계·사업 실패'였음을 확인하고 면책 여부를 결정합니다.
                  </p>
                </div>
                <div className="space-y-1 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/40">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                    💡 어떻게 쓰면 되나요? (How)
                  </span>
                  <p className="text-indigo-900/80 dark:text-indigo-300 text-[11px] leading-relaxed pl-3.5">
                    마이크를 켜고 AI 질문에 편하게 대답만 하세요. AI가 법원 판결문 양식(채무발생원인 → 증대경위 → 파탄시점 → 갱생다짐)으로 완벽하게 다듬어 줍니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. 수입 및 지출 내역서(수지표, D5103) 카드 */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3.5 transition-all hover:border-emerald-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      2. 수입 및 지출 내역서 (수지표, D5103)
                    </h3>
                    {hasIncomeExpense ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>작성 완료됨</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        작성 대기
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    사업자·프리랜서·일용직 필수! 월평균 수입, 필요경비, 12개월 장부 법원 규격
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpandedWhyHow(expandedWhyHow === 'inc' ? null : 'inc')}
                  className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 transition"
                >
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>왜 & 어떻게?</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenIncomeExpenseModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{hasIncomeExpense ? '🎙️ 말로 수정하기' : '🎙️ 말로 작성하기'}</span>
                </button>
              </div>
            </div>

            {/* Why & How 가이드 아코디언 */}
            {expandedWhyHow === 'inc' && (
              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 text-xs space-y-2 animate-fadeIn">
                <div className="space-y-1">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                    🎯 왜 법원에 제출해야 하나요? (Why)
                  </span>
                  <p className="text-emerald-900/80 dark:text-emerald-300 text-[11px] leading-relaxed pl-3.5">
                    수지표는 매월 갚아야 할 '월 변제금'을 결정하는 가장 중요한 서류입니다. 매출에서 상가월세, 배달료, 재료비 등 영업경비를 정확히 소명해야 가용소득이 합리적으로 인정되어 변제금이 낮아집니다.
                  </p>
                </div>
                <div className="space-y-1 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                    💡 어떻게 쓰면 되나요? (How)
                  </span>
                  <p className="text-emerald-900/80 dark:text-emerald-300 text-[11px] leading-relaxed pl-3.5">
                    복잡한 12개월 엑셀을 몰라도 됩니다! 마이크를 켜고 "카드 400에 현금 100이고, 월세 90, 배달비 50 나가요"라고 말씀하시면 AI가 수지표 12개월 장부를 3초 만에 채워줍니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. 재산상황표 (D5102) 카드 */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3.5 transition-all hover:border-blue-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      3. 법원 제출용 재산상황표 (D5102)
                    </h3>
                    {hasProperty ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>작성 완료됨</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        선택 작성
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    예금·적금, 자동차, 임차보증금, 보험환급금 등 6대 재산 청산가치 소명
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpandedWhyHow(expandedWhyHow === 'prop' ? null : 'prop')}
                  className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 transition"
                >
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>왜 & 어떻게?</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPropertyModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{hasProperty ? '📋 수정하기' : '📋 간편 체크 작성'}</span>
                </button>
              </div>
            </div>

            {/* Why & How 가이드 아코디언 */}
            {expandedWhyHow === 'prop' && (
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 text-xs space-y-2 animate-fadeIn">
                <div className="space-y-1">
                  <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1">
                    🎯 왜 법원에 제출해야 하나요? (Why)
                  </span>
                  <p className="text-blue-900/80 dark:text-blue-300 text-[11px] leading-relaxed pl-3.5">
                    개인회생의 핵심 대원칙인 '청산가치 보장의 원칙'(총 변제금이 보유 재산보다 많아야 함)을 입증하는 서류입니다. 공제되는 면제재산(소액보증금 등)을 정확히 제외해야 변제금이 불필요하게 늘어나지 않습니다.
                  </p>
                </div>
                <div className="space-y-1 pt-1 border-t border-blue-200/60 dark:border-blue-900/40">
                  <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1">
                    💡 어떻게 쓰면 되나요? (How)
                  </span>
                  <p className="text-blue-900/80 dark:text-blue-300 text-[11px] leading-relaxed pl-3.5">
                    보유하신 통장잔액, 차량, 보증금 유무를 객관식 체크하듯 입력하시면 법원 기준 재산가액표로 자동 정돈됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* 하단 메인 액션 바 */}
        <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            준비된 서류 패키지를 담당자 휴대폰 번호로 즉시 전달할 수 있습니다.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                toast.success('대법원 표준 규격 A4 인쇄 미리보기를 준비합니다.');
                window.print();
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>A4 인쇄/PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-black rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>변호사·사무장님께 전달하기</span>
            </button>
          </div>
        </div>

      </div>

      {/* 변호사·사무장 모바일 전달 모달 */}
      <LawyerDocShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        clientId={clientId}
        clientName={clientName}
        docPackage={docPackage}
      />
    </div>
  );
}
