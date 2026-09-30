import React from 'react';
import { ArrowRight, Check, Lock, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import { Badge, Button } from '../ui';

interface HeroSectionProps {
  onStartCheck: () => void;
  onBrowseLawyers: () => void;
}

// 확인 가능한 서비스 약속만 적는다(R4: 과장·근거 없는 수치 금지). '스텔스 보증'·'100% 익명'은 보존 용어.
const PROMISES = [
  { icon: MessageSquare, title: '상담 요청까지 이용료 없음', desc: '채무 정리부터 변호사 상담 요청까지 플랫폼 이용료가 발생하지 않습니다.' },
  { icon: Lock, title: '100% 익명으로 시작', desc: '실명·주민등록번호 없이 스텔스 가명으로 상담할 수 있습니다.' },
  { icon: Users, title: '변호사는 직접 선택', desc: '프로필을 비교해 원하는 변호사에게만 상담을 요청합니다.' },
  { icon: ShieldCheck, title: '암호화 전송·저장', desc: '상담 데이터는 SSL/TLS로 전송되고 암호화된 서버에 저장됩니다.' },
];

export default function HeroSection({ onStartCheck, onBrowseLawyers }: HeroSectionProps) {
  return (
    <section className="w-full bg-slate-50 border-b border-slate-200" aria-labelledby="landing-hero-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 md:pt-16 md:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 text-left">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-slate-600" aria-label="이용 조건">
            {['약 3분', '100% 익명', '가입 없이 시작'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-secondary" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>

          <h1 id="landing-hero-title" className="mt-4 text-3xl sm:text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight text-slate-900 break-keep">
            내 채무를 먼저 정리하고,
            <br className="hidden sm:block" /> 상담할 변호사는 직접 선택하세요
          </h1>

          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed max-w-xl break-keep">
            이름 없이 채무 상황을 정리하고, 변호사 정보를 비교한 뒤 원하는 변호사에게만 상담을 요청할 수 있습니다.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={onStartCheck} rightIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />} className="sm:px-7">
              내 채무 상황 체크하기
            </Button>
            <Button size="lg" variant="secondary" onClick={onBrowseLawyers}>
              변호사 먼저 둘러보기
            </Button>
          </div>

          <p className="mt-5 text-sm text-slate-600 leading-relaxed flex items-start gap-1.5 max-w-xl break-keep">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>상담정보는 가명으로 처리되며, 변호사가 사건 내용을 파악하고 답변하기 위한 목적으로만 사용됩니다.</span>
          </p>
        </div>

        <aside className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white shadow-sm px-5 sm:px-6" aria-labelledby="landing-promise-title">
          <div className="flex items-center justify-between gap-3 py-4 border-b border-slate-100">
            <h2 id="landing-promise-title" className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand" aria-hidden="true" />
              my김변 안심 서비스 약속
            </h2>
            <Badge tone="teal">스텔스 보증</Badge>
          </div>
          {/* 모바일은 2열 요약(제목만), sm 이상은 설명 포함 목록 */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4 py-4 sm:grid-cols-1 sm:gap-0 sm:py-0 sm:divide-y sm:divide-slate-100">
            {PROMISES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-center sm:items-start gap-2.5 sm:gap-3.5 sm:py-4">
                <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-bold text-slate-900 break-keep">{title}</p>
                  <p className="hidden sm:block mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
