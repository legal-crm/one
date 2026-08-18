import React from 'react';
import {
  X, Scale, Shield, AlertTriangle,
  ArrowRight, HelpCircle, Landmark, RefreshCw,
  FileText, BookOpen
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
export type SolutionType = 'rehab' | 'bankruptcy' | 'credit' | 'representation' | 'tax';

interface SolutionDetailModalProps {
  solutionType: SolutionType;
  onClose: () => void;
  onStartDiagnosis: () => void;
  onApplyConsult: (title: string, content: string) => void;
}

interface SolutionData {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  legalBasis: string;
  ctaTitle: string;
  ctaContent: string;
}

// ─── Theme Config ────────────────────────────────────────────────────────────
const themes: Record<SolutionType, {
  gradient: string;
  iconBg: string;
  iconText: string;
  highlight: string;
  border: string;
}> = {
  rehab: {
    gradient: 'from-indigo-600 to-blue-600',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    highlight: 'bg-indigo-50 dark:bg-indigo-950/20',
    border: 'border-indigo-200 dark:border-indigo-800/50',
  },
  bankruptcy: {
    gradient: 'from-rose-600 to-pink-600',
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconText: 'text-rose-600 dark:text-rose-400',
    highlight: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800/50',
  },
  credit: {
    gradient: 'from-emerald-600 to-teal-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconText: 'text-blue-600 dark:text-blue-400',
    highlight: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/50',
  },
  representation: {
    gradient: 'from-purple-600 to-violet-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconText: 'text-purple-600 dark:text-purple-400',
    highlight: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800/50',
  },
  tax: {
    gradient: 'from-amber-600 to-orange-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconText: 'text-amber-600 dark:text-amber-400',
    highlight: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
};

// ─── Icon Resolver ───────────────────────────────────────────────────────────
const getIcon = (type: SolutionType, className: string) => {
  switch (type) {
    case 'rehab': return <Scale className={className} />;
    case 'bankruptcy': return <AlertTriangle className={className} />;
    case 'credit': return <RefreshCw className={className} />;
    case 'representation': return <Shield className={className} />;
    case 'tax': return <Landmark className={className} />;
  }
};

// ─── Solution Data ───────────────────────────────────────────────────────────
const solutions: Record<SolutionType, SolutionData> = {
  rehab: {
    title: '개인회생',
    subtitle: '계속적·반복적 수입 가능성이 있는 개인채무자가 법원에 신청하는 절차',
    badge: '제도 일반정보',
    description: '개인회생은 채무자 회생 및 파산에 관한 법률 제579조~제624조에 근거한 법원 인가 채무조정 절차입니다.\n\n대상: 총 채무 무담보 5억 원, 담보 10억 원 이하인 개인으로서 정기적 소득이 있는 급여소득자 또는 영업소득자가 신청할 수 있습니다. 현재 소득의 종류와 수입이 계속될 가능성, 전체 채무의 종류와 금액(담보채무·무담보채무 구분), 보유재산과 처분 이력, 부양가족 및 생활비, 과거 개인회생·파산·면책 이력 등이 심사 대상입니다.\n\n핵심 효과: 법원이 변제계획을 인가하고 신청인이 계획을 이행한 경우, 법이 정한 요건에 따라 남은 채무에 대한 면책 여부가 결정될 수 있습니다. 개시결정과 함께 금지명령·중지명령을 신청할 수 있으며, 발령 여부는 법원이 결정합니다. 개인파산과 달리 보유 재산을 유지하면서 절차를 진행할 수 있습니다(다만 재산가치가 변제금에 반영).\n\n진행 흐름: 자료 준비 및 신청서 작성 → 법원에 신청서 접수 → 금지·중지명령 신청 및 법원 심사 → 절차 개시 여부 결정 → 변제계획 인가 여부 결정 → 3~5년 변제 이행 → 면책 결정 순으로 진행됩니다. 구체적인 신청요건, 변제기간, 변제금 및 면책범위는 사건별로 달라질 수 있습니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제579조~제624조',
    ctaTitle: '개인회생 제도 관련 상담 문의',
    ctaContent: '개인회생 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  bankruptcy: {
    title: '개인파산',
    subtitle: '채무자의 재산·소득·채무상태 등을 법원이 심사하는 절차',
    badge: '파산선고 및 면책 심사 절차',
    description: '개인파산은 채무자 회생 및 파산에 관한 법률 제305조~제566조에 근거한 절차로, 채무자가 지급불능 상태에 있는 경우 법원에 신청합니다.\n\n대상: 소득이 없거나 극히 적어 채무를 변제할 수 없는 "지급불능 상태"의 개인이 신청할 수 있습니다. 채무 금액에 상한 제한이 없으며, 현재 소득 상태와 향후 소득 가능성, 채무의 종류·금액 및 발생 경위, 보유재산의 종류와 가액, 과거 파산·면책 이력 및 면책불허가 사유 해당 여부가 심사됩니다.\n\n핵심 효과: 법원의 면책결정이 확정되면 법이 정한 범위에서 채무에 대한 책임이 면제될 수 있습니다. 세금, 벌금, 양육비 등 면책되지 않는 채무가 있을 수 있습니다. 개인회생과 달리 매달 변제금을 납부하는 절차가 없으며, 면책결정 확정 후 복권되면 직업 제한 등이 해소됩니다.\n\n진행 흐름: 서류 준비 및 심사 신청 → 법원의 파산 선고 → 파산관재인(심사관) 조사 → 재산 정리 및 배당 → 최종 면책 결정 순으로 진행됩니다. 파산선고와 면책결정은 서로 구분되며, 면책 여부와 범위는 법원의 심사에 따라 결정됩니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제305조~제566조',
    ctaTitle: '개인파산 제도 관련 상담 문의',
    ctaContent: '개인파산 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  credit: {
    title: '신용회복',
    subtitle: '신용회복위원회가 운영하는 채무조정 제도',
    badge: '협약 금융회사 채무조정',
    description: '신용회복은 신용회복위원회 운영규정 및 금융기관 자율 협약에 근거하여, 법원 절차 없이 협약 금융기관 채무에 대한 이자 조정, 상환 기간 변경 등을 신청할 수 있는 제도입니다.\n\n대상: 협약 금융기관(은행, 카드사, 캐피탈 등)에 대한 채무가 있으며 연체 상태인 개인이 신청할 수 있습니다. 프리워크아웃(연체 30~89일)과 개인워크아웃(연체 90일 이상)으로 나뉘며, 협약 금융기관에 대한 채무 여부, 연체 기간 및 연체 상태, 소득 상태 및 상환 가능 여부, 과거 채무조정 이력이 확인됩니다.\n\n핵심 효과: 신청이 접수되면 협약 금융기관에 추심 중지가 요청됩니다. 연체 기간과 채무 상태에 따라 이자 조정, 상환 기간 변경 등의 조정이 이루어질 수 있습니다. 다만 개인 간의 빚, 사채 등은 조정 대상에서 제외될 수 있으며, 원금 감면 범위는 개인회생에 비해 제한적일 수 있습니다.\n\n진행 흐름: 위원회 상담 및 접수(전화 1600-5500 또는 모바일 앱) → 추심 중지 요청 → 채무 조정 심사 및 금융기관 동의 → 조정 계약 체결 → 분할 상환 시작 순으로 진행됩니다. 지원 조건과 조정 내용은 채무 상태에 따라 달라질 수 있습니다.',
    legalBasis: '신용회복위원회 운영규정, 금융기관 자율 협약',
    ctaTitle: '신용회복(워크아웃) 관련 상담 문의',
    ctaContent: '신용회복 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  representation: {
    title: '채무자대리',
    subtitle: '채권추심 대응과 관련된 제도',
    badge: '추심 대응 관련 제도',
    description: '채무자대리는 대부업법 제9조의2 및 채권의 공정한 추심에 관한 법률 제8조에 근거하여, 변호사가 채무자를 대리해 채권자·추심업체와의 직접 접촉을 차단하고 법적 대응을 수행하는 제도입니다.\n\n대상: 대부업체, 미등록 대부업, 추심회사 등으로부터 과도한 추심(전화, 방문, 직장 연락 등)을 받고 있는 채무자가 이용할 수 있습니다. 채권자의 종류, 추심 행위의 내용과 증거자료(문자, 녹취 등), 채무의 종류와 금액, 불법추심 여부(야간추심, 제3자 통보, 폭언 등)가 확인됩니다.\n\n핵심 효과: 대리인 선임 통보 후 채권자의 직접 추심 행위가 법률상 제한됩니다. 불법 추심이 있는 경우 관련 법률에 따라 신고 또는 법적 대응을 검토할 수 있습니다. 다만 이 제도는 채무 원금 자체가 깎이거나 없어지는 것은 아니며, 근본적인 채무 해결을 위해서는 개인회생이나 파산 등의 절차를 병행해야 합니다.\n\n진행 흐름: 전문가 상담 → 대리인 선임 위임장 작성 → 채권자별 대리인 선임 통보서 발송 → 직접 추심 행위 제한 → 변호사가 채권자와 협상 진행 순으로 이루어집니다. 적용 대상과 범위, 비용 등은 채권자 유형과 개별 사안에 따라 달라질 수 있습니다.',
    legalBasis: '대부업법 제9조의2, 채권의 공정한 추심에 관한 법률 제8조',
    ctaTitle: '채무자대리인 제도 관련 상담 문의',
    ctaContent: '채무자대리인 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  tax: {
    title: '세금체납 관리',
    subtitle: '체납처분 및 납부 지원제도 일반정보',
    badge: '체납처분 및 납부 관련 정보',
    description: '세금체납 관리는 국세기본법 제27조(소멸시효), 지방세징수법, 국세징수법에 근거한 체납처분 대응 및 납부 유예·분납 제도입니다.\n\n대상: 국세(소득세, 부가세 등) 또는 지방세를 체납하여 압류, 공매 등 체납처분을 받고 있거나 받을 우려가 있는 개인 및 사업자가 이용할 수 있습니다. 체납 세목의 종류와 금액(국세·지방세 구분), 체납 기간 및 그간의 독촉·압류 이력, 현재 압류 상태 및 대상 재산, 사업자등록 이력과 폐업 시기 등이 확인됩니다.\n\n핵심 효과: 관계 법령에 따라 징수권 소멸시효가 완성된 경우 세금 채무가 소멸될 수 있습니다. 부당한 압류에 대해서는 해제를 요청할 수 있으며, 납부유예·분할납부 등의 구제를 받을 수도 있습니다. 다만 세금은 개인파산이나 회생 절차를 통해서도 면책되지 않는 채권이므로 별도의 대응이 필요합니다.\n\n진행 흐름: 체납 및 압류 내역 확인(홈택스 등) → 소멸시효 및 압류 적법성 분석 → 납기 연장·분납 신청 또는 고충 민원 제기 → 관할 세무서 심사 → 결과 확인 순으로 진행됩니다. 개인회생·파산 절차와 별도로 독립적으로 진행할 수 있습니다.',
    legalBasis: '국세기본법 제27조(소멸시효), 지방세징수법, 국세징수법',
    ctaTitle: '세금 체납 관련 상담 문의',
    ctaContent: '세금 체납 관련 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SolutionDetailModal({
  solutionType,
  onClose,
  onStartDiagnosis,
  onApplyConsult,
}: SolutionDetailModalProps) {
  const data = solutions[solutionType];
  const theme = themes[solutionType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className={`relative p-5 md:p-7 bg-gradient-to-r ${theme.gradient}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
              {getIcon(solutionType, 'w-6 h-6 md:w-7 md:h-7 text-white')}
            </div>
            <div>
              <span className="text-white/90 text-xs md:text-sm font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
                {data.badge}
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-white mt-1">
                {data.title} 제도 알아보기
              </h3>
              <p className="text-white/70 text-sm md:text-sm mt-0.5">{data.subtitle}</p>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="p-5 md:p-7 space-y-6 md:space-y-8 overflow-y-auto text-left flex-1">
          {/* Section: 제도 개요 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <BookOpen className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">제도 개요</h4>
            </div>
            <div className={`p-4 md:p-5 rounded-2xl ${theme.highlight} border ${theme.border}`}>
              <div className="space-y-3">
                {data.description.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {paragraph.startsWith('대상:') || paragraph.startsWith('핵심 효과:') || paragraph.startsWith('진행 흐름:') ? (
                      <>
                        <strong className="text-slate-800 dark:text-slate-100">{paragraph.split(':')[0]}:</strong>
                        {paragraph.substring(paragraph.indexOf(':') + 1)}
                      </>
                    ) : (
                      paragraph
                    )}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/40">
                <FileText className={`w-3.5 h-3.5 ${theme.iconText} shrink-0`} />
                <span className="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                  법적 근거: {data.legalBasis}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────── */}
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={() => {
              onClose();
              onStartDiagnosis();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            내 채무현황 정리하기
          </button>
          <button
            onClick={() => onApplyConsult(data.ctaTitle, data.ctaContent)}
            className={`w-full sm:w-auto flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r ${theme.gradient} hover:opacity-90 text-white rounded-2xl text-sm font-bold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
          >
            전문가 정보 직접 검색하기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
