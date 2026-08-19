import React from 'react';
import { Shield, Eye, Users, ArrowRight, ShieldCheck, Lock, Zap } from 'lucide-react';

interface CompanyViewProps {
  onNavigate?: (tab: string) => void;
}

export default function CompanyView({ onNavigate }: CompanyViewProps) {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="w-full bg-gradient-to-br from-[#0F2440] via-[#1E3A5F] to-[#162D4A] py-20 md:py-28 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/[0.05] rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-5">
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            채무 해결의 새로운 기준을<br />만들어갑니다
          </h1>
          <p className="text-sm md:text-base text-slate-300 font-medium max-w-lg mx-auto leading-relaxed">
            my김변은 채무 문제로 어려움을 겪는 분들이 적합한 전문가를<br className="hidden md:block" />
            쉽고 안전하게 찾을 수 있도록 지원합니다.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="w-full py-14 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-xs font-bold text-[#3B82F6] tracking-widest uppercase">Mission</p>
          <h2 className="text-lg md:text-2xl font-bold text-[#0f172a] leading-snug tracking-tight">
            법률 서비스의 정보 비대칭을 해소하여<br />
            누구나 공정한 도움을 받을 수 있도록
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            채무 문제는 누구에게나 찾아올 수 있지만, 어디서부터 어떻게 해결해야 할지 알기 어렵습니다.
            my김변은 채무 상황을 체계적으로 정리하고, 전문 변호사와 안전하게 연결하는 플랫폼을 만들고 있습니다.
          </p>
        </div>
      </section>

      {/* Stats */}
      {/* <!-- mock: 아래 수치는 서비스 예시 데이터입니다 --> */}
      <section className="w-full py-14 md:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2">
            <h3 className="text-lg md:text-2xl font-bold text-[#0f172a] tracking-tight">
              my김변은 빠르게 성장하고 있습니다
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { value: '8,400+', label: '누적 이용자 수', color: 'text-[#0F766E]' },
              { value: '47초', label: '평균 체크 소요시간', color: 'text-[#1E3A5F]' },
              { value: '120+', label: '등록 전문 변호사', color: 'text-[#0F766E]' },
              { value: '4.8/5.0', label: '평균 만족도', color: 'text-[#1E3A5F]' },
            ].map((stat, idx) => (
              <div key={idx} className="text-center space-y-1.5">
                <p className={`text-2xl md:text-3xl font-extrabold ${stat.color} tracking-tight`}>{stat.value}</p>
                <p className="text-xs md:text-sm text-slate-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="w-full py-14 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2">
            <h3 className="text-lg md:text-2xl font-bold text-[#0f172a] tracking-tight">
              핵심 가치
            </h3>
            <p className="text-sm text-slate-500 font-medium">my김변이 지키는 3가지 원칙</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Eye className="w-6 h-6" />,
                title: '투명성',
                desc: '변호사 프로필, 전문 분야, 실제 이용 후기를 공개하여 의뢰인이 충분한 정보를 바탕으로 선택할 수 있도록 합니다.',
              },
              {
                icon: <Lock className="w-6 h-6" />,
                title: '익명성',
                desc: '스텔스 가명 시스템을 통해 실명 없이 상담이 가능합니다. 모든 데이터는 SSL/TLS 암호화로 보호됩니다.',
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: '접근성',
                desc: '복잡한 법률 절차를 1분 채무 체크와 AI 분석으로 간소화하여 누구나 쉽게 시작할 수 있습니다.',
              },
            ].map((item, idx) => (
              <div key={idx} className="text-center space-y-3 p-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#EEF4FA] flex items-center justify-center text-[#1E3A5F]">
                  {item.icon}
                </div>
                <h4 className="font-bold text-base text-[#0f172a]">{item.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal Compliance */}
      <section className="w-full py-14 md:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-lg md:text-2xl font-bold text-[#0f172a] tracking-tight">
              법령 준수 운영 원칙
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: '변호사법 준수', desc: '변호사법 제34조에 의거 알선료·수수료 수취를 금지하는 구조를 채택하고 있습니다.' },
              { title: '광고비 정액제', desc: '광고비는 정액제로 상담 건수·수임 여부·사건 결과와 연동되지 않습니다.' },
              { title: '통신판매중개자', desc: '플랫폼은 통신판매중개자로서 변호사와 의뢰인 간 계약에 직접 관여하지 않습니다.' },
              { title: '개인정보 보호', desc: '개인정보 처리방침에 따라 이용자의 정보를 안전하게 관리합니다.' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
                  <h5 className="font-bold text-sm text-[#0f172a]">{item.title}</h5>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full py-14 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <h3 className="text-lg md:text-xl font-bold text-[#0f172a] tracking-tight">
            지금 바로 채무 상황을 확인해 보세요
          </h3>
          <button
            onClick={() => onNavigate?.('landing')}
            className="inline-flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162D4A] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
          >
            서비스 시작하기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
