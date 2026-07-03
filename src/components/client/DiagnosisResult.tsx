import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, RotateCcw, Shield, TrendingDown, Clock, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles, Scale,
  Home, FileSearch, Users, ArrowLeft, Zap, Target, Info
} from 'lucide-react';
import { DiagnosisResult, StrategyType, StrategyRecommendation } from '../../types';

// ── Props ──────────────────────────────────────────────────────────
interface DiagnosisResultProps {
  result: DiagnosisResult;
  onStartDetailedDiagnosis: () => void;
  onViewLawyers: () => void;
  onRetakeDiagnosis: () => void;
  onGoHome: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────
const formatManWon = (amount: number): string => {
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000);
    const man = amount % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${amount.toLocaleString()}만원`;
};

const STRATEGY_ICONS: Record<StrategyType, string> = {
  REHABILITATION: '⚖️',
  BANKRUPTCY: '🔄',
  NEGOTIATION: '🤝',
  FRESH_START: '🌱',
  WAIT_AND_SEE: '⏳',
};

const STRATEGY_COLORS: Record<StrategyType, string> = {
  REHABILITATION: 'from-indigo-500/20 to-violet-500/20',
  BANKRUPTCY: 'from-rose-500/20 to-pink-500/20',
  NEGOTIATION: 'from-emerald-500/20 to-teal-500/20',
  FRESH_START: 'from-lime-500/20 to-green-500/20',
  WAIT_AND_SEE: 'from-amber-500/20 to-yellow-500/20',
};

const urgencyConfig: Record<
  'immediate' | 'soon' | 'can_wait',
  { label: string; color: string; bg: string; border: string }
> = {
  immediate: {
    label: '긴급',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
  },
  soon: {
    label: '빠른 조치 필요',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
  },
  can_wait: {
    label: '여유 있음',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
  },
};

const confidenceBadge = (level: 'high' | 'medium' | 'low') => {
  const map = {
    high: { label: '높은 적합도', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    medium: { label: '보통', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    low: { label: '참고', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  };
  return map[level];
};

// ── Animated counter hook ──────────────────────────────────────────
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ── Sub-components ─────────────────────────────────────────────────

function ResultHero({
  estimatedSavingsAmount,
  estimatedSavingsRate,
  urgencyLevel,
  urgencyMessage,
}: {
  estimatedSavingsAmount: number;
  estimatedSavingsRate: number;
  urgencyLevel: DiagnosisResult['urgencyLevel'];
  urgencyMessage: string;
}) {
  const animatedAmount = useCountUp(estimatedSavingsAmount);
  const animatedRate = useCountUp(Math.round(estimatedSavingsRate * 100));
  const urgency = urgencyConfig[urgencyLevel];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="text-center pt-8 pb-10 px-4"
    >
      {/* Decorative ring */}
      <div className="relative inline-block mb-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute -inset-6 rounded-full bg-indigo-500/10 blur-2xl"
        />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative"
        >
          <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-2 tracking-wide">
            예상 조정 가능 금액
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none">
            약 {formatManWon(animatedAmount)}
          </h1>
          <p className="text-lg sm:text-xl text-indigo-300 mt-1 font-semibold">
            조정 검토 필요
          </p>
        </motion.div>
      </div>

      {/* Badges row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-3 mt-5"
      >
        {/* Savings rate */}
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-medium">
          <TrendingDown className="w-4 h-4" />
          원금의 {animatedRate}% 면책
        </span>

        {/* Urgency */}
        <span
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-medium ${urgency.bg} ${urgency.border} ${urgency.color}`}
        >
          <AlertTriangle className="w-4 h-4" />
          {urgency.label}
        </span>
      </motion.div>

      {/* Urgency message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className={`mt-4 text-sm ${urgency.color} max-w-md mx-auto`}
      >
        {urgencyMessage}
      </motion.p>
    </motion.section>
  );
}

function PrimaryStrategyCard({
  strategy,
  estimatedMonthlyPayment,
  computeResponse,
}: {
  strategy: StrategyRecommendation;
  estimatedMonthlyPayment: number;
  computeResponse?: DiagnosisResult['computeResponse'];
}) {
  const badge = confidenceBadge(strategy.confidence);
  const duration = computeResponse?.preferred?.m
    ? `${computeResponse.preferred.m}개월`
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="px-4 pb-8"
    >
      <div className="relative max-w-2xl mx-auto">
        {/* Animated gradient border */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 opacity-60 blur-[1px] animate-pulse" />

        <div className="relative rounded-2xl bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 border border-white/10">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{STRATEGY_ICONS[strategy.type]}</span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                  추천 전략
                </p>
                <h2 className="text-2xl font-bold text-white">{strategy.label}</h2>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${badge.cls}`}
            >
              <Target className="w-3 h-3" />
              {badge.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            {strategy.description}
          </p>

          {/* Key numbers */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-slate-500 mb-1">예상 월 변제금</p>
              <p className="text-lg font-bold text-white">
                약 {formatManWon(estimatedMonthlyPayment)}
              </p>
            </div>
            {duration && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-slate-500 mb-1">예상 변제 기간</p>
                <p className="text-lg font-bold text-white">{duration}</p>
              </div>
            )}
          </div>

          {/* Pros / Cons */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Pros */}
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                장점
              </p>
              <ul className="space-y-2">
                {strategy.pros.map((pro, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {pro}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                단점
              </p>
              <ul className="space-y-2">
                {strategy.cons.map((con, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                    className="flex items-start gap-2 text-sm text-slate-400"
                  >
                    <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    {con}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function StrategyComparisonSection({
  allStrategies,
  primaryType,
}: {
  allStrategies: StrategyRecommendation[];
  primaryType: StrategyType;
}) {
  const [open, setOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="px-4 pb-8 max-w-2xl mx-auto"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl bg-white/5 backdrop-blur border border-white/10 px-5 py-4 text-left hover:bg-white/[0.07] transition-colors"
      >
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <Scale className="w-4 h-4 text-indigo-400" />
          다른 전략도 비교해보세요
        </span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-3 pt-4">
              {allStrategies.map((s, idx) => {
                const isPrimary = s.type === primaryType;
                const isExpanded = expandedIdx === idx;
                const badge = confidenceBadge(s.confidence);

                return (
                  <motion.div
                    key={s.type}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className={`rounded-xl border backdrop-blur cursor-pointer transition-all duration-200 ${
                      isPrimary
                        ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20'
                        : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{STRATEGY_ICONS[s.type]}</span>
                          <h3 className="text-sm font-bold text-white">{s.label}</h3>
                          {isPrimary && (
                            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">
                              추천
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {s.description}
                      </p>

                      {/* Expand indicator */}
                      <div className="flex justify-center mt-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div>
                                <p className="text-[10px] text-emerald-400 font-semibold mb-1">장점</p>
                                <ul className="space-y-1">
                                  {s.pros.map((p, i) => (
                                    <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 font-semibold mb-1">단점</p>
                                <ul className="space-y-1">
                                  {s.cons.map((c, i) => (
                                    <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1">
                                      <XCircle className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                                      {c}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ActionItemsSection({ items }: { items: string[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="px-4 pb-8 max-w-2xl mx-auto"
    >
      <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-6">
        <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
          <span className="text-lg">💡</span> 지금 당장 해야 할 것
        </h3>
        <ol className="space-y-3">
          {items.map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                {i + 1}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed pt-1">{item}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}

function WarningsSection({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="px-4 pb-8 max-w-2xl mx-auto"
    >
      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-lg">⚠️</span> 주의사항
      </h3>
      <div className="space-y-3">
        {warnings.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 + i * 0.08 }}
            className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/90 leading-relaxed">{w}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function MatchingGuidanceCard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.5 }}
      className="px-4 pb-8 max-w-2xl mx-auto"
    >
      <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/30 p-6 space-y-4 text-left">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1.5 text-left">
            <h4 className="font-bold text-white text-sm sm:text-base">⚠️ 중요 안내: 분석 정보의 한계 고지</h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              본 결과는 입력하신 5가지 기초 항목만을 토대로 분석한 <strong>단순 예상치(사전 체크)</strong>이며, 법률 판단이 아닙니다. 정확한 가능 여부는 변호사 검토가 필요합니다.
              현재 단계에서는 변호사가 고객님의 구체적인 연체 정보, 최근 대출금의 사용처, 재산 보유 상태 등을 알지 못하므로 정확한 대책 수립이 어렵습니다.
            </p>
          </div>
        </div>
        
        <div className="border-t border-indigo-500/20 pt-4 text-left">
          <h4 className="font-bold text-white text-xs mb-3 flex items-center gap-1.5">
            <span>📊</span> 나만을 위한 1:1 전담 파트너 케어 범위:
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>불법 추심/독촉 즉시 대리 대응 (대리인 제도)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>채무 및 가용 소득 상황 실시간 관리</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>기각 없는 안전한 법원 사건 타이밍 설계</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>최종 면책 결정 이후 신용 회복 관리 안내</span>
            </li>
          </ul>
        </div>
      </div>
    </motion.section>
  );
}

function CTASection({
  onStartDetailedDiagnosis,
  onViewLawyers,
  onRetakeDiagnosis,
}: {
  onStartDetailedDiagnosis: () => void;
  onViewLawyers: () => void;
  onRetakeDiagnosis: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0, duration: 0.5 }}
      className="px-4 pb-12 max-w-2xl mx-auto"
    >
      {/* CTA buttons */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {/* Primary */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartDetailedDiagnosis}
          className="relative group flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow cursor-pointer"
        >
          <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Users className="w-5 h-5 text-indigo-300" />
          <span>⚖️ 내 전담 변호사 지정받고 1:1 매칭 시작하기</span>
          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>

        {/* Secondary */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewLawyers}
          className="relative group flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-semibold text-white border border-white/20 bg-white/5 backdrop-blur hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Users className="w-5 h-5 text-indigo-400" />
          <span>⚖️ 맞춤 전문가 목록 보기</span>
          <ArrowRight className="w-4 h-4 ml-1 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </div>

      {/* Retake link */}
      <div className="text-center mb-8">
        <button
          onClick={onRetakeDiagnosis}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          다시 체크하기
        </button>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            본 결과는 간이 분석이며 법률 자문이 아닙니다. 정확한 판단을 위해 정밀 분석 또는 전문가 상담을 권장합니다.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function DiagnosisResultPage({
  result,
  onStartDetailedDiagnosis,
  onViewLawyers,
  onRetakeDiagnosis,
  onGoHome,
}: DiagnosisResultProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 font-[Pretendard]">
      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/70 border-b border-white/5"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={onGoHome}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </button>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-500 font-medium">사전 체크 결과</span>
          </div>
        </div>
      </motion.header>

      {/* Section 1: Hero */}
      <ResultHero
        estimatedSavingsAmount={result.estimatedSavingsAmount}
        estimatedSavingsRate={result.estimatedSavingsRate}
        urgencyLevel={result.urgencyLevel}
        urgencyMessage={result.urgencyMessage}
      />

      {/* Divider */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Section 2: Primary Strategy */}
      <div className="pt-8">
        <PrimaryStrategyCard
          strategy={result.primaryStrategy}
          estimatedMonthlyPayment={result.estimatedMonthlyPayment}
          computeResponse={result.computeResponse}
        />
      </div>

      {/* Section 3: Strategy Comparison */}
      <StrategyComparisonSection
        allStrategies={result.allStrategies}
        primaryType={result.primaryStrategy.type}
      />

      {/* Section 4: Action Items */}
      {result.actionItems.length > 0 && (
        <ActionItemsSection items={result.actionItems} />
      )}

      {/* Section 5: Warnings */}
      <WarningsSection warnings={result.warnings} />

      {/* Section 5.5: Matching Guidance Card */}
      <MatchingGuidanceCard />

      {/* Section 6: CTA */}
      <CTASection
        onStartDetailedDiagnosis={onStartDetailedDiagnosis}
        onViewLawyers={onViewLawyers}
        onRetakeDiagnosis={onRetakeDiagnosis}
      />
    </div>
  );
}
