import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'motion/react';
import {
  Shield, Lock, Clock, ArrowRight, CheckCircle2, Users,
  TrendingDown, Eye, EyeOff, MessageSquare, Star, ChevronRight,
  Sparkles, Scale, HeartHandshake, Zap, Search, AlertTriangle
} from 'lucide-react';
import { SuccessReview, User as LawyerType, MainBanner, Notice, PlatformConfig } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────
interface LandingPageProps {
  onStartDiagnosis: () => void;
  onNavigate: (tab: string) => void;
  reviews: SuccessReview[];
  lawyers: LawyerType[];
  banners: MainBanner[];
  notices: Notice[];
  platformConfig: PlatformConfig;
}

// ─── Reusable animated section wrapper ────────────────────────────────────────
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 48 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 48 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ─── Stagger-animated child ──────────────────────────────────────────────────
function StaggerChild({
  children,
  index,
  isInView,
}: {
  key?: React.Key;
  children: React.ReactNode;
  index: number;
  isInView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 32, scale: 0.96 }}
      transition={{
        duration: 0.55,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Utility: format currency ────────────────────────────────────────────────
function formatMoney(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}억원`;
  return `${value.toLocaleString()}만원`;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function LandingPage({
  onStartDiagnosis,
  onNavigate,
  reviews,
  lawyers,
  banners,
  notices,
  platformConfig,
}: LandingPageProps) {
  // ── Hero parallax ──────────────────────────────────────────────────────────
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // ── Section in-view refs ───────────────────────────────────────────────────
  const empathyRef = useRef<HTMLDivElement>(null);
  const empathyInView = useInView(empathyRef, { once: true, margin: '-60px' });

  const diffRef = useRef<HTMLDivElement>(null);
  const diffInView = useInView(diffRef, { once: true, margin: '-60px' });

  const flowRef = useRef<HTMLDivElement>(null);
  const flowInView = useInView(flowRef, { once: true, margin: '-60px' });

  const proofRef = useRef<HTMLDivElement>(null);
  const proofInView = useInView(proofRef, { once: true, margin: '-60px' });

  const expertRef = useRef<HTMLDivElement>(null);
  const expertInView = useInView(expertRef, { once: true, margin: '-60px' });

  // ── Pulse animation for CTA ────────────────────────────────────────────────
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden font-[Pretendard,system-ui,sans-serif]">
      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════════════════════ */}
      <div ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 z-0">
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.3), transparent),' +
                'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.2), transparent),' +
                'radial-gradient(ellipse 50% 60% at 10% 60%, rgba(79,70,229,0.15), transparent)',
            }}
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          {/* Floating orbs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
            animate={{ x: [0, 60, -30, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] opacity-15"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            animate={{ x: [0, -50, 40, 0], y: [0, 30, -50, 0], scale: [1, 0.9, 1.15, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Hero content */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-6 max-w-4xl mx-auto"
        >
          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full
                        bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm"
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300 tracking-wide">
              익명 · 무료 · 즉시 확인
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight
                        leading-tight mb-6"
          >
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              개인회생이 정답이
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
              아닐 수도 있습니다
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="text-lg sm:text-xl text-slate-300 mb-3 max-w-2xl mx-auto font-medium"
          >
            내 채무 상황을 분석하고, 끝까지 관리해줄 전담 변호사를 만나세요.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="text-sm text-indigo-400 mb-10 tracking-wide font-semibold"
          >
            ※ 지금 단계에서는 일체의 비용 없이 상황 진단 및 초기 관리 상담이 시작됩니다.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            <motion.button
              onClick={onStartDiagnosis}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="relative group inline-flex items-center gap-3 px-10 py-5
                          bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600
                          rounded-2xl text-lg sm:text-xl font-bold text-white
                          shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40
                          transition-shadow duration-300 cursor-pointer"
            >
              {/* Pulse ring */}
              <motion.span
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600"
                animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="relative z-10 flex items-center gap-3">
                🔍 익명으로 내 상황 확인하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          </motion.div>

          {/* Trust metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.3 }}
            className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3"
          >
            {[
              '3만 건+ 사례 기반 분석',
              '실시간 법원 기준 적용',
              '개인정보 없이 즉시 확인',
            ].map((text, i) => (
              <span key={i} className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {text}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-slate-600 tracking-widest">SCROLL</span>
            <ChevronRight className="w-5 h-5 text-slate-600 rotate-90" />
          </div>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2 — EMPATHY
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6" ref={empathyRef}>
        {/* Subtle bg gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={empathyInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              혹시{' '}
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                이런 고민
              </span>{' '}
              중이신가요?
            </h2>
            <p className="text-slate-500 text-base sm:text-lg">
              혼자 고민하지 마세요. 같은 걱정을 하셨던 분들이 이미 해결하셨습니다.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { emoji: '😰', text: '회생을 해야 하는지 아직 모르겠다' },
              { emoji: '😓', text: '버티는 게 나은지, 지금 해야 하는지 갈림길이다' },
              { emoji: '📞', text: '상담하면 전화가 쏟아질까 봐 무섭다' },
              { emoji: '🤫', text: '주변에 알려지면 어쩌나 걱정된다' },
              { emoji: '💸', text: '잘못된 선택으로 더 손해볼까 봐 불안하다' },
            ].map((item, i) => (
              <StaggerChild key={i} index={i} isInView={empathyInView}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="group relative p-6 rounded-2xl
                              bg-gradient-to-br from-slate-800/60 to-slate-900/60
                              border border-slate-700/40 backdrop-blur-xl
                              hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5
                              transition-colors duration-300 cursor-default"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                                  bg-gradient-to-br from-indigo-500/5 to-purple-500/5
                                  transition-opacity duration-300 pointer-events-none" />
                  <span className="text-3xl mb-4 block">{item.emoji}</span>
                  <p className="relative text-slate-300 text-base sm:text-lg font-medium leading-relaxed">
                    {item.text}
                  </p>
                </motion.div>
              </StaggerChild>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 — DIFFERENTIATOR
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6" ref={diffRef}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                          rounded-full blur-[200px] opacity-[0.06]
                          bg-gradient-to-r from-violet-500 to-indigo-500" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={diffInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={diffInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full
                          bg-violet-500/10 border border-violet-500/20"
            >
              <AlertTriangle className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300">기존 서비스와 다릅니다</span>
            </motion.div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              이 서비스는{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                상담을 연결하는 곳
              </span>
              이 아닙니다
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">
              불필요한 상담 연결 없이, 내 상황에 맞는 전략을 먼저 확인합니다.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Lock,
                title: '개인정보 없이 시작',
                desc: '이름, 연락처 없이 바로 진단을 시작할 수 있습니다.',
                gradient: 'from-indigo-500 to-blue-500',
              },
              {
                icon: Zap,
                title: '1분이면 결과 확인',
                desc: '5가지 질문에 답하면 AI가 즉시 전략을 분석합니다.',
                gradient: 'from-purple-500 to-violet-500',
              },
              {
                icon: Scale,
                title: '여러 방법 비교',
                desc: '회생·파산·조정·대기 — 모든 선택지를 한눈에 비교합니다.',
                gradient: 'from-violet-500 to-fuchsia-500',
              },
              {
                icon: Shield,
                title: '실제 법원 기준 적용',
                desc: '최신 법원 기준과 3만 건 데이터로 정확하게 분석합니다.',
                gradient: 'from-emerald-500 to-teal-500',
              },
            ].map((item, i) => (
              <StaggerChild key={i} index={i} isInView={diffInView}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="group relative p-7 rounded-2xl h-full
                              bg-slate-900/70 backdrop-blur-xl
                              border border-slate-700/40
                              hover:border-slate-600/60
                              transition-all duration-300"
                >
                  {/* Glassmorphic shine */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                                  bg-gradient-to-br from-white/[0.03] to-transparent
                                  transition-opacity duration-500 pointer-events-none" />
                  <div
                    className={`w-12 h-12 rounded-xl mb-5 flex items-center justify-center
                                bg-gradient-to-br ${item.gradient} shadow-lg`}
                  >
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              </StaggerChild>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3.5 — DEDICATED PARTNER CARDS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              🤝 든든한 파트너와 함께하는{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent font-extrabold">
                전담 채무 케어
              </span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              my김변의 전담 변호사는 일회성 상담에 그치지 않고, 해결의 순간까지 의뢰인과 동행하며 채무 상황을 관리합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Shield,
                title: '채무 상황 지속 모니터링',
                desc: '소득 변동, 연체 상태, 채무 구성 비율을 전담 변호사가 실시간으로 추적하여 대응책을 마련합니다.',
                gradient: 'from-blue-600/10 to-indigo-600/10 border-blue-500/20 hover:border-blue-500/40'
              },
              {
                icon: Clock,
                title: '가장 적절한 타이밍 안내',
                desc: '최근 대출금 비율과 법원 기각 동향을 분석하여, 불이익을 보지 않는 최적의 시점에 신청을 진행합니다.',
                gradient: 'from-purple-600/10 to-violet-600/10 border-purple-500/20 hover:border-purple-500/40'
              },
              {
                icon: HeartHandshake,
                title: '추심 및 독촉 즉시 대행',
                desc: '채무자대리인 제도를 발동하여 일상생활을 위협하는 불법 추심과 독촉 전화를 변호사가 전부 대행 방어합니다.',
                gradient: 'from-violet-600/10 to-fuchsia-600/10 border-violet-500/20 hover:border-violet-500/40'
              },
              {
                icon: MessageSquare,
                title: '반복되는 상황 설명 없음',
                desc: '여기저기 전화를 돌리며 매번 채무 역사를 설명할 필요가 없습니다. 내 진단 정보를 기반으로 일관된 관리 서비스를 제공합니다.',
                gradient: 'from-emerald-600/10 to-teal-600/10 border-emerald-500/20 hover:border-emerald-500/40'
              }
            ].map((item, i) => (
              <div
                key={i}
                className={`group relative p-7 rounded-2xl border bg-slate-900/50 backdrop-blur-xl ${item.gradient} transition-all duration-300 hover:translate-y-[-2px]`}
              >
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 — FLOW EXPLAINER
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6" ref={flowRef}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={flowInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                1분
              </span>
              이면 내 상태를 확인할 수 있습니다
            </h2>
            <p className="text-slate-500 text-base sm:text-lg">
              복잡한 절차 없이, 3단계로 끝납니다.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-[2px]">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={flowInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-500/60 via-purple-500/60 to-violet-500/60 origin-left"
              />
            </div>

            {[
              {
                step: '①',
                icon: Search,
                title: '익명 진단',
                desc: '5문항, 1분 소요',
                detail: '개인정보 없이 간단하게 자가진단을 거쳐 예상 탕감 범위를 계산해 봅니다.',
              },
              {
                step: '②',
                icon: Sparkles,
                title: '전담 변호사 배정',
                desc: '1:1 매칭 & 상세 분석',
                detail: '상세 챗봇 대화방을 거치며 금융사별 연체 내역 및 사용 흐름을 전담 변호사에게 전달합니다.',
              },
              {
                step: '③',
                icon: Users,
                title: '실시간 제안 & 케어',
                desc: '수임조건 비교 & 모니터링',
                detail: '배정된 3인 변호사의 실시간 제안서 조건을 비교하고, 최적 접수 시점 조율과 대리 케어를 받습니다.',
              },
            ].map((item, i) => (
              <StaggerChild key={i} index={i} isInView={flowInView}>
                <div className="relative text-center">
                  {/* Step circle */}
                  <motion.div
                    whileHover={{ scale: 1.08, rotate: 3 }}
                    className="relative mx-auto w-32 h-32 rounded-3xl mb-6
                                bg-gradient-to-br from-slate-800 to-slate-900
                                border border-slate-700/50 flex items-center justify-center
                                shadow-xl shadow-indigo-500/5"
                  >
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-lg
                                    bg-gradient-to-br from-indigo-500 to-purple-500
                                    flex items-center justify-center text-xs font-bold text-white shadow-lg">
                      {item.step}
                    </div>
                    <item.icon className="w-10 h-10 text-indigo-400" />
                  </motion.div>

                  <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                  <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10
                                    px-3 py-1 rounded-full mb-3">
                    {item.desc}
                  </span>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-[240px] mx-auto">
                    {item.detail}
                  </p>
                </div>
              </StaggerChild>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={flowInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center mt-16"
          >
            <motion.button
              onClick={onStartDiagnosis}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-8 py-4
                          bg-gradient-to-r from-indigo-600 to-purple-600
                          rounded-xl text-base sm:text-lg font-bold text-white
                          shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30
                          transition-shadow duration-300 cursor-pointer"
            >
              내 상황 확인 시작하기
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 5 — SOCIAL PROOF
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6" ref={proofRef}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px]
                          rounded-full blur-[200px] opacity-[0.05]
                          bg-gradient-to-r from-purple-500 to-pink-500" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={proofInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              이미 많은 분들이{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                선택
              </span>
              하셨습니다
            </h2>
          </motion.div>

          {/* Reviews grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {(reviews.length > 0 ? reviews.slice(0, 3) : []).map((review, i) => {
              const savingsRate = review.originalDebt > 0
                ? Math.round(((review.originalDebt - review.remainingDebt) / review.originalDebt) * 100)
                : 0;

              return (
                <StaggerChild key={review.id} index={i} isInView={proofInView}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group relative p-6 rounded-2xl h-full
                                bg-gradient-to-br from-slate-800/70 to-slate-900/70
                                border border-slate-700/40 backdrop-blur-xl
                                hover:border-emerald-500/20
                                transition-colors duration-300"
                  >
                    {/* Category badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10
                                        px-3 py-1 rounded-full">
                        {review.category}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>

                    {/* Debt comparison */}
                    <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-slate-500 text-xs block mb-0.5">원래 채무</span>
                          <span className="text-slate-300 font-semibold">
                            {formatMoney(review.originalDebt)}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-emerald-400 mx-2 shrink-0" />
                        <div className="text-right">
                          <span className="text-slate-500 text-xs block mb-0.5">남은 변제</span>
                          <span className="text-emerald-400 font-bold">
                            {formatMoney(review.remainingDebt)}
                          </span>
                        </div>
                      </div>
                      {savingsRate > 0 && (
                        <div className="mt-2 text-center">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10
                                            px-2 py-0.5 rounded-full">
                            {savingsRate}% 탕감
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-3">
                      "{review.content}"
                    </p>
                    <p className="text-xs text-slate-600">— {review.author}</p>
                  </motion.div>
                </StaggerChild>
              );
            })}
          </div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={proofInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="p-6 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-900/80
                        border border-slate-700/30 backdrop-blur-xl"
          >
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-center">
              {[
                { emoji: '📊', label: '평균 탕감률', value: '72%' },
                { emoji: '⏱', label: '평균 진단 시간', value: '47초' },
                { emoji: '👥', label: '누적 이용자', value: '8,400+' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-2xl">{stat.emoji}</span>
                  <div className="text-left">
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* More link */}
          <div className="text-center mt-8">
            <button
              onClick={() => onNavigate('reviews')}
              className="inline-flex items-center gap-2 text-sm text-slate-400
                          hover:text-indigo-400 transition-colors cursor-pointer"
            >
              성공 사례 더보기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 6 — EXPERT PREVIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6" ref={expertRef}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={expertInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              진단 후{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                맞춤 전문가
              </span>
              를 추천해드립니다
            </h2>
            <p className="text-slate-500 text-base sm:text-lg">
              결과에 따라 가장 적합한 전문가를 자동 매칭합니다.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {(lawyers.length > 0 ? lawyers.slice(0, 3) : []).map((lawyer, i) => {
              const initials = lawyer.name.slice(0, 1);
              return (
                <StaggerChild key={lawyer.id} index={i} isInView={expertInView}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group relative p-6 rounded-2xl text-center
                                bg-gradient-to-br from-slate-800/60 to-slate-900/60
                                border border-slate-700/40 backdrop-blur-xl
                                hover:border-indigo-500/20
                                transition-colors duration-300"
                  >
                    {/* Avatar placeholder */}
                    <div className="mx-auto mb-4 w-16 h-16 rounded-full
                                    bg-gradient-to-br from-indigo-500 to-purple-600
                                    flex items-center justify-center text-xl font-bold text-white
                                    shadow-lg shadow-indigo-500/20">
                      {initials}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">
                      {lawyer.name} <span className="text-slate-400 font-normal">변호사</span>
                    </h3>
                    <p className="text-sm text-slate-500 mb-3">
                      {lawyer.region} | {lawyer.fields.join('·')} 전문
                    </p>

                    <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        매칭 {lawyer.matchedCount}건
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        4.9
                      </span>
                    </div>
                  </motion.div>
                </StaggerChild>
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={expertInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center text-sm text-slate-500"
          >
            <HeartHandshake className="inline w-4 h-4 mr-1 -mt-0.5" />
            전문가는 진단 결과에 따라 자동 매칭됩니다
          </motion.p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 7 — FINAL CTA
          ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatedSection className="relative py-24 sm:py-32 px-6">
        {/* Dark gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
          <div className="absolute inset-0"
               style={{
                 background:
                   'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(99,102,241,0.08), transparent)',
               }} />
          {/* Decorative border top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <AlertTriangle className="w-10 h-10 text-amber-400/60 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
              잘못된 선택을 하기 전에,
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                먼저 확인하세요
              </span>
            </h2>

            <motion.button
              onClick={onStartDiagnosis}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="relative group inline-flex items-center gap-3 px-10 py-5 mb-6
                          bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600
                          rounded-2xl text-lg sm:text-xl font-bold text-white
                          shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40
                          transition-shadow duration-300 cursor-pointer"
            >
              {/* Pulse ring */}
              <motion.span
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600"
                animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="relative z-10 flex items-center gap-3">
                🔍 익명으로 내 상황 확인하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>

            <p className="text-sm text-slate-500 tracking-wide">
              소요시간 1분 · 회원가입 불필요 · 결과 즉시 확인
            </p>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* ════════════════════════════════════════════════════════════════════════
          FOOTER SPACER
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="h-16 bg-slate-950" />
    </div>
  );
}
