import React, { useState } from 'react';
import { 
  MessageSquare, Users, Lock, ArrowRight, CheckCircle2, 
  ChevronDown, Shield, Clock, Search, BookOpen, FileText, 
  ExternalLink, Layers, Sparkles, Building, Briefcase, ShieldAlert, Check 
} from 'lucide-react';

interface GuideViewProps {
  onNavigate?: (tab: string) => void;
}

export default function GuideView({ onNavigate }: GuideViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [docTab, setDocTab] = useState<'salary' | 'business'>('salary');

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
      title: '전문 변호사 비교',
      desc: '회생·파산 전문 변호사들의 간단 답변을 비교하고 선택합니다.',
      details: [
        '변호사들이 내 사건에 대한 초기 답변 제공',
        '경력, 전문 분야, 실제 이용 후기 확인',
        '마음에 드는 변호사가 없으면 진행하지 않아도 무방',
      ],
      icon: <Users className="w-7 h-7" />,
      color: 'bg-[#1E3A5F]',
      lightColor: 'bg-[#EEF4FA]',
      textColor: 'text-[#1E3A5F]',
    },
    {
      step: 'STEP 3',
      title: '1:1 프라이빗 상담',
      desc: '선택한 변호사와 암호화된 채팅방에서 안전하게 상담합니다.',
      details: [
        '스텔스 가명으로 실명 노출 없이 상담',
        '실시간 또는 비실시간 모두 가능',
        '선임 여부는 상담 후 자유롭게 결정',
      ],
      icon: <Lock className="w-7 h-7" />,
      color: 'bg-[#0F766E]',
      lightColor: 'bg-teal-50',
      textColor: 'text-[#0F766E]',
    },
  ];

  const faqs = [
    { q: '비용이 발생하나요?', a: '채무 체크부터 전문가 상담 요청까지 플랫폼 이용료는 발생하지 않습니다. 정식 선임 시 비용은 각 변호사가 개별 안내합니다.' },
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

      {/* ── [신규: 법원 매뉴얼 7-1 준용] 개인회생 기본 서류 7단계 준비 가이드 ── */}
      <section className="w-full py-16 md:py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-extrabold text-blue-700 tracking-wider uppercase px-3 py-1 rounded-full bg-blue-100/70">
              법원 제출 표준 매뉴얼
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              개인회생 신청 기본 서류 7단계 준비 가이드
            </h2>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              법원 전자소송에 접수되는 7대 표준 소명자료 그룹별 발급처와 필수 체크포인트를 안내해 드립니다.
            </p>
          </div>

          {/* 소득 유형별 탭 스위처 */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setDocTab('salary')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer press-scale flex items-center gap-2 ${
                docTab === 'salary'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>직장인·급여소득자 (22종 표준)</span>
            </button>
            <button
              onClick={() => setDocTab('business')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer press-scale flex items-center gap-2 ${
                docTab === 'business'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>자영업·영업소득자 (24종 표준)</span>
            </button>
          </div>

          {/* ⚠️ 법원 개인정보 보호 수칙 배너 */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 text-xs sm:text-sm flex items-start gap-3 shadow-2xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left">
              <strong className="font-bold text-amber-900">대법원 전자소송 개인정보 보호 핵심 준칙:</strong>
              <p className="text-xs text-amber-800 leading-relaxed">
                가족관계증명서, 혼인관계증명서, 주민등록등본 발급 시 <u>신청인 본인을 제외한 가족(부모, 배우자, 자녀)의 주민번호 뒷자리는 반드시 마스킹(******)</u>하여 제출해야 법원 보정명령을 방지할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 7대 그룹 카드 리스트 */}
          <div className="space-y-3.5">
            {[
              {
                step: 1,
                title: '1. 주민등록등본 및 초본',
                fileName: '최신 주민등록초본.pdf',
                issuer: '정부24 / 주민센터',
                desc: '과거 주소변동사항 전체 내역 및 말소사항이 포함된 최신 초본 발급',
                tip: '법원 관할 확인 및 최근 주소 이력 소명을 위해 신청일 기준 1개월 내 발급분 필수',
                badge: '필수 1호',
                url: 'https://www.gov.kr'
              },
              {
                step: 2,
                title: '2. 가족관계증명서 & 혼인관계증명서',
                fileName: '가족관계증명서 혼인관계증명서.pdf',
                issuer: '대법원 전자의무기록 / 주민센터',
                desc: '미혼, 기혼, 이혼 여부와 무관하게 모든 신청인이 반드시 "상세" 증명서로 발급',
                tip: '신청인 본인 외 가족 주민등록번호 뒷자리는 마스킹(별표) 처리 필수',
                badge: '필수 2호',
                url: 'https://efamily.scourt.go.kr'
              },
              {
                step: 3,
                title: '3. 신청인 본인 예금계좌 사본',
                fileName: '신청인 본인의 예금계좌 사본.pdf',
                issuer: '거래 은행 / 인터넷뱅킹 모바일 앱',
                desc: '법원 회생 환급금(예납금 잔액 및 과오납 변제금) 수령용 통장 사본',
                tip: '반드시 신청인 본인 실명 명의 계좌여야 하며, 가족이나 제3자 명의 계좌는 불허됩니다.',
                badge: '필수 3호'
              },
              {
                step: 4,
                title: '4. 채권자 보유 소명자료 (부채증명서철)',
                fileName: '채권자 보유 소명자료.pdf',
                issuer: '각 채권 금융기관 / 대행 발급',
                desc: '원금, 개시전이자, 담보 설정 여부가 명시된 법원 제출용 정규 부채증명서 일체',
                tip: '사무소 선임 시 대행업체를 통해 방문 없이 원스톱으로 일괄 발급 가능합니다.',
                badge: '필수 4호'
              },
              {
                step: 5,
                title: '5. 재산 목록 소명자료',
                fileName: '재산 목록 소명자료.pdf',
                issuer: '위택스 / K-Geo / 금융결제원 / 각 보험사',
                desc: '지방세 세목별 과세증명서(최근 5년 전국단위), 지적전산자료(K-Geo 무소유 증명), 계좌정보통합관리원(어카운트인포), 보험해약환급금 확인서, 자동차등록원부, 부동산등기부',
                tip: '부동산이나 차량이 없는 경우에도 "전국 단위 무소유 증명서"가 필수 제출됩니다.',
                badge: '필수 5호',
                url: 'https://www.wetax.go.kr'
              },
              {
                step: 6,
                title: docTab === 'salary' ? '6. 거주자의 수입 및 지출 소명자료 (급여소득)' : '6. 거주자의 수입 및 지출 소명자료 (영업소득)',
                fileName: '거주자의 수입 및 지출에 관한 목록 소명 자료.pdf',
                issuer: docTab === 'salary' ? '홈택스 / 현 직장 / 건보공단' : '홈택스 / 세무사 / 각 은행',
                desc: docTab === 'salary'
                  ? '재직증명서, 근로계약서, 근로소득원천징수영수증(최근 1~2년), 소득금액증명원, 최근 1년 급여명세서 및 급여통장 거래내역, 건강보험자격득실확인서'
                  : '사업자등록증명원(폐업증명), 부가가치세 과세표준증명원(최근 3년), 종합소득세 확정신고서, 사업장 임대차계약서, 최근 1년 매출·매입통장 거래내역',
                tip: docTab === 'salary' 
                  ? '이직한 지 1년 미만인 경우 전 직장 원천징수와 현 직장 급여지급확인서를 함께 제출합니다.' 
                  : '현금매출 누락이 없도록 사업용 계좌와 신용카드 매출 입금 계좌를 대조하여 소명합니다.',
                badge: '필수 6호',
                url: 'https://www.hometax.go.kr'
              },
              {
                step: 7,
                title: '7. 진술서 소명자료',
                fileName: '진술서 소명자료.pdf',
                issuer: '주민센터 / 종합병원 / 자체 작성',
                desc: '무상거주사실확인서(타인 명의 주거 시), 국민기초생활수급자 증명서, 장애인 증명서, 최근 1년 진료비 영수증 및 진단서 등',
                tip: '채무발생 및 증대 경위 진술서에 기재된 사유(병원비, 폐업, 실직 등)를 직접 입증하는 자료입니다.',
                badge: '선택 7호'
              }
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="w-8 h-8 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 bg-blue-600 text-white shadow-2xs">
                    {item.step}
                  </span>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-extrabold text-slate-900">
                        {item.title}
                      </h4>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {item.fileName}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-800">
                        {item.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>

                    <div className="text-[11px] text-amber-900 bg-amber-50/70 px-2.5 py-1 rounded-lg border border-amber-200/80">
                      💡 <strong>실무 팁:</strong> {item.tip}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">발급처</div>
                    <div className="text-xs font-bold text-slate-700">{item.issuer}</div>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                    >
                      <span>발급처 바로가기</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 하단 진단 CTA */}
          <div className="p-6 rounded-3xl bg-linear-to-r from-slate-900 to-blue-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg text-left">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">
                서류 준비가 막막하시다면 전문 변호사와 먼저 상담하세요
              </h4>
              <p className="text-xs text-slate-300">
                스텔스 익명 진단으로 내 소득과 재산에 맞는 맞춤 서류 목록을 실시간으로 확인하실 수 있습니다.
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('diagnosis')}
                className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs sm:text-sm transition-all shrink-0 cursor-pointer press-scale whitespace-nowrap shadow-md"
              >
                1분 무료 자격 진단 시작하기
              </button>
            )}
          </div>
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
          <p className="text-base text-slate-600 font-medium">소요시간 1분 · 실명 노출 없음 · 변호사 직접 선택</p>
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
