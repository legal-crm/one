import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Shield, Lock, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { DiagnosisAnswers, DiagnosisResult, DiagnosisConfig, DiagnosisQuestion, AppSettings } from '../../types';
import { runDiagnosis, DEFAULT_DIAGNOSIS_QUESTIONS } from '../../engines/diagnosisEngine';
import { fetchSettings } from '../../services/settingsService';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface DiagnosisFlowProps {
  onComplete: (result: DiagnosisResult) => void;
  onBack: () => void;
  diagnosisConfig?: DiagnosisConfig;
  initialAnswers?: Partial<DiagnosisAnswers>;
}

// ─────────────────────────────────────────────
// Answer key mapping per step index
// ─────────────────────────────────────────────
const ANSWER_KEYS: (keyof DiagnosisAnswers)[] = [
  'q1_status',
  'q2_debtScale',
  'q3_income',
  'q4_urgentNeed',
  'q5_goal',
];

// ─────────────────────────────────────────────
// Calculating-phase step labels
// ─────────────────────────────────────────────
const CALC_STEPS = [
  '채무 상태 분석 중...',
  '법원 기준 적용 중...',
  '최적 전략 계산 중...',
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function DiagnosisFlow(props: DiagnosisFlowProps) {
  const { onComplete, onBack, diagnosisConfig, initialAnswers } = props;

  const questions: DiagnosisQuestion[] =
    diagnosisConfig?.questions ?? DEFAULT_DIAGNOSIS_QUESTIONS;

  // If Q1 is pre-answered from state checker, start at Q2
  const startStep = (initialAnswers?.q1_status) ? 1 : 0;
  const [currentStep, setCurrentStep] = useState(startStep);
  const [answers, setAnswers] = useState<Partial<DiagnosisAnswers>>(initialAnswers ?? {});
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcPhase, setCalcPhase] = useState(-1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [loadedSettings, setLoadedSettings] = useState<AppSettings | undefined>(undefined);

  // 관리자 환경설정 로드
  useEffect(() => {
    fetchSettings().then(s => setLoadedSettings(s)).catch(() => {});
  }, []);

  // ── Select an option ──────────────────────
  const handleSelect = useCallback(
    (optionId: string) => {
      const key = ANSWER_KEYS[currentStep];
      const updated = { ...answers, [key]: optionId };
      setAnswers(updated);

      // Auto-advance after 400ms
      setTimeout(() => {
        if (currentStep < 4) {
          setDirection(1);
          setCurrentStep((s) => s + 1);
        } else {
          // Last question — begin calculating
          setIsCalculating(true);
          setCalcPhase(0);

          // Sequentially reveal each calculating step
          setTimeout(() => setCalcPhase(1), 500);
          setTimeout(() => setCalcPhase(2), 1000);
          setTimeout(() => {
            const result = runDiagnosis(updated as DiagnosisAnswers, loadedSettings);
            onComplete(result);
          }, 1500);
        }
      }, 400);
    },
    [currentStep, answers, onComplete],
  );

  // ── Go back ────────────────────────────────
  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      onBack();
    } else {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, onBack]);

  // ── Current question data ──────────────────
  const question = questions[currentStep];
  const selectedId = question ? answers[ANSWER_KEYS[currentStep]] : undefined;
  const progress = ((currentStep + 1) / questions.length) * 100;

  // ── Slide animation variants ───────────────
  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  // ─────────────────────────────────────────────
  // Calculating overlay
  // ─────────────────────────────────────────────
  if (isCalculating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/3 h-[300px] w-[300px] rounded-full bg-purple-600/15 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
        >
          {/* Pulsing concentric circles */}
          <div className="relative flex h-28 w-28 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-indigo-400/30"
                animate={{
                  scale: [1, 1.6 + i * 0.3],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: 'easeOut',
                }}
              />
            ))}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="h-10 w-10 text-indigo-400" />
            </motion.div>
          </div>

          <p className="text-lg font-semibold text-white/90">
            AI가 법원 기준으로 분석 중입니다…
          </p>

          {/* Three sequential steps */}
          <div className="flex flex-col items-start gap-3">
            {CALC_STEPS.map((label, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={
                  calcPhase >= idx
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: -20 }
                }
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-2.5"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <span className="text-sm text-white/80">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Main question view
  // ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
      {/* Ambient blurs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* ── Header area ── */}
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Trust badges */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50 sm:gap-5 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            익명 보장
          </span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            1분 소요
          </span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            개인정보 불필요
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-2 flex items-center justify-between text-xs text-white/40">
          <span>자가진단</span>
          <span>
            {currentStep + 1} / {questions.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* ── Question content (scrollable) ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="flex flex-1 flex-col"
            >
              {/* Question title */}
              <div className="mb-8 sm:mb-10">
                <h2 className="text-xl font-bold leading-snug text-white sm:text-2xl">
                  {question.title}
                </h2>
                {question.subtitle && (
                  <p className="mt-2 text-sm text-white/50 sm:text-base">
                    {question.subtitle}
                  </p>
                )}
              </div>

              {/* Option cards */}
              <div className="flex flex-col gap-3 sm:gap-4">
                {question.options.map((opt, idx) => {
                  const isSelected = selectedId === opt.id;

                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt.id)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: idx * 0.06,
                        ease: 'easeOut',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        group relative flex w-full items-start gap-4 rounded-2xl border
                        px-5 py-4 text-left backdrop-blur-xl transition-all duration-200
                        sm:items-center sm:px-6 sm:py-5
                        ${
                          isSelected
                            ? 'border-indigo-400/60 bg-indigo-500/15 ring-2 ring-indigo-400/40'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                        }
                      `}
                    >
                      {/* Selection glow pulse */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl bg-indigo-400/10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.4, 0] }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      )}

                      {/* Icon */}
                      {opt.icon && (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl sm:h-12 sm:w-12 sm:text-2xl">
                          {opt.icon}
                        </span>
                      )}

                      {/* Text */}
                      <div className="flex-1">
                        <span
                          className={`block text-sm font-semibold sm:text-base ${
                            isSelected ? 'text-white' : 'text-white/85'
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="mt-0.5 block text-xs text-white/40 sm:text-sm">
                            {opt.description}
                          </span>
                        )}
                      </div>

                      {/* Check indicator */}
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-500'
                            : 'border-white/20 bg-transparent group-hover:border-white/30'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom navigation ── */}
      <div className="relative z-10 border-t border-white/5 bg-slate-900/60 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 0 ? '나가기' : '이전'}
          </button>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-6 bg-indigo-400'
                    : i < currentStep
                      ? 'w-1.5 bg-indigo-400/50'
                      : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>

          {/* Placeholder for symmetry */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-transparent">
            <ArrowRight className="h-4 w-4" />
            다음
          </div>
        </div>
      </div>
    </div>
  );
}
