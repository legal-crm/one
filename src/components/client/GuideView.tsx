import React from 'react';
import { MessageSquare, BarChart3, Users, Lock, ArrowRight, CheckCircle2, ChevronDown, Shield, Clock, Search, BookOpen } from 'lucide-react';

interface GuideViewProps {
  onNavigate?: (tab: string) => void;
}

export default function GuideView({ onNavigate }: GuideViewProps) {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  const steps = [
    {
      step: 'STEP 1',
      title: '1분 익명 채무 체크',
      desc: '회원가입 없이 간단한 질문에 답하면 채무 상황이 체계적으로 정리됩니다.',
      details: [
        '채무 종류, 금액, 소득 등 기본 정보 입력',
        '스텔스 가명으로 완전 익명 진행',
        '소요시간 약 1분, 별도 서류 불필요',
      ],
      icon: <MessageSquare className="w-7 h-7" />,
      color: 'bg-[#0F766E]',
      lightColor: 'bg-teal-50',
      textColor: 'text-[#0F766E]',
    },
    {
      step: 'STEP 2',
      title: 'AI 분석 결과 확인',
      desc: '입력한 정보를 바탕으로 적합한 채무 해결 방안을 분석합니다.',
      details: [
        '개인회생, 개인파산, 채무조정 등 방안 비교',
        '예상 변제금액·기간 시뮬레이션 제공',
        '법원 공개 기준 기반의 참고 분석',
      ],
      icon: <BarChart3 className="w-7 h-7" />,
      color: 'bg-[#1E3A5F]',
      lightColor: 'bg-[#EEF4FA]',
      textColor: 'text-[#1E3A5F]',
    },
    {
      step: 'STEP 3',
      title: '전문 변호사 비교',
      desc: '회생·파산 전문 변호사들의 간단 답변을 비교하고 선택합니다.',
      details: [
        '전문가들이 내 사건에 대한 초기 답변 제공',
        '경력, 전문 분야, 실제 이용 후기 확인',
        '마음에 드는 전문가가 없으면 진행하지 않아도 무방',
      ],
      icon: <Users className="w-7 h-7" />,
      color: 'bg-[#0F766E]',
      lightColor: 'bg-teal-50',
      textColor: 'text-[#0F766E]',
    },
    {
      step: 'STEP 4',
      title: '1:1 프라이빗 상담',
      desc: '선택한 변호사와 암호화된 채팅방에서 안전하게 상담합니다.',
      details: [
        '스텔스 가명으로 실명 노출 없이 상담',
        '실시간 또는 비실시간 모두 가능',
        '선임 여부는 상담 후 자유롭게 결정',
      ],
      icon: <Lock className="w-7 h-7" />,
      color: 'bg-[#1E3A5F]',
      lightColor: 'bg-[#EEF4FA]',
      textColor: 'text-[#1E3A5F]',
    },
  ];

  const faqs = [
    { q: '비용이 발생하나요?', a: '채무 체크부터 전문가 상담 요청까지 모든 과정이 100% 무료입니다. 정식 선임 시 비용은 각 변호사가 개별 안내합니다.' },
    { q: '개인정보는 안전한가요?', a: '스텔스 가명 시스템으로 실명이 노출되지 않으며, 모든 데이터는 SSL/TLS 암호화로 보호됩니다.' },
    { q: '상담 후 반드시 선임해야 하나요?', a: '아닙니다. 상담 후 선임 여부는 전적으로 의뢰인의 자유이며, 진행하지 않아도 불이익은 없습니다.' },
    { q: '어떤 변호사가 등록되어 있나요?', a: '회생·파산 분야에서 실무 경험이 풍부한 전문 변호사만 등록되어 있습니다. 프로필에서 경력과 후기를 확인할 수 있습니다.' },
  ];

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="w-full bg-gradient-to-br from-[#0F2440] via-[#1E3A5F] to-[#162D4A] py-18 md:py-24 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-teal-500/[0.06] rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs sm:text-sm font-semibold mb-1 backdrop-blur-sm">
            <span>플랫폼 이용 가이드</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            서비스 이용안내
          </h1>
          <p className="text-base md:text-lg text-slate-200 font-medium max-w-md mx-auto leading-relaxed">
            4단계로 진행되는 my김변 서비스를<br className="md:hidden" /> 자세히 안내해 드립니다
          </p>
        </div>
      </section>

      {/* Key Features */}
      <section className="w-full py-8 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: <Clock className="w-6 h-6" />, label: '소요시간 1분' },
              { icon: <Shield className="w-6 h-6" />, label: '100% 익명' },
              { icon: <Search className="w-6 h-6" />, label: '전문가 비교' },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 py-3">
                <div className="text-[#1E3A5F]">{item.icon}</div>
                <span className="text-sm md:text-base font-bold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="w-full py-14 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 md:space-y-14">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute left-6 top-[72px] w-0.5 h-[calc(100%+56px-72px)] bg-slate-200" />
              )}
              <div className="flex gap-4 md:gap-6">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center text-white shrink-0 relative z-10 shadow-sm`}>
                  {step.icon}
                </div>
                {/* Content */}
                <div className="flex-1 space-y-3.5 pb-2 text-left">
                  <div className="space-y-1">
                    <span className={`text-xs sm:text-sm font-extrabold ${step.textColor} tracking-wider`}>{step.step}</span>
                    <h3 className="text-xl md:text-2xl font-bold text-[#0f172a] tracking-tight">{step.title}</h3>
                    <p className="text-base text-slate-600 leading-relaxed font-normal">{step.desc}</p>
                  </div>
                  <div className={`${step.lightColor} rounded-2xl p-5 space-y-2.5`}>
                    {step.details.map((detail, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-2.5">
                        <CheckCircle2 className={`w-5 h-5 ${step.textColor} shrink-0 mt-0.5`} />
                        <span className="text-sm sm:text-base text-slate-700 font-medium">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Legal Guide Cross-link Banner */}
      <section className="w-full py-10 bg-slate-100/80 border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1 text-left">
                <h4 className="text-lg font-bold text-slate-900">회생·파산·신용회복 등 법률 제도가 궁금하신가요?</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  개인회생, 개인파산, 신용회복, 채무자대리 4가지 제도의 차이점과 상세 해결 전략을 확인하세요.
                </p>
              </div>
            </div>
            <a
              href="/guide/debt-management"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all shrink-0 active:scale-[0.98] whitespace-nowrap shadow-sm"
            >
              채무관리 가이드 보기
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full py-14 md:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center">
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight">자주 묻는 질문</h3>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-bold text-base md:text-lg text-[#0f172a]">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-4 font-normal text-left">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h3 className="text-xl md:text-2xl font-extrabold text-[#0f172a] tracking-tight">
            지금 바로 시작해 보세요
          </h3>
          <p className="text-base text-slate-600 font-medium">소요시간 1분 · 회원가입 불필요 · 결과 즉시 확인</p>
          <button
            onClick={() => onNavigate?.('landing')}
            className="inline-flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162D4A] text-white font-bold px-8 py-4 rounded-xl text-base transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap shadow-md hover:shadow-lg"
          >
            채무 상황 체크하기
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
